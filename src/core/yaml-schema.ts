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
    values: ["true", "false", "fenced"],
  },
  {
    name: "eval",
    description: "Evaluate the cell; `false` echoes the code without running it.",
    values: BOOL,
  },
  {
    name: "output",
    description: "Include execution results in the output (`true`/`false`/`asis`).",
    values: ["true", "false", "asis"],
  },
  {
    name: "warning",
    description: "Include warnings in the rendered output.",
    values: BOOL,
  },
  {
    name: "error",
    description: "Include errors in the output instead of halting the render.",
    values: BOOL,
  },
  {
    name: "include",
    description: "Master switch: suppress all of the cell's output (code and results).",
    values: BOOL,
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
    values: ["default", "left", "right", "center"],
  },
  { name: "tbl-cap", description: "Caption for the table the cell produces." },
  {
    name: "code-fold",
    description: "Collapse the code into an expandable block (`true`/`false`/`show`).",
    values: ["true", "false", "show"],
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
  },
  {
    name: "layout-ncol",
    description: "Number of columns to lay the cell's output into.",
  },
  {
    name: "column",
    description: "Page column for the cell's output (e.g. `body`, `page`, `margin`).",
    values: PAGE_COLUMNS,
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
   * derived with a curated fallback). Any other path — a non-allow-listed
   * container or a deeper nesting — yields `[]` (recursive resolution is deferred).
   */
  frontMatterKeys(parentPath: string[]): SchemaField[];
}

/**
 * Build a `SchemaIndex` over fixed cell-option and front-matter-key lists (the
 * parser and the curated fallback share this).
 */
function indexOf(
  cellFields: SchemaField[],
  fmFields: SchemaField[],
  formatFields: SchemaField[],
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
      return [];
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
 * The curated cell options as a `SchemaIndex` — the permanent fallback the
 * runtime reader degrades to whenever the installed schema cannot be read or
 * parsed (Phase 6d plan §2.5). Interchangeable with a parsed index.
 */
export const CURATED_SCHEMA_INDEX: SchemaIndex = indexOf(
  CURATED_CELL_OPTIONS,
  CURATED_FRONTMATTER_KEYS,
  CURATED_FORMAT_NAMES,
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
  if (Array.isArray(s.enum)) {
    return dedupe(s.enum.map(scalarToYaml).filter((v): v is string => v !== null));
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
  return []; // arrayOf, object, and other deferred forms
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
  const engine = engineTag(e.tags);
  if (engine !== undefined) {
    field.engine = engine;
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
      : indexOf(cellFields, fmFields, collectFormatNames(data));
  } catch {
    return CURATED_SCHEMA_INDEX;
  }
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
 * Collect the de-duplicated, visible `SchemaField`s from every `schema/<prefix>…`
 * file in the parsed resource (e.g. `schema/cell-` for cell options,
 * `schema/document-` for front-matter keys). First occurrence of a name wins.
 */
function collectFields(
  data: Record<string, unknown>,
  prefix: string,
  definitions: Map<string, unknown>,
): SchemaField[] {
  const fields: SchemaField[] = [];
  const seen = new Set<string>();
  for (const [key, value] of Object.entries(data)) {
    if (!key.startsWith(prefix) || !Array.isArray(value)) {
      continue;
    }
    for (const entry of value) {
      const field = toField(entry, definitions);
      if (field !== null && !seen.has(field.name)) {
        seen.add(field.name);
        fields.push(field);
      }
    }
  }
  return fields;
}
