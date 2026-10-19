import { describe, expect, it } from "vitest";
import {
  HEADING_BLOCK_MACRO_ANY,
  HEADING_BLOCK_MACRO_ARG,
  HEADING_BLOCK_MACRO_BARE,
  HEADING_BLOCK_TAG_CLOSE,
  HEADING_BLOCK_TAG_OPEN,
  headingContentRefused,
} from "../../src/core/qmd/model";
import { countStrings, everyString, seededRandom } from "./support/regex-equivalence";

// Session 325 — the BACKLOG item "Nine more single-line overflow and slow-input families, none of them in Session 317's diff", part (2) (and part (3) of the Session 319 item, the same function).
// `headingContentRefused` scans a heading's text for a block token that pandoc's inline parser refuses, skipping what a code span, a bracketed group, a macro argument, a comment, a CDATA section, a processing
// instruction, a tag's quoted attribute or a shortcode swallows. It asked each opener where its closer was by reading on, and where none came it moved one character on, so each opener reread the line.
// It now asks a `HeadingLine` (per-line tables built once). That is only sound if the answer is the SAME on EVERY text, so the old functions are kept below, copied from the parent `4172926` (Session 324's source
// plus the `export` keywords) by a script and renamed `old...` (the bodies are the parent's, character for character), as the oracle (Learning 738).
// `escapable` and the two flags are inputs, so each string is tried under a mixed rotation of twelve variants: four escapable sets (every symbol and punctuation mark, which is what a document with no `from:` uses; Markdown.pl's
// set plus `>`, which `markdown_strict` and `markdown_phpextra` use; CommonMark's; and one that lets a backslash escape only a backslash, which is how a bracket comes to stand right after a backslash and still open) and
// three flag pairs (both gates, HTML only, TeX only).

// ---- The OLD scan, copied from the parent `4172926` (Session 324's HEAD) by a script; only the names changed (old...) and the tables are imported. ----
interface OldAngle {
  readonly next: number;
  readonly name: string | null;
  readonly closing: boolean;
}

function oldHeadingGroupEnd(text: string, i: number, open: string, close: string): number {
  let depth = 0;
  for (let j = i; j < text.length; j++) {
    const c = text[j];
    if (c === "\\") {
      j++;
      continue;
    }
    if (c === open) {
      depth++;
    } else if (c === close) {
      depth--;
      if (depth === 0) {
        return j;
      }
    }
  }
  return -1;
}

function oldHeadingMacroArgumentsEnd(text: string, i: number): number {
  let j = i;
  for (;;) {
    let k = j;
    while (k < text.length && (text[k] === " " || text[k] === "\t")) {
      k++;
    }
    const open = text[k];
    if (open !== "[" && open !== "{") {
      return j;
    }
    const end = oldHeadingGroupEnd(text, k, open, open === "[" ? "]" : "}");
    if (end === -1) {
      return j;
    }
    j = end + 1;
  }
}

function oldHeadingMacroHasBracedArgument(text: string, i: number): boolean {
  let k = i;
  for (;;) {
    while (k < text.length && (text[k] === " " || text[k] === "\t")) {
      k++;
    }
    if (text[k] !== "[") {
      break;
    }
    const end = oldHeadingGroupEnd(text, k, "[", "]");
    if (end === -1) {
      return false;
    }
    k = end + 1;
  }
  return text[k] === "{" && oldHeadingGroupEnd(text, k, "{", "}") !== -1;
}

function oldHeadingCodeSpanEnd(text: string, i: number): number {
  let run = 0;
  while (i + run < text.length && text[i + run] === "`") {
    run++;
  }
  let j = i + run;
  while (j < text.length) {
    if (text[j] !== "`") {
      j++;
      continue;
    }
    let k = j;
    while (k < text.length && text[k] === "`") {
      k++;
    }
    if (k - j === run) {
      return k;
    }
    j = k;
  }
  return i + 1;
}

function oldHeadingMathEnd(text: string, i: number): number {
  const delim = text.startsWith("$$", i) ? "$$" : "$";
  const close = text.indexOf(delim, i + delim.length);
  return close === -1 ? i + 1 : close + delim.length;
}

