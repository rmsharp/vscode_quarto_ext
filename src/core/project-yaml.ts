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
import { scanFlow } from "./qmd/model";
import { leadingWsLen, mappingContainerKey, valueSlotAfterColon } from "./yaml-context";

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

/** One value line found inside `project:`/`website:`/`book:`, at depth-1 or depth-2. */
export interface ProjectConfigValueLine {
  line: number;
  container: "project" | "website" | "book";
  /**
   * The ancestor child keys between the container and this value's key, top-down.
   * `[]` for a DEPTH-1 child (`draft-mode: hidden` → `path:[]`); `[child]` for a
   * DEPTH-2 grandchild under a pure block-opener child (`navbar:\n  collapse-below: sm`
   * → `path:["navbar"]`). The compute resolves BY PATH — never bare `key` — because
   * grandchild names collide with depth-1 names, one collision being a CLOSED depth-1
   * enum (`book.type` CSL vs `book.cookie-consent.type`): bare-name resolution there is
   * a cardinal-sin FP, not merely a miss (depth-2 value plan §7.5/dragon 3). Shaped as
   * a list (not a scalar `parentChild`) to mirror `NestedFrontMatterValueLine.parentPath`
   * and stay forward-compatible with depth-3 (plan §10 Q4).
   */
  path: string[];
  /** The unquoted mapping key (schema-comparable, like `findProjectConfigKeyLines`). */
  key: string;
  /** The half-open `[startCol, endCol)` span of the value token on `line`. */
  valueRange: { startCol: number; endCol: number };
  /** The value token exactly as written (possibly quoted; trailing unquoted comment excluded). */
  rawToken: string;
}

/**
 * Enumerate every `project:`/`website:`/`book:` descendant that carries a non-empty
 * scalar VALUE — at DEPTH-1 (a direct child) or DEPTH-2 (a grandchild under a pure
 * block-opener child) — in document order, feeding `SchemaIndex.projectFields` (whose
 * fields now carry `.children`) + the shared `isWrongValue` matcher (depth-2 value
 * plan §3.2 B). Each emission carries a `path`: `[]` at depth-1, `[child]` at depth-2.
 *
 * A bounded TWO-level forward state machine. Container tracking is
 * `findProjectConfigKeyLines`'s (column-0 header sets scope; a genuine column-0 line
 * ends it). Above that: when a depth-1 line is a pure block-opener (`navbar:`, no
 * scalar), `childKey`/`childIndent` open a depth-2 scope; a depth-1 sibling or a
 * column-0 line closes it. Depth-3+ (`indent > childIndent`) and sequence-item
 * grandchildren are NOT emitted — the reader's `.children` is one level and the
 * enumerator caps at `path.length===1`, so deeper values are a safe false negative
 * (plan §4.2).
 *
 * The load-bearing safety property this surface's KEY enumerator lacks is the
 * `scanFlow` continuation guard, and at DEPTH-2 it has NO column-0 backstop (a folded
 * line can sit at any indent, §2.3/dragon 2): a mapping-looking line inside a
 * multi-line QUOTED value (`title: "…\n    collapse-below: x"`) or an unclosed FLOW
 * collection is part of the value quarto accepts (renders exit 0), so emitting it and
 * letting the matcher flag it would be a cardinal-sin false positive. `scanFlow` (the
 * shared quote/flow-aware scanner) tracks both and skips continuation lines regardless
 * of level; over-skipping when ambiguous is the safe false-negative direction.
 */
