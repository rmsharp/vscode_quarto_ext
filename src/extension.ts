/**
 * Extension entry point — intentionally thin (plan §3.3).
 *
 * `activate`/`deactivate` only wire features and providers; all real logic
 * lives in `core/` (pure) and the feature/adapter modules. Phase 1 wires a
 * single command, `Quarto: Verify Installation`.
 */

import * as vscode from "vscode";
import { meetsMinimum, MINIMUM_QUARTO_VERSION } from "./core/version";
import { registerClearCacheFeature } from "./features/clear-cache";
import { registerConvertNotebookFeature } from "./features/convert-notebook";
import { registerCreateProjectFeature } from "./features/create-project";
import { registerDiagramPreviewFeature } from "./features/diagram-preview";
import { disposeAllVdocs, sweepStaleVdocs } from "./features/embedded-vdoc";
import { registerEmbeddedLanguageFeature } from "./providers/embedded";
import { registerExecutionFeature } from "./features/execution";
import { registerFormatCellFeature } from "./features/format-cell";
import { registerFormattingFeature } from "./features/formatting";
import { registerImagePasteFeature } from "./providers/image-paste";
import { registerMathPreviewFeature } from "./features/math-preview";
import { registerNewDocumentFeature } from "./features/new-document";
import { disposeAllPreviews, registerPreviewFeature } from "./features/preview";
import { registerRenderFeature } from "./features/render";
import { registerRenderProjectFeature } from "./features/render-project";
import { registerCitationProviders } from "./providers/citation";
import { registerCrossrefProviders } from "./providers/crossref";
import { registerQuartoYamlDocumentLinksFeature } from "./providers/document-links";
import { registerFilepathCompletionFeature } from "./providers/filepath-completion";
import { registerOutlineProvider } from "./providers/outline";
import { registerYamlCompletionProvider } from "./providers/yaml";
import { registerYamlDiagnosticsFeature } from "./features/yaml-diagnostics";
import { registerWorkspaceSymbolsProvider } from "./providers/workspace-symbols";
import { QuartoNotFound, resolveBinary } from "./quarto/cli";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "quarto.verifyInstallation",
      verifyInstallation,
    ),
  );
  registerRenderFeature(context);
  registerRenderProjectFeature(context);
  registerClearCacheFeature(context);
  registerNewDocumentFeature(context);
  registerCreateProjectFeature(context);
  registerConvertNotebookFeature(context);
  registerPreviewFeature(context);
  registerExecutionFeature(context);
  registerFormatCellFeature(context);
  registerFormattingFeature(context);
  registerMathPreviewFeature(context);
  registerDiagramPreviewFeature(context);
  registerOutlineProvider(context);
  registerWorkspaceSymbolsProvider(context);
  registerImagePasteFeature(context);
  registerCrossrefProviders(context);
  registerCitationProviders(context);
  registerYamlCompletionProvider(context);
  registerYamlDiagnosticsFeature(context);
  registerEmbeddedLanguageFeature(context);
  registerQuartoYamlDocumentLinksFeature(context);
  registerFilepathCompletionFeature(context);

  // Embedded-language virtual documents are real files under `.quarto/vdoc-mit/`, so a
  // host that crashed (or was killed) leaves some behind. Clean them at startup. Scoped
  // to our own directory and our own filenames — it never walks the user's tree, and it
  // never touches Posit's `.quarto/vdoc/`. Fire-and-forget: a failed sweep must not
  // delay or block activation.
  void sweepStaleVdocs(vscode.workspace.workspaceFolders ?? []);
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
  // Likewise own the vdoc lifecycle: these are real files in the user's workspace, and
  // leaving them behind would mean the next session's sweep has to clean up after a
  // clean shutdown. (The sweep is the backstop for a CRASH, not the normal path.)
  void disposeAllVdocs();
}
