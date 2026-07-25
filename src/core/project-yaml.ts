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
import {
  mappingColonAt,
  leadingWsLen,
  mappingContainerKey,
  unquoteKey,
  valueSlotAfterColon,
} from "./yaml-context";

/** The three `_quarto.yml` blocks with a genuinely closed key set (plan §0). */
const PROJECT_CONFIG_CONTAINERS = new Set(["project", "website", "book"]);

/**
 * The value-side top-level containers: `project`/`website`/`book` (closed project-config
 * key sets) PLUS `execute` (a document-level options block, resolved via
 * `frontMatterKeys(["execute"])` — execute value plan §3.2) PLUS `format` (per-format
 * project defaults, its per-format OPTION values resolved via
 * `frontMatterKeys(["format", <fmt>])` → `perFormatOptions(fmt)` — the SAME reader path the
 * `.qmd` document surface uses; format value plan §3.2). Both `execute` and `format` are
 * document-level keys also valid at the `_quarto.yml` top level. Used ONLY by the VALUE
 * enumerator `findProjectConfigValueLines`. The KEY enumerator (`findProjectConfigKeyLines`)
 * MUST keep the narrower `PROJECT_CONFIG_CONTAINERS`: the `execute`/`format` children are
 * OPEN sets quarto accepts (`custom-thing: whatever` / an unknown per-format option → exit 0),
 * so flagging an unknown KEY there would be a cardinal-sin false positive (execute value plan
 * §7 / dragon 1).
 *
 * ⚠ This set is NOT the full list of what the value enumerator emits. A COLUMN-0 document key
 * is emitted with the synthetic marker `"document"` (document-key value plan §3.2 change A),
 * which is deliberately absent here because it is the ABSENCE of a container, not the name of
 * one — there is no `document:` line to open it, and adding it would make `isValueContainer`
 * claim a real key by that name opens a container. See `ProjectConfigValueLine.container`.
 */
const VALUE_CONTAINERS = new Set(["project", "website", "book", "execute", "format"]);

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
 * The VALUE enumerator's own container predicate — the KEY set plus `execute` and `format`.
 * Kept SEPARATE from `isProjectConfigContainer` so adding these never leaks into the
 * unknown-KEY feature (execute value plan §7 / dragon 1). Used ONLY in
 * `findProjectConfigValueLines`.
 */
function isValueContainer(
  name: string,
): name is "project" | "website" | "book" | "execute" | "format" {
  return VALUE_CONTAINERS.has(name);
}

/**
 * One value line found inside a value-side top-level container, at depth-1 or depth-2.
 * `project`/`website`/`book` carry a closed project-config key set (`projectFields`);
 * `execute` is a document-level options block also valid at the `_quarto.yml` top level,
 * resolved against `frontMatterKeys(["execute"])` instead (execute value plan §3.2);
 * `format` sets per-format project defaults, its per-format OPTION values resolved against
 * `frontMatterKeys(["format", <fmt>])` → `perFormatOptions(fmt)` — the SAME reader path the
 * `.qmd` document surface uses (format value plan §3.2 B). The KEY enumerator
 * (`ProjectConfigKeyLine`) stays `{project,website,book}` — the `execute`/`format` children
 * are OPEN sets quarto accepts (an unknown per-format option → exit 0), so KEY validation of
 * them would be a cardinal-sin FP (execute value plan §7 / dragon 1).
 *
 * `"document"` is the SYNTHETIC container of a COLUMN-0 document key — the document root
 * itself, which has no opener line to name it (document-key value plan §3.1/§6 alt 1: it is
 * the absence of a container, not a container name, so `VALUE_CONTAINERS`/`isValueContainer`
 * deliberately do NOT gain it). Its fields come from `frontMatterKeys([])` — the SAME reader
 * the `.qmd` top-level front-matter surface has used since S125 — and its `path` is always
 * `[]` (depth-2 under a document key is a separate, deferred slice).
 */
