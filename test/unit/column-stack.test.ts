import { describe, expect, it } from "vitest";
import { ColumnStack, type ColumnKind } from "../../src/core/qmd/column-stack";

// Session 331 — the stack of container content columns `computeRegions` keeps (BACKLOG item "More quadratic and stack-overflow shapes found by Session 319's sweep and review", part (1)).
// Before this session the stack was three parallel arrays and every question a line asked of it was a scan: `columnKinds.includes("list")`, a `.some` over the parent columns of the list entries, a `.every` over the entries deeper than the line,
// the `[0, ...contentColumns]` spreads, `filter`, and a count. A run of N lines that each push and nothing pops left N entries, so N lines were N(N + 1)/2 steps. `ColumnStack` keeps the same entries in the same order and answers each of
// those questions from an aggregate kept at push and pop; this file holds the plain arrays and the old expressions as the REFERENCE and asks both the same questions after every operation sequence it can enumerate.

class Reference {
  columnsList: number[] = [];
  kinds: ColumnKind[] = [];
  commonmark: boolean[] = [];
  get length(): number {
    return this.columnsList.length;
  }
  push(column: number, kind: ColumnKind, commonmark: boolean): void {
    this.columnsList.push(column);
    this.kinds.push(kind);
    this.commonmark.push(commonmark);
  }
  pop(): void {
    this.columnsList.pop();
    this.kinds.pop();
    this.commonmark.pop();
  }
  // The pop loop of the container block: `while (contentColumns.length > 0 && contentColumns[contentColumns.length - 1] > indentWidth)`.
  popAbove(column: number): void {
    while (this.columnsList.length > 0 && this.columnsList[this.columnsList.length - 1] > column) {
      this.pop();
    }
  }
  topIsList(): boolean {
    return this.kinds[this.kinds.length - 1] === "list";
  }
  // The quote stash's `hostColumn`: `outerColumns.columns.length > 0 ? outerColumns.columns[outerColumns.columns.length - 1] : 0`.
  topColumn(): number {
    return this.columnsList.length > 0 ? this.columnsList[this.columnsList.length - 1] : 0;
  }
  hasList(): boolean {
    return this.kinds.includes("list");
  }
  hasListSiblingAt(column: number): boolean {
    return this.columnsList.some((_, idx) => this.kinds[idx] === "list" && (idx === 0 ? 0 : this.columnsList[idx - 1]) === column);
  }
  deeperAreAllLists(column: number): boolean {
    return this.columnsList.every((c, idx) => c <= column || this.kinds[idx] === "list");
  }
  countAtOrBelow(column: number): number {
    return this.columnsList.filter((c) => c <= column).length;
  }
  innermostCommonmarkAmong(entries: number): number {
    let innermost = 0;
    for (let c = entries - 1; c >= 0; c--) {
      if (this.commonmark[c]) {
        innermost = this.columnsList[c];
        break;
      }
    }
    return innermost;
  }
  commonmarkColumns(): number[] {
    return this.columnsList.filter((_, k) => this.commonmark[k]);
  }
  columnsAtOrBelow(column: number): number[] {
    return this.columnsList.filter((c) => c <= column);
  }
}

type Op = { name: string; apply: (stack: { push(c: number, k: ColumnKind, m: boolean): void; pop(): void; popAbove(c: number): void; length: number }) => void };

const sorted = (values: readonly number[]): number[] => [...values].sort((a, b) => a - b);
const distinct = (values: readonly number[]): number[] => sorted([...new Set(values)]);
const MAX_COLUMN = 13;

// Everything a line can ask, for every column a line can sit at. The set-valued answers are compared as sets: the reference holds every entry, the stack each distinct column once, and the readers of those answers (`indentedCodeLine`
// and the other helpers) look only at which columns are there.
const answers = (stack: ColumnStack, reference: Reference): { got: unknown; want: unknown } => {
  const got: Record<string, unknown> = { length: stack.length, topColumn: stack.topColumn() };
  const want: Record<string, unknown> = { length: reference.length, topColumn: reference.topColumn() };
  if (reference.length > 0) {
    got.topIsList = stack.topIsList();
    want.topIsList = reference.topIsList();
  }
  got.hasList = stack.hasList();
  want.hasList = reference.hasList();
  for (let column = 0; column <= MAX_COLUMN; column++) {
    got[`sibling@${column}`] = stack.hasListSiblingAt(column);
    want[`sibling@${column}`] = reference.hasListSiblingAt(column);
    got[`allLists@${column}`] = stack.deeperAreAllLists(column);
    want[`allLists@${column}`] = reference.deeperAreAllLists(column);
    got[`count@${column}`] = stack.countAtOrBelow(column);
    want[`count@${column}`] = reference.countAtOrBelow(column);
    got[`atOrBelow@${column}`] = sorted(stack.columnsAtOrBelow(column));
    want[`atOrBelow@${column}`] = distinct(reference.columnsAtOrBelow(column));
  }
  for (let entries = 0; entries <= reference.length + 2; entries++) {
    got[`innermost@${entries}`] = stack.innermostCommonmarkAmong(entries);
    want[`innermost@${entries}`] = reference.innermostCommonmarkAmong(entries);
  }
  got.columns = sorted(stack.columns());
  want.columns = distinct(reference.columnsList);
  got.commonmarkColumns = sorted(stack.commonmarkColumns());
  want.commonmarkColumns = distinct(reference.commonmarkColumns());
  return { got, want };
};

