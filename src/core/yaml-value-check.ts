/**
 * Pure, `vscode`-free value validation for a recognized Quarto option
 * (front-matter/cell-option VALUE validation plan §3.3). Given the raw value
 * token as it appears in the document and the resolved `SchemaField`, decide
 * whether the value is WRONG — i.e. `quarto render` 1.7.33 would reject it —
 * so the diagnostic feature can emit an Error squiggle.
 *
 * FALSE-NEGATIVE ONLY (the hard product rule — see `BACKLOG.md`'s value-validation
 * entries; cited by name rather than by line, which drifts): never flag a value
 * Quarto would accept. Everything the matcher is unsure about — an open value set,
 * a non-scalar token, an empty token — returns `false` (flag nothing).
 *
 * Safety rests on TWO field bits, not one. `valuesClosed` proves the set is closed
 * (a non-empty `values` list is NOT proof of that — see its doc comment); `acceptsNull`
 * then supplies the one accepted spelling `values` cannot carry, because `valuesOfSchema`
 * drops a literal `null` enum member. Reading `valuesClosed` alone — "it's closed, so
 * `values` is the whole accepted set" — is exactly the reasoning that produced the
 * `auto-play-media: null` cardinal-sin false positive (document-key plan §2.5). The
 * accepted set of a closed field is `values` ∪ (the null spellings, when `acceptsNull`).
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
 * YAML 1.2's four core null spellings, anchored and case-EXACT — the set Quarto accepts
 * for a field whose enum lists a literal `null` (document-key plan §2.5). Grounded
 * firsthand against `quarto render` 1.7.33: `auto-play-media:` `null`/`Null`/`NULL`/`~`
 * all render exit 0, while `NuLl` renders exit 1 (YAML's null resolution is case-exact,
 * not case-insensitive) and the quoted `"null"` renders exit 1 (a string, not the null
 * type). The anchoring is what rejects the quoted form — `"null"` cannot match.
 *
 * YAML also resolves an EMPTY value to null, but an empty token never reaches this test:
 * `isWrongValue`'s shared skip returns first (and the enumerators skip empty slots).
 */
