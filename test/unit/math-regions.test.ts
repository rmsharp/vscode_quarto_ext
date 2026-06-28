import { describe, expect, it } from "vitest";
import { findMathRegions } from "../../src/core/math-regions";

describe("findMathRegions", () => {
  it("finds a basic inline $...$ region", () => {
    const r = findMathRegions("cost $x+y$ here");
    expect(r).toEqual([
      { type: "inline", content: "x+y", startLine: 0, endLine: 0 },
    ]);
  });

  it("finds a single-line display $$...$$ region (not two inline)", () => {
    const r = findMathRegions("$$a^2+b^2$$");
    expect(r).toEqual([
      { type: "display", content: "a^2+b^2", startLine: 0, endLine: 0 },
    ]);
  });

  it("finds a multi-line display $$...$$ region with correct line span", () => {
    const r = findMathRegions("text\n$$\n\\int_0^1 x\\,dx\n$$\nmore");
    expect(r).toEqual([
      {
        type: "display",
        content: "\n\\int_0^1 x\\,dx\n",
        startLine: 1,
        endLine: 3,
      },
    ]);
  });

  // Pandoc tex_math_dollars inline rules.
  it("rejects an opening $ followed by whitespace", () => {
    expect(findMathRegions("a $ x$ b")).toEqual([]);
  });

  it("rejects a closing $ preceded by whitespace", () => {
    expect(findMathRegions("a $x $ b")).toEqual([]);
  });

  it("does not treat currency as math (closing $ followed by a digit)", () => {
    expect(findMathRegions("it costs $20$30 today")).toEqual([]);
    expect(findMathRegions("$20 and $30")).toEqual([]);
  });

  it("ignores a backslash-escaped \\$ as a delimiter", () => {
    expect(findMathRegions("price \\$x\\$ here")).toEqual([]);
  });

  it("lets an escaped \\$ sit inside inline math without closing it", () => {
    expect(findMathRegions("$a \\$ b$")).toEqual([
      { type: "inline", content: "a \\$ b", startLine: 0, endLine: 0 },
    ]);
  });

  // Skip-regions: math only lives in body prose (shared scanRegions model).
  it("ignores a $ inside an executable code cell", () => {
    const text = "```{python}\ncost = '$x$'\n```\n";
    expect(findMathRegions(text)).toEqual([]);
  });

  it("ignores a $ inside YAML front matter", () => {
    const text = "---\ntitle: $x$ value\n---\n\n# Heading\n";
    expect(findMathRegions(text)).toEqual([]);
  });

  it("ignores a $ inside an HTML comment", () => {
    expect(findMathRegions("<!-- $x$ -->\nprose\n")).toEqual([]);
  });

  it("ignores $...$ inside an inline backtick code span", () => {
    // CommonMark: a code span binds tighter than tex_math_dollars, so the
    // dollars here are literal code, not math.
    expect(findMathRegions("Use the `$x$` macro to print a dollar.")).toEqual(
      [],
    );
    expect(findMathRegions("See `$$E=mc^2$$` rendered.")).toEqual([]);
  });

  it("still detects real math on a line that also has a code span", () => {
    expect(findMathRegions("`code` then $x+y$ end")).toEqual([
      { type: "inline", content: "x+y", startLine: 0, endLine: 0 },
    ]);
  });

  it("preserves real backticks inside math content (content sliced unmasked)", () => {
    // Masking is only for delimiter detection; the returned content must be the
    // original text, so a (rare) backtick pair inside real math is not blanked.
    expect(findMathRegions("$$ a `b` c $$")).toEqual([
      { type: "display", content: " a `b` c ", startLine: 0, endLine: 0 },
    ]);
  });

  it("resumes detecting math in prose after a code cell", () => {
    const text = "```{python}\na = 1\n```\n\n$y$ after";
    expect(findMathRegions(text)).toEqual([
      { type: "inline", content: "y", startLine: 4, endLine: 4 },
    ]);
  });

  it("does not let display math span across a code fence", () => {
    // The opening $$ is in prose, then a code fence intervenes — the $$ must
    // not swallow the fence and close on the far side.
    const text = "$$\n```{python}\nx = 1\n```\n$$";
    expect(findMathRegions(text)).toEqual([]);
  });

  // Coverage / regression locks (the general scanner already satisfies these).
  it("returns inline then display in document order", () => {
    expect(findMathRegions("$a$ and $$b$$ end")).toEqual([
      { type: "inline", content: "a", startLine: 0, endLine: 0 },
      { type: "display", content: "b", startLine: 0, endLine: 0 },
    ]);
  });

  it("returns [] for a document with no math", () => {
    expect(findMathRegions("# Title\n\nJust prose, no dollars.\n")).toEqual([]);
  });

  it("returns [] for empty input", () => {
    expect(findMathRegions("")).toEqual([]);
  });
});
