import { describe, expect, it, vi } from "vitest";
import { cellBackgroundRanges } from "../../src/core/cell-background";
import { findCellAtPosition } from "../../src/core/qmd/model";
import {
  type EditorSnapshot,
  TYPING_DEBOUNCE_MS,
  createCellContextScheduler,
  createKeyedDebouncer,
} from "../../src/core/typing-debounce";
import { createFakeClock } from "./support/fake-timers";

// Session 342 -- the BACKLOG item "What Session 341's review round found beside the Outline and preview cures", part (4): "Two handlers on the typing path are not debounced". `updateCellContext`
// (`src/features/execution.ts`) ran `findCellAtPosition(text, line)` and `setContext 'quarto.inCodeCell'` on every selection event, active-editor event and document edit; the cell-background decorator
// (`src/features/cell-background.ts`) ran `cellBackgroundRanges(text)` and `setDecorations` with every cell's range on every edit of a visible document. Both read the whole document's region scan, and a scan
// of a text it has not seen costs 12.7 / 31.7 / 155 ms at 500 / 2,000 / 8,000 twenty-line cells (a warm call is a fraction of a millisecond, below: the two share one scan through the two-entry cache). VS Code fires a
// document event and a selection event for every keystroke, so a person typing in a long document paid the scan on the extension host's event turn, three evaluations a keystroke and one scan.
//
// ⚠ WHAT THE CURE COVERS, AND WHAT THESE ROWS SHOW: BURSTS. The debounce coalesces events that arrive LESS THAN 150 ms apart (a held key, a paste, a replace-all, a snippet). Typing at a steady gap of 150 ms or more still
// pays one cold scan per keystroke exactly as before, only delayed by the pause. The clock rows' keystrokes are 10 ms apart (`clock.advance(10)`; the sequence rows' 20 ms), so "40 keystrokes in 2,000 cells, 1,052 ms to 39 ms" is a burst
// figure; no row here counts the evaluations of live keystrokes spaced 150 ms or more apart (the sequence rows' gaps are at most 100 ms). The schedulers made in this file have NO `maxWaitMs`, so events arriving less than 150 ms apart postpone the evaluation until 150 ms after the last of them (with the maximum wait of Session 343, `TYPING_MAX_WAIT_MS`, which the adapters
// hand them and `s343-max-wait.test.ts` pins, an unbroken stream is evaluated about once a second); and "navigation
// stays fresh" is true of a cursor move with no edit since the last evaluation only (a move after an edit is debounced with it).
//
// This file holds the SEQUENCES (a fake clock drives the cell-context scheduler through edits, cursor moves, editor switches and pauses and counts what it evaluated) and the CLOCK rows (the real scans, a burst
// of keystrokes, a limit in milliseconds). The debouncer's own rows are `typing-debounce.test.ts`; how the two adapters are wired is pinned in `s342-typing-wiring-pin.test.ts`; the old spelling is the oracle of
// `typing-path-equivalence.test.ts`.

/** What one evaluation saw: the document, the version of its text and the line of the cursor at the moment it ran. */
interface Seen {
  key: string;
  version: number;
  line: number;
}

const DOC_A = "file:///a.qmd";
const DOC_B = "file:///b.qmd";

/** The cell-context scheduler on a fake clock, and an editor whose state the rows change the way VS Code does: an edit bumps the version, a cursor move changes the line, a switch changes the document. */
function session(options: { delayMs?: number; evaluate?: (state: { key: string; version: number; line: number }) => void; onError?: (error: unknown) => void } = {}) {
  const clock = createFakeClock();
  const state = { active: true, key: DOC_A, version: 1, line: 0 };
  const seen: Seen[] = [];
  const errors: unknown[] = [];
  const reads = { snapshots: 0 };
  const scheduler = createCellContextScheduler({
    timers: clock,
    delayMs: options.delayMs ?? TYPING_DEBOUNCE_MS,
    activeSnapshot: (): EditorSnapshot | undefined => {
      reads.snapshots++;
      return state.active ? { key: state.key, version: state.version } : undefined;
    },
    evaluate: () => {
      options.evaluate?.(state);
      seen.push({ key: state.key, version: state.version, line: state.line });
    },
    onError: options.onError ?? ((error) => errors.push(error)),
  });
  return {
    clock,
    state,
    seen,
    errors,
    reads,
    scheduler,
    /** A document event: the text changed. */
    edit: () => {
      state.version++;
      scheduler.changed();
    },
    /** A selection event: the cursor moved to `line`. */
    select: (line: number) => {
      state.line = line;
      scheduler.changed();
    },
    /** One keystroke as VS Code reports it: the document event, then the selection event. */
    keystroke: (line: number = state.line) => {
      state.version++;
      scheduler.changed();
      state.line = line;
      scheduler.changed();
    },
    /** The active editor changed to `key` at `version`. */
    switchTo: (key: string, version: number, line: number) => {
      state.key = key;
      state.version = version;
      state.line = line;
      scheduler.evaluateNow();
    },
  };
}

