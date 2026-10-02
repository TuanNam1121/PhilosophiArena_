import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import test from "node:test";
import { buildMlnBookIndex, normalizeMlnSourceLine } from "../lib/mln111-index.mjs";
import { buildMlnSearchIndex, searchMlnSources, searchMlnRoutedSources, createMlnXRayBatches, tokenizeMlnText } from "../lib/mln111-search.mjs";
import { resolveMlnConceptSources, validateAndEnrichXRayMatches, normalizeMlnQuote } from "../lib/mln111-xray.mjs";
import { mlnSourceSpans, mlnEvidenceSpans } from "../lib/mln111-spans.mjs";
import { runMlnXRay, XRayAnalysisError } from "../lib/mln111-xray-service.mjs";
import { XRaySchema, mlnMatchingSchema } from "../lib/mln111-xray-contract.mjs";
import { makeEvaluationInput, expectedUnits, evaluateXRayCase } from "../scripts/mln111-eval-utils.mjs";

const json = async (name) => JSON.parse(await readFile(new URL(`../content/mln111/${name}`, import.meta.url), "utf8"));
const book = await json("book-index.json");
const concepts = resolveMlnConceptSources(await json("concepts.json"), book);
const evaluation = await json("xray-evaluation.json");
const searchIndex = buildMlnSearchIndex(book);
const unitsById = new Map(book.units.map((unit) => [unit.id, unit]));
const chunksById = new Map(book.sections.flatMap((section) => section.chunks.map((chunk) => [chunk.id, { section, chunk }])));
const allSourceSpans = new Map([...chunksById.values()].flatMap(({ chunk }) => mlnSourceSpans(chunk).map((span) => [span.id, span])));
const resources = { bookIndex: book, concepts, searchIndex, unitsById, chunksById };
const sourceName = (await readdir(new URL("../docs/", import.meta.url))).find((name) => name.startsWith("780897357") && name.endsWith(".md"));
const sourceText = await readFile(new URL(`../docs/${sourceName}`, import.meta.url), "utf8");
const sourceLines = sourceText.split(/\r?\n/u);

function unitNamed(sectionId, title) {
  const unit = book.units.find((unit) => unit.sectionId === sectionId && unit.title === title);
  assert.ok(unit, `${sectionId}: ${title}`);
  return unit;
}

function proposal(unit, turn, overrides = {}) {
  const chunk = chunksById.get(unit.chunkIds[0]).chunk;
  return { conceptId: null, sourceSpanIds: [mlnSourceSpans(chunk)[0].id], evidenceSpanIds: [mlnEvidenceSpans(turn)[0].id],
    reasoningPattern: "Phân biệt một quan hệ cụ thể", mapRelation: "được giải thích qua",
    whyItMatches: "Lập luận có chi tiết tương ứng với đoạn được trích.", supportType: "interpretive",
    everydayExample: "Một ví dụ minh họa mới.", ...overrides };
}

function check(matches, turns, candidates = null) {
  const ids = candidates ?? matches.flatMap((match) => match.sourceSpanIds).map((id) => allSourceSpans.get(id)?.chunkId).filter(Boolean);
  return validateAndEnrichXRayMatches({ matches, turns, concepts, unitsById, chunksById, candidateChunkIds: new Set(ids) });
}

const fixture = [
  "# Chương 1: TEST", "## B. NỘI DUNG", "### I- TEST", "#### 1. TEST", "##### a) TEST",
  "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu", "12",
  "nu xi omicron pi rho sigma tau upsilon phi chi psi omega", "13", "## C. CÂU HỎI",
  "# Chương 2: TEST", "## B. NỘI DUNG", "### I- TEST",
  "one two three four five six seven eight nine ten eleven twelve", "14", "## C. CÂU HỎI",
  "# Chương 3: TEST", "## B. NỘI DUNG", "### I- TEST",
  "first second third fourth fifth sixth seventh eighth ninth tenth eleventh twelfth", "15", "## C. CÂU HỎI",
].join("\n");

