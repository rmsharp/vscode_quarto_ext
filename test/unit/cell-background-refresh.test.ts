import { describe, expect, it } from "vitest";
import { type EditedDocument, createCellBackgroundRefresher, editorsToRefresh } from "../../src/core/cell-background-refresh";
import { TYPING_DEBOUNCE_MS, TYPING_MAX_WAIT_MS, createKeyedDebouncer } from "../../src/core/typing-debounce";
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
  const refresher = createCellBackgroundRefresher<FakeEditor, number>({
    visible: () => visible.editors.map((editor) => ({ key: editor.doc.key, languageId: editor.doc.languageId, editor })),
    rangesFor: (editor) => {
      built.push(editor.id);
      return rangesOf(editor.doc);
    },
    apply: (editor, ranges) => {
      applies.push({ editor: editor.id, ranges: ranges.length });
    },
  });
  const edited = (doc: FakeDocument): EditedDocument => ({ key: doc.key, languageId: doc.languageId });
  return { visible, applies, built, refresher, edited };
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

  it("a document tinted with exactly ONE range is on the record: switched to another language with no editor event, its next edit clears the tint", () => {
    const q = quarto("file:///one.qmd", 1);
    const w = world([{ id: "Q", doc: q }]);
    w.refresher.refreshAll(); // one range applied
    q.languageId = "markdown";
    w.applies.length = 0;
    w.refresher.refreshAfterEdit(w.edited(q));
    expect(w.applies).toEqual([{ editor: "Q", ranges: 0 }]);
  });

  it("an apply that throws while it clears a tint leaves the tint on the record: the clear did not reach the editor, so the next edit tries it again", () => {
    const q = quarto("file:///one.qmd", 2);
    let failing = false;
    const applied: string[] = [];
    const refresher = createCellBackgroundRefresher<FakeEditor, number>({
      visible: () => [{ key: q.key, languageId: q.languageId, editor: { id: "E", doc: q } }],
      rangesFor: (editor) => rangesOf(editor.doc),
      apply: (editor, ranges) => {
        if (failing) throw new Error("setDecorations failed");
        applied.push(`${editor.id}:${ranges.length}`);
      },
    });
    refresher.refreshAll(); // E:2, and the tint is on the record
    q.languageId = "markdown"; // no editor event
    failing = true;
    expect(() => refresher.refreshAfterEdit({ key: q.key, languageId: q.languageId })).toThrow("setDecorations failed");
    failing = false;
    applied.length = 0;
    refresher.refreshAfterEdit({ key: q.key, languageId: q.languageId });
    expect(applied).toEqual(["E:0"]);
  });

  it("a full refresh forgets only the keys that are no longer visible: with two tinted documents, closing one keeps the other's tint on the record", () => {
    const q1 = quarto("file:///one.qmd", 2);
    const q2 = quarto("file:///two.qmd", 2);
    const w = world([{ id: "E1", doc: q1 }, { id: "E2", doc: q2 }]);
    w.refresher.refreshAll();
    w.visible.editors = [{ id: "E2", doc: q2 }]; // E1 is closed
    w.refresher.refreshAll(); // forgets one.qmd and nothing else
    q2.languageId = "markdown";
    w.applies.length = 0;
    w.refresher.refreshAfterEdit(w.edited(q2));
    expect(w.applies).toEqual([{ editor: "E2", ranges: 0 }]);
  });

  it("the editors are read when each refresh runs: not when the refresher is made, and not kept from an earlier refresh (a list that changed since is the list that is refreshed)", () => {
    const q = quarto();
    const other = quarto("file:///c.qmd", 3);
    const w = world([{ id: "Q", doc: q }]);
    w.visible.editors = [{ id: "Q", doc: q }, { id: "Q2", doc: q }];
    w.refresher.refreshAll();
    expect(w.applies.map((a) => a.editor)).toEqual(["Q", "Q2"]);
    w.applies.length = 0;
    w.visible.editors = [{ id: "Q2", doc: q }, { id: "C", doc: other }, { id: "Q3", doc: q }]; // Q is closed, C and Q3 are opened
    w.refresher.refreshAfterEdit(w.edited(q));
    expect(w.applies.map((a) => a.editor)).toEqual(["Q2", "Q3"]);
    w.applies.length = 0;
    w.refresher.refreshAll();
    expect(w.applies.map((a) => a.editor)).toEqual(["Q2", "C", "Q3"]);
    w.applies.length = 0;
    w.visible.editors = [];
    w.refresher.refreshAfterEdit(w.edited(q));
    expect(w.applies).toEqual([]); // no editor is shown: nothing is applied, whatever the earlier lists were
    expect([...w.refresher.refreshAll().keys()]).toEqual([]);
    expect(w.applies).toEqual([]);
  });
});

