import { describe, expect, it } from "vitest";
import { findNestedFrontMatterValueLines } from "../../src/core/yaml-frontmatter-nested-values";

describe("findNestedFrontMatterValueLines — nested execute value lines", () => {
  it("emits an execute child scalar with parentPath, key, value range, and raw token", () => {
    const text = ["---", "execute:", "  echo: maybe", "---", "", "Body."].join("\n");
    expect(findNestedFrontMatterValueLines(text)).toEqual([
      { line: 2, parentPath: ["execute"], key: "echo", valueRange: { startCol: 8, endCol: 13 }, rawToken: "maybe" },
    ]);
  });

  it("emits multiple execute children in document order (the reader judges validity later)", () => {
    const text = ["---", "execute:", "  echo: fenced", "  eval: banana", "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text)).toEqual([
      { line: 2, parentPath: ["execute"], key: "echo", valueRange: { startCol: 8, endCol: 14 }, rawToken: "fenced" },
      { line: 3, parentPath: ["execute"], key: "eval", valueRange: { startCol: 8, endCol: 14 }, rawToken: "banana" },
    ]);
  });
});

describe("findNestedFrontMatterValueLines — nested format value lines (per-format, reader-gated)", () => {
  it("emits format.html.toc with the two-level container path", () => {
    const text = ["---", "format:", "  html:", "    toc: yes", "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text)).toEqual([
      { line: 3, parentPath: ["format", "html"], key: "toc", valueRange: { startCol: 9, endCol: 12 }, rawToken: "yes" },
    ]);
  });

  it("emits format.pdf.toc — the per-format path is genuine, not a shared flat list", () => {
    const text = ["---", "format:", "  pdf:", "    toc: yes", "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text)).toEqual([
      { line: 3, parentPath: ["format", "pdf"], key: "toc", valueRange: { startCol: 9, endCol: 12 }, rawToken: "yes" },
    ]);
  });

  it("emits a deep object sub-key with its FULL path (schema-free; the reader gates resolution)", () => {
    // position ⊥ data — the enumerator emits ["format","html","theme"]; frontMatterKeys
    // resolves one object level and returns [] for an unknown sub-key, so it is a safe no-op.
    const text = ["---", "format:", "  html:", "    theme:", "      foo: bar", "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text)).toEqual([
      { line: 4, parentPath: ["format", "html", "theme"], key: "foo", valueRange: { startCol: 11, endCol: 14 }, rawToken: "bar" },
    ]);
  });
});

describe("findNestedFrontMatterValueLines — the key/value SEPARATOR guard (P2, THE cardinal-sin FP, plan §2.8)", () => {
  it("parses `key:: value` under execute: at the SEPARATOR — key `echo:` (quarto exit 0)", () => {
    // The THIRD enumerator carrying this defect — not named in the plan's §2.8, found by
    // grep + firsthand render at S148. YAML's key is `echo:`; `execute:`'s child key set is
    // OPEN, so quarto accepts it and renders exit 0, while splitting at the first colon
    // yields the bogus value token `: banana` for the matcher to flag.
    const text = ["---", "execute:", "  echo:: banana", "---"].join("\n");
    // Parsed at the real separator: the key is `echo:`, matching no schema field, so the
    // feature skips it as it skips any unknown key (the no-diagnostic end state is locked
    // in the integration suite).
    expect(findNestedFrontMatterValueLines(text)).toEqual([
      { line: 2, parentPath: ["execute"], key: "echo:", valueRange: { startCol: 9, endCol: 15 }, rawToken: "banana" },
    ]);
  });

  it("ARMS the multi-line skip when a LATER colon is the separator (`a:b: \"text`)", () => {
    // §9-review finding, nested surface: judging only the FIRST colon lost the scanFlow
    // arming, so the folded `echo: banana"` line was emitted and flagged on a document
    // quarto renders exit 0. Scanning forward to the real separator keeps the arming.
    const text = ["---", "execute:", '  a:b: "a long value that wraps', '  echo: banana"', "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text).map((v) => v.key)).toEqual(["a:b"]);
  });
});

describe("findNestedFrontMatterValueLines — bounded / structural (never a false line)", () => {
  it("returns [] for a document with no front matter", () => {
    const text = ["Just prose.", "execute:", "  echo: maybe"].join("\n");
    expect(findNestedFrontMatterValueLines(text)).toEqual([]);
  });

  it("skips COLUMN-0 lines (the top-level enumerator's job) and emits only the indented child", () => {
    const text = ["---", "toc: yes", "execute:", "  echo: maybe", "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text)).toEqual([
      { line: 3, parentPath: ["execute"], key: "echo", valueRange: { startCol: 8, endCol: 13 }, rawToken: "maybe" },
    ]);
  });

  it("skips a nested comment line and a nested block-sequence item", () => {
    const text = ["---", "format:", "  html:", "    # c", "    - seq", "    toc: yes", "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text)).toEqual([
      { line: 5, parentPath: ["format", "html"], key: "toc", valueRange: { startCol: 9, endCol: 12 }, rawToken: "yes" },
    ]);
  });

  it("skips a nested block-opener (container, no scalar value) but emits its scalar sibling", () => {
    const text = ["---", "execute:", "  echo:", "  eval: banana", "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text)).toEqual([
      { line: 3, parentPath: ["execute"], key: "eval", valueRange: { startCol: 8, endCol: 14 }, rawToken: "banana" },
    ]);
  });

  it("returns [] when the enclosing structure is not one we resolve (a non-listed column-0 root)", () => {
    // `website:` is a PROJECT-config container grounded OUT of NESTED_CONTAINERS (plan §2.2
    // — an `_quarto.yml` surface, not `.qmd` front matter), so nestedParentPath returns null
    // → skipped (a documented safe false negative). This guards that the L2 widening did NOT
    // become "descend into every container".
    const text = ["---", "website:", "  title: banana", "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text)).toEqual([]);
  });
});

