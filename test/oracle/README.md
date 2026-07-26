# The end-to-end exit-code oracle

```bash
npm run test:oracle
```

Runs this extension's **own** cell-option flag decision over a corpus of 66 documents,
renders each one with the real `quarto` CLI, and compares the two answers.

It exists because unit tests prove we do what we *think* quarto does. This proves what
quarto *actually* does. The two questions it answers are the only ones that matter:

| Outcome | Meaning | Verdict |
|---|---|---|
| **cardinal false positive** | We squiggle a document `quarto render` accepts | **The cardinal sin.** The user sees an error on correct work. |
| **lost true positive** | Quarto rejects a value and we stay silent | Safe. Counted and named, never silently accepted. |
| agree | Both flag, or neither | Fine. |
| unrelated | Quarto failed without producing validation text | Scored as *nothing* — see below. |

It is **opt-in** and lives outside `test/unit/`, so `npm test` stays hermetic and fast. It
needs `quarto` on `PATH`, takes about a minute on a cold cache, and its verdict depends on
the installed quarto **version**. The pure logic it composes — verdict parsing,
classification, comparison — is pinned in `test/unit/oracle-*.test.ts` and **does** run in
the default suite.

## Why this exists

It was the primary safety evidence for Sessions 164 and 165, and for both of them it lived
only in a disposable session scratchpad. That meant the strongest claim either session made
— "0 regressed" — could not be re-checked by anyone afterwards. Committing it makes the
claim reproducible.

## What it measured when committed (Session 166, quarto 1.7.33)

| Build | agree | lost TP | **cardinal FP** |
|---|---|---|---|
| this build | 59 | 3 | **4** |
| pre-S165 (`87b3f38`) | 41 | 9 | **16** |

18 rows are better in this build than in the pre-S165 one, and none are worse. All four
remaining cardinal false positives are also wrong in the pre-S165 build — that is, they are
**PRE-EXISTING and were established by replay, not by assertion**. `baseline.json` names the
mechanism and the filed `BACKLOG.md` item for each.

## Replaying another build

This is the capability that turns "I think this is safe" into a number:

```bash
git archive 87b3f38 src | tar -x -C /tmp/old
QMD_ORACLE_SRC=/tmp/old/src npm run test:oracle
```

The build under test is a parameter, not a constant. Vitest transforms TypeScript from an
arbitrary absolute path, so an archived tree needs no build step of its own (the oracle's
config widens `server.fs.allow` for exactly this). A build older than S164 has no
`core/document-engine` and will fail to load — correct, since the decision path being
replayed does not exist there.

## The three gates

1. **A regression fails the run, with every regressed row named.** Counting rather than
   naming is how a report says "0 regressed" while nobody looks at which rows moved.
2. **A baseline row recorded as wrong must carry a written reason** (`known` in
   `baseline.json`). When the oracle fails, the cheapest way to make it pass is to re-seed
   the baseline; this makes that a deliberate, reviewable edit rather than a regeneration.
3. **A row present in only one of baseline/run is reported incomparable, never dropped.**

A missing baseline seeds itself and *still* fails, so bootstrapping can never read as a pass.

## What it does NOT prove — read this before quoting a number

- **The corpus is the horizon.** A clean run is evidence about *these 66 documents*, not a
  property of the change. S165's own 48-document version reported "18 improved, 0 regressed"
  while **twelve regressions sat just outside it**, on front-matter shapes it had not
  thought to include. **When you touch the engine-scoping path, add the shapes you touched
  before believing the number.**
- **`flags.ts` is a MIRROR, not the feature.** `computeValueDiagnostics` imports `vscode`
  and takes a `vscode.TextDocument`, so it cannot be called headlessly; the mirror re-walks
  the same steps over the same core modules. If the feature's loop changes and the mirror
  does not, the oracle keeps producing confident numbers about a decision the product no
  longer makes. This is its single biggest weakness. Two things hold it honest, neither
  sufficient alone: every step is pinned against the real core modules in
  `test/unit/oracle-flags.test.ts`, and the step order and `continue` reasons are kept
  verbatim so the two loops can be diffed by eye. **The principled fix — lifting the
  decision into `src/core/` so the feature and the harness share one implementation — is
  filed in `BACKLOG.md`.** S165's scratchpad mirror had already drifted: it omitted the
  `validate-yaml` escape hatch entirely, and no corpus row could have caught it.
- **Cell options only.** The feature also validates top-level and nested front-matter
  scalars and the format name. A corpus row that turned on one of those would be scored
  wrong here.
- **An exit code is not a measurement.** `rejects` is decided by quarto's validation
  *text*, never its exit status, and the text carries ANSI codes *inside* the message. A
  nonzero exit with no validation text is retried once and then reported `unrelated` and
  excluded from scoring — S164 read a Graphviz syntax error as a schema rejection and wrote
  it into a docstring as fact; S165 scored a transient SIGSEGV as a lost true positive.
- **One quarto version.** Every number is relative to the version in `baseline.json`. The
  run prints a notice when the installed version differs.

## Files

| File | Role |
|---|---|
| `corpus.ts` | The 66 documents, each with what was measured and why it is there |
| `flags.ts` | The mirror of the feature's cell-option loop |
| `classify.ts` | Pure: verdict parsing, row classification, build comparison, the reason gate |
| `load.ts` | Loads the build under test and quarto's schema |
| `run.oracle.test.ts` | The driver |
| `baseline.json` | What this build is expected to conclude, with a reason per wrong row |
| `.quarto-cache.json` | Verdict cache, keyed by quarto version + document bytes. Gitignored |
