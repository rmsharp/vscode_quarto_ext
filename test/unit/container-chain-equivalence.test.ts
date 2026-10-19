import { describe, expect, it } from "vitest";
import { indexLineIndents, leadingWsLen, mappingContainerKey, nestedParentPath } from "../../src/core/yaml-context";
import { findNestedFrontMatterValueLines } from "../../src/core/yaml-frontmatter-nested-values";
import { seededRandom } from "./support/regex-equivalence";

// Session 323 — the BACKLOG item "Other regexes still quadratic on a long run of blanks, CR or U+2028", part (6a). The ancestor walk of `nestedParentPath` climbed every ancestor of the line asked, reading each one's
// whole indent twice and prepending its key, so a line `d` levels down cost `d` hops of `d` characters (cubic in the depth, while the text grows with its square: 3,200 levels took 8.3 s;
// `pathological-inputs.test.ts` has the document rows). Given an index, it now builds each line's chain of containers from the chain of the line above it and keeps the answer in `index.chains`. The old
// function is kept here, verbatim, as the oracle (Learning 738): the new one must answer what it answered for every document and every line asked, in any order, through one index and through a fresh one.

/** Whether the shipped one-level gate (`NESTED_CONTAINERS`, not exported) lets a column-0 container through, read off the shipped function with a two-line document. */
const gateAnswers = new Map<string, boolean>();
const inGate = (container: string): boolean => {
  let answer = gateAnswers.get(container);
  if (answer === undefined) {
    answer = nestedParentPath([`${container}:`, "  k: v"], 1, 2) !== null;
    gateAnswers.set(container, answer);
  }
  return answer;
};

/** The old `nearestShallowerLine`, verbatim (the scan; the old function was never given an index). */
function oldNearestShallowerLine(lines: string[], line: number, indent: number): number {
  for (let i = line - 1; i >= 0; i--) {
    const t = lines[i] ?? "";
    if (t.trim() === "") {
      continue;
    }
    const lead = leadingWsLen(t);
    if (t.slice(lead).startsWith("#")) {
      continue;
    }
    if (lead < indent) {
      return i;
    }
  }
  return -1;
}

/** The old `nestedParentPath`, verbatim but for the gate and the scan above. */
function oldNestedParentPath(lines: string[], line: number, indent: number): string[] | null {
  const parentLine = oldNearestShallowerLine(lines, line, indent);
  if (parentLine < 0) {
    return null;
  }
  const container = mappingContainerKey(lines[parentLine] ?? "");
  if (container === null) {
    return null;
  }
  const parentIndent = leadingWsLen(lines[parentLine] ?? "");
  if (parentIndent === 0) {
    return inGate(container) ? [container] : null;
  }
  const path = [container];
  let cur = parentLine;
  let curIndent = parentIndent;
  for (;;) {
    const up = oldNearestShallowerLine(lines, cur, curIndent);
    if (up < 0) {
      return null;
    }
    const key = mappingContainerKey(lines[up] ?? "");
    if (key === null) {
      return null;
    }
    path.unshift(key);
    const upIndent = leadingWsLen(lines[up] ?? "");
    if (upIndent === 0) {
      return key === "format" ? path : null;
    }
    cur = up;
    curIndent = upIndent;
  }
}

const EXHAUSTIVE_LENGTH = 5;
const SIX_LINE_LENGTH = 6;
const SEEDED_DOCUMENTS = 4_000;
const STAIRCASE_DEPTH = 12;
const WORK_DEPTH = 400;
const WORK_SIBLINGS = 1_000;
const SAME_LINE_ASKS = 1_000;

/**
 * Counts of what the comparisons covered, so that one that answers `null` everywhere cannot pass: documents, (line, indent) pairs asked, pairs the old function answered with a path (counted in ascending order, own
 * indent only), and the longest path it answered.
 */
type Tally = { documents: number; asked: number; answered: number; longest: number; disagreements: string[] };
const newTally = (): Tally => ({ documents: 0, asked: 0, answered: 0, longest: 0, disagreements: [] });

