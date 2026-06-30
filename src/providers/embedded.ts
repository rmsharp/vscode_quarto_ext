/**
 * Embedded-cell language completion (Phase 6e Slice 6e-1). Forwards completion
 * requests inside an executable code cell to the user's already-installed
 * language extension (Python for `{python}`), via a per-language **virtual
 * document** + `vscode.executeCompletionItemProvider` — the MIT VS Code
 * "request forwarding" technique (plan §2). No code is copied and no dependency
 * is bundled: this is the same trust/licensing posture as Phase 5 run-cell
 * delegation (Learning #13 / #1).
 *
 * Thin `vscode` adapter (plan §3.3): the position gate and the virtual-document
 * blanking are the pure core (`core/embedded/virtual-doc`); this module is the
 * impure plumbing — the content provider, the URI/Map bookkeeping, the
 * `executeCommand` forward, and the out-of-cell secondary-edit filter.
 *
 * Gating is the disjoint complement of the YAML (`#|` lines + front matter) and
 * `@` (prose) providers on the shared `{language:"quarto"}` selector (plan §4.3,
 * the recurring Learning #15b cross-pollination trap): `embeddedCellAt` returns a
 * hit ONLY inside a mapped-language cell BODY, so this provider yields nothing
 * elsewhere. The gate runs BEFORE any `await` (Learning #27), and the virtual
 * doc's languageId is never `quarto`, so the forward cannot re-enter this
 * provider (no infinite loop — plan §2.4).
 */

import * as vscode from "vscode";
import { needsLanguageExtension } from "../core/embedded/lang-map";
import {
  buildVirtualContent,
  embeddedCellAt,
} from "../core/embedded/virtual-doc";

const QMD: vscode.DocumentSelector = { language: "quarto" };

/** The URI scheme our per-language virtual documents live under (plan §5/§9 Q1). */
const SCHEME = "quarto-embedded";

/**
 * Completion trigger characters — the union of the embedded languages' triggers
 * (python: `.`). Passed as registration args (not a `package.json` contribution —
 * yaml.ts:43 / R8). The region gate suppresses any spurious invocation.
 */
const TRIGGERS = ["."];

/** Register the embedded-cell completion forwarding feature, tied to the extension lifetime. */
export function registerEmbeddedLanguageFeature(
  context: vscode.ExtensionContext,
): void {
  const store = new VirtualDocStore();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(SCHEME, store),
    vscode.languages.registerCompletionItemProvider(
      QMD,
      new EmbeddedCompletionProvider(store),
      ...TRIGGERS,
    ),
    vscode.languages.registerHoverProvider(QMD, new EmbeddedHoverProvider(store)),
    // The virtual-doc Map must not grow unbounded: drop a document's vdocs when
    // it closes (plan §7).
    vscode.workspace.onDidCloseTextDocument((doc) => store.evict(doc.uri)),
  );
}

/**
 * Holds the per-(document, language) virtual-document contents and serves them to
 * VS Code as a `TextDocumentContentProvider`. Stored and looked up by the canonical
 * vdoc URI string (`uri.toString()`), which is symmetric by VS Code's
 * document-identity contract — no manual `path` decode (the sample's hardcoded
 * `-4` parse does not generalize to `.py`/`.r`/`.jl`/`.js`, plan §2.4). An
 * `owners` index maps each source document to its vdoc keys for eviction.
 */
class VirtualDocStore implements vscode.TextDocumentContentProvider {
  private readonly contents = new Map<string, string>();
  private readonly owners = new Map<string, Set<string>>();

  provideTextDocumentContent(uri: vscode.Uri): string | undefined {
    return this.contents.get(uri.toString());
  }

  /** Store `content` as the `ext` virtual doc for `docUri` and return its vdoc URI. */
  set(
    docUri: vscode.Uri,
    ext: string,
    languageId: string,
    content: string,
  ): vscode.Uri {
    // The trailing `.ext` is what makes VS Code resolve the vdoc's languageId
    // (plan §2.4); the encoded original URI keeps vdocs per-document distinct.
    const vdocUri = vscode.Uri.from({
      scheme: SCHEME,
      authority: languageId,
      path: `/${encodeURIComponent(docUri.toString(true))}.${ext}`,
    });
    const key = vdocUri.toString();
    this.contents.set(key, content); // rebuild-per-request (edit-sync, plan §2.4)
    const owner = docUri.toString();
    const keys = this.owners.get(owner) ?? new Set<string>();
    keys.add(key);
    this.owners.set(owner, keys);
    return vdocUri;
  }

  /** Drop every virtual doc owned by `docUri` (called when the document closes). */
  evict(docUri: vscode.Uri): void {
    const owner = docUri.toString();
    const keys = this.owners.get(owner);
    if (keys === undefined) {
      return;
    }
    for (const key of keys) {
      this.contents.delete(key);
    }
    this.owners.delete(owner);
  }
}

