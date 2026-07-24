import { describe, expect, it } from "vitest";
import { isWrongValue, valueMessage } from "../../src/core/yaml-value-check";
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

describe("isWrongValue — the escape-decoding FP (P3, cross-surface, §9-review S149; grounded firsthand vs quarto render 1.7.33)", () => {
  // A DOUBLE-quoted YAML value processes backslash escapes, so `"\x73croll"` DECODES to
  // `scroll` and `quarto render` accepts it (exit 0) — but `unquote` does NO escape
  // decoding (by design; decoding would need a YAML parser), so `members.includes` sees
  // the literal `\x73croll`, finds no match, and flags a value quarto accepts: a
  // cardinal-sin false positive live since S125. The fix skips any token containing a
  // backslash — escape-form-agnostic (covers `\xNN`, `\uNNNN`, `\\`, …) and FN-only (a
  // member never itself contains a backslash, so skipping introduces zero new flags).
  it("does NOT flag a double-quoted \\x escape that decodes to an enum member (code-overflow: \"\\x73croll\" → scroll, exit 0)", () => {
    expect(isWrongValue('"\\x73croll"', enumField)).toBe(false);
  });

  it("is escape-form-agnostic — a \\u unicode escape that decodes to a member is not flagged (\"\\u0073croll\" → scroll, exit 0)", () => {
    expect(isWrongValue('"\\u0073croll"', enumField)).toBe(false);
  });

  it("does NOT flag a \\x escape that decodes to a boolean-enum member (echo: \"\\x66enced\" → fenced, exit 0)", () => {
    expect(isWrongValue('"\\x66enced"', echoField)).toBe(false);
  });

  // The FN-safe direction: a backslash-bearing value that quarto REJECTS (exit 1) is now
  // silent too — a deliberate safe false negative, not a defect. `bo\dy` (unquoted plain
  // scalar) and `'\x73croll'` (single-quoted, no escape processing) are both literal
  // strings quarto's schema rejects; before P3 we flagged them (a true positive), and the
  // coverage loss is acceptable under the hard FN-only product rule (these are contrived
  // hand-written forms — no naturally-occurring value carries a backslash).
  it("is false-negative only — a backslash value quarto rejects is now silently skipped (safe)", () => {
    expect(isWrongValue("sc\\roll", enumField), "unquoted literal backslash").toBe(false);
    expect(isWrongValue("'\\x73croll'", enumField), "single-quoted, no escape processing").toBe(false);
    expect(isWrongValue('"\\x62anana"', enumField), "decodes to banana, exit 1 — was a TP, now safe FN").toBe(false);
  });

  // The skip is narrow: it fires ONLY on a backslash. Every backslash-free judgement is
  // unchanged — a plain member (quoted or not) is still accepted, a plain non-member is
  // still flagged. This pins that P3 did not widen into a general quote/coverage change.
  it("leaves every backslash-free judgement unchanged", () => {
    expect(isWrongValue("scroll", enumField), "plain member").toBe(false);
    expect(isWrongValue('"scroll"', enumField), "plain quoted member").toBe(false);
    expect(isWrongValue("banana", enumField), "plain non-member still flagged").toBe(true);
    expect(isWrongValue('"banana"', enumField), "quoted non-member still flagged").toBe(true);
  });
});

/** A plain numeric field (e.g. `fig-width`, `columns`) — `scalarType:"number"`, no enum. */
const numField: SchemaField = { name: "fig-width", scalarType: "number" };

/** `daemon`/`toc-expand` = number OR boolean — `scalarType:"number"` + `acceptsBoolean`. */
const numBoolField: SchemaField = {
  name: "daemon",
  values: ["true", "false"],
  scalarType: "number",
  acceptsBoolean: true,
};

