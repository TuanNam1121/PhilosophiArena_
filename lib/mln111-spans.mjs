/** Stable, lossless quote choices. The model selects IDs, never rewrites text. */
export function splitMlnSpans(value, prefix, metadata = {}, targetChars = 460) {
  const text = value.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (!text) return [];
  const sentences = [...new Intl.Segmenter("vi", { granularity: "sentence" }).segment(text)];
  const spans = [];
  let start = null;
  let end = 0;
  const flush = () => {
    if (start === null) return;
    while (start < end && /\s/u.test(text[start])) start++;
    while (end > start && /\s/u.test(text[end - 1])) end--;
    if (end > start) spans.push({ id: `${prefix}~${start}`, text: text.slice(start, end), charStart: start, charEnd: end, ...metadata });
    start = null;
  };
  for (const sentence of sentences) {
    if (start !== null && sentence.index + sentence.segment.length - start > targetChars) flush();
    start ??= sentence.index;
    end = sentence.index + sentence.segment.length;
  }
  flush();
  return spans;
}

export function mlnSourceSpans(chunk) {
  return splitMlnSpans(chunk.text, `p-${chunk.id}`, { chunkId: chunk.id, unitId: chunk.unitId });
}

export function mlnEvidenceSpans(turn) {
  return splitMlnSpans(turn.dialogue, `e-${turn.id}`, { turnId: turn.id, role: turn.role }, 360);
}
