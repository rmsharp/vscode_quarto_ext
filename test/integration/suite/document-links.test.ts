import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const FIXTURE_DIR = path.resolve(ROOT, "test/fixtures/document-links");
const QUARTO_YML = path.resolve(FIXTURE_DIR, "_quarto.yml");

/** Our file-path links for `file` (scoped to targets inside the fixture dir, so a
 *  stray built-in/URL link from another provider can never skew the count). */
async function fileLinksFor(file: string): Promise<vscode.DocumentLink[]> {
  const uri = vscode.Uri.file(file);
  await vscode.workspace.openTextDocument(uri);
  const links =
    (await vscode.commands.executeCommand<vscode.DocumentLink[]>(
      "vscode.executeLinkProvider",
      uri,
    )) ?? [];
  return links.filter((l) => l.target?.fsPath.startsWith(FIXTURE_DIR + path.sep));
}

/** The single link whose range starts on 0-based `line`, or undefined. */
function linkOnLine(
  links: vscode.DocumentLink[],
  line: number,
): vscode.DocumentLink | undefined {
  return links.find((l) => l.range.start.line === line);
}

describe("Quarto: _quarto.yml document links (file-path values)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("links a file-path value that resolves to a real file on disk", async () => {
    const links = await fileLinksFor(QUARTO_YML);
    // `bibliography: refs.bib` is on line 7 (0-indexed) and refs.bib exists.
    const link = linkOnLine(links, 7);
    assert.ok(link, "expected a document link on the bibliography: refs.bib line");
    assert.strictEqual(link.target?.fsPath, path.resolve(FIXTURE_DIR, "refs.bib"));
  });

  it("links a value anywhere in the document, not only under project:/website:/book: (whole-document scope, gate-d)", async () => {
    // `bibliography:` sits at the document root, OUTSIDE the three closed-schema
    // containers. Only a genuinely whole-document scanner links it. Break-revert:
    // narrowing findPathValueCandidates to those containers turns THIS red while
    // the `- data/notes.txt` (under project:) link below stays green.
    const links = await fileLinksFor(QUARTO_YML);
    assert.ok(
      linkOnLine(links, 7),
      "bibliography: refs.bib (line 7, at document root) must be linked",
    );
  });

  it("links a block-sequence item value", async () => {
    const links = await fileLinksFor(QUARTO_YML);
    // `    - data/notes.txt` is on line 4.
    const link = linkOnLine(links, 4);
    assert.ok(link, "expected a link on the `- data/notes.txt` sequence item");
    assert.strictEqual(
      link.target?.fsPath,
      path.resolve(FIXTURE_DIR, "data/notes.txt"),
    );
  });

  it("links a directory value too, not only files (plan §9 Q4)", async () => {
    const links = await fileLinksFor(QUARTO_YML);
    // `  output-dir: assets` is on line 2; `assets` is a real directory.
    const link = linkOnLine(links, 2);
    assert.ok(link, "expected a link on output-dir: assets (a directory)");
    assert.strictEqual(link.target?.fsPath, path.resolve(FIXTURE_DIR, "assets"));
  });

  it("does NOT link a value that resolves to nothing on disk", async () => {
    const links = await fileLinksFor(QUARTO_YML);
    // `csl: nonexistent.csl` is on line 8 — no such file.
    assert.strictEqual(
      linkOnLine(links, 8),
      undefined,
      "a non-existent path value must never be linked",
    );
  });

  it("does NOT link a value containing a glob `*` (plan §5.2)", async () => {
    const links = await fileLinksFor(QUARTO_YML);
    // `    - "*.qmd"` is on line 5.
    assert.strictEqual(
      linkOnLine(links, 5),
      undefined,
      "a glob-looking value must never be linked",
    );
  });

  it("produces exactly the 3 real-file/dir links and nothing else", async () => {
    const links = await fileLinksFor(QUARTO_YML);
    const lines = links.map((l) => l.range.start.line).sort((a, b) => a - b);
    assert.deepStrictEqual(
      lines,
      [2, 4, 7],
      `expected links only on lines 2/4/7, got lines ${lines.join(",")}`,
    );
  });
});
