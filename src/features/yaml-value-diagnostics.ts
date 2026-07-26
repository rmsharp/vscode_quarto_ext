/**
 * Cell-option / front-matter VALUE diagnostics — flag a WRONG value of an
 * already-recognized option with an Error squiggle, matching what `quarto
 * render` 1.7.33 itself rejects. Three surfaces, one collection: Phase 1 (§4.1)
 * validates `#|`/`//|` cell options (`findCellOptionLines`); Phase 2 (§4.2)
 * validates TOP-LEVEL front-matter scalars (`findFrontMatterValueLines`); Phase 3
 * (nested plan §3.4) validates NESTED front-matter scalars under `execute:`/`format:`
 * (`findNestedFrontMatterValueLines`). All three feed the same surface-agnostic
 * `isWrongValue` matcher — nested is a third value SOURCE, not a third feature (same
 * `.qmd` gate, same `quarto-value` collection).
 *
 * All three are subject to quarto's `validate-yaml` escape hatch (S163,
 * `core/validate-yaml.ts`): a top-level `validate-yaml: false` turns validation off for the
 * whole document, and a cell may opt out on its own with `#| validate-yaml: false`. What the
 * flag does NOT suppress is anything PANDOC rejects on its own rather than quarto's YAML
 * schema — the front-matter format NAME (kept flagging, pinned) and 26 of the 170 top-level
 * keys this feature can flag (measured by exhaustive sweep, still suppressed, filed). See
 * the `format` branch below for the accounting.
 *
 * A sibling of the unknown-KEY feature (`features/yaml-diagnostics.ts`) with an
 * INVERTED safety story: unknown-key flagging is banned on these open surfaces (a
 * typo is indistinguishable from a legal custom key), whereas value validation is
 * safe HERE precisely because it only ever fires on a key that is already
 * recognized AND whose value set is provably CLOSED (`SchemaField.valuesClosed`) —
 * the pure `isWrongValue` matcher never flags an open set (plan §0/§7.1).
 *
 * Both siblings share the `createDebouncedDiagnosticsFeature` skeleton
 * (`./debounced-diagnostics`, CHANGELOG: createDebouncedDiagnosticsFeature extraction, Session 126) — the `DiagnosticCollection` lifecycle,
 * 350 ms debounce, and per-URI generation guard. This module supplies the three
 * per-feature axes: the **languageId gate** (`.qmd` IS this extension's own
 * `"quarto"` languageId, unlike `_quarto.yml` which the sibling gates by
 * filename), its own collection/code (so it never shares a URI's entries with the
 * unknown-key feature), and the value `compute`.
 */

import * as vscode from "vscode";
import { findCellOptionLines, frontMatterContentLines } from "../core/qmd/model";
import {
  findFrontMatterTopLevelLines,
  findFrontMatterValueLines,
} from "../core/yaml-frontmatter-values";
import { findNestedFrontMatterValueLines } from "../core/yaml-frontmatter-nested-values";
import { cellOptionScopeFor, mappingColonAt, valueSlotAfterColon } from "../core/yaml-context";
import { documentEngineForScoping } from "../core/document-engine";
import { isWrongValue, valueMessage, unquote } from "../core/yaml-value-check";
import { isKnownFormatName, formatNameMessage } from "../core/format-name-check";
import {
  cellsWithValidationDisabled,
  isValidationDisabledByFrontMatter,
} from "../core/validate-yaml";
import {
  createDebouncedDiagnosticsFeature,
  type DiagnosticsComputeContext,
} from "./debounced-diagnostics";

const COLLECTION_NAME = "quarto-value";
const DIAGNOSTIC_SOURCE = "Quarto";
const DIAGNOSTIC_CODE = "quarto-invalid-option-value";

/** Whether `document` is one of this extension's own `.qmd` documents (the gate). */
function isQuartoDocument(document: vscode.TextDocument): boolean {
  return document.languageId === "quarto";
}

