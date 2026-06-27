import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Structural guards for the Phase 2 grammar contribution. Pure (no `vscode`):
 * this catches malformed JSON, a scopeName/path mismatch, and — most
 * importantly — an embedded `contentName` in the grammar that has no language
 * mapping in `contributes.grammars.embeddedLanguages` (the string/comment trap,
 * which silently disables bracket matching / comment toggling inside cells).
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const readJson = (rel: string): any =>
  JSON.parse(readFileSync(resolve(root, rel), "utf8"));

const pkg = readJson("package.json");
const grammar = readJson("syntaxes/quarto.tmLanguage.json");
const langConfig = readJson("language-configuration.json");

describe("package.json language contribution", () => {
  const language = pkg.contributes?.languages?.find(
    (l: any) => l.id === "quarto",
  );

  it("registers the quarto language for .qmd / .rmd", () => {
    expect(language).toBeDefined();
    expect(language.extensions).toContain(".qmd");
    expect(language.extensions).toContain(".rmd");
  });

  it("points the language at the language-configuration file", () => {
    expect(language.configuration).toBe("./language-configuration.json");
  });
});

describe("package.json grammar contribution", () => {
  const contributed = pkg.contributes?.grammars?.find(
    (g: any) => g.language === "quarto",
  );

  it("wires the quarto grammar to the tmLanguage file", () => {
    expect(contributed).toBeDefined();
    expect(contributed.scopeName).toBe("text.html.quarto");
    expect(contributed.path).toBe("./syntaxes/quarto.tmLanguage.json");
  });

  it("maps the front-matter and each cell language", () => {
    const map = contributed.embeddedLanguages;
    expect(map["meta.embedded.block.frontmatter"]).toBe("yaml");
    expect(map["meta.embedded.block.python"]).toBe("python");
    expect(map["meta.embedded.block.r"]).toBe("r");
    expect(map["meta.embedded.block.julia"]).toBe("julia");
    expect(map["meta.embedded.block.ojs"]).toBe("javascript");
  });
});

describe("quarto.tmLanguage.json", () => {
  it("declares the scope the manifest references", () => {
    expect(grammar.scopeName).toBe("text.html.quarto");
  });

  it("delegates prose to the built-in markdown grammar by reference", () => {
    const includes = grammar.patterns.map((p: any) => p.include);
    expect(includes).toContain("text.html.markdown");
  });

  it("matches brace-wrapped cells before falling back to markdown", () => {
    const includes = grammar.patterns.map((p: any) => p.include);
    expect(includes.indexOf("#cell-python")).toBeLessThan(
      includes.indexOf("text.html.markdown"),
    );
    // Generic catch-all must come after the specific languages.
    expect(includes.indexOf("#cell-python")).toBeLessThan(
      includes.indexOf("#cell-generic"),
    );
  });

  it("embeds each cell language under a mapped meta.embedded scope", () => {
    const embeddedMap = pkg.contributes.grammars.find(
      (g: any) => g.language === "quarto",
    ).embeddedLanguages;
    const cells: Array<[string, string, string]> = [
      ["cell-python", "meta.embedded.block.python", "source.python"],
      ["cell-r", "meta.embedded.block.r", "source.r"],
      ["cell-julia", "meta.embedded.block.julia", "source.julia"],
      ["cell-ojs", "meta.embedded.block.ojs", "source.js"],
    ];
    for (const [key, scope, source] of cells) {
      const rule = grammar.repository[key];
      expect(rule, `repository.${key} should exist`).toBeDefined();
      expect(rule.contentName).toBe(scope);
      expect(rule.patterns?.[0]?.include).toBe(source);
      // Every embedded content scope must have a language mapping.
      expect(embeddedMap[scope], `${scope} must be mapped`).toBeDefined();
    }
  });

  it("scopes the YAML front matter and includes source.yaml", () => {
    const fm = grammar.repository.frontmatter;
    expect(fm.contentName).toBe("meta.embedded.block.frontmatter");
    expect(fm.patterns?.[0]?.include).toBe("source.yaml");
  });
});

describe("language-configuration.json", () => {
  it("provides a comment toggle and brackets", () => {
    expect(langConfig.comments.blockComment).toEqual(["<!--", "-->"]);
    expect(langConfig.brackets).toEqual(
      expect.arrayContaining([["{", "}"]]),
    );
  });
});
