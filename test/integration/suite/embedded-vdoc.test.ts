import * as assert from "node:assert";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as nodeFs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  disposeAllVdocs,
  disposeVdocs,
  ensureVdoc,
  isProcessDead,
  resetDeactivation,
  sweepStaleTempVdocs,
  sweepStaleVdocs,
} from "../../../src/features/embedded-vdoc";
import {
  hostDiscriminator,
  isOurVdocFileName,
  tempVdocDirParse,
  tempVdocDirPrefix,
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
  // This describe calls the process-global `disposeAllVdocs()`, which latches the deactivate flag
  // (BACKLOG:103). Clear it after every test — a set latch would drop every later `ensureVdoc` in
  // the shared host, the cross-suite coupling nit 2b names. Mirrors the re-activation `activate` does.
  afterEach(() => {
    resetDeactivation();
  });

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

  it("drops a .gitignore into its directory, so a user never sees vdocs as untracked files", async () => {
    // Adversarial-review finding: the extension writes vdocs before the user reads the
    // README's gitignore guidance, so in a workspace not already ignoring .quarto/ they would
    // show up as untracked (and could be `git add .`-ed, committing a copy of the user's
    // source). Quarto's own CLI solves this by writing a .gitignore into its cache dir; so do we.
    const doc = await openProjectQmd();
    await ensureVdoc(doc, langKey(doc), "z = 1\n");

    const gitignore = vscode.Uri.joinPath(vdocDir(), ".gitignore");
    assert.strictEqual(await exists(gitignore), true, "a .gitignore must be written into the vdoc dir");
    const body = new TextDecoder().decode(await vscode.workspace.fs.readFile(gitignore));
    assert.ok(body.includes("*"), `the .gitignore must ignore everything; got ${JSON.stringify(body)}`);
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

    // SEQUENTIAL, not concurrent — deliberately. A concurrent pair mints distinct paths
    // even with a broken key, because the monotonic `version` counter alone makes every
    // path unique; asserting "distinct paths" would therefore pass against the exact bug
    // this test is named for (an adversarial-review finding — the old version did exactly
    // that). Run them sequentially so the SECOND call sees the first in the reuse cache:
    // if the two cells shared a key, the second would treat the first's vdoc as its own
    // stale entry and DELETE it. So the discriminating assertion is not "distinct paths"
    // but "both files still exist".
    const a = await ensureVdoc(doc, cellKey(10), "def alpha(): pass\n");
    const b = await ensureVdoc(doc, cellKey(20), "def beta(): pass\n");

    assert.ok(a && b);
    assert.notStrictEqual(a.toString(), b.toString(), "two cells must not share a path");
    assert.strictEqual(
      await exists(a),
      true,
      "the FIRST cell's vdoc must survive the second being minted — if the key lacked the " +
        "cell discriminator, the second call would delete the first as a stale same-key entry",
    );
    assert.strictEqual(await exists(b), true, "the second cell's vdoc exists too");
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

  it("reclaims a vdoc whose KEY changed (a cell whose start line shifted) at document close", async () => {
    // Adversarial-review finding: cell vdocs are keyed by absolute cellStartLine, so
    // inserting a line above a cell changes its key. The old file is no longer the "live"
    // entry for any current key, and before the fix it was stranded on disk until the next
    // session's sweep. It must be reclaimed at document close like everything else.
    const doc = await openProjectQmd();
    const cellKey = (startLine: number): VdocKey => ({
      docUri: doc.uri.toString(),
      languageId: "python",
      ext: "py",
      kind: "cell",
      cellStartLine: startLine,
    });

    const before = await ensureVdoc(doc, cellKey(10), "def f(): pass\n"); // the cell at line 10
    const shifted = await ensureVdoc(doc, cellKey(11), "def f(): pass\n"); // a line inserted above it
    assert.ok(before && shifted);
    assert.notStrictEqual(before.toString(), shifted.toString(), "a shifted cell mints a new vdoc");
    assert.strictEqual(await exists(before), true, "precondition: the pre-shift vdoc is on disk");

    await disposeVdocs(doc.uri);

    assert.strictEqual(
      await exists(before),
      false,
      "the stranded (pre-shift) vdoc must be reclaimed at close, not left for the next session",
    );
    assert.strictEqual(await exists(shifted), false, "and so must the current one");
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

    // The directory must be private: it holds a copy of the user's source, in a location
    // other users of the machine can enumerate.
    const mode = (await nodeFs.stat(path.dirname(uri.fsPath))).mode & 0o777;
    assert.strictEqual(
      mode,
      0o700,
      `the fallback directory must be private (0700), got ${mode.toString(8)}`,
    );
    await disposeVdocs(untitled.uri);
  });

  it("leaves nothing behind in the temp directory — not the source, and not the directory", async () => {
    // Found by looking rather than assuming: an earlier revision deleted the vdoc FILES
    // on shutdown but never the mkdtemp directory, so every session that touched an
    // untitled `.qmd` leaked an empty directory into the OS temp dir. The files were
    // always cleaned (the user's source never lingered) but the directories piled up.
    const untitled = await vscode.workspace.openTextDocument({
      language: "quarto",
      content: "```{python}\nsecret = 1\n```\n",
    });
    const uri = await ensureVdoc(untitled, langKey(untitled), "secret = 1\n");
    assert.ok(uri);
    const dir = path.dirname(uri.fsPath);
    assert.strictEqual(await exists(uri), true, "precondition: the vdoc was written");

    await disposeAllVdocs();

    assert.strictEqual(
      await exists(vscode.Uri.file(uri.fsPath)),
      false,
      "the user's source must not survive shutdown in a world-enumerable temp dir",
    );
    assert.strictEqual(
      await exists(vscode.Uri.file(dir)),
      false,
      "the temp directory must not survive either — otherwise every session leaks one",
    );
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

describe("embedded vdoc: a forward still in flight when the document closes", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    await ext.activate();
  });

  it("does not strand the vdoc on disk, and does not resurrect the closed document's state", async () => {
    // Found by the Slice 1 adversarial review (completeness critic).
    //
    // `disposeVdocs` runs once, synchronously, from `onDidCloseTextDocument`. `ensureVdoc`
    // reads `live` BEFORE its awaits (writeFile / openTextDocument) and writes `live` and
    // `docFiles` AFTER them — and `filesOf()` RE-CREATES the `docFiles` entry that
    // `disposeVdocs` just deleted. So a forward that is mid-await when the document closes
    // registers a brand-new vdoc against a document that will never be disposed again:
    // a copy of the user's source is left in `.quarto/vdoc-mit/` inside their repository,
    // with an open model that the language server keeps analysing, for the rest of the
    // session.
    //
    // Semantic tokens are what make this routine rather than theoretical: they are the one
    // forward VS Code fires with NO user gesture, on a debounced timer, right up until the
    // moment the editor closes. Closing a `.qmd` shortly after typing in a python cell is
    // an ordinary thing to do.
    const doc = await openProjectQmd();
    const key = langKey(doc);

    // Snapshot first. Other suites in this run share the one vdoc directory and may have
    // vdocs live in it right now — asserting the directory is EMPTY would make this test
    // depend on suite order and fail under load. The invariant that actually belongs to
    // this test is narrower and exact: THIS forward must leave nothing NEW behind.
    const ours = async (): Promise<string[]> =>
      (await nodeFs.readdir(vdocDir().fsPath).catch(() => [] as string[]))
        .filter((n) => isOurVdocFileName(n))
        .sort();
    const before = await ours();

    // Start the forward, then close the document WITHOUT awaiting it — the real race.
    const inFlight = ensureVdoc(doc, key, "import os\nx = 1\n");
    await disposeVdocs(doc.uri);
    const uri = await inFlight;

    const after = await ours();
    const strays = after.filter((n) => !before.includes(n));
    assert.deepStrictEqual(
      strays,
      [],
      `a vdoc minted while the document was closing was stranded in the user's workspace: ` +
        `[${strays.join(", ")}]. It is a copy of their source, and nothing will ever delete it.`,
    );
    // The guard must DROP the forward, not hand back a live (or deleted-file) vdoc. `disposeVdocs`
    // bumps this document's per-document epoch FIRST and unconditionally, before this forward's
    // post-await re-check runs, so the re-check ALWAYS fires and returns undefined — assert the
    // contract directly, exactly as the deactivate sibling below does, rather than behind an
    // `if (uri !== undefined)` that can never run (BACKLOG:103 nit 2a — the S91 review tightened
    // the sibling but left this copy behind).
    assert.strictEqual(
      uri,
      undefined,
      "a forward in flight when the document closes must forward nothing (return undefined), not a live vdoc",
    );
  });
});

describe("embedded vdoc: a forward still in flight when the EXTENSION deactivates", () => {
  // Clear the deactivate latch this describe's `disposeAllVdocs()` sets (BACKLOG:103 nit 2b).
  afterEach(() => {
    resetDeactivation();
  });

  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    await ext.activate();
  });

  it("does not strand the vdoc on disk when disposeAllVdocs runs mid-forward (shutdown race)", async () => {
    // The sibling of the `disposeVdocs` (document-close) race above, on the DEACTIVATE path —
    // filed HIGH by the Session 89 adversarial review.
    //
    // `disposeVdocs` bumps the per-document epoch FIRST and unconditionally (the S88 fix), so an
    // in-flight forward for a closing document cleans up and forwards nothing. `disposeAllVdocs`
    // (extension deactivate) clears `live`/`docFiles` but historically bumped NO epoch, so the
    // same race at SHUTDOWN was unguarded: an `ensureVdoc` mid-await resumes, `filesOf()`
    // RE-CREATES the `docFiles` entry `disposeAllVdocs` just cleared, and its file — a copy of the
    // user's source — survives in `.quarto/vdoc-mit/` until the next session's activation sweep.
    // Semantic tokens make this routine: VS Code fires them with no user gesture, on a debounced
    // timer, right up to the moment the window closes — which is exactly when deactivate runs.
    //
    // NB the docUri is NOT registered in `docFiles` at the instant deactivate runs (this forward
    // has not reached `live.set`), so a fix that only bumps epochs for owners ALREADY in
    // `docFiles` does not cover this case: the guard has to invalidate EVERY in-flight forward,
    // not just known owners — which is why the fix is a global shutdown generation, not a
    // per-owner epoch bump.
    const doc = await openProjectQmd();
    const key = langKey(doc);

    // Snapshot first — other suites share the one vdoc directory. The invariant that belongs to
    // this test is exact and narrow: THIS forward must leave nothing NEW behind.
    const ours = async (): Promise<string[]> =>
      (await nodeFs.readdir(vdocDir().fsPath).catch(() => [] as string[]))
        .filter((n) => isOurVdocFileName(n))
        .sort();
    const before = await ours();

    // Start the forward, then deactivate WITHOUT awaiting it — the real shutdown race.
    const inFlight = ensureVdoc(doc, key, "import sys\ny = 2\n");
    await disposeAllVdocs();
    const uri = await inFlight;

    const after = await ours();
    const strays = after.filter((n) => !before.includes(n));
    assert.deepStrictEqual(
      strays,
      [],
      `a vdoc minted while the extension was deactivating was stranded in the user's workspace: ` +
        `[${strays.join(", ")}]. It is a copy of their source, and nothing will delete it until the ` +
        `next session's activation sweep.`,
    );
    // The guard must DROP the forward, not hand back a live vdoc. The `allEpoch` snapshot is taken
    // before `disposeAllVdocs` bumps the generation, so the post-await re-check always fires here —
    // asserting the contract (return undefined) directly, rather than behind an `if (uri !== ...)`
    // that (the S91 review noted) can never run. The strays check above is the belt; this is the
    // suspenders, and it also pins that the guard forwards NOTHING rather than a deleted-file URI.
    assert.strictEqual(
      uri,
      undefined,
      "an in-flight forward at deactivate must forward nothing (return undefined), not a live vdoc",
    );
  });
});

