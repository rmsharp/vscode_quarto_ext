/**
 * The one `vscode` adapter every embedded-language forward rides on (BACKLOG item 18
 * — the shipped-defect fix; plan §6.3). Owns the lifecycle of the virtual documents:
 * writing them, opening their models, deleting them, and sweeping what a crash left
 * behind.
 *
 * ## What was broken
 *
 * `providers/embedded.ts` (completion / hover / go-to-definition / signature-help),
 * `providers/outline.ts` (in-cell symbols) and `features/format-cell.ts` each served
 * their vdoc from a `TextDocumentContentProvider` on a custom URI scheme. Real
 * language servers register their providers against a `documentSelector` scoped to
 * the schemes they can read (`file:`, `untitled:`, `vscode-notebook-cell:`), so **no
 * provider was ever registered for those vdocs**: every forward returned nothing,
 * with no error and no warning. Proven firsthand against real Pylance — identical
 * Python content, same position: 306 completions on a `file:` URI, **0** on ours.
 *
 * The fix is to make the vdoc a real file on disk. That is what this module does.
 *
 * ## Three mechanics that are easy to get wrong
 *
 * **M1 — the model must be OPEN.** `vscode.provide*`/`vscode.execute*` do not
 * force-open a document. Against an unopened URI the provider is never invoked and
 * the command returns `undefined` — indistinguishable from "no extension installed".
 * `ensureVdoc` therefore always `openTextDocument`s before returning, and the test
 * that fails if that line is deleted is `embedded-vdoc.test.ts`'s first case.
 *
 * **M2/M3 — a reused path serves STALE text.** Once a model is open VS Code caches
 * it, and rewriting the file on disk invalidates it only *asynchronously* — measured
 * at ≈1017 ms during the spike. A write-then-request sequence therefore tokenizes the
 * PREVIOUS revision on every edit, silently and forever. The defence is to never
 * reuse a path whose content changed: `ensureVdoc` mints a fresh file name (a new
 * monotonic version) whenever the content differs, so no cached model for that path
 * can exist and there is nothing to invalidate. Posit does the same thing, and so
 * does this project's own `outline.ts` (its version-stamped URI, which this
 * generalizes rather than replaces — it also guards `executeDocumentSymbolProvider`'s
 * separate RESULT cache, Learning #78).
 *
 * **The corollary: unchanged content must NOT mint a new path.** Reuse is safe
 * precisely when the content is identical — "stale" content *is* the correct content
 * — and it is what keeps this off the per-keystroke disk-write path (plan 🐉8). A
 * hover that changes nothing writes nothing.
 *
 * ## Sweep safety
 *
 * There are TWO crash sweeps here, and they are deliberately separate functions because
 * they run in places with very different hazards.
 *
 * **`sweepStaleVdocs`** deletes files inside the user's workspace, bounded by two
 * independent guards, both owned by `core/embedded/vdoc-path.ts`: it only ever reads our
 * own directory (`.quarto/vdoc-mit/`, never Posit's `.quarto/vdoc/`), and within it only
 * deletes names `isOurVdocFileName` claims. It never recurses, never pattern-matches
 * across the workspace, and never deletes a file this window is still using.
 *
 * **`sweepStaleTempVdocs`** reclaims what a crash strands in the OS temp dir — where an
 * untitled document's vdocs go, and where they are the user's source rather than a cache.
 * That directory is shared with every other process on the machine, and a second window
 * holding its own untitled `.qmd` is ordinary, so this sweep additionally turns on a host
 * tag (G0) and a PID-liveness check (G2). Those two are the ENTIRE defence against
 * deleting a live window's data: a live sibling's directory passes the grammar, the
 * ownership check and the non-recursive rmdir *by construction*, because we named it and
 * wrote every file in it. See that function's own docstring.
 */

