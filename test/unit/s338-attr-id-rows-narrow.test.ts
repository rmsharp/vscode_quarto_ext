import { COMMONMARK_READER, DEFAULT_READER, S338_MANY, defineRows, oneByte } from "./support/attr-id-rows";

// Session 338, part A of the BACKLOG item "Eleven more places that throw `RangeError` on a long line or a long list" (group g02): the one-byte form at the full size.
// `ATTR_ID_ALL` (`/#([\p{L}\p{N}_:.-]+)/gu`, read with `token.matchAll(...)` in `headingAttributeId`) and, under `from: commonmark_x`, `ATTR_ATOM_COMMONMARK` (`/^(?:#[\p{L}\p{N}_:.-]+|\.[\p{L}\p{N}_:-]+)$/u`,
// tested in `headingAttributeId` and `headingAttributesValid`) are class-plus patterns under the `u` flag: V8 keeps one backtrack entry per character and twice as large once the TOKEN holds a character above U+00FF,
// so an attribute id of 4,194,288 such letters threw `RangeError: Maximum call stack size exceeded` and the RangeError answered NOTHING for the whole document. `test/unit/support/attr-id-rows.ts` holds the figures
// (bisected at HEAD `fe6aaec`), the sizes, the limit and the rows; this file runs the one-byte form of a heading, a label index and a div at the SAME 8,400,000 letters as the long rows, for both readers. Each row asserts the ANSWER of the short document (4 letters) and of the long one, and the long read must finish inside the limit.
// A token of characters up to U+00FF never threw (60,000,000 letters read at HEAD `fe6aaec`), so every row here is a CONTROL that passes on the parent; the cure must not change it.
defineRows({
  title: "Session 338 part A: one attribute id of 8,400,000 letters up to U+00FF (control; default reader)",
  reader: DEFAULT_READER,
  keys: ["h-plain", "l-plain", "d-plain"],
  forms: [oneByte(S338_MANY)],
  sizes: [S338_MANY],
  rowCount: 3,
});

defineRows({
  title: "Session 338 part A: one attribute id of 8,400,000 letters up to U+00FF (control; from: commonmark_x)",
  reader: COMMONMARK_READER,
  keys: ["h-plain", "l-plain", "d-plain"],
  forms: [oneByte(S338_MANY)],
  sizes: [S338_MANY],
  rowCount: 3,
});

