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
 * evidence about the documents IN it, not a property of the change. WHEN YOU TOUCH THE
 * ENGINE-SCOPING PATH, ADD THE SHAPES YOU TOUCHED before believing the number.
 *
 * S170 is the second instance of exactly that lesson, and the reason this sentence no
 * longer quotes a count: every row was a `.qmd` until then, so the `documentEngineForScoping`
 * branch keyed on the FILE EXTENSION sat entirely outside the horizon — a change to it ran
 * green over 66 documents none of which could observe it. (The count in this comment had
 * also been stale at "64" since the corpus reached 66, filed by S167 and unfixed until the
 * rows below made it staler still. `CORPUS.length` is the number; prose is not.)
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

/**
 * An INDENTED `{r}` cell (S178). The fence and its closer carry `indent`; the `#|` option
 * deliberately does NOT — quarto matches a cell option with `^#\s*\| ?` against the raw
 * line, so an indented option is not an option, which is the half we were already faithful
 * to. `closeIndent` defaults to the opener's, since quarto compares only backtick counts.
 */
const indentedCell = (indent: string, opt: string, closeIndent = indent): string =>
  indent + "```{r}\n#| " + opt + "\n1\n" + closeIndent + "```\n\n";

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

  // ---- the R-MARKDOWN extension: knitr for EVERY cell (S170) ---------------------------
  // NEW at S170, and the corpus-horizon warning at the top of this file is exactly why:
  // every row above this block is a `.qmd`, so the entire extension branch of
  // `documentEngineForScoping` was outside the oracle's horizon and a change to it scored
  // "0 regressed" over documents that could not observe it.
  //
  // `claimsFile` gives knitr the file by EXTENSION, in a loop that runs before quarto
  // partitions any front matter. The `{python}`-only shape is the discriminating one: its
  // own language fallback is jupyter, so a knitr verdict cannot have come from the languages.
  { name: ".Rmd {python} + cache", entry: "doc.Rmd", files: { "doc.Rmd": FM + cell("python", "cache: banana") } },
  { name: ".Rmd {python} + echo (agnostic control)", entry: "doc.Rmd", files: { "doc.Rmd": FM + cell("python", "echo: banana") } },
  { name: ".Rmd {python} + cache: true (VALID — must stay silent)", entry: "doc.Rmd", files: { "doc.Rmd": FM + cell("python", "cache: true") } },
  { name: ".rmd lowercase {python} + cache", entry: "doc.rmd", files: { "doc.rmd": FM + cell("python", "cache: banana") } },
  // `.Rmarkdown` is the third member of quarto's `kRmdExtensions` and the decision handles
  // it, but `package.json`'s `quarto` languageId registers only .qmd/.rmd/.Rmd — so today
  // this row measures a branch the editor never reaches. Filed in BACKLOG, not fixed here.
  { name: ".Rmarkdown {python} + cache", entry: "doc.Rmarkdown", files: { "doc.Rmarkdown": FM + cell("python", "cache: banana") } },
  { name: ".Rmd {r} + cache (unchanged — the language agreed already)", entry: "doc.Rmd", files: { "doc.Rmd": FM + cell("r", "cache: banana") } },
  { name: ".Rmd {sql} + cache", entry: "doc.Rmd", files: { "doc.Rmd": FM + cell("sql", "cache: banana", "--|") } },
  { name: ".Rmd {ojs} + cache", entry: "doc.Rmd", files: { "doc.Rmd": FM + cell("ojs", "cache: banana", "//|") } },
  // The handler carve-out, which must survive the widening: quarto swaps the cell schema by
  // LANGUAGE above every engine, so this renders exit 0 and flagging it would be the
  // cardinal sin this session could most easily have manufactured.
  { name: ".Rmd {dot} handler + cache (exempt)", entry: "doc.Rmd", files: { "doc.Rmd": FM + "```{dot}\n//| cache: banana\ndigraph { a -> b }\n```\n" } },
  // The three things that make OTHER documents' engines uncertain, none of which can reach
  // a `claimsFile` decision. Each is the `.Rmd` twin of a row (or an open BACKLOG item)
  // above, and each renders exit 1 where its `.qmd` counterpart does not.
  { name: ".Rmd engine: markdown + {python} + cache (the veto)", entry: "doc.Rmd", files: { "doc.Rmd": "---\ntitle: t\nengine: markdown\n---\n\n" + cell("python", "cache: banana") } },
  { name: ".Rmd include(child {julia}) + {python} + cache", entry: "doc.Rmd", files: { "doc.Rmd": FM + "{{< include child.qmd >}}\n\n" + cell("python", "cache: banana"), "child.qmd": cell("julia", null) } },
  { name: ".Rmd + _quarto.yml engines: [jupyter, knitr] + {python} + cache", entry: "doc.Rmd", files: { "doc.Rmd": FM + cell("python", "cache: banana"), "_quarto.yml": "project:\n  type: default\nengines: [jupyter, knitr]\n" } },

  // ---- S171: LEADING WHITESPACE before the opening `---` -------------------------------
  // The corpus already carried a row named "REVIEW blank line BEFORE --- + engine: markdown"
  // — and it was baselined `agree`, which read as "this shape is fine". It is not: that row
  // uses `rThenPy`, whose flagged cell is `{python}`, and the per-cell fallback answers
  // JUPYTER there, so `cache` was out of scope and we stayed silent for the wrong reason.
  // A row named after a defect is not a row that can observe it (the S170 lesson again, and
  // the third instance of this corpus's horizon warning).
  //
  // The `{r}` cell is what discriminates: its fallback answers knitr, so `cache: banana` is
  // flagged exactly when we failed to read the front matter. Quarto's ENGINE partitioner
  // runs `lines(markdown.trimLeft())` and reads it regardless.
  { name: "S171 blank line + engine: markdown + {r} + cache", files: { "doc.qmd": "\n---\ntitle: t\nengine: markdown\n---\n\n" + cell("r", "cache: banana") } },
  { name: "S171 blank line + NO engine + {r} + cache (must still flag)", files: { "doc.qmd": "\n" + FM + cell("r", "cache: banana") } },
  { name: "S171 blank line + engine: markdown + {r} + echo (agnostic control)", files: { "doc.qmd": "\n---\ntitle: t\nengine: markdown\n---\n\n" + cell("r", "echo: banana") } },
  { name: "S171 two blank lines + engine: markdown + {r} + cache", files: { "doc.qmd": "\n\n---\ntitle: t\nengine: markdown\n---\n\n" + cell("r", "cache: banana") } },
  { name: "S171 spaces-only line + engine: markdown + {r} + cache", files: { "doc.qmd": "   \n---\ntitle: t\nengine: markdown\n---\n\n" + cell("r", "cache: banana") } },
  { name: "S171 leading tab + engine: markdown + {r} + cache", files: { "doc.qmd": "\t---\ntitle: t\nengine: markdown\n---\n\n" + cell("r", "cache: banana") } },
  // `trimLeft` strips spaces and tabs as well as newlines, so an INDENTED opening `---` is
  // inside quarto's engine partitioner too — `"   ---".trimLeft()` is `"---"`, which matches
  // `kRegExBeginYAML`. Measured exit 0.
  { name: "S171 indented --- + engine: markdown + {r} + cache", files: { "doc.qmd": "   ---\ntitle: t\nengine: markdown\n---\n\n" + cell("r", "cache: banana") } },
  // ⚠ A PRE-EXISTING cardinal FP this session MEASURED but did not fix, and it has a
  // DIFFERENT root cause from the rows above. With an indented opener quarto's VALIDATION
  // partitioner (`breakQuartoMd`, whose `yamlRegEx` is anchored at column 0) never opens the
  // block, then opens one at the CLOSING `---` that never closes — so the `{r}` cell is
  // swallowed into an unterminated YAML region and NO cell is validated at all. Measured:
  // exit 0 even with the engine-agnostic `#| echo: banana`, which is the control proving
  // nothing ran. Our engine answer falls through to the languages (knitr) and we flag it.
  // Unchanged by this session — the pre-S171 build flags it identically. Filed in BACKLOG.
  { name: "S171 indented --- + NO engine + {r} + cache (KNOWN residual)", files: { "doc.qmd": "   " + FM + cell("r", "cache: banana") } },

  // ---- Session 172: quarto's fence-token grammar -------------------------------------
  //
  // `breakQuartoMd`'s recognizer captures the language as `([=A-Za-z]+)` and its option tail
  // must begin with a SPACE or a COMMA. A token that fails it is not a cell to quarto at all,
  // so nothing inside is validated and any bad value renders exit 0.
  //
  // ⚠ EVERY ROW BELOW USES THE ENGINE-AGNOSTIC `echo`, ON PURPOSE. The two pre-existing
  // digit-token rows above (`{r9} digit token + cache`, `{r9} then a real {r} cell...`) are
  // baselined `agree` for a mechanism that has NOTHING to do with cell recognition: `cache`
  // is knitr-only, `r9` is not counted as `r` by the language scan, so the document resolves
  // markdown and `cache` is out of scope whatever the scanner decides. They stayed silent for
  // the wrong reason and read as coverage — the FOURTH instance of this corpus's horizon
  // warning, and the third where a row was named after a defect it could not observe. With
  // `echo` the scope is the same under every engine, so the flag can only come from whether
  // we built a cell. Check the MECHANISM a row passes by, never its name (S171 gotcha 2).
  { name: "S172 {python3} digit token + echo", files: { "doc.qmd": FM + cell("python3", "echo: banana") } },
  { name: "S172 {fortran95} digit token + echo", files: { "doc.qmd": FM + cell("fortran95", "echo: banana", "!|") } },
  { name: "S172 {fortran} digit-free control + echo", files: { "doc.qmd": FM + cell("fortran", "echo: banana", "!|") } },
  { name: "S172 {r9} digit token + echo (the agnostic twin of the vacuous cache row)", files: { "doc.qmd": FM + cell("r9", "echo: banana") } },
  { name: "S172 {r-foo} hyphen token + echo", files: { "doc.qmd": FM + cell("r-foo", "echo: banana") } },
  { name: "S172 {r_foo} underscore token + echo", files: { "doc.qmd": FM + cell("r_foo", "echo: banana") } },
  // Truncation, not rejection: the old tail captured `r` here, so a single accent typo made a
  // cell indistinguishable from a real {r} to every consumer at once.
  { name: "S172 {ré} non-ASCII token + echo", files: { "doc.qmd": FM + cell("ré", "echo: banana") } },
  // quarto's tail is `( *[ ,].*)?` — the separator must be a space or a comma, never a tab.
  { name: "S172 {r<TAB>echo=FALSE} tab-separated token + echo", files: { "doc.qmd": FM + cell("r\techo=FALSE", "echo: banana") } },
  { name: "S172 {r=1} '=' then a digit + echo", files: { "doc.qmd": FM + cell("r=1", "echo: banana") } },
  // The other direction. These two render exit 1 and we were SILENT on both.
  { name: "S172 {mermaid=x} glued token + echo (quarto validates it)", files: { "doc.qmd": FM + cell("mermaid=x", "echo: banana") } },
  { name: "S172 {mermaid} bare handler + echo (stays exempt)", files: { "doc.qmd": FM + "```{mermaid}\n%%| echo: banana\nflowchart LR\n  A --> B\n```\n" } },
  // `[^}]*` cannot span the `}` inside the quoted value, so this WELL-FORMED knitr chunk
  // header was not a cell to us while quarto validates it. A lost TP on ordinary input.
  { name: "S172 {r, fig.cap=\"}\"} brace in a quoted option + echo", files: { "doc.qmd": FM + cell('r, fig.cap="}"', "echo: banana") } },
  // ⚠ A PRE-EXISTING lost true positive this session MEASURED but deliberately did not fix.
  // quarto's `[=A-Za-z]+` accepts a leading `=`, and it really does validate raw blocks:
  // measured exit 1 here, and exit 1 for knitr-only `cache` in a knitr document, so a raw
  // block takes the document engine's schema. We keep the letter-led rule because adopting
  // this WIDENS what we squiggle onto a new block class. Filed in BACKLOG; the guard is the
  // FP GUARD pin in test/unit/cells.test.ts and test/unit/yaml-value-flags.test.ts.
  { name: "S172 {=html} raw block + echo (KNOWN residual, lost TP)", files: { "doc.qmd": FM + "```{=html}\n#| echo: banana\n<p>x</p>\n```\n" } },

  // ---- Session 177: quarto's column-0 YAML delimiter ----------------------------------
  //
  // `breakQuartoMd`'s `yamlRegEx` is `/^---\s*$/` — anchored at COLUMN 0 and tested on EVERY
  // line, not only line 0 — and a fence builds a cell only when `inPlainText()` (`!inCodeCell
  // && !inCode && !inYaml`). So a column-0 `---` opens a YAML region that swallows every cell
  // below it until the next one, and NOTHING inside a region is validated. The one exemption
  // is `isYamlDelimiter`'s `skipHRs` arm — a `---` with a blank line BOTH above and below is a
  // thematic break — and it applies only when a region would OPEN, since `skipHRs` is passed
  // `!inYaml`.
  //
  // ⚠ EVERY ROW BELOW USES THE ENGINE-AGNOSTIC `echo`, for the S172 reason. The mechanism here
  // is cell PARTITIONING, so a knitr-only `cache` would let a row pass on the ENGINE answer
  // instead — silent because the document resolved markdown, not because we declined to build
  // a cell. With `echo` the scope is identical under every engine, so the flag can only come
  // from whether we validated a cell. The `cache` row S171 filed is kept above unchanged; this
  // block adds its agnostic twin rather than editing it.
  //
  // The first five renders exit 0 and we flagged every one of them — five cardinal false
  // positives with ONE root cause. The last six are the discriminating controls: each renders
  // exit 1, so any of them going silent is a lost true positive, not a safe simplification.
  { name: "S177 indented --- + {r} + echo (agnostic twin of the S171 cache row)", files: { "doc.qmd": "   " + FM + cell("r", "echo: banana") } },
  { name: "S177 setext-H2 --- above the cell + echo", files: { "doc.qmd": FM + "Heading text\n---\n\n" + cell("r", "echo: banana") } },
  { name: "S177 --- with a blank line ABOVE but text BELOW + echo", files: { "doc.qmd": FM + "para\n\n---\nmore text\n\n" + cell("r", "echo: banana") } },
  { name: "S177 --- inside an HTML COMMENT + echo", files: { "doc.qmd": FM + "<!--\n---\n-->\n\n" + cell("r", "echo: banana") } },
  { name: "S177 --- inside a ~~~ TILDE fence + echo", files: { "doc.qmd": FM + "~~~\n---\n~~~\n\n" + cell("r", "echo: banana") } },
  // The controls. A blank-surrounded `---` is a horizontal rule and validation continues.
  { name: "S177 CONTROL blank-surrounded --- (a true HR) + echo", files: { "doc.qmd": FM + "para\n\n---\n\n" + cell("r", "echo: banana") } },
  // Nothing sits at column 0 anywhere, so no region ever opens — the mechanism is the CLOSING
  // delimiter, not the indented opener.
  { name: "S177 CONTROL indented --- with NO closing --- + echo", files: { "doc.qmd": "   ---\ntitle: t\n\n" + cell("r", "echo: banana") } },
  { name: "S177 CONTROL region opens and CLOSES above the cell + echo", files: { "doc.qmd": FM + "para\n---\nk: v\n---\n\n" + cell("r", "echo: banana") } },
  { name: "S177 CONTROL --- inside a ``` fence + echo", files: { "doc.qmd": FM + "```\n---\n```\n\n" + cell("r", "echo: banana") } },
  { name: "S177 CONTROL --- inside an {r} cell body + echo", files: { "doc.qmd": FM + "```{r}\n---\n1\n```\n\n" + cell("r", "echo: banana") } },
  { name: "S177 CONTROL cell ABOVE a later --- + echo", files: { "doc.qmd": FM + cell("r", "echo: banana") + "para\n---\nmore\n" } },
  // Added by S177's adversarial pass. The exemption is asymmetric — `skipHRs` is `!inYaml`
  // — so this closer is a delimiter even with blank lines on BOTH sides of it, and the cell
  // below is validated (measured exit 1). Before this row, a mutant that applied the HR
  // exemption when CLOSING too killed no DOCUMENT-level test, only a scanner pin.
  { name: "S177 CONTROL blank-surrounded --- CLOSING the front matter + echo", files: { "doc.qmd": "---\ntitle: t\n\n---\n\n" + cell("r", "echo: banana") } },

  // ---- S178: an INDENTED cell fence is a cell to quarto -------------------------------
  //
  // `breakQuartoMd`'s cell opener is `^\s*(```+)\s*\{([=A-Za-z]+)( *[ ,].*)?\}\s*$` and its
  // closer `^\s*(```+)\s*$` — leading whitespace UNBOUNDED and tabs included — where
  // CommonMark's fence rule, and so our `FENCE_OPEN`/`FENCE_CLOSE`, caps it at 3 spaces. So
  // an indented cell was validated by quarto and invisible to us: lost true positives.
  //
  // As with the S172 and S177 blocks, every row uses the engine-AGNOSTIC `echo` rather than
  // the knitr-only `cache`: the mechanism here is cell PARTITIONING, so a `cache` row could
  // pass on the ENGINE answer instead of on whether we built a cell. That risk is REAL here
  // and not theoretical — quarto's engine scan `languagesInMarkdown` opens `^[\t >]*`, so it
  // has ALWAYS counted indented cells. Our engine answer was therefore already right on
  // these documents while our cell partitioning was wrong, and only `echo` can see that.
  //
  // The first six render exit 1 and we flagged none of them. The last four are the
  // discriminating controls: each must stay silent (or, for the plain-fence row, must still
  // flag), so a row going the other way is a real defect and not a safe simplification.
  { name: "S178 4-space indented {r} cell + echo", files: { "doc.qmd": FM + indentedCell("    ", "echo: banana") } },
  { name: "S178 TAB indented {r} cell + echo", files: { "doc.qmd": FM + indentedCell("\t", "echo: banana") } },
  { name: "S178 8-space indented {r} cell + echo", files: { "doc.qmd": FM + indentedCell("        ", "echo: banana") } },
  // The closer's indent need not match the opener's — quarto's `endCodeRegEx` compares only
  // the BACKTICK COUNT. Both directions measured.
  { name: "S178 4-space cell with a COLUMN-0 closer + echo", files: { "doc.qmd": FM + indentedCell("    ", "echo: banana", "") } },
  { name: "S178 8-space cell with a 2-space closer + echo", files: { "doc.qmd": FM + indentedCell("        ", "echo: banana", "  ") } },
  // The closer at DOCUMENT level: if an indented cell never closes it swallows what follows,
  // which is how this session's first pin went green for the wrong reason. Here the FIRST
  // cell's value is valid and the SECOND cell's is not, so a flag can only come from the
  // first cell having ended.
  { name: "S178 indented cell then a column-0 cell + echo on the SECOND", files: { "doc.qmd": FM + indentedCell("    ", "echo: false") + cell("r", "echo: banana") } },
  // Quarto reads a cell option only at COLUMN 0 (`^#\s*\| ?` against the raw line), so an
  // indented option is not an option at all — measured exit 0. We were already faithful
  // here, and this row is what keeps the fence widening from dragging the option half with
  // it.
  { name: "S178 CONTROL 4-space fence with a 4-space option + echo", files: { "doc.qmd": FM + "    ```{r}\n    #| echo: banana\n    1\n    ```\n\n" } },
  // ⚠ THE CARDINAL-SIN GUARD. `breakQuartoMd` flushes an unclosed fence's lines as MARKDOWN,
  // so quarto builds no code cell and validates nothing — measured exit 0. Opening one anyway
  // is a false positive on a document quarto ACCEPTS, and it is what this session's own first
  // implementation did before this row's unit twin caught it.
  { name: "S178 CONTROL UNTERMINATED 4-space indented fence + echo", files: { "doc.qmd": FM + "para\n\n    ```{r}\n#| echo: banana\n1\n" } },
  { name: "S178 CONTROL 4-space indented cell, VALID value", files: { "doc.qmd": FM + indentedCell("    ", "echo: false") } },
  // Quarto's PLAIN fence opener is `^```` — column 0 — so an indented plain fence is not a
  // fence to it either, and the real cell below is still validated (measured exit 1). This is
  // the row that fails if the widening is applied to plain fences instead of cells only.
  { name: "S178 CONTROL indented PLAIN fence above a real cell + echo", files: { "doc.qmd": FM + "    ```\n    text\n    ```\n\n" + cell("r", "echo: banana") } },
];
