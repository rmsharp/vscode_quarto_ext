import { describe, expect, it } from "vitest";
import { findLabel, indexLabels } from "../../src/core/refs";

// Session 338, part C of the BACKLOG item "Eleven more places that throw RangeError on a long line or a long list" (group g02), site (5): `NARROW_LABEL`, the older scan of a brace group that is NOT a Pandoc attribute block.
//
// THE DEFECT. The pattern read the group as `^#((?:fig|tbl|eq|lst)-[\p{L}\p{N}_:.-]+)` under the `u` flag. V8 keeps one entry of its regex backtrack stack per character of a class-plus over letters and numbers, and the
// entry doubles once the line holds a character above U+00FF (the subject is then stored with two bytes a character). `indexLabels` threw `RangeError: Maximum call stack size exceeded` from a group whose id is 4,194,288
// letters long after its kind prefix, and a thrown RangeError answers NOTHING for the whole document: no label index, so no completion and no go-to-definition (`findLabel` reads the same index).
//
// WHICH GROUPS REACH IT. `isAttributeBlock` takes a group that opens right after the `)` of an image or link or the `]` of a bracketed span, and a fenced div's; a valid one is read by `attributeBlockId`
// (`ATTR_ID_ALL`, another site of this item) and never reaches this pattern. The rest do: `text {#fig-ID b}` (a group the paragraph does not own, which Pandoc refuses), a table caption `: Cap {#tbl-ID b}` and display math
// `$$ x $$ {#eq-ID b}`, the three productions quarto owns itself. Every row below uses such a group.
//
// MEASURED at HEAD `fe6aaec` (Session 338, one fresh process per probe, the lower bound verified OK first, `indexLabels` and `findLabel` with no engine hint, "knitr" and "jupyter"): `{#fig-` + letters + ` b}`, last OK
// 4,194,287 letters, first throw 4,194,288, the same for `tbl-`, `eq-` and `lst-`, for a line that holds one character above U+00FF in the id AND for one that holds it after the id. A line of characters up to U+00FF does NOT
// throw at any size V8 can hold (500,000,000 letters read in 15 s; the longest string V8 allows is 536,870,888 characters): for such a subject V8 compiles the plus as a greedy loop that pushes nothing per
// character. So the Latin-1 form of every row below PASSES on the base commit and is the guard that the cure keeps its answer; the wide form of every row is the one that throws.
//
// Every wide size is about twice the first throw (Learning 775). The answer is what the old pattern gives at a size where it does not throw, stated by hand for 4 letters and a function of the run for the long one.

const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = Date.now();
  const result = run();
  return { result, ms: Date.now() - started };
};

describe("the clock helper of the Session 338 narrow label rows", () => {
  it("timed reports the milliseconds the run took and hands back its result", () => {
    const { result, ms } = timed(() => {
      const until = Date.now() + 60;
      while (Date.now() < until) {
        // spin
      }
      return "done";
    });
    expect(result).toBe("done");
    expect(ms).toBeGreaterThanOrEqual(50);
  });
});

const WIDE_LETTER = "中"; // a CJK letter above U+00FF: one such character puts the whole line on two bytes a character
const FEW = 4;
const MANY = 8_400_000; // twice 4,194,288, the first throw of the pattern (4,194,287 reads; Node 22.23, HEAD fe6aaec)
const LIMIT_MS = 10_000; // the cured read takes well under a second; the old pattern throws and a quadratic reading would take hours

type Form = "latin1" | "wide";
/** The letters of the id after the kind prefix: `n` letters, the last of them U+4E2D in the wide form (so the id itself holds the character above U+00FF). */
const runOf = (form: Form, n: number): string => (form === "latin1" ? "a".repeat(n) : "a".repeat(n - 1) + WIDE_LETTER);

type Hint = undefined | "knitr" | "jupyter";
type Entry = [id: string, kind: string, line: number, column: number];

