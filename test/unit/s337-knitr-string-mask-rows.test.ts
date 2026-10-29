import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";
import { buildOutline, findHeadings } from "../../src/core/qmd/model";
import type { OutlineSymbol } from "../../src/core/qmd/model";
import { findLabel, indexLabels } from "../../src/core/refs";

// Session 337, part 7 of the BACKLOG item "Eight more single-line RangeError shapes and three more quadratic ones" — the unnamed-argument string mask of `knitrHeaderOptions`.
//
// The class of Sessions 317, 335 and 336: V8 keeps one entry of its regex backtrack stack per repetition of a quantified GROUP, so `segment.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""')`
// (the mask that blanks the strings of a chunk header's UNNAMED argument before the argument is judged) throws `RangeError: Maximum call stack size exceeded` once ONE string is long enough, and the error reaches
// every reader of the document. Measured at HEAD `8ebce73`, one fresh process per probe, Node 22.23.3, `findHeadings(text, "knitr")` on `` ```{r, "bbb…"} ``: the lower bound 8,388,573 repetitions READS (verified OK
// first, Learning 885), 8,388,574 THROWS, for a double-quoted string, a single-quoted one, a later slot, the first slot and `\a` pairs (one repetition a pair) alike; the stack top is `String.replace` in `knitrHeaderOptions`
// (`model.ts:8805`) under `knitrChunkIsSilent`, `knitrSilentChunkClosers`, `computeRegions` and `scanRegions`. It is reached ONLY with the knitr hint, which the providers pass (Learning 886): `findHeadings` and `buildOutline`
// throw in both render modes, `indexLabels` and `findLabel` do not (see the label rows), and no other hint, `findAllCells` or `resolveDocumentEngine` does. The assignment form `a="…"` never reaches the mask.
// Every size below is twice that figure (Learning 775): a run just under the limit cannot pass, and a unit that is not the throwing one cannot either.
const FIRST_THROW = 8_388_574;
// What the headings and the Outline of the document below are WHEN THE CHUNK IS READ AS SILENT. The document is the shape the knitr silence rows use (`qmd-model.test.ts`, "R6 residual (d)"): a stray bare fence above a chunk
// swallows the heading under it when the chunk is loud, and shows it when the chunk is silent, and a chunk with `echo=FALSE` and an UNNAMED string is silent only when the string is blanked first (an unnamed argument that is
// not blank is an argument the reader cannot judge, and it declines the header). So the heading list is the answer that depends on the mask, and the parent has no answer at all for a long string.
const BOTH = ["Heading Under Test", "Heading After Chunk"];
const SILENT_OUTLINE = ["heading:Heading Under Test@4-9", "cell:```{r}@6-8", "heading:Heading After Chunk@10-13"];

const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = Date.now();
  const result = run();
  return { result, ms: Date.now() - started };
};