const NULL_SPELLINGS = /^(?:null|Null|NULL|~)$/;

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
  if (rawToken.length === 0 || /^[[\]{}|>&*!]/.test(rawToken) || rawToken.includes("\\")) {
    // Shared skip, FIRST — applies to numeric AND enum fields (numeric plan §3.3).
    // Skip: empty (mid-edit); a flow collection `[…]`/`{…}` or block scalar
    // `|`/`>`; OR a value carrying a YAML node property — an anchor (`&name`),
    // an alias (`*name`), or a tag (`!!type`/`!tag`). quarto resolves the node
    // property and accepts the underlying value (`toc: &a true` → exit 0), so a
    // token the matcher can't reduce to a plain scalar must never be flagged
    // (adversarial review, S125 — a cardinal-sin false positive otherwise).
    //
    // Also skip any token containing a BACKSLASH (the escape-decoding FP, P3 /
    // §9-review S149). A DOUBLE-quoted YAML value processes backslash escapes, so
    // `toc-location: "\x62ody"` DECODES to `body` and quarto renders it exit 0 — but
    // `unquote` does no escape decoding, so `members.includes` saw the literal
    // `\x62ody`, missed, and flagged a value quarto accepts (grounded firsthand vs
    // quarto 1.7.33). Skipping is escape-form-agnostic (`\xNN`, `\uNNNN`, `\\`, …) and
    // FALSE-NEGATIVE ONLY: a closed-enum/boolean member never itself contains a
    // backslash, so this can never suppress a genuine member match — it only stops
    // flagging backslash-bearing values, which after decoding are either accepted
    // (the FP we remove) or rejected (`bo\dy`, `"\x62anana"` → quarto exit 1; now a
    // deliberate safe FN, per the hard product rule). Single-quoted tokens have no
    // escapes except `''` (which can't produce a member), so skipping them costs
    // nothing real.
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
  if (field.acceptsNull === true && NULL_SPELLINGS.test(rawToken)) {
    // The NULL arm (document-key plan §2.5): the field's enum lists a literal `null`,
    // which `valuesOfSchema` dropped from `values` — so membership below cannot see it.
    // Checked BEFORE the numeric-member branch too: `enum:[null, 3, 4]` is not an
    // all-number enum, but a future all-number-plus-null enum must still accept null.
    return false;
  }
  if (field.numericMemberEnum === true) {
    // Numeric-member enum (a closed enum whose members are YAML numbers, e.g.
    // `aspectratio`/`version`): quarto COERCES the value numerically before matching,
    // so validate by PARSED value, not string membership (matcher plan §3.1 C).
    return isWrongNumericMember(rawToken, field.values as string[]);
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
 * Whether `rawToken` is WRONG for a NUMERIC-MEMBER enum — a closed enum whose members
 * are YAML numbers (`aspectratio` = [43,169,…], `version` = [3,4]; matcher plan §3.1 C).
 * Quarto COERCES the value numerically before matching (`169.0` ≡ `169`, and `+169`/`0169`/
 * `3e0`/`04`/`4_3`≡43 all render exit 0) and REJECTS the quoted form (`"169"` → exit 1)
 * even when its content matches a member (§2.3). So:
 *   1. a quoted token (leading `"`/`'`) is flagged FIRST — quarto rejects it;
 *   2. an unquoted trailing ` #…` comment is stripped, then a token that is NOT a
 *      `NUMBER_LITERAL` is flagged (`banana`, `wide`);
 *   3. the token is parsed with **`Number()`** — the only JS parser matching quarto's
 *      coercion (`parseFloat("0x2b")`=0 would false-positive hex `0x2b`≡43) — and flagged
 *      ONLY when it is a FINITE value unequal to every member.
 * `Number()` returns NaN for the YAML digit-group-underscore forms quarto ACCEPTS
 * (`Number("4_3")`=NaN, though `4_3`≡43 renders exit 0) and for `.inf`/`.nan`; NaN is
 * treated as NOT-confidently-out-of-set and left UNFLAGGED — the FN-safe default
 * (matcher plan §3.1 C step 4 / §7.3, the §9-review HIGH). No YAML parsing, false-negative
 * only: it never flags a value quarto accepts.
 */
function isWrongNumericMember(rawToken: string, members: string[]): boolean {
  const firstChar = rawToken.trimStart()[0];
  if (firstChar === '"' || firstChar === "'") {
    return true; // quarto rejects the quoted form even if its content matches a member (§2.3)
  }
  const trimmed = rawToken.replace(/ #.*$/, "").trim();
  if (!NUMBER_LITERAL.test(trimmed)) {
    return true; // not a number literal → a genuine non-member (`banana`)
  }
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) {
    return false; // e.g. `4_3` (≡43, quarto exit 0) or `.inf` — not confidently out of set → FN-safe
  }
  return !members.some((m) => Number(m) === parsed);
}

/**
 * The logical value of a YAML scalar token: for a quoted token, the content up to
 * the matching CLOSING quote — deliberately ignoring anything after it, because the
 * cell-option value slot retains a trailing ` # comment` for a quoted value
 * (`slotsOf` strips inline comments only for UNQUOTED values), and `#| key: "v" #
 * note` renders exit 0 (adversarial review, S124). An unquoted or unterminated
 * token is returned unchanged. No escape decoding — a DOUBLE-quoted value's backslash
 * escapes are NOT resolved here; both callers (`isWrongValue` and the format-name path
 * in `features/yaml-value-diagnostics.ts`) instead skip any backslash-bearing token
 * BEFORE calling this, so an escape that would decode to a valid member/name is never
 * mis-flagged (the escape-decoding FP, P3 / §9-review S149).
 */
export function unquote(token: string): string {
  const first = token[0];
  if (first === '"' || first === "'") {
    const close = token.indexOf(first, 1);
    if (close > 0) {
      return token.slice(1, close); // content between the quotes; trailing comment/junk ignored
    }
  }
  return token;
}

/**
 * The Error message for a wrong value — grounded on the FACT of Quarto's error,
 * not its exact expected-list wording (plan §3.4).
 *
 * FOUR arms, and their ORDER is load-bearing — each earlier arm exists because a later
 * one mis-messages the fields it would otherwise catch:
 *   1. numeric (`scalarType`)  — FIRST because curated `daemon` carries BOTH
 *      `scalarType:"number"` and `values:[true,false]`+`acceptsBoolean`, so arm 3 would
 *      claim "expected true or false" and omit number (numeric plan §3.4, dragon #9).
 *   2. null-admitting (`acceptsNull`) — before arm 3 because the boolean phrasing cannot
 *      express a third accepted spelling; quarto's own clause names null first.
 *   3. boolean-accepting, all-boolean `values` — phrased as `true` or `false`.
 *   4. plain closed enum — lists `values`.
 * Adding a fifth arm means deciding its precedence against these, not appending it.
 *
 * Lives in the pure core (relocated from `features/yaml-value-diagnostics.ts`,
 * Session 135) so BOTH the document-surface value feature AND the `_quarto.yml`
 * project-config value feature import ONE message function (plan §3.2 C / §11 dragon 9).
 */
export function valueMessage(rawToken: string, key: string, field: SchemaField): string {
  // Numeric arm FIRST (numeric plan §3.4, dragon #9): curated `daemon` carries BOTH
  // `scalarType:"number"` and `values:[true,false]`+`acceptsBoolean`, so it would
  // satisfy the acceptsBoolean-enum branch below and mis-message `daemon: banana` as
  // "expected true or false" (omitting number). Dispatch on `scalarType` first.
  if (field.scalarType === "number") {
    return field.acceptsBoolean
      ? `Value ${rawToken} is not valid for "${key}" — expected a number or true or false.`
      : `Value ${rawToken} is not valid for "${key}" — expected a number.`;
  }
  const values = field.values ?? [];
  if (field.acceptsNull === true) {
    // The null arm is real but absent from `values` (`valuesOfSchema` drops it), so the
    // list would otherwise omit a value quarto accepts — and quarto's OWN clause names it
    // first: ``one of: `null`, `true`, `false``. Takes precedence over the boolean phrasing
    // below, which cannot express a third accepted spelling (document-key plan §2.5).
    return `Value ${rawToken} is not valid for "${key}" — expected one of: ${["null", ...values].join(", ")}.`;
  }
  if (field.acceptsBoolean && values.every((v) => v === "true" || v === "false")) {
    return `Value ${rawToken} is not valid for "${key}" — expected true or false.`;
  }
  return `Value ${rawToken} is not valid for "${key}" — expected one of: ${values.join(", ")}.`;
}
