/**
 * Quarto's DOCUMENT ENGINE, as far as a document's own front matter determines it.
 *
 * Quarto scopes a cell's option schema to the engine of the whole DOCUMENT, never to
 * the cell's language. Read from the render path in `bin/quarto.js` (1.7.33):
 *
 * ```js
 * // render → validateDocument → validateDocumentFromSource(target.markdown, engine.name)
 * //        → partitionCellOptionsMapped(lang, cell.sourceWithYaml, true, engine)
 * let schema = engineOptionsSchema[engine];      // markdown | knitr | jupyter | julia
 * ```
 *
 * and each of those four schemas is the `cell-*` field set filtered by the field's own
 * `tags.engine` (`makeEngineSchema`) — which is exactly the filter `SchemaIndex.cellOptions`
 * already implements. So the only thing this extension was missing is the ENGINE NAME.
 */

import { unquote } from "./yaml-value-check";

/** The four engines quarto can resolve a document to (`registerExecutionEngine`). */
export type DocumentEngine = "knitr" | "jupyter" | "markdown" | "julia";

/** Quarto's own key for the override, at the top level and under `execute:` alike. */
const ENGINE_KEY = "engine";

/** The execute-defaults container the override may also live under. */
const EXECUTE_KEY = "execute";

const ENGINE_NAMES: ReadonlySet<string> = new Set([
  "knitr",
  "jupyter",
  "markdown",
  "julia",
]);

/**
 * A top-level front-matter mapping line, as `findFrontMatterTopLevelLines` emits it.
 *
 * `hasChildren` is REQUIRED on purpose. It was optional in L5 "so the value-only view also
 * satisfies this shape", and the §9 completeness critic showed what that latitude actually
 * bought: `findFrontMatterValueLines` — imported on the adjacent line of the sole call site —
 * type-checks here silently, and passing it un-ships the container form, restoring the very
 * cardinal-sin false positive L5 exists to remove, with `tsc` and the whole suite green.
 * Requiring the field turns that call into a compile error.
 */
interface TopLevelScalar {
  key: string;
  rawToken: string;
  hasChildren: boolean;
}

/** A nested front-matter scalar, as `findNestedFrontMatterValueLines` emits it. */
interface NestedScalar {
  parentPath: readonly string[];
  key: string;
  rawToken: string;
}

