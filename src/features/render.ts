/**
 * `Quarto: Render` (plan §6 Phase 3).
 *
 * Thin `vscode` adapter over the CLI: it spawns `quarto render <file>`, streams
 * stdout/stderr to a dedicated Output channel, and reports the output path on
 * success or surfaces the error verbatim on failure — degrading gracefully when
 * the CLI is absent (plan §9). All non-`vscode` logic (arg-building, output-path
 * parsing) lives in `core/render-args` so it stays unit-testable headlessly.
 */

import { spawn } from "node:child_process";
import * as path from "node:path";
import * as vscode from "vscode";
import { buildRenderArgs, parseOutputPath } from "../core/render-args";
import { QuartoNotFound, resolveBinary } from "../quarto/cli";

const CHANNEL_NAME = "Quarto Render";

/**
 * Create the Output channel, register the `quarto.render` command, and tie both
 * to the extension lifetime via `context.subscriptions` (the channel is
 * disposed on deactivate).
 */
export function registerRenderFeature(
  context: vscode.ExtensionContext,
): void {
  const channel = vscode.window.createOutputChannel(CHANNEL_NAME);
  context.subscriptions.push(
    channel,
    vscode.commands.registerCommand("quarto.render", () =>
      renderActiveDocument(channel),
    ),
  );
}

/**
 * Render the active editor's Quarto document. Requires a `.qmd` (languageId
 * `quarto`) in the active editor; saves unsaved edits first (render reads from
 * disk), then resolves the CLI and runs it.
 */
async function renderActiveDocument(
  channel: vscode.OutputChannel,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "quarto") {
    void vscode.window.showErrorMessage(
      "Quarto: open a Quarto (.qmd) document to render.",
    );
    return;
  }

  const doc = editor.document;
  if (doc.isDirty) {
    await doc.save();
  }
  const file = doc.uri.fsPath;

  // Fail soft when the CLI is missing or too old to identify (plan §9).
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

  await runRender(channel, bin, file);
}

/**
 * Spawn `quarto render <file>`, streaming both streams verbatim to `channel`.
 * Success/failure is keyed off the exit code (Quarto writes progress, the
 * `Output created:` marker, AND errors all to STDERR — verified live). The
 * returned promise resolves when the child closes, so callers (and the
 * integration test) can await render completion.
 */
function runRender(
  channel: vscode.OutputChannel,
  bin: string,
  file: string,
): Promise<void> {
  const args = buildRenderArgs(file);
  const cwd = path.dirname(file);

  channel.clear();
  channel.show(true);
  channel.appendLine(`> ${bin} ${args.join(" ")}`);

  return new Promise<void>((resolve) => {
    let collected = "";
    const child = spawn(bin, args, { cwd });

    const onData = (data: Buffer): void => {
      const text = data.toString();
      collected += text;
      channel.append(text);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);

    // e.g. ENOENT if the binary disappears between resolve and spawn.
    child.on("error", (err) => {
      channel.appendLine(`\nQuarto render failed to start: ${String(err)}`);
      void vscode.window.showErrorMessage(
        `Quarto render failed to start: ${err.message}`,
      );
      resolve();
    });

    child.on("close", (code) => {
      if (code === 0) {
        const reported = parseOutputPath(collected);
        const output = reported ? path.resolve(cwd, reported) : undefined;
        channel.appendLine(
          output ? `\nRender complete: ${output}` : "\nRender complete.",
        );
        void showSuccess(output);
      } else {
        channel.appendLine(`\nRender failed (exit code ${code ?? "unknown"}).`);
        void vscode.window.showErrorMessage(
          `Quarto render failed (exit ${code ?? "unknown"}). ` +
            `See the "${CHANNEL_NAME}" output for details.`,
        );
      }
      resolve();
    });
  });
}

/** Notify on success, offering to open the produced artifact. */
async function showSuccess(output: string | undefined): Promise<void> {
  if (!output) {
    void vscode.window.showInformationMessage("Quarto render complete.");
    return;
  }
  const choice = await vscode.window.showInformationMessage(
    `Quarto render complete: ${path.basename(output)}`,
    "Open",
  );
  if (choice === "Open") {
    void vscode.env.openExternal(vscode.Uri.file(output));
  }
}
