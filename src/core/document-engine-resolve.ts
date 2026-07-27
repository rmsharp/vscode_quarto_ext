/**
 * The ONE place a document's engine is resolved from a document snapshot (S169).
 *
 * `documentEngineForScoping` (`document-engine.ts`) is the decision; it takes five arguments
 * — a file name, THREE things derived from the text, and the text itself — and getting that
 * wiring right is load-bearing. One of the three is guarded by the type system and one is
 * not:
 *
 *  - passing `findFrontMatterValueLines` where `findFrontMatterTopLevelLines` belongs is a
 *    **compile error** (TS2345: `hasChildren` is missing), because `hasChildren` was made
 *    REQUIRED for exactly this reason — `document-engine.ts:38-45`, which records that it
 *    used to type-check silently and un-ship the container form of the override;
 *  - dropping `frontMatterContentLines` type-checks fine and silently un-ships the narrower
 *    ENGINE partitioner quarto really uses. That one is caught only by a pin.
 *
 * This module owns the wiring so it exists exactly once.
 *
 * Two consumers, and the reason this module exists rather than a second copy:
 *
 *  - `core/yaml-value-flags.ts` — the value DECISION, which scopes each cell's option
 *    schema to the document engine (S164/S165).
 *  - `providers/yaml.ts` — cell-option COMPLETION, which learned the same fact in S169.
 *    Before that it scoped by the cell LANGUAGE, so in a knitr document the validator
 *    flagged a knitr-only key in a `{python}`/`{ojs}`/`{js}` cell that completion refused
 *    to offer. Grounded firsthand vs quarto 1.7.33: an `{r}` cell plus a `{python}` cell
 *    carrying `#| cache: banana` renders **exit 1** (`Field "cache" has value banana`),
 *    the same document without the key renders exit 0, and the `{python}`-ONLY document
 *    renders exit 0 — so the key really is in scope, and only because of the OTHER cell.
 *    (**Not `{sql}`** — an earlier revision of this list said so and it was wrong, found by
 *    the S169 §9 review. `engineFor("sql")` is `undefined`, i.e. the UNFILTERED set, so a
 *    `{sql}` cell already offered `cache`; for those languages S169 is a narrowing, not the
 *    fix. See `completionEngineFor` for the full before/after table.)
 *
 * A hand-written second copy of this wiring is precisely the mirror-drift defect class
 * Sessions 166-168 spent three sessions eliminating (`test/oracle/flags.ts` had already
 * drifted undetected once). One implementation, two callers.
 *
 * **Everything derives from the ONE `text` argument on purpose.** Accepting a pre-derived
 * array alongside the text would let a caller pair arrays from one snapshot with text from
 * another — the S124 desync `ValueSources` exists to make unrepresentable.
 *
 * **What it costs, measured rather than assumed** (an earlier revision of this paragraph had
 * the cost model backwards, S169 §9 review). On an 1810-line / 18 KB document, ~0.14 ms per
 * call, and the split is the opposite of what "reads the front-matter block only" suggests:
 * the three enumerators are **92%** of it (each re-splits the whole document into lines
 * before looking at the front matter) and the language fallback's full-text scan is **8%**.
 * Small in absolute terms, but completion is NOT debounced the way diagnostics are, so its
 * caller invokes this lazily — only once the cursor is known to be on a cell-option line.
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