describe("Session 337 part 7 — the string mask of a knitr chunk header's unnamed argument, on a single line of millions of characters", () => {
  const FEW = 4;
  // 4 s, the limit of Session 336's comment rows. With the cure in, whole rows (the text built, the short control read and the long read) took 197 to 452 ms each, run alone (`--reporter=json`; the slowest are the label rows, 452 ms, and the 33.6-million-character
  // `\a` pairs, 400 ms), so the limit is more than eight times the slowest and under the 10 s ceiling; the timed read is part of that. The parent has no time to compare because it throws in about 120 ms.
  const LIMIT_MS = 4000;
  const MANY = 16_800_000;
  /** A document with a stray bare fence above one chunk; `lead` only makes the text differ from every other row's. */
  const stray = (lead: string, header: string): string =>
    [lead, "", "```", "", "## Heading Under Test", "", "```{" + header + "}", "x <- 1", "```", "", "## Heading After Chunk", "", "tail prose", ""].join("\n");
  const flat = (symbols: OutlineSymbol[]): string[] =>
    symbols.flatMap((s) => [`${s.kind}:${s.name.slice(0, 22)}@${s.startLine}-${s.endLine}`, ...flat(s.children)]);
  const knitrHeadings = (text: string): string[] => findHeadings(text, "knitr").map((h) => h.text);
  const noExecuteHeadings = (text: string): string[] => findHeadings(text, "knitr", "no-execute").map((h) => h.text);
  const resolvedHeadings = (text: string): string[] => findHeadings(text, resolveDocumentEngine("a.qmd", text)).map((h) => h.text);
  const knitrOutline = (text: string): string[] => flat(buildOutline(text, "knitr"));
  const noExecuteOutline = (text: string): string[] => flat(buildOutline(text, "knitr", "no-execute"));
  // what the providers call: `buildOutline(text, resolveDocumentEngine(document.fileName, text), mode)` (outline.ts, workspace-symbols.ts)
  const resolvedOutline = (text: string): string[] => flat(buildOutline(text, resolveDocumentEngine("a.qmd", text)));
  const knitrLabels = (text: string): Array<[string, number]> => indexLabels(text, "knitr").map((l) => [l.id, l.line]);
  const resolvedLabels = (text: string): Array<[string, number]> => indexLabels(text, resolveDocumentEngine("a.qmd", text)).map((l) => [l.id, l.line]);
  /** A figure cell whose label the document's own header option hides (`include=FALSE`), so the index must NOT list it. */
  const hiddenFigure = (lead: string, header: string): string => [lead, "", "```{" + header + "}", "plot(1)", "```", ""].join("\n");

  type Row = { site: string; unit: string; many: number; few?: number; red?: "throws" | "answer" | "green"; build: (run: string) => string; read: (text: string) => unknown; answer: unknown };
  const ROWS: Row[] = [
    // The item's own shape and the variants it names: a double-quoted string, a single-quoted one, a later slot, the first slot, `\a` pairs. The unit holds the OTHER quote and, in the first slot, a blank, so a mask that closed at the
    // wrong quote or left a blank in the slot would change the answer.
    { site: 'a double-quoted string after `echo=FALSE` (unit `b\'`)', unit: "b'", many: MANY / 2, build: (run) => stray("dq later slot", `r, echo=FALSE, "${run}"`), read: knitrHeadings, answer: BOTH },
    { site: "a single-quoted string after `echo=FALSE` (unit `b\"`)", unit: 'b"', many: MANY / 2, build: (run) => stray("sq later slot", `r, echo=FALSE, '${run}'`), read: knitrHeadings, answer: BOTH },
    { site: "`\\a` pairs, one repetition a pair, in a double-quoted string (33.6 million characters)", unit: "\\a", many: MANY, build: (run) => stray("pairs later slot", `r, echo=FALSE, "${run}"`), read: knitrHeadings, answer: BOTH },
    { site: "`\\a` pairs in a single-quoted string", unit: "\\a", many: MANY, build: (run) => stray("pairs sq later slot", `r, echo=FALSE, '${run}'`), read: knitrHeadings, answer: BOTH },
    { site: "the FIRST slot (unit `b c`, whose blank the first slot's class would refuse unmasked)", unit: "b c", many: MANY / 3, build: (run) => stray("first slot", `r "${run}", echo=FALSE`), read: knitrHeadings, answer: BOTH },
    { site: "a call that holds the string: `c(\"…\")`", unit: "b", many: MANY, build: (run) => stray("call", `r, echo=FALSE, c("${run}")`), read: knitrHeadings, answer: BOTH },
    // `a==""` is no assignment (its value starts with `=`) and no unnamed argument either, so the reader DECLINES the header and the chunk is loud, the heading is swallowed: the answer is the loud one with 4 units and with the long run.
    { site: "an `a==\"…\"` argument, which the assignment reader declines and the mask reads (the header is declined, the chunk stays loud)", unit: "b", many: MANY, build: (run) => stray("eqeq", `r, echo=FALSE, a=="${run}"`), read: knitrHeadings, answer: ["Heading After Chunk"] },
    { site: "the item's literal shape: `{r, \"b…\"}` over a heading", unit: "b", many: MANY, build: (run) => `Intro.\n\n\`\`\`{r, "${run}"}\n1\n\`\`\`\n\n# H\n`, read: knitrHeadings, answer: ["H"] },
    // The other entries and render modes the providers use.
    { site: "the Outline with the knitr hint", unit: "b", many: MANY, build: (run) => stray("outline knitr", `r, echo=FALSE, "${run}"`), read: knitrOutline, answer: SILENT_OUTLINE },
    { site: "the Outline with the RESOLVED engine, as the providers call it", unit: "b", many: MANY, build: (run) => stray("outline resolved", `r, echo=FALSE, "${run}"`), read: resolvedOutline, answer: SILENT_OUTLINE },
    { site: "the headings with the resolved engine", unit: "b", many: MANY, build: (run) => stray("headings resolved", `r, echo=FALSE, "${run}"`), read: resolvedHeadings, answer: BOTH },
    { site: "the headings under `--no-execute`", unit: "b", many: MANY, build: (run) => stray("headings no-execute", `r, echo=FALSE, "${run}"`), read: noExecuteHeadings, answer: BOTH },
    { site: "the Outline under `--no-execute`", unit: "b", many: MANY, build: (run) => stray("outline no-execute", `r, echo=FALSE, "${run}"`), read: noExecuteOutline, answer: SILENT_OUTLINE },
    // The label index does NOT throw: it catches the RangeError (`refs.ts`, `readsNoTarget`) and answers "this cell makes a target", so a long string keeps a label the short run of the same header removes. These rows are RED by
    // that wrong answer, not by a throw: the parent lists `fig-a` for the long string and not for four units.
    { site: "the label index: a hidden figure cell, the string in a later slot (wrong ANSWER on the parent, no throw)", unit: "b", many: MANY, red: "answer", build: (run) => hiddenFigure("labels knitr", `r, label="fig-a", include=FALSE, "${run}"`), read: knitrLabels, answer: [] },
    { site: "the label index with the resolved engine (wrong ANSWER on the parent)", unit: "b", many: MANY, red: "answer", build: (run) => hiddenFigure("labels resolved", `r, label="fig-a", include=FALSE, '${run}'`), read: resolvedLabels, answer: [] },
    { site: "the label lookup the cross-reference definition calls (wrong ANSWER on the parent)", unit: "b", many: MANY, red: "answer", build: (run) => hiddenFigure("find label", `r, label="fig-a", include=FALSE, c("${run}")`), read: (text) => findLabel(text, "fig-a", "knitr")?.line ?? null, answer: null },
    // A CONTROL that is green on the parent and must stay so: with no `include=FALSE` the cell makes its figure, so the label stays listed whatever the string does.
    { site: "CONTROL, green on the parent: a figure cell that is not hidden keeps its label", unit: "b", many: MANY, red: "green", build: (run) => hiddenFigure("labels kept", `r, label="fig-a", "${run}"`), read: knitrLabels, answer: [["fig-a", 2]] },
  ];

  it.each(ROWS.map((row) => [row.site, row] as const))("%s: is read without throwing, in linear time, and the answer is the stated one with 4 units and with the long run", (_site, row) => {
    const short = row.build(row.unit.repeat(row.few ?? FEW));
    expect(row.read(short)).toEqual(row.answer);
    const run = row.unit.repeat(row.many);
    const longText = row.build(run);
    expect(longText.length).toBeGreaterThan(run.length); // the timed text holds the whole run
    const { result, ms } = timed(() => row.read(longText));
    expect(result).toEqual(row.answer);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, 120_000);

  it("builds a different text for every row", () => {
    // The TEXT alone: `scanRegions` keeps the last two scans by text, so a row whose text another row read just before it is served from the cache and cannot be RED.
    const small = ROWS.map((row) => row.build(row.unit.repeat(row.few ?? FEW)));
    expect(new Set(small).size).toBe(ROWS.length);
  });

  // The parent THROWS from 8,388,574 repetitions of the group (a character, or an `\a` pair), so no limit passes it there; a run below that, or a unit that is not the throwing one, would pass on it, and a limit of minutes would
  // pass a quadratic cure.
  it("keeps the sizes, the limit and the units the Session 337 rows are built on", () => {
    expect([FIRST_THROW, FEW, LIMIT_MS, MANY]).toEqual([8_388_574, 4, 4000, 16_800_000]);
    expect(ROWS.map((row) => `${row.unit}x${row.many}`)).toEqual([
      "b'x8400000", 'b"x8400000', "\\ax16800000", "\\ax16800000", "b cx5600000",
      ...Array.from({ length: 12 }, () => "bx16800000"),
    ]);
    // repetitions of the group: one a character, one a pair for `\a`; every row is at least twice the measured first throw
    const repetitions = (row: Row): number => (row.unit === "\\a" ? row.many : row.unit.length * row.many);
    expect(ROWS.map((row) => repetitions(row) >= 2 * FIRST_THROW)).toEqual(ROWS.map(() => true));
    expect(ROWS.map((row) => row.red ?? "throws")).toEqual([
      ...Array.from({ length: 13 }, () => "throws"),
      "answer", "answer", "answer", "green",
    ]);
  });
});
