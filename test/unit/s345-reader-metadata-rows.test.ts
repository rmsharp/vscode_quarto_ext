import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FENCE_ANYWHERE_IN_BLOCK,
  FRONTMATTER_COMMONMARK_FROM,
  YAML_DOCUMENT_END,
  type AttributeBlockReader,
  attributeBlockReader,
  contentFromValueLine,
  contentSelectsReader,
  findAllCells,
  findBodyLines,
  findCellOptionLines,
  findHeadings,
  frontMatterContent,
  frontMatterProvesReader,
  fromEscapesAllSymbols,
  htmlCommentOpenAt,
  readerMetadataOf,
} from "../../src/core/qmd/model";
import type { YamlRegion } from "../../src/core/qmd/quarto-yaml-regions";
import { quartoYamlRegions } from "../../src/core/qmd/quarto-yaml-regions";
import { countStrings, everyString, seededRandom } from "./support/regex-equivalence";

// Session 345 -- part P1 of the BACKLOG item SIB-01 (the first completion request after an edit pays a cold whole-document scan). The model's scan asked the governing metadata block of a document TWICE (once for the KEY
// half, `frontMatterSelectsReader`, once for the VALUE half, `frontMatterFromValueLine`), and `indexLabels` asked it a THIRD time through `attributeBlockReader(text)` on the text the scan had just read. Each ask is
// `governingMetadataContent(lines)`: a `lines.join("\n")`, then `midDocumentMetadataBlocks` runs `quartoYamlRegions` over it, which re-splits it and runs a region state machine (measured at the parent, a scratch prototype that
// memoised the evaluation by its lines array: about 6 ms of a 39 ms settled scan at 2,000 cells, 56,005 lines; about 24 ms of 175 ms at 8,000). A document whose `from:` names a CommonMark reader and passes the front-matter
// proof asked `quartoYamlRegions` a further time inside `frontMatterProvesReader`. The cure is no behaviour change: the metadata is read ONCE per scan and handed to every consumer (the key half, the value half, and the
// proof's regions), the scan keeps the value half beside its regions, and `attributeBlockReader(text)` takes it from the scan's entry when the scan is there.
//
// The text rows count `quartoYamlRegions` calls through a wrapper around the module (the one place a metadata evaluation spends its join and its region pass) and say what a call receives. The old two-call spelling and
// the old `attributeBlockReader` are kept below VERBATIM (renamed `old...`; `midDocumentMetadataBlocks` and `governingMetadataContent` are copied from the parent `acbc51f`, the rest of what they read is exported from the
// model for this file), and the new answers are compared with them over: every document of up to four lines from a sixteen-line alphabet (every line shape that matters: the delimiters, a `...` marker, the `from:` spellings, a fence
// opener, a comment opener and closer, blank and body lines), pairs of metadata blocks over thirty-four `from:` spellings, a seeded generator of whole documents (SEED below, the number actually drawn is floored, and so is each
// class of document the draw must contain), the six line terminators, a leading BOM, leading blank lines and whitespace, unterminated blocks, the empty text, and every tracked `.qmd` / `.md` / `.Rmd` of the repository.
//
// ⚠ WHAT THIS FILE CANNOT DO: it cannot compare the WHOLE scan (`findHeadings`, `findAllCells`, `findBodyLines`, `findCellOptionLines`) with the parent's, because the parent's scan is a 16,000-line module and is not here. The
// scan consumes the metadata through three flags (`dialectOverride`, `fromValueLine`, `commonmarkProven`); the first two are the values compared here, and the third is `frontMatterProvesReader`, compared here with the
// old regions source. The whole-scan comparison was run outside the repository, bundle against bundle (parent against cure), and its figures are in the Session 345 record.

const SEED = 345_001;

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE COUNTER: every call of `quartoYamlRegions` through the model's import is counted and handed to the real function. The oracle below calls it too, so a row reads the count around the call it measures and nowhere else.

const counter = vi.hoisted(() => ({ calls: 0, last: "" }));
vi.mock("../../src/core/qmd/quarto-yaml-regions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/core/qmd/quarto-yaml-regions")>();
  return {
    ...actual,
    quartoYamlRegions: (text: string) => {
      counter.calls++;
      counter.last = text;
      return actual.quartoYamlRegions(text);
    },
  };
});

