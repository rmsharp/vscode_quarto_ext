import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_TIMER_DELAY_MS,
  TYPING_DEBOUNCE_MS,
  createKeyedDebouncer,
  normalizeDelayMs,
  realTimers,
} from "../../src/core/typing-debounce";
import { createFakeClock } from "./support/fake-timers";

// Session 342 -- the BACKLOG item "What Session 341's review round found beside the Outline and preview cures", part (4). The cell-background decorator re-applied its tint on EVERY edit of a visible document
// (`cellBackgroundRanges(text)` -- a whole-document region scan, 12.7 / 31.7 / 155 ms at 500 / 2,000 / 8,000 twenty-line cells -- and then `setDecorations` with every cell's range), and `updateCellContext` did the
// same scan for the `quarto.inCodeCell` key. `createKeyedDebouncer` is the core of the cure: a trailing debouncer with one pending run per key, on timers that a fake clock drives. Its rows are here; the sequences of
// events that the cell-context key goes through are the rows of `s342-typing-path-rows.test.ts`.

describe("the fake clock (the rows below count on it: Learning 910 -- a row that counts evaluations is only as good as its clock)", () => {
  it("runs a timer due exactly at the end of the window, and not one due a millisecond later", () => {
    const clock = createFakeClock();
    const ran: string[] = [];
    clock.setTimeout(() => ran.push("at"), 10);
    clock.setTimeout(() => ran.push("after"), 11);
    clock.advance(9);
    expect(ran).toEqual([]);
    clock.advance(1);
    expect(ran).toEqual(["at"]);
    clock.advance(1);
    expect(ran).toEqual(["at", "after"]);
  });

  it("runs timers in order of due time, then of creation, whatever order they were set in", () => {
    const clock = createFakeClock();
    const ran: string[] = [];
    clock.setTimeout(() => ran.push("c: due 30, first set"), 30);
    clock.setTimeout(() => ran.push("a: due 10"), 10);
    clock.setTimeout(() => ran.push("d: due 30, second set"), 30);
    clock.setTimeout(() => ran.push("b: due 20"), 20);
    clock.advance(100);
    expect(ran).toEqual(["a: due 10", "b: due 20", "c: due 30, first set", "d: due 30, second set"]);
  });

  it("clearTimeout drops a timer; clearing one that has run, one already cleared, or one never set, changes nothing -- and is counted as a stale clear", () => {
    const clock = createFakeClock();
    const ran: string[] = [];
    const kept = clock.setTimeout(() => ran.push("kept"), 5);
    const dropped = clock.setTimeout(() => ran.push("dropped"), 5);
    clock.clearTimeout(dropped);
    expect(clock.pending()).toBe(1);
    expect(clock.staleClears()).toBe(0); // clearing a pending timer is not stale
    clock.advance(5);
    expect(ran).toEqual(["kept"]);
    clock.clearTimeout(kept); // it has run
    expect(clock.staleClears()).toBe(1);
    clock.clearTimeout(dropped); // it was cleared
    expect(clock.staleClears()).toBe(2);
    clock.clearTimeout(12345); // never set
    expect(clock.staleClears()).toBe(3);
    clock.clearTimeout(undefined); // no handle at all
    expect(clock.staleClears()).toBe(4);
    expect(clock.pending()).toBe(0);
  });

  it("a timer set by a running timer runs in the same window when it falls due inside it, and later otherwise", () => {
    const clock = createFakeClock();
    const ran: string[] = [];
    clock.setTimeout(() => {
      ran.push("outer at " + clock.now());
      clock.setTimeout(() => ran.push("inner at " + clock.now()), 20);
    }, 10);
    clock.advance(25); // outer at 10, inner due at 30: not yet
    expect(ran).toEqual(["outer at 10"]);
    clock.advance(5);
    expect(ran).toEqual(["outer at 10", "inner at 30"]);
    clock.setTimeout(() => ran.push("quick at " + clock.now()), 1);
    clock.advance(100);
    expect(ran).toEqual(["outer at 10", "inner at 30", "quick at 31"]);
  });

  it("now() is the total advanced, with or without a timer; pending() counts the timers set; delays records every ask", () => {
    const clock = createFakeClock();
    expect(clock.now()).toBe(0);
    clock.advance(7);
    expect(clock.now()).toBe(7);
    clock.setTimeout(() => undefined, 3);
    clock.setTimeout(() => undefined, 40);
    expect(clock.pending()).toBe(2);
    expect(clock.delays).toEqual([3, 40]);
    clock.advance(10);
    expect(clock.now()).toBe(17);
    expect(clock.pending()).toBe(1);
  });

  it("a timer whose delay is NaN is never due", () => {
    const clock = createFakeClock();
    const ran: string[] = [];
    clock.setTimeout(() => ran.push("nan"), NaN);
    clock.advance(1e9);
    expect(ran).toEqual([]);
    expect(clock.pending()).toBe(1);
  });
});

