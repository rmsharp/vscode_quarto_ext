import { describe, expect, it } from "vitest";
import { findAllCells } from "../../src/core/qmd/model";
import { type CacheLimits, REGIONS_CACHE_ALWAYS_KEPT, REGIONS_CACHE_LIMITS, REGIONS_CACHE_MAX_ENTRIES, REGIONS_CACHE_TEXT_BUDGET, admitted, promoted } from "../../src/core/qmd/regions-cache";
import { seededRandom } from "./support/regex-equivalence";

// Session 343 -- part (3) of the BACKLOG item "What Session 342's review round found beside the typing-path cures", SIB-05. The model's scan cache (`regionsCache` in src/core/qmd/model.ts) held TWO entries, keyed (text, engine,
// mode): one document under its engine-blind key (cell background, Run Cell, completion) and its engine-aware key (the Outline). With a SECOND visible `.qmd`, every edit cycle of the first thrashed it: the second's blind scan
// was evicted by the first's two new ones and paid a cold scan again, on every cycle. Measured at the parent (probe sib05b: tint A blind, Outline A [a blind `resolveDocumentEngine`, then the knitr-aware `buildOutline`], tint B
// blind; a fresh process each, a fresh text for A each cycle, median of 9, load 6 to 15), 500 / 2,000 / 8,000 cells of 25 lines: A alone 30.4 / 122.5 / 529.1 ms a cycle, with a visible B 37.9 / 156.3 / 673.0 ms.
//
// ⚠ Session 343's review round: the EDIT cycle measured above is cured by the cell-background refresh plan (an edit refreshes only the editors of its own document), not by this cache; what the four slots still serve is a
// FOCUS SWITCH between two visible documents and a knitr or jupyter document under its two keys (the first describe below).
//
// The cache holds up to FOUR entries, least recently used out (a hit promotes, a miss inserts at the front and drops from the back), under a memory bound: the two most recent entries are kept whatever their size (today's
// two), and the third and fourth only while the TOTAL LENGTH of all the held texts is at most 8,388,608 characters (a megabytes-sized document keeps today's two). The policy is `promoted` and `admitted`
// (src/core/qmd/regions-cache.ts), generic over the entry and given its limits, so that it is read here with small numbers; the cache in the model is wired to the real constants.
//
// AT THE CURE (the same probe, a fresh process each, median of 9, load 5 to 9): 500 cells 29.6 alone, 28.8 with a visible B (parent 30.9 and 38.2); 2,000 cells 122.6 and 120.8 (parent 126.8 and 155.9): the visible B costs its warm
// lookup, about nothing. ⚠ THE BOUND SETS THE REACH. A document of 8,000 cells is 2,850,940 characters and of 6,000 cells 2,132,940, and the edit cycle holds A's two new scans, the one before them and B's one: four entries
// of 2.1 million characters or more total over 8,388,608, so the fourth, which the cycle needs for a moment, is paid for by dropping the LEAST recently used entry, which is B's (it was touched before A's two new scans). At 6,000,
// 7,500 and 8,000 cells the cycle with a visible B is as slow as the parent's (478 / 612 / 654 ms against 480 / 625 / 646). The cache serves a second visible document of up to 2,097,152 characters (about 5,900 cells of this
// shape); a larger budget would reach further at four times the memory.
//
// This file holds the POLICY rows (`promoted` and `admitted` with limits small enough to write by hand, then against a naive reference spelling over seeded sequences of hits and misses), and the CACHE rows, which go through the
// model's public entry `findAllCells(text, engine)` and tell a hit from a miss by the identity of the cell objects it returns (a hit hands back the scan's own cells; a miss makes another scan and other objects). Asking is
// itself a hit or a miss, so the rows ask the keys they expect to hit first and the key they expect to miss last.

const CELL = "```{python}\nx = 1\n```\n";

/** A text of exactly `length` characters that holds one cell, whose last characters are `tag` (so two texts of one length and different tags are different keys). Prose on one long line, which the scan reads in a few milliseconds. */
function textOf(length: number, tag: string): string {
  return CELL + "a".repeat(length - CELL.length - tag.length) + tag;
}

