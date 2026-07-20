import { describe, expect, it } from "vitest";
import { CURATED_SCHEMA_INDEX, parseSchemaIndex } from "../../src/core/yaml-schema";

/**
 * `parseSchemaIndex` must derive, per field, whether the field's value is a bare
 * NUMBER (`scalarType: "number"`) and whether it ALSO accepts booleans
 * (`acceptsBoolean`) — the bit the numeric branch of value validation gates on
 * (numeric plan §3.2). `numericTypeOfSchema` is the structural sibling of
 * `closednessOfSchema`: it walks the SAME arms in the same order but SPLITS the
 * bare-string arm so `"number"`/`"integer"` resolve to numeric (dragon #8), and it
 * recurses `maybeArrayOf` (so `maybeArrayOf[number]` = `number-offset` is marked,
 * its array form skip-guarded by the matcher). Risk polarity is INVERTED like the
 * sibling's: a field with ANY string/enum/object/array arm stays UNMARKED (open) —
 * marking such a field numeric would be the cardinal-sin false positive.
 */
const FIXTURE = JSON.stringify({
  "schema/cell-numbers.yml": [
    // MARKED — bare number / integer (the SPLIT bare-string arm, dragon #8).
    { name: "fig-width", schema: "number", description: "width" },
    { name: "columns", schema: "number", description: "cols" },
    { name: "some-int", schema: "integer", description: "an integer leaf (defensive — no integer leaf exists in 1.7.33)" },
    // MARKED — maybeArrayOf[number] recurses into number (number-offset shape).
    { name: "number-offset", schema: { maybeArrayOf: "number" }, description: "offset" },
    // MARKED + acceptsBoolean — number OR boolean (toc-expand / daemon shape).
    { name: "toc-expand", schema: { anyOf: ["number", "boolean"] }, description: "toc-expand" },
    // MARKED — a ref resolving to a number definition (the ref arm).
    { name: "dpi-ref", schema: { ref: "dpi-number" }, description: "dpi via ref" },
    // MARKED via the objectChildren choke point — a numeric CHILD of an object field;
    // the object container itself is NOT numeric, but its `fig-dpi` child is.
    {
      name: "fmtblock",
      schema: { object: { properties: { "fig-dpi": "number", "theme": "string" } } },
      description: "a per-format object block",
    },
  ],
  "schema/cell-mixed.yml": [
    // UNMARKED — every mixed field has a string/enum/object/array arm (open, §7.4).
    { name: "linestretch", schema: { anyOf: ["number", "string"] }, description: "number|string" },
    { name: "margin", schema: { anyOf: ["number", { object: { properties: {} } }] }, description: "number|object" },
    { name: "auto-slide", schema: { anyOf: ["number", { enum: [false] }] }, description: "number|enum[false]" },
    { name: "fig-keep", schema: { anyOf: [{ arrayOf: "string" }, { enum: ["none"] }, "number"] }, description: "array|enum|number" },
    // UNMARKED — an all-NUMERIC enum is still a CLOSED set (enum path, not numeric).
    { name: "aspectratio", schema: { enum: [169, 43] }, description: "numeric enum" },
    // UNMARKED — a plain string enum, a bare string, and a bare boolean.
    { name: "echo", schema: { enum: ["true", "false", "fenced"] }, description: "echo" },
    { name: "engine", schema: "string", description: "engine" },
    { name: "flag", schema: "boolean", description: "a pure boolean — NOT numeric" },
  ],
  "schema/definitions.yml": [
    { id: "dpi-number", schema: "number" },
  ],
});

describe("parseSchemaIndex — numeric scalarType (numericTypeOfSchema, numeric plan §3.2)", () => {
  const byName = new Map(parseSchemaIndex(FIXTURE).cellOptions().map((f) => [f.name, f]));

  it("marks a bare number field numeric (fig-width, columns)", () => {
    expect(byName.get("fig-width")?.scalarType).toBe("number");
    expect(byName.get("fig-width")?.acceptsBoolean).toBeFalsy();
    expect(byName.get("columns")?.scalarType).toBe("number");
  });

  it("marks a bare integer field numeric (the SPLIT bare-string arm, dragon #8)", () => {
    expect(byName.get("some-int")?.scalarType).toBe("number");
  });

  it("marks maybeArrayOf[number] numeric (number-offset — array form skip-guarded by the matcher)", () => {
    expect(byName.get("number-offset")?.scalarType).toBe("number");
  });

  it("marks a number-OR-boolean field numeric AND boolean-accepting (toc-expand)", () => {
    expect(byName.get("toc-expand")?.scalarType).toBe("number");
    expect(byName.get("toc-expand")?.acceptsBoolean).toBe(true);
  });

  it("marks a ref→number field numeric (the ref arm)", () => {
    expect(byName.get("dpi-ref")?.scalarType).toBe("number");
  });

  it("marks a numeric CHILD via the objectChildren choke point, not the object container (fmtblock.fig-dpi)", () => {
    const block = byName.get("fmtblock");
    expect(block?.scalarType).toBeFalsy(); // the container is NOT numeric
    const child = block?.children?.find((c) => c.name === "fig-dpi");
    expect(child?.scalarType).toBe("number");
    const theme = block?.children?.find((c) => c.name === "theme");
    expect(theme?.scalarType).toBeFalsy(); // a string child is not numeric
  });

  it("leaves a MIXED field (any string/enum/object/array arm) UNMARKED (the cardinal-sin guard)", () => {
    for (const n of ["linestretch", "margin", "auto-slide", "fig-keep"]) {
      expect(byName.get(n)?.scalarType, `${n} must stay open`).toBeFalsy();
    }
  });

  it("leaves an all-numeric ENUM unmarked — a closed set is the enum path, not the numeric one (aspectratio)", () => {
    expect(byName.get("aspectratio")?.scalarType).toBeFalsy();
  });

  it("leaves an enum, a bare string, and a pure boolean field unmarked (echo, engine, flag)", () => {
    expect(byName.get("echo")?.scalarType).toBeFalsy();
    expect(byName.get("engine")?.scalarType).toBeFalsy();
    expect(byName.get("flag")?.scalarType).toBeFalsy(); // a pure boolean is NOT numeric
  });
});

/**
 * The curated `daemon` (numeric plan §3.2) — `frontMatterKeys(["execute"])` returns
 * `CURATED_EXECUTE_KEYS` UNCONDITIONALLY (yaml-schema.ts:291), so the curated
 * constant must carry `scalarType:"number"` + `acceptsBoolean:true` by hand for the
 * numeric branch to reach `execute.daemon`. Grounded: `daemon: 30` / `daemon: true`
 * render exit 0, `daemon: banana` / `daemon: "30"` render exit 1 (numeric plan §2.2).
 */
describe("CURATED_EXECUTE_KEYS — curated numeric daemon (numeric plan §3.2)", () => {
  const byName = new Map(
    CURATED_SCHEMA_INDEX.frontMatterKeys(["execute"]).map((f) => [f.name, f]),
  );

  it("marks daemon numeric AND boolean-accepting (number-OR-boolean), keeping it enum-OPEN", () => {
    expect(byName.get("daemon")?.scalarType).toBe("number");
    expect(byName.get("daemon")?.acceptsBoolean).toBe(true);
    expect(byName.get("daemon")?.valuesClosed).toBeFalsy(); // still enum-OPEN — numeric branch handles it
  });

  it("does NOT mark a boolean execute option numeric (eval stays enum-only)", () => {
    expect(byName.get("eval")?.scalarType).toBeFalsy();
    expect(byName.get("eval")?.valuesClosed).toBe(true);
  });
});
