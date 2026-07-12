import * as assert from "node:assert";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { isRenderScript } from "../../../src/core/render-script";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");

/**
 * ACCEPT-path fixture: a knitr *spin* script (`#' ---` … `#' ---`). Deliberately
 * NOT a Jupyter percent script — the knitr engine needs no Jupyter kernel, so
 * this gives the accept path a REAL, successful `quarto preview` round-trip
 * (verified firsthand: "Output created" + "Browse at http://localhost:…").
 *
 * ⚠ Requires R + knitr in the test environment (present on the dev machine;
 * a CI runner must install them). A jupyter-percent script could not do this —
 * without a kernel it fast-fails, so only the gate could be asserted, not a
 * successful preview.
 */
const SPIN = path.resolve(ROOT, "test/fixtures/render-script-spin.R");

/**
 * REJECT-path fixture: ordinary Python with percent CODE cells but no leading
 * markdown/raw cell. It also contains the literal substring `raw]`, which makes
 * it the integration-level twin of the unit DISCRIMINATOR tests: Quarto's OWN
 * (buggy, unanchored) regex calls this a render script and tries to boot a
 * python kernel for it — verified firsthand against 1.7.33. Ours must refuse it.
 */
const NOT_SCRIPT = path.resolve(ROOT, "test/fixtures/not-a-render-script.py");

/** A real .qmd — `quarto.preview`'s territory, not `previewScript`'s. */
const QMD = path.resolve(ROOT, "test/fixtures/sample.qmd");

/**
 * Count processes whose command line matches `pattern`. POSIX-only (darwin);
 * `|| true` turns pgrep's "no match" exit 1 into a clean empty result.
 */
function pgrepCount(pattern: string): number {
  const out = execSync(`pgrep -f ${JSON.stringify(pattern)} || true`, {
    encoding: "utf8",
  });
  return out.split("\n").filter((line) => line.trim().length > 0).length;
}

/**
 * Live preview servers for ANY render-script fixture. Matches `preview.*<name>`
 * (not "quarto preview") because the real worker is a deno process whose command
 * line reads `quarto.js preview … render-script-spin.R` — the literal substring
 * "quarto preview" never appears (the gate-d faithful-verification trap the
 * sibling preview suites document).
 */
function scriptPreviewCount(): number {
  return (
    pgrepCount("preview.*render-script-spin") +
    pgrepCount("preview.*not-a-render-script")
  );
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs: number,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return predicate();
}

/**
 * Stub `showErrorMessage`, capturing what the gate said, restoring in `finally`.
 * The established stub technique in this suite (new-document/convert-notebook).
 */
async function withErrorCapture<T>(
  captured: string[],
  body: () => Promise<T>,
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const windowAny = vscode.window as any;
  const original = windowAny.showErrorMessage;
  windowAny.showErrorMessage = (message: string) => {
    captured.push(message);
    return Promise.resolve(undefined);
  };
  try {
    return await body();
  } finally {
    windowAny.showErrorMessage = original;
  }
}

async function openActive(file: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(file);
  await vscode.window.showTextDocument(doc);
}

/** The context key under test (Slice 2). */
const KEY = "quartoRenderScriptActive";

interface ContextCall {
  key: string;
  value: unknown;
}

/**
 * Capture `setContext` calls.
 *
 * VS Code offers NO way to read a context key back — `setContext` is a
 * write-only command and there is no `getContext` API — so the only faithful
 * observation point is the `executeCommand` call the extension itself makes.
 * We intercept it, RECORD the call, and still delegate to the real
 * implementation so the key genuinely updates (unlike create-project.test.ts's
 * `vscode.openFolder` interception, which must SUPPRESS the real call because it
 * would reload the window mid-suite; the mechanism is otherwise identical, and
 * is the established precedent for this in the repo).
 */
async function withContextCapture<T>(
  captured: ContextCall[],
  body: () => Promise<T>,
): Promise<T> {
  const commandsAny = vscode.commands as unknown as Record<string, unknown>;
  const original = commandsAny.executeCommand as (
    command: string,
    ...rest: unknown[]
  ) => Thenable<unknown>;
  commandsAny.executeCommand = (command: string, ...rest: unknown[]) => {
    if (command === "setContext") {
      captured.push({ key: rest[0] as string, value: rest[1] });
    }
    return original(command, ...rest);
  };
  try {
    return await body();
  } finally {
    commandsAny.executeCommand = original;
  }
}

