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

const ENGINE_NAMES: ReadonlySet<string> = new Set([
  "knitr",
  "jupyter",
  "markdown",
  "julia",
]);

/**
 * A top-level front-matter mapping line, as `findFrontMatterTopLevelLines` emits it.
 *
 * `hasChildren` is optional so the value-only view (`findFrontMatterValueLines`) also
 * satisfies this shape; absent it, a block-opener simply does not select.
 */
interface TopLevelScalar {
  key: string;
  rawToken: string;
  hasChildren?: boolean;
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
 * Quarto's answer is order-dependent in two ways we cannot see from a `.qmd` alone:
 *
 *  - **Key order.** `metadataAsFormat` assigns into `format.execute` while walking
 *    `Object.keys(metadata)`, so the LAST writer wins. Measured, the same two keys in
 *    opposite orders give opposite answers: `engine: markdown` then `execute:`/`  engine:
 *    knitr` renders **exit 1** (knitr won), and `execute:`/`  engine: knitr` then
 *    `engine: markdown` renders **exit 0** (markdown won).
 *  - **Project reordering.** `reorderEngines` puts `_quarto.yml`'s `engines:` list at the
 *    front of the loop. Measured: with `engines: [jupyter, knitr]` a document carrying both
 *    `engine: knitr` and `jupyter: python3` flips from exit 0 to exit 1. We never read
 *    `_quarto.yml` on a `.qmd` pass, so that reorder is invisible here.
 *
 * Guessing wrong in the knitr direction is the cardinal sin (below), so a set with more than
 * one member declines to answer and the caller narrows to the engine-agnostic intersection.
 * A set with ONE member is safe from both effects — no ordering can elect an engine that
 * nothing selected — so `engine: jupyter` + `jupyter: python3` resolves plainly to jupyter.
 *
 * ## Which mistakes are dangerous, swept rather than assumed
 *
 * Over the 94 `cell-*` fields of the installed 1.7.33 resource, 43 are ones this extension
 * can actually flag (`isWrongValue("banana", field)`; the rest are open-valued and never
 * fire whatever scope is used — the S162 `layout` / S163 170-key lesson). Of those:
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
 * ## What it does NOT see (all misses, never a wrong knitr claim)
 *
 * A raw token carrying a YAML node property is not matched — `engine: &a markdown`,
 * `engine: !!str markdown` and an alias `engine: *a` all leave this `undefined`, so the
 * caller keeps today's language approximation. That is the same incompleteness
 * `isValidationDisabledValue` documents, and here it can only ever MISS an override; it can
 * never manufacture one, because a node-property token never equals a bare engine name.
 */
export function documentEngineForScoping(
  fileName: string,
  topLevel: readonly TopLevelScalar[],
  nested: readonly NestedScalar[],
): DocumentEngine | "ambiguous" | undefined {
  if (isRMarkdownFileName(fileName)) {
    return undefined; // knitr claimed the file by EXTENSION; the front matter never runs
  }
  const selected = new Set<DocumentEngine>();
  for (const fm of topLevel) {
    if (fm.key === ENGINE_KEY) {
      const named = engineNamed(fm.rawToken);
      if (named !== undefined) {
        selected.add(named);
      }
    } else if (ENGINE_NAMES.has(fm.key) && isTruthyNode(fm.rawToken, fm.hasChildren === true)) {
      selected.add(fm.key as DocumentEngine);
    }
  }
  for (const ns of nested) {
    if (ns.parentPath.length === 1 && ns.parentPath[0] === "execute" && ns.key === ENGINE_KEY) {
      const named = engineNamed(ns.rawToken);
      if (named !== undefined) {
        selected.add(named);
      }
    }
  }
  if (selected.size === 0) {
    return undefined;
  }
  return selected.size === 1 ? [...selected][0] : "ambiguous";
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
 * Every raw scalar token whose PARSED YAML value is falsy in JavaScript, which is the
 * test quarto's `if (yaml[engine.name])` actually applies. Measured firsthand vs 1.7.33
 * — one `quarto render --no-execute` per spelling, each in a document whose `{r}` cell
 * carries `#| cache: banana`, which renders exit 1 whenever the named key fails to
 * select and quarto falls back to knitr.
 *
 * A QUOTED `"false"` is deliberately absent: it parses to the non-empty STRING `false`,
 * which is truthy, so it DOES select — the same quoted-scalar inversion `validate-yaml`
 * carries (`core/validate-yaml.ts`).
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
 * With no scalar token the key is either a block-opener (a MAPPING — truthy, and the common
 * `jupyter:` + kernelspec spelling: measured exit 0) or the null of a bare `key:` (falsy:
 * measured exit 1, and itself a front-matter schema error).
 */
function isTruthyNode(rawToken: string, hasChildren: boolean): boolean {
  if (rawToken.length === 0) {
    return hasChildren;
  }
  return !FALSY_NODES.has(rawToken);
}
