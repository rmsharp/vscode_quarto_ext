/**
 * Pure, `vscode`-free YAML completion-position discriminator for a Quarto `.qmd`
 * document (architecture plan §3.3; Phase 6d plan §5.2).
 *
 * Given the document text and a character offset, `completionContextAt` answers
 * "is the cursor at a completable YAML position, and which kind?" — so the thin
 * adapter (`providers/yaml.ts`) can offer the right suggestions and gate itself
 * to YAML regions (the inverse of the `@` cross-ref/citation providers, which
 * gate to prose — Phase 6d plan §4.3). It returns `null` everywhere else (prose,
 * code, value positions not yet supported), so the provider naturally yields no
 * items outside its region.
 *
 * Slices 6d-1/6d-2 implement `cell-option-key` (the `#|` / `//|` key slot) and
 * `cell-option-value` (the slot after the `:`); slices 6d-4/6d-5 add the
 * front-matter complement — `frontmatter-key` (a top-level `---`-block key) and
 * `frontmatter-value` (the slot after that key's colon).
 */

import { findCellOptionLines, inFrontMatter } from "./qmd/model";

/** Which kind of YAML position the cursor is at. */
export type YamlContextKind =
  | "cell-option-key"
  | "cell-option-value"
  | "frontmatter-key"
  | "frontmatter-value";

/** The cell engine a cell-option line belongs to, approximated from the cell language. */
export type CellEngine = "knitr" | "jupyter" | "ojs";

/** A completable YAML position: what to complete, the partial token, and the replace span. */
export interface YamlCompletionContext {
  /** The kind of completion this position calls for. */
  kind: YamlContextKind;
  /** The mapping path to this position; `[]` at the document/cell-option root. */
  parentPath: string[];
  /** The partial key/value text already typed from the slot start to the cursor (may be `""`). */
  token: string;
  /**
   * The half-open span `[startCol, endCol)` on `line` that accepting a completion
   * replaces — the whole token, not just up to the cursor, so a mid-token accept
   * does not duplicate the trailing suffix (Learning #15b).
   */
  replaceRange: { line: number; startCol: number; endCol: number };
  /** For cell-option positions: the owning cell's engine (approximated from `cell.lang`). */
  engine?: CellEngine;
}

/**
 * The completion context at 0-based character `offset` in `text`, or `null` if
 * the cursor is not at a YAML position these slices complete. A position is
 * completable when the cursor is on a `#|` / `//|` cell-option line — within the
 * key slot (`cell-option-key`) or the value slot after the `:` (`cell-option-value`)
 * — or on a top-level front-matter line, within its key slot (`frontmatter-key`)
 * or value slot (`frontmatter-value`). A prose or code line, an indented/sequence
 * line, or the whitespace gap before a value all yield `null`.
 */
export function completionContextAt(
  text: string,
  offset: number,
): YamlCompletionContext | null {
  const { line, col } = lineColAt(text, offset);
  const lineText = text.split(/\r?\n/)[line] ?? "";

  const optLine = findCellOptionLines(text).find((o) => o.line === line);
  if (optLine === undefined) {
    // Not a `#|` / `//|` cell-option line. The only other completable YAML region
    // is the document's front matter (top-level keys — 6d-4); everywhere else
    // (prose, code) yields null, preserving the inverse-gating contract (§4.3).
    return inFrontMatter(text, line)
      ? frontMatterContextAt(text, line, col)
      : null;
  }
  const key = optLine.keySlot;
  const engine = engineFor(optLine.cellLang);

  // Key context while the cursor is within the key slot (≤ the colon).
  if (key !== null && col >= key.startCol && col <= key.endCol) {
    return {
      kind: "cell-option-key",
      parentPath: [],
      token: lineText.slice(key.startCol, col),
      replaceRange: { line, startCol: key.startCol, endCol: key.endCol },
      engine,
    };
  }

  // Value context while the cursor is within the value slot (after the colon).
  // `parentPath` carries the key being valued (plan §5.2). A cursor in the
  // whitespace gap before the value (col < value.startCol) falls through to null.
  const value = optLine.valueSlot;
  if (key !== null && value !== null && col >= value.startCol && col <= value.endCol) {
    return {
      kind: "cell-option-value",
      parentPath: [lineText.slice(key.startCol, key.endCol)],
      token: lineText.slice(value.startCol, col),
      replaceRange: { line, startCol: value.startCol, endCol: value.endCol },
      engine,
    };
  }
  return null;
}

