import { describe, expect, it } from "vitest";
import { CURATED_SCHEMA_INDEX, parseSchemaIndex } from "../../src/core/yaml-schema";

/**
 * `parseSchemaIndex` must derive, per field, whether its value set is provably
 * CLOSED (`valuesClosed`) and whether it accepts the YAML-1.2 boolean type
 * (`acceptsBoolean`) — the two bits value-validation gates on (plan §3.2). Every
 * shape below is grounded firsthand against Quarto 1.7.33's live schema. The
 * load-bearing cases are the two OPEN families that still populate a non-empty
 * `values`: an `anyOf` with a free `string`/`object` arm (`output`), and a bare
 * `string:{completions}` whose hints look like an enum (`animation-hook`). Both
 * must be `valuesClosed`-unset — flagging either is the cardinal-sin false
 * positive (plan §7.1).
 */
const FIXTURE = JSON.stringify({
  "schema/cell-codeoutput.yml": [
    // CLOSED — anyOf[boolean, enum]: accepts booleans AND one enum member.
    { name: "echo", schema: { anyOf: ["boolean", { enum: ["fenced"] }] }, description: "echo" },
    // CLOSED — bare boolean.
    { name: "eval", schema: "boolean", description: "eval" },
    // CLOSED — bare string enum, NOT boolean.
    { name: "code-overflow", schema: { enum: ["scroll", "wrap"] }, description: "overflow" },
    // CLOSED enum whose MEMBERS include real YAML booleans — quarto accepts the six
    // boolean spellings for these (message: True → exit 0), so acceptsBoolean must be
    // true even though the node is an enum, not a boolean type (adversarial review, S124).
    { name: "message", schema: { enum: [true, false, "NA"] }, description: "messages" },
    // CLOSED enum with ONE boolean member (false) among strings (results).
    { name: "results", schema: { enum: ["markup", "asis", "hold", "hide", false] }, description: "results" },
  ],
  "schema/cell-textoutput.yml": [
    // OPEN — anyOf with a free `string`/`object` arm, yet `values` = [true,false,asis].
    { name: "output", schema: { anyOf: ["boolean", { enum: ["asis"] }, "string", "object"] }, description: "output" },
    // OPEN — bare string:{completions}: hints look closed but any string renders.
    { name: "animation-hook", schema: { string: { completions: ["ffmpeg", "gifski"] } }, description: "hook" },
    // OPEN — bare string / number.
    { name: "label", schema: "string", description: "label" },
    { name: "fig-width", schema: "number", description: "width" },
    // OPEN — maybeArrayOf a free string.
    { name: "fig-cap", schema: { maybeArrayOf: "string" }, description: "caption" },
  ],
  "schema/cell-pagelayout.yml": [
    // CLOSED — maybeArrayOf an enum (inherits inner closedness).
    { name: "fig-align", schema: { maybeArrayOf: { enum: ["default", "left", "right", "center"] } }, description: "align" },
    // CLOSED — a ref resolving to an enum definition.
    { name: "column", schema: { ref: "page-column" }, description: "column" },
  ],
  "schema/definitions.yml": [
    { id: "page-column", enum: ["body", "page", "margin"] },
  ],
});

describe("parseSchemaIndex — value closedness (valuesClosed / acceptsBoolean, plan §3.2)", () => {
  const byName = new Map(parseSchemaIndex(FIXTURE).cellOptions().map((f) => [f.name, f]));

  it("marks a bare boolean closed AND boolean-accepting", () => {
    expect(byName.get("eval")?.valuesClosed).toBe(true);
    expect(byName.get("eval")?.acceptsBoolean).toBe(true);
  });

  it("marks anyOf[boolean, enum] closed AND boolean-accepting (echo)", () => {
    expect(byName.get("echo")?.valuesClosed).toBe(true);
    expect(byName.get("echo")?.acceptsBoolean).toBe(true);
  });

  it("marks a bare string enum closed but NOT boolean-accepting (code-overflow)", () => {
    expect(byName.get("code-overflow")?.valuesClosed).toBe(true);
    expect(byName.get("code-overflow")?.acceptsBoolean).toBeFalsy();
  });

  it("marks an enum whose members include YAML booleans as boolean-accepting (message, results)", () => {
    // quarto accepts message: True / TRUE / FALSE (exit 0), so the six spellings must pass.
    expect(byName.get("message")?.valuesClosed).toBe(true);
    expect(byName.get("message")?.acceptsBoolean).toBe(true);
    expect(byName.get("results")?.valuesClosed).toBe(true);
    expect(byName.get("results")?.acceptsBoolean).toBe(true);
  });

  it("marks maybeArrayOf[enum] and ref→enum closed (fig-align, column)", () => {
    expect(byName.get("fig-align")?.valuesClosed).toBe(true);
    expect(byName.get("column")?.valuesClosed).toBe(true);
  });

  it("leaves an anyOf with a free string/object arm OPEN despite a non-empty values (output)", () => {
    // The FIRST flagship trap — output renders any string (exit 0).
    expect(byName.get("output")?.values).toContain("asis"); // values IS populated
    expect(byName.get("output")?.valuesClosed).toBeFalsy(); // …but it is OPEN
  });

  it("leaves a bare string:{completions} field OPEN despite completions in values (animation-hook)", () => {
    // The SECOND trap — completions are hints, any string renders (exit 0).
    expect(byName.get("animation-hook")?.values).toContain("ffmpeg"); // completions ARE in values
    expect(byName.get("animation-hook")?.valuesClosed).toBeFalsy(); // …but it is OPEN
  });

  it("leaves bare string / number / maybeArrayOf[string] fields OPEN (label, fig-width, fig-cap)", () => {
    expect(byName.get("label")?.valuesClosed).toBeFalsy();
    expect(byName.get("fig-width")?.valuesClosed).toBeFalsy();
    expect(byName.get("fig-cap")?.valuesClosed).toBeFalsy();
  });
});

