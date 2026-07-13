import * as assert from "node:assert";
import { promises as nodeFs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  disposeVdocs,
  ensureVdoc,
  sweepStaleVdocs,
} from "../../../src/features/embedded-vdoc";
import {
  isOurVdocFileName,
  VDOC_DIR_SEGMENTS,
  type VdocKey,
} from "../../../src/core/embedded/vdoc-path";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

/** The `.qmd` in the integration run's workspace folder (`test/fixtures/project`). */
async function openProjectQmd(): Promise<vscode.TextDocument> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder, "the integration host must have a workspace folder open");
  return vscode.workspace.openTextDocument(
    vscode.Uri.joinPath(folder.uri, "index.qmd"),
  );
}

function vdocDir(): vscode.Uri {
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder);
  return vscode.Uri.joinPath(folder.uri, ...VDOC_DIR_SEGMENTS);
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

/** macOS reports `/var/...` for `os.tmpdir()` but resolves it to `/private/var/...`. */
async function realTmp(): Promise<string> {
  return nodeFs.realpath(os.tmpdir());
}

async function writeFile(uri: vscode.Uri, text: string): Promise<void> {
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(uri.fsPath)));
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(text));
}

function langKey(doc: vscode.TextDocument): VdocKey {
  return {
    docUri: doc.uri.toString(),
    languageId: "python",
    ext: "py",
    kind: "lang",
  };
}

