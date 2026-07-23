import { describe, it, expect } from "vitest";
import {
  isKnownFormatName,
  formatNameMessage,
  escapeRegExp,
} from "../../src/core/format-name-check";

/**
 * A representative fixed built-in set standing in for the raw (unfiltered)
 * `pandoc/formats.yml` + synthesized set the reader supplies at runtime
 * (`SchemaIndex.formatNamesForValidation()`). It deliberately INCLUDES the hidden
 * legacy variants (`html4/html5`, `epub2/epub3`, `docbook4/docbook5`) that the
 * COMPLETION accessor strips but quarto's schema layer ACCEPTS (plan §2.2 dragon),
 * and `plain`/`ms` (real short built-ins) to exercise the boundary logic against
 * MUST-FLAG names that merely CONTAIN a built-in as an unbounded substring.
 */
const BUILT_IN: ReadonlySet<string> = new Set([
  "html", "html4", "html5",
  "epub", "epub2", "epub3",
  "docbook", "docbook4", "docbook5",
  "pdf", "revealjs", "typst",
  "markdown", "gfm", "commonmark",
  "plain", "ms", "org",
  "md", "hugo", "dashboard", "email", // synthesized
]);

describe("isKnownFormatName — mirrors makeFrontMatterFormatSchema's anyOf (plan §3.1 A)", () => {
  describe("MUST-FLAG: schema-REJECTed names → false (plan §2.3)", () => {
    it.each([
      "banana",
      "foo",
      "reveal",
      "word",
      "htlm",
      "htmls",
      "powerpoint",
      "reveal.js",
      "solo",
    ])("an unknown bare name %s is not known", (name) => {
      expect(isKnownFormatName(name, BUILT_IN)).toBe(false);
    });

    it("foo-bar (neither segment a built-in) is not known — the render-dispatch parseFormatString would ACCEPT this; we mirror the schema, which rejects it", () => {
      expect(isKnownFormatName("foo-bar", BUILT_IN)).toBe(false);
    });

    it("plainfmt-banana is not known — `plain` appears only as an UNBOUNDED substring of `plainfmt`, not a `-`/`+`/boundary-delimited base", () => {
      expect(isKnownFormatName("plainfmt-banana", BUILT_IN)).toBe(false);
    });

    it.each(["html-", "html+", "pdf-", "revealjs+"])(
      "a bare trailing delimiter %s is not known ([-+].+ needs >= 1 char after the delimiter)",
      (name) => {
        expect(isKnownFormatName(name, BUILT_IN)).toBe(false);
      },
    );
  });

  describe("MUST-KNOW built-ins → true", () => {
    it.each(["html", "pdf", "revealjs", "typst", "gfm", "markdown", "md", "dashboard", "hugo", "email"])(
      "the built-in %s is known",
      (name) => {
        expect(isKnownFormatName(name, BUILT_IN)).toBe(true);
      },
    );
  });

  describe("MUST-KNOW hidden legacy variants → true (dragon 2.2 — completion strips them, schema accepts)", () => {
    it.each(["html5", "html4", "epub3", "epub2", "docbook5", "docbook4"])(
      "the hidden variant %s is known",
      (name) => {
        expect(isKnownFormatName(name, BUILT_IN)).toBe(true);
      },
    );
  });

  describe("MUST-KNOW base + modifier → true (the [-+]<mod> suffix)", () => {
    it.each(["markdown+emoji", "html-smart", "gfm-yaml_metadata_block", "html+something"])(
      "the modified form %s is known",
      (name) => {
        expect(isKnownFormatName(name, BUILT_IN)).toBe(true);
      },
    );
  });

  describe("MUST-KNOW extension formats → true (the <prefix>- prefix, dragon 1 — no _extensions/ scan)", () => {
    it.each(["foo-html", "acme-report-html"])("the extension form %s is known", (name) => {
      expect(isKnownFormatName(name, BUILT_IN)).toBe(true);
    });
  });

  describe("MUST-KNOW extension + modifier / mid-embedded built-in → true (§9-review class B)", () => {
    it.each(["foo-html-smart", "nature-pdf-draft", "acme-revealjs-clean"])(
      "the extension+modifier form %s is known",
      (name) => {
        expect(isKnownFormatName(name, BUILT_IN)).toBe(true);
      },
    );
  });

  // Quarto's front-matter schema uses regexSchema("^.+\.lua$"); in that STRING the `\.`
  // is not a defined escape, so it collapses to a bare `.` — a WILDCARD dot once compiled
  // (runtime `^.+.lua$`). Quarto therefore ACCEPTS any name of >=2 chars followed by "lua"
  // WITHOUT requiring a literal dot. Grounded firsthand (quarto render 1.7.33): `format:
  // foolua`/`fooXlua`/`aalua`/`abclua` pass the front-matter SCHEMA layer (failing only
  // later with a non-schema "Unknown format" error), while `lua`/`plua`/`Xlua`/`alua`
  // (<=1 char before "lua") are SCHEMA-REJECTED. The predicate must mirror the wildcard,
  // else it false-positives on every `<>=2-chars>lua` name (§9-review CARDINAL-FP, S145).
  describe("MUST-KNOW quarto's wildcard-dot lua acceptance (^.+.lua$) → true (§9-review CARDINAL-FP fix, S145)", () => {
    it.each([
      "my-writer.lua", // a real dotted .lua writer
      "foo.lua",
      "some/dir/writer.lua",
      "foolua", // NO literal dot — quarto schema-accepts via the wildcard; must NOT flag
      "fooXlua",
      "aalua", // exactly 2 chars before "lua" — the acceptance boundary (grounded)
      "abclua",
      "myreportlua",
      "htmlua",
    ])("the schema-accepted lua-form %s is known", (name) => {
      expect(isKnownFormatName(name, BUILT_IN)).toBe(true);
    });

    it.each([
      "lua", // 0 chars before "lua" — grounded SCHEMA-REJECT
      "plua", // 1 char before "lua"
      "Xlua",
      "alua",
      "writer.js", // not a lua form at all (and not a built-in)
    ])("a name quarto's schema REJECTS at the lua boundary (%s) is NOT known", (name) => {
      expect(isKnownFormatName(name, BUILT_IN)).toBe(false);
    });
  });

  it("never throws and reports UNKNOWN for an empty built-in set (defensive)", () => {
    expect(isKnownFormatName("html", new Set())).toBe(false);
    expect(isKnownFormatName("anything.lua", new Set())).toBe(true); // .lua branch is set-independent
  });
});

describe("formatNameMessage", () => {
  it("names the unknown format plainly (NOT quarto's unhelpful 'must instead be ansi')", () => {
    expect(formatNameMessage("banana")).toBe("Unknown output format banana.");
    expect(formatNameMessage("reveal")).not.toContain("ansi");
  });
});

describe("escapeRegExp", () => {
  it("is a no-op for today's all-[a-z0-9_] built-in names", () => {
    expect(escapeRegExp("markdown_strict")).toBe("markdown_strict");
    expect(escapeRegExp("html5")).toBe("html5");
  });

  it("escapes regex metacharacters (guards a future name carrying one)", () => {
    expect(escapeRegExp("a.b+c")).toBe("a\\.b\\+c");
    // A metachar-carrying built-in must be matched LITERALLY, not as a pattern.
    expect(isKnownFormatName("a.b", new Set(["a.b"]))).toBe(true);
    expect(isKnownFormatName("axb", new Set(["a.b"]))).toBe(false); // `.` must not match `x`
  });
});
