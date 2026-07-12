import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";

/**
 * Manifest-shape regression guards for `BACKLOG.md` item 15 Slice 2 — the
 * Posit-parity gating layer for `quarto.previewScript` (plan §6 Slice 2).
 *
 * The `when`-clause content here is genuinely load-bearing, not boilerplate: it
 * is what makes `Ctrl+Shift+K` mean "preview the thing I am editing" while the
 * two preview commands remain mutually exclusive. A typo in either clause
 * silently produces either an ambiguous binding or a keystroke that fires a
 * command which immediately errors — neither of which any runtime test would
 * catch, because VS Code resolves keybindings, not us. Precedent for a
 * manifest-shape guard: `walkthrough.test.ts`, `snippets.test.ts`.
 */

const KEY = "quartoRenderScriptActive";

const keybindings = packageJson.contributes.keybindings as Array<{
  command: string;
  key: string;
  mac?: string;
  when?: string;
}>;

const menus = packageJson.contributes.menus as Record<
  string,
  Array<{ command: string; when?: string; group?: string }>
>;

function bindingFor(command: string): { key: string; mac?: string; when?: string } {
  const hits = keybindings.filter((k) => k.command === command);
  expect(
    hits,
    `exactly one keybinding expected for ${command}`,
  ).toHaveLength(1);
  return hits[0];
}

describe("quarto.previewScript manifest — Ctrl+Shift+K mutual exclusion", () => {
  it("binds ctrl+shift+k / cmd+shift+k to BOTH preview commands", () => {
    for (const command of ["quarto.preview", "quarto.previewScript"]) {
      const binding = bindingFor(command);
      expect(binding.key, `${command} key`).toBe("ctrl+shift+k");
      expect(binding.mac, `${command} mac key`).toBe("cmd+shift+k");
    }
  });

  it("makes the two bindings MUTUALLY EXCLUSIVE on the context key", () => {
    // previewScript fires only for a render script; preview only when it is not
    // one. The conditions are complements, so the same keystroke can never
    // resolve to both commands — which is the entire point of the context key.
    expect(bindingFor("quarto.previewScript").when).toContain(KEY);
    expect(bindingFor("quarto.previewScript").when).not.toContain(`!${KEY}`);
    expect(bindingFor("quarto.preview").when).toContain(`!${KEY}`);
  });

  it("scopes quarto.preview's binding to Quarto documents so it cannot hijack Delete Line globally", () => {
    // 🔑 THE REGRESSION GUARD FOR THIS SLICE'S ONE DELIBERATE DIVERGENCE.
    //
    // ctrl+shift+k / cmd+shift+k is VS Code's built-in **Delete Line**
    // (`editor.action.deleteLines`, `primary: 3113` = CtrlCmd|Shift|KeyK, weight
    // 100 = EditorContrib — read firsthand out of the VS Code 1.128 build in
    // .vscode-test). An EXTERNAL extension's keybindings register at weight
    // 400+, and the resolver takes the highest weight, so OUR binding wins every
    // collision its `when` clause matches.
    //
    // Posit's own manifest gates quarto.preview on a bare `!quartoRenderScriptActive`
    // (verified via `gh api` against their public package.json). That expression is
    // true in essentially EVERY editor — so it silently replaces Delete Line with
    // "Quarto: open a Quarto (.qmd) document to preview" in .py, .json, .txt,
    // everywhere. We deliberately diverge: `editorLangId == quarto` keeps the
    // override inside the documents where previewing is actually the intent, and
    // leaves Delete Line alone everywhere else.
    //
    // If a future session "restores Posit fidelity" by dropping this clause, this
    // test is what tells them what they just broke.
    expect(bindingFor("quarto.preview").when).toContain("editorLangId == quarto");
  });

  it("gates the palette entry and the editor-title button on the context key", () => {
    const palette = menus.commandPalette.filter(
      (m) => m.command === "quarto.previewScript",
    );
    expect(palette, "previewScript needs a commandPalette entry").toHaveLength(1);
    // Divergence from Posit (`when: false`, hidden): this project favours palette
    // discoverability, so the entry is SHOWN, but only for an actual render script
    // (plan §5.3 palette sub-decision; operator-approved at the S84 kickoff).
    expect(palette[0].when).toBe(KEY);

    const title = menus["editor/title"].filter(
      (m) => m.command === "quarto.previewScript",
    );
    expect(title, "previewScript needs an editor/title entry").toHaveLength(1);
    expect(title[0].when).toBe(KEY);
  });
});
