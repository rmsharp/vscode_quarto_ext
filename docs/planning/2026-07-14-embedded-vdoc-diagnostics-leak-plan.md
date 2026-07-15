# Embedded vdoc Problems-panel leak under `diagnosticMode: "workspace"` — Design Plan

`BACKLOG.md` "Polish / deferred" HIGH (filed Session 87). Planning session: **Session 92**.
Workstream: `docs/methodology/workstreams/ARCHITECTURE_WORKSTREAM.md`.

---

## 0. How this plan was produced (evidence provenance) — and the headline

Five evidence streams, per the Architecture workstream's §7 "Verify Assumptions":

1. **Pyright/Pylance source** — `_shouldCheckFile`, `service.ts` file-tracking, default `exclude`, `.gitignore`
   handling, `ignore`-vs-`exclude`, import roots (§2).
2. **VS Code core source** — the (absent) force-close API, the background-model lifecycle, `didOpen`-on-open,
   the `untitled:` / `vscode-notebook-cell:` schemes (§2, §5).
3. **Posit's shipped extension, PROSE ONLY** (AGPL — PR/issue/changelog/manifest text, never source diffs;
   Learning #1) — their three-technique approach (PR #832 client middleware filter, PR #980 temp + delete +
   retype-to-`plaintext`) and residual leaks (#855) (§5).
4. **Firsthand grounding against REAL Pylance 2026.2.1** in this repo's `test:lsp` EDH (throwaway probes —
   written, run, observed, **deleted before this plan; tree clean afterward**), under
   `QMD_LSP_DIAGMODE=workspace` (§3).
5. **A 13-agent adversarial review of this plan's own first draft** (3 lenses × candidates/empirical/
   recommendation + per-candidate refutation + completeness critic), which refuted the first draft's
   recommendation and surfaced the fix this version adopts (§3.6, §8).

> **Headline.** Two findings, both firsthand:
> 1. **The "obvious" fix is REFUTED.** Relocating vdocs out of the workspace does **not** stop the leak
>    (§3.2): with vdocs forced to an OS-temp dir, `workspace`-mode Pylance published the *same* phantom
>    diagnostics, attributed to the temp paths. The leak follows Pyright's `didOpen`-time tracked-set
>    injection, which is **location-independent** (§2.1).
> 2. **A clean fix exists and is confirmed.** Injecting a file-level **`# type: ignore` on the vdoc's
>    line 0** (a line the builder already blanks, so it is coordinate-safe) **fully suppresses the leak
>    while preserving completion/hover, and emits no spurious semantic token** (§3.5). It is a small,
>    silent, config-free, pure-`core/` change — **strictly better than every config-injection or
>    disposal-timing alternative** the first draft weighed. This is the recommended fix (§4).

---

## 1. Executive summary (TL;DR)

- **The bug.** Each embedded code cell's content is opened as a background `file:` model
  (`.quarto/vdoc-mit/*.py`) so the user's Pylance serves completion/hover. Under the **default**
  `diagnosticMode: "openFilesOnly"` there is **zero** leak (pinned by `real-lsp.test.ts:279`). Under the
  **non-default** `"workspace"` mode, Pylance publishes phantom diagnostics on those vdoc paths (`"df" is
  not defined` from a per-cell vdoc that blanks the sibling cell; `Import "pandas" could not be resolved`).
  Reproduced firsthand (§3.1): 3 vdoc files, 5 diagnostics, on a 2-cell probe.
- **Mechanism, source-confirmed (§2.1).** Pyright diagnoses a file when `isOpenByClient` OR
  (`isTracked` AND workspace-mode). **Opening a vdoc injects it into the tracked set, bypassing the default
  `**/.*` exclude, and that membership is location-independent.** So `.gitignore` does nothing, the dot-dir
  exclude is bypassed, deleting the file doesn't retract, **and relocating out of the workspace doesn't help**.
- **The fix (candidate G, confirmed §3.5).** Inject a file-level `# type: ignore` on the vdoc's already-blanked
  line 0 — gated to the **python** languageId and to vdocs that actually carry python body content. Pyright
  (and mypy/pyre) honor a first-line `# type: ignore` as a whole-file diagnostic mute. Firsthand under
  `workspace` mode: leak → `[]`, `df.` completion still returns 273 items (`head` present), and
  `vscode.provideDocumentSemanticTokens` puts **zero** tokens on `.qmd` line 0. It is coordinate-safe (line 0
  is never a code body line), silent (no user config), location-independent (covers the OS-temp fallback that
  a settings glob would miss), and preserves the 🐉8 reuse property (the directive is a constant per content).
