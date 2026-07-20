/**
 * Pure, `vscode`-free Quarto YAML schema data + reader (architecture plan §3.3;
 * Phase 6d plan §5.3).
 *
 * Two parts:
 *   1. `CURATED_CELL_OPTIONS` (+ the `SchemaField` shape) — a hand-curated set of
 *      the highest-frequency cell options, the PERMANENT fallback. Option *names*
 *      are uncopyrightable facts (confirmed against the live Quarto 1.7.33 schema)
 *      and the descriptions are our own concise wording, so it is independently
 *      license-clean (no redistribution of Quarto data).
 *   2. `parseSchemaIndex` (Slice 6d-3) — the runtime reader that parses the user's
 *      INSTALLED `yaml-intelligence-resources.json` TEXT into a `SchemaIndex`,
 *      enriching completion to the full cell-option set with resolved value enums.
 *      It NEVER throws: any malformed/unexpected input degrades to the curated set
 *      (`CURATED_SCHEMA_INDEX`). The impure read/spawn lives in the adapter
 *      (`features/yaml-schema-source.ts`); this module stays `vscode`-free.
 */

import { formatMatches, type FormatAliases } from "./format-aliases";

/** One completable schema field — a cell option (6d-1) or, later, a front-matter key. */
export interface SchemaField {
  /** The option/key name, e.g. `"echo"`, `"fig-cap"`. */
  name: string;
  /** A one-line human description shown in the completion item. */
  description?: string;
  /**
   * The allowed values for value completion (enum / `["true","false"]`), in the
   * order they should be offered. Unset for free-text/numeric options (no enum),
   * so value completion offers nothing there (Slice 6d-2).
   */
  values?: string[];
  /**
   * The engine an option is specific to, when it is engine-specific. `knitr`
   * options (e.g. `cache`) do nothing under the jupyter engine. Unset means the
   * option applies to all engines.
   */
  engine?: "knitr" | "jupyter";
  /**
   * The raw `tags.formats` list scoping this option to output formats — concrete
   * names (`revealjs`), `$`-alias-group refs (`$pdf-all`), and `!`-negations
   * (`!man`). Consumed by per-format completion (`formatMatches`, Slice 6d-6+
   * b2-i). Unset means the option is format-agnostic (universal — valid for
   * every format).
   */
  formats?: string[];
  /**
   * The raw `tags.contexts` list — the schema "contexts" a cell option also belongs
   * to (e.g. `document-code`, `document-figures`). A cell-* option is a genuine
   * per-format DOCUMENT option only when a context matches `document-*`; Quarto's
   * `getFormatSchema` (`objectRefSchemaFromContextGlob("document-*")`) folds in
   * exactly those (Slice 6d-6+ b2-i, `perFormatSource`). Unset for `document-*`
   * fields (already document-level by file) and for pure cell-only options.
   */
  contexts?: string[];
  /**
   * For an object-valued option: its resolved child fields, one object level deep
   * (Slice 6d-6+ b2-iii-key). Unset for a scalar/enum/array option, or when the
   * object has no `properties` to list. A child field never carries its OWN
   * `children` (the v1 depth cap — a second object level is the deferred
   * b2-iii-deep residue), so this is always exactly one level.
   */
  children?: SchemaField[];
  /**
   * True ONLY when the value set is EXHAUSTIVE — every reachable arm of the field's
   * schema is an `enum` (bare-array or `{values}`-object form) or a `boolean` (bare
   * or object-wrapped), with NO free arm anywhere in the resolution (value-validation
   * plan §3.2). A `string` node is ALWAYS a free/open arm — **INCLUDING
   * `string:{completions:[…]}`**: completions are autocomplete HINTS, not a
   * constraint — Quarto accepts ANY string (`engine: banana`, `documentclass: myclass`
   * render exit 0), yet `valuesOfSchema` still populates a non-empty `values` for them.
   * `number`/`path`/`arrayOf`/`object`, an unrecognized node, and the depth-cap
   * bail-out are open too. **`values` being non-empty must NOT be read as closed — this
   * bit is the sole guard against the cardinal-sin false positive.** Only value-validate
   * a field when `valuesClosed === true`; anything not positively proven enumerable is
   * left unset (open). Unaffected by / unused by completion (which reads `values` only).
   */
  valuesClosed?: boolean;
  /**
   * True when the closed value set includes the YAML-1.2 boolean type, so the six
   * spellings `true|True|TRUE|false|False|FALSE` are accepted UNQUOTED (and quoted
   * boolean-looking forms like `"true"` are rejected). Only meaningful when
   * `valuesClosed === true`. Set for a bare/object-wrapped `boolean` and for an
   * `anyOf` any of whose closed arms is a boolean (e.g. `echo` = `anyOf[boolean,
   * enum[fenced]]`).
   */
  acceptsBoolean?: boolean;
}

/** The two boolean values offered for a plain boolean option, in order. */
const BOOL = ["true", "false"];

/**
 * The page-column values (resolved from the schema's `page-column` definition,
 * Quarto 1.7.33) offered for the `column` option.
 */
const PAGE_COLUMNS = [
  "body",
  "body-outset",
  "body-outset-left",
  "body-outset-right",
  "page",
  "page-left",
  "page-right",
  "page-inset",
  "page-inset-left",
  "page-inset-right",
  "screen",
  "screen-left",
  "screen-right",
  "screen-inset",
  "screen-inset-shaded",
  "screen-inset-left",
  "screen-inset-right",
  "margin",
];

/**
 * The ~highest-frequency Quarto cell options, the permanent fallback served when
 * the runtime schema reader (6d-3) is unavailable. Names AND value enums verified
 * against the Quarto 1.7.33 schema (`schema/cell-*.yml` + the resolved
 * `page-column` def); `fig-width`/`fig-height`/`cache` are knitr-only per that
 * schema's `tags.engine`. Enum/boolean options carry `values` for 6d-2 value
 * completion; free-text/numeric options leave it unset.
 */
