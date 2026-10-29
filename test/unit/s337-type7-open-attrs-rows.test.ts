import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";
import {
  buildOutline,
  findAllCells,
  findBodyLines,
  findCellOptionLines,
  findCodeFenceOpeners,
  findFrontMatter,
  findHeadings,
  frontMatterContentLines,
  inFrontMatter,
  type OutlineSymbol,
} from "../../src/core/qmd/model";
import { findLabel, indexLabels } from "../../src/core/refs";

// Session 337 — the BACKLOG item "Eight more single-line RangeError shapes and three more quadratic ones", part (3). `COMMONMARK_HTML_TYPE7_OPEN` (model.ts, asked for every
// line that could open a CommonMark HTML block of type 7: a complete open tag alone on its line) read the attributes of the tag as the quantified group
// `(?:[ \t]+NAME(?:[ \t]*=[ \t]*VALUE)?)*`. V8 keeps one entry of its regex backtrack stack per repetition of a group, so a tag line of millions of attributes threw
// `RangeError: Maximum call stack size exceeded`, and the error reached every reader of the document (the Outline, the cells, the label index, the engine resolver). Only
// a CommonMark-family reader asks (`from: gfm`, `commonmark`, `commonmark_x`), and only for a line that no paragraph is open above (`!paragraphOpen`), outside a block quote,
// indented at most three spaces. Bisected at HEAD `8ebce73` (Session 337, one fresh process per probe, `findHeadings`, Node 22.23.3, the lower bound verified OK first,
// Learning 885): the bare attribute ` b` first throws at 2,097,143 repetitions with the closing `>` and at 2,097,144 without it; every attribute with a value (` b=c`,
// ` b="c"`, ` b='c'`, ` b = c`, ` b=c/`, ` b=cc`, ` b = "c"`) first throws at 986,891 (a stack entry of 68 bytes against 32). The item's "2,097,143 ... units ` b=c` and
// ` b="c"` too" is therefore right for the bare unit and 2.1 times too high for the others. Every size below is about twice the figure of its unit (Learning 775).
//
// WHAT THE ANSWER IS. A line that satisfies the type-7 grammar opens an HTML block that runs to the next blank line, so an ATX heading directly below it is part of the block and
// is no heading (`# H` goes missing); a line that does not satisfy it (an unclosed tag, `<a b b b` with no `>`) is a paragraph, which the ATX line below it interrupts (`# H`
// stays). The answers are what the OLD pattern gives, which is what the same document gives with 4 attributes (the short control of every row) and what it gives at a size below
// its first throw (derived at HEAD for the bare unit: 2,000,000 attributes read the same answer as 4).

const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = Date.now();
  const result = run();
  return { result, ms: Date.now() - started };
};

describe("the Session 337 clock helper", () => {
  it("timed reports the milliseconds the run took and hands back its result", () => {
    const { result, ms } = timed(() => {
      const started = Date.now();
      while (Date.now() - started < 30) {
        /* spin */
      }
      return "done";
    });
    expect(result).toBe("done");
    expect(ms).toBeGreaterThanOrEqual(25);
  });
});

