import { describe, expect, it } from "vitest";
import { attributeIds, findHeadings } from "../../src/core/qmd/model";
import { indexLabels } from "../../src/core/refs";
import { DEFAULT_READER, ONE_WIDE, S338_BYTE_MANY, S338_MANY, defineRows, oneByte } from "./support/attr-id-rows";

// Session 338, part A of the BACKLOG item "Eleven more places that throw `RangeError` on a long line or a long list" (group g02): the heading readers.
// `ATTR_ID_ALL` (`/#([\p{L}\p{N}_:.-]+)/gu`, read with `token.matchAll(...)` in `headingAttributeId`) and, under `from: commonmark_x`, `ATTR_ATOM_COMMONMARK` (`/^(?:#[\p{L}\p{N}_:.-]+|\.[\p{L}\p{N}_:-]+)$/u`,
// tested in `headingAttributeId` and `headingAttributesValid`) are class-plus patterns under the `u` flag: V8 keeps one backtrack entry per character and twice as large once the TOKEN holds a character above U+00FF,
// so an attribute id of 4,194,288 such letters threw `RangeError: Maximum call stack size exceeded` and the RangeError answered NOTHING for the whole document. `test/unit/support/attr-id-rows.ts` holds the figures
// (bisected at HEAD `fe6aaec`), the sizes, the limit and the rows; this file runs the heading, cell and engine readers for the default reader (site 1 alone). Each row asserts the ANSWER of the short document (4 letters) and of the long one, and the long read must finish inside the limit.
// Every row runs in TWO forms: a 1,000,000-letter token of characters up to U+00FF (a control: it reads 60,000,000 letters on the parent too, so it passes there) and an 8,400,000-letter token with one U+4E2D.
defineRows({
  title: "Session 338 part A: one heading attribute id of millions of letters (findHeadings, findAllCells, resolveDocumentEngine; default reader)",
  reader: DEFAULT_READER,
  keys: ["h-plain", "h-knitr", "h-jupyter", "h-setext", "cells", "engine"],
  forms: [oneByte(S338_BYTE_MANY), ONE_WIDE],
  sizes: [S338_BYTE_MANY, S338_MANY],
  rowCount: 6,
});


// A token of MANY short ids, which is not a long id: `headingAttributeId` pushes the ids of `attributeIds` into its list, and `found.push(...attributeIds(token))` would throw `RangeError` from about 110,000 elements (110,038 from that call in a fresh Node 22.23.3 process; an
// array spread puts one stack slot per element). The parent read the ids with `matchAll` and a loop, so the document's answer was the same there; the row is a guard for the cure's own loop, RED under the spread, and on `fe6aaec` it fails on `attributeIds`, which that commit does not export.
describe("Session 338 part A: one heading attribute block of 200,002 ids (the ids are pushed in a loop, not spread)", () => {
  const MANY_IDS = 200_000;
  const SPREAD_LIMIT = 110_000;
  const LIMIT_MS = 3000;

  it("keeps the last id of the block (the pandoc family's) and finds it in the label index", () => {
    const token = `#x${"#a".repeat(MANY_IDS)}#sec-z`;
    expect(attributeIds(token).length).toBe(MANY_IDS + 2);
    expect(attributeIds(token).length).toBeGreaterThan(SPREAD_LIMIT);
    const text = `Intro.\n\n# H {${token}}\n`;
    const started = performance.now();
    expect(findHeadings(text).map((h) => [h.text, h.id, h.line])).toEqual([["H", "sec-z", 2]]);
    expect(indexLabels(text).map((l) => [l.id, l.line])).toEqual([["sec-z", 2]]);
    expect(performance.now() - started).toBeLessThan(LIMIT_MS);
  });

  it("keeps the sizes and the limit this guard is built on", () => {
    expect([MANY_IDS, SPREAD_LIMIT, LIMIT_MS]).toEqual([200_000, 110_000, 3000]);
  });
});
