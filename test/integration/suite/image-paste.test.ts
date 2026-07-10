import * as assert from "node:assert";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  QmdImageDropEditProvider,
  QmdImagePasteEditProvider,
} from "../../../src/providers/image-paste";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

/**
 * Build a hand-built `vscode.DataTransfer` carrying one `image/*` entry.
 *
 * `DataTransferItem`'s own public constructor (`new DataTransferItem(value)`)
 * can never produce a file-backed item — `.asFile()` only resolves for items
 * the editor itself creates (plan `docs/planning/2026-07-09-image-paste-
 * plan.md` §0). BUT `vscode.DataTransfer.set`/iteration do not runtime-
 * validate that the stored value is a genuine `DataTransferItem` instance —
 * confirmed empirically this session — and `findImageFile` only ever calls
 * `.asFile()` duck-typed. So a plain object satisfying the (interface, not
 * class-with-private-state) `DataTransferFile` shape flows through the real
 * registered provider exactly like a real OS-level paste would, letting this
 * suite exercise the REAL byte-read + write + name-collision path — not just
 * mime-routing/fallback, closing most of D1's disclosed gap. What remains
 * genuinely F5-only is the OS clipboard/drag event itself producing the
 * `DataTransferFile` in the first place.
 */
function fileBackedDataTransfer(
  mimeType: string,
  file: { name: string; bytes: Uint8Array },
): vscode.DataTransfer {
  const dataTransferFile: vscode.DataTransferFile = {
    name: file.name,
    uri: undefined,
    data: () => Promise.resolve(file.bytes),
  };
  const item = {
    asFile: () => dataTransferFile,
  } as unknown as vscode.DataTransferItem;
  const dataTransfer = new vscode.DataTransfer();
  dataTransfer.set(mimeType, item);
  return dataTransfer;
}

async function pasteEditsFor(
  document: vscode.TextDocument,
  dataTransfer: vscode.DataTransfer,
): Promise<vscode.DocumentPasteEdit[] | undefined> {
  return new QmdImagePasteEditProvider().provideDocumentPasteEdits(
    document,
    [],
    dataTransfer,
    { only: undefined, triggerKind: vscode.DocumentPasteTriggerKind.Automatic },
    new vscode.CancellationTokenSource().token,
  );
}

async function dropEditsFor(
  document: vscode.TextDocument,
  dataTransfer: vscode.DataTransfer,
): Promise<vscode.DocumentDropEdit[] | undefined> {
  return new QmdImageDropEditProvider().provideDocumentDropEdits(
    document,
    new vscode.Position(0, 0),
    dataTransfer,
    new vscode.CancellationTokenSource().token,
  );
}