describe("findNestedFrontMatterValueLines — other closed containers (L2 go-live, plan §3.2 change B)", () => {
  it("emits a one-level child under `crossref` (a non-format container newly in NESTED_CONTAINERS)", () => {
    const text = ["---", "crossref:", "  chapters: banana", "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text)).toEqual([
      { line: 2, parentPath: ["crossref"], key: "chapters", valueRange: { startCol: 12, endCol: 18 }, rawToken: "banana" },
    ]);
  });

  it("emits a one-level child under another container (`editor`), proving it is not crossref-specific", () => {
    const text = ["---", "editor:", "  mode: wysiwyg", "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text)).toEqual([
      { line: 2, parentPath: ["editor"], key: "mode", valueRange: { startCol: 8, endCol: 15 }, rawToken: "wysiwyg" },
    ]);
  });

  it("BAILS at a 2-level descent under a non-format container (the deeper climb is format-root only)", () => {
    // `nestedParentPath` climbs to the column-0 root and returns the path only when that root
    // is `format:` (yaml-context.ts:277). Under `crossref:` the 2-level `bar:` line bails →
    // not emitted (a documented safe false negative, plan §2.3 — deeper nesting deferred).
    const text = ["---", "crossref:", "  sub:", "    bar: baz", "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text)).toEqual([]);
  });
});

describe("findNestedFrontMatterValueLines — nested value-token grammar (quotes, comments)", () => {
  it("retains the quotes of a quoted value in rawToken and its range", () => {
    const text = ["---", "execute:", '  echo: "fenced"', "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text)).toEqual([
      { line: 2, parentPath: ["execute"], key: "echo", valueRange: { startCol: 8, endCol: 16 }, rawToken: '"fenced"' },
    ]);
  });

  it("strips a trailing unquoted inline comment from the value token", () => {
    const text = ["---", "execute:", "  echo: maybe # note", "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text)).toEqual([
      { line: 2, parentPath: ["execute"], key: "echo", valueRange: { startCol: 8, endCol: 13 }, rawToken: "maybe" },
    ]);
  });
});

describe("findNestedFrontMatterValueLines — block scalars protected by the ancestor walk (§7.2)", () => {
  it("does NOT emit a fake child line INSIDE a block scalar (more-indented content)", () => {
    // `nestedParentPath` bails because the `include-in-header: |` container has a scalar
    // value (mappingContainerKey → null), so the fake `toc: yes` is never resolved.
    const text = ["---", "format:", "  html:", "    include-in-header: |", "      toc: yes", "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text)).toEqual([
      { line: 3, parentPath: ["format", "html"], key: "include-in-header", valueRange: { startCol: 23, endCol: 24 }, rawToken: "|" },
    ]);
  });

  it("DOES emit a real sibling at the SAME indent as the `|` opener (block ended — correct, not an FP)", () => {
    const text = ["---", "format:", "  html:", "    include-in-header: |", "    toc: yes", "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text)).toEqual([
      { line: 3, parentPath: ["format", "html"], key: "include-in-header", valueRange: { startCol: 23, endCol: 24 }, rawToken: "|" },
      { line: 4, parentPath: ["format", "html"], key: "toc", valueRange: { startCol: 9, endCol: 12 }, rawToken: "yes" },
    ]);
  });
});

