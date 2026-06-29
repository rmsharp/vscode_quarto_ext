import { describe, expect, it } from "vitest";
import {
  CURATED_CELL_OPTIONS,
  CURATED_SCHEMA_INDEX,
  parseSchemaIndex,
} from "../../src/core/yaml-schema";

/**
 * A small fixture mirroring the SHAPE of the real installed schema file
 * `<share>/editor/tools/yaml/yaml-intelligence-resources.json` (probed live
 * against Quarto 1.7.33): a dict keyed by `schema/<file>.yml`; `cell-*` files
 * hold option entries; `definitions.yml` holds `{id, …}` refs; `document-*`
 * files hold front-matter keys (which cell-option completion must ignore).
 * Synthetic and small so the parser tests are hermetic — the real installed
 * file is exercised end-to-end in the integration host (Slice 6d-3 layer 5).
 */
const FIXTURE = JSON.stringify({
  "schema/cell-codeoutput.yml": [
    {
      name: "echo",
      schema: { anyOf: ["boolean", { enum: ["fenced"] }] },
      description: { short: "Show code.", long: "long form…" },
    },
    { name: "eval", schema: "boolean", description: "Evaluate the cell." },
  ],
  "schema/cell-figure.yml": [
    { name: "fig-cap", schema: { maybeArrayOf: "string" }, description: "Figure caption" },
    { name: "fig-width", tags: { engine: "knitr" }, schema: "number", description: "Width" },
    {
      name: "fig-align",
      schema: { enum: ["default", "left", "right", "center"] },
      description: "Alignment",
    },
  ],
  "schema/cell-pagelayout.yml": [
    { name: "column", schema: { ref: "page-column" }, description: { short: "Page column" } },
  ],
  "schema/cell-cache.yml": [
    { name: "cache", tags: { engine: "knitr" }, schema: "boolean", description: "Cache." },
    {
      name: "export",
      hidden: true,
      tags: { engine: "jupyter" },
      schema: "boolean",
      description: "Hidden — must be excluded.",
    },
  ],
  "schema/cell-textoutput.yml": [
    { name: "tags", tags: { engine: "jupyter" }, schema: { maybeArrayOf: "string" }, description: "Jupyter cell tags" },
    {
      name: "tbl-colwidths",
      tags: { engine: ["knitr", "jupyter"] },
      schema: { anyOf: ["boolean", { enum: ["auto"] }] },
      description: "Widths",
    },
    { name: "code-overflow", schema: { enum: ["scroll", "wrap"] }, description: "Overflow" },
    { name: "message", tags: { engine: "knitr" }, schema: { enum: [true, false, "NA"] }, description: "Messages" },
    { name: "label", schema: "string", description: { short: "Unique label" } },
    {
      name: "animation-hook",
      tags: { engine: "knitr" },
      schema: { string: { completions: ["ffmpeg", "gifski"] } },
      description: "Hook",
    },
  ],
  "schema/document-execute.yml": [
    { name: "freeze", schema: { enum: ["auto"] }, description: "Document key, not a cell option." },
  ],
  "schema/definitions.yml": [{ id: "page-column", enum: ["body", "page", "margin"] }],
});

describe("parseSchemaIndex — cell-option extraction", () => {
  const index = parseSchemaIndex(FIXTURE);
  const names = index.cellOptions().map((f) => f.name);

  it("collects every visible cell-option name across the cell-* files", () => {
    for (const n of [
      "echo", "eval", "fig-cap", "fig-width", "fig-align", "column", "cache",
      "tags", "tbl-colwidths", "code-overflow", "message", "label", "animation-hook",
    ]) {
      expect(names, `should include ${n}`).toContain(n);
    }
  });

  it("excludes hidden options", () => {
    expect(names).not.toContain("export");
  });

  it("excludes document (front-matter) keys", () => {
    expect(names).not.toContain("freeze");
  });

  it("resolves the description from `short` or the scalar form", () => {
    const fields = index.cellOptions();
    expect(fields.find((f) => f.name === "echo")?.description).toBe("Show code.");
    expect(fields.find((f) => f.name === "eval")?.description).toBe("Evaluate the cell.");
  });
});

