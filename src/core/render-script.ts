/**
 * Pure, `vscode`-free detector for Quarto **render scripts** — the standalone
 * `.py`/`.jl`/`.r` files `quarto preview` will serve, as opposed to `.qmd`
 * documents (CHANGELOG: preview command family breadth, Sessions 82-85, `quarto.previewScript`; plan
 * `docs/planning/2026-07-12-preview-script-plan.md` §5.2).
 *
 * Quarto picks an execution engine by asking each engine's `claimsFile`, which
 * gives exactly TWO ways a script becomes previewable — both are recognized here:
 *
 *  - **Path A — Jupyter percent script** (`.py`/`.jl`/`.r`; jupyter/julia
 *    engines): the file opens with a `# %% [markdown]` or `# %% [raw]` cell.
 *  - **Path B — knitr *spin* script** (`.r` only; knitr engine): the file opens
 *    with a roxygen `#' ---` … `#' ---` front-matter block. Needs no jupyter
 *    kernel, which is why it is also the integration suite's success fixture.
 *
 * Keyed on the file-name EXTENSION, never a languageId: nothing maps `.py`/`.jl`/
 * `.r` to a stable languageId here, and the `.r`/`.jl` ids vary by whichever
 * language extensions the user has installed. This mirrors Quarto's own
 * `extname().toLowerCase()`. `.qmd`/`.rmd` are not in the set, so `quarto.preview`
 * and `quarto.previewScript` can never both claim the same file.
 *
 * ⚠ DELIBERATE, DISCLOSED DIVERGENCE from the CLI (plan §5.2, option (ii)).
 * Quarto's own percent regex is `/^\s*#\s*%%+\s+\[markdown|raw\]/` (quarto.js
 * :37367) — it has no group, so `|` splits it at the top level into
 * `^\s*#\s*%%+\s+\[markdown` OR a bare, UNANCHORED `raw]`. That second branch
 * matches the substring `raw]` anywhere in the file, so Quarto treats ordinary
 * code containing e.g. `data[raw]` as a render script (verified firsthand against
 * 1.7.33). We add the missing group. The two regexes agree on every
 * conventionally-structured render script and diverge only on the buggy branch,
 * where our answer is the safe one: no offering to preview ordinary code, and no
 * hijacking the future `quartoRenderScriptActive` context key while the user
 * edits plain Python. Both divergences are locked by the DISCRIMINATOR tests in
 * `test/unit/render-script.test.ts`, which are break-revert-proven against the
 * verbatim regex.
 *
 * Lives in `core/` and MUST NOT import `vscode` (architecture §3.3 guardrail).
 */

/** Path A: the file opens with a Jupyter percent markdown/raw cell. */
const PERCENT_CELL = /^\s*#\s*%%+\s+\[(markdown|raw)\]/;

/** Extensions the jupyter/julia engines claim as percent scripts. */
const PERCENT_EXTENSIONS = [".py", ".jl", ".r"];

/**
 * Path B: the file opens with a roxygen `#' ---` … `#' ---` front-matter block.
 *
 * ⚠ One character differs from Quarto's own regex (quarto.js:28695), which reads
 * `[\s\S]+?\s*#'`. That `\s*` is REDUNDANT — the lazy `[\s\S]+?` already absorbs
 * any whitespace it could match, so the two accept exactly the same language —
 * but it is also AMBIGUOUS with that lazy quantifier, so on a FAILING match (a
 * header opened and never closed) the engine retries every expansion against it
 * and the match becomes O(n²) in the longest contiguous whitespace run. A `.r`
 * file with an unclosed `#' ---` and ~80k blank lines took **3.7 seconds**;
 * without the `\s*` it takes 0.03 ms. Quarto gets away with it because the CLI
 * runs this once per render in a Deno subprocess; we run it on VS Code's
 * single-threaded extension host — and Slice 2 will run it on every keystroke.
 * The cost is locked by a unit test in `test/unit/render-script.test.ts`.
 */
const SPIN_HEADER = /^\s*#'\s*---[\s\S]+?#'\s*---/;

/** The knitr engine only spins R. */
const SPIN_EXTENSION = ".r";

/** The lowercased extension of `fileName`, including the dot (`""` if none). */
function extensionOf(fileName: string): string {
  const base = fileName.slice(
    Math.max(fileName.lastIndexOf("/"), fileName.lastIndexOf("\\")) + 1,
  );
  const dot = base.lastIndexOf(".");
  // `dot <= 0` also rejects a dotfile (`.env`), which has no extension.
  return dot <= 0 ? "" : base.slice(dot).toLowerCase();
}

