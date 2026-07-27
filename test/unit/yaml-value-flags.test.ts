import { describe, expect, it } from "vitest";
import { parseSchemaIndex } from "../../src/core/yaml-schema";
import {
  collectValueSources,
  hasNoValueLines,
  valueFlags,
} from "../../src/core/yaml-value-flags";

/**
 * The value-flag decision — the product's own, called headlessly.
 *
 * Until Session 168 this decision lived inside `computeValueDiagnostics`, which imports
 * `vscode` and so could only ever be exercised by the screen-seizing integration suite. The
 * oracle harness therefore re-walked it by hand (`test/oracle/flags.ts`), and that copy had
 * already drifted once undetected — S165's scratchpad version omitted the S163
 * `validate-yaml` escape hatch entirely. These pins test the ONE implementation both the
 * feature and the oracle now call.
 *
 * The first three pins below are migrated verbatim in intent from
 * `test/unit/oracle-flags.test.ts` (deleted in Layer 4), retargeted from the mirror onto
 * the product.
 */

/**
 * A minimal stand-in for quarto's installed schema resource, in the shape
 * `parseSchemaIndex` reads. `cache` carries `tags.engine: knitr` so it is knitr-ONLY —
 * the field every engine-scoping measurement in this family turns on — while `echo` has
 * no engine tag and so survives into every scope.
 */
const index = parseSchemaIndex(
  JSON.stringify({
    "schema/cell-cache.yml": [
      { name: "cache", schema: "boolean", description: "cache", tags: { engine: "knitr" } },
    ],
    "schema/cell-codeoutput.yml": [{ name: "echo", schema: "boolean", description: "echo" }],
  }),
);

/**
 * The cell group, rendered in the mirror's own `line:key=value` shape so these pins read
 * against the deleted `oracle-flags.test.ts` line for line.
 */
const cellFlags = (text: string, fileName = "doc.qmd") =>
  valueFlags(collectValueSources(text), fileName, index).cell.map(
    (f) => `${f.line}:${f.key}=${f.rawToken}`,
  );

const rCell = (opt: string) => "```{r}\n#| " + opt + "\n1\n```\n";

/**
 * A second stand-in carrying the FRONT-MATTER surfaces: a closed-valued top-level key
 * (`toc`), a closed-valued `execute:` child (`echo`), and the built-in output-format name
 * list `formatNamesForValidation()` reads. These three surfaces — ~136 of the 272 lines
 * this decision is made of — had NO headless coverage before Session 168, and the oracle
 * does not cover them either: its driver scores the cell group only.
 */
const fmIndex = parseSchemaIndex(
  JSON.stringify({
    "schema/document-toc.yml": [{ name: "toc", schema: "boolean", description: "toc" }],
    "schema/cell-codeoutput.yml": [{ name: "echo", schema: "boolean", description: "echo" }],
    "pandoc/formats.yml": ["html", "pdf", "revealjs"],
  }),
);

/** Every group, flattened in the feature's own diagnostic order, as `line:key=value`. */
const allFlags = (text: string, index_ = fmIndex, fileName = "doc.qmd") => {
  const g = valueFlags(collectValueSources(text), fileName, index_);
  return [...g.cell, ...g.frontMatter, ...g.nested].map(
    (f) => `${f.line}:${f.key}=${f.rawToken}`,
  );
};

/** All three surfaces at once: knitr-only `cache`, top-level `toc`, curated `execute.echo`. */
const fmCellIndex = parseSchemaIndex(
  JSON.stringify({
    "schema/document-toc.yml": [{ name: "toc", schema: "boolean", description: "toc" }],
    "schema/cell-cache.yml": [
      { name: "cache", schema: "boolean", description: "cache", tags: { engine: "knitr" } },
    ],
    "schema/cell-codeoutput.yml": [{ name: "echo", schema: "boolean", description: "echo" }],
    "pandoc/formats.yml": ["html", "pdf", "revealjs"],
  }),
);

const fmGroup = (text: string, index_ = fmIndex, fileName = "doc.qmd") =>
  valueFlags(collectValueSources(text), fileName, index_).frontMatter.map(
    (f) => `${f.line}:${f.key}=${f.rawToken}`,
  );

