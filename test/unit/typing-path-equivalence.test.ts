import { describe, expect, it } from "vitest";
import { cellBackgroundRanges } from "../../src/core/cell-background";
import { findCellAtPosition } from "../../src/core/qmd/model";
import {
  TYPING_DEBOUNCE_MS,
  createCellContextScheduler,
  createKeyedDebouncer,
} from "../../src/core/typing-debounce";
import { type FakeClock, createFakeClock } from "./support/fake-timers";
import { seededRandom } from "./support/regex-equivalence";

const HEAVY_ROW_MS = 120_000;

// Session 342 -- the BACKLOG item "What Session 341's review round found beside the Outline and preview cures", part (4). The cure delays the typing path's work, so what has to hold is not "the same calls" but "the
// same ANSWER once the work has run, and never a stale answer where the old code was fresh without a keystroke in between": the cell-context key and the cell tint, after the schedulers have caught up, are what the old
// per-event handlers left, for EVERY sequence of edits, cursor moves, editor switches and pauses.
//
// The OLD spelling is kept here, copied VERBATIM from the base `10e6b9c` (`src/features/execution.ts`: `updateCellContext` and the three handlers; `src/features/cell-background.ts`: `refresh` and the document handler),
// run against fake editors of the shape VS Code gives (`document.languageId`, `getText()`, `selection.active.line`, `uri.toString()`), as the ORACLE (Learning 738): the source's functions are respelled on top of the
// schedulers, so they could not stand as their own oracle. The NEW wiring below is a copy of how the two adapters call the schedulers; `s342-typing-wiring-pin.test.ts` pins, from the syntax tree, that the adapters
// are spelled the way this copy assumes.
//
// The properties, checked after EVERY event of every sequence:
//   P1 once no timer is pending, the last value the new wiring set is the oracle's last value, and both are the truth worked out from how the document was built (not by `findCellAtPosition`);
//   P2 a timer is pending only if the state it will evaluate has not been evaluated, it is the only timer of the key, and a pause of the delay runs it;
//   P3 the new wiring evaluates no more often than the oracle;
// and over a whole enumeration: some sequences end with a pending timer (the delay is reached), some save evaluations (the debounce does something), and none of those two is all of them.

/** The truth about the document the model builds: `pad` lines of prose, then a python cell on `pad..pad+2`, a prose line, an r cell on `pad+4..pad+6`, where `pad` is the version modulo three. */
const padOf = (version: number): number => version % 3;
function textOf(version: number): string {
  const lines = [...Array<string>(padOf(version)).fill("prose"), "```{python}", "x = 1", "```", "prose", "```{r}", "y <- 2", "```"];
  return lines.join("\n");
}
const cellLines = (version: number): Array<[number, number]> => [
  [padOf(version), padOf(version) + 2],
  [padOf(version) + 4, padOf(version) + 6],
];
const inCellBy = (version: number, line: number): boolean => cellLines(version).some(([from, to]) => line >= from && line <= to);

/** A document of the shape VS Code gives, with a version that an edit bumps. */
interface FakeDocument {
  languageId: string;
  version: number;
  getText(): string;
  uri: { toString(): string };
}
interface FakeEditor {
  document: FakeDocument;
  selection: { active: { line: number } };
}

function fakeDocument(key: string, languageId: string): FakeDocument {
  const doc: FakeDocument = { languageId, version: 1, getText: () => textOf(doc.version), uri: { toString: () => key } };
  return doc;
}
function fakeEditor(document: FakeDocument): FakeEditor {
  return { document, selection: { active: { line: 0 } } };
}

// ---- THE CELL-CONTEXT KEY ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

type KeyEvent = "type A" | "edit A" | "move A" | "type B" | "move B" | "switch to A" | "switch to B" | "switch to none" | "pause 60" | "pause 200";
const KEY_EVENTS: readonly KeyEvent[] = ["type A", "edit A", "move A", "type B", "move B", "switch to A", "switch to B", "switch to none", "pause 60", "pause 200"];

