/**
 * `_quarto.yml`/`_quarto.yaml` schema diagnostics — `project:`/`website:`/
 * `book:` unknown-key detection (YAML schema diagnostics plan
 * `docs/planning/2026-07-09-yaml-schema-diagnostics-plan.md` §5.3).
 *
 * An always-on feature (no command, no keybinding — mirrors how the YAML
 * completion provider is just always active for `.qmd` documents): whenever a
 * document literally named `_quarto.yml`/`_quarto.yaml` is open, scan its
 * `project:`/`website:`/`book:` blocks for keys the installed Quarto schema
 * doesn't recognize and surface each as an Error diagnostic (severity Error —
 * this genuinely breaks `quarto render` today, not a heuristic guess).
 *
 * The `DiagnosticCollection` lifecycle (raw document events, 350 ms debounce,
 * per-URI generation guard, cancel-before-delete) is the shared
 * `createDebouncedDiagnosticsFeature` skeleton (`./debounced-diagnostics`,
 * CHANGELOG: createDebouncedDiagnosticsFeature extraction, Session 126). This module supplies only the three per-feature axes: the
 * **filename gate** (`_quarto.yml` is not this extension's own `"quarto"`
 * languageId — it opens as VS Code's built-in `"yaml"` or plain text, so filename
 * is the only reliable gate, unlike the `.qmd` value feature which gates on
 * languageId), the collection/source/code constants, and the unknown-key
 * `compute`.
 */

import * as vscode from "vscode";
import { findProjectConfigKeyLines, isProjectConfigFileName } from "../core/project-yaml";
import {
  createDebouncedDiagnosticsFeature,
  type DiagnosticsComputeContext,
} from "./debounced-diagnostics";

const COLLECTION_NAME = "quarto-project";
const DIAGNOSTIC_SOURCE = "Quarto";
const DIAGNOSTIC_CODE = "quarto-unknown-project-key";

/**
 * Whether `document` is a `_quarto.yml`/`_quarto.yaml` file — the filename
 * gate. Delegates to the pure, unit-tested `core/project-yaml.ts`
 * `isProjectConfigFileName` (adversarial review, Session 47 — the original
 * inline `document.fileName.endsWith(...)` was a SUFFIX test, not an exact
 * basename check, so it also matched any file merely ending in those
 * characters, e.g. `not_quarto.yml`/`backup_quarto.yaml`).
 */
function isProjectConfigDocument(document: vscode.TextDocument): boolean {
  return isProjectConfigFileName(document.fileName);
}

/**
 * Compute unknown-key diagnostics for an open `_quarto.yml`. Never calls
 * `collection.clear()` (the factory owns writes; this only produces the array):
 * returns `[]` to clear, a non-empty array to set, or `null` to write nothing
 * (superseded/closed). Takes the synchronous zero-lines fast path (never awaits
 * the schema index) when the file has none of `project:`/`website:`/`book:`.
 */
async function computeProjectKeyDiagnostics(
  document: vscode.TextDocument,
  { source, isCurrent }: DiagnosticsComputeContext,
): Promise<vscode.Diagnostic[] | null> {
  const lines = findProjectConfigKeyLines(document.getText());
  if (lines.length === 0) {
    return isCurrent() ? [] : null;
  }
  const index = await source.getIndex();
  if (document.isClosed || !isCurrent()) {
    // Closed while awaiting the (possibly first-load, CLI-spawning) schema
    // index, or superseded by a newer call for this URI — never resurrect
    // or overwrite with a stale result.
    return null;
  }
  const diagnostics: vscode.Diagnostic[] = [];
  for (const entry of lines) {
    const keys = index.projectKeys(entry.container);
    if (keys === null || keys.has(entry.key)) {
      continue; // unresolved container (never flag), or a genuinely valid key
    }
    const range = new vscode.Range(
      entry.line,
      entry.keyRange.startCol,
      entry.line,
      entry.keyRange.endCol,
    );
    const diagnostic = new vscode.Diagnostic(
      range,
      `Unknown key "${entry.key}" in "${entry.container}:" — not a recognized Quarto ${entry.container} option.`,
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
 * filename-gated document events, and prime already-open matching documents —
 * the official "Basic tier" pattern (plan §2.5). Everything is pushed into
 * `context.subscriptions` (R7).
 */
export const registerYamlDiagnosticsFeature = createDebouncedDiagnosticsFeature({
  collectionName: COLLECTION_NAME,
  gate: isProjectConfigDocument,
  compute: computeProjectKeyDiagnostics,
});
