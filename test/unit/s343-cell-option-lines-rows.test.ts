import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as ts from "typescript";
import { type CellOptionLine, cellOptionLinesOf, findAllCells, findCellOptionLines } from "../../src/core/qmd/model";
import type { RenderMode } from "../../src/core/render-mode";
import { clockBreaks as ratioBreaks, ratioOfWindows, spinning, type Windows } from "./support/ratio-windows";
import { seededRandom } from "./support/regex-equivalence";

// Session 343 -- part (3) of the BACKLOG item "What Session 342's review round found beside the typing-path cures", SIB-04. `findCellOptionLines(text, engine, mode)` was `findAllCells(text, engine, mode).flatMap(cellOptionLinesOf)`:
// a pass over every cell of the document on EVERY call, though the scan it reads is cached. One completion request inside a cell calls it three times (`embeddedCellAt`, `buildVirtualContent`, `completionContextAt`), the
// value diagnostics and the Outline's builder call it once a pass each. Measured at the parent, a fresh process each, a warm scan (the text unchanged), load 6 to 15, 500 / 2,000 / 8,000 cells of 27 lines (two option lines a
// cell): 1.05 / 2.7 / 11.7 ms a call, against 0.001 ms for the scan's own cell list (`findAllCells`, a slice).
//
// The list is kept lazily on the scan's cache entry (text, engine, mode), so a repeat call on a cached scan costs only a copy of the array. The array is a FRESH one each call (a caller may reorder, add or remove entries
// without reaching the cache, as for `findAllCells`) and its ELEMENTS are the entry's shared objects, which a caller must not mutate (no caller does: `validate-yaml`, `yaml-value-flags`, `virtual-doc` and `yaml-context` read them).
//
// This file holds the ANSWER rows (the old spelling is kept verbatim as `oldFindCellOptionLines` and compared on enumerated documents and on seeded ones, for every engine hint and both render modes; they pass at the parent
// and state what the cure must keep), the IDENTITY rows (the very same element objects on a repeat call, a different array, a changed text, engine or mode computes again), the LAZINESS rows (the scan itself never
// builds the list: it is built by the first ask), and one CLOCK row: three warm calls against one warm scan lookup, read in the same process.
//
// THE CLOCK ROW. Three warm `findCellOptionLines` calls on a 2,000-cell document, as a ratio of one warm `findAllCells` lookup (a slice of 2,000 cells; the option lines are 4,000 elements, so a cure that copies them costs
// about 2 lookups a call, 6 to 8 for the three). Measured at load 6 to 15 in a bare node process: the parent's ratio is about 2,000 to 4,000 (three flatMaps of 2.7 ms over a 0.002 ms lookup), the cure's 6 to 9. The
// limit is 100: more than 10 times the cure and 20 times under the parent. Each round times both windows back to back and the row reads the MEDIAN round, so a pause in one window does not decide it. The clock's own
// rows (`ratioOfWindows`, driven by a clock that only the stand-ins advance) are the second describe: a stuck clock, a window that did not tick, a clock that runs backwards (Learning 910).

type Engine = Parameters<typeof findCellOptionLines>[1];
const ENGINES: Engine[] = [undefined, "knitr", "jupyter", "markdown", "julia", "ambiguous"];
const MODES: RenderMode[] = ["execute", "no-execute"];

/** The OLD spelling, verbatim: the cells of the scan, flat-mapped through the per-cell reader, on every call. */
const oldFindCellOptionLines = (text: string, engine?: Engine, mode?: RenderMode): CellOptionLine[] => findAllCells(text, engine, mode).flatMap((cell) => cellOptionLinesOf(cell));

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE DOCUMENTS. Each is read through its own line numbers. The blind list and the engine-aware list differ on the first six: the memo is per (text, engine, mode) and must not serve one for the other.