/** The cell objects of one scan: a hit on the same key returns the very same first cell, a miss another. */
function firstCell(text: string, engine?: Parameters<typeof findAllCells>[1]): object {
  const cells = findAllCells(text, engine);
  if (cells.length === 0) throw new Error(`the scan of ${text.length} characters under ${engine} found no cell: a hit could not be told from a miss`);
  return cells[0];
}

/** Push everything out of the cache: five distinct small texts, more than it holds. */
function flush(): void {
  for (let i = 0; i < 5; i++) findAllCells(textOf(60, `flush${i}`));
}

/** `true` when asking (text, engine) again returns the cell objects of `known`. */
const hits = (text: string, known: object, engine?: Parameters<typeof findAllCells>[1]): boolean => firstCell(text, engine) === known;

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE POLICY, with limits small enough to write by hand: at least 2 kept, at most 4, and a budget of 100 characters once there are more than 2.

interface Entry {
  id: string;
  text: string;
}
const entry = (id: string, length: number): Entry => ({ id, text: "x".repeat(length) });
const ids = (entries: readonly Entry[]): string => entries.map((e) => e.id).join(" ");
const SMALL: CacheLimits = { alwaysKept: 2, maxEntries: 4, textBudget: 100 };

describe("Session 343 -- the replacement policy: admitted", () => {
  it("a miss in an empty cache holds the new entry alone", () => {
    expect(ids(admitted([], entry("a", 10), SMALL))).toBe("a");
  });

  it("a miss goes first and the others keep their order, up to four entries", () => {
    let entries: Entry[] = [];
    const seen: string[] = [];
    for (const id of ["a", "b", "c", "d"]) {
      entries = admitted(entries, entry(id, 10), SMALL);
      seen.push(ids(entries));
    }
    expect(seen).toEqual(["a", "b a", "c b a", "d c b a"]);
  });

  it("a fifth entry drops the least recently used, the one at the back", () => {
    const entries = ["d", "c", "b", "a"].map((id) => entry(id, 10));
    expect(ids(admitted(entries, entry("e", 10), SMALL))).toBe("e d c b");
  });

  it("the total length of all the held texts at most the budget keeps the third and the fourth: 4 x 25 = 100", () => {
    const entries = ["c", "b", "a"].map((id) => entry(id, 25));
    expect(ids(admitted(entries, entry("d", 25), SMALL))).toBe("d c b a");
  });

  it("one character over the budget drops the fourth, and the third stays when that is enough: 3 x 25 + 26 = 101 becomes 25 + 25 + 25 = 75", () => {
    const entries = ["c", "b", "a"].map((id) => entry(id, 25));
    expect(ids(admitted(entries, entry("d", 26), SMALL))).toBe("d c b");
    expect(ids(admitted(entries, entry("d", 51), SMALL))).toBe("d c");
  });

  it("over the budget with three entries drops the third: 40 + 40 + 21 = 101 keeps the two most recent", () => {
    const entries = [entry("b", 40), entry("a", 40)];
    expect(ids(admitted(entries, entry("c", 21), SMALL))).toBe("c b");
    expect(ids(admitted(entries, entry("c", 20), SMALL))).toBe("c b a");
  });

  it("the two most recent are kept whatever their size, and so is the new entry", () => {
    expect(ids(admitted([entry("a", 5000)], entry("b", 5000), SMALL))).toBe("b a");
    expect(ids(admitted([entry("b", 5000), entry("a", 5000)], entry("c", 5000), SMALL))).toBe("c b");
    expect(ids(admitted([], entry("a", 5000), SMALL))).toBe("a");
  });

  it("a third entry is dropped before a larger bound is reached by the first two: only the tail is ever dropped", () => {
    const entries = [entry("b", 60), entry("a", 30)];
    expect(ids(admitted(entries, entry("c", 5), SMALL))).toBe("c b a"); // 95
    expect(ids(admitted(entries, entry("c", 11), SMALL))).toBe("c b"); // 101: the oldest goes, not the big one in the middle
  });

  it("a budget of 0 and a maximum of 2 is today's cache: the two most recent, whatever the sizes", () => {
    const TODAY: CacheLimits = { alwaysKept: 2, maxEntries: 2, textBudget: 0 };
    expect(ids(admitted([entry("b", 1), entry("a", 1)], entry("c", 1), TODAY))).toBe("c b");
  });

  it("the entries handed in are not changed, and the answer is another array", () => {
    const entries = Object.freeze([entry("b", 10), entry("a", 10)]);
    const next = admitted(entries, entry("c", 10), SMALL);
    expect(next).not.toBe(entries);
    expect(ids(entries)).toBe("b a");
    expect(ids(next)).toBe("c b a");
  });

  it("the real limits are the named constants: 2 always kept, 4 at most, 8,388,608 characters", () => {
    expect(REGIONS_CACHE_ALWAYS_KEPT).toBe(2);
    expect(REGIONS_CACHE_MAX_ENTRIES).toBe(4);
    expect(REGIONS_CACHE_TEXT_BUDGET).toBe(8_388_608);
    expect(REGIONS_CACHE_LIMITS).toEqual({ alwaysKept: 2, maxEntries: 4, textBudget: 8_388_608 });
  });

  it("the default limits are the real ones: five entries of 10 characters keep four", () => {
    const entries = ["d", "c", "b", "a"].map((id) => entry(id, 10));
    expect(ids(admitted(entries, entry("e", 10)))).toBe("e d c b");
  });
});