describe("TYPING_DEBOUNCE_MS", () => {
  it("is 150 ms: the one delay both adapters hand their timers", () => {
    expect(TYPING_DEBOUNCE_MS).toBe(150);
  });
});

describe("normalizeDelayMs -- what a delay means to a timer (Learning 914: a number field is every number)", () => {
  it.each([
    ["the constant", 150, 150],
    ["a fraction is kept: the host's timer rounds it, not this", 1.5, 1.5],
    ["a fraction under one is kept", 0.25, 0.25],
    ["one", 1, 1],
    ["zero: no wait beyond the next timer turn", 0, 0],
    ["negative zero reads as zero", -0, 0],
    ["a negative reads as zero", -5, 0],
    ["minus infinity reads as zero", -Infinity, 0],
    ["NaN reads as zero", NaN, 0],
    ["the longest delay a host timer holds", MAX_TIMER_DELAY_MS, MAX_TIMER_DELAY_MS],
    ["one past it (a Node timer resets such a delay to 1 ms)", MAX_TIMER_DELAY_MS + 1, MAX_TIMER_DELAY_MS],
    ["a year", 31_536_000_000, MAX_TIMER_DELAY_MS],
    ["infinity", Infinity, MAX_TIMER_DELAY_MS],
  ])("%s: %s becomes %s", (_why, ms, expected) => {
    const normalized = normalizeDelayMs(ms);
    expect(normalized).toBe(expected);
    expect(Object.is(normalized, -0)).toBe(false); // a minus zero is never handed to a timer
  });

  it("the longest delay is 2^31 - 1 ms (24.8 days)", () => {
    expect(MAX_TIMER_DELAY_MS).toBe(2 ** 31 - 1);
  });
});

/** A debouncer on a fake clock, and what its runs did, in order. */
function setup(delayMs: number = TYPING_DEBOUNCE_MS, onError?: (error: unknown) => void) {
  const clock = createFakeClock();
  const ran: string[] = [];
  const debouncer = createKeyedDebouncer({ timers: clock, delayMs, onError });
  const run = (label: string) => () => {
    ran.push(label);
  };
  return { clock, ran, debouncer, run };
}

describe("createKeyedDebouncer -- trailing, one pending run per key", () => {
  it("runs nothing at once, and the run once the delay has passed (not a millisecond before)", () => {
    const { clock, ran, debouncer, run } = setup();
    debouncer.schedule("a", run("a"));
    expect(ran).toEqual([]);
    clock.advance(TYPING_DEBOUNCE_MS - 1);
    expect(ran).toEqual([]);
    clock.advance(1);
    expect(ran).toEqual(["a"]);
  });

  it("asks the timer for the delay it was made with, once per schedule", () => {
    const { clock, debouncer, run } = setup(150);
    debouncer.schedule("a", run("a"));
    debouncer.schedule("a", run("a"));
    debouncer.schedule("b", run("b"));
    expect(clock.delays).toEqual([150, 150, 150]);
  });

  it("a run happens once, not once more on later pauses", () => {
    const { clock, ran, debouncer, run } = setup();
    debouncer.schedule("a", run("a"));
    clock.advance(10_000);
    clock.advance(10_000);
    expect(ran).toEqual(["a"]);
    expect(clock.pending()).toBe(0);
  });

  it("schedules again after a run: a second burst runs a second time", () => {
    const { clock, ran, debouncer, run } = setup();
    debouncer.schedule("a", run("first burst"));
    clock.advance(TYPING_DEBOUNCE_MS);
    debouncer.schedule("a", run("second burst"));
    clock.advance(TYPING_DEBOUNCE_MS);
    expect(ran).toEqual(["first burst", "second burst"]);
  });

  it("a burst of K schedules of one key runs ONE run, the LAST, one delay after the last schedule", () => {
    const { clock, ran, debouncer, run } = setup();
    const K = 40;
    for (let i = 1; i <= K; i++) {
      debouncer.schedule("doc", run(`keystroke ${i}`));
      clock.advance(20); // a keystroke every 20 ms: far inside the delay
    }
    expect(ran).toEqual([]); // nothing ran while the typing went on
    clock.advance(TYPING_DEBOUNCE_MS - 20 - 1); // 20 ms of the delay already passed after the last schedule
    expect(ran).toEqual([]);
    clock.advance(1);
    expect(ran).toEqual(["keystroke 40"]);
    expect(clock.pending()).toBe(0);
  });

  it("the delay counts from the LAST schedule, not the first: a schedule inside the window postpones the run by a whole delay", () => {
    const { clock, ran, debouncer, run } = setup();
    debouncer.schedule("a", run("early"));
    clock.advance(100);
    debouncer.schedule("a", run("late")); // 100 ms into the first delay
    clock.advance(100); // 200 ms after the first schedule: the first run would be due
    expect(ran).toEqual([]);
    clock.advance(49);
    expect(ran).toEqual([]);
    clock.advance(1);
    expect(ran).toEqual(["late"]);
  });

  it("a replaced run is dropped for good, and its timer is cleared (one timer pending per key)", () => {
    const { clock, ran, debouncer, run } = setup();
    debouncer.schedule("a", run("one"));
    debouncer.schedule("a", run("two"));
    debouncer.schedule("a", run("three"));
    expect(clock.pending()).toBe(1);
    clock.advance(10_000);
    expect(ran).toEqual(["three"]);
  });
});

