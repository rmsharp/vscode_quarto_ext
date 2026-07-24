/**
 * Semantic highlighting for embedded code cells (CHANGELOG: semantic highlighting via the embedded LSP, Sessions 88-90, Slice 1; plan §6.4).
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
 * ## Scope: every language in the document (Slice 2)
 *
 * A `.qmd` may mix `{python}`, `{r}`, `{julia}` and `{ojs}`. Each gets its own virtual
 * document and its own server, and the answers — each in its own legend, each covering a
 * disjoint set of lines — are merged into the ONE ascending stream VS Code accepts
 * (`mergeSemanticTokens`). A language whose server is absent, silent, or failing drops out
 * on its own and takes nothing with it.
 *
 * Slice 3 still owns the legend/theming question (D4): a token type outside our standard
 * legend is currently dropped and keeps its TextMate colour. That costs 36% of Pylance's
 * tokens and 0% of the built-in JS service's (both measured) — the translation core is
 * legend-agnostic, so Slice 3 changes `OUR_LEGEND`, not this file.
 */

import * as vscode from "vscode";
import type { EmbeddedLang } from "../core/embedded/lang-map";
import {
  mergeSemanticTokens,
  OUR_LEGEND,
  type TokenStream,
} from "../core/embedded/semantic-tokens";
import {
  buildVirtualContent,
  embeddedLanguagesIn,
} from "../core/embedded/virtual-doc";
import { disposeVdocs, ensureVdoc } from "../features/embedded-vdoc";

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

/**
 * How many times a document whose answer came back INCOMPLETE may ask VS Code to re-fetch,
 * and how long to wait first.
 *
 * A language server is not ready the instant we open its virtual document — and VS Code will
 * not come back on its own. Its `ModelSemanticColoring` re-fetches on model change, theme
 * change, config change, and provider-registry change; the registry change is the one that
 * SHOULD rescue us (opening the vdoc is what activates Pylance / the TS-JS service, which then
 * register their providers). But it schedules that fetch on a 300 ms timer, and when the timer
 * fires while our first request is still in flight — two disk writes, two `openTextDocument`s,
 * two servers starting — `_fetchDocumentSemanticTokensNow` sees its own in-flight guard and
 * returns, dropping the fetch rather than queueing it. So the rescue is swallowed by the very
 * work that triggered it, and the language that missed the first pass stays uncoloured until
 * the user happens to type.
 *
 * Firing `onDidChangeSemanticTokens` is the API's own answer to "my tokens changed underneath
 * you, ask again". The cap is what keeps it honest: if a language genuinely has no server
 * installed, its stream will never arrive, and an uncapped retry would re-ask forever. After
 * these attempts we stop, and those cells keep their TextMate colouring — the correct
 * degradation, and the one this whole feature promises.
 */
const INCOMPLETE_RETRIES = 3;
const INCOMPLETE_RETRY_MS = 700;

/** Register semantic-token forwarding for embedded cells, tied to the extension lifetime. */
export function registerSemanticTokensProvider(
  context: vscode.ExtensionContext,
): void {
  const provider = new EmbeddedSemanticTokensProvider();
  context.subscriptions.push(
    provider,
    vscode.languages.registerDocumentSemanticTokensProvider(QMD, provider, LEGEND),
    // Our vdocs are real files in the user's workspace. Every embedded feature registers
    // this (the adapter's `disposeVdocs` is idempotent and keyed by the OWNING document),
    // so a closed `.qmd` takes its vdocs with it no matter which feature minted them.
    vscode.workspace.onDidCloseTextDocument((doc) => {
      provider.forget(doc.uri);
      void disposeVdocs(doc.uri);
    }),
  );
}