import { promises as nodeFs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import {
  hostDiscriminator,
  isOurVdocFileName,
  tempVdocDirParse,
  tempVdocDirPrefix,
  VDOC_DIR_SEGMENTS,
  vdocFileName,
  vdocInstanceId,
  vdocKeyString,
  type VdocKey,
} from "../core/embedded/vdoc-path";

/**
 * Identifies THIS extension host among any others sharing the workspace. Stamped into
 * every file name we write, so a sweep can tell our files from a second window's.
 * Hex, so it satisfies the file-name grammar in `vdoc-path.ts`.
 */
const INSTANCE_ID = randomUUID().replace(/-/g, "").slice(0, 12);

/** A vdoc we currently have on disk, with the content it was written with. */
interface LiveVdoc {
  uri: vscode.Uri;
  /** The exact bytes on disk, and what reuse is judged against. */
  content: string;
}

/** Monotonic across the session — this, alone, is what makes every written path unique. */
let version = 0;

/** `vdocKeyString(key)` -> the vdoc currently reusable for it (the reuse cache). */
const live = new Map<string, LiveVdoc>();

/**
 * `docUri.toString()` -> EVERY vdoc file this session has minted for it and not yet
 * deleted, keyed by `uri.toString()`. This is a superset of `live`: it also retains a
 * file that `live` has stopped pointing at — a concurrent double-mint's loser, or a cell
 * whose start line shifted so its key changed — so a document close still deletes it
 * rather than stranding it on disk until the next session's sweep.
 */
const docFiles = new Map<string, Map<string, vscode.Uri>>();

/**
 * `docUri.toString()` -> how many times that document's vdocs have been disposed.
 *
 * `ensureVdoc` reads its state before a chain of awaits (mkdir, write, open) and writes it
 * after them, but `disposeVdocs` runs synchronously from `onDidCloseTextDocument` and can
 * land in the middle. Without this, a forward that was in flight when the document closed
 * would resume and re-register its brand-new file — `filesOf()` RE-CREATES the `docFiles`
 * entry `disposeVdocs` had just deleted — leaving a copy of the user's source in their
 * workspace that nothing will ever delete, and an open model the language server keeps
 * analysing, for the rest of the session.
 *
 * So: take the epoch before the awaits, compare after. If it moved, the document we were
 * working for is gone, and the only correct thing to do is clean up and forward nothing.
 *
 * Semantic tokens are what made this routine rather than theoretical: they are the one
 * forward VS Code fires with no user gesture, on a debounced timer, right up to the moment
 * the editor closes.
 */
const disposeEpoch = new Map<string, number>();

function epochOf(docUri: string): number {
  return disposeEpoch.get(docUri) ?? 0;
}

/**
 * A single, monotonic shutdown generation, bumped by `disposeAllVdocs` (extension deactivate).
 *
 * The per-document `disposeEpoch` above cannot guard the deactivate race: `disposeVdocs` is handed
 * the specific `docUri` that closed and bumps THAT epoch, but `disposeAllVdocs` gets no `docUri`,
 * and an in-flight `ensureVdoc` may be mid-await for a document that has not yet reached its
 * `live.set`/`filesOf` — so it is in no map for a per-owner sweep to enumerate. `ensureVdoc`
 * therefore snapshots THIS counter alongside the per-document epoch before its awaits and re-checks
 * both after: a bump here invalidates EVERY in-flight forward at once, known owner or not, so none
 * re-registers its file against a session that is shutting down. Monotonic and snapshot-compared,
 * so a bump from a prior deactivate never affects a later forward (which snapshots it fresh).
 */
let disposeAllEpoch = 0;

/**
 * The lazily-created fallback directory for documents with no workspace folder (untitled), held
 * as its in-flight creation and memoised so two concurrent forwards cannot each run `mkdtemp` and
 * leak the loser's directory. The FIRST caller starts it; every concurrent caller awaits the same
 * promise.
 *
 * The PROMISE is the whole state — there is deliberately no resolved `fallbackDir` companion
 * variable. There used to be, and it was the bug: it is assigned only inside the `mkdtemp`
 * `.then()`, so anything reading it during the creation window sees `undefined` and concludes
 * there is no directory to clean up, precisely when one is about to exist (BACKLOG:102).
 * Everything that needs the directory must await this promise instead.
 */
let fallbackDirPromise: Promise<vscode.Uri> | undefined;

/**
 * Write `content` as `key`'s virtual document, open its model, and return its `file:`
 * URI — or `undefined` when no writable location exists, in which case the caller
 * simply does not forward (the same graceful degradation as "no language extension
 * installed"). Never throws.
 *
 * Reuses the existing path when the content is unchanged (no write, no new model); mints a
 * fresh path and deletes the previous one when it is not.
 *
 * The comparison is a plain byte-equality on what the BUILDER produced, and that is enough
 * to keep this off the per-keystroke disk-write path (plan 🐉8) because the builders blank
 * every non-code line to EMPTY: a virtual document is a function of the CODE alone, so an
 * edit that only touches prose yields identical bytes and reuses the open model, while an
 * edit that touches CODE differs and mints a fresh path (M3, above, is untouched).
 *
 * An earlier attempt at 🐉8 canonicalized HERE instead — collapsing every whitespace-only
 * line before writing. That was wrong, and the adversarial review caught it: a blank line
 * INSIDE a cell body is a code line the user can put their cursor on (press Enter in a
 * Python function and auto-indent leaves you at column 4 of a whitespace-only line), and
 * emptying it moved a column the forwarded position still referred to. Only the builders
 * know which lines are body lines, so only the builders may blank them.
 */
export async function ensureVdoc(
  doc: vscode.TextDocument,
  key: VdocKey,
  content: string,
): Promise<vscode.Uri | undefined> {
  const ks = vdocKeyString(key);
  const existing = live.get(ks);
  if (existing !== undefined && existing.content === content && isModelOpen(existing.uri)) {
    // Unchanged content: the open model already holds exactly these bytes, so there is
    // nothing to invalidate and nothing to write. This is the common case (hovering,
    // completing, re-outlining without an edit — and now every prose keystroke) and it is
    // what keeps us off the disk. The `isModelOpen` check makes it self-healing if another
    // window's sweep removed the file underneath us.
    return existing.uri;
  }

  // The owner's dispose count as of NOW, before any await. If it moves while we are
  // writing and opening, the `.qmd` we are doing this for has been closed underneath us.
  // The global shutdown generation guards the sibling race at deactivate (see `disposeAllEpoch`),
  // where there is no `docUri` to key a per-document epoch on.
  const epoch = epochOf(key.docUri);
  const allEpoch = disposeAllEpoch;

  try {
    const dir = await vdocDirFor(doc);
    if (dir === undefined) {
      return undefined;
    }
    if (epochOf(key.docUri) !== epoch || disposeAllEpoch !== allEpoch) {
      // Bail BEFORE writing, not just after. The re-check below already deletes a file minted
      // against a dead session, but by then the file has EXISTED — and for the untitled fallback
      // that is enough to defeat the cleanup: `disposeAllVdocs` removes the temp directory with a
      // deliberately NON-recursive `rmdir`, which fails outright if this forward has put a file in
      // it, leaving an empty directory nothing will ever remove.
      //
      // MEASURED, not reasoned: with only the `disposeAllVdocs` change below and this guard
      // absent, the temp directory reliably survived deactivate — `survived=true contents=[]`,
      // i.e. the rmdir had already failed by the time this forward deleted its own file. The
      // precise interleaving that produces that is NOT characterized here (a probe of promise
      // resume-order gave an answer that contradicts the obvious one, and it was not run down);
      // what IS established is that the cleanup is not reliable without this guard and is with it.
      // Writing nothing is also just correct on its own terms — the file below would be created
      // only to be deleted a few lines later.
      return undefined;
    }
    version += 1;
    const uri = vscode.Uri.joinPath(dir, vdocFileName(INSTANCE_ID, version, key.ext));
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
    // M1 — MANDATORY, and its absence is silent. Without this the language server is
    // never asked about the document and every forward returns `undefined`.
    await vscode.workspace.openTextDocument(uri);

    if (epochOf(key.docUri) !== epoch || disposeAllEpoch !== allEpoch) {
      // The document closed (per-document epoch) — or the extension deactivated (global epoch) —
      // while we were working. `disposeVdocs`/`disposeAllVdocs` has already run and will not run
      // again for this file, so registering it would strand it — and it holds a copy of the user's
      // source. Delete it and forward nothing; the caller degrades exactly as it does when no vdoc
      // can be written at all.
      await deleteQuietly(uri);
      return undefined;
    }

    live.set(ks, { uri, content });
    filesOf(key.docUri).set(uri.toString(), uri);
    if (existing !== undefined) {
      // The ordinary supersede: same key, new content (a keystroke in the same cell).
      // Delete the previous file AND stop tracking it, so an actively-edited cell holds
      // exactly one file rather than one per keystroke.
      await deleteQuietly(existing.uri);
      docFiles.get(key.docUri)?.delete(existing.uri.toString());
    }
    return uri;
  } catch {
    // A read-only workspace, a full disk, a permissions problem: degrade to no forward
    // rather than surfacing an error the user cannot act on. TextMate colouring, the
    // run-cell commands and everything else keep working.
    return undefined;
  }
}

/** Delete every vdoc file owned by `docUri` — called when the source document closes. */
export async function disposeVdocs(docUri: vscode.Uri): Promise<void> {
  const owner = docUri.toString();
  // Bump FIRST, and unconditionally — before the early return. An `ensureVdoc` can be
  // mid-await for a document that has no files registered YET (it has not reached its
  // `live.set`), which is precisely the race this guards: the early return below would
  // otherwise let that forward resume and register a file against a closed document.
  disposeEpoch.set(owner, epochOf(owner) + 1);

  const files = docFiles.get(owner);
  if (files === undefined) {
    return;
  }
  docFiles.delete(owner);
  // Drop this document's reuse-cache entries too. `live` is keyed by content-key, not by
  // document, so filter by the file each entry points at.
  const owned = new Set([...files.values()].map((u) => u.toString()));
  for (const [ks, entry] of live) {
    if (owned.has(entry.uri.toString())) {
      live.delete(ks);
    }
  }
  await Promise.all([...files.values()].map((uri) => deleteQuietly(uri)));
}

/** Delete every vdoc this session created, and the temp directory it may have made. */
export async function disposeAllVdocs(): Promise<void> {
  // Bump the shutdown generation FIRST, before the awaits — the deactivate sibling of
  // `disposeVdocs`'s unconditional per-document bump. An `ensureVdoc` in flight right now (semantic
  // tokens fire on a debounced timer up to the moment the window closes) sees this move when it
  // resumes and cleans up, rather than re-registering its file against a shutting-down session.
  disposeAllEpoch += 1;
  const all = [...docFiles.values()].flatMap((m) => [...m.values()]);
  live.clear();
  docFiles.clear();
  await Promise.all(all.map((uri) => deleteQuietly(uri)));

  // Remove the fallback temp directory too, or every session that ever touched an
  // untitled `.qmd` would leave an empty directory behind in the OS temp dir forever.
  //
  // AWAIT the memo rather than testing any already-resolved value: an untitled forward can be
  // inside `mkdtemp` at this very moment, so the directory does not exist yet but is about to.
  // Testing a resolved value is exactly the shape that leaked it — see `fallbackDirPromise`'s
  // declaration. This is still the only thing that removes the directory *within this session*:
  // `sweepStaleTempVdocs` is the crash backstop and it runs at the NEXT activation, by which
  // point this session's directory has been sitting in the OS temp dir holding the user's
  // source the whole time. (`sweepStaleVdocs`, the workspace sweep, never reads the temp dir
  // at all.) So the clean path still owns cleaning up after itself.
  // The window is not exotic: deactivate reaches this line after `await Promise.all(...)`, and
  // when no vdocs are registered that is a microtask, which always drains before the event loop
  // can deliver `mkdtemp`'s completion.
  //
  // The reset is unconditional and happens BEFORE the await, so the memo is cleared on every
  // path — including a `mkdtemp` that REJECTED, which the old success-only reset could never
  // reach at all.
  const pending = fallbackDirPromise;
  fallbackDirPromise = undefined;
  if (pending !== undefined) {
    let dir: vscode.Uri | undefined;
    try {
      dir = await pending;
    } catch {
      // `mkdtemp` failed, so it made no directory and there is nothing to remove.
    }
    if (dir !== undefined) {
      // `rmdir` is deliberately NOT recursive: it can only succeed on an empty directory, so
      // it is impossible for this to delete a file — if anything unexpected is in there, the
      // call simply fails and we leave it alone.
      try {
        await nodeFs.rmdir(dir.fsPath);
      } catch {
        // Not empty, or already gone. Either way, not ours to force.
      }
    }
  }
}

/**
 * Delete vdocs a previous session left behind (a crash, or a window closed without a
 * clean deactivate). Called once at activation.
 *
 * Scoped to our own directory and to names we own — it never recurses, never walks the
 * user's tree, and never touches Posit's `.quarto/vdoc/`. Files stamped with OUR
 * instance id are skipped, since those are the ones this window is actively using.
 *
 * A second window open on the same workspace root is the one case where this deletes a
 * file that is still in use. That is rare (VS Code opens a folder in a single window by
 * default) and self-healing: `ensureVdoc` notices the model is gone and re-mints on the
 * next request. The alternative — leaving other instances' files alone — would mean a
 * crash never gets cleaned up at all, which is the failure this exists to prevent.
 */
export async function sweepStaleVdocs(
  folders: readonly vscode.WorkspaceFolder[],
): Promise<void> {
  await Promise.all(folders.map((folder) => sweepFolder(folder.uri)));
}

async function sweepFolder(folderUri: vscode.Uri): Promise<void> {
  const dir = vscode.Uri.joinPath(folderUri, ...VDOC_DIR_SEGMENTS);
  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(dir);
  } catch {
    return; // no vdoc directory here — nothing this extension ever wrote
  }
  await Promise.all(
    entries.map(async ([name, type]) => {
      // Ownership, not pattern-matching: a name we did not write is not ours to delete,
      // whatever it looks like. Directories are never ours, so they are never touched.
      if (type !== vscode.FileType.File || !isOurVdocFileName(name)) {
        return;
      }
      if (vdocInstanceId(name) === INSTANCE_ID) {
        return; // this window's own live file
      }
      await deleteQuietly(vscode.Uri.joinPath(dir, name));
    }),
  );
}