const shown = (entries: Entry[]): unknown[] => entries.map(([id, kind, line, column]) => [id.length <= 40 ? id : `${id.slice(0, 12)}...${id.slice(-6)} (${id.length})`, kind, line, column]);
const same = (got: Entry[], want: Entry[]): boolean => got.length === want.length && got.every((g, i) => g[0] === want[i][0] && g[1] === want[i][1] && g[2] === want[i][2] && g[3] === want[i][3]);

const index = (text: string, hint: Hint): Entry[] => indexLabels(text, hint).map((l) => [l.id, l.kind, l.line, l.column]);
const lookup = (id: string) => (text: string, hint: Hint): Entry[] => {
  const found = findLabel(text, id, hint);
  return found === null ? [] : [[found.id, found.kind, found.line, found.column]];
};

interface Row {
  site: string;
  /** The document, from the letters of the id. */
  build: (run: string) => string;
  read: (text: string, run: string) => Entry[];
  answer: (run: string) => Entry[];
  /** The literal answer for the 4-letter Latin-1 run, stated by hand. */
  short: Entry[];
}

const prose = (line: (run: string) => string) => (run: string) => `Intro.\n\n${line(run)}\n`;
const textGroup = prose((run) => `text {#fig-${run} b}`);
const captionGroup = prose((run) => `: Cap {#tbl-${run} b}`);
const mathGroup = prose((run) => `$$ x $$ {#eq-${run} b}`);