/**
 * True iff `fileName`'s extension is one a render script could possibly have —
 * the CHEAP half of `isRenderScript`, deciding on the name alone.
 *
 * Exists so a caller that holds a document and not yet its text can reject a file
 * BEFORE paying to materialize that text. `isRenderScript(fileName, text)` takes
 * `text` as an eager argument, so a caller that has only a `vscode.TextDocument`
 * must call `doc.getText()` — which builds a string of the WHOLE buffer — before the
 * extension check inside it ever runs. The preview adapter no longer takes that route
 * (Session 344, SIB-08): it calls `isRenderScriptDocument`, which reads no line for a
 * name no pattern claims, and it keeps this check first in its chain as the cheaper
 * question, where a syntax-tree pin holds it (`features/preview.ts`).
 *
 * MUST be a superset of `isRenderScript`'s accept set — a pre-filter that vetoed a
 * real script would silently turn the key false for it. Locked by a unit test.
 */
export function isRenderScriptExtension(fileName: string): boolean {
  const ext = extensionOf(fileName);
  return PERCENT_EXTENSIONS.includes(ext) || ext === SPIN_EXTENSION;
}

/**
 * True iff `(fileName, text)` is a Quarto render script — a Jupyter percent
 * script OR a knitr spin script. Total: no I/O, never throws; an untitled buffer
 * (no extension) is `false`, which is correct — `quarto preview` needs a file on
 * disk. For a document that is read line by line, `isRenderScriptDocument` gives
 * the same answer without building the text.
 */
export function isRenderScript(fileName: string, text: string): boolean {
  const ext = extensionOf(fileName);
  if (PERCENT_EXTENSIONS.includes(ext) && PERCENT_CELL.test(text)) {
    return true;
  }
  return ext === SPIN_EXTENSION && SPIN_HEADER.test(text);
}

/**
 * What `isRenderScriptDocument` reads of a document: how many lines it has and the text of one of them. A `vscode.TextDocument` is one, and
 * this module stays `vscode`-free by naming only these two members.
 */
export interface RenderScriptSource {
  readonly lineCount: number;
  lineAt(index: number): { readonly text: string };
}

/**
 * True iff `\s` matches the UTF-16 code unit `code`. The ASCII answer is the specification's (tab, line feed, vertical tab, form feed, carriage return and space);
 * everything above it is asked of the engine with the class the two patterns use, so no table is written here to drift from it (`test/unit/s344-render-script-lazy.test.ts`
 * puts every one of the 65,536 code units in the gaps of a script and compares).
 */
const SPACE = /\s/;
function isSpace(code: number): boolean {
  return code < 128 ? code === 32 || (code >= 9 && code <= 13) : SPACE.test(String.fromCharCode(code));
}

const HASH = 35; // #
const QUOTE = 39; // '
const PERCENT = 37; // %
const OPEN_BRACKET = 91; // [

/** A position in a document read line by line: the line, its text and the column, with the line fetched when the position first reaches it, once, and never again. */
class Cursor {
  line = 0;
  text: string;
  column = 0;

  constructor(private readonly document: RenderScriptSource) {
    this.text = document.lineAt(0).text;
  }

  /** The code unit at the column (`NaN` at the end of the line). */
  code(): number {
    return this.text.charCodeAt(this.column);
  }

  /** True iff the text from the column + `offset` begins with `needle`. It never leaves the line. */
  startsWith(needle: string, offset: number): boolean {
    return this.text.startsWith(needle, this.column + offset);
  }

  /** Moves to the start of the next line, reading it; false (and no read) when this is the last. */
  nextLine(): boolean {
    if (this.line + 1 >= this.document.lineCount) return false;
    this.line++;
    this.text = this.document.lineAt(this.line).text;
    this.column = 0;
    return true;
  }

  /** True iff the next character of the document is whitespace: the one at the column, or at the end of a line the line break after it (when a line follows). */
  atSpace(): boolean {
    return this.column < this.text.length ? isSpace(this.code()) : this.line + 1 < this.document.lineCount;
  }

  /** `\s*`: moves over whitespace, line breaks included, to the next character that is not; false when the document ends first. */
  skipSpace(): boolean {
    for (;;) {
      while (this.column < this.text.length && isSpace(this.code())) this.column++;
      if (this.column < this.text.length) return true;
      if (!this.nextLine()) return false;
    }
  }
}

/** `PERCENT_CELL` after its `#`: `\s*%%+\s+\[(markdown|raw)\]`. */
function percentCellAfterHash(cursor: Cursor): boolean {
  if (!cursor.skipSpace()) return false;
  let percents = 0;
  while (cursor.code() === PERCENT) {
    cursor.column++;
    percents++;
  }
  // A line break is whitespace and not a percent sign: the run is one line's.
  if (percents < 2 || !cursor.atSpace() || !cursor.skipSpace()) return false;
  // The bracketed word has no whitespace in it, so it is on this line.
  return cursor.code() === OPEN_BRACKET && (cursor.startsWith("markdown]", 1) || cursor.startsWith("raw]", 1));
}

