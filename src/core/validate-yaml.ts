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
 *
 * `validate-yaml` is itself UNDECLARED in quarto's schema resources (zero occurrences
 * in `yaml-intelligence-resources.json`), so it is an open key on both surfaces: quarto
 * renders even `validate-yaml: banana` at exit 0, and neither `frontMatterKeys([])` nor
 * `cellOptions(...)` contains it, so this extension never flags the flag itself.
 */

import type { CellOptionLine } from "./qmd/model";
import { unquoteKey } from "./yaml-context";

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

/** The escape hatch's key, in both surfaces. Undeclared in quarto's schema (below). */
const VALIDATE_YAML_KEY = "validate-yaml";

/**
 * Whether the document's front matter turns validation off for the WHOLE document.
 *
 * Quarto reads only the TOP-LEVEL key: `execute:` / `  validate-yaml: false` leaves
 * validation on (measured, exit 1), and `findFrontMatterValueLines` emits top-level
 * scalars only, so position is enforced by the enumerator rather than re-checked here.
 * The key arrives already unquoted (S159), which matches quarto — a quoted
 * `"validate-yaml": false` disarms exactly like the bare form (measured, exit 0).
 *
 * A trailing `# comment` and surrounding whitespace are already excluded from
 * `rawToken` by the enumerator, so `validate-yaml: false  # turn it off` is honoured
 * (measured, exit 0) without any comment-stripping here.
 *
 * NOTE the caller must NOT use this to suppress the front-matter FORMAT-NAME check.
 * See `yaml-value-diagnostics.ts` — `validate-yaml: false` + `format: banana` still
 * renders **exit 1** (`Unknown format banana`), because an unresolvable format fails
 * before the validation gate is ever consulted.
 */
export function isValidationDisabledByFrontMatter(
  frontMatterValueLines: readonly { key: string; rawToken: string }[],
): boolean {
  return frontMatterValueLines.some(
    (fm) => fm.key === VALIDATE_YAML_KEY && isValidationDisabledValue(fm.rawToken),
  );
}

/**
 * The set of cell FENCE lines (`CellOptionLine.cellStartLine`) whose own option block
 * turns validation off for that cell.
 *
 * The per-cell form is quarto's `readAndValidateYamlFromMappedString` gate applied to a
 * CELL's option YAML rather than the front matter, so its scope is exactly one cell.
 * Grounded firsthand vs 1.7.33, each against a control differing only in the flag:
 *
 * - it disarms every key in its own cell, not just the one below it (exit 0)
 * - it does NOT leak to the next cell — cell 1 flagged still leaves cell 2's
 *   `#| echo: banana` at exit 1
 * - it does NOT disarm the FRONT MATTER — a bad front-matter scalar still renders exit 1
 * - order inside the block is irrelevant: the flag AFTER the bad option still renders exit 0
 * - it works under any comment char (`--|` in a `{sql}` cell renders exit 0)
 * - a quoted key (`#| "validate-yaml": false`) disarms too, hence `unquoteKey`
 * - the VALUE still has to be boolean false: `#| validate-yaml: true` renders exit 1
 *
 * Position needs no check here either: quarto reads a cell's options from its LEADING
 * contiguous directive run and `findCellOptionLines` reports exactly that run (S160), so
 * a flag below code or after a blank line is simply never emitted — and measured, such a
 * document really does render exit 1.
 */
export function cellsWithValidationDisabled(
  cellOptionLines: readonly CellOptionLine[],
  lines: readonly string[],
): Set<number> {
  const disabled = new Set<number>();
  for (const opt of cellOptionLines) {
    if (opt.keySlot === null || opt.valueSlot === null) {
      continue; // a block-sequence item, or no `:` yet — cannot be the flag
    }
    const lineText = lines[opt.line] ?? "";
    if (unquoteKey(lineText.slice(opt.keySlot.startCol, opt.keySlot.endCol)) !== VALIDATE_YAML_KEY) {
      continue;
    }
    if (isValidationDisabledValue(lineText.slice(opt.valueSlot.startCol, opt.valueSlot.endCol))) {
      disabled.add(opt.cellStartLine);
    }
  }
  return disabled;
}
