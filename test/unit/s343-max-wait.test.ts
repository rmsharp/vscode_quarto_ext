import { describe, expect, it } from "vitest";
import {
  type EditorSnapshot,
  MAX_TIMER_DELAY_MS,
  TYPING_DEBOUNCE_MS,
  TYPING_MAX_WAIT_MS,
  createCellContextScheduler,
  createKeyedDebouncer,
} from "../../src/core/typing-debounce";
import { createFakeClock } from "./support/fake-timers";
import { seededRandom } from "./support/regex-equivalence";

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

describe("createKeyedDebouncer with a maximum wait -- the window", () => {
  it("the first schedule since a run asks the timer for the delay AND the maximum wait; a schedule inside the window asks for the delay only (the window is not restarted); the next window asks for both again", () => {
    const w = world({ maxWaitMs: TYPING_MAX_WAIT_MS });
    w.debouncer.schedule("a", w.run("one"));
    expect(w.clock.delays).toEqual([150, 1000]);
    w.clock.advance(20);
    w.debouncer.schedule("a", w.run("two"));
    expect(w.clock.delays).toEqual([150, 1000, 150]);
    expect(w.clock.pending()).toBe(2); // one trailing timer, one window timer
    w.clock.advance(150);
    expect(w.ran).toEqual(["two"]);
    expect(w.clock.pending()).toBe(0);
    w.debouncer.schedule("a", w.run("three"));
    expect(w.clock.delays).toEqual([150, 1000, 150, 150, 1000]);
  });

  it("a lone schedule runs at the delay and leaves no timer: the window's timer is cleared when the trailing timer runs, and no timer is cleared twice", () => {
    const w = world({ maxWaitMs: TYPING_MAX_WAIT_MS });
    w.debouncer.schedule("a", w.run("a"));
    w.clock.advance(TYPING_DEBOUNCE_MS - 1);
    expect(w.ran).toEqual([]);
    w.clock.advance(1);
    expect(w.ran).toEqual(["a"]);
    expect(w.clock.pending()).toBe(0);
    w.clock.advance(10_000);
    expect(w.ran).toEqual(["a"]);
    expect(w.clock.staleClears()).toBe(0);
  });

  it("an unbroken stream clears no timer that is not pending: the window's callback drops the trailing timer, and it is the only one that is dropped", () => {
    const s = stream(100, TYPING_MAX_WAIT_MS);
    expect(s.during.ran).toHaveLength(30);
    expect(s.clock.staleClears()).toBe(0);
    expect(s.clock.pending()).toBe(0);
  });

  it("the window runs the key once at its end whatever the trailing timer was doing: not a millisecond before 1,000 ms, and the trailing timer it dropped never runs the key again", () => {
    const w = world({ maxWaitMs: TYPING_MAX_WAIT_MS });
    for (let t = 0; t < 1_000; t += 100) {
      w.debouncer.schedule("a", w.run(`at ${t}`));
      w.clock.advance(100);
    } // the last schedule at 900; the clock is at 1,000, so the window's timer has run
    expect(w.ran).toEqual(["at 900"]);
    expect(w.ranAt).toEqual([1_000]);
    w.clock.advance(10_000);
    expect(w.ran).toEqual(["at 900"]);
  });

  it("a window that ends while the last schedule's trailing timer is still pending (due at 1,140; the window's at 1,000) runs the LATEST run, and the trailing timer it dropped never runs", () => {
    const w = world({ maxWaitMs: TYPING_MAX_WAIT_MS });
    for (let t = 0; t <= 900; t += 100) {
      w.clock.advance(t - w.clock.now());
      w.debouncer.schedule("a", w.run(`at ${t}`));
    }
    w.clock.advance(90);
    w.debouncer.schedule("a", w.run("latest")); // at 990, 90 ms after the one at 900
    expect(w.ran).toEqual([]);
    w.clock.advance(9);
    expect(w.ran).toEqual([]);
    w.clock.advance(1);
    expect(w.ran).toEqual(["latest"]);
    expect(w.ranAt).toEqual([1_000]);
    expect(w.clock.pending()).toBe(0);
    w.clock.advance(10_000);
    expect(w.ran).toHaveLength(1);
  });

  it("the trailing timer and the window's come due together (delay 150, maximum wait 150): ONE run, no timer left, none cleared twice", () => {
    const w = world({ delayMs: 150, maxWaitMs: 150 });
    w.debouncer.schedule("a", w.run("a"));
    w.clock.advance(149);
    expect(w.ran).toEqual([]);
    w.clock.advance(1);
    expect(w.ran).toEqual(["a"]);
    expect(w.clock.pending()).toBe(0);
    expect(w.clock.staleClears()).toBe(0);
    w.clock.advance(10_000);
    expect(w.ran).toEqual(["a"]);
  });

  it("a maximum wait shorter than the delay (100 against 150) makes the window's timer the first to fire: a lone schedule runs at 100, and a stream every 50 ms runs every 100 ms", () => {
    const lone = world({ delayMs: 150, maxWaitMs: 100 });
    lone.debouncer.schedule("a", lone.run("a"));
    lone.clock.advance(99);
    expect(lone.ran).toEqual([]);
    lone.clock.advance(1);
    expect(lone.ran).toEqual(["a"]);
    expect(lone.clock.pending()).toBe(0);
    const w = world({ delayMs: 150, maxWaitMs: 100 });
    for (let t = 0; t <= 1_000; t += 50) {
      w.clock.advance(t - w.clock.now());
      w.debouncer.schedule("a", w.run(String(t)));
    }
    expect(w.ranAt).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900, 1_000]);
    expect(w.ran).toEqual(["50", "150", "250", "350", "450", "550", "650", "750", "850", "950"]);
  });
});

