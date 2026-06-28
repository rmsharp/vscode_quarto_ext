# CLAUDE.md

## SESSION PROTOCOL — FOLLOW BEFORE DOING ANYTHING

Read and follow `SESSION_RUNNER.md` step by step. It is your operating procedure for every session. It tells you what to read, when to stop, and how to close out.

**Three rules you will be tempted to violate:**
1. **Orient first** — Read SAFEGUARDS.md → SESSION_NOTES.md → run `methodology_dashboard.py` → git status → report findings → WAIT FOR THE USER TO SPEAK
2. **1 and done** — One deliverable per session. When it's complete, close out. Do not start the next thing.
3. **Auto-close** — When done: evaluate previous handoff, self-assess, document learnings, write handoff notes, commit, report, STOP.

`SESSION_RUNNER.md` documents known failure modes and their countermeasures. The protocol compensates for documented tendencies to skip orientation, skip close-out, and continue past the deliverable.

---

## Purpose

This is the `vscode-quarto-ext` project: an **MIT-licensed** Visual Studio Code extension that reimplements many — ideally most — of the features of Posit's official Quarto extension for VS Code (render, live preview, `.qmd` language support, code-cell execution, YAML/citation/cross-reference completion, snippets, and related authoring aids). The primary deliverable is a packaged, installable VS Code extension (`.vsix`) plus its source.

The goal is feature parity *reimplemented independently under MIT licensing*, not a fork.

---

## Tech Stack

*Not yet scaffolded — the stack below is the intended default, to be ratified in the first planning session.*

- TypeScript on Node.js (VS Code Extension API)
- esbuild for bundling; `@vscode/vsce` for packaging
- Depends on the **Quarto CLI** at runtime (`quarto` ≥ 1.7 is installed: 1.7.33)
- `vscode-languageclient` / LSP if a language-server architecture is chosen

---

## Build / Test / Verify

*Placeholder until the extension is scaffolded. Once it exists, the build equivalent (record in close-out, see SAFEGUARDS.md) is expected to be:*

```bash
npm run compile      # type-check + bundle
npm test             # @vscode/test-electron
npx @vscode/vsce package   # produce the .vsix (release gate)
```

For any Quarto-document fixtures the doc-build equivalent is `quarto render`.

---

## Project-Specific Methodology Adaptations

*Additions and overrides to the base methodology at `SESSION_RUNNER.md` and `SAFEGUARDS.md` (synced from the methodology repo, not project-owned). The base files govern unless explicitly overridden here.*

> **Why this file and not a synced one:** `SESSION_RUNNER.md`, `SAFEGUARDS.md`, and everything under `docs/methodology/` (including the workstream docs) are synced byte-identical from the canonical methodology repo — editing them blocks future syncs (BOOTSTRAP, "Customizations Go in CLAUDE.md, Not in Synced Files"). Every project-specific rule, including the one below, lives here.

### Mandatory development practice — strict TDD (operator directive, project-wide)

