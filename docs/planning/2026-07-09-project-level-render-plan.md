# Project-Level Render ("Render Project" command): Implementation Plan

**Status:** PLAN (draft for an executor session). Produced by Session 44 (2026-07-09).
**Governs:** `BACKLOG.md` "Up Next" item #1 (ranked via the Session 43 `/grill-me` decision — see `SESSION_NOTES.md` "What Session 43 Did"): *"A 'Render Project' command: discover the project root (`_quarto.yml`, walking up from the active file/workspace root — no discovery code exists today), then run `quarto render` from that root with no file argument."*
**Scope lock (operator/BACKLOG-confirmed):** **v1 = render only.** "Preview Project" (a live-reload server for a whole book/site) is an explicit, deliberate follow-up — NOT this plan. Ranked #1 ahead of YAML diagnostics (item #2) specifically because #2's `_quarto.yml`-discovery dependency is built here first.
**Out of scope:** Preview-project (different, harder lifecycle — see §2.3); YAML diagnostics on `_quarto.yml` itself (item #2, depends on this plan's discovery code but is its own future slice); any change to the existing single-file `quarto.render`/`quarto.preview` commands (this is a pure *addition*).

---

## 0. How this plan was produced (evidence provenance)

Grounded via a 6-agent research + adversarial-verification `Workflow` (Session 44, ~307K subagent tokens, 124 tool calls): 4 parallel research agents (repo grep-inventory; official Quarto docs + `quarto-cli` source; a **live empirical test of the installed Quarto 1.7.33 CLI** in scaffolded temp projects; VS Code workspace-API conventions) followed by 2 adversarial verifiers who independently re-ran the two most load-bearing claims from scratch. Every file:line citation below was additionally re-confirmed firsthand by this session's own direct reads of `src/features/render.ts`, `src/core/render-args.ts`, `src/quarto/cli.ts`, `package.json`, `src/extension.ts`, and `test/integration/suite/render.test.ts` (Learning #6 — read implementations, don't estimate from descriptions).

**The single most important finding, and the reason this plan exists rather than being a two-line change:**

- **REFUTED (empirically, twice, independently): "just run `quarto render` with no arguments from the discovered project root's directory."** A live test against the installed CLI (scaffolded project: `_quarto.yml` + `index.qmd` + `sub/chapter.qmd`, the latter unlisted) found that `quarto render` with **no arguments**, run from a project **subdirectory** that has no `_quarto.yml` of its own, does **not** fail and does **not** render the whole project — it detects the ancestor project (inherits its config/theme, writes its `.quarto/` cache to the ancestor root) but renders **only the file(s) physically present in the current working directory**. This is a silent, hybrid, easy-to-miss partial-render — exactly the failure mode a user editing a nested chapter file would trigger if the command merely `cd`'d into the discovered root's *general vicinity* rather than passing it explicitly. **CONFIRMED (twice, independent re-runs, matching stdout/exit codes/even CSS content hashes):** `quarto render <absolute-project-root-path>`, run from **any** cwd, reliably triggers a full project render regardless of where the process's cwd actually is. **Design consequence (locked in, §5.2): the new command MUST invoke `quarto render <root>` with the discovered root passed as an explicit positional argument — never bare `quarto render` relying on `cwd` alone.**
- **CONFIRMED (adversarially re-verified with a much wider grep net — case-insensitive terms, `cwd`/`root`/`walkup`/`discover` variants, `fs.existsSync`/`statSync` calls, loop constructs by hand): zero project-root-discovery code exists anywhere in `src/` today.** This is a from-scratch build, not an extension of dormant existing code — confirming BACKLOG.md's own claim (CHANGELOG: project-level render, Session 45`).
- **Grounded via `quarto-cli`'s own source** (`src/project/project-shared.ts`, `src/project/project-context.ts` on GitHub — the docs themselves are silent on this): the project file is `_quarto.yml` (documented) **or** `_quarto.yaml` (undocumented in prose, but real — `.yml` wins on a tie via `Array.find`); Quarto's own project-root search is an **ancestor walk** (`dirname()` repeatedly until the filesystem root), which is the same shape this plan's `findProjectRoot` needs to build for the *editor* side (Quarto CLI walking internally does not help the extension, which must know the root *before* invoking the CLI, per the bullet above).
- **Nested projects are fully isolated, not merged** (empirically confirmed): the *nearest* ancestor `_quarto.yml` wins and the outer project's config is not inherited. A plain nearest-match walk-up naturally reproduces this — no special-casing needed.