describe("Session 343 -- the replacement policy: promoted", () => {
  const four = ["d", "c", "b", "a"].map((id) => entry(id, 10));

  it("a hit on the second entry puts it first", () => {
    expect(ids(promoted(four, 1))).toBe("c d b a");
  });

  it("a hit on the last entry puts it first and keeps the others in order", () => {
    expect(ids(promoted(four, 3))).toBe("a d c b");
  });

  it("a hit on the third entry puts it first and keeps the others in order", () => {
    expect(ids(promoted(four, 2))).toBe("b d c a");
  });

  it("a hit on the first entry changes nothing", () => {
    expect(ids(promoted(four, 0))).toBe("d c b a");
  });

  it("an index past either end changes nothing", () => {
    expect(ids(promoted(four, 4))).toBe("d c b a");
    expect(ids(promoted(four, -1))).toBe("d c b a");
    expect(ids(promoted([], 0))).toBe("");
  });

  it("the answer is another array and the entries are the same objects; the array handed in is not changed", () => {
    const frozen = Object.freeze(four.slice());
    const next = promoted(frozen, 2);
    expect(next).not.toBe(frozen);
    expect(ids(frozen)).toBe("d c b a");
    expect(next[0]).toBe(four[2]);
    expect(promoted(frozen, 0)).not.toBe(frozen);
  });
});

/** A naive reference spelling of the same rule, written apart from the loop it checks: how many of the newest entries to keep is the largest count `k` that the maximum allows and that either the always-kept count covers or the total of the first `k` lengths fits the budget. */
function referenceAdmitted(entries: readonly Entry[], fresh: Entry, limits: CacheLimits): Entry[] {
  const all = [fresh, ...entries];
  let keep = 0;
  for (let k = 1; k <= Math.min(all.length, limits.maxEntries); k++) {
    const total = all.slice(0, k).reduce((sum, e) => sum + e.text.length, 0);
    if (k <= limits.alwaysKept || total <= limits.textBudget) keep = k;
    else break;
  }
  return all.slice(0, keep);
}