describe("createKeyedDebouncer with a maximum wait -- what a maximum wait of any number means (the same rule as the delay: normalizeDelayMs)", () => {
  it.each([
    ["undefined: no window, no second timer (the debouncer as it was)", undefined, [150]],
    ["the constant", 1000, [150, 1000]],
    ["a fraction is kept: the host's timer rounds it", 1.5, [150, 1.5]],
    ["zero: the run comes due at the next timer turn", 0, [150, 0]],
    ["negative zero reads as zero", -0, [150, 0]],
    ["a negative reads as zero", -5, [150, 0]],
    ["minus infinity reads as zero", -Infinity, [150, 0]],
    ["NaN reads as zero: the fresh side, not an unbounded wait", NaN, [150, 0]],
    ["the longest delay a host timer holds", MAX_TIMER_DELAY_MS, [150, MAX_TIMER_DELAY_MS]],
    ["one past it (a Node timer resets such a delay to 1 ms)", MAX_TIMER_DELAY_MS + 1, [150, MAX_TIMER_DELAY_MS]],
    ["infinity is the longest delay a host timer holds, which no stream of edits reaches", Infinity, [150, MAX_TIMER_DELAY_MS]],
  ])("%s: %s asks the timer for %j", (_why, maxWaitMs, asked) => {
    const w = world({ maxWaitMs });
    w.debouncer.schedule("a", w.run("a"));
    expect(w.clock.delays).toEqual(asked);
    for (const delay of w.clock.delays) expect(Object.is(delay, -0)).toBe(false); // a minus zero is never handed to a timer
  });

  it.each([
    ["zero", 0],
    ["a negative", -5],
    ["minus infinity", -Infinity],
    ["NaN", NaN],
  ])("%s: schedules in one timer turn run ONCE, the latest, at the next turn (the debounce is off, a burst of one turn is still one run)", (_why, maxWaitMs) => {
    const w = world({ maxWaitMs });
    w.debouncer.schedule("a", w.run("one"));
    w.debouncer.schedule("a", w.run("two"));
    w.debouncer.schedule("a", w.run("three"));
    expect(w.ran).toEqual([]); // never synchronous
    w.clock.advance(0);
    expect(w.ran).toEqual(["three"]);
    expect(w.ranAt).toEqual([0]);
    expect(w.clock.pending()).toBe(0);
    w.clock.advance(10_000);
    expect(w.ran).toEqual(["three"]);
  });

  it("infinity is no limit in effect: an edit event every 100 ms for 30 s runs nothing before the stream ends, as with no maxWaitMs", () => {
    const s = stream(100, Infinity);
    expect(s.during.ran).toEqual([]);
    expect(s.afterwards).toBe(1);
  });
});

