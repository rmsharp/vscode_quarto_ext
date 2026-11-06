/**
 * The typing path's scheduling, vscode-free (BACKLOG: "What Session 341's review round found beside the Outline and
 * preview cures", part 4). Two handlers ran a whole-document region scan on EVERY keystroke on the extension host's
 * event turn: `updateCellContext` (`features/execution.ts`: `findCellAtPosition`, now through `core/in-code-cell`'s
 * `isInCodeCell`, then `setContext 'quarto.inCodeCell'`)
 * and the cell-background decorator's `refresh` (`features/cell-background.ts`: `cellBackgroundRanges`, then
 * `setDecorations` with every cell's range). The first call after an edit costs 12.7 / 31.7 / 155 ms at 500 / 2,000 /
 * 8,000 twenty-line cells (they share one scan through the two-entry cache); a warm call is a fraction of a millisecond
 * (under 0.1 ms at 500 and 2,000 cells; at 8,000, about 0.1 ms for the very same string object and about 0.2 ms for a text
 * equal to the last one's but a distinct string, as `document.getText()` returns). VS Code sends a document event and a
 * selection event for each keystroke, so a person typing paid one scan a keystroke.
 *
 * WHAT THE CURE COVERS: BURSTS. The debounce coalesces events that arrive LESS THAN `TYPING_DEBOUNCE_MS` (150 ms) apart: a
 * held key, a paste, a replace-all, a snippet. Typing at a steady gap of 150 ms or more between edit events still pays one
 * cold scan per keystroke exactly as before (the scan is only delayed by the pause); the clock rows' keystrokes are 10 ms
 * apart (the sequence rows' at most 100 ms), so "40 keystrokes, 1,052 ms to 39 ms" is a burst figure and says nothing
 * about a steady typist. A stream of edit events that never pauses 150 ms is no burst, and the Session 342 debounce, a
 * pure trailing one, postponed its work for as long as the stream lasted (an edit event every 100 ms for 30 s, 301 events,
 * 0 evaluations before it ended); a MAXIMUM WAIT (`TYPING_MAX_WAIT_MS`, Session 343) now bounds that postponement.
 *
 * The cure is a TRAILING debounce of the edit-driven work with a maximum wait, kept in this module so that it is
 * unit-tested with a fake clock (the §3.3 guardrail): the timers are injected (`Timers`), and the two adapters are
 * reduced to wiring.
 *
 *  - `createKeyedDebouncer`: one pending run per key; scheduling a key again drops the pending run and starts the
 *    delay over, so a burst runs once, one delay after its last event, with the last run. The cell-background
 *    decorator keys it by the document's URI. With `maxWaitMs`, the first schedule of a key since its last run also
 *    starts a second timer, the key's WINDOW, which later schedules do not restart: whichever of the two timers fires
 *    first runs the LATEST run once and clears the other, and the next schedule opens a new window. Without it the
 *    debouncer is the pure trailing one.
 *  - `createCellContextScheduler`: decides, for each event that may change `quarto.inCodeCell`, whether to evaluate it
 *    AT ONCE or after the pause. An event that sees the same document at the same version as the last evaluation (a
 *    cursor move with no edit since the last evaluation, a save) is evaluated at once: the scan is cached for that
 *    text, so it is cheap, and navigation stays fresh. A cursor move that follows an edit not yet evaluated is NOT
 *    that case: it is debounced with the edit. Any other event (typing: the document event and the selection event
 *    both) is debounced, and the evaluation reads the ACTIVE editor as it is when the timer fires, so the last state
 *    wins. An active-editor change and the activation-time call evaluate at once and drop the pending run (both of its
 *    timers).
 *
 * What the debounce costs:
 *  - The key can lag the cursor by up to `TYPING_DEBOUNCE_MS` after the last event that follows an edit not yet
 *    evaluated; the tint of a fresh edit appears one pause after the typing stops.
 *  - During an unbroken stream of events less than 150 ms apart the key and the tint lag by at most
 *    `TYPING_MAX_WAIT_MS` (1,000 ms): the window opens at the first event after a run, and the run at its end reads
 *    the state as it is then. The stream is evaluated about once a second, not once a window exactly: a window opens at
 *    the first event AFTER a run, up to one gap later (a gap of 100 ms: 30 evaluations in 30 s; of 149 ms: 28; a
 *    gap of 151 ms is no stream, each event runs 150 ms after it, 198 in 30 s as before).
 *  - A maximum wait follows the delay's rule for every number (`normalizeDelayMs`): NaN, zero, minus zero and a
 *    negative or minus infinite one read as no wait beyond the next timer turn (the debounce is off: the fresh side,
 *    not an unbounded wait), a fraction is kept, infinity and anything past what a host timer holds is the longest
 *    one it holds (no limit in effect). A maximum wait shorter than the delay makes the window's timer the first to
 *    fire, so a lone event runs at the maximum wait and not at the delay.
 *  - A STALE `quarto.inCodeCell` is what five keybindings consult (`ctrl+enter`, `shift+enter`, `ctrl+shift+enter`,
 *    `ctrl+alt+c`, `ctrl+k ctrl+f`: `package.json`). Within 150 ms of an edit that moved the cursor into a cell (a
 *    paste, a snippet, a freshly typed cell), or within `TYPING_MAX_WAIT_MS` of the first of an unbroken stream of
 *    edits, the key can still be false, and the chord then falls through to the editor's own binding for it instead of
 *    running the cell (what the editor does then was not run); within the same windows of an edit followed by a
 *    cursor move out of a cell (the move is debounced with the edit) it can still be true, and the chord shows the
 *    "place the cursor inside a code cell" message. Typing inside a cell that stays a cell leaves the key true and is
 *    unaffected.
 */

