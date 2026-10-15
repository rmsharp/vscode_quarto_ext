import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { findHeadings } from "../../src/core/qmd/model";

// Session 310: the paired renders behind the no-execute reading, pinned. Every document was rendered TWICE by quarto 1.7.33 (knitr 1.51), once normally and once with `quarto render
// --no-execute`, exit 0 both times, identical bytes (`tools/knitr-print-grids/score_modes.py --fixture` writes the file; the renders themselves are untracked scratchpad). The rows are
// [name, document, engine, quarto's headings executing, quarto's headings under --no-execute, this model's no-execute reading when written, this model's DEFAULT reading when written].
// Sources, by set: the Session 307, 308 and 309 grids and blind lenses (`g3ex` to `g6ex`, `g13ex` to `g21ex`, `lens-*`, `rev-*`, round B), the Session 310 held-out lenses (`report`, `defaults`,
// `channels`, `engines`, `layout`: 125 documents written blind, rendered once, first scored 121 right of 125 BEFORE any fix to them, so they are training data from this commit on), and the
// Session 310 reviewers' counterexamples (`soundness`, `critic`).
type Row = [string, string, string | undefined, string[], string[], string[], string[]];
const fixture = JSON.parse(readFileSync(path.join(__dirname, "../fixtures/knitr-print-noexec/quarto-1.7.33.json"), "utf8")) as { rows: Row[] };
const engineOf = (r: Row): "knitr" | "jupyter" | "markdown" | "julia" | "ambiguous" | undefined => r[2] as never;
const hides = (got: string[], truth: string[]): string[] => truth.filter((t) => !got.includes(t));

describe("Session 310 — the paired no-execute fixture", () => {
  it("covers the whole fixture: 707 documents rendered both ways", () => {
    expect(fixture.rows).toHaveLength(707);
  });

  // The default reading is what every caller had before the mode existed: byte-identical to the Session 309 build on all 707 rows when this column was written (checked against a bundle of
  // that commit), and pinned here so a later change to it fails loudly.
  it.each(fixture.rows.map((r) => [r[0], r] as const))("default reading, as written: %s", (_name, r) => {
    expect(findHeadings(r[1], engineOf(r)).map((h) => h.text)).toEqual(r[6]);
  });
  it.each(fixture.rows.map((r) => [r[0], r] as const))("no-execute reading, as written: %s", (_name, r) => {
    expect(findHeadings(r[1], engineOf(r), "no-execute").map((h) => h.text)).toEqual(r[5]);
  });

  // THE INVARIANTS, against quarto's own --no-execute headings: reading for no-execute is never worse than reading for the executing render, row by row, in either direction.
  it("never hides a heading quarto's --no-execute render shows that the default reading showed", () => {
    expect(fixture.rows.filter((r) => hides(r[5], r[4]).length > 0 && hides(r[6], r[4]).length === 0).map((r) => r[0])).toEqual([]);
  });
  it("never gets a row wrong that the default reading got right", () => {
    expect(fixture.rows.filter((r) => r[6].join("\n") === r[4].join("\n") && r[5].join("\n") !== r[4].join("\n")).map((r) => r[0])).toEqual([]);
  });

  // THE RATCHET (only tightened): rows the no-execute reading gets exactly right, and rows where it still hides a heading quarto shows. The default reading's numbers are the contrast.
  it("the no-execute reading is right on at least 668 of 707 rows, and hides a heading in at most 27", () => {
    const right = (col: 5 | 6): number => fixture.rows.filter((r) => r[col].join("\n") === r[4].join("\n")).length;
    const hiding = (col: 5 | 6): number => fixture.rows.filter((r) => hides(r[col], r[4]).length > 0).length;
    expect(right(5)).toBeGreaterThanOrEqual(668);
    expect(hiding(5)).toBeLessThanOrEqual(27);
    expect(right(6)).toBe(376);
    expect(hiding(6)).toBe(178);
  });
});