- **Recommendation (§4).** Ship **candidate G** as the fix (one pure-`core/` slice, strict TDD). Update the
  docs (`POSIT-COMPARISON.md`). **Measure whether R/Julia leak at all before doing anything for them** — the
  confirmed leak is Pylance-only; if R/Julia leak, extend the same in-content directive family, *not* the
  disposal-timing change the first draft proposed. **Reject** relocation (A, refuted), owning-a-client (C,
  S69), and the `deleteQuietly`→`WorkspaceEdit` rewrite (D, high-blast-radius + only partial — §5). This is
  the plan; implementation is a separate session (FM #18/#19).

---

## 2. The mechanism, at the source level

### 2.1 Pyright's `_shouldCheckFile` (the crux)

From `pyright-internal/src/analyzer/program.ts`:

```ts
private _shouldCheckFile(fileInfo: SourceFileInfo) {
    if (fileInfo.isOpenByClient) return true;                       // BOTH modes
    if (!this._configOptions.checkOnlyOpenFiles && fileInfo.isTracked) return true; // WORKSPACE mode only
    return false;
}
```

`checkOnlyOpenFiles === true` ⇔ `openFilesOnly`. A file is diagnosed iff **open** OR (**tracked** and
workspace-mode). The **decisive wrinkle** (`service.ts`): *opening* a file injects it into the tracked set,
**bypassing the `exclude` globs**, and that membership **persists after the model closes** and is
**independent of the file's location**. So the workspace-mode leak is the *tracked* branch (silent under
`openFilesOnly` proves the vdocs are not `isOpenByClient` at steady state), and it cannot be dodged by the
dot-dir default exclude, `.gitignore`, or relocation. Corroborated: pylance-release #5896 ("still reports
problems in excluded/ignored dirs, even in a closed file").

