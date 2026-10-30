// Shared by the rows of Session 338, part B of the BACKLOG item "Eleven more places that throw RangeError on a long line or a long list" (group g02, site 3): the documents, the long words and the answers.
// One file of rows for each reader keeps each of them well inside the budget of a test file (the readers do not share a cache entry, and a document of 4,300,000 letters is read once for each engine hint).
import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../../src/core/document-engine-resolve";
import { buildOutline, findAllCells, findBodyLines, findHeadings, type OutlineSymbol } from "../../../src/core/qmd/model";
import { findLabel, indexLabels } from "../../../src/core/refs";

export const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = Date.now();
  const result = run();
  return { result, ms: Date.now() - started };
};

/** A letter above U+00FF: a line that holds one is stored with two bytes a character. */
export const CJK = String.fromCharCode(0x4e2d);
/**
 * 4,300,000: the first throw is 4,194,288 letters (bisected at HEAD fe6aaec, one fresh process per probe, `findHeadings`, Node 22.23.3, the lower bound 4,194,287 verified OK first), so this is 2.5 percent
 * past it. A document of twice that figure (Learning 775) costs seconds a reader, and the document rows, one cache entry for each engine hint of each document, would not fit a file's budget.
 */
export const LONG = 4_300_000;
/**
 * 15 s. The cured reading of one document takes about a second (the 45 rows of one reader, nine documents of 4,300,000 letters each read once for each engine hint, take 8.02 s, 8.10 s and 8.38 s in the three
 * files, run alone); a quadratic reading of the word takes hours at this size, so the limit separates the two without being a benchmark. It is not raised to make a row pass.
 */
export const LIMIT_MS = 15_000;

export type Form = { readonly name: string; readonly key: string; readonly word: () => string };
export const FORMS: readonly Form[] = [
  { name: "every character up to U+00FF", key: "1", word: () => "a".repeat(LONG) },
  { name: "one character above U+00FF, at the end of the line", key: "2", word: () => "a".repeat(LONG - 1) + CJK },
  { name: "every character above U+00FF", key: "3", word: () => CJK.repeat(LONG) },
];

export type Reader = { readonly from: string; readonly key: string };
export const GFM: Reader = { from: "gfm", key: "g" };
export const COMMONMARK: Reader = { from: "commonmark", key: "c" };
export const COMMONMARK_X: Reader = { from: "commonmark_x", key: "x" };
export const READERS: readonly Reader[] = [GFM, COMMONMARK, COMMONMARK_X];

/** The front matter, a div opener whose attribute text is `word`, an ATX heading and a level-2 heading inside it, a label, a cell with a label, and a heading after them. Line numbers: opener 4, `# H` 6, `## K` 8, closer 10, image 12, cell 14 to 17, `## After` 19. */
export const doc = (id: string, word: string, from: string): string =>
  `---\nfrom: ${from}\n---\n\n::: ${word}\n\n# H${id}\n\n## K${id}\n\n:::\n\n![x](y){#fig-${id}}\n\n\`\`\`{r}\n#| label: tbl-c${id}\n1\n\`\`\`\n\n## After${id}\n`;

export const names = (text: string, engine?: "knitr" | "jupyter"): string[] => findHeadings(text, engine).map((h) => h.text);
export const flat = (symbols: OutlineSymbol[]): string[] => symbols.flatMap((s) => [`${s.kind}:${s.name}`, ...flat(s.children)]);

/** What every reader of the document answers when the div is a plain div: the headings inside it are headings. */
export const plainAnswers = (id: string) => ({
  headings: [`H${id}`, `K${id}`, `After${id}`],
  outline: [`heading:H${id}`, `heading:K${id}`, "cell:```{r}", `heading:After${id}`],
  labels: [[`fig-${id}`, 12], [`tbl-c${id}`, 15]],
});

/** The rows of one reader: for each form of the long word, every reader of the document (the entries the providers call, with the arguments they pass: Learning 886) on a document whose opener holds it. */
export function describeLongWordDocuments(reader: Reader): void {
  describe.each(FORMS.map((form) => ({ form })))(`Session 338 — a div opener whose word has 4,300,000 letters, from: ${reader.from}, $form.name`, ({ form }) => {
    const id = `${reader.key}${form.key}`;
    const want = plainAnswers(id);
    let memo: string | undefined;
    const longText = (): string => (memo ??= doc(id, form.word(), reader.from));

    const ROWS: ReadonlyArray<readonly [string, () => unknown, unknown]> = [
      ["findHeadings", () => names(longText()), want.headings],
      ["findHeadings with the knitr hint", () => names(longText(), "knitr"), want.headings],
      ["findHeadings with the jupyter hint", () => names(longText(), "jupyter"), want.headings],
      ["buildOutline", () => flat(buildOutline(longText())), want.outline],
      ["buildOutline with the knitr hint", () => flat(buildOutline(longText(), "knitr")), want.outline],
      ["buildOutline with the jupyter hint", () => flat(buildOutline(longText(), "jupyter")), want.outline],
      ["indexLabels", () => indexLabels(longText()).map((l) => [l.id, l.line]), want.labels],
      ["indexLabels with the knitr hint", () => indexLabels(longText(), "knitr").map((l) => [l.id, l.line]), want.labels],
      ["indexLabels with the jupyter hint", () => indexLabels(longText(), "jupyter").map((l) => [l.id, l.line]), want.labels],
      ["findLabel", () => findLabel(longText(), `fig-${id}`)?.line, 12],
      ["findLabel of the cell's label, with the knitr hint", () => findLabel(longText(), `tbl-c${id}`, "knitr")?.line, 15],
      ["findLabel with the jupyter hint", () => findLabel(longText(), `fig-${id}`, "jupyter")?.line, 12],
      ["findAllCells", () => findAllCells(longText()).map((c) => [c.lang, c.startLine, c.endLine]), [["r", 14, 17]]],
      ["findBodyLines", () => findBodyLines(longText()).map((b) => b.line), [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 18, 19, 20]],
      ["resolveDocumentEngine", () => resolveDocumentEngine("a.qmd", longText()), "knitr"],
    ];

    it.each(ROWS)("%s: is read without throwing, in the time limit, and the headings inside the div are headings", (_name, read, answer) => {
      const { result, ms } = timed(read);
      expect(result).toEqual(answer);
      expect(ms).toBeLessThan(LIMIT_MS);
    }, 120_000);
  });
}
