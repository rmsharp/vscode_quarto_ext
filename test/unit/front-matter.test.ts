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

  it("returns null when a `---` is not on the first line", () => {
    expect(findFrontMatter(["", "---", "title: x", "---"].join("\n"))).toBeNull();
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
