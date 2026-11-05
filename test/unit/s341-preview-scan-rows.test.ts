import { describe, expect, it } from "vitest";
import { createBrowseUrlScanner } from "../../src/core/preview-url";

// Session 341 — the BACKLOG item "Slow shapes and residuals found by Session 339's review round", part (3). `quarto preview` writes its startup noise to stderr in chunks. The adapter (`src/features/preview.ts`)
// used to append every chunk to one string and run `parseBrowseUrl(stderr)` on the WHOLE string until the `Browse at <url>` line arrived: `output.replace(ANSI_PATTERN, "")` copies the buffer and the unanchored
// pattern scans it, so the cost was the bytes so far times the chunks. `createBrowseUrlScanner()` (`src/core/preview-url.ts`) is the interface the adapter calls now; these are the CLOCK rows, and the sibling
// `preview-url-scanner-equivalence.test.ts` pins the ANSWERS.
//
// Measured at `c20f0e8` (Session 341, one fresh process per timing, Node, `stderr += chunk; parseBrowseUrl(stderr)` per chunk, lines of startup noise with no marker, load 2.7 to 10.7):
//   4,096-byte chunks, plain lines:        106 / 341 / 1,350 / 5,522 ms at 1 / 2 / 4 / 8 MiB (4x per doubling);
//   4,096-byte chunks, lines with SGR:     352 / 1,408 / 6,129 ms at 1 / 2 / 4 MiB;
//   65,536-byte chunks, plain lines:       352 / 1,425 / 5,740 ms at 8 / 16 / 32 MiB;
//   65,536-byte chunks, lines with SGR:    1,699 / 8,126 ms at 8 / 16 MiB;
//   ONE line with no newline, 4,096-byte chunks: 197 / 741 / 3,093 ms at 2 / 4 / 8 MiB;
//   ONE-byte chunks, plain lines:          22,412 ms at 256 KiB, 89,588 ms at 512 KiB (4x per doubling; about six minutes at 1 MiB, so the row stops at 256 KiB).
// The sizes the rows use (below) were taken from those figures and re-timed in the rows themselves against the seam commit `70bab96` (the old logic behind `createBrowseUrlScanner`), load 6.4 to 7.8:
//   12 MiB plain, 4,096-byte chunks 8.8 s; 4 MiB SGR, 4,096-byte chunks 6.2 s; 48 MiB plain, 65,536-byte chunks 8.9 s; 16 MiB SGR, 65,536-byte chunks 9.5 s; ONE 16 MiB line 12.2 s; 256 KiB in one-byte chunks 15.5 s.
// That is 6x to 16x the limit. The last tenth of the pushes took 17x to 24x the first tenth on the shapes the ratio is asserted on (12 MiB plain: 3,143 against 129 ms; 4 MiB SGR: 1,155 against 66 ms; one-byte
// chunks: 4,377 against 195 ms), checked with the clock assertion switched off.
// The cure (`createBrowseUrlScanner` as committed with these rows), the same six shapes, one fresh process each outside the test: 9 / 12 / 23 / 43 / 20 / 11 ms at load 14 (23x to 110x under the limit), the last
// tenth of the pushes costing what the first does. The whole file, twelve rows with their 96 MiB of generated text, runs in 0.14 s at load 19.
//
// WHAT THE ANSWER IS (Learning 903: the site is reached only while no complete `Browse at <url>` line has arrived, so every row ends on the marker). The scanner answers null for every push until the marker line
// is complete, and the URL at the push that completes it; the rows read that last answer back (Learning 907), after the whole stream of noise went through.
//
// WHAT THE CLOCK CAN SEE. The limit is one second for the whole feed (the chunks are cut before the clock starts). A second, machine-independent reading is the SHAPE of the cost: the last tenth of the pushes against
// the first tenth. A linear scanner takes about the same for both; the old logic took 17x to 24x longer for the last (Learning 877: a CPU five times faster would let a clock row pass a quadratic reader, a ratio would not).

const LIMIT_MS = 1000;
const URL = "http://localhost:3958/";
const MARKER_PLAIN = `Browse at ${URL}\n`;
const MARKER_SGR = `\x1b[32mBrowse at \x1b[39m\x1b[4m\x1b[32m${URL}\x1b[39m\x1b[24m\n`;

const MIB = 1024 * 1024;
const KIB = 1024;