/**
 * Whether the process `pid` is provably gone — guard G2 of the temp-dir reclaim, and the
 * only thing standing between that delete loop and a live sibling window's data once the
 * host tag (G0) has agreed.
 *
 * **`true` ONLY on `ESRCH`.** `kill(pid, 0)` sends no signal; it just asks the kernel about
 * the process, and it reports three distinguishable outcomes:
 *
 * | outcome | meaning | verdict |
 * |---|---|---|
 * | no throw | alive, and signalable by us | `false` |
 * | `EPERM` | **alive**, but owned by another user | `false` |
 * | `ESRCH` | no such process | `true` |
 *
 * The `EPERM` row is the whole reason this is a named, exported function rather than three
 * inline lines (🐉1). The natural shape — `try { kill(pid,0); alive } catch { dead }` —
 * silently folds `EPERM` into "dead" and thereby reclaims the directory of a *live* process
 * we merely lack permission to signal. That inverts the failure direction of the entire
 * design, from "leak" to "delete the user's source". Measured: `kill(1, 0)` throws `EPERM`
 * on this machine, and pid 1 is demonstrably alive.
 *
 * Anything unexpected also reads as alive: this function's bias is always toward leaving
 * the directory alone. Exported so the inversion can be pinned directly, since no
 * behavioural test through the sweep discriminates it (§8's trap box).
 *
 * Total; never throws.
 */
