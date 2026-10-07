import { createHash } from "node:crypto";

export function normalizeMlnSourceLine(text) {
  return text.trim().replace(/<\/?(?:sup|sub)>/giu, "")
    .replace(/\*\*(.*?)\*\*/gu, "$1").replace(/\*(.*?)\*/gu, "$1")
    .replace(/`([^`]+)`/gu, "$1").replace(/\s+/gu, " ");
}

function label(text) {
  return text.replace(/^(?:[IVXLCDM]+[-.)]|\d+[.)]|[a-zđ][.)])\s*/iu, "").trim();
}

function slug(text) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/giu, "d")
    .toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "").slice(0, 64);
}

function sectionId(chapter, parents, title) {
  const labels = [...parents, title].map((part) => {
    const roman = part.match(/^([IVXLCDM]+)[-.)]/iu);
    if (roman) return roman[1].toLowerCase();
    const numeric = part.match(/^(\d+)[.)]/u);
    if (numeric) return numeric[1];
    const alpha = part.match(/^([a-zđ])[.)]/iu);
    if (alpha) return alpha[1].toLowerCase() === "đ" ? "d-vn" : alpha[1].toLowerCase();
    return slug(part).slice(0, 36);
  });
  return [`ch${chapter}`, ...labels].join("-");
}

// Keep methodology and generic definition headings with their concept.
export function mlnUnitHeading(text) {
  const trimmed = text.trim();
  let title = null;
  if (trimmed.length <= 190 && (/^\*\s+\*{2,3}/u.test(trimmed) || /^\*\*[^*]/u.test(trimmed))) {
    title = trimmed.replace(/^\*\s+/u, "").replace(/\*/gu, "");
  } else {
    const inline = trimmed.match(/^\*\s+\*([^*]+?)(?::\*|\*:)/u);
    if (inline) title = inline[1];
    else if (trimmed.length <= 100 && /^\*[^*]+\*\s*$/u.test(trimmed)) {
      title = trimmed.replace(/\*/gu, "").replace(/^-\s*/u, "");
    } else if (/^\* Vấn đề “[^”]+”$/u.test(trimmed)) title = trimmed.slice(2);
  }
  if (!title) return null;
  title = title.trim().replace(/[:.,]+$/u, "").trim();
  if (!title || /[.!?;]/u.test(title) || /^(?:Ý nghĩa|Định nghĩa$|Khái niệm$|Thứ\s|Các dạng khả năng$|Mối liên hệ giữa khả năng và hiện thực$)/iu.test(title)) return null;
  return title;
}

/** Footer numbers identify the preceding page. All chunks retain exact words. */
export function buildMlnBookIndex(sourceText, fileName, options = {}) {
  const chunkWordLimit = options.chunkWordLimit ?? 240;
  const chunkWordOverlap = options.chunkWordOverlap ?? 48;
  if (chunkWordLimit <= chunkWordOverlap || chunkWordOverlap < 0) throw new Error("Invalid chunk sizes.");
  const lines = sourceText.replace(/^\uFEFF/u, "").split(/\r?\n/u);
  const pageMarkers = lines.flatMap((text, index) => /^\s*\d{1,3}\s*$/u.test(text) ? [{ line: index + 1, page: Number(text.trim()) }] : []);
  if (pageMarkers.some((marker, index) => index > 0 && marker.page <= pageMarkers[index - 1].page)) {
    throw new Error("Số trang footer không tăng; cần kiểm tra bản Markdown nguồn.");
  }
  const pageByLine = new Array(lines.length).fill(null);
  let nextFooter = null;
  for (let index = lines.length - 1; index >= 0; index--) {
    if (/^\s*\d{1,3}\s*$/u.test(lines[index])) nextFooter = Number(lines[index].trim());
    pageByLine[index] = nextFooter;
  }
  const sections = [];
  const units = [];
  const expectedBodyLines = new Set();
  const indexedBodyLines = new Set();
  let inBody = false;
  for (let index = 0; index < lines.length; index++) {
    const text = lines[index].trim();
    if (/^## B\./iu.test(text)) { inBody = true; continue; }
    if (/^## C\./iu.test(text)) { inBody = false; continue; }
    if (inBody && text && !/^#{1,6}\s|^---+$|^\d{1,3}$/u.test(text)) expectedBodyLines.add(index + 1);
  }
  const sourceFor = (tokens, fallbackLine) => ({
    file: fileName, lineStart: tokens[0]?.line ?? fallbackLine, lineEnd: tokens.at(-1)?.line ?? fallbackLine,
    printedPageStart: tokens[0]?.page ?? pageByLine[fallbackLine - 1] ?? null,
    printedPageEnd: tokens.at(-1)?.page ?? pageByLine[fallbackLine - 1] ?? null,
  });

  function saveSection(section, endLine) {
    if (!section) return;
    const rows = section.rows.filter(({ text }) => text.trim() && !/^---+$/u.test(text.trim()));
    const tokens = [];
    const boundaries = [];
    for (const row of rows) {
      indexedBodyLines.add(row.line);
      const heading = mlnUnitHeading(row.text);
      if (heading) boundaries.push({ word: tokens.length, title: heading, line: row.line });
      const normalized = normalizeMlnSourceLine(row.text);
      const rowWords = normalized.split(/\s+/u).filter(Boolean);
      for (const word of rowWords) tokens.push({ word, line: row.line, page: pageByLine[row.line - 1] });
    }
    if (!boundaries.length || boundaries[0].word > 0) boundaries.unshift({ word: 0, title: label(section.title), line: rows[0]?.line ?? section.headingLine, isSection: true });
    const chunks = [];
    const covered = new Uint8Array(tokens.length);
    const usedUnitIds = new Map();
    for (let index = 0; index < boundaries.length; index++) {
      const boundary = boundaries[index];
      const from = boundary.word;
      const until = boundaries[index + 1]?.word ?? tokens.length;
      if (until <= from) continue;
      const baseId = boundary.isSection ? `${section.id}-body` : `${section.id}-u-${slug(boundary.title)}`;
      const occurrence = (usedUnitIds.get(baseId) ?? 0) + 1;
      usedUnitIds.set(baseId, occurrence);
      const unitId = occurrence === 1 ? baseId : `${baseId}-${occurrence}`;
      const unitTokens = tokens.slice(from, until);
      const cleanedHeadingLine = normalizeMlnSourceLine(lines[boundary.line - 1]).replace(/\*/gu, "").replace(/^-\s*/u, "").trim().replace(/[:.,]+$/u, "").trim();
      const supportsMapping = Boolean(boundary.isSection || cleanedHeadingLine !== boundary.title || rows.some((row) => row.line > boundary.line && row.line <= unitTokens.at(-1).line));
      const unit = {
        id: unitId, sectionId: section.id, chapter: section.chapter, title: boundary.title,
        sectionPath: boundary.isSection ? section.path : [...section.path, boundary.title],
        wordStart: from, wordEnd: until, source: sourceFor(unitTokens, boundary.line),
        supportsMapping, chunkIds: [],
      };
      const unitText = unitTokens.map((token) => token.word).join(" ");
      const sentenceRanges = [];
      for (const segment of new Intl.Segmenter("vi", { granularity: "sentence" }).segment(unitText)) {
        const before = unitText.slice(0, segment.index).trim();
        const segmentText = segment.segment.trim();
        const start = before ? before.split(/\s+/u).length : 0;
        const length = segmentText ? segmentText.split(/\s+/u).length : 0;
        if (length) sentenceRanges.push({ start: from + start, end: from + start + length });
      }
      if (sentenceRanges.length && sentenceRanges.at(-1).end < until) {
        sentenceRanges.push({ start: sentenceRanges.at(-1).end, end: until });
      }
      let chunkFrom = from;
      while (chunkFrom < until) {
        const ranges = sentenceRanges.filter((range) => range.start >= chunkFrom && range.end <= until);
        let chunkUntil = chunkFrom;
        let lastRangeIndex = -1;
        for (let rangeIndex = 0; rangeIndex < ranges.length; rangeIndex += 1) {
          const range = ranges[rangeIndex];
          if (chunkUntil > chunkFrom && range.end - chunkFrom > chunkWordLimit) break;
          chunkUntil = range.end;
          lastRangeIndex = rangeIndex;
        }
        if (chunkUntil === chunkFrom) {
          const range = ranges[0] ?? { start: chunkFrom, end: Math.min(until, chunkFrom + chunkWordLimit) };
          chunkUntil = range.end;
          lastRangeIndex = 0;
        }
        const chunkTokens = tokens.slice(chunkFrom, chunkUntil);
        const chunk = {
          id: `${unitId}-${String(unit.chunkIds.length + 1).padStart(2, "0")}`, unitId,
          text: chunkTokens.map((token) => token.word).join(" "), wordStart: chunkFrom, wordEnd: chunkUntil,
          source: sourceFor(chunkTokens, boundary.line),
        };
        if (chunk.text.split(/\s+/u).length !== chunk.wordEnd - chunk.wordStart) throw new Error(`Chunk thiếu từ: ${chunk.id}`);
        for (let word = chunkFrom; word < chunkUntil; word++) covered[word] = 1;
        chunks.push(chunk); unit.chunkIds.push(chunk.id);
        if (chunkUntil === until) break;
        let overlapStart = chunkUntil;
        let overlapWords = 0;
        for (let rangeIndex = lastRangeIndex; rangeIndex >= 0; rangeIndex -= 1) {
          const range = ranges[rangeIndex];
          const length = range.end - range.start;
          if (overlapWords + length > chunkWordOverlap) break;
          overlapStart = range.start;
          overlapWords += length;
        }
        chunkFrom = overlapStart > from ? overlapStart : chunkUntil;
      }
      units.push(unit);
    }
    if (covered.some((word) => word === 0)) throw new Error(`Mất văn bản khi chia chunk: ${section.id}`);
    sections.push({
      id: section.id, chapter: section.chapter, headingLevel: section.level, heading: section.title,
      parentId: section.parentId ?? null, sectionPath: section.path, source: sourceFor(tokens, section.headingLine),
      wordCount: tokens.length, overview: tokens.slice(0, 90).map((token) => token.word).join(" "),
      status: tokens.length ? "indexed" : "heading-only", chunks,
      headingLine: section.headingLine, contentEndLine: endLine,
    });
  }

  let chapter = null;
  let current = null;
  const stack = [];
  inBody = false;
  for (let index = 0; index < lines.length; index++) {
    const text = lines[index];
    const line = index + 1;
    const chapterHeading = text.match(/^# Ch\S*\s+(\d+):\s*(.+)$/u);
    if (chapterHeading) {
      saveSection(current, line - 1); current = null; stack.length = 0;
      chapter = Number(chapterHeading[1]); inBody = false; continue;
    }
    if (!chapter) continue;
    if (/^## B\./iu.test(text)) {
      current = { id: `ch${chapter}-content-intro`, chapter, level: 2, title: "Mở đầu nội dung", path: ["Mở đầu nội dung"], headingLine: line, rows: [] };
      inBody = true; stack.length = 0; continue;
    }
    if (/^## C\./iu.test(text)) {
      saveSection(current, line - 1); current = null; inBody = false; stack.length = 0; continue;
    }
    if (!inBody || /^\s*\d{1,3}\s*$/u.test(text)) continue;
    const heading = text.match(/^(#{3,5})\s+(.+)$/u);
    if (heading) {
      saveSection(current, line - 1);
      const level = heading[1].length;
      while (stack.length && stack.at(-1).level >= level) stack.pop();
      const title = heading[2].trim();
      const parents = stack.map((item) => item.title);
      current = { id: sectionId(chapter, parents, title), chapter, level, title, parentId: stack.at(-1)?.id ?? null, path: [...parents, title], headingLine: line, rows: [] };
      stack.push({ id: current.id, level, title });
    } else if (current) current.rows.push({ line, text });
  }
  saveSection(current, lines.length);
  const missing = [...expectedBodyLines].filter((line) => !indexedBodyLines.has(line));
  const unexpected = [...indexedBodyLines].filter((line) => !expectedBodyLines.has(line));
  const bodyWords = [...expectedBodyLines].reduce((sum, line) => sum + normalizeMlnSourceLine(lines[line - 1]).split(/\s+/u).filter(Boolean).length, 0);
  const indexedWords = sections.reduce((sum, section) => sum + section.wordCount, 0);
  if (missing.length || unexpected.length || bodyWords !== indexedWords) throw new Error(`Chỉ mục không phủ đúng phần B: ${missing.length} dòng thiếu, ${unexpected.length} dòng dư.`);
  if (new Set(sections.map((section) => section.id)).size !== sections.length || new Set(units.map((unit) => unit.id)).size !== units.length) throw new Error("Trùng ID mục/đơn vị nguồn.");
  const chapterStats = [1, 2, 3].map((chapter) => {
    const selected = sections.filter((section) => section.chapter === chapter);
    const chapterUnits = units.filter((unit) => unit.chapter === chapter);
    return {
      chapter, sectionCount: selected.length, indexedSectionCount: selected.filter((section) => section.chunks.length).length,
      unitCount: chapterUnits.length, searchableUnitCount: chapterUnits.filter((unit) => unit.supportsMapping).length,
      chunkCount: selected.reduce((sum, section) => sum + section.chunks.length, 0), wordCount: selected.reduce((sum, section) => sum + section.wordCount, 0),
    };
  });
  if (chapterStats.some((stat) => !stat.chunkCount)) throw new Error("Thiếu nội dung một chương.");
  return {
    schemaVersion: 2,
    generatedFrom: { file: fileName, sha256: createHash("sha256").update(sourceText, "utf8").digest("hex"), lineCount: lines.length },
    segmentation: { strategy: "recursive-sentence", chunkWordLimit, chunkWordOverlap, pageNumbersDerivedFromFooterMarkers: true },
    coverage: { sourceBodyNonEmptyLines: expectedBodyLines.size, unindexedNonEmptyLines: missing.length, sourceBodyWordCount: bodyWords, indexedBodyWordCount: indexedWords },
    pageMarkers, chapterStats, sections, units,
  };
}
