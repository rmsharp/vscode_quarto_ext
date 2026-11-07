import { describe, expect, it } from "vitest";
import { cellBackgroundRanges } from "../../src/core/cell-background";
import { findCellAtPosition } from "../../src/core/qmd/model";
import {
  TYPING_DEBOUNCE_MS,
  TYPING_MAX_WAIT_MS,
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
// schedulers, so they could not stand as their own oracle. The NEW wiring below is a copy of how the two adapters call the schedulers; `s342-typing-wiring-pin.test.ts` pins, from the syntax tree, the call sites it mirrors (which
// handler schedules and with which key, which paths stay immediate, the close handler). ONE THING IS NOT THE SHIPPED SPELLING: the run of the tint world below refreshes every visible editor, as the base's `refresh()` did, while
// since Session 343 the shipped run is `decorator.refreshAfterEdit(event.document)`, which touches only the edited document's editors (the pin requires that spelling; `cell-background-refresh.test.ts` is the oracle for what it leaves). The
// rows of the tint world check the debouncer's timing and the tint a refresh-all run leaves. Session 343 (the review round found the copies out of date): both copies pass `TYPING_MAX_WAIT_MS` as the adapters do. Session 344: the enumerations of five events and the seeded sequences of 10 to 40
// events (with pauses of 60 ms) are shorter than that window, so the window never comes due in them; the rows headed "Session 344" (timelines of streams that last 1,100 to 3,400 ms and more, mixed with pauses, cursor moves, editor
// switches and edits of the other document) DRIVE it, in both worlds, and `createTimelineAudit` checks its properties (P2 and P4 below) after every step of every sequence the two worlds check, the short ones too. `s343-max-wait.test.ts` drives the debouncer and the
// scheduler by themselves.
//
// The properties, checked after EVERY event of every sequence:
//   P1 once no timer is pending, the last value the new wiring set is the oracle's last value, and both are the truth worked out from how the document was built (not by `findCellAtPosition`);
//   P2 a key holds at most TWO timers (the trailing one and, since Session 343's maximum wait, the window's), and a pause of the delay runs them; since Session 344 also: a pending timer means state that has not been evaluated (the key;
//      not the tint, where an immediate refresh of every editor brings every document up to date and cancels no document's timers, and where this copy's timer run also refreshes every visible editor: see `createTimelineAudit`),
//      and nothing is left stale with no timer to run it;
//   P3 the new wiring evaluates no more often than the oracle;
//   P4 (Session 344) the window: the oldest event the oracle evaluated and the new wiring has not is LESS than `TYPING_MAX_WAIT_MS` old (looked at after a step, so at the age itself the work has run): no event waits longer than the maximum
//      wait for its evaluation, and the first evaluation comes no later than the maximum wait after its first event. That bounds each EVENT's wait, not the interval between two evaluations of an unbroken stream, which is a maximum wait
//      plus the offset of the first event after a run (less than one gap more: 1,043 ms at a gap of 149, the row 'the same stream with a gap of 149 ms'); and a run by a timer comes exactly one delay after the last debounced event since the key's last run or exactly one maximum wait after the first (no early, late or stray run);
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

// ---- THE WINDOW: what a timeline is checked against (Session 344) -------------------------------------------------------------------------------------------------------------------------------------

/**
 * A step that is no event: the clock moves by this many milliseconds. A STREAM of edit events is a run of them with a gap of LESS than `TYPING_DEBOUNCE_MS` between (10 to 149); a gap of 150 or more ends one.
 * `pause 60` and `pause 200` of the short enumerations are clock steps too.
 */
type GapEvent = `gap ${number}`;
const GAPS_IN_A_STREAM: readonly number[] = [10, 25, 40, 60, 100, 149];
const GAPS_THAT_END_A_STREAM: readonly number[] = [150, 151, 400];
const gapOf = (event: string): number | undefined => (event.startsWith("gap ") ? Number(event.slice(4)) : undefined);
const isClockStep = (event: string): boolean => event.startsWith("gap ") || event.startsWith("pause ");

/** One evaluation of the key (or one refresh of the editors), the oracle's or the new wiring's: when, and in which order the two kinds happened (the oracle's, at an event, comes first). */
interface OracleEval {
  readonly at: number;
  readonly seq: number;
}
interface NewEval extends OracleEval {
  /** Run by a timer (inside a clock step) and not at an event. */
  readonly byTimer: boolean;
  /** The key of the timer that ran it, for a refresh a timer ran; empty for the others. */
  readonly key: string;
}

/** What the audit is shown after every step of a timeline: the world's clock and the two logs of evaluations, and, for an event, the document it edited or the key it cancelled. */
interface Observation {
  readonly label: () => string;
  readonly isEvent: boolean;
  readonly edited?: string;
  readonly cancelled?: string;
  readonly now: number;
  readonly pending: number;
  readonly staleClears: number;
  readonly oldEvals: readonly OracleEval[];
  readonly newEvals: readonly NewEval[];
}

/**
 * The properties of the maximum wait, checked after EVERY step of a timeline against the oracle's log of evaluations (the base's per-event handlers evaluate at every event) and the new wiring's own. Nothing in them reads the
 * code's timers: they are stated from the two logs and the two constants.
 *
 *  - STALE: an oracle evaluation that no evaluation of the new wiring has followed. The state a debounced event left is stale until the new wiring runs.
 *  - W (the window): while anything is stale, its age is LESS than `TYPING_MAX_WAIT_MS`. The first stale evaluation is the first event of a stream, so the work runs no later than the maximum wait after it: no event waits longer
 *    than the maximum wait for its evaluation. (The fake clock runs a timer due at the instant it advances to, so at the age itself the work has run.) This bounds each event's wait and not the interval between two evaluations of an
 *    unbroken stream, which is a maximum wait plus the offset of the first event after a run (1,043 ms at a gap of 149): a window opens at that event, so "evaluated at least once in every maximum wait" is not what is checked.
 *  - LIVE: anything stale has a timer pending (nothing is left waiting for an event that never comes; with a key a document, 'a timer', not 'a timer of its own'). With one key (`perKey: false`) the converse holds too: a
 *    pending timer means stale state. With a key a document (`perKey: true`) it does not, for two reasons. The immediate refreshes (a switch of editor, a show or a hide, a reload) bring every document up to date and cancel
 *    no document's timers, in the shipped wiring as in this copy: after [edit A, hide B] two timers are pending and nothing is stale. And in this copy a timer's run refreshes every visible editor (the Session 342 spelling; the
 *    shipped run, `refreshAfterEdit`, touches only the edited document's editors), so another document's run can also catch this one's edit up while its own timers are pending: after [edit A, pause 60, edit B, pause 60, pause 60].
 *  - U (the timing): a run by a timer happens exactly one `TYPING_DEBOUNCE_MS` after the LAST debounced event since the key's last run, or exactly one `TYPING_MAX_WAIT_MS` after the FIRST (a debounced event is an
 *    event that the oracle evaluated and the new wiring did not). A run at any other moment, or with no debounced event waiting, is an early, late or stray run.
 *  - at most `maxTimers` timers pending, and no clock call that names a timer that is not pending (`staleClears`).
 *
 * It also counts what the timeline reached, so that a row can say the properties were not vacuous: the runs the window made (at the maximum wait after the first event and not a delay after the last), the runs the trailing timer made,
 * and the longest stream of debounced events (gaps under the delay, none ended by an evaluation) in milliseconds.
 */
function createTimelineAudit(mode: { perKey: boolean; maxTimers: number }) {
  let oldSeen = 0;
  let newSeen = 0;
  let staleFrom = 0;
  const firstSince = new Map<string, number>();
  const lastSince = new Map<string, number>();
  const lastEver = new Map<string, number>();
  const streamStart = new Map<string, number>();
  const tally = { windowRuns: 0, trailingRuns: 0, longestStream: 0, debouncedEvents: 0, staleSteps: 0, oldestStale: 0 };
  const problems: string[] = [];
  const forget = (key: string): void => {
    firstSince.delete(key);
    lastSince.delete(key);
    lastEver.delete(key);
    streamStart.delete(key);
  };
  return {
    tally,
    problems,
    after(obs: Observation): void {
      const oldAppended = obs.oldEvals.length - oldSeen;
      const newAppended = obs.newEvals.slice(newSeen);
      oldSeen = obs.oldEvals.length;
      newSeen = obs.newEvals.length;
      if (obs.cancelled !== undefined) {
        forget(obs.cancelled);
      }
      if (obs.isEvent && oldAppended > 0 && newAppended.length === 0) {
        const key = obs.edited ?? "";
        const before = lastEver.get(key);
        if (before === undefined || obs.now - before >= TYPING_DEBOUNCE_MS) {
          streamStart.set(key, obs.now);
        }
        lastEver.set(key, obs.now);
        lastSince.set(key, obs.now);
        if (!firstSince.has(key)) {
          firstSince.set(key, obs.now);
        }
        tally.debouncedEvents++;
        tally.longestStream = Math.max(tally.longestStream, obs.now - (streamStart.get(key) ?? obs.now));
      }
      for (const run of newAppended) {
        const key = mode.perKey ? run.key : "";
        if (run.byTimer) {
          const first = firstSince.get(key);
          const last = lastSince.get(key);
          if (first === undefined || last === undefined) {
            problems.push(`${obs.label()}: a timer ran the work at ${run.at} with no debounced event waiting`);
          } else {
            const afterLast = run.at === last + TYPING_DEBOUNCE_MS;
            const afterFirst = run.at === first + TYPING_MAX_WAIT_MS;
            if (!afterLast && !afterFirst) {
              problems.push(`${obs.label()}: a timer ran the work at ${run.at}; the last debounced event was at ${last} (a delay later: ${last + TYPING_DEBOUNCE_MS}), the first at ${first} (a maximum wait later: ${first + TYPING_MAX_WAIT_MS})`);
            }
            if (afterFirst && !afterLast) {
              tally.windowRuns++;
            } else {
              tally.trailingRuns++;
            }
          }
          firstSince.delete(key);
          lastSince.delete(key);
        } else if (!mode.perKey) {
          forget("");
        }
      }
      const lastNew = obs.newEvals.length > 0 ? obs.newEvals[obs.newEvals.length - 1].seq : -1;
      while (staleFrom < obs.oldEvals.length && obs.oldEvals[staleFrom].seq < lastNew) {
        staleFrom++;
      }
      const stale = staleFrom < obs.oldEvals.length;
      if (stale) {
        const age = obs.now - obs.oldEvals[staleFrom].at;
        tally.staleSteps++;
        tally.oldestStale = Math.max(tally.oldestStale, age);
        if (age >= TYPING_MAX_WAIT_MS) {
          problems.push(`${obs.label()}: the oldest unevaluated event is ${age} ms old, not less than the maximum wait ${TYPING_MAX_WAIT_MS}`);
        }
        if (obs.pending === 0) {
          problems.push(`${obs.label()}: the state is stale and no timer is pending`);
        }
      } else if (!mode.perKey && obs.pending > 0) {
        problems.push(`${obs.label()}: ${obs.pending} timers pending and nothing unevaluated`);
      }
      if (obs.pending > mode.maxTimers) {
        problems.push(`${obs.label()}: ${obs.pending} timers pending, not at most ${mode.maxTimers}`);
      }
      if (obs.staleClears !== 0) {
        problems.push(`${obs.label()}: ${obs.staleClears} clears of a timer that is not pending`);
      }
    },
  };
}

/** The sequence a failure message shows: the whole prefix when it is short, the last dozen steps of it when it is long. */
function prefixLabel(events: readonly string[], i: number): string {
  return i < 12 ? `after [${events.slice(0, i + 1).join(", ")}]` : `after step ${i + 1} of ${events.length}, [..., ${events.slice(i - 11, i + 1).join(", ")}]`;
}

/**
 * A timeline of streams and breaks: a stream is an edit event every `gap` ms (a gap under the delay, so the trailing timer never comes due) for 1.1 to 3.4 maximum waits, with now and then a cursor move, a switch or
 * a close in the middle of it; between streams there are pauses (a gap of the delay or more, or 200 ms) and a few single events. `edits` are the events that arm a debounce, `others` everything else that is an event.
 */
function longTimeline<E extends string>(random: () => number, edits: readonly E[], others: readonly E[], minSteps: number): Array<E | GapEvent | "pause 200"> {
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)];
  const out: Array<E | GapEvent | "pause 200"> = [];
  while (out.length < minSteps) {
    const draw = random();
    if (draw < 0.6) {
      const gap = pick(GAPS_IN_A_STREAM);
      const n = Math.ceil((TYPING_MAX_WAIT_MS * (1.1 + random() * 2.3)) / gap);
      for (let k = 0; k < n; k++) {
        out.push(pick(edits));
        if (random() < 0.015) {
          out.push(pick(others));
        }
        out.push(`gap ${gap}`);
      }
    } else if (draw < 0.75) {
      out.push(`gap ${pick(GAPS_THAT_END_A_STREAM)}`);
    } else if (draw < 0.85) {
      out.push("pause 200");
    } else {
      for (let k = 1 + Math.floor(random() * 4); k > 0; k--) {
        out.push(random() < 0.5 ? pick(edits) : pick(others));
      }
    }
  }
  return out;
}

