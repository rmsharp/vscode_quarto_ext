import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";
import { bibliographyPaths } from "../../src/core/frontmatter";
import { findMathRegions } from "../../src/core/math-regions";
import { parseDeclaredFormats } from "../../src/core/preview-format";
import { parseOutputPath } from "../../src/core/render-args";
import { findAllCells, findCellOptionLines, findCodeFenceOpeners, findHeadings, headingContentRefused, knitrChunkHeaderLabel, maskInlineCode, plainFrontMatter } from "../../src/core/qmd/model";
import { jupyterKernelLanguage } from "../../src/core/qmd/jupyter-kernel";
import { quartoYamlRegions } from "../../src/core/qmd/quarto-yaml-regions";
import { findLabel, indexLabels } from "../../src/core/refs";
import { findProjectConfigKeyLines, findProjectConfigValueLines } from "../../src/core/project-yaml";
import { completionContextAt, mappingContainerKey, topLevelSlots, valueSlotAfterColon } from "../../src/core/yaml-context";
import { findNestedFrontMatterValueLines } from "../../src/core/yaml-frontmatter-nested-values";
import { findFrontMatterTopLevelLines } from "../../src/core/yaml-frontmatter-values";
import { CURATED_SCHEMA_INDEX } from "../../src/core/yaml-schema";
import { isWrongValue } from "../../src/core/yaml-value-check";
import { collectValueSources, valueFlags } from "../../src/core/yaml-value-flags";
import { LS, PS } from "./support/regex-equivalence";

// Session 311 — the BACKLOG item "Three PRE-EXISTING slow or crashing inputs" (found by Session 304's robustness
// hunter, timed firsthand, identical in the parent build). Every row here is a document nobody writes by hand and
// an editor can still be handed: the extension must read it in time proportional to its size, and must not throw.
// The limits are generous on purpose (a linear pass takes milliseconds); the inputs are sized so the quadratic
// reading takes several seconds, so a regression cannot hide under a loaded machine.

const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = Date.now();
  const result = run();
  return { result, ms: Date.now() - started };
};

