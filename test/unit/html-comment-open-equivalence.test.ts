import { describe, expect, it } from "vitest";
import { htmlCommentOpenAt } from "../../src/core/qmd/model";
import { quartoYamlRegions } from "../../src/core/qmd/quarto-yaml-regions";
import { countStrings, everyString, seededRandom } from "./support/regex-equivalence";

// Session 322 — the BACKLOG item "Other regexes still quadratic on a long run of blanks, CR or U+2028", part (8). A mid-document metadata block inside an HTML comment resolves nothing, so for each block
// `midDocumentMetadataBlocks` asks whether a comment is still open at the block's first line. The first spelling answered that by scanning every line from the top of the document, for each block (blocks x lines:
// 2.9 s for 8,000 small blocks, `pathological-inputs.test.ts` has the document rows). `htmlCommentOpenAt` keeps how far it has read and whether a comment was open there, so blocks asked in document order read each
// line once between them. The old spelling is kept here, verbatim, as the oracle (Learning 738): the new one must answer what it answered for every document and every line asked, in any order.
const oldInsideHtmlComment = (lines: readonly string[], line: number): boolean => {
  let open = false;
  for (let i = 0; i < line && i < lines.length; i++) {
    for (let at = 0; at < lines[i].length; ) {
      const next = open ? lines[i].indexOf("-->", at) : lines[i].indexOf("<!--", at);
      if (next < 0) {
        break;
      }
      at = next + (open ? 3 : 4);
      open = !open;
    }
  }
  return open;
};

const LINE_LIST_LIMIT = 6;
const TOKEN_LIST_LIMIT = 9;
const CHARACTER_LIMIT = 8;
const SEEDED_DOCUMENTS = 100_000;
const LINEAR_LINES = 200_000;
const LINEAR_LIMIT_MS = 500;

/**
 * How many (document, line asked) pairs the OLD spelling answers `true` for, in ascending order: a comparison cannot pass by both answering `false` everywhere. The first three are counted again by a separate
 * implementation of the old algorithm (Python, `str.find`; 8,803 over 488,281 documents, 640,029 over 349,525, 176,328 over 55,987); the seeded one is counted from the old spelling here alone.
 */
const ANSWERED = { characters: 8_803, tokens: 640_029, lineLists: 176_328, seeded: 29_956 };

// The three alphabets of the exhaustive rows, named so that one row can pin what is in them (a letter put in place of `!` would move neither the string count nor the answered count).
const CHARACTER_ALPHABET = ["<", "!", "-", ">", "\n"];
const TOKEN_ALPHABET = ["<!--", "-->", "x", "\n"];
const LINE_SHAPES = ["", "x", "<!--", "-->", "<!-- -->", "--><!--"];

type Tally = { documents: number; compared: number; answered: number; disagreements: string[] };

/** Ask the lines of one document in three orders, each through one closure kept for the order and through a fresh closure for each question, and compare every answer with the old spelling's. Adds to `tally`. */
function compareOrders(lines: readonly string[], tally: Tally): void {
  const orders: number[][] = [];
  const ascending: number[] = [];
  for (let line = -1; line <= lines.length + 1; line++) ascending.push(line);
  orders.push(ascending);
  orders.push([...ascending].reverse());
  const zigzag: number[] = [];
  for (let low = 0, high = ascending.length - 1; low <= high; low++, high--) {
    zigzag.push(ascending[high]);
    if (low !== high) zigzag.push(ascending[low]);
  }
  orders.push(zigzag);
  orders.forEach((order, which) => {
    const shared = htmlCommentOpenAt(lines);
    for (const line of order) {
      const expected = oldInsideHtmlComment(lines, line);
      tally.compared++;
      if (which === 0 && expected) tally.answered++;
      const sharedAnswer = shared(line);
      const freshAnswer = htmlCommentOpenAt(lines)(line);
      if ((sharedAnswer !== expected || freshAnswer !== expected) && tally.disagreements.length < 5) {
        tally.disagreements.push(`${JSON.stringify(lines)} asked ${line} in order ${which}: old ${expected}, shared ${sharedAnswer}, fresh ${freshAnswer}`);
      }
    }
  });
  tally.documents++;
}

const newTally = (): Tally => ({ documents: 0, compared: 0, answered: 0, disagreements: [] });

