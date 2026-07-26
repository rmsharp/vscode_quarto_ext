/**
 * The oracle's document corpus.
 *
 * Ported verbatim from S165's scratchpad `replay.ts`, which grew it from the 17 documents
 * S164 built. Every row is a document whose `quarto render --no-execute` verdict has been
 * measured firsthand against 1.7.33; the driver re-measures them rather than trusting the
 * comment, and the comments say what was measured so a surprising result can be argued
 * with rather than guessed at.
 *
 * ⚠ THE CORPUS IS THE ORACLE'S HORIZON. A run reports only about the rows in it, and
 * S165's central lesson is that this is easy to forget: its own 48-document version
 * reported "18 improved, 0 regressed" while TWELVE regressions sat just outside it, on
 * front-matter shapes it had not thought to include. A clean run over this corpus is
 * evidence about these 64 documents, not a property of the change. WHEN YOU TOUCH THE
 * ENGINE-SCOPING PATH, ADD THE SHAPES YOU TOUCHED before believing the number.
 *
 * `cache` is the workhorse: it is knitr-ONLY and closed-valued, so `#| cache: banana`
 * renders exit 1 exactly when quarto resolved knitr, and exit 0 otherwise. That makes it a
 * direct read-out of quarto's engine decision. `echo` is the engine-AGNOSTIC control.
 */

/** One corpus document: a file map plus which file quarto renders. */
export interface OracleCase {
  name: string;
  files: Record<string, string>;
  /** Defaults to `doc.qmd`. */
  entry?: string;
}

export const entryOf = (c: OracleCase): string => c.entry ?? "doc.qmd";

/** The entry file's text, or `undefined` if the case names an entry it does not carry. */
export const entryTextOf = (c: OracleCase): string | undefined => c.files[entryOf(c)];

const FM = "---\ntitle: t\n---\n\n";
const cell = (lang: string, opt: string | null, prefix = "#|"): string =>
  "```{" + lang + "}\n" + (opt ? `${prefix} ${opt}\n` : "") + "1\n```\n\n";

/** An `{r}` cell and a `{python}` cell — the pair that reads out a document-wide answer.
 *  On an r-first document the fallback answers knitr, so `cache` in the {python} cell is
 *  the DISCRIMINATING pin; a "did not select knitr" assertion would be vacuous there. */
const rThenPy = cell("r", null) + cell("python", "cache: banana");

