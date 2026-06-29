/**
 * Pure, `vscode`-free Quarto YAML schema data (architecture plan §3.3; Phase 6d
 * plan §5.3).
 *
 * Slice 6d-1 ships only the curated fallback set of cell options — the `SchemaField`
 * shape plus `CURATED_CELL_OPTIONS`. A later slice (6d-3) adds the runtime reader
 * that enriches this from the user's installed Quarto schema and degrades to this
 * curated set on any failure, so this list is the permanent fallback, never
 * throwaway. Option *names* are uncopyrightable facts (confirmed against the live
 * Quarto 1.7.33 schema); the descriptions here are our own concise wording, so the
 * curated set is independently license-clean (no redistribution of Quarto data).
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
}

/** Build a `SchemaIndex` over a fixed list of fields (the parser and the fallback share this). */
function indexOf(fields: SchemaField[]): SchemaIndex {
  return {
    cellOptions(engine) {
      if (engine === undefined) {
        return fields;
      }
      return fields.filter((f) => f.engine === undefined || f.engine === engine);
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
export const CURATED_SCHEMA_INDEX: SchemaIndex = indexOf(CURATED_CELL_OPTIONS);

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
 * "unknown option". Only `schema/cell-*.yml` entries become cell options;
 * `schema/document-*.yml` (front-matter keys) and `hidden` entries are excluded.
 */
export function parseSchemaIndex(jsonText: string): SchemaIndex {
  try {
    const data = JSON.parse(stripBom(jsonText)) as Record<string, unknown>;
    const definitions = indexDefinitions(data["schema/definitions.yml"]);
    const fields: SchemaField[] = [];
    const seen = new Set<string>();
    for (const [key, value] of Object.entries(data)) {
      if (!key.startsWith("schema/cell-") || !Array.isArray(value)) {
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
    // A valid JSON of an unexpected shape (no cell options found) is as useless
    // as unparseable input — degrade rather than offer nothing.
    return fields.length > 0 ? indexOf(fields) : CURATED_SCHEMA_INDEX;
  } catch {
    return CURATED_SCHEMA_INDEX;
  }
}
