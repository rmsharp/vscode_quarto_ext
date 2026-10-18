import { describe, expect, it } from "vitest";
import { findHeadings, htmlCommentOpenAt } from "../../src/core/qmd/model";
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
const REPEAT_LINES = 20_000;
const REPEAT_ASKS = 2_000;
const REPEAT_LIMIT_MS = 100;

/**
 * How many (document, line asked) pairs the OLD spelling answers `true` for, in ascending order: a comparison cannot pass by both answering `false` everywhere. The first three are counted again by a separate
 * implementation of the old algorithm (Python, `str.find`; 8,803 over 488,281 documents, 640,029 over 349,525, 176,328 over 55,987); the seeded one is counted from the old spelling here alone.
 */
const ANSWERED = { characters: 8_803, tokens: 640_029, lineLists: 176_328, seeded: 29_956 };

// The three alphabets of the exhaustive rows, named so that one row can pin what is in them (a letter put in place of a character leaves the string count as it is, and moves the answered count: to 0 for `!`, to 8,836 for `>`).
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
    // The markers are found by `indexOf` whatever stands beside them: a reader that skips a line indented by four spaces or a tab, or that reads only the first 1,000 or 4,096 characters of a line, answers otherwise.
    ["an opener indented by four spaces", ["    <!-- a"], 1, true],
    ["an opener indented by a tab", ["\t<!-- a"], 1, true],
    ["a closer indented by four spaces", ["<!--", "    -->"], 2, false],
    ["a closer indented by a tab", ["<!--", "\t-->"], 2, false],
    ["an opener and its closer after 5,000 characters of a line", ["x".repeat(5000) + "<!-- a --> y"], 1, false],
  ] as const)("%s", (_what, lines, line, expected) => {
    expect(oldInsideHtmlComment(lines, line)).toBe(expected);
    expect(htmlCommentOpenAt(lines)(line)).toBe(expected);
  });

  // One closure for a run of questions, the way the metadata reader asks; the answers are written out, and the rescan must give the same.
  it.each([
    ["in document order, a block after the comment closes is not inside it, and one inside it is", ["---", "a: 1", "---", "<!--", "---", "b: 2", "---", "-->", "---", "c: 3", "---"], [0, 4, 8], [false, true, false]],
    ["a line before the one it read to: it reads again from the top", ["a", "<!--", "b", "-->", "c", "<!--"], [6, 3, 2, 4, 0, 6, 1], [true, true, true, false, false, true, false]],
    // One line back is the smallest step back: a reader that starts over only when the line is two before the cursor answers the state after both lines, `false`.
    ["the line before the one it read to, by one", ["<!--", "-->"], [2, 1], [false, true]],
    // A negative line after a read starts again too, and reads nothing: a closure that starts again only for a line at or after the first answers `true` for it.
    ["a negative line after a read", ["<!--"], [1, -1, 1], [true, false, true]],
    ["the same line again and again: the same answer", ["<!--", "a"], [2, 2, 2, 1, 1], [true, true, true, true, true]],
  ] as const)("asked %s", (_what, lines, asks, expected) => {
    const openAt = htmlCommentOpenAt(lines);
    expect(asks.map((line) => openAt(line))).toEqual(expected);
    expect(asks.map((line) => oldInsideHtmlComment(lines, line))).toEqual(expected);
  });

  // The line asked is a long way below the comment's opener, and nothing was asked before it: a reader that reads at most so many lines for one question (100, 1,000, 5,000 or 100,000) answers `false` here.
  it.each([200, 1_500, 150_000])("a comment opened %i lines above the line asked, asked first of all, is open", (gap) => {
    const lines = ["a", ...Array.from({ length: gap }, () => "x"), "<!--", "b"];
    expect(oldInsideHtmlComment(lines, gap + 2)).toBe(true);
    expect(htmlCommentOpenAt(lines)(gap + 2)).toBe(true);
  });

  // Every document of up to a length over an alphabet, every line asked from -1 to one more than the line count, in three orders, through one closure and through a fresh one for each question.
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

  // `midDocumentMetadataBlocks` is linear only because the regions it asks about come in strictly increasing order of their start line: a property of `quartoYamlRegions`, pinned here beside the reader that relies on it.
  it("the regions of a document start on strictly later lines, each after the one before ended (so the reader is asked in increasing order)", () => {
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

  // A caller that asks one line twice must not read again. No answer tells the two apart (a closure that starts over whenever the line is not later than the last one answers the same), so the clock does:
  // 2,000 asks of the last line of a 20,000-line document are 40 million line reads that way and none this way.
  it("answers the same far line 2,000 times without reading again", () => {
    const lines: string[] = [];
    for (let i = 0; i < REPEAT_LINES; i++) lines.push(i % 2 === 0 ? "a <!-- b" : "c --> d");
    const openAt = htmlCommentOpenAt(lines);
    const started = performance.now();
    let opens = 0;
    for (let ask = 0; ask < REPEAT_ASKS; ask++) {
      if (openAt(REPEAT_LINES)) opens++;
    }
    const took = performance.now() - started;
    expect(opens).toBe(0);
    expect(took).toBeLessThan(REPEAT_LIMIT_MS);
  });

  // A size of 2,000 lines would pass the rescan too (asking every line of 200,000 takes it minutes), and a letter put in an alphabet in place of a character moves the answered count but not the string count.
  it("keeps the limits, the sizes and the alphabets the rows above are built on", () => {
    expect([LINE_LIST_LIMIT, TOKEN_LIST_LIMIT, CHARACTER_LIMIT, SEEDED_DOCUMENTS, LINEAR_LINES, LINEAR_LIMIT_MS]).toEqual([6, 9, 8, 100_000, 200_000, 500]);
    expect([REPEAT_LINES, REPEAT_ASKS, REPEAT_LIMIT_MS]).toEqual([20_000, 2_000, 100]);
    expect(CHARACTER_ALPHABET).toEqual(["<", "!", "-", ">", "\n"]);
    expect(TOKEN_ALPHABET).toEqual(["<!--", "-->", "x", "\n"]);
    expect(LINE_SHAPES).toEqual(["", "x", "<!--", "-->", "<!-- -->", "--><!--"]);
  });
});

