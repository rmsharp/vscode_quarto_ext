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
  appendFlatOutline(result, symbols, containerName);
  return result;
}

/**
 * Append the symbols of `symbols` to `out`, depth-first, each with its parent's
 * name as its container (`containerName` for a root). Exported as the seam
 * `flattenOutline` is built on, so that `test/unit/spreads-equivalence.test.ts`
 * can hand it a list that is not empty.
 *
 * ⚠ **WHY EACH SYMBOL IS PUSHED ON ITS OWN, AND NOT `out.push(...flattened children)`.** A call with a
 * spread argument puts one stack slot per element on the call stack, so a heading or a cell with more
 * descendants than the stack holds threw `RangeError: Maximum call stack size exceeded`: from 110,360
 * descendants (last OK 110,359) when read through `buildOutline` and then `flattenOutline` the way
 * `providers/workspace-symbols.ts` does (Node 22.23.3, fresh process per probe; the figure moves by about
 * 15 between processes, and it does not depend on the engine hint, on a heading or a cell, or on the
 * width of the line). That provider has no `catch`, so ONE document with a section this long failed
 * "Go to Symbol in Workspace" for EVERY file of the workspace. Every symbol goes into the one list
 * handed down instead; nothing is spread and nothing is copied.
 *
 * The recursion is as deep as the tree: seven at most for a tree `buildOutline` builds (six heading
 * levels and a cell), which is why it is not an explicit stack. The old statement lives on as the oracle of
 * `test/unit/spreads-equivalence.test.ts` (`oldFlattenOutline`).
 */
export function appendFlatOutline(
  out: FlatOutlineSymbol[],
  symbols: OutlineSymbol[],
  containerName: string,
): void {
  for (const symbol of symbols) {
    out.push({
      kind: symbol.kind,
      name: symbol.name,
      containerName,
      startLine: symbol.startLine,
      endLine: symbol.endLine,
      selectionLine: symbol.selectionLine,
    });
    appendFlatOutline(out, symbol.children, symbol.name);
  }
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
