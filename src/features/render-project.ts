/**
 * `Quarto: Render Project` (plan
 * `docs/planning/2026-07-09-project-level-render-plan.md` §5.3/§6).
 *
 * Thin `vscode` adapter: resolve a starting directory + search boundary from
 * editor/workspace-folder state, discover the project root via the pure
 * `core/project.ts` `findProjectRoot`, then spawn
 * `quarto render <root>` with `cwd` PINNED to `root` (never bare
 * `quarto render` relying on cwd alone — plan §0/§7 D1/D2: Quarto reports its
 * `Output created:` path relative to the TARGET project directory, not the
 * spawning process's own cwd, and a bare no-arg invocation from a project
 * subdirectory silently renders only that subdirectory, not the whole
 * project). Mirrors `features/render.ts`'s spawn/report shape (R3/R4).
 */

import { spawn } from "node:child_process";
import * as path from "node:path";
import { existsSync } from "node:fs";
import * as vscode from "vscode";
import { findProjectRoot } from "../core/project";
import { buildRenderProjectArgs, parseOutputPath } from "../core/render-args";
import { QuartoNotFound, resolveBinary } from "../quarto/cli";

const CHANNEL_NAME = "Quarto Render Project";

/**
 * Create a dedicated Output channel (kept separate from `"Quarto Render"` so
 * a long-running project render doesn't clobber an in-flight single-file
 * render's output — plan §8), register `quarto.renderProject`, and tie both
 * to the extension lifetime.
 */
export function registerRenderProjectFeature(
  context: vscode.ExtensionContext,
): void {
  const channel = vscode.window.createOutputChannel(CHANNEL_NAME);
  context.subscriptions.push(
    channel,
    vscode.commands.registerCommand("quarto.renderProject", () =>
      renderProject(channel),
    ),
  );
}

/**
 * Resolve a starting directory + search boundary (Tier A: active on-disk
 * editor; Tier B: workspace folder(s)), find the project root, and render it.
 * Returns `undefined` on user cancellation (multi-root folder pick) with no
 * error — the standard VS Code cancellation convention.
 */
async function renderProject(channel: vscode.OutputChannel): Promise<void> {
  const resolved = await resolveStartAndBoundary();
  if (resolved === "cancelled") {
    return;
  }
  if (resolved === null) {
    void vscode.window.showErrorMessage(
      "Quarto: open a file inside a Quarto project, or open a project folder, to render it.",
    );
    return;
  }

  const { start, boundary, searched } = resolved;
  const root = findProjectRoot(start, boundary, existsSync);
  if (root === null) {
    void vscode.window.showErrorMessage(
      `Quarto: no _quarto.yml or _quarto.yaml found (searched from "${searched}"` +
        (boundary ? `, bounded at "${boundary}"` : "") +
        `).`,
    );
    return;
  }

  let bin: string;
  try {
    ({ path: bin } = await resolveBinary());
  } catch (err) {
    if (err instanceof QuartoNotFound) {
      const choice = await vscode.window.showErrorMessage(
        "Quarto was not found. Install the Quarto CLI, or set " +
          '"quarto.path" to its location.',
        "Open Settings",
      );
      if (choice === "Open Settings") {
        void vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "quarto.path",
        );
      }
      return;
    }
    throw err;
  }

  await runRenderProject(channel, bin, root);
}

interface StartAndBoundary {
  /** Directory to begin the ancestor walk from. */
  start: string;
  /** Bound the walk (inclusive) here; `null` = unbounded to the filesystem root. */
  boundary: string | null;
  /** What to name in an error message when no root is found. */
  searched: string;
}

/**
 * Tier A: a real, on-disk active editor. Tier B: no usable active editor —
 * branch on `workspace.workspaceFolders` (none → null; one → that folder;
 * many → `showWorkspaceFolderPick`, `"cancelled"` if the user dismisses it).
 * Plan §2.3.
 */
async function resolveStartAndBoundary(): Promise<
  StartAndBoundary | "cancelled" | null
> {
  const editor = vscode.window.activeTextEditor;
  if (editor && editor.document.uri.scheme === "file") {
    const uri = editor.document.uri;
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    return {
      start: path.dirname(uri.fsPath),
      boundary: folder ? folder.uri.fsPath : null,
      searched: uri.fsPath,
    };
  }

  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return null;
  }
  if (folders.length === 1) {
    const folderPath = folders[0].uri.fsPath;
    return { start: folderPath, boundary: folderPath, searched: folderPath };
  }

  const picked = await vscode.window.showWorkspaceFolderPick();
  if (!picked) {
    return "cancelled";
  }
  const folderPath = picked.uri.fsPath;
  return { start: folderPath, boundary: folderPath, searched: folderPath };
}

/**
 * Spawn `quarto render <root>` with `cwd` PINNED to `root` (Dragon D1 — never
 * inherited or left at the extension host's own cwd). Mirrors `render.ts`'s
 * `runRender` (R3) in shape.
 */
function runRenderProject(
  channel: vscode.OutputChannel,
  bin: string,
  root: string,
): Promise<void> {
  const args = buildRenderProjectArgs(root);

  channel.clear();
  channel.show(true);
  channel.appendLine(`> ${bin} ${args.join(" ")}`);

  return new Promise<void>((resolve) => {
    let collected = "";
    const child = spawn(bin, args, { cwd: root });

    const onData = (data: Buffer): void => {
      const text = data.toString();
      collected += text;
      channel.append(text);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);

    child.on("error", (err) => {
      channel.appendLine(`\nQuarto render (project) failed to start: ${String(err)}`);
      void vscode.window.showErrorMessage(
        `Quarto render (project) failed to start: ${err.message}`,
      );
      resolve();
    });

    child.on("close", (code) => {
      if (code === 0) {
        const reported = parseOutputPath(collected);
        // Resolve against `root` (cwd), NOT the extension host's own cwd —
        // Quarto's reported path is relative to the target project directory
        // regardless of the spawning process's actual cwd (Dragon D1).
        const output = reported ? path.resolve(root, reported) : undefined;
        channel.appendLine(
          output
            ? `\nProject render complete: ${output}`
            : "\nProject render complete.",
        );
        void showSuccess(output);
      } else {
        channel.appendLine(
          `\nProject render failed (exit code ${code ?? "unknown"}).`,
        );
        void vscode.window.showErrorMessage(
          `Quarto render (project) failed (exit ${code ?? "unknown"}). ` +
            `See the "${CHANNEL_NAME}" output for details.`,
        );
      }
      resolve();
    });
  });
}

/** Notify on success, offering to open the produced (primary) artifact. */
async function showSuccess(output: string | undefined): Promise<void> {
  if (!output) {
    void vscode.window.showInformationMessage("Quarto project render complete.");
    return;
  }
  const choice = await vscode.window.showInformationMessage(
    `Quarto project render complete: ${path.basename(output)}`,
    "Open",
  );
  if (choice === "Open") {
    void vscode.env.openExternal(vscode.Uri.file(output));
  }
}
