# Outline Granularity (CHANGELOG: outline granularity, in-cell code symbols + show/hide toggle, Sessions 71-73): Architecture Plan

## 0. How this plan was produced (evidence provenance) — and the headline finding

This plan was produced from three parallel background research agents plus firsthand empirical
Extension Development Host (EDH) testing conducted directly in this session (six scratch
`test/integration/suite/*.test.ts` assertions, written, run via `npm run test:integration`,
observed, then **deleted before this plan was written** — never committed; `git status` confirmed
clean of scratch artifacts).

- **Fork 1** (VS Code Extension API): fetched `vscode.d.ts` directly from `microsoft/vscode`
  (MIT), the official `vscode-api` reference, and public `microsoft/vscode` GitHub issues/PRs
  about forcing an Outline refresh.
- **Fork 2** (Posit's own shipped feature): researched `quarto-dev/quarto` PRs #972, #974, #751
  and the `v1.127.0`/`v1.133.0` `CHANGELOG.md` entries via `gh api`/`gh pr view` — **PR/issue
  titles, descriptions, and review-comment prose only, plus the public `package.json` manifest
  (uncopyrightable configuration facts)**. Their `.ts` implementation is AGPL-3.0-licensed and was
  **never read or transcribed** (Learning #1's standing license-contamination gate).
- **Fork 3** (MIT-licensed prior art): researched `microsoft/vscode-jupyter`, VS Code core's own
  notebook-outline implementation (`src/vs/workbench/contrib/notebook/**`, MIT), and two
  independent third-party MIT extensions that forward `executeDocumentSymbolProvider` to a
  virtual document.
- **Firsthand empirical grounding** (this session, directly, not delegated — mirrors Session 68's
  own methodology of running real EDH tests rather than trusting API docs alone): confirmed that
  `vscode.executeDocumentSymbolProvider` works against a genuinely **unshown**, synthetic-scheme
  virtual document (once the built-in TS/JS language service has activated — a one-time cold-start
  artifact, not a limitation), *and* discovered a caching behavior specific to that command that
  none of the three forks were asked to test directly.

### Headline finding

Unlike item 10 (code-cell diagnostics forwarding, Session 68), **this feature has no
push-vs-pull architectural wall** — in-cell symbol extraction reuses the exact same pull-based
`vscode.executeXxxProvider` forwarding pattern this project already ships for
completion/hover/definition/signature-help (`src/providers/embedded.ts`). It is buildable with
the existing architecture. But two real, previously-undocumented-in-this-project gotchas surfaced,
both load-bearing for the interface design in §5:

1. **`vscode.DocumentSymbolProvider` has no `onDidChange`/refresh event** (unlike
   `CodeLensProvider`, `FoldingRangeProvider`, `InlayHintsProvider`, and others) — a documented,
   still-open VS Code API gap (`microsoft/vscode#108722`, open as of April 2025). The **sanctioned
   workaround**, confirmed independently by VS Code core's own notebook-outline source *and* by
   Posit's own real, review-refined implementation of this exact feature, is to **dispose and
   re-register** the `DocumentSymbolProvider` when the toggle setting changes — re-registration
   fires the language-feature registry's internal change event, which the Outline view listens to.
   A rejected VS Code core PR (#160027) confirms this is the *intended* shape, not a hack.
2. **`vscode.executeDocumentSymbolProvider` caches per-URI internally** — confirmed firsthand: a
   fetch-count-instrumented scratch `TextDocumentContentProvider` showed the content provider WAS
   re-invoked on a second call to the same URI (fetch count 1→2), but the **returned symbols still
   reflected the first call's content**, even after a real 300ms wall-clock gap. This exact
   behavior is independently corroborated by a 2025 comment on `microsoft/vscode#108722`, cited by
   Fork 1 without my having prompted for it. **A reused vdoc URI — the convention this project's
   existing `VirtualDocStore` uses for completion/hover/definition/signature-help — will serve
   stale in-cell symbols after the first outline computation.** (By contrast, firsthand testing
   confirmed `vscode.executeCompletionItemProvider` against a reused URI correctly picks up an
   edit — the staleness is specific to the document-symbol command, not a general vdoc problem.)
   The fix is a **version-varying vdoc URI per outline computation**, detailed in §5.

Neither finding blocks the feature. Both change the interface contract from what a first read of
CHANGELOG: outline granularity, in-cell code symbols + show/hide toggle, Sessions 71-73 or `src/providers/embedded.ts` would suggest ("just reuse the existing
`VirtualDocStore`") — which is exactly the kind of assumption this project's Architecture
Workstream exists to catch before an implementation session inherits it.

---

## 1. Executive summary (TL;DR)

CHANGELOG: outline granularity, in-cell code symbols + show/hide toggle, Sessions 71-73 bundles three sub-features, all shipped by Posit since v1.127.0–v1.133.0:

- **(a) In-cell code symbols** — the outline shows symbols *from inside* a code cell's body (e.g.
  a Python function def), not just one flat node per cell. Posit PRs #972/#974.
- **(b) Show/hide toggle** — a setting (`quarto.symbols.showCodeCellsInOutline`, boolean, default
  `true`) and a command (`quarto.toggleCodeCellsInOutline`, Command-Palette-only, no icon/menu
  placement in Posit's own implementation) to hide code-cell nodes (and their in-cell symbols)
  from the outline entirely. Same PRs.
- **(c) R-package workspace-symbol exclusion** — markdown headers in an R-package project (a
  `DESCRIPTION` file present at the workspace root) are excluded from workspace-symbol search
  (`Ctrl+T`/`Cmd+T`) by default, controlled by a separate three-way enum setting
  (`quarto.symbols.exportToWorkspace`: `default`/`all`/`none`). Posit PR #751, v1.127.0.

(a) and (b) are tightly coupled (the toggle gates whether forwarding happens at all) and touch
only `src/providers/outline.ts` plus new `package.json` contributions. (c) is an unrelated code
path (`src/providers/workspace-symbols.ts` / `core/workspace-symbols.ts`), serves a narrower
audience (R-package projects specifically), and has zero shared risk or architecture with (a)/(b)
— it is recommended as a separate, later, lower-priority item (§9 Q3).

All research stayed within this project's established license posture: Posit's actual `.ts`
source (AGPL-3.0) was never read; only public PR/issue prose, the public `package.json` manifest
(uncopyrightable configuration facts), and VS Code's own MIT-licensed core source were used.

---

## 2. The mechanism, investigated

### 2.1 In-cell symbol forwarding — reuses the existing architecture

`src/providers/embedded.ts` already proves the pull-forwarding recipe works for four providers
(completion, hover, definition, signature-help): build a per-(document, language) virtual
document via the pure `core/embedded/virtual-doc.ts` `buildVirtualContent`, register it under a
scheme via `TextDocumentContentProvider`, and call `vscode.commands.executeCommand("vscode.execute
XxxProvider", vdocUri, ...)`. `vscode.executeDocumentSymbolProvider` is the same
`vscode.executeXxxProvider` family — Fork 2 confirms Posit's own PR #972 does exactly this,
language-agnostically, via the generic command against a per-cell virtual document.

For each executable-cell node already produced by `core/qmd/model.ts`'s pure `buildOutline`, the
adapter would:
1. Look up `cellLanguageId(cell.lang)` (already exists, `core/embedded/lang-map.ts`, unchanged).
2. Build that cell's body as a virtual document (reuse `buildVirtualContent`, unchanged) — or,
   more precisely, a **per-cell** virtual document, not the whole-document-blanked one embedded.ts
   builds for cursor-position forwarding (§4 spells out the exact reuse boundary).
3. Forward `vscode.executeDocumentSymbolProvider` against that vdoc's URI.
4. Splice the returned symbols in as `children` of the existing `cell`-kind `OutlineSymbol` /
   `vscode.DocumentSymbol` node (which today always has zero children).

### 2.2 Firsthand empirical grounding (this session)

| # | Scratch test | Result | What it proves |
|---|---|---|---|
| 1 | `executeDocumentSymbolProvider` on a fresh, unshown, synthetic-scheme `.js` vdoc, cold (no prior JS activity in the EDH) | `undefined` | A one-time cold-start artifact (the built-in TS/JS extension hadn't activated yet) — **not** a visibility/architecture limitation, unlike item 10's diagnostics finding. |
| 2 | Same, after a warm-up call | Returns `foo` correctly | Confirms #1 was cold-start, not structural. |
| 3 | Two *separate*, fresh, unshown vdoc URIs queried back-to-back | Both return correct, distinct symbols (`alpha`, `beta`) | Unshown virtual documents are **not** visibility-gated for symbols, unlike diagnostics (Session 68's finding was diagnostics-specific, confirmed not to generalize). |
| 4 | Fetch-count-instrumented provider: same URI queried, content changed, queried again | Content-provider fetch count went 1→2 (VS Code *did* re-request the string), but the returned symbol name stayed the **first** call's value | `vscode.executeDocumentSymbolProvider` caches the **symbol computation** per URI independently of whether the underlying content was re-fetched. |
| 5 | Same, with a real 300ms wall-clock gap between calls | Still stale | Not a timing/race artifact — a genuine per-URI cache. |
| 6 | Real (non-stand-in) built-in JS **completion** provider, same reused-URI-across-edit pattern | Correctly reflected the edit (`aaa`→`zzz`) | The staleness is specific to `executeDocumentSymbolProvider`, not a general defect in this project's vdoc-forwarding recipe — completion/hover/definition/signature-help are unaffected. |

Test 4/5's finding is independently corroborated by Fork 1's research: a 2025 comment on
`microsoft/vscode#108722` states "even `vscode.executeDocumentSymbolProvider` ... appears to hit
an internal cache rather than freshly re-invoking the provider" — found by the fork without my
having described this specific behavior in its prompt, which is strong independent confirmation
rather than the fork echoing a leading question.

### 2.3 The staleness gotcha — and the fix

Because `provideDocumentSymbols` is invoked fresh by VS Code on every document edit (confirmed by
Fork 1: "document text changes (keystrokes)" is the one reliably-observed trigger), our own
adapter would call the in-cell forwarding step on *every* outline recomputation. If it reuses a
**stable** per-cell vdoc URI (the convention `embedded.ts`'s `VirtualDocStore` uses for
completion/hover), the in-cell symbols would be correct on the *first* computation and then
**silently frozen** — never reflecting further edits to that cell's body, for the lifetime of the
editor session. This is a correctness bug, not a cosmetic one, and would not necessarily be
obvious in casual testing (the outline would look right immediately after the cell is created,
then quietly drift).

**Fix:** in-cell symbol forwarding must use a **version-varying vdoc URI per outline
computation** (e.g. a monotonically-increasing counter or a content hash embedded in the vdoc
path), not the existing `VirtualDocStore`'s stable-key convention. This has a real cost: each
outline computation mints a new Map entry that must be evicted (the *previous* version's entry for
the same cell, not just on document close) to avoid unbounded growth — see §5.

### 2.4 Live-refresh mechanism for the toggle

`vscode.DocumentSymbolProvider` has no refresh event (Fork 1, confirmed directly against the
current `vscode.d.ts`). The only VS Code-blessed trigger for the Outline view to re-query is a
document text change. Three converging sources establish the correct workaround:

- **VS Code core's own notebook outline** (`notebookOutline.ts`, MIT) listens to
  `languageFeaturesService.documentSymbolProvider.onDidChange(...)` — an internal registry-level
  event that fires when providers are added/removed for a selector.
- **A rejected VS Code core PR** (#160027) tried adding an explicit "refresh outline" *command*;
  the maintainer rejected it on principle, stating a provider-level event (like
  `CodeLensProvider#onDidChangeCodeLenses`) is the correct shape — meaning re-registration (which
  fires the registry event) is the sanctioned mechanism, not a hack.
- **Posit's own real, shipped implementation** (Fork 2, from PR #974's review-comment prose only)
  confirms this directly: their first attempt was a no-op-edit hack ("VSCode seems to have an
  outline cache that we can't bust without making an edit to the document"); a reviewer
  (`@juliasilge`) then proposed re-registering the LSP's document-symbol capability on
  `onDidChangeConfiguration`, describing it as "the spec-shaped equivalent" of a
  non-existent `workspace/documentSymbol/refresh` — the author adopted this as the final fix.

**Recommended design:** hold the provider's `Disposable` in a mutable variable inside
`registerOutlineProvider`; on `vscode.workspace.onDidChangeConfiguration`, filtered to
`quarto.symbols.showCodeCellsInOutline`, dispose the old registration and register a fresh one.
This is corroborated by two independent, directly-read MIT/public sources (not inferred) — high
confidence — but should still get a quick manual F5 visual check during implementation (toggle
the setting, confirm the Outline view visibly updates) before considering it verified, per this
project's "verify firsthand, don't trust docs alone" discipline.

**Known cosmetic caveat (not a blocker):** Fork 2 found that re-registration causes VS Code to
rebuild the Outline tree **collapsed**; Posit added an explicit re-expand call afterward to
compensate. Whether the specific command they reference is a stable, public API was not
independently verified this session — flagged as an optional polish item (§9 Q4), not a
prerequisite.

### 2.5 Cross-language compatibility risk (mirrors item 10's own R1 shape)

`microsoft/vscode#121120` ("DocumentSymbolProvider does not work with VirtualDocuments," cited by
Fork 3): a language's own symbol provider might register its selector scoped to `{scheme: "file"}`
only, in which case it would never fire against our virtual-scheme URI at all — silently
indistinguishable from "no symbols in this cell." This session's empirical testing used the
**built-in** TS/JS language service (confirmed to work fine against a non-`file` scheme, mirroring
this project's own existing production forwarding for completion/hover). Whether a **real
externally-installed** language extension (Pylance, an R language server, etc.) behaves the same
way is **unverified** — the identical shape of gap item 10's plan flagged as Risk R1 for
diagnostics, now recurring for symbols. Deferred to a future empirical spike if real-world reports
surface a problem (§9 Q2).

---

## 3. The decision

Unlike item 10, this plan does not present an Option A/B fork to the operator — the feature is
buildable with the existing architecture, and no viable alternative avoids building it (see §8 for
the one legitimate alternative design considered and why it's rejected for this project's stated
parity goal). The open decisions are about **scope and sequencing**, posed as recommendations in
§9.

---

## 4. Evidence-based inventory (grep-verified firsthand)

**Reused, unchanged:**
- `core/embedded/lang-map.ts` — `cellLanguageId` (engine → forwarding target map; already covers
  python/r/julia/ojs/js).
- `core/embedded/virtual-doc.ts` — `buildVirtualContent` (per-language virtual document builder,
  identity-offset-mapped).
- `core/qmd/model.ts` — `buildOutline` / `OutlineSymbol` (the pure heading+cell tree). **Stays
  pure and vscode-free** — no change needed; forwarding is inherently async/impure and belongs
  entirely in the adapter layer, consistent with this project's `plan §3.3` core/adapter
  boundary.

**Modified:**
- `src/providers/outline.ts` (74 lines today) — `provideDocumentSymbols` becomes `async`
  (currently synchronous); `registerOutlineProvider` restructured to hold a mutable `Disposable`
  and re-register on a config-change listener (§2.4); `toDocumentSymbol` extended to splice in
  forwarded in-cell symbols under cell nodes.
- `package.json` — one new boolean `configuration` entry
  (`quarto.symbols.showCodeCellsInOutline`, default `true`, mirroring Posit's own schema exactly
  per Fork 2's manifest read) and one new `commands` entry (`quarto.toggleCodeCellsInOutline`,
  category `"Quarto"`, no icon, no menu placement — mirroring Posit's own Command-Palette-only
  placement).

**New (this session's most important interface finding, §2.3):** a small dedicated forwarding
store for in-cell symbols, distinct from `embedded.ts`'s private `VirtualDocStore` class. **This
corrects the framing in this session's own claim stub**, which assumed the existing
`VirtualDocStore` could be reused/shared directly — investigated further, it cannot: that class's
stable per-(document, language) URI key is exactly wrong for document-symbol forwarding (§2.3),
and the class itself is not exported from `embedded.ts`. The actual reuse boundary is narrower and
lower-risk than the claim stub anticipated: only the **pure** helpers
(`cellLanguageId`/`buildVirtualContent`) are shared, read-only; `embedded.ts` itself needs **no
code changes** for this feature. This narrows the "cross-module boundary" concern from "outline.ts
and embedded.ts must cooperate" to "outline.ts imports two pure, already-stable functions from
`core/embedded/`" — a much smaller footprint than the Session 70 claim anticipated.

**Untouched by (a)/(b):** `src/providers/embedded.ts` (no code changes — only its pure `core/`
siblings are imported), `src/providers/workspace-symbols.ts` / `core/workspace-symbols.ts` (touched
only if (c) is pursued, §9 Q3).

**(c) sub-feature, if pursued:** `src/providers/workspace-symbols.ts` (currently 79 lines) would
gain a filter step; `core/workspace-symbols.ts` would need a new, currently-nonexistent-in-this-
project "is this workspace folder an R package" detection (a `DESCRIPTION` file at the project
root) plus the new `quarto.symbols.exportToWorkspace` three-way enum setting. Entirely separate
call path and risk profile from (a)/(b).

---

## 5. Interface contracts (sketch only — NOT to be treated as final at implementation time)

```ts
// src/providers/outline.ts — sketch, non-final

export function registerOutlineProvider(context: vscode.ExtensionContext): void {
  let registration = registerProvider();
  context.subscriptions.push(
    new vscode.Disposable(() => registration.dispose()),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("quarto.symbols.showCodeCellsInOutline")) {
        registration.dispose();
        registration = registerProvider(); // re-registration is the refresh signal (§2.4)
      }
    }),
  );
}

function registerProvider(): vscode.Disposable {
  return vscode.languages.registerDocumentSymbolProvider(
    { language: "quarto" },
    new QmdDocumentSymbolProvider(),
  );
}

class QmdDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  async provideDocumentSymbols(
    document: vscode.TextDocument,
  ): Promise<vscode.DocumentSymbol[]> {
    const showCells = vscode.workspace
      .getConfiguration("quarto")
      .get<boolean>("symbols.showCodeCellsInOutline", true); // read live, no caching on our side
    const tree = buildOutline(document.getText());
    // ... filter out cell nodes when !showCells; else forward in-cell symbols per cell
    // (a version-varying vdoc URI per computation — NOT VirtualDocStore's stable key, §2.3/§4)
  }
}
```

Open, NOT resolved by this plan (implementation-time decisions):
- Exact vdoc URI versioning scheme (monotonic counter vs. content hash) and eviction policy for
  the new forwarding store (must not grow unbounded across a long editing session).
- Whether forwarding calls for multiple cells in one outline computation run in parallel
  (`Promise.all`) — almost certainly yes, mirrors no existing sequential precedent in this
  codebase for independent async work.
- Exact merge behavior when `executeDocumentSymbolProvider` returns `undefined` for a cell
  (graceful degradation — cell node keeps zero children, consistent with existing
  hover/completion's "yields nothing, never throws" contract).

---

## 6. The slice(s)

Recommended as **two** vertical slices, not one, specifically because §2.3's discovery makes slice
2 materially higher-risk/higher-novelty than slice 1:

- **Slice 1 — toggle infrastructure alone.** The setting + command + dispose/re-register pattern
  (§2.4), gating the **already-existing** flat cell nodes (no in-cell symbols yet — those stay
  absent, unaffected by this slice). Fully shippable and independently valuable on its own
  (hide/show code cells in the outline, matching half of Posit's parity claim). De-risks the live-
  refresh mechanism in isolation before the harder forwarding piece is added.
- **Slice 2 — in-cell symbol forwarding.** The new version-varying-URI forwarding store (§2.3/§5),
  per-cell forwarding, splicing results into the existing cell nodes as children. Built and tested
  independently, after slice 1's refresh mechanism is proven solid in a real EDH.
- **Slice 3 (separate, deferred, optional) — (c) R-package workspace-symbol exclusion.** Unrelated
  file (`workspace-symbols.ts`), no shared risk with slices 1/2 (§9 Q3).

Each slice is its own session with its own TDD pass, per `CLAUDE.md`'s project-wide gate — this
ordering is a recommendation for whoever implements it, not a mandate to bundle 1+2 (§9 Q1).

---

## 7. Failure-mode / risk analysis

| # | Risk | Severity | Status |
|---|---|---|---|
| R1 | Reused/stable vdoc URI would serve stale in-cell symbols after the first outline computation | High if unaddressed | **Resolved by design this session** — version-varying URI (§2.3/§5), not a blocker, but the eviction policy is an implementation-time detail to get right (unbounded Map growth otherwise). |
| R2 | A real externally-installed language extension (not the built-in JS/TS stand-in) may not respond to a non-`file`-scheme vdoc URI (`microsoft/vscode#121120`) | Medium, unverified | Deferred — ship against the built-in JS/TS service (proven working) first; spike later if real-world reports surface a problem. Same shape as item 10's own R1. |
| R3 | Toggling rebuilds the Outline tree collapsed (re-registration side effect); Posit's re-expand fix references a command not independently verified this session | Low, cosmetic | Optional polish, not a prerequisite (§9 Q4). |
| R4 | Sub-feature (c) (`DESCRIPTION`-file R-package detection) has zero precedent in this codebase and serves a narrower audience than (a)/(b) | Low | Recommend deferring as a separate, unranked item (§9 Q3). |

---

## 8. Alternatives considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| Reuse `embedded.ts`'s existing `VirtualDocStore` class directly | Less new code; one fewer store to maintain | Its stable per-(document, language) URI key is exactly what causes the R1 staleness bug for document-symbol forwarding (fine for completion/hover, wrong here); the class isn't exported | Rejected — a new, small, version-aware store is required (§2.3/§4). |
| Keep the outline shallow (headings + one node per cell, no in-cell forwarding) — the design `vuejs/language-tools`/Volar (MIT, mature embedded-language framework) deliberately chose for its own SFC outline | Simpler, zero new caching/versioning concerns, matches a real, actively-maintained MIT prior-art project's own considered choice | Doesn't serve this project's stated Posit-parity goal; CHANGELOG: outline granularity, in-cell code symbols + show/hide toggle, Sessions 71-73 exists specifically because Posit's deeper tree is the identified gap | Rejected for this project's mission, but noted as a legitimate design a comparable MIT project chose — not a straw man. |
| A no-op `WorkspaceEdit` hack to force an outline refresh on toggle (Posit's own **first**, since-abandoned attempt, per PR #974's review history) | Simple to implement, no registry-level API needed | Marks the editor dirty (a real UX cost the author called "annoying"); Posit's own reviewers moved away from it in favor of dispose+re-register | Rejected — the cleaner mechanism (§2.4) is corroborated by two independent sources and was Posit's own final choice too. |

---

## 9. Open questions for the operator (resolve before or at implementation, not now)

**Q1: Bundle slices 1+2 as one implementation session, or split per §6?**
*Recommendation:* split. Slice 2 (the new vdoc-URI-versioning store) is genuinely new,
higher-risk architecture; slice 1 (setting + command + re-register) is comparatively mechanical
and independently shippable/testable value on its own.

**Q2: Pursue the R2 real-extension empirical spike now, or defer?**
*Recommendation:* defer. Ship against the built-in JS/TS language service first (proven working
this session); revisit only if a real-world report surfaces a problem with a specific external
extension (mirrors item 10's own treatment of its analogous R1 risk).

**Q3: Pursue sub-feature (c) (R-package workspace-symbol exclusion) at all, and if so, when?**
*Recommendation:* defer as a separate, unranked, low-priority `BACKLOG.md` item (same treatment
Session 69 gave the Q4 Problems-panel-leakage audit for item 10) — real, but narrower-audience and
architecturally unrelated to (a)/(b).

**Q4: Include the R3 cosmetic re-expand-on-toggle fix in slice 1, or ship without it?**
*Recommendation:* ship without it initially; document the collapse-on-toggle behavior as a known,
minor UX gap. The specific VS Code command Posit's PR references for re-expanding was not
independently verified this session as stable/public — verifying it is itself small future work,
not worth blocking slice 1 on.

---

## 10. Quick reference

- **Configuration (new):** `quarto.symbols.showCodeCellsInOutline` (boolean, default `true`);
  `quarto.symbols.exportToWorkspace` (enum `default`/`all`/`none`, default `"default"` — only if
  (c) is pursued, §9 Q3).
- **Commands (new):** `quarto.toggleCodeCellsInOutline` (Command-Palette-only, category
  `"Quarto"`, no icon/menu placement — mirrors Posit's own minimal placement).
- **Key files:** `src/providers/outline.ts` (the main change — sync→async, mutable-disposable
  re-registration, in-cell forwarding); `core/qmd/model.ts` (unchanged, stays pure);
  `core/embedded/lang-map.ts` / `virtual-doc.ts` (reused read-only, unchanged);
  `src/providers/embedded.ts` (**not modified** — only its pure `core/` siblings are imported, a
  narrower reuse boundary than this session's own claim stub anticipated, §4);
  `src/providers/workspace-symbols.ts` + `core/workspace-symbols.ts` (only if (c) is pursued);
  `package.json` (new configuration + command entries); `test/integration/suite/outline.test.ts`
  (existing pattern — `symbolsFor()` helper — to extend, not replace).
- **Evidence sources cited:** `microsoft/vscode` `vscode.d.ts` (MIT, direct fetch);
  `microsoft/vscode` issues #108722 (open), #71454, #84780, #121120, PR #160027;
  `microsoft/vscode-cpptools` discussion #9299; `quarto-dev/quarto` PRs #972, #974, #751 (issue/PR
  prose + manifest only, never AGPL diffs), issues #647/#167/#880/#918,
  `apps/vscode/CHANGELOG.md` (v1.127.0/v1.133.0); VS Code core
  `notebookOutlineEntryFactory.ts`/`notebookOutline.ts` (MIT); `opensourceame/slim-vscode-extension`
  (MIT); `vuejs/language-tools` (MIT).
