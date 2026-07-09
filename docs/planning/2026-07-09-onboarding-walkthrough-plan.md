# Onboarding: Getting-Started Walkthrough + Document/Project Scaffolding Commands: Implementation Plan

**Status:** PLAN (draft for executor sessions). Produced by Session 48 (2026-07-09).
**Governs:** `BACKLOG.md` "Up Next" item #3, as originally framed: *"Onboarding: getting-started walkthrough + project/document scaffolding commands (Posit-equivalent: `quarto.newDocument`/`quarto.createProject`). Ship together, one session — both declarative (`contributes.walkthroughs` + command handlers), TDD-exempt per `CLAUDE.md`'s 'pure declarative/config' clause."*
**Scope correction (headline finding, this plan's counterpart to the prior two plans' own corrections):** BACKLOG's framing is wrong on two independent points, confirmed by firsthand CLI/API research (§0):
1. **Only the walkthrough itself is declarative/TDD-exempt.** `quarto.newDocument` and `quarto.createProject` both require genuine new logic (a YAML-safe template builder; an arg-builder + child-process spawn + three new-to-this-codebase user-prompt APIs) — they are ordinary commands under the strict-TDD gate, same as `render`/`renderProject`/`preview`.
2. **This is three capabilities, not one "ship together" session.** `quarto.newDocument`, `quarto.createProject`, and the walkthrough are independently useful (a user who wants one doesn't need the others — unlike the YAML-diagnostics plan's scanner+resolver+adapter, which are inseparable parts of one mechanism), and the walkthrough structurally *depends on* the other two commands already existing (its step completion events reference their command IDs). Recommendation: **three separate implementation sessions**, in dependency order — this plan pre-declares all three contracts now so each is a ready-to-execute vertical slice (Gate a) without its own planning pass. See §9 Q1 for the alternative (bundle into one session) and why it's not recommended.

