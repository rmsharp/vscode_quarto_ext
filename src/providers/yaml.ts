/**
 * YAML completion provider for `.qmd` — completes Quarto cell-option *keys* on a
 * `#|` / `//|` line inside an executable cell, and enum/boolean *values* after the
 * key's colon (plan §6 Phase 6d, Slices 6d-1/6d-2).
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
import type { SchemaField } from "../core/yaml-schema";
import { createSchemaSource, type SchemaSource } from "../features/yaml-schema-source";

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
      new YamlCompletionProvider(createSchemaSource()),
      ...TRIGGERS,
    ),
  );
}

/** Offer cell-option keys in a `#|` / `//|` key slot, and value enums after the colon. */
class YamlCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private readonly source: SchemaSource) {}

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.CompletionItem[] | undefined> {
    const text = document.getText();
    const ctx = completionContextAt(text, document.offsetAt(position));
    // Every position outside a cell-option key/value slot (front matter, prose,
    // code) yields no items — the inverse-gating contract.
    if (ctx === null) {
      return undefined;
    }
    // Insert replaces slot start→cursor; replace covers the whole slot token
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

    // The option set comes from the user's installed Quarto schema (6d-3),
    // filtered to the cell's engine; it falls back to the curated set when the
    // schema can't be read. Front-matter kinds are reserved for later slices.
    const fields = (await this.source.getIndex()).cellOptions(ctx.engine);
    if (ctx.kind === "cell-option-key") {
      return fields.map((field) => keyItem(field, range));
    }
    if (ctx.kind === "cell-option-value") {
      return valueItems(document, fields, ctx.parentPath, range);
    }
    return undefined;
  }
}

/** The value-enum items for the key being valued, or `undefined` if it has none. */
function valueItems(
  document: vscode.TextDocument,
  fields: SchemaField[],
  parentPath: string[],
  range: { inserting: vscode.Range; replacing: vscode.Range },
): vscode.CompletionItem[] | undefined {
  const key = parentPath[parentPath.length - 1];
  const field = fields.find((f) => f.name === key);
  if (field?.values === undefined || field.values.length === 0) {
    return undefined;
  }
  // If the value slot abuts the colon (no space yet), prepend one so accepting
  // yields valid `key: value` YAML rather than `key:value`.
  const lineText = document.lineAt(range.replacing.start.line).text;
  const needSpace = lineText[range.replacing.start.character - 1] === ":";
  return field.values.map((value) => valueItem(value, range, needSpace));
}

/** Translate one cell-option `SchemaField` into a key completion item. */
function keyItem(
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

/** Translate one curated value into a value completion item. */
function valueItem(
  value: string,
  range: { inserting: vscode.Range; replacing: vscode.Range },
  needSpace: boolean,
): vscode.CompletionItem {
  const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.Value);
  item.insertText = needSpace ? ` ${value}` : value;
  item.filterText = value;
  item.range = range;
  item.detail = "Quarto cell option value";
  return item;
}
