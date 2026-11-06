import { describe, expect, it } from "vitest";
import { createBrowseUrlScanner, parseBrowseUrl } from "../../src/core/preview-url";
import { everyString, seededRandom } from "./support/regex-equivalence";

// Session 341 — the BACKLOG item "Slow shapes and residuals found by Session 339's review round", part (3). `quarto preview` writes its startup noise to stderr in chunks, and the adapter used to append every chunk to
// one string and re-parse the WHOLE string (`parseBrowseUrl(stderr)`) until the `Browse at <url>` line arrived: the cost was the bytes so far times the chunks. `createBrowseUrlScanner()` answers the same question
// from the NEW text only. This file pins the ANSWERS (the sibling `s341-preview-scan-rows.test.ts` holds the clock).
//
// WHAT IS PINNED. For ANY string S and ANY split of S into chunks (empty chunks and one character at a time included), the scanner's FIRST non-null answer comes at the same push at which `parseBrowseUrl(everything
// pushed so far)` first becomes non-null, and is the same URL (the leftmost match: two marker lines in one chunk give the first); every push before that answers null. What the scanner answers AFTER its first non-null
// answer is unspecified (the adapter stops feeding it), and nothing here pins it.
//
// WHY THE SCANNER MAY TEST ONLY THE NEW LINES. `BROWSE_PATTERN` (`/Browse at[ \t]+(https?:\/\/\S+?)[ \t\r]*\n/`) cannot span a newline (`\S` and `[ \t\r]` both exclude it, and the pattern ends on one) and an SGR escape
// (`\x1b\[[0-9;]*m`) cannot contain one, so stripping the escapes and matching the pattern line by line gives what doing both on the whole buffer gives, and a chunk boundary inside "Browse at", inside the URL, inside an
// escape or between the "\r" and the "\n" does not matter. A match needs its terminating newline, so the text after the last newline can never answer: the scanner keeps it, raw, until its newline arrives.
//
// THE ORACLE is the OLD spelling, copied VERBATIM from the stderr handler of `src/features/preview.ts` at `c20f0e8` (one string that every chunk is appended to, and `parseBrowseUrl` on all of it per chunk), beside
// the pinned counts of the enumerations below, which `tools/preview-scan-count/count_answers.py` recounts from the DEFINITION (line by line, no regular expression, no code shared with this file).

// ---- The OLD spelling, copied from the handler of `c20f0e8`: `stderr += text; ... parseBrowseUrl(stderr)`. ----
function oldAnswers(chunks: readonly string[]): Array<string | null> {
  let stderr = "";
  return chunks.map((text) => {
    stderr += text;
    return parseBrowseUrl(stderr);
  });
}

/** Push every chunk into a fresh scanner and return what each push answered. */
function answers(chunks: readonly string[]): Array<string | null> {
  const scanner = createBrowseUrlScanner();
  return chunks.map((chunk) => scanner.push(chunk));
}

type First = { at: number; url: string } | null;

/** The first push that answered, and what it answered: the only part of the answers that is specified. */
function firstAnswer(all: ReadonlyArray<string | null>): First {
  for (let at = 0; at < all.length; at++) {
    const url = all[at];
    if (url !== null) return { at, url };
  }
  return null;
}

/** The scanner's first answer, for a given split. */
const scannerFirst = (chunks: readonly string[]): First => firstAnswer(answers(chunks));
/** What the OLD spelling's first answer was, for the same split. */
const oldFirst = (chunks: readonly string[]): First => firstAnswer(oldAnswers(chunks));

const URL = "http://localhost:3958/";
const LIVE = `\x1b[32mBrowse at \x1b[39m\x1b[4m\x1b[32m${URL}\x1b[39m\x1b[24m\n`;

