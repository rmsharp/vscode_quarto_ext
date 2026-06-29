/**
 * YAML completion provider for `.qmd` — completes Quarto cell-option *keys* on a
 * `#|` / `//|` line inside an executable cell (plan §6 Phase 6d, Slice 6d-1).
 *
 * Thin `vscode` adapter (plan §3.3): all position logic lives in the pure core
 * (`core/yaml-context`), the option data in `core/yaml-schema`. This class only
 * translates between `vscode` positions/ranges and the core model.
 *
 * Provider gating is the INVERSE of the `@` cross-ref/citation providers (plan
 * §4.3): those gate to prose (`isReferenceableLine`); this one fires ONLY where
 * `completionContextAt` reports a YAML position and returns `undefined` everywhere
 * else, so the three providers share the `{language:"quarto"}` selector without
 * cross-polluting (embedded TextMate scopes don't reroute providers — Learning
 * #15b). Registering a provider needs no `package.json` contribution, so
 * activation is unchanged (the extension already activates `onLanguage:quarto`).
 */

import * as vscode from "vscode";
import { completionContextAt } from "../core/yaml-context";
import { CURATED_CELL_OPTIONS, type SchemaField } from "../core/yaml-schema";

const QMD: vscode.DocumentSelector = { language: "quarto" };

/**
 * Trigger characters: `|` opens the list as the user types `#|`/`//|`; `:` and
 * `-` keep it live while typing hyphenated keys (`fig-cap`) and into value
 * positions handled by later slices. The region gate suppresses spurious pops
 * (e.g. a prose `Note:` line).
 */
const TRIGGERS = ["|", ":", "-"];

/** Register the YAML cell-option completion provider, tied to the extension lifetime. */
export function registerYamlCompletionProvider(
  context: vscode.ExtensionContext,
): void {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      QMD,
      new YamlCompletionProvider(),
      ...TRIGGERS,
    ),
  );
}

/** Offer cell-option keys when the cursor is in a `#|` / `//|` key slot. */
class YamlCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.CompletionItem[] | undefined {
    const text = document.getText();
    const ctx = completionContextAt(text, document.offsetAt(position));
    // Slice 6d-1 handles only cell-option keys; every other position (value,
    // front matter, prose, code) yields no items — the inverse-gating contract.
    if (ctx === null || ctx.kind !== "cell-option-key") {
      return undefined;
    }
    // Insert replaces the key start→cursor; replace covers the whole key token
    // (through endCol) so accepting mid-token does not duplicate the suffix.
    const line = ctx.replaceRange.line;
    const range = {
      inserting: new vscode.Range(
        line,
        ctx.replaceRange.startCol,
        position.line,
        position.character,
      ),
      replacing: new vscode.Range(
        line,
        ctx.replaceRange.startCol,
        line,
        ctx.replaceRange.endCol,
      ),
    };
    return CURATED_CELL_OPTIONS.map((field) => toCompletionItem(field, range));
  }
}

/** Translate one core `SchemaField` into a `vscode.CompletionItem`. */
function toCompletionItem(
  field: SchemaField,
  range: { inserting: vscode.Range; replacing: vscode.Range },
): vscode.CompletionItem {
  const item = new vscode.CompletionItem(
    field.name,
    vscode.CompletionItemKind.Field,
  );
  item.insertText = field.name;
  item.filterText = field.name;
  item.range = range;
  item.detail = "Quarto cell option";
  if (field.description) {
    item.documentation = new vscode.MarkdownString(field.description);
  }
  return item;
}