function oldHeadingBracketedEnd(text: string, i: number): number {
  const end = oldHeadingGroupEnd(text, i, "[", "]");
  if (end === -1) {
    return i + 1;
  }
  const next = text[end + 1];
  if (next === "(" || next === "[" || next === "{") {
    const close = oldHeadingGroupEnd(text, end + 1, next, next === "(" ? ")" : next === "[" ? "]" : "}");
    if (close !== -1) {
      return close + 1;
    }
  }
  return end + 1;
}

function oldHeadingAngleEnd(text: string, i: number): OldAngle {
  const none = (next: number): OldAngle => ({ next, name: null, closing: false });
  const skipTo = (marker: string, from: number): OldAngle => {
    const close = text.indexOf(marker, from);
    return none(close === -1 ? i + 1 : close + marker.length);
  };
  if (text.startsWith("<!--", i)) {
    return skipTo("-->", i + 4);
  }
  if (text.startsWith("<![CDATA[", i)) {
    return skipTo("]]>", i + 9);
  }
  if (text.startsWith("<?", i)) {
    return skipTo("?>", i + 2);
  }
  let j = i + 1;
  const closing = text[j] === "/";
  if (closing) {
    j++;
  }
  if (j >= text.length || !/[a-zA-Z]/.test(text[j])) {
    return none(i + 1);
  }
  const nameStart = j;
  while (j < text.length && text[j] !== " " && text[j] !== "\t" && text[j] !== "/" && text[j] !== ">") {
    j++;
  }
  const name = text.slice(nameStart, j);
  let quote: string | null = null;
  for (; j < text.length; j++) {
    const c = text[j];
    if (quote !== null) {
      if (c === quote) {
        quote = null;
      }
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === ">") {
      return { next: j + 1, name, closing };
    }
  }
  return none(i + 1);
}

function oldHeadingContentRefused(
  text: string,
  blockHtml: boolean,
  blockTex: boolean,
  escapable: RegExp,
): boolean {
  if (!blockHtml && !blockTex) {
    return false;
  }
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "`") {
      i = oldHeadingCodeSpanEnd(text, i);
      continue;
    }
    if (c === "$") {
      i = oldHeadingMathEnd(text, i);
      continue;
    }
    if (c === "[") {
      i = oldHeadingBracketedEnd(text, i);
      continue;
    }
    if (c === "{" && text.startsWith("{{<", i)) {
      const close = text.indexOf(">}}", i);
      i = close === -1 ? i + 1 : close + 3;
      continue;
    }
    if (c === "<") {
      const angle = oldHeadingAngleEnd(text, i);
      if (
        blockHtml &&
        angle.name !== null &&
        (angle.closing
          ? angle.name.toLowerCase() !== "script" && HEADING_BLOCK_TAG_CLOSE.test(angle.name)
          : HEADING_BLOCK_TAG_OPEN.test(angle.name))
      ) {
        return true;
      }
      i = angle.next;
      continue;
    }
    if (c === "\\") {
      const next = text[i + 1];
      if (next !== undefined && escapable.test(next)) {
        i += 2;
        continue;
      }
      if (next !== undefined && /[a-zA-Z]/.test(next)) {
        let end = i + 1;
        while (end < text.length && /[a-zA-Z]/.test(text[end])) {
          end++;
        }
        let name = text.slice(i + 1, end);
        if (text[end] === "*") {
          name += "*";
          end++;
        }
        if (
          blockTex &&
          (HEADING_BLOCK_MACRO_ANY.test(name) ||
            HEADING_BLOCK_MACRO_BARE.test(name) ||
            (HEADING_BLOCK_MACRO_ARG.test(name) && oldHeadingMacroHasBracedArgument(text, end)))
        ) {
          return true;
        }
        i = oldHeadingMacroArgumentsEnd(text, end);
        continue;
      }
      i += 1;
      continue;
    }
    i += 1;
  }
  return false;
}


