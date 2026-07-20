import { describe, expect, it } from "vitest";
import { isWrongValue } from "../../src/core/yaml-value-check";
import type { SchemaField } from "../../src/core/yaml-schema";

/**
 * `isWrongValue` is the pure core of front-matter/cell-option VALUE validation
 * (plan §3.3). Every row is empirically grounded against `quarto render` 1.7.33
 * (plan §2/§7.2): a boolean field accepts the six unquoted spellings and rejects
 * everything quoted; a closed string enum accepts members quoted-or-unquoted,
 * case-SENSITIVE; and an OPEN set (`valuesClosed` unset) is never validated —
 * the cardinal-sin false positive this feature must never ship.
 */

/** A closed boolean field (e.g. `toc`, `eval`): `anyOf`-free, six spellings. */
const boolField: SchemaField = {
  name: "toc",
  values: ["true", "false"],
  valuesClosed: true,
  acceptsBoolean: true,
};

/** `echo` = `anyOf[boolean, enum[fenced]]` — closed, boolean-accepting + one enum arm. */
const echoField: SchemaField = {
  name: "echo",
  values: ["true", "false", "fenced"],
  valuesClosed: true,
  acceptsBoolean: true,
};

/** `code-overflow` = `enum[scroll, wrap]` — closed string enum, NOT boolean. */
const enumField: SchemaField = {
  name: "code-overflow",
  values: ["scroll", "wrap"],
  valuesClosed: true,
};

/**
 * `output` = `anyOf[boolean, enum[asis], string, object]` — OPEN (free string
 * arm), yet `valuesOfSchema` still yields a non-empty `values`. `valuesClosed`
 * is left unset → the cardinal-sin trap: must never be validated.
 */
const openField: SchemaField = {
  name: "output",
  values: ["true", "false", "asis"],
};

describe("isWrongValue — closed boolean fields (six spellings, quote-rejecting)", () => {
  it("flags an arbitrary string on a boolean field (toc: maybe)", () => {
    expect(isWrongValue("maybe", boolField)).toBe(true);
  });

  it("accepts the six unquoted YAML-1.2 boolean spellings", () => {
    for (const v of ["true", "True", "TRUE", "false", "False", "FALSE"]) {
      expect(isWrongValue(v, boolField), `${v} should be valid`).toBe(false);
    }
  });

  it("flags YAML-1.1 truthy synonyms — strings, not booleans (yes/no/on/off, Yes, On)", () => {
    for (const v of ["yes", "no", "on", "off", "Yes", "On"]) {
      expect(isWrongValue(v, boolField), `${v} should flag`).toBe(true);
    }
  });

  it("flags a QUOTED boolean-looking value (toc: \"true\" / 'false')", () => {
    expect(isWrongValue('"true"', boolField)).toBe(true);
    expect(isWrongValue("'false'", boolField)).toBe(true);
  });
});

describe("isWrongValue — anyOf[boolean, enum] fields (echo)", () => {
  it("accepts both a boolean spelling and the enum member", () => {
    expect(isWrongValue("True", echoField)).toBe(false);
    expect(isWrongValue("fenced", echoField)).toBe(false);
  });

  it("accepts the enum member quoted (echo: \"fenced\")", () => {
    expect(isWrongValue('"fenced"', echoField)).toBe(false);
  });

  it("flags an unknown value and a quoted boolean (echo: banana / \"true\")", () => {
    expect(isWrongValue("banana", echoField)).toBe(true);
    expect(isWrongValue('"true"', echoField)).toBe(true);
  });
});

describe("isWrongValue — closed string enums (case-sensitive, quote-tolerant)", () => {
  it("accepts a member unquoted or quoted (code-overflow: scroll / \"scroll\")", () => {
    expect(isWrongValue("scroll", enumField)).toBe(false);
    expect(isWrongValue('"scroll"', enumField)).toBe(false);
  });

  it("flags a wrong-CASE member — enum membership is case-sensitive (code-overflow: Scroll)", () => {
    expect(isWrongValue("Scroll", enumField)).toBe(true);
  });

  it("flags a non-member (code-overflow: banana)", () => {
    expect(isWrongValue("banana", enumField)).toBe(true);
  });
});

describe("isWrongValue — OPEN sets are never validated (the cardinal-sin guard)", () => {
  it("never flags on a field whose valuesClosed is unset, even off-list (output: banana)", () => {
    expect(isWrongValue("banana", openField)).toBe(false);
    expect(isWrongValue("asis", openField)).toBe(false);
  });

  it("never flags when valuesClosed is explicitly false", () => {
    expect(isWrongValue("banana", { ...openField, valuesClosed: false })).toBe(false);
  });

  it("never flags a closed field that carries no values (defensive)", () => {
    expect(isWrongValue("banana", { name: "x", valuesClosed: true })).toBe(false);
  });
});

/** `fig-align` = `maybeArrayOf[enum]` — closed string enum, NOT boolean. */
const figAlignField: SchemaField = {
  name: "fig-align",
  values: ["default", "left", "right", "center"],
  valuesClosed: true,
};

describe("isWrongValue — a quoted value with a trailing inline comment (adversarial review, S124)", () => {
  // The cell-option value slot retains a trailing ` # comment` for a QUOTED value
  // (slotsOf skips comment-stripping inside quotes); quarto renders these exit 0,
  // so the matcher must NOT flag them — a false positive would breach the hard rule.
  it("accepts a valid quoted enum member followed by a comment (fig-align: \"center\" # note)", () => {
    expect(isWrongValue('"center" # a comment', figAlignField)).toBe(false);
    expect(isWrongValue("'left'   # note", figAlignField)).toBe(false);
  });

  it("accepts a valid quoted enum member with a comment on echo (\"fenced\" # note)", () => {
    expect(isWrongValue('"fenced" # note', echoField)).toBe(false);
  });

  it("still flags a WRONG quoted value even with a trailing comment", () => {
    expect(isWrongValue('"middle" # note', figAlignField)).toBe(true);
  });
});

describe("isWrongValue — non-scalar and empty tokens are skipped", () => {
  it("skips an empty token (mid-edit `#| echo:`)", () => {
    expect(isWrongValue("", boolField)).toBe(false);
  });

  it("skips a flow collection or block scalar ([a,b] / {a: b} / | / >)", () => {
    for (const v of ["[a, b]", "{a: b}", "|", ">"]) {
      expect(isWrongValue(v, enumField), `${v} should be skipped`).toBe(false);
    }
  });

  // Adversarial review (S125): a value carrying a YAML node property — an anchor
  // (`&name`), an alias (`*name`), or a tag (`!!type`/`!tag`) — is a node the
  // matcher cannot resolve to a plain scalar. quarto resolves it and accepts the
  // underlying value (`toc: &a true`, `toc: !!bool true`, `toc: *a` all render
  // exit 0), so flagging it would be a cardinal-sin false positive. Skip it.
  it("skips a value that begins with a YAML anchor, alias, or tag (& / * / !)", () => {
    expect(isWrongValue("&a true", boolField), "&a true (anchor)").toBe(false);
    expect(isWrongValue("!!bool true", boolField), "!!bool true (tag)").toBe(false);
    expect(isWrongValue("*a", boolField), "*a (alias)").toBe(false);
    expect(isWrongValue("&w none", enumField), "&w none (anchor on a string enum)").toBe(false);
    expect(isWrongValue("*ref", enumField), "*ref (alias on a string enum)").toBe(false);
  });
});
