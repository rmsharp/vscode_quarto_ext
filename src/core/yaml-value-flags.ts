/**
 * The value-flag DECISION: which spans of a `.qmd` would we squiggle, and with what
 * message. Pure, synchronous, headless — it imports no `vscode`, so both the feature
 * adapter (`features/yaml-value-diagnostics.ts`) and the exit-code oracle
 * (`test/oracle/`) call this ONE implementation (S168). Before that lift the decision was
 * module-private behind a `vscode.TextDocument` and the oracle re-walked it by hand; that
 * copy had already drifted once undetected, losing the `validate-yaml` escape hatch.
 *
 * Flag a WRONG value of an already-recognized option, matching what `quarto render` 1.7.33
 * itself rejects. Three surfaces, one decision: Phase 1 (§4.1) validates `#|`/`//|` cell
 * options (`findCellOptionLines`); Phase 2 (§4.2) validates TOP-LEVEL front-matter scalars
 * (`findFrontMatterValueLines`); Phase 3 (nested plan §3.4) validates NESTED front-matter
 * scalars under `execute:`/`format:` (`findNestedFrontMatterValueLines`). All three feed
 * the same surface-agnostic `isWrongValue` matcher — nested is a third value SOURCE, not a
 * third feature.
 *
 * All three are subject to quarto's `validate-yaml` escape hatch (S163,
 * `core/validate-yaml.ts`): a top-level `validate-yaml: false` turns validation off for the
 * whole document, and a cell may opt out on its own with `#| validate-yaml: false`. What the
 * flag does NOT suppress is anything PANDOC rejects on its own rather than quarto's YAML
 * schema — the front-matter format NAME (kept flagging, pinned) and 26 of the 170 top-level
 * keys this feature can flag (measured by exhaustive sweep, still suppressed, filed). See
 * the `format` branch below for the accounting.
 *
 * The safety story is INVERTED from the unknown-KEY sibling (`features/yaml-diagnostics.ts`):
 * unknown-key flagging is banned on these open surfaces (a typo is indistinguishable from a
 * legal custom key), whereas value validation is safe HERE precisely because it only ever
 * fires on a key that is already recognized AND whose value set is provably CLOSED
 * (`SchemaField.valuesClosed`) — the pure `isWrongValue` matcher never flags an open set
 * (plan §0/§7.1).
 */
import { findCellOptionLines, type CellOptionLine } from "./qmd/model";
import { findFrontMatterValueLines, type FrontMatterValueLine } from "./yaml-frontmatter-values";
import {
  findNestedFrontMatterValueLines,
  type NestedFrontMatterValueLine,
} from "./yaml-frontmatter-nested-values";
import { cellOptionScopeFor, mappingColonAt, valueSlotAfterColon } from "./yaml-context";
import { resolveDocumentEngine } from "./document-engine-resolve";
import { isWrongValue, valueMessage, unquote } from "./yaml-value-check";
import { isKnownFormatName, formatNameMessage } from "./format-name-check";
import {
  cellsWithValidationDisabled,
  isValidationDisabledByFrontMatter,
} from "./validate-yaml";
import type { SchemaIndex } from "./yaml-schema";

/** Which of the feature's three value surfaces produced a flag (reporting only). */
export type ValueSurface = "cell" | "front-matter" | "format-name" | "nested";

/** One span this feature would squiggle, with the message it would carry. */
export interface ValueFlag {
  readonly surface: ValueSurface;
  /** 0-based, as `vscode.Range` wants. */
  readonly line: number;
  readonly startCol: number;
  readonly endCol: number;
  /** The resolved option / front-matter key. */
  readonly key: string;
  /** The value token exactly as sliced. */
  readonly rawToken: string;
  readonly message: string;
}

/**
 * One document snapshot and everything derived from it.
 *
 * The text travels WITH the derived arrays so a caller cannot pass `sources` from one
 * snapshot and `text` from another — the S124 desync is unrepresentable rather than merely
 * forbidden.
 */
export interface ValueSources {
  /** The snapshot, captured once. */
  readonly text: string;
  readonly lines: readonly string[];
  readonly cellLines: readonly CellOptionLine[];
  readonly fmValueLines: readonly FrontMatterValueLine[];
  readonly nestedLines: readonly NestedFrontMatterValueLine[];
}