**For the entire duration of this project, all implementation and bug-fix work MUST follow strict test-driven development.** This is a hard gate, an override that strengthens the base Development-workstream guidance (which lists "Test-last" as anti-pattern #3 and already says "write the failing test first"). It is not optional and does not lapse between sessions.

- **Red → Green → Refactor, one test at a time.** Write ONE failing test for the next behavior, run it and confirm it fails *for the right reason* (RED), write the minimal code to pass (GREEN), then refactor with tests green. Repeat.
- **Vertical slices, never horizontal.** Do NOT write all tests first then all implementation — that produces tests of imagined behavior. One test → one implementation → repeat (see the `/tdd` skill, which is the operative how-to; cited in `RECOMMENDED_SKILLS.md`).
- **Test behavior through the public interface,** not implementation details, so tests survive refactors. For this project the pure `core/` library (the §3.3 guardrail) is where most logic lives and is unit-tested headlessly with `npm test` (vitest); `vscode` adapters are verified with `@vscode/test-electron` (Learning #3).
- **Scope of the gate:** anything with logic (parsers, arg-builders, indexers, providers, lifecycle/state machines). Pure declarative/config/doc edits with no logic (e.g. a `package.json` command contribution, grammar JSON) are exempt from a unit test but still require their normal verification (compile, integration registration, render).
- **Enforcement at close-out:** a session's self-assessment must state that implementation was TDD (RED shown before GREEN). A commit that adds logic with no preceding failing test is a protocol violation to flag in the handoff.

*Origin: operator directive, Session 5 (2026-06-27), after an implementation began impl-first; the operator asked that TDD be enshrined in the correct (non-synced) methodology file so it persists across sessions.*

### Additional Phase 0 steps

(none)

### Additional task-to-workstream mappings

(none)

### Project-specific Learnings

| # | Learning | When to apply |
|---|----------|---------------|
| 1 | **Posit's official Quarto VS Code extension is AGPL-3.0** (extension, LSP, Visual Editor, Panmirror — confirmed twice against the live `quarto-dev/quarto` repo). It is **look-but-don't-copy** reference only. Build on MIT upstreams instead: `microsoft/vscode-markdown-tm-grammar`, `wooorm/markdown-tm-language`, `microsoft/vscode-markdown-languageservice`, and the MIT Quarto **CLI** (shelled out at runtime). | Before reusing/adapting any Quarto-extension code, or choosing a grammar/LSP base. The MIT boundary in CONTEXT.md is non-negotiable. |
| 2 | **Language-support architecture is resolved: ship Tier A (TextMate grammar) → build to Tier B (in-process `register*Provider`) → defer Tier C (out-of-process LSP).** The guardrail that makes this safe: the intelligence core is a **`vscode`-free pure-TS library**; the extension is a thin adapter. This makes B→C migration cheap AND makes the core unit-testable headlessly. See `docs/planning/2026-06-27-extension-architecture-plan.md` §3. | Any language-feature work. Keep parsing/analysis logic out of `vscode.*` imports. |
| 3 | **Automated runtime verification WORKS here — `@vscode/test-electron` confirmed in Phase 1 (Session 2).** Despite no `code` CLI on PATH, test-electron downloads its own VS Code (v1.126.0, ~261 MB into `.vscode-test/`, gitignored) and runs integration tests **headlessly**: it activates the extension in a real host and executes commands end-to-end (Phase 1's test runs `quarto.verifyInstallation` against the real CLI, exit 0). This is **stronger than manual F5** for wiring/activation/dispatch. Manual F5 remains the only way to visually confirm notification/UI text. Pure-`core/` logic is unit-tested with `npm test` (vitest, no VS Code). | Phase 3E for any implementation session: prefer `npm run test:integration` for runtime-behavior verification; reserve manual F5 for visual/UX confirmation. Never claim build-clean == runtime-clean — but you can now usually *prove* runtime-clean automatically. |
| 4 | **Verified Quarto CLI behaviors (trust these):** `quarto --version` prints just the bare semver (`1.7.33\n`, no banner); `quarto preview <f>` prints `Browse at http://localhost:<port>/` (parse this for the preview webview); `--timeout` does NOT reliably self-exit (only on no active clients → own the process lifecycle, kill on close); code-cell render needs Jupyter (`nbformat`) in the active Python env. | Phases 3–5 (render/preview/execution). Re-verify the `Browse at` line on Quarto CLI upgrades. |
| 5 | **Phase 1 build toolchain (working — trust these).** Two compilers by design: esbuild bundles `src/extension.ts` → `dist/extension.js` (`vscode` external); a SEPARATE `tsc -p tsconfig.test.json` compiles `test/integration/**` → `out/` for test-electron to run. vitest is scoped to `test/unit/**` so it never picks up the mocha integration tests. **Gotchas caught in Phase 1:** `.vscodeignore` MUST exclude `.claude/**` and `.git/**` (else they leak into the `.vsix`); `npm run package` needs `--allow-missing-repository` and README must avoid relative links (e.g. `./LICENSE`) until a git remote + `repository` field exist. | Any session that compiles/tests/packages. When a git remote is added: drop `--allow-missing-repository`, add `repository` to package.json, and the README relative-link restriction lifts. |
| 6 | **Phase 2 grammar — base-grammar question RESOLVED by NOT forking.** `syntaxes/quarto.tmLanguage.json` (scope `text.html.quarto`) is **original work** that `include`s VS Code's built-in `text.html.markdown` **by scope-name reference** (no source copied) for prose/plain fences, and adds only the Quarto-specific rules: a `\A`-anchored YAML front-matter region (→`source.yaml`) and brace-cell rules ` ```{python|r|julia|ojs} ` (→`source.python`/`source.r`/`source.julia`/`source.js`). This beats forking `markdown-tm-language`/`vscode-markdown-tm-grammar` (nothing large to copy/attribute; markdown stays current) and is the canonical `mjbvz` injection pattern (MIT). Each cell's content is `contentName: meta.embedded.block.<lang>`, mapped to a language in `package.json` → `contributes.grammars.embeddedLanguages` (this mapping, not the grammar, is what enables bracket-match/comment-toggle inside cells). A `cell-generic` fallback scopes any other `{lang}`. **Caveat:** `source.r`/`source.julia` are NOT bundled with VS Code — those cells get the fenced + `meta.embedded.block.*` scope but only colorize if the user has the R/Julia extension installed (python/js always colorize). Attribution is in `/NOTICE` (licensing hard gate). | Any grammar/highlighting work, or adding a new cell language (add a `cell-<lang>` rule + an `embeddedLanguages` entry + a `tokenize.test.ts` assertion). |
| 7 | **Headless grammar verification works — automate token scopes, don't defer to F5.** `test/unit/tokenize.test.ts` loads the grammar into the SAME engines VS Code uses (`vscode-textmate` + `vscode-oniguruma`, both MIT devDeps) and tokenizes the fixture, asserting `meta.embedded.block.*` scopes + the discriminating cases (a plain ` ```python ` block and post-cell prose must NOT be in a cell). This is the automated equivalent of "Developer: Inspect Editor Tokens and Scopes" and catches regex bugs (back-referenced closing fence, `\A` anchor, `\b` boundaries) the structural JSON guard cannot. **Load-bearing gotcha:** in the standalone test registry, `loadGrammar` MUST return an empty stub `{scopeName, patterns: []}` for unresolved external includes (markdown/yaml/source.*), **NOT `null`** — returning null silently corrupts vscode-textmate's pattern compilation (sibling rules stop matching / reorder), which cost most of Phase 2's debugging. Real VS Code always has those grammars, so the extension itself is unaffected. **Fixture trick:** `#| eval: false` on `{python}`/`{r}`/`{julia}` cells lets `quarto render` validate the doc (exit 0) WITHOUT needing Jupyter/R/Julia kernels. | Verifying any grammar (prefer this over manual F5 for scopes — extends Learning #3; F5 remains only for theme-dependent COLOR). Writing render-clean `.qmd` fixtures (Phases 3/5). |
| 8 | **`quarto render` I/O contract (verified live 1.7.33 — extends Learning #4).** Progress, the `Output created: <path>` success marker, AND error text all go to **STDERR**; STDOUT is empty. So you CANNOT distinguish success from failure by stream — **key off the exit code** (0 = success, non-zero = failure; missing-Jupyter is exit 1 with the `nbformat` traceback verbatim on stderr). The reported output path is **relative to the input file's directory** (resolve against `dirname(file)`), and the marker line may be wrapped in **ANSI SGR escapes** (`\x1b[..m`) — strip them before parsing. Stream BOTH stdout+stderr to the Output channel; `core/render-args.ts` keeps `buildRenderArgs` + `parseOutputPath` pure/testable. | Phase 4 preview (also parses a stderr line — `Browse at`), Phase 5 execution, or any CLI-wrapper feature. Capture the real stream layout live before coding the parser. |
| 9 | **Faithful-verification trap in the test-electron host (gate d / FM #24): the host resolves a DIFFERENT Python than your interactive shell.** Phase 3's missing-Jupyter fixture (`needs-jupyter.qmd`, executable `{python}`, no `eval:false`) **fails via the CLI in this shell** (miniforge python, no `nbformat`) but **renders SUCCESSFULLY inside the downloaded VS Code host** (it resolves a Jupyter-capable python). An `assert.doesNotReject` failure-path test against it therefore passes **trivially** (a success also doesn't reject) — verifying nothing. Fix: for automated failure-path tests use an **environment-independent deterministic failure** (`render-error.qmd`: an invalid `format:` → exit 1 "Validation of YAML front matter failed" in ANY env, no kernel) and verify env-dependent degradation (missing Jupyter) **live via the CLI**. **Timing is a faithfulness signal:** the genuine failure runs in <1s; a sneaky success runs in ~4s (kernel+pandoc). | Phase 5 run-cell and any test of a degradation/error path whose trigger depends on the host environment (kernels, installed extensions, PATH). Don't trust a green "does-not-throw" test unless the failure it claims to exercise is environment-independent. |
| 10 | **Strict TDD is mandatory project-wide (operator directive, Session 5).** Every implementation/bug-fix task follows red → green → refactor, one test at a time, vertical slices (never all-tests-then-all-code). The binding statement and exact scope/exemptions are in the **§"Mandatory development practice — strict TDD"** subsection above; the `/tdd` skill is the operative how-to. | Start of any implementation/bugfix session — invoke `/tdd` and write the failing test before the code. Pure config/grammar/doc edits with no logic are exempt but still need their normal verification. |
| 11 | **`quarto preview` process-tree reaping + the deno-worker faithful-verification trap (Phase 4, verified live 1.7.33).** `quarto preview` is a **bash wrapper** (`/usr/local/bin/quarto preview …`) that spawns a long-lived **deno worker** whose cmdline reads **`…deno run … quarto.js preview …`**. Two load-bearing consequences: (a) **Killing the wrapper first REPARENTS the deno worker** (it survives, orphaned) — so spawn **`detached: true`** (the wrapper leads a process group) and signal the whole group atomically: `process.kill(-pid, "SIGTERM")` then, gated on a `process.kill(-pid, 0)` liveness probe, `"SIGKILL"`. A group outlives its leader while any member is alive, so the group signal still reaps a wrapper-died/worker-alive case. (b) **`pgrep -f "quarto preview"` matches the wrapper but NOT the deno worker** (`quarto.js preview` ≠ `quarto preview`) — so a `"quarto preview"` probe/`pkill` reports "clean" while the deno worker orphans (a gate-d trap; it bit my own capture script AND would have made the no-orphan test pass falsely). Use a fixture-scoped pattern that matches **both**: `pgrep -f "preview.*<fixture>"`. The `Browse at <url>` marker is on **STDERR** (stdout empty), ANSI-wrapped — Learning #8 extends to preview; pin the live-captured line. | Phase 5+ or any long-lived-CLI feature: spawn detached, group-kill, and write the no-orphan probe to match the real worker process, not the wrapper. Re-verify the wrapper/worker topology on a Quarto upgrade. |
| 12 | **Long-lived-process managers have check-then-act races across `await`s — and an adversarial review caught one the integration test missed (Phase 4).** The "one preview per document" guard read the sessions map, but the session was only registered **after** two awaits (`doc.save()`, `resolveBinary()` — which spawns `quarto --version`, uncached). Two rapid `quarto.preview` invocations both passed the guard and both spawned; the second's session overwrote the first in the map, so the first server was tracked by nothing and **orphaned permanently (surviving deactivate)** — defeating the whole no-orphan design. Fix: **reserve the slot synchronously in a `Set` before the first await** (try/finally to release). The single-invocation integration test was green and missed it; a 4-lens adversarial review (with adversarial verification of each finding) surfaced it + 4 lower-severity issues. Lesson: for any in-process manager keyed by an id, make check-and-claim atomic *before* the first await; and run an adversarial review over lifecycle/concurrency code — a passing happy-path test is not coverage of the race. | Any feature that tracks long-lived resources in a map/registry across async setup (Phase 5 run-cell sessions, future preview-format/port features). Reserve the key synchronously; add a concurrent-invocation regression test. |

### Project-specific Failure Modes

(none)
