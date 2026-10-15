import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";
import { findCellOptionLines, findHeadings } from "../../src/core/qmd/model";
import { indexLabels } from "../../src/core/refs";
import { valueSlotAfterColon } from "../../src/core/yaml-context";

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
});

describe("Session 311 — a front matter whose flow mapping never closes", () => {
  // `flowRegion` joins the lines after a `format: {` one at a time until the brackets balance, and used to re-read the whole joined
  // text after each one: 20,000 ordinary lines below an opener that never closes cost 26 s, in every reader of the front matter.
  const unclosed = (opener: string, lines: number): string => ["---", opener, ...Array.from({ length: lines }, () => "x: 1"), "---", "", "# Heading", ""].join("\n");

  it.each([
    ["an unclosed mapping", "format: {html: {echo: false}"],
    ["an unclosed mapping that holds a quoted brace", 'format: {html: {echo: "}"}'],
  ])("%s below 12,000 ordinary lines is read in linear time by the Outline and by the engine resolver", (_what, opener) => {
    const text = unclosed(opener, 12000);
    const headings = timed(() => findHeadings(text));
    expect(headings.result.map((h) => h.text)).toEqual(["Heading"]);
    expect(headings.ms).toBeLessThan(1000);
    const engine = timed(() => resolveDocumentEngine("a.qmd", text));
    expect(engine.result).toBe("markdown");
    expect(engine.ms).toBeLessThan(1000);
  });

  it("…while thousands of mappings that each close on their own line stay linear (the reason `flowRegion` reads windows, not the whole rest of the block)", () => {
    const text = ["---", ...Array.from({ length: 40000 }, () => "format: {html: {from: gfm}}"), "---", "", "Text.", "# Tight", ""].join("\n");
    const headings = timed(() => findHeadings(text));
    expect(headings.result.map((h) => h.text)).toEqual(["Tight"]);
    expect(headings.ms).toBeLessThan(1000);
    const engine = timed(() => resolveDocumentEngine("a.qmd", text));
    expect(engine.result).toBe("markdown");
    expect(engine.ms).toBeLessThan(1000);
  });
});