/** The delay of the edit-driven work: a pause this long after the last keystroke runs it. */
export const TYPING_DEBOUNCE_MS = 150;

/**
 * The longest an unbroken stream of edit events may postpone the edit-driven work: the first event after a run starts a
 * window, and the work runs at the end of it even if events are still arriving less than `TYPING_DEBOUNCE_MS` apart.
 * One second is the lead's choice (Session 343), not a measured optimum: long enough that a burst (a held key, a paste, a
 * snippet) is still one run, short enough that a typist who never pauses sees the key and the tint at most a second late.
 */
export const TYPING_MAX_WAIT_MS = 1000;

/** What a timer is called by: the host's own handle, or a fake clock's. */
export type TimerHandle = unknown;

/** The timers the scheduling objects use: injected, so a fake clock drives them. */
export interface Timers {
  setTimeout(run: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

/** The host's own timers. */
export const realTimers: Timers = {
  setTimeout: (run, ms) => setTimeout(run, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** The longest delay a host timer holds (2^31 - 1 ms, 24.8 days): a Node timer resets a longer one to 1 ms. */
export const MAX_TIMER_DELAY_MS = 2 ** 31 - 1;

/**
 * What a delay means to a timer. NaN, zero, minus zero, a negative and minus infinity mean no wait beyond the next
 * timer turn (0: the run is still trailing and still replaces a pending one, it is never synchronous); a delay past
 * what a host timer holds, infinity included, is the longest one it holds; a fraction is kept, the host's timer rounds
 * it.
 */
export function normalizeDelayMs(ms: number): number {
  if (!(ms > 0)) {
    return 0;
  }
  return ms > MAX_TIMER_DELAY_MS ? MAX_TIMER_DELAY_MS : ms;
}

export interface KeyedDebouncerOptions {
  readonly timers: Timers;
  readonly delayMs: number;
  /**
   * The longest a key's run may be postponed by later schedules, counted from the first schedule since the key's last run
   * (default: no limit, the pure trailing debounce). Read like `delayMs`, by `normalizeDelayMs`.
   */
  readonly maxWaitMs?: number;
  /** Where a throwing run is reported (default: `console.error`). */
  readonly onError?: (error: unknown) => void;
}

/** A trailing debouncer with one pending run per key. */
export interface KeyedDebouncer {
  /**
   * Run `run` once `delayMs` after the LAST `schedule` of `key`, or `maxWaitMs` after the FIRST since the key's last run if
   * that comes sooner; a pending run of the same key is dropped.
   */
  schedule(key: string, run: () => void): void;
  /** Drop the pending run of `key`, if any, with both of its timers. */
  cancel(key: string): void;
  /** Drop every pending run, with its timers; later `schedule` calls do nothing. */
  dispose(): void;
}

function reportError(error: unknown): void {
  console.error("Quarto: a debounced typing-path run failed", error);
}

export function createKeyedDebouncer(options: KeyedDebouncerOptions): KeyedDebouncer {
  const { timers } = options;
  const delayMs = normalizeDelayMs(options.delayMs);
  const maxWaitMs = options.maxWaitMs === undefined ? undefined : normalizeDelayMs(options.maxWaitMs);
  const onError = options.onError ?? reportError;
  // The trailing timer of each key with a run waiting; and, with a maximum wait, the timer of the key's open window (the
  // first schedule since its last run opens it) with the latest run: whichever of the two fires first runs the key once.
  const pending = new Map<string, TimerHandle>();
  const windows = new Map<string, { timer: TimerHandle; run: () => void }>();
  let disposed = false;

  const dropTrailing = (key: string): void => {
    if (pending.has(key)) {
      timers.clearTimeout(pending.get(key));
      pending.delete(key);
    }
  };

  const closeWindow = (key: string): void => {
    const window = windows.get(key);
    if (window !== undefined) {
      timers.clearTimeout(window.timer);
      windows.delete(key);
    }
  };

  const settle = (key: string, run: () => void): void => {
    // The run is over before it runs: it may schedule its own key again, and a throw leaves the key free.
    pending.delete(key);
    windows.delete(key);
    try {
      run();
    } catch (error) {
      onError(error);
    }
  };

  return {
    schedule(key, run) {
      if (disposed) {
        return;
      }
      dropTrailing(key);
      pending.set(
        key,
        timers.setTimeout(() => {
          closeWindow(key);
          settle(key, run);
        }, delayMs),
      );
      if (maxWaitMs !== undefined) {
        const open = windows.get(key);
        if (open !== undefined) {
          open.run = run;
        } else {
          const window = { timer: undefined as TimerHandle, run };
          window.timer = timers.setTimeout(() => {
            dropTrailing(key);
            settle(key, window.run);
          }, maxWaitMs);
          windows.set(key, window);
        }
      }
    },
    cancel(key) {
      dropTrailing(key);
      closeWindow(key);
    },
    dispose() {
      disposed = true;
      for (const handle of pending.values()) {
        timers.clearTimeout(handle);
      }
      pending.clear();
      for (const window of windows.values()) {
        timers.clearTimeout(window.timer);
      }
      windows.clear();
    },
  };
}

/** The active editor's document and the version of its text. */
export interface EditorSnapshot {
  readonly key: string;
  readonly version: number;
}

export interface CellContextOptions {
  readonly timers: Timers;
  readonly delayMs: number;
  /** The longest the evaluation may be postponed by later events, as for the debouncer (default: no limit). */
  readonly maxWaitMs?: number;
  /** The active editor's document and its version, or `undefined` when no editor is active. */
  activeSnapshot(): EditorSnapshot | undefined;
  /** Re-evaluate the context key from the ACTIVE editor's state as it is now. */
  evaluate(): void;
  /** Where a throwing debounced evaluation is reported (default: `console.error`). */
  readonly onError?: (error: unknown) => void;
}

/** When the `quarto.inCodeCell` key is re-evaluated. */
export interface CellContextScheduler {
  /** A selection or document event of the active editor happened. */
  changed(): void;
  /** The active editor changed (or the feature just started): evaluate now. */
  evaluateNow(): void;
  /** Drop the pending evaluation; later events do nothing. */
  dispose(): void;
}

/** The one key of the scheduler's debouncer: there is one context key. */
const CELL_CONTEXT_KEY = "quarto.inCodeCell";

export function createCellContextScheduler(options: CellContextOptions): CellContextScheduler {
  const debouncer = createKeyedDebouncer({
    timers: options.timers,
    delayMs: options.delayMs,
    maxWaitMs: options.maxWaitMs,
    onError: options.onError,
  });
  // The document and version the last SUCCESSFUL evaluation saw (`undefined`: none yet, or no editor was active).
  let evaluated: EditorSnapshot | undefined;
  let disposed = false;

  const evaluate = (): void => {
    const snapshot = options.activeSnapshot();
    options.evaluate();
    evaluated = snapshot;
  };

  const evaluateNow = (): void => {
    if (disposed) {
      return;
    }
    debouncer.cancel(CELL_CONTEXT_KEY);
    evaluate();
  };

  return {
    changed() {
      if (disposed) {
        return;
      }
      const now = options.activeSnapshot();
      const followsNoEdit =
        now === undefined ||
        (evaluated !== undefined && evaluated.key === now.key && evaluated.version === now.version);
      if (followsNoEdit) {
        evaluateNow();
      } else {
        debouncer.schedule(CELL_CONTEXT_KEY, evaluate);
      }
    },
    evaluateNow,
    dispose() {
      disposed = true;
      debouncer.dispose();
    },
  };
}