describe("valueFlags — quarto's validate-yaml escape hatch (the S165 mirror gap)", () => {
  it("POSITIVE CONTROL: a knitr-only option with a wrong value IS flagged", () => {
    // Asserted first and on purpose: a suppression pin that never had anything to
    // suppress passes against a dead code path (S163 gotcha 5).
    expect(cellFlags("---\ntitle: t\n---\n\n" + rCell("cache: banana"))).toEqual(["5:cache=banana"]);
  });

  it("a top-level `validate-yaml: false` suppresses the whole document", () => {
    const text = "---\ntitle: t\nvalidate-yaml: false\n---\n\n" + rCell("cache: banana");
    expect(cellFlags(text)).toEqual([]);
  });

  it("a per-cell `#| validate-yaml: false` suppresses only its own cell", () => {
    const text =
      "---\ntitle: t\n---\n\n" +
      "```{r}\n#| validate-yaml: false\n#| cache: banana\n1\n```\n\n" +
      rCell("cache: banana");
    // The opted-out cell is silent; the second cell (line 11) still reports.
    expect(cellFlags(text)).toEqual(["11:cache=banana"]);
  });
});

/**
 * The order-dependent language fallback (S165), which is what the oracle's corpus measures.
 *
 * Quarto resolves a document's engine from its cell languages, document-wide: knitr claims
 * `r`, jupyter claims `julia`, and whichever appears FIRST owns the document. Both rows
 * below were measured against `quarto render --no-execute` 1.7.33 by S165 and are re-run
 * live by the opt-in oracle driver; here they pin that the decision reproduces it headlessly.
 */
describe("valueFlags — the document engine is resolved document-wide, in order", () => {
  const jl = "```{julia}\n1\n```\n";
  const py = (opt: string) => "```{python}\n#| " + opt + "\n1\n```\n";

  it("a {julia} cell BEFORE the {r} cell makes the document jupyter — so knitr-only `cache` is NOT flagged", () => {
    // Measured: quarto renders this exit 0. Flagging it is the cardinal sin, and it is
    // exactly the false positive S165 shipped this fallback to remove.
    const text = "---\ntitle: t\n---\n\n" + jl + "\n" + rCell("cache: banana");
    expect(cellFlags(text)).toEqual([]);
  });

  it("an {r} cell BEFORE a {python} cell makes the document knitr — so `cache` in the {python} cell IS flagged", () => {
    // Measured: quarto renders this exit 1. The decision must pin the OPPOSITE direction
    // too — S165's review found five knitr-positive pins left vacuous because the rule
    // had been applied in only one direction.
    const text = "---\ntitle: t\n---\n\n" + "```{r}\n1\n```\n" + "\n" + py("cache: banana");
    expect(cellFlags(text)).toEqual(["9:cache=banana"]);
  });
});

/**
 * Session 170 — the `.Rmd` is knitr for EVERY cell, and it is the ONE document class whose
 * engine is CERTAIN.
 *
 * `claimsFile` gives knitr the file by EXTENSION, in a loop that runs before quarto
 * partitions any front matter, so nothing downstream can take it back. Grounded firsthand
 * vs 1.7.33, one `quarto render --no-execute` per row, on a document whose ONLY cell is
 * `{python}` — the cell language that resolves to jupyter under the fallback, so a knitr
 * answer here cannot have come from the languages:
 *
 * | document | renders |
 * |---|---|
 * | `doc.Rmd`, `#\| cache: banana` | **exit 1** — `Field "cache" has value banana` |
 * | `doc.qmd`, byte-identical | exit 0 ← the control that makes it the EXTENSION |
 * | `doc.Rmd`, key removed | exit 0 ← so the exit 1 is the VALUE, not the shape |
 * | `doc.Rmd`, `#\| echo: banana` | exit 1 ← the agnostic control: validation ran |
 *
 * The first pin is the one that was RED before this session: we resolved `undefined` there
 * and scoped the cell to jupyter by its language, so up to 20 knitr-only fields were lost on
 * every `.Rmd`.
 */
