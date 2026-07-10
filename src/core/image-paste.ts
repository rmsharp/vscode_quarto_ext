/**
 * Pure, `vscode`-free helpers for pasting/dropping an image into a `.qmd`
 * document (plan `docs/planning/2026-07-09-image-paste-plan.md`).
 *
 * Destination convention (operator decision, plan §3 Q1): the image is
 * written under an `images/` subfolder next to the document. Lives in
 * `core/` and MUST NOT import `vscode` (architecture plan §3.3).
 */

const EXTENSION_BY_MIME_TYPE: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
};

/** Destination subfolder for pasted/dropped images (plan §3 Q1, operator decision). */
export const IMAGES_SUBFOLDER = "images";

/**
 * Suggest a file extension for a MIME type, or `undefined` if unrecognized.
 */
export function extensionForMimeType(mimeType: string): string | undefined {
  return EXTENSION_BY_MIME_TYPE[mimeType.toLowerCase()];
}

/** A pasted/dropped image's derived base name + extension. */
export interface ImageName {
  readonly baseName: string;
  readonly ext: string;
}

/**
 * Derive a base name + extension for a pasted/dropped image (plan §3 Q3):
 * trust the OS-provided file name when it is present and non-empty (mirrors
 * VS Code's own built-in markdown paste-image behavior); otherwise fall back
 * to a generated `"image"` base name with an extension guessed from the MIME
 * type, defaulting to `"png"` when the MIME type is unrecognized.
 */
export function deriveImageName(
  fileName: string | undefined,
  mimeType: string,
): ImageName {
  const trimmed = fileName?.trim();
  if (trimmed) {
    const dot = trimmed.lastIndexOf(".");
    if (dot > 0 && dot < trimmed.length - 1) {
      return { baseName: trimmed.slice(0, dot), ext: trimmed.slice(dot + 1) };
    }
    return { baseName: trimmed, ext: extensionForMimeType(mimeType) ?? "png" };
  }
  return {
    baseName: "image",
    ext: extensionForMimeType(mimeType) ?? "png",
  };
}

/**
 * First non-colliding `name.ext` / `name-1.ext` / `name-2.ext` / ... within a
 * directory, given an injected existence predicate (the adapter supplies
 * `workspace.fs.stat`) — mirrors VS Code's own `newFilePathGenerator.ts` loop
 * (MIT, read for precedent per plan §0, not copied verbatim).
 */
export function resolveNonCollidingName(
  baseName: string,
  ext: string,
  exists: (candidateName: string) => boolean,
): string {
  const first = `${baseName}.${ext}`;
  if (!exists(first)) return first;
  for (let n = 1; ; n++) {
    const candidate = `${baseName}-${n}.${ext}`;
    if (!exists(candidate)) return candidate;
  }
}

/** The image's path relative to the document, under `IMAGES_SUBFOLDER`. */
export function buildImageRelativePath(fileName: string): string {
  return `${IMAGES_SUBFOLDER}/${fileName}`;
}

/**
 * Markdown image-reference text to insert at the cursor, POSIX-slash-
 * normalized regardless of host platform.
 */
export function buildImagePasteInsertText(relativePath: string): string {
  return `![](${relativePath.replace(/\\/g, "/")})`;
}
