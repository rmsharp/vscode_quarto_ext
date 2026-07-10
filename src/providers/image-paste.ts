/**
 * `DocumentPasteEditProvider` + `DocumentDropEditProvider` for `.qmd`
 * documents — pastes/drops a clipboard or dragged image as a file under
 * `images/` next to the document (plan §3 Q1, operator decision) and
 * inserts a Markdown image reference (BACKLOG "Phase 7 authoring aids"
 * final item; drag-and-drop parity bundled into v1 per plan §3 Q2, operator
 * decision). A thin `vscode` adapter over one shared core: all naming/
 * collision logic lives in the pure `core/image-paste.ts`, and both
 * providers share `buildImageResult` below. No `package.json` contribution
 * is needed — registering paste/drop-edit providers needs no manifest
 * entry, same class as `providers/workspace-symbols.ts`.
 *
 * D1 (plan §3, refined this session): no `execute*Provider`-style command
 * exists for paste/drop providers, and `new vscode.DataTransferItem(value)`
 * (the only public constructor) can never produce a file-backed item. BUT
 * `vscode.DataTransfer` does not runtime-validate that stored values are
 * genuine `DataTransferItem` instances, and this file's own `findImageFile`
 * only ever calls `.asFile()` duck-typed — so a hand-built object satisfying
 * the (interface, not class-with-hidden-state) `DataTransferFile` shape
 * flows through the REAL registered providers exactly like a real OS-level
 * paste/drop would. `test/integration/suite/image-paste.test.ts` exploits
 * this to exercise the real byte-read + write + collision-avoidance path
 * end-to-end, not just mime-routing — substantially narrower than the
 * plan's original D1 framing. What remains genuinely F5-only is the OS
 * clipboard/drag event itself producing the `DataTransferFile` in the first
 * place.
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
export const IMAGE_DROP_EDIT_KIND =
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
    vscode.languages.registerDocumentDropEditProvider(
      { language: "quarto" },
      new QmdImageDropEditProvider(),
      {
        dropMimeTypes: ["image/*"],
        providedDropEditKinds: [IMAGE_DROP_EDIT_KIND],
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
    const result = await buildImageResult(document, dataTransfer);
    if (!result) return undefined;
    const pasteEdit = new vscode.DocumentPasteEdit(
      result.insertText,
      "Insert Pasted Image",
      IMAGE_PASTE_EDIT_KIND,
    );
    pasteEdit.additionalEdit = result.additionalEdit;
    return [pasteEdit];
  }
}

export class QmdImageDropEditProvider
  implements vscode.DocumentDropEditProvider
{
  async provideDocumentDropEdits(
    document: vscode.TextDocument,
    _position: vscode.Position,
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken,
  ): Promise<vscode.DocumentDropEdit[] | undefined> {
    const result = await buildImageResult(document, dataTransfer);
    if (!result) return undefined;
    const dropEdit = new vscode.DocumentDropEdit(
      result.insertText,
      "Insert Dropped Image",
      IMAGE_DROP_EDIT_KIND,
    );
    dropEdit.additionalEdit = result.additionalEdit;
    return [dropEdit];
  }
}

/**
 * Find the first `image/*`-mime entry whose `DataTransferItem` is
 * file-backed. A normal text paste/drop (or an image mime entry that isn't
 * file-backed) yields no match here — callers must fall through to VS
 * Code's default paste/drop behavior in that case, never throw.
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

interface ImageResult {
  readonly insertText: string;
  readonly additionalEdit: vscode.WorkspaceEdit;
}

/**
 * Shared core of both providers: write the image under `images/` next to
 * `document` and return the Markdown insert text + the `WorkspaceEdit` that
 * creates the file. Returns `undefined` when the payload has no file-backed
 * image (never breaks a normal text paste/drop).
 */
async function buildImageResult(
  document: vscode.TextDocument,
  dataTransfer: vscode.DataTransfer,
): Promise<ImageResult | undefined> {
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

  const additionalEdit = new vscode.WorkspaceEdit();
  additionalEdit.createFile(destUri, { contents: bytes });

  return { insertText: buildImagePasteInsertText(relativePath), additionalEdit };
}