/** Run `run` and say how many times `quartoYamlRegions` was called inside it. */
function regionsCalls<T>(run: () => T): { calls: number; value: T; last: string } {
  counter.calls = 0;
  counter.last = "";
  const value = run();
  return { calls: counter.calls, value, last: counter.last };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE OLD SPELLING, copied from the parent `acbc51f` (`src/core/qmd/model.ts`): `midDocumentMetadataBlocks` and `governingMetadataContent` as they were, the two single-lines-argument halves, and `attributeBlockReader`.

function oldMidDocumentMetadataBlocks(lines: readonly string[]): string[][] {
  const firstContent = lines.findIndex((line) => line.trim() !== "");
  if (firstContent < 0) {
    return [];
  }
  const blocks: string[][] = [];
  const commentOpenAt = htmlCommentOpenAt(lines);
  for (const region of quartoYamlRegions(lines.join("\n"))) {
    if (region.startLine <= firstContent || commentOpenAt(region.startLine)) {
      continue;
    }
    const body = lines.slice(region.startLine + 1, region.terminated ? region.endLine : lines.length);
    const end = body.findIndex((line) => YAML_DOCUMENT_END.test(line));
    const content = end >= 0 ? body.slice(0, end) : region.terminated ? body : null;
    if (content !== null && !content.some((line) => FENCE_ANYWHERE_IN_BLOCK.test(line))) {
      blocks.push(content);
    }
  }
  return blocks;
}

function oldGoverningMetadataContent(lines: readonly string[]): string[] | null {
  const blocks = oldMidDocumentMetadataBlocks(lines);
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (!contentSelectsReader(blocks[i])) {
      continue;
    }
    return contentFromValueLine(blocks[i]) === null ? [] : blocks[i];
  }
  return frontMatterContent(lines);
}

function oldFrontMatterSelectsReader(lines: readonly string[]): boolean {
  const content = oldGoverningMetadataContent(lines);
  return content !== null && contentSelectsReader(content);
}

function oldFrontMatterFromValueLine(lines: readonly string[]): string | null {
  const content = oldGoverningMetadataContent(lines);
  return content === null ? null : contentFromValueLine(content);
}

function oldAttributeBlockReader(text: string): AttributeBlockReader {
  const fromValueLine = oldFrontMatterFromValueLine(text.split(/\r?\n/));
  return {
    commonmarkDialect: fromValueLine !== null && FRONTMATTER_COMMONMARK_FROM.test(fromValueLine),
    pandocEscapes: fromEscapesAllSymbols(fromValueLine),
  };
}

/** The parent's regions source for the proof: a join and a pass, asked inline where the proof needs them. */
const oldRegionsOf = (lines: readonly string[]) => (): readonly YamlRegion[] => quartoYamlRegions(lines.join("\n"));

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE INPUTS.

const BOM = String.fromCharCode(0xfeff);
/** The six line terminators: `\n` and `\r\n` split a line; the other four stay inside one (the model splits on `\r?\n` and nothing else). */
const TERMINATORS: readonly string[] = ["\n", "\r\n", "\r", " ", " ", "\f"];
const withTerminator = (text: string, terminator: string): string => text.replace(/\n/g, terminator);

/** Sixteen line shapes, each ending in a line feed, so a concatenation of them is a document. */
const LINE_SHAPES: readonly string[] = [
  "---\n",
  "...\n",
  "from: gfm\n",
  "from: markdown_strict\n",
  "from:\n",
  "title: t\n",
  "```\n",
  "<!--\n",
  "-->\n",
  "\n",
  "# H\n",
  "format:\n",
  "  from: gfm\n",
  "  html:\n",
  "text\n",
  "from: 'commonmark_x'\n",
];
const EXHAUSTIVE_LENGTH = 4;

