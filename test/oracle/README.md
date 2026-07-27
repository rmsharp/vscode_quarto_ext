# The end-to-end exit-code oracle

```bash
npm run test:oracle
```

Runs this extension's **own** cell-option flag decision over a corpus of 66 documents,
renders each one with the real `quarto` CLI, and compares the two answers.

Since Session 168 that is meant literally: the harness calls
`src/core/yaml-value-flags.ts`, the same module the editor's diagnostics call. There is no
longer a second copy of the decision to drift.

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
classification, comparison — is pinned in `test/unit/oracle-*.test.ts`, and the flag
decision itself in `test/unit/yaml-value-flags.test.ts`; both **do** run in the default
suite.

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
git archive <rev> src | tar -x -C /tmp/old
QMD_ORACLE_SRC=/tmp/old/src npm run test:oracle
```

`<rev>` must be **Session 168 or later** — see the warning below. The pre-S165 comparison
in the table above was measured by Session 166 against `87b3f38`, before the lift; that
particular replay is history now and cannot be re-run.

The build under test is a parameter, not a constant. Vitest transforms TypeScript from an
arbitrary absolute path, so an archived tree needs no build step of its own (the oracle's
config widens `server.fs.allow` for exactly this).

⚠ **Replay reaches back only to Session 168.** The driver loads
`core/yaml-value-flags`, which no earlier commit contains, so every pre-S168 build now
fails to load rather than only those older than S164. That is a real capability regression,
accepted deliberately when the mirror was deleted: replay answers *"did my change regress
anything?"*, and `baseline.json` already encodes that answer per-document for all 66 rows.
Freezing the old mirror as a legacy replay path was considered and rejected — it would
reinstate the very artefact whose existence was the problem, and a frozen mirror still
invites someone to quote its numbers.

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
- **It measures the decision, not the diagnostic.** The mirror is gone (S168) and the
  harness now calls `src/core/yaml-value-flags.ts` directly, so the *decision* can no longer
  drift from the product. What the oracle still cannot see is everything downstream of it:
  nothing under `test/oracle/` imports `src/features/`, so the adapter that turns a
  `ValueFlag` into a `vscode.Diagnostic` — its range, severity, `source`, `code`, the
  debounce and the generation guard — is invisible here. A run is guaranteed identical
  whether that adapter is correct or completely broken. **`npm run test:integration` is the
  only thing that observes it.**
  *(The weakness this replaces was real, not theoretical: S165's scratchpad mirror had
  already drifted, omitting the `validate-yaml` escape hatch entirely, and no corpus row
  could have caught it.)*
- **Cell options only** — and note the CAUSE changed with the mirror's deletion. It is no
  longer that the harness implements just the cell loop: `valueFlags` decides all three
  surfaces, and the driver takes `.cell`. Top-level front-matter, nested and format-name
  flags are computed, *reported* per document, and deliberately **not scored**, because
  `classifyRow` consumes one boolean and `baseline.json`'s rows are per-document row
  classes — a non-cell flag reaching the count would flip a row class and read exactly like
  a real regression. On today's corpus that tally is **zero for all 66 documents**
  (measured, S168), which is also why the grouping's real proof is a unit positive control
  rather than an oracle run. Widening the corpus to front-matter shapes means scoring the
  other groups too, and giving each its own baseline rows.
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
| `classify.ts` | Pure: verdict parsing, row classification, build comparison, the reason gate |
| `load.ts` | Loads the build under test — its `core/yaml-value-flags` and its schema parser |
| `run.oracle.test.ts` | The driver |
| `baseline.json` | What this build is expected to conclude, with a reason per wrong row |
| `.quarto-cache.json` | Verdict cache, keyed by quarto version + document bytes. Gitignored |
