import { describe, expect, it } from "vitest";
import { indexLabels, trailingBlanks } from "../../src/core/refs";
import { BOM, IDEOGRAPHIC, LS, NBSP, NEL, PS, countStrings, everyString, seededRandom } from "./support/regex-equivalence";

// Session 321 — the BACKLOG item "Other regexes still quadratic on a long run of blanks, CR or U+2028", part (3). `indexLabels` read the blanks between a cell option line's pipe and its key with
// `/[ \t]*$/.exec(text)?.[0] ?? ""` over the text before the key. That is an UNANCHORED search: it is tried from every position, so a blank run that is not at the end of the text (the run between
// the `#` and the `|`) is scanned to its end from each of its blanks and then refused (quadratic: 0.6 s for 32,000 blanks, 6 s for 100,000, three fresh processes at a load of about 5; `pathological-inputs.test.ts` has the document rows).
// `trailingBlanks` finds the run that ends the text by `trimEndBlanks`, which scans back from the end. The old spelling is kept here, verbatim, as the oracle (Learning 738).
const oldTrailingBlanks = (text: string): string => /[ \t]*$/.exec(text)?.[0] ?? "";

const NEAR_MISS_LIMIT_MS = 100;
const NEAR_MISS_SIZES = [20_000, 50_000, 1_000_000];
const TRAILING_RUN = 200_000;
const SEEDED_STRINGS = 100_000;

/** How many strings of each enumeration the OLD spelling answers with a non-empty run (the text ends in a blank), counted from the old spelling alone and checked with Python's `re` (`$` spelled `\Z`), so a comparison cannot pass by both sides answering nothing. */
const ANSWERED = { a: 195_312, b: 39_216, c: 74_898, seeded: 37_499 };

// The three alphabets of the exhaustive rows, named so that one row can pin what is in them (a letter put in place of U+2029 would move neither the string count nor the answered count).
const ALPHABET_A = [" ", "\t", "#", "|", "a"];
const ALPHABET_B = [" ", "\t", "\r", "\n", LS, PS, NBSP];
const ALPHABET_C = [" ", "\t", "\v", "\f", NEL, IDEOGRAPHIC, BOM, "x"];

function compareTrailing(texts: Iterable<string>): { compared: number; answered: number; disagreements: string[] } {
  let compared = 0;
  let answered = 0;
  const disagreements: string[] = [];
  for (const text of texts) {
    const expected = oldTrailingBlanks(text);
    compared++;
    if (expected !== "") answered++;
    if (trailingBlanks(text) !== expected && disagreements.length < 5) disagreements.push(JSON.stringify(text));
  }
  return { compared, answered, disagreements };
}