/** The most recent value the extension pushed for `key` (`undefined` if never). */
function lastValueFor(captured: ContextCall[], key: string): unknown {
  const hits = captured.filter((c) => c.key === key);
  return hits.length > 0 ? hits[hits.length - 1].value : undefined;
}

describe("quartoRenderScriptActive context key", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("goes true when a render script becomes the active editor", async function () {
    this.timeout(30000);
    const captured: ContextCall[] = [];
    await withContextCapture(captured, async () => {
      await openActive(SPIN);
      await waitFor(() => lastValueFor(captured, KEY) !== undefined, 5000);
    });

    // Sanity: the interception itself is live. `execution.ts` sets its OWN
    // context key (`quarto.inCodeCell`) on every active-editor change, so seeing
    // it proves a failure below means "our key is never set", not "the capture
    // harness is broken".
    assert.ok(
      captured.some((c) => c.key === "quarto.inCodeCell"),
      "precondition: the setContext interception must be live (expected to see " +
        "execution.ts's own quarto.inCodeCell key being set)",
    );

    assert.strictEqual(
      lastValueFor(captured, KEY),
      true,
      `${KEY} must be true while a render script is the active editor`,
    );
  });

  it("goes true the moment an ordinary script is EDITED into a render script (before any save)", async function () {
    this.timeout(30000);
    // A real on-disk file (the scheme guard requires `file:`), in an OS temp dir
    // so the repo is never dirtied — the create-project/convert-notebook pattern.
    const dir = mkdtempSync(path.join(os.tmpdir(), "quarto-ext-ctxkey-"));
    const script = path.join(dir, "ordinary.py");
    writeFileSync(script, 'print("hello")\n', "utf8");

    try {
      const captured: ContextCall[] = [];
      await withContextCapture(captured, async () => {
        await openActive(script);
        await waitFor(() => lastValueFor(captured, KEY) !== undefined, 5000);

        // Ordinary Python: not a render script.
        assert.strictEqual(
          lastValueFor(captured, KEY),
          false,
          "precondition: plain Python must not be a render script",
        );

        // The user types a percent markdown cell at the top. The buffer is now a
        // render script; it is NOT saved. The key must track the BUFFER, not the
        // file on disk — `openPreview` saves a dirty document before rendering, so
        // an unsaved-but-valid script is genuinely previewable.
        const edit = new vscode.WorkspaceEdit();
        edit.insert(
          vscode.Uri.file(script),
          new vscode.Position(0, 0),
          "# %% [markdown]\n# Hi\n\n",
        );
        await vscode.workspace.applyEdit(edit);

        await waitFor(() => lastValueFor(captured, KEY) === true, 5000);
      });

      assert.strictEqual(
        lastValueFor(captured, KEY),
        true,
        `${KEY} must flip to true on the EDIT that makes the buffer a render ` +
          `script — an active-editor-change listener alone never sees this`,
      );
    } finally {
      await vscode.commands.executeCommand(
        "workbench.action.revertAndCloseActiveEditor",
      );
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // --- Behavior-lock battery (disclosed: these passed on first run, they are
  // --- not claimed REDs). Each pins an invariant that a plausible future edit
  // --- would silently break; the two below are break-revert-proven.

  it("goes false on a .qmd — the mutual-exclusion invariant that gives ctrl+shift+k back to quarto.preview", async function () {
    this.timeout(30000);
    const captured: ContextCall[] = [];
    await withContextCapture(captured, async () => {
      await openActive(QMD);
      await waitFor(() => lastValueFor(captured, KEY) !== undefined, 5000);
    });

    // If this key were ever true for a .qmd, ctrl+shift+k would fire
    // `previewScript` on a Quarto document — which `previewScript` then refuses.
    // The keybinding pair is only sound because the two predicates are disjoint.
    assert.strictEqual(
      lastValueFor(captured, KEY),
      false,
      `${KEY} must be false for a .qmd — that is quarto.preview's territory`,
    );
  });

  it("goes false for a non-file document even when its text and extension look like a script", async function () {
    this.timeout(30000);
    // The key must agree with the COMMAND GATE, which refuses a non-`file:` doc
    // (a `git:` diff of a spin script has the working-tree fsPath). If the key
    // said true here, ctrl+shift+k would bind to a command that then errors.
    // Throwaway temp dir for the same reason as the sibling gate test above: a
    // regressed scheme guard makes `openPreview` save this untitled buffer to a
    // REAL file at that path, which would poison every later run.
    const dir = mkdtempSync(path.join(os.tmpdir(), "quarto-ext-untitled-ctx-"));
    try {
      const uri = vscode.Uri.parse(
        `untitled:${path.join(dir, "untitled-ctx-spin.r")}`,
      );
      const doc = await vscode.workspace.openTextDocument(uri);
      const edit = new vscode.WorkspaceEdit();
      edit.insert(
        uri,
        new vscode.Position(0, 0),
        "#' ---\n#' title: T\n#' ---\n\n1 + 1\n",
      );
      await vscode.workspace.applyEdit(edit);

      const captured: ContextCall[] = [];
      await withContextCapture(captured, async () => {
        await vscode.window.showTextDocument(doc);
        await waitFor(() => lastValueFor(captured, KEY) !== undefined, 5000);
      });

      // Precondition: the PURE detector accepts this buffer — so a failure here
      // can only mean the scheme guard is missing, not that the detector said no.
      assert.ok(
        isRenderScript(doc.uri.fsPath, doc.getText()),
        "precondition: the pure detector must accept this buffer, so that the " +
          "scheme guard is the only thing that can make the key false",
      );
      assert.strictEqual(
        lastValueFor(captured, KEY),
        false,
        `${KEY} must be false for a non-file doc — the key MUST agree with the ` +
          `command gate, which refuses it`,
      );
    } finally {
      await vscode.commands.executeCommand(
        "workbench.action.revertAndCloseActiveEditor",
      );
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Quarto: Preview Script command", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    // Safety net: never leak a preview worker out of a test, even on failure.
    execSync('pkill -9 -f "preview.*render-script-spin" || true');
    execSync('pkill -9 -f "preview.*not-a-render-script" || true');
  });

  it("registers the quarto.previewScript command", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("quarto.previewScript"),
      "quarto.previewScript should be registered after activation",
    );
  });

  it("previews a knitr spin script end to end (real server, no orphan)", async function () {
    this.timeout(120000);
    assert.strictEqual(
      scriptPreviewCount(),
      0,
      "no preview server should be running before the test",
    );

    await openActive(SPIN);
    const errors: string[] = [];
    await withErrorCapture(errors, async () => {
      await vscode.commands.executeCommand("quarto.previewScript");
    });

    // The GATE passed. Assert specifically that the gate's own refusal is absent,
    // NOT that no error occurred at all: withErrorCapture wraps the whole await,
    // and openPreview only settles after the preview starts (or fails), so a
    // missing-R/knitr environment would also land an error here. Asserting
    // "errors == []" would then blame the gate for an environment problem. (Plan
    // §6: "the accept-path assertion must target the gate-reject string
    // specifically, not 'no error at all'.")
    assert.ok(
      !errors.some((e) => /render script/i.test(e)),
      `a valid spin script must not be refused by the gate; saw: ${JSON.stringify(errors)}`,
    );

    // ...and a REAL preview server actually spawned for it (knitr, no kernel).
    assert.ok(
      await waitFor(() => scriptPreviewCount() > 0, 60000),
      "a quarto preview server should be running for the spin script",
    );

    // Closing the pane must kill the server — no orphan.
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    assert.ok(
      await waitFor(() => scriptPreviewCount() === 0, 20000),
      "the preview server must be killed when the pane closes (no orphan)",
    );
  });

  it("refuses ordinary code that Quarto's own buggy regex would accept (no spawn)", async function () {
    this.timeout(30000);

    await openActive(NOT_SCRIPT);
    const errors: string[] = [];
    await withErrorCapture(errors, async () => {
      await vscode.commands.executeCommand("quarto.previewScript");
    });

    // gate-d discriminator: this fixture contains `raw]`, so the CLI's own
    // unanchored regex calls it a render script and boots a python kernel for it
    // (firsthand-verified). Our gate must refuse it — and refuse it by NAME, so
    // this cannot pass by some unrelated error (e.g. "Quarto was not found").
    assert.strictEqual(errors.length, 1, "the gate should show exactly one error");
    assert.match(
      errors[0],
      /render script/i,
      "the refusal must be the render-script gate's own message",
    );

    // Nothing was spawned — the gate short-circuits before openPreview.
    const spawned = await waitFor(() => scriptPreviewCount() > 0, 3000);
    assert.strictEqual(
      spawned,
      false,
      "refusing a non-render-script must not spawn a preview server",
    );
  });

  it("refuses a non-file document even when its text and extension look like a script", async function () {
    this.timeout(30000);

    // An untitled buffer whose PATH ends in .r and whose TEXT is a valid spin
    // script: isRenderScript(fsPath, text) returns true for it. Only the adapter's
    // `uri.scheme !== "file"` guard refuses it. This is the same guard that stops
    // the built-in Git extension's read-only `git:` diff of a spin script (whose
    // fsPath IS the working-tree path) from previewing the working-tree file while
    // the user is looking at an old revision.
    //
    // ⚠ The untitled path is deliberately inside a THROWAWAY temp dir, not a fixed
    // /tmp name. If the scheme guard ever regresses, the gate accepts this buffer
    // and `openPreview` calls `doc.save()` on it — and saving an UNTITLED document
    // WRITES A REAL FILE at that path. A fixed path would then survive the run, and
    // every subsequent run would fail at `openTextDocument` with a baffling "file
    // already exists" instead of the real regression. (Observed for real while
    // break-revert-proving the guard in Session 85.) Scoping it here means the
    // fallout is deleted with the dir.
    const dir = mkdtempSync(path.join(os.tmpdir(), "quarto-ext-untitled-"));
    try {
      const uri = vscode.Uri.parse(
        `untitled:${path.join(dir, "untitled-spin.r")}`,
      );
      const doc = await vscode.workspace.openTextDocument(uri);
      const edit = new vscode.WorkspaceEdit();
      edit.insert(
        uri,
        new vscode.Position(0, 0),
        "#' ---\n#' title: T\n#' ---\n\n1 + 1\n",
      );
      await vscode.workspace.applyEdit(edit);
      await vscode.window.showTextDocument(doc);

      // Precondition: the PURE detector accepts it — so the test can only pass
      // because of the scheme guard, not because the detector happened to say no.
      assert.strictEqual(doc.uri.scheme, "untitled");
      assert.ok(
        isRenderScript(doc.uri.fsPath, doc.getText()),
        "precondition: the pure detector must accept this buffer, so that the " +
          "scheme guard is the only thing that can refuse it",
      );

      const errors: string[] = [];
      await withErrorCapture(errors, async () => {
        await vscode.commands.executeCommand("quarto.previewScript");
      });

      assert.strictEqual(
        errors.length,
        1,
        "the gate should refuse a non-file doc",
      );
      assert.match(errors[0], /render script/i);
      assert.strictEqual(
        pgrepCount("preview.*untitled-spin"),
        0,
        "an unsaved, non-file buffer must never be previewed",
      );
    } finally {
      await vscode.commands.executeCommand(
        "workbench.action.revertAndCloseActiveEditor",
      );
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses a .qmd — that is quarto.preview's job, not previewScript's", async function () {
    this.timeout(30000);

    await openActive(QMD);
    const errors: string[] = [];
    await withErrorCapture(errors, async () => {
      await vscode.commands.executeCommand("quarto.previewScript");
    });

    assert.strictEqual(errors.length, 1, "the gate should refuse a .qmd");
    assert.match(errors[0], /render script/i);
    assert.strictEqual(
      pgrepCount("preview.*sample.qmd"),
      0,
      "previewScript must not spawn a preview for a .qmd",
    );
  });
});