describe("isWrongValue — numeric fields (scalarType, the R predicate, numeric plan §2.3)", () => {
  it("accepts every YAML number literal quarto accepts (ints, floats, exp, radices, inf/nan, underscores)", () => {
    for (const v of [
      "6", "6.5", "-6", "+6", "0", "00", "09", "0777", "1e2", "1E2", "1.5e-3", "1.e2", "1e+2",
      ".5", ".5e2", "5.", "-0", "+0.5", "1_000", "0_0", "0x1A", "0o17", "0b101", ".inf", ".Inf",
      ".nan", ".NaN",
    ]) {
      expect(isWrongValue(v, numField), `${v} should be a valid number`).toBe(false);
    }
  });

  it("flags a non-number quarto rejects at its schema layer (wide, 6abc, 6px, 1,000, inf, nan)", () => {
    for (const v of ["wide", "6abc", "6px", "1,000", "inf", "nan", "1.0.0", ".", "+", "e2"]) {
      expect(isWrongValue(v, numField), `${v} should be flagged`).toBe(true);
    }
  });

  it("flags a QUOTED number — quarto rejects it as a string (fig-width: \"6\" / '6')", () => {
    expect(isWrongValue('"6"', numField)).toBe(true);
    expect(isWrongValue("'6'", numField)).toBe(true);
  });

  it("flags leading-underscore `_1` and sexagesimal `10:30` — NOT safe FNs, quarto rejects both", () => {
    expect(isWrongValue("_1", numField)).toBe(true);
    expect(isWrongValue("10:30", numField)).toBe(true);
  });

  it("flags a boolean on a PLAIN numeric field — a number field rejects true (fig-width: true)", () => {
    expect(isWrongValue("true", numField)).toBe(true);
  });

  it("leaves the deliberate safe FNs unflagged (superset R: +.5, -.5, 0X1A, 1_) — C1 over-acceptance", () => {
    for (const v of ["+.5", "-.5", "0X1A", "1_"]) {
      expect(isWrongValue(v, numField), `${v} is a deliberate safe FN`).toBe(false);
    }
  });

  it("accepts an unquoted value with a trailing inline comment (fig-width: 6  # note)", () => {
    // Belt-and-suspenders: the loops mostly pre-strip, but the matcher strips ` #…` too.
    expect(isWrongValue("6  # note", numField)).toBe(false);
    expect(isWrongValue("6 # note", numField)).toBe(false);
  });

  it("skips node-property / flow / block tokens on a numeric field (the cardinal-sin guard)", () => {
    for (const v of ["&a 6", "*a", "!expr 1+1", "[1, 2]", "{a: 1}", "|", ">"]) {
      expect(isWrongValue(v, numField), `${v} should be skipped`).toBe(false);
    }
  });

  it("skips an empty token on a numeric field (mid-edit fig-width:)", () => {
    expect(isWrongValue("", numField)).toBe(false);
  });
});