export const CURATED_CELL_OPTIONS: SchemaField[] = [
  {
    name: "echo",
    description: "Show the cell's source code in the rendered output.",
    // anyOf[boolean, enum[fenced]] (schema/cell-codeoutput.yml, Quarto 1.7.33) → closed.
    values: ["true", "false", "fenced"],
    valuesClosed: true,
    acceptsBoolean: true,
  },
  {
    name: "eval",
    description: "Evaluate the cell; `false` echoes the code without running it.",
    values: BOOL,
    valuesClosed: true,
    acceptsBoolean: true,
  },
  {
    // OPEN: real schema is anyOf[boolean, enum[asis], string, object] — accepts ANY
    // string (`output: banana` → exit 0), so it must stay unmarked (plan §7.1). The
    // `values` list is offered for completion only; it is NOT a closed set.
    name: "output",
    description: "Include execution results in the output (`true`/`false`/`asis`).",
    values: ["true", "false", "asis"],
  },
  {
    name: "warning",
    description: "Include warnings in the rendered output.",
    values: BOOL,
    valuesClosed: true,
    acceptsBoolean: true,
  },
  {
    name: "error",
    description: "Include errors in the output instead of halting the render.",
    values: BOOL,
    valuesClosed: true,
    acceptsBoolean: true,
  },
  {
    name: "include",
    description: "Master switch: suppress all of the cell's output (code and results).",
    values: BOOL,
    valuesClosed: true,
    acceptsBoolean: true,
  },
  {
    name: "label",
    description: "Unique cell label; enables cross-references (e.g. `fig-…`, `tbl-…`).",
  },
  { name: "fig-cap", description: "Caption for the figure the cell produces." },
  {
    name: "fig-alt",
    description: "Alternative text for the figure's HTML `alt` attribute.",
  },
  {
    name: "fig-width",
    description: "Default figure width in inches.",
    engine: "knitr",
  },
  {
    name: "fig-height",
    description: "Default figure height in inches.",
    engine: "knitr",
  },
  {
    name: "fig-align",
    description: "Figure alignment: `default`, `left`, `right`, or `center`.",
    // maybeArrayOf[enum] (schema/cell-pagelayout.yml) → closed string enum.
    values: ["default", "left", "right", "center"],
    valuesClosed: true,
  },
  { name: "tbl-cap", description: "Caption for the table the cell produces." },
  {
    name: "code-fold",
    description: "Collapse the code into an expandable block (`true`/`false`/`show`).",
    // anyOf[boolean, enum[show]] (schema/cell-codeoutput.yml) → closed.
    values: ["true", "false", "show"],
    valuesClosed: true,
    acceptsBoolean: true,
  },
  {
    name: "code-summary",
    description: "Summary text shown on a folded code block.",
  },
  {
    name: "cache",
    description: "Cache the cell's results to skip re-execution when unchanged.",
    engine: "knitr",
    values: BOOL,
    valuesClosed: true,
    acceptsBoolean: true,
  },
  {
    name: "layout-ncol",
    description: "Number of columns to lay the cell's output into.",
  },
  {
    name: "column",
    description: "Page column for the cell's output (e.g. `body`, `page`, `margin`).",
    // ref → page-column enum (Quarto 1.7.33 definitions.yml) → closed string enum.
    values: PAGE_COLUMNS,
    valuesClosed: true,
  },
];

/**
 * The ~highest-frequency Quarto front-matter (document) top-level keys, the
 * permanent fallback served for front-matter KEY completion (6d-4) when the
 * runtime schema reader is unavailable. Names are uncopyrightable facts (verified
 * present in the Quarto 1.7.33 schema); descriptions are our own wording. Includes
 * the common CONTAINER key `execute`, which the flat `schema/document-*.yml` name
 * list omits structurally (it lives in `schema/schema.yml`'s object graph;
 * surfacing it from the live schema is deferred recursive-resolution work — 6d-6).
 * `format` is included too for the offline case; note the flat list DOES carry a
 * same-named (epub-scoped) `format` string field, so when the live schema reads,
 * `format` is offered from there (with that field's description) rather than from
 * this fallback. Boolean keys (`toc`, `number-sections`) carry `values` for 6d-5
 * value completion (grounded against `schema/document-*.yml`); free-text keys
 * leave it unset. No cell `engine` (document-level).
 */
export const CURATED_FRONTMATTER_KEYS: SchemaField[] = [
  { name: "title", description: "The document's title." },
  { name: "subtitle", description: "A secondary title shown beneath the title." },
  { name: "author", description: "The document's author(s)." },
  { name: "date", description: "The document date (e.g. `today` or `2024-01-01`)." },
  { name: "abstract", description: "A summary shown before the document body." },
  { name: "format", description: "Output format(s) and their options (e.g. `html`, `pdf`)." },
  { name: "execute", description: "Document-wide code execution options (echo, eval, …)." },
  { name: "bibliography", description: "Path(s) to bibliography file(s) for citations." },
  { name: "toc", description: "Include a table of contents.", values: BOOL },
  {
    name: "number-sections",
    description: "Number section headings in the rendered output.",
    values: BOOL,
  },
  { name: "lang", description: "The document's main language (BCP-47, e.g. `en`)." },
  { name: "keywords", description: "Keywords describing the document, for metadata." },
  { name: "jupyter", description: "The Jupyter kernel used to execute the document." },
];

/**
 * The curated children offered one level under the `execute:` front-matter
 * container (Slice 6d-6, the "cheap one-level approximation" — Phase 6d plan §6).
 * Names are uncopyrightable facts grounded against the Quarto 1.7.33 schema and its
 * actual assembly logic (`objectRefSchemaFromContextGlob("document-execute")`): a
 * field enters the execute object when its file basename is `document-execute` OR
 * its `tags.contexts` names `document-execute` (verified by probing the installed
 * schema). So `cache`/`freeze`/`enabled`/`daemon`/`daemon-restart` are the
 * `schema/document-execute.yml` (`execute-only`) fields and `keep-md`/`keep-ipynb`
 * the `schema/document-render.yml` ones; the shared execution flags
 * (`echo`/`eval`/`output`/`warning`/`error`/`include`) are DEFINED in
 * `schema/cell-codeoutput.yml` + `schema/cell-textoutput.yml` but enter the execute
 * object via their `document-execute` context tag (NOT the same-named knitr-engine
 * `cache` in `schema/cell-cache.yml`, which lacks that tag and is excluded). There
 * is no single readable list in `yaml-intelligence-resources.json`, so reproducing
 * this assembly from the reader is deferred recursive-resolution work — this curated
 * set is the faithful v1 source for BOTH the parsed and the fallback index.
 * `enabled`/`daemon`/`daemon-restart` carry `hidden:true` (Quarto's own completion
 * suppresses them) but are valid, documented, render-accepted options, included
 * deliberately — `execute:\n  enabled: false` is this project's canonical render-clean
 * idiom. Each child's `values` enum is grounded against the same schema files (the
 * SIMPLE enumerable forms only — `daemon`'s number-timeout form is non-enumerable,
 * so only its boolean values are offered), for nested VALUE completion (6d-6 cont.).
 */
export const CURATED_EXECUTE_KEYS: SchemaField[] = [
  { name: "eval", description: "Evaluate code cells (`false` renders the code without running it).", values: BOOL },
  { name: "echo", description: "Show cell source code in the rendered output.", values: ["true", "false", "fenced"] },
  { name: "output", description: "Include execution output in the rendered document.", values: ["true", "false", "asis"] },
  { name: "warning", description: "Include warnings in the rendered output.", values: BOOL },
  { name: "error", description: "Include errors in the output instead of halting the render.", values: BOOL },
  { name: "include", description: "Master switch: suppress all cell output (code and results).", values: BOOL },
  { name: "cache", description: "Cache cell results to skip re-execution when unchanged.", values: ["true", "false", "refresh"] },
  { name: "freeze", description: "Reuse previously rendered results (`auto`, `true`, or `false`).", values: ["true", "false", "auto"] },
  { name: "enabled", description: "Master switch for code execution in this document.", values: BOOL },
  { name: "daemon", description: "Keep a Jupyter kernel alive between renders (seconds, or a boolean).", values: BOOL },
  { name: "daemon-restart", description: "Restart the Jupyter daemon before rendering.", values: BOOL },
  { name: "keep-md", description: "Keep the intermediate Markdown produced during rendering.", values: BOOL },
  { name: "keep-ipynb", description: "Keep the intermediate notebook produced during rendering.", values: BOOL },
];

/**
 * The ~highest-frequency Quarto OUTPUT FORMAT names, the permanent fallback for
 * nested `format:` completion (Slice 6d-6 continuation) when the runtime schema
 * reader is unavailable. Format names are uncopyrightable facts (a subset of the
 * live `pandoc/formats.yml` list); descriptions are our own. Unlike
 * `CURATED_EXECUTE_KEYS` (whose full set the live schema cannot assemble, so it is
 * curated-only), the FULL format list IS reader-derivable (`collectFormatNames`),
 * so this curated set is only a small offline subset — every name here is also in
 * the reader's output. Format names carry no value enum (a format is a container
 * for per-format options, a deferred deeper slice) and no cell engine.
 */