class EmbeddedSemanticTokensProvider
  implements vscode.DocumentSemanticTokensProvider, vscode.Disposable
{
  /** Fired when a pass came back incomplete — "ask me again, a server has since woken up". */
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeSemanticTokens: vscode.Event<void> = this.changed.event;

  /** `docUri` -> re-fetches already requested for an incomplete answer (capped). */
  private readonly retried = new Map<string, number>();
  /** Pending retry timers, so a closing document does not leave one armed. */
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  dispose(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    this.changed.dispose();
  }

  /** Drop a closed document's retry state (its vdocs are being disposed alongside). */
  forget(uri: vscode.Uri): void {
    const key = uri.toString();
    const timer = this.timers.get(key);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
    this.retried.delete(key);
  }

  async provideDocumentSemanticTokens(
    document: vscode.TextDocument,
  ): Promise<vscode.SemanticTokens | undefined> {
    const text = document.getText();

    // Cheap gate FIRST, and it is now the whole language selection too. VS Code re-requests
    // tokens for every visible `.qmd` on a debounced timer as the user types, so this runs
    // constantly — including for the many documents with no code cells at all.
    // `embeddedLanguagesIn` answers from the cell scan alone, while `buildVirtualContent`
    // rebuilds a full-length copy of the document per language (~29 ms per pass on a 4.4 MB
    // prose-only document, on the extension host's single thread).
    const targets = embeddedLanguagesIn(text);
    if (targets.length === 0) {
      return undefined;
    }

    // Concurrently, not sequentially. Each language has its OWN vdoc key, so the mints
    // cannot collide, and `features/embedded-vdoc.ts` is already proven under concurrent
    // forwards (the outline forwards every cell at once). Serializing here would make a
    // 3-language document three round-trips deep on a debounced timer for no benefit.
    const streams = await Promise.all(
      targets.map((target) => this.streamFor(document, text, target)),
    );

    // Each language degrades ON ITS OWN. This is not a nicety: the built-in TS/JS service's
    // LEGEND command returns `undefined` on the first pass while its TOKEN command already
    // answers (measured, Session 89), so on a mixed document's first debounced pass one
    // language routinely has no usable stream. An all-or-nothing merge would leave the
    // whole document uncoloured, intermittently, for reasons no user could reproduce.
    const usable = streams.filter((s): s is TokenStream => s !== undefined);

    // A language present in the document that gave us nothing is not necessarily a language
    // with no server — far more often it is a server that had not finished starting when we
    // asked (its very activation is what our `openTextDocument` triggered). VS Code will not
    // come back on its own, so ask it to.
    this.retryIfIncomplete(document, targets.length, usable.length);

    if (usable.length === 0) {
      return undefined; // nobody answered — TextMate colouring stands
    }

    return new vscode.SemanticTokens(mergeSemanticTokens(usable, OUR_LEGEND));
  }

  /**
   * Ask VS Code to re-fetch when some language present in the document produced no stream —
   * at most `INCOMPLETE_RETRIES` times, so a language with genuinely no server installed
   * settles on TextMate colouring instead of re-asking forever.
   */
  private retryIfIncomplete(
    document: vscode.TextDocument,
    wanted: number,
    got: number,
  ): void {
    const key = document.uri.toString();
    if (got >= wanted) {
      this.retried.delete(key); // every language answered — start fresh next time
      return;
    }
    const already = this.retried.get(key) ?? 0;
    if (already >= INCOMPLETE_RETRIES || this.timers.has(key)) {
      return;
    }
    this.retried.set(key, already + 1);
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        this.changed.fire();
      }, INCOMPLETE_RETRY_MS),
    );
  }

  /**
   * One language's answer, in ITS OWN legend — or `undefined` if it has none to give.
   *
   * Never throws, and never lets one language's failure reach another's: every exit here is
   * a value, so the merge simply proceeds with whatever streams did arrive.
   */
  private async streamFor(
    document: vscode.TextDocument,
    text: string,
    target: EmbeddedLang,
  ): Promise<TokenStream | undefined> {
    // This language's virtual document: its cell bodies kept verbatim, everything else —
    // prose, fences, and every OTHER language's cells — blanked to equal-length space runs.
    // That blanking is the identity mapping: the server's line/character coordinates are
    // already the `.qmd`'s, so no token needs a coordinate remap, and two languages'
    // streams necessarily cover disjoint lines.
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

    // The legend is per-SERVER and only knowable at runtime, so it must be fetched
    // alongside the tokens: the stream's type/modifier numbers are indices INTO it and are
    // meaningless without it. With N languages this is N legends, not one — `readonly` is
    // bit 7 for Pylance and bit 3 for the built-in JS service — which is exactly why the
    // stream is carried WITH its legend rather than decoded here.
    //
    // Both calls can REJECT, not merely resolve to `undefined` — a language server that
    // errors, is shutting down, or is mid-restart rejects the request. An unhandled
    // rejection would propagate out of `provideDocumentSemanticTokens` and break the
    // contract this whole feature rests on: the worst a failing server may ever do to a
    // `.qmd` is leave it with its TextMate colouring.
    let legend: vscode.SemanticTokensLegend | undefined;
    let tokens: vscode.SemanticTokens | undefined;
    try {
      [legend, tokens] = await Promise.all([
        vscode.commands.executeCommand<vscode.SemanticTokensLegend | undefined>(
          "vscode.provideDocumentSemanticTokensLegend",
          vdocUri,
        ),
        vscode.commands.executeCommand<vscode.SemanticTokens | undefined>(
          "vscode.provideDocumentSemanticTokens",
          vdocUri,
        ),
      ]);
    } catch {
      return undefined;
    }
    if (legend === undefined || tokens === undefined) {
      return undefined; // no server for this language, or it declined — TextMate stands
    }

    return { data: tokens.data, legend };
  }
}
