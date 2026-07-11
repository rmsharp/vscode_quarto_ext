/**
 * `DocumentSymbolProvider` for `.qmd` — populates the Outline view and the
 * editor breadcrumbs (plan §6 Phase 6a; the `quarto.symbols.showCodeCellsInOutline`
 * toggle, BACKLOG item 11 slice 1; in-cell code symbol forwarding, slice 2 —
 * `docs/planning/2026-07-10-outline-granularity-plan.md`).
 *
 * A thin `vscode` adapter (plan §3.3): all parsing lives in the pure
 * `core/qmd/model` region model, and this file translates the core
 * `OutlineSymbol` tree into `vscode.DocumentSymbol`s — forwarding each
 * mapped-language cell's body into its own per-cell virtual document
 * (`core/embedded/virtual-doc.ts` `buildCellVirtualContent`, slice 2) and
 * splicing the result in as that cell node's children.
 *
 * `vscode.DocumentSymbolProvider` has no refresh event, and `vscode.execute
 * DocumentSymbolProvider` caches its result per URI internally (plan §2.3) —
 * a config change alone does not bump the document version, so a
 * previously-queried document would otherwise keep serving its stale
 * (pre-toggle) symbols forever, even through a direct command re-invocation,
 * not just the Outline UI (plan §2.4, empirically confirmed against a REAL
 * on-disk document during slice 1's own TDD). The fix for the TOP-LEVEL
 * provider is the VS Code-sanctioned one: dispose and re-register the
 * provider on the relevant config change, which fires the language-feature
 * registry's own change event. The SAME cache also strands a reused, stable
 * per-cell vdoc URI (the convention `embedded.ts`'s `VirtualDocStore` uses
 * for completion/hover/definition/signature-help, which are unaffected by
 * this specific cache) — `InCellSymbolStore` below fixes this the other way,
 * by minting a version-stamped, never-before-seen URI on every outline
 * computation so the cache can never have anything stale to serve.
 */

import * as vscode from "vscode";
import { cellLanguageId } from "../core/embedded/lang-map";
import { buildCellVirtualContent } from "../core/embedded/virtual-doc";
import {
  buildOutline,
  findCellAtPosition,
  hideCellsInOutline,
  type OutlineSymbol,
} from "../core/qmd/model";

const SHOW_CELLS_SETTING = "symbols.showCodeCellsInOutline";

/**
 * The scheme in-cell symbol forwarding's per-cell virtual documents live
 * under (plan §2.3/§5, slice 2). Distinct from `embedded.ts`'s
 * `quarto-embedded` scheme — a `vscode.workspace.registerTextDocumentContent
 * Provider` call can register at most one provider per scheme.
 */
const IN_CELL_SYMBOL_SCHEME = "quarto-outline-symbols";

/** Register the outline provider for the `quarto` language, tied to the extension lifetime. */
export function registerOutlineProvider(context: vscode.ExtensionContext): void {
  const store = new InCellSymbolStore();
  let registration = registerProvider(store);
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(IN_CELL_SYMBOL_SCHEME, store),
    new vscode.Disposable(() => registration.dispose()),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`quarto.${SHOW_CELLS_SETTING}`)) {
        registration.dispose();
        registration = registerProvider(store);
      }
    }),
    vscode.commands.registerCommand(
      "quarto.toggleCodeCellsInOutline",
      toggleShowCells,
    ),
    // The vdoc Map must not grow unbounded: drop a document's vdocs when it closes.
    vscode.workspace.onDidCloseTextDocument((doc) => store.evict(doc.uri)),
  );
}

