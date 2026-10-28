export type ColumnKind = "list" | "definition";

/**
 * The stack of container content columns `computeRegions` keeps while it scans a document (Session 331).
 *
 * Before this class the stack was three parallel arrays, and every question a line asked of it was a scan: does a list column exist, does a list sit under a parent at this column, is everything deeper than
 * this column a list, which column is the innermost, how many entries are at or below a column, and the `[0, ...contentColumns]` copies the helpers took. A line that opens a container column and pops nothing (a
 * definition marker, a footnote definition, and the list markers the model over-accepts) leaves one more entry, so N such lines left N entries and N lines cost N(N + 1)/2 steps (the BACKLOG item "More quadratic
 * and stack-overflow shapes found by Session 319's sweep and review", part (1)).
 *
 * The entries are kept EXACTLY as before, in the order they were pushed, because a pop takes the top entry and stops at the first one that is not deeper than the line: a stack [4, 6, 4] loses its 6 only when it is
 * on top. What is new is an aggregate kept with every push and pop that answers each question without a scan:
 *
 *   - `definitionMax[i]` and `lastCommonmark[i]` are prefix aggregates (the deepest definition column, and the latest commonmark entry, among the entries up to and including i), which a pop discards with the entry;
 *   - `listParents` counts the list entries by the column of the entry BELOW them (0 for the bottom one), which is what a sibling marker is compared with;
 *   - `held` and `heldCommonmark` count the entries by column, and `columns()` hands out the DISTINCT columns, because every helper that takes the columns (`indentedCodeLine`, `containerContentColumn`, the setext and
 *     ATX rows, the fence and quote readers) reads them as a SET: the deepest column at or below a given one, the deepest of all, membership, or whether there are any. Session 331 checked that two ways: each helper was
 *     classified from its code by independent readers, and the whole unit suite and 100,000 generated documents were run with every helper handed a deduplicated, reversed copy of its array and gave the same answers. Two
 *     CONSUMERS of a fence candidate's columns are not set readers in the strict sense and cost nothing for it: `makeConsumedCloserLine` keys its scan memo on the array's text (the same set in another order only misses
 *     the memo) and `hasCloserBelow` spreads it into `Math.max`.
 *
 * `columns()` and `commonmarkColumns()` return a SNAPSHOT: the array is rebuilt, never edited, when the set of columns changes, so a caller that kept an earlier one keeps what it saw (`computeRegions` uses each before the
 * next push or pop, and a quote keeps a fresh `columnsAtOrBelow` array). They are the same array until a column enters or leaves the set, which is why a run of lines that push the same column costs nothing per line.
 * What stays linear is the per-line cost in the number of DISTINCT columns open (the helpers scan the snapshot), which is at most about the square root of the document's size: 750 nested bullets and then 40,000 `: a` lines
 * take 0.8 s.
 */
export class ColumnStack {
  private readonly cols: number[] = [];
  private readonly kinds: ColumnKind[] = [];
  private readonly commonmark: boolean[] = [];
  private readonly definitionMax: number[] = [];
  private readonly lastCommonmark: number[] = [];
  private readonly listParents = new Map<number, number>();
  private readonly held = new Map<number, number>();
  private readonly heldCommonmark = new Map<number, number>();
  private distinct: readonly number[] | null = null;
  private distinctCommonmark: readonly number[] | null = null;

  /** How many entries the stack holds: the container depth, which counts every entry, not every distinct column. */
  get length(): number {
    return this.cols.length;
  }

  push(column: number, kind: ColumnKind, commonmark: boolean): void {
    const at = this.cols.length;
    if (kind === "list") {
      const parent = at === 0 ? 0 : this.cols[at - 1];
      this.listParents.set(parent, (this.listParents.get(parent) ?? 0) + 1);
    }
    const definitionBelow = at === 0 ? -1 : this.definitionMax[at - 1];
    this.definitionMax.push(kind === "definition" && column > definitionBelow ? column : definitionBelow);
    this.lastCommonmark.push(commonmark ? at : at === 0 ? -1 : this.lastCommonmark[at - 1]);
    this.cols.push(column);
    this.kinds.push(kind);
    this.commonmark.push(commonmark);
    if (this.hold(this.held, column)) {
      this.distinct = null;
    }
    if (commonmark && this.hold(this.heldCommonmark, column)) {
      this.distinctCommonmark = null;
    }
  }