/**
 * The front-matter KEY or VALUE context at character `col` on line `line` of
 * `text` (already known to be a front-matter content line), or `null` if the
 * cursor is not in a completable slot. A top-level (column-0) mapping completes
 * its key slot (at or before the `:` — `frontmatter-key`, 6d-4) and value slot
 * (after the `:` — `frontmatter-value`, 6d-5), with `parentPath` carrying the key
 * being valued. An INDENTED line falls through to `nestedKeyContextAt` (6d-6),
 * which completes a nested key one level under an allow-listed container. A
 * sequence/comment line, or the whitespace gap before a value, yields `null`.
 */
function frontMatterContextAt(
  text: string,
  line: number,
  col: number,
): YamlCompletionContext | null {
  const lines = text.split(/\r?\n/);
  const lineText = lines[line] ?? "";
  const { keySlot, valueSlot } = topLevelSlots(lineText);
  if (keySlot === null) {
    // Not a top-level mapping line. The only other completable front-matter
    // position is a nested key one level under an allow-listed container (6d-6).
    return nestedKeyContextAt(lines, line, col);
  }
  if (col >= keySlot.startCol && col <= keySlot.endCol) {
    return {
      kind: "frontmatter-key",
      parentPath: [],
      token: lineText.slice(keySlot.startCol, col),
      replaceRange: { line, startCol: keySlot.startCol, endCol: keySlot.endCol },
    };
  }
  if (valueSlot !== null && col >= valueSlot.startCol && col <= valueSlot.endCol) {
    return {
      kind: "frontmatter-value",
      parentPath: [lineText.slice(keySlot.startCol, keySlot.endCol)],
      token: lineText.slice(valueSlot.startCol, col),
      replaceRange: { line, startCol: valueSlot.startCol, endCol: valueSlot.endCol },
    };
  }
  return null;
}

/**
 * The nested front-matter KEY or VALUE context for an indented line whose
 * enclosing structure is one this slice completes, or `null`. The detector is
 * deliberately conservative — it offers nested keys ONLY when nesting is
 * unambiguous, and **bails (`null`) on anything else** rather than offer wrong
 * keys (plan §7): the line must be an indented key line (not a `- ` sequence item
 * or a `#` comment) and its enclosing container(s) must form one of the shapes
 * `nestedParentPath` allows — one level under an allow-listed container
 * (`execute:`/`format:` → `[container]`) or any number of levels rooted at a
 * column-0 `format:` (`format:\n  <fmt>:\n    <opt>:\n      <key>` → `["format",
 * <fmt>, <opt>]`, Slices 6d-6+ b2-i / b2-iii-key). The detector is schema-free and
 * emits the full path regardless of depth; the reader gates how deep it resolves.
 * The key slot completes a nested key (`frontmatter-key`); the value slot past the
 * colon completes that child key's values (`frontmatter-value`, `parentPath` =
 * [container…, key]).
 */