export interface ProjectConfigValueLine {
  line: number;
  container: "project" | "website" | "book" | "execute" | "format" | "document";
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
 * Enumerate every line of a `_quarto.yml` that carries a non-empty scalar VALUE the
 * feature can resolve, in document order, feeding the shared `isWrongValue` matcher:
 *
 * - a `project:`/`website:`/`book:`/`execute:`/`format:` descendant at DEPTH-1 (a direct
 *   child) or DEPTH-2 (a grandchild under a pure block-opener child), resolved via
 *   `SchemaIndex.projectFields` / `frontMatterKeys([...])` (depth-2 value plan §3.2 B);
 * - a **COLUMN-0 document key** (`toc: banana`, `fig-width: wide`), emitted with the
 *   synthetic `container:"document"`, resolved via `frontMatterKeys([])` — the SAME
 *   reader the `.qmd` top-level front-matter surface has used since S125 (document-key
 *   value plan §3.2 change A).
 *
 * Each emission carries a `path`: `[]` at depth-1 and at the document level, `[child]`
 * at depth-2.
 *
 * A bounded TWO-level forward state machine. Container tracking is
 * `findProjectConfigKeyLines`'s (column-0 header sets scope; a genuine column-0 line
 * ends it) — a column-0 line still ends the previous container's scope whether or not it
 * is itself an opener; the document-level emission is layered on top of that reset, never
 * instead of it. Above that: when a depth-1 line is a pure block-opener (`navbar:`, no
 * scalar), `childKey`/`childIndent` open a depth-2 scope; a depth-1 sibling or a
 * column-0 line closes it. Depth-3+ (`indent > childIndent`) and sequence-item
 * grandchildren are NOT emitted — the reader's `.children` is one level and the
 * enumerator caps at `path.length===1`, so deeper values are a safe false negative
 * (plan §4.2). Depth-2 UNDER a column-0 document key (`crossref:\n  chapters: banana`)
 * is likewise not emitted — its own deferred slice.
 *
 * The load-bearing safety property this surface's KEY enumerator lacks is the
 * `scanFlow` continuation guard, and at DEPTH-2 it has NO column-0 backstop (a folded
 * line can sit at any indent, §2.3/dragon 2): a mapping-looking line inside a
 * multi-line QUOTED value (`title: "…\n    collapse-below: x"`) or an unclosed FLOW
 * collection is part of the value quarto accepts (renders exit 0), so emitting it and
 * letting the matcher flag it would be a cardinal-sin false positive. `scanFlow` (the
 * shared quote/flow-aware scanner) tracks both and skips continuation lines regardless
 * of level; over-skipping when ambiguous is the safe false-negative direction. Column-0
 * values are armed by the SAME tail as every other level — which is the whole reason the
 * document-key emission is a restructure rather than a second grammar, and which fixes
 * the FP that arming gap caused at column 0 (3 measured live cases; see the arming block).
 */