describe("createKeyedDebouncer -- keys are independent", () => {
  it("each key runs at its own deadline, and scheduling one key does not postpone another", () => {
    const { clock, ran, debouncer, run } = setup();
    debouncer.schedule("a", run("a"));
    clock.advance(100);
    debouncer.schedule("b", run("b")); // due at 250
    clock.advance(40);
    debouncer.schedule("a", run("a again")); // postpones a to 290; b stays at 250
    expect(ran).toEqual([]);
    clock.advance(110); // 250
    expect(ran).toEqual(["b"]);
    clock.advance(39); // 289
    expect(ran).toEqual(["b"]);
    clock.advance(1);
    expect(ran).toEqual(["b", "a again"]);
  });

  it("two keys scheduled together both run, in the order they were scheduled, one run each", () => {
    const { clock, ran, debouncer, run } = setup();
    debouncer.schedule("x", run("x"));
    debouncer.schedule("y", run("y"));
    debouncer.schedule("x", run("x2")); // x moves behind y
    clock.advance(TYPING_DEBOUNCE_MS);
    expect(ran).toEqual(["y", "x2"]);
  });

  it("keys that differ only by case or by a trailing character are different keys", () => {
    const { clock, ran, debouncer, run } = setup();
    debouncer.schedule("file:///a.qmd", run("a"));
    debouncer.schedule("file:///A.qmd", run("A"));
    debouncer.schedule("file:///a.qmd ", run("a "));
    clock.advance(TYPING_DEBOUNCE_MS);
    expect(ran).toEqual(["a", "A", "a "]);
  });

  it("the empty string is a key like any other, and so are the keys of Object.prototype", () => {
    const { clock, ran, debouncer, run } = setup();
    for (const key of ["", "__proto__", "constructor", "toString", "hasOwnProperty"]) debouncer.schedule(key, run(key));
    clock.advance(TYPING_DEBOUNCE_MS);
    expect(ran).toEqual(["", "__proto__", "constructor", "toString", "hasOwnProperty"]);
  });
});

describe("createKeyedDebouncer -- cancel", () => {
  it("drops the pending run of a key, clears its timer, and a later schedule of the key runs", () => {
    const { clock, ran, debouncer, run } = setup();
    debouncer.schedule("a", run("dropped"));
    debouncer.cancel("a");
    expect(clock.pending()).toBe(0);
    clock.advance(10_000);
    expect(ran).toEqual([]);
    debouncer.schedule("a", run("kept"));
    clock.advance(TYPING_DEBOUNCE_MS);
    expect(ran).toEqual(["kept"]);
  });

  it("leaves the other keys alone", () => {
    const { clock, ran, debouncer, run } = setup();
    debouncer.schedule("a", run("a"));
    debouncer.schedule("b", run("b"));
    debouncer.cancel("a");
    clock.advance(TYPING_DEBOUNCE_MS);
    expect(ran).toEqual(["b"]);
  });

  it("is harmless for a key that was never scheduled, one that already ran, and one cancelled twice", () => {
    const { clock, ran, debouncer, run } = setup();
    debouncer.cancel("never");
    debouncer.schedule("a", run("a"));
    clock.advance(TYPING_DEBOUNCE_MS);
    debouncer.cancel("a");
    debouncer.cancel("a");
    debouncer.schedule("b", run("b"));
    debouncer.cancel("b");
    debouncer.cancel("b");
    clock.advance(TYPING_DEBOUNCE_MS);
    expect(ran).toEqual(["a"]);
  });
});

