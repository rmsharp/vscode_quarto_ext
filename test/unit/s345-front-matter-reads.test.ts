import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";
import { findAllCells, findBodyLines, findFrontMatter, findHeadings, frontMatterContentLines, inFrontMatter, readFrontMatter } from "../../src/core/qmd/model";
import { findNestedFrontMatterValueLines } from "../../src/core/yaml-frontmatter-nested-values";
import { findFrontMatterTopLevelLines } from "../../src/core/yaml-frontmatter-values";
import { BOM, LS, NBSP, PS, seededRandom } from "./support/regex-equivalence";
import {
  oldFindFrontMatter,
  oldFindFrontMatterTopLevelLines,
  oldFindNestedFrontMatterValueLines,
  oldFrontMatterContentLines,
  oldFrontMatterSpan,
  oldInFrontMatter,
  oldResolveDocumentEngine,
} from "./support/s345-front-matter-oracle";

// Session 345 -- part P3 of the BACKLOG item SIB-01 ("the first completion request after an edit pays a cold whole-document scan"), the operator's pick: REMOVE EXACT DUPLICATE WORK, no
// behaviour change anywhere. `resolveDocumentEngine(fileName, text)` reads the front matter of `text.trimStart()` three times (`findFrontMatterTopLevelLines`, `findNestedFrontMatterValueLines`,
// `frontMatterContentLines`), and each of the three called `frontMatterContentLines`, which split the WHOLE document into lines only to slice the few lines of the front matter out of the
// result: three whole-document splits a call (parent, measured: 3.9 ms at 2,000 cells of 25 lines, 15.5 at 8,000), and for a text that begins with whitespace a FOURTH cold scan, because
// `trimStart()` makes another string and `scanRegions` is keyed on the string.
//
// THE OLD SPELLINGS are the oracle (`support/s345-front-matter-oracle.ts`, copied from the parent by a program): `oldFrontMatterContentLines`, `oldFindFrontMatter`, `oldInFrontMatter`,
// `oldFindFrontMatterTopLevelLines`, `oldFindNestedFrontMatterValueLines` and `oldResolveDocumentEngine`. Every answer of the new code must DEEP-EQUAL the old one over: the exhaustive
// documents of a small alphabet of line shapes (the first describe), the same shapes under every line terminator and every leading run, a SEEDED generator of whole documents (seed 345,
// floored so that a generator that drew nothing fails), and every tracked `.qmd` / `.md` / `.Rmd` of the repository under six leading runs and both line endings.
//
// THE COUNTERS are exact and need no clock: how many times `String.prototype.split` was called on a string at least half as long as the document while the call ran (a whole-document split, or
// anything near it), and how many times `indexOf` was (a reader that pre-reads the document line by line is not a split and would pass the first counter).

/** Run `run` and count the calls of `String.prototype.split` / `indexOf` whose receiver is at least half as long as `whole`: the splits and the searches that read the document, not a line of it. */
function readsOf<T>(whole: string, run: () => T): { value: T; splits: number; searches: number } {
  const split = String.prototype.split;
  const indexOf = String.prototype.indexOf;
  let splits = 0;
  let searches = 0;
  const big = (receiver: unknown): boolean => String(receiver).length * 2 >= whole.length;
  String.prototype.split = function (this: string, ...args: unknown[]) {
    if (big(this)) splits++;
    return (split as (...a: unknown[]) => unknown).apply(this, args);
  } as typeof String.prototype.split;
  String.prototype.indexOf = function (this: string, ...args: unknown[]) {
    if (big(this)) searches++;
    return (indexOf as (...a: unknown[]) => unknown).apply(this, args);
  } as typeof String.prototype.indexOf;
  try {
    const value = run();
    return { value, splits, searches };
  } finally {
    String.prototype.split = split;
    String.prototype.indexOf = indexOf;
  }
}

const FRONT = ["---", "title: t", "engine: markdown", "toc: true", "---"];
const INTERIOR = FRONT.slice(1, 4);