export const CURATED_FORMAT_NAMES: SchemaField[] = [
  { name: "html", description: "HTML document." },
  { name: "pdf", description: "PDF document (via LaTeX or Typst)." },
  { name: "docx", description: "Microsoft Word (.docx) document." },
  { name: "odt", description: "OpenDocument Text (.odt) document." },
  { name: "epub", description: "EPUB e-book." },
  { name: "revealjs", description: "reveal.js HTML presentation." },
  { name: "beamer", description: "LaTeX Beamer presentation (PDF)." },
  { name: "pptx", description: "PowerPoint (.pptx) presentation." },
  { name: "gfm", description: "GitHub Flavored Markdown." },
  { name: "commonmark", description: "CommonMark Markdown." },
  { name: "markdown", description: "Pandoc Markdown." },
  { name: "typst", description: "Typst document (PDF)." },
  { name: "latex", description: "LaTeX document." },
  { name: "dashboard", description: "Quarto dashboard." },
];

/**
 * A small set of UNIVERSAL (format-agnostic) options, the permanent offline
 * fallback for per-format completion (Slice 6d-6+ b2-i) served for
 * `frontMatterKeys(["format", fmt])` when the runtime reader is unavailable. A
 * full per-format set (155+ options for html) is infeasible to curate and the
 * reader is a hard dependency, so this is only the rare-path approximation: every
 * option here is valid for every format (no `formats` tag → `formatMatches`
 * admits it for any `fmt`). Names are uncopyrightable facts; descriptions ours.
 */
export const CURATED_FORMAT_OPTIONS: SchemaField[] = [
  { name: "toc", description: "Include a table of contents.", values: BOOL },
  { name: "number-sections", description: "Number section headings.", values: BOOL },
  { name: "fig-width", description: "Default figure width in inches." },
  { name: "fig-height", description: "Default figure height in inches." },
  {
    name: "fig-format",
    description: "Figure output format.",
    values: ["retina", "png", "jpeg", "svg", "pdf"],
  },
  {
    name: "df-print",
    description: "How data frames are printed (`default`, `kable`, `tibble`, `paged`).",
    values: ["default", "kable", "tibble", "paged"],
  },
  // A small curated child-key fallback for two of the highest-value
  // object-valued options (6d-6+ b2-iii-key, plan §9 Q3), grounded against the
  // installed 1.7.33 schema. Curated as universal (like every other entry here)
  // even though the real options are format-scoped — the offline fallback
  // trades that realism for simplicity on this rare-path approximation.
  {
    name: "code-tools",
    description: "Include a code tools menu (`true`/`false`, or customize below).",
    children: [
      { name: "source", description: "Show the document source (`true`/`false`, or a URL).", values: BOOL },
      { name: "toggle", description: "Whether the code tools menu can hide/show code.", values: BOOL },
      { name: "caption", description: "Caption text for the code tools menu." },
    ],
  },
  {
    name: "theme",
    description: "Theme name, theme scss file, or a mix of both.",
    children: [
      { name: "light", description: "The light theme name, theme scss file, or a mix of both." },
      { name: "dark", description: "The dark theme name, theme scss file, or a mix of both." },
    ],
  },
];

/**
 * The complete, exact set of `_quarto.yml` `project:` block keys (Quarto
 * 1.7.33's `schema/project.yml` `project` entry, `closed: true`, 11
 * properties) — the ONLY one of `project:`/`website:`/`book:` small enough to
 * hand-curate EXACTLY, so it is the only one safe to treat as closed offline.
 * `website:`/`book:`'s real closed sets (36 and ~159 properties respectively,
 * the latter merged through a `super` chain — YAML schema diagnostics plan
 * §2.2) are infeasible to hand-curate completely; curating a PARTIAL subset
 * and marking it closed would risk flagging a genuinely valid key as unknown
 * whenever Quarto is unreachable — exactly the false positive this feature
 * exists to avoid. So the curated fallback simply does not validate
 * `website:`/`book:` offline (plan §9 Q2's "omit" alternative) rather than
 * ship a partial closed set.
 */
export const CURATED_PROJECT_KEYS = new Set([
  "title",
  "type",
  "render",
  "execute-dir",
  "output-dir",
  "lib-dir",
  "resources",
  "preview",
  "pre-render",
  "post-render",
  "detect",
]);

/**
 * `CURATED_SCHEMA_INDEX`'s `projectKeys` data: `project:` is closed and exact
 * (above); `website:`/`book:` are `null` (never flagged offline — see
 * `CURATED_PROJECT_KEYS`'s docstring).
 */
const CURATED_PROJECT_CONFIG_KEYS: Map<"project" | "website" | "book", ClosedKeySet | null> =
  new Map([
    ["project", { names: CURATED_PROJECT_KEYS, closed: true }],
    ["website", null],
    ["book", null],
  ]);

// ── Runtime schema index (Slice 6d-3) ───────────────────────────────────────

/**
 * A queryable view over a set of schema fields (Phase 6d plan §5.3). Backs both
 * the parsed runtime schema and the curated fallback, so the provider treats the
 * two interchangeably.
 */
export interface SchemaIndex {
  /**
   * The cell options to offer, optionally filtered to a cell engine. An option
   * restricted to a *different* engine is excluded; an engine-agnostic option is
   * always included. An unknown/absent engine yields the full set (we do not
   * filter what we cannot classify).
   */
  cellOptions(engine?: "knitr" | "jupyter" | "ojs"): SchemaField[];
  /**
   * The front-matter keys to offer at the given mapping path. Top-level keys are
   * returned for the document root (`parentPath` empty, 6d-4) — there the `format`
   * key additionally carries the output-format names as its value enum, so a
   * top-level `format: <here>` scalar completes them (6d-6+). The allow-listed
   * one-level containers return their children — `["execute"]` the curated execute
   * children (6d-6), `["format"]` the output-format names (6d-6 cont., reader-
   * derived with a curated fallback). A two-level `["format", fmt]` path returns
   * the per-format options valid for that concrete format (6d-6+ b2-i: the
   * document-* ∪ format-scoped cell-* fields whose `tags.formats` admit `fmt`).
   * Any other path — a non-allow-listed container or deeper nesting — yields `[]`
   * (recursive resolution of deep nesting is deferred, b2-iii).
   */
  frontMatterKeys(parentPath: string[]): SchemaField[];

  /**
   * The closed set of valid keys directly inside `_quarto.yml`'s `project:`,
   * `website:`, or `book:` block, or `null` when this container's closed-set
   * data could not be resolved (safe default: callers must NOT flag anything
   * for a `null` result — absence of proof is not proof of absence). `book:`
   * resolves through a `super` merge chain (`book-schema` supers
   * `base-website`; `book:` itself also supers `csl-item-shared`) — YAML
   * schema diagnostics plan §2.2. Never throws.
   */
  projectKeys(container: "project" | "website" | "book"): Set<string> | null;
}

/** One resolved container's key set + whether the resolution proved it closed. */
interface ClosedKeySet {
  names: Set<string>;
  closed: boolean;
}

/**
 * Build a `SchemaIndex` over fixed cell-option and front-matter-key lists (the
 * parser and the curated fallback share this).
 */