/** Flags grouped by source. Grouping is a safety property, not a style choice — plan §5 dragon 2. */
export interface GroupedValueFlags {
  readonly cell: ValueFlag[];
  readonly frontMatter: ValueFlag[];
  readonly nested: ValueFlag[];
}

/** Enumerate everything derivable from the snapshot. Cheap; needs no schema. */
export function collectValueSources(text: string): ValueSources {
  return {
    text,
    lines: text.split(/\r?\n/),
    cellLines: findCellOptionLines(text),
    fmValueLines: findFrontMatterValueLines(text),
    nestedLines: findNestedFrontMatterValueLines(text),
  };
}

/**
 * True when no source produced a line — the caller's pre-await fast path.
 *
 * The adapter uses this to skip the SCHEMA LOAD (a `quarto --paths` spawn plus a ~680 KB
 * read/parse on first use) on a document with nothing to check, on every keystroke's
 * debounce. It must count ALL three sources.
 */
export function hasNoValueLines(sources: ValueSources): boolean {
  return (
    sources.cellLines.length === 0 &&
    sources.fmValueLines.length === 0 &&
    sources.nestedLines.length === 0
  );
}

/**
 * The decision. Pure, synchronous, total — every skip below is a `continue`, never a throw.
 *
 * Returns flags GROUPED BY SOURCE rather than as one flat tagged array: the oracle scores
 * the cell surface only, and with a flat array it would need a load-bearing
 * `.filter(surface === "cell")` whose omission would make a front-matter flag flip a
 * document's row class — a silent failure that looks exactly like a real regression. The
 * grouped return makes that mistake unrepresentable.
 *
 * The feature's diagnostic order is `cell ++ frontMatter ++ nested`.
 */
