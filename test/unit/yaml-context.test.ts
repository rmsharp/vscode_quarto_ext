import { describe, expect, it } from "vitest";
import {
  cellOptionScopeFor,
  completionContextAt,
  isMappingSeparator,
  mappingColonAt,
} from "../../src/core/yaml-context";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";

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
    const ctx = completionContextAt(text, offsetAt(text, 1, 5), () => undefined); // after "ec"
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
    const ctx = completionContextAt(text, offsetAt(text, 1, 3), () => undefined);
    expect(ctx?.kind).toBe("cell-option-key");
    expect(ctx?.token).toBe("");
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 3, endCol: 3 });
  });

  it("replaces the WHOLE key token on a mid-token cursor (Learning #15b)", () => {
    const text = ["```{python}", "#| echo: false", "```"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 5), () => undefined); // inside "ec|ho"
    expect(ctx?.token).toBe("ec");
    // The replace span covers all of "echo" [3,7), not just up to the cursor.
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 3, endCol: 7 });
  });

  it("returns null inside the prefix/gap, before the key slot", () => {
    const text = ["```{python}", "#| echo: false", "```"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 1), () => undefined); // between # and |
    expect(ctx).toBeNull();
  });

  it("returns null on a plain code line inside the cell", () => {
    const text = ["```{python}", "x = 1", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 3), () => undefined)).toBeNull();
  });

  it("returns null on a prose line", () => {
    const text = ["# Heading", "", "Some prose here."].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 5), () => undefined)).toBeNull();
  });

  it("returns null on a sequence-item option line (no key)", () => {
    const text = ["```{python}", "#| fig-cap:", "#|   - a", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 7), () => undefined)).toBeNull();
  });

  it("maps the engine: {r} → knitr", () => {
    const text = ["```{r}", "#| ec", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 5), () => undefined)?.engine).toBe("knitr");
  });

  it("maps the engine: {ojs} //| line → ojs", () => {
    const text = ["```{ojs}", "//| ec", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 6), () => undefined)?.engine).toBe("ojs");
  });

  it("returns null on an INDENTED `#|` line (Quarto treats it as code)", () => {
    const text = ["```{python}", "  #| ec", "x = 1", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 7), () => undefined)).toBeNull();
  });
});

describe("completionContextAt — cell-option value (6d-2)", () => {
  it("returns a value context at an empty value position (`#| echo: `)", () => {
    const text = ["```{python}", "#| echo: ", "```"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 9), () => undefined); // after "echo: "
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
    const ctx = completionContextAt(text, offsetAt(text, 1, 8), () => undefined); // right after ":"
    expect(ctx?.kind).toBe("cell-option-value");
    expect(ctx?.parentPath).toEqual(["echo"]);
    expect(ctx?.token).toBe("");
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 8, endCol: 8 });
  });

  it("replaces the WHOLE value token on a mid-value cursor (`#| echo: false`)", () => {
    const text = ["```{python}", "#| echo: false", "```"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 11), () => undefined); // inside "fa|lse"
    expect(ctx?.kind).toBe("cell-option-value");
    expect(ctx?.token).toBe("fa");
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 9, endCol: 14 });
  });

  it("maps the engine on a value position: {r} → knitr", () => {
    const text = ["```{r}", "#| eval: ", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 9), () => undefined)?.engine).toBe("knitr");
  });

  it("stays a KEY context (not value) when the cursor is at the colon", () => {
    const text = ["```{python}", "#| echo: false", "```"].join("\n");
    // col 7 = end of "echo", at the colon: still the key slot, not a value.
    expect(completionContextAt(text, offsetAt(text, 1, 7), () => undefined)?.kind).toBe("cell-option-key");
  });

  it("returns null in the whitespace gap between the colon and the value", () => {
    const text = ["```{python}", "#| echo:   false", "```"].join("\n");
    // col 9 sits in the run of spaces before "false" (value starts at col 11).
    expect(completionContextAt(text, offsetAt(text, 1, 9), () => undefined)).toBeNull();
  });

  it("returns null when the cursor is inside a trailing inline comment", () => {
    const text = ["```{python}", "#| echo: false  # comment", "```"].join("\n");
    // col 18 is inside the comment; the value span ends at "false" (col 14).
    expect(completionContextAt(text, offsetAt(text, 1, 18), () => undefined)).toBeNull();
  });
});

