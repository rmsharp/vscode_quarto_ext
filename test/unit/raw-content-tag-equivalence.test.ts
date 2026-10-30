import { describe, expect, it } from "vitest";
import { rawContentTags } from "../../src/core/qmd/model";
import { LS, NBSP, PS, countCodeUnitEdits, countStrings, everyCodeUnitEdit, everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 339, part (11) of the BACKLOG item "Three more quadratic single-line shapes" (group g02). `HTML_RAW_CONTENT_TAG`, `/<(\/?)(pre|script|style|textarea)\b[^>]*?(\/?)>/gi`, was run over every body line that holds a `<`
// (`computeRegions`, to keep the count of open raw-content elements), and the lazy `[^>]*?` reads to the FIRST `>` after the name: on a line that repeats an opener and holds no `>` every opener restarts a scan to the end of the
// line, n squared (`<pre ` x 40,000 took 2,335.6 ms at the parent `4d1944c`, a doubling 4x; see `s339-raw-content-tag-rows.test.ts`). `rawContentTags` reads the same tags with `indexOf`, and stops at the first opener that has no `>`
// after it, because no later opener can have one either.
// THE OLD PATTERN IS KEPT HERE, copied from the parent `4d1944c` (`src/core/qmd/model.ts` before the cure), as the oracle (Learning 738), beside a reading by definition that uses no regex at all. The function returns what the
// loop read from a match, `{ index, closing, selfClosing }` (`tag.index`, `tag[1] === "/"`, `tag[3] === "/"`), so the comparison is on those three fields of every tag, in order; the end of a match is not returned, but the tags that
// FOLLOW depend on it (a `<pre` inside the span of an earlier match is swallowed by it), so a wrong end shows as a different list. The pinned counts (how many strings of each enumeration the old pattern matches in at least one
// place, and how many tags it finds in all) come from the old pattern and never from the code under test.

// ---- The OLD pattern, copied from the parent `4d1944c`. ----
const OLD_HTML_RAW_CONTENT_TAG = /<(\/?)(pre|script|style|textarea)\b[^>]*?(\/?)>/gi;
type Tag = { index: number; closing: boolean; selfClosing: boolean };
function oldTags(line: string): Tag[] {
  const tags: Tag[] = [];
  for (const match of line.matchAll(OLD_HTML_RAW_CONTENT_TAG)) {
    tags.push({ index: match.index as number, closing: match[1] === "/", selfClosing: match[3] === "/" });
  }
  return tags;
}

// ---- A reading of the old pattern by DEFINITION, with no regular expression. ----
// A tag starts at a `<`, then an optional `/` (the closing mark), then one of four names compared without regard to ASCII case only (the pattern has no `u` flag, so a non-ASCII letter never matches an ASCII one: U+017F is no s,
// U+0131 no i), then a word boundary (the name ends in a letter, so the next code unit must not be an ASCII letter, digit or underscore; the end of the line is a boundary), then any characters up to the FIRST `>` at or after
// the end of the name, and the tag is self-closing when the character just before that `>` is a `/` that is not part of the name (the lazy quantifier gives up characters one at a time, so a `/` directly before the first
// `>` is taken by the tag's own `/`). A tag with no `>` after the name matches nothing. The next tag is searched for from just after that `>`.
const NAMES = ["pre", "script", "style", "textarea"] as const;
function asciiLower(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    out += code >= 0x41 && code <= 0x5a ? String.fromCharCode(code + 0x20) : text[i];
  }
  return out;
}
function isWordUnit(code: number): boolean {
  return (code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a) || code === 0x5f;
}
/** The tag that starts exactly at `start`, with where it ends (just after its `>`), or null. */
function definitionTagAt(line: string, start: number): (Tag & { end: number }) | null {
  if (line[start] !== "<") {
    return null;
  }
  let at = start + 1;
  const closing = line[at] === "/";
  if (closing) {
    at++;
  }
  for (const name of NAMES) {
    if (asciiLower(line.slice(at, at + name.length)) !== name) {
      continue;
    }
    const nameEnd = at + name.length;
    if (nameEnd < line.length && isWordUnit(line.charCodeAt(nameEnd))) {
      continue; // no word boundary: `<prefix>`, `<pre_>`, `<pre1>`
    }
    for (let k = nameEnd; k < line.length; k++) {
      if (line[k] === "/" && line[k + 1] === ">") {
        return { index: start, closing, selfClosing: true, end: k + 2 };
      }
      if (line[k] === ">") {
        return { index: start, closing, selfClosing: false, end: k + 1 };
      }
    }
    return null;
  }
  return null;
}
function definitionTags(line: string): Tag[] {
  const tags: Tag[] = [];
  let from = 0;
  for (;;) {
    let found: (Tag & { end: number }) | null = null;
    for (let start = from; start < line.length && found === null; start++) {
      found = definitionTagAt(line, start);
    }
    if (found === null) {
      return tags;
    }
    tags.push({ index: found.index, closing: found.closing, selfClosing: found.selfClosing });
    from = found.end;
  }
}

