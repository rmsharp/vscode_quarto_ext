import { describe, expect, it } from "vitest";
import {
  cellOptionScopeFor,
  completionContextAt,
  isMappingSeparator,
  mappingColonAt,
} from "../../src/core/yaml-context";

/** Compute a 0-based character offset for (line, col) in `\n`-joined text. */
function offsetAt(text: string, line: number, col: number): number {
  const lines = text.split("\n");
  let off = 0;
  for (let i = 0; i < line; i++) {
    off += lines[i].length + 1; // + the "\n"
  }
  return off + col;
}

describe("completionContextAt — cell-option key", () => {
  it("returns a cell-option-key context for a partially-typed key on a #| line", () => {
    const text = ["```{python}", "#| ec", "x = 1", "```"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 5)); // after "ec"
    expect(ctx).toEqual({
      kind: "cell-option-key",
      parentPath: [],
      token: "ec",
      replaceRange: { line: 1, startCol: 3, endCol: 5 },
      engine: "jupyter",
    });
  });

  it("offers all keys (empty token) right after `#| `", () => {
    const text = ["```{python}", "#| ", "```"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 3));
    expect(ctx?.kind).toBe("cell-option-key");
    expect(ctx?.token).toBe("");
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 3, endCol: 3 });
  });

  it("replaces the WHOLE key token on a mid-token cursor (Learning #15b)", () => {
    const text = ["```{python}", "#| echo: false", "```"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 5)); // inside "ec|ho"
    expect(ctx?.token).toBe("ec");
    // The replace span covers all of "echo" [3,7), not just up to the cursor.
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 3, endCol: 7 });
  });

  it("returns null inside the prefix/gap, before the key slot", () => {
    const text = ["```{python}", "#| echo: false", "```"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 1)); // between # and |
    expect(ctx).toBeNull();
  });

  it("returns null on a plain code line inside the cell", () => {
    const text = ["```{python}", "x = 1", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 3))).toBeNull();
  });

  it("returns null on a prose line", () => {
    const text = ["# Heading", "", "Some prose here."].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 5))).toBeNull();
  });

  it("returns null on a sequence-item option line (no key)", () => {
    const text = ["```{python}", "#| fig-cap:", "#|   - a", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 7))).toBeNull();
  });

  it("maps the engine: {r} → knitr", () => {
    const text = ["```{r}", "#| ec", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 5))?.engine).toBe("knitr");
  });

  it("maps the engine: {ojs} //| line → ojs", () => {
    const text = ["```{ojs}", "//| ec", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 6))?.engine).toBe("ojs");
  });

  it("returns null on an INDENTED `#|` line (Quarto treats it as code)", () => {
    const text = ["```{python}", "  #| ec", "x = 1", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 7))).toBeNull();
  });
});

describe("completionContextAt — cell-option value (6d-2)", () => {
  it("returns a value context at an empty value position (`#| echo: `)", () => {
    const text = ["```{python}", "#| echo: ", "```"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 9)); // after "echo: "
    expect(ctx).toEqual({
      kind: "cell-option-value",
      parentPath: ["echo"], // the key being valued
      token: "",
      replaceRange: { line: 1, startCol: 9, endCol: 9 },
      engine: "jupyter",
    });
  });

  it("fires right after the colon with no space yet (`:` trigger, `#| echo:`)", () => {
    const text = ["```{python}", "#| echo:", "```"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 8)); // right after ":"
    expect(ctx?.kind).toBe("cell-option-value");
    expect(ctx?.parentPath).toEqual(["echo"]);
    expect(ctx?.token).toBe("");
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 8, endCol: 8 });
  });

  it("replaces the WHOLE value token on a mid-value cursor (`#| echo: false`)", () => {
    const text = ["```{python}", "#| echo: false", "```"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 11)); // inside "fa|lse"
    expect(ctx?.kind).toBe("cell-option-value");
    expect(ctx?.token).toBe("fa");
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 9, endCol: 14 });
  });

  it("maps the engine on a value position: {r} → knitr", () => {
    const text = ["```{r}", "#| eval: ", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 9))?.engine).toBe("knitr");
  });

  it("stays a KEY context (not value) when the cursor is at the colon", () => {
    const text = ["```{python}", "#| echo: false", "```"].join("\n");
    // col 7 = end of "echo", at the colon: still the key slot, not a value.
    expect(completionContextAt(text, offsetAt(text, 1, 7))?.kind).toBe("cell-option-key");
  });

  it("returns null in the whitespace gap between the colon and the value", () => {
    const text = ["```{python}", "#| echo:   false", "```"].join("\n");
    // col 9 sits in the run of spaces before "false" (value starts at col 11).
    expect(completionContextAt(text, offsetAt(text, 1, 9))).toBeNull();
  });

  it("returns null when the cursor is inside a trailing inline comment", () => {
    const text = ["```{python}", "#| echo: false  # comment", "```"].join("\n");
    // col 18 is inside the comment; the value span ends at "false" (col 14).
    expect(completionContextAt(text, offsetAt(text, 1, 18))).toBeNull();
  });
});