export function isProcessDead(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return false; // no throw: alive
  } catch (err: unknown) {
    return (err as NodeJS.ErrnoException | undefined)?.code === "ESRCH";
  }
}

/**
 * Reclaim the temp directories a CRASHED session left behind — the untitled-document
 * counterpart of `sweepStaleVdocs`, and the only thing that ever removes them.
 *
 * `disposeAllVdocs` handles the clean-deactivate path, but a SIGKILL, a host teardown or a
 * power loss never reaches it, and what is stranded is not a cache: for an untitled `.qmd`
 * it is the user's actual cell source. Called fire-and-forget at activation, so it must
 * never throw (C6) and must never delay startup.
 *
 * `dir` defaults to the real OS temp dir; tests pass a private root they created. That seam
 * exists because the developer's `$TMPDIR` is concurrently in use by live extension hosts —
 * a delete-loop test must never be pointed at it (plan §4.2).
 *
 * ## The guards, and which of them actually matter
 *
 * A LIVE sibling window's directory passes G1/G3/G4/G5 **by construction** — we named it, we
 * own it, and every file inside it is one we wrote. So those four bound the blast radius
 * against *foreign* data only, and **G0 and G2 are the entire defence** against deleting a
 * live window's source. There is deliberately no defence in depth on the hazard that
 * matters; saying so plainly is more useful than counting guards that cannot fire.
 *
 * Every guard fails toward *leave it alone*.
 */
