import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";
import { buildOutline } from "../../src/core/qmd/model";
import { type FlatOutlineSymbol, flattenOutline } from "../../src/core/workspace-symbols";

// Session 338, part E of the BACKLOG item "Eleven more places that throw RangeError on a long line or a long list" -- site (7), the array spread in `flattenOutline` (`src/core/workspace-symbols.ts`):
// `result.push(...flattenOutline(symbol.children, symbol.name))`.
//
// NOT A REGEX: a call with a spread argument puts one stack slot per element on the call stack, so a heading or a cell with more descendants than the stack holds throws
// `RangeError: Maximum call stack size exceeded`. A RangeError answers NOTHING: `providers/workspace-symbols.ts` calls `flattenOutline` for every `.qmd` file of the workspace with no `catch`, so ONE document with a
// section this long fails "Go to Symbol in Workspace" for EVERY file, not only that one.
//
// Measured at HEAD `fe6aaec` (Session 338, Node 22.23.3, one fresh process per probe, `buildOutline(doc, engine, "execute")` and then `flattenOutline(outline)` as the provider calls them; the lower bound was run and
// was OK before each bisect; 16 bisections: shape x engine x width): `# Top` followed by N lines `## h`, or by N cells, throws from 110,360 descendants (last OK 110,359) in 14 of the 16 bisections; the other two moved by
// about 15 between processes (110,346 and a last OK that did not repeat), because the optimizing compiler changes the size of a frame. The review of Session 338 re-measured it through the real provider with `vscode` stubbed: last OK
// 110,540, first throw 110,560 in three fresh processes, because the provider's own frames sit under the call; the first throw depends on how deep the caller's stack already is, and 250,000 is more than twice either figure. The stage that threw is `flattenOutline` in the 15 bisections that reported one (the sixteenth did not repeat its throw), never `buildOutline`.
// THE WIDTH OF THE LINE DOES NOT MATTER HERE (unlike a regex over a line): a document of characters up to U+00FF and one with the CJK letter U+4E2D in the Top heading threw at the same count. Neither does the
// engine hint (undefined, "knitr", "jupyter", or the resolver's answer) nor the shape (headings or cells). The BACKLOG item says 125,742: that figure came from another process and the first throw moves with the stack
// the process starts with, so the size below is 250,000 descendants, about twice the first throw (Learning 775): 2.27 times the figure measured here and 1.99 times the BACKLOG's.
//
// THE ANSWER is what a short version of the same document gives: the list is depth-first, the first symbol is `Top` with an empty container, and every other symbol has `Top` (or `Mid`) as its container. Each row
// checks every one of the 250,001 symbols, not the length alone.

const COUNT = 250_000;
const SHORT = 3;
/** The first throw measured on the base through `buildOutline` and `flattenOutline` (last OK 110,359): the guard row at the end keeps COUNT about twice of it (Learning 775). */
const FIRST_THROW = 110_360;
/** 3 s for `flattenOutline` alone: the cure flattens 135,000 children in 14.1 ms (a scratch probe, fresh process), and a list copied for every element (a `concat` in a loop, measured on 135,000 citations) took 12,271 ms, so a flatten that is quadratic still fails this limit at 250,000. */
const LIMIT_MS = 3000;
const ROW_TIMEOUT_MS = 40_000;

type Hint = "undefined" | "knitr" | "jupyter" | "resolved";
const HINTS: Hint[] = ["undefined", "knitr", "jupyter", "resolved"];

interface Shape {
  label: string;
  kind: "heading" | "cell";
  /** The language of the cell fences, for the cell shape. */
  lang: string;
  /** The name a child gets in the flat list. */
  childName: string;
  /** The document: the Top heading, then `count` children. */
  build: (count: number, topLine: string) => string;
  /** The first line of child `i` (1-based). */
  startLine: (i: number) => number;
  /** The last line of child `i` of `count`. */
  endLine: (i: number, count: number) => number;
  /** The last line of the document, which is where Top ends. */
  lastLine: (count: number) => number;
}

const headingShape: Shape = {
  label: "headings",
  kind: "heading",
  lang: "python",
  childName: "h",
  build: (count, topLine) => `${topLine}\n${"## h\n".repeat(count)}`,
  startLine: (i) => i,
  endLine: (i, count) => (i < count ? i : count + 1),
  lastLine: (count) => count + 1,
};