describe("completionContextAt — front-matter key (6d-4)", () => {
  it("returns a frontmatter-key context for a partially-typed top-level key", () => {
    const text = ["---", "title: x", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 2)); // inside "ti|tle"
    expect(ctx).toEqual({
      kind: "frontmatter-key",
      parentPath: [],
      token: "ti",
      replaceRange: { line: 1, startCol: 0, endCol: 5 }, // covers all of "title"
    });
  });

  it("offers all keys (empty token) on a blank front-matter line", () => {
    const text = ["---", "title: x", "", "format: html", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 2, 0));
    expect(ctx?.kind).toBe("frontmatter-key");
    expect(ctx?.token).toBe("");
    expect(ctx?.replaceRange).toEqual({ line: 2, startCol: 0, endCol: 0 });
  });

  it("completes a bare key still being typed (no colon yet)", () => {
    const text = ["---", "titl", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 4));
    expect(ctx?.kind).toBe("frontmatter-key");
    expect(ctx?.token).toBe("titl");
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 0, endCol: 4 });
  });

  it("replaces the WHOLE key token on a mid-token cursor (Learning #15b)", () => {
    const text = ["---", "format: html", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 3)); // inside "for|mat"
    expect(ctx?.token).toBe("for");
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 0, endCol: 6 });
  });

  it("hands off to a frontmatter-value context past the colon (6d-5 takes over)", () => {
    const text = ["---", "title: My Doc", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 9)); // in "My Doc"
    expect(ctx?.kind).toBe("frontmatter-value");
    expect(ctx?.parentPath).toEqual(["title"]);
  });

  it("returns a nested frontmatter-key context under the `execute:` container (6d-6)", () => {
    const text = ["---", "execute:", "  enabled: false", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 2, 4)); // inside "en|abled"
    expect(ctx).toEqual({
      kind: "frontmatter-key",
      parentPath: ["execute"],
      token: "en",
      replaceRange: { line: 2, startCol: 2, endCol: 9 }, // covers all of "enabled"
    });
  });

  it("returns null on a block-sequence item line (`- value`)", () => {
    const text = ["---", "bibliography:", "- a.bib", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 3))).toBeNull();
  });

  it("returns null on a YAML comment line in front matter", () => {
    const text = ["---", "# a comment", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 3))).toBeNull();
  });

  it("returns null on the `---` fence lines themselves", () => {
    const text = ["---", "title: x", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 0, 0))).toBeNull();
    expect(completionContextAt(text, offsetAt(text, 2, 0))).toBeNull();
  });
});

