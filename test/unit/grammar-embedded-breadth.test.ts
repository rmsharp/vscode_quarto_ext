import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as oniguruma from "vscode-oniguruma";
import * as vsctm from "vscode-textmate";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Headless tokenization proof (CHANGELOG: quick declarative wins bundle, Sessions 76-78(a)) that each newly-added
 * embedded-language cell actually gets its own `meta.embedded.block.<lang>`
 * scope, distinct from `cell-generic`'s undifferentiated
 * `meta.embedded.block.quarto` catch-all. Mirrors `test/unit/tokenize.test.ts`'s
 * harness exactly, but tokenizes a small, dedicated fixture string (NOT
 * `test/fixtures/sample.qmd`, which many other unit/integration suites assert
 * exact cell counts/positions against) so this session's additions carry zero
 * cross-suite blast radius.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

interface FlatToken {
  line: number;
  text: string;
  scopes: string[];
}

async function tokenize(text: string): Promise<FlatToken[]> {
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
      // Empty stub for every external include — see `test/unit/tokenize.test.ts`,
      // whose harness this mirrors, for why the stub must not be null and why it
      // is built through `parseRawGrammar` rather than returned as a bare object
      // literal (the literal does not satisfy `IRawGrammar`; the round-trip yields
      // the identical object and needs no cast).
      return vsctm.parseRawGrammar(
        JSON.stringify({ scopeName, patterns: [] }),
        `${scopeName}.json`,
      );
    },
  });

  const grammar = await registry.loadGrammar("text.html.quarto");
  const lines = text.split(/\r?\n/);
  const tokens: FlatToken[] = [];
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
  return tokens;
}

function hasScope(tokens: FlatToken[], scope: string, onText: string): boolean {
  const lines = new Set(
    tokens.filter((t) => t.text.includes(onText)).map((t) => t.line),
  );
  return tokens.some((t) => t.scopes.includes(scope) && lines.has(t.line));
}

describe("embedded-grammar breadth (CHANGELOG: quick declarative wins bundle, Sessions 76-78(a))", () => {
  let tokens: FlatToken[];

  beforeAll(async () => {
    tokens = await tokenize(
      [
        "```{bash}",
        'echo "hello from bash"',
        "```",
      ].join("\n"),
    );
  });

  it("scopes a {bash} cell as meta.embedded.block.bash, not the generic catch-all", () => {
    expect(hasScope(tokens, "meta.embedded.block.bash", "hello from bash")).toBe(
      true,
    );
    expect(
      hasScope(tokens, "meta.embedded.block.quarto", "hello from bash"),
    ).toBe(false);
  });
});

/**
 * The remaining 14 languages (bundled VS Code scopes confirmed directly
 * against this repo's own `.vscode-test` install — see CHANGELOG: quick declarative wins bundle, Sessions 76-78(a))
 * are mechanically identical to the bash case above, already proven end-to-end.
 * CLAUDE.md's own TDD-gate carve-out exempts pure grammar JSON from a unit
 * test entirely ("Pure declarative/config/doc edits with no logic... are
 * exempt"); this project's convention (PROJECT_LEARNINGS.md Learning #58/#61)
 * is to still add cheap regression coverage for exempt declarative work, which
 * this table-driven test provides, batched rather than one-at-a-time.
 */
describe("embedded-grammar breadth — remaining languages (batch, declarative/TDD-exempt)", () => {
  const cases: Array<[engine: string, lang: string, snippet: string]> = [
    ["c", "c", "int main(void) { return 0; }"],
    ["cpp", "cpp", "int main() { return 0; }"],
    ["csharp", "csharp", 'Console.WriteLine("hi");'],
    ["fsharp", "fsharp", "let square x = x * x"],
    ["rust", "rust", 'fn main() { println!("hi"); }'],
    ["go", "go", 'func main() { fmt.Println("hi") }'],
    ["sql", "sql", "SELECT 1;"],
    ["lua", "lua", 'print("hi")'],
    ["ruby", "ruby", 'puts "hi"'],
    ["php", "php", 'echo "hi";'],
    ["perl", "perl", 'print "hi";'],
    ["java", "java", 'System.out.println("hi");'],
    ["dockerfile", "dockerfile", "FROM ubuntu:22.04"],
    ["powershell", "powershell", 'Write-Host "hi"'],
  ];

  it.each(cases)(
    "scopes a {%s} cell as meta.embedded.block.%s, not the generic catch-all",
    async (engine, lang, snippet) => {
      const cellTokens = await tokenize(
        [`\`\`\`{${engine}}`, snippet, "```"].join("\n"),
      );
      expect(hasScope(cellTokens, `meta.embedded.block.${lang}`, snippet)).toBe(
        true,
      );
      expect(hasScope(cellTokens, "meta.embedded.block.quarto", snippet)).toBe(
        false,
      );
    },
  );
});
