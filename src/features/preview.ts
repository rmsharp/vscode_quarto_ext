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
import { buildPreviewArgs, parseDeclaredFormats } from "../core/preview-format";
import type { ContextKeySetter } from "../core/context-key-setter";
import { createBrowseUrlScanner } from "../core/preview-url";
import {
  isRenderScriptDocument,
  isRenderScriptExtension,
} from "../core/render-script";
import { QuartoNotFound, resolveBinary } from "../quarto/cli";
import { createVscodeContextKeySetter } from "./context-key";

const CHANNEL_NAME = "Quarto Preview";
/**
 * Context key: "the active editor is a render script this extension can preview"
 * (CHANGELOG: preview command family breadth, Sessions 82-85 Slice 2; plan §6 Slice 2). Drives the mutually-exclusive
 * `Ctrl+Shift+K` (`quarto.preview` binds when it is FALSE, `quarto.previewScript`
 * when it is TRUE), the editor-title button, and the palette entry.
 */
const RENDER_SCRIPT_CONTEXT = "quartoRenderScriptActive";
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
  /** The `--to` format this session was started with, or undefined for the
   * document's own default format. Re-invoking with a DIFFERENT format restarts
   * the preview (see `openPreview`). */
  readonly to: string | undefined;
}

/**
 * Owns at most one live preview per document and guarantees the preview server
 * is reaped on pane close / document close / deactivate.
 */
class PreviewManager implements vscode.Disposable {
  private readonly sessions = new Map<string, PreviewSession>();
  /**
   * fsPaths whose preview is mid-startup. A session is only added to `sessions`
   * after `spawnPreview` runs (past the save/resolveBinary awaits), so this set
   * reserves the slot synchronously, before the first await, to close the
   * check-then-spawn race (two rapid invocations would otherwise both spawn,
   * and the second's session would orphan the first's server).
   */
  private readonly starting = new Set<string>();

  constructor(private readonly channel: vscode.OutputChannel) {}

  /**
   * Open (or focus) the preview for `doc`. Resolves once the preview URL has
   * been parsed and shown in the webview, or after a clear failure — never
   * leaving a spawned process behind.
   */
  async openPreview(
    doc: vscode.TextDocument,
    opts: { to?: string } = {},
  ): Promise<void> {
    const fsPath = doc.uri.fsPath;
    const to = opts.to?.trim() || undefined;

    // One preview per document. Re-running with the SAME format focuses the
    // existing pane.
    const existing = this.sessions.get(fsPath);
    if (existing && existing.to === to) {
      existing.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }
    // A spawn is already in flight for this document (the slot is held from
    // before the first await until spawnPreview settles). Drop this request —
    // including a differing-format one — rather than tearing down the in-flight
    // preview and racing a second spawn. (Residual: a format switch requested
    // DURING startup is silently dropped; the user re-runs once the preview is
    // up. Documented as a low-severity limitation — S82 review finding #6.)
    if (this.starting.has(fsPath)) {
      return;
    }
    // Steady state: a DIFFERENT-format request (e.g. via `quarto.previewFormat`)
    // tears the current preview down and restarts it in the requested format.
    if (existing) {
      this.disposeSession(fsPath);
    }
    this.starting.add(fsPath);

    try {
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

      await this.spawnPreview(bin, fsPath, to);
    } finally {
      this.starting.delete(fsPath);
    }
  }

  private spawnPreview(
    bin: string,
    fsPath: string,
    to: string | undefined,
  ): Promise<void> {
    const args = buildPreviewArgs(fsPath, { to });
    const cwd = path.dirname(fsPath);

    this.channel.appendLine(`> ${bin} ${args.join(" ")}`);
    // detached: own a process group so we can reap the deno worker too (🐉).
    const child = spawn(bin, args, { cwd, detached: true });

    const title = to
      ? `Quarto Preview: ${path.basename(fsPath)} (${to})`
      : `Quarto Preview: ${path.basename(fsPath)}`;
    const panel = vscode.window.createWebviewPanel(
      "quartoPreview",
      title,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true },
    );
    panel.webview.html = startingHtml();

