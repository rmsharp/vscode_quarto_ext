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

  /**
   * `BACKLOG.md` item 15 Slice 2. The `quartoRenderScriptActive` context key can
   * only be set while the extension is ACTIVE, and nothing here activates for a
   * bare `.py`/`.jl`/`.r` script — so without these events the key stays unset and
   * the keybinding/editor-title button are inert. Same events Posit uses (plan
   * §2.4/§5.3), for the same reason.
   */
  describe("render-script activation (item 15 Slice 2)", () => {
    it("activates for R, which covers the kernel-free knitr spin script", () => {
      expect(packageJson.activationEvents).toContain("onLanguage:r");
    });

    it("activates inside a Quarto project, which is where render scripts actually live", () => {
      // A render-script-only project (a `_quarto.yml` plus `.py` scripts and NOT
      // one `.qmd`) activates on the second event alone — dropping it was a
      // confirmed defect in the plan's own first draft (its review's finding #6).
      expect(packageJson.activationEvents).toContain(
        "workspaceContains:**/_quarto.{yml,yaml}",
      );
    });

    it("matches EVERY Quarto extension this extension itself registers, including .Rmd", () => {
      // workspaceContains globs are matched CASE-SENSITIVELY (VS Code runs ripgrep
      // with --case-sensitive), so `**/*.{qmd,rmd}` — Posit's glob, which the plan
      // told us to copy — never matches `report.Rmd`, even though this extension's
      // own `contributes.languages` registers `.Rmd` as a Quarto file. An .Rmd-only
      // project therefore would not activate us at startup, so opening a render
      // script there would leave the context key unset and the gating layer inert.
      // (Adversarial review, Session 85.)
      const registered = packageJson.contributes.languages[0].extensions;
      expect(registered).toContain(".Rmd");
      expect(packageJson.activationEvents).toContain(
        "workspaceContains:**/*.{qmd,rmd,Rmd}",
      );
    });

    it("does NOT activate for every Python/Julia file", () => {
      // Deliberate, disclosed limitation (plan §5.3): a LONE .py/.jl script with no
      // Quarto workspace file present does not activate us, so the key stays unset
      // and only the palette command (which auto-activates on invoke) works. Posit
      // makes the same call — activating on every Python file in VS Code is too
      // costly to justify. Do NOT "fix" the gap by adding these.
      expect(packageJson.activationEvents).not.toContain("onLanguage:python");
      expect(packageJson.activationEvents).not.toContain("onLanguage:julia");
    });
  });
});
