# Security Audit Posture

*Last reviewed: 2026-06-28 (Session 13). Re-check on any `devDependencies` change or before each release.*

## Decision

**`npm audit` reports 7 vulnerabilities (4 moderate, 2 high, 1 critical). All 7 are accepted as dev-only.** They live exclusively in build/test tooling (`devDependencies`), do **not** ship in the published extension, and are not reachable in this project's headless one-shot build/test usage. No fix is applied because the only available fix (`npm audit fix --force`) makes breaking toolchain changes (including a mocha **downgrade**) for **zero end-user benefit**.

Re-check command:

```bash
npm audit            # informational; exits 0 here regardless of findings
npm audit --json     # machine-readable breakdown
```

## Why none of these ship (verified four ways)

The published `.vsix` contains only the esbuild **bundle** plus static assets — never `node_modules`:

1. **No runtime dependencies.** `package.json` `"dependencies": {}` is empty (everything is in `devDependencies`).
2. **`src/` imports none of the vulnerable packages.** `grep -rnE "esbuild|vite|vitest|mocha|serialize-javascript" src/` → no matches.
3. **The shipped bundle is clean.** `dist/extension.js` (~46 KB, esbuild bundle of `src/extension.ts` with `vscode` external) contains none of their names.
4. **The package ships no `node_modules`.** `vsce ls` lists exactly: `package.json`, `language-configuration.json`, `README.md`, `NOTICE`, `LICENSE`, `syntaxes/quarto.tmLanguage.json`, `media/icon.png`, `dist/extension.js`.

Therefore every advisory below affects only the local developer's build/test machine, not any user who installs the extension.

## The 7 advisories

| Package | In tree as | Severity | Advisory (summary) | Reachable here? |
|---|---|---|---|---|
| `esbuild` ≤0.24.2 | direct devDep (the bundler) | moderate | GHSA-67mh-4wv8-2f99 — esbuild's **dev server** lets any website read responses | No — we use one-shot bundling (`npm run compile`), never `esbuild serve`. |
| `vite` ≤6.4.2 | transitive (via `vitest`) | high | dev-server path traversal / `server.fs.deny` bypass / launch-editor NTLM disclosure | No — vite is only vitest's internal engine; no vite dev server is run. |
| `vitest` ≤3.2.5 | direct devDep (unit runner) | critical | GHSA — when the **Vitest UI server** is listening, arbitrary file read/execute | No — `npm test` runs vitest headlessly; the UI server is never started. |
| `@vitest/mocker` | transitive (via `vitest`) | moderate | depends on vulnerable `vite` | No (same as vite). |
| `vite-node` | transitive (via `vitest`) | moderate | depends on vulnerable `vite` | No (same as vite). |
| `serialize-javascript` ≤7.0.4 | transitive (via `mocha`) | high | GHSA-5c6j-r48x-rmvq RCE / GHSA-qj8w-gfj5-8c6v CPU-exhaustion DoS | No — used by mocha to serialize parallel-run results; input is our own trusted test suite. |
| `mocha` | direct devDep (integration runner) | moderate | depends on vulnerable `serialize-javascript` | No (same as serialize-javascript). |

All severities and dependency paths confirmed via `npm audit --json` on 2026-06-28.

## Why not `npm audit fix`

- **Plain `npm audit fix` (semver-safe) fixes 0 of 7.** Confirmed with `npm audit fix --dry-run` — every remediation is gated behind `--force`.
- **`npm audit fix --force` is breaking and net-negative here.** It would install `esbuild@0.28.1` (major bump from the declared `^0.24.2`), require `vitest@3.x` (major bump from `^2.1.8`), and **downgrade** `mocha` from the declared `^10.8.2` to `8.1.3`. These are the three pillars of the verified build/test pipeline (190 unit + 42 integration + clean `.vsix`). Forcing them risks the pipeline to silence advisories that never reach a user.
- **An `overrides` pin** to a patched `serialize-javascript` was considered and rejected for v1: it is a hack against mocha's pinned dependency, risks mocha runtime breakage, and gains nothing because the path is unreachable.

## When to revisit

- Add this check to any release: re-run `npm audit --json` and confirm the set is unchanged and still entirely `devDependencies`.
- **If the project ever adds a runtime `dependency`** (currently none), audit posture must be re-evaluated immediately — a vulnerable runtime dep WOULD ship in the bundle.
- A deliberate, separately-verified toolchain upgrade (esbuild 0.24→0.28, vitest 2→3) is a reasonable **future** maintenance session — it clears these advisories the right way (bump + re-run the full matrix), as opposed to `--force`. Tracked in `BACKLOG.md` (Polish / deferred).
