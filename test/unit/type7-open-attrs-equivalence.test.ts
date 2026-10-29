import { describe, expect, it } from "vitest";
import { commonmarkTagLine } from "../../src/core/qmd/model";
import { LS, NBSP, PS, countCodeUnitEdits, countStrings, everyCodeUnitEdit, everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 337 — the BACKLOG item "Eight more single-line RangeError shapes and three more quadratic ones", part (3). The question "is this line a complete HTML tag alone on its line" (CommonMark's
// HTML block of type 7, asked of every line that no paragraph is open above, under `from: gfm`, `commonmark` and `commonmark_x`) was the pattern `COMMONMARK_HTML_TYPE7_OPEN` below, whose attribute list
// is the quantified group `(?:[ \t]+NAME(?:[ \t]*=[ \t]*VALUE)?)*`. V8 keeps one entry of its regex backtrack stack per repetition of a group, so a tag of 2,097,143 bare attributes (986,891 attributes
// with a value) threw `RangeError: Maximum call stack size exceeded` (bisected at `8ebce73`, a fresh process per probe) and the error reached every reader of the document. `commonmarkTagLine` reads the same
// language with an index loop. The old pattern is kept below, copied from the parent `8ebce73`, as the oracle (Learning 738), beside a reading by definition that uses no regular expression and shares no
// code with the loop: a table of states, run over every state at once, so it carries none of the loop's arguments that the grammar is deterministic. The pinned counts come from the old pattern and from
// Python 3 ports of both (`python3 -I`, no code shared with the TypeScript) and never from the code under test.

// <<< ORACLE MATERIAL (self-contained: the counting scripts bundle exactly this region)

// ---- The OLD pattern, copied from the parent `8ebce73`. ----
const OLD_TYPE7 =
  /^ {0,3}(?:<[A-Za-z][A-Za-z0-9-]*(?:[ \t]+[A-Za-z_:][A-Za-z0-9_.:-]*(?:[ \t]*=[ \t]*(?:"[^"]*"|'[^']*'|[^ \t"'=<>`]+))?)*[ \t]*\/?>|<\/[A-Za-z][A-Za-z0-9-]*[ \t]*>)[ \t]*$/;

// ---- A reading of the old pattern by DEFINITION, with no regular expression: the states of a machine that reads the line, all of them at once. ----
// The indent (0 to 3 spaces), `<`, a tag name, then any number of (blanks, an attribute name, optionally blanks, `=`, blanks and a value), blanks, an optional `/`, `>`, and blanks to the end of the line;
// or `</`, a tag name, blanks, `>` and blanks to the end of the line. A value is a double-quoted run, a single-quoted run, or a non-empty run of characters that are none of a blank, `"`, `'`, `=`, `<`, `>` and a backtick.
const I0 = 0, I1 = 1, I2 = 2, I3 = 3; // 0, 1, 2 or 3 spaces read
const T0 = 4; // `<` read
const NAME_STATE = 5; // inside the name of an open tag (also: a name is complete)
const AFTER_QUOTED = 6; // after a quoted value
const BLANK_GAP = 7; // blanks read after a complete attribute or the name: an attribute may start, or the tag may end
const ATTR_NAME_STATE = 8; // inside an attribute name (also: the attribute is complete)
const NAME_BLANK = 9; // blanks read after an attribute name: `=` may follow too
const AFTER_EQUALS = 10; // `=` and the blanks after it read
const IN_DOUBLE = 11; // inside "..."
const IN_SINGLE = 12; // inside '...'
const IN_BARE = 13; // inside an unquoted value (also: the value is complete)
const SLASH = 14; // `/` read: `>` must follow
const END = 15; // `>` and the blanks after it read: the line may end here
const CLOSE_SLASH = 16; // `</` read
const CLOSE_NAME = 17; // inside the name of a closing tag
const CLOSE_BLANK = 18; // blanks read after the name of a closing tag
const STATE_COUNT = 19;

const isBlank = (c: number): boolean => c === 32 || c === 9;
const isLetter = (c: number): boolean => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
const isDigit = (c: number): boolean => c >= 48 && c <= 57;
const isNameChar = (c: number): boolean => isLetter(c) || isDigit(c) || c === 45;
const isAttrStart = (c: number): boolean => isLetter(c) || c === 95 || c === 58;
const isAttrNameChar = (c: number): boolean => isLetter(c) || isDigit(c) || c === 95 || c === 46 || c === 58 || c === 45;
const isValueChar = (c: number): boolean => !(c === 32 || c === 9 || c === 34 || c === 39 || c === 61 || c === 60 || c === 62 || c === 96);
const bit = (...states: number[]): number => states.reduce((mask, s) => mask | (1 << s), 0);

/** The states the machine can be in after reading `c` in `state`, as a mask. */
function moves(state: number, c: number): number {
  switch (state) {
    case I0:
    case I1:
    case I2:
      return c === 32 ? bit(state + 1) : c === 60 ? bit(T0) : 0;
    case I3:
      return c === 60 ? bit(T0) : 0;
    case T0:
      return isLetter(c) ? bit(NAME_STATE) : c === 47 ? bit(CLOSE_SLASH) : 0;
    case NAME_STATE:
      return isNameChar(c) ? bit(NAME_STATE) : isBlank(c) ? bit(BLANK_GAP) : c === 47 ? bit(SLASH) : c === 62 ? bit(END) : 0;
    case AFTER_QUOTED:
      return isBlank(c) ? bit(BLANK_GAP) : c === 47 ? bit(SLASH) : c === 62 ? bit(END) : 0;
    case BLANK_GAP:
      return isBlank(c) ? bit(BLANK_GAP) : isAttrStart(c) ? bit(ATTR_NAME_STATE) : c === 47 ? bit(SLASH) : c === 62 ? bit(END) : 0;
    case ATTR_NAME_STATE:
      return isAttrNameChar(c) ? bit(ATTR_NAME_STATE) : isBlank(c) ? bit(NAME_BLANK) : c === 61 ? bit(AFTER_EQUALS) : c === 47 ? bit(SLASH) : c === 62 ? bit(END) : 0;
    case NAME_BLANK:
      return isBlank(c) ? bit(NAME_BLANK) : c === 61 ? bit(AFTER_EQUALS) : isAttrStart(c) ? bit(ATTR_NAME_STATE) : c === 47 ? bit(SLASH) : c === 62 ? bit(END) : 0;
    case AFTER_EQUALS:
      return isBlank(c) ? bit(AFTER_EQUALS) : c === 34 ? bit(IN_DOUBLE) : c === 39 ? bit(IN_SINGLE) : isValueChar(c) ? bit(IN_BARE) : 0;
    case IN_DOUBLE:
      return c === 34 ? bit(AFTER_QUOTED) : bit(IN_DOUBLE);
    case IN_SINGLE:
      return c === 39 ? bit(AFTER_QUOTED) : bit(IN_SINGLE);
    case IN_BARE:
      // a slash is a value character AND may end the tag (`<a b=c/>`): both machines run
      return (isValueChar(c) ? bit(IN_BARE) : 0) | (isBlank(c) ? bit(BLANK_GAP) : 0) | (c === 47 ? bit(SLASH) : 0) | (c === 62 ? bit(END) : 0);
    case SLASH:
      return c === 62 ? bit(END) : 0;
    case END:
      return isBlank(c) ? bit(END) : 0;
    case CLOSE_SLASH:
      return isLetter(c) ? bit(CLOSE_NAME) : 0;
    case CLOSE_NAME:
      return isNameChar(c) ? bit(CLOSE_NAME) : isBlank(c) ? bit(CLOSE_BLANK) : c === 62 ? bit(END) : 0;
    default:
      return isBlank(c) ? bit(CLOSE_BLANK) : c === 62 ? bit(END) : 0;
  }
}

let transitions: Int32Array | null = null;
function transitionTable(): Int32Array {
  if (transitions === null) {
    transitions = new Int32Array(STATE_COUNT * 0x10000);
    for (let state = 0; state < STATE_COUNT; state++) {
      for (let c = 0; c < 0x10000; c++) {
        transitions[state * 0x10000 + c] = moves(state, c);
      }
    }
  }
  return transitions;
}

/** Whether the machine can be in the state END after reading the whole line. */
function definitionTagLine(line: string): boolean {
  const table = transitionTable();
  let states = bit(I0);
  for (let i = 0; i < line.length && states !== 0; i++) {
    const c = line.charCodeAt(i);
    let next = 0;
    for (let rest = states; rest !== 0; rest &= rest - 1) {
      next |= table[(31 - Math.clz32(rest & -rest)) * 0x10000 + c];
    }
    states = next;
  }
  return (states & bit(END)) !== 0;
}

type Count = { compared: number; accepted: number; disagreements: string[] };
/** Compare the new function with the old pattern and the reading by definition over `lines`: how many were compared and how many the OLD pattern accepted. */
function compareAll(lines: Iterable<string>): Count {
  const count: Count = { compared: 0, accepted: 0, disagreements: [] };
  for (const line of lines) {
    count.compared++;
    const expected = OLD_TYPE7.test(line);
    if (expected) count.accepted++;
    const now = commonmarkTagLine(line);
    const byDefinition = definitionTagLine(line);
    if ((now !== expected || byDefinition !== expected) && count.disagreements.length < 5) {
      count.disagreements.push(`${JSON.stringify(line)}: old ${expected}, now ${now}, by definition ${byDefinition}`);
    }
    if (count.disagreements.length >= 5) {
      break; // five are reported; the rest of the enumeration would only find more of the same
    }
  }
  return count;
}

/** Every prefix followed by every string of 0..maxLength characters (or pieces) over `alphabet`. */
function* withPrefixes(prefixes: readonly string[], alphabet: readonly string[], maxLength: number): Generator<string> {
  for (const prefix of prefixes) {
    for (const tail of everyString(alphabet, maxLength)) {
      yield prefix + tail;
    }
  }
}

const AFTER_OPENER = ["<a"];
const WIDE = [" ", "\t", "/", ">", "b", "=", '"', "'", "`", "<"];
const FRAMES = ["", " ", " <a", "   <a", "    <a", "<", "</", "</a", "<1", "<a_", "<a-1"];
const FRAME_TAIL = [" ", "\t", "<", "/", ">", "a", "-", "=", '"'];
const PIECES = [" b", " b=", "c", '"c"', "'c'", " ", ">", "/>", "\t"];
const CLOSERS = ["</a"];
const CLOSER_TAIL = [" ", "\t", ">", "a", "-", "/", "1"];
const AFTER_ATTR = ["<a b"];
const ATTR_TAIL = ["=", " ", '"', "'", "c", ">", "/"];
const NAME_TAIL = [" ", "/", ">", "b", "1", "-", "_", ":", ".", "=", '"', "<"];
const ENUMERATIONS: Array<{ label: string; lines: () => Iterable<string>; compared: number; accepted: number }> = [
  { label: "`<a` and 10 characters (blank, tab, `/`, `>`, `b`, `=`, `\"`, `'`, a backtick, `<`), up to 6", lines: () => withPrefixes(AFTER_OPENER, WIDE, 6), compared: AFTER_OPENER.length * countStrings(WIDE.length, 6), accepted: 1331 },
  { label: "11 frames (an empty line, an indent of 1, 3 and 4, `<`, `</`, a closer, bad names) and 9 characters, up to 5", lines: () => withPrefixes(FRAMES, FRAME_TAIL, 5), compared: FRAMES.length * countStrings(FRAME_TAIL.length, 5), accepted: 2681 },
  { label: "`<a` and 9 attribute pieces (` b`, ` b=`, `c`, `\"c\"`, `'c'`, a blank, `>`, `/>`, a tab), up to 6", lines: () => withPrefixes(AFTER_OPENER, PIECES, 6), compared: AFTER_OPENER.length * countStrings(PIECES.length, 6), accepted: 12637 },
  { label: "`</a` and 7 characters, up to 6", lines: () => withPrefixes(CLOSERS, CLOSER_TAIL, 6), compared: CLOSERS.length * countStrings(CLOSER_TAIL.length, 6), accepted: 2256 },
  { label: "`<a b` and 7 characters, up to 6", lines: () => withPrefixes(AFTER_ATTR, ATTR_TAIL, 6), compared: AFTER_ATTR.length * countStrings(ATTR_TAIL.length, 6), accepted: 709 },
  { label: "`<a` and 12 characters of names and values (a blank, `/`, `>`, `b`, `1`, `-`, `_`, `:`, `.`, `=`, `\"`, `<`), up to 6", lines: () => withPrefixes(AFTER_OPENER, NAME_TAIL, 6), compared: AFTER_OPENER.length * countStrings(NAME_TAIL.length, 6), accepted: 4347 },
];

// Every UTF-16 code unit at every place of three tags that are, or nearly are, a tag alone on its line, in place of each character and between them: an indent, a name, blanks, an attribute name,
// a bare value, a slash and a `>`; two quoted values; a closing tag.
const HEADS = [" <a1 b-c = d/ e>\t", `<a b="c" d='e'/>`, "</a1 >"];

// A seeded sample: a lead, an opener, 0 to 6 pieces of attributes, an ending and 0 or 1 trailing pieces. The seed is written beside the counts it produces (Learning 791).
const SEEDED_COUNT = 1_000_000;
const SEED = 3371;
const LEADS = ["", "", "", " ", "  ", "   ", "    ", "\t"];
const OPENERS = ["<a", "<a", "<a", "</a", "<A-1", "<a_", "<1", "<"];
const ATTRIBUTES = [" b", " b=c", ' b="c"', " b='c'", " b = c", ' b="c d"', " b=c/", " _:.-", " ", "\t", "/", '"', "'", "=", "`", "<", ">", " 1", "x", ' b=""'];
const ENDINGS = [">", ">", ">", "/>", " />", "", ">  ", ">\t", "> x", "\r>", ">\n"];
const TRAILERS = ["", "", "", " ", "\t", "x", "\r", NBSP, LS];
function* seededTexts(seed: number, count: number): Generator<string> {
  const next = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    let text = LEADS[Math.floor(next() * LEADS.length)] + OPENERS[Math.floor(next() * OPENERS.length)];
    const parts = Math.floor(next() * 7);
    for (let part = 0; part < parts; part++) {
      text += ATTRIBUTES[Math.floor(next() * ATTRIBUTES.length)];
    }
    text += ENDINGS[Math.floor(next() * ENDINGS.length)];
    text += TRAILERS[Math.floor(next() * TRAILERS.length)];
    yield text;
  }
}
// >>> ORACLE MATERIAL

describe("Session 337 — commonmarkTagLine: a tag alone on its line is read where `COMMONMARK_HTML_TYPE7_OPEN` read it", () => {
  it.each(ENUMERATIONS.map((e) => [`every line of ${e.label}`, e] as const))("%s", (_label, e) => {
    const { disagreements, ...counts } = compareAll(e.lines());
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: e.compared, accepted: e.accepted });
  }, HEAVY_ROW_MS);

  it("every UTF-16 code unit at every place of three near-tag lines", () => {
    const { disagreements, ...counts } = compareAll(everyCodeUnitEdit(HEADS));
    expect(disagreements).toEqual([]);
    expect(counts.compared).toBe(countCodeUnitEdits(HEADS));
    expect(counts).toEqual({ compared: countCodeUnitEdits(HEADS), accepted: 853_958 });
  }, HEAVY_ROW_MS);

  it(`${SEEDED_COUNT.toLocaleString("en-US")} seeded lines (seed ${SEED})`, () => {
    const { disagreements, ...counts } = compareAll(seededTexts(SEED, SEEDED_COUNT));
    expect(disagreements).toEqual([]);
    expect(counts).toEqual({ compared: SEEDED_COUNT, accepted: 53_430 });
  }, HEAVY_ROW_MS);
});

// What each line is, stated by hand: [line, a complete tag alone on its line].
const STATED: Array<[string, boolean]> = [
  // accepted: the shapes of an open tag
  ["<a>", true], ["<a >", true], ["<a/>", true], ["<a />", true], ["<a\t/>", true], ["<A>", true], ["<a-b>", true], ["<a1>", true], ["<a-1 >", true],
  ["<a b>", true], ["<a b c>", true], ["<a  b\t c  >", true], ["<a b=c>", true], ["<a b=c/>", true], ["<a b=/>", true], ["<a b=c//>", true], ["<a b=c/ >", true], ["<a b=c/ d>", true],
  ["<a b = c>", true], ["<a b=\tc>", true], ["<a b= c d= e>", true], ["<a b=c d=e/>", true], ["<a b=é>", true], ["<a b=c\nd>", true], ["<a b=c" + NBSP + "d>", true],
  ['<a b="c">', true], ["<a b='c'>", true], ['<a b="">', true], ["<a b=''>", true], ['<a b="c d">', true], ['<a b="c" d>', true], ['<a b="c"/>', true], ["<a b='c' />", true],
  ["<a b=\"c\"  d='e'>", true], ['<a b="a>b">', true], ["<a b='\"'>", true], ['<a b="\'">', true], ['<a b="c\nd">', true], ['<a b = "c" >', true],
  ["<a _b:c.d-e0>", true], ["<a :b>", true], ["<a _>", true], ["<a b-c=d>", true], ["<a b.c=d>", true],
  // accepted: the indent and the tail
  ["   <a>", true], [" <a>", true], ["  <a b>", true], ["<a>  ", true], ["<a>\t", true], ["<a> \t ", true], ["<a b=c>  ", true],
  // accepted: a closing tag
  ["</a>", true], ["</a >", true], ["</a\t>", true], ["</a-b1 \t>  ", true], ["  </a>", true], ["</A>", true],
  // rejected: the start
  ["", false], [" ", false], ["<", false], ["<>", false], ["< a>", false], ["<1a>", false], ["<-a>", false], ["<_a>", false], ["<a_b>", false], ["<a:b>", false], ["<a.b>", false],
  ["    <a>", false], ["     <a>", false], ["\t<a>", false], [" \t<a>", false], ["x<a>", false],
  // rejected: not finished, or finished badly
  ["<a", false], ["<a ", false], ["<a b", false], ["<a b=", false], ["<a b=>", false], ["<a b= >", false], ['<a b=">', false], ["<a b='>", false], ['<a b="c>', false],
  ["<a/ >", false], ["<a / >", false], ["<a b/ >", false], ["<a//>", false], ["<a>>", false], ["<a><b>", false],
  // rejected: an attribute the grammar refuses
  ['<a b="c"d>', false], ["<a b='c'd>", false], ['<a b=c"d>', false], ["<a b=c'd>", false], ["<a b=c=d>", false], ["<a b=c<d>", false], ["<a b=c`d>", false], ["<a b==c>", false],
  ["<a =c>", false], ["<a 1b>", false], ["<a -b>", false], ["<a .b>", false], ["<a b=c d='e>", false], ["<a b='c' d=\"e>", false],
  // rejected: text, a line terminator or a non-blank space around the tag (a no-break space or a line feed INSIDE an unquoted value is a value character, and accepted above)
  ["<a>x", false], ["<a> x", false], ["<a b=c>d", false], ['<a b="c">x', false], ["<a>\r", false], ["<a>\n", false], ["<a>" + NBSP, false], ["<a>" + LS, false], ["<a>" + PS, false],
  ["<a\n>", false], ["<a\rb>", false], ["<a" + NBSP + "b>", false], ["<a b" + NBSP + ">", false],
  // rejected: a closing tag the grammar refuses
  ["</a", false], ["</a b>", false], ["</ a>", false], ["</1>", false], ["</>", false], ["</a/>", false], ["</a>>", false], ["</a>x", false], ["   </a>x", false], ["    </a>", false], ["<//a>", false],
];

describe("Session 337 — commonmarkTagLine on lines stated by hand", () => {
  it.each(STATED.map(([line, accepted]) => [JSON.stringify(line), line, accepted] as const))("%s is, by hand, by the old pattern, by the definition and by the new function: %s", (_label, line, accepted) => {
    expect([OLD_TYPE7.test(line), definitionTagLine(line), commonmarkTagLine(line)]).toEqual([accepted, accepted, accepted]);
  });

  it("states both answers often enough to mean something", () => {
    expect(STATED.length).toBe(126);
    expect(STATED.filter(([, accepted]) => accepted).length).toBe(57);
  });
});

// Long lines. The old pattern throws `RangeError` from 2,097,143 bare attributes and from 986,891 attributes with a value (`8ebce73`); the first group of rows stays under those figures, so the old pattern answers and
// all three readers are compared; the second group goes past them, where only the definition and the new function answer, and the answer is the one the definition states for the whole line.
const BELOW_BARE = 2_000_000;
const BELOW_VALUED = 900_000;
const PAST_BARE = 4_200_000;
const PAST_VALUED = 2_000_000;
const HUGE = 8_400_000;
const LONG_LIMIT_MS = 4000;
type Long = { label: string; build: () => string; accepted: boolean; oldReads: boolean };
const LONG: Long[] = [
  { label: "2,000,000 bare attributes, closed", build: () => "<a" + " b".repeat(BELOW_BARE) + ">", accepted: true, oldReads: true },
  { label: "2,000,000 bare attributes, not closed", build: () => "<a" + " b".repeat(BELOW_BARE), accepted: false, oldReads: true },
  { label: "2,000,000 bare attributes, closed with `/>` and blanks", build: () => "   <a" + " b".repeat(BELOW_BARE) + "/>  \t", accepted: true, oldReads: true },
  { label: "2,000,000 bare attributes and a quote the grammar refuses", build: () => "<a" + " b".repeat(BELOW_BARE) + '">', accepted: false, oldReads: true },
  { label: "2,000,000 bare attributes and then an attribute with no value", build: () => "<a" + " b".repeat(BELOW_BARE) + " c=>", accepted: false, oldReads: true },
  { label: "900,000 attributes with an unquoted value", build: () => "<a" + " b=c".repeat(BELOW_VALUED) + ">", accepted: true, oldReads: true },
  { label: "900,000 attributes with a double-quoted value", build: () => "<a" + ' b="c"'.repeat(BELOW_VALUED) + ">", accepted: true, oldReads: true },
  { label: "900,000 attributes with a single-quoted value", build: () => "<a" + " b='c'".repeat(BELOW_VALUED) + ">", accepted: true, oldReads: true },
  { label: "900,000 attributes with blanks around the `=`", build: () => "<a" + " b = c".repeat(BELOW_VALUED) + " />", accepted: true, oldReads: true },
  { label: "900,000 attributes whose unquoted value ends in a slash", build: () => "<a" + " b=c/".repeat(BELOW_VALUED) + ">", accepted: true, oldReads: true },
  { label: "900,000 attributes with a value, not closed", build: () => "<a" + ' b="c"'.repeat(BELOW_VALUED), accepted: false, oldReads: true },
  { label: "900,000 attributes with a value and a quote glued to the last", build: () => "<a" + ' b="c"'.repeat(BELOW_VALUED) + 'd">', accepted: false, oldReads: true },
  { label: "4,200,000 bare attributes, closed", build: () => "<a" + " b".repeat(PAST_BARE) + ">", accepted: true, oldReads: false },
  { label: "4,200,000 bare attributes, not closed", build: () => "<a" + " b".repeat(PAST_BARE), accepted: false, oldReads: false },
  { label: "4,200,000 bare attributes and a refused quote", build: () => "<a" + " b".repeat(PAST_BARE) + '">', accepted: false, oldReads: false },
  { label: "4,200,000 bare attributes, indented three spaces, closed with `/>`", build: () => "   <a" + " b".repeat(PAST_BARE) + "/>", accepted: true, oldReads: false },
  { label: "2,000,000 attributes with an unquoted value, closed", build: () => "<a" + " b=c".repeat(PAST_VALUED) + ">", accepted: true, oldReads: false },
  { label: "2,000,000 attributes with a double-quoted value, closed", build: () => "<a" + ' b="c"'.repeat(PAST_VALUED) + ">", accepted: true, oldReads: false },
  { label: "2,000,000 attributes with a single-quoted value, closed", build: () => "<a" + " b='c'".repeat(PAST_VALUED) + ">", accepted: true, oldReads: false },
  { label: "2,000,000 attributes with blanks around the `=`, closed", build: () => "<a" + " b = c".repeat(PAST_VALUED) + ">", accepted: true, oldReads: false },
  { label: "2,000,000 attributes with a value, not closed", build: () => "<a" + " b=c".repeat(PAST_VALUED), accepted: false, oldReads: false },
  { label: "8,400,000 blanks and a `>`", build: () => "<a" + " ".repeat(HUGE) + ">", accepted: true, oldReads: true },
  { label: "8,400,000 blanks and a letter", build: () => "<a" + " ".repeat(HUGE) + "x", accepted: false, oldReads: true },
  { label: "a tag name of 8,400,000 letters", build: () => "<" + "a".repeat(HUGE) + ">", accepted: true, oldReads: true },
  { label: "a closing tag name of 8,400,000 letters and blanks", build: () => "</" + "a".repeat(HUGE) + "  >", accepted: true, oldReads: true },
  { label: "an attribute name of 8,400,000 characters", build: () => "<a b" + "-".repeat(HUGE) + ">", accepted: true, oldReads: true },
  { label: "an unquoted value of 8,400,000 characters", build: () => "<a b=" + "c".repeat(HUGE) + ">", accepted: true, oldReads: true },
  { label: "a double-quoted value of 8,400,000 characters", build: () => '<a b="' + "c".repeat(HUGE) + '">', accepted: true, oldReads: true },
  { label: "a double quote that never closes, 8,400,000 characters", build: () => '<a b="' + "c".repeat(HUGE) + ">", accepted: false, oldReads: true },
  { label: "a single quote that never closes, 8,400,000 characters", build: () => "<a b='" + '"'.repeat(HUGE) + ">", accepted: false, oldReads: true },
  { label: "8,400,000 slashes", build: () => "<a" + "/".repeat(HUGE) + ">", accepted: false, oldReads: true },
  { label: "an unquoted value of 8,400,000 slashes", build: () => "<a b=" + "/".repeat(HUGE) + ">", accepted: true, oldReads: true },
  { label: "8,400,000 blanks after the `>`", build: () => "<a>" + " ".repeat(HUGE), accepted: true, oldReads: true },
  { label: "8,400,000 blanks after a closing tag", build: () => "</a>" + " ".repeat(HUGE), accepted: true, oldReads: true },
];

describe("Session 337 — commonmarkTagLine on lines of millions of characters", () => {
  it.each(LONG.map((row) => [row.label, row] as const))("%s: the answer is the stated one, from the new function and from the definition (and the old pattern where it can read the line), in linear time", (_label, row) => {
    const line = row.build();
    const started = Date.now();
    const now = commonmarkTagLine(line);
    const took = Date.now() - started;
    expect(now).toBe(row.accepted);
    expect(definitionTagLine(line)).toBe(row.accepted);
    if (row.oldReads) {
      expect(OLD_TYPE7.test(line)).toBe(row.accepted);
    }
    expect(took).toBeLessThan(LONG_LIMIT_MS);
  }, HEAVY_ROW_MS);

  it("keeps the sizes and the limit the long rows are built on", () => {
    expect([BELOW_BARE, BELOW_VALUED, PAST_BARE, PAST_VALUED, HUGE, LONG_LIMIT_MS]).toEqual([2_000_000, 900_000, 4_200_000, 2_000_000, 8_400_000, 4000]);
    expect(LONG.length).toBe(34);
    expect(LONG.filter((row) => row.oldReads).length).toBe(25);
  });
});
