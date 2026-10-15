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

describe("Session 309 — the test critic's rows: guards that nothing pinned, and the --no-execute cost", () => {
  // `rows`: [name, document, quarto's headings, this model's when written, HEAD's]; `cost`: [name, document, quarto's headings executing, quarto's under `--no-execute`, this model's, HEAD's].
  // See the fixture's `note`. Closed-world, and written after the code (disclosed): the critic named which guards a mutant could remove unseen, and every row was rendered first.
  type CriticRow = [string, string, string[], string[], string[]];
  type CostRow = [string, string, string[], string[], string[], string[]];
  const critic = JSON.parse(readFileSync(path.join(__dirname, "../fixtures/knitr-print-critic/quarto-1.7.33.json"), "utf8")) as { rows: CriticRow[]; cost: CostRow[] };
  const modelOf = (document: string): string[] => findHeadings(document, "knitr").map((h) => h.text);

  it("covers the whole fixture: 32 guard documents and 3 cost documents", () => {
    expect(critic.rows).toHaveLength(32);
    expect(critic.cost).toHaveLength(3);
  });

  // The two that DELETE are a setup call this reader cannot read (`do.call(opts_chunk$set, ...)`, a call under an `if`): HEAD's own choice keeps the chunk loud there, so HEAD deletes the
  // same heading. Disclosed in `BACKLOG.md` ("A call this cannot read DROPS the front matter's silence"), not caused by Session 309.
  it("never hides a heading quarto renders, except the two unreadable-setup-call documents that HEAD hides too", () => {
    const hiding = critic.rows.filter((r) => r[2].some((t) => !modelOf(r[1]).includes(t))).map((r) => r[0]);
    expect(hiding).toEqual(["s_u01_do_call_set", "s_u02_if_set"]);
    expect(critic.rows.filter((r) => r[2].some((t) => !r[4].includes(t))).map((r) => r[0])).toEqual(hiding);
  });

  it.each(critic.rows.map((r) => [r[0], r] as const))("pinned: %s", (_name, r) => {
    expect(modelOf(r[1])).toEqual(r[3]);
  });

  // THE COST OF FOLLOWING THE EXECUTING MODE (the operator's decision, Sessions 308 and 309), as documents. Three printing chunks under a hidden-code default and a stray fence above
  // them: a normal render swallows `H0` and `H1`, which the model now says (HEAD listed all three); under `--no-execute` nothing prints, nothing is fenced and quarto lists all three,
  // so the model hides two headings quarto shows. Over 144 blind documents of this shape the cost was 1 document hiding a heading at HEAD and 77 now.
  it.each(critic.cost.map((r) => [r[0], r] as const))("the model follows the EXECUTING render and hides under --no-execute: %s", (_name, r) => {
    expect(r[2]).toEqual(["H2"]);
    expect(r[3]).toEqual(["H0", "H1", "H2"]);
    expect(modelOf(r[1])).toEqual(r[2]);
    expect(r[5]).toEqual(r[3]);
  });
});

describe("Session 309 — the mutation pass's rows: each guard load-bearing", () => {
  // `[name, document, quarto's headings, this model's when written, what the row is about]`, see the fixture's `note`. 47 of 139 mutants of the new code survived the first run, and
  // 46 of those 47 changed no answer on any of 1,600 rendered documents: some were REDUNDANT code (an output-option list the whitelist replaced, a dashed alias, an `endsWith` that
  // `rCallEndsAt` implies, a closer index that adds nothing, all deleted), the rest were shapes no document had. Written after the code (disclosed), every document rendered.
  type MutantRow = [string, string, string[], string[], string];
  const mutants = (JSON.parse(readFileSync(path.join(__dirname, "../fixtures/knitr-print-mutants/quarto-1.7.33.json"), "utf8")) as { rows: MutantRow[] }).rows;
  it("covers the whole fixture: 17 documents", () => {
    expect(mutants).toHaveLength(17);
  });
  // `knit_exit()` (k07) drops the whole document, headings included (quarto lists none): the model still lists three, a phantom.
  it("never hides a heading quarto renders", () => {
    expect(mutants.filter((r) => r[2].some((t) => !findHeadings(r[1], "knitr").map((h) => h.text).includes(t))).map((r) => r[0])).toEqual([]);
  });
  it.each(mutants.map((r) => [r[0], r] as const))("pinned: %s", (_name, r) => {
    expect(findHeadings(r[1], "knitr").map((h) => h.text)).toEqual(r[3]);
  });
});