describe("valueFlags — an .Rmd is knitr for EVERY cell (S170)", () => {
  const pyOnly = (opt: string) =>
    "---\ntitle: t\n---\n\n" + "```{python}\n#| " + opt + "\n1\n```\n";

  it("flags knitr-only `cache` in a {python} cell of an .Rmd", () => {
    expect(cellFlags(pyOnly("cache: banana"), "doc.Rmd")).toEqual(["5:cache=banana"]);
  });

  it("leaves the byte-identical .qmd silent — the difference is the EXTENSION", () => {
    // The discriminating control. Without it the pin above would also pass if the language
    // fallback had somehow answered knitr for a {python}-only document, which it must not.
    expect(cellFlags(pyOnly("cache: banana"), "doc.qmd")).toEqual([]);
  });

  it("keeps a VALID knitr value silent — the widening must not flag good documents", () => {
    // `#| cache: true` in a {python} cell of a doc.Rmd renders exit 0, measured. A widening
    // that also fired on valid values would be worse than the gap it closes.
    expect(cellFlags(pyOnly("cache: true"), "doc.Rmd")).toEqual([]);
  });

  it("still exempts a cell-HANDLER cell, where knitr's scope would be the cardinal sin", () => {
    // `cellOptionScopeFor` returns `"none"` for {dot}/{mermaid} ABOVE every engine, because
    // quarto swaps the cell schema by LANGUAGE. Measured on a doc.Rmd: `//| cache: banana`
    // in a {dot} cell renders **exit 0** — so had the handler guard sat below the extension
    // branch, this session would have MANUFACTURED a cardinal-sin false positive.
    const dot = "---\ntitle: t\n---\n\n```{dot}\n//| cache: banana\ndigraph { a -> b }\n```\n";
    expect(cellFlags(dot, "doc.Rmd")).toEqual([]);
  });
});

/**
 * Session 171 — leading whitespace hides the front matter from OUR scanner, never from
 * quarto's ENGINE partitioner. The last cardinal false positive in this family whose root
 * cause was ours rather than an unreadable input.
 *
 * `partitionYamlFrontMatter` opens with `lines(markdown.trimLeft())`, so no amount of
 * leading whitespace hides the block from engine selection; `scanRegions` opens front
 * matter only at line 0. S165 could only DECLINE (answer `undefined`) — and declining
 * means "keep the per-cell language approximation", which answers knitr for an `{r}` cell.
 * So we squiggled a knitr-only key on a document quarto renders clean. Grounded firsthand
 * vs 1.7.33, one `quarto render --no-execute` per row:
 *
 * | document | renders |
 * |---|---|
 * | blank line, `engine: markdown`, `{r}` + `#\| cache: banana` | **exit 0** ← the defect |
 * | same, but `#\| echo: banana` | exit 1 ← the agnostic control: cell validation ran |
 * | same, `engine:` line removed | exit 1 ← so knitr really is the fallback here |
 * | two blank lines / spaces-only line / leading tab / CRLF | all exit 0 |
 *
 * ⚠ **The fix is scoped to the ENGINE surface on purpose, and the pins below are what hold
 * it there.** Quarto runs a SECOND, narrower partitioner for front-matter VALUE validation
 * — `validateDocumentFromSource` calls `breakQuartoMd` and then tests
 * `firstCell.source.value.startsWith("---")`, a literal byte-0 test — so a document with
 * ANY leading whitespace gets no front-matter value validation from quarto at all. Sweeping
 * 17 keys whose bad value quarto rejects at line 0 and re-rendering each behind one leading
 * blank line, **10 flip to exit 0**: `number-sections`, `code-fold`, `fig-width`,
 * `fig-align`, `keep-md`, `freeze`, `cache`, `link-citations`, `execute`, `bibliography`.
 * Teaching `scanRegions` the `trimLeft` — which is what the filed item proposed — would
 * therefore have manufactured ten classes of cardinal false positive on the value surface
 * while closing one on the engine surface.
 */