/** The `from:` spellings a metadata block may hold, as the lines they take. Thirty-four of them; the first column is what quarto reads, the rest is what a line regex has to reach. */
const FROM_SPELLINGS: readonly (readonly string[])[] = [
  ["from: gfm"],
  ["from: commonmark"],
  ["from: commonmark_x"],
  ["from: markdown_strict"],
  ["from: markdown"],
  ["from: markdown+smart"],
  ["from: markdown-blank_before_header"],
  ["from: gfm+hard_line_breaks"],
  ["from:"],
  ["from: "],
  ['from: "gfm"'],
  ["from: 'commonmark_x'"],
  ['from: "gfm'],
  ["from: gfm # a comment"],
  ['"from": gfm'],
  ["'from': markdown_strict"],
  ["from : gfm"],
  ["from: |", "  gfm"],
  ["from: >-", "  commonmark"],
  ["from:", "  gfm"],
  ["{from: gfm}"],
  ["{from: gfm, title: t}"],
  ["format:", "  html:", "    from: gfm"],
  ["format:", "  html:", "    toc: true"],
  ["format: html", "from: gfm"],
  ["format:", "  pdf:", "    from: gfm"],
  ["params:", "  from: markdown"],
  ["website:", "  from: gfm"],
  ["execute:", "  from: gfm"],
  ["abstract: |", "  from: gfm"],
  ["x: &a gfm", "from: *a"],
  ["from: gfm", "from: markdown"],
  ["title: t"],
  ["  from: gfm"],
];

/** A document from a front-matter frame and two metadata blocks (each a spelling and its closer), the second one below a paragraph so its opener is no thematic break. */
function framed(first: readonly string[], second: readonly string[], frame: number): string {
  const head = ["---", ...first, "---", ""];
  const mid = ["text", "---", ...second, "---", "more", "", "# H"];
  if (frame === 0) return [...head, ...mid, ""].join("\n");
  if (frame === 1) return [...mid, ""].join("\n");
  return [...head, "```{python}", "x = 1", "```", "", ...mid, "", "```", "---", "...", "```", ""].join("\n");
}

const FRONT_KEYS: readonly (readonly string[])[] = [
  ["title: A title"],
  ["author: A. N. Other"],
  ["format:", "  html:", "    toc: true"],
  ["engine: jupyter"],
  ["jupyter: python3"],
  ["execute:", "  echo: false"],
  ["bibliography: refs.bib"],
];
const BODY_CHUNKS: readonly (readonly string[])[] = [
  ["Some prose, a sentence.", ""],
  ["# A heading", ""],
  ["## Another heading {#sec-a}", ""],
  ["Setext", "======", ""],
  ["```{python}", "#| label: fig-a", "x = 1", "```", ""],
  ["```python", "y = 2", "```", ""],
  ["```", "plain", ""],
  ["<!-- a comment", "that runs over lines -->", ""],
  ["<!-- opened and never closed", ""],
  ["::: {.callout-note}", "A note.", ":::", ""],
  ["| a | b |", "|---|---|", "| 1 | 2 |", ""],
  ["- one", "- two", ""],
  ["", "   ", "\t"],
];

interface Drawn {
  text: string;
  /** Whether the draw put a metadata block below the first content line, whose `from:` was one of the spellings. */
  midFrom: boolean;
  midFence: boolean;
  midDots: boolean;
  inComment: boolean;
  frontFrom: boolean;
  unterminated: boolean;
  terminator: string;
  bom: boolean;
  leadingBlank: boolean;
}

/** One whole document from the seeded generator. */
function drawDocument(rand: () => number): Drawn {
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
  const lines: string[] = [];
  const drawn: Drawn = { text: "", midFrom: false, midFence: false, midDots: false, inComment: false, frontFrom: false, unterminated: false, terminator: "\n", bom: false, leadingBlank: false };
  if (rand() < 0.25) {
    drawn.leadingBlank = true;
    for (let i = Math.floor(rand() * 3) + 1; i > 0; i--) lines.push(pick(["", " ", "\t", "  "]));
  }
  if (rand() < 0.6) {
    lines.push("---");
    for (let i = Math.floor(rand() * 4); i > 0; i--) lines.push(...pick(FRONT_KEYS));
    if (rand() < 0.5) {
      drawn.frontFrom = true;
      lines.push(...pick(FROM_SPELLINGS));
    }
    const closer = rand();
    if (closer < 0.85) lines.push("---");
    else if (closer < 0.9) lines.push("...");
    else drawn.unterminated = true;
    lines.push("");
  }
  for (let chunks = Math.floor(rand() * 9) + 1; chunks > 0; chunks--) {
    if (rand() < 0.3) {
      // A metadata block below a content line (a paragraph, so the opener is no thematic break), maybe inside an open comment, maybe with a fence opener or a `...` marker.
      if (rand() < 0.2) {
        drawn.inComment = true;
        lines.push("<!--");
      }
      lines.push("A paragraph above the block.");
      lines.push("---");
      const blockLines: string[] = [];
      if (rand() < 0.65) {
        drawn.midFrom = true;
        blockLines.push(...pick(FROM_SPELLINGS));
      }
      for (let i = Math.floor(rand() * 3); i > 0; i--) blockLines.push(...pick(FRONT_KEYS));
      if (rand() < 0.1) {
        drawn.midFence = true;
        blockLines.splice(Math.floor(rand() * (blockLines.length + 1)), 0, pick(["```", "  ```", "~~~", "```{python}"]));
      }
      if (rand() < 0.1) {
        drawn.midDots = true;
        blockLines.splice(Math.floor(rand() * (blockLines.length + 1)), 0, "...");
      }
      lines.push(...blockLines);
      const closer = rand();
      if (closer < 0.85) lines.push("---");
      else if (closer < 0.9) lines.push("...");
      else drawn.unterminated = true;
      lines.push("more text", "");
      if (drawn.inComment && rand() < 0.5) lines.push("-->", "");
    } else {
      lines.push(...pick(BODY_CHUNKS));
    }
  }
  let text = lines.join("\n");
  drawn.terminator = rand() < 0.6 ? "\n" : pick(TERMINATORS);
  text = withTerminator(text, drawn.terminator);
  if (rand() < 0.1) {
    drawn.bom = true;
    text = BOM + text;
  }
  drawn.text = text;
  return drawn;
}

