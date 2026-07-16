import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

/**
 * Entry point for the integration test run. `@vscode/test-electron` downloads
 * its own VS Code (no `code` CLI needed) and launches an Extension Development
 * Host pointed at this project, then runs the Mocha suite in `suite/index`.
 *
 * Compiled by `tsconfig.test.json` to `out/test/integration/runTest.js`, so the
 * paths below are resolved relative to that location.
 */
async function main(): Promise<void> {
  try {
    // out/test/integration -> project root
    const extensionDevelopmentPath = path.resolve(__dirname, "../../../");
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");
    // Opens `test/fixtures/project` (index.qmd + chapters/chapter1.qmd) as the
    // workspace folder so `vscode.workspace.findFiles` — the workspace symbol
    // provider's own `**/*.qmd` search — has a real folder to search
    // (`workspace-symbols.test.ts`). Every other suite opens fixtures by
    // absolute path and does not read `workspace.workspaceFolders`, except
    // `render-project.test.ts`'s Tier B `resolveStartAndBoundary`, which is
    // unaffected: its own active-editor fixtures either sit inside this exact
    // folder (finding the identical `_quarto.yml` root whether the walk is
    // bounded here or unbounded) or outside it entirely (`sample.qmd`, where
    // `getWorkspaceFolder` still returns `undefined`).
    const workspacePath = path.resolve(
      extensionDevelopmentPath,
      "test/fixtures/project",
    );
    await runTests({
      // Pin the Extension Development Host's VS Code to a fixed version. Left
      // unpinned, `@vscode/test-electron` floats to the latest stable, so a VS
      // Code release can silently change the built-in tokenizer/language-service
      // surface these tests observe and make "did the editor change, or did we?"
      // unanswerable (Session 96, BACKLOG:119). Bump this deliberately — and
      // re-run the suite — when adopting a newer VS Code baseline.
      version: "1.129.0",
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [workspacePath],
    });
  } catch (err) {
    console.error("Failed to run integration tests:", err);
    process.exit(1);
  }
}

void main();