function indexOf(
  cellFields: SchemaField[],
  fmFields: SchemaField[],
  formatFields: SchemaField[],
  perFormatFields: SchemaField[],
  aliases: FormatAliases,
  projectConfigKeys: Map<"project" | "website" | "book", ClosedKeySet | null>,
): SchemaIndex {
  // The top-level `format:` value is an output-format NAME (`html`, `pdf`, …), but
  // the flat document-key list models `format` only as a same-named epub-scoped
  // STRING field with no value enum (a name collision). Surface the format names as
  // that key's value enum so a top-level `format: <here>` scalar completes them
  // through the generic value path — no provider special-case (6d-6+). The names are
  // the same set offered as KEYS one level under `format:` (`frontMatterKeys(["format"])`).
  // Derived (not mutated) so the raw curated/parsed field lists stay untouched.
  const formatNames = formatFields.map((f) => f.name);
  const topLevelFields =
    formatNames.length === 0
      ? fmFields
      : fmFields.map((f) => (f.name === "format" ? { ...f, values: formatNames } : f));
  // The `["format", fmt]` per-format option set (6d-6+ b2-i): document-* ∪
  // format-scoped cell-* fields whose `tags.formats` admit `fmt`. Shared by the
  // length===2 (option KEY/VALUE) and length>=3 (object sub-key, b2-iii-key)
  // branches below.
  const perFormatOptions = (fmt: string): SchemaField[] =>
    perFormatFields.filter((f) => formatMatches(f.formats, fmt, aliases));
  return {
    cellOptions(engine) {
      if (engine === undefined) {
        return cellFields;
      }
      return cellFields.filter((f) => f.engine === undefined || f.engine === engine);
    },
    frontMatterKeys(parentPath) {
      // 6d-4 completes top-level keys (document root); the top-level `format` key
      // also carries the format names as its value enum (6d-6+, above). 6d-6
      // completes one level under an allow-listed container: `execute:` → curated
      // execute children; `format:` → the output-format names (reader-derived,
      // curated fallback). Any other nested path is deferred (recursive
      // resolution), so it yields [].
      if (parentPath.length === 0) {
        return topLevelFields;
      }
      if (parentPath.length === 1 && parentPath[0] === "execute") {
        return CURATED_EXECUTE_KEYS;
      }
      if (parentPath.length === 1 && parentPath[0] === "format") {
        return formatFields;
      }
      // Per-format options (6d-6+ b2-i): under `format:\n  <fmt>:`, the document-*
      // ∪ format-scoped cell-* fields whose `tags.formats` admit the concrete
      // format `<fmt>`, alias-expanded and negation-aware (Quarto's `useSchema`).
      // An unknown format keeps only the untagged (universal) fields — safe
      // degradation, never a wrong key.
      if (parentPath.length === 2 && parentPath[0] === "format") {
        return perFormatOptions(parentPath[1]);
      }
      // Deep-nested object-option sub-keys (6d-6+ b2-iii-key): under
      // `format:\n  <fmt>:\n    <opt>:`, the option's resolved `children` (one
      // object level — Slice 6d-3's `objectChildren`/`toField`). An unknown
      // format/option, or an option with no children (non-object, or filtered out
      // of the format), yields `[]`. `path.slice(3)` descends further for a
      // depth-4+ position, but `children` is never populated past one level in
      // v1, so that descent always lands on `undefined` → `[]` (deferred,
      // shape-locked — b2-iii-deep).
      if (parentPath.length >= 3 && parentPath[0] === "format") {
        let node: SchemaField | undefined = perFormatOptions(parentPath[1]).find(
          (f) => f.name === parentPath[2],
        );
        for (const seg of parentPath.slice(3)) {
          node = node?.children?.find((c) => c.name === seg);
        }
        return node?.children ?? [];
      }
      return [];
    },
    projectKeys(container) {
      // Only surface a resolved set when the resolution actually proved the
      // container closed — an unresolved or not-provably-closed container
      // returns null (never a wrong flag), matching the interface contract.
      const resolved = projectConfigKeys.get(container);
      return resolved?.closed === true ? resolved.names : null;
    },
  };
}

/**
 * The engine an option is restricted to, from `tags.engine`. The tag is a single
 * string (`"knitr"`) or a list (`["knitr","jupyter"]`); a list naming more than
 * one execution engine is treated as engine-agnostic (`undefined`), so a
 * both-engines option is offered everywhere rather than nowhere.
 */
function engineTag(tags: unknown): "knitr" | "jupyter" | undefined {
  if (tags === null || typeof tags !== "object") {
    return undefined;
  }
  const engine = (tags as Record<string, unknown>).engine;
  if (engine === "knitr" || engine === "jupyter") {
    return engine;
  }
  if (Array.isArray(engine)) {
    const known = engine.filter((e) => e === "knitr" || e === "jupyter");
    if (known.length === 1) {
      return known[0] as "knitr" | "jupyter";
    }
  }
  return undefined;
}

/**
 * The raw `tags.formats` list (concrete names / `$`-alias refs / `!`-negations)
 * scoping an option to output formats, or `undefined` when it is format-agnostic.
 * Non-string members are dropped defensively; an empty result is treated as unset
 * (universal), so a malformed tag never wrongly narrows an option to no formats.
 */
function formatsTag(tags: unknown): string[] | undefined {
  if (tags === null || typeof tags !== "object") {
    return undefined;
  }
  const formats = (tags as Record<string, unknown>).formats;
  if (!Array.isArray(formats)) {
    return undefined;
  }
  const strings = formats.filter((f): f is string => typeof f === "string");
  return strings.length > 0 ? strings : undefined;
}

/**
 * The raw `tags.contexts` list (schema contexts an option belongs to, e.g.
 * `document-code`), or `undefined` when absent. A single string is normalized to
 * a one-element list; non-string members are dropped defensively. Consumed by the
 * per-format cell-* fold-in (`hasDocumentContext`).
 */
function contextsTag(tags: unknown): string[] | undefined {
  if (tags === null || typeof tags !== "object") {
    return undefined;
  }
  const contexts = (tags as Record<string, unknown>).contexts;
  const list = Array.isArray(contexts)
    ? contexts
    : typeof contexts === "string"
      ? [contexts]
      : undefined;
  if (list === undefined) {
    return undefined;
  }
  const strings = list.filter((c): c is string => typeof c === "string");
  return strings.length > 0 ? strings : undefined;
}

/**
 * The curated cell options as a `SchemaIndex` — the permanent fallback the
 * runtime reader degrades to whenever the installed schema cannot be read or
 * parsed (Phase 6d plan §2.5). Interchangeable with a parsed index.
 */
export const CURATED_SCHEMA_INDEX: SchemaIndex = indexOf(
  CURATED_CELL_OPTIONS,
  CURATED_FRONTMATTER_KEYS,
  CURATED_FORMAT_NAMES,
  CURATED_FORMAT_OPTIONS,
  new Map(), // no `$`-aliases needed: curated per-format options are all universal
  CURATED_PROJECT_CONFIG_KEYS,
);

/** Strip a leading UTF-8 BOM, which `JSON.parse` rejects (Learning #16c). */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** The human description of an entry: its `short` form, or a plain string. */
function descriptionOf(description: unknown): string | undefined {
  if (typeof description === "string") {
    return description.length > 0 ? description : undefined;
  }
  if (description !== null && typeof description === "object") {
    const short = (description as Record<string, unknown>).short;
    if (typeof short === "string" && short.length > 0) {
      return short;
    }
  }
  return undefined;
}

