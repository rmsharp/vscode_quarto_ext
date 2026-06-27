/**
 * `Quarto: Preview` (plan §6 Phase 4) — the LARGE phase.
 *
 * Spawns `quarto preview <file> --no-browser`, parses the `Browse at <url>`
 * line from STDERR (verified live: stdout is empty, the line is ANSI-wrapped —
 * see `core/preview-url`), and embeds that URL in a webview panel beside the
 * editor (HTML/CSP from `core/preview-html`). It OWNS the preview process
 * lifecycle: the long-lived server is killed when the pane is closed, when the
 * document is closed, and on extension deactivate — no orphans.
 *
 * All non-`vscode` logic (URL parsing, webview HTML/CSP) lives in `core/` so it
 * stays unit-testable headlessly (§3.3 guardrail). This module is the adapter,
 * verified by `@vscode/test-electron` (test/integration/suite/preview.test.ts).
 *
 * 🐉 Process-tree reaping: the immediate child is the `quarto` shell wrapper,
 * which spawns a `deno` worker (`quarto.js preview …`). Killing the wrapper
 * first reparents the worker (it survives), so we spawn DETACHED (the wrapper
 * becomes a process-group leader) and signal the whole group atomically with
 * `process.kill(-pid, …)`, escalating SIGTERM → SIGKILL.
 */

import { type ChildProcess, spawn } from "node:child_process";
import * as path from "node:path";
import * as vscode from "vscode";
import { buildPreviewHtml } from "../core/preview-html";
import { parseBrowseUrl } from "../core/preview-url";
import { QuartoNotFound, resolveBinary } from "../quarto/cli";

const CHANNEL_NAME = "Quarto Preview";
/** How long to wait for the `Browse at <url>` line before declaring failure. */
const START_TIMEOUT_MS = 60_000;
/** Grace period after SIGTERM before escalating to SIGKILL on the group. */
const KILL_ESCALATE_MS = 3_000;

/** Module-level handle so `deactivate()` can reap every live preview. */
let activeManager: PreviewManager | undefined;

interface PreviewSession {
  readonly fsPath: string;
  readonly panel: vscode.WebviewPanel;
  readonly child: ChildProcess;
}

/**
 * Owns at most one live preview per document and guarantees the preview server
 * is reaped on pane close / document close / deactivate.
 */
class PreviewManager implements vscode.Disposable {
  private readonly sessions = new Map<string, PreviewSession>();

  constructor(private readonly channel: vscode.OutputChannel) {}

  /**
   * Open (or focus) the preview for `doc`. Resolves once the preview URL has
   * been parsed and shown in the webview, or after a clear failure — never
   * leaving a spawned process behind.
   */
  async openPreview(doc: vscode.TextDocument): Promise<void> {
    const fsPath = doc.uri.fsPath;

    // One preview per document — re-running focuses the existing pane.
    const existing = this.sessions.get(fsPath);
    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    // Preview reads from disk; persist unsaved edits first (like render).
    if (doc.isDirty) {
      await doc.save();
    }

    let bin: string;
    try {
      ({ path: bin } = await resolveBinary());
    } catch (err) {
      if (err instanceof QuartoNotFound) {
        await showQuartoNotFound();
        return;
      }
      throw err;
    }

    await this.spawnPreview(bin, fsPath);
  }

  private spawnPreview(bin: string, fsPath: string): Promise<void> {
    const args = ["preview", fsPath, "--no-browser"];
    const cwd = path.dirname(fsPath);

    this.channel.appendLine(`> ${bin} ${args.join(" ")}`);
    // detached: own a process group so we can reap the deno worker too (🐉).
    const child = spawn(bin, args, { cwd, detached: true });

    const panel = vscode.window.createWebviewPanel(
      "quartoPreview",
      `Quarto Preview: ${path.basename(fsPath)}`,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true },
    );
    panel.webview.html = startingHtml();

    const session: PreviewSession = { fsPath, panel, child };
    this.sessions.set(fsPath, session);

    // The user closing the pane is the primary lifecycle trigger.
    panel.onDidDispose(() => this.disposeSession(fsPath));

    return new Promise<void>((resolve) => {
      let settled = false;
      const settle = (): void => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve();
        }
      };

      const timer = setTimeout(() => {
        if (!settled) {
          this.channel.appendLine(
            `\nQuarto preview did not report a URL within ` +
              `${START_TIMEOUT_MS / 1000}s.`,
          );
          void vscode.window.showErrorMessage(
            `Quarto preview failed to start. See the "${CHANNEL_NAME}" output.`,
          );
          this.disposeSession(fsPath);
          settle();
        }
      }, START_TIMEOUT_MS);

      let stderr = "";
      child.stderr?.on("data", (buf: Buffer) => {
        const text = buf.toString();
        stderr += text;
        this.channel.append(text);
        if (!settled) {
          const url = parseBrowseUrl(stderr);
          if (url) {
            void this.showPreview(session, url).then(settle, (err: unknown) => {
              this.channel.appendLine(`\nFailed to show preview: ${String(err)}`);
              settle();
            });
          }
        }
      });
      child.stdout?.on("data", (buf: Buffer) => {
        this.channel.append(buf.toString());
      });

