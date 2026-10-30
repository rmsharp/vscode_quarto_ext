// Shared by the Session 338 rows of the BACKLOG item "Eleven more places that throw `RangeError` on a long line or a long list" (group g02), part A: the two class patterns that read ONE
// heading, image, span or div attribute id, `ATTR_ID_ALL` (`/#([\p{L}\p{N}_:.-]+)/gu`, site 1) and `ATTR_ATOM_COMMONMARK` (`/^(?:#[\p{L}\p{N}_:.-]+|\.[\p{L}\p{N}_:-]+)$/u`, site 2, read under
// `from: commonmark_x`). Each `s338-attr-id-rows-*.test.ts` file picks the rows, the reader and the forms it runs and stays under 25 s alone.
//
// ⚠ THE FIGURES (Session 338, bisected at HEAD `fe6aaec` with the lower bound verified OK first, one fresh Node 22.23 process per probe, through the entry the providers call with the arguments they pass):
// a class-plus under the `u` flag keeps one backtrack entry per character and the entry doubles once the TOKEN holds a character above U+00FF (the heading text around it does not count: the token is the
// string the pattern reads). `# T {#` + 4,194,287 letters + `}` reads and 4,194,288 throws `RangeError: Maximum call stack size exceeded` from `findHeadings`, `buildOutline`, `indexLabels`, `findLabel`,
// `findAllCells` and `resolveDocumentEngine`, with no engine, `knitr` and `jupyter`, for the default reader (site 1) and under `from: commonmark_x` (site 2 first, then site 1); a div, an image and a span
// host throw the same in `indexLabels` and `findLabel`, 4,194,283 letters read and 4,194,284 throw after the four characters of `fig-` are counted. An astral letter counts as ONE character: 4,194,287
// read and 4,194,288 throw. A token whose characters are all up to U+00FF reads 60,000,000 letters (no throw to be found), so the all-up-to-U+00FF form of a row is a CONTROL that passes on the parent.
// The rows are sized at twice the first throw (Learning 775) and every row asserts the ANSWER the short document gives, not only that nothing throws.
//
// ⚠ WHICH BUILD EACH ROW IS RED ON (Learning 882; the cured `model.ts` with one site put back to its old pattern, the eleven `s338-attr-id-rows-*.test.ts` files run on each): the parent `fe6aaec` fails 50 of the 143
// tests, all by RangeError. With site 2 (`ATTR_ATOM_COMMONMARK`) cured and site 1 (`ATTR_ID_ALL`) old the same 50 fail. With site 1 cured and site 2 old 24 fail, the rows of the `commonmark` files, and the
// 26 default-reader rows pass. So the default-reader rows reach site 1 ALONE, and under `from: commonmark_x` site 2 is tested before site 1 is read and HIDES it: curing site 2 alone leaves every row red.

import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../../src/core/document-engine-resolve";
import { buildOutline, findAllCells, findHeadings, type OutlineSymbol } from "../../../src/core/qmd/model";
import { findLabel, indexLabels } from "../../../src/core/refs";

/** The first throw, in letters (characters of the token after the `#`), of the class-plus on a token with a character above U+00FF: 4,194,287 read, 4,194,288 throw (Node 22.23, HEAD `fe6aaec`). */
export const FIRST_THROW = 4_194_288;
/** Twice the first throw, and a little over it: the letters of every row that goes past the figure. */
export const S338_MANY = 8_400_000;
/** The letters of the control rows that run in every file beside the long ones: one-byte, cannot throw (60,000,000 read), and cheap. */
export const S338_BYTE_MANY = 1_000_000;
/** The few letters of the short run, asserted first so that the answer is the old pattern's and not the new function's choice. */
export const S338_FEW = 4;
/** The ceiling of one cured read: it takes 2.5 to 5 s at 8.4 million letters (the heading tokenizer builds a token a character at a time), so 10 s is two to four times the cost; never loosened to pass. */
export const S338_LIMIT_MS = 10_000;