describe("embedded vdoc: a forward dispatched AFTER the extension deactivates (BACKLOG:103)", () => {
  // This test deactivates then dispatches, so it necessarily leaves the latch set. Clear it after
  // (BACKLOG:103 nit 2b) so it does not drop later forwards in the shared host.
  afterEach(() => {
    resetDeactivation();
  });

  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    await ext.activate();
  });

  it("does not re-register a vdoc for a forward that dispatches entirely after disposeAllVdocs", async () => {
    // The sibling above stages the MID-AWAIT race: the forward is already in flight when
    // `disposeAllVdocs` bumps the shutdown generation, so its post-await re-check sees the bump
    // and cleans up. This stages the OTHER half — a forward dispatched ENTIRELY AFTER
    // `disposeAllVdocs` has finished. `disposeAllEpoch` moves exactly ONCE per session, so a
    // forward that snapshots it AFTER the bump reads the already-final value and its re-checks
    // compare EQUAL — the epoch guard cannot fire for it, and it proceeds to `live.set` /
    // `filesOf().set`, re-registering a fresh vdoc (a copy of the user's source) into the maps
    // `disposeAllVdocs` just cleared, with nothing in this session to reclaim it.
    //
    // Reachable in production because `deactivate()` fire-and-forgets `void disposeAllVdocs()`
    // and the host disposes the provider subscriptions AFTERWARD, so a debounced semantic-tokens
    // pass can still dispatch through a live provider for an interval past the bump.
    const doc = await openProjectQmd();
    const key = langKey(doc);

    // Snapshot first — other suites share the one vdoc directory. The invariant that belongs to
    // this test is exact and narrow: a forward dispatched after deactivate must leave nothing NEW.
    const ours = async (): Promise<string[]> =>
      (await nodeFs.readdir(vdocDir().fsPath).catch(() => [] as string[]))
        .filter((n) => isOurVdocFileName(n))
        .sort();
    const before = await ours();

    // Deactivate FULLY, THEN dispatch — the after-dispatch race, not the mid-await one.
    await disposeAllVdocs();
    const uri = await ensureVdoc(doc, key, "import os\nafter = 3\n");

    const after = await ours();
    const strays = after.filter((n) => !before.includes(n));
    assert.deepStrictEqual(
      strays,
      [],
      `a vdoc minted by a forward dispatched after deactivate was stranded in the user's ` +
        `workspace: [${strays.join(", ")}]. It is a copy of their source, and nothing in this ` +
        `session will delete it.`,
    );
    assert.strictEqual(
      uri,
      undefined,
      "a forward dispatched entirely after deactivate must forward nothing (return undefined)",
    );
  });
});

