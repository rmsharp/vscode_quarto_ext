import { describe, expect, it } from "vitest";
import { findCellOptionLines, frontMatterContentLines } from "../../src/core/qmd/model";
import {
  findFrontMatterTopLevelLines,
  findFrontMatterValueLines,
} from "../../src/core/yaml-frontmatter-values";
import { findNestedFrontMatterValueLines } from "../../src/core/yaml-frontmatter-nested-values";
import { cellOptionScopeFor, mappingColonAt, valueSlotAfterColon } from "../../src/core/yaml-context";
import { documentEngineForScoping } from "../../src/core/document-engine";
import { isWrongValue } from "../../src/core/yaml-value-check";
import {
  cellsWithValidationDisabled,
  isValidationDisabledByFrontMatter,
} from "../../src/core/validate-yaml";
import { parseSchemaIndex } from "../../src/core/yaml-schema";
import { cellOptionFlags, type OracleCoreApi } from "../oracle/flags";

/**
 * The oracle's fidelity surface.
 *
 * `cellOptionFlags` is a MIRROR of the cell-option loop in
 * `src/features/yaml-value-diagnostics.ts`, which cannot be called headlessly because it
 * imports `vscode`. A mirror that drifts from what the feature actually does turns the
 * oracle into a machine for producing confident wrong numbers, so every step of that loop
 * is pinned here against the real core modules — not stubs.
 *
 * S165's scratchpad copy omitted one step entirely: the S163 `validate-yaml` escape hatch.
 * Its corpus happened to contain no document that used it, so the gap never showed. That
 * is the drift this file exists to catch.
 */
const api: OracleCoreApi = {
  findCellOptionLines,
  frontMatterContentLines,
  findFrontMatterTopLevelLines,
  findFrontMatterValueLines,
  findNestedFrontMatterValueLines,
  documentEngineForScoping,
  cellOptionScopeFor,
  mappingColonAt,
  valueSlotAfterColon,
  isWrongValue,
  isValidationDisabledByFrontMatter,
  cellsWithValidationDisabled,
};

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

const flags = (text: string, fileName = "doc.qmd") => cellOptionFlags(text, fileName, api, index);

const rCell = (opt: string) => "```{r}\n#| " + opt + "\n1\n```\n";

describe("cellOptionFlags — quarto's validate-yaml escape hatch (the S165 mirror gap)", () => {
  it("POSITIVE CONTROL: a knitr-only option with a wrong value IS flagged", () => {
    // Asserted first and on purpose: a suppression pin that never had anything to
    // suppress passes against a dead code path (S163 gotcha 5).
    expect(flags("---\ntitle: t\n---\n\n" + rCell("cache: banana"))).toEqual(["5:cache=banana"]);
  });

  it("a top-level `validate-yaml: false` suppresses the whole document", () => {
    const text = "---\ntitle: t\nvalidate-yaml: false\n---\n\n" + rCell("cache: banana");
    expect(flags(text)).toEqual([]);
  });

  it("a per-cell `#| validate-yaml: false` suppresses only its own cell", () => {
    const text =
      "---\ntitle: t\n---\n\n" +
      "```{r}\n#| validate-yaml: false\n#| cache: banana\n1\n```\n\n" +
      rCell("cache: banana");
    // The opted-out cell is silent; the second cell (line 11) still reports.
    expect(flags(text)).toEqual(["11:cache=banana"]);
  });
});

/**
 * The order-dependent language fallback (S165), which is what the corpus measures.
 *
 * Quarto resolves a document's engine from its cell languages, document-wide: knitr claims
 * `r`, jupyter claims `julia`, and whichever appears FIRST owns the document. Both rows
 * below were measured against `quarto render --no-execute` 1.7.33 by S165 and are re-run
 * live by the opt-in driver; here they pin that the MIRROR reproduces the same decision.
 */
describe("cellOptionFlags — the document engine is resolved document-wide, in order", () => {
  const jl = "```{julia}\n1\n```\n";
  const py = (opt: string) => "```{python}\n#| " + opt + "\n1\n```\n";

  it("a {julia} cell BEFORE the {r} cell makes the document jupyter — so knitr-only `cache` is NOT flagged", () => {
    // Measured: quarto renders this exit 0. Flagging it is the cardinal sin, and it is
    // exactly the false positive S165 shipped this fallback to remove.
    const text = "---\ntitle: t\n---\n\n" + jl + "\n" + rCell("cache: banana");
    expect(flags(text)).toEqual([]);
  });

  it("an {r} cell BEFORE a {python} cell makes the document knitr — so `cache` in the {python} cell IS flagged", () => {
    // Measured: quarto renders this exit 1. The mirror must pin the OPPOSITE direction
    // too — S165's review found five knitr-positive pins left vacuous because the rule
    // had been applied in only one direction.
    const text = "---\ntitle: t\n---\n\n" + "```{r}\n1\n```\n" + "\n" + py("cache: banana");
    expect(flags(text)).toEqual(["9:cache=banana"]);
  });
});
