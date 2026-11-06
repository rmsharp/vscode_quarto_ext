import { runInNewContext } from "node:vm";
import { setFlagsFromString } from "node:v8";
import { describe, expect, it } from "vitest";
import { createDocumentTextMemo } from "../../src/core/document-text-memo";
import { isInCodeCell } from "../../src/core/in-code-cell";
import { seededRandom } from "./support/regex-equivalence";

// Session 343, D1 -- the document-text memo (BACKLOG: "What Session 342's review round found beside the typing-path cures"). `TextDocument.getText()` joins the whole buffer on every call, and three adapters called it on the typing path
// (the cursor-move key on EVERY selection event, the cell tint on every refresh, the render-script predicate on every keystroke of a script). The memo returns the same string while a document's version stays.
//
// The rows COUNT the calls of the thunk that stands for `document.getText()`. They do not time anything: a count is what a loaded machine cannot fake, and the lead's probe (p2b, `lines.join` for `getText`, 0.215 / 1.145 / 6.157 ms
// a fresh join at 500 / 2,000 / 8,000 cells against 0.001 / 0.001 / 0.005 ms for the very same string) is the cost the count stands for. A string's identity is not observable in JavaScript (`toBe` compares values), so "the
// same string object" is pinned by the one thing that makes it the same: the thunk is not called again.
// `s343-adapter-wiring-pin.test.ts` pins from the syntax tree that the three adapters read their text through the module's one memo, in a thunk, after their guards.

/** A document as the memo sees it: an object with a version. The text lives beside it, as the buffer does, and `edit` bumps the version as VS Code does. */
interface FakeDocument {
  version: number;
  text: string;
}
const doc = (text: string, version = 1): FakeDocument => ({ version, text });

/** A `getText` for `document`, counting its calls. */
function reader(document: FakeDocument): { read: () => string; calls: () => number } {
  let calls = 0;
  return {
    read: () => {
      calls++;
      return document.text;
    },
    calls: () => calls,
  };
}

describe("Session 343 -- the document-text memo returns a document's text, built once a version", () => {
  it("N asks at one version read the text once, and each returns it", () => {
    const memo = createDocumentTextMemo();
    const d = doc("alpha");
    const r = reader(d);
    for (let i = 0; i < 50; i++) expect(memo.textOf(d, r.read)).toBe("alpha");
    expect(r.calls()).toBe(1);
  });

  it("a new version reads the text again, once, and answers the new text", () => {
    const memo = createDocumentTextMemo();
    const d = doc("alpha");
    const r = reader(d);
    expect(memo.textOf(d, r.read)).toBe("alpha");
    d.text = "alpha beta";
    d.version = 2;
    expect(memo.textOf(d, r.read)).toBe("alpha beta");
    expect(memo.textOf(d, r.read)).toBe("alpha beta");
    expect(r.calls()).toBe(2);
  });

  it("an edit that does not change the version is not seen (VS Code raises the version on every change of the text, so none is), and the version alone decides", () => {
    const memo = createDocumentTextMemo();
    const d = doc("alpha");
    const r = reader(d);
    memo.textOf(d, r.read);
    d.text = "changed without a version bump";
    expect(memo.textOf(d, r.read)).toBe("alpha");
    expect(r.calls()).toBe(1);
  });

  it("two document objects with the same version never share an entry: each gets its own text, and each is read once", () => {
    const memo = createDocumentTextMemo();
    const a = doc("text of a");
    const b = doc("text of b");
    const ra = reader(a);
    const rb = reader(b);
    expect(memo.textOf(a, ra.read)).toBe("text of a");
    expect(memo.textOf(b, rb.read)).toBe("text of b");
    expect(memo.textOf(a, ra.read)).toBe("text of a");
    expect(memo.textOf(b, rb.read)).toBe("text of b");
    expect(ra.calls()).toBe(1);
    expect(rb.calls()).toBe(1);
  });

  it("a document closed, edited on disk and reopened is a NEW object at version 1, and gets its own text (a key of the URI and the version would serve the old text)", () => {
    const memo = createDocumentTextMemo();
    const first = doc("the text before it was closed", 1);
    expect(memo.textOf(first, reader(first).read)).toBe("the text before it was closed");
    const reopened = doc("the text edited on disk", 1);
    const r = reader(reopened);
    expect(memo.textOf(reopened, r.read)).toBe("the text edited on disk");
    expect(r.calls()).toBe(1);
  });

  it("a thunk that throws is not cached: the error propagates, the next ask reads again, and the entry the document held before is not served for a version it no longer is", () => {
    const memo = createDocumentTextMemo();
    const d = doc("alpha");
    memo.textOf(d, () => d.text);
    d.version = 2;
    d.text = "beta";
    let calls = 0;
    const failing = (): string => {
      calls++;
      throw new Error("getText failed");
    };
    expect(() => memo.textOf(d, failing)).toThrow("getText failed");
    expect(() => memo.textOf(d, failing)).toThrow("getText failed");
    expect(calls).toBe(2);
    expect(memo.textOf(d, () => d.text)).toBe("beta");
  });

  it("every text is a text and is returned as it was read: an empty one, whitespace, line endings and a separator are kept untouched, and read once", () => {
    for (const text of ["", " ", "\n", "\r\n", "  padded  ", "a\r\nb\r\n", "\u2028", "\ufeff# bom", "x".repeat(100_000)]) {
      const memo = createDocumentTextMemo();
      const d = doc(text);
      const r = reader(d);
      expect(memo.textOf(d, r.read)).toBe(text);
      expect(memo.textOf(d, r.read)).toBe(text);
      expect(r.calls(), JSON.stringify(text.slice(0, 12))).toBe(1);
    }
  });
});