/**
 * The `fallbackDirPromise` memo's own lifecycle — BACKLOG:102 and BACKLOG:121 leg (b), which
 * are ONE code surface rather than two areas: both are consequences of the same
 * `if (fallbackDir !== undefined)` block in `disposeAllVdocs` guarding the memo resets.
 *
 * **The fixture is an UNTITLED document, and that is load-bearing.** Only a document with no
 * workspace folder reaches `vdocDirFor`'s `mkdtemp` branch at all; a workspace `.qmd` takes the
 * `.quarto/vdoc-mit/` branch and never touches this state. The sibling deactivate-race describe
 * above uses `openProjectQmd()` and therefore has never once exercised these lines.
 */
describe("embedded vdoc: the fallback temp directory's lifecycle (BACKLOG:102 + :121b)", () => {
  // Clear the deactivate latch this describe's `disposeAllVdocs()` calls set (BACKLOG:103 nit 2b).
  afterEach(() => {
    resetDeactivation();
  });

  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    await ext.activate();
  });

  /**
   * Park `mkdtemp` until `release()`, then run the REAL one. This is the only test in this
   * file that patches `node:fs`, and it earns it: the window being staged is the interval
   * between `fallbackDirPromise = nodeFs.mkdtemp(...)` being assigned and its `.then()`
   * assigning `fallbackDir` — and `disposeAllVdocs` reads `fallbackDir`, so the whole defect
   * only shows while that callback has not run.
   *
   * Why not the plain don't-await pattern the sibling describes use: it works today, but only
   * by accident of state this test cannot see. `disposeAllVdocs` reaches its `fallbackDir`
   * check after `await Promise.all(all.map(deleteQuietly))` — and when `all` is EMPTY that is a
   * microtask, which always drains before the event loop's poll phase can deliver `mkdtemp`'s
   * threadpool completion. So the window is currently guaranteed open. Let ANY vdoc be
   * registered at that moment, though, and `deleteQuietly` becomes real I/O, `mkdtemp` wins the
   * race, `fallbackDir` is set, the block runs, and this test PASSES WITHOUT EVER EXERCISING THE
   * BUG. Gating makes the precondition explicit rather than inherited from suite ordering.
   * (Measured both ways: unstubbed, the leak reproduced on 2 of 2 runs — so the gate pins a
   * naturally-occurring interleaving, not a synthetic one.)
   */
  function gateMkdtemp(): {
    release: () => void;
    restore: () => void;
    made: () => string | undefined;
  } {
    const original = nodeFs.mkdtemp as (prefix: string) => Promise<string>;
    let open = (): void => {};
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    let madeDir: string | undefined;
    (nodeFs as unknown as { mkdtemp: unknown }).mkdtemp = async (prefix: string) => {
      await gate;
      madeDir = await original.call(nodeFs, prefix);
      return madeDir;
    };
    return {
      release: () => open(),
      restore: () => {
        (nodeFs as unknown as { mkdtemp: unknown }).mkdtemp = original;
      },
      made: () => madeDir,
    };
  }

  it("does not leak the fallback temp dir when deactivate races an unresolved mkdtemp", async () => {
    // BACKLOG:102. `vdocDirFor` assigns `fallbackDir` ONLY inside the `mkdtemp().then()`
    // callback, so while that syscall is in flight the variable is still `undefined`. In
    // `disposeAllVdocs` the `rmdir` AND both memo resets sit inside one
    // `if (fallbackDir !== undefined)` block — so a deactivate landing in that window skips
    // all three. `mkdtemp` then resolves, creating a private 0700 directory that nothing will
    // ever remove: `disposeAllVdocs` is spent for the session, and `sweepStaleVdocs` only ever
    // reads workspace `.quarto/vdoc-mit/`, never the OS temp dir. This is the race sibling of
    // the "leaves nothing behind in the temp directory" test above, which only ever staged the
    // resolved-in-time path.
    const untitled = await vscode.workspace.openTextDocument({
      language: "quarto",
      content: "```{python}\nsecret = 1\n```\n",
    });
    const gate = gateMkdtemp();
    let made: string | undefined;
    let survived: boolean;
    try {
      // Start the forward, then deactivate WITHOUT awaiting either — the real shutdown race,
      // staged as the sibling describe stages it, but with `mkdtemp` held open so the window is
      // certain rather than inherited from suite state.
      const inFlight = ensureVdoc(untitled, langKey(untitled), "secret = 1\n");
      const deactivating = disposeAllVdocs();

      // Let the deactivate run all the way to its fallback-directory check before `mkdtemp` is
      // allowed to resolve. A macrotask boundary drains every pending microtask, so this is a
      // guarantee rather than a hope — and it is what makes the window certain: at this instant
      // `fallbackDir` is necessarily still unset, because the only line that assigns it is the
      // `.then()` of the call still parked on the gate.
      //
      // Releasing must NOT be awaited behind `deactivating`: once disposeAllVdocs observes the
      // in-flight promise it AWAITS it, so a `await deactivating` before the release deadlocks
      // the two against each other (found by doing exactly that — it hung for the full 20s).
      await new Promise((resolve) => setTimeout(resolve, 0));
      gate.release();
      await Promise.all([deactivating, inFlight]);

      made = gate.made();
      assert.ok(made, "precondition: the fallback mkdtemp ran and made a directory to leak");
      survived = await exists(vscode.Uri.file(made));
    } finally {
      // Leaving `mkdtemp` stubbed would corrupt every later suite in the run.
      gate.restore();
    }

    // Reclaim whatever leaked BEFORE asserting, so a RED run does not litter the developer's
    // temp dir on every iteration, and so the module's memo is clean for later tests either way.
    await disposeAllVdocs();
    await nodeFs.rm(made, { recursive: true, force: true }).catch(() => {});

    assert.strictEqual(
      survived,
      false,
      `deactivate raced the fallback mkdtemp and leaked its directory (${made}). Nothing will ` +
        `ever remove it: disposeAllVdocs is spent for the session, and the activation sweep ` +
        `only ever reads workspace .quarto/vdoc-mit/, never the OS temp dir.`,
    );
  });

  it("retries mkdtemp after a transient failure, rather than latching untitled docs dead", async () => {
    // BACKLOG:121 leg (b). `fallbackDirPromise` memoises the in-flight `mkdtemp` so that two
    // concurrent untitled forwards share one directory. But the memo is only ever cleared on the
    // SUCCESS path — the reset lives behind `if (fallbackDir !== undefined)`, and `fallbackDir` is
    // assigned only in the `.then()` a rejection never runs. So one transient failure (a full disk,
    // EMFILE) leaves a REJECTED promise memoised forever: every later untitled forward awaits that
    // same rejection and degrades to no-forward, and completion / hover / go-to-definition /
    // signature help / in-cell outline / Format Cell stay silently dead on every untitled `.qmd`
    // for the rest of the session — with no error, no notification, and nothing in the log.
    //
    // The failure is induced through the REAL `mkdtemp` rather than a stub: `os.tmpdir()` re-reads
    // $TMPDIR on every call, so pointing it at a path that does not exist makes the genuine syscall
    // fail with ENOENT — the same rejection an ENOSPC/EMFILE spike produces, on the real code path.
    const untitled = await vscode.workspace.openTextDocument({
      language: "quarto",
      content: "```{python}\nimport os\n```\n",
    });
    const realTmpdir = process.env.TMPDIR;
    // A FRESH name every run. A fixed "obviously nonexistent" path is not reliably nonexistent —
    // the first draft of this test used one, and something created it (mode 755, not mkdtemp's
    // 0700), after which `mkdtemp` SUCCEEDED and the precondition assert fired: the test stopped
    // inducing the failure it exists to induce. A per-run UUID cannot be pre-created.
    const noSuchDir = path.join(os.tmpdir(), `quarto-mit-no-such-dir-${randomUUID()}`);
    let first: vscode.Uri | undefined;
    try {
      process.env.TMPDIR = noSuchDir;
      first = await ensureVdoc(untitled, langKey(untitled), "import os\n");
      assert.strictEqual(
        first,
        undefined,
        "precondition: a failing mkdtemp must degrade this forward to no-forward",
      );
    } finally {
      // NOT `process.env.TMPDIR = realTmpdir`: assigning `undefined` to an env var STRINGIFIES it,
      // so on a host where TMPDIR was never set (Linux, Docker, `env -i`) that restore leaves the
      // literal string "undefined" behind. `os.tmpdir()` is `TMPDIR || TMP || TEMP || "/tmp"`, and
      // a non-empty string is truthy, so the `/tmp` default would never engage again for the rest
      // of the host process. Verified: the assignment yields `os.tmpdir() === "undefined"`, the
      // delete yields "/tmp". Latent on macOS only because launchd always sets TMPDIR.
      if (realTmpdir === undefined) {
        delete process.env.TMPDIR;
      } else {
        process.env.TMPDIR = realTmpdir;
      }
      // Belt and braces: if the induced failure ever fails to be induced, do not leave the
      // directory behind to poison the next run the way the fixed path poisoned this one.
      await nodeFs.rm(noSuchDir, { recursive: true, force: true }).catch(() => {});
    }

    // The disk is healthy again. The very next forward must retry — the memo exists to share ONE
    // in-flight creation, and a settled rejection has nothing left to share.
    const second = await ensureVdoc(untitled, langKey(untitled), "import os\n");
    try {
      assert.ok(
        second,
        "a transient mkdtemp failure latched the memo: every later untitled forward now awaits " +
          "the same rejected promise, so embedded features stay dead for untitled documents " +
          "until the window is reloaded.",
      );
    } finally {
      await disposeAllVdocs();
    }
  });
});