describe("embedded vdoc: the file: document the forwards ride on (item 18 Slice 0)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    const doc = await openProjectQmd();
    await disposeVdocs(doc.uri);
  });

  it("writes a real file: document inside .quarto/vdoc-mit and OPENS its model", async () => {
    // The two properties that make a forward reach a real language server at all:
    //
    //  - the URI must be `file:` — real servers register their providers against a
    //    documentSelector scoped to the schemes they can read, so our old custom
    //    scheme meant NO provider was ever registered and every forward silently
    //    returned nothing (this is the defect, BACKLOG item 18);
    //  - the model must be OPEN — `vscode.provide*` does not force-open a document.
    //    Against an unopened URI the provider is never invoked and the command
    //    returns `undefined`, which is indistinguishable from "no extension
    //    installed" (M1, plan §2.2). This is the silent one.
    const doc = await openProjectQmd();
    const content = "import os\nos.\n";

    const uri = await ensureVdoc(doc, langKey(doc), content);

    assert.ok(uri, "ensureVdoc must produce a vdoc URI in a real workspace folder");
    assert.strictEqual(uri.scheme, "file", "the vdoc must be a real file: document");
    assert.ok(
      isOurVdocFileName(path.basename(uri.fsPath)),
      `the vdoc must be recognizably ours: ${uri.fsPath}`,
    );
    assert.strictEqual(
      path.dirname(uri.fsPath),
      vdocDir().fsPath,
      "the vdoc must live in our own scoped directory, never Posit's",
    );
    assert.ok(await exists(uri), "the vdoc must actually exist on disk");

    const opened = vscode.workspace.textDocuments.find(
      (d) => d.uri.toString() === uri.toString(),
    );
    assert.ok(
      opened,
      "M1: ensureVdoc must open the model — without it the forward silently returns nothing",
    );
    assert.strictEqual(opened.getText(), content, "the model must hold the vdoc content");
    assert.strictEqual(
      opened.languageId,
      "python",
      "the trailing .py must resolve the vdoc to languageId python — this is what routes the forward",
    );
  });

  it("mints a FRESH path when the content changes, so a request never sees stale text", async () => {
    // M2/M3, the silent one. Once a model is open VS Code caches it, and rewriting the
    // file on disk invalidates that cache only ASYNCHRONOUSLY — measured at ≈1017 ms
    // during the spike. So a write-then-request design serves the PREVIOUS revision on
    // every edit: highlighting and symbols would sit permanently one keystroke behind,
    // with nothing to show for it in any log.
    //
    // The defence is to never reuse a path whose content changed. This asserts the
    // property that makes the race unrepresentable: a new path, and a model already
    // holding the new bytes at the moment ensureVdoc resolves — no settle, no polling.
    const doc = await openProjectQmd();
    const key = langKey(doc);

    const first = await ensureVdoc(doc, key, "x = 1\n");
    const second = await ensureVdoc(doc, key, "x = 2\n");

    assert.ok(first && second);
    assert.notStrictEqual(
      first.toString(),
      second.toString(),
      "changed content must land on a NEW path — reusing one races the model cache",
    );
    const opened = vscode.workspace.textDocuments.find(
      (d) => d.uri.toString() === second.toString(),
    );
    assert.ok(opened, "the new vdoc's model must be open");
    assert.strictEqual(
      opened.getText(),
      "x = 2\n",
      "the model must hold the NEW content immediately — this is the race that M3 proves exists",
    );
    assert.strictEqual(
      await exists(first),
      false,
      "the superseded vdoc must be deleted, so one live file exists per key",
    );
  });

  it("REUSES the path when the content is unchanged, so it stays off the per-keystroke disk path", async () => {
    // The corollary of the rule above, and the reason this is not a disk write on every
    // keystroke (plan 🐉8): reuse is safe precisely when the bytes are identical, because
    // then the cached model is not stale — it is correct. Hovering and completing without
    // editing must therefore write nothing at all.
    const doc = await openProjectQmd();
    const key = langKey(doc);
    const content = "import os\nos.\n";

    const first = await ensureVdoc(doc, key, content);
    const before = (await vscode.workspace.fs.readDirectory(vdocDir())).length;
    const second = await ensureVdoc(doc, key, content);
    const after = (await vscode.workspace.fs.readDirectory(vdocDir())).length;

    assert.ok(first && second);
    assert.strictEqual(
      first.toString(),
      second.toString(),
      "identical content must reuse the same vdoc path",
    );
    assert.strictEqual(after, before, "identical content must not write a new file");
  });

  it("gives two cells of the SAME language distinct paths (they are forwarded concurrently)", async () => {
    // 🐉4. `outline.ts` forwards every cell concurrently (nested `Promise.all`). Two
    // same-language cells sharing a path would race, and each would render the other's
    // symbols — a wrong-but-plausible outline, which is worse than an empty one.
    const doc = await openProjectQmd();
    const cellKey = (startLine: number): VdocKey => ({
      docUri: doc.uri.toString(),
      languageId: "python",
      ext: "py",
      kind: "cell",
      cellStartLine: startLine,
    });

    const [a, b] = await Promise.all([
      ensureVdoc(doc, cellKey(10), "def alpha(): pass\n"),
      ensureVdoc(doc, cellKey(20), "def beta(): pass\n"),
    ]);

    assert.ok(a && b);
    assert.notStrictEqual(a.toString(), b.toString(), "concurrent cells must not share a path");
    const textOf = (uri: vscode.Uri): string | undefined =>
      vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString())?.getText();
    assert.strictEqual(textOf(a), "def alpha(): pass\n");
    assert.strictEqual(textOf(b), "def beta(): pass\n");
  });

  it("deletes every vdoc it wrote when the source document closes", async () => {
    const doc = await openProjectQmd();
    const uri = await ensureVdoc(doc, langKey(doc), "y = 1\n");
    assert.ok(uri);
    assert.strictEqual(await exists(uri), true);

    await disposeVdocs(doc.uri);

    assert.strictEqual(
      await exists(uri),
      false,
      "no vdoc may survive its source document — they are cache files in the user's tree",
    );
  });

  it("falls back to a private temp directory for a document with no workspace folder", async () => {
    // An untitled `.qmd` has no workspace root to write into. It must still forward
    // (untitled documents are a first-class way to use this extension), so the vdoc goes
    // to a 0700 mkdtemp directory — unpredictable by construction, because writing the
    // user's source to a guessable world-readable path would be an information disclosure.
    const untitled = await vscode.workspace.openTextDocument({
      language: "quarto",
      content: "```{python}\nimport os\n```\n",
    });

    const uri = await ensureVdoc(untitled, langKey(untitled), "import os\n");

    assert.ok(uri, "an untitled document must still get a vdoc — via the fallback");
    assert.strictEqual(uri.scheme, "file");
    assert.ok(
      uri.fsPath.startsWith(os.tmpdir()) || uri.fsPath.startsWith(await realTmp()),
      `the fallback vdoc must live under the OS temp dir, got ${uri.fsPath}`,
    );
    assert.ok(
      !uri.fsPath.startsWith(vdocDir().fsPath),
      "an untitled document has no workspace root and must not write into one",
    );
    await disposeVdocs(untitled.uri);
  });
});

/**
 * `sweepStaleVdocs` is the only code in this extension that deletes files inside the
 * user's workspace, so it gets the most adversarial test in this suite. The decoys
 * below are not hypothetical:
 *
 *  - Posit's Quarto extension writes `.vdoc.<id>.<ext>` into `<root>/.quarto/vdoc/`
 *    for exactly the same purpose, and many users (including this project's operator)
 *    have BOTH extensions installed. A sweeper that walked `.quarto/` by filename
 *    pattern would delete their LIVE vdocs while they typed.
 *  - `.quarto/` is Quarto's own cache directory. Other things live there.
 *
 * Both guards are asserted independently, so neither alone is load-bearing: we only
 * read our own directory, AND within it we only delete names we own.
 */