/** A JSON scalar rendered as the YAML token a user would type (`true`, `42`, `asis`). */
function scalarToYaml(value: unknown): string | null {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    return value;
  }
  return null; // objects / null / arrays are not scalar values
}

/** De-duplicate while preserving first-occurrence order. */
function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * The completable value tokens for a Quarto schema-DSL `schema` field — the
 * SIMPLE cases only (Phase 6d plan §2.2/§6 Slice 6d-3): a bare `boolean`, an
 * `enum`, an `anyOf` of those, a `maybeArrayOf` of those, a `string.completions`
 * list, and a `ref` resolved one hop through `definitions.yml`. Everything else
 * (`string`/`number`/`path`, `arrayOf`, `object`, and deep `super`/`resolveRef`
 * chains) yields `[]` — value completion simply offers nothing there. `depth`
 * guards against a cyclic `ref`.
 */
function valuesOfSchema(
  schema: unknown,
  definitions: Map<string, unknown>,
  depth: number,
): string[] {
  if (depth > 5) {
    return [];
  }
  if (schema === "boolean") {
    return ["true", "false"];
  }
  if (typeof schema === "string" || schema === null || typeof schema !== "object") {
    return []; // "string" | "number" | "path" | non-object → no enum
  }
  const s = schema as Record<string, unknown>;
  // The object-wrapped `boolean` DSL form (e.g. `crossref.chapters`:
  // `{boolean: {description, default}}`) — the type name is itself the wrapper
  // key, sibling to `description`/`default`; distinct from both the bare
  // `"boolean"` literal above and the `{tags, schema:"boolean"}` indirection
  // below (b2-iii-value gap c, found by adversarial review).
  if (s.boolean !== null && typeof s.boolean === "object") {
    return ["true", "false"];
  }
  if (Array.isArray(s.enum)) {
    return dedupe(s.enum.map(scalarToYaml).filter((v): v is string => v !== null));
  }
  // The definition-enum-OBJECT form some `definitions.yml` entries use
  // (`math-methods`: `{enum: {values: [...]}}`) — inconsistent with the plain-array
  // form above (`page-column`: `{enum: [...]}`); both are real (Learning #41c-style
  // grounding, b2-iii-value gap a).
  if (s.enum !== null && typeof s.enum === "object" && !Array.isArray(s.enum)) {
    const values = (s.enum as Record<string, unknown>).values;
    if (Array.isArray(values)) {
      return dedupe(values.map(scalarToYaml).filter((v): v is string => v !== null));
    }
  }
  if (Array.isArray(s.anyOf)) {
    return dedupe(s.anyOf.flatMap((member) => valuesOfSchema(member, definitions, depth + 1)));
  }
  if (s.maybeArrayOf !== undefined) {
    return valuesOfSchema(s.maybeArrayOf, definitions, depth + 1);
  }
  if (typeof s.ref === "string") {
    return valuesOfSchema(definitions.get(s.ref), definitions, depth + 1);
  }
  if (s.string !== null && typeof s.string === "object") {
    const completions = (s.string as Record<string, unknown>).completions;
    if (Array.isArray(completions)) {
      return dedupe(completions.map(scalarToYaml).filter((v): v is string => v !== null));
    }
  }
  // The `{tags, schema: ...}` wrapper form some `properties` entries use (e.g.
  // `editor.render-on-save`) — the actual schema is one hop deeper, under
  // `.schema` (mirrors `resolveObjectProperties`'s own `.schema` unwrap,
  // b2-iii-value gap b).
  if (s.schema !== undefined) {
    return valuesOfSchema(s.schema, definitions, depth + 1);
  }
  return []; // arrayOf, object, and other deferred forms
}

/**
 * Whether a schema-DSL `schema` field's value set is provably CLOSED, and whether
 * it accepts the YAML-1.2 boolean type — the closedness sibling of `valuesOfSchema`
 * (value-validation plan §3.2). Its risk polarity is INVERTED from `valuesOfSchema`:
 * an unproven node MUST default to OPEN (`closed:false`), because a field wrongly
 * marked closed is the cardinal-sin false positive. The base cases, enumerated
 * explicitly and mirroring `valuesOfSchema`'s exact arm order + `depth` guard:
 *   • bare / object-wrapped `boolean`      → closed, acceptsBoolean
 *   • `enum` (bare array or `{values}`)     → closed (NOT boolean — an enum listing
 *                                             `true`/`false` is still case-sensitive)
 *   • `anyOf`                               → closed iff EVERY arm closed;
 *                                             acceptsBoolean iff some (closed) arm is boolean
 *   • `maybeArrayOf` / `ref` / `schema`     → inherit the inner node's closedness
 *   • bare `string` — **INCLUDING `string:{completions}`** — `number`, `path`,
 *     `arrayOf`, `object`, an unrecognized node, and `depth>5` → OPEN
 * `string:{completions}` is the load-bearing case: it yields a non-empty `values`
 * (`valuesOfSchema`, above) yet accepts ANY string, so it must be OPEN.
 */
function closednessOfSchema(
  schema: unknown,
  definitions: Map<string, unknown>,
  depth: number,
): { closed: boolean; acceptsBoolean: boolean } {
  const OPEN = { closed: false, acceptsBoolean: false };
  if (depth > 5) {
    return OPEN;
  }
  if (schema === "boolean") {
    return { closed: true, acceptsBoolean: true };
  }
  if (typeof schema === "string" || schema === null || typeof schema !== "object") {
    return OPEN; // bare "string" | "number" | "path" | non-object → open
  }
  const s = schema as Record<string, unknown>;
  if (s.boolean !== null && typeof s.boolean === "object") {
    return { closed: true, acceptsBoolean: true };
  }
  if (Array.isArray(s.enum)) {
    return { closed: true, acceptsBoolean: false };
  }
  if (s.enum !== null && typeof s.enum === "object" && !Array.isArray(s.enum)) {
    const values = (s.enum as Record<string, unknown>).values;
    if (Array.isArray(values)) {
      return { closed: true, acceptsBoolean: false };
    }
  }
  if (Array.isArray(s.anyOf)) {
    let closed = true;
    let acceptsBoolean = false;
    for (const member of s.anyOf) {
      const inner = closednessOfSchema(member, definitions, depth + 1);
      closed = closed && inner.closed;
      acceptsBoolean = acceptsBoolean || inner.acceptsBoolean;
    }
    return { closed, acceptsBoolean: closed && acceptsBoolean };
  }
  if (s.maybeArrayOf !== undefined) {
    return closednessOfSchema(s.maybeArrayOf, definitions, depth + 1);
  }
  if (typeof s.ref === "string") {
    return closednessOfSchema(definitions.get(s.ref), definitions, depth + 1);
  }
  if (s.string !== null && typeof s.string === "object") {
    return OPEN; // string:{completions} — completions are HINTS, any string renders
  }
  if (s.schema !== undefined) {
    return closednessOfSchema(s.schema, definitions, depth + 1);
  }
  return OPEN; // arrayOf, object, and other deferred/unrecognized forms
}

/**
 * Set the derived `valuesClosed`/`acceptsBoolean` bits on `field` from its raw
 * `schema` (shared by `toField` and `objectChildren`). Only stamps `valuesClosed`
 * when the field is BOTH provably closed AND actually value-bearing, so the
 * matcher's precondition (`valuesClosed===true && values.length>0`) can gate on
 * the single bit; a genuinely open field is left unmarked (open by default).
 */