/** One run of the editors, the OLD wiring and the NEW wiring side by side on the same state. */
function keyWorld(languageOfB: string) {
  const docA = fakeDocument("file:///a.qmd", "quarto");
  const docB = fakeDocument("file:///b.qmd", languageOfB);
  const editorA = fakeEditor(docA);
  const editorB = fakeEditor(docB);
  let activeTextEditor: FakeEditor | undefined = editorA;
  const oldLog: boolean[] = [];
  const newLog: boolean[] = [];

  // ---- The OLD spelling, copied VERBATIM from the base `10e6b9c` (`src/features/execution.ts`), with `vscode.window.activeTextEditor` read from the model and `executeCommand("setContext", ...)` written to a log. ----
  function oldUpdateCellContext(editor: FakeEditor | undefined): void {
    // Only the active editor drives the global context key; ignore selection
    // events from background editors, which would otherwise clobber it.
    if (editor !== undefined && editor !== activeTextEditor) {
      return;
    }
    const inCell =
      editor !== undefined &&
      editor.document.languageId === "quarto" &&
      findCellAtPosition(
        editor.document.getText(),
        editor.selection.active.line,
      ) !== null;
    oldLog.push(inCell);
  }
  const oldOnSelection = (e: { textEditor: FakeEditor }): void => oldUpdateCellContext(e.textEditor);
  const oldOnActiveEditor = (editor: FakeEditor | undefined): void => oldUpdateCellContext(editor);
  const oldOnDocument = (e: { document: FakeDocument }): void => {
    const active = activeTextEditor;
    if (active && e.document === active.document) {
      oldUpdateCellContext(active);
    }
  };

  // ---- The NEW wiring: how `registerExecutionFeature` calls the scheduler. ----
  const clock = createFakeClock();
  function updateCellContext(): void {
    const editor = activeTextEditor;
    const inCell =
      editor !== undefined &&
      editor.document.languageId === "quarto" &&
      findCellAtPosition(
        editor.document.getText(),
        editor.selection.active.line,
      ) !== null;
    newLog.push(inCell);
  }
  const scheduler = createCellContextScheduler({
    timers: clock,
    delayMs: TYPING_DEBOUNCE_MS,
    activeSnapshot: () => (activeTextEditor === undefined ? undefined : { key: activeTextEditor.document.uri.toString(), version: activeTextEditor.document.version }),
    evaluate: updateCellContext,
  });
  const newOnSelection = (e: { textEditor: FakeEditor }): void => {
    if (e.textEditor === activeTextEditor) scheduler.changed();
  };
  const newOnActiveEditor = (): void => scheduler.evaluateNow();
  const newOnDocument = (e: { document: FakeDocument }): void => {
    const active = activeTextEditor;
    if (active && e.document === active.document) scheduler.changed();
  };

  // activation
  oldUpdateCellContext(activeTextEditor);
  scheduler.evaluateNow();

  const edit = (doc: FakeDocument): void => {
    doc.version++;
    oldOnDocument({ document: doc });
    newOnDocument({ document: doc });
  };
  const move = (editor: FakeEditor): void => {
    editor.selection.active.line = (editor.selection.active.line + 3) % 10;
    oldOnSelection({ textEditor: editor });
    newOnSelection({ textEditor: editor });
  };
  const switchTo = (editor: FakeEditor | undefined): void => {
    activeTextEditor = editor;
    oldOnActiveEditor(editor);
    newOnActiveEditor();
  };

  function apply(event: KeyEvent): void {
    switch (event) {
      case "type A":
        edit(docA);
        move(editorA);
        return;
      case "edit A":
        edit(docA);
        return;
      case "move A":
        move(editorA);
        return;
      case "type B":
        edit(docB);
        move(editorB);
        return;
      case "move B":
        move(editorB);
        return;
      case "switch to A":
        switchTo(editorA);
        return;
      case "switch to B":
        switchTo(editorB);
        return;
      case "switch to none":
        switchTo(undefined);
        return;
      case "pause 60":
        clock.advance(60);
        return;
      case "pause 200":
        clock.advance(200);
        return;
    }
  }

  /** The truth about the key, worked out from how the documents are built. */
  function truth(): boolean {
    return activeTextEditor !== undefined && activeTextEditor.document.languageId === "quarto" && inCellBy(activeTextEditor.document.version, activeTextEditor.selection.active.line);
  }

  return { clock, apply, oldLog, newLog, truth, pending: () => clock.pending() };
}

