# The real-document measure

How often this extension's Outline agrees with `quarto render` across an **authored corpus** —
real documents, not probes. It is the project's standing answer to *"did that change help?"*, adopted
as such in Session 268 (`docs/REAL-DOCUMENT-RESCORE.md`, Recommendation 4).

```
export REALDOC_DATA=scratchpad/s265                  # the corpus artefacts (personal, untracked)
export REALDOC_ORDINALS=scratchpad/s251/realfiles.txt # the file list that defines ordinals
tools/realdoc-score/run.sh head                       # ~5 s warm
```

```
head: scored 2438 agree 2419 (99.22%) divergent 19 phantom 4 lost 8 level 7
   phantom [1985, 2147, 2275, 3004]
   lost    [482, 491, 610, 1352, 2391, 2519, 2566, 2898]
   level   [837, 838, 840, 841, 842, 843, 847]
```

**Run it after any change to the heading model** (`src/core/qmd/model.ts` and anything feeding
`findHeadings`), and cite the line in the close-out. A change that moves a corpus document in the
losing direction is a defect, whatever the unit tests say.

## What is tracked here, and what is not

**Tracked** — these scripts. They are inert without the corpus.

| stage | file | does |
|---|---|---|
| 1 | `census.test.ts` + `vitest.census.config.ts` | runs a build's shipped `findHeadings` over the frozen corpus → one TSV row per document |
| 2 | `rawhtml_adjust.js` | applies the decision that a raw `<hN>` line is not an Outline heading (Session 267) |
| 3 | `extract_headings.py` | reads quarto's rendered HTML, skipping quarto's own UI furniture (I1) |
| 4 | `score.py` + `scorelib.py` | compares heading LEVEL sequences and reports divergences by ordinal |
| — | `run.sh` | all four, in order |

**Not tracked, and deliberately so** — the corpus. `REALDOC_DATA` must hold:

| file | what |
|---|---|
| `snapshot.json` | the frozen corpus text, `[[path, text], …]` — frozen because documents change on disk between runs (Session 265 measured 95 that did) |
| `quarto_v2.tsv` | quarto's rendered headings per document, extracted with stage 3 |
| `quarto_rmd_keep.tsv`, `rmd_no_r.json`, `htmlcache_keep/` | the re-renders of every `.Rmd` with no R chunk, made under its real extension because the name decides the engine (I3) |

⚠ **The corpus is personal and is never committed.** A tracked file may name a corpus document only
by its **ordinal** — its 1-based line in `REALDOC_ORDINALS` (Learning #548). Every script here
already does; keep it that way when reporting results.

⚠ **The scripts that BUILD the ground truth are not here.** The render passes that produced
`quarto_v2.tsv` and the `.Rmd` cache live in `scratchpad/s251` and `scratchpad/s265` and are
untracked, so a lost corpus cannot be rebuilt from this directory alone. That is a known gap, not an
oversight: those passes render thousands of personal documents and were never written to be reusable.

## Comparing two builds

`run.sh` takes any directory holding `src/`, so a past build scores over byte-identical input:

```
git archive <sha> src | tar -x -C /tmp/build-<sha>
tools/realdoc-score/run.sh <sha> /tmp/build-<sha>
```

Session 265's pre-fix build scores `2418 / 2438`; HEAD scores `2419`, the one document being ordinal
2494 (the 7+ `#` fix, Session 266). Intermediates for each label land in
`$REALDOC_DATA/runs/<label>/`, so two runs can be diffed file by file.

## Reading the number

- **`scored`** excludes documents quarto fails to render and those with `{{< include >}}`, whose
  headings live in another file (Session 251's A1/A3 rules, unchanged).
- **`level`** counts documents where the model and quarto emit the same NUMBER of headings at
  different levels. The seven today are the appendix re-level, which this project has decided not to
  mirror (Session 267) — read them as decided, not open.
- **941 corpus documents have no quarto ground truth at all** and are not scored; nothing measures
  the Outline there.
- The measure is **machine-specific**: it cannot be a CI check or a `.quality-gates.json` gate,
  because the corpus cannot leave this machine.