describe("Session 322 — htmlCommentOpenAt answers what the rescan from the top answered", () => {
  it.each([
    ["no comment anywhere", ["a", "b", "c"], 3, false],
    ["a comment opened above and never closed", ["a", "<!--", "b"], 3, true],
    ["a comment opened and closed on later lines", ["<!--", "b", "-->", "c"], 4, false],
    ["asked on the line that closes it: still open, the line itself is not read", ["<!--", "b", "-->"], 2, true],
    ["asked on the line after the closer", ["<!--", "b", "-->"], 3, false],
    ["asked at line 0: nothing above", ["<!--", "-->"], 0, false],
    ["opened and closed on one line", ["a <!-- b --> c"], 1, false],
    ["closed and opened again on one line", ["<!-- a --> b <!-- c"], 1, true],
    ["a closer with no opener is ignored", ["-->", "a"], 2, false],
    ["`<!-->` opens and `-->` is not found inside it", ["<!-->", "a"], 2, true],
    ["`<!--->` opens and its closer is not found either", ["<!--->", "a"], 2, true],
    ["`<!---->` opens and closes", ["<!---->", "a"], 2, false],
    ["a second opener inside an open comment is text", ["<!--<!--", "a"], 2, true],
    ["a line past the end reads the whole document", ["<!--", "a"], 9, true],
    ["a line past the end of a closed comment", ["<!-- a -->"], 9, false],
    ["a negative line reads nothing", ["<!--"], -1, false],
    ["no lines at all", [], 3, false],
  ] as const)("%s", (_what, lines, line, expected) => {
    expect(oldInsideHtmlComment(lines, line)).toBe(expected);
    expect(htmlCommentOpenAt(lines)(line)).toBe(expected);
  });

  it("asked in document order, a block after the comment closes is not inside it, and one inside it is", () => {
    const lines = ["---", "a: 1", "---", "<!--", "---", "b: 2", "---", "-->", "---", "c: 3", "---"];
    const openAt = htmlCommentOpenAt(lines);
    expect([0, 4, 8].map((line) => openAt(line))).toEqual([false, true, false]);
  });

  it("asked a line before the one it read to, it reads again from the top", () => {
    const lines = ["a", "<!--", "b", "-->", "c", "<!--"];
    const openAt = htmlCommentOpenAt(lines);
    expect([6, 3, 2, 4, 0, 6, 1].map((line) => openAt(line))).toEqual([true, true, true, false, false, true, false]);
  });

  it("asked the same line twice, it answers the same without reading again", () => {
    const lines = ["<!--", "a"];
    const openAt = htmlCommentOpenAt(lines);
    expect([2, 2, 2, 1, 1].map((line) => openAt(line))).toEqual([true, true, true, true, true]);
  });

  // Every document of up to a length over an alphabet, every line asked from -1 to one past the end, in three orders, through one closure and through a fresh one for each question.
  it.each([
    ["up to eight characters over `<`, `!`, `-`, `>` and a line feed (the openers, the closers and the strings they overlap in)", CHARACTER_ALPHABET, CHARACTER_LIMIT, "characters"],
    ["up to nine tokens over `<!--`, `-->`, a letter and a line feed (several openers and closers on one line)", TOKEN_ALPHABET, TOKEN_LIST_LIMIT, "tokens"],
  ] as const)("agrees with the rescan on every document of %s", (_name, alphabet, maxLength, key) => {
    const tally = newTally();
    for (const text of everyString(alphabet, maxLength)) {
      compareOrders(text.split("\n"), tally);
    }
    expect(tally.disagreements).toEqual([]);
    expect(tally.documents).toBe(countStrings(alphabet.length, maxLength)); // every string of 0..maxLength characters, none skipped
    expect(tally.answered).toBe(ANSWERED[key]);
  });

  it("agrees with the rescan on every list of up to six lines, each line one of six shapes", () => {
    const tally = newTally();
    const digits = LINE_SHAPES.map((_, index) => String(index));
    for (const picks of everyString(digits, LINE_LIST_LIMIT)) {
      compareOrders([...picks].map((digit) => LINE_SHAPES[Number(digit)]), tally);
    }
    expect(tally.disagreements).toEqual([]);
    expect(tally.documents).toBe(countStrings(LINE_SHAPES.length, LINE_LIST_LIMIT));
    expect(tally.answered).toBe(ANSWERED.lineLists);
  });

  // The way the metadata reader asks: the first line of each region, strictly increasing, on documents that look like the ones people write (blocks, fences, comments, headings).
  it("agrees with the rescan on 100,000 seeded documents, asked at the start line of each region", () => {
    const random = seededRandom(322);
    const fragments = ["---", "---", "---", "from: gfm", "title: T", "format:", "  html:", "<!--", "-->", "<!-- c -->", "x <!-- y", "z --> w", "--> <!--", "<!-->", "<!--->", "text", "", "", "# H", "```{python}", "```", "> ---"];
    let answered = 0;
    let compared = 0;
    const disagreements: string[] = [];
    for (let doc = 0; doc < SEEDED_DOCUMENTS; doc++) {
      const lines: string[] = random() < 0.5 ? ["---", "title: T", "---"] : [];
      const length = 1 + Math.floor(random() * 30);
      for (let i = 0; i < length; i++) lines.push(fragments[Math.floor(random() * fragments.length)]);
      const openAt = htmlCommentOpenAt(lines);
      for (const region of quartoYamlRegions(lines.join("\n"))) {
        const expected = oldInsideHtmlComment(lines, region.startLine);
        compared++;
        if (expected) answered++;
        if (openAt(region.startLine) !== expected && disagreements.length < 5) disagreements.push(`${JSON.stringify(lines)} at ${region.startLine}`);
      }
    }
    expect(disagreements).toEqual([]);
    expect(compared).toBeGreaterThan(SEEDED_DOCUMENTS);
    expect(answered).toBe(ANSWERED.seeded);
  });

  // The reading never starts again only because the regions come in strictly increasing order of their start line (`midDocumentMetadataBlocks` relies on it for the linear cost).
  it("is asked in increasing order: the regions of a document start on strictly later lines, and each starts after the one before ended", () => {
    const random = seededRandom(3220);
    const fragments = ["---", "---", "from: gfm", "text", "", "```{python}", "```", "```", "...", "<!--", "-->"];
    for (let doc = 0; doc < 20_000; doc++) {
      const lines: string[] = [];
      const length = 1 + Math.floor(random() * 30);
      for (let i = 0; i < length; i++) lines.push(fragments[Math.floor(random() * fragments.length)]);
      const regions = quartoYamlRegions(lines.join("\n"));
      for (let i = 1; i < regions.length; i++) {
        expect(regions[i].startLine).toBeGreaterThan(regions[i - 1].endLine);
      }
    }
  });

  // The rescan is quadratic here (200,000 lines, each asked: 2 x 10^10 line reads); the reading that keeps its place does 200,000.
  it("answers every line of a 200,000-line document asked in order in linear time", () => {
    const lines: string[] = [];
    for (let i = 0; i < LINEAR_LINES; i++) lines.push(i % 2 === 0 ? "a <!-- b" : "c --> d");
    const openAt = htmlCommentOpenAt(lines);
    const started = performance.now();
    let opens = 0;
    for (let line = 0; line <= LINEAR_LINES; line++) {
      if (openAt(line)) opens++;
    }
    const took = performance.now() - started;
    expect(opens).toBe(LINEAR_LINES / 2);
    expect(took).toBeLessThan(LINEAR_LIMIT_MS);
  });

  // A limit of 100 s, or 2,000 lines, would pass the rescan too, and a letter put in an alphabet in place of a character moves neither its string count nor its answered count.
  it("keeps the limits, the sizes and the alphabets the rows above are built on", () => {
    expect([LINE_LIST_LIMIT, TOKEN_LIST_LIMIT, CHARACTER_LIMIT, SEEDED_DOCUMENTS, LINEAR_LINES, LINEAR_LIMIT_MS]).toEqual([6, 9, 8, 100_000, 200_000, 500]);
    expect(CHARACTER_ALPHABET).toEqual(["<", "!", "-", ">", "\n"]);
    expect(TOKEN_ALPHABET).toEqual(["<!--", "-->", "x", "\n"]);
    expect(LINE_SHAPES).toEqual(["", "x", "<!--", "-->", "<!-- -->", "--><!--"]);
  });
});
