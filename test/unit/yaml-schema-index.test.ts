import { describe, expect, it } from "vitest";
import {
  CURATED_CELL_OPTIONS,
  CURATED_EXECUTE_KEYS,
  CURATED_FRONTMATTER_KEYS,
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
  "schema/document-options.yml": [
    { name: "toc", schema: "boolean", description: { short: "Table of contents." } },
    { name: "secret", hidden: true, schema: "string", description: "Hidden — excluded." },
  ],
  // Mirrors the real collision: the only `format` field in `document-*.yml` is an
  // epub-scoped STRING (no value enum). The index enriches it with the format names
  // so a top-level `format: <here>` scalar completes them (6d-6+).
  "schema/document-epub.yml": [
    { name: "format", schema: "string", description: "Text describing the format of this publication." },
  ],
  "schema/definitions.yml": [{ id: "page-column", enum: ["body", "page", "margin"] }],
  // The flat pandoc output-format list (6d-6 cont. format-name completion). Quarto
  // hides legacy variants (html4/html5, epub2/epub3, docbook4/docbook5) and concats
  // a few synthesized formats. Include BOTH hidden variants of each base so the
  // "hides legacy variants" assertions are all discriminating (not trivially absent).
  "pandoc/formats.yml": [
    "html", "html4", "html5",
    "epub", "epub2", "epub3",
    "docbook", "docbook4", "docbook5",
    "pdf", "revealjs", "typst",
  ],
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

describe("parseSchemaIndex — front-matter key extraction (6d-4)", () => {
  const index = parseSchemaIndex(FIXTURE);
  const fmNames = index.frontMatterKeys([]).map((f) => f.name);

  it("collects visible document-* keys as top-level front-matter keys", () => {
    expect(fmNames).toContain("freeze"); // schema/document-execute.yml
    expect(fmNames).toContain("toc"); // schema/document-options.yml
  });

  it("excludes hidden document keys", () => {
    expect(fmNames).not.toContain("secret");
  });

  it("keeps cell options OUT of the front-matter key set", () => {
    expect(fmNames).not.toContain("echo");
    expect(fmNames).not.toContain("column");
  });

  it("resolves front-matter key descriptions (short or scalar form)", () => {
    const toc = index.frontMatterKeys([]).find((f) => f.name === "toc");
    expect(toc?.description).toBe("Table of contents.");
  });

  it("serves the curated execute children for the `execute` path (6d-6)", () => {
    // Nested keys are curated-only in v1 (the live schema cannot assemble the
    // execute object without the deferred recursive walk), so the parsed index
    // returns the same curated set as the fallback — independent of the fixture.
    const names = index.frontMatterKeys(["execute"]).map((f) => f.name);
    expect(names).toContain("echo"); // a cell-shared flag, NOT a top-level doc key
    expect(names).toContain("freeze");
    expect(names).toEqual(CURATED_EXECUTE_KEYS.map((f) => f.name));
  });

  it("offers nothing for a non-allow-listed or deeper nested path (6d-6)", () => {
    expect(index.frontMatterKeys(["website"])).toEqual([]);
    expect(index.frontMatterKeys(["execute", "julia"])).toEqual([]);
  });

  // 6d-5 depends on the reader resolving values for document keys exactly as it
  // does for cell options (`toField` → `valuesOfSchema`). Lock that contract.
  it("resolves value enums on front-matter keys (6d-5)", () => {
    const valuesOf = (name: string): string[] | undefined =>
      index.frontMatterKeys([]).find((f) => f.name === name)?.values;
    expect(valuesOf("toc")).toEqual(["true", "false"]); // schema: "boolean"
    expect(valuesOf("freeze")).toEqual(["auto"]); // schema: { enum: ["auto"] }
  });
});

describe("parseSchemaIndex — format-name extraction (6d-6 cont.)", () => {
  const index = parseSchemaIndex(FIXTURE);
  const formatNames = index.frontMatterKeys(["format"]).map((f) => f.name);

  it("reads format names from pandoc/formats.yml for the `format` path", () => {
    for (const n of ["html", "epub", "docbook", "pdf", "revealjs", "typst"]) {
      expect(formatNames, `should include format ${n}`).toContain(n);
    }
  });

  it("concats Quarto's synthesized formats (md/hugo/dashboard/email)", () => {
    for (const n of ["md", "hugo", "dashboard", "email"]) {
      expect(formatNames, `should include synthesized ${n}`).toContain(n);
    }
  });

  it("hides legacy variants (html5/epub3/docbook5) but keeps the base names", () => {
    for (const hidden of ["html5", "epub3", "docbook5", "html4", "epub2", "docbook4"]) {
      expect(formatNames, `${hidden} must be hidden`).not.toContain(hidden);
    }
    for (const base of ["html", "epub", "docbook"]) {
      expect(formatNames, `${base} base name kept`).toContain(base);
    }
  });

  it("keeps format names OUT of the top-level and execute paths", () => {
    expect(index.frontMatterKeys([]).map((f) => f.name)).not.toContain("revealjs");
    expect(index.frontMatterKeys(["execute"]).map((f) => f.name)).not.toContain("revealjs");
  });

  it("enriches the top-level `format` key's value enum with the reader's format names (6d-6+)", () => {
    // The flat `document-*` list models `format` only as an epub-scoped string (no
    // enum); the index surfaces the reader-derived format names as its values, so a
    // top-level `format: <here>` scalar completes them. They are exactly the names
    // offered as KEYS under `format:` — including the reader-only `docbook` (absent
    // from the curated fallback), proving the enrichment is reader-derived.
    const fmtValues = index.frontMatterKeys([]).find((f) => f.name === "format")?.values;
    expect(fmtValues).toEqual(formatNames);
    expect(fmtValues, "reader-derived (docbook is not in the curated fallback)").toContain("docbook");
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

  it("degrades front-matter keys to the curated set on unparseable input", () => {
    const fmNames = parseSchemaIndex("not json {{{")
      .frontMatterKeys([])
      .map((f) => f.name);
    expect(fmNames).toEqual(CURATED_FRONTMATTER_KEYS.map((f) => f.name));
    expect(fmNames).not.toContain("freeze"); // schema-only → proves fallback, not a parse
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

  it("exposes the curated front-matter keys via frontMatterKeys([])", () => {
    expect(CURATED_SCHEMA_INDEX.frontMatterKeys([]).map((f) => f.name)).toEqual(
      CURATED_FRONTMATTER_KEYS.map((f) => f.name),
    );
  });

  it("offers no front-matter keys for an unhandled nested path", () => {
    // `format` is now an allow-listed nested container (6d-6 cont.); `website` is
    // not, so it stays the example of a deferred path that yields nothing.
    expect(CURATED_SCHEMA_INDEX.frontMatterKeys(["website"])).toEqual([]);
  });
});
