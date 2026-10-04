import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { evaluationFingerprints, evaluateXRayCase } from "./mln111-eval-utils.mjs";
import { XRAY_INSTRUCTIONS, XRAY_ROUTING_INSTRUCTIONS } from "../lib/mln111-xray-contract.mjs";

const read = (file) => readFile(new URL(`../content/mln111/${file}`, import.meta.url), "utf8");
const report = JSON.parse(await read("xray-live-evaluation.json"));
const book = JSON.parse(await read("book-index.json"));
const corpusText = await read("xray-evaluation.json");
const corpus = JSON.parse(corpusText);
const fingerprint = await evaluationFingerprints();
if (report.schemaVersion !== 2 || !report.completed || report.summary.failed) throw new Error("Đánh giá live chưa hoàn thành hoặc có ca chưa đạt.");
for (const [key, value] of Object.entries(fingerprint)) if (report[key] !== value) throw new Error(`Bằng chứng live đã cũ: ${key}`);
if (report.sourceSha256 !== book.generatedFrom.sha256 || report.corpusSha256 !== createHash("sha256").update(corpusText).digest("hex") || report.promptSha256 !== createHash("sha256").update(XRAY_ROUTING_INSTRUCTIONS + XRAY_INSTRUCTIONS).digest("hex")) throw new Error("Nguồn, corpus hoặc prompt đã thay đổi sau khi đánh giá.");
const cases = [...corpus.positiveCases, ...corpus.negativeCases];
if (cases.length !== report.cases.length || new Set(report.cases.map((sample) => sample.id)).size !== cases.length) throw new Error("Bằng chứng live không chứa đủ corpus.");
for (const sample of cases) {
  const recorded = report.cases.find((recorded) => recorded.id === sample.id);
  if (!recorded?.response || !evaluateXRayCase(sample, recorded.response, book).passed) throw new Error(`Ca live chưa đạt: ${sample.id}`);
}
console.log(JSON.stringify({ model: report.model, cases: cases.length, passed: report.summary.passed, evaluatedAt: report.evaluatedAt, fresh: true }));
