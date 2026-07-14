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
 * `sweepStaleVdocs` deletes files inside the user's workspace, so it is bounded by
 * two independent guards, both owned by `core/embedded/vdoc-path.ts`: it only ever
 * reads our own directory (`.quarto/vdoc-mit/`, never Posit's `.quarto/vdoc/`), and
 * within it only deletes names `isOurVdocFileName` claims. It never recurses, never
 * pattern-matches across the workspace, and never deletes a file this window is
 * still using.
 */

import { promises as nodeFs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import {
  isOurVdocFileName,
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

/** A vdoc we currently have on disk, with the (canonicalized) content it was written with. */
interface LiveVdoc {
  uri: vscode.Uri;
  /** Always `canonicalize`d — the exact bytes on disk, and what reuse is decided against. */
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

/** Lazily-created fallback directory for documents with no workspace folder (untitled). */
let fallbackDir: vscode.Uri | undefined;
/**
 * The in-flight creation of `fallbackDir`, memoised so two concurrent forwards for an
 * untitled document cannot each run `mkdtemp` and leak the loser's directory. The FIRST
 * caller starts it; every concurrent caller awaits the same promise.
 */
let fallbackDirPromise: Promise<vscode.Uri> | undefined;

/**
 * Collapse every whitespace-only line to an empty one, leaving all other lines byte-exact.
 *
 * This is the form a vdoc is WRITTEN in, and the form its reuse is decided by — and it is
 * what keeps semantic tokens off the per-keystroke disk-write path (plan 🐉8).
 *
 * The builders are LENGTH-PRESERVING: every line that is not the target language's code is
 * blanked to an EQUAL-LENGTH run of spaces, which is precisely what gives the identity
 * coordinate mapping. The cost is that the vdoc's bytes then depend on the length of the
 * user's PROSE. Typing one character in a paragraph lengthens a blanked run, so the vdoc
 * changes, so the byte-comparison below can never hit — and a fresh file is minted,
 * written, opened, and the old one deleted, on every debounced pass, for every language in
 * the document, while the user types. Every line of code was identical each time.
 *
 * Collapsing the blanks removes that dependency entirely: the vdoc becomes a function of
 * the CODE alone, so a prose edit produces byte-identical content and reuses the open model.
 * Nothing that matters is lost:
 *
 *  - **Line indices are preserved** — a line becomes empty, never disappears. The newline
 *    count is untouched, and `vscode.Position` is (line, character), not an offset, so
 *    positions and ranges still pass through unchanged.
 *  - **Every column that anyone can address is preserved.** Requests are only ever made
 *    inside a cell BODY, and results only ever come back from one; those lines are kept
 *    verbatim by every builder. No token, symbol, definition or completion has ever landed
 *    on a blanked line — that is what blanking is FOR.
 *  - **Every language reads a whitespace-only line and an empty one identically.** Python
 *    ignores a blank line outright (it generates no NEWLINE and does not touch the
 *    indentation stack); R, Julia and JavaScript treat whitespace as insignificant.
 *
 * It is also strictly safer than the alternative it replaces (comparing a canonical form
 * while still serving the OLD file): that would leave a vdoc on disk whose blanked lines
 * have lengths the document no longer has, and a formatter DOES touch those lines — Format
 * Cell's fence-deletion bug (Session 87) was a real formatter trimming exactly them. Here
 * the file always holds exactly the bytes the comparison approved, so no stale vdoc exists
 * to reason about.
 */
function canonicalize(content: string): string {
  return content
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : line))
    .join("\n");
}

/**
 * Write `content` as `key`'s virtual document, open its model, and return its `file:`
 * URI — or `undefined` when no writable location exists, in which case the caller
 * simply does not forward (the same graceful degradation as "no language extension
 * installed"). Never throws.
 *
 * Reuses the existing path when the content is unchanged (no write, no new model); mints a
 * fresh path and deletes the previous one when it is not. "Unchanged" is judged — and the
 * file is written — in `canonicalize`d form, so an edit that alters only prose reuses the
 * vdoc while an edit that alters CODE still mints a fresh path.
 */
export async function ensureVdoc(
  doc: vscode.TextDocument,
  key: VdocKey,
  content: string,
): Promise<vscode.Uri | undefined> {
  const canonical = canonicalize(content);
  const ks = vdocKeyString(key);
  const existing = live.get(ks);
  if (existing !== undefined && existing.content === canonical && isModelOpen(existing.uri)) {
    // Unchanged content: the open model already holds exactly these bytes, so there is
    // nothing to invalidate and nothing to write. This is the common case (hovering,
    // completing, re-outlining without an edit — and now every prose keystroke) and it is
    // what keeps us off the disk. The `isModelOpen` check makes it self-healing if another
    // window's sweep removed the file underneath us.
    return existing.uri;
  }

  // The owner's dispose count as of NOW, before any await. If it moves while we are
  // writing and opening, the `.qmd` we are doing this for has been closed underneath us.
  const epoch = epochOf(key.docUri);

  try {
    const dir = await vdocDirFor(doc);
    if (dir === undefined) {
      return undefined;
    }
    version += 1;
    const uri = vscode.Uri.joinPath(dir, vdocFileName(INSTANCE_ID, version, key.ext));
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(canonical));
    // M1 — MANDATORY, and its absence is silent. Without this the language server is
    // never asked about the document and every forward returns `undefined`.
    await vscode.workspace.openTextDocument(uri);

    if (epochOf(key.docUri) !== epoch) {
      // The document closed while we were working. `disposeVdocs` has already run and will
      // not run again, so registering this file would strand it — and it holds a copy of
      // the user's source. Delete it and forward nothing; the caller degrades exactly as
      // it does when no vdoc can be written at all.
      await deleteQuietly(uri);
      return undefined;
    }

    live.set(ks, { uri, content: canonical });
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
  const all = [...docFiles.values()].flatMap((m) => [...m.values()]);
  live.clear();
  docFiles.clear();
  await Promise.all(all.map((uri) => deleteQuietly(uri)));

  // Remove the fallback temp directory too, or every session that ever touched an
  // untitled `.qmd` would leave an empty directory behind in the OS temp dir forever.
  //
  // `rmdir` is deliberately NOT recursive: it can only succeed on an empty directory, so
  // it is impossible for this to delete a file — if anything unexpected is in there, the
  // call simply fails and we leave it alone.
  if (fallbackDir !== undefined) {
    const dir = fallbackDir;
    fallbackDir = undefined;
    fallbackDirPromise = undefined;
    try {
      await nodeFs.rmdir(dir.fsPath);
    } catch {
      // Not empty, or already gone. Either way, not ours to force.
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
 * Where `doc`'s vdocs live: `<workspaceRoot>/.quarto/vdoc-mit/` when the document
 * belongs to a workspace folder, else a private 0700 temp directory (an untitled or
 * out-of-workspace document has no workspace root to write into).
 *
 * The temp directory is a fallback, never the default: writing the user's source into a
 * predictable, world-readable location would be an information disclosure, and
 * `mkdtemp` is what makes the path unpredictable and the directory private.
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
  if (fallbackDirPromise === undefined) {
    fallbackDirPromise = nodeFs
      .mkdtemp(path.join(os.tmpdir(), "quarto-mit-vdoc-"))
      .then((made) => {
        fallbackDir = vscode.Uri.file(made);
        return fallbackDir;
      });
  }
  return fallbackDirPromise;
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
