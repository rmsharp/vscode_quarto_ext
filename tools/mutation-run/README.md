# The mutation runner

Answers one question about a unit test: **if this one small edit were made to the source, would any test notice?** An edit no test notices is a *survivor*, and the code it edits is
unpinned. The runner applies one edit (a *mutant*) at a time to a throwaway copy of the repository, runs the tests, puts the file back, and prints `KILLED` or `SURVIVES`.
Adopted in Session 316 (g01 of `docs/planning/2026-10-15-backlog-ordering-plan.md`) to replace the untracked per-session scripts of Sessions 312 to 314 (`scratchpad/s312` to
`scratchpad/s314`).

```
python3 tools/mutation-run/run.py tools/mutation-run/mutants/b90-cell-header.json --tests test/unit/cell-header-literal-pins.test.ts
```

Run it **alone**, with nothing else loading the machine: a timing row that flakes under load fails, and a failure is a kill. The titles it prints under each kill (`--titles N`, one
per failing test) are how you tell a real kill from a flake. On a loaded machine run the pin files only (`--tests`); a whole-suite run (`--tests` omitted) needs a quiet one and its
baseline goes red on the load-sensitive rows of `qmd-model.test.ts` and `pathological-inputs.test.ts`, which the runner reports as exit 3 rather than guessing.

## The files

| File | What it is |
|---|---|
| `run.py` | The runner. Python 3 standard library only. The docstring at its top lists every option and exit code. |
| `test_run.py` | Its self-test: 28 cases, each a throwaway git repository driven through the command line. `python3 tools/mutation-run/test_run.py`, about 20 s on an idle machine. Run it after any edit to `run.py`. |
| `mutants/b90-cell-header.json` | The eleven mutants of the `BACKLOG.md` item this drained, "The NON-TAIL parts of the four code-cell header literals ..." (Session 313's test critic): START_CODE_CELL, `languagesInMarkdown`, the two `CELL_INFO` trims in `qmd/model.ts`, `KNITR_CHUNK_INFO` and `knitrClaims`. All `killed` by `test/unit/cell-header-literal-pins.test.ts`. |
| `mutants/b90-neighbours.json` | Fifteen neighbours of those (the same literal part spelled another way): thirteen `killed`; E01 and E02 were recorded here as equivalent, and E01 was refuted by Session 316's review (its row is in the pins file, and the entry now says `killed`), E02 stays `survives` with its argument in `why`. |
| `mutants/b90-review.json` | Session 316's review round: edits two adversarial reviewers invented for the same literals and that the whole suite let live; each is `killed` by a row in the pins file. |
| `mutants/b90-residual.json` | What the review round found that is **not** pinned: `survives`, with the reason in `why` (equivalent, or filed in `BACKLOG.md`). A survivor that turns into a kill exits 1 here: someone pinned it, so move it to `b90-review.json`. |
| `mutants/run-py-selfcheck.json` | Thirty-three mutants of `run.py` itself, killed by `test_run.py`: `python3 tools/mutation-run/run.py tools/mutation-run/mutants/run-py-selfcheck.json --cmd "python3 tools/mutation-run/test_run.py"` (about 5 minutes: 33 mutants times a 20 s self-test). |

## A mutant

```json
{ "name": "S01 START_CODE_CELL leading run is spaces only",
  "file": "src/core/qmd/quarto-yaml-regions.ts",
  "from": "const START_CODE_CELL = /^\\s*(```+)...", "to": "const START_CODE_CELL = /^ *(```+)...",
  "expect": "killed", "why": "a TAB-indented cell fence stops being a cell" }
```

`from` must occur **exactly once** in `file`, overlapping matches counted: a pattern that occurs twice or not at all is `SKIPPED` (exit 4), never guessed at. `file` must stay
inside the worktree: an absolute path, a `..` that leaves it, or a symlink out of it (the linked `node_modules`, a committed symlink) is `SKIPPED`, so the repo you ran it from is
never edited. `expect` is `killed` (the default) or `survives` (a recorded gap, so a list can say what is known to be unpinned). A `survives` that turns into a kill is a
contradiction and exits 1.

## Things that will bite you

- **Source is the COMMITTED tree.** The worktree is made from `--ref` (HEAD by default). `--tests FILE...` copies those files from your working tree first, so a pin row you have not
  committed runs; a source edit you have not committed does not. Commit the source first.
- **`--worktree DIR` uses a linked worktree of yours as it stands**: nothing is copied into it (so `--tests` names files already there), `--ref` is refused, the source is whatever
  is in it, and it is left in place with the mutated file restored. A primary clone or a subdirectory is refused (exit 2).
- **Baseline first.** The unmutated tests must be green or nothing below means anything (exit 3).
- **An error is not a kill.** Under the default command (`npx vitest run`) a non-zero exit with no failing test, such as a syntax or import error the mutant caused, is `ERROR`
  (exit 4). With `--cmd` any non-zero exit counts as a kill, because the runner cannot read another tool's summary.
- **A timeout is a kill, and the one a loaded machine can fake.** A run past `--timeout` (600 s by default) is killed with its whole process group (`npx`, node, every worker) and
  reported `KILLED (timeout)` with no titles. A mutant that makes a regex catastrophic really does hang the suite, so it is a legitimate kill, but read the time before you trust it.
- **Equivalence is argued, not proved.** A survivor may be an edit that changes no answer. Showing that is the session's job and goes in `why`; the runner cannot. Session 316
  recorded one wrongly (E01, "equivalent after 2,520 documents"); a reviewer needed a header with an option tail pandoc refuses, under a lazy line. Say how hard you looked.
- **The dirty report compares with the state before the run**: `worktree after the run: clean` means the run changed no tracked file; `DIRTY [...]` lists the new changes (a test that
  writes a snapshot, for example).
- **Titles** are `FAIL ...` lines (vitest's summary), `FAIL:` and `ERROR:` lines (unittest); another reporter prints none.
- Exit codes: 0 all verdicts as expected; 1 a verdict contradicted its `expect`; 2 bad command line or spec; 3 red baseline; 4 a mutant `SKIPPED` or `ERROR` (**4 outranks 1** when
  both occur); 5 a file could not be restored (the worktree is left in place and named); 6 an unexpected failure (the cleanup still ran); 130 Ctrl-C; 143 SIGTERM.
