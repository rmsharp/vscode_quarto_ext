/**
 * `_quarto.yml`/`_quarto.yaml` project-config VALUE diagnostics — flag a WRONG
 * closed VALUE of a recognized one-level child of `project:`/`website:`/`book:`
 * with an Error squiggle, matching what `quarto render` 1.7.33's `_quarto.yml`-schema
 * layer (`readAndValidateYamlFromFile`) rejects (`_quarto.yml` value validation,
 * plan `docs/planning/2026-07-21-quarto-yml-value-validation-plan.md` §3.2 C).
 *
 * The value-side sibling of the unknown-KEY feature (`features/yaml-diagnostics.ts`)
 * on the SAME project-config surface: the same filename gate, its OWN
 * collection/code (so it never shares a URI's entries with the KEY feature), and a
 * value `compute`. It reuses the surface-agnostic `isWrongValue` matcher + the pure
 * `valueMessage` (the SAME functions the `.qmd` document-surface value feature uses,
 * `features/yaml-value-diagnostics.ts`), fed by a NEW value SOURCE
 * (`findProjectConfigValueLines`, scanFlow-aware) resolved against a NEW reader
 * (`SchemaIndex.projectFields`, super-aware). The shipped KEY feature and every
 * document-surface value path are untouched.
 *
 * Only a provably-CLOSED child is ever value-validated (`projectFields` leaves an
 * open string / `string:{completions}` child — `website.title`, `project.type` —
 * without `valuesClosed`, so `isWrongValue` skips it): the cardinal-sin false
 * positive this feature must never ship. Unknown keys are never flagged — that is
 * the KEY feature's job, not this one's.
 *
 * Shares the `createDebouncedDiagnosticsFeature` skeleton (`./debounced-diagnostics`)
 * — the `DiagnosticCollection` lifecycle, 350 ms debounce, and per-URI generation
 * guard — supplying only the three per-feature axes: the filename gate, its
 * collection/source/code constants, and the value `compute`.
 */

import * as vscode from "vscode";
import {
  findProjectConfigValueLines,
  isProjectConfigFileName,
  type ProjectConfigValueLine,
} from "../core/project-yaml";
import type { SchemaField } from "../core/yaml-schema";
import { isWrongValue, valueMessage } from "../core/yaml-value-check";
import {
  createDebouncedDiagnosticsFeature,
  type DiagnosticsComputeContext,
} from "./debounced-diagnostics";

const COLLECTION_NAME = "quarto-project-value";
const DIAGNOSTIC_SOURCE = "Quarto";
const DIAGNOSTIC_CODE = "quarto-invalid-project-value";

/**
 * Whether `document` is a `_quarto.yml`/`_quarto.yaml` file — the filename gate.
 * Delegates to the pure, unit-tested `isProjectConfigFileName` (exact basename, not
 * a suffix test — adversarial review, Session 47). `_quarto.yml` opens as VS Code's
 * built-in `"yaml"`, not this extension's `"quarto"` languageId, so filename is the
 * only reliable gate (unlike the `.qmd` value feature, which gates on languageId).
 */
function isProjectConfigDocument(document: vscode.TextDocument): boolean {
  return isProjectConfigFileName(document.fileName);
}

/**
 * Compute value diagnostics for an open `_quarto.yml`. Never calls
 * `collection.clear()` (the factory owns writes): returns `[]` to clear, a non-empty
 * array to set, or `null` to write nothing (superseded/closed). Takes the
 * synchronous zero-lines fast path (never awaits the schema index) when the file has
 * no scalar-valued child of `project:`/`website:`/`book:`.
 *
 * Slices everything from the SAME snapshot `findProjectConfigValueLines` saw (each
 * `ProjectConfigValueLine` already carries its `line`, `valueRange`, `rawToken`, and
 * `key`) — NEVER re-reads the live document after the await, so a mid-`await` edit
 * cannot throw or slice shifted content; the next debounced pass supersedes it
 * (generation-guard discipline, S124).
 */
/**
 * Resolve a value line to the annotated `SchemaField` it should be checked against,
 * BY PATH (depth-2 value plan §3.2 C). `path=[]` → a depth-1 child; `path=[parent]` →
 * that parent's grandchild (`.children`, populated by the L1 reader). Depth-3+ never
 * enumerates (`path.length >= 2` is defensive). Path resolution is mandatory — a bare
 * `key` lookup would collide a valid grandchild (`book.cookie-consent.type`) with a
 * closed depth-1 enum of the same name (`book.type` CSL), a cardinal-sin FP (dragon 3).
 */
function resolveProjectValueField(
  fields: SchemaField[],
  entry: ProjectConfigValueLine,
): SchemaField | undefined {
  if (entry.path.length === 0) {
    return fields.find((f) => f.name === entry.key);
  }
  if (entry.path.length === 1) {
    return fields.find((f) => f.name === entry.path[0])?.children?.find((c) => c.name === entry.key);
  }
  return undefined;
}

async function computeProjectValueDiagnostics(
  document: vscode.TextDocument,
  { source, isCurrent }: DiagnosticsComputeContext,
): Promise<vscode.Diagnostic[] | null> {
  const valueLines = findProjectConfigValueLines(document.getText());
  if (valueLines.length === 0) {
    return isCurrent() ? [] : null;
  }
  const index = await source.getIndex();
  if (document.isClosed || !isCurrent()) {
    // Closed while awaiting the (possibly first-load, CLI-spawning) schema index,
    // or superseded by a newer call for this URI — never resurrect/overwrite.
    return null;
  }
  const diagnostics: vscode.Diagnostic[] = [];
  for (const entry of valueLines) {
    // Resolve BY PATH against the container's super-merged field set (depth-2 value
    // plan §3.2 C) — NEVER by bare `key`: a grandchild name can collide with a CLOSED
    // depth-1 field (`book.type` CSL enum vs `book.cookie-consent.type`), where bare-name
    // resolution would be a cardinal-sin FP, not merely a miss (§7.5/dragon 3). An
    // unknown key/path (the KEY feature's territory), an open field (`isWrongValue`'s
    // `valuesClosed` precondition fails), or a valid value all skip.
    const field = resolveProjectValueField(index.projectFields(entry.container), entry);
    if (field === undefined || !isWrongValue(entry.rawToken, field)) {
      continue;
    }
    const range = new vscode.Range(
      entry.line,
      entry.valueRange.startCol,
      entry.line,
      entry.valueRange.endCol,
    );
    const diagnostic = new vscode.Diagnostic(
      range,
      valueMessage(entry.rawToken, entry.key, field),
      vscode.DiagnosticSeverity.Error,
    );
    diagnostic.source = DIAGNOSTIC_SOURCE;
    diagnostic.code = DIAGNOSTIC_CODE;
    diagnostics.push(diagnostic);
  }
  return diagnostics;
}

/**
 * Construct the `DiagnosticCollection` + schema source, wire the four filename-gated
 * document events, and prime already-open matching documents. Everything is pushed
 * into `context.subscriptions`.
 */
export const registerYamlProjectValueDiagnosticsFeature = createDebouncedDiagnosticsFeature({
  collectionName: COLLECTION_NAME,
  gate: isProjectConfigDocument,
  compute: computeProjectValueDiagnostics,
});