export async function sweepStaleTempVdocs(dir?: vscode.Uri): Promise<void> {
  // `os.tmpdir()` and `os.hostname()` are inside the try too, deliberately. Both are
  // syscall-backed and neither is total — `hostname(3)` can fail (EPERM under some
  // sandboxes/seccomp filters), and Node rethrows it. They look like plain property reads,
  // which is exactly why they are easy to leave outside a guard; but this function is
  // `void`-called from activate, so ANY throw here is an unhandled rejection during startup.
  let root: string;
  let ours: string;
  let names: string[];
  try {
    root = dir?.fsPath ?? os.tmpdir();
    ours = hostDiscriminator(os.hostname());
    names = await nodeFs.readdir(root);
  } catch {
    return; // no readable temp dir, or no identity to compare against — reclaim nothing
  }
  await Promise.all(
    names.map(async (name) => {
      // G1 — ownership by grammar. `null` is "not ours", which means SKIP; it is never
      // "unparseable, so reclaim it". This directory is shared with every other process
      // on the machine, so anything we do not positively recognise is someone else's.
      const parsed = tempVdocDirParse(name);
      if (parsed === null) {
        return;
      }
      // G0 — a PID is only meaningful inside the namespace that issued it. If this
      // directory was stamped on another machine (an NFS home with a shared TMPDIR) or in
      // another PID namespace (a bind-mounted /tmp), then ESRCH does not mean "dead", it
      // means "meaningless" — and acting on it would delete LIVE data.
      if (parsed.host !== ours) {
        return;
      }
      // Our own live directory. NOTE this precedes the liveness check, which is exactly why
      // `process.pid` cannot be used to test G2 (🐉7): it never reaches it.
      if (parsed.pid === process.pid) {
        return;
      }
      // G2 — only a provably dead owner. EPERM and every surprise read as ALIVE.
      if (!isProcessDead(parsed.pid)) {
        return;
      }
      await reclaimTempVdocDir(path.join(root, name));
    }),
  );
}

