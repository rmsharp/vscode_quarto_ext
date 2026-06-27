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
    await runTests({ extensionDevelopmentPath, extensionTestsPath });
  } catch (err) {
    console.error("Failed to run integration tests:", err);
    process.exit(1);
  }
}

void main();
