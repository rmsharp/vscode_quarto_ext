import { describe, expect, it } from "vitest";
import { buildNewNotebookCells } from "../../src/core/new-notebook";

/**
 * `buildNewNotebookCells` builds the pure, `vscode`-free cell descriptors for a
 * new Quarto `.ipynb` notebook (BACKLOG item 17e): a raw YAML front-matter cell
 * followed by an empty starter code cell. The adapter
 * (`src/features/new-notebook.ts`) maps each `{ languageId, value }` descriptor
 * to a `vscode.NotebookCellData(NotebookCellKind.Code, value, languageId)`.
 *
 * The front-matter cell carries `languageId: "raw"` because VS Code's built-in
 * `jupyter-notebook` serializer maps a `NotebookCellKind.Code` cell whose
 * `languageId` is `"raw"` to a Jupyter `cell_type: "raw"` cell (verified
 * firsthand against the shipped serializer's `S(t)`), which is how Quarto reads
 * a notebook's YAML front matter.
 */
describe("buildNewNotebookCells", () => {
  it("first cell is the raw YAML front matter for the given title (languageId 'raw')", () => {
    const cells = buildNewNotebookCells("My Notebook");
    expect(cells[0]).toEqual({
      languageId: "raw",
      value: '---\ntitle: "My Notebook"\nformat: html\n---',
    });
  });

  it("second cell is an empty python starter code cell", () => {
    const cells = buildNewNotebookCells("My Notebook");
    expect(cells[1]).toEqual({ languageId: "python", value: "" });
  });

  it("produces exactly two cells (front matter + one starter), with no markdown cell", () => {
    const cells = buildNewNotebookCells("My Notebook");
    expect(cells).toHaveLength(2);
    // No `"markdown"` cell — a resident notebook's markdown headings would leak
    // into the workspace-symbol index, so the starter is deliberately code-only.
    expect(cells.every((c) => c.languageId !== "markdown")).toBe(true);
  });

  it("the front-matter cell value ends at the closing '---' (no trailing blank body line)", () => {
    const [frontMatter] = buildNewNotebookCells("My Notebook");
    expect(frontMatter.value.endsWith("---")).toBe(true);
    expect(frontMatter.value).not.toMatch(/\n\s*$/);
  });

  it("falls back to \"Untitled\" for an empty or whitespace-only title", () => {
    expect(buildNewNotebookCells("")[0].value).toBe(
      '---\ntitle: "Untitled"\nformat: html\n---',
    );
    expect(buildNewNotebookCells("   \t ")[0].value).toBe(
      '---\ntitle: "Untitled"\nformat: html\n---',
    );
  });

  it("escapes embedded double-quotes and backslashes in the title (untrusted input must not break YAML)", () => {
    expect(buildNewNotebookCells('She said "hi" and used C:\\path')[0].value).toBe(
      '---\ntitle: "She said \\"hi\\" and used C:\\\\path"\nformat: html\n---',
    );
  });
});
