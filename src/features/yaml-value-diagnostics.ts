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
import { findCellOptionLines } from "../core/qmd/model";
import { findFrontMatterValueLines } from "../core/yaml-frontmatter-values";
import { findNestedFrontMatterValueLines } from "../core/yaml-frontmatter-nested-values";
import { engineFor, mappingColonAt, unquoteKey, valueSlotAfterColon } from "../core/yaml-context";
import { isWrongValue, valueMessage, unquote } from "../core/yaml-value-check";
import { isKnownFormatName, formatNameMessage } from "../core/format-name-check";
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
  for (const cell of cellLines) {
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
    // UNQUOTED, the same shared rule the three value ENUMERATORS apply to their keys (S159).
    // A `#|` option key may be quoted — it is ordinary YAML — and quarto validates the quoted
    // and bare forms identically: `#| "echo": banana` renders exit 1 with `Field "echo" has
    // value banana, which must instead be true or false`, exactly as `#| echo: banana` does
    // (grounded firsthand vs 1.7.33; `'echo'` likewise). Comparing `"echo"` against the
    // schema's bare names matched nothing, so the diagnostic was silently lost on this surface
    // too. FP-safe by the same argument as the enumerators: `unquoteKey` requires a MATCHING
    // pair, so `#| "echo: banana` / `#| "echo" x: banana` stay intact and unmatched — and those
    // are documents quarto rejects structurally, not on this value.
    const optionKey = unquoteKey(lineText.slice(cell.keySlot.startCol, sep).replace(/[ \t]+$/, ""));
    const valueSlot = valueSlotAfterColon(lineText, sep);
    const rawToken = lineText.slice(valueSlot.startCol, valueSlot.endCol);
    if (optionKey.length === 0 || rawToken.length === 0) {
      continue; // key or value still being typed
    }
    // Resolve the key against the SAME engine-scoped set completion uses. An
    // unknown key is never flagged — that is the permanently-banned unknown-key
    // territory, not this feature's job (plan §7.4).
    const field = index.cellOptions(engineFor(cell.cellLang)).find((f) => f.name === optionKey);
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
