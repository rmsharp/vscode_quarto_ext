import { ASTRAL, COMMONMARK_READER, DEFAULT_READER, S338_MANY, defineRows } from "./support/attr-id-rows";

// Session 338, part A of the BACKLOG item "Eleven more places that throw `RangeError` on a long line or a long list" (group g02): the astral letters.
// `ATTR_ID_ALL` (`/#([\p{L}\p{N}_:.-]+)/gu`, read with `token.matchAll(...)` in `headingAttributeId`) and, under `from: commonmark_x`, `ATTR_ATOM_COMMONMARK` (`/^(?:#[\p{L}\p{N}_:.-]+|\.[\p{L}\p{N}_:-]+)$/u`,
// tested in `headingAttributeId` and `headingAttributesValid`) are class-plus patterns under the `u` flag: V8 keeps one backtrack entry per CHARACTER, so a letter of two UTF-16 code units (U+1D400) counts once:
// 4,194,287 such letters read and 4,194,288 throw (Node 22.23, HEAD `fe6aaec`), and the token is 16,800,000 code units at 8,400,000 of them. `test/unit/support/attr-id-rows.ts` holds the figures, the sizes, the limit and
// the rows; this file runs a token of nothing but U+1D400, for both readers, and sits apart from `s338-attr-id-rows-letters.test.ts` (U+4E2D) so that each of the two stays well under the 25 s a test file may take.
defineRows({
  title: "Session 338 part A: one attribute id of 8,400,000 astral letters (default reader)",
  reader: DEFAULT_READER,
  keys: ["h-plain"],
  forms: [ASTRAL],
  sizes: [S338_MANY],
  rowCount: 1,
});

defineRows({
  title: "Session 338 part A: one attribute id of 8,400,000 astral letters (from: commonmark_x)",
  reader: COMMONMARK_READER,
  keys: ["l-plain"],
  forms: [ASTRAL],
  sizes: [S338_MANY],
  rowCount: 1,
});