describe("completionContextAt — nested front-matter key under `execute:` (6d-6)", () => {
  it("offers all execute keys (empty token) on a blank indented line under execute", () => {
    const text = ["---", "execute:", "  ", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 2, 2));
    expect(ctx).toEqual({
      kind: "frontmatter-key",
      parentPath: ["execute"],
      token: "",
      replaceRange: { line: 2, startCol: 2, endCol: 2 },
    });
  });

  it("replaces the WHOLE nested key token on a mid-token cursor", () => {
    const text = ["---", "execute:", "  freeze: auto", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 2, 4)); // inside "fr|eeze"
    expect(ctx?.kind).toBe("frontmatter-key");
    expect(ctx?.parentPath).toEqual(["execute"]);
    expect(ctx?.token).toBe("fr");
    expect(ctx?.replaceRange).toEqual({ line: 2, startCol: 2, endCol: 8 });
  });

  it("finds the real parent past an intervening deeper block", () => {
    const text = [
      "---",
      "execute:",
      "  julia:",
      "    exeflags: x",
      "  enabled: false",
      "---",
    ].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 4, 4)); // "en|abled"
    expect(ctx?.kind).toBe("frontmatter-key");
    expect(ctx?.parentPath).toEqual(["execute"]);
  });

  it("bails (null) under a NON-allow-listed container (`website:`)", () => {
    const text = ["---", "website:", "  title: x", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 4))).toBeNull();
  });

  it("bails (null) when the container has a scalar value (`execute: false`)", () => {
    const text = ["---", "execute: false", "  enabled: x", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 4))).toBeNull();
  });

  it("bails (null) on a block-scalar container (`execute: |`)", () => {
    const text = ["---", "execute: |", "  enabled: x", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 4))).toBeNull();
  });

  it("bails (null) on deeper nesting (parent is itself indented)", () => {
    const text = ["---", "execute:", "  julia:", "    exeflags: x", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 3, 6))).toBeNull(); // in "exeflags"
  });

  it("bails (null) on a nested block-sequence item under execute", () => {
    const text = ["---", "execute:", "  - foo", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 4))).toBeNull();
  });
});

