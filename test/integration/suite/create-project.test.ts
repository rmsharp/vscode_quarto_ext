import * as assert from "node:assert";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

/** Stub `showQuickPick` to resolve to `value`, restoring the original in `finally`. */
async function withStubbedQuickPick<T>(
  value: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const windowAny = vscode.window as unknown as Record<string, unknown>;
  const original = windowAny.showQuickPick;
  windowAny.showQuickPick = () => Promise.resolve(value);
  try {
    return await fn();
  } finally {
    windowAny.showQuickPick = original;
  }
}

/** Stub `showOpenDialog` to resolve to `uris`, restoring the original in `finally`. */
async function withStubbedOpenDialog<T>(
  uris: vscode.Uri[] | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const windowAny = vscode.window as unknown as Record<string, unknown>;
  const original = windowAny.showOpenDialog;
  windowAny.showOpenDialog = () => Promise.resolve(uris);
  try {
    return await fn();
  } finally {
    windowAny.showOpenDialog = original;
  }
}

/** Stub `showInputBox` to resolve to `value`, restoring the original in `finally`. */
async function withStubbedInputBox<T>(
  value: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const windowAny = vscode.window as unknown as Record<string, unknown>;
  const original = windowAny.showInputBox;
  windowAny.showInputBox = () => Promise.resolve(value);
  try {
    return await fn();
  } finally {
    windowAny.showInputBox = original;
  }
}

/**
 * Intercept `vscode.commands.executeCommand("vscode.openFolder", ...)` rather
 * than letting it actually fire — a real invocation reloads the Extension
 * Development Host window, which would abort the test run mid-suite. Every
 * other command name is delegated to the real implementation, unchanged —
 * including the `quarto.createProject` invocation `fn` itself makes, which
 * flows straight through to the genuine registered command.
 */
async function withInterceptedOpenFolder<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; openedUri: vscode.Uri | undefined }> {
  const commandsAny = vscode.commands as unknown as Record<string, unknown>;
  const original = commandsAny.executeCommand as (
    command: string,
    ...rest: unknown[]
  ) => Thenable<unknown>;
  let openedUri: vscode.Uri | undefined;
  commandsAny.executeCommand = (command: string, ...rest: unknown[]) => {
    if (command === "vscode.openFolder") {
      openedUri = rest[0] as vscode.Uri;
      return Promise.resolve(undefined);
    }
    return original(command, ...rest);
  };
  try {
    const result = await fn();
    return { result, openedUri };
  } finally {
    commandsAny.executeCommand = original;
  }
}

describe("Quarto: Create Project command", () => {
  let parentDir: string;

  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  beforeEach(() => {
    // A fresh OS temp directory per test (never a test/fixtures-relative
    // path) — this command's whole job is writing brand-new files to a
    // location the user picks at runtime, so there is no fixed fixture to
    // point it at (plan docs/planning/2026-07-09-onboarding-walkthrough-
    // plan.md §3.2 Finding 4 / §5 D2).
    parentDir = mkdtempSync(path.join(os.tmpdir(), "quarto-ext-createproject-"));
  });

  afterEach(() => {
    // Unconditional — even on assertion failure (plan §5 D2).
    rmSync(parentDir, { recursive: true, force: true });
  });

  it("registers the quarto.createProject command", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("quarto.createProject"),
      "quarto.createProject should be registered after activation",
    );
  });

  it("creates a real default-type project via the CLI and opens it as the workspace", async () => {
    const targetDir = path.join(parentDir, "my-new-project");

    const { openedUri } = await withStubbedQuickPick("Default", () =>
      withStubbedOpenDialog([vscode.Uri.file(parentDir)], () =>
        withStubbedInputBox("my-new-project", () =>
          withInterceptedOpenFolder(() =>
            Promise.resolve(
              vscode.commands.executeCommand("quarto.createProject"),
            ),
          ),
        ),
      ),
    );

    assert.ok(
      existsSync(path.join(targetDir, "_quarto.yml")),
      "_quarto.yml should have been created by the real CLI",
    );
    assert.strictEqual(
      openedUri?.fsPath,
      targetDir,
      "the new project directory should be opened as the workspace",
    );
  });

  it("aborts quietly (no crash, no project created, no openFolder) when the type pick is cancelled", async () => {
    const targetDir = path.join(parentDir, "cancelled-project");

    const { openedUri } = await withStubbedQuickPick(undefined, () =>
      withStubbedOpenDialog([vscode.Uri.file(parentDir)], () =>
        withStubbedInputBox("cancelled-project", () =>
          withInterceptedOpenFolder(() =>
            Promise.resolve(
              vscode.commands.executeCommand("quarto.createProject"),
            ),
          ),
        ),
      ),
    );

    assert.strictEqual(
      openedUri,
      undefined,
      "vscode.openFolder should never be invoked on cancellation",
    );
    assert.ok(
      !existsSync(targetDir),
      "no project directory should be created on cancellation",
    );
  });
});