describe("Session 341 — createBrowseUrlScanner, the first answers", () => {
  it("answers null for a chunk with no complete Browse at line", () => {
    expect(answers(["processing file: sample.qmd\n"])).toEqual([null]);
  });

  it("answers the URL at the push that completes the line, for the live ANSI capture (quarto 1.7.33)", () => {
    // The same bytes `preview-url.test.ts` pins for `parseBrowseUrl`: green "Browse at ", then underline+green URL.
    expect(answers([LIVE])).toEqual([URL]);
  });

  it("answers null while the newline of the URL line has not arrived, then the URL when it does", () => {
    expect(answers(["Browse at http://localhost:3958/", "\n"])).toEqual([null, URL]);
  });
});

// ---- NAMED CASES. Each is a list of chunks and the first answer the OLD spelling gives (checked on it) and the scanner must give. ----
type Case = { name: string; chunks: string[]; first: First };

const oneByOne = (text: string): string[] => [...text];
const inPieces = (text: string, size: number): string[] => {
  const pieces: string[] = [];
  for (let at = 0; at < text.length; at += size) pieces.push(text.slice(at, at + size));
  return pieces;
};

const CASES: Case[] = [
  { name: "the live ANSI capture in one chunk", chunks: [LIVE], first: { at: 0, url: URL } },
  { name: "the live ANSI capture one character at a time: the answer comes with the newline, the last character", chunks: oneByOne(LIVE), first: { at: LIVE.length - 1, url: URL } },
  { name: "the live ANSI capture in pieces of seven characters (boundaries inside the escapes, inside the marker and inside the URL)", chunks: inPieces(LIVE, 7), first: { at: Math.ceil(LIVE.length / 7) - 1, url: URL } },
  { name: "a CRLF line in one chunk", chunks: ["Browse at http://localhost:3958/\r\n"], first: { at: 0, url: URL } },
  { name: "a CRLF line split between the carriage return and the newline: null at the carriage return, the URL at the newline", chunks: ["Browse at http://localhost:3958/\r", "\n"], first: { at: 1, url: URL } },
  { name: "a partly received marker: null", chunks: ["Browse a"], first: null },
  { name: "a marker split in the middle of its words: the URL when the line completes", chunks: ["Brow", "se at http://localhost:3958/\n"], first: { at: 1, url: URL } },
  { name: "a marker split between its two words", chunks: ["Browse", " at http://localhost:3958/\n"], first: { at: 1, url: URL } },
  { name: "a URL line whose newline has not arrived: null", chunks: ["Browse at http://localhost:3958/"], first: null },
  { name: "a URL cut in the middle, the rest and the newline in the next chunk", chunks: ["Browse at http://localho", "st:3958/\n"], first: { at: 1, url: URL } },
  { name: "an SGR escape cut after its bracket", chunks: ["\x1b[32mBrowse at \x1b[", "39m\x1b[4m\x1b[32mhttp://localhost:3958/\x1b[39m\x1b[24m\n"], first: { at: 1, url: URL } },
  { name: "an SGR escape cut inside the URL", chunks: ["Browse at http://local\x1b[3", "9mhost:3958/\n"], first: { at: 1, url: URL } },
  { name: "an escape cut just before its final m, in the middle of the marker", chunks: ["Brow\x1b[0", "mse at http://localhost:3958/\n"], first: { at: 1, url: URL } },
  { name: "an escape between the URL and its newline", chunks: ["Browse at http://localhost:3958/\x1b[39m", "\n"], first: { at: 1, url: URL } },
  { name: "text before the marker on the same line", chunks: ["Quarto says: Browse at http://localhost:3958/\n"], first: { at: 0, url: URL } },
  { name: "a marker whose URL is not http or https (ftp): null", chunks: ["Browse at ftp://localhost:3958/\n"], first: null },
  { name: "a marker with no scheme at all: null", chunks: ["Browse at localhost:3958\n"], first: null },
  { name: "an https URL", chunks: ["Browse at https://localhost:3958/\n"], first: { at: 0, url: "https://localhost:3958/" } },
  { name: "a tab between the words and trailing blanks after the URL", chunks: ["Browse at\thttp://localhost:3958/ \t \n"], first: { at: 0, url: URL } },
  { name: "no blank between 'at' and the URL: null", chunks: ["Browse athttp://localhost:3958/\n"], first: null },
  {
    name: "a very long single line (100,000 characters in 1,000-character chunks), then its newline, then the marker: the URL at the marker push",
    chunks: [...inPieces("x".repeat(100_000), 1000), "\n", `Browse at ${URL}\n`],
    first: { at: 101, url: URL },
  },
  {
    name: "the same long line, the newline and the marker arriving together in the last chunk",
    chunks: [...inPieces("x".repeat(100_000), 1000), `\nBrowse at ${URL}\n`],
    first: { at: 100, url: URL },
  },
  { name: "a line that holds only an escape, then the marker", chunks: ["\x1b[32m\n", `Browse at ${URL}\n`], first: { at: 1, url: URL } },
  { name: "a line that holds only an escape and no newline yet, then the rest", chunks: ["\x1b[32m", `\nBrowse at ${URL}\n`], first: { at: 1, url: URL } },
  { name: "a lone carriage return before the marker", chunks: ["\r", `Browse at ${URL}\n`], first: { at: 1, url: URL } },
  { name: "a carriage return after the URL that is not followed by a newline: null", chunks: ["Browse at http://localhost:3958/\r", "\rz\n"], first: null },
  { name: "two carriage returns before the newline", chunks: ["Browse at http://localhost:3958/\r\r\n"], first: { at: 0, url: URL } },
  { name: "a first Browse at that fails the pattern, then a real one, in one chunk", chunks: [`Browse at nowhere\nBrowse at ${URL}\n`], first: { at: 0, url: URL } },
  { name: "a first Browse at that fails the pattern, then a real one, in two chunks: the answer comes with the second", chunks: ["Browse at nowhere\n", `Browse at ${URL}\n`], first: { at: 1, url: URL } },
  { name: "a failing Browse at and a real one on the same line", chunks: [`Browse at Browse at ${URL}\n`], first: { at: 0, url: URL } },
  { name: "two marker lines in one chunk: the first", chunks: ["Browse at http://first/\nBrowse at http://second/\n"], first: { at: 0, url: "http://first/" } },
  { name: "a marker line and the start of a second one in one chunk: the URL, at once", chunks: ["Browse at http://first/\nBrowse at http://sec"], first: { at: 0, url: "http://first/" } },
  { name: "a marker line with the beginning of the next line in the same chunk, whose newline comes later", chunks: ["noise\nBrowse at http://", "first/\nmore"], first: { at: 1, url: "http://first/" } },
  { name: "empty chunks between the pieces change nothing", chunks: ["", "Browse at ", "", "http://localhost:3958/", "", "\n", ""], first: { at: 5, url: URL } },
  // A WHOLE escape spliced into a CUT one (review round, M-R44 / M-R45). Stripping is ONE pass over the joined text: the inner escape goes, and the outer one's two pieces meet and read as an escape that no second pass removes. A scanner that
  // strips the new text, or the text it keeps, BEFORE the join strips twice and answers differently, so these are the cases that pin "the pieces are joined first, raw, and stripped once".
  { name: "a whole escape spliced into a cut one inside the marker: the pieces left are not stripped again, so no marker: null", chunks: ["Brow\x1b[0\x1b[0mmse at http://x\n"], first: null },
  { name: "the same with the cut escape ending one chunk and the whole one starting the next: null", chunks: ["Brow\x1b[0", "\x1b[0mmse at http://x\n"], first: null },
  { name: "the same in the kept tail after a newline, completed by the next chunk: null", chunks: ["x\nBrow\x1b[0\x1b[0m", "mse at http://x\n"], first: null },
  { name: "a whole escape spliced into a cut one at the end of the URL: the answer keeps the pieces left (ESC [ 0 m)", chunks: ["Browse at http://x\x1b[0\x1b[0mm\n"], first: { at: 0, url: "http://x\x1b[0m" } },
  { name: "the same in the kept tail after a newline, its newline in the next chunk", chunks: ["x\nBrowse at http://x\x1b[0\x1b[0mm", "\n"], first: { at: 1, url: "http://x\x1b[0m" } },
  { name: "no chunks at all", chunks: [], first: null },
  { name: "noise lines only: null at every push", chunks: ["processing file: sample.qmd\n", "Output created: sample.html\n", "\x1b[32mWatching files for changes\x1b[39m\n"], first: null },
];

