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
 * The logical value of a YAML scalar token: for a quoted token, the content up to
 * the matching CLOSING quote — deliberately ignoring anything after it, because the
 * cell-option value slot retains a trailing ` # comment` for a quoted value
 * (`slotsOf` strips inline comments only for UNQUOTED values), and `#| key: "v" #
 * note` renders exit 0 (adversarial review, S124). An unquoted or unterminated
 * token is returned unchanged. No escape decoding — closed-enum/boolean values
 * never contain a quote character.
 */
function unquote(token: string): string {
  const first = token[0];
  if (first === '"' || first === "'") {
    const close = token.indexOf(first, 1);
    if (close > 0) {
      return token.slice(1, close); // content between the quotes; trailing comment/junk ignored
    }
  }
  return token;
}