function annotateClosedness(field: SchemaField, schema: unknown, definitions: Map<string, unknown>): void {
  if (field.values === undefined || field.values.length === 0) {
    return;
  }
  const { closed, acceptsBoolean } = closednessOfSchema(schema, definitions, 0);
  if (closed) {
    field.valuesClosed = true;
    if (acceptsBoolean) {
      field.acceptsBoolean = true;
    }
  }
}

/**
 * The `properties` map of the `{object: {properties}}` an option's schema
 * resolves to, or `null` if it never lands on a non-empty object. Walks `anyOf`
 * (first arm that lands on an object), `ref` (repeated, `seenRefs`-guarded
 * against a cyclic definitions graph — e.g. `about → website-about → links →
 * navigation-item ↔ navigation-item-object`), `maybeArrayOf` (a value that MAY
 * be a single object — a bare mapping is valid, so unwrapping it to offer its
 * properties as keys is correct), and the `{schema: …}` indirection some
 * `definitions.yml` entries use (e.g. `code-links-schema`) — grounded
 * firsthand against the installed 1.7.33 schema (Learning #41c). `hops` bounds
 * a single resolution chain generically (mirrors `valuesOfSchema`'s `depth`
 * guard).
 *
 * Deliberately does NOT unwrap a BARE `arrayOf` (an unconditional array, no
 * single-object alternative — e.g. `other-links`/`filters`): its only valid
 * YAML shape is a `-`-prefixed sequence, so the array element's properties are
 * never valid MAPPING keys for the option itself (adversarial-review-caught:
 * treating it the same as `maybeArrayOf` produced schema-invalid completions
 * like `other-links:\n  text: …`). Sequence-item completion is out of scope
 * for v1 (the detector already bails on a `- ` line) — a bare-`arrayOf` option
 * correctly offers no children.
 */
function resolveObjectProperties(
  schema: unknown,
  definitions: Map<string, unknown>,
  seenRefs: Set<string>,
  hops: number,
): Record<string, unknown> | null {
  if (hops > 10 || schema === null || typeof schema !== "object") {
    return null;
  }
  const s = schema as Record<string, unknown>;
  if (s.object !== null && typeof s.object === "object") {
    const properties = (s.object as Record<string, unknown>).properties;
    return properties !== null &&
      typeof properties === "object" &&
      !Array.isArray(properties) &&
      Object.keys(properties).length > 0
      ? (properties as Record<string, unknown>)
      : null;
  }
  if (Array.isArray(s.anyOf)) {
    for (const arm of s.anyOf) {
      const resolved = resolveObjectProperties(arm, definitions, seenRefs, hops + 1);
      if (resolved !== null) {
        return resolved;
      }
    }
    return null;
  }
  if (typeof s.ref === "string") {
    if (seenRefs.has(s.ref)) {
      return null; // cycle guard — already chasing this ref in this resolution chain
    }
    seenRefs.add(s.ref);
    return resolveObjectProperties(definitions.get(s.ref), definitions, seenRefs, hops + 1);
  }
  if (s.maybeArrayOf !== undefined) {
    return resolveObjectProperties(s.maybeArrayOf, definitions, seenRefs, hops + 1);
  }
  if (s.schema !== undefined) {
    return resolveObjectProperties(s.schema, definitions, seenRefs, hops + 1);
  }
  return null;
}

/**
 * Resolve a `_quarto.yml` `project:`/`website:`/`book:` container's schema
 * node into its closed key set (YAML schema diagnostics plan §2.2/§5.1).
 * Walks `ref`/`resolveRef` (definitions.yml indirection — `resolveRef` is the
 * key name Quarto's own `super` chain uses, distinct from the plain `ref` seen
 * elsewhere in this file), the `{object: {...}}` wrapper, and the `{schema:
 * ...}` indirection a definitions.yml entry itself may use (`book-schema`'s
 * own entry shape, grounded firsthand against the installed 1.7.33 schema).
 * `seenRefs` is a per-branch snapshot (copied, never mutated in place) so
 * sibling `super` members that happen to share a resolution target (a
 * legitimate DAG diamond, not a cycle) each resolve independently rather
 * than one starving the other — only a TRUE cycle back to an ancestor
 * already on the CURRENT branch is blocked. `seenRefs` alone is a sufficient
 * termination guarantee here (unlike `resolveObjectProperties`'s generic
 * `hops` bound): every recursive step either follows a NAMED `ref`/
 * `resolveRef` (seenRefs-guarded) or descends directly into already-parsed
 * JSON data (`.object`/`.schema`), which can never itself be circular — a
 * parsed JSON tree has no back-edges except through a named indirection. A
 * separate depth cap here would be redundant defense that only adds risk: a
 * legitimately deep (non-cyclic) chain would silently lose its own branch's
 * names once the cap fired, while a shallower sibling's `closed:true` still
 * propagated through the merge — the same "closed:true, incomplete names"
 * false-positive shape a real cycle would produce, without an actual cycle
 * (adversarial review, Session 47). Never throws: a missing/malformed node
 * anywhere in the chain simply contributes nothing, never a wrong result.
 */
function resolveClosedKeys(
  node: unknown,
  definitions: Map<string, unknown>,
  seenRefs: Set<string>,
): ClosedKeySet | null {
  if (node === null || typeof node !== "object") {
    return null;
  }
  const n = node as Record<string, unknown>;
  if (typeof n.ref === "string") {
    return resolveClosedKeysRef(n.ref, definitions, seenRefs);
  }
  if (typeof n.resolveRef === "string") {
    return resolveClosedKeysRef(n.resolveRef, definitions, seenRefs);
  }
  if (n.object !== null && typeof n.object === "object" && !Array.isArray(n.object)) {
    return resolveClosedKeysObject(n.object as Record<string, unknown>, definitions, seenRefs);
  }
  if (n.schema !== undefined) {
    return resolveClosedKeys(n.schema, definitions, seenRefs);
  }
  return null;
}

/** The `ref`/`resolveRef` indirection branch of `resolveClosedKeys` — cycle-guarded. */
function resolveClosedKeysRef(
  ref: string,
  definitions: Map<string, unknown>,
  seenRefs: Set<string>,
): ClosedKeySet | null {
  if (seenRefs.has(ref)) {
    return null; // a true cycle within this branch's own ancestor chain
  }
  const def = definitions.get(ref);
  if (def === undefined) {
    return null;
  }
  const nextSeen = new Set(seenRefs);
  nextSeen.add(ref);
  return resolveClosedKeys(def, definitions, nextSeen);
}

/**
 * The `{object: {closed, properties, super}}` branch of `resolveClosedKeys`.
 * `super` may be a single node or an array (`book-schema`'s own `super` is a
 * bare object; `book`'s is an array of two) — normalized to a list and merged
 * by UNION, with `closed` true if EITHER this object's own flag is true OR any
 * merged `super` member resolved closed (`book`'s own project.yml entry
 * carries no `closed` flag at all — only `book-schema`, reached through
 * `super`, does — so closedness must propagate up through the merge, not stop
 * at the outermost entry's own flag).
 */
