import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";
import unitTsconfig from "../../tsconfig.unit.json";

/**
 * The regression guard on the `test/unit` type-check gate itself (CHANGELOG: the
 * test/unit type-check gate, Session 173).
 *
 * The gap this pins closed: `tsconfig.json` includes only `["src"]` and
 * `tsconfig.test.json` only `test/integration/**`, `test/lsp/**` and
 * `test/oracle/**`, so no npm script ever type-checked `test/unit` — and vitest
 * transpiles with esbuild WITHOUT checking types, so a unit test could ship as a
 * TypeScript error that every green run reported as passing. S162 shipped exactly
 * that: an `L1` pin calling `namesFor("none")` against a helper whose hand-copied
 * union lacked `"none"` — a real TS2345 that `npm test` called green and
 * `npm run check-types` structurally could not see.
 *
 * ⚠ **This file is the only thing that keeps the gate reachable.** A project that
 * type-checks `test/unit` but that nothing runs is the same hole with extra files
 * — so the load-bearing assertion here is not that `tsconfig.unit.json` exists,
 * it is that `check-types` invokes it and that `compile` invokes `check-types`.
 * That chain is what puts the gate on `package`, `vscode:prepublish`,
 * `test:integration` and `test:lsp` without any of them naming it.
 *
 * These are declarative-config assertions in the `package-activation.test.ts`
 * shape (direct JSON import, no `vscode` API), which is the cheap always-run form
 * of coverage for wiring that no behavioural test can observe.
 */
describe("the test/unit type-check gate", () => {
  describe("tsconfig.unit.json", () => {
    it("covers test/unit — the file set nothing else type-checks", () => {
      // Deliberately a property assertion, not a string equality: any glob that
      // reaches the directory satisfies the gate.
      const coversUnitDir = unitTsconfig.include.some((pattern) =>
        pattern.startsWith("test/unit/"),
      );
      expect(coversUnitDir, `include was ${JSON.stringify(unitTsconfig.include)}`)
        .toBe(true);
    });

    it("inherits the base project, so strictness has ONE definition", () => {
      // Without this, a future error could be "fixed" by quietly relaxing
      // `strict`/`noImplicitAny` here while `src` stays strict — the gate would
      // still be green and would no longer be checking the same language.
      expect(unitTsconfig.extends).toBe("./tsconfig.json");
    });

    it("never emits, so it cannot collide with the out/ tree the runners execute", () => {
      // `tsconfig.test.json` sets `noEmit: false` and emits to `out/`, which
      // `test:integration` and `test:lsp` then run. This project must stay a pure
      // check: `test/unit` belongs to vitest, and a stray `out/test/unit/*.js`
      // would be a second, stale copy of every unit test.
      expect(unitTsconfig.compilerOptions.noEmit).toBe(true);
    });
  });

  describe("npm wiring — the part that makes the gate unavoidable", () => {
    const scripts: Record<string, string> = packageJson.scripts;

    /**
     * Every command an `npm run <name>` transitively executes, `<name>` included.
     *
     * The assertions below are about REACHABILITY, not spelling: a gate wired as
     * `tsc --noEmit && tsc -p tsconfig.unit.json`, as `npm run check-types:unit`,
     * or through a third script one level deeper are the same gate, and a pin that
     * only matched one of those spellings would red on a harmless rename while
     * staying green if the chain were cut somewhere it did not look.
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
      };
      visit(name);
      return out;
    }

    it("check-types reaches the unit project", () => {
      const commands = commandsReachableFrom("check-types");
      expect(
        commands.some((command) => command.includes("tsconfig.unit.json")),
        `commands reachable from check-types: ${JSON.stringify(commands)}`,
      ).toBe(true);
    });

    it("check-types still reaches the src project too", () => {
      // The unit project pulls src in transitively, but only the 45 files the unit
      // tests actually import — it is not a substitute for the whole-src check.
      const commands = commandsReachableFrom("check-types");
      expect(commands.some((command) => command.includes("tsc --noEmit"))).toBe(
        true,
      );
    });

    it("every release and integration path reaches check-types", () => {
      // None of these name the gate. They reach it through `compile`, which is the
      // single edge that has to hold for the gate to be unavoidable.
      for (const entry of [
        "compile",
        "package",
        "vscode:prepublish",
        "test:integration",
        "test:lsp",
      ]) {
        expect(
          commandsReachableFrom(entry).some((command) =>
            command.includes("tsconfig.unit.json"),
          ),
          `${entry} does not reach the unit type-check`,
        ).toBe(true);
      }
    });
  });
});