/**
 * The engine this document's front matter selects — or `"ambiguous"` when it selects more
 * than one, or `undefined` when it selects none (the caller then keeps its per-cell
 * language approximation).
 *
 * ## Quarto's rule, transcribed
 *
 * ```js
 * for (const [_, engine] of reorderedEngines) {          // knitr, jupyter, markdown, julia
 *   if (yaml[engine.name]) return engine;                //   a truthy top-level `<name>:` key
 *   const format = metadataAsFormat(yaml);
 *   if (format.execute?.[kEngine] === engine.name) return engine;   //   `engine:` / `execute.engine:`
 * }
 * ```
 *
 * so there are THREE spellings of one override, all read from the document's own RAW front
 * matter: a top-level `engine: <name>`, the same key under `execute:` (quarto folds the
 * top-level one into `format.execute.engine` — `kEngine` ∈ `kExecuteDefaultsKeys`), and a
 * truthy top-level key literally NAMED after an engine (`jupyter: python3` is the common
 * real-world spelling — it pins a kernel AND selects the engine).
 *
 * Every row below is grounded firsthand vs quarto 1.7.33, one `quarto render --no-execute`
 * each, in a document whose `{r}` cell carries `#| cache: banana` — `cache` is knitr-only, so
 * the same document renders **exit 1** when knitr is resolved and **exit 0** when it is not:
 *
 * | front matter | resolves | renders |
 * |---|---|---|
 * | *(none)* | knitr, from the `{r}` language | exit 1 |
 * | `engine: markdown` | markdown | exit 0 |
 * | `execute:` / `  engine: markdown` | markdown | exit 0 |
 * | `jupyter: python3` | jupyter | exit 0 |
 * | `markdown: true` | markdown | exit 0 |
 * | `engine: "markdown"` / `'markdown'` | markdown | exit 0 |
 * | `engine: markdown # why` | markdown | exit 0 (the enumerator drops the comment) |
 * | `engine: MARKDOWN`, `Engine: markdown` | *(nothing — case-SENSITIVE)* | exit 1 |
 * | `engine: banana` | *(nothing; not itself a schema error)* | exit 1 |
 * | `format:` / `  html:` / `    engine: markdown` | *(nothing — not top-level)* | exit 1 |
 * | `engine: markdown` in `_quarto.yml` / `_metadata.yml` | *(nothing)* | exit 1 |
 *
 * The last two rows are the important negatives: unlike `validate-yaml` (whose gate reads
 * RESOLVED metadata), engine resolution runs on the file's own front matter **before** any
 * project or per-format merge, so `_quarto.yml`, `_metadata.yml` and `format:` sub-keys do
 * not reach it. Reading the override from any of them would silence a validated document.
 *
 * ## Why two disagreeing selectors return `"ambiguous"` instead of a guess
 *
 * Quarto's answer is order-dependent in two ways — and, contrary to an earlier revision of
 * this comment, only ONE of them is invisible to us:
 *
 *  - **Key order.** `metadataAsFormat` assigns into `format.execute` while walking
 *    `Object.keys(metadata)`, so the LAST writer wins. Measured, the same two keys in
 *    opposite orders give opposite answers: `engine: markdown` then `execute:`/`  engine:
 *    knitr` renders **exit 1** (knitr won), and `execute:`/`  engine: knitr` then
 *    `engine: markdown` renders **exit 0** (markdown won). Document order IS visible to us —
 *    the enumerators emit in it — so this half could in principle be modelled. It is not,
 *    because the second half cannot be, and modelling one of two interacting orderings buys
 *    a confident answer that the other can still invalidate (S164 §9 review).
 *  - **Project reordering.** `reorderEngines` puts `_quarto.yml`'s `engines:` list at the
 *    front of the loop. Measured: with `engines: [jupyter, knitr]` a document carrying both
 *    `engine: knitr` and `jupyter: python3` flips from exit 0 to exit 1. We never read
 *    `_quarto.yml` on a `.qmd` pass, so that reorder is genuinely invisible here.
 *
 * Guessing wrong in the knitr direction is the cardinal sin (below), so a set with more than
 * one member declines to answer and the caller narrows to the engine-agnostic intersection.
 *
 * **One VISIBLE member is not the same as one member.** A selector line we can see but not
 * resolve — an `engine:`/`execute.engine` whose value names no engine, or a flow
 * `execute: {…}` whose members no enumerator emits — still participates in that
 * last-writer-wins assignment, and can leave quarto selecting NOTHING where we resolved one
 * name. Measured, every one of `engine: knitr` + `execute:`/`  engine: Knitr` (a mere case
 * typo), + `execute:`/`  engine: banana`, and + `execute: {engine: markdown}` renders
 * **exit 0** with a `{python}` cell's `#| cache: banana`, against the agnostic control at
 * exit 1 and `engine: knitr` alone at exit 1. So an unresolved selector forces `"ambiguous"`
 * too — but only when something else DID resolve: with nothing resolved, `undefined` is
 * already quarto's own answer (`execute:`/`  engine: banana` alone renders exit 0 on a
 * `{python}` cell, and `engine: banana` alone renders exit 1 on an `{r}` cell — both are the
 * language fallback, which is exactly what `undefined` selects).
 *
 * ## Which mistakes are dangerous, swept rather than assumed
 *
 * The installed 1.7.33 resource declares **97** `cell-*` fields; this extension's parser keeps
 * 94 of them, and 43 of those are ones it can actually flag (`isWrongValue("banana", field)`;
 * the rest are open-valued and never fire whatever scope is used — the S162 `layout` / S163
 * 170-key lesson). Of those 43:
 *
 * - `cellOptions("knitr")` → **43**
 * - `cellOptions("jupyter")` = `cellOptions("ojs")` = `cellOptions("unknown")` → **23**,
 *   the identical set — every jupyter-tagged cell field (`tags`, `id`, `export`, `context`)
 *   is open-valued, so jupyter adds nothing this feature can flag
 *
 * So exactly one answer WIDENS what we squiggle: **knitr**, by 20 fields (`cache`,
 * `collapse`, `fig-width`, `message`, `results`, …). Every other answer — jupyter, markdown,
 * julia, `"ambiguous"` — yields the same 23-field agnostic set, so getting it wrong costs a
 * lost true positive and can never cost a false positive. The whole safety story of this
 * module is therefore: *never claim knitr wrongly.* That is why the falsy table below is
 * measured rather than reasoned, and why an unrecognized spelling always declines.
 *
 * The stronger form of the same check, run against quarto's own filter rather than reasoned
 * from the tags: for each of the four engines, take quarto's `makeEngineSchema` rule (keep a
 * field iff `tags.engine` is absent, equals the engine, or is a list containing it) over the
 * raw resource, and set-diff it against `cellOptions(scope)` restricted to the 43 flaggable
 * fields. All four agree EXACTLY — no field we would flag that quarto would not, and none
 * quarto flags that we would not. The restriction to flaggable fields is what makes that
 * true: unrestricted, `"unknown"` is a strict superset by the multi-engine-tagged
 * `tbl-colwidths` (see `cellOptionScopeFor`).
 *
 * ## What it does NOT see — and why a MISS is not automatically harmless
 *
 * A raw token carrying a YAML node property is not matched: `engine: &a markdown`,
 * `engine: !!str markdown` and an alias `engine: *a` all leave this `undefined`, and so do the
 * FLOW spellings of the same override (`execute: {engine: markdown}` renders exit 0 —
 * measured — and no enumerator here emits a flow-mapping member), and an engine-named key
 * whose body is a COLUMN-0 sequence (`markdown:` then `- x`, also measured exit 0).
 *
 * **An earlier revision of this section called every miss safe. That is wrong**, and the S164
 * §9 review was right to say so. A miss returns the caller to the per-cell language
 * approximation, which for an `{r}` cell is knitr — so missing a NARROWING override
 * (markdown/jupyter/julia) leaves the very false positive this module exists to remove. What
 * is true is the weaker, still-useful statement: a miss never makes things WORSE than the
 * pre-S164 tree, because that tree always used the language. Each missed spelling above is
 * filed with its measurement.
 *
 * The one place a raw-token read could actively manufacture a wrong answer is the
 * engine-NAMED key, because there the test is TRUTHINESS rather than name equality — an
 * unresolved `knitr: !!bool false` reads as a truthy string. `isTruthyNode` declines on node
 * properties for exactly that reason; see its docstring for the measurements.
 */
