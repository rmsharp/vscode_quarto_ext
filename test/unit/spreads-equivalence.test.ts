import { describe, expect, it } from "vitest";
import { appendCitations, type Citation } from "../../src/core/citations";
import type { OutlineSymbol } from "../../src/core/qmd/model";
import { appendFlatOutline, type FlatOutlineSymbol, flattenOutline } from "../../src/core/workspace-symbols";
import { seededRandom } from "./support/regex-equivalence";

// Session 338, part E of the BACKLOG item "Eleven more places that throw RangeError on a long line or a long list": the two array SPREADS, kept here as the oracle of their cures (Learning 738). There is no regular
// expression in this part, so the oracle is the OLD STATEMENT, copied from the base commit `fe6aaec`:
//
//   - `oldFlattenOutline`: `flattenOutline` of `src/core/workspace-symbols.ts`, whose recursion handed each child list to `result.push(...)`;
//   - `oldAppend`: line 107 of `src/providers/citation.ts`, `all.push(...parseCitations(content))`, as a function of the list it spread.
//
// A call with a spread argument puts one stack slot per element on the call stack, so both throw `RangeError: Maximum call stack size exceeded` from about 110,000 elements (110,360 for the flattening and 110,428 for the
// bare citation spread, fresh processes, Node 22.23.3). Each is compared with its cure over (1) a reading BY DEFINITION that uses no spread and no recursion, (2) every input of a small family, (3) every UTF-16 code unit as
// a name (flattening only: a list of citations has no token to sweep), (4) seeded random inputs, and (5) the sizes around and past the first throw, where the old statement either gives the cure's answer or throws a RangeError
// (and nothing else): that disjunction is what keeps the test true on a machine whose stack is larger.
//
// PINNED COUNTS are recounted by `tools/spreads-count/count_spreads.py`, which enumerates the same families from their definitions and shares no code with this file.

/** The count each exhaustive family must hold: printed by `python3 -I tools/spreads-count/count_spreads.py`. */
const PINNED = {
  forests: 2056,
  kinded: 431_059,
  compared: 862_118,
  nodes: 3_371_466,
  roots: 1_029_142,
  strings: 121,
  pairs: 14_641,
  aliased: 121,
  pairElements: 103_092,
};
const MAX_NODES = 8;
const ALPHABET = ["a", "b", "c"];
const MAX_LEN = 4;
/** Past the first throw measured in fresh processes (110,360 and 110,428): 130,000, the size the item names. */
const LONG = 130_000;
/** The first throw of each old statement, measured on the base in fresh processes: the flattening's spread (last OK 110,359) and the bare citation spread (last OK 110,427). The guard rows at the end read the sizes of this file against them. */
const FIRST_THROW = { flatten: 110_360, citations: 110_428 };
/** The two children of the "sum" row and the three roots of the "below" row; the guard rows keep each one on its side of the first throw. */
const EACH_OF_TWO = 70_000;
const EACH_OF_THREE = 60_000;
const FILE_A = 60_000;
const FILE_B = 70_000;
/** 3 s for the cure alone on a list of 130,000: the cure flattens 135,000 children in 14.1 ms and appends 135,000 citations in 1.4 ms (a scratch probe, fresh process), and a list copied for every element took 12,271 ms at that size. */
const LIMIT_MS = 3000;

// ── The OLD statements, verbatim ────────────────────────────────────────────────────────────────────────

function oldFlattenOutline(symbols: OutlineSymbol[], containerName = ""): FlatOutlineSymbol[] {
  const result: FlatOutlineSymbol[] = [];
  for (const symbol of symbols) {
    result.push({
      kind: symbol.kind,
      name: symbol.name,
      containerName,
      startLine: symbol.startLine,
      endLine: symbol.endLine,
      selectionLine: symbol.selectionLine,
    });
    result.push(...oldFlattenOutline(symbol.children, symbol.name));
  }
  return result;
}

function oldAppend(target: Citation[], more: Citation[]): void {
  target.push(...more);
}

// ── Readings by definition ──────────────────────────────────────────────────────────────────────────────

/** The depth-first list of a forest read with an explicit stack: no recursion and no spread. A symbol's container is its parent's name, and a root's is the container handed in. */
function flattenByDefinition(roots: OutlineSymbol[], containerName: string): FlatOutlineSymbol[] {
  const out: FlatOutlineSymbol[] = [];
  const pending: Array<[OutlineSymbol, string]> = [];
  for (let i = roots.length - 1; i >= 0; i--) pending.push([roots[i], containerName]);
  while (pending.length > 0) {
    const [symbol, container] = pending.pop() as [OutlineSymbol, string];
    out.push({ kind: symbol.kind, name: symbol.name, containerName: container, startLine: symbol.startLine, endLine: symbol.endLine, selectionLine: symbol.selectionLine });
    for (let i = symbol.children.length - 1; i >= 0; i--) pending.push([symbol.children[i], symbol.name]);
  }
  return out;
}

