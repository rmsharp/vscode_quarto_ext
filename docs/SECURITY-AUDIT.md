# Security Audit Posture

*Last reviewed: 2026-07-18 (Session 108). Re-check on any `devDependencies` change or before each release.*

## Decision

**`npm audit` now reports 0 vulnerabilities.** The 7 dev-only advisories previously accepted here (4 moderate, 2 high, 1 critical — see the history table below) were cleared in Session 108 (`BACKLOG:176`) by a **deliberate, separately-verified dev-toolchain upgrade** — *not* `npm audit fix --force` (which downgrades mocha to 8.1.3 for zero end-user benefit; see "Why not `npm audit fix`"). The three changes:

| Change | From → To | Clears |
|---|---|---|
| `esbuild` (direct devDep, the bundler) | `^0.24.2` → `^0.28.1` | the `esbuild` dev-server advisory |
| `vitest` (direct devDep, unit runner) | `^2.1.8` → `^3.2.7` | `vitest` (critical), `vite`, `vite-node`, `@vitest/mocker` — vitest 3.2.7 resolves `vite` to a patched `7.3.6` and pins `vite-node@3.2.4`, both above their vulnerable ranges |
| `overrides: { "serialize-javascript": "^7.0.7" }` | (new) → forces `7.0.7` | `serialize-javascript` (high) **and** `mocha` (whose only vuln is that transitive dep) |

`mocha` was **kept at `^10.8.2`**: even the latest mocha (11.7.6) still pins `serialize-javascript ^6.0.2`, so bumping mocha cannot clear the advisory — only the `overrides` pin does — and a major mocha bump would add breaking-change risk to the integration runner for no audit benefit.

Verified via the full matrix (Session 108): `check-types` clean, **834 unit** (vitest 3.2.7, count unchanged), **333 integration** (a real VS Code Extension Development Host loading the actual esbuild-0.28.1 bundle), clean **43-file `.vsix`**, and `npm audit --json` → `{moderate:0, high:0, critical:0, total:0}`.

Re-check command:

```bash
npm audit            # informational
npm audit --json     # machine-readable breakdown — expect total: 0
```

### Notes on the fix choices

- **`serialize-javascript@7.0.7` requires Node ≥20.** This is a **dev-only** dependency (never shipped — see below), exercised only by the local build/test toolchain, which runs on Node 22 here. It is *never executed at runtime* regardless: mocha pulls `serialize-javascript` only for its **parallel** buffered reporter, and this project runs mocha single-process (no `--parallel`, no `.mocharc`). The `overrides` pin therefore clears the advisory while being inert to mocha's actual execution — confirmed by the 333-test integration suite passing unchanged.
- **The `overrides` pin crosses mocha's declared `^6.0.2` range.** That is intentional and safe here for the reason above (the code path is never invoked); if a future change enables mocha parallel mode, re-confirm `serialize-javascript@7.x` compatibility.
- **Reproducibility:** `package-lock.json` pins the resolved `serialize-javascript@7.0.7` in the tree (it does not re-store the `overrides` block itself — npm 11 keeps that only in `package.json`), so `npm ci` reproduces the patched version directly from the lockfile and `npm install` re-applies the override from `package.json`. Verified with `npm ci --dry-run` (clean).

## Why none of these ship — the standing invariant (re-verified four ways, Session 108)

The published `.vsix` contains only the esbuild **bundle** plus static assets — never `node_modules`. This invariant is what made the advisories dev-only in the first place, and it still holds after the upgrade:

1. **No runtime dependencies.** `package.json` `"dependencies": {}` is empty (everything is in `devDependencies`; the new `overrides` key adds no runtime dep).
2. **`src/` imports none of the vulnerable packages.** `grep -rnE "esbuild|vite|vitest|mocha|serialize-javascript" src/` → no matches.
3. **The shipped bundle is clean.** `dist/extension.js` (the esbuild bundle of `src/extension.ts` with `vscode` external) contains none of their names — re-verified with a whole-token grep (`grep -aoE "\b(esbuild|vitest|vite-node|@vitest|serialize-javascript)\b"` → 0 matches).
4. **The package ships no `node_modules`.** `vsce ls` → 0 `node_modules` entries; a 43-file package (source `dist/extension.js`, grammars, snippets, walkthrough media, and the vendored KaTeX/Mermaid/Graphviz webview assets).