export function findProjectConfigValueLines(text: string): ProjectConfigValueLine[] {
  const lines = stripBom(text).split(/\r?\n/);
  const result: ProjectConfigValueLine[] = [];
  let currentContainer: "project" | "website" | "book" | "execute" | "format" | null = null;
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

    // ── ARM THE CONTINUATION GUARD FIRST, INDEPENDENT OF EMISSION SCOPE ──
    // Every line carrying a mapping value can open a multi-line quoted/flow scalar that folds
    // the following lines into itself, whether or not THIS enumerator goes on to emit it. Five
    // scope guards below `continue` before the emission tail — a line outside any tracked
    // container, a depth-3+ line, a block-sequence item, a line with no open child scope, and a
    // dedent — so arming only for emitted lines leaves those folds unguarded, and their
    // continuation lines are then read as real mappings and flagged on a document quarto
    // renders exit 0. Measured firsthand (§9 review, S149): `custom:\n  note: "multi\ntoc:
    // banana\n  end"` is ONE YAML string quarto renders exit 0, and a navbar
    // `- text: "Home` folding onto a column-0 line is the realistic shape of the same thing.
    //
    // ⚠ Do NOT move this back below the scope guards to "only pay for lines we emit". The
    // guard is a property of the FILE's scan state, not of the level being validated — which
    // is the same reason the enumerator is one forward pass rather than one pass per level.
    //
    // ⚠ A line with NO separator colon still carries a scalar, and it can still open a
    // multi-line value. S148's guard reasoned "no separator ⇒ the line hosts no value" — true
    // of a MAPPING line, false of a block-SEQUENCE item, whose value is the item itself:
    // `    - "intro.qmd` has no colon at all and opens a quoted scalar that folds the lines
    // below it. quarto renders `book:\n  chapters:\n    - "intro.qmd\ntoc: banana"` exit 0
    // with `chapters: ['intro.qmd toc: banana']` — there is no `toc` key in that document at
    // all — while we squiggled the interior of the string (§9 review, S149). So the arming
    // token is the value after the separator when there is one, and otherwise the line's own
    // content past a leading `- `. `toc:banana` still arms nothing: its first character is `t`.
    const colon = mappingColonAt(lineText, indent);
    const valueSlot = colon < 0 ? null : valueSlotAfterColon(lineText, colon);
    const rawToken = valueSlot === null ? "" : lineText.slice(valueSlot.startCol, valueSlot.endCol);
    const armToken =
      valueSlot === null ? lineText.slice(indent).replace(/^-[ \t]*/, "").trimEnd() : rawToken;
    // Arm only for a token that actually OPENS a quoted or flow scalar, decided by its FIRST
    // character past any leading node property (`&anchor `/`!tag `). It is deliberately NOT a
    // `scanFlow` over the whole token: that scan treats an unmatched quote/bracket ANYWHERE in
    // the token as an opener, and at column 0 that is catastrophic — an ordinary
    // `title: Don't Panic` (quarto exit 0) arms a phantom quote whose continuation guard then
    // swallows EVERY remaining line of the file, silently disabling all
    // `project:`/`website:`/`book:`/`execute:`/`format:` value validation below it. A column-0
    // `title:`/`description:` above the container blocks is the single most common
    // `_quarto.yml` shape (document-key value plan §2.6/dragon 2).
    //
    // In a YAML plain scalar an inner quote/bracket is literal text, so narrowing is also
    // simply more correct — it RESTORES true positives the whole-token scan dropped at
    // depth-1 and depth-2 (`  title: Don't Panic` swallowed the rest of its container;
    // `page-navigation: banana"` was never emitted though quarto rejects it — both measured
    // firsthand, S149 cases H08/H12).
    //
    // The sibling `.qmd` enumerators (`yaml-frontmatter-values.ts`,
    // `yaml-frontmatter-nested-values.ts`) now share this SAME arming discipline — arm from
    // EVERY scalar line (not only the ones they emit) and narrow the arm to a first-character
    // opener past a stripped node property — as of the `.qmd` sibling-enumerator arming fix
    // (Session 153; see `CHANGELOG.md`). They were the last two value enumerators still using
    // the OLD whole-token, emit-only arming, which caused a phantom-quote false NEGATIVE
    // (`title: Don't Panic` swallowing the block) and a folded-continuation false POSITIVE at
    // depth — both grounded firsthand vs quarto 1.7.33. The divergence this comment used to
    // flag is closed; all three value enumerators arm alike.
    let opensMultiLine = false;
    if (armToken.length > 0) {
      // Strip a leading node property before the first-char test. The name charset excludes ONLY
      // YAML's flow indicators `,[]{}` (an anchor/tag name cannot contain them — c-flow-indicator)
      // and the trailing whitespace is OPTIONAL, so the strip stops at — and thus SEES — a flow
      // opener that ABUTS the anchor with no space (`&a[one,`, which js-yaml/quarto fold:
      // `resources: &a[one,` / `toc: banana]` renders exit 0, so flagging the folded `toc` would be
      // a cardinal-sin FP). It does NOT exclude quotes `"'` — those ARE legal anchor-name chars, so
      // `&a'b` (a quoted node name with a NULL value, which quarto accepts, exit 0) strips WHOLE and
      // does NOT arm a phantom quote that would swallow a following real key (§9 over-suppression
      // lens, S155). The OLD `/^(?:[&!][^\s]*[ \t]+)+/` under-armed the abutting bracket; the S154
      // cell-option charset `[^\s[\]{}"']` over-excluded quotes (the SAME over-suppression, since
      // corrected on that surface too — S156). All three value enumerators and the cell-option
      // `findCellOptionLines` now share this corrected charset.
      const opener = armToken.replace(/^(?:[&!][^\s,[\]{}]*[ \t]*)+/, "")[0];
      if (opener === '"' || opener === "'" || opener === "[" || opener === "{") {
        const s = scanFlow(armToken, 0, null);
        if (s.depth > 0) {
          flowDepth = s.depth;
        }
        if (s.quote !== null) {
          openQuote = s.quote;
        }
        opensMultiLine = s.depth > 0 || s.quote !== null;
      }
    }

    // Classify this line's level. `path === null` means out of scope (skip); `level` is the
    // container marker the emission carries, and BOTH must be declared here, ABOVE the
    // column-0 branch that now assigns them (dragon 10 — declaring `path` below it, where it
    // used to live, is a TDZ error).
    let path: string[] | null = null;
    let level: ProjectConfigValueLine["container"] | null = null;
    if (indent === 0) {
      const key = mappingContainerKey(lineText);
      currentContainer = key !== null && isValueContainer(key) ? key : null;
      containerIndent = null; // reset; set on the first child line seen under it
      childKey = null;
      childIndent = null;
      if (key !== null) {
        continue; // a pure block-opener carries no scalar value of its own
      }
      // A column-0 `key: value` — a DOCUMENT key, validated against `frontMatterKeys([])`
      // (document-key value plan §3.2 change A). Falling through to the SHARED emission tail
      // (rather than opening a second grammar, §6 alt 2) is also what arms the continuation
      // guard for these lines, which is the Defect-B fix: today the branch `continue`s first,
      // so a mapping-looking line folded inside a column-0 multi-line quoted value is read as
      // a real child and flagged on a document quarto renders exit 0 (measured firsthand, 3
      // live cardinal-sin FPs — S149 cases G01/G02/H07).
      level = "document";
      path = [];
    } else if (currentContainer === null) {
      continue;
    } else {
      // UNCHANGED classification — but it must stay INSIDE this arm, including the
      // `containerIndent` bootstrap, which is `null` on the column-0 path (dragon 10).
      if (containerIndent === null) {
        containerIndent = indent; // the first indented line under the container defines its depth
      }
      level = currentContainer;
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
    }

    if (lineText.slice(indent).startsWith("-")) {
      continue; // a block-sequence item hosts no mapping value of its own to VALIDATE
    }
    if (colon < 0 || valueSlot === null) {
      // The line has no YAML key/value SEPARATOR anywhere (`mappingColonAt` scanned all of
      // it, never just the first colon), so it hosts no mapping value here: on
      // `echo:: banana` YAML's key is `echo:` and on `echo:banana` the whole line is a plain
      // scalar. Emitting a `key`/`: banana` split would let the matcher flag a line quarto
      // renders exit 0 on an OPEN key set — the cardinal-sin FP the separator guard removes
      // (plan §2.8/P2, S148). `echo:banana` IS quarto-rejected (exit 1), so staying silent
      // there is a false negative, the safe direction.
      //
      // Skipping also costs the block-opener assignment below, which is correct: a line that
      // is not a mapping cannot open a depth-2 child scope either. It costs no ARMING —
      // that now happens above, before any scope guard, and a line with no separator hosts
      // no value that could open a multi-line scalar.
      continue;
    }
    const rawKey = lineText.slice(indent, colon).replace(/[ \t]+$/, "");
    if (rawKey.length === 0) {
      continue; // `: value` with no key — malformed
    }
    if (rawToken.length === 0) {
      // A pure block-opener. At DEPTH-1 it opens a depth-2 child scope; at DEPTH-2 it is
      // a depth-3 container we never descend into (childKey stays the depth-1 parent).
      // At the DOCUMENT level it opens nothing: depth-2 under a column-0 document key
      // (`crossref:\n  chapters: banana`) is a separate, deferred slice (§4.3). A pure
      // column-0 opener never even reaches here — `mappingContainerKey` catches it above —
      // so this arm is for the residue `toc::`, whose separator is its SECOND colon.
      if (path.length === 0 && level !== "document") {
        childKey = unquoteKey(rawKey);
        childIndent = null;
      }
      continue;
    }
    if (opensMultiLine) {
      // The value OPENS a multi-line quoted/flow scalar (`location: "nav\`, `x: [`). Its
      // FOLDED result is unknowable from this opening line, and the raw opener token is not a
      // plain scalar the matcher can reduce — yet quarto folds it and may ACCEPT it (an
      // escaped-newline `"nav\<nl>bar"` folds to `navbar`, exit 0). Emitting the opener would
      // let the matcher flag it against the closed enum = a cardinal-sin false positive (§9
      // review HIGH — the closed-enum opener depth-1 shipped and this slice inherited). The
      // continuation guard was already armed above, so the folded lines are skipped either
      // way; this suppresses only the OPENER's own emission. Over-skipping when a value spans
      // lines is the safe false-negative direction.
      continue;
    }
    result.push({
      line: i,
      container: level,
      path,
      key: unquoteKey(rawKey),
      valueRange: { startCol: valueSlot.startCol, endCol: valueSlot.endCol },
      rawToken,
    });
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
