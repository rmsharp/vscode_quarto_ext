import { describe, expect, it } from "vitest";
import {
  findAllCells,
  findFrontMatter,
  findHeadings,
  inFrontMatter,
} from "../../src/core/qmd/model";

describe("findFrontMatter — the front-matter region span", () => {
  it("returns the fence-to-fence span of a terminated block", () => {
    const text = ["---", "title: x", "---", "", "# Heading"].join("\n");
    expect(findFrontMatter(text)).toEqual({ startLine: 0, endLine: 2 });
  });

  it("returns null when the document has no front matter", () => {
    expect(findFrontMatter(["# Heading", "", "prose"].join("\n"))).toBeNull();
  });

  it("finds a block behind a leading BLANK run — quarto renders one (Session 210)", () => {
    // Reversed from "returns null when a `---` is not on the first line", which pinned a
    // measured DEFECT: quarto renders `\n---\ntitle: x\n---\n` exactly as it renders the same
    // bytes without the leading blank, so the block was hidden from the outline, the citation
    // reader and the reader-selection stack alike. 51 documents in `scratchpad/s210`;
    // `cal_blank1_*` is the witness and `cal_none_*` the byte-0 twin it must match.
    expect(findFrontMatter(["", "---", "title: x", "---"].join("\n"))).toEqual({
      startLine: 1,
      endLine: 3,
    });
    // The leading run may be any length and any whitespace — spaces, FOUR spaces, a tab. The
    // ` {0,3}` cap that governs nearly every other block rule in this file does not apply here.
    for (const lead of ["", "  ", "    ", "\t"]) {
      expect(findFrontMatter([lead, "---", "title: x", "---"].join("\n"))).toEqual({
        startLine: 1,
        endLine: 3,
      });
    }
  });

  it("still returns null for the three shapes quarto does NOT read as front matter", () => {
    // The guard half of the same change, each measured (`scratchpad/s210/CALIBRATION.md`).
    // A blank line immediately BELOW the opener — quarto renders a thematic break and body,
    // and reports `h2:title: x` as a setext heading (`cal2` c2_hrgap).
    expect(findFrontMatter(["", "---", "", "title: x", "---"].join("\n"))).toBeNull();
    // No terminator — pandoc's metadata block never closes, so the lines are ordinary body.
    // Opening one here would run to end of document and DELETE every heading below it
    // (`cal2` c2_unterm, exit 0, renders its heading normally).
    expect(findFrontMatter(["", "---", "title: x", "", "# Heading"].join("\n"))).toBeNull();
    // An INDENTED opener opens nothing, at any indent (`cal2` c2_fence_i1/i3/i4).
    expect(findFrontMatter(["", "   ---", "title: x", "---"].join("\n"))).toBeNull();
  });

  it("ends an unterminated block at the document's last line", () => {
    const text = ["---", "title: x", "author: y"].join("\n");
    expect(findFrontMatter(text)).toEqual({ startLine: 0, endLine: 2 });
  });

  it("accepts a `...` YAML document-end terminator", () => {
    const text = ["---", "title: x", "...", "body"].join("\n");
    expect(findFrontMatter(text)).toEqual({ startLine: 0, endLine: 2 });
  });
});

describe("inFrontMatter — is a line an interior front-matter content line?", () => {
  const text = ["---", "title: x", "format: html", "---", "# Heading"].join("\n");

  it("is true for an interior content line", () => {
    expect(inFrontMatter(text, 1)).toBe(true);
    expect(inFrontMatter(text, 2)).toBe(true);
  });

  it("is false on the opening `---` fence line", () => {
    expect(inFrontMatter(text, 0)).toBe(false);
  });

  it("is false on the closing `---` fence line", () => {
    expect(inFrontMatter(text, 3)).toBe(false);
  });

  it("is false on a body line after the front matter", () => {
    expect(inFrontMatter(text, 4)).toBe(false);
  });

  it("is false everywhere when there is no front matter", () => {
    const body = ["# Heading", "prose"].join("\n");
    expect(inFrontMatter(body, 0)).toBe(false);
    expect(inFrontMatter(body, 1)).toBe(false);
  });

  it("includes the last line of an unterminated block (no closing fence)", () => {
    const open = ["---", "title: x", "author: y"].join("\n");
    expect(inFrontMatter(open, 1)).toBe(true);
    expect(inFrontMatter(open, 2)).toBe(true); // last line IS content when unterminated
  });
});

/**
 * The Learning #14 agreement guard: `inFrontMatter` and the heading/cell region
 * views are derived from the SAME `scanRegions` pass, so a line that looks like a
 * heading or a cell fence but sits inside the front matter must be claimed by
 * `inFrontMatter` AND skipped by `findHeadings`/`findAllCells` — they cannot
 * disagree about where front matter is. (Break-revert-provable: disabling the
 * front-matter skip in `scanRegions` reds these by leaking a phantom heading/cell.)
 */
describe("front-matter region agreement (Learning #14)", () => {
  const text = [
    "---",
    "title: x",
    "# this is a YAML comment, not a heading",
    "```{python}",
    "format: html",
    "---",
    "# Real Heading",
    "",
    "```{python}",
    "x = 1",
    "```",
  ].join("\n");

  it("does not index a `#` line inside front matter as a heading", () => {
    const headings = findHeadings(text).map((h) => h.text);
    expect(headings).toEqual(["Real Heading"]);
  });

  it("does not index a `{python}` fence inside front matter as a cell", () => {
    const cells = findAllCells(text);
    expect(cells).toHaveLength(1); // only the real body cell, not the FM line
    expect(cells[0].startLine).toBe(8);
  });

  it("claims those same look-alike lines as front matter", () => {
    expect(inFrontMatter(text, 2)).toBe(true); // the `#` line
    expect(inFrontMatter(text, 3)).toBe(true); // the ```{python} line
    expect(inFrontMatter(text, 6)).toBe(false); // the real heading is NOT front matter
  });
});
