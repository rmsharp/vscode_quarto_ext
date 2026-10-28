import { describe, expect, it } from "vitest";
import { findHeadings } from "../../src/core/qmd/model";

// Session 332 — the setext title's paragraph-interrupt scan, read through the PUBLIC door. Under a `from: gfm`, `commonmark` or `commonmark_x` reader the title of an underline is the whole open paragraph, unless a line of it
// below its first interrupts the paragraph; `computeRegions` asks that only where the line can underline, and through a scan that keeps its place (`ParagraphInterruptScan`). `paragraph-interrupt-equivalence.test.ts` holds the
// scan against the old expression; these rows hold the WIRING: which question is asked, of which lines, under which columns, and that a line that cannot underline asks nothing. The answers are the PARENT's (the `src` of
// `8e03d50`, which Session 332's claim and RED commits left untouched, bundled and run on each document: taken by running it, not by reasoning), so a row that passes says the cure answers what the parent answered;
// `pathological-inputs.test.ts` holds the clocks. Each document is the body below a front matter that selects the reader, and the line numbers count that front matter (3 lines).
const FRONT = (reader: string): string => `---\nfrom: ${reader}\n---\n`;
const READERS = ["gfm", "commonmark", "commonmark_x"] as const;
type Answer = Array<[number, string, number]>;
type Case = { site: string; body: string[]; answers: Record<(typeof READERS)[number], Answer> };

