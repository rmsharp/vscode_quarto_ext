import { describe, expect, it } from "vitest";
import { findPathValueCandidates, valueContextAt } from "../../src/core/project-links";

describe("findPathValueCandidates — scalar mapping values", () => {
  it("finds a top-level `key: value` scalar candidate", () => {
    const text = "bibliography: refs.bib";
    expect(findPathValueCandidates(text)).toEqual([
      { line: 0, valueRange: { startCol: 14, endCol: 22 }, token: "refs.bib" },
    ]);
  });

  it("skips a pure-mapping container line (empty value) but keeps its child value", () => {
    const text = ["project:", "  type: default"].join("\n");
    // `project:` has an empty value -> nothing to link; `type:`'s value is a
    // candidate (the adapter's existence check, not the scanner, rejects it).
    expect(findPathValueCandidates(text)).toEqual([
      { line: 1, valueRange: { startCol: 8, endCol: 15 }, token: "default" },
    ]);
  });

  it("finds a candidate at ANY depth, not just project:/website:/book: (whole-document scope)", () => {
    // `bibliography:` lives in the general document schema, NOT project:/website:/
    // book: -- the scope decision (plan §0). It must still be found.
    const text = ["project:", "  type: book", "bibliography: refs.bib"].join("\n");
    expect(findPathValueCandidates(text)).toEqual([
      { line: 1, valueRange: { startCol: 8, endCol: 12 }, token: "book" },
      { line: 2, valueRange: { startCol: 14, endCol: 22 }, token: "refs.bib" },
    ]);
  });

  it("excludes boolean literals (true/false, any case)", () => {
    const text = ["toc: true", "number-sections: FALSE"].join("\n");
    expect(findPathValueCandidates(text)).toEqual([]);
  });
});

describe("findPathValueCandidates — block-sequence items", () => {
  it("finds `- value` items at depth", () => {
    const text = ["project:", "  resources:", "    - data/raw.csv"].join("\n");
    expect(findPathValueCandidates(text)).toEqual([
      { line: 2, valueRange: { startCol: 6, endCol: 18 }, token: "data/raw.csv" },
    ]);
  });

  it("ignores a lone `-` and a non-marker `-x` scalar", () => {
    const text = ["render:", "  -", "  -x"].join("\n");
    expect(findPathValueCandidates(text)).toEqual([]);
  });

  it("extracts the value from an inline-mapping sequence item (`- href: page.qmd`)", () => {
    // The dominant navbar/sidebar `contents:` shape and book `- part:` lists.
    // The path is the VALUE of the inline mapping, not the whole `key: value`.
    const text = ["website:", "  navbar:", "    left:", "      - href: intro.qmd"].join(
      "\n",
    );
    expect(findPathValueCandidates(text)).toEqual([
      { line: 3, valueRange: { startCol: 14, endCol: 23 }, token: "intro.qmd" },
    ]);
  });

  it("extracts the value from a `- part: value` book-chapters item", () => {
    const text = ["book:", "  chapters:", "    - part: summary.qmd"].join("\n");
    expect(findPathValueCandidates(text)).toEqual([
      { line: 2, valueRange: { startCol: 12, endCol: 23 }, token: "summary.qmd" },
    ]);
  });
});

describe("findPathValueCandidates — quoting and comments", () => {
  it("strips surrounding double quotes from the token, keeping the quotes in the range", () => {
    const text = '    - "images/logo.png"';
    expect(findPathValueCandidates(text)).toEqual([
      { line: 0, valueRange: { startCol: 6, endCol: 23 }, token: "images/logo.png" },
    ]);
  });

  it("strips surrounding single quotes", () => {
    const text = "bibliography: 'refs.bib'";
    expect(findPathValueCandidates(text)).toEqual([
      { line: 0, valueRange: { startCol: 14, endCol: 24 }, token: "refs.bib" },
    ]);
  });

  it("trims a trailing inline comment from an unquoted value", () => {
    const text = "bibliography: refs.bib  # the main bib";
    expect(findPathValueCandidates(text)).toEqual([
      { line: 0, valueRange: { startCol: 14, endCol: 22 }, token: "refs.bib" },
    ]);
  });

  it("finds the mapping colon past a colon embedded in a quoted key", () => {
    // The mapping colon is the first `:` followed by whitespace/EOL, so the
    // in-quote `:` in `"a:b"` (followed by `b`) is correctly skipped.
    const text = '"a:b": intro.qmd';
    expect(findPathValueCandidates(text)).toEqual([
      { line: 0, valueRange: { startCol: 7, endCol: 16 }, token: "intro.qmd" },
    ]);
  });
});

describe("findPathValueCandidates — line skipping", () => {
  it("skips blank and comment lines and reports multiple candidates", () => {
    const text = [
      "# leading comment",
      "bibliography: refs.bib",
      "",
      "csl: apa.csl",
    ].join("\n");
    expect(findPathValueCandidates(text)).toEqual([
      { line: 1, valueRange: { startCol: 14, endCol: 22 }, token: "refs.bib" },
      { line: 3, valueRange: { startCol: 5, endCol: 12 }, token: "apa.csl" },
    ]);
  });
});

