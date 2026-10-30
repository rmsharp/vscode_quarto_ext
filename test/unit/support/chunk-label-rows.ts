import { expect, it } from "vitest";
import { buildOutline, findHeadings, knitrChunkHeaderLabel } from "../../../src/core/qmd/model";
import { findLabel, indexLabels } from "../../../src/core/refs";

// Shared by the Session 338 rows of the knitr chunk header's label (the BACKLOG item "Eleven more places that throw `RangeError` on a long line or a long list", part D): a document whose header holds a
// run of millions of characters, read through the entry a provider calls, with the ANSWER a short version of the same document gives.
//
// Every row exists in TWO forms. "narrow": every character of the line is up to U+00FF, which V8 reads as a one-byte string and a class-plus over it takes no stack. "wide": ONE character above U+00FF
// stands in the line (a second option, `x="中"`, U+4E2D), which makes the whole line a two-byte string: the stack entry of a class-plus doubles and the pattern throws `RangeError: Maximum call stack size
// exceeded` from 4,194,284 to 8,388,570 characters, whichever the run is made of. The narrow form is therefore GREEN on the parent; it is the control that says the wide form's answer is the narrow form's.

export type Entry = "index" | "find" | "header" | "headings" | "outline";
export type Form = "narrow" | "wide";

/** The option the wide form adds to the header: one character above U+00FF, in a segment of its own (so the segment under test stays the one that holds the run). */
export const WIDE_OPTION = ', x="中"';

export interface Row {
  site: string;
  entry: Entry;
  /** The text before the run, in the opener line: the fence, the engine and everything up to the run. */
  head: string;
  /** The run: one character, repeated `n` times. */
  unit: string;
  /** The text after the run, up to (not including) the form's extra option and the closing brace. */
  tail: string;
  /** The id `indexLabels` and `findLabel` answer, built from the run's length. For `header` it is the VALUE the reader answers. Left out when the label is not read. */
  id?: (n: number) => string;
  /** The cross-reference kind of the id, for `index` and `find`. */
  kind?: "fig" | "tbl";
  /** The column of the label in the opener line, from the run's length. */
  column?: (n: number) => number;
  /** `headings` and `outline` only: whether the label is read (the chunk then echoes the code `read_chunk` brings, so the heading below it stays) or declined (the chunk is silent and the heading is swallowed). */
  defines?: boolean;
  /** The length of the run. */
  n: number;
}

/** The rest of the document after the opener. The heading carries the entry's name, so that two rows that differ in the entry only (the label index and the definition read the same opener) are different TEXTS. */
const fenceClose = (entry: Entry): string => `\nplot(1)\n\`\`\`\n\n# ${entry}\n`;

/** A document of the shape of `qmd-model.test.ts`'s Session 307 grid: a `read_chunk` call above a stray bare fence and an empty target chunk. A labelled target echoes the file's code (`Top, After, Last`), an unlabelled one is silent (`Top, Last`). */
export function readChunkGrid(target: string[]): string {
  const source = ["```{r src, include=FALSE}", "z <- 3", "```"];
  const setup = [...source, "", "```{r setup, include=FALSE}", 'knitr::read_chunk("_lbl.R")', "```"];
  return ["---", "title: t", "---", "", ...setup, "", "# Top", "", "```", "", "## Between", "", ...target, "", "## After", "", "```{r}", "y <- 1", "```", "", "## Last", ""].join("\n");
}
export const ECHOES = ["Top", "After", "Last"];
export const SILENT = ["Top", "Last"];

export function openerOf(row: Row, n: number, form: Form): string {
  return row.head + row.unit.repeat(n) + row.tail + (form === "wide" ? WIDE_OPTION : "") + "}";
}

/** The text the entry reads: the opener alone for the header reader, a document for the others. */
export function inputOf(row: Row, n: number, form: Form): string {
  const opener = openerOf(row, n, form);
  if (row.entry === "header") {
    return opener;
  }
  return row.entry === "headings" || row.entry === "outline" ? readChunkGrid([opener, "```"]) : opener + fenceClose(row.entry);
}

/** What the entry answers, with an id compared and not printed (a failure must not print eight million characters). */
export function readRow(row: Row, input: string, n: number): unknown {
  const id = row.id === undefined ? undefined : row.id(n);
  switch (row.entry) {
    case "header": {
      const header = knitrChunkHeaderLabel(input);
      return header === null ? null : [header.value === id, header.column];
    }
    case "find": {
      const label = findLabel(input, id as string, "knitr");
      return label === null ? null : [label.id === id, label.kind, label.line, label.column];
    }
    case "index":
      return indexLabels(input, "knitr").map((label) => [label.id === id, label.kind, label.line, label.column]);
    case "headings":
      return findHeadings(input, "knitr").map((heading) => heading.text);
    case "outline":
      return flatten(buildOutline(input, "knitr"));
  }
}

/** The outline as a flat list of `kind:name@startLine`, children after their parent. */
function flatten(nodes: ReturnType<typeof buildOutline>): string[] {
  return nodes.flatMap((node) => [`${node.kind}:${node.name}@${node.startLine}`, ...flatten(node.children)]);
}

/** The answer the row states: the same for 4 characters and for the long run. A row without `id` states that the label is not read. */
export function answerOf(row: Row, n: number): unknown {
  const column = row.column === undefined ? 0 : row.column(n);
  const read = row.id !== undefined;
  switch (row.entry) {
    case "header":
      return read ? [true, column] : null;
    case "find":
      return read ? [true, row.kind, 0, column] : null;
    case "index":
      return read ? [[true, row.kind, 0, column]] : [];
    case "headings":
      return row.defines === true ? ECHOES : SILENT;
    case "outline":
      // What the same document gives with a short label (`lbl`, read) or none (declined): the target chunk is on the same line either way.
      return flatten(buildOutline(readChunkGrid(row.defines === true ? ["```{r lbl}", "```"] : ["```{r}", "```"]), "knitr"));
  }
}

/** Where a size comes from: the clock helper of the rows reports the milliseconds a run took and hands back its result. */
export const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = Date.now();
  const result = run();
  return { result, ms: Date.now() - started };
};

/**
 * Register one test per row and form. A long read is given `limitMs`, wide on purpose: the cure reads a run in a second or two, a quadratic reading would take hours, and a limit loosened to pass would pass
 * a slow cure. The 4-character control runs first, so a row whose own answer is wrong fails there and not as a timeout.
 */
export function registerRows(rows: readonly Row[], limitMs: number): void {
  for (const form of ["narrow", "wide"] as const) {
    it.each(rows.map((row) => [row.site, row] as const))(`${form} form, %s: is read without throwing and the answer is the short document's`, (_site, row) => {
      expect(readRow(row, inputOf(row, 4, form), 4)).toEqual(answerOf(row, 4));
      const input = inputOf(row, row.n, form);
      expect(input.length).toBeGreaterThan(row.n); // the timed text holds the whole run
      const { result, ms } = timed(() => readRow(row, input, row.n));
      expect(result).toEqual(answerOf(row, row.n));
      expect(ms).toBeLessThan(limitMs);
    }, 120_000);
  }
}

/** The texts of the rows are all different: `scanRegions` keeps the last scans by text, so a row whose text another row read just before it is served from the cache and cannot be RED. */
export function distinctTexts(rows: readonly Row[], form: Form): number {
  return new Set(rows.map((row) => inputOf(row, 4, form))).size;
}
