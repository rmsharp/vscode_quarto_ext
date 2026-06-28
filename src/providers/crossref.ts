/**
 * Cross-reference providers for `.qmd` — completion on `@` and go-to-definition
 * (plan §6 Phase 6b).
 *
 * Thin `vscode` adapters (plan §3.3): all parsing and indexing lives in the pure
 * `core/refs` module; these classes only translate between `vscode` positions/
 * ranges and the core `RefLabel` model. Registering a provider needs no
 * `package.json` contribution, so activation is unchanged (the extension already
 * activates `onLanguage:quarto`).
 */

import * as vscode from "vscode";
import {
  crossrefCompletionContext,
  findLabel,
  indexLabels,
  type RefLabel,
  refIdAt,
} from "../core/refs";

const QMD: vscode.DocumentSelector = { language: "quarto" };

/** Register the cross-ref completion + definition providers, tied to the extension lifetime. */
export function registerCrossrefProviders(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      QMD,
      new CrossrefCompletionProvider(),
      "@",
    ),
    vscode.languages.registerDefinitionProvider(
      QMD,
      new CrossrefDefinitionProvider(),
    ),
  );
}

/** Offer every defined cross-ref label when the cursor is in a `@…` context. */
class CrossrefCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.CompletionItem[] | undefined {
    const lineText = document.lineAt(position.line).text;
    const context = crossrefCompletionContext(lineText, position.character);
    if (context === null) {
      return undefined;
    }
    // Replace from the `@` to the cursor so the inserted `@id` doesn't duplicate it.
    const range = new vscode.Range(
      position.line,
      context.start,
      position.line,
      position.character,
    );
    return indexLabels(document.getText()).map((label) =>
      toCompletionItem(label, range),
    );
  }
}

/** Translate one core `RefLabel` into a `vscode.CompletionItem`. */
function toCompletionItem(
  label: RefLabel,
  range: vscode.Range,
): vscode.CompletionItem {
  const insert = `@${label.id}`;
  const item = new vscode.CompletionItem(
    insert,
    vscode.CompletionItemKind.Reference,
  );
  item.insertText = insert;
  item.filterText = insert;
  item.range = range;
  item.detail = `Quarto ${label.kind} cross-reference`;
  item.documentation = new vscode.MarkdownString(
    `Defined on line ${label.line + 1}.`,
  );
  return item;
}

/** Resolve a `@ref` under the cursor to the line/column where its label is defined. */
class CrossrefDefinitionProvider implements vscode.DefinitionProvider {
  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Location | undefined {
    const lineText = document.lineAt(position.line).text;
    const id = refIdAt(lineText, position.character);
    if (id === null) {
      return undefined;
    }
    const label = findLabel(document.getText(), id);
    if (label === null) {
      return undefined;
    }
    return new vscode.Location(
      document.uri,
      new vscode.Position(label.line, label.column),
    );
  }
}
