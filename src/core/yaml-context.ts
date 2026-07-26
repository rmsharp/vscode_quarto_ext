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

import type { DocumentEngine } from "./document-engine";
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
 *
 * Exported so the nested front-matter VALUE enumerator
 * (`core/yaml-frontmatter-nested-values.ts`) reuses the SAME tested ancestor walk in a
 * forward per-line loop instead of a cursor-anchored one (nested value-validation plan
 * §3.3) — the same "forward loop, not cursor walk" reuse `mappingContainerKey`/
 * `leadingWsLen` were exported for. It returns the CONTAINER path EXCLUDING the line's
 * own key (unlike the completion CONTEXT's `parentPath`, which appends the key), so the
 * enumerator resolves with `frontMatterKeys(parentPath).find(name === key)`.
 */
export function nestedParentPath(
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
 * Front-matter mapping keys whose children are validated/completed one level deep
 * (Slice 6d-6, widened by the other-container value slice — plan §3.2). `execute`
 * and `format` are the two SPECIAL-CASED containers (their `frontMatterKeys` reader
 * branches differ); the other 15 (listed in the set below) resolve through the
 * general length-1 reader branch. The two special cases:
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
const NESTED_CONTAINERS = new Set<string>([
  "execute",
  "format",
  // Other-container value validation (plan §3.2 change B): 15 top-level object
  // containers grounded firsthand (`quarto render` 1.7.33) to carry ≥1 provably-closed
  // one-level child (plan §2.2). The reader's general length-1 branch already resolves
  // their annotated `.children`; THIS gate is the single source of truth for which
  // containers the nested enumerator + completion detector descend into. Grounded OUT
  // and deliberately absent: `website`/`book`/`project` (an `_quarto.yml` project-config
  // surface, not `.qmd` front matter) and `brand`/`jupyter` (no closed one-level child).
  "about",
  "code-tools",
  "crossref",
  "editor",
  "identifier",
  "ibooks",
  "grid",
  "lightbox",
  "notebook-preview-options",
  "listing",
  "mermaid",
  "html-math-method",
  "menu",
  "chalkboard",
  "scroll-view",
]);

export type Slot = { startCol: number; endCol: number };

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
 *
 * Exported so the Phase-2 front-matter VALUE enumerator
 * (`core/yaml-frontmatter-values.ts`) reuses the SAME top-level line grammar the
 * completion path uses (value-validation plan §4.2) — single-sourced, not a
 * second top-level `key: value` parser.
 */
export function topLevelSlots(
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
  // ⚠ NO separator guard here, deliberately (S148). `isMappingSeparator` is a
  // DIAGNOSTICS-side rule, applied by the value ENUMERATORS, not by this shared
  // grammar: a `key:value` line with no space is not a YAML mapping, but for
  // COMPLETION it is a user mid-typing, and the provider deliberately offers the
  // value with a PREPENDED SPACE to repair it (`code-overflow:scroll` → ` scroll`,
  // pinned by test/integration/suite/yaml.test.ts). Narrowing the value slot here
  // silently removes that affordance on both the top-level and nested paths.
  return {
    keySlot,
    valueSlot: colon < 0 ? null : valueSlotAfterColon(lineText, colon),
  };
}

/**
 * Is the colon at index `colon` on `lineText` a YAML block-mapping key/value
 * SEPARATOR? YAML's separator is a colon followed by a space, a tab, or the end
 * of the line — a colon followed by anything else is an ordinary character
 * inside the key's plain scalar.
 *
 * Single-sourced here and applied (via `mappingColonAt`) by all FOUR
 * diagnostics-side value paths: `findProjectConfigValueLines`,
 * `findFrontMatterValueLines`, `findNestedFrontMatterValueLines`, and the
 * CELL-OPTION loop in `features/yaml-value-diagnostics.ts` (whose `slotsOf`
 * grammar, like `topLevelSlots`, stays unguarded for completion's sake).
 * All of them otherwise split at `indexOf(":")` and mis-read the key. On `toc:: true` YAML's key is `toc:`
 * and its value `true`; splitting at the first colon yields key `toc` with the
 * bogus value token `: true`, which the matcher then flags — while quarto,
 * seeing an unknown key on an OPEN key set, renders exit 0. That is a
 * cardinal-sin false positive, and it was live on both shipped surfaces
 * (`.qmd` front matter S125/S128; `_quarto.yml` `execute:`/`format:` S141/S143,
 * and depth-2 under `website:` S138) until this guard (plan §2.8 / §4.0b).
 *
 * Its only cost is a false NEGATIVE on the no-separator form (`toc:banana`,
 * `toc:true`): quarto rejects those (the document is a plain scalar, exit 1)
 * and we now stay silent. FN is the safe direction — see the module-level
 * rule that a wrong flag is never acceptable, a missed one is.
 *
 * ⚠ Takes the colon INDEX, deliberately — it judges the colon it is given, not
 * the first one on the line. Callers that also derive a KEY span from the same
 * index (`topLevelSlots`) must keep using the raw `indexOf` result for the key
 * and apply this guard only to the VALUE slot; folding the guard into a
 * "find the mapping colon" helper would return -1 on `toc:: true` and balloon
 * that key span from `toc` to the whole line, regressing key completion (S148).
 *
 * ⚠ A carriage return is NOT accepted, and needs no arm: every caller reaches
 * this through a `/\r?\n/` split (verified exhaustively by grep, S148), so a
 * `\r` can never sit next to the colon.
 *
 * ⚠ A SECOND implementation of this same YAML rule already exists, privately, in
 * `project-links.ts`'s `mappingColonIndex` (the document-link scanner) — which
 * scans FORWARD for the first separator colon rather than judging a given one,
 * and accepts any `/\s/` where YAML (and this predicate) allow only space/tab.
 * Deliberately left alone rather than consolidated: that is a different feature
 * with its own tests, and a cross-module refactor is plan-mode work. Filed to
 * `BACKLOG.md` beside the two standing "consolidate the grammar" items (S148).
 */
export function isMappingSeparator(lineText: string, colon: number): boolean {
  const next = lineText[colon + 1];
  return next === undefined || next === " " || next === "\t";
}

/**
 * The index of the first colon at or after `from` that is a real YAML block-mapping
 * key/value SEPARATOR, or `-1` if the line has none (so it hosts no mapping value).
 *
 * This is what the three value ENUMERATORS use — NOT `indexOf(":")` and not
 * `isMappingSeparator(line, indexOf(":"))`. Judging only the FIRST colon is wrong
 * whenever a LATER one is the separator: on `a:b: "text` (and on `toc:: "text`, and
 * `url:http://x: "text`) YAML's key is `a:b` / `toc:` / `url:http://x` and the value
 * opens a multi-line quoted scalar that folds the following line in. Quarto renders
 * all of those **exit 0**. Treating such a line as a non-mapping skips the `scanFlow`
 * arming, so the folded continuation line is then read as a mapping of its own and
 * flagged — a cardinal-sin false positive (found by the §9 review, reproduced
 * firsthand, S148).
 *
 * Scanning forward instead makes the line parse correctly: the key becomes `a:b`,
 * which resolves against no schema field and so is silently skipped, while the value
 * still arms the continuation guard exactly as it should.
 *
 * ⚠ Do NOT fold this into `topLevelSlots`. That grammar is shared with COMPLETION,
 * which derives its KEY span from the raw first colon and must keep doing so — see
 * the note there.
 */
export function mappingColonAt(lineText: string, from = 0): number {
  for (let i = lineText.indexOf(":", afterQuotedKey(lineText, from)); i >= 0; i = lineText.indexOf(":", i + 1)) {
    if (isMappingSeparator(lineText, i)) {
      return i;
    }
  }
  return -1;
}

/**
 * The index just past a QUOTED key at `from` (skipping leading blanks), or `from` itself when the
 * key is not quoted or its closing quote is missing. The separator scan starts here so a colon
 * INSIDE a quoted key is never mistaken for the key/value separator.
 *
 * Without this, `"a: b": "text` split at the colon in the quoted key: the key became `"a` and the
 * "value" `b": "text`, whose first character does not open a quoted scalar — so the enumerators'
 * continuation guard never armed, and the line quarto FOLDS into that value was read as a real
 * mapping and flagged. quarto 1.7.33 renders such a document **exit 0** (it folds to the single
 * key `a: b`), making that a cardinal-sin false positive; it was live for a folded line with a
 * bare key, and unquoting the key (S159) would have widened it to quoted folded keys too.
 * Grounded firsthand: `"a: b": "text` / `toc: banana"` and its flow variant both exit 0.
 *
 * Conservative by construction — it only ever moves the scan start LATER, so it can turn a
 * mis-split into a correct split or into "no separator" (a skipped line), never invent one. An
 * UNTERMINATED quoted key (`"toc: banana`) keeps the old scan position: that document is a
 * structural `YAMLException` for quarto, and the pre-existing behavior there is already silent.
 * Escapes are honored the way YAML defines them — `\"` inside a double-quoted key, a doubled `''`
 * inside a single-quoted one — so a key containing a quote does not end it early.
 */
function afterQuotedKey(lineText: string, from: number): number {
  let start = from;
  while (start < lineText.length && (lineText[start] === " " || lineText[start] === "\t")) {
    start++;
  }
  const quote = lineText[start];
  if (quote !== '"' && quote !== "'") {
    return from;
  }
  for (let i = start + 1; i < lineText.length; i++) {
    const ch = lineText[i];
    if (quote === '"' && ch === "\\") {
      i++; // an escaped char inside a double-quoted scalar — never a closer
      continue;
    }
    if (ch === quote) {
      if (quote === "'" && lineText[i + 1] === "'") {
        i++; // `''` is an escaped single quote inside a single-quoted scalar
        continue;
      }
      return i + 1;
    }
  }
  return from; // unterminated — leave the scan exactly where it was
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
export function valueSlotAfterColon(lineText: string, colon: number): Slot {
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
 * Strip ONE matching layer of YAML key-quoting (`"key"` or `'key'`) to the logical
 * key name, or return `key` unchanged if it isn't quoted. The single implementation
 * of that rule for every diagnostics surface: quoting a key is YAML-legal and
 * semantically identical to its bare form, and quarto validates the two the same way
 * (`"toc": banana` and `toc: banana` both render exit 1 with `Field "toc" has value
 * banana` — grounded firsthand vs 1.7.33 on the `.qmd` front-matter, nested, cell-option
 * and `_quarto.yml` surfaces). Comparing the schema's bare names against a key with its
 * quotes still attached therefore silently loses the diagnostic.
 *
 * Requires a MATCHING leading/trailing pair, which is what makes it FP-safe: `"toc`
 * (unterminated) and `"toc" x` (trailing text) are left intact, resolve against no
 * schema field, and stay silent — and both are documents quarto rejects with a
 * STRUCTURAL `YAMLException`, never a value error, so silence is the faithful answer
 * (Learning #171b). Deliberately does NOT decode escapes: `"toc": banana` decodes
 * to `toc` for quarto (exit 1) but stays `toc` here and is silently skipped — a
 * safe false negative, the same accepted limitation the VALUE-side `unquote`
 * (`yaml-value-check.ts`) carries.
 *
 * Lives here rather than in any one enumerator because all four value surfaces need
 * the identical rule; it was previously private to `project-yaml.ts`, which is why the
 * three `.qmd` surfaces silently diverged from `_quarto.yml` until S159.
 */
export function unquoteKey(key: string): string {
  if (key.length >= 2) {
    const first = key[0];
    const last = key[key.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return key.slice(1, -1);
    }
  }
  return key;
}

/**
 * The cell engine for a cell language: knitr for `{r}`, jupyter for
 * `{python}`/`{julia}`, ojs for `{ojs}`/`{js}`. An unrecognized language yields
 * `undefined`, which `cellOptions` reads as "do not filter" — a benign over-OFFER, and so
 * what the COMPLETION provider wants (`providers/yaml.ts`).
 *
 * Diagnostics must not use this directly: an over-flag is the cardinal sin, not a benign
 * over-offer. They go through `cellOptionScopeFor` below, which maps the same `undefined`
 * to the narrowing `"unknown"` scope. Both live here so the two consumers share ONE language
 * → engine table rather than duplicating it (value-validation plan §4.1 L3).
 */
export function engineFor(lang: string): CellEngine | undefined {
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
 * The schema scope a cell option must be VALIDATED against, given the cell's language —
 * `engineFor` refined so an undeterminable engine narrows instead of widening.
 *
 * `cellOptions(undefined)` deliberately means "no filtering, the FULL set". That is right
 * for COMPLETION, where offering a knitr-only option in a cell that turns out to be jupyter
 * is a benign over-offer. It is wrong for DIAGNOSTICS, because quarto scopes its cell schema
 * to the DOCUMENT's engine — which a cell LANGUAGE alone does not determine: a `{sql}` cell
 * is knitr in a document that also holds an `{r}` cell and markdown otherwise. Grounded
 * firsthand vs quarto 1.7.33: `{sql}` + `--| cache: banana` renders exit 1 in a knitr
 * document but **exit 0** in a markdown- or jupyter-engine one, while the engine-agnostic
 * `--| echo: banana` renders exit 1 in all three. Validating the full set would therefore
 * squiggle a document quarto ACCEPTS — the cardinal sin.
 *
 * Before S161 this could not bite: the only cells whose options were enumerated at all had
 * a `#|`/`//|` prefix, and every language that reaches this function through one of those
 * either has a determined engine or was itself a false positive. Teaching the enumerator
 * quarto's per-language comment char is what first makes `{sql}`/`{matlab}`/`{c}` options
 * real, so the narrowing ships WITH it (S161 L2).
 *
 * A cell-HANDLER language narrows one step further, to `"none"` — see
 * `CELL_HANDLER_LANGUAGES` below (S162).
 *
 * ## `documentEngine` — when the language does not have to be guessed at all (S164)
 *
 * Everything above describes the FALLBACK. Quarto never scopes by cell language: it scopes
 * by the DOCUMENT's engine, which `validateDocument` hands to `partitionCellOptionsMapped`
 * as `context.engine.name`. When the front matter names that engine (`core/document-engine.ts`
 * reads the three spellings), pass it here and the guess is replaced by the fact:
 *
 * - **knitr / jupyter** — used directly, for EVERY cell language. Measured, `engine: knitr` +
 *   a `{python}` cell + `#| cache: banana` renders **exit 1** (control without the key: exit
 *   0), and a knitr document validates its `{ojs}` and `{sql}` cells against knitr too.
 * - **markdown / julia** — `"unknown"`. Those two engine schemas keep a `cell-*` field iff its
 *   `tags.engine` is absent OR names that engine, and no shipped field carries a `markdown`
 *   or `julia` tag, so the two coincide with the engine-agnostic set on everything this
 *   feature can act on. **They are not literally identical, and an earlier revision of this
 *   comment said they were** (S164 §9 review): quarto's filter also admits a field whose tag
 *   is a LIST naming the engine, while `engineTag` (`yaml-schema.ts`) maps a multi-engine
 *   list to `undefined`, i.e. into the agnostic set. So `"unknown"` is a strict SUPERSET of
 *   quarto's markdown/julia schema by exactly those fields — one in 1.7.33, `tbl-colwidths`.
 *   That is inert rather than harmless-by-luck: swept over all 43 fields `isWrongValue` can
 *   fire on, our four scopes and quarto's four filters agree EXACTLY, because
 *   `tbl-colwidths` is open-valued and so unflaggable. It would become a cardinal-sin false
 *   positive the day quarto gives a multi-engine tag to a closed-valued field. Filed.
 *   The agnostic fields stay validated, which is what makes
 *   `engine: markdown` + `#| echo: banana` still render exit 1 while `#| cache: banana`
 *   renders exit 0 — the filed false positive this argument removes.
 * - **`"ambiguous"`** — `"unknown"`, because two disagreeing selectors resolve in an order
 *   we cannot see (see `documentEngineForScoping`).
 *
 * The handler-language branch stays ABOVE all of it: quarto swaps the engine schema for
 * `handlers/<lang>/schema.yml` by LANGUAGE, so a `{dot}`/`{mermaid}` cell is exempt under
 * every engine. A knitr document does reject such a cell, but structurally — the VALID
 * `//| echo: false` renders exit 1 there too — so no value diagnostic can express it and
 * letting the engine widen it back would be a cardinal-sin false positive.
 */
export function cellOptionScopeFor(
  lang: string,
  documentEngine?: DocumentEngine | "ambiguous",
): CellEngine | "unknown" | "none" {
  if (isCellHandlerLanguage(lang)) {
    return "none"; // the schema SWAP is by LANGUAGE and outranks every engine
  }
  if (documentEngine === undefined) {
    return engineFor(lang) ?? "unknown"; // the language approximation, unchanged
  }
  if (documentEngine === "knitr" || documentEngine === "jupyter") {
    return documentEngine;
  }
  // markdown, julia, and `"ambiguous"` all land on the engine-agnostic intersection.
  return "unknown";
}

/**
 * Quarto's OWN cell-handler language list (`handlers/languages.yml`), transcribed from the
 * installed 1.7.33 — where it is exactly these two. A fact about another tool's dispatch,
 * not expression (the same license-clean basis as the curated schema names, Learning #25).
 *
 * Quarto's `parseAndValidateCellOptions` (`share/editor/tools/yaml/web-worker.js`) picks the
 * cell schema by ENGINE, then overrides it for a handler language:
 *
 * ```js
 * let schema = engineOptionsSchema[engine];
 * if (getYamlIntelligenceResource("handlers/languages.yml").indexOf(language) !== -1) {
 *   try { schema = getYamlIntelligenceResource(`handlers/${language}/schema.yml`); }
 *   catch (_e) { schema = undefined; }
 * }
 * if (schema === undefined || !validate) { ...parse without validating... }
 * ```
 *
 * So neither handler cell is reachable by any `cell-*` field: `handlers/dot/schema.yml`
 * does not exist, the lookup throws, and NOTHING in a `{dot}` cell is validated; while
 * `handlers/mermaid/schema.yml` does exist but declares only `mermaid-format` and `theme`
 * and admits every other key. Grounded firsthand vs 1.7.33 in a MARKDOWN-engine document —
 * `{dot}` + `//| echo`, `fig-align`, `eval`, `cache` and `code-fold` all `: banana` render
 * **exit 0**, as do `{mermaid}` + `#| echo: banana` and `%%| echo: banana`, while the control
 * `{sql}` + `--| echo: banana` renders **exit 1** with a real `Field "echo" has value banana`.
 *
 * FIVE of those seven handler lines were flagged before S162 — the cardinal sin — and the two
 * that were not are informative rather than exceptions: `//| cache: banana` escaped because
 * `cache` is knitr-scoped and S161 L2's `"unknown"` scope already excluded it, and
 * `%%| echo: banana` escaped because our `LANG_COMMENT_CHARS` has no `mermaid` row, so a `%%|`
 * line is never emitted at all. Both are the two prior narrowings on this same axis already
 * doing their job; this scope closes what neither could reach.
 *
 * **The engine qualifier above is not decoration.** A handler cell is exempt from quarto's
 * cell SCHEMA under every engine, but a knitr document runs knitr's own chunk machinery over
 * it as well, and that machinery is not schema-driven. Measured: in a knitr document (any
 * `{r}` cell present) `{mermaid}` + `#| echo: banana` renders exit 1 — not a value error but
 * `The chunk options should start with '%%| ' instead of '#| '`, which fires identically for
 * the VALID `#| echo: false`, so it is structural and no value diagnostic can express it.
 *
 * **What the suppression costs, swept rather than sampled.** All 47 keys in
 * `cellOptions("unknown")` — the scope a `{dot}` cell had before S162 — one `quarto render`
 * each, in BOTH engines. In a markdown-engine document **46 of 47 render exit 0**; the
 * exception is `layout: banana` (exit 1 from pandoc's `_json.lua`), and it renders exit 1
 * under knitr too. But `layout` is an OPEN-valued field, so `isWrongValue` never fired on it
 * and we never flagged it either way — a PRE-EXISTING lost true positive, unchanged by S162.
 * So every key we could actually flag renders exit 0 here, and the false-positive fix is
 * exactly right in a markdown-engine document.
 *
 * A KNITR document is where it costs something. There exactly one flaggable key —
 * `include` — is a real, value-dependent failure: `//| include: banana` → exit 1 from knitr's
 * own `if (options$include)`, `//| include: false` → exit 0. We flagged it before S162 and are
 * silent now. That is a deliberate trade under this project's doctrine, not an oversight:
 * `cellOptionScopeFor` receives only the cell LANGUAGE and cannot know the document engine
 * (the same limit S161 L2 documented), so the choice is ONE conditional false negative against
 * 46 UNCONDITIONAL false positives, and an over-flag is the cardinal sin. Tracked in BACKLOG
 * with the front-matter `engine:` override that would let us tell the two documents apart.
 *
 * Quarto does enforce two keys of its own in a handler cell — both mermaid's, both measured:
 * `mermaid-format` against its `png|svg|js` enum (`%%| mermaid-format: banana` → exit 1) and
 * `theme` against `null|string`, which admits any string but rejects a non-scalar
 * (`%%| theme: banana` → exit 0, but `theme: [1,2]`, `theme: {a: 1}` and `theme: 42` each →
 * exit 1). Neither is a member of `cellOptions()`, so this feature could never have flagged
 * either one whatever scope it used.
 *
 * **Case-SENSITIVE, and that is load-bearing.** Quarto tests `languages.indexOf(language)`
 * against the raw fence token with no case folding, exactly like the `kLangCommentChars`
 * lookup (`qmd/model.ts`). `{DOT}`, `{Dot}` and `{Mermaid}` are therefore unknown languages
 * taking the `#` comment-char default and the ORDINARY cell schema: each renders **exit 1**
 * on `#| echo: banana` (measured). Folding case here would convert those true positives
 * into silence.
 *
 * **`lang` is OUR token, not quarto's, and for one shape they differ.** Quarto's fence
 * recognizer captures the language as `([=A-Za-z]+)` — `=` is INSIDE the class — so
 * ```` ```{mermaid=x} ```` has the language `mermaid=x`, which is not in
 * `handlers/languages.yml` and therefore takes the ordinary cell schema: measured, its
 * `#| echo: banana` renders **exit 1** with a real `Field "echo" has value banana`. Our
 * `CELL_INFO` truncates the token at `=`, so it arrives here as `mermaid`, matches, and is
 * suppressed — a true positive we flagged before S162 and lose now. The root cause is the
 * pre-existing `CELL_INFO`/fence-token divergence already tracked in BACKLOG (the same regex
 * that admits digits, which quarto's recognizer rejects); it cannot be fixed here without the
 * raw token, and that fix is its own deliverable because `findAllCells` feeds the outline,
 * virtual documents, highlighting and diagram regions. Filed, not papered over.
 *
 * Only DIAGNOSTICS narrow this far. Completion still goes through `engineFor`, so a handler
 * cell keeps offering the cell-option list — an over-offer, which is benign, where an
 * over-flag is not (the same asymmetry that separates `"unknown"` from `undefined`).
 * Emission is untouched too: `findCellOptionLines` still reports handler-cell option lines.
 * Exactly two modules consume that enumerator — `completionContextAt` just above, and
 * `features/yaml-value-diagnostics.ts` — plus the embedded virtual-doc builders
 * (`embedded/virtual-doc.ts`). For a HANDLER language the vdoc builders are unreachable:
 * `cellLanguageId("dot")` and `cellLanguageId("mermaid")` are both `null`, and every vdoc
 * path bails on an unmapped language BEFORE it consults the option lines (`embeddedCellAt`
 * returns at the `el === null` guard; `buildVirtualContent` skips the cell). So for `{dot}`
 * and `{mermaid}` specifically, the only live consumer left is cell-option COMPLETION —
 * which is precisely what a mutant that suppressed emission here would break. The
 * cross-reference index is NOT a consumer at all: `core/refs.ts` scans labels with its own
 * private `CELL_LABEL_OPTION` regex (the second-scanner divergence tracked in BACKLOG), and
 * `core/cell-background.ts` uses `findAllCells` only.
 */
const CELL_HANDLER_LANGUAGES: ReadonlySet<string> = new Set(["mermaid", "dot"]);

/**
 * Whether `lang` is one of quarto's cell-handler languages (case-sensitive).
 *
 * Deliberately NOT exported: `cellOptionScopeFor` is the only caller and the tested entry
 * point. Export it when a second consumer actually needs it — e.g. the deferred
 * `mermaid: ["%%"]` comment-char row, or a handler-aware completion narrowing.
 */
function isCellHandlerLanguage(lang: string): boolean {
  return CELL_HANDLER_LANGUAGES.has(lang);
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