/** The three orders a document's lines can be asked in: down, up, and from the two ends towards the middle. */
function askingOrders(count: number): number[][] {
  const down = Array.from({ length: count }, (_, i) => i);
  const zigzag: number[] = [];
  for (let low = 0, high = count - 1; low <= high; low++, high--) {
    zigzag.push(high);
    if (low !== high) {
      zigzag.push(low);
    }
  }
  return [down, [...down].reverse(), zigzag];
}

const show = (path: string[] | null): string => JSON.stringify(path);

/**
 * Ask every line of one document, at its own indent (the index answers) and, unless `wide` is false, at two others (it does not, and the scan runs), in three orders, through one index kept for the order and through a fresh index for each
 * question and through no index, and compare each answer with the old function's. Adds to `tally`.
 */
function compareAsks(lines: string[], tally: Tally, wide = true): void {
  const orders = askingOrders(lines.length);
  orders.forEach((order, which) => {
    const shared = indexLineIndents(lines);
    for (const line of order) {
      const own = leadingWsLen(lines[line]);
      for (const indent of wide ? [own, own + 2, 0] : [own]) {
        const expected = oldNestedParentPath(lines, line, indent);
        tally.asked++;
        if (which === 0 && indent === own && expected !== null) {
          tally.answered++;
          tally.longest = Math.max(tally.longest, expected.length);
        }
        const answers = [nestedParentPath(lines, line, indent, shared), nestedParentPath(lines, line, indent, indexLineIndents(lines)), nestedParentPath(lines, line, indent)];
        if (answers.some((answer) => show(answer) !== show(expected)) && tally.disagreements.length < 5) {
          tally.disagreements.push(`${JSON.stringify(lines)} asked ${line} at indent ${indent} in order ${which}: old ${show(expected)}, shared ${show(answers[0])}, fresh ${show(answers[1])}, none ${show(answers[2])}`);
        }
      }
    }
  });
  tally.documents++;
}

/** Every document of 1..maxLength lines over `kinds`. */
function* everyDocument(kinds: readonly string[], maxLength: number): Generator<string[]> {
  let level: string[][] = [[]];
  for (let length = 1; length <= maxLength; length++) {
    const next: string[][] = [];
    for (const prefix of level) {
      for (const kind of kinds) {
        next.push([...prefix, kind]);
      }
    }
    level = next;
    yield* level;
  }
}

const NBSP = String.fromCharCode(0xa0);

// The lines of the exhaustive rows: the two roots that decide the path (`format` and one that is not), containers at four deeper indents (so that a five-line document can be a four-level staircase), a scalar and a comment.
const STAIRCASE_KINDS = ["format:", "execute:", "  a:", "    b:", "      c:", "        d:", "    v: 1", "  # c"];
// The six-line rows use fewer kinds, chosen so that a whole six-level staircase is among the documents.
const SIX_LINE_KINDS = ["format:", "  a:", "    b:", "      c:", "        d:", "          e:", "  s: v"];
const ROOTS = ["format:", "execute:", "website:", "crossref:", '"format":', "format :", "format: # c", "format: x", "format: |", "- format:", NBSP + "format:", "\tformat:"];

