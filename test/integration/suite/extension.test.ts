import * as assert from "node:assert";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

describe("Extension activation", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  it("registers the quarto.verifyInstallation command", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("quarto.verifyInstallation"),
      "quarto.verifyInstallation should be registered after activation",
    );
  });

  it("executes quarto.verifyInstallation without throwing", async () => {
    // End-to-end through the real handler: command -> resolveBinary() spawns
    // the actual `quarto` CLI (present on PATH in the test host) -> message.
    // A thrown/unhandled error here would reject and fail the test.
    await vscode.commands.executeCommand("quarto.verifyInstallation");
  });
});