test("Vietnamese terminology survives tokenization", () => {
  const freedom = tokenizeMlnText("tự do");
  assert.ok(freedom.includes("tu") && freedom.includes("do") && freedom.includes("tu_do"));
  assert.ok(tokenizeMlnText("độ").includes("do"));
  assert.ok(tokenizeMlnText("ý thức").includes("y_thuc"));
  assert.ok(tokenizeMlnText("AI").includes("ai"));
});

test("footer pages and chunk line ranges have independent golden values", () => {
  const built = buildMlnBookIndex(fixture, "fixture.md", { chunkWordLimit: 8, chunkWordOverlap: 2 });
  const section = built.sections.find((section) => section.id === "ch1-i-1-a");
  assert.equal(section.source.printedPageStart, 12);
  assert.equal(section.source.printedPageEnd, 13);
  assert.equal(section.source.lineStart, 6);
  assert.equal(section.source.lineEnd, 8);
  assert.ok(section.chunks.some((chunk) => chunk.source.lineStart === 6 && chunk.source.lineEnd === 8 && chunk.source.printedPageStart === 12 && chunk.source.printedPageEnd === 13));
  assert.equal(section.chunks[0].source.printedPageStart, 12);
});

test("long chunks never lose text behind a character cutoff", () => {
  const words = Array.from({ length: 24 }, (_, index) => `${index}-${"x".repeat(200)}`);
  const built = buildMlnBookIndex(fixture.replace("alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu", words.join(" ")), "fixture.md", { chunkWordLimit: 24, chunkWordOverlap: 4 });
  const chunk = built.sections.find((section) => section.id === "ch1-i-1-a").chunks[0];
  assert.ok(chunk.text.length > 1500);
  assert.equal(chunk.text, words.join(" "));
});

test("quote spans cover every source chunk without rewriting any word", () => {
  for (const { chunk } of chunksById.values()) {
    const spans = mlnSourceSpans(chunk);
    const normalized = normalizeMlnQuote(chunk.text);
    let cursor = 0;
    let recovered = "";
    for (const span of spans) {
      // OCR footnote markers can touch punctuation without a space. Preserve
      // the actual gaps instead of inventing a separator between sentences.
      const gap = normalized.slice(cursor, span.charStart);
      assert.match(gap, /^\s*$/u, chunk.id);
      assert.equal(span.text, normalized.slice(span.charStart, span.charEnd), chunk.id);
      recovered += gap + span.text;
      cursor = span.charEnd;
    }
    assert.match(normalized.slice(cursor), /^\s*$/u, chunk.id);
    assert.equal(recovered + normalized.slice(cursor), normalized, chunk.id);
  }
});

test("matching schema permits null concepts outside the catalog and cannot invent proof text", () => {
  const unit = unitNamed("ch2-ii-2-b", "Nội dung và hình thức");
  const turn = { id: "t", role: "user", dialogue: "Hình thức cũ có thể kìm hãm sự thay đổi của nội dung." };
  const valid = proposal(unit, turn);
  const schema = mlnMatchingSchema([], valid.sourceSpanIds, valid.evidenceSpanIds);
  assert.ok(schema.safeParse({ matches: [valid] }).success);
  assert.equal(schema.safeParse({ matches: [{ ...valid, conceptId: "content-form" }] }).success, false);
  assert.equal(schema.safeParse({ matches: [{ ...valid, sourceQuote: "Một đoạn văn được tự tạo." }] }).success, false);
});

test("every frozen expected and allowed source group resolves to real eligible units", () => {
  const cases = [...evaluation.positiveCases, ...evaluation.negativeCases];
  assert.equal(new Set(cases.map((sample) => sample.id)).size, cases.length);
  for (const sample of cases) {
    assert.ok(sample.question.length >= 8 && sample.question.length <= 600, sample.id);
    assert.ok(sample.turns.every((turn) => turn.dialogue.length <= 1800), sample.id);
    for (const group of [...sample.expectedSources, ...sample.allowedSources]) {
      assert.ok(expectedUnits(book, group).length > 0, sample.id);
    }
  }
});