const CASES: Case[] = [
  { site: "a two-line title, `===`", body: ["x","y","==="], answers: { gfm: [[1,"x y",3]], commonmark: [[1,"x y",3]], commonmark_x: [[1,"x y",3]] } },
  { site: "a two-line title, `---`", body: ["x","y","---"], answers: { gfm: [[2,"x y",3]], commonmark: [[2,"x y",3]], commonmark_x: [[2,"x y",3]] } },
  { site: "a six-line title", body: ["a","b","c","d","e","f","==="], answers: { gfm: [[1,"a b c d e f",3]], commonmark: [[1,"a b c d e f",3]], commonmark_x: [[1,"a b c d e f",3]] } },
  { site: "ATX heading in the middle of the paragraph", body: ["x","# H","y","==="], answers: { gfm: [[1,"H",4],[1,"y",5]], commonmark: [[1,"H",4],[1,"y",5]], commonmark_x: [[1,"H",4],[1,"y",5]] } },
  { site: "backtick fence in the middle of the paragraph", body: ["x","```","y","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "tilde fence in the middle of the paragraph", body: ["x","~~~","y","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "block quote in the middle of the paragraph", body: ["x","> q","y","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "thematic break in the middle of the paragraph", body: ["x","***","y","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "dash bullet in the middle of the paragraph", body: ["x","- b","y","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "star bullet in the middle of the paragraph", body: ["x","* b","y","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "plus bullet in the middle of the paragraph", body: ["x","+ b","y","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "ordered 1. in the middle of the paragraph", body: ["x","1. one","y","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "paren 1 in the middle of the paragraph", body: ["x","(1) one","y","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "div with attribute in the middle of the paragraph", body: ["x","::: {.a}","y","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "inline HTML in the middle of the paragraph", body: ["x","<span>a</span>","y","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "PHP opener in the middle of the paragraph", body: ["x","<?php","y","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "footnote definition in the middle of the paragraph", body: ["x","[^1]: n","y","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "ATX without a space in the middle of the paragraph (does not interrupt)", body: ["x","#x","y","==="], answers: { gfm: [[1,"x #x y",3]], commonmark: [[1,"x #x y",3]], commonmark_x: [[1,"x #x y",3]] } },
  { site: "ordered 2. in the middle of the paragraph (does not interrupt)", body: ["x","2. two","y","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "table row in the middle of the paragraph (does not interrupt)", body: ["x","| a | b |","y","==="], answers: { gfm: [[1,"x | a | b | y",3]], commonmark: [[1,"x | a | b | y",3]], commonmark_x: [[1,"x | a | b | y",3]] } },
  { site: "bare dash in the middle of the paragraph (does not interrupt)", body: ["x","-","y","==="], answers: { gfm: [[2,"x",3]], commonmark: [[2,"x",3]], commonmark_x: [[2,"x",3]] } },
  { site: "ordered without a space in the middle of the paragraph (does not interrupt)", body: ["x","1.x","y","==="], answers: { gfm: [[1,"x 1.x y",3]], commonmark: [[1,"x 1.x y",3]], commonmark_x: [[1,"x 1.x y",3]] } },
  { site: "indented continuation in the middle of the paragraph (does not interrupt)", body: ["x","  cont","y","==="], answers: { gfm: [[1,"x cont y",3]], commonmark: [[1,"x cont y",3]], commonmark_x: [[1,"x cont y",3]] } },
  { site: "code-depth line in the middle of the paragraph (does not interrupt)", body: ["x","    code","y","==="], answers: { gfm: [[1,"x code y",3]], commonmark: [[1,"x code y",3]], commonmark_x: [[1,"x code y",3]] } },
  { site: "bullet as the FIRST line of the paragraph", body: ["- b","x","y","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "bullet as the LAST line before the underline", body: ["x","y","- b","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "ordered 1. as the FIRST line of the paragraph", body: ["1. one","x","y","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "ordered 1. as the LAST line before the underline", body: ["x","y","1. one","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "block quote as the FIRST line of the paragraph", body: ["> q","x","y","==="], answers: { gfm: [[1,"> q x y",3]], commonmark: [[1,"> q x y",3]], commonmark_x: [[1,"> q x y",3]] } },
  { site: "block quote as the LAST line before the underline", body: ["x","y","> q","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "inline HTML as the FIRST line of the paragraph", body: ["<span>a</span>","x","y","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "inline HTML as the LAST line before the underline", body: ["x","y","<span>a</span>","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "the underline `===` after 1 spaces", body: ["x","y"," ==="], answers: { gfm: [[1,"x y",3]], commonmark: [[1,"x y",3]], commonmark_x: [[1,"x y",3]] } },
  { site: "the underline `---` after 1 spaces", body: ["x","y"," ---"], answers: { gfm: [[2,"x y",3]], commonmark: [[2,"x y",3]], commonmark_x: [[2,"x y",3]] } },
  { site: "the underline `===` after 2 spaces", body: ["x","y","  ==="], answers: { gfm: [[1,"x y",3]], commonmark: [[1,"x y",3]], commonmark_x: [[1,"x y",3]] } },
  { site: "the underline `---` after 2 spaces", body: ["x","y","  ---"], answers: { gfm: [[2,"x y",3]], commonmark: [[2,"x y",3]], commonmark_x: [[2,"x y",3]] } },
  { site: "the underline `===` after 3 spaces", body: ["x","y","   ==="], answers: { gfm: [[1,"x y",3]], commonmark: [[1,"x y",3]], commonmark_x: [[1,"x y",3]] } },
  { site: "the underline `---` after 3 spaces", body: ["x","y","   ---"], answers: { gfm: [[2,"x y",3]], commonmark: [[2,"x y",3]], commonmark_x: [[2,"x y",3]] } },
  { site: "the underline `===` after 4 spaces", body: ["x","y","    ==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "the underline `---` after 4 spaces", body: ["x","y","    ---"], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "a tab before the underline", body: ["x","y","\t==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "an indented bullet at code depth at top level", body: ["x","    - b","y","==="], answers: { gfm: [[1,"x - b y",3]], commonmark: [[1,"x - b y",3]], commonmark_x: [[1,"x - b y",3]] } },
  { site: "an indented bullet at three spaces", body: ["x","   - b","y","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "a tab-indented bullet at top level", body: ["x","\t- b","y","==="], answers: { gfm: [[1,"x - b y",3]], commonmark: [[1,"x - b y",3]], commonmark_x: [[1,"x - b y",3]] } },
  { site: "a list item: the paragraph is the item's, the underline at its content column", body: ["- item","  y","  ==="], answers: { gfm: [[1,"item y",3]], commonmark: [[1,"item y",3]], commonmark_x: [[1,"item y",3]] } },
  { site: "a list item: the underline at column 0", body: ["- item","  y","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "a list item holding a bullet at code depth (six spaces)", body: ["- item","  x","      - b","  y","  ==="], answers: { gfm: [[1,"item x - b y",3]], commonmark: [[1,"item x - b y",3]], commonmark_x: [[1,"item x - b y",3]] } },
  { site: "a list item holding a bullet four spaces in (an interrupter inside the container)", body: ["- item","  x","    - b","  y","  ==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "an ordered item", body: ["1. item","   y","   ==="], answers: { gfm: [[1,"item y",3]], commonmark: [[1,"item y",3]], commonmark_x: [[1,"item y",3]] } },
  { site: "a block quote paragraph", body: ["> x","> y","> ==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "an interrupter, then three underline-shaped lines", body: ["x","x","<span>a</span>","===","===","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "an interrupter, then three dash lines", body: ["x","x","<span>a</span>","---","---","---"], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "no interrupter, then three underline-shaped lines", body: ["x","x","===","===","==="], answers: { gfm: [[1,"x x",3],[1,"===",6]], commonmark: [[1,"x x",3],[1,"===",6]], commonmark_x: [[1,"x x",3],[1,"===",6]] } },
  { site: "two paragraphs, the second holding an interrupter", body: ["x","y","===","","z","<span>a</span>","w","---"], answers: { gfm: [[1,"x y",3]], commonmark: [[1,"x y",3]], commonmark_x: [[1,"x y",3]] } },
  { site: "an interrupter in the first paragraph only", body: ["x","<span>a</span>","y","","z","w","==="], answers: { gfm: [[1,"z w",7]], commonmark: [[1,"z w",7]], commonmark_x: [[1,"z w",7]] } },
  { site: "an interrupter and then no underline", body: ["x","<span>a</span>","y"], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "no underline, a heading after", body: ["x","y","# H"], answers: { gfm: [[1,"H",5]], commonmark: [[1,"H",5]], commonmark_x: [[1,"H",5]] } },
  { site: "a twelve-line paragraph and one underline", body: ["x","x","x","x","x","x","x","x","x","x","x","x","==="], answers: { gfm: [[1,"x x x x x x x x x x x x",3]], commonmark: [[1,"x x x x x x x x x x x x",3]], commonmark_x: [[1,"x x x x x x x x x x x x",3]] } },
  { site: "a mid-document metadata block inside the paragraph", body: ["x","---","from: gfm","---","y","==="], answers: { gfm: [[2,"x",3],[2,"from: gfm",5],[1,"y",7]], commonmark: [[2,"x",3],[2,"from: gfm",5],[1,"y",7]], commonmark_x: [[2,"x",3],[2,"from: gfm",5],[1,"y",7]] } },
  { site: "an interrupter, a blank line, more of the same shape", body: ["x","<span>a</span>","","x","y","===","<span>a</span>","==="], answers: { gfm: [[1,"x y",6],[1,"<span>a</span>",9]], commonmark: [[1,"x y",6],[1,"<span>a</span>",9]], commonmark_x: [[1,"x y",6],[1,"<span>a</span>",9]] } },
  { site: "a definition marker line in the paragraph", body: ["x","~ a","y","==="], answers: { gfm: [[1,"x ~ a y",3]], commonmark: [[1,"x ~ a y",3]], commonmark_x: [] } },
  { site: "a definition marker line and an interrupter", body: ["x","~ a","<span>a</span>","y","==="], answers: { gfm: [], commonmark: [], commonmark_x: [] } },
  { site: "a letter-marker line in the paragraph", body: ["x","A. a","y","==="], answers: { gfm: [[1,"x A. a y",3]], commonmark: [[1,"x A. a y",3]], commonmark_x: [[1,"x A. a y",3]] } },
  { site: "a table dash rule under the paragraph", body: ["x","y","---","a"], answers: { gfm: [[2,"x y",3]], commonmark: [[2,"x y",3]], commonmark_x: [[2,"x y",3]] } },
];

describe("Session 332 — the paragraph-interrupt scan through findHeadings", () => {
  const rows = CASES.flatMap((c) => READERS.map((reader) => [`${c.site} (${reader})`, reader, c] as const));

  it.each(rows)("%s: the headings are the parent's", (_site, reader, c) => {
    const found = findHeadings(FRONT(reader) + c.body.join("\n") + "\n").map((heading): [number, string, number] => [heading.level, heading.text, heading.line]);
    expect(found).toEqual(c.answers[reader]);
  });

  // A table whose answers were all empty would pass a cure that found nothing. Half the rows hold a heading, and the cases are distinct.
  it("keeps the shape of the table: 64 cases, 192 rows, 95 with a heading, 23 different answer sets, no case twice", () => {
    expect(CASES.length).toBe(64);
    expect(rows.length).toBe(192);
    expect(rows.filter(([, reader, c]) => c.answers[reader].length > 0).length).toBe(95);
    expect(new Set(CASES.map((c) => JSON.stringify(c.answers))).size).toBe(23);
    expect(new Set(CASES.map((c) => c.site)).size).toBe(CASES.length);
    expect(new Set(CASES.map((c) => JSON.stringify(c.body))).size).toBe(CASES.length);
  });

  // The title is the whole paragraph only under these readers. Under the default reader (and `from: markdown`) a title is one fresh paragraph line, so two lines and an underline are no heading, and one line after a blank line is
  // (taken from the parent): which is why the interrupt scan is not asked there at all.
  it("reads no heading for two lines and an underline under the default reader and from: markdown, one for a line after a blank line, and the whole paragraph under the three readers", () => {
    const joined = "x\ny\n===\n";
    const fresh = "x\n\ny\n===\n";
    expect(findHeadings(joined)).toEqual([]);
    expect(findHeadings("---\nfrom: markdown\n---\n" + joined)).toEqual([]);
    expect(findHeadings(fresh).map((heading) => heading.text)).toEqual(["y"]);
    expect(findHeadings("---\nfrom: markdown\n---\n" + fresh).map((heading) => heading.text)).toEqual(["y"]);
    for (const reader of READERS) expect(findHeadings(FRONT(reader) + joined).map((heading) => heading.text)).toEqual(["x y"]);
  });
});
