# Attribute-block plan — evidence instruments

The before/after instrument of
[`docs/planning/2026-09-14-attribute-tokenizer-plan.md`](../../2026-09-14-attribute-tokenizer-plan.md).
Committed with that plan by the operator's decision at Session 262, following Session 123's
[`count-value-field-shapes.mjs`](../count-value-field-shapes.mjs).

## What it is

`census.test.ts` compares two builds of the model over a list of documents, in three views —
`findHeadings` (the Outline), `findAllCells` (cells) and `indexLabels` (cross-reference labels) — and
reports, per view, how many documents changed and how many entries were added and removed.
`vitest.census.config.ts` runs it on its own. **The run FAILS if fewer than `CENSUS_MIN_READ`
documents were read, or if either build THREW on any document** — a throw would otherwise count as
"unchanged", while in the editor it empties that document's whole Outline.

It is **not product code**: never packaged (`.vscodeignore` excludes `docs/**`), never run by
`npm test` (`vitest.config.ts` includes only `test/unit/**/*.test.ts`), type-checked by no tsconfig,
and validated by the controls below rather than by unit tests.

## Usage — from the repo root

```bash
mkdir -p scratchpad/sN/base && git archive <parent-sha> src | tar -x -C scratchpad/sN/base
CENSUS_BASELINE=$PWD/scratchpad/sN/base CENSUS_OUT=$PWD/scratchpad/sN/census-<run>.out \
  npx vitest run --config docs/planning/scripts/attribute-block/vitest.census.config.ts
```

| Variable | Meaning | Default |
|---|---|---|
| `CENSUS_BASELINE` | a directory holding `src/` — the build to compare against | **required** |
| `CENSUS_CURRENT` | a directory holding `src/` | the working tree (`process.cwd()`) |
| `CENSUS_LIST` | a file of absolute document paths, one per line | `scratchpad/s251/realfiles.txt` |
| `CENSUS_OUT` | one `CHANGED` (and any `THREW`) row per document per view — **give every run its own file and keep it** | `$TMPDIR/census.out` (shared, overwritten) |
| `CENSUS_MIN_READ` | the run fails if fewer documents were read | `3001`; set `1` for a probe list |

## Controls — re-run at Session 262 from this committed copy

Quarto 1.7.33, pandoc 3.6.3. Every run read 3,383 of 3,383 documents with **0 throws**, in about 4 s.

| Baseline → current | headings | cells | labels |
|---|---|---|---|
| `git archive 7a2397e2 src` → the working tree at `7a2397e2` (**identity**) | 0 | 0 | 0 |
| `git archive e7dd276e src` (before Session 257's callout rule) → the working tree | 108 docs, +0 / −289 | 0 | 0 |
| `7a2397e2` → a behaviour-equivalent scratch prototype of the plan's P1 (only `model.ts` and `refs.ts` differ; the literal regex with the document-start split, not yet the linear helper) | 23 docs, +41 / −6 | 8 docs, +8 / −0 | 2 docs, +2 / −0 |

The first shows the tool reports nothing when nothing changed. The second shows it sees a known rule's
289 suppressions. The third is the plan's P1 DONE criterion.

## P1's expected changed set — identified without paths

P1's census must change exactly these 23 documents in the headings view (documents edited since
2026-09-14 aside). Each is identified by the first 16 hex digits of the sha256 of its path **exactly as
listed in `realfiles.txt`**, and grouped by a page key — the first 8 hex digits of the sha256 of the
path after `quarto-web/` (the 23 are 12 unique quarto-web pages, most in two checkouts). A changed
document whose digest is not here is a STOP (plan §4 P1 DONE 7). Compute a run's digests with
`python3 -c 'import hashlib,sys;[print(hashlib.sha256(l.split("\t")[2].encode()).hexdigest()[:16]) for l in open(sys.argv[1]) if l.startswith("CHANGED\theadings")]' scratchpad/sN/census-p1.out`.

| page key | document digests | rendered by fill-3's `verify.py`? |
|---|---|---|
| `d84318cf` | `9ae193c15d5eeedc`, `c2fe8432afba0978` | no — render in P1 DONE 8 |
| `ed148815` | `d5690a6f845fd259`, `71062d194bc29d7b` | no |
| `bd25c0c1` | `df2655c202fba1e7`, `2a535cc9530323ef` | no |
| `a8c183ee` | `190b881981741285`, `8de9cc8229aa5f37` | no |
| `8be9e1c1` | `e9a5fb0fe05d40af`, `55e21554cecd63af` | no |
| `e4723622` | `49290a18a25390a5`, `8005d19fdddb9252` | no |
| `e7813b7c` | `6e3a75712388e1ac`, `1d3fed01746ad7cf` | no |
| `37f7e6a1` | `9e7a9b61bc5aa85d`, `1606d19f2a1f8bc9` | no |
| `9f3c9f3c` | `e2bcaa976ec6a201` | no |
| `e934b2f3` | `61e9ffbd98199a5b`, `8c8d0943ba2cf760` | **yes** |
| `e646de96` | `75a953691796ce88`, `8cd1d344ba6851d4` | **yes** |
| `11005ad9` | `8149ea4787b3fd41`, `853e07362e9ef9a6` | **yes** |

## What it cannot tell you

- **Direction.** It compares model with model. Which build is right comes only from quarto renders.
- **Any fix no corpus document exercises.** Every div-path phase of the plan measures 0 here, by
  construction — a green census there is non-regression evidence and nothing more.

## The corpus — personal, never committed

`scratchpad/s251/realfiles.txt` lists 3,383 authored `.qmd`/`.Rmd` documents, built by Session 251
(`docs/REAL-DOCUMENT-TRIAGE.md`). Some are the operator's personal documents, so the list and the
documents stay local, and **an individual document is identified in a tracked file only by a digest or
its ordinal in the list, plus counts — never by path or directory name.**

| File | sha256 | Notes |
|---|---|---|
| `scratchpad/s251/realfiles.txt` | `838144e88d77fec9f719a9f831fee24f08a26b781040371f78ff3ea27fd0d13c` | 3,383 lines |
| `scratchpad/s251/quarto_real3.tsv` | `5226b08df7f21a65fddc797cce5e07d2ff7f58fd25f4f1b8cff482544a5dab81` | Session 251's quarto ground truth; keyed by path, stale for 3 documents |
| `scratchpad/s262/verification/score262.py` | `825171e6bb4f1a05f8c06c5ca8e4495389550720519f6d2f226362f7366d4985` | a three-way scorer (a relocated copy of Session 258's `score.py`). **No phase of the plan runs it**; pinned so an optional three-way score stays reproducible |
| `scratchpad/s251/real.pkl` | — | 32,092,445 B |

Citing them here also keeps them out of any citation-gated prune of `scratchpad/`.
