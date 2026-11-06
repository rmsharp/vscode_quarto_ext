import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";
import { buildOutline } from "../../src/core/qmd/model";
import type { RenderMode } from "../../src/core/render-mode";
import {
  type FlatOutlineSymbol,
  WORKSPACE_SYMBOL_CACHE_MAX_CHARS,
  WORKSPACE_SYMBOL_CACHE_MAX_FILES,
  createWorkspaceSymbolCache,
  flattenOutline,
  matchesWorkspaceQuery,
} from "../../src/core/workspace-symbols";

// Session 343, part (4), SIB-03. "Go to Symbol in Workspace" (`src/providers/workspace-symbols.ts`) built the Outline of EVERY `.qmd` file of the workspace on EVERY keystroke of the query, because the query filter
// (`matchesWorkspaceQuery`) ran after it. The lead's probe sib03 (files of about 1,350 lines by the lead's count, 1,255 by the rows' own: 25 lines to a cell, 50 cells and a front matter; a fresh process, load 6 to 15): 100 files cost 234 / 197 / 209 / 190 ms for the passes of four keystrokes, 400 files 813 / 759 /
// 758 / 764 ms: a pass after the first cost what the first did. `createWorkspaceSymbolCache` (`src/core/workspace-symbols.ts`) keeps, per file (the key is the uri's string), the QUERY-INDEPENDENT result
// `flattenOutline(buildOutline(text, resolveDocumentEngine(fileName, text), mode))`, valid while the text is EQUAL (a string comparison), the render mode is equal and the file name (which decides the engine) is equal. The query
// filter and the `SymbolInformation` mapping stay per pass, in the adapter.
//
// WHAT THE ROWS COUNT. The counting rows run on a stand-in for the computation that logs its calls and returns a value made of its inputs, so that a stale answer is visible as well as a needless computation (Learning 913:
// the claim has no clock). The equality rows run on the real computation, against `oldFlat`, the pass's old spelling kept verbatim. The clock rows (the last describe) measure pass 1 and passes 2 to 4 of the SAME process, each in
// a window of a clock whose own rows are above them (Learning 910); the limit is one fifth of pass 1, where the parent's passes 2 to 4 are 0.9 to 1.1 of it (the lead's figures; a figure under 2x is noise at load 6 to 15,
// Learning 877) and the cure's are about a fiftieth. The keystroke gap does not apply: a pass is one call over a fixed list of files.
//
// THE CACHED VALUE IS FROZEN, NOT COPIED: the list and each of its symbols are `Object.freeze`d once, when they are made, and every read hands back that very list (`toBe`). A pass cannot corrupt what the next pass is
// served from: an edit throws (the modules are strict), and the types say `readonly`. A copy per pass would have cost a list the size of the outline for every file of the workspace on every keystroke.

/** The old pass, verbatim: what the adapter computed of each file on every query. */
function oldFlat(fileName: string, text: string, mode: RenderMode): FlatOutlineSymbol[] {
  return flattenOutline(buildOutline(text, resolveDocumentEngine(fileName, text), mode));
}

type Call = [fileName: string, text: string, mode: RenderMode];

/** The one symbol's name the stand-in answers for a call: made of all three inputs, so a stale answer cannot pass for the right one. */
const nameOf = (fileName: string, mode: RenderMode, text: string): string => `${fileName}|${mode}|${text.slice(0, 12)}|${text.length}`;

/** A stand-in computation: logs each call and answers one symbol made of its inputs, so a stale answer is as visible as an extra call. */
function stand() {
  const calls: Call[] = [];
  return {
    calls,
    flatSymbolsOf: (fileName: string, text: string, mode: RenderMode): FlatOutlineSymbol[] => {
      calls.push([fileName, text, mode]);
      return [{ kind: "heading", name: nameOf(fileName, mode, text), containerName: "", startLine: 0, endLine: 1, selectionLine: 0 }];
    },
  };
}

const URI = "file:///work/a.qmd";
/** The same characters in a string no other read has seen: a comparison by value, not by identity. */
const copyOf = (text: string): string => (" " + text).slice(1);