describe("Session 343 -- the document-text memo holds at most two entries, least recently used out", () => {
  /** Three documents, a reader for each. */
  function trio() {
    const docs = { a: doc("A"), b: doc("B"), c: doc("C") };
    const readers = { a: reader(docs.a), b: reader(docs.b), c: reader(docs.c) };
    const memo = createDocumentTextMemo();
    const ask = (name: "a" | "b" | "c"): string => memo.textOf(docs[name], readers[name].read);
    const counts = (): string => `${readers.a.calls()}${readers.b.calls()}${readers.c.calls()}`;
    return { ask, counts };
  }

  it("two documents are both kept", () => {
    const { ask, counts } = trio();
    ask("a");
    ask("b");
    ask("a");
    ask("b");
    expect(counts()).toBe("110");
  });

  it("a third document evicts the least recently used: a, b, c, then a is read again", () => {
    const { ask, counts } = trio();
    ask("a");
    ask("b");
    ask("c");
    expect(counts()).toBe("111");
    ask("a");
    expect(counts()).toBe("211");
  });

  it("an ask refreshes recency: a, b, a, c evicts b and not a", () => {
    const { ask, counts } = trio();
    ask("a");
    ask("b");
    ask("a");
    ask("c");
    ask("a");
    expect(counts()).toBe("111"); // a was kept
    ask("b");
    expect(counts()).toBe("121"); // b was evicted
  });

  it("a new version of a document replaces its own entry and takes no second slot: a, b, a v2, then b is still kept", () => {
    const memo = createDocumentTextMemo();
    const a = doc("A1");
    const b = doc("B1");
    const rb = reader(b);
    memo.textOf(a, () => a.text);
    memo.textOf(b, rb.read);
    a.version = 2;
    a.text = "A2";
    expect(memo.textOf(a, () => a.text)).toBe("A2");
    expect(memo.textOf(b, rb.read)).toBe("B1");
    expect(rb.calls()).toBe(1);
  });

  it("only the latest version of a document is kept: a back to the version it had before reads again", () => {
    const memo = createDocumentTextMemo();
    const a = doc("A1");
    let calls = 0;
    const read = (): string => {
      calls++;
      return a.text;
    };
    memo.textOf(a, read);
    a.version = 2;
    a.text = "A2";
    memo.textOf(a, read);
    a.version = 1;
    a.text = "A1";
    expect(memo.textOf(a, read)).toBe("A1");
    expect(calls).toBe(3);
  });
});

describe("Session 343 -- the document-text memo is lazy where the caller's guard is, and holds no document", () => {
  it("the cursor-move shape: isInCodeCell over the memo reads nothing for a document that is not a quarto one, and reads a quarto one once a version", () => {
    const memo = createDocumentTextMemo();
    const markdown = doc("# not asked");
    const quarto = doc("```{python}\nx = 1\n```\n");
    const rm = reader(markdown);
    const rq = reader(quarto);
    for (let line = 0; line < 20; line++) {
      expect(isInCodeCell("markdown", () => memo.textOf(markdown, rm.read), line)).toBe(false);
      expect(isInCodeCell("quarto", () => memo.textOf(quarto, rq.read), line % 3)).toBe(true);
    }
    expect(rm.calls()).toBe(0);
    expect(rq.calls()).toBe(1);
  });

  it("the memo holds no strong reference to a document: with the memo alive, a document nothing else holds is collected", async () => {
    setFlagsFromString("--expose-gc");
    const gc = runInNewContext("gc") as () => void;
    const memo = createDocumentTextMemo();
    let ref: WeakRef<FakeDocument> | undefined;
    ((): void => {
      const d = doc("a document the extension host has let go of");
      ref = new WeakRef(d);
      memo.textOf(d, () => "its text");
    })();
    // A WeakRef's target is kept to the end of the turn that made or read it; two turns and two collections release it.
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      gc();
    }
    expect(ref?.deref()).toBeUndefined();
    // The memo is still usable after the collection, and answers a new document its own text.
    const next = doc("another");
    expect(memo.textOf(next, () => next.text)).toBe("another");
  });

  it("the entry of a collected document takes no slot: d2, then d1, d1 collected, then d3 -- d2 is still kept", async () => {
    setFlagsFromString("--expose-gc");
    const gc = runInNewContext("gc") as () => void;
    const memo = createDocumentTextMemo();
    const d2 = doc("second");
    const r2 = reader(d2);
    memo.textOf(d2, r2.read);
    let gone: WeakRef<FakeDocument> | undefined;
    ((): void => {
      const d1 = doc("first");
      gone = new WeakRef(d1);
      memo.textOf(d1, () => d1.text);
    })();
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      gc();
    }
    expect(gone?.deref()).toBeUndefined();
    const d3 = doc("third");
    memo.textOf(d3, () => d3.text);
    memo.textOf(d2, r2.read);
    expect(r2.calls()).toBe(1);
  });
});