/** jupyter, an INDENTED python opener whose cell holds a `#|` line at column 0. Blind: python[0-3], option line 1. Aware (jupyter): r[2-3], no option line (the indent-3 opener is dropped). */
const JUPYTER_OPTION = "   ```{python}\n#| echo: false\n```{r}\n```\n```{ojs}";
/** engine markdown, an indent-4 python opener with a `#|` line at column 0, and a cell at column 0 below it. Blind: option line 5. Aware (markdown): none. */
const MARKDOWN_OPTION = ["---", "engine: markdown", "---", "", "    ```{python}", "#| echo: false", "x = 1", "    ```", "", "```{python}", "y = 2", "```", ""].join("\n");
/** knitr, a setup chunk that silences the chunks below it only when the document EXECUTES, and a chunk with a `#| eval: false` line. Blind: option line 15 is not seen (the stray fence swallows it). Aware, executing: 15. Under --no-execute: none. */
const SETUP_OPTION = [
  "---", "title: t", "---", "", "```{r setup, include=FALSE}", "knitr::opts_chunk$set(echo = F)", "```", "", "# Top", "", "```", "", "## Between", "", "```{r}", "#| eval: false", "```", "", "## After", "", "```{r}", "y <- 1", "```", "", "## Last", "",
].join("\n");
/** knitr, a stray bare fence above a silent python chunk with an option line. Blind: no cell. Aware: python[6-9], option line 7. */
const STRAY_PY = ["prose", "", "```", "", "## Heading Under Test", "", "```{python}", "#| echo: false", "x = 1", "```", "", "## Heading After Chunk", "", "tail prose", ""].join("\n");
/** jupyter, a column-0 python cell whose body holds an indented closer-shaped line. Blind: python[4-6] with its option line cut short; aware: python[4-10]. Option lines at 5 and 6 differ by cell. */
const CLOSER_JUPYTER = ["---", "jupyter: python3", "---", "", "```{python}", "#| echo: false", "s = '''", "  ```", "'''", "#| late: 1", "```"].join("\n");
/** A block-scalar option, a multi-line quoted value and a flow list: the per-cell reader's continuation state. */
const CONTINUATIONS = ["```{python}", "#| fig-cap: |", "#|   echo: banana", "#| label: fig-a", "#| text: \"one", "#|  two\"", "#| list: [1,", "#|   2]", "#| echo: false", "x = 1", "#| not: an option", "```", ""].join("\n");
/** Several languages, a block-comment language, a `//|` family cell, a cell with no code and a fence nobody closed. */
const LANGUAGES = ["---", "title: t", "---", "", "```{r}", "#| echo: false", "```", "", "```{ojs}", "//| echo: false", "```", "", "```{c}", "/*| echo: false */", "```", "", "```{sql}", "--| echo: false", "```", "", "```{python}", "```", "", "```{julia}", "#| output: false", "x = 1"].join("\n");
/** No cell at all, and an empty document. */
const NO_CELLS = ["# Title", "", "prose", "", "```python", "#| not: a cell", "```", ""].join("\n");

const DOCUMENTS: Array<{ name: string; text: string }> = [
  { name: "an indent-3 python opener with a #| line (jupyter)", text: JUPYTER_OPTION },
  { name: "an indent-4 python opener with a #| line (engine markdown)", text: MARKDOWN_OPTION },
  { name: "a setup chunk and a chunk with a #| line (knitr)", text: SETUP_OPTION },
  { name: "a stray fence above a silent python chunk (knitr)", text: STRAY_PY },
  { name: "a column-0 python cell with an indented closer-shaped line (jupyter)", text: CLOSER_JUPYTER },
  { name: "block scalar, multi-line quote and flow list continuations", text: CONTINUATIONS },
  { name: "several languages, a block-comment language, an unclosed cell", text: LANGUAGES },
  { name: "no cell at all", text: NO_CELLS },
  { name: "an empty document", text: "" },
];

const lines = (list: readonly CellOptionLine[]): string => list.map((o) => o.line).join(",");

