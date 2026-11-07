import { describe, expect, it } from "vitest";
import { TYPING_DEBOUNCE_MS, TYPING_MAX_WAIT_MS, createKeyedDebouncer } from "../../src/core/typing-debounce";
import { createFakeClock } from "./support/fake-timers";

// Session 344 -- what the maximum wait COSTS (BACKLOG: "What Session 342's review round found beside the typing-path cures, none of them in its diff", part (8)(d)). `TYPING_MAX_WAIT_MS` was the lead's choice and its cost side
// was not written down: a stream of edit events less than `TYPING_DEBOUNCE_MS` apart used to pay nothing until it ended (the Session 342 trailing debounce) and, before any debounce, one evaluation per event. It now pays about one
// evaluation per maximum wait. The operator decided in Session 344 to leave the delay at 150 ms, so this is the trade-off as shipped, pinned as a rule derived from the two constants and as the figures the docstring of
// `TYPING_MAX_WAIT_MS` quotes. Every clock here is `createFakeClock()`: no row waits in real time, so no load can move a count.
//
// The cost of one evaluation (a cold scan of the document after an edit) is NOT a row: it is a timing, and the figures of `typing-debounce.ts`'s header are probes of it. What these rows pin is HOW OFTEN the work runs.

/** The length of the stream in the figures: an edit event every `gap` ms from 0 to 30 s on one key. */
const STREAM_MS = 30_000;

/** What a stream costs: its events, the evaluations made before it ended (the runs due before its last event arrived), all of them (the last event's own run after it), and the timers left. */
function costOfStream(gap: number, maxWaitMs: number | undefined) {
  const clock = createFakeClock();
  let runs = 0;
  const debouncer = createKeyedDebouncer({ timers: clock, delayMs: TYPING_DEBOUNCE_MS, maxWaitMs });
  let events = 0;
  for (let t = 0; t <= STREAM_MS; t += gap) {
    clock.advance(t - clock.now());
    debouncer.schedule("doc", () => {
      runs++;
    });
    events++;
  }
  const beforeTheEnd = runs;
  clock.advance(TYPING_DEBOUNCE_MS + TYPING_MAX_WAIT_MS);
  return { events, beforeTheEnd, total: runs, pending: clock.pending() };
}

/**
 * The evaluations a stream of events `gap` ms apart (less than the delay) makes before it ends. A window opens at the first event after a run and ends a maximum wait later, and the next one opens at the first event
 * at or after that, which is `ceil(MAX / gap)` gaps after the one that opened this: a period of `ceil(MAX / gap) * gap`, at least the maximum wait and less than the maximum wait plus one gap. The first window opens at 0,
 * so the runs due when the stream's last event arrives (at `floor(STREAM_MS / gap) * gap`, up to a gap before `STREAM_MS`) are those of the windows that end by then.
 */
function expectedRuns(gap: number): number {
  const period = Math.ceil(TYPING_MAX_WAIT_MS / gap) * gap;
  const lastEvent = Math.floor(STREAM_MS / gap) * gap;
  return Math.floor((lastEvent - TYPING_MAX_WAIT_MS) / period) + 1;
}