function nestedKeyContextAt(
  lines: string[],
  line: number,
  col: number,
): YamlCompletionContext | null {
  const lineText = lines[line] ?? "";
  const indented = /^([ \t]+)(.*)$/.exec(lineText);
  if (indented === null) {
    return null; // a column-0 line is handled by the top-level path, not here
  }
  const indent = indented[1].length;
  const rest = indented[2];
  if (rest.startsWith("-") || rest.startsWith("#")) {
    return null; // a block-sequence item / comment hosts no nested key
  }
  // The mapping path from the document root to this line (one or two levels), or
  // `null` if the enclosing structure is not one this slice completes.
  const parentPath = nestedParentPath(lines, line, indent);
  if (parentPath === null) {
    return null;
  }
  const nlColon = lineText.indexOf(":", indent);
  const keyText = (
    nlColon >= 0 ? lineText.slice(indent, nlColon) : lineText.slice(indent)
  ).replace(/[ \t]+$/, "");
  const keySlot: Slot = { startCol: indent, endCol: indent + keyText.length };
  if (col >= keySlot.startCol && col <= keySlot.endCol) {
    return {
      kind: "frontmatter-key",
      parentPath,
      token: lineText.slice(keySlot.startCol, col),
      replaceRange: { line, startCol: keySlot.startCol, endCol: keySlot.endCol },
    };
  }
  // A nested VALUE position past the colon: complete the child key's enum/boolean
  // values. `parentPath` grows to [container…, key being valued] so the provider
  // resolves them from `frontMatterKeys(parentPath.slice(0,-1))`. The value slot
  // uses the same grammar as a top-level value (shared helper).
  if (nlColon >= 0) {
    const valueSlot = valueSlotAfterColon(lineText, nlColon);
    if (col >= valueSlot.startCol && col <= valueSlot.endCol) {
      return {
        kind: "frontmatter-value",
        parentPath: [...parentPath, keyText],
        token: lineText.slice(valueSlot.startCol, col),
        replaceRange: { line, startCol: valueSlot.startCol, endCol: valueSlot.endCol },
      };
    }
  }
  return null; // the whitespace gap before a value, or anywhere else
}

/**
 * The mapping path from the document root to an option line indented at `indent`,
 * or `null` if the enclosing structure is not one this slice completes. A bounded
 * ancestor walk that climbs pure-mapping levels up to a column-0 root:
 *   - ONE level: the nearest shallower line is a column-0 allow-listed container
 *     (`execute:` / `format:`) → `[container]`;
 *   - N levels (`format`-rooted only): the immediate container is itself indented,
 *     so the walk climbs each pure-mapping ancestor, collecting keys, until it
 *     reaches a column-0 line — and returns the path ONLY when that root is
 *     `format:` (`format:\n  <fmt>:\n    <opt>:\n      <key>` → `["format", <fmt>,
 *     <opt>]`, Slices b2-i / b2-iii-key). The detector is schema-free: it emits the
 *     full path regardless of depth (position ⊥ data — the reader decides what a
 *     name resolves to, and gates depth). `execute:` stays one level (its own
 *     second level is not a format).
 * Bails (`null`) on anything else — a non-`format` column-0 root, a scalar / flow /
 * block-scalar intermediate container, or a sequence item — rather than offer wrong
 * keys (plan §7).
 */
function nestedParentPath(
  lines: string[],
  line: number,
  indent: number,
): string[] | null {
  const parentLine = nearestShallowerLine(lines, line, indent);
  if (parentLine < 0) {
    return null;
  }
  const container = mappingContainerKey(lines[parentLine] ?? "");
  if (container === null) {
    return null;
  }
  const parentIndent = leadingWsLen(lines[parentLine] ?? "");
  if (parentIndent === 0) {
    // One level: a column-0 allow-listed container (`execute:` / `format:`).
    return NESTED_CONTAINERS.has(container) ? [container] : null;
  }
  // The immediate container is indented — climb each pure-mapping ancestor,
  // prepending its key, until a column-0 root. Return the collected path only when
  // that root is `format:` (any non-`format` root, like the `execute:` second level
  // or a `website:` block, bails). Bounded by the line count.
  const path = [container];
  let cur = parentLine;
  let curIndent = parentIndent;
  for (;;) {
    const up = nearestShallowerLine(lines, cur, curIndent);
    if (up < 0) {
      return null;
    }
    const key = mappingContainerKey(lines[up] ?? "");
    if (key === null) {
      return null; // a scalar / flow / block-scalar / sequence intermediate
    }
    path.unshift(key);
    const upIndent = leadingWsLen(lines[up] ?? "");
    if (upIndent === 0) {
      return key === "format" ? path : null;
    }
    cur = up;
    curIndent = upIndent;
  }
}