export type Form = { name: string; letters: (count: number) => string; many: number };
/** Every character up to U+00FF: `a`s and a last `é` (U+00E9, a letter above ASCII that is still one byte). Cannot throw at any size measured. */
export const oneByte = (many: number): Form => ({ name: "every character up to U+00FF", letters: (n) => `${"a".repeat(n - 1)}é`, many });
/** One character above U+00FF in the token: `a`s and a last `中` (U+4E2D). The whole token is then stored with two bytes a character. */
export const ONE_WIDE: Form = { name: "one U+4E2D in the token", letters: (n) => `${"a".repeat(n - 1)}中`, many: S338_MANY };
/** Every letter above U+00FF: `中` repeated. */
export const ALL_WIDE: Form = { name: "every letter U+4E2D", letters: (n) => "中".repeat(n), many: S338_MANY };
/** Every letter astral: U+1D400 (two UTF-16 code units, ONE character to the `u` flag) repeated. */
export const ASTRAL: Form = { name: "every letter U+1D400 (astral)", letters: (n) => String.fromCodePoint(0x1d400).repeat(n), many: S338_MANY };

export type Reader = { name: string; prefix: string; shift: number };
export const DEFAULT_READER: Reader = { name: "the default reader", prefix: "", shift: 0 };
/** `from: commonmark_x` in the front matter: four lines, so every line of the answer moves by four. */
export const COMMONMARK_READER: Reader = { name: "from: commonmark_x", prefix: "---\nfrom: commonmark_x\n---\n\n", shift: 4 };

type KnownEngine = "knitr" | "jupyter";
export type Row = { key: string; site: string; tag: string; build: (letters: string) => string; read: (text: string, letters: string) => unknown; answer: (shift: number) => unknown };

const MARK = "<the whole id>";
/** The id a read returned, or a SHORT stand-in for it: a mismatch must not print eight million characters. */
const shown = (got: string | undefined, want: string): string | undefined => {
  if (got === undefined) {
    return undefined;
  }
  return got === want ? MARK : `${got.slice(0, 24)}... (${got.length} characters)`;
};
const flatten = (symbols: OutlineSymbol[]): Array<[string, number, number]> => symbols.flatMap((s): Array<[string, number, number]> => [[s.name.slice(0, 12), s.startLine, s.selectionLine], ...flatten(s.children)]);

const INTRO = "Intro.\n\n";
const heading = (tag: string, id: string): string => `${INTRO}# ${tag} {#${id}}\n\nbody\n`;
const setext = (tag: string, id: string): string => `${tag} {#${id}}\n=====\n\nbody\n`;
const withCell = (tag: string, id: string): string => `${INTRO}# ${tag} {#${id}}\n\n\`\`\`{r}\n1\n\`\`\`\n`;
const div = (tag: string, id: string): string => `${INTRO}::: {#${id}}\n![${tag}](y.png)\n:::\n`;
const image = (tag: string, id: string): string => `${INTRO}![${tag}](y.png){#${id}}\n`;
const span = (tag: string, id: string): string => `${INTRO}[${tag}]{#${id}}\n`;

function headingsRow(key: string, tag: string, hint: KnownEngine | undefined, build: typeof heading = heading, line = 2): Row {
  return {
    key,
    site: `findHeadings${hint === undefined ? "" : ` with the ${hint} hint`}: ${build === setext ? "a setext" : "an ATX"} heading's attribute block`,
    tag,
    build: (letters) => build(tag, `sec-${letters}`),
    read: (text, letters) => findHeadings(text, hint).map((h) => [h.text, shown(h.id, `sec-${letters}`), h.line]),
    answer: (shift) => [[tag, MARK, line + shift]],
  };
}
function outlineRow(key: string, tag: string, hint: KnownEngine | undefined): Row {
  return {
    key,
    site: `buildOutline${hint === undefined ? "" : ` with the ${hint} hint`}: an ATX heading's attribute block`,
    tag,
    build: (letters) => heading(tag, `sec-${letters}`),
    read: (text) => flatten(buildOutline(text, hint)),
    answer: (shift) => [[tag, 2 + shift, 2 + shift]],
  };
}
function labelsRow(key: string, tag: string, hint: KnownEngine | undefined, build: typeof heading, prefix: "sec" | "fig", what: string): Row {
  return {
    key,
    site: `indexLabels${hint === undefined ? "" : ` with the ${hint} hint`}: ${what}`,
    tag,
    build: (letters) => build(tag, `${prefix}-${letters}`),
    read: (text, letters) => indexLabels(text, hint).map((l) => [shown(l.id, `${prefix}-${letters}`), l.line]),
    answer: (shift) => [[MARK, 2 + shift]],
  };
}
function lookupRow(key: string, tag: string, hint: KnownEngine | undefined, build: typeof heading, prefix: "sec" | "fig", what: string, column: number): Row {
  return {
    key,
    site: `findLabel${hint === undefined ? "" : ` with the ${hint} hint`}: ${what}`,
    tag,
    build: (letters) => build(tag, `${prefix}-${letters}`),
    read: (text, letters) => {
      const found = findLabel(text, `${prefix}-${letters}`, hint);
      return found === null ? [] : [[shown(found.id, `${prefix}-${letters}`), found.kind, found.line, found.column]];
    },
    answer: (shift) => [[MARK, prefix, 2 + shift, column]],
  };
}

