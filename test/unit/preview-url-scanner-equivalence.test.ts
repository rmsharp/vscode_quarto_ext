import { describe, expect, it } from "vitest";
import { createBrowseUrlScanner } from "../../src/core/preview-url";

// Session 341 — the BACKLOG item "Slow shapes and residuals found by Session 339's review round", part (3). `quarto preview` writes its startup noise to stderr in chunks, and the adapter used to append every chunk to
// one string and re-parse the WHOLE string (`parseBrowseUrl(stderr)`) until the `Browse at <url>` line arrived: the cost was the bytes so far times the chunks. `createBrowseUrlScanner()` answers the same question
// from the NEW text only. This file pins the ANSWERS (the sibling `s341-preview-scan-rows.test.ts` holds the clock): for any string and any split of it into chunks, the scanner's first non-null answer comes at the
// same push at which `parseBrowseUrl(everything so far)` first becomes non-null, and is the same URL.

/** Push every chunk into a fresh scanner and return what each push answered. */
function answers(chunks: readonly string[]): Array<string | null> {
  const scanner = createBrowseUrlScanner();
  return chunks.map((chunk) => scanner.push(chunk));
}

describe("Session 341 — createBrowseUrlScanner, the first answers", () => {
  it("answers null for a chunk with no complete Browse at line", () => {
    expect(answers(["processing file: sample.qmd\n"])).toEqual([null]);
  });

  it("answers the URL at the push that completes the line, for the live ANSI capture (quarto 1.7.33)", () => {
    // The same bytes `preview-url.test.ts` pins for `parseBrowseUrl`: green "Browse at ", then underline+green URL.
    const live = "\x1b[32mBrowse at \x1b[39m\x1b[4m\x1b[32mhttp://localhost:3958/\x1b[39m\x1b[24m\n";
    expect(answers([live])).toEqual(["http://localhost:3958/"]);
  });

  it("answers null while the newline of the URL line has not arrived, then the URL when it does", () => {
    expect(answers(["Browse at http://localhost:3958/", "\n"])).toEqual([null, "http://localhost:3958/"]);
  });
});
