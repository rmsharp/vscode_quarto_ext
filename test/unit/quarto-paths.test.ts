import { describe, expect, it } from "vitest";
import { parseSharePath } from "../../src/core/quarto-paths";

/**
 * `parseSharePath` defensively extracts the Quarto share directory from
 * `quarto --paths` stdout (two lines: bin dir, then share dir — verified live
 * against 1.7.33). `--paths` is UNDOCUMENTED (Phase 6d plan §2.4), so the parse
 * tolerates reordering, extra lines, and trailing whitespace rather than
 * assuming a fixed 2-line contract.
 */
describe("parseSharePath", () => {
  it("returns the share dir from the canonical two-line output", () => {
    const stdout = "/Applications/quarto/bin\n/Applications/quarto/share\n";
    expect(parseSharePath(stdout)).toBe("/Applications/quarto/share");
  });

  it("prefers the `…/share` line even when it is not last", () => {
    // A format change that reorders or appends lines must not break detection.
    const stdout = "/opt/quarto/share\n/opt/quarto/bin\n";
    expect(parseSharePath(stdout)).toBe("/opt/quarto/share");
  });

  it("tolerates CRLF line endings and blank/whitespace lines", () => {
    const stdout = "  \r\nC:\\Program Files\\Quarto\\bin\r\nC:\\Program Files\\Quarto\\share\r\n";
    expect(parseSharePath(stdout)).toBe("C:\\Program Files\\Quarto\\share");
  });

  it("tolerates a trailing path separator on the share dir", () => {
    expect(parseSharePath("/q/bin\n/q/share/\n")).toBe("/q/share/");
  });

  it("falls back to the last non-empty line when none ends in `share`", () => {
    // Defensive: if `--paths` output shape changes, still return a best guess
    // (the readFile of the schema then fails and the reader degrades to curated).
    expect(parseSharePath("line-a\nline-b\n")).toBe("line-b");
  });

  it("returns null for empty or whitespace-only output", () => {
    expect(parseSharePath("")).toBeNull();
    expect(parseSharePath("  \n\t\n")).toBeNull();
  });
});