  /** Removes the top entry; on an empty stack it does nothing, as popping an empty array did. */
  pop(): void {
    const at = this.cols.length - 1;
    if (at < 0) {
      return;
    }
    const column = this.cols.pop() as number;
    const kind = this.kinds.pop();
    const commonmark = this.commonmark.pop();
    this.definitionMax.pop();
    this.lastCommonmark.pop();
    if (kind === "list") {
      const parent = at === 0 ? 0 : this.cols[at - 1];
      this.release(this.listParents, parent);
    }
    if (this.release(this.held, column)) {
      this.distinct = null;
    }
    if (commonmark === true && this.release(this.heldCommonmark, column)) {
      this.distinctCommonmark = null;
    }
  }

  /** The container pop: removes entries from the top while the top one is deeper than `column`. */
  popAbove(column: number): void {
    while (this.cols.length > 0 && this.cols[this.cols.length - 1] > column) {
      this.pop();
    }
  }

  /** Whether the top entry was opened by a list marker (false for an empty stack). */
  topIsList(): boolean {
    return this.kinds[this.kinds.length - 1] === "list";
  }

  /** The column of the top entry, or 0 for an empty stack. */
  topColumn(): number {
    return this.cols.length > 0 ? this.cols[this.cols.length - 1] : 0;
  }

  /** Whether any entry was opened by a list marker. */
  hasList(): boolean {
    // `listParents` holds a key exactly while a list entry sits above that column.
    return this.listParents.size > 0;
  }

  /** Whether some list entry sits directly on `column`, that is, the entry below it (or the page edge, 0) is at `column`: the column at which an open list would take a sibling marker. */
  hasListSiblingAt(column: number): boolean {
    return (this.listParents.get(column) ?? 0) > 0;
  }

  /** Whether every entry deeper than `column` is a list entry (true for an empty stack). `column` is a line's indent, 0 or more: the "none" of `definitionMax` is -1. */
  deeperAreAllLists(column: number): boolean {
    return this.cols.length === 0 || this.definitionMax[this.cols.length - 1] <= column;
  }

  /** How many ENTRIES (repeats count) sit at or below `column`. */
  countAtOrBelow(column: number): number {
    let count = 0;
    for (const [held, times] of this.held) {
      if (held <= column) {
        count += times;
      }
    }
    return count;
  }

  /** The column of the latest commonmark entry among the first `entries` entries, or 0 when there is none; `entries` beyond the depth read the whole stack. */
  innermostCommonmarkAmong(entries: number): number {
    const among = Math.min(entries, this.cols.length);
    if (among <= 0) {
      return 0;
    }
    const at = this.lastCommonmark[among - 1];
    return at >= 0 ? this.cols[at] : 0;
  }

  /** The distinct columns, in no stated order. The same array until a column enters or leaves the set; never edited. */
  columns(): readonly number[] {
    this.distinct ??= Array.from(this.held.keys());
    return this.distinct;
  }

  /** The distinct columns of the commonmark entries only, with the same guarantees as `columns`. */
  commonmarkColumns(): readonly number[] {
    this.distinctCommonmark ??= Array.from(this.heldCommonmark.keys());
    return this.distinctCommonmark;
  }

  /** The distinct columns at or below `column`, as a fresh array. */
  columnsAtOrBelow(column: number): number[] {
    return this.columns().filter((c) => c <= column);
  }

  // Both return whether the SET of keys changed.
  private hold(counts: Map<number, number>, key: number): boolean {
    const before = counts.get(key);
    counts.set(key, (before ?? 0) + 1);
    return before === undefined;
  }

  private release(counts: Map<number, number>, key: number): boolean {
    const before = counts.get(key) as number;
    if (before > 1) {
      counts.set(key, before - 1);
      return false;
    }
    counts.delete(key);
    return true;
  }
}