/**
 * Compute value diagnostics for an open `.qmd`. Returns `[]` to clear, a
 * non-empty array to set, or `null` to write nothing (superseded/closed) — the
 * factory owns the write.
 *
 * Slices keys/values from the SAME snapshot `findCellOptionLines` saw — NEVER
 * re-reads the live document after the await. A plain edit during the slow
 * first-load schema await does not bump the generation guard (it only arms a
 * debounced timer), so a live `document.lineAt(cell.line)` could throw (line now
 * out of range) or slice shifted content; the snapshot keeps this pass internally
 * consistent, and the next debounced pass supersedes it (adversarial review,
 * S124).
 */
async function computeValueDiagnostics(
  document: vscode.TextDocument,
  { source, isCurrent }: DiagnosticsComputeContext,
): Promise<vscode.Diagnostic[] | null> {
  const text = document.getText();
  const cellLines = findCellOptionLines(text);
  const fmValueLines = findFrontMatterValueLines(text);
  const nestedLines = findNestedFrontMatterValueLines(text);
  if (cellLines.length === 0 && fmValueLines.length === 0 && nestedLines.length === 0) {
    return isCurrent() ? [] : null; // nothing to check — the fast path must count ALL three sources
  }
  const index = await source.getIndex();
  if (document.isClosed || !isCurrent()) {
    return null; // closed while awaiting the first-load schema, or superseded — never resurrect
  }
  const lines = text.split(/\r?\n/);
  const diagnostics: vscode.Diagnostic[] = [];
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
  // The DOCUMENT's engine (S164), which is what quarto actually scopes a cell's option
  // schema to — `validateDocument` hands `context.engine.name` to
  // `partitionCellOptionsMapped`, which picks `engineOptionsSchema[engine]`. Resolved once
  // for the whole document because the engine IS a document-level fact.
  // `findFrontMatterTopLevelLines`, not `fmValueLines`: a key can select an engine without
  // carrying a scalar. `jupyter:` above a kernelspec block is the everyday spelling of the
  // alias and renders quarto exit 0 on a knitr-only cell option, so reading only the
  // value-bearing lines would leave that document's `{r}` cells scoped to knitr — the very
  // false positive this fix removes.
  // `text` is the LANGUAGE fallback's input (S165): when the front matter names no engine,
  // quarto resolves one from the document's own cell fences — document-wide and
  // order-dependent — so the resolver needs the raw document, not our cell list (its
  // docstrings carry the measurements for why those differ). `undefined` still means "keep
  // the per-cell language approximation", but it is now reached only by an `.Rmd`, by an
  // `{{< include >}}` whose expansion we cannot see, or by an unreadable competing selector.
  const documentEngine = documentEngineForScoping(
    document.fileName,
    findFrontMatterTopLevelLines(text),
    nestedLines,
    frontMatterContentLines(text),
    text,
  );
  for (const cell of cellLines) {
    if (documentValidationOff || optedOutCells.has(cell.cellStartLine)) {
      continue; // quarto validates nothing in this cell — grounded firsthand, exit 0
    }
    if (cell.keySlot === null || cell.valueSlot === null) {
      continue; // block-sequence item, or no `:` yet — no value to validate
    }
    const lineText = lines[cell.line] ?? "";
    // Re-derive key and value from the real YAML key/value SEPARATOR rather than from
    // `cell.keySlot`/`cell.valueSlot`, which `slotsOf` builds from the FIRST colon.
    // `#| echo:: banana` is a mapping whose key is `echo:` — unknown on this open set, so
    // quarto renders it exit 0 — while the first-colon split yields key `echo` with the
    // bogus value `: banana` and flags it: the cardinal-sin FP this session removes from
    // the other three enumerators (plan §2.8/P2; this fourth surface found by the §9
    // review). `slotsOf` itself is deliberately untouched because it is shared with
    // cell-option COMPLETION, where `key:value` is a user mid-typing the provider repairs
    // by prepending a space — the same diagnostics-side-only rule applied everywhere else.
    const sep = mappingColonAt(lineText, cell.keySlot.startCol);
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
    const optionKey = lineText.slice(cell.keySlot.startCol, sep).replace(/[ \t]+$/, "");
    // Clamp to where the directive's YAML CONTENT ends. Re-deriving from the raw line text
    // (which the separator rule above requires) cannot see a BLOCK-comment language's
    // closing delimiter, so in a `{c}` cell `/*| echo: false */` would slice `false */` as
    // the value — not in echo's closed set, so it would be flagged, on a document quarto
    // renders exit 0. That is a cardinal-sin FP this session's own L1 would have introduced
    // by emitting those lines for the first time; `contentEndCol` is the bound that removes
    // it, and for every line-comment language it is the end of the line, so this is a no-op
    // (S161 L5, caught by the L4 integration pin on the diagnostic's RANGE).
    const rawSlot = valueSlotAfterColon(lineText, sep);
    const valueSlot = {
      startCol: rawSlot.startCol,
      endCol: Math.max(rawSlot.startCol, Math.min(rawSlot.endCol, cell.contentEndCol)),
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
    // §7.4). This is the same set completion offers WHENEVER the engine is determined; the
    // two deliberately diverge only where it is not (`"unknown"` vs `undefined`), because
    // an over-offer is benign and an over-flag is the cardinal sin.
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
      .cellOptions(cellOptionScopeFor(cell.cellLang, documentEngine))
      .find((f) => f.name === optionKey);
    if (field === undefined || !isWrongValue(rawToken, field)) {
      continue;
    }
    const range = new vscode.Range(
      cell.line,
      valueSlot.startCol,
      cell.line,
      valueSlot.endCol,
    );
    const diagnostic = new vscode.Diagnostic(
      range,
      valueMessage(rawToken, optionKey, field),
      vscode.DiagnosticSeverity.Error,
    );
    diagnostic.source = DIAGNOSTIC_SOURCE;
    diagnostic.code = DIAGNOSTIC_CODE;
    diagnostics.push(diagnostic);
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
      const range = new vscode.Range(
        fm.line,
        fm.valueRange.startCol,
        fm.line,
        fm.valueRange.endCol,
      );
      const diagnostic = new vscode.Diagnostic(
        range,
        formatNameMessage(fm.rawToken),
        vscode.DiagnosticSeverity.Error,
      );
      diagnostic.source = DIAGNOSTIC_SOURCE;
      diagnostic.code = DIAGNOSTIC_CODE;
      diagnostics.push(diagnostic);
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
    const range = new vscode.Range(
      fm.line,
      fm.valueRange.startCol,
      fm.line,
      fm.valueRange.endCol,
    );
    const diagnostic = new vscode.Diagnostic(
      range,
      valueMessage(fm.rawToken, fm.key, field),
      vscode.DiagnosticSeverity.Error,
    );
    diagnostic.source = DIAGNOSTIC_SOURCE;
    diagnostic.code = DIAGNOSTIC_CODE;
    diagnostics.push(diagnostic);
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
  for (const nested of nestedLines) {
    if (documentValidationOff) {
      break; // the flag suppresses nested scalars too (`execute:`/`echo: banana` → exit 0)
    }
    const field = index.frontMatterKeys(nested.parentPath).find((f) => f.name === nested.key);
    if (field === undefined || !isWrongValue(nested.rawToken, field)) {
      continue;
    }
    const range = new vscode.Range(
      nested.line,
      nested.valueRange.startCol,
      nested.line,
      nested.valueRange.endCol,
    );
    const diagnostic = new vscode.Diagnostic(
      range,
      valueMessage(nested.rawToken, nested.key, field),
      vscode.DiagnosticSeverity.Error,
    );
    diagnostic.source = DIAGNOSTIC_SOURCE;
    diagnostic.code = DIAGNOSTIC_CODE;
    diagnostics.push(diagnostic);
  }
  return diagnostics;
}

/**
 * Construct the `DiagnosticCollection` + schema source, wire the four
 * languageId-gated document events, and prime already-open `.qmd` documents.
 * Everything is pushed into `context.subscriptions`.
 */
export const registerYamlValueDiagnosticsFeature = createDebouncedDiagnosticsFeature({
  collectionName: COLLECTION_NAME,
  gate: isQuartoDocument,
  compute: computeValueDiagnostics,
});