describe("completionContextAt — nested front-matter key under `format:` (6d-6 cont.)", () => {
  it("returns a nested frontmatter-key context under the `format:` container", () => {
    const text = ["---", "format:", "  html", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 2, 4)); // inside "ht|ml"
    expect(ctx).toEqual({
      kind: "frontmatter-key",
      parentPath: ["format"],
      token: "ht",
      replaceRange: { line: 2, startCol: 2, endCol: 6 }, // covers all of "html"
    });
  });

  it("offers all format names (empty token) on a blank indented line under format", () => {
    const text = ["---", "format:", "  ", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 2, 2));
    expect(ctx).toEqual({
      kind: "frontmatter-key",
      parentPath: ["format"],
      token: "",
      replaceRange: { line: 2, startCol: 2, endCol: 2 },
    });
  });

  it("returns a nested frontmatter-VALUE context past the colon (`  html: …`)", () => {
    // A format name carries no value enum, so the provider offers nothing here —
    // the per-format-options deferral is graceful (parentPath = [container, name]).
    const text = ["---", "format:", "  html: default", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 2, 10)); // in "de|fault"
    expect(ctx).toEqual({
      kind: "frontmatter-value",
      parentPath: ["format", "html"],
      token: "de",
      replaceRange: { line: 2, startCol: 8, endCol: 15 },
    });
  });

  it("returns a per-format KEY context two levels under `format:` (6d-6+ b2-i)", () => {
    const text = ["---", "format:", "  html:", "    toc: true", "---"].join("\n");
    // "    toc" is a per-format option key under format>html; the bounded 2-level
    // ancestor walk (rooted at `format`) yields ["format","html"] (was deferred).
    const ctx = completionContextAt(text, offsetAt(text, 3, 6)); // in "to|c"
    expect(ctx).toEqual({
      kind: "frontmatter-key",
      parentPath: ["format", "html"],
      token: "to",
      replaceRange: { line: 3, startCol: 4, endCol: 7 }, // covers all of "toc"
    });
  });

  it("offers all per-format keys (empty token) on a blank line under `format: <fmt>`", () => {
    const text = ["---", "format:", "  html:", "    ", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 3, 4));
    expect(ctx).toEqual({
      kind: "frontmatter-key",
      parentPath: ["format", "html"],
      token: "",
      replaceRange: { line: 3, startCol: 4, endCol: 4 },
    });
  });

  it("returns a deep-nested KEY context THREE levels under `format:` (b2-iii-key)", () => {
    const text = ["---", "format:", "  html:", "    theme:", "      x", "---"].join("\n");
    // "      x" is a sub-key one object level under the `theme` format option; the
    // N-level format-rooted walk climbs to the column-0 `format` root and emits the
    // full ancestor path. The detector is schema-free — it does not know `theme` is
    // an object; the reader decides whether the option resolves to child keys.
    const ctx = completionContextAt(text, offsetAt(text, 4, 7)); // in "x"
    expect(ctx).toEqual({
      kind: "frontmatter-key",
      parentPath: ["format", "html", "theme"],
      token: "x",
      replaceRange: { line: 4, startCol: 6, endCol: 7 },
    });
  });

  it("emits the FULL ancestor path even FOUR levels under `format:` (reader gates depth)", () => {
    const text = ["---", "format:", "  html:", "    comments:", "      hypothesis:", "        x", "---"].join("\n");
    // The detector climbs any number of pure-mapping levels to the `format` root —
    // it is schema-free (position ⊥ data). "Offers nothing at depth 4" is enforced
    // by the READER returning [] for a length-≥4 path (v1 resolves one object level).
    const ctx = completionContextAt(text, offsetAt(text, 5, 9)); // in "x"
    expect(ctx).toEqual({
      kind: "frontmatter-key",
      parentPath: ["format", "html", "comments", "hypothesis"],
      token: "x",
      replaceRange: { line: 5, startCol: 8, endCol: 9 },
    });
  });

  it("bails (null) two levels under a NON-`format` root (the walk is format-rooted)", () => {
    const text = ["---", "website:", "  html:", "    toc: x", "---"].join("\n");
    // The 2-level walk is rooted at `format` only; any other 2-level root bails
    // (mirrors the `execute:\n  julia:\n    exeflags` guard above).
    expect(completionContextAt(text, offsetAt(text, 3, 6))).toBeNull();
  });

  it("returns a per-format VALUE context two levels under `format:` (6d-6+ b2-ii)", () => {
    const text = ["---", "format:", "  html:", "    code-overflow: scroll", "---"].join("\n");
    // Past the colon on a per-format option line, the value slot completes that
    // option's enum. `parentPath` grows to [container, fmt, key] so the provider
    // resolves the values from `frontMatterKeys(["format","html"]).find(key)`.
    const ctx = completionContextAt(text, offsetAt(text, 3, 21)); // in "sc|roll"
    expect(ctx).toEqual({
      kind: "frontmatter-value",
      parentPath: ["format", "html", "code-overflow"],
      token: "sc",
      replaceRange: { line: 3, startCol: 19, endCol: 25 }, // covers all of "scroll"
    });
  });

  it("offers per-format values (empty token) on an empty value slot under `format: <fmt>`", () => {
    const text = ["---", "format:", "  html:", "    code-overflow: ", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 3, 19)); // at the empty value slot
    expect(ctx).toEqual({
      kind: "frontmatter-value",
      parentPath: ["format", "html", "code-overflow"],
      token: "",
      replaceRange: { line: 3, startCol: 19, endCol: 19 },
    });
  });

  it("returns a deep-nested VALUE context FOUR elements under `format:` (b2-iii-value)", () => {
    const text = ["---", "format:", "  html:", "    code-tools:", "      toggle: false", "---"].join("\n");
    // Past the colon on a sub-key one object level under a per-format option, the
    // value slot completes that sub-key's values. `parentPath` grows to
    // [container, fmt, opt, key] (now FOUR elements) so the provider resolves via
    // `frontMatterKeys(["format","html","code-tools"]).find("toggle")` — no
    // detector or provider change needed (already generic over path length; this
    // locks the shape in, per the plan's own "confirm parentPath.slice(0,-1)
    // resolves children, not []" dragon).
    const ctx = completionContextAt(text, offsetAt(text, 4, 16)); // in "fa|lse"
    expect(ctx).toEqual({
      kind: "frontmatter-value",
      parentPath: ["format", "html", "code-tools", "toggle"],
      token: "fa",
      replaceRange: { line: 4, startCol: 14, endCol: 19 }, // covers all of "false"
    });
  });
});

