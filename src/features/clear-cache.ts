/**
 * `Quarto: Clear Cache...` (CHANGELOG: quick declarative wins bundle, Sessions 76-78(d)).
 *
 * Thin `vscode` adapter over the CLI: spawns `quarto render <file>
 * --cache-refresh`, the documented way to force-refresh a document's
 * Jupyter/Knitr execution cache (there is no CLI flag to purge the cache
 * WITHOUT also rendering). Mirrors `render.ts`'s Output-channel + graceful
 * degradation pattern (CLI absent, non-zero exit) rather than duplicating a
 * shared abstraction for a single reuse site.
 */

import { spawn } from "node:child_process";
import * as path from "node:path";
import * as vscode from "vscode";
import { buildCacheRefreshArgs } from "../core/render-args";
import { QuartoNotFound, resolveBinary } from "../quarto/cli";

const CHANNEL_NAME = "Quarto Clear Cache";

export function registerClearCacheFeature(
  context: vscode.ExtensionContext,
): void {
  const channel = vscode.window.createOutputChannel(CHANNEL_NAME);
  context.subscriptions.push(
    channel,
    vscode.commands.registerCommand("quarto.clearCache", () =>
      clearCacheForActiveDocument(channel),
    ),
  );
}

async function clearCacheForActiveDocument(
  channel: vscode.OutputChannel,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "quarto") {
    void vscode.window.showErrorMessage(
      "Quarto: open a Quarto (.qmd) document to clear its cache.",
    );
    return;
  }

  const doc = editor.document;
  if (doc.isDirty) {
    await doc.save();
  }
  const file = doc.uri.fsPath;

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

  await runCacheRefresh(channel, bin, file);
}

function runCacheRefresh(
  channel: vscode.OutputChannel,
  bin: string,
  file: string,
): Promise<void> {
  const args = buildCacheRefreshArgs(file);
  const cwd = path.dirname(file);

  channel.clear();
  channel.show(true);
  channel.appendLine(`> ${bin} ${args.join(" ")}`);

  return new Promise<void>((resolve) => {
    const child = spawn(bin, args, { cwd });

    const onData = (data: Buffer): void => {
      channel.append(data.toString());
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);

    child.on("error", (err) => {
      channel.appendLine(`\nQuarto clear cache failed to start: ${String(err)}`);
      void vscode.window.showErrorMessage(
        `Quarto clear cache failed to start: ${err.message}`,
      );
      resolve();
    });

    child.on("close", (code) => {
      if (code === 0) {
        channel.appendLine("\nCache refreshed.");
        void vscode.window.showInformationMessage("Quarto: cache refreshed.");
      } else {
        channel.appendLine(
          `\nClear cache failed (exit code ${code ?? "unknown"}).`,
        );
        void vscode.window.showErrorMessage(
          `Quarto clear cache failed (exit ${code ?? "unknown"}). ` +
            `See the "${CHANNEL_NAME}" output for details.`,
        );
      }
      resolve();
    });
  });
}