const FIELDS: Array<keyof FlatOutlineSymbol> = ["kind", "name", "containerName", "startLine", "endLine", "selectionLine"];

/** The two flat lists are the same: the same length, and each symbol with exactly the six fields and the same values. */
function sameFlat(a: FlatOutlineSymbol[], b: FlatOutlineSymbol[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Object.keys(a[i]).length !== FIELDS.length || Object.keys(b[i]).length !== FIELDS.length) return false;
    for (const field of FIELDS) {
      if (a[i][field] !== b[i][field]) return false;
    }
  }
  return true;
}

/** The three readings of one forest and one container name agree: the old statement, the definition, the cure, and the cure's seam appending after a prefix. Returns a description of the first disagreement, or null. */
function disagreement(roots: OutlineSymbol[], container: string | undefined): string | null {
  const explicit = container ?? "";
  const expected = flattenByDefinition(roots, explicit);
  const old = container === undefined ? oldFlattenOutline(roots) : oldFlattenOutline(roots, container);
  if (!sameFlat(old, expected)) return `old vs definition on ${JSON.stringify(roots)}`;
  const cure = container === undefined ? flattenOutline(roots) : flattenOutline(roots, container);
  if (!sameFlat(cure, expected)) return `cure vs definition on ${JSON.stringify(roots)}`;
  const prefix: FlatOutlineSymbol[] = [{ kind: "cell", name: "prefix", containerName: "p", startLine: -1, endLine: -2, selectionLine: -3 }];
  const out = prefix.slice();
  const returned = appendFlatOutline(out, roots, explicit);
  if (returned !== undefined) return `the seam returned ${String(returned)}`;
  if (out.length !== expected.length + 1 || out[0] !== prefix[0] || !sameFlat(out.slice(1), expected)) return `seam vs definition on ${JSON.stringify(roots)}`;
  return null;
}

const symbol = (kind: "heading" | "cell", name: string, index: number, children: OutlineSymbol[] = []): OutlineSymbol => ({
  kind,
  name,
  startLine: 10 * index + 1,
  endLine: 10 * index + 2,
  selectionLine: 10 * index + 3,
  children,
});

// ── (2) every forest of 0 to 8 nodes, each node a heading or a cell ────────────────────────────────────

/** Every depth sequence of length n: the first is 0 and each later one is between 0 and the one before plus one (the forests of n nodes, in preorder). */
function* depthSequences(n: number): Generator<number[]> {
  if (n === 0) {
    yield [];
    return;
  }
  const prefix = [0];
  function* extend(): Generator<number[]> {
    if (prefix.length === n) {
      yield prefix;
      return;
    }
    for (let depth = 0; depth <= prefix[prefix.length - 1] + 1; depth++) {
      prefix.push(depth);
      yield* extend();
      prefix.pop();
    }
  }
  yield* extend();
}

/** The forest of a depth sequence and a kind mask (bit i set: node i is a cell); node i is named `n<i>` and has the lines 10i+1, 10i+2 and 10i+3, so no two fields of a forest can swap unseen. */
function forestOf(depths: number[], mask: number): OutlineSymbol[] {
  const roots: OutlineSymbol[] = [];
  const open: OutlineSymbol[] = [];
  depths.forEach((depth, i) => {
    const node = symbol(((mask >> i) & 1) === 1 ? "cell" : "heading", `n${i}`, i);
    (depth === 0 ? roots : open[depth - 1].children).push(node);
    open.length = depth;
    open.push(node);
  });
  return roots;
}

describe("Session 338 -- flattenOutline: the cure keeps the answer of the spread over every forest of up to 8 nodes, each a heading or a cell", () => {
  it("the old statement, the definition, the cure and its seam agree on every (forest, kinds), with the default container and with an explicit one", () => {
    let forests = 0;
    let kinded = 0;
    let compared = 0;
    let nodes = 0;
    let roots = 0;
    const bad: string[] = [];
    for (let n = 0; n <= MAX_NODES; n++) {
      for (const depths of depthSequences(n)) {
        forests++;
        for (let mask = 0; mask < 1 << n; mask++) {
          kinded++;
          nodes += n;
          roots += depths.filter((d) => d === 0).length;
          const forest = forestOf(depths, mask);
          for (const container of [undefined, "ROOT"]) {
            compared++;
            const found = disagreement(forest, container);
            if (found !== null && bad.length < 5) bad.push(found);
          }
        }
      }
    }
    expect(bad).toEqual([]);
    expect({ forests, kinded, compared, nodes, roots }).toEqual({ forests: PINNED.forests, kinded: PINNED.kinded, compared: PINNED.compared, nodes: PINNED.nodes, roots: PINNED.roots });
  }, 60_000);
});