describe("findNestedFrontMatterValueLines — multi-line flow at depth (the NEW FP, §7.1)", () => {
  // At depth there is NO column-0 backstop, so an under-count is a live cardinal-sin FP,
  // not the safe false negative it is at the top level. All three docs below render exit 0.
  it("(a) does NOT emit a same-indent continuation line of a multi-line flow at depth", () => {
    const text = ["---", "format:", "  html:", "    x: {", "    toc: yes", "    }", "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text)).toEqual([
      { line: 3, parentPath: ["format", "html"], key: "x", valueRange: { startCol: 7, endCol: 8 }, rawToken: "{" },
    ]);
  });

  it("(b) arms flow on an ANCHORED opener whose token starts with `&`, not `{` (plan-review CRITICAL)", () => {
    const text = ["---", "format:", "  html:", "    foo: &a { x: 1,", "    toc: yes }", "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text)).toEqual([
      { line: 3, parentPath: ["format", "html"], key: "foo", valueRange: { startCol: 9, endCol: 19 }, rawToken: "&a { x: 1," },
    ]);
  });

  it("(c) counts braces QUOTE-AWARE so a quoted `}` does not drop flow depth early (plan-review HIGH)", () => {
    const text = ["---", "execute:", "  foo: {", '  a: "}",', "  echo: maybe,", "  }", "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text)).toEqual([
      { line: 2, parentPath: ["execute"], key: "foo", valueRange: { startCol: 7, endCol: 8 }, rawToken: "{" },
    ]);
  });

  it("resumes emitting a real sibling AFTER a multi-line flow closes", () => {
    const text = ["---", "execute:", "  foo: {", "  }", "  echo: maybe", "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text)).toEqual([
      { line: 2, parentPath: ["execute"], key: "foo", valueRange: { startCol: 7, endCol: 8 }, rawToken: "{" },
      { line: 4, parentPath: ["execute"], key: "echo", valueRange: { startCol: 8, endCol: 13 }, rawToken: "maybe" },
    ]);
  });

  it("does not enter flow-skip for a single-line BALANCED flow collection at depth", () => {
    const text = ["---", "execute:", "  foo: {a: 1}", "  echo: maybe", "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text)).toEqual([
      { line: 2, parentPath: ["execute"], key: "foo", valueRange: { startCol: 7, endCol: 13 }, rawToken: "{a: 1}" },
      { line: 3, parentPath: ["execute"], key: "echo", valueRange: { startCol: 8, endCol: 13 }, rawToken: "maybe" },
    ]);
  });
});