describe("valueFlags — leading whitespace hides front matter from us, not from quarto (S171)", () => {
  const leading = (prefix: string, fm: string[], opt: string) =>
    prefix + ["---", "title: t", ...fm, "---", "", "```{r}", "#| " + opt, "1", "```", ""].join("\n");

  it("no longer flags a knitr-only key when `engine: markdown` sits behind a blank line", () => {
    // The cardinal false positive this session closes. Renders exit 0; we squiggled it.
    expect(cellFlags(leading("\n", ["engine: markdown"], "cache: banana"))).toEqual([]);
  });

  it("STILL flags it when the same document names no engine — the fallback is untouched", () => {
    // The discriminator. Without this pin the one above would also pass if the fix had
    // simply stopped scoping leading-whitespace documents at all. Measured: exit 1.
    // Line 6, not 7: dropping the `engine:` line makes this document one line shorter.
    expect(cellFlags(leading("\n", [], "cache: banana"))).toEqual(["6:cache=banana"]);
  });

  it("STILL flags an engine-AGNOSTIC key behind the same override — the cell surface lives", () => {
    // `echo` carries no `tags.engine`, so it survives into every scope including markdown's.
    // Measured: exit 1 on the byte-identical document. A fix that silenced the whole cell
    // surface for these documents would pass both pins above and fail this one.
    expect(cellFlags(leading("\n", ["engine: markdown"], "echo: banana"))).toEqual([
      "7:echo=banana",
    ]);
  });

  it("reads through every leading-whitespace spelling quarto's `trimLeft` eats", () => {
    // trimLeft strips spaces and tabs as well as newlines, so an INDENTED opening `---` is
    // visible to quarto's engine partitioner too — measured exit 0 on all four.
    for (const prefix of ["\n", "\n\n", "   \n", "\t"]) {
      expect(cellFlags(leading(prefix, ["engine: markdown"], "cache: banana"))).toEqual([]);
    }
    expect(cellFlags("   " + leading("", ["engine: markdown"], "cache: banana").trimStart())).toEqual(
      [],
    );
  });

  it("FP GUARD: the VALUE surface must stay silent behind leading whitespace", () => {
    // The pin that holds the fix to one surface. Quarto front-matter-validates only when the
    // document starts with `---` at byte 0, so `toc: banana` behind a blank line is NOT a
    // quarto YAML rejection — 10 of 17 swept keys render exit 0 in exactly this shape. If a
    // future change teaches `scanRegions` the trimLeft, this pin goes red first.
    expect(fmGroup("\n---\ntoc: banana\n---\n")).toEqual([]);
    expect(fmGroup("   \n---\ntoc: banana\n---\n")).toEqual([]);
    // …while the byte-0 control, which quarto DOES validate, is still flagged.
    expect(fmGroup("---\ntoc: banana\n---\n")).toEqual(["1:toc=banana"]);
  });
});

/**
 * Phase 2 — TOP-LEVEL front-matter scalars. Never covered headlessly before Session 168:
 * `computeValueDiagnostics` was module-private behind `vscode`, and the oracle's mirror
 * implemented the cell loop only.
 */
describe("valueFlags — top-level front-matter values", () => {
  it("POSITIVE CONTROL: a closed-enum top-level value with a wrong value IS flagged", () => {
    expect(fmGroup("---\ntoc: banana\n---\n")).toEqual(["1:toc=banana"]);
  });

  it("a valid value is silent", () => {
    expect(fmGroup("---\ntoc: true\n---\n")).toEqual([]);
  });

  it("`validate-yaml: false` suppresses it", () => {
    // quarto's render gate turns the whole validation pass off, so this renders exit 0
    // and flagging it is the cardinal sin in its most explicit form (S163).
    expect(fmGroup("---\nvalidate-yaml: false\ntoc: banana\n---\n")).toEqual([]);
  });

  it("an unrecognized key is never flagged — that is unknown-key territory, not this feature", () => {
    expect(fmGroup("---\nnot-a-real-key: banana\n---\n")).toEqual([]);
  });
});

/**
 * The top-level `format` scalar is a SPECIAL case: its value is an output-format NAME, not
 * a closed enum, so `isWrongValue` cannot validate it. It is validated instead by a bespoke
 * predicate mirroring quarto's front-matter SCHEMA layer.
 */
