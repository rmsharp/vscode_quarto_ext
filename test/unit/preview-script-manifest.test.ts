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

  it("gates the editor-title button on the context key", () => {
    const title = menus["editor/title"].filter(
      (m) => m.command === "quarto.previewScript",
    );
    expect(title, "previewScript needs an editor/title entry").toHaveLength(1);
    expect(title[0].when).toBe(KEY);
  });

  it("must NOT gate the palette entry on the context key — that key is only settable AFTER activation, and the palette is the sole activation path for a lone script", () => {
    // 🔑 THE REGRESSION GUARD FOR THE ADVERSARIAL REVIEW'S HIGH FINDING.
    //
    // Chicken-and-egg, verified firsthand: `quartoRenderScriptActive` is set only
    // inside registerPreviewFeature, i.e. only once the extension has ACTIVATED.
    // No activationEvent matches a lone `.py`/`.jl` script (deliberately — we do
    // not activate for every Python file). VS Code does NOT activate an extension
    // in order to evaluate a palette `when` clause, so an extension-owned key that
    // was never `setContext`'d is unset, hence falsy, hence the entry is HIDDEN.
    //
    // Gate the palette on that key and ALL THREE invocation paths close at once for
    // `~/scratch/analysis.py`: the keybinding is false, the title button is hidden,
    // and the palette entry is hidden. The command becomes unreachable — a strict
    // regression, since before Slice 2 it had no palette entry at all and was
    // therefore shown unconditionally, and invoking it auto-activated us (engines
    // ^1.90.0 >= 1.74) and previewed the script. The plan asserted "the palette
    // command still works (auto-activates on invoke)" WHILE also prescribing this
    // gate; the two are mutually exclusive, and shipping both broke the escape hatch.
    const palette = menus.commandPalette.filter(
      (m) => m.command === "quarto.previewScript",
    );
    expect(palette, "previewScript needs a commandPalette entry").toHaveLength(1);
    expect(
      palette[0].when,
      "the palette entry must not depend on quartoRenderScriptActive",
    ).not.toContain(KEY);
  });

  it("gates the palette entry on resourceExtname instead — evaluable with the extension INACTIVE", () => {
    // `resourceExtname` is a BUILT-IN VS Code context key, so VS Code can evaluate
    // it without us being active — which is what preserves auto-activation-on-invoke
    // and keeps the operator's actual intent (don't show the command on a .qmd or a
    // .txt) intact. Precedent in this very manifest: quarto.convertToQmd uses
    // `when: "resourceExtname == .ipynb"`.
    const when = menus.commandPalette.find(
      (m) => m.command === "quarto.previewScript",
    )?.when;
    // Exactly the extensions the detector can ever accept (core/render-script.ts).
    for (const ext of [".py", ".jl", ".r", ".R"]) {
      expect(when, `palette must be reachable for ${ext}`).toContain(
        `resourceExtname == ${ext}`,
      );
    }
  });
});