const cellShape = (lang: string): Shape => ({
  label: `${lang} cells`,
  kind: "cell",
  lang,
  childName: `\`\`\`{${lang}}`,
  build: (count, topLine) => `${topLine}\n${`\`\`\`{${lang}}\nx\n\`\`\`\n`.repeat(count)}`,
  startLine: (i) => 1 + (i - 1) * 3,
  endLine: (i) => 1 + (i - 1) * 3 + 2,
  lastLine: (count) => 3 * count + 1,
});

const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = Date.now();
  const result = run();
  return { result, ms: Date.now() - started };
};

/** The engine the provider passes: the resolver's answer for "resolved", else the hint itself. */
const engineFor = (hint: Hint, text: string) => (hint === "resolved" ? resolveDocumentEngine("doc.qmd", text) : hint === "undefined" ? undefined : hint);

/** The flat list as the provider reads it: `buildOutline` with the engine and the mode the provider passes, then `flattenOutline`. */
const flatOf = (text: string, hint: Hint): { flat: FlatOutlineSymbol[]; ms: number } => {
  const outline = buildOutline(text, engineFor(hint, text), "execute");
  const { result, ms } = timed(() => flattenOutline(outline));
  return { flat: result, ms };
};

/** Every disagreement (the first few) between `flat` and the answer a document of `count` children of `shape` under `top` gives. */
function disagreements(flat: FlatOutlineSymbol[], shape: Shape, count: number, top: string): string[] {
  const bad: string[] = [];
  const note = (message: string): void => {
    if (bad.length < 5) bad.push(message);
  };
  if (flat.length !== count + 1) note(`length ${flat.length}, expected ${count + 1}`);
  const first = flat[0];
  const expectedTop: FlatOutlineSymbol = { kind: "heading", name: top, containerName: "", startLine: 0, endLine: shape.lastLine(count), selectionLine: 0 };
  if (JSON.stringify(first) !== JSON.stringify(expectedTop)) note(`symbol 0: ${JSON.stringify(first)}, expected ${JSON.stringify(expectedTop)}`);
  for (let i = 1; i <= count && i < flat.length; i++) {
    const symbol = flat[i];
    const start = shape.startLine(i);
    if (symbol.kind !== shape.kind || symbol.name !== shape.childName || symbol.containerName !== top || symbol.startLine !== start || symbol.selectionLine !== start || symbol.endLine !== shape.endLine(i, count)) {
      note(`symbol ${i}: ${JSON.stringify(symbol)}`);
    }
  }
  return bad;
}

describe("Session 338 -- the helpers of these rows read a SHORT document the way the long rows expect (so a wrong expectation fails here first)", () => {
  it.each([
    ["headings", headingShape],
    ["python cells", cellShape("python")],
    ["r cells", cellShape("r")],
  ])("%s: a short document gives the answer the long rows expect", (_label, shape) => {
    for (const hint of HINTS) {
      const text = shape.build(SHORT, "# Top");
      expect(disagreements(flatOf(text, hint).flat, shape, SHORT, "Top")).toEqual([]);
    }
  });
});

describe("Session 338 -- a heading with more than a hundred thousand descendants must not fail the workspace symbols (the BACKLOG item \"Eleven more places that throw RangeError\", part E, site 7)", () => {
  // The Top heading in its two forms: all characters up to U+00FF, and with one character above U+00FF (CJK U+4E2D). The count of descendants, not the width, is what throws; both are read so that a cure that
  // looked at the line's width could not pass one and fail the other.
  const TOPS: Array<[string, string]> = [
    ["characters up to U+00FF", "Top"],
    ["a character above U+00FF in the Top heading", "Top中"],
  ];

  describe.each(TOPS)("%s", (_width, top) => {
    it.each(HINTS)(`${COUNT.toLocaleString("en-US")} headings under Top, engine hint %s: all of them are listed, depth-first, with Top as their container`, (hint) => {
      const text = headingShape.build(COUNT, `# ${top}`);
      const { flat, ms } = flatOf(text, hint);
      expect(disagreements(flat, headingShape, COUNT, top)).toEqual([]);
      expect(ms).toBeLessThan(LIMIT_MS);
    }, ROW_TIMEOUT_MS);

    it.each([
      ["undefined", "python"],
      ["knitr", "r"],
      ["jupyter", "python"],
      ["resolved", "python"],
    ] as Array<[Hint, string]>)(`${COUNT.toLocaleString("en-US")} cells under Top, engine hint %s (cells of language %s): all of them are listed`, (hint, lang) => {
      const shape = cellShape(lang);
      const text = shape.build(COUNT, `# ${top}`);
      const { flat, ms } = flatOf(text, hint);
      expect(disagreements(flat, shape, COUNT, top)).toEqual([]);
      expect(ms).toBeLessThan(LIMIT_MS);
    }, ROW_TIMEOUT_MS);
  });

  it("the descendants of a heading that is not the first: a second top-level heading with the long section keeps its own container, and the first one's small section is listed before it", () => {
    const text = `# First\n## small\n# Second\n${"### h\n".repeat(COUNT)}`;
    const { flat } = flatOf(text, "undefined");
    expect(flat.length).toBe(COUNT + 3);
    expect(flat.slice(0, 3).map((s) => [s.name, s.containerName])).toEqual([
      ["First", ""],
      ["small", "First"],
      ["Second", ""],
    ]);
    let wrong = 0;
    for (let i = 3; i < flat.length; i++) {
      if (flat[i].name !== "h" || flat[i].containerName !== "Second" || flat[i].selectionLine !== i) wrong++;
    }
    expect(wrong).toBe(0);
  }, ROW_TIMEOUT_MS);

  it("two levels: Top holds Mid and Mid holds the long list, so the spread is met at two depths and Mid is the container of every h", () => {
    const text = `# Top\n## Mid\n${"### h\n".repeat(COUNT)}`;
    const { flat } = flatOf(text, "undefined");
    expect(flat.length).toBe(COUNT + 2);
    expect(flat.slice(0, 3).map((s) => [s.name, s.containerName])).toEqual([
      ["Top", ""],
      ["Mid", "Top"],
      ["h", "Mid"],
    ]);
    let wrong = 0;
    for (let i = 2; i < flat.length; i++) {
      if (flat[i].name !== "h" || flat[i].containerName !== "Mid" || flat[i].selectionLine !== i) wrong++;
    }
    expect(wrong).toBe(0);
  }, ROW_TIMEOUT_MS);
});