describe("createCellContextScheduler -- when the quarto.inCodeCell key is evaluated (Session 342)", () => {
  it("the activation-time call evaluates once, at once, and sets no timer", () => {
    const s = session();
    s.scheduler.evaluateNow();
    expect(s.seen).toEqual([{ key: DOC_A, version: 1, line: 0 }]);
    expect(s.clock.pending()).toBe(0);
  });

  it("a cursor move that follows no edit evaluates exactly once, at once, and leaves no timer", () => {
    const s = session();
    s.scheduler.evaluateNow();
    s.select(7);
    expect(s.seen).toEqual([
      { key: DOC_A, version: 1, line: 0 },
      { key: DOC_A, version: 1, line: 7 },
    ]);
    expect(s.clock.pending()).toBe(0);
  });

  it("a run of cursor moves evaluates each one at once, in order: navigation stays fresh", () => {
    const s = session();
    s.scheduler.evaluateNow();
    for (let line = 1; line <= 25; line++) s.select(line);
    expect(s.seen.map((e) => e.line)).toEqual(Array.from({ length: 26 }, (_, i) => i));
    expect(s.clock.pending()).toBe(0);
  });

  it("a burst of K keystrokes evaluates ONCE, after the pause, and sees the last state (the last version, the last line)", () => {
    const K = 30;
    const s = session();
    s.scheduler.evaluateNow();
    for (let i = 1; i <= K; i++) {
      s.keystroke(10 + i);
      s.clock.advance(20); // a keystroke every 20 ms
    }
    expect(s.seen).toHaveLength(1); // only the activation: nothing was evaluated while the typing went on
    s.clock.advance(TYPING_DEBOUNCE_MS - 20 - 1);
    expect(s.seen).toHaveLength(1);
    s.clock.advance(1);
    expect(s.seen).toEqual([
      { key: DOC_A, version: 1, line: 0 },
      { key: DOC_A, version: 1 + K, line: 10 + K },
    ]);
    expect(s.clock.pending()).toBe(0);
  });

  it("the pause is counted from the LAST event: an event inside the window postpones the evaluation by a whole delay", () => {
    const s = session();
    s.scheduler.evaluateNow();
    s.keystroke(3);
    s.clock.advance(100);
    s.keystroke(4);
    s.clock.advance(100); // 200 ms after the first keystroke
    expect(s.seen).toHaveLength(1);
    s.clock.advance(49);
    expect(s.seen).toHaveLength(1);
    s.clock.advance(1);
    expect(s.seen.map((e) => [e.version, e.line])).toEqual([
      [1, 0],
      [3, 4],
    ]);
  });

  it("edit, select, edit, select, then a pause evaluates once", () => {
    const s = session();
    s.scheduler.evaluateNow();
    s.edit();
    s.select(2);
    s.edit();
    s.select(3);
    expect(s.seen).toHaveLength(1);
    s.clock.advance(TYPING_DEBOUNCE_MS);
    expect(s.seen).toHaveLength(2);
    expect(s.seen[1]).toEqual({ key: DOC_A, version: 3, line: 3 });
  });

  it("a cursor move after the burst's evaluation evaluates at once again (the version is the one last evaluated)", () => {
    const s = session();
    s.scheduler.evaluateNow();
    s.keystroke(5);
    s.clock.advance(TYPING_DEBOUNCE_MS);
    expect(s.seen).toHaveLength(2);
    s.select(9);
    expect(s.seen).toHaveLength(3);
    expect(s.seen[2]).toEqual({ key: DOC_A, version: 2, line: 9 });
    expect(s.clock.pending()).toBe(0);
  });

  it("a cursor move while an edit is still pending is evaluated with it, after the pause, and sees the moved cursor", () => {
    const s = session();
    s.scheduler.evaluateNow();
    s.edit();
    s.clock.advance(40);
    s.select(12);
    expect(s.seen).toHaveLength(1);
    expect(s.clock.pending()).toBe(1);
    s.clock.advance(TYPING_DEBOUNCE_MS);
    expect(s.seen).toHaveLength(2);
    expect(s.seen[1]).toEqual({ key: DOC_A, version: 2, line: 12 });
  });

  it("an event with the same version as the last evaluation (a save, a dirty flag) is evaluated at once", () => {
    const s = session();
    s.scheduler.evaluateNow();
    s.scheduler.changed();
    expect(s.seen).toHaveLength(2);
    expect(s.clock.pending()).toBe(0);
  });

  it("an active-editor change inside the window evaluates at once, on the new editor, and cancels the pending run", () => {
    const s = session();
    s.scheduler.evaluateNow();
    s.keystroke(5);
    s.clock.advance(50);
    s.switchTo(DOC_B, 7, 3);
    expect(s.seen).toHaveLength(2);
    expect(s.seen[1]).toEqual({ key: DOC_B, version: 7, line: 3 });
    expect(s.clock.pending()).toBe(0);
    s.clock.advance(10_000);
    expect(s.seen).toHaveLength(2); // the cancelled run never runs
  });

  it("after an editor switch a cursor move in the new editor is evaluated at once (the switch recorded its version)", () => {
    const s = session();
    s.scheduler.evaluateNow();
    s.switchTo(DOC_B, 7, 3);
    s.select(4);
    expect(s.seen).toHaveLength(3);
    expect(s.seen[2]).toEqual({ key: DOC_B, version: 7, line: 4 });
    expect(s.clock.pending()).toBe(0);
  });

  it("switching back to a document whose version equals the one first evaluated still evaluates the switch and the moves after it at once", () => {
    const s = session();
    s.scheduler.evaluateNow(); // A at version 1
    s.switchTo(DOC_B, 1, 0);
    s.switchTo(DOC_A, 1, 6);
    s.select(8);
    expect(s.seen.map((e) => [e.key, e.line])).toEqual([
      [DOC_A, 0],
      [DOC_B, 0],
      [DOC_A, 6],
      [DOC_A, 8],
    ]);
  });

  it("an event on a document the scheduler has not evaluated is debounced, even when its version number equals another document's", () => {
    const s = session();
    s.scheduler.evaluateNow(); // A at version 1
    s.state.key = DOC_B; // the active document changed without an active-editor event reaching the scheduler
    s.scheduler.changed();
    expect(s.seen).toHaveLength(1);
    expect(s.clock.pending()).toBe(1);
    s.clock.advance(TYPING_DEBOUNCE_MS);
    expect(s.seen[1]).toEqual({ key: DOC_B, version: 1, line: 0 });
  });

  it("an event before anything was evaluated is debounced", () => {
    const s = session();
    s.scheduler.changed();
    expect(s.seen).toHaveLength(0);
    expect(s.clock.pending()).toBe(1);
    s.clock.advance(TYPING_DEBOUNCE_MS);
    expect(s.seen).toHaveLength(1);
  });

  it("a version that is NaN is never the version last evaluated: every event on it is debounced", () => {
    const s = session();
    s.state.version = NaN;
    s.scheduler.evaluateNow();
    s.select(2);
    s.select(3);
    expect(s.seen).toHaveLength(1);
    expect(s.clock.pending()).toBe(1);
    s.clock.advance(TYPING_DEBOUNCE_MS);
    expect(s.seen).toHaveLength(2);
    expect(s.seen[1].line).toBe(3);
  });

  it("a version of minus zero is the version zero last evaluated", () => {
    const s = session();
    s.state.version = 0;
    s.scheduler.evaluateNow();
    s.state.version = -0;
    s.select(2);
    expect(s.seen).toHaveLength(2);
    expect(s.clock.pending()).toBe(0);
  });

  it("a version lower than the one last evaluated (a document replaced by an older text) is not the version evaluated: the event is debounced", () => {
    const s = session();
    s.state.version = 5;
    s.scheduler.evaluateNow();
    s.state.version = 3;
    s.select(2);
    expect(s.seen).toHaveLength(1);
    expect(s.clock.pending()).toBe(1);
    s.clock.advance(TYPING_DEBOUNCE_MS);
    expect(s.seen).toHaveLength(2);
    expect(s.seen[1]).toEqual({ key: DOC_A, version: 3, line: 2 });
  });

  it("records the version the evaluation SAW, not the one after it: an edit that lands during the evaluation is not taken for evaluated", () => {
    let editDuringEvaluation = false;
    const s = session({
      evaluate: (state) => {
        if (editDuringEvaluation) state.version++;
      },
    });
    s.scheduler.evaluateNow(); // version 1 evaluated
    editDuringEvaluation = true;
    s.select(4); // the same version: evaluated at once, and the version moves to 2 while it runs
    editDuringEvaluation = false;
    expect(s.seen).toHaveLength(2);
    s.select(5); // version 2 was never evaluated: debounced
    expect(s.seen).toHaveLength(2);
    expect(s.clock.pending()).toBe(1);
    s.clock.advance(TYPING_DEBOUNCE_MS);
    expect(s.seen).toHaveLength(3);
    expect(s.seen[2]).toEqual({ key: DOC_A, version: 2, line: 5 });
  });

  it("with no active editor an event evaluates at once (clearing the key costs no scan) and cancels the pending run", () => {
    const s = session();
    s.scheduler.evaluateNow();
    s.keystroke(2);
    expect(s.clock.pending()).toBe(1);
    s.state.active = false;
    s.scheduler.changed();
    expect(s.seen).toHaveLength(2);
    expect(s.clock.pending()).toBe(0);
    s.clock.advance(10_000);
    expect(s.seen).toHaveLength(2);
  });

  it("the first evaluation with no active editor records no version, so the next event on an editor is debounced", () => {
    const s = session();
    s.state.active = false;
    s.scheduler.evaluateNow();
    s.state.active = true;
    s.select(1);
    expect(s.seen).toHaveLength(1);
    expect(s.clock.pending()).toBe(1);
  });

  // The Session 342 review round (mutation lens, M-06): the source comment says `evaluated` is `undefined` when "none yet, or no editor was active". The row above is the "none yet" half. Under VS Code's event contract the
  // "no editor was active" half is not reachable (going from no editor to an editor always fires onDidChangeActiveTextEditor, which evaluates at once, before any `changed()`), so a scheduler that kept the snapshot from before
  // would be EQUIVALENT in the host; this row pins the module's own contract, the comment, not a behaviour a person can see.
  it("(the module's contract, not reachable in the host) an evaluation that sees no editor forgets the version before it: the editor back at that version is debounced, not taken for evaluated", () => {
    const s = session();
    s.scheduler.evaluateNow(); // (A, 1) evaluated
    s.state.active = false;
    s.scheduler.evaluateNow(); // no editor: nothing is recorded
    s.state.active = true; // the snapshot is (A, 1) again
    s.scheduler.changed();
    expect(s.seen).toHaveLength(2); // the activation and the no-editor evaluation: this event waits
    expect(s.clock.pending()).toBe(1);
    s.clock.advance(TYPING_DEBOUNCE_MS);
    expect(s.seen).toHaveLength(3);
    expect(s.clock.pending()).toBe(0);
  });

  it("asks the timer for the delay it was made with (40 ms here), once for each event that is debounced", () => {
    const s = session({ delayMs: 40 });
    s.scheduler.evaluateNow();
    s.keystroke(2);
    expect(s.clock.delays).toEqual([40, 40]); // the document event and the selection event each asked
    s.clock.advance(39);
    expect(s.seen).toHaveLength(1);
    s.clock.advance(1);
    expect(s.seen).toHaveLength(2);
  });

  it("dispose inside the window: the pending evaluation never runs, and later events do nothing and set no timer", () => {
    const s = session();
    s.scheduler.evaluateNow();
    s.keystroke(2);
    s.clock.advance(100);
    s.scheduler.dispose();
    expect(s.clock.pending()).toBe(0);
    s.clock.advance(10_000);
    s.keystroke(3);
    s.select(4);
    s.scheduler.evaluateNow();
    s.clock.advance(10_000);
    expect(s.seen).toHaveLength(1); // only the activation
    expect(s.clock.pending()).toBe(0);
  });

  it("after dispose nothing reads the editor either: the snapshot is not asked for by an event, and no timer was cleared that was not pending", () => {
    const s = session();
    s.scheduler.evaluateNow();
    s.keystroke(2);
    s.scheduler.dispose();
    const reads = s.reads.snapshots;
    s.keystroke(3);
    s.select(4);
    s.scheduler.evaluateNow();
    s.scheduler.dispose();
    expect(s.reads.snapshots).toBe(reads);
    expect(s.clock.staleClears()).toBe(0);
  });

  it("dispose can be called twice", () => {
    const s = session();
    s.scheduler.dispose();
    expect(() => s.scheduler.dispose()).not.toThrow();
  });

  it("never clears a timer that is not pending: not on an immediate evaluation with nothing waiting, not after a debounced run", () => {
    const s = session();
    s.scheduler.evaluateNow();
    s.select(3); // immediate, nothing pending
    s.keystroke(4);
    s.clock.advance(TYPING_DEBOUNCE_MS); // the debounced run
    s.select(5); // immediate again
    s.switchTo(DOC_B, 2, 0);
    expect(s.clock.staleClears()).toBe(0);
  });
});

