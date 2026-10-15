import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { findHeadings } from "../../src/core/qmd/model";

// Session 309: the two read-only REVIEWERS' documents (a precision hunter and a scanner attacker), rendered with quarto 1.7.33 and pinned. They live apart from `knitr-prints.test.ts`
// because they are another kind of evidence: documents an adversary wrote after READING the first cut of the rule, not the measured grids the rule was built from.

describe("Session 309 — the precision reviewer's 48 documents: no deleted heading", () => {
  // `[name, document, quarto's headings, the reviewer's claim]`: see the fixture's `note`. The reviewer READ the first cut of the rule and wrote a document for every hole it could find
  // (40 of 48 deleted a heading): code the document runs that the rule cannot read (a template, `ref.label`, `get(paste0())`, noweb, `knit_child(text=)`), a redefinition the regex
  // misses (`message`, a quoted name, `if (...) cat <- ...`), an option not on any list (`indent`, `R.options`, `opts.label`), front matter the reader does not see (`enabled`, a block
  // after blank lines, an escaped key), a whitespace escape (`\f`, `\v`, octal) and a `comment` option that holds backticks. WRITTEN FIRST, all red: each class below turned its rows green.
  type HostileRow = [string, string, string[], string];
  const hostile = (JSON.parse(readFileSync(path.join(__dirname, "../fixtures/knitr-print-hostile/quarto-1.7.33.json"), "utf8")) as { rows: HostileRow[] }).rows;
  it("covers the whole fixture: 48 documents", () => {
    expect(hostile).toHaveLength(48);
  });
  it.each(hostile.map((r) => [r[0], r] as const))("never hides a heading quarto renders: %s", (_name, r) => {
    const got = findHeadings(r[1], "knitr").map((h) => h.text);
    expect(r[2].filter((t) => !got.includes(t))).toEqual([]);
  });
});

describe("Session 309 — the geometry reviewer's 50 documents: never worse than HEAD", () => {
  // `[name, document, quarto's headings, HEAD's headings, the reviewer's claim]`, see the fixture's `note`. 19 of the 50 delete a heading with the first cut of the rule and 15 did at
  // HEAD: the invariant is that a row never loses a heading that HEAD still listed (the other pre-existing families are pinned below as they are). WRITTEN FIRST, six rows red.
  type GeoRow = [string, string, string[], string[], string];
  const geoRows = (JSON.parse(readFileSync(path.join(__dirname, "../fixtures/knitr-print-geometry-hostile/quarto-1.7.33.json"), "utf8")) as { rows: GeoRow[] }).rows;
  it("covers the whole fixture: 50 documents", () => {
    expect(geoRows).toHaveLength(50);
  });
  it.each(geoRows.map((r) => [r[0], r] as const))("never loses a heading HEAD listed: %s", (_name, r) => {
    const got = findHeadings(r[1], "knitr").map((h) => h.text);
    expect(r[2].filter((t) => r[3].includes(t) && !got.includes(t))).toEqual([]);
  });
});