/** Run `events` and return what is wrong after any of them, the numbers the enumeration totals, and the final state. */
function checkKeySequence(events: readonly KeyEvent[], languageOfB: string): { problems: string[]; pendingAtEnd: boolean; saved: number } {
  const w = keyWorld(languageOfB);
  const problems: string[] = [];
  const at = (i: number): string => `after [${events.slice(0, i + 1).join(", ")}]`;
  for (let i = 0; i < events.length; i++) {
    w.apply(events[i]);
    const last = <T,>(xs: T[]): T | undefined => xs[xs.length - 1];
    if (w.pending() === 0) {
      if (last(w.newLog) !== last(w.oldLog)) problems.push(`${at(i)}: no timer pending and the new wiring's key is ${String(last(w.newLog))}, the oracle's ${String(last(w.oldLog))}`);
      if (last(w.oldLog) !== w.truth()) problems.push(`${at(i)}: the oracle's key ${String(last(w.oldLog))} is not the truth ${String(w.truth())}`);
    }
    if (w.pending() > 1) problems.push(`${at(i)}: ${w.pending()} timers pending, not at most one`);
    if (w.newLog.length > w.oldLog.length) problems.push(`${at(i)}: the new wiring evaluated ${w.newLog.length} times, the oracle ${w.oldLog.length}`);
    if (events[i] === "pause 200" && w.pending() !== 0) problems.push(`${at(i)}: a pause of 200 ms left a timer pending`);
  }
  // A pause long enough ends every sequence in the caught-up state.
  const pendingAtEnd = w.pending() > 0;
  w.apply("pause 200");
  if (w.pending() !== 0) problems.push(`after [${events.join(", ")}] and a pause: a timer is still pending`);
  if (w.newLog[w.newLog.length - 1] !== w.oldLog[w.oldLog.length - 1]) problems.push(`after [${events.join(", ")}] and a pause: the key is ${String(w.newLog[w.newLog.length - 1])}, the oracle's ${String(w.oldLog[w.oldLog.length - 1])}`);
  return { problems, pendingAtEnd, saved: w.oldLog.length - w.newLog.length };
}

/** Every sequence of exactly `length` events from `alphabet`, in lexicographic order of the alphabet. */
function* sequencesOf<T>(alphabet: readonly T[], length: number): Generator<T[]> {
  const indices = new Array<number>(length).fill(0);
  for (;;) {
    yield indices.map((i) => alphabet[i]);
    let place = length - 1;
    while (place >= 0 && indices[place] === alphabet.length - 1) {
      indices[place] = 0;
      place--;
    }
    if (place < 0) return;
    indices[place]++;
  }
}

/** The enumeration of every sequence of 5 events, run once for the two rows that read it. */
let keyTally: { sequences: number; pendingAtEnd: number; savedSome: number; problems: string[] } | undefined;
function keyEnumeration(): { sequences: number; pendingAtEnd: number; savedSome: number; problems: string[] } {
  if (keyTally === undefined) {
    const tally = { sequences: 0, pendingAtEnd: 0, savedSome: 0, problems: [] as string[] };
    for (const events of sequencesOf(KEY_EVENTS, 5)) {
      const r = checkKeySequence(events, "quarto");
      tally.sequences++;
      if (r.pendingAtEnd) tally.pendingAtEnd++;
      if (r.saved > 0) tally.savedSome++;
      if (r.problems.length > 0 && tally.problems.length < 5) tally.problems.push(...r.problems.slice(0, 2));
    }
    keyTally = tally;
  }
  return keyTally;
}

