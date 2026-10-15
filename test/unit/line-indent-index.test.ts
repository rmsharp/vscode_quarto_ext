import { describe, expect, it, vi } from "vitest";
import * as yamlContext from "../../src/core/yaml-context";
import { indexLineIndents, leadingWsLen, nestedParentPath } from "../../src/core/yaml-context";
import { findNestedFrontMatterValueLines } from "../../src/core/yaml-frontmatter-nested-values";

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
// blank to `trim()` and has no leading spaces or tabs; a no-break space before a `#` or a key is NOT an indent, so those lines are content at column 0), comments at every indent, tab and mixed indents, scalars, a block scalar, sequence items,
// and the containers that decide the path (`format` and `execute`, a root that is not `format`).
const KINDS: string[] = [
  "",
  "  ",
  "\t",
  NBSP,
  `${NBSP}# c`,
  `${NBSP}k:`,
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

  it(`agrees with the scan on every content line of every document of up to four lines over ${KINDS.length} kinds of line (about 840,000 documents)`, () => {
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
    expect(documents).toBe(KINDS.length + KINDS.length ** 2 + KINDS.length ** 3 + KINDS.length ** 4);
    expect(lineCount).toBe(KINDS.length * 1 + KINDS.length ** 2 * 2 + KINDS.length ** 3 * 3 + KINDS.length ** 4 * 4);
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
  it(`agrees on every line of every document of up to three lines over ${KINDS.length} kinds of line, at its own indent and at others`, () => {
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
    expect(asked).toBe((KINDS.length * 1 + KINDS.length ** 2 * 2 + KINDS.length ** 3 * 3) * (1 + WRONG_INDENTS.length));
  });

  it(`agrees on every line of every document of four lines over ${KINDS.length} kinds of line, at its own indent`, () => {
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

describe("findNestedFrontMatterValueLines builds the index only when a nested line needs it (Session 314)", () => {
  // The index costs about 35 ns a line, and a front matter of column-0 keys (the commonest kind) never asks the ancestor walk anything: building it there was a 24 to
  // 27 percent slowdown of the enumerator (a review's measurement; 8 to 9 percent end to end through the engine resolver, about 0.5 microseconds at 10 lines). It is built
  // the first time a nested line needs a container, and once.
  const built = (text: string): number => {
    const spy = vi.spyOn(yamlContext, "indexLineIndents");
    try {
      findNestedFrontMatterValueLines(text);
      return spy.mock.calls.length;
    } finally {
      spy.mockRestore();
    }
  };

  it("builds it once for a document with nested lines (this row shows the spy sees the call)", () => {
    expect(built("---\nformat:\n  html:\n    toc: true\n    code-fold: true\n---\n\ntext\n")).toBe(1);
  });

  it("builds none for a front matter of column-0 keys", () => {
    expect(built("---\ntitle: t\nauthor: a\ntoc: true\n---\n\ntext\n")).toBe(0);
  });

  it("builds none for a front matter whose only indented lines are sequence items or inside a flow value", () => {
    expect(built("---\ntitle: t\nkeywords:\n  - a\n  - b\nlist: [a,\n  b]\n---\n\ntext\n")).toBe(0);
  });

  it("builds none when there is no front matter", () => {
    expect(built("# Title\n\n  indented prose\n")).toBe(0);
  });
});

describe("rows a review round of Session 314 found the index tests did not pin", () => {
  it("climbs past a SIBLING of an ancestor: a key between the hops is not the next container", () => {
    // `toc: true` sits at the indent of `theme:` and above it. A climb that keeps the FIRST hop's indent for the second hop scans for a line shallower than
    // `light` and finds `toc: true`, a scalar, so it would answer `null`; the right second hop asks for a line shallower than `theme`.
    const lines = ["format:", "  html:", "    toc: true", "    theme:", "      light:", "        x: 1"];
    const index = indexLineIndents(lines);
    for (const given of [index, undefined]) {
      expect(nestedParentPath(lines, 5, 8, given)).toEqual(["format", "html", "theme", "light"]);
    }
  });

  it("keeps an indent of 200 and of 40,000 spaces, and a pointer past 32,767", () => {
    // The typed arrays are 32-bit: an 8-bit indent would read 200 as -56, a 16-bit one 40,000 as -25,536 and a 16-bit pointer 33,000 as -32,536.
    const wide = indexLineIndents(["a:", `${" ".repeat(200)}k:`, `${" ".repeat(40000)}k:`]);
    expect(Array.from(wide.indent)).toEqual([0, 200, 40000]);
    expect(Array.from(wide.shallower)).toEqual([-1, 0, 1]);
    const far = indexLineIndents([...Array.from({ length: 33000 }, () => "# c"), "a:", "  b: v"]);
    expect(far.shallower[33001]).toBe(33000);
    expect(far.indent[33001]).toBe(2);
  });

  it("returns a fresh path for a ONE-level container, and every enumerated line gets its own parentPath", () => {
    const lines = ["execute:", "  echo: v", "  eval: v"];
    const index = indexLineIndents(lines);
    const first = nestedParentPath(lines, 1, 2, index)!;
    first.push("mutated");
    expect(nestedParentPath(lines, 2, 2, index)).toEqual(["execute"]);
    const entries = findNestedFrontMatterValueLines("---\nexecute:\n  echo: v\n  eval: v\n---\n\ntext\n");
    expect(entries).toHaveLength(2);
    expect(entries[0].parentPath).not.toBe(entries[1].parentPath);
    entries[0].parentPath.push("mutated");
    expect(entries[1].parentPath).toEqual(["execute"]);
  });

  it("a no-break space before a `#` or a key is not an indent: such a line is content at column 0 to the walk, and the enumerator reads the line below it as nested under nothing", () => {
    // The enumerator skips a line whose `trim()` starts with `#` as a comment, while the ancestor walk (the old scan and the index alike) reads a comment after spaces and
    // tabs only: the line below an NBSP-led comment inside a container finds a column-0 line that is no container. Pre-existing and identical in the parent: a lost
    // diagnostic, never an invented one (filed in BACKLOG).
    const plain = findNestedFrontMatterValueLines("---\nformat:\n  # c\n  toc: banana\n---\n\ntext\n");
    const withNbsp = findNestedFrontMatterValueLines(`---\nformat:\n ${NBSP}# c\n  toc: banana\n---\n\ntext\n`);
    expect(plain.map((entry) => entry.key)).toEqual(["toc"]);
    expect(withNbsp).toEqual([]);
  });
});
