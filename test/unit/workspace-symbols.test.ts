import { describe, expect, it } from "vitest";
import { flattenOutline, matchesWorkspaceQuery } from "../../src/core/workspace-symbols";
import type { OutlineSymbol } from "../../src/core/qmd/model";

describe("flattenOutline — depth-first flattening of an outline tree", () => {
  it("returns an empty list for an empty tree", () => {
    expect(flattenOutline([])).toEqual([]);
  });

  it("flattens a single root heading with an empty container name", () => {
    const heading: OutlineSymbol = {
      kind: "heading",
      name: "Intro",
      level: 1,
      startLine: 0,
      endLine: 5,
      selectionLine: 0,
      children: [],
    };
    expect(flattenOutline([heading])).toEqual([
      {
        kind: "heading",
        name: "Intro",
        containerName: "",
        startLine: 0,
        endLine: 5,
        selectionLine: 0,
      },
    ]);
  });

  it("flattens nested children depth-first, tagging each with its parent's name", () => {
    const tree: OutlineSymbol[] = [
      {
        kind: "heading",
        name: "H",
        level: 1,
        startLine: 0,
        endLine: 3,
        selectionLine: 0,
        children: [
          {
            kind: "cell",
            name: "```{python}",
            lang: "python",
            startLine: 1,
            endLine: 3,
            selectionLine: 1,
            children: [],
          },
        ],
      },
    ];
    expect(flattenOutline(tree).map((s) => [s.name, s.containerName])).toEqual([
      ["H", ""],
      ["```{python}", "H"],
    ]);
  });
});

describe("matchesWorkspaceQuery — filtering a flattened symbol by the Quick Open query", () => {
  it("an empty query matches any name", () => {
    expect(matchesWorkspaceQuery("Anything", "")).toBe(true);
  });

  it("matches a case-insensitive substring", () => {
    expect(matchesWorkspaceQuery("Getting Started", "start")).toBe(true);
    expect(matchesWorkspaceQuery("Getting Started", "STARTED")).toBe(true);
  });

  it("does not match a name lacking the query as a substring", () => {
    expect(matchesWorkspaceQuery("Getting Started", "xyz")).toBe(false);
  });
});
