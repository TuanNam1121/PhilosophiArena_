const THINKERS = ["socrates", "hegel", "feuerbach", "marx", "engels", "lenin"];

export function makeEvaluationInput(sample) {
  return { kind: "xray", question: sample.question, activeIds: THINKERS,
    turns: sample.turns.map((turn, index) => ({
      id: `${sample.id}-turn-${index}`, role: turn.role,
      speakerId: turn.role === "thinker" ? THINKERS[index % THINKERS.length] : null,
      action: turn.role === "thinker" ? "opening" : turn.role === "user" ? "reflection" : "frame",
      targetId: null, nextStep: "continue", cardType: null, cardText: null, relation: "none",
      dialogue: turn.dialogue, workingQuestion: sample.question,
    })) };
}

export function unitMatchesGroup(unit, group) {
  if (group.anyOf) return group.anyOf.some((alternative) => unitMatchesGroup(unit, alternative));
  return Boolean(unit && unit.sectionId === group.sectionId && group.titleIncludes.some((title) => unit.title.includes(title)));
}

function matchSupportsGroup(match, group, units) {
  if (group.anyOf) return group.anyOf.some((alternative) => matchSupportsGroup(match, alternative, units));
  return (match.sourceCitations ?? []).some((citation) => {
    if (!unitMatchesGroup(units.get(citation.unitId), group)) return false;
    const text = citation.quotes.join(" ").normalize("NFC").toLocaleLowerCase("vi");
    return (group.quoteIncludesAll ?? []).every((part) => text.includes(part.toLocaleLowerCase("vi")));
  });
}

export function expectedUnits(bookIndex, group) {
  const units = bookIndex.units.filter((unit) => unit.supportsMapping && unitMatchesGroup(unit, group));
  if (!units.length) throw new Error(`Oracle source does not exist: ${JSON.stringify(group)}`);
  return units;
}

export function evaluateXRayCase(sample, response, bookIndex) {
  const errors = [];
  const units = new Map(bookIndex.units.map((unit) => [unit.id, unit]));
  const result = response.result ?? [];
  if ((response.diagnostics?.rejectedMatches ?? 0) || (response.diagnostics?.rejectedRoutes ?? 0)) errors.push("model_proposed_invalid_references_or_quotes");
  if (!sample.expectedSources.length) {
    if (result.length || (response.diagnostics?.proposedMatches ?? 0)) errors.push("unsupported_negative_was_mapped");
  } else {
    for (const group of sample.expectedSources) {
      expectedUnits(bookIndex, group);
      if (!result.some((match) => matchSupportsGroup(match, group, units))) errors.push(`missing_expected_source:${JSON.stringify(group)}`);
    }
    for (const match of result) {
      for (const id of match.sourceUnitIds ?? [match.sourceUnitId]) {
        const unitEvidence = { sourceCitations: (match.sourceCitations ?? []).filter((citation) => citation.unitId === id) };
        if (!sample.allowedSources.some((group) => matchSupportsGroup(unitEvidence, group, units))) errors.push(`unexpected_source:${id}`);
      }
    }
  }
  const chunks = new Map(bookIndex.sections.flatMap((section) => section.chunks.map((chunk) => [chunk.id, chunk])));
  const turns = new Map(makeEvaluationInput(sample).turns.map((turn) => [turn.id, turn]));
  for (const match of result) {
    if (!match.sourceCitations?.length) errors.push("missing_literal_source_citations");
    for (const citation of match.sourceCitations ?? []) {
      const actual = chunks.get(citation.chunkId);
      if (!actual || actual.unitId !== citation.unitId || actual.text !== citation.excerpt || citation.quotes.some((quote) => !actual.text.includes(quote))) errors.push(`bad_source_citation:${citation.chunkId}`);
      else if (["lineStart", "lineEnd", "printedPageStart", "printedPageEnd"].some((key) => citation[key] !== actual.source[key])) errors.push(`bad_source_location:${citation.chunkId}`);
    }
    if (match.evidenceQuotes?.some((quote) => {
      const actual = turns.get(quote.turnId);
      return !actual || (actual.role !== "user" && actual.role !== "thinker") || !actual.dialogue.normalize("NFC").replace(/\s+/gu, " ").trim().includes(quote.quote);
    })) errors.push("bad_evidence_citation");
  }
  return { passed: errors.length === 0, errors };
}

export async function evaluationFingerprints() {
  const files = ["lib/mln111-index.mjs", "lib/mln111-book.ts", "lib/mln111-concepts.server.ts", "lib/mln111-search.mjs", "lib/mln111-spans.mjs", "lib/mln111-xray-contract.mjs", "lib/mln111-xray.mjs", "lib/mln111-xray-service.mjs"];
  const hash = createHash("sha256");
  for (const file of files) hash.update(file).update(await readFile(new URL(`../${file}`, import.meta.url)));
  return {
    implementationSha256: hash.digest("hex"),
    bookIndexSha256: createHash("sha256").update(await readFile(new URL("../content/mln111/book-index.json", import.meta.url))).digest("hex"),
    catalogSha256: createHash("sha256").update(await readFile(new URL("../content/mln111/concepts.json", import.meta.url))).digest("hex"),
    evaluatorSha256: createHash("sha256").update(await readFile(new URL("./mln111-eval-utils.mjs", import.meta.url))).update(await readFile(new URL("./evaluate_mln111_live.mjs", import.meta.url))).digest("hex"),
  };
}
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