describe("isWrongValue — number-OR-boolean fields (daemon/toc-expand, acceptsBoolean)", () => {
  it("accepts both a number and the six boolean spellings (daemon: 30 / true / FALSE)", () => {
    for (const v of ["30", "0", "3.5", "true", "True", "TRUE", "false", "False", "FALSE"]) {
      expect(isWrongValue(v, numBoolField), `${v} should be valid for daemon`).toBe(false);
    }
  });

  it("flags a non-number, non-boolean value (daemon: banana)", () => {
    expect(isWrongValue("banana", numBoolField)).toBe(true);
  });

  it("flags a QUOTED number even on a boolean-accepting numeric field (daemon: \"30\")", () => {
    expect(isWrongValue('"30"', numBoolField)).toBe(true);
    expect(isWrongValue('"true"', numBoolField)).toBe(true); // quoted boolean is a string → rejected
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

describe("valueMessage — the wrong-value Error text (relocated to the pure core, plan §3.2 C / §11 dragon 9)", () => {
  it("phrases a closed string enum as 'expected one of: …'", () => {
    expect(valueMessage("banana", "code-overflow", enumField)).toBe(
      'Value banana is not valid for "code-overflow" — expected one of: scroll, wrap.',
    );
  });

  it("phrases a pure-boolean field as 'expected true or false'", () => {
    expect(valueMessage("maybe", "toc", boolField)).toBe(
      'Value maybe is not valid for "toc" — expected true or false.',
    );
  });

  it("phrases a boolean-accepting field that ALSO has an enum arm with 'expected one of' (echo), not the bare boolean phrasing", () => {
    expect(valueMessage("banana", "echo", echoField)).toBe(
      'Value banana is not valid for "echo" — expected one of: true, false, fenced.',
    );
  });

  it("phrases a numeric field as 'expected a number' (scalarType dispatched FIRST, numeric plan §3.4)", () => {
    expect(valueMessage("wide", "fig-width", numField)).toBe(
      'Value wide is not valid for "fig-width" — expected a number.',
    );
  });

  it("phrases a number-OR-boolean field as 'expected a number or true or false' (daemon)", () => {
    expect(valueMessage("banana", "daemon", numBoolField)).toBe(
      'Value banana is not valid for "daemon" — expected a number or true or false.',
    );
  });
});

/**
 * `numericMemberEnum` — a closed enum whose members are YAML *numbers* (matcher plan
 * §2.1/§3.1). Quarto COERCES the value numerically before matching, so the token is
 * validated by PARSED value, not string membership. Every row is grounded against
 * `quarto render` 1.7.33 (plan §2.3): an unquoted number literal whose value equals a
 * member is accepted (incl. coerced forms `3.0`/`+4`/`04`/`3e0`/`0169` and the YAML
 * digit-group UNDERSCORE forms `4_3`≡43 which `Number()` parses to NaN — the §9-review
 * HIGH, §7.3); an out-of-set number, a non-number, AND a quoted string (`"3"`/`"169"`)
 * are all flagged. `valueMessage` is unchanged (§2.7).
 */
/** `google-analytics.version` = `enum:[3,4]` (JS numbers) → numeric-member (`["3","4"]` stringified). */
const versionField: SchemaField = {
  name: "version",
  values: ["3", "4"],
  valuesClosed: true,
  numericMemberEnum: true,
};

/** `aspectratio` = `enum:[43,169,1610,149,141,54,32]` → numeric-member (document front matter). */
const aspectratioField: SchemaField = {
  name: "aspectratio",
  values: ["43", "169", "1610", "149", "141", "54", "32"],
  valuesClosed: true,
  numericMemberEnum: true,
};

describe("isWrongValue — numeric-member enums (parsed-value membership, coercion-aware)", () => {
  it("accepts an exact member, quoted-free (version: 3 / 4)", () => {
    expect(isWrongValue("3", versionField)).toBe(false);
    expect(isWrongValue("4", versionField)).toBe(false);
  });

  it("accepts a COERCED form equal to a member (version: 3.0 / 4.0 / +4 / 04 / 3e0) — quarto exit 0", () => {
    for (const v of ["3.0", "4.0", "+4", "04", "3e0"]) {
      expect(isWrongValue(v, versionField), `${v} should be accepted (coerces to a member)`).toBe(false);
    }
  });

  it("flags an out-of-set number (version: 5 / 3.5) — validation RESTORED", () => {
    expect(isWrongValue("5", versionField)).toBe(true);
    expect(isWrongValue("3.5", versionField)).toBe(true);
  });

  it("flags a non-number (version: banana)", () => {
    expect(isWrongValue("banana", versionField)).toBe(true);
  });

  it("flags the QUOTED form even when its content matches a member (version: \"3\" / '4') — quarto exit 1", () => {
    expect(isWrongValue('"3"', versionField)).toBe(true);
    expect(isWrongValue("'4'", versionField)).toBe(true);
  });

  it("accepts aspectratio members and their coerced forms (169 / 169.0 / +169 / 0169 / 43.0) — quarto exit 0", () => {
    for (const v of ["43", "169", "169.0", "+169", "0169", "43.0"]) {
      expect(isWrongValue(v, aspectratioField), `${v} should be accepted`).toBe(false);
    }
  });

  it("accepts MEMBER-VALUED digit-group underscores (aspectratio: 4_3≡43 / 1_610≡1610 / 16_10≡1610) — the NaN guard, quarto exit 0", () => {
    // Number("4_3") is NaN in JS, yet quarto coerces `4_3`→43 and renders exit 0. A naive
    // `Number()!==member → flag` branch ships a cardinal-sin FP here (matcher plan §7.3, dragon 11).
    for (const v of ["4_3", "1_610", "16_10"]) {
      expect(isWrongValue(v, aspectratioField), `${v} must NOT flag (coerces to a member; Number()=NaN)`).toBe(false);
    }
  });

  it("flags an out-of-set aspectratio number and a quoted form (aspectratio: 5 / banana / \"169\")", () => {
    expect(isWrongValue("5", aspectratioField)).toBe(true);
    expect(isWrongValue("banana", aspectratioField)).toBe(true);
    expect(isWrongValue('"169"', aspectratioField)).toBe(true);
  });

  it("still SKIPS empty / flow / node-property tokens on a numeric-member field (shared skip, plan §3.3)", () => {
    for (const v of ["", "[43]", "{v: 43}", "&anchor", "*alias", "!!int 43"]) {
      expect(isWrongValue(v, versionField), `${v} should be skipped (never flagged)`).toBe(false);
    }
  });

  it("valueMessage for a numeric-member enum is unchanged — 'expected one of: 3, 4' (§2.7)", () => {
    expect(valueMessage("5", "version", versionField)).toBe(
      'Value 5 is not valid for "version" — expected one of: 3, 4.',
    );
  });
});

/**
 * The NULL ARM (`acceptsNull`, document-key plan §2.5/§4.0) — a cross-surface correctness
 * fix, not a coverage slice. `valuesOfSchema` drops a literal `null` enum member while
 * `closednessOfSchema` still reports the enum CLOSED, so the matcher flagged the very value
 * quarto lists as valid. Every row is grounded firsthand against `quarto render` 1.7.33 on
 * the `.qmd` top level, the `.qmd` per-format path, and `_quarto.yml`:
 *
 *   auto-play-media: null | Null | NULL | ~   -> exit 0 (ACCEPTED)
 *   auto-play-media: NuLl | "null" | banana   -> exit 1, ``one of: `null`, `true`, `false```
 *   toc: null | ~                             -> exit 1 (no null arm — must keep flagging)
 *
 * So the accepted set is exactly YAML 1.2's four core null spellings, case-EXACT, unquoted.
 */

/** `auto-play-media` = `enum:[null, true, false]` — closed, boolean-accepting, null-admitting. */
const nullBoolField: SchemaField = {
  name: "auto-play-media",
  values: ["true", "false"],
  valuesClosed: true,
  acceptsBoolean: true,
  acceptsNull: true,
};

/** `ipynb-shell-interactivity` = `enum:[null, "all", …]` — closed string enum, null-admitting. */
const nullEnumField: SchemaField = {
  name: "ipynb-shell-interactivity",
  values: ["all", "last", "last_expr", "none", "last_expr_or_assign"],
  valuesClosed: true,
  acceptsNull: true,
};

describe("isWrongValue — the null arm (acceptsNull, document-key plan §2.5/§4.0)", () => {
  it("accepts all four YAML-1.2 null spellings on a null-admitting boolean enum", () => {
    for (const v of ["null", "Null", "NULL", "~"]) {
      expect(isWrongValue(v, nullBoolField), `auto-play-media: ${v} renders exit 0`).toBe(false);
    }
  });

  it("still FLAGS the case-inexact NuLl and the quoted \"null\" (both render exit 1)", () => {
    expect(isWrongValue("NuLl", nullBoolField)).toBe(true);
    expect(isWrongValue('"null"', nullBoolField)).toBe(true);
    expect(isWrongValue("'null'", nullBoolField)).toBe(true);
  });

  it("still FLAGS a genuinely wrong value on a null-admitting field (auto-play-media: banana)", () => {
    expect(isWrongValue("banana", nullBoolField)).toBe(true);
    expect(isWrongValue("banana", nullEnumField)).toBe(true);
  });

  it("accepts the null spellings on a null-admitting STRING enum too, and its real members", () => {
    for (const v of ["null", "Null", "NULL", "~"]) {
      expect(isWrongValue(v, nullEnumField), `ipynb-shell-interactivity: ${v}`).toBe(false);
    }
    expect(isWrongValue("all", nullEnumField)).toBe(false);
  });

  it("leaves a field WITHOUT a null arm flagging null — toc: null / ~ render exit 1", () => {
    // The precise cost of the fix: it must not loosen the 135 closed fields that have no
    // null arm. `toc: null`, `code-copy: null`, `df-print: null` are all quarto-REJECTED.
    for (const v of ["null", "Null", "NULL", "~"]) {
      expect(isWrongValue(v, boolField), `toc: ${v} renders exit 1`).toBe(true);
      expect(isWrongValue(v, enumField), `code-overflow: ${v} renders exit 1`).toBe(true);
    }
  });

  it("never flags on an OPEN field even when it admits null (the cardinal-sin guard still first)", () => {
    expect(isWrongValue("null", { ...openField, acceptsNull: true })).toBe(false);
    expect(isWrongValue("banana", { ...openField, acceptsNull: true })).toBe(false);
  });

  it("valueMessage lists null among the valid values, as quarto's own clause does", () => {
    // quarto: ``which must instead be one of: `null`, `true`, `false` `` (verified firsthand).
    expect(valueMessage("banana", "auto-play-media", nullBoolField)).toBe(
      'Value banana is not valid for "auto-play-media" — expected one of: null, true, false.',
    );
    expect(valueMessage("banana", "ipynb-shell-interactivity", nullEnumField)).toBe(
      'Value banana is not valid for "ipynb-shell-interactivity" — expected one of: null, all, last, last_expr, none, last_expr_or_assign.',
    );
  });

  it("valueMessage is UNCHANGED for a field without a null arm (toc / code-overflow)", () => {
    expect(valueMessage("maybe", "toc", boolField)).toBe(
      'Value maybe is not valid for "toc" — expected true or false.',
    );
    expect(valueMessage("banana", "code-overflow", enumField)).toBe(
      'Value banana is not valid for "code-overflow" — expected one of: scroll, wrap.',
    );
  });
});
