/**
 * Pure, `vscode`-free naming + ownership layer for the embedded-language virtual
 * documents (CHANGELOG: embedded-language forwarding did not reach real language servers, Session 87 — the shipped-defect fix; plan §6.1). This module MUST
 * NOT import `vscode` (architecture §3.3) and is unit-tested headlessly.
 *
 * ## Why these files exist at all
 *
 * Every embedded forward (completion / hover / go-to-definition / signature-help in
 * `providers/embedded.ts`, in-cell symbols in `providers/outline.ts`, Format Cell in
 * `features/format-cell.ts`) works by handing the target language's own provider a
 * *virtual document* holding just that language's code. Those vdocs used to live on
 * three custom URI schemes (`quarto-embedded`, `quarto-outline-symbols`,
 * `quarto-format-cell`) served by a `TextDocumentContentProvider`.
 *
 * That silently did not work. Real language servers register their providers against
 * a `documentSelector` scoped to the schemes they can read — typically
 * `file:`/`untitled:`/`vscode-notebook-cell:` — so **no provider was ever registered
 * for our vdocs** and every forward returned nothing, with no error and no warning.
 * Proven firsthand against real Pylance: identical Python content returned 306
 * completions on a `file:` URI and **0** on ours. The vdoc must therefore be a real
 * `file:` document on disk, which is what this module names.
 *
 * ## The safety property this module owns
 *
 * `isOurVdocFileName` drives a DELETE loop (`sweepStaleVdocs`). Posit's Quarto
 * extension writes files of the very same purpose — `.vdoc.<generatedId>.<ext>` —
 * into `<workspaceRoot>/.quarto/vdoc/`, and many users have both extensions
 * installed. Two independent guards keep our sweeper away from their files:
 *
 *  1. We live in a *different directory* (`.quarto/vdoc-mit/`, see `VDOC_DIR_SEGMENTS`)
 *     and never walk outside it.
 *  2. Our filenames carry a *different prefix* (`vdoc-mit.`, never `.vdoc.`), so even
 *     a mistaken sweep of their directory could not claim ownership of their files.
 *
 * The prefix — rather than, say, counting dot-separated segments — is what makes the
 * non-collision structural instead of incidental: no id Posit can generate will ever
 * turn `.vdoc.<id>.<ext>` into something starting with `vdoc-mit.`.
 *
 * Note also the deliberate absence of a leading dot. The containing directory is
 * already hidden, so a dotted filename buys nothing — and it would opt these files
 * into every tool's "ignore hidden files" default glob, which Pyright/Pylance ship.
 */

/** Which shape of content a vdoc holds — the two are NOT interchangeable. */
export type VdocKind =
  /** Every cell of one language (`buildVirtualContent`) — cursor-position forwards. */
  | "lang"
  /** Exactly one cell (`buildCellVirtualContent`) — in-cell symbols, Format Cell. */
  | "cell";

/** Identifies a vdoc's *content*, independent of which revision of it is on disk. */
export interface VdocKey {
  /** The owning `.qmd`'s URI, as `uri.toString()`. */
  docUri: string;
  /** The VS Code languageId the vdoc forwards to, e.g. `"python"`. */
  languageId: string;
  /** The vdoc's file extension (no dot), e.g. `"py"` — this is what makes VS Code resolve its languageId. */
  ext: string;
  kind: VdocKind;
  /** Required when `kind === "cell"`; ignored otherwise. */
  cellStartLine?: number;
}

/**
 * The directory our vdocs live in, relative to the workspace root. Under `.quarto/`
 * so it inherits the gitignore convention users already apply to Quarto's cache —
 * but `vdoc-mit`, never `vdoc`, which is Posit's (see the module docstring).
 */
export const VDOC_DIR_SEGMENTS: readonly string[] = [".quarto", "vdoc-mit"];

/** `vdoc-mit.<instanceId>.<version>.<ext>` */
const NAME_RE = /^vdoc-mit\.([0-9a-z]+)\.([0-9]+)\.[0-9A-Za-z]+$/;

/**
 * A short, stable tag for the machine (strictly: the PID namespace) a temp vdoc
 * directory was created in — guard G0 of the crash-reclaim sweep.
 *
 * **Why this exists at all.** The reclaim sweep asks `kill(pid, 0)` whether the host that
 * made a directory is still alive. That question is only meaningful *within one PID
 * namespace*: for a PID minted somewhere else, `ESRCH` does not mean "dead", it means
 * "meaningless" — and acting on it would delete a LIVE window's directory. This tag is
 * what refuses to ask the question outside the namespace it can be answered in.
 *
 * Deliberately **not** a cryptographic hash and **not** a security control: it is a scope
 * tag. FNV-1a keeps this module dependency-free, which is what lets it be unit-tested
 * headlessly (architecture §3.3).
 *
 * ## The residual risk, stated in the honest direction
 *
 * The two ways this tag can be wrong fail in OPPOSITE directions, and it is worth being
 * exact about which is which:
 *
 *  - **The hostname CHANGES** (DHCP, a rename, a laptop moving networks). Our own older
 *    directories now carry a tag we no longer mint, so G0 skips them and they are never
 *    reclaimed. That is a **leak** — the safe direction, and the common case.
 *  - **Two hostnames COLLIDE** onto one tag. Then G0 **fails open**: `parsed.host === ours`
 *    passes for a directory stamped on a *different* machine, and G2 goes on to ask
 *    `kill(pid, 0)` about a PID from a namespace it cannot answer for — which is precisely
 *    the question G0 exists to prevent. A dead-looking answer then **deletes a live
 *    window's unsaved source**. This is the unsafe direction.
 *
 * So a collision is **not** free, and the liveness check is **not** a backstop against it —
 * it is the mechanism through which the damage happens. The reason to accept 24 bits anyway
 * is that the collision only *matters* when two machines share one `$TMPDIR` (an NFS home
 * with `TMPDIR=$HOME/tmp`, a bind-mounted `/tmp`), which is already unusual; absent that,
 * two machines never see each other's directories and a colliding tag is inert. Measured:
 * `hostDiscriminator("node7582.cluster.local") === hostDiscriminator("node8137.cluster.local")
 * === "477c36"`, and the birthday bound over 2^24 gives P(any collision) ≈ 3% at 1000 hosts.
 * Low, but not zero — do not widen this to a "never".
 *
 * Total; never throws.
 */