/** A document grown by a random walk on the indent: a root, then containers deeper, beside and shallower, with scalars, comments, blank lines, sequence items and block scalars among them. */
function walkedDocument(next: () => number): string[] {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)];
  const length = 8 + Math.floor(next() * 33);
  const lines: string[] = [];
  let indent = 0;
  for (let n = 0; n < length; n++) {
    const roll = next();
    const pad = (width: number): string => (next() < 0.06 ? "\t".repeat(Math.max(1, Math.round(width / 2))) : " ".repeat(width));
    if (n === 0 || roll < 0.05) {
      lines.push(next() < 0.6 ? "format:" : pick(ROOTS));
      indent = 0;
    } else if (roll < 0.4) {
      indent += 1 + Math.floor(next() * 3);
      lines.push(`${pad(indent)}k${n}:`);
    } else if (roll < 0.55) {
      lines.push(`${pad(indent)}k${n}:`);
    } else if (roll < 0.7) {
      indent = Math.max(0, indent - (1 + Math.floor(next() * 3)));
      lines.push(`${pad(indent)}k${n}:`);
    } else if (roll < 0.78) {
      lines.push(`${pad(indent)}k${n}: v`);
    } else if (roll < 0.83) {
      lines.push(`${pad(indent)}# c`);
    } else if (roll < 0.87) {
      lines.push(pick(["", "  ", NBSP]));
    } else if (roll < 0.91) {
      lines.push(`${pad(indent)}- x`);
    } else if (roll < 0.94) {
      lines.push(`${pad(indent)}k${n}: |`);
    } else if (roll < 0.97) {
      lines.push(`${pad(indent)}k${n}: # c`);
    } else {
      lines.push(`${NBSP}${pad(indent)}k${n}:`);
    }
  }
  return lines;
}

const staircase = (depth: number, root: string): string[] => [root, ...Array.from({ length: depth }, (_, j) => `${" ".repeat(j + 1)}k${j + 1}:`)];

// The lines a staircase can be broken by, one at a time, at every position: each is a line that is not a pure container, or one that ends the chain another way.
const BREAKERS = ["  s: v", "# c", "", "- x", "k: |", "x: 1", "format:", "execute:", " ".repeat(40) + "z:", "\tz:", NBSP + "z:"];

describe("Session 323 — nestedParentPath with an index answers what the old climb answered", () => {
  it.each([
    ["one level under format", ["format:", "  k: v"], 1, 2, ["format"]],
    ["one level under execute", ["execute:", "  k: v"], 1, 2, ["execute"]],
    ["one level under a container the gate lets through", ["crossref:", "  k: v"], 1, 2, ["crossref"]],
    ["one level under a column-0 container the gate does not let through", ["website:", "  k: v"], 1, 2, null],
    ["two levels under format", ["format:", "  html:", "    k: v"], 2, 4, ["format", "html"]],
    ["four levels under format", ["format:", "  html:", "    toc:", "      a:", "        k: v"], 4, 8, ["format", "html", "toc", "a"]],
    ["two levels under execute: the root is not format", ["execute:", "  a:", "    k: v"], 2, 4, null],
    ["two levels under a root with a scalar", ["format: x", "  html:", "    k: v"], 2, 4, null],
    ["a block scalar on the way up", ["format:", "  html: |", "    k: v"], 2, 4, null],
    ["a sequence item on the way up", ["format:", "  - html:", "    k: v"], 2, 4, null],
    ["no line above is shallower", ["  a:", "  k: v"], 1, 2, null],
    ["a comment between the container and its child", ["format:", "  html:", "    # c", "    k: v"], 3, 4, ["format", "html"]],
    ["a deeper block between the container and its child", ["format:", "  html:", "    a:", "      b: v", "    k: v"], 4, 4, ["format", "html"]],
    ["the root key is quoted: it is not format", ['"format":', "  html:", "    k: v"], 2, 4, null],
    ["a space before the root's colon: the key is still format", ["format :", "  html:", "    k: v"], 2, 4, ["format", "html"]],
    ["a comment after a container's colon: it is still a container", ["format: # c", "  html: # d", "    k: v"], 2, 4, ["format", "html"]],
  ] as const)("%s", (_what, lines, line, indent, expected) => {
    const copy = [...lines];
    expect(oldNestedParentPath(copy, line, indent)).toEqual(expected);
    expect(nestedParentPath(copy, line, indent)).toEqual(expected);
    expect(nestedParentPath(copy, line, indent, indexLineIndents(copy))).toEqual(expected);
  });

  it("agrees on every document of up to five lines over eight kinds of line (STAIRCASE_KINDS: the roots, four indents of container, a scalar and a comment)", () => {
    const tally = newTally();
    for (const lines of everyDocument(STAIRCASE_KINDS, EXHAUSTIVE_LENGTH)) {
      compareAsks(lines, tally);
    }
    expect(tally.disagreements).toEqual([]);
    expect(tally).toMatchObject({ documents: 37_448, answered: 47_381, longest: 4 });
  }, 120000);

  it("agrees on every document of six lines over seven kinds of line (SIX_LINE_KINDS: a six-level staircase is among them)", () => {
    const tally = newTally();
    for (const lines of everyDocument(SIX_LINE_KINDS, SIX_LINE_LENGTH)) {
      if (lines.length === SIX_LINE_LENGTH) {
        compareAsks(lines, tally, false);
      }
    }
    expect(tally.disagreements).toEqual([]);
    expect(tally).toMatchObject({ documents: 117_649, answered: 161_390, longest: 5 });
  }, 120000);

  it("agrees on 4,000 seeded documents of 8 to 40 lines grown by a random walk on the indent", () => {
    const next = seededRandom(323);
    const tally = newTally();
    for (let n = 0; n < SEEDED_DOCUMENTS; n++) {
      compareAsks(walkedDocument(next), tally);
    }
    expect(tally.disagreements).toEqual([]);
    expect(tally).toMatchObject({ documents: SEEDED_DOCUMENTS, answered: 12_435, longest: 11 });
  }, 120000);

  // A staircase of every depth up to twelve under each root, with each breaker put in at each position (or none), every line asked: the chain is long, and exactly one line on it is not a container.
  it("agrees on a staircase of up to twelve levels under each of twelve roots, broken by each of eleven lines at each position", () => {
    const tally = newTally();
    for (const root of ROOTS) {
      for (let depth = 1; depth <= STAIRCASE_DEPTH; depth++) {
        const whole = staircase(depth, root);
        compareAsks(whole, tally);
        for (const breaker of BREAKERS) {
          for (let at = 1; at <= whole.length; at++) {
            compareAsks([...whole.slice(0, at), breaker, ...whole.slice(at)], tally);
          }
        }
      }
    }
    expect(tally.disagreements).toEqual([]);
    expect(tally).toMatchObject({ documents: 12_024, answered: 25_248, longest: 13 });
  }, 120000);
});