function sameTags(a: readonly Tag[], b: readonly Tag[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i].index !== b[i].index || a[i].closing !== b[i].closing || a[i].selfClosing !== b[i].selfClosing) {
      return false;
    }
  }
  return true;
}

type Count = { compared: number; matched: number; tags: number; disagreements: string[] };
/** Compare the new function with the old pattern (and, where `byDefinition`, with the reading by definition) over `texts`: how many were compared, how many the OLD pattern matched in at least one place, how many tags it found in all, and the first few disagreements. */
function compareAll(texts: Iterable<string>, byDefinition = false): Count {
  let compared = 0;
  let matched = 0;
  let tags = 0;
  const disagreements: string[] = [];
  for (const text of texts) {
    const expected = oldTags(text);
    compared++;
    if (expected.length > 0) {
      matched++;
      tags += expected.length;
    }
    const now = rawContentTags(text);
    const defined = byDefinition ? definitionTags(text) : expected;
    if ((!sameTags(now, expected) || !sameTags(defined, expected)) && disagreements.length < 5) {
      disagreements.push(`${JSON.stringify(text)}: old ${JSON.stringify(expected)}, now ${JSON.stringify(now)}${byDefinition ? `, by definition ${JSON.stringify(defined)}` : ""}`);
    }
  }
  return { compared, matched, tags, disagreements };
}

const CJK = String.fromCharCode(0x4e2d);
const E_ACUTE = String.fromCharCode(0xe9);
const LONG_S = String.fromCharCode(0x17f);
const DOTLESS_I = String.fromCharCode(0x131);
const ASTRAL = String.fromCodePoint(0x1f600);
const LONE_HIGH = String.fromCharCode(0xd83d);
const LONE_LOW = String.fromCharCode(0xde00);

function* behind(prefix: string, alphabet: readonly string[], maxLength: number): Generator<string> {
  for (const body of everyString(alphabet, maxLength)) {
    yield prefix + body;
  }
}

// The characters the pattern reads (`<`, `/`, `>`, the letters of `pre`, a blank), as single characters: this reaches every near miss of a tag (`<pe>`, `<prr>`, `</>`, `<pre/>`, `<pre />`, `</pre/>`).
const CHARS = ["<", "/", ">", "p", "r", "e", " "];
// Tokens, not characters: the openers and closers, the closing mark, the slash, the four names in three spellings, and a blank. Two tags next to each other, one inside the other, and the swallowing of the second by the first.
const TOKENS = ["<", "</", ">", "/", "pre", "SCRIPT", "style", "Textarea", " "];
// After a name: every character that decides the word boundary or the end, a carriage return and the other line terminators, a no-break space, a CJK letter, an astral pair, each half of a pair alone, an e acute, a long s.
const AFTER_NAME = [">", "/", " ", "\r", "\n", LS, PS, NBSP, CJK, "_", "x", "<", "-", ASTRAL, LONE_HIGH, LONE_LOW, E_ACUTE, LONG_S];
const NAME_PREFIXES = ["<pre", "</PRE", "<script", "</Style", "<TextArea"];
const SMALL_DEFINITION = ["<", "/", ">", "p", "r", "e"];

const ENUMERATIONS: Array<{ label: string; prefix: string; alphabet: readonly string[]; maxLength: number; matched: number; tags: number; byDefinition: boolean }> = [
  { label: "7 characters, up to 7", prefix: "", alphabet: CHARS, maxLength: 7, matched: 243, tags: 243, byDefinition: true },
  { label: "9 tokens, up to 7", prefix: "", alphabet: TOKENS, maxLength: 7, matched: 497072, tags: 499440, byDefinition: false },
  { label: "6 characters, up to 8, also by definition", prefix: "", alphabet: SMALL_DEFINITION, maxLength: 8, matched: 1564, tags: 1564, byDefinition: true },
];