/**
 * The crash-reclaim sweep for the OS temp dir — Phase 1 of
 * `docs/planning/2026-07-16-os-temp-vdoc-sweep-plan.md`.
 *
 * **Why this exists.** A crash (or SIGKILL, or host teardown) with an UNTITLED `.qmd` open
 * strands that document's vdocs — the user's actual cell source — in the OS temp dir.
 * `sweepStaleVdocs` only ever reads `<workspace>/.quarto/vdoc-mit/`, so nothing ever
 * reclaimed them.
 *
 * **Why it is the most dangerous loop in this extension.** Unlike the workspace sweep, this
 * one runs in a directory shared with every other process on the machine, and two windows
 * each holding an untitled `.qmd` is entirely ordinary. Of the six guards, four (G1/G3/G4/G5)
 * are passed BY CONSTRUCTION by a live sibling window's own directory — we named it, we own
 * it, we wrote every file in it. Only **G0** (host tag) and **G2** (PID liveness) stand
 * between this loop and a live window's data. There is no defence in depth on the hazard
 * that matters, so both are pinned directly and adversarially.
 */
describe("embedded vdoc: reclaiming the temp dir a crash strands (plan Phase 1)", () => {
  // Clear the deactivate latch this describe's `disposeAllVdocs()` call sets (BACKLOG:103 nit 2b).
  afterEach(() => {
    resetDeactivation();
  });

  /** Our own host tag — what a directory this machine wrote is stamped with (G0). */
  const ourHost = (): string => hostDiscriminator(os.hostname());

  /** PIDs whose liveness is a FACT of this run, never a hard-coded guess (gate d). */
  interface Pids {
    /** Spawned and reaped: `kill(pid,0)` -> ESRCH. Genuinely dead. */
    dead: number;
    /**
     * A live child of this test run. 🐉7: it MUST be foreign, never `process.pid` — the
     * sweep's self-skip branch intercepts our own pid BEFORE the liveness check, so a
     * `process.pid` fixture never reaches G2 and stays green with G2 DELETED.
     */
    liveForeign: number;
  }

  /**
   * A private temp root, two real PIDs, and a guaranteed cleanup.
   *
   * The `dir` seam is why this is safe (plan §4.2). The developer's REAL `$TMPDIR` is
   * concurrently in use by live extension hosts, and the integration host is SIGKILLed every
   * run — so it holds this suite's own corpses AND sibling runs' (🐉5). Any assertion scoped
   * to the real temp dir would be polluted by both. Every fixture here is created by this
   * test, inside a directory this test made, and asserted only against itself.
   */
  async function withTempFixture(
    fn: (root: vscode.Uri, pids: Pids) => Promise<void>,
  ): Promise<void> {
    const root = vscode.Uri.file(
      await nodeFs.mkdtemp(path.join(os.tmpdir(), `quarto-mit-fixture-${randomUUID()}-`)),
    );
    // Dead: spawn a trivial child and wait for its exit, so ESRCH is established rather
    // than assumed. A hard-coded high pid can silently become live and pass for the wrong reason.
    const dying = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
    const dead = dying.pid ?? -1;
    await new Promise<void>((r) => dying.on("exit", () => r()));
    // Live + foreign: a child that outlives the assertions (🐉7).
    const living = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60_000)"], {
      stdio: "ignore",
    });
    const liveForeign = living.pid ?? -1;
    try {
      assert.ok(dead > 0 && liveForeign > 0, "the fixture PIDs must be real");
      assert.strictEqual(isProcessDead(dead), true, "the 'dead' fixture pid must be ESRCH-dead");
      assert.strictEqual(
        isProcessDead(liveForeign),
        false,
        "the 'live foreign' fixture pid must be alive — otherwise G2's test proves nothing",
      );
      await fn(root, { dead, liveForeign });
    } finally {
      living.kill("SIGKILL");
      await nodeFs.rm(root.fsPath, { recursive: true, force: true });
    }
  }

  /** A directory named exactly as `mkdtemp` would have named it for `host`/`pid`. */
  async function mk(root: vscode.Uri, host: string, pid: number): Promise<vscode.Uri> {
    const dir = vscode.Uri.joinPath(root, `${tempVdocDirPrefix(host, pid)}aBcDeF`);
    await nodeFs.mkdir(dir.fsPath, { mode: 0o700 });
    return dir;
  }

  /** Put a file of OURS inside `dir` — what a stranded session actually left behind. */
  async function seedVdoc(dir: vscode.Uri, name = "vdoc-mit.abc123.1.py"): Promise<vscode.Uri> {
    const file = vscode.Uri.joinPath(dir, name);
    await nodeFs.writeFile(file.fsPath, "x = 1\n");
    return file;
  }

  async function dirExists(uri: vscode.Uri): Promise<boolean> {
    try {
      await nodeFs.stat(uri.fsPath);
      return true;
    } catch {
      return false;
    }
  }

  it("reads EPERM as ALIVE, not dead (🐉1 — the one assertion that discriminates)", function () {
    // 🐉1, and this single row is why the test exists. The natural implementation —
    //     try { process.kill(pid, 0); return false } catch { return true }
    // — passes EVERY other case in this suite and is CATASTROPHICALLY wrong: it reads a
    // live process we merely lack permission to signal as dead, and reclaims its directory.
    //
    // ⚠ THE PRECONDITION IS ASSERTED, NOT ASSUMED, and that is the whole design of this test.
    // Its discriminating power rests ENTIRELY on kill(1,0) actually throwing EPERM here. If it
    // does not — running as root, where the signal is permitted and nothing throws — then the
    // shipped and the naive implementations BOTH return false and this assertion passes while
    // proving nothing (measured this session: at uid 0 they are identical). Silently degrading
    // into a tautology is exactly the failure this project keeps rediscovering (Learning #109),
    // so the premise is probed first and the test SKIPS loudly rather than passing vacuously.
    // The same probe covers Windows, which has no pid 1 at all (PIDs come in multiples of 4).
    let outcome: string;
    try {
      process.kill(1, 0);
      outcome = "NO_THROW";
    } catch (err: unknown) {
      outcome = (err as NodeJS.ErrnoException).code ?? "UNKNOWN";
    }
    if (outcome !== "EPERM") {
      // Not a pass. "We could not run the discriminator here" — say so out loud.
      this.skip();
      return;
    }

    // Only now is the assertion meaningful: pid 1 is alive AND unsignalable by us, so the
    // shipped impl must say "alive" where the naive one says "dead".
    assert.strictEqual(
      isProcessDead(1),
      false,
      "EPERM was read as 'dead'. This is the 🐉1 inversion: a live process this user cannot " +
        "signal is not a dead one, and treating it as dead deletes a LIVE window's vdocs.",
    );
  });

  it("stamps the directory it CREATES with our host tag and our pid", async () => {
    // The other half of the capability, and the half with no second chance: a directory is
    // only reclaimable if the session that created it left the two facts the sweep needs.
    // The sweep above is inert without this — it would find nothing it recognises, forever.
    //
    // The UNTITLED fixture is load-bearing (S101): only a document with no workspace folder
    // reaches vdocDirFor's mkdtemp branch at all. A workspace `.qmd` takes the
    // `.quarto/vdoc-mit/` branch and never touches this code.
    const untitled = await vscode.workspace.openTextDocument({
      language: "quarto",
      content: "```{python}\nsecret = 1\n```\n",
    });
    const uri = await ensureVdoc(untitled, langKey(untitled), "secret = 1\n");
    assert.ok(uri, "precondition: an untitled document must still get a vdoc");
    try {
      const parsed = tempVdocDirParse(path.basename(path.dirname(uri.fsPath)));

      assert.ok(
        parsed,
        `the fallback temp directory's name must be parseable by our own sweep; got ` +
          `${path.basename(path.dirname(uri.fsPath))}. An unparseable name means the sweep ` +
          `silently reclaims NOTHING, forever (🐉2).`,
      );
      assert.strictEqual(
        parsed.host,
        ourHost(),
        "the directory must carry THIS machine's host tag, or G0 skips our own leftovers forever",
      );
      assert.strictEqual(
        parsed.pid,
        process.pid,
        "the directory must carry the creating ext host's pid — it is the liveness key the " +
          "next activation asks kill(pid,0) about",
      );
    } finally {
      await disposeAllVdocs();
    }
  });

  it("reclaims the directory of a dead host bearing our tag", () =>
    withTempFixture(async (root, pids) => {
      // The capability itself: a crashed session's stranded source is gone after the next
      // activation. This is the whole point of Phase 1.
      const dead = await mk(root, ourHost(), pids.dead);
      await seedVdoc(dead);

      await sweepStaleTempVdocs(root);

      assert.strictEqual(
        await dirExists(dead),
        false,
        "a dead session's temp vdoc directory survived the sweep — the crash leak this " +
          "phase exists to close is still open.",
      );
    }));

  it("NEVER touches a LIVE sibling window's directory (G2 — 🐉7: a FOREIGN live pid)", () =>
    withTempFixture(async (root, pids) => {
      // The catastrophic case, and the reason this whole design is not a prefix scan. Two
      // windows each holding an untitled `.qmd` is entirely ORDINARY — so a sweep that
      // deleted every `quarto-mit-vdoc-*` it found would destroy a live window's source
      // every time a second window started.
      //
      // 🐉7 — THE FIXTURE IS THE TEST. `process.pid` CANNOT verify G2: the self-skip branch
      // intercepts our own pid BEFORE the liveness check, so a `process.pid` fixture never
      // reaches G2 and stays green with G2 DELETED. Only a live FOREIGN pid discriminates,
      // which is why withTempFixture spawns a real long-lived child.
      const liveDir = await mk(root, ourHost(), pids.liveForeign);
      const file = await seedVdoc(liveDir);

      await sweepStaleTempVdocs(root);

      assert.strictEqual(
        await dirExists(liveDir),
        true,
        "the sweep deleted a LIVE window's temp directory. G2 is the only guard against " +
          "this (a live window's own dir passes G1/G3/G4/G5 by construction), and losing it " +
          "means destroying the user's unsaved source in another window.",
      );
      assert.strictEqual(
        await dirExists(file),
        true,
        "the live window's vdoc FILE must survive too, not merely its directory",
      );
      // The fixture must still be alive, or this test proved nothing about liveness.
      assert.strictEqual(
        isProcessDead(pids.liveForeign),
        false,
        "the live fixture process died mid-test — G2 was never actually exercised",
      );
    }));

  it("NEVER reclaims a directory stamped on another machine (G0)", () =>
    withTempFixture(async (root, pids) => {
      // G0. `kill(pid,0)` answers "is this pid alive IN MY PID NAMESPACE". For a directory
      // stamped elsewhere — a bind-mounted /tmp, or an NFS home with a shared TMPDIR — a
      // dead-looking pid means "meaningless", not "dead", and reclaiming on it would delete
      // LIVE data. Unusual, but real; and the tag is ~3 lines and locks at first publish.
      const foreignHost = ourHost() === "abcdef" ? "fedcba" : "abcdef";
      const dir = await mk(root, foreignHost, pids.dead);
      await seedVdoc(dir);

      await sweepStaleTempVdocs(root);

      assert.strictEqual(
        await dirExists(dir),
        true,
        "a directory bearing ANOTHER machine's host tag was reclaimed on the strength of a " +
          "pid that means nothing in this namespace — G0 is gone, and with it the only " +
          "reason the ESRCH check is sound at all.",
      );
    }));

  it("NEVER touches its OWN live directory (characterisation — G2 is what enforces it)", () =>
    withTempFixture(async (root) => {
      // ⚠ THIS TEST DOES NOT DISCRIMINATE THE SELF-SKIP, and saying so is the point.
      // Break-revert measured, this session: delete the `parsed.pid === process.pid` branch
      // and this test STAYS GREEN — because G2 then reads our own pid as alive (it is) and
      // skips the directory anyway. The self-skip is a redundant statement of intent and one
      // saved syscall, NOT a load-bearing guard; G2 is what actually protects this case.
      //
      // It is kept because the plan pre-declared it (§4.1) and because it is the reason 🐉7
      // exists: the branch sits BEFORE the liveness check, so a `process.pid` fixture is
      // intercepted and never reaches G2 — which is why G2's own test must use a live
      // FOREIGN pid. Read this as characterisation, not as coverage: it pins the BEHAVIOUR
      // (our live dir survives) while G2's test pins the guard that causes it.
      const own = await mk(root, ourHost(), process.pid);
      await seedVdoc(own);

      await sweepStaleTempVdocs(root);

      assert.strictEqual(
        await dirExists(own),
        true,
        "the sweep reclaimed the directory THIS host is actively writing vdocs into",
      );
    }));

  it("claims no directory it did not name, whatever it looks like (G1)", () =>
    withTempFixture(async (root, pids) => {
      // G1. The temp dir is shared with every other process on the machine, so the ownership
      // gate is the difference between a scoped reclaim and a wildcard delete in /tmp.
      const decoys = [
        // Posit's Quarto extension — the same purpose, and many users have both installed.
        ".vdoc.a1b2c3d4.py",
        // Our OWN old grammar, in its REAL shape: `mkdtemp(tmpdir + "quarto-mit-vdoc-")`
        // produced the prefix plus 6 random chars, with no host tag and no pid. Directories
        // of exactly this shape are sitting in this machine's $TMPDIR right now. They are
        // deliberately NOT reclaimed: with no pid there is nothing to ask kill(pid,0) about,
        // so the owning window's liveness is unknowable and guessing would delete live data.
        // They leak forever, which is the right trade — no released version ever wrote them,
        // so the population is developer-only.
        "quarto-mit-vdoc-BLjvTa",
        // Our name minus the trailing dash (🐉2's shape).
        `quarto-mit-vdoc-${ourHost()}-${pids.dead}OU5bb0`,
        // An ordinary temp-dir neighbour.
        "com.apple.launchd.aBcDeF",
        "someone-elses-work",
      ];
      for (const name of decoys) {
        const dir = vscode.Uri.joinPath(root, name);
        await nodeFs.mkdir(dir.fsPath, { recursive: true });
        await nodeFs.writeFile(vscode.Uri.joinPath(dir, "payload.txt").fsPath, "not ours\n");
      }

      await sweepStaleTempVdocs(root);

      for (const name of decoys) {
        assert.strictEqual(
          await dirExists(vscode.Uri.joinPath(root, name)),
          true,
          `the sweep claimed ${name}, which it never named. In the OS temp dir that is ` +
            `someone else's data.`,
        );
      }
    }));

  it("leaves a foreign FILE — and therefore its directory — alone (G4 + G5)", () =>
    withTempFixture(async (root, pids) => {
      // G4 and G5 together. Even inside a directory we DID name, a file we did not write is
      // not ours to delete; and because the rmdir is non-recursive, declining the file
      // necessarily spares the directory too. G5 is structurally incapable of forcing it.
      const dir = await mk(root, ourHost(), pids.dead);
      const ourFile = await seedVdoc(dir);
      const theirs = vscode.Uri.joinPath(dir, "someones-notes.txt");
      await nodeFs.writeFile(theirs.fsPath, "not ours\n");

      await sweepStaleTempVdocs(root);

      assert.strictEqual(
        await dirExists(theirs),
        true,
        "the sweep deleted a foreign file that merely happened to sit in a directory we named",
      );
      assert.strictEqual(
        await dirExists(dir),
        true,
        "the rmdir must be NON-recursive: a directory still holding something foreign must " +
          "survive, even though its owner is dead",
      );
      assert.strictEqual(
        await dirExists(ourFile),
        false,
        "our OWN vdoc should still have been reclaimed — the foreign file bounds the delete, " +
          "it does not veto it",
      );
    }));

  it("never follows a SYMLINK wearing one of our names (G3)", () =>
    withTempFixture(async (root, pids) => {
      // G3. On Linux `/tmp` is world-writable and shared between users, so another user can
      // create `quarto-mit-vdoc-<ourtag>-<deadpid>-aBcDeF` as a symlink pointing at a
      // directory of ours — and a sweeper that followed it would empty the target. `lstat`
      // does not traverse, so a symlink simply fails `isDirectory()` and is skipped.
      // (Largely nil on macOS, whose per-user 0700 TMPDIR no other user can write to — but
      // this is exactly the platform difference the guard exists to not depend on.)
      const target = vscode.Uri.joinPath(root, "target-dir");
      await nodeFs.mkdir(target.fsPath);
      const bait = await seedVdoc(target, "vdoc-mit.abc123.1.py");
      const link = vscode.Uri.joinPath(root, `${tempVdocDirPrefix(ourHost(), pids.dead)}aBcDeF`);
      await nodeFs.symlink(target.fsPath, link.fsPath);

      await sweepStaleTempVdocs(root);

      assert.strictEqual(
        await dirExists(bait),
        true,
        "the sweep followed a symlink and deleted the file it pointed at — G3 is gone, and " +
          "in a world-writable /tmp that is an attacker-chosen delete",
      );
      assert.strictEqual(
        await dirExists(target),
        true,
        "the symlink's target directory must be untouched",
      );
    }));

  it("never throws, whatever it finds (C6 — it is fire-and-forget from activate)", async () => {
    // Activation calls this with `void`: a rejection would surface as an unhandled promise
    // rejection during startup, and a throw would break activation for every other feature.
    await sweepStaleTempVdocs(vscode.Uri.file(path.join(os.tmpdir(), `no-such-dir-${randomUUID()}`)));
  });
});