// ---- THE CELL-CONTEXT KEY ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

type KeyEvent ="type A" | "edit A" | "move A" | "type B" | "move B" | "switch to A" | "switch to B" | "switch to none" | "pause 60" | "pause 200";
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
  // Session 344: when each evaluation happened and in which order (`seq`), for the audit; `advancing` is true inside a clock step, where only a timer can evaluate.
  const oldEvals: OracleEval[] = [];
  const newEvals: NewEval[] = [];
  let seq = 0;
  let advancing = false;

  // ---- The OLD spelling, copied VERBATIM from the base `10e6b9c` (`src/features/execution.ts`), with `vscode.window.activeTextEditor` read from the model and `executeCommand("setContext", ...)` written to a log (and, beside it, to the audit's). ----
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
    oldEvals.push({ at: clock.now(), seq: seq++ });
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
    newEvals.push({ at: clock.now(), seq: seq++, byTimer: advancing, key: "" });
  }
  const scheduler = createCellContextScheduler({
    timers: clock,
    delayMs: TYPING_DEBOUNCE_MS,
    maxWaitMs: TYPING_MAX_WAIT_MS,
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

  const advance = (ms: number): void => {
    advancing = true;
    try {
      clock.advance(ms);
    } finally {
      advancing = false;
    }
  };

  function apply(event: KeyEvent | GapEvent): void {
    const gap = gapOf(event);
    if (gap !== undefined) {
      advance(gap);
      return;
    }
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
        advance(60);
        return;
      case "pause 200":
        advance(200);
        return;
    }
  }

  /** The truth about the key, worked out from how the documents are built. */
  function truth(): boolean {
    return activeTextEditor !== undefined && activeTextEditor.document.languageId === "quarto" && inCellBy(activeTextEditor.document.version, activeTextEditor.selection.active.line);
  }

  return { clock, apply, oldLog, newLog, oldEvals, newEvals, truth, pending: () => clock.pending() };
}

