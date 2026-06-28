import { describe, expect, it } from "vitest";
import { parseCitations } from "../../src/core/citations";

describe("parseCitations — BibTeX single entry", () => {
  it("parses key, title, author, and year from a brace-delimited entry", () => {
    const bib = [
      "@article{smith2020,",
      "  title = {A Study of Things},",
      "  author = {Smith, John},",
      "  year = {2020}",
      "}",
    ].join("\n");
    expect(parseCitations(bib)).toEqual([
      {
        key: "smith2020",
        title: "A Study of Things",
        author: "Smith, John",
        year: "2020",
      },
    ]);
  });
});

describe("parseCitations — BibTeX quoted-form values", () => {
  it("parses double-quoted values and protects commas inside them", () => {
    const bib =
      '@book{key2, title = "A Book", author = "Doe, Jane", year = "1999"}';
    expect(parseCitations(bib)).toEqual([
      { key: "key2", title: "A Book", author: "Doe, Jane", year: "1999" },
    ]);
  });

  it("parses a bare (unbraced, unquoted) value such as a numeric year", () => {
    const bib = "@misc{k3, title = {T}, year = 2021}";
    expect(parseCitations(bib)).toEqual([
      { key: "k3", title: "T", year: "2021" },
    ]);
  });
});

describe("parseCitations — BibTeX non-entry blocks", () => {
  it("skips @string, @comment, and @preamble blocks", () => {
    const bib = [
      "@string{pub = {Springer}}",
      "@comment{this is ignored}",
      '@preamble{"\\newcommand{\\x}{y}"}',
      "@article{real2020, title = {Real}, year = {2020}}",
    ].join("\n");
    expect(parseCitations(bib)).toEqual([
      { key: "real2020", title: "Real", year: "2020" },
    ]);
  });

  it("parses multiple real entries in file order", () => {
    const bib = [
      "@article{a1, title = {First}}",
      "@book{b2, title = {Second}}",
    ].join("\n");
    expect(parseCitations(bib).map((c) => c.key)).toEqual(["a1", "b2"]);
  });
});

describe("parseCitations — CSL-JSON", () => {
  it("parses id, title, authors, and issued year from a CSL-JSON array", () => {
    const json = JSON.stringify([
      {
        id: "smith2020",
        type: "article-journal",
        title: "A CSL Title",
        author: [
          { family: "Smith", given: "John" },
          { family: "Doe", given: "Jane" },
        ],
        issued: { "date-parts": [[2020, 5, 1]] },
      },
    ]);
    expect(parseCitations(json)).toEqual([
      {
        key: "smith2020",
        title: "A CSL Title",
        author: "Smith, John; Doe, Jane",
        year: "2020",
      },
    ]);
  });

  it("handles a literal author and a missing year/title", () => {
    const json = JSON.stringify([
      { id: "wb2019", author: [{ literal: "World Bank" }] },
    ]);
    expect(parseCitations(json)).toEqual([
      { key: "wb2019", author: "World Bank" },
    ]);
  });
});

describe("parseCitations — robustness", () => {
  it("flattens nested braces in a value", () => {
    const bib = "@article{k, title = {Study of {DNA} sequences}}";
    expect(parseCitations(bib)).toEqual([
      { key: "k", title: "Study of DNA sequences" },
    ]);
  });

  it("parses an entry that has only a key (no fields)", () => {
    expect(parseCitations("@misc{lonely}")).toEqual([{ key: "lonely" }]);
  });

  it("returns [] for empty input", () => {
    expect(parseCitations("")).toEqual([]);
    expect(parseCitations("   \n  ")).toEqual([]);
  });

  it("does not throw on a truncated final entry", () => {
    const bib = "@article{ok, title = {Fine}}\n@book{broken, title = {Oops";
    expect(parseCitations(bib)).toEqual([{ key: "ok", title: "Fine" }]);
  });

  it("returns [] for malformed JSON that looks like CSL-JSON", () => {
    expect(parseCitations("[ {not valid json } ]")).toEqual([]);
  });
});
