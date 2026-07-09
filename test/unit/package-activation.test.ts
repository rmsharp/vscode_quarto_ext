import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";

/**
 * A regression guard for the YAML schema diagnostics plan's D2 activation fix
 * (adversarial review, Session 47): the integration suite's `before()` hook
 * force-activates the extension directly, bypassing VS Code's actual
 * activation-event dispatch — so every yaml-diagnostics.test.ts test passes
 * identically whether `onLanguage:yaml` is present, absent, or misspelled.
 * This is the cheap, always-run check that would actually catch a revert.
 */
describe("package.json activationEvents", () => {
  it("includes onLanguage:yaml (a _quarto.yml opens as VS Code's built-in yaml languageId, not this extension's own 'quarto')", () => {
    expect(packageJson.activationEvents).toContain("onLanguage:yaml");
  });

  it("still includes onLanguage:quarto (the pre-existing .qmd/.rmd/.Rmd activation)", () => {
    expect(packageJson.activationEvents).toContain("onLanguage:quarto");
  });
});
