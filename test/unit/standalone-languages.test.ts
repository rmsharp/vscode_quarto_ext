import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";

const REPO_ROOT = join(__dirname, "..", "..");

/**
 * A regression guard for the standalone .dot/.mmd/.typ language registrations
 * (BACKLOG.md item 13(b), declarative-only, TDD-exempt per CLAUDE.md) —
 * mirrors walkthrough.test.ts/snippets.test.ts's manifest-shape-check
 * pattern. Catches a broken `configuration` path reference, a duplicate
 * language id, or a colliding file extension, none of which VS Code's own
 * JSON schema validation would catch.
 */
describe("package.json contributes.languages (standalone diagram/typst)", () => {
  const languages = packageJson.contributes.languages;
  const STANDALONE_IDS = ["dot", "mermaid", "typst"];

  it("registers dot, mermaid, and typst alongside the existing quarto language", () => {
    const ids = languages.map((l) => l.id);
    for (const id of STANDALONE_IDS) {
      expect(ids).toContain(id);
    }
    expect(ids).toContain("quarto");
  });

  it("every language id is unique", () => {
    const ids = languages.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every file extension is claimed by exactly one language", () => {
    const allExtensions = languages.flatMap((l) => l.extensions ?? []);
    expect(new Set(allExtensions).size).toBe(allExtensions.length);
  });

  for (const id of STANDALONE_IDS) {
    describe(`language "${id}"`, () => {
      const entry = languages.find((l) => l.id === id);

      it("is defined", () => {
        expect(entry).toBeDefined();
      });

      it("declares at least one dotted file extension", () => {
        expect(entry?.extensions?.length).toBeGreaterThan(0);
        for (const ext of entry?.extensions ?? []) {
          expect(ext.startsWith(".")).toBe(true);
        }
      });

      it("declares at least one alias", () => {
        expect(entry?.aliases?.length).toBeGreaterThan(0);
      });

      it("points its configuration at a file that exists on disk", () => {
        expect(entry?.configuration).toBeTruthy();
        expect(
          existsSync(join(REPO_ROOT, entry?.configuration ?? "")),
        ).toBe(true);
      });
    });
  }
});

describe("standalone language-configuration.json files", () => {
  const FILES: Record<string, string> = {
    dot: "languages/dot-language-configuration.json",
    mermaid: "languages/mermaid-language-configuration.json",
    typst: "languages/typst-language-configuration.json",
  };

  for (const [id, relPath] of Object.entries(FILES)) {
    it(`${id}: defines comments and brackets`, () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const config = require(join(REPO_ROOT, relPath));
      expect(config.comments).toBeDefined();
      expect(
        config.comments.lineComment || config.comments.blockComment,
      ).toBeTruthy();
      expect(Array.isArray(config.brackets)).toBe(true);
      expect(config.brackets.length).toBeGreaterThan(0);
    });
  }
});
