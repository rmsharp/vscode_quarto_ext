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

/**
 * `acceptsNull` — the null-arm annotation (null-enum-member FP fix, document-key plan §2.5/§4.0).
 *
 * `valuesOfSchema` maps enum members through `scalarToYaml`, which returns `null` for a JSON
 * `null`, and then FILTERS those out — while `closednessOfSchema` still reports the enum CLOSED.
 * A field whose schema is `enum: [null, true, false]` therefore ships as
 * `values:["true","false"], valuesClosed:true`, and the matcher flags the very value Quarto
 * lists as valid: `auto-play-media: null` renders **exit 0** (verified firsthand, Quarto 1.7.33,
 * on the `.qmd` top level, the `.qmd` per-format path, and `_quarto.yml`'s `format:` container),
 * yet quarto's own rejection clause for a genuinely wrong value reads
 * ``which must instead be one of: `null`, `true`, `false` ``.
 *
 * `acceptsNull` restores the family invariant (`valuesClosed === true` ⟹ `values` enumerates
 * every accepted spelling) by recording the dropped arm separately. It is derived over EVERY arm
 * `valuesOfSchema`/`closednessOfSchema` walk — bare `enum`, `enum:{values}`, `anyOf`,
 * `maybeArrayOf`, `ref` into `definitions`, the `{tags, schema}` wrapper, and the `depth > 5`
 * guard — not merely the two arms Quarto 1.7.33 happens to need today: a null-admitting enum
 * moving behind a `ref` must not silently re-break the invariant. (One already lives behind a
 * `ref` in 1.7.33 — `output-file` → `ref: pandoc-format-output-file` — though it resolves OPEN,
 * so it is never validated.)
 *
 * Risk polarity is INVERTED from `valuesClosed`: `acceptsNull` only ever LOOSENS validation, so
 * an over-eager set is a safe false negative while a MISSED arm is the cardinal-sin false
 * positive. Hence `anyOf` is OR (any arm admitting null makes the field admit null), where
 * closedness is AND.
 */
const NULL_FIXTURE = JSON.stringify({
  "schema/cell-nullarm.yml": [
    // The two REAL 1.7.33 shapes, transcribed exactly (document-reveal-media.yml /
    // document-render.yml): a boolean enum and a string enum, each with a literal null member.
    { name: "auto-play-media", schema: { enum: [null, true, false] }, description: "autoplay" },
    {
      name: "ipynb-shell-interactivity",
      schema: { enum: [null, "all", "last", "last_expr", "none", "last_expr_or_assign"] },
      description: "interactivity",
    },
    // The same arms WITHOUT a null member — these must stay unset (they are the fields whose
    // `key: null` quarto genuinely REJECTS: `toc: null`/`df-print: null` → exit 1, verified).
    { name: "toc-like", schema: { enum: [true, false] }, description: "toc" },
    { name: "df-print-like", schema: { enum: ["default", "kable"] }, description: "df" },
    // Every OTHER arm the reader's walk resolves, each carrying a null member one hop in.
    // None of these shapes needs a null arm in 1.7.33 — they exist so a null-admitting enum
    // MOVING behind any of them cannot silently re-break the invariant (§4.0 L1).
    { name: "enum-object-form", schema: { enum: { values: [null, "a", "b"] } }, description: "eo" },
    { name: "any-of-form", schema: { anyOf: [{ enum: ["x"] }, { enum: [null, "y"] }] }, description: "ao" },
    { name: "maybe-array-form", schema: { maybeArrayOf: { enum: [null, "m"] } }, description: "ma" },
    { name: "ref-form", schema: { ref: "null-enum-def" }, description: "rf" },
    // A CYCLIC ref — must terminate on the depth guard, not blow the stack.
    { name: "cyclic-ref-form", schema: { ref: "cycle-a" }, description: "cy" },
    { name: "tags-schema-form", schema: { tags: {}, schema: { enum: [null, "t"] } }, description: "ts" },
    // Same arms, NO null member anywhere — each must stay unset.
    { name: "enum-object-form-clean", schema: { enum: { values: ["a", "b"] } }, description: "eoc" },
    { name: "any-of-form-clean", schema: { anyOf: [{ enum: ["x"] }, { enum: ["y"] }] }, description: "aoc" },
    { name: "maybe-array-form-clean", schema: { maybeArrayOf: { enum: ["m"] } }, description: "mac" },
    { name: "ref-form-clean", schema: { ref: "clean-enum-def" }, description: "rfc" },
    { name: "tags-schema-form-clean", schema: { tags: {}, schema: { enum: ["t"] } }, description: "tsc" },
  ],
  "schema/definitions.yml": [
    { id: "null-enum-def", enum: [null, "r"] },
    { id: "clean-enum-def", enum: ["r"] },
    { id: "cycle-a", ref: "cycle-b" },
    { id: "cycle-b", ref: "cycle-a" },
  ],
});

