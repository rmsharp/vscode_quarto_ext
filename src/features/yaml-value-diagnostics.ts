/**
 * Cell-option / front-matter VALUE diagnostics — the `vscode` ADAPTER.
 *
 * The decision itself — *which spans of this document would we squiggle, and with what
 * message* — lives in `core/yaml-value-flags.ts` (S168). It is pure and headless, so the
 * exit-code oracle (`test/oracle/`) calls the SAME implementation the product does instead
 * of re-walking a hand-written copy that could drift from it. This module keeps only what
 * is irreducibly `vscode`, and that is the whole of its job:
 *
 *   - the **languageId gate** — `.qmd` IS this extension's own `"quarto"` languageId,
 *     unlike `_quarto.yml`, which the unknown-KEY sibling gates by filename;
 *   - the **lifecycle contract** shared with that sibling via
 *     `createDebouncedDiagnosticsFeature` (`./debounced-diagnostics`, CHANGELOG:
 *     createDebouncedDiagnosticsFeature extraction, Session 126) — the
 *     `DiagnosticCollection`, the 350 ms debounce, and the per-URI generation guard —
 *     plus its own collection/code, so it never shares a URI's entries with the sibling;
 *   - the **snapshot discipline** the generation guard requires (see `computeValueDiagnostics`);
 *   - the `ValueFlag` → `vscode.Diagnostic` construction.
 *
 * What each surface means, why `validate-yaml` suppresses two of the three, and the
 * pandoc-survivor accounting are all documented at `core/yaml-value-flags.ts` — with the
 * code they describe.
 */
import * as vscode from "vscode";
import {
  collectValueSources,
  hasNoValueLines,
  valueFlags,
  type ValueFlag,
} from "../core/yaml-value-flags";
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
  const sources = collectValueSources(text);
  if (hasNoValueLines(sources)) {
    return isCurrent() ? [] : null; // nothing to check — the fast path must count ALL three sources
  }
  const index = await source.getIndex();
  if (document.isClosed || !isCurrent()) {
    return null; // closed while awaiting the first-load schema, or superseded — never resurrect
  }
  // `document.fileName` is the `.Rmd` veto inside `documentEngineForScoping`, and the only
  // other thing the decision needs from the document besides its text.
  const flags = valueFlags(sources, document.fileName, index);
  // The feature's diagnostic ORDER: cell, then front matter (top-level and format-name
  // interleaved in source order, as one loop emits them), then nested.
  return [...flags.cell, ...flags.frontMatter, ...flags.nested].map(toDiagnostic);
}

/** One flagged span as the editor sees it. The severity is Error on every surface. */
function toDiagnostic(flag: ValueFlag): vscode.Diagnostic {
  const range = new vscode.Range(flag.line, flag.startCol, flag.line, flag.endCol);
  const diagnostic = new vscode.Diagnostic(range, flag.message, vscode.DiagnosticSeverity.Error);
  diagnostic.source = DIAGNOSTIC_SOURCE;
  diagnostic.code = DIAGNOSTIC_CODE;
  return diagnostic;
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