/**
 * The key of a *pure mapping* container line — a `key:` whose value is empty or
 * only a comment, so its children live on following indented lines — or `null` if
 * the line is a sequence item, a comment, has no colon, or carries a scalar / flow
 * / block-scalar value (`key: v`, `key: [..]`, `key: |`). Leading indentation is
 * ignored; the caller decides how deep the container sits. Exported for reuse by
 * `core/project-yaml.ts`'s whole-document `_quarto.yml` container scan (YAML
 * schema diagnostics plan §5.2/R5) — the same line-local, position-independent
 * check, just called in a forward loop instead of a cursor-anchored ancestor walk.
 */
export function mappingContainerKey(text: string): string | null {
  const trimmed = text.replace(/^[ \t]+/, "");
  if (trimmed.startsWith("-") || trimmed.startsWith("#")) {
    return null;
  }
  const colon = trimmed.indexOf(":");
  if (colon < 0) {
    return null;
  }
  const value = trimmed.slice(colon + 1).replace(/^[ \t]+/, "");
  if (value !== "" && !value.startsWith("#")) {
    return null; // a scalar / flow / block-scalar value → not a pure mapping
  }
  return trimmed.slice(0, colon).replace(/[ \t]+$/, "");
}

/**
 * The length of the leading whitespace (spaces/tabs) of `text`. Exported for
 * reuse by `core/project-yaml.ts` (adversarial review, Session 47) — the same
 * line-local indent measurement, avoiding a byte-for-byte duplicate.
 */
export function leadingWsLen(text: string): number {
  return /^[ \t]*/.exec(text)?.[0].length ?? 0;
}

/**
 * The INDEX of the nearest line above `line` whose indentation is strictly less
 * than `indent`, skipping blank and comment lines, or `-1` if none — the
 * enclosing-mapping candidate for the ancestor walk. Lines at or deeper than
 * `indent` (siblings or deeper structure) are skipped so an intervening deeper
 * block does not hide the real parent. Returning the index (not the text) lets
 * the caller walk a second level up from the parent's own line.
 */
function nearestShallowerLine(
  lines: string[],
  line: number,
  indent: number,
): number {
  for (let i = line - 1; i >= 0; i--) {
    const t = lines[i] ?? "";
    if (t.trim() === "") {
      continue;
    }
    const lead = leadingWsLen(t);
    if (t.slice(lead).startsWith("#")) {
      continue;
    }
    if (lead < indent) {
      return i;
    }
  }
  return -1;
}

/**
 * Front-matter mapping keys whose children are completed one level deep (Slice
 * 6d-6). Two containers in v1:
 *   - `execute` — its child KEYS and their VALUES come from a curated set (the
 *     live schema assembles the execute object across multiple files — deferred).
 *   - `format` — its child keys are FORMAT NAMES (`html`, `pdf`, `revealjs`, …),
 *     which the schema reader derives from the live `pandoc/formats.yml` list
 *     (with a curated fallback), so format completion tracks the user's Quarto.
 *     The provider is generic over `parentPath`, so `["format"]` resolves through
 *     the same `frontMatterKeys` path as `["execute"]`.
 * Per-format options — the level under a format name, `format:\n  html:\n    <key>`
 * — and their object sub-keys (`format:\n  html:\n    <opt>:\n      <key>`) are
 * completed by the `format`-rooted ancestor walk (`nestedParentPath`), yielding
 * `parentPath` `["format", <fmt>, …]` of the corresponding length (Slices 6d-6+
 * b2-i / b2-iii-key). The `execute:` container stays one level (its own second
 * level is not a format). The walk is schema-free; the reader (`frontMatterKeys`)
 * resolves one object level under a format option and returns nothing deeper
 * (depth-4+ is the deferred residue, b2-iii-deep).
 */