describe("parseSchemaIndex — the null arm (acceptsNull, document-key plan §2.5/§4.0)", () => {
  const byName = new Map(parseSchemaIndex(NULL_FIXTURE).cellOptions().map((f) => [f.name, f]));

  it("marks a bare enum listing a literal null as acceptsNull (auto-play-media)", () => {
    // `values` drops the null member (scalarToYaml → null → filtered) …
    expect(byName.get("auto-play-media")?.values).toEqual(["true", "false"]);
    // … and the field is still CLOSED, so the matcher would flag `null` without this bit.
    expect(byName.get("auto-play-media")?.valuesClosed).toBe(true);
    expect(byName.get("auto-play-media")?.acceptsNull).toBe(true);
  });

  it("marks the {enum:{values}} object form listing a null", () => {
    expect(byName.get("enum-object-form")?.acceptsNull).toBe(true);
  });

  it("folds anyOf with OR — one null-admitting arm is enough (closedness folds with AND)", () => {
    expect(byName.get("any-of-form")?.acceptsNull).toBe(true);
    expect(byName.get("any-of-form")?.valuesClosed, "still closed — both arms are enums").toBe(true);
  });

  it("inherits through maybeArrayOf", () => {
    expect(byName.get("maybe-array-form")?.acceptsNull).toBe(true);
  });

  it("RESOLVES a ref into definitions — the arm a non-resolving scan silently misses", () => {
    // 1.7.33 already puts a null-admitting node behind a `ref` (`output-file` →
    // `pandoc-format-output-file`); it happens to resolve OPEN, so it is never validated —
    // but a CLOSED one moving behind a ref must not re-open the false positive.
    expect(byName.get("ref-form")?.acceptsNull).toBe(true);
  });

  it("inherits through the {tags, schema} wrapper", () => {
    expect(byName.get("tags-schema-form")?.acceptsNull).toBe(true);
  });

  it("marks a string enum listing a null too (ipynb-shell-interactivity)", () => {
    expect(byName.get("ipynb-shell-interactivity")?.values).toEqual([
      "all",
      "last",
      "last_expr",
      "none",
      "last_expr_or_assign",
    ]);
    expect(byName.get("ipynb-shell-interactivity")?.valuesClosed).toBe(true);
    expect(byName.get("ipynb-shell-interactivity")?.acceptsNull).toBe(true);
  });

  it("leaves every arm WITHOUT a null member unset — the fields quarto really does reject", () => {
    // `toc: null` / `df-print: null` render exit 1 (verified firsthand): these MUST keep flagging.
    for (const n of [
      "toc-like",
      "df-print-like",
      "enum-object-form-clean",
      "any-of-form-clean",
      "maybe-array-form-clean",
      "ref-form-clean",
      "tags-schema-form-clean",
    ]) {
      expect(byName.get(n)?.acceptsNull, `${n} must not admit null`).toBeFalsy();
    }
  });

  it("terminates on a cyclic ref via the depth guard rather than blowing the stack", () => {
    expect(byName.get("cyclic-ref-form")?.acceptsNull).toBeFalsy();
  });
});