describe("createKeyedDebouncer with a maximum wait -- cancel and dispose clear BOTH timers", () => {
  it("cancel drops the pending run: neither the trailing timer nor the window's is left, and the window's timer never runs the cancelled run later", () => {
    const w = world({ maxWaitMs: TYPING_MAX_WAIT_MS });
    w.debouncer.schedule("a", w.run("dropped"));
    expect(w.clock.pending()).toBe(2);
    w.debouncer.cancel("a");
    expect(w.clock.pending()).toBe(0);
    w.clock.advance(10_000);
    expect(w.ran).toEqual([]);
    expect(w.clock.staleClears()).toBe(0);
  });

  it("cancel in the middle of a stream drops the window: the next schedule opens a NEW window, due a full maximum wait after it (not at the old window's end)", () => {
    const w = world({ maxWaitMs: TYPING_MAX_WAIT_MS });
    for (let t = 0; t < 500; t += 100) {
      w.debouncer.schedule("a", w.run(`before ${t}`));
      w.clock.advance(100);
    } // the clock is at 500: the old window would end at 1,000
    w.debouncer.cancel("a");
    for (let t = 500; t < 1_400; t += 100) {
      w.debouncer.schedule("a", w.run(`after ${t}`));
      w.clock.advance(100);
    }
    expect(w.ran).toEqual([]); // the clock is at 1,400: the old window's end passed without a run
    w.debouncer.schedule("a", w.run("after 1400"));
    w.clock.advance(100);
    expect(w.ran).toEqual(["after 1400"]);
    expect(w.ranAt).toEqual([1_500]); // 500 + 1,000
    expect(w.clock.staleClears()).toBe(0);
  });

  it("cancel leaves the other keys alone: their trailing timers and their windows still run them", () => {
    const w = world({ maxWaitMs: TYPING_MAX_WAIT_MS });
    w.debouncer.schedule("a", w.run("a"));
    w.debouncer.schedule("b", w.run("b"));
    w.debouncer.cancel("a");
    expect(w.clock.pending()).toBe(2);
    w.clock.advance(TYPING_DEBOUNCE_MS);
    expect(w.ran).toEqual(["b"]);
    expect(w.clock.pending()).toBe(0);
  });

  it("cancel is harmless for a key never scheduled, one that ran, and one cancelled twice: no timer is cleared that is not pending", () => {
    const w = world({ maxWaitMs: TYPING_MAX_WAIT_MS });
    w.debouncer.cancel("never");
    w.debouncer.schedule("a", w.run("a"));
    w.clock.advance(TYPING_DEBOUNCE_MS);
    w.debouncer.cancel("a");
    w.debouncer.schedule("b", w.run("b"));
    w.debouncer.cancel("b");
    w.debouncer.cancel("b");
    expect(w.ran).toEqual(["a"]);
    expect(w.clock.staleClears()).toBe(0);
    expect(w.clock.pending()).toBe(0);
  });

  it("dispose drops every pending run of every key, with both timers each, and later schedules set no timer at all (not the trailing one, not a window's)", () => {
    const w = world({ maxWaitMs: TYPING_MAX_WAIT_MS });
    w.debouncer.schedule("a", w.run("a"));
    w.debouncer.schedule("b", w.run("b"));
    w.debouncer.schedule("c", w.run("c"));
    expect(w.clock.pending()).toBe(6);
    w.clock.advance(TYPING_DEBOUNCE_MS - 1);
    w.debouncer.dispose();
    expect(w.clock.pending()).toBe(0);
    const asked = w.clock.delays.length;
    w.debouncer.schedule("a", w.run("late"));
    expect(w.clock.delays).toHaveLength(asked);
    expect(w.clock.pending()).toBe(0);
    w.clock.advance(10_000);
    expect(w.ran).toEqual([]);
    w.debouncer.dispose();
    w.debouncer.cancel("a");
    expect(w.clock.staleClears()).toBe(0);
  });

  it("dispose in the middle of a stream: the window's timer never runs the key after it", () => {
    const w = world({ maxWaitMs: TYPING_MAX_WAIT_MS });
    for (let t = 0; t < 800; t += 100) {
      w.debouncer.schedule("a", w.run(`at ${t}`));
      w.clock.advance(100);
    }
    w.debouncer.dispose();
    w.clock.advance(10_000);
    expect(w.ran).toEqual([]);
  });

  it("a run that disposes the debouncer from inside stops the rest of the keys, trailing timers and windows alike", () => {
    const w = world({ maxWaitMs: TYPING_MAX_WAIT_MS });
    w.debouncer.schedule("a", () => {
      w.ran.push("a");
      w.debouncer.dispose();
    });
    w.debouncer.schedule("b", w.run("b"));
    w.clock.advance(TYPING_DEBOUNCE_MS);
    expect(w.ran).toEqual(["a"]);
    expect(w.clock.pending()).toBe(0);
    w.clock.advance(10_000);
    expect(w.ran).toEqual(["a"]);
  });
});

