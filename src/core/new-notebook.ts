/**
 * Pure, `vscode`-free cell-descriptor builder for `quarto.newNotebook`
 * (CHANGELOG: quarto.newNotebook, Session 112 — create a new Quarto `.ipynb` notebook).
 *
 * Lives in `core/` and MUST NOT import `vscode` (architecture plan §3.3). It
 * returns plain `{ languageId, value }` descriptors; the adapter
 * (`src/features/new-notebook.ts`) maps each to a
 * `vscode.NotebookCellData(NotebookCellKind.Code, value, languageId)`.
 *
 * Both starter cells are code cells (`NotebookCellKind.Code`) — there is no
 * `kind` field because the notebook deliberately has no markdown cell: a
 * resident notebook's markdown-cell headings leak into the workspace-symbol
 * index (see `test/integration/suite/convert-notebook.test.ts:13-21`), so the
 * starter is kept heading-free. The two cells differ only by `languageId`:
 *   - `"raw"`    — the YAML front matter. VS Code's built-in `jupyter-notebook`
 *                  serializer maps a `Code` cell whose `languageId` is `"raw"`
 *                  to a Jupyter `cell_type: "raw"` cell (verified firsthand
 *                  against the shipped serializer's `S(t)`), which is how Quarto
 *                  reads a notebook's front matter.
 *   - `"python"` — the empty starter code cell (mirrors VS Code's own
 *                  `ipynb.newUntitledIpynb`, which seeds a single empty python
 *                  code cell).
 */

import { buildNewDocumentContent } from "./new-document";

/** A `vscode`-free descriptor for one notebook cell. */
export interface NewNotebookCell {
  /** The cell's language (`"raw"` for the front matter, `"python"` for code). */
  languageId: string;
  /** The cell's source text. */
  value: string;
}

/**
 * Build the cell descriptors for a new blank Quarto notebook: a raw YAML
 * front-matter cell (title + `format: html`) followed by an empty python
 * starter code cell. `title` is trimmed and defaults to `"Untitled"`, with
 * `"`/`\` escaped for the double-quoted YAML scalar — the same handling as
 * `buildNewDocumentContent`, reused here so the escaping stays in one place.
 */
export function buildNewNotebookCells(title: string): NewNotebookCell[] {
  // Reuse the document front-matter builder (title normalization + YAML
  // escaping + `format: html`), then strip its trailing blank body line — a
  // cell's value is the YAML block alone, ending at the closing `---`.
  const frontMatter = buildNewDocumentContent(title).trimEnd();
  return [
    { languageId: "raw", value: frontMatter },
    { languageId: "python", value: "" },
  ];
}