export function documentEngineForScoping(
  fileName: string,
  topLevel: readonly TopLevelScalar[],
  nested: readonly NestedScalar[],
  frontMatterContentLines: readonly string[] | null,
  text: string,
): DocumentEngine | "ambiguous" | undefined {
  if (isRMarkdownFileName(fileName)) {
    return undefined; // knitr claimed the file by EXTENSION; the front matter never runs
  }
  if (engineResolverSeesFrontMatter(frontMatterContentLines)) {
    const selected = new Set<DocumentEngine>();
    // A selector line we can SEE but cannot RESOLVE. Quarto's last-writer-wins assignment into
    // `format.execute.engine` means such a line can overwrite one we did resolve, so answering
    // from the readable half alone would be a confident wrong answer, not a partial one.
    //
    // The two kinds are only equivalent while something ELSE resolved (both force
    // `"ambiguous"`). With nothing resolved they part company, and S165 L2 is that split:
    //
    // - UNMATCHED — we read the value and it names no engine (`engine: banana`, or the case
    //   typo `engine: MARKDOWN`). Quarto's loop matches nothing either and falls through to
    //   the LANGUAGES, so following it is not a guess, it is the same computation. Measured,
    //   `engine: banana` + an `{r}` cell's `#| cache: banana` renders exit 1 (knitr, from the
    //   language) and the same document with a `{julia}` cell first renders exit 0.
    // - UNREADABLE — the value exists and we cannot see it (a FLOW `execute: {…}`, whose
    //   members no enumerator emits). Quarto CAN see it and may well have selected on it:
    //   measured, `execute: {engine: markdown}` + `{r}` + `#| cache: banana` renders **exit 0**
    //   (control `#| echo: banana`: exit 1). Falling back to the languages there would answer
    //   knitr and squiggle a document quarto ACCEPTS — a cardinal-sin false positive this
    //   session would have MANUFACTURED, not inherited. So it declines.
    let unmatchedSelector = false;
    let unreadableSelector = false;
    for (const fm of topLevel) {
      if (fm.key === ENGINE_KEY) {
        const named = engineNamed(fm.rawToken);
        if (named !== undefined) {
          selected.add(named);
        } else {
          unmatchedSelector = true;
        }
      } else if (fm.key === EXECUTE_KEY && fm.rawToken.startsWith("{")) {
        unreadableSelector = true; // a FLOW `execute: {…}` — its members are not enumerated
      } else if (ENGINE_NAMES.has(fm.key) && isTruthyNode(fm.rawToken, fm.hasChildren)) {
        selected.add(fm.key as DocumentEngine);
      }
    }
    for (const ns of nested) {
      // The depth clause is DEFENCE-IN-DEPTH, not a live branch: `findNestedFrontMatterValueLines`
      // never emits anything deeper than `["execute"]` under `execute:` (pinned in the unit
      // suite), so no input reaches it today. It is kept because the enumerator's allow-list is
      // the only thing making that true, and `format:`-nested paths ARE emitted at length 2.
      if (ns.parentPath.length === 1 && ns.parentPath[0] === EXECUTE_KEY && ns.key === ENGINE_KEY) {
        const named = engineNamed(ns.rawToken);
        if (named !== undefined) {
          selected.add(named);
        } else {
          unmatchedSelector = true;
        }
      }
    }
    if (selected.size > 0) {
      const oneAnswer = selected.size === 1 && !unmatchedSelector && !unreadableSelector;
      return oneAnswer ? [...selected][0] : "ambiguous";
    }
    if (unreadableSelector) {
      return undefined; // quarto may have selected on a value we cannot see — never guess
    }
  }
  // Nothing in the front matter selected an engine, so quarto resolves it from the document's
  // own cell languages — and so do we (S165).
  return languageFallbackEngine(text);
}

