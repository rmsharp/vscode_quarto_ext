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
 * ⚠ A build older than S164 has no `core/document-engine` and will fail to load. That is
 * correct behaviour, not a bug to paper over: the mirror's decision path does not exist
 * there, so there is nothing faithful to replay.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { SchemaIndex } from "../../src/core/yaml-schema";
import type { OracleCoreApi } from "./flags";

/** The build the oracle replays unless told otherwise: this working tree's own `src/`. */
export const DEFAULT_SRC = process.env.QMD_ORACLE_SRC ?? path.resolve(process.cwd(), "src");

/** The schema file's path relative to quarto's share directory. */
const SCHEMA_RELATIVE_PATH = path.join("editor", "tools", "yaml", "yaml-intelligence-resources.json");

/** Assemble the core surface the mirror calls, from `srcDir`. */
export async function loadCoreApi(srcDir: string): Promise<OracleCoreApi> {
  const load = (rel: string) => import(/* @vite-ignore */ `${srcDir}/${rel}`);
  const [model, fmValues, nested, context, engine, valueCheck, validateYaml] = await Promise.all([
    load("core/qmd/model"),
    load("core/yaml-frontmatter-values"),
    load("core/yaml-frontmatter-nested-values"),
    load("core/yaml-context"),
    load("core/document-engine"),
    load("core/yaml-value-check"),
    load("core/validate-yaml"),
  ]);
  return {
    findCellOptionLines: model.findCellOptionLines,
    frontMatterContentLines: model.frontMatterContentLines,
    findFrontMatterTopLevelLines: fmValues.findFrontMatterTopLevelLines,
    findFrontMatterValueLines: fmValues.findFrontMatterValueLines,
    findNestedFrontMatterValueLines: nested.findNestedFrontMatterValueLines,
    documentEngineForScoping: engine.documentEngineForScoping,
    cellOptionScopeFor: context.cellOptionScopeFor,
    mappingColonAt: context.mappingColonAt,
    valueSlotAfterColon: context.valueSlotAfterColon,
    isWrongValue: valueCheck.isWrongValue,
    isValidationDisabledByFrontMatter: validateYaml.isValidationDisabledByFrontMatter,
    cellsWithValidationDisabled: validateYaml.cellsWithValidationDisabled,
  };
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