/** What a checked timeline reports: what is wrong, the numbers an enumeration totals, and what the timeline reached (the audit's tally). */
interface Checked {
  problems: string[];
  pendingAtEnd: boolean;
  saved: number;
  tally: ReturnType<typeof createTimelineAudit>["tally"];
}

/** Run `events` and return what is wrong after any of them, the numbers the enumeration totals, and the final state. Session 344: the audit's properties (the window among them) are checked after every step too. */
function checkKeySequence(events: readonly (KeyEvent | GapEvent)[], languageOfB: string): Checked {
  const w = keyWorld(languageOfB);
  const problems: string[] = [];
  const audit = createTimelineAudit({ perKey: false, maxTimers: 2 });
  const at = (i: number): string => prefixLabel(events, i);
  audit.after({ label: () => "at the activation", isEvent: false, now: w.clock.now(), pending: w.pending(), staleClears: w.clock.staleClears(), oldEvals: w.oldEvals, newEvals: w.newEvals });
  for (let i = 0; i < events.length; i++) {
    w.apply(events[i]);
    audit.after({ label: () => at(i), isEvent: !isClockStep(events[i]), now: w.clock.now(), pending: w.pending(), staleClears: w.clock.staleClears(), oldEvals: w.oldEvals, newEvals: w.newEvals });
    const last = <T,>(xs: T[]): T | undefined => xs[xs.length - 1];
    if (w.pending() === 0) {
      if (last(w.newLog) !== last(w.oldLog)) problems.push(`${at(i)}: no timer pending and the new wiring's key is ${String(last(w.newLog))}, the oracle's ${String(last(w.oldLog))}`);
      if (last(w.oldLog) !== w.truth()) problems.push(`${at(i)}: the oracle's key ${String(last(w.oldLog))} is not the truth ${String(w.truth())}`);
    }
    if (w.pending() > 2) problems.push(`${at(i)}: ${w.pending()} timers pending, not at most two (the trailing timer and the window's)`);
    if (w.newLog.length > w.oldLog.length) problems.push(`${at(i)}: the new wiring evaluated ${w.newLog.length} times, the oracle ${w.oldLog.length}`);
    if (events[i] === "pause 200" && w.pending() !== 0) problems.push(`${at(i)}: a pause of 200 ms left a timer pending`);
  }
  // A pause long enough ends every sequence in the caught-up state.
  const pendingAtEnd = w.pending() > 0;
  w.apply("pause 200");
  if (w.pending() !== 0) problems.push(`after [${events.join(", ")}] and a pause: a timer is still pending`);
  if (w.newLog[w.newLog.length - 1] !== w.oldLog[w.oldLog.length - 1]) problems.push(`after [${events.join(", ")}] and a pause: the key is ${String(w.newLog[w.newLog.length - 1])}, the oracle's ${String(w.oldLog[w.oldLog.length - 1])}`);
  audit.after({ label: () => `${at(events.length - 1)} and a pause`, isEvent: false, now: w.clock.now(), pending: w.pending(), staleClears: w.clock.staleClears(), oldEvals: w.oldEvals, newEvals: w.newEvals });
  problems.push(...audit.problems.slice(0, 3));
  return { problems, pendingAtEnd, saved: w.oldLog.length - w.newLog.length, tally: audit.tally };
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

// Session 344: the rows above stop at five events, or at 40 with pauses of 60 ms: no sequence of theirs holds an unbroken stream as long as `TYPING_MAX_WAIT_MS`, so they never DROVE the window (the properties they check are
// the same with or without it). These do: streams of 1,100 to 3,400 ms, checked after every step with the audit's properties (W, LIVE, U, the timer counts) beside P1 to P3.
describe("Session 344 -- the cell-context key through unbroken streams of keystrokes: the maximum wait is driven (the oracle: the base's handlers, verbatim)", () => {
  it("a keystroke (a document event and a cursor move) every 100 ms for 4 s is evaluated by the WINDOW at 1,000, 2,000, 3,000 and 4,000 ms and by nothing else, while the oracle evaluates at every one of its 80 events", () => {
    const events: Array<KeyEvent | GapEvent> = [];
    for (let k = 0; k < 40; k++) events.push("type A", "gap 100");
    const w = keyWorld("quarto");
    for (const event of events) w.apply(event);
    expect(w.newEvals.filter((e) => e.byTimer).map((e) => e.at)).toEqual([1_000, 2_000, 3_000, 4_000]);
    expect(w.newEvals.filter((e) => !e.byTimer)).toHaveLength(1); // the activation
    expect(w.oldEvals).toHaveLength(1 + 80); // the activation, and a document event and a cursor move for each of the 40 keystrokes
    expect(w.pending()).toBe(0);
    const r = checkKeySequence(events, "quarto");
    expect(r.problems).toEqual([]);
    expect(r.tally.windowRuns).toBe(4);
    expect(r.tally.trailingRuns).toBe(0);
    expect(r.tally.longestStream).toBe(3_900);
    expect(r.tally.oldestStale).toBe(TYPING_MAX_WAIT_MS - 100); // the first keystroke of a window is waiting when the last one before the window's end arrives
  });

  it("the same stream with a gap of 149 ms (just under the delay) is evaluated every 1,043 ms: a window opens at the first keystroke AFTER a run, up to one gap later", () => {
    const events: Array<KeyEvent | GapEvent> = [];
    for (let k = 0; k < 40; k++) events.push("type A", "gap 149");
    const w = keyWorld("quarto");
    for (const event of events) w.apply(event);
    expect(w.newEvals.filter((e) => e.byTimer).map((e) => e.at)).toEqual([1_000, 2_043, 3_086, 4_129, 5_172]);
    const r = checkKeySequence(events, "quarto");
    expect(r.problems).toEqual([]);
    expect(r.tally.windowRuns).toBe(5);
  });

  it("a gap of 150 ms ends a stream: the trailing timer runs after each keystroke, a delay after it, and the window is never the one that runs", () => {
    const events: Array<KeyEvent | GapEvent> = [];
    for (let k = 0; k < 20; k++) events.push("type A", "gap 150");
    const r = checkKeySequence(events, "quarto");
    expect(r.problems).toEqual([]);
    expect(r.tally.windowRuns).toBe(0);
    expect(r.tally.trailingRuns).toBe(20);
    expect(r.tally.longestStream).toBe(0);
  });

  it("agrees with the oracle and keeps the window on 2,000 seeded timelines of streams, pauses, cursor moves, editor switches and edits of the other document (every step checked)", () => {
    const random = seededRandom(3441);
    const edits: KeyEvent[] = ["type A", "type A", "type A", "edit A"];
    const others: KeyEvent[] = ["move A", "move A", "move B", "type B", "switch to A", "switch to B", "switch to none", "pause 60"];
    const problems: string[] = [];
    let pastTheWindow = 0;
    let windowRuns = 0;
    let trailingRuns = 0;
    let longest = 0;
    let oldestStale = 0;
    let steps = 0;
    for (let n = 0; n < 2_000; n++) {
      const events = longTimeline(random, edits, others, 60);
      steps += events.length;
      const r = checkKeySequence(events, random() < 0.5 ? "quarto" : "markdown");
      if (r.problems.length > 0 && problems.length < 5) problems.push(...r.problems.slice(0, 2));
      if (r.tally.longestStream >= TYPING_MAX_WAIT_MS) pastTheWindow++;
      windowRuns += r.tally.windowRuns;
      trailingRuns += r.tally.trailingRuns;
      longest = Math.max(longest, r.tally.longestStream);
      oldestStale = Math.max(oldestStale, r.tally.oldestStale);
    }
    expect(problems).toEqual([]);
    // floors, not counts of the generator: the draw reaches unbroken streams past the window, runs the window made, runs the trailing timer made, and a stale state that came close to the limit
    expect(pastTheWindow).toBeGreaterThan(1_000);
    expect(windowRuns).toBeGreaterThan(3_000);
    expect(trailingRuns).toBeGreaterThan(1_000);
    expect(longest).toBeGreaterThanOrEqual(3 * TYPING_MAX_WAIT_MS);
    expect(oldestStale).toBeGreaterThan(TYPING_MAX_WAIT_MS - TYPING_DEBOUNCE_MS);
    expect(steps).toBeGreaterThan(300_000);
  }, HEAVY_ROW_MS);
});

// ---- THE CELL TINT----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

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
  // Session 344: when each refresh happened and in which order (`seq`), for the audit; `advancing` is true inside a clock step, where only a timer can refresh.
  const oldEvals: OracleEval[] = [];
  const newEvals: NewEval[] = [];
  let seq = 0;
  let advancing = false;

  // ---- The OLD spelling, copied VERBATIM from the base `10e6b9c` (`src/features/cell-background.ts`): `cellBackgroundRangesFor` without the settings, `refresh`, and the document handler (the counter and the audit's log are the test's own). ----
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
    oldEvals.push({ at: clock.now(), seq: seq++ });
  };
  const isVisible = (doc: FakeDocument): boolean => visible.some((editor) => editor === doc);
  const oldOnDocument = (doc: FakeDocument): void => {
    if (isVisible(doc)) {
      oldRefresh();
    }
  };

  // ---- The NEW wiring: how `registerCellBackgroundFeature` builds and calls the debouncer (key, delay, maximum wait, `cancel` on close). The RUN is the Session 342 spelling and not the shipped one: it refreshes every visible editor
  // (`refreshInto`), where the shipped run since Session 343 is `decorator.refreshAfterEdit(event.document)` and touches only the edited document's editors. What it leaves is `cell-background-refresh.test.ts`'s oracle, not this file's. ----
  const newRefresh = (firedBy = ""): void => {
    newRefreshes++;
    refreshInto(newApplied);
    newEvals.push({ at: clock.now(), seq: seq++, byTimer: advancing, key: firedBy });
  };
  const typing = createKeyedDebouncer({ timers: clock, delayMs: TYPING_DEBOUNCE_MS, maxWaitMs: TYPING_MAX_WAIT_MS });
  const newOnDocument = (doc: FakeDocument): void => {
    if (isVisible(doc)) {
      typing.schedule(doc.uri.toString(), () => newRefresh(doc.uri.toString()));
    }
  };

  oldRefresh();
  newRefresh(); // the decorator's own first refresh

  const both = (immediate: () => void, immediateNew: () => void): void => {
    immediate();
    immediateNew();
  };
  const advance = (ms: number): void => {
    advancing = true;
    try {
      clock.advance(ms);
    } finally {
      advancing = false;
    }
  };
  /** Apply one event; answers the document it edited and the key it cancelled, which the audit reads (an edit of a document that is not visible arms nothing, and the audit sees that from the logs). */
  function apply(event: TintEvent | GapEvent): { edited?: string; cancelled?: string } {
    const gap = gapOf(event);
    if (gap !== undefined) {
      advance(gap);
      return {};
    }
    switch (event) {
      case "edit A":
        docA.version++;
        oldOnDocument(docA);
        newOnDocument(docA);
        return { edited: docA.uri.toString() };
      case "edit B":
        docB.version++;
        oldOnDocument(docB);
        newOnDocument(docB);
        return { edited: docB.uri.toString() };
      case "switch editor": // onDidChangeActiveTextEditor: immediate
        both(oldRefresh, newRefresh);
        return {};
      case "hide B":
        visible = visible.filter((d) => d !== docB);
        both(oldRefresh, newRefresh); // onDidChangeVisibleTextEditors
        return {};
      case "show B":
        if (!isVisible(docB)) visible = [...visible, docB];
        both(oldRefresh, newRefresh);
        return {};
      case "close A":
        visible = visible.filter((d) => d !== docA);
        both(oldRefresh, newRefresh); // the editor leaves the visible list
        typing.cancel(docA.uri.toString()); // onDidCloseTextDocument (the old code had no such handler)
        return { cancelled: docA.uri.toString() };
      case "open A":
        if (!isVisible(docA)) visible = [docA, ...visible];
        both(oldRefresh, newRefresh);
        return {};
      case "reload": // a colour setting changed: immediate
        both(oldRefresh, newRefresh);
        return {};
      case "pause 60":
        advance(60);
        return {};
      case "pause 200":
        advance(200);
        return {};
    }
    return {};
  }
  return {
    clock,
    apply,
    oldEvals,
    newEvals,
    visible: () => visible,
    oldApplied,
    newApplied,
    refreshes: () => ({ old: oldRefreshes, new: newRefreshes }),
    dispose: () => typing.dispose(),
  };
}