describe("completionContextAt — front-matter key (6d-4)", () => {
  it("returns a frontmatter-key context for a partially-typed top-level key", () => {
    const text = ["---", "title: x", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 2), () => undefined); // inside "ti|tle"
    expect(ctx).toEqual({
      kind: "frontmatter-key",
      parentPath: [],
      token: "ti",
      replaceRange: { line: 1, startCol: 0, endCol: 5 }, // covers all of "title"
    });
  });

  it("offers all keys (empty token) on a blank front-matter line", () => {
    const text = ["---", "title: x", "", "format: html", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 2, 0), () => undefined);
    expect(ctx?.kind).toBe("frontmatter-key");
    expect(ctx?.token).toBe("");
    expect(ctx?.replaceRange).toEqual({ line: 2, startCol: 0, endCol: 0 });
  });

  it("completes a bare key still being typed (no colon yet)", () => {
    const text = ["---", "titl", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 4), () => undefined);
    expect(ctx?.kind).toBe("frontmatter-key");
    expect(ctx?.token).toBe("titl");
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 0, endCol: 4 });
  });

  it("replaces the WHOLE key token on a mid-token cursor (Learning #15b)", () => {
    const text = ["---", "format: html", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 3), () => undefined); // inside "for|mat"
    expect(ctx?.token).toBe("for");
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 0, endCol: 6 });
  });

  it("hands off to a frontmatter-value context past the colon (6d-5 takes over)", () => {
    const text = ["---", "title: My Doc", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 9), () => undefined); // in "My Doc"
    expect(ctx?.kind).toBe("frontmatter-value");
    expect(ctx?.parentPath).toEqual(["title"]);
  });

  it("returns a nested frontmatter-key context under the `execute:` container (6d-6)", () => {
    const text = ["---", "execute:", "  enabled: false", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 2, 4), () => undefined); // inside "en|abled"
    expect(ctx).toEqual({
      kind: "frontmatter-key",
      parentPath: ["execute"],
      token: "en",
      replaceRange: { line: 2, startCol: 2, endCol: 9 }, // covers all of "enabled"
    });
  });

  it("returns null on a block-sequence item line (`- value`)", () => {
    const text = ["---", "bibliography:", "- a.bib", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 3), () => undefined)).toBeNull();
  });

  it("returns null on a YAML comment line in front matter", () => {
    const text = ["---", "# a comment", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 3), () => undefined)).toBeNull();
  });

  it("returns null on the `---` fence lines themselves", () => {
    const text = ["---", "title: x", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 0, 0), () => undefined)).toBeNull();
    expect(completionContextAt(text, offsetAt(text, 2, 0), () => undefined)).toBeNull();
  });
});

describe("completionContextAt — nested front-matter key under `execute:` (6d-6)", () => {
  it("offers all execute keys (empty token) on a blank indented line under execute", () => {
    const text = ["---", "execute:", "  ", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 2, 2), () => undefined);
    expect(ctx).toEqual({
      kind: "frontmatter-key",
      parentPath: ["execute"],
      token: "",
      replaceRange: { line: 2, startCol: 2, endCol: 2 },
    });
  });

  it("replaces the WHOLE nested key token on a mid-token cursor", () => {
    const text = ["---", "execute:", "  freeze: auto", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 2, 4), () => undefined); // inside "fr|eeze"
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
    const ctx = completionContextAt(text, offsetAt(text, 4, 4), () => undefined); // "en|abled"
    expect(ctx?.kind).toBe("frontmatter-key");
    expect(ctx?.parentPath).toEqual(["execute"]);
  });

  it("bails (null) under a NON-allow-listed container (`website:`)", () => {
    const text = ["---", "website:", "  title: x", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 4), () => undefined)).toBeNull();
  });

  it("bails (null) when the container has a scalar value (`execute: false`)", () => {
    const text = ["---", "execute: false", "  enabled: x", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 4), () => undefined)).toBeNull();
  });

  it("bails (null) on a block-scalar container (`execute: |`)", () => {
    const text = ["---", "execute: |", "  enabled: x", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 4), () => undefined)).toBeNull();
  });

  it("bails (null) on deeper nesting (parent is itself indented)", () => {
    const text = ["---", "execute:", "  julia:", "    exeflags: x", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 3, 6), () => undefined)).toBeNull(); // in "exeflags"
  });

  it("bails (null) on a nested block-sequence item under execute", () => {
    const text = ["---", "execute:", "  - foo", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 4), () => undefined)).toBeNull();
  });
});