// The sizes the clock rows are built on, each chosen so that the old logic takes 5x to 22x the limit (see the figures above) and the cure takes far under it. The last row of the file pins them.
const CHUNK_SMALL = 4 * KIB;
const CHUNK_LARGE = 64 * KIB;
const SIZES = { plain4k: 12 * MIB, sgr4k: 4 * MIB, plain64k: 48 * MIB, sgr64k: 16 * MIB, oneLine: 16 * MIB, oneByte: 256 * KIB };

/** Startup noise as `quarto preview` writes it, plain: five distinct lines (the last one is the longest) repeated until `bytes` are reached, ending on a line boundary. */
const PLAIN_BLOCK =
  "processing file: sample.qmd\n" +
  "Resolving dependency graph for the startup phase of the render pipeline step\n" +
  "Output created: sample.html\n" +
  "  1/12 [unnamed-chunk-1]\n" +
  "Starting the file watcher on the project directory and waiting for the first change to arrive here\n";

/** The same, with the SGR escapes quarto wraps its lines in (several per line). */
const SGR_BLOCK =
  "\x1b[32mWatching files for changes\x1b[39m\n" +
  "\x1b[1m\x1b[34mprocessing file:\x1b[39m\x1b[22m \x1b[4msample.qmd\x1b[24m and \x1b[32mresolving\x1b[39m the startup pipeline\n" +
  "\x1b[33mOutput created:\x1b[39m sample.html\n" +
  "\x1b[2m  1/12 [unnamed-chunk-1]\x1b[22m\n" +
  "\x1b[36mStarting\x1b[39m the \x1b[1mfile watcher\x1b[22m on the project directory and waiting for the \x1b[3mfirst\x1b[23m change\n";

function noise(block: string, bytes: number): string {
  return block.repeat(Math.ceil(bytes / block.length));
}

/** Cut `text` into chunks of `size` characters (the last one may be shorter), then the marker as one more chunk. */
function chunked(text: string, size: number, marker: string): string[] {
  const chunks: string[] = [];
  for (let at = 0; at < text.length; at += size) {
    chunks.push(text.slice(at, at + size));
  }
  chunks.push(marker);
  return chunks;
}

type Feed = { answers: Array<string | null>; totalMs: number; firstMs: number; lastMs: number };

/** Push every chunk into a fresh scanner, timing the whole feed and its first and last tenth. The clock covers the pushes only. */
function feed(chunks: readonly string[]): Feed {
  const scanner = createBrowseUrlScanner();
  const n = chunks.length;
  const tenth = Math.max(1, Math.floor(n / 10));
  const answers: Array<string | null> = new Array<string | null>(n);
  const t0 = performance.now();
  for (let i = 0; i < tenth; i++) {
    answers[i] = scanner.push(chunks[i]);
  }
  const t1 = performance.now();
  for (let i = tenth; i < n - tenth; i++) {
    answers[i] = scanner.push(chunks[i]);
  }
  const t2 = performance.now();
  for (let i = n - tenth; i < n; i++) {
    answers[i] = scanner.push(chunks[i]);
  }
  const t3 = performance.now();
  return { answers, totalMs: t3 - t0, firstMs: t1 - t0, lastMs: t3 - t2 };
}

/** Every push answered null except the last, which answered the URL. */
function answeredOnlyAtTheMarker(answers: ReadonlyArray<string | null>): { early: number[]; last: string | null } {
  const early: number[] = [];
  for (let i = 0; i < answers.length - 1; i++) {
    if (answers[i] !== null) early.push(i);
  }
  return { early, last: answers[answers.length - 1] };
}

describe("the Session 341 clock helper", () => {
  it("feed hands back every push's answer and a clock that covers the pushes", () => {
    const { answers, totalMs } = feed(["a\n", "b", "\n", MARKER_PLAIN]);
    expect(answers).toEqual([null, null, null, URL]);
    expect(totalMs).toBeGreaterThanOrEqual(0);
    expect(totalMs).toBeLessThan(1000);
  });

  it("answeredOnlyAtTheMarker names the pushes that answered early", () => {
    expect(answeredOnlyAtTheMarker([null, URL, null, URL])).toEqual({ early: [1], last: URL });
    expect(answeredOnlyAtTheMarker([null, null, URL])).toEqual({ early: [], last: URL });
  });
});

