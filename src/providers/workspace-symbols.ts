/**
 * `WorkspaceSymbolProvider` for `.qmd` files — powers "Go to Symbol in
 * Workspace" (Ctrl+T / Cmd+T) across every `.qmd` file in the workspace, not
 * just the active editor (CHANGELOG: workspace symbol provider, Session 54). A thin `vscode`
 * adapter: per-file parsing reuses the same `core/qmd/model` `buildOutline`
 * the Outline view and breadcrumbs use (`providers/outline.ts`), flattened
 * via `core/workspace-symbols.ts` `flattenOutline` and matched against the
 * query with `matchesWorkspaceQuery`. Registering a workspace symbol provider
 * needs no `package.json` entry, so activation is unchanged; it does read ONE
 * contributed setting, `quarto.symbols.renderMode` (Session 310), per file, so
 * that it lists the same headings the Outline does.
 */

import * as vscode from "vscode";
import { RENDER_MODE_SETTING, resolveRenderMode } from "../core/render-mode";
import {
  createWorkspaceSymbolCache,
  matchesWorkspaceQuery,
} from "../core/workspace-symbols";

/**
 * ONE cache for every query (Session 343): a cache made per query would never hit, and without one every
 * keystroke of the query rebuilt the outline of every `.qmd` file of the workspace (about 190 to 230 ms for 100 files
 * of 1,255 lines, the same again for each keystroke). It holds the QUERY-INDEPENDENT symbols of each file, keyed by
 * the file's uri and valid while its text, its render mode and its file name are what they were; the query filter and
 * the `SymbolInformation` below stay per pass. What it keeps and drops is `createWorkspaceSymbolCache` in
 * `core/workspace-symbols`.
 */
const symbolCache = createWorkspaceSymbolCache();

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
      const docText = document.getText();
      // The same render mode the Outline reads (Session 310), at THIS file's scope, so the two surfaces never disagree about which headings exist. Nothing is cached on this side:
      // every query reads the setting afresh.
      const mode = resolveRenderMode(
        vscode.workspace.getConfiguration("quarto", uri).get<unknown>(RENDER_MODE_SETTING),
      );
      // The engine is resolved, on a miss, from the file name and the text the adapter already holds — see `outline.ts`.
      for (const symbol of symbolCache.read(uri.toString(), document.fileName, docText, mode)) {
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