describe("createKeyedDebouncer with a maximum wait -- a run is over before it runs", () => {
  it("a run that schedules its own key again, fired by the TRAILING timer, opens a fresh window: the second run comes one delay later, and the schedule inside the run asked for both timers again", () => {
    const w = world({ maxWaitMs: TYPING_MAX_WAIT_MS });
    let again = true;
    const run = (): void => {
      w.ran.push(`run at ${w.clock.now()}`);
      if (again) {
        again = false;
        w.debouncer.schedule("a", run);
      }
    };
    w.debouncer.schedule("a", run);
    w.clock.advance(TYPING_DEBOUNCE_MS);
    expect(w.ran).toEqual(["run at 150"]);
    expect(w.clock.delays).toEqual([150, 1000, 150, 1000]);
    expect(w.clock.pending()).toBe(2);
    w.clock.advance(TYPING_DEBOUNCE_MS);
    expect(w.ran).toEqual(["run at 150", "run at 300"]);
    expect(w.clock.pending()).toBe(0);
    w.clock.advance(10_000);
    expect(w.ran).toHaveLength(2);
    expect(w.clock.staleClears()).toBe(0);
  });

  it("a run that schedules its own key again from the WINDOW's timer, in a stream, opens the next window at that moment: the next run is a full maximum wait later, and it runs the latest closure", () => {
    const w = world({ maxWaitMs: TYPING_MAX_WAIT_MS });
    let rescheduled = false;
    const rescheduling = (): void => {
      w.ran.push(`first at ${w.clock.now()}`);
      w.ranAt.push(w.clock.now());
      if (!rescheduled) {
        rescheduled = true;
        w.debouncer.schedule("a", w.run("from the run"));
      }
    };
    for (let t = 0; t <= 2_900; t += 100) {
      w.clock.advance(t - w.clock.now());
      w.debouncer.schedule("a", t === 900 ? rescheduling : w.run(String(t)));
    }
    // The window opened at 0 ends at 1,000 and runs the schedule of 900, which schedules the key again: that schedule opens a window at 1,000, and the events of 1,000 and after keep it open until 2,000.
    expect(w.ran).toEqual(["first at 1000", "1900"]);
    expect(w.ranAt).toEqual([1_000, 2_000]);
    w.clock.advance(100); // the window the event at 2,000 opened ends at 3,000
    expect(w.ran).toEqual(["first at 1000", "1900", "2900"]);
    expect(w.ranAt).toEqual([1_000, 2_000, 3_000]);
    expect(w.clock.staleClears()).toBe(0);
  });

  it("a run that schedules its own key again from the window's timer runs the trailing timer's second run if the stream stops (the window dropped the old trailing timer before the run)", () => {
    const w = world({ maxWaitMs: TYPING_MAX_WAIT_MS });
    let again = true;
    const run = (): void => {
      w.ran.push(`run at ${w.clock.now()}`);
      if (again) {
        again = false;
        w.debouncer.schedule("a", run);
      }
    };
    for (let t = 0; t <= 900; t += 100) {
      w.clock.advance(t - w.clock.now());
      w.debouncer.schedule("a", run);
    }
    w.clock.advance(100); // the window's timer runs the key at 1,000 and the run schedules it again
    expect(w.ran).toEqual(["run at 1000"]);
    expect(w.clock.pending()).toBe(2);
    w.clock.advance(TYPING_DEBOUNCE_MS);
    expect(w.ran).toEqual(["run at 1000", "run at 1150"]);
    expect(w.clock.pending()).toBe(0);
    expect(w.clock.staleClears()).toBe(0);
  });

  it("a throwing run is reported to onError, whichever timer fired it, and leaves the key free: the next schedule opens a new window and runs", () => {
    const errors: unknown[] = [];
    const w = world({ maxWaitMs: TYPING_MAX_WAIT_MS, onError: (error) => errors.push(error) });
    const boom = new Error("boom");
    const throwing = (): void => {
      throw boom;
    };
    w.debouncer.schedule("a", throwing);
    w.clock.advance(TYPING_DEBOUNCE_MS); // the trailing timer fires it, at 150
    expect(errors).toEqual([boom]);
    expect(w.clock.pending()).toBe(0);
    for (let t = 0; t < 1_000; t += 100) {
      w.debouncer.schedule("a", throwing);
      w.clock.advance(100);
    } // a window opened at 150 ends at 1,150, when the clock is there: the window's timer fires the second throw
    expect(errors).toEqual([boom, boom]);
    expect(w.clock.pending()).toBe(0);
    w.debouncer.schedule("a", w.run("fine"));
    expect(w.clock.delays.slice(-2)).toEqual([150, 1000]);
    w.clock.advance(TYPING_DEBOUNCE_MS);
    expect(w.ran).toEqual(["fine"]);
    expect(w.clock.staleClears()).toBe(0);
  });
});

describe("createKeyedDebouncer with a maximum wait -- keys are independent", () => {
  it("key A's window runs A and only A: B's trailing timer, window and latest run are untouched, and each key's window is counted from its own first schedule", () => {
    const w = world({ maxWaitMs: TYPING_MAX_WAIT_MS });
    for (let t = 0; t <= 1_400; t += 100) {
      w.clock.advance(t - w.clock.now());
      w.debouncer.schedule("a", w.run(`a ${t}`));
      if (t >= 500) w.debouncer.schedule("b", w.run(`b ${t}`)); // B's window opens at 500
    }
    expect(w.ran).toEqual(["a 900"]); // A's window ended at 1,000; B's ends at 1,500
    expect(w.ranAt).toEqual([1_000]);
    expect(w.clock.pending()).toBe(4); // A: trailing + the window opened at 1,000; B: trailing + window
    w.clock.advance(100);
    expect(w.ran).toEqual(["a 900", "b 1400"]);
    expect(w.ranAt).toEqual([1_000, 1_500]);
  });

  it("two keys scheduled together with a window each both run once at the end of the window, in the order they were scheduled", () => {
    const w = world({ maxWaitMs: TYPING_MAX_WAIT_MS });
    for (let t = 0; t < 1_000; t += 100) {
      w.debouncer.schedule("x", w.run(`x ${t}`));
      w.debouncer.schedule("y", w.run(`y ${t}`));
      w.clock.advance(100);
    }
    expect(w.ran).toEqual(["x 900", "y 900"]);
    expect(w.ranAt).toEqual([1_000, 1_000]);
    expect(w.clock.pending()).toBe(0);
  });
});