// The ORACLE: the old spelling, `document.getText()` on every ask. The memo's answer must be the text the document has NOW, for every sequence of edits, reads, reopenings and documents; it may only read LESS. The versions are
// every number a version field can hold (Learning 914): a whole number, a fraction, the tie 2^53, plus and minus Infinity, minus zero and NaN. The contract is VS Code's: a change of the text changes the version (as `===` sees
// it), so NaN, which is never `===` to itself, is a version that reads every time.
describe("Session 343 -- the memo answers what getText() answers now, after every step of seeded sequences of edits, reads and reopenings", () => {
  const WEIRD_VERSIONS = [0.5, 1.5, 2 ** 53 - 2, 2 ** 53 - 1, 2 ** 53, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0, Number.NaN, 7, 1e300, -1];

  it("agrees on 20,000 sequences over 3 documents, with whole-number versions and with the weird ones, and reads fewer times than the old spelling", () => {
    const random = seededRandom(3431);
    let oldReads = 0;
    let newReads = 0;
    const problems: string[] = [];
    let weirdDraws = 0;
    for (let n = 0; n < 20_000 && problems.length < 5; n++) {
      const memo = createDocumentTextMemo();
      const slots: FakeDocument[] = [doc("t0", 1), doc("u0", 1), doc("v0", 1)];
      const weird = [false, random() < 0.5, random() < 0.5];
      // The versions a document has had (a version never comes back for the same document object; NaN is the one version that is never the same twice).
      const had: number[][] = [[1], [1], [1]];
      const edits = [0, 0, 0];
      const length = 6 + Math.floor(random() * 30);
      const trace: string[] = [];
      for (let i = 0; i < length; i++) {
        const which = Math.floor(random() * 3);
        const d = slots[which];
        const action = random();
        if (action < 0.3) {
          // an edit: the text changes and the version moves to one the memo has not seen for this document (under ===)
          edits[which]++;
          d.text = `${"tuv"[which]}${edits[which]}`;
          if (weird[which]) {
            const candidates = WEIRD_VERSIONS.filter((v) => Number.isNaN(v) || !had[which].some((seen) => seen === v));
            d.version = candidates[Math.floor(random() * candidates.length)];
            had[which].push(d.version);
            weirdDraws++;
          } else {
            d.version++;
            had[which].push(d.version);
          }
          trace.push(`edit ${which}`);
        } else if (action < 0.4) {
          // closed and reopened: a new object, a new text, version 1 again
          edits[which]++;
          slots[which] = doc(`${"tuv"[which]}r${edits[which]}`, 1);
          had[which] = [1];
          trace.push(`reopen ${which}`);
        } else {
          const current = slots[which];
          let reads = 0;
          const answer = memo.textOf(current, () => {
            reads++;
            return current.text;
          });
          oldReads++;
          newReads += reads;
          trace.push(`ask ${which}`);
          if (answer !== current.text) problems.push(`after [${trace.join(", ")}] the memo answered ${JSON.stringify(answer)}, getText() ${JSON.stringify(current.text)}`);
          if (reads > 1) problems.push(`after [${trace.join(", ")}] one ask read ${reads} times`);
        }
      }
    }
    expect(problems).toEqual([]);
    expect(weirdDraws).toBeGreaterThan(10_000);
    expect(oldReads).toBeGreaterThan(100_000);
    expect(newReads).toBeLessThan(oldReads * 0.8);
  });

  it("answers NaN-versioned documents by reading every time, and every other kind of version by reading once while it stays", () => {
    for (const version of WEIRD_VERSIONS) {
      const memo = createDocumentTextMemo();
      const d = doc("weird", version);
      const r = reader(d);
      for (let i = 0; i < 4; i++) expect(memo.textOf(d, r.read)).toBe("weird");
      expect(r.calls(), `version ${String(version)}`).toBe(Number.isNaN(version) ? 4 : 1);
    }
  });
});