describe("completionContextAt — front-matter value (6d-5)", () => {
  it("returns a frontmatter-value context at an empty value position (`toc: `)", () => {
    const text = ["---", "toc: ", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 5)); // after "toc: "
    expect(ctx).toEqual({
      kind: "frontmatter-value",
      parentPath: ["toc"], // the key being valued
      token: "",
      replaceRange: { line: 1, startCol: 5, endCol: 5 },
    });
  });

  it("fires right after the colon with no space yet (`:` trigger, `toc:`)", () => {
    const text = ["---", "toc:", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 4)); // right after ":"
    expect(ctx?.kind).toBe("frontmatter-value");
    expect(ctx?.parentPath).toEqual(["toc"]);
    expect(ctx?.token).toBe("");
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 4, endCol: 4 });
  });

  it("replaces the WHOLE value token on a mid-value cursor (`toc: false`)", () => {
    const text = ["---", "toc: false", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 7)); // inside "fa|lse"
    expect(ctx?.kind).toBe("frontmatter-value");
    expect(ctx?.token).toBe("fa");
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 5, endCol: 10 });
  });

  it("stays a KEY context (not value) when the cursor is at the colon", () => {
    const text = ["---", "toc: false", "---"].join("\n");
    // col 3 = end of "toc", at the colon: still the key slot, not a value.
    expect(completionContextAt(text, offsetAt(text, 1, 3))?.kind).toBe("frontmatter-key");
  });

  it("returns null in the whitespace gap between the colon and the value", () => {
    const text = ["---", "toc:   false", "---"].join("\n");
    // col 5 sits in the run of spaces before "false" (value starts at col 7).
    expect(completionContextAt(text, offsetAt(text, 1, 5))).toBeNull();
  });

  it("returns null when the cursor is inside a trailing inline comment", () => {
    const text = ["---", "toc: false  # comment", "---"].join("\n");
    // col 13 is inside the comment; the value span ends at "false" (col 10).
    expect(completionContextAt(text, offsetAt(text, 1, 13))).toBeNull();
  });

  it("returns a nested frontmatter-value context on an INDENTED execute line (6d-6 cont.)", () => {
    const text = ["---", "execute:", "  enabled: false", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 2, 13)); // in "fa|lse"
    expect(ctx).toEqual({
      kind: "frontmatter-value",
      parentPath: ["execute", "enabled"], // [container, key being valued]
      token: "fa",
      replaceRange: { line: 2, startCol: 11, endCol: 16 },
    });
  });

  it("fires right after the colon with no space on a nested line (`  cache:`)", () => {
    const text = ["---", "execute:", "  cache:", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 2, 8)); // right after ":"
    expect(ctx).toEqual({
      kind: "frontmatter-value",
      parentPath: ["execute", "cache"],
      token: "",
      replaceRange: { line: 2, startCol: 8, endCol: 8 },
    });
  });

  it("replaces the WHOLE nested value token on a mid-value cursor (`  freeze: auto`)", () => {
    const text = ["---", "execute:", "  freeze: auto", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 2, 12)); // inside "au|to"
    expect(ctx?.kind).toBe("frontmatter-value");
    expect(ctx?.parentPath).toEqual(["execute", "freeze"]);
    expect(ctx?.token).toBe("au");
    expect(ctx?.replaceRange).toEqual({ line: 2, startCol: 10, endCol: 14 });
  });

  it("returns null in the whitespace gap before a nested value", () => {
    const text = ["---", "execute:", "  cache:   true", "---"].join("\n");
    // col 9 sits in the run of spaces before "true" (value starts at col 11).
    expect(completionContextAt(text, offsetAt(text, 2, 9))).toBeNull();
  });

  it("returns null inside a trailing inline comment on a nested value line", () => {
    const text = ["---", "execute:", "  freeze: auto  # c", "---"].join("\n");
    // col 17 is inside the comment; the value span ends at "auto" (col 14).
    expect(completionContextAt(text, offsetAt(text, 2, 17))).toBeNull();
  });
});