describe("findNestedFrontMatterValueLines — multi-line QUOTED scalars (review CRITICAL FP fix)", () => {
  // A value that opens an unterminated single/double-quoted scalar spans several lines
  // until the closing quote; quarto folds the whole thing into ONE string (all interior
  // lines are literal content). A continuation line at the SAME indent as the key that
  // reads `<closed-sibling>: <text>` MUST NOT be enumerated as a nested mapping — otherwise
  // the closed sibling is resolved+flagged while quarto renders the doc exit 0 (a cardinal-
  // sin false positive the adversarial review caught; flowScan alone missed it because an
  // unterminated quote contains no {}[] brackets). Asserted on the emitted KEY sequence —
  // the essential property is that the closed sibling is NOT emitted.
  it("(d) does NOT emit a closed sibling inside a multi-line DOUBLE-quoted scalar", () => {
    // format.html.title: "Start of title \n echo: false is the default"  — quarto exit 0.
    const text = ["---", "format:", "  html:", '    title: "Start of title', '    echo: false is the default"', "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text).map((e) => e.key)).toEqual(["title"]);
  });

  it("(e) does NOT emit a closed sibling inside a multi-line SINGLE-quoted scalar", () => {
    // format.html.title: 'This covers \n reference-location: choices'  — quarto exit 0.
    const text = ["---", "format:", "  html:", "    title: 'This covers", "    reference-location: choices'", "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text).map((e) => e.key)).toEqual(["title"]);
  });

  it("(f) does NOT emit a closed sibling inside a multi-line quoted scalar at EXECUTE level", () => {
    // execute.output: "some text \n echo: banana"  — quarto exit 0 (output stays OPEN anyway).
    const text = ["---", "execute:", '  output: "some text', '  echo: banana"', "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text).map((e) => e.key)).toEqual(["output"]);
  });

  it("resumes emitting a real sibling AFTER the multi-line quoted scalar closes", () => {
    const text = ["---", "execute:", '  foo: "multi', '  line: x"', "  echo: maybe", "---"].join("\n");
    // `line: x"` closes the quote (continuation, skipped); `echo: maybe` is then a fresh candidate.
    expect(findNestedFrontMatterValueLines(text).map((e) => e.key)).toEqual(["foo", "echo"]);
  });

  it("does NOT arm quote-skip for a single-line CLOSED quoted value (echo: \"fenced\" still emits its sibling)", () => {
    const text = ["---", "execute:", '  echo: "fenced"', "  eval: banana", "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text).map((e) => e.key)).toEqual(["echo", "eval"]);
  });

  // Regression guard for the L4 §9-review primary risk (Session 132, other-container slice):
  // the multi-line quoted fold class (cases d/e/f above) must hold under a NEWLY-VALIDATED
  // container too, not just execute:/format:. crossref.fig-title(open) opens an unterminated
  // double-quoted scalar whose continuation reads `chapters: banana` at the SAME indent —
  // quarto folds both lines into ONE fig-title string (exit 0, grounded firsthand) so the
  // closed sibling crossref.chapters must NOT be enumerated and flagged. Both the author's
  // sweep and a fresh 4-lens adversarial review found ZERO FPs; this locks the container-
  // agnostic scanFlow guard so a future regression is caught on the new surface.
  it("(g) does NOT emit a closed sibling inside a multi-line quoted scalar under a NEW container (crossref)", () => {
    const text = ["---", "crossref:", '  fig-title: "Big caption', '  chapters: banana inside the quote"', "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text).map((e) => e.key)).toEqual(["fig-title"]);
  });
});

describe("findNestedFrontMatterValueLines — arming discipline parity with findProjectConfigValueLines (BACKLOG: .qmd sibling-enumerator OLD arming, Session 153)", () => {
  // The same two arming defects fixed in the top-level sibling, at depth (grounded firsthand
  // vs quarto 1.7.33):
  //  • Defect B (the cardinal-sin FALSE POSITIVE): the guard was armed only from EMITTED
  //    (indented, resolvable) lines, so a multi-line quoted scalar opened on a SKIPPED line —
  //    a COLUMN-0 line, which this enumerator skips as the top-level pass's job — left its fold
  //    unguarded, and a nested mapping-looking line folded inside it was emitted and flagged on
  //    a document quarto renders exit 0.
  //  • Defect A (the false NEGATIVE): the whole-token arm set a phantom quote from an inner
  //    apostrophe in a plain nested scalar, swallowing the following nested keys.
  it("Defect B: does NOT emit a nested key folded inside a COLUMN-0 multi-line quoted scalar", () => {
    // `title: "My great` opens a double-quoted scalar at column 0 — the nested enumerator skips
    // column-0 lines, so the OLD code never armed here; `execute:` and `  echo: banana` are all
    // FOLDED into title's string and there is no execute block at all (quarto exit 0, grounded
    // firsthand). Arming from every scalar line (including the skipped column-0 one) suppresses
    // the folded `echo` the OLD code emitted+flagged.
    const text = ["---", 'title: "My great', "execute:", "  echo: banana", 'end"', "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text).map((e) => e.key)).toEqual([]);
  });

  it("Defect A: STILL emits a nested key after an apostrophe-bearing plain scalar sibling", () => {
    // `toc-title: Don't skip` is a plain scalar (the `'` is literal, quarto exit 0) — it must NOT
    // arm a quote. `number-sections: banana` below it is a real invalid boolean (quarto exit 1)
    // and MUST be emitted; the OLD whole-token arm set a phantom `'` that swallowed it.
    const text = ["---", "format:", "  html:", "    toc-title: Don't skip", "    number-sections: banana", "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text).map((e) => e.key)).toEqual(["toc-title", "number-sections"]);
  });

  it("control: a PLAIN nested closed-enum value is still emitted (no over-suppression)", () => {
    const text = ["---", "format:", "  html:", "    number-sections: banana", "---"].join("\n");
    expect(findNestedFrontMatterValueLines(text).map((e) => e.key)).toEqual(["number-sections"]);
  });
});