describe("embedded vdoc: sweep safety — the delete loop's blast radius", () => {
  let folder: vscode.Uri;
  /** Posit's live vdoc, in Posit's directory. The file this must never touch. */
  let positVdoc: vscode.Uri;
  /** A user file that happens to sit in OUR directory. */
  let userFileInOurDir: vscode.Uri;
  /** A user file in the workspace tree, named exactly like one of ours. */
  let userFileInTree: vscode.Uri;
  /** Genuine crash residue: our shape, our directory, a DIFFERENT extension host. */
  let staleOurs: vscode.Uri;

  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    await ext.activate();
    const wf = vscode.workspace.workspaceFolders?.[0];
    assert.ok(wf);
    folder = wf.uri;

    positVdoc = vscode.Uri.joinPath(folder, ".quarto", "vdoc", ".vdoc.p0s1t.py");
    userFileInOurDir = vscode.Uri.joinPath(folder, ...VDOC_DIR_SEGMENTS, "notes.py");
    userFileInTree = vscode.Uri.joinPath(folder, "vdoc-mit.aaaa.1.py");
    staleOurs = vscode.Uri.joinPath(
      folder,
      ...VDOC_DIR_SEGMENTS,
      "vdoc-mit.deadbeef0000.1.py",
    );
  });

  beforeEach(async () => {
    await writeFile(positVdoc, "# Posit's live vdoc — MUST SURVIVE\n");
    await writeFile(userFileInOurDir, "# a user file — MUST SURVIVE\n");
    await writeFile(userFileInTree, "# a user file in the tree — MUST SURVIVE\n");
    await writeFile(staleOurs, "# crash residue from another host — must be swept\n");
  });

  afterEach(async () => {
    for (const uri of [positVdoc, userFileInOurDir, userFileInTree, staleOurs]) {
      try {
        await vscode.workspace.fs.delete(uri, { useTrash: false });
      } catch {
        // already swept, or never created
      }
    }
    try {
      await vscode.workspace.fs.delete(vscode.Uri.joinPath(folder, ".quarto", "vdoc"), {
        recursive: true,
        useTrash: false,
      });
    } catch {
      // fine
    }
  });

  it("never deletes Posit's live vdocs, even though they serve the same purpose", async () => {
    await sweepStaleVdocs(vscode.workspace.workspaceFolders ?? []);

    assert.strictEqual(
      await exists(positVdoc),
      true,
      "sweeping must not reach .quarto/vdoc/ — those files belong to Posit's extension, " +
        "and deleting them would break a live feature in another extension while the user types",
    );
  });

  it("never deletes a file it did not write, even inside its own directory", async () => {
    await sweepStaleVdocs(vscode.workspace.workspaceFolders ?? []);

    assert.strictEqual(
      await exists(userFileInOurDir),
      true,
      "ownership is decided by the file NAME, not by the directory — a foreign name in our " +
        "own directory is still not ours to delete",
    );
  });

  it("never walks the workspace tree, even for a file named exactly like one of ours", async () => {
    await sweepStaleVdocs(vscode.workspace.workspaceFolders ?? []);

    assert.strictEqual(
      await exists(userFileInTree),
      true,
      "the sweep is scoped to one directory — it must never pattern-match across the workspace",
    );
  });

  it("DOES delete our own residue from a crashed extension host", async () => {
    // The counterweight to the three tests above: a sweep that deletes nothing is
    // trivially safe and completely useless. This is the file it exists to remove.
    assert.strictEqual(await exists(staleOurs), true, "precondition: the residue exists");

    await sweepStaleVdocs(vscode.workspace.workspaceFolders ?? []);

    assert.strictEqual(
      await exists(staleOurs),
      false,
      "a vdoc left by a previous (crashed) extension host must be swept",
    );
  });

  it("does not delete the vdocs THIS host is actively using", async () => {
    const doc = await openProjectQmd();
    const mine = await ensureVdoc(doc, langKey(doc), "live = True\n");
    assert.ok(mine);

    await sweepStaleVdocs(vscode.workspace.workspaceFolders ?? []);

    assert.strictEqual(
      await exists(mine),
      true,
      "our own instance's live vdoc must survive a sweep — it is in use right now",
    );
    await disposeVdocs(doc.uri);
  });
});
