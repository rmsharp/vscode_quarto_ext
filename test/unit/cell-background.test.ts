import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";
import {
  cellBackgroundRanges,
  DEFAULT_CELL_BACKGROUND,
  resolveCellBackgroundSettings,
} from "../../src/core/cell-background";

/**
 * Item 17a — cell-execution code-cell background highlighting (Session 111).
 *
 * The pure `core/` layer: which line spans get tinted, and how the config
 * settings resolve. No `vscode` here (the §3.3 guardrail) — the adapter in
 * `features/cell-background.ts` maps these ranges onto real editor decorations.
 */
describe("cellBackgroundRanges", () => {
  it("returns the full fence-inclusive span of a single executable cell", () => {
    const text = ["---", "title: t", "---", "", "```{python}", "a = 1", "```", ""].join(
      "\n",
    );
    // The `{python}` fence opens on 0-based line 4 and closes on line 6.
    expect(cellBackgroundRanges(text)).toEqual([{ startLine: 4, endLine: 6 }]);
  });

  it("returns one range per executable cell, in document order", () => {
    const text = [
      "```{python}", // 0
      "a = 1", // 1
      "```", // 2
      "", // 3
      "prose", // 4
      "", // 5
      "```{r}", // 6
      "b <- 2", // 7
      "```", // 8
    ].join("\n");
    expect(cellBackgroundRanges(text)).toEqual([
      { startLine: 0, endLine: 2 },
      { startLine: 6, endLine: 8 },
    ]);
  });

  it("returns no ranges for a document with no executable cells", () => {
    expect(cellBackgroundRanges("# Heading\n\njust prose\n")).toEqual([]);
  });

  it("excludes a non-executable fenced block (no brace info string)", () => {
    // ```` ```python ```` (no braces) is a display block, not an executable cell —
    // the cell model excludes it, and so must the tint.
    const text = ["```python", "a = 1", "```", ""].join("\n");
    expect(cellBackgroundRanges(text)).toEqual([]);
  });

  it("spans an unterminated cell to the last line of the document", () => {
    // No closing fence: the cell runs to EOF, so the tint should too.
    const text = ["```{python}", "a = 1", "b = 2"].join("\n");
    expect(cellBackgroundRanges(text)).toEqual([{ startLine: 0, endLine: 2 }]);
  });
});

describe("resolveCellBackgroundSettings", () => {
  it("fills every field from DEFAULT_CELL_BACKGROUND when nothing is set", () => {
    expect(resolveCellBackgroundSettings({})).toEqual(DEFAULT_CELL_BACKGROUND);
  });

  it("defaults enabled to true (highlighting is on out of the box)", () => {
    expect(DEFAULT_CELL_BACKGROUND.enabled).toBe(true);
    expect(resolveCellBackgroundSettings({}).enabled).toBe(true);
  });

  it("passes through explicit settings", () => {
    expect(
      resolveCellBackgroundSettings({
        enabled: false,
        light: "#11223344",
        dark: "#55667788",
      }),
    ).toEqual({ enabled: false, light: "#11223344", dark: "#55667788" });
  });

  it("keeps enabled=false rather than treating it as unset", () => {
    // A falsy-but-defined boolean must not fall back to the true default.
    expect(resolveCellBackgroundSettings({ enabled: false }).enabled).toBe(false);
  });

  it("falls back to the default colour when a colour is empty or whitespace", () => {
    const resolved = resolveCellBackgroundSettings({ light: "", dark: "   " });
    expect(resolved.light).toBe(DEFAULT_CELL_BACKGROUND.light);
    expect(resolved.dark).toBe(DEFAULT_CELL_BACKGROUND.dark);
  });

  it("trims surrounding whitespace from a provided colour", () => {
    expect(resolveCellBackgroundSettings({ light: "  #abcdef12  " }).light).toBe(
      "#abcdef12",
    );
  });
});

/**
 * A manifest-shape regression guard (same pattern as `walkthrough.test.ts` /
 * `snippets.test.ts`): the `contributes.configuration` defaults MUST match
 * `DEFAULT_CELL_BACKGROUND`, so the settings a user sees before overriding are
 * exactly what the adapter falls back to. One source of truth, pinned here.
 */
describe("package.json contributes.configuration (quarto.cells.background.*)", () => {
  const props = packageJson.contributes.configuration.properties as Record<
    string,
    { type: string; default: unknown; description?: string; markdownDescription?: string }
  >;

  it("contributes the enabled toggle with the DEFAULT_CELL_BACKGROUND default", () => {
    const key = props["quarto.cells.background.enabled"];
    expect(key).toBeDefined();
    expect(key.type).toBe("boolean");
    expect(key.default).toBe(DEFAULT_CELL_BACKGROUND.enabled);
  });

  it("contributes the light colour with the DEFAULT_CELL_BACKGROUND default", () => {
    const key = props["quarto.cells.background.light"];
    expect(key).toBeDefined();
    expect(key.type).toBe("string");
    expect(key.default).toBe(DEFAULT_CELL_BACKGROUND.light);
  });

  it("contributes the dark colour with the DEFAULT_CELL_BACKGROUND default", () => {
    const key = props["quarto.cells.background.dark"];
    expect(key).toBeDefined();
    expect(key.type).toBe("string");
    expect(key.default).toBe(DEFAULT_CELL_BACKGROUND.dark);
  });
});
