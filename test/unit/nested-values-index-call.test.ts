import { beforeEach, describe, expect, it, vi } from "vitest";
import { findNestedFrontMatterValueLines } from "../../src/core/yaml-frontmatter-nested-values";

// Session 323 — the enumerator hands `nestedParentPath` one index of its lines, built when the first nested line is reached. An index left out answers the same and falls back to the old climb (cubic in the depth), so the
// answers cannot show it and only a clock would; these rows count the calls instead. The module is replaced by spies that call through, so this file has to stand alone.
vi.mock("../../src/core/yaml-context", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/core/yaml-context")>();
  return { ...real, nestedParentPath: vi.fn(real.nestedParentPath), indexLineIndents: vi.fn(real.indexLineIndents) };
});
import * as context from "../../src/core/yaml-context";

const asked = (): unknown[][] => vi.mocked(context.nestedParentPath).mock.calls;
const built = (): number => vi.mocked(context.indexLineIndents).mock.calls.length;

describe("Session 323 — findNestedFrontMatterValueLines gives nestedParentPath the index of its lines", () => {
  beforeEach(() => {
    vi.mocked(context.nestedParentPath).mockClear();
    vi.mocked(context.indexLineIndents).mockClear();
  });

  it("builds ONE index for a front matter of nested values, and passes that index with every question", () => {
    const text = "---\nformat:\n  html:\n    a: 1\n    b: 2\n    c: 3\n---\n\ntext\n";
    expect(findNestedFrontMatterValueLines(text)).toHaveLength(3);
    expect(asked().length).toBeGreaterThanOrEqual(3);
    expect(asked().every((call) => call[3] !== undefined)).toBe(true);
    expect(new Set(asked().map((call) => call[3])).size).toBe(1);
    expect(built()).toBe(1);
  });

  it("builds no index for a front matter of column-0 keys: no line is nested, so none is asked about", () => {
    expect(findNestedFrontMatterValueLines("---\ntitle: a\nauthor: b\n---\n\ntext\n")).toEqual([]);
    expect(asked()).toHaveLength(0);
    expect(built()).toBe(0);
  });

  it("builds a new index for each call: nothing is kept between documents", () => {
    const text = "---\nformat:\n  html:\n    a: 1\n---\n\ntext\n";
    findNestedFrontMatterValueLines(text);
    const first = new Set(asked().map((call) => call[3]));
    findNestedFrontMatterValueLines(text);
    const all = new Set(asked().map((call) => call[3]));
    expect(built()).toBe(2);
    expect(first.size).toBe(1);
    expect(all.size).toBe(2);
  });
});