// ---- THE CELL-CONTEXT SCHEDULER -------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/** The cell-context scheduler on a fake clock, over an editor whose state the rows change the way VS Code does: an edit bumps the version, a cursor move changes the line. Each evaluation records the time and what it saw. */
function schedulerWorld(options: { delayMs?: number; maxWaitMs?: number; onError?: (error: unknown) => void; evaluate?: () => void } = {}) {
  const clock = createFakeClock();
  const state = { active: true, key: "file:///a.qmd", version: 1, line: 0 };
  const seen: Array<{ at: number; version: number; line: number }> = [];
  const errors: unknown[] = [];
  const scheduler = createCellContextScheduler({
    timers: clock,
    delayMs: options.delayMs ?? TYPING_DEBOUNCE_MS,
    maxWaitMs: options.maxWaitMs,
    activeSnapshot: (): EditorSnapshot | undefined => (state.active ? { key: state.key, version: state.version } : undefined),
    evaluate: () => {
      options.evaluate?.();
      seen.push({ at: clock.now(), version: state.version, line: state.line });
    },
    onError: options.onError ?? ((error) => errors.push(error)),
  });
  /** One keystroke as VS Code reports it: the document event, then the selection event. */
  const keystroke = (line: number): void => {
    state.version++;
    scheduler.changed();
    state.line = line;
    scheduler.changed();
  };
  return { clock, state, seen, errors, scheduler, keystroke };
}

/** One keystroke every `gap` ms from 0 to 30 s (the document event and the selection event of each); the evaluations done before the stream ends, and the last event's version. */
function keystrokeStream(gap: number, maxWaitMs: number | undefined) {
  const w = schedulerWorld({ maxWaitMs });
  w.scheduler.evaluateNow(); // the activation-time evaluation, at 0
  const events: Array<{ at: number; version: number }> = [];
  for (let t = 0; t <= 30_000; t += gap) {
    w.clock.advance(t - w.clock.now());
    w.keystroke(t % 97);
    events.push({ at: t, version: w.state.version });
  }
  const during = w.seen.length - 1; // not counting the activation
  const duringSeen = w.seen.slice(1);
  w.clock.advance(2_000);
  return { ...w, events, during, duringSeen };
}