/** A document whose front matter is five lines and whose body is `bodyLines` lines of prose: built by repeat, not by a loop (Learning 929), with `lead` before the opening fence. */
function documentOf(bodyLines: number, lead = ""): string {
  return lead + FRONT.join("\n") + "\n" + "Some prose.\n\n".repeat(bodyLines >> 1);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE COUNTERS' OWN ROWS: a counter that never counts passes every row that expects zero (Learning 910).

describe("Session 345 P3 -- the counters count", () => {
  const whole = "0123456789".repeat(20); // 200 characters

  it("a split of the document, of a string exactly half as long and of a longer one count; a shorter one does not", () => {
    expect(readsOf(whole, () => whole.split("\n")).splits).toBe(1);
    expect(readsOf(whole, () => whole.slice(0, 100).split("\n")).splits).toBe(1);
    expect(readsOf(whole, () => whole.slice(0, 99).split("\n")).splits).toBe(0);
    expect(readsOf(whole, () => (whole + "x").split(/\r?\n/)).splits).toBe(1);
    expect(readsOf(whole, () => whole.split("\n").length).value).toBe(1);
  });

  it("a search of the document, of a string exactly half as long and of a longer one count; a shorter one does not", () => {
    expect(readsOf(whole, () => whole.indexOf("\n")).searches).toBe(1);
    expect(readsOf(whole, () => whole.slice(0, 100).indexOf("\n")).searches).toBe(1);
    expect(readsOf(whole, () => whole.slice(0, 99).indexOf("\n")).searches).toBe(0);
    expect(readsOf(whole, () => [whole.indexOf("a"), whole.indexOf("b"), whole.indexOf("c")]).searches).toBe(3);
    expect(readsOf(whole, () => whole.indexOf("9")).value).toBe(9);
  });

  it("a split is not a search and a search is not a split", () => {
    expect(readsOf(whole, () => whole.split("\n"))).toMatchObject({ splits: 1, searches: 0 });
    expect(readsOf(whole, () => whole.indexOf("\n"))).toMatchObject({ splits: 0, searches: 1 });
  });

  it("String.prototype is put back after a call, and after a call that throws", () => {
    const split = String.prototype.split;
    const indexOf = String.prototype.indexOf;
    readsOf(whole, () => whole.split("\n"));
    expect(String.prototype.split).toBe(split);
    expect(String.prototype.indexOf).toBe(indexOf);
    expect(() =>
      readsOf(whole, () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(String.prototype.split).toBe(split);
    expect(String.prototype.indexOf).toBe(indexOf);
  });

  it("the arguments and the answer pass through: the split is the real split", () => {
    expect(readsOf(whole, () => "a\r\nb".split(/\r?\n/)).value).toEqual(["a", "b"]);
    expect(readsOf(whole, () => "abcabc".indexOf("c", 3)).value).toBe(5);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE COUNTERS, slice A: once the scan is cached, a read of the front matter reads the front matter and not the document.

describe("Session 345 P3 -- the interior of the front matter is read without splitting the document", () => {
  const text = documentOf(20_000);

  it("the fixture is what the rows say: 20,000 body lines, a five-line block, and a scan that finds it", () => {
    expect(text.split("\n").length).toBeGreaterThan(20_000);
    expect(findFrontMatter(text)).toEqual({ startLine: 0, endLine: 4 });
  });

  it("frontMatterContentLines on a scanned document splits no large string", () => {
    findHeadings(text); // the earlier provider's scan: the cache holds (text)
    const { value, splits } = readsOf(text, () => frontMatterContentLines(text));
    expect(value).toEqual(INTERIOR);
    expect(splits).toBe(0);
  });

  it("findFrontMatterTopLevelLines on a scanned document splits no large string", () => {
    findHeadings(text);
    const { value, splits } = readsOf(text, () => findFrontMatterTopLevelLines(text));
    expect(value.map((l) => l.key)).toEqual(["title", "engine", "toc"]);
    expect(splits).toBe(0);
  });

  it("findNestedFrontMatterValueLines on a scanned document splits no large string", () => {
    const nested = FRONT.slice(0, 2).concat(["execute:", "  echo: false"], FRONT.slice(4)).join("\n") + "\n" + "Some prose.\n\n".repeat(10_000);
    findHeadings(nested);
    const { value, splits } = readsOf(nested, () => findNestedFrontMatterValueLines(nested));
    expect(value.map((l) => l.key)).toEqual(["echo"]);
    expect(splits).toBe(0);
  });

  it("resolveDocumentEngine on a scanned document splits no large string (the parent split it three times)", () => {
    findHeadings(text);
    const { value, splits } = readsOf(text, () => resolveDocumentEngine("doc.qmd", text));
    expect(value).toBe("markdown");
    expect(splits).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE COUNTERS, slice B: the front matter is read from the text itself, so no scan is needed to know where it is.

/** `true` when `run` put a new entry into the scan cache: four small documents fill its four slots, the first of them is the oldest, and a new entry pushes it out (a hit on the oldest, by the identity of its cells, says it is still there). */
function addsScanEntry(run: () => unknown): boolean {
  const documents = ["A", "B", "C", "D"].map((tag) => "```{python}\nx = 1\n```\n" + tag);
  const oldest = findAllCells(documents[0])[0];
  for (const document of documents.slice(1)) findAllCells(document);
  run();
  return findAllCells(documents[0])[0] !== oldest;
}

describe("Session 345 P3 -- the front matter is read without a scan", () => {
  const blankFirst = documentOf(20_000, "\n");
  const cold = documentOf(20_000) + "cold\n";
  const NO_FRONT_MATTER = "# Title\n" + "Some prose.\n\n".repeat(10_000);

  it("the probe sees a scan: asking findHeadings of a fresh text adds an entry, asking it of a cached one does not", () => {
    const fresh = documentOf(40, "\n\n\n");
    expect(addsScanEntry(() => findHeadings(fresh))).toBe(true);
    expect(addsScanEntry(() => undefined)).toBe(false);
  });

  it("resolveDocumentEngine of a text that begins with a blank line splits nothing and scans nothing (the parent scanned the trimmed text: its 4th cold split)", () => {
    findHeadings(blankFirst); // the earlier provider scans the text as it is
    const { value, splits } = readsOf(blankFirst, () => resolveDocumentEngine("doc.qmd", blankFirst));
    expect(value).toBe("markdown");
    expect(splits).toBe(0);
    expect(addsScanEntry(() => resolveDocumentEngine("doc.qmd", documentOf(40, "\n")))).toBe(false);
  });

  it("resolveDocumentEngine of a text nobody has scanned splits nothing and scans nothing", () => {
    const { value, splits } = readsOf(cold, () => resolveDocumentEngine("doc.qmd", cold));
    expect(value).toBe("markdown");
    expect(splits).toBe(0);
    expect(addsScanEntry(() => resolveDocumentEngine("doc.qmd", documentOf(40) + "cold again\n"))).toBe(false);
  });

  it("findFrontMatter, inFrontMatter and frontMatterContentLines of an unscanned text split nothing and scan nothing", () => {
    let fresh = 0;
    for (const read of [
      (t: string) => findFrontMatter(t),
      (t: string) => inFrontMatter(t, 2),
      (t: string) => frontMatterContentLines(t),
      (t: string) => findFrontMatterTopLevelLines(t),
      (t: string) => findNestedFrontMatterValueLines(t),
    ]) {
      const text = documentOf(20_000, "\n") + `unscanned ${++fresh}\n`;
      const { splits } = readsOf(text, () => read(text));
      expect(splits).toBe(0);
      expect(addsScanEntry(() => read(documentOf(40, "\n") + `unscanned ${++fresh}\n`))).toBe(false);
    }
  });

  it("the resolver reads a five-line front matter once: the document is searched at most five times, not once for each of the three readers", () => {
    const text = documentOf(20_000, "") + "read once\n";
    findHeadings(text); // scanned first, so that no search of the scan itself is counted
    const { value, searches } = readsOf(text, () => resolveDocumentEngine("doc.qmd", text));
    expect(value).toBe("markdown");
    expect(searches).toBeLessThanOrEqual(FRONT.length);
  });

  it("a document with no front matter is refused after its first line, not after a read of the document", () => {
    const { value, searches, splits } = readsOf(NO_FRONT_MATTER, () => resolveDocumentEngine("doc.qmd", NO_FRONT_MATTER));
    expect(value).toBe("markdown");
    expect(searches).toBeLessThanOrEqual(1);
    expect(splits).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE COUNTERS, slice C (F1): a text the scan already holds is answered from the scan's entry, as the parent answered it, and not read again.

describe("Session 345 F1 -- findFrontMatter and inFrontMatter of a scanned text read the scan's span, not the text", () => {
  // A front matter that is never closed: 2 + 20,000 lines of block and one empty line after the last line feed, so the span runs to line 20,002. Cut from the text, it costs one search per line.
  const unterminated = "---\ntitle: t\n" + "k: v\n".repeat(20_000);

  it("the fixture is what the rows say: a block that runs to the last line, 20,003 lines in all", () => {
    expect(unterminated.split("\n").length).toBe(20_003);
    expect(findFrontMatter(unterminated)).toEqual({ startLine: 0, endLine: 20_002 });
  });

  it("findFrontMatter of a text the scan holds (under the blind key) searches and splits nothing", () => {
    findAllCells(unterminated);
    const { value, splits, searches } = readsOf(unterminated, () => findFrontMatter(unterminated));
    expect(value).toEqual({ startLine: 0, endLine: 20_002 });
    expect(splits).toBe(0);
    expect(searches).toBe(0);
  });

  it("inFrontMatter of a text the scan holds (under the blind key) searches and splits nothing", () => {
    findAllCells(unterminated);
    const { value, splits, searches } = readsOf(unterminated, () => [inFrontMatter(unterminated, 1), inFrontMatter(unterminated, 20_002), inFrontMatter(unterminated, 20_003), inFrontMatter(unterminated, 0)]);
    expect(value).toEqual([true, true, false, false]);
    expect(splits).toBe(0);
    expect(searches).toBe(0);
  });

  // The control of the three routes the oracle rows below are run under (Learning 910: a route that is never taken makes its rows a repeat of another): what each route costs in searches of the document.
  it.each([
    ["scanned", false],
    ["scanned under another key", true],
    ["unscanned", true],
  ] as const)("route '%s': findFrontMatter and inFrontMatter %s read the text, twice in a row (the second does not find an entry the first stored)", (route, reads) => {
    const text = unterminated + route; // a text of its own, so that no row's scan is taken for this one's
    standAs(route, text);
    for (let round = 0; round < 2; round++) {
      const found = readsOf(text, () => findFrontMatter(text));
      const asked = readsOf(text, () => inFrontMatter(text, 1));
      expect(found.value).toEqual({ startLine: 0, endLine: 20_002 });
      expect(asked.value).toBe(true);
      // A line per search (20,003 in all): the text is cut as far as the block runs, which is to its end.
      if (reads) {
        expect(found.searches).toBeGreaterThanOrEqual(20_000);
        expect(asked.searches).toBeGreaterThanOrEqual(20_000);
      } else {
        expect(found.searches).toBe(0);
        expect(asked.searches).toBe(0);
      }
    }
  });
});

/** The engine argument of the scan: `undefined` is the engine-blind key every front-matter read asks. */
type Engine = Parameters<typeof findAllCells>[1];

/**
 * Counts scans without a hook on the scanner: a scan makes new `Cell` objects and a cache hit hands back the ones the last scan made, so `ask` says it scanned when the first cell of `text` under `engine`
 * is not the object it was last seen to be. Every text a row uses holds one cell and is made unique by its tag, so that no entry of another row is mistaken for its own.
 */
function scanTally(): { ask: (text: string, engine?: Engine) => boolean; readonly scans: number } {
  const seen = new Map<string, unknown>();
  let scans = 0;
  return {
    ask(text, engine) {
      const first = findAllCells(text, engine)[0];
      const key = `${String(engine)}|${text}`;
      const scanned = seen.get(key) !== first;
      seen.set(key, first);
      if (scanned) scans++;
      return scanned;
    },
    get scans() {
      return scans;
    },
  };
}

/** A small document with a front matter that is terminated, one `python` cell, and `tag` at the end so that no two rows share a text. */
function cellDocument(tag: string): string {
  return "---\ntitle: t\n---\n```{python}\nx = 1\n```\n" + tag;
}

/** Every read of the front matter the parent answered by asking the engine-blind scan (`scanRegions(text)`), each asked of one text; the number is the line `inFrontMatter` is asked about. */
const READS_THAT_ASKED_THE_SCAN: Array<[string, (text: string) => unknown]> = [
  ["findFrontMatter", (text) => findFrontMatter(text)],
  ["inFrontMatter", (text) => inFrontMatter(text, 1)],
  ["frontMatterContentLines", (text) => frontMatterContentLines(text)],
  ["readFrontMatter", (text) => readFrontMatter(text)],
  ["findFrontMatterTopLevelLines", (text) => findFrontMatterTopLevelLines(text)],
  ["findNestedFrontMatterValueLines", (text) => findNestedFrontMatterValueLines(text)],
  ["resolveDocumentEngine", (text) => resolveDocumentEngine("doc.qmd", text)],
];

describe("Session 345 F1 -- a read of the front matter of a scanned text refreshes its entry, as the parent's did", () => {
  // The sequence: four texts scanned (the cache holds four, T4 newest), the OLDEST read through a front-matter reader, a fifth scanned, the oldest asked again. The parent's reader was a cache hit that
  // promoted T1, so the fifth scan pushed out T2 and the last ask was a hit: 5 scans in all (measured on the parent's build, acbc51f, for each of the seven readers below). A reader that does not touch
  // the cache leaves T1 the oldest, the fifth scan pushes it out, and the last ask is a sixth scan (the control row: no read at all is 6).
  function scansOfTheSequence(read: ((text: string) => unknown) | null, tag: string): { scans: number; asks: boolean[] } {
    const tally = scanTally();
    const [t1, t2, t3, t4, t5] = ["one", "two", "three", "four", "five"].map((n) => cellDocument(`${tag} ${n}`));
    const asks = [tally.ask(t1), tally.ask(t2), tally.ask(t3), tally.ask(t4)];
    if (read !== null) read(t1);
    asks.push(tally.ask(t5), tally.ask(t1));
    return { scans: tally.scans, asks };
  }

  it("control: with no read between, the oldest text was pushed out and the last ask is a scan (6 scans)", () => {
    expect(scansOfTheSequence(null, "control")).toEqual({ scans: 6, asks: [true, true, true, true, true, true] });
  });

  it.each(READS_THAT_ASKED_THE_SCAN)("%s of the oldest scanned text keeps it: the fifth scan pushes out another and the last ask is a hit (5 scans, the parent's count)", (name, read) => {
    expect(scansOfTheSequence(read, name)).toEqual({ scans: 5, asks: [true, true, true, true, true, false] });
  });

  // The reader asks the ENGINE-BLIND key. An entry of the same text under another key is not that entry: reading it is a miss, which refreshes nothing (and stores nothing: the route rows above ask twice).
  it.each(READS_THAT_ASKED_THE_SCAN)("%s of a text the scan holds only under another key refreshes that entry not: it is still the oldest, and is pushed out by the fifth scan (6 scans)", (name, read) => {
    const tally = scanTally();
    const [t1, t2, t3, t4, t5] = ["one", "two", "three", "four", "five"].map((n) => cellDocument(`${name} other key ${n}`));
    const asks = [tally.ask(t1, "knitr"), tally.ask(t2), tally.ask(t3), tally.ask(t4)];
    read(t1);
    asks.push(tally.ask(t5), tally.ask(t1, "knitr"));
    expect({ scans: tally.scans, asks }).toEqual({ scans: 6, asks: [true, true, true, true, true, true] });
  });

  // A miss stores nothing: asked blind afterwards, the text is scanned for the first time, whether the scan held it under another key or not at all.
  it.each(READS_THAT_ASKED_THE_SCAN.flatMap(([name, read]) => [["unscanned", name, read] as const, ["scanned under another key", name, read] as const]))(
    "route '%s': %s stores no entry for the blind key (the next blind ask is a scan)",
    (route, name, read) => {
      const tally = scanTally();
      const text = cellDocument(`${name} stores nothing ${route}`);
      if (route === "scanned under another key") expect(tally.ask(text, "knitr")).toBe(true);
      read(text);
      expect(tally.ask(text)).toBe(true);
    },
  );
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE ORACLE.

const FILE_NAMES = ["doc.qmd", "doc.Rmd", "doc.rmd"];

/** The block `readFrontMatter` must return, assembled from the parent's span and the parent's interior. */
function oldBlock(text: string): { startLine: number; endLine: number; terminated: boolean; content: string[] } | null {
  const span = oldFrontMatterSpan(text);
  const content = oldFrontMatterContentLines(text);
  return span === null || content === null ? null : { ...span, content };
}

/** The seven readers the oracle compares: the new code, or (in the control rows) the new code with one of them made wrong. */
interface Reads {
  findFrontMatter: typeof findFrontMatter;
  frontMatterContentLines: typeof frontMatterContentLines;
  readFrontMatter: typeof readFrontMatter;
  findFrontMatterTopLevelLines: typeof findFrontMatterTopLevelLines;
  findNestedFrontMatterValueLines: typeof findNestedFrontMatterValueLines;
  inFrontMatter: typeof inFrontMatter;
  resolveDocumentEngine: typeof resolveDocumentEngine;
}
const NEW_READS: Reads = { findFrontMatter, frontMatterContentLines, readFrontMatter, findFrontMatterTopLevelLines, findNestedFrontMatterValueLines, inFrontMatter, resolveDocumentEngine };

/**
 * How the scan stands when a text is read. A reader answers from the entry of the ENGINE-BLIND scan when the scan holds the text under that key (`scanned`), reads the text itself when the scan holds it
 * only under another key (`scanned under another key`: a miss) and when it holds it not at all (`unscanned`); the three must give one answer, the parent's.
 */
type Route = "unscanned" | "scanned" | "scanned under another key";
const ROUTES: readonly Route[] = ["unscanned", "scanned", "scanned under another key"];

/**
 * Put the scan into the state `route` names for `text`. The scan holds four entries and the rows draw hundreds of texts, so a text of an earlier row is gone from it before it is drawn again (a row of fewer
 * than five texts that runs the same text under two routes calls `flushScan` between them).
 */
function standAs(route: Route, text: string): void {
  if (route === "scanned") findAllCells(text);
  else if (route === "scanned under another key") findAllCells(text, "knitr");
}

let fillers = 0;
/** Push every entry the scan holds out of it: four texts nobody else asks are scanned, which is the whole cache. */
function flushScan(): void {
  for (let i = 0; i < 4; i++) findAllCells(cellDocument(`filler ${++fillers}`));
}

/** `null` when every answer of the new code equals the parent's for `text`, else the first answer that differs. `inFrontMatter` is asked of every line number there is a reason to ask and of the numbers that are not lines. */
function disagreement(text: string, fileNames: readonly string[] = FILE_NAMES, wide = true, reads: Reads = NEW_READS, route: Route = "unscanned"): string | null {
  standAs(route, text);
  const same = (what: string, a: unknown, b: unknown): string | null => {
    const x = JSON.stringify(a) ?? "undefined";
    const y = JSON.stringify(b) ?? "undefined";
    return x === y ? null : `${what}\n  new: ${x}\n  old: ${y}\n  text: ${JSON.stringify(text.length > 300 ? text.slice(0, 300) + "..." : text)}`;
  };
  const checks: Array<string | null> = [
    same("findFrontMatter", reads.findFrontMatter(text), oldFindFrontMatter(text)),
    same("frontMatterContentLines", reads.frontMatterContentLines(text), oldFrontMatterContentLines(text)),
    same("readFrontMatter", reads.readFrontMatter(text), oldBlock(text)),
    same("findFrontMatterTopLevelLines", reads.findFrontMatterTopLevelLines(text), oldFindFrontMatterTopLevelLines(text)),
    same("findNestedFrontMatterValueLines", reads.findNestedFrontMatterValueLines(text), oldFindNestedFrontMatterValueLines(text)),
  ];
  const lineCount = text.split(/\r?\n/).length;
  const asked = wide ? [-Infinity, -1, -0, 0, 0.5, 1, 1.5, NaN, lineCount - 1, lineCount, lineCount + 1, Infinity, 2 ** 31] : [-1, 0, lineCount - 1, lineCount];
  for (let line = 1; line < Math.min(lineCount + 1, wide ? 12 : 8); line++) asked.push(line);
  for (const line of asked) checks.push(same(`inFrontMatter(${line})`, reads.inFrontMatter(text, line), oldInFrontMatter(text, line)));
  for (const fileName of fileNames) checks.push(same(`resolveDocumentEngine(${fileName})`, reads.resolveDocumentEngine(fileName, text), oldResolveDocumentEngine(fileName, text)));
  return checks.find((c) => c !== null) ?? null;
}

/** The first disagreement over `texts`, and how many were drawn (a generator that draws nothing must fail on its floor, not pass on its emptiness). */
function firstDisagreement(texts: Iterable<string>, fileNames?: readonly string[], wide = true, reads: Reads = NEW_READS, route: Route = "unscanned"): { drawn: number; first: string | null } {
  let drawn = 0;
  for (const text of texts) {
    drawn++;
    const d = disagreement(text, fileNames, wide, reads, route);
    if (d !== null) return { drawn, first: d };
  }
  return { drawn, first: null };
}

/** Every sequence of 0..maxLength items of `alphabet`, joined by `separator`. */
function* everyDocument(alphabet: readonly string[], maxLength: number, separator = "\n"): Generator<string> {
  yield "";
  for (let length = 1; length <= maxLength; length++) {
    const digits = new Array<number>(length).fill(0);
    for (;;) {
      yield digits.map((d) => alphabet[d]).join(separator);
      let place = length - 1;
      while (place >= 0 && digits[place] === alphabet.length - 1) {
        digits[place] = 0;
        place--;
      }
      if (place < 0) break;
      digits[place]++;
    }
  }
}

// The line shapes that decide a front matter: both fences, the YAML document end, a fence with trailing blanks, a fence with something after it, a blank line, a whitespace line, a key,
// an engine key, a heading, and a cell fence.
const SHAPES = ["---", "...", "", " ", "a: b", "engine: markdown", "--- ", "---x", "# h", "```{r}"];
// A smaller alphabet for the longer documents: what opens, what closes, what separates, what is content, what selects an engine, what is body.
const CORE = ["---", "...", "", "a: b", "engine: markdown", "# h"];

/** Every sequence of 1..maxLength pieces of `pieces`, a separator of `separators` between each pair (every combination), shortest first. */
function* everySeparated(pieces: readonly string[], separators: readonly string[], maxLength: number): Generator<string> {
  const build = function* (remaining: number, text: string): Generator<string> {
    yield text;
    if (remaining === 0) return;
    for (const separator of separators) for (const piece of pieces) yield* build(remaining - 1, text + separator + piece);
  };
  for (const first of pieces) yield* build(maxLength - 1, first);
}

// A differential that finds nothing is proved only by a control (Learning 893): each of the seven comparisons is fed one wrong answer and must name it.
describe("Session 345 P3 -- the oracle notices", () => {
  const document = ["---", "engine: markdown", "execute:", "  echo: false", "---", "```{r}", "```"].join("\n");
  const wrong: Reads = {
    findFrontMatter: () => ({ startLine: 0, endLine: 99 }),
    frontMatterContentLines: () => ["wrong"],
    readFrontMatter: () => null,
    findFrontMatterTopLevelLines: () => [],
    findNestedFrontMatterValueLines: () => [],
    inFrontMatter: () => true,
    resolveDocumentEngine: () => "jupyter",
  };

  it("the control document agrees with the new code", () => {
    expect(disagreement(document)).toBeNull();
    expect(disagreement(document, FILE_NAMES, false)).toBeNull();
  });

  it.each(Object.keys(wrong) as Array<keyof Reads>)("a wrong %s is reported by name", (name) => {
    for (const wide of [true, false]) {
      const found = disagreement(document, FILE_NAMES, wide, { ...NEW_READS, [name]: wrong[name] });
      expect(found, name).not.toBeNull();
      expect(found, name).toContain(name);
    }
  });

  it("an empty interior is not 'none', and 'none' is not an undefined engine", () => {
    expect(disagreement("# T", FILE_NAMES, true, { ...NEW_READS, frontMatterContentLines: () => [] })).toContain("frontMatterContentLines");
    expect(disagreement("{{< include a.qmd >}}", FILE_NAMES, true, { ...NEW_READS, resolveDocumentEngine: () => null as never })).toContain("resolveDocumentEngine");
    expect(disagreement("{{< include a.qmd >}}", ["doc.Rmd"], true, { ...NEW_READS, resolveDocumentEngine: () => undefined })).toContain("resolveDocumentEngine");
  });

  it("a wrong answer for one of the file names is reported with the name", () => {
    const found = disagreement(document, ["doc.qmd", "doc.Rmd"], true, { ...NEW_READS, resolveDocumentEngine: (fileName, text) => (fileName === "doc.Rmd" ? "markdown" : resolveDocumentEngine(fileName, text)) });
    expect(found).toContain("resolveDocumentEngine(doc.Rmd)");
  });

  it("the route is handed on and taken: a findFrontMatter that is wrong only for a text the scan holds is reported under 'scanned' and under no other route", () => {
    // Wrong exactly when the answer came from the scan's entry: asked with the document as large as the cached read leaves it (no search of it at all).
    const wrongOnAHit: Reads = {
      ...NEW_READS,
      findFrontMatter: (text) => (readsOf(text.repeat(2), () => findFrontMatter(text)).searches === 0 ? { startLine: 9, endLine: 9 } : findFrontMatter(text)),
    };
    for (const route of ROUTES) {
      flushScan();
      const found = disagreement(document, FILE_NAMES, false, wrongOnAHit, route);
      if (route === "scanned") expect(found, route).toContain("findFrontMatter");
      else expect(found, route).toBeNull();
      const first = firstDisagreement(["# a", document, "# b"], FILE_NAMES, false, wrongOnAHit, route);
      expect(first.first === null, route).toBe(route !== "scanned");
      expect(first.drawn, route).toBe(route === "scanned" ? 1 : 3);
    }
  });

  it("firstDisagreement stops at the first text that differs and says how many it drew", () => {
    expect(firstDisagreement(["# a", "# b"])).toEqual({ drawn: 2, first: null });
    const stopped = firstDisagreement(["# a", document, "# b"], FILE_NAMES, true, { ...NEW_READS, readFrontMatter: wrong.readFrontMatter });
    expect(stopped.drawn).toBe(2);
    expect(stopped.first).toContain("readFrontMatter");
  });
});

describe.each(ROUTES)("Session 345 P3 -- the oracle: every answer equals the parent's (exhaustive documents), scan: %s", (route) => {
  it("every document of 0..4 lines over ten line shapes joined by LF (11,111 documents)", () => {
    const { drawn, first } = firstDisagreement(everyDocument(SHAPES, 4), ["doc.qmd", "doc.Rmd"], true, NEW_READS, route);
    expect(first).toBeNull();
    expect(drawn).toBe(1 + 10 + 100 + 1000 + 10_000);
  });

  it("every document of 0..6 lines over six core shapes joined by LF (55,987 documents)", () => {
    const { drawn, first } = firstDisagreement(everyDocument(CORE, 6), ["doc.qmd"], false, NEW_READS, route);
    expect(first).toBeNull();
    expect(drawn).toBe(1 + 6 + 36 + 216 + 1296 + 7776 + 46_656);
  });

  it("every document of 0..4 lines over the ten shapes joined by CRLF", () => {
    const { drawn, first } = firstDisagreement(everyDocument(SHAPES, 4, "\r\n"), ["doc.qmd"], false, NEW_READS, route);
    expect(first).toBeNull();
    expect(drawn).toBe(1 + 10 + 100 + 1000 + 10_000);
  });

  it("the terminators that are breaks (LF, CRLF) and the ones that are not (CR, U+2028, U+2029, form feed), between every pair of up to four pieces", () => {
    const { drawn, first } = firstDisagreement(everySeparated(["---", "a: b", "...", ""], ["\n", "\r\n", "\r", LS, PS, "\f"], 4), ["doc.qmd"], false, NEW_READS, route);
    expect(first).toBeNull();
    // 4 pieces; 4 x 6 x 4 two-piece, and so on: 4 + 4*6*4 + 4*(6*4)^2 + 4*(6*4)^3
    expect(drawn).toBe(4 + 4 * 24 + 4 * 24 ** 2 + 4 * 24 ** 3);
  });

  it("a leading run of every kind in front of a terminated block, an unterminated one, a dots terminator and a block with a blank line under its opener", () => {
    const runs = ["", "\n", "\n\n\n", " ", "   \n", "\t", "    \n    \n", "\r\n", BOM, BOM + "\n", NBSP, LS, PS, "\f", "\f\n", "\n" + BOM];
    const blocks = [
      "---\ntitle: t\nengine: markdown\n---\n```{r}\n```\n",
      "---\ntitle: t\nengine: jupyter",
      "---\ntitle: t\n...\n```{python}\n```\n",
      "---\n\ntitle: t\n---\n",
      "---\n",
      "---",
      "---\n---",
      "---\n...",
      "---\nexecute:\n  engine: markdown\n---\n```{r}\n```\n```{python}\n#| cache: banana\n```\n",
      "---\nknitr:\n  opts_chunk:\n    echo: false\n---\n",
    ];
    const texts: string[] = [];
    for (const run of runs) for (const block of blocks) texts.push(run + block, run + block.replace(/\n/g, "\r\n"));
    const { drawn, first } = firstDisagreement(texts, undefined, true, NEW_READS, route);
    expect(first).toBeNull();
    expect(drawn).toBe(runs.length * blocks.length * 2);
  });

  it("the named edge cases: the empty text, a text that is only a fence, a final line with no newline, a lone CR, and an unterminated block", () => {
    const cases = ["", "\n", "---", "---\n", "\n---", "\n---\n", "---\r", "---\r\n", "---\na", "---\na\r", "---\r\na\r\n---\r", "---\r\n---\r\n", "a\r---\n", "---\nk: v\n---", "---\nk: v\n---\n", "---\nk: v\n...", " ---\nk: v\n---"];
    const { drawn, first } = firstDisagreement(cases, undefined, true, NEW_READS, route);
    expect(first).toBeNull();
    expect(drawn).toBe(cases.length);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE SEEDED DOCUMENTS.

const FRONT_POOL = [
  "title: T", "title: \"two", "  lines\"", "engine: markdown", "engine: knitr", "engine: jupyter", "engine: banana", "jupyter: python3", "jupyter:", "  kernelspec:", "    name: python3",
  "knitr: true", "knitr: false", "knitr:", "  opts_chunk:", "execute:", "  engine: markdown", "  echo: false", "  engine: *a", "execute: {engine: markdown}", "format:", "  html:", "    toc: true",
  "from: gfm", "tags: [a,", "  b]", "# a comment", "", "  ", "key: |", "  block text", "- item", "a: &x [1,", "bibliography: refs.bib", "toc: banana", "---x", "-----",
];
const BODY_POOL = [
  "", "", "# Heading", "## Other {#sec-o}", "```{r}", "1 + 1", "```", "```{python}", "#| cache: banana", "x = 1", "```", "```{julia}", "Some prose here.", "---", "...", "{{< include a.qmd >}}", "<!--", "-->",
  "> # quoted", "::: {.callout-note}", ":::", "- list item", "| a | b |", "    indented", "---  ", "----",
];
const LEADS = ["", "", "", "", "\n", "\n\n", " ", "   \n", "\t", BOM, "\r\n", NBSP, "    \n  "];
const TERMINATORS = ["\n", "\n", "\n", "\n", "\n", "\n", "\n", "\n", "\r\n", "\r\n", "\r", LS, PS, "\f"];

/** One seeded document: maybe a leading run, maybe a block (terminated by `---`, `...` or nothing, maybe with a blank under its opener), then a body; the line terminator drawn per document and, now and then, per line. */
function seededDocument(random: () => number): string {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)];
  const lines: string[] = [];
  if (random() < 0.8) {
    lines.push("---");
    if (random() < 0.08) lines.push("");
    const interior = Math.floor(random() * 9);
    for (let i = 0; i < interior; i++) lines.push(pick(FRONT_POOL));
    const closer = random();
    if (closer < 0.5) lines.push("---");
    else if (closer < 0.65) lines.push("...");
  }
  const body = Math.floor(random() * 12);
  for (let i = 0; i < body; i++) lines.push(pick(BODY_POOL));
  const terminator = pick(TERMINATORS);
  const mixed = random() < 0.05;
  let text = pick(LEADS);
  lines.forEach((line, i) => {
    text += line + (i === lines.length - 1 ? (random() < 0.5 ? terminator : "") : mixed ? pick(TERMINATORS) : terminator);
  });
  return text;
}

describe.each(ROUTES)("Session 345 P3 -- the oracle: every answer equals the parent's (seeded documents, seed 345), scan: %s", (route) => {
  it("20,000 seeded documents, and the generator reaches every shape it is for", () => {
    const random = seededRandom(345);
    const texts: string[] = [];
    for (let i = 0; i < 20_000; i++) texts.push(seededDocument(random));
    let withSpan = 0;
    let unterminated = 0;
    let afterBlanks = 0;
    let leadingRun = 0;
    for (const text of texts) {
      const span = oldFrontMatterSpan(text);
      if (span !== null) {
        withSpan++;
        if (!span.terminated) unterminated++;
        if (span.startLine > 0) afterBlanks++;
      }
      if (text.trimStart() !== text) leadingRun++;
    }
    expect(texts.length).toBe(20_000);
    expect(withSpan).toBeGreaterThan(5_000);
    expect(unterminated).toBeGreaterThan(600);
    expect(afterBlanks).toBeGreaterThan(2_000);
    expect(leadingRun).toBeGreaterThan(10_000);
    for (const kind of ["\r\n", LS, PS, "\f"]) expect(texts.some((t) => t.includes(kind))).toBe(true);
    expect(texts.some((t) => /\r(?!\n)/.test(t))).toBe(true);
    const { drawn, first } = firstDisagreement(texts, ["doc.qmd", "doc.Rmd"], false, NEW_READS, route);
    expect(first).toBeNull();
    expect(drawn).toBe(20_000);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE TRACKED DOCUMENTS.

describe.each(ROUTES)("Session 345 P3 -- the oracle: every tracked .qmd / .md / .Rmd of the repository, scan: %s", (route) => {
  const root = new URL("../..", import.meta.url).pathname;
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, maxBuffer: 1 << 26 })
    .toString("utf8")
    .split("\0")
    .filter((p) => /\.(?:qmd|md|Rmd|rmd)$/.test(p));

  it("there are tracked documents to read (a listing that found none must fail)", () => {
    expect(tracked.length).toBeGreaterThanOrEqual(100);
    expect(tracked.some((p) => p.endsWith(".qmd"))).toBe(true);
    expect(tracked.some((p) => p.endsWith(".md"))).toBe(true);
  });

  it("each, as written and under a leading blank line, spaces, a tab, a BOM and with CRLF endings", () => {
    let drawn = 0;
    for (const path of tracked) {
      const text = readFileSync(root + path, "utf8");
      const variants = [text, "\n" + text, "   \n" + text, "\t" + text, BOM + text, text.replace(/\r?\n/g, "\r\n")];
      for (const variant of variants) {
        drawn++;
        const d = disagreement(variant, [path], false, NEW_READS, route);
        expect(d).toBeNull();
      }
    }
    expect(drawn).toBe(tracked.length * 6);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// LEARNING #14: the scan and the readers agree on where the front matter is.

describe("Session 345 P3 -- the scan skips the front matter the readers report (Learning 14)", () => {
  it("no heading, cell or body line of a seeded document lies inside the span the oracle reports, and the heading planted under a terminator is found", () => {
    const random = seededRandom(3451);
    let checked = 0;
    let planted = 0;
    for (let i = 0; i < 6_000; i++) {
      const base = seededDocument(random);
      const span = oldFrontMatterSpan(base);
      if (span === null) continue;
      const lines = base.split(/\r?\n/);
      const inside = (n: number): boolean => n >= span.startLine && n <= span.endLine;
      for (const h of findHeadings(base)) expect(inside(h.line), base).toBe(false);
      for (const c of findAllCells(base)) expect(inside(c.startLine) || inside(c.endLine), base).toBe(false);
      for (const b of findBodyLines(base)) expect(inside(b.line), base).toBe(false);
      checked++;
      if (span.terminated) {
        const after = lines.slice();
        after.splice(span.endLine + 1, 0, "", "# PLANTED", "");
        const doc = after.join("\n");
        expect(oldFrontMatterSpan(doc)).toEqual(span);
        expect(findHeadings(doc).some((h) => h.text === "PLANTED" && h.line === span.endLine + 2), doc).toBe(true);
        planted++;
      }
    }
    expect(checked).toBeGreaterThan(1_000);
    expect(planted).toBeGreaterThan(500);
  });
});
