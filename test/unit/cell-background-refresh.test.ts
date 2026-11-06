import { describe, expect, it } from "vitest";
import { type EditedDocument, createCellBackgroundRefresher, editorsToRefresh } from "../../src/core/cell-background-refresh";
import { TYPING_DEBOUNCE_MS, createKeyedDebouncer } from "../../src/core/typing-debounce";
import { createFakeClock } from "./support/fake-timers";
import { seededRandom } from "./support/regex-equivalence";

// Session 343, D3 -- the cell-background refresh plan (BACKLOG: "What Session 342's review round found beside the typing-path cures"). `CellBackgroundDecorator.refresh()` re-applied the tint to EVERY visible editor, and the
// document-event handler scheduled it for any VISIBLE document: a keystroke in a `.py` beside a large `.qmd` read the `.qmd`'s text again, built every Range and sent `setDecorations` for each. The plan says which editors an edit
// can have changed; every other trigger (the active editor, the visible editors, the settings, a reload, the activation) still refreshes every visible editor.
//
// The rows COUNT: how many editors were handed ranges (`apply`, which stands for `editor.setDecorations`) and how many had their ranges built (`rangesFor`, where `cellBackgroundRangesFor` reads the document's text). Nothing
// is timed: a count is what a loaded machine cannot fake. `s343-adapter-wiring-pin.test.ts` pins from the syntax tree that the adapter builds the refresher the way these rows assume (visible / rangesFor / apply) and that
// its document handler calls `refreshAfterEdit`; `s342-typing-wiring-pin.test.ts` pins the handler's debounce.

/** A document as the model has it: a key (its URI), a language id, and a number of cells (a quarto document is tinted with that many ranges). */
interface FakeDocument {
  key: string;
  languageId: string;
  cells: number;
}
/** An editor: its own id and the document it shows. */
interface FakeEditor {
  id: string;
  doc: FakeDocument;
}

/** What `cellBackgroundRangesFor` answers for a document: no ranges for a document that is not a Quarto one, one whole-line range per cell otherwise. */
function rangesOf(doc: FakeDocument): number[] {
  return doc.languageId === "quarto" ? Array.from({ length: doc.cells }, (_, i) => i) : [];
}

/** A refresher over fake editors, with the counts. */
function world(editors: FakeEditor[]) {
  const visible = { editors };
  const applies: Array<{ editor: string; ranges: number }> = [];
  const built: string[] = [];
  let visibleReads = 0;
  const refresher = createCellBackgroundRefresher<FakeEditor, number>({
    visible: () => {
      visibleReads++;
      return visible.editors.map((editor) => ({ key: editor.doc.key, languageId: editor.doc.languageId, editor }));
    },
    rangesFor: (editor) => {
      built.push(editor.id);
      return rangesOf(editor.doc);
    },
    apply: (editor, ranges) => {
      applies.push({ editor: editor.id, ranges: ranges.length });
    },
  });
  const edited = (doc: FakeDocument): EditedDocument => ({ key: doc.key, languageId: doc.languageId });
  return { visible, applies, built, visibleReads: () => visibleReads, refresher, edited };
}

const quarto = (key = "file:///a.qmd", cells = 400): FakeDocument => ({ key, languageId: "quarto", cells });
const python = (key = "file:///b.py"): FakeDocument => ({ key, languageId: "python", cells: 0 });

