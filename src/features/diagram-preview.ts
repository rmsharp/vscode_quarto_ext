/**
 * `Quarto: Preview Diagram` (plan §6 Phase 7 authoring aids).
 *
 * Detects the diagram cells in the active `.qmd` (pure `core/diagram-regions`)
 * and renders every ```` ```{mermaid} ```` cell in a webview beside the editor
 * using the vendored, locally-served Mermaid bundle (`media/mermaid/`). The
 * preview tracks the document it was opened for and re-renders live as that
 * document changes. Graphviz (`{dot}`) cells are detected and shown with their
 * source plus a "not yet rendered" note (rendering them is a future slice).
 *
 * All non-`vscode` logic — the diagram detection and the webview HTML/CSP —
 * lives in `core/` (§3.3 guardrail) and is unit-tested headlessly. This module
 * is the thin adapter, verified by `@vscode/test-electron`
 * (test/integration/suite/diagram-preview.test.ts), which drives the real
 * editor and asserts a diagram-preview webview opens — no Quarto CLI needed.
 */

import * as path from "node:path";
import * as vscode from "vscode";
import { buildDiagramPreviewHtml } from "../core/diagram-preview-html";
import { findDiagramRegions } from "../core/diagram-regions";

/** Idle delay before a document edit triggers a re-render of the preview. */
const RENDER_DEBOUNCE_MS = 200;

/**
 * Owns the single diagram-preview webview: creates it on first use, reuses and
 * re-targets it afterwards, and re-renders it when the tracked document changes.
 */
class DiagramPreviewManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  /** The document the live panel currently mirrors. */
  private trackedUri: vscode.Uri | undefined;
  /** Pending debounced re-render (from rapid edits), if any. */
  private renderTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {}

  /** Open (or focus) the preview for `doc` and render its diagrams. */
  show(doc: vscode.TextDocument): void {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        "quartoDiagramPreview",
        titleFor(doc),
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          // Only the vendored Mermaid bundle may be loaded into the webview.
          localResourceRoots: [this.mermaidRoot()],
        },
      );
      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.trackedUri = undefined;
        this.clearTimer();
      });
    } else {
      this.panel.title = titleFor(doc);
      this.panel.reveal(vscode.ViewColumn.Beside, true);
    }
    this.trackedUri = doc.uri;
    this.render(doc); // immediate on explicit invocation
  }

  /**
   * Re-render if `doc` is the one the live panel tracks. Debounced: rapid edits
   * coalesce into one render after a short idle, so typing stays smooth and the
   * webview is not reloaded (losing scroll) on every keystroke.
   */
  onDocumentChanged(doc: vscode.TextDocument): void {
    if (
      !this.panel ||
      !this.trackedUri ||
      doc.uri.toString() !== this.trackedUri.toString()
    ) {
      return;
    }
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
    }
    this.renderTimer = setTimeout(() => {
      this.renderTimer = undefined;
      this.render(doc);
    }, RENDER_DEBOUNCE_MS);
  }

  private render(doc: vscode.TextDocument): void {
    if (!this.panel) {
      return;
    }
    const webview = this.panel.webview;
    const mermaidJsUri = webview
      .asWebviewUri(vscode.Uri.joinPath(this.mermaidRoot(), "mermaid.min.js"))
      .toString();
    webview.html = buildDiagramPreviewHtml({
      regions: findDiagramRegions(doc.getText()),
      mermaidJsUri,
      cspSource: webview.cspSource,
      nonce: getNonce(),
    });
  }

  private mermaidRoot(): vscode.Uri {
    return vscode.Uri.joinPath(this.extensionUri, "media", "mermaid");
  }

  private clearTimer(): void {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = undefined;
    }
  }

  dispose(): void {
    this.clearTimer();
    this.panel?.dispose();
    this.panel = undefined;
  }
}

function titleFor(doc: vscode.TextDocument): string {
  return `Diagram Preview: ${path.basename(doc.uri.fsPath)}`;
}

/** A random nonce authorizing the webview's script tags (VS Code idiom). */
function getNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

/** Register the `quarto.previewDiagram` command and the live-update hook. */
export function registerDiagramPreviewFeature(
  context: vscode.ExtensionContext,
): void {
  const manager = new DiagramPreviewManager(context.extensionUri);
  context.subscriptions.push(
    manager,
    vscode.commands.registerCommand("quarto.previewDiagram", () =>
      previewDiagram(manager),
    ),
    vscode.workspace.onDidChangeTextDocument((e) =>
      manager.onDocumentChanged(e.document),
    ),
  );
}

function previewDiagram(manager: DiagramPreviewManager): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "quarto") {
    void vscode.window.showErrorMessage(
      "Quarto: open a Quarto (.qmd) document to preview diagrams.",
    );
    return;
  }
  manager.show(editor.document);
}