test("source oracles accept an equivalent passage only with its defining details and require both directions", () => {
  const sample = evaluation.positiveCases.find((sample) => sample.id === "chapter-3-class-conflict");
  const input = makeEvaluationInput(sample);
  const unit = unitsById.get("ch3-ii-1-a-body");
  const chunk = chunksById.get("ch3-ii-1-a-body-10").chunk;
  const spans = mlnSourceSpans(chunk);
  const grounded = spans.find((span) => ["lợi ích cơ bản", "xung đột xã hội", "vị trí"].every((part) => span.text.includes(part)));
  assert.ok(grounded);
  const valid = check([proposal(unit, input.turns[0], { sourceSpanIds: [grounded.id] })], input.turns);
  assert.equal(evaluateXRayCase(sample, { result: valid.matches }, book).passed, true);
  const generic = check([proposal(unit, input.turns[0])], input.turns);
  assert.equal(evaluateXRayCase(sample, { result: generic.matches }, book).passed, false);

  const twoDirections = evaluation.positiveCases.find((sample) => sample.id === "chapter-2-matter-consciousness");
  const matterInput = makeEvaluationInput(twoDirections);
  const reverse = unitNamed("ch2-i-3-b", "Ý thức có tính độc lập tương đối và tác động trở lại vật chất");
  const oneDirection = check([proposal(reverse, matterInput.turns[0])], matterInput.turns);
  assert.equal(evaluateXRayCase(twoDirections, { result: oneDirection.matches }, book).passed, false);
});