describe("Session 341 — the named cases (the first answer is the one the old spelling gave)", () => {
  it.each(CASES.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    expect(oldFirst(c.chunks)).toEqual(c.first);
    expect(scannerFirst(c.chunks)).toEqual(c.first);
  });

  it("answers null at every push before the first answer, for every case", () => {
    // "The first answer" is the OLD spelling's (`c.first`, which the row above checks against the old spelling), not the scanner's own: cut at the scanner's own first non-null answer the slice would be null by definition and the row could not fail.
    for (const c of CASES) {
      const got = answers(c.chunks);
      const before = c.first === null ? got.length : c.first.at;
      expect({ case: c.name, answers: got.slice(0, before) }).toEqual({ case: c.name, answers: new Array<null>(before).fill(null) });
    }
  });
});

// ---- LONG MARKER LINES. Every Browse at line of the named cases and of the seeded documents is under 400 characters, and the one long line of the named cases is noise ("x"). A scanner that BOUNDS the unfinished line it keeps (the obvious
// memory-saving variant of the cure: keep the last 64 KiB, or the first, or cap the pieces) answers the same on all of those and loses a marker whose line is longer than its cap, while `parseBrowseUrl` has no cap: the whole line is the
// URL. So each row sends ONE line, in chunks of one size, and its newline alone in the last chunk; the answer is the whole URL at that last push. The oracle is `parseBrowseUrl` called ONCE (without the newline: null; with it: the URL):
// the old spelling's call per chunk costs the pushes times the length, about 10^11 steps for one-byte chunks. Before the last push every pushed text is a prefix of the line, which holds no newline, so the old spelling is null there. ----
type LongLine = { name: string; noise: number; body: number; sizes: number[] };