describe("completionContextAt — the separator guard's effect on COMPLETION (P2 shared consumer)", () => {
  // `topLevelSlots` is shared by the value ENUMERATOR and the completion providers, so the
  // guard lands on both. Completion must lose the VALUE slot on a non-mapping line (there is
  // no key `toc` to value there — YAML's key is `toc:`) while KEY completion is untouched.
  it("STILL offers value completion past a non-separator colon — completion is mid-typing", () => {
    // The separator rule is DIAGNOSTICS-side only. `topLevelSlots` is shared with the
    // completion providers, and a `key:value` line there is a user mid-typing that the
    // provider deliberately repairs by prepending a space (`code-overflow:scroll` →
    // ` scroll`, pinned in test/integration/suite/yaml.test.ts). Narrowing the value slot
    // in the shared grammar silently removed that affordance — 2 integration tests, S148.
    const text = ["---", "toc:scroll", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 8))?.kind).toBe("frontmatter-value");
  });

  it("still offers KEY completion on that same line (the key slot is untouched)", () => {
    const text = ["---", "toc:: true", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 2)); // inside "to|c"
    expect(ctx?.kind).toBe("frontmatter-key");
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 0, endCol: 3 });
  });

  it("still offers value completion right after a bare colon (`toc:` — the `:` trigger)", () => {
    const text = ["---", "toc:", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 4));
    expect(ctx?.kind).toBe("frontmatter-value");
    expect(ctx?.parentPath).toEqual(["toc"]);
  });

  it("STILL offers NESTED value completion past a non-separator colon (same reason)", () => {
    const text = ["---", "execute:", "  echo:fenced", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 10))?.kind).toBe("frontmatter-value");
  });

  it("still offers NESTED value completion on a normal `  key: value` line", () => {
    const text = ["---", "execute:", "  echo: fen", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 2, 11));
    expect(ctx?.kind).toBe("frontmatter-value");
    expect(ctx?.parentPath).toEqual(["execute", "echo"]);
  });

  it("still offers NESTED value completion right after a bare colon (`  echo:`)", () => {
    const text = ["---", "execute:", "  echo:", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 7))?.kind).toBe("frontmatter-value");
  });

  it("still offers value completion on a normal `key: value` line", () => {
    const text = ["---", "toc: tr", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 7));
    expect(ctx?.kind).toBe("frontmatter-value");
    expect(ctx?.token).toBe("tr");
  });
});

describe("mappingColonAt (P2 — find the separator colon, not the first colon)", () => {
  it("returns the first colon when it IS the separator", () => {
    expect(mappingColonAt("toc: true")).toBe(3);
  });

  it("SCANS PAST a non-separator colon to the real one (`toc:: true`)", () => {
    expect(mappingColonAt("toc:: true")).toBe(4);
  });

  it("scans past a colon inside the key (`a:b: banana`)", () => {
    expect(mappingColonAt("a:b: banana")).toBe(3);
  });

  it("scans past a URL-ish colon run (`url:http://x: v`)", () => {
    expect(mappingColonAt("url:http://x: v")).toBe(12);
  });

  it("returns -1 when NO colon is a separator (`toc:banana` — a plain scalar)", () => {
    expect(mappingColonAt("toc:banana")).toBe(-1);
  });

  it("honours the `from` offset so an indented line skips its leading blanks", () => {
    expect(mappingColonAt("  echo:: banana", 2)).toBe(7);
  });

  it("finds a block opener's trailing colon (`execute:`)", () => {
    expect(mappingColonAt("execute:")).toBe(7);
  });
});

describe("isMappingSeparator (P2 — the key/value separator grammar)", () => {
  it("is true for a colon followed by a space (`toc: true`)", () => {
    expect(isMappingSeparator("toc: true", 3)).toBe(true);
  });

  it("is true for a colon at END OF LINE — a block opener (`execute:`)", () => {
    expect(isMappingSeparator("execute:", 7)).toBe(true);
  });

  it("is true for a colon followed by a TAB (quarto renders `toc:\ttrue` exit 0)", () => {
    expect(isMappingSeparator("toc:\ttrue", 3)).toBe(true);
  });

  // The defect this slice fixes: on `toc:: true` YAML's key is `toc:` (the FIRST colon is
  // part of the key scalar, not a separator) and quarto renders it exit 0 on any OPEN key
  // set. Splitting at the first colon yields the bogus value token `: true`, which the
  // matcher then flags — a cardinal-sin false positive (plan §2.8, firsthand-verified S148).
  it("is FALSE for a colon followed by another colon (`toc:: true` — quarto exit 0)", () => {
    expect(isMappingSeparator("toc:: true", 3)).toBe(false);
  });

  it("is FALSE for a colon followed by a letter (`toc:banana` — a plain scalar)", () => {
    expect(isMappingSeparator("toc:banana", 3)).toBe(false);
  });

  it("is FALSE for a colon followed by `#` (no space ⇒ not a comment either)", () => {
    expect(isMappingSeparator("toc:#c", 3)).toBe(false);
  });

  it("judges the colon it is GIVEN, not the first one on the line", () => {
    // On `toc:: true` the SECOND colon is the real separator.
    expect(isMappingSeparator("toc:: true", 4)).toBe(true);
  });
});

