/**
 * `Quarto: Convert to .ipynb` / `Quarto: Convert to .qmd` (plan
 * `docs/planning/2026-07-10-notebook-conversion-plan.md`, Option B — two
 * Posit-mirroring commands per operator decision).
 *
 * Thin `vscode` adapter: resolve the active source (a `.qmd` `TextEditor`
 * for the toIpynb direction, a `.ipynb` `NotebookEditor` for the toQmd
 * direction) → save if dirty → derive the output path → confirm overwrite
 * if it already exists (modal, this project's first) → resolve the CLI →
 * spawn `quarto convert` via the pure `core/convert-args.ts` → on success,
 * open the result with the API matching its kind.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  buildConvertArgs,
  ConvertDirection,
  deriveConvertOutputPath,
  inferConvertDirection,
} from "../core/convert-args";
import { QuartoNotFound, resolveBinary } from "../quarto/cli";

const CHANNEL_NAME = "Quarto Convert";

export function registerConvertNotebookFeature(
  context: vscode.ExtensionContext,
): void {
  const channel = vscode.window.createOutputChannel(CHANNEL_NAME);
  context.subscriptions.push(
    channel,
    vscode.commands.registerCommand("quarto.convertToIpynb", () =>
      convertToIpynb(channel),
    ),
    vscode.commands.registerCommand("quarto.convertToQmd", () =>
      convertToQmd(channel),
    ),
  );
}

async function convertToIpynb(channel: vscode.OutputChannel): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "quarto") {
    void vscode.window.showErrorMessage(
      "Quarto: open a Quarto (.qmd) document to convert it to .ipynb.",
    );
    return;
  }
  const doc = editor.document;
  if (doc.isDirty) {
    await doc.save();
  }
  await convertDocument(channel, doc.uri.fsPath);
}

async function convertToQmd(channel: vscode.OutputChannel): Promise<void> {
  const notebook = vscode.window.activeNotebookEditor?.notebook;
  if (!notebook || notebook.notebookType !== "jupyter-notebook") {
    void vscode.window.showErrorMessage(
      "Quarto: open a Jupyter (.ipynb) notebook to convert it to .qmd.",
    );
    return;
  }
  if (notebook.isDirty) {
    await notebook.save();
  }
  await convertDocument(channel, notebook.uri.fsPath);
}

/**
 * Shared tail of both directions: derive the output path, guard against a
 * silent overwrite (the bare CLI does not — plan §0.1/§0.4), resolve the
 * CLI, then spawn.
 */
async function convertDocument(
  channel: vscode.OutputChannel,
  inputPath: string,
): Promise<void> {
  const direction = inferConvertDirection(inputPath);
  if (!direction) {
    void vscode.window.showErrorMessage(
      "Quarto: the active document must be a saved .qmd or .ipynb file to convert it.",
    );
    return;
  }

  const outputPath = deriveConvertOutputPath(inputPath, direction);
  if (existsSync(outputPath)) {
    const choice = await vscode.window.showWarningMessage(
      `"${path.basename(outputPath)}" already exists. Overwrite it?`,
      { modal: true },
      "Overwrite",
    );
    if (choice !== "Overwrite") {
      return;
    }
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

  await runConvert(channel, bin, inputPath, outputPath, direction);
}

/**
 * Spawn `quarto convert <input> --output <output>`, streaming both streams
 * verbatim to `channel`. Every CLI error path dumps a raw stack trace to
 * stderr (plan §0.1) — on failure, synthesize a message rather than surface
 * that raw text in a modal.
 */
function runConvert(
  channel: vscode.OutputChannel,
  bin: string,
  inputPath: string,
  outputPath: string,
  direction: ConvertDirection,
): Promise<void> {
  const args = buildConvertArgs(inputPath, outputPath);

  channel.clear();
  channel.show(true);
  channel.appendLine(`> ${bin} ${args.join(" ")}`);

  return new Promise<void>((resolve) => {
    const child = spawn(bin, args);

    const onData = (data: Buffer): void => {
      channel.append(data.toString());
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);

    child.on("error", (err) => {
      channel.appendLine(`\nQuarto convert failed to start: ${String(err)}`);
      void vscode.window.showErrorMessage(
        `Quarto convert failed to start: ${err.message}`,
      );
      resolve();
    });

    child.on("close", (code) => {
      if (code === 0) {
        channel.appendLine(`\nConverted: ${outputPath}`);
        void openResult(outputPath, direction).then(resolve);
      } else {
        channel.appendLine(
          `\nQuarto convert failed (exit code ${code ?? "unknown"}).`,
        );
        void vscode.window.showErrorMessage(
          `Quarto convert failed (exit ${code ?? "unknown"}). ` +
            `See the "${CHANNEL_NAME}" output for details.`,
        );
        resolve();
      }
    });
  });
}

/**
 * Open the converted file with the API matching its kind — a `.ipynb`
 * output is a `NotebookDocument`, never a `TextDocument` (plan §0.3/§4).
 */
async function openResult(
  outputPath: string,
  direction: ConvertDirection,
): Promise<void> {
  const uri = vscode.Uri.file(outputPath);
  if (direction === "toIpynb") {
    const notebook = await vscode.workspace.openNotebookDocument(uri);
    await vscode.window.showNotebookDocument(notebook);
  } else {
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
  }
}
