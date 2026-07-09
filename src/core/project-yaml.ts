/**
 * Pure, `vscode`-free whole-document scanner for `_quarto.yml`/`_quarto.yaml`
 * (YAML schema diagnostics plan §2.3/§5.2).
 *
 * `_quarto.yml` is a bare YAML file — no `---` front-matter fences — so none of
 * `qmd/model.ts`'s fence-anchored scanning applies. `findProjectConfigKeyLines`
 * enumerates every direct child key line under a top-level `project:`, `website:`,
 * or `book:` block (the only genuinely closed-schema surfaces — plan §0), so the
 * diagnostics feature can check each against the schema's known key set. A single
 * forward pass, O(n) in line count.
 */

import * as path from "node:path";
import { leadingWsLen, mappingContainerKey } from "./yaml-context";

/** The three `_quarto.yml` blocks with a genuinely closed key set (plan §0). */
const PROJECT_CONFIG_CONTAINERS = new Set(["project", "website", "book"]);

/** The exact basenames this feature validates — never a suffix match. */
const PROJECT_CONFIG_FILENAMES = new Set(["_quarto.yml", "_quarto.yaml"]);

/**
 * Whether `fileName` (a full OS path, or a bare name) is EXACTLY
 * `_quarto.yml`/`_quarto.yaml` — the filename gate (adversarial review,
 * Session 47). Compares the basename only, so a directory component that
 * happens to match (`/a/_quarto.yml/b.txt`) does not — and, critically, this
 * is exact equality, NOT a suffix test: `document.fileName.endsWith(...)`
 * (the original shape) would also match `not_quarto.yml`/`backup_quarto.yaml`/
 * any other file merely ending in those characters, a confirmed false
 * positive this rewrite eliminates.
 */
export function isProjectConfigFileName(fileName: string): boolean {
  return PROJECT_CONFIG_FILENAMES.has(path.basename(fileName));
}

/** One key line found directly inside `project:`/`website:`/`book:`. */
export interface ProjectConfigKeyLine {
  line: number;
  container: "project" | "website" | "book";
  key: string;
  keyRange: { startCol: number; endCol: number };
}

/**
 * Enumerate every direct child key line under a top-level `project:`,
 * `website:`, or `book:` block in `_quarto.yml`/`_quarto.yaml`'s content. Deeper
 * nesting, a dedent, a block-sequence item, and any other top-level key are all
 * silently skipped — never a false flag (plan §2.3).
 *
 * A genuine column-0 line (not blank/comment) always ends the current
 * container's scope, whether or not it is itself a pure-mapping container —
 * YAML block scope cannot survive a return to column 0. This also protects a
 * container with NO children yet: without this reset, a column-0 sibling key
 * immediately following an empty `project:` could be misread as `project:`'s
 * first child (its indent, 0, would equal the container's own column, and
 * nothing would have set `containerIndent` yet to rule it out).
 */
export function findProjectConfigKeyLines(text: string): ProjectConfigKeyLine[] {
  const lines = stripBom(text).split(/\r?\n/);
  const result: ProjectConfigKeyLine[] = [];
  let currentContainer: "project" | "website" | "book" | null = null;
  let containerIndent: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    const trimmed = lineText.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue; // blank/comment lines never affect container scope
    }
    const indent = leadingWsLen(lineText);
    if (indent === 0) {
      const key = mappingContainerKey(lineText);
      currentContainer = key !== null && isProjectConfigContainer(key) ? key : null;
      containerIndent = null; // reset; set on the first child line seen under it
      continue;
    }
    if (currentContainer === null) {
      continue;
    }
    if (containerIndent === null) {
      containerIndent = indent; // the first indented line under the container defines its depth
    }
    if (indent !== containerIndent) {
      continue; // deeper nesting or a dedent — out of v1 scope, skip
    }
    const span = keySpanAt(lineText, indent);
    if (span === null) {
      continue; // a block-sequence item, or anything else that isn't a `key:` line
    }
    result.push({ line: i, container: currentContainer, key: span.key, keyRange: span.keyRange });
  }
  return result;
}

function isProjectConfigContainer(name: string): name is "project" | "website" | "book" {
  return PROJECT_CONFIG_CONTAINERS.has(name);
}

/**
 * Strip a leading UTF-8 BOM, which would otherwise glue itself to the first
 * line's content and stop `mappingContainerKey` from recognizing a top-level
 * `project:`/`website:`/`book:` on line 0 (adversarial review, Session 47 —
 * mirrors `yaml-schema.ts`'s identical `stripBom`, applied to the schema
 * JSON text rather than `_quarto.yml`'s own content).
 */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * The key span of a `key:`/`key: value` mapping line at `indent`, or `null` if
 * the content at that indent is a block-sequence item (`- …`) or has no colon
 * (not a mapping-line shape). `keyRange` spans the FULL token as it appears on
 * screen (quotes included, if any); `key` is unquoted (adversarial review,
 * Session 47 — a quoted key like `"output-dir":` is YAML-legal and semantically
 * identical to its unquoted form, confirmed against the real Quarto CLI, but
 * was previously compared against the schema's bare names WITH the quote
 * characters still attached, producing a false "unknown key" positive on every
 * quoted key, known or not).
 */
function keySpanAt(
  lineText: string,
  indent: number,
): { key: string; keyRange: { startCol: number; endCol: number } } | null {
  const rest = lineText.slice(indent);
  if (rest.startsWith("-")) {
    return null;
  }
  const colon = rest.indexOf(":");
  if (colon < 0) {
    return null;
  }
  const raw = rest.slice(0, colon).replace(/[ \t]+$/, "");
  if (raw.length === 0) {
    return null;
  }
  return { key: unquoteKey(raw), keyRange: { startCol: indent, endCol: indent + raw.length } };
}

/**
 * Strip one matching layer of YAML key-quoting (`"key"` or `'key'`) to the
 * logical key name, or return `key` unchanged if it isn't quoted. Does not
 * attempt escape decoding — no real project:/website:/book: key name
 * contains a quote character, so this is sufficient for schema comparison.
 */
function unquoteKey(key: string): string {
  if (key.length >= 2) {
    const first = key[0];
    const last = key[key.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return key.slice(1, -1);
    }
  }
  return key;
}