/**
 * Quarto's LANGUAGE fallback: the engine a document gets when its front matter names none.
 *
 * This is the branch `markdownExecutionEngine` reaches after the yaml loop finds nothing —
 * the ordinary case for the overwhelming majority of real documents, and until S165 the one
 * this extension approximated per CELL rather than per DOCUMENT:
 *
 * ```js
 * const languages = languagesInMarkdown(markdown);          // a Set, in first-appearance order
 * for (const language of languages)
 *   for (const [_, engine] of reorderedEngines)             // knitr, jupyter, markdown, julia
 *     if (engine.claimsLanguage(language)) return engine;   // knitr↔"r", jupyter↔"julia",
 *                                                           // markdown↔nothing, julia↔"julia"
 * for (const language of languages)
 *   if (language !== "ojs" && !handlerLanguages.includes(language)) return jupyterEngine;
 * return markdownEngine;
 * ```
 *
 * Measured firsthand vs 1.7.33 — `cache` is knitr-only and closed-valued, so `#| cache: banana`
 * renders **exit 1** iff quarto resolved knitr, with the engine-agnostic `#| echo: banana` as
 * the control proving cell validation ran at all:
 *
 * | document | resolves | renders |
 * |---|---|---|
 * | `{r}` | knitr | exit 1 |
 * | `{julia}` then `{r}` (`cache` on the `{r}` cell) | jupyter | **exit 0** ← the FP removed |
 * | `{r}` then `{julia}` | knitr | exit 1 |
 * | `{r}` then `{python}` (`cache` on the `{python}` cell) | knitr | **exit 1** ← the TP gained |
 * | `{python}` then `{r}` (`cache` on the `{python}` cell) | knitr | exit 1 |
 * | `{r}` then `{sql}` / `{ojs}` (`cache` on the second cell) | knitr | exit 1 |
 * | `{python}` alone, `{sql}` alone, `{ojs}` alone | jupyter / jupyter / markdown | exit 0 |
 *
 * So the change cuts BOTH ways, and only one of the two directions is dangerous: answering
 * knitr is the single answer that WIDENS what this feature squiggles (43 flaggable fields
 * against 23 for every other engine — see the module header). Everything below is about the
 * shapes where a naive reading would claim knitr and quarto would not.
 *
 * ## Why this does NOT walk `findAllCells`
 *
 * The obvious implementation — ask the model for the document's cells and read their
 * languages — is measurably WRONG, in the cardinal direction. Quarto's `languagesInMarkdown`
 * is a context-FREE regex over the whole file: it has no notion of fence nesting, blockquotes,
 * indented code, HTML comments or front matter, and it counts every line that looks like a
 * cell fence. Our scanner, correctly, does not. Each row below is a `{julia}` fence that
 * quarto counts and `findAllCells` does not, in a document whose only real cell is an `{r}`
 * one carrying `#| cache: banana` — every one renders **exit 0**, i.e. quarto resolved jupyter,
 * while a cell-list reading would have answered knitr and squiggled it:
 *
 * | the `{julia}` fence sits in… | renders |
 * |---|---|
 * | a ```` ```` ````-fenced example block | exit 0 |
 * | a `>` blockquote | exit 0 |
 * | a 3-space-indented fence | exit 0 |
 * | a 4-space indented-code block | exit 0 |
 * | an HTML comment | exit 0 |
 * | a front-matter block scalar | exit 0 |
 *
 * (Controls: the same six documents with `#| echo: banana` render exit 1, so validation ran;
 * the same document without the `{julia}` fence renders exit 1, so knitr is the fallback.)
 * Transcribing quarto's regex is therefore not a stylistic preference — it is what makes our
 * language set equal to quarto's on the same text, by construction rather than by luck.
 */
