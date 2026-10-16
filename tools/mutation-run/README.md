# The mutation runner

Answers one question about a unit test: **if this one small edit were made to the source, would any test notice?** An edit no test notices is a *survivor*, and the code it edits is
unpinned. The runner applies one edit (a *mutant*) at a time to a throwaway copy of the repository, runs the tests, puts the file back, and prints `KILLED` or `SURVIVES`.
Adopted in Session 316 (g01 of `docs/planning/2026-10-15-backlog-ordering-plan.md`) to replace the untracked per-session scripts of Sessions 312 to 314 (`scratchpad/s312` to
`scratchpad/s314`, now partly gone).

```
python3 tools/mutation-run/run.py tools/mutation-run/mutants/b90-cell-header.json --tests test/unit/cell-header-literal-pins.test.ts
```

Run it **alone**, with nothing else loading the machine: a timing row that flakes under load fails, and a failure is a kill. The titles it prints under each kill (`--titles N`)
are how you tell a real kill from a flake.

## The files

| File | What it is |
|---|---|
| `run.py` | The runner. Python 3 standard library only. `--help` or the docstring at its top lists every option. |
| `test_run.py` | Its self-test: 16 cases, each a throwaway git repository driven through the command line. `python3 tools/mutation-run/test_run.py`, about 6 s. Run it after any edit to `run.py`. |
| `mutants/b90-cell-header.json` | The eleven mutants of `BACKLOG.md`'s "NON-TAIL parts of the four code-cell header literals" item (Session 313's test critic): START_CODE_CELL, `languagesInMarkdown`, the two `CELL_INFO` trims in `qmd/model.ts`, `KNITR_CHUNK_INFO` and `knitrClaims`. Every one is expected `killed` by `test/unit/cell-header-literal-pins.test.ts`. |
| `mutants/run-py-selfcheck.json` | Seventeen mutants of `run.py` itself, killed by `test_run.py`: `python3 tools/mutation-run/run.py tools/mutation-run/mutants/run-py-selfcheck.json --cmd "python3 tools/mutation-run/test_run.py"` (about 100 s). |

## A mutant

```json
{ "name": "S01 START_CODE_CELL leading run is spaces only",
  "file": "src/core/qmd/quarto-yaml-regions.ts",
  "from": "const START_CODE_CELL = /^\\s*(```+)...", "to": "const START_CODE_CELL = /^ *(```+)...",
  "expect": "killed", "why": "a TAB-indented cell fence stops being a cell" }
```

`from` must occur **exactly once** in `file`: a pattern that occurs twice or not at all is `SKIPPED` (exit 4), never guessed at. `expect` is `killed` (the default) or `survives`
(a recorded gap, so a list can say what is known to be unpinned). A `survives` that turns into a kill is a contradiction and exits 1: someone pinned it, so update the list.

## Things that will bite you

- **Source is the COMMITTED tree.** The worktree is made from `--ref` (HEAD by default). `--tests FILE...` copies those files from your working tree first, so a pin row you have not
  committed runs; a source edit you have not committed does not. Commit the source first.
- **Baseline first.** The unmutated tests must be green or nothing below means anything (exit 3).
- **An error is not a kill.** Under the default command (`npx vitest run`) a non-zero exit with no failing test, such as a syntax or import error the mutant caused, is `ERROR`
  (exit 4). With `--cmd` any non-zero exit counts as a kill, because the runner cannot read another tool's summary.
- **Equivalence is argued, not proved.** A survivor may be an edit that changes no answer. Showing that is the session's job and goes in the record; the runner cannot.
- **It never edits the repo you ran it from**, and refuses `--worktree` pointing at a primary clone. It removes the worktree it made; with `--worktree DIR` yours stays.
- Exit codes: 0 all verdicts as expected; 1 a verdict contradicted its `expect`; 2 bad command line or spec; 3 red baseline; 4 a mutant `SKIPPED` or `ERROR`; 5 a file could not be restored.
