import "server-only";
import bookIndexData from "@/content/mln111/book-index.json";
import { z } from "zod";
import { buildMlnSearchIndex } from "@/lib/mln111-search.mjs";

const SourceSchema = z.object({
  file: z.string().min(1),
  lineStart: z.number().int().positive(),
  lineEnd: z.number().int().positive(),
  printedPageStart: z.number().int().positive().nullable(),
  printedPageEnd: z.number().int().positive().nullable(),
});

const BookChunkSchema = z.object({
  id: z.string().min(1),
  unitId: z.string().min(1),
  text: z.string().min(1),
  wordStart: z.number().int().nonnegative(),
  wordEnd: z.number().int().positive(),
  source: SourceSchema,
});

const BookSectionSchema = z.object({
  id: z.string().min(1),
  chapter: z.number().int().min(1).max(3),
  headingLevel: z.number().int().min(2).max(5),
  heading: z.string().min(1),
  parentId: z.string().nullable(),
  sectionPath: z.array(z.string().min(1)).min(1),
  source: SourceSchema,
  wordCount: z.number().int().nonnegative(),
  overview: z.string(),
  status: z.enum(["indexed", "heading-only"]),
  chunks: z.array(BookChunkSchema),
  headingLine: z.number().int().positive(),
  contentEndLine: z.number().int().positive(),
});

const BookUnitSchema = z.object({
  id: z.string().min(1),
  sectionId: z.string().min(1),
  chapter: z.number().int().min(1).max(3),
  title: z.string().min(1),
  sectionPath: z.array(z.string()).min(1),
  wordStart: z.number().int().nonnegative(),
  wordEnd: z.number().int().positive(),
  source: SourceSchema,
  supportsMapping: z.boolean(),
  chunkIds: z.array(z.string()).min(1),
});

const BookIndexSchema = z.object({
  schemaVersion: z.literal(2),
  generatedFrom: z.object({
    file: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    lineCount: z.number().int().positive(),
  }),
  segmentation: z.object({
    chunkWordLimit: z.number().int().positive(),
    chunkWordOverlap: z.number().int().nonnegative(),
    pageNumbersDerivedFromFooterMarkers: z.literal(true),
  }),
  coverage: z.object({
    sourceBodyNonEmptyLines: z.number().int().nonnegative(),
    unindexedNonEmptyLines: z.number().int().nonnegative(),
    sourceBodyWordCount: z.number().int().nonnegative(),
    indexedBodyWordCount: z.number().int().nonnegative(),
  }),
  chapterStats: z.array(z.object({
    chapter: z.number().int().min(1).max(3),
    sectionCount: z.number().int().nonnegative(),
    indexedSectionCount: z.number().int().nonnegative(),
    unitCount: z.number().int().nonnegative(),
    searchableUnitCount: z.number().int().nonnegative(),
    chunkCount: z.number().int().nonnegative(),
    wordCount: z.number().int().nonnegative(),
  })).length(3),
  sections: z.array(BookSectionSchema).min(3),
  units: z.array(BookUnitSchema).min(3),
  pageMarkers: z.array(z.object({ line: z.number().int().positive(), page: z.number().int().positive() })).min(1),
});

export type BookChunk = z.infer<typeof BookChunkSchema>;
export type BookSection = z.infer<typeof BookSectionSchema>;
export type BookUnit = z.infer<typeof BookUnitSchema>;
export type BookIndex = z.infer<typeof BookIndexSchema>;

