// Re-derivable census backing docs/planning/2026-07-19-value-validation-plan.md §7.1.
//
// Counts, over the installed Quarto schema, how many front-matter (document-*) and
// cell-option (cell-*) fields carry a completion value set, and — critically — how many
// of those value sets are actually CLOSED (safe to validate) vs OPEN (would false-positive).
//
// It mirrors src/core/yaml-schema.ts `valuesOfSchema` for the value set, and implements the
// plan's proposed closedness rule: a value set is CLOSED only when every reachable arm is an
// enum or a boolean. A `string` node is ALWAYS open — INCLUDING `string:{completions:[...]}`,
// because completions are autocomplete hints, not a constraint (Quarto accepts any string;
// e.g. `engine: banana`, `documentclass: myclass` render exit 0). number/path/arrayOf/object
// are open too. This is the correctness fix the Session-123 plan review caught: the naive
// "values non-empty ⇒ closed" reading false-positives on the string.completions class.
//
// Run: node docs/planning/scripts/count-value-field-shapes.mjs
// Re-run after any Quarto upgrade — the numbers cited in the plan are for Quarto 1.7.33.

import fs from "node:fs";
import { execSync } from "node:child_process";

// `quarto --paths` prints the bin dir then the share dir; the schema resource is under share.
const paths = execSync("quarto --paths", { encoding: "utf8" }).split("\n").map((l) => l.trim());
const shareDir = paths.find((p) => p.endsWith("/share")) ?? paths[1] ?? paths[0];
const resource = `${shareDir}/editor/tools/yaml/yaml-intelligence-resources.json`;
const data = JSON.parse(fs.readFileSync(resource, "utf8"));

const defs = new Map();
for (const d of data["schema/definitions.yml"] || []) {
  if (d && typeof d === "object" && typeof d.id === "string") defs.set(d.id, d);
}

const scalarToYaml = (v) =>
  typeof v === "boolean" ? (v ? "true" : "false")
  : typeof v === "number" ? String(v)
  : typeof v === "string" ? v
  : null;

// Mirrors src/core/yaml-schema.ts valuesOfSchema — the set OFFERED for completion.
function valuesOf(schema, depth) {
  if (depth > 5) return [];
  if (schema === "boolean") return ["true", "false"];
  if (typeof schema === "string" || schema === null || typeof schema !== "object") return [];
  const s = schema;
  if (s.boolean !== null && typeof s.boolean === "object") return ["true", "false"];
  if (Array.isArray(s.enum)) return s.enum.map(scalarToYaml).filter((v) => v !== null);
  if (s.enum && typeof s.enum === "object" && !Array.isArray(s.enum) && Array.isArray(s.enum.values))
    return s.enum.values.map(scalarToYaml).filter((v) => v !== null);
  if (Array.isArray(s.anyOf)) return s.anyOf.flatMap((m) => valuesOf(m, depth + 1));
  if (s.maybeArrayOf !== undefined) return valuesOf(s.maybeArrayOf, depth + 1);
  if (typeof s.ref === "string") return valuesOf(defs.get(s.ref), depth + 1);
  if (s.string && typeof s.string === "object" && Array.isArray(s.string.completions))
    return s.string.completions.map(scalarToYaml).filter((v) => v !== null);
  if (s.schema !== undefined) return valuesOf(s.schema, depth + 1);
  return [];
}

// The plan's closedness rule: CLOSED iff every reachable arm is enum or boolean.
// Any string (incl. string.completions), number, path, arrayOf, object, or an unrecognized
// node ⇒ OPEN. depth>5 ⇒ OPEN (cannot prove exhaustive). anyOf ⇒ closed iff ALL arms closed.
function isClosed(schema, depth) {
  if (depth > 5) return false;
  if (schema === "boolean") return true;
  if (typeof schema === "string" || schema === null || typeof schema !== "object") return false;
  const s = schema;
  if (s.boolean !== null && typeof s.boolean === "object") return true;
  if (Array.isArray(s.enum)) return true;
  if (s.enum && typeof s.enum === "object" && !Array.isArray(s.enum) && Array.isArray(s.enum.values)) return true;
  if (Array.isArray(s.anyOf)) return s.anyOf.every((m) => isClosed(m, depth + 1));
  if (s.maybeArrayOf !== undefined) return isClosed(s.maybeArrayOf, depth + 1);
  if (typeof s.ref === "string") return isClosed(defs.get(s.ref), depth + 1);
  if (s.schema !== undefined) return isClosed(s.schema, depth + 1);
  // s.string (with or without completions), s.number, s.path, s.arrayOf, s.object, unknown ⇒ open
  return false;
}

// Clean single-scalar-number fields (the deferred v2 numeric-type-aware target).
function isCleanNumber(schema, depth) {
  if (depth > 4) return false;
  if (schema === "number") return true;
  if (typeof schema !== "object" || schema === null) return false;
  const s = schema;
  const scalarKeys = ["number", "string", "boolean", "path"].filter((k) => s[k] !== undefined);
  const structural = ["enum", "anyOf", "maybeArrayOf", "arrayOf", "object", "ref", "allOf", "oneOf"]
    .filter((k) => s[k] !== undefined);
  if (scalarKeys.length === 1 && structural.length === 0) return scalarKeys[0] === "number";
  if (s.schema !== undefined && scalarKeys.length === 0 && structural.length === 0)
    return isCleanNumber(s.schema, depth + 1);
  return false;
}

let valuesBearing = 0, closed = 0, openWithValues = 0, cleanNumber = 0;
const openExamples = [];
for (const [label, prefix] of [["cell", "schema/cell-"], ["document", "schema/document-"]]) {
  const byName = new Map();
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith(prefix) || !Array.isArray(v)) continue;
    for (const e of v) {
      if (!e || typeof e !== "object" || typeof e.name !== "string" || !e.name || e.hidden === true) continue;
      byName.set(e.name, e);
    }
  }
  let lv = 0, lc = 0, lo = 0, ln = 0;
  for (const e of byName.values()) {
    const hasValues = valuesOf(e.schema, 0).length > 0;
    if (hasValues) {
      lv++;
      if (isClosed(e.schema, 0)) lc++;
      else { lo++; if (openExamples.length < 20) openExamples.push(`${label}:${e.name}`); }
    } else if (isCleanNumber(e.schema, 0)) {
      ln++;
    }
  }
  valuesBearing += lv; closed += lc; openWithValues += lo; cleanNumber += ln;
  console.log(`${label}: ${lv} values-bearing (${lc} CLOSED / ${lo} OPEN-with-values), ${ln} clean-number`);
}
console.log(`\nTOTAL: ${valuesBearing} values-bearing = ${closed} CLOSED (validate) + ${openWithValues} OPEN-with-values (MUST NOT validate — false-positive risk)`);
console.log(`Deferred v2 numeric targets: ${cleanNumber} clean single-number fields`);
console.log(`OPEN-with-values examples: ${openExamples.join(", ")}`);
