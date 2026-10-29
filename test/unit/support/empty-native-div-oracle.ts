// The oracle for `emptyNativeDivLine` (Session 337, the BACKLOG item "Eight more single-line RangeError shapes and three more quadratic ones", part 4): the OLD pattern that `endsHtmlBlock` asked whether a line is an
// empty native div, copied from the parent `8ebce73`, and a reading of it BY DEFINITION that uses no regular expression. Both test files that compare the new function with them import this module, so the oracle and
// the strings are written once. It imports nothing from `src`: the pinned counts come from the old pattern and from a Python port of the definition (no code shared with the TypeScript), never from the code under test.
import { LS, NBSP, PS, everyString, seededRandom } from "./regex-equivalence";

// ---- The OLD pattern, copied from the parent `8ebce73` (`qmd/model.ts:14325`, inside `endsHtmlBlock`). V8 keeps one entry of its backtrack stack per repetition of the group, so it threw `RangeError: Maximum call
// stack size exceeded` from 8,388,570 repetitions of `a` after `<div ` (bisected at `8ebce73`, a fresh process per probe, the lower bound 8,388,569 read). ----
export const OLD_EMPTY_NATIVE_DIV = /^[ \t]*<div\b(?:[^>"']|"[^"]*"|'[^']*')*>[ \t]*<\/div>[ \t]*$/i;

const isBlank = (unit: string | undefined): boolean => unit === " " || unit === "\t";
/** `\w` as ECMAScript spells it without the `u` flag: the ASCII letters, the digits and the underscore. */
const isWordUnit = (unit: string | undefined): boolean => unit !== undefined && ((unit >= "a" && unit <= "z") || (unit >= "A" && unit <= "Z") || (unit >= "0" && unit <= "9") || unit === "_");
/** One unit of `word` (a letter) in either ASCII case; the flag `i` of a pattern without `u` folds no other character into an ASCII letter. */
const spells = (unit: string | undefined, letter: string): boolean => unit === letter || unit === letter.toUpperCase();

/** Whether the units from `from` are blanks, then `</div>` in either case, then blanks to the end of the line. */
function closerAndBlanks(line: string, from: number): boolean {
  let at = from;
  while (isBlank(line[at])) {
    at++;
  }
  if (line[at] !== "<" || line[at + 1] !== "/" || !spells(line[at + 2], "d") || !spells(line[at + 3], "i") || !spells(line[at + 4], "v") || line[at + 5] !== ">") {
    return false;
  }
  at += 6;
  while (isBlank(line[at])) {
    at++;
  }
  return at === line.length;
}

/**
 * A reading of the old pattern BY DEFINITION, with no regular expression and no argument that the parse is unique: blanks, `<div` in either case, a position that is not followed by a word character, then the
 * attribute block as a SET of positions where it may stop (a unit that is not `>`, `"` or `'` takes one step; a quote takes the run to the next quote of its own kind, since `[^"]*` cannot cross one), and the line is
 * accepted if ANY position the block can stop at holds a `>` that is followed by blanks, `</div>` in either case and blanks to the end.
 */
export function definitionEmptyNativeDiv(line: string): boolean {
  const n = line.length;
  let at = 0;
  while (isBlank(line[at])) {
    at++;
  }
  if (line[at] !== "<" || !spells(line[at + 1], "d") || !spells(line[at + 2], "i") || !spells(line[at + 3], "v")) {
    return false;
  }
  const start = at + 4;
  if (isWordUnit(line[start])) {
    return false; // `\b` after `v`: a word character may not follow
  }
  const reach = new Uint8Array(n + 2);
  reach[start] = 1;
  for (let i = start; i < n; i++) {
    if (reach[i] === 0) {
      continue;
    }
    const unit = line[i];
    if (unit !== ">" && unit !== '"' && unit !== "'") {
      reach[i + 1] = 1;
    } else if (unit !== ">") {
      for (let j = i + 1; j < n; j++) {
        if (line[j] === unit) {
          reach[j + 1] = 1;
          break;
        }
      }
    }
  }
  for (let i = start; i < n; i++) {
    if (reach[i] === 1 && line[i] === ">" && closerAndBlanks(line, i + 1)) {
      return true;
    }
  }
  return false;
}

export type DivCount = { compared: number; accepted: number; disagreements: string[] };
/**
 * Compare `candidate` with the old pattern and the reading by definition over `texts`: how many were compared, in how many the OLD pattern accepted, and the first few disagreements. With `candidate` the old
 * pattern itself the disagreements are the ones between the pattern and the definition, which is how the counts are pinned before the new function exists.
 */
export function compareEmptyNativeDiv(texts: Iterable<string>, candidate: (line: string) => boolean): DivCount {
  const count: DivCount = { compared: 0, accepted: 0, disagreements: [] };
  for (const line of texts) {
    const expected = OLD_EMPTY_NATIVE_DIV.test(line);
    count.compared++;
    if (expected) {
      count.accepted++;
    }
    const now = candidate(line);
    const byDefinition = definitionEmptyNativeDiv(line);
    if ((now !== expected || byDefinition !== expected) && count.disagreements.length < 5) {
      count.disagreements.push(`${JSON.stringify(line)}: old ${expected}, now ${now}, by definition ${byDefinition}`);
    }
    if (count.disagreements.length >= 5) {
      break; // five are reported; the rest of the enumeration would only find more of the same
    }
  }
  return count;
}

// ---- The strings both test files compare over. Every alphabet, template and head is written out here once; the Python port that recounts the pinned numbers (no code shared with this file) spells the same ones. ----

/** Pieces dense in accepted lines: an opener, a closer, a `>`, two blanks, a letter and the two quotes. */
export const DENSE_PIECES: readonly string[] = ["<div", "</div>", ">", " ", "\t", "a", '"', "'"];
/** Ten pieces of the tag: `<`, the name in two cases, `>`, `</`, `/`, the quotes, a blank and a letter (`<div></div>` is six of them). */
export const TAG_PIECES: readonly string[] = ["<", "div", "DIV", ">", "</", "/", '"', "'", " ", "a"];
/** Seven pieces, longer lines: the opener, the name, both angles, a double quote, a blank and a letter (`<div a></div>` is eight of them and `<div "a"></div>` ten). */
export const ATTR_PIECES: readonly string[] = ["<", "div", ">", "</", '"', " ", "a"];

export const FRAME_LEADS: readonly string[] = ["", " ", "\t", " \t", "    "];
export const FRAME_NAMES: readonly string[] = ["div", "DIV", "dIv", "di", "dive", "div_", "div1", "dİv"];
export const FRAME_BODY: readonly string[] = [" ", "a", ">", '"', "'", "\n"];
export const FRAME_BODY_LENGTH = 5;
export const FRAME_TAILS: readonly string[] = ["></div>", ">  </div>", "> </DIV>\t", "></div>x", "></div", "></ div>", ">", "></div></div>"];
/** Every lead, name, body of up to five characters and tail: the frame of an empty native div with the part between the name and the closer enumerated. */
export function* framedLines(): Generator<string> {
  for (const lead of FRAME_LEADS) {
    for (const name of FRAME_NAMES) {
      for (const body of everyString(FRAME_BODY, FRAME_BODY_LENGTH)) {
        for (const tail of FRAME_TAILS) {
          yield lead + "<" + name + body + tail;
        }
      }
    }
  }
}

/** Near-misses and hits: every UTF-16 code unit is put at every place of each (between the characters and in place of each one). */
export const SWEEP_HEADS: readonly string[] = [
  "<div></div>",
  "<DIV x></DIV>",
  '  <div a="b>c">\t</div> ',
  "<div a='b>c' d></div>",
  '<div a="b></div>',
  "<div>x</div>",
  "\t<div\n></div>",
];

export const SEED_LEADS: readonly string[] = ["", "", "", " ", "  ", "   ", "    ", "\t", " \t"];
export const SEED_NAMES: readonly string[] = ["div", "div", "div", "DIV", "Div", "dIV", "di", "dive", "div_", "div1", "div-"];
export const SEED_ATTRS: readonly string[] = ["a", " ", "  ", "b=c", ' x="y"', " x='y'", ' x="a>b"', " x='a>b'", '"', "'", "=", "\n", "\r", LS, PS, NBSP, "/", "-", "\t", "İ"];
export const SEED_GAPS: readonly string[] = ["", "", "", " ", "  ", "\t", " \t", NBSP, "x"];
export const SEED_CLOSERS: readonly string[] = ["</div>", "</div>", "</div>", "</div>", "</DIV>", "</Div>", "</ div>", "</div", "</div >", "</p>", "</dive>", "<div>"];
export const SEED_TAILS: readonly string[] = ["", "", "", "", " ", "  ", "\t", " \t", "x", "\r", "\n", NBSP, LS, "</div>", " a"];
/** A seeded sample: a lead, a name, 0 to 5 pieces of attributes, a `>` (seven times in eight), a gap, a closer and a tail. The seed is written beside the counts it produces. */
export function* seededLines(seed: number, count: number): Generator<string> {
  const next = seededRandom(seed);
  const pick = (list: readonly string[]): string => list[Math.floor(next() * list.length)];
  for (let i = 0; i < count; i++) {
    let text = pick(SEED_LEADS) + "<" + pick(SEED_NAMES);
    const parts = Math.floor(next() * 6);
    for (let part = 0; part < parts; part++) {
      text += pick(SEED_ATTRS);
    }
    if (next() < 0.875) {
      text += ">";
    }
    text += pick(SEED_GAPS);
    text += pick(SEED_CLOSERS);
    text += pick(SEED_TAILS);
    yield text;
  }
}
