import { describe, expect, it } from "vitest";
import { indexLineIndents, leadingWsLen, nestedParentPath } from "../../src/core/yaml-context";

// Session 314 — `indexLineIndents` answers, for every content line of a block, what the ancestor walk's upward scan answered: the nearest content
// line above it that is indented strictly LESS. The scan walked past every same-indent sibling (n sibling keys cost time proportional to n squared;
// 8,000 keys took 1.5 s in the engine resolver), so `findNestedFrontMatterValueLines` builds the index once. The scan below is the OLD
// `nearestShallowerLine`, copied here as the oracle; `nestedParentPath` WITHOUT an index still runs the scan, so the two paths are also compared
// through it.

const NBSP = String.fromCharCode(0xa0);

/** The old `nearestShallowerLine`, verbatim. */
function scan(lines: string[], line: number, indent: number): number {
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

/** What a line is, for the walk: blank, comment, or content. */
const isContent = (text: string): boolean => text.trim() !== "" && !text.slice(leadingWsLen(text)).startsWith("#");

// Kinds of line a front matter holds, with the ones the scan treats specially: blank lines of every spelling (a line of only no-break spaces is
// blank to `trim()` and has no leading spaces or tabs), comments at every indent, tab and mixed indents, scalars, a block scalar, sequence items,
// and the containers that decide the path (`format` and `execute`, a root that is not `format`).
const KINDS: string[] = [
  "",
  "  ",
  "\t",
  NBSP,
  "# c",
  "  # c",
  "\t# c",
  "format:",
  "  html:",
  "    k:",
  "      m:",
  "        n:",
  "execute:",
  "  echo: v",
  "    deep: v",
  "crossref:",
  "  fig-title: x",
  "k: v",
  "  - x",
  "- y",
  "\tformat:",
  " \t k:",
  "  html: |",
  "    text",
  "website:",
  "  navbar:",
  "    left:",
  "  html:   # note",
];

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

/** A seeded generator (mulberry32), so a failure names a reproducible document. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("indexLineIndents (Session 314)", () => {
  it("indexes a small block: the indent of each content line and the nearest line above it indented less", () => {
    const lines = ["format:", "  html:", "    a: v", "    b: v", "  # c", "", "other:", "  x: 1", "\t y: 2"];
    const index = indexLineIndents(lines);
    expect(Array.from(index.indent)).toEqual([0, 2, 4, 4, -1, -1, 0, 2, 2]);
    expect(Array.from(index.shallower)).toEqual([-1, 0, 1, 1, -1, -1, -1, 6, 6]);
  });

  it("answers for no lines, and for lines that are all blank or comments", () => {
    expect(Array.from(indexLineIndents([]).indent)).toEqual([]);
    const index = indexLineIndents(["", "  ", "# c", NBSP]);
    expect(Array.from(index.indent)).toEqual([-1, -1, -1, -1]);
    expect(Array.from(index.shallower)).toEqual([-1, -1, -1, -1]);
  });

  it("reads a long run of same-indent siblings as one shallower line, not as each other", () => {
    const lines = ["format:", "  html:", ...Array.from({ length: 1000 }, (_, i) => `    k${i}: v`)];
    const index = indexLineIndents(lines);
    expect(Array.from(index.shallower.subarray(2)).every((above) => above === 1)).toBe(true);
    expect(index.shallower[1]).toBe(0);
  });

  it("agrees with the scan on every content line of every document of up to four lines over 28 kinds of line (about 630,000 documents)", () => {
    let documents = 0;
    let lineCount = 0;
    const disagreements: string[] = [];
    for (const lines of everyDocument(KINDS, 4)) {
      documents++;
      const index = indexLineIndents(lines);
      for (let i = 0; i < lines.length; i++) {
        lineCount++;
        if (!isContent(lines[i])) {
          if (index.indent[i] !== -1 || index.shallower[i] !== -1) {
            disagreements.push(`${JSON.stringify(lines)} line ${i}: a blank or comment line was indexed`);
          }
          continue;
        }
        const own = leadingWsLen(lines[i]);
        if (index.indent[i] !== own || index.shallower[i] !== scan(lines, i, own)) {
          disagreements.push(`${JSON.stringify(lines)} line ${i}: indent ${index.indent[i]} (want ${own}), shallower ${index.shallower[i]} (want ${scan(lines, i, own)})`);
        }
      }
    }
    expect(disagreements.slice(0, 3)).toEqual([]);
    expect(documents).toBe(28 + 28 ** 2 + 28 ** 3 + 28 ** 4);
    expect(lineCount).toBe(28 * 1 + 28 ** 2 * 2 + 28 ** 3 * 3 + 28 ** 4 * 4);
  });

  it("agrees with the scan on 40,000 seeded documents of 5 to 24 lines", () => {
    const next = random(314);
    const disagreements: string[] = [];
    for (let n = 0; n < 40000; n++) {
      const length = 5 + Math.floor(next() * 20);
      const lines = Array.from({ length }, () => KINDS[Math.floor(next() * KINDS.length)]);
      const index = indexLineIndents(lines);
      for (let i = 0; i < lines.length; i++) {
        if (isContent(lines[i])) {
          const own = leadingWsLen(lines[i]);
          if (index.indent[i] !== own || index.shallower[i] !== scan(lines, i, own)) {
            disagreements.push(`${JSON.stringify(lines)} line ${i}`);
          }
        } else if (index.indent[i] !== -1 || index.shallower[i] !== -1) {
          disagreements.push(`${JSON.stringify(lines)} line ${i}: blank or comment indexed`);
        }
      }
    }
    expect(disagreements.slice(0, 3)).toEqual([]);
  });
});

describe("nestedParentPath with an index answers what it answers without one (Session 314)", () => {
  const WRONG_INDENTS = [0, 1, 2, 3, 4, 7];

  // Up to three lines the line is asked at its own indent AND at six others (the index must answer only for its own indent and fall back for any
  // other); at four lines, at its own indent only, to keep the run short.
  it("agrees on every line of every document of up to three lines over 28 kinds of line, at its own indent and at others", () => {
    const disagreements: string[] = [];
    let asked = 0;
    for (const lines of everyDocument(KINDS, 3)) {
      const index = indexLineIndents(lines);
      for (let i = 0; i < lines.length; i++) {
        const own = leadingWsLen(lines[i]);
        for (const indent of [own, ...WRONG_INDENTS]) {
          asked++;
          const without = nestedParentPath(lines, i, indent);
          const withIndex = nestedParentPath(lines, i, indent, index);
          if (JSON.stringify(withIndex) !== JSON.stringify(without)) {
            disagreements.push(`${JSON.stringify(lines)} line ${i} indent ${indent}: ${JSON.stringify(withIndex)} against ${JSON.stringify(without)}`);
          }
        }
      }
    }
    expect(disagreements.slice(0, 3)).toEqual([]);
    expect(asked).toBe((28 * 1 + 28 ** 2 * 2 + 28 ** 3 * 3) * (1 + WRONG_INDENTS.length));
  });

  it("agrees on every line of every document of four lines over 28 kinds of line, at its own indent", () => {
    const disagreements: string[] = [];
    for (const lines of everyDocument(KINDS, 4)) {
      if (lines.length < 4) {
        continue;
      }
      const index = indexLineIndents(lines);
      for (let i = 0; i < lines.length; i++) {
        const own = leadingWsLen(lines[i]);
        if (JSON.stringify(nestedParentPath(lines, i, own, index)) !== JSON.stringify(nestedParentPath(lines, i, own))) {
          disagreements.push(`${JSON.stringify(lines)} line ${i}`);
        }
      }
    }
    expect(disagreements.slice(0, 3)).toEqual([]);
  }, 30000);

  it("agrees on 40,000 seeded documents of 5 to 24 lines", () => {
    const next = random(2026);
    const disagreements: string[] = [];
    let found = 0;
    for (let n = 0; n < 40000; n++) {
      const length = 5 + Math.floor(next() * 20);
      const lines = Array.from({ length }, () => KINDS[Math.floor(next() * KINDS.length)]);
      const index = indexLineIndents(lines);
      for (let i = 0; i < lines.length; i++) {
        const own = leadingWsLen(lines[i]);
        const without = nestedParentPath(lines, i, own);
        const withIndex = nestedParentPath(lines, i, own, index);
        if (without !== null) {
          found++;
        }
        if (JSON.stringify(withIndex) !== JSON.stringify(without)) {
          disagreements.push(`${JSON.stringify(lines)} line ${i}: ${JSON.stringify(withIndex)} against ${JSON.stringify(without)}`);
        }
      }
    }
    expect(disagreements.slice(0, 3)).toEqual([]);
    expect(found).toBeGreaterThan(1000); // the corpus reaches real paths, not only `null`
  });

  it("resolves a deep chain of containers, and the paths it returns are fresh arrays", () => {
    const lines = ["format:", "  html:", "    theme:", "      light:", "        x: 1", "        y: 2"];
    const index = indexLineIndents(lines);
    expect(nestedParentPath(lines, 4, 8, index)).toEqual(["format", "html", "theme", "light"]);
    const first = nestedParentPath(lines, 4, 8, index)!;
    first.push("mutated");
    expect(nestedParentPath(lines, 5, 8, index)).toEqual(["format", "html", "theme", "light"]);
  });
});