describe("Session 337 — a tag line of millions of attributes that a quantified group read, under a CommonMark-family reader (the BACKLOG item \"Eight more single-line RangeError shapes and three more quadratic ones\", part 3)", () => {
  const FEW = 4;
  // About twice the first throw of each unit: 2 x 2,097,143 = 4,194,286 bare attributes, 2 x 986,891 = 1,973,782 attributes that carry a value.
  const BARE = 4_200_000;
  const VALUED = 2_000_000;
  // 4 s. A linear reading of the line takes tens of milliseconds (measured after the cure and written in the commit that cures); a reading that starts again from the front of the line for
  // each attribute takes hours at this size, so the limit separates the two without being a benchmark. It is not raised to make a row pass.
  const LIMIT_MS = 4000;

  const names = (text: string): string[] => findHeadings(text).map((h) => h.text);
  const flat = (symbols: OutlineSymbol[]): string[] => symbols.flatMap((s) => [`${s.kind}:${s.name}`, ...flat(s.children)]);

  /** The front matter, a type-7 candidate line directly under it, an ATX line directly below that, a heading after a blank line, a label and a cell with an option line. `end` closes the tag. */
  const doc = (id: string, run: string, from = "gfm", end = ">"): string =>
    `---\nfrom: ${from}\n---\n\n<a${run}${end}\n# H${id}\n\n## K${id}\n\n![x](y){#fig-${id}}\n\n\`\`\`{r}\n#| echo: false\n1\n\`\`\`\n\n\`\`\`text\nplain\n\`\`\`\n`;
  // the line numbers of `doc`: front matter 0 to 2, the tag line 4, the label 9, the cell 11 to 14 with its option line 12, a plain fence 16 to 18
  const swallowed = (id: string): string[] => [`K${id}`];
  const interrupts = (id: string): string[] => [`H${id}`, `K${id}`];

  type Row = { site: string; unit: string; many: number; build: (run: string) => string; read: (text: string) => unknown; answer: unknown };

  const ROWS: Row[] = [
    // The readers: the three CommonMark-family `from:` values, the bare attribute.
    { site: "from: gfm, the bare attribute closed with `>`", unit: " b", many: BARE, build: (run) => doc("r01", run), read: names, answer: swallowed("r01") },
    { site: "from: commonmark, the bare attribute closed with `>`", unit: " b", many: BARE, build: (run) => doc("r02", run, "commonmark"), read: names, answer: swallowed("r02") },
    { site: "from: commonmark_x, the bare attribute closed with `>`", unit: " b", many: BARE, build: (run) => doc("r03", run, "commonmark_x"), read: names, answer: swallowed("r03") },
    // The unit and the end of the tag, under gfm.
    { site: "the bare attribute with no closing `>`: a paragraph, which the ATX line below it interrupts", unit: " b", many: BARE, build: (run) => doc("u01", run, "gfm", ""), read: names, answer: interrupts("u01") },
    { site: "the bare attribute closed with `/>`", unit: " b", many: BARE, build: (run) => doc("u02", run, "gfm", " />"), read: names, answer: swallowed("u02") },
    { site: "the bare attribute closed with `>` and blanks after it", unit: " b", many: BARE, build: (run) => doc("u03", run, "gfm", ">  \t "), read: names, answer: swallowed("u03") },
    { site: "an attribute with an unquoted value, ` b=c`", unit: " b=c", many: VALUED, build: (run) => doc("u04", run), read: names, answer: swallowed("u04") },
    { site: "an attribute with an unquoted value and no closing `>`", unit: " b=c", many: VALUED, build: (run) => doc("u05", run, "gfm", ""), read: names, answer: interrupts("u05") },
    { site: "an attribute with a double-quoted value, ` b=\"c\"`", unit: ' b="c"', many: VALUED, build: (run) => doc("u06", run), read: names, answer: swallowed("u06") },
    { site: "an attribute with a single-quoted value, ` b='c'`", unit: " b='c'", many: VALUED, build: (run) => doc("u07", run), read: names, answer: swallowed("u07") },
    { site: "an attribute with blanks around the `=`, ` b = c`", unit: " b = c", many: VALUED, build: (run) => doc("u08", run), read: names, answer: swallowed("u08") },
    { site: "an unquoted value that ends in a slash, ` b=c/`", unit: " b=c/", many: VALUED, build: (run) => doc("u09", run), read: names, answer: swallowed("u09") },
    { site: "a quoted value after blanks around the `=`, ` b = \"c\"`", unit: ' b = "c"', many: VALUED, build: (run) => doc("u10", run), read: names, answer: swallowed("u10") },
    { site: "the bare attribute and then a quote the grammar refuses: not a tag, after the whole run was read", unit: " b", many: BARE, build: (run) => doc("u11", run, "gfm", '"x>'), read: names, answer: interrupts("u11") },
    // The place of the line, with the bare attribute under gfm.
    { site: "after a paragraph and a blank line", unit: " b", many: BARE, build: (run) => `---\nfrom: gfm\n---\n\nIntro.\n\n<a${run}>\n# Hp01\n\n## Kp01\n`, read: names, answer: ["Kp01"] },
    { site: "indented one space", unit: " b", many: BARE, build: (run) => `---\nfrom: gfm\n---\n\n <a${run}>\n# Hp02\n\n## Kp02\n`, read: names, answer: ["Kp02"] },
    { site: "indented three spaces", unit: " b", many: BARE, build: (run) => `---\nfrom: gfm\n---\n\n   <a${run}>\n# Hp03\n\n## Kp03\n`, read: names, answer: ["Kp03"] },
    { site: "after a list and a blank line", unit: " b", many: BARE, build: (run) => `---\nfrom: gfm\n---\n\n- item\n\n<a${run}>\n# Hp04\n\n## Kp04\n`, read: names, answer: ["Kp04"] },
    { site: "inside a fenced div", unit: " b", many: BARE, build: (run) => `---\nfrom: gfm\n---\n\n::: {.callout-note}\n<a${run}>\n# Hp05\n:::\n\n## Kp05\n`, read: names, answer: ["Kp05"] },
    { site: "directly under a heading", unit: " b", many: BARE, build: (run) => `---\nfrom: gfm\n---\n\n# Tp06\n<a${run}>\n## Hp06\n\n## Kp06\n`, read: names, answer: ["Tp06", "Kp06"] },
    { site: "directly under a setext heading", unit: " b", many: BARE, build: (run) => `---\nfrom: gfm\n---\n\nTitle p07\n=========\n<a${run}>\n# Hp07\n\n## Kp07\n`, read: names, answer: ["Title p07", "Kp07"] },
    // Every reader of the document, with the engine hint the providers pass (`providers/outline.ts`, `workspace-symbols.ts`, `crossref.ts`; Learning 886).
    { site: "findHeadings with the knitr hint", unit: " b", many: BARE, build: (run) => doc("e01", run), read: (text) => findHeadings(text, "knitr").map((h) => h.text), answer: swallowed("e01") },
    { site: "findHeadings with the jupyter hint", unit: " b", many: BARE, build: (run) => doc("e02", run), read: (text) => findHeadings(text, "jupyter").map((h) => h.text), answer: swallowed("e02") },
    { site: "buildOutline", unit: " b", many: BARE, build: (run) => doc("e03", run), read: (text) => flat(buildOutline(text)), answer: ["heading:Ke03", "cell:```{r}"] },
    { site: "buildOutline with the knitr hint", unit: " b", many: BARE, build: (run) => doc("e04", run), read: (text) => flat(buildOutline(text, "knitr")), answer: ["heading:Ke04", "cell:```{r}"] },
    { site: "buildOutline with the jupyter hint", unit: " b", many: BARE, build: (run) => doc("e05", run), read: (text) => flat(buildOutline(text, "jupyter")), answer: ["heading:Ke05", "cell:```{r}"] },
    { site: "findAllCells", unit: " b", many: BARE, build: (run) => doc("e06", run), read: (text) => findAllCells(text).map((c) => [c.startLine, c.endLine]), answer: [[11, 14]] },
    { site: "findCellOptionLines", unit: " b", many: BARE, build: (run) => doc("e07", run), read: (text) => findCellOptionLines(text).map((o) => o.line), answer: [12] },
    { site: "findCodeFenceOpeners", unit: " b", many: BARE, build: (run) => doc("e08", run), read: (text) => findCodeFenceOpeners(text).map((o) => o.line), answer: [16] },
    { site: "findBodyLines", unit: " b", many: BARE, build: (run) => doc("e09", run), read: (text) => findBodyLines(text).map((b) => b.line), answer: [3, 4, 5, 6, 7, 8, 9, 10, 15, 19] },
    { site: "findFrontMatter", unit: " b", many: BARE, build: (run) => doc("e10", run), read: findFrontMatter, answer: { startLine: 0, endLine: 2 } },
    { site: "frontMatterContentLines", unit: " b", many: BARE, build: (run) => doc("e11", run), read: frontMatterContentLines, answer: ["from: gfm"] },
    { site: "inFrontMatter", unit: " b", many: BARE, build: (run) => doc("e12", run), read: (text) => [inFrontMatter(text, 1), inFrontMatter(text, 5)], answer: [true, false] },
    { site: "indexLabels", unit: " b", many: BARE, build: (run) => doc("e13", run), read: (text) => indexLabels(text).map((l) => [l.id, l.line]), answer: [["fig-e13", 9]] },
    { site: "indexLabels with the knitr hint", unit: " b", many: BARE, build: (run) => doc("e14", run), read: (text) => indexLabels(text, "knitr").map((l) => [l.id, l.line]), answer: [["fig-e14", 9]] },
    { site: "indexLabels with the jupyter hint", unit: " b", many: BARE, build: (run) => doc("e15", run), read: (text) => indexLabels(text, "jupyter").map((l) => [l.id, l.line]), answer: [["fig-e15", 9]] },
    { site: "findLabel", unit: " b", many: BARE, build: (run) => doc("e16", run), read: (text) => findLabel(text, "fig-e16")?.line, answer: 9 },
    { site: "findLabel with the knitr hint", unit: " b", many: BARE, build: (run) => doc("e17", run), read: (text) => findLabel(text, "fig-e17", "knitr")?.line, answer: 9 },
    { site: "resolveDocumentEngine", unit: " b", many: BARE, build: (run) => doc("e18", run), read: (text) => resolveDocumentEngine("a.qmd", text), answer: "knitr" },
    { site: "resolveDocumentEngine of a document with an engine key and the tag line in its body", unit: " b", many: BARE, build: (run) => `---\nfrom: gfm\nengine: jupyter\n---\n\n<a${run}>\n# He19\n\n## Ke19\n`, read: (text) => resolveDocumentEngine("a.qmd", text), answer: "jupyter" },
  ];

  it.each(ROWS.map((row) => [row.site, row] as const))("%s: is read without throwing, in linear time, and the answer is the stated one with 4 attributes and with the long run", (_site, row) => {
    const short = row.build(row.unit.repeat(FEW));
    expect(row.read(short)).toEqual(row.answer);
    const run = row.unit.repeat(row.many);
    const longText = row.build(run);
    expect(longText.length).toBeGreaterThan(run.length); // the timed text holds the whole run
    const { result, ms } = timed(() => row.read(longText));
    expect(result).toEqual(row.answer);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, 120_000);

  // Rows that the parent ALSO reads without throwing: the pattern is not asked at all (a paragraph is open above, a block quote, an indent of four, a tab, a list marker) or the reader is not
  // CommonMark's. They pass on the parent and must keep passing, with the answer unchanged.
  const CONTROLS: Row[] = [
    { site: "CONTROL under a paragraph: a type-7 line cannot interrupt one, so the pattern is not asked", unit: " b", many: BARE, build: (run) => `---\nfrom: gfm\n---\n\nIntro.\n<a${run}>\n# Hc01\n\n## Kc01\n`, read: names, answer: ["Hc01", "Kc01"] },
    { site: "CONTROL in a block quote", unit: " b", many: BARE, build: (run) => `---\nfrom: gfm\n---\n\n> <a${run}>\n\n# Hc02\n\n## Kc02\n`, read: names, answer: ["Hc02", "Kc02"] },
    { site: "CONTROL indented four spaces (indented code)", unit: " b", many: BARE, build: (run) => `---\nfrom: gfm\n---\n\n    <a${run}>\n# Hc03\n\n## Kc03\n`, read: names, answer: ["Hc03", "Kc03"] },
    { site: "CONTROL indented by a tab", unit: " b", many: BARE, build: (run) => `---\nfrom: gfm\n---\n\n\t<a${run}>\n# Hc04\n\n## Kc04\n`, read: names, answer: ["Hc04", "Kc04"] },
    { site: "CONTROL after a list marker", unit: " b", many: BARE, build: (run) => `---\nfrom: gfm\n---\n\n- <a${run}>\n\n## Kc05\n`, read: names, answer: ["Kc05"] },
    { site: "CONTROL inside an open type-7 block (the pattern is asked once, for the line that opens it)", unit: " b", many: BARE, build: (run) => `---\nfrom: gfm\n---\n\n<b>\n<a${run}>\n# Hc06\n\n## Kc06\n`, read: names, answer: ["Kc06"] },
    { site: "CONTROL the default reader keeps the heading below the tag", unit: " b", many: BARE, build: (run) => doc("c07", run, "markdown"), read: names, answer: swallowed("c07") },
    { site: "CONTROL markdown_strict keeps the heading below the tag", unit: " b", many: BARE, build: (run) => doc("c08", run, "markdown_strict"), read: names, answer: interrupts("c08") },
    { site: "CONTROL a document with no front matter", unit: " b", many: BARE, build: (run) => `<a${run}>\n# Hc09\n\n## Kc09\n`, read: names, answer: swallowed("c09") },
    { site: "CONTROL a value the grammar refuses after the first attribute (` b=` and then ` b=`): the group repeats once", unit: " b=", many: 8_400_000, build: (run) => doc("c11", run), read: names, answer: interrupts("c11") },
    { site: "CONTROL gfm, a long run of blanks and no attribute", unit: " ", many: 8_400_000, build: (run) => `---\nfrom: gfm\n---\n\n<a${run}>\n# Hc10\n\n## Kc10\n`, read: names, answer: ["Kc10"] },
  ];

  it.each(CONTROLS.map((row) => [row.site, row] as const))("%s: the answer is the same with 4 attributes and with the long run", (_site, row) => {
    expect(row.read(row.build(row.unit.repeat(FEW)))).toEqual(row.answer);
    const longText = row.build(row.unit.repeat(row.many));
    const { result, ms } = timed(() => row.read(longText));
    expect(result).toEqual(row.answer);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, 120_000);

  it("builds a different text for every row", () => {
    // The TEXT alone: `scanRegions` keeps the last two scans by text, so a row whose text another row read just before it is served from the cache and cannot be RED.
    const small = [...ROWS, ...CONTROLS].map((row) => row.build(row.unit.repeat(FEW)));
    expect(new Set(small).size).toBe(ROWS.length + CONTROLS.length);
  });

  // The parent THROWS from 2,097,143 bare attributes and from 986,891 attributes with a value; a run below those, or a unit that is not the throwing one, would pass on it, and a limit of minutes would pass a quadratic cure.
  it("keeps the sizes, the limit and the units the Session 337 rows are built on", () => {
    expect([FEW, BARE, VALUED, LIMIT_MS]).toEqual([4, 4_200_000, 2_000_000, 4000]);
    expect(ROWS.map((row) => `${row.unit}x${row.many}`)).toEqual([
      ...Array.from({ length: 6 }, () => " bx4200000"), // three readers, no closing `>`, `/>`, blanks after the `>`
      " b=cx2000000", " b=cx2000000", ' b="c"x2000000', " b='c'x2000000", " b = cx2000000", " b=c/x2000000", ' b = "c"x2000000',
      " bx4200000", // a refused quote after the run
      ...Array.from({ length: 7 }, () => " bx4200000"), // the places of the line
      ...Array.from({ length: 19 }, () => " bx4200000"), // the readers of the document
    ]);
    expect(CONTROLS.map((row) => `${row.unit}x${row.many}`)).toEqual([...Array.from({ length: 9 }, () => " bx4200000"), " b=x8400000", " x8400000"]);
  });
});
