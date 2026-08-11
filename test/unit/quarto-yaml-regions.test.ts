import { describe, expect, it } from "vitest";
import {
  inQuartoYamlRegion,
  quartoYamlRegions,
} from "../../src/core/qmd/quarto-yaml-regions";

/**
 * The region scanner in isolation (Session 177).
 *
 * `test/unit/yaml-value-flags.test.ts` pins what the SQUIGGLE does with these regions and
 * `test/oracle/` scores the same documents against a real `quarto render`; these pins cover
 * the scanner's own boundaries, which no document-level test reaches — the delimiter
 * grammar, the horizontal-rule exemption's two guards, and the fence counters.
 *
 * Written test-AFTER the three RED→GREEN behaviours the value-flags file drove. They are
 * boundary pins, not evidence of test-first discipline.
 */

/** Regions as `start-end` pairs — compact enough to read a whole document's answer. */
const spans = (text: string) =>
  quartoYamlRegions(text).map((r) => `${r.startLine}-${r.endLine}`);

describe("quartoYamlRegions — the delimiter grammar", () => {
  it("reads ordinary front matter as one closed region", () => {
    expect(spans("---\ntitle: t\n---\n\nbody\n")).toEqual(["0-2"]);
  });

  it("requires COLUMN 0 — an indented `---` opens nothing", () => {
    // The filed defect's root: `yamlRegEx` has no leading-whitespace allowance, so the
    // indented opener is invisible and the CLOSING `---` opens a region instead.
    expect(spans("   ---\ntitle: t\n---\n\nbody\n")).toEqual(["2-5"]);
  });

  it("allows trailing whitespace after the three dashes", () => {
    // `/^---\s*$/` — the trailing `\s*` is quarto's, and it is why `---   ` still opens.
    expect(spans("---   \ntitle: t\n---\t\n\nbody\n")).toEqual(["0-2"]);
  });

  it("takes EXACTLY three dashes — a four-dash rule is not a delimiter", () => {
    expect(spans("---\ntitle: t\n---\n\npara\n----\n\nbody\n")).toEqual(["0-2"]);
  });

  it("runs an unclosed region to the last line of the document", () => {
    expect(spans("---\ntitle: t\n---\n\nHeading\n---\n\nbody\n")).toEqual(["0-2", "5-8"]);
  });

  it("reopens after a region closes — regions are spans, not a latch", () => {
    expect(spans("---\na: 1\n---\n\npara\n---\nb: 2\n---\n\nbody\n")).toEqual(["0-2", "5-7"]);
  });

  it("handles CRLF line endings", () => {
    expect(spans("---\r\ntitle: t\r\n---\r\n\r\nbody\r\n")).toEqual(["0-2"]);
  });
});

describe("quartoYamlRegions — the horizontal-rule exemption", () => {
  it("declines a `---` with a blank line BOTH above and below", () => {
    expect(spans("---\ntitle: t\n---\n\npara\n\n---\n\nbody\n")).toEqual(["0-2"]);
  });

  it("does NOT decline when only the line above is blank", () => {
    expect(spans("---\ntitle: t\n---\n\npara\n\n---\nmore\n")).toEqual(["0-2", "6-8"]);
  });

  it("does NOT decline when only the line below is blank", () => {
    expect(spans("---\ntitle: t\n---\n\npara\n---\n\nbody\n")).toEqual(["0-2", "5-8"]);
  });

  it("never exempts line 0 — front matter opens even above a blank line", () => {
    // quarto's guard is `index > 0`, so a document whose second line is blank still has
    // front matter rather than a leading thematic break.
    expect(spans("---\n\nkey: v\n---\n\nbody\n")).toEqual(["0-3"]);
  });

  it("applies the exemption only when OPENING — a blank-surrounded `---` still CLOSES", () => {
    // `skipHRs` is passed `!inYaml`. Without that asymmetry the closer below would be
    // read as a thematic break and the region would swallow the rest of the document.
    expect(spans("---\ntitle: t\n\n---\n\nbody\n")).toEqual(["0-3"]);
  });
});

