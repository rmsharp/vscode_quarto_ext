/**
 * Semantic highlighting for embedded code cells (BACKLOG item 16, Slice 1; plan §6.4).
 *
 * VS Code colours a `.qmd` from our TextMate grammar, which is syntactic: it knows `foo`
 * is an identifier, not that it is a read-only module-level constant. The user's own
 * language server knows. This forwards the document to it and layers its answer on top.
 *
 * ## Why this could not be built until now
 *
 * It rides the same virtual document as every other embedded forward, and until BACKLOG
 * item 18 that vdoc lived on a custom URI scheme that real language servers filter out.
 * Semantic tokens were unreachable on it for EVERY language — not just Pylance, but even
 * VS Code's own built-in TypeScript provider. The `file:` vdoc (`features/embedded-vdoc.ts`)
 * is what made this possible; it also owns the mandatory `openTextDocument` (M1), whose
 * absence makes `vscode.provideDocumentSemanticTokens` return `undefined` with no error —
 * indistinguishable from "no extension installed".
 *
 * ## The command names are `provide*`, not `execute*`
 *
 * Every other forward in this codebase uses `vscode.executeXxxProvider`. The semantic
 * token family is `vscode.provideDocumentSemanticTokens` / `…Legend`. They are ext-host
 * API commands: callable, but NOT enumerated by `getCommands(true)` — so do not write a
 * test that asserts their presence that way; it fails while the command works.
 *
 * ## Scope: Slice 1 is `{python}` only
 *
 * One language, one stream. Slice 2 generalizes to every language present in the document
 * and merges the streams (`mergeSemanticTokens`); Slice 3 settles the legend/theming
 * question (D4). The translation core is already legend-agnostic, so neither needs to
 * revisit this file's logic — only its language selection.
 */

import * as vscode from "vscode";
import { cellLanguageId } from "../core/embedded/lang-map";
import {
  decodeTokens,
  encodeTokens,
  OUR_LEGEND,
} from "../core/embedded/semantic-tokens";
import {
  buildVirtualContent,
  hasCellOfLanguage,
} from "../core/embedded/virtual-doc";
import { disposeVdocs, ensureVdoc } from "../features/embedded-vdoc";

/** Slice 1's single forwarding target. Slice 2 replaces this with every language present. */
const SLICE_1_LANGUAGE = "python";

/**
 * Only real documents, and only the two schemes that have somewhere to put a vdoc.
 *
 * The scheme filter is load-bearing here in a way it is not for the gesture-driven
 * forwards. VS Code asks a semantic-tokens provider about EVERY visible model with no
 * user action at all — including the read-only `git:` side of a "Compare with HEAD" diff.
 * With a bare `{language:"quarto"}` selector we would answer for that document too, and
 * since `getWorkspaceFolder()` is scheme-aware and returns nothing for `git:`, the vdoc
 * would silently take the `mkdtemp` fallback: writing the HEAD revision of the user's
 * Python out to a temp directory and starting a language server on it, every time they
 * look at a diff. `untitled:` legitimately uses that fallback (there is no workspace
 * directory to use); `git:` and friends have no business creating one.
 */
const QMD: vscode.DocumentSelector = [
  { language: "quarto", scheme: "file" },
  { language: "quarto", scheme: "untitled" },
];

/** The legend we declare up front, as VS Code requires (see `OUR_LEGEND`). */
const LEGEND = new vscode.SemanticTokensLegend(
  OUR_LEGEND.tokenTypes,
  OUR_LEGEND.tokenModifiers,
);

/** Register semantic-token forwarding for embedded cells, tied to the extension lifetime. */
export function registerSemanticTokensProvider(
  context: vscode.ExtensionContext,
): void {
  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      QMD,
      new EmbeddedSemanticTokensProvider(),
      LEGEND,
    ),
    // Our vdocs are real files in the user's workspace. Every embedded feature registers
    // this (the adapter's `disposeVdocs` is idempotent and keyed by the OWNING document),
    // so a closed `.qmd` takes its vdocs with it no matter which feature minted them.
    vscode.workspace.onDidCloseTextDocument((doc) => void disposeVdocs(doc.uri)),
  );
}

class EmbeddedSemanticTokensProvider
  implements vscode.DocumentSemanticTokensProvider
{
  async provideDocumentSemanticTokens(
    document: vscode.TextDocument,
  ): Promise<vscode.SemanticTokens | undefined> {
    const target = cellLanguageId(SLICE_1_LANGUAGE);
    if (target === null) {
      return undefined;
    }
    const text = document.getText();

    // Cheap gate FIRST. VS Code re-requests tokens for every visible `.qmd` on a debounced
    // timer as the user types, so this runs constantly — including for documents that
    // contain no Python at all, which is most of them. `hasCellOfLanguage` answers from
    // the cell scan alone; `buildVirtualContent` additionally rebuilds a full-length copy
    // of the document, which on a large prose-only `.qmd` is pure waste on the extension
    // host's single thread (measured at ~29 ms per pass on a 4.4 MB document — every pass
    // of which was thrown away by the emptiness check that used to live here).
    if (!hasCellOfLanguage(text, target.languageId)) {
      return undefined;
    }

    // The whole-language virtual document: this language's cell bodies kept verbatim,
    // everything else blanked to equal-length space runs. That blanking is the identity
    // mapping — the server's line/character coordinates are already the `.qmd`'s, so no
    // token needs a coordinate remap.
    const content = buildVirtualContent(text, target.languageId);

    const vdocUri = await ensureVdoc(
      document,
      {
        docUri: document.uri.toString(),
        languageId: target.languageId,
        ext: target.ext,
        kind: "lang",
      },
      content,
    );
    // No writable location: degrade to no tokens, exactly as the no-extension path does.
    // The cell keeps its TextMate colouring. Never throw — a `.qmd` must stay usable.
    if (vdocUri === undefined) {
      return undefined;
    }

    // The legend is per-server and only knowable at runtime, so it must be fetched
    // alongside the tokens: the token stream's type/modifier numbers are indices INTO it
    // and are meaningless without it.
    const [legend, tokens] = await Promise.all([
      vscode.commands.executeCommand<vscode.SemanticTokensLegend | undefined>(
        "vscode.provideDocumentSemanticTokensLegend",
        vdocUri,
      ),
      vscode.commands.executeCommand<vscode.SemanticTokens | undefined>(
        "vscode.provideDocumentSemanticTokens",
        vdocUri,
      ),
    ]);
    if (legend === undefined || tokens === undefined) {
      return undefined; // no server for this language, or it declined — TextMate stands
    }

    const decoded = decodeTokens({ data: tokens.data, legend });
    return new vscode.SemanticTokens(encodeTokens(decoded, OUR_LEGEND));
  }
}
