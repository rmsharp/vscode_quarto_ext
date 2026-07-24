/**
 * `WorkspaceSymbolProvider` for `.qmd` files — powers "Go to Symbol in
 * Workspace" (Ctrl+T / Cmd+T) across every `.qmd` file in the workspace, not
 * just the active editor (CHANGELOG: workspace symbol provider, Session 54). A thin `vscode`
 * adapter: per-file parsing reuses the same `core/qmd/model` `buildOutline`
 * the Outline view and breadcrumbs use (`providers/outline.ts`), flattened
 * via `core/workspace-symbols.ts` `flattenOutline` and matched against the
 * query with `matchesWorkspaceQuery`. No `package.json` contribution is
 * needed — registering a workspace symbol provider needs no manifest entry,
 * so activation is unchanged.
 */

import * as vscode from "vscode";
import { buildOutline } from "../core/qmd/model";
import {
  flattenOutline,
  matchesWorkspaceQuery,
} from "../core/workspace-symbols";

/** Register the workspace symbol provider, tied to the extension lifetime. */
export function registerWorkspaceSymbolsProvider(
  context: vscode.ExtensionContext,
): void {
  context.subscriptions.push(
    vscode.languages.registerWorkspaceSymbolProvider(
      new QmdWorkspaceSymbolProvider(),
    ),
  );
}

class QmdWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {
  async provideWorkspaceSymbols(
    query: string,
    token: vscode.CancellationToken,
  ): Promise<vscode.SymbolInformation[]> {
    const files = await vscode.workspace.findFiles(
      "**/*.qmd",
      undefined,
      undefined,
      token,
    );
    const results: vscode.SymbolInformation[] = [];
    for (const uri of files) {
      if (token.isCancellationRequested) break;
      // Reuses VS Code's own document cache: an already-open (possibly
      // dirty/unsaved) document is returned as-is, not re-read from disk.
      const document = await vscode.workspace.openTextDocument(uri);
      for (const symbol of flattenOutline(buildOutline(document.getText()))) {
        if (!matchesWorkspaceQuery(symbol.name, query)) continue;
        results.push(
          new vscode.SymbolInformation(
            symbol.name,
            symbol.kind === "heading"
              ? vscode.SymbolKind.String
              : vscode.SymbolKind.Function,
            symbol.containerName,
            new vscode.Location(uri, selectionRange(document, symbol.selectionLine)),
          ),
        );
      }
    }
    return results;
  }
}

/**
 * The range of a single line, clamped to the document so a model/line-count
 * mismatch can never produce an out-of-range location (which VS Code would
 * reject). Mirrors `providers/outline.ts`'s `lineSpan` clamp discipline.
 */
function selectionRange(
  document: vscode.TextDocument,
  line: number,
): vscode.Range {
  const maxLine = Math.max(0, document.lineCount - 1);
  const clamped = Math.min(Math.max(line, 0), maxLine);
  return document.lineAt(clamped).range;
}
