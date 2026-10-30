import { ALL_WIDE, COMMONMARK_READER, DEFAULT_READER, S338_MANY, defineRows } from "./support/attr-id-rows";

// Session 338, part A of the BACKLOG item "Eleven more places that throw `RangeError` on a long line or a long list" (group g02): a token of nothing but a letter above U+00FF.
// `ATTR_ID_ALL` (`/#([\p{L}\p{N}_:.-]+)/gu`, read with `token.matchAll(...)` in `headingAttributeId`) and, under `from: commonmark_x`, `ATTR_ATOM_COMMONMARK` (`/^(?:#[\p{L}\p{N}_:.-]+|\.[\p{L}\p{N}_:-]+)$/u`,
// tested in `headingAttributeId` and `headingAttributesValid`) are class-plus patterns under the `u` flag: V8 keeps one backtrack entry per character and twice as large once the TOKEN holds a character above U+00FF,
// so an attribute id of 4,194,288 such letters threw `RangeError: Maximum call stack size exceeded` and the RangeError answered NOTHING for the whole document. `test/unit/support/attr-id-rows.ts` holds the figures
// (bisected at HEAD `fe6aaec`), the sizes, the limit and the rows; this file runs a token of nothing but U+4E2D, for both readers (the astral letter is in `s338-attr-id-rows-astral.test.ts`). Each row asserts the ANSWER of the short document (4 letters) and of the long one, and the long read must finish inside the limit.
defineRows({
  title: "Session 338 part A: one attribute id of 8,400,000 letters, every letter U+4E2D (default reader)",
  reader: DEFAULT_READER,
  keys: ["h-plain", "d-plain"],
  forms: [ALL_WIDE],
  sizes: [S338_MANY],
  rowCount: 2,
});

defineRows({
  title: "Session 338 part A: one attribute id of 8,400,000 letters, every letter U+4E2D (from: commonmark_x)",
  reader: COMMONMARK_READER,
  keys: ["h-plain"],
  forms: [ALL_WIDE],
  sizes: [S338_MANY],
  rowCount: 1,
});