const LONG_LINES: LongLine[] = [
  { name: "a URL of 200,000 characters (3x 64 KiB)", noise: 0, body: 200_000, sizes: [1, 1_000, 4_096, 65_536] },
  { name: "a URL of 1,100,000 characters (more than 1 MiB)", noise: 0, body: 1_100_000, sizes: [1, 4_096, 65_536] },
  { name: "the marker after 200,000 characters of noise on its line", noise: 200_000, body: 0, sizes: [1, 4_096] },
  { name: "the marker after 200,000 characters of noise, then a URL of 200,000 characters", noise: 200_000, body: 200_000, sizes: [1, 4_096] },
];

describe("Session 341 — a Browse at line far longer than any cap, in chunks of one size, then its newline: the whole URL, at the newline", () => {
  const rows = LONG_LINES.flatMap((long) => long.sizes.map((size) => [long.name, size, long] as const));

  it.each(rows)("%s, in chunks of %i character(s)", (_name, size, long) => {
    const url = `http://x/${"y".repeat(long.body)}`;
    const line = `${"x".repeat(long.noise)}Browse at ${url}`;
    const chunks = [...inPieces(line, size), "\n"];
    const got = scannerFirst(chunks);
    // Numbers and flags, so that a failure does not print a megabyte.
    expect({ at: got?.at, length: got?.url.length, whole: got?.url === url }).toEqual({ at: chunks.length - 1, length: url.length, whole: true });
    // The oracle, once: no newline, no answer; with the newline, the same URL.
    expect(parseBrowseUrl(line) === null).toBe(true);
    expect(parseBrowseUrl(chunks.join("")) === url).toBe(true);
  });
});