/** Forward completion inside a mapped-language cell body to that language's providers. */
class EmbeddedCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private readonly store: VirtualDocStore) {}

  /**
   * languageIds we have already evaluated for the degradation hint this session —
   * so the "install the … extension" nudge shows at most once per language and
   * never nags (plan §2.5 / §9 Q6).
   */
  private readonly hintEvaluated = new Set<string>();

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): Promise<vscode.CompletionList | undefined> {
    const text = document.getText();
    const hit = embeddedCellAt(text, position.line);
    // Off-region (prose, YAML, fence, `#|` line, unmapped cell): no items. This
    // is the inverse-gating contract, enforced BEFORE any await (Learning #27).
    if (hit === null) {
      return undefined;
    }
    // Graceful degradation (§2.5): if no extension is registered for this cell's
    // language, the forward below will quietly yield nothing — nudge the user once,
    // non-blocking. Fire-and-forget so it never delays (or blocks) completion.
    this.maybeHintMissingExtension(hit.languageId);
    const content = buildVirtualContent(text, hit.languageId);
    const vdocUri = this.store.set(document.uri, hit.ext, hit.languageId, content);
    // Identity mapping (plan §2.3): the position passes straight through, and the
    // returned primary insertion needs no remap.
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      vdocUri,
      position,
      context.triggerCharacter,
    );
    return filterOutOfCellEdits(list, text, hit.languageId);
  }

  /**
   * Show a one-time, non-blocking hint when the cell's target language has no
   * registered extension (so in-cell completion can't work). Keyed on the host's
   * registered-language set (`getLanguages()`), NEVER on an empty completion
   * result — an installed extension legitimately returns nothing mid-token, so
   * keying on emptiness would nag (§9 Q6). The languageId is claimed in
   * `hintEvaluated` synchronously, so concurrent completions check at most once,
   * and `javascript`/`python` (built-in) never trip it. Never throws.
   */
  private maybeHintMissingExtension(languageId: string): void {
    if (this.hintEvaluated.has(languageId)) {
      return;
    }
    this.hintEvaluated.add(languageId);
    void vscode.languages.getLanguages().then((registered) => {
      if (needsLanguageExtension(languageId, registered)) {
        void vscode.window.showInformationMessage(
          `Quarto: no "${languageId}" language extension is installed — in-cell ` +
            `completion for those code cells is unavailable until you add one.`,
        );
      }
    });
  }
}

/**
 * Forward a hover request inside a mapped-language cell body to that language's
 * providers (plan §6 Slice 6e-3). Reuses the same gate, virtual document, and
 * scheme as completion; `executeHoverProvider` returns hovers whose ranges are
 * identity-mapped (valid `.qmd` coordinates) and carry no URI, so the result is
 * returned UNCHANGED — no remap. Off-region (prose, YAML, fence, `#|` line,
 * unmapped cell) yields `undefined`, the same inverse-gating contract as
 * completion, enforced BEFORE any `await` (Learning #27).
 */
class EmbeddedHoverProvider implements vscode.HoverProvider {
  constructor(private readonly store: VirtualDocStore) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Hover | undefined> {
    const text = document.getText();
    const hit = embeddedCellAt(text, position.line);
    if (hit === null) {
      return undefined;
    }
    const content = buildVirtualContent(text, hit.languageId);
    const vdocUri = this.store.set(document.uri, hit.ext, hit.languageId, content);
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      "vscode.executeHoverProvider",
      vdocUri,
      position,
    );
    return mergeHovers(hovers);
  }
}

/**
 * Collapse the forwarded provider(s)' hovers into the single `Hover` VS Code
 * expects from one provider, preserving every content block and the (identity-
 * mapped, un-remapped) range. Returns `undefined` when nothing forwarded — a
 * clean no-op (graceful degradation, plan §2.5; never throws).
 */
function mergeHovers(
  hovers: vscode.Hover[] | undefined,
): vscode.Hover | undefined {
  if (hovers === undefined || hovers.length === 0) {
    return undefined;
  }
  const contents = hovers.flatMap((h) => h.contents);
  const range = hovers.find((h) => h.range !== undefined)?.range;
  return new vscode.Hover(contents, range);
}

/**
 * Identity-map passthrough for the PRIMARY insertion, but strip any **secondary**
 * edit (`additionalTextEdits` — e.g. an auto-import the language server anchored
 * at the virtual doc's module top) whose range is not inside a same-language cell
 * body. Under whole-document blanking the module top identity-maps to a *valid*
 * `.qmd` offset that lies OUTSIDE the cell — the YAML front matter — so accepting
 * the completion would write `import …` into the front matter (plan §2.3 caveat,
 * §7 High row). The guard is **region membership, not coordinate validity**.
 */
function filterOutOfCellEdits(
  list: vscode.CompletionList | undefined,
  text: string,
  languageId: string,
): vscode.CompletionList | undefined {
  if (list === undefined) {
    return undefined;
  }
  for (const item of list.items) {
    const edits = item.additionalTextEdits;
    if (edits !== undefined && edits.length > 0) {
      const kept = edits.filter((e) => rangeInSameLangBody(text, e.range, languageId));
      item.additionalTextEdits = kept.length > 0 ? kept : undefined;
    }
  }
  return new vscode.CompletionList(list.items, list.isIncomplete);
}

/** Whether every line of `range` is an interior body line of a `languageId` cell. */
function rangeInSameLangBody(
  text: string,
  range: vscode.Range,
  languageId: string,
): boolean {
  for (let line = range.start.line; line <= range.end.line; line++) {
    const hit = embeddedCellAt(text, line);
    if (hit === null || hit.languageId !== languageId) {
      return false;
    }
  }
  return true;
}