describe("quartoYamlRegions — the fence counters", () => {
  it("ignores a `---` inside a plain ``` fence", () => {
    expect(spans("---\ntitle: t\n---\n\n```\n---\n```\n\nbody\n")).toEqual(["0-2"]);
  });

  it("ignores a `---` inside an executable cell", () => {
    expect(spans("---\ntitle: t\n---\n\n```{r}\n---\n1\n```\n\nbody\n")).toEqual(["0-2"]);
  });

  it("matches the closing run LENGTH — a 3-tick line does not close a 4-tick fence", () => {
    // quarto's `endCodeRegEx` match must equal the recorded `inCode`, so the inner
    // three-tick line is content and the `---` above it stays fenced.
    expect(spans("---\ntitle: t\n---\n\n````\n---\n```\n---\n````\n\nbody\n")).toEqual(["0-2"]);
  });

  it("does NOT treat a `~~~` tilde fence as code — quarto's opener is backticks only", () => {
    // A faithful divergence from our own `FENCE_OPEN`: the `---` inside the tilde fence
    // really does open a region for quarto (measured exit 0).
    expect(spans("---\ntitle: t\n---\n\n~~~\n---\n~~~\n\nbody\n")).toEqual(["0-2", "5-9"]);
  });

  it("does NOT treat an HTML comment as a skip region — quarto tracks none", () => {
    expect(spans("---\ntitle: t\n---\n\n<!--\n---\n-->\n\nbody\n")).toEqual(["0-2", "5-9"]);
  });

  it("tracks a cell fence opened INSIDE a region as an ordinary code fence", () => {
    // quarto's cell branch requires `inPlainText()`, so inside YAML the `{r}` opener falls
    // through to the plain-fence branch. The region therefore survives the cell and is
    // closed by the later `---`, not by the cell's backticks.
    expect(spans("---\ntitle: t\n---\n\nHeading\n---\n\n```{r}\n1\n```\n\n---\n\nbody\n")).toEqual([
      "0-2",
      "5-11",
    ]);
  });
});

describe("inQuartoYamlRegion", () => {
  it("is inclusive of both delimiter lines", () => {
    const regions = quartoYamlRegions("---\ntitle: t\n---\n\nbody\n");
    expect([0, 1, 2, 3, 4].map((l) => inQuartoYamlRegion(regions, l))).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
  });

  it("is false everywhere when the document has no delimiter at all", () => {
    const regions = quartoYamlRegions("just prose\n\nmore prose\n");
    expect(regions).toEqual([]);
    expect(inQuartoYamlRegion(regions, 0)).toBe(false);
  });
});

describe("quartoYamlRegions — the `terminated` flag (Session 211)", () => {
  /** Regions as `start-end(T|U)` — the flag beside the bounds it qualifies. */
  const marks = (text: string) =>
    quartoYamlRegions(text).map((r) => `${r.startLine}-${r.endLine}${r.terminated ? "T" : "U"}`);

  it("marks a region that CLOSED on a delimiter", () => {
    expect(marks("---\ntitle: t\n---\n\nbody\n")).toEqual(["0-2T"]);
  });

  it("marks a region that merely RAN OUT of document", () => {
    // The distinction this flag exists for. Both spans look alike to a consumer reading only
    // the two line numbers, and quarto treats their CONTENT completely differently: it honours
    // a `from:` in the first and ignores one in the second (`scratchpad/s211/cal`
    // `c01_mid_gfm` selects, `c06_unterm_gfm` does not).
    // ⚠ endLine is 4, not 3: the trailing newline makes a fifth, empty line, and an unclosed
    // region runs to the document's LAST line whatever that line holds.
    expect(marks("---\ntitle: t\n\nbody\n")).toEqual(["0-4U"]);
  });

  it("marks each region independently in a document holding several", () => {
    // A closed front matter, then a closed mid-document block, then a dangling opener.
    expect(marks("---\na: 1\n---\n\nbody\n\n---\nb: 2\n---\n\nmore\n\n---\nc: 3\n")).toEqual([
      "0-2T",
      "6-8T",
      "12-14U",
    ]);
  });

  it("a trailing `---` behind a blank line opens NO region — the HR exemption, not termination", () => {
    // ⚠ WRITTEN AS A GUESS AND MEASURED WRONG FIRST TIME, and the correction matters because
    // it re-attributes a citation. `scratchpad/s211/cal2` `q5_open_at_eof` selects no reader,
    // and the reason is NOT that its region is unterminated — there is no region at all. The
    // trailing newline leaves an empty final line, so the `---` has a blank line both above and
    // below and quarto's `skipHRs` arm reads it as a thematic break.
    expect(marks("body\n\n---\n")).toEqual([]);
    // ...whereas the same opener with content below it DOES open an unterminated region.
    expect(marks("body\n\n---\nfrom: gfm\n")).toEqual(["2-4U"]);
  });
});
