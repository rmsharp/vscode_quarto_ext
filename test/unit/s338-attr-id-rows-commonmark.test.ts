import { COMMONMARK_READER, ONE_WIDE, S338_BYTE_MANY, S338_MANY, defineRows, oneByte } from "./support/attr-id-rows";

// Session 338, part A of the BACKLOG item "Eleven more places that throw `RangeError` on a long line or a long list" (group g02): the heading readers under `from: commonmark_x`.
// `ATTR_ID_ALL` (`/#([\p{L}\p{N}_:.-]+)/gu`, read with `token.matchAll(...)` in `headingAttributeId`) and, under `from: commonmark_x`, `ATTR_ATOM_COMMONMARK` (`/^(?:#[\p{L}\p{N}_:.-]+|\.[\p{L}\p{N}_:-]+)$/u`,
// tested in `headingAttributeId` and `headingAttributesValid`) are class-plus patterns under the `u` flag: V8 keeps one backtrack entry per character and twice as large once the TOKEN holds a character above U+00FF,
// so an attribute id of 4,194,288 such letters threw `RangeError: Maximum call stack size exceeded` and the RangeError answered NOTHING for the whole document. `test/unit/support/attr-id-rows.ts` holds the figures
// (bisected at HEAD `fe6aaec`), the sizes, the limit and the rows; this file runs the heading, cell and engine readers under `from: commonmark_x`, where `ATTR_ATOM_COMMONMARK` (site 2) is tested BEFORE `ATTR_ID_ALL` is read, so site 2 hides site 1. Each row asserts the ANSWER of the short document (4 letters) and of the long one, and the long read must finish inside the limit.
// Every row runs in TWO forms: a 1,000,000-letter token of characters up to U+00FF (a control: it reads 60,000,000 letters on the parent too, so it passes there) and an 8,400,000-letter token with one U+4E2D.
defineRows({
  title: "Session 338 part A: one heading attribute id of millions of letters (findHeadings, findAllCells, resolveDocumentEngine; from: commonmark_x)",
  reader: COMMONMARK_READER,
  keys: ["h-plain", "h-knitr", "h-jupyter", "cells", "engine"],
  forms: [oneByte(S338_BYTE_MANY), ONE_WIDE],
  sizes: [S338_BYTE_MANY, S338_MANY],
  rowCount: 5,
});