*(Open-vs-closed nuance, from the review: the plan infers the tracked-branch from mode-gating; it did not
instrument `didOpen`/`didClose`/`isModelOpen` at measurement time. This nuance does **not** affect the
recommended fix — G suppresses via file content and so works regardless of which branch fires — but it is why
the *disposal-timing* fix D is unsafe to rely on: D's premise that firing `didClose` retracts is exactly what
#5896 contradicts.)*

Sources: [program.ts](https://github.com/microsoft/pyright/blob/main/packages/pyright-internal/src/analyzer/program.ts),
[service.ts](https://github.com/microsoft/pyright/blob/main/packages/pyright-internal/src/analyzer/service.ts),
[pylance-release #5896](https://github.com/microsoft/pylance-release/issues/5896).

### 2.2 Corollaries (source-confirmed)

| Claim | Verdict |
|---|---|
| `.gitignore *` in the vdoc dir suppresses Pyright | **No** — Pyright never reads `.gitignore` |
| Default `**/.*` exclude protects `.quarto/` | **Bypassed on open** (§2.1) |
| Deleting the file (`fs.unlink`) retracts diagnostics | **No** `didClose`; and a `didClose` alone need not untrack (#5896) |
| A first-line file-level `# type: ignore` mutes all of a file's Pyright diagnostics | **Yes** — PEP 484 + Pyright; honored regardless of the open/tracked branch (§3.5 firsthand) |
| `# type: ignore` disables completion/hover/imports | **No** — it filters diagnostic *output* only (§3.5: n=273 completion survived) |
| `python.analysis.ignore` suppresses, keeps imports | **Yes** (§3.3) — but writes user config, and its glob misses the OS-temp fallback vdocs |
| A background never-shown model stays open forever | **No** — auto-disposed at 3 min / 80 MB / >~60 refs |

---

## 3. Firsthand spike results (real Pylance 2026.2.1, this session)

Method: drive the **real extension's** forwards on a real `.qmd` in the `test:lsp` EDH (faithful vdoc
lifecycle) under `QMD_LSP_DIAGMODE=workspace`; read `vscode.languages.getDiagnostics()`. Throwaway env-gates
forced relocation (`QMD_VDOC_FORCE_TEMP`) and the candidate-G injection (`QMD_VDOC_TYPE_IGNORE`). All probe
code reverted/deleted; tree clean.

### 3.1 The leak reproduces

2-cell fixture (`df` in cell 1, used in cell 2 + an undefined name). Under `workspace` mode, **3 `vdoc-mit.*.py`
files carried 5 diagnostics**: `Import "pandas" could not be resolved from source`, `"df" is not defined`
(×2 across the isolated per-cell vdocs), `"undefined_name_xyz" is not defined` (×2). Matches the item exactly.

### 3.2 Relocation out of the workspace does NOT fix it (candidate A refuted)

Same forwards, vdocs forced to `/var/folders/.../T/quarto-mit-vdoc-*/` (outside the workspace): **identical
leak**, and the leaking diagnostics were attributed to **those temp paths** (not `.quarto/vdoc-mit/`),
confirming the redirect took and A is genuinely refuted. Location is irrelevant to the tracked-injection.

### 3.3 `python.analysis.ignore` suppresses + preserves imports (candidate B)

With `python.analysis.ignore = ["**/.quarto/**"]`, the in-workspace vdoc's diagnostics were suppressed and a
`{python}` cell's `import proj_helper` still completed `proj_helper.VALUE`. Confirms the docs. Caveats (review):
tested **prevention** (set-at-activation), not late **retraction** (buggy per pyright #789, may need reload);
and completion may be **warm-cache**; and the glob **misses the OS-temp fallback vdocs**, which also leak.

### 3.4 Import resolution works in AND out of the workspace (scoped)

`import proj_helper` (module at the **workspace root**) resolved `proj_helper.VALUE` from both an in-workspace
and an OS-temp vdoc. **Scope (review):** this proves only that **absolute/rooted** imports (search-path
resolved, location-independent by construction) survive; **relative/sibling** imports (`from . import x`) were
not tested and could break out-of-workspace. Since A is refuted anyway, this is moot for the recommendation,
but the general "relocation is import-safe" claim is **not** established.

### 3.5 Candidate G — `# type: ignore` on vdoc line 0 (THE FIX) — confirmed

Injected `# type: ignore` on the vdoc's line 0 (gated python-only + only when python body content exists),
front-matter fixture so `.qmd` line 0 = `---`. Under `workspace` mode, driving the real forwards:

| Probe | Result | Meaning |
|---|---|---|
| **(a) suppression** | vdoc diagnostics `= []` (was 5) | file-level `# type: ignore` **fully** mutes the leak |
| **(b) completion** | `df.` → `head` present, **n=273** | IntelliSense fully preserved (diagnostics-only filter) |
| **(c) line-0 exposure** | **0** tokens on `.qmd` line 0 (7 total) | Pylance emits **no** semantic token for the comment line — the review's key risk does **not** materialize |

Full, silent, coordinate-safe, location-independent, IntelliSense-preserving. The review's other two caveats
are handled by the gating already applied: **python-only** (a `#` is a JS *syntax error*, so never inject into
JS/other vdocs) and **only when `keep.size > 0`** (so `buildVirtualContent(text,'python').trim() !== ''`
remains equivalent to `embeddedLanguagesIn` including python — the pinned invariant holds; the invariant's unit
test must be updated for the injected first line, §7).

### 3.6 What the adversarial review changed

The first draft recommended **D** (rewrite `deleteQuietly` to fire `didClose`) as an always-on general fix and
missed the in-content class entirely. The review (§8) refuted that ordering: D is only **partial** for Python
(it clears superseded/edit-churn vdocs but not the *live* per-cell vdocs that produce the static leak),
carries **maximum blast radius** on the S88/S91 race-critical paths, and rests on an **unconfirmed**
`didClose`-retracts premise (#5896 argues the opposite). It surfaced candidate G, which this version adopts
and confirmed firsthand (§3.5). Every other proposed candidate was refuted (§5).

---

## 4. The decision

### 4.1 Recommendation — ship candidate G

**Inject a file-level `# type: ignore` on the vdoc's line 0, in the two pure builders
(`core/embedded/virtual-doc.ts`), gated: (i) the vdoc's languageId is `python`; (ii) the vdoc carries kept
python body content (`keep.size > 0` in `buildVirtualContent`; a python cell with body in
`buildCellVirtualContent`).** Line 0 is provably never a code body line (a body line needs a fence above it, so
`startLine + 1 ≥ 1`), so the write is coordinate-safe and shifts nothing.

Why G over the alternatives (all firsthand or source-grounded):

- **vs relocation (A):** A is refuted (§3.2). G works.
- **vs `python.analysis.ignore` (B):** G needs **no user config**, has **no consent friction**, no
  reload-to-retract bug, and — because it is *in-content* — covers the **OS-temp fallback** vdocs that B's
  workspace-scoped glob misses. G dominates B for Python.
- **vs disposal-timing (D):** D is **partial** (leaves the live per-cell/per-language vdocs leaking),
  **high-blast-radius** (rewrites the shared `deleteQuietly` on all five S88/S91 race paths), and its
  `didClose`-retracts premise is **unconfirmed / contradicted** (#5896). G is a small pure-`core/` change with
  no lifecycle or concurrency exposure.
- **vs owning a client (C):** operator rejected at S69.

**Generality is honest, not universal.** The directive is Python-specific (as is B). The confirmed leak is
**Pylance-only**; R/Julia are *stated, not measured* (no servers here). **Before** any R/Julia work, measure
whether they leak (§9 Q2). If they do, the fix is a **per-language suppression preamble** in the same
in-content family (R/Julia `#` comments are harmless; a `{ojs}` arm would be `// @ts-nocheck`, though JS likely
does not leak and cannot suppress ojs *syntax* errors — §5) — **not** the disposal-timing rewrite.

### 4.2 Severity

With G, this item is **FIXED**, not merely mitigated — so no "accept the residual" posture and no HIGH→MEDIUM
downgrade is needed for Python. Keep it HIGH until G ships; then close (Python), with a separate, explicitly
**unmeasured** note for R/Julia. *(If, contrary to expectation, G could not ship, the honest fallback rating
would rest on non-default-mode + non-corrupting alone — never on "D makes it small," which the review
disproved.)*

### 4.3 Here be dragons (Learning #3)

- The confirmed-clean line-0 semantic-token result (§3.5c) is **Pylance-version-specific**. Pin it with a
  `test:lsp` assertion (no token on line 0) so a future Pylance that *does* tokenize the comment is caught,
  not shipped.
- The `embeddedLanguagesIn ⟺ non-empty buildVirtualContent` invariant is load-bearing; the gating (`keep.size
  > 0`) preserves it, but its unit test asserts exact strings and **must** be updated for the injected line —
  update it deliberately, do not let it silently drift (§7).
- Do **not** let the "general across servers" goal tempt an unconditional prepend: `#` is a **JS syntax
  error**, so the python-languageId gate is load-bearing correctness, not a nicety.

---

## 5. Alternatives considered (honest pros/cons; verdicts firsthand or source-grounded)

| Alternative | Verdict | Why |
|---|---|---|
| **G. In-content `# type: ignore` (line 0, python-gated)** | **RECOMMENDED** | Full, silent, coordinate-safe, location-independent, IntelliSense-preserving; confirmed §3.5 |
| **A. Relocate out of workspace** | **Rejected — refuted §3.2** | Leak is location-independent (tracked-injection) |
| **B. Inject `python.analysis.ignore`** | Dominated by G | Works (§3.3) but writes user config, misses OS-temp vdocs, retraction buggy |
| **C. Own a `vscode-languageclient` + middleware filter (Posit #832)** | **Rejected — S69** | Reopens the architecture the operator declined |
| **D. Rewrite `deleteQuietly`→`WorkspaceEdit` to fire `didClose`** | **Rejected** | Partial (live per-cell vdocs still leak); max blast radius on S88/S91 paths; `didClose`-retracts unconfirmed/contradicted (#5896) |
| **D-eager (close the live vdoc per forward)** | Rejected | Destroys 🐉8 reuse (≈1017 ms reopen/forward), Problems-panel flicker, breaks multi-round-trip LSP; §8 |
| **WorkspaceEdit RENAME on dispose** | Rejected | Strands a `.txt` copy of the user's source (the exact S88/S91 failure); dominated by delete |
| **`# pyright: <rule>=false`** | Fallback to G | Same in-content placement, but rule-list is brittle vs `# type: ignore`'s totality; Pylance-only |
| **`// @ts-nocheck` for {ojs}** | Defer/measure | JS likely doesn't leak (no semantic diags by default) and can't suppress ojs *syntax* errors; only if a JS leak is shown |
| **`python.analysis.diagnosticSeverityOverrides`** | Rejected | Unscoped — disables the checks on the user's real `.py` files too |
| **`pyrightconfig.json` / `[tool.pyright]`** | Rejected | A root config **hijacks** the user's whole Pyright config; nested config is never discovered; repo churn |
| **Consumer-side diagnostic filtering** | Rejected | No API — collapses into C |
| **`vscode-notebook-cell:` scheme** | Rejected | Not an extension-point; breaks the whole-document line-identity mapping |
| **`untitled:` scheme** | Rejected | item-18 D1: "Save changes?" dirty-set prompt; no directory context |
| **F. Accept & document** | Superseded by G | Unnecessary once G ships; docs still update |

Posit ships **three techniques together** (own-client filter + temp + retype) and *still* leaks residually
(#855) — evidence that the heavy paths don't fully close it, and a further argument for the in-content mute.

---

## 6. Recommended path — Slice G (one session, strict TDD)

- **L1 (pure core, TDD):** in `core/embedded/virtual-doc.ts`, inject `# type: ignore` on line 0 of
  `buildVirtualContent` (when `languageId === "python" && keep.size > 0 && !keep.has(0)`) and
  `buildCellVirtualContent` (when the cell's `cellLanguageId(...).languageId === "python"`). Headless vitest,
  one behavior at a time: (a) line 0 === `# type: ignore` for a python vdoc with body; (b) NON-python vdocs
  and body-empty python vdocs are unchanged (no injection — the JS-syntax-error and invariant guards); (c)
  every kept code line still sits at its original `.qmd` index and columns (coordinate-safety pin); (d) update
  the `embeddedLanguagesIn ⟺ buildVirtualContent non-empty` invariant test for the injected line.
- **L2 (real-LSP gate):** a `test:lsp` case under `QMD_LSP_DIAGMODE=workspace` that is the workspace-mode
  sibling of `real-lsp.test.ts:279` — RED (leak) before L1, GREEN (`vdoc-mit` diagnostics `[]`) after — PLUS
  a control that `{python}` completion/hover still return n>0, PLUS a `vscode.provideDocumentSemanticTokens`
  assertion that **no** token lands on `.qmd` line 0 (the §4.3 version-drift pin).
- **DONE looks like:** L1 vitest green (incl. the coordinate + invariant pins), L2 workspace-mode leak `[]`
  with completion + no-line-0-token green, the existing `real-lsp.test.ts` + `npm test` green, clean `.vsix`.
- **Session boundary:** one slice. No `deleteQuietly`/lifecycle changes (that was D — rejected).

**No F-slice code is required** (G fixes it); do a small docs pass — `docs/POSIT-COMPARISON.md` note that embedded
diagnostics are not forwarded and the `workspace`-mode leak is fixed via the in-content mute; `BACKLOG.md` close
the Python HIGH and file the **R/Julia-leak measurement** as a new, small, explicitly-unmeasured item.

---

## 7. Evidence-based inventory (grep-verified)

| Symbol / site | File:line | Relevance |
|---|---|---|
| `buildVirtualContent` (line-based blank-to-"") | `src/core/embedded/virtual-doc.ts:92` | **G's L1 site** (whole-language vdocs; semantic tokens, completion/hover) |
| `buildCellVirtualContent` | `src/core/embedded/virtual-doc.ts:182` | **G's L1 site** (per-cell vdocs; outline symbols, format-cell) |
| `embeddedLanguagesIn ⟺ non-empty` invariant | `virtual-doc.ts:121-124` + unit tests | **must update** for the injected line (§4.3) |
| `cellLanguageId(cell.lang)` | `lang-map.ts` (imported) | the python gate in `buildCellVirtualContent` |
| semantic-tokens forward (whole-vdoc, no line filter) | `providers/semantic-tokens.ts` / `core/embedded/semantic-tokens.ts` | why the line-0 token pin (§6 L2) matters |
| `real-lsp.test.ts:279` (default-mode leak pin) + `runTest.ts:110/141` (`QMD_LSP_DIAGMODE`) | test | the workspace-mode sibling is G's L2 gate |
| `deleteQuietly` (+ 5 call sites) | `embedded-vdoc.ts:404, 207/217/251/264/322` | the **D** blast radius — **NOT touched** by G (kept out of scope) |
| `vdocDirFor` (workspace vs `mkdtemp` fallback) | `embedded-vdoc.ts:336` | **not changed** (A refuted); note the OS-temp fallback is why B's glob under-covers and G's in-content mute does not |

**No changes to:** vdoc location/sweep, the `disposeEpoch`/`disposeAllEpoch` races (S88/S91), the deletion
primitive, or the reuse/🐉8 logic. G is confined to the two pure builders.

---

## 8. Failure-mode / risk analysis (incl. review findings)

| Risk | Severity | Notes |
|---|---|---|
| **G's clean line-0 semantic-token result is Pylance-version-specific** | Med — pinned | §6 L2 asserts no line-0 token, so a future tokenizing Pylance is caught by the gate, not shipped |
| **The `embeddedLanguagesIn` invariant test drifts** | Med — pinned | gating on `keep.size>0` preserves the invariant; the test's exact-string assertion is updated deliberately (§4.3) |
| **Unconditional inject would corrupt non-python vdocs** (`#` = JS syntax error) | High if ungated | the python-languageId gate is load-bearing correctness, not a nicety |
| **A refuted; D partial + high-blast-radius; B config-write** | — | the first draft's recommendation; corrected here (§3.6, §5) |
| **R/Julia leak unmeasured** | Low — deferred | no servers here; measure before acting; extend the in-content family if they leak, not D |
| **G suppresses a diagnostic a user might WANT** | Low | the project deliberately does not forward embedded diagnostics at all (item 10 Option A, S69); muting the *phantom* copies changes nothing the user was getting |
| **{ojs}/JS residual** | Low — measure | JS likely emits no semantic diagnostics by default; `// @ts-nocheck` can't suppress ojs syntax errors anyway; a JS arm only if a probe shows a JS leak |

---

## 9. Open questions for the operator

- **Q1.** Confirm the recommendation: ship **G** (in-content `# type: ignore`, python-gated) as the fix, in
  one pure-`core/` slice; **drop D** (the first draft's disposal-timing change). *Recommendation: yes — G is
  confirmed full/silent/coordinate-safe and D is partial + risky.*
- **Q2.** R/Julia: file a small **measurement** task (does an R/Julia cell leak under `workspace` mode?) and
  act only on evidence, or leave R/Julia entirely unaddressed for now? *Recommendation: file the measurement;
  don't build blind.*
- **Q3.** Also offer `python.analysis.ignore` as a documented belt-and-suspenders for users, or rely on G
  alone? *Recommendation: G alone; document nothing users must do, since G needs no user action.*

---

## 10. Impact analysis / explicit scope boundary

- **Changes:** the two builders in `core/embedded/virtual-doc.ts` (L1) + one `test:lsp` case + unit tests
  (L2) + a docs/backlog pass. That is all.
- **Does NOT change (explicit):** vdoc location (`vdocDirFor` — A refuted), the deletion primitive
  (`deleteQuietly` — D rejected), the `disposeEpoch`/`disposeAllEpoch` races (S88/S91), the reuse/🐉8
  optimization, and the completion/hover/semantic-token forwards' behavior on **code** lines. The
  `openFilesOnly` (default) path is already clean and stays clean.
- **Might break:** only the two builder invariants pinned in §6 L1 (coordinate-identity on kept lines; the
  `embeddedLanguagesIn` equivalence) and the line-0 semantic-token expectation (§6 L2) — all covered by the
  slice's own tests. No concurrency/lifecycle surface is touched, unlike the rejected D.

---

## 11. Quick reference

- **Mechanism:** Pyright `_shouldCheckFile` — `isOpenByClient` OR (`isTracked` && workspace-mode);
  `didOpen` injects tracked membership past the exclude, persisting after close, **location-independent**.
- **Refuted fix:** relocate out of workspace (§3.2).
- **The fix (confirmed §3.5):** file-level `# type: ignore` on vdoc line 0, python-gated — full, silent,
  coordinate-safe, IntelliSense-preserving, no line-0 token.
- **Rejected:** own-a-client (C, S69), `deleteQuietly`→WorkspaceEdit (D — partial + high blast radius),
  `python.analysis.ignore` (B — dominated by G), and the config/scheme variants (§5).
- **Firsthand harness:** `QMD_LSP_DIAGMODE=workspace [QMD_VDOC_TYPE_IGNORE=1] npm run test:lsp` (Pylance
  2026.2.1 present).
- **Deferred, unmeasured:** whether R/Julia leak at all (no servers here) — measure before acting.