describe("valueFlags — the front-matter format NAME", () => {
  it("POSITIVE CONTROL: an unknown output-format name IS flagged", () => {
    expect(fmGroup("---\nformat: banana\n---\n")).toEqual(["1:format=banana"]);
  });

  it("a built-in name is silent", () => {
    expect(fmGroup("---\nformat: html\n---\n")).toEqual([]);
  });

  it("a pandoc MODIFIER on a built-in name is schema-accepted, so silent", () => {
    expect(fmGroup("---\nformat: html+smart\n---\n")).toEqual([]);
  });

  it("⚠ `validate-yaml: false` does NOT suppress the format NAME — the one deliberate exception", () => {
    // Grounded firsthand by S163 vs quarto 1.7.33: `validate-yaml: false` + `format: banana`
    // renders EXIT 1 with `Unknown format banana`, because an unresolvable output format
    // fails in format RESOLUTION, earlier and independently of the YAML validation pass the
    // flag gates. Suppressing it would trade a false positive for a lost true positive.
    // This is also why the gate sits BELOW the format branch rather than at the top.
    expect(fmGroup("---\nvalidate-yaml: false\nformat: banana\n---\n")).toEqual([
      "2:format=banana",
    ]);
  });

  it("OFFLINE (the built-in set is not known-complete) it never flags", () => {
    // `formatNamesForValidation()` returns null when `pandoc/formats.yml` is absent — the
    // curated fallback knows only 14 of 71 names, so flagging from it would invent
    // false positives for every name it happens not to carry.
    const offline = parseSchemaIndex(
      JSON.stringify({
        "schema/document-toc.yml": [{ name: "toc", schema: "boolean", description: "toc" }],
      }),
    );
    expect(offline.formatNamesForValidation()).toBeNull();
    expect(fmGroup("---\nformat: banana\n---\n", offline)).toEqual([]);
  });

  it("a flow/block/node-property token is skipped (FP-safe false negative)", () => {
    expect(fmGroup("---\nformat: [html, pdf]\n---\n")).toEqual([]);
  });
});

/**
 * Phase 3 — NESTED front-matter scalars under `execute:`/`format:`. `frontMatterKeys
 * (["execute"])` returns the curated execute children unconditionally, so `echo`'s closed
 * value set here does not depend on the schema fixture above; `execute.echo: maybe` was
 * grounded to `quarto render` 1.7.33 exit 1 when that set was curated.
 */
describe("valueFlags — nested front-matter values", () => {
  it("POSITIVE CONTROL: a closed-enum `execute:` child with a wrong value IS flagged", () => {
    expect(allFlags("---\nexecute:\n  echo: banana\n---\n")).toEqual(["2:echo=banana"]);
  });

  it("a valid nested value is silent", () => {
    expect(allFlags("---\nexecute:\n  echo: false\n---\n")).toEqual([]);
  });

  it("`validate-yaml: false` suppresses nested scalars too", () => {
    // Grounded: `validate-yaml: false` + `execute:`/`echo: banana` renders exit 0.
    expect(allFlags("---\nvalidate-yaml: false\nexecute:\n  echo: banana\n---\n")).toEqual([]);
  });

  it("an OPEN nested field is never flagged (`output` is deliberately enum-open)", () => {
    // `execute.output: banana` takes the anyOf free arm and renders exit 0 — a closed
    // mark here would be the cardinal-sin false positive.
    expect(allFlags("---\nexecute:\n  output: banana\n---\n")).toEqual([]);
  });
});

/**
 * The GROUPING is a safety property, not a style choice (plan §5 dragon 2).
 *
 * The oracle driver scores the CELL surface only. With one flat `ValueFlag[]` it would need
 * a load-bearing `.filter(surface === "cell")`, and forgetting it would let a front-matter
 * flag flip a corpus document's row class — a silent failure that looks exactly like a real
 * regression. Grouping makes that mistake unrepresentable, and this is the pin that proves
 * the groups actually separate — the oracle cannot, by construction: its driver takes
 * `.cell`, so taking the wrong group could never fail a run.
 */