describe("Session 343 -- an edit refreshes only the editors it can have changed", () => {
  it("an edit in a python document beside a large quarto one applies to nothing and builds no ranges", () => {
    const q = quarto();
    const p = python();
    const w = world([{ id: "Q", doc: q }, { id: "P", doc: p }]);
    w.refresher.refreshAll();
    w.applies.length = 0;
    w.built.length = 0;
    const result = w.refresher.refreshAfterEdit(w.edited(p));
    expect(w.applies).toEqual([]);
    expect(w.built).toEqual([]);
    expect(result.size).toBe(0);
  });

  it("an edit in the quarto document applies to its editor only, and builds only its ranges", () => {
    const q = quarto();
    const p = python();
    const w = world([{ id: "Q", doc: q }, { id: "P", doc: p }]);
    w.refresher.refreshAll();
    w.applies.length = 0;
    w.built.length = 0;
    const result = w.refresher.refreshAfterEdit(w.edited(q));
    expect(w.applies).toEqual([{ editor: "Q", ranges: 400 }]);
    expect(w.built).toEqual(["Q"]);
    expect([...result.keys()]).toEqual([q.key]);
    expect(result.get(q.key)).toHaveLength(400);
  });

  it("two editors of one document are both refreshed by its edit, and an editor of another document is not", () => {
    const q = quarto();
    const other = quarto("file:///c.qmd", 3);
    const w = world([{ id: "Q1", doc: q }, { id: "C", doc: other }, { id: "Q2", doc: q }]);
    w.refresher.refreshAll();
    w.applies.length = 0;
    w.refresher.refreshAfterEdit(w.edited(q));
    expect(w.applies.map((a) => a.editor)).toEqual(["Q1", "Q2"]);
  });

  it("every other trigger refreshes every visible editor: refreshAll applies to each, in order, python ones with an empty list", () => {
    const w = world([{ id: "Q", doc: quarto() }, { id: "P", doc: python() }, { id: "C", doc: quarto("file:///c.qmd", 2) }]);
    const result = w.refresher.refreshAll();
    expect(w.applies).toEqual([{ editor: "Q", ranges: 400 }, { editor: "P", ranges: 0 }, { editor: "C", ranges: 2 }]);
    expect([...result.keys()]).toEqual(["file:///a.qmd", "file:///b.py", "file:///c.qmd"]);
    expect(w.visibleReads()).toBe(1);
  });

  it("an edit of a quarto document with no cell yet is refreshed (the first cell typed in gets its tint), and one of a document that is not visible refreshes nothing", () => {
    const empty = quarto("file:///new.qmd", 0);
    const w = world([{ id: "N", doc: empty }]);
    w.refresher.refreshAll();
    w.applies.length = 0;
    empty.cells = 1;
    w.refresher.refreshAfterEdit(w.edited(empty));
    expect(w.applies).toEqual([{ editor: "N", ranges: 1 }]);
    w.applies.length = 0;
    w.refresher.refreshAfterEdit({ key: "file:///elsewhere.qmd", languageId: "quarto" });
    expect(w.applies).toEqual([]);
  });

  it("a document that WAS quarto and was tinted still gets its tint cleared by its next edit, and the edit after that applies nothing", () => {
    const q = quarto();
    const w = world([{ id: "Q", doc: q }]);
    w.refresher.refreshAll();
    w.applies.length = 0;
    q.languageId = "markdown"; // "Change Language Mode": no edit, no editor event
    w.refresher.refreshAfterEdit(w.edited(q));
    expect(w.applies).toEqual([{ editor: "Q", ranges: 0 }]);
    w.applies.length = 0;
    w.refresher.refreshAfterEdit(w.edited(q));
    expect(w.applies).toEqual([]);
  });

  it("a document that is not quarto is refreshed while it holds a tint, from whichever refresh tinted it (an edit's, or a full one)", () => {
    const q = quarto();
    const w = world([{ id: "Q", doc: q }]);
    w.refresher.refreshAfterEdit(w.edited(q)); // tinted by an edit's refresh
    q.languageId = "markdown";
    w.applies.length = 0;
    w.refresher.refreshAfterEdit(w.edited(q));
    expect(w.applies).toEqual([{ editor: "Q", ranges: 0 }]);
  });

  it("a document turned into a quarto one is refreshed by its next edit, and then tinted", () => {
    const d = python("file:///turned.qmd");
    d.cells = 2;
    const w = world([{ id: "D", doc: d }]);
    w.refresher.refreshAll();
    w.applies.length = 0;
    d.languageId = "quarto";
    w.refresher.refreshAfterEdit(w.edited(d));
    expect(w.applies).toEqual([{ editor: "D", ranges: 2 }]);
    d.languageId = "markdown";
    w.applies.length = 0;
    w.refresher.refreshAfterEdit(w.edited(d));
    expect(w.applies).toEqual([{ editor: "D", ranges: 0 }]); // it holds a tint: cleared
  });

  it("the record of what is tinted is the last apply's: a quarto document whose cells were all deleted holds none, so once it is not quarto either its edit applies nothing", () => {
    const q = quarto("file:///a.qmd", 2);
    const w = world([{ id: "Q", doc: q }]);
    w.refresher.refreshAll();
    q.cells = 0;
    w.refresher.refreshAfterEdit(w.edited(q)); // [] applied: nothing is tinted
    q.languageId = "markdown";
    w.applies.length = 0;
    w.refresher.refreshAfterEdit(w.edited(q));
    expect(w.applies).toEqual([]);
  });

  it("a full refresh forgets the editors that are no longer visible: a document reopened under the same key as another language is not refreshed on account of the old tint", () => {
    const q = quarto();
    const w = world([{ id: "Q", doc: q }]);
    w.refresher.refreshAll();
    w.visible.editors = [];
    w.refresher.refreshAll(); // Q left
    const reopened = python(q.key);
    w.visible.editors = [{ id: "R", doc: reopened }];
    w.applies.length = 0;
    w.refresher.refreshAfterEdit(w.edited(reopened));
    expect(w.applies).toEqual([]);
  });

  it("a refresh that throws midway keeps the record of the editors it did tint: a document tinted before the error is still cleared by its next edit", () => {
    const q1 = quarto("file:///one.qmd", 2);
    const q2 = quarto("file:///two.qmd", 2);
    let failing = true;
    const applied: string[] = [];
    const refresher = createCellBackgroundRefresher<FakeEditor, number>({
      visible: () => [q1, q2].map((doc, i) => ({ key: doc.key, languageId: doc.languageId, editor: { id: `E${i}`, doc } })),
      rangesFor: (editor) => {
        if (failing && editor.doc === q2) throw new Error("the second editor is gone");
        return rangesOf(editor.doc);
      },
      apply: (editor, ranges) => void applied.push(`${editor.id}:${ranges.length}`),
    });
    expect(() => refresher.refreshAll()).toThrow("the second editor is gone");
    expect(applied).toEqual(["E0:2"]);
    q1.languageId = "markdown";
    failing = false;
    applied.length = 0;
    refresher.refreshAfterEdit({ key: q1.key, languageId: q1.languageId });
    expect(applied).toEqual(["E0:0"]);
  });

  it("the editors are read when the refresh runs, not when the refresher is made", () => {
    const q = quarto();
    const w = world([{ id: "Q", doc: q }]);
    w.visible.editors = [{ id: "Q", doc: q }, { id: "Q2", doc: q }];
    w.refresher.refreshAll();
    expect(w.applies.map((a) => a.editor)).toEqual(["Q", "Q2"]);
    expect(w.visibleReads()).toBe(1);
    w.refresher.refreshAfterEdit(w.edited(q));
    expect(w.visibleReads()).toBe(2);
  });
});