---

## 1. Executive summary (TL;DR)

Add one new command, **`quarto.renderProject`** ("Render Project"), that: (a) resolves a starting point + a search boundary from VS Code's editor/workspace-folder state (§5.1); (b) walks up from that starting point looking for `_quarto.yml`/`_quarto.yaml`, bounded by the owning workspace folder when one exists (a new pure `core/project.ts`, §5.1); (c) if found, spawns `quarto render <root>` with `cwd` **pinned to `<root>`** (§5.2 — a specific, easy-to-miss correctness trap, not a stylistic choice: Quarto reports `Output created: <path>` **relative to the target project directory, not the spawning process's actual cwd**, confirmed empirically in the same test above — see §7 Dragon D1); (d) reuses the existing render command's spawn/report shape (`spawn` + Output channel + `parseOutputPath`/success-dialog) with the target-specific wording swapped in.

**This is one small, well-bounded new capability — not a multi-slice epic like 6d/6e.** Recommended as a **single vertical-slice implementing session** (SESSION_RUNNER.md §Vertical Slice Sessions), pre-declaring the four-layer contract now (Gate a) so the executor can checkpoint-commit through it in one session:

| Layer | What it adds | New/changed files |
|---|---|---|
| L1 — pure core | `findProjectRoot(startDir, boundaryDir, exists)` — the discovery algorithm | `src/core/project.ts` (new) + `test/unit/project.test.ts` (new) |
| L2 — adapter + command | Folder/editor resolution chain, `buildRenderProjectArgs`, `runRenderProject` (spawn/report), command registration, `package.json` entry, `extension.ts` wiring | `src/features/render-project.ts` (new), `src/core/render-args.ts` (+1 function), `package.json` (+1 command), `src/extension.ts` (+1 wire) |
| L3 — test fixture | A real multi-file project fixture (none exists today) | `test/fixtures/project/_quarto.yml`, `.../index.qmd`, `.../chapters/chapter1.qmd` (new) |
| L4 — integration tests | End-to-end command verification against the real fixture | `test/integration/suite/render-project.test.ts` (new) |

Each layer is a checkpoint commit (≤5 files each, well under the per-commit cap); the full build/test matrix (`npm run compile`, `npm test`, `npm run test:integration`, `npm run package`) runs at every boundary (Gate c). **The operator/executor may instead split this into two sessions** (L1 alone, then L2–L4) if the established finer-grained-session norm is preferred — see §9 Q1.

---

## 2. The mechanism, resolved

### 2.1 What "project" means here (grounded facts, §0)