export function hostDiscriminator(hostname: string): string {
  let h = 0x811c9dc5; // FNV-1a 32-bit offset basis
  for (let i = 0; i < hostname.length; i += 1) {
    h ^= hostname.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  // `>>> 0` reads the bits as unsigned; pad-then-slice makes the width exactly 6,
  // which is what the anchored grammar requires.
  return (h >>> 0).toString(16).padStart(8, "0").slice(0, 6);
}

/**
 * The string handed to `mkdtemp` for an untitled document's private temp directory:
 * `` `quarto-mit-vdoc-<host>-<pid>-` ``.
 *
 * **The trailing `-` is load-bearing** (🐉2). `mkdtemp` appends its six random characters
 * with no separator of its own, so without the dash it produces
 * `quarto-mit-vdoc-2954b2-93497OU5bb0` — which `tempVdocDirParse` matches *not at all*.
 * The sweep would then silently reclaim nothing, forever. That is a total failure in the
 * *safe* direction, which is exactly why only an exact-string unit assertion catches it.
 *
 * Total; never throws.
 */
export function tempVdocDirPrefix(host: string, pid: number): string {
  return `quarto-mit-vdoc-${host}-${pid}-`;
}

/**
 * `quarto-mit-vdoc-<host>-<pid>-<6 random chars>` — the directory `tempVdocDirPrefix`
 * asks `mkdtemp` for, once it has appended its suffix.
 *
 * Anchored at both ends, exactly like `NAME_RE`: no accepted name can contain a `/` or a
 * `..`, so a parsed name can never escape the directory being swept.
 */
const TEMP_DIR_RE = /^quarto-mit-vdoc-([0-9a-f]{6})-([0-9]+)-[A-Za-z0-9]{6}$/;

/** The host tag and owning PID a temp vdoc directory name carries. */
export interface TempVdocDir {
  /** The `hostDiscriminator` of the machine that created it (guard G0). */
  host: string;
  /** The PID of the extension host that created it (guard G2's liveness key). */
  pid: number;
}

/**
 * Read the host tag and owning PID out of a temp vdoc directory's basename, or `null` if
 * the name is not one of ours.
 *
 * **`null` means NOT-OURS, which means SKIP — never "unparseable, so reclaim it".** This
 * is the ownership gate on a delete loop running in a directory shared with every other
 * process on the machine; anything it does not positively recognise belongs to someone
 * else. Total; never throws.
 */
export function tempVdocDirParse(name: string): TempVdocDir | null {
  const m = TEMP_DIR_RE.exec(name);
  if (m === null) {
    return null;
  }
  // Safe: the grammar admits only `[0-9]+` here, so this cannot be NaN.
  return { host: m[1], pid: Number(m[2]) };
}

/**
 * An exact, collision-free identity string for `key` — used to look a vdoc up in the
 * live-set map. Deliberately NOT a hash: an accidental collision between two distinct
 * cells would make them evict each other's files mid-forward.
 *
 * The separator is a NUL byte, written as the escape `"\0"` in source so this file
 * stays plain text to git and grep. (A raw NUL byte here made git and grep read the
 * whole file as binary, defeating the mandatory grep inventory; see CHANGELOG: vdoc-path NUL-separator source hygiene, Session 105.) A
 * NUL cannot occur in a URI, a languageId, or an extension, so no combination of
 * field values can forge another key's string.
 */
export function vdocKeyString(key: VdocKey): string {
  const cell = key.kind === "cell" ? String(key.cellStartLine ?? -1) : "";
  return [key.docUri, key.languageId, key.ext, key.kind, cell].join("\0");
}

/**
 * The vdoc's file name. Pure; no I/O.
 *
 * Uniqueness comes from `version`, which the adapter increments on every write, so
 * two distinct writes can never land on the same path — no hashing, and therefore no
 * hash-collision failure mode. `instanceId` scopes the name to one extension host, so
 * a second window's files are recognizable as *not ours* during a sweep.
 */
export function vdocFileName(
  instanceId: string,
  version: number,
  ext: string,
): string {
  return `vdoc-mit.${instanceId}.${version}.${ext}`;
}

/**
 * Whether `name` is a vdoc *this extension* created — the ownership gate on every
 * delete. Must never accept Posit's `.vdoc.<id>.<ext>`. Total; never throws.
 */
export function isOurVdocFileName(name: string): boolean {
  return NAME_RE.test(name);
}

/**
 * The extension-host instance that created `name`, or `null` if `name` is not ours.
 * The sweeper uses this to tell its own leftovers from another window's.
 */
export function vdocInstanceId(name: string): string | null {
  return NAME_RE.exec(name)?.[1] ?? null;
}
