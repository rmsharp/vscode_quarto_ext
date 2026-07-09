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

import { mappingContainerKey } from "./yaml-context";

/** The three `_quarto.yml` blocks with a genuinely closed key set (plan §0). */
const PROJECT_CONFIG_CONTAINERS = new Set(["project", "website", "book"]);

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
  const lines = text.split(/\r?\n/);
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

/** The length of the leading whitespace (spaces/tabs) of `text`. */
function leadingWsLen(text: string): number {
  return /^[ \t]*/.exec(text)?.[0].length ?? 0;
}

/**
 * The key span of a `key:`/`key: value` mapping line at `indent`, or `null` if
 * the content at that indent is a block-sequence item (`- …`) or has no colon
 * (not a mapping-line shape).
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
  const key = rest.slice(0, colon).replace(/[ \t]+$/, "");
  if (key.length === 0) {
    return null;
  }
  return { key, keyRange: { startCol: indent, endCol: indent + key.length } };
}