export function valueFlags(
  sources: ValueSources,
  fileName: string,
  index: SchemaIndex,
): GroupedValueFlags {
  const { text, lines, cellLines, fmValueLines, nestedLines } = sources;
  const cell: ValueFlag[] = [];
  const frontMatter: ValueFlag[] = [];
  const nested: ValueFlag[] = [];
  // Quarto's documented escape hatch (S163). A top-level `validate-yaml: false` turns the
  // render pipeline's whole validation pass off — `const validate =
  // context.format.render?.["validate-yaml"]; if (validate !== false) { validateDocument() }`
  // — so every surface below renders exit 0 and flagging any of it is the cardinal sin in
  // its most explicit form: the user has literally asked for validation to be off.
  // A cell may also opt out on its own (`#| validate-yaml: false`), which is the SAME test
  // applied to that cell's option YAML and therefore scoped to that one cell.
  // ONE surface is deliberately NOT suppressed — see the `format` branch below.
  const documentValidationOff = isValidationDisabledByFrontMatter(fmValueLines);
  const optedOutCells = cellsWithValidationDisabled(cellLines, lines);
  // The DOCUMENT's engine (S164/S165), which is what quarto actually scopes a cell's option
  // schema to — `validateDocument` hands `context.engine.name` to
  // `partitionCellOptionsMapped`, which picks `engineOptionsSchema[engine]`. Resolved once
  // for the whole document because the engine IS a document-level fact. `undefined` means
  // "keep the per-cell language approximation" and is now reached only by an
  // `{{< include >}}` whose expansion we cannot see, a front matter quarto's `trimLeft`
  // reveals and our scanner does not, or an unreadable competing selector. (An `.Rmd` was on
  // that list until S170, which made it `"knitr"` — knitr claims the file by EXTENSION, so
  // every cell of one is scoped to knitr, including `{python}`/`{sql}`/`{ojs}`.)
  //
  // The four derived inputs this needs live in `core/document-engine-resolve.ts` rather than
  // here (S169) — read that module for WHICH enumerator each argument must be and why a
  // wrong one type-checks in silence. They moved because cell-option COMPLETION needs the
  // identical answer: it used to scope by the cell LANGUAGE, so in a knitr document it
  // refused to offer the very knitr-only key the loop below squiggles. Two hand-written
  // copies of one fact is the mirror drift S166-S168 spent three sessions removing.
  const documentEngine = resolveDocumentEngine(fileName, text);
  for (const c of cellLines) {
    if (documentValidationOff || optedOutCells.has(c.cellStartLine)) {
      continue; // quarto validates nothing in this cell — grounded firsthand, exit 0
    }
    if (c.keySlot === null || c.valueSlot === null) {
      continue; // block-sequence item, or no `:` yet — no value to validate
    }
    const lineText = lines[c.line] ?? "";
    // Re-derive key and value from the real YAML key/value SEPARATOR rather than from
    // `cell.keySlot`/`cell.valueSlot`, which `slotsOf` builds from the FIRST colon.
    // `#| echo:: banana` is a mapping whose key is `echo:` — unknown on this open set, so
    // quarto renders it exit 0 — while the first-colon split yields key `echo` with the
    // bogus value `: banana` and flags it: the cardinal-sin FP S148 removes from
    // the other three enumerators (plan §2.8/P2; this fourth surface found by the §9
    // review). `slotsOf` itself is deliberately untouched because it is shared with
    // cell-option COMPLETION, where `key:value` is a user mid-typing the provider repairs
    // by prepending a space — the same diagnostics-side-only rule applied everywhere else.
    const sep = mappingColonAt(lineText, c.keySlot.startCol);
    if (sep < 0) {
      continue; // no separator anywhere (`#| echo:banana`) — quarto exit 1, a safe FN
    }
    // NOT unquoted, deliberately — see BACKLOG: the `#|` cell-option quoted-KEY lost TP.
    // quarto validates a quoted `#|` option key exactly like the bare form (`#| "echo": banana`
    // renders exit 1 with `Field "echo" has value banana` — grounded firsthand vs 1.7.33), so
    // this IS a lost true positive, and S159 fixed the identical gap on both front-matter
    // surfaces. It is NOT fixed here because unquoting alone makes a PRE-EXISTING cardinal-sin
    // FP reachable on this surface: `findCellOptionLines` derives its continuation-guard arm
    // token from `m[4].indexOf(":")` (the FIRST colon, not the real separator), so an option key
    // containing a colon (`#| a:b: "text`) disarms the guard and the folded line below is emitted
    // as a real option — on a document quarto renders exit 0. With a BARE folded key that FP is
    // already live (pre-existing); unquoting would widen it to quoted folded keys. The front-matter
    // surfaces had the sibling defect in the SHARED `mappingColonAt`, fixed in S159; `model.ts` is
    // deliberately import-free (`yaml-context.ts` imports IT), so the same fix cannot be shared
    // here without the cross-module grammar consolidation BACKLOG already tracks.
    const optionKey = lineText.slice(c.keySlot.startCol, sep).replace(/[ \t]+$/, "");
    // Clamp to where the directive's YAML CONTENT ends. Re-deriving from the raw line text
    // (which the separator rule above requires) cannot see a BLOCK-comment language's
    // closing delimiter, so in a `{c}` cell `/*| echo: false */` would slice `false */` as
    // the value — not in echo's closed set, so it would be flagged, on a document quarto
    // renders exit 0. That is a cardinal-sin FP S161's own L1 would have introduced
    // by emitting those lines for the first time; `contentEndCol` is the bound that removes
    // it, and for every line-comment language it is the end of the line, so this is a no-op
    // (S161 L5, caught by the L4 integration pin on the diagnostic's RANGE).
    const rawSlot = valueSlotAfterColon(lineText, sep);
    const valueSlot = {
      startCol: rawSlot.startCol,
      endCol: Math.max(rawSlot.startCol, Math.min(rawSlot.endCol, c.contentEndCol)),
    };
    // No extra trim: `contentEndCol` already excludes the whitespace before a closer (quarto
    // trims it too), and `valueSlotAfterColon` already excludes trailing whitespace, so the
    // token and the squiggled range stay exactly the same span.
    const rawToken = lineText.slice(valueSlot.startCol, valueSlot.endCol);
    if (optionKey.length === 0 || rawToken.length === 0) {
      continue; // key or value still being typed
    }
    // Resolve the key against the engine-scoped set. An unknown key is never flagged —
    // that is the permanently-banned unknown-key territory, not this feature's job (plan
    // §7.4). Since S169 completion resolves the SAME document engine through the SAME
    // `resolveDocumentEngine`, so wherever that engine names knitr or jupyter the two sets
    // are identical. They still diverge on the two NARROWING scopes — `"unknown"` (a
    // markdown/julia/ambiguous document, OR one whose engine resolved to nothing at all)
    // and `"none"` (a handler cell) — where completion
    // keeps the wider language approximation (`completionEngineFor`, `yaml-context.ts`),
    // because an over-offer is benign and an over-flag is the cardinal sin. The invariant
    // that buys: the offered set is never a strict subset of the set flagged here, so this
    // loop can no longer squiggle a key completion refuses to offer.
    // `cellOptionScopeFor`, NOT `engineFor`: an undeterminable engine must narrow to the
    // engine-agnostic intersection, never widen to the full set. Since S161 the enumerator
    // reports options for every language in quarto's comment-char table, so a `{sql}`/
    // `{matlab}`/`{c}` cell reaches this line for the first time — and quarto scopes its
    // cell schema to the DOCUMENT's engine, which those languages do not determine.
    // When the front matter named the document's engine, that name REPLACES the language
    // guess — `engine: markdown` + an `{r}` cell + `#| cache: banana` renders quarto exit 0
    // while the identical document without the key renders exit 1, so scoping that cell to
    // knitr was the cardinal sin (S164). It cuts the other way too: `engine: knitr` + a
    // `{python}` cell + `#| cache: banana` renders exit 1, a true positive we used to lose.
    const field = index
      .cellOptions(cellOptionScopeFor(c.cellLang, documentEngine))
      .find((f) => f.name === optionKey);
    if (field === undefined || !isWrongValue(rawToken, field)) {
      continue;
    }
    cell.push({
      surface: "cell",
      line: c.line,
      startCol: valueSlot.startCol,
      endCol: valueSlot.endCol,
      key: optionKey,
      rawToken,
      message: valueMessage(rawToken, optionKey, field),
    });
  }
  // Phase 2 (plan §4.2): top-level front-matter values. `findFrontMatterValueLines`
  // already sliced each {key, rawToken, valueRange} from the SAME snapshot `text`
  // (no live re-read after the await), so this is internally consistent with the
  // cell path. Resolve each key against the document-root field set the completion
  // provider uses; an unrecognized key, an open set, or a valid value all skip.
  //
  // The top-level `format` scalar is a SPECIAL case (format-name validation plan
  // §3.1 C): its value is an output-format NAME, not a closed enum, so `isWrongValue`
  // cannot validate it (the format field's value list is injected after closedness
  // is derived, so `valuesClosed` stays unset). It is validated instead by a bespoke
  // predicate mirroring quarto's front-matter SCHEMA layer (`makeFrontMatterFormatSchema`):
  // an unknown/typo'd name (`format: banana`) is flagged, while extension formats,
  // pandoc modifiers, hidden legacy variants, extension+modifier combos, and custom
  // `.lua` writers are all schema-ACCEPTED and left silent. Offline (the curated
  // fallback → `formatNamesForValidation()` is `null`) it never flags.
  const fmFields = index.frontMatterKeys([]);
  for (const fm of fmValueLines) {
    if (fm.key === "format") {
      const builtIn = index.formatNamesForValidation();
      if (builtIn === null) {
        continue; // offline — the built-in set is not known-complete → never flag (dragon 4)
      }
      if (fm.rawToken.length === 0 || /^[[\]{}|>&*!]/.test(fm.rawToken) || fm.rawToken.includes("\\")) {
        continue; // flow/block/node-property token (e.g. `format: [html, pdf]`, itself
        // schema-invalid) — the same skip `isWrongValue` uses; an FP-safe false negative.
        // The BACKSLASH case is the escape-decoding FP (P3 / §9-review S149) on this
        // sibling call site: `format: "\x68tml"` DECODES to `html` and quarto renders it
        // exit 0, but `unquote` does no escape decoding, so `isKnownFormatName` saw the
        // literal `\x68tml`, missed, and flagged a value quarto accepts. Same shared
        // `unquote`, same defect class, same FN-only fix as `isWrongValue` (grounded
        // firsthand vs quarto 1.7.33; a format name never itself contains a backslash).
      }
      if (isKnownFormatName(unquote(fm.rawToken), builtIn)) {
        continue; // a name quarto's schema layer accepts (built-in/ext/modifier/.lua)
      }
      frontMatter.push({
        surface: "format-name",
        line: fm.line,
        startCol: fm.valueRange.startCol,
        endCol: fm.valueRange.endCol,
        key: fm.key,
        rawToken: fm.rawToken,
        message: formatNameMessage(fm.rawToken),
      });
      continue; // handled — do NOT fall through to the generic `isWrongValue` path
    }
    // The format NAME above is deliberately NOT suppressed. The flag gates quarto's YAML
    // VALIDATION pass, but an unresolvable output format fails earlier and independently,
    // in format resolution: grounded firsthand vs 1.7.33, `validate-yaml: false` +
    // `format: banana` renders **exit 1** with `Unknown format banana` (while the same
    // document with `format: html` and an invalid cell option renders exit 0, so it really
    // is the NAME that survives and not the flag failing). Suppressing it — as "gate the
    // whole compute on the flag" would — trades a false positive for a lost TRUE POSITIVE.
    // Hence the gate sits BELOW the `format` branch rather than at the top of the function.
    //
    // ⚠ THE FORMAT NAME IS NOT THE ONLY SURVIVOR, and an earlier revision of this comment
    // claimed it was. Swept all 170 top-level keys this feature can flag (those for which
    // `isWrongValue("banana", field)` is true), one render each with the flag set:
    // **26 still render exit 1**, and all 26 render exit 1 without the flag too, so each is
    // a real value error we reported before and are silent on now —
    //   ascii, cite-method, citeproc, columns, dpi, email-obfuscation, epub-chapter-level,
    //   eol, fail-if-warnings, html-q-tags, incremental, ipynb-output, listings,
    //   number-offset, preserve-tabs, reference-location, section-divs,
    //   shift-heading-level-by, slide-level, strip-comments, tab-stop, toc, toc-depth,
    //   top-level-division, trace, wrap
    // They survive because they are consumed by PANDOC, whose Aeson decoder rejects them
    // (`expected Bool, but encountered String`, `Unknown wrap method "banana"`), not by the
    // quarto YAML-schema layer the flag gates; `number-offset` is quarto's own non-schema
    // check. The other 144 render exit 0, so suppression is right for them.
    //
    // Not fixed here: the survivor set is a property of PANDOC's option decoder and varies
    // with pandoc version and output format, so hard-coding these 26 names would be exactly
    // the brittle transcription Learning #174 warns about. Filed with the full sweep. The
    // trade as it stands is 144 unconditional false positives removed against 26 true
    // positives lost, and an over-flag is this project's cardinal sin — but that is a
    // measured trade, not the "one exception" this comment used to assert.
    if (documentValidationOff) {
      continue;
    }
    const field = fmFields.find((f) => f.name === fm.key);
    if (field === undefined || !isWrongValue(fm.rawToken, field)) {
      continue;
    }
    frontMatter.push({
      surface: "front-matter",
      line: fm.line,
      startCol: fm.valueRange.startCol,
      endCol: fm.valueRange.endCol,
      key: fm.key,
      rawToken: fm.rawToken,
      message: valueMessage(fm.rawToken, fm.key, field),
    });
  }
  // Phase 3 (nested plan §3.4): NESTED front-matter values under `execute:`/`format:`.
  // `findNestedFrontMatterValueLines` already sliced each {parentPath, key, rawToken,
  // valueRange} from the SAME snapshot `text` (no live re-read after the await). Resolve
  // each key against its CONTAINER's field set — `frontMatterKeys(parentPath).find(...)` —
  // inverting the completion provider's own nested-value lookup (`providers/yaml.ts:102`).
  // `parentPath` EXCLUDES the key (the `nestedParentPath` function convention), so there is
  // NO `.slice(0,-1)` here, unlike the completion CONTEXT which appends the key. An unknown
  // key, an open field (`isWrongValue` precondition fails), or a valid value all skip — the
  // same three no-ops the two loops above rely on. `execute:` closedness is the curated
  // annotation (L1); `format.<fmt>.*` closedness is reader-derived (plan §2.2, §3.2).
  for (const n of nestedLines) {
    if (documentValidationOff) {
      break; // the flag suppresses nested scalars too (`execute:`/`echo: banana` → exit 0)
    }
    const field = index.frontMatterKeys(n.parentPath).find((f) => f.name === n.key);
    if (field === undefined || !isWrongValue(n.rawToken, field)) {
      continue;
    }
    nested.push({
      surface: "nested",
      line: n.line,
      startCol: n.valueRange.startCol,
      endCol: n.valueRange.endCol,
      key: n.key,
      rawToken: n.rawToken,
      message: valueMessage(n.rawToken, n.key, field),
    });
  }
  return { cell, frontMatter, nested };
}
