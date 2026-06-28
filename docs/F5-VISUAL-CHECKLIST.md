# F5 Visual Pass — Checklist

A repeatable runbook for the manual F5 (Extension Development Host) visual pass
and README screenshot capture. Automated tests prove the *behavior* of every
feature (`npm test`, `npm run test:integration`); this pass confirms the
*visuals* (popups, the Outline view, the preview pane, colorization) and
produces the Marketplace screenshots.

This exists because there is no `code` CLI in the agent's environment — the
launch-and-eyeball step is operator-only.

## Prerequisites

- VS Code open on this project folder.
- Quarto CLI ≥ 1.7 on `PATH` (for the Preview/Render shots).
- Optional: the R and Julia language extensions (so `{r}` / `{julia}` cells
  colorize in the highlighting shot — Python/OJS always colorize).

## Launch the Extension Development Host

1. In VS Code, press **F5** (Run → Start Debugging). A second VS Code window
   titled **[Extension Development Host]** opens with the extension loaded.
2. In that window, open **`test/fixtures/showcase.qmd`** — one render-clean doc
   built to exercise every feature.

## Screenshots

Capture with **Cmd+Shift+4** (saves a PNG to `~/Desktop`). Target filenames live
under `media/screenshots/`. The README references them with relative paths; the
Marketplace rewrites those to repo raw URLs (so the images must be committed and
pushed).

| # | File | What to frame |
|---|------|---------------|
| 1 | `01-syntax-highlighting.png` | `showcase.qmd` in the editor showing the colorized YAML front matter, prose, and the `{python}` / `{r}` code cells. |
| 2 | `02-outline.png` | The **Outline** view (Explorer sidebar, or breadcrumbs) showing the heading tree nested with the code cells. |
| 3 | `03-completion.png` | Type `@` in prose (e.g. after "see ") — the completion popup showing cross-reference labels (`@sec-…`, `@fig-plot`, `@tbl-results`, `@eq-area`) **and** citekeys (`knuth1984`, `lamport1994`) with titles, coexisting in one list. |
| 4 | `04-preview.png` | **Quarto: Preview** (Command Palette) — the live preview pane beside the editor rendering `showcase.qmd`. |
| 5 | `05-render.png` | *(optional)* **Quarto: Render** — the Output channel showing `Output created:` and/or the "open artifact" prompt. |

Shots 1–3 are must-haves (in-editor, no CLI needed). 4–5 need the Quarto CLI.

## Landing the images

The screenshots auto-save to `~/Desktop`. They are copied into
`media/screenshots/<NN-name>.png` and wired into the README's `## Screenshots`
section. `media/screenshots/**` is excluded from the `.vsix` (the README
references them via repo raw URLs), so the package stays lean — only
`media/icon.png` ships.

## Verify

- `npm run package` → clean `.vsix`, no missing-image / vsce warnings; confirm
  with `vsce ls` that `media/screenshots/**` is **not** listed but
  `media/icon.png` is.
- README image links resolve (relative paths match files on disk).
- Commit and **push** (the Marketplace rewrites relative image paths against
  `origin`'s default branch, so unpushed images won't render in the listing).
