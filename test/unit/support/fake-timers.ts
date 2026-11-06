import type { Timers } from "../../../src/core/typing-debounce";

/**
 * A clock that only `advance` moves (Session 342). `Timers` is the interface `src/core/typing-debounce.ts` takes, so a row drives the debouncer and the
 * cell-context scheduler through sequences of events and pauses on any load. The clock has rows of its own (`typing-debounce.test.ts`, "the fake clock"):
 * a row that counts evaluations is only as good as the clock it counts on.
 *
 * `advance(ms)` runs every timer due at or before `now + ms`, in order of due time and then of creation, including a timer that a run itself sets
 * if it falls due inside the window, and leaves `now` at the end of the window. A timer whose delay is NaN is never due. `clearTimeout` of a handle that is not a pending timer (one that has run, one cleared, one never set) does nothing on a
 * host and is COUNTED here (`staleClears`): the code under test has no reason to ask for it, and a row can say so.
 */
export interface FakeClock extends Timers {
  /** The milliseconds that have been advanced. */
  now(): number;
  advance(ms: number): void;
  /** How many timers are set and neither run nor cleared. */
  pending(): number;
  /** The delay every `setTimeout` was asked for, in order. */
  readonly delays: number[];
  /** How many `clearTimeout` calls named a handle that was not a pending timer. */
  staleClears(): number;
}

export function createFakeClock(): FakeClock {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { id: number; due: number; run: () => void }>();
  const delays: number[] = [];
  let staleClears = 0;
  return {
    now: () => now,
    delays,
    staleClears: () => staleClears,
    pending: () => timers.size,
    setTimeout(run, ms) {
      delays.push(ms);
      const id = nextId++;
      timers.set(id, { id, due: now + ms, run });
      return id;
    },
    clearTimeout(handle) {
      if (!timers.delete(handle as number)) {
        staleClears++;
      }
    },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let next: { id: number; due: number; run: () => void } | undefined;
        for (const timer of timers.values()) {
          if (timer.due <= target && (next === undefined || timer.due < next.due || (timer.due === next.due && timer.id < next.id))) {
            next = timer;
          }
        }
        if (next === undefined) break;
        timers.delete(next.id);
        now = Math.max(now, next.due);
        next.run();
      }
      now = target;
    },
  };
}
