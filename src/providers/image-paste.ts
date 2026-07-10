/**
 * `DocumentPasteEditProvider` for `.qmd` documents — pastes a clipboard
 * image as a file under `images/` next to the document (plan §3 Q1,
 * operator decision) and inserts a Markdown image reference (BACKLOG
 * "Phase 7 authoring aids" final item). A thin `vscode` adapter: all
 * naming/collision logic lives in the pure `core/image-paste.ts`. No
 * `package.json` contribution is needed — registering a paste-edit provider
 * needs no manifest entry, same class as `providers/workspace-symbols.ts`.
 *
 * D1 (plan §3, disclosed): no `execute*Provider`-style command exists for
 * paste providers, and `DataTransferItem` cannot be test-synthesized as
 * file-backed — the real byte-read path is F5-only. See
 * `test/integration/suite/image-paste.test.ts` for what IS covered (mime-
 * type routing, the no-file-backed-payload fallback).
 */

import * as vscode from "vscode";
import {
  buildImagePasteInsertText,
  buildImageRelativePath,
  deriveImageName,
  IMAGES_SUBFOLDER,
  resolveNonCollidingName,
} from "../core/image-paste";

export const IMAGE_PASTE_EDIT_KIND =
  vscode.DocumentDropOrPasteEditKind.Empty.append("image");

export function registerImagePasteFeature(
  context: vscode.ExtensionContext,
): void {
  context.subscriptions.push(
    vscode.languages.registerDocumentPasteEditProvider(
      { language: "quarto" },
      new QmdImagePasteEditProvider(),
      {
        pasteMimeTypes: ["image/*"],
        providedPasteEditKinds: [IMAGE_PASTE_EDIT_KIND],
      },
    ),
  );
}

export class QmdImagePasteEditProvider
  implements vscode.DocumentPasteEditProvider
{
  async provideDocumentPasteEdits(
    document: vscode.TextDocument,
    _ranges: readonly vscode.Range[],
    dataTransfer: vscode.DataTransfer,
    _context: vscode.DocumentPasteEditContext,
    _token: vscode.CancellationToken,
  ): Promise<vscode.DocumentPasteEdit[] | undefined> {
    return buildImagePasteEdit(document, dataTransfer);
  }
}

/**
 * Find the first `image/*`-mime entry whose `DataTransferItem` is
 * file-backed. A normal text paste (or an image mime entry that isn't
 * file-backed) yields no match here — callers must fall through to VS
 * Code's default paste behavior in that case, never throw.
 */
export function findImageFile(
  dataTransfer: vscode.DataTransfer,
): { file: vscode.DataTransferFile; mimeType: string } | undefined {
  for (const [mimeType, item] of dataTransfer) {
    if (!mimeType.toLowerCase().startsWith("image/")) continue;
    const file = item.asFile();
    if (file) return { file, mimeType };
  }
  return undefined;
}

/** Existing file names in `dirUri`, or an empty set if it doesn't exist yet. */
async function existingFileNames(dirUri: vscode.Uri): Promise<Set<string>> {
  try {
    const entries = await vscode.workspace.fs.readDirectory(dirUri);
    return new Set(entries.map(([name]) => name));
  } catch {
    return new Set();
  }
}

/**
 * Build the paste edit: write the image under `images/` next to `document`
 * and return an edit that inserts the Markdown reference. Returns
 * `undefined` when the paste payload has no file-backed image (never
 * breaks a normal text paste).
 */
export async function buildImagePasteEdit(
  document: vscode.TextDocument,
  dataTransfer: vscode.DataTransfer,
): Promise<vscode.DocumentPasteEdit[] | undefined> {
  const found = findImageFile(dataTransfer);
  if (!found) return undefined;

  const bytes = await found.file.data();
  const { baseName, ext } = deriveImageName(found.file.name, found.mimeType);
  const imagesDir = vscode.Uri.joinPath(document.uri, "..", IMAGES_SUBFOLDER);
  const taken = await existingFileNames(imagesDir);
  const fileName = resolveNonCollidingName(baseName, ext, (name) =>
    taken.has(name),
  );
  const relativePath = buildImageRelativePath(fileName);
  const destUri = vscode.Uri.joinPath(document.uri, "..", relativePath);

  const workspaceEdit = new vscode.WorkspaceEdit();
  workspaceEdit.createFile(destUri, { contents: bytes });

  const pasteEdit = new vscode.DocumentPasteEdit(
    buildImagePasteInsertText(relativePath),
    "Insert Pasted Image",
    IMAGE_PASTE_EDIT_KIND,
  );
  pasteEdit.additionalEdit = workspaceEdit;
  return [pasteEdit];
}