// The operations: a push of each column in `columns` with each kind and each flag, a pop, and a pop-above at each column.
const operations = (columns: readonly number[], above: readonly number[]): Op[] => {
  const ops: Op[] = [];
  for (const column of columns) {
    for (const kind of ["list", "definition"] as const) {
      for (const commonmark of [false, true]) {
        ops.push({ name: `push(${column},${kind},${commonmark})`, apply: (s) => s.push(column, kind, commonmark) });
      }
    }
  }
  ops.push({ name: "pop", apply: (s) => (s.length > 0 ? s.pop() : undefined) });
  for (const column of above) {
    ops.push({ name: `popAbove(${column})`, apply: (s) => s.popAbove(column) });
  }
  return ops;
};

describe("Session 331 — ColumnStack answers every question as the plain arrays did", () => {
  it("agrees after every sequence of up to four operations over columns 1 to 3 (an exhaustive enumeration)", () => {
    const ops = operations([1, 2, 3], [0, 1, 2, 3]);
    let sequences = 0;
    const walk = (history: Op[], depth: number): void => {
      const stack = new ColumnStack();
      const reference = new Reference();
      for (const op of history) {
        op.apply(stack);
        op.apply(reference);
      }
      const { got, want } = answers(stack, reference);
      expect({ history: history.map((op) => op.name), got }).toEqual({ history: history.map((op) => op.name), got: want });
      sequences++;
      if (depth > 0) {
        for (const op of ops) {
          walk([...history, op], depth - 1);
        }
      }
    };
    walk([], 4);
    expect(sequences).toBe(1 + 17 + 17 ** 2 + 17 ** 3 + 17 ** 4);
  }, 120_000);

  it("agrees after each operation of 15,000 seeded random sequences of up to 50 operations over columns 0 to 12", () => {
    let state = 331;
    const rnd = (): number => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const columns = Array.from({ length: 13 }, (_, k) => k);
    const ops = operations(columns, columns);
    for (let run = 0; run < 15_000; run++) {
      const stack = new ColumnStack();
      const reference = new Reference();
      const history: string[] = [];
      const steps = 1 + Math.floor(rnd() * 50);
      for (let step = 0; step < steps; step++) {
        const op = ops[Math.floor(rnd() * ops.length)];
        op.apply(stack);
        op.apply(reference);
        history.push(op.name);
        const { got, want } = answers(stack, reference);
        if (JSON.stringify(got) !== JSON.stringify(want)) {
          expect({ history, got }).toEqual({ history, got: want });
        }
      }
    }
  }, 300_000);
});

describe("Session 331 — ColumnStack hands out the distinct columns as a snapshot", () => {
  it("holds each column once however many entries hold it, and keeps the same array while nothing changes", () => {
    const stack = new ColumnStack();
    stack.push(4, "definition", true);
    stack.push(4, "definition", true);
    stack.push(4, "definition", true);
    expect(stack.length).toBe(3);
    expect(stack.columns()).toEqual([4]);
    expect(stack.columns()).toBe(stack.columns());
    expect(stack.commonmarkColumns()).toBe(stack.commonmarkColumns());
  });

  it("does not change an array it already handed out when the stack changes afterwards", () => {
    const stack = new ColumnStack();
    stack.push(4, "definition", true);
    const before = stack.columns();
    const commonmarkBefore = stack.commonmarkColumns();
    stack.push(6, "list", false);
    stack.pop();
    stack.pop();
    expect(before).toEqual([4]);
    expect(commonmarkBefore).toEqual([4]);
    expect(stack.columns()).toEqual([]);
  });

  it("keeps a column while one entry still holds it and drops it when the last entry goes", () => {
    const stack = new ColumnStack();
    stack.push(4, "definition", true);
    stack.push(6, "definition", true);
    stack.push(4, "definition", true);
    stack.pop();
    expect(sorted(stack.columns())).toEqual([4, 6]);
    stack.popAbove(5);
    expect(sorted(stack.columns())).toEqual([4]);
    expect(stack.length).toBe(1);
  });
});

describe("Session 331 — ColumnStack answers a line in time that does not depend on how many entries the stack holds", () => {
  it("answers the questions of 200,000 lines against a stack of 200,000 entries in under a second", () => {
    const stack = new ColumnStack();
    const started = Date.now();
    for (let i = 0; i < 200_000; i++) {
      stack.push(i % 2 === 0 ? 4 : 3, i % 2 === 0 ? "definition" : "list", true);
    }
    let checksum = 0;
    for (let i = 0; i < 200_000; i++) {
      checksum += (stack.hasList() ? 1 : 0) + (stack.hasListSiblingAt(i % 8) ? 1 : 0) + (stack.deeperAreAllLists(i % 8) ? 1 : 0) + stack.columns().length + stack.commonmarkColumns().length + stack.innermostCommonmarkAmong(stack.length);
    }
    const ms = Date.now() - started;
    expect(checksum).toBeGreaterThan(0);
    expect(ms).toBeLessThan(1000);
  }, 60_000);
});