describe("Quarto: image paste provider", () => {
  let dir: string;
  let qmdPath: string;
  let document: vscode.TextDocument;

  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  beforeEach(async () => {
    dir = mkdtempSync(path.join(os.tmpdir(), "quarto-ext-imagepaste-"));
    qmdPath = path.join(dir, "notes.qmd");
    writeFileSync(qmdPath, "---\ntitle: Notes\n---\n\nSome text.\n");
    document = await vscode.workspace.openTextDocument(qmdPath);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns undefined for a paste with no image mime type (a normal text paste)", async () => {
    const dataTransfer = new vscode.DataTransfer();
    dataTransfer.set("text/plain", new vscode.DataTransferItem("Some text."));

    assert.strictEqual(await pasteEditsFor(document, dataTransfer), undefined);
  });

  it("returns undefined (falls through, never throws) for an image mime entry a real OS paste never produces (extension-constructed, not file-backed)", async () => {
    // `new vscode.DataTransferItem(value)` is never file-backed -- confirmed
    // firsthand (plan §0) -- unlike `fileBackedDataTransfer` above, which
    // duck-types the file-backed shape a REAL paste does produce.
    const dataTransfer = new vscode.DataTransfer();
    dataTransfer.set("image/png", new vscode.DataTransferItem("not a real file"));

    assert.strictEqual(await pasteEditsFor(document, dataTransfer), undefined);
  });

  it("writes a real file-backed image under images/ and returns the matching insert text", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
    const dataTransfer = fileBackedDataTransfer("image/png", {
      name: "photo.png",
      bytes,
    });

    const edits = await pasteEditsFor(document, dataTransfer);
    assert.ok(edits, "should return one paste edit");
    assert.strictEqual(edits.length, 1);
    assert.strictEqual(edits[0].insertText, "![](images/photo.png)");
    assert.ok(edits[0].additionalEdit, "should carry a createFile edit");

    const applied = await vscode.workspace.applyEdit(edits[0].additionalEdit!);
    assert.ok(applied, "workspace.applyEdit should succeed");

    const writtenPath = path.join(dir, "images", "photo.png");
    assert.ok(existsSync(writtenPath), "images/photo.png should exist on disk");
    assert.deepStrictEqual(new Uint8Array(readFileSync(writtenPath)), bytes);
  });

  it("resolves a non-colliding name when images/photo.png already exists", async () => {
    const imagesDir = path.join(dir, "images");
    mkdirSync(imagesDir);
    writeFileSync(path.join(imagesDir, "photo.png"), "existing");

    const bytes = new Uint8Array([9, 9, 9]);
    const dataTransfer = fileBackedDataTransfer("image/png", {
      name: "photo.png",
      bytes,
    });

    const edits = await pasteEditsFor(document, dataTransfer);
    assert.ok(edits);
    assert.strictEqual(edits[0].insertText, "![](images/photo-1.png)");

    await vscode.workspace.applyEdit(edits[0].additionalEdit!);
    const writtenPath = path.join(imagesDir, "photo-1.png");
    assert.ok(existsSync(writtenPath));
    assert.deepStrictEqual(new Uint8Array(readFileSync(writtenPath)), bytes);
    // The pre-existing file must survive untouched.
    assert.strictEqual(readFileSync(path.join(imagesDir, "photo.png"), "utf8"), "existing");
  });

  it("generates a name (plan §3 Q3) when the file-backed item's name is empty", async () => {
    const bytes = new Uint8Array([1]);
    const dataTransfer = fileBackedDataTransfer("image/jpeg", { name: "", bytes });

    const edits = await pasteEditsFor(document, dataTransfer);
    assert.ok(edits);
    assert.strictEqual(edits[0].insertText, "![](images/image.jpg)");
  });
});

/**
 * `QmdImageDropEditProvider` (plan §3 Q2, operator decision: drag-and-drop
 * parity bundled into v1) — a near-mirror of the paste provider sharing the
 * same core, tested here for its OWN registration/signature/wiring, not a
 * re-proof of naming/collision logic already covered above.
 */
describe("Quarto: image drop provider", () => {
  let dir: string;
  let document: vscode.TextDocument;

  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  beforeEach(async () => {
    dir = mkdtempSync(path.join(os.tmpdir(), "quarto-ext-imagedrop-"));
    writeFileSync(path.join(dir, "notes.qmd"), "---\ntitle: Notes\n---\n\nSome text.\n");
    document = await vscode.workspace.openTextDocument(path.join(dir, "notes.qmd"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns undefined for a drop with no image mime type", async () => {
    const dataTransfer = new vscode.DataTransfer();
    dataTransfer.set("text/uri-list", new vscode.DataTransferItem("file:///x"));

    assert.strictEqual(await dropEditsFor(document, dataTransfer), undefined);
  });

  it("returns undefined (falls through, never throws) for a non-file-backed image entry", async () => {
    const dataTransfer = new vscode.DataTransfer();
    dataTransfer.set("image/png", new vscode.DataTransferItem("not a real file"));

    assert.strictEqual(await dropEditsFor(document, dataTransfer), undefined);
  });

  it("writes a real file-backed dropped image under images/ and returns the matching insert text", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const dataTransfer = fileBackedDataTransfer("image/jpeg", {
      name: "dragged.jpg",
      bytes,
    });

    const edits = await dropEditsFor(document, dataTransfer);
    assert.ok(edits, "should return one drop edit");
    assert.strictEqual(edits.length, 1);
    assert.strictEqual(edits[0].insertText, "![](images/dragged.jpg)");
    assert.ok(edits[0].additionalEdit, "should carry a createFile edit");

    await vscode.workspace.applyEdit(edits[0].additionalEdit!);
    const writtenPath = path.join(dir, "images", "dragged.jpg");
    assert.ok(existsSync(writtenPath), "images/dragged.jpg should exist on disk");
    assert.deepStrictEqual(new Uint8Array(readFileSync(writtenPath)), bytes);
  });
});