/** `lines` with every read of a line by index counted. An index is built from the plain array first, so only the questions asked of the watched one are counted. */
function watched(lines: string[]): { lines: string[]; reads: () => number } {
  let reads = 0;
  const proxy = new Proxy(lines, {
    get(target, property, receiver) {
      if (typeof property === "string" && /^\d+$/.test(property)) {
        reads++;
      }
      return Reflect.get(target, property, receiver);
    },
  });
  return { lines: proxy, reads: () => reads };
}

const downFrom = (count: number): number[] => Array.from({ length: count }, (_, i) => i);
const upFrom = (count: number): number[] => downFrom(count).reverse();

// The cost, counted as lines read instead of milliseconds: it does not move with the load of the machine. The old climb read the line of every ancestor of every line asked (400 levels asked once each: about 80,000 reads),
// the index reads a line when its chain is first built and never again.
describe("Session 323 — the ancestor climb reads each line of the document at most once", () => {
  const deepest = (depth: number): string[] => ["format", ...Array.from({ length: depth - 1 }, (_, j) => `k${j + 1}`)];
  const withSiblings = (depth: number, siblings: number): string[] => [...staircase(depth, "format:"), ...Array.from({ length: siblings }, (_, i) => `${" ".repeat(depth + 1)}o${i}: v`)];

  it.each([
    ["a 400-level staircase under format, every line asked from the bottom up", staircase(WORK_DEPTH, "format:"), true],
    ["the same, asked from the top down", staircase(WORK_DEPTH, "format:"), false],
    ["a 400-level staircase under execute, a root that is not format: the climb ends there for every line", staircase(WORK_DEPTH, "execute:"), true],
    ["a 400-level staircase under a root that holds a scalar: no line has a path, and none is read again", staircase(WORK_DEPTH, "format: x"), true],
    ["a 400-level staircase with a block scalar on the first level: the chain fails at the top for every line below", [...staircase(WORK_DEPTH, "format:").slice(0, 1), " k1: |", ...staircase(WORK_DEPTH, "format:").slice(2)], true],
    ["a 400-level trunk and 1,000 sibling scalars at its bottom, asked from the bottom up", withSiblings(WORK_DEPTH, WORK_SIBLINGS), true],
    ["the same, asked from the top down", withSiblings(WORK_DEPTH, WORK_SIBLINGS), false],
  ] as const)("%s", (_what, lines, bottomUp) => {
    const index = indexLineIndents(lines as string[]);
    const watch = watched(lines as string[]);
    const order = bottomUp ? upFrom(lines.length) : downFrom(lines.length);
    const answers = new Map<number, string[] | null>();
    for (const line of order) {
      answers.set(line, nestedParentPath(watch.lines, line, leadingWsLen(lines[line]), index));
    }
    expect(watch.reads()).toBeLessThanOrEqual(lines.length);
    // The answers are the old function's: the pin is on the work, not instead of the answer.
    for (const line of [1, Math.floor(lines.length / 2), lines.length - 1]) {
      expect(answers.get(line)).toEqual(oldNestedParentPath(lines as string[], line, leadingWsLen(lines[line])));
    }
  });

  it("a staircase under format answers the full path for its bottom line, and the work pins above are not for nothing", () => {
    const lines = staircase(WORK_DEPTH, "format:");
    expect(nestedParentPath(lines, lines.length - 1, WORK_DEPTH, indexLineIndents(lines))).toEqual(deepest(WORK_DEPTH));
    const watch = watched(lines);
    oldNestedParentPath(watch.lines, lines.length - 1, WORK_DEPTH);
    expect(watch.reads()).toBeGreaterThan(WORK_DEPTH); // the old climb reads one line per hop (and the lines between): the bound above is not one it meets for free
  });

  it("asking the same line again reads nothing: the second answer comes from the chain kept in the index", () => {
    const lines = staircase(WORK_DEPTH, "format:");
    const index = indexLineIndents(lines);
    const watch = watched(lines);
    const first = nestedParentPath(watch.lines, lines.length - 1, WORK_DEPTH, index);
    const afterFirst = watch.reads();
    for (let ask = 1; ask < SAME_LINE_ASKS; ask++) {
      expect(nestedParentPath(watch.lines, lines.length - 1, WORK_DEPTH, index)).toEqual(first);
    }
    expect(watch.reads()).toBe(afterFirst);
  });

  it("a second line asked below a chain already built reads only the lines the first did not", () => {
    const lines = staircase(WORK_DEPTH, "format:");
    const index = indexLineIndents(lines);
    const watch = watched(lines);
    nestedParentPath(watch.lines, WORK_DEPTH - 1, WORK_DEPTH - 1, index);
    const afterFirst = watch.reads();
    nestedParentPath(watch.lines, WORK_DEPTH, WORK_DEPTH, index);
    expect(watch.reads() - afterFirst).toBe(1);
  });
});

