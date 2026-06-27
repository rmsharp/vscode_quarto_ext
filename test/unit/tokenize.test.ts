import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as oniguruma from "vscode-oniguruma";
import * as vsctm from "vscode-textmate";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Headless tokenization of the Quarto grammar using the same engines VS Code
 * uses (vscode-textmate + vscode-oniguruma). This is the automated equivalent
 * of "Developer: Inspect Editor Tokens and Scopes" and proves the *regexes*
 * actually work — brace-cell detection, the back-referenced closing fence, and
 * embedded-scope application — which the structural JSON guard cannot catch.
 *
 * External includes (text.html.markdown, source.python, ...) are supplied as
 * empty stub grammars — NOT null. (Returning null for an unresolved include
 * corrupts vscode-textmate's pattern compilation; a valid empty grammar is the
 * faithful stand-in for "that grammar is loaded but we don't assert its inner
 * tokens".) We assert the scopes THIS grammar assigns (meta.embedded.block.*,
 * the fence punctuation, the language tag) — theme-independent, and exactly what
 * drives the embeddedLanguages mapping. The inner language coloring is supplied
 * by VS Code's bundled grammars at runtime, not under test here.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

interface FlatToken {
  line: number;
  text: string;
  scopes: string[];
}

let tokens: FlatToken[];

beforeAll(async () => {
  const wasm = readFileSync(
    resolve(root, "node_modules/vscode-oniguruma/release/onig.wasm"),
  );
  const onigLib = oniguruma.loadWASM(wasm).then(() => ({
    createOnigScanner: (patterns: string[]) =>
      new oniguruma.OnigScanner(patterns),
    createOnigString: (s: string) => new oniguruma.OnigString(s),
  }));

  const registry = new vsctm.Registry({
    onigLib,
    loadGrammar: async (scopeName) => {
      if (scopeName === "text.html.quarto") {
        const raw = readFileSync(
          resolve(root, "syntaxes/quarto.tmLanguage.json"),
          "utf8",
        );
        return vsctm.parseRawGrammar(raw, "quarto.tmLanguage.json");
      }
      // Empty stub for every external include (markdown, yaml, source.*).
      // Must be a valid grammar, not null — see the file header.
      return { scopeName, patterns: [] };
    },
  });

  const grammar = await registry.loadGrammar("text.html.quarto");
  expect(grammar, "grammar should load").toBeTruthy();

  const fixture = readFileSync(
    resolve(root, "test/fixtures/sample.qmd"),
    "utf8",
  );
  const lines = fixture.split(/\r?\n/);

  tokens = [];
  let ruleStack = vsctm.INITIAL;
  lines.forEach((line, i) => {
    const result = grammar!.tokenizeLine(line, ruleStack);
    for (const t of result.tokens) {
      tokens.push({
        line: i,
        text: line.substring(t.startIndex, t.endIndex),
        scopes: t.scopes,
      });
    }
    ruleStack = result.ruleStack;
  });
});

/** Does any token (optionally on a line whose text contains `onText`) carry `scope`? */
function hasScope(scope: string, onText?: string): boolean {
  const lines =
    onText === undefined
      ? null
      : new Set(
          tokens.filter((t) => t.text.includes(onText)).map((t) => t.line),
        );
  return tokens.some(
    (t) => t.scopes.includes(scope) && (lines === null || lines.has(t.line)),
  );
}

/** All scopes of the first token whose text equals `text`. */
function scopesOfTextLine(needle: string): string[] {
  const tok = tokens.find((t) => t.text.includes(needle));
  return tok ? tok.scopes : [];
}

describe("YAML front matter", () => {
  it("scopes the --- delimiters", () => {
    expect(hasScope("punctuation.definition.frontmatter.begin.quarto")).toBe(
      true,
    );
    expect(hasScope("punctuation.definition.frontmatter.end.quarto")).toBe(
      true,
    );
  });

  it("marks the header body as embedded front matter", () => {
    expect(hasScope("meta.embedded.block.frontmatter", "title:")).toBe(true);
  });
});

describe("brace-wrapped code cells", () => {
  it("tags the language on the opening fence", () => {
    const fence = tokens.find(
      (t) =>
        t.text === "python" &&
        t.scopes.includes("entity.name.tag.quarto"),
    );
    expect(fence, "the {python} language should be a tagged entity").toBeTruthy();
  });

  it("scopes opening and closing fence punctuation", () => {
    expect(hasScope("punctuation.definition.fenced_code.begin.quarto")).toBe(
      true,
    );
    expect(hasScope("punctuation.definition.fenced_code.end.quarto")).toBe(
      true,
    );
  });

  it("embeds python / r / julia / ojs content under mapped scopes", () => {
    expect(hasScope("meta.embedded.block.python", "import math")).toBe(true);
    expect(hasScope("meta.embedded.block.r", "square <- function")).toBe(true);
    expect(hasScope("meta.embedded.block.julia", "function fib")).toBe(true);
    expect(hasScope("meta.embedded.block.ojs", "data = [1, 2, 3")).toBe(true);
  });
});

describe("discrimination: plain fences are NOT cells", () => {
  it("does not put a plain ```python block in an embedded cell scope", () => {
    const scopes = scopesOfTextLine("this is a plain fenced block");
    expect(scopes.some((s) => s.startsWith("meta.embedded.block"))).toBe(false);
  });

  it("returns to base scope in prose after the cells close", () => {
    const scopes = scopesOfTextLine("Closing prose, after the cells");
    expect(scopes.some((s) => s.startsWith("meta.embedded.block"))).toBe(false);
  });
});