/** Delete our own files out of `dirPath`, then the directory — if it is really ours. */
async function reclaimTempVdocDir(dirPath: string): Promise<void> {
  // G3 — a real directory we own, not a symlink someone planted in a world-writable /tmp
  // hoping we would follow it. `lstat` does not traverse, so a symlink fails isDirectory().
  let stat;
  try {
    stat = await nodeFs.lstat(dirPath);
  } catch {
    return;
  }
  if (!stat.isDirectory()) {
    return;
  }
  // `getuid` does not exist on Windows. Treat "cannot ask" as "do not check" rather than as
  // a mismatch: the latter would silently disable this sweep on the ONE platform where it
  // matters most (Windows never reaps its temp dir, so the leak there is unbounded).
  const uid = process.getuid?.();
  if (uid !== undefined && stat.uid !== uid) {
    return;
  }
  let names: string[];
  try {
    names = await nodeFs.readdir(dirPath);
  } catch {
    return;
  }
  await Promise.all(
    names.map(async (name) => {
      // G4 — only files we wrote. A foreign file keeps the directory alive via G5 below,
      // which is the correct outcome: we do not know what it is.
      if (!isOurVdocFileName(name)) {
        return;
      }
      try {
        await nodeFs.unlink(path.join(dirPath, name));
      } catch {
        // Gone already, or not ours to remove. Either way, leave it.
      }
    }),
  );
  // G5 — NON-recursive, deliberately. It can only succeed on an empty directory, so it is
  // structurally incapable of deleting a file G4 declined to claim.
  try {
    await nodeFs.rmdir(dirPath);
  } catch {
    // Not empty (something foreign is in there), or already gone. Not ours to force.
  }
}

