/**
 * Cell-option / front-matter VALUE diagnostics — flag a WRONG value of an
 * already-recognized option with an Error squiggle, matching what `quarto
 * render` 1.7.33 itself rejects. Two surfaces, one collection: Phase 1 (§4.1)
 * validates `#|`/`//|` cell options (`findCellOptionLines`); Phase 2 (§4.2)
 * validates TOP-LEVEL front-matter scalars (`findFrontMatterValueLines`). Both
 * feed the same surface-agnostic `isWrongValue` matcher.
 *
 * A sibling of the unknown-KEY feature (`features/yaml-diagnostics.ts`), copying
 * its hard-won `DiagnosticCollection` lifecycle but with an INVERTED safety
 * story: unknown-key flagging is banned on these open surfaces (a typo is
 * indistinguishable from a legal custom key), whereas value validation is safe
 * HERE precisely because it only ever fires on a key that is already recognized
 * AND whose value set is provably CLOSED (`SchemaField.valuesClosed`) — the pure
 * `isWrongValue` matcher never flags an open set (plan §0/§7.1).
 *
 * Like its sibling, this is a `DiagnosticCollection` driven by raw document
 * events, NOT a registered `LanguageFeatureProvider` — VS Code offers no
 * diagnostic *provider* to register. But the gate differs: `.qmd` IS this
 * extension's own `"quarto"` languageId, so this feature gates on languageId
 * (not filename), and keeps its OWN collection/code so it can never share a URI
 * with the `_quarto.yml` unknown-key feature.
 */

import * as vscode from "vscode";
import { findCellOptionLines } from "../core/qmd/model";
import { findFrontMatterValueLines } from "../core/yaml-frontmatter-values";
import { engineFor } from "../core/yaml-context";
import { isWrongValue } from "../core/yaml-value-check";
import type { SchemaField } from "../core/yaml-schema";
import { createSchemaSource, type SchemaSource } from "./yaml-schema-source";

const COLLECTION_NAME = "quarto-value";
const DIAGNOSTIC_SOURCE = "Quarto";
const DIAGNOSTIC_CODE = "quarto-invalid-option-value";

/** The change-event debounce (immediate on open/save) — copied from the sibling. */
const DEBOUNCE_MS = 350;

/** Whether `document` is one of this extension's own `.qmd` documents (the gate). */
function isQuartoDocument(document: vscode.TextDocument): boolean {
  return document.languageId === "quarto";
}

/**
 * Construct the `DiagnosticCollection` + schema source, wire the four
 * languageId-gated document events, and prime already-open `.qmd` documents.
 * Everything is pushed into `context.subscriptions`.
 */
export function registerYamlValueDiagnosticsFeature(context: vscode.ExtensionContext): void {
  const collection = vscode.languages.createDiagnosticCollection(COLLECTION_NAME);
  const source = createSchemaSource();
  const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // Per-URI generation guard (MANDATORY — same slow-first-load `SchemaSource`
  // race the sibling documents): the initial `quarto --paths` spawn + ~680KB
  // parse can let an earlier call's pre-edit diagnostics resolve AFTER a later,
  // faster, already-correct call cleared them for edited-since content.
  const generations = new Map<string, number>();

  const cancelPending = (key: string): void => {
    const timer = pendingTimers.get(key);
    if (timer !== undefined) {
      clearTimeout(timer);
      pendingTimers.delete(key);
    }
  };

  const runNow = (document: vscode.TextDocument): void => {
    void refreshDiagnostics(collection, source, document, generations);
  };

  const scheduleRefresh = (document: vscode.TextDocument): void => {
    const key = document.uri.toString();
    cancelPending(key);
    pendingTimers.set(
      key,
      setTimeout(() => {
        pendingTimers.delete(key);
        runNow(document);
      }, DEBOUNCE_MS),
    );
  };

  context.subscriptions.push(
    collection,
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (isQuartoDocument(document)) {
        runNow(document);
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (isQuartoDocument(event.document)) {
        scheduleRefresh(event.document);
      }
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (isQuartoDocument(document)) {
        runNow(document);
      }
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      if (isQuartoDocument(document)) {
        // Cancel BEFORE delete so a pending timer cannot resurrect a stale entry.
        cancelPending(document.uri.toString());
        collection.delete(document.uri);
      }
    }),
  );

  for (const document of vscode.workspace.textDocuments) {
    if (isQuartoDocument(document)) {
      runNow(document);
    }
  }
}

