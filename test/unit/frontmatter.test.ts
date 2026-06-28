import { describe, expect, it } from "vitest";
import { bibliographyPaths } from "../../src/core/frontmatter";

describe("bibliographyPaths — single string form", () => {
  it("reads a single unquoted bibliography path", () => {
    const text = ["---", "bibliography: refs.bib", "---", "", "# Title"].join(
      "\n",
    );
    expect(bibliographyPaths(text)).toEqual(["refs.bib"]);
  });
});

describe("bibliographyPaths — flow-list form", () => {
  it("reads a YAML flow list of paths", () => {
    const text = ["---", "bibliography: [a.bib, b.bib]", "---"].join("\n");
    expect(bibliographyPaths(text)).toEqual(["a.bib", "b.bib"]);
  });

  it("strips quotes from flow-list entries", () => {
    const text = ['---', 'bibliography: ["my refs.bib", \'b.json\']', "---"].join(
      "\n",
    );
    expect(bibliographyPaths(text)).toEqual(["my refs.bib", "b.json"]);
  });
});

describe("bibliographyPaths — block-list form", () => {
  it("reads a YAML block list of paths", () => {
    const text = [
      "---",
      "title: Doc",
      "bibliography:",
      "  - a.bib",
      "  - b.bib",
      "csl: apa.csl",
      "---",
    ].join("\n");
    expect(bibliographyPaths(text)).toEqual(["a.bib", "b.bib"]);
  });
});

describe("bibliographyPaths — quoting and absence", () => {
  it("strips quotes from a scalar path", () => {
    const text = ['---', 'bibliography: "my refs.bib"', "---"].join("\n");
    expect(bibliographyPaths(text)).toEqual(["my refs.bib"]);
  });

  it("returns [] when there is no front matter", () => {
    expect(bibliographyPaths("# Just a heading\n\nProse.")).toEqual([]);
  });

  it("returns [] when front matter has no bibliography key", () => {
    const text = ["---", "title: Doc", "csl: apa.csl", "---"].join("\n");
    expect(bibliographyPaths(text)).toEqual([]);
  });

  it("does not match a key that merely starts with 'bibliography'", () => {
    const text = ["---", "bibliography-extra: nope.bib", "---"].join("\n");
    expect(bibliographyPaths(text)).toEqual([]);
  });
});

describe("bibliographyPaths — hardening (adversarial review)", () => {
  it("A: reads a zero-indent block list (items flush-left under the key)", () => {
    const text = ["---", "bibliography:", "- a.bib", "- b.bib", "---"].join("\n");
    expect(bibliographyPaths(text)).toEqual(["a.bib", "b.bib"]);
  });

  it("A: a zero-indent block list stops at the next top-level key", () => {
    const text = [
      "---",
      "bibliography:",
      "- a.bib",
      "title: Doc",
      "---",
    ].join("\n");
    expect(bibliographyPaths(text)).toEqual(["a.bib"]);
  });

  it("D: strips a trailing YAML comment from a scalar value", () => {
    const text = ["---", "bibliography: refs.bib # main", "---"].join("\n");
    expect(bibliographyPaths(text)).toEqual(["refs.bib"]);
  });

  it("D: strips a trailing comment from a flow list (still recognized as a list)", () => {
    const text = ["---", "bibliography: [a.bib, b.bib] # refs", "---"].join("\n");
    expect(bibliographyPaths(text)).toEqual(["a.bib", "b.bib"]);
  });

  it("D: strips a trailing comment from a block-list item", () => {
    const text = [
      "---",
      "bibliography:",
      "  - a.bib # x",
      "  - b.bib",
      "---",
    ].join("\n");
    expect(bibliographyPaths(text)).toEqual(["a.bib", "b.bib"]);
  });

  it("D: preserves a '#' inside a quoted value", () => {
    const text = ["---", 'bibliography: "a#b.bib"', "---"].join("\n");
    expect(bibliographyPaths(text)).toEqual(["a#b.bib"]);
  });

  it("E: returns [] for an explicitly empty quoted scalar", () => {
    const text = ["---", 'bibliography: ""', "---"].join("\n");
    expect(bibliographyPaths(text)).toEqual([]);
  });
});