**Out of scope (v1, all three tracks):** `quarto.newPresentation`/`quarto.newNotebook` (Posit has these; BACKLOG item #3 does not name them, and this project has already parked `.ipynb` entirely and excludes the Visual Editor — adding presentation/notebook creation now would be uninstructed scope growth, not a gap this item asks to close); a project/document-format picker beyond what's specified per-track below; illustrated walkthrough step media (images/svg) — v1 ships text+command-button steps only, deferred per §8.

---

## 0. How this plan was produced (evidence provenance) — and the headline findings

Grounded via a 4-agent parallel research `Workflow` (Session 48, ~265K subagent tokens, 118 tool calls): (1) firsthand verification of `quarto create`/`quarto create-project` against the installed Quarto 1.7.33 CLI — read the bundled `quarto.js` source AND actually executed every command variant in a throwaway scratch directory (deleted after); (2) the VS Code `contributes.walkthroughs` contribution point, grounded against `microsoft/vscode`'s own extension-point registration/parser source (not docs paraphrase); (3) this codebase's own established L1→L4 command-adding pattern, current `engines.vscode`, reusable `media/` assets, and test-fixture conventions (grep + full reads of `render-project.ts`/`preview.ts`); (4) Posit's public, black-box UX for its equivalent commands and walkthrough (marketplace/changelog/docs/README/GitHub-discussion sources only — never `.ts` source, per this project's existing AGPL look-but-don't-copy gate, `docs/POSIT-COMPARISON.md`), to calibrate scope without copying. All four reports are reproduced in full findings below; nothing in this plan is from memory or assumption.

### Finding 1 — `quarto create document` does not exist (🐉 dragon #1)

Confirmed by reading `quarto.js`'s `kArtifactCreators` registry (exactly two entries: `projectArtifactCreator`, `extensionArtifactCreator`) and by live invocation:
```
$ quarto create document html --no-prompt
ERROR: Failed to create document - the type isn't recognized
```
A stale template directory (`share/create/documents/default/...`) still ships on disk but is never wired to any creator — orphaned. **`quarto.newDocument` cannot shell out to the CLI at all; the extension must synthesize the `.qmd` skeleton itself.** This is genuine template-building logic, not "declarative config" — BACKLOG's TDD-exemption claim is wrong for this track.

### Finding 2 — two different `quarto create project` entry points, with materially different interaction models (🐉 dragon #2)

- **`quarto create project <type> <dir> [title]`** (the modern path): prompts interactively via cliffy `Select`/`Input` for any omitted field, but **only when stdin is a real TTY**; in a non-interactive context (which is what a VS Code extension's `child_process.spawn` always is), an omitted required field throws immediately instead of prompting. `--no-prompt` forces the same non-interactive failure mode even in a real terminal. Refuses only if the target directory already contains a Quarto project (`_quarto.yml` present) — otherwise tolerant, skips (doesn't overwrite) any scaffold file that already exists.
- **`quarto create-project [dir] --type --title --template --engine --editor --with-venv --with-condaenv --no-scaffold`** (hidden legacy alias, `.hidden()`-flagged so absent from `quarto help`'s listing but fully invocable): **zero prompting logic of any kind** — every unset flag just takes a built-in default. This is the deterministic, TTY-independent entry point and **the one this plan recommends the extension shell out to** — it sidesteps the interactive-terminal-detection ambiguity of the modern path entirely.
- Firsthand-confirmed project types: `default`, `website`, `book`, `manuscript` (the 4 real underlying types; `blog`/`confluence` are template aliases of `website`/`default` respectively — confirmed in source, not surfaced as their own type in this plan's scope).
- Firsthand transcript (website type): creates `_quarto.yml` (with `project:`/`website:`/`format:` blocks), `index.qmd`, `about.qmd`, `styles.css`. Book type additionally creates `intro.qmd`/`summary.qmd`/`references.qmd`/`cover.png`/`references.bib`. Default type creates only `_quarto.yml` + one `.qmd`.
- **Genuinely open, not resolved by this research:** whether `create-project` also attempts to auto-launch an editor on success (the modern path's `resolveArtifact` does, gated on `--no-open`/TTY; `create-project` was not separately confirmed either way, and `create-project` has no `--no-open` flag in its own documented option list). Flagged as a required kickoff check (§9 Q2) — spawning a `quarto create-project` that tries to launch a *second* VS Code window from inside our own extension's child process would be a real, surprising bug if unconfirmed.

Building `quarto.createProject`'s type/folder/name resolution + arg-building + spawn + error surfacing is a direct structural parallel to `render-project.ts`/`render-args.ts` (read in full, this session) — genuine logic, not declarative config. BACKLOG's TDD-exemption claim is wrong for this track too.

### Finding 3 — `contributes.walkthroughs` is genuinely declarative, fully supported by this project's existing `engines.vscode`

Grounded against `microsoft/vscode`'s own `gettingStartedExtensionPoint.ts` (the JSON schema VS Code validates against) and `gettingStartedService.ts` (the runtime parser), not docs paraphrase:

- Full schema (top-level `id`/`title`/`description`/`icon`/`featuredFor`/`when`/`steps`; per-step `id`/`title`/`description`/`media`/`completionEvents`/`when`) confirmed field-by-field.
- `media` is `oneOf` exactly 3 shapes (`image`, `svg`, `markdown`) — **there is no `video` type** (an earlier automated pass claimed one; disregarded, not source-corroborated). `media.markdown` is the ONLY shape that reads from a separate file; a step's own `description` is *always* an inline string (multi-line via `\n`), supporting `` `code` ``, `__italic__`, `**bold**`, and `[Title](command:...)`/`[Title](https://...)` links (a link alone on its line renders as a button).
- `completionEvents` full syntax confirmed from the parser's `switch`: `onCommand:<id>`, `onLink:<url>`, `onView:<id>`, `onSettingChanged:<id>`, `onContext:<expr>`, `onExtensionInstalled:`/`extensionInstalled:` (both accepted), `onStepSelected`/`stepSelected` (both accepted). **If omitted entirely**, VS Code auto-derives from `description`'s links (a `command:` link → `onCommand:`, an `http(s)://` link → `onLink:`), falling back to `stepSelected` (checks off the instant the step is opened) only if the description has no links at all.
- Engine floor: base feature since VS Code **1.57** (May 2021); `svg` media + `featuredFor` since **1.60** (Aug 2021). This repo's `package.json` already declares `"engines": {"vscode": "^1.90.0"}` — **no engine bump needed**.
- Gotchas worth designing around: `image` as a per-theme object requires ALL FOUR keys (`dark`/`light`/`hc`/`hcLight`), not just `dark`/`light`; duplicate step/walkthrough `id`s silently drop the second registration (console-error only, no user-visible failure); a walkthrough contribution implicitly adds its own `onWalkthrough:<id>` activation event (no manual `activationEvents` entry needed); **walkthroughs auto-open on extension install** by default, via the user's own machine-scoped `workbench.welcomePage.walkthroughs.openOnInstall` setting (default `true`) — this is existing VS Code behavior outside this extension's control, not something to build.

### Finding 4 — a real, new test-infrastructure gap for `quarto.createProject` (🐉 dragon #3)

Grepped confirmed: **zero** existing usage anywhere in this repo's `test/` of `mkdtemp`/`os.tmpdir`/any scratch-temp-directory pattern. The established convention is committed, static, real on-disk fixtures under `test/fixtures/<name>/` (used because prior features validate/render *existing* files). `quarto.createProject` is different in kind: its entire job is to **write brand-new files to a location the user picks at runtime** — there is no fixed fixture path to point it at. **A new integration-test pattern must be introduced**: create an OS temp directory per test, stub the folder-picker/quick-pick/input-box to resolve to it deterministically, execute the command, assert the resulting files, then remove the temp directory in `afterEach` (matching this repo's existing `cleanRenderArtifacts()`-in-`afterEach` discipline, `render-project.test.ts:35-54`, but pointed at a fresh temp dir instead of a committed fixture). This is new infrastructure, not a reuse — called out explicitly as its own risk (§7 D2).

### Finding 5 — zero existing usage of `showInputBox`/`showQuickPick`/`showOpenDialog` anywhere in this codebase (🐉 dragon #4)

Grepped confirmed (`grep -rn "showInputBox\|showQuickPick\|showOpenDialog" src/` → no hits). Every existing command in this extension either takes no user input (`render`, `preview`, `runCell`) or reads from `activeTextEditor`/`workspaceFolders` state (`renderProject`'s `resolveStartAndBoundary`). `quarto.newDocument` (an optional title prompt) and especially `quarto.createProject` (type + folder + name, three prompts in sequence) are the first commands in this extension's history to need interactive user input — genuinely new adapter-layer ground, including the integration-test question of how to *drive* these prompts under `@vscode/test-electron` (§5.1/§5.2 test notes; the existing `render-project.test.ts` precedent of monkey-patching `vscode.window.showInformationMessage`/`vscode.env.openExternal` — reassign-and-restore in `finally`, no sinon — extends directly to `showInputBox`/`showQuickPick`/`showOpenDialog`, confirmed applicable by inspecting the VS Code API surface: all are plain reassignable namespace functions, same as `showInformationMessage`).

### Finding 6 — Posit's own scope, from public sources only (calibration, not a copying target)

Read `docs/POSIT-COMPARISON.md` first (per this project's standing practice). Posit ships **6 commands**: `quarto.newDocument`/`quarto.fileNewDocument` (File→New File menu twin), `quarto.newPresentation`, `quarto.newNotebook` (both Command-Palette-only, no File-menu twin), `quarto.createProject`/`quarto.fileCreateProject` (File→New File menu twin). Document/Presentation/Notebook are **three separate discrete commands** (not one command with a kind-picker); Project creation is **one command with an internal type-picker** (confirmed: "Quarto: Create Project command for creating common project types," v1.47.0, 2022-10-13). New Document uses a **fixed, no-picker template** (`title: "Untitled"` / `format: html`, sourced from a public GitHub Discussion where a maintainer described it plainly). Project creation flow: pick type → pick parent directory → name the new subfolder → project created and opened. Their separate "Getting started with Quarto" walkthrough (confirmed introduced v1.17.0, 2022-04-25) is 6 steps: Install Quarto → Create a document → Render and preview → Run a code cell → Edit an equation → Learn more — and does **not** cover project creation, citations, cross-references, or the Visual Editor.

This project's BACKLOG item #3 only names `quarto.newDocument`/`quarto.createProject` — v1 stays scoped to exactly those two (no presentation/notebook commands), consistent with this project's own already-decided exclusions. Posit's fixed-template New Document is the right level of ambition to match (not exceed) for v1; this plan adds one small independent improvement (an optional title prompt, §5.1) that Posit's own doesn't have, which is a legitimate design choice, not a copy.

---

## 1. Executive summary (TL;DR)

Three tracks, **recommended as three separate implementation sessions** in dependency order (§9 Q1 for the bundle-into-one alternative):

| Track | Command / contribution | New logic? | Depends on |
|---|---|---|---|
| **A** | `quarto.newDocument` | Yes — YAML-safe template builder (title escaping) | Nothing |
| **B** | `quarto.createProject` | Yes — arg-builder + 3 new prompt APIs + child-process spawn + new temp-dir test infra | Nothing (independent of A) |
| **C** | `contributes.walkthroughs` ("Get Started with Quarto") | No — pure declarative JSON + step copy | **A and B must already be shipped** (steps 2/3's `completionEvents` reference their command IDs) |

Each track below is written as its own pre-declared vertical-slice contract (Gate a) — a future executor session can pick up Track A, or Track B, independently, with no further planning needed. Track C's contract additionally requires A and B's command IDs to already be registered.

---

## 2. Track A — `quarto.newDocument`

### 2.1 Mechanism

Zero CLI involvement (Finding 1). On invocation: prompt for an optional title via `vscode.window.showInputBox` (placeholder `"Untitled"`, no validation beyond trim — an empty/whitespace answer or Escape falls back to `"Untitled"`, matching Posit's own default rather than blocking); build a front-matter string with the (YAML-safely-quoted) title and a fixed `format: html`; open it as an **untitled, unsaved buffer** (`vscode.workspace.openTextDocument({content, language: "quarto"})` → `showTextDocument`) — no disk write, no Save-As prompt forced on the user, matching the inferred Posit behavior (§0 Finding 6) and avoiding any new filename-collision logic.

### 2.2 Why the title needs real escaping logic (the thing that makes this NOT "pure declarative")

A title containing a colon (`My: Notes`), a quote, or a leading special character breaks unquoted YAML scalar syntax. `buildNewDocumentContent(title)` must emit a quoted YAML string (double-quote-wrap, escaping embedded `"` and `\`) — this project has no existing "quote a string for YAML *output*" helper (`project-yaml.ts`'s `unquoteKey` does the reverse: *parsing* an already-quoted key, not producing one). This is new, small, genuinely testable logic — the reason this track is under strict TDD, not exempt.

### 2.3 Evidence-based inventory

| # | Component | Location | Reuse |
|---|---|---|---|
| R1 | Feature-registration idiom | `src/features/render-project.ts:32-42` | Template for `registerNewDocumentFeature(context)` |
| R2 | `showInformationMessage`/`openExternal` monkey-patch test technique | `test/integration/suite/render-project.test.ts` | Extends directly to stubbing `showInputBox` (Finding 5) |
| G1 | YAML-output quoting for a title string | none exists (`project-yaml.ts`'s `unquoteKey` is parse-direction only, confirmed by reading the file in full) | **New**, L1 |
| G2 | `showInputBox` usage anywhere in this codebase | none (grep-confirmed, Finding 5) | **New**, L2 |

### 2.4 Interface contracts

```ts
// src/core/new-document.ts (new, pure — core/ stays vscode-free per architecture plan §3.3)

/** Build the content of a new blank Quarto document. `title` is trimmed; an
 *  empty/whitespace-only title becomes "Untitled" (matches Posit's own fixed
 *  default). The title is emitted as a double-quoted YAML scalar with `"`/`\`
 *  escaped — untrusted user input, must not corrupt the front matter for any
 *  title text. Format is fixed to `html` for v1 (no format picker — §Out of
 *  scope). */
export function buildNewDocumentContent(title: string): string;
```

```ts
// src/features/new-document.ts (new adapter)
export function registerNewDocumentFeature(context: vscode.ExtensionContext): void;
```
Registers `quarto.newDocument`; handler: `showInputBox({prompt: "Document title", placeHolder: "Untitled"})` → `buildNewDocumentContent(answer ?? "")` → open as an untitled `language: "quarto"` document → `showTextDocument`. A `showInputBox` cancellation (`undefined`, distinct from an empty string) is treated identically to an empty answer — proceed with `"Untitled"`, never abort (there is nothing destructive to cancel out of; matches this codebase's existing cancellation-is-quiet-not-an-error convention, e.g. `renderProject`'s multi-root-folder-pick cancellation).

`package.json`: one new `contributes.commands` entry (`quarto.newDocument`, title `"New Quarto Document"`, category `"Quarto"`). No `activationEvents` change (commands auto-generate `onCommand:` activation on VS Code ≥1.74, already relied on by every recent command per Learning #52 — confirmed applicable again here).

### 2.5 The slice

- **Goal:** `Quarto: New Quarto Document` in the Command Palette opens a new, unsaved editor tab with `language` = `quarto`, containing valid YAML front matter (`title:`/`format: html`) and no body content, ready to type into.
- **New/changed files:** `src/core/new-document.ts` (new), `test/unit/new-document.test.ts` (new), `src/features/new-document.ts` (new), `src/extension.ts` (+1 wire), `package.json` (+1 command entry), `test/integration/suite/new-document.test.ts` (new). 6 files — two checkpoint commits (L1: core+unit; L2: adapter+wiring+integration test), both under the 5-file cap.
- **DONE looks like:** unit tests cover — a blank/whitespace/omitted title → `"Untitled"`; a plain title → quoted verbatim; a title containing `"` and `\` → both escaped correctly (assert the *exact* emitted string, not just "doesn't throw"); a title containing `:` → still valid YAML (parse the emitted front matter with the project's own YAML tooling, or a minimal hand check, to prove no syntax break). Integration test: `quarto.commands.executeCommand("quarto.newDocument")` (with `showInputBox` stubbed to return a fixed title, and separately stubbed to return `undefined`) opens a new untitled editor with `languageId === "quarto"` and content matching `buildNewDocumentContent`'s output exactly.
- **Verify:** `npm test` (unit) → `npm run compile` → `npm run test:integration` → `npm run package` (confirm the new command appears via `vsce ls` and the `.vsix` stays clean). Full matrix at **both** checkpoint boundaries, not just once at the end (self-critique from Sessions 45/47, `PROJECT_LEARNINGS.md` — do not repeat).
- **Dragons:** G1 (YAML-output escaping — get the unit tests to actually assert the escaped string, not just "no throw"); G2 (confirm the `showInputBox` stub technique works under `@vscode/test-electron` before assuming it — a 5-minute spike, not a leap of faith).
- **Boundary:** one session. Do not also start Track B or C even if this finishes quickly (FM #2).

---

## 3. Track B — `quarto.createProject`

### 3.1 Mechanism

Three sequential prompts, then a deterministic CLI spawn (Finding 2):
1. `showQuickPick(["Default", "Website", "Book", "Manuscript"])` → map to the CLI's lowercase type string.
2. `showOpenDialog({canSelectFolders: true, canSelectFiles: false, canSelectMany: false})` → parent directory.
3. `showInputBox({prompt: "Project folder name"})` → both the new subfolder's name AND (passed explicitly as `--title`, never relying on an unconfirmed CLI default — §0 Finding 2) the project title.

Any cancellation at any of the three steps aborts quietly (no error message — matches `renderProject`'s cancellation convention). Resolve `targetDir = path.join(parentDir, name)`. Spawn:
```
quarto create-project <targetDir> --type <type> --title <title>
```
(the target directory passed as an explicit absolute argument — never a bare/cwd-relative invocation, mirroring `render-project.ts`'s D1 discipline of always passing the resolved path explicitly). On success (`exit 0`): open the new project as the workspace (`vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(targetDir))`) — matches Posit's own confirmed behavior (§0 Finding 6: "the project is created and opened") and the general VS Code new-project convention (cf. `Git: Clone`'s open-after-clone prompt). On failure: surface stderr via `showErrorMessage`, mirroring `render-project.ts`'s spawn-failure handling exactly.

### 3.2 Evidence-based inventory

| # | Component | Location | Reuse |
|---|---|---|---|
| R1 | Arg-builder pattern | `src/core/render-args.ts` `buildRenderProjectArgs` (`:46-48`) | Direct structural template for `buildCreateProjectArgs` |
| R2 | Spawn + Output-channel + error-surfacing pattern | `src/features/render-project.ts` `runRenderProject`/`resolveBinary` error branch (`:73-95`, `:148-204`) | Direct template for the create-project spawn |
| R3 | `cleanRenderArtifacts`-in-`afterEach` cleanup discipline | `test/integration/suite/render-project.test.ts:35-54` | Adapted (not reused as-is) to a fresh `mkdtemp` dir per test rather than a committed fixture — Finding 4 |
| G1 | `showQuickPick`/`showOpenDialog`/`showInputBox` usage | none anywhere (grep-confirmed, Finding 5) | **New**, L2 |
| G2 | An OS-temp-directory integration-test convention | none anywhere (grep-confirmed, Finding 4) | **New**, L3 — this track's own dragon, distinct from G1 |
| G3 | Whether `create-project` also tries to auto-launch an editor | not confirmed either way by this research (§0 Finding 2) | Verify at kickoff (§9 Q2) before finalizing the spawn call |

### 3.3 Interface contracts

```ts
// src/core/create-project-args.ts (new, pure, sibling of render-args.ts — same
// "sibling, not generalize" precedent as buildRenderProjectArgs/buildRenderArgs)

export type ProjectType = "default" | "website" | "book" | "manuscript";

/** Build the argv for `quarto create-project <targetDir> --type <type>
 *  --title <title>`. `targetDir` is an absolute path, passed explicitly (never
 *  cwd-relative — mirrors render-project.ts's D1 discipline). `title` is
 *  passed through verbatim as a single argv element (no shell involved —
 *  child_process.spawn with an argv array never needs shell quoting). */
export function buildCreateProjectArgs(
  targetDir: string,
  type: ProjectType,
  title: string,
): string[];
```

```ts
// src/features/create-project.ts (new adapter)
export function registerCreateProjectFeature(context: vscode.ExtensionContext): void;
```
Handler: the 3-prompt resolution (§3.1) → `resolveBinary()` (reuse, same `QuartoNotFound` branch as `render-project.ts:73-95`) → spawn via `buildCreateProjectArgs` → on success, `vscode.commands.executeCommand("vscode.openFolder", ...)`.

`package.json`: one new `contributes.commands` entry (`quarto.createProject`, title `"Create Project"`, category `"Quarto"`). No `activationEvents` change (same auto-generated `onCommand:` reasoning as Track A).

### 3.4 The slice

- **Goal:** `Quarto: Create Project` prompts for type/parent-folder/name, creates a real Quarto project at `<parent>/<name>` via the real CLI, and opens it as the new workspace.
- **New/changed files:** `src/core/create-project-args.ts` (new), `test/unit/create-project-args.test.ts` (new), `src/features/create-project.ts` (new), `src/extension.ts` (+1 wire), `package.json` (+1 command entry), `test/integration/suite/create-project.test.ts` (new, introduces the new temp-dir pattern — Finding 4). 6 files, two checkpoint commits (L1: core+unit; L2: adapter+wiring+integration).
- **DONE looks like:** unit tests cover the four project types' exact argv shape, an absolute-path assertion (never a bare relative dir), and a title containing spaces (still one argv element, no manual quoting needed — argv arrays bypass shell parsing entirely, a real discriminator worth asserting explicitly since it's easy to wrongly "helpfully" quote it). Integration test: stub the three prompts to resolve deterministically to a freshly-`mkdtemp`'d OS temp directory + a fixed type/name, execute the command against the REAL installed Quarto CLI, assert `_quarto.yml`/`index.qmd` (or type-appropriate files) exist with expected shape, assert `vscode.workspace.workspaceFolders` reflects the newly opened folder (or, if driving a real `vscode.openFolder` proves untestable inside one Extension Development Host session — a real possible constraint, since `vscode.openFolder` typically reloads the window — fall back to asserting the CLI's file-creation side effect only and documenting the open-folder step as verified by direct/manual launch instead, same honesty standard as Session 47's disclosed `onDidCloseTextDocument` test-harness limitation). Remove the temp directory in `afterEach`, unconditionally (even on assertion failure).
- **Verify:** full matrix at both checkpoint boundaries (unit+compile+integration+package).
- **Dragons:** G1 (spike the three prompt-stubbing techniques before writing the real test — confirm each is drivable under `@vscode/test-electron`, the same discipline Track A's G2 note asks for, but here for three APIs at once, not one); G2 (get the temp-dir lifecycle right — create fresh per test, absolute path, remove even on failure, and confirm it is NEVER created inside the repo working tree by accident — the `os.tmpdir()`-based scratch pattern this session's own OWN research agents used for CLI probing, §0, is the correct precedent to follow, not a fixture-relative path); G3 (confirm at kickoff whether `create-project` attempts an editor auto-launch — if it does, `--no-open` may need to be discovered/added as an argv flag not documented in the researched `--help` text, or the spawn may need `stdio` isolation to prevent a stray process; do not assume either way — verify against the real CLI first, same live-CLI discipline §0 used).
- **Boundary:** one session, independent of Track A (may run before or after it — no ordering dependency between A and B themselves, only C depends on both). Do not also start Track C in the same session even if both A and B are already shipped by the time this session starts (Track C's own contract, §4, should be its own session per the walkthrough-UX-guidance risk of rushing step copy — FM #2).

---

## 4. Track C — the walkthrough

### 4.1 Mechanism

Pure `contributes.walkthroughs` addition — no new TypeScript. **Hard precondition: Tracks A and B must already be shipped**, since two steps' `completionEvents` reference `quarto.newDocument`/`quarto.createProject`, which must already be registered commands.

Recommended steps (topics only — final copy is written fresh at implementation time, independently worded; VS Code's own UX guidance, §0 Finding 3, explicitly warns against an excessive step count, so this stays at 5, not 6-7):

1. **Install & verify Quarto** — links to quarto.org's install page; action button runs the *already-shipped* `quarto.verifyInstallation` (confirmed existing command, `package.json`). `completionEvents: ["onCommand:quarto.verifyInstallation"]`.
2. **Create your first document** — button runs `quarto.newDocument` (Track A). `completionEvents: ["onCommand:quarto.newDocument"]`.
3. **Create a project** — button runs `quarto.createProject` (Track B). `completionEvents: ["onCommand:quarto.createProject"]`. (Goes beyond Posit's own walkthrough, which does not cover project creation at all, §0 Finding 6 — a deliberate, legitimate independent choice since this BACKLOG item ships both commands as peers.)
4. **Render and preview** — explains the existing `quarto.render`/`quarto.preview` commands (and the editor-toolbar/keybinding entry points, if any already exist — confirm at implementation). `completionEvents: ["onCommand:quarto.preview"]`.
5. **Run a cell, then explore more** — button runs the existing `quarto.runCell`; closing paragraph links out to the math-preview (`quarto.previewMath`) and diagram-preview (`quarto.previewDiagram`) features as further exploration, folding what would otherwise be a thin "Learn more" step into this one (keeping the total at 5, under the UX-guidance concern). `completionEvents: ["onCommand:quarto.runCell"]`.

Recommend `featuredFor: ["**/*.qmd"]` (cheap, declarative, matches Posit's own "featured when Quarto files are present" positioning — confirmed supported at this project's engine floor, §0 Finding 3).

### 4.2 The slice

- **Goal:** installing/opening this extension surfaces a "Get Started with Quarto" walkthrough (via the Extensions view or `workbench.action.openWalkthrough`) whose 5 steps are each completable by using the corresponding real command, tying together Tracks A, B, and four already-shipped features.
- **New/changed files:** `package.json` (`+contributes.walkthroughs` entry, one array with 5 step objects — a single, larger declarative diff, still one file). 1 file, one commit. **No unit or integration test required** — this is the CLAUDE.md-exempt declarative-config case, correctly this time (unlike Tracks A/B): verification is `npm run compile` (schema-shape sanity) + a manual/F5 visual pass (Phase 3E runtime smoke test) confirming the walkthrough renders, each step's button fires its command, and each `completionEvents` check-mark fires on doing so.
- **DONE looks like:** F5 Extension Development Host, `workbench.action.openWalkthrough` (or a fresh install) shows the walkthrough with 5 steps, correct titles/descriptions, and each step's button executes the intended command and the step visibly checks off afterward.
- **Verify:** `npm run compile`; manual F5 pass (mandatory here, since there is no automated test — Phase 3E's runtime-smoke-test requirement is the *entire* verification surface for this track, not a supplement to it).
- **Dragons:** none new — this track is genuinely as simple as BACKLOG originally framed the *whole* item to be; the complexity was in Tracks A/B, not here.
- **Boundary:** one session, only startable once A and B are both shipped. Do not fold A or B's own remaining work into this session if either isn't fully done yet (a broken `completionEvents` reference to a not-yet-registered command is worse than an incomplete walkthrough — better to wait).

---

## 5. Failure-mode / risk analysis (cross-track)

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| D1 | **Track B's `create-project` auto-launches a second editor/window** as an unconfirmed side effect of the spawned CLI process (§0 Finding 2, §9 Q2). | Medium | Verify against the real installed CLI at Track B's kickoff, before writing the spawn call — do not assume either the modern path's `--no-open` behavior or its absence transfers to the legacy alias. |
| D2 | **New temp-dir integration-test infra (Finding 4) accidentally writes inside the repo working tree** instead of an OS temp directory, polluting `git status` or leaving stray files on a failed test run. | Medium | Use `fs.mkdtempSync(path.join(os.tmpdir(), "quarto-ext-createproject-"))` (never a `test/fixtures`-relative path); remove in `afterEach` unconditionally (try/finally around the whole test body, not just the happy path). |
| D3 | **A YAML-escaping bug in Track A's title builder** produces front matter that fails to parse (e.g. an unescaped embedded quote) — the exact inverse failure mode of the fixed-template safety Posit's own zero-picker design avoids by construction. | Medium | Unit-test the exact escaped output for `"`, `\`, and `:`-containing titles (§2.5) — assert the string, not just "doesn't throw." |
| D4 | **The three new prompt APIs (`showInputBox`/`showQuickPick`/`showOpenDialog`) turn out not to be cleanly stubbable** under `@vscode/test-electron` the way `showInformationMessage` is (Finding 5's extension of the existing precedent is a reasonable bet, not yet proven). | Low–Medium | Spike the stub technique for each API early in Track A/B's own session (a 5-minute check), before committing to it as the integration-test strategy; if any API resists reassignment, fall back to a documented manual/F5 verification for that one path only, disclosed honestly (Session 47's `onDidCloseTextDocument` precedent for disclosed-not-hidden test-harness limits). |
| D5 | **Walkthrough step count creep** — VS Code's own UX guidance (§0 Finding 3) explicitly warns against too many steps; it would be easy to expand from 5 to 7-8 once writing real copy (e.g. splitting render/preview, adding a citations step). | Low | Hold the line at the 5 steps enumerated in §4.1 at plan time; any additional step is a deliberate scope decision to flag at Track C's own kickoff, not a default. |

---

## 6. Alternatives considered

| Alternative | Why not |
|---|---|
| Shell `quarto.newDocument` out to a CLI creator, matching the shape of `quarto.createProject` | **Impossible** (Finding 1) — no such CLI creator exists in Quarto 1.7.33; confirmed by source read and live invocation, not assumed. |
| Use the modern `quarto create project <type> <dir> [title]` path (with `--no-prompt`) for Track B, instead of the legacy `create-project` alias | **Rejected** — `--no-prompt` in a non-TTY context (which `child_process.spawn` always is) throws on *any* omitted field rather than silently defaulting, and the interactive/non-interactive branching adds real complexity for zero benefit over the legacy alias, which has no such ambiguity at all (Finding 2). |
| One combined session for all three tracks, as BACKLOG originally framed | **Not recommended** (this plan's headline finding #2) — three independently-useful capabilities with different genuine-logic surfaces (a YAML-escaping problem; a CLI-arg-plus-three-new-prompt-APIs problem; a purely declarative problem) and a real dependency edge (C needs A+B). Bundling risks FM #26 (mega-session masquerading as a vertical slice) for no benefit BACKLOG's own text actually requires — nothing forces all three to land in the same commit for the feature to work. Kept as an explicit open question (§9 Q1) rather than silently overridden, since the operator may still prefer one session. |
| A format/engine picker for `quarto.newDocument` (beyond the fixed `format: html`) | **Deferred, not rejected** — Posit's own equivalent has no picker either (Finding 6); adding one is a real, independent enhancement over parity, not something this BACKLOG item asks for. Tracked as a natural v1.1 follow-up, not built here. |
| Illustrated (image/svg) walkthrough step media | **Deferred** — the existing 5 `media/screenshots/*.png` document different, already-shipped features (highlighting/outline/completion/preview/render), not these 5 new step topics; commissioning new screenshots is real extra production work outside this plan's scope (§0/Out of scope). Text+button steps are fully valid per the schema (`media` is required per-step, but no rule mandates *illustrative* imagery — recommend a plain `markdown` media panel per step, e.g. reusing a step's own description restated, or a minimal generic icon, at implementation time — a small open detail, not a blocker). |

---

## 7. Open questions for the executor (resolve at implementation, not now)

1. **One session or three?** This plan recommends three (§1, §6) — an explicit correction to BACKLOG's "ship together" framing. If the operator prefers to bundle A+B (both are independent of each other, so bundling *those two* — not C — is a smaller, more defensible version of "together" than all three) into one session, that is a legitimate alternative; ratify at kickoff. C should not be bundled with A or B regardless, since it cannot start until both are done.
2. **Does `quarto create-project` attempt an editor auto-launch on success?** Not confirmed by this session's research either way (§0 Finding 2, §5 D1) — a cheap, fast check against the real installed CLI at Track B's kickoff (spawn it once from a terminal, observe) resolves this before the spawn call is written.
3. **`quarto.createProject`'s post-success behavior:** open the new project as the workspace (this plan's recommendation, matching Posit — §3.1), or a lighter-weight "just reveal `index.qmd` in the current window" alternative? Recommend the former; confirm at Track B's kickoff if the operator prefers the latter.
4. **Track C's per-step `media`:** the schema requires a `media` object per step (§0 Finding 3) but content is otherwise open — recommend a minimal `markdown` panel per step (reusing/restating the step's own guidance) rather than commissioning new images (§6); confirm at Track C's kickoff.
5. **Should Track A's title prompt exist at all, or should v1 match Posit's zero-prompt fixed template exactly?** This plan recommends keeping the prompt (§0 Finding 6's "legitimate independent improvement," and the reason Track A has genuine logic to TDD at all) — confirm at Track A's kickoff if the operator would rather ship the simpler zero-prompt version.

---

## 8. Quick reference

| File | Status | Track | Role |
|---|---|---|---|
| `src/core/new-document.ts` | New | A | `buildNewDocumentContent` (§2.4) |
| `test/unit/new-document.test.ts` | New | A | Title-escaping coverage |
| `src/features/new-document.ts` | New | A | `registerNewDocumentFeature` (§2.4) |
| `test/integration/suite/new-document.test.ts` | New | A | End-to-end via stubbed `showInputBox` |
| `src/core/create-project-args.ts` | New | B | `buildCreateProjectArgs` (§3.3) |
| `test/unit/create-project-args.test.ts` | New | B | Argv-shape coverage |
| `src/features/create-project.ts` | New | B | `registerCreateProjectFeature` (§3.3) |
| `test/integration/suite/create-project.test.ts` | New | B | End-to-end via stubbed prompts + a fresh OS temp dir (Finding 4) |
| `package.json` | +2 command entries, +1 `contributes.walkthroughs` entry | A, B, C | No `activationEvents` change needed for any track |
| `src/extension.ts` | +2 wires | A, B | `registerNewDocumentFeature`/`registerCreateProjectFeature` |

**Unchanged:** every existing `src/core/`/`src/features/`/`src/providers/` file — all three tracks are additive, no existing behavior is modified.

---

*End of onboarding plan. Implementation is 1–3 separate sessions per §1/§9 Q1 — recommended order: Track A, then Track B (either order between them), then Track C last (hard dependency on both).*