// ── (3) every UTF-16 code unit as a name, and as the container handed in ─────────────────────────────────

describe("Session 338 -- flattenOutline: a symbol's name and the container name pass through unchanged, whatever the code unit", () => {
  it("every one of the 65,536 code units, as a root's name (so as its child's container) and as the container handed in", () => {
    const bad: string[] = [];
    let compared = 0;
    for (let unit = 0; unit < 0x10000; unit++) {
      const ch = String.fromCharCode(unit);
      const forest = [symbol("heading", ch, 0, [symbol("cell", "c", 1)]), symbol("cell", ch, 2)];
      for (const container of [undefined, ch]) {
        compared++;
        const found = disagreement(forest, container);
        if (found !== null && bad.length < 5) bad.push(`U+${unit.toString(16)}: ${found}`);
      }
    }
    expect(bad).toEqual([]);
    expect(compared).toBe(2 * 0x10000);
  });
});

// ── (4) seeded random forests ──────────────────────────────────────────────────────────────────────────

describe("Session 338 -- flattenOutline: seeded random forests (up to 60 nodes, depth up to 7, names of random code units)", () => {
  it("5,000 forests: the old statement, the definition, the cure and its seam agree", () => {
    const random = seededRandom(338_007);
    const below = (limit: number): number => Math.floor(random() * limit);
    const bad: string[] = [];
    const FORESTS = 5000;
    for (let f = 0; f < FORESTS; f++) {
      const count = below(61);
      const depths: number[] = [];
      for (let i = 0; i < count; i++) depths.push(i === 0 ? 0 : Math.min(below(depths[i - 1] + 2), 6));
      const roots: OutlineSymbol[] = [];
      const open: OutlineSymbol[] = [];
      depths.forEach((depth) => {
        let name = "";
        for (let k = below(4); k > 0; k--) name += String.fromCharCode(below(0x10000));
        const node: OutlineSymbol = {
          kind: below(2) === 0 ? "heading" : "cell",
          name,
          startLine: below(1000),
          endLine: below(1000),
          selectionLine: below(1000),
          children: [],
        };
        (depth === 0 ? roots : open[depth - 1].children).push(node);
        open.length = depth;
        open.push(node);
      });
      const found = disagreement(roots, below(3) === 0 ? undefined : String.fromCharCode(below(0x10000)));
      if (found !== null && bad.length < 5) bad.push(found);
    }
    expect(bad).toEqual([]);
  }, 60_000);
});

// ── (5) near misses, and the sizes around and past the first throw ───────────────────────────────────────

/** A root heading `Top` with `count` children (alternating headings and cells). */
const fan = (count: number, base = 0): OutlineSymbol => {
  const children: OutlineSymbol[] = new Array(count);
  for (let i = 0; i < count; i++) children[i] = symbol(i % 2 === 0 ? "heading" : "cell", `c${base + i}`, base + i + 1);
  return symbol("heading", "Top", base, children);
};

/** The old statement's answer, or "RangeError" when it throws one; any other error is a failure of the test. */
function oldAnswer(run: () => FlatOutlineSymbol[]): FlatOutlineSymbol[] | "RangeError" {
  try {
    return run();
  } catch (error) {
    if (error instanceof RangeError) return "RangeError";
    throw error;
  }
}

