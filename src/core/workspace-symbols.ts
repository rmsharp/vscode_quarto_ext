/**
 * Pure logic for the workspace symbol provider ("Go to Symbol in Workspace",
 * CHANGELOG: workspace symbol provider, Session 54) — flattening the per-document outline tree from
 * `core/qmd/model`'s `buildOutline` into a queryable flat list, and matching
 * a flattened symbol's name against a query string. The `vscode` adapter
 * (`providers/workspace-symbols.ts`) calls `buildOutline` once per workspace
 * `.qmd` file, flattens each result here, and turns the matches into
 * `vscode.SymbolInformation`.
 */

import type { OutlineSymbol } from "./qmd/model";

/** One symbol flattened out of an `OutlineSymbol` tree, with its container (parent) name attached. */
export interface FlatOutlineSymbol {
  kind: "heading" | "cell";
  name: string;
  containerName: string;
  startLine: number;
  endLine: number;
  selectionLine: number;
}

/**
 * Flatten a per-document outline tree into a queryable flat list, depth-first.
 * `containerName` is the name of the nearest enclosing symbol (its parent
 * heading), matching how `vscode.SymbolInformation.containerName` is used.
 */
export function flattenOutline(
  symbols: OutlineSymbol[],
  containerName = "",
): FlatOutlineSymbol[] {
  const result: FlatOutlineSymbol[] = [];
  for (const symbol of symbols) {
    result.push({
      kind: symbol.kind,
      name: symbol.name,
      containerName,
      startLine: symbol.startLine,
      endLine: symbol.endLine,
      selectionLine: symbol.selectionLine,
    });
    result.push(...flattenOutline(symbol.children, symbol.name));
  }
  return result;
}

/**
 * Whether `name` matches a workspace-symbol `query`. An empty query matches
 * everything — `vscode`'s own Quick Open re-scores and highlights whatever a
 * provider returns, so an empty query is the "list everything" case.
 */
export function matchesWorkspaceQuery(name: string, query: string): boolean {
  if (query.length === 0) return true;
  return name.toLowerCase().includes(query.toLowerCase());
}
