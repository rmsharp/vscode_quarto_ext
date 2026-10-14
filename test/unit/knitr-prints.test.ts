import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { findHeadings } from "../../src/core/qmd/model";

/** The headings the Outline lists for a knitr document. */
const outline = (lines: readonly string[]): string[] => findHeadings(lines.join("\n"), "knitr").map((h) => h.text);

describe("Session 309 — a chunk that PRINTS with its code not echoed emits TWO bare fences, and pandoc pairs fences strictly in order", () => {
  // MEASURED, quarto 1.7.33 with knitr 1.51, exit 0, real execution (`scratchpad/s309/geo3`, untracked; 256 documents, fixture `test/fixtures/knitr-print-geometry/`).
  // A chunk with `echo=FALSE` whose code prints hands pandoc an OUTPUT block: a bare ``` line, the text, a bare ``` line. A stray bare fence above the document pairs with the
  // FIRST bare fence below it (that block's opener) and swallows every heading between them; the block's own closer then opens a region that pairs with the NEXT printing
  // chunk's opener, and so on, so every heading from the stray fence down to the opener of the LAST printing chunk is swallowed. The chunk's closer after it has nothing to pair with.
  it("a stray fence above three printing chunks swallows every heading down to the last chunk's opener (g_p-p-p_s0)", () => {
    expect(
      outline([
        "---", 'title: "geo"', "---", "", "Intro.", "", "```", "",
        "```{r, echo=FALSE}", 'print("p0")', "```", "", "# H0", "",
        "```{r, echo=FALSE}", 'print("p1")', "```", "", "# H1", "",
        "```{r, echo=FALSE}", 'print("p2")', "```", "", "# H2", "",
      ]),
    ).toEqual(["H2"]);
  });

  // Rows of the same behaviour, PASSING ON ARRIVAL (disclosed: only the row above was written red): every sequence of three chunk kinds over P (a printing chunk, code not
  // echoed), Q (a quiet one), L (echoed, no output) and LP (echoed and printing) with the stray fence at each of four positions, 256 documents rendered with quarto 1.7.33.
  // The answers equal a fence-pairing simulator that was frozen BEFORE any render (256 of 256). HEAD answered 242 of them.
  type Row = [string, string, string[]];
  const rows = (JSON.parse(readFileSync(path.join(__dirname, "../fixtures/knitr-print-geometry/quarto-1.7.33.json"), "utf8")) as { rows: Row[] }).rows;
  it("covers the whole fixture: 256 documents", () => {
    expect(rows).toHaveLength(256);
  });
  it.each(rows.map((r) => [r[0], r] as const))("rendered: %s", (_name, r) => {
    expect(findHeadings(r[1], "knitr").map((h) => h.text)).toEqual(r[2]);
  });
});