describe("Session 343 -- the symbol cache computes a file once while its text, mode and file name are what they were (counted)", () => {
  it("N reads of one uri with an EQUAL text (a new string each time), mode and file name compute ONCE and answer the same list", () => {
    const s = stand();
    const cache = createWorkspaceSymbolCache(s);
    const first = cache.read(URI, "a.qmd", "# One\n\ntext\n", "execute");
    for (let n = 0; n < 4; n++) {
      const again = cache.read(URI, "a.qmd", copyOf("# One\n\ntext\n"), "execute");
      expect(again).toBe(first); // frozen and shared, not copied
    }
    expect(s.calls).toHaveLength(1);
    expect(first.map((x) => x.name)).toEqual([nameOf("a.qmd", "execute", "# One\n\ntext\n")]);
  });

  it("a changed text recomputes: one character at the END, one at the START, a trailing newline, a CRLF for an LF, a character swapped in the middle of a long text", () => {
    const base = "# One\n\n" + "x".repeat(5000) + "\nend";
    const variants = [base + "!", "!" + base, base + "\n", base.replace("\n\n", "\r\n\r\n"), base.slice(0, 2500) + "y" + base.slice(2501)];
    for (const variant of variants) {
      expect(variant).not.toBe(base);
      const s = stand();
      const cache = createWorkspaceSymbolCache(s);
      cache.read(URI, "a.qmd", base, "execute");
      const got = cache.read(URI, "a.qmd", variant, "execute");
      expect(s.calls).toHaveLength(2);
      expect(got.map((x) => x.name)).toEqual([nameOf("a.qmd", "execute", variant)]);
      expect(cache.read(URI, "a.qmd", copyOf(variant), "execute")).toBe(got);
      expect(s.calls).toHaveLength(2);
    }
  });

  it("a changed mode recomputes, and a changed file name recomputes (the engine is decided by the name), each answering the new thing", () => {
    const s = stand();
    const cache = createWorkspaceSymbolCache(s);
    cache.read(URI, "a.qmd", "# One\n", "execute");
    expect(cache.read(URI, "a.qmd", "# One\n", "no-execute").map((x) => x.name)).toEqual([nameOf("a.qmd", "no-execute", "# One\n")]);
    expect(cache.read(URI, "a.Rmd", "# One\n", "no-execute").map((x) => x.name)).toEqual([nameOf("a.Rmd", "no-execute", "# One\n")]);
    expect(s.calls.map((c) => [c[0], c[2]])).toEqual([
      ["a.qmd", "execute"],
      ["a.qmd", "no-execute"],
      ["a.Rmd", "no-execute"],
    ]);
  });

  it("one entry per uri: A, then B, then A again computes three times (B replaced A), and the third read is B's replacement's", () => {
    const s = stand();
    const cache = createWorkspaceSymbolCache(s);
    cache.read(URI, "a.qmd", "# A\n", "execute");
    cache.read(URI, "a.qmd", "# B\n", "execute");
    expect(cache.read(URI, "a.qmd", "# A\n", "execute").map((x) => x.name)).toEqual([nameOf("a.qmd", "execute", "# A\n")]);
    expect(s.calls).toHaveLength(3);
  });

  it("the key is the uri's STRING: two uris with equal everything else are two entries, and uris that differ in case are two", () => {
    const s = stand();
    const cache = createWorkspaceSymbolCache(s);
    cache.read("file:///w/a.qmd", "a.qmd", "# One\n", "execute");
    cache.read("file:///w/b.qmd", "a.qmd", "# One\n", "execute");
    cache.read("file:///w/A.qmd", "a.qmd", "# One\n", "execute");
    expect(s.calls).toHaveLength(3);
    cache.read("file:///w/a.qmd", "a.qmd", "# One\n", "execute");
    cache.read("file:///w/b.qmd", "a.qmd", "# One\n", "execute");
    cache.read("file:///w/A.qmd", "a.qmd", "# One\n", "execute");
    expect(s.calls).toHaveLength(3);
  });

  it("the computation sees the file name, the text and the mode it was asked for, and is not asked at all on a hit (a hit resolves no engine and builds no outline)", () => {
    const s = stand();
    const cache = createWorkspaceSymbolCache(s);
    cache.read(URI, "notes.Rmd", "# One\n", "no-execute");
    cache.read(URI, "notes.Rmd", "# One\n", "no-execute");
    expect(s.calls).toEqual([["notes.Rmd", "# One\n", "no-execute"]]);
  });

  it("an empty text is a text: cached, and not confused with a miss", () => {
    const s = stand();
    const cache = createWorkspaceSymbolCache(s);
    cache.read(URI, "a.qmd", "", "execute");
    cache.read(URI, "a.qmd", "", "execute");
    expect(s.calls).toHaveLength(1);
  });

  it("a computation that throws throws through, caches nothing for that text, and leaves the cache working", () => {
    let fail = true;
    const calls: string[] = [];
    const cache = createWorkspaceSymbolCache({
      flatSymbolsOf: (_fileName, text) => {
        calls.push(text);
        if (fail && text === "boom") throw new RangeError("deep");
        return [{ kind: "heading", name: text, containerName: "", startLine: 0, endLine: 0, selectionLine: 0 }];
      },
    });
    expect(cache.read(URI, "a.qmd", "fine", "execute")).toHaveLength(1);
    expect(() => cache.read(URI, "a.qmd", "boom", "execute")).toThrow(RangeError);
    expect(() => cache.read(URI, "a.qmd", "boom", "execute")).toThrow(RangeError);
    expect(calls).toEqual(["fine", "boom", "boom"]);
    fail = false;
    expect(cache.read(URI, "a.qmd", "boom", "execute").map((x) => x.name)).toEqual(["boom"]);
    expect(cache.read(URI, "a.qmd", "boom", "execute")).toHaveLength(1);
    expect(calls).toEqual(["fine", "boom", "boom", "boom"]);
  });
});