/** Every row there is, keyed. A file runs the rows it names. Each row has its own tag, so no two rows read the same text (`scanRegions` keeps the last two scans by text: a repeat would be served from it). */
export const ALL_ROWS: Row[] = [
  headingsRow("h-plain", "A01", undefined),
  headingsRow("h-knitr", "A02", "knitr"),
  headingsRow("h-jupyter", "A03", "jupyter"),
  headingsRow("h-setext", "A04", undefined, setext, 0),
  {
    key: "cells",
    site: "findAllCells: an attribute block above an R code cell",
    tag: "A05",
    build: (letters) => withCell("A05", `sec-${letters}`),
    read: (text) => findAllCells(text).map((c) => [c.lang, c.startLine]),
    answer: (shift) => [["r", 4 + shift]],
  },
  {
    key: "engine",
    site: "resolveDocumentEngine: an attribute block above an R code cell that names the engine",
    tag: "A06",
    build: (letters) => withCell("A06", `sec-${letters}`),
    read: (text) => resolveDocumentEngine("a.qmd", text),
    answer: () => "knitr",
  },
  outlineRow("o-plain", "A07", undefined),
  outlineRow("o-knitr", "A08", "knitr"),
  outlineRow("o-jupyter", "A09", "jupyter"),
  labelsRow("l-plain", "A10", undefined, heading, "sec", "an ATX heading's `sec-` id"),
  labelsRow("l-knitr", "A11", "knitr", heading, "sec", "an ATX heading's `sec-` id"),
  labelsRow("l-jupyter", "A12", "jupyter", heading, "sec", "an ATX heading's `sec-` id"),
  lookupRow("f-plain", "A13", undefined, heading, "sec", "an ATX heading's `sec-` id", 8),
  lookupRow("f-knitr", "A14", "knitr", heading, "sec", "an ATX heading's `sec-` id", 8),
  lookupRow("f-jupyter", "A15", "jupyter", heading, "sec", "an ATX heading's `sec-` id", 8),
  labelsRow("d-plain", "A16", undefined, div, "fig", "a fenced div's `fig-` id"),
  labelsRow("i-plain", "A17", undefined, image, "fig", "an image's `fig-` id"),
  labelsRow("s-plain", "A18", undefined, span, "fig", "a bracketed span's `fig-` id"),
  labelsRow("d-knitr", "A19", "knitr", div, "fig", "a fenced div's `fig-` id"),
  labelsRow("i-jupyter", "A20", "jupyter", image, "fig", "an image's `fig-` id"),
  labelsRow("s-knitr", "A21", "knitr", span, "fig", "a bracketed span's `fig-` id"),
  lookupRow("fd-plain", "A22", undefined, div, "fig", "a fenced div's `fig-` id", 6),
  labelsRow("i-knitr", "A23", "knitr", image, "fig", "an image's `fig-` id"),
  labelsRow("s-jupyter", "A24", "jupyter", span, "fig", "a bracketed span's `fig-` id"),
];

const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = performance.now();
  const result = run();
  return { result, ms: performance.now() - started };
};