Therefore every advisory below affected only the local developer's build/test machine, never any user who installs the extension — which is why they were safely deferrable until this deliberate upgrade.

## History — the 7 advisories that were present (through Session 107) and how each was cleared

| Package | In tree as | Severity | Advisory (summary) | Cleared by |
|---|---|---|---|---|
| `esbuild` ≤0.24.2 | direct devDep (the bundler) | moderate | GHSA-67mh-4wv8-2f99 — esbuild's **dev server** lets any website read responses | bump to `esbuild@0.28.1` |
| `vite` ≤6.4.2 | transitive (via `vitest`) | high | GHSA-4w7w-66w2-5vf9 path traversal / GHSA-fx2h-pf6j-xcff `server.fs.deny` bypass / GHSA-v6wh-96g9-6wx3 launch-editor NTLM disclosure | vitest 3.2.7 → `vite@7.3.6` |
| `vitest` ≤3.2.5 | direct devDep (unit runner) | critical | GHSA-5xrq-8626-4rwp — when the **Vitest UI server** is listening, arbitrary file read/execute (`<3.2.6`) | bump to `vitest@3.2.7` |
| `@vitest/mocker` ≤3.0.0-beta.4 | transitive (via `vitest`) | moderate | depends on vulnerable `vite` | vitest 3.2.7 → `@vitest/mocker@3.2.7` |
| `vite-node` ≤2.2.0-beta.2 | transitive (via `vitest`) | moderate | depends on vulnerable `vite` | vitest 3.2.7 → `vite-node@3.2.4` |
| `serialize-javascript` ≤7.0.4 | transitive (via `mocha`) | high | GHSA-5c6j-r48x-rmvq RCE (`≤7.0.2`) / GHSA-qj8w-gfj5-8c6v CPU-exhaustion DoS (`≥5.0.0 <7.0.5`) | `overrides` pin → `7.0.7` |
| `mocha` 8.2.0–12.0.0-beta-2 | direct devDep (integration runner) | moderate | depends on vulnerable `serialize-javascript` | the same `overrides` pin (mocha kept at `^10.8.2`) |

All severities, dependency paths, and patched ranges confirmed via `npm audit --json` on 2026-07-18 (and originally on 2026-06-28, Session 13).

## Why not `npm audit fix --force` (retained rationale)

The upgrade above was done by hand precisely because the automated fix is net-negative:

- **Plain `npm audit fix` (semver-safe) fixed 0 of 7.** Every remediation was gated behind `--force`.
- **`npm audit fix --force` is breaking and would have been net-negative.** Its resolution **downgrades** `mocha` from the declared `^10.8.2` to `8.1.3` (an older mocha with an even older `serialize-javascript`), alongside the same esbuild/vitest major bumps — trading a working, current integration runner for a downgrade, to silence advisories that never reach a user. The deliberate pass keeps mocha current and pins `serialize-javascript` forward instead.

## When to revisit

- **Add this check to any release:** re-run `npm audit --json` and confirm `total: 0` and that the standing four-way "none ship" invariant still holds.
- **If the project ever adds a runtime `dependency`** (currently none), audit posture must be re-evaluated immediately — a vulnerable runtime dep WOULD ship in the bundle.
- **Watch for new advisories on the upgraded pins.** `vite@7.x`, `esbuild@0.28.x`, and `serialize-javascript@7.x` are clean as of 2026-07-18; a future advisory on any of them re-opens this file. The `serialize-javascript` `overrides` pin should track its patched line (`^7.0.7`); revisit if mocha ever adopts `serialize-javascript@7.x` natively (the pin can then be dropped).