/**
 * Recompute and set `document`'s value diagnostics. Never `collection.clear()`
 * (always `set`, scoped to this one URI); allocates a generation and re-checks
 * it before the sync fast path and after the async schema-index await, so a
 * superseded call discards its own now-stale result.
 */
async function refreshDiagnostics(
  collection: vscode.DiagnosticCollection,
  source: SchemaSource,
  document: vscode.TextDocument,
  generations: Map<string, number>,
): Promise<void> {
  const key = document.uri.toString();
  const generation = (generations.get(key) ?? 0) + 1;
  generations.set(key, generation);
  const isCurrent = (): boolean => generations.get(key) === generation;

  const text = document.getText();
  const cellLines = findCellOptionLines(text);
  const fmValueLines = findFrontMatterValueLines(text);
  if (cellLines.length === 0 && fmValueLines.length === 0) {
    if (isCurrent()) {
      collection.set(document.uri, []);
    }
    return;
  }
  const index = await source.getIndex();
  if (document.isClosed || !isCurrent()) {
    return; // closed while awaiting the first-load schema, or superseded — never resurrect
  }
  // Slice keys/values from the SAME snapshot `findCellOptionLines` saw — NEVER re-read
  // the live document after the await. A plain edit during the slow first-load schema
  // await does not bump the generation guard (it only arms a debounced timer), so a
  // live `document.lineAt(cell.line)` could throw (line now out of range) or slice
  // shifted content; the snapshot keeps this pass internally consistent, and the next
  // debounced pass supersedes it (adversarial review, S124).
  const lines = text.split(/\r?\n/);
  const diagnostics: vscode.Diagnostic[] = [];
  for (const cell of cellLines) {
    if (cell.keySlot === null || cell.valueSlot === null) {
      continue; // block-sequence item, or no `:` yet — no value to validate
    }
    const lineText = lines[cell.line] ?? "";
    const optionKey = lineText.slice(cell.keySlot.startCol, cell.keySlot.endCol);
    const rawToken = lineText.slice(cell.valueSlot.startCol, cell.valueSlot.endCol);
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
      cell.valueSlot.startCol,
      cell.line,
      cell.valueSlot.endCol,
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
  // provider uses; an unrecognized key, an open set, or a valid value all skip. The
  // top-level `format` key stays UNVALIDATED by construction — its value enum is
  // injected after closedness is derived, so `valuesClosed` is unset and the matcher
  // skips it (a safe false negative; closing that list would false-positive on
  // extension/custom formats — plan §4.2 dragon).
  const fmFields = index.frontMatterKeys([]);
  for (const fm of fmValueLines) {
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
  collection.set(document.uri, diagnostics);
}

/**
 * The Error message for a wrong value — grounded on the FACT of Quarto's error,
 * not its exact expected-list wording (plan §3.4). Lists the closed set's valid
 * values; a boolean-accepting field is phrased as `true` or `false`.
 */
function valueMessage(rawToken: string, key: string, field: SchemaField): string {
  const values = field.values ?? [];
  if (field.acceptsBoolean && values.every((v) => v === "true" || v === "false")) {
    return `Value ${rawToken} is not valid for "${key}" — expected true or false.`;
  }
  return `Value ${rawToken} is not valid for "${key}" — expected one of: ${values.join(", ")}.`;
}