describe("createCellContextScheduler -- an evaluation that throws (Session 342)", () => {
  it("a debounced evaluation that throws is reported to onError, and the version is not recorded as evaluated: the next event retries", () => {
    let failures = 1;
    const s = session({
      evaluate: () => {
        if (failures-- > 0) throw new Error("setContext failed");
      },
    });
    s.keystroke(2);
    s.clock.advance(TYPING_DEBOUNCE_MS);
    expect(s.errors.map((e) => (e as Error).message)).toEqual(["setContext failed"]);
    expect(s.seen).toHaveLength(0);
    s.select(3); // the version 2 never evaluated: debounced again, not taken for evaluated
    expect(s.seen).toHaveLength(0);
    expect(s.clock.pending()).toBe(1);
    s.clock.advance(TYPING_DEBOUNCE_MS);
    expect(s.seen).toEqual([{ key: DOC_A, version: 2, line: 3 }]);
    expect(s.errors).toHaveLength(1);
  });

  it("an immediate evaluation that throws reaches the caller, as the handler's throw did, and records nothing", () => {
    let failures = 1;
    const s = session({
      evaluate: () => {
        if (failures-- > 0) throw new Error("immediate");
      },
    });
    expect(() => s.scheduler.evaluateNow()).toThrow("immediate");
    expect(s.errors).toEqual([]);
    s.select(4); // nothing was recorded as evaluated: debounced
    expect(s.seen).toHaveLength(0);
    expect(s.clock.pending()).toBe(1);
  });

  it("without an onError the error goes to console.error and nothing is thrown out of the timer", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const clock = createFakeClock();
      const boom = new Error("unreported");
      const scheduler = createCellContextScheduler({
        timers: clock,
        delayMs: TYPING_DEBOUNCE_MS,
        activeSnapshot: () => ({ key: DOC_A, version: 2 }),
        evaluate: () => {
          throw boom;
        },
      });
      scheduler.changed();
      expect(() => clock.advance(TYPING_DEBOUNCE_MS)).not.toThrow();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]).toContain(boom);
    } finally {
      spy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE TYPING PATH OVER REAL SCANS. The two schedulers the adapters use, fed the events VS Code sends for a burst of keystrokes, with the real work behind them: `findCellAtPosition(text, line)` for the key and
// `cellBackgroundRanges(text)` for the tint. Every keystroke is a different exact text (the region scan is memoised on the exact text and the last two texts), so every keystroke is a cache miss: the cost the
// session owner measured. Per keystroke the adapters receive three events: the document event for the key, the document event for the tint, the selection event for the key.

/** Cells of twenty lines (the fence, `#| echo: false`, 17 body lines, the fence) after a four-line header; the header's title carries `tag`, so each tag is another exact text with every cell on the same lines. */
function documentWithCells(cells: number, tag: number): string {
  const body = Array.from({ length: 17 }, (_, k) => `v${k} = ${k}`).join("\n");
  const cell = "```{python}\n#| echo: false\n" + body + "\n```\n";
  return `---\ntitle: typed ${tag}\n---\n\n` + cell.repeat(cells);
}

/** A line inside the middle cell: the fifth line below its opening fence. */
const cursorLineIn = (cells: number): number => 4 + 20 * (cells >> 1) + 5;

/** What the typing path does with a text: the key's question and the tint's ranges. Injected, so the helper's own rows run on a clock only the fake work advances. */
interface Work {
  context(text: string, line: number): boolean;
  background(text: string): number;
}
const REAL_WORK: Work = {
  context: (text, line) => findCellAtPosition(text, line) !== null,
  background: (text) => cellBackgroundRanges(text).length,
};

interface BurstRun {
  /** The milliseconds of the whole burst: every event, and the pause after the last. */
  ms: number;
  /** One evaluation (the key's question and the tint's ranges) of a text no earlier evaluation saw: the cost of the scan. */
  unitMs: number;
  contextEvaluations: number;
  tintRefreshes: number;
  inCell: boolean | undefined;
  rangeCount: number;
  /** The version of the text the last evaluation of the key, and the last refresh of the tint, saw. */
  lastContextVersion: number;
  lastTintVersion: number;
  events: number;
}

/** `keystrokes` keystrokes, 10 ms apart, then the pause, through the two schedulers, with the clock `now` on the burst and on the unit. The activation-time evaluation is made, and its count dropped, before the clock starts. */
function timeBurst(plan: { cells: number; keystrokes: number }, now: () => number = () => performance.now(), work: Work = REAL_WORK): BurstRun {
  const texts = Array.from({ length: plan.keystrokes + 1 }, (_, tag) => documentWithCells(plan.cells, tag));
  const line = cursorLineIn(plan.cells);
  const unitStarted = now();
  work.context(texts[0], line);
  work.background(texts[0]);
  const unitMs = now() - unitStarted;

  const clock = createFakeClock();
  const editor = { text: texts[0], version: 1 };
  const run: BurstRun = { ms: 0, unitMs, contextEvaluations: 0, tintRefreshes: 0, inCell: undefined, rangeCount: -1, lastContextVersion: -1, lastTintVersion: -1, events: 0 };
  const keyScheduler = createCellContextScheduler({
    timers: clock,
    delayMs: TYPING_DEBOUNCE_MS,
    activeSnapshot: () => ({ key: DOC_A, version: editor.version }),
    evaluate: () => {
      run.contextEvaluations++;
      run.inCell = work.context(editor.text, line);
      run.lastContextVersion = editor.version;
    },
  });
  const tintScheduler = createKeyedDebouncer({ timers: clock, delayMs: TYPING_DEBOUNCE_MS });
  const refreshTint = (): void => {
    run.tintRefreshes++;
    run.rangeCount = work.background(editor.text);
    run.lastTintVersion = editor.version;
  };
  keyScheduler.evaluateNow(); // activation: the text is the unit's, the scan is cached
  run.contextEvaluations = 0;
  run.inCell = undefined;
  run.lastContextVersion = -1;

  const started = now();
  for (let k = 1; k <= plan.keystrokes; k++) {
    editor.text = texts[k];
    editor.version++;
    keyScheduler.changed(); // the document event, for the key
    tintScheduler.schedule(DOC_A, refreshTint); // the document event, for the tint
    keyScheduler.changed(); // the selection event, for the key
    run.events += 3;
    clock.advance(10);
  }
  clock.advance(TYPING_DEBOUNCE_MS); // the pause
  run.ms = now() - started;
  keyScheduler.dispose();
  tintScheduler.dispose();
  return run;
}

describe("Session 342 -- a burst of keystrokes through the typing path on a small document (the counts: no clock)", () => {
  it("3 cells, 12 keystrokes: the key is evaluated ONCE and the tint refreshed ONCE, after the pause, on the last text, with the stated answers", () => {
    const run = timeBurst({ cells: 3, keystrokes: 12 });
    expect(run.events).toBe(36);
    expect(run.contextEvaluations).toBe(1);
    expect(run.tintRefreshes).toBe(1);
    expect(run.lastContextVersion).toBe(13);
    expect(run.lastTintVersion).toBe(13);
    expect(run.inCell).toBe(true); // the cursor is inside the middle cell
    expect(run.rangeCount).toBe(3);
  });

  it("one keystroke: still evaluated once each, after the pause and not before", () => {
    const run = timeBurst({ cells: 3, keystrokes: 1 });
    expect(run.events).toBe(3);
    expect(run.contextEvaluations).toBe(1);
    expect(run.tintRefreshes).toBe(1);
    expect(run.lastContextVersion).toBe(2);
    expect(run.lastTintVersion).toBe(2);
  });
});

// THE CLOCK. Measured at the base (Session 342, one fresh process per size, the first call after an edit, `findCellAtPosition` plus `cellBackgroundRanges`, a different exact text per call, the document a four-line
// header and then N twenty-line python cells): 9.8 / 38.3 / 124.8 ms at 500 / 2,000 / 8,000 cells (medians of 6, load 3.5; the session owner's figures 12.7 / 31.7 / 155 ms), a warm call 0.04 / 0.16 / 0.6 ms.
// The review round re-measured the warm call for a text equal to the last one's but a distinct string (what `document.getText()` returns), the medians at load 5 to 6: 0.01 to 0.02 / 0.05 to 0.08 / 0.18 to 0.21 ms at
// 500 / 2,000 / 8,000 cells, and about 0.1 ms at 8,000 for the very same string object. The two sets disagree by up to 3x at 8,000 cells (0.6 against 0.2 ms); both say a fraction of a millisecond, and "under 0.1 ms" holds
// at 500 and 2,000 cells only. A burst of K keystrokes at the base costs K of those scans.
//
// Measured through these very rows (Session 342, one fresh process each, load 5; the unit is the first cold evaluation, so it includes the first call's compilation): AT THE SEAM (every event does its work at once) 1,052 to 1,054 ms
// and a ratio of 20.7 to 20.8 on the 40 keystrokes in 2,000 cells, 1,541 to 1,550 ms and 30.9 to 31.3 on the 30 in 4,000, the key evaluated 2K times and the tint refreshed K; AT THE CURE 38 to 40 ms and 0.76 to 0.79,
// 55 to 59 ms and 0.82 to 0.89, once each. The limit is 400 ms and is not raised to make a row pass: the seam is 2.6 to 3.9 times over it and the cure 6.8 to 10.5 times under; the ratio and the limit each fail the seam alone.

/** The limit of the burst, in milliseconds. */
const LIMIT_MS = 400;
/** The burst against one evaluation of a new text, in the same process: the base pays K of them (a ratio of 20.7 to 31.3 on the two shapes), the cure about one (0.76 to 0.89), so 5 sits 4.1 to 6.3x under the base and 5.6 to 6.6x over the cure. */
const RATIO = 5;

/** Which of the two clock criteria a burst breaks, each named with its numbers: the burst under `LIMIT_MS`, and the burst against one cold evaluation under `RATIO`. `[]` is a run that keeps both. */
function burstBreaks(run: { ms: number; unitMs: number }): string[] {
  const broken: string[] = [];
  const ratio = run.ms / run.unitMs;
  if (!(run.ms < LIMIT_MS)) broken.push(`the burst took ${run.ms.toFixed(1)} ms, not under ${LIMIT_MS} ms`);
  if (!(ratio < RATIO)) broken.push(`the burst took ${ratio.toFixed(1)} times one evaluation, not under ${RATIO} times`);
  return broken;
}

describe("the Session 342 clock criteria (burstBreaks), fed the numbers the base and the cure were measured at", () => {
  it("the base's measurement breaks both criteria, the cure's breaks neither", () => {
    expect(burstBreaks({ ms: 1530, unitMs: 38.3 })).toHaveLength(2); // 40 keystrokes at 2,000 cells at the base
    expect(burstBreaks({ ms: 44, unitMs: 38.3 })).toEqual([]); // the same at the cure
  });

  it("each criterion fails alone: a slow run of a slow scan breaks the limit only, a fast run that pays the scan every time breaks the ratio only", () => {
    expect(burstBreaks({ ms: 900, unitMs: 300 })).toEqual(["the burst took 900.0 ms, not under 400 ms"]);
    expect(burstBreaks({ ms: 90, unitMs: 3 })).toEqual(["the burst took 30.0 times one evaluation, not under 5 times"]);
  });

  it("both limits are strict, and a unit read as 0 or a burst read as NaN keeps neither", () => {
    expect(burstBreaks({ ms: 399.9, unitMs: 100 })).toEqual([]);
    expect(burstBreaks({ ms: 400, unitMs: 100 })).toHaveLength(1);
    expect(burstBreaks({ ms: 49.9, unitMs: 10 })).toEqual([]);
    expect(burstBreaks({ ms: 50, unitMs: 10 })).toHaveLength(1); // exactly 5 times
    expect(burstBreaks({ ms: 5, unitMs: 0 })).toHaveLength(1);
    expect(burstBreaks({ ms: NaN, unitMs: 5 })).toHaveLength(2);
  });
});

/** A clock only the fake work advances: the numbers of `timeBurst` are then exact on any load. */
function fakeWork(contextCost: number, backgroundCost: number) {
  let t = 1000;
  const work: Work = {
    context: () => {
      t += contextCost;
      return true;
    },
    background: () => {
      t += backgroundCost;
      return 5;
    },
  };
  return { now: () => t, work };
}

/** A work that spins on the real clock. */
function spinningWork(contextMs: number, backgroundMs: number): Work {
  const spin = (ms: number): void => {
    const started = performance.now();
    while (performance.now() - started < ms) {
      /* spin */
    }
  };
  return {
    context: () => {
      spin(contextMs);
      return true;
    },
    background: () => {
      spin(backgroundMs);
      return 5;
    },
  };
}

describe("the Session 342 clock helper (the clock rows' own clock is pinned here: Learning 910)", () => {
  it("timeBurst reads the unit and the burst on the clock it is given: the unit is one key question plus one tint, the burst is exactly the work the schedulers made it do", () => {
    const { now, work } = fakeWork(3, 7);
    const run = timeBurst({ cells: 4, keystrokes: 6 }, now, work);
    expect(run.unitMs).toBe(10);
    expect(run.ms).toBe(3 * run.contextEvaluations + 7 * run.tintRefreshes);
    expect(run.ms).toBeGreaterThan(0);
    expect(run.contextEvaluations).toBeGreaterThanOrEqual(1);
    expect(run.tintRefreshes).toBeGreaterThanOrEqual(1);
  });

  it("the unit is read before the burst and the burst does not include it: a context cost of 100 and a tint cost of 1 give a unit of 101", () => {
    const { now, work } = fakeWork(100, 1);
    const run = timeBurst({ cells: 4, keystrokes: 3 }, now, work);
    expect(run.unitMs).toBe(101);
    expect(run.ms).toBe(100 * run.contextEvaluations + run.tintRefreshes);
  });

  it("counts the events the adapters would receive: three a keystroke", () => {
    const { now, work } = fakeWork(1, 1);
    expect(timeBurst({ cells: 4, keystrokes: 6 }, now, work).events).toBe(18);
    expect(timeBurst({ cells: 4, keystrokes: 1 }, now, work).events).toBe(3);
  });

  it("the default clock is real time: a work that spins 15 ms for the key is read as at least that in the unit and the burst", () => {
    const run = timeBurst({ cells: 4, keystrokes: 2 }, undefined, spinningWork(15, 0));
    expect(run.unitMs).toBeGreaterThanOrEqual(14);
    expect(run.ms).toBeGreaterThanOrEqual(14 * run.contextEvaluations);
    expect(run.contextEvaluations).toBeGreaterThanOrEqual(1);
  });

  it("the cursor is inside a cell and the document has the cells it was made with", () => {
    expect(findCellAtPosition(documentWithCells(7, 0), cursorLineIn(7))).not.toBeNull();
    expect(cellBackgroundRanges(documentWithCells(7, 0))).toHaveLength(7);
    expect(documentWithCells(2000, 5).split("\n")).toHaveLength(40_005);
    expect(documentWithCells(7, 1)).not.toBe(documentWithCells(7, 2)); // each tag is another exact text
  });
});

const BURST_ROWS: Array<{ label: string; cells: number; keystrokes: number }> = [
  { label: "40 keystrokes in 2,000 twenty-line cells (the shape the item measured: 31.7 ms a scan)", cells: 2000, keystrokes: 40 },
  { label: "30 keystrokes in 4,000 twenty-line cells", cells: 4000, keystrokes: 30 },
];

describe("Session 342 -- every keystroke paid a whole-document region scan on the extension host's event turn (the BACKLOG item \"What Session 341's review round found beside the Outline and preview cures\", part 4)", () => {
  it.each(BURST_ROWS.map((row) => [row.label, row] as const))("%s: the key evaluated once and the tint refreshed once, within the limit and within its ratio of one cold evaluation, with the stated answers", (_label, row) => {
    const run = timeBurst({ cells: row.cells, keystrokes: row.keystrokes });
    // the answers are soft, so that a failing run reports them AND the clock together
    expect.soft(run.events).toBe(3 * row.keystrokes);
    expect.soft(run.contextEvaluations).toBe(1);
    expect.soft(run.tintRefreshes).toBe(1);
    expect.soft(run.lastContextVersion).toBe(row.keystrokes + 1);
    expect.soft(run.lastTintVersion).toBe(row.keystrokes + 1);
    expect.soft(run.inCell).toBe(true);
    expect.soft(run.rangeCount).toBe(row.cells);
    expect(burstBreaks(run)).toEqual([]);
  }, 120_000);

  // CONTROLS: shapes that cost the base little. They pass on it, and they say that the fixtures are not what is slow.
  it("CONTROL: 40 keystrokes in 10 cells stay under the limit", () => {
    const run = timeBurst({ cells: 10, keystrokes: 40 });
    expect(run.ms).toBeLessThan(LIMIT_MS);
  });

  it("CONTROL: ONE evaluation of a new text of 2,000 cells (the scan alone) is under the limit", () => {
    const run = timeBurst({ cells: 2000, keystrokes: 1 });
    expect(run.unitMs).toBeLessThan(LIMIT_MS);
  }, 60_000);

  it("keeps the sizes and the limits the clock rows are built on", () => {
    expect([LIMIT_MS, RATIO, TYPING_DEBOUNCE_MS]).toEqual([400, 5, 150]);
    expect(BURST_ROWS.map((row) => [row.cells, row.keystrokes])).toEqual([
      [2000, 40],
      [4000, 30],
    ]);
  });
});