describe("Session 344 -- the cost of the maximum wait: how often an unbroken stream of edit events is evaluated", () => {
  it("a stream of events less than 150 ms apart pays about ONE evaluation per maximum wait, whatever the gap: for every whole gap from 1 to 149 ms, the runs before it ends are those of its windows, between the bound the constants give and the one-a-second ceiling", () => {
    // a period is less than the maximum wait plus the delay, and the last event is less than the delay before STREAM_MS
    const lowest = Math.floor((STREAM_MS - TYPING_DEBOUNCE_MS - TYPING_MAX_WAIT_MS) / (TYPING_MAX_WAIT_MS + TYPING_DEBOUNCE_MS)) + 1;
    const ceiling = Math.floor(STREAM_MS / TYPING_MAX_WAIT_MS);
    const problems: string[] = [];
    let fewest = Infinity;
    let most = 0;
    for (let gap = 1; gap < TYPING_DEBOUNCE_MS; gap++) {
      const s = costOfStream(gap, TYPING_MAX_WAIT_MS);
      fewest = Math.min(fewest, s.beforeTheEnd);
      most = Math.max(most, s.beforeTheEnd);
      if (s.beforeTheEnd !== expectedRuns(gap)) problems.push(`gap ${gap}: ${s.beforeTheEnd} runs, the windows say ${expectedRuns(gap)}`);
      if (s.beforeTheEnd < lowest || s.beforeTheEnd > ceiling) problems.push(`gap ${gap}: ${s.beforeTheEnd} runs, outside [${lowest}, ${ceiling}]`);
      if (s.total !== s.beforeTheEnd + 1) problems.push(`gap ${gap}: ${s.total} runs in all, not one more than ${s.beforeTheEnd} (the last event's own run)`);
      if (s.pending !== 0) problems.push(`gap ${gap}: ${s.pending} timers left`);
    }
    expect(problems).toEqual([]);
    expect(most).toBe(ceiling); // a gap that divides the maximum wait (1, 2, 4, 5, 8, 10, ...) pays the ceiling
    expect(fewest).toBeLessThan(ceiling); // and a gap that does not pays a little less often: a window opens up to one gap after a run
    expect(fewest).toBeGreaterThanOrEqual(lowest);
  });

  it("a gap of 150 ms or more pays one evaluation per event, as before the debounce: for every whole gap from 150 to 1,000 ms, the runs before the stream ends are its events less the last, each one a delay after its event", () => {
    const problems: string[] = [];
    for (let gap = TYPING_DEBOUNCE_MS; gap <= 1_000; gap++) {
      const s = costOfStream(gap, TYPING_MAX_WAIT_MS);
      if (s.beforeTheEnd !== s.events - 1 || s.total !== s.events) problems.push(`gap ${gap}: ${s.beforeTheEnd} runs before the end and ${s.total} in all for ${s.events} events`);
      const without = costOfStream(gap, undefined);
      if (without.beforeTheEnd !== s.beforeTheEnd || without.total !== s.total) problems.push(`gap ${gap}: ${without.beforeTheEnd}/${without.total} runs with no maximum wait against ${s.beforeTheEnd}/${s.total}: the maximum wait changed a stream that is none`);
    }
    expect(problems).toEqual([]);
  });

  it("the figures the docstring of TYPING_MAX_WAIT_MS quotes, for an edit event every `gap` ms over 30 s: runs before the stream ends, and in all with the last event's own run", () => {
    const table = [10, 50, 100, 149, 150, 151].map((gap) => {
      const c = costOfStream(gap, TYPING_MAX_WAIT_MS);
      return `${gap}: ${c.events} events, ${c.beforeTheEnd} runs before the end, ${c.total} in all`;
    });
    expect(table).toEqual([
      "10: 3001 events, 30 runs before the end, 31 in all",
      "50: 601 events, 30 runs before the end, 31 in all",
      "100: 301 events, 30 runs before the end, 31 in all",
      "149: 202 events, 28 runs before the end, 29 in all",
      "150: 201 events, 200 runs before the end, 201 in all",
      "151: 199 events, 198 runs before the end, 199 in all",
    ]);
  });

  it("CONTROL, what the maximum wait changed: with none (the Session 342 trailing debounce) a stream of events less than 150 ms apart runs NOTHING before it ends, at every such gap, and the one run after it", () => {
    const problems: string[] = [];
    for (let gap = 1; gap < TYPING_DEBOUNCE_MS; gap++) {
      const s = costOfStream(gap, undefined);
      if (s.beforeTheEnd !== 0 || s.total !== 1) problems.push(`gap ${gap}: ${s.beforeTheEnd} runs before the end, ${s.total} in all`);
    }
    expect(problems).toEqual([]);
  });
});