// The review of Session 338: nothing noticed the provider going back to a spreading flatten of its own (a local copy of the old function passed every unit test and failed only the integration suite, which takes over the
// screen and works on a small workspace). Like the citation adapter's gate, this one reads the SOURCE of `src/providers/workspace-symbols.ts`; it is a wiring gate and not a run.
describe("Session 338 -- the provider flattens through the core function and spreads nothing (a wiring gate: it reads the SOURCE of src/providers/workspace-symbols.ts, it does not run it)", () => {
  // Comments are stripped first: the provider's docstring may name the old spelling to say it is forbidden. Only a block comment that opens a line is stripped: the provider holds the glob `"**/*.qmd"`, whose
  // `/*` would otherwise open a "comment" that swallows the code up to the next `*/`.
  const code = readFileSync(path.join(__dirname, "../../src/providers/workspace-symbols.ts"), "utf8")
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("createWorkspaceSymbolCache is imported from the core module (Session 343), where flatSymbolsOf calls flattenOutline on the outline buildOutline built", () => {
    expect(code).toMatch(/import\s*\{[^}]*\bcreateWorkspaceSymbolCache\b[^}]*\}\s*from\s*"\.\.\/core\/workspace-symbols"/);
    const core = readFileSync(path.join(__dirname, "../../src/core/workspace-symbols.ts"), "utf8")
      .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(core).toMatch(/flattenOutline\(\s*buildOutline\(/);
  });

  it("the provider defines no flatten of its own", () => {
    expect(code).not.toMatch(/function\s+\w*[fF]latten/);
    expect(code).not.toMatch(/(?:const|let)\s+\w*[fF]latten\w*\s*=/);
  });

  it("no call in the provider has a spread argument (a list that grows with a document must never be spread into a call)", () => {
    expect(code).not.toMatch(/\(\s*\.\.\./);
    expect(code).not.toMatch(/,\s*\.\.\.\w/);
  });
});

describe("Session 338 -- the size of these rows", () => {
  it("is about twice the first throw measured on the base, so the spread would have thrown", () => {
    expect(COUNT).toBeGreaterThanOrEqual(2 * FIRST_THROW);
    expect(COUNT).toBeLessThan(3 * FIRST_THROW);
  });
});