describe("valueFlags — grouping, and the feature's diagnostic order", () => {
  const twoSurfaces =
    "---\ntoc: banana\nexecute:\n  echo: banana\n---\n\n" + "```{r}\n#| cache: banana\n1\n```\n";

  it("a document flagging on THREE surfaces at once lands each flag in its own group", () => {
    const g = valueFlags(collectValueSources(twoSurfaces), "doc.qmd", fmCellIndex);
    expect(g.cell.map((f) => `${f.line}:${f.key}`)).toEqual(["7:cache"]);
    expect(g.frontMatter.map((f) => `${f.line}:${f.key}`)).toEqual(["1:toc"]);
    expect(g.nested.map((f) => `${f.line}:${f.key}`)).toEqual(["3:echo"]);
    expect(g.cell[0]?.surface).toBe("cell");
    expect(g.frontMatter[0]?.surface).toBe("front-matter");
    expect(g.nested[0]?.surface).toBe("nested");
  });

  it("concatenating cell ++ frontMatter ++ nested reproduces the feature's diagnostic order", () => {
    // The feature emits its three loops in this order and the integration suite's
    // cardinality guards depend on the COUNT; this pins the ORDER the adapter concatenates
    // in, which no integration assertion can distinguish (plan §3.5).
    expect(allFlags(twoSurfaces, fmCellIndex)).toEqual([
      "7:cache=banana",
      "1:toc=banana",
      "3:echo=banana",
    ]);
  });

  it("format-name flags are interleaved with top-level flags in SOURCE order", () => {
    // Both surfaces share the `frontMatter` group and the single loop that emits them, so
    // a format-name flag on a later line must follow a top-level flag on an earlier one.
    expect(fmGroup("---\ntoc: banana\nformat: banana\n---\n")).toEqual([
      "1:toc=banana",
      "2:format=banana",
    ]);
  });
});

describe("hasNoValueLines — the adapter's pre-await fast path", () => {
  it("is true for a document with no value lines on any of the three sources", () => {
    expect(hasNoValueLines(collectValueSources("# just prose\n"))).toBe(true);
  });

  it("is false when ONLY a nested front-matter line exists (all three sources count)", () => {
    // The fast path returns before the schema load; counting only cells would skip a
    // document whose sole flaggable value is nested.
    expect(hasNoValueLines(collectValueSources("---\nexecute:\n  echo: false\n---\n"))).toBe(
      false,
    );
  });

  it("carries the snapshot text with the derived arrays (the S124 desync is unrepresentable)", () => {
    const text = "---\ntoc: banana\n---\n";
    expect(collectValueSources(text).text).toBe(text);
  });
});

/**
 * The MESSAGE each flag carries — the adapter copies it straight onto the
 * `vscode.Diagnostic`, so a wrong message here is a wrong squiggle in the editor.
 * Added after a mutant that blanked `formatNameMessage(...)` survived the whole pin set:
 * the pins above compare `line:key=value` and never read `.message`.
 */
describe("valueFlags — the message on each flag", () => {
  const msg = (text: string, index_ = fmCellIndex) => {
    const g = valueFlags(collectValueSources(text), "doc.qmd", index_);
    return [...g.cell, ...g.frontMatter, ...g.nested].map((f) => f.message);
  };

  it("a cell option carries the generic value message", () => {
    expect(msg("---\ntitle: t\n---\n\n" + rCell("cache: banana"))).toEqual([
      'Value banana is not valid for "cache" — expected true or false.',
    ]);
  });

  it("a top-level front-matter value carries the generic value message", () => {
    expect(msg("---\ntoc: banana\n---\n")).toEqual([
      'Value banana is not valid for "toc" — expected true or false.',
    ]);
  });

  it("a format NAME carries the format-name message, NOT the generic one", () => {
    expect(msg("---\nformat: banana\n---\n")).toEqual(["Unknown output format banana."]);
  });

  it("a nested value carries the generic value message", () => {
    expect(msg("---\nexecute:\n  echo: banana\n---\n")).toEqual([
      'Value banana is not valid for "echo" — expected one of: true, false, fenced.',
    ]);
  });

  it("each flag's span is the VALUE token, not the whole line", () => {
    const g = valueFlags(collectValueSources("---\ntoc: banana\n---\n"), "doc.qmd", fmCellIndex);
    expect(g.frontMatter[0]).toMatchObject({ line: 1, startCol: 5, endCol: 11 });
  });
});

/**
 * Branches the §9 review proved were unpinned — each one verified first by a mutation that
 * survived the whole 1519-test suite. Three of them guard measured CARDINAL FALSE
 * POSITIVES, which is the class this project treats as the cardinal sin, so leaving them to
 * the integration suite alone was the wrong trade.
 */