describe("Session 321 — trailingBlanks answers what the unanchored search answered", () => {
  it.each([
    ["the gap of an ordinary option line", "#| ", " "],
    ["no blank at the end", "#|", ""],
    ["blanks before the pipe are not the gap", "#   |", ""],
    ["a run before the pipe and a one-blank gap", "#   | ", " "],
    ["a tab is a blank", "#|\t", "\t"],
    ["blanks and tabs mixed", "#| \t \t", " \t \t"],
    ["the whole text is blanks", "  \t", "  \t"],
    ["the empty text", "", ""],
    ["a carriage return ends the text, so there is no run", "#| \r", ""],
    ["a line feed ends the text, so there is no run", "#| \n", ""],
    ["a run before a line feed is not the end", "#  \n ", " "],
    ["U+2028 ends the text", `#| ${LS}`, ""],
    ["a no-break space is no blank", `#|${NBSP}`, ""],
    ["a no-break space inside the run stops it", `#| ${NBSP} `, " "],
  ])("%s", (_what, text, expected) => {
    expect(oldTrailingBlanks(text)).toBe(expected);
    expect(trailingBlanks(text)).toBe(expected);
  });

  // Every string up to a length over an alphabet: the strings that end in a blank run, the ones that end in something that is not a blank, and the ones with a run in the middle.
  it.each([
    ["up to eight characters over a blank, a tab, a hash, a pipe and a letter", 8, ALPHABET_A, ANSWERED.a],
    ["up to six characters over blanks, a carriage return, a line feed, U+2028, U+2029 and a no-break space", 6, ALPHABET_B, ANSWERED.b],
    // The Unicode spaces `trimEnd()` strips that the first two alphabets leave out (a vertical tab, a form feed, U+3000, U+FEFF), and U+0085, which `trimEnd()` leaves alone but a Unicode-aware strip would take: a helper
    // that also takes any of them survives the first two alphabets.
    ["up to six characters over blanks, a vertical tab, a form feed, U+0085, U+3000, U+FEFF and a letter", 6, ALPHABET_C, ANSWERED.c],
  ] as const)("agrees with the old search on every string of %s", (_name, maxLength, alphabet, answered) => {
    const result = compareTrailing(everyString(alphabet, maxLength));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(countStrings(alphabet.length, maxLength)); // every string of 0..maxLength characters, none skipped
    expect(result.answered).toBe(answered);
  });

  it("agrees with the old search on 100,000 seeded texts of up to 40 characters, runs in the middle included", () => {
    const random = seededRandom(321);
    const alphabet = [" ", " ", " ", "\t", "\t", "#", "|", "a", "x", ":", "\r", LS, NBSP];
    const texts: string[] = [];
    for (let i = 0; i < SEEDED_STRINGS; i++) {
      const length = Math.floor(random() * 41);
      let text = "";
      for (let j = 0; j < length; j++) text += alphabet[Math.floor(random() * alphabet.length)];
      texts.push(text);
    }
    const result = compareTrailing(texts);
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_STRINGS);
    expect(result.answered).toBe(ANSWERED.seeded);
  });

  // The old search is quadratic on the first five of these (0.24 s at 20,000 blanks, 1.5 s at 50,000) and linear on the last, where the run is the gap itself, so each answer is stated, not taken from it. The limit is wide on
  // purpose: the scan back is a few milliseconds even at a million. 20,000 is in the sizes so that a helper which keeps the old search for short texts (the answers are the same) cannot hide below the larger one.
  it.each([
    ["a run in the middle, then a pipe", (n: number) => `#${" ".repeat(n)}|`, () => ""],
    ["a run in the middle, then a pipe and a one-blank gap", (n: number) => `#${" ".repeat(n)}| `, () => " "],
    ["a run of tabs in the middle", (n: number) => `#${"\t".repeat(n)}| `, () => " "],
    ["a run of alternating blanks and tabs in the middle", (n: number) => `#${" \t".repeat(n / 2)}|\t`, () => "\t"],
    ["a run in the middle, then a letter and a carriage return", (n: number) => `#${" ".repeat(n)}x\r`, () => ""],
    ["the run is the gap itself", (n: number) => `#|${" ".repeat(n)}`, (n: number) => " ".repeat(n)],
  ])("%s: is read in linear time at every near-miss size", (_what, build, expected) => {
    for (const n of NEAR_MISS_SIZES) {
      const text = build(n);
      const started = performance.now();
      const answer = trailingBlanks(text);
      const took = performance.now() - started;
      expect(answer).toBe(expected(n));
      expect(took).toBeLessThan(NEAR_MISS_LIMIT_MS);
    }
  });

  it("answers a trailing run of 200,000 blanks after a long run in the middle, whole", () => {
    const text = `#${" ".repeat(TRAILING_RUN)}|${" ".repeat(TRAILING_RUN)}`;
    const started = performance.now();
    const answer = trailingBlanks(text);
    expect(performance.now() - started).toBeLessThan(NEAR_MISS_LIMIT_MS);
    expect(answer).toBe(" ".repeat(TRAILING_RUN));
  });

  // The alphabets above hold the characters a helper is most likely to take by mistake; this holds every other one. A character that is none of the two blanks must end the run wherever it stands, so each code unit
  // (a lone surrogate included) is the whole text, the last character after a blank, the first before a blank, and the only one between two. Half of the 262,144 texts answer a run (all that end in a blank).
  it("agrees with the old search on every UTF-16 code unit, alone, after a blank, before a blank and between blanks", () => {
    const disagreements: string[] = [];
    let compared = 0;
    let answered = 0;
    for (let code = 0; code <= 0xffff; code++) {
      const c = String.fromCharCode(code);
      for (const text of [c, ` ${c}`, `${c} `, ` ${c} `]) {
        compared++;
        if (oldTrailingBlanks(text) !== "") answered++;
        if (trailingBlanks(text) !== oldTrailingBlanks(text) && disagreements.length < 5) disagreements.push(JSON.stringify(text));
      }
    }
    expect(disagreements).toEqual([]);
    expect(compared).toBe(4 * 0x10000);
    expect(answered).toBe(131_076);
  });

  // A size of 1,000 blanks, or a limit of 100 s, would pass on the old search too, and a letter put in an alphabet in place of a character moves neither its string count nor its answered count.
  it("keeps the limit, the sizes and the alphabets the rows above are built on", () => {
    expect([NEAR_MISS_LIMIT_MS, NEAR_MISS_SIZES, TRAILING_RUN, SEEDED_STRINGS]).toEqual([100, [20_000, 50_000, 1_000_000], 200_000, 100_000]);
    const codes = (alphabet: readonly string[]): number[] => alphabet.map((c) => c.charCodeAt(0));
    expect(codes(ALPHABET_A)).toEqual([0x20, 0x09, 0x23, 0x7c, 0x61]);
    expect(codes(ALPHABET_B)).toEqual([0x20, 0x09, 0x0d, 0x0a, 0x2028, 0x2029, 0xa0]);
    expect(codes(ALPHABET_C)).toEqual([0x20, 0x09, 0x0b, 0x0c, 0x85, 0x3000, 0xfeff, 0x78]);
  });
});

