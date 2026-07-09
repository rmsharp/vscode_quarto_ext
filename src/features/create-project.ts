/**
 * `Quarto: Create Project` (plan
 * `docs/planning/2026-07-09-onboarding-walkthrough-plan.md` §3 Track B).
 *
 * Thin `vscode` adapter: three sequential prompts (type / parent folder /
 * name) → resolve the Quarto binary (reusing `render-project.ts`'s
 * `QuartoNotFound` branch) → spawn the real CLI via the pure
 * `core/create-project-args.ts` `buildCreateProjectArgs` → on success, open
 * the new project as the workspace. Any cancellation at any of the three
 * prompts aborts quietly — no error message, matching `renderProject`'s
 * cancellation convention (there is nothing destructive to cancel out of).
 */

import { spawn } from "node:child_process";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  buildCreateProjectArgs,
  ProjectType,
} from "../core/create-project-args";
import { QuartoNotFound, resolveBinary } from "../quarto/cli";

const CHANNEL_NAME = "Quarto Create Project";

/** Quick-pick labels, mapped to the CLI's lowercase `--type` values. */
const PROJECT_TYPES: { label: string; type: ProjectType }[] = [
  { label: "Default", type: "default" },
  { label: "Website", type: "website" },
  { label: "Book", type: "book" },
  { label: "Manuscript", type: "manuscript" },
];

export function registerCreateProjectFeature(
  context: vscode.ExtensionContext,
): void {
  const channel = vscode.window.createOutputChannel(CHANNEL_NAME);
  context.subscriptions.push(
    channel,
    vscode.commands.registerCommand("quarto.createProject", () =>
      createProject(channel),
    ),
  );
}

async function createProject(channel: vscode.OutputChannel): Promise<void> {
  const picked = await vscode.window.showQuickPick(
    PROJECT_TYPES.map((t) => t.label),
    { placeHolder: "Project type" },
  );
  if (!picked) {
    return;
  }
  const type = PROJECT_TYPES.find((t) => t.label === picked)!.type;

  const parentUris = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    openLabel: "Select Parent Folder",
  });
  if (!parentUris || parentUris.length === 0) {
    return;
  }
  const parentDir = parentUris[0].fsPath;

  const name = await vscode.window.showInputBox({
    prompt: "Project folder name",
  });
  if (!name) {
    return;
  }

  const targetDir = path.join(parentDir, name);

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

  await runCreateProject(channel, bin, targetDir, type, name);
}

/**
 * Spawn `quarto create-project <targetDir> --type <type> --title <title>`
 * (the legacy, non-prompting CLI alias — plan §0 Finding 2). On success, open
 * the new project directory as the workspace (matches Posit's own confirmed
 * behavior, plan §0 Finding 6). Mirrors `render-project.ts`'s
 * `runRenderProject` (R2) in shape.
 */
function runCreateProject(
  channel: vscode.OutputChannel,
  bin: string,
  targetDir: string,
  type: ProjectType,
  title: string,
): Promise<void> {
  const args = buildCreateProjectArgs(targetDir, type, title);

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
      channel.appendLine(`\nQuarto create-project failed to start: ${String(err)}`);
      void vscode.window.showErrorMessage(
        `Quarto create-project failed to start: ${err.message}`,
      );
      resolve();
    });

    child.on("close", (code) => {
      if (code === 0) {
        channel.appendLine(`\nProject created: ${targetDir}`);
        void vscode.commands.executeCommand(
          "vscode.openFolder",
          vscode.Uri.file(targetDir),
        );
      } else {
        channel.appendLine(
          `\nProject creation failed (exit code ${code ?? "unknown"}).`,
        );
        void vscode.window.showErrorMessage(
          `Quarto create-project failed (exit ${code ?? "unknown"}). ` +
            `See the "${CHANNEL_NAME}" output for details.`,
        );
      }
      resolve();
    });
  });
}