describe("createKeyedDebouncer -- it never clears a timer that is not pending", () => {
  it("not after a run, not for a key never scheduled or cancelled twice, not on a second dispose or a cancel after it", () => {
    const { clock, ran, debouncer, run } = setup();
    debouncer.schedule("a", run("a"));
    clock.advance(TYPING_DEBOUNCE_MS); // a runs
    debouncer.schedule("a", run("a again")); // a fired timer must not be cleared by this schedule
    debouncer.cancel("a"); // a pending one: a real clear
    debouncer.cancel("a"); // none pending now
    debouncer.cancel("never");
    debouncer.schedule("b", run("b"));
    clock.advance(TYPING_DEBOUNCE_MS); // b runs
    debouncer.cancel("b"); // b has run
    debouncer.schedule("c", run("c"));
    debouncer.dispose(); // clears c
    debouncer.dispose();
    debouncer.cancel("c");
    expect(clock.staleClears()).toBe(0);
    expect(ran).toEqual(["a", "b"]);
  });
});

describe("createKeyedDebouncer -- dispose", () => {
  it("drops every pending run and clears every timer", () => {
    const { clock, ran, debouncer, run } = setup();
    debouncer.schedule("a", run("a"));
    debouncer.schedule("b", run("b"));
    debouncer.schedule("c", run("c"));
    clock.advance(TYPING_DEBOUNCE_MS - 1);
    debouncer.dispose();
    expect(clock.pending()).toBe(0);
    clock.advance(10_000);
    expect(ran).toEqual([]);
  });

  it("makes later schedules do nothing: no run, no timer", () => {
    const { clock, ran, debouncer, run } = setup();
    debouncer.dispose();
    debouncer.schedule("a", run("a"));
    expect(clock.pending()).toBe(0);
    expect(clock.delays).toEqual([]);
    clock.advance(10_000);
    expect(ran).toEqual([]);
  });

  it("can be called twice, and cancel after it is harmless", () => {
    const { clock, ran, debouncer, run } = setup();
    debouncer.schedule("a", run("a"));
    debouncer.dispose();
    debouncer.dispose();
    debouncer.cancel("a");
    clock.advance(10_000);
    expect(ran).toEqual([]);
  });

  it("a run that disposes the debouncer from inside stops the rest of the keys", () => {
    const { clock, ran, debouncer, run } = setup();
    debouncer.schedule("a", () => {
      ran.push("a");
      debouncer.dispose();
    });
    debouncer.schedule("b", run("b"));
    clock.advance(TYPING_DEBOUNCE_MS);
    expect(ran).toEqual(["a"]);
  });
});

describe("createKeyedDebouncer -- a run is over before it runs", () => {
  it("a run that schedules its own key again runs again one delay later, once", () => {
    const { clock, ran, debouncer } = setup();
    let again = true;
    const run = (): void => {
      ran.push(`run at ${clock.now()}`);
      if (again) {
        again = false;
        debouncer.schedule("a", run);
      }
    };
    debouncer.schedule("a", run);
    clock.advance(TYPING_DEBOUNCE_MS);
    expect(ran).toEqual([`run at ${TYPING_DEBOUNCE_MS}`]);
    clock.advance(TYPING_DEBOUNCE_MS);
    expect(ran).toEqual([`run at ${TYPING_DEBOUNCE_MS}`, `run at ${2 * TYPING_DEBOUNCE_MS}`]);
    clock.advance(10_000);
    expect(ran).toHaveLength(2);
  });

  it("a run that cancels its own key, or schedules another key, changes nothing else", () => {
    const { clock, ran, debouncer, run } = setup();
    debouncer.schedule("a", () => {
      ran.push("a");
      debouncer.cancel("a");
      debouncer.schedule("b", run("b, from a"));
    });
    clock.advance(TYPING_DEBOUNCE_MS);
    expect(ran).toEqual(["a"]);
    clock.advance(TYPING_DEBOUNCE_MS);
    expect(ran).toEqual(["a", "b, from a"]);
  });
});

