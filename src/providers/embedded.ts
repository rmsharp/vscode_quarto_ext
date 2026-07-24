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
 * blanking are the pure core (`core/embedded/virtual-doc`); the vdoc's lifecycle on
 * disk belongs to `features/embedded-vdoc.ts`; this module is what remains — the
 * `executeCommand` forwards, the definition-URI remap, and the out-of-cell
 * secondary-edit filter.
 *
 * **The vdoc is a real `file:` document, and that is load-bearing** (CHANGELOG: embedded-language forwarding did not reach real language servers, Session 87).
 * These four forwards previously routed through a `TextDocumentContentProvider` on a
 * custom `quarto-embedded:` scheme, and every one of them was dead in production:
 * real language servers register their providers against a `documentSelector` scoped
 * to the schemes they can read, so no provider was ever registered for those vdocs and
 * each `executeXxxProvider` returned nothing — no error, no warning. Measured against
 * real Pylance on identical content: 306 completions on a `file:` URI, 0 on ours. Do
 * not reintroduce a custom scheme here; it will silently break all four features again,
 * and the stand-in tests will not tell you (see `assertRoutedThroughVdoc`).
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
import type { EmbeddedHit } from "../core/embedded/virtual-doc";
import {
  buildVirtualContent,
  embeddedCellAt,
} from "../core/embedded/virtual-doc";
import { disposeVdocs, ensureVdoc } from "../features/embedded-vdoc";

const QMD: vscode.DocumentSelector = { language: "quarto" };

/**
 * Completion trigger characters — the union of the embedded languages' triggers
 * (python: `.`). Passed as registration args (not a `package.json` contribution —
 * yaml.ts:43 / R8). The region gate suppresses any spurious invocation.
 */
const TRIGGERS = ["."];

/**
 * Signature-help trigger characters (`(` / `,`) — distinct from completion's `.`
 * (plan §6 Slice 6e-5). Passed as registration args; the region gate suppresses any
 * spurious invocation.
 */
const SIG_TRIGGERS = ["(", ","];

/** Register the embedded-cell completion forwarding feature, tied to the extension lifetime. */
export function registerEmbeddedLanguageFeature(
  context: vscode.ExtensionContext,
): void {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      QMD,
      new EmbeddedCompletionProvider(),
      ...TRIGGERS,
    ),
    vscode.languages.registerHoverProvider(QMD, new EmbeddedHoverProvider()),
    vscode.languages.registerDefinitionProvider(
      QMD,
      new EmbeddedDefinitionProvider(),
    ),
    vscode.languages.registerSignatureHelpProvider(
      QMD,
      new EmbeddedSignatureHelpProvider(),
      ...SIG_TRIGGERS,
    ),
    // Vdocs are real files in the user's workspace, so a closed document must take
    // its own with it — this is a disk cleanup now, not just a Map eviction.
    vscode.workspace.onDidCloseTextDocument((doc) => void disposeVdocs(doc.uri)),
  );
}

/**
 * The virtual document for the language under the cursor: every cell of that language,
 * with everything else blanked to equal-length space runs so positions and ranges pass
 * through unchanged (the identity mapping — `buildVirtualContent`).
 *
 * Returns `undefined` when no vdoc could be written, in which case the caller simply
 * does not forward. That is the same graceful degradation as "no language extension
 * installed": the cell keeps its TextMate colouring and everything else keeps working.
 */
async function vdocFor(
  document: vscode.TextDocument,
  text: string,
  hit: EmbeddedHit,
): Promise<vscode.Uri | undefined> {
  return ensureVdoc(
    document,
    {
      docUri: document.uri.toString(),
      languageId: hit.languageId,
      ext: hit.ext,
      kind: "lang",
    },
    buildVirtualContent(text, hit.languageId),
  );
}

