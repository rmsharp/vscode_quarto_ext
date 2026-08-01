import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * The regression guard on the packaged-contents gate itself
 * (CHANGELOG: the scratchpad/ .vsix packaging leak, Session 174).
 *
 * The gap this pins closed: `.vscodeignore` is a DENYLIST, so the packaged file
 * set is allow-by-default — anything new at the repo root ships unless someone
 * remembers to exclude it, and `vsce package` reports a clean exit either way.
 * It went wrong twice: `tsconfig.unit.json` shipped inside the .vsix the day it
 * was added (S173), and the untracked `scratchpad/` directory shipped from
 * ~2026-07-21 until this session — 3043 of the artifact's 3085 files, 84.68 MB
 * uncompressed, against a real extension of 42 files.
 *
 * ⚠ **This file is the only thing that keeps the gate reachable.** A checker
 * nothing runs is the same hole with extra files, so the load-bearing assertion
 * here is not that `check-package.js` exists — it is that `vscode:prepublish`
 * invokes it. That single edge is what puts the gate on `npm run package` AND
 * on a bare `npx vsce package`, without either naming it.
 *
 * These are declarative-config assertions in the `type-check-gate.test.ts` /
 * `package-activation.test.ts` shape (direct JSON import, no `vscode` API), the
 * cheap always-run form of coverage for wiring no behavioural test can observe.
 * The gate's real work — running `vsce ls` and reading the answer — deliberately
 * does NOT run here: it costs ~7s against a 2s unit suite, and it belongs on the
 * release path, which is exactly what these pins assert it is on.
 */
describe("the packaged-contents gate", () => {
  const scripts: Record<string, string> = packageJson.scripts;

  /**
   * Every command an `npm run <name>` transitively executes, `<name>` included.
   *
   * Adapted from `type-check-gate.test.ts` with ONE addition: `vsce package`
   * and `vsce publish` implicitly run the `vscode:prepublish` script, an edge
   * vsce walks itself and that no `npm run` appears in. MEASURED at Session 174
   * by pointing `vscode:prepublish` at a marker-writing probe: `vsce package`
   * ran it (1 marker), `vsce ls` did NOT (0 markers) — which is both why this
   * edge belongs in the traversal and why the gate can safely shell out to
   * `vsce ls` from inside `vscode:prepublish` without recursing.
   *
   * As in its predecessor, the assertions are about REACHABILITY, not spelling.
   */
  function commandsReachableFrom(name: string): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    const visit = (script: string) => {
      if (seen.has(script) || scripts[script] === undefined) return;
      seen.add(script);
      out.push(scripts[script]);
      for (const match of scripts[script].matchAll(/npm run ([\w:-]+)/g)) {
        visit(match[1]);
      }
      if (/vsce (package|publish)/.test(scripts[script])) {
        visit("vscode:prepublish");
      }
    };
    visit(name);
    return out;
  }

  const reachesGate = (entry: string): boolean =>
    commandsReachableFrom(entry).some((command) =>
      command.includes("check-package"),
    );

  it("vscode:prepublish reaches the gate — the edge vsce itself walks", () => {
    // The load-bearing pin. Wired here rather than only in `package`, a bare
    // `npx vsce package` — which never touches our `package` script — is still
    // gated. Nothing else in this repo can make that true.
    expect(
      reachesGate("vscode:prepublish"),
      `commands reachable from vscode:prepublish: ${JSON.stringify(
        commandsReachableFrom("vscode:prepublish"),
      )}`,
    ).toBe(true);
  });

  it("every packaging path reaches the gate", () => {
    for (const entry of ["package", "vscode:prepublish"]) {
      expect(reachesGate(entry), `${entry} does not reach the gate`).toBe(true);
    }
  });

  it("runs the gate AFTER compile, so dist/ exists when presence is checked", () => {
    // The gate asserts every ALLOWED_ROOTS entry is actually PRESENT, and
    // `dist/` only exists once `bundle` has written it. Ordering is therefore
    // load-bearing in a way the reachability pins above cannot see: a gate that
    // ran first would red on a clean checkout for the wrong reason.
    const prepublish = scripts["vscode:prepublish"];
    expect(prepublish.indexOf("compile")).toBeGreaterThanOrEqual(0);
    expect(prepublish.indexOf("check-package")).toBeGreaterThan(
      prepublish.indexOf("compile"),
    );
  });

  it("the script the wiring names is actually on disk", () => {
    // Cheap catch for a rename that leaves the npm wiring intact: `npm run`
    // would fail at release time with a bare "cannot find module", long after
    // the change that broke it.
    const command = scripts["check-package"];
    const file = command.replace(/^node\s+/, "").trim();
    expect(existsSync(resolve(root, file)), `${file} does not exist`).toBe(true);
  });
});
