import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";
import quartoSnippets from "../../snippets/quarto.json";

const REPO_ROOT = join(__dirname, "..", "..");

/**
 * A regression guard for the Quarto snippets contribution (declarative-only,
 * per CLAUDE.md's TDD exemption for pure config edits) — mirrors
 * walkthrough.test.ts's manifest-shape-check pattern. Catches a broken
 * `path` reference, a missing/duplicate prefix, or a malformed snippet body,
 * none of which VS Code's own JSON schema validation would catch (it
 * validates shape, not cross-references or prefix collisions).
 */
describe("package.json contributes.snippets", () => {
  const snippetContributions = packageJson.contributes.snippets;

  it("defines exactly one snippets contribution, scoped to the quarto language", () => {
    expect(snippetContributions).toHaveLength(1);
    expect(snippetContributions[0].language).toBe("quarto");
  });

  it("points its path at a file that exists on disk", () => {
    expect(existsSync(join(REPO_ROOT, snippetContributions[0].path))).toBe(
      true,
    );
  });
});

describe("snippets/quarto.json", () => {
  const entries = Object.entries(quartoSnippets);

  it("defines at least one snippet", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it("every prefix is unique", () => {
    const prefixes = entries.map(([, snippet]) => snippet.prefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  for (const [name, snippet] of entries) {
    describe(`snippet "${name}"`, () => {
      it("has a non-empty prefix and description", () => {
        expect(snippet.prefix).toBeTruthy();
        expect(snippet.description).toBeTruthy();
      });

      it("has a non-empty body (string or array of strings)", () => {
        const lines = Array.isArray(snippet.body)
          ? snippet.body
          : [snippet.body];
        expect(lines.length).toBeGreaterThan(0);
        for (const line of lines) {
          expect(typeof line).toBe("string");
        }
      });
    });
  }
});