/** Texts that are unique, so that a row's scan is a miss: the cache keeps the last four. */
let uniqueCount = 0;
const unique = (text: string): string => `${text}\n<!-- row ${++uniqueCount} -->\n`;
/** Push everything out of the scan cache: five distinct small texts, more than it holds. */
function flush(): void {
  for (let i = 0; i < 5; i++) findHeadings(`# flush ${++uniqueCount}\n`);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE COMPARISONS.

/** `null` when the new `readerMetadataOf` answers what the old two calls answered for the text; else the evidence. */
function metadataDisagreement(text: string): string | null {
  const lines = text.split(/\r?\n/);
  const old = { selectsReader: oldFrontMatterSelectsReader(lines), fromValueLine: oldFrontMatterFromValueLine(lines) };
  const now = readerMetadataOf(lines);
  return old.selectsReader === now.selectsReader && old.fromValueLine === now.fromValueLine ? null : JSON.stringify({ text, old, now });
}

/** `null` when `frontMatterProvesReader` with a regions source SHARED with the metadata read answers what it answered with the parent's inline regions. `tally.reached` counts the documents whose proof asked for the regions at all. */
function proofDisagreement(text: string, tally: { reached: number; proven: number }): string | null {
  const lines = text.split(/\r?\n/);
  const fromValueLine = oldFrontMatterFromValueLine(lines);
  const old = frontMatterProvesReader(lines, fromValueLine, oldRegionsOf(lines));
  let memo: readonly YamlRegion[] | undefined;
  let asks = 0;
  const shared = (): readonly YamlRegion[] => {
    asks++;
    return (memo ??= quartoYamlRegions(lines.join("\n")));
  };
  readerMetadataOf(lines, shared);
  const asksBeforeProof = asks;
  const now = frontMatterProvesReader(lines, fromValueLine, shared);
  if (asks > asksBeforeProof) tally.reached++;
  if (now) tally.proven++;
  return old === now ? null : JSON.stringify({ text, old, now });
}

/** `null` when the reader flags are the old ones: asked before the text is scanned (nothing to take), after a scan under the engine-blind key, and after a scan under another key. */
function readerDisagreement(text: string): string | null {
  const old = oldAttributeBlockReader(text);
  const cold = attributeBlockReader(text);
  findHeadings(text);
  const warm = attributeBlockReader(text);
  findHeadings(text, "knitr", "no-execute");
  const other = attributeBlockReader(text);
  return JSON.stringify(old) === JSON.stringify(cold) && JSON.stringify(old) === JSON.stringify(warm) && JSON.stringify(old) === JSON.stringify(other) ? null : JSON.stringify({ text, old, cold, warm, other });
}

const firstOf = (found: readonly string[]): string[] => found.slice(0, 3);

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE COUNTS. A document the cure must read once: front matter alone, none at all, a mid-document block that selects, a CommonMark `from:` the proof reaches the regions for, CRLF, a BOM, a block in a comment.

const GFM_FRONT = "---\ntitle: t\nfrom: gfm\n---\n\n# Head\n\ntext\n";
const DOCUMENTS: Record<string, string> = {
  "front matter, no from:": "---\ntitle: t\n---\n\n# Head\n\ntext\n",
  "no front matter": "# Head\n\ntext\n",
  "front matter with a CommonMark from: the proof reaches": GFM_FRONT,
  "the same, CRLF": GFM_FRONT.replace(/\n/g, "\r\n"),
  "the same, a BOM": BOM + GFM_FRONT,
  "a mid-document block that selects": "---\ntitle: t\n---\n\ntext\n---\nfrom: gfm\n---\nmore\n\n# H\n",
  "a mid-document block inside an open comment": "<!--\ntext\n---\nfrom: gfm\n---\nmore\n\n# H\n",
  "an unterminated block": "---\ntitle: t\n---\n\ntext\n---\nfrom: gfm\n\n# H\n",
  "leading blank lines, then front matter": "\n  \n---\nfrom: markdown_strict\n---\n# Head\n\ntext\n",
  "one line": "# Head",
};

describe("Session 345 P1 -- the counts: the governing metadata block is read ONCE per scan", () => {
  beforeEach(() => {
    flush();
  });

  for (const [name, source] of Object.entries(DOCUMENTS)) {
    it(`a scan of ${name} makes ONE regions pass`, () => {
      const text = unique(source);
      const { calls, last } = regionsCalls(() => findHeadings(text));
      expect(calls).toBe(1);
      expect(last).toBe(text.split(/\r?\n/).join("\n"));
    });

    it(`a scan of ${name}, then attributeBlockReader on the same text, makes ONE regions pass`, () => {
      const text = unique(source);
      const { calls } = regionsCalls(() => {
        findHeadings(text);
        return attributeBlockReader(text);
      });
      expect(calls).toBe(1);
    });
  }

  it("a blank document makes no regions pass, as before, and its reader flags are the defaults", () => {
    for (const text of ["", "\n\n  \n", "\t\n", " "]) {
      const { calls } = regionsCalls(() => {
        findHeadings(text);
        return attributeBlockReader(text);
      });
      expect(calls).toBe(0);
      expect(attributeBlockReader(text)).toEqual(oldAttributeBlockReader(text));
    }
  });

  it("the text asked of attributeBlockReader is taken from a scan under ANY key: the value depends on the text alone", () => {
    const keys: Array<Parameters<typeof findHeadings>[1]> = [undefined, "knitr", "jupyter", "markdown", "ambiguous"];
    for (const engine of keys) {
      for (const mode of ["execute", "no-execute"] as const) {
        const text = unique(GFM_FRONT);
        const { calls, value } = regionsCalls(() => {
          findHeadings(text, engine, mode);
          return attributeBlockReader(text);
        });
        expect(calls, `${engine} / ${mode}`).toBe(1);
        expect(value).toEqual(oldAttributeBlockReader(text));
      }
    }
  });

  it("a text that was never scanned costs ONE regions pass and is NOT scanned by the ask (a later scan is a miss)", () => {
    const text = unique(GFM_FRONT);
    const asked = regionsCalls(() => attributeBlockReader(text));
    expect(asked.calls).toBe(1);
    expect(asked.value).toEqual(oldAttributeBlockReader(text));
    const scanned = regionsCalls(() => findHeadings(text));
    expect(scanned.calls).toBe(1);
  });

  it("an entry holds the text it was scanned for: a different text is not served another's value", () => {
    const gfm = unique(GFM_FRONT);
    const strict = gfm.replace("from: gfm", "from: markdown_strict");
    expect(strict).not.toBe(gfm);
    findHeadings(gfm);
    findHeadings(strict);
    // Both are cached now; each one is answered from its own entry.
    const { calls } = regionsCalls(() => [attributeBlockReader(gfm), attributeBlockReader(strict)]);
    expect(calls).toBe(0);
    expect(attributeBlockReader(gfm)).toEqual(oldAttributeBlockReader(gfm));
    expect(attributeBlockReader(strict)).toEqual(oldAttributeBlockReader(strict));
    expect(attributeBlockReader(gfm)).not.toEqual(attributeBlockReader(strict));
    // A text that differs from a cached one by its LAST character only.
    const edited = gfm + "x";
    const askedEdited = regionsCalls(() => attributeBlockReader(edited));
    expect(askedEdited.calls).toBe(1);
  });

  it("an entry that left the cache is not served: the value is read again, and is the same", () => {
    const text = unique(GFM_FRONT);
    findHeadings(text);
    flush();
    const { calls, value } = regionsCalls(() => attributeBlockReader(text));
    expect(calls).toBe(1);
    expect(value).toEqual(oldAttributeBlockReader(text));
  });

  it("reading an entry's value does not promote it: the cache's replacement order is the scan's alone", () => {
    const a = unique("# A\n");
    const [b, c, d, e] = ["# B\n", "# C\n", "# D\n", "# E\n"].map(unique);
    for (const text of [a, b, c, d]) findHeadings(text);
    // Order, newest first: d c b a. A hit on `a` by a scan would put it first; the ask of its flags must not.
    attributeBlockReader(a);
    findHeadings(e);
    // `e` came in: the oldest, `a`, left.
    expect(regionsCalls(() => findHeadings(a)).calls).toBe(1);
  });

  it("readerMetadataOf makes ONE regions pass on a non-blank document, and the pass is over the joined lines", () => {
    for (const source of Object.values(DOCUMENTS)) {
      const lines = source.split(/\r?\n/);
      const { calls, last } = regionsCalls(() => readerMetadataOf(lines));
      expect(calls).toBe(1);
      expect(last).toBe(lines.join("\n"));
    }
  });

  it("readerMetadataOf asks the regions source once, and only for a document that has a content line", () => {
    for (const source of [...Object.values(DOCUMENTS), "", "\n \n"]) {
      const lines = source.split(/\r?\n/);
      let asks = 0;
      readerMetadataOf(lines, () => {
        asks++;
        return quartoYamlRegions(lines.join("\n"));
      });
      expect(asks).toBe(lines.some((line) => line.trim() !== "") ? 1 : 0);
    }
  });

  it("the regions it is handed are the regions it reads: an empty source finds no mid-document block", () => {
    const lines = DOCUMENTS["a mid-document block that selects"].split(/\r?\n/);
    expect(readerMetadataOf(lines)).toEqual({ selectsReader: true, fromValueLine: "from: gfm" });
    expect(readerMetadataOf(lines, () => [])).toEqual({ selectsReader: false, fromValueLine: null });
  });

  it("the regions it is handed are not changed by it: a frozen list is read, never sorted, reversed or emptied", () => {
    for (const source of Object.values(DOCUMENTS)) {
      const lines = source.split(/\r?\n/);
      const frozen = Object.freeze(quartoYamlRegions(lines.join("\n")).map((region) => Object.freeze({ ...region })));
      expect(() => readerMetadataOf(lines, () => frozen)).not.toThrow();
      expect(() => frontMatterProvesReader(lines, "from: gfm", () => frozen)).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE ANSWERS: documents written out, each with the reader flags quarto's reader choice gives them. They pass on the parent's logic and state what the cure must keep.

describe("Session 345 P1 -- the answers of attributeBlockReader and readerMetadataOf", () => {
  const cases: Array<[string, string, { selectsReader: boolean; fromValueLine: string | null }, AttributeBlockReader]> = [
    ["no front matter", "# Head\n", { selectsReader: false, fromValueLine: null }, { commonmarkDialect: false, pandocEscapes: true }],
    ["from: gfm in the front matter", "---\nfrom: gfm\n---\n# Head\n", { selectsReader: true, fromValueLine: "from: gfm" }, { commonmarkDialect: true, pandocEscapes: false }],
    ["from: markdown_strict", "---\nfrom: markdown_strict\n---\n# Head\n", { selectsReader: true, fromValueLine: "from: markdown_strict" }, { commonmarkDialect: false, pandocEscapes: false }],
    ["an empty from:", "---\nfrom:\n---\n# Head\n", { selectsReader: true, fromValueLine: null }, { commonmarkDialect: false, pandocEscapes: true }],
    ["a later block that selects governs", "---\nfrom: markdown\n---\n\ntext\n---\nfrom: gfm\n---\nmore\n", { selectsReader: true, fromValueLine: "from: gfm" }, { commonmarkDialect: true, pandocEscapes: false }],
    ["a later block that does not select leaves the front matter's", "---\nfrom: gfm\n---\n\ntext\n---\ntitle: t\n---\nmore\n", { selectsReader: true, fromValueLine: "from: gfm" }, { commonmarkDialect: true, pandocEscapes: false }],
    ["a block inside an open comment resolves nothing", "<!--\ntext\n---\nfrom: gfm\n---\nmore\n", { selectsReader: false, fromValueLine: null }, { commonmarkDialect: false, pandocEscapes: true }],
    ["a block with a fence opener resolves nothing", "text\n---\nfrom: gfm\n```\n---\nmore\n", { selectsReader: false, fromValueLine: null }, { commonmarkDialect: false, pandocEscapes: true }],
  ];
  for (const [name, text, metadata, reader] of cases) {
    it(`${name}: the metadata, the reader after a scan and the reader of a text never scanned`, () => {
      expect(readerMetadataOf(text.split(/\r?\n/))).toEqual(metadata);
      const asked = attributeBlockReader(text);
      findHeadings(text);
      expect(attributeBlockReader(text)).toEqual(asked);
      expect(asked).toEqual(reader);
      expect(oldAttributeBlockReader(text)).toEqual(reader);
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE DIFFERENTIAL.

describe("Session 345 P1 -- the differential: the single read answers what the old reads answered", () => {
  it(`every document of up to ${EXHAUSTIVE_LENGTH} lines of ${LINE_SHAPES.length} shapes: the metadata (${countStrings(LINE_SHAPES.length, EXHAUSTIVE_LENGTH)} documents)`, () => {
    let compared = 0;
    let selects = 0;
    let valued = 0;
    const found: string[] = [];
    for (const text of everyString(LINE_SHAPES, EXHAUSTIVE_LENGTH)) {
      compared++;
      const lines = text.split(/\r?\n/);
      const now = readerMetadataOf(lines);
      if (now.selectsReader) selects++;
      if (now.fromValueLine !== null) valued++;
      const disagreement = metadataDisagreement(text);
      if (disagreement !== null) found.push(disagreement);
    }
    expect(compared).toBe(countStrings(LINE_SHAPES.length, EXHAUSTIVE_LENGTH));
    expect(compared).toBeGreaterThanOrEqual(69_905);
    expect(selects).toBeGreaterThan(2_000);
    expect(valued).toBeGreaterThan(1_500);
    expect(firstOf(found)).toEqual([]);
  });

  it("every document of up to 3 lines of the sixteen shapes: the reader flags before a scan, after one and after one under another key", () => {
    let compared = 0;
    const found: string[] = [];
    for (const text of everyString(LINE_SHAPES, 3)) {
      compared++;
      const disagreement = readerDisagreement(text);
      if (disagreement !== null) found.push(disagreement);
    }
    expect(compared).toBe(countStrings(LINE_SHAPES.length, 3));
    expect(firstOf(found)).toEqual([]);
  });

  it(`every pair of the ${FROM_SPELLINGS.length} spellings in a front matter and a later block, in three frames: the metadata, the proof and the flags`, () => {
    let compared = 0;
    const found: string[] = [];
    const tally = { reached: 0, proven: 0 };
    for (const first of FROM_SPELLINGS) {
      for (const second of FROM_SPELLINGS) {
        for (let frame = 0; frame < 3; frame++) {
          const text = framed(first, second, frame);
          compared++;
          for (const disagreement of [metadataDisagreement(text), proofDisagreement(text, tally), readerDisagreement(text)]) {
            if (disagreement !== null) found.push(disagreement);
          }
        }
      }
    }
    expect(compared).toBe(FROM_SPELLINGS.length * FROM_SPELLINGS.length * 3);
    expect(tally.reached).toBeGreaterThan(1_500);
    expect(tally.proven).toBeGreaterThan(40);
    expect(firstOf(found)).toEqual([]);
  });

  const SEEDED_DOCUMENTS = 6_000;
  it(`seed ${SEED}: ${SEEDED_DOCUMENTS} whole documents, with every class of document drawn: the metadata, the proof and the flags`, () => {
    const rand = seededRandom(SEED);
    const found: string[] = [];
    const tally = { reached: 0, proven: 0 };
    const classes = { midFrom: 0, midFence: 0, midDots: 0, inComment: 0, frontFrom: 0, unterminated: 0, bom: 0, leadingBlank: 0, selects: 0 };
    const terminators = new Map<string, number>();
    let drawnCount = 0;
    for (let i = 0; i < SEEDED_DOCUMENTS; i++) {
      const drawn = drawDocument(rand);
      drawnCount++;
      for (const key of ["midFrom", "midFence", "midDots", "inComment", "frontFrom", "unterminated", "bom", "leadingBlank"] as const) {
        if (drawn[key]) classes[key]++;
      }
      terminators.set(drawn.terminator, (terminators.get(drawn.terminator) ?? 0) + 1);
      if (readerMetadataOf(drawn.text.split(/\r?\n/)).selectsReader) classes.selects++;
      for (const disagreement of [metadataDisagreement(drawn.text), proofDisagreement(drawn.text, tally), readerDisagreement(drawn.text)]) {
        if (disagreement !== null) found.push(disagreement);
      }
    }
    expect(drawnCount).toBe(SEEDED_DOCUMENTS);
    for (const [name, count] of Object.entries(classes)) {
      expect(count, `class ${name}`).toBeGreaterThan(SEEDED_DOCUMENTS / 100);
    }
    for (const terminator of TERMINATORS) {
      expect(terminators.get(terminator) ?? 0, `terminator ${JSON.stringify(terminator)}`).toBeGreaterThan(SEEDED_DOCUMENTS / 50);
    }
    expect(tally.reached).toBeGreaterThan(600);
    expect(tally.proven).toBeGreaterThan(80);
    expect(firstOf(found)).toEqual([]);
  });

  it("every tracked .qmd, .md and .Rmd of the repository, as written and under each terminator, with a BOM and with leading blank lines", () => {
    const listed = execFileSync("git", ["ls-files", "*.qmd", "*.md", "*.Rmd"], { encoding: "utf8", maxBuffer: 1 << 24 }).split("\n").filter((name) => name !== "");
    expect(listed.length).toBeGreaterThanOrEqual(100);
    const found: string[] = [];
    let compared = 0;
    for (const name of listed) {
      const source = readFileSync(name, "utf8");
      const variants = [source];
      if (source.length <= 200_000) {
        for (const terminator of TERMINATORS.slice(1)) variants.push(withTerminator(source, terminator));
        variants.push(BOM + source, "\n  \n" + source, "\t\n" + source.replace(/\n$/, ""));
      }
      for (const text of variants) {
        compared++;
        const disagreement = metadataDisagreement(text);
        if (disagreement !== null) found.push(`${name}: ${disagreement.slice(0, 200)}`);
      }
      const asked = attributeBlockReader(source);
      findHeadings(source);
      if (JSON.stringify(asked) !== JSON.stringify(attributeBlockReader(source)) || JSON.stringify(asked) !== JSON.stringify(oldAttributeBlockReader(source))) found.push(`${name}: reader flags`);
    }
    expect(compared).toBeGreaterThanOrEqual(listed.length * 8 - 100);
    expect(firstOf(found)).toEqual([]);
  });

  it("the empty text, one character, and a document that is only a delimiter", () => {
    const found: string[] = [];
    const tally = { reached: 0, proven: 0 };
    for (const text of ["", "\n", "-", "---", "---\n", "...", BOM, BOM + "---\nfrom: gfm\n---\n", "\r\n", "\r", " ", "--- from: gfm --- "]) {
      for (const disagreement of [metadataDisagreement(text), proofDisagreement(text, tally), readerDisagreement(text)]) {
        if (disagreement !== null) found.push(disagreement);
      }
    }
    expect(found).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE SCAN'S OWN VIEWS: the four public views of one text agree with each other whichever order they are asked in and whether or not the reader flags were asked in between (the scan's entry is shared, never rebuilt).

describe("Session 345 P1 -- the scan's views do not move when the reader flags are asked between them", () => {
  it("findHeadings, findAllCells, findBodyLines and findCellOptionLines return the same objects after attributeBlockReader as before it", () => {
    const text = unique(GFM_FRONT + "\n```{python}\n#| label: a\nx = 1\n```\n");
    const headings = findHeadings(text);
    const cells = findAllCells(text);
    const bodyLines = findBodyLines(text);
    const options = findCellOptionLines(text);
    attributeBlockReader(text);
    expect(findHeadings(text)).toEqual(headings);
    expect(findAllCells(text)[0]).toBe(cells[0]);
    expect(findBodyLines(text)[0]).toBe(bodyLines[0]);
    expect(findCellOptionLines(text)).toEqual(options);
    expect(headings.length).toBeGreaterThan(0);
    expect(cells.length).toBe(1);
    expect(options.length).toBe(1);
  });
});