// The gap is the width of the indent of a cell option's key (less the ONE blank quarto's `| ?` takes), and the label of a cell is read only from a line that is as deep as the block's FIRST key. So the run
// that ends the text before the key decides a label, and the run before the pipe must never be taken for it. `lst-` labels are used: a `fig-` or `tbl-` label on a cell with no code is dropped by the
// no-target rule (Session 304) before the gap matters. Each answer follows from `foldedIndent` (a gap that starts with a blank is its length less one, any other is its length) and was also read off the
// parent build, where the old search ran.
describe("Session 321 — the gap decides which option line holds a label (behaviour through indexLabels)", () => {
  const labelsIn = (optionLines: string): string[] => indexLabels(`\`\`\`{python}\n${optionLines}\n\`\`\`\n`, "jupyter").map((label) => `${label.id}@${label.line}:${label.column}`);

  it.each([
    ["one blank after the pipe is the blank quarto takes: depth 0", "#| label: lst-a", ["lst-a@1:10"]],
    ["two blanks, the only option: its own depth is the block's", "#|  label: lst-a", ["lst-a@1:11"]],
    ["a key deeper than the first option is that option's data", "#| fig-cap: x\n#|  label: lst-a", []],
    ["a key shallower than the first option is skipped too", "#|  fig-cap: x\n#| label: lst-a", []],
    ["three blanks on both lines are equally deep", "#|   fig-cap: x\n#|   label: lst-a", ["lst-a@2:12"]],
    ["a tab gap is a depth of one, and it stands alone", "#|\tlabel: lst-a", ["lst-a@1:10"]],
    ["a tab gap after a one-blank option is deeper", "#| fig-cap: x\n#|\tlabel: lst-a", []],
    ["a blank and a tab after a one-blank option is deeper", "#| fig-cap: x\n#| \tlabel: lst-a", []],
    ["a blank and a tab is as deep as one tab", "#|\tfig-cap: x\n#| \tlabel: lst-a", ["lst-a@2:11"]],
    ["two tabs on both lines are equally deep", "#|\t\tfig-cap: x\n#|\t\tlabel: lst-a", ["lst-a@2:11"]],
    // The fold takes a blank off only a gap that STARTS with one; a tab counts as one column however many follow; depths are compared for equality, not by parity or by a step of one.
    ["a tab then a blank is two deep, and two blanks are one", "#|\t fig-cap: x\n#|  label: lst-a", []],
    ["gaps of four and five blanks are three and four deep", "#|    fig-cap: x\n#|     label: lst-a", []],
    ["a tab and two blanks are both one deep", "#|\tfig-cap: x\n#|  label: lst-a", ["lst-a@2:11"]],
    ["a key two columns deeper than the first option is skipped", "#| fig-cap: x\n#|   label: lst-a", []],
    ["no blank after the pipe: depth 0", "#|label: lst-a", ["lst-a@1:9"]],
    ["no blank on the first line and one on the second: depth 0 both", "#|fig-cap: x\n#| label: lst-a", ["lst-a@2:10"]],
    ["no blank on either line", "#|fig-cap: x\n#|label: lst-a", ["lst-a@2:9"]],
    // The run BEFORE the pipe is not the gap: a reading that took the first run of blanks of the text, or all of them, would see these lines as deeper.
    ["blanks before the pipe do not make the key deeper", "#   | label: lst-a", ["lst-a@1:13"]],
    ["blanks before the pipe on the first line only", "#   | fig-cap: x\n#| label: lst-a", ["lst-a@2:10"]],
    ["blanks before the pipe on the label line only, one blank after it", "#| fig-cap: x\n#   | label: lst-a", ["lst-a@2:13"]],
    ["blanks before the pipe on the label line only, two blanks after it: deeper", "#| fig-cap: x\n#   |  label: lst-a", []],
    ["tabs before the pipe on the first line only", "#\t\t| fig-cap: x\n#| label: lst-a", ["lst-a@2:10"]],
  ])("%s", (_what, optionLines, expected) => {
    expect(labelsIn(optionLines)).toEqual(expected);
  });

  // Two long gaps are compared whole: a reading that kept only the last 4,096 characters of the text before the key (a second cure for the quadratic, with the same answers on every short gap) would call these equal.
  it.each([
    ["gaps of 5,000 and 6,000 blanks are different depths", 5_000, 6_000, []],
    ["gaps of 5,000 and 5,000 blanks are the same depth", 5_000, 5_000, [`lst-a@2:${2 + 5_000 + 7}`]],
  ])("%s", (_what, first, second, expected) => {
    expect(labelsIn(`#|${" ".repeat(first)}fig-cap: x\n#|${" ".repeat(second)}label: lst-a`)).toEqual(expected);
  });

  // The prefix is read from the line with the cell's indent already taken off, because the key slot's columns count from there: a reading of the raw line would cut the text two columns early in a list item
  // and see a smaller gap. A CRLF document is split on `\r?\n`, so no carriage return stands between the key and the line's end (the two CRLF rows below are regression pins: no mutant of the list is killed by them alone).
  const labelsInListItem = (optionLines: string): string[] =>
    indexLabels(`- item\n\n  \`\`\`{python}\n${optionLines.split("\n").map((line) => `  ${line}`).join("\n")}\n  \`\`\`\n`, "jupyter").map((label) => `${label.id}@${label.line}:${label.column}`);
  const labelsInCrlf = (optionLines: string): string[] =>
    indexLabels(`\`\`\`{python}\r\n${optionLines.split("\n").join("\r\n")}\r\n\`\`\`\r\n`, "jupyter").map((label) => `${label.id}@${label.line}:${label.column}`);

  it.each([
    ["a list-item cell with a one-blank gap", "#| label: lst-a", ["lst-a@3:12"]],
    ["a list-item cell: a key deeper than the first option is skipped", "#| fig-cap: x\n#|  label: lst-a", []],
    ["a list-item cell: two blanks on both lines are equally deep", "#|  fig-cap: x\n#|  label: lst-a", ["lst-a@4:13"]],
    ["a list-item cell: a key shallower than the first option is skipped", "#|  fig-cap: x\n#| label: lst-a", []],
    ["a list-item cell: blanks before the pipe do not make the key deeper", "#| fig-cap: x\n#   | label: lst-a", ["lst-a@4:15"]],
  ])("%s", (_what, optionLines, expected) => {
    expect(labelsInListItem(optionLines)).toEqual(expected);
  });

  it.each([
    ["a CRLF document: a key deeper than the first option is skipped", "#| fig-cap: x\n#|  label: lst-a", []],
    ["a CRLF document: two blanks on both lines are equally deep", "#|  fig-cap: x\n#|  label: lst-a", ["lst-a@2:11"]],
  ])("%s", (_what, optionLines, expected) => {
    expect(labelsInCrlf(optionLines)).toEqual(expected);
  });
});