function languageFallbackEngine(text: string): DocumentEngine | undefined {
  if (INCLUDE_SHORTCODE.test(text)) {
    return undefined; // the text quarto resolves against is not the text we have — see below
  }
  return engineFromLanguages(languagesInMarkdown(text));
}

/**
 * An `{{< include >}}` shortcode makes the document's language set UNKNOWABLE from this file
 * alone, so the fallback declines and the caller keeps its per-cell language approximation.
 *
 * `fileExecutionEngine` resolves the engine from `project.resolveFullMarkdownForFile(...)`,
 * which runs `expandIncludes` FIRST (the include handler is the one directive whose stage is
 * `pre-engine`), so the markdown quarto counts languages in is the include-EXPANDED text.
 * Measured firsthand, and it flips the answer in BOTH directions:
 *
 * | document | renders | vs the same document with the include removed |
 * |---|---|---|
 * | `{{< include child >}}` (child has `{julia}`) then `{r}` + `cache` | **exit 0** | exit 1 |
 * | `{{< include child >}}` (child has `{r}`) then `{python}` + `cache` | **exit 1** | exit 0 |
 * | `{r}` + `cache` then `{{< include child >}}` (child has `{julia}`) | exit 1 | — |
 * | nested: doc → child → grandchild with `{julia}`, then `{r}` + `cache` | **exit 0** | — |
 *
 * (Control on the first row: the same document with `#| echo: banana` renders exit 1.)
 * The third row is the one that makes a "just ignore includes" reading unsafe rather than
 * merely incomplete: position matters, so we cannot even bound the answer without reading the
 * included files. Declining costs the true positives this fallback would otherwise recover on
 * such a document; it cannot cost a false positive, because `undefined` restores exactly the
 * behaviour this extension already had. Reading the included files is a filesystem capability
 * a pure diagnostics pass does not have (the same gap BACKLOG's `_quarto.yml`-from-a-`.qmd`
 * item describes), so it is filed rather than guessed at.
 *
 * The test is deliberately LOOSER than quarto's own `isBlockShortcode`, which requires the
 * shortcode to be alone on its line (`^\s*{{< (.+?) >}}\s*$`): over-detecting only declines
 * more often, which is the safe direction, while under-detecting would re-open the false
 * positive above.
 */