describe("completionContextAt — nested front-matter key under `format:` (6d-6 cont.)", () => {
  it("returns a nested frontmatter-key context under the `format:` container", () => {
    const text = ["---", "format:", "  html", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 2, 4), () => undefined); // inside "ht|ml"
    expect(ctx).toEqual({
      kind: "frontmatter-key",
      parentPath: ["format"],
      token: "ht",
      replaceRange: { line: 2, startCol: 2, endCol: 6 }, // covers all of "html"
    });
  });

  it("offers all format names (empty token) on a blank indented line under format", () => {
    const text = ["---", "format:", "  ", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 2, 2), () => undefined);
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
    const ctx = completionContextAt(text, offsetAt(text, 2, 10), () => undefined); // in "de|fault"
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
    const ctx = completionContextAt(text, offsetAt(text, 3, 6), () => undefined); // in "to|c"
    expect(ctx).toEqual({
      kind: "frontmatter-key",
      parentPath: ["format", "html"],
      token: "to",
      replaceRange: { line: 3, startCol: 4, endCol: 7 }, // covers all of "toc"
    });
  });

  it("offers all per-format keys (empty token) on a blank line under `format: <fmt>`", () => {
    const text = ["---", "format:", "  html:", "    ", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 3, 4), () => undefined);
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
    const ctx = completionContextAt(text, offsetAt(text, 4, 7), () => undefined); // in "x"
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
    const ctx = completionContextAt(text, offsetAt(text, 5, 9), () => undefined); // in "x"
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
    expect(completionContextAt(text, offsetAt(text, 3, 6), () => undefined)).toBeNull();
  });

  it("returns a per-format VALUE context two levels under `format:` (6d-6+ b2-ii)", () => {
    const text = ["---", "format:", "  html:", "    code-overflow: scroll", "---"].join("\n");
    // Past the colon on a per-format option line, the value slot completes that
    // option's enum. `parentPath` grows to [container, fmt, key] so the provider
    // resolves the values from `frontMatterKeys(["format","html"]).find(key)`.
    const ctx = completionContextAt(text, offsetAt(text, 3, 21), () => undefined); // in "sc|roll"
    expect(ctx).toEqual({
      kind: "frontmatter-value",
      parentPath: ["format", "html", "code-overflow"],
      token: "sc",
      replaceRange: { line: 3, startCol: 19, endCol: 25 }, // covers all of "scroll"
    });
  });

  it("offers per-format values (empty token) on an empty value slot under `format: <fmt>`", () => {
    const text = ["---", "format:", "  html:", "    code-overflow: ", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 3, 19), () => undefined); // at the empty value slot
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
    const ctx = completionContextAt(text, offsetAt(text, 4, 16), () => undefined); // in "fa|lse"
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
    const ctx = completionContextAt(text, offsetAt(text, 1, 5), () => undefined); // after "toc: "
    expect(ctx).toEqual({
      kind: "frontmatter-value",
      parentPath: ["toc"], // the key being valued
      token: "",
      replaceRange: { line: 1, startCol: 5, endCol: 5 },
    });
  });

  it("fires right after the colon with no space yet (`:` trigger, `toc:`)", () => {
    const text = ["---", "toc:", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 4), () => undefined); // right after ":"
    expect(ctx?.kind).toBe("frontmatter-value");
    expect(ctx?.parentPath).toEqual(["toc"]);
    expect(ctx?.token).toBe("");
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 4, endCol: 4 });
  });

  it("replaces the WHOLE value token on a mid-value cursor (`toc: false`)", () => {
    const text = ["---", "toc: false", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 7), () => undefined); // inside "fa|lse"
    expect(ctx?.kind).toBe("frontmatter-value");
    expect(ctx?.token).toBe("fa");
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 5, endCol: 10 });
  });

  it("stays a KEY context (not value) when the cursor is at the colon", () => {
    const text = ["---", "toc: false", "---"].join("\n");
    // col 3 = end of "toc", at the colon: still the key slot, not a value.
    expect(completionContextAt(text, offsetAt(text, 1, 3), () => undefined)?.kind).toBe("frontmatter-key");
  });

  it("returns null in the whitespace gap between the colon and the value", () => {
    const text = ["---", "toc:   false", "---"].join("\n");
    // col 5 sits in the run of spaces before "false" (value starts at col 7).
    expect(completionContextAt(text, offsetAt(text, 1, 5), () => undefined)).toBeNull();
  });

  it("returns null when the cursor is inside a trailing inline comment", () => {
    const text = ["---", "toc: false  # comment", "---"].join("\n");
    // col 13 is inside the comment; the value span ends at "false" (col 10).
    expect(completionContextAt(text, offsetAt(text, 1, 13), () => undefined)).toBeNull();
  });

  it("returns a nested frontmatter-value context on an INDENTED execute line (6d-6 cont.)", () => {
    const text = ["---", "execute:", "  enabled: false", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 2, 13), () => undefined); // in "fa|lse"
    expect(ctx).toEqual({
      kind: "frontmatter-value",
      parentPath: ["execute", "enabled"], // [container, key being valued]
      token: "fa",
      replaceRange: { line: 2, startCol: 11, endCol: 16 },
    });
  });

  it("fires right after the colon with no space on a nested line (`  cache:`)", () => {
    const text = ["---", "execute:", "  cache:", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 2, 8), () => undefined); // right after ":"
    expect(ctx).toEqual({
      kind: "frontmatter-value",
      parentPath: ["execute", "cache"],
      token: "",
      replaceRange: { line: 2, startCol: 8, endCol: 8 },
    });
  });

  it("replaces the WHOLE nested value token on a mid-value cursor (`  freeze: auto`)", () => {
    const text = ["---", "execute:", "  freeze: auto", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 2, 12), () => undefined); // inside "au|to"
    expect(ctx?.kind).toBe("frontmatter-value");
    expect(ctx?.parentPath).toEqual(["execute", "freeze"]);
    expect(ctx?.token).toBe("au");
    expect(ctx?.replaceRange).toEqual({ line: 2, startCol: 10, endCol: 14 });
  });

  it("returns null in the whitespace gap before a nested value", () => {
    const text = ["---", "execute:", "  cache:   true", "---"].join("\n");
    // col 9 sits in the run of spaces before "true" (value starts at col 11).
    expect(completionContextAt(text, offsetAt(text, 2, 9), () => undefined)).toBeNull();
  });

  it("returns null inside a trailing inline comment on a nested value line", () => {
    const text = ["---", "execute:", "  freeze: auto  # c", "---"].join("\n");
    // col 17 is inside the comment; the value span ends at "auto" (col 14).
    expect(completionContextAt(text, offsetAt(text, 2, 17), () => undefined)).toBeNull();
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
    expect(completionContextAt(text, offsetAt(text, 1, 8), () => undefined)?.kind).toBe("frontmatter-value");
  });

  it("still offers KEY completion on that same line (the key slot is untouched)", () => {
    const text = ["---", "toc:: true", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 2), () => undefined); // inside "to|c"
    expect(ctx?.kind).toBe("frontmatter-key");
    expect(ctx?.replaceRange).toEqual({ line: 1, startCol: 0, endCol: 3 });
  });

  it("still offers value completion right after a bare colon (`toc:` — the `:` trigger)", () => {
    const text = ["---", "toc:", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 4), () => undefined);
    expect(ctx?.kind).toBe("frontmatter-value");
    expect(ctx?.parentPath).toEqual(["toc"]);
  });

  it("STILL offers NESTED value completion past a non-separator colon (same reason)", () => {
    const text = ["---", "execute:", "  echo:fenced", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 10), () => undefined)?.kind).toBe("frontmatter-value");
  });

  it("still offers NESTED value completion on a normal `  key: value` line", () => {
    const text = ["---", "execute:", "  echo: fen", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 2, 11), () => undefined);
    expect(ctx?.kind).toBe("frontmatter-value");
    expect(ctx?.parentPath).toEqual(["execute", "echo"]);
  });

  it("still offers NESTED value completion right after a bare colon (`  echo:`)", () => {
    const text = ["---", "execute:", "  echo:", "---"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 7), () => undefined)?.kind).toBe("frontmatter-value");
  });

  it("still offers value completion on a normal `key: value` line", () => {
    const text = ["---", "toc: tr", "---"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 7), () => undefined);
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
    expect(completionContextAt(text, offsetAt(text, 2, 5), () => undefined)).toBeNull();
  });

  it("STILL offers cell-option completion in the leading block", () => {
    // The control that stops the pin above being satisfied by a wholesale loss of
    // cell-option completion — the same token in the leading block must still complete.
    const text = ["```{python}", "#| ec", "1+1", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 5), () => undefined)?.kind).toBe("cell-option-key");
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
  // `{sql}` + `--| echo: banana` renders exit 1. Measured against the shipped tree, FIVE of
  // those seven lines are flagged today — the cardinal sin. The two that are not are the prior
  // narrowings already working: `cache` is knitr-scoped so S161 L2's `"unknown"` scope excludes
  // it, and `%%|` is never emitted because `LANG_COMMENT_CHARS` has no `mermaid` row. An
  // earlier revision of this comment claimed all seven (S162 §9 review).
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
    // an over-OFFER is benign, an over-FLAG is the cardinal sin. Completion routes through
    // `completionEngineFor` (S169), which adopts this function's answer only where it names
    // a real engine and NEVER adopts `"none"`, so a `{dot}` cell keeps completing the
    // cell-option list even though nothing there will ever be validated. A narrowing that
    // reached completion too would be a silent capability loss with no defect to justify it.
    // (`//` is genuinely dot's comment char in quarto's own table, so quarto reads this line
    // as a directive — it just validates it against a handler schema that does not exist.)
    //
    // `.engine` is the load-bearing assertion, not `.kind`. The provider filters with
    // `index.cellOptions(ctx.engine)` (`providers/yaml.ts`), so the natural wrong fix — routing
    // completion through `cellOptionScopeFor` too — would hand it `"none"`, yield the EMPTY
    // list, and leave `.kind` untouched: a total loss of cell-option completion in handler
    // cells that a `.kind`-only pin sails straight past. Measured: that two-line mutant passed
    // all 88 tests in this file before this assertion existed (S162 §9 review). `undefined` is
    // the right value — `engineFor("dot")` is undefined, which `cellOptions` reads as "do not
    // filter", the deliberate over-offer.
    const text = ["```{dot}", "//| ec", "digraph {a->b}", "```"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 6), () => undefined);
    expect(ctx?.kind).toBe("cell-option-key");
    expect(ctx?.engine).toBeUndefined();
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