describe("createCellContextScheduler with a maximum wait -- a stream of keystrokes (a fake clock; the gap between keystrokes is stated in each title)", () => {
  it("CONTROL: with no maxWaitMs a keystroke every 100 ms for 30 s (301 keystrokes) evaluates NOTHING before the stream ends: the limitation, kept as it was", () => {
    const s = keystrokeStream(100, undefined);
    expect(s.events).toHaveLength(301);
    expect(s.during).toBe(0);
  });

  it.each([
    [100, 301, 30],
    [50, 601, 30],
    [149, 202, 28],
  ])("a keystroke every %i ms for 30 s (%i keystrokes) evaluates %i times before the stream ends, each time on the state AS IT IS when the evaluation runs, one per window", (gap, keystrokes, evaluations) => {
    const s = keystrokeStream(gap, TYPING_MAX_WAIT_MS);
    expect(s.events).toHaveLength(keystrokes);
    expect(s.during).toBe(evaluations);
    // The evaluation reads the editor when the timer fires: the last keystroke before it (a keystroke is a document event and a selection event, so the version moved once and the line with it).
    for (const evaluation of s.duringSeen) {
      const last = s.events.filter((event) => event.at < evaluation.at).pop();
      expect(last).toBeDefined();
      expect(evaluation.version).toBe(last?.version);
      expect(evaluation.line).toBe((last?.at ?? 0) % 97);
    }
    expect(s.clock.staleClears()).toBe(0);
  });

  it("a keystroke every 151 ms for 30 s (199 keystrokes) evaluates 198 times before the stream ends: unchanged by the maximum wait (the same as with none)", () => {
    const withMax = keystrokeStream(151, TYPING_MAX_WAIT_MS);
    const without = keystrokeStream(151, undefined);
    expect(withMax.events).toHaveLength(199);
    expect(withMax.during).toBe(198);
    expect(without.during).toBe(198);
    expect(withMax.duringSeen).toEqual(without.duringSeen);
  });

  it.each([50, 100, 149, 151])("a keystroke every %i ms: the key lags every keystroke by at most TYPING_MAX_WAIT_MS (the stale window of the five chords that read quarto.inCodeCell is bounded by it)", (gap) => {
    const s = keystrokeStream(gap, TYPING_MAX_WAIT_MS);
    // For each keystroke, the first evaluation at or after it that saw its version (or a later one) must come within the maximum wait.
    const evaluations = s.seen;
    let worst = 0;
    for (const event of s.events) {
      const covering = evaluations.find((evaluation) => evaluation.at >= event.at && evaluation.version >= event.version);
      expect(covering).toBeDefined();
      worst = Math.max(worst, (covering?.at ?? Infinity) - event.at);
    }
    expect(worst).toBeLessThanOrEqual(TYPING_MAX_WAIT_MS);
    if (gap === 100) expect(worst).toBe(TYPING_MAX_WAIT_MS); // the first keystroke of a window waits the whole of it
  });

  it("a burst of 40 keystrokes 10 ms apart evaluates ONCE, one delay after the last, on the last state", () => {
    const w = schedulerWorld({ maxWaitMs: TYPING_MAX_WAIT_MS });
    w.scheduler.evaluateNow();
    for (let i = 1; i <= 40; i++) {
      w.keystroke(10 + i);
      w.clock.advance(10);
    }
    expect(w.seen).toHaveLength(1);
    w.clock.advance(TYPING_DEBOUNCE_MS - 10);
    expect(w.seen).toEqual([
      { at: 0, version: 1, line: 0 },
      { at: 40 * 10 - 10 + TYPING_DEBOUNCE_MS, version: 41, line: 50 },
    ]);
    expect(w.clock.pending()).toBe(0);
    w.clock.advance(10_000);
    expect(w.seen).toHaveLength(2);
  });

  it("asks the timer for the delay and the maximum wait at the first event of a window, and for the delay only at the rest; with no maxWaitMs it asks for the delay only", () => {
    const w = schedulerWorld({ maxWaitMs: TYPING_MAX_WAIT_MS });
    w.scheduler.evaluateNow();
    w.keystroke(2);
    expect(w.clock.delays).toEqual([150, 1000, 150]); // the document event opens the window, the selection event restarts the trailing timer
    const plain = schedulerWorld();
    plain.scheduler.evaluateNow();
    plain.keystroke(2);
    expect(plain.clock.delays).toEqual([150, 150]);
  });

  it("a maximum wait shorter than the delay (100 against 150) evaluates at 100", () => {
    const w = schedulerWorld({ delayMs: 150, maxWaitMs: 100 });
    w.scheduler.evaluateNow();
    w.keystroke(3);
    w.clock.advance(99);
    expect(w.seen).toHaveLength(1);
    w.clock.advance(1);
    expect(w.seen.map((e) => e.at)).toEqual([0, 100]);
  });
});