// ---- every string that follows a name, behind each of five spellings of a name ----
function* afterNames(maxLength: number): Generator<string> {
  for (const prefix of NAME_PREFIXES) {
    yield* behind(prefix, AFTER_NAME, maxLength);
  }
}

// ---- every UTF-16 code unit in the place of each letter of each name, and after each name ----
const NAME_LETTERS = NAMES.reduce((sum, name) => sum + name.length, 0);
function* nameLetterSweep(): Generator<string> {
  for (const name of NAMES) {
    for (let at = 0; at < name.length; at++) {
      for (let unit = 0; unit < 0x10000; unit++) {
        yield "<" + name.slice(0, at) + String.fromCharCode(unit) + name.slice(at + 1) + ">";
      }
    }
  }
}
function* afterNameSweep(): Generator<string> {
  for (const name of NAMES) {
    for (let unit = 0; unit < 0x10000; unit++) {
      yield "<" + name + String.fromCharCode(unit) + ">";
    }
  }
}

// ---- every way of writing each name in upper and lower case ----
function* everyCase(): Generator<string> {
  for (const name of NAMES) {
    for (let mask = 0; mask < 1 << name.length; mask++) {
      let cased = "";
      for (let i = 0; i < name.length; i++) {
        cased += mask & (1 << i) ? name[i].toUpperCase() : name[i];
      }
      yield `<${cased}>`;
      yield `</${cased} />`;
      yield `x<${cased}/>y<${cased} class="a">`;
    }
  }
}
const CASE_COUNT = NAMES.reduce((sum, name) => sum + (1 << name.length) * 3, 0);

// ---- a seeded sample of longer lines ----
const SEEDED_COUNT = 200_000;
const SEED = 3391;
const PIECES = ["<", "</", ">", "/>", "pre", "PRE", "Script", "style", "textarea", " ", "x", "\r", LS, PS, NBSP, CJK, ASTRAL, LONE_HIGH, "_", "-", "=", '"', "a b", "/", "<pre>", "</pre>", "<script ", "<style/>"];
function* seededLines(seed: number, count: number): Generator<string> {
  const next = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    let line = "";
    const parts = Math.floor(next() * 15);
    for (let part = 0; part < parts; part++) {
      line += PIECES[Math.floor(next() * PIECES.length)].repeat(1 + Math.floor(next() * 3));
    }
    yield line;
  }
}

// ---- run lengths of an opener around every boundary, before every tail ----
const RUNS = [0, 1, 2, 3, 5, 9, 100, 1000];
const UNITS = ["<pre ", "<script ", "<STYLE ", "<textarea ", "</pre ", "<pre/ ", "<pre/", "<pre", "<pre>", "<pre/>", "</style>"];
const TAILS = ["", ">", "/>", " />", "x>", "</pre>", "\r>", CJK + ">", "<pre>", " <script", "/"];
function* runGrid(runs: readonly number[]): Generator<string> {
  for (const before of ["", "x", "  ", "<", "</"]) {
    for (const unit of UNITS) {
      for (const run of runs) {
        for (const tail of TAILS) {
          yield `${before}${unit.repeat(run)}${tail}`;
        }
      }
    }
  }
}