/** `SPIN_HEADER` after its `#` and a `'`: `\s*---[\s\S]+?#'\s*---`. */
function spinHeaderAfterQuote(cursor: Cursor): boolean {
  cursor.column++;
  if (!cursor.skipSpace() || !cursor.startsWith("---", 0)) return false;
  cursor.column += 3;
  // `[\s\S]+?` takes one character before the closer may begin, whatever it is (`#' ---#' ---` is not a header); at the end of a line that character is the line break.
  if (cursor.column < cursor.text.length) {
    cursor.column++;
  } else if (!cursor.nextLine()) {
    return false;
  }
  // The first `#'` + `\s*` + `---` anywhere after it. A `#'` is on one line (a line break between its characters is whitespace), the whitespace after it may run over lines, and a
  // failed attempt resumes AT the character that failed it, which may be a `#`.
  for (;;) {
    const at = cursor.text.indexOf("#'", cursor.column);
    if (at === -1) {
      if (!cursor.nextLine()) return false;
      continue;
    }
    cursor.column = at + 2;
    if (!cursor.skipSpace()) return false;
    if (cursor.startsWith("---", 0)) return true;
  }
}

/**
 * `isRenderScript(fileName, document's text)` for a document read line by line (BACKLOG: "What Session 342's review round found beside the typing-path cures", part (8)(a), SIB-08),
 * and the same answer for every document and file name: `isRenderScript(fileName, lines.join(eol))` for either end of line, with `lines` the text of lines 0 to `lineCount - 1`.
 *
 * WHY IT EXISTS. `vscode.TextDocument.getText()` joins the whole buffer into a new string on every call, and the render-script predicate asked it on every keystroke of a `.py`, `.jl` or `.r`
 * document, to answer a question about the FIRST LINES: both patterns are anchored at the start. This reads `lineAt(i).text` for the lines the answer needs and stops.
 *
 * THE ALGORITHM, and why it is this one. A hand-written left-to-right scan of the two patterns, with no backtracking, one pass, each line fetched once and in order:
 *  - Both patterns begin `^\s*#`, and what follows the `#` tells the two apart (`'` is the spin header, anything else the percent cell), so one scan serves both. The opener of each
 *    pattern is deterministic: at every step the characters that could continue it (whitespace, `#`, `%`, `'`, `-`, `[`) are disjoint from the ones that could not, so it needs no backtracking.
 *  - A line break is one whitespace character (`"\n"` and `"\r\n"` both are, and no pattern counts them), so `\s*` and `\s+` run over line breaks, and a literal (`%%`, `[markdown]`,
 *    `---`, `#'`) never does. That is why the end of the line is not an end of the scan, and why a lone `%` at the end of a line is a rejection without a read of the next line.
 *  - The percent cell is decided by the line that holds its `]`, or by the first character that cannot continue it. The spin header's closer `#'\s*---` may be ANYWHERE later in the document,
 *    so a header opened and never closed reads to the end, exactly as `SPIN_HEADER.test` scanned to the end: only that rare file reads the document. `indexOf("#'")` finds the next candidate
 *    in a line, each failed candidate resumes where it failed, so a line is scanned once: no shape is quadratic (a million blank lines, a million lines of `#'`).
 *  - A prefix-by-prefix test of the regular expressions was not taken: it re-reads, and a regular expression cannot say "not yet" from "never".
 *
 * PROVED, not argued: `test/unit/s344-render-script-lazy.test.ts` holds it to the old function (kept there verbatim as the oracle) on 21.2 million document and file-name pairs over four alphabets,
 * the two-edit neighbourhood of eight scripts, every UTF-16 code unit in the gaps of a script and 120,000 seeded documents, each with both ends of line; and counts the lines read.
 */
export function isRenderScriptDocument(fileName: string, document: RenderScriptSource): boolean {
  const ext = extensionOf(fileName);
  const percent = PERCENT_EXTENSIONS.includes(ext);
  const spin = ext === SPIN_EXTENSION;
  if ((!percent && !spin) || document.lineCount <= 0) return false;
  const cursor = new Cursor(document);
  if (!cursor.skipSpace() || cursor.code() !== HASH) return false;
  cursor.column++;
  return cursor.code() === QUOTE ? spin && spinHeaderAfterQuote(cursor) : percent && percentCellAfterHash(cursor);
}