describe("valueFlags — the guards the review found unpinned", () => {
  it("BLOCK-COMMENT language: the closing delimiter is NOT sliced into the value (S161)", () => {
    // `/*| echo: false */` in a {c} cell renders quarto EXIT 0. Without the contentEndCol
    // clamp the value slices as `false */`, which is not in echo's closed set, so we would
    // squiggle a valid directive — the cardinal sin. Every other cell fixture in this file
    // uses `#|`, for which the clamp is a documented no-op, so nothing else can catch this.
    const text = "---\ntitle: t\n---\n\n```{c}\n/*| echo: false */\n1\n```\n";
    expect(allFlags(text, fmCellIndex)).toEqual([]);
  });

  it("BLOCK-COMMENT language: a genuinely wrong value still flags, and the span excludes the closer", () => {
    // The positive control for the pin above — otherwise it would pass against a {c} cell
    // that is simply never validated at all.
    const text = "---\ntitle: t\n---\n\n```{c}\n/*| echo: banana */\n1\n```\n";
    const g = valueFlags(collectValueSources(text), "doc.qmd", fmCellIndex);
    expect(g.cell.map((f) => `${f.line}:${f.key}=${f.rawToken}`)).toEqual(["5:echo=banana"]);
    // `banana`, not `banana */` — the clamp is what makes the squiggled RANGE right too.
    expect(g.cell[0]).toMatchObject({ startCol: 10, endCol: 16 });
  });

  it("a BACKSLASH-bearing format token is skipped — it may decode to a valid name (P3/S149)", () => {
    // `format: "\x68tml"` DECODES to `html` and quarto renders it exit 0, but `unquote` does
    // no escape decoding, so comparing the literal would flag a name quarto accepts.
    expect(fmGroup('---\nformat: "\\x68tml"\n---\n')).toEqual([]);
  });

  it("a VALID cell-option value is silent (the isWrongValue skip itself)", () => {
    // Every other cell fixture uses `cache: banana`; nothing pinned that a CORRECT value
    // stays quiet, so deleting the matcher call left the suite green.
    expect(cellFlags("---\ntitle: t\n---\n\n" + rCell("cache: false"))).toEqual([]);
  });

  it("`#| echo:: banana` is a mapping whose KEY is `echo:` — unknown, so silent (S148)", () => {
    // Re-deriving the key from the real YAML separator rather than the first colon. Quarto
    // renders this exit 0 (the key is unknown on an open set); the first-colon split would
    // yield key `echo` with the bogus value `: banana` and squiggle it.
    expect(cellFlags("---\ntitle: t\n---\n\n" + rCell("echo:: banana"))).toEqual([]);
  });

  it("`#| echo:banana` has no separator at all — a safe false negative, never a flag", () => {
    expect(cellFlags("---\ntitle: t\n---\n\n" + rCell("echo:banana"))).toEqual([]);
  });

  it("a half-typed option (key present, value empty) is silent", () => {
    expect(cellFlags("---\ntitle: t\n---\n\n" + rCell("echo:"))).toEqual([]);
  });

  it("hasNoValueLines counts the CELL source too, not just nested", () => {
    const cellOnly = "```{r}\n#| echo: false\n1\n```\n";
    expect(hasNoValueLines(collectValueSources(cellOnly))).toBe(false);
  });

  it("hasNoValueLines counts the TOP-LEVEL front-matter source too", () => {
    // With only the nested conjunct load-bearing, the fast path would skip the schema load
    // on a document whose only flaggable value is a top-level scalar — and flag nothing.
    expect(hasNoValueLines(collectValueSources("---\ntoc: banana\n---\n"))).toBe(false);
  });

  it("the cell and nested flags carry the VALUE span, not a degenerate one", () => {
    // Spans were asserted on the top-level push only; on the other sites `rawToken` comes
    // from the enumerator independently of `valueRange`, so a wrong span changed nothing
    // any pin could see.
    const text = "---\nexecute:\n  echo: banana\n---\n\n" + rCell("cache: banana");
    const g = valueFlags(collectValueSources(text), "doc.qmd", fmCellIndex);
    expect(g.nested[0]).toMatchObject({ line: 2, startCol: 8, endCol: 14 });
    expect(g.cell[0]).toMatchObject({ line: 6, startCol: 10, endCol: 16 });
  });

  it("the format-name flag carries the VALUE span", () => {
    const g = valueFlags(collectValueSources("---\nformat: banana\n---\n"), "doc.qmd", fmCellIndex);
    expect(g.frontMatter[0]).toMatchObject({ line: 1, startCol: 8, endCol: 14 });
  });
});