describe("parseSchemaIndex — value resolution (simple cases)", () => {
  const fields = parseSchemaIndex(FIXTURE).cellOptions();
  const valuesOf = (name: string): string[] | undefined =>
    fields.find((f) => f.name === name)?.values;

  it("resolves a bare `boolean` schema to [true, false]", () => {
    expect(valuesOf("eval")).toEqual(["true", "false"]);
  });

  it("resolves an `enum` schema to its values", () => {
    expect(valuesOf("fig-align")).toEqual(["default", "left", "right", "center"]);
    expect(valuesOf("code-overflow")).toEqual(["scroll", "wrap"]);
  });

  it("resolves an `anyOf` of boolean + enum into the union", () => {
    expect(valuesOf("echo")).toEqual(["true", "false", "fenced"]);
    expect(valuesOf("tbl-colwidths")).toEqual(["true", "false", "auto"]);
  });

  it("stringifies non-string enum values (booleans → `true`/`false`)", () => {
    // `message: {enum: [true, false, "NA"]}` — JSON booleans become YAML scalars.
    expect(valuesOf("message")).toEqual(["true", "false", "NA"]);
  });

  it("resolves a `ref` through definitions.yml", () => {
    expect(valuesOf("column")).toEqual(["body", "page", "margin"]);
  });

  it("resolves a `string.completions` schema", () => {
    expect(valuesOf("animation-hook")).toEqual(["ffmpeg", "gifski"]);
  });

  it("leaves free-text / numeric / array-of-string options without an enum", () => {
    expect(valuesOf("fig-cap")).toBeUndefined(); // maybeArrayOf string
    expect(valuesOf("fig-width")).toBeUndefined(); // number
    expect(valuesOf("label")).toBeUndefined(); // string
  });
});

describe("parseSchemaIndex — engine tags & filtering", () => {
  const index = parseSchemaIndex(FIXTURE);
  const engineOf = (name: string): string | undefined =>
    index.cellOptions().find((f) => f.name === name)?.engine;
  const namesFor = (engine?: "knitr" | "jupyter" | "ojs"): string[] =>
    index.cellOptions(engine).map((f) => f.name);

  it("reads `tags.engine` for single-engine options", () => {
    expect(engineOf("cache")).toBe("knitr");
    expect(engineOf("fig-width")).toBe("knitr");
    expect(engineOf("message")).toBe("knitr");
    expect(engineOf("tags")).toBe("jupyter");
  });

  it("treats an engine-agnostic or multi-engine option as unset", () => {
    expect(engineOf("echo")).toBeUndefined(); // no tags.engine
    expect(engineOf("tbl-colwidths")).toBeUndefined(); // ["knitr","jupyter"] → all
  });

  it("includes engine-agnostic options for every engine", () => {
    for (const engine of ["knitr", "jupyter", "ojs"] as const) {
      expect(namesFor(engine), `${engine}`).toContain("echo");
      expect(namesFor(engine), `${engine} (multi-engine)`).toContain("tbl-colwidths");
    }
  });

  it("excludes other-engine options when an engine is given", () => {
    const jupyter = namesFor("jupyter");
    expect(jupyter).toContain("tags"); // jupyter-only
    for (const knitrOnly of ["cache", "fig-width", "message", "animation-hook"]) {
      expect(jupyter, `jupyter must exclude ${knitrOnly}`).not.toContain(knitrOnly);
    }
    const knitr = namesFor("knitr");
    expect(knitr).toContain("cache"); // knitr-only
    expect(knitr).not.toContain("tags"); // jupyter-only
  });

  it("offers only engine-agnostic options for ojs cells", () => {
    const ojs = namesFor("ojs");
    expect(ojs).toContain("echo");
    expect(ojs).not.toContain("cache"); // knitr
    expect(ojs).not.toContain("tags"); // jupyter
  });

  it("does not filter when the engine is unknown (returns the full set)", () => {
    expect(namesFor(undefined)).toContain("cache");
    expect(namesFor(undefined)).toContain("tags");
  });
});

describe("parseSchemaIndex — robustness & fallback", () => {
  it("degrades to the curated fallback on unparseable input (never throws)", () => {
    const names = parseSchemaIndex("this is not json {{{").cellOptions().map((f) => f.name);
    expect(names).toContain("layout-ncol"); // curated-only
    expect(names).not.toContain("code-overflow"); // schema-only → proves fallback, not a parse
  });

  it("degrades to the curated fallback when no cell options are present", () => {
    const names = parseSchemaIndex("{}").cellOptions().map((f) => f.name);
    expect(names).toEqual(CURATED_CELL_OPTIONS.map((f) => f.name));
  });

  it("degrades to the curated fallback on a non-object JSON root", () => {
    expect(() => parseSchemaIndex("null")).not.toThrow();
    expect(parseSchemaIndex("null").cellOptions().map((f) => f.name)).toEqual(
      CURATED_CELL_OPTIONS.map((f) => f.name),
    );
  });

  it("strips a leading UTF-8 BOM before parsing", () => {
    const names = parseSchemaIndex("﻿" + FIXTURE).cellOptions().map((f) => f.name);
    expect(names).toContain("code-overflow"); // proves the fixture parsed, not the fallback
  });
});

describe("CURATED_SCHEMA_INDEX — the fallback view", () => {
  it("exposes the curated set as a SchemaIndex", () => {
    expect(CURATED_SCHEMA_INDEX.cellOptions().map((f) => f.name)).toEqual(
      CURATED_CELL_OPTIONS.map((f) => f.name),
    );
  });

  it("applies engine filtering to the curated set too", () => {
    const jupyter = CURATED_SCHEMA_INDEX.cellOptions("jupyter").map((f) => f.name);
    expect(jupyter).toContain("echo");
    expect(jupyter).not.toContain("cache"); // knitr-only in the curated set
  });
});
