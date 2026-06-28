/**
 * Formatting-toggle commands (plan §6 Phase 7 authoring aids).
 *
 * `Quarto: Toggle Bold` / `Toggle Italic` / `Toggle Code` wrap or unwrap the
 * current selection — or the word at a bare cursor — in the markdown emphasis
 * markers `**` / `*` / `` ` ``. This is a thin `vscode` adapter: all of the
 * wrap/unwrap/disambiguation logic lives in the pure, headlessly-tested
 * `core/format-toggle` (§3.3 guardrail). The adapter only translates between
 * `vscode` positions and the core's character offsets, applies the edit, and
 * restores the selection.
 *
 * Commands are gated to Quarto documents (the keybindings are likewise scoped
 * with `editorLangId == quarto`), so invoking one elsewhere is a harmless no-op.
 * Only the primary selection is toggled; multi-cursor support is a future slice.
 *
 * Verified by `@vscode/test-electron`
 * (test/integration/suite/formatting.test.ts), which drives the real editor —
 * no Quarto CLI or kernel needed — pinning the offset mapping end to end.
 */

import * as vscode from "vscode";
import { toggleFormat } from "../core/format-toggle";

const BOLD = "**";
const ITALIC = "*";
const CODE = "`";

export function registerFormattingFeature(
  context: vscode.ExtensionContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("quarto.toggleBold", () => toggle(BOLD)),
    vscode.commands.registerCommand("quarto.toggleItalic", () =>
      toggle(ITALIC),
    ),
    vscode.commands.registerCommand("quarto.toggleCode", () => toggle(CODE)),
  );
}

async function toggle(marker: string): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "quarto") {
    return; // only act on Quarto documents (keybindings are already so scoped)
  }
  const doc = editor.document;
  const sel = editor.selection;
  const edit = toggleFormat(
    doc.getText(),
    doc.offsetAt(sel.start),
    doc.offsetAt(sel.end),
    marker,
  );
  const range = new vscode.Range(
    doc.positionAt(edit.start),
    doc.positionAt(edit.end),
  );
  const ok = await editor.edit((b) => b.replace(range, edit.replacement));
  if (ok) {
    // `doc` is live: after the edit it holds the post-edit text, so the core's
    // post-edit offsets map straight back to positions.
    editor.selection = new vscode.Selection(
      doc.positionAt(edit.selectionStart),
      doc.positionAt(edit.selectionEnd),
    );
  }
}
