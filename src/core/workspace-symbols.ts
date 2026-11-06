/**
 * Pure logic for the workspace symbol provider ("Go to Symbol in Workspace",
 * CHANGELOG: workspace symbol provider, Session 54) — flattening the per-document outline tree from
 * `core/qmd/model`'s `buildOutline` into a queryable flat list, and matching
 * a flattened symbol's name against a query string. The `vscode` adapter
 * (`providers/workspace-symbols.ts`) calls `buildOutline` once per workspace
 * `.qmd` file, flattens each result here, and turns the matches into
 * `vscode.SymbolInformation`.
 */

import { resolveDocumentEngine } from "./document-engine-resolve";
import { buildOutline, type OutlineSymbol } from "./qmd/model";
import type { RenderMode } from "./render-mode";

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
 * descendants than the stack holds threw `RangeError: Maximum call stack size exceeded`: from about
 * 110,400 to 110,600 descendants, the figure depending on how deep the caller's stack already is (Node
 * 22.23.3, fresh process per probe: 110,360 through `buildOutline` and then `flattenOutline` in a bare
 * harness, 110,560 through `providers/workspace-symbols.ts` itself with `vscode` stubbed; it also moves by
 * about 15 between processes, and it does not depend on the engine hint, on a heading or a cell, or on the
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

/**
 * The flat symbols of one document: what a workspace-symbol pass computes of a file BEFORE the query is looked at
 * (Session 343, SIB-03). `fileName` decides the engine (`resolveDocumentEngine`: an `.Rmd` is knitr by its name) and
 * `mode` is the render mode the Outline reads the document for; neither depends on the query.
 */
export function flatSymbolsOf(fileName: string, text: string, mode: RenderMode): FlatOutlineSymbol[] {
  return flattenOutline(buildOutline(text, resolveDocumentEngine(fileName, text), mode));
}

/** The most characters of document text the cache keeps, in all: 8,388,608 (8 Mi), where a file of 1,255 lines is about 16,500. */
export const WORKSPACE_SYMBOL_CACHE_MAX_CHARS = 8_388_608;

/** The most files the cache keeps. */
export const WORKSPACE_SYMBOL_CACHE_MAX_FILES = 4_096;

/** The things a workspace-symbol cache can be given: another computation (a stand-in for the rows), and its two bounds. */
export interface WorkspaceSymbolCacheOptions {
  flatSymbolsOf?: (fileName: string, text: string, mode: RenderMode) => FlatOutlineSymbol[];
  /** The most characters of text the cache keeps, in all. */
  maxChars?: number;
  /** The most files the cache keeps. */
  maxFiles?: number;
}

/** The query-independent symbols of the workspace's files, read through a cache keyed by the file's uri. */
export interface WorkspaceSymbolCache {
  read(uri: string, fileName: string, text: string, mode: RenderMode): readonly FlatOutlineSymbol[];
}

/**
 * The seam of Session 343 (SIB-03): the adapter reads the flat symbols of every file through THIS interface, and in
 * the first version of it the read is `flatSymbolsOf` and nothing is kept.
 */
export function createWorkspaceSymbolCache(options: WorkspaceSymbolCacheOptions = {}): WorkspaceSymbolCache {
  const compute = options.flatSymbolsOf ?? flatSymbolsOf;
  return { read: (_uri, fileName, text, mode) => compute(fileName, text, mode) };
}
