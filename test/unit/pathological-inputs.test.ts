import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";
import { bibliographyPaths } from "../../src/core/frontmatter";
import { parseDeclaredFormats } from "../../src/core/preview-format";
import { parseOutputPath } from "../../src/core/render-args";
import { findAllCells, findCellOptionLines, findCodeFenceOpeners, findHeadings, knitrChunkHeaderLabel, maskInlineCode, plainFrontMatter } from "../../src/core/qmd/model";
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
import { LS } from "./support/regex-equivalence";

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