describe("Session 342 -- the cell-context key after the debounce is what the old per-event handlers left (the oracle: the base's updateCellContext and handlers, verbatim)", () => {
  it("the model is what the oracle and the truth are worked from: the cells of a version, and the key at the start", () => {
    expect(textOf(0).split("\n")).toEqual(["```{python}", "x = 1", "```", "prose", "```{r}", "y <- 2", "```"]);
    expect(textOf(1).split("\n")[0]).toBe("prose");
    expect(textOf(2).split("\n").slice(0, 3)).toEqual(["prose", "prose", "```{python}"]);
    expect(cellLines(2)).toEqual([[2, 4], [6, 8]]);
    expect(inCellBy(1, 0)).toBe(false);
    expect(inCellBy(1, 1)).toBe(true);
    expect(inCellBy(1, 4)).toBe(false); // the prose line between the cells
    expect(inCellBy(1, 5)).toBe(true);
    expect(inCellBy(1, 8)).toBe(false);
    const w = keyWorld("quarto");
    expect(w.oldLog).toEqual([false]); // the editor starts on line 0 of version 1: prose
    expect(w.newLog).toEqual([false]);
    expect(w.truth()).toBe(false);
  });

  it("agrees on EVERY sequence of 5 events from the ten (100,000 sequences, every prefix checked), the second document a Quarto document", () => {
    const tally = keyEnumeration();
    expect(tally.problems).toEqual([]);
    expect(tally.sequences).toBe(KEY_EVENTS.length ** 5);
    expect(tally.sequences).toBe(100_000);
  }, HEAVY_ROW_MS);

  it("the 100,000 sequences reach the debounce: a timer still waiting at the end in some, evaluations saved in some, and neither in every one", () => {
    const tally = keyEnumeration();
    expect(tally.pendingAtEnd).toBeGreaterThan(1_000);
    expect(tally.pendingAtEnd).toBeLessThan(tally.sequences);
    expect(tally.savedSome).toBeGreaterThan(1_000);
    expect(tally.savedSome).toBeLessThan(tally.sequences);
  }, HEAVY_ROW_MS);

  it("agrees on EVERY sequence of 4 events when the second document is not a Quarto document (its key is always false)", () => {
    let sequences = 0;
    const problems: string[] = [];
    for (const events of sequencesOf(KEY_EVENTS, 4)) {
      const r = checkKeySequence(events, "markdown");
      sequences++;
      if (r.problems.length > 0 && problems.length < 5) problems.push(...r.problems.slice(0, 2));
    }
    expect(problems).toEqual([]);
    expect(sequences).toBe(10_000);
  }, HEAVY_ROW_MS);

  it("agrees on 3,000 seeded sequences of 10 to 40 events (typing bursts weighted over the rest)", () => {
    const SEED = 342;
    const random = seededRandom(SEED);
    const weighted: KeyEvent[] = [...KEY_EVENTS, "type A", "type A", "type A", "type A", "edit A", "move A", "move A", "pause 60", "pause 60"];
    let longest = 0;
    let withBurst = 0;
    const problems: string[] = [];
    for (let n = 0; n < 3_000; n++) {
      const length = 10 + Math.floor(random() * 31);
      longest = Math.max(longest, length);
      const events: KeyEvent[] = [];
      for (let k = 0; k < length; k++) events.push(weighted[Math.floor(random() * weighted.length)]);
      if (events.join(",").includes("type A,type A,type A")) withBurst++;
      const r = checkKeySequence(events, random() < 0.5 ? "quarto" : "markdown");
      if (r.problems.length > 0 && problems.length < 5) problems.push(...r.problems.slice(0, 2));
    }
    expect(problems).toEqual([]);
    expect(longest).toBe(40);
    expect(withBurst).toBeGreaterThan(300);
  }, HEAVY_ROW_MS);
});

// ---- THE CELL TINT ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

type TintEvent = "edit A" | "edit B" | "switch editor" | "hide B" | "show B" | "close A" | "open A" | "reload" | "pause 60" | "pause 200";
const TINT_EVENTS: readonly TintEvent[] = ["edit A", "edit B", "switch editor", "hide B", "show B", "close A", "open A", "reload", "pause 60", "pause 200"];

/** The ranges the model's documents must be tinted with, worked out from how they are built. */
const truthRanges = (doc: FakeDocument): Array<{ startLine: number; endLine: number }> =>
  doc.languageId === "quarto" ? cellLines(doc.version).map(([startLine, endLine]) => ({ startLine, endLine })) : [];

