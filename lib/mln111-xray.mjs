import { mlnSourceSpans, mlnEvidenceSpans } from "./mln111-spans.mjs";

export function normalizeMlnQuote(value) {
  return value.normalize("NFC").replace(/\s+/gu, " ").trim();
}

export function resolveMlnConceptSources(concepts, bookIndex) {
  const sections = new Set(bookIndex.sections.map((section) => section.id));
  const ids = new Set();
  return concepts.map((concept) => {
    if (ids.has(concept.id)) throw new Error(`Concept ID bị trùng: ${concept.id}`);
    ids.add(concept.id);
    if (concept.sourceSectionIds.some((id) => !sections.has(id))) throw new Error(`Concept trỏ tới mục không tồn tại: ${concept.id}`);
    const sourceUnitIds = bookIndex.units.filter((unit) => unit.supportsMapping && concept.sourceSectionIds.includes(unit.sectionId) && (!concept.sourceUnitTitles || concept.sourceUnitTitles.includes(unit.title))).map((unit) => unit.id);
    if (!sourceUnitIds.length) throw new Error(`Concept thiếu đơn vị nguồn: ${concept.id}`);
    if (concept.sourceUnitTitles?.some((title) => !bookIndex.units.some((unit) => concept.sourceSectionIds.includes(unit.sectionId) && unit.title === title))) throw new Error(`Tiểu mục nguồn đã thay đổi: ${concept.id}`);
    return { ...concept, sourceUnitIds };
  });
}

function sourceLocation(unit, source) {
  const pages = source.printedPageStart === null ? null : `tr. ${source.printedPageStart}${source.printedPageEnd !== null && source.printedPageEnd !== source.printedPageStart ? `–${source.printedPageEnd}` : ""}`;
  return [`Chương ${unit.chapter} · ${unit.sectionPath.join(" › ")}`, pages, `bản Markdown, dòng ${source.lineStart}–${source.lineEnd}`].filter(Boolean).join(" · ");
}

/** Resolve trusted quote IDs; check every reference, without pruning bad IDs. */
export function validateAndEnrichXRayMatches(input) {
  const turnById = new Map(input.turns.map((turn) => [turn.id, turn]));
  const conceptById = new Map(input.concepts.map((concept) => [concept.id, concept]));
  const sourceSpans = new Map();
  for (const chunkId of input.candidateChunkIds) {
    const selected = input.chunksById.get(chunkId);
    if (selected) for (const span of mlnSourceSpans(selected.chunk)) sourceSpans.set(span.id, span);
  }
  const evidenceSpans = new Map(input.turns.filter((turn) => turn.role === "thinker" || turn.role === "user")
    .flatMap((turn) => mlnEvidenceSpans(turn).map((span) => [span.id, span])));
  const matches = [];
  const rejected = [];
  let duplicateCount = 0;
  const seen = new Set();

  input.matches.forEach((match, index) => {
    const reject = (reason) => rejected.push({ index, reason });
    if (!Array.isArray(match.sourceSpanIds) || !match.sourceSpanIds.length || match.sourceSpanIds.some((id) => !sourceSpans.has(id))) { reject("source_not_retrieved"); return; }
    const selectedSpans = [...new Set(match.sourceSpanIds)].map((id) => sourceSpans.get(id));
    const sourceUnitIds = [...new Set(selectedSpans.map((span) => span.unitId))];
    const selectedUnits = sourceUnitIds.map((id) => input.unitsById.get(id));
    if (selectedUnits.some((unit) => !unit?.supportsMapping)) { reject("unknown_source_unit"); return; }
    const concept = match.conceptId === null ? null : conceptById.get(match.conceptId);
    if (match.conceptId !== null && !concept) { reject("unknown_concept"); return; }
    if (concept && sourceUnitIds.some((id) => !concept.sourceUnitIds.includes(id))) { reject("concept_source_mismatch"); return; }
    if (!concept && sourceUnitIds.length > 1) { reject("mixed_source_units"); return; }
    if (!Array.isArray(match.evidenceSpanIds) || !match.evidenceSpanIds.length || match.evidenceSpanIds.some((id) => !evidenceSpans.has(id))) { reject("invalid_evidence_id"); return; }
    const chosenEvidence = [...new Set(match.evidenceSpanIds)].map((id) => evidenceSpans.get(id));
    if (chosenEvidence.some((span) => !normalizeMlnQuote(turnById.get(span.turnId).dialogue).includes(span.text))) { reject("evidence_quote_not_found"); return; }
    const evidenceTurnIds = [...new Set(chosenEvidence.map((span) => span.turnId))];
    // Wording changes between batches do not create a new grounded relation.
    // Distinct source units remain distinct even under the same parent section.
    const key = `${sourceUnitIds.slice().sort().join(",")}|${evidenceTurnIds.slice().sort().join(",")}`;
    if (seen.has(key)) { duplicateCount++; return; }
    seen.add(key);
    const citationGroups = new Map();
    for (const span of selectedSpans) {
      const citation = citationGroups.get(span.chunkId) ?? [];
      citation.push(span.text); citationGroups.set(span.chunkId, citation);
    }
    const sourceCitations = [...citationGroups].map(([chunkId, quotes]) => {
      const { chunk } = input.chunksById.get(chunkId);
      const unit = input.unitsById.get(chunk.unitId);
      return { chunkId, unitId: unit.id, title: unit.title, quotes, excerpt: chunk.text,
        sourceLocation: sourceLocation(unit, chunk.source), ...chunk.source };
    });
    const primary = sourceCitations[0];
    matches.push({
      ...match, sourceUnitId: sourceUnitIds[0], sourceUnitIds,
      sourceChunkId: primary.chunkId, sourceSectionId: selectedUnits[0].sectionId,
      sourceTitle: sourceUnitIds.length > 1 ? concept.title : selectedUnits[0].title,
      sourceQuote: primary.quotes[0], sourceExcerpt: primary.excerpt, sourceCitations,
      evidenceQuotes: chosenEvidence.map((span) => ({ turnId: span.turnId, quote: span.text })),
      evidenceTurnIds,
      sourcePageStart: primary.printedPageStart, sourcePageEnd: primary.printedPageEnd,
      sourceLineStart: primary.lineStart, sourceLineEnd: primary.lineEnd, sourceFile: primary.file,
      sourceLocation: primary.sourceLocation,
    });
  });
  const rejectionReasons = {};
  for (const { reason } of rejected) rejectionReasons[reason] = (rejectionReasons[reason] ?? 0) + 1;
  return { matches, rejected, rejectionReasons, duplicateCount };
}
