import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMlnBookIndex } from "../lib/mln111-index.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const names = (await readdir(path.join(projectRoot, "docs")))
  .filter((name) => name.startsWith("780897357-SACH-Giao-trinh") && name.endsWith(".md"));
if (names.length !== 1) throw new Error("Cần đúng một file giáo trình nguồn trong docs/.");
const index = buildMlnBookIndex(await readFile(path.join(projectRoot, "docs", names[0]), "utf8"), names[0]);
const outputPath = path.join(projectRoot, "content", "mln111", "book-index.json");
const serialized = `${JSON.stringify(index, null, 2)}\n`;
const existing = await readFile(outputPath, "utf8").catch(() => null);
if (process.argv.includes("--check")) {
  if (existing !== serialized) throw new Error("book-index.json đã cũ; chạy npm run index:mln111.");
} else if (existing !== serialized) await writeFile(outputPath, serialized, "utf8");
console.log(JSON.stringify({ output: path.relative(projectRoot, outputPath), sourceSha256: index.generatedFrom.sha256,
  sections: index.sections.length, units: index.units.length,
  searchableUnits: index.units.filter((unit) => unit.supportsMapping).length,
  chunks: index.sections.reduce((sum, section) => sum + section.chunks.length, 0),
  coverage: index.coverage, chapterStats: index.chapterStats }, null, 2));