function tintWorld() {
  const docA = fakeDocument("file:///a.qmd", "quarto");
  const docB = fakeDocument("file:///b.qmd", "quarto");
  let visible: FakeDocument[] = [docA, docB];
  const clock = createFakeClock();
  const oldApplied = new Map<string, Array<{ startLine: number; endLine: number }>>();
  const newApplied = new Map<string, Array<{ startLine: number; endLine: number }>>();
  let oldRefreshes = 0;
  let newRefreshes = 0;

  // ---- The OLD spelling, copied VERBATIM from the base `10e6b9c` (`src/features/cell-background.ts`): `cellBackgroundRangesFor` without the settings, `refresh`, and the document handler. ----
  const cellBackgroundRangesFor = (doc: FakeDocument): Array<{ startLine: number; endLine: number }> => {
    if (doc.languageId !== "quarto") {
      return [];
    }
    return cellBackgroundRanges(doc.getText());
  };
  const refreshInto = (into: Map<string, Array<{ startLine: number; endLine: number }>>): Map<string, Array<{ startLine: number; endLine: number }>> => {
    const applied = new Map<string, Array<{ startLine: number; endLine: number }>>();
    for (const editor of visible) {
      const ranges = cellBackgroundRangesFor(editor);
      into.set(editor.uri.toString(), ranges); // editor.setDecorations(this.decorationType, ranges);
      applied.set(editor.uri.toString(), ranges);
    }
    return applied;
  };
  const oldRefresh = (): void => {
    oldRefreshes++;
    refreshInto(oldApplied);
  };
  const isVisible = (doc: FakeDocument): boolean => visible.some((editor) => editor === doc);
  const oldOnDocument = (doc: FakeDocument): void => {
    if (isVisible(doc)) {
      oldRefresh();
    }
  };

  // ---- The NEW wiring: how `registerCellBackgroundFeature` calls the debouncer. ----
  const newRefresh = (): void => {
    newRefreshes++;
    refreshInto(newApplied);
  };
  const typing = createKeyedDebouncer({ timers: clock, delayMs: TYPING_DEBOUNCE_MS });
  const newOnDocument = (doc: FakeDocument): void => {
    if (isVisible(doc)) {
      typing.schedule(doc.uri.toString(), () => newRefresh());
    }
  };

  oldRefresh();
  newRefresh(); // the decorator's own first refresh

  const both = (immediate: () => void, immediateNew: () => void): void => {
    immediate();
    immediateNew();
  };
  function apply(event: TintEvent): void {
    switch (event) {
      case "edit A":
        docA.version++;
        oldOnDocument(docA);
        newOnDocument(docA);
        return;
      case "edit B":
        docB.version++;
        oldOnDocument(docB);
        newOnDocument(docB);
        return;
      case "switch editor": // onDidChangeActiveTextEditor: immediate
        both(oldRefresh, newRefresh);
        return;
      case "hide B":
        visible = visible.filter((d) => d !== docB);
        both(oldRefresh, newRefresh); // onDidChangeVisibleTextEditors
        return;
      case "show B":
        if (!isVisible(docB)) visible = [...visible, docB];
        both(oldRefresh, newRefresh);
        return;
      case "close A":
        visible = visible.filter((d) => d !== docA);
        both(oldRefresh, newRefresh); // the editor leaves the visible list
        typing.cancel(docA.uri.toString()); // onDidCloseTextDocument (the old code had no such handler)
        return;
      case "open A":
        if (!isVisible(docA)) visible = [docA, ...visible];
        both(oldRefresh, newRefresh);
        return;
      case "reload": // a colour setting changed: immediate
        both(oldRefresh, newRefresh);
        return;
      case "pause 60":
        clock.advance(60);
        return;
      case "pause 200":
        clock.advance(200);
        return;
    }
  }
  return {
    clock,
    apply,
    visible: () => visible,
    oldApplied,
    newApplied,
    refreshes: () => ({ old: oldRefreshes, new: newRefreshes }),
    dispose: () => typing.dispose(),
  };
}

function checkTintSequence(events: readonly TintEvent[]): { problems: string[]; pendingAtEnd: boolean; saved: number } {
  const w = tintWorld();
  const problems: string[] = [];
  const at = (i: number): string => `after [${events.slice(0, i + 1).join(", ")}]`;
  for (let i = 0; i < events.length; i++) {
    w.apply(events[i]);
    if (w.clock.pending() === 0) {
      for (const doc of w.visible()) {
        const key = doc.uri.toString();
        const truth = truthRanges(doc);
        if (JSON.stringify(w.newApplied.get(key)) !== JSON.stringify(w.oldApplied.get(key))) problems.push(`${at(i)}: no timer pending and ${key} is tinted ${JSON.stringify(w.newApplied.get(key))}, the oracle's ${JSON.stringify(w.oldApplied.get(key))}`);
        if (JSON.stringify(w.oldApplied.get(key)) !== JSON.stringify(truth)) problems.push(`${at(i)}: the oracle's tint of ${key} is not the truth ${JSON.stringify(truth)}`);
      }
    }
    if (w.clock.pending() > 2) problems.push(`${at(i)}: ${w.clock.pending()} timers pending, not at most one a document`);
    if (w.refreshes().new > w.refreshes().old) problems.push(`${at(i)}: the new wiring refreshed ${w.refreshes().new} times, the oracle ${w.refreshes().old}`);
    if (events[i] === "pause 200" && w.clock.pending() !== 0) problems.push(`${at(i)}: a pause of 200 ms left a timer pending`);
  }
  const pendingAtEnd = w.clock.pending() > 0;
  w.apply("pause 200");
  if (w.clock.pending() !== 0) problems.push(`after [${events.join(", ")}] and a pause: a timer is still pending`);
  for (const doc of w.visible()) {
    const key = doc.uri.toString();
    if (JSON.stringify(w.newApplied.get(key)) !== JSON.stringify(truthRanges(doc))) problems.push(`after [${events.join(", ")}] and a pause: ${key} is tinted ${JSON.stringify(w.newApplied.get(key))}, not ${JSON.stringify(truthRanges(doc))}`);
  }
  const { old, new: now } = w.refreshes();
  w.dispose();
  return { problems, pendingAtEnd, saved: old - now };
}