/** The short run and then the long one, for one row, one form and one reader: the answers must be the stated one, and the long read must finish inside the limit. */
export function checkRow(row: Row, form: Form, reader: Reader): void {
  const shortLetters = form.letters(S338_FEW);
  expect(row.read(reader.prefix + row.build(shortLetters), shortLetters)).toEqual(row.answer(reader.shift));
  const letters = form.letters(form.many);
  const text = reader.prefix + row.build(letters);
  expect(text.length).toBeGreaterThan(letters.length); // the timed text holds the whole run
  const { result, ms } = timed(() => row.read(text, letters));
  expect(result).toEqual(row.answer(reader.shift));
  expect(ms).toBeLessThan(S338_LIMIT_MS);
}

/** The rows a file runs, in the order named. A name that is no row is a mistake in the file, not an empty run. */
export function rowsNamed(keys: readonly string[]): Row[] {
  return keys.map((key) => {
    const row = ALL_ROWS.find((r) => r.key === key);
    if (row === undefined) {
      throw new Error(`no such row: ${key}`);
    }
    return row;
  });
}

/** What the reader prefix selects, shown on a block only the default reader strips: `{#a#b}` is two ids in a row to the pandoc family (a valid block whose LAST id wins) and a refused block to `commonmark_x`
 * (ordinary heading text). The rows of a `commonmark_x` file reach `ATTR_ATOM_COMMONMARK` only if this reads. */
export function readerAnswer(reader: Reader): unknown {
  return findHeadings(`${reader.prefix}# T {#a#b}\n`).map((h) => [h.text, h.id]);
}

/** Register the rows of one file: every named row in every named form, then the three guards (a different text for every row, the reader the prefix selects, the sizes and the count the rows are built on). */
export function defineRows(options: { title: string; reader: Reader; keys: readonly string[]; forms: readonly Form[]; sizes: readonly number[]; rowCount: number }): void {
  const { title, reader, keys, forms, sizes, rowCount } = options;
  const rows = rowsNamed(keys);
  describe(title, () => {
    it.each(rows.flatMap((row) => forms.map((form) => [`${row.site} (${reader.name}; ${form.name}; ${form.many.toLocaleString("en-US")} letters)`, row, form] as const)))(
      "%s: is read without throwing, in time, and the answer is the stated one with 4 letters and with the long run",
      (_name, row, form) => {
        checkRow(row, form, reader);
      },
      120_000,
    );

    it("builds a different text for every row", () => {
      // The TEXT alone: `scanRegions` keeps the last two scans by text, so a row whose text another row read just before it is served from the cache and cannot be RED.
      const texts = rows.map((row) => reader.prefix + row.build(forms[0].letters(S338_FEW)));
      expect(new Set(texts).size).toBe(rows.length);
    });

    it("selects the reader it names", () => {
      expect(readerAnswer(reader)).toEqual(reader === DEFAULT_READER ? [["T", "b"]] : [["T {#a#b}", undefined]]);
    });

    it("keeps the sizes, the limit, the forms and the row count these rows are built on", () => {
      expect([FIRST_THROW, S338_MANY, S338_BYTE_MANY, S338_FEW, S338_LIMIT_MS]).toEqual([4_194_288, 8_400_000, 1_000_000, 4, 10_000]);
      expect(S338_MANY).toBeGreaterThanOrEqual(2 * FIRST_THROW); // twice the first throw (4,194,288 letters, Node 22.23, HEAD fe6aaec)
      expect(forms.map((f) => f.letters(S338_FEW))).toEqual(forms.map((f) => FORM_SHORT[f.name]));
      expect(forms.map((f) => f.many)).toEqual(sizes);
      expect(rows.length).toBe(rowCount);
      expect(rows.length).toBe(new Set(keys).size); // no row is named twice
    });
  });
}

const ONE_BYTE_NAME = oneByte(0).name;
/** What each form gives for four letters: the short run of every row. */
const FORM_SHORT: Record<string, string> = {
  [ONE_BYTE_NAME]: "aaa\u00e9",
  [ONE_WIDE.name]: "aaa\u4e2d",
  [ALL_WIDE.name]: "\u4e2d\u4e2d\u4e2d\u4e2d",
  [ASTRAL.name]: "\u{1d400}".repeat(4),
};
