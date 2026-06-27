import { describe, expect, it } from "vitest";
import { parseBrowseUrl } from "../../src/core/preview-url";

describe("parseBrowseUrl", () => {
  it("extracts the URL from a clean Browse at line", () => {
    expect(parseBrowseUrl("Browse at http://localhost:3958/\n")).toBe(
      "http://localhost:3958/",
    );
  });

  it("strips the ANSI escapes Quarto wraps the line in (captured live, 1.7.33)", () => {
    // Exact bytes captured this session from `quarto preview … --no-browser`
    // (the marker is on STDERR): green "Browse at ", then underline+green URL.
    const stderr =
      "\x1b[32mBrowse at \x1b[39m\x1b[4m\x1b[32m" +
      "http://localhost:3958/" +
      "\x1b[39m\x1b[24m\n";
    expect(parseBrowseUrl(stderr)).toBe("http://localhost:3958/");
  });

  it("returns null for a partial line (URL not yet newline-terminated)", () => {
    // stderr is consumed in streamed chunks; a chunk can split mid-URL. Until
    // the line completes we must NOT return a truncated URL.
    expect(parseBrowseUrl("Browse at http://localho")).toBeNull();
  });

  it("returns null before the marker appears (the polling contract)", () => {
    // The real startup stderr that streams BEFORE the Browse-at line (captured
    // live). The consumer polls parseBrowseUrl on every chunk and must keep
    // waiting until the URL is actually ready.
    const startup =
      "processing file: sample.qmd\n" +
      "Output created: sample.html\n" +
      "\x1b[32mWatching files for changes\x1b[39m\n";
    expect(parseBrowseUrl(startup)).toBeNull();
  });
});