describe("cellOptionScopeFor — a resolved DOCUMENT engine replaces the language guess (S164)", () => {
  // Quarto scopes a cell's schema to the DOCUMENT's engine, never to the cell's language:
  // validateDocument passes context.engine.name down to partitionCellOptionsMapped, which
  // picks engineOptionsSchema[engine]. When the front matter tells us that name, the
  // language approximation is not just unnecessary — it is wrong.
  it("scopes EVERY language to the resolved engine, whatever the cell is written in", () => {
    // Measured: `engine: knitr` + a {python} cell + `#| cache: banana` renders exit 1
    // (control without the key: exit 0), and `#| collapse: banana` likewise. A knitr
    // document validates its {ojs} and {sql} cells against knitr too — measured, an {ojs}
    // cell's `//| cache: banana` renders exit 1 in a document holding an {r} cell.
    for (const lang of ["r", "python", "julia", "ojs", "js", "sql", "matlab", "banana"]) {
      expect(cellOptionScopeFor(lang, "knitr"), lang).toBe("knitr");
      expect(cellOptionScopeFor(lang, "jupyter"), lang).toBe("jupyter");
    }
  });

  it("narrows an {r} cell to the agnostic set under a markdown/julia engine", () => {
    // THE filed defect: `engine: markdown` + an {r} cell + `#| cache: banana` renders
    // exit 0 while the identical document without the key renders exit 1. Quarto's
    // markdown and julia engine schemas are `cell-*` filtered by `tags.engine === the
    // engine name`, and no shipped cell field carries a markdown or julia tag, so those
    // two schemas ARE the engine-agnostic set — `"unknown"` is the exact answer here, not
    // an approximation. The agnostic keys are still validated (measured: the same
    // document with `#| echo: banana` renders exit 1), which is what `"unknown"` keeps.
    expect(cellOptionScopeFor("r", "markdown")).toBe("unknown");
    expect(cellOptionScopeFor("r", "julia")).toBe("unknown");
    expect(cellOptionScopeFor("python", "markdown")).toBe("unknown");
  });

  it("narrows to the agnostic set when the front matter is ambiguous", () => {
    expect(cellOptionScopeFor("r", "ambiguous")).toBe("unknown");
    expect(cellOptionScopeFor("python", "ambiguous")).toBe("unknown");
  });

  it("leaves the language approximation in place when no engine was resolved", () => {
    expect(cellOptionScopeFor("r", undefined)).toBe("knitr");
    expect(cellOptionScopeFor("python", undefined)).toBe("jupyter");
    expect(cellOptionScopeFor("sql", undefined)).toBe("unknown");
    expect(cellOptionScopeFor("ojs", undefined)).toBe("ojs");
  });

  it("keeps the handler-language exemption above the engine — the schema SWAP is by LANGUAGE", () => {
    // `parseAndValidateCellOptions` picks engineOptionsSchema[engine] and then OVERRIDES it
    // for a handler language, so a {dot}/{mermaid} cell is exempt under every engine. In a
    // knitr document such a cell does render exit 1, but structurally — measured, the same
    // `//| echo: false` that is VALID renders exit 1 too — so no value diagnostic can
    // express it and letting the engine widen this back would be a cardinal-sin FP.
    for (const engine of ["knitr", "jupyter", "markdown", "julia", "ambiguous"] as const) {
      expect(cellOptionScopeFor("dot", engine), engine).toBe("none");
      expect(cellOptionScopeFor("mermaid", engine), engine).toBe("none");
    }
  });
});

