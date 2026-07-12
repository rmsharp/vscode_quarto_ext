/**
 * `DocumentLinkProvider` for `_quarto.yml`/`_quarto.yaml` (item 14 plan §5.2).
 *
 * Makes every file-path value in a project config file Cmd/Ctrl-clickable — but
 * ONLY when the value actually resolves to a real file or directory on disk,
 * relative to the config file's own directory. Existence-gating is the entire
 * safety mechanism (plan §2.1): a value that looks like a path but resolves to
 * nothing gets no link, so there is never a broken/wrong link. No schema query
 * of any kind — a value is linked purely by disk existence (plan §0/§2.2).
 *
 * Thin `vscode` adapter (plan §3.3): the whole-document candidate scan lives in
 * the pure core (`core/project-links`); this class only resolves each candidate
 * against the filesystem and translates spans into `vscode.DocumentLink`s.
 *
 * Registered with a pattern-based `DocumentSelector` (plan §2.3) — VS Code itself
 * routes `provideDocumentLinks` only for matching documents, so unlike the
 * `_quarto.yml` diagnostics feature (which cannot, because `DiagnosticCollection`
 * is not a language-feature provider) this needs no `onDid*TextDocument` events,
 * debounce, or generation counter.
 */

import * as path from "node:path";
import * as vscode from "vscode";
import { findPathValueCandidates } from "../core/project-links";

/** Every `_quarto.yml`/`_quarto.yaml`, anywhere in the workspace, by path glob. */
const SELECTOR: vscode.DocumentSelector = { pattern: "**/_quarto.{yml,yaml}" };

/** Register the `_quarto.yml` document-link provider, tied to the extension lifetime. */
export function registerQuartoYamlDocumentLinksFeature(
  context: vscode.ExtensionContext,
): void {
  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider(
      SELECTOR,
      new QuartoYamlDocumentLinkProvider(),
    ),
  );
}

/** Link each existence-checked file-path value in a `_quarto.yml` to its target. */
class QuartoYamlDocumentLinkProvider implements vscode.DocumentLinkProvider {
  async provideDocumentLinks(
    document: vscode.TextDocument,
  ): Promise<vscode.DocumentLink[]> {
    const baseDir = path.dirname(document.fileName);
    // Skip glob-looking candidates up front (a `*` never resolves to one real
    // path — mirrors typescript-language-features' tsconfig link provider, §5.2).
    const candidates = findPathValueCandidates(document.getText()).filter(
      (c) => !c.token.includes("*"),
    );
    // `stat` every candidate in parallel; one bad candidate must never abort the
    // rest (plan §5.2), so use allSettled and keep only the ones that resolve.
    const settled = await Promise.allSettled(
      candidates.map(async (c) => {
        const target = vscode.Uri.file(path.resolve(baseDir, c.token));
        await vscode.workspace.fs.stat(target); // rejects if it doesn't exist
        return { c, target };
      }),
    );

    const links: vscode.DocumentLink[] = [];
    for (const result of settled) {
      if (result.status === "fulfilled") {
        const { c, target } = result.value;
        const range = new vscode.Range(
          c.line,
          c.valueRange.startCol,
          c.line,
          c.valueRange.endCol,
        );
        links.push(new vscode.DocumentLink(range, target));
      }
    }
    return links;
  }
}