describe("Session 343 -- the plan: which editors, in their order", () => {
  const editors = [
    { key: "file:///a.qmd", languageId: "quarto", name: "A1" },
    { key: "file:///b.py", languageId: "python", name: "P" },
    { key: "file:///a.qmd", languageId: "quarto", name: "A2" },
    { key: "file:///c.md", languageId: "markdown", name: "M" },
  ];
  const names = (list: Array<{ name: string }>): string[] => list.map((e) => e.name);

  it.each([
    ["any other trigger: every editor, in order", undefined, [], ["A1", "P", "A2", "M"]],
    ["any other trigger, tinted or not: every editor", undefined, ["file:///c.md"], ["A1", "P", "A2", "M"]],
    ["an edit of a quarto document: its editors, both", { key: "file:///a.qmd", languageId: "quarto" }, [], ["A1", "A2"]],
    ["an edit of a python document that holds no tint: nothing", { key: "file:///b.py", languageId: "python" }, [], []],
    ["an edit of a python document that holds a tint: its editor", { key: "file:///b.py", languageId: "python" }, ["file:///b.py"], ["P"]],
    ["an edit of a markdown document tinted by another key: nothing", { key: "file:///c.md", languageId: "markdown" }, ["file:///a.qmd"], []],
    ["an edit of a document that is not shown: nothing", { key: "file:///nowhere.qmd", languageId: "quarto" }, [], []],
    ["an edit of a quarto document whose key only starts like a shown one: nothing", { key: "file:///a.qmd2", languageId: "quarto" }, [], []],
    ["an edit of a quarto document whose key is only the start of a shown one: nothing", { key: "file:///a", languageId: "quarto" }, [], []],
    ["an edit of a quarto document whose key differs by case: nothing", { key: "file:///A.qmd", languageId: "quarto" }, [], []],
    ["an edit of a document in the tinted set that is not shown: nothing", { key: "file:///gone.py", languageId: "python" }, ["file:///gone.py"], []],
    ["an edit whose language id only resembles quarto: a non-quarto document", { key: "file:///b.py", languageId: "Quarto" }, [], []],
  ] as Array<[string, EditedDocument | undefined, string[], string[]]>)("%s", (_title, edited, tinted, expected) => {
    const chosen = editorsToRefresh(edited, editors, new Set(tinted));
    expect(names(chosen)).toEqual(expected);
  });

  it("returns the editors themselves (the objects it was given) in a new array, and changes neither the editors nor the tinted set", () => {
    const tinted = new Set(["file:///b.py"]);
    const chosen = editorsToRefresh(undefined, editors, tinted);
    expect(chosen).not.toBe(editors);
    chosen.forEach((editor, i) => expect(editor).toBe(editors[i]));
    expect([...tinted]).toEqual(["file:///b.py"]);
    expect(editors).toHaveLength(4);
    expect(editorsToRefresh({ key: "file:///a.qmd", languageId: "quarto" }, [], new Set())).toEqual([]);
  });
});