function checkTintSequence(events: readonly (TintEvent | GapEvent)[]): Checked {
  const w = tintWorld();
  const problems: string[] = [];
  const audit = createTimelineAudit({ perKey: true, maxTimers: 4 });
  const at = (i: number): string => prefixLabel(events, i);
  audit.after({ label: () => "at the first refresh", isEvent: false, now: w.clock.now(), pending: w.clock.pending(), staleClears: w.clock.staleClears(), oldEvals: w.oldEvals, newEvals: w.newEvals });
  for (let i = 0; i < events.length; i++) {
    const done = w.apply(events[i]);
    audit.after({ label: () => at(i), isEvent: !isClockStep(events[i]), edited: done.edited, cancelled: done.cancelled, now: w.clock.now(), pending: w.clock.pending(), staleClears: w.clock.staleClears(), oldEvals: w.oldEvals, newEvals: w.newEvals });
    if (w.clock.pending() === 0) {
      for (const doc of w.visible()) {
        const key = doc.uri.toString();
        const truth = truthRanges(doc);
        if (JSON.stringify(w.newApplied.get(key)) !== JSON.stringify(w.oldApplied.get(key))) problems.push(`${at(i)}: no timer pending and ${key} is tinted ${JSON.stringify(w.newApplied.get(key))}, the oracle's ${JSON.stringify(w.oldApplied.get(key))}`);
        if (JSON.stringify(w.oldApplied.get(key)) !== JSON.stringify(truth)) problems.push(`${at(i)}: the oracle's tint of ${key} is not the truth ${JSON.stringify(truth)}`);
      }
    }
    if (w.clock.pending() > 4) problems.push(`${at(i)}: ${w.clock.pending()} timers pending, not at most two a document (the trailing timer and the window's)`);
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
  audit.after({ label: () => `${at(events.length - 1)} and a pause`, isEvent: false, now: w.clock.now(), pending: w.clock.pending(), staleClears: w.clock.staleClears(), oldEvals: w.oldEvals, newEvals: w.newEvals });
  problems.push(...audit.problems.slice(0, 3));
  const { old, new: now } = w.refreshes();
  w.dispose();
  return { problems, pendingAtEnd, saved: old - now, tally: audit.tally };
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

// Session 344: the same for the tint. The timers here are one pair a DOCUMENT (the debouncer is keyed by the document's URI), so the audit runs per key; the oldest unevaluated refresh is the oracle's that no refresh of the
// new wiring has followed, whichever document's edit it was (this copy's run refreshes every visible editor, so any run follows it; the shipped run touches only the edited document's editors).
describe("Session 344 -- the cell tint through unbroken streams of edits: the maximum wait is driven (the oracle: the base's refresh and document handler, verbatim)", () => {
  it("an edit of one document every 100 ms for 4 s is refreshed by the WINDOW at 1,000, 2,000, 3,000 and 4,000 ms and by nothing else, while the oracle refreshes at every one of its 40 edits", () => {
    const events: Array<TintEvent | GapEvent> = [];
    for (let k = 0; k < 40; k++) events.push("edit A", "gap 100");
    const w = tintWorld();
    for (const event of events) w.apply(event);
    expect(w.newEvals.filter((e) => e.byTimer).map((e) => e.at)).toEqual([1_000, 2_000, 3_000, 4_000]);
    expect(w.newEvals.filter((e) => !e.byTimer)).toHaveLength(1); // the decorator's own first refresh
    expect(w.oldEvals).toHaveLength(1 + 40);
    expect(w.clock.pending()).toBe(0);
    const r = checkTintSequence(events);
    expect(r.problems).toEqual([]);
    expect(r.tally.windowRuns).toBe(4);
    expect(r.tally.trailingRuns).toBe(0);
    expect(r.tally.longestStream).toBe(3_900);
  });

  it("two documents edited in turn every 50 ms each have a window of their own, opened at THEIR first edit: A's runs at 1,000, 2,000 and 3,000 and B's 50 ms after each", () => {
    const events: Array<TintEvent | GapEvent> = [];
    for (let k = 0; k < 40; k++) events.push("edit A", "gap 50", "edit B", "gap 50");
    const w = tintWorld();
    for (const event of events) w.apply(event);
    expect(w.newEvals.filter((e) => e.byTimer).map((e) => `${e.at} ${e.key}`)).toEqual([
      "1000 file:///a.qmd",
      "1050 file:///b.qmd",
      "2000 file:///a.qmd",
      "2050 file:///b.qmd",
      "3000 file:///a.qmd",
      "3050 file:///b.qmd",
      "4000 file:///a.qmd",
    ]);
    const r = checkTintSequence(events);
    expect(r.problems).toEqual([]);
    expect(r.tally.windowRuns).toBe(8); // the pause that ends every checked timeline lets B's last window end, at 4,050
  });

  it("a gap of 150 ms ends a stream: the trailing timer refreshes after each edit, a delay after it, and the window is never the one that runs", () => {
    const events: Array<TintEvent | GapEvent> = [];
    for (let k = 0; k < 20; k++) events.push("edit A", "gap 150");
    const r = checkTintSequence(events);
    expect(r.problems).toEqual([]);
    expect(r.tally.windowRuns).toBe(0);
    expect(r.tally.trailingRuns).toBe(20);
  });

  it("agrees with the oracle and keeps the window on 2,000 seeded timelines of streams, pauses, switches, hidden and closed editors and reloads (every step checked)", () => {
    const random = seededRandom(3442);
    const edits: TintEvent[] = ["edit A", "edit A", "edit B"];
    const others: TintEvent[] = ["switch editor", "hide B", "show B", "close A", "open A", "reload", "pause 60"];
    const problems: string[] = [];
    let pastTheWindow = 0;
    let windowRuns = 0;
    let trailingRuns = 0;
    let longest = 0;
    let oldestStale = 0;
    let steps = 0;
    for (let n = 0; n < 2_000; n++) {
      const events = longTimeline(random, edits, others, 60);
      steps += events.length;
      const r = checkTintSequence(events);
      if (r.problems.length > 0 && problems.length < 5) problems.push(...r.problems.slice(0, 2));
      if (r.tally.longestStream >= TYPING_MAX_WAIT_MS) pastTheWindow++;
      windowRuns += r.tally.windowRuns;
      trailingRuns += r.tally.trailingRuns;
      longest = Math.max(longest, r.tally.longestStream);
      oldestStale = Math.max(oldestStale, r.tally.oldestStale);
    }
    expect(problems).toEqual([]);
    // floors, not counts of the generator (see the key's row)
    expect(pastTheWindow).toBeGreaterThan(1_000);
    expect(windowRuns).toBeGreaterThan(2_000);
    expect(trailingRuns).toBeGreaterThan(5_000);
    expect(longest).toBeGreaterThanOrEqual(3 * TYPING_MAX_WAIT_MS);
    expect(oldestStale).toBeGreaterThan(TYPING_MAX_WAIT_MS - TYPING_DEBOUNCE_MS);
    expect(steps).toBeGreaterThan(300_000);
  }, HEAVY_ROW_MS);
});

// ---- THE DEBOUNCER AGAINST A MODEL OF ITS SPEC------------------------------------------------------------------------------------------------------------------------------------------------

// "again" is a schedule whose run schedules its own key once more, from inside the run (Session 343: five direct rows pin that elsewhere, and no sequence did), with a run that does not.
type DebounceOp = { op: "schedule"; key: string; again?: true } | { op: "cancel"; key: string } | { op: "advance"; ms: number } | { op: "dispose" };

/**
 * The spec of a keyed trailing debouncer as a plain model: a table of `{ due, order, label, again }`, a run log, a clock. No timers. A run that schedules its own key again (`again`) does so once the run is over, at the
 * moment it ran: the entry it leaves is due one delay after that moment, and it falls due inside the same advance if that moment plus the delay is inside the window.
 */
function modelOfSpec(delayMs: number) {
  let now = 0;
  let order = 0;
  let disposed = false;
  const table = new Map<string, { due: number; order: number; label: string; again?: string }>();
  const log: string[] = [];
  return {
    log,
    schedule(key: string, label: string, again?: string): void {
      if (disposed) return;
      table.set(key, { due: now + delayMs, order: order++, label, again });
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
      for (;;) {
        // the entry due soonest inside the window, ties by scheduling order: a run may leave an entry that falls due inside the window too
        const due = [...table.entries()].filter(([, entry]) => entry.due <= target).sort((a, b) => a[1].due - b[1].due || a[1].order - b[1].order)[0];
        if (due === undefined) break;
        const [key, entry] = due;
        table.delete(key);
        now = Math.max(now, entry.due);
        log.push(`${key}:${entry.label}`);
        if (entry.again !== undefined) {
          this.schedule(key, entry.again);
        }
      }
      now = target;
    },
    pending: () => table.size,
  };
}

function runDebounceOps(ops: readonly DebounceOp[], delayMs: number): { actual: string[]; expected: string[]; pendingActual: number[]; pendingExpected: number[]; scheduled: number } {
  const clock: FakeClock = createFakeClock();
  const actual: string[] = [];
  const debouncer = createKeyedDebouncer({ timers: clock, delayMs });
  const model = modelOfSpec(delayMs);
  const pendingActual: number[] = [];
  const pendingExpected: number[] = [];
  let label = 0;
  let scheduled = 0; // every call of `schedule`, the ones a run makes included
  for (const o of ops) {
    switch (o.op) {
      case "schedule": {
        const id = String(label++);
        scheduled++;
        if (o.again === true) {
          // the run schedules its own key once more, from inside the run, with a run that does not
          const again = String(label++);
          debouncer.schedule(o.key, () => {
            actual.push(`${o.key}:${id}`);
            scheduled++;
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
  return { actual, expected: model.log, pendingActual, pendingExpected, scheduled };
}

describe("Session 342 -- the keyed debouncer agrees with a model of its spec on seeded operation sequences (schedule, a run that schedules its own key, cancel, advance, dispose over three keys)", () => {
  it("runs the same runs, in the same order, with the same number of timers pending after every operation, on 3,000 sequences of 5 to 60 operations at six delays", () => {
    const random = seededRandom(3423);
    const keys = ["a", "b", "c"];
    const advances = [0, 1, 10, 49, 50, 51, 149, 150, 151, 1_000];
    const delays = [150, 0, 1, 50, 25.5, 100];
    let ran = 0;
    let replaced = 0;
    let againOps = 0;
    const mismatches: string[] = [];
    for (let n = 0; n < 3_000; n++) {
      const ops: DebounceOp[] = [];
      const length = 5 + Math.floor(random() * 56);
      for (let k = 0; k < length; k++) {
        const draw = random();
        const key = keys[Math.floor(random() * keys.length)];
        if (draw < 0.4) ops.push({ op: "schedule", key });
        else if (draw < 0.5) ops.push({ op: "schedule", key, again: true });
        else if (draw < 0.6) ops.push({ op: "cancel", key });
        else if (draw < 0.995) ops.push({ op: "advance", ms: advances[Math.floor(random() * advances.length)] });
        else ops.push({ op: "dispose" });
      }
      ops.push({ op: "advance", ms: 2_000 });
      const delayMs = delays[n % delays.length];
      const r = runDebounceOps(ops, delayMs);
      ran += r.actual.length;
      againOps += ops.filter((o) => o.op === "schedule" && o.again === true).length;
      replaced += r.scheduled - r.actual.length;
      if (JSON.stringify(r.actual) !== JSON.stringify(r.expected) || JSON.stringify(r.pendingActual) !== JSON.stringify(r.pendingExpected)) {
        if (mismatches.length < 3) mismatches.push(`delay ${delayMs}: ${JSON.stringify(ops)} -> ${JSON.stringify(r.actual)} against the model's ${JSON.stringify(r.expected)}`);
      }
    }
    expect(mismatches).toEqual([]);
    // the draw reaches runs, and also drops schedules that never run (replaced, cancelled or disposed): floors, not counts of the generator
    expect(ran).toBeGreaterThan(10_000);
    expect(replaced).toBeGreaterThan(5_000);
    expect(againOps).toBeGreaterThan(4_000); // the draw reaches runs that schedule their own key (a tenth of the operations)
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

  it("the model itself, a run that schedules its own key: the entry it leaves is due one delay after the run, runs in the same advance if that falls inside it, and leaves the key free", () => {
    const m = modelOfSpec(100);
    m.schedule("a", "1", "2");
    m.advance(150); // a runs at 100 and leaves an entry due at 200
    expect(m.log).toEqual(["a:1"]);
    expect(m.pending()).toBe(1);
    m.advance(50); // 200
    expect(m.log).toEqual(["a:1", "a:2"]);
    expect(m.pending()).toBe(0);
    m.schedule("b", "3", "4");
    m.advance(1_000); // both fall due inside the one advance
    expect(m.log).toEqual(["a:1", "a:2", "b:3", "b:4"]);
    m.schedule("c", "5", "6");
    m.cancel("c");
    m.dispose();
    m.advance(1_000);
    expect(m.log).toHaveLength(4);
    const zero = modelOfSpec(0);
    zero.schedule("a", "1", "2");
    zero.advance(0); // a delay of zero: the entry the run leaves is due at once, inside the same advance
    expect(zero.log).toEqual(["a:1", "a:2"]);
  });
});