describe("Session 338 -- flattenOutline: the sizes around the first throw", () => {
  it.each([0, 1, 2, 3, 10, 1000])("a root with %i children: the old statement, the definition and the cure agree", (count) => {
    expect(disagreement([fan(count)], undefined)).toBeNull();
  });

  it("a root with 130,000 children: the cure gives the definition's answer, and the old statement gives it too or throws a RangeError", () => {
    const forest = [fan(LONG)];
    const expected = flattenByDefinition(forest, "");
    const started = Date.now();
    const cure = flattenOutline(forest);
    expect(Date.now() - started).toBeLessThan(LIMIT_MS);
    expect(sameFlat(cure, expected)).toBe(true);
    expect(cure.length).toBe(LONG + 1);
    const old = oldAnswer(() => oldFlattenOutline(forest));
    expect(old === "RangeError" || sameFlat(old, expected)).toBe(true);
  }, 40_000);

  it("a root of two children that each hold 70,000: each spread alone is below the first throw and the root's holds 140,002, and the cure keeps the order", () => {
    const forest = [symbol("heading", "Top", 0, [fan(EACH_OF_TWO, 1), fan(EACH_OF_TWO, EACH_OF_TWO + 1)])];
    const expected = flattenByDefinition(forest, "");
    const cure = flattenOutline(forest);
    expect(sameFlat(cure, expected)).toBe(true);
    expect(cure.length).toBe(1 + 2 + EACH_OF_TWO * 2);
    const old = oldAnswer(() => oldFlattenOutline(forest));
    expect(old === "RangeError" || sameFlat(old, expected)).toBe(true);
  }, 40_000);

  it("three roots that each hold 60,000 (each list is below the first throw): the old statement reads them, and the cure gives the same list", () => {
    const forest = [fan(EACH_OF_THREE, 0), fan(EACH_OF_THREE, EACH_OF_THREE + 1), fan(EACH_OF_THREE, 2 * EACH_OF_THREE + 2)];
    const expected = flattenByDefinition(forest, "");
    const old = oldFlattenOutline(forest);
    expect(sameFlat(old, expected)).toBe(true);
    expect(sameFlat(flattenOutline(forest), old)).toBe(true);
  }, 40_000);

  it("a chain 1,000 deep (a heading holding a heading holding ...): the same list, each symbol's container its parent", () => {
    let node = symbol("cell", "leaf", 1000);
    for (let depth = 999; depth >= 0; depth--) node = symbol("heading", `h${depth}`, depth, [node]);
    expect(disagreement([node], undefined)).toBeNull();
  });
});

// ═══ appendCitations ═══════════════════════════════════════════════════════════════════════════════════

/** A list of citations, one per character of `text`, each its own object (so identity tells an element from a copy of it). */
const listOf = (text: string): Citation[] => Array.from(text, (key) => ({ key }));

const sameList = (a: Citation[], b: Citation[]): boolean => a.length === b.length && a.every((c, i) => c === b[i]);

/** The old statement, the definition (`concat`), and the cure agree on (`targetText`, `moreText`), and neither list handed in other than the target is changed. Returns a description of the first disagreement, or null. */
function appendDisagreement(target: Citation[], more: Citation[]): string | null {
  const targetOld = target.slice();
  const targetNew = target.slice();
  const moreBefore = more.slice();
  const expected = target.concat(more);
  oldAppend(targetOld, more);
  if (!sameList(targetOld, expected)) return "old vs definition";
  const returned = appendCitations(targetNew, more);
  if (returned !== undefined) return `the cure returned ${String(returned)}`;
  if (!sameList(targetNew, expected)) return "cure vs definition";
  if (!sameList(more, moreBefore)) return "the list appended was changed";
  return null;
}

/** Every string of 0 to `MAX_LEN` characters over `ALPHABET`, shortest first. */
function* strings(): Generator<string> {
  yield "";
  for (let length = 1; length <= MAX_LEN; length++) {
    const digits = new Array<number>(length).fill(0);
    for (;;) {
      yield digits.map((d) => ALPHABET[d]).join("");
      let place = length - 1;
      while (place >= 0 && digits[place] === ALPHABET.length - 1) digits[place--] = 0;
      if (place < 0) break;
      digits[place]++;
    }
  }
}

describe("Session 338 -- appendCitations: the cure keeps the answer of all.push(...more) over every pair of short lists", () => {
  it("every (target, more) of 0 to 4 citations over three keys: the same list, the same elements in the same order, `more` untouched", () => {
    const all = [...strings()];
    let pairs = 0;
    let elements = 0;
    const bad: string[] = [];
    for (const t of all) {
      for (const m of all) {
        pairs++;
        elements += t.length + m.length;
        const found = appendDisagreement(listOf(t), listOf(m));
        if (found !== null && bad.length < 5) bad.push(`${JSON.stringify(t)} + ${JSON.stringify(m)}: ${found}`);
      }
    }
    expect(bad).toEqual([]);
    expect({ strings: all.length, pairs, elements }).toEqual({ strings: PINNED.strings, pairs: PINNED.pairs, elements: PINNED.pairElements });
  });

  it("the list appended to itself (the call appendCitations(x, x)): it doubles, as the spread did, and does not loop on the list it grows", () => {
    let aliased = 0;
    const bad: string[] = [];
    for (const text of strings()) {
      aliased++;
      const x = listOf(text);
      const snapshot = x.slice();
      const expected = snapshot.concat(snapshot);
      const old = x.slice();
      oldAppend(old, old);
      const cure = x.slice();
      appendCitations(cure, cure);
      if (!sameList(old, expected) || !sameList(cure, expected)) bad.push(JSON.stringify(text));
    }
    expect(bad).toEqual([]);
    expect(aliased).toBe(PINNED.aliased);
  });
});