describe("completionContextAt — cell-option completion follows the LANGUAGE's comment char (S161)", () => {
  it("offers cell-option completion on a `--|` line in a {sql} cell", () => {
    // Quarto reads this as a directive (`{sql}` + `--| echo: banana` renders exit 1 with a
    // real value error), so the key list belongs here. Pre-fix the surface was silent.
    const text = ["```{sql}", "--| ec", "SELECT 1", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 6), () => undefined)?.kind).toBe("cell-option-key");
  });

  it("offers NO cell-option completion on a `#|` line in a {sql} cell", () => {
    // Quarto reads no directive there at all (exit 0), so offering the key list would
    // advertise options that can never take effect — the completion-surface twin of the
    // diagnostics false positive.
    const text = ["```{sql}", "#| ec", "SELECT 1", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 5), () => undefined)).toBeNull();
  });

  it("offers NO cell-option completion on a `//|` line in a {python} cell", () => {
    const text = ["```{python}", "//| ec", "x = 1", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 6), () => undefined)).toBeNull();
  });
});

describe("completionContextAt — cell-option completion learns the DOCUMENT engine (S169)", () => {
  /** The document engine as the provider resolves it, from this document's own text. */
  const engineOf = (text: string) => () => resolveDocumentEngine("doc.qmd", text);

  it("offers a knitr-only key in a {python} cell of a KNITR document", () => {
    // THE filed defect, and the only direction that is more than cosmetic. Completion
    // scoped by the cell LANGUAGE while the validator scoped by the DOCUMENT engine, so
    // this cell got squiggled for a key completion would not offer.
    //
    // Grounded firsthand vs quarto 1.7.33, three documents differing in one line:
    //   {r} cell + {python} cell + `#| cache: banana`  → exit 1, `Field "cache" has value banana`
    //   the same document without the key              → exit 0  (so the exit 1 IS the value)
    //   the {python} cell ALONE + `#| cache: banana`   → exit 0  (so it is the OTHER cell)
    const text = [
      "```{r}",
      "1 + 1",
      "```",
      "",
      "```{python}",
      "#| ca",
      "1 + 1",
      "```",
    ].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 5, 5), engineOf(text));
    expect(ctx?.kind).toBe("cell-option-key");
    expect(ctx?.engine).toBe("knitr");
  });

  it("does the same in the VALUE slot, not only the key slot", () => {
    // Both emit sites read the same `engine`, and a fix applied to one of them would leave
    // the other silently on the language approximation.
    const text = ["```{r}", "1 + 1", "```", "", "```{python}", "#| cache: ", "```"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 5, 10), engineOf(text));
    expect(ctx?.kind).toBe("cell-option-value");
    expect(ctx?.engine).toBe("knitr");
  });

  it("offers the knitr-only key in an {ojs} cell of a KNITR document too", () => {
    // The §9 review's HIGHEST finding: the adoption rule was pinned ONLY for {python}, so a
    // mutant that refused to adopt for `ojs`/`js` — re-opening the exact flag-but-refuse-to-
    // offer defect for those cells — passed all 1545 tests. {ojs} is a genuine instance:
    // `engineFor("ojs")` is `ojs`, whose option set excludes `cache`, while the validator
    // scopes an {ojs} cell of a knitr document to knitr and flags it. Measured on the
    // curated index, jupyter->knitr and ojs->knitr both GAIN exactly
    // ["fig-width","fig-height","cache"] and lose nothing.
    const text = ["```{r}", "1 + 1", "```", "", "```{ojs}", "//| ca", "1 + 1", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 5, 6), engineOf(text))?.engine).toBe("knitr");
  });

  it("adopts JUPYTER too, not only knitr — an {r} cell in a jupyter document", () => {
    // The other half of the adoption rule, also unpinned until the §9 review: a mutant that
    // adopted only `knitr` passed everything. This is the NARROWING direction — the {r} cell
    // loses exactly ["fig-width","fig-height","cache"] — and it is correct: quarto scopes
    // every cell of a jupyter document to jupyter's schema.
    const text = [
      "---",
      "jupyter:",
      "  kernelspec:",
      "    name: python3",
      "---",
      "",
      "```{r}",
      "#| ca",
      "1 + 1",
      "```",
    ].join("\n");
    expect(completionContextAt(text, offsetAt(text, 7, 5), engineOf(text))?.engine).toBe("jupyter");
  });

  it("never adopts `\"none\"` even when the document engine IS resolved", () => {
    // The handler-cell guard was pinned only by dot-ONLY documents, whose engine resolves to
    // markdown — so `cellOptionScopeFor` reached its `"none"` branch but the ENGINE branch
    // was never exercised. A mutant that bypassed `cellOptionScopeFor` entirely (return the
    // document engine when it is knitr/jupyter, else `engineFor`) passed all 1545 tests
    // while silently scoping handler cells to knitr. The `{r}` cell makes this document
    // knitr, so the guard is the only thing keeping the answer `undefined`.
    const text = [
      "```{r}",
      "1 + 1",
      "```",
      "",
      "```{dot}",
      "//| ec",
      "digraph {a->b}",
      "```",
    ].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 5, 6), engineOf(text));
    expect(ctx?.kind).toBe("cell-option-key");
    expect(ctx?.engine).toBeUndefined();
  });

  it("does NOT resolve the engine at a position that is not a cell-option line", () => {
    // The thunk's LAZINESS is the entire reason the third parameter is a function rather
    // than a value, and it had no test: an eager mutant that hoisted the call above the
    // cell-option branch was behaviour-identical and passed all 1545 tests. Measured on an
    // 1810-line document, resolving costs ~0.14 ms — and `:` is one of this provider's
    // completion trigger characters, typed constantly in ordinary prose.
    let calls = 0;
    const counting = () => {
      calls++;
      return undefined;
    };
    const text = ["# Heading", "", "Some prose: with a colon in it."].join("\n");
    expect(completionContextAt(text, offsetAt(text, 2, 12), counting)).toBeNull();
    expect(calls, "the engine must not be resolved for a prose position").toBe(0);
  });

  // The rows below run the REAL resolver, not the `() => undefined` fallback the rest of
  // this file uses. Each is a shape whose answer must NOT move.
  it("keeps jupyter for a {python} cell when no other language is present", () => {
    const text = ["```{python}", "#| ca", "1 + 1", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 5), engineOf(text))?.engine).toBe(
      "jupyter",
    );
  });

  it("keeps knitr for an {r} cell", () => {
    const text = ["```{r}", "#| ca", "1 + 1", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 5), engineOf(text))?.engine).toBe("knitr");
  });

  it("keeps ojs for an {ojs} cell, whose document resolves to MARKDOWN", () => {
    // The row that proves the "do not adopt a narrowing scope" half of the rule is live.
    // `engineFromLanguages` skips ojs, so this document's engine is markdown, and
    // `cellOptionScopeFor("ojs", "markdown")` is `"unknown"` — adopting it would drop this
    // cell from ojs's option set to the engine-agnostic intersection for no defect.
    const text = ["```{ojs}", "//| ec", "1 + 1", "```"].join("\n");
    expect(completionContextAt(text, offsetAt(text, 1, 6), engineOf(text))?.engine).toBe("ojs");
  });

  it("still OFFERS in a {dot} handler cell — `\"none\"` is the other scope never adopted", () => {
    // The S162 pin, re-run through the real resolver. Routing completion through the raw
    // scope would hand `cellOptions` the EMPTY set and delete cell-option completion in
    // handler cells outright, leaving `.kind` untouched so a kind-only pin sails past it.
    const text = ["```{dot}", "//| ec", "digraph {a->b}", "```"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 6), engineOf(text));
    expect(ctx?.kind).toBe("cell-option-key");
    expect(ctx?.engine).toBeUndefined();
  });

  it("keeps the over-offer under an explicit `engine: markdown`", () => {
    // The benign half of the filed divergence, deliberately NOT closed: quarto accepts a
    // knitr-only key here (it is inert — `engine: markdown` + `{r}` + `#| cache: banana`
    // renders exit 0), so withholding it would cost a completion to prevent nothing.
    // The validator scopes this cell to `"unknown"`; completion stays wider on purpose.
    const text = [
      "---",
      "engine: markdown",
      "---",
      "",
      "```{r}",
      "#| ca",
      "1 + 1",
      "```",
    ].join("\n");
    expect(completionContextAt(text, offsetAt(text, 5, 5), engineOf(text))?.engine).toBe("knitr");
  });
});

