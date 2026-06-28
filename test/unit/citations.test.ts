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

describe("parseCitations — hardening (adversarial review)", () => {
  it("B: parses CSL-JSON saved with a leading UTF-8 BOM", () => {
    expect(parseCitations('﻿[{"id":"k","title":"T"}]')).toEqual([
      { key: "k", title: "T" },
    ]);
  });

  it("B: parses BibTeX saved with a leading UTF-8 BOM", () => {
    expect(parseCitations("﻿@article{k, title = {T}}")).toEqual([
      { key: "k", title: "T" },
    ]);
  });

  it("F: an unbalanced brace inside a quoted value does not drop later entries", () => {
    const bib = [
      '@article{a1, note = "open { brace"}',
      "@article{a2, title = {Survivor}}",
    ].join("\n");
    expect(parseCitations(bib).map((c) => c.key)).toEqual(["a1", "a2"]);
  });

  it("G: parses a parenthesis-delimited entry", () => {
    expect(parseCitations("@article(parenKey, title = {Paren Form})")).toEqual([
      { key: "parenKey", title: "Paren Form" },
    ]);
  });

  it("G: a ')' inside a brace value does not end a paren entry early", () => {
    expect(parseCitations("@misc(k, title = {Foo (bar) baz})")).toEqual([
      { key: "k", title: "Foo (bar) baz" },
    ]);
  });

  it("H: ignores a non-numeric date-parts leaf (no bogus year)", () => {
    expect(
      parseCitations('[{"id":"d","issued":{"date-parts":[[null]]}}]'),
    ).toEqual([{ key: "d" }]);
  });
});