// What each line is, stated by hand: [line, the tags as [index, closing, selfClosing]].
const STATED: Array<[string, Array<[number, boolean, boolean]>]> = [
  ["", []],
  ["<", []],
  ["<>", []],
  ["</>", []],
  ["<pre", []],
  ["<pre>", [[0, false, false]]],
  ["<PRE>", [[0, false, false]]],
  ["<Pre class=\"a\">", [[0, false, false]]],
  ["</pre>", [[0, true, false]]],
  ["</PRE >", [[0, true, false]]],
  ["<pre/>", [[0, false, true]]],
  ["<pre />", [[0, false, true]]],
  ["<pre//>", [[0, false, true]]],
  ["<pre/ >", [[0, false, false]]],
  ["</pre/>", [[0, true, true]]],
  ["<script/>", [[0, false, true]]],
  ["<style />", [[0, false, true]]],
  ["<textarea/>", [[0, false, true]]],
  ["x<pre>", [[1, false, false]]],
  ["  <pre>", [[2, false, false]]],
  ["<pre><pre>", [[0, false, false], [5, false, false]]],
  ["<pre></pre>", [[0, false, false], [5, true, false]]],
  ["<pre <pre>", [[0, false, false]]],
  ["<pre<script>", [[0, false, false]]],
  ["<pre><script></pre>", [[0, false, false], [5, false, false], [13, true, false]]],
  ["<pre >x<pre/>", [[0, false, false], [7, false, true]]],
  ["<pre x/>y</pre>", [[0, false, true], [9, true, false]]],
  ["<prefix>", []],
  ["<pre_>", []],
  ["<pre1>", []],
  ["<pre-x>", [[0, false, false]]],
  ["<pre" + E_ACUTE + ">", [[0, false, false]]],
  ["<pre" + LONG_S + ">", [[0, false, false]]],
  ["<" + LONG_S + "cript>", []],
  ["<scr" + DOTLESS_I + "pt>", []],
  ["<" + LONG_S + "tyle>", []],
  ["<scripts>", []],
  ["<textare>", []],
  ["<pre\r>", [[0, false, false]]],
  ["<pre" + LS + ">", [[0, false, false]]],
  ["<pre " + CJK + ">", [[0, false, false]]],
  ["<pre " + ASTRAL + ">", [[0, false, false]]],
  ["<pre " + LONE_HIGH + ">", [[0, false, false]]],
  // THE SET OF NAMES IS PINNED FROM ABOVE TOO (Session 339 review, J13 to J15 of tools/mutation-run/mutants/s339-review-raw-content-tag.json): dropping a name from `RAW_CONTENT_NAMES` dies on the rows above, but a FIFTH name (`xmp`,
  // `code`, `title`) did not, because no alphabet held another element. These are elements the pattern never named, an opener and a closer each, and every answer is none.
  ["<xmp>", []],
  ["</xmp>", []],
  ["<code>", []],
  ["<title>", []],
  ["<div>", []],
  ["<p>", []],
  ["</p>", []],
  ["<listing>", []],
  ["<plaintext>", []],
  ["<noscript>", []],
  ["<textareas>", []],
  ["<styles>", []],
  ["<pre ".repeat(5), []],
  ["<pre ".repeat(5) + ">", [[0, false, false]]],
  ["<pre ".repeat(5) + "/>", [[0, false, true]]],
  ["<pre>" + "<pre ".repeat(5), [[0, false, false]]],
  ["<pre></pre>" + "<pre ".repeat(5), [[0, false, false], [5, true, false]]],
  ["</pre>".repeat(3), [[0, true, false], [6, true, false], [12, true, false]]],
];