// Session 344 -- the three counts of `visible()` reads that these rows used to pin (`toBe(1)`, `toBe(1)` and `toBe(2)`) are replaced by what they stood for: a refresh acts on ONE consistent reading of the visible editors. The editors it
// applies to, the record it keeps of what is tinted, and the editors it finds nothing to refresh for all come from the same reading, so a list that changes under it (an editor closed, opened or split while the refresh
// runs, the way `vscode.window.visibleTextEditors` can between two reads) cannot make it apply to one list and remember another. The harness answers the TRUE list to the first reading of an operation and a DIFFERENT one to every later
// reading in the same operation: a refresh that reads once, or reads again and ignores the second answer, cannot tell, and one that mixes two readings does what no single reading shows. Nothing counts the reads: a refactor that
// reads the list twice and acts on one answer passes.
describe("Session 344 -- a refresh acts on one reading of the visible editors, whatever the list does while it runs", () => {
  /** A refresher whose `visible()` answers `lists.shown` the first time it is asked in an operation and `lists.elsewhere` every time after that; `operation` starts a new one. */
  function snapshotWorld(shown: FakeEditor[], elsewhere: FakeEditor[]) {
    const lists = { shown, elsewhere };
    let readings = 0;
    const applies: string[] = [];
    const refresher = createCellBackgroundRefresher<FakeEditor, number>({
      visible: () => (readings++ === 0 ? lists.shown : lists.elsewhere).map((editor) => ({ key: editor.doc.key, languageId: editor.doc.languageId, editor })),
      rangesFor: (editor) => rangesOf(editor.doc),
      apply: (editor, ranges) => void applies.push(`${editor.id}:${ranges.length}`),
    });
    const operation = <T,>(run: () => T): T => {
      readings = 0;
      return run();
    };
    return { lists, applies, refresher, operation };
  }
  const edited = (doc: FakeDocument): EditedDocument => ({ key: doc.key, languageId: doc.languageId });

  it("a full refresh applies to the editors of the reading it acted on, and to none that a later reading would show", () => {
    const q1 = quarto("file:///one.qmd", 2);
    const q2 = quarto("file:///two.qmd", 3);
    const p = python();
    const w = snapshotWorld([{ id: "Q1", doc: q1 }, { id: "Q2", doc: q2 }], [{ id: "P", doc: p }]);
    const result = w.operation(() => w.refresher.refreshAll());
    expect(w.applies).toEqual(["Q1:2", "Q2:3"]);
    expect([...result.keys()]).toEqual([q1.key, q2.key]);
  });

  it("a full refresh whose reading shows no editor applies to none, though a later reading would show one", () => {
    const w = snapshotWorld([], [{ id: "Q", doc: quarto() }]);
    const result = w.operation(() => w.refresher.refreshAll());
    expect(w.applies).toEqual([]);
    expect(result.size).toBe(0);
  });

  it("the record of what a full refresh tinted is the reading it applied to: a document it tinted is still cleared by its next edit after the language changed, though a later reading would not have shown it", () => {
    const q1 = quarto("file:///one.qmd", 2);
    const q2 = quarto("file:///two.qmd", 2);
    const w = snapshotWorld([{ id: "Q1", doc: q1 }, { id: "Q2", doc: q2 }], [{ id: "Q1", doc: q1 }]);
    w.operation(() => w.refresher.refreshAll());
    q2.languageId = "markdown"; // "Change Language Mode": no edit, no editor event
    w.applies.length = 0;
    w.operation(() => w.refresher.refreshAfterEdit(edited(q2)));
    expect(w.applies).toEqual(["Q2:0"]);
  });

  it("the record forgets the editors that the reading it acted on no longer shows, and only those: a document that left is not cleared by its next edit, one that stayed is", () => {
    const q1 = quarto("file:///one.qmd", 2);
    const q2 = quarto("file:///two.qmd", 2);
    const w = snapshotWorld([{ id: "Q1", doc: q1 }, { id: "Q2", doc: q2 }], [{ id: "Q1", doc: q1 }, { id: "Q2", doc: q2 }]);
    w.operation(() => w.refresher.refreshAll());
    w.lists.shown = [{ id: "Q2", doc: q2 }]; // Q1 is closed
    w.lists.elsewhere = [{ id: "Q1", doc: q1 }, { id: "Q2", doc: q2 }]; // a later reading would still show it
    w.operation(() => w.refresher.refreshAll());
    q1.languageId = "markdown";
    q2.languageId = "markdown";
    w.lists.shown = [{ id: "Q1", doc: q1 }, { id: "Q2", doc: q2 }]; // Q1 is opened again, now as a markdown document
    w.applies.length = 0;
    w.operation(() => w.refresher.refreshAfterEdit(edited(q1)));
    expect(w.applies).toEqual([]); // the second full refresh forgot Q1: it holds no tint
    w.operation(() => w.refresher.refreshAfterEdit(edited(q2)));
    expect(w.applies).toEqual(["Q2:0"]);
  });

  it("an edit's refresh acts on the editors of the reading it acted on, and finds none to refresh if that reading shows none of the document, though a later reading would", () => {
    const q = quarto();
    const p = python();
    const w = snapshotWorld([{ id: "P", doc: p }], [{ id: "Q", doc: q }]);
    w.operation(() => w.refresher.refreshAfterEdit(edited(q)));
    expect(w.applies).toEqual([]);
    w.lists.shown = [{ id: "Q1", doc: q }, { id: "P", doc: p }, { id: "Q2", doc: q }];
    w.lists.elsewhere = [];
    const result = w.operation(() => w.refresher.refreshAfterEdit(edited(q)));
    expect(w.applies).toEqual(["Q1:400", "Q2:400"]);
    expect([...result.keys()]).toEqual([q.key]);
  });

  // The same, for every sequence a seeded draw makes: a full refresh, an edit, a change of a document's language or cells, and a change of the list that is shown (followed by the full refresh that
  // `onDidChangeVisibleTextEditors` is: the adapter never leaves the list changed with no full refresh after it), with the other list (what a later reading would answer) drawn independently each time. The model
  // is the rule of the module's header written as a table of what is tinted, with no `visible()` of its own: it is given the list the operation acted on.
  it("agrees with the rule on 2,000 seeded sequences of 5 to 40 operations over three documents and a changing list, with a different answer for every reading after the first", () => {
    const random = seededRandom(3441);
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)];
    const problems: string[] = [];
    let editRefreshes = 0;
    let editsThatApplied = 0;
    let clearsOfNonQuarto = 0;
    for (let n = 0; n < 2_000; n++) {
      const docs = [quarto("file:///a.qmd", 2), quarto("file:///b.qmd", 1), python("file:///c.py")];
      const editors: FakeEditor[] = [{ id: "A1", doc: docs[0] }, { id: "A2", doc: docs[0] }, { id: "B", doc: docs[1] }, { id: "C", doc: docs[2] }];
      const someEditors = (): FakeEditor[] => editors.filter(() => random() < 0.6);
      const w = snapshotWorld(someEditors(), someEditors());
      const tinted = new Set<string>(); // the model: the keys of the documents that hold a tint
      const note = (e: FakeEditor): void => {
        if (rangesOf(e.doc).length > 0) tinted.add(e.doc.key);
        else tinted.delete(e.doc.key);
      };
      const log: string[] = [];
      /** A full refresh, and what the rule says it applied to: every editor of the reading, in order; then the record forgets the keys that reading no longer shows. */
      const fullRefresh = (): string[] => {
        const shown = w.lists.shown;
        w.operation(() => w.refresher.refreshAll());
        for (const e of shown) note(e);
        for (const key of [...tinted]) if (!shown.some((e) => e.doc.key === key)) tinted.delete(key);
        return shown.map((e) => `${e.id}:${rangesOf(e.doc).length}`);
      };
      for (let k = 5 + Math.floor(random() * 36); k > 0; k--) {
        const draw = random();
        let expected: string[];
        w.applies.length = 0;
        if (draw < 0.3) {
          log.push("full");
          expected = fullRefresh();
        } else if (draw < 0.7) {
          const doc = pick(docs);
          log.push(`edit ${doc.key} (${doc.languageId})`);
          const shown = w.lists.shown;
          w.operation(() => w.refresher.refreshAfterEdit(edited(doc)));
          const refreshed = doc.languageId !== "quarto" && !tinted.has(doc.key) ? [] : shown.filter((e) => e.doc.key === doc.key);
          expected = refreshed.map((e) => `${e.id}:${rangesOf(e.doc).length}`);
          for (const e of refreshed) note(e);
          editRefreshes++;
          if (expected.length > 0) editsThatApplied++;
          if (doc.languageId !== "quarto" && expected.length > 0) clearsOfNonQuarto++;
        } else if (draw < 0.8) {
          const doc = pick(docs);
          doc.languageId = doc.languageId === "quarto" ? "markdown" : "quarto";
          log.push(`language ${doc.key} -> ${doc.languageId}`);
          expected = [];
        } else if (draw < 0.9) {
          const doc = pick(docs);
          doc.cells = Math.floor(random() * 4);
          log.push(`cells ${doc.key} -> ${doc.cells}`);
          expected = [];
        } else {
          w.lists.shown = someEditors();
          log.push(`shown ${w.lists.shown.map((e) => e.id).join(",")}, then a full refresh`);
          expected = fullRefresh();
        }
        w.lists.elsewhere = someEditors(); // what a later reading of the next operation would answer
        if (JSON.stringify(w.applies) !== JSON.stringify(expected) && problems.length < 5) problems.push(`after [${log.join("; ")}]: applied ${JSON.stringify(w.applies)}, the rule says ${JSON.stringify(expected)}`);
      }
    }
    expect(problems).toEqual([]);
    // floors: the draw reaches edits' refreshes, edits that applied, and the clearing of a tint on a document that is not quarto any more
    expect(editRefreshes).toBeGreaterThan(10_000);
    expect(editsThatApplied).toBeGreaterThan(5_000);
    expect(clearsOfNonQuarto).toBeGreaterThan(200);
  }, 120_000);
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
// another language is cleared by its own next edit, not by another document's.) Both debouncers are built as the adapter builds its own, with the delay AND `TYPING_MAX_WAIT_MS` (both, because the rows compare the two
// worlds' timer counts at every step, and a window on one side only is a second timer there). The enumeration and the seeded sequences are too short for the window to come due (a probe that counted the timers asked for
// 1,000 ms read 381,366 set and none fired): in them it is a pending timer and never a run. The row of a stream of edits 60 ms apart drives it, once, in both worlds; `typing-path-equivalence.test.ts` drives it on timelines.
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
    const typingOld = createKeyedDebouncer({ timers: clockOld, delayMs: TYPING_DEBOUNCE_MS, maxWaitMs: TYPING_MAX_WAIT_MS });
    const isVisible = (doc: FakeDocument): boolean => visible.some((editor) => editor.doc === doc);
    const oldOnDocument = (doc: FakeDocument): void => {
      if (isVisible(doc)) typingOld.schedule(doc.key, () => oldRefresh());
    };

    // ---- The NEW wiring: how the adapter builds the refresher and its debouncer (the delay and `TYPING_MAX_WAIT_MS`, as `registerCellBackgroundFeature` does) and calls them. ----
    const refresher = createCellBackgroundRefresher<FakeEditor, number>({
      visible: () => visible.map((editor) => ({ key: editor.doc.key, languageId: editor.doc.languageId, editor })),
      rangesFor: (editor) => rangesOf(editor.doc),
      apply: (editor, ranges) => {
        heldNew.set(editor.id, ranges.length);
        newApplies++;
      },
    });
    const typingNew = createKeyedDebouncer({ timers: clockNew, delayMs: TYPING_DEBOUNCE_MS, maxWaitMs: TYPING_MAX_WAIT_MS });
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

  it("a stream of edits 60 ms apart for 1,200 ms crosses the maximum wait: the window applies once at 1,000 ms in both worlds (all three editors in the old, the edited document's in the new), and the two agree at every step", () => {
    const events: Event[] = [];
    for (let k = 0; k < 20; k++) events.push("edit Q1", "pause 60");
    const w = oracleWorld();
    expect(w.applies()).toEqual([3, 3]); // the first refresh of each world
    for (const event of events) w.apply(event);
    expect(w.applies()).toEqual([6, 4]); // with no window nothing would have run yet: the stream never paused 150 ms
    expect(w.pending()).toEqual([2, 2]); // the trailing timer of the last edit and the window the first edit after the run opened
    const r = check(events);
    expect(r.problems).toEqual([]);
    expect(r.saved).toBeGreaterThan(0);
  });

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