const INCLUDE_SHORTCODE = /\{\{<\s*include\b/;

/**
 * Quarto's `languagesInMarkdown`, transcribed from the installed 1.7.33 — a fact about
 * another tool's dispatch, not expression (Learning #25, the same basis as the curated schema
 * names and the comment-char table):
 *
 * ```js
 * const kChunkRegex = /^[\t >]*```+\s*\{([a-zA-Z0-9_]+)( *[ ,].*)?\}\s*$/gm;
 * ```
 *
 * Every clause earns its place, and each was measured rather than assumed (the probe is a
 * `{julia}` fence of the given shape ahead of an `{r}` cell carrying `#| cache: banana`, so
 * **exit 0** means the fence WAS counted as a language and exit 1 means it was not):
 *
 * - `[\t >]*` — a tab-, space- or `>`-prefixed fence still counts (exit 0 for all three).
 * - ```` ```+ ```` — four backticks count too (exit 0).
 * - `\s*` before `{` — ```` ``` {julia} ```` counts (exit 0), but a space INSIDE the braces
 *   (`{ julia }`) does not (exit 1).
 * - `[a-zA-Z0-9_]+` — DIGITS are allowed here, unlike quarto's *cell* recognizer
 *   (`([=A-Za-z]+)` in `breakQuartoMd`). So `{r9}` is a LANGUAGE but not a CELL: measured,
 *   `{r9}` + `#| cache: banana` renders exit 0 (nothing in it is validated) while `{r9}`
 *   followed by a real `{r}` cell renders exit 1. Conversely `{r.foo}` matches NEITHER
 *   recognizer — exit 0 for both `cache:` and `echo:` — though our own `CELL_INFO` does admit
 *   it as an `{r}` cell (the fence-token divergence BACKLOG already tracks); resolving the
 *   engine from the raw text rather than from the cell list is what keeps that divergence out
 *   of the engine answer.
 * - `( *[ ,].*)?` then `\s*$` — knitr's attribute forms (`{r, echo=FALSE}`, `{r echo=FALSE}`)
 *   count, but trailing text after the closing brace (```` ```{julia} x ````) does not
 *   (exit 1).
 * - `.toLowerCase()` — `{R}` selects knitr (measured exit 1 on `#| cache: banana`).
 *
 * The Set preserves FIRST-APPEARANCE order, which is the whole reason the answer is
 * order-dependent, and the regex is built per call because a `/g` regex carries `lastIndex`
 * across calls (quarto resets it twice by hand for the same reason).
 */
function languagesInMarkdown(text: string): string[] {
  const fenceLanguage = /^[\t >]*```+\s*\{([a-zA-Z0-9_]+)( *[ ,].*)?\}\s*$/gm;
  const languages: string[] = [];
  let match = fenceLanguage.exec(text);
  while (match !== null) {
    const language = match[1].toLowerCase();
    if (!languages.includes(language)) {
      languages.push(language);
    }
    match = fenceLanguage.exec(text);
  }
  return languages;
}

/**
 * Quarto's cell-HANDLER languages as the ENGINE resolver sees them — `languages()`, the
 * entries of the CLI's own `handlers` registry whose `type` is `"cell"`, which in 1.7.33 are
 * exactly `mermaid` (`type: "cell"`, `stage: "post-engine"`) and `dot` (likewise).
 *
 * This is a SECOND copy of a list `yaml-context.ts` also holds (`CELL_HANDLER_LANGUAGES`), and
 * the duplication is deliberate: they are two DIFFERENT quarto sources that happen to agree.
 * That one transcribes the `handlers/languages.yml` resource, which the VALIDATION path reads
 * to swap a cell's schema; this one transcribes the CLI-side handler registry, which the
 * ENGINE path reads to decide whether a language forces jupyter. Sharing one constant would
 * assert an equivalence quarto does not guarantee — and `document-engine.ts` cannot import
 * `yaml-context.ts` in any case, since that module imports THIS one. Cross-referenced in both
 * files so neither side rediscovers the pair.
 */
const HANDLER_CELL_LANGUAGES: ReadonlySet<string> = new Set(["mermaid", "dot"]);

/**
 * Quarto's two language loops, in order. Returns an engine for every input, including the
 * empty one — a document with no cell fences at all resolves to `markdownEngine`.
 *
 * `julia` maps to **jupyter**, not to the julia engine, because `jupyterEngine.claimsLanguage`
 * also answers `"julia"` and jupyter is registered ahead of julia, so jupyter wins the inner
 * loop. A project-level `engines:` list can reorder that (`engines: [julia, knitr]` really
 * does hand the document to the julia engine — measured, it gets as far as trying to spawn
 * `julia`), but the two answers are indistinguishable HERE: `cellOptionScopeFor` maps jupyter
 * and julia to sets that agree on every field this feature can flag.
 *
 * **The project `engines:` list cannot change the knitr answer at all**, which is why this
 * fallback does not need to read `_quarto.yml` the way the front-matter path would (the
 * override path returns `"ambiguous"` for exactly that reason). Knitr is the ONLY engine that
 * claims `r`, and `r` is the only language it claims, so no reordering can give an `r`-first
 * document to another engine, nor a `julia`-first document to knitr. Measured:
 * `engines: [jupyter, knitr]` and `engines: [markdown]` both still render an `{r}` document's
 * `#| cache: banana` exit 1, and `engines: [julia, knitr]` on a `{julia}`-then-`{r}` document
 * raises a julia-engine error with NO `cache` diagnostic — i.e. julia, not knitr. (That last
 * probe exits 1 for an unrelated reason, `Failed to spawn 'julia'`; its exit CODE says nothing
 * and only its text does.)
 */
function engineFromLanguages(languages: readonly string[]): DocumentEngine {
  for (const language of languages) {
    if (language === "r") {
      return "knitr"; // knitrEngine.claimsLanguage — the only engine that claims it
    }
    if (language === "julia") {
      return "jupyter"; // jupyterEngine.claimsLanguage, registered ahead of juliaEngine
    }
  }
  for (const language of languages) {
    if (language !== "ojs" && !HANDLER_CELL_LANGUAGES.has(language)) {
      return "jupyter";
    }
  }
  return "markdown";
}

/**
 * Whether quarto's ENGINE partitioner would see this front matter at all.
 *
 * Quarto runs two different partitioners over the same document, and S164 originally wired
 * the permissive one into engine selection. YAML VALIDATION uses `breakQuartoMd`, which only
 * needs the block to open and close with `---`. ENGINE selection uses
 * `partitionYamlFrontMatter`, which rejects more:
 *
 * ```js
 * const mdLines = lines(markdown.trimLeft());
 * if (mdLines.length < 3 || !mdLines[0].match(kRegExBeginYAML)) return null;
 * else if (mdLines[1].trim().length === 0 || mdLines[1].match(kRegExEndYAML)) return null;
 * ```
 *
 * so a block whose FIRST content line is blank selects no engine, and quarto falls back to
 * the cell languages. Measured: `---` / blank / `knitr: true` / `---` with a `{python}` cell's
 * `#| cache: banana` renders **exit 0**, while the engine-agnostic `#| echo: banana` on the
 * same front matter renders exit 1 (so cell validation really ran) and the identical document
 * WITHOUT the blank line renders exit 1 (so knitr really is selected there).
 *
 * Only ENGINE resolution takes this narrower view. The value surfaces keep the permissive
 * region deliberately — `---` / blank / `toc: banana` / `---` still renders exit 1, so
 * flagging it is a true positive — which is why the test lives here and not in the scanner.
 *
 * ⚠ **The mirror skew is a LIVE false positive, not a harmless one** — an earlier revision of
 * this docstring said it "only ever costs an override we fail to honour, never a wrong one",
 * which is the same false universal the module header retracts above, and the §9 completeness
 * critic caught it here. Quarto `trimLeft()`s the document first, so a blank line BEFORE the
 * opening `---` still gives QUARTO a front matter while `scanRegions` (which opens front
 * matter only at line 0) gives us none. Measured: a leading blank line, then `---` /
 * `title: t` / `engine: markdown` / `---`, then an `{r}` cell with `#| cache: banana` renders
 * **exit 0** — with `#| echo: banana` at exit 1 proving validation ran, and the `engine:` line
 * removed at exit 1 proving knitr is the fallback — while we resolve no engine, scope the cell
 * to knitr by language, and squiggle it. The false positive is PRE-EXISTING (the pre-S164 tree
 * reached knitr through the language too) and this guard neither creates nor widens it, but it
 * is real and it is filed. Closing it means teaching the scanner quarto's `trimLeft`, which
 * changes every front-matter surface and so belongs in its own deliverable.
 */
function engineResolverSeesFrontMatter(contentLines: readonly string[] | null): boolean {
  return contentLines !== null && contentLines.length > 0 && contentLines[0].trim().length > 0;
}

/**
 * Quarto's `kRmdExtensions` — the extensions knitr claims OUTRIGHT, in `claimsFile`, which
 * `fileExecutionEngine` consults for every engine BEFORE it partitions any front matter:
 *
 * ```js
 * for (const [_, engine] of reorderedEngines) if (engine.claimsFile(file, ext)) return engine;
 * if (kMdExtensions.includes(ext) || kQmdExtensions.includes(ext)) { ...markdownExecutionEngine... }
 * // knitr: claimsFile: (file, ext) => kRmdExtensions.includes(ext.toLowerCase()) || isKnitrSpinScript(file)
 * ```
 *
 * so on an `.Rmd` the document IS knitr and no `engine:` key can say otherwise. This matters
 * because this extension's `quarto` languageId opens `.qmd`, `.rmd` AND `.Rmd`: honouring the
 * override there would silence a document quarto really validates. Measured firsthand — the
 * same document with `engine: markdown`, with `engine: jupyter`, and with `jupyter: python3`
 * renders **exit 1** as `doc.Rmd` and as `doc.rmd`, against the `.qmd` control at exit 0.
 *
 * What this deliberately does NOT do is scope those documents TO knitr. Quarto does — on an
 * `.Rmd` a `{python}` cell is validated against knitr's schema (measured: `#| cache: banana`
 * exit 1, `#| tags: banana` exit 0, against the `.qmd` control at exit 0) — so we still under-
 * report there. That is a PRE-EXISTING lost true positive this session leaves exactly as it
 * found it, filed rather than folded in: it WIDENS what we squiggle, which is the direction
 * that deserves its own deliverable.
 */
function isRMarkdownFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".rmd") || lower.endsWith(".rmarkdown");
}

/** The engine a raw `engine:` value token names, or `undefined` for anything else. */
function engineNamed(rawToken: string): DocumentEngine | undefined {
  const name = unquote(rawToken);
  return ENGINE_NAMES.has(name) ? (name as DocumentEngine) : undefined;
}

/**
 * The falsy spellings that matter here — NOT every falsy YAML scalar, and an earlier
 * revision of this comment claimed otherwise (S164 §9 review).
 *
 * The rule quarto applies is JS truthiness of the PARSED node (`if (yaml[engine.name])`), so
 * the true falsy set also includes every numeric zero — `0.0`, `+0`, `-0`, `00`, `0x0`,
 * `0o0`, `0b0`, `.0`, `0.`, `0e0` — none of which are listed. **That omission cannot produce
 * a false positive**, and the reason is measured rather than argued:
 *
 * - On `knitr:` — the ONLY key whose selection widens anything — every one of those values is
 *   itself a front-matter SCHEMA error, because `knitr:` must be an object. Measured,
 *   `knitr: 0`, `knitr: 0.0`, `knitr: 1` and `knitr: ''` each render **exit 1** with
 *   `Validation of YAML front matter failed … Field "knitr" has value …`, so quarto rejects
 *   those documents whatever we do and flagging one is not a cardinal-sin false positive.
 *   The only falsy-AND-schema-valid `knitr:` values are the booleans, which ARE listed
 *   (`knitr: false` renders exit 0 — quarto really did not select it).
 * - On `markdown:`/`jupyter:`/`julia:` a wrong TRUTHY reading selects a non-knitr engine,
 *   which maps to the engine-agnostic scope and never widens. Measured: `markdown: 0.0` and
 *   `markdown: 0` are schema-VALID and falsy (both render exit 0), we read them as truthy and
 *   select markdown — and are silent either way, so the answers agree.
 *
 * The listed spellings were each measured; the unlisted ones are documented above rather than
 * added, because adding them would imply a completeness this raw-token test cannot have.
 *
 * A QUOTED `"false"` is deliberately absent for the opposite reason: it parses to the
 * non-empty STRING `false`, which is truthy, so it DOES select — measured, `jupyter: "false"`
 * renders exit 1 with `Jupyter kernel 'false' not found`, an error only the jupyter engine
 * raises. Same quoted-scalar inversion `validate-yaml` carries (`core/validate-yaml.ts`).
 */
const FALSY_NODES: ReadonlySet<string> = new Set([
  "false",
  "False",
  "FALSE",
  "null",
  "Null",
  "NULL",
  "~",
  "0",
  "''",
  '""',
]);

/**
 * Whether an engine-named key's value is a truthy YAML node.
 *
 * With no scalar token, `hasChildren` decides: a MAPPING or SEQUENCE body is truthy (the
 * common `jupyter:` + kernelspec spelling — measured exit 0), while the null of a bare
 * `key:` is falsy (measured exit 1, and itself a front-matter schema error). The enumerator
 * owns that distinction, and it is narrower than "the next line is indented" for a reason it
 * documents: an indented plain-scalar continuation carries the key's VALUE and may be falsy.
 *
 * A BLOCK-SCALAR indicator (`|`, `>`, and their `|-`/`>+`/`|2` variants) also declines. The
 * token is punctuation, not the value: the value is the folded body, and an EMPTY body folds
 * to the empty string, which is falsy. Measured, `jupyter: |` with no body renders **exit 1**
 * on an `{r}` cell's `#| cache: banana`, i.e. jupyter was not selected. Declining costs a
 * true positive when the body is non-empty (a truthy string) — the FP-safe direction, filed.
 *
 * So does a NODE PROPERTY (`&anchor`, `!tag`, `*alias`), and here the reason is sharper: this
 * test is TRUTHINESS, not name equality, so an unresolved property token is not merely
 * unrecognised — it reads as a truthy string and manufactures a selection. Measured, all of
 * `knitr: !!bool false`, `knitr: &a false` and an alias to a false anchor render **exit 0**
 * with a `{python}` cell's `#| cache: banana` (against the engine-agnostic control at exit 1),
 * i.e. quarto resolved each to boolean false and did NOT select knitr — while we claimed it
 * and squiggled a document quarto accepts. The mirror case `knitr: !!bool true` renders exit 1,
 * so declining costs a true positive there; that is the direction this module always takes.
 *
 * A QUOTED falsy-looking scalar deliberately does NOT decline: `"false"` parses to the
 * non-empty STRING `false`, which is truthy. Measured, `jupyter: "false"` renders exit 1 with
 * `Jupyter kernel 'false' not found` — an error only the jupyter engine raises, so it really
 * was selected. Adding the quoted spellings to the falsy table would be wrong.
 */
function isTruthyNode(rawToken: string, hasChildren: boolean): boolean {
  if (rawToken.length === 0) {
    return hasChildren;
  }
  const first = rawToken[0];
  if (first === "|" || first === ">") {
    return false; // a block-scalar header — the value is the body, which may be empty
  }
  if (first === "&" || first === "!" || first === "*") {
    return false; // an anchored/tagged/aliased node — resolve it or decline, never guess
  }
  return !FALSY_NODES.has(rawToken);
}