// Every clock assertion of this file reads `timed`. A timer that always reported 0 would pass them all, so it is checked once against a run of known length (Session 320 review).
describe("the clock helper", () => {
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

describe("Session 311 — a long run of spaces inside a YAML value", () => {
  it("valueSlotAfterColon trims a 100,000-space run in linear time and keeps the slot exact", () => {
    const run = " ".repeat(100000);
    const { result, ms } = timed(() => valueSlotAfterColon(`subtitle: a${run}b`, 8));
    expect(result).toEqual({ startCol: 10, endCol: 10 + 1 + 100000 + 1 });
    expect(ms).toBeLessThan(1000);
  });

  it("the engine resolver reads a front matter value holding a 100,000-space run in linear time (the reported path)", () => {
    const run = " ".repeat(100000);
    const text = ["---", "title: t", `subtitle: a${run}b`, "engine: knitr", "---", "", "Text."].join("\n");
    const { result, ms } = timed(() => resolveDocumentEngine("a.qmd", text));
    expect(result).toBe("knitr");
    expect(ms).toBeLessThan(1000);
  });

  // `slotsOf` (the cell-option reader in `core/qmd/model`) carries a sibling copy of the same trim.
  const cellOptions = (option: string): ReturnType<typeof findCellOptionLines> => findCellOptionLines(["```{r}", option, "plot(1)", "```"].join("\n"));

  it("a cell option's value holding a 100,000-space run is read in linear time, and its value slot is exact", () => {
    const run = " ".repeat(100000);
    const option = `#| fig-cap: a${run}b`;
    const { result, ms } = timed(() => cellOptions(option));
    expect(result).toHaveLength(1);
    expect(result[0].valueSlot).toEqual({ startCol: option.indexOf(": a") + 2, endCol: option.length });
    expect(ms).toBeLessThan(1000);
  });

  it("a cell option's key holding a 100,000-space run is read in linear time, and its key slot is exact", () => {
    const run = " ".repeat(100000);
    const option = `#| fig-cap${run}x: v`;
    const { result, ms } = timed(() => cellOptions(option));
    expect(result).toHaveLength(1);
    expect(result[0].keySlot).toEqual({ startCol: option.indexOf("fig-cap"), endCol: option.indexOf(":") });
    expect(ms).toBeLessThan(1000);
  });
});

describe("Session 311 — a numeric character reference in an id that names no character", () => {
  // `writtenElsewhere` (the label index's check for an anchor a document writes by hand) decodes `&#N;` and `&#xH;` in an `id`.
  // A reference past U+10FFFF names no character: HTML reads it as U+FFFD, and `String.fromCodePoint` throws instead, taking the
  // WHOLE index down with it (a completion and a definition request answer nothing). It is reached only for a labelled cell
  // that the no-target rules would remove, so the cell below is `eval=FALSE`.
  const cell = ["```{r fig-x, eval=FALSE}", '#| fig-cap: "Cap"', "plot(1)", "```"].join("\n");
  const ids = (text: string): string[] => indexLabels(text, "knitr").map((l) => l.id);

  it.each([
    ["a decimal reference of 11 digits", "&#99999999999;"],
    ["a hexadecimal reference one past the last code point", "&#x110000;"],
    ["a decimal reference too long to be a finite number", `&#${"9".repeat(400)};`],
  ])("%s does not throw, and the cell that makes no figure stays out of the index", (_what, reference) => {
    const text = `# T\n\n<span id="a${reference}"></span>\n\n${cell}\n`;
    let found: string[] = [];
    expect(() => {
      found = ids(text);
    }).not.toThrow();
    expect(found).toEqual([]);
  });

  it.each([
    ["a decimal reference of 11 digits", "&#99999999999;"],
    ["a hexadecimal reference one past the last code point", "&#x110000;"],
  ])("%s decodes to a character the id filter drops, so an anchor that spells the label with it still names the label", (_what, reference) => {
    // `id="fig-x<reference>"` is `fig-x` plus U+FFFD, which the identifier filter removes: the cell's label is written elsewhere and stays.
    // Not merely 'does not throw': a decode that discarded the whole anchor would also pass the rows above.
    expect(ids(`<span id="fig-x${reference}"></span>\n\n${cell}\n`)).toEqual(["fig-x"]);
  });
});

describe("Session 311 — a front matter whose flow mapping never closes", () => {
  // `flowRegion` joins the lines after a `format: {` one at a time until the brackets balance, and used to re-read the whole joined
  // text after each one: 20,000 ordinary lines below an opener that never closes cost 26 s, in every reader of the front matter.
  const unclosed = (opener: string, lines: number): string => ["---", opener, ...Array.from({ length: lines }, () => "x: 1"), "---", "", "# Heading", ""].join("\n");

  // Each reader gets a text of its own (one line longer): `scanRegions` caches by text, so a second call on the same text would be served
  // from the first call's scan and would time nothing. At the parent a cold resolver takes as long as the Outline, 5.5 s at 12,000 lines.
  it.each([
    ["an unclosed mapping", "format: {html: {echo: false}"],
    ["an unclosed mapping that holds a quoted brace", 'format: {html: {echo: "}"}'],
  ])("%s below 12,000 ordinary lines is read in linear time by the Outline", (_what, opener) => {
    const { result, ms } = timed(() => findHeadings(unclosed(opener, 12000)));
    expect(result.map((h) => h.text)).toEqual(["Heading"]);
    expect(ms).toBeLessThan(1000);
  });

  it.each([
    ["an unclosed mapping", "format: {html: {echo: false}"],
    ["an unclosed mapping that holds a quoted brace", 'format: {html: {echo: "}"}'],
  ])("%s below 12,001 ordinary lines is read in linear time by the engine resolver", (_what, opener) => {
    const { result, ms } = timed(() => resolveDocumentEngine("a.qmd", unclosed(opener, 12001)));
    expect(result).toBe("markdown");
    expect(ms).toBeLessThan(1000);
  });

  it("…while thousands of mappings that each close on their own line and decide nothing stay linear (the reason `flowRegion` reads windows, not the whole rest of the block)", () => {
    // A reader stops at the first mapping that resolves a `from:`, so only mappings that do NOT make it call `flowRegion` again for every line:
    // joining the whole rest of the block on each call costs 10 s at 20,000 lines and 40 s at 40,000.
    const mappings = (n: number): string => ["---", ...Array.from({ length: n }, () => "format: {html: {echo: false}}"), "---", "", "Text.", "# Tight", ""].join("\n");
    const headings = timed(() => findHeadings(mappings(40000)));
    expect(headings.result.map((h) => h.text)).toEqual([]); // the markdown reader: a heading directly under a paragraph line is no heading
    expect(headings.ms).toBeLessThan(1000);
    const engine = timed(() => resolveDocumentEngine("a.qmd", mappings(40001))); // another text: the first call's scan is cached by text
    expect(engine.result).toBe("markdown");
    expect(engine.ms).toBeLessThan(1000);
  });
});

describe("Session 311 — a single line of five million backticks", () => {
  // The four fence patterns (`FENCE_OPEN`, `FENCE_CLOSE`, `CELL_FENCE_CLOSE`, `INDENTED_CELL_FENCE_OPEN`) used to read the run with a
  // quantified back-reference, `([`~])\2{2,}`, which V8 keeps one backtrack entry per repetition for: past a few million the regex
  // stack overflows and `exec` throws RangeError. It is thrown from `scanRegions`, so EVERY reader (the Outline, the front matter, the
  // engine resolver, the label index) answered nothing for such a document, not only the one the item named.
  const document = (run: number): string => `Intro.\n\n${"`".repeat(run)}\n\n# H\n`;

  it("is read by the Outline without throwing, and like a shorter run of the same shape", () => {
    const shorter = findHeadings(document(2000)).map((h) => h.text);
    let found: string[] = [];
    const { ms } = timed(() => {
      expect(() => {
        found = findHeadings(document(5_000_000)).map((h) => h.text);
      }).not.toThrow();
    });
    expect(found).toEqual(shorter);
    // `buildCloserIndex` used to file a closer line under one bucket per run length (3 up to the run's own length): 5 million
    // entries here, about 3 s and a heap that a line ten times longer would exhaust, where the regex used to throw first.
    expect(ms).toBeLessThan(2500); // idle 0.3 s; the per-length buckets took 3.6 s. Loose enough for a loaded machine, tight enough to catch them.
  });
});

describe("Session 311 — a fence whose run is longer than the closers `buildCloserIndex` files one bucket per length", () => {
  // The closer index files a plain closer under one bucket for each run length up to `MAX_BUCKETED_FENCE_RUN` (64) and keeps a longer
  // run on a side list. The expected headings below are what the tree BEFORE that change answered for every row (the rows passed on
  // arrival; the differential over 200,000 generated documents and the mutants of the side list are what they stand for): a fence
  // is a code block only when something closes it, and a closer must be at least as long as its opener. `# Inside` is visible when
  // the fence is never closed, hidden when it is.
  const run = (n: number): string => "`".repeat(n);
  const headings = (lines: string[]): string[] => findHeadings(lines.join("\n") + "\n").map((h) => h.text);
  const fence = (open: string, close: string): string[] => ["Intro.", "", open, "", "# Inside", "", close, "", "# After"];

  it.each([
    ["a 70-run closed by a 70-run", 70, 70, ["After"]],
    ["a 70-run, closer one short", 70, 69, ["Inside", "After"]],
    ["a 70-run closed by a longer run", 70, 100, ["After"]],
    ["a 5-run closed by a 100-run (the long closer serves the short opener)", 5, 100, ["After"]],
    ["a 64-run closed by a 64-run (the last length with a bucket)", 64, 64, ["After"]],
    ["a 65-run closed by a 65-run (the first length without one)", 65, 65, ["After"]],
    ["a 65-run, closer one short (a bucketed 64)", 65, 64, ["Inside", "After"]],
  ])("%s", (_what, open, close, expected) => {
    expect(headings(fence(run(open), run(close)))).toEqual(expected);
  });

  it.each([
    ["a 70-run, marked closer of the same length", 70, 70, ["After"]],
    ["a 70-run, marked closer one short", 70, 69, ["In1", "After"]],
    ["a 64-run, marked closer of the same length (the last length with a quoted bucket)", 64, 64, ["After"]],
    ["a 64-run, marked closer longer", 64, 65, ["After"]],
    ["a 65-run, marked closer of the same length (the first length without one)", 65, 65, ["After"]],
    ["a 65-run, marked closer one short", 65, 64, ["In1", "After"]],
  ])("opened inside a block quote: %s", (_what, open, close, expected) => {
    expect(headings(["Intro.", "", `> ${run(open)}`, ">", "> # In1", ">", `> ${run(close)}`, "", "# After"])).toEqual(expected);
  });

  it.each([
    ["a backtick pair is no opener, whatever closes it below", ["Intro.", "", "``", "", "# Inside", "", "```", "", "# After"]],
    ["…nor with nothing below", ["Intro.", "", "``", "", "# Inside", "", "# After"]],
    ["a tilde pair is no opener either", ["Intro.", "", "~~", "", "# Inside", "", "~~~", "", "# After"]],
  ])("a fence needs a run of three: %s", (_what, lines) => {
    // The four fence patterns read the run as `(?:`{3,}|~{3,})`; a pair that a mutant reads as an opener is closed by the triple below.
    expect(headings(lines)).toEqual(["Inside", "After"]);
  });

  it("many unclosed long openers above many shorter long closers cost time proportional to the document (the side list is not scanned per opener)", () => {
    // A 100-run opener is closed by nothing below it (every closer-shaped line is a 70-run), so each of the n/2 openers asks the side list
    // whether a run of 100 exists below it. Scanning the list per opener is quadratic: 100,000 lines took 2.9 s against the parent's 0.7 s,
    // and 200,000 took 10 s against 1.4 s. A doubling test, in one process, so a loaded machine moves both sides of the ratio.
    const adversarial = (n: number): string =>
      [...Array.from({ length: n / 2 }, () => `${run(100)} text`), ...Array.from({ length: n / 2 }, () => run(70)), "", "# H", ""].join("\n");
    findHeadings(adversarial(2000)); // warm the code before anything is timed
    const small = timed(() => findHeadings(adversarial(6250)));
    const large = timed(() => findHeadings(adversarial(100000)));
    expect(small.result.map((h) => h.text)).toEqual(["H"]);
    expect(large.result.map((h) => h.text)).toEqual(["H"]);
    // sixteen times the lines: the parent's bucketed lookup measured 11x, the side list scanned per opener 39x (and growing with n)
    expect(large.ms).toBeLessThan(24 * small.ms + 100);
  });

  it.each([
    ["the lookup passes a too-short long closer to reach a long enough one below it", ["Intro.", "", run(70), "", "# Inside", "", run(69), "", run(70), "", "# After"], ["After"]],
    ["the opener's own line is not a closer for itself, but the line right below it is", ["Intro.", "", run(70), run(70), "# After"], ["After"]],
    ["a closer at code depth (column 4) closes nothing", ["Intro.", "", run(70), "", "# Inside", "", `    ${run(70)}`, "", "# After"], ["Inside", "After"]],
    ["a tilde run does not close a backtick opener", ["Intro.", "", run(70), "", "# Inside", "", "~".repeat(70), "", "# After"], ["Inside", "After"]],
    ["a tilde run of 70 closes a tilde run of 70", ["Intro.", "", "~".repeat(70), "", "# Inside", "", "~".repeat(70), "", "# After"], ["After"]],
    ["a marked closer closes nothing for an opener that is not in a quote", ["Intro.", "", run(70), "", "# Inside", "", `> ${run(70)}`, "", "# After"], ["Inside", "After"]],
    ["a quoted tilde run does not close a quoted backtick opener", ["Intro.", "", `> ${run(70)}`, ">", "> # In1", ">", `> ${"~".repeat(70)}`, "", "# After"], ["In1", "After"]],
    ["a marked closer after the quote has ended closes nothing", ["Intro.", "", `> ${run(70)}`, ">", "> # In1", "", `> ${run(70)}`, "", "# After"], ["In1", "After"]],
  ])("the side list keeps its key: %s", (_what, lines, expected) => {
    // Every expected value is what the parent tree answered. Each row kills a mutant of the side list that the first rows left alive
    // (the review round's C, D, F, E2 to E4, H and J): scanning past a short entry, an inclusive `from`, the column, the fence character in
    // the plain and the quoted key, a tilde run over 64, the quoted namespace, and the `until` bound on the quoted call.
    expect(headings(lines)).toEqual(expected);
  });

  it.each([
    ["nearest of three", [70, 69, 69], true],
    ["farthest of three", [69, 69, 70], true],
    ["middle of three", [69, 70, 69], true],
    ["last of four", [69, 69, 69, 70], true],
    ["first of four", [70, 69, 69, 69], true],
    ["last of five", [69, 69, 69, 69, 70], true],
    ["middle of five", [69, 69, 70, 69, 69], true],
    ["only one of one", [70], true],
    ["second of two", [69, 70], true],
    ["none of two", [69, 69], false],
    ["none of three", [69, 69, 69], false],
    ["none of four", [69, 69, 69, 69], false],
  ])("a 70-run opener with %s of the runs below it long enough to close it", (_what, below, closes) => {
    // The side list answers 'is any run at least 70 among these entries?' with two overlapping blocks of a sparse table, so the rows put
    // the one run that qualifies at every position of lists of 1 to 5 entries: a lookup that read one block, a block of the wrong size,
    // or a table without its top level (a list of exactly 2 or 4) misses one of them. The opener carries text, so it is no closer itself.
    const lines = ["Intro.", "", `${run(70)} text`, "", "# Inside", "", ...below.flatMap((n) => [run(n), ""]), "# After"];
    expect(headings(lines)).toEqual(closes ? ["After"] : ["Inside", "After"]);
  });

  it("a long run inside a knitr-silenced chunk is not a closer (the `skip` map filters the side list too)", () => {
    // With the knitr engine the chunk below is silenced and its lines are left out of the closer index (`buildCloserIndex`'s `skip`): the
    // 65-run that closes it must not be filed, or the `skip.has` guard in `pushLongRun` is load-bearing and nothing would notice.
    const lines = ["prose", "", run(70), "", "## Under", "", `${run(65)}{r demo, echo=FALSE}`, "plot(pressure)", run(65), "", "## Mid", "", run(80), "", "## After", "tail", ""];
    expect(findHeadings(lines.join("\n") + "\n", "knitr").map((h) => h.text)).toEqual(["After"]);
  });

  it("a long closer past the block quote's end closes nothing inside it", () => {
    // `until` bounds a quoted opener's lookahead: the unmarked blank line ends the quote, so a 70-run after it is another block's.
    const lines = ["Intro.", "", `> ${run(70)}`, ">", "> # In1", "", run(70), "", "# After"];
    expect(headings(lines)).toEqual(["In1", "After"]);
  });
});

describe("Session 311 — masking the inline code of a line that is one long run of backticks", () => {
  // `maskInlineCode` (shared by the label index and the math detector) read the spans with `(`+)(?:(?!\1)[\s\S])*?\1`: for a run of n
  // backticks with nothing to close it the engine tries every group length from n down, and the cost is quadratic in the run: 300,000
  // backticks took 52 s in `indexLabels`. A run of n masks 2*floor(n/2) of its characters (the opener takes the largest closer it can
  // find, and the run itself closes the half that fits), so an odd run keeps its last backtick.
  it.each([
    ["an even run of 100,000", 100000, " ".repeat(100000)],
    ["an odd run of 100,001", 100001, `${" ".repeat(100000)}\``],
  ])("%s is masked in linear time", (_what, n, expected) => {
    const { result, ms } = timed(() => maskInlineCode("`".repeat(n)));
    expect(result).toBe(expected);
    expect(ms).toBeLessThan(1000);
  });

  it("the label index reads a document holding such a line in linear time (the reported path: 300,000 backticks took 52 s)", () => {
    const text = ["# T", "", "`".repeat(100000), "", "```{r fig-x}", '#| fig-cap: "Cap"', "plot(1)", "```", ""].join("\n");
    const { result, ms } = timed(() => indexLabels(text, "knitr").map((l) => l.id));
    expect(result).toEqual(["fig-x"]);
    expect(ms).toBeLessThan(1000);
  });
});

describe("Session 312 — the label index of a document with thousands of `{#sec-...}` headings", () => {
  // `indexLabels` (and `findLabel`, which is `indexLabels` plus a lookup) found each heading's id column with `idColumn`, which split the
  // WHOLE text into lines once PER HEADING: 8,000 headings took 5.6 s and 16,000 took 22 s (about 4x per doubling), and every completion and go-to-definition
  // request calls it. A book chapter with thousands of section ids reaches it.
  const headingsText = (n: number, eol = "\n"): string =>
    Array.from({ length: n }, (_, i) => `## Heading ${i} {#sec-h${i}}${eol}${eol}text${eol}`).join(eol);
  // Each item is four lines (heading, blank, `text`, blank), so heading i is on line 4 * i.
  const expectedLabels = (n: number): { id: string; kind: string; line: number; column: number }[] =>
    Array.from({ length: n }, (_, i) => ({ id: `sec-h${i}`, kind: "sec", line: 4 * i, column: `## Heading ${i} {#`.length }));

  it("indexLabels reads 8,000 section headings in linear time and keeps every column exact", () => {
    const { result, ms } = timed(() => indexLabels(headingsText(8000)));
    expect(result).toEqual(expectedLabels(8000));
    expect(ms).toBeLessThan(1500);
  });

  it("findLabel answers for the LAST of 8,000 section headings in linear time", () => {
    const text = headingsText(8000);
    const { result, ms } = timed(() => findLabel(text, "sec-h7999"));
    expect(result).toEqual({ id: "sec-h7999", kind: "sec", line: 4 * 7999, column: "## Heading 7999 {#".length });
    expect(ms).toBeLessThan(1500);
  });

  // This row pins the LINE INDEXING of the once-split under CRLF (an off-by-one fails it). It cannot tell `\r?\n` from `\n`: a trailing CR never
  // moves an id column. That regex is pinned by the older rows of `refs-no-target.test.ts`.
  it("a CRLF document gives the same labels as an LF one (line indexing survives the once-split)", () => {
    expect(indexLabels(headingsText(50, "\r\n"))).toEqual(expectedLabels(50));
  });
});

describe("Session 312 — a long run of spaces inside a YAML KEY", () => {
  // Eight `.replace(/[ \t]+$/, "")` key trims were quadratic in a run of spaces inside the key (the regex is retried from every space of
  // the run): the engine resolver took 3.0 s on a 50,000-space key and 11.2 s on 100,000. They now call `trimEndBlanks`, which strips
  // an ASCII space or tab ONLY, so a key ending in a no-break space keeps it (`trim-end-blanks.test.ts` holds the oracle).
  const run = " ".repeat(100000);

  it("the engine resolver reads a front matter key holding a 100,000-space run in linear time (the reported path)", () => {
    const text = ["---", "title: t", `a${run}b: v`, "engine: knitr", "---", "", "Text."].join("\n");
    const { result, ms } = timed(() => resolveDocumentEngine("a.qmd", text));
    expect(result).toBe("knitr");
    expect(ms).toBeLessThan(1000);
  });

  it("findProjectConfigKeyLines reads a `_quarto.yml` child key holding a 100,000-space run in linear time and keeps the key and its range exact", () => {
    const { result, ms } = timed(() => findProjectConfigKeyLines(`project:\n  a${run}b: v\n`));
    expect(result).toEqual([{ line: 1, container: "project", key: `a${run}b`, keyRange: { startCol: 2, endCol: 2 + 1 + 100000 + 1 } }]);
    expect(ms).toBeLessThan(1000);
  });

  it("findProjectConfigKeyLines still trims the blanks BEFORE the colon off a `_quarto.yml` child key", () => {
    expect(findProjectConfigKeyLines("project:\n  a \t : v\n")).toEqual([{ line: 1, container: "project", key: "a", keyRange: { startCol: 2, endCol: 3 } }]);
  });

  it("findProjectConfigValueLines reads a `_quarto.yml` key holding a 100,000-space run in linear time and keeps the key and the value range exact", () => {
    const { result, ms } = timed(() => findProjectConfigValueLines(`a${run}b: v\n`));
    expect(result).toEqual([
      { line: 0, container: "document", path: [], key: `a${run}b`, valueRange: { startCol: 100000 + 4, endCol: 100000 + 5 }, rawToken: "v" },
    ]);
    expect(ms).toBeLessThan(1000);
  });

  it("findProjectConfigValueLines still trims the blanks BEFORE the colon off a `_quarto.yml` key", () => {
    expect(findProjectConfigValueLines("a \t : v\n")).toEqual([
      { line: 0, container: "document", path: [], key: "a", valueRange: { startCol: 6, endCol: 7 }, rawToken: "v" },
    ]);
  });

  // A python cell whose single `#|` option line is `option`; `valueFlags` is what the value diagnostics run on every open document.
  const flagsFor = (option: string): ReturnType<typeof valueFlags> =>
    valueFlags(collectValueSources(["```{python}", option, "x = 1", "```", ""].join("\n")), "a.qmd", CURATED_SCHEMA_INDEX);

  it("valueFlags reads a cell option key holding a 100,000-space run in linear time (the key is no known option, so nothing is flagged)", () => {
    const { result, ms } = timed(() => flagsFor(`#| echo${run}x: banana`));
    expect(result).toEqual({ cell: [], frontMatter: [], nested: [] });
    expect(ms).toBeLessThan(1000);
  });

  it("valueFlags still trims the blanks BEFORE the colon off a cell option key, so `echo \t : banana` is flagged as `echo`", () => {
    const { cell } = flagsFor("#| echo \t : banana");
    expect(cell).toHaveLength(1);
    expect(cell[0]).toMatchObject({ key: "echo", rawToken: "banana", line: 1, startCol: 12, endCol: 18 });
  });

  it("completionContextAt reads a nested front matter key holding a 100,000-space run in linear time and keeps the replace range exact", () => {
    const text = ["---", "execute:", `  a${run}b: v`, "---", ""].join("\n");
    const { result, ms } = timed(() => completionContextAt(text, text.indexOf("  a") + 3, () => undefined));
    expect(result).toEqual({ kind: "frontmatter-key", parentPath: ["execute"], token: "a", replaceRange: { line: 2, startCol: 2, endCol: 2 + 1 + 100000 + 1 } });
    expect(ms).toBeLessThan(1000);
  });

  it("completionContextAt still trims the blanks BEFORE the colon off a nested front matter key", () => {
    const text = ["---", "execute:", "  a \t : v", "---", ""].join("\n");
    expect(completionContextAt(text, text.indexOf("  a") + 3, () => undefined)).toEqual({ kind: "frontmatter-key", parentPath: ["execute"], token: "a", replaceRange: { line: 2, startCol: 2, endCol: 3 } });
  });

  it("mappingContainerKey reads a container key holding a 100,000-space run in linear time and returns it whole", () => {
    const { result, ms } = timed(() => mappingContainerKey(`a${run}b:`));
    expect(result).toBe(`a${run}b`);
    expect(ms).toBeLessThan(1000);
  });

  it("mappingContainerKey still trims the blanks BEFORE the colon, and leaves a scalar value's line alone", () => {
    expect(mappingContainerKey("  a \t :")).toBe("a");
    expect(mappingContainerKey("a \t : v")).toBeNull();
  });

  // The container scan calls `mappingContainerKey` only for a COLUMN-0 key (`project-yaml.ts`), so the run goes on a column-0 container; an indented one
  // reaches nothing but the key trim of `findProjectConfigValueLines`, which the plain row above already pins.
  it("findProjectConfigValueLines reads a column-0 `_quarto.yml` container whose key holds a 100,000-space run in linear time (the scan calls mappingContainerKey)", () => {
    const { result, ms } = timed(() => findProjectConfigValueLines(`a${run}b:\n  c: v\n`));
    expect(result).toEqual([]);
    expect(ms).toBeLessThan(1000);
  });

  it("findNestedFrontMatterValueLines reads a nested front matter key holding a 100,000-space run in linear time and keeps the key and the value range exact", () => {
    const text = ["---", "execute:", `  a${run}b: v`, "---", ""].join("\n");
    const { result, ms } = timed(() => findNestedFrontMatterValueLines(text));
    expect(result).toEqual([{ line: 2, parentPath: ["execute"], key: `a${run}b`, valueRange: { startCol: 100000 + 6, endCol: 100000 + 7 }, rawToken: "v" }]);
    expect(ms).toBeLessThan(1000);
  });

  it("findNestedFrontMatterValueLines still trims the blanks BEFORE the colon off a nested front matter key", () => {
    const text = ["---", "execute:", "  echo \t : banana", "---", ""].join("\n");
    expect(findNestedFrontMatterValueLines(text)).toEqual([{ line: 2, parentPath: ["execute"], key: "echo", valueRange: { startCol: 11, endCol: 17 }, rawToken: "banana" }]);
  });
});

describe("Session 312 — a key that ends in a no-break space keeps it, at each of the eight trim sites", () => {
  // YAML trims a space or a tab off a key and nothing else, so `echo<NBSP>` is NOT the key `echo`. `trimEnd()` would strip it, and swapping any one
  // site to `trimEnd()` is observable: a cell option `echo<NBSP>: banana` would be flagged as a wrong value for `echo` (a false positive), and a
  // front matter `engine<NBSP>: knitr` would change the resolver's verdict. Each expectation is what the parent answered, byte for byte.
  const NBSP = "\u00a0";
  const nestedText = ["---", "execute:", `  echo${NBSP}: v`, "---", ""].join("\n");

  it("findFrontMatterTopLevelLines (yaml-frontmatter-values.ts)", () => {
    expect(findFrontMatterTopLevelLines(["---", `echo${NBSP}: v`, "---", ""].join("\n"))).toEqual([
      { line: 1, key: `echo${NBSP}`, valueRange: { startCol: 7, endCol: 8 }, rawToken: "v", hasChildren: false },
    ]);
  });

  it("topLevelSlots (yaml-context.ts, the top-level key slot), and it still trims the blanks BEFORE the colon", () => {
    expect(topLevelSlots(`echo${NBSP}: v`)).toEqual({ keySlot: { startCol: 0, endCol: 5 }, valueSlot: { startCol: 7, endCol: 8 } });
    expect(topLevelSlots("echo \t : v")).toEqual({ keySlot: { startCol: 0, endCol: 4 }, valueSlot: { startCol: 9, endCol: 10 } });
  });

  it("findNestedFrontMatterValueLines (yaml-frontmatter-nested-values.ts)", () => {
    expect(findNestedFrontMatterValueLines(nestedText)).toEqual([
      { line: 2, parentPath: ["execute"], key: `echo${NBSP}`, valueRange: { startCol: 9, endCol: 10 }, rawToken: "v" },
    ]);
  });

  it("completionContextAt (yaml-context.ts, the nested key slot)", () => {
    expect(completionContextAt(nestedText, nestedText.indexOf("  echo") + 3, () => undefined)).toEqual({
      kind: "frontmatter-key",
      parentPath: ["execute"],
      token: "e",
      replaceRange: { line: 2, startCol: 2, endCol: 7 },
    });
  });

  it("mappingContainerKey (yaml-context.ts)", () => {
    expect(mappingContainerKey(`echo${NBSP}:`)).toBe(`echo${NBSP}`);
  });

  it("findProjectConfigKeyLines (project-yaml.ts)", () => {
    expect(findProjectConfigKeyLines(`project:\n  echo${NBSP}: v\n`)).toEqual([
      { line: 1, container: "project", key: `echo${NBSP}`, keyRange: { startCol: 2, endCol: 7 } },
    ]);
  });

  it("findProjectConfigValueLines (project-yaml.ts)", () => {
    expect(findProjectConfigValueLines(`echo${NBSP}: v\n`)).toEqual([
      { line: 0, container: "document", path: [], key: `echo${NBSP}`, valueRange: { startCol: 7, endCol: 8 }, rawToken: "v" },
    ]);
  });

  it("valueFlags (yaml-value-flags.ts, a cell option key): `echo<NBSP>` is not the option `echo`, so nothing is flagged", () => {
    const text = ["```{python}", `#| echo${NBSP}: banana`, "x = 1", "```", ""].join("\n");
    expect(valueFlags(collectValueSources(text), "a.qmd", CURATED_SCHEMA_INDEX)).toEqual({ cell: [], frontMatter: [], nested: [] });
  });
});

describe("Session 313 — a long run of spaces after the language word of a code-cell header that does not match", () => {
  // The option tail of a code-cell header, `( *[ ,].*)?\}\s*$`, was retried from every space of a run: the ` *` gave back one space at a time and `.*`
  // re-read the rest each time, so a header that FAILS to match (no closing brace, or text after it) cost time proportional to the square of the run.
  // 32,000 spaces took `findHeadings` 7.1 s and the engine resolver 9.5 s in a fresh process (about 2.4 s for each of the four literals on its own;
  // START_CODE_CELL is reached twice, and the resolver's engine-blind scan is cached per text, so a second entry on the SAME text pays less).
  // Four literals carry the tail; each entry below reaches one, and every row has its own heading so the cache never answers for another row.
  // 100,000 spaces: the old spelling takes about 25 s per literal (a regression fails slowly, never silently), and the linear one a few milliseconds.
  const RUN = 100000;
  const shapes: [string, (heading: string) => string][] = [
    ["no closing brace", (heading) => "```{r" + " ".repeat(RUN) + "x\n```\n\n# " + heading + "\n"],
    ["text after the closing brace", (heading) => "```{r" + " ".repeat(RUN) + "} x\n```\n\n# " + heading + "\n"],
  ];
  const entries: [string, (text: string) => unknown, (heading: string) => unknown][] = [
    ["quartoYamlRegions (START_CODE_CELL)", (text) => quartoYamlRegions(text), () => []],
    ["findHeadings (CELL_INFO)", (text) => findHeadings(text), (heading) => [{ level: 1, text: heading, line: 3 }]],
    ["findHeadings on a knitr document (KNITR_CHUNK_INFO)", (text) => findHeadings(text, "knitr"), (heading) => [{ level: 1, text: heading, line: 3 }]],
    ["the engine resolver (languagesInMarkdown)", (text) => resolveDocumentEngine("a.qmd", text), () => "markdown"],
  ];

  describe.each(shapes)("a header with %s", (shape, build) => {
    it.each(entries)("%s reads a 100,000-space run in linear time and keeps its answer", (entry, run, expected) => {
      const heading = `H ${shape} ${entry}`;
      const { result, ms } = timed(() => run(build(heading)));
      expect(result).toEqual(expected(heading));
      expect(ms).toBeLessThan(1000);
    });
  });
});

describe("Session 314 — a long run of spaces INSIDE a value the model trims at both ends", () => {
  // `asciiTrim` was `.replace(/^[ \t]+|[ \t]+$/g, "")`: its `[ \t]+$` half is retried from every space of a run that is followed by a letter,
  // so a value holding a run of spaces cost time proportional to the square of the run. With `from: gfm` or `from: commonmark_x` (the readers
  // whose front matter the `from:` proof reads) EVERY top-level line reaches it, and a `from:` line reaches it three times (64,000 spaces took
  // `findHeadings` 7.1 s for `from: gfm<run>x` and 2.4 s for `key: a<run>b`, a CPU profile 98% in the one regex). `trim()` is NOT the cure:
  // it also strips a no-break space and every other Unicode space, which YAML does not (`ascii-trim.test.ts` holds the oracle).
  const run = " ".repeat(100000);
  // The limit is 250 ms, not the file's usual 1,000: the linear spelling takes 1 to 8 ms (7.2 ms the worst cold run at load 36 to 54) and the regex 6 to 18 s, and a
  // spelling that is still quadratic at 1/25 of the regex's cost would pass a one-call row at 1,000 ms.

  it("findHeadings reads a `from: gfm` line whose value holds a 100,000-space run in linear time", () => {
    const text = ["---", `from: gfm${run}x`, "---", "", "# H", ""].join("\n");
    const { result, ms } = timed(() => findHeadings(text));
    expect(result).toEqual([{ level: 1, text: "H", line: 4 }]);
    expect(ms).toBeLessThan(250);
  });

  it("findHeadings reads another top-level value holding a 100,000-space run, under `from: gfm`, in linear time", () => {
    const text = ["---", "from: gfm", `title: a${run}b`, "---", "", "# H", ""].join("\n");
    const { result, ms } = timed(() => findHeadings(text));
    expect(result).toEqual([{ level: 1, text: "H", line: 5 }]);
    expect(ms).toBeLessThan(250);
  });

  // The chunk-header slot reader (`knitrChunkHeaderLabel`) carried its own copy of the same trim, on the one UNNAMED slot (`{r, a<run>b}`).
  it("knitrChunkHeaderLabel reads an unnamed chunk-header slot holding a 100,000-space run in linear time", () => {
    const { result, ms } = timed(() => knitrChunkHeaderLabel(`\`\`\`{r, a${run}b}`));
    expect(result).toBeNull();
    expect(ms).toBeLessThan(250);
  });

  it("the label index reads a knitr chunk header whose unnamed slot holds a 100,000-space run in linear time", () => {
    const { result, ms } = timed(() => indexLabels(`\`\`\`{r, a${run}b}\n1\n\`\`\`\n`, "knitr"));
    expect(result).toEqual([]);
    expect(ms).toBeLessThan(250);
  });
});

describe("Session 314 — thousands of sibling keys under a nested front matter container", () => {
  // `findNestedFrontMatterValueLines` asks `nestedParentPath` for the container of EVERY nested line, and the ancestor walk looked for the nearest
  // shallower line by scanning upward past every same-indent sibling (and, one level up, past every earlier sibling BLOCK), so n keys under
  // `format:` / `html:` cost time proportional to n squared: 2,000 / 4,000 / 8,000 keys took 118 / 413 / 1,523 ms, a CPU profile 28% in
  // `leadingWsLen` and 27% in `nearestShallowerLine`. The engine resolver reads this on every cross-reference request.
  const SIBLINGS = 16000;
  const BLOCKS = 8000;
  const siblingKeys = (n: number): string => Array.from({ length: n }, (_, i) => `    k${i}: v`).join("\n");
  const siblingBlocks = (n: number): string => Array.from({ length: n }, (_, i) => `    o${i}:\n      k: v`).join("\n");
  const document = (body: string, after = ""): string => `---\nformat:\n  html:\n${body}\n${after}---\n\ntext\n`;

  it("pins the small answer first: three sibling keys, then three sibling blocks", () => {
    const entry = (line: number, parentPath: string[], key: string): unknown => ({ line, parentPath, key, valueRange: { startCol: parentPath.length === 2 ? 8 : 9, endCol: parentPath.length === 2 ? 9 : 10 }, rawToken: "v" });
    expect(findNestedFrontMatterValueLines(document(siblingKeys(3)))).toEqual([0, 1, 2].map((i) => entry(3 + i, ["format", "html"], `k${i}`)));
    expect(findNestedFrontMatterValueLines(document(siblingBlocks(3)))).toEqual([0, 1, 2].map((i) => entry(4 + 2 * i, ["format", "html", `o${i}`], "k")));
  });

  it("findNestedFrontMatterValueLines reads 16,000 sibling keys under format / html in linear time", () => {
    const { result, ms } = timed(() => findNestedFrontMatterValueLines(document(siblingKeys(SIBLINGS))));
    expect(result).toHaveLength(SIBLINGS);
    expect(result[0]).toMatchObject({ line: 3, parentPath: ["format", "html"], key: "k0", rawToken: "v" });
    expect(result[SIBLINGS - 1]).toMatchObject({ line: 3 + SIBLINGS - 1, parentPath: ["format", "html"], key: `k${SIBLINGS - 1}`, rawToken: "v" });
    expect(ms).toBeLessThan(1000);
  });

  it("findNestedFrontMatterValueLines reads 8,000 sibling mapping blocks under format / html in linear time", () => {
    const { result, ms } = timed(() => findNestedFrontMatterValueLines(document(siblingBlocks(BLOCKS))));
    expect(result).toHaveLength(BLOCKS);
    expect(result[0]).toMatchObject({ line: 4, parentPath: ["format", "html", "o0"], key: "k" });
    expect(result[BLOCKS - 1]).toMatchObject({ line: 4 + 2 * (BLOCKS - 1), parentPath: ["format", "html", `o${BLOCKS - 1}`], key: "k" });
    expect(ms).toBeLessThan(1000);
  });

  // The engine resolver reads ONE nested key, `engine:` under `execute:`; a nested `engine: knitr` AFTER thousands of siblings answers "knitr" only if the
  // enumeration reaches the last line (a top-level `engine:` would answer it whatever the enumerator returned).
  const executeDocument = (body: string): string => `---\nexecute:\n${body}\n  engine: knitr\n---\n\ntext\n`;

  it("the engine resolver reads 16,000 sibling keys under execute, then a nested engine, in linear time (the reported path)", () => {
    const { result, ms } = timed(() => resolveDocumentEngine("a.qmd", executeDocument(Array.from({ length: SIBLINGS }, (_, i) => `  k${i}: v`).join("\n"))));
    expect(result).toBe("knitr");
    expect(ms).toBeLessThan(1000);
  });

  it("the engine resolver reads 8,000 sibling mapping blocks under execute, then a nested engine, in linear time", () => {
    const { result, ms } = timed(() => resolveDocumentEngine("a.qmd", executeDocument(Array.from({ length: BLOCKS }, (_, i) => `  o${i}:\n    k: v`).join("\n"))));
    expect(result).toBe("knitr");
    expect(ms).toBeLessThan(1000);
  });

  it("findNestedFrontMatterValueLines reads 16,000 indented keys that sit under NO column-0 container in linear time", () => {
    // No line has a shallower line above it, so the index answers -1 for every one; a fallback to the upward scan on -1 would be quadratic here (the parent was).
    const { result, ms } = timed(() => findNestedFrontMatterValueLines(`---\n${Array.from({ length: SIBLINGS }, (_, i) => `  k${i}: v`).join("\n")}\n---\n\ntext\n`));
    expect(result).toEqual([]);
    expect(ms).toBeLessThan(1000);
  });
});

describe("Session 317 — a single line of two million or more thematic-break characters", () => {
  // The thematic-break patterns read the run as a QUANTIFIED GROUP, `(-[ \t]*){3,}` (and the `*` and `_` spellings), and V8 keeps one entry of its regex
  // backtrack stack per repetition of a group: 2,000,000 characters of `-`, `*` or `_` are read, 2,100,000 overflow the stack and `test` throws
  // `RangeError: Maximum call stack size exceeded` (measured, Session 317). It is thrown from `scanRegions` (here through `opensFreshBlock`), so EVERY reader
  // of the document (the Outline, the front matter, the engine resolver, the label index) answers nothing for it: the same class as the five million
  // backticks of Session 311, in another pattern (the BACKLOG item "What is still quadratic or deep enough to overflow after Session 311", part (8)).
  const run = (unit: string, characters: number): string => unit.repeat(Math.ceil(characters / unit.length));
  const bodyLine = (line: string): string => `Intro.\n\n${line}\n\n# H\n`;

  // 2,100,000 is the BACKLOG item's figure; 4,500,000 clears the second family, the non-capturing `(?:-[ \t]*){3,}` of `BULLET_THEMATIC_BREAK`, which overflows
  // later (about 3,360,000 characters) because each repetition costs it a smaller entry.
  for (const characters of [2_100_000, 4_500_000]) {
    it.each(["-", "*", "_"])(`a body line of ${characters.toLocaleString("en-US")} \`%s\` is read by the Outline without throwing, and like a shorter run of the same shape`, (mark) => {
      const shorter = findHeadings(bodyLine(run(mark, 2000))).map((h) => h.text);
      let found: string[] = [];
      expect(() => {
        found = findHeadings(bodyLine(run(mark, characters))).map((h) => h.text);
      }).not.toThrow();
      expect(found).toEqual(shorter);
    });
  }

  // Under a `from: commonmark` reader a line directly below a paragraph is tested against `COMMONMARK_PARAGRAPH_INTERRUPT`, which spells the break a third way
  // (`^[ \t]*` indent, not ` {0,3}`) and was the same quantified group. `-` is left out: directly under a paragraph a run of dashes is its setext underline.
  const underParagraph = (line: string): string => `---\nfrom: commonmark\n---\n\nIntro.\n${line}\n# H\n`;

  for (const characters of [2_100_000, 4_500_000]) {
    it.each(["*", "_"])(`a line of ${characters.toLocaleString("en-US")} \`%s\` directly under a paragraph of a from: commonmark document is read without throwing, and like a shorter run`, (mark) => {
      const shorter = findHeadings(underParagraph(run(mark, 2000))).map((h) => h.text);
      let found: string[] = [];
      expect(() => {
        found = findHeadings(underParagraph(run(mark, characters))).map((h) => h.text);
      }).not.toThrow();
      expect(found).toEqual(shorter);
    });
  }

  // A break spelled with blanks between the markers is a different run of the same bytes: `- - - -` is the column line of a pandoc simple table, a bullet-spelled break, or
  // a ONE-column table's dash line when indented, so `DASH_COLUMN_LINE` and `DASH_ONLY_LINE` read it with a group per dash run, `(?:[ \t]+-+)+`. The item cites 4.5 million
  // characters of `- `, which is 2,250,000 repetitions.
  const SPACED_UNITS = ["- ", "-\t", " -", "* ", "_ "];
  it.each(SPACED_UNITS)("a body line of 4,500,000 characters of %j is read by the Outline without throwing, and like a shorter run of the same shape", (unit) => {
    const shorter = findHeadings(bodyLine(run(unit, 2000))).map((h) => h.text);
    let found: string[] = [];
    expect(() => {
      found = findHeadings(bodyLine(run(unit, 4_500_000))).map((h) => h.text);
    }).not.toThrow();
    expect(found).toEqual(shorter);
  });

  // Every row above is a line the patterns ACCEPT. The rewrite must also stay linear where the line is not a break: `-+[ \t-]*` matches the same strings as `-[ \t-]*`, but with a
  // letter at the end it retries the tail from every split of the run, which is quadratic and which the equivalence enumeration (7 characters) cannot see. 100,000 characters
  // take about 2 ms read linearly and several seconds read that way, so the 1 s limit has a wide margin both ways.
  const NOT_A_BREAK_UNITS = ["-", "*", "_", "- ", "-\t", " -", "* ", "_ "];
  it.each(NOT_A_BREAK_UNITS)("a body line of 100,000 characters of %j that ends in a letter is read in linear time, and like a shorter run", (unit) => {
    const shorter = findHeadings(bodyLine(`${run(unit, 2000)}x`)).map((h) => h.text);
    const { result, ms } = timed(() => findHeadings(bodyLine(`${run(unit, 100_000)}x`)).map((h) => h.text));
    expect(result).toEqual(shorter);
    expect(ms).toBeLessThan(1000);
  });

  it.each(["*", "_", "* ", "_ "])("a line of 100,000 characters of %j that ends in a letter, directly under a paragraph of a from: commonmark document, is read in linear time", (unit) => {
    const shorter = findHeadings(underParagraph(`${run(unit, 2000)}x`)).map((h) => h.text);
    const { result, ms } = timed(() => findHeadings(underParagraph(`${run(unit, 100_000)}x`)).map((h) => h.text));
    expect(result).toEqual(shorter);
    expect(ms).toBeLessThan(1000);
  });
});

describe("Session 318 — a single line that is a long run of fence characters followed by a CR or a line separator", () => {
  // `FENCE_OPEN`, `INDENTED_CELL_FENCE_OPEN` and `DIV_FENCE` read a run of fence characters and then `(.*)$`, and `.` stops at a CR, U+2028 and U+2029. A line holding one of them after the run can
  // never match, but the engine used to find that out once per way of splitting the run: it gave the run up one character at a time and `(.*)` re-read what was given back, which is quadratic (the
  // BACKLOG item "What is still quadratic or deep enough to overflow after Session 311", part (7): a document with 32,000 backticks then CR took 1.2 s to read, 64,000 took 4.9 s). A lone CR is the
  // form that reaches a line: a CRLF is split off before any pattern runs (32,000 backticks then CRLF took 14 ms), so the CR is followed by a letter here. One `exec` of an old pattern on 100,000
  // backticks took 6 s and a document took 12 s, because a backtick line is tried by two of them; tildes and the colons of a list item are tried by one at a time and take 6 s. Read linearly it is a few
  // milliseconds, so the 1 s limit has a wide margin both ways. Session 318 timed 1,470 shapes (unit, terminator, 14 contexts, sizes, entry points) in each tree: 760 took 0.5 s or more on the parent
  // and none on the fixed tree (slowest 41 ms); the map is in the session's notes, not in the repo.
  const PS = String.fromCharCode(0x2029);
  const run = (unit: string, characters: number): string => unit.repeat(Math.ceil(characters / unit.length));
  const bodyLine = (line: string): string => `Intro.\n\n${line}\n\n# H\n`;

  const UNITS: [string, string][] = [
    ["backticks", "`"],
    ["tildes", "~"],
    ["colons", ":"],
  ];
  const TERMINATORS: [string, string][] = [
    ["a CR and a letter", "\rx"],
    ["U+2028", LS],
    ["U+2029", PS],
  ];

  it.each(UNITS.flatMap(([unitName, unit]) => TERMINATORS.map(([terminatorName, terminator]) => [unitName, terminatorName, unit, terminator])))(
    "a body line of 100,000 %s and then %s is read by the Outline in linear time, and like a shorter run of the same shape",
    (_unitName, _terminatorName, unit, terminator) => {
      const shorter = findHeadings(bodyLine(`${run(unit, 2000)}${terminator}`)).map((h) => h.text);
      const { result, ms } = timed(() => findHeadings(bodyLine(`${run(unit, 100_000)}${terminator}`)).map((h) => h.text));
      expect(result).toEqual(shorter);
      expect(ms).toBeLessThan(1000);
    },
  );

  // The same line reached by another path. Timing each call on the parent shows that every context below reaches the same call sites, `fenceMatchAt` (`FENCE_OPEN`), `indentedCellFenceAt`
  // (`INDENTED_CELL_FENCE_OPEN`) and `divFenceRole` (`DIV_FENCE`, on the line and again with a list or quote marker stripped), so the rows guard the PATHS to them and not separate patterns. Only two
  // differ: in a list item the line's own try fails fast and only the marker-stripped retry is slow (a backtick line there is not slow at all), and above a dash row a simple table's header is
  // tried against `SIMPLE_TABLE_HEADER_OUTRANKED`, a fourth call site that holds `FENCE_OPEN` and `DIV_FENCE` (not the indented opener).
  const CONTEXTS: [string, (line: string) => string, "knitr" | undefined, string[]][] = [
    ["indented four columns", (line) => `Intro.\n\n    ${line}\n\n# H\n`, undefined, ["`", ":"]],
    ["inside a list item", (line) => `Intro.\n\n- ${line}\n\n# H\n`, undefined, [":"]], // a backtick fence in a list item never reached the slow patterns (measured)
    ["inside a block quote", (line) => `Intro.\n\n> ${line}\n\n# H\n`, undefined, ["`", ":"]],
    ["directly under a paragraph of a from: commonmark document", (line) => `---\nfrom: commonmark\n---\n\nIntro.\n${line}\n# H\n`, undefined, ["`", ":"]],
    ["in a knitr document", bodyLine, "knitr", ["`", ":"]],
    ["above a dash row, where a simple table's header is tried against the outranked list", (line) => `Intro.\n\n${line}\n ---\n# H\n`, undefined, ["~", ":"]],
  ];

  it.each(CONTEXTS.flatMap(([where, build, engine, units]) => units.map((unit) => [where, build, engine, unit] as const)))(
    "a line of 100,000 characters of a fence marker and then U+2028, %s, is read by the Outline in linear time, and like a shorter run (%#)",
    (_where, build, engine, unit) => {
      const shorter = findHeadings(build(`${run(unit, 2000)}${LS}`), engine).map((h) => h.text);
      const { result, ms } = timed(() => findHeadings(build(`${run(unit, 100_000)}${LS}`), engine).map((h) => h.text));
      expect(result).toEqual(shorter);
      expect(ms).toBeLessThan(1000);
    },
  );

  // Every other reader of a document goes through the same scan, which `scanRegions` memoizes for the last two documents it read (keyed on text, engine and mode): each row below therefore reads a
  // document of its own (the intro line differs), or it would be handed the answer the row before it paid for and pass on the parent without reading the line at all (measured: three of these four did).
  it.each([
    ["indexLabels", (text: string) => indexLabels(text)],
    ["resolveDocumentEngine", (text: string) => resolveDocumentEngine("a.qmd", text)],
    ["findAllCells", (text: string) => findAllCells(text)],
    ["findCodeFenceOpeners", (text: string) => findCodeFenceOpeners(text)],
  ])("%s reads a document with a body line of 100,000 backticks and then U+2028 in linear time", (name, read) => {
    const { ms } = timed(() => read(`Intro of ${name}.\n\n${run("`", 100_000)}${LS}\n\n# H\n`));
    expect(ms).toBeLessThan(1000);
  });
});

describe("Session 319 — a long run of blanks followed by a CR, U+2028 or U+2029 in a line a pattern reads to its end", () => {
  // The BACKLOG item "Other regexes still quadratic on a long run of blanks, CR or U+2028", parts (5) and (9). A pattern of the shape `X[ \t]*(.*)$` (or `[ \t]+(.+)$`) reads a run of blanks and then a tail
  // to the end of the line, and `.` stops at a CR, U+2028 and U+2029: a line holding one of them after the run can never match, but the engine used to find that out once per way of splitting the run
  // (it gave the blanks back one at a time and `(.*)` re-read what was given back), which is quadratic. 32,000 blanks then CR took 0.6 s in one `exec` and 100,000 took 6 s (Session 319, bare `exec`, 8,000 /
  // 16,000 / 32,000 blanks: 38 / 154 / 616 ms). A lone CR is the form that reaches a line: a CRLF is split off before any pattern runs, so the CR is followed by a letter here. Read linearly each row
  // is a few milliseconds, so the 1 s limit has a wide margin both ways. `scanRegions` memoizes the last two documents it read, so every row's document carries its own name.
  const PS = String.fromCharCode(0x2029);
  const CR_AND_LETTER = ["a CR and a letter", "\rx"] as const;
  const LINE_SEPARATOR = ["U+2028", LS] as const;
  const PARAGRAPH_SEPARATOR = ["U+2029", PS] as const;
  // The size of the run, the shorter run it is compared with, and the limit: a quadratic spelling takes 5 to 23 s at 100,000, so the 1 s limit has a wide margin both ways.
  const RUN = 100_000;
  const SHORT_RUN = 2_000;
  const LIMIT_MS = 1000;
  type Terminator = readonly [string, string];
  type Row = { site: string; run?: string; terminators: readonly Terminator[]; build: (blanks: string, terminator: string) => string; read: (text: string) => unknown };

  const ROWS: Row[] = [
    {
      site: "DIV_FENCE (a div fence followed by blanks)",
      terminators: [CR_AND_LETTER, LINE_SEPARATOR, PARAGRAPH_SEPARATOR],
      build: (blanks, terminator) => `Intro of DIV_FENCE.\n\n:::${blanks}${terminator}\n\n# H\n`,
      read: (text) => findHeadings(text).map((h) => h.text),
    },
    {
      site: "DIV_FENCE (as the header of a simple table, tried against the outranked list)",
      terminators: [CR_AND_LETTER, LINE_SEPARATOR, PARAGRAPH_SEPARATOR],
      build: (blanks, terminator) => `Intro of DIV_FENCE in a table.\n\n:::${blanks}${terminator}\n ---\n# H\n`,
      read: (text) => findHeadings(text).map((h) => h.text),
    },
    {
      site: "ATX_HEADING (hashes, then blanks)",
      terminators: [CR_AND_LETTER, LINE_SEPARATOR, PARAGRAPH_SEPARATOR],
      build: (blanks, terminator) => `Intro of ATX_HEADING.\n\n# ${blanks}${terminator}\n\n# H\n`,
      read: (text) => findHeadings(text).map((h) => h.text),
    },
    {
      site: "ATX_HEADING (as the header of a simple table, tried against the outranked list)",
      terminators: [CR_AND_LETTER, LINE_SEPARATOR, PARAGRAPH_SEPARATOR],
      build: (blanks, terminator) => `Intro of ATX_HEADING in a table.\n\n# ${blanks}${terminator}\n ---\n# H\n`,
      read: (text) => findHeadings(text).map((h) => h.text),
    },
    {
      site: "ATX_HEADING_TIGHT (a reader whose space after the hashes is optional)",
      terminators: [CR_AND_LETTER, LINE_SEPARATOR, PARAGRAPH_SEPARATOR],
      build: (blanks, terminator) => `---\nfrom: markdown-space_in_atx_header\n---\n\nIntro of ATX_HEADING_TIGHT.\n\n# ${blanks}${terminator}\n\n# H\n`,
      read: (text) => findHeadings(text).map((h) => h.text),
    },
    {
      site: "the front matter's key line in the `from:` proof (`key:` and blanks; only U+2028 and U+2029 reach it, a lone CR is refused first)",
      terminators: [LINE_SEPARATOR, PARAGRAPH_SEPARATOR],
      build: (blanks, terminator) => `---\nfrom: commonmark\nk:${blanks}${terminator}x\n---\n\nIntro of the proof key line.\n\n# H\n`,
      read: (text) => findHeadings(text).map((h) => h.text),
    },
    {
      site: "PLAIN_KEY_LINE (`key:` and blanks in a plain front matter; only a lone CR reaches it)",
      terminators: [CR_AND_LETTER],
      build: (blanks, terminator) => `---\nk:${blanks}${terminator}\n---\n# H of PLAIN_KEY_LINE\n`,
      read: (text) => plainFrontMatter(text),
    },
    {
      site: "PLAIN_ITEM_LINE (`- ` and blanks in a plain front matter; only a lone CR reaches it)",
      terminators: [CR_AND_LETTER],
      build: (blanks, terminator) => `---\n- ${blanks}${terminator}\n---\n# H of PLAIN_ITEM_LINE\n`,
      read: (text) => plainFrontMatter(text),
    },
    {
      site: "the knitr document default `echo:` followed by blanks",
      terminators: [CR_AND_LETTER, LINE_SEPARATOR, PARAGRAPH_SEPARATOR],
      build: (blanks, terminator) => `---\necho:${blanks}${terminator}\n---\n\nIntro of the echo default.\n\n# H\n`,
      read: (text) => findHeadings(text, "knitr").map((h) => h.text),
    },
    {
      site: "linkDefinitionAt (`[a]:` and blanks, then a dash row)",
      terminators: [CR_AND_LETTER, LINE_SEPARATOR, PARAGRAPH_SEPARATOR],
      build: (blanks, terminator) => `Intro of the link definition.\n\n[a]:${blanks}${terminator}x\n- - -\n\n# H\n`,
      read: (text) => findHeadings(text).map((h) => h.text),
    },
    {
      site: "the cell option prefix (`#|` and blanks at the head of a code cell)",
      terminators: [CR_AND_LETTER, LINE_SEPARATOR, PARAGRAPH_SEPARATOR],
      build: (blanks, terminator) => `Intro of the cell option prefix.\n\n\`\`\`{python}\n#|${blanks}${terminator}x\n\`\`\`\n`,
      read: (text) => findCellOptionLines(text).length,
    },
    {
      site: "the bibliography list item (`-`, blanks, a word, then the terminator: `\\s` takes a CR that comes right after the blanks, so the terminator follows a word)",
      terminators: [CR_AND_LETTER, LINE_SEPARATOR, PARAGRAPH_SEPARATOR],
      build: (blanks, terminator) => `---\ntitle: a\nbibliography:\n-${blanks}y${terminator}\n---\nbody of the bibliography item\n`,
      read: (text) => bibliographyPaths(text),
    },
    {
      site: "the format list item in the preview's declared formats (`-`, blanks, then the terminator)",
      terminators: [CR_AND_LETTER, LINE_SEPARATOR, PARAGRAPH_SEPARATOR],
      build: (blanks, terminator) => `---\ntitle: a\nformat:\n  -${blanks}${terminator}\n---\nbody of the format list item\n`,
      read: (text) => parseDeclaredFormats(text),
    },
    {
      site: "KEY_LINE in the jupyter reader (`k:` and blanks in a front matter line)",
      terminators: [CR_AND_LETTER, LINE_SEPARATOR, PARAGRAPH_SEPARATOR],
      build: (blanks, terminator) => `title: a\nk:${blanks}${terminator}`,
      read: (text) => jupyterKernelLanguage(text.split("\n"), []),
    },
    {
      site: "the indent split of a nested front matter line (a line of blanks, then the terminator, under `title:`)",
      terminators: [CR_AND_LETTER, LINE_SEPARATOR, PARAGRAPH_SEPARATOR],
      build: (blanks, terminator) => `---\ntitle: a\n${blanks}${terminator}\n---\nbody of the nested line\n`,
      read: (text) => completionContextAt(text, 14, () => undefined),
    },
    // `TOP_LEVEL_ANCHOR_DECL` is read only for a front matter whose `from:` is an ALIAS (`*a`), on every top-level line until the anchor is found. It holds TWO quadratics: the tail (the blanks
    // after `&name`, as above) and the KEY, `[^:]*` then `[ \t]*` then `:`, where a blank run the key swallows can be re-split between the two classes and NO terminator is needed.
    {
      site: "TOP_LEVEL_ANCHOR_DECL, the tail (`k: &a`, blanks, then the terminator)",
      terminators: [CR_AND_LETTER, LINE_SEPARATOR, PARAGRAPH_SEPARATOR],
      build: (blanks, terminator) => `---\nfrom: *a\nk: &a${blanks}${terminator}\n---\n\nIntro of the anchor tail.\n\n# H\n`,
      read: (text) => findHeadings(text).map((h) => h.text),
    },
    {
      site: "TOP_LEVEL_ANCHOR_DECL, the key (a top-level word and a long blank run, no colon)",
      terminators: [["nothing", ""]],
      build: (blanks, terminator) => `---\nfrom: *a\nkx${blanks}${terminator}\n---\n\nIntro of the anchor key.\n\n# H\n`,
      read: (text) => findHeadings(text).map((h) => h.text),
    },
    {
      site: "TOP_LEVEL_ANCHOR_DECL, the key (a word, a long blank run, a colon, and no anchor after it)",
      terminators: [["nothing", ""]],
      build: (blanks, terminator) => `---\nfrom: *a\nk${blanks}: x${terminator}\n---\n\nIntro of the anchor colon.\n\n# H\n`,
      read: (text) => findHeadings(text).map((h) => h.text),
    },
    {
      // No CR row: `TABLE_RULE_ROW` embeds the same delimiter-row alternation followed by `\s*$`, and a CR and a letter after the blanks reach IT (12 s with PIPE_DELIMITER_ROW already fixed). That pattern is
      // part (4) of the same BACKLOG item and has its own session; its cure is this pattern's new spelling (no two blank runs touch).
      site: "PIPE_DELIMITER_ROW (a pipe table's delimiter row, a long blank run inside it)",
      terminators: [LINE_SEPARATOR, PARAGRAPH_SEPARATOR],
      build: (blanks, terminator) => `Intro of the delimiter row.\n\na|b\n|-${blanks}|${terminator}\n***\n\n# H\n`,
      read: (text) => findHeadings(text).map((h) => h.text),
    },
    // The unanchored sibling, part (9): `text.replace(/[ \t]#.*$/, "")` is retried at every ` #` pair when a terminator follows, so the run is made of pairs (each BLANK of the row's
    // run becomes one ` #`, which is why these rows are twice as long as the others). A lone CR is refused before the proof reads a value, so only U+2028 and U+2029 reach the first row.
    {
      site: "proofValue's comment strip (a list item of ` #` pairs under a from: commonmark front matter)",
      run: "` #` pairs",
      terminators: [LINE_SEPARATOR, PARAGRAPH_SEPARATOR],
      build: (blanks, terminator) => `---\nfrom: commonmark\nlist:\n  - a${" #".repeat(blanks.length)}${terminator}\n---\n\nIntro of the proof value.\n\n# Heading\n`,
      read: (text) => findHeadings(text).map((h) => h.text),
    },
    {
      site: "isWrongNumber's comment strip (` #` pairs after a number)",
      run: "` #` pairs",
      terminators: [CR_AND_LETTER, LINE_SEPARATOR, PARAGRAPH_SEPARATOR],
      build: (blanks, terminator) => `1${" #".repeat(blanks.length)}${terminator}`,
      read: (text) => isWrongValue(text, { name: "fig-width", scalarType: "number" }),
    },
    {
      site: "isWrongNumericMember's comment strip (` #` pairs after a member of a numeric enum)",
      run: "` #` pairs",
      terminators: [CR_AND_LETTER, LINE_SEPARATOR, PARAGRAPH_SEPARATOR],
      build: (blanks, terminator) => `1${" #".repeat(blanks.length)}${terminator}`,
      read: (text) => isWrongValue(text, { name: "aspectratio", valuesClosed: true, values: ["43", "169"], numericMemberEnum: true }),
    },
  ];

  it.each(ROWS.flatMap((row) => row.terminators.map(([terminatorName, terminator]) => [row.site, row.run ?? "blanks", terminatorName, row, terminator] as const)))(
    "%s: 100,000 %s and then %s is read in linear time, and like a shorter run of the same shape",
    (_site, _run, _terminatorName, row, terminator) => {
      const shorter = row.read(row.build(" ".repeat(SHORT_RUN), terminator));
      const { result, ms } = timed(() => row.read(row.build(" ".repeat(RUN), terminator)));
      expect(result).toEqual(shorter);
      expect(ms).toBeLessThan(LIMIT_MS);
    },
  );

  // A row run at 1,000 blanks, or allowed 100 s, would pass on the parent too.
  it("keeps the run, the shorter run and the limit its rows are built on", () => {
    expect([RUN, SHORT_RUN, LIMIT_MS]).toEqual([100_000, 2_000, 1000]);
  });
});

describe("Session 320 — a long run of blanks in a rule row or a closing run", () => {
  // `TABLE_RULE_ROW` and `PIPE_DELIMITER_ROW`, named below as the sites of these rows, are the functions `tableRuleRow` and `pipeDelimiterRow` since Session 335; a row still reads the site through `findHeadings`.
  // The BACKLOG item "Other regexes still quadratic on a long run of blanks, CR or U+2028", part (4). A pattern that reads a run of blanks and then ends the match on a character the run cannot give back
  // is quadratic in two ways: two atoms over overlapping classes with nothing between them (`TABLE_RULE_ROW`'s `[ \t]*` then `\s*`, and `[-+=: ]*` then `\s*`) re-split the run for ANY character that ends
  // the match, and an unanchored search that begins with `[ \t]+` is retried from every blank inside the run. Bare `exec`, 8,000 / 16,000 / 32,000 blanks (Session 320, fresh process, minimum of 5): 38 / 154
  // / 617 ms for `TABLE_RULE_ROW`. Every body line goes through `TABLE_RULE_ROW.test` twice (the table opener and the line-block arm), so a document costs twice that. Read linearly each row is a few
  // milliseconds, so the 1 s limit has a wide margin both ways.
  // Named apart from the Session 319 describe's RUN / SHORT_RUN / LIMIT_MS on purpose: that session's mutation list (`b89-blank-tail-review.json`) matches their text, and the same text twice in the file
  // makes its `from` ambiguous (`mutation-lists-apply.test.ts` reds).
  const BLANK_RUN = 100_000;
  const SHORTER_RUN = 2_000;
  const CLOCK_MS = 1000;
  const headings = (text: string): string[] => findHeadings(text).map((h) => h.text);
  const knitrHeadings = (text: string): string[] => findHeadings(text, "knitr").map((h) => h.text);
  /** `needs`: the terminator a row's cost depends on (the one-hash row takes 5 ms on the parent without its U+2028 and 644 ms with it at 32,000 blanks), so the row asserts that its text holds it. */
  type Row = { site: string; run?: string; needs?: string; build: (blanks: string) => string; read: (text: string) => unknown; answer: (blanks: string) => unknown };

  const ROWS: Row[] = [
    { site: "TABLE_RULE_ROW, the pipe body (`-`, blanks, a letter)", build: (blanks) => `Intro of the pipe rule row.\n\n-${blanks}x\n\n# H\n`, read: headings, answer: () => ["H"] },
    { site: "TABLE_RULE_ROW, the pipe body (`-`, blanks, a lone CR and a letter)", needs: "\r", build: (blanks) => `Intro of the pipe rule row and a CR.\n\n-${blanks}\rx\n\n# H\n`, read: headings, answer: () => ["H"] },
    { site: "TABLE_RULE_ROW, the pipe body (`-:`, blanks, a letter)", build: (blanks) => `Intro of the pipe rule row and a colon.\n\n-:${blanks}x\n\n# H\n`, read: headings, answer: () => ["H"] },
    { site: "TABLE_RULE_ROW, the grid body (`+`, blanks, a letter)", build: (blanks) => `Intro of the grid rule row.\n\n+${blanks}x\n\n# H\n`, read: headings, answer: () => ["H"] },
    { site: "TABLE_RULE_ROW, the grid body (`+`, blanks, a lone CR and a letter)", needs: "\r", build: (blanks) => `Intro of the grid rule row and a CR.\n\n+${blanks}\rx\n\n# H\n`, read: headings, answer: () => ["H"] },
    // ATX_CLOSING is the closing run of the CommonMark-family readers (`from: gfm`, `commonmark`, `commonmark_x`): an UNANCHORED search that begins with `[ \t]+`, so it was retried from every blank of
    // a run inside the heading text. 100,000 blanks in a heading took 6 s on the parent. The pandoc readers use another spelling (`markdown` is the control row: linear before and after).
    ...(["gfm", "commonmark", "commonmark_x"] as const).map((from): Row => ({
      site: `ATX_CLOSING under from: ${from} (a heading with a long blank run inside it)`,
      build: (blanks) => `---\nfrom: ${from}\n---\n\nIntro of the closing run under ${from}.\n\n# a${blanks}b\n\n# H\n`,
      read: headings,
      answer: (blanks) => [`a${blanks}b`, "H"],
    })),
    { site: "ATX_CLOSING under from: gfm (a heading that ends in a long blank run)", build: (blanks) => `---\nfrom: gfm\n---\n\nIntro of the closing run and a trailing run.\n\n# a${blanks}\n\n# H\n`, read: headings, answer: () => ["a", "H"] },
    { site: "ATX_CLOSING under from: gfm (a hash, a long blank run, then a letter)", build: (blanks) => `---\nfrom: gfm\n---\n\nIntro of the closing run after a hash.\n\n# a #${blanks}b\n\n# H\n`, read: headings, answer: (blanks) => [`a #${blanks}b`, "H"] },
    { site: "the pandoc readers' closing run (control: `markdown`, a heading with a long blank run inside it)", build: (blanks) => `---\nfrom: markdown\n---\n\nIntro of the pandoc closing run.\n\n# a${blanks}b\n\n# H\n`, read: headings, answer: (blanks) => [`a${blanks}b`, "H"] },
    // The two `[ \t]+#.*$` strips of `knitrDocumentDefaults`, one in the reader of a mapping's `echo` / `include` lines and one in the test for a key whose value is a mapping. Unanchored searches that begin with
    // `[ \t]+`: tried from every blank of a run (no hash needed: `echo: false`, 32,000 blanks, a letter took 652 ms through `findHeadings`), and, for the second, retried at every ` #` pair when a terminator
    // follows (32,000 pairs then U+2028 took 1.19 s). A terminator in an `echo:` line is refused by the line pattern before the strip runs, so only the second strip has a pairs row.
    { site: "knitr default `echo: false` followed by a long blank run and a letter", build: (blanks) => `---\necho: false${blanks}x\n---\n\nIntro of the echo strip.\n\n# H\n`, read: knitrHeadings, answer: () => ["H"] },
    { site: "knitr default `echo: false` under execute: followed by a long blank run and a letter", build: (blanks) => `---\nexecute:\n  echo: false${blanks}x\n---\n\nIntro of the nested echo strip.\n\n# H\n`, read: knitrHeadings, answer: () => ["H"] },
    { site: "the key `execute:` followed by a long blank run and a letter", build: (blanks) => `---\nexecute: ${blanks}x\n---\n\nIntro of the execute key strip.\n\n# H\n`, read: knitrHeadings, answer: () => ["H"] },
    { site: "the key `format:` followed by a long blank run and a letter", build: (blanks) => `---\nformat: ${blanks}x\n---\n\nIntro of the format key strip.\n\n# H\n`, read: knitrHeadings, answer: () => ["H"] },
    { site: "the key `execute:` followed by ` #` pairs and U+2028", run: "` #` pairs", needs: LS, build: (blanks) => `---\nexecute:${" #".repeat(blanks.length)}${LS}\n---\n\nIntro of the execute key pairs.\n\n# H\n`, read: knitrHeadings, answer: () => ["H"] },
    // Trailing blanks and nothing else are the input a paste produces (no letter, no hash), and a blank run with ONE hash and a terminator needs no pairs: both were quadratic too (Session 320's research agents).
    { site: "knitr default `echo: false` followed by a long blank run and nothing else", build: (blanks) => `---\necho: false${blanks}\n---\n\nIntro of the trailing echo strip.\n\n# H\n`, read: knitrHeadings, answer: () => ["H"] },
    { site: "the key `execute:` followed by a long blank run and nothing else", build: (blanks) => `---\nexecute:${blanks}\n---\n\nIntro of the trailing execute key strip.\n\n# H\n`, read: knitrHeadings, answer: () => ["H"] },
    { site: "the key `execute:` followed by a long blank run, one hash and U+2028", needs: LS, build: (blanks) => `---\nexecute:${blanks}#${LS}\n---\n\nIntro of the execute key and one hash.\n\n# H\n`, read: knitrHeadings, answer: () => ["H"] },
    // `parseOutputPath` reads the whole output of a successful `quarto render` (stdout and stderr, which holds whatever the document's own code printed). Its lazy `(.+?)[ \t]*$` re-read the rest of a
    // blank run at every character: `Output created: a`, 32,000 blanks, `b` took 2.1 s in one `exec` (8,000 / 16,000 / 32,000: 132 / 524 / 2,132 ms).
    { site: "parseOutputPath (an `Output created:` line with a long blank run inside the path)", build: (blanks) => `Output created: a${blanks}b`, read: parseOutputPath, answer: (blanks) => `a${blanks}b` },
  ];

  it.each(ROWS.map((row) => [row.site, row.run ?? "blanks", row] as const))("%s: 100,000 %s are read in linear time, and the answer is the same as the short run's", (_site, _run, row) => {
    const shorter = row.read(row.build(" ".repeat(SHORTER_RUN)));
    expect(shorter).toEqual(row.answer(" ".repeat(SHORTER_RUN)));
    const longText = row.build(" ".repeat(BLANK_RUN));
    expect(longText.length).toBeGreaterThanOrEqual(BLANK_RUN);
    if (row.needs !== undefined) expect(longText.includes(row.needs)).toBe(true);
    const { result, ms } = timed(() => row.read(longText));
    expect(result).toEqual(row.answer(" ".repeat(BLANK_RUN)));
    expect(ms).toBeLessThan(CLOCK_MS);
  });

  // A row run at 1,000 blanks, or allowed 100 s, would pass on the parent too.
  it("keeps the run, the shorter run and the limit the Session 320 rows are built on", () => {
    expect([BLANK_RUN, SHORTER_RUN, CLOCK_MS]).toEqual([100_000, 2_000, 1000]);
  });
});

describe("Session 321 — a long run of blanks between `#` and `|` on a cell option line", () => {
  // The BACKLOG item "Other regexes still quadratic on a long run of blanks, CR or U+2028", part (3). `indexLabels` reads the blanks between a cell option line's pipe and its key with
  // an UNANCHORED search for the blanks that END the text before the key. The search is retried from every position, so a blank run that is NOT at the end of that text (the one between the `#` and the
  // `|`) is scanned to its end from each of its blanks and then refused. A run just before the key (`#|` then blanks then the key) is the match itself and costs nothing: that is the control row.
  // Bare `indexLabels` on the item's shape, one fresh process each (Session 321, load average about 5): 42 / 156 / 614 ms at 8,000 / 16,000 / 32,000 blanks, 5.98 s at 100,000.
  // Named apart from the Session 319 and 320 describes' constants on purpose: a mutation list quotes a constant's whole line (Session 319's quotes its RUN and its LIMIT_MS lines), and the same text twice in the file
  // makes that `from` ambiguous (Learning 796): do not write such a line out in a comment either.
  // The labels are `lst-a`, not `fig-a`, on the cells with no code: a `fig-` or `tbl-` label on such a cell is dropped by the no-target rule (Session 304) as soon as that rule can read the option lines, and these rows are about the gap.
  const GAP_BLANKS = 100_000;
  const GAP_SHORTER = 2_000;
  const GAP_LIMIT_MS = 1000;
  const labelsOf = (text: string, engine: "jupyter" | "knitr"): string[] => indexLabels(text, engine).map((label) => `${label.id}@${label.line}:${label.column}`);
  type GapRow = { site: string; engine: "jupyter" | "knitr"; build: (blanks: string) => string; answer: (blanks: string) => string[] };

  const GAP_ROWS: GapRow[] = [
    { site: "the option line `#`, blanks, `| label: lst-a` in a python cell (the item's shape)", engine: "jupyter", build: (blanks) => `\`\`\`{python}\n#${blanks}| label: lst-a\n\`\`\`\n`, answer: (blanks) => [`lst-a@1:${blanks.length + 10}`] },
    { site: "the same with TABS between the `#` and the `|`", engine: "jupyter", build: (blanks) => `\`\`\`{python}\n#${"\t".repeat(blanks.length)}| label: lst-a\n\`\`\`\n`, answer: (blanks) => [`lst-a@1:${blanks.length + 10}`] },
    { site: "the same with a run of alternating blanks and tabs", engine: "jupyter", build: (blanks) => `\`\`\`{python}\n#${" \t".repeat(blanks.length / 2)}| label: lst-a\n\`\`\`\n`, answer: (blanks) => [`lst-a@1:${blanks.length + 10}`] },
    { site: "a knitr cell with a plot (the label is kept)", engine: "knitr", build: (blanks) => `\`\`\`{r}\n#${blanks}| label: fig-a\nplot(1)\n\`\`\`\n`, answer: (blanks) => [`fig-a@1:${blanks.length + 10}`] },
    { site: "the run on the SECOND option line, after a label", engine: "jupyter", build: (blanks) => `\`\`\`{python}\n#| label: lst-a\n#${blanks}| fig-cap: x\n\`\`\`\n`, answer: () => ["lst-a@1:10"] },
    { site: "a cell inside a list item (its indent is stripped first)", engine: "jupyter", build: (blanks) => `- item\n\n  \`\`\`{python}\n  #${blanks}| label: lst-a\n  \`\`\`\n`, answer: (blanks) => [`lst-a@3:${blanks.length + 12}`] },
    // Control: the long run IS the gap (`#|`, blanks, the key). The search matches it at its first blank, so this was linear before and must stay so.
    { site: "control: `#|`, blanks, then the key (the run is the gap itself)", engine: "jupyter", build: (blanks) => `\`\`\`{python}\n#|${blanks}label: lst-a\n\`\`\`\n`, answer: (blanks) => [`lst-a@1:${blanks.length + 9}`] },
  ];

  it.each(GAP_ROWS.map((row) => [row.site, row] as const))("%s: 100,000 blanks are read in linear time, and the answer is the stated one at 2,000 blanks and at 100,000", (_site, row) => {
    const shortBlanks = " ".repeat(GAP_SHORTER);
    expect(labelsOf(row.build(shortBlanks), row.engine)).toEqual(row.answer(shortBlanks));
    const blanks = " ".repeat(GAP_BLANKS);
    const longText = row.build(blanks);
    expect(longText.length).toBeGreaterThanOrEqual(GAP_BLANKS);
    const { result, ms } = timed(() => labelsOf(longText, row.engine));
    expect(result).toEqual(row.answer(blanks));
    expect(ms).toBeLessThan(GAP_LIMIT_MS);
  });

  // A row run at 1,000 blanks, or allowed 100 s, would pass on the parent too.
  it("keeps the run, the shorter run and the limit the Session 321 rows are built on", () => {
    expect([GAP_BLANKS, GAP_SHORTER, GAP_LIMIT_MS]).toEqual([100_000, 2_000, 1000]);
  });
});

describe("Session 322 — many metadata blocks in the body of one document", () => {
  // The BACKLOG item "Other regexes still quadratic on a long run of blanks, CR or U+2028", part (8). Every entry that scans regions reads the YAML blocks below the front matter to learn the reader, and for each of them
  // it asked whether an HTML comment is still open at the block's first line by scanning every line from the top of the document: the cost was blocks x lines. The shape is the item's: 6 lines a block
  // (`---`, `format:`, `  html:`, `    k: v`, `---`, `text`). Bare entries, one fresh process each (Session 322, load average about 5): `findHeadings` 87 / 235 / 742 / 2,892 / 10,511 ms at 1,000 / 2,000 / 4,000 / 8,000 / 16,000 blocks
  // (2.7, 3.2, 3.9 and 3.6 times per doubling in this run, 2.5, 3.2, 3.7 and 3.7 in a second: the small sizes carry the first call's own one-off cost), `indexLabels` 4.1 s and `resolveDocumentEngine` 2.8 s at 8,000; `findAllCells`, `collectValueSources` and `valueFlags` 2.8 s each.
  // Every row builds a text no other row builds: `scanRegions` memoizes the last two texts, so a second row on the same text would be answered from the memo (0 ms for `findHeadings`, a part of the time for the others) whatever the code does.
  const MANY_BLOCKS = 8_000;
  const FEW_BLOCKS = 200;
  const MANY_BLOCKS_LIMIT_MS = 1000;
  const ITEM_BLOCK = "---\nformat:\n  html:\n    k: v\n---\ntext\n";
  const SPACED_BLOCK = "---\nformat:\n  html:\n    k: v\n---\n\ntext\n\n";
  const cellWith = (label: string): string => `\n\`\`\`{python}\n#| label: ${label}\nx = 1\n\`\`\`\n`;
  const blockHeadings = (text: string): Array<[number, string]> => findHeadings(text).map((heading): [number, string] => [heading.line, heading.text]);
  const blockLabels = (text: string): string[] => indexLabels(text).map((label) => `${label.id}@${label.line}:${label.column}`);
  const blockSources = (text: string): { lines: number; cellLines: number; nested: number } => {
    const sources = collectValueSources(text);
    return { lines: sources.lines.length, cellLines: sources.cellLines.length, nested: sources.nestedLines.length };
  };
  type BlockRow = { site: string; build: (blocks: number) => string; read: (text: string) => unknown; answer: (blocks: number) => unknown };

  const BLOCK_ROWS: BlockRow[] = [
    { site: "findHeadings, the item's shape and a heading at the end", build: (n) => `${ITEM_BLOCK.repeat(n)}\n# H\n`, read: blockHeadings, answer: (n) => [[5, "text"], [6 * n + 1, "H"]] },
    { site: "findHeadings, blocks with a blank line round their text", build: (n) => `${SPACED_BLOCK.repeat(n)}# H\n`, read: blockHeadings, answer: (n) => [[8 * n, "H"]] },
    // Every block is inside the one open comment, so none of them is read: the scan still has to pass each line once.
    { site: "findHeadings, every block inside one open comment", build: (n) => `<!--\n${ITEM_BLOCK.repeat(n)}-->\n\n# H\n`, read: blockHeadings, answer: (n) => [[6 * n + 3, "H"]] },
    // A comment that closes on its own line before every block: the state is `closed` at every block, and the scan must carry it.
    { site: "findHeadings, a closed comment line before every block", build: (n) => `${`<!-- c -->\n${SPACED_BLOCK}`.repeat(n)}# H\n`, read: blockHeadings, answer: (n) => [[9 * n, "H"]] },
    { site: "indexLabels, a section id on the heading at the end", build: (n) => `${ITEM_BLOCK.repeat(n)}\n# H {#sec-a}\n`, read: blockLabels, answer: (n) => [`sec-a@${6 * n + 1}:6`] },
    { site: "indexLabels, a cell label at the end", build: (n) => `${ITEM_BLOCK.repeat(n)}${cellWith("lst-a")}`, read: blockLabels, answer: (n) => [`lst-a@${6 * n + 2}:10`] },
    { site: "resolveDocumentEngine, a python cell at the end", build: (n) => `${ITEM_BLOCK.repeat(n)}${cellWith("lst-b")}`, read: (text) => resolveDocumentEngine("a.qmd", text), answer: () => "jupyter" },
    { site: "resolveDocumentEngine, no cell at all", build: (n) => ITEM_BLOCK.repeat(n), read: (text) => resolveDocumentEngine("a.qmd", text), answer: () => "markdown" },
    { site: "findAllCells, a python cell at the end", build: (n) => `${ITEM_BLOCK.repeat(n)}${cellWith("lst-c")}`, read: (text) => findAllCells(text).length, answer: () => 1 },
    { site: "collectValueSources, a python cell at the end", build: (n) => `${ITEM_BLOCK.repeat(n)}${cellWith("lst-d")}`, read: blockSources, answer: (n) => ({ lines: 6 * n + 6, cellLines: 1, nested: 1 }) },
    { site: "valueFlags over those sources", build: (n) => `${ITEM_BLOCK.repeat(n)}${cellWith("lst-e")}`, read: (text) => valueFlags(collectValueSources(text), "a.qmd", CURATED_SCHEMA_INDEX), answer: () => ({ cell: [], frontMatter: [], nested: [] }) },
    // Control: a thematic break with a blank line on each side opens no region, so the comment question is never asked. Linear before and after.
    { site: "control: thematic breaks with a blank line on each side", build: (n) => `${"text\n\nmore\n\n---\n\n".repeat(n)}# H\n`, read: blockHeadings, answer: (n) => [[6 * n, "H"]] },
  ];

  it.each(BLOCK_ROWS.map((row) => [row.site, row] as const))("%s: 8,000 blocks are read in linear time, and the answer is the stated one at 200 blocks and at 8,000", (_site, row) => {
    expect(row.read(row.build(FEW_BLOCKS))).toEqual(row.answer(FEW_BLOCKS));
    const longText = row.build(MANY_BLOCKS);
    expect(longText.split("\n").length).toBeGreaterThan(6 * MANY_BLOCKS); // every row's text has at least 6 lines a block: the timed text is the long one
    const { result, ms } = timed(() => row.read(longText));
    expect(result).toEqual(row.answer(MANY_BLOCKS));
    expect(ms).toBeLessThan(MANY_BLOCKS_LIMIT_MS);
  });

  it("builds a different text for every row", () => {
    const texts = BLOCK_ROWS.map((row) => row.build(FEW_BLOCKS));
    expect(new Set(texts).size).toBe(BLOCK_ROWS.length);
  });

  // A row run at 200 blocks, or allowed 100 s, would pass on the parent too.
  it("keeps the block counts and the limit the Session 322 rows are built on", () => {
    expect([MANY_BLOCKS, FEW_BLOCKS, MANY_BLOCKS_LIMIT_MS]).toEqual([8_000, 200, 1000]);
  });
});

describe("Session 323 — a front matter container nested thousands of levels deep", () => {
  // The BACKLOG item "Other regexes still quadratic on a long run of blanks, CR or U+2028", part (6a). `findNestedFrontMatterValueLines` asks `nestedParentPath` for the container of every nested line, and the walk
  // climbs every ancestor of that line, reading each one's whole indent twice (`leadingWsLen` and `mappingContainerKey`, anchored regexes) and prepending its key: a line `d` levels down costs `d` hops of `d` characters,
  // so the cost is cubic in the depth while the text grows with its square (one key per level, each indented one more than the last). Bare `findNestedFrontMatterValueLines`, one fresh process each (Session 323, load
  // average about 40, none of it mine): 22 / 48 / 202 / 1,203 ms at depth 200 / 400 / 800 / 1,600 (1.29 MB) and 8,262 ms at 3,200 (5.1 MB); `resolveDocumentEngine` and `collectValueSources` take the same time, because they
  // call it; 800 levels with 8,000 sibling scalars at the bottom (6.8 MB) took 5.2 s, since every sibling climbs the whole trunk. A CPU profile at depth 1,600: 36% in `^[ \t]*`, 36% in `^[ \t]+`, 9% in `nestedParentPath`.
  // The cure (a chain of containers kept for each line) took the same rows to 0.28 to 0.72 s each, text building included (load average 11 to 23, one run each; 0.27 to 0.53 s alone), against 5.4 s for the two trunk rows, 8.2 to 8.4 s for the
  // chain rows and 16.5 s for `valueFlags` on the parent. The limit is set between the two at 2,500 ms, not 1,000: the slowest new row took 70% of 1,000 with the machine busy, and the work is also pinned as lines read (`container-chain-equivalence.test.ts`),
  // which does not move with the load. Every row builds a text no other row builds (its own site is in the body).
  const DEEP = 3_200;
  const SHALLOW = 40;
  const TRUNK = 800;
  const LEAVES = 8_000;
  const FEW_LEAVES = 10;
  const DEEP_LIMIT_MS = 2500;
  const levels = (depth: number): string => Array.from({ length: depth }, (_, j) => `${" ".repeat(j + 1)}k${j + 1}:`).join("\n");
  /** `depth` containers, one more indent each, under `root`, and one scalar at the bottom. */
  const chain = (depth: number, root: string, body: string): string => `---\n${root}\n${levels(depth)}\n${" ".repeat(depth + 1)}echo: true\n---\n\n${body}\n`;
  /** `depth` containers under `format:`, and `leaves` sibling scalars at the bottom. */
  const trunk = (depth: number, leaves: number, body: string): string =>
    `---\nformat:\n${levels(depth)}\n${Array.from({ length: leaves }, (_, i) => `${" ".repeat(depth + 1)}o${i}: v`).join("\n")}\n---\n\n${body}\n`;
  const pathOf = (depth: number): string[] => ["format", ...Array.from({ length: depth }, (_, j) => `k${j + 1}`)];
  const bottom = (depth: number): unknown => [{ line: depth + 2, parentPath: pathOf(depth), key: "echo", valueRange: { startCol: depth + 7, endCol: depth + 11 }, rawToken: "true" }];
  const sourceCounts = (text: string): { lines: number; cellLines: number; nested: number } => {
    const sources = collectValueSources(text);
    return { lines: sources.lines.length, cellLines: sources.cellLines.length, nested: sources.nestedLines.length };
  };
  const NO_FLAGS = { cell: [], frontMatter: [], nested: [] };
  const trunkLines = (size: Size): number => size.depth + size.leaves + 7;
  type Size = { depth: number; leaves: number };
  type DeepRow = { site: string; many: Size; few: Size; build: (size: Size, site: string) => string; read: (text: string) => unknown; answer: (size: Size) => unknown };
  const CHAIN: Pick<DeepRow, "many" | "few"> = { many: { depth: DEEP, leaves: 0 }, few: { depth: SHALLOW, leaves: 0 } };
  const TRUNK_AND_LEAVES: Pick<DeepRow, "many" | "few"> = { many: { depth: TRUNK, leaves: LEAVES }, few: { depth: SHALLOW, leaves: FEW_LEAVES } };

  const DEEP_ROWS: DeepRow[] = [
    { site: "findNestedFrontMatterValueLines, a scalar at the bottom of a format-rooted chain", ...CHAIN, build: (s, site) => chain(s.depth, "format:", site), read: findNestedFrontMatterValueLines, answer: (s) => bottom(s.depth) },
    { site: "resolveDocumentEngine, the same front matter", ...CHAIN, build: (s, site) => chain(s.depth, "format:", site), read: (text) => resolveDocumentEngine("a.qmd", text), answer: () => "markdown" },
    { site: "collectValueSources, the same front matter", ...CHAIN, build: (s, site) => chain(s.depth, "format:", site), read: sourceCounts, answer: (s) => ({ lines: s.depth + 7, cellLines: 0, nested: 1 }) },
    { site: "valueFlags over those sources", ...CHAIN, build: (s, site) => chain(s.depth, "format:", site), read: (text) => valueFlags(collectValueSources(text), "a.qmd", CURATED_SCHEMA_INDEX), answer: () => NO_FLAGS },
    // The walk climbs to the root before it learns the root is not `format`, so these cost what the first row costs and answer nothing.
    { site: "findNestedFrontMatterValueLines, a chain under execute (the root is not format)", ...CHAIN, build: (s, site) => chain(s.depth, "execute:", site), read: findNestedFrontMatterValueLines, answer: () => [] },
    { site: "findNestedFrontMatterValueLines, a chain under website (the root is not format)", ...CHAIN, build: (s, site) => chain(s.depth, "website:", site), read: findNestedFrontMatterValueLines, answer: () => [] },
    { site: "findNestedFrontMatterValueLines, a chain whose column-0 root holds a scalar", ...CHAIN, build: (s, site) => chain(s.depth, "format: x", site), read: findNestedFrontMatterValueLines, answer: () => [] },
    {
      site: "findNestedFrontMatterValueLines, 8,000 sibling scalars at the bottom of an 800-level trunk",
      ...TRUNK_AND_LEAVES,
      build: (s, site) => trunk(s.depth, s.leaves, site),
      read: (text) => {
        const found = findNestedFrontMatterValueLines(text);
        return { count: found.length, firstKey: found[0]?.key, lastKey: found[found.length - 1]?.key, lastLine: found[found.length - 1]?.line, depths: new Set(found.map((entry) => entry.parentPath.length)) };
      },
      answer: (s) => ({ count: s.leaves, firstKey: "o0", lastKey: `o${s.leaves - 1}`, lastLine: s.depth + s.leaves + 1, depths: new Set([s.depth + 1]) }),
    },
    { site: "resolveDocumentEngine, the same trunk and its 8,000 siblings", ...TRUNK_AND_LEAVES, build: (s, site) => trunk(s.depth, s.leaves, site), read: (text) => resolveDocumentEngine("a.qmd", text), answer: () => "markdown" },
    // Control: the same number of lines at one indent has nothing to climb. Linear before and after.
    { site: "control: 3,200 sibling scalars under format / html", ...CHAIN, build: (s, site) => `---\nformat:\n  html:\n${Array.from({ length: s.depth }, (_, i) => `    s${i}: v`).join("\n")}\n---\n\n${site}\n`, read: (text) => findNestedFrontMatterValueLines(text).length, answer: (s) => s.depth },
  ];

  it.each(DEEP_ROWS.map((row) => [row.site, row] as const))("%s: the deep text is read in linear time, and the answer is the stated one at the small and the large size", (_site, row) => {
    expect(row.read(row.build(row.few, `${row.site} (small)`))).toEqual(row.answer(row.few));
    const longText = row.build(row.many, `${row.site} (large)`);
    expect(longText.split("\n").length).toBeGreaterThan(row.many.depth); // the timed text is the long one
    const { result, ms } = timed(() => row.read(longText));
    expect(result).toEqual(row.answer(row.many));
    expect(ms).toBeLessThan(DEEP_LIMIT_MS);
  });

  it("builds a different text for every row", () => {
    const texts = DEEP_ROWS.map((row) => row.build(row.few, row.site));
    expect(new Set(texts).size).toBe(DEEP_ROWS.length);
  });

  // A row run at depth 40, or allowed 100 s, would pass on the parent too.
  it("keeps the sizes and the limit the Session 323 rows are built on", () => {
    expect([DEEP, SHALLOW, TRUNK, LEAVES, FEW_LEAVES, DEEP_LIMIT_MS]).toEqual([3_200, 40, 800, 8_000, 10, 2500]);
    expect(trunkLines({ depth: SHALLOW, leaves: FEW_LEAVES })).toBe(57);
  });
});

describe("Session 324 — an attribute block whose atoms can be split many ways and whose last character is refused", () => {
  // The BACKLOG item "Nine more single-line overflow and slow-input families, none of them in Session 317's diff", part (1). `ATTR_ATOM_RUN` judges one whitespace-separated token of an attribute block as a run of `-`, `#id`
  // and `.class` atoms, and the tail of an id or of a class holds a `.` and a `-` itself, so `.A.A.A` is one class or three, and the engine tries every split before it refuses a token whose last character is wrong
  // (`!`): exponential in the number of atoms, on a 68-byte line. A valid block matches at once, so the cost needs an INVALID tail, such as a heading mid-edit. Every route that judges an attribute block reaches the
  // pattern: a heading, a fence's info string, and the inline, span and div blocks of the cross-reference index. The same pattern is QUADRATIC when an id or a class is followed by a long run of dashes (the end of the id
  // can fall at any of them).
  // Bare `findHeadings`, one fresh process each, COLD (Session 324, load average about 5): 276 / 1,094 / 4,326 / 17,230 ms at 22 / 24 / 26 / 28 classes (4 times per two); WARM, a second call in the process: 30 / 115 / 455 ms
  // at 22 / 24 / 26, because the first run of a pattern in a process is interpreted and about 10 times slower. An id before the classes costs about twice as much (26 classes: 8.6 s cold), a dash after each class has
  // THREE splits a boundary (16 repeats: 2.8 s cold), and an id or a class then dashes cost 82 / 317 / 1,259 ms at 8,000 / 16,000 / 32,000 dashes (4 times per doubling).
  // The sizes come from the WARM figures, since the rows before them warm the pattern: 30 classes is about 7.5 s on the parent warm, against a limit that the cure meets in milliseconds. The controls come first, so that
  // the pattern is warm for every refused row. Every row builds a text no other row builds.
  const SPLIT_CLASSES = 30;
  const SPLIT_AFTER_ID = 28;
  const SPLIT_DASHED = 19;
  const SPLIT_DASHES = 100_000;
  const SPLIT_FEW = 3;
  const SPLIT_LIMIT_MS = 1000;
  const splitHeadings = (text: string): Array<[number, string, string | undefined]> => findHeadings(text).map((heading): [number, string, string | undefined] => [heading.line, heading.text, heading.id]);
  const splitLabels = (text: string): string[] => indexLabels(text).map((label) => `${label.id}@${label.line}:${label.column}`);
  /** A refused block keeps its braces in the heading text and defines no id. */
  const refusedHeading = (inner: string): Array<[number, string, string | undefined]> => [[0, `H {${inner}}`, undefined]];
  const NO_ID_HEADING: Array<[number, string, string | undefined]> = [[0, "H", undefined]];
  type SplitRow = { site: string; unit: string; many: number; build: (run: string) => string; read: (text: string) => unknown; answer: (run: string) => unknown };

  const SPLIT_ROWS: SplitRow[] = [
    // Controls first: a VALID block matches at once (and warms the pattern); the refused ones below it are the RED rows.
    { site: "control: a heading block of 30 valid classes", unit: ".A", many: SPLIT_CLASSES, build: (run) => `# H {${run}}\n`, read: splitHeadings, answer: () => NO_ID_HEADING },
    { site: "control: an id that takes 30 dotted classes into its own name", unit: ".A", many: SPLIT_CLASSES, build: (run) => `# H {#sec-x${run}}\n`, read: splitHeadings, answer: (run) => [[0, "H", `sec-x${run}`]] },
    { site: "control: an id token and then 100,000 valid classes", unit: ".A", many: SPLIT_DASHES, build: (run) => `# H {#sec-x ${run}}\n`, read: splitHeadings, answer: () => [[0, "H", "sec-x"]] },
    { site: "control: a fence whose valid block of 30 classes opens a region", unit: ".A", many: SPLIT_CLASSES, build: (run) => `\`\`\` {${run}}\n\n# In\n\n\`\`\`\n\n# After\n`, read: splitHeadings, answer: () => [[6, "After", undefined]] },
    { site: "control: an image block, an id and 30 valid classes", unit: ".A", many: SPLIT_CLASSES, build: (run) => `![Cap](a.png){#fig-a ${run}}\n`, read: splitLabels, answer: () => ["fig-a@0:15"] },
    // Each dash is an atom of its own, so a run of dashes alone has one parse: linear before and after.
    { site: "control: 100,000 dashes then `!` (a dash is an atom of its own)", unit: "-", many: SPLIT_DASHES, build: (run) => `# H {${run}!}\n`, read: splitHeadings, answer: (run) => refusedHeading(`${run}!`) },
    // commonmark_x reads ONE atom a token (`ATTR_ATOM_COMMONMARK`), so the same refused text is linear there: the reader split is not the pattern's.
    { site: "control: 30 classes then `!` under commonmark_x", unit: ".A", many: SPLIT_CLASSES, build: (run) => `---\nfrom: commonmark_x\n---\n\n# H {${run}!}\n`, read: splitHeadings, answer: (run) => [[4, `H {${run}!}`, undefined]] },

    { site: "heading: 30 classes then `!` (the item's shape)", unit: ".A", many: SPLIT_CLASSES, build: (run) => `# H {${run}!}\n`, read: splitHeadings, answer: (run) => refusedHeading(`${run}!`) },
    { site: "heading: an id, 28 classes, then `!`", unit: ".A", many: SPLIT_AFTER_ID, build: (run) => `# H {#a${run}!}\n`, read: splitHeadings, answer: (run) => refusedHeading(`#a${run}!`) },
    { site: "heading: 19 classes, each followed by a dash, then `!`", unit: ".A-", many: SPLIT_DASHED, build: (run) => `# H {${run}!}\n`, read: splitHeadings, answer: (run) => refusedHeading(`${run}!`) },
    { site: "heading: a valid id token, then a second token of 30 classes and `!`", unit: ".A", many: SPLIT_CLASSES, build: (run) => `# H {#sec-x ${run}!}\n`, read: splitHeadings, answer: (run) => refusedHeading(`#sec-x ${run}!`) },
    { site: "heading: an id, 100,000 dashes, then `!`", unit: "-", many: SPLIT_DASHES, build: (run) => `# H {#a${run}!}\n`, read: splitHeadings, answer: (run) => refusedHeading(`#a${run}!`) },
    { site: "heading: a class, 100,000 dashes, then `!`", unit: "-", many: SPLIT_DASHES, build: (run) => `# H {.A${run}!}\n`, read: splitHeadings, answer: (run) => refusedHeading(`.A${run}!`) },
    { site: "backtick fence: 30 classes then `!` refuse the fence", unit: ".A", many: SPLIT_CLASSES, build: (run) => `\`\`\` {${run}!}\n\n# In\n\n\`\`\`\n\n# After\n`, read: splitHeadings, answer: () => [[2, "In", undefined], [6, "After", undefined]] },
    { site: "tilde fence: 30 classes then `!` refuse the fence", unit: ".A", many: SPLIT_CLASSES, build: (run) => `~~~ {${run}!}\n\n# In\n\n~~~\n\n# After\n`, read: splitHeadings, answer: () => [[2, "In", undefined], [6, "After", undefined]] },
    { site: "image block: an id, 30 classes, then `!`", unit: ".A", many: SPLIT_CLASSES, build: (run) => `![Cap](a.png){#fig-a ${run}!}\n`, read: splitLabels, answer: () => [] },
    { site: "image block: 30 classes then `!`, no id before them", unit: ".A", many: SPLIT_CLASSES, build: (run) => `![Cap](a.png){${run}!}\n`, read: splitLabels, answer: () => [] },
    { site: "span block: an id, 30 classes, then `!`", unit: ".A", many: SPLIT_CLASSES, build: (run) => `[text]{#fig-a ${run}!}\n`, read: splitLabels, answer: () => [] },
    { site: "div block: an id, 30 classes, then `!`", unit: ".A", many: SPLIT_CLASSES, build: (run) => `::: {#fig-a ${run}!}\n![Cap](a.png)\n:::\n`, read: splitLabels, answer: () => [] },
  ];

  it.each(SPLIT_ROWS.map((row) => [row.site, row] as const))("%s: is read in linear time, and the answer is the stated one with 3 units and with the long run", (_site, row) => {
    const shortRun = row.unit.repeat(SPLIT_FEW);
    expect(row.read(row.build(shortRun))).toEqual(row.answer(shortRun));
    const run = row.unit.repeat(row.many);
    const longText = row.build(run);
    expect(longText.length).toBeGreaterThan(run.length); // the timed text holds the whole run
    const { result, ms } = timed(() => row.read(longText));
    expect(result).toEqual(row.answer(run));
    expect(ms).toBeLessThan(SPLIT_LIMIT_MS);
  });

  it("builds a different text for every row", () => {
    const shortTexts = SPLIT_ROWS.map((row) => row.build(row.unit.repeat(SPLIT_FEW)));
    expect(new Set(shortTexts).size).toBe(SPLIT_ROWS.length);
    const longTexts = SPLIT_ROWS.map((row) => row.build(row.unit.repeat(row.many)));
    expect(new Set(longTexts).size).toBe(SPLIT_ROWS.length);
  });

  // A run of 8 classes, or a limit of 100 s, would pass on the parent too.
  it("keeps the sizes, the limit and the units the Session 324 rows are built on", () => {
    expect([SPLIT_CLASSES, SPLIT_AFTER_ID, SPLIT_DASHED, SPLIT_DASHES, SPLIT_FEW, SPLIT_LIMIT_MS]).toEqual([30, 28, 19, 100_000, 3, 1000]);
    expect(SPLIT_ROWS.map((row) => `${row.unit}x${row.many}`)).toEqual([
      ".Ax30", ".Ax30", ".Ax100000", ".Ax30", ".Ax30", "-x100000", ".Ax30",
      ".Ax30", ".Ax28", ".A-x19", ".Ax30", "-x100000", "-x100000", ".Ax30", ".Ax30", ".Ax30", ".Ax30", ".Ax30", ".Ax30",
    ]);
  });
});

describe("Session 325 — a heading line holding many openers whose closers never come", () => {
  // The BACKLOG item "Nine more single-line overflow and slow-input families, none of them in Session 317's diff", part (2) (and part (3) of the Session 319 item, the same function). `headingContentRefused` scans
  // a heading's text for a token pandoc's inline parser refuses, skipping what a code span, a bracketed group, a macro argument, a comment, a CDATA section, a processing instruction, a tag's quoted attribute or
  // a shortcode swallows. Each skip asks the text AFTER the opener where its closer is, and an opener with NO closer answered "one character on" after reading to the end of the line, so the next opener of the same
  // kind read the same tail again: quadratic in the openers, on a line a pasted blob can be.
  // Bare `findHeadings` (document rows) and bare `headingContentRefused` (function rows, which the then-filed `HEADING_ATTRIBUTE` regex could not hide; closed in Session 330), a warm call after warm-up calls, load average 3.4 to 6 (Session 325): `
  // x 8,000 / 16,000 / 32,000 / 64,000: 86 / 355 / 1,416 / 5,587 ms (ratios 4.1, 4.0, 3.9); `[` the same; `\a[` x 8,000 / 16,000 / 32,000: 406 / 1,557 / 4,798 ms; `\a{` x 32,000 / 40,000: 2,452 / 3,943 ms; `<a` x 8,000
  // to 64,000: 167 / 605 / 1,869 / 8,330 ms; `<a " ` x 8,000 / 16,000 / 32,000: 542 / 2,057 / 6,653 ms; `<!--` x 8,000 to 32,000: 556 / 2,206 / 8,777 ms; `<?` x 32,000: 4,467 ms; `<![CDATA[` x 4,000 / 8,000 / 12,000:
  // 493 / 1,845 / 4,486 ms; `{{<` x 160,000 / 320,000: 850 / 3,447 ms. Bare `{` and a bare backslash are NOT this function's: their time was in `HEADING_ATTRIBUTE` and the closing-hash strip (the Session 318 item's parts (2)
  // and (3), closed in Session 330: see its describe below), so there is no row for them here. At the row sizes the parent takes 3.4 to 6.3 s in the runs of Session 325 (4.2 to 8.0 s in the review round's, which ran at a higher load) against a limit the cure meets in
  // milliseconds, and the closed-construct controls come first. The review round added the rows for the call sites the first rows did not reach: the class-ARG macro reader (`\section[`, `\section{`: 5.1 and 5.7 s on the parent
  // at 24,000), the followers of a closed label (`[a](`, `[a]{`, `[a][`), a line that mixes the three markers (a one-slot memo passes every single-marker row), the `'` quote and the closing tags, runs of backticks that
  // all differ in length, and, as guards that are linear on the parent too, a group that CLOSES after 100,000 openers and 40,000 closed labels past index 65,535 (a table of 16-bit entries answers wrongly or never ends).
  const OPEN_LIMIT_MS = 1000;
  const OPEN_FEW = 3;
  const OPEN_ESCAPABLE = /[\p{P}\p{S}]/u; // what a document with no `from:` uses (`ESCAPABLE_ALL_SYMBOLS`); every character the rows use is the same under all three sets
  const openHeadings = (text: string): Array<[number, string, string | undefined]> => findHeadings(text).map((heading): [number, string, string | undefined] => [heading.line, heading.text, heading.id]);
  const openScan = (text: string): boolean => headingContentRefused(text, true, true, OPEN_ESCAPABLE);
  type OpenRow = { site: string; unit: string; many: number; build: (run: string) => string; read: (text: string) => unknown; answer: (run: string) => unknown };
  const kept = (run: string): Array<[number, string, string | undefined]> => [[0, run.trim(), undefined]];

  const OPEN_ROWS: OpenRow[] = [
    // Controls first: every opener CLOSES, so the answer is at hand and the cost is linear before and after.
    { site: "control: 64,000 closed code spans", unit: "`a` ", many: 64_000, build: (run) => `# ${run}z\n`, read: openHeadings, answer: (run) => kept(`${run}z`) },
    { site: "control: 20,000 closed links", unit: "[a](b) ", many: 20_000, build: (run) => `# ${run}z\n`, read: openHeadings, answer: (run) => kept(`${run}z`) },
    { site: "control: 16,000 closed macro argument groups", unit: "\\a[x]{y} ", many: 16_000, build: (run) => `# ${run}z\n`, read: openHeadings, answer: (run) => kept(`${run}z`) },
    { site: "control: 16,000 closed comments", unit: "<!--a--> ", many: 16_000, build: (run) => `# ${run}z\n`, read: openHeadings, answer: (run) => kept(`${run}z`) },
    { site: "control: 16,000 closed inline tags", unit: "<b>a</b> ", many: 16_000, build: (run) => `# ${run}z\n`, read: openHeadings, answer: (run) => kept(`${run}z`) },
    { site: "control: 16,000 closed shortcodes, scanned apart from the strips", unit: "{{< a >}} ", many: 16_000, build: (run) => `${run}z`, read: openScan, answer: () => false },
    // Guards: linear on the parent too, so they cannot be RED there; they hold the cure to it. A group that CLOSES pops its stack entry at once (a search for the entry would be quadratic), and the tables hold indices past 65,535.
    { site: "guard: 100,000 `[` closed by 100,000 `]`, scanned apart from the strips", unit: "[", many: 100_000, build: (run) => `${run}${"]".repeat(run.length)}`, read: openScan, answer: () => false },
    { site: "guard: 40,000 closed labels that each hide a block tag, then a plain letter", unit: "[<section>](u) ", many: 40_000, build: (run) => `# ${run}z\n`, read: openHeadings, answer: (run) => kept(`${run}z`) },
    { site: "guard: 40,000 closed labels that each hide a block tag, then a block tag that refuses", unit: "[<section>](u) ", many: 40_000, build: (run) => `# ${run}<section>\n`, read: openHeadings, answer: () => [] },

    // The refused shapes: the RED rows. Each holds only openers of one kind, so the whole line is read for each.
    { site: "heading: 64,000 backticks, none closed", unit: "`", many: 64_000, build: (run) => `# ${run}\n`, read: openHeadings, answer: kept },
    { site: "heading: 64,000 `[`, none closed", unit: "[", many: 64_000, build: (run) => `# ${run}\n`, read: openHeadings, answer: kept },
    { site: "heading: 32,000 macros each opening a `[` that never closes", unit: "\\a[", many: 32_000, build: (run) => `# ${run}\n`, read: openHeadings, answer: kept },
    { site: "heading: 24,000 comment openers, none closed", unit: "<!--", many: 24_000, build: (run) => `# ${run}\n`, read: openHeadings, answer: kept },
    { site: "heading: 32,000 processing instruction openers, none closed", unit: "<?", many: 32_000, build: (run) => `# ${run}\n`, read: openHeadings, answer: kept },
    { site: "heading: 12,000 CDATA openers, none closed", unit: "<![CDATA[", many: 12_000, build: (run) => `# ${run}\n`, read: openHeadings, answer: kept },
    { site: "heading: 48,000 tag openers with no `>`", unit: "<a", many: 48_000, build: (run) => `# ${run}\n`, read: openHeadings, answer: kept },
    { site: "heading: 24,000 tag openers each opening a quote that never lets a `>` out", unit: '<a " ', many: 24_000, build: (run) => `# ${run}\n`, read: openHeadings, answer: kept },
    { site: "setext: 64,000 backticks, none closed", unit: "`", many: 64_000, build: (run) => `${run}\n===\n`, read: openHeadings, answer: kept },
    // What an unclosed opener hides is NOTHING: the block tag after the run still refuses the heading, so no heading is read.
    { site: "heading: 64,000 backticks, none closed, then a block tag that still refuses", unit: "`", many: 64_000, build: (run) => `# ${run}<section>\n`, read: openHeadings, answer: () => [] },
    { site: "heading: 64,000 `[`, none closed, then a block tag that still refuses", unit: "[", many: 64_000, build: (run) => `# ${run}<section>\n`, read: openHeadings, answer: () => [] },
    // The shapes the strips of `buildHeading` would otherwise hide (a `{` run was the then-filed `HEADING_ATTRIBUTE` item, closed in Session 330): the scan alone.
    { site: "scan: 320,000 shortcode openers, none closed", unit: "{{<", many: 320_000, build: (run) => run, read: openScan, answer: () => false },
    { site: "scan: 40,000 macros each opening a `{` that never closes", unit: "\\a{", many: 40_000, build: (run) => run, read: openScan, answer: () => false },
    // The call sites and shapes the review round found unpinned (a removed cache at each of them passed every row above).
    { site: "scan: 16,000 argument-class macros each opening a `[` that never closes", unit: "\\section[", many: 16_000, build: (run) => run, read: openScan, answer: () => false },
    { site: "scan: 20,000 argument-class macros each opening a `{` that never closes", unit: "\\section{", many: 20_000, build: (run) => run, read: openScan, answer: () => false },
    { site: "heading: 24,000 closed labels each followed by a `(` that never closes", unit: "[a](", many: 24_000, build: (run) => `# ${run}\n`, read: openHeadings, answer: kept },
    { site: "scan: 24,000 closed labels each followed by a `{` that never closes", unit: "[a]{", many: 24_000, build: (run) => run, read: openScan, answer: () => false },
    { site: "scan: 16,000 closed labels each followed by a `[` that never closes", unit: "[a][", many: 16_000, build: (run) => run, read: openScan, answer: () => false },
    { site: "heading: 8,000 of a comment, an instruction and a CDATA opener in turn, none closed", unit: "<!--<?<![CDATA[", many: 8_000, build: (run) => `# ${run}\n`, read: openHeadings, answer: kept },
    { site: "scan: 200,000 CDATA openers, none closed", unit: "<![CDATA[", many: 200_000, build: (run) => run, read: openScan, answer: () => false },
    { site: "heading: 24,000 tag openers each opening a single quote that never lets a `>` out", unit: "<a ' ", many: 24_000, build: (run) => `# ${run}\n`, read: openHeadings, answer: kept },
    { site: "heading: 24,000 closing tags with a slash and no `>`", unit: "</a/", many: 24_000, build: (run) => `# ${run}\n`, read: openHeadings, answer: kept },
    // Runs of backticks that all differ in length: no run closes another, and each is tried against every later length.
    { site: "scan: 400 runs of backticks of lengths 2 to 401, none closed", unit: "x", many: 400, build: (run) => Array.from({ length: run.length }, (_, k) => ` ${"`".repeat(k + 2)}`).join(""), read: openScan, answer: () => false },
  ];

  it.each(OPEN_ROWS.map((row) => [row.site, row] as const))("%s: is read in linear time, and the answer is the stated one with 3 units and with the long run", (_site, row) => {
    const shortRun = row.unit.repeat(OPEN_FEW);
    expect(row.read(row.build(shortRun))).toEqual(row.answer(shortRun));
    const run = row.unit.repeat(row.many);
    const longText = row.build(run);
    expect(longText.length).toBeGreaterThan(run.length - 1); // the timed text holds the whole run
    const { result, ms } = timed(() => row.read(longText));
    expect(result).toEqual(row.answer(run));
    expect(ms).toBeLessThan(OPEN_LIMIT_MS);
  });

  it("builds a different text for every row", () => {
    const shortTexts = OPEN_ROWS.map((row) => row.build(row.unit.repeat(OPEN_FEW)));
    expect(new Set(shortTexts).size).toBe(OPEN_ROWS.length);
    const longTexts = OPEN_ROWS.map((row) => row.build(row.unit.repeat(row.many)));
    expect(new Set(longTexts).size).toBe(OPEN_ROWS.length);
  });

  // A run of 3,000 openers, or a limit of 100 s, would pass on the parent too.
  it("keeps the sizes, the limit and the units the Session 325 rows are built on", () => {
    expect([OPEN_FEW, OPEN_LIMIT_MS]).toEqual([3, 1000]);
    expect(OPEN_ROWS.map((row) => `${row.unit}x${row.many}`)).toEqual([
      "`a` x64000", "[a](b) x20000", "\\a[x]{y} x16000", "<!--a--> x16000", "<b>a</b> x16000", "{{< a >}} x16000",
      "[x100000", "[<section>](u) x40000", "[<section>](u) x40000",
      "`x64000", "[x64000", "\\a[x32000", "<!--x24000", "<?x32000", "<![CDATA[x12000", "<ax48000", '<a " x24000', "`x64000",
      "`x64000", "[x64000", "{{<x320000", "\\a{x40000",
      "\\section[x16000", "\\section{x20000", "[a](x24000", "[a]{x24000", "[a][x16000", "<!--<?<![CDATA[x8000", "<![CDATA[x200000", "<a ' x24000", "</a/x24000", "xx400",
    ]);
  });
});

describe("Session 326 — a line holding many `{` whose `}` never comes", () => {
  // The BACKLOG item "Nine more single-line overflow and slow-input families, none of them in Session 317's diff", part (3) ("the native-div one-line check is QUADRATIC in `indexLabels`", `<div` + `{` x N + `></div>`), whose cause the
  // item left open, and the `{` half of part (6) of the item "What is still quadratic or deep enough to overflow after Session 311". The profile (Session 326, `--cpu-prof`, 40,000 `{`): 98% of the time is in `braceGroups`, neither of the two
  // regexes the item named, and the `<div` and the `></div>` change nothing: a bare run of `{` costs the same. `braceGroups` finds the `}` that closes each `{` of a line by reading on from it with a quote state, and a `{` with NO unquoted `}`
  // after it read to the END of the line and the next `{` read the same tail again: quadratic in the openers, on a line a pasted blob can be. Three callers read it: Source 3 of `indexLabels` on every body line, `fenceInfoOpensBlock` on a fence
  // opener's info string under pandoc's reader (so every reader built on the region scan: `findHeadings`, `findAllCells`, `findBodyLines`, `findMathRegions`, `buildOutline`), and `fenceAttributeId` (Source 4 of `indexLabels`) under a
  // CommonMark-family reader, which accepts the opener without asking the first.
  // Warm calls, load average 3 to 5 (Session 326): `{` x 8,000 / 16,000 / 32,000 / 64,000 through `indexLabels`: 106 / 389 / 1,553 / 6,229 ms (4x per doubling); `{` x 64,000 + `"}` 6,182 ms; `{"` x 8,000 / 16,000 / 32,000 / 64,000: 246 / 944 /
  // 3,789 / 15,167 ms and `{'` the same; the bare native div `<div` + `{` x 40,000: 2,467 ms (2,964 ms in the Session 326 review, load 4 to 8), and the item's LITERAL shape, `<div` + `'{'` x 40,000, 8,476 ms; a fence opener of `{` x 64,000 under pandoc through `findHeadings` 6,320 ms and under `from: gfm` through `indexLabels` 6,210 ms. A closed group costs nothing
  // either way, so the controls come first, and a run that CLOSES after 100,000 openers is one scan. A `{` inside a cell body is never asked (1.3 to 1.5 ms at 64,000, parent and cure alike; a python cell), and a closed brace-led BACKTICK fence tag
  // is rewritten to a bare word before the scan (so ``` + `{` x N + `"{}` is not a shape): the rows that read a group out of the table on a fence opener use a TILDE fence, which is never rewritten. The Session 326 review round added the rows
  // below it: the item's literal quoted div, a run behind 100,000 characters of text (the table is built wherever the first failing opener is), and the table READ at scale on all three callers.
  const BRACE_LIMIT_MS = 1000;
  const BRACE_FEW = 3;
  const withinLimit = (ms: number): boolean => ms < BRACE_LIMIT_MS;
  const braceLabels = (text: string): Array<[string, string, number, number]> => indexLabels(text).map((label): [string, string, number, number] => [label.id, label.kind, label.line, label.column]);
  const braceHeadings = (text: string): Array<[number, string, string | undefined]> => findHeadings(text).map((heading): [number, string, string | undefined] => [heading.line, heading.text, heading.id]);
  const GFM = "---\nfrom: gfm\n---\n\n";
  type BraceRow = { site: string; unit: string; many: number; build: (run: string) => string; read: (text: string) => unknown; answer: (run: string) => unknown };
  const none = (): unknown => [];

  const BRACE_ROWS: BraceRow[] = [
    // Controls: every `{` CLOSES, so the answer is at hand and the cost is linear before and after.
    { site: "control: 64,000 closed groups on a body line", unit: "{a} ", many: 64_000, build: (run) => `${run}z\n`, read: braceLabels, answer: none },
    { site: "control: 64,000 closed groups that hold a quoted `}` on a body line", unit: '{"}"} ', many: 64_000, build: (run) => `${run}z\n`, read: braceLabels, answer: none },
    { site: "control: 16,000 images each followed by a closed id block, one line", unit: "![c](a.png){#fig-a} ", many: 16_000, build: (run) => `${run}z\n`, read: braceLabels, answer: () => [["fig-a", "fig", 0, 13]] },
    // Guards: linear on the parent too, so they cannot be RED there; they hold the cure to it. One `{` that CLOSES after 100,000 openers is a single scan; one long failing scan followed by a closing group past index 65,535
    // (a table of 16-bit entries never ends: the worker runs out of heap).
    { site: "guard: 100,000 `{` closed by one `}` on a body line", unit: "{", many: 100_000, build: (run) => `${run}}\n`, read: braceLabels, answer: none },
    { site: "guard: one `{` with 70,000 characters and a quote after it, then a closed id block past index 65,535", unit: "x", many: 70_000, build: (run) => `{${run}"{#fig-z}\n`, read: braceLabels, answer: (run) => [["fig-z", "fig", 0, run.length + 4]] },

    // The refused shapes: the RED rows. Each holds only `{` that never close, so the whole line is read for each.
    { site: "body line: 64,000 `{`, none closed", unit: "{", many: 64_000, build: (run) => `${run}\n`, read: braceLabels, answer: none },
    { site: "body line: 64,000 `{` and then a quote that hides the only `}`", unit: "{", many: 64_000, build: (run) => `${run}"}\n`, read: braceLabels, answer: none },
    { site: "body line: 32,000 of `{` then a double quote, none closed", unit: '{"', many: 32_000, build: (run) => `${run}\n`, read: braceLabels, answer: none },
    { site: "body line: 32,000 of `{` then a single quote, none closed", unit: "{'", many: 32_000, build: (run) => `${run}\n`, read: braceLabels, answer: none },
    { site: "body line: a native div with a bare run, `<div` + 64,000 `{` + `></div>`", unit: "{", many: 64_000, build: (run) => `<div${run}></div>\n`, read: braceLabels, answer: none },
    { site: "body line: the item's literal native div, `<div` + 40,000 of `'{'` + `></div>`", unit: "'{'", many: 40_000, build: (run) => `<div${run}></div>\n`, read: braceLabels, answer: none },
    // The table is built wherever the first failing opener is: a run that follows 100,000 characters of text.
    { site: "body line: 100,000 characters of text, then 64,000 `{`, none closed", unit: "{", many: 64_000, build: (run) => `${"x".repeat(100_000)}${run}\n`, read: braceLabels, answer: none },
    // What an unclosed run hides is NOTHING: a real label on the next line is still found.
    { site: "body line: 64,000 `{` and a quote, then a real label on the next line", unit: "{", many: 64_000, build: (run) => `${run}"}\n\n![c](a.png){#fig-z}\n`, read: braceLabels, answer: () => [["fig-z", "fig", 2, 13]] },
    // The table READ at scale: a closed group after the unclosed run, on the SAME line (the answer comes out of the table).
    { site: "body line: 64,000 `{` and a quote, then a closed id block on the same line (the table is built and read)", unit: "{", many: 64_000, build: (run) => `${run}"{#fig-z}\n`, read: braceLabels, answer: (run) => [["fig-z", "fig", 0, run.length + 3]] },
    // `fenceInfoOpensBlock`, under pandoc's reader: the fence is refused, and the heading under it is still a heading.
    { site: "fence info under pandoc: 64,000 `{`, none closed, then a heading", unit: "{", many: 64_000, build: (run) => `\`\`\`${run}\n\n# T\n`, read: braceHeadings, answer: () => [[2, "T", undefined]] },
    { site: "fence info under pandoc: 32,000 of `{` then a double quote, then a heading", unit: '{"', many: 32_000, build: (run) => `\`\`\`${run}\n\n# T\n`, read: braceHeadings, answer: () => [[2, "T", undefined]] },
    { site: "fence info under pandoc, a TILDE fence (never rewritten): 64,000 `{`, a quote, then a closed block; the fence opens, so only the heading after its closer is a heading", unit: "{", many: 64_000, build: (run) => `~~~${run}"{#lst-z}\n\n# T\n~~~\n\n# U\n`, read: braceHeadings, answer: () => [[5, "U", undefined]] },
    // `fenceAttributeId`, under a CommonMark-family reader, which opens the fence without asking `fenceInfoOpensBlock`.
    { site: "fence opener under from: gfm: 64,000 `{`, none closed", unit: "{", many: 64_000, build: (run) => `${GFM}\`\`\`${run}\n\`\`\`\n`, read: braceLabels, answer: none },
    { site: "fence opener under from: gfm: 32,000 of `{` then a single quote, none closed", unit: "{'", many: 32_000, build: (run) => `${GFM}\`\`\`${run}\n\`\`\`\n`, read: braceLabels, answer: none },
    { site: "fence opener under from: gfm, a TILDE fence (never rewritten): 64,000 `{`, a quote, then a closed id block", unit: "{", many: 64_000, build: (run) => `${GFM}~~~${run}"{#lst-z}\n~~~\n`, read: braceLabels, answer: (run) => [["lst-z", "lst", 4, run.length + 6]] },
  ];

  it.each(BRACE_ROWS.map((row) => [row.site, row] as const))("%s: is read in linear time, and the answer is the stated one with 3 units and with the long run", (_site, row) => {
    const shortRun = row.unit.repeat(BRACE_FEW);
    expect(row.read(row.build(shortRun))).toEqual(row.answer(shortRun));
    const run = row.unit.repeat(row.many);
    const longText = row.build(run);
    expect(longText.length).toBeGreaterThan(run.length - 1); // the timed text holds the whole run
    const { result, ms } = timed(() => row.read(longText));
    expect(result).toEqual(row.answer(run));
    expect({ ms, within: withinLimit(ms) }).toMatchObject({ within: true });
  });

  it("builds a different text for every row", () => {
    const shortTexts = BRACE_ROWS.map((row) => row.build(row.unit.repeat(BRACE_FEW)));
    expect(new Set(shortTexts).size).toBe(BRACE_ROWS.length);
    const longTexts = BRACE_ROWS.map((row) => row.build(row.unit.repeat(row.many)));
    expect(new Set(longTexts).size).toBe(BRACE_ROWS.length);
  });

  // A run of 3,000 openers, or a limit of 100 s, would pass on the parent too; a front matter that says `from: pandoc` would stop the two gfm rows reaching `fenceAttributeId`; and a limit read as ten times its constant would pass
  // everything but the slowest rows, so the boundary of `withinLimit` is pinned as well.
  it("keeps the sizes, the limit and the units the Session 326 rows are built on", () => {
    expect([BRACE_FEW, BRACE_LIMIT_MS]).toEqual([3, 1000]);
    expect([withinLimit(BRACE_LIMIT_MS - 1), withinLimit(BRACE_LIMIT_MS)]).toEqual([true, false]);
    expect(GFM).toBe("---\nfrom: gfm\n---\n\n");
    expect(BRACE_ROWS.map((row) => `${row.unit}x${row.many}`)).toEqual([
      "{a} x64000", '{"}"} x64000', "![c](a.png){#fig-a} x16000",
      "{x100000", "xx70000",
      "{x64000", "{x64000", '{"x32000', "{'x32000", "{x64000", "'{'x40000", "{x64000", "{x64000", "{x64000",
      "{x64000", '{"x32000', "{x64000",
      "{x64000", "{'x32000", "{x64000",
    ]);
  });
});

describe("Session 327 — a line holding many `$` whose closing `$` never comes", () => {
  // The `$` half of part (6) of the BACKLOG item "What is still quadratic or deep enough to overflow after Session 311". `findMathRegions` asks, for every `$` that may open inline math (a `$` whose right neighbour is not a blank), where its
  // closer is, and a line with NO closer after it was read to the end for each opener: a line of N unclosed `$` was N reads of the same tail. The profile (Session 327, `--cpu-prof`, 10,667 of `$a `): `scan` (now `scanMathRegions`) 39%,
  // `findInlineClose` (now `nextInlineCloser`) 14%, `isSpace` and the `\s` regex it tests 37% (self time, 1,463 ms in all); the model's own `findBodyLines` takes 6 ms on the same text. A closer is a `$` that is not escaped, has a non-blank on its left and no digit on its right: a test of ONE
  // position, never of the opener, and that is why three different reasons to refuse a closer cost the same.
  // Fresh process per shape, cold (a warm call was within 5%), load average 6 to 8 (Session 327): `$a ` x 2,667 / 5,334 / 10,667 / 21,334 (8,001 to 64,002 characters): 107 / 374 / 1,407 / 5,441 ms (4x per doubling); `$a$1 ` (the closer
  // is followed by a digit) x 3,200 / 6,400 / 12,800 / 25,600: 506 / 1,887 / 7,525 / 30,064 ms; `$a \$ ` (the closer is escaped) x 2,000 / 4,000 / 8,000 / 16,000: 95 / 339 / 1,339 / 5,381 ms. A line whose closers all CLOSE (`$a$ `), a `$` followed by
  // a blank (`$ `) and many SHORT lines are linear on the parent and on the cure (the parent stopped each search at the end of its line, the cure keeps one position), so the controls come first. A closer on the NEXT line must not close an opener (inline math does not span lines), and a closed
  // region after the unclosed run is still found: the rows that say so are the ones a cursor that forgot the line, or lost its place, would fail.
  const MATH_LIMIT_MS = 1000;
  const MATH_FEW = 3;
  const withinLimit = (ms: number): boolean => ms < MATH_LIMIT_MS;
  const mathKeys = (text: string): Array<[string, string, number, number]> => findMathRegions(text).map((region): [string, string, number, number] => [region.type, region.content, region.startLine, region.endLine]);
  type MathRow = { site: string; unit: string; many: number; build: (run: string) => string; answer: (run: string) => unknown };
  const noMath = (): unknown => [];
  const DISPLAY_UNIT = "$a $$1 b $$1 "; // the opener never closes (no `$` of the unit can: a blank to the left, or a digit to the right), and `$$1 b $$` is a display region, whose content is `1 b `

  const MATH_ROWS: MathRow[] = [
    // Controls: every `$` that can open also CLOSES, or cannot open, or the line is short, so the cost is linear before and after.
    { site: "control: 16,000 closed inline regions on one line", unit: "$a$ ", many: 16_000, build: (run) => `${run}z\n`, answer: (run) => Array.from({ length: run.length / 4 }, () => ["inline", "a", 0, 0]) },
    { site: "control: 64,000 `$` each followed by a blank on one line", unit: "$ ", many: 64_000, build: (run) => `${run}\n`, answer: noMath },
    { site: "control: 20,000 short lines, each holding three unclosed `$`", unit: "$a $a $a\n", many: 20_000, build: (run) => run, answer: noMath },
    // Guards: linear on the parent too, so they cannot be RED there; they hold the cure to it. The first opener of a long unclosed run takes a closer at the END of the line (the answer is a position a long way from the start), and one opener
    // takes a closer past index 65,535 (a cursor of 16-bit entries, or a window, would lose it).
    { site: "guard: 21,334 unclosed openers and then a closer at the end of the same line (the first opener takes it)", unit: "$a ", many: 21_334, build: (run) => `${run}b$\n`, answer: (run) => [["inline", `${run.slice(1)}b`, 0, 0]] },
    { site: "guard: one opener, 70,000 characters, then its closer past index 65,535", unit: "x", many: 70_000, build: (run) => `$a${run}b$\n`, answer: (run) => [["inline", `a${run}b`, 0, 0]] },
    // A backslash is asked about only in front of a `$`: a test that asks it of every character reads a run of 64,000 once per character (quadratic), in the scan, in the closer search and in the display search. An even run does not escape the `$`
    // after it, an odd one does, so the three-unit answer is "nothing" and the long one is a region.
    { site: "guard: 64,000 backslashes and then a region (the scan asks about escapes in front of a `$` only)", unit: "\\", many: 64_000, build: (run) => `${run}$a$\n`, answer: (run) => (run.length % 2 === 0 ? [["inline", "a", 0, 0]] : []) },
    { site: "guard: an opener, 64,000 backslashes and then its closer (the closer search asks about escapes in front of a `$` only)", unit: "\\", many: 64_000, build: (run) => `$a${run}$\n`, answer: (run) => (run.length % 2 === 0 ? [["inline", `a${run}`, 0, 0]] : []) },
    { site: "guard: a display region whose body is 64,000 backslashes (the display search asks about escapes in front of a `$$` only)", unit: "\\", many: 64_000, build: (run) => `$$${run}$$\n`, answer: (run) => (run.length % 2 === 0 ? [["display", run, 0, 0]] : []) },
    // What the cursor keeps is a closer on a LATER line here: 10,000 short lines of openers, one closer on the last. A cure that searched again once per line (it would find the same closer) reads the whole text for each line, and the parent does not (48 ms).
    { site: "guard: 10,000 short lines of three unclosed `$` and one closer on the last line (a closer on a later line is kept, not searched for again)", unit: "$a $a $a\n", many: 10_000, build: (run) => `${run}b$\n`, answer: noMath },

    // Reach: the search has no limit in length or in place. All three answers are "nothing", so only the clock sees a search that gives up and starts again. Each is the shape of a refused row below at a size that is quadratic on the parent too, but the
    // parent is not run here: it took 54 s on the 210,000-character row (measured, Session 327, load 6), and extrapolated at 4x per doubling from 5.4 s at 64,002 characters it takes about two minutes at 300,004 and half an hour at 1,200,000 characters (not run). The cure reads each in 10 to 40 ms.
    { site: "reach: 70,000 of `$a `, a line of 210,000 characters, none closes (a reach of 65,536 or 131,072 characters, or a restart there, is caught here)", unit: "$a ", many: 70_000, build: (run) => `${run}\n`, answer: noMath },
    { site: "reach: 400,000 of `$a `, a line of 1.2 million characters, none closes (a reach or a restart at 2^20 characters is caught here)", unit: "$a ", many: 400_000, build: (run) => `${run}\n`, answer: noMath },
    { site: "reach: 100,000 of `$a ` and a closer on the next line (the test that the closer is on another line costs nothing per opener)", unit: "$a ", many: 100_000, build: (run) => `${run}\nb$\n`, answer: noMath },

    // The refused shapes: the RED rows. Each holds only `$` that never close on their own line, so the whole line is read for each.
    { site: "body line: 21,334 of `$a `, none closes (the item's shape)", unit: "$a ", many: 21_334, build: (run) => `${run}\n`, answer: noMath },
    { site: "body line: 9,600 of `$a$1 `, the closer is followed by a digit", unit: "$a$1 ", many: 9_600, build: (run) => `${run}\n`, answer: noMath },
    { site: "body line: 16,000 of `$a \\$ `, the closer is escaped", unit: "$a \\$ ", many: 16_000, build: (run) => `${run}\n`, answer: noMath },
    // The same cause with a `$` between the unclosed openers that opens nothing (a blank to its right), and with a display region between them: a cure that forgot what it knew at either would be quadratic and answer the same.
    { site: "body line: 15,000 of `$a $ `, the second `$` cannot open (a blank to its right)", unit: "$a $ ", many: 15_000, build: (run) => `${run}\n`, answer: noMath },
    { site: "body line: 8,000 of `$a $$1 b $$1 `, an unclosed opener and then a display region whose `$` are followed by a digit", unit: DISPLAY_UNIT, many: 8_000, build: (run) => `${run}\n`, answer: (run) => Array.from({ length: run.length / DISPLAY_UNIT.length }, () => ["display", "1 b ", 0, 0]) },
    // What the cursor knows is kept across the lines of one run, and a skip region starts a fresh scan (`closer` is a local of `scanMathRegions`, which `findMathRegions` calls once per run): a closer on the NEXT line closes nothing before it, a closed region there is still found, and a comment between is a hard boundary.
    { site: "body line: 21,334 of `$a ` and a closer on the next line (inline math does not span lines)", unit: "$a ", many: 21_334, build: (run) => `${run}\nb$\n`, answer: noMath },
    { site: "body line: 21,334 of `$a ` and a closed region on the next line (it is still found)", unit: "$a ", many: 21_334, build: (run) => `${run}\n$b$\n`, answer: () => [["inline", "b", 1, 1]] },
    { site: "body line: 21,334 of `$a `, a comment line, then a closed region (the comment is a boundary, the region is found)", unit: "$a ", many: 21_334, build: (run) => `${run}\n<!-- c -->\n$b$\n`, answer: () => [["inline", "b", 2, 2]] },
    // The search starts wherever the first opener is: a run that follows 100,000 characters of text.
    { site: "body line: 100,000 characters of text, then 21,334 of `$a `, none closes", unit: "$a ", many: 21_334, build: (run) => `${"x".repeat(100_000)}${run}\n`, answer: noMath },
  ];

  it.each(MATH_ROWS.map((row) => [row.site, row] as const))("%s: is read in linear time, and the answer is the stated one with 3 units and with the long run", (_site, row) => {
    const shortRun = row.unit.repeat(MATH_FEW);
    expect(mathKeys(row.build(shortRun))).toEqual(row.answer(shortRun));
    const run = row.unit.repeat(row.many);
    const longText = row.build(run);
    expect(longText.length).toBeGreaterThan(run.length - 1); // the timed text holds the whole run
    const { result, ms } = timed(() => mathKeys(longText));
    expect(result).toEqual(row.answer(run));
    expect({ ms, within: withinLimit(ms) }).toMatchObject({ within: true });
  });

  it("builds a different text for every row", () => {
    // A row may be another row's shape at a larger size (the `reach` rows), so its 3-unit text is the same; two rows that share one must differ in size, or one of them is a copy.
    const bySmallText = new Map<string, number[]>();
    for (const row of MATH_ROWS) {
      const small = row.build(row.unit.repeat(MATH_FEW));
      bySmallText.set(small, [...(bySmallText.get(small) ?? []), row.many]);
    }
    for (const sizes of bySmallText.values()) {
      expect(new Set(sizes).size).toBe(sizes.length);
    }
    const longTexts = MATH_ROWS.map((row) => row.build(row.unit.repeat(row.many)));
    expect(new Set(longTexts).size).toBe(MATH_ROWS.length);
  });

  // A run of 3,000 openers, or a limit of 100 s, would pass on the parent too, and a limit read as ten times its constant would pass every refused row on the parent (the slowest takes 6 to 7 s), so the boundary of `withinLimit` is pinned as well.
  it("keeps the sizes, the limit and the units the Session 327 rows are built on", () => {
    expect([MATH_FEW, MATH_LIMIT_MS]).toEqual([3, 1000]);
    expect([withinLimit(MATH_LIMIT_MS - 1), withinLimit(MATH_LIMIT_MS)]).toEqual([true, false]);
    expect(MATH_ROWS.map((row) => `${row.unit}x${row.many}`)).toEqual([
      "$a$ x16000", "$ x64000", "$a $a $a\nx20000",
      "$a x21334", "xx70000", "\\x64000", "\\x64000", "\\x64000", "$a $a $a\nx10000",
      "$a x70000", "$a x400000", "$a x100000",
      "$a x21334", "$a$1 x9600", "$a \\$ x16000", "$a $ x15000", `${DISPLAY_UNIT}x8000`,
      "$a x21334", "$a x21334", "$a x21334",
      "$a x21334",
    ]);
  });
});

describe("Session 328 — refused fence openers with no blank line between them", () => {
  // Part (3) of the BACKLOG item "What is still quadratic or deep enough to overflow after Session 311". An opener whose info string pandoc refuses (`text i`, a bare `{r`, a tilde fence under an open paragraph) is read as text, and its closer is swallowed into an inline code span; to find the closer the
  // scan walks every non-blank line below the opener until a blank line or a closer (`consumedCloserLine`, Session 224). N such openers in one run with no blank line between them are N walks of the same run: N(N + 1)/2 tests of `isCloser` between them. The cure
  // (`makeConsumedCloserLine`, one reader per document) keeps the span of the last scan of each KIND of opener (the character, the run length, the container columns, the cell indent) and answers an opener that starts inside it from it; the old
  // function is the oracle in test/unit/consumed-closer-equivalence.test.ts. A reader with ONE slot instead of one per kind would be linear on every row but the two that interleave kinds (the third of that group, a line of text under each opener, holds one kind and is linear on a one-slot reader too, as the review found), which is why those two are here.
  // The profile (Session 328, `--cpu-prof`, `findHeadings`, 12,000 lines of `` ```text i ``, 2,304 ms in all): the closer regex `FENCE_CLOSE` 48.9%, `consumedCloserLine` 29.0%, `fenceMatchAt` 16.3%, `computeRegions` itself 2.0%; `{r` and `~~~r` at 8,000 lines are 48 / 27 / 16 and 47 / 26 / 18 in the same profile; the review's, at a load near 100, read 50 / 27 / 18 for the first shape, 49.7 / 20.6 / 15.6 with `computeRegions` at 7.1% for `{r`, and 48.6 / 26.9 / 15.9 for `~~~r`: the split moves by a few points between runs.
  // Fresh process per shape, cold (Session 328, load average 2.7 to 4.1): `` ```text i `` x 3,000 / 6,000 / 12,000 through `findHeadings`: 162 / 576 / 2,243 ms (4x per doubling; the item's 0.56 s and 2.2 s held), through `findAllCells` 160 / 564 / 2,173 ms; at 16,000 lines `findHeadings` 3,795 ms,
  // `findAllCells` 3,828, `buildOutline` 3,807, `indexLabels` 3,891; distinct info strings 3,977; `` ```{r `` 3,873; `~~~{r a}` 3,706; `~~~r` 3,755; a closer at the END of the run 3,863 (every opener walks to it); `> ` quoted openers 703 / 2,728 ms at 8,000 / 16,000; openers inside a list item 1,368 / 5,398 ms;
  // two such runs of 8,000 / 16,000 openers with a closer between them 1,924 / 7,737 ms. A valid info string (`` ```r ``: declined, not refused) is linear (175 ms at 64,000), and so is a blank line after each opener, a closer under each opener, and many short runs, so the controls come first.
  // The rows that matter for the answer are the ones with a closer: a refused opener swallows the closer below it, and a closer that is NOT swallowed opens a fence of its own and hides the headings after it. `FENCE_TAIL` is built to show it: the closer line, then a fence pair around `# In`. With the closer swallowed
  // only `# After` is a heading; if the closer opened a fence, `# In` would show too.
  const FENCE_LIMIT_MS = 1000;
  const FENCE_FEW = 3;
  const withinFenceLimit = (ms: number): boolean => ms < FENCE_LIMIT_MS;
  const headingKeys = (text: string): Array<[number, string, number]> => findHeadings(text).map((heading): [number, string, number] => [heading.level, heading.text, heading.line]);
  const FENCE_TAIL = "\n```\n\n# In\n\n```\n\n# After\n";
  type FenceEntry = "headings" | "cells" | "labels";
  type FenceRow = { site: string; entry: FenceEntry; many: number; build: (count: number) => string; answer: (count: number) => unknown };
  const readFence = (entry: FenceEntry, text: string): unknown => (entry === "headings" ? headingKeys(text) : entry === "cells" ? findAllCells(text) : indexLabels(text));
  const nothing = (): unknown => [];
  const afterAt = (line: number): unknown => [[1, "After", line]];
  const RUN3 = "```text i\n```text i\n```text i\n";

  const FENCE_ROWS: FenceRow[] = [
    // Controls: linear before and after.
    { site: "control: 64,000 openers whose info string is valid (declined, not refused)", entry: "headings", many: 64_000, build: (count) => "```r\n".repeat(count), answer: nothing },
    { site: "control: 16,000 refused openers, a blank line after each", entry: "headings", many: 16_000, build: (count) => "```text i\n\n".repeat(count), answer: nothing },
    { site: "control: 16,000 refused openers, each closed by the line below it", entry: "headings", many: 16_000, build: (count) => "```text i\n```\n\n".repeat(count), answer: nothing },
    { site: "control: 5,000 runs of three refused openers, a blank line after each run", entry: "headings", many: 5_000, build: (count) => `${RUN3}\n`.repeat(count), answer: nothing },
    // Guards: linear on the parent too (the runs are short), so they cannot be RED there; they hold the cure to the answer. Every closer is swallowed by the run above it and every heading is found; a closer that was NOT swallowed would open a fence and hide the heading after it.
    { site: "guard: 4,000 runs of three refused openers, a closer, a blank line and a heading (each closer is swallowed, each heading found)", entry: "headings", many: 4_000, build: (count) => `${RUN3}\`\`\`\n\n# H\n\n`.repeat(count), answer: (count) => Array.from({ length: count }, (_, k) => [1, "H", 7 * k + 5]) },
    // A run with no closer must not hand its answer ("none") to the next run, which has one: 4,000 pairs of a run without and a run with a closer.
    { site: "guard: 4,000 pairs of a run with no closer and a run with one (the answer of one run is not the next run's)", entry: "headings", many: 4_000, build: (count) => `${RUN3}\n# H\n\n${RUN3}\`\`\`\n\n# H\n\n`.repeat(count), answer: (count) => Array.from({ length: count }, (_, k) => [[1, "H", 13 * k + 4], [1, "H", 13 * k + 11]]).flat() },

    // The refused shapes: the RED rows.
    { site: "run: 16,000 of `` ```text i ``, none closes (the item's shape)", entry: "headings", many: 16_000, build: (count) => "```text i\n".repeat(count), answer: nothing },
    { site: "run: 16,000 of `` ```text <i> `` with distinct i (the item: the lines need not be equal)", entry: "headings", many: 16_000, build: (count) => Array.from({ length: count }, (_, i) => `\`\`\`text ${i}\n`).join(""), answer: nothing },
    { site: "run: 16,000 of `` ```{r `` (a bare brace, no closing brace)", entry: "headings", many: 16_000, build: (count) => "```{r\n".repeat(count), answer: nothing },
    { site: "run: 16,000 of `~~~{r a}` (a tilde fence under an open paragraph)", entry: "headings", many: 16_000, build: (count) => "~~~{r a}\n".repeat(count), answer: nothing },
    { site: "run: 16,000 of `~~~r` (a tilde fence under an open paragraph)", entry: "headings", many: 16_000, build: (count) => "~~~r\n".repeat(count), answer: nothing },
    { site: "run: 16,000 of `` ```text i `` and a closer at the end of the run (every opener walks to it; only `# After` is a heading)", entry: "headings", many: 16_000, build: (count) => `${"```text i\n".repeat(count)}\`\`\`${FENCE_TAIL}`, answer: (count) => afterAt(count + 7) },
    { site: "run: 10,000 + 10,000 of `` ```text i `` with a closer after each run", entry: "headings", many: 10_000, build: (count) => `${"```text i\n".repeat(count)}\`\`\`\n\n${"```text i\n".repeat(count)}\`\`\`${FENCE_TAIL}`, answer: (count) => afterAt(2 * count + 9) },
    { site: "run: 20,000 quoted openers `> ```text i`", entry: "headings", many: 20_000, build: (count) => `${"> ```text i\n".repeat(count)}\n# After\n`, answer: (count) => afterAt(count + 1) },
    { site: "run: 12,000 openers inside a list item", entry: "headings", many: 12_000, build: (count) => `- a\n${"  ```text i\n".repeat(count)}\n# After\n`, answer: (count) => afterAt(count + 2) },
    // Kinds in one run: each kind keeps its own span. Alternating two kinds, cycling three, and a line of text between openers (the opener below a text line is refused by the same rule).
    { site: "run: 16,000 lines alternating `` ```text i `` and `~~~{r a}` (two kinds in one run)", entry: "headings", many: 16_000, build: (count) => Array.from({ length: count }, (_, i) => `${i % 2 === 0 ? "```text i" : "~~~{r a}"}\n`).join(""), answer: nothing },
    { site: "run: 16,000 lines cycling `` ```text i ``, `` ````text i `` and `~~~r` (three kinds in one run)", entry: "headings", many: 16_000, build: (count) => Array.from({ length: count }, (_, i) => `${["```text i", "````text i", "~~~r"][i % 3]}\n`).join(""), answer: nothing },
    { site: "run: 12,000 refused openers, a line of text under each", entry: "headings", many: 12_000, build: (count) => "```text i\nsome text\n".repeat(count), answer: nothing },
    // The same scan serves every reader of the regions, so the item's shape is also timed through two other entries.
    { site: "entry findAllCells: 15,000 of `` ```text i ``", entry: "cells", many: 15_000, build: (count) => "```text i\n".repeat(count), answer: nothing },
    { site: "entry indexLabels: 14,000 of `` ```text i ``", entry: "labels", many: 14_000, build: (count) => "```text i\n".repeat(count), answer: nothing },
  ];

  it.each(FENCE_ROWS.map((row) => [row.site, row] as const))("%s: is read in linear time, and the answer is the stated one with 3 units and with the long run", (_site, row) => {
    expect(readFence(row.entry, row.build(FENCE_FEW))).toEqual(row.answer(FENCE_FEW));
    const longText = row.build(row.many);
    const { result, ms } = timed(() => readFence(row.entry, longText));
    expect(result).toEqual(row.answer(row.many));
    expect({ ms, within: withinFenceLimit(ms) }).toMatchObject({ within: true });
  });

  it("builds a different text for every row", () => {
    const small = FENCE_ROWS.map((row) => row.build(FENCE_FEW));
    // The TEXT alone, not the entry with it: `scanRegions` keeps the last two scans by text (`regionsCache`), so a row whose text another row read just before it is served from the cache and cannot be RED (the first draft's `indexLabels` row passed on the parent for that reason).
    const long = FENCE_ROWS.map((row) => row.build(row.many));
    expect(new Set(long).size).toBe(FENCE_ROWS.length);
    // Two rows may share a small text only if they differ in size or entry (a larger copy of a shape, or the same shape through another reader).
    const bySmall = new Map<string, string[]>();
    FENCE_ROWS.forEach((row, k) => bySmall.set(small[k], [...(bySmall.get(small[k]) ?? []), `${row.entry}:${row.many}`]));
    for (const sizes of bySmall.values()) {
      expect(new Set(sizes).size).toBe(sizes.length);
    }
  });

  it("builds the interleaved rows from the kinds they are named for", () => {
    const interleaved = FENCE_ROWS.filter((row) => row.site.includes("in one run"));
    expect(interleaved.map((row) => row.build(4))).toEqual(["```text i\n~~~{r a}\n```text i\n~~~{r a}\n", "```text i\n````text i\n~~~r\n```text i\n"]);
  });

  // A run of 3,000 openers, or a limit of 100 s, would pass on the parent too (the RED rows take 3.2 to 4.5 s on the parent, measured by the review at load near 126; the cure takes 23 to 63 ms), so the boundary of `withinFenceLimit` is pinned, and the sizes the rows are built on.
  it("keeps the sizes, the limit and the shapes the Session 328 rows are built on", () => {
    expect([FENCE_FEW, FENCE_LIMIT_MS]).toEqual([3, 1000]);
    expect([withinFenceLimit(FENCE_LIMIT_MS - 1), withinFenceLimit(FENCE_LIMIT_MS)]).toEqual([true, false]);
    expect(FENCE_ROWS.map((row) => `${row.entry} ${row.many} ${JSON.stringify(row.build(1))}`)).toEqual([
      'headings 64000 "```r\\n"',
      'headings 16000 "```text i\\n\\n"',
      'headings 16000 "```text i\\n```\\n\\n"',
      'headings 5000 "```text i\\n```text i\\n```text i\\n\\n"',
      'headings 4000 "```text i\\n```text i\\n```text i\\n```\\n\\n# H\\n\\n"',
      'headings 4000 "```text i\\n```text i\\n```text i\\n\\n# H\\n\\n```text i\\n```text i\\n```text i\\n```\\n\\n# H\\n\\n"',
      'headings 16000 "```text i\\n"',
      'headings 16000 "```text 0\\n"',
      'headings 16000 "```{r\\n"',
      'headings 16000 "~~~{r a}\\n"',
      'headings 16000 "~~~r\\n"',
      `headings 16000 ${JSON.stringify(`\`\`\`text i\n\`\`\`${FENCE_TAIL}`)}`,
      `headings 10000 ${JSON.stringify(`\`\`\`text i\n\`\`\`\n\n\`\`\`text i\n\`\`\`${FENCE_TAIL}`)}`,
      'headings 20000 "> ```text i\\n\\n# After\\n"',
      'headings 12000 "- a\\n  ```text i\\n\\n# After\\n"',
      'headings 16000 "```text i\\n"',
      'headings 16000 "```text i\\n"',
      'headings 12000 "```text i\\nsome text\\n"',
      'cells 15000 "```text i\\n"',
      'labels 14000 "```text i\\n"',
    ]);
  });
});

describe("Session 329 — the two documents of the Session 311 item's part (5), closed by other changes and pinned here", () => {
  // The BACKLOG item "What is still quadratic or deep enough to overflow after Session 311", part (5), named two documents: a front matter block scalar (`description: |` and 10,000 indented lines, 2.1 s in
  // `resolveDocumentEngine`) and many `---` groups (33,000 four-line groups of `---`, `from: gfm`, `---`, `text`, 22 s in `findHeadings`). Both are already linear, closed by commits aimed at other parts: the scalar by `778ea19`
  // (Session 314: `nestedParentPath` reads the nearest shallower line from an index), the groups by `b63fafc` (Session 322, B89 part (8): the HTML-comment state is read once for all of a document's metadata blocks).
  // Neither commit had a row for these texts. At the sizes pinned here the build before each cure takes about 9 s (scalar, 20,000 lines, `414f19f`) and 3.5 s (groups, 12,000, `f36f663`, the last commit before `b63fafc`
  // that touched `src/`), against about 60 ms and 185 ms at HEAD.
  // Under `from: gfm` every `text` line followed by `---` is a setext heading, so a group document's answer is a list of headings, not an empty one (quarto 1.7.33 renders the three-group document as h2 `text`, h2 `from: gfm`,
  // h2 `text`, h2 `from: gfm`, h1 `H`, which the small answer pins). Every row builds a text no other row builds: `scanRegions` memoizes the last two texts, so a second row on the same text would be answered from the memo.
  // These rows pass on arrival (the code was already fixed); their RED is `s329-part5-pins.json`, four edits that put the cost back. The two larger rows are for a quadratic with a small constant (`s329-part5-pins-review.json`).
  const SCALAR_LINES = 20_000;
  const GROUPS = 12_000;
  const SCALAR_LINES_LARGE = 100_000;
  const GROUPS_LARGE = 24_000;
  const FEW = 200;
  const PART5_LIMIT_MS = 1000;
  const KNITR_TAIL = "execute:\n  engine: knitr\n";
  const scalarDocument = (lines: number, word: string, tail = ""): string => `---\ndescription: |\n${`  ${word} line of the block scalar\n`.repeat(lines)}${tail}---\n\n# H\n`;
  const groupsDocument = (groups: number, tail: string): string => `${"---\nfrom: gfm\n---\ntext\n".repeat(groups)}${tail}`;
  const pythonCell = (label: string): string => `\n\`\`\`{python}\n#| label: ${label}\nx = 1\n\`\`\`\n`;
  const nestedEngine = (lines: number): unknown => ({ line: lines + 3, parentPath: ["execute"], key: "engine", valueRange: { startCol: 10, endCol: 15 }, rawToken: "knitr" });
  /** Under `from: gfm` (0-based lines): group i's `text` (line 4i + 3) is underlined by the next group's opening `---`, and the next group's `from: gfm` (line 4i + 5) by its closing `---`; the last `text` (line 4n - 1) is not, and the heading at the end is line 4n. */
  const groupHeadings = (groups: number): Array<[number, string]> => {
    const out: Array<[number, string]> = [];
    for (let i = 0; i < groups - 1; i++) out.push([4 * i + 3, "text"], [4 * i + 5, "from: gfm"]);
    out.push([4 * groups, "H"]);
    return out;
  };
  const headingPairs = (text: string): Array<[number, string]> => findHeadings(text).map((heading): [number, string] => [heading.line, heading.text]);
  const valueSourceCounts = (text: string): unknown => {
    const sources = collectValueSources(text);
    return { lines: sources.lines.length, cellLines: sources.cellLines.length, nested: sources.nestedLines.length, flags: valueFlags(sources, "a.qmd", CURATED_SCHEMA_INDEX) };
  };
  type PartRow = { site: string; build: (n: number) => string; read: (text: string) => unknown; answer: (n: number) => unknown };

  const SCALAR_ROWS: PartRow[] = [
    { site: "resolveDocumentEngine, the item's document (a scalar, then the closing ---)", build: (n) => scalarDocument(n, "alpha"), read: (text) => resolveDocumentEngine("a.qmd", text), answer: () => "markdown" },
    // A nested `engine: knitr` AFTER the scalar answers "knitr" only if the enumeration reaches the last line (nothing before it names an engine).
    { site: "resolveDocumentEngine, then a nested engine after the scalar", build: (n) => scalarDocument(n, "beta", KNITR_TAIL), read: (text) => resolveDocumentEngine("a.qmd", text), answer: () => "knitr" },
    { site: "findNestedFrontMatterValueLines, then a nested engine after the scalar", build: (n) => scalarDocument(n, "gamma", KNITR_TAIL), read: findNestedFrontMatterValueLines, answer: (n) => [nestedEngine(n)] },
    { site: "collectValueSources and valueFlags, then a nested engine after the scalar", build: (n) => scalarDocument(n, "delta", KNITR_TAIL), read: valueSourceCounts, answer: (n) => ({ lines: n + 8, cellLines: 0, nested: 1, flags: { cell: [], frontMatter: [], nested: [] } }) },
  ];
  const GROUP_ROWS: PartRow[] = [
    { site: "findHeadings, the item's text and a heading at the end", build: (n) => groupsDocument(n, "# H\n"), read: headingPairs, answer: groupHeadings },
    { site: "resolveDocumentEngine, a python cell at the end", build: (n) => groupsDocument(n, pythonCell("lst-b")), read: (text) => resolveDocumentEngine("a.qmd", text), answer: () => "jupyter" },
    { site: "findAllCells, a python cell at the end", build: (n) => groupsDocument(n, pythonCell("lst-c")), read: (text) => findAllCells(text).length, answer: () => 1 },
    { site: "indexLabels, a cell label at the end", build: (n) => groupsDocument(n, pythonCell("lst-a")), read: (text) => indexLabels(text).map((label) => `${label.id}@${label.line}:${label.column}`), answer: (n) => [`lst-a@${4 * n + 2}:10`] },
  ];

  // The same two documents at sizes where a quadratic with a small constant (an index rebuilt every 256th line, a stack never popped, a copy of the rest of the document for each block) is no longer under the limit.
  const LARGE_ROWS: Array<{ site: string; lines: number; build: () => string; read: (text: string) => unknown; answer: () => unknown }> = [
    { site: "resolveDocumentEngine, a scalar of 100,000 lines then a nested engine", lines: SCALAR_LINES_LARGE, build: () => scalarDocument(SCALAR_LINES_LARGE, "epsilon", KNITR_TAIL), read: (text) => resolveDocumentEngine("a.qmd", text), answer: () => "knitr" },
    { site: "findHeadings, 24,000 groups and a heading at the end", lines: 4 * GROUPS_LARGE, build: () => groupsDocument(GROUPS_LARGE, "# H\n"), read: headingPairs, answer: () => groupHeadings(GROUPS_LARGE) },
  ];

  it("pins the small answers first: three scalar lines, then three groups (the answer quarto renders)", () => {
    expect(resolveDocumentEngine("a.qmd", scalarDocument(3, "small"))).toBe("markdown");
    expect(resolveDocumentEngine("a.qmd", scalarDocument(3, "small-k", KNITR_TAIL))).toBe("knitr");
    expect(findNestedFrontMatterValueLines(scalarDocument(3, "small-n"))).toEqual([]);
    expect(findNestedFrontMatterValueLines(scalarDocument(3, "small-n", KNITR_TAIL))).toEqual([nestedEngine(3)]);
    expect(groupHeadings(3)).toEqual([[3, "text"], [5, "from: gfm"], [7, "text"], [9, "from: gfm"], [12, "H"]]);
    expect(findHeadings(groupsDocument(3, "# H\n")).map((heading) => [heading.level, heading.line, heading.text])).toEqual([[2, 3, "text"], [2, 5, "from: gfm"], [2, 7, "text"], [2, 9, "from: gfm"], [1, 12, "H"]]);
  });

  it.each(SCALAR_ROWS.map((row) => [row.site, row] as const))("%s: 20,000 lines are read in linear time, and the answer is the stated one at 200 lines and at 20,000", (_site, row) => {
    expect(row.read(row.build(FEW))).toEqual(row.answer(FEW));
    const longText = row.build(SCALAR_LINES);
    expect(longText.split("\n").length).toBeGreaterThan(SCALAR_LINES); // the timed text is the long one
    const { result, ms } = timed(() => row.read(longText));
    expect(result).toEqual(row.answer(SCALAR_LINES));
    expect(ms).toBeLessThan(PART5_LIMIT_MS);
  });

  it.each(GROUP_ROWS.map((row) => [row.site, row] as const))("%s: 12,000 groups are read in linear time, and the answer is the stated one at 200 groups and at 12,000", (_site, row) => {
    expect(row.read(row.build(FEW))).toEqual(row.answer(FEW));
    const longText = row.build(GROUPS);
    expect(longText.split("\n").length).toBeGreaterThan(4 * GROUPS); // the timed text is the long one
    const { result, ms } = timed(() => row.read(longText));
    expect(result).toEqual(row.answer(GROUPS));
    expect(ms).toBeLessThan(PART5_LIMIT_MS);
  });

  it.each(LARGE_ROWS.map((row) => [row.site, row] as const))("%s: read in linear time at the larger size", (_site, row) => {
    const text = row.build();
    expect(text.split("\n").length).toBeGreaterThan(row.lines); // the timed text is the long one
    const { result, ms } = timed(() => row.read(text));
    expect(result).toEqual(row.answer());
    expect(ms).toBeLessThan(PART5_LIMIT_MS);
  });

  it("builds a different text for every row", () => {
    const texts = [...SCALAR_ROWS, ...GROUP_ROWS].map((row) => row.build(FEW));
    expect(new Set(texts).size).toBe(SCALAR_ROWS.length + GROUP_ROWS.length);
  });

  // A row run at 200 lines, or allowed 100 s, would pass on the parent too.
  it("keeps the sizes and the limit the Session 329 rows are built on", () => {
    expect([SCALAR_LINES, GROUPS, SCALAR_LINES_LARGE, GROUPS_LARGE, FEW, PART5_LIMIT_MS]).toEqual([20_000, 12_000, 100_000, 24_000, 200, 1000]);
  });
});

describe("Session 330 — a heading line holding a long run of `#`, backslashes or `{`", () => {
  // The former BACKLOG item (closed, CHANGELOG: Session 334) "Eight more regexes and one paragraph reader that are quadratic on a long line or a long paragraph", parts (2) and (3). `buildHeading` strips a trailing attribute block and the reader's closing-hash run from
  // every heading, each by an unanchored regex that opens with a backslash-parity lookbehind: `ATX_CLOSING_PANDOC` (`(?<=(?:^|[^\\])(?:\\\\)*)#+[ \t]*$`, the pandoc `markdown*` readers) and `HEADING_ATTRIBUTE`
  // (`(?<=(?:^|[^\\])(?:\\\\)*)\{[^}]*\}[ \t]*$`, the readers that honour an attribute block). Both can fail only at the END of the line, so every start that cannot match still reads on: each `#` of a run inside the text reads the rest
  // of the run, each `{` of a run with no closing `}` reads to the end of the line, and, because the lookbehind comes first and is tried at EVERY index, a run of backslashes costs a walk back over the run per index (no `#` or `{`
  // needed). Profile (Session 330, `node --cpu-prof`, load 3 to 5): `# a ` + `#` x 30,000: 98.5% in the closing regex; `# a ` + `{` x 40,000: 94.1% in the attribute regex; `# ` + a backslash x 40,000: 47.5% and 47.3%.
  // The reader isolates the regex: `markdown_github` strips an unspaced closing run and renders a trailing `{...}` as text (closing regex only), `commonmark_x` is the reverse (attribute regex only), `gfm` uses neither, and no
  // `from:` uses both. Bare `findHeadings`, a warm call after a warm-up call, load average 4 to 6 (Session 330), against a limit of 1,000 ms: `#` x 40,000 inside the text 5,135 ms (default) and 5,155 (`markdown_github`); 100,000
  // backslashes 5,385 (default), 2,763 (`markdown_github`), 2,683 (`commonmark_x`); `{` x 100,000 4,703 (default), 4,728 (`commonmark_x`), and as a setext heading 4,710; the controls below take 1 to 9 ms. The rows are sized for
  // about 3.5 to 4.5 s on the parent, under vitest's 5 s default so that the failure is the clock assertion and not a timeout, and the controls come first so the patterns are warm (Learning 816).
  const TAIL_LIMIT_MS = 1000;
  const TAIL_FEW = 4;
  const tailHeadings = (text: string): Array<[number, string, string | undefined]> => findHeadings(text).map((heading): [number, string, string | undefined] => [heading.line, heading.text, heading.id]);
  const frontMatter = (from: string | null): string => (from === null ? "" : `---\nfrom: ${from}\n---\n\n`);
  type TailRow = { site: string; from: string | null; unit: string; many: number; build: (run: string) => string; text: (run: string) => string; id?: string };

  const TAIL_ROWS: TailRow[] = [
    // Controls: linear on the parent too (the first start matches, or no start passes the lookbehind), so they cannot be RED there; they hold the cure to the same answers at the same size.
    { site: "control: a closing run of 100,000 `#` after a blank", from: null, unit: "#", many: 100_000, build: (run) => `# a ${run}\n`, text: () => "a" },
    { site: "control: a closing run of 100,000 `#` after one backslash (odd parity: the second `#` starts the run)", from: null, unit: "#", many: 100_000, build: (run) => `# a \\${run}\n`, text: () => "a #" },
    { site: "control: 50,000 escaped braces and a `}`", from: null, unit: "\\{", many: 50_000, build: (run) => `# a ${run}x}\n`, text: (run) => `a ${"{".repeat(run.length / 2)}x}` },
    { site: "control: 100,000 `{` then a block that is not one", from: null, unit: "{", many: 100_000, build: (run) => `# a ${run}#sec-x}\n`, text: (run) => `a ${run}#sec-x}` },
    { site: "control: 100,000 `{` and a `}` at the end", from: null, unit: "{", many: 100_000, build: (run) => `# a ${run}}\n`, text: (run) => `a ${run}}` },
    { site: "control: a valid attribute block after 200,000 characters of text", from: null, unit: "x", many: 200_000, build: (run) => `# ${run} {#sec-a}\n`, text: (run) => run, id: "sec-a" },
    { site: "control: 100,000 backslashes under from: gfm (neither regex is used)", from: "gfm", unit: "\\", many: 100_000, build: (run) => `# ${run}\n`, text: (run) => "\\".repeat(run.length / 2) },

    // The closing-hash regex (`markdown*` readers): a run of `#` INSIDE the text, a backslash run, and an odd-parity run.
    { site: "heading: 32,000 `#` inside the text, then a letter", from: null, unit: "#", many: 32_000, build: (run) => `# a ${run}b\n`, text: (run) => `a ${run}b` },
    { site: "heading: 32,000 `#` inside the text, then a letter, under from: markdown_github (the closing regex alone)", from: "markdown_github", unit: "#", many: 32_000, build: (run) => `# a ${run}b\n`, text: (run) => `a ${run}b` },
    { site: "heading: 32,000 `#` inside the text, a letter, then a real closing run", from: null, unit: "#", many: 32_000, build: (run) => `# a ${run}b ##\n`, text: (run) => `a ${run}b` },
    { site: "heading: one backslash, 32,000 `#`, then a letter", from: null, unit: "#", many: 32_000, build: (run) => `# a \\${run}b\n`, text: (run) => `a ${run}b` },
    { site: "heading: 80,000 backslashes", from: null, unit: "\\", many: 80_000, build: (run) => `# ${run}\n`, text: (run) => "\\".repeat(run.length / 2) },
    { site: "heading: 120,000 backslashes under from: markdown_github (the closing regex alone)", from: "markdown_github", unit: "\\", many: 120_000, build: (run) => `# ${run}\n`, text: (run) => "\\".repeat(run.length / 2) },
    { site: "heading: 80,000 backslashes and a `#` inside the text", from: null, unit: "\\", many: 80_000, build: (run) => `# ${run}#b\n`, text: (run) => `${"\\".repeat(run.length / 2)}#b` },

    // The attribute regex (readers that honour a block): a `{` run with no `}`, with a `}` and text after it, an even-parity run, a setext heading, and a backslash run under the one reader that uses it alone.
    { site: "heading: 90,000 `{`, none closed", from: null, unit: "{", many: 90_000, build: (run) => `# a ${run}\n`, text: (run) => `a ${run}` },
    { site: "heading: 90,000 `{`, none closed, under from: commonmark_x (the attribute regex alone)", from: "commonmark_x", unit: "{", many: 90_000, build: (run) => `# a ${run}\n`, text: (run) => `a ${run}` },
    { site: "setext: 90,000 `{`, none closed", from: null, unit: "{", many: 90_000, build: (run) => `${run}\n===\n`, text: (run) => run },
    { site: "heading: 90,000 `{` and a `}` followed by text", from: null, unit: "{", many: 90_000, build: (run) => `# a ${run}} b\n`, text: (run) => `a ${run}} b` },
    { site: "heading: 50,000 of an escaped backslash and a `{`, none closed", from: null, unit: "\\\\{", many: 50_000, build: (run) => `# a ${run}\n`, text: (run) => `a ${"\\{".repeat(run.length / 3)}` },
    { site: "heading: 120,000 backslashes under from: commonmark_x (the attribute regex alone)", from: "commonmark_x", unit: "\\", many: 120_000, build: (run) => `# ${run}\n`, text: (run) => "\\".repeat(run.length / 2) },
  ];

  it.each(TAIL_ROWS.map((row) => [row.site, row] as const))("%s: is read in linear time, and the answer is the stated one with 4 units and with the long run", (_site, row) => {
    const line = row.from === null ? 0 : 4;
    const heading = (run: string): Array<[number, string, string | undefined]> => [[line, row.text(run), row.id]];
    const shortRun = row.unit.repeat(TAIL_FEW);
    expect(tailHeadings(frontMatter(row.from) + row.build(shortRun))).toEqual(heading(shortRun));
    const run = row.unit.repeat(row.many);
    const longText = frontMatter(row.from) + row.build(run);
    expect(longText.length).toBeGreaterThan(run.length); // the timed text holds the whole run
    const { result, ms } = timed(() => tailHeadings(longText));
    expect(result).toEqual(heading(run));
    expect(ms).toBeLessThan(TAIL_LIMIT_MS);
  });

  it("builds a different text for every row", () => {
    const shortTexts = TAIL_ROWS.map((row) => frontMatter(row.from) + row.build(row.unit.repeat(TAIL_FEW)));
    expect(new Set(shortTexts).size).toBe(TAIL_ROWS.length);
    const longTexts = TAIL_ROWS.map((row) => frontMatter(row.from) + row.build(row.unit.repeat(row.many)));
    expect(new Set(longTexts).size).toBe(TAIL_ROWS.length);
  });

  // A run of 3,000 characters, or a limit of 100 s, would pass on the parent too.
  it("keeps the sizes, the limit and the units the Session 330 rows are built on", () => {
    expect([TAIL_FEW, TAIL_LIMIT_MS]).toEqual([4, 1000]);
    expect(TAIL_ROWS.map((row) => `${row.unit}x${row.many}`)).toEqual([
      "#x100000", "#x100000", "\\{x50000", "{x100000", "{x100000", "xx200000", "\\x100000",
      "#x32000", "#x32000", "#x32000", "#x32000", "\\x80000", "\\x120000", "\\x80000",
      "{x90000", "{x90000", "{x90000", "{x90000", "\\\\{x50000", "\\x120000",
    ]);
  });
});

describe("Session 331 — consecutive lines that each open a container column nothing closes", () => {
  // Part (1) of the BACKLOG item "More quadratic and stack-overflow shapes found by Session 319's sweep and review". `computeRegions` keeps a stack of container content columns (`contentColumns`, with a kind and a CommonMark flag per entry) and pushes
  // one for every line that opens a container: a definition marker (`: a`, `~ a`, `[^1]: a`, at an indent that is not code, and in a quote) and the list markers the model over-accepts (`A. a`, `I. a`, `aa. a`). A line pops only in a few
  // cases (the line above it is blank, a CommonMark block start ends the items, or it is a marker that closes a LIST item, among others), and none of these does, so N such lines leave a stack of N entries and each of the dozen readers a line asks (`columnKinds.includes`, `.some`, `.every`, `indentedCodeLine`, the `[0, ...contentColumns]`
  // spreads, `blockQuoteContentStart`) reads all N: N(N + 1)/2 steps between them. Under `from: commonmark_x` a `~ a` line is also a paragraph line and the setext-title test scans the paragraph so far, spreading the stack for each of its lines:
  // cubic.
  // Profile (Session 331, `node --cpu-prof`, load 7 to 8): `: a` x 16,000 `computeRegions` itself 40.7%, `scanRegions` 27.9% (callees inlined), the `.every` and `.some` callbacks 10.6%, `indentedCodeLine` 5.1%, `blockQuoteContentStart` 4.0%;
  // `~ a` x 2,000 under `commonmark_x` 53% in the paragraph-interrupt callback and 37% in `computeRegions`.
  // Fresh process per size, cold, `findHeadings`, load 6 to 8 (Session 331): `: a` x 2,000 / 4,000 / 8,000 / 16,000 135 / 319 / 990 / 3,927 ms (4x per doubling), `~ a` 131 / 342 / 1,073 / 3,933, `  : a` 3,909, `> : a` 3,956, `[^1]: a` 3,940,
  // `A. a` 4,130, `I. a` 4,140, `aa. a` 4,120; alternating `: a` and `A. a` 4,262 ms at 16,000 lines; `: a` and `  : a` alternating 4,046; every other reader of the regions pays the same (`findAllCells`, `indexLabels`, `buildOutline` 1.1 s at 8,000);
  // a blank line after each line 92 ms at 16,000; `- a` (a bullet pops its predecessor) 76 ms. Under `commonmark_x`: `~ a` x 250 / 500 / 1,000 / 2,000 52 / 232 / 1,556 / 11,864 ms (8x per doubling), `: a` (not a paragraph line there, so not cubic) 143 / 363 / 1,184 / 4,530 ms at 2,000 / 4,000 / 8,000 / 16,000, quadratic like the default reader.
  // The TAIL of a row is what makes its answer depend on the stack: `# After` after a blank line is a heading whatever the stack held; an indented `# H` is a heading only at the container's column, and only while that column is still known (after two of `: a`, `~ a`, `[^1]: a`, `aa. a` the indents 0 and 4 give
  // a heading, after `A. a`, `I. a` the indents 0 and 3: measured on the parent and the cure, indents 0 to 9), and for a stack that had lost its column it would be indented code.
  // The paragraph factor of that cubic is the former BACKLOG item (closed, CHANGELOG: Session 334) "Eight more regexes and one paragraph reader" part (9): plain `a` lines under `commonmark_x` take 373 / 1,382 / 5,406 / 20,967 ms at 2,000 / 4,000 / 8,000 / 16,000 with an EMPTY stack, so the
  // `commonmark_x` row below is relative to that floor and not an absolute limit.
  const COLUMN_LIMIT_MS = 1000;
  const COLUMN_FEW = 3;
  const withinColumnLimit = (ms: number): boolean => ms < COLUMN_LIMIT_MS;
  type ColumnEntry = "headings" | "cells" | "labels";
  type ColumnRow = { site: string; entry: ColumnEntry; many: number; build: (count: number) => string; answer: (count: number) => unknown };
  const columnHeadings = (text: string): Array<[number, string, number]> => findHeadings(text).map((heading): [number, string, number] => [heading.level, heading.text, heading.line]);
  const readColumns = (entry: ColumnEntry, text: string): unknown => (entry === "headings" ? columnHeadings(text) : entry === "cells" ? findAllCells(text).map((cell) => [cell.lang, cell.startLine, cell.endLine]) : indexLabels(text).map((label) => [label.id, label.line]));
  const AFTER = "\n# After\n";
  const INDENTED = "\n    # H\n";
  const CELL = "\n```{r}\n1\n```\n";
  const LABEL = "\n# H {#sec-h}\n";
  const none = (): unknown => [];
  const afterLine = (count: number): unknown => [[1, "After", count + 1]];
  const indentedLine = (count: number): unknown => [[1, "H", count + 1]];
  const lines = (count: number, at: (i: number) => string): string => Array.from({ length: count }, (_, i) => `${at(i)}\n`).join("");

  const COLUMN_ROWS: ColumnRow[] = [
    // Controls: linear on the parent too (the blank line, or the bullet, closes what the line above opened), so they cannot be RED there; they hold the cure to the same answers at the same size.
    { site: "control: 14,000 `: a`, a blank line after each (the blank line closes the column)", entry: "headings", many: 14_000, build: (count) => ": a\n\n".repeat(count), answer: none },
    { site: "control: 64,000 `- a` (each bullet closes the item above it)", entry: "headings", many: 64_000, build: (count) => "- a\n".repeat(count), answer: none },
    { site: "control: 14,000 `A. a`, a blank line after each", entry: "headings", many: 14_000, build: (count) => "A. a\n\n".repeat(count), answer: none },
    { site: "control: 5,000 definition lists of three `: a` and a blank line", entry: "headings", many: 5_000, build: (count) => ": a\n: a\n: a\n\n".repeat(count), answer: none },

    // The eight shapes of the item, one per line, no blank line between them, a heading after a blank line at the end.
    { site: "run: 14,000 `: a` (a definition marker)", entry: "headings", many: 14_000, build: (count) => ": a\n".repeat(count) + AFTER, answer: afterLine },
    { site: "run: 14,000 `~ a` (the tilde marker)", entry: "headings", many: 14_000, build: (count) => "~ a\n".repeat(count) + AFTER, answer: afterLine },
    { site: "run: 14,000 `  : a` (indented two columns)", entry: "headings", many: 14_000, build: (count) => "  : a\n".repeat(count) + AFTER, answer: afterLine },
    { site: "run: 14,000 `> : a` (inside a block quote)", entry: "headings", many: 14_000, build: (count) => "> : a\n".repeat(count) + AFTER, answer: afterLine },
    { site: "run: 14,000 `[^1]: a` (a footnote definition)", entry: "headings", many: 14_000, build: (count) => "[^1]: a\n".repeat(count) + AFTER, answer: afterLine },
    { site: "run: 14,000 `A. a` (a letter marker pandoc takes for an initial)", entry: "headings", many: 14_000, build: (count) => "A. a\n".repeat(count) + AFTER, answer: afterLine },
    { site: "run: 14,000 `I. a` (a roman numeral)", entry: "headings", many: 14_000, build: (count) => "I. a\n".repeat(count) + AFTER, answer: afterLine },
    { site: "run: 14,000 `aa. a` (a two-letter marker)", entry: "headings", many: 14_000, build: (count) => "aa. a\n".repeat(count) + AFTER, answer: afterLine },

    // The tail an indented heading: its answer depends on the container column the stack holds.
    { site: "run: 14,000 `: a`, then an indented heading (a heading: the column 4 is known)", entry: "headings", many: 14_000, build: (count) => ": a\n".repeat(count) + INDENTED, answer: indentedLine },
    { site: "run: 14,000 `~ a`, then an indented heading", entry: "headings", many: 14_000, build: (count) => "~ a\n".repeat(count) + INDENTED, answer: indentedLine },
    { site: "run: 14,000 `[^1]: a`, then an indented heading", entry: "headings", many: 14_000, build: (count) => "[^1]: a\n".repeat(count) + INDENTED, answer: indentedLine },
    { site: "run: 14,000 `aa. a`, then an indented heading", entry: "headings", many: 14_000, build: (count) => "aa. a\n".repeat(count) + INDENTED, answer: indentedLine },
    { site: "run: 14,000 `A. a`, then an indented heading (not a heading: after `A. a` the indents that give one are 0 and 3, and this row indents 4)", entry: "headings", many: 14_000, build: (count) => "A. a\n".repeat(count) + INDENTED, answer: none },

    // Mixed kinds and columns: a stack that does not repeat one entry, so an encoding of runs would not help.
    { site: "run: 14,000 lines alternating `: a` and `A. a` (a definition column and a list column)", entry: "headings", many: 14_000, build: (count) => lines(count, (i) => (i % 2 === 0 ? ": a" : "A. a")) + AFTER, answer: afterLine },
    { site: "run: 14,000 lines alternating `: a` and `  : a` (two columns)", entry: "headings", many: 14_000, build: (count) => lines(count, (i) => (i % 2 === 0 ? ": a" : "  : a")) + AFTER, answer: afterLine },
    { site: "run: 14,000 lines cycling `: a`, `A. a` and `[^1]: a` (three kinds)", entry: "headings", many: 14_000, build: (count) => lines(count, (i) => [": a", "A. a", "[^1]: a"][i % 3]) + AFTER, answer: afterLine },
    { site: "run: 14,000 lines cycling a definition marker at three indents", entry: "headings", many: 14_000, build: (count) => lines(count, (i) => ["    : a", ": a", "  : a"][i % 3]) + AFTER, answer: afterLine },

    // The same scan serves every reader of the regions.
    { site: "entry findAllCells: 12,000 `: a`, then a cell", entry: "cells", many: 12_000, build: (count) => ": a\n".repeat(count) + CELL, answer: (count) => [["r", count + 1, count + 3]] },
    { site: "entry indexLabels: 12,000 `~ a`, then a labelled heading", entry: "labels", many: 12_000, build: (count) => "~ a\n".repeat(count) + LABEL, answer: (count) => [["sec-h", count + 1]] },
  ];

  it.each(COLUMN_ROWS.map((row) => [row.site, row] as const))("%s: is read in linear time, and the answer is the stated one with 3 units and with the long run", (_site, row) => {
    expect(readColumns(row.entry, row.build(COLUMN_FEW))).toEqual(row.answer(COLUMN_FEW));
    const longText = row.build(row.many);
    const { result, ms } = timed(() => readColumns(row.entry, longText));
    expect(result).toEqual(row.answer(row.many));
    expect({ ms, within: withinColumnLimit(ms) }).toMatchObject({ within: true });
  });

  // `~ a` under `from: commonmark_x` is a paragraph line, and the setext-title test scans the paragraph so far for each of its lines (part (9) of the other item), spreading the stack for each: cubic on the parent (5.2 s at 1,500 against 0.22 s for 1,500 plain
  // lines, ratio 23, load 10). The floor is the plain paragraph, so the row is relative: it holds on any machine, and it keeps holding once part (9) makes the floor linear (the 200 ms is the slack for a clock that reads a few milliseconds).
  it("`~ a` x 1,500 under from: commonmark_x costs no more than three times the same number of plain lines, which is the paragraph scan's own floor", () => {
    const head = "---\nfrom: commonmark_x\n---\n\n";
    const plain = timed(() => columnHeadings(`${head}${"a\n".repeat(1_500)}${AFTER}`));
    const tilde = timed(() => columnHeadings(`${head}${"~ a\n".repeat(1_500)}${AFTER}`));
    expect(tilde.result).toEqual([[1, "After", 1_500 + 5]]);
    expect(plain.result).toEqual([[1, "After", 1_500 + 5]]);
    expect({ tilde: tilde.ms, plain: plain.ms, within: tilde.ms <= 3 * plain.ms + 200 }).toMatchObject({ within: true });
  }, 60_000);

  it("builds a different text for every row", () => {
    const small = COLUMN_ROWS.map((row) => row.build(COLUMN_FEW));
    // The TEXT alone, not the entry with it: `scanRegions` keeps the last two scans by text (`regionsCache`), so a row whose text another row read just before it is served from the cache and cannot be RED.
    const long = COLUMN_ROWS.map((row) => row.build(row.many));
    expect(new Set(long).size).toBe(COLUMN_ROWS.length);
    // Two rows may share a small text only if they differ in size or entry.
    const bySmall = new Map<string, string[]>();
    COLUMN_ROWS.forEach((row, k) => bySmall.set(small[k], [...(bySmall.get(small[k]) ?? []), `${row.entry}:${row.many}`]));
    for (const sizes of bySmall.values()) {
      expect(new Set(sizes).size).toBe(sizes.length);
    }
  });

  // A run of 3,000 lines, or a limit of 100 s, would pass on the parent too (the RED rows take 2.7 to 4.3 s on the parent at a load near 8), so the boundary of `withinColumnLimit` is pinned, and the sizes the rows are built on.
  it("keeps the sizes, the limit and the shapes the Session 331 rows are built on", () => {
    expect([COLUMN_FEW, COLUMN_LIMIT_MS]).toEqual([3, 1000]);
    expect([withinColumnLimit(COLUMN_LIMIT_MS - 1), withinColumnLimit(COLUMN_LIMIT_MS)]).toEqual([true, false]);
    expect(COLUMN_ROWS.map((row) => `${row.entry} ${row.many} ${JSON.stringify(row.build(2))}`)).toEqual([
      'headings 14000 ": a\\n\\n: a\\n\\n"',
      'headings 64000 "- a\\n- a\\n"',
      'headings 14000 "A. a\\n\\nA. a\\n\\n"',
      'headings 5000 ": a\\n: a\\n: a\\n\\n: a\\n: a\\n: a\\n\\n"',
      'headings 14000 ": a\\n: a\\n\\n# After\\n"',
      'headings 14000 "~ a\\n~ a\\n\\n# After\\n"',
      'headings 14000 "  : a\\n  : a\\n\\n# After\\n"',
      'headings 14000 "> : a\\n> : a\\n\\n# After\\n"',
      'headings 14000 "[^1]: a\\n[^1]: a\\n\\n# After\\n"',
      'headings 14000 "A. a\\nA. a\\n\\n# After\\n"',
      'headings 14000 "I. a\\nI. a\\n\\n# After\\n"',
      'headings 14000 "aa. a\\naa. a\\n\\n# After\\n"',
      'headings 14000 ": a\\n: a\\n\\n    # H\\n"',
      'headings 14000 "~ a\\n~ a\\n\\n    # H\\n"',
      'headings 14000 "[^1]: a\\n[^1]: a\\n\\n    # H\\n"',
      'headings 14000 "aa. a\\naa. a\\n\\n    # H\\n"',
      'headings 14000 "A. a\\nA. a\\n\\n    # H\\n"',
      'headings 14000 ": a\\nA. a\\n\\n# After\\n"',
      'headings 14000 ": a\\n  : a\\n\\n# After\\n"',
      'headings 14000 ": a\\nA. a\\n\\n# After\\n"',
      'headings 14000 "    : a\\n: a\\n\\n# After\\n"',
      'cells 12000 ": a\\n: a\\n\\n```{r}\\n1\\n```\\n"',
      'labels 12000 "~ a\\n~ a\\n\\n# H {#sec-h}\\n"',
    ]);
  });
});

describe("Session 332 — a long paragraph of consecutive lines under a CommonMark-family reader", () => {
  // Part (9) of the former BACKLOG item (closed, CHANGELOG: Session 334) "Eight more regexes and one paragraph reader that are quadratic on a long line or a long paragraph". Under a top-level `from: gfm`, `commonmark` or `commonmark_x` the title of a setext underline is the WHOLE open paragraph, so
  // `computeRegions` asks, for EVERY line it reads and not only for an underline, whether any line of the paragraph so far (below its first) interrupts it: `bodyLines.slice(-wholeParagraph).slice(1).some(...)`, two copies of the paragraph and a test
  // of each line, with a fresh `[0, ...columns]` array for each test. A paragraph of N lines with no interrupter costs about N^2/2 tests, and the answer is read only if the line IS an underline. `format: gfm` and `from: markdown` do not pay it (the default reader's title is one line).
  // Profile (Session 332, `node --cpu-prof`, fresh process, load 9): `x` x 6,000 under `from: gfm` 2.7 s, 19.8% and 17.7% in two anonymous functions (the callback and `COMMONMARK_PARAGRAPH_INTERRUPT.some`), 13.4% in `computeRegions`, the rest in the regexes
  // of the list; the repeated block shape 92% of the line ticks on the one `computeRegions` line and 20% of the time in garbage collection, with no time in the pattern tests: the cost is the two `slice` copies of a paragraph that is 2N lines long.
  // Fresh process, cold, `findHeadings`, load 9 to 12 (Session 332): `x` x 2,000 / 4,000 / 6,000 under `from: gfm` 334 / 1,210 / 2,667 ms (the item's 321 / 1,194 / 2,653), `commonmark` and `commonmark_x` 1,220 and 1,213 ms at 4,000; `format: gfm` and `from: markdown` 36 ms
  // at 8,000 (linear); blank-separated paragraphs 39 ms at 4,000; `---\nfrom: gfm\n---\ntext\n<?php\n` repeated 2,500 / 5,000 / 10,000 times 112 / 622 / 2,577 ms (the item's 606 at 5,000), the same with `<!--` 609 ms at 5,000, with no `text` line 98 ms (linear);
  // `- item` and `===` x 2,500 / 5,000 546 / 2,051 ms (the item's 1,980 at 5,000); `~ a` x 1,500 / 3,000 under `commonmark_x` 212 / 763 ms; `x` x 4,000 and 8,000 and ONE `===` at the end 1,207 / 4,665 ms.
  const PARAGRAPH_LIMIT_MS = 1000;
  const PARAGRAPH_FEW = 3;
  const withinParagraphLimit = (ms: number): boolean => ms < PARAGRAPH_LIMIT_MS;
  type ParagraphEntry = "headings" | "cells" | "labels";
  type ParagraphRow = { site: string; entry: ParagraphEntry; many: number; build: (count: number) => string; answer: (count: number) => unknown };
  const paragraphHeadings = (text: string): Array<[number, string, number]> => findHeadings(text).map((heading): [number, string, number] => [heading.level, heading.text, heading.line]);
  const readParagraph = (entry: ParagraphEntry, text: string): unknown =>
    entry === "headings" ? paragraphHeadings(text) : entry === "cells" ? findAllCells(text).map((cell) => [cell.lang, cell.startLine, cell.endLine]) : indexLabels(text).map((label) => [label.id, label.line]);
  const reader = (from: string): string => `---\nfrom: ${from}\n---\n`;
  const END = "\n# After\n";
  const words = (count: number): string => Array.from({ length: count }, () => "x").join(" ");

  const PARAGRAPH_ROWS: ParagraphRow[] = [
    // Controls: linear on the parent too (the default reader's title is one line; a blank line ends the paragraph), so they cannot be RED there; they hold the cure to the same answers at the same size.
    { site: "control: 40,000 `x` lines under the default reader", entry: "headings", many: 40_000, build: (count) => "x\n".repeat(count) + END, answer: (count) => [[1, "After", count + 1]] },
    { site: "control: 40,000 `x` lines under `format: gfm` (only a top-level `from:` selects the reader)", entry: "headings", many: 40_000, build: (count) => "---\nformat: gfm\n---\n\n" + "x\n".repeat(count) + END, answer: (count) => [[1, "After", count + 5]] },
    { site: "control: 14,000 `x` lines under `from: gfm`, a blank line after each", entry: "headings", many: 14_000, build: (count) => `${reader("gfm")}\n` + "x\n\n".repeat(count) + END, answer: (count) => [[1, "After", 2 * count + 5]] },

    // The item's literal shape under each of the three readers, and the Session 329 doors to the same line.
    { site: "run: 5,000 `x` lines under from: gfm", entry: "headings", many: 5_000, build: (count) => `${reader("gfm")}\n` + "x\n".repeat(count) + END, answer: (count) => [[1, "After", count + 5]] },
    { site: "run: 5,000 `x` lines under from: commonmark", entry: "headings", many: 5_000, build: (count) => `${reader("commonmark")}\n` + "x\n".repeat(count) + END, answer: (count) => [[1, "After", count + 5]] },
    { site: "run: 5,000 `x` lines under from: commonmark_x", entry: "headings", many: 5_000, build: (count) => `${reader("commonmark_x")}\n` + "x\n".repeat(count) + END, answer: (count) => [[1, "After", count + 5]] },
    { site: "run: 10,000 blocks of `from: gfm`, `text` and an unclosed `<?php`", entry: "headings", many: 10_000, build: (count) => (reader("gfm") + "text\n<?php\n").repeat(count) + END, answer: (count) => [[1, "After", 5 * count + 1]] },
    { site: "run: 10,000 blocks of `from: gfm`, `text` and an unclosed `<!--`", entry: "headings", many: 10_000, build: (count) => (reader("gfm") + "text\n<!--\n").repeat(count) + END, answer: (count) => [[1, "After", 5 * count + 1]] },
    { site: "run: `- item` and 5,000 `===` lines under from: gfm", entry: "headings", many: 5_000, build: (count) => `${reader("gfm")}- item\n` + "===\n".repeat(count) + END, answer: (count) => [[1, "After", count + 5]] },
    { site: "run: 5,000 `~ a` lines under from: commonmark_x", entry: "headings", many: 5_000, build: (count) => `${reader("commonmark_x")}` + "~ a\n".repeat(count) + END, answer: (count) => [[1, "After", count + 4]] },

    // The underline that DOES claim the paragraph: the whole paragraph is its title, so the scan is read once and its answer is used.
    { site: "run: 6,000 `x` lines and one `===` under from: gfm (the title is all 6,000 lines)", entry: "headings", many: 6_000, build: (count) => `${reader("gfm")}\n` + "x\n".repeat(count) + "===\n", answer: (count) => [[1, words(count), 4]] },
    { site: "run: 6,000 `x` lines and one `---` under from: gfm (a level 2 title)", entry: "headings", many: 6_000, build: (count) => `${reader("gfm")}\n` + "x\n".repeat(count) + "---\n", answer: (count) => [[2, words(count), 4]] },
    { site: "run: 5,000 `x` lines, one `===` and a heading under from: commonmark_x", entry: "headings", many: 5_000, build: (count) => `${reader("commonmark_x")}\n` + "x\n".repeat(count) + "===\n" + END, answer: (count) => [[1, words(count), 4], [1, "After", count + 6]] },

    // An interrupter far down the paragraph, then many lines that can underline and cannot claim it: each of them asks the question again and the answer is "yes" every time, found after the N `x` lines above it (the gate alone left these at 2.2 to 3.0 s; the block quote shape takes about a second at 16,000 lines on the parent and needs 24,000 to be RED against the limit under load).
    { site: "run: 4,000 `x` lines, one `<span>a</span>` and 4,000 `===` lines under from: gfm", entry: "headings", many: 4_000, build: (count) => `${reader("gfm")}\n` + "x\n".repeat(count) + "<span>a</span>\n" + "===\n".repeat(count) + END, answer: (count) => [[1, "After", 2 * count + 6]] },
    { site: "run: 4,000 `x` lines, one `<span>a</span>` and 4,000 `---` lines under from: gfm", entry: "headings", many: 4_000, build: (count) => `${reader("gfm")}\n` + "x\n".repeat(count) + "<span>a</span>\n" + "---\n".repeat(count) + END, answer: (count) => [[1, "After", 2 * count + 6]] },
    { site: "run: 4,000 `x` lines, one `<span>a</span>` and 4,000 `===` lines under from: commonmark_x", entry: "headings", many: 4_000, build: (count) => `${reader("commonmark_x")}\n` + "x\n".repeat(count) + "<span>a</span>\n" + "===\n".repeat(count) + END, answer: (count) => [[1, "After", 2 * count + 6]] },
    { site: "run: a list item, 4,000 `  x` lines, one `  <span>a</span>` and 4,000 `  ===` lines under from: gfm (the container column is 2)", entry: "headings", many: 4_000, build: (count) => `${reader("gfm")}- item\n` + "  x\n".repeat(count) + "  <span>a</span>\n" + "  ===\n".repeat(count) + END, answer: (count) => [[1, "After", 2 * count + 6]] },
    { site: "run: 24,000 `> x` lines, one `> <span>a</span>` and 24,000 `> ===` lines under from: gfm (inside a block quote: 90 ms at 4,000 on the parent, 1.1 s at 16,000, 2.2 s at 24,000, so the size matters)", entry: "headings", many: 24_000, build: (count) => `${reader("gfm")}\n` + "> x\n".repeat(count) + "> <span>a</span>\n" + "> ===\n".repeat(count) + END, answer: (count) => [[1, "After", 2 * count + 6]] },

    // Review round (Session 332): shapes that the first two slices left slow or made slower. Lines that change the set of open container columns between two questions (a list item that pushes a column, one that pops it) while the paragraph goes on,
    // behind an interrupter far down it (the memo was keyed on the columns ARRAY, which is rebuilt for every change of the set); a first line with 20,000 quote markers, which every later line re-measured when its title count was the whole paragraph (the parent gave an
    // interrupted paragraph the default count, 0, and measured nothing); and shapes that only a regression of the scan's key or of the gate can see.
    { site: "run: 4,000 `x` lines, one `<span>a</span>` and 4,000 units of `===`, `  2. a`, `    - b` under from: gfm (the pair of list items pushes and pops a column between two underlines)", entry: "headings", many: 4_000, build: (count) => `${reader("gfm")}` + "x\n".repeat(count) + "<span>a</span>\n" + "===\n  2. a\n    - b\n".repeat(count) + END, answer: (count) => [[1, "After", 4 * count + 5]] },
    { site: "run: a first line of 20,000 quote markers, one `<span>a</span>` and 8,000 `y` lines under from: gfm (the parent measured the first line once)", entry: "headings", many: 8_000, build: (count) => `${reader("gfm")}${"> ".repeat(20_000)}x\n<span>a</span>\n` + "y\n".repeat(count) + END, answer: (count) => [[1, "After", count + 6]] },
    { site: "run: a first line of 20,000 quote markers and 8,000 `y` lines under from: gfm (no interrupter)", entry: "headings", many: 8_000, build: (count) => `${reader("gfm")}${"> ".repeat(20_000)}x\n` + "y\n".repeat(count) + END, answer: (count) => [[1, "After", count + 5]] },
    // Pins, linear in the cure. The first is a control: it stays linear whether or not the gate is there, because the scan keeps indents and not an answer (it was quadratic without the gate under the first version of the scan, which restarted at every change of the open columns); the gate is held by the count rows of paragraph-interrupt-wiring.test.ts. The other two are quadratic under one regression each (the scan restarted for a paragraph under two open columns; restarted for a document with a long body before the paragraph).
    { site: "control: 2,000 `x` lines and 2,000 units of `    - b` and `  2. a` under from: gfm (neither line can underline, and the pair pushes and pops a column: 72 ms here, 2.5 s on the parent)", entry: "headings", many: 2_000, build: (count) => `${reader("gfm")}` + "x\n".repeat(count) + "    - b\n  2. a\n".repeat(count) + END, answer: (count) => [[1, "After", 3 * count + 4]] },
    { site: "pin: two nested bullets, 4,000 `    x` lines, one `    <span>a</span>` and 4,000 `    ===` lines under from: gfm (two open container columns)", entry: "headings", many: 4_000, build: (count) => `${reader("gfm")}- a\n  - b\n` + "    x\n".repeat(count) + "    <span>a</span>\n" + "    ===\n".repeat(count) + END, answer: (count) => [[1, "After", 2 * count + 7]] },
    { site: "pin: 5,000 one-line paragraphs, then 4,000 `x` lines, one `<span>a</span>` and 4,000 `===` lines under from: gfm (a long body before the paragraph)", entry: "headings", many: 4_000, build: (count) => `${reader("gfm")}` + "p\n\n".repeat(5_000) + "x\n".repeat(count) + "<span>a</span>\n" + "===\n".repeat(count) + END, answer: (count) => [[1, "After", 2 * count + 10_005]] },

    // ONE question about a long paragraph: the scan has to read all 5,001 lines at once (a cap on the lines read per question gives a different heading).
    { site: "run: 5,000 `x` lines, one `<span>a</span>` and ONE `===` under from: gfm (the only question reads a paragraph of 5,001 lines)", entry: "headings", many: 5_000, build: (count) => `${reader("gfm")}\n` + "x\n".repeat(count) + "<span>a</span>\n===\n" + END, answer: (count) => [[1, "After", count + 7]] },

    // The same scan serves every reader of the regions.
    { site: "entry findAllCells: 5,000 `x` lines under from: gfm, then a cell", entry: "cells", many: 5_000, build: (count) => `${reader("gfm")}\n` + "x\n".repeat(count) + "\n```{r}\n1\n```\n", answer: (count) => [["r", count + 5, count + 7]] },
    { site: "entry indexLabels: 5,000 `x` lines under from: commonmark_x, then a labelled heading (gfm indexes no heading label)", entry: "labels", many: 5_000, build: (count) => `${reader("commonmark_x")}\n` + "x\n".repeat(count) + "\n# H {#sec-h}\n", answer: (count) => [["sec-h", count + 5]] },
  ];

  it.each(PARAGRAPH_ROWS.map((row) => [row.site, row] as const))("%s: is read in linear time, and the answer is the stated one with 3 units and with the long run", (_site, row) => {
    expect(readParagraph(row.entry, row.build(PARAGRAPH_FEW))).toEqual(row.answer(PARAGRAPH_FEW));
    const longText = row.build(row.many);
    const { result, ms } = timed(() => readParagraph(row.entry, longText));
    expect(result).toEqual(row.answer(row.many));
    expect({ ms, within: withinParagraphLimit(ms) }).toMatchObject({ within: true });
  }, 120_000);

  it("builds a different text for every row", () => {
    // The TEXT alone, not the entry with it: `scanRegions` keeps the last two scans by text (`regionsCache`), so a row whose text another row read just before it is served from the cache and cannot be RED.
    const long = PARAGRAPH_ROWS.map((row) => row.build(row.many));
    expect(new Set(long).size).toBe(PARAGRAPH_ROWS.length);
    // The small texts are distinct too (the rows are read at PARAGRAPH_FEW units first, and a cache hit there would hide the answer check); no two rows share one.
    const small = PARAGRAPH_ROWS.map((row) => row.build(PARAGRAPH_FEW));
    expect(new Set(small).size).toBe(PARAGRAPH_ROWS.length);
  });

  // Every RED row but one takes 1.8 s or more on the parent at a load near 8 (the exception, the 20,000-marker row with an interrupter, takes 108 ms on the parent and 1.98 s on the first version of the scan: it guards against a regression and not against the parent; the figures are in the commit messages), so a limit of 100 s or a row of 1,000 lines would pass there too: the boundary of `withinParagraphLimit` is pinned, and the sizes and shapes the rows are built on.
  it("keeps the sizes, the limit and the shapes the Session 332 rows are built on", () => {
    expect([PARAGRAPH_FEW, PARAGRAPH_LIMIT_MS]).toEqual([3, 1000]);
    expect([withinParagraphLimit(PARAGRAPH_LIMIT_MS - 1), withinParagraphLimit(PARAGRAPH_LIMIT_MS)]).toEqual([true, false]);
    expect(PARAGRAPH_ROWS.map((row) => `${row.entry} ${row.many} ${JSON.stringify(row.build(2))}`)).toEqual([
      'headings 40000 "x\\nx\\n\\n# After\\n"',
      'headings 40000 "---\\nformat: gfm\\n---\\n\\nx\\nx\\n\\n# After\\n"',
      'headings 14000 "---\\nfrom: gfm\\n---\\n\\nx\\n\\nx\\n\\n\\n# After\\n"',
      'headings 5000 "---\\nfrom: gfm\\n---\\n\\nx\\nx\\n\\n# After\\n"',
      'headings 5000 "---\\nfrom: commonmark\\n---\\n\\nx\\nx\\n\\n# After\\n"',
      'headings 5000 "---\\nfrom: commonmark_x\\n---\\n\\nx\\nx\\n\\n# After\\n"',
      'headings 10000 "---\\nfrom: gfm\\n---\\ntext\\n<?php\\n---\\nfrom: gfm\\n---\\ntext\\n<?php\\n\\n# After\\n"',
      'headings 10000 "---\\nfrom: gfm\\n---\\ntext\\n<!--\\n---\\nfrom: gfm\\n---\\ntext\\n<!--\\n\\n# After\\n"',
      'headings 5000 "---\\nfrom: gfm\\n---\\n- item\\n===\\n===\\n\\n# After\\n"',
      'headings 5000 "---\\nfrom: commonmark_x\\n---\\n~ a\\n~ a\\n\\n# After\\n"',
      'headings 6000 "---\\nfrom: gfm\\n---\\n\\nx\\nx\\n===\\n"',
      'headings 6000 "---\\nfrom: gfm\\n---\\n\\nx\\nx\\n---\\n"',
      'headings 5000 "---\\nfrom: commonmark_x\\n---\\n\\nx\\nx\\n===\\n\\n# After\\n"',
      'headings 4000 "---\\nfrom: gfm\\n---\\n\\nx\\nx\\n<span>a</span>\\n===\\n===\\n\\n# After\\n"',
      'headings 4000 "---\\nfrom: gfm\\n---\\n\\nx\\nx\\n<span>a</span>\\n---\\n---\\n\\n# After\\n"',
      'headings 4000 "---\\nfrom: commonmark_x\\n---\\n\\nx\\nx\\n<span>a</span>\\n===\\n===\\n\\n# After\\n"',
      'headings 4000 "---\\nfrom: gfm\\n---\\n- item\\n  x\\n  x\\n  <span>a</span>\\n  ===\\n  ===\\n\\n# After\\n"',
      'headings 24000 "---\\nfrom: gfm\\n---\\n\\n> x\\n> x\\n> <span>a</span>\\n> ===\\n> ===\\n\\n# After\\n"',
      'headings 4000 "---\\nfrom: gfm\\n---\\nx\\nx\\n<span>a</span>\\n===\\n  2. a\\n    - b\\n===\\n  2. a\\n    - b\\n\\n# After\\n"',
      'headings 8000 "---\\nfrom: gfm\\n---\\n> > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > x\\n<span>a</span>\\ny\\ny\\n\\n# After\\n"',
      'headings 8000 "---\\nfrom: gfm\\n---\\n> > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > > x\\ny\\ny\\n\\n# After\\n"',
      'headings 2000 "---\\nfrom: gfm\\n---\\nx\\nx\\n    - b\\n  2. a\\n    - b\\n  2. a\\n\\n# After\\n"',
      'headings 4000 "---\\nfrom: gfm\\n---\\n- a\\n  - b\\n    x\\n    x\\n    <span>a</span>\\n    ===\\n    ===\\n\\n# After\\n"',
      'headings 4000 "---\\nfrom: gfm\\n---\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\np\\n\\nx\\nx\\n<span>a</span>\\n===\\n===\\n\\n# After\\n"',
      'headings 5000 "---\\nfrom: gfm\\n---\\n\\nx\\nx\\n<span>a</span>\\n===\\n\\n# After\\n"',
      'cells 5000 "---\\nfrom: gfm\\n---\\n\\nx\\nx\\n\\n```{r}\\n1\\n```\\n"',
      'labels 5000 "---\\nfrom: commonmark_x\\n---\\n\\nx\\nx\\n\\n# H {#sec-h}\\n"',
    ]);
  });
});

describe("Session 333 — a table-border-shaped line holding a long run of dashes and a tail the border pattern refuses", () => {
  // The former BACKLOG item (closed, CHANGELOG: Session 334) "Eight more regexes and one paragraph reader that are quadratic on a long line or a long paragraph", part (1). `tableShapedLineIsBlock` asks `GRID_TABLE_BORDER`
  // (`/^\+[-+=:]*[-=:][-+=:]*[ \t]*$/`) of a line that starts with `+` and holds only `-`, `+`, `=`, `:` and spaces (`PLUS_ONLY_ROW` gates the line's OWN question only: a tail of any other character never reaches the pattern that way, but the neighbour scan and the third call site ask it of a line with no gate, so the rows below with an `x` tail beside a border are RED too). The pattern
  // has two stars around one required class, so for a run of n characters followed by a space and one more class character (which the blank-tail cannot absorb) the first star takes the run, gives one back to the
  // required class, the second star takes the rest and `[ \t]*$` fails; every further give-back of the first star repeats that walk: n squared. Profile (Session 333, `node --cpu-prof`, `+` + `-` x 20,000 + ` -`, load
  // near 8): 96.5% of the time in that one pattern. The reader does not matter (the pattern is asked under `gfm`, `commonmark_x`, `markdown_github` and `markdown_strict` alike, rows below), and a long line is asked
  // once for its own question and once more for each BORDER next to it (the neighbour scan), so two borders around one long line cost three tests. Bare `findHeadings`, a fresh process per row, load 7 to 9, against a
  // limit of 1,000 ms: 30,000 units 3,344 to 3,495 ms for a single test, 6,718 for `-+` x 30,000, 6,664 with a border above, 10,038 with a border on each side; the controls take 1 to 2 ms. The rows are sized for about 3 to
  // 4 s on the parent, under vitest's 5 s default so that the failure is the clock assertion and not a timeout, and the controls come first so the patterns are warm (Learning 816).
  const GRID_LIMIT_MS = 1000;
  const GRID_FEW = 4;
  const gridHeadings = (text: string): Array<[number, string]> => findHeadings(text).map((heading): [number, string] => [heading.line, heading.text]);
  const gridFrontMatter = (from: string | null): string => (from === null ? "" : `---\nfrom: ${from}\n---\n\n`);
  type GridRow = { site: string; from: string | null; unit: string; many: number; build: (run: string) => string; headings: Array<[number, string]> };

  const GRID_ROWS: GridRow[] = [
    // Controls: fast on the parent too, so they cannot be RED there; they hold the cure to the same answers at the same size, and the last four are the inputs that a wrong respelling of the cure is slow on (rows 6 to 9: the mutants C04 and R01 to R03 of the mutation lists).
    // Why each is fast on the parent: row 1 the gate refuses the line; row 2 no `-`, `=` or `:` comes before the blank; rows 3 and 4 the first attempt matches; row 5 the line is inside a list item; row 6 one long blank run sits between two class characters;
    // row 7 every run is one character long; row 8 the only required class character comes before a run of `+`, which the old first star gives back in one pass; row 9 the same for a run of tabs, in a line only a neighbour asks about.
    { site: "control: 30,000 dashes, a space and an `x` (the gate refuses the tail)", from: null, unit: "-", many: 30_000, build: (run) => `+${run} x\n# H\n`, headings: [] },
    { site: "control: 30,000 `+`, a space and a dash (no required class before the blank)", from: null, unit: "+", many: 30_000, build: (run) => `+${run} -\n# H\n`, headings: [[1, "H"]] },
    { site: "control: a real border of 30,000 dashes", from: null, unit: "-", many: 30_000, build: (run) => `+${run}+\n# H\n`, headings: [] },
    { site: "control: a real border of 30,000 `=`", from: null, unit: "=", many: 30_000, build: (run) => `+${run}+\n# H\n`, headings: [] },
    { site: "control: 30,000 dashes, a space and a dash inside a list item", from: null, unit: "-", many: 30_000, build: (run) => `- +${run} -\n\n  # H\n`, headings: [[2, "H"]] },
    { site: "control: a dash, 64,000 spaces and a dash (one long blank run, then a class character)", from: null, unit: " ", many: 64_000, build: (run) => `+-${run}-\n# H\n`, headings: [[1, "H"]] },
    { site: "control: 30,000 pairs of a dash and a space, then a dash", from: null, unit: "- ", many: 30_000, build: (run) => `+${run}-\n# H\n`, headings: [[1, "H"]] },
    { site: "control: a dash, 30,000 `+`, a space and a dash (a run of `+` after the only required class character)", from: null, unit: "+", many: 30_000, build: (run) => `+-${run} -\n# H\n`, headings: [[1, "H"]] },
    { site: "control: a border above a dash, 64,000 tabs and a dash (a tab run, asked of a neighbour only)", from: null, unit: "\t", many: 64_000, build: (run) => `+-+\n+-${run}-\n# H\n`, headings: [] },

    // The question for the line itself: the run, a space and one more class character, for each class character and each tail character, with the heading below, above, and a paragraph above.
    { site: "line: 30,000 dashes, a space and a dash, a heading below", from: null, unit: "-", many: 30_000, build: (run) => `+${run} -\n# H\n`, headings: [[1, "H"]] },
    { site: "line: 30,000 dashes, a space and a dash, a heading above", from: null, unit: "-", many: 30_000, build: (run) => `# H\n+${run} -\n`, headings: [[0, "H"]] },
    { site: "line: 30,000 dashes, a space and a dash, a paragraph above and a heading below", from: null, unit: "-", many: 30_000, build: (run) => `a\n+${run} -\n# H\n`, headings: [] },
    { site: "line: 30,000 `=`, a space and a dash", from: null, unit: "=", many: 30_000, build: (run) => `+${run} -\n# H\n`, headings: [[1, "H"]] },
    { site: "line: 30,000 `:`, a space and a dash", from: null, unit: ":", many: 30_000, build: (run) => `+${run} -\n# H\n`, headings: [[1, "H"]] },
    { site: "line: 20,000 of `-+`, a space and a dash", from: null, unit: "-+", many: 20_000, build: (run) => `+${run} -\n# H\n`, headings: [[1, "H"]] },
    { site: "line: 30,000 dashes, a space and a `=`", from: null, unit: "-", many: 30_000, build: (run) => `+${run} =\n# H\n`, headings: [[1, "H"]] },
    { site: "line: 30,000 dashes, a space and a `+`", from: null, unit: "-", many: 30_000, build: (run) => `+${run} +\n# H\n`, headings: [[1, "H"]] },
    { site: "line: 30,000 dashes, a space and a dash, indented three spaces", from: null, unit: "-", many: 30_000, build: (run) => `   +${run} -\n# H\n`, headings: [[1, "H"]] },
    { site: "line: 30,000 dashes, a space and a dash, in a block quote", from: null, unit: "-", many: 30_000, build: (run) => `> +${run} -\n> # H\n`, headings: [[1, "H"]] },

    // The neighbour scan: a border next to the long line asks the pattern of the long line too (once for a border above, twice for a border on each side).
    { site: "neighbour: a border above 20,000 dashes, a space and a dash", from: null, unit: "-", many: 20_000, build: (run) => `+-+\n+${run} -\n# H\n`, headings: [] },
    { site: "neighbour: a border above and a border below 18,000 dashes, a space and a dash", from: null, unit: "-", many: 18_000, build: (run) => `+-+\n+${run} -\n+-+\n# H\n`, headings: [] },
    { site: "neighbour: a border above 24,000 dashes and an `x` (a neighbour is not gated by the line's own question)", from: null, unit: "-", many: 24_000, build: (run) => `+-+\n+${run}x\n# H\n`, headings: [] },

    // The third call site (`tableOrLineBlockEndsAt`, the count of borders in a run of `+` lines) is asked when the line right after the run is a rule (`* * *`, `- - -`, `---`) or an indented cell opener (four spaces or a tab). It tests every line of the run,
    // so a long line in it is tested again for each such question (1 and 2 long calls in the two rows below, counted with a wrapper at 5,000 dashes, Session 333 review); the rows have an `x` tail, which only the neighbour scan and this site ask of a line.
    { site: "third site: a border, 22,000 dashes, a space and an `x`, then a `* * *` rule", from: null, unit: "-", many: 22_000, build: (run) => `+-+\n+${run} x\n* * *\n# H\n`, headings: [] },
    { site: "third site: a border, 16,000 dashes, a space and an `x`, then an indented cell opener", from: null, unit: "-", many: 16_000, build: (run) => `+-+\n+${run} x\n    \`\`\`{bash}\n# H\n`, headings: [] },

    // The reader does not matter: the same line under four `from:` values.
    { site: "reader: 30,000 dashes, a space and a dash under from: markdown_strict", from: "markdown_strict", unit: "-", many: 30_000, build: (run) => `+${run} -\n# H\n`, headings: [[5, "H"]] },
    { site: "reader: 30,000 dashes, a space and a dash under from: gfm", from: "gfm", unit: "-", many: 30_000, build: (run) => `+${run} -\n# H\n`, headings: [[5, "H"]] },
    { site: "reader: 30,000 dashes, a space and a dash under from: commonmark_x", from: "commonmark_x", unit: "-", many: 30_000, build: (run) => `+${run} -\n# H\n`, headings: [[5, "H"]] },
    { site: "reader: 30,000 dashes, a space and a dash under from: markdown_github", from: "markdown_github", unit: "-", many: 30_000, build: (run) => `+${run} -\n# H\n`, headings: [[5, "H"]] },
  ];

  it.each(GRID_ROWS.map((row) => [row.site, row] as const))("%s: is read in linear time, and the answer is the stated one with 4 units and with the long run", (_site, row) => {
    expect(gridHeadings(gridFrontMatter(row.from) + row.build(row.unit.repeat(GRID_FEW)))).toEqual(row.headings);
    const run = row.unit.repeat(row.many);
    const longText = gridFrontMatter(row.from) + row.build(run);
    expect(longText.length).toBeGreaterThan(run.length); // the timed text holds the whole run
    const { result, ms } = timed(() => gridHeadings(longText));
    expect(result).toEqual(row.headings);
    expect(ms).toBeLessThan(GRID_LIMIT_MS);
  });

  it("builds a different text for every row", () => {
    // The TEXT alone: `scanRegions` keeps the last two scans by text, so a row whose text another row read just before it is served from the cache and cannot be RED.
    const long = GRID_ROWS.map((row) => gridFrontMatter(row.from) + row.build(row.unit.repeat(row.many)));
    expect(new Set(long).size).toBe(GRID_ROWS.length);
    const small = GRID_ROWS.map((row) => gridFrontMatter(row.from) + row.build(row.unit.repeat(GRID_FEW)));
    expect(new Set(small).size).toBe(GRID_ROWS.length);
  });

  // A run of 3,000 characters, or a limit of 100 s, would pass on the parent too.
  it("keeps the sizes, the limit and the units the Session 333 rows are built on", () => {
    expect([GRID_FEW, GRID_LIMIT_MS]).toEqual([4, 1000]);
    expect(GRID_ROWS.map((row) => `${row.unit}x${row.many}`)).toEqual([
      "-x30000", "+x30000", "-x30000", "=x30000", "-x30000", " x64000", "- x30000", "+x30000", "\tx64000",
      "-x30000", "-x30000", "-x30000", "=x30000", ":x30000", "-+x20000", "-x30000", "-x30000", "-x30000", "-x30000",
      "-x20000", "-x18000", "-x24000",
      "-x22000", "-x16000",
      "-x30000", "-x30000", "-x30000", "-x30000",
    ]);
  });
});

describe("Session 334 — a tag line, a link definition, an `options(` argument list or a YAML alias holding a long run that the pattern reads from every start", () => {
  // The former BACKLOG item (closed, CHANGELOG: Session 334) "Eight more regexes and one paragraph reader that are quadratic on a long line or a long paragraph", parts (4) to (7). Each pattern fails only at the END of the text it reads, so every start (or every give-back of
  // its greedy part) reads on to that end: (4) `htmlLineHasText` strips tags with `/<(?:[^>"']|"[^"]*"|'[^']*')*>/g`, so every `<` of a run with no `>` after it reads to the end of the line; (5) `linkDefinitionAt` asks
  // `/^\S+[ \t]*\{[^}]*\}[ \t]*\S/` of the text after `[a]:`, so a run of `{` that is the URL gives back one `{` at a time and each reads to the end looking for a `}`; (6) `knitrCodeMasksPrinters` scans the argument list of
  // `options(` with `/([A-Za-z.][\w.]*)[ \t]*=/g`, so every letter of a run reads to the end of the run looking for an `=`; (7) `YAML_ALIAS_VALUE` ends in `(?:#.*)?$`, and a `#` inside the NAME is a comment start at every give-back of the
  // name, where `.*` reads to a line terminator that `$` then refuses. Profile (Session 334, `node --cpu-prof`, `findHeadings` or `buildOutline`, load 8 to 10, 20,000 units): 94.5%, 89.2%, 83.1% and 84.6% of the time in those four patterns.
  // Bare `findHeadings` (the engine hint "knitr" for part 6), a fresh process per shape, load near 9, against a limit of 1,000 ms; the parent takes the times in the row titles' sizes. The rows are sized for about 3 to 4 s on the parent,
  // under vitest's 5 s default so that the failure is the clock assertion and not a timeout, and the controls come first so the patterns are warm (Learning 816).
  const S334_LIMIT_MS = 1000;
  const S334_FEW = 4;
  const s334Headings = (text: string, engine?: "knitr"): Array<[number, string]> => findHeadings(text, engine).map((heading): [number, string] => [heading.line, heading.text]);
  const s334FrontMatter = (from: string | null): string => (from === null ? "" : `---\nfrom: ${from}\n---\n\n`);
  type S334Row = { site: string; from: string | null; engine?: "knitr"; unit: string; many: number; build: (run: string) => string; setext?: boolean };
  // The heading `# Z` is the last line of every document. A tag line with NO text after its tags (`htmlLineHasText` false) is no header row, so `x y` over the dash rule below it is a setext heading, at line 4 (the row says `setext`); with text left
  // over, the three lines are a simple table and `x y` is a row.
  const s334Expected = (row: S334Row, text: string): Array<[number, string]> => (row.setext ? [[4, "x y"], [text.split("\n").length - 2, "Z"]] : [[text.split("\n").length - 2, "Z"]]);
  const tagTable = (tag: string, tail = ""): ((run: string) => string) => (run) => `text\n\n${tag}${run}${tail}\n------- -------\nx y\n-------\n\n# Z\n`;
  const cellOpener = "    ```{python}\n    1\n    ```\n";
  const knitrCell = (call: (run: string) => string): ((run: string) => string) => (run) => `\`\`\`{r}\n${call(run)}\n\`\`\`\n\n# Z\n`;
  const aliasDoc = (value: (run: string) => string): ((run: string) => string) => (run) => `---\nfrom: *${value(run)}\n---\n\n# Z\n`;

  const S334_ROWS: S334Row[] = [
    // Controls: fast on the parent too, so they cannot be RED there; they hold the HEADING LIST of the same documents at the same size. These rows are clocks: a cured function replaced by a constant keeps them green, and the answers of
    // the four functions are pinned by the four `*-equivalence.test.ts` files and the call-site rows beside them (Session 334's review round).
    { site: "control (4): `<p>` and 100,000 `<>` pairs, every start matches", from: null, unit: "<>", many: 100_000, build: tagTable("<p>"), setext: true },
    { site: "control (4): `<p>`, 100,000 `<` and a `>` at the end, the first start reads to the end and matches", from: null, unit: "<", many: 100_000, build: tagTable("<p>", ">"), setext: true },
    { site: "control (4): a tag line of 200,000 letters, no further `<`", from: null, unit: "x", many: 200_000, build: tagTable("<p>") },
    { site: "control (4): 100,000 `<` on a line that is no tag line, the first guard refuses it", from: null, unit: "<", many: 100_000, build: tagTable("ab") },
    { site: "control (5): `[a]: /u` and 100,000 `{`, the URL ends before the run", from: null, unit: "{", many: 100_000, build: (run) => `[a]: /u ${run}\n------- -------\n\n# Z\n` },
    { site: "control (5): `[a]: ` and 100,000 `{` closed by `}x`, the first give-back matches", from: null, unit: "{", many: 100_000, build: (run) => `[a]: ${run}}x\n------- -------\n\n# Z\n` },
    { site: "control (6): `options(` and 200,000 digits, no name can start", from: null, engine: "knitr", unit: "1", many: 200_000, build: knitrCell((run) => `options(${run})`) },
    { site: "control (6): 30,000 assignments inside one `options(`", from: null, engine: "knitr", unit: "a=1,", many: 30_000, build: knitrCell((run) => `options(${run})`) },
    { site: "control (7): `from: *` and 200,000 letters, an alias with no terminator", from: null, unit: "a", many: 200_000, build: aliasDoc((run) => run) },
    { site: "control (7): `from: *` and 100,000 `#` with no terminator", from: null, unit: "#", many: 100_000, build: aliasDoc((run) => run) },

    // Part (4), the table-header question (`isTableHeaderCandidate`, asked of the line above a simple table's dash rule): the run, and the tails that keep a `>` out of reach.
    { site: "(4) table header: `<p>` and 36,000 `<`", from: null, unit: "<", many: 36_000, build: tagTable("<p>") },
    { site: "(4) table header: `<p>`, 36,000 `<` and a `>` inside double quotes", from: null, unit: "<", many: 36_000, build: tagTable("<p>", '"x>y"') },
    { site: "(4) table header: `<p>`, 36,000 `<` and a double quote that never closes", from: null, unit: "<", many: 36_000, build: tagTable("<p>", '"') },
    { site: "(4) table header: `<p>`, 36,000 `<` and a single quote that never closes", from: null, unit: "<", many: 36_000, build: tagTable("<p>", "'") },
    { site: "(4) table header: `<p>` and 21,000 of `<a `", from: null, unit: "<a ", many: 21_000, build: tagTable("<p>") },
    // Part (4), the free case (`endsFreshHtml`, asked of the line above an indented cell opener under a reader outside pandoc's markdown).
    { site: "(4) free case: from: markdown_mmd, `<p>` and 52,000 `<`, then an indented cell opener", from: "markdown_mmd", unit: "<", many: 52_000, build: (run) => `<p>${run}\n${cellOpener}\n# Z\n` },
    { site: "(4) free case: from: markdown_phpextra, text, `<div>` and 54,000 `<`, then an indented cell opener", from: "markdown_phpextra", unit: "<", many: 54_000, build: (run) => `text\n\n<div>${run}\n${cellOpener}\n# Z\n` },

    // Part (5): the run is the URL itself (`[a]: ` and `{`), so `\S+` gives back one `{` at a time.
    { site: "(5) rule below: `[a]: ` and 60,000 `{`", from: null, unit: "{", many: 60_000, build: (run) => `[a]: ${run}\n------- -------\n\n# Z\n` },
    { site: "(5) rule below, the URL on the next line: `[a]:` then 80,000 `{`", from: null, unit: "{", many: 80_000, build: (run) => `[a]:\n${run}\n------- -------\n\n# Z\n` },
    { site: "(5) rule below: `[a]: `, 60,000 `{` and a letter", from: null, unit: "{", many: 60_000, build: (run) => `[a]: ${run}x\n------- -------\n\n# Z\n` },

    // Part (6): the argument list of `options(`, in a cell, in inline code and under a `#|` header.
    { site: "(6) cell: `options(` and 72,000 letters", from: null, engine: "knitr", unit: "a", many: 72_000, build: knitrCell((run) => `options(${run})`) },
    { site: "(6) cell: `options(` and 72,000 dots", from: null, engine: "knitr", unit: ".", many: 72_000, build: knitrCell((run) => `options(${run})`) },
    { site: "(6) cell: `options(` and 30,000 of `a1`", from: null, engine: "knitr", unit: "a1", many: 30_000, build: knitrCell((run) => `options(${run})`) },
    { site: "(6) cell: `options(digits = 3, ` and 72,000 letters, the first name is allowed", from: null, engine: "knitr", unit: "a", many: 72_000, build: knitrCell((run) => `options(digits = 3, ${run})`) },
    { site: "(6) cell with a `#|` header: `options(` and 52,000 letters", from: null, engine: "knitr", unit: "a", many: 52_000, build: (run) => `\`\`\`{r}\n#| echo: false\noptions(${run})\n\`\`\`\n\n# Z\n` },
    { site: "(6) inline code: `r options(` and 72,000 letters", from: null, engine: "knitr", unit: "a", many: 72_000, build: (run) => `text \`r options(${run})\`\n\n# Z\n` },

    // Part (7): a `#` run is the alias name, a line terminator follows (CR, U+2028, U+2029), at the two call sites (a block `from:` and a flow-mapping `from:`).
    { site: "(7) from: *, 72,000 `#`, a CR and a letter", from: null, unit: "#", many: 72_000, build: aliasDoc((run) => `${run}\rx`) },
    { site: "(7) from: *, 72,000 `#`, a U+2028 and a letter", from: null, unit: "#", many: 72_000, build: aliasDoc((run) => `${run}${LS}x`) },
    { site: "(7) from: *, 72,000 `#`, a U+2029 and a letter", from: null, unit: "#", many: 72_000, build: aliasDoc((run) => `${run}${PS}x`) },
    { site: "(7) from: *, 52,000 of `a#`, a CR and a letter", from: null, unit: "a#", many: 52_000, build: aliasDoc((run) => `${run}\rx`) },
    { site: "(7) format: html: from: *, 72,000 `#`, a CR and a letter", from: null, unit: "#", many: 72_000, build: (run) => `---\nformat:\n  html:\n    from: *${run}\rx\n---\n\n# Z\n` },
    { site: "(7) flow format: {html: {from: *, 52,000 `#`, a CR and a letter", from: null, unit: "#", many: 52_000, build: (run) => `---\nformat: {html: {from: *${run}\rx}}\n---\n\n# Z\n` },
  ];

  it.each(S334_ROWS.map((row) => [row.site, row] as const))("%s: is read in linear time, and the answer is the stated one with 4 units and with the long run", (_site, row) => {
    const short = s334FrontMatter(row.from) + row.build(row.unit.repeat(S334_FEW));
    expect(s334Headings(short, row.engine)).toEqual(s334Expected(row, short));
    const run = row.unit.repeat(row.many);
    const longText = s334FrontMatter(row.from) + row.build(run);
    expect(longText.length).toBeGreaterThan(run.length); // the timed text holds the whole run
    const { result, ms } = timed(() => s334Headings(longText, row.engine));
    expect(result).toEqual(s334Expected(row, longText));
    expect(ms).toBeLessThan(S334_LIMIT_MS);
  });

  it("builds a different text for every row", () => {
    // The TEXT alone: `scanRegions` keeps the last two scans by text, so a row whose text another row read just before it is served from the cache and cannot be RED.
    const long = S334_ROWS.map((row) => s334FrontMatter(row.from) + row.build(row.unit.repeat(row.many)));
    expect(new Set(long).size).toBe(S334_ROWS.length);
    const small = S334_ROWS.map((row) => s334FrontMatter(row.from) + row.build(row.unit.repeat(S334_FEW)));
    expect(new Set(small).size).toBe(S334_ROWS.length);
  });

  // A run of 3,000 characters, or a limit of 100 s, would pass on the parent too.
  it("keeps the sizes, the limit and the units the Session 334 rows are built on", () => {
    expect([S334_FEW, S334_LIMIT_MS]).toEqual([4, 1000]);
    expect(S334_ROWS.map((row) => `${row.unit}x${row.many}`)).toEqual([
      "<>x100000", "<x100000", "xx200000", "<x100000", "{x100000", "{x100000", "1x200000", "a=1,x30000", "ax200000", "#x100000",
      "<x36000", "<x36000", "<x36000", "<x36000", "<a x21000", "<x52000", "<x54000",
      "{x60000", "{x80000", "{x60000",
      "ax72000", ".x72000", "a1x30000", "ax72000", "ax52000", "ax72000",
      "#x72000", "#x72000", "#x72000", "a#x52000", "#x72000", "#x52000",
    ]);
  });
});

describe("Session 335 — a single line of millions of characters that a pattern read as a quantified group (parts 4 to 9 of the BACKLOG item \"Nine more single-line overflow and slow-input families, none of them in Session 317's diff\")", () => {
  // V8 keeps one entry of its regex backtrack stack per repetition of a GROUP (and of a counted loop such as `#{7,}`), so a pattern that reads a run as `(?:a|b)*` throws `RangeError: Maximum call stack size exceeded` once the run
  // is long enough, and the RangeError reaches every reader of the document (the Outline, the front matter, the engine resolver, the label index): the same class as Session 317's thematic breaks. The first throw was bisected
  // at HEAD `c06ee06` in repetitions of each unit (Session 335, fresh process, `findHeadings` unless a row says otherwise): a pipe delimiter row 1,525,196 `|-`; a `from:` extension list 3,355,428 `+_`; a YAML tag or anchor
  // 2,097,144 `&a `; a run of `#` 5,592,382; a run of `>` 8,388,576; a LaTeX macro tail 2,097,143 `\x`, 3,355,429 `[]`, 8,388,572 `{}`. Every size below is twice its threshold (Learning 775). A line this long is not typed: it is
  // a pasted or minified blob, and a thrown RangeError answers nothing for the whole document, so the stated answer is the heading BELOW the line (and, where the line decides it, a heading the line changes).
  const S335_FEW = 4;
  const S335_LIMIT_MS = 4000;
  const headings = (text: string): string[] => findHeadings(text).map((h) => h.text);
  const body = (line: string): string => `Intro.\n\n${line}\n\n# H\n`;
  const underParagraph = (line: string): string => `Intro.\n${line}\n# H\n`;
  const afterParagraph = (line: string): string => `Intro.\n${line}\n\n# H\n`;
  const withFrom = (value: string): string => `---\nfrom: ${value}\n---\n\nIntro\n# pressed\n\n# H\n`;
  type S335Row = { site: string; unit: string; many: number; few?: number; build: (run: string) => string; read: (text: string) => unknown; answer: unknown };

  const S335_ROWS: S335Row[] = [
    // Part (4): a pipe table's delimiter row and a table's rule row, a group per cell (the patterns `PIPE_DELIMITER_ROW` and `TABLE_RULE_ROW` then; the functions `pipeDelimiterRow` and `tableRuleRow` now).
    { site: "(4) body line: n of `|-` and a closing `|`", unit: "|-", many: 3_100_000, build: (run) => body(`${run}|`), read: headings, answer: ["H"] },
    { site: "(4) body line: n of `-|`", unit: "-|", many: 3_100_000, build: (run) => body(run), read: headings, answer: ["H"] },
    { site: "(4) body line: n of `|:-:` and a closing `|`", unit: "|:-:", many: 3_100_000, build: (run) => body(`${run}|`), read: headings, answer: ["H"] },
    { site: "(4) pipe table: a header row, a delimiter row of n `|-` cells, a body row", unit: "|-", many: 3_100_000, build: (run) => `| a | b |\n${run}|\n| 1 | 2 |\n\n# H\n`, read: headings, answer: ["H"] },
    { site: "(4) directly under a paragraph: n of `|-` and a closing `|`", unit: "|-", many: 3_100_000, build: (run) => afterParagraph(`${run}|`), read: headings, answer: ["H"] },

    // Part (5): a front matter `from:` value, `markdown` and then an extension list, `(?:[+-][a-zA-Z_]+)*`. The list decides `blank_before_header`, so a heading pressed against a paragraph is, or is not, one.
    { site: "(5) from: markdown and n of `+_`: a pressed heading is refused", unit: "+_", many: 6_800_000, build: (run) => withFrom(`markdown${run}`), read: headings, answer: ["H"] },
    { site: "(5) from: markdown, n of `+_` and -blank_before_header: the last token wins and the heading is one", unit: "+_", many: 6_800_000, build: (run) => withFrom(`markdown${run}-blank_before_header`), read: headings, answer: ["pressed", "H"] },
    { site: "(5) from: markdown-blank_before_header and n of `+_`", unit: "+_", many: 6_800_000, build: (run) => withFrom(`markdown-blank_before_header${run}`), read: headings, answer: ["pressed", "H"] },
    { site: "(5) from: markdown_mmd and n of `+_`: the variant keeps no blank_before_header", unit: "+_", many: 6_800_000, build: (run) => withFrom(`markdown_mmd${run}`), read: headings, answer: ["pressed", "H"] },
    { site: "(5) from: markdown_mmd, n of `+_` and +blank_before_header", unit: "+_", many: 6_800_000, build: (run) => withFrom(`markdown_mmd${run}+blank_before_header`), read: headings, answer: ["H"] },
    { site: "(5) from: markdown and n of `-Z`", unit: "-Z", many: 6_800_000, build: (run) => withFrom(`markdown${run}`), read: headings, answer: ["H"] },
    { site: "(5) from: \"markdown\" (quoted) and n of `+_`", unit: "+_", many: 6_800_000, build: (run) => withFrom(`"markdown${run}"`), read: headings, answer: ["H"] },
    { site: "(5) from: markdown, n of `+_` and a character that ends the list (the reader is not resolved)", unit: "+_", many: 6_800_000, build: (run) => withFrom(`markdown${run}!`), read: headings, answer: ["pressed", "H"] },

    // Part (6): the node properties (`&anchor`, `!tag`) in front of a value, `(?:[&!][^\s,[\]{}]*[ \t]*)+`, at the four places that strip them.
    { site: "(6) front matter: a title of n `&a `, then engine: knitr (findFrontMatterTopLevelLines)", unit: "&a ", many: 4_200_000, build: (run) => `---\ntitle: ${run}\nengine: knitr\n---\n`, read: (text) => findFrontMatterTopLevelLines(text).map((l) => l.key), answer: ["title", "engine"] },
    { site: "(6) the same front matter through the engine resolver", unit: "&a ", many: 4_200_000, build: (run) => `---\ntitle: ${run}\nengine: knitr\n---\n\n# H\n`, read: (text) => resolveDocumentEngine("a.qmd", text), answer: "knitr" },
    { site: "(6) front matter: a title of n `!t `, then engine: knitr", unit: "!t ", many: 4_200_000, build: (run) => `---\ntitle: ${run}\nengine: knitr\n---\n\n# H\n`, read: (text) => resolveDocumentEngine("a.qmd", text), answer: "knitr" },
    { site: "(6) nested front matter: format / html / toc-title of n `&a `, then theme (findNestedFrontMatterValueLines)", unit: "&a ", many: 4_200_000, build: (run) => `---\nformat:\n  html:\n    toc-title: ${run}\n    theme: cosmo\n---\n`, read: (text) => findNestedFrontMatterValueLines(text).map((l) => l.key), answer: ["toc-title", "theme"] },
    { site: "(6) a project file: project / title of n `&a `, then type (findProjectConfigValueLines)", unit: "&a ", many: 4_200_000, build: (run) => `project:\n  title: ${run}\n  type: website\n`, read: (text) => findProjectConfigValueLines(text).map((l) => l.key), answer: ["title", "type"] },
    { site: "(6) a cell: `#| fig-cap:` of n `&a `, then `#| label: fig-a` (findCellOptionLines)", unit: "&a ", many: 4_200_000, build: (run) => `\`\`\`{r}\n#| fig-cap: ${run}\n#| label: fig-a\n1\n\`\`\`\n`, read: (text) => findCellOptionLines(text).map((o) => o.line), answer: [1, 2] },
    { site: "(6) a cell: the same, through the label index", unit: "!t ", many: 4_200_000, build: (run) => `\`\`\`{r}\n#| fig-cap: ${run}\n#| label: fig-a\n1\n\`\`\`\n`, read: (text) => indexLabels(text).map((l) => [l.id, l.line]), answer: [["fig-a", 2]] },

    // Part (7): a run of `#`, `#{7,}`, at the two call sites of the deep-header test (the default reader and a reader without `space_in_atx_header`).
    { site: "(7) body line: n of `#`", unit: "#", many: 11_200_000, few: 8, build: (run) => body(run), read: headings, answer: ["H"] },
    { site: "(7) directly under a paragraph: n of `#`", unit: "#", many: 11_200_000, few: 8, build: (run) => afterParagraph(run), read: headings, answer: ["H"] },
    { site: "(7) from: markdown_strict, a body line of n of `#`", unit: "#", many: 11_200_000, few: 8, build: (run) => `---\nfrom: markdown_strict\n---\n\nIntro.\n\n${run}\n\n# H\n`, read: headings, answer: ["H"] },

    // Part (8): a run of `>`, `(?:>[ ]?)+`.
    { site: "(8) body line: n of `>`", unit: ">", many: 16_800_000, build: (run) => body(run), read: headings, answer: ["H"] },
    { site: "(8) body line: n of `> `", unit: "> ", many: 16_800_000, build: (run) => body(run), read: headings, answer: ["H"] },
    { site: "(8) n of `>` and a heading in the quote", unit: ">", many: 16_800_000, build: (run) => `${run} # Quoted\n\n# H\n`, read: headings, answer: ["Quoted", "H"] },

    // Part (9): the argument and the tail of a block macro line, `ARG*` and `(?:[ \t]*\\name ARG*)*`.
    { site: "(9) a block macro line: `\\pdfstringdef[]` and n of `\\x`, directly under a paragraph (the line closes it)", unit: "\\x", many: 4_200_000, build: (run) => underParagraph(` \t\\pdfstringdef[]${run}  `), read: headings, answer: ["H"] },
    { site: "(9) the same with prose after the tail: the line is not a block and the heading is pressed", unit: "\\x", many: 4_200_000, build: (run) => underParagraph(` \t\\pdfstringdef[]${run} prose`), read: headings, answer: [] },
    { site: "(9) a block macro line: `\\pdfstringdef` and n of `[]`", unit: "[]", many: 6_800_000, build: (run) => body(` \t\\pdfstringdef${run}  `), read: headings, answer: ["H"] },
    { site: "(9) a block macro line: `\\pdfstringdef` and n of `{}`", unit: "{}", many: 16_800_000, build: (run) => body(` \t\\pdfstringdef${run}  `), read: headings, answer: ["H"] },
  ];

  it.each(S335_ROWS.map((row) => [row.site, row] as const))("%s: is read without throwing, in linear time, and the answer is the stated one with 4 units and with the long run", (_site, row) => {
    const short = row.build(row.unit.repeat(row.few ?? S335_FEW));
    expect(row.read(short)).toEqual(row.answer);
    const run = row.unit.repeat(row.many);
    const longText = row.build(run);
    expect(longText.length).toBeGreaterThan(run.length); // the timed text holds the whole run
    const { result, ms } = timed(() => row.read(longText));
    expect(result).toEqual(row.answer);
    expect(ms).toBeLessThan(S335_LIMIT_MS);
  }, 120_000);

  it("builds a different text for every row", () => {
    // The TEXT alone: `scanRegions` keeps the last two scans by text, so a row whose text another row read just before it is served from the cache and cannot be RED.
    // A long text is its row's builder applied to `unit x many`, so distinct small texts and distinct (unit, many) pairs make the long ones distinct without holding thirty megabytes of each.
    const small = S335_ROWS.map((row) => row.build(row.unit.repeat(row.few ?? S335_FEW)));
    expect(new Set(small).size).toBe(S335_ROWS.length);
  });

  // A run of 3,000,000 characters, or a limit of 100 s, would pass on the parent too.
  it("keeps the sizes, the limit and the units the Session 335 rows are built on", () => {
    expect([S335_FEW, S335_LIMIT_MS]).toEqual([4, 4000]);
    expect(S335_ROWS.map((row) => `${row.unit}x${row.many}`)).toEqual([
      "|-x3100000", "-|x3100000", "|:-:x3100000", "|-x3100000", "|-x3100000",
      "+_x6800000", "+_x6800000", "+_x6800000", "+_x6800000", "+_x6800000", "-Zx6800000", "+_x6800000", "+_x6800000",
      "&a x4200000", "&a x4200000", "!t x4200000", "&a x4200000", "&a x4200000", "&a x4200000", "!t x4200000",
      "#x11200000", "#x11200000", "#x11200000",
      ">x16800000", "> x16800000", ">x16800000",
      "\\xx4200000", "\\xx4200000", "[]x6800000", "{}x16800000",
    ]);
  });
});
