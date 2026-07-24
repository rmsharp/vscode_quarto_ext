# Notebook (`.ipynb`) Conversion: Implementation Plan

**Status:** PLAN (draft for an executor session). Produced by Session 62 (2026-07-10).
**Governs:** `BACKLOG.md` "Up Next" item 8 — notebook (`.ipynb`) conversion (CHANGELOG: notebook .ipynb conversion, Session 63`), ranked at Session 61's grill-me, reversing Session 43's original "parked" call ("no evidence anywhere in this project's history that notebook-format interop is a real workflow here" — the operator confirmed at Session 61 that a real need exists).
**Scope lock:** one or two new Command-Palette commands (§8 Q1) that shell out to the existing MIT `quarto convert` CLI subcommand to convert the active document between `.qmd` and `.ipynb`, then open the result. **No vendored asset, no new notebook UI** — VS Code's own built-in `ipynb` extension (MIT, bundled) already renders/edits `.ipynb`. **No execution support** — running a converted notebook's cells remains the user's own `ms-toolsai.jupyter` install, the same boundary this project already draws for `.qmd` cell execution (no bundled Python/R/Julia/OJS kernels).

---

## 0. Evidence provenance

Grounded this session across three independent tracks — firsthand CLI testing, direct codebase reads, and cited external research (no claim in this plan rests on memory or documentation alone).

### 0.1 `quarto convert` CLI — verified firsthand against the installed 1.7.33 binary

Ran `quarto convert --help` plus 9 live round-trip/edge-case invocations in a scratch directory (not the repo). Findings:

- **Single subcommand, direction auto-inferred from the input's extension**: `quarto convert <input> [-o/--output PATH] [--with-ids] [--log ...] [--quiet] [--profile]`. No `--to`/direction flag exists (a stray web-search hit for `--to markdown` is stale/wrong — confirmed absent from both `--help` and the live invocation).
- **Default output** (no `-o`): same directory, same basename, swapped extension (`doc.qmd` → `doc.ipynb`). Not documented in prose on quarto.org — only implied by the CLI's own example captions — but empirically confirmed directly.
- **Silently overwrites an existing output file** — re-ran `quarto convert doc.qmd` a second time with `doc.ipynb` already present: exit 0, no prompt, no warning. **This is the one behavior our adapter must not blindly inherit** (§6).
- **`-o` into a non-existent parent directory errors** (exit 1, raw Deno stack trace to stderr) — it does not `mkdir -p`. Not relevant to v1's own output path (always same directory as the input, which by definition already exists), but worth knowing if a future picker-based output path is added.
- **Missing input file**: clean-ish `ERROR: File not found: '<path>'` on stderr, but ALSO followed by a full raw Deno stack trace — every CLI error path dumps the stack trace, not just this one. Our adapter must not surface the raw channel text as a modal message; only a synthesized message (mirroring `render-project.ts`'s `"...failed (exit ${code})... see the Output for details"` convention, not a stderr dump into `showErrorMessage`).
- **Round-trip is lossy**: `.qmd` → `.ipynb` → `.qmd` injects a `jupyter: python3` front-matter key that the original didn't have. Disclosed limitation (§6), not something to fix — it's the underlying CLI's own behavior.
- **Notebook `kernelspec` metadata is hardcoded to `{name: "python3", language: "python", display_name: "Python 3"}` regardless of the source cell's actual engine** — verified with an `{r}`-cell `.qmd`: converts without error, but the resulting notebook still claims a Python kernel. A real fidelity gap if the user later tries to *execute* the converted notebook in Jupyter with an R cell inside — disclosed, not fixed (§6).
- **`{ojs}` cells do NOT become notebook code cells** — verified with an `{ojs}`-cell `.qmd`: converts without error (exit 0), but the entire document (front matter + the `{ojs}` fence) is swallowed into ONE markdown cell, not split into a code cell. OJS has no Jupyter-kernel equivalent, so this is expected, but it means notebook conversion is only faithful for python/r/julia content — disclosed (§6).
- Pure prose (no code cells) converts fine; a `.py` input also converts (jupytext-like behavior) — out of this feature's scope (only `.qmd`↔`.ipynb` is in scope).

### 0.2 This codebase's existing reuse patterns — read in full, not grepped in excerpt

- **CLI resolution**: `src/quarto/cli.ts:61` `resolveBinary(): Promise<QuartoInstallation>` — resolves `quarto.path` setting (or bare `quarto`), validates via `--version`, throws `QuartoNotFound` on failure. Every existing CLI-spawning feature (`render.ts:61`, `render-project.ts:75`, `create-project.ts:77`, `preview.ts:93`) catches `QuartoNotFound` with the IDENTICAL "Quarto was not found... Open Settings" `showErrorMessage` + `workbench.action.openSettings` pattern (e.g. `render.ts:62-78`) — this is copy-identical across all four sites, a clear "reuse this exact block" convention, not a shared helper (kept inline at each site, per this project's existing style — no abstraction was extracted for 4 call sites).
- **Dirty-document handling — ALREADY established, not a new design decision**: `render.ts:53-54` and `preview.ts:87-88` both do `if (doc.isDirty) { await doc.save(); }` before reading `doc.uri.fsPath`, with NO special handling for `doc.isUntitled` (an untitled `.qmd` document — e.g. one just created via `quarto.newDocument`, `src/features/new-document.ts` — has `languageId === "quarto"` and would pass `render.ts`'s own gate; calling `.save()` on it triggers VS Code's native Save-As dialog). This feature inherits the IDENTICAL behavior/risk for the `.qmd`→`.ipynb` direction — not a new gap this plan introduces (§6).
- **Pure arg-builder pattern**: `src/core/render-args.ts` (`buildRenderArgs`, `buildRenderProjectArgs`, `parseOutputPath`) and `src/core/create-project-args.ts` (`buildCreateProjectArgs`) — small, single-purpose, `vscode`-free functions, each independently unit-tested (`test/unit/render-args.test.ts`, `test/unit/create-project-args.test.ts`). `buildCreateProjectArgs(targetDir, type, title)` is the closest sibling: caller resolves and passes the target path explicitly (never relies on the CLI's own path derivation), matching this project's general "D1 discipline" (explicit paths over implicit CLI defaults, `render-project.ts:9-13`).
- **Adapter/spawn pattern**: `src/features/render-project.ts:148-204` `runRenderProject` and `src/features/create-project.ts:106-155` `runCreateProject` both: create/clear/show a dedicated `OutputChannel`, `spawn(bin, args)`, stream `stdout`+`stderr` verbatim to the channel via one shared `onData` handler, resolve a `Promise<void>` on `close`, branch on `code === 0`, and on success EITHER parse a CLI-reported path (`render-project.ts`, via `render-args.ts`'s `parseOutputPath`, needed because a whole-project render's output path isn't cheaply precomputable) OR use an already-known path the caller constructed (`create-project.ts`, since `targetDir` was already resolved before spawning — no stdout parsing needed). **Notebook conversion matches the `create-project.ts` shape**: since the output path is always derivable in advance (same directory, swapped extension — verified §0.1), the adapter should always pass `-o <derived-path>` explicitly and skip stdout-marker parsing entirely (simpler, and avoids depending on an undocumented "Converted to X" stdout string surviving a future Quarto CLI version).
- **package.json shape**: `contributes.commands` entries are `{command, title, category: "Quarto"}` triples (`package.json:93-106`); there is **no `contributes.menus` section anywhere in this project yet** — every command is Command-Palette-only, always visible regardless of context, with the adapter itself validating applicability at runtime and showing a `showErrorMessage` if inapplicable (`render.ts:45-50`'s `"open a Quarto (.qmd) document to render"` pattern). `activationEvents` (`package.json:42-45`) is only `onLanguage:quarto`/`onLanguage:yaml` — VS Code's modern implicit command-activation means a new command needs no new activation event.
- **Integration-test monkey-patch technique**: `test/integration/suite/create-project.test.ts:9-84` — `withStubbedQuickPick`/`withStubbedInputBox`/`withStubbedOpenDialog` (swap `vscode.window.showX` for a resolved-value stub, restore in `finally`) and `withInterceptedOpenFolder` (swap `vscode.commands.executeCommand` to intercept one specific command name, delegate everything else to the original — used there to avoid a real `vscode.openFolder` reloading the Extension Development Host mid-suite). This feature needs the identical interception technique for **its own auto-open step** (opening the converted file must not literally reload/navigate away mid-test) and, if the overwrite-confirmation modal (§6) is added, for stubbing `showWarningMessage`.
- **Zero existing `.ipynb` handling anywhere**: `grep -rni ipynb src/ package.json` returns only an unrelated string match (`core/yaml-schema.ts:256`, the `keep-ipynb` YAML *option name*, nothing to do with notebook files themselves). Confirms this is genuinely new ground, not a duplicate of anything shipped.
- **No existing `modal: true` dialog usage** — `showWarningMessage` itself is already used twice (`extension.ts:68`, non-modal; `execution.ts:339`, non-modal), but never with `{modal: true}`. The overwrite-confirmation dialog this plan proposes (§6) would be this project's first modal prompt — a small, low-risk API surface (documented, standard VS Code option), not a new dependency.

### 0.3 VS Code's built-in `ipynb` extension + `ms-toolsai.jupyter` — external research, cited

Confirmed via `microsoft/vscode`'s own `main` branch (`gh api`) and official VS Code docs — no source was read from Posit's extension for this part:

- **The built-in `ipynb` extension (publisher `vscode`, MIT, bundled since VS Code 1.59) alone provides a full notebook UI** (view/edit/add/delete/reorder cell, markdown rendering, save) with **zero other extensions installed** — confirmed both from the VS Code 1.59 release notes (verbatim: *"you can now open Jupyter notebooks in a clean install of VS Code, without having to install the full Jupyter extension"*) and by reading `extensions/ipynb/src/ipynbMain.ts` in full: it registers a `NotebookSerializer` (read/write) and the `*.ipynb` file association, but registers **no `NotebookController`** — so it structurally cannot execute code. https://code.visualstudio.com/updates/v1_59, https://code.visualstudio.com/api/extension-guides/notebook
- **Executing a cell requires `ms-toolsai.jupyter`** (or another controller-providing extension) — confirmed by the same absence of a registered `NotebookController` in the built-in extension, plus the 1.59 release notes' own explicit statement. https://marketplace.visualstudio.com/items?itemName=ms-toolsai.jupyter
- **The built-in extension exposes `ipynb.openIpynbInNotebookEditor`** (takes a `uri`, opens an *existing on-disk file* in the Notebook editor) and `ipynb.newUntitledIpynb` (blank untitled notebook) — read verbatim from `extensions/ipynb/package.json`'s `contributes.commands` and `ipynbMain.ts`'s implementation. `openIpynbInNotebookEditor` is hidden from the Command Palette (`"when": "false"` on its menu entry) but that only hides the *menu item*, not the command registration — it remains callable via `executeCommand`. Treated as a fallback, not primary (see next point).
- **The idiomatic, primary mechanism — directly confirmed in this project's own installed `@types/vscode`** (not assumed): `vscode.workspace.openNotebookDocument(uri): Thenable<NotebookDocument>` + `vscode.window.showNotebookDocument(doc): Thenable<NotebookEditor>` — this is exactly what `ipynb.openIpynbInNotebookEditor` does internally. `vscode.commands.executeCommand('vscode.openWith', uri, 'jupyter-notebook')` is an equally valid, documented alternative.
- **Confirmed directly in `node_modules/@types/vscode/index.d.ts` this session** (load-bearing, not delegated): an open `.ipynb` file is a **`NotebookEditor`/`NotebookDocument`, never a `TextEditor`/`TextDocument`** — `vscode.window.activeNotebookEditor: NotebookEditor | undefined` (`index.d.ts:11142`) is the accessor, distinct from `activeTextEditor`. `NotebookDocument` (`index.d.ts:15472`) has `uri`, `isDirty`, `isUntitled`, and its own `save(): Thenable<boolean>` (`index.d.ts:15544`, doc comment: *"Save the document... resolve to true when the document has been saved. Will return false if the file was not dirty or when save failed."*) — the exact `NotebookDocument`-flavored mirror of `TextDocument.save()`. **This is the key architectural finding for the `.ipynb`→`.qmd` direction**: the adapter cannot reuse `vscode.window.activeTextEditor` to detect an open notebook; it must separately check `vscode.window.activeNotebookEditor?.notebook` (§4).

### 0.4 Posit's own precedent — public sources only (AGPL-3.0 look-but-don't-copy gate: cite behavior/PR metadata, never read or copy their source)

- **Posit's official Quarto extension ALREADY ships this feature.** Commands `quarto.convertToIpynb` ("Convert to .ipynb", visible when `editorLangId == quarto || editorLangId == markdown || activeCustomEditorId == 'quarto.visualEditor'`) and `quarto.convertToQmd` ("Convert to .qmd", visible when `resourceExtname == .ipynb`) — added in [quarto-dev/quarto#955](https://github.com/quarto-dev/quarto/pull/955), shipped in **1.132.0** (2026-05-05) per `apps/vscode/CHANGELOG.md`. This flips the framing from Session 61's grill-me (which treated this gap as possibly novel/differentiating, by analogy with image-paste and graphviz) — **this is parity catch-up, not a differentiator**, consistent with most of this project's other shipped features.
- **Posit's documented process** (from the PR's own description, not their code): (1) save the document first, (2) check whether the conversion would overwrite an existing file and **prompt with a modal dialog** if so, (3) run `quarto convert`, (4) tidy up the raw CLI error before surfacing it, (5) open the converted document. This independently corroborates §0.1's own finding that the bare CLI's silent-overwrite behavior needs an adapter-level guard — Posit's own team apparently reached the same conclusion (inferred from their behavior, not a documented CLI guarantee).
- Their later 1.134.0 CHANGELOG entry notes a Positron-specific "Export" command superseding `quarto.convertToQmd` in that one host — irrelevant here (plain VS Code, not Positron); the two commands as described above remain current for a standard VS Code install.
- `quarto.org/docs/cli/convert.html` documents the CLI exactly as found in §0.1; the docs page itself does not state the default-output-naming or overwrite behavior in prose (only implied by examples) — this plan's own firsthand verification (§0.1) is the authoritative source for those two facts, not the public docs page.

---

## 1. Executive summary (TL;DR)

Add a **"Convert Notebook"** command (name/count pending §8 Q1) that:

1. Resolves the active document — either a `.qmd` in a text editor or a `.ipynb` in a notebook editor (§0.3's `activeTextEditor`/`activeNotebookEditor` split) — and infers the conversion direction from its extension.
2. Saves it first if dirty (mirrors `render.ts`/`preview.ts`'s existing `isDirty` → `save()` convention, §0.2).
3. Derives the output path (same directory, swapped extension — verified §0.1) and, if it already exists, asks for confirmation via a modal `showWarningMessage` (the bare CLI silently overwrites — §0.1/§0.4 — so the adapter must guard this itself; this project's first modal prompt).
4. Spawns `quarto convert <input> --output <derived-path>`, streaming to a dedicated Output channel (mirrors `render-project.ts`/`create-project.ts`).
5. On success, opens the result: `showTextDocument` for a `.qmd` output, or `openNotebookDocument`+`showNotebookDocument` for a `.ipynb` output (§0.3).

Architecturally this is the smallest CLI-spawning feature shipped yet: no prompts on the happy path (operates on the active document, like `render`/`renderProject`), one pure arg-builder module, one adapter module, no vendored asset, no `package.json` `menus` addition (if §8 Q1 resolves to the single-command recommendation). One session, one vertical slice.

---

## 2. Scope

**In scope (v1):**
- Convert the ACTIVE document only (no file picker) — matches `render`/`renderProject`'s zero-prompt-when-operating-on-the-active-file design, and Session 61's own sizing ("closer to `quarto.renderProject`'s size... no prompts if operating on the active file", CHANGELOG: notebook .ipynb conversion, Session 63`).
- Both directions (`.qmd`→`.ipynb` and `.ipynb`→`.qmd`) — Session 61's explicit decision (CHANGELOG: notebook .ipynb conversion, Session 63`: "Scope: both directions... in one session").
- Overwrite confirmation (modal) when the derived output path already exists.
- Auto-save the active document first if dirty (inherits `render.ts`/`preview.ts`'s existing convention, not a new risk).
- Auto-open the converted file on success.

**Out of scope (v1) — deliberate, not oversights:**
- A destination/output-path **picker** — the derived same-directory/swapped-extension path is the only v1 behavior (matches `create-project.ts`'s "caller resolves the path, no stdout parsing" shape, §0.2). A picker is a plausible v2 addition, not blocking here.
- Any UI or logic to repair the round-trip fidelity gaps found in §0.1 (injected `jupyter: python3` key, hardcoded `python3` kernelspec, `{ojs}` cells not becoming code cells) — these are the underlying CLI's own behavior; disclosing them (§6) is this plan's obligation, fixing them is not (there is nothing in our own code to fix — the gap is upstream).
- Notebook cell **execution** — remains the user's own `ms-toolsai.jupyter` install (§0.3), the same boundary already drawn for `.qmd` cell execution.
- A `quarto.convert.withIds` (or similar) setting for the CLI's `--with-ids` flag — v1 omits it (no evidence any consumer of this project needs stable cell IDs preserved across conversion); can be added later without any interface break.
- The Visual (WYSIWYG) editor — excluded project-wide (Session 43, BACKLOG: Post-Posit-comparison feature roadmap, the Visual-editor exclusion`).

---

## 3. Evidence-based inventory

### 3.1 Reuse table

| Existing symbol | File:line | Reused for |
|---|---|---|
| `resolveBinary`, `QuartoNotFound` | `src/quarto/cli.ts:23,61` | CLI resolution + the identical "Quarto not found" error branch every other feature uses |
| `isDirty` → `save()` convention | `src/features/render.ts:53-54`, `preview.ts:87-88` | The `.qmd`-direction save-before-convert step (TextDocument side) |
| `OutputChannel` create/clear/show/stream pattern | `src/features/render-project.ts:148-204`, `create-project.ts:106-155` | The spawn/stream/report shape for `runConvert` |
| Explicit-path-over-CLI-derivation ("D1 discipline") | `src/features/render-project.ts:9-13`, `create-project.ts:73` (`targetDir` resolved before spawn) | Always pass `-o <derived-path>` explicitly; never rely on the CLI's own bare-invocation default |
| `contributes.commands` `{command,title,category}` shape, no `menus` section | `package.json:93-106` | New command manifest entry (or two, §8 Q1) |
| `withStubbedQuickPick`/`withInterceptedOpenFolder`-style monkey-patch stubs | `test/integration/suite/create-project.test.ts:9-84` | Stubbing `showWarningMessage` (overwrite confirm) and intercepting the auto-open call in integration tests |
| `vscode.workspace.openNotebookDocument` + `vscode.window.showNotebookDocument` | confirmed in `@types/vscode` (§0.3) | Opening a `.ipynb` output after conversion |
| `vscode.window.activeNotebookEditor` | `@types/vscode/index.d.ts:11142` | Detecting an open `.ipynb` (notebook editor), for the `.ipynb`→`.qmd` direction |

### 3.2 Gaps table (does not exist yet; must be built)

| New symbol | File | Notes |
|---|---|---|
| `inferConvertDirection(inputPath): "toIpynb" \| "toQmd" \| null` | `src/core/convert-args.ts` (new, pure) | Extension-based direction inference |
| `deriveConvertOutputPath(inputPath, direction): string` | `src/core/convert-args.ts` | Swaps `.qmd`↔`.ipynb`, same directory/basename (verified §0.1) |
| `buildConvertArgs(inputPath, outputPath): string[]` | `src/core/convert-args.ts` | `["convert", inputPath, "--output", outputPath]` |
| `registerConvertNotebookFeature(context)` | `src/features/convert-notebook.ts` (new, adapter) | Resolves active doc (text OR notebook), save-if-dirty, overwrite-confirm, spawn, open result |
| One (or two, §8 Q1) `contributes.commands` entries | `package.json` | `quarto.convertNotebook` (or `quarto.convertToIpynb`/`quarto.convertToQmd`) |
| `test/unit/convert-args.test.ts` | new | Strict-TDD unit coverage for the three pure functions above |
| `test/integration/suite/convert-notebook.test.ts` | new | Real-CLI round-trip in an OS temp dir (mkdtemp pattern, per `create-project.test.ts`), overwrite-confirm stubbing, open-result interception |

---

## 4. Interface contracts

### `src/core/convert-args.ts` (pure, no `vscode` import — architecture guardrail §3.3)

```ts
export type ConvertDirection = "toIpynb" | "toQmd";

/** Infers direction from the input's extension; `null` if neither .qmd nor .ipynb. */
export function inferConvertDirection(inputPath: string): ConvertDirection | null;

/**
 * Derives the output path Quarto's own default naming would produce (verified
 * firsthand, §0.1: same directory, same basename, swapped extension) — computed
 * by us, then passed EXPLICITLY via --output (never a bare invocation relying
 * on the CLI's own implicit default, mirroring this project's existing D1
 * discipline, §0.2).
 */
export function deriveConvertOutputPath(inputPath: string, direction: ConvertDirection): string;

/** Builds the argv for `quarto convert <inputPath> --output <outputPath>`. */
export function buildConvertArgs(inputPath: string, outputPath: string): string[];
```

### `src/features/convert-notebook.ts` (thin adapter)

```ts
export function registerConvertNotebookFeature(context: vscode.ExtensionContext): void;
```

`convertActiveDocument(channel)`:
1. Resolve the active source: `vscode.window.activeTextEditor` with `languageId === "quarto"`, **or** `vscode.window.activeNotebookEditor?.notebook` with `notebookType === "jupyter-notebook"` (§0.3 — these are mutually exclusive VS Code concepts; check both). Neither present → `showErrorMessage("Quarto: open a .qmd or .ipynb document to convert it.")`, return.
2. `inferConvertDirection(uri.fsPath)` — should always succeed given step 1's gating, but keeps the pure function honestly total (`null` is unreachable here, not asserted away).
3. If dirty, `await document.save()` (works identically for `TextDocument` and `NotebookDocument`, §0.2/§0.3 — both expose `isDirty`/`save()`).
4. `deriveConvertOutputPath` → check `existsSync` (Node `fs`, already imported this way in `render-project.ts:18`) → if it exists, `showWarningMessage(..., {modal: true}, "Overwrite", "Cancel")` — proceed only on "Overwrite" (§6).
5. `resolveBinary()` → the identical `QuartoNotFound` branch every other feature uses (§0.2).
6. `runConvert(channel, bin, inputPath, outputPath)` — spawn, stream to `OutputChannel`, resolve on `close`.
7. On `code === 0`: open the result — `showTextDocument` for `.qmd`, or `openNotebookDocument`+`showNotebookDocument` for `.ipynb` (direction-branched, §0.3). On non-zero: the existing `render-project.ts`-style synthesized error message (never dump raw stderr into a modal, §0.1).

---

## 5. The slice (one session, pre-declared vertical-slice contract — Gate a)

| Layer | What | Verification |
|---|---|---|
| **L1** | `src/core/convert-args.ts` + `test/unit/convert-args.test.ts` — strict TDD, pure | `npm test` |
| **L2** | `src/features/convert-notebook.ts` adapter + `extension.ts` wire + `package.json` command entry/entries (§8 Q1) | `npm run check-types` |
| **L3** | `test/integration/suite/convert-notebook.test.ts` — real CLI round-trip against an OS-temp-dir fixture (both directions), overwrite-confirm modal stubbed, open-result call intercepted (mirrors `create-project.test.ts`'s `withInterceptedOpenFolder`, §0.2) | `npm run test:integration` |

Estimated total surface: 2 new files + 1 test-unit file + 1 test-integration file + a small `package.json`/`extension.ts` diff — smaller than `create-project`'s 3-prompt slice, comparable to `render-project`'s. All three layers likely fit one session; re-verify this contract is still accurate at the executor session's own Orient before starting (Vertical Slice Sessions gate (a)).

**DONE looks like:**
- Both directions convert a real fixture via the real installed CLI inside the integration suite (not just unit-level argv assertions).
- Overwrite confirmation is exercised (both "Overwrite" and "Cancel" paths) against a real pre-existing output file.
- The converted file opens via the correct API for its kind (`showTextDocument` vs. `showNotebookDocument`) — proven via the interception technique, not assumed.
- `npm run compile` clean; unit + integration suites green with the expected new-test-count delta; clean `.vsix` (no vendored asset expected — `vsce ls --tree` file count should be unchanged except the new `.ts` bundling into the existing `dist/extension.js`).
- `docs/POSIT-COMPARISON.md`'s relevant row (if one exists for notebook conversion — re-check at kickoff, since §0.4 reframes this as parity catch-up, not a gap Posit doesn't have) is corrected to reflect parity, following the established `~~strikethrough~~` + "SHIPPED Session N" convention.

---

## 6. Failure-mode / risk analysis

| # | Finding | Verified | Disposition |
|---|---|---|---|
| 1 | Bare `quarto convert` **silently overwrites** an existing output file (§0.1) | Firsthand, this session | **Must guard**: adapter checks `existsSync` before spawning, modal-confirms if so (§4 step 4) — independently corroborated by Posit's own documented process (§0.4) |
| 2 | Round-trip **injects `jupyter: python3`** into front matter that didn't have it | Firsthand, this session | Disclosed limitation, not fixed — upstream CLI behavior, out of this project's control |
| 3 | Notebook `kernelspec` is **hardcoded to Python 3** regardless of the source `.qmd`'s actual engine (r/julia) | Firsthand, this session (tested with an `{r}` cell) | Disclosed limitation — a converted R-cell notebook would need its kernel manually corrected before real Jupyter execution; not fixable from our side (upstream CLI output) |
| 4 | **`{ojs}` cells do not become notebook code cells** — swallowed as literal markdown text | Firsthand, this session | Disclosed limitation — OJS has no Jupyter-kernel equivalent; expected, not a bug in our adapter |
| 5 | Auto-save-if-dirty on an **untitled** document triggers VS Code's native Save-As dialog; this project's existing `render.ts`/`preview.ts` already accept this behavior with no special `isUntitled` handling | Read firsthand, `render.ts:53-54` | **Not a new risk** — this feature inherits the identical, already-shipped convention. Not re-litigated here; if a future session wants to harden it, that hardening applies equally to `render`/`preview`, not just this feature |
| 6 | `.ipynb` is a **`NotebookDocument`/`NotebookEditor`**, never a `TextDocument`/`TextEditor` — a naive `activeTextEditor`-only check would miss every open notebook | Confirmed directly in `@types/vscode`, this session (§0.3) | Designed around from the start (§4 step 1) — flagging here so the executor doesn't rediscover it mid-implementation |
| 7 | Every `quarto convert` CLI error path dumps a raw Deno stack trace to stderr | Firsthand, this session | Adapter must synthesize its own error message (mirrors `render-project.ts`'s convention) — never surface the raw channel text in a modal `showErrorMessage` |
| 8 | `-o` into a non-existent parent directory errors (no auto-`mkdir`) | Firsthand, this session | Not reachable in v1 (output is always same-directory as input, which exists by construction) — noted for if a v2 picker is added |

---

## 7. Alternatives considered (rejected for v1)

- **Rely on the bare CLI's implicit default-output naming** (omit `-o` entirely) — rejected: would require parsing an undocumented `"Converted to X"` stdout string to learn the actual output path for the "open it" step, adding a fragile dependency on CLI wording that could change across versions. Passing `-o` with our own pre-derived path (verified firsthand, §0.1) is simpler and matches `create-project.ts`'s "caller already knows the path" shape (§0.2) rather than `render-project.ts`'s "must parse stdout" shape (which exists there only because a project's render output isn't cheaply precomputable).
- **A destination/output-path picker (`showSaveDialog`) for v1** — rejected: adds a prompt to what Session 61 explicitly sized as a zero-prompt, active-document-only feature (CHANGELOG: notebook .ipynb conversion, Session 63`); the same-directory/swapped-extension default (matching what the bare CLI would itself produce) is simpler and sufficient for v1. Candidate v2 addition, not blocking.
- **Building any fidelity-repair logic for the kernelspec/OJS/round-trip gaps found in §0.1/§6** — rejected: these are the underlying `quarto convert` CLI's own output; "fixing" them would mean post-processing the generated `.ipynb`/`.qmd` ourselves, a materially larger and riskier scope than this plan's own sizing, with no operator ask for it. Disclosure (§6), not repair, is this plan's obligation.

---

## 8. Open questions for the operator (resolve at implementation kickoff)

**Q1 — one unified command vs. two direction-specific commands (Posit's own precedent, §0.4).**
- **Option A — one `quarto.convertNotebook` command, runtime direction detection** (this plan's primary recommendation): matches this project's existing convention of zero `contributes.menus` and every command always visible in the Palette with adapter-side applicability checks (`render.ts:45-50`'s pattern, §0.2). Simplest manifest diff (one command entry), no new contribution section.
- **Option B — two commands, `quarto.convertToIpynb`/`quarto.convertToQmd`, each `when`-gated in the Command Palette** (exactly mirroring Posit's own shipped UX and command IDs, §0.4) — clearer per-command titles/discoverability, but requires this project's **first** `contributes.menus.commandPalette` section (a new manifest surface, not just a new command). Users coming from Posit's extension would find identically-named commands.
- **Recommend Option A** for v1 (smaller manifest surface, consistent with existing house style); Option B is a legitimate, low-risk alternative if the operator values exact Posit-naming familiarity or per-direction Palette filtering. Not decided here.

**Q2 — command/category naming.** If Option A: recommend title **"Convert Notebook"**, category `"Quarto"` (matching this project's existing terse-title + category convention, `package.json:93-106`). If Option B: recommend matching Posit's exact titles verbatim ("Convert to .ipynb" / "Convert to .qmd") — titles are short descriptive strings, not copyrightable content, and matching them aids users' muscle memory. Not decided here.

**Q3 — `--with-ids` flag.** Omit for v1 (no evidence any current feature in this project needs stable cell IDs preserved across a conversion round-trip) — low-stakes, reversible later without an interface break. Flagging rather than silently deciding, since it's operator-facing CLI behavior.

**Q4 — `docs/POSIT-COMPARISON.md` already has this row (`docs/POSIT-COMPARISON.md:311-316`), and its *Notes* text is now stale.** Confirmed this session, not deferred: the row already correctly says *Ours:* "Not implemented" and *Posit's:* "Present — 'Convert to `.ipynb`' and 'Convert to `.qmd`' commands (v1.132.0)" — matching §0.4's independent research exactly (good cross-validation). But its **Notes** line reads *"A sizeable capability we don't attempt; would need notebook-renderer/serializer work well beyond our current single-file `.qmd` scope"* — this is now known-wrong per §0.3: **zero notebook-renderer/serializer work is needed** (VS Code's own built-in `ipynb` extension already provides that); the actual scope is a thin CLI-spawning adapter, comparable in size to `render`/`createProject`. Not fixed in this planning session (this project's established convention is that `docs/POSIT-COMPARISON.md` gets corrected at the IMPLEMENTATION session that closes a gap, per Sessions 45/47/49–51/52/53/56/58 — a planning session doesn't pre-empt that). **Flagging precisely for the executor session**, not deferring the verification (the fact is already established here): when this ships, correct the *Notes* line, not just *Ours*, following the `~~strikethrough~~` + "SHIPPED Session N" convention.

---

## 9. Quick reference

- CLI invocation this plan settles on: `quarto convert <inputPath> --output <derivedOutputPath>` (direction inferred by us from `inputPath`'s extension, never a bare invocation).
- New files: `src/core/convert-args.ts`, `src/features/convert-notebook.ts`, `test/unit/convert-args.test.ts`, `test/integration/suite/convert-notebook.test.ts`.
- Manifest: 1 (Option A) or 2 (Option B) new `contributes.commands` entries; Option B additionally needs a first-ever `contributes.menus.commandPalette` section.
- Zero vendored assets; zero `.vsix` file-count impact beyond the new `.ts` bundling into `dist/extension.js`.
- Notebook-execution remains explicitly out of scope — the user's own `ms-toolsai.jupyter` install, never this extension's responsibility.