      child.on("error", (err) => {
        this.channel.appendLine(`\nQuarto preview failed to start: ${String(err)}`);
        void vscode.window.showErrorMessage(
          `Quarto preview failed to start: ${err.message}`,
        );
        this.disposeSession(fsPath);
        settle();
      });

      child.on("close", (code) => {
        // The server exited. If it died before reporting a URL it failed to
        // start; either way clean up so a re-preview spawns fresh.
        if (!settled) {
          this.channel.appendLine(
            `\nQuarto preview exited (code ${code ?? "unknown"}) before it was ready.`,
          );
          void vscode.window.showErrorMessage(
            "Quarto preview exited before it was ready.",
          );
        } else {
          this.channel.appendLine(
            `\nQuarto preview server stopped (code ${code ?? "unknown"}).`,
          );
        }
        this.disposeSession(fsPath);
        settle();
      });
    });
  }

  private async showPreview(
    session: PreviewSession,
    url: string,
  ): Promise<void> {
    // asExternalUri makes the localhost URL reachable from the webview (and
    // sets up port-forwarding transparently under Remote/Codespaces).
    const external = await vscode.env.asExternalUri(vscode.Uri.parse(url));
    session.panel.webview.html = buildPreviewHtml({ url: external.toString() });
    this.channel.appendLine(`\nPreview ready: ${external.toString()}`);
  }

  /** Kill the worker group and drop the pane for one document (idempotent). */
  private disposeSession(fsPath: string): void {
    const session = this.sessions.get(fsPath);
    if (!session) {
      return;
    }
    // Delete first so the panel.onDidDispose re-entry below is a no-op.
    this.sessions.delete(fsPath);
    killProcessGroup(session.child, this.channel);
    session.panel.dispose();
  }

  /** Called when a document closes — reap its preview if any. */
  onDocumentClosed(doc: vscode.TextDocument): void {
    this.disposeSession(doc.uri.fsPath);
  }

  disposeAll(): void {
    for (const fsPath of [...this.sessions.keys()]) {
      this.disposeSession(fsPath);
    }
  }

  dispose(): void {
    this.disposeAll();
  }
}

/**
 * Reap a spawned `quarto preview` and its `deno` worker by signalling the whole
 * process group (the child was spawned detached, so it leads its group).
 * SIGTERM first for a clean port release, escalating to SIGKILL.
 */
function killProcessGroup(
  child: ChildProcess,
  channel: vscode.OutputChannel,
): void {
  const pid = child.pid;
  if (pid === undefined) {
    return;
  }

  let exited = false;
  child.once("close", () => {
    exited = true;
  });

  const signalGroup = (sig: NodeJS.Signals): void => {
    try {
      // Negative pid → the whole process group (POSIX). On win32, where there
      // are no POSIX groups, fall back to a direct kill.
      if (process.platform === "win32") {
        child.kill(sig);
      } else {
        process.kill(-pid, sig);
      }
    } catch {
      // ESRCH = already gone; ignore.
    }
  };

  signalGroup("SIGTERM");
  const escalate = setTimeout(() => {
    if (!exited) {
      channel.appendLine("\nPreview did not exit on SIGTERM; sending SIGKILL.");
      signalGroup("SIGKILL");
    }
  }, KILL_ESCALATE_MS);
  // Don't keep the host alive just to escalate.
  if (typeof escalate.unref === "function") {
    escalate.unref();
  }
}

function startingHtml(): string {
  return (
    '<!DOCTYPE html><html><body style="font-family:var(--vscode-font-family);' +
    'padding:1rem;color:var(--vscode-foreground)">Starting Quarto preview…' +
    "</body></html>"
  );
}

async function showQuartoNotFound(): Promise<void> {
  const choice = await vscode.window.showErrorMessage(
    'Quarto was not found. Install the Quarto CLI, or set "quarto.path" to ' +
      "its location.",
    "Open Settings",
  );
  if (choice === "Open Settings") {
    void vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "quarto.path",
    );
  }
}

/**
 * Register the `quarto.preview` command, the preview Output channel, and the
 * document-close lifecycle hook. The manager is also pushed as a subscription
 * so VS Code disposes it (reaping previews) on deactivate.
 */
export function registerPreviewFeature(
  context: vscode.ExtensionContext,
): void {
  const channel = vscode.window.createOutputChannel(CHANNEL_NAME);
  const manager = new PreviewManager(channel);
  activeManager = manager;

  context.subscriptions.push(
    channel,
    manager,
    vscode.commands.registerCommand("quarto.preview", () =>
      previewActiveDocument(manager),
    ),
    vscode.workspace.onDidCloseTextDocument((doc) =>
      manager.onDocumentClosed(doc),
    ),
  );
}

async function previewActiveDocument(manager: PreviewManager): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "quarto") {
    void vscode.window.showErrorMessage(
      "Quarto: open a Quarto (.qmd) document to preview.",
    );
    return;
  }
  await manager.openPreview(editor.document);
}

/** Reap every live preview — called from the extension's `deactivate`. */
export function disposeAllPreviews(): void {
  activeManager?.disposeAll();
}