describe("Session 323 — what the index keeps of the chains", () => {
  it("starts with nothing answered: one slot a line, none filled until a line is asked", () => {
    const lines = ["format:", "  html:", "    k: v", "# c", "", "other:"];
    const index = indexLineIndents(lines);
    expect(index.chains).toHaveLength(lines.length);
    expect(Array.from(index.chains, (chain) => chain === undefined)).toEqual(lines.map(() => true)); // `Array.from`, not `every` or `map`: the slots are holes, which those skip
    expect(indexLineIndents([]).chains).toHaveLength(0);
  });

  it("fills the lines on the way up from the line asked about, and no others", () => {
    const lines = ["format:", "  html:", "    toc:", "      k: v", "      z: v", "other:", "  x: 1"];
    const index = indexLineIndents(lines);
    expect(nestedParentPath(lines, 3, 6, index)).toEqual(["format", "html", "toc"]);
    expect(Array.from(index.chains, (chain) => (chain === undefined ? "-" : chain === null ? "null" : chain.key))).toEqual(["format", "html", "toc", "-", "-", "-", "-"]);
    expect(index.chains[2]).toMatchObject({ key: "toc", depth: 3, root: "format" });
    expect(index.chains[0]).toMatchObject({ key: "format", above: null, depth: 1, root: "format" });
  });

  it("keeps a failed climb as null for every line it passed, so that it is not tried again", () => {
    const lines = ["format: x", "  a:", "    b:", "      k: v"];
    const index = indexLineIndents(lines);
    expect(nestedParentPath(lines, 3, 6, index)).toBeNull();
    expect(index.chains.slice(0, 3)).toEqual([null, null, null]);
    expect(index.chains[3]).toBeUndefined();
  });

  it("keeps an indented container with nothing shallower above it as null, and reads its line once for any number of children", () => {
    const lines = ["  a:", "    k: v"];
    const index = indexLineIndents(lines);
    expect(nestedParentPath(lines, 1, 4, index)).toBeNull();
    expect(index.chains[0]).toBeNull();
    const children = ["  a:", ...Array.from({ length: WORK_SIBLINGS }, (_, i) => `    o${i}: v`)];
    const watch = watched(children);
    const childIndex = indexLineIndents(children);
    for (let line = 1; line < children.length; line++) {
      expect(nestedParentPath(watch.lines, line, 4, childIndex)).toBeNull();
    }
    expect(watch.reads()).toBe(1);
  });

  it("shares the chain of a container among its children: one object, not a copy for each", () => {
    const lines = ["format:", "  html:", "    a: v", "    b: v"];
    const index = indexLineIndents(lines);
    nestedParentPath(lines, 2, 4, index);
    const kept = index.chains[1];
    nestedParentPath(lines, 3, 4, index);
    expect(index.chains[1]).toBe(kept);
  });
});

