/**
 * Citation completion provider for `.qmd` — completes a bare `@key` from the
 * bibliography named in the document's YAML front matter (plan §6 Phase 6c).
 *
 * Thin `vscode` adapter (plan §3.3): all parsing lives in the pure core —
 * `core/frontmatter` (which bib files the document declares) and `core/citations`
 * (parsing those files into citekeys). This class only reads the files from disk
 * (an adapter-only concern) and translates between `vscode` types and the core
 * model. It reuses the cross-ref context detection (`core/refs`) because a bare
 * `@key` is detected exactly like an `@fig-…` reference and is prose-only too;
 * the cross-ref and citation completion providers both fire on `@` and VS Code
 * merges their items (the editor filters by the typed text — `@fig` shows
 * cross-refs, `@kn` shows citations). Registering a provider needs no
 * `package.json` contribution, so activation is unchanged.
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  type Citation,
  citationCompletionContext,
  parseCitations,
} from "../core/citations";
import { bibliographyPaths } from "../core/frontmatter";
import { isReferenceableLine } from "../core/refs";

const QMD: vscode.DocumentSelector = { language: "quarto" };

/** Register the citation completion provider, tied to the extension lifetime. */
export function registerCitationProviders(
  context: vscode.ExtensionContext,
): void {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      QMD,
      new CitationCompletionProvider(),
      "@",
    ),
  );
}

/** Offer every citekey from the document's bibliography when the cursor is in a `@…` context. */
class CitationCompletionProvider implements vscode.CompletionItemProvider {
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.CompletionItem[] | undefined> {
    const text = document.getText();
    // Citations apply only in prose/headings — not inside code cells, front
    // matter, or comments (where `@` is a decorator/macro/email).
    if (!isReferenceableLine(text, position.line)) {
      return undefined;
    }
    const lineText = document.lineAt(position.line).text;
    // A citekey-aware context (not the cross-ref one): citekeys routinely
    // contain ':' / '.' (biblatex/DBLP/dotted), which the cross-ref ID_CHAR
    // scanner would truncate — breaking completion after a ':' and duplicating
    // the suffix on a mid-token accept.
    const context = citationCompletionContext(lineText, position.character);
    if (context === null) {
      return undefined;
    }
    const citations = await loadCitations(document, text);
    if (citations.length === 0) {
      return undefined;
    }
    // Insert replaces `@`→cursor; replace covers the whole `@key` token (through
    // `end`) so accepting mid-token does not duplicate the trailing suffix.
    const range = {
      inserting: new vscode.Range(
        position.line,
        context.start,
        position.line,
        position.character,
      ),
      replacing: new vscode.Range(
        position.line,
        context.start,
        position.line,
        context.end,
      ),
    };
    return citations.map((c) => toCompletionItem(c, range));
  }
}

/**
 * Read and parse every bibliography file the document declares, de-duplicated by
 * citekey (first wins), in declared/file order. Bib paths resolve relative to
 * the document's own directory. A missing or unreadable bib is skipped — a
 * broken bibliography must never break completion.
 */
async function loadCitations(
  document: vscode.TextDocument,
  text: string,
): Promise<Citation[]> {
  const relPaths = bibliographyPaths(text);
  if (relPaths.length === 0 || document.uri.scheme !== "file") {
    return [];
  }
  const dir = path.dirname(document.uri.fsPath);
  const all: Citation[] = [];
  for (const rel of relPaths) {
    try {
      const content = await fs.readFile(path.resolve(dir, rel), "utf8");
      all.push(...parseCitations(content));
    } catch {
      // Missing/unreadable bib file — skip it; offer what we can.
    }
  }
  return dedupeByKey(all);
}

/** Keep only the first citation for each key, preserving order. */
function dedupeByKey(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  return citations.filter((c) => {
    if (seen.has(c.key)) {
      return false;
    }
    seen.add(c.key);
    return true;
  });
}

/** Translate one core `Citation` into a `vscode.CompletionItem`. */
function toCompletionItem(
  citation: Citation,
  range: { inserting: vscode.Range; replacing: vscode.Range },
): vscode.CompletionItem {
  const insert = `@${citation.key}`;
  const item = new vscode.CompletionItem(
    insert,
    vscode.CompletionItemKind.Reference,
  );
  item.insertText = insert;
  item.filterText = insert;
  item.range = range;
  if (citation.title) {
    item.detail = citation.title;
  }
  const byline = [citation.author, citation.year ? `(${citation.year})` : ""]
    .filter((s) => s)
    .join(" ");
  if (byline !== "") {
    item.documentation = new vscode.MarkdownString(byline);
  }
  return item;
}
