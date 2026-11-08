import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";
import { findAllCells, findBodyLines, findFrontMatter, findHeadings, frontMatterContentLines, inFrontMatter } from "../../src/core/qmd/model";
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
// THE ORACLE.

const FILE_NAMES = ["doc.qmd", "doc.Rmd", "doc.rmd"];

/** `null` when every answer of the new code equals the parent's for `text`, else the first answer that differs. `inFrontMatter` is asked of every line number there is a reason to ask and of the numbers that are not lines. */
function disagreement(text: string, fileNames: readonly string[] = FILE_NAMES, wide = true): string | null {
  const same = (what: string, a: unknown, b: unknown): string | null => {
    const x = JSON.stringify(a) ?? "undefined";
    const y = JSON.stringify(b) ?? "undefined";
    return x === y ? null : `${what}\n  new: ${x}\n  old: ${y}\n  text: ${JSON.stringify(text.length > 300 ? text.slice(0, 300) + "..." : text)}`;
  };
  const checks: Array<string | null> = [
    same("findFrontMatter", findFrontMatter(text), oldFindFrontMatter(text)),
    same("frontMatterContentLines", frontMatterContentLines(text), oldFrontMatterContentLines(text)),
    same("findFrontMatterTopLevelLines", findFrontMatterTopLevelLines(text), oldFindFrontMatterTopLevelLines(text)),
    same("findNestedFrontMatterValueLines", findNestedFrontMatterValueLines(text), oldFindNestedFrontMatterValueLines(text)),
  ];
  const lineCount = text.split(/\r?\n/).length;
  const asked = wide ? [-Infinity, -1, -0, 0, 0.5, 1, 1.5, NaN, lineCount - 1, lineCount, lineCount + 1, Infinity, 2 ** 31] : [-1, 0, lineCount - 1, lineCount];
  for (let line = 1; line < Math.min(lineCount + 1, wide ? 12 : 8); line++) asked.push(line);
  for (const line of asked) checks.push(same(`inFrontMatter(${line})`, inFrontMatter(text, line), oldInFrontMatter(text, line)));
  for (const fileName of fileNames) checks.push(same(`resolveDocumentEngine(${fileName})`, resolveDocumentEngine(fileName, text), oldResolveDocumentEngine(fileName, text)));
  return checks.find((c) => c !== null) ?? null;
}

/** The first disagreement over `texts`, and how many were drawn (a generator that draws nothing must fail on its floor, not pass on its emptiness). */
function firstDisagreement(texts: Iterable<string>, fileNames?: readonly string[], wide = true): { drawn: number; first: string | null } {
  let drawn = 0;
  for (const text of texts) {
    drawn++;
    const d = disagreement(text, fileNames, wide);
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

describe("Session 345 P3 -- the oracle: every answer equals the parent's (exhaustive documents)", () => {
  it("every document of 0..4 lines over ten line shapes joined by LF (11,111 documents)", () => {
    const { drawn, first } = firstDisagreement(everyDocument(SHAPES, 4), ["doc.qmd", "doc.Rmd"]);
    expect(first).toBeNull();
    expect(drawn).toBe(1 + 10 + 100 + 1000 + 10_000);
  });

  it("every document of 0..6 lines over six core shapes joined by LF (55,987 documents)", () => {
    const { drawn, first } = firstDisagreement(everyDocument(CORE, 6), ["doc.qmd"], false);
    expect(first).toBeNull();
    expect(drawn).toBe(1 + 6 + 36 + 216 + 1296 + 7776 + 46_656);
  });

  it("every document of 0..4 lines over the ten shapes joined by CRLF", () => {
    const { drawn, first } = firstDisagreement(everyDocument(SHAPES, 4, "\r\n"), ["doc.qmd"], false);
    expect(first).toBeNull();
    expect(drawn).toBe(1 + 10 + 100 + 1000 + 10_000);
  });

  it("the terminators that are breaks (LF, CRLF) and the ones that are not (CR, U+2028, U+2029, form feed), between every pair of up to four pieces", () => {
    const { drawn, first } = firstDisagreement(everySeparated(["---", "a: b", "...", ""], ["\n", "\r\n", "\r", LS, PS, "\f"], 4), ["doc.qmd"], false);
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
    const { drawn, first } = firstDisagreement(texts);
    expect(first).toBeNull();
    expect(drawn).toBe(runs.length * blocks.length * 2);
  });

  it("the named edge cases: the empty text, a text that is only a fence, a final line with no newline, a lone CR, and an unterminated block", () => {
    const cases = ["", "\n", "---", "---\n", "\n---", "\n---\n", "---\r", "---\r\n", "---\na", "---\na\r", "---\r\na\r\n---\r", "---\r\n---\r\n", "a\r---\n", "---\nk: v\n---", "---\nk: v\n---\n", "---\nk: v\n...", " ---\nk: v\n---"];
    const { drawn, first } = firstDisagreement(cases);
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

describe("Session 345 P3 -- the oracle: every answer equals the parent's (seeded documents, seed 345)", () => {
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
    const { drawn, first } = firstDisagreement(texts, ["doc.qmd", "doc.Rmd"], false);
    expect(first).toBeNull();
    expect(drawn).toBe(20_000);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE TRACKED DOCUMENTS.

describe("Session 345 P3 -- the oracle: every tracked .qmd / .md / .Rmd of the repository", () => {
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
        const d = disagreement(variant, [path], false);
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