describe("createCellContextScheduler with a maximum wait -- the immediate paths drop BOTH timers", () => {
  it("evaluateNow in the middle of a stream evaluates at once and leaves no timer: neither the trailing one nor the window's runs afterwards, and the next keystroke opens a new window", () => {
    const w = schedulerWorld({ maxWaitMs: TYPING_MAX_WAIT_MS });
    w.scheduler.evaluateNow();
    for (let t = 0; t < 500; t += 100) {
      w.keystroke(t);
      w.clock.advance(100);
    } // the clock is at 500; the window would end at 1,000
    expect(w.clock.pending()).toBe(2);
    w.scheduler.evaluateNow();
    expect(w.clock.pending()).toBe(0);
    const evaluated = w.seen.length;
    w.clock.advance(10_000);
    expect(w.seen).toHaveLength(evaluated);
    w.keystroke(7);
    expect(w.clock.delays.slice(-3)).toEqual([150, 1000, 150]); // a new window
    expect(w.clock.staleClears()).toBe(0);
  });

  it("an event that follows no edit (the editor is gone, so the snapshot is none) evaluates at once and drops both timers: nothing runs at the end of the window", () => {
    const w = schedulerWorld({ maxWaitMs: TYPING_MAX_WAIT_MS });
    w.scheduler.evaluateNow();
    w.keystroke(2);
    expect(w.clock.pending()).toBe(2);
    w.state.active = false;
    w.scheduler.changed();
    expect(w.seen).toHaveLength(2);
    expect(w.clock.pending()).toBe(0);
    w.clock.advance(10_000);
    expect(w.seen).toHaveLength(2);
    expect(w.clock.staleClears()).toBe(0);
  });

  it("a cursor move after an evaluation (no edit since) evaluates at once and sets no timer, with a maximum wait as without", () => {
    const w = schedulerWorld({ maxWaitMs: TYPING_MAX_WAIT_MS });
    w.scheduler.evaluateNow();
    for (let line = 1; line <= 5; line++) {
      w.state.line = line;
      w.scheduler.changed();
    }
    expect(w.seen.map((e) => e.line)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(w.clock.pending()).toBe(0);
    expect(w.clock.delays).toEqual([]);
  });

  it("dispose drops both timers of the pending evaluation, and later events set none", () => {
    const w = schedulerWorld({ maxWaitMs: TYPING_MAX_WAIT_MS });
    w.scheduler.evaluateNow();
    w.keystroke(2);
    expect(w.clock.pending()).toBe(2);
    w.scheduler.dispose();
    expect(w.clock.pending()).toBe(0);
    w.keystroke(3);
    expect(w.clock.pending()).toBe(0);
    w.clock.advance(10_000);
    expect(w.seen).toHaveLength(1);
    expect(w.clock.staleClears()).toBe(0);
  });
});

describe("createCellContextScheduler with a maximum wait -- an evaluation that throws", () => {
  it("one fired by the window's timer is reported to onError, the version is not recorded as evaluated, and the next event opens a new window and retries", () => {
    let failures = 1;
    const w = schedulerWorld({
      maxWaitMs: TYPING_MAX_WAIT_MS,
      evaluate: () => {
        if (failures-- > 0) throw new Error("setContext failed");
      },
    });
    w.state.version = 2;
    for (let t = 0; t <= 1_000; t += 100) {
      w.clock.advance(t - w.clock.now());
      w.state.version++;
      w.scheduler.changed();
    } // the window's timer fires the failing evaluation at 1,000 (the trailing timer never came due)
    expect(w.errors.map((e) => (e as Error).message)).toEqual(["setContext failed"]);
    expect(w.seen).toHaveLength(0);
    w.state.line = 9;
    w.scheduler.changed(); // the version was not recorded as evaluated: debounced, in a new window
    expect(w.seen).toHaveLength(0);
    expect(w.clock.pending()).toBe(2);
    w.clock.advance(TYPING_DEBOUNCE_MS);
    expect(w.seen.map((e) => e.line)).toEqual([9]);
    expect(w.clock.pending()).toBe(0);
  });
});

// ---- THE DEBOUNCER WITH A MAXIMUM WAIT AGAINST A MODEL OF ITS SPEC ----------------------------------------------------------------------------------------------------------------------------------

type Op = { op: "schedule"; key: string; again?: true } | { op: "cancel"; key: string } | { op: "advance"; ms: number } | { op: "dispose" };

/**
 * The spec of a keyed debouncer with a maximum wait as a plain model, written from the spec and not from the code: a list of timers `{ key, kind, due, id }` (the ids are the order they were set in, which breaks ties as the fake
 * clock does), the latest run of each key, a run log, a clock. A schedule drops the key's trailing timer and sets a new one; with a maximum wait it also sets the window's timer if the key has none, and either way the
 * latest run is the one just scheduled. The timer due first runs the latest run of its key and drops the other timer of the key before it runs. No real timers, no table of handles.
 */
function modelOfWindowSpec(delayMs: number, maxWaitMs: number | undefined) {
  let now = 0;
  let nextId = 0;
  let disposed = false;
  type Timer = { key: string; kind: "trailing" | "window"; due: number; id: number };
  let timers: Timer[] = [];
  const latest = new Map<string, { label: string; again?: string }>();
  const log: string[] = [];
  const dropKey = (key: string, kind?: "trailing" | "window"): void => {
    timers = timers.filter((t) => !(t.key === key && (kind === undefined || t.kind === kind)));
  };
  const model = {
    log,
    schedule(key: string, label: string, again?: string): void {
      if (disposed) return;
      dropKey(key, "trailing");
      timers.push({ key, kind: "trailing", due: now + delayMs, id: nextId++ });
      if (maxWaitMs !== undefined && !timers.some((t) => t.key === key && t.kind === "window")) {
        timers.push({ key, kind: "window", due: now + maxWaitMs, id: nextId++ });
      }
      latest.set(key, { label, again });
    },
    cancel(key: string): void {
      dropKey(key);
    },
    dispose(): void {
      disposed = true;
      timers = [];
    },
    advance(ms: number): void {
      const target = now + ms;
      for (;;) {
        const due = timers.filter((t) => t.due <= target).sort((a, b) => a.due - b.due || a.id - b.id)[0];
        if (due === undefined) break;
        now = Math.max(now, due.due);
        dropKey(due.key);
        const run = latest.get(due.key);
        if (run !== undefined) {
          log.push(`${due.key}:${run.label}`);
          if (run.again !== undefined) model.schedule(due.key, run.again);
        }
      }
      now = target;
    },
    pending: () => timers.length,
  };
  return model;
}

describe("createKeyedDebouncer with a maximum wait agrees with a model of its spec on seeded operation sequences (schedule, a run that schedules its own key, cancel, advance, dispose over three keys)", () => {
  it("runs the same runs, in the same order, with the same number of timers pending after every operation, on 4,000 sequences of 5 to 60 operations at six delays and seven maximum waits (undefined among them)", () => {
    const random = seededRandom(3431);
    const keys = ["a", "b", "c"];
    const advances = [0, 1, 10, 49, 50, 51, 99, 100, 149, 150, 151, 399, 400, 999, 1_000, 1_001];
    const delays = [150, 0, 50, 25.5, 100, 1];
    const maxWaits: Array<number | undefined> = [1_000, 100, 150, 0, 400, 25.5, undefined];
    let ran = 0;
    let ranByWindow = 0;
    const mismatches: string[] = [];
    for (let n = 0; n < 4_000; n++) {
      const ops: Op[] = [];
      const length = 5 + Math.floor(random() * 56);
      for (let k = 0; k < length; k++) {
        const draw = random();
        const key = keys[Math.floor(random() * keys.length)];
        if (draw < 0.4) ops.push({ op: "schedule", key });
        else if (draw < 0.5) ops.push({ op: "schedule", key, again: true });
        else if (draw < 0.58) ops.push({ op: "cancel", key });
        else if (draw < 0.995) ops.push({ op: "advance", ms: advances[Math.floor(random() * advances.length)] });
        else ops.push({ op: "dispose" });
      }
      ops.push({ op: "advance", ms: 3_000 });
      const delayMs = delays[n % delays.length];
      const maxWaitMs = maxWaits[Math.floor(n / delays.length) % maxWaits.length];

      const clock = createFakeClock();
      const actual: string[] = [];
      const debouncer = createKeyedDebouncer({ timers: clock, delayMs, maxWaitMs });
      const model = modelOfWindowSpec(delayMs, maxWaitMs);
      const pendingActual: number[] = [];
      const pendingExpected: number[] = [];
      let label = 0;
      for (const o of ops) {
        switch (o.op) {
          case "schedule": {
            const id = String(label++);
            if (o.again === true) {
              const again = String(label++);
              debouncer.schedule(o.key, () => {
                actual.push(`${o.key}:${id}`);
                debouncer.schedule(o.key, () => actual.push(`${o.key}:${again}`));
              });
              model.schedule(o.key, id, again);
            } else {
              debouncer.schedule(o.key, () => actual.push(`${o.key}:${id}`));
              model.schedule(o.key, id);
            }
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
      ran += actual.length;
      // the draw reaches the window: a sequence whose runs outnumber what the trailing timers alone would give is counted by the maximum wait being shorter than the delay, below
      if (maxWaitMs !== undefined && maxWaitMs < delayMs) ranByWindow += actual.length;
      if (JSON.stringify(actual) !== JSON.stringify(model.log) || JSON.stringify(pendingActual) !== JSON.stringify(pendingExpected) || clock.staleClears() !== 0) {
        if (mismatches.length < 3) mismatches.push(`delay ${delayMs}, max wait ${maxWaitMs}: ${JSON.stringify(ops)} -> ${JSON.stringify(actual)} against the model's ${JSON.stringify(model.log)} (stale clears ${clock.staleClears()})`);
      }
    }
    expect(mismatches).toEqual([]);
    expect(ran).toBeGreaterThan(20_000);
    expect(ranByWindow).toBeGreaterThan(1_000);
  });

  it("the model itself: a window opens at the first schedule since a run and ends at the maximum wait whatever later schedules do; the latest run runs; the other timer of the key goes with it", () => {
    const m = modelOfWindowSpec(150, 400);
    m.schedule("a", "1");
    expect(m.pending()).toBe(2);
    m.advance(100);
    m.schedule("a", "2"); // the trailing timer moves to 250; the window stays at 400
    m.advance(100);
    m.schedule("a", "3"); // 200: the trailing timer moves to 350
    m.advance(100);
    m.schedule("a", "4"); // 300: the trailing timer moves to 450, past the window's 400
    expect(m.log).toEqual([]);
    m.advance(99);
    expect(m.log).toEqual([]);
    m.advance(1); // 400: the window ends, runs the latest and takes the trailing timer with it
    expect(m.log).toEqual(["a:4"]);
    expect(m.pending()).toBe(0);
    m.schedule("a", "5"); // a new window, at 800
    m.schedule("b", "6", "7");
    expect(m.pending()).toBe(4);
    m.advance(1_000); // a runs at 550, b at 550 then again at 700
    expect(m.log).toEqual(["a:4", "a:5", "b:6", "b:7"]);
    m.schedule("c", "8");
    m.dispose();
    m.advance(1_000);
    expect(m.log).toHaveLength(4);
    expect(m.pending()).toBe(0);
  });
});