describe("completionContextAt — only the cell's LEADING option block completes (S160)", () => {
  it("offers NO cell-option completion on a `#|` line that follows code", () => {
    // Quarto ignores a `#|` line below the leading block, so offering it the cell-option
    // key list would advertise options that will never take effect. The completion and
    // diagnostics surfaces share `findCellOptionLines`, so they agree by construction.
    const text = ["```{python}", "1+1", "#| ec", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 5))).toBeNull();
  });

  it("STILL offers cell-option completion in the leading block", () => {
    // The control that stops the pin above being satisfied by a wholesale loss of
    // cell-option completion — the same token in the leading block must still complete.
    const text = ["```{python}", "#| ec", "1+1", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 5))?.kind).toBe("cell-option-key");
  });
});

describe("cellOptionScopeFor — the schema scope a cell's options are VALIDATED against (S161)", () => {
  // `engineFor` returns `undefined` for any language outside r/python/julia/ojs/js, and
  // `SchemaIndex.cellOptions(undefined)` deliberately means "no filtering — the FULL set",
  // which is right for COMPLETION (offering a little too much is harmless) and wrong for
  // DIAGNOSTICS. Quarto scopes its cell schema to the DOCUMENT's engine, which a cell
  // language alone does not determine: `{sql}` is knitr in a document that also holds an
  // `{r}` cell, and markdown otherwise. Grounded firsthand vs quarto 1.7.33 — `{sql}` +
  // `--| cache: banana` renders exit 1 in a knitr document but exit 0 in a markdown- or
  // jupyter-engine one. Validating against the full set would therefore squiggle a document
  // quarto ACCEPTS: the cardinal sin, and one this session's own L1 would have introduced by
  // emitting those lines for the first time. The FP-safe scope is the intersection.
  it("maps a language whose engine IS determined to that engine", () => {
    expect(cellOptionScopeFor("r")).toBe("knitr");
    expect(cellOptionScopeFor("python")).toBe("jupyter");
    expect(cellOptionScopeFor("julia")).toBe("jupyter");
    expect(cellOptionScopeFor("ojs")).toBe("ojs");
  });

  it('maps a language whose engine is NOT determined to "unknown", never to undefined', () => {
    // `undefined` here would be the whole-set fallback — the FP. Assert the literal.
    for (const lang of ["sql", "matlab", "c", "sas", "fortran", "apl", "stata", "banana"]) {
      expect(cellOptionScopeFor(lang), lang).toBe("unknown");
    }
  });
});