describe("Session 343 -- the two bounds: 8,388,608 characters of text in all, and 4,096 files; least recently used out", () => {
  it("the bounds are the ones the item names", () => {
    expect([WORKSPACE_SYMBOL_CACHE_MAX_CHARS, WORKSPACE_SYMBOL_CACHE_MAX_FILES]).toEqual([8_388_608, 4_096]);
  });

  it("at the DEFAULT character bound: a text of exactly 8,388,608 characters is cached, one of 8,388,609 is not", () => {
    for (const [length, computations] of [
      [8_388_608, 1],
      [8_388_609, 2],
    ] as Array<[number, number]>) {
      const s = stand();
      const cache = createWorkspaceSymbolCache(s);
      const text = "x".repeat(length);
      cache.read(URI, "a.qmd", text, "execute");
      cache.read(URI, "a.qmd", copyOf(text), "execute");
      expect(s.calls).toHaveLength(computations);
    }
  });

  it("at the DEFAULT file bound: 4,096 files are cached, the 4,097th pushes the first out and no other", () => {
    const s = stand();
    const cache = createWorkspaceSymbolCache(s);
    for (let i = 0; i < 4096; i++) cache.read(`file:///w/f${i}.qmd`, "f.qmd", `# ${i}\n`, "execute");
    for (let i = 0; i < 4096; i++) cache.read(`file:///w/f${i}.qmd`, "f.qmd", `# ${i}\n`, "execute");
    expect(s.calls).toHaveLength(4096);
    cache.read("file:///w/f4096.qmd", "f.qmd", "# 4096\n", "execute");
    expect(s.calls).toHaveLength(4097);
    cache.read("file:///w/f1.qmd", "f.qmd", "# 1\n", "execute");
    cache.read("file:///w/f4095.qmd", "f.qmd", "# 4095\n", "execute");
    expect(s.calls).toHaveLength(4097);
    cache.read("file:///w/f0.qmd", "f.qmd", "# 0\n", "execute");
    expect(s.calls).toHaveLength(4098);
  });

  // The bound is injected as a small number so the rows can sit on either side of it.
  const at100 = () => {
    const s = stand();
    return { s, cache: createWorkspaceSymbolCache({ ...s, maxChars: 100, maxFiles: 50 }) };
  };
  const text = (length: number, mark: string): string => mark + "x".repeat(length - mark.length);

  it("a bound of 100 characters: a text of 99 and one of 100 are cached, one of 101 is not", () => {
    for (const [length, computations] of [
      [99, 1],
      [100, 1],
      [101, 2],
    ] as Array<[number, number]>) {
      const { s, cache } = at100();
      cache.read(URI, "a.qmd", text(length, "A"), "execute");
      cache.read(URI, "a.qmd", copyOf(text(length, "A")), "execute");
      expect(s.calls).toHaveLength(computations);
    }
  });

  it("the characters are counted in ALL: 60 + 40 fit, 60 + 41 push the least recently used out", () => {
    {
      const { s, cache } = at100();
      cache.read("u:a", "a.qmd", text(60, "A"), "execute");
      cache.read("u:b", "a.qmd", text(40, "B"), "execute");
      cache.read("u:a", "a.qmd", text(60, "A"), "execute");
      cache.read("u:b", "a.qmd", text(40, "B"), "execute");
      expect(s.calls).toHaveLength(2);
    }
    {
      const { s, cache } = at100();
      cache.read("u:a", "a.qmd", text(60, "A"), "execute");
      cache.read("u:b", "a.qmd", text(41, "B"), "execute"); // 101: A goes
      expect(s.calls).toHaveLength(2);
      cache.read("u:b", "a.qmd", text(41, "B"), "execute");
      expect(s.calls).toHaveLength(2);
      cache.read("u:a", "a.qmd", text(60, "A"), "execute"); // 101 again: B goes
      expect(s.calls).toHaveLength(3);
      cache.read("u:b", "a.qmd", text(41, "B"), "execute");
      expect(s.calls).toHaveLength(4);
    }
  });

  it("the least recently USED goes, not the oldest read: A read again after B is the newer, so a third file pushes B out", () => {
    const { s, cache } = at100();
    cache.read("u:a", "a.qmd", text(40, "A"), "execute");
    cache.read("u:b", "a.qmd", text(40, "B"), "execute");
    cache.read("u:a", "a.qmd", text(40, "A"), "execute"); // a hit: A is the newest
    cache.read("u:c", "a.qmd", text(40, "C"), "execute"); // 120: the least recently used, B, goes
    expect(s.calls).toHaveLength(3);
    cache.read("u:a", "a.qmd", text(40, "A"), "execute");
    expect(s.calls).toHaveLength(3); // A is still there
    cache.read("u:b", "a.qmd", text(40, "B"), "execute");
    expect(s.calls).toHaveLength(4); // B went: an equal-text file whose entry was evicted recomputes
  });

  it("a file that CHANGED gives back its old characters: B (30) kept beside A (60) when A becomes 70, and A (70) counts as just used", () => {
    const { s, cache } = at100();
    cache.read("u:a", "a.qmd", text(60, "A"), "execute");
    cache.read("u:b", "a.qmd", text(30, "B"), "execute");
    cache.read("u:a", "a.qmd", text(70, "a"), "execute"); // 70 + 30 = 100: both fit, the old 60 is not counted
    expect(s.calls).toHaveLength(3);
    cache.read("u:b", "a.qmd", text(30, "B"), "execute");
    cache.read("u:a", "a.qmd", text(70, "a"), "execute");
    expect(s.calls).toHaveLength(3);
  });

  it("a text over the bound is not kept, and it DROPS the file's older entry: B (40) then A (60), A grows to 101, then C (60) is cached beside B (the dropped A, the newer of the two, would otherwise push B out)", () => {
    const { s, cache } = at100();
    cache.read("u:b", "a.qmd", text(40, "B"), "execute");
    cache.read("u:a", "a.qmd", text(60, "A"), "execute");
    const big = cache.read("u:a", "a.qmd", text(101, "a"), "execute"); // too big: computed, not kept, and A's old 60 released
    expect(big).toHaveLength(1);
    expect(s.calls).toHaveLength(3);
    cache.read("u:c", "a.qmd", text(60, "C"), "execute"); // 40 + 60 = 100: no one is pushed out
    cache.read("u:b", "a.qmd", text(40, "B"), "execute");
    cache.read("u:c", "a.qmd", text(60, "C"), "execute");
    expect(s.calls.map((c) => c[1][0])).toEqual(["B", "A", "a", "C"]);
  });

  it("a text over the bound is computed at EVERY read, and pushes nobody out", () => {
    const { s, cache } = at100();
    cache.read("u:a", "a.qmd", text(50, "A"), "execute");
    for (let n = 0; n < 3; n++) cache.read("u:big", "a.qmd", text(500, "Z"), "execute");
    cache.read("u:a", "a.qmd", text(50, "A"), "execute");
    expect(s.calls).toHaveLength(1 + 3);
  });

  it("a bound of 3 files: the fourth pushes the least recently used out; a read refreshes; a changed file does not grow the count", () => {
    const s = stand();
    const cache = createWorkspaceSymbolCache({ ...s, maxFiles: 3 });
    const read = (name: string, body = "# x\n"): void => void cache.read("u:" + name, "a.qmd", body, "execute");
    read("a");
    read("b");
    read("c");
    read("a"); // a is the newest
    read("d"); // b goes
    expect(s.calls).toHaveLength(4);
    read("a");
    read("c");
    read("d");
    expect(s.calls).toHaveLength(4);
    read("b");
    expect(s.calls).toHaveLength(5); // b recomputes (and pushes a out: c, d, b are the newest)
    read("c", "# changed\n");
    expect(s.calls).toHaveLength(6);
    read("d");
    read("b");
    expect(s.calls).toHaveLength(6); // the changed c replaced itself and pushed nobody out
  });

  // The values a number can hold (Learning 914): the bounds are numbers an option can set.
  it.each([
    ["NaN", NaN],
    ["a negative number", -5],
    ["plus Infinity", Infinity],
    ["minus Infinity", -Infinity],
    ["not a number at all", "100" as unknown as number],
  ])("a bound given as %s is not a bound: the default stands (1,000,000 characters and 5 files are cached; 8,388,609 characters are not; the 4,097th file pushes the first out)", (_name, value) => {
    const s = stand();
    const cache = createWorkspaceSymbolCache({ ...s, maxChars: value, maxFiles: value });
    const big = "x".repeat(1_000_000);
    cache.read("u:big", "a.qmd", big, "execute");
    cache.read("u:big", "a.qmd", copyOf(big), "execute");
    for (let i = 0; i < 5; i++) cache.read("u:" + i, "a.qmd", "# " + i, "execute");
    for (let i = 0; i < 5; i++) cache.read("u:" + i, "a.qmd", "# " + i, "execute");
    expect(s.calls).toHaveLength(1 + 5);
    const huge = "y".repeat(8_388_609);
    cache.read("u:huge", "a.qmd", huge, "execute");
    cache.read("u:huge", "a.qmd", copyOf(huge), "execute");
    expect(s.calls).toHaveLength(1 + 5 + 2);
    const t = stand();
    const many = createWorkspaceSymbolCache({ ...t, maxChars: value, maxFiles: value });
    for (let i = 0; i < 4097; i++) many.read("u:" + i, "a.qmd", "#", "execute");
    many.read("u:4096", "a.qmd", "#", "execute");
    many.read("u:1", "a.qmd", "#", "execute");
    expect(t.calls).toHaveLength(4097);
    many.read("u:0", "a.qmd", "#", "execute");
    expect(t.calls).toHaveLength(4098);
  });

  it("a bound of 0 keeps nothing: every read computes", () => {
    const s = stand();
    const cache = createWorkspaceSymbolCache({ ...s, maxFiles: 0 });
    cache.read(URI, "a.qmd", "# x", "execute");
    cache.read(URI, "a.qmd", "# x", "execute");
    const t = stand();
    const none = createWorkspaceSymbolCache({ ...t, maxChars: 0 });
    none.read(URI, "a.qmd", "# x", "execute");
    none.read(URI, "a.qmd", "# x", "execute");
    expect([s.calls.length, t.calls.length]).toEqual([2, 2]);
  });

  it("a fractional bound is rounded down: 2.9 files hold two", () => {
    const s = stand();
    const cache = createWorkspaceSymbolCache({ ...s, maxFiles: 2.9 });
    for (const name of ["a", "b", "c"]) cache.read("u:" + name, "a.qmd", "# x", "execute");
    cache.read("u:c", "a.qmd", "# x", "execute");
    cache.read("u:b", "a.qmd", "# x", "execute");
    expect(s.calls).toHaveLength(3);
    cache.read("u:a", "a.qmd", "# x", "execute");
    expect(s.calls).toHaveLength(4);
  });
});