test("all textbook chunks reproduce source words and point to actual source lines and footer pages", () => {
  assert.equal(createHash("sha256").update(sourceText).digest("hex"), book.generatedFrom.sha256);
  const markers = sourceLines.flatMap((line, index) => /^\s*\d{1,3}\s*$/u.test(line) ? [{ line: index + 1, page: Number(line.trim()) }] : []);
  const footerPage = (line) => markers.find((marker) => marker.line >= line)?.page ?? null;
  let expectedBody = false;
  const bodyLineIds = new Set();
  sourceLines.forEach((line, index) => {
    if (/^## B\./u.test(line)) { expectedBody = true; return; }
    if (/^## C\./u.test(line)) { expectedBody = false; return; }
    if (expectedBody && line.trim() && !/^#{1,6}\s|^\s*\d{1,3}\s*$|^---+$/u.test(line)) bodyLineIds.add(index + 1);
  });
  const recoveredLineIds = new Set();
  let wordCount = 0;
  for (const section of book.sections) {
    if (!section.chunks.length) continue;
    const tokens = [];
    for (let line = section.source.lineStart; line <= section.contentEndLine; line++) {
      const raw = sourceLines[line - 1];
      if (!raw.trim() || /^\s*\d{1,3}\s*$|^---+$/u.test(raw)) continue;
      recoveredLineIds.add(line);
      for (const word of normalizeMlnSourceLine(raw).split(/\s+/u).filter(Boolean)) tokens.push({ word, line });
    }
    wordCount += tokens.length;
    assert.equal(section.wordCount, tokens.length, section.id);
    const covered = new Uint8Array(tokens.length);
    for (const chunk of section.chunks) {
      const actual = tokens.slice(chunk.wordStart, chunk.wordEnd);
      assert.equal(chunk.text, actual.map((token) => token.word).join(" "), chunk.id);
      assert.equal(chunk.source.lineStart, actual[0].line, chunk.id);
      assert.equal(chunk.source.lineEnd, actual.at(-1).line, chunk.id);
      assert.equal(chunk.source.printedPageStart, footerPage(actual[0].line), chunk.id);
      assert.equal(chunk.source.printedPageEnd, footerPage(actual.at(-1).line), chunk.id);
      for (let index = chunk.wordStart; index < chunk.wordEnd; index++) covered[index] = 1;
    }
    assert.ok([...covered].every(Boolean), section.id);
  }
  assert.deepEqual([...recoveredLineIds].sort((a, b) => a - b), [...bodyLineIds].sort((a, b) => a - b));
  assert.equal(wordCount, book.coverage.sourceBodyWordCount);
  assert.equal(book.coverage.unindexedNonEmptyLines, 0);
});

test("six categories, three laws and seven social-consciousness forms have distinct source units", () => {
  const categories = ["Cái riêng và cái chung", "Nguyên nhân và kết quả", "Tất nhiên và ngẫu nhiên", "Nội dung và hình thức", "Bản chất và hiện tượng", "Khả năng và hiện thực"];
  assert.equal(new Set(categories.map((title) => unitNamed("ch2-ii-2-b", title).id)).size, 6);
  assert.equal(book.units.filter((unit) => unit.sectionId === "ch2-ii-2-c" && unit.title.startsWith("Quy luật ")).length, 3);
  assert.equal(book.units.filter((unit) => unit.sectionId === "ch3-iv-2-d" && unit.title.startsWith("Ý thức ")).length, 7);
});

test("every eligible unit can retrieve its own actual passage", () => {
  for (const unit of book.units.filter((unit) => unit.supportsMapping)) {
    const chunk = chunksById.get(unit.chunkIds[0]).chunk;
    const found = searchMlnSources(searchIndex, { question: "Đối chiếu lập luận.", turns: [{ id: "evidence", role: "thinker", dialogue: chunk.text }] }, concepts);
    assert.ok(found.some((candidate) => candidate.unitId === unit.id), unit.id);
  }
});

test("semantic routing can retrieve passages for every frozen source oracle including concepts outside anchors", () => {
  for (const sample of evaluation.positiveCases) {
    const input = makeEvaluationInput(sample);
    const routes = sample.expectedSources.map((group) => {
      const unit = expectedUnits(book, group)[0];
      return { sourceUnitId: unit.id, evidenceTurnIds: input.turns.filter((turn) => turn.role !== "moderator").map((turn) => turn.id).slice(0, 8), searchQuery: unit.title };
    });
    const routed = searchMlnRoutedSources(searchIndex, routes, input.turns, concepts);
    assert.equal(routed.rejectedRoutes, 0);
    for (const route of routes) assert.ok(routed.candidates.some((candidate) => candidate.unitId === route.sourceUnitId), sample.id);
  }
});

test("independent turn candidates survive 80 subsequent turns and all source batches", () => {
  for (const early of evaluation.positiveCases) {
    const initial = makeEvaluationInput(early);
    const primary = searchMlnSources(searchIndex, initial, concepts, { baseUnits: 0 });
    const otherTurns = evaluation.positiveCases.filter((sample) => sample !== early).flatMap((sample) => sample.turns);
    const turns = [...initial.turns, ...Array.from({ length: 80 }, (_, index) => ({ ...otherTurns[index % otherTurns.length], id: `later-${index}` }))];
    const candidates = searchMlnSources(searchIndex, { question: early.question, turns }, concepts);
    const ids = new Set(candidates.map((candidate) => candidate.unitId));
    for (const candidate of primary) assert.ok(ids.has(candidate.unitId), `${early.id}: ${candidate.unitId}`);
    const batches = createMlnXRayBatches(candidates, turns);
    const batchedChunks = new Set(batches.flatMap((batch) => batch.candidates.map((candidate) => candidate.chunkId)));
    assert.equal(batchedChunks.size, candidates.length);
    assert.ok(batches.every((batch) => batch.candidates.length <= 24));
    assert.ok(batches.some((batch) => batch.turns.some((turn) => turn.id === initial.turns[0].id)));
  }
});

test("different concepts in the same textbook section are both retained with precise chunk citations", () => {
  const content = unitNamed("ch2-ii-2-b", "Nội dung và hình thức");
  const essence = unitNamed("ch2-ii-2-b", "Bản chất và hiện tượng");
  const turns = [{ id: "t1", role: "thinker", dialogue: "Hình thức có thể thúc đẩy hoặc kìm hãm nội dung." }, { id: "t2", role: "user", dialogue: "Không thể suy bản chất chỉ từ biểu hiện bên ngoài." }];
  const result = check([proposal(content, turns[0]), proposal(essence, turns[1])], turns);
  assert.equal(result.matches.length, 2);
  assert.deepEqual(result.matches.map((match) => match.sourceTitle), [content.title, essence.title]);
  assert.equal(result.rejected.length, 0);
  for (const match of result.matches) assert.equal(match.sourceLineStart, chunksById.get(match.sourceChunkId).chunk.source.lineStart);
});

test("quantity-quality cannot cite a contradiction passage from the same broad section", () => {
  const concept = concepts.find((concept) => concept.id === "quantity-quality");
  const wrong = book.units.find((unit) => unit.sectionId === "ch2-ii-2-c" && unit.title.startsWith("Quy luật thống nhất"));
  assert.ok(!concept.sourceUnitIds.includes(wrong.id));
  const turn = { id: "t", role: "thinker", dialogue: "Một sự tích lũy vượt ngưỡng có thể làm thay đổi về chất." };
  const result = check([proposal(wrong, turn, { conceptId: concept.id })], [turn]);
  assert.deepEqual(result.rejectionReasons, { concept_source_mismatch: 1 });
  assert.equal(result.matches.length, 0);
});

test("invalid proof IDs and moderator evidence reject the whole proposal", () => {
  const unit = unitNamed("ch2-ii-2-b", "Nguyên nhân và kết quả");
  const turn = { id: "t", role: "thinker", dialogue: "Hai sự kiện nối tiếp chưa chứng minh quan hệ nhân quả." };
  const moderator = { id: "m", role: "moderator", dialogue: "Cần làm rõ câu hỏi ban đầu trước khi mở thảo luận." };
  const valid = proposal(unit, turn);
  const result = check([
    { ...valid, evidenceSpanIds: [...valid.evidenceSpanIds, "missing"] },
    { ...valid, evidenceSpanIds: [mlnEvidenceSpans(moderator)[0].id] },
    { ...valid, sourceSpanIds: [...valid.sourceSpanIds, "p-unknown~0"] },
  ], [turn, moderator]);
  assert.equal(result.matches.length, 0);
  assert.deepEqual(result.rejectionReasons, { invalid_evidence_id: 2, source_not_retrieved: 1 });
});

test("duplicate proposals are counted separately from invalid references", () => {
  const unit = unitNamed("ch2-ii-2-b", "Nguyên nhân và kết quả");
  const turn = { id: "t", role: "thinker", dialogue: "Cần tìm tương tác tạo ra biến đổi cụ thể." };
  const valid = proposal(unit, turn);
  const result = check([valid, { ...valid, reasoningPattern: "Một cách diễn đạt khác của cùng lập luận" }], [turn]);
  assert.equal(result.matches.length, 1);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.rejected.length, 0);
});

function fakeProvider(handler) {
  const calls = [];
  return { model: "fake-test-model", calls, client: { responses: { parse: async (request) => {
    calls.push(request);
    const parsed = handler ? await handler(request) : request.text.format.name === "arena_xray_routes" ? { routes: [] } : { matches: [] };
    return { status: "completed", output_parsed: parsed };
  } } } };
}

test("moderator-only sessions explicitly report insufficient dialogue without a model call", async () => {
  const provider = fakeProvider();
  const response = await runMlnXRay({ question: "Câu hỏi mở để thảo luận.", turns: [{ id: "m", role: "moderator", dialogue: "Hãy phân biệt các nghĩa của câu hỏi." }] }, resources, provider);
  assert.equal(response.analysisState, "insufficient-dialogue");
  assert.equal(provider.calls.length, 0);
});

test("retrieved candidates are not automatically turned into matches", async () => {
  const provider = fakeProvider();
  const input = makeEvaluationInput(evaluation.negativeCases[0]);
  const response = await runMlnXRay(input, resources, provider);
  assert.ok(response.diagnostics.candidatePassages > 0);
  assert.equal(response.analysisState, "no-supported-match");
  assert.deepEqual(response.result, []);
  const directory = JSON.parse(provider.calls[0].input).sourceDirectory;
  assert.equal(directory.length, book.units.filter((unit) => unit.supportsMapping).length);
});

test("no source candidates and structurally invalid proposals have different states", async () => {
  const noSource = await runMlnXRay({ question: "qzxyvbnmlk", turns: [{ id: "t", role: "user", dialogue: "qzxyvbnmlk qzxyvbnmlk" }] }, resources, fakeProvider());
  assert.equal(noSource.analysisState, "no-source-candidates");
  const input = makeEvaluationInput(evaluation.positiveCases.find((sample) => sample.id === "chapter-2-quantity-quality"));
  const wrong = book.units.find((unit) => unit.sectionId === "ch2-ii-2-c" && unit.title.startsWith("Quy luật thống nhất"));
  const provider = fakeProvider((request) => {
    if (request.text.format.name === "arena_xray_routes") return { routes: [{ sourceUnitId: wrong.id, evidenceTurnIds: [input.turns[0].id], searchQuery: wrong.title }] };
    const context = JSON.parse(request.input);
    const selected = context.sourcePassages.find((passage) => passage.sourceUnitId === wrong.id);
    return { matches: selected ? [{ ...proposal(wrong, input.turns[0], { conceptId: "quantity-quality" }), sourceSpanIds: [selected.spans[0].id] }] : [] };
  });
  const invalid = await runMlnXRay(input, resources, provider);
  assert.equal(invalid.analysisState, "invalid-proposals");
  assert.equal(invalid.diagnostics.rejectionReasons.concept_source_mismatch, 1);
});

test("semantic routing supplements lexical retrieval and production checks actual source/evidence quotations", async () => {
  const sample = evaluation.positiveCases.find((sample) => sample.id === "worldview-outside-anchors");
  const input = makeEvaluationInput(sample);
  const unit = expectedUnits(book, sample.expectedSources[0])[0];
  const provider = fakeProvider((request) => {
    if (request.text.format.name === "arena_xray_routes") return { routes: [{ sourceUnitId: unit.id, evidenceTurnIds: [input.turns[0].id], searchQuery: unit.title }] };
    const context = JSON.parse(request.input);
    const selected = context.sourcePassages.find((passage) => passage.sourceUnitId === unit.id);
    if (!selected) return { matches: [] };
    return { matches: [{ ...proposal(unit, input.turns[0]), sourceSpanIds: [selected.spans[0].id] }] };
  });
  const response = await runMlnXRay(input, resources, provider);
  assert.equal(response.analysisState, "matched");
  assert.ok(response.result.some((match) => match.sourceUnitId === unit.id));
  assert.equal(response.diagnostics.rejectedMatches, 0);
  assert.equal(response.diagnostics.candidateChapters.length > 0, true);
  assert.ok(provider.calls.slice(1).every((call) => JSON.parse(call.input).sourcePassages.length <= 24));
});

test("model refusals/incomplete outputs are errors, never successful empty results", async () => {
  const input = makeEvaluationInput(evaluation.positiveCases[0]);
  const client = { responses: { parse: async () => ({ status: "incomplete", output_parsed: null }) } };
  await assert.rejects(runMlnXRay(input, resources, { model: "fake", client }), XRayAnalysisError);
});

test("a later model-batch failure cannot be reported as a complete partial result", async () => {
  const input = makeEvaluationInput(evaluation.positiveCases[0]);
  let matchCalls = 0;
  const provider = fakeProvider((request) => {
    if (request.text.format.name === "arena_xray_routes") return { routes: book.units.filter((unit) => unit.supportsMapping).slice(0, 32).map((unit) => ({ sourceUnitId: unit.id, evidenceTurnIds: [input.turns[0].id], searchQuery: unit.title })) };
    matchCalls++;
    if (matchCalls === 2) throw new Error("Simulated provider interruption");
    const context = JSON.parse(request.input);
    const selected = context.sourcePassages[0];
    const unit = unitsById.get(selected.sourceUnitId);
    return { matches: [{ ...proposal(unit, input.turns[0]), sourceSpanIds: [selected.spans[0].id] }] };
  });
  await assert.rejects(runMlnXRay(input, resources, provider), XRayAnalysisError);
  assert.equal(matchCalls, 2);
});

test("the structured contract supports more than eight separately grounded matches", () => {
  const unit = unitNamed("ch2-ii-2-b", "Nguyên nhân và kết quả");
  const turn = { id: "t", role: "user", dialogue: "Những điều kiện nào đã tạo ra kết quả này?" };
  assert.ok(XRaySchema.safeParse({ matches: Array.from({ length: 12 }, (_, index) => proposal(unit, turn, { reasoningPattern: `Lập luận ${index}` })) }).success);
});
