/**
 * Cell-execution code-cell background highlighting — the `vscode` adapter
 * (`BACKLOG.md` item 17a, Session 111).
 *
 * Draws a faint background tint behind every executable `{lang}` cell in the
 * visible `.qmd` editors, so a code cell reads as a distinct block. It is a
 * STATIC decoration of cells that *can* run — not a running-cell indicator (Run
 * Cell delegates out-of-process, `features/execution.ts`, so there is no
 * "which cell is running" state to reflect).
 *
 * All non-`vscode` logic — which line spans to tint, how the settings resolve —
 * lives in `core/cell-background` (the §3.3 guardrail) and is unit-tested
 * headlessly. This module maps those spans onto a real
 * `vscode.TextEditorDecorationType` and keeps every visible editor in sync as the
 * active editor, document text, or configuration changes.
 *
 * Note on verification: VS Code exposes no read-back for applied decorations, so
 * the produced *pixels* are confirmed by a runtime smoke test, not automatically.
 * What IS covered automatically: `cellBackgroundRangesFor` (the document→ranges
 * bridge and the enabled / languageId gating) is integration-tested against real
 * documents and configuration, and `refreshCellBackgroundDecorationsForTesting`
 * lets a test observe that the registered decorator applies the right ranges to a
 * live editor.
 */

import * as vscode from "vscode";
import {
  type CellBackgroundSettings,
  cellBackgroundRanges,
  resolveCellBackgroundSettings,
} from "../core/cell-background";

/** Read and resolve the `quarto.cells.background.*` settings from configuration. */
function readCellBackgroundSettings(): CellBackgroundSettings {
  const config = vscode.workspace.getConfiguration("quarto");
  return resolveCellBackgroundSettings({
    enabled: config.get<boolean>("cells.background.enabled"),
    light: config.get<string>("cells.background.light"),
    dark: config.get<string>("cells.background.dark"),
  });
}

/**
 * The editor line ranges to tint for `doc`: empty when highlighting is disabled
 * or the document is not a Quarto document, otherwise one whole-line range per
 * executable cell. `isWholeLine` on the decoration type makes the character
 * columns irrelevant, so each range spans column 0 of the fence lines.
 */
export function cellBackgroundRangesFor(doc: vscode.TextDocument): vscode.Range[] {
  if (doc.languageId !== "quarto" || !readCellBackgroundSettings().enabled) {
    return [];
  }
  return cellBackgroundRanges(doc.getText()).map(
    (range) => new vscode.Range(range.startLine, 0, range.endLine, 0),
  );
}

/**
 * Owns the single decoration type and keeps every visible editor's cell tint
 * current. The colour lives on the decoration type, so a colour-setting change
 * requires recreating it (`reload`); an enabled/text change only re-applies
 * (`refresh`).
 */
class CellBackgroundDecorator implements vscode.Disposable {
  private decorationType: vscode.TextEditorDecorationType;

  constructor() {
    this.decorationType = createDecorationType(readCellBackgroundSettings());
  }

  /**
   * Re-apply the tint to every visible editor and return, per editor URI, the
   * ranges applied (the return value is for tests — production callers ignore it).
   */
  refresh(): Map<string, vscode.Range[]> {
    const applied = new Map<string, vscode.Range[]>();
    for (const editor of vscode.window.visibleTextEditors) {
      const ranges = cellBackgroundRangesFor(editor.document);
      editor.setDecorations(this.decorationType, ranges);
      applied.set(editor.document.uri.toString(), ranges);
    }
    return applied;
  }

  /** A colour setting changed: dispose the old type (clearing its tint) and re-apply a fresh one. */
  reload(): void {
    this.decorationType.dispose();
    this.decorationType = createDecorationType(readCellBackgroundSettings());
    this.refresh();
  }

  dispose(): void {
    this.decorationType.dispose();
  }
}

function createDecorationType(
  settings: CellBackgroundSettings,
): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    light: { backgroundColor: settings.light },
    dark: { backgroundColor: settings.dark },
  });
}

/** The registered decorator, so the test-only refresh helper can reach it. */
let activeDecorator: CellBackgroundDecorator | undefined;

/**
 * Register the always-on cell-background decorator: create the decoration type,
 * apply it to the editors already open, and keep it in sync as the active editor,
 * visible editors, document text, or `quarto.cells.background.*` settings change.
 */
export function registerCellBackgroundFeature(
  context: vscode.ExtensionContext,
): void {
  const decorator = new CellBackgroundDecorator();
  activeDecorator = decorator;
  decorator.refresh();
  context.subscriptions.push(
    decorator,
    new vscode.Disposable(() => {
      if (activeDecorator === decorator) {
        activeDecorator = undefined;
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(() => decorator.refresh()),
    vscode.window.onDidChangeVisibleTextEditors(() => decorator.refresh()),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (isVisible(event.document)) {
        decorator.refresh();
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("quarto.cells.background")) {
        decorator.reload();
      }
    }),
  );
}

function isVisible(doc: vscode.TextDocument): boolean {
  return vscode.window.visibleTextEditors.some(
    (editor) => editor.document === doc,
  );
}

/**
 * Force a re-apply and return the ranges applied per editor URI. Test-only: it
 * exercises the registered decorator the way the editor/document/config events
 * do, so a test can assert the right ranges reach a real editor (VS Code offers
 * no way to read applied decorations back). The caller must have registered the
 * feature IN THE SAME MODULE INSTANCE — the running extension loads the esbuild
 * bundle, so a test importing this compiled copy registers its own decorator
 * first (the `activate()` wiring is runtime-verified, not observable here).
 * Throws if no decorator has been registered in this instance.
 */
export function refreshCellBackgroundDecorationsForTesting(): Map<
  string,
  vscode.Range[]
> {
  if (!activeDecorator) {
    throw new Error(
      "cell-background feature is not registered (registerCellBackgroundFeature was not called)",
    );
  }
  return activeDecorator.refresh();
}