/**
 * Session 170 — completion on an `.Rmd`, the document class S169's fix could not reach.
 *
 * S169 taught completion the document engine, but `resolveDocumentEngine` answered
 * `undefined` on an `.Rmd` (the extension veto), so `completionEngineFor` fell straight back
 * to the cell language there and the fix was INERT on the one document class whose engine is
 * CERTAIN. S170 makes that branch answer `"knitr"`, and completion inherits it through the
 * same entry point — no change to `completionEngineFor` itself, which is the point of the
 * shared resolver.
 *
 * These pins carry no new production code. They exist because the behaviour is now reachable
 * only through the FILE NAME, an input no other headless gate in this project varies, and a
 * pin that is not mutation-proven is a pin that has not been shown to discriminate anything:
 * reverting S170's one line turns every `.Rmd` row below back to the language answer.
 */
describe("completionContextAt — an .Rmd offers knitr's keys in EVERY cell (S170)", () => {
  const rmd = (text: string) => () => resolveDocumentEngine("doc.Rmd", text);
  const qmd = (text: string) => () => resolveDocumentEngine("doc.qmd", text);

  it("offers knitr's keys in a {python} cell of an .Rmd", () => {
    // The `.qmd` control is what makes this about the extension: the same text, the same
    // cursor, the only difference the file name. Measured — `#| cache: banana` in this cell
    // renders exit 1 as doc.Rmd and exit 0 as doc.qmd.
    const text = ["```{python}", "#| ca", "1 + 1", "```"].join("\n");
    const at = offsetAt(text, 1, 5);
    expect(completionContextAt(text, at, rmd(text))?.engine).toBe("knitr");
    expect(completionContextAt(text, at, qmd(text))?.engine).toBe("jupyter");
  });

  it("offers them in an {ojs} cell too — the language whose .qmd answer is ojs", () => {
    // `engineFromLanguages` skips ojs, so an ojs-only `.qmd` resolves markdown and completion
    // keeps ojs's own set. The `.Rmd` answer comes from the extension instead, and quarto
    // agrees: doc.Rmd + {ojs} + `//| cache: banana` renders exit 1.
    const text = ["```{ojs}", "//| ca", "1 + 1", "```"].join("\n");
    const at = offsetAt(text, 1, 6);
    expect(completionContextAt(text, at, rmd(text))?.engine).toBe("knitr");
    expect(completionContextAt(text, at, qmd(text))?.engine).toBe("ojs");
  });

  it("is not moved by a front-matter override — the S164 veto reaches completion too", () => {
    // `engine: markdown` would make the `.qmd` scope `"unknown"`, where completion keeps its
    // over-offer (`engineFor("python")` = jupyter). On the `.Rmd` the override never runs.
    const text = [
      "---",
      "engine: markdown",
      "---",
      "",
      "```{python}",
      "#| ca",
      "1 + 1",
      "```",
    ].join("\n");
    const at = offsetAt(text, 5, 5);
    expect(completionContextAt(text, at, rmd(text))?.engine).toBe("knitr");
    expect(completionContextAt(text, at, qmd(text))?.engine).toBe("jupyter");
  });

  it("still OFFERS in a {dot} handler cell of an .Rmd, with no engine filter", () => {
    // The guard that keeps the widening from reaching handler cells runs in
    // `cellOptionScopeFor` above the engine branch, so `"none"` is what completion sees and
    // it keeps `engineFor("dot")` — `undefined`, i.e. do not filter. Routing the raw scope
    // through instead would hand `cellOptions` the EMPTY set and delete handler-cell
    // completion outright, which `.kind` alone would not notice.
    const text = ["```{dot}", "//| ec", "digraph {a->b}", "```"].join("\n");
    const ctx = completionContextAt(text, offsetAt(text, 1, 6), rmd(text));
    expect(ctx?.kind).toBe("cell-option-key");
    expect(ctx?.engine).toBeUndefined();
  });
});
