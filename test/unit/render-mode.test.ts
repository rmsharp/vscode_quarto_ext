import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";
import { DEFAULT_RENDER_MODE, RENDER_MODE_SETTING, RENDER_MODES, resolveRenderMode } from "../../src/core/render-mode";

describe("Session 310 — resolveRenderMode: the raw setting value to the mode the Outline reads for", () => {
  it("the one value that selects the non-executing reading is the exact string `no-execute`", () => {
    expect(resolveRenderMode("no-execute")).toBe("no-execute");
  });
  it("`execute` selects the executing reading", () => {
    expect(resolveRenderMode("execute")).toBe("execute");
  });
  // `settings.json` can hold anything, and the default reading is the one every caller had before the setting existed, so a value this does not know falls back to it. Strict on purpose:
  // a differently cased or padded string is NOT `no-execute`, because guessing the non-default reading would hide headings quarto shows when the guess was wrong.
  it.each([undefined, null, "", "banana", "No-Execute", " no-execute ", "no_execute", "noexecute", true, false, 0, 1, 42, {}, [], ["no-execute"], () => "no-execute"])(
    "anything else falls back to the default: %s",
    (raw) => {
      expect(resolveRenderMode(raw)).toBe("execute");
    },
  );
});

describe("Session 310 — the mode constants", () => {
  it("the default is the executing reading, the one every caller had before the setting existed", () => {
    expect(DEFAULT_RENDER_MODE).toBe("execute");
  });
  it("lists both modes, default first", () => {
    expect(RENDER_MODES).toEqual(["execute", "no-execute"]);
  });
  it("the helper maps every listed mode to itself", () => {
    expect(RENDER_MODES.map((m) => resolveRenderMode(m))).toEqual([...RENDER_MODES]);
  });
});

/**
 * A manifest-shape regression guard (the `cell-background.test.ts` pattern): the contributed setting MUST list exactly the modes the code knows and default to the one the code falls
 * back to, so what a user sees in the Settings editor before overriding is what the adapters read. One source of truth, pinned here.
 */
describe("package.json contributes.configuration (quarto.symbols.renderMode)", () => {
  type Setting = { type: string; enum?: string[]; enumDescriptions?: string[]; default: unknown; scope?: string; markdownDescription?: string };
  const props = packageJson.contributes.configuration.properties as Record<string, Setting>;
  // The adapters read `RENDER_MODE_SETTING` under the `quarto` section; the manifest declares `quarto.<it>`: one key, pinned from the code side.
  const key = props[`quarto.${RENDER_MODE_SETTING}`];

  it("is contributed under the key the adapters read", () => {
    expect(RENDER_MODE_SETTING).toBe("symbols.renderMode");
    expect(key).toBeDefined();
  });
  it("is a string setting that lists exactly the modes the code knows and defaults to the fallback", () => {
    expect(key.type).toBe("string");
    expect(key.enum).toEqual([...RENDER_MODES]);
    expect(key.default).toBe(DEFAULT_RENDER_MODE);
  });
  it("describes each mode, in the order of the enum", () => {
    expect(key.enumDescriptions).toHaveLength(RENDER_MODES.length);
    expect(key.enumDescriptions?.every((d) => d.length > 20)).toBe(true);
  });
  // Resource scope: whether a folder is rendered with `--no-execute` (a docs-only repository, frozen results) is a property of the folder, and `.vscode/settings.json` can carry it.
  it("is resource-scoped, so a folder can carry it", () => {
    expect(key.scope).toBe("resource");
  });
  it("tells the user which render it is about and which documents it reaches", () => {
    expect(key.markdownDescription).toContain("--no-execute");
    expect(key.markdownDescription).toContain("knitr");
  });
});