describe("the documents are what the rows below say they are (the premise: the blind and the aware option lines differ, so a wrong key would show)", () => {
  it("jupyter: the blind list holds option line 1, the aware list none", () => {
    expect(lines(findCellOptionLines(JUPYTER_OPTION))).toBe("1");
    expect(lines(findCellOptionLines(JUPYTER_OPTION, "jupyter"))).toBe("");
  });

  it("markdown: the blind list holds option line 5, the aware list none", () => {
    expect(lines(findCellOptionLines(MARKDOWN_OPTION))).toBe("5");
    expect(lines(findCellOptionLines(MARKDOWN_OPTION, "markdown"))).toBe("");
  });

  it("knitr: the aware list holds option line 15 when the document executes, and none under --no-execute", () => {
    expect(lines(findCellOptionLines(SETUP_OPTION, "knitr", "execute"))).toBe("15");
    expect(lines(findCellOptionLines(SETUP_OPTION, "knitr", "no-execute"))).toBe("");
    expect(lines(findCellOptionLines(SETUP_OPTION))).toBe("");
  });

  it("knitr: the stray fence hides the chunk from the blind list and not from the aware one", () => {
    expect(lines(findCellOptionLines(STRAY_PY))).toBe("");
    expect(lines(findCellOptionLines(STRAY_PY, "knitr"))).toBe("7");
  });

  it("the continuation document holds the option lines the per-cell reader keeps: the block scalar's folded line is not one", () => {
    expect(lines(findCellOptionLines(CONTINUATIONS))).toBe("1,3,4,6,8");
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE ANSWERS. They pass at the parent (the old spelling is the parent) and state what the memo must keep: the answer of the old spelling, for every engine hint and mode, cold and warm.

describe("Session 343 -- findCellOptionLines answers what the old flatMap spelling answers", () => {
  it.each(DOCUMENTS.map((d) => [d.name, d.text] as const))("%s: every engine hint and render mode, the first (cold) call and the repeat (warm) call", (_name, text) => {
    for (const engine of ENGINES) {
      for (const mode of MODES) {
        const expected = oldFindCellOptionLines(text, engine, mode);
        expect(findCellOptionLines(text, engine, mode), `cold ${engine} ${mode}`).toEqual(expected);
        expect(findCellOptionLines(text, engine, mode), `warm ${engine} ${mode}`).toEqual(expected);
      }
    }
  });

  it("the arguments are optional and last: omitted is the blind list, and the mode defaults to execute", () => {
    for (const { text } of DOCUMENTS) {
      expect(findCellOptionLines(text)).toEqual(oldFindCellOptionLines(text));
      expect(findCellOptionLines(text, "knitr")).toEqual(oldFindCellOptionLines(text, "knitr", "execute"));
      expect(findCellOptionLines(text, undefined, "no-execute")).toEqual(oldFindCellOptionLines(text, undefined, "no-execute"));
    }
  });

  it("400 seeded documents of fence, option and prose lines, each under every engine hint and mode (16 asks apiece), interleaved so that the cache is entered, left and entered again", () => {
    const PROSE = ["---", "title: t", "engine: markdown", "jupyter: python3", "# Heading", "prose", "", "```python", "    ```", "```", "````", "~~~", "  ```", "<!-- c -->", "::: {.panel}", ":::", "x = 1"];
    const OPENERS = ["```{python}", "```{python}", "```{r}", "```{r setup, include=FALSE}", "```{ojs}", "```{sql}", "```{c}", "    ```{python}", "   ```{python}", "````{python}"];
    const OPTIONS = ["#| echo: false", "#| label: fig-x", "#| fig-cap: |", "#|   echo: banana", "#| text: \"one", "#|  two\"", "#| list: [1,", "#|   2]", "//| echo: false", "--| echo: false", "x = 1", "#| eval: false"];
    const CLOSERS = ["```", "```", "```", "    ```", "  ```", "````"];
    const pick = <T,>(rand: () => number, list: readonly T[]): T => list[Math.floor(rand() * list.length)];
    const rand = seededRandom(343_001);
    let withOptions = 0;
    let withBothLists = 0;
    for (let d = 0; d < 400; d++) {
      const parts: string[] = [];
      for (let block = 0, blocks = 2 + Math.floor(rand() * 5); block < blocks; block++) {
        if (rand() < 0.3) {
          parts.push(pick(rand, PROSE));
          continue;
        }
        parts.push(pick(rand, OPENERS));
        for (let o = 0, options = Math.floor(rand() * 4); o < options; o++) parts.push(pick(rand, OPTIONS));
        for (let c = 0, code = Math.floor(rand() * 3); c < code; c++) parts.push(pick(rand, rand() < 0.5 ? PROSE : OPTIONS));
        if (rand() < 0.9) parts.push(pick(rand, CLOSERS));
      }
      const text = parts.join(rand() < 0.2 ? "\r\n" : "\n");
      const blind = oldFindCellOptionLines(text);
      if (blind.length > 0) withOptions++;
      if (ENGINES.some((engine) => lines(oldFindCellOptionLines(text, engine, "execute")) !== lines(blind))) withBothLists++;
      // Interleave: the keys of one text are asked in a shuffled order, and the first four again, so a memo kept on the wrong entry would be served for another key.
      const keys = ENGINES.flatMap((engine) => MODES.map((mode) => ({ engine, mode })));
      for (let i = keys.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [keys[i], keys[j]] = [keys[j], keys[i]];
      }
      for (const { engine, mode } of [...keys, ...keys.slice(0, 4)]) {
        expect(findCellOptionLines(text, engine, mode), JSON.stringify({ text, engine, mode })).toEqual(oldFindCellOptionLines(text, engine, mode));
      }
    }
    // The draw reached the code under test: most of the 400 documents hold an option line, and a share of them hold a different list under some engine hint than the blind one.
    expect(withOptions).toBeGreaterThan(200);
    expect(withBothLists).toBeGreaterThan(20);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE IDENTITY ROWS. A repeat call on a cached scan hands back the very same ELEMENT objects in an array of its own; a changed text, engine or mode is another scan and computes its own.

describe("Session 343 -- a repeat call on a cached scan costs a copy: the same elements, a different array", () => {
  const OPTIONS_TEXT = ["```{python}", "#| echo: false", "#| label: fig-a", "x = 1", "```", "", "```{r}", "#| warning: false", "y <- 1", "```", ""].join("\n");

  it("the second call returns the very element objects of the first, in a different array", () => {
    const first = findCellOptionLines(OPTIONS_TEXT);
    const second = findCellOptionLines(OPTIONS_TEXT);
    expect(first).toHaveLength(3);
    expect(second).not.toBe(first);
    expect(second).toHaveLength(first.length);
    second.forEach((element, i) => expect(element).toBe(first[i]));
  });

  it("a third call after a call of another surface on the same scan (findAllCells) still returns those elements", () => {
    const first = findCellOptionLines(OPTIONS_TEXT);
    findAllCells(OPTIONS_TEXT);
    const third = findCellOptionLines(OPTIONS_TEXT);
    third.forEach((element, i) => expect(element).toBe(first[i]));
  });

  it("the elements of the memo are the elements the per-cell reader would make: equal to a fresh cellOptionLinesOf of the scan's cells, not the same objects (that reader stays as it was)", () => {
    const fresh = findAllCells(OPTIONS_TEXT).flatMap((cell) => cellOptionLinesOf(cell));
    const memo = findCellOptionLines(OPTIONS_TEXT);
    expect(memo).toEqual(fresh);
    memo.forEach((element, i) => expect(element).not.toBe(fresh[i]));
    // and it is not memoised: two calls of the per-cell reader on one cell make two lists of two sets of objects
    const [cell] = findAllCells(OPTIONS_TEXT);
    const a = cellOptionLinesOf(cell);
    const b = cellOptionLinesOf(cell);
    expect(b).not.toBe(a);
    expect(b[0]).not.toBe(a[0]);
    expect(b).toEqual(a);
  });

  it("a changed text computes again: the answer of the new text (lines shifted), other elements, and the old text comes back with its own", () => {
    const shifted = `an added line\n${OPTIONS_TEXT}`;
    const before = findCellOptionLines(OPTIONS_TEXT);
    const after = findCellOptionLines(shifted);
    expect(lines(before)).toBe("1,2,7");
    expect(lines(after)).toBe("2,3,8");
    expect(after).toEqual(oldFindCellOptionLines(shifted));
    // the old text comes back with its own answer, whatever the cache did in between
    expect(findCellOptionLines(OPTIONS_TEXT)).toEqual(before);
  });

  it("a text of the same length and the same answer is still another text: equal lists, other elements", () => {
    const sibling = OPTIONS_TEXT.replace("fig-a", "fig-b");
    expect(sibling).toHaveLength(OPTIONS_TEXT.length);
    const before = findCellOptionLines(OPTIONS_TEXT);
    const after = findCellOptionLines(sibling);
    expect(after).toEqual(before);
    after.forEach((element, i) => expect(element).not.toBe(before[i]));
  });

  it("a changed engine computes again, and the blind and the aware lists of one text are served each its own, in either order", () => {
    const blind = findCellOptionLines(JUPYTER_OPTION);
    const aware = findCellOptionLines(JUPYTER_OPTION, "jupyter");
    expect(blind).toHaveLength(1);
    expect(aware).toHaveLength(0);
    expect(findCellOptionLines(JUPYTER_OPTION, "jupyter")).toHaveLength(0);
    const blindAgain = findCellOptionLines(JUPYTER_OPTION);
    expect(blindAgain).toEqual(blind);
    expect(blindAgain[0]).toBe(blind[0]);
    // and with two aware keys that agree (the same cells under two engines): equal lists, each its own elements
    const knitr = findCellOptionLines(OPTIONS_TEXT, "knitr");
    const jupyter = findCellOptionLines(OPTIONS_TEXT, "jupyter");
    expect(knitr).toEqual(jupyter);
    knitr.forEach((element, i) => expect(element).not.toBe(jupyter[i]));
  });

  it("a changed mode computes again for knitr, where the mode is read: executing finds option line 15, --no-execute none, and each comes back with its own answer", () => {
    expect(lines(findCellOptionLines(SETUP_OPTION, "knitr", "execute"))).toBe("15");
    expect(lines(findCellOptionLines(SETUP_OPTION, "knitr", "no-execute"))).toBe("");
    expect(lines(findCellOptionLines(SETUP_OPTION, "knitr", "execute"))).toBe("15");
    const executing = findCellOptionLines(SETUP_OPTION, "knitr", "execute");
    expect(findCellOptionLines(SETUP_OPTION, "knitr")[0]).toBe(executing[0]);
  });

  it("a mode no engine but knitr reads does not compute again: the same elements whatever the mode says (the scan normalises it)", () => {
    const executing = findCellOptionLines(OPTIONS_TEXT, "jupyter", "execute");
    const noExecute = findCellOptionLines(OPTIONS_TEXT, "jupyter", "no-execute");
    expect(noExecute).toHaveLength(3);
    noExecute.forEach((element, i) => expect(element).toBe(executing[i]));
  });

  it("mutating a returned array (push, pop, reverse, sort, splice, truncate) does not change the next answer", () => {
    const expected = oldFindCellOptionLines(OPTIONS_TEXT);
    const mutations: Array<(list: CellOptionLine[]) => void> = [
      (list) => void list.push(list[0]),
      (list) => void list.pop(),
      (list) => void list.reverse(),
      (list) => void list.sort((a, b) => b.line - a.line),
      (list) => void list.splice(0, 2),
      (list) => void (list.length = 0),
      (list) => void list.unshift(list[list.length - 1]),
    ];
    for (const mutate of mutations) {
      mutate(findCellOptionLines(OPTIONS_TEXT));
      const next = findCellOptionLines(OPTIONS_TEXT);
      expect(next).toEqual(expected);
      expect(next).toHaveLength(3);
    }
  });

  it("an array handed out is its own: two calls' arrays are never the same object, however many calls", () => {
    const arrays = new Set<CellOptionLine[]>();
    for (let i = 0; i < 5; i++) arrays.add(findCellOptionLines(OPTIONS_TEXT));
    expect(arrays.size).toBe(5);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE LAZINESS ROWS (Learning 920). The list is built by the first ASK for it. Every other reader of the scan (the Outline, cell background, Run Cell, the cross-reference index) never asks, and must not pay for it. What a
// row can observe is how the source is spelled, so it is read with the TypeScript compiler API (Learning 911): `cellOptionLinesOf` is called from `findCellOptionLines` and from nowhere else in the model.

const MODEL = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "core", "qmd", "model.ts"), "utf8");

/** The name of the nearest enclosing function declaration of every REFERENCE to `name` in `source` (a call, or the function handed over bare), not counting its own declaration. */
function referencersOf(source: string, name: string): string[] {
  const sf = ts.createSourceFile("model.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const referencers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node.text === name && !(ts.isFunctionDeclaration(node.parent) && node.parent.name === node)) {
      let up: ts.Node | undefined = node.parent;
      while (up !== undefined && !ts.isFunctionDeclaration(up)) up = up.parent;
      referencers.push(up !== undefined && ts.isFunctionDeclaration(up) && up.name !== undefined ? up.name.text : "<top level>");
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return referencers;
}

describe("Session 343 -- the option lines are built by the first ask, not by the scan", () => {
  it("cellOptionLinesOf is referenced from findCellOptionLines and from nowhere else in the model", () => {
    expect(referencersOf(MODEL, "cellOptionLinesOf")).toEqual(["findCellOptionLines"]);
  });

  it("the check can fail: a source in which the scan calls the per-cell reader names the scan, and a bare reference counts as one", () => {
    const head = 'function computeRegions(text: string, engine: EngineHint = undefined, mode: RenderMode = "execute"): Regions {';
    const eager = MODEL.replace(head, `${head} cellOptionLinesOf(undefined as never);`);
    expect(eager).not.toBe(MODEL);
    expect(referencersOf(eager, "cellOptionLinesOf").sort()).toEqual(["computeRegions", "findCellOptionLines"]);
    const bare = MODEL.replace(head, `${head} [].flatMap(cellOptionLinesOf);`);
    expect(referencersOf(bare, "cellOptionLinesOf").sort()).toEqual(["computeRegions", "findCellOptionLines"]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE CLOCK. `ratioOfWindows` (`test/unit/support/ratio-windows.ts`, shared with `s343-completion-context-rows.test.ts`) times, round after round, `workRepeats` repeats of the work being measured and `baselineRepeats`
// repeats of the baseline, each in its own window of `now`, and reports the median ratio of a unit of work to a unit of baseline. `now` is the clock in milliseconds: the rows run it on `performance.now()`, the helper's
// own rows below on a clock only the stand-ins advance (Learning 910).

/** The one clock criterion of the row below: the shared one, named for this row's work and baseline. */
const clockBreaks = (run: Windows, ratioLimit: number): string[] => ratioBreaks(run, ratioLimit, "three warm findCellOptionLines calls over one warm findAllCells lookup");

describe("the Session 343 clock helpers (the clock row's own clock is pinned here: Learning 910)", () => {
  it("ratioOfWindows reads each window on a clock only the stand-ins advance: the ratio is exact on any load", () => {
    let t = 1000;
    // work: 4 repeats of 5 ms each; baseline: 8 repeats of 0.25 ms each. Per unit: 5 / 0.25 = 20.
    const run = ratioOfWindows(() => void (t += 5), 4, () => void (t += 0.25), 8, 3, () => t);
    expect(run.ratio).toBe(20);
    expect(run.rounds).toBe(3);
    expect(run.smallestWindowMs).toBe(2);
  });

  it("the median round decides: one pause in the work window of one of three rounds does not move the ratio", () => {
    let t = 0;
    let call = 0;
    const paused = ratioOfWindows(
      () => {
        t += call++ === 1 ? 500 : 5; // a pause in the second round's work window
      },
      1,
      () => {
        t += 1;
      },
      1,
      3,
      () => t,
    );
    expect(paused.ratio).toBe(5);
    expect(paused.smallestWindowMs).toBe(1);
  });

  it("the median round decides on the other side too: one pause in the BASELINE window of one of three rounds (a ratio of 0.1 in that round) does not move the ratio either", () => {
    let t = 0;
    let call = 0;
    const paused = ratioOfWindows(
      () => {
        t += 5;
      },
      1,
      () => {
        t += call++ === 1 ? 50 : 1; // a pause in the second round's baseline window
      },
      1,
      3,
      () => t,
    );
    expect(paused.ratio).toBe(5);
    expect(paused.smallestWindowMs).toBe(1);
  });

  it("a clock stuck at 0 (every window reads 0) breaks the criterion, whatever the limit", () => {
    const run = ratioOfWindows(() => undefined, 3, () => undefined, 3, 3, () => 0);
    expect(run.smallestWindowMs).toBe(0);
    expect(clockBreaks(run, 100)).toHaveLength(1);
    expect(clockBreaks(run, Infinity)).toHaveLength(1);
  });

  it("a clock whose baseline window did not tick, or ran backwards, breaks the criterion", () => {
    let t = 0;
    const flat = ratioOfWindows(() => void (t += 5), 1, () => undefined, 1, 3, () => t);
    expect(flat.smallestWindowMs).toBe(0);
    expect(clockBreaks(flat, 100)).toHaveLength(1);
    let u = 100;
    const backwards = ratioOfWindows(() => void (u -= 5), 1, () => void (u += 1), 1, 3, () => u);
    expect(backwards.smallestWindowMs).toBeLessThan(0);
    expect(clockBreaks(backwards, 100)).toHaveLength(1);
  });

  it("clockBreaks refuses the parent's ratio and accepts the cure's; the limit is strict", () => {
    const window = (ratio: number): Windows => ({ ratio, smallestWindowMs: 0.01, rounds: 7 });
    expect(clockBreaks(window(3000), 100)).toHaveLength(1); // three flatMaps over one lookup, at the parent
    expect(clockBreaks(window(7), 100)).toEqual([]); // three copies, at the cure
    expect(clockBreaks(window(99.9), 100)).toEqual([]);
    expect(clockBreaks(window(100), 100)).toHaveLength(1);
    expect(clockBreaks(window(NaN), 100)).toHaveLength(1);
    expect(clockBreaks(window(Infinity), 100)).toHaveLength(1);
  });

  it("ratioOfWindows's default clock is real time: a work window that spins 4 ms over a baseline that spins 1 ms reads about 4, every window at least its spin", () => {
    const run = ratioOfWindows(spinning(4), 1, spinning(1), 1, 3);
    expect(run.smallestWindowMs).toBeGreaterThanOrEqual(1 - 0.05);
    expect(run.ratio).toBeGreaterThan(2);
    expect(run.ratio).toBeLessThan(8);
  });
});

/** A document of `cells` cells of 27 lines: a heading, prose with a reference, and a python cell of two option lines and 16 code lines (the shape of the timing probes of Session 343). */
function documentOf(cells: number): string {
  const out: string[] = ["---", "title: t", "format: html", "---", ""];
  for (let i = 0; i < cells; i++) {
    out.push(`## Section ${i}`, "", `Prose with @fig-${i} reference and more words here.`, "", "```{python}", `#| label: fig-${i}`, "#| echo: false");
    for (let j = 0; j < 16; j++) out.push(`x${j} = ${j} + ${i}`);
    out.push("```", "");
  }
  return out.join("\n");
}

const CELLS = 2000;
const RATIO_LIMIT = 100;

describe(`Session 343 -- three warm findCellOptionLines calls on a ${CELLS.toLocaleString("en-US")}-cell document cost a few lookups of the scan, not three passes over its cells`, () => {
  it(`the ratio of three calls to one findAllCells lookup is under ${RATIO_LIMIT} (the parent's is in the thousands, the cure's under 10: load 6 to 15)`, () => {
    const text = documentOf(CELLS);
    expect(findCellOptionLines(text)).toHaveLength(2 * CELLS); // the premise: 4,000 option lines, and the scan is warm after this call
    expect(findAllCells(text)).toHaveLength(CELLS);
    // one unit of work is three calls (a completion request inside a cell makes three); one unit of baseline is one lookup of the scan's cell list
    const run = ratioOfWindows(
      () => {
        findCellOptionLines(text);
        findCellOptionLines(text);
        findCellOptionLines(text);
      },
      8,
      () => void findAllCells(text),
      400,
      7,
    );
    expect(clockBreaks(run, RATIO_LIMIT), JSON.stringify(run)).toEqual([]);
  });
});
