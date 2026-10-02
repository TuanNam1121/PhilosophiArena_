// Do not discard tu/do/y/co/he: they occur in tự do, độ, ý thức, cơ sở,
// hệ thống. BM25 downweights frequent terms without destroying these phrases.
const STOP_WORDS = new Set(["va", "cua", "nhung", "cac", "la", "mot", "trong", "voi", "duoc", "nay", "khi", "se", "da", "dang", "cho", "den", "ma", "thi", "nhu", "rang"]);

export function normalizeMlnText(value) {
  return value.toLocaleLowerCase("vi").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/gu, "d");
}

export function tokenizeMlnText(value) {
  const words = normalizeMlnText(value).split(/[^\p{L}\p{N}]+/u)
    .filter((token) => (token.length > 1 || token === "y") && !STOP_WORDS.has(token));
  return [...words, ...words.slice(1).map((word, index) => `${words[index]}_${word}`)];
}

/** @param {{units: Array<{id:string, sectionId:string, title:string, sectionPath:string[], supportsMapping:boolean}>, sections:Array<{id:string, chapter:number, heading:string, sectionPath:string[], source:object, chunks:Array<{id:string, unitId:string, text:string, wordStart:number, wordEnd:number, source:object}>}>}} bookIndex */
export function buildMlnSearchIndex(bookIndex) {
  const units = new Map(bookIndex.units.map((unit) => [unit.id, unit]));
  const documents = [];
  const documentFrequency = new Map();
  let totalLength = 0;
  for (const section of bookIndex.sections) {
    for (const chunk of section.chunks) {
      const unit = units.get(chunk.unitId);
      if (!unit?.supportsMapping) continue;
      const headingTerms = new Set(tokenizeMlnText(unit.sectionPath.join(" ")));
      const tokens = tokenizeMlnText(`${unit.sectionPath.join(" ")} ${chunk.text}`);
      const termFrequency = new Map();
      for (const token of tokens) termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
      for (const token of termFrequency.keys()) documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
      totalLength += tokens.length;
      documents.push({ sectionId: section.id, unitId: unit.id, section, unit, chunk, termFrequency, length: tokens.length, headingTerms });
    }
  }
  return { documents, documentFrequency, averageLength: documents.length ? totalLength / documents.length : 0 };
}

function queryWeights(text, concepts) {
  const terms = new Set(tokenizeMlnText(text));
  const weights = new Map([...terms].map((term) => [term, term.includes("_") ? 1.35 : 1]));
  const expansions = concepts.map((concept) => ({
    concept,
    overlap: new Set(tokenizeMlnText(`${concept.title} ${(concept.searchTerms ?? []).join(" ")}`).filter((term) => terms.has(term))).size,
  })).filter((item) => item.overlap >= 3).sort((a, b) => b.overlap - a.overlap).slice(0, 3);
  for (const { concept } of expansions) {
    for (const term of tokenizeMlnText((concept.searchTerms ?? []).join(" "))) {
      if (!weights.has(term)) weights.set(term, 0.18);
    }
  }
  return weights;
}