/** The enumeration of every sequence of 5 events, run once for the two rows that read it. */
let tintTally: { sequences: number; pendingAtEnd: number; savedSome: number; problems: string[] } | undefined;
function tintEnumeration(): { sequences: number; pendingAtEnd: number; savedSome: number; problems: string[] } {
  if (tintTally === undefined) {
    const tally = { sequences: 0, pendingAtEnd: 0, savedSome: 0, problems: [] as string[] };
    for (const events of sequencesOf(TINT_EVENTS, 5)) {
      const r = checkTintSequence(events);
      tally.sequences++;
      if (r.pendingAtEnd) tally.pendingAtEnd++;
      if (r.saved > 0) tally.savedSome++;
      if (r.problems.length > 0 && tally.problems.length < 5) tally.problems.push(...r.problems.slice(0, 2));
    }
    tintTally = tally;
  }
  return tintTally;
}

describe("Session 342 -- the cell tint after the debounce is what the old per-edit refresh left (the oracle: the base's refresh and document handler, verbatim)", () => {
  it("agrees on EVERY sequence of 5 events from the ten (100,000 sequences, every prefix checked)", () => {
    const tally = tintEnumeration();
    expect(tally.problems).toEqual([]);
    expect(tally.sequences).toBe(TINT_EVENTS.length ** 5);
    expect(tally.sequences).toBe(100_000);
  }, HEAVY_ROW_MS);

  it("the 100,000 sequences reach the debounce: a timer still waiting at the end in some, refreshes saved in some, and neither in every one", () => {
    const tally = tintEnumeration();
    expect(tally.pendingAtEnd).toBeGreaterThan(1_000);
    expect(tally.pendingAtEnd).toBeLessThan(tally.sequences);
    expect(tally.savedSome).toBeGreaterThan(1_000);
    expect(tally.savedSome).toBeLessThan(tally.sequences);
  }, HEAVY_ROW_MS);

  it("agrees on 3,000 seeded sequences of 10 to 40 events (edits weighted over the rest)", () => {
    const random = seededRandom(3422);
    const weighted: TintEvent[] = [...TINT_EVENTS, "edit A", "edit A", "edit A", "edit A", "edit B", "edit B", "pause 60", "pause 60"];
    const problems: string[] = [];
    for (let n = 0; n < 3_000; n++) {
      const length = 10 + Math.floor(random() * 31);
      const events: TintEvent[] = [];
      for (let k = 0; k < length; k++) events.push(weighted[Math.floor(random() * weighted.length)]);
      const r = checkTintSequence(events);
      if (r.problems.length > 0 && problems.length < 5) problems.push(...r.problems.slice(0, 2));
    }
    expect(problems).toEqual([]);
  }, HEAVY_ROW_MS);
});

// ---- THE DEBOUNCER AGAINST A MODEL OF ITS SPEC ------------------------------------------------------------------------------------------------------------------------------------------------

type DebounceOp = { op: "schedule"; key: string } | { op: "cancel"; key: string } | { op: "advance"; ms: number } | { op: "dispose" };

/** The spec of a keyed trailing debouncer as a plain model: a table of `{ due, order, label }`, a run log, a clock. No timers. */
function modelOfSpec(delayMs: number) {
  let now = 0;
  let order = 0;
  let disposed = false;
  const table = new Map<string, { due: number; order: number; label: string }>();
  const log: string[] = [];
  return {
    log,
    schedule(key: string, label: string): void {
      if (disposed) return;
      table.set(key, { due: now + delayMs, order: order++, label });
    },
    cancel(key: string): void {
      table.delete(key);
    },
    dispose(): void {
      disposed = true;
      table.clear();
    },
    advance(ms: number): void {
      const target = now + ms;
      const due = [...table.entries()].filter(([, entry]) => entry.due <= target).sort((a, b) => a[1].due - b[1].due || a[1].order - b[1].order);
      for (const [key, entry] of due) {
        table.delete(key);
        log.push(`${key}:${entry.label}`);
      }
      now = target;
    },
    pending: () => table.size,
  };
}