export function findProjectConfigValueLines(text: string): ProjectConfigValueLine[] {
  const lines = stripBom(text).split(/\r?\n/);
  const result: ProjectConfigValueLine[] = [];
  let currentContainer: "project" | "website" | "book" | null = null;
  let containerIndent: number | null = null;
  // Depth-2 scope: when a depth-1 line is a pure block-opener (`navbar:`), `childKey`
  // names it and `childIndent` (fixed on the first grandchild line) pins the depth-2
  // level. A depth-1 sibling or a column-0 line clears both. A depth-2 block-opener is
  // NOT tracked deeper — the reader/enumerator both cap at depth-2 (plan §3.2 B/§4.2).
  let childKey: string | null = null;
  let childIndent: number | null = null;
  // Continuation state of an unclosed multi-line value (plan §2.3/§7.3): a following
  // line — at ANY indent, or column 0 — is folded into the value, NOT a new mapping, so
  // it must be skipped or it reads as a real child and is flagged (the cardinal-sin FP
  // the KEY enumerator lacks a guard for). `scanFlow` tracks BOTH an unclosed flow
  // collection `{…}`/`[…]` (`flowDepth`) and an unterminated quoted scalar
  // `key: "text…` (`openQuote`); over-skipping is the safe false-negative direction.
  let flowDepth = 0;
  let openQuote: '"' | "'" | null = null;

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    if (flowDepth > 0 || openQuote !== null) {
      const s = scanFlow(lineText, flowDepth, openQuote);
      flowDepth = Math.max(0, s.depth);
      openQuote = s.quote;
      continue; // inside a multi-line flow/quoted value — never a new mapping
    }
    const trimmed = lineText.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue; // blank/comment lines never affect container scope
    }
    const indent = leadingWsLen(lineText);
    if (indent === 0) {
      const key = mappingContainerKey(lineText);
      currentContainer = key !== null && isProjectConfigContainer(key) ? key : null;
      containerIndent = null; // reset; set on the first child line seen under it
      childKey = null;
      childIndent = null;
      continue;
    }
    if (currentContainer === null) {
      continue;
    }
    if (containerIndent === null) {
      containerIndent = indent; // the first indented line under the container defines its depth
    }

    // Classify this line's level. `path === null` means out of scope (skip).
    let path: string[] | null = null;
    if (indent === containerIndent) {
      childKey = null; // a depth-1 line ends any previous child's depth-2 scope
      childIndent = null;
      path = [];
    } else if (indent > containerIndent) {
      if (childKey === null) {
        continue; // no open block-opener child (the depth-1 parent was a scalar) → skip
      }
      if (childIndent === null) {
        childIndent = indent; // first grandchild line pins the depth-2 level
      }
      if (indent !== childIndent) {
        continue; // depth-3+ (deeper than the depth-2 level) — capped, safe FN
      }
      path = [childKey];
    } else {
      continue; // shallower than the child indent but not column 0 — malformed, skip
    }

    if (lineText.slice(indent).startsWith("-")) {
      continue; // a block-sequence item hosts no mapping value
    }
    const colon = lineText.indexOf(":", indent);
    if (colon < 0) {
      continue; // no colon → no mapping value to check
    }
    const rawKey = lineText.slice(indent, colon).replace(/[ \t]+$/, "");
    if (rawKey.length === 0) {
      continue; // `: value` with no key — malformed
    }
    const valueSlot = valueSlotAfterColon(lineText, colon);
    const rawToken = lineText.slice(valueSlot.startCol, valueSlot.endCol);
    if (rawToken.length === 0) {
      // A pure block-opener. At DEPTH-1 it opens a depth-2 child scope; at DEPTH-2 it is
      // a depth-3 container we never descend into (childKey stays the depth-1 parent).
      if (path.length === 0) {
        childKey = unquoteKey(rawKey);
        childIndent = null;
      }
      continue;
    }
    result.push({
      line: i,
      container: currentContainer,
      path,
      key: unquoteKey(rawKey),
      valueRange: { startCol: valueSlot.startCol, endCol: valueSlot.endCol },
      rawToken,
    });
    // Arm the continuation-skip if THIS value opens an unclosed flow collection OR an
    // unterminated quoted scalar — the depth-2 scanFlow FP guard (no column-0 backstop,
    // §2.3). Scanned over the WHOLE token (not a first-char test) so an anchored/tagged
    // opener `foo: &a { …` still arms its flow, and `title: "text…` arms its quote
    // (mirrors `findNestedFrontMatterValueLines`).
    const s = scanFlow(rawToken, 0, null);
    if (s.depth > 0) {
      flowDepth = s.depth;
    }
    if (s.quote !== null) {
      openQuote = s.quote;
    }
  }
  return result;
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
