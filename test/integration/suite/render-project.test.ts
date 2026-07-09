import * as assert from "node:assert";
import { existsSync, rmSync } from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const PROJECT_ROOT = path.resolve(ROOT, "test/fixtures/project");
const CHAPTER_QMD = path.resolve(PROJECT_ROOT, "chapters/chapter1.qmd");
const INDEX_HTML = path.resolve(PROJECT_ROOT, "index.html");
const INDEX_FILES = path.resolve(PROJECT_ROOT, "index_files");
const CHAPTER_HTML = path.resolve(PROJECT_ROOT, "chapters/chapter1.html");
const CHAPTER_FILES = path.resolve(PROJECT_ROOT, "chapters/chapter1_files");
const QUARTO_CACHE = path.resolve(PROJECT_ROOT, ".quarto");
// Quarto auto-generates this on first render if none exists — a render
// artifact, not authored fixture content (see .gitignore).
const GENERATED_GITIGNORE = path.resolve(PROJECT_ROOT, ".gitignore");
// No _quarto.yml/_quarto.yaml exists anywhere above this fixture (or this
// repo at all) — a real, unbounded "outside any project" case.
const OUTSIDE_PROJECT = path.resolve(ROOT, "test/fixtures/sample.qmd");

/** Open a fixture and make it the active editor (render targets the active doc). */
async function openActive(file: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(file);
  await vscode.window.showTextDocument(doc);
  assert.strictEqual(
    vscode.window.activeTextEditor?.document.uri.fsPath,
    file,
    "fixture should be the active editor",
  );
}

function cleanRenderArtifacts(): void {
  rmSync(INDEX_HTML, { force: true });
  rmSync(INDEX_FILES, { recursive: true, force: true });
  rmSync(CHAPTER_HTML, { force: true });
  rmSync(CHAPTER_FILES, { recursive: true, force: true });
  rmSync(QUARTO_CACHE, { recursive: true, force: true });
  rmSync(GENERATED_GITIGNORE, { force: true });
}

describe("Quarto: Render Project command", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(() => {
    // Render artifacts are gitignored, but keep the tree clean between runs.
    cleanRenderArtifacts();
  });

  it("registers the quarto.renderProject command", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("quarto.renderProject"),
      "quarto.renderProject should be registered after activation",
    );
  });

  it("renders the WHOLE project from a nested active file, not just that file (plan §0/§7 D2 discriminator)", async () => {
    cleanRenderArtifacts();
    await openActive(CHAPTER_QMD);

    // The handler resolves when the child process closes, so awaiting the
    // command waits for the render to finish.
    await vscode.commands.executeCommand("quarto.renderProject");

    assert.ok(
      existsSync(CHAPTER_HTML),
      "the active file's own output should exist",
    );
    assert.ok(
      existsSync(INDEX_HTML),
      "index.html should ALSO be produced — proves a whole-project render, " +
        "not the partial/subdirectory-only render a bare `quarto render` " +
        "(no explicit root argument) would silently produce for this exact " +
        "scenario (an active file nested below the true project root)",
    );
  });

  it("resolves the success 'Open' path against the project root, not the extension host's own cwd (Dragon D1)", async () => {
    cleanRenderArtifacts();
    await openActive(CHAPTER_QMD);

    const windowAny = vscode.window as unknown as Record<string, unknown>;
    const envAny = vscode.env as unknown as Record<string, unknown>;
    const originalShowInfo = windowAny.showInformationMessage;
    const originalOpenExternal = envAny.openExternal;
    let openedUri: vscode.Uri | undefined;

    windowAny.showInformationMessage = () => Promise.resolve("Open");
    envAny.openExternal = (uri: vscode.Uri) => {
      openedUri = uri;
      return Promise.resolve(true);
    };

    try {
      await vscode.commands.executeCommand("quarto.renderProject");
    } finally {
      windowAny.showInformationMessage = originalShowInfo;
      envAny.openExternal = originalOpenExternal;
    }

    assert.ok(openedUri, "the success dialog's Open action should have fired");
    assert.strictEqual(
      openedUri?.fsPath,
      INDEX_HTML,
      "the resolved 'Open' path must be the project root's index.html — a cwd " +
        "mistake (Dragon D1) would resolve it against the extension host's " +
        "own cwd instead, producing a nonexistent or wrong path",
    );
  });

  it("shows a clear error, never a crash, when invoked outside any project", async () => {
    await openActive(OUTSIDE_PROJECT);

    await assert.doesNotReject(
      () =>
        Promise.resolve(
          vscode.commands.executeCommand("quarto.renderProject"),
        ),
      "invoking with no discoverable project must not crash the extension host",
    );
  });
});