describe("createKeyedDebouncer -- a throwing run does not stop later runs", () => {
  it("reports the error to onError, still runs the other keys of the same instant, and leaves the key free for the next schedule", () => {
    const errors: unknown[] = [];
    const { clock, ran, debouncer, run } = setup(TYPING_DEBOUNCE_MS, (error) => errors.push(error));
    const boom = new Error("boom");
    debouncer.schedule("a", () => {
      throw boom;
    });
    debouncer.schedule("b", run("b"));
    debouncer.schedule("c", run("c"));
    clock.advance(TYPING_DEBOUNCE_MS);
    expect(errors).toEqual([boom]);
    expect(ran).toEqual(["b", "c"]);
    expect(clock.pending()).toBe(0);
    debouncer.schedule("a", run("a, again"));
    clock.advance(TYPING_DEBOUNCE_MS);
    expect(ran).toEqual(["b", "c", "a, again"]);
    expect(errors).toEqual([boom]);
  });

  it("reports every throw, not only the first", () => {
    const errors: unknown[] = [];
    const { clock, debouncer } = setup(TYPING_DEBOUNCE_MS, (error) => errors.push(error));
    debouncer.schedule("a", () => {
      throw new Error("first");
    });
    debouncer.schedule("b", () => {
      throw new Error("second");
    });
    clock.advance(TYPING_DEBOUNCE_MS);
    expect(errors.map((e) => (e as Error).message)).toEqual(["first", "second"]);
  });

  it("a value thrown that is not an Error is reported as it is", () => {
    const errors: unknown[] = [];
    const { clock, debouncer } = setup(TYPING_DEBOUNCE_MS, (error) => errors.push(error));
    debouncer.schedule("a", () => {
      throw "just a string";
    });
    clock.advance(TYPING_DEBOUNCE_MS);
    expect(errors).toEqual(["just a string"]);
  });

  describe("without an onError", () => {
    afterEach(() => vi.restoreAllMocks());

    it("the error goes to console.error, nothing is thrown out of the timer, and the other keys still run", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const { clock, ran, debouncer, run } = setup();
      const boom = new Error("unreported");
      debouncer.schedule("a", () => {
        throw boom;
      });
      debouncer.schedule("b", run("b"));
      expect(() => clock.advance(TYPING_DEBOUNCE_MS)).not.toThrow();
      expect(ran).toEqual(["b"]);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]).toContain(boom);
    });
  });
});

describe("createKeyedDebouncer -- the delay is a number field (Learning 914)", () => {
  it("a zero delay is still trailing: the run waits for the next timer turn, and a burst inside the turn runs once", () => {
    const { clock, ran, debouncer, run } = setup(0);
    debouncer.schedule("a", run("1"));
    debouncer.schedule("a", run("2"));
    debouncer.schedule("a", run("3"));
    expect(ran).toEqual([]); // not synchronous
    expect(clock.delays).toEqual([0, 0, 0]);
    clock.advance(0);
    expect(ran).toEqual(["3"]);
  });

  it.each([
    [-40, 0],
    [-0, 0],
    [NaN, 0],
    [-Infinity, 0],
    [Infinity, MAX_TIMER_DELAY_MS],
    [2 ** 40, MAX_TIMER_DELAY_MS], // past what a host timer holds
    [2.5, 2.5],
  ])("a delay of %s asks the timer for %s ms (what normalizeDelayMs says)", (delayMs, asked) => {
    const { clock, debouncer, run } = setup(delayMs);
    debouncer.schedule("a", run("a"));
    expect(clock.delays).toEqual([asked]);
    expect(Object.is(clock.delays[0], -0)).toBe(false);
  });

  it("a negative delay runs on the next turn, like a zero one", () => {
    const { clock, ran, debouncer, run } = setup(-1);
    debouncer.schedule("a", run("a"));
    expect(ran).toEqual([]);
    clock.advance(0);
    expect(ran).toEqual(["a"]);
  });
});

describe("realTimers -- the host's own timers", () => {
  const tick = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  it("setTimeout runs the function after the delay, and in order of the delays asked", async () => {
    const ran: string[] = [];
    realTimers.setTimeout(() => ran.push("late"), 8);
    realTimers.setTimeout(() => ran.push("early"), 1);
    await tick(40); // a timer set after both, due after both: they have fired by then, in due order
    expect(ran).toEqual(["early", "late"]);
  });

  it("clearTimeout stops a timer", async () => {
    const ran: string[] = [];
    const handle = realTimers.setTimeout(() => ran.push("cleared"), 1);
    realTimers.clearTimeout(handle);
    realTimers.setTimeout(() => ran.push("kept"), 2);
    await tick(40);
    expect(ran).toEqual(["kept"]);
  });

  it("a keyed debouncer on the host's timers runs a burst once", async () => {
    const ran: string[] = [];
    const debouncer = createKeyedDebouncer({ timers: realTimers, delayMs: 5 });
    for (let i = 0; i < 10; i++) debouncer.schedule("k", () => ran.push(`run ${i}`));
    expect(ran).toEqual([]);
    await tick(60);
    expect(ran).toEqual(["run 9"]);
    debouncer.dispose();
  });
});
