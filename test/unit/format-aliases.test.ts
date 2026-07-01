import { describe, expect, it } from "vitest";
import {
  expandFormatAliases,
  formatMatches,
  type FormatAliases,
} from "../../src/core/format-aliases";

/**
 * A small, self-contained alias table exercising the ALGORITHM (concrete
 * passthrough, one-hop expansion, nested `$`-aliases, and a cycle) — mirroring
 * the SHAPE of the real `schema/format-aliases.yml` (grounded against Quarto
 * 1.7.33: keys stored without `$`, members reference other aliases WITH `$`).
 * The real 14-entry table is exercised end-to-end in the reader/integration.
 */
const A: FormatAliases = new Map([
  ["pdf-all", ["latex", "pdf", "beamer"]],
  ["html-doc", ["html", "html4", "html5"]],
  ["html-all", ["$html-doc", "dashboard"]], // nested one level
  ["cyclic-a", ["$cyclic-b"]],
  ["cyclic-b", ["$cyclic-a", "safe"]], // a cycle back to cyclic-a
]);

describe("expandFormatAliases", () => {
  it("passes concrete format names through unchanged", () => {
    expect(expandFormatAliases(["revealjs", "html"], A)).toEqual(
      new Set(["revealjs", "html"]),
    );
  });

  it("expands a `$`-alias one hop to its concrete members", () => {
    expect(expandFormatAliases(["$pdf-all"], A)).toEqual(
      new Set(["latex", "pdf", "beamer"]),
    );
  });

  it("recursively expands a NESTED `$`-alias to concrete names", () => {
    // html-all -> [$html-doc, dashboard] -> [html, html4, html5, dashboard]
    expect(expandFormatAliases(["$html-all"], A)).toEqual(
      new Set(["html", "html4", "html5", "dashboard"]),
    );
  });

  it("treats an unknown `$`-alias as a bare concrete name (never throws)", () => {
    expect(expandFormatAliases(["$nope"], A)).toEqual(new Set(["nope"]));
  });

  it("terminates on a cyclic alias table (cycle guard)", () => {
    // Must not infinite-loop; the non-cyclic member is still collected.
    expect(expandFormatAliases(["$cyclic-a"], A)).toEqual(new Set(["safe"]));
  });

  it("unions a mix of concrete names and aliases", () => {
    expect(expandFormatAliases(["typst", "$pdf-all"], A)).toEqual(
      new Set(["typst", "latex", "pdf", "beamer"]),
    );
  });
});

describe("formatMatches (Quarto useSchema semantics)", () => {
  it("an UNTAGGED option is universal (valid for every format)", () => {
    expect(formatMatches(undefined, "gfm", A)).toBe(true);
    expect(formatMatches(undefined, "html", A)).toBe(true);
  });

  it("a positive alias tag matches only its expanded formats", () => {
    expect(formatMatches(["$html-doc"], "html", A)).toBe(true);
    expect(formatMatches(["$html-doc"], "gfm", A)).toBe(false);
  });

  it("a positive concrete tag matches only that format", () => {
    expect(formatMatches(["revealjs"], "revealjs", A)).toBe(true);
    expect(formatMatches(["revealjs"], "html", A)).toBe(false);
  });

  it("a `!`-negated tag EXCLUDES its expanded formats; everything else is valid", () => {
    expect(formatMatches(["!man"], "man", A)).toBe(false);
    expect(formatMatches(["!man"], "html", A)).toBe(true); // negation-only = all-except
  });

  it("negation of a `$`-alias excludes every expanded member", () => {
    expect(formatMatches(["!$pdf-all"], "beamer", A)).toBe(false);
    expect(formatMatches(["!$pdf-all"], "html", A)).toBe(true);
  });

  it("the MIXED case (`columns`: negations + a positive) exercises both arms", () => {
    // ['!$pdf-all', '!$html-all', 'typst'] — valid for typst, invalid for a
    // negated format, invalid for a format neither negated nor positively named.
    const tags = ["!$pdf-all", "!$html-all", "typst"];
    expect(formatMatches(tags, "typst", A)).toBe(true); // positively named
    expect(formatMatches(tags, "pdf", A)).toBe(false); // negated ($pdf-all)
    expect(formatMatches(tags, "html", A)).toBe(false); // negated ($html-all)
    expect(formatMatches(tags, "docx", A)).toBe(false); // has a positive, docx not in it
  });

  it("negation WINS over a positive match for the same format", () => {
    // A format both negated and positively named is excluded (disabled checked first).
    expect(formatMatches(["!html", "$html-doc"], "html", A)).toBe(false);
  });
});
