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
 * Exists so a caller on a hot path can reject a file BEFORE paying to materialize
 * its text. `isRenderScript(fileName, text)` takes `text` as an eager argument, so
 * a caller that has only a `vscode.TextDocument` must call `doc.getText()` — which
 * builds a string of the WHOLE buffer — before this extension check inside it ever
 * runs. On the per-keystroke context-key path that means every edit to any file
 * (a 20 MB log, a big .json) would allocate the entire buffer just to discover the
 * extension was never `.py`/`.jl`/`.r`. `updateCellContext`, the precedent the
 * context key is modelled on, avoids this by short-circuiting on
 * `languageId === "quarto"` before its own `getText()`; this is how the render-script
 * key does the same.
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
 * disk.
 */
export function isRenderScript(fileName: string, text: string): boolean {
  const ext = extensionOf(fileName);
  if (PERCENT_EXTENSIONS.includes(ext) && PERCENT_CELL.test(text)) {
    return true;
  }
  return ext === SPIN_EXTENSION && SPIN_HEADER.test(text);
}
