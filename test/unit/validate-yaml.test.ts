import { describe, expect, it } from "vitest";
import {
  cellsWithValidationDisabled,
  isValidationDisabledByFrontMatter,
  isValidationDisabledValue,
} from "../../src/core/validate-yaml";
import { findFrontMatterValueLines } from "../../src/core/yaml-frontmatter-values";
import { findCellOptionLines } from "../../src/core/qmd/model";

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

describe("Session 163 — isValidationDisabledByFrontMatter", () => {
  const fm = (text: string) => isValidationDisabledByFrontMatter(findFrontMatterValueLines(text));

  it("detects a top-level `validate-yaml: false`", () => {
    expect(fm("---\ntitle: t\nvalidate-yaml: false\n---\n\ntext\n")).toBe(true);
  });

  it("is false when the key is absent, or set to anything but boolean false", () => {
    expect(fm("---\ntitle: t\n---\n\ntext\n")).toBe(false);
    expect(fm("---\ntitle: t\nvalidate-yaml: true\n---\n\ntext\n")).toBe(false);
    expect(fm("---\ntitle: t\nvalidate-yaml: no\n---\n\ntext\n")).toBe(false);
  });

  it("honours the lexical shapes quarto honours (comment, spacing, quoted key)", () => {
    // Each measured firsthand at quarto exit 0 with an otherwise-invalid cell option.
    expect(fm("---\ntitle: t\nvalidate-yaml: false  # turn it off\n---\n\ntext\n")).toBe(true);
    expect(fm("---\ntitle: t\nvalidate-yaml:    false\n---\n\ntext\n")).toBe(true);
    expect(fm('---\ntitle: t\n"validate-yaml": false\n---\n\ntext\n')).toBe(true);
    expect(fm("---\ntitle: t\nvalidate-yaml: false   \n---\n\ntext\n")).toBe(true);
  });

  it("ignores a NESTED validate-yaml — quarto reads only the top-level key", () => {
    // Measured: `execute:` / `  validate-yaml: false` + `#| echo: banana` renders exit 1.
    expect(fm("---\ntitle: t\nexecute:\n  validate-yaml: false\n---\n\ntext\n")).toBe(false);
  });
});

describe("Session 163 — cellsWithValidationDisabled", () => {
  const cells = (text: string) =>
    cellsWithValidationDisabled(findCellOptionLines(text), text.split("\n"));

  it("reports the fence line of a cell whose own option block carries the flag", () => {
    const text = "---\ntitle: t\n---\n\n```{python}\n#| validate-yaml: false\n#| echo: banana\n1\n```\n";
    expect([...cells(text)]).toEqual([4]);
  });

  it("does NOT leak the flag from one cell to the next", () => {
    // Measured: cell 1 flagged, cell 2's `#| echo: banana` still renders exit 1.
    const text = [
      "---", "title: t", "---", "",
      "```{python}", "#| validate-yaml: false", "1", "```", "",
      "```{python}", "#| echo: banana", "2", "```", "",
    ].join("\n");
    expect([...cells(text)]).toEqual([4]);
  });

  it("is order-independent inside the block and works under any comment char", () => {
    // Measured: the flag AFTER the bad option still renders exit 0; `--|` in {sql} too.
    const after = "---\ntitle: t\n---\n\n```{python}\n#| echo: banana\n#| validate-yaml: false\n1\n```\n";
    expect([...cells(after)]).toEqual([4]);
    const sql = "---\ntitle: t\n---\n\n```{sql}\n--| validate-yaml: false\n--| echo: banana\nSELECT 1\n```\n";
    expect([...cells(sql)]).toEqual([4]);
  });

  it("ignores a flag outside the cell's LEADING option run, as quarto does", () => {
    // Measured: bad option leading + flag below code (or after a blank) renders exit 1.
    const belowCode = "---\ntitle: t\n---\n\n```{python}\n#| echo: banana\n1\n#| validate-yaml: false\n```\n";
    expect([...cells(belowCode)]).toEqual([]);
    const afterBlank = "---\ntitle: t\n---\n\n```{python}\n#| echo: banana\n\n#| validate-yaml: false\n1\n```\n";
    expect([...cells(afterBlank)]).toEqual([]);
  });

  it("honours a QUOTED per-cell key, which is the only thing pinning unquoteKey here", () => {
    // Measured: `#| "validate-yaml": false` + `#| echo: banana` renders quarto exit 0, so
    // NOT unquoting would flag a document quarto accepts. The §9 review found this claim
    // was made in the docstring and grounded firsthand, but pinned by nothing — the
    // `unquoteKey` call could be deleted with the whole suite still green.
    const dq = '---\ntitle: t\n---\n\n```{python}\n#| "validate-yaml": false\n#| echo: banana\n1\n```\n';
    expect([...cells(dq)]).toEqual([4]);
    const sq = "---\ntitle: t\n---\n\n```{python}\n#| 'validate-yaml': false\n#| echo: banana\n1\n```\n";
    expect([...cells(sq)]).toEqual([4]);
  });

  it("requires boolean false per-cell too", () => {
    const t = "---\ntitle: t\n---\n\n```{python}\n#| validate-yaml: true\n#| echo: banana\n1\n```\n";
    expect([...cells(t)]).toEqual([]);
  });
});