// ---- THE ENUMERATIONS: every string of up to N tokens, every split of it into 1 to 3 chunks (empty chunks included). ----

/** Every way to cut `text` into exactly one, two or three chunks (a cut may fall anywhere, so a chunk may be empty): 1 + (n + 1) + (n + 1)(n + 2) / 2 splits for n characters. */
function* everySplit(text: string): Generator<string[]> {
  yield [text];
  for (let a = 0; a <= text.length; a++) {
    yield [text.slice(0, a), text.slice(a)];
    for (let b = a; b <= text.length; b++) {
      yield [text.slice(0, a), text.slice(a, b), text.slice(b)];
    }
  }
}

type Count = { compared: number; answered: number; answeredAt: number[]; disagreements: string[] };

/** Compare the scanner with the old spelling over every split of every string: how many pairs were compared, how many the OLD spelling answered at all, at which push (0, 1 or 2), and the first few disagreements. */
function compareAll(strings: Iterable<string>): Count {
  let compared = 0;
  let answered = 0;
  const answeredAt = [0, 0, 0];
  const disagreements: string[] = [];
  for (const text of strings) {
    for (const chunks of everySplit(text)) {
      const expected = oldFirst(chunks);
      compared++;
      if (expected !== null) {
        answered++;
        answeredAt[expected.at]++;
      }
      const got = scannerFirst(chunks);
      if ((got?.at !== expected?.at || got?.url !== expected?.url) && disagreements.length < 5) {
        disagreements.push(`${JSON.stringify(chunks)}: old ${JSON.stringify(expected)}, now ${JSON.stringify(got)}`);
      }
    }
  }
  return { compared, answered, answeredAt, disagreements };
}

// The enumerations take a few seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// E1: the marker, the blanks that may follow it, a carriage return, a newline, a URL and noise. Up to five tokens: "Browse at", blank, URL and "\n" make the marker line, "\r" makes the CRLF line.
const E1_TOKENS = ["Browse at", " ", "\t", "\r", "\n", "http://x", "x"];
// E2 is not a token enumeration: the line `Browse at http://x\n` with TWO of these put in it, at any two places (the first at or before the second): a whole SGR escape, a cut one (a bare ESC, an ESC and a
// bracket, an ESC, a bracket and a digit), the tail of one with no ESC, and an escape with two parameters. Every cut of the marker and of the URL falls inside or beside an escape somewhere.
const E2_BASE = "Browse at http://x\n";
const E2_INSERTS = ["\x1b[0m", "\x1b[3m", "\x1b[", "\x1b", "[0m", "\x1b[32;1m"];
// E3: the whole marker line as one token beside the characters an escape is made of, so that broken escapes sit before, after and between marker lines.
const E3_TOKENS = ["Browse at http://x\n", "\x1b", "[", "3", "m", "x"];
const MAX_TOKENS = 5;
// E5 (review round, M-R44 / M-R45): the line `x\nBrowse at http://x\n` (a line before the marker, so that a kept tail follows a newline) with ONE spliced escape put in at any place. A spliced escape is a whole escape inside another one, at every cut of
// the outer one: `ESC`, `ESC [`, `ESC [ 0` around a whole `ESC [ 0 m`, and `ESC`, `ESC [`, `ESC [ 3`, `ESC [ 3 2` around a whole `ESC [ 3 9 m` of the longer `ESC [ 3 2 m`. E2 cannot reach these: it puts its two inserts into the base line, side by side or apart, never one inside the other.
const E5_BASE = "x\nBrowse at http://x\n";
const splices = (outer: string, inner: string): string[] => Array.from({ length: outer.length - 1 }, (_, i) => outer.slice(0, i + 1) + inner + outer.slice(i + 1));
const E5_INSERTS = [...splices("\x1b[0m", "\x1b[0m"), ...splices("\x1b[32m", "\x1b[39m")];

