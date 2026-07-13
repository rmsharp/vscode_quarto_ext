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
 * In-cell symbols ride the SAME real `file:` virtual document as every other
 * embedded forward (`features/embedded-vdoc.ts`, BACKLOG item 18). They used to
 * route through a custom `quarto-outline-symbols:` scheme, which no real
 * language server registers for — so this feature returned **nothing** from real
 * Pylance in production (`file:` → 2 symbols, our scheme → 0), while its tests
 * stayed green because the stand-in was keyed on that very scheme.
 *
 * ## Two DIFFERENT caches, and only one of them is fixed by the scheme change
 *
 * `vscode.DocumentSymbolProvider` has no refresh event, and `vscode.execute
 * DocumentSymbolProvider` caches its **result** per URI internally (plan §2.3) —
 * a config change alone does not bump the document version, so a
 * previously-queried document would otherwise keep serving its stale
 * (pre-toggle) symbols forever, even through a direct command re-invocation,
 * not just the Outline UI (empirically confirmed against a REAL on-disk document
 * during slice 1's own TDD, Learning #78 — so this is emphatically **not** an
 * artefact of the old custom scheme, and moving to `file:` does not fix it).
 *
 * The fix for the TOP-LEVEL provider is the VS Code-sanctioned one: dispose and
 * re-register the provider on the relevant config change, which fires the
 * language-feature registry's own change event. That is still here, and still
 * necessary.
 *
 * The fix for the PER-CELL forward is a URI the result cache has never seen. That
 * mechanism has not been deleted — it has been **generalized**: `ensureVdoc` mints
 * a fresh path whenever a vdoc's content changes (which is also what defeats the
 * separate model-text cache, M2/M3), so an edited cell is always queried on a URI
 * with no cached result, exactly as the old version-stamped store guaranteed.
 */

import * as vscode from "vscode";
import { cellLanguageId } from "../core/embedded/lang-map";
import { buildCellVirtualContent } from "../core/embedded/virtual-doc";
import { disposeVdocs, ensureVdoc } from "../features/embedded-vdoc";
import {
  buildOutline,
  findCellAtPosition,
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
    // Vdocs are real files now: a closed document must take its own off disk.
    vscode.workspace.onDidCloseTextDocument((doc) => void disposeVdocs(doc.uri)),
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
      visible.map((symbol) => toDocumentSymbol(symbol, document, text)),
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
      ? await forwardCellSymbols(symbol, document, text)
      : await Promise.all(
          symbol.children.map((child) => toDocumentSymbol(child, document, text)),
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
  document: vscode.TextDocument,
  text: string,
): Promise<vscode.DocumentSymbol[]> {
  const el = cellLanguageId(cellSymbol.lang ?? "");
  if (el === null) {
    return [];
  }
  const cell = findCellAtPosition(text, cellSymbol.startLine);
  if (cell === null) {
    return [];
  }
  // The cell's START LINE is what keeps two same-language cells apart. Every cell of
  // the document is forwarded CONCURRENTLY (the `Promise.all` above), so a key without
  // that discriminator would put two cells on one path and let their writes race — each
  // rendering the other's symbols.
  const vdocUri = await ensureVdoc(
    document,
    {
      docUri: document.uri.toString(),
      languageId: el.languageId,
      ext: el.ext,
      kind: "cell",
      cellStartLine: cell.startLine,
    },
    buildCellVirtualContent(text, cell),
  );
  if (vdocUri === undefined) {
    return []; // nowhere to write the vdoc — degrade to a cell node with no children
  }
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