describe("Session 323 — the paths findNestedFrontMatterValueLines returns", () => {
  const trunkDocument = (depth: number, tail: string): string => `---\nformat:\n${Array.from({ length: depth }, (_, j) => `${" ".repeat(j + 1)}k${j + 1}:`).join("\n")}\n${tail}\n---\n\ntext\n`;

  it("gives every line at the bottom of a 60-level trunk its own array of 61 keys", () => {
    const found = findNestedFrontMatterValueLines(trunkDocument(60, ["a", "b", "c"].map((key) => `${" ".repeat(61)}${key}: v`).join("\n")));
    expect(found.map((entry) => entry.key)).toEqual(["a", "b", "c"]);
    for (const entry of found) {
      expect(entry.parentPath).toEqual(["format", ...Array.from({ length: 60 }, (_, j) => `k${j + 1}`)]);
    }
    expect(new Set(found.map((entry) => entry.parentPath)).size).toBe(3);
    found[0].parentPath.push("changed");
    found[0].parentPath[0] = "changed";
    expect(found[1].parentPath).toHaveLength(61);
    expect(found[1].parentPath[0]).toBe("format");
  });

  it("gives two branches of one trunk their own paths", () => {
    const text = "---\nformat:\n  html:\n    toc:\n      a: v\n    code:\n      b: v\n---\n\ntext\n";
    expect(findNestedFrontMatterValueLines(text).map((entry) => [entry.key, entry.parentPath])).toEqual([
      ["a", ["format", "html", "toc"]],
      ["b", ["format", "html", "code"]],
    ]);
  });
});

// A row run with a smaller staircase, or allowed more reads, would pass on the parent too.
describe("Session 323 — the sizes the container chain rows are built on", () => {
  it("keeps the sizes the Session 323 rows are built on", () => {
    expect([EXHAUSTIVE_LENGTH, SIX_LINE_LENGTH, SEEDED_DOCUMENTS, STAIRCASE_DEPTH, WORK_DEPTH, WORK_SIBLINGS, SAME_LINE_ASKS]).toEqual([5, 6, 4_000, 12, 400, 1_000, 1_000]);
  });
});
