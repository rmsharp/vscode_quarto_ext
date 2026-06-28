# Session Notes

**Purpose:** Continuity between sessions. Each session reads this first and writes to it before closing out.

---

## ACTIVE TASK
**Task:** **v1 release prep (continuing).** v1 is feature-complete (Phases 1–5 + 6a–6c). **Items 1 (git remote), 2 (marketplace metadata + README), and 3 (F5 visual pass + screenshots) are DONE (Sessions 10, 11, 12).** Remaining before publish: the **`npm audit` posture decision** (one small item), then the operator-only `vsce publish`.
**Status:** All release-prep items 1–3 done. README now has a `## Screenshots` gallery with 5 faithful screenshots (highlighting, outline, `@` completion, preview, render), captured in an Extension Development Host isolated with `--disable-extensions` (the user has Posit's `quarto.quarto` installed — it otherwise merges with ours; Learning #19). Screenshots committed under `media/screenshots/` and pushed (Marketplace fetches them via repo raw URLs); excluded from the `.vsix`. Clean **10-file** `.vsix` (29.09 KB, `media/` ships only `icon.png`); **190 unit + 42 integration** green (unchanged — no `src/` change this session). This session closed the "F5-only visual residue" every prior phase carried. **The repo is now PUBLIC** — required for the screenshots to render (vsce rewrites README image paths to repo raw URLs, which 404 anonymously on a private repo; all 5 verified HTTP 200 once public).
**Plan:** `docs/planning/2026-06-27-extension-architecture-plan.md` §7 (v1 DoD). Release-prep items in `BACKLOG.md` "Active".
**Priority:** HIGH
**⚠ STRICT TDD IS MANDATORY** for any code/bugfix (operator directive — `CLAUDE.md` §"Mandatory development practice" + Learnings #10, #14, #15, #16). Pure packaging/metadata/doc edits with no logic are exempt but still need their normal verification (compile, package, render, AND — per **Learning #18** — `npm run test:integration` after any `publisher`/`name`/activation change; the 8 suites hard-code the extension ID).

### What You Must Do (v1 release prep — only the `npm audit` decision remains)
Items 1–3 are done (Sessions 10, 11, 12). FM #18: ONE deliverable — don't also start the deferred polish items.
1. **`npm audit` posture decision** (the last release-prep item before publish): 7 dev-only vulns, none ship. Run `npm audit`, then either (a) document them as accepted (dev-only `devDependencies`, not in the bundled `dist/extension.js`) in a short note, or (b) `npm audit fix` if it's clean + non-breaking, then re-verify (190 unit / 42 integration / clean `.vsix`). This is a TINY deliverable — confirm scope with the operator (it may be paired with v2/polish work only if they explicitly expand scope).
2. **Operator-only (not an agent task):** actual `vsce publish` needs a registered Marketplace publisher `rmsharp` + a PAT. `preview: true` is set; flip it when the listing is deemed stable.
3. The deferred polish items (`BACKLOG.md` "Polish / deferred": **the duplicated `EXTENSION_ID` test constant**, indented-code-block phantom, setext headings) are **separate future sessions**, not part of release prep.

### Useful starting context
- **All v1 features done — reuse the patterns.** Pure `core/` (`frontmatter`, `citations`, `refs`, `qmd/model`, `render-args`, `preview-*`, `version`, `execution-delegate`) is `vscode`-free; adapters live in `features/` + `providers/`; both harnesses (vitest unit + `@vscode/test-electron` integration) are established. `extension.ts:18-30` wires everything.
- **Item 2 done (Session 11):** full marketplace metadata is in `package.json` (top block, ~lines 1-45). The runtime extension ID is now **`rmsharp.vscode-quarto-ext`** — the 8 integration suites' `EXTENSION_ID` constants were updated to match (**Learning #18: re-run `test:integration` after ANY publisher/name change** — package + 190 unit stayed green while integration RED'd). The icon is `media/icon.png` (regenerate from `scratchpad/icon.svg` via `rsvg-convert` if needed — Learning #18b). `README.md` is the marketplace listing (relative links work; screenshots pending item 3).
- **Marketplace publish itself needs a Marketplace publisher account + PAT** (operator step) — `publisher: rmsharp` must be registered before `vsce publish`. `preview: true` is set as the honest 0.0.1 first-listing state (flip when you decide it's stable).
- **`microsoft/vscode-markdown-languageservice` (MIT)** is reference only; never copy Posit's AGPL code (licensing hard gate). **Original art only** for icons/branding (Learning #18b).

### How You Will Be Evaluated
The user rates every session's handoff on: (1) was the ACTIVE TASK sufficient to orient? (2) key files with line numbers? (3) gotchas/traps flagged? (4) "what's next" actionable and specific?

---

*Session history accumulates below this line. Newest session at the top.*

### What Session 13 Did — 2026-06-28
**Deliverable:** v1 release-prep — the **`npm audit` posture decision** (the last agent-actionable item before the operator-only `vsce publish`). (IN PROGRESS)
**Started:** 2026-06-28
**Status:** Session claimed. Work beginning.

### What Session 12 Did — 2026-06-28
**Deliverable:** v1 release-prep **item 3** — F5 visual pass + README screenshots. **COMPLETE + verified. Release prep is now down to one item (the `npm audit` decision) + the operator publish.**

**What was done (commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `cdf9320` chore: Session 12 prep — `test/fixtures/showcase.qmd` (one render-clean doc exercising every feature; doc-level `execute: enabled: false` so it needs no kernel), `docs/F5-VISUAL-CHECKLIST.md` (repeatable runbook), `.vscodeignore` (`media/screenshots/**` excluded from the `.vsix`), SESSION_NOTES claim stub.
2. `8aacc0a` feat: the 5 screenshots → `media/screenshots/0{1..5}-*.png`.
3. `05ef0f5` docs: README `## Screenshots` gallery (replaced the placeholder; one captioned + alt-texted image per feature).
4. (this close-out commit: SESSION_NOTES, CLAUDE.md Learning #19, BACKLOG/CHANGELOG/ROADMAP; + a separate dashboard-refresh commit.)
Plus a **temporary** `--disable-extensions` tweak to `.vscode/launch.json` during capture, **reverted before commit** (verified clean diff).

**The pass was live + interactive** (operator chose "live together, now"): the operator drove the dev host and pasted each screenshot into chat; I QA'd framing live and copied each from Claude's image-cache into the repo.

**Verification (all green):**
- `npm run package` → clean **10-file** `.vsix` (29.09 KB); `vsce ls` confirms `media/` ships **only `icon.png`** (screenshots excluded).
- All 5 README image links resolve to real files; vsce rewrites the relative paths to `https://github.com/rmsharp/vscode_quarto_ext/raw/HEAD/media/screenshots/...` (verified by unzipping the packaged `readme.md`) — so they render on the Marketplace **once pushed**.
- `showcase.qmd` renders **exit 0** (`Output created: showcase.html`); `git diff` shows it matches committed (the operator's in-editor edits were undone).
- No `src/` change → **190 unit / 42 integration** baselines unchanged (nothing they cover changed).
- **Phase 3E (runtime smoke test) — SATISFIED, definitively:** the F5 visual pass IS the strongest possible runtime verification — every feature's UI was eyeballed live in a real Extension Development Host running ONLY our extension: highlighting (status bar `Quarto`), Outline populated, `@` completion firing (cross-refs + citekeys in one list), live preview rendering, render succeeding. **This closes the "F5-only visual residue" every prior phase (5 / 6a–6c) logged as un-eyeballed.**

**🔑 Load-bearing findings (→ CLAUDE.md Learning #19):**
- **THE FAITHFULNESS TRAP: Posit's official Quarto extension (`quarto.quarto`) is installed in the user's VS Code and runs in the dev host alongside ours, MERGING providers** (grammar / outline / `@`-completion / `Preview`+`Render`). The first screenshots showed its UI (the tell: a `▷ Run Cell | Run Next Cell` CodeLens — we register none; `grep -ri codelens src/` is empty). **Fix: `--disable-extensions` on the dev host** (keeps the `--extensionDevelopmentPath` extension, disables installed ones). Without this the whole pass is non-faithful.
- **Two-windows trap:** the dev host is a SEPARATE window from the project window; disabling Posit in the *normal* window did nothing. Act only where the file is colorized / status bar reads `Quarto` (title contains `[Extension Development Host]`).
- **Capture: pasted images live at `~/.claude/image-cache/<session-uuid>/<N>.png`** (path printed in chat) — copy from there; macOS clipboard captures don't hit the Desktop.
- **Packaging: screenshots OUT of the `.vsix` but committed + PUSHED** (Marketplace fetches them via the rewritten repo raw URLs).

**Key files:**
- `media/screenshots/01-syntax-highlighting.png` (2000×1951), `02-outline.png` (2000×399), `03-completion.png` (1540×560), `04-preview.png` (1972×2000), `05-render.png` (2000×1366).
- `README.md` — the `## Screenshots` section (after the Status blockquote, before `## Features`).
- `test/fixtures/showcase.qmd` — the render-clean showcase doc (reuses `test/fixtures/refs.bib` for citation completion).
- `docs/F5-VISUAL-CHECKLIST.md` — the repeatable F5 runbook.
- `.vscodeignore` — `media/screenshots/**` exclusion (icon still ships).
- `CLAUDE.md` — Learning #19.

**Gotchas for the next session (the `npm audit` decision):**
1. **Item 3 was the last visual/feature work — what remains is the `npm audit` decision + the operator publish.** Don't re-open the screenshots. (FM #18.)
2. **Push + PUBLIC matter:** the README's screenshot URLs point at `origin/master` raw — they only render once pushed AND while the repo is **public** (verified all 5 → HTTP 200 after the operator made it public; they 404 anonymously on a private repo). The repo is public now; preserve both invariants for any future screenshot change.
3. **If you re-run an F5 pass, re-apply `--disable-extensions`** (the user has Posit's `quarto.quarto` installed) — it is reverted in `launch.json` now.
4. **`npm audit`** = 7 dev-only vulns (`devDependencies`, not in the bundled `dist/extension.js`) — the honest posture is "accepted (dev-only)" unless `npm audit fix` is clean + non-breaking.
5. **Operator cleanup (courtesy):** the operator disabled Posit's Quarto in their *normal* VS Code window during this session; they may want to re-enable it.

**Self-assessment (Session 12): 9/10.**
- **+** Delivered exactly item 3, no bundling (FM #18 held — did NOT touch the `npm audit` decision or any polish item). **The crux was faithfulness, and I held the line:** I refused the first screenshots the moment I saw the `Run Cell` CodeLens (not ours), diagnosed Posit's extension merging in the dev host, and isolated it with `--disable-extensions` so every shipped screenshot is unambiguously our extension (gate-d discipline applied to a *visual* pass, not just tests). Adapted the capture pipeline when the Desktop assumption failed (pivoted to the image-cache — the better mechanism). Recoverable commits, ≤5 files each (split images and README to honor the per-commit cap). Verified the packaging invariants that matter (screenshots excluded, icon ships, vsce URL rewrite confirmed by unzip) instead of assuming; reverted the temporary `launch.json` change and confirmed a clean diff. Retired the standing cross-cutting "F5-only visual residue." And the post-push curl check caught that the rewritten Marketplace image URLs 404'd on the (then-private) repo *before* I declared them live — the operator made the repo public and all 5 verified HTTP 200, so the outward-facing artifact was faithfully confirmed, not assumed.
- **−** The Phase 1B claim stub silently FAILED on the first attempt (I tried to edit from a truncated read) and I did real technical work (showcase + the prep commit) before noticing and re-writing the stub — a protocol slip (the stub must land before technical work); caught and corrected in-session. I also burned a step assuming macOS screenshots land on the Desktop and copied a stale (April) file before switching to the image-cache. Both minor, no lasting damage.

#### Session 11 Handoff Evaluation (by Session 12) — Phase 3A
**Score: 9/10.** Accurate, well-scoped, and load-bearing on exactly the points item 3 needed.
- **What helped:** The ACTIVE TASK named item 3 precisely and pointed at the `<!-- SCREENSHOTS: placeholder -->` slot with "put images under `media/`" — I knew exactly where the output goes. The FM #18 scoping ("don't also do the `npm audit` / deferred polish") was right and I held to it. The baselines (10-file `.vsix`, 190/42) and the Learning #18 icon / `.vscodeignore` notes were accurate and let me reason about the packaging (screenshot exclusion, icon inclusion) confidently.
- **What was missing (genuinely undiscoverable beforehand — now Learning #19):** the handoff (and every prior session) framed the F5 pass as "just eyeball the UI," with no warning that **the user has Posit's `quarto.quarto` installed and it merges with ours in the dev host** — the single biggest issue this session and the thing that makes a naive visual pass non-faithful. No prior session had run an F5 pass, so this couldn't have been known — not Session 11's fault. It also didn't mention the dev-host-vs-normal-window distinction or the image-cache capture path.
- **What was wrong:** Nothing material. Every claim (placeholder location, `media/` convention, baselines, the operator-publish caveat) held.
- **ROI:** Strongly positive — turned the prep into focused execution + a faithfulness-hardening pass, not archaeology.

### What Session 11 Did — 2026-06-28
**Deliverable:** v1 release-prep **item 2** — marketplace metadata (`package.json`) + listing README rewrite. **COMPLETE + verified (incl. a coupling bug caught and fixed).**

**What was done (commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `c18b847` chore: item 2 — marketplace metadata + listing README. `package.json`: `publisher` → `rmsharp`, original `icon` `media/icon.png`, `keywords`/`bugs`/`homepage`/`galleryBanner`/`preview:true`, polished `description`, categories Programming Languages + Data Science. `media/icon.png`: original 256×256 (document card + `</>` + "MIT" badge, from an SVG via `rsvg-convert` — not Quarto's logo). `README.md`: rewritten for the Marketplace, stale status line fixed (drafted via a judge-panel + accuracy-critic workflow against a fixed factual brief).
2. `dcab15e` fix(test): update integration `EXTENSION_ID` for new publisher (1/2) — 5 suites.
3. `98e15aa` fix(test): update integration `EXTENSION_ID` for new publisher (2/2) — 3 suites.
(+ this close-out commit: SESSION_NOTES, CLAUDE.md Learning #18, BACKLOG/CHANGELOG/ROADMAP; + a separate dashboard-refresh commit.)

**Verification (all green):**
- `npm run package` → clean **10-file** `.vsix` (28.82 KB) with **`media/icon.png` embedded** (confirmed via `vsce ls`); no missing-publisher/icon/repository warnings.
- `npm test` → **190/190** vitest (unchanged — no test reads the changed metadata fields; grep confirmed the only `package.json` reads are `contributes.languages`/`grammars`/`activationEvents`).
- `npm run test:integration` → **42/42** in the real downloaded VS Code host (after the `EXTENSION_ID` fix; see below).
- §3.3 guardrail: no `src/` change at all, so untouched.
- **Phase 3E:** no extension/runtime behavior changed (pure metadata/docs/asset); the relevant gate is the clean package with the icon embedded + the integration suite still activating — both done. Not a silent skip — there is no new runtime code path to launch-verify, but the integration run IS the activation smoke test and it passes 42/42.

**🔑 Load-bearing finding (→ CLAUDE.md Learning #18): the publisher→extension-ID coupling.**
- Changing `publisher` `vscode-quarto-ext` → `rmsharp` changed the runtime extension ID `<publisher>.<name>` to `rmsharp.vscode-quarto-ext`. The integration suite **hard-codes** `const EXTENSION_ID = "vscode-quarto-ext.vscode-quarto-ext"` in **all 8** `test/integration/suite/*.test.ts` files (it resolves the extension by ID in each file's `before all` hook).
- `npm run compile`, `npm run package` (clean `.vsix`), AND `npm test` (190/190) ALL passed — only the **full `test:integration` run RED'd 8 "should be discoverable" failures**. Fixed by updating the constant in all 8 suites (commits `dcab15e`, `98e15aa`), then re-ran → 42/42.
- **Lesson (now Learning #18): metadata that is also an identity (publisher/name) is runtime-coupled — re-run the integration suite after such a change; package + unit green is NOT sufficient.** The constant is duplicated across 8 files → added a BACKLOG "Polish" item to extract/derive it from `package.json`.

**README workflow (multi-agent, ultracode):** 3 independent drafts (feature-tour / quick-start / positioning) from a FIXED factual brief (drafters told NOT to read the repo → no stale-content bleed) → judge panel (picked the positioning draft) → accuracy critic (refute-by-default; flagged only 2 low-severity `quarto.org` link items — kept, it's the legitimate CLI download site). Final README = winner + grafted grouped feature subheadings + the colorize `> Note:` callout + the CLI download link. Zero fabricated/overreaching claims (the critic confirmed no NOT-IN-v1 capability leaked in).

**Key files:**
- `package.json` — top metadata block (lines ~1-45): `publisher` `rmsharp`, `icon`, `keywords`, `bugs`, `homepage`, `galleryBanner`, `preview`, `description`, `categories`.
- `media/icon.png` — the shipped icon (256×256). Source SVG is in the session scratchpad (`scratchpad/icon.svg`) — re-author there + `rsvg-convert -w 256 -h 256` if it needs changing; it is NOT checked in.
- `README.md` — the full marketplace listing. `<!-- SCREENSHOTS: placeholder -->` marks where item-3 screenshots go.
- `test/integration/suite/*.test.ts` (×8) — `EXTENSION_ID` now `"rmsharp.vscode-quarto-ext"`.
- `CLAUDE.md` — Learning #18 (the coupling trap + icon/README method).

**Gotchas for the next session (item 3 + audit):**
1. **Re-run `npm run test:integration` after ANY `publisher`/`name`/activation change** — package + unit will lie to you (Learning #18). The 8 `EXTENSION_ID` constants are the tripwire.
2. **`.vsix` is gitignored** (`*.vsix`) — don't commit it. `media/icon.png` IS tracked (not gitignored — verified).
3. **`dashboard_history.jsonl` changes whenever you run the dashboard** — fold it into the close-out dashboard-refresh commit.
4. **`npm audit`** still 7 dev-only vulns (none ship). Decide the posture.
5. **F5 visual pass** remains the only way to eyeball UI (no `code` CLI) — capture screenshots there for the README's placeholder slot.
6. **Actual `vsce publish` is an operator step** — needs a registered Marketplace publisher `rmsharp` + a PAT. `preview: true` is set; flip it when the listing is deemed stable.

**Self-assessment (Session 11): 9/10.**
- **+** Delivered exactly item 2, no bundling into item 3 (FM #18 held — the README leaves a screenshot placeholder rather than starting the F5 pass). Verification was faithful and it MATTERED: I ran the full integration suite even though the change was "just metadata," which caught the publisher→ID coupling that package + 190 unit missed — the failing run was a genuine RED, the fix a clean GREEN, re-verified 42/42 (gate d / Learning #13 discipline applied). Honored the 5-file blast-radius cap (split the 8-file test fix into two commits). Used a judge+critic workflow to keep the outward-facing README free of fabricated/stale claims (the whole point of item 2). Generated original icon art (clean-room posture extends to branding). Asked the operator only the two genuinely-owned decisions (publisher, icon) up front, then proceeded.
- **−** I introduced the coupling bug in the first place by committing the metadata (`c18b847`) before running the integration suite — had I sequenced integration before the deliverable commit, the RED would have preceded the commit. It was caught and fixed in-session with no lasting damage, but the cleaner order is: change identity → integration → commit. Also the duplicated `EXTENSION_ID` constant is a pre-existing smell I had to touch 8 times; I logged it for extraction rather than fixing it now (correctly scoped, but it's debt the project carried).

#### Session 10 Handoff Evaluation (by Session 11) — Phase 3A
**Score: 9/10.** A precise, accurate handoff that made item 2 fast and correctly scoped.
- **What helped:** The ACTIVE TASK enumerated item 2 exactly — "real `publisher` id (the current `vscode-quarto-ext` is a placeholder), an `icon` (PNG ≥128×128), `keywords`, `bugs`/`homepage`; polished `displayName`/`description`" and the README rewrite with the **specific stale-line callout** ("says editor intelligence is 'still to come', but outline + cross-ref + citation completion all shipped") — I knew precisely what to fix and didn't have to rediscover it. The FM #18 scoping ("don't also start item 3") was right and I held to it. Learning #17's note that relative links now work (because `repository` is set) was directly load-bearing for the README's `LICENSE`/`NOTICE` links. The verification baselines (190 unit / 42 integration, clean `.vsix`) all matched reality.
- **What was missing:** It couldn't have known about the publisher→extension-ID coupling (now Learning #18) — that was a live discovery this session. Minor: it said the icon should be "PNG ≥128×128" but didn't flag that no `media/` dir existed yet (trivial — I created it).
- **What was wrong:** Nothing material. Every claim held; the 9-file `.vsix` / flag-free `package` script / `repository`-set state were all exactly as described.
- **ROI:** Strongly positive — turned item 2 into a focused execution pass, not archaeology.

### What Session 10 Did — 2026-06-28
**Deliverable:** v1 release-prep **item 1** — wire the git remote + downstream packaging metadata. **COMPLETE + verified + pushed.**

**What was done (3 commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `cdb030b` chore: claim Session 10 (WIP stub).
2. `3fc953d` chore: release-prep item 1 — wired `origin` (`rmsharp/vscode_quarto_ext`), added the `repository` field to `package.json`, dropped `--allow-missing-repository` from the `package` script, made the README `LICENSE` reference a relative link.
3. (this close-out commit: SESSION_NOTES, CLAUDE.md Learning #17, BACKLOG/CHANGELOG/ROADMAP; + a separate dashboard-refresh commit.)
Plus a git operation (not a file commit): renamed local `main`→`master` and **force-pushed** (`--force-with-lease`) over GitHub's auto-init commit, so `origin/master` is now at the project HEAD.

**Verification (all green):**
- `npm run package` → clean **9-file** `.vsix` (19 KB) **without** `--allow-missing-repository` (the `repository` field now satisfies vsce; no missing-repo warning).
- `npm test` → **190/190** vitest (unchanged — confirms nothing asserts on the changed `package.json` fields).
- `git ls-remote origin master` → `3fc953d…` (push succeeded; remote default branch is already `master`).
- **Phase 3E N/A by design:** this is pure packaging metadata — **no extension/runtime behavior changed**, so there's nothing to launch-verify; the relevant gate is the clean package, which is done (stated explicitly, not a silent skip).

**🔑 Load-bearing findings (→ CLAUDE.md Learning #17):**
- The repo `rmsharp/vscode_quarto_ext` **pre-existed with GitHub auto-init** (throwaway `LICENSE` + 1-line `README.md`) on an **UNRELATED history**, default branch **`master`** (operator's choice, corrected mid-session). Reconciled by renaming local `main`→`master` and **force-pushing with `--force-with-lease`**. Inspect any remote first (`git ls-remote`, `git show origin/<b>`, `git merge-base`) before pushing.
- **vsce normalizes the repo's `LICENSE` (no extension) to `LICENSE.txt` inside the `.vsix`**, but the working-tree file is `LICENSE` — so the README relative link must target `LICENSE` (verified the local filename before linking).
- **Dropping `--allow-missing-repository` needs only the `repository` field in `package.json`** (vsce reads package.json, not the remote) — packaging needs no push.

**Key files:**
- `package.json` — `repository` field added after `"license"`; `scripts.package` is now `npm run compile && vsce package` (flag dropped).
- `README.md` — the License paragraph now uses `[`LICENSE`](LICENSE)` (relative link).
- `CLAUDE.md` — Learning #17 (release-prep item 1 traps).
- Git: `origin` → `https://github.com/rmsharp/vscode_quarto_ext.git`, branch `master` (tracks `origin/master`).

**Gotchas for the next session (release prep item 2/3):**
1. **The README status line is STALE** — it claims editor intelligence (outline/completion) is "still to come", but all of it shipped (Phases 6a–6c). The item-2 README rewrite must fix this.
2. **`publisher` is still the placeholder `vscode-quarto-ext`** — item 2 needs a real Marketplace publisher id (and actually publishing needs a Marketplace account/PAT — an operator step).
3. **Relative links now work** in the README (the `repository` field is set) — safe to use for LICENSE/NOTICE etc.
4. **`.vsix` is gitignored** — don't commit it. `dashboard_history.jsonl` changes whenever you run the dashboard — fold it into the close-out dashboard-refresh commit.
5. **`npm audit`** still 7 dev-only vulns (none ship). Decide the posture.
6. **F5 visual pass** remains the only way to eyeball UI (no `code` CLI) — capture screenshots there for the README.

**Self-assessment (Session 10): 9/10.**
- **+** Delivered exactly item 1, no bundling (FM #18 held — did NOT start item 2's publisher/icon/keywords or the README rewrite). Config/metadata is TDD-exempt, and verification was faithful: `npm run package` *without the flag* directly exercises the claim (the `repository` field is what makes it pass), and 190/190 unit green confirms nothing read the changed fields. Handled two operator corrections cleanly — branch name (`master`) and the force-push reconciliation — and **confirmed the destructive force-push before doing it** (surfaced the auto-init/unrelated-history situation, used `--force-with-lease`, rather than blindly overwriting a commit I didn't create). Caught the `LICENSE` vs `LICENSE.txt` correctness detail (verified the actual local filename before linking). Recorded the wiring traps as Learning #17.
- **−** I proposed the README relative link before verifying the license filename (checked it immediately after — it was correct, but the check should have come first). I also asked the push question before discovering the repo had auto-init, so reconciliation needed a second question — inspecting the remote's contents up front would have folded both into one decision. Both minor, resolved in-session.

#### Session 9 Handoff Evaluation (by Session 10) — Phase 3A
**Score: 9/10.** A precise, well-structured handoff that made item 1 fast.
- **What helped:** The ACTIVE TASK named the exact recipe — *"Add a git remote … add `repository` to `package.json`, DROP `--allow-missing-repository`, lift the README relative-link restriction (Learning #5)"* — verbatim what item 1 required; I was wiring the remote within minutes. The "No git remote yet → vsce needs the flag; README avoids relative links; both lift once a remote + `repository` exist" gotcha was exactly right and told me precisely what to change and why. The verification baselines (190 unit / 42 integration, clean 9-file `.vsix`) all matched reality. The FM #18 reminder correctly scoped me to item 1 only.
- **What was missing (operator-dependent, not Session 9's fault):** it couldn't know the operator would create the repo with **auto-init on a `master` default branch**, so the unrelated-history force-push (now Learning #17) was a live discovery. It also didn't flag that the **README content itself is stale** — a separate item-2 concern I've now surfaced.
- **What was wrong:** Nothing material. Every claim held.
- **ROI:** Strongly positive — turned item 1 into a short mechanical pass, not archaeology.

### What Session 9 Did — 2026-06-28
**Deliverable:** Implement **Phase 6c** — Citation completion. **COMPLETE + verified + adversarially hardened. v1 IS NOW FEATURE-COMPLETE.**

**What was done (9 commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `983bea7` chore: claim Session 9 (WIP stub).
2. `9359bdc` feat: Phase 6c **core front-matter reader** — `src/core/frontmatter.ts` `bibliographyPaths(text)` (the region model skips front matter, so this reads the one key); scalar / flow-list / block-list forms, no YAML lib (decided up front — a focused reader is enough for v1). 8 TDD cycles.
3. `14b413b` feat: Phase 6c **core citation parser** — `src/core/citations.ts` `parseCitations(content)`: BibTeX (brace/quote-aware scanner, skips `@string`/`@comment`/`@preamble`) + CSL-JSON, → `{key,title?,author?,year?}`; never throws on malformed input. 12 TDD cycles.
4. `986f378` feat: Phase 6c **adapter + wiring** — `src/providers/citation.ts` (`registerCitationProviders`, CompletionItemProvider trigger `@`) reads bib paths relative to `dirname(doc)`, parses (core), offers citekeys with title detail; gated on `isReferenceableLine`; wired in `src/extension.ts:30`. Faithful integration tests via `executeCompletionItemProvider` over `citations.qmd` + `refs.bib`.
5. `82af496` fix: review **A/D/E** (frontmatter) — zero-indent block list; trailing YAML comment; empty quoted scalar. TDD.
6. `f7e8509` fix: review **B/F/G/H** (parser) — CSL BOM strip; quote-aware brace matching; paren-delimited entries; CSL year leaf type-guard. TDD.
7. `bbde8a3` fix: review **C** (core) — `citationCompletionContext` with a citekey char class (`:`/`.` keys). TDD.
8. `f793623` fix: review **C** (provider) — use `citationCompletionContext`; colon-key fixture + faithful integration test.
9. `e19a939` test: review **I** — adapter degradation coverage (missing bib / no bib / non-file), discrimination established by break-revert.
(+ this close-out commit: SESSION_NOTES, CLAUDE.md Learning #16, BACKLOG/CHANGELOG/ROADMAP; + a dashboard refresh.)

**Verification (all green):**
- `npm run compile` → tsc clean + esbuild (bundle 36.3 KB → **43.3 KB**, +frontmatter+citations+provider).
- `npm test` → **190/190** vitest (+40: frontmatter 15, citations 25 incl. the context).
- `npm run test:integration` → **42/42** in real downloaded VS Code: citation completion offers citekeys, attaches title detail, **coexists with cross-refs on `@`** (both `@knuth1984` and `@sec-intro` in one list), is **gated out of code cells**, completes a **colon citekey with a whole-token replace range** (no `:1984` dup), and the three degradation paths (no bib / missing bib / untitled) offer nothing without crashing.
- `npm run package` → clean **9-file** `.vsix` (no test/fixture/`.claude` leak — verified via `vsce ls`).
- Fixtures render **exit 0** (`citations.qmd`, `citations-nobib.qmd` via doc-level `execute: enabled: false`); `citations-missingbib.qmd` intentionally fails render (the condition under test; never rendered by the suite — documented like `render-error.qmd`).
- §3.3 guardrail: `grep vscode src/core/` → only doc-comment matches; no import.

**🔑 Load-bearing findings (→ CLAUDE.md Learning #16):**
- **The region model skips front matter**, so reading `bibliography:` needs its own reader. A minimal no-YAML-lib reader is right for v1, but real front matter is messy — the review caught a **zero-indent block list**, a **trailing `# comment`**, and an **empty quoted scalar** the happy path missed.
- **THE BIG TRAP — don't reuse a token-scanner across token grammars.** Reusing the cross-ref `crossrefCompletionContext`/`ID_CHAR` (`[A-Za-z0-9_-]`) for citekeys silently reintroduced the **finding-E class** (Learning #15(b)): citekeys contain `:`/`.` (biblatex/DBLP), so completion **stopped firing after a `:`** and **duplicated the suffix on a mid-token accept**. Fix: a citation-specific `citationCompletionContext` with a citekey char class.
- **Parser robustness the happy path misses:** quote-aware brace matching (a stray `{` in a quoted value else discards the rest of the file); **strip a UTF-8 BOM before `JSON.parse`** (BOM-saved CSL-JSON otherwise loads zero citations, silently — CSL-only, BibTeX is BOM-immune via `indexOf`); paren-delimited entries; CSL date-parts leaf type-guard.
- **Faithful tests for layered-defense adapter branches (gate d):** no single behavior test isolates one guard (defense in depth), so discrimination was established by **breaking each guard and observing the targeted test go RED, then reverting**.

**Adversarial review outcome (5 lenses, 3 refute-by-default verifiers each; 13 raised → 12 confirmed / 1 refuted):**
- **Fixed all 12 confirmed** (9 unique, commits `82af496`–`e19a939`), each TDD'd (RED before GREEN). A=zero-indent block list, B=CSL BOM, C=citekey charset (×2 findings), D=trailing YAML comment (×2), E=empty quoted scalar, F=quote-aware brace match, G=paren entries, H=CSL year leaf, I=adapter degradation tests.
- **Refuted 1** (correctly, 3/3): a leading BOM defeating `.qmd` front-matter detection — verifiers confirmed it's not reachable in the real provider path.
- **Resync-on-match-failure** (review F secondary suggestion) was **considered and NOT added** — no discriminating test exists (a missing brace balances against a later entry rather than returning −1), and strict TDD forbids untested code.

**Key files (with anchors):**
- `src/core/frontmatter.ts` — `bibliographyPaths` (`:54`), `frontMatterLines` (`:22`), `stripComment` (`:54`-ish, quote-aware), `unquote`. Pure.
- `src/core/citations.ts` — `parseCitations` (`:29`, BOM strip + format detect), `citationCompletionContext` (`:~60`, `CITEKEY_CHAR`), `parseBibtex`/`matchBrace`/`matchParen` (quote-aware), `parseCslJson`/`cslAuthors`/`cslYear`. Pure.
- `src/providers/citation.ts` — `registerCitationProviders` (`:27`); completion uses `citationCompletionContext` + `isReferenceableLine`, builds `{inserting,replacing}` range; `loadCitations` (`:94`, reads bib relative to `dirname(doc)`, scheme guard, try/catch). Adapter.
- `src/extension.ts:30` — `registerCitationProviders(context)`.
- `test/unit/frontmatter.test.ts` (15) · `test/unit/citations.test.ts` (25) · `test/integration/suite/citation.test.ts` (8). Fixtures: `citations.qmd`, `refs.bib` (+colon key `Knuth:1984`), `citations-nobib.qmd`, `citations-missingbib.qmd`.

**Gotchas for the next session (v1 release prep):**
1. **v1 is feature-complete — the next milestone is packaging, NOT a feature.** See the ACTIVE TASK above. Don't start the deferred polish items (separate sessions).
2. **No git remote yet** → `vsce package` needs `--allow-missing-repository` (baked into `npm run package`); README avoids relative links. Adding a remote lifts both (Learning #5) and is the first release-prep step.
3. **F5 visual residue is now cross-cutting** — every phase's UI visuals (popups, outline, preview webview, notifications, keybinding feel) are integration-proven but never eyeballed (no `code` CLI). Release prep is the natural time for one F5 pass + screenshots.
4. **`citations-missingbib.qmd` is intentionally not render-clean** (it names an absent bib — the condition under test). Don't "fix" it; it's documented in its body like `render-error.qmd`.
5. **`npm audit`** still 7 dev-only vulns (none ship). Decide the posture during release prep.

**Self-assessment (Session 9): 9/10.**
- **+** Delivered exactly Phase 6c's scope — no bundling (FM #18 held: stopped at v1-feature-complete, did NOT start release prep or the deferred polish). **Strict TDD held throughout** — RED observed before every GREEN across 20 core cycles (8 frontmatter + 12 citations) + every review fix; flagged the no-YAML-lib decision up front per the handoff. Kept §3.3 (three pure modules; thin adapter; grep-verified). **Reused the shared scanner** (`isReferenceableLine`) and the faithful `executeCompletionItemProvider` test pattern. Ran a **5-lens / 3-verifier refute-by-default adversarial review** (44 agents) that found **12 confirmed defects the happy-path suite missed** — including the citekey-charset bug, which is the **finding-E class Learning #15 claimed eliminated, silently reintroduced by reusing the cross-ref scanner** (exactly the kind of regression the review exists to catch). Fixed all 12 with TDD, and **established gate-d discrimination for the degradation tests by break-revert** rather than shipping green-but-hollow guards. Honest discipline: declined the untestable resync tweak; documented the non-render-clean fixture.
- **−** I **shipped the citekey-charset bug in the first adapter pass** by following the handoff's "reuse `crossrefCompletionContext`" advice literally without checking that citekeys have a wider character grammar than cross-ref ids — a moment's thought about "do `:`/`.` keys fit `[A-Za-z0-9_-]`?" would have pre-empted it before the review (it's the precise trap Learning #15 had already flagged once). Likewise the YAML-edge defects (zero-indent list, trailing comment) were foreseeable from "real front matter is messier than the fixture." Both caught and fixed in-session, but they cost review cycles. Residual: the completion **popup's visual feel** is F5-unverified (no `code` CLI) — behavior is fully integration-proven; only pixels are unverified (stated honestly, not a skipped Phase 3E).

#### Session 8 Handoff Evaluation (by Session 9) — Phase 3A
**Score: 9/10.** An excellent, precise handoff — I was building the front-matter reader within minutes and nearly every pointer held.
- **What helped:** The ACTIVE TASK named the deliverable, the plan line, the §3.3 guardrail, and a clean 6-step recipe. The single most valuable items: **"the region model SKIPS front matter, so you need to read it — a minimal `bibliography:`-only reader is likely enough; decide and flag up front"** (I did exactly that, commit 2) and **"make the fixture render-clean — doc-level `execute: enabled: false`"** (Learning #15 gotcha #2 — saved a debugging detour; `citations.qmd` rendered exit 0 first try). The "mirror `crossref.test.ts`, faithful via `executeCompletionItemProvider`" pointer was exactly right, and the coexistence note (both providers on `@`, editor filters) held precisely — the coexistence integration test passed first try. Test-count baselines (150 unit / 34 integration, 9-file `.vsix`) all matched reality.
- **What was slightly off (a 6c-specific discovery, now Learning #16 — not Session 8's fault):** the handoff's step 3 said **"reuse `crossrefCompletionContext` … a bare `@key` is detected the same way."** It is detected the same way *for the happy path*, but citekeys have a **wider character grammar** (`:`/`.`) than cross-ref ids, so verbatim reuse broke completion for biblatex/DBLP keys (review finding C). The advice was reasonable and worked for the demo; the charset mismatch is a genuine discovery. I followed it literally and paid a review cycle — my lapse as much as the handoff's.
- **What was wrong:** Nothing material. Every file anchor (`crossref.ts`, `refs.ts` helpers, `extension.ts:28`), the verification approach, and the counts held.
- **ROI:** Strongly positive — the handoff + plan turned the session into engineering + review, not archaeology.

### What Session 8 Did — 2026-06-27
**Deliverable:** Implement **Phase 6b** — Cross-reference completion + go-to-definition. **COMPLETE + verified + adversarially hardened.**

**What was done (8 commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `4c9f1e8` chore: claim Session 8 (WIP stub).
2. `cc77e99` feat: Phase 6b **core model** — `Heading.id` (the `{#sec-id}` previously parsed-and-discarded is now kept structurally) + `findBodyLines()` (live prose/heading lines, for inline-label scanning), both consuming the single `scanRegions` pass (Learning #14). 2 TDD cycles.
3. `533cb1e` feat: Phase 6b **core refs** — new pure `src/core/refs.ts`: `indexLabels` (3 sources: heading `sec-` ids, `#|`/`//|` cell `label:` options, inline `{#fig-/tbl-/eq-/lst-…}` on body lines), `refIdAt`, `crossrefCompletionContext`, `findLabel`. 8 TDD cycles. **Also fixed a single-line-comment skip-region leak** surfaced by the Learning-#14 agreement test.
4. `2e9b580` feat: Phase 6b **adapter + wiring** — `src/providers/crossref.ts` (`registerCrossrefProviders`: CompletionItemProvider trigger `@` + DefinitionProvider) + `src/extension.ts:29`; faithful integration test via `executeCompletionItemProvider`/`executeDefinitionProvider` over a new `crossrefs.qmd`.
5. `5ea7818` fix: review hardening (refs) — A/C/I/H (idColumn lastIndexOf; cell-label id grammar + quotes; skip heading lines in Source 3; mask inline code spans) + E-core (`crossrefCompletionContext.end`).
6. `4d4fc97` fix: review hardening (model) — J: tempered single-line-comment regex (greedy `.*` was swallowing content between two same-line comments).
7. `9a1b75b` fix: review hardening (providers) — E (whole-token `{inserting,replacing}` range) + F/G (gate both providers to prose via new `isReferenceableLine`); in-cell fixture + tests.
8. `95d065f` docs: defer indented-code-block phantom (B/D) as a known limitation (model docstring + backlog).
(+ this close-out commit: SESSION_NOTES, CLAUDE.md Learning #15, CHANGELOG/ROADMAP/BACKLOG; + a dashboard refresh.)

**Verification (all green):**
- `npm run compile` → tsc clean + esbuild (bundle 29.3 KB → **36.3 KB**, +refs+providers).
- `npm test` → **150/150** vitest (+39: 35 in new `refs.test.ts`, +4 model). The 17 cell tests + model tests held throughout (regression net).
- `npm run test:integration` → **34/34** in the real downloaded VS Code: 9 crossref tests via `executeCompletionItemProvider`/`executeDefinitionProvider` — completes all 6 labels; resolves go-to-def to heading + cell-label; **no completion/definition inside a `{python}` cell** (with a prose control); whole-token replace range — all env-independent (no CLI/Jupyter).
- `npm run package` → clean **9-file** `.vsix` (no test/fixture/`.claude` leak).
- Both fixtures (`crossrefs.qmd`, `crossrefs-incell.qmd`) render **exit 0**.
- §3.3 guardrail: `grep vscode src/core/` → none. Providers import core, never the reverse.

**🔑 Load-bearing findings (→ CLAUDE.md Learning #15):**
- **Three label sources, one scanner.** `core/refs.ts` builds its index entirely on `findHeadings`/`findAllCells`/`findBodyLines` (all views over `scanRegions`) — no third scanner. The Learning-#14 agreement test (label-like text in front matter / comments / fences must NOT be indexed) is the guard; it immediately caught a **single-line `<!-- … -->` comment leak** (only block comments were skipped before).
- **The jupyter-engine render trap.** A python-only `.qmd` with per-cell `#| eval: false` STILL fails `quarto render` in this shell (no `nbformat`) — the **jupyter engine ignores per-cell eval:false at kernel-start**. `sample.qmd` only rendered clean because its `{r}` cell selects the **knitr** engine. Fix for python-only fixtures: doc-level **`execute: enabled: false`** in front matter.
- **The adversarial review earns its keep again.** A 5-lens / refute-by-default workflow found **10 findings, all confirmed by two independent verifiers** (several traced through the real code AND `quarto render`). 7 fixed with TDD; 1 (indented-code-block phantom) deferred with documentation.

**Adversarial review outcome (5 lenses, 2 refute-by-default verifiers each; 10 confirmed):**
- **Fixed 7** (TDD, commits `5ea7818`/`4d4fc97`/`9a1b75b`): A idColumn `lastIndexOf`; C cell-label id grammar + optional YAML quote; I skip heading lines in inline Source 3; H mask inline backtick code spans; J tempered single-line-comment regex; E whole-`@id`-token replace range; F/G gate both providers out of code cells / front matter / comments (`isReferenceableLine`).
- **Deferred 1** (documented, BACKLOG + model docstring): B/D inline `{#fig-…}` inside a CommonMark §4.4 *indented* (4-space) code block is a phantom — a faithful fix must not false-skip 4-space list-item continuation content (model tracks no list context), so it needs its own list-aware TDD pass. Low severity.

**Key files (with anchors):**
- `src/core/refs.ts` — `indexLabels` (`:78`, 3 sources + sort + dedupe), `findLabel` (`:~140`), `isReferenceableLine` (`:~150`, prose/heading gate for the providers), `refIdAt` (`:~165`), `crossrefCompletionContext` (`:~190`, returns `{start, typed, end}`), `maskInlineCode`/`idColumn` (`:~210`/`:~230`). Regexes `:44–66`. Pure.
- `src/core/qmd/model.ts` — `Heading.id` (`:18`), `findBodyLines` (`:~245`), `scanRegions` adds `bodyLines` + the `COMMENT_FULL_LINE` tempered regex (`:~118`). Known-limitations docstring `:11`.
- `src/providers/crossref.ts` — `registerCrossrefProviders` (`:24`); completion gates on `isReferenceableLine` + builds `{inserting, replacing}` range (`:40`); definition gates + resolves via `findLabel` (`:~90`). Adapter.
- `src/extension.ts:29` — `registerCrossrefProviders(context)`.
- `test/unit/refs.test.ts` (35) · `test/integration/suite/crossref.test.ts` (9, incl. in-cell guard + `replaceRange` helper). Fixtures: `crossrefs.qmd`, `crossrefs-incell.qmd`.

**Gotchas for the next session (Phase 6c):**
1. **Reuse `crossrefCompletionContext` + `isReferenceableLine`** from `core/refs.ts` — a bare `@key` citation is detected the same way, and citations are prose-only too. Don't re-derive the `@` context.
2. **Render trap (above):** make any `{python}`-cell fixture render-clean with doc-level **`execute: enabled: false`** (per-cell `eval: false` is NOT enough for the jupyter engine). `sample.qmd` only escapes it via its `{r}` cell (knitr engine).
3. **Reading `bibliography:` means reading FRONT MATTER** — the region model deliberately skips it, so 6c needs a small front-matter reader. No YAML lib is in the project; a minimal `bibliography:`-only parser is likely enough for v1 (decide and flag up front).
4. **6b + 6c completion providers coexist on `@`** — VS Code merges them; the editor filters by typed text. Just register both; no conflict.
5. **Deferred from 6b (NOT bugs in handled input):** indented-code-block phantom (B/D, backlog) and setext headings (Phase 6a, backlog). If a 6c fixture needs them, it won't behave — use ATX headings and fenced/inline constructs.
6. **`npm audit`** still 7 dev-only vulns (none ship). No git remote → `vsce package` needs `--allow-missing-repository` (baked into `npm run package`).

**Self-assessment (Session 8): 9/10.**
- **+** Delivered exactly Phase 6b's scope, no bundling (FM #18 held — stopped before 6c). **Strict TDD held throughout** — RED observed before every GREEN across 10 core cycles + every review fix (incl. re-running the integration suite to see the 3 provider-fix failures RED before implementing). Kept §3.3 (pure `core/refs.ts`; thin adapter; grep-verified). **Consumed the shared scanner** (Learning #14) — `core/refs.ts` writes no line logic of its own; the agreement test caught a real single-line-comment leak mid-implementation. **Faithful, env-independent verification** via `execute*Provider` (incl. discriminating negative + control tests: no completion/definition inside a cell, with a prose control that still resolves). Ran an adversarial review whose verification was genuinely discriminating (verifiers reproduced findings against the real code AND `quarto render`); fixed 7 with TDD and deferred 1 with honest documentation rather than risking a list-unaware shared-scanner change. Caught + documented the jupyter-engine render trap.
- **−** I shipped several real defects in the first adapter pass that the happy-path tests missed — most notably the **providers firing inside code cells** (F/G) and the **mid-token replace-range duplication** (E), both of which a moment's thought about "where does this provider fire / what does accept replace?" would have pre-empted before the review. The **review's confirmation gate was lenient** (≥1 real, ties→confirmed) — it happened that both verifiers voted real on all 10, so no false-confirm slipped through, but I adjudicated each by hand rather than trusting the count (correct, but a strict-majority gate would have been cleaner up front). Residual: the completion **popup's visual feel** is F5-unverified (no `code` CLI) — behavior is fully integration-proven; only the rendered popup is cosmetic-unverified (stated honestly, not a skipped Phase 3E).

#### Session 7 Handoff Evaluation (by Session 8) — Phase 3A
**Score: 9.5/10.** An outstanding, precise handoff — I was extending the model within minutes and nearly every pointer held exactly.
- **What helped:** The ACTIVE TASK named the deliverable, the plan line, the §3.3 guardrail, and the **exact first step** — *"the `{#sec-id}` is parsed-and-discarded in `parseHeadingLine`; 6b's first job is to keep it; the matching test to update is 'Pandoc/Quarto heading attributes'"* — which I followed verbatim (Cycle 1). The single most load-bearing item: **Learning #14 "consume `scanRegions`, don't write a third scanner; parsers that overlap must agree on skip-regions"** — that shaped the whole `core/refs.ts` design (three sources, all views over the one scan) and the agreement test it prescribed immediately caught a real single-line-comment leak. The "provider-via-`execute*Provider` is the faithful test, mirror `outline.test.ts`" pointer was exactly right. Test-count baselines (111 unit / 25 integration, 9-file `.vsix`) all matched reality.
- **What was missing / worth correcting (all 6b-specific discoveries, now Learning #15):** it couldn't have flagged (a) the **jupyter-engine render trap** (per-cell `eval:false` doesn't avoid the kernel for a python-only doc — cost a debugging detour on the fixture), or (b) that the cross-ref **completion/definition providers must be gated out of code cells** (the adversarial review caught it). Neither is Session 7's fault.
- **What was wrong:** Nothing material. Every file anchor, the parsed-and-discarded claim, the verification approach, and the counts held.
- **ROI:** Strongly positive — the handoff + plan turned the session into engineering + review, not archaeology.

### What Session 7 Did — 2026-06-27
**Deliverable:** Implement **Phase 6a** — Document outline / symbols. **COMPLETE + verified + adversarially hardened.**

**What was done (4 commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `b4b9a24` chore: claim Session 7 (WIP stub).
2. `d7f9b55` feat: Phase 6a **core** — new pure `src/core/qmd/model.ts` (`findHeadings`, `buildOutline`); **folded in** Phase 5's `core/cells.ts` (now a re-export shim) so heading + cell detection share one fence scanner. Strict-TDD (6 red→green cycles).
3. `74794ed` feat: Phase 6a **adapter + wiring** — `src/providers/outline.ts` (`registerOutlineProvider`, maps core→`vscode.DocumentSymbol`) + `src/extension.ts:27`; `test/integration/suite/outline.test.ts` (faithful via `executeDocumentSymbolProvider`).
4. `dc2e868` fix: Phase 6a **hardening** from a 5-lens adversarial review — unified the two scanners into one `scanRegions` pass (6 confirmed findings fixed).
(+ this close-out commit: SESSION_NOTES, CLAUDE.md Learning #14, model.ts setext note, BACKLOG/CHANGELOG/ROADMAP; + a dashboard refresh.)

**Verification (all green):**
- `npm run compile` → tsc clean + esbuild (bundle 24.6 KB → **29.3 KB**, +model+provider).
- `npm test` → **111/111** vitest (38 new in `qmd-model.test.ts`; the 17 `cells` tests stayed green throughout the consolidation = regression net).
- `npm run test:integration` → **25/25** in real downloaded VS Code (v1.126.0): the new outline test asserts the **full `sample.qmd` symbol tree** via `vscode.executeDocumentSymbolProvider` (Heading One › {Embedded code cells › 4 cells, Done}) — env-independent, no CLI/Jupyter. All Phase 5 run-cell tests still pass (the shared-model hardening did not regress them).
- `npm run package` → clean **9-file** `.vsix` (no test/fixture/`.claude` leak).
- §3.3 guardrail: `grep vscode src/core/` → only doc-comment matches; no import. The provider imports core, never the reverse.

**🔑 Load-bearing findings (→ CLAUDE.md Learning #14):**
- **One region scanner, many views.** `scanRegions()` classifies every line once (front matter | HTML comment | fence | ATX heading); `findHeadings`/`findAllCells`/`findCellAtPosition`/`buildOutline` are thin views. This is what makes the "single source of truth" docstring TRUE.
- **The "two scanners disagree" trap** (the review's core catch). 6a first shipped `findHeadings` (front-matter+fence aware) and a SEPARATE `findAllCells` (fence-aware only). They disagreed on skip-regions → `findAllCells` found phantom cells inside YAML front matter / HTML comments / 4-space-indented fences, corrupting both the outline AND Phase 5 run-cell. **97/25 happy-path tests all missed it.** The 5-lens adversarial review (refute-by-default verification) found 8 confirmed; unifying the scanner fixed 6.
- **Provider-via-`executeDocumentSymbolProvider` is the faithful, env-independent test** (extends #3/#9). Registering a provider needs no `package.json` contribution and isn't context-key-gated → the Learning #13a dead-on-arrival activation trap does NOT recur here.

**Adversarial review outcome (5 lenses, refute-by-default verify, 10 findings → 8 confirmed / 2 refuted):**
- **Fixed 6** (commit `dc2e868`): front-matter skip now shared with cells (#1/#2/#5); HTML-comment skip (#1); 0–3-space fence-indent cap matching ATX, CommonMark §4.5 (#3/#6); strip Pandoc `{#sec-id .class}` from the display name (#8); drop empty closing-hash heading `## ##` (#4).
- **Deferred 1** (documented, not a defect in handled input): **setext headings** `===`/`---` (#7) — needs `---` disambiguation vs thematic break / front matter; own TDD pass. In BACKLOG "Polish / deferred" + a `model.ts` docstring note.
- **Refuted 2** (no action — correctly): lone-`\r` classic-Mac EOL (a verifier opened such a file in the real host and confirmed VS Code normalizes EOL, so `getText()` never yields lone `\r` — my `lineSpan` clamp is sound); and a duplicate setext vote.

**Key files (with anchors):**
- `src/core/qmd/model.ts` — `scanRegions` (`:~165`, the single pass: front matter `:~180`, fence/cell `:~195`, HTML comment `:~210`, ATX heading `:~228`); `findHeadings`/`findAllCells` (thin wrappers `:~240`); `buildOutline` (`:~260`, nest-by-level stack + `sectionEndOf`); `parseHeadingLine` (`:~320`, strips `ATX_ATTRIBUTE` then `ATX_CLOSING` — **the `{#sec-id}` is parsed and currently discarded; Phase 6b must keep it**). Regexes `:58–95`. Pure.
- `src/core/cells.ts` — now a 1-line re-export shim over `./qmd/model` (Phase 5 + `cells.test.ts` import it unchanged).
- `src/providers/outline.ts` — `registerOutlineProvider` (`:16`), `QmdDocumentSymbolProvider` (`:25`), `toDocumentSymbol` (`:~37`, heading→`SymbolKind.String` / cell→`Function`), `lineSpan` (`:~62`, clamps to `document.lineCount`). Adapter.
- `src/extension.ts:27` — `registerOutlineProvider(context)`.
- `test/unit/qmd-model.test.ts` (38) — heading parsing, ATX edge rules, fence/front-matter/comment awareness, attribute strip, `buildOutline` nesting + sample.qmd ground-truth, region-consistency (cells & headings agree).
- `test/integration/suite/outline.test.ts` — `symbolsFor()` via `executeDocumentSymbolProvider`; asserts the sample.qmd tree.

**Gotchas for the next session (Phase 6b):**
1. **`core/qmd/model.ts` is the shared model — consume it, don't write a third scanner** (Learning #14). 6b's `core/refs.ts` should call `findHeadings`/`findAllCells`/`scanRegions`.
2. **The `{#sec-id}` id is parsed-and-discarded** in `parseHeadingLine`. 6b's FIRST step: add an `id`/attrs field to `Heading` and keep it (update the "Pandoc/Quarto heading attributes" test). The section-id label source for `@sec-`.
3. **Labels also live in `#| label: fig-foo` cell options** (figures/tables from code) — scan `cell.code`. And `{#fig-...}` on images/divs.
4. **Provider test via `vscode.executeCompletionItemProvider`/`executeDefinitionProvider`** in the host (faithful, env-independent) — mirror `outline.test.ts`. Completion trigger char is `@`.
5. **Setext headings are NOT parsed** (deferred) — if a 6b test doc uses a setext-underlined section as a `@sec-` target, it won't be found. Use ATX `{#sec-id}` headings in fixtures.
6. **`npm audit`** still 7 dev-only vulns (unchanged; none ship). No git remote → `vsce package` still needs `--allow-missing-repository` (baked into `npm run package`).

**Self-assessment (Session 7): 9/10.**
- **+** Delivered exactly Phase 6a's scope, no bundling (FM #18 held — stopped before 6b). Four recoverable commits, ≤5 files each, full verification at each layer boundary (vertical-slice gate c). **Strict TDD held throughout** — RED observed before every GREEN across 9 cycles (6 core + 3 hardening), and the consolidation refactor kept the 17 Phase-5 cell tests green as a deliberate regression net (FM #20: re-read model.ts before each edit). Kept §3.3 (pure `core/qmd/model.ts`; thin adapter; grep-verified no `vscode` import). **Faithful verification:** the integration test exercises the REAL registered provider via `executeDocumentSymbolProvider` (not a stand-in), asserting the full tree env-independently. Ran a 5-lens adversarial review whose verification was discriminating (10 findings → 8 confirmed / 2 refuted, incl. a verifier that opened a lone-`\r` file in the real host to refute a plausible-but-wrong EOL finding); **unified the two scanners** to fix the root cause (not symptom-patch each producer) — which also improved Phase 5 run-cell — and re-ran the full unit+integration suite to confirm no regression. Honest scope discipline: deferred setext with documentation rather than gold-plating at close-out.
- **−** **I shipped the "two scanners disagree" defect in the first two commits** — `findAllCells` not honoring front matter was a latent Phase-5 gap I carried forward by consolidating cell logic without re-checking it against the new front-matter awareness I'd just added to `findHeadings`. A moment's thought at the consolidation step ("do both producers now agree on skip-regions?") would have caught it before the review. Caught and fixed in-session (root-cause unification), but it cost a review cycle. Genuine residual gap: the **Outline view's visual rendering** is F5-unverified (no `code` CLI) — the symbol *structure* is fully integration-proven, so this is cosmetic, stated honestly (not a skipped Phase 3E).

#### Session 6 Handoff Evaluation (by Session 7) — Phase 3A
**Score: 9.5/10.** An excellent, precise handoff — I was implementing within minutes and nearly every pointer held exactly.
- **What helped:** The ACTIVE TASK named the deliverable, the plan line, and the §3.3 guardrail, and the gotchas were all real and load-bearing. The single most valuable item: *"`core/cells.ts` is the cell half of 6a's model — FOLD IT IN, don't duplicate"* with the explicit "call it, or move it under `core/qmd/`" latitude — that shaped the whole core design (I made `cells.ts` a shim over the new model). The **"heading-in-cell trap"** gotcha (a `#` inside a cell is a comment, `#|` is an option) pointed me straight at fence-awareness as the core requirement. The **"provider, not command → `executeDocumentSymbolProvider` is the strongest verification"** note was exactly right and became the faithful integration test. File anchors (`render.ts:24` for the registration shape, `extension.ts:24` for wiring) all resolved. The "73 unit + 24 integration, clean 9-file `.vsix`" baseline matched reality.
- **What was missing / worth correcting:** The handoff framed `core/cells.ts` as something to "reuse for the cell regions" alongside new heading parsing — which subtly invited the **two-scanners-disagree** architecture I initially built (separate cell + heading scans). It did not flag that the two producers must agree on ALL skip-regions (front matter, comments, indented code), which the adversarial review then surfaced. Not Session 6's fault (a 6a-specific discovery), but it's now Learning #14 and the §"Gotchas" above. Minor: the handoff's `findAllCells :55` anchor was pre-consolidation (the line moved when I folded it into `model.ts`).
- **What was wrong:** Nothing material. Every factual claim (test counts, the fold-in latitude, the verification approach, anchors) held.
- **ROI:** Strongly positive — the handoff + plan turned the session into engineering + review, not archaeology.

### What Session 6 Did — 2026-06-27
**Deliverable:** Implement **Phase 5** — `Quarto: Run Cell` family. **COMPLETE + verified.**

**What was done (8 commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `0590d73` chore: claim Session 6 (WIP stub).
2. `8048dbc` feat: Phase 5 **core cell-finder** — `src/core/cells.ts` (`findAllCells`/`findCellAtPosition`) + `test/unit/cells.test.ts`. Strict-TDD (RED→GREEN per behavior).
3. `1200a09` feat: Phase 5 **core delegate logic** — `src/core/execution-delegate.ts` (`delegateCommandsFor`/`pickDelegate`/`buildCellSnippet`) + test.
4. `8953482` feat: Phase 5 **adapter + wiring + contributions** — `src/features/execution.ts` + `src/extension.ts` + `package.json` (5 commands + keybindings).
5. `95b020d` test: Phase 5 **integration** — `test/integration/suite/execution.test.ts` (registration + faithful stand-in dispatch) + `test/fixtures/run-cells.qmd`.
6. `6defa26` fix: Phase 5 **core** — track `~~~` tilde fences (review #1).
7. `a9d481d` fix: Phase 5 **hardening** from an adversarial review — 4 confirmed (#4 activation, #3 skip-and-continue, #5 advance-past-empty, #6 context-key staleness).
8. `0f8380b` test: Phase 5 — faithful coverage for the fixes (+6 tests) + `test/fixtures/run-cells-mixed.qmd`.
(+ this close-out commit: SESSION_NOTES, CLAUDE.md Learning #13, CHANGELOG/BACKLOG/ROADMAP; + a dashboard-refresh commit.)

**Verification (all green):**
- `npm run compile` → tsc clean + esbuild (bundle 16.5 KB → **24.6 KB**, +execution).
- `npm test` → **73/73** vitest (17 `cells` + 11 `execution-delegate` new).
- `npm run test:integration` → **24/24** in real downloaded VS Code (v1.126.0): registers all 5 commands; **faithfully dispatches via a stand-in `jupyter.execSelectionInteractive`** (clean host has no Jupyter) asserting find-cell→select-code→invoke and the exact **selected text**; skip-and-continue across the mixed fixture; advance-past-empty; graceful in non-quarto / no-active-editor; `onLanguage:quarto` contribution guard.
- `npm run package` → clean **9-file** `.vsix` (no test/fixture/`.claude` leak).

**🔑 Three load-bearing findings (→ CLAUDE.md Learning #13):**
- **Dead-on-arrival keybindings (review #4).** `activationEvents: []` does NOT activate the extension when a `.qmd` opens (language/grammar contributions don't trigger activation — only the auto-`onCommand` does), so the `quarto.inCodeCell` context key gating ctrl/shift+enter was never set → keybindings dead until a palette command ran. The integration suite **masked** this (it force-`activate()`s in `before()`). Fixed: `onLanguage:quarto`. Caught only by the adversarial review.
- **Faithful delegated-dispatch via a STAND-IN command.** The clean test-electron host has no Jupyter, so registering a stand-in `jupyter.execSelectionInteractive` that captures the **selected text** proves the whole dispatch chain env-independently (gate d; extends Learning #9).
- **Run-cell runs the IN-EDITOR buffer (no `doc.save()`)** — unlike render/preview (which save because the CLI reads disk). The delegated path depends on the user's **kernel + language extension**, not the Quarto CLI.

**Key files (with anchors):**
- `src/core/cells.ts` — `findAllCells` (`:55`), `findCellAtPosition` (`:~100`): fence-char-aware (backtick+tilde) linear scanner; `CELL_INFO` (`:39`) excludes `{{}}`/`{.}`; nested + tilde fences tracked as opaque non-cells. Pure.
- `src/core/execution-delegate.ts` — `pickDelegate(lang, available)` (`:~22`), `delegateCommandsFor` (`:~46`: python→`jupyter.execSelectionInteractive` / r→`r.runSelection` / julia→`language-julia.executeCodeBlockOrSelection`), `buildCellSnippet`. Pure.
- `src/features/execution.ts` — `registerExecutionFeature` (`:~30`, 5 commands + selection/active-editor/doc-change listeners), `runCells` (`:~120`, **skip-and-continue** + one end-of-batch summary warning), `cellCodeRange` (`:~155`, selection math), `advanceToNextCell`, `insertCell`, `updateCellContext` (`:~215`, active-editor-only guard). Adapter.
- `src/extension.ts:24` — `registerExecutionFeature(context)`.
- `package.json` — `activationEvents:["onLanguage:quarto"]` (`:16`); 5 `quarto.run*`/`insertCell` commands; `contributes.keybindings` (ctrl/shift+enter, `when: "… && quarto.inCodeCell"`).
- `test/integration/suite/execution.test.ts` — `registerStandInDelegate()` (`:~32`, the faithful technique; captures selected text), 14 tests. Fixtures: `run-cells.qmd` (2 python cells), `run-cells-mixed.qmd` (python multi-line / r / empty / python).

**Gotchas for the next session (Phase 6a):**
1. **`core/cells.ts` is the cell half of 6a's region model — FOLD IT IN, don't duplicate.** It's pure, fence-aware, 17 tests. 6a adds heading parsing on top of the same fence-awareness.
2. **Heading-in-cell trap:** a `#` inside a cell is a comment, `#|` is a cell option — scan for headings only OUTSIDE cells (reuse `cells.ts`'s fence tracking).
3. **6a is a provider, not a command** — `registerDocumentSymbolProvider`; test faithfully + env-independently via `vscode.executeDocumentSymbolProvider` (no Jupyter/CLI). Strongest verification here.
4. **Strict TDD held this session** (RED shown before every GREEN, incl. re-deriving RED on the integration behavior-changes). Keep it.
5. **F5-only residue (NOT a skipped 3E — automation-impossible):** the **keybinding feel** (ctrl/shift+enter inside a cell) and **real run-in-interactive-window with Jupyter installed** are not headlessly verifiable (no `code` CLI; clean host has no Jupyter). The *behavior* is integration-proven via the stand-in; only the real-extension hop + key feel are F5. **Recommend the operator F5-check** ctrl+enter inside a `{python}` cell with the Jupyter extension installed.
6. **`npm audit`** still 7 dev-only vulns (unchanged; none ship in the `.vsix`). No git remote → `vsce package` still needs `--allow-missing-repository` (baked into `npm run package`).

**Self-assessment (Session 6): 9/10.**
- **+** Delivered exactly Phase 5's pre-declared family scope (5 commands), no bundling — stopped before 6a (FM #18 held). **Strict TDD held throughout** — RED observed before every GREEN, including deliberately removing my own over-anticipated unterminated-cell branch to drive it back via a failing test (a direct correction of Session 5's impl-first lapse). Kept §3.3 (two pure `core/` modules; thin adapter). **Faithful verification:** invented the stand-in-delegate technique so dispatch is proven env-independently (gate d), and captured the selected **text** (not just "something happened") to pin the selection math. Ran an adversarial multi-agent review whose verification was discriminating (23 findings → **10 confirmed / 13 rejected**); fixed **8** of the confirmed (incl. the dead-on-arrival keybinding bug the happy-path suite masked — exactly the class Learning #12 warned about) and **declined 2** borderline with documented rationale, each fix TDD'd (re-ran the integration suite to observe RED on the 3 behavior changes).
- **−** I set a **lenient confirmation threshold** in the review (a single "real" vote among two confirmed a finding), so "10 confirmed" included borderline splits I then triaged by hand — a strict-majority gate would have pre-filtered #2. The **activation gap (#4) I should have foreseen** (I knew `activationEvents` was `[]`); it took the review to surface it. Context-key staleness (#6) and the real-delegation hop remain **F5-verified only** (automation-impossible here) — stated honestly, not a skipped 3E.

#### Session 5 Handoff Evaluation (by Session 6) — Phase 3A
**Score: 9.5/10.** An outstanding, precise handoff — I was implementing within minutes, and nearly every pointer held.
- **What helped:** The ACTIVE TASK named the exact deliverable (the Phase 5 family) and plan lines, and the **4 dragons** were all real and correctly prioritized. The single most valuable item: *"keep cell detection a pure `core/` fn and TDD it — the bulk of correctness is there"* — exactly right; `core/cells.ts` is where the session's value concentrated. Reuse pointers were accurate and load-bearing: `render.ts`/`preview.ts` were the right adapter templates, `sample.qmd`'s discrimination cases (`{python}` vs plain ` ```python ` vs `{{}}`) were precisely the cases to test, and the **Learning #9 faithful-verification warning** (host extensions differ) directly shaped the stand-in-delegate technique. The *"STRICT TDD, lead with the failing test, Session 5 was corrected for impl-first"* note was heeded — RED led every cycle.
- **What was missing / worth correcting:** The handoff noted keybindings were "safe now the TOCTOU is fixed" (true for lifecycle) but did NOT flag the **activation-event gap** — a keybinding gated on a context key set in `activate()` is dead until the extension activates, and `activationEvents:[]` doesn't activate on `.qmd` open. Not Session 5's fault (a Phase-5-specific discovery), but it cost a review cycle; now Learning #13(a). It also under-specified that run-cell should NOT save the buffer (a real design point vs render/preview) — minor, I derived it.
- **What was wrong:** Nothing material. Every file anchor (`render.ts:24`, `preview.ts:343`, `cli.ts:60/:22`), test count, and reuse target held.
- **ROI:** Strongly positive — the handoff + plan turned the session into engineering + review, not archaeology.

### What Session 5 Did — 2026-06-27
**Deliverable:** Implement **Phase 4** of the architecture plan — `Quarto: Preview`. **COMPLETE + verified.** (Plus two operator directives handled mid-session: enshrining strict TDD, and fixing the stale README.)

**What was done (6 commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `9307970` docs: **enshrine strict TDD project-wide** (operator directive) — added a binding override subsection + Learning #10 to `CLAUDE.md` (the correct non-synced file; SESSION_RUNNER/SAFEGUARDS/`docs/methodology/` are synced byte-identical).
2. `dc25322` feat: Phase 4 **core parser** — `src/core/preview-url.ts` (`parseBrowseUrl`, pure/`vscode`-free) + `test/unit/preview-url.test.ts`. Built strict-TDD (4 red→green cycles).
3. `a7fbfa1` feat: Phase 4 **core HTML/CSP builder** — `src/core/preview-html.ts` (`buildPreviewHtml`) + test (3 TDD cycles).
4. `ff9e2c2` feat: Phase 4 **adapter + wiring + contribution** — `src/features/preview.ts` (`PreviewManager`, spawn/parse/webview/lifecycle) + `src/extension.ts` (wire + `deactivate()` body) + `package.json` (`quarto.preview`).
5. `0e56d93` test: Phase 4 **integration** — `test/integration/suite/preview.test.ts` (registration + faithful no-orphan lifecycle).
6. `9ec813d` fix: Phase 4 **hardening from an adversarial review** — 5 confirmed fixes (TOCTOU race + 4 low-sev), TOCTOU regression-tested.
(+ this close-out commit: SESSION_NOTES, CLAUDE.md Learnings #11/#12, README, BACKLOG/CHANGELOG/ROADMAP; + a dashboard-refresh commit.)

**Verification (all green):**
- `npm run compile` → tsc clean + esbuild (bundle 8.5 KB → **16.5 KB**, render+preview).
- `npm test` → **45/45** vitest (4 preview-url + 3 preview-html new).
- `npm run test:integration` → **10/10** in real downloaded VS Code (v1.126.0): registers `quarto.preview`; **spawns a real preview and reaps the deno worker on pane close (no orphan)** in ~3.8 s; **TOCTOU test** fires the command twice concurrently and confirms no orphan.
- `npm run package` → clean **9-file** `.vsix` (no test/fixture/`.claude` leak).
- **Live CLI verification (observed, not assumed):** captured `quarto preview sample.qmd --no-browser` → `Browse at http://localhost:3958/` on **STDERR** (stdout empty), ANSI-wrapped; the process-group kill leaves no orphan.

**🔑 Three load-bearing findings:**
- **Process-tree reaping + the deno-worker faithful-verification trap (→ Learning #11).** `quarto preview` is a bash wrapper that spawns a long-lived **deno worker** (`quarto.js preview`). Killing the wrapper first **reparents** the worker → orphan. Fix: spawn **`detached`** and group-kill (`process.kill(-pid, SIGTERM→SIGKILL)`, gated on a `kill(-pid,0)` liveness probe). **`pgrep -f "quarto preview"` matches the wrapper but NOT `quarto.js preview`** — so that probe (which the Session-4 handoff and Learning #4 both suggested) reports "clean" while the worker orphans. Caught a real orphan from my own capture script this way; the test probe now matches `preview.*sample.qmd` (both processes).
- **TOCTOU race in the single-preview guard (→ Learning #12), found by adversarial review, missed by the happy-path test.** The guard read the sessions map before the `save()`/`resolveBinary()` awaits; the session was registered after → two rapid invocations orphan the first server. Fix: reserve the slot synchronously in a `starting` Set before any await.
- **Strict TDD is now a standing operator directive** (Learning #10 / CLAUDE.md §Mandatory development practice). Applies to every future session.

**Key files (with anchors):**
- `src/core/preview-url.ts` — `parseBrowseUrl(stderr)` (`:30`): strips ANSI, requires a complete newline-terminated line (truncation guard). Pure.
- `src/core/preview-html.ts` — `buildPreviewHtml({url})` (`:28`): full-bleed sandboxed iframe; CSP `default-src 'none'`, `frame-src <origin>` (origin from `new URL().origin`), URL HTML-escaped (`escapeAttr` `:20`). Pure.
- `src/features/preview.ts` — `PreviewManager` (`:48`): `openPreview` (`:66`, `starting`-Set TOCTOU guard), `spawnPreview` (`:108`, detached spawn + webview + `urlShown`/`settled` state machine + 60 s startup timeout), `showPreview` (`:219`, `asExternalUri` then `buildPreviewHtml`), `disposeSession` (`:231`, delete-before-kill re-entry guard), `killProcessGroup` (`:263`, group-kill + liveness-probed SIGKILL escalation). `registerPreviewFeature` (`:343`), `disposeAllPreviews` (`:374`).
- `src/extension.ts:23` — `registerPreviewFeature(context)`; `:64` — `deactivate()` reaps all previews.
- `package.json` — `quarto.preview` command (`contributes.commands`, after `quarto.render`).
- `test/integration/suite/preview.test.ts` — `previewProcessCount()` (`:31`, the faithful `preview.*sample.qmd` probe), lifecycle + TOCTOU tests; `afterEach` SIGKILLs stragglers.

**Gotchas for the next session (Phase 5):**
1. **Phase 5 has NO long-lived process** (it delegates run-cell to other extensions) — so the Phase-4 lifecycle dragon does NOT recur. The hard part shifts to **feature-detecting delegate command IDs** and **cell-boundary detection** (keep it a pure `core/` fn and TDD it).
2. **STRICT TDD is mandatory** (operator directive). Lead with the failing test. Session 5 was corrected for starting impl-first — don't repeat it.
3. **Faithful verification (Learnings #9 + #11):** when a test depends on the host's installed extensions/kernels (Jupyter for run-cell), it can pass/fail for host-env reasons. Keep automated tests env-independent (registration, cell-finder units, the no-delegate graceful message); verify real delegated execution via F5. And if you ever probe for processes, match the real worker, not a wrapper.
4. **F5-only residue from Phase 4 (NOT skipped 3E — automation-impossible):** the webview's **visual render**, **livereload-in-iframe on save**, and **notification wording** are not headlessly verifiable (no `code` CLI). The *behavior* (spawn, registration, no-orphan lifecycle, TOCTOU) is integration-proven; only pixels/UX text are unverified. Reload-on-save relies on **Quarto's native livereload inside the iframe** (the reference pattern) — if F5 shows it doesn't fire, the documented fallback is a stderr-`Output created:`-driven `postMessage` reload.
5. **`npm audit`** still 7 dev-only vulns (unchanged; none ship in the `.vsix`). No git remote → `vsce package` still needs `--allow-missing-repository` (baked into `npm run package`).

**Self-assessment (Session 5): 9/10.**
- **+** Delivered exactly Phase 4's scope, no bundling (FM #18 held — stopped before Phase 5). Six recoverable commits, all ≤5 files, full verification at each layer boundary (vertical-slice gate c). Kept the §3.3 guardrail (two pure `core/` modules; the adapter is thin). **Verified the `Browse at` stream/format live before coding** (found it's stderr+ANSI, as Learning #8 predicted). **Caught a real process-orphan via the deno-worker trap** and made the no-orphan test *faithful* (matches the worker, not the wrapper) rather than green-but-hollow (gate d). Ran an **adversarial multi-agent review** that found a genuine TOCTOU race the happy-path integration test missed, fixed it + 4 more, and **regression-tested the race** (red→green). Adopted strict TDD on operator correction and enshrined it in the correct non-synced file. Two new Learnings (#11/#12) for Phases 5+.
- **−** **Started impl-first on the parser before its test** — a real TDD lapse the operator had to flag; I reset to genuine red-green, but it shouldn't have happened given the Development workstream already names "Test-last" as anti-pattern #3. The TOCTOU race shipped in commit 4 and was only caught by the post-hoc review — a stronger up-front concurrency analysis (or writing the double-invocation test first) would have caught it during implementation, not after. Genuine residual gap: the webview **visual + livereload-on-save** are F5-unverified (automation-impossible here) — stated honestly, not a skipped Phase 3E.

#### Session 4 Handoff Evaluation (by Session 5) — Phase 3A
**Score: 9.5/10.** An excellent, precise handoff — I was productive within minutes of orientation.
- **What helped:** The ACTIVE TASK block named the deliverable (Phase 4 only), the exact plan lines (§6 ~278–296, §8), and the **4 dragons** — all of which held. The reuse pointers were accurate and load-bearing: `src/features/render.ts` was *exactly* the right template (spawn + stream + fail-soft + `registerRenderFeature` wiring shape), and `resolveBinary()`/`QuartoNotFound` anchors were correct. The strongest single item: **"VERIFY the exact `Browse at` line live before coding" (Learning #8)** — I did, and confirmed it's on **stderr**, ANSI-wrapped (the plan §2.3 wrongly said stdout), which is what made the parser correct. Gotcha #3 (`showInformationMessage` doesn't block in the headless host → fire-and-forget) and the "keep the parser a pure `core/` fn like `parseOutputPath`" guidance were both spot-on and followed.
- **What was missing / worth correcting:** The handoff's orphan-check command — `pgrep -fl "quarto preview"` — is **unfaithful**: it matches the bash *wrapper* but not the **deno worker** (`quarto.js preview`), so it reports "clean" while the worker orphans. Not Session 4's fault (it's how Learning #4 framed it), but it cost me a real orphan + a render-test timeout before I root-caused it. Now corrected as Learning #11 (probe `preview.*<fixture>`). Also: the handoff (reasonably) treated the `pgrep` orphan check as F5-only; it turns out to be **automatable and faithful** if you match the worker — which is now the strongest integration test.
- **What was wrong:** Nothing material. Every file anchor, version, and reuse target held. The one inaccuracy (the `pgrep` pattern) was inherited from a Learning, not invented.
- **ROI:** Strongly positive — the handoff + plan let me spend the session on engineering, live verification, and the adversarial review, not archaeology.

### What Session 4 Did — 2026-06-27
**Deliverable:** Implement **Phase 3** of the architecture plan — `Quarto: Render`. **COMPLETE + verified.**

**What was done (3 commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `996d157` feat: Phase 3 **core** — `src/core/render-args.ts` (pure, `vscode`-free): `buildRenderArgs(file, opts)→argv` + `parseOutputPath(output)→path` (ANSI-tolerant, returns last match) + `test/unit/render-args.test.ts` (9 cases).
2. `9b3461c` feat: Phase 3 **feature** — `src/features/render.ts` (`registerRenderFeature(context)` + spawn/stream adapter) + wired in `src/extension.ts` + `quarto.render` command in `package.json`.
3. `92de193` test: Phase 3 **integration** — `test/integration/suite/render.test.ts` (3 cases) + `test/fixtures/render-error.qmd` (deterministic failure) + `test/fixtures/needs-jupyter.qmd` (documented missing-Jupyter case).
(+ this close-out commit: SESSION_NOTES, CLAUDE.md Learnings #8/#9, BACKLOG/CHANGELOG/ROADMAP, dashboard.)

**Verification (all green):**
- `npm run compile` → tsc clean + esbuild (bundle 4.8 KB → 8.5 KB).
- `npm test` → **38/38** vitest (9 new render-args cases).
- `npm run test:integration` → **7/7** in real downloaded VS Code (v1.126.0): registers `quarto.render`; **success path actually renders `sample.qmd`→`sample.html`** (asserted via `existsSync`, ~4 s); **failure path** runs `render-error.qmd` (exit 1) and confirms no host crash (<1 s).
- `npm run package` → clean **9-file** `.vsix` (no test/fixture/`.claude` leak — verified via `vsce ls`).
- **Live CLI verification (observed, not assumed):** `quarto render sample.qmd` → exit 0, `Output created: sample.html` **on stderr**; `quarto render needs-jupyter.qmd` → exit 1, `ModuleNotFoundError: No module named 'nbformat'` verbatim on stderr.

**🔑 Two load-bearing findings (now CLAUDE.md Learnings #8, #9):**
- **#8 — `quarto render` writes progress + the `Output created:` success marker AND errors all to STDERR (stdout empty).** You CANNOT key success off stream routing — **use the exit code**. Output path is relative to the input dir; the line carries ANSI escapes (strip before parsing). Same shape will hit Phase 4's `Browse at` parsing.
- **#9 — faithful-verification trap (gate d / FM #24):** the test-electron host resolves a **different, Jupyter-capable Python** than this shell, so an executable-`{python}` fixture **renders SUCCESSFULLY in the host** — a missing-Jupyter "does-not-throw" test passes *trivially*. Caught it because the host left a rendered `needs-jupyter.html` (cell output present) and the test ran 7 s (success) not <1 s (failure). Fixed by using an **environment-independent** deterministic-failure fixture (`render-error.qmd`, invalid `format:`); the real missing-Jupyter case is verified live via the CLI instead.

**Key files (with anchors):**
- `src/core/render-args.ts` — `buildRenderArgs` (`:25`), `parseOutputPath` (`:52`, strips `ANSI_PATTERN` at `:38`, returns LAST `Output created:` match). Pure — no `vscode`. The template for Phase 4's `Browse at` parser.
- `src/features/render.ts` — `registerRenderFeature(context)` (`:24`, creates the "Quarto Render" channel + registers the command, both via `context.subscriptions`); `renderActiveDocument` (`:41`, requires active `quarto` doc, saves if dirty, fail-soft on `QuartoNotFound`); `runRender` (`:90`, `spawn` + stream both streams, key off exit code on `close`); `showSuccess` (`:144`, Open-button → `openExternal`).
- `src/extension.ts:21` — `registerRenderFeature(context)` call in `activate`.
- `package.json:53-57` — `quarto.render` command contribution (activation auto-inferred; `activationEvents: []` unchanged).
- `test/integration/suite/render.test.ts` — success (`existsSync(SAMPLE_HTML)`) + deterministic failure (`assert.doesNotReject`); `afterEach` cleans render artifacts.
- `test/fixtures/render-error.qmd` (deterministic fail, used by the test) · `test/fixtures/needs-jupyter.qmd` (real missing-Jupyter case, manual/CLI only — header explains why it's not host-test-reliable).

**Gotchas for the next session (Phase 4):**
1. **Learnings #8 + #9 apply directly to Phase 4.** Preview also emits `Browse at` to **stderr** (re-verify the exact line live before pinning a parser fixture); and if any preview test touches code-cell rendering, remember the host has Jupyter (env-dependent — use deterministic fixtures, verify env-dependent behavior via CLI).
2. **Process lifecycle is the Phase 4 dragon, not parsing.** `--timeout` does NOT self-exit reliably — track the child and kill on panel dispose / doc close / `deactivate()` (currently `src/extension.ts:62` is a no-op; that's where the kill goes). An integration test that spawns preview MUST kill it in `after`/`afterEach` or it orphans.
3. **`showInformationMessage(..., "Open")` does NOT block in the headless host** — it resolves `undefined`; `showSuccess` is fire-and-forget (`void`) so the render promise resolves on child `close`, independent of the notification. Rely on the same pattern for preview.
4. **F5 still owns the visual gap:** the Output-channel text and the success/error **notification wording** were NOT visually confirmed (no `code` CLI → no headless F5). The *behavior* is proven by integration tests; only the cosmetic UI text is unverified. For Phase 4 the webview render + the `pgrep` orphan check are genuinely F5-only — plan for a manual pass.
5. **`npm audit`** still 7 dev-only vulns (unchanged; none ship in the `.vsix`). No git remote yet → `vsce package` still needs `--allow-missing-repository` (baked into `npm run package`).

**Self-assessment (Session 4): 9/10.**
- **+** Delivered exactly Phase 3's scope, no bundling (FM #18 held — stopped before Phase 4). Three recoverable commits, all ≤5 files. **Kept the §3.3 guardrail** (pure `core/render-args.ts`, the feature is a thin adapter). Verified BOTH render paths **live via the CLI first** (observed, not assumed) before coding the parser — which is how I found that the success marker is on stderr (would have produced a silently-broken success/failure split otherwise). **Caught a faithful-verification trap myself** (FM #24/gate d): the missing-Jupyter integration test was passing trivially because the host renders it successfully — I noticed the leftover rendered artifact + the 7 s-vs-<1 s timing, root-caused it to PATH/Python divergence, and replaced it with a deterministic env-independent failure fixture rather than shipping a green-but-hollow test. Recorded both findings as Learnings #8/#9 for Phases 4–5.
- **−** First draft of the degradation test was the hollow one — I should have predicted the host/shell environment divergence up front (Learning #4 already flagged Jupyter as environment-specific), rather than discovering it from a leftover artifact. Cost one extra integration-test iteration. The genuine residual gap: the **Output-channel text + notification wording** are not visually confirmed (no headless F5) — stated honestly, behavior is integration-proven, only cosmetics are unverified (not a skipped Phase 3E).

#### Session 3 Handoff Evaluation (by Session 4) — Phase 3A
**Score: 9.5/10.** An excellent, precise handoff — I was building within minutes of orientation.
- **What helped:** The ACTIVE TASK block named the deliverable (Phase 3 only), the exact plan lines (§6 ~260–274, §8), and the §3.3 guardrail with the concrete suggestion `core/render-args.ts: (file,opts)→string[]` — I followed it almost verbatim. The pointers to `resolveBinary()` (`:60`) / `QuartoNotFound` (`:22`) were accurate and saved lookup. The two flagged tricks were both load-bearing and correct: **`#| eval: false` ⇒ render-clean fixture** (reused `sample.qmd` directly as the success fixture) and **"for the failure path you need an executable `{python}` cell (no eval:false)"** (which is exactly the fixture I built — and which surfaced the deeper host/shell trap). The "Jupyter/`nbformat` is ABSENT here" note (Gotcha #4 / Learning #4) was the seed that let me recognize the faithful-verification problem.
- **What was missing:** Two things the handoff couldn't have known, now Learnings #8/#9: (a) `quarto render` writes the success marker + errors to **stderr**, not stdout (so success/failure is exit-code-keyed); (b) the test-electron **host resolves a different, Jupyter-capable Python** than this shell, so the missing-Jupyter degradation can't be tested in the host. Both are mine to pass forward — done.
- **What was wrong:** Nothing. Every claim held — versions, file anchors, the reuse targets, the render-clean trick, the activation-inference note.
- **ROI:** Strongly positive — the handoff + plan let me spend the session on engineering and the faithful-verification fix, not archaeology.

### What Session 3 Did — 2026-06-27
**Deliverable:** Implement **Phase 2** of the architecture plan — `.qmd` syntax highlighting. **COMPLETE + verified.**

**Grammar-approach decision (this session resolves the operator's deferred "base grammar" question — by NOT forking):** rather than fork `wooorm/markdown-tm-language` or `microsoft/vscode-markdown-tm-grammar`, I authored an **original** `text.html.quarto` grammar that `include`s VS Code's built-in `text.html.markdown` **by scope-name reference** (no source copied) for prose/plain fences, and adds only Quarto-specific rules. Cleaner (nothing large to copy/attribute; markdown stays current), license-clean (the canonical `mjbvz` MIT injection pattern), reversible. Recorded in `/NOTICE`, `CONTEXT.md` (decision pointer), `CLAUDE.md` Learning #6.

**What was done (3 commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `d8bc4b8` feat: grammar + `language-configuration.json` + `NOTICE` + `package.json` wiring
2. `63ab34f` test: `test/fixtures/sample.qmd` + structural guard (`test/unit/grammar.test.ts`) + real-host registration test (`test/integration/suite/language.test.ts`) + `.gitignore` render-artifact guard
3. `46763a9` test: headless tokenization (`test/unit/tokenize.test.ts`) + `vscode-textmate`/`vscode-oniguruma` devDeps

**Verification (all green):**
- `npm run compile` → tsc clean + esbuild.
- `npm test` → **29/29** vitest (12 version + 10 structural grammar + 7 tokenization).
- `npm run test:integration` → **4/4** in real downloaded VS Code (v1.126.0): `.qmd` opens as `languageId 'quarto'` end-to-end. Exit 0.
- `npm run package` → clean **9-file** `.vsix` (adds `syntaxes/quarto.tmLanguage.json`, `language-configuration.json`, `NOTICE`; **no** test/fixture/`.claude` leak — verified via `vsce ls`).
- `quarto render test/fixtures/sample.qmd` → exit 0, `sample.html` created (cells use `#| eval: false` so no Jupyter needed). Render artifacts cleaned + gitignored.

**🔑 Headless grammar verification (stronger than the plan's manual-F5 budget):** `test/unit/tokenize.test.ts` loads the grammar into the SAME engines VS Code uses (`vscode-textmate`+`vscode-oniguruma`) and asserts the actual token scopes — front matter, all four `meta.embedded.block.*`, fence punctuation, AND the discriminating cases (a plain ` ```python ` block and post-cell prose are NOT in a cell). This proves the regexes work (back-referenced closing fence, `\A` anchor, `\b` boundaries), not just that the JSON is well-formed. See CLAUDE.md Learning #7.

**Key files (with anchors):**
- `syntaxes/quarto.tmLanguage.json` — the grammar. `patterns` order is load-bearing: `frontmatter` → `cell-python/r/julia/ojs` → `cell-generic` (catch-all) → `text.html.markdown` (include). Each cell rule: `begin` matches ` ```{lang} `, `end` is `^\s*(\2)\s*$` (back-references the opening fence), `contentName: meta.embedded.block.<lang>`.
- `language-configuration.json` — block comment `<!-- -->`, brackets, autoclose, folding markers.
- `package.json:18-32` — `contributes.languages` (`.qmd`/`.rmd`/`.Rmd` → `quarto`); `:33-50` — `contributes.grammars` incl. `embeddedLanguages` (the map that enables bracket/comment inside cells — NOT the grammar itself).
- `NOTICE` — MIT attribution (licensing hard gate).
- `test/unit/tokenize.test.ts` — headless scope verification (the high-value test). `test/unit/grammar.test.ts` — structural/manifest guard. `test/integration/suite/language.test.ts` — real-host registration.
- `test/fixtures/sample.qmd` — front matter + prose + 4 cells + a plain fence; `#| eval: false` makes it render-clean.

**Gotchas for the next session:**
1. **DON'T touch the grammar for Phase 3** — render is a CLI/command feature, orthogonal to highlighting.
2. **vscode-textmate test gotcha (cost most of my debug time):** in `tokenize.test.ts`, `loadGrammar` returns an empty **stub** `{scopeName, patterns: []}` for unresolved external includes — returning **`null` corrupts vscode-textmate's pattern compilation** (sibling rules silently stop matching). Real VS Code always has those grammars, so the extension is fine. If you write more grammar tests, stub, don't null.
3. **`source.r`/`source.julia` aren't bundled with VS Code** → `{r}`/`{julia}` cells get the embedded scope but only colorize if the user installs those extensions (python/js always colorize). Expected, not a bug.
4. **`#| eval: false` ⇒ render without a kernel.** Reuse for any render-clean fixture; for the Phase 3 *failure* path, you need an executable `{python}` cell (no `eval: false`).
5. **`npm audit`** still reports 7 dev-only vulns (now incl. vscode-textmate/oniguruma transitively — count unchanged); none ship in the `.vsix`. Not chased.
6. **No git remote yet** → `vsce package` still needs `--allow-missing-repository` (baked into `npm run package`); README still avoids relative links. When a remote is added: add `repository`, drop the flag.

**Self-assessment (Session 3): 9/10.**
- **+** Delivered exactly Phase 2's scope, no bundling (FM #18 held — stopped before Phase 3). Three recoverable commits, all ≤5 files. **Resolved the operator's deferred base-grammar decision** with a cleaner-than-asked approach (include-by-reference vs fork) and documented the rationale + attribution. Went beyond the plan's manual-F5 budget: built **headless tokenization verification** that actually proves the grammar works (per Learning #3's "prefer automated runtime verification"), including discriminating negative cases. Caught and root-caused a non-obvious vscode-textmate behavior (null-include corruption) rather than working around it blindly. Updated CLAUDE.md (Learnings #6/#7), CONTEXT.md (decision + 2 pitfalls), BACKLOG/CHANGELOG/ROADMAP.
- **−** Spent significant debug time on the null-include false alarm — my first `tokenize.test.ts` reported failures that looked like grammar bugs but were harness bugs; I should have suspected the harness sooner given the regexes passed in isolation. The one genuine gap: **theme COLOR** (scope→color mapping) is not verified headlessly — that's the operator's F5 check. The scopes ARE proven, so this is cosmetic and honestly stated (not a skipped Phase 3E). Minor: didn't add `quarto`/`onLanguage` activation events, but Phase 2 has zero runtime code so none are needed (correct, but worth noting for Phase 3).

#### Session 2 Handoff Evaluation (by Session 3) — Phase 3A
**Score: 9.5/10.** An excellent, accurate handoff — I started building within minutes of orientation.
- **What helped:** The ACTIVE TASK block was precise — named the deliverable (Phase 2 only), the exact plan lines (§6 ~242–256), and the 🐉 load-bearing trap (brace-wrapped `{python}` cells need a custom rule; wrap in `meta.embedded.*` to dodge the string/comment trap) — that callout pointed me straight at the core design. The "reuse Phase 1, don't re-scaffold" note and the working-scripts list saved real time. The suggestion to "consider an integration test asserting the `quarto` language registers" was spot-on and I implemented it. Verified facts (Quarto 1.7.33, no `code` CLI, Node/npm versions) all held.
- **What was missing:** Almost nothing. Two things the handoff couldn't have known but a heads-up would've saved time: (a) the `vscode-textmate` null-include corruption gotcha (now Learning #7); (b) that `#| eval: false` is the trick to render a cell fixture without Jupyter (now documented). Both are mine to pass forward, now done.
- **What was wrong:** Nothing. Every claim held. The "base grammar default `wooorm/markdown-tm-language`" was framed as a default to evaluate, which correctly left me room to choose include-by-reference instead.
- **ROI:** Strongly positive — the handoff + plan let me spend the session on engineering and verification, not archaeology.

### What Session 2 Did — 2026-06-27
**Deliverable:** Implement **Phase 1** of the architecture plan — the walking skeleton. **COMPLETE + verified.**

**§12 ratification (operator, this session):** v1 scope = Phases 1–5 + 6a–6c (confirmed as proposed) · Tier B in-process providers + `vscode`-free core (confirmed) · stack TS+esbuild+vsce+vitest+test-electron, `engines.vscode ^1.90.0` (confirmed) · base grammar **deferred to Phase 2**, default `wooorm/markdown-tm-language`.

**What was done (6 commits, each ≤5 files per SAFEGUARDS blast-radius):**
1. `3bf9e96` scaffold build config (package.json, tsconfig, esbuild.js, LICENSE, .vscodeignore)
2. `52b1144` package-lock.json (pinned dep tree)
3. `fc621d6` source: `core/version.ts` (pure) + `quarto/cli.ts` (adapter) + `extension.ts` (thin) + README
4. `2aa3ce5` unit harness (vitest, 12 tests) + F5 launch/tasks config
5. `913ad7d` integration harness (@vscode/test-electron, 2 tests)
6. `eb8df12` packaging fixes (.vscodeignore excludes `.claude`/`.git`; `--allow-missing-repository`; README relative-link removed)

**Verification (all green):**
- `npm run compile` → tsc `--noEmit` clean + esbuild → `dist/extension.js` (4.8 KB).
- `npm test` → **12/12** vitest unit tests (pure-core, headless).
- `npm run test:integration` → **2/2** in a real downloaded VS Code (v1.126.0): activates the extension AND executes `quarto.verifyInstallation` end-to-end against the real CLI. Exit 0.
- `npm run package` → clean **6-file** `.vsix` (LICENSE, package.json, readme, dist/extension.js only).

**🔑 RESOLVED the plan's #1 load-bearing assumption (§14, FM #19/§9):** `@vscode/test-electron` **CAN** download + run VS Code headlessly here (no `code` CLI). Automated runtime verification is available for all future phases — see CLAUDE.md Learning #3 (updated). This is *stronger* than the manual-F5 fallback the plan budgeted for.

**Key files (with anchors):**
- `src/core/version.ts` — pure semver parsing; `parseQuartoVersion`/`toSemVer`/`meetsMinimum`. **No `vscode` import** (the §3.3 guardrail; keep it that way).
- `src/quarto/cli.ts:60` — `resolveBinary()` (`QuartoNotFound` at `:22`); reads `quarto.path`→PATH, runs `<bin> --version`. The one external integration point (plan §8); every later phase reuses it.
- `src/extension.ts:13` — thin `activate()`; `:26` the `verifyInstallation` handler (info/warn/actionable-error paths).
- `esbuild.js` — bundles src → dist, `vscode` external. `tsconfig.test.json` — compiles `test/integration/**` → `out/` (separate from esbuild; test-electron runs the JS).
- `test/integration/suite/extension.test.ts` — the runtime-verification tests. `test/unit/version.test.ts` — the 12 unit tests.
- `package.json:36-45` — the scripts (`compile`/`test`/`test:integration`/`package`).

**Gotchas for the next session:**
1. **Two compilers by design** — esbuild bundles the extension; `tsc -p tsconfig.test.json` compiles integration tests to `out/`. Don't try to make esbuild do the tests or vice-versa. vitest is scoped to `test/unit/**` (won't run the mocha integration tests).
2. **`.vscodeignore` must keep excluding `.claude/**` and `.git/**`** — they leaked into the first `.vsix` until fixed. Re-check the `vsce package` file list whenever you add top-level files.
3. **No git remote yet** → `vsce package` needs `--allow-missing-repository` (baked into `npm run package`) and README must avoid relative links (`./LICENSE` was rejected). When a remote is added: add `repository` to package.json, drop the flag, restore the link.
4. **Integration tests download ~261 MB** the first time (into `.vscode-test/`, gitignored) and take ~30–40 s on first run; fast thereafter (cached).
5. **`npm audit`** reports 7 vulns (4 moderate/2 high/1 critical) — all in **dev-only transitive deps** (test/build tooling); none ship in the `.vsix` (node_modules is excluded). Not chased in Phase 1; revisit if a fix lands without breaking changes.
6. Phase 2 dragon (carried from the plan): brace-wrapped `{python}` cells need a **custom grammar injection** — the stock markdown rule won't match them. See the ACTIVE TASK block above.

**Self-assessment (Session 2): 9/10.**
- **+** Delivered exactly Phase 1's scope, no bundling (FM #18 held — stopped before Phase 2). Six recoverable commits, all ≤5 files. **Resolved the project's biggest open risk** (headless integration testing) rather than just documenting it as unknown. Went one step beyond build-clean: the integration test *executes* the command against the real CLI, so this is genuine runtime verification (not FM #24). Caught two real packaging defects (`.claude` leak, README link) at the release gate and fixed them. Updated CLAUDE.md learnings (#3 resolved, #5 added), BACKLOG/CHANGELOG/ROADMAP.
- **−** First `vsce package` failed (README relative link) — a known vsce behavior I should have pre-empted given there's no remote; cost one extra iteration. The `.claude/` leak likewise should have been in `.vscodeignore` from the first draft. Both caught + fixed in-session, but reflect not anticipating vsce's stricter packaging rules up front. Could not visually confirm the notification *text* via F5 (no `code` CLI / headless) — but the integration test covers the behavioral path, so this is a cosmetic gap, stated honestly, not a skipped Phase 3E.

#### Session 1 Handoff Evaluation (by Session 2) — Phase 3A
**Score: 9.5/10.** Among the best handoffs I could ask for.
- **What helped:** The ACTIVE TASK block was exact — named the deliverable (Phase 1 only), the §12 ratification gate, the precise plan sections to read (§3.3/§6/§10/§13) with line anchors, and the verification commands. The "load-bearing check" callout (confirm test-electron downloads VS Code, or document the gap) pointed me straight at the session's highest-value experiment. The verified-facts list (`quarto 1.7.33`, `Browse at` line, no `code` CLI) was accurate and saved re-derivation. FM #18/#19 reminders were correctly emphasized and kept me disciplined.
- **What was missing:** Two minor things the plan couldn't have known but a heads-up would've saved an iteration each: (a) `vsce` rejects README relative links / missing `repository` when there's no remote; (b) `.vscodeignore` needs `.claude/`. Both are now Learning #5.
- **What was wrong:** Nothing. Every claim (versions, file layout, the test-electron hypothesis, the boundary design) held up — and the test-electron question resolved *positively*, better than the plan's hedge.
- **ROI:** Strongly positive. The handoff + plan let me start building within minutes of orientation; I spent the session on engineering, not archaeology.

### What Session 1 Did — 2026-06-27
**Deliverable:** Planning session (Architecture workstream) — feature inventory + phased architecture/implementation plan for the Quarto VS Code extension. **COMPLETE.**

**What was done:**
- Phase 0 Orient (full): read SAFEGUARDS, SESSION_NOTES, BACKLOG, ARCHITECTURE_WORKSTREAM; ran dashboard; ghost-session check clean; reported; waited for direction.
- **Evidence-based research** (the greenfield equivalent of the grep-inventory): verified the Quarto CLI surface locally, and ran two parallel research agents against the live `quarto-dev/quarto` repo / Marketplace / official docs.
- **Resolved the load-bearing decision** (TextMate vs LSP) → ship Tier A grammar, build to Tier B in-process providers, defer Tier C out-of-process LSP; with the `vscode`-free-core guardrail making B→C cheap and the core headlessly testable.
- Wrote the plan: `docs/planning/2026-06-27-extension-architecture-plan.md` (447 lines) — 7 phases as vertical slices, each with DONE gate + verification commands + one-session boundary + 🐉 dragon flags; v1 scope + explicit descope; licensing-compliance findings; interface contracts; failure-mode analysis; honest alternatives; §12 ratification list.
- Updated `CONTEXT.md` (decision pointer resolved + 2 new pitfalls) and `CLAUDE.md` (Project-specific Learnings). 
- **Deliverable was OUTPUT, not input** — no plan was provided to me; I produced it.

**Commit:** (see git log — committed at close-out, message `docs: architecture & phased implementation plan (Session 1)`).

**Key files (with line anchors):**
- `docs/planning/2026-06-27-extension-architecture-plan.md` — the deliverable. §3 (lines ~77–137) = the load-bearing decision + the `core/`-vs-adapter guardrail; §6 (~210–337) = the 7 phases; §12 (~411–419) = decisions to ratify; §14 (~437–447) = load-bearing assumptions to verify.
- `CONTEXT.md:40-45` — Architecture Decision Pointer (now resolved → points to the plan).
- `CLAUDE.md` → "Project-specific Learnings" — 4 learnings recorded this session.

**Verified facts (live, this session — trust these):**
- `quarto 1.7.33`; `quarto preview <f>` prints `Browse at http://localhost:<port>/` (the line the preview webview must parse).
- `quarto preview --timeout N` does NOT reliably self-exit (only on no active clients) → the extension must own preview process lifecycle (Phase 4 dragon).
- Code-cell render needs **Jupyter** (`nbformat`) in the active Python env — absent here (degradation case).
- **No `code` CLI on PATH** → manual F5 for runtime checks; `@vscode/test-electron` downloads its own VS Code (verify in Phase 1).

**Gotchas for the next session:**
1. The plan is a **DRAFT** — get operator ratification of §12 before coding (FM #19/#23: a plan in the prompt is not a go-ahead).
2. Implement **Phase 1 ONLY**, then close out (FM #18). The phase numbering is not license to bundle.
3. Quarto cells use brace-wrapped `{python}` identifiers — the stock markdown fenced rule won't match them (Phase 2 dragon, not Phase 1).
4. Licensing is a hard gate: never copy from Posit's AGPL `apps/vscode`/`apps/lsp`. Build on MIT `vscode-markdown-tm-grammar` / `markdown-tm-language` / `vscode-markdown-languageservice`.

**Self-assessment (Session 1): 8.5/10.**
- **+** Resolved the load-bearing decision with two independent evidence passes (both cross-confirmed AGPL + architecture). Did not assume — verified the CLI live and the repo facts via GitHub API. Vertical-slice phasing with per-phase DONE/verification/boundary. Honest descope + alternatives. Flagged dragons and load-bearing assumptions per Learning #3.
- **−** Two typos required in-session correction (stray chars in plan §6; filename in handoff) — caught and fixed, but reflects draft-speed writing. Could not runtime-verify anything (correct for a planning session — no runtime artifact exists; not FM #24). The §12 decisions are proposed, not operator-confirmed, so the plan ships as a draft (by design).

#### Session 0 Handoff Evaluation (by Session 1) — Phase 3A
**Score: 9/10.** Session 0's handoff prepared me well.
- **What helped:** The ACTIVE TASK block was specific and correct — it named the deliverable (plan, not code), the workstream, the load-bearing decision to resolve, the suggested filename/location, and the vertical-slice + FM #18 constraints. The "Useful starting context" (Quarto 1.7.33, Node/npm versions, pointers to CONTEXT/BACKLOG) saved discovery time. The **gotcha was prescient**: "CLAUDE.md is only read at session start, so this setup session never ran Phase 0 — the next session must begin with Phase 0 Orient" — exactly what I did.
- **What was missing:** Nothing material. It could have noted that there is **no git remote** (so `gh issue list` fails and BACKLOG is the source of truth) — minor; I discovered it in one command.
- **What was wrong:** Nothing. Every claim (versions, file layout, adoption mode) checked out.
- **ROI:** Strongly positive — reading it cost ~1 min and saved re-deriving the task framing and constraints.

### Session 0 (Setup / Bootstrap) — 2026-06-27
**Deliverable:** Bootstrap the Iterative Session Methodology (KJ5HST/methodology v3.0) into the project. COMPLETE.
**What was done:**
- `git init` (branch `main`); repo created from an empty directory.
- Ran the methodology's own `bin/sync` (committed mode, local source) — installed `SESSION_RUNNER.md`, `SAFEGUARDS.md`, `RECOMMENDED_SKILLS.md`, `CONTEXT_TEMPLATE.md`, `CLAUDE_TEMPLATE.md`, `BOOTSTRAP.md`, `methodology_dashboard.py`, seeded `SESSION_NOTES.md`/`CHANGELOG.md`/`ROADMAP.md`, and the framework under `docs/methodology/` (+ `workstreams/`).
- Instantiated `CLAUDE.md` (SESSION PROTOCOL + project purpose/stack/build) and `CONTEXT.md` (Quarto domain vocabulary + MIT-license constraint) from the templates.
- Created `BACKLOG.md` (first task = planning session) and `.gitignore` (ignores `dashboard.html`, `node_modules/`, `dist/`, `*.vsix`).
- Ran `methodology_dashboard.py` → `dashboard.html` (health 30/100, expected at 0 commits).
**Adoption mode:** Committed (single-project). To update later: clone `KJ5HST/methodology` as a sibling and run `bin/sync`, or tell the agent "Update methodology using https://github.com/KJ5HST/methodology".
**Gotcha:** The methodology requires starting a FRESH session before the first real task — `CLAUDE.md` (with the SESSION PROTOCOL) is only read at session start, so this setup session never ran Phase 0 against it. The next session must begin with Phase 0 Orient.
**Self-assessment:** Setup-only session (no predecessor to evaluate — this is Session 0). Bootstrap executed faithfully via the upstream tool rather than hand-copying, so synced files are byte-identical to canonical (no drift; future syncs are clean). No runtime behavior to smoke-test.
**Next:** See ACTIVE TASK above — the planning session.
