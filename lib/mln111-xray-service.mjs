import { zodTextFormat } from "openai/helpers/zod";
import { searchMlnSources, searchMlnRoutedSources, mergeMlnCandidates, createMlnXRayBatches } from "./mln111-search.mjs";
import { validateAndEnrichXRayMatches } from "./mln111-xray.mjs";
import { mlnMatchingSchema, XRAY_INSTRUCTIONS, mlnRoutingSchema, XRAY_ROUTING_INSTRUCTIONS } from "./mln111-xray-contract.mjs";
import { mlnSourceSpans, mlnEvidenceSpans } from "./mln111-spans.mjs";

export class XRayAnalysisError extends Error {
  constructor(message, providerStatus = null) {
    super(message); this.name = "XRayAnalysisError"; this.providerStatus = providerStatus;
  }
}

/** Production API and live evaluation use exactly the same analysis path. */
export async function runMlnXRay(input, resources, provider) {
  const evidenceTurns = input.turns.filter((turn) => turn.role === "thinker" || turn.role === "user");
  const workingQuestion = input.workingQuestion ?? [...input.turns].reverse().find((turn) => turn.workingQuestion?.trim())?.workingQuestion ?? input.question;
  const eligibleUnits = resources.bookIndex.units.filter((unit) => unit.supportsMapping);
  const diagnostics = {
    totalSections: resources.bookIndex.sections.length,
    indexedSections: resources.bookIndex.sections.filter((section) => section.status === "indexed").length,
    indexedUnits: eligibleUnits.length, indexedChunks: resources.searchIndex.documents.length,
    candidatePassages: 0, candidateUnits: 0, candidateChapters: [],
    transcriptTurns: input.turns.length, evidenceTurns: evidenceTurns.length,
    reviewedEvidenceTurns: 0, modelBatches: 0, modelCalls: 0,
    semanticRoutes: 0, rejectedRoutes: 0,
    proposedMatches: 0, rejectedMatches: 0, duplicateMatches: 0, rejectionReasons: {},
    sourceSha256: resources.bookIndex.generatedFrom.sha256,
  };
  if (!evidenceTurns.length) return { analysisState: "insufficient-dialogue", result: [], diagnostics };

  const transcript = (turns) => turns.map((turn) => ({ id: turn.id, role: turn.role,
    speakerId: turn.speakerId ?? null, targetId: turn.targetId ?? null,
    action: turn.action ?? null, dialogue: turn.dialogue }));

  async function structuredCall(schema, name, instructions, context) {
    let response;
    try {
      response = await provider.client.responses.parse({
        model: provider.model, reasoning: { effort: "medium" }, store: false,
        instructions, input: JSON.stringify(context), max_output_tokens: 12000,
        text: { format: zodTextFormat(schema, name) },
      });
    } catch (error) {
      if (error?.status === 429) throw new XRayAnalysisError("X-Ray đang bị giới hạn lượt gọi. Hãy thử lại sau ít phút.", 429);
      if (error?.name?.includes("Length") || error?.name?.includes("ContentFilter")) throw new XRayAnalysisError("X-Ray chưa hoàn tất phần đối chiếu. Hãy thử lại; phiên vẫn được giữ.");
      throw new XRayAnalysisError("Chưa kết nối được dịch vụ đối chiếu giáo trình. Hãy thử lại; phiên vẫn được giữ.", error?.status ?? null);
    }
    if (response.status !== "completed" || !response.output_parsed) throw new XRayAnalysisError("X-Ray chưa tạo được kết quả hoàn chỉnh. Hãy thử lại; phiên vẫn được giữ.");
    const parsed = schema.safeParse(response.output_parsed);
    if (!parsed.success) throw new XRayAnalysisError("X-Ray trả về dữ liệu chưa hợp lệ. Hãy thử lại; phiên vẫn được giữ.");
    diagnostics.modelCalls++;
    provider.onResponse?.({ stage: name, model: response.model ?? provider.model, usage: response.usage ?? null, parsed: parsed.data });
    return parsed.data;
  }

  // This small directory exposes the complete source scope to semantic routing;
  // it contains titles and short previews, never the entire textbook.
  const routing = await structuredCall(mlnRoutingSchema(eligibleUnits.map((unit) => unit.id)), "arena_xray_routes", XRAY_ROUTING_INSTRUCTIONS, {
    question: input.question, workingQuestion, transcript: transcript(input.turns),
    sourceDirectory: eligibleUnits.map((unit) => ({
      sourceUnitId: unit.id, title: unit.title, sectionPath: unit.sectionPath,
      preview: resources.chunksById.get(unit.chunkIds[0]).chunk.text.split(/\s+/u).slice(0, 48).join(" "),
    })),
  });
  diagnostics.reviewedEvidenceTurns = evidenceTurns.length;
  diagnostics.semanticRoutes = routing.routes.length;
  const lexicalCandidates = searchMlnSources(resources.searchIndex, { ...input, workingQuestion }, resources.concepts);
  const routed = searchMlnRoutedSources(resources.searchIndex, routing.routes, input.turns, resources.concepts);
  diagnostics.rejectedRoutes = routed.rejectedRoutes;
  const candidates = mergeMlnCandidates(lexicalCandidates, routed.candidates);
  diagnostics.candidatePassages = candidates.length;
  diagnostics.candidateUnits = new Set(candidates.map((candidate) => candidate.unitId)).size;
  diagnostics.candidateChapters = [...new Set(candidates.map((candidate) => candidate.section.chapter))].sort();
  if (!candidates.length) return { analysisState: routed.rejectedRoutes ? "invalid-proposals" : "no-source-candidates", result: [], diagnostics };
  const batches = createMlnXRayBatches(candidates, input.turns);
  diagnostics.modelBatches = batches.length;
  const proposals = [];

  async function analyze(batch) {
    const unitIds = new Set(batch.candidates.map((candidate) => candidate.unitId));
    const anchors = resources.concepts.filter((concept) => concept.sourceUnitIds.some((id) => unitIds.has(id)));
    const sourceSpans = batch.candidates.flatMap(({ chunk }) => mlnSourceSpans(chunk));
    const evidenceSpans = batch.turns.filter((turn) => turn.role === "thinker" || turn.role === "user").flatMap(mlnEvidenceSpans);
    const schema = mlnMatchingSchema(anchors.map((concept) => concept.id), sourceSpans.map((span) => span.id), evidenceSpans.map((span) => span.id));
    const response = await structuredCall(schema, "arena_xray", XRAY_INSTRUCTIONS, {
      question: input.question, workingQuestion,
      candidateDirectory: [...new Map(candidates.map(({ unit }) => [unit.id, {
        sourceUnitId: unit.id, title: unit.title, sectionPath: unit.sectionPath,
      }])).values()],
      transcript: batch.turns.map((turn) => ({ id: turn.id, role: turn.role, speakerId: turn.speakerId ?? null, targetId: turn.targetId ?? null,
        spans: turn.role === "thinker" || turn.role === "user" ? mlnEvidenceSpans(turn).map(({ id, text }) => ({ id, text })) : [],
        context: turn.role === "moderator" ? turn.dialogue : null })),
      conceptAnchors: anchors
        .map(({ id, title, definition, matchGuidance, sourceUnitIds }) => ({ id, title, definition, matchGuidance, sourceUnitIds: sourceUnitIds.filter((id) => unitIds.has(id)) })),
      sourcePassages: batch.candidates.map(({ unit, chunk }) => ({ sourceUnitId: unit.id, sourceChunkId: chunk.id, title: unit.title, sectionPath: unit.sectionPath, spans: mlnSourceSpans(chunk).map(({ id, text }) => ({ id, text })) })),
    });
    return response.matches;
  }
  // Preserve the whole candidate union, with bounded batches instead of a
  // global 24-passage cutoff. Only linked and neighbouring turns are repeated.
  for (let offset = 0; offset < batches.length; offset += 2) {
    const results = await Promise.all(batches.slice(offset, offset + 2).map(analyze));
    for (const matches of results) proposals.push(...matches);
  }
  const checked = validateAndEnrichXRayMatches({
    matches: proposals, turns: input.turns, concepts: resources.concepts,
    unitsById: resources.unitsById, chunksById: resources.chunksById,
    candidateChunkIds: new Set(candidates.map((candidate) => candidate.chunkId)),
  });
  diagnostics.proposedMatches = proposals.length;
  diagnostics.rejectedMatches = checked.rejected.length;
  diagnostics.duplicateMatches = checked.duplicateCount;
  diagnostics.rejectionReasons = checked.rejectionReasons;
  const analysisState = checked.matches.length ? "matched"
    : checked.rejected.length || routed.rejectedRoutes ? "invalid-proposals" : "no-supported-match";
  return { analysisState, result: checked.matches, diagnostics };
}