describe("Session 339 — rawContentTags: the new function reads the tags the old raw-content pattern matched", () => {
  it.each(ENUMERATIONS.map((e) => [`every string of ${e.label}`, e] as const))("%s", (_label, e) => {
    const result = compareAll(behind(e.prefix, e.alphabet, e.maxLength), e.byDefinition);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(e.alphabet.length, e.maxLength));
    expect(result.matched).toBe(e.matched);
    expect(result.tags).toBe(e.tags);
  }, HEAVY_ROW_MS);

  it("every string of up to 4 characters from 18 behind each of five spellings of a name", () => {
    const result = compareAll(afterNames(4));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(NAME_PREFIXES.length * countStrings(AFTER_NAME.length, 4));
    expect(result.matched).toBe(102500);
    expect(result.tags).toBe(102500);
  }, HEAVY_ROW_MS);

  it("every string of up to 3 characters from 18 behind each spelling of a name, also by definition", () => {
    const result = compareAll(afterNames(3), true);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(NAME_PREFIXES.length * countStrings(AFTER_NAME.length, 3));
    expect(result.matched).toBe(4415);
    expect(result.tags).toBe(4415);
  }, HEAVY_ROW_MS);

  it(`${SEEDED_COUNT.toLocaleString("en-US")} seeded lines (seed ${SEED})`, () => {
    const result = compareAll(seededLines(SEED, SEEDED_COUNT));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_COUNT);
    expect(result.matched).toBe(103144);
    expect(result.tags).toBe(310558);
  }, HEAVY_ROW_MS);

  it("the first 20,000 of those seeded lines, also by definition", () => {
    const result = compareAll(seededLines(SEED, 20_000), true);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(20_000);
    expect(result.matched).toBe(10219);
    expect(result.tags).toBe(30490);
  }, HEAVY_ROW_MS);

  it("every UTF-16 code unit in the place of each letter of each name", () => {
    const result = compareAll(nameLetterSweep());
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(NAME_LETTERS * 0x10000);
    expect(result.matched).toBe(44);
    expect(result.tags).toBe(44);
  }, HEAVY_ROW_MS);

  it("every UTF-16 code unit right after each name, before a `>`", () => {
    const result = compareAll(afterNameSweep());
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(NAMES.length * 0x10000);
    expect(result.matched).toBe(261892);
    expect(result.tags).toBe(261892);
  }, HEAVY_ROW_MS);

  const EDIT_HEADS = ["<pre/>", "</pre>"];
  it("every UTF-16 code unit at every place of `<pre/>` and `</pre>`, inserted or in place of a character", () => {
    const result = compareAll(everyCodeUnitEdit(EDIT_HEADS));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(countCodeUnitEdits(EDIT_HEADS));
    expect(result.matched).toBe(524121);
    expect(result.tags).toBe(524121);
  }, HEAVY_ROW_MS);

  it("every way of writing each name in upper and lower case, as an opener, a closer with a blank and slash, and two tags, also by definition", () => {
    const result = compareAll(everyCase(), true);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(CASE_COUNT);
    expect(result.matched).toBe(1080);
    expect(result.tags).toBe(1440);
  });

  // The old pattern is quadratic on a run of unterminated openers, so the grid keeps the runs to 1,000 (about 5,000 characters, 1.5 ms for `<pre ` x 1,000); the reading by definition is cubic and meets the short runs only.
  it("a grid of opener runs, units and tails", () => {
    const result = compareAll(runGrid(RUNS));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(5 * UNITS.length * RUNS.length * TAILS.length);
    expect(result.matched).toBe(3500);
    expect(result.tags).toBe(187355);
  }, HEAVY_ROW_MS);

  it("the short part of that grid, also by definition", () => {
    const result = compareAll(runGrid([0, 1, 2, 3, 5]), true);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(5 * UNITS.length * 5 * TAILS.length);
    expect(result.matched).toBe(2045);
    expect(result.tags).toBe(3320);
  }, HEAVY_ROW_MS);

  it.each(STATED.map(([line, tags]) => [JSON.stringify(line), line, tags] as const))("%s is stated as %j by hand, by the old pattern, by definition and by the new function", (_label, line, tags) => {
    const stated = tags.map(([index, closing, selfClosing]): Tag => ({ index, closing, selfClosing }));
    expect(oldTags(line)).toEqual(stated);
    expect(definitionTags(line)).toEqual(stated);
    expect(rawContentTags(line)).toEqual(stated);
  });

  // The rest of the HTML element names, as the fifth name no row held (Session 339 review, J13 to J15 of tools/mutation-run/mutants/s339-review-raw-content-tag.json): not one of them is a raw-content tag, as an opener, a closer, upper-cased with an attribute, or self-closing, and neither is a
  // name that is a proper prefix of one of the four (`<p>`, `<scr>`, `<textare>`) or one of the four with a letter more (`<prea>`, `<styled>`).
  const OTHER_ELEMENTS = [
    "a", "abbr", "acronym", "address", "applet", "area", "article", "aside", "audio", "b", "base", "basefont", "bdi", "bdo", "big", "blink", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col",
    "colgroup", "data", "datalist", "dd", "del", "details", "dfn", "dialog", "dir", "div", "dl", "dt", "em", "embed", "fieldset", "figcaption", "figure", "font", "footer", "form", "frame", "frameset", "h1", "h2", "h3", "h4", "h5",
    "h6", "head", "header", "hgroup", "hr", "html", "i", "iframe", "img", "input", "ins", "kbd", "label", "legend", "li", "link", "listing", "main", "map", "mark", "marquee", "math", "menu", "meta", "meter", "nav", "nobr", "noembed",
    "noframes", "noscript", "object", "ol", "optgroup", "option", "output", "p", "param", "picture", "plaintext", "progress", "q", "rp", "rt", "ruby", "s", "samp", "search", "section", "select", "slot", "small", "source", "span",
    "strike", "strong", "sub", "summary", "sup", "svg", "table", "tbody", "td", "template", "tfoot", "th", "thead", "time", "title", "tr", "track", "tt", "u", "ul", "var", "video", "wbr", "xmp",
    "prea", "pre1", "pre_", "preformatted", "scripta", "scripts", "styled", "styles", "textareas", "textareaa", "pr", "sc", "scr", "scri", "scrip", "st", "sty", "styl", "te", "tex", "text", "texta", "textar", "textare",
  ];
  function* otherElementSpellings(): Generator<string> {
    for (const name of OTHER_ELEMENTS) {
      yield `<${name}>`;
      yield `</${name}>`;
      yield `<${name.toUpperCase()} class="a">`;
      yield `<${name}/>`;
    }
  }
  it("not one of 154 other element names is a raw-content tag, in four spellings each, also by definition", () => {
    const result = compareAll(otherElementSpellings(), true);
    expect(result.disagreements).toEqual([]);
    expect(OTHER_ELEMENTS.length).toBe(154);
    expect(new Set(OTHER_ELEMENTS).size).toBe(OTHER_ELEMENTS.length);
    expect(OTHER_ELEMENTS.some((name) => (NAMES as readonly string[]).includes(name))).toBe(false);
    expect(result.compared).toBe(4 * OTHER_ELEMENTS.length);
    expect(result.matched).toBe(0);
    expect(result.tags).toBe(0);
  });

  // Lines of 10,000,000 characters (the length the BACKLOG item names): the new function reads them without a stack or a spread (`RangeError`) and in linear time. The old pattern is quadratic on the first of them.
  const LONG_LIMIT_MS = 3000;
  const LONG_RUN = 2_000_000; // `<pre ` and `<pre>` are 5 characters
  const PAIR_RUN = 900_000; // `<pre></pre>` is 11
  const SCRIPT_RUN = 1_250_000; // `<script ` is 8
  const ANGLE_RUN = 10_000_000;
  // ⚠ A SCAN THAT IS QUADRATIC AT NATIVE SPEED KEEPS EVERY ANSWER AND IS STILL QUADRATIC (Session 339 review, R11 of tools/mutation-run/mutants/s339-raw-content-tag.json: the `return` at the first opener with no `>` respelled as "go on to the
  // next `<`", every `indexOf(">")` then reading to the end of the line). `<pre ` x 100,000 / 200,000 / 400,000 (500,000 / 1,000,000 / 2,000,000 characters) took 565.7 / 2,252.4 / 8,941.8 ms that way, `<script ` x 250,000 5,685.1 ms
  // and `<pre ` x 200,000 and a CJK letter (a two-byte string) 4,503.2 ms (fresh processes, scratch copies; the rows below, run against that mutant at load average 9, took 9,098 / 5,778 / 4,640 ms for the last three, and the two
  // files together 79 s); the cure takes 0.05 to 0.30 ms on the 2,000,000-character `<pre ` line (best and worst of 5 repetitions in a fresh process). The 10,000,000-character rows
  // below would not come back from that mutant in hours, so they ask first whether a native row was slow and fail at once if one was.
  const NATIVE_LIMIT_MS = 1000;
  const NATIVE_PRE_RUN = 400_000;
  const NATIVE_SCRIPT_RUN = 250_000;
  const NATIVE_TWO_BYTE_RUN = 200_000;
  let nativeRowWasSlow = false;
  const clock = <T,>(run: () => T): { result: T; ms: number } => {
    const started = performance.now();
    const result = run();
    return { result, ms: performance.now() - started };
  };
  const native = <T,>(run: () => T): T => {
    const { result, ms } = clock(run);
    nativeRowWasSlow = nativeRowWasSlow || ms >= NATIVE_LIMIT_MS;
    expect(ms).toBeLessThan(NATIVE_LIMIT_MS);
    return result;
  };
  it("`<pre ` x 400,000 (2,000,000 characters, no `>`) holds no tag in linear time", () => {
    expect(native(() => rawContentTags("<pre ".repeat(NATIVE_PRE_RUN)))).toEqual([]);
  });
  it("`<script ` x 250,000 (2,000,000 characters, no `>`) holds no tag in linear time", () => {
    expect(native(() => rawContentTags("<script ".repeat(NATIVE_SCRIPT_RUN)))).toEqual([]);
  });
  it("`<pre ` x 200,000 and a CJK letter (a two-byte string) holds no tag in linear time", () => {
    expect(native(() => rawContentTags("<pre ".repeat(NATIVE_TWO_BYTE_RUN) + CJK))).toEqual([]);
  });
  // ⚠ THE STOP IS FOR A CLOSER TOO (Session 339 review, H18 of tools/mutation-run/mutants/s339-review-raw-content-tag.json): a closer `</pre ` with no `>` after its name ends the scan exactly as an opener does, and a scan that went on
  // at the next `<` for a closer only keeps every answer and is quadratic at native speed on a run of closers, which the rows above (all openers) never meet. The function takes 0.05 to 0.67 ms on the three lines below (best and worst of 5 repetitions, three fresh
  // processes; 0.05 to 0.52 ms before the first-letter guard); that spelling took 10,831.9 ms on `</pre ` x 400,000, 6,370.8 ms on `</script ` x 250,000 and 5,467.8 ms on `</pre ` x 200,000 and a CJK letter (the rows below, run against it).
  it("`</pre ` x 400,000 (2,400,000 characters, closers with no `>`) holds no tag in linear time", () => {
    expect(native(() => rawContentTags("</pre ".repeat(NATIVE_PRE_RUN)))).toEqual([]);
  });
  it("`</script ` x 250,000 (2,250,000 characters, closers with no `>`) holds no tag in linear time", () => {
    expect(native(() => rawContentTags("</script ".repeat(NATIVE_SCRIPT_RUN)))).toEqual([]);
  });
  it("`</pre ` x 200,000 and a CJK letter (a two-byte string of closers) holds no tag in linear time", () => {
    expect(native(() => rawContentTags("</pre ".repeat(NATIVE_TWO_BYTE_RUN) + CJK))).toEqual([]);
  });
  it("an opener then `</pre ` x 400,000 is one tag, and the closers behind it are not read again", () => {
    expect(native(() => rawContentTags("<pre>" + "</pre ".repeat(NATIVE_PRE_RUN)))).toEqual([{ index: 0, closing: false, selfClosing: false }]);
  });
  it("an opener then `<pre ` x 400,000 is one tag, and the run behind it is not read again", () => {
    expect(native(() => rawContentTags("<pre>" + "<pre ".repeat(NATIVE_PRE_RUN)))).toEqual([{ index: 0, closing: false, selfClosing: false }]);
  });
  it("`<pre ` x 400,000, a closer and `<pre ` x 400,000 is one opener at 0 that swallows the closer", () => {
    expect(native(() => rawContentTags("<pre ".repeat(NATIVE_PRE_RUN) + "</pre>" + "<pre ".repeat(NATIVE_PRE_RUN)))).toEqual([{ index: 0, closing: false, selfClosing: false }]);
  });
  it("`<pre ` x 2,000,000 (10,000,000 characters, no `>`) holds no tag", () => {
    expect(nativeRowWasSlow, "a native-speed row above was slow: this row would run for hours").toBe(false);
    const { result, ms } = clock(() => rawContentTags("<pre ".repeat(LONG_RUN)));
    expect(result).toEqual([]);
    expect(ms).toBeLessThan(LONG_LIMIT_MS);
  });
  it("`<pre ` x 2,000,000 and one `>` at the very end is ONE tag at 0, and `/>` at the end makes it self-closing", () => {
    expect(nativeRowWasSlow, "a native-speed row above was slow: this row would run for hours").toBe(false);
    const one = clock(() => rawContentTags("<pre ".repeat(LONG_RUN) + ">"));
    expect(one.result).toEqual([{ index: 0, closing: false, selfClosing: false }]);
    expect(one.ms).toBeLessThan(LONG_LIMIT_MS);
    const self = clock(() => rawContentTags("<pre ".repeat(LONG_RUN) + "/>"));
    expect(self.result).toEqual([{ index: 0, closing: false, selfClosing: true }]);
    expect(self.ms).toBeLessThan(LONG_LIMIT_MS);
  });
  it("`<pre>` x 2,000,000 (10,000,000 characters) is 2,000,000 openers, one every 5 characters", () => {
    const { result, ms } = clock(() => rawContentTags("<pre>".repeat(LONG_RUN)));
    expect(result.length).toBe(LONG_RUN);
    expect(result[0]).toEqual({ index: 0, closing: false, selfClosing: false });
    expect(result[LONG_RUN - 1]).toEqual({ index: 5 * (LONG_RUN - 1), closing: false, selfClosing: false });
    expect(result.every((tag, i) => tag.index === 5 * i && !tag.closing && !tag.selfClosing)).toBe(true);
    expect(ms).toBeLessThan(LONG_LIMIT_MS);
  });
  it("`<pre></pre>` x 900,000 alternates openers and closers, and a line of 10,000,000 `<` or `x` holds none", () => {
    const pairs = clock(() => rawContentTags("<pre></pre>".repeat(PAIR_RUN)));
    expect(pairs.result.length).toBe(2 * PAIR_RUN);
    expect(pairs.result.every((tag, i) => tag.index === (i % 2 === 0 ? 11 * (i / 2) : 11 * ((i - 1) / 2) + 5) && tag.closing === (i % 2 === 1) && !tag.selfClosing)).toBe(true);
    expect(pairs.ms).toBeLessThan(LONG_LIMIT_MS);
    const angles = clock(() => rawContentTags("<".repeat(ANGLE_RUN)));
    expect(angles.result).toEqual([]);
    expect(angles.ms).toBeLessThan(LONG_LIMIT_MS);
    const letters = clock(() => rawContentTags("x".repeat(ANGLE_RUN)));
    expect(letters.result).toEqual([]);
    expect(letters.ms).toBeLessThan(LONG_LIMIT_MS);
  });
  it("a two-byte line of 10,000,000 characters: `<script ` x 1,250,000 and a CJK letter holds no tag, and a `>` after the letter makes one", () => {
    expect(nativeRowWasSlow, "a native-speed row above was slow: this row would run for hours").toBe(false);
    const none = clock(() => rawContentTags("<script ".repeat(SCRIPT_RUN) + CJK));
    expect(none.result).toEqual([]);
    expect(none.ms).toBeLessThan(LONG_LIMIT_MS);
    const one = clock(() => rawContentTags("<script ".repeat(SCRIPT_RUN) + CJK + ">"));
    expect(one.result).toEqual([{ index: 0, closing: false, selfClosing: false }]);
    expect(one.ms).toBeLessThan(LONG_LIMIT_MS);
  });
  // A limit of 100 s, a run of 20 or a shorter line passes the quadratic spellings too.
  it("keeps the limits and the sizes of the long-line rows above", () => {
    expect([LONG_LIMIT_MS, NATIVE_LIMIT_MS]).toEqual([3000, 1000]);
    expect([LONG_RUN, PAIR_RUN, SCRIPT_RUN, ANGLE_RUN]).toEqual([2_000_000, 900_000, 1_250_000, 10_000_000]);
    expect([NATIVE_PRE_RUN, NATIVE_SCRIPT_RUN, NATIVE_TWO_BYTE_RUN]).toEqual([400_000, 250_000, 200_000]);
    expect([5 * LONG_RUN, 11 * PAIR_RUN, 8 * SCRIPT_RUN, 5 * NATIVE_PRE_RUN, 8 * NATIVE_SCRIPT_RUN, 5 * NATIVE_TWO_BYTE_RUN]).toEqual([10_000_000, 9_900_000, 10_000_000, 2_000_000, 2_000_000, 1_000_000]);
    expect([6 * NATIVE_PRE_RUN, 9 * NATIVE_SCRIPT_RUN, 6 * NATIVE_TWO_BYTE_RUN]).toEqual([2_400_000, 2_250_000, 1_200_000]); // the closer runs: `</pre ` is 6 characters, `</script ` 9
  });
  // The old pattern meets the same lines at the size it can: 3,000 openers is 15,000 to 30,011 characters. Read to the end with `matchAll` (fresh processes, best of 15), the two shapes of unterminated openers take it 13.7 to 14.0 ms (`<pre ` x 3,000)
  // and 21.8 to 22.5 ms (`<script ` x 3,000 and a CJK letter, 24,001 characters); the other seven shapes take 0.01 to 0.6 ms.
  it("the old pattern and the new function agree on the long-line shapes at a size the old one can read", () => {
    const shapes = ["<pre ".repeat(3_000), "<pre ".repeat(3_000) + ">", "<pre ".repeat(3_000) + "/>", "<pre>".repeat(3_000), "<pre></pre>".repeat(3_000), "</pre>".repeat(3_000), "<script ".repeat(3_000) + CJK, "<style/>".repeat(3_000), "<textarea ".repeat(3_000) + "</textarea>"];
    for (const shape of shapes) {
      expect(sameTags(rawContentTags(shape), oldTags(shape)), JSON.stringify(shape.slice(0, 24))).toBe(true);
    }
  });
});
