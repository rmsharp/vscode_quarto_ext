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

### Additional Phase 0 steps

(none)

### Additional task-to-workstream mappings

(none)

### Project-specific Learnings

| # | Learning | When to apply |
|---|----------|---------------|
| 1 | **Posit's official Quarto VS Code extension is AGPL-3.0** (extension, LSP, Visual Editor, Panmirror — confirmed twice against the live `quarto-dev/quarto` repo). It is **look-but-don't-copy** reference only. Build on MIT upstreams instead: `microsoft/vscode-markdown-tm-grammar`, `wooorm/markdown-tm-language`, `microsoft/vscode-markdown-languageservice`, and the MIT Quarto **CLI** (shelled out at runtime). | Before reusing/adapting any Quarto-extension code, or choosing a grammar/LSP base. The MIT boundary in CONTEXT.md is non-negotiable. |
| 2 | **Language-support architecture is resolved: ship Tier A (TextMate grammar) → build to Tier B (in-process `register*Provider`) → defer Tier C (out-of-process LSP).** The guardrail that makes this safe: the intelligence core is a **`vscode`-free pure-TS library**; the extension is a thin adapter. This makes B→C migration cheap AND makes the core unit-testable headlessly. See `docs/planning/2026-06-27-extension-architecture-plan.md` §3. | Any language-feature work. Keep parsing/analysis logic out of `vscode.*` imports. |
| 3 | **No `code` CLI on PATH in this environment.** Runtime verification of the extension is a manual **F5** (Extension Development Host) step — it can't be driven headlessly. Pure-`core/` logic is unit-tested with `npm test` (no VS Code); `@vscode/test-electron` downloads its own VS Code for integration tests (no `code` CLI needed — verify in Phase 1). | Phase 3E close-out for any implementation session: state F5 results explicitly; never claim build-clean == runtime-clean. |
| 4 | **Verified Quarto CLI behaviors (trust these):** `quarto preview <f>` prints `Browse at http://localhost:<port>/` (parse this for the preview webview); `--timeout` does NOT reliably self-exit (only on no active clients → own the process lifecycle, kill on close); code-cell render needs Jupyter (`nbformat`) in the active Python env. | Phases 3–5 (render/preview/execution). Re-verify the `Browse at` line on Quarto CLI upgrades. |

### Project-specific Failure Modes

(none)