function validateBookIndex(index: BookIndex) {
  if (
    index.coverage.unindexedNonEmptyLines !== 0 ||
    index.coverage.sourceBodyWordCount !== index.coverage.indexedBodyWordCount
  ) {
    throw new Error("Chỉ mục MLN111 bị thiếu dòng hoặc từ trong phần nội dung giáo trình.");
  }

  const sectionIds = new Set<string>();
  const chunkIds = new Set<string>();
  const wordCountByChapter = new Map<number, number>();
  const unitsById = new Map(index.units.map((unit) => [unit.id, unit]));
  if (unitsById.size !== index.units.length) throw new Error("ID đơn vị nguồn bị trùng.");

  for (const section of index.sections) {
    if (sectionIds.has(section.id)) throw new Error(`ID mục nguồn bị trùng: ${section.id}`);
    sectionIds.add(section.id);
    wordCountByChapter.set(
      section.chapter,
      (wordCountByChapter.get(section.chapter) ?? 0) + section.wordCount,
    );

    if ((section.status === "indexed") !== (section.chunks.length > 0)) {
      throw new Error(`Trạng thái/chunks không khớp tại mục ${section.id}.`);
    }
    const recoveredWords: Array<string | undefined> = new Array(section.wordCount);
    for (const chunk of section.chunks) {
      const unit = unitsById.get(chunk.unitId);
      const words = chunk.text.split(/\s+/u);
      if (!unit || unit.sectionId !== section.id || !unit.chunkIds.includes(chunk.id)) throw new Error(`Đơn vị/chunk không khớp: ${chunk.id}`);
      if (chunk.wordStart < unit.wordStart || chunk.wordEnd > unit.wordEnd || chunk.wordEnd > section.wordCount || words.length !== chunk.wordEnd - chunk.wordStart) throw new Error(`Chunk thiếu từ hoặc vượt mục: ${chunk.id}`);
      if (chunk.source.lineStart > chunk.source.lineEnd || chunk.source.printedPageStart === null || chunk.source.printedPageEnd === null || chunk.source.printedPageStart > chunk.source.printedPageEnd) throw new Error(`Vị trí nguồn không hợp lệ: ${chunk.id}`);
      words.forEach((word, offset) => {
        const position = chunk.wordStart + offset;
        if (recoveredWords[position] !== undefined && recoveredWords[position] !== word) throw new Error(`Văn bản overlap không khớp: ${chunk.id}`);
        recoveredWords[position] = word;
      });
    }
    if (Array.from(recoveredWords).some((word) => word === undefined)) throw new Error(`Có từ chưa được lập chỉ mục ở ${section.id}.`);
  }

  for (const section of index.sections) {
    if (section.parentId && !sectionIds.has(section.parentId)) {
      throw new Error(`Mục ${section.id} trỏ tới parent không tồn tại: ${section.parentId}`);
    }
    for (const chunk of section.chunks) {
      if (chunkIds.has(chunk.id)) throw new Error(`ID chunk nguồn bị trùng: ${chunk.id}`);
      chunkIds.add(chunk.id);
    }
  }

  for (const chapterStat of index.chapterStats) {
    if (wordCountByChapter.get(chapterStat.chapter) !== chapterStat.wordCount) {
      throw new Error(`Word count theo chương không khớp ở Chương ${chapterStat.chapter}.`);
    }
  }
  for (const unit of index.units) {
    if (!sectionIds.has(unit.sectionId) || unit.chunkIds.some((id) => !chunkIds.has(id))) throw new Error(`Đơn vị nguồn bị mất mục/chunk: ${unit.id}`);
  }
}

export const MLN_BOOK_INDEX = BookIndexSchema.parse(bookIndexData);
validateBookIndex(MLN_BOOK_INDEX);

export const MLN_BOOK_SECTIONS_BY_ID = new Map(
  MLN_BOOK_INDEX.sections.map((section) => [section.id, section]),
);

export const MLN_BOOK_CHUNKS_BY_ID = new Map(
  MLN_BOOK_INDEX.sections.flatMap((section) =>
    section.chunks.map((chunk) => [chunk.id, { section, chunk }] as const),
  ),
);

export const MLN_BOOK_UNITS_BY_ID = new Map(MLN_BOOK_INDEX.units.map((unit) => [unit.id, unit]));

export const MLN_BOOK_SEARCH_INDEX = buildMlnSearchIndex(MLN_BOOK_INDEX);
