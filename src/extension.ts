/**
 * Extension entry point — intentionally thin (plan §3.3).
 *
 * `activate`/`deactivate` only wire features and providers; all real logic
 * lives in `core/` (pure) and the feature/adapter modules. Phase 1 wires a
 * single command, `Quarto: Verify Installation`.
 */

import * as vscode from "vscode";
import { meetsMinimum, MINIMUM_QUARTO_VERSION } from "./core/version";
import { registerDiagramPreviewFeature } from "./features/diagram-preview";
import { registerEmbeddedLanguageFeature } from "./providers/embedded";
import { registerExecutionFeature } from "./features/execution";
import { registerFormattingFeature } from "./features/formatting";
import { registerMathPreviewFeature } from "./features/math-preview";
import { disposeAllPreviews, registerPreviewFeature } from "./features/preview";
import { registerRenderFeature } from "./features/render";
import { registerCitationProviders } from "./providers/citation";
import { registerCrossrefProviders } from "./providers/crossref";
import { registerOutlineProvider } from "./providers/outline";
import { registerYamlCompletionProvider } from "./providers/yaml";
import { QuartoNotFound, resolveBinary } from "./quarto/cli";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "quarto.verifyInstallation",
      verifyInstallation,
    ),
  );
  registerRenderFeature(context);
  registerPreviewFeature(context);
  registerExecutionFeature(context);
  registerFormattingFeature(context);
  registerMathPreviewFeature(context);
  registerDiagramPreviewFeature(context);
  registerOutlineProvider(context);
  registerCrossrefProviders(context);
  registerCitationProviders(context);
  registerYamlCompletionProvider(context);
  registerEmbeddedLanguageFeature(context);
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
  // Own the preview process lifecycle: reap every live `quarto preview` server
  // (and its deno worker) so none orphan when the extension unloads. The
  // PreviewManager is also a registered subscription, so this is belt-and-
  // suspenders against the host disposing subscriptions in a different order.
  disposeAllPreviews();
}