/** The base line with ONE of the inserts put at every place of it. */
function* everyInsertion1(base: string, inserts: readonly string[]): Generator<string> {
  for (let i = 0; i <= base.length; i++) {
    for (const x of inserts) {
      yield base.slice(0, i) + x + base.slice(i);
    }
  }
}

/** The base line with `x` put at place `i` and `y` at place `j` (of the BASE, i <= j), for every `x` and `y` of the list. */
function* everyInsertion(base: string, inserts: readonly string[]): Generator<string> {
  for (let i = 0; i <= base.length; i++) {
    for (let j = i; j <= base.length; j++) {
      for (const x of inserts) {
        for (const y of inserts) {
          yield base.slice(0, i) + x + base.slice(i, j) + y + base.slice(j);
        }
      }
    }
  }
}

// What the old spelling answered over each enumeration, recounted by `tools/preview-scan-count/count_answers.py` (which shares no code with this file; E5 by the recipe in its docstring, which calls the script's own functions): pairs compared,
// pairs the old spelling ever answered, and how many of those at the first, the second and the third push.
const ENUMERATIONS: Array<{ label: string; strings: () => Iterable<string>; compared: number; answered: number; answeredAt: number[] }> = [
  { label: "E1: the marker, blanks, CR, LF, a URL and noise (up to five tokens)", strings: () => everyString(E1_TOKENS, MAX_TOKENS), compared: 3_631_958, answered: 13_028, answeredAt: [392, 2652, 9984] },
  { label: "E2: the marker line with two escapes, whole or cut, put in at any two places", strings: () => everyInsertion(E2_BASE, E2_INSERTS), compared: 3_096_450, answered: 1_283_674, answeredAt: [16_497, 188_017, 1_079_160] },
  { label: "E3: the whole marker line beside the characters of an escape (up to five tokens)", strings: () => everyString(E3_TOKENS, MAX_TOKENS), compared: 3_221_508, answered: 3_118_725, answeredAt: [716_475, 1_192_650, 1_209_600] },
  { label: "E5: the marker line with ONE spliced escape (a whole escape inside another), put in at any place", strings: () => everyInsertion1(E5_BASE, E5_INSERTS), compared: 82_104, answered: 22_392, answeredAt: [582, 3_748, 18_062] },
];

describe("Session 341 — every split into one to three chunks of every string of an enumeration, against the old spelling", () => {
  it.each(ENUMERATIONS.map((e) => [e.label, e] as const))(
    "%s: the first answer is the old spelling's, at the same push",
    (_label, e) => {
      const result = compareAll(e.strings());
      expect(result.disagreements).toEqual([]);
      expect(result.compared).toBe(e.compared);
      expect(result.answered).toBe(e.answered);
      expect(result.answeredAt).toEqual(e.answeredAt);
    },
    HEAVY_ROW_MS,
  );
});

// ---- THE SEEDED DIFFERENTIAL: documents of up to eight lines (noise, marker lines with escapes sprinkled in, broken markers, escape-only lines, long lines), the last one often without its newline, cut at random. ----
const SEED = 341;
const SEEDED_COUNT = 30_000;
const SGRS = ["\x1b[32m", "\x1b[39m", "\x1b[4m", "\x1b[0m", "\x1b[1;31m", "\x1b[", "\x1b"];
const NOISE = ["processing file: sample.qmd", "Output created: sample.html", "Watching files for changes", "  1/12 [unnamed-chunk-1]", "Browse", " at", "Browse at", "http://localhost:3958/", ""];
const BLANKS = ["", " ", "\t", " \t ", "\r", "\r\r"];
const GAPS = [" ", "\t", "  "];
const URLS = ["http://localhost:3958/", "https://x.y/z", "http://a", "https://localhost:1/#f"];
const BROKEN = ["Browse at ftp://z/\n", "Browse athttp://x/\n", "Browse at http://\n", "Browse at http://x/ y\n", "browse at http://x/\n", "Browse at http://x/\rz\n", "Browse at http://x/"];