function rankDocuments(index, weights) {
  const count = index.documentCount ?? index.documents.length;
  return index.documents.map((document) => {
    let score = 0;
    for (const [term, weight] of weights) {
      const frequency = document.termFrequency.get(term) ?? 0;
      if (!frequency) continue;
      const df = index.documentFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (count - df + 0.5) / (df + 0.5));
      const denominator = frequency + 1.35 * (1 - 0.72 + 0.72 * document.length / (index.averageLength || 1));
      score += weight * idf * frequency * 2.35 / denominator;
      if (document.headingTerms.has(term)) score += weight * idf * 0.2;
    }
    return { document, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
}

/**
 * Rank each distinct argument independently, then merge its source candidates.
 * There is no global cutoff that silently deletes an earlier argument's unit.
 * At most two passages per atomic source unit; unrelated units in the same
 * textbook section do not compete for those two positions. Large unions are
 * handled in bounded model batches, rather than dropped.
 * @param {ReturnType<typeof buildMlnSearchIndex>} index
 * @param {{question:string, workingQuestion?:string|null, turns:Array<{id?:string, role:string, dialogue:string, cardText?:string|null}>}} session
 * @param {Array<{title:string, searchTerms?:string[]}>} concepts
 * @param {{baseUnits?:number, unitsPerTurn?:number, chunksPerUnit?:number}} options
 */
export function searchMlnSources(index, session, concepts = [], options = {}) {
  const baseUnits = options.baseUnits ?? 8;
  const unitsPerTurn = options.unitsPerTurn ?? 3;
  const chunksPerUnit = options.chunksPerUnit ?? 2;
  const evidenceTurns = session.turns.map((turn, position) => ({ ...turn, id: turn.id ?? `turn-${position}` }))
    .filter((turn) => turn.role === "thinker" || turn.role === "user");
  if (!evidenceTurns.length) return [];
  const selectedByChunk = new Map();
  const rankingCache = new Map();

  function add(item, turnIds, priority) {
    const existing = selectedByChunk.get(item.document.chunk.id);
    if (existing) {
      existing.score = Math.max(existing.score, item.score);
      existing.priority = Math.max(existing.priority, priority);
      for (const id of turnIds) existing.evidenceTurnIds.add(id);
    } else selectedByChunk.set(item.document.chunk.id, { ...item, priority, evidenceTurnIds: new Set(turnIds) });
  }

  for (const turn of evidenceTurns) {
    const text = `${turn.dialogue} ${turn.cardText ?? ""}`;
    const key = normalizeMlnText(text);
    let ranked = rankingCache.get(key);
    if (!ranked) {
      ranked = rankDocuments(index, queryWeights(text, concepts));
      rankingCache.set(key, ranked);
    }
    const unitIds = new Set();
    for (const item of ranked) {
      if (unitIds.has(item.document.unitId)) continue;
      unitIds.add(item.document.unitId);
      add(item, [turn.id], 2);
      if (unitIds.size >= unitsPerTurn) break;
    }
  }

  const globalText = `${session.question} ${session.workingQuestion ?? ""} ${evidenceTurns.map((turn) => turn.dialogue).join(" ")}`;
  const globalRanked = rankDocuments(index, queryWeights(globalText, concepts));
  const globalUnits = new Set();
  for (const item of baseUnits > 0 ? globalRanked : []) {
    if (globalUnits.has(item.document.unitId)) continue;
    globalUnits.add(item.document.unitId);
    const linked = selectedByChunk.get(item.document.chunk.id)?.evidenceTurnIds ?? [];
    add(item, linked, 1);
    if (globalUnits.size >= baseUnits) break;
  }

  // Link all selected chunks of a unit to the arguments that retrieved it.
  const perUnit = new Map();
  for (const selected of selectedByChunk.values()) {
    const group = perUnit.get(selected.document.unitId) ?? [];
    group.push(selected); perUnit.set(selected.document.unitId, group);
  }
  const output = [];
  for (const group of perUnit.values()) {
    const turnIds = new Set(group.flatMap((item) => [...item.evidenceTurnIds]));
    if (!turnIds.size) for (const turn of evidenceTurns) turnIds.add(turn.id);
    group.sort((a, b) => b.priority - a.priority || b.score - a.score);
    for (const item of group.slice(0, chunksPerUnit)) output.push({
      sectionId: item.document.sectionId, unitId: item.document.unitId, chunkId: item.document.chunk.id,
      score: Number(item.score.toFixed(4)), section: item.document.section, unit: item.document.unit,
      chunk: item.document.chunk, evidenceTurnIds: [...turnIds],
    });
  }
  return output.sort((a, b) => b.score - a.score);
}

/** Keep an atomic unit together and include neighbouring turns for replies. */
export function createMlnXRayBatches(candidates, turns, chunkBudget = 24) {
  const units = new Map();
  for (const candidate of candidates) {
    const group = units.get(candidate.unitId) ?? [];
    group.push(candidate); units.set(candidate.unitId, group);
  }
  const batches = [];
  let current = [];
  const flush = () => {
    if (!current.length) return;
    const ids = new Set(current.flatMap((candidate) => candidate.evidenceTurnIds));
    const positions = turns.flatMap((turn, index) => ids.has(turn.id) ? [index] : []);
    for (const position of positions) {
      if (position > 0) ids.add(turns[position - 1].id);
      if (position + 1 < turns.length) ids.add(turns[position + 1].id);
    }
    batches.push({ candidates: current, turns: turns.filter((turn) => ids.has(turn.id)) });
    current = [];
  };
  for (const group of units.values()) {
    if (current.length && current.length + group.length > chunkBudget) flush();
    current.push(...group);
  }
  flush();
  return batches;
}

/** Semantic routing selects units; BM25 selects passages only inside them. */
export function searchMlnRoutedSources(index, routes, turns, concepts = []) {
  const evidence = new Map(turns.filter((turn) => turn.role === "thinker" || turn.role === "user").map((turn) => [turn.id, turn]));
  const candidates = [];
  let rejectedRoutes = 0;
  for (const route of routes) {
    if (!route.evidenceTurnIds.length || route.evidenceTurnIds.some((id) => !evidence.has(id))) { rejectedRoutes++; continue; }
    const documents = index.documents.filter((document) => document.unitId === route.sourceUnitId);
    if (!documents.length) { rejectedRoutes++; continue; }
    const text = `${route.searchQuery} ${route.evidenceTurnIds.map((id) => evidence.get(id).dialogue).join(" ")}`;
    const localIndex = { ...index, documents, documentCount: index.documents.length };
    // Keep corpus-wide IDF when ranking a unit's passages.
    const ranked = rankDocuments(localIndex, queryWeights(text, concepts));
    const selected = [ranked[0]?.document ?? documents[0], documents[0]];
    const seen = new Set();
    for (const document of selected) {
      if (seen.has(document.chunk.id)) continue;
      seen.add(document.chunk.id);
      candidates.push({ sectionId: document.sectionId, unitId: document.unitId, chunkId: document.chunk.id,
        section: document.section, unit: document.unit, chunk: document.chunk,
        score: ranked.find((item) => item.document.chunk.id === document.chunk.id)?.score ?? 0,
        evidenceTurnIds: [...new Set(route.evidenceTurnIds)] });
    }
  }
  return { candidates, rejectedRoutes };
}

export function mergeMlnCandidates(...groups) {
  const merged = new Map();
  for (const candidate of groups.flat()) {
    const previous = merged.get(candidate.chunkId);
    if (previous) previous.evidenceTurnIds = [...new Set([...previous.evidenceTurnIds, ...candidate.evidenceTurnIds])];
    else merged.set(candidate.chunkId, { ...candidate, evidenceTurnIds: [...candidate.evidenceTurnIds] });
  }
  return [...merged.values()];
}