/**
 * Where `doc`'s vdocs live: `<workspaceRoot>/.quarto/vdoc-mit/` when the document
 * belongs to a workspace folder, else a private 0700 temp directory (an untitled or
 * out-of-workspace document has no workspace root to write into).
 *
 * The temp directory is a fallback, never the default: writing the user's source into a
 * predictable, world-readable location would be an information disclosure, and
 * `mkdtemp` is what makes the path unpredictable and the directory private.
 *
 * The name carries the two facts `sweepStaleTempVdocs` needs to reclaim this directory if
 * this session never gets to clean it up: which machine made it, and which process owned it.
 * Without them a crash strands the user's source here until the OS clears it — which on
 * Windows is never. `disposeAllVdocs` is the only other thing that removes it, and a SIGKILL
 * never reaches that.
 */
async function vdocDirFor(doc: vscode.TextDocument): Promise<vscode.Uri | undefined> {
  const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
  if (folder !== undefined) {
    const dir = vscode.Uri.joinPath(folder.uri, ...VDOC_DIR_SEGMENTS);
    await vscode.workspace.fs.createDirectory(dir); // idempotent, recursive
    await ensureGitignored(dir);
    return dir;
  }
  // Memoise the in-flight mkdtemp: two concurrent untitled forwards must share ONE temp
  // directory, or the loser's directory leaks (module state, so a check-then-act on the
  // resolved value straddles the await and races).
  //
  // `mintFallback` creates one attempt, memoises it, and returns it. It is the ONLY writer of
  // `fallbackDirPromise` on this path, so the identity guard in its `.catch` and the one in the
  // re-mint branch below both compare against the exact promise they mean to clear.
  const mintFallback = (): Promise<vscode.Uri> => {
    const attempt: Promise<vscode.Uri> = nodeFs
      .mkdtemp(
        path.join(
          os.tmpdir(),
          tempVdocDirPrefix(hostDiscriminator(os.hostname()), process.pid),
        ),
      )
      .then((made) => vscode.Uri.file(made))
      .catch((err: unknown) => {
        // Memoise the ATTEMPT, never the FAILURE. This promise exists only so that concurrent
        // forwards share one in-flight creation; once it has settled as a rejection there is
        // nothing left to share, and keeping it would latch the failure for the whole session —
        // one transient EMFILE/ENOSPC spike leaving completion, hover, go-to-definition and the
        // rest silently dead on every untitled document until the window is reloaded. Clearing it
        // HERE is what makes the next forward retry: `disposeAllVdocs` only runs at deactivate,
        // far too late to be the thing that recovers a live session.
        //
        // Clear the memo only while it is still THIS attempt. `disposeAllVdocs` resets it
        // unconditionally, so a rejection arriving after a deactivate can find a NEWER attempt
        // already memoised — nulling that would strand its directory and start a third `mkdtemp`.
        if (fallbackDirPromise === attempt) {
          fallbackDirPromise = undefined;
        }
        // Rethrow so the caller still degrades to no-forward, exactly as before.
        throw err;
      });
    fallbackDirPromise = attempt;
    return attempt;
  };

  const memo = fallbackDirPromise;
  if (memo === undefined) {
    return mintFallback();
  }
  // The memoised directory can be deleted out from under a live session by the OS reaper (on
  // Linux, ~10 days) or by the user. Writing into a vanished directory does NOT fail:
  // `vscode.workspace.fs.writeFile` re-creates the parent via an internal `mkdirp` that calls
  // `fs.promises.mkdir` with NO mode argument, so it comes back `0777 & ~umask` (0755 measured at
  // umask 022, 0777 world-writable at umask 000). That silently downgrades the privacy the 0700
  // `mkdtemp` established and drops a copy of the user's source into a world-readable location — a
  // real information disclosure on Linux, where `/tmp` is world-listable and `readdir` defeats
  // `mkdtemp`'s unpredictability. There is no `ENOENT` to hook (the re-create is silent), so
  // detect the deletion with an explicit `stat` before handing the directory back.
  const dir = await memo;
  try {
    await nodeFs.stat(dir.fsPath);
    return dir; // still present — the overwhelmingly common path, one extra stat per forward
  } catch {
    // Gone. Re-mint a fresh private directory — but only while `fallbackDirPromise` is STILL the
    // stale promise we found gone. A concurrent forward may already have re-minted (moving the
    // memo on) or a `disposeAllVdocs` may have reset it; clobbering either would strand a
    // directory, the same reason the `.catch` above guards its clear. If we lost that race, share
    // whatever is memoised now (a sibling's freshly-made, still-present directory) or mint if the
    // memo was reset out from under us.
    if (fallbackDirPromise === memo) {
      return mintFallback();
    }
    return fallbackDirPromise ?? mintFallback();
  }
}

