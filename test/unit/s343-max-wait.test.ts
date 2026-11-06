import { describe, expect, it } from "vitest";
import { TYPING_DEBOUNCE_MS, TYPING_MAX_WAIT_MS, createKeyedDebouncer } from "../../src/core/typing-debounce";
import { createFakeClock } from "./support/fake-timers";

// Session 343 -- the BACKLOG item "What Session 342's review round found beside the typing-path cures, none of them in its diff", part (2), first cost: the typing path's trailing debounce had NO MAXIMUM WAIT. Events that keep
// arriving less than 150 ms apart postponed the evaluation (and the cell tint) for as long as they kept coming: on a fake clock, an edit event every 100 ms for 30 s gave 301 events and 0 evaluations before the stream ended
// (gaps of 50 and 149 ms the same; a gap of 151 ms gave 198). The cure is an optional `maxWaitMs`: the first schedule of a key since its last run starts a second timer, each schedule restarts the trailing timer, and whichever
// fires first runs the LATEST run once and clears both. These are the debouncer's rows; the cell-context scheduler's are further down, and how the two adapters hand the constant to them is
// `s343-max-wait-wiring-pin.test.ts`.
//
// EVERY clock here is `createFakeClock()` (`support/fake-timers.ts`, whose own rows are in `typing-debounce.test.ts`): no row waits in real time, so no load can move a figure. The gap between the events of a stream is stated beside
// each figure; a burst's keystrokes are 10 ms apart.

/** A keyed debouncer on a fake clock, and what its runs did, in order (each run records the label it was scheduled with and the time it ran). */
function world(options: { delayMs?: number; maxWaitMs?: number; onError?: (error: unknown) => void } = {}) {
  const clock = createFakeClock();
  const ran: string[] = [];
  const ranAt: number[] = [];
  const debouncer = createKeyedDebouncer({
    timers: clock,
    delayMs: options.delayMs ?? TYPING_DEBOUNCE_MS,
    maxWaitMs: options.maxWaitMs,
    onError: options.onError,
  });
  const run = (label: string) => () => {
    ran.push(label);
    ranAt.push(clock.now());
  };
  return { clock, ran, ranAt, debouncer, run };
}

/** An edit event every `gap` ms from 0 to 30 s on one key, each scheduling a run labelled by its time; the runs that ran before the stream ended (before the last event is scheduled, the way the clock rows count). */
function stream(gap: number, maxWaitMs: number | undefined) {
  const w = world({ maxWaitMs });
  let events = 0;
  for (let t = 0; t <= 30_000; t += gap) {
    w.clock.advance(t - w.clock.now());
    w.debouncer.schedule("doc", w.run(String(t)));
    events++;
  }
  const during = { ran: [...w.ran], ranAt: [...w.ranAt] };
  w.clock.advance(2_000);
  return { ...w, events, during, afterwards: w.ran.length };
}

describe("TYPING_MAX_WAIT_MS", () => {
  it("is one second, the lead's choice for the longest an unbroken stream of edits may postpone a run, and longer than the debounce delay", () => {
    expect(TYPING_MAX_WAIT_MS).toBe(1000);
    expect(TYPING_MAX_WAIT_MS).toBeGreaterThan(TYPING_DEBOUNCE_MS);
  });
});

describe("createKeyedDebouncer with a maximum wait -- an unbroken stream of edit events (a fake clock; the gap between events is stated in each title)", () => {
  it("CONTROL: with no maxWaitMs an edit event every 100 ms for 30 s (301 events) runs NOTHING before the stream ends, and once after it: the limitation, kept as it was", () => {
    const s = stream(100, undefined);
    expect(s.events).toBe(301);
    expect(s.during.ran).toEqual([]);
    expect(s.afterwards).toBe(1);
  });

  it("an edit event every 100 ms for 30 s (301 events) runs 30 times before the stream ends, one per second, each time the LATEST run (the event before the run was due)", () => {
    const s = stream(100, TYPING_MAX_WAIT_MS);
    expect(s.events).toBe(301);
    expect(s.during.ran).toHaveLength(30); // floor(30000 / 1000)
    expect(s.during.ranAt).toEqual(Array.from({ length: 30 }, (_, i) => 1_000 * (i + 1)));
    expect(s.during.ran).toEqual(Array.from({ length: 30 }, (_, i) => String(1_000 * (i + 1) - 100))); // the event at 900 ran at 1,000: the one at 1,000 is the next window's
    expect(s.afterwards).toBe(31); // and the last event's run, one delay after the stream ends
  });

  it("an edit event every 50 ms for 30 s (601 events) runs 30 times before the stream ends, at the same seconds", () => {
    const s = stream(50, TYPING_MAX_WAIT_MS);
    expect(s.events).toBe(601);
    expect(s.during.ranAt).toEqual(Array.from({ length: 30 }, (_, i) => 1_000 * (i + 1)));
    expect(s.during.ran).toEqual(Array.from({ length: 30 }, (_, i) => String(1_000 * (i + 1) - 50)));
  });

  it("an edit event every 149 ms for 30 s (202 events) runs 28 times before the stream ends: a window opens at the first event AFTER a run, up to one gap later, so each window is 1,043 ms (seven events) and not 1,000", () => {
    const s = stream(149, TYPING_MAX_WAIT_MS);
    expect(s.events).toBe(202);
    expect(s.during.ranAt).toEqual(Array.from({ length: 28 }, (_, i) => 1_000 + 1_043 * i));
    expect(s.during.ran).toHaveLength(28);
    expect(s.during.ran[0]).toBe(String(149 * 6)); // the event at 894 ran at 1,000: the one at 1,043 opens the second window
    expect(s.during.ran[1]).toBe(String(149 * 13));
  });

  it("an edit event every 151 ms (198 runs before the stream ends) is unchanged: each event's run fires one delay after it, before the next event, so the maximum wait never comes due", () => {
    const withMax = stream(151, TYPING_MAX_WAIT_MS);
    const without = stream(151, undefined);
    expect(withMax.events).toBe(199);
    expect(withMax.during.ran).toHaveLength(198);
    expect(withMax.during.ran).toEqual(without.during.ran);
    expect(withMax.during.ranAt).toEqual(without.during.ranAt);
    expect(withMax.during.ranAt[0]).toBe(TYPING_DEBOUNCE_MS);
    expect(withMax.clock.pending()).toBe(0);
  });
});

describe("createKeyedDebouncer with a maximum wait -- a burst is still ONE run", () => {
  it("40 keystrokes 10 ms apart run ONCE, one delay after the last, with the last run, and leave no timer behind", () => {
    const w = world({ maxWaitMs: TYPING_MAX_WAIT_MS });
    for (let i = 1; i <= 40; i++) {
      w.debouncer.schedule("doc", w.run(`keystroke ${i}`));
      w.clock.advance(10);
    }
    expect(w.ran).toEqual([]);
    w.clock.advance(TYPING_DEBOUNCE_MS - 10 - 1);
    expect(w.ran).toEqual([]);
    w.clock.advance(1);
    expect(w.ran).toEqual(["keystroke 40"]);
    expect(w.ranAt).toEqual([40 * 10 - 10 + TYPING_DEBOUNCE_MS]);
    expect(w.clock.pending()).toBe(0);
    w.clock.advance(10_000);
    expect(w.ran).toHaveLength(1);
  });
});
