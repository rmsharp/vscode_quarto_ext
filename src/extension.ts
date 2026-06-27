/**
 * Extension entry point — intentionally thin (plan §3.3).
 *
 * `activate`/`deactivate` only wire features and providers; all real logic
 * lives in `core/` (pure) and the feature/adapter modules. Phase 1 wires a
 * single command, `Quarto: Verify Installation`.
 */

import * as vscode from "vscode";
import { meetsMinimum, MINIMUM_QUARTO_VERSION } from "./core/version";
import { QuartoNotFound, resolveBinary } from "./quarto/cli";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "quarto.verifyInstallation",
      verifyInstallation,
    ),
  );
}

/**
 * Resolve the Quarto CLI and report its version, or surface an actionable error
 * when it cannot be found (graceful degradation — never crash).
 */
async function verifyInstallation(): Promise<void> {
  try {
    const { path, version } = await resolveBinary();
    if (meetsMinimum(version)) {
      void vscode.window.showInformationMessage(
        `Quarto ${version} found (${path}).`,
      );
    } else {
      void vscode.window.showWarningMessage(
        `Quarto ${version} found (${path}), but ${MINIMUM_QUARTO_VERSION} ` +
          `or newer is recommended.`,
      );
    }
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
    } else {
      void vscode.window.showErrorMessage(
        `Quarto: unexpected error verifying installation: ${String(err)}`,
      );
    }
  }
}

export function deactivate(): void {
  // No-op for Phase 1. Later phases (e.g. Preview) own process lifecycle here.
}