const draw = (rand: () => number, size: number): number => Math.floor(rand() * size);

function seededLine(rand: () => number): string {
  const kind = draw(rand, 5);
  let line = "";
  if (kind === 0) {
    for (let i = 1 + draw(rand, 3); i > 0; i--) {
      line += NOISE[draw(rand, NOISE.length)];
      if (rand() < 0.3) line += SGRS[draw(rand, SGRS.length)];
    }
    return line + "\n";
  }
  if (kind === 1) {
    if (rand() < 0.3) line += NOISE[draw(rand, NOISE.length)] + " ";
    line += "Browse at";
    if (rand() < 0.3) line += SGRS[draw(rand, SGRS.length)];
    line += GAPS[draw(rand, GAPS.length)];
    if (rand() < 0.3) line += SGRS[draw(rand, SGRS.length)];
    line += URLS[draw(rand, URLS.length)];
    if (rand() < 0.3) line += SGRS[draw(rand, SGRS.length)];
    line += BLANKS[draw(rand, BLANKS.length)];
    return line + "\n";
  }
  if (kind === 2) return BROKEN[draw(rand, BROKEN.length)];
  if (kind === 3) {
    line = SGRS[draw(rand, SGRS.length)];
    if (rand() < 0.5) line += "\n";
    return line;
  }
  return "x".repeat(1 + draw(rand, 400)) + "\n";
}

/** A document and the end of each of its chunks (so that the chunks are `text.slice(previousEnd, end)`). */
function seededDocument(rand: () => number): { text: string; ends: number[] } {
  let text = "";
  for (let i = 1 + draw(rand, 8); i > 0; i--) text += seededLine(rand);
  if (rand() < 0.33 && text.endsWith("\n")) text = text.slice(0, -1);
  let mode = draw(rand, 3);
  if (mode === 0 && text.length > 120) mode = 1;
  if (mode === 0) return { text, ends: Array.from({ length: text.length }, (_, i) => i + 1) };
  if (mode === 1) {
    const cuts: number[] = [];
    for (let i = 1 + draw(rand, 10); i > 0; i--) cuts.push(draw(rand, text.length + 1));
    cuts.sort((a, b) => a - b);
    return { text, ends: [...cuts, text.length] };
  }
  const size = 1 + draw(rand, 64);
  const ends: number[] = [];
  for (let at = 0; at < text.length; at += size) ends.push(Math.min(at + size, text.length));
  if (ends.length === 0) ends.push(0);
  return { text, ends };
}

describe("Session 341 — seeded random documents, cut at random, against the old spelling", () => {
  it(
    `${SEEDED_COUNT.toLocaleString("en-US")} documents (seed ${SEED}): the first answer is the old spelling's, at the same push`,
    () => {
      const rand = seededRandom(SEED);
      let answered = 0;
      let atSum = 0;
      const disagreements: string[] = [];
      for (let n = 0; n < SEEDED_COUNT; n++) {
        const { text, ends } = seededDocument(rand);
        const chunks: string[] = [];
        let previous = 0;
        for (const end of ends) {
          chunks.push(text.slice(previous, end));
          previous = end;
        }
        const expected = oldFirst(chunks);
        if (expected !== null) {
          answered++;
          atSum += expected.at;
        }
        const got = scannerFirst(chunks);
        if ((got?.at !== expected?.at || got?.url !== expected?.url) && disagreements.length < 5) {
          disagreements.push(`${JSON.stringify(chunks)}: old ${JSON.stringify(expected)}, now ${JSON.stringify(got)}`);
        }
      }
      expect(disagreements).toEqual([]);
      // Recounted by `tools/preview-scan-count/count_answers.py` (E4): about half of the documents are answered, so both outcomes are read.
      expect(answered).toBe(15_271);
      expect(atSum).toBe(131_834);
    },
    HEAVY_ROW_MS,
  );
});