function resolveClosedKeysObject(
  obj: Record<string, unknown>,
  definitions: Map<string, unknown>,
  seenRefs: Set<string>,
): ClosedKeySet {
  const names = new Set<string>();
  const properties = obj.properties;
  if (properties !== null && typeof properties === "object" && !Array.isArray(properties)) {
    for (const key of Object.keys(properties as Record<string, unknown>)) {
      names.add(key);
    }
  }
  let closed = obj.closed === true;
  const superNode = obj.super;
  if (superNode !== undefined) {
    const members = Array.isArray(superNode) ? superNode : [superNode];
    for (const member of members) {
      const resolved = resolveClosedKeys(member, definitions, seenRefs);
      if (resolved !== null) {
        for (const name of resolved.names) {
          names.add(name);
        }
        if (resolved.closed) {
          closed = true;
        }
      }
    }
  }
  return { names, closed };
}

/**
 * The `project:`/`website:`/`book:` closed-key map for `SchemaIndex.
 * projectKeys` (plan §5.1), read from `data["schema/project.yml"]`'s
 * `project`/`website`/`book` entries (containers, not leaf `SchemaField`s —
 * NOT run through `collectFields`/`toField`) and resolved against the SAME
 * already-built `definitions` map `parseSchemaIndex` uses elsewhere. A
 * container absent from the array, or `schema/project.yml` itself malformed,
 * yields `null` for that container (never a wrong flag).
 */
function buildProjectConfigKeys(
  data: Record<string, unknown>,
  definitions: Map<string, unknown>,
): Map<"project" | "website" | "book", ClosedKeySet | null> {
  const raw = data["schema/project.yml"];
  const entries = Array.isArray(raw) ? raw : [];
  const schemaByName = new Map<string, unknown>();
  for (const entry of entries) {
    if (entry !== null && typeof entry === "object" && typeof (entry as Record<string, unknown>).name === "string") {
      schemaByName.set((entry as Record<string, unknown>).name as string, (entry as Record<string, unknown>).schema);
    }
  }
  const map = new Map<"project" | "website" | "book", ClosedKeySet | null>();
  for (const container of ["project", "website", "book"] as const) {
    const schema = schemaByName.get(container);
    map.set(
      container,
      schema === undefined ? null : resolveClosedKeys(schema, definitions, new Set()),
    );
  }
  return map;
}

/**
 * The human description of a property's raw schema value, searched up to 3
 * levels deep through the common scalar-type wrappers (`string`/`boolean`/
 * `number`/`path`/`object`) and array wrappers (`maybeArrayOf`/`arrayOf`) —
 * covers the two shapes the real schema mixes (grounded firsthand): a
 * description as a direct sibling of the type key (`{enum:[…], description}`)
 * and one nested inside a scalar-type wrapper (`{string: {description}}`).
 * `undefined` when no description is reachable within the bound (a bare
 * `"boolean"`/`"string"` token, for instance) — description is a UX nicety,
 * never load-bearing, so an absence here degrades silently.
 */
function childDescription(schema: unknown, depth: number): string | undefined {
  if (depth > 3 || schema === null || typeof schema !== "object") {
    return undefined;
  }
  const s = schema as Record<string, unknown>;
  const direct = descriptionOf(s.description);
  if (direct !== undefined) {
    return direct;
  }
  for (const typeKey of ["string", "boolean", "number", "path", "object"]) {
    if (s[typeKey] !== null && typeof s[typeKey] === "object") {
      const nested = childDescription(s[typeKey], depth + 1);
      if (nested !== undefined) {
        return nested;
      }
    }
  }
  for (const wrapKey of ["maybeArrayOf", "arrayOf"]) {
    if (s[wrapKey] !== undefined) {
      const nested = childDescription(s[wrapKey], depth + 1);
      if (nested !== undefined) {
        return nested;
      }
    }
  }
  return undefined;
}

/**
 * The child `SchemaField`s of an object-valued schema, one object level deep, or
 * `[]` — a bounded sibling of `valuesOfSchema` (Phase 6d-6+ b2-iii-key plan §5.2).
 * `depth` caps recursion at exactly ONE object level (v1 policy, plan §9 Q2): a
 * child's own `children` are never computed (`depth > 0` bails immediately,
 * before any resolution), so `objectChildren` never descends into a child
 * property's own nested structure — deeper nesting is the deferred b2-iii-deep
 * residue. `seenRefs` is threaded through so a single top-level resolution chain
 * (anyOf/ref/maybeArrayOf/arrayOf/schema, `resolveObjectProperties`) cannot loop
 * forever on a cyclic definitions graph. Never throws: a scalar leaf, a bare
 * object with no properties, or an unresolvable schema all yield `[]`.
 */
function objectChildren(
  schema: unknown,
  definitions: Map<string, unknown>,
  depth: number,
  seenRefs: Set<string>,
): SchemaField[] {
  if (depth > 0) {
    return [];
  }
  const properties = resolveObjectProperties(schema, definitions, seenRefs, 0);
  if (properties === null) {
    return [];
  }
  return Object.entries(properties).map(([name, sub]) => {
    const field: SchemaField = { name };
    const description = childDescription(sub, 0);
    if (description !== undefined) {
      field.description = description;
    }
    const values = valuesOfSchema(sub, definitions, 0);
    if (values.length > 0) {
      field.values = values;
    }
    annotateClosedness(field, sub, definitions);
    const children = objectChildren(sub, definitions, depth + 1, seenRefs);
    if (children.length > 0) {
      field.children = children;
    }
    return field;
  });
}

/** Index `definitions.yml` (a list of `{id, …}`) by id; each value IS its schema. */
function indexDefinitions(raw: unknown): Map<string, unknown> {
  const map = new Map<string, unknown>();
  if (Array.isArray(raw)) {
    for (const def of raw) {
      if (def !== null && typeof def === "object" && typeof (def as Record<string, unknown>).id === "string") {
        map.set((def as Record<string, unknown>).id as string, def);
      }
    }
  }
  return map;
}

/** Translate one raw schema entry into a `SchemaField`, or `null` to skip it. */
function toField(entry: unknown, definitions: Map<string, unknown>): SchemaField | null {
  if (entry === null || typeof entry !== "object") {
    return null;
  }
  const e = entry as Record<string, unknown>;
  if (typeof e.name !== "string" || e.name.length === 0 || e.hidden === true) {
    return null;
  }
  const field: SchemaField = { name: e.name };
  const description = descriptionOf(e.description);
  if (description !== undefined) {
    field.description = description;
  }
  const values = valuesOfSchema(e.schema, definitions, 0);
  if (values.length > 0) {
    field.values = values;
  }
  annotateClosedness(field, e.schema, definitions);
  const engine = engineTag(e.tags);
  if (engine !== undefined) {
    field.engine = engine;
  }
  const formats = formatsTag(e.tags);
  if (formats !== undefined) {
    field.formats = formats;
  }
  const contexts = contextsTag(e.tags);
  if (contexts !== undefined) {
    field.contexts = contexts;
  }
  const children = objectChildren(e.schema, definitions, 0, new Set());
  if (children.length > 0) {
    field.children = children;
  }
  return field;
}

/**
 * Parse the TEXT of the installed `yaml-intelligence-resources.json` into a
 * `SchemaIndex` of cell options (Phase 6d plan §5.3). Pure and NEVER throws:
 * any malformed or unexpected input degrades to the curated fallback (Learning
 * #16) — completion-only data must never break editing or raise a false
 * "unknown option". `schema/cell-*.yml` entries become cell options and
 * `schema/document-*.yml` entries become front-matter keys (6d-4); `hidden`
 * entries are excluded from both.
 */