/**
 * The fallback temp dir must stay 0700 even after it is deleted underneath a live session —
 * Phase 2 of `docs/planning/2026-07-16-os-temp-vdoc-sweep-plan.md` (BACKLOG:182).
 *
 * **The hazard.** `vdocDirFor` memoises the mkdtemp fallback dir for the whole session, so once
 * made it is returned to every later untitled forward WITHOUT re-checking that it still exists.
 * If the OS reaper (Linux, ~10 days) or the user deletes it, the next `ensureVdoc` write goes
 * through `vscode.workspace.fs.writeFile`, whose internal `mkdirp` SILENTLY re-creates the parent
 * with `fs.promises.mkdir(path)` and NO mode arg — `0777 & ~umask` (0755 at umask 022, 0777
 * world-writable at umask 000). The user's actual cell source then lands in a world-readable
 * directory, the exact information disclosure the 0700 mkdtemp exists to prevent — and a real one
 * on Linux, where `/tmp` is world-listable and `readdir(/tmp)` defeats mkdtemp's unpredictability.
 * There is NO ENOENT to hook (the re-create is silent), so the fix must detect the deletion with
 * an explicit stat and re-mint a fresh private directory.
 *
 * **Why untitled is load-bearing** (as in the sibling lifecycle describe): only a document with
 * no workspace folder reaches `vdocDirFor`'s mkdtemp branch; a workspace `.qmd` takes the
 * `.quarto/vdoc-mit/` branch, whose `createDirectory` is recursive and idempotent and never
 * exhibits this.
 */