// The rows above test the helper. These test the place that asks it, through the public `findHeadings`: a `from: gfm` in a metadata block that is READ lets the pressed heading (an ATX heading on the line after
// a prose line) count, and in a block that is REFUSED it does not, so the pressed heading in `BODY` says which happened. Every answer is the parent build's (the rescan from the top), taken from a built copy of it.
describe("Session 322 — through findHeadings, a metadata block is read or refused where the rescan read or refused it", () => {
  const doc = (...lines: string[]): string => lines.join("\n") + "\n";
  const names = (text: string): string[] => findHeadings(text).map((heading) => `h${heading.level}:${heading.text}`);
  const BODY = ["", "Lead prose line.", "# Pressed Heading", "", "## Control Heading"];
  const FM = ["---", "title: Doc", "---"];
  const READ = ["h2:from: gfm", "h1:Pressed Heading", "h2:Control Heading"];
  const REFUSED = ["h2:Control Heading"];

  it.each([
    ["a block below the front matter is read", doc(...FM, "", "Prose one.", "", "---", "from: gfm", "---", ...BODY), READ],
    // The comment opens on line 0, so a reader that starts at the second line never sees it (a reader handed the lines from the first content line still does: the first content line is line 0 here).
    ["a comment that opens on line 0 holds the block", doc("<!--", "Prose one.", "", "---", "from: gfm", "---", "", "-->", ...BODY), REFUSED],
    ["control: the same document without the comment is read", doc("Prose one.", "", "---", "from: gfm", "---", ...BODY), READ],
    // The marker is in the block's OWN line, below its opener: it opens nothing above the block. Three blank lines above the front matter would move a reader that is handed the lines from the first content line.
    ["a `<!--` in the block's own line does not hold it, after three blank lines", doc("", "", "", ...FM, "", "Prose one.", "", "---", "from: gfm # <!-- note", "---", ...BODY), ["h2:from: gfm # <!-- note", "h1:Pressed Heading", "h2:Control Heading"]],
    ["a `<!--` in the block's own line does not hold it, after two blank lines", doc("", "", ...FM, "", "Prose one.", "", "---", "from: gfm # <!-- note", "---", ...BODY), ["h2:from: gfm # <!-- note", "h1:Pressed Heading", "h2:Control Heading"]],
    ["a comment opened on the line right after the front matter holds the block", doc(...FM, "<!-- c", "", "---", "from: gfm", "---", "-->", ...BODY), REFUSED],
    // The state carries from one block to the next.
    ["a block in a comment, then a block after it closed: the second is read", doc(...FM, "", "Prose one.", "", "<!--", "---", "from: markdown", "---", "-->", "", "---", "from: gfm", "---", ...BODY), READ],
    ["a block read, then a block in a comment: the first still governs", doc(...FM, "", "Prose one.", "", "---", "from: gfm", "---", "", "<!--", "---", "from: markdown", "---", "-->", ...BODY), READ],
    ["three blocks, the middle one (gfm) in a comment: it is refused and the first (markdown) governs", doc(...FM, "", "Prose one.", "", "---", "from: markdown", "---", "", "<!--", "---", "from: gfm", "---", "-->", "", "---", "note: x", "---", ...BODY), ["h2:from: markdown", "h2:note: x", "h2:Control Heading"]],
    ["a comment closed and another opened on one line above the block holds it", doc(...FM, "", "Prose one.", "", "<!-- a --> b <!-- c", "---", "from: gfm", "---", "-->", ...BODY), ["h2:<!-- a --> b <!-- c", "h2:from: gfm", "h2:Control Heading"]],
    ["a closer with no opener above is ignored: the block is read", doc(...FM, "", "Prose one.", "", "x --> y", "", "---", "from: gfm", "---", ...BODY), READ],
    ["two closed comments above: the block is read", doc(...FM, "", "<!-- a -->", "", "<!-- b -->", "", "---", "from: gfm", "---", ...BODY), READ],
    ["`<!---->` right above the block opens and closes: the block is read", doc(...FM, "", "Prose one.", "", "<!---->", "---", "from: gfm", "---", ...BODY), READ],
    // The first line of content is line 0 here, so the block on line 1 is the first one below it: a filter that drops the block on the line after the first content line loses it.
    ["a block on the line right after the first line of content is read", doc("Prose first line", "---", "from: gfm", "---", ...BODY), ["h2:Prose first line", ...READ]],
    // `...` ends a block as `---` does, and quarto reads an unterminated block's content, so the comment is the only thing that refuses this one: the question is asked of every block, terminated or not.
    ["a block closed by `...` inside a comment is refused", doc(...FM, "", "Prose one.", "", "<!--", "---", "from: gfm", "...", "-->", ...BODY), REFUSED],
    ["control: the same block closed by `...` outside a comment is read", doc(...FM, "", "Prose one.", "", "---", "from: gfm", "...", ...BODY), ["h1:Pressed Heading", "h2:Control Heading"]],
    // 1,500 lines between the first block's question and the second's: a reader that reads at most so many lines for one question never reaches the opener.
    ["a comment opened 1,500 lines above a block, after another block was asked about: the block is refused", doc(...FM, "", "Prose one.", "", "---", "from: markdown", "---", ...Array.from({ length: 1_500 }, () => ""), "<!--", "---", "from: gfm", "---", "-->", ...BODY), ["h2:from: markdown", "h2:Control Heading"]],
    ["control: the same document without the comment is read", doc(...FM, "", "Prose one.", "", "---", "from: markdown", "---", ...Array.from({ length: 1_500 }, () => ""), "---", "from: gfm", "---", ...BODY), ["h2:from: markdown", ...READ]],
  ] as const)("%s", (_what, text, expected) => {
    expect(names(text)).toEqual(expected);
  });
});
