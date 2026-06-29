import { describe, expect, it } from "vitest";
import {
  CURATED_CELL_OPTIONS,
  CURATED_EXECUTE_KEYS,
  CURATED_FRONTMATTER_KEYS,
  CURATED_SCHEMA_INDEX,
} from "../../src/core/yaml-schema";

/**
 * CURATED_CELL_OPTIONS is the permanent fallback set the YAML completion provider
 * serves (and that the future runtime schema reader, 6d-3, degrades to). These
 * guard the data contract the provider depends on — not "imagined behavior".
 */
describe("CURATED_CELL_OPTIONS — data contract", () => {
  it("is a non-empty set of well-formed fields (name + description)", () => {
    expect(CURATED_CELL_OPTIONS.length).toBeGreaterThanOrEqual(15);
    for (const field of CURATED_CELL_OPTIONS) {
      expect(field.name).toMatch(/^[A-Za-z][A-Za-z0-9-]*$/);
      expect(field.description, `${field.name} needs a description`).toBeTruthy();
    }
  });

  it("has unique names", () => {
    const names = CURATED_CELL_OPTIONS.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("includes the highest-frequency execution options", () => {
    const names = new Set(CURATED_CELL_OPTIONS.map((f) => f.name));
    for (const expected of ["echo", "eval", "output", "warning", "label", "fig-cap"]) {
      expect(names.has(expected), `curated set should include ${expected}`).toBe(true);
    }
  });

  it("tags knitr-only options with the knitr engine", () => {
    const cache = CURATED_CELL_OPTIONS.find((f) => f.name === "cache");
    expect(cache?.engine).toBe("knitr");
  });
});

/**
 * The curated value enums for 6d-2 value completion. Grounded against the live
 * Quarto 1.7.33 schema (`schema/cell-*.yml` + the resolved `page-column` def):
 * the value *forms* are uncopyrightable facts. Only enum/boolean options carry
 * `values`; free-text/number options (label, fig-cap, code-summary, layout-ncol)
 * leave it unset so value completion offers nothing there.
 */
describe("CURATED_CELL_OPTIONS — value enums (6d-2)", () => {
  function valuesOf(name: string): string[] | undefined {
    return CURATED_CELL_OPTIONS.find((f) => f.name === name)?.values;
  }

  it("gives boolean options exactly [true, false]", () => {
    for (const name of ["eval", "warning", "error", "include", "cache"]) {
      expect(valuesOf(name), `${name} values`).toEqual(["true", "false"]);
    }
  });

  it("offers echo's boolean + `fenced`", () => {
    expect(valuesOf("echo")).toEqual(["true", "false", "fenced"]);
  });

  it("offers output's boolean + `asis`", () => {
    expect(valuesOf("output")).toEqual(["true", "false", "asis"]);
  });

  it("offers code-fold's boolean + `show`", () => {
    expect(valuesOf("code-fold")).toEqual(["true", "false", "show"]);
  });

  it("offers fig-align's four alignments", () => {
    expect(valuesOf("fig-align")).toEqual(["default", "left", "right", "center"]);
  });

  it("offers the COMPLETE page-column enum for column (all 18, in schema order)", () => {
    // Exact equality, not a spot-check: the full resolved page-column enum from
    // Quarto 1.7.33 (schema/definitions.yml). A spot-check `toContain` let an
    // earlier 17-of-18 transcription (`page-inset` dropped) slip through.
    expect(valuesOf("column")).toEqual([
      "body",
      "body-outset",
      "body-outset-left",
      "body-outset-right",
      "page",
      "page-left",
      "page-right",
      "page-inset",
      "page-inset-left",
      "page-inset-right",
      "screen",
      "screen-left",
      "screen-right",
      "screen-inset",
      "screen-inset-shaded",
      "screen-inset-left",
      "screen-inset-right",
      "margin",
    ]);
  });

  it("leaves free-text / numeric options without a value enum", () => {
    for (const name of ["label", "fig-cap", "code-summary", "layout-ncol"]) {
      expect(valuesOf(name), `${name} should have no enum`).toBeUndefined();
    }
  });

  it("has only non-empty string values where present", () => {
    for (const field of CURATED_CELL_OPTIONS) {
      if (field.values === undefined) {
        continue;
      }
      expect(field.values.length).toBeGreaterThan(0);
      for (const v of field.values) {
        expect(typeof v).toBe("string");
        expect(v.length).toBeGreaterThan(0);
      }
    }
  });
});

/**
 * CURATED_FRONTMATTER_KEYS is the permanent fallback for front-matter top-level
 * KEY completion (6d-4), served when the runtime schema reader is unavailable.
 * Names are uncopyrightable facts (verified present in the Quarto 1.7.33 schema);
 * descriptions are our own wording. It deliberately includes the common CONTAINER
 * key `execute`, which the flat `schema/document-*.yml` name list omits
 * structurally (it lives in `schema/schema.yml`'s object graph — surfacing it from
 * the live schema is the deferred recursive-resolution work, 6d-6). `format` is
 * also included for the offline case (a same-named epub-scoped `format` field is
 * in the flat list, so the live reader surfaces `format` from there).
 */
describe("CURATED_FRONTMATTER_KEYS — data contract", () => {
  it("is a non-empty set of well-formed fields (name + description)", () => {
    expect(CURATED_FRONTMATTER_KEYS.length).toBeGreaterThanOrEqual(10);
    for (const field of CURATED_FRONTMATTER_KEYS) {
      expect(field.name).toMatch(/^[A-Za-z][A-Za-z0-9-]*$/);
      expect(field.description, `${field.name} needs a description`).toBeTruthy();
    }
  });

  it("has unique names", () => {
    const names = CURATED_FRONTMATTER_KEYS.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("includes the highest-frequency document keys", () => {
    const names = new Set(CURATED_FRONTMATTER_KEYS.map((f) => f.name));
    for (const expected of [
      "title", "author", "format", "execute", "bibliography", "toc",
    ]) {
      expect(names.has(expected), `curated set should include ${expected}`).toBe(true);
    }
  });

  it("carries no cell engine tag (front-matter keys are document-level)", () => {
    for (const field of CURATED_FRONTMATTER_KEYS) {
      expect(field.engine, `${field.name} must not be engine-tagged`).toBeUndefined();
    }
  });
});

/**
 * The curated value enums for 6d-5 front-matter VALUE completion. Grounded against
 * the live Quarto 1.7.33 schema (`schema/document-*.yml`): `toc` and
 * `number-sections` resolve to a plain boolean there. Exact equality, never a
 * `toContain` spot-check (Learning #26). Free-text keys (title, author, …) carry
 * no enum so value completion offers nothing there.
 */
describe("CURATED_FRONTMATTER_KEYS — value enums (6d-5)", () => {
  function valuesOf(name: string): string[] | undefined {
    return CURATED_FRONTMATTER_KEYS.find((f) => f.name === name)?.values;
  }

  it("gives boolean document keys exactly [true, false]", () => {
    for (const name of ["toc", "number-sections"]) {
      expect(valuesOf(name), `${name} values`).toEqual(["true", "false"]);
    }
  });

  it("leaves free-text document keys without a value enum", () => {
    for (const name of ["title", "author", "date", "format", "bibliography"]) {
      expect(valuesOf(name), `${name} should have no enum`).toBeUndefined();
    }
  });

  it("has only non-empty string values where present", () => {
    for (const field of CURATED_FRONTMATTER_KEYS) {
      if (field.values === undefined) {
        continue;
      }
      expect(field.values.length).toBeGreaterThan(0);
      for (const v of field.values) {
        expect(typeof v).toBe("string");
        expect(v.length).toBeGreaterThan(0);
      }
    }
  });
});

/**
 * CURATED_EXECUTE_KEYS is the curated set of children offered one level under the
 * `execute:` front-matter container (Slice 6d-6, the cheap one-level approximation).
 * Names are grounded against the Quarto 1.7.33 schema (`schema/cell-codeoutput`/
 * `cell-textoutput`/`cell-cache` for the shared execution flags; `document-execute`/
 * `document-render` for the rest); descriptions are our own. The live schema cannot
 * assemble this set without the deferred recursive walk, so it is curated-only.
 */
describe("CURATED_EXECUTE_KEYS — nested execute children (6d-6)", () => {
  it("is exactly the curated execute child-key set (grounded, in order)", () => {
    expect(CURATED_EXECUTE_KEYS.map((f) => f.name)).toEqual([
      "eval",
      "echo",
      "output",
      "warning",
      "error",
      "include",
      "cache",
      "freeze",
      "enabled",
      "daemon",
      "daemon-restart",
      "keep-md",
      "keep-ipynb",
    ]);
  });

  it("gives every execute child a non-empty name and description", () => {
    for (const field of CURATED_EXECUTE_KEYS) {
      expect(field.name.length).toBeGreaterThan(0);
      expect(field.description, `${field.name} description`).toBeTruthy();
    }
  });

  it("is what CURATED_SCHEMA_INDEX serves for the `execute` path", () => {
    expect(CURATED_SCHEMA_INDEX.frontMatterKeys(["execute"])).toEqual(
      CURATED_EXECUTE_KEYS,
    );
  });

  it("offers nothing for a non-allow-listed or deeper nested path", () => {
    expect(CURATED_SCHEMA_INDEX.frontMatterKeys(["website"])).toEqual([]);
    expect(CURATED_SCHEMA_INDEX.frontMatterKeys(["execute", "julia"])).toEqual([]);
  });
});
