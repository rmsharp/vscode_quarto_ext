import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";

const REPO_ROOT = join(__dirname, "..", "..");
const COMMAND_LINK = /command:([a-zA-Z0-9.]+)/g;
const ON_COMMAND = /^onCommand:(.+)$/;

/**
 * A regression guard for the Track C onboarding walkthrough (declarative-only,
 * per CLAUDE.md's TDD exemption for pure config edits) — mirrors
 * package-activation.test.ts's package.json-shape-check pattern. Catches a
 * broken media path or a completionEvents/description reference to a command
 * that doesn't exist, neither of which VS Code's own JSON schema validation
 * would catch (it validates shape, not cross-references).
 */
describe("package.json contributes.walkthroughs", () => {
  const registeredCommands = new Set(
    packageJson.contributes.commands.map((c) => c.command),
  );
  const walkthroughs = packageJson.contributes.walkthroughs;

  it("defines exactly one walkthrough, quartoGettingStarted", () => {
    expect(walkthroughs).toHaveLength(1);
    expect(walkthroughs[0].id).toBe("quartoGettingStarted");
  });

  it("has exactly 5 steps (VS Code UX guidance warns against more)", () => {
    expect(walkthroughs[0].steps).toHaveLength(5);
  });

  it("is featured for .qmd files", () => {
    expect(walkthroughs[0].featuredFor).toEqual(["**/*.qmd"]);
  });

  for (const step of walkthroughs[0].steps) {
    describe(`step "${step.id}"`, () => {
      it("has a unique, non-empty id/title/description", () => {
        expect(step.id).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.description).toBeTruthy();
      });

      it("points its markdown media at a file that exists on disk", () => {
        expect(step.media.markdown).toBeTruthy();
        expect(existsSync(join(REPO_ROOT, step.media.markdown))).toBe(true);
      });

      it("every command: link in its description is a registered command", () => {
        const links = [...step.description.matchAll(COMMAND_LINK)].map(
          (m) => m[1],
        );
        expect(links.length).toBeGreaterThan(0);
        for (const command of links) {
          expect(registeredCommands.has(command)).toBe(true);
        }
      });

      it("every completionEvents onCommand: entry is a registered command", () => {
        expect(step.completionEvents.length).toBeGreaterThan(0);
        for (const event of step.completionEvents) {
          const match = ON_COMMAND.exec(event);
          expect(match).not.toBeNull();
          expect(registeredCommands.has(match![1])).toBe(true);
        }
      });
    });
  }
});