describe("valueContextAt — cursor value-slot detection (Slice 2)", () => {
  it("returns a value context when the cursor is in a `key: value` value slot", () => {
    // `bibliography: refs.bib`; cursor at col 14, the value-token start. The
    // value-so-far is empty; the replace range spans the whole value token.
    const text = "bibliography: refs.bib";
    expect(valueContextAt(text, 0, 14)).toEqual({
      token: "",
      replaceRange: { line: 0, startCol: 14, endCol: 22 },
    });
  });

  it("returns null when the cursor is in a KEY position (gate-d discriminator)", () => {
    // Mid-typing the key `bibliography:` — cursor at col 5, before the colon.
    // Completion must NOT fire in a key slot, only in a value slot.
    const text = "bibliography: refs.bib";
    expect(valueContextAt(text, 0, 5)).toBeNull();
  });

  it("returns a value context after a `- ` block-sequence marker, capturing the path-so-far", () => {
    // `  - chapters/intro.qmd`: dash at col 2, value at col 4. Cursor at col 13,
    // just past `chapters/` — the value-so-far includes the slash so the caller
    // can re-scope the listing into that subdirectory.
    const text = "  - chapters/intro.qmd";
    expect(valueContextAt(text, 0, 13)).toEqual({
      token: "chapters/",
      replaceRange: { line: 0, startCol: 4, endCol: 22 },
    });
  });

  it("returns the VALUE slot of an inline-mapping sequence item (`- href: intro.qmd`)", () => {
    // The dominant navbar/sidebar shape. Completion fires in the href VALUE, not
    // the `href` key: value starts at col 14 (after `href: `).
    const text = "      - href: intro.qmd";
    expect(valueContextAt(text, 0, 14)).toEqual({
      token: "",
      replaceRange: { line: 0, startCol: 14, endCol: 23 },
    });
  });

  it("returns null in the KEY position of an inline-mapping sequence item", () => {
    // Cursor at col 9, inside the `href` key of `- href: intro.qmd` — a key slot.
    const text = "      - href: intro.qmd";
    expect(valueContextAt(text, 0, 9)).toBeNull();
  });

  it("captures a partial filename after the last `/` in the token", () => {
    // `chapters: sub/pa` with the cursor after `pa` — the value-so-far keeps the
    // directory prefix so the caller lists `sub/` and VS Code filters on `pa`.
    const text = "chapters: sub/pa";
    expect(valueContextAt(text, 0, 16)).toEqual({
      token: "sub/pa",
      replaceRange: { line: 0, startCol: 10, endCol: 16 },
    });
  });

  it("fires in an empty value slot right after `key: ` (trailing space)", () => {
    const text = "bibliography: ";
    expect(valueContextAt(text, 0, 14)).toEqual({
      token: "",
      replaceRange: { line: 0, startCol: 14, endCol: 14 },
    });
  });

  it("fires right after `key:` with no space yet (slot anchored at colon+1)", () => {
    // The `:` trigger fires here; the adapter prepends a separating space so the
    // accepted YAML is `key: value`, not `key:value`.
    const text = "bibliography:";
    expect(valueContextAt(text, 0, 13)).toEqual({
      token: "",
      replaceRange: { line: 0, startCol: 13, endCol: 13 },
    });
  });

  it("excludes a trailing inline comment from the value-token span", () => {
    // `chapters: intro.qmd  # note`, cursor after `intro`. The replace range ends
    // at the value token, never eating the comment.
    const text = "chapters: intro.qmd  # note";
    expect(valueContextAt(text, 0, 15)).toEqual({
      token: "intro",
      replaceRange: { line: 0, startCol: 10, endCol: 19 },
    });
  });

  it("returns null on a blank line, a comment line, and a plain scalar with no colon", () => {
    expect(valueContextAt("", 0, 0)).toBeNull();
    expect(valueContextAt("# just a comment", 0, 5)).toBeNull();
    expect(valueContextAt("plainscalar", 0, 5)).toBeNull();
  });

  it("returns null for an out-of-range line index", () => {
    expect(valueContextAt("bibliography: refs.bib", 5, 0)).toBeNull();
    expect(valueContextAt("bibliography: refs.bib", -1, 0)).toBeNull();
  });

  it("fires at the value-token end but returns null once the cursor is past it (trailing-comment upper bound)", () => {
    // `chapters: intro.qmd  # note`: the value token is `intro.qmd` (cols 10-18,
    // ending at col 19). A cursor at col 19 is still a value slot; a cursor in the
    // trailing whitespace (col 20) or inside the `# note` comment (col 22) is PAST
    // the value — completion must NOT fire there, or accepting an item would overrun
    // the comment (adversarial review, Session 81). Mirrors yaml-context's
    // frontMatterContextAt `col <= valueSlot.endCol` upper bound.
    const text = "chapters: intro.qmd  # note";
    expect(valueContextAt(text, 0, 19)).toEqual({
      token: "intro.qmd",
      replaceRange: { line: 0, startCol: 10, endCol: 19 },
    });
    expect(valueContextAt(text, 0, 20)).toBeNull();
    expect(valueContextAt(text, 0, 22)).toBeNull();
  });

  it("finds the value slot at any indentation depth (whole-document scope)", () => {
    // A deeply-nested `output-dir:` under project:. Cursor at the value start.
    const text = ["project:", "  book:", "    output-dir: docs"].join("\n");
    expect(valueContextAt(text, 2, 16)).toEqual({
      token: "",
      replaceRange: { line: 2, startCol: 16, endCol: 20 },
    });
  });
});
