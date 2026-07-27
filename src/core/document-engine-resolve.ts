/**
 * The ONE place a document's engine is resolved from a document snapshot (S169).
 *
 * `documentEngineForScoping` (`document-engine.ts`) is the decision; it takes four DERIVED
 * inputs plus the raw text, and getting that wiring right is itself load-bearing — passing
 * `findFrontMatterValueLines` instead of `findFrontMatterTopLevelLines` type-checks and
 * silently un-ships the container form of the override (`document-engine.ts:38-45`), and
 * dropping `frontMatterContentLines` un-ships the narrower ENGINE partitioner quarto really
 * uses. This module owns that wiring so it exists exactly once.
 *
 * Two consumers, and the reason this module exists rather than a second copy:
 *
 *  - `core/yaml-value-flags.ts` — the value DECISION, which scopes each cell's option
 *    schema to the document engine (S164/S165).
 *  - `providers/yaml.ts` — cell-option COMPLETION, which learned the same fact in S169.
 *    Before that it scoped by the cell LANGUAGE, so in a knitr document the validator
 *    flagged a knitr-only key in a `{python}`/`{sql}` cell that completion refused to
 *    offer. Grounded firsthand vs quarto 1.7.33: an `{r}` cell plus a `{python}` cell
 *    carrying `#| cache: banana` renders **exit 1** (`Field "cache" has value banana`),
 *    the same document without the key renders exit 0, and the `{python}`-ONLY document
 *    renders exit 0 — so the key really is in scope, and only because of the OTHER cell.
 *
 * A hand-written second copy of this wiring is precisely the mirror-drift defect class
 * Sessions 166-168 spent three sessions eliminating (`test/oracle/flags.ts` had already
 * drifted undetected once). One implementation, two callers.
 *
 * **Everything derives from the ONE `text` argument on purpose.** Accepting a pre-derived
 * array alongside the text would let a caller pair arrays from one snapshot with text from
 * another — the S124 desync `ValueSources` exists to make unrepresentable. Re-deriving is
 * cheap: all three enumerators read the front-matter block only, and the language fallback
 * inside `documentEngineForScoping` is the one full-text scan. Completion is NOT debounced,
 * so its caller invokes this lazily, only once the cursor is known to be on a cell-option
 * line.
 */
import { documentEngineForScoping, type DocumentEngine } from "./document-engine";
import { frontMatterContentLines } from "./qmd/model";
import { findFrontMatterTopLevelLines } from "./yaml-frontmatter-values";
import { findNestedFrontMatterValueLines } from "./yaml-frontmatter-nested-values";

/**
 * The engine quarto would scope this document's cell options to — `"ambiguous"` when its
 * front matter selects more than one, and `undefined` when nothing here can answer (an
 * `.Rmd`, an `{{< include >}}` whose expansion we cannot see, a front matter quarto's
 * `trimLeft` reveals and our scanner does not, or a selector whose value we cannot read).
 * `undefined` means "keep the per-cell language approximation", never "markdown".
 *
 * `fileName` is read only for the `.Rmd` extension veto; it is never opened.
 */
export function resolveDocumentEngine(
  fileName: string,
  text: string,
): DocumentEngine | "ambiguous" | undefined {
  return documentEngineForScoping(
    fileName,
    findFrontMatterTopLevelLines(text),
    findNestedFrontMatterValueLines(text),
    frontMatterContentLines(text),
    text,
  );
}
