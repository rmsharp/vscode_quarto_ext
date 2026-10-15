# knitr-print-grids

The grids behind `test/fixtures/knitr-print-*` (Session 309): documents with ONE stray bare fence whose rendered headings say which silenced knitr chunks still PRINT.

| file | what it is |
|---|---|
| `gengeo309.py` | the geometry grid: every sequence of three chunk kinds (print, quiet, echoed, echoed and printing) with the stray fence at each position, plus the fence-pairing simulator that predicted all 256 |
| `gens309.py`, `genfn309.py`, `gencrit309.py` | the statement grid (the whitelist, near misses, options, defaults, masking), the function grid (116 printers, 36 look-alikes) and the test critic's guard rows |
| `render.sh` | renders a directory of documents (3 wide, behind a load gate, pruning `*_files/`) |
| `render309.sh` | the same with `-M keep-md:true`, so each chunk's emitted fences can be read |
| `mktwins309.py`, `chunks309.py` | strip the stray fence from a document set, render it, and read per chunk whether a bare fence was emitted (`bare > 0`): chunk-level ground truth |
| `mkfixture_stm.py` | rebuilds the statements fixture from the rendered grids with the current build |
| `regen.py` | re-renders the documents STORED in every fixture and refreshes their quarto column (needs `quarto`, R and knitr) |

Measured with quarto 1.7.33 / knitr 1.51. Re-measure when the pinned version moves.
