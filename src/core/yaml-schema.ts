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
