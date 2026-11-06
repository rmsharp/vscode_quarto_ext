/**
 * Pure logic for the workspace symbol provider ("Go to Symbol in Workspace",
 * CHANGELOG: workspace symbol provider, Session 54) — flattening the per-document outline tree from
 * `core/qmd/model`'s `buildOutline` into a queryable flat list, and matching
 * a flattened symbol's name against a query string. The `vscode` adapter
 * (`providers/workspace-symbols.ts`) reads the flat symbols of every workspace
 * `.qmd` file through `createWorkspaceSymbolCache` below (which runs `buildOutline`
 * once per file TEXT, not once per query keystroke), matches them against the
 * query here, and turns the matches into `vscode.SymbolInformation`.
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

/** The query-independent symbols of the workspace's files, read through a cache keyed by the file's uri. The list and its symbols are frozen: read them, never edit them. */
export interface WorkspaceSymbolCache {
  read(uri: string, fileName: string, text: string, mode: RenderMode): readonly Readonly<FlatOutlineSymbol>[];
}

/** What the cache keeps for one uri: the three things the symbols depend on, and the symbols. */
interface CachedSymbols {
  fileName: string;
  mode: RenderMode;
  text: string;
  symbols: readonly Readonly<FlatOutlineSymbol>[];
}

/** A bound an option gives: a finite number of at least 0, rounded down. NaN, a negative number, an infinity and a non-number are not bounds, and the default stands. */
function boundOf(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

/**
 * The flat symbols of every `.qmd` file of the workspace, read through a cache (Session 343, SIB-03). "Go to Symbol in
 * Workspace" built the Outline of EVERY file on EVERY keystroke of the query, because the query filter ran after it:
 * 100 files of 1,255 lines cost about 200 ms a keystroke and 400 files about 770 ms, and every pass after the first
 * cost what the first did. What a file's symbols depend on is its text, the render mode and its file name (which
 * decides the engine); the query is not among them, so the query filter and the `SymbolInformation` mapping stay in
 * the adapter, per pass, and the symbols are kept per file.
 *
 * An entry is keyed by the uri's STRING and is served only while the text is EQUAL (a string comparison, by value:
 * `getText()` hands a new string every time), the mode is equal and the file name is equal. The cheap two are compared
 * first, so a file whose mode changed is not compared character by character. ONE entry per uri: a changed file
 * replaces its own.
 *
 * **Two bounds, least recently used out.** The text is kept with the symbols (the equality test needs it), so the cache
 * holds at most {@link WORKSPACE_SYMBOL_CACHE_MAX_CHARS} characters of it in all and
 * {@link WORKSPACE_SYMBOL_CACHE_MAX_FILES} files. A text longer than the character bound is computed and NOT kept, and
 * it drops the uri's older entry (which can no longer be served) without pushing anyone else out. A pass over MORE
 * files than fit pays for every file at every pass, as before: least-recently-used eviction in a cyclic scan evicts
 * exactly the entry the next pass needs. 100 files of 16,500 characters fit with room to spare; about 500 do not.
 *
 * **The value is frozen, not copied.** The list and each symbol are `Object.freeze`d once, when they are made, and every
 * read hands back that very list: an edit throws in strict code (and does nothing in sloppy code) instead of corrupting
 * what the next pass is served from, and the types say `readonly`. A copy per pass would cost a list the size of the
 * outline for every file on every keystroke.
 *
 * The computation is made BEFORE the old entry is touched, so one that throws (a document whose outline overflows the
 * stack) leaves the cache as it was and throws through, as the uncached pass did.
 */
export function createWorkspaceSymbolCache(options: WorkspaceSymbolCacheOptions = {}): WorkspaceSymbolCache {
  const compute = options.flatSymbolsOf ?? flatSymbolsOf;
  const maxChars = boundOf(options.maxChars, WORKSPACE_SYMBOL_CACHE_MAX_CHARS);
  const maxFiles = boundOf(options.maxFiles, WORKSPACE_SYMBOL_CACHE_MAX_FILES);
  const entries = new Map<string, CachedSymbols>();
  let keptChars = 0;

  return {
    read(uri, fileName, text, mode) {
      const kept = entries.get(uri);
      if (kept !== undefined && kept.mode === mode && kept.fileName === fileName && kept.text === text) {
        entries.delete(uri);
        entries.set(uri, kept); // most recently used
        return kept.symbols;
      }
      const flat = compute(fileName, text, mode);
      for (const symbol of flat) Object.freeze(symbol);
      const symbols = Object.freeze(flat);
      if (kept !== undefined) {
        entries.delete(uri);
        keptChars -= kept.text.length;
      }
      if (text.length <= maxChars) {
        entries.set(uri, { fileName, mode, text, symbols });
        keptChars += text.length;
        while (keptChars > maxChars || entries.size > maxFiles) {
          const oldest = entries.entries().next();
          if (oldest.done === true) break;
          entries.delete(oldest.value[0]);
          keptChars -= oldest.value[1].text.length;
        }
      }
      return symbols;
    },
  };
}