function registerProvider(store: InCellSymbolStore): vscode.Disposable {
  return vscode.languages.registerDocumentSymbolProvider(
    { language: "quarto" },
    new QmdDocumentSymbolProvider(store),
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

/**
 * Serves per-cell virtual documents for in-cell symbol forwarding (BACKLOG
 * item 11 slice 2, plan §2.3). Unlike `embedded.ts`'s `VirtualDocStore`
 * (whose STABLE per-(document, language) key is exactly right for
 * completion/hover/definition/signature-help), `vscode.executeDocumentSymbol
 * Provider` caches its result per URI internally, so a stable key here would
 * serve stale in-cell symbols after the first outline computation. Every
 * `set()` call therefore mints a version-stamped URI the cache can never have
 * seen before, and evicts the PREVIOUS version for the same cell (keyed by
 * document + the cell's start line) so the map does not grow unbounded across
 * a long editing session.
 */
class InCellSymbolStore implements vscode.TextDocumentContentProvider {
  private readonly contents = new Map<string, string>();
  /** `${docUri}#${cellStartLine}` -> the currently-live vdoc key, for eviction on the next `set()`. */
  private readonly current = new Map<string, string>();
  /** docUri -> every live vdoc key it owns, for eviction on document close. */
  private readonly owners = new Map<string, Set<string>>();
  private version = 0;

  provideTextDocumentContent(uri: vscode.Uri): string | undefined {
    return this.contents.get(uri.toString());
  }

  /** Store `content` as a FRESH version-stamped vdoc for `docUri`'s cell at `cellStartLine`. */
  set(
    docUri: vscode.Uri,
    cellStartLine: number,
    ext: string,
    languageId: string,
    content: string,
  ): vscode.Uri {
    const owner = docUri.toString();
    const cellKey = `${owner}#${cellStartLine}`;
    const previous = this.current.get(cellKey);
    if (previous !== undefined) {
      this.contents.delete(previous);
      this.owners.get(owner)?.delete(previous);
    }
    this.version += 1;
    const vdocUri = vscode.Uri.from({
      scheme: IN_CELL_SYMBOL_SCHEME,
      authority: languageId,
      path: `/${encodeURIComponent(docUri.toString(true))}/${cellStartLine}/${this.version}.${ext}`,
    });
    const key = vdocUri.toString();
    this.contents.set(key, content);
    this.current.set(cellKey, key);
    const keys = this.owners.get(owner) ?? new Set<string>();
    keys.add(key);
    this.owners.set(owner, keys);
    return vdocUri;
  }

  /** Drop every virtual doc owned by `docUri` (called when the document closes). */
  evict(docUri: vscode.Uri): void {
    const owner = docUri.toString();
    const keys = this.owners.get(owner);
    if (keys !== undefined) {
      for (const key of keys) {
        this.contents.delete(key);
      }
      this.owners.delete(owner);
    }
    for (const cellKey of [...this.current.keys()]) {
      if (cellKey.startsWith(`${owner}#`)) {
        this.current.delete(cellKey);
      }
    }
  }
}

class QmdDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  constructor(private readonly store: InCellSymbolStore) {}

  async provideDocumentSymbols(
    document: vscode.TextDocument,
  ): Promise<vscode.DocumentSymbol[]> {
    const showCells = vscode.workspace
      .getConfiguration("quarto")
      .get<boolean>(SHOW_CELLS_SETTING, true);
    const text = document.getText();
    const tree = buildOutline(text);
    const visible = showCells ? tree : hideCellsInOutline(tree);
    return Promise.all(
      visible.map((symbol) => toDocumentSymbol(symbol, document, text, this.store)),
    );
  }
}

/**
 * Translate one core `OutlineSymbol` (and its children) to a
 * `vscode.DocumentSymbol`. A cell node's children come from in-cell symbol
 * forwarding (slice 2, always `[]` in the pure core tree); a heading node's
 * children recurse the same way.
 */
async function toDocumentSymbol(
  symbol: OutlineSymbol,
  document: vscode.TextDocument,
  text: string,
  store: InCellSymbolStore,
): Promise<vscode.DocumentSymbol> {
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
  result.children =
    symbol.kind === "cell"
      ? await forwardCellSymbols(symbol, document.uri, text, store)
      : await Promise.all(
          symbol.children.map((child) => toDocumentSymbol(child, document, text, store)),
        );
  return result;
}

/**
 * Forward a cell's body into its own per-cell virtual document and return
 * whatever the target language's own symbol provider reports (plan §2.1).
 * Yields `[]` — never throws — for an unmapped-engine cell (`cellLanguageId`
 * returns `null`) or when the forward itself yields nothing (no language
 * extension installed, or one installed with no symbols; indistinguishable
 * to this adapter, the same §2.5 degradation contract every other embedded
 * forward in this project follows).
 */
async function forwardCellSymbols(
  cellSymbol: OutlineSymbol,
  docUri: vscode.Uri,
  text: string,
  store: InCellSymbolStore,
): Promise<vscode.DocumentSymbol[]> {
  const el = cellLanguageId(cellSymbol.lang ?? "");
  if (el === null) {
    return [];
  }
  const cell = findCellAtPosition(text, cellSymbol.startLine);
  if (cell === null) {
    return [];
  }
  const content = buildCellVirtualContent(text, cell);
  const vdocUri = store.set(docUri, cell.startLine, el.ext, el.languageId, content);
  const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    "vscode.executeDocumentSymbolProvider",
    vdocUri,
  );
  return symbols ?? [];
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
