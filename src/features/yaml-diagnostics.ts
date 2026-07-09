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
 * A `DiagnosticCollection` driven by raw document events, NOT a registered
 * `LanguageFeatureProvider` (plan §2.5) — structurally different from every
 * other provider in this codebase: `providers/yaml.ts` etc. register with a
 * `DocumentSelector` VS Code itself uses to route calls, so the provider
 * function is simply never invoked for a non-matching document. A raw
 * `workspace.onDid*TextDocument` event fires for EVERY document in the
 * workspace, so every handler here filters by filename FIRST — `_quarto.yml`
 * is not this extension's own `"quarto"` languageId, it opens as VS Code's
 * built-in `"yaml"` (or plain text), so filename is the only reliable gate.
 */

import * as vscode from "vscode";
import { findProjectConfigKeyLines, isProjectConfigFileName } from "../core/project-yaml";
import { createSchemaSource, type SchemaSource } from "./yaml-schema-source";

const COLLECTION_NAME = "quarto-project";
const DIAGNOSTIC_SOURCE = "Quarto";
const DIAGNOSTIC_CODE = "quarto-unknown-project-key";

/**
 * The change-event debounce, between the two cited real-world precedents
 * (`vscode-markdownlint` 500ms, `asciidoctor-vscode` similar) and a snappier
 * feel — `_quarto.yml` files are typically small (plan §2.5).
 */
const DEBOUNCE_MS = 350;

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
 * Construct the `DiagnosticCollection` + schema source, wire the four
 * filename-gated document events, and prime already-open matching documents —
 * the official "Basic tier" pattern (plan §2.5). Everything is pushed into
 * `context.subscriptions` (R7).
 */
export function registerYamlDiagnosticsFeature(context: vscode.ExtensionContext): void {
  const collection = vscode.languages.createDiagnosticCollection(COLLECTION_NAME);
  const source = createSchemaSource();
  // Pending debounce timers, keyed by URI string — D4: a timer scheduled for a
  // document that closes before it fires must never resurrect a diagnostic on
  // a URI `onDidCloseTextDocument` already cleared.
  const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // The latest refreshDiagnostics() "generation" per URI (adversarial review,
  // Session 47) — an in-flight call that resolves AFTER a newer call for the
  // SAME URI has already started must discard its own now-stale result
  // rather than overwrite the newer one. This matters beyond the close case
  // D4 already covers: a slow FIRST schema-index load (the initial `quarto
  // --paths` spawn + a ~680KB file read/parse) can let an earlier call's
  // pre-edit diagnostics resolve and land AFTER a later, faster, already-
  // correct call cleared them for edited-since content.
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
      if (isProjectConfigDocument(document)) {
        runNow(document);
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (isProjectConfigDocument(event.document)) {
        scheduleRefresh(event.document);
      }
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (isProjectConfigDocument(document)) {
        runNow(document);
      }
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      if (isProjectConfigDocument(document)) {
        // Cancel BEFORE delete: a pending timer that fired after delete()
        // would call collection.set() on a URI whose diagnostics were just
        // cleared, resurrecting a stale entry (plan §7 D4).
        cancelPending(document.uri.toString());
        collection.delete(document.uri);
      }
    }),
  );

  for (const document of vscode.workspace.textDocuments) {
    if (isProjectConfigDocument(document)) {
      runNow(document);
    }
  }
}

/**
 * Recompute and set `document`'s diagnostics. Never calls `collection.clear()`
 * (that wipes every OTHER open `_quarto.yml`'s diagnostics workspace-wide — a
 * documented footgun the official samples avoid): always `collection.set`,
 * scoped to this one URI.
 *
 * Allocates a "generation" number for this call (see `generations`' own
 * doc comment) and checks it is still current both before the synchronous
 * fast path and after the async schema-index await — a call superseded by a
 * newer one for the same URI discards its own result instead of overwriting
 * the newer, correct one.
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

  const lines = findProjectConfigKeyLines(document.getText());
  if (lines.length === 0) {
    if (isCurrent()) {
      collection.set(document.uri, []);
    }
    return;
  }
  const index = await source.getIndex();
  if (document.isClosed || !isCurrent()) {
    // Closed while awaiting the (possibly first-load, CLI-spawning) schema
    // index, or superseded by a newer call for this URI — never resurrect
    // or overwrite with a stale result.
    return;
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
  collection.set(document.uri, diagnostics);
}