// The ORACLE: the old spelling, run beside the new wiring on the same events. `refresh()` of the base looped over the visible editors, and the document handler scheduled it, keyed by the document, for any visible document.
// Fake clocks drive both debouncers; the events are the ones the adapter hears, and the property is the one the cure must keep: once no timer is pending, every visible editor holds the tint the old spelling gave it,
// while the new wiring applies no more often, and strictly less on some sequences. (Language changes are not in the events: they are rows above, because there the two differ BY DESIGN -- a document turned into
// another language is cleared by its own next edit, not by another document's.)
describe("Session 343 -- the tint after the debounce is what the old per-edit refresh of every editor left (the oracle: the base's refresh() loop and handler)", () => {
  type Event = "edit Q1" | "edit Q2" | "edit P" | "switch editor" | "hide Q2" | "show Q2" | "split Q1" | "unsplit Q1" | "reload" | "pause 60" | "pause 200";
  const EVENTS: readonly Event[] = ["edit Q1", "edit Q2", "edit P", "switch editor", "hide Q2", "show Q2", "split Q1", "unsplit Q1", "reload", "pause 60", "pause 200"];

  function oracleWorld() {
    const q1: FakeDocument = { key: "file:///q1.qmd", languageId: "quarto", cells: 1 };
    const q2: FakeDocument = { key: "file:///q2.qmd", languageId: "quarto", cells: 2 };
    const p: FakeDocument = { key: "file:///p.py", languageId: "python", cells: 0 };
    const editors: Record<string, FakeEditor> = { Q1: { id: "Q1", doc: q1 }, Q1b: { id: "Q1b", doc: q1 }, Q2: { id: "Q2", doc: q2 }, P: { id: "P", doc: p } };
    let visible: FakeEditor[] = [editors.Q1, editors.Q2, editors.P];
    const heldOld = new Map<string, number>();
    const heldNew = new Map<string, number>();
    let oldApplies = 0;
    let newApplies = 0;
    const clockOld = createFakeClock();
    const clockNew = createFakeClock();

    // ---- The OLD spelling, copied from the base: `refresh()` loops over the visible editors, builds each one's ranges and applies them; the handler schedules it for any visible document. ----
    const oldRefresh = (): void => {
      for (const editor of visible) {
        const ranges = rangesOf(editor.doc);
        heldOld.set(editor.id, ranges.length); // editor.setDecorations(this.decorationType, ranges);
        oldApplies++;
      }
    };
    const typingOld = createKeyedDebouncer({ timers: clockOld, delayMs: TYPING_DEBOUNCE_MS });
    const isVisible = (doc: FakeDocument): boolean => visible.some((editor) => editor.doc === doc);
    const oldOnDocument = (doc: FakeDocument): void => {
      if (isVisible(doc)) typingOld.schedule(doc.key, () => oldRefresh());
    };

    // ---- The NEW wiring: how the adapter builds the refresher and calls it. ----
    const refresher = createCellBackgroundRefresher<FakeEditor, number>({
      visible: () => visible.map((editor) => ({ key: editor.doc.key, languageId: editor.doc.languageId, editor })),
      rangesFor: (editor) => rangesOf(editor.doc),
      apply: (editor, ranges) => {
        heldNew.set(editor.id, ranges.length);
        newApplies++;
      },
    });
    const typingNew = createKeyedDebouncer({ timers: clockNew, delayMs: TYPING_DEBOUNCE_MS });
    const newOnDocument = (doc: FakeDocument): void => {
      if (isVisible(doc)) typingNew.schedule(doc.key, () => refresher.refreshAfterEdit({ key: doc.key, languageId: doc.languageId }));
    };

    oldRefresh();
    refresher.refreshAll();

    const everything = (): void => {
      oldRefresh();
      refresher.refreshAll();
    };
    function apply(event: Event): void {
      switch (event) {
        case "edit Q1":
          q1.cells = (q1.cells + 1) % 4;
          oldOnDocument(q1);
          newOnDocument(q1);
          return;
        case "edit Q2":
          q2.cells = (q2.cells + 2) % 5;
          oldOnDocument(q2);
          newOnDocument(q2);
          return;
        case "edit P":
          oldOnDocument(p);
          newOnDocument(p);
          return;
        case "switch editor":
        case "reload":
          everything();
          return;
        case "hide Q2":
          visible = visible.filter((e) => e !== editors.Q2);
          everything();
          return;
        case "show Q2":
          if (!visible.includes(editors.Q2)) visible = [...visible, editors.Q2];
          everything();
          return;
        case "split Q1":
          if (!visible.includes(editors.Q1b)) visible = [...visible, editors.Q1b];
          everything();
          return;
        case "unsplit Q1":
          visible = visible.filter((e) => e !== editors.Q1b);
          everything();
          return;
        case "pause 60":
          clockOld.advance(60);
          clockNew.advance(60);
          return;
        case "pause 200":
          clockOld.advance(200);
          clockNew.advance(200);
          return;
      }
    }
    const state = (held: Map<string, number>): string => visible.map((e) => `${e.id}=${String(held.get(e.id))}`).join(" ");
    return { apply, pending: () => [clockOld.pending(), clockNew.pending()], state, heldOld, heldNew, applies: () => [oldApplies, newApplies] as const };
  }

  function check(events: readonly Event[]): { problems: string[]; saved: number } {
    const w = oracleWorld();
    const problems: string[] = [];
    for (let i = 0; i < events.length; i++) {
      w.apply(events[i]);
      const [pendingOld, pendingNew] = w.pending();
      if (pendingOld !== pendingNew) problems.push(`after [${events.slice(0, i + 1).join(", ")}]: ${pendingOld} timers pending in the old wiring, ${pendingNew} in the new`);
      if (pendingNew === 0 && w.state(w.heldOld) !== w.state(w.heldNew)) problems.push(`after [${events.slice(0, i + 1).join(", ")}]: no timer pending, the new wiring holds ${w.state(w.heldNew)}, the oracle ${w.state(w.heldOld)}`);
    }
    w.apply("pause 200");
    if (w.state(w.heldOld) !== w.state(w.heldNew)) problems.push(`after [${events.join(", ")}] and a pause: the new wiring holds ${w.state(w.heldNew)}, the oracle ${w.state(w.heldOld)}`);
    const [oldApplies, newApplies] = w.applies();
    if (newApplies > oldApplies) problems.push(`after [${events.join(", ")}]: ${newApplies} applies against the oracle's ${oldApplies}`);
    return { problems, saved: oldApplies - newApplies };
  }

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

  it("agrees on EVERY sequence of 5 events from the eleven (161,051 sequences, every prefix checked), and applies less on some and never more", () => {
    let sequences = 0;
    let savedSome = 0;
    const problems: string[] = [];
    for (const events of sequencesOf(EVENTS, 5)) {
      const r = check(events);
      sequences++;
      if (r.saved > 0) savedSome++;
      if (r.problems.length > 0 && problems.length < 5) problems.push(...r.problems.slice(0, 2));
    }
    expect(problems).toEqual([]);
    expect(sequences).toBe(161_051);
    expect(savedSome).toBeGreaterThan(10_000);
    expect(savedSome).toBeLessThan(sequences);
  }, 120_000);

  it("agrees on 3,000 seeded sequences of 10 to 40 events (edits weighted over the rest)", () => {
    const random = seededRandom(3433);
    const weighted: Event[] = [...EVENTS, "edit Q1", "edit Q1", "edit Q2", "edit P", "edit P", "pause 60"];
    const problems: string[] = [];
    let saved = 0;
    for (let n = 0; n < 3_000; n++) {
      const length = 10 + Math.floor(random() * 31);
      const events: Event[] = [];
      for (let k = 0; k < length; k++) events.push(weighted[Math.floor(random() * weighted.length)]);
      const r = check(events);
      saved += r.saved;
      if (r.problems.length > 0 && problems.length < 5) problems.push(...r.problems.slice(0, 2));
    }
    expect(problems).toEqual([]);
    expect(saved).toBeGreaterThan(5_000);
  }, 120_000);
});