const NESTED_CONTAINERS = new Set<string>(["execute", "format"]);

type Slot = { startCol: number; endCol: number };

/**
 * The top-level key and value token spans on a front-matter line, or both `null`
 * if the line cannot host a top-level mapping. A top-level key starts at column 0
 * (no indentation) and runs to the first `:` (trailing whitespace before the
 * colon excluded). An indented line is a nested key (deferred to 6d-6); a `- …`
 * line is a block-sequence item; a `# …` line is a YAML comment — none host a
 * top-level key, so all yield `{ null, null }`. The value span (when a `:` is
 * present) starts after the colon with leading whitespace skipped and a trailing
 * unquoted inline comment / whitespace excluded — the same grammar the
 * cell-option `slotsOf` (`core/qmd/model`) applies to a `#|` value.
 */
function topLevelSlots(
  lineText: string,
): { keySlot: Slot | null; valueSlot: Slot | null } {
  if (/^[ \t]/.test(lineText) || lineText.startsWith("-") || lineText.startsWith("#")) {
    return { keySlot: null, valueSlot: null };
  }
  const colon = lineText.indexOf(":");
  const keyText = (colon >= 0 ? lineText.slice(0, colon) : lineText).replace(
    /[ \t]+$/,
    "",
  );
  const keySlot: Slot = { startCol: 0, endCol: keyText.length };
  return {
    keySlot,
    valueSlot: colon < 0 ? null : valueSlotAfterColon(lineText, colon),
  };
}

/**
 * The value token span on `lineText` after the colon at index `colon`. Leading
 * whitespace after the colon is skipped, and a trailing unquoted inline comment /
 * whitespace excluded — the YAML value grammar shared by a top-level front-matter
 * line (`topLevelSlots`), a nested front-matter line (`nestedKeyContextAt`), and
 * the cell-option `slotsOf` (`core/qmd/model`). A `#` begins a comment when at the
 * value start or whitespace-preceded; quoted scalars are left intact, and
 * enum/boolean values never contain `#`, so this only narrows the commented case.
 */
function valueSlotAfterColon(lineText: string, colon: number): Slot {
  const afterColon = colon + 1;
  const region = lineText.slice(afterColon);
  const wsLen = (region.match(/^[ \t]*/) ?? [""])[0].length;
  let valueRaw = region.slice(wsLen);
  if (!/^["']/.test(valueRaw)) {
    const c = valueRaw.startsWith("#") ? 0 : valueRaw.search(/\s#/);
    if (c >= 0) {
      valueRaw = valueRaw.slice(0, c);
    }
  }
  const valueText = valueRaw.replace(/\s+$/, "");
  const valueStart = afterColon + wsLen;
  return { startCol: valueStart, endCol: valueStart + valueText.length };
}

/**
 * The cell engine for a cell language: knitr for `{r}`, jupyter for
 * `{python}`/`{julia}`, ojs for `{ojs}`/`{js}`. An unrecognized language yields
 * `undefined` (engine-agnostic) — a benign over-offer, refined in a later slice.
 */
function engineFor(lang: string): CellEngine | undefined {
  switch (lang.toLowerCase()) {
    case "r":
      return "knitr";
    case "python":
    case "julia":
      return "jupyter";
    case "ojs":
    case "js":
      return "ojs";
    default:
      return undefined;
  }
}

/**
 * The 0-based (line, col) of `offset` in `text`, counting `\n` as the line break
 * (matching `vscode.TextDocument.offsetAt`, which walks the raw buffer). A `\r`
 * before a `\n` belongs to the preceding line, so columns within a `\r\n` line
 * agree with the model's `\r?\n`-split line text for any cursor before the `\r`.
 */
function lineColAt(text: string, offset: number): { line: number; col: number } {
  const clamped = Math.max(0, Math.min(offset, text.length));
  let line = 0;
  let lineStart = 0;
  for (let i = 0; i < clamped; i++) {
    if (text[i] === "\n") {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, col: clamped - lineStart };
}
