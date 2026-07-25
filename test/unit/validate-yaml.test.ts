import { describe, expect, it } from "vitest";
import { isValidationDisabledValue } from "../../src/core/validate-yaml";

describe("Session 163 — isValidationDisabledValue (quarto's `validate-yaml` escape hatch)", () => {
  it("treats the three YAML core-schema spellings of boolean false as disarming", () => {
    expect(isValidationDisabledValue("false")).toBe(true);
    expect(isValidationDisabledValue("False")).toBe(true);
    expect(isValidationDisabledValue("FALSE")).toBe(true);
  });

  it("leaves validation ON for every spelling quarto does not parse as boolean false", () => {
    // YAML 1.1 would read no/No/off/n as booleans; quarto's parser does not, and each
    // of these renders exit 1 on `#| echo: banana` — measured firsthand vs 1.7.33.
    for (const token of ["no", "No", "off", "n", "0", "null", "~", "true", "True"]) {
      expect(isValidationDisabledValue(token), token).toBe(false);
    }
    // A QUOTED scalar is the string "false", not the boolean — quarto renders exit 1.
    expect(isValidationDisabledValue('"false"')).toBe(false);
    expect(isValidationDisabledValue("'false'")).toBe(false);
    // Not a substring / prefix match, and not case-folded beyond the three spellings.
    expect(isValidationDisabledValue("falsey")).toBe(false);
    expect(isValidationDisabledValue("fAlSe")).toBe(false);
    expect(isValidationDisabledValue("")).toBe(false);
  });
});