- Marker file: `_quarto.yml` **or** `_quarto.yaml` (check both; prefer `.yml` on a tie, matching `quarto-cli`'s own `["_quarto.yml", "_quarto.yaml"].find(existsSync)` order — a faithful, if minor, detail).
- `project: type:` core values are `default`/`website`/`book`/`manuscript` (others, e.g. `blog`/`confluence`, are extensions layered on `website` — irrelevant to v1, which only needs to *detect* a project, not interpret its type).
- A `default`-type project (the empirically-scaffolded case) renders **in place** next to sources (no `_site/`); `website`/`book` types render to `_site`/`_book`. **v1 does not need to know or care** — it always invokes `quarto render <root>` and lets Quarto's own project config decide the output location; the existing `parseOutputPath` (reused unchanged, §4.1 R2) just reports whatever `Output created: <path>` line Quarto prints, resolved against `<root>` (§7 D1).

### 2.2 The discovery algorithm (new pure core, mirrors Quarto's own ancestor walk — §0)

```
findProjectRoot(startDir, boundaryDir, exists):
  current = normalize(startDir)
  loop (bounded — see stop conditions):
    if exists(join(current, "_quarto.yml")) or exists(join(current, "_quarto.yaml")):
      return current
    if boundaryDir !== null and current === normalize(boundaryDir):
      return null                         # checked the boundary itself; do not search above it
    parent = dirname(current)
    if parent === current:
      return null                         # reached the filesystem root
    current = parent
```

`exists` is an injected `(path: string) => boolean` (dependency-injected IO, mirroring this project's established pure-core/impure-adapter split — e.g. `features/yaml-schema-source.ts` isolating `node:fs` reads from the pure `core/yaml-schema.ts` parser, per `CLAUDE.md`'s §3.3 guardrail). This keeps `core/project.ts` fully unit-testable with a fake in-memory `exists` (a `Set<string>` membership check) — no real filesystem needed for the unit suite. The real adapter (`src/features/render-project.ts`) passes `node:fs`'s `existsSync` at the call site.

**Why bounded at the owning workspace folder, not always to the filesystem root:** VS Code's own multi-root-workspace guidance (`https://github.com/microsoft/vscode/wiki/Adopting-Multi-Root-Workspace-APIs`, fetched this session) frames extensions as needing to "work with any number of `WorkspaceFolder`s," and the closest real-world analog — the VS Code ESLint extension's documented `eslint.workingDirectories` `"auto"` mode — walks up for a *marker file* but anchors its search root at the workspace folder boundary. An unbounded walk risks silently escaping the user's opened workspace scope in a multi-root window (finding an unrelated `_quarto.yml` outside any folder the user actually opened). The unbounded (`boundaryDir = null`) form is kept **only** for the genuine no-workspace-folder case (§2.3 Tier A, a single loose file with nothing else open) — there is no workspace boundary to respect there, so an unbounded walk is the only option and matches how the bare Quarto CLI itself would behave with no VS Code workspace concept at all.

### 2.3 Resolving the starting point + boundary from VS Code state (new adapter logic)

Two tiers, in order (grounded in this codebase's own 100%-consistent existing convention — *every* other per-document command, `render.ts:44`/`preview.ts:363`/`math-preview.ts:153`/`diagram-preview.ts:154`/`execution.ts:67`, gates on `vscode.window.activeTextEditor` first — and in VS Code's documented `workspaceFolders`/`getWorkspaceFolder`/`showWorkspaceFolderPick` API, none of which this codebase has ever used before — this is the **first** code in the repo to touch it):

- **Tier A — a real, on-disk active editor exists** (`activeTextEditor` non-null, `document.uri.scheme === "file"`): `start = path.dirname(uri.fsPath)`; `boundary = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath ?? null` (bounded if the file belongs to an open folder, unbounded otherwise — e.g. a loose file with no folder open at all).
- **Tier B — no usable active editor** (none open, or the active one is `untitled:`/a webview/non-file scheme): branch on `vscode.workspace.workspaceFolders`:
  - `undefined` or empty → error, no project context available at all.
  - exactly one folder → `start = boundary = folder.uri.fsPath` (checks only that one folder — per §2.2's rationale, does **not** search above it).
  - more than one folder → `await vscode.window.showWorkspaceFolderPick()`; `undefined` (user cancelled) → silently return, no error (standard VS Code cancellation convention); otherwise same as the one-folder case with the picked folder.

If `findProjectRoot` returns `null` in any branch: `vscode.window.showErrorMessage` with a message naming what was searched (the active file's path, or the folder) — mirroring the existing "open a Quarto document to render" error idiom (`render.ts:46-48`), never a crash.

### 2.4 Why NOT generalize `preview.ts`'s session model too (confirmed, not just assumed)

Read `src/features/preview.ts` in full this session (376 lines). Its `Map<string, PreviewSession>` is keyed by a single file's `fsPath` (`:49`), the webview panel title is `` `Quarto Preview: ${path.basename(fsPath)}` `` (`:118`), and the close-triggers-kill wiring (`onDidDispose:128`, `onDocumentClosed:243-245`) is fundamentally file-scoped. Generalizing this to a project (one server, many output pages, "closing one of several open project files" must NOT kill the shared server) is a **distinct, larger redesign** — re-keying by project root, deciding what a single webview should show first, and reworking the close-triggers-kill assumption — genuinely separate work, not bundled here. This directly corroborates (rather than merely repeats) BACKLOG.md's existing "v1 = render only" scoping decision.

---

## 3. Scope

- **In scope:** one new command, its pure discovery core, its adapter (folder resolution + spawn/report), a `package.json` entry, a new test fixture, unit + integration tests.
- **Out of scope (do not bundle — FM #18):** "Preview Project" (§2.4); YAML diagnostics on `_quarto.yml` (CHANGELOG: YAML schema diagnostics, Session 47, depends on this plan's discovery code existing first but is its own future slice); any change to `quarto.render`/`quarto.preview`'s existing single-file behavior; a `--to`/format-override option for project render (v1 mirrors the CLI's own no-flags "Render Project" example exactly; adding `--to` is a trivial future extension via `RenderOptions`-style params, not needed for v1); consolidating the render.ts/render-project.ts spawn-and-report duplication (§8, deliberately deferred).

---

## 4. Evidence-based inventory (grep-verified firsthand + adversarially re-checked)

### 4.1 Reuse table

| # | Component | Location | How this plan uses it |
|---|---|---|---|
| R1 | Binary resolution | `src/quarto/cli.ts` `resolveBinary()` (`:61-77`), `configuredBinary()` (`:47-53`) | Reused **unchanged** — binary resolution is orthogonal to cwd/target-argument logic. Same `QuartoNotFound`-catch-and-suggest-settings UX as `render.ts:62-77`. |
| R2 | Output-path parsing | `src/core/render-args.ts` `parseOutputPath` (`:52-61`) | Reused **unchanged** — confirmed empirically that a project render still prints exactly one `Output created: <path>` line (the primary entry point, e.g. `index.html`), the same shape `parseOutputPath`'s "last match" contract already expects. **Must resolve it against `cwd = root`, not the extension host's own cwd — see Dragon D1 (§7).** |
| R3 | Spawn/report shape | `src/features/render.ts` `runRender` (`:90-141`) | **Template, not reused directly** (see §8 alternative #3) — `runRenderProject` mirrors its shape (Output channel, `spawn`, stdout+stderr concatenation, exit-code branch, `showSuccess`/error dialog) with target-specific wording (§5.2). |
| R4 | Command registration idiom | `src/features/render.ts:24-34` (`registerRenderFeature`) | Template for `registerRenderProjectFeature` — same Output-channel + `context.subscriptions` + `vscode.commands.registerCommand` shape. |
| R5 | Active-editor-first convention | `render.ts:44-50`, `preview.ts:363-369`, `math-preview.ts:153`, `diagram-preview.ts:154`, `execution.ts:67` | The established "gate on `activeTextEditor`, clear error on absence/mismatch" idiom this plan's Tier A (§2.3) extends — this is the **first** command to also need Tier B (workspace-folder) resolution, since Tiers A-only (like every existing command) can't handle "no file open, but a project folder is." |
| R6 | Integration test scaffolding | `test/integration/suite/render.test.ts` (77 lines, read in full) — `EXTENSION_ID` activation (`:6,28-32`), `openActive()` helper (`:17-25`), `vscode.commands.executeCommand("quarto.render")` invocation, filesystem-side-effect assertions (`existsSync`), gitignored-artifact cleanup in `afterEach` | Template for `render-project.test.ts` — same activation/invocation/assertion shape, no channel-text parsing (this project's established test style). |

### 4.2 Gaps table (does not exist; must be built)

| # | Gap | Evidence | Built in layer |
|---|---|---|---|
| G1 | **Project-root discovery.** Zero hits anywhere in `src/` for `_quarto.yml`/`_quarto.yaml`/`findProjectRoot`/`projectRoot`/`workspace.workspaceFolders`/`getWorkspaceFolder`/`asRelativePath`/`workspaceFolder` — independently re-confirmed with a much wider term net (case-insensitive variants, `cwd`, `discover*`, `fs.existsSync`/`statSync`, hand-checked loop constructs). | Whole-`src/` grep, this session + adversarial re-verification | L1 |
| G2 | **A file-less/directory-target render invocation.** `buildRenderArgs(file: string, ...)` (`src/core/render-args.ts:25-35`) always takes a `file: string` and always includes it positionally — it structurally cannot represent "render this directory as a project" without a signature change (rejected, §8) or a sibling function. | `render-args.ts:25-35` (read in full) | L2 |
| G3 | **Workspace-folder-aware command dispatch.** No command in this repo has ever branched on folder count / used `showWorkspaceFolderPick` / bounded a search at a `WorkspaceFolder` boundary. | Whole-`src/` grep for `workspaceFolders`/`getWorkspaceFolder`/`showWorkspaceFolderPick` — zero hits (re-verified) | L2 |
| G4 | **A multi-file project test fixture.** `test/fixtures/` is 12 flat, standalone `.qmd` files (`sample.qmd`, `showcase.qmd`, …) plus render-artifact directories; **no `_quarto.yml` exists anywhere under `test/fixtures/`**, confirmed by the same repo-wide grep. | `test/fixtures/` listing, this session | L3 |

---

## 5. Interface contracts (interface-first; `core/` stays `vscode`-free per §3.3)

### 5.1 `src/core/project.ts` (new, pure)

```ts
/**
 * Walk up from `startDir` looking for a Quarto project marker (`_quarto.yml`
 * or `_quarto.yaml`, `.yml` preferred on a tie — matches quarto-cli's own
 * `project-shared.ts` resolution order). Stops at (and checks) `boundaryDir`
 * inclusive; pass `null` to walk unbounded to the filesystem root (only
 * correct when there is no owning workspace folder to respect).
 *
 * `exists` is injected so this stays a pure, headlessly-unit-testable
 * function — the real filesystem check lives in the adapter (features/).
 */
export function findProjectRoot(
  startDir: string,
  boundaryDir: string | null,
  exists: (path: string) => boolean,
): string | null;
```

Algorithm: §2.2. Never throws. Terminates: each iteration strictly decreases path depth (`dirname` monotonically shortens until it repeats at the filesystem root, the existing stop condition) — bounded by path length, no cycle possible.

### 5.2 `src/core/render-args.ts` (+1 function, existing file)

```ts
/** Build the argv for `quarto render <projectRoot>` — a whole-project render.
 *  The root is passed as an explicit positional argument (NEVER bare
 *  `quarto render` relying on cwd alone — see the plan's §0/§7 D1: a bare
 *  invocation from a project SUBdirectory silently renders only that
 *  subdirectory's files, not the whole project, confirmed empirically
 *  against Quarto 1.7.33). */
export function buildRenderProjectArgs(projectRoot: string): string[] {
  return ["render", projectRoot];
}
```

Kept as a sibling of `buildRenderArgs`, not a generalization of it (§8 alternative #3).

### 5.3 `src/features/render-project.ts` (new adapter)

```ts
export function registerRenderProjectFeature(context: vscode.ExtensionContext): void;
```

Registers `quarto.renderProject`. Handler: resolve start+boundary (§2.3) → `findProjectRoot(start, boundary, existsSync)` → on `null`, `showErrorMessage` (no crash) → on a root, resolve the binary (R1, reusing `resolveBinary()`'s existing `QuartoNotFound` UX verbatim) → `runRenderProject(channel, bin, root)`.

```ts
function runRenderProject(channel: vscode.OutputChannel, bin: string, root: string): Promise<void>;
```

Mirrors `runRender` (`render.ts:90-141`, R3) exactly in shape: `spawn(bin, buildRenderProjectArgs(root), { cwd: root })` — **`cwd` MUST be `root`, not inherited or left as the extension host's own cwd (Dragon D1, §7)** — stream stdout+stderr to a **new, separate** Output channel (recommend `"Quarto Render Project"`, distinct from `"Quarto Render"`, so a project render's (potentially much longer) log doesn't clobber an in-flight single-file render's channel — both can reasonably run at once), same exit-code branch (`parseOutputPath` + `path.resolve(root, reported)` + success/error dialog, wording swapped to reference the project rather than a single file).

### 5.4 `package.json` (+1 command entry)

```json
{ "command": "quarto.renderProject", "title": "Render Project", "category": "Quarto" }
```

Appended to `contributes.commands` (`package.json:75-141`) alongside the existing `quarto.render`/`quarto.preview` entries — same shape, no `when` clause (none of the existing entries have one), no keybinding for v1 (neither `quarto.render` nor `quarto.preview` has one today — consistent).

### 5.5 `src/extension.ts` (+1 wire)

One new import + one new `registerRenderProjectFeature(context);` call alongside the existing `registerRenderFeature(context)`/`registerPreviewFeature(context)` calls (`extension.ts:31-32`).

---

## 6. The slice(s)

> Format: **Goal → New/changed files → What DONE looks like → Verification → Dragons → Boundary.**

### Recommended: ONE vertical-slice session (pre-declared contract, Gate a satisfied by §1's layer table)

- **Goal:** `quarto.renderProject` ("Render Project") appears in the Command Palette; invoked with an active editor inside a Quarto project (or a single open project folder, or a picked folder in a multi-root workspace), it discovers the true project root and renders the whole project — never a silent partial render.
- **New/changed:** exactly the four layers in §1's table (`core/project.ts` + its unit tests; `render-args.ts`+1 fn + `features/render-project.ts` + `package.json`+1 entry + `extension.ts`+1 wire; the new fixture; the new integration suite).
- **DONE:** invoking the command from a file nested inside a project renders every file in that project (not just the active one) — the exact scenario §0's headline finding shows a naive bare-`quarto render` implementation would get silently wrong; invoking it with no active editor and exactly one workspace folder open renders that folder's project with no prompt; invoking it with multiple folders open prompts via `showWorkspaceFolderPick`; invoking it outside any project (or folder) shows a clear error, never a crash or a silent no-op; the reported "Open" path in the success dialog resolves to the actual rendered file on disk (Dragon D1 — this is the test that would have caught a `cwd` mistake).
- **Verify:** `npm test` (unit: `findProjectRoot` — finds at start dir; finds N levels up; respects a boundary (returns `null` past it even when a marker exists further up outside it); recognizes both `.yml`/`.yaml`, `.yml` wins on tie; returns `null` when nothing found and terminates rather than looping at the filesystem root); `npm run test:integration` (new `render-project.test.ts` against the new `test/fixtures/project/` fixture — command registration, whole-project render from the nested `chapters/chapter1.qmd` as the active file **specifically asserting `index.html` is ALSO produced**, not just the active file's own output — the direct regression test for §0's headline finding); `npm run compile`; `npm run package`. **Gate-d discriminator:** assert the nested-file invocation produces outputs for files OTHER than the active one (proves the command did NOT degenerate into the bare-`quarto render`-from-subdirectory partial-render behavior); break-revert by temporarily making the handler `cd` and invoke bare `quarto render` instead of passing `root` explicitly — this should turn the discriminator RED (only the active file's output appears) while a same-directory-as-root invocation stays GREEN, precisely reproducing (and thereby proving the fix for) §0's finding.
- **Dragons:** see §7 (all five apply to this one slice, since it is the whole feature).
- **Boundary:** one session (or two — §9 Q1). Do not also start "Preview Project" (§2.4) or YAML diagnostics (CHANGELOG: YAML schema diagnostics, Session 47) in the same session even if this one finishes quickly (FM #2 "keep going").

---

## 7. Failure-mode / risk analysis

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| D1 | **`cwd` mismatch silently corrupts the "Open" success path.** Quarto's `Output created: <path>` is relative to the **target project directory** passed as the argument, not the spawning process's actual working directory (confirmed empirically: running `quarto render <tmp>` from a wholly unrelated cwd still produced `Output created: index.html` meaning `<tmp>/index.html`, not `<unrelated-cwd>/index.html`). If `runRenderProject` spawns with `cwd` left at the extension host's own default (or anything other than `root`), `path.resolve(cwd, reported)` (mirroring `render.ts:126`) computes a **wrong absolute path** — the render itself would still succeed (Quarto doesn't care about the caller's cwd for the *project* form), but the "Open" button would point at a nonexistent or wrong file. Silent, easy to miss (a manual smoke test run from the right directory wouldn't catch it). | **High** | `spawn(bin, args, { cwd: root })` — pin explicitly, never inherit (§5.3). The gate-d integration test (§6) already exercises this: the test runner's own cwd is never the fixture directory, so a `cwd` mistake here would make that assertion fail immediately. |
| D2 | **Naive bare `quarto render` (relying on cwd) silently under-renders.** This is §0's headline finding — the entire reason this plan builds its own discovery+explicit-argument invocation instead of the "just `cd` and call render" shortcut that would look correct in casual manual testing (it works fine from the true root; the bug only shows up when invoked from a nested file, the actual common case). | **High** | §2.3/§5.2 lock the design to explicit-root-argument invocation; §6's gate-d discriminator is a direct regression test for this exact failure mode. |
| D3 | **Unbounded walk escapes the intended workspace scope in a multi-root window** (an active file with no owning workspace folder, in a window where *other*, unrelated folders happen to be open) — could theoretically find an unrelated `_quarto.yml` far outside anything the user meant to touch. | Medium | `boundaryDir = getWorkspaceFolder(uri)?.uri.fsPath ?? null` — only unbounded when the file truly has no owning folder (§2.2/§2.3). Document this exact edge case as a design choice (not VS Code-mandated, §9 Q2) rather than leaving it implicit. |
| D4 | **Command may not be invocable before any `.qmd` file is ever opened.** `activationEvents` is `["onLanguage:quarto"]` only (`package.json:42-44`) — no `onCommand:quarto.renderProject` entry, and no existing command has one either. Untested whether the Command Palette can activate the extension via a bare contributed-command entry with zero matching activation events in this VS Code/vsce version. | Low (existing commands presumably already rely on whatever makes this work, with no reported issue) | Empirically verify at Phase 3E (Runtime Smoke Test): launch the Extension Development Host with **no** `.qmd` file opened, open a project folder, and confirm "Quarto: Render Project" is listed and invocable from the Command Palette. If it is not, add `onCommand:quarto.renderProject` to `activationEvents` (a one-line, low-risk fix) — but this is specifically worth checking for this command, since every *existing* command is realistically always invoked with a `.qmd` already open (which triggers activation anyway), whereas "Render Project" is plausibly the first command a user invokes with no file open at all. |
| D5 | **Untitled/virtual-scheme active editor.** `activeTextEditor.document.uri.scheme !== "file"` (an unsaved `untitled:` doc, or some other extension's virtual document happens to be focused) must fall through to Tier B (§2.3), not be treated as a real file to search from. | Low | Explicit scheme check in Tier A's gate, mirroring `render.ts:53-55`'s existing assumption that the active document is a real on-disk file (that code already only reaches its file-path logic after passing the `languageId === "quarto"` gate, which excludes non-file scratch buffers in practice — this command's gate must do the analogous check explicitly since it does NOT require `languageId === "quarto"` the way the single-file commands do). |

---

## 8. Alternatives considered

| Alternative | Why not |
|---|---|
| Bare `quarto render` (no args), cwd set to the discovered root | **REJECTED, empirically** (§0/§7 D2) — correct only when cwd lands exactly at the true root; passing the root as an explicit argument is confirmed reliable "regardless of cwd" and has no downside. |
| Let the Quarto CLI's own ancestor walk do all the work — just invoke `quarto render` from the active file's own directory | **REJECTED, empirically** (§0) — produces the confusing partial-render hybrid behavior from a non-root subdirectory (the common case: a user editing a nested chapter). The extension must resolve the true root itself *before* invoking the CLI. |
| Generalize `buildRenderArgs(file: string, ...)` to accept a directory too, instead of a new sibling function | **REJECTED for v1** — `buildRenderArgs` carries `--to`/per-file option semantics a v1 render-only project command doesn't need; renaming its parameter for a second, differently-shaped caller risks an unnecessary diff to a small, stable, well-tested function (SAFEGUARDS: no renames as part of a "quick" change). A sibling `buildRenderProjectArgs` costs one function and keeps blast radius minimal. |
| Generalize `preview.ts`'s file-keyed session model now, to unlock project-level preview alongside render | **REJECTED, out of v1 scope** (§2.4, confirmed by reading `preview.ts` in full this session) — a genuinely separate, larger re-keying/lifecycle redesign; BACKLOG.md already scopes this out explicitly. |
| Always walk unbounded to the filesystem root (ignore workspace-folder boundaries entirely) | **REJECTED as the default** (§7 D3) — could silently escape the user's opened workspace scope in a multi-root window. Kept only as the fallback for the true no-workspace-folder case. |
| Reuse the *existing* `"Quarto Render"` Output channel for project renders too | **REJECTED** — a project render can be long-running (many files) and a single-file render could plausibly be triggered concurrently on another document; a dedicated channel avoids one clobbering the other's in-flight output. Minor, but free to get right now. |
| Extract a shared `spawnQuartoCommand` helper now, so `runRender` and `runRenderProject` don't duplicate the spawn/report shape | **Deferred, not rejected** — the duplication is real and small; consolidating now risks touching `render.ts`'s stable, tested code as a side effect of an unrelated feature addition (SAFEGUARDS: no refactor without plan-mode — this plan is the plan-mode approval for *adding* the feature, not for refactoring the existing one). Tracked as a BACKLOG "Polish/deferred" follow-up after this ships, consistent with this project's existing pattern of listing such small consolidations (e.g. the value-slot-grammar and `#\|`/`//\|` prefix-grammar consolidation entries already in `BACKLOG.md`). |

---

## 9. Open questions for the executor (resolve at implementation, not now)

1. **One session or two?** The four layers (§1) fit comfortably under the vertical-slice gates (≤5 files/commit, small full-suite runtime) and are all necessary for ONE usable, testable capability — recommend one session. But this project's established norm has been finer-grained (even "nearly free" test-only slices like 6d-6+ b2-ii got their own session) — splitting into **L1 alone** (pure discovery + unit tests only) then **L2–L4** (command+adapter+fixture+integration) in a follow-up session is equally valid if the operator prefers that cadence. Ratify at kickoff.
2. **Tier A with no owning workspace folder, but other folders open (§7 D3):** confirmed as unbounded-walk-from-the-file behavior in this plan — is that the right default, or should it fall back to Tier B's folder-pick instead? Recommend keeping it simple (unbounded from the file) since VS Code docs don't mandate a specific answer here; flag if empirical use suggests otherwise.
3. **Output channel naming:** this plan recommends a separate `"Quarto Render Project"` channel (§8) — confirm no naming-collision/discoverability concern before implementing.
4. **`activationEvents` (§7 D4):** empirically verify whether the command is invocable with zero `.qmd` files ever opened; add `onCommand:quarto.renderProject` if not.
5. **Should the new fixture's project be `type: default` or `type: website`?** This plan's examples use `type: default` (matches the empirical grounding exactly, renders in place — simplest to assert against in integration tests via plain `existsSync`). A `website`/`book` fixture would additionally exercise the `_site`/`_book` output-directory path but adds fixture complexity for no v1 correctness gain (the command doesn't interpret `project: type:` at all — it just invokes `quarto render <root>` either way). Recommend `type: default` for v1; note as a possible future fixture addition if `_site`-relative output-path resolution ever needs its own regression test.

---

## 10. Quick reference

| File | Status | Role |
|---|---|---|
| `src/core/project.ts` | **New** | Pure `findProjectRoot` — the discovery algorithm (§5.1) |
| `src/core/render-args.ts` | +1 function | `buildRenderProjectArgs` (§5.2) |
| `src/features/render-project.ts` | **New** | Command registration, folder/editor resolution, `runRenderProject` spawn/report (§5.3) |
| `package.json` | +1 command entry | `quarto.renderProject` / "Render Project" (§5.4) |
| `src/extension.ts` | +1 wire | `registerRenderProjectFeature(context)` (§5.5) |
| `test/unit/project.test.ts` | **New** | Unit coverage for `findProjectRoot` |
| `test/fixtures/project/{_quarto.yml,index.qmd,chapters/chapter1.qmd}` | **New** | The first multi-file project fixture in this repo |
| `test/integration/suite/render-project.test.ts` | **New** | End-to-end command verification, incl. the D1/D2 discriminator (§6) |

**Unchanged:** `src/features/render.ts`, `src/features/preview.ts`, `src/quarto/cli.ts`, every YAML/completion/embedded provider.

---

*End of Project-Level Render plan. Implementation is a separate session (or two — §9 Q1). The headline risk (§0/§7 D1-D2) is not a hypothetical — it was caught by actually running the installed Quarto CLI against a scaffolded project and observing the exact silent-partial-render behavior a naive implementation would have shipped; the plan's design and its recommended gate-d test both exist specifically because of that empirical finding, independently replicated by an adversarial verifier before being locked in here.*
