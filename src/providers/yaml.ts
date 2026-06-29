/**
 * YAML completion provider for `.qmd` — completes Quarto cell-option *keys* on a
 * `#|` / `//|` line inside an executable cell and enum/boolean *values* after the
 * key's colon (Slices 6d-1/6d-2), plus document *keys* (Slice 6d-4) and their
 * enum/boolean *values* (Slice 6d-5) at the top level of the YAML front matter.
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

    // The schema comes from the user's installed Quarto (6d-3), falling back to
    // the curated set when it can't be read. `ctx` is already non-null here, so
    // the inverse-gating contract is preserved before this await (Learning #27).
    const index = await this.source.getIndex();
    if (ctx.kind === "cell-option-key") {
      return index.cellOptions(ctx.engine).map((field) => keyItem(field, range));
    }
    if (ctx.kind === "cell-option-value") {
      return valueItems(
        document,
        index.cellOptions(ctx.engine),
        ctx.parentPath,
        range,
        "Quarto cell option value",
      );
    }
    if (ctx.kind === "frontmatter-key") {
      return index
        .frontMatterKeys(ctx.parentPath)
        .map((field) => frontMatterKeyItem(field, range));
    }
    if (ctx.kind === "frontmatter-value") {
      // `ctx.parentPath` is [container…, key]: the last element is the key being
      // valued and the prefix is its container path. Looking the key up in
      // `frontMatterKeys(parentPath.slice(0,-1))` resolves both a top-level value
      // (path [key] → `frontMatterKeys([])`) and a nested one (path ["execute",
      // key] → the curated execute children — 6d-6 continuation).
      return valueItems(
        document,
        index.frontMatterKeys(ctx.parentPath.slice(0, -1)),
        ctx.parentPath,
        range,
        "Quarto document option value",
      );
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
  detail: string,
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
  return field.values.map((value) => valueItem(value, range, needSpace, detail));
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

/** Translate one front-matter `SchemaField` into a top-level document-key item. */
function frontMatterKeyItem(
  field: SchemaField,
  range: { inserting: vscode.Range; replacing: vscode.Range },
): vscode.CompletionItem {
  const item = new vscode.CompletionItem(
    field.name,
    vscode.CompletionItemKind.Property,
  );
  item.insertText = field.name;
  item.filterText = field.name;
  item.range = range;
  item.detail = "Quarto document option";
  if (field.description) {
    item.documentation = new vscode.MarkdownString(field.description);
  }
  return item;
}

/** Translate one schema value into a value completion item (cell or document). */
function valueItem(
  value: string,
  range: { inserting: vscode.Range; replacing: vscode.Range },
  needSpace: boolean,
  detail: string,
): vscode.CompletionItem {
  const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.Value);
  item.insertText = needSpace ? ` ${value}` : value;
  item.filterText = value;
  item.range = range;
  item.detail = detail;
  return item;
}
