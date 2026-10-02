import OpenAI from "openai";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { buildMlnSearchIndex } from "../lib/mln111-search.mjs";
import { resolveMlnConceptSources } from "../lib/mln111-xray.mjs";
import { runMlnXRay } from "../lib/mln111-xray-service.mjs";
import { XRAY_INSTRUCTIONS, XRAY_ROUTING_INSTRUCTIONS } from "../lib/mln111-xray-contract.mjs";
import { makeEvaluationInput, evaluateXRayCase, evaluationFingerprints } from "./mln111-eval-utils.mjs";

const args = process.argv.slice(2);
const value = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : null;
if (!args.includes("--all") && !value("--case")) throw new Error("Chọn --all hoặc --case <id>. Lệnh này gọi model thật và sử dụng API billing.");
const endpoint = value("--endpoint");
const model = process.env.AI_MODEL ?? "gpt-6-luna";
if (!endpoint && !process.env.OPENAI_API_KEY) throw new Error("Thiếu OPENAI_API_KEY.");
const readJson = async (name) => JSON.parse(await readFile(new URL(`../content/mln111/${name}`, import.meta.url), "utf8"));
const bookIndex = await readJson("book-index.json");
const caseText = await readFile(new URL("../content/mln111/xray-evaluation.json", import.meta.url), "utf8");
const cases = JSON.parse(caseText);
const selected = [...cases.positiveCases, ...cases.negativeCases].filter((sample) => args.includes("--all") || sample.id === value("--case"));
if (!selected.length) throw new Error("Không có case tương ứng.");
const resources = {
  bookIndex, searchIndex: buildMlnSearchIndex(bookIndex),
  concepts: resolveMlnConceptSources(await readJson("concepts.json"), bookIndex),
  unitsById: new Map(bookIndex.units.map((unit) => [unit.id, unit])),
  chunksById: new Map(bookIndex.sections.flatMap((section) => section.chunks.map((chunk) => [chunk.id, { section, chunk }]))),
};
const provider = endpoint ? null : new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 120000, maxRetries: 1 });
const report = {
  schemaVersion: 2,
  evaluatedAt: new Date().toISOString(), model, endpoint: endpoint ?? "shared-production-service",
  sourceSha256: bookIndex.generatedFrom.sha256,
  corpusSha256: createHash("sha256").update(caseText).digest("hex"),
  promptSha256: createHash("sha256").update(XRAY_ROUTING_INSTRUCTIONS + XRAY_INSTRUCTIONS).digest("hex"),
  ...(await evaluationFingerprints()),
  scope: "Frozen source-unit oracles and actual production model output. Literal citations are independently checked by the production guard and source-integrity tests. This sample evaluation is not a guarantee for every future conversation.",
  cases: [],
};
const output = value("--output") ?? "content/mln111/xray-live-evaluation.json";
if (args.includes("--resume")) {
  const previous = await readFile(output, "utf8").then(JSON.parse).catch(() => null);
  if (previous) {
    const keys = ["model", "schemaVersion", "sourceSha256", "bookIndexSha256", "corpusSha256", "promptSha256", "implementationSha256", "catalogSha256", "evaluatorSha256"];
    if (keys.some((key) => previous[key] !== report[key])) throw new Error("Không thể tiếp tục bằng chứng đã cũ; chạy lại không có --resume.");
    report.cases = previous.cases.filter((recorded) => recorded.passed && selected.some((sample) => sample.id === recorded.id));
    report.evaluatedAt = previous.evaluatedAt;
  }
}
async function checkpoint() {
  report.summary = { total: report.cases.length, passed: report.cases.filter((sample) => sample.passed).length, failed: report.cases.filter((sample) => !sample.passed).length, durationMs: report.cases.reduce((sum, sample) => sum + sample.durationMs, 0) };
  report.completed = report.cases.length === selected.length;
  report.lastUpdatedAt = new Date().toISOString();
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

for (const sample of selected) {
  if (report.cases.some((recorded) => recorded.id === sample.id)) continue;
  const caseStart = Date.now();
  const observations = [];
  try {
    const input = makeEvaluationInput(sample);
    let response;
    if (endpoint) {
      const http = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(360000) });
      response = await http.json();
      if (!http.ok) throw new Error(`HTTP ${http.status}: ${response.error ?? "X-Ray request failed"}`);
    } else response = await runMlnXRay(input, resources, { client: provider, model, onResponse: (metadata) => observations.push(metadata) });
    const verdict = evaluateXRayCase(sample, response, bookIndex);
    report.cases.push({ id: sample.id, kind: sample.expectedSources.length ? "positive" : "negative", ...verdict,
      evaluatedAt: new Date().toISOString(), durationMs: Date.now() - caseStart, observations, response });
    console.log(JSON.stringify({ id: sample.id, passed: verdict.passed, matches: response.result.length, errors: verdict.errors, modelCalls: response.diagnostics.modelCalls, durationMs: Date.now() - caseStart }));
  } catch (error) {
    // Never print SDK errors that may echo a credential. The shared service's
    // messages are fixed strings; HTTP responses also contain fixed messages.
    const safeMessage = error?.name === "XRayAnalysisError" || /^HTTP \d+:/u.test(error?.message ?? "") ? error.message : "Evaluation call failed; inspect provider status and local logs.";
    report.cases.push({ id: sample.id, passed: false, errors: [safeMessage], providerStatus: error?.providerStatus ?? null, evaluatedAt: new Date().toISOString(), durationMs: Date.now() - caseStart });
    console.log(JSON.stringify({ id: sample.id, passed: false, error: safeMessage, providerStatus: error?.providerStatus ?? null }));
  }
  await checkpoint();
}
await checkpoint();
console.log(JSON.stringify({ output, ...report.summary }));
if (report.summary.failed) process.exitCode = 1;
