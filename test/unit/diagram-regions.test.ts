import { describe, expect, it } from "vitest";
import { findDiagramRegions } from "../../src/core/diagram-regions";

describe("findDiagramRegions", () => {
  it("finds a {mermaid} cell as a mermaid diagram region", () => {
    const text = "```{mermaid}\nflowchart LR\n  A --> B\n```\n";
    expect(findDiagramRegions(text)).toEqual([
      {
        engine: "mermaid",
        code: "flowchart LR\n  A --> B",
        startLine: 0,
        endLine: 3,
      },
    ]);
  });

  it("finds a {dot} cell as a dot (Graphviz) diagram region", () => {
    const text = "```{dot}\ndigraph { A -> B }\n```\n";
    expect(findDiagramRegions(text)).toEqual([
      {
        engine: "dot",
        code: "digraph { A -> B }",
        startLine: 0,
        endLine: 2,
      },
    ]);
  });

  // Coverage / regression locks: the discriminators below are all inherited
  // from the shared cell scanner (`findAllCells`), so they pass on first add.
  // They pin the diagram-engine contract against future drift (Learning #14).
  it("ignores a non-diagram executable cell (e.g. {python})", () => {
    const text = "```{python}\nimport graphviz\n```\n";
    expect(findDiagramRegions(text)).toEqual([]);
  });

  it("ignores a plain ```mermaid fence (no braces — not an executable cell)", () => {
    // Quarto only draws a brace cell; a plain fence is a literal code block.
    const text = "```mermaid\nflowchart LR\n  A --> B\n```\n";
    expect(findDiagramRegions(text)).toEqual([]);
  });

  it("ignores the {{mermaid}} display form (non-executable)", () => {
    const text = "```{{mermaid}}\nflowchart LR\n```\n";
    expect(findDiagramRegions(text)).toEqual([]);
  });

  it("returns multiple diagrams in document order, skipping interleaved code", () => {
    const text =
      "```{mermaid}\nA --> B\n```\n\n" +
      "```{python}\nx = 1\n```\n\n" +
      "```{dot}\ndigraph {}\n```\n";
    expect(findDiagramRegions(text)).toEqual([
      { engine: "mermaid", code: "A --> B", startLine: 0, endLine: 2 },
      { engine: "dot", code: "digraph {}", startLine: 8, endLine: 10 },
    ]);
  });

  it("captures an empty diagram cell body as an empty string", () => {
    expect(findDiagramRegions("```{mermaid}\n```\n")).toEqual([
      { engine: "mermaid", code: "", startLine: 0, endLine: 1 },
    ]);
  });

  it("ignores mermaid-like text in prose and YAML front matter", () => {
    const text = "---\nengine: mermaid\n---\n\nSee the {mermaid} flowchart below.\n";
    expect(findDiagramRegions(text)).toEqual([]);
  });

  it("captures an unterminated diagram cell to end of document", () => {
    expect(findDiagramRegions("```{dot}\ndigraph { A -> B }")).toEqual([
      { engine: "dot", code: "digraph { A -> B }", startLine: 0, endLine: 1 },
    ]);
  });

  it("returns [] for empty input", () => {
    expect(findDiagramRegions("")).toEqual([]);
  });
});