describe("Session 338 -- appendCitations: seeded random lists", () => {
  it("5,000 pairs of lists of 0 to 50 citations drawn from 40 shared objects (so the same citation can be in both lists, and twice in one)", () => {
    const random = seededRandom(338_008);
    const below = (limit: number): number => Math.floor(random() * limit);
    const pool: Citation[] = Array.from({ length: 40 }, (_, i) => ({ key: `k${i}`, title: `T${i}` }));
    const draw = (): Citation[] => Array.from({ length: below(51) }, () => pool[below(pool.length)]);
    const bad: string[] = [];
    for (let i = 0; i < 5000; i++) {
      const found = appendDisagreement(draw(), draw());
      if (found !== null && bad.length < 5) bad.push(found);
    }
    expect(bad).toEqual([]);
  });
});

describe("Session 338 -- appendCitations: the sizes around the first throw", () => {
  it.each([0, 1, 2, 3, 10, 1000])("%i citations appended to a target of 3: the old statement, the definition and the cure agree", (count) => {
    expect(appendDisagreement(listOf("abc"), listOf("x".repeat(count)))).toBeNull();
  });

  it("130,000 citations appended to an empty target: the cure gives the definition's answer, and the old statement gives it too or throws a RangeError", () => {
    const more = listOf("y".repeat(LONG));
    const expected = more.slice();
    const started = Date.now();
    const target: Citation[] = [];
    appendCitations(target, more);
    expect(Date.now() - started).toBeLessThan(LIMIT_MS);
    expect(sameList(target, expected)).toBe(true);
    const old: Citation[] = [];
    let threw = false;
    try {
      oldAppend(old, more);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      threw = true;
    }
    expect(threw || sameList(old, expected)).toBe(true);
  });

  it("the adapter's loop over three files of 60,000, 0 and 70,000 (each below the first throw): the old statement reads them, and the cure gives the same list", () => {
    const files = [listOf("p".repeat(FILE_A)), [], listOf("q".repeat(FILE_B))];
    const old: Citation[] = [];
    const cure: Citation[] = [];
    for (const file of files) {
      oldAppend(old, file);
      appendCitations(cure, file);
    }
    expect(old.length).toBe(FILE_A + FILE_B);
    expect(sameList(cure, old)).toBe(true);
    expect(sameList(cure, files[0].concat(files[1], files[2]))).toBe(true);
  });

  it("130,000 citations appended to a target that already holds 130,000: 260,000 in all, the target's first", () => {
    const first = listOf("p".repeat(LONG));
    const second = listOf("q".repeat(LONG));
    const target = first.slice();
    appendCitations(target, second);
    expect(target.length).toBe(2 * LONG);
    expect(sameList(target, first.concat(second))).toBe(true);
  });
});

// ── The sizes of this file, read against the first throws ────────────────────────────────────────────────

describe("Session 338 -- the sizes of this file sit where the spreads fail, or do not fail, as the rows above say", () => {
  it("the long list is past the first throw of both old statements", () => {
    expect(LONG).toBeGreaterThan(FIRST_THROW.flatten);
    expect(LONG).toBeGreaterThan(FIRST_THROW.citations);
  });

  it("the root of two children reaches the flattening's spread at the sum of its children, and each child alone is below it", () => {
    expect(EACH_OF_TWO).toBeLessThan(FIRST_THROW.flatten);
    expect(2 * EACH_OF_TWO + 2).toBeGreaterThan(FIRST_THROW.flatten);
  });

  it("the three roots, and the three files of the adapter's loop, are each below the first throw (the old statement reads them)", () => {
    expect(EACH_OF_THREE).toBeLessThan(FIRST_THROW.flatten);
    expect(FILE_A).toBeLessThan(FIRST_THROW.citations);
    expect(FILE_B).toBeLessThan(FIRST_THROW.citations);
    expect(FILE_A + FILE_B).toBeGreaterThan(FIRST_THROW.citations);
  });
});