function runDebounceOps(ops: readonly DebounceOp[], delayMs: number): { actual: string[]; expected: string[]; pendingActual: number[]; pendingExpected: number[] } {
  const clock: FakeClock = createFakeClock();
  const actual: string[] = [];
  const debouncer = createKeyedDebouncer({ timers: clock, delayMs });
  const model = modelOfSpec(delayMs);
  const pendingActual: number[] = [];
  const pendingExpected: number[] = [];
  let label = 0;
  for (const o of ops) {
    switch (o.op) {
      case "schedule": {
        const id = String(label++);
        debouncer.schedule(o.key, () => actual.push(`${o.key}:${id}`));
        model.schedule(o.key, id);
        break;
      }
      case "cancel":
        debouncer.cancel(o.key);
        model.cancel(o.key);
        break;
      case "advance":
        clock.advance(o.ms);
        model.advance(o.ms);
        break;
      case "dispose":
        debouncer.dispose();
        model.dispose();
        break;
    }
    pendingActual.push(clock.pending());
    pendingExpected.push(model.pending());
  }
  return { actual, expected: model.log, pendingActual, pendingExpected };
}

describe("Session 342 -- the keyed debouncer agrees with a model of its spec on seeded operation sequences (schedule, cancel, advance, dispose over three keys)", () => {
  it("runs the same runs, in the same order, with the same number of timers pending after every operation, on 3,000 sequences of 5 to 60 operations at six delays", () => {
    const random = seededRandom(3423);
    const keys = ["a", "b", "c"];
    const advances = [0, 1, 10, 49, 50, 51, 149, 150, 151, 1_000];
    const delays = [150, 0, 1, 50, 25.5, 100];
    let ran = 0;
    let replaced = 0;
    const mismatches: string[] = [];
    for (let n = 0; n < 3_000; n++) {
      const ops: DebounceOp[] = [];
      const length = 5 + Math.floor(random() * 56);
      for (let k = 0; k < length; k++) {
        const draw = random();
        const key = keys[Math.floor(random() * keys.length)];
        if (draw < 0.5) ops.push({ op: "schedule", key });
        else if (draw < 0.6) ops.push({ op: "cancel", key });
        else if (draw < 0.995) ops.push({ op: "advance", ms: advances[Math.floor(random() * advances.length)] });
        else ops.push({ op: "dispose" });
      }
      ops.push({ op: "advance", ms: 2_000 });
      const delayMs = delays[n % delays.length];
      const r = runDebounceOps(ops, delayMs);
      ran += r.actual.length;
      replaced += ops.filter((o) => o.op === "schedule").length - r.actual.length;
      if (JSON.stringify(r.actual) !== JSON.stringify(r.expected) || JSON.stringify(r.pendingActual) !== JSON.stringify(r.pendingExpected)) {
        if (mismatches.length < 3) mismatches.push(`delay ${delayMs}: ${JSON.stringify(ops)} -> ${JSON.stringify(r.actual)} against the model's ${JSON.stringify(r.expected)}`);
      }
    }
    expect(mismatches).toEqual([]);
    // the draw reaches runs, and drops many more schedules than it runs (the debounce)
    expect(ran).toBeGreaterThan(10_000);
    expect(replaced).toBeGreaterThan(ran);
  }, HEAVY_ROW_MS);

  it("the model itself: a table of one entry a key, the last schedule wins, the entries due run in order of due time and then of scheduling", () => {
    const m = modelOfSpec(100);
    m.schedule("a", "1");
    m.schedule("b", "2");
    m.advance(50);
    m.schedule("a", "3"); // due 150
    m.advance(60); // 110: b is due (100), a is not
    expect(m.log).toEqual(["b:2"]);
    m.cancel("zzz");
    m.advance(40); // 150
    expect(m.log).toEqual(["b:2", "a:3"]);
    m.schedule("c", "4");
    m.dispose();
    m.schedule("d", "5");
    m.advance(1_000);
    expect(m.log).toEqual(["b:2", "a:3"]);
    expect(m.pending()).toBe(0);
  });
});
