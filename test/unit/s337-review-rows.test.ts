import { describe, expect, it } from "vitest";
import { findHeadings, knitrChunkHeaderLabel } from "../../src/core/qmd/model";
import { indexLabels } from "../../src/core/refs";

// Session 337, review round (its mutation lens, 204 new mutants of the eight functions, 156 killed): the four real gaps it found. None of these rows is RED on the parent: they pin ANSWERS the parent
// (`8ebce73`) and the cures give alike, in places the first tests of the session did not look, so each is GREEN there and was shown to FAIL under its mutant (`tools/mutation-run/mutants/s337-review.json`).
//
//  - G1, the call of `commonmarkTagLine` in `computeRegions`: a tag line followed by a blank that is not a space or a tab (a no-break space, a form feed, a vertical tab, a byte order mark, U+2028) is not
//    a type-7 HTML block start, so the heading below it stays. The old pattern ended `[ \t]*$`, and a call that trimmed the line first (`commonmarkTagLine(line.trimEnd())`) read these as tags and swallowed the
//    heading; no earlier row put such a blank after a tag, and the older rows of the type-7 reader had none either.
//  - G2 to G4, the first-slot class of `readChunkLabelToken` (`/^[\p{L}\p{N}_:.-]+$/u`, which the cure of `R_SYMBOL_CHAIN` rewrote the line of but did not change): a bare token in the FIRST slot of a knitr
//    header is the text written, so its colon, its underscore and its start anchor each decide an answer. Dropping the colon or the underscore loses the label of `{r fig-a:b}` or `{r fig-a_b}`; dropping the
//    anchor lets `knitrChunkHeaderLabel` accept `{r fig-a$b}` (only the exported reader shows it: `indexLabels` validates the id again).

const BLANKS: ReadonlyArray<readonly [string, string]> = [
  ["a no-break space", " "],
  ["a form feed", "\f"],
  ["a vertical tab", "\v"],
  ["a byte order mark", "﻿"],
  ["U+2028", " "],
];
const READERS = ["commonmark", "gfm", "commonmark_x"];

describe("Session 337 review round — G1: a type-7 tag line followed by a blank that is not a space or a tab (the call in computeRegions)", () => {
  for (const reader of READERS) {
    for (const [name, blank] of BLANKS) {
      it(`from: ${reader}, \`<a>\` then ${name}: the tag line is no HTML block, so the heading below stands`, () => {
        const text = `---\nfrom: ${reader}\n---\n\n<a>${blank}\n# H\n`;
        expect(findHeadings(text).map((h) => h.text)).toEqual(["H"]);
      });
    }
    it(`from: ${reader}, control: \`<a>\` then a space or a tab IS a tag line, so the heading below is swallowed (the parent's answer)`, () => {
      for (const blank of [" ", "\t"]) {
        const text = `---\nfrom: ${reader}\n---\n\n<a>${blank}\n# H\n`;
        expect(findHeadings(text).map((h) => h.text)).toEqual([]);
      }
    });
  }
});

describe("Session 337 review round — G2 to G4: the first-slot class of a knitr header label", () => {
  const fence = (header: string): string => "```" + header + "\nplot(1)\n```\n";
  it("G2: a colon in a bare first-slot label is part of it: `{r fig-a:b}` defines fig-a:b", () => {
    expect(indexLabels(fence("{r fig-a:b}"), "knitr").map((l) => l.id)).toEqual(["fig-a:b"]);
    expect(knitrChunkHeaderLabel("```{r fig-a:b}")).toEqual({ value: "fig-a:b", column: 6 });
  });
  it("G3: an underscore in a bare first-slot label is part of it: `{r fig-a_b}` and `{r tbl-x_y}`", () => {
    expect(indexLabels(fence("{r fig-a_b}"), "knitr").map((l) => l.id)).toEqual(["fig-a_b"]);
    expect(indexLabels(fence("{r tbl-x_y}"), "knitr").map((l) => l.id)).toEqual(["tbl-x_y"]);
    expect(knitrChunkHeaderLabel("```{r fig-a_b}")).toEqual({ value: "fig-a_b", column: 6 });
  });
  it("G4: the whole token must be of the class, from its first character: `{r fig-a$b}`, `{r $fig-a}`, `{r fig-a b}` and `{r a$b}` read no label", () => {
    for (const header of ["{r fig-a$b}", "{r $fig-a}", "{r fig-a b}", "{r a$b}"]) {
      expect(knitrChunkHeaderLabel("```" + header), header).toBeNull();
      expect(indexLabels(fence(header), "knitr").map((l) => l.id), header).toEqual([]);
    }
  });
});
