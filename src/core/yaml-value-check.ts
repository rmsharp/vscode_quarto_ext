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
 * A YAML number literal Quarto 1.7.33's schema layer accepts, anchored — the
 * predicate `R` (numeric value-validation plan §2.3). A verified STRICT SUPERSET of
 * Quarto's accept set: every literal Quarto accepts matches this, so any token that
 * FAILS it is genuinely rejected by Quarto (zero false positives — the C1 guarantee).
 * Where Quarto is STRICTER than this regex — signed leading-dot (`+.5`/`-.5`),
 * trailing-underscore (`1_`), uppercase-radix (`0X1A`) — the token matches and is left
 * UNFLAGGED, a deliberate safe false negative. Covers: decimal int/float with optional
 * sign, leading/trailing dot, exponent, and digit-group underscores; hex/octal/binary;
 * signed `.inf`; and unsigned `.nan`. NOT matched (⇒ flagged): `wide`, `6abc`, `1,000`,
 * bare `inf`/`nan`, `10:30`, `_1`, `0xG`, `0b2` — all Quarto-schema-rejected (grounded).
 */
const NUMBER_LITERAL =
  /^[+-]?(?:\.?[0-9][0-9_]*(?:\.[0-9_]*)?(?:[eE][+-]?[0-9]+)?|0[xX][0-9a-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|\.(?:inf|Inf|INF))$|^\.(?:nan|NaN|NAN)$/;

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
  if (rawToken.length === 0 || /^[[\]{}|>&*!]/.test(rawToken)) {
    // Shared skip, FIRST — applies to numeric AND enum fields (numeric plan §3.3).
    // Skip: empty (mid-edit); a flow collection `[…]`/`{…}` or block scalar
    // `|`/`>`; OR a value carrying a YAML node property — an anchor (`&name`),
    // an alias (`*name`), or a tag (`!!type`/`!tag`). quarto resolves the node
    // property and accepts the underlying value (`toc: &a true` → exit 0), so a
    // token the matcher can't reduce to a plain scalar must never be flagged
    // (adversarial review, S125 — a cardinal-sin false positive otherwise).
    return false;
  }
  if (field.scalarType === "number") {
    // Numeric branch: validate the value as a YAML number literal, not against a
    // closed enum. A numeric field carries no `values` (numeric plan §3.3), so this
    // MUST come before the enum gate below (which would `return false` for it).
    return isWrongNumber(rawToken, field.acceptsBoolean === true);
  }
  if (field.valuesClosed !== true || (field.values?.length ?? 0) === 0) {
    return false; // open set / no enum data — never flag (the cardinal-sin guard)
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
 * Whether `rawToken` is WRONG for a numeric (`scalarType:"number"`) field — i.e.
 * Quarto rejects it at its YAML-schema layer (numeric plan §2.3/§3.3). Preprocesses
 * exactly as YAML sees the value: a QUOTED token (leading `"`/`'`) is a string, which
 * Quarto rejects for a number field (`fig-width: "6"` → exit 1); otherwise strip an
 * unquoted trailing ` #…` comment and trim, then flag an empty token (mid-edit — the
 * loops already skip it, so inert) or one that does NOT fully match `NUMBER_LITERAL`.
 * When `acceptsBoolean`, the six UNQUOTED boolean spellings are accepted (checked
 * BEFORE the number match) — a number-OR-boolean field (`daemon`/`toc-expand`).
 *
 * No YAML parsing (C1/C3): a strict superset predicate, never a value Quarto accepts.
 */
function isWrongNumber(rawToken: string, acceptsBoolean: boolean): boolean {
  const firstChar = rawToken.trimStart()[0];
  if (firstChar === '"' || firstChar === "'") {
    return true; // a quoted scalar is a string — rejected for a number field (plan §2.2)
  }
  const trimmed = rawToken.replace(/ #.*$/, "").trim();
  if (trimmed.length === 0) {
    return true; // empty (mid-edit); the loops already skip this — belt-and-suspenders
  }
  if (acceptsBoolean && BOOLEAN_SPELLINGS.test(trimmed)) {
    return false; // `daemon: true` — a boolean is valid on a number-OR-boolean field
  }
  return !NUMBER_LITERAL.test(trimmed);
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
