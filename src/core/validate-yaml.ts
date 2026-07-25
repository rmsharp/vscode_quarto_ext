/**
 * Quarto's `validate-yaml` escape hatch — the document-wide (and per-cell) opt-out
 * from YAML validation, which this extension must honour or it squiggles documents
 * `quarto render` ACCEPTS: the cardinal sin, and here in its most explicit form,
 * because the user has literally asked for validation to be off.
 *
 * Quarto's own gate is a STRICT identity test against the parsed boolean, in two
 * places that behave as one:
 *
 * ```js
 * // render pipeline — skips validateDocument() for the WHOLE document
 * const validate = context.format.render?.["validate-yaml"];
 * if (validate !== false) { ... }
 * // yaml-schema/validated-yaml.ts — skips validation of ONE mapped string
 * const validateYaml = !isObject(annotation.result) || annotation.result["validate-yaml"] !== false;
 * ```
 *
 * Because it is `!== false` against a PARSED value, the spelling rules are YAML's,
 * not a regex's — which is why this module exists rather than a `=== "false"` test
 * at the call site.
 */

/**
 * Whether a raw front-matter / cell-option value token is the boolean `false` that
 * disarms quarto's YAML validation.
 *
 * Only YAML 1.2 core-schema boolean false counts — `false`, `False`, `FALSE`.
 * Everything else leaves validation ON, including several spellings that look like
 * they should disarm and do not. Grounded firsthand vs quarto 1.7.33 (one
 * `quarto render --no-execute` per spelling, each in a document whose `{python}`
 * cell carries `#| echo: banana`, which renders exit 1 whenever validation is on):
 *
 * | token | renders | disarms? |
 * |---|---|---|
 * | `false` / `False` / `FALSE` | exit 0 | **yes** |
 * | `no` / `No` / `off` / `n` | exit 1 | no — YAML 1.2 core parses these as STRINGS |
 * | `"false"` / `'false'` | exit 1 | no — a quoted scalar is the string `false` |
 * | `0` | exit 1 | no — an integer is not `false` |
 * | `null` / `~` | exit 1 | no |
 * | `true` | exit 1 | no |
 *
 * The `no`/`off` row is the one worth remembering: YAML **1.1** would parse those as
 * booleans and quarto's parser does not, so a matcher built from YAML-1.1 intuition
 * would suppress diagnostics on documents quarto really does validate — a lost true
 * positive. Being too STRICT is the dangerous direction in the other sense: failing
 * to honour `False`/`FALSE` would flag a document quarto accepts, which is the
 * cardinal sin, so all three spellings are load-bearing.
 *
 * The token is expected to arrive with surrounding whitespace already excluded (both
 * value enumerators exclude it) and WITHOUT a trailing `# comment`, which YAML does
 * not treat as part of a plain scalar.
 */
export function isValidationDisabledValue(rawToken: string): boolean {
  return rawToken === "false" || rawToken === "False" || rawToken === "FALSE";
}
