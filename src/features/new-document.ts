/**
 * `Quarto: New Quarto Document` and the item-17c create-document-family
 * discoverability presets (plan
 * `docs/planning/2026-07-09-onboarding-walkthrough-plan.md` §2 Track A).
 *
 * Thin `vscode` adapter: prompt for an optional title, build the content via
 * the pure `core/new-document.ts` `buildNewDocumentContent`, and open it as
 * an untitled, unsaved buffer — no disk write, no CLI shell-out (Finding 1:
 * `quarto create document` does not exist as a CLI feature).
 *
 * Three commands share one code path, differing only in prompt label and
 * preset format (item 17c — Posit ships each as its own command for
 * command-palette / File▸New discoverability over the one underlying
 * capability):
 *   - `quarto.newDocument`      — plain document, `format: html`
 *   - `quarto.fileNewDocument`  — identical to `newDocument`; contributed to
 *                                 the File▸New File… menu (`file/newFile`)
 *   - `quarto.newPresentation`  — presentation preset, `format: revealjs`
 */

import * as vscode from "vscode";
import {
  buildNewDocumentContent,
  NewDocumentFormat,
} from "../core/new-document";

export function registerNewDocumentFeature(
  context: vscode.ExtensionContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("quarto.newDocument", () =>
      newQuartoBuffer("Document title", "html"),
    ),
    vscode.commands.registerCommand("quarto.fileNewDocument", () =>
      newQuartoBuffer("Document title", "html"),
    ),
    vscode.commands.registerCommand("quarto.newPresentation", () =>
      newQuartoBuffer("Presentation title", "revealjs"),
    ),
  );
}

/**
 * A cancelled (`undefined`) or empty/whitespace prompt is treated identically
 * — proceed with `buildNewDocumentContent`'s own "Untitled" fallback, never
 * abort (there is nothing destructive to cancel out of).
 */
async function newQuartoBuffer(
  promptLabel: string,
  format: NewDocumentFormat,
): Promise<void> {
  const answer = await vscode.window.showInputBox({
    prompt: promptLabel,
    placeHolder: "Untitled",
  });
  const content = buildNewDocumentContent(answer ?? "", format);
  const doc = await vscode.workspace.openTextDocument({
    content,
    language: "quarto",
  });
  await vscode.window.showTextDocument(doc);
}
