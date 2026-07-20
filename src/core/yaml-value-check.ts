/**
 * Pure, `vscode`-free value validation for a recognized Quarto option
 * (front-matter/cell-option VALUE validation plan §3.3). Given the raw value
 * token as it appears in the document and the resolved `SchemaField`, decide
 * whether the value is WRONG — i.e. `quarto render` 1.7.33 would reject it —
 * so the diagnostic feature can emit an Error squiggle.
 *
 * FALSE-NEGATIVE ONLY (the hard product rule, `BACKLOG.md:43`): never flag a
 * value Quarto would accept. Everything the matcher is unsure about — an open
 * value set, a non-scalar token, an empty token — returns `false` (flag
 * nothing). The safety of the whole feature rests on `field.valuesClosed`
 * (see its doc comment): a non-empty `values` list is NOT proof the set is
 * closed.
 */

import type { SchemaField } from "./yaml-schema";

/** The six YAML-1.2 boolean spellings Quarto accepts UNQUOTED (plan §2). */
const BOOLEAN_SPELLINGS = /^(?:true|True|TRUE|false|False|FALSE)$/;

/**
 * Whether `rawToken` (a document value token, possibly quoted) is WRONG for
 * `field` — i.e. `quarto render` would reject it. Returns `false` (flag
 * nothing) for anything not positively proven wrong.
 *
 * Preconditions to validate at all (else `false`): the field's value set must
 * be provably CLOSED (`valuesClosed === true`) and non-empty, and the token
 * must be a non-empty SCALAR (a flow collection `[…]`/`{…}` or a block scalar
 * `|`/`>` is skipped — never a closed-enum scalar, plan §7.6).
 */
export function isWrongValue(rawToken: string, field: SchemaField): boolean {
  if (field.valuesClosed !== true || (field.values?.length ?? 0) === 0) {
    return false; // open set / no enum data — never flag (the cardinal-sin guard)
  }
  if (rawToken.length === 0 || /^[[\]{}|>]/.test(rawToken)) {
    return false; // empty (mid-edit) or non-scalar (flow/block) — skip
  }
  const values = field.values as string[];
  // Step 1 — booleans: the six spellings, UNQUOTED only. The anchored regex
  // rejects any quoted form on its own (`"true"` won't match), so a quoted
  // boolean-looking value falls through to be flagged (plan §2: `toc: "true"`
  // → exit 1).
  if (field.acceptsBoolean && BOOLEAN_SPELLINGS.test(rawToken)) {
    return false;
  }
  // Step 2 — string enums: unquote, then case-SENSITIVE membership. Exclude the
  // boolean reprs from the membership set on a boolean-accepting field so a
  // quoted `"true"`/`"false"` (or bare `yes`) is not spuriously accepted by
  // step 2 — those are valid ONLY via step 1's unquoted spellings.
  const members = field.acceptsBoolean
    ? values.filter((v) => v !== "true" && v !== "false")
    : values;
  if (members.includes(unquote(rawToken))) {
    return false;
  }
  // Step 3 — recognized key, closed set, scalar token, not a valid member.
  return true;
}

/**
 * Strip one matching layer of YAML scalar quoting (`"v"` or `'v'`) to the
 * logical value, or return `token` unchanged if it is not wrapped in a matching
 * pair. No escape decoding — closed-enum/boolean values never contain a quote
 * character, so this is sufficient for membership comparison (mirrors
 * `project-yaml.ts:unquoteKey`, adapted for values).
 */
function unquote(token: string): string {
  if (token.length >= 2) {
    const first = token[0];
    const last = token[token.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return token.slice(1, -1);
    }
  }
  return token;
}
