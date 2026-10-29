import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";
import { buildOutline, findAllCells, findHeadings } from "../../src/core/qmd/model";
import type { OutlineSymbol } from "../../src/core/qmd/model";
import { findLabel, indexLabels } from "../../src/core/refs";

const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = Date.now();
  const result = run();
  return { result, ms: Date.now() - started };
};

describe("Session 337 — a single line of millions of characters that the empty native-div pattern read as a quantified group (the BACKLOG item \"Eight more single-line RangeError shapes and three more quadratic ones\", part 4)",
  // The class of Sessions 335 and 336: V8 keeps one entry of its regex backtrack stack per repetition of a GROUP, and `endsHtmlBlock` asked whether a line is an EMPTY NATIVE DIV (`<div ...></div>`, opened and closed on one
  // line) with `^[ \t]*<div\b(?:[^>"']|"[^"]*"|'[^']*')*>[ \t]*<\/div>[ \t]*$`, a group per character of the attribute block. Under a reader that turns raw HTML off and leaves native divs on
  // (`from: markdown-raw_html`) the question is asked of the line above a `---` line and above an indent-4 `{bash}` opener, and a line of 8,388,570 repetitions of `a` after `<div ` threw `RangeError: Maximum call stack size
  // exceeded` in every scan-based entry. Bisected at HEAD `8ebce73` (Session 337, Node 22.23.3, one fresh process per probe, lower bound verified OK first, Learning 885): `findHeadings` of `<div ` + `a` x N reads at 8,388,569 and throws at
  // 8,388,570 (the item's figure holds); the unit ` a` throws from 4,194,285 (the item said 4,194,286); a unit `a="b" ` (four repetitions of the group, the quoted string heavier on the stack) from 1,525,195; the same in all twelve
  // entries below, and with a heading or a blank line below the line the pattern is not asked. Every size here is twice that (Learning 775), counted in REPETITIONS OF THE UNIT, and a line this long is a pasted or minified blob.
  // Only the jupyter-hinted `findHeadings` and `buildOutline` can SEE the answer of the question (an indented `{bash}` opener is code to the kernel's own-indent rule, so `In` is listed or swallowed by it); every other entry
  // answers the same either way, so those rows state "no throw, the same answer as the short run", and the rows built on a line that does NOT match (text after the closer) pin the other branch.
  () => {
    const S337_FEW = 4;
    // 4 s: the same text with the pattern answered `false` by a constant (the cost of the rest of a scan of a 16.8-million-character line) takes 270 to 460 ms in the twelve entries (Session 337, a bundle of the parent with the test
    // replaced by `false`, a fresh process per entry); a quadratic reading of that line would take hours, so the limit still tells the two apart.
    const S337_LIMIT_MS = 4000;
    const FRONT = "---\nfrom: markdown-raw_html\n---\n\n";
    const FRONT_KNITR = "---\nengine: knitr\nfrom: markdown-raw_html\n---\n\n";
    const OPENER = "    ```{bash}\n";
    const CLOSER = "    ```\n";

    // the long line is its own setext heading text where a dash line underlines it: its first eight characters stand for it
    const headings = (hint: "knitr" | "jupyter" | undefined) => (text: string): string[] => findHeadings(text, hint).map((h) => h.text.slice(0, 8));
    const outlineNames = (hint: "knitr" | "jupyter" | undefined) => (text: string): string[] => {
      const names = (nodes: readonly OutlineSymbol[]): string[] => nodes.flatMap((n) => [n.name.slice(0, 8), ...names(n.children)]);
      return names(buildOutline(text, hint));
    };
    const cells = (text: string): Array<[string, number, number]> => findAllCells(text).map((c) => [c.lang, c.startLine, c.endLine]);
    const labels = (hint: "knitr" | "jupyter" | undefined) => (text: string): Array<[string, number]> => indexLabels(text, hint).map((l) => [l.id, l.line]);
    const labelAt = (hint: "knitr" | undefined) => (text: string): [string, number] | null => {
      const found = findLabel(text, "fig-a", hint);
      return found === null ? null : [found.id, found.line];
    };
    const engine = (text: string): string | undefined => resolveDocumentEngine("a.qmd", text);

    // the line, and what stands directly below it (the two places the pattern is asked)
    const aboveDash = (lead: string) => (line: string): string => `${FRONT}${lead}\n\n${line}\n---\n\n# H\n`;
    const aboveOpener = (lead: string) => (line: string): string => `${FRONT}${lead}\n\n${line}\n${OPENER}    x\n${CLOSER}\n# H\n`;
    // `## In` sits inside the indented `{bash}` opener: listed (a real heading) if the line above ENDED a block, swallowed if it did not
    const stacked = (lead: string, front = FRONT) => (line: string): string => `${front}## Before\n\n${lead}\n\n${line}\n${OPENER}## In\nx = 1\n${CLOSER}\n## After\n`;
    const withLabels = (lead: string, lang: string) => (line: string): string => `${FRONT}## Before\n\n${lead}\n\n${line}\n    \`\`\`{${lang}}\n#| label: fig-a\n## In\nx = 1\n${CLOSER}\n## After\n\n![c](y.png){#fig-b}\n`;
    const div = (run: string): string => `<div ${run}></div>`;

    type S337Row = { site: string; unit: string; many: number; few?: number; limitMs?: number; build: (run: string) => string; read: (text: string) => unknown; answer: unknown };
    const A = "a";
    const MANY = 16_800_000; // twice 8,388,570 repetitions of `a`, rounded up
    const rowOf = (site: string, build: (line: string) => string, read: (text: string) => unknown, answer: unknown, line: (run: string) => string = div, unit = A, many = MANY): S337Row =>
      ({ site, unit, many, build: (run) => build(line(run)), read, answer });
    const LISTED = ["Before", "In", "After"];
    const SWALLOWED = ["Before", "After"];
    const LABELS: Array<[string, number]> = [["fig-a", 10], ["fig-b", 17]];

    const S337_ROWS: S337Row[] = [
      // findHeadings, the three hints the providers pass (none, the knitr engine, the jupyter engine).
      rowOf("findHeadings, no hint: the line above a dash line", aboveDash("Intro one."), headings(undefined), ["<div aaa", "H"]),
      rowOf("findHeadings, no hint: the line above an indent-4 opener", aboveOpener("Intro two."), headings(undefined), ["H"]),
      rowOf("findHeadings, knitr hint: the line above a dash line", aboveDash("Intro three."), headings("knitr"), ["<div aaa", "H"]),
      rowOf("findHeadings, knitr hint: `In` inside the opener is swallowed", stacked("Lead four."), headings("knitr"), SWALLOWED),
      rowOf("findHeadings, jupyter hint: `In` inside the opener is LISTED (the line above is an empty div that ended its block)", stacked("Lead five."), headings("jupyter"), LISTED),
      rowOf("findHeadings, jupyter hint: the line above an indent-4 opener", aboveOpener("Intro six."), headings("jupyter"), ["H"]),
      // buildOutline, the three hints.
      rowOf("buildOutline, no hint: the line above a dash line", aboveDash("Outline one."), outlineNames(undefined), ["<div aaa", "H"]),
      rowOf("buildOutline, knitr hint: the line above an indent-4 opener", aboveOpener("Outline two."), outlineNames("knitr"), ["```{bash", "H"]),
      rowOf("buildOutline, jupyter hint: `In` is a section of its own", stacked("Outline three."), outlineNames("jupyter"), LISTED),
      // the cells, the label index and `findLabel` (the cross-reference completion and definition), the engine resolver.
      rowOf("findAllCells: the cell below the line", stacked("Cells one."), cells, [["bash", 9, 12]]),
      rowOf("findAllCells: the cell above a closer", aboveOpener("Cells two."), cells, [["bash", 7, 9]]),
      rowOf("indexLabels, no hint: a label in the cell below and one after", withLabels("Labels one.", "r"), labels(undefined), LABELS),
      rowOf("indexLabels, knitr hint", withLabels("Labels two.", "r"), labels("knitr"), LABELS),
      rowOf("indexLabels, jupyter hint", withLabels("Labels three.", "python"), labels("jupyter"), LABELS),
      rowOf("findLabel, no hint", withLabels("Find one.", "r"), labelAt(undefined), ["fig-a", 10]),
      rowOf("findLabel, knitr hint", withLabels("Find two.", "r"), labelAt("knitr"), ["fig-a", 10]),
      rowOf("resolveDocumentEngine: a declared engine and a dash line below the line", (line) => `${FRONT_KNITR}Engine one.\n\n${line}\n---\n\n# H\n`, engine, "knitr"),
      rowOf("resolveDocumentEngine: a bash cell below the line", stacked("Engine two."), engine, "jupyter"),
      // the same pattern at other places in the line (jupyter hint, where the answer shows it): an indent of one or three spaces (a tab is four columns, indented code, and the pattern is never asked of it), the capital spelling, blanks around the closer, the other unit, quoted attribute values,
      // a `>` inside a quoted value, and a line that is NOT an empty div (text after the opener's `>`), which the pattern also reads to the end of the line before it says no.
      rowOf("jupyter hint: indented three spaces", stacked("Where one."), headings("jupyter"), LISTED, (run) => `   ${div(run)}`),
      rowOf("jupyter hint: indented by one space", stacked("Where two."), headings("jupyter"), LISTED, (run) => ` ${div(run)}`),
      rowOf("jupyter hint: the capital spelling", stacked("Where three."), headings("jupyter"), LISTED, (run) => `<DIV ${run}></DIV>`),
      rowOf("jupyter hint: blanks between the angle and the closer, and after it", stacked("Where four."), headings("jupyter"), LISTED, (run) => `<div ${run}>  </div>  `),
      rowOf("jupyter hint: the unit ` a` (two characters, one repetition of the group each)", stacked("Where five."), headings("jupyter"), LISTED, (run) => `<div${run}></div>`, " a", 8_400_000),
      rowOf("jupyter hint: double-quoted attribute values (four repetitions of the group a unit, each heavier on the stack)", stacked("Where six."), headings("jupyter"), LISTED, (run) => `<div ${run}></div>`, 'a="b" ', 3_100_000),
      rowOf("jupyter hint: single-quoted attribute values", stacked("Where seven."), headings("jupyter"), LISTED, (run) => `<div ${run}></div>`, "a='b' ", 3_100_000),
      rowOf("jupyter hint: a `>` inside quoted values after the run is not the end of the tag", stacked("Where eight."), headings("jupyter"), LISTED, (run) => `<div ${run} t="a>b" u='c>d'></div>`),
      rowOf("jupyter hint: text after the opener's `>` is no empty div, so `In` is swallowed", stacked("Where nine."), headings("jupyter"), SWALLOWED, (run) => `<div ${run}>x</div>`),
      rowOf("jupyter hint: text after the closer is no empty div either, so `In` is swallowed", stacked("Where ten."), headings("jupyter"), SWALLOWED, (run) => `<div ${run}></div> x`),
      rowOf("knitr hint, outline: the capital spelling above an indent-4 opener", aboveOpener("Where eleven."), outlineNames("knitr"), ["```{bash", "H"], (run) => `<DIV ${run}></DIV>`),
    ];

    it.each(S337_ROWS.map((row) => [row.site, row] as const))("%s: is read without throwing, in linear time, and the answer is the stated one with 4 units and with the long run", (_site, row) => {
      const short = row.build(row.unit.repeat(row.few ?? S337_FEW));
      expect(row.read(short)).toEqual(row.answer);
      const run = row.unit.repeat(row.many);
      const longText = row.build(run);
      expect(longText.length).toBeGreaterThan(run.length); // the timed text holds the whole run
      const { result, ms } = timed(() => row.read(longText));
      expect(result).toEqual(row.answer);
      expect(ms).toBeLessThan(row.limitMs ?? S337_LIMIT_MS);
    }, 120_000);

    // The reader gate in front of the question is not a RED row (the parent answers the same, and so does `emptyNativeDivLine` for a short line): an empty native div ends its block where raw HTML is off and native divs are
    // ON, and where native divs are off too it is raw text that runs on (the same lines through the parent `8ebce73` and through the cure give the same headings, Session 337; not read against pandoc: the answers are the parent's).
    it.each<[string, string[]]>([
      ["markdown-raw_html", LISTED],
      ["markdown-raw_html-native_divs", SWALLOWED],
      ["markdown_strict-raw_html", SWALLOWED],
    ])("the empty native div above an indent-4 opener under `from: %s`: the heading inside the opener is %j", (reader, expected) => {
      const text = `---\nfrom: ${reader}\n---\n\n## Before\n\nProse before.\n\n<div a="b>c"></div>\n${OPENER}## In\nx = 1\n${CLOSER}\n## After\n`;
      expect(headings("jupyter")(text)).toEqual(expected);
    });

    it("builds a different text for every row", () => {
      // The TEXT alone: `scanRegions` keeps the last two scans by text, so a row whose text another row read just before it is served from the cache and cannot be RED.
      const small = S337_ROWS.map((row) => row.build(row.unit.repeat(row.few ?? S337_FEW)));
      expect(new Set(small).size).toBe(S337_ROWS.length);
    });

    // The parent THROWS from 8,388,570 repetitions of `a` (4,194,285 of ` a`, 1,525,195 of `a="b" `), so no limit passes it there; a run below that, or a unit that is not the throwing one, would pass on it, and a limit of
    // minutes would pass a quadratic cure.
    it("keeps the sizes, the limit and the units the Session 337 rows are built on", () => {
      expect([S337_FEW, S337_LIMIT_MS]).toEqual([4, 4000]);
      expect(S337_ROWS.length).toBe(29);
      expect(S337_ROWS.map((row) => `${row.unit}x${row.many}`)).toEqual([
        ...Array.from({ length: 22 }, () => "ax16800000"),
        " ax8400000", 'a="b" x3100000', "a='b' x3100000",
        ...Array.from({ length: 4 }, () => "ax16800000"),
      ]);
      expect(S337_ROWS.every((row) => row.limitMs === undefined && row.few === undefined)).toBe(true);
    });
  },
);