describe("Session 338 — a brace group that is no attribute block, whose id has millions of letters that a pattern read as a class-plus (the BACKLOG item \"Eleven more places that throw RangeError\", site 5)", () => {
  const ROWS: Row[] = [
    { site: "indexLabels, no engine hint: `text {#fig-` + n letters + ` b}`", build: textGroup, read: (text) => index(text, undefined), answer: (run) => [[`fig-${run}`, "fig", 2, 7]], short: [["fig-aaaa", "fig", 2, 7]] },
    { site: "indexLabels with the knitr hint: the same line", build: textGroup, read: (text) => index(text, "knitr"), answer: (run) => [[`fig-${run}`, "fig", 2, 7]], short: [["fig-aaaa", "fig", 2, 7]] },
    { site: "indexLabels with the jupyter hint: the same line", build: textGroup, read: (text) => index(text, "jupyter"), answer: (run) => [[`fig-${run}`, "fig", 2, 7]], short: [["fig-aaaa", "fig", 2, 7]] },
    { site: "indexLabels: a table caption `: Cap {#tbl-` + n letters + ` b}`", build: captionGroup, read: (text) => index(text, undefined), answer: (run) => [[`tbl-${run}`, "tbl", 2, 8]], short: [["tbl-aaaa", "tbl", 2, 8]] },
    { site: "indexLabels with the knitr hint: the table caption", build: captionGroup, read: (text) => index(text, "knitr"), answer: (run) => [[`tbl-${run}`, "tbl", 2, 8]], short: [["tbl-aaaa", "tbl", 2, 8]] },
    { site: "indexLabels: display math `$$ x $$ {#eq-` + n letters + ` b}`", build: mathGroup, read: (text) => index(text, undefined), answer: (run) => [[`eq-${run}`, "eq", 2, 10]], short: [["eq-aaaa", "eq", 2, 10]] },
    { site: "indexLabels with the jupyter hint: the display math", build: mathGroup, read: (text) => index(text, "jupyter"), answer: (run) => [[`eq-${run}`, "eq", 2, 10]], short: [["eq-aaaa", "eq", 2, 10]] },
    { site: "indexLabels: a `lst-` id", build: prose((run) => `text {#lst-${run} b}`), read: (text) => index(text, undefined), answer: (run) => [[`lst-${run}`, "lst", 2, 7]], short: [["lst-aaaa", "lst", 2, 7]] },
    { site: "indexLabels: the group holds only the id (`{#fig-` + n letters + `}`)", build: prose((run) => `text {#fig-${run}}`), read: (text) => index(text, undefined), answer: (run) => [[`fig-${run}`, "fig", 2, 7]], short: [["fig-aaaa", "fig", 2, 7]] },
    {
      site: "indexLabels: the id is the LONGEST identifier prefix, the pattern is not anchored at the end (`$x` stays out)",
      build: prose((run) => `text {#fig-${run}$x b}`),
      read: (text) => index(text, undefined),
      answer: (run) => [[`fig-${run}`, "fig", 2, 7]],
      short: [["fig-aaaa", "fig", 2, 7]],
    },
    {
      site: "indexLabels: a valid attribute block on the same line is read as before, after the long group",
      build: prose((run) => `text {#fig-${run} b} ![x](y){#fig-short}`),
      read: (text) => index(text, undefined),
      answer: (run) => [[`fig-${run}`, "fig", 2, 7], ["fig-short", "fig", 2, 24 + run.length]],
      short: [["fig-aaaa", "fig", 2, 7], ["fig-short", "fig", 2, 28]],
    },
    { site: "findLabel, no engine hint: the long id of a bare group is found, with its line and column", build: textGroup, read: (text, run) => lookup(`fig-${run}`)(text, undefined), answer: (run) => [[`fig-${run}`, "fig", 2, 7]], short: [["fig-aaaa", "fig", 2, 7]] },
    { site: "findLabel with the knitr hint", build: textGroup, read: (text, run) => lookup(`fig-${run}`)(text, "knitr"), answer: (run) => [[`fig-${run}`, "fig", 2, 7]], short: [["fig-aaaa", "fig", 2, 7]] },
    { site: "findLabel with the jupyter hint", build: textGroup, read: (text, run) => lookup(`fig-${run}`)(text, "jupyter"), answer: (run) => [[`fig-${run}`, "fig", 2, 7]], short: [["fig-aaaa", "fig", 2, 7]] },
    { site: "findLabel: the table caption's id", build: captionGroup, read: (text, run) => lookup(`tbl-${run}`)(text, undefined), answer: (run) => [[`tbl-${run}`, "tbl", 2, 8]], short: [["tbl-aaaa", "tbl", 2, 8]] },
    { site: "findLabel: the display math's id", build: mathGroup, read: (text, run) => lookup(`eq-${run}`)(text, undefined), answer: (run) => [[`eq-${run}`, "eq", 2, 10]], short: [["eq-aaaa", "eq", 2, 10]] },
    {
      site: "findLabel: the SHORT label of the next line is found past the long group",
      build: (run) => `Intro.\n\ntext {#fig-${run} b}\n\ntext {#fig-ok b}\n`,
      read: (text) => lookup("fig-ok")(text, undefined),
      answer: () => [["fig-ok", "fig", 4, 7]],
      short: [["fig-ok", "fig", 4, 7]],
    },
    {
      // Hidden-site row (Learning 882): both patterns of the part in ONE document. Curing the cell's alone leaves this throwing at the group, curing the group's alone leaves it throwing at the cell.
      site: "indexLabels: a cell with a long `#| label:` AND a long bare group in one document (both sites reached)",
      build: (run) => `Intro.\n\n\`\`\`{python}\n#| label: fig-${run}\nplot()\n\`\`\`\n\ntext {#tbl-${run} b}\n`,
      read: (text) => index(text, undefined),
      answer: (run) => [[`fig-${run}`, "fig", 3, 10], [`tbl-${run}`, "tbl", 7, 7]],
      short: [["fig-aaaa", "fig", 3, 10], ["tbl-aaaa", "tbl", 7, 7]],
    },
  ];

  // The refused shapes read nothing. They are long lines too, and the Latin-1 and the wide form alike PASS on the base commit: the pattern fails at the kind prefix or at the first character of the id and never loops.
  // They guard the cure against reading more than the pattern did.
  const REFUSED: Array<{ site: string; build: (run: string) => string }> = [
    { site: "a `sec-` id is no cross-reference of this scan (section labels are the headings')", build: prose((run) => `text {#sec-${run} b}`) },
    { site: "a capital kind prefix is no kind prefix (the pattern is case-sensitive)", build: prose((run) => `text {#Fig-${run} b}`) },
    { site: "a kind prefix with a non-member right after its dash has no id", build: prose((run) => `text {#fig-$${run} b}`) },
    { site: "a kind prefix and its dash and nothing else", build: prose((run) => `text {#fig- ${run} b}`) },
    { site: "a group that does not begin with a hash", build: prose((run) => `text { #fig-${run} b}`) },
  ];

  const FORMS: Array<[Form, string]> = [
    ["latin1", "every character up to U+00FF"],
    ["wide", "the id ends in U+4E2D"],
  ];

  it.each(ROWS.flatMap((row) => FORMS.map(([form, what]) => [row.site, form, what, row] as const)))("%s [%s: %s]: is read without throwing, in linear time, and the answer is the stated one with 4 letters and with the long run", (_site, form, _what, row) => {
    expect(row.answer("aaaa")).toEqual(row.short); // the stated short answer is the function of the run at 4 Latin-1 letters
    const shortRun = runOf(form, FEW);
    expect(row.read(row.build(shortRun), shortRun)).toEqual(row.answer(shortRun));
    expect(row.read(row.build("aaaa"), "aaaa")).toEqual(row.short);
    const run = runOf(form, MANY);
    const text = row.build(run);
    expect(text.length).toBeGreaterThan(run.length); // the timed document holds the whole run
    const { result, ms } = timed(() => row.read(text, run));
    const want = row.answer(run);
    expect(shown(result)).toEqual(shown(want));
    expect(same(result, want)).toBe(true);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, 120_000);

  it.each(REFUSED.flatMap((row) => FORMS.map(([form, what]) => [row.site, form, what, row] as const)))("%s [%s: %s]: defines nothing, with 4 letters and with the long run", (_site, form, _what, row) => {
    const shortRun = runOf(form, FEW);
    expect(index(row.build(shortRun), undefined)).toEqual([]);
    const run = runOf(form, MANY);
    const text = row.build(run);
    const { result, ms } = timed(() => index(text, undefined));
    expect(result).toEqual([]);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, 120_000);

  // The character above U+00FF is not in the id at all: it stands after it in the group (`{#fig-aaa b 中}`) or in the prose before the group. The first throw is the same, 4,194,288, as measured with the id's own letter.
  it.each([
    ["after the id, in the group", (run: string) => `text {#fig-${run} b ${WIDE_LETTER}}`],
    ["in the prose before the group", (run: string) => `text ${WIDE_LETTER} {#fig-${run} b}`],
  ])("a character above U+00FF %s: the long id is read, with the answer of the Latin-1 form", (_where, line) => {
    const build = prose(line);
    expect(index(build("aaaa"), undefined).map((e) => e.slice(0, 3))).toEqual([["fig-aaaa", "fig", 2]]);
    const run = "a".repeat(MANY);
    const text = build(run);
    const { result, ms } = timed(() => index(text, undefined));
    expect(result.length).toBe(1);
    expect(result[0][0] === `fig-${run}`).toBe(true);
    expect(result[0].slice(1, 3)).toEqual(["fig", 2]);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, 120_000);

  it("builds a different document for every row", () => {
    const texts = ROWS.map((row) => row.build("aaaa"));
    expect(new Set(texts).size).toBe(9); // the engine-hint and findLabel rows share their documents: 9 documents for 18 rows
    expect(new Set(REFUSED.map((row) => row.build("aaaa"))).size).toBe(REFUSED.length);
  });

  it("keeps the sizes, the limit and the character the Session 338 narrow label rows are built on", () => {
    expect([FEW, MANY, LIMIT_MS, WIDE_LETTER.charCodeAt(0)]).toEqual([4, 8_400_000, 10_000, 0x4e2d]);
    expect(MANY).toBeGreaterThanOrEqual(2 * 4_194_288); // twice the first throw (4,194,288 at HEAD fe6aaec; 4,194,287 reads)
    expect(runOf("wide", 5)).toBe("aaaa中");
    expect(runOf("latin1", 5)).toBe("aaaaa");
    expect(ROWS.length).toBe(18);
    expect(REFUSED.length).toBe(5);
  });
});