/** Forward completion inside a mapped-language cell body to that language's providers. */
class EmbeddedCompletionProvider implements vscode.CompletionItemProvider {
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
    const vdocUri = await vdocFor(document, text, hit);
    if (vdocUri === undefined) {
      return undefined;
    }
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
  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Hover | undefined> {
    const text = document.getText();
    const hit = embeddedCellAt(text, position.line);
    if (hit === null) {
      return undefined;
    }
    const vdocUri = await vdocFor(document, text, hit);
    if (vdocUri === undefined) {
      return undefined;
    }
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
 * Forward a go-to-definition request inside a mapped-language cell body to that
 * language's providers (plan §6 Slice 6e-4). Reuses the same gate, virtual document,
 * and scheme as completion/hover. `executeDefinitionProvider` returns
 * `(Location | LocationLink)[]` whose ranges are identity-mapped (valid `.qmd`
 * coordinates) but whose URI is the **virtual document's** — the ONE residual remap:
 * `remapDefinitions` swaps a vdoc-URI target back to the source `.qmd` (the range is
 * unchanged). A definition into another file (a library source) is passed through.
 * Off-region yields `undefined`, the same inverse-gating contract as completion/hover,
 * enforced BEFORE any `await` (Learning #27).
 */
class EmbeddedDefinitionProvider implements vscode.DefinitionProvider {
  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Definition | vscode.LocationLink[] | undefined> {
    const text = document.getText();
    const hit = embeddedCellAt(text, position.line);
    if (hit === null) {
      return undefined;
    }
    const vdocUri = await vdocFor(document, text, hit);
    if (vdocUri === undefined) {
      return undefined;
    }
    const results = await vscode.commands.executeCommand<
      (vscode.Location | vscode.LocationLink)[]
    >("vscode.executeDefinitionProvider", vdocUri, position);
    // VS Code resolves each element of a definition array independently at runtime
    // (this is the exact heterogeneous shape `executeDefinitionProvider` itself
    // returns), so the cast only appeases the declared union — it changes nothing.
    return remapDefinitions(results, vdocUri, document.uri) as
      | vscode.Location[]
      | vscode.LocationLink[]
      | undefined;
  }
}

/**
 * The one residual remap (plan §2.3 / §6 6e-4): swap any definition `Location` /
 * `LocationLink` whose target URI is the virtual document back to the source `.qmd`
 * URI — the range is identity-mapped, so ONLY the URI changes. A target that points
 * at any OTHER URI (e.g. a library source file) is passed through unchanged. Returns
 * `undefined` when nothing forwarded (graceful no-op, never throws).
 */
function remapDefinitions(
  results: (vscode.Location | vscode.LocationLink)[] | undefined,
  vdocUri: vscode.Uri,
  sourceUri: vscode.Uri,
): (vscode.Location | vscode.LocationLink)[] | undefined {
  if (results === undefined || results.length === 0) {
    return undefined;
  }
  const vdocKey = vdocUri.toString();
  return results.map((r) => remapDefinition(r, vdocKey, sourceUri));
}

/** Swap a single result's vdoc URI back to `sourceUri` (range unchanged); else pass through. */
function remapDefinition(
  result: vscode.Location | vscode.LocationLink,
  vdocKey: string,
  sourceUri: vscode.Uri,
): vscode.Location | vscode.LocationLink {
  if (isLocationLink(result)) {
    if (result.targetUri.toString() !== vdocKey) {
      return result;
    }
    return { ...result, targetUri: sourceUri };
  }
  if (result.uri.toString() !== vdocKey) {
    return result;
  }
  return new vscode.Location(sourceUri, result.range);
}

/** Distinguish a `LocationLink` (has `targetUri`) from a `Location` (has `uri`). */
function isLocationLink(
  result: vscode.Location | vscode.LocationLink,
): result is vscode.LocationLink {
  return (result as vscode.LocationLink).targetUri !== undefined;
}

/**
 * Forward a signature-help request inside a mapped-language cell body to that
 * language's providers (plan §6 Slice 6e-5 — the last 6e slice). Reuses the same
 * gate, virtual document, and scheme as completion/hover/definition.
 * `executeSignatureHelpProvider` returns a SINGLE `SignatureHelp` whose parameter
 * ranges are offsets within the signature label (not document coordinates) and which
 * carries NO URI and NO edits — so the result is returned UNCHANGED: no remap (unlike
 * 6e-4 definition, whose `Location` carries the vdoc URI) and no merge (unlike 6e-3
 * hover, which collapses a `Hover[]`; signature help yields one result). Off-region
 * (prose, YAML, fence, `#|` line, unmapped cell) yields `undefined`, the same
 * inverse-gating contract, enforced BEFORE any `await` (Learning #27).
 */
class EmbeddedSignatureHelpProvider implements vscode.SignatureHelpProvider {
  async provideSignatureHelp(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    context: vscode.SignatureHelpContext,
  ): Promise<vscode.SignatureHelp | undefined> {
    const text = document.getText();
    const hit = embeddedCellAt(text, position.line);
    if (hit === null) {
      return undefined;
    }
    const vdocUri = await vdocFor(document, text, hit);
    if (vdocUri === undefined) {
      return undefined;
    }
    // Identity mapping (plan §2.3): the position passes straight through, and the
    // single SignatureHelp (no URI, no edits) is returned unchanged.
    return vscode.commands.executeCommand<vscode.SignatureHelp>(
      "vscode.executeSignatureHelpProvider",
      vdocUri,
      position,
      context.triggerCharacter,
    );
  }
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