/** Directories we have already dropped a `.gitignore` into this session (write it once). */
const gitignored = new Set<string>();

/**
 * Drop a `.gitignore` containing `*` into our vdoc directory the first time we create it,
 * so a user who has not read the README's gitignore guidance still never sees our vdocs as
 * untracked files (and cannot accidentally `git add .` a copy of their own source). This is
 * exactly what Quarto's own CLI does for its `.quarto/` cache. Best-effort — never throws.
 */
async function ensureGitignored(dir: vscode.Uri): Promise<void> {
  const key = dir.toString();
  if (gitignored.has(key)) {
    return;
  }
  gitignored.add(key);
  const gitignore = vscode.Uri.joinPath(dir, ".gitignore");
  try {
    await vscode.workspace.fs.stat(gitignore);
    return; // already there (a previous session) — leave it
  } catch {
    // does not exist — write it
  }
  try {
    await vscode.workspace.fs.writeFile(gitignore, new TextEncoder().encode("*\n"));
  } catch {
    // read-only workspace, etc. The README guidance is the fallback.
  }
}

/** Whether VS Code still holds a model for `uri` (see `ensureVdoc`'s reuse branch). */
function isModelOpen(uri: vscode.Uri): boolean {
  const key = uri.toString();
  return vscode.workspace.textDocuments.some((d) => d.uri.toString() === key);
}

function filesOf(docUri: string): Map<string, vscode.Uri> {
  const existing = docFiles.get(docUri);
  if (existing !== undefined) {
    return existing;
  }
  const created = new Map<string, vscode.Uri>();
  docFiles.set(docUri, created);
  return created;
}

/** Deleting a vdoc is best-effort: it is a cache file, and failing to remove one is never worth an error. */
async function deleteQuietly(uri: vscode.Uri): Promise<void> {
  try {
    await vscode.workspace.fs.delete(uri, { useTrash: false });
  } catch {
    // Already gone (another window's sweep, or the user cleaned .quarto/) — fine.
  }
}
