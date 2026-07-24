/**
 * Shared skeleton for the extension's document-event-driven `DiagnosticCollection`
 * features (extracted Session 126, CHANGELOG: createDebouncedDiagnosticsFeature extraction, Session 126 — rule-of-two: the unknown-KEY
 * `_quarto.yml` feature `features/yaml-diagnostics.ts` and the VALUE feature
 * `features/yaml-value-diagnostics.ts` had both copied this ~75-line lifecycle
 * verbatim).
 *
 * A `DiagnosticCollection` driven by raw `workspace.onDid*TextDocument` events,
 * NOT a registered `LanguageFeatureProvider` — VS Code offers no diagnostic
 * *provider* to register, so every handler filters candidate documents itself
 * (the per-feature `gate`). Both concrete features differ ONLY in three axes,
 * which are exactly this factory's parameters:
 *   - `collectionName` — the owning collection's id (kept distinct per feature so
 *     they can never share a URI's entries);
 *   - `gate` — which documents this feature processes (filename for `_quarto.yml`,
 *     languageId for `.qmd`);
 *   - `compute` — how a matching document's diagnostics are produced.
 *
 * The hard-won machinery lives here once:
 *   - a 350 ms change-event debounce (immediate on open/save), between the cited
 *     precedents (`vscode-markdownlint` 500 ms, `asciidoctor-vscode`) and a
 *     snappier feel;
 *   - a per-URI **generation guard** (adversarial review, Session 47): a refresh
 *     whose slow first schema-index load resolves AFTER a newer refresh for the
 *     SAME URI has started must discard its own now-stale result rather than
 *     overwrite the newer one. The generation is bumped synchronously at the top
 *     of `refresh`, before any `await`, so the superseding event's bump always
 *     lands first; `compute` receives `isCurrent()` and returns `null` to signal
 *     "superseded — do not write";
 *   - cancel-before-delete on close (D4): a pending debounce timer is cleared
 *     BEFORE `collection.delete`, so it can never resurrect a stale entry on a
 *     URI whose diagnostics were just cleared.
 */

import * as vscode from "vscode";
import { createSchemaSource, type SchemaSource } from "./yaml-schema-source";

/**
 * The change-event debounce, shared by every debounced-diagnostics feature —
 * between `vscode-markdownlint` (500 ms) / `asciidoctor-vscode` and a snappier
 * feel (these files are typically small).
 */
export const DEBOUNCE_MS = 350;

/** What a `compute` is handed for each refresh besides the document. */
export interface DiagnosticsComputeContext {
  /** The feature's own runtime schema source (lazy, cached, per-feature). */
  readonly source: SchemaSource;
  /**
   * The generation guard: `true` while this refresh is still the newest for its
   * URI. A `compute` MUST re-check this after any `await` and return `null` once
   * it is `false`, so a superseded pass can never overwrite a newer result.
   */
  isCurrent(): boolean;
}

/**
 * Produce a matching document's diagnostics from a snapshot of its text.
 *
 * Contract:
 *   - return `null` to write NOTHING — used both when this refresh has been
 *     superseded (`!isCurrent()`) and when the document closed mid-`await`;
 *   - return `[]` to CLEAR the document's diagnostics (scanned, nothing wrong);
 *   - return a non-empty array to SET those diagnostics.
 *
 * Never re-read the live document after an `await` — capture a text snapshot
 * before it and slice from that (Session 124: a mid-`await` edit does not bump
 * the generation guard, so `document.lineAt(...)` can throw or slice shifted
 * content). The generation guard is enforced entirely by this `null` return;
 * the factory is a pure writer once `compute` resolves.
 */
export type ComputeDiagnostics = (
  document: vscode.TextDocument,
  ctx: DiagnosticsComputeContext,
) => Promise<vscode.Diagnostic[] | null>;

/** The three per-feature axes the factory is parameterized over. */
export interface DebouncedDiagnosticsFeatureSpec {
  /** The owning `DiagnosticCollection`'s id — MUST be distinct per feature. */
  readonly collectionName: string;
  /** Which documents this feature processes (filename or languageId gate). */
  gate(document: vscode.TextDocument): boolean;
  /** How a matching document's diagnostics are produced. */
  readonly compute: ComputeDiagnostics;
}

/**
 * Build a `register…Feature(context)` function for a document-event-driven
 * `DiagnosticCollection` from its three per-feature axes. The returned function
 * constructs everything (collection, schema source, event wiring, prime loop) at
 * activate-time and pushes it all into `context.subscriptions`.
 */
export function createDebouncedDiagnosticsFeature(
  spec: DebouncedDiagnosticsFeatureSpec,
): (context: vscode.ExtensionContext) => void {
  return (context: vscode.ExtensionContext): void => {
    const collection = vscode.languages.createDiagnosticCollection(spec.collectionName);
    const source = createSchemaSource();
    // Pending debounce timers, keyed by URI string (D4: a timer scheduled for a
    // document that closes before it fires must never resurrect a diagnostic on a
    // URI `onDidCloseTextDocument` already cleared).
    const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
    // The latest refresh "generation" per URI (adversarial review, Session 47) —
    // a call that resolves AFTER a newer call for the SAME URI has already started
    // must discard its own now-stale result rather than overwrite the newer one.
    // A slow FIRST schema-index load (the initial `quarto --paths` spawn + a
    // ~680KB read/parse) is exactly what lets an earlier call's pre-edit result
    // resolve after a later, faster, already-correct call.
    const generations = new Map<string, number>();

    const cancelPending = (key: string): void => {
      const timer = pendingTimers.get(key);
      if (timer !== undefined) {
        clearTimeout(timer);
        pendingTimers.delete(key);
      }
    };

    async function refresh(document: vscode.TextDocument): Promise<void> {
      // Bump the generation SYNCHRONOUSLY, before any await — so a newer event's
      // bump always lands before either continuation runs.
      const key = document.uri.toString();
      const generation = (generations.get(key) ?? 0) + 1;
      generations.set(key, generation);
      const isCurrent = (): boolean => generations.get(key) === generation;

      const result = await spec.compute(document, { source, isCurrent });
      if (result === null) {
        return; // superseded or closed mid-compute — never resurrect/overwrite
      }
      collection.set(document.uri, result);
    }

    const runNow = (document: vscode.TextDocument): void => {
      void refresh(document);
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
        if (spec.gate(document)) {
          runNow(document);
        }
      }),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (spec.gate(event.document)) {
          scheduleRefresh(event.document);
        }
      }),
      vscode.workspace.onDidSaveTextDocument((document) => {
        if (spec.gate(document)) {
          runNow(document);
        }
      }),
      vscode.workspace.onDidCloseTextDocument((document) => {
        if (spec.gate(document)) {
          // Cancel BEFORE delete: a pending timer that fired after delete() would
          // call collection.set() on a URI whose diagnostics were just cleared,
          // resurrecting a stale entry (D4).
          cancelPending(document.uri.toString());
          collection.delete(document.uri);
        }
      }),
    );

    for (const document of vscode.workspace.textDocuments) {
      if (spec.gate(document)) {
        runNow(document);
      }
    }
  };
}