export const CORPUS: OracleCase[] = [
  // ---- the ORDER-DEPENDENT language loop ---------------------------------------------
  { name: "{r} alone + cache", files: { "doc.qmd": FM + cell("r", "cache: banana") } },
  { name: "{julia} then {r} + cache", files: { "doc.qmd": FM + cell("julia", null) + cell("r", "cache: banana") } },
  { name: "{r} + cache then {julia}", files: { "doc.qmd": FM + cell("r", "cache: banana") + cell("julia", null) } },
  { name: "{julia} then {r} + echo (agnostic)", files: { "doc.qmd": FM + cell("julia", null) + cell("r", "echo: banana") } },
  { name: "{python} alone + cache", files: { "doc.qmd": FM + cell("python", "cache: banana") } },
  { name: "{r} then {python} + cache", files: { "doc.qmd": FM + cell("r", null) + cell("python", "cache: banana") } },
  { name: "{python} + cache then {r}", files: { "doc.qmd": FM + cell("python", "cache: banana") + cell("r", null) } },
  { name: "{r} then {sql} + cache", files: { "doc.qmd": FM + cell("r", null) + cell("sql", "cache: banana", "--|") } },
  { name: "{sql} alone + cache", files: { "doc.qmd": FM + cell("sql", "cache: banana", "--|") } },
  { name: "{sql} alone + echo", files: { "doc.qmd": FM + cell("sql", "echo: banana", "--|") } },
  { name: "{r} then {ojs} + cache", files: { "doc.qmd": FM + cell("r", null) + cell("ojs", "cache: banana", "//|") } },
  { name: "{ojs} alone + cache", files: { "doc.qmd": FM + cell("ojs", "cache: banana", "//|") } },
  { name: "{ojs} alone + echo", files: { "doc.qmd": FM + cell("ojs", "echo: banana", "//|") } },
  { name: "{R} uppercase + cache", files: { "doc.qmd": FM + cell("R", "cache: banana") } },
  { name: "{r, echo=FALSE} attrs + cache", files: { "doc.qmd": FM + "```{r, echo=FALSE}\n#| cache: banana\n1\n```\n" } },

  // ---- fences quarto's CONTEXT-FREE language scan counts and our cell model does not ---
  // `languagesInMarkdown` allows digits and is nesting-blind; `breakQuartoMd` captures
  // `([=A-Za-z]+)` and tracks nesting. Different regexes over the same text — never use
  // one to reason about the other. All six measured exit 0.
  { name: "{julia} in a ```` example block, then {r} + cache", files: { "doc.qmd": FM + "````\n```{julia}\n1\n```\n````\n\n" + cell("r", "cache: banana") } },
  { name: "{julia} in a blockquote, then {r} + cache", files: { "doc.qmd": FM + "> ```{julia}\n> 1\n> ```\n\n" + cell("r", "cache: banana") } },
  { name: "{julia} 3-space indented, then {r} + cache", files: { "doc.qmd": FM + "   ```{julia}\n   1\n   ```\n\n" + cell("r", "cache: banana") } },
  { name: "{julia} in 4-space indented code, then {r} + cache", files: { "doc.qmd": FM + "    ```{julia}\n    1\n    ```\n\n" + cell("r", "cache: banana") } },
  { name: "{julia} in an HTML comment, then {r} + cache", files: { "doc.qmd": FM + "<!--\n```{julia}\n1\n```\n-->\n\n" + cell("r", "cache: banana") } },
  { name: "{julia} tab-indented, then {r} + cache", files: { "doc.qmd": FM + "\t```{julia}\n\t1\n\t```\n\n" + cell("r", "cache: banana") } },
  { name: "````{julia} 4 backticks, then {r} + cache", files: { "doc.qmd": FM + "````{julia}\n1\n````\n\n" + cell("r", "cache: banana") } },
  { name: "``` {julia} space after ticks, then {r} + cache", files: { "doc.qmd": FM + "``` {julia}\n1\n```\n\n" + cell("r", "cache: banana") } },
  { name: "{julia} in a front-matter block scalar, then {r} + cache", files: { "doc.qmd": "---\ntitle: |\n  ```{julia}\n---\n\n" + cell("r", "cache: banana") } },
  { name: "```{julia} x trailing text, then {r} + cache", files: { "doc.qmd": FM + "```{julia} x\n1\n```\n\n" + cell("r", "cache: banana") } },
  { name: "```{ julia } spaces in braces, then {r} + cache", files: { "doc.qmd": FM + "```{ julia }\n1\n```\n\n" + cell("r", "cache: banana") } },

  // ---- INCLUDES: the class S165 deliberately DECLINES ---------------------------------
  // Quarto expands includes PRE-engine and recurses, so the engine it computes is not the
  // one computable from the open buffer. Declining cannot create a false positive but does
  // not remove the pre-existing one; both directions and position are measured here.
  { name: "include(child {julia}) then {r} + cache", files: { "doc.qmd": FM + "{{< include child.qmd >}}\n\n" + cell("r", "cache: banana"), "child.qmd": cell("julia", null) } },
  { name: "include(child {r}) then {python} + cache", files: { "doc.qmd": FM + "{{< include child.qmd >}}\n\n" + cell("python", "cache: banana"), "child.qmd": cell("r", null) } },
  { name: "{r} + cache then include(child {julia})", files: { "doc.qmd": FM + cell("r", "cache: banana") + "{{< include child.qmd >}}\n", "child.qmd": cell("julia", null) } },
  { name: "nested include(child→grand {julia}) then {r} + cache", files: { "doc.qmd": FM + "{{< include child.qmd >}}\n\n" + cell("r", "cache: banana"), "child.qmd": "{{< include grand.qmd >}}\n", "grand.qmd": cell("julia", null) } },

  // ---- front matter interacting with the fallback -------------------------------------
  { name: "engine: banana + {julia} then {r} + cache", files: { "doc.qmd": "---\ntitle: t\nengine: banana\n---\n\n" + cell("julia", null) + cell("r", "cache: banana") } },
  { name: "engine: banana + {r} + cache", files: { "doc.qmd": "---\ntitle: t\nengine: banana\n---\n\n" + cell("r", "cache: banana") } },
  { name: "engine: MARKDOWN (case typo) + {r} + cache", files: { "doc.qmd": "---\ntitle: t\nengine: MARKDOWN\n---\n\n" + cell("r", "cache: banana") } },
  { name: "execute:/engine: banana + {r} + cache", files: { "doc.qmd": "---\ntitle: t\nexecute:\n  engine: banana\n---\n\n" + cell("r", "cache: banana") } },
  { name: "execute: {engine: markdown} FLOW + {r} + cache", files: { "doc.qmd": "---\ntitle: t\nexecute: {engine: markdown}\n---\n\n" + cell("r", "cache: banana") } },
  { name: "execute: {echo: false} FLOW + {r} + cache", files: { "doc.qmd": "---\ntitle: t\nexecute: {echo: false}\n---\n\n" + cell("r", "cache: banana") } },
  { name: "no front matter, {r} + cache", files: { "doc.qmd": cell("r", "cache: banana") } },
  { name: "blank first FM line + {r} + cache", files: { "doc.qmd": "---\n\ntitle: t\n---\n\n" + cell("r", "cache: banana") } },
  { name: "engine: markdown + {r} + cache (S164 override)", files: { "doc.qmd": "---\ntitle: t\nengine: markdown\n---\n\n" + cell("r", "cache: banana") } },
  { name: "engine: knitr + {python} + cache (S164 override)", files: { "doc.qmd": "---\ntitle: t\nengine: knitr\n---\n\n" + cell("python", "cache: banana") } },
  { name: "jupyter: python3 + {r} + cache (S164 alias)", files: { "doc.qmd": "---\ntitle: t\njupyter: python3\n---\n\n" + cell("r", "cache: banana") } },

  // ---- handler cells, under both engines (S162's carve-out must survive) --------------
  { name: "{r} then {dot} + cache (handler in a knitr doc)", files: { "doc.qmd": FM + cell("r", null) + "```{dot}\n//| cache: banana\ndigraph { a -> b }\n```\n" } },
  { name: "{r} then {dot} + echo (handler in a knitr doc)", files: { "doc.qmd": FM + cell("r", null) + "```{dot}\n//| echo: banana\ndigraph { a -> b }\n```\n" } },
  { name: "{dot} alone + echo", files: { "doc.qmd": FM + "```{dot}\n//| echo: banana\ndigraph { a -> b }\n```\n" } },

  // ---- token shapes -------------------------------------------------------------------
  { name: "{r9} digit token + cache", files: { "doc.qmd": FM + cell("r9", "cache: banana") } },
  { name: "{r.foo} dotted token + cache", files: { "doc.qmd": FM + cell("r.foo", "cache: banana") } },
  { name: "{r.foo} dotted token + echo", files: { "doc.qmd": FM + cell("r.foo", "echo: banana") } },
  { name: "{r9} then a real {r} cell + cache on the {r}", files: { "doc.qmd": FM + cell("r9", null) + cell("r", "cache: banana") } },

  // ---- the twelve selectors S165's §9 review found it was DECLINING to read ------------
  // Each renders exit 0. Before L4 they were reported UNMATCHED, which let the language
  // fallback answer knitr document-wide and squiggle the non-r cells: twelve cardinal
  // false positives S165 introduced and then removed. They are the corpus's memory of it.
  { name: "REVIEW engine: &a markdown", files: { "doc.qmd": "---\ntitle: t\nengine: &a markdown\n---\n\n" + rThenPy } },
  { name: "REVIEW engine: *a alias", files: { "doc.qmd": "---\ntitle: t\nxx: &a markdown\nengine: *a\n---\n\n" + rThenPy } },
  { name: "REVIEW engine: >- folded body", files: { "doc.qmd": "---\ntitle: t\nengine: >-\n  markdown\n---\n\n" + rThenPy } },
  { name: "REVIEW engine: empty + continuation", files: { "doc.qmd": "---\ntitle: t\nengine:\n  markdown\n---\n\n" + rThenPy } },
  { name: "REVIEW nested execute:/engine: &a markdown", files: { "doc.qmd": "---\ntitle: t\nexecute:\n  engine: &a markdown\n---\n\n" + rThenPy } },
  { name: "REVIEW markdown: !!bool true", files: { "doc.qmd": "---\ntitle: t\nmarkdown: !!bool true\n---\n\n" + rThenPy } },
  { name: "REVIEW markdown: &a true", files: { "doc.qmd": "---\ntitle: t\nmarkdown: &a true\n---\n\n" + rThenPy } },
  { name: "REVIEW markdown: | + body", files: { "doc.qmd": "---\ntitle: t\nmarkdown: |\n  x\n---\n\n" + rThenPy } },
  { name: "REVIEW markdown: + column-0 sequence", files: { "doc.qmd": "---\ntitle: t\nmarkdown:\n- x\n---\n\n" + rThenPy } },
  { name: "REVIEW execute: *a mapping alias", files: { "doc.qmd": "---\ntitle: t\nxx: &a\n  engine: markdown\nexecute: *a\n---\n\n" + rThenPy } },
  { name: "REVIEW execute: &a + engine child", files: { "doc.qmd": "---\ntitle: t\nexecute: &a\n  engine: markdown\n---\n\n" + rThenPy } },
  { name: "REVIEW blank line BEFORE --- + engine: markdown", files: { "doc.qmd": "\n---\ntitle: t\nengine: markdown\n---\n\n" + rThenPy } },

  // ---- the neighbours a fix must NOT over-correct (quarto falls through to languages) --
  { name: "REVIEW engine: &a knitr (TP we give up)", files: { "doc.qmd": "---\ntitle: t\nengine: &a knitr\n---\n\n" + rThenPy } },
  { name: "REVIEW engine: | + literal body (TP we give up)", files: { "doc.qmd": "---\ntitle: t\nengine: |\n  markdown\n---\n\n" + rThenPy } },
  { name: "REVIEW engine: banana (must still fall through)", files: { "doc.qmd": "---\ntitle: t\nengine: banana\n---\n\n" + rThenPy } },
  { name: "REVIEW jupyter: false (must still fall through)", files: { "doc.qmd": "---\ntitle: t\njupyter: false\n---\n\n" + rThenPy } },

  // ---- quarto's validate-yaml escape hatch (S163) --------------------------------------
  // NEW at S166. The mirror S165 committed to its scratchpad never consulted the hatch, so
  // no corpus row could have caught the omission. These two rows close that hole: quarto
  // renders both exit 0, and a mirror that ignores the flag flags them.
  { name: "validate-yaml: false + {r} + cache", files: { "doc.qmd": "---\ntitle: t\nvalidate-yaml: false\n---\n\n" + cell("r", "cache: banana") } },
  { name: "per-cell #| validate-yaml: false + cache", files: { "doc.qmd": FM + "```{r}\n#| validate-yaml: false\n#| cache: banana\n1\n```\n" } },
];