export function parseSchemaIndex(jsonText: string): SchemaIndex {
  try {
    const data = JSON.parse(stripBom(jsonText)) as Record<string, unknown>;
    const definitions = indexDefinitions(data["schema/definitions.yml"]);
    const cellFields = collectFields(data, "schema/cell-", definitions);
    const fmFields = collectFields(data, "schema/document-", definitions);
    // A valid JSON of an unexpected shape (no options found) is as useless as
    // unparseable input — degrade rather than offer nothing.
    return cellFields.length === 0 && fmFields.length === 0
      ? CURATED_SCHEMA_INDEX
      : indexOf(
          cellFields,
          fmFields,
          collectFormatNames(data),
          perFormatSource(fmFields, cellFields),
          parseFormatAliases(data["schema/format-aliases.yml"]),
          buildProjectConfigKeys(data, definitions),
        );
  } catch {
    return CURATED_SCHEMA_INDEX;
  }
}

/**
 * The per-format option source (Slice 6d-6+ b2-i, plan §2.3), mirroring Quarto's
 * `getFormatSchema` (`objectRefSchemaFromContextGlob("document-*")`): every
 * `document-*` field (document-level by file) PLUS the `cell-*` options whose
 * `tags.contexts` names a `document-*` context — the genuine per-format DOCUMENT
 * options (e.g. `code-fold`→`document-code`, `fig-align`→`document-figures`,
 * `code-line-numbers`, `tbl-colwidths`→`document-tables`, `cap-location`→`document-layout`).
 * A cell option that carries a `tags.formats` but NO document context (e.g.
 * `fig-alt`, `external`, dashboard's `color`/`content`) is CELL-ONLY — Quarto does
 * not offer it at format level, so it is excluded (the fold-in predicate is the
 * document context, not merely `tags.formats` present — review-caught fidelity).
 * De-duplicated by name, `document-*` winning. The `["format", fmt]` index branch
 * then filters this source by `formatMatches`.
 */
function perFormatSource(
  fmFields: SchemaField[],
  cellFields: SchemaField[],
): SchemaField[] {
  const seen = new Set(fmFields.map((f) => f.name));
  const scopedCell = cellFields.filter(
    (f) => hasDocumentContext(f) && !seen.has(f.name),
  );
  return [...fmFields, ...scopedCell];
}

/**
 * Whether a `cell-*` option belongs to a `document-*` schema context (its
 * `tags.contexts` has an entry matching the `document-*` glob), making it a
 * per-format DOCUMENT option in Quarto's `getFormatSchema` rather than a cell-only
 * option. The glob `document-*` is a prefix match on `document-`.
 */
function hasDocumentContext(field: SchemaField): boolean {
  return field.contexts?.some((c) => c.startsWith("document-")) === true;
}

/**
 * The `schema/format-aliases.yml` table (`{aliases: {name: members}}`) as a
 * `FormatAliases` map for `formatMatches`. Never throws: a missing/odd shape
 * yields an empty map, and non-string members are dropped — the filter then treats
 * an unknown `$`-alias as its bare name (a safe degradation, never wrong keys).
 */
function parseFormatAliases(raw: unknown): FormatAliases {
  const map: FormatAliases = new Map();
  if (raw === null || typeof raw !== "object") {
    return map;
  }
  const aliases = (raw as Record<string, unknown>).aliases;
  if (aliases === null || typeof aliases !== "object") {
    return map;
  }
  for (const [name, members] of Object.entries(aliases as Record<string, unknown>)) {
    if (Array.isArray(members)) {
      map.set(name, members.filter((m): m is string => typeof m === "string"));
    }
  }
  return map;
}

/**
 * Quarto's synthesized output formats, concatenated onto `pandoc/formats.yml`
 * exactly as the CLI's `makeFrontMatterFormatSchema` does: `md` (alias for
 * commonmark), `hugo` (now hugo-md), `dashboard` (Quarto's own), and `email`
 * (the HTML email format for Posit Connect).
 */
const FORMAT_SYNTHESIZED = ["md", "hugo", "dashboard", "email"];

/**
 * Format-name prefixes whose longer variants Quarto's `hideFormat` suppresses
 * from completion: `html4`/`html5`, `epub2`/`epub3`, `docbook4`/`docbook5` are
 * hidden while the base `html`/`epub`/`docbook` stay.
 */
const FORMAT_HIDE_PREFIXES = ["html", "epub", "docbook"];

/** Whether Quarto's `hideFormat` suppresses this format name (a longer variant of a base). */
function isHiddenFormat(name: string): boolean {
  return FORMAT_HIDE_PREFIXES.some((h) => name.startsWith(h) && name.length > h.length);
}

/**
 * The visible Quarto output-format names from the parsed `pandoc/formats.yml`
 * list, plus Quarto's synthesized formats, minus the hidden legacy variants —
 * mirroring the CLI's `makeFrontMatterFormatSchema`. Returns `[]` when the list
 * is absent/odd (degrade to nothing here; the whole-reader-failure path in
 * `parseSchemaIndex` serves the curated set instead). De-duplicates, first
 * occurrence winning. Format names carry no value enum or engine.
 */
function collectFormatNames(data: Record<string, unknown>): SchemaField[] {
  const raw = data["pandoc/formats.yml"];
  if (!Array.isArray(raw)) {
    return [];
  }
  const names = raw
    .filter((n): n is string => typeof n === "string" && n.length > 0)
    .concat(FORMAT_SYNTHESIZED);
  const fields: SchemaField[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    if (isHiddenFormat(name) || seen.has(name)) {
      continue;
    }
    seen.add(name);
    fields.push({ name });
  }
  return fields;
}

/**
 * How much completable information a `SchemaField` carries — its resolved
 * object children plus its resolved value enum. Used only to break a
 * same-name collision between two source entries (see `collectFields`); it is
 * not a quality ranking beyond that.
 */
function fieldRichness(field: SchemaField): number {
  return (field.children?.length ?? 0) + (field.values?.length ?? 0);
}

/**
 * Collect the de-duplicated, visible `SchemaField`s from every `schema/<prefix>…`
 * file in the parsed resource (e.g. `schema/cell-` for cell options,
 * `schema/document-` for front-matter keys). Quarto defines the same name more
 * than once in a handful of cases (e.g. `copyright` in both
 * `document-attributes.yml` and `document-metadata.yml`, one JATS-scoped and
 * bare, the other a real object with `year`/`holder`/`statement` children) —
 * on a collision, the entry with more completable information (`fieldRichness`)
 * wins, not whichever happens to iterate first (`Object.entries` order follows
 * the source JSON's own key order, an accident of file naming, not richness).
 * A tie keeps the first-seen entry, so ordering stays otherwise stable.
 */
function collectFields(
  data: Record<string, unknown>,
  prefix: string,
  definitions: Map<string, unknown>,
): SchemaField[] {
  const byName = new Map<string, SchemaField>();
  for (const [key, value] of Object.entries(data)) {
    if (!key.startsWith(prefix) || !Array.isArray(value)) {
      continue;
    }
    for (const entry of value) {
      const field = toField(entry, definitions);
      if (field === null) {
        continue;
      }
      const existing = byName.get(field.name);
      if (existing === undefined || fieldRichness(field) > fieldRichness(existing)) {
        byName.set(field.name, field);
      }
    }
  }
  return [...byName.values()];
}
