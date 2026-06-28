/**
 * `DocumentSymbolProvider` for `.qmd` — populates the Outline view and the
 * editor breadcrumbs (plan §6 Phase 6a).
 *
 * A thin `vscode` adapter (plan §3.3): all parsing lives in the pure
 * `core/qmd/model` region model, and this file only translates the core
 * `OutlineSymbol` tree into `vscode.DocumentSymbol`s. Registering a provider
 * needs no `package.json` contribution, so activation is unchanged.
 */

import * as vscode from "vscode";
import { buildOutline, type OutlineSymbol } from "../core/qmd/model";

/** Register the outline provider for the `quarto` language, tied to the extension lifetime. */
export function registerOutlineProvider(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      { language: "quarto" },
      new QmdDocumentSymbolProvider(),
    ),
  );
}

class QmdDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(
    document: vscode.TextDocument,
  ): vscode.DocumentSymbol[] {
    return buildOutline(document.getText()).map((symbol) =>
      toDocumentSymbol(symbol, document),
    );
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