describe("embedded vdoc: the fallback dir stays 0700 after a delete-underneath (plan Phase 2, BACKLOG:182)", () => {
  // Clear the deactivate latch this describe's `disposeAllVdocs()` calls set (BACKLOG:103 nit 2b).
  afterEach(() => {
    resetDeactivation();
  });

  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    await ext.activate();
  });

  it("re-mints a private 0700 directory when the memoised fallback dir is deleted out from under it", async () => {
    // Reset the module memo so the first forward mints a directory THIS test owns, rather than
    // inheriting one a prior test left memoised (module-global state, one mocha process). This uses
    // `disposeAllVdocs` as a clean-slate reset, not a real deactivate — so clear the deactivate
    // latch it now also sets (BACKLOG:103), or the forwards exercised below would be dropped.
    await disposeAllVdocs();
    resetDeactivation();

    const untitled = await vscode.workspace.openTextDocument({
      language: "quarto",
      content: "```{python}\nimport os\n```\n",
    });

    const first = await ensureVdoc(untitled, langKey(untitled), "import os\n");
    assert.ok(first, "precondition: the untitled forward must produce a fallback vdoc");
    const firstDir = path.dirname(first.fsPath);
    assert.strictEqual(
      (await nodeFs.stat(firstDir)).mode & 0o777,
      0o700,
      "precondition: the freshly minted fallback dir is 0700",
    );

    // Delete it out from under the live session — the OS reaper or a user `rm -rf $TMPDIR/...`.
    await nodeFs.rm(firstDir, { recursive: true, force: true });

    // A SECOND forward with DIFFERENT content, so the reuse branch (content-equal + model-open)
    // cannot short-circuit and the write genuinely goes back through vdocDirFor -> writeFile.
    const second = await ensureVdoc(untitled, langKey(untitled), "import sys\n");
    let secondDir: string | undefined;
    try {
      assert.ok(second, "the second forward must still produce a vdoc after the dir vanished");
      // Assert on the SECOND forward's OWN directory, never the captured firstDir: under the fix
      // firstDir stays deleted (a fresh mkdtemp is minted), so statting firstDir would ENOENT and
      // prove nothing. It is the directory the user's source ACTUALLY landed in that must be 0700.
      secondDir = path.dirname(second.fsPath);
      const mode = (await nodeFs.stat(secondDir)).mode & 0o777;
      assert.strictEqual(
        mode,
        0o700,
        `the user's source was written into a ${mode.toString(8)} directory after the private ` +
          `one was deleted — vscode.workspace.fs.writeFile re-created it at 0777 & ~umask instead ` +
          `of a fresh 0700 mkdtemp. On Linux (/tmp world-listable) that is an information ` +
          `disclosure.`,
      );
    } finally {
      await disposeAllVdocs();
      await nodeFs.rm(firstDir, { recursive: true, force: true }).catch(() => {});
      if (secondDir !== undefined) {
        await nodeFs.rm(secondDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  });
});