    const session: PreviewSession = { fsPath, panel, child, to };
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

      // This spawn is still the active preview for its document ⟺ its own
      // session object still occupies the map slot. A stale child (its session
      // already replaced by a format-restart, or removed by an intentional
      // teardown) must NOT dispose whatever now holds the slot, nor raise an
      // error for an exit that was expected (S82 review finding #2).
      const isCurrent = (): boolean => this.sessions.get(fsPath) === session;

      const timer = setTimeout(() => {
        if (!settled) {
          this.channel.appendLine(
            `\nQuarto preview did not report a URL within ` +
              `${START_TIMEOUT_MS / 1000}s.`,
          );
          if (isCurrent()) {
            this.channel.show(true);
            void vscode.window.showErrorMessage(
              `Quarto preview failed to start. See the "${CHANNEL_NAME}" output.`,
            );
            this.disposeSession(fsPath);
          }
          settle();
        }
      }, START_TIMEOUT_MS);

      // One scanner per spawn. It keeps only the incomplete last line of stderr and tests only the new text, so
      // startup noise before the URL costs linear time; no accumulated stderr is kept (Session 341).
      const urlScanner = createBrowseUrlScanner();
      // `settled` only flips after showPreview's async asExternalUri resolves;
      // `urlShown` flips synchronously the instant a URL is matched, so further
      // stderr chunks during that await don't re-dispatch showPreview. It MUST
      // be separate from `settled` — flipping `settled` early would make the
      // post-await settle() a no-op and leave the promise (and timeout) hanging.
      let urlShown = false;
      child.stderr?.on("data", (buf: Buffer) => {
        const text = buf.toString();
        this.channel.append(text);
        if (!urlShown) {
          const url = urlScanner.push(text);
          if (url) {
            urlShown = true;
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
        if (isCurrent()) {
          this.channel.show(true);
          void vscode.window.showErrorMessage(
            `Quarto preview failed to start: ${err.message}`,
          );
          this.disposeSession(fsPath);
        }
        settle();
      });

      child.on("close", (code) => {
        // This session still occupies the slot ⟺ its server died on its own — a
        // real failure. If it's already gone (intentional teardown) or has been
        // replaced by a newer session (a format restart), this is a STALE
        // child's exit: log it, but do NOT dispose whatever now holds the slot
        // and do NOT raise an error (S82 review finding #2).
        const unexpected = isCurrent();
        if (!settled) {
          this.channel.appendLine(
            `\nQuarto preview exited (code ${code ?? "unknown"}) before it was ready.`,
          );
          if (unexpected) {
            this.channel.show(true);
            void vscode.window.showErrorMessage(
              "Quarto preview exited before it was ready. " +
                `See the "${CHANNEL_NAME}" output.`,
            );
          }
        } else if (unexpected) {
          this.channel.appendLine(
            `\nQuarto preview server stopped (code ${code ?? "unknown"}).`,
          );
        }
        if (unexpected) {
          this.disposeSession(fsPath);
        }
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

  // On win32 there are no POSIX process groups; a direct kill is the best we can
  // do (Windows is out of v1 scope — degrade, don't crash).
  if (process.platform === "win32") {
    try {
      child.kill();
    } catch {
      // already gone
    }
    return;
  }

  // Negative pid → the whole process group (the detached child leads it).
  // Signal 0 delivers nothing but throws ESRCH if the group is gone, so it
  // doubles as a liveness probe. A group outlives its leader as long as any
  // member (e.g. the deno worker) is alive.
  const signalGroup = (sig: NodeJS.Signals | 0): boolean => {
    try {
      process.kill(-pid, sig);
      return true;
    } catch {
      return false; // ESRCH — nothing left in the group
    }
  };

  // SIGTERM first for a clean port release. If the group is already gone (the
  // server self-exited), there is nothing to reap and nothing to escalate —
  // returning here avoids a misleading SIGKILL log and never signals a PID that
  // may since have been recycled.
  if (!signalGroup("SIGTERM")) {
    return;
  }
  const escalate = setTimeout(() => {
    // Only escalate if something in the group is genuinely still alive.
    if (signalGroup(0)) {
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
  const setContextKey = createVscodeContextKeySetter();

  context.subscriptions.push(
    channel,
    manager,
    vscode.commands.registerCommand("quarto.preview", () =>
      previewActiveDocument(manager),
    ),
    vscode.commands.registerCommand("quarto.previewFormat", () =>
      previewFormatOfActiveDocument(manager),
    ),
    vscode.commands.registerCommand("quarto.previewScript", () =>
      previewActiveScript(manager),
    ),
    vscode.workspace.onDidCloseTextDocument((doc) =>
      manager.onDocumentClosed(doc),
    ),
    // Keep `quartoRenderScriptActive` fresh so ctrl+shift+k binds to
    // `previewScript` on a render script and to `preview` everywhere else.
    vscode.window.onDidChangeActiveTextEditor((editor) =>
      updateRenderScriptContext(editor, setContextKey),
    ),
    // Render-script-ness is a property of the TEXT, so an edit alone can change
    // it with no editor switch — typing `# %% [markdown]` atop a plain .py file
    // makes it previewable immediately, before any save.
    vscode.workspace.onDidChangeTextDocument((e) => {
      const active = vscode.window.activeTextEditor;
      if (active && e.document === active.document) {
        updateRenderScriptContext(active, setContextKey);
      }
    }),
  );
  updateRenderScriptContext(vscode.window.activeTextEditor, setContextKey);
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

/**
 * `Quarto: Preview Script…` — preview a standalone Quarto **render script**
 * (CHANGELOG: preview command family breadth, Sessions 82-85; plan `docs/planning/2026-07-12-preview-script-plan.md`).
 *
 * The sibling of `previewActiveDocument`: same `PreviewManager.openPreview`, a
 * different gate. `quarto.preview` gates on `languageId === "quarto"`, which a
 * `.py`/`.jl`/`.r` script can never satisfy; this one gates on the file actually
 * having render-script STRUCTURE (`isRenderScriptDocument`, which keys on the
 * extension and the leading percent/spin marker). The two gates are disjoint by
 * construction — `.qmd`/`.rmd` are not render-script extensions — so no file is
 * ever claimed by both commands.
 */
async function previewActiveScript(manager: PreviewManager): Promise<void> {
  const doc = vscode.window.activeTextEditor?.document;
  if (!isPreviewableRenderScript(doc)) {
    void vscode.window.showErrorMessage(
      "Quarto: open a Quarto render script to preview — a .py/.jl/.r file " +
        "starting with a `# %% [markdown]` or `# %% [raw]` cell, or a .r file " +
        "starting with a `#' ---` block.",
    );
    return;
  }
  await manager.openPreview(doc);
}

/**
 * The ONE predicate behind both `quarto.previewScript`'s gate and the
 * `quartoRenderScriptActive` context key. They must never disagree: the key is
 * what binds `Ctrl+Shift+K` to `previewScript`, so a key that is true for a
 * document the gate would refuse produces a keystroke that fires a command that
 * immediately errors. Sharing the predicate makes that divergence unrepresentable
 * rather than merely unlikely.
 *
 * `quarto preview` renders the file from DISK, so the document must actually be
 * one. Without the scheme check we would read buffer text from any provider —
 * e.g. the built-in Git extension's read-only `git:` diff of a spin script, whose
 * fsPath is the working-tree path — and preview the working-tree file while the
 * user is looking at an old revision.
 *
 * NO TEXT IS BUILT HERE (Session 344, SIB-08). This predicate runs on every
 * keystroke of the active document (`updateRenderScriptContext`). Until Session 344
 * it asked for the whole buffer (`getText()`, then the shared memo of
 * `document-text.ts`, which gives a keystroke no gain: every keystroke is a new
 * version) of every `.py`, `.jl` and `.r` file to answer a question about its first
 * lines, which cost 12 to 20 ms a keystroke at 500,000 lines (`lines.join` standing
 * in for `getText`, in a fresh process). It now hands the DOCUMENT to
 * `isRenderScriptDocument` (`core/render-script`), which reads `lineCount` and
 * `lineAt(i).text` for the lines the answer needs and stops: one line for an
 * ordinary script, the lines of the marker or header for a render script, and the
 * whole document only for a spin header opened and never closed or a document of
 * nothing but blank lines.
 *
 * ⚠ The ORDER of the chain is no longer load-bearing for cost, and is still pinned:
 * the document defined, the `file` scheme, `isRenderScriptExtension`, then the lazy
 * read. `isRenderScriptDocument` reads nothing for a name no pattern claims, so a
 * 20 MB log or .json costs no read with the extension test first or without it. It
 * stays first as the cheaper question, and because the syntax-tree pin
 * (`test/unit/s343-adapter-wiring-pin.test.ts`, the PT group) holds the shape of the
 * chain. `isRenderScriptExtension` is a strict superset of what the full detector
 * accepts (unit-tested), so putting it first can never veto a real script, and every
 * ordering yields the same boolean.
 *
 * That nothing on this path builds the buffer is pinned twice: in `core/` by counts of
 * the lines read (`test/unit/s344-render-script-lazy.test.ts`), and here from the
 * syntax tree (the document is the second argument of the last operand, and none of
 * this function, `updateRenderScriptContext` and `previewActiveScript` calls
 * `getText` or `documentText`).
 */
function isPreviewableRenderScript(
  doc: vscode.TextDocument | undefined,
): doc is vscode.TextDocument {
  return (
    doc !== undefined &&
    doc.uri.scheme === "file" &&
    isRenderScriptExtension(doc.uri.fsPath) &&
    isRenderScriptDocument(doc.uri.fsPath, doc)
  );
}

/**
 * Keep `quartoRenderScriptActive` in sync with the active editor. Has the same
 * guard as `execution.ts`'s `quarto.inCodeCell` key, which lives in that file's
 * selection listener (`updateCellContext` takes no editor): a background editor's
 * event must not clobber a key that describes the ACTIVE one. It does not share
 * that key's debounce: the predicate is asked at once on every document event of the
 * active editor, and the key is set through the register function's setter, which sends
 * `setContext` to the host only when the value is not the one it last sent.
 */
function updateRenderScriptContext(
  editor: vscode.TextEditor | undefined,
  setContextKey: ContextKeySetter,
): void {
  if (editor !== undefined && editor !== vscode.window.activeTextEditor) {
    return;
  }
  setContextKey(
    RENDER_SCRIPT_CONTEXT,
    isPreviewableRenderScript(editor?.document),
  );
}

/**
 * `Quarto: Preview Format…` — enumerate the active document's declared output
 * formats, let the user pick one, then preview in that format (`--to <format>`).
 * When the document declares no `format:`, offer Quarto's implicit default
 * (`html`) so the command is still usable.
 */
async function previewFormatOfActiveDocument(
  manager: PreviewManager,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "quarto") {
    void vscode.window.showErrorMessage(
      "Quarto: open a Quarto (.qmd) document to preview.",
    );
    return;
  }

  const declared = parseDeclaredFormats(editor.document.getText());
  const formats = declared.length > 0 ? declared : ["html"];
  const picked = await vscode.window.showQuickPick(formats, {
    placeHolder: "Select a format to preview",
  });
  if (!picked) {
    return; // user dismissed the picker
  }
  await manager.openPreview(editor.document, { to: picked });
}

/** Reap every live preview — called from the extension's `deactivate`. */
export function disposeAllPreviews(): void {
  activeManager?.disposeAll();
}
