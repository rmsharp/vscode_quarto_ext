/**
 * `DocumentSymbolProvider` for `.qmd` — populates the Outline view and the
 * editor breadcrumbs (plan §6 Phase 6a; the `quarto.symbols.showCodeCellsInOutline`
 * toggle, BACKLOG item 11 slice 1, `docs/planning/2026-07-10-outline-granularity-plan.md`).
 *
 * A thin `vscode` adapter (plan §3.3): all parsing lives in the pure
 * `core/qmd/model` region model, and this file only translates the core
 * `OutlineSymbol` tree into `vscode.DocumentSymbol`s.
 *
 * `vscode.DocumentSymbolProvider` has no refresh event, and `vscode.execute
 * DocumentSymbolProvider` caches its result per document version — a config
 * change alone does not bump the document version, so a previously-queried
 * document would otherwise keep serving its stale (pre-toggle) symbols
 * forever, even through a direct command re-invocation, not just the Outline
 * UI (plan §2.4, empirically confirmed against a REAL on-disk document during
 * this slice's own TDD — a stronger version of the plan's virtual-document
 * finding). The fix is the VS Code-sanctioned one: dispose and re-register the
 * provider on the relevant config change, which fires the language-feature
 * registry's own change event.
 */

import * as vscode from "vscode";
import {
  buildOutline,
  hideCellsInOutline,
  type OutlineSymbol,
} from "../core/qmd/model";

const SHOW_CELLS_SETTING = "symbols.showCodeCellsInOutline";

/** Register the outline provider for the `quarto` language, tied to the extension lifetime. */
export function registerOutlineProvider(context: vscode.ExtensionContext): void {
  let registration = registerProvider();
  context.subscriptions.push(
    new vscode.Disposable(() => registration.dispose()),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`quarto.${SHOW_CELLS_SETTING}`)) {
        registration.dispose();
        registration = registerProvider();
      }
    }),
    vscode.commands.registerCommand(
      "quarto.toggleCodeCellsInOutline",
      toggleShowCells,
    ),
  );
}

function registerProvider(): vscode.Disposable {
  return vscode.languages.registerDocumentSymbolProvider(
    { language: "quarto" },
    new QmdDocumentSymbolProvider(),
  );
}

/** Flip the show/hide-cells setting; the config-change listener above handles the refresh. */
async function toggleShowCells(): Promise<void> {
  const config = vscode.workspace.getConfiguration("quarto");
  const current = config.get<boolean>(SHOW_CELLS_SETTING, true);
  await config.update(
    SHOW_CELLS_SETTING,
    !current,
    vscode.ConfigurationTarget.Global,
  );
}

class QmdDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(
    document: vscode.TextDocument,
  ): vscode.DocumentSymbol[] {
    const showCells = vscode.workspace
      .getConfiguration("quarto")
      .get<boolean>(SHOW_CELLS_SETTING, true);
    const tree = buildOutline(document.getText());
    const visible = showCells ? tree : hideCellsInOutline(tree);
    return visible.map((symbol) => toDocumentSymbol(symbol, document));
  }
}

/** Translate one core `OutlineSymbol` (and its children) to a `vscode.DocumentSymbol`. */
function toDocumentSymbol(
  symbol: OutlineSymbol,
  document: vscode.TextDocument,
): vscode.DocumentSymbol {
  const kind =
    symbol.kind === "heading"
      ? vscode.SymbolKind.String
      : vscode.SymbolKind.Function;
  const result = new vscode.DocumentSymbol(
    symbol.name,
    symbol.lang ?? "",
    kind,
    lineSpan(document, symbol.startLine, symbol.endLine),
    lineSpan(document, symbol.selectionLine, symbol.selectionLine),
  );
  result.children = symbol.children.map((child) =>
    toDocumentSymbol(child, document),
  );
  return result;
}

/**
 * A range covering whole lines `[startLine, endLine]`, clamped to the document
 * so a model/line-count mismatch can never produce an out-of-range symbol
 * (which VS Code would reject).
 */
function lineSpan(
  document: vscode.TextDocument,
  startLine: number,
  endLine: number,
): vscode.Range {
  const maxLine = Math.max(0, document.lineCount - 1);
  const start = clamp(startLine, 0, maxLine);
  const end = clamp(endLine, 0, maxLine);
  return new vscode.Range(start, 0, end, document.lineAt(end).range.end.character);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
