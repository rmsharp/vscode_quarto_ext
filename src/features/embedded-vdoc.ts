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

/** A vdoc we currently have on disk, with the content it was written with. */
interface LiveVdoc {
  uri: vscode.Uri;
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

/** Lazily-created fallback directory for documents with no workspace folder (untitled). */
let fallbackDir: vscode.Uri | undefined;
/**
 * The in-flight creation of `fallbackDir`, memoised so two concurrent forwards for an
 * untitled document cannot each run `mkdtemp` and leak the loser's directory. The FIRST
 * caller starts it; every concurrent caller awaits the same promise.
 */
let fallbackDirPromise: Promise<vscode.Uri> | undefined;

/**
 * Write `content` as `key`'s virtual document, open its model, and return its `file:`
 * URI — or `undefined` when no writable location exists, in which case the caller
 * simply does not forward (the same graceful degradation as "no language extension
 * installed"). Never throws.
 *
 * Reuses the existing path when the content is byte-identical (no write, no new
 * model); mints a fresh path and deletes the previous one when it is not.
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
    // completing, re-outlining without an edit) and it is what keeps us off the disk on
    // every keystroke. The `isModelOpen` check makes it self-healing if another window's
    // sweep removed the file underneath us.
    return existing.uri;
  }

  try {
    const dir = await vdocDirFor(doc);
    if (dir === undefined) {
      return undefined;
    }
    version += 1;
    const uri = vscode.Uri.joinPath(dir, vdocFileName(INSTANCE_ID, version, key.ext));
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
    // M1 — MANDATORY, and its absence is silent. Without this the language server is
    // never asked about the document and every forward returns `undefined`.
    await vscode.workspace.openTextDocument(uri);

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
