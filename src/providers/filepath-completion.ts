/**
 * Filepath `CompletionItemProvider` for `_quarto.yml`/`_quarto.yaml` (item 14
 * plan §5.3, Slice 2).
 *
 * When the cursor sits in a value position (after `key:`, a `- ` sequence marker,
 * or a `- key:` inline mapping), this offers the real files and subdirectories of
 * the directory the value-so-far points at, resolved relative to the config file's
 * own directory. No schema query of any kind — the offered items are exactly what
 * lives on disk (plan §0/§2.1), the same existence-grounded discipline the sibling
 * `DocumentLinkProvider` uses.
 *
 * Thin `vscode` adapter (plan §3.3): the cursor-position value-slot detection lives
 * in the pure core (`core/project-links`'s `valueContextAt`); this class only lists
 * a directory and maps its entries to completion items.
 *
 * Registered with the same pattern-based `DocumentSelector` as the link provider
 * (plan §2.3) — VS Code routes `provideCompletionItems` only for matching files,
 * so no `onDid*TextDocument` events or debounce are needed.
 */

import * as path from "node:path";
import * as vscode from "vscode";
import { valueContextAt } from "../core/project-links";

/** Every `_quarto.yml`/`_quarto.yaml`, anywhere in the workspace, by path glob. */
const SELECTOR: vscode.DocumentSelector = { pattern: "**/_quarto.{yml,yaml}" };

/**
 * `:` opens the list right after a key; `-` keeps it live on a new sequence item;
 * `/` re-triggers it when descending into a subdirectory. (VS Code's own
 * quick-suggestions keep it live as ordinary path characters are typed.)
 */
const TRIGGERS = [":", "-", "/"];

/** Register the `_quarto.yml` filepath completion provider, tied to the extension lifetime. */
export function registerFilepathCompletionFeature(
  context: vscode.ExtensionContext,
): void {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      SELECTOR,
      new QuartoYamlFilepathCompletionProvider(),
      ...TRIGGERS,
    ),
  );
}

/** Offer on-disk files/folders for a file-path value slot in a `_quarto.yml`. */
class QuartoYamlFilepathCompletionProvider
  implements vscode.CompletionItemProvider
{
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.CompletionItem[] | undefined> {
    const ctx = valueContextAt(
      document.getText(),
      position.line,
      position.character,
    );
    // Every position outside a value slot (a key, a comment, a container line)
    // yields no items — the inverse-gating contract (mirrors providers/yaml.ts).
    if (ctx === null) {
      return undefined;
    }
    // Split the value-so-far at the last `/`: the prefix selects the directory to
    // list, the remainder is the partial filename VS Code filters the items on.
    const slashIdx = ctx.token.lastIndexOf("/");
    const dirPrefix = slashIdx >= 0 ? ctx.token.slice(0, slashIdx + 1) : "";
    const dirUri = vscode.Uri.file(
      path.resolve(path.dirname(document.fileName), dirPrefix),
    );
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(dirUri);
    } catch {
      return undefined; // directory doesn't resolve / isn't readable — nothing to offer
    }

    const line = ctx.replaceRange.line;
    // When the slot abuts the colon (`key:` with no space yet), prepend a space so
    // accepting yields valid `key: value` YAML (matches providers/yaml.ts).
    const needSpace =
      document.lineAt(line).text[ctx.replaceRange.startCol - 1] === ":";
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
    return entries.map(([name, type]) =>
      fileItem(name, type, dirPrefix, range, needSpace),
    );
  }
}

/** Translate one directory entry into a File/Folder completion item. */
function fileItem(
  name: string,
  type: vscode.FileType,
  dirPrefix: string,
  range: { inserting: vscode.Range; replacing: vscode.Range },
  needSpace: boolean,
): vscode.CompletionItem {
  // `FileType` is a bit-flag set, so a symlinked directory is `Directory|SymbolicLink`.
  const isDir = (type & vscode.FileType.Directory) !== 0;
  const suffix = isDir ? "/" : "";
  const item = new vscode.CompletionItem(
    name + suffix,
    isDir
      ? vscode.CompletionItemKind.Folder
      : vscode.CompletionItemKind.File,
  );
  // The label shows just the entry name; the inserted/filtered text carries the
  // typed directory prefix so replacing the whole value token stays consistent.
  const full = dirPrefix + name + suffix;
  item.insertText = needSpace ? ` ${full}` : full;
  item.filterText = full;
  item.range = range;
  item.detail = isDir ? "Folder" : "File";
  return item;
}