describe("cellOptionScopeFor — a cell-HANDLER language is validated by no cell schema at all (S162)", () => {
  // Quarto registers a small set of cell HANDLERS — `handlers/languages.yml` is exactly
  // ["mermaid","dot"] — and `parseAndValidateCellOptions` swaps the engine's cell schema
  // for `handlers/<lang>/schema.yml` when the cell language is one of them. `dot` has no
  // such resource, so the lookup throws, `schema === undefined`, and NOTHING is validated;
  // `mermaid` has one, but it declares only `mermaid-format` and `theme` and admits any
  // other key. Either way no cell-option field applies. Grounded firsthand vs 1.7.33 in a
  // MARKDOWN-engine document: `{dot}` + `//| echo|fig-align|eval|cache|code-fold: banana` all
  // render exit 0, as does `{mermaid}` + `#|` or `%%| echo: banana` — while the control
  // `{sql}` + `--| echo: banana` renders exit 1. We flag every one of those `{dot}`/`{mermaid}`
  // lines today (measured against the shipped tree), which is the cardinal sin.
  //
  // The engine qualifier is load-bearing and was missing from the first revision of this
  // comment (S162 §9 review). A KNITR document also runs knitr's own chunk machinery over a
  // handler cell: there `{mermaid}` + `#| echo: banana` renders exit 1 with the structural
  // `The chunk options should start with '%%| ' instead of '#| '` — which fires identically
  // for the VALID `#| echo: false`, so no value diagnostic can express it — and `//| include:
  // banana` in a `{dot}` cell is a real value-dependent failure we deliberately give up. See
  // `cellOptionScopeFor`'s docstring for the full accounting.
  it('maps the two cell-handler languages to "none"', () => {
    expect(cellOptionScopeFor("dot")).toBe("none");
    expect(cellOptionScopeFor("mermaid")).toBe("none");
  });

  it("matches the handler list CASE-SENSITIVELY, exactly as quarto does", () => {
    // Quarto tests `languages.indexOf(language)` against the raw fence token and never folds
    // case, so `{DOT}`/`{Dot}`/`{Mermaid}` are ordinary unknown languages: they take the `#`
    // comment-char default AND the ordinary cell schema. Measured firsthand vs 1.7.33 — each
    // renders **exit 1** with a real `Field "echo" has value banana` on `#| echo: banana`,
    // and we flag all three today, correctly. A case-folding lookup here would turn those
    // true positives into silence: over-suppression is the failure direction a fix that ADDS
    // suppression has to guard, and this is the whole of it.
    for (const lang of ["DOT", "Dot", "dOt", "Mermaid", "MERMAID", "merMaid"]) {
      expect(cellOptionScopeFor(lang), lang).toBe("unknown");
    }
  });

  it("still OFFERS cell-option completion in a handler cell — only validation narrows", () => {
    // The same asymmetry that separates `"unknown"` from `undefined`, one step further out:
    // an over-OFFER is benign, an over-FLAG is the cardinal sin. Completion goes through
    // `engineFor`, not `cellOptionScopeFor`, so a `{dot}` cell keeps completing the
    // cell-option list even though nothing there will ever be validated. A narrowing that
    // reached completion too would be a silent capability loss with no defect to justify it.
    // (`//` is genuinely dot's comment char in quarto's own table, so quarto reads this line
    // as a directive — it just validates it against a handler schema that does not exist.)
    const text = ["```{dot}", "//| ec", "digraph {a->b}", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 6))?.kind).toBe("cell-option-key");
  });

  it("narrows ONLY the handler languages — every other language keeps its scope", () => {
    // The exclusion is provably minimal: `handlers/languages.yml` has exactly two entries,
    // and 12 other languages spanning every comment-char family — matlab, stata, c, apl,
    // haskell, bash, ruby, go, tikz, css, sas and the unknown `{banana}` — each render
    // exit 1 with a real value error on `echo: banana` (measured). Widening the set beyond
    // these two would lose real true positives.
    for (const lang of ["sql", "matlab", "c", "sas", "fortran", "apl", "stata", "banana"]) {
      expect(cellOptionScopeFor(lang), lang).toBe("unknown");
    }
    expect(cellOptionScopeFor("r")).toBe("knitr");
    expect(cellOptionScopeFor("python")).toBe("jupyter");
    expect(cellOptionScopeFor("ojs")).toBe("ojs");
  });
});

describe("completionContextAt — cell-option completion follows the LANGUAGE's comment char (S161)", () => {
  it("offers cell-option completion on a `--|` line in a {sql} cell", () => {
    // Quarto reads this as a directive (`{sql}` + `--| echo: banana` renders exit 1 with a
    // real value error), so the key list belongs here. Pre-fix the surface was silent.
    const text = ["```{sql}", "--| ec", "SELECT 1", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 6))?.kind).toBe("cell-option-key");
  });

  it("offers NO cell-option completion on a `#|` line in a {sql} cell", () => {
    // Quarto reads no directive there at all (exit 0), so offering the key list would
    // advertise options that can never take effect — the completion-surface twin of the
    // diagnostics false positive.
    const text = ["```{sql}", "#| ec", "SELECT 1", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 5))).toBeNull();
  });

  it("offers NO cell-option completion on a `//|` line in a {python} cell", () => {
    const text = ["```{python}", "//| ec", "x = 1", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 6))).toBeNull();
  });
});