describe("Session 343 -- the replacement policy against a naive reference over seeded sequences of hits and misses", () => {
  it("39,990 steps (30 runs of 1,333) over six keys of different lengths under 30 seeded limits: the held entries agree after every step, and the budget and the maximum hold", () => {
    const rand = seededRandom(343_003);
    let steps = 0;
    let evictedByBudget = 0;
    let heldFour = 0;
    for (let run = 0; run < 30; run++) {
      const alwaysKept = 1 + Math.floor(rand() * 3);
      const limits: CacheLimits = { alwaysKept, maxEntries: alwaysKept + Math.floor(rand() * 4), textBudget: Math.floor(rand() * 80) };
      const lengths = Array.from({ length: 6 }, () => Math.floor(rand() * 40));
      let real: Entry[] = [];
      let reference: Entry[] = [];
      for (let step = 0; step < 1333; step++) {
        const id = String(Math.floor(rand() * 6));
        const at = real.findIndex((e) => e.id === id);
        if (at >= 0) {
          real = promoted(real, at);
          reference = [reference[at], ...reference.slice(0, at), ...reference.slice(at + 1)];
        } else {
          const fresh = entry(id, lengths[Number(id)]);
          const before = real.length;
          real = admitted(real, fresh, limits);
          reference = referenceAdmitted(reference, fresh, limits);
          if (real.length < Math.min(before + 1, limits.maxEntries)) evictedByBudget++;
        }
        steps++;
        expect(ids(real), JSON.stringify({ run, step, limits })).toBe(ids(reference));
        expect(real.length).toBeLessThanOrEqual(Math.max(limits.maxEntries, limits.alwaysKept));
        if (real.length > limits.alwaysKept) expect(real.reduce((sum, e) => sum + e.text.length, 0)).toBeLessThanOrEqual(limits.textBudget);
        if (real.length >= 4) heldFour++;
      }
    }
    expect(steps).toBe(30 * 1333);
    // the draw reached the budget and the maximum: some steps dropped an entry for the budget, some held four
    expect(evictedByBudget).toBeGreaterThan(500);
    expect(heldFour).toBeGreaterThan(500);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE CACHE, through `findAllCells(text, engine)`. The cells of a scan are shared objects: asking again for a cached key returns the very first cell; a key that was dropped is scanned again and returns another.

describe("Session 343 -- the model keeps four scans: a document under its two keys and a second visible document under its two", () => {
  it("A blind, A aware, B blind and B aware all stay cached: each asked again returns the cells of its first scan", () => {
    flush();
    const A = textOf(400, "A");
    const B = textOf(400, "B");
    const ab = firstCell(A);
    const aa = firstCell(A, "knitr");
    const bb = firstCell(B);
    const ba = firstCell(B, "knitr");
    expect(ab).not.toBe(aa); // two keys, two scans
    expect([hits(A, ab), hits(A, aa, "knitr"), hits(B, bb), hits(B, ba, "knitr")]).toEqual([true, true, true, true]);
    expect([hits(B, bb), hits(B, ba, "knitr"), hits(A, ab), hits(A, aa, "knitr")]).toEqual([true, true, true, true]);
  });

  it("an edit cycle of A (a new text, scanned blind and aware, as the tint and the Outline do) does not drop a visible B: B blind is the same scan after five cycles", () => {
    flush();
    const B = textOf(400, "B");
    const bb = firstCell(B);
    for (let cycle = 0; cycle < 5; cycle++) {
      const A = textOf(400, `A${cycle}`);
      firstCell(A); // the tint
      firstCell(A, "knitr"); // the Outline
      expect(hits(B, bb), `cycle ${cycle}`).toBe(true); // the second editor's tint
    }
  });

  it("the same cycle with B's Outline too: B blind and B aware are both the same scans after five cycles of A", () => {
    flush();
    const B = textOf(400, "B");
    const bb = firstCell(B);
    const ba = firstCell(B, "knitr");
    for (let cycle = 0; cycle < 5; cycle++) {
      const A = textOf(400, `A${cycle}`);
      firstCell(A);
      firstCell(A, "knitr");
      expect([hits(B, bb), hits(B, ba, "knitr")], `cycle ${cycle}`).toEqual([true, true]);
    }
  });

  it("a fifth distinct key drops the least recently used one and no other", () => {
    flush();
    const keys = ["k1", "k2", "k3", "k4", "k5"].map((tag) => textOf(300, tag));
    const known = keys.slice(0, 4).map((text) => firstCell(text));
    const fifth = firstCell(keys[4]);
    expect([hits(keys[1], known[1]), hits(keys[2], known[2]), hits(keys[3], known[3]), hits(keys[4], fifth)]).toEqual([true, true, true, true]);
    expect(hits(keys[0], known[0])).toBe(false); // the oldest was dropped: scanned again, other cells
  });

  it("a hit promotes: after k1 is asked again, the fifth key drops k2, the next oldest, and k1 stays", () => {
    flush();
    const keys = ["k1", "k2", "k3", "k4", "k5"].map((tag) => textOf(300, tag));
    const known = keys.slice(0, 4).map((text) => firstCell(text));
    expect(hits(keys[0], known[0])).toBe(true); // k1 is now the most recent
    const fifth = firstCell(keys[4]);
    expect([hits(keys[0], known[0]), hits(keys[2], known[2]), hits(keys[3], known[3]), hits(keys[4], fifth)]).toEqual([true, true, true, true]);
    expect(hits(keys[1], known[1])).toBe(false);
  });

  it("a hit on the SECOND entry promotes it too: after k3 (the second most recent of four) is asked again, three more keys drop k1, k2 and k4, and k3 stays", () => {
    flush();
    const keys = ["k1", "k2", "k3", "k4", "k5", "k6", "k7"].map((tag) => textOf(300, tag));
    const known = keys.slice(0, 4).map((text) => firstCell(text)); // most recent first: k4 k3 k2 k1
    expect(hits(keys[2], known[2])).toBe(true); // k3 was second; it is first now: k3 k4 k2 k1
    firstCell(keys[4]); // drops k1
    firstCell(keys[5]); // drops k2
    firstCell(keys[6]); // drops k4
    expect(hits(keys[2], known[2])).toBe(true);
  });

  it("a hit on the oldest and then on the next oldest: the order is the order of the hits, and the fifth key drops the one nobody asked", () => {
    flush();
    const keys = ["k1", "k2", "k3", "k4", "k5"].map((tag) => textOf(300, tag));
    const known = keys.slice(0, 4).map((text) => firstCell(text));
    expect([hits(keys[0], known[0]), hits(keys[1], known[1])]).toEqual([true, true]); // order now k2 k1 k4 k3
    const fifth = firstCell(keys[4]); // drops k3
    expect([hits(keys[1], known[1]), hits(keys[0], known[0]), hits(keys[3], known[3]), hits(keys[4], fifth)]).toEqual([true, true, true, true]);
    expect(hits(keys[2], known[2])).toBe(false);
  });

  it("a mode that no engine but knitr reads is not another key: a jupyter document asked under both modes is one entry, and the four slots are still free for others", () => {
    flush();
    const J = textOf(300, "J");
    const j = findAllCells(J, "jupyter", "execute")[0];
    expect(findAllCells(J, "jupyter", "no-execute")[0]).toBe(j);
    const others = ["o1", "o2", "o3"].map((tag) => textOf(300, tag));
    const known = others.map((text) => firstCell(text));
    expect(findAllCells(J, "jupyter", "no-execute")[0]).toBe(j);
    expect(others.map((text, i) => hits(text, known[i]))).toEqual([true, true, true]);
  });
});

describe(`Session 343 -- the memory bound: the third and fourth entries are kept only while all the held texts total at most ${REGIONS_CACHE_TEXT_BUDGET.toLocaleString("en-US")} characters`, () => {
  const QUARTER = REGIONS_CACHE_TEXT_BUDGET / 4;

  it("four scans of exactly a quarter of the budget each (the total IS the budget) are all kept", () => {
    flush();
    const A = textOf(QUARTER, "A");
    const B = textOf(QUARTER, "B");
    expect(A.length + B.length).toBe(REGIONS_CACHE_TEXT_BUDGET / 2);
    const ab = firstCell(A);
    const aa = firstCell(A, "knitr");
    const bb = firstCell(B);
    const ba = firstCell(B, "knitr");
    expect([hits(A, ab), hits(A, aa, "knitr"), hits(B, bb), hits(B, ba, "knitr")]).toEqual([true, true, true, true]);
  });

  it("one character over a quarter each for the second document (B is a quarter and a character): the four scans total over the budget, the oldest goes and the other three fit", () => {
    flush();
    const A = textOf(QUARTER, "A");
    const B = textOf(QUARTER + 1, "B");
    const ab = firstCell(A);
    const aa = firstCell(A, "knitr");
    const bb = firstCell(B);
    const ba = firstCell(B, "knitr"); // 4 x a quarter + 2 over; without the oldest 3 x a quarter + 2: under
    expect([hits(B, bb), hits(B, ba, "knitr"), hits(A, aa, "knitr")]).toEqual([true, true, true]);
    expect(hits(A, ab)).toBe(false);
  });

  it("three scans that fit exactly are kept and one character more drops the third too: A a quarter, B three eighths of the budget, then one character more", () => {
    const EIGHTH = REGIONS_CACHE_TEXT_BUDGET / 8;
    // [B aware, B blind, A aware] total 2 x 3 eighths + 2 eighths = the budget; the fourth scan (A blind) was dropped for being the oldest
    flush();
    const A = textOf(2 * EIGHTH, "A");
    const fits = textOf(3 * EIGHTH, "B");
    const ab = firstCell(A);
    const aa = firstCell(A, "knitr");
    const bb = firstCell(fits);
    const ba = firstCell(fits, "knitr");
    expect(2 * fits.length + A.length).toBe(REGIONS_CACHE_TEXT_BUDGET);
    expect([hits(fits, bb), hits(fits, ba, "knitr"), hits(A, aa, "knitr")]).toEqual([true, true, true]);
    expect(hits(A, ab)).toBe(false);
    // the same with B one character longer: three do not fit, so only the two most recent stay
    flush();
    const over = textOf(3 * EIGHTH + 1, "B");
    const ab2 = firstCell(A);
    const aa2 = firstCell(A, "knitr");
    const bb2 = firstCell(over);
    const ba2 = firstCell(over, "knitr");
    expect(2 * over.length + A.length).toBe(REGIONS_CACHE_TEXT_BUDGET + 2);
    expect([hits(over, bb2), hits(over, ba2, "knitr")]).toEqual([true, true]);
    expect(hits(A, aa2, "knitr")).toBe(false);
    expect(hits(A, ab2)).toBe(false);
  });

  it("dropping the oldest is enough: four scans of 9,000,000 characters in all lose the oldest (1,500,000) and keep the other three (7,500,000)", () => {
    flush();
    const A = textOf(1_500_000, "A");
    const B = textOf(3_000_000, "B");
    const ab = firstCell(A); // oldest
    const aa = firstCell(A, "knitr");
    const bb = firstCell(B);
    const ba = firstCell(B, "knitr"); // the fourth scan: 2 x 1,500,000 + 2 x 3,000,000 = 9,000,000, over; without the oldest 7,500,000, under
    expect([hits(B, bb), hits(B, ba, "knitr"), hits(A, aa, "knitr")]).toEqual([true, true, true]);
    expect(hits(A, ab)).toBe(false);
  });

  it("two scans each over the whole budget are both kept: the two most recent are kept whatever their size, and a third key drops the older", () => {
    flush();
    const A = textOf(REGIONS_CACHE_TEXT_BUDGET + 10, "A");
    const ab = firstCell(A);
    const aa = firstCell(A, "knitr");
    expect([hits(A, ab), hits(A, aa, "knitr")]).toEqual([true, true]);
    const C = textOf(300, "C");
    const cc = firstCell(C); // the third key: over the budget, so only the two most recent stay
    expect([hits(C, cc), hits(A, aa, "knitr")]).toEqual([true, true]);
    expect(hits(A, ab)).toBe(false);
  });

  it("small scans after a big one come back under the budget: the big scan leaves with the oldest and the small ones fill four slots again", () => {
    flush();
    const BIG = textOf(REGIONS_CACHE_TEXT_BUDGET + 10, "BIG");
    firstCell(BIG);
    const small = ["s1", "s2", "s3", "s4"].map((tag) => textOf(300, tag));
    const known = small.map((text) => firstCell(text));
    expect(small.map((text, i) => hits(text, known[i]))).toEqual([true, true, true, true]);
  });
});