describe("Session 343 -- what a pass can do to a cached value: nothing (the list and its symbols are frozen, and every read hands back the same list)", () => {
  it("the list and each symbol are frozen, an edit throws, and the next read is unchanged and equals the uncached computation", () => {
    const text = "# One\n\n## Two\n\n```{python}\nx = 1\n```\n";
    const cache = createWorkspaceSymbolCache();
    const first = cache.read(URI, "a.qmd", text, "execute");
    const expected = oldFlat("a.qmd", text, "execute");
    expect(first.length).toBeGreaterThanOrEqual(3);
    expect(Object.isFrozen(first)).toBe(true);
    expect(first.every((symbol) => Object.isFrozen(symbol))).toBe(true);
    const mutable = first as unknown as FlatOutlineSymbol[];
    expect(() => mutable.push(mutable[0])).toThrow(TypeError);
    expect(() => mutable.reverse()).toThrow(TypeError);
    expect(() => {
      mutable.length = 0;
    }).toThrow(TypeError);
    expect(() => {
      mutable[0].name = "edited";
    }).toThrow(TypeError);
    expect(() => {
      mutable[0].startLine = 99;
    }).toThrow(TypeError);
    expect(cache.read(URI, "a.qmd", copyOf(text), "execute")).toEqual(expected);
  });

  it("the stand-in's own list is frozen too, once, so a computation that hands out a shared list cannot be edited through the cache", () => {
    const s = stand();
    const cache = createWorkspaceSymbolCache(s);
    const got = cache.read(URI, "a.qmd", "# x", "execute");
    expect(Object.isFrozen(got) && got.every((symbol) => Object.isFrozen(symbol))).toBe(true);
  });

  it("a text over the bound is frozen as well (the value does not depend on whether it was kept)", () => {
    const s = stand();
    const cache = createWorkspaceSymbolCache({ ...s, maxChars: 10 });
    const got = cache.read(URI, "a.qmd", "# a text over the bound", "execute");
    expect(Object.isFrozen(got) && got.every((symbol) => Object.isFrozen(symbol))).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE ANSWER IS THE OLD PASS' ANSWER, on enumerated and on seeded documents. `oldFlat` is the old spelling, verbatim.

/**
 * The blocks a document is made of (8, so that every document of up to four blocks is 4,681). They are chosen so that the list DEPENDS on the render mode and on the file name for some of the documents they make (222 and 87
 * of the 4,681 at the time of writing): a lone bare fence above a hidden chunk that prints pairs with the output fence the render writes (knitr only, and only when the chunk runs), a setup chunk that silences the chunks
 * below it does so only when the document executes, and an `.Rmd` is knitr by its name where a `.qmd` of `{python}` chunks is jupyter.
 */
const BLOCKS = [
  "# After",
  "## Two",
  "```",
  "```{r}\nknitr::opts_chunk$set(echo = FALSE)\n```",
  "```{r}\nprint(1)\n```",
  "```{r}\n#| echo: false\nprint(1)\n```",
  "```{python}\n#| echo: false\n1\n```",
  "---\nengine: knitr\n---",
];

/** Every sequence of 0 to `maxLength` members of `alphabet`. */
function sequences(alphabet: readonly string[], maxLength: number): string[][] {
  const all: string[][] = [[]];
  let layer: string[][] = [[]];
  for (let length = 1; length <= maxLength; length++) {
    const next: string[][] = [];
    for (const prefix of layer) for (const member of alphabet) next.push([...prefix, member]);
    all.push(...next);
    layer = next;
  }
  return all;
}

const NAMES = ["a.qmd", "a.Rmd"];
const MODES: RenderMode[] = ["execute", "no-execute"];
const QUERIES = ["", "a", "after", "TWO", "{r", "{python", "no-such-name"];

describe("Session 343 -- the cache answers what the old pass computed, for every document of up to four blocks, under both file names and both modes, at the first read and the next", () => {
  const docs = sequences(BLOCKS, 4).map((blocks) => blocks.join("\n\n") + "\n");

  it("is 4,681 documents", () => {
    expect(docs).toHaveLength(4681);
  });

  it("the flat symbols equal the old spelling's for every (document, name, mode), the first read (a miss) and the second (a hit), through ONE cache shared by all of them", () => {
    const cache = createWorkspaceSymbolCache();
    const disagreements: string[] = [];
    let differByName = 0;
    let differByMode = 0;
    docs.forEach((text, i) => {
      for (const name of NAMES) {
        for (const mode of MODES) {
          const expected = oldFlat(name, text, mode);
          const uri = `file:///w/d${i % 7}.qmd`; // seven uris in rotation: entries are hit, replaced and stale
          for (const label of ["miss", "hit"]) {
            const got = cache.read(uri, name, copyOf(text), mode);
            if (JSON.stringify(got) !== JSON.stringify(expected)) disagreements.push(`doc ${i} ${name} ${mode} (${label})`);
          }
        }
        if (JSON.stringify(oldFlat(name, text, "execute")) !== JSON.stringify(oldFlat(name, text, "no-execute"))) differByMode++;
      }
      if (JSON.stringify(oldFlat("a.qmd", text, "execute")) !== JSON.stringify(oldFlat("a.Rmd", text, "execute"))) differByName++;
    });
    expect(disagreements).toEqual([]);
    // the sample is not vacuous: documents exist whose list depends on the mode and on the file name, so the key rows have something to tell apart
    expect(differByMode).toBeGreaterThan(50);
    expect(differByName).toBeGreaterThan(50);
  }, 60_000);

  it("a document whose list depends on the file name, and one that depends on the mode, are answered per key through one uri", () => {
    const byName = docs.find((text) => JSON.stringify(oldFlat("a.qmd", text, "execute")) !== JSON.stringify(oldFlat("a.Rmd", text, "execute")));
    const byMode = docs.find((text) => JSON.stringify(oldFlat("a.Rmd", text, "execute")) !== JSON.stringify(oldFlat("a.Rmd", text, "no-execute")));
    expect(byName).toBeDefined();
    expect(byMode).toBeDefined();
    const cache = createWorkspaceSymbolCache();
    for (const [text, a, b] of [
      [byName!, ["a.qmd", "execute"], ["a.Rmd", "execute"]],
      [byMode!, ["a.Rmd", "execute"], ["a.Rmd", "no-execute"]],
    ] as Array<[string, [string, RenderMode], [string, RenderMode]]>) {
      for (let round = 0; round < 3; round++) {
        expect(cache.read(URI, a[0], text, a[1])).toEqual(oldFlat(a[0], text, a[1]));
        expect(cache.read(URI, b[0], text, b[1])).toEqual(oldFlat(b[0], text, b[1]));
      }
    }
  });

  it("the query filter over the cached list picks what it picked over the old list, for every query, in the same order", () => {
    const cache = createWorkspaceSymbolCache();
    const disagreements: string[] = [];
    docs.forEach((text, i) => {
      if (i % 9 !== 0) return;
      const old = oldFlat("a.qmd", text, "execute");
      for (const query of QUERIES) {
        const expected = old.filter((symbol) => matchesWorkspaceQuery(symbol.name, query));
        const got = cache.read(`file:///w/q${i % 5}.qmd`, "a.qmd", text, "execute").filter((symbol) => matchesWorkspaceQuery(symbol.name, query));
        if (JSON.stringify(got) !== JSON.stringify(expected)) disagreements.push(`doc ${i} query ${JSON.stringify(query)}`);
      }
    });
    expect(disagreements).toEqual([]);
  }, 60_000);

  /** A small seeded generator (mulberry32). */
  function seeded(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it("2,000 seeded reads over 30 uris whose documents change, whose names and modes change, and that are read again: every answer equals the old pass' and a good share are hits", () => {
    const next = seeded(343);
    const pickOf = <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)];
    const pool = [...BLOCKS, "Text with a [link](u) and `code`.", "### Three {#sec-three}", "Setext\n======", "<div>\n\n# In a div\n\n</div>", "```{r}\nx <- 1\n```", "```{python}\n1\n```", "::: {.callout-note}\nnote\n:::"];
    const documentOf = (): string => Array.from({ length: Math.floor(next() * 9) }, () => pickOf(pool)).join("\n\n") + "\n";
    const state = new Map<string, { text: string; name: string; mode: RenderMode }>();
    const cache = createWorkspaceSymbolCache();
    let hits = 0;
    let changes = 0;
    const disagreements: string[] = [];
    let computations = 0;
    const counted = createWorkspaceSymbolCache({
      flatSymbolsOf: (fileName, text, mode) => {
        computations++;
        return oldFlat(fileName, text, mode);
      },
    });
    for (let step = 0; step < 2000; step++) {
      const uri = `file:///w/s${Math.floor(next() * 30)}.qmd`;
      let current = state.get(uri);
      if (current === undefined || next() < 0.3) {
        current = { text: documentOf(), name: pickOf(NAMES), mode: pickOf(MODES) };
        if (state.has(uri)) changes++;
        state.set(uri, current);
      }
      const before = computations;
      const counts = counted.read(uri, current.name, copyOf(current.text), current.mode);
      if (computations === before) hits++;
      const got = cache.read(uri, current.name, copyOf(current.text), current.mode);
      const expected = oldFlat(current.name, current.text, current.mode);
      if (JSON.stringify(got) !== JSON.stringify(expected) || JSON.stringify(counts) !== JSON.stringify(expected)) disagreements.push(`step ${step} ${uri}`);
    }
    expect(disagreements).toEqual([]);
    expect(changes).toBeGreaterThan(300);
    expect(hits).toBeGreaterThan(900);
  }, 60_000);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE CLOCK'S OWN CLOCK (Learning 910), then the clock rows.

/** The milliseconds each of `passes` passes took, each in a window of `now`. */
function timePasses(passes: number, pass: (index: number) => unknown, now: () => number = () => performance.now()): number[] {
  const windows: number[] = [];
  for (let i = 0; i < passes; i++) {
    const t0 = now();
    pass(i);
    windows.push(now() - t0);
  }
  return windows;
}

/**
 * The one clock criterion, named with its numbers: every pass after the first took under `fraction` of the first. `[]` keeps it. A window that did not tick (0, negative or NaN) keeps nothing, and neither does a
 * run of fewer than two passes: a clock stuck at 0 makes every ratio true.
 */
function clockBreaks(windows: readonly number[], fraction: number): string[] {
  if (windows.length < 2 || !windows.every((w) => w > 0)) return [`a window of the clock did not tick, or there is no second pass: ${windows.join(" / ")} ms`];
  const first = windows[0];
  const slow = windows.slice(1).map((w, i): [number, number] => [i + 2, w]).filter(([, w]) => !(w < first * fraction));
  return slow.length === 0 ? [] : [`pass ${slow.map(([n, w]) => `${n} took ${w.toFixed(1)} ms`).join(", ")}, not under ${fraction} of pass 1's ${first.toFixed(1)} ms`];
}

describe("the Session 343 clock helpers of the symbol-cache rows (the clock rows' own clock is pinned here: Learning 910)", () => {
  it("timePasses reads each pass in its own window of a clock only the stand-ins advance: the numbers are exact on any load, in the order of the passes, each pass run once with its index", () => {
    let t = 700;
    const seen: number[] = [];
    const windows = timePasses(
      4,
      (index) => {
        seen.push(index);
        t += [200, 12, 8, 5][index];
      },
      () => t,
    );
    expect(windows).toEqual([200, 12, 8, 5]);
    expect(seen).toEqual([0, 1, 2, 3]);
  });

  it("timePasses' default clock is real time: passes that spin 12, 6 and 3 ms are read as at least that, each in its own window", () => {
    const spin = (ms: number): void => {
      const started = performance.now();
      while (performance.now() - started < ms) {
        /* spin */
      }
    };
    const windows = timePasses(3, (i) => spin([12, 6, 3][i]));
    expect(windows[0]).toBeGreaterThanOrEqual(12 - 1);
    expect(windows[1]).toBeGreaterThanOrEqual(6 - 1);
    expect(windows[2]).toBeGreaterThanOrEqual(3 - 1);
    expect(windows[0] + windows[1] + windows[2]).toBeGreaterThanOrEqual(21 - 2);
  });

  it("clockBreaks refuses the parent's passes (234 / 197 / 209 / 190) and accepts the cure's, the limit is strict, and a window read as 0, NaN or negative, or a single pass, keeps nothing", () => {
    expect(clockBreaks([234, 197, 209, 190], 0.2)).toHaveLength(1); // 100 files at the parent
    expect(clockBreaks([813, 759, 758, 764], 0.2)).toHaveLength(1); // 400 files at the parent
    expect(clockBreaks([210, 4.2, 3.9, 3.8], 0.2)).toEqual([]); // the cure
    expect(clockBreaks([100, 19.9, 10, 10], 0.2)).toEqual([]);
    expect(clockBreaks([100, 20, 10, 10], 0.2)).toHaveLength(1); // exactly the limit
    expect(clockBreaks([100, 10, 10, 20], 0.2)).toHaveLength(1); // the LAST pass counts too
    expect(clockBreaks([100, 10, 30, 10], 0.2)).toHaveLength(1); // so does a middle one
    expect(clockBreaks([100, 0, 10, 10], 0.2)).toHaveLength(1); // a pass read as 0 is not a fast pass
    expect(clockBreaks([100, NaN, 10, 10], 0.2)).toHaveLength(1);
    expect(clockBreaks([100, -3, 10, 10], 0.2)).toHaveLength(1);
    expect(clockBreaks([0, 0, 0, 0], 0.2)).toHaveLength(1);
    expect(clockBreaks([NaN, 1, 1, 1], 0.2)).toHaveLength(1);
    expect(clockBreaks([100], 0.2)).toHaveLength(1);
    expect(clockBreaks([], 0.2)).toHaveLength(1);
  });
});

/** A document of `cells` cells of 25 lines: a heading, prose with a reference, a python cell with two option lines and 16 code lines; `salt` makes the text its own. About 330 characters a cell. */
function cellsDoc(cells: number, salt: number): string {
  const out: string[] = ["---", "title: t", "format: html", "---", ""];
  for (let i = 0; i < cells; i++) {
    out.push(`## Section ${i}`, "", `Prose with @fig-${i} reference and more words here ${salt}.`, "", "```{python}", `#| label: fig-${i}`, "#| echo: false");
    for (let j = 0; j < 16; j++) out.push(`x${j} = ${j} + ${i}`);
    out.push("```", "");
  }
  return out.join("\n");
}

const FILES = 100;
const CELLS = 50;
const FRACTION = 0.2;
const KEYSTROKES = ["sec", "secti", "section 1", "section 12"];

describe("Session 343 -- passes 2 to 4 of Go to Symbol in Workspace over 100 files of 1,255 lines take under a fifth of pass 1 (the BACKLOG item \"What Session 342's review round found beside the typing-path cures\", part 4, SIB-03)", () => {
  /** One pass as the adapter makes it, minus `vscode`: for each file, the cache's symbols, filtered by the query. The texts are made BEFORE the window opens, a new string for every pass, as `getText()` makes one. */
  function runPasses() {
    const cache = createWorkspaceSymbolCache();
    const texts = KEYSTROKES.map(() => Array.from({ length: FILES }, (_, i) => cellsDoc(CELLS, i)));
    const hits: number[] = [];
    const windows = timePasses(KEYSTROKES.length, (pass) => {
      let found = 0;
      for (let i = 0; i < FILES; i++) {
        for (const symbol of cache.read(`file:///w/f${i}.qmd`, `f${i}.qmd`, texts[pass][i], "execute")) {
          if (matchesWorkspaceQuery(symbol.name, KEYSTROKES[pass])) found++;
        }
      }
      hits.push(found);
    });
    return { windows, hits };
  }

  it("100 files of 1,255 lines (25 lines to a cell, 50 cells): the four keystrokes find what the old pass finds, and passes 2 to 4 each take under one fifth of pass 1", () => {
    const { windows, hits } = runPasses();
    // the answers first (outside the clock): the old pass on the same files and queries
    const expected = KEYSTROKES.map((query) => {
      let found = 0;
      for (let i = 0; i < FILES; i++) for (const symbol of oldFlat(`f${i}.qmd`, cellsDoc(CELLS, i), "execute")) if (matchesWorkspaceQuery(symbol.name, query)) found++;
      return found;
    });
    expect(hits).toEqual(expected);
    expect(hits).toEqual([5000, 5000, 1100, 100]); // 50 headings a file for "sec" and "secti", Section 1 and Section 10 to 19 for "section 1", Section 12 for "section 12"
    expect(windows.every((w) => w > 0)).toBe(true);
    expect(clockBreaks(windows, FRACTION).join("; ")).toBe("");
  }, 120_000);

  // The rows above fix the sizes and the limit: 10 files, or a fraction of 1, would pass the parent too. Every size is a named constant, read here, so a changed one fails this row.
  it("keeps the sizes and the limit the clock row is built on", () => {
    expect([FILES, CELLS, FRACTION, KEYSTROKES.length]).toEqual([100, 50, 0.2, 4]);
    expect(cellsDoc(CELLS, 0).split("\n")).toHaveLength(5 + CELLS * 25);
    expect(cellsDoc(CELLS, 0).length).toBeGreaterThan(14_000);
    expect(cellsDoc(CELLS, 0).length * FILES).toBeLessThan(8_388_608); // the whole set fits the cache's bound
    expect(cellsDoc(2, 7).split("\n").slice(5, 12)).toEqual(["## Section 0", "", "Prose with @fig-0 reference and more words here 7.", "", "```{python}", "#| label: fig-0", "#| echo: false"]);
  });
});
