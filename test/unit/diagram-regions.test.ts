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

/**
 * Session 172 — the four malformed info strings this module's docstring listed as a known
 * limitation are no longer reported as diagrams.
 *
 * The limitation was a consequence of `CELL_INFO`'s old `[^}]*` tail, which TRUNCATED the
 * token instead of rejecting it: `{mermaid=x}` reached `engineFor` as `mermaid` and was
 * previewed as a Mermaid diagram. Quarto draws none of these — measured firsthand, and for
 * two different reasons, which is why the fix had to match quarto's grammar rather than
 * simply forbid the punctuation.
 */
describe("findDiagramRegions — malformed info strings (Session 172)", () => {
  const region = (token: string) =>
    findDiagramRegions("```" + token + "\ndigraph { a -> b }\n```\n");

  it("still finds the well-formed {dot} and {mermaid} controls", () => {
    expect(region("{dot}").map((r) => r.engine)).toEqual(["dot"]);
    expect(region("{mermaid}").map((r) => r.engine)).toEqual(["mermaid"]);
  });

  it("does not report a glued '=' token as a diagram — quarto's language is `mermaid=x`", () => {
    // It IS a cell to quarto (measured exit 1 for a bad option), but its language is
    // `mermaid=x`, which is not in quarto's handler list `["mermaid","dot"]` — so quarto
    // renders it as an ordinary code cell, not a diagram.
    expect(region("{mermaid=x}")).toEqual([]);
    expect(region("{dot=1}")).toEqual([]); // '=' then a digit: not a cell to quarto at all
  });

  it("does not report a '#'- or '.'-suffixed token as a diagram", () => {
    // Not cells to quarto at all (its tail must start with a space or a comma), so nothing
    // in them is drawn or validated. Measured exit 0 for the dotted spelling.
    expect(region("{mermaid#id}")).toEqual([]);
    expect(region("{mermaid.foo}")).toEqual([]);
  });
});
