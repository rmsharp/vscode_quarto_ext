/**
 * `Quarto: New Quarto Document` (plan
 * `docs/planning/2026-07-09-onboarding-walkthrough-plan.md` §2 Track A).
 *
 * Thin `vscode` adapter: prompt for an optional title, build the content via
 * the pure `core/new-document.ts` `buildNewDocumentContent`, and open it as
 * an untitled, unsaved buffer — no disk write, no CLI shell-out (Finding 1:
 * `quarto create document` does not exist as a CLI feature).
 */

import * as vscode from "vscode";
import { buildNewDocumentContent } from "../core/new-document";

export function registerNewDocumentFeature(
  context: vscode.ExtensionContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("quarto.newDocument", newDocument),
  );
}

/**
 * A cancelled (`undefined`) or empty/whitespace prompt is treated identically
 * — proceed with `buildNewDocumentContent`'s own "Untitled" fallback, never
 * abort (there is nothing destructive to cancel out of).
 */
async function newDocument(): Promise<void> {
  const answer = await vscode.window.showInputBox({
    prompt: "Document title",
    placeHolder: "Untitled",
  });
  const content = buildNewDocumentContent(answer ?? "");
  const doc = await vscode.workspace.openTextDocument({
    content,
    language: "quarto",
  });
  await vscode.window.showTextDocument(doc);
}
