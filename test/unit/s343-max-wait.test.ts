import { describe, expect, it } from "vitest";
import { MAX_TIMER_DELAY_MS, TYPING_DEBOUNCE_MS, TYPING_MAX_WAIT_MS, createKeyedDebouncer } from "../../src/core/typing-debounce";
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