const ESCAPABLE_LEGACY = /[!#()*+\-.>[\\\]_`{}]/; // Markdown.pl's set plus `>`: markdown_strict, markdown_phpextra
const ESCAPABLE_ASCII_PUNCTUATION = /[!-/:-@[-`{-~]/; // CommonMark's
const ESCAPABLE_ALL_SYMBOLS = /[\p{P}\p{S}]/u; // pandoc's all_symbols_escapable: what a document with no `from:` uses
const ESCAPABLE_BACKSLASH_ONLY = /[\\]/;
interface Variant {
  readonly escapable: RegExp;
  readonly blockHtml: boolean;
  readonly blockTex: boolean;
}
const VARIANTS: Variant[] = [];
for (const escapable of [ESCAPABLE_ALL_SYMBOLS, ESCAPABLE_LEGACY, ESCAPABLE_ASCII_PUNCTUATION, ESCAPABLE_BACKSLASH_ONLY]) {
  for (const [blockHtml, blockTex] of [[true, true], [true, false], [false, true]] as const) {
    VARIANTS.push({ escapable, blockHtml, blockTex });
  }
}

/** The variant a string of the enumeration is tried under: a hash of its place, because the place alone (index modulo the count) made the variant a function of the LAST token for an alphabet of nine, and a third of those strings could not disagree. */
const variantAt = (index: number): Variant => VARIANTS[(Math.imul(index, 0x9e3779b1) >>> 0) % VARIANTS.length];

/** Both scans on every string, each under the next variant in the rotation (or under every variant): how many were compared, how many the OLD scan refuses, and the first few disagreements. */
function compareScans(
  strings: Iterable<string>,
  underEveryVariant: boolean,
  scan: (text: string, blockHtml: boolean, blockTex: boolean, escapable: RegExp) => boolean = headingContentRefused,
): { compared: number; refused: number; disagreements: string[] } {
  let compared = 0;
  let refused = 0;
  const disagreements: string[] = [];
  let index = 0;
  for (const text of strings) {
    for (const variant of underEveryVariant ? VARIANTS : [variantAt(index)]) {
      const expected = oldHeadingContentRefused(text, variant.blockHtml, variant.blockTex, variant.escapable);
      compared++;
      if (expected) {
        refused++;
      }
      if (scan(text, variant.blockHtml, variant.blockTex, variant.escapable) !== expected && disagreements.length < 5) {
        disagreements.push(JSON.stringify([text, VARIANTS.indexOf(variant)]));
      }
    }
    index++;
  }
  return { compared, refused, disagreements };
}

// The alphabets are TOKENS, not characters: a token is what the scan reacts to. Every alphabet holds something the scan refuses (a block tag, or the front of one, or a block macro) so that a skip which goes wrong shows as a flipped answer.
// CODE: backtick runs of one and two, a plain letter, a backslash (it escapes a backtick, which puts the scan in the MIDDLE of a run) and a block tag.
// GROUPS: every bracket of the three kinds, a backslash, a letter and a block tag. MACROS: the three macro classes (`\a` is none, `\par` is bare, `\section` takes a braced argument), a blank, and the two bracket kinds a macro takes.
// MARKERS: every opener and closer of a comment, a CDATA section, a processing instruction and a shortcode, with the single characters that make a marker overlap itself. TAGS: an opener, a lone `<`, a `>`, both quotes,
// a blank, a slash, the front of a block tag and the front of a closing `</script`, the one closing tag that refuses nothing (so it is a near miss, not a block tag).
const ALPHABET_CODE = ["`", "``", "a", "\\", "<section>"];
const ALPHABET_GROUPS = ["[", "]", "(", ")", "{", "}", "\\", "a", "<section>"];
const ALPHABET_MACROS = ["\\a", "\\par", "\\section", " ", "[", "]", "{", "}"];
const ALPHABET_MARKERS = ["<!--", "-->", "<![CDATA[", "]]>", "<?", "?>", "{{<", ">}}", "<section>", "a", "-", "]", ">"];
const ALPHABET_TAGS = ["<a", "<", ">", '"', "'", " ", "/", "<section", "</script"];
// The extra tokens are the near misses the review round found unpinned (Session 325): half-openers of a comment and a CDATA section, an upper-case letter, a digit, a star, a form feed, a no-break space, an upper-case tag, a macro name
// with a capital, a digit or a star, a macro of the ANY class.
const SEEDED_TOKENS = [
  ...new Set([
    ...ALPHABET_CODE, ...ALPHABET_GROUPS, ...ALPHABET_MACROS, ...ALPHABET_MARKERS, ...ALPHABET_TAGS,
    "$", "$$", "</div", "<div", "\t", "=", "x", "\\texttt", "<b>",
    "!", "<!-", "<![", "<![CDATA", "A", "1", "*", "\f", "\u00a0", "<SECTION>", "</SCRIPT>", "\\Foo", "\\parX", "\\par1", "\\section*", "\\caption*", "\\maketitle",
  ]),
];
// One token of each family, for the strings that are tried under EVERY variant.
const ALPHABET_EVERY_VARIANT = ["`", "\\", "[", "]", "(", ")", "{", "}", "\\par", "<section>", "<!--", "-->", "<a", ">", '"', "{{<"];
const SEEDED_STRINGS = 500_000;

/** How many strings of each enumeration the OLD scan refuses, so a comparison cannot pass by both scans refusing nothing. */
const REFUSED = { code: 1_086_263, groups: 186_847, macros: 106_354, markers: 82_203, tags: 19_132, seeded: 161_443, everyVariant: 219_146 };

describe("Session 325 — the heading scan refuses what the scan that reread the line refused", () => {
  it.each([
    ["an unclosed run of backticks hides nothing", "``` <section>", true],
    ["a closed span hides a block tag", "`<section>`", false],
    ["a run is closed by a run of exactly its length: the run of three never closes the run of two", "`` <section> ```", true],
    ["a run of three closes with a later run of three", "``` a `` <section> ``` b", false],
    ["a run of two closes with a later run of two, a single backtick between", "`` a ` <section> `` b", false],
    ["a run of two with no later run of two leaves its second backtick to close with a later single", "``a` <section>`", true],
    ["a block tag after a closed span is visible", "`a` <section>", true],
    ["a link hides a block tag in its label", "[<section>](u)", false],
    ["an unclosed bracket hides nothing", "[<section>", true],
    ["a block tag after a link is visible", "[a](b) <section>", true],
    ["an escaped bracket does not close a group", "[a\\]<section>]", false],
    ["a nested group that closes leaves the outer one unclosed: the tag is visible", "[[a]<section>", true],
    ["a parenthesis that never closes leaves the label closed and the tag visible", "[a](<section>", true],
    ["a destination hides a block tag", "[a](<section>)", false],
    ["a bare macro refuses", "\\par", true],
    ["a macro that takes an argument, given a braced one, refuses", "\\section{x}", true],
    ["an optional group does not satisfy that arity", "\\section[a]", false],
    ["a macro argument hides a block tag", "\\a{<section>}", false],
    ["a macro argument that never closes hides nothing", "\\a{<section>", true],
    ["a closed shortcode hides a block tag", "{{< <section> >}}", false],
    ["an unclosed shortcode hides nothing", "{{< <section>", true],
    ["a closed comment hides a block tag", "<!-- <section> -->", false],
    ["an unclosed comment hides nothing", "<!-- <section>", true],
    ["a closed CDATA section hides a block tag", "<![CDATA[ <section> ]]>", false],
    ["a closed processing instruction hides a block tag", "<? <section> ?>", false],
    ["a quoted attribute hides a block tag", '<span title="<section>">ok</span>', false],
    ["a tag whose quote never closes is no tag", '<div title="a>', false],
    ["a block tag closes at the first unquoted `>`", "<div title=a>b>", true],
    ["a closing script tag refuses nothing", "</script>", false],
    // The rows below are what the review round found unpinned (Session 325): each is the shortest text on which a mutant of the new code answers differently from the parent.
    ["a macro argument group may follow a blank", "\\a[x] {\\par}", false],
    ["two optional groups still leave the braced argument", "\\section[a][b]{x}", true],
    ["one follower is consumed after a label, not two", "[a](b){<section>}", true],
    ["an empty label and an empty destination, then a brace group", "[](){<section>}", true],
    ["a comment opener needs both dashes", "<!-x <section> -->", true],
    ["a CDATA opener needs its second bracket", "<![CDATAx ] <section> ]]>", true],
    ["a CDATA opener needs its CDATA", "<![x ] <section> ]]>", true],
    ["a macro name is letters only: a capital ends no name", "\\parX", false],
    ["a macro name may start with a capital", "\\Foo{<section>}", false],
    ["a star macro of the argument class takes its argument", "\\section*{x}", true],
    ["a star on a bare macro makes it another name", "\\par*", false],
    ["a star on an unknown macro with an argument", "\\caption*{x}", false],
    ["a closing script tag is matched without regard to case", "</SCRIPT>", false],
    ["a tag name starts with a letter, so a quote after a digit hides nothing", '<1 title="<section>">', true],
    ["a macro name ends at a digit", "\\par1", true],
    ["a form feed does not end a tag name", "<section\f>", false],
    ["a no-break space does not end a tag name", "<section\u00a0>", false],
    ["a macro of the any class refuses", "\\maketitle", true],
  ])("%s: %j", (_what, text, refused) => {
    expect(oldHeadingContentRefused(text, true, true, ESCAPABLE_LEGACY)).toBe(refused);
    expect(headingContentRefused(text, true, true, ESCAPABLE_LEGACY)).toBe(refused);
  });

  // A backslash that escapes nothing leaves the next character to be an opener, so a bracket can open straight after one (a wrong answer here is a group that closes where the old scan's did not).
  it.each([
    ["a bracket after a backslash that escapes nothing opens a group", "\\[<section>]", false],
    ["an unclosed one hides nothing", "\\[<section>", true],
    ["a backtick after a backslash that escapes nothing opens a span", "\\`<section>`", false],
    ["a macro argument after one", "\\a\\{<section>}", true],
  ])("%s: %j", (_what, text, refused) => {
    expect(oldHeadingContentRefused(text, true, true, ESCAPABLE_BACKSLASH_ONLY)).toBe(refused);
    expect(headingContentRefused(text, true, true, ESCAPABLE_BACKSLASH_ONLY)).toBe(refused);
  });

  it.each([
    ["every string of up to nine tokens over backtick runs, a letter, a backslash and a block tag", ALPHABET_CODE, 9, "code"],
    ["every string of up to six tokens over the three bracket kinds, a backslash, a letter and a block tag", ALPHABET_GROUPS, 6, "groups"],
    ["every string of up to six tokens over the macro classes, a blank and two bracket kinds", ALPHABET_MACROS, 6, "macros"],
    ["every string of up to five tokens over the openers and closers of comments, CDATA, instructions and shortcodes", ALPHABET_MARKERS, 5, "markers"],
    ["every string of up to six tokens over tag openers, quotes, a blank, a slash, the front of a block tag and the front of a closing script tag", ALPHABET_TAGS, 6, "tags"],
  ] as const)("agrees with the old scan on %s", (_name, alphabet, maxLength, key) => {
    const result = compareScans(everyString(alphabet, maxLength), false);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(alphabet.length, maxLength)); // every string of 0..maxLength tokens, none skipped
    expect(result.refused).toBe(REFUSED[key]);
  });

  it("agrees with the old scan under EVERY variant on every string of up to four tokens over one token of each family", () => {
    const alphabet = ALPHABET_EVERY_VARIANT;
    const result = compareScans(everyString(alphabet, 4), true);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(alphabet.length, 4) * VARIANTS.length);
    expect(result.refused).toBe(REFUSED.everyVariant);
  });

  it("agrees with the old scan on 500,000 seeded strings of up to twenty tokens", () => {
    const random = seededRandom(325);
    const strings: string[] = [];
    for (let i = 0; i < SEEDED_STRINGS; i++) {
      const count = Math.floor(random() * 21);
      let text = "";
      for (let j = 0; j < count; j++) text += SEEDED_TOKENS[Math.floor(random() * SEEDED_TOKENS.length)];
      strings.push(text);
    }
    const result = compareScans(strings, false);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_STRINGS);
    expect(result.refused).toBe(REFUSED.seeded);
  });

  // A comparison loop that cannot fail would pass every row above, so it is shown to fail once: a scan that refuses nothing disagrees with the old one, and the loop counts what it was asked.
  it("reports a disagreement against a wrong scan, and counts every string it was given", () => {
    const result = compareScans(everyString(ALPHABET_CODE, 3), false, () => false);
    expect(result.compared).toBe(countStrings(ALPHABET_CODE.length, 3));
    expect(result.disagreements.length).toBeGreaterThan(0);
  });

  // The tables the old scan reads are the model's own (exported), so the names the alphabets use are in them: the oracle is only as good as that.
  it("holds block names in the tables the tokens use", () => {
    expect(HEADING_BLOCK_TAG_OPEN.test("section")).toBe(true);
    expect(HEADING_BLOCK_TAG_CLOSE.test("section")).toBe(true);
    expect(HEADING_BLOCK_MACRO_BARE.test("par")).toBe(true);
    expect(HEADING_BLOCK_MACRO_ARG.test("section")).toBe(true);
    expect(HEADING_BLOCK_MACRO_ANY.test("a")).toBe(false);
    expect(HEADING_BLOCK_MACRO_BARE.test("a")).toBe(false);
    expect(HEADING_BLOCK_MACRO_ARG.test("a")).toBe(false);
  });
});
