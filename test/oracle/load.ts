/**
 * Loading the BUILD UNDER TEST, and quarto's own schema.
 *
 * The build is a parameter rather than a constant, which is what lets the oracle answer
 * "did this change regress anything?" with a number instead of an argument. S165 turned a
 * review finding into `pre-S165 FP 16, flawed intermediate FP 16 WITH 12 REGRESSIONS,
 * shipping FP 4` only because it could point the same corpus at three different builds.
 *
 * To replay an older commit:
 *   git archive <rev> src | tar -x -C /tmp/old
 *   QMD_ORACLE_SRC=/tmp/old/src npm run test:oracle
 *
 * The dynamic import is the whole mechanism: vitest transforms TypeScript from an
 * arbitrary absolute path, so an archived tree needs no build step of its own. The oracle
 * config widens `server.fs.allow` for exactly this reason.
 *
 * ⚠ REPLAY REACHES BACK ONLY TO S168. The driver loads `core/yaml-value-flags`, which no
 * commit before the S168 lift contains, so every older build now fails to load rather than
 * only those older than S164. That is a real capability regression, accepted deliberately
 * (plan §5 dragon 1): the replay answers "did my change regress anything?", and
 * `baseline.json` already encodes that answer per-document for all 66 rows. Freezing the
 * old mirror as a legacy replay path was rejected — it would reinstate the very artefact
 * whose existence was the problem, and a frozen mirror still invites someone to quote its
 * numbers.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { SchemaIndex } from "../../src/core/yaml-schema";

/** The build the oracle replays unless told otherwise: this working tree's own `src/`. */
export const DEFAULT_SRC = process.env.QMD_ORACLE_SRC ?? path.resolve(process.cwd(), "src");

/** The schema file's path relative to quarto's share directory. */
const SCHEMA_RELATIVE_PATH = path.join("editor", "tools", "yaml", "yaml-intelligence-resources.json");

/**
 * The build's own flag DECISION — the module the product itself calls (S168).
 *
 * Until S168 this assembled a 12-function struct for a hand-written mirror of the feature's
 * cell loop. The mirror is gone: `core/yaml-value-flags.ts` is pure and headless, so the
 * oracle now measures the same code path the editor takes, and there is nothing left to
 * drift.
 *
 * ⚠ The return type is annotated deliberately. A dynamic `import()` with a
 * template-literal specifier is `any`, so without this the driver's call site would be
 * COMPLETELY unchecked — wrong arity, wrong argument order, a missing `.cell`, all
 * invisible to `npm run compile-tests`, which the layer relies on as its type gate. Typing
 * it against the CURRENT tree while loading the build under test at runtime is the same
 * deliberate trade the old `OracleCoreApi` documented: a signature mismatch in an older
 * build is a real incompatibility and should surface rather than be papered over.
 */
export async function loadValueFlags(
  srcDir: string,
): Promise<typeof import("../../src/core/yaml-value-flags")> {
  return import(/* @vite-ignore */ `${srcDir}/core/yaml-value-flags`);
}

/**
 * Quarto's installed schema, parsed by the BUILD's own parser.
 *
 * The resource is quarto's and is the same for every build; the parser is not, so an
 * older build must read it through its own `parseSchemaIndex` or the replay is not
 * faithful. The share directory is resolved the way the product resolves it — `quarto
 * --paths` through the tested `parseSharePath` — rather than the absolute
 * `/Applications/quarto/...` S165 hard-coded, which was true only on one machine.
 */
export async function loadSchemaIndex(srcDir: string): Promise<SchemaIndex> {
  const { parseSharePath } = await import(/* @vite-ignore */ `${srcDir}/core/quarto-paths`);
  const stdout = execFileSync("quarto", ["--paths"], { encoding: "utf8" });
  const share = parseSharePath(stdout);
  if (share === null) {
    throw new Error("`quarto --paths` produced no share directory");
  }
  const file = path.join(share, SCHEMA_RELATIVE_PATH);
  const { parseSchemaIndex } = await import(/* @vite-ignore */ `${srcDir}/core/yaml-schema`);
  // Deliberately NOT falling back to CURATED_SCHEMA_INDEX the way the product does. The
  // product degrades because completion data must never break editing; the oracle must
  // fail loudly, because a run against the curated fallback would silently measure a
  // different schema than the one the user's quarto enforces.
  return parseSchemaIndex(fs.readFileSync(file, "utf8"));
}

/** The quarto version the measurements belong to — recorded in every report. */
export function quartoVersion(): string {
  return execFileSync("quarto", ["--version"], { encoding: "utf8" }).trim();
}