describe("Session 341 — the stderr of `quarto preview` before the Browse at line (the BACKLOG item \"Slow shapes and residuals found by Session 339's review round\", part 3)", () => {
  type Row = { site: string; chunks: () => string[]; ratio: boolean };

  const ROWS: Row[] = [
    { site: "4,096-byte chunks, 12 MiB of plain startup lines, then the marker", chunks: () => chunked(noise(PLAIN_BLOCK, SIZES.plain4k), CHUNK_SMALL, MARKER_PLAIN), ratio: true },
    { site: "4,096-byte chunks, 4 MiB of startup lines with SGR escapes, then the marker", chunks: () => chunked(noise(SGR_BLOCK, SIZES.sgr4k), CHUNK_SMALL, MARKER_SGR), ratio: true },
    { site: "65,536-byte chunks, 48 MiB of plain startup lines, then the marker", chunks: () => chunked(noise(PLAIN_BLOCK, SIZES.plain64k), CHUNK_LARGE, MARKER_PLAIN), ratio: true },
    { site: "65,536-byte chunks, 16 MiB of startup lines with SGR escapes, then the marker", chunks: () => chunked(noise(SGR_BLOCK, SIZES.sgr64k), CHUNK_LARGE, MARKER_SGR), ratio: true },
    // ONE enormous line with no newline in it, 4,096 characters at a time. Nothing can be answered until its newline comes, and the line is then read once: the cost is in the LAST pushes by design, so the
    // ratio of the last tenth to the first does not apply; the clock does (the old logic re-read the whole line on every chunk).
    {
      site: "ONE line of 16 MiB with no newline in 4,096-character chunks, then a newline and the marker",
      chunks: () => {
        const chunks = chunked("x".repeat(SIZES.oneLine), CHUNK_SMALL, "\n");
        chunks.push(MARKER_PLAIN);
        return chunks;
      },
      ratio: false,
    },
    // One character at a time: 262,144 pushes (256 KiB) of the plain lines, then the marker one character at a time too.
    {
      site: "ONE-byte chunks, 256 KiB of plain startup lines, then the marker",
      chunks: () => [...noise(PLAIN_BLOCK, SIZES.oneByte), ...MARKER_PLAIN],
      ratio: true,
    },
  ];

  it.each(ROWS.map((row) => [row.site, row] as const))(
    "%s: every push answers null until the marker line is whole, the URL then, in under one second",
    (_site, row) => {
      const chunks = row.chunks();
      const { answers, totalMs, firstMs, lastMs } = feed(chunks);
      // The answer first, so that a failure of the clock below is a failure of the clock alone.
      const { early, last } = answeredOnlyAtTheMarker(answers);
      expect(early).toEqual([]);
      expect(last).toBe(URL);
      expect(totalMs).toBeLessThan(LIMIT_MS);
      if (row.ratio) {
        // The last tenth of the pushes costs about what the first did. A 20 ms floor keeps a garbage-collection pause from deciding it; the old logic took 17x to 24x here and seconds in absolute terms.
        expect(lastMs).toBeLessThan(4 * firstMs + 20);
      }
    },
    120_000,
  );

  // CONTROLS: shapes the old logic handled in linear time or close to it, written to pass on it (and on the cure).
  it("control: a marker line in the very first chunk is answered by the first push", () => {
    const scanner = createBrowseUrlScanner();
    expect(scanner.push(MARKER_PLAIN)).toBe(URL);
  });

  it("control: 256 KiB of plain lines in 4,096-byte chunks, then the marker, is answered at the marker and fast", () => {
    const { answers, totalMs } = feed(chunked(noise(PLAIN_BLOCK, 256 * KIB), 4 * KIB, MARKER_PLAIN));
    const { early, last } = answeredOnlyAtTheMarker(answers);
    expect(early).toEqual([]);
    expect(last).toBe(URL);
    expect(totalMs).toBeLessThan(LIMIT_MS);
  });

  it("control: 1 MiB of lines with SGR escapes in 65,536-byte chunks (sixteen pushes), then the marker, is answered at the marker", () => {
    const { answers } = feed(chunked(noise(SGR_BLOCK, MIB), 64 * KIB, MARKER_SGR));
    const { early, last } = answeredOnlyAtTheMarker(answers);
    expect(early).toEqual([]);
    expect(last).toBe(URL);
  });

  // The rows above fix the limit and the sizes: a limit of 100 s, or an 8 KiB stream, would pass the old logic too.
  it("keeps the limit and the sizes the clock rows are built on", () => {
    expect(LIMIT_MS).toBe(1000);
    expect([CHUNK_SMALL, CHUNK_LARGE]).toEqual([4096, 65_536]);
    expect(SIZES).toEqual({ plain4k: 12_582_912, sgr4k: 4_194_304, plain64k: 50_331_648, sgr64k: 16_777_216, oneLine: 16_777_216, oneByte: 262_144 });
  });
});