/**
 * The OFFLINE fallback (`CURATED_SCHEMA_INDEX`), served when the installed Quarto
 * schema can't be read, must carry the SAME closedness annotations as the live
 * schema for the fields it curates — hand-annotated to match Quarto 1.7.33
 * (grounded firsthand, plan §7.5). Above all, `output` (an anyOf with a free
 * string arm) must stay OPEN offline too — a curated field wrongly marked closed
 * would false-positive whenever Quarto is unreachable.
 */
describe("CURATED_SCHEMA_INDEX — offline closedness matches the live schema", () => {
  const byName = new Map(CURATED_SCHEMA_INDEX.cellOptions().map((f) => [f.name, f]));

  it("marks the curated boolean cell options closed + boolean-accepting", () => {
    for (const n of ["eval", "warning", "error", "include", "cache"]) {
      expect(byName.get(n)?.valuesClosed, `${n} closed`).toBe(true);
      expect(byName.get(n)?.acceptsBoolean, `${n} acceptsBoolean`).toBe(true);
    }
  });

  it("marks echo and code-fold (anyOf[boolean, enum]) closed + boolean-accepting", () => {
    expect(byName.get("echo")?.valuesClosed).toBe(true);
    expect(byName.get("echo")?.acceptsBoolean).toBe(true);
    expect(byName.get("code-fold")?.valuesClosed).toBe(true);
    expect(byName.get("code-fold")?.acceptsBoolean).toBe(true);
  });

  it("marks the pure string enums (fig-align, column) closed but NOT boolean-accepting", () => {
    expect(byName.get("fig-align")?.valuesClosed).toBe(true);
    expect(byName.get("fig-align")?.acceptsBoolean).toBeFalsy();
    expect(byName.get("column")?.valuesClosed).toBe(true);
  });

  it("leaves the OPEN curated field `output` unmarked offline (the cardinal-sin guard)", () => {
    expect(byName.get("output")?.values).toContain("asis"); // has values…
    expect(byName.get("output")?.valuesClosed).toBeFalsy(); // …but must stay OPEN
  });
});

/**
 * NESTED front-matter value validation (nested plan L1, §3.2). `frontMatterKeys(["execute"])`
 * returns `CURATED_EXECUTE_KEYS` UNCONDITIONALLY (yaml-schema.ts:517-519) — even under a parsed
 * live schema — because the live schema assembles the execute object across files (deferred
 * recursive resolution). Those curated fields must therefore carry the closedness bits by hand for
 * value validation to reach them. Every row below is grounded to `quarto render` 1.7.33 (plan §2.1).
 * The load-bearing OPEN cases are `output` (anyOf free arm — `output: banana` exit 0) and `daemon`
 * (boolean-OR-number — `daemon: 30` exit 0): a closed-boolean mark on either is the cardinal-sin FP,
 * so both must stay `valuesClosed`-unset (plan §3.2, §7.5).
 */
describe("CURATED_EXECUTE_KEYS — nested execute closedness (nested plan L1, §3.2)", () => {
  // The accessor validation actually inverts — returns the curated constant for BOTH indices.
  const byName = new Map(
    CURATED_SCHEMA_INDEX.frontMatterKeys(["execute"]).map((f) => [f.name, f]),
  );

  it("marks the boolean execute options closed + boolean-accepting", () => {
    for (const n of [
      "eval",
      "warning",
      "error",
      "include",
      "enabled",
      "daemon-restart",
      "keep-md",
      "keep-ipynb",
    ]) {
      expect(byName.get(n)?.valuesClosed, `${n} closed`).toBe(true);
      expect(byName.get(n)?.acceptsBoolean, `${n} acceptsBoolean`).toBe(true);
    }
  });

  it("marks echo (true/false/fenced) closed + boolean-accepting", () => {
    expect(byName.get("echo")?.valuesClosed).toBe(true);
    expect(byName.get("echo")?.acceptsBoolean).toBe(true);
    expect(byName.get("echo")?.values).toEqual(["true", "false", "fenced"]);
  });

  it("marks cache (true/false/refresh) and freeze (true/false/auto) closed + boolean-accepting", () => {
    expect(byName.get("cache")?.valuesClosed).toBe(true);
    expect(byName.get("cache")?.acceptsBoolean).toBe(true);
    expect(byName.get("freeze")?.valuesClosed).toBe(true);
    expect(byName.get("freeze")?.acceptsBoolean).toBe(true);
  });

  it("leaves `output` OPEN — anyOf free arm, `output: banana` renders exit 0 (cardinal-sin guard)", () => {
    expect(byName.get("output")?.values).toContain("asis"); // values IS populated…
    expect(byName.get("output")?.valuesClosed).toBeFalsy(); // …but it must stay OPEN
  });

  it("leaves `daemon` OPEN — boolean-OR-number, `daemon: 30` renders exit 0 (numeric slice's job)", () => {
    expect(byName.get("daemon")?.values).toContain("true"); // values IS populated…
    expect(byName.get("daemon")?.valuesClosed).toBeFalsy(); // …but it must stay OPEN
  });
});
