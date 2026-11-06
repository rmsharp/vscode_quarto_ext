/**
 * The typing path's scheduling, vscode-free (BACKLOG: "What Session 341's review round found beside the Outline and
 * preview cures", part 4). Two handlers ran a whole-document region scan on EVERY keystroke on the extension host's
 * event turn: `updateCellContext` (`features/execution.ts`: `findCellAtPosition`, then `setContext 'quarto.inCodeCell'`)
 * and the cell-background decorator's `refresh` (`features/cell-background.ts`: `cellBackgroundRanges`, then
 * `setDecorations` with every cell's range). The first call after an edit costs 12.7 / 31.7 / 155 ms at 500 / 2,000 /
 * 8,000 twenty-line cells (they share one scan through the two-entry cache); a warm call is under 0.1 ms.
 *
 * ⚠ THIS IS THE SEAM (Learning 913): the interfaces the adapters are routed through, with the OLD behaviour inside --
 * every event does its work at once. The cure replaces the bodies, not the interfaces.
 */

/** The delay of the edit-driven work: a pause this long after the last keystroke runs it. */
export const TYPING_DEBOUNCE_MS = 150;

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

/** What a delay means to a timer: see the cure. At the seam it is the delay as given. */
export function normalizeDelayMs(ms: number): number {
  return ms;
}

export interface KeyedDebouncerOptions {
  readonly timers: Timers;
  readonly delayMs: number;
  /** Where a throwing run is reported. */
  readonly onError?: (error: unknown) => void;
}

/** A trailing debouncer with one pending run per key. */
export interface KeyedDebouncer {
  /** Run `run` once `delayMs` after the LAST `schedule` of `key`; a pending run of the same key is dropped. */
  schedule(key: string, run: () => void): void;
  /** Drop the pending run of `key`, if any. */
  cancel(key: string): void;
  /** Drop every pending run; later `schedule` calls do nothing. */
  dispose(): void;
}

export function createKeyedDebouncer(_options: KeyedDebouncerOptions): KeyedDebouncer {
  return {
    schedule: (_key, run) => run(),
    cancel: () => undefined,
    dispose: () => undefined,
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
  /** The active editor's document and its version, or `undefined` when no editor is active. */
  activeSnapshot(): EditorSnapshot | undefined;
  /** Re-evaluate the context key from the ACTIVE editor's state as it is now. */
  evaluate(): void;
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

export function createCellContextScheduler(options: CellContextOptions): CellContextScheduler {
  return {
    changed: () => options.evaluate(),
    evaluateNow: () => options.evaluate(),
    dispose: () => undefined,
  };
}
