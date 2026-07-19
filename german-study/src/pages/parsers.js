export function parseGermanStudyText(text) {
  const headerRe = /^(\d+)\.\s*(.+?)\s*[–—-]\s*(.+)$/;   // 1. Ich – I
  const numRe = /^(\d+)\.\s*(.+)$/;                     // 1. Ich mag dich.

  const lines = (text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trimEnd());

  // Helpers
  const isBlank = (s) => !s || !s.trim();
  const isHeader = (s) => headerRe.test(s.trim());
  const isNumbered = (s) => numRe.test(s.trim());

  const blocks = [];
  let cur = [];

  // split into blocks by blank lines (keeps both formats workable)
  for (const line of lines) {
    if (isBlank(line)) {
      if (cur.length) blocks.push(cur);
      cur = [];
    } else {
      cur.push(line.trim());
    }
  }
  if (cur.length) blocks.push(cur);

  const items = [];

  for (const b of blocks) {
    if (!b.length) continue;

    const first = b[0].trim();

    // -------- Format A: "1. Word – Meaning" + pairs --------
    const hm = first.match(headerRe);
    if (hm) {
      const num = hm[1];
      const word = hm[2];
      const meaning = hm[3];

      const examples = [];
      const rest = b.slice(1).filter((x) => x.trim() !== "");
      // Pair sequentially: DE then EN
      for (let i = 0; i < rest.length; ) {
        const de = rest[i] ?? "";
        const en = rest[i + 1] ?? "";
        // if last line has no pair, still keep it with empty EN
        examples.push({ de: de.trim(), en: en.trim() });
        i += 2;
      }

      items.push({ num, word, meaning, examples });
      continue;
    }

    // -------- Format B: numbered DE/EN pairs --------
    // Each block should look like:
    // 1. DE
    // EN
    // (optional more EN lines) OR (optional more DE/EN pairs)
    //
    // We'll parse as:
    // - If a line starts with N. => DE line
    // - Following lines until next N. are EN lines (join them)
    let i = 0;
    while (i < b.length) {
      const line = b[i].trim();
      const nm = line.match(numRe);
      if (!nm) {
        // not numbered: skip (robustness)
        i++;
        continue;
      }

      const num = nm[1];
      const de = nm[2].trim();

      i++;

      // Collect EN lines until next numbered line
      const enLines = [];
      while (i < b.length && !isNumbered(b[i].trim())) {
        if (!isBlank(b[i])) enLines.push(b[i].trim());
        i++;
      }

      const en = enLines.join(" ").trim();

      // Represent as a "word item" where word=DE and meaning=EN,
      // and also provide examples with the same DE/EN.
      items.push({
        num,
        word: de,
        meaning: en,
        examples: [{ de, en }],
      });
    }
  }

  // Final cleanup: remove empty items
  return items.filter((it) => it.word && it.word.trim());
}