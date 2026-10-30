import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";
import {
  buildOutline,
  findAllCells,
  findBodyLines,
  findCellOptionLines,
  findCodeFenceOpeners,
  findFrontMatter,
  findHeadings,
  type OutlineSymbol,
} from "../../src/core/qmd/model";
import { findLabel, indexLabels } from "../../src/core/refs";

// Session 339 — the BACKLOG item "Three more quadratic single-line shapes", part (9). `lastRawTexEnvEnd` (model.ts, run once per document over EVERY line, whatever region the line sits in) and the
// `\end{}` probe inside `computeRegions` (run on a line that STARTS with an `\end{name}`) both read the line with `/\\end\{([^}]*)\}/g`. An `\end{` with no `}` after it fails only after `[^}]*` has read
// to the end of the line, and the scan then restarts at the next `\end{`: a line of `\end{` repeated n times with no `}` costs n squared. Measured at `4d1944c` (Session 339, one fresh process per
// timing, Node 22, `findHeadings`, load 3 to 4): `\end{` x 10,000 (50,000 characters) 239 ms, x 20,000 944 ms, x 40,000 3,755 ms; a line that starts with `\end{a}` and then repeats `\end{` pays the scan
// twice (the document reader and the probe): x 20,000 1,886 ms, x 40,000 7,540 ms. Every one of the eight readers of the document that was tried reaches the first scan (`findHeadings`, `findAllCells`,
// `buildOutline`, `indexLabels`, `findCodeFenceOpeners`, `findBodyLines`, `findCellOptionLines`, `findFrontMatter`: 938 to 949 ms each at x 20,000), and so do the thin views (`findLabel`,
// `resolveDocumentEngine`, `frontMatterContentLines`, `inFrontMatter`); the probe is reached through the same entries. A line of two-byte characters (V8 runs another regex path on it) costs the same
// (`\end{` + U+0100, x 20,000: 1,139 ms).
//
// WHAT THE ANSWER IS. An `\end{` with no `}` after it matches nothing, so the line closes no environment and moves no stack: a `\begin{x}` above it with no `\end{x}` below is plain text, which leaves
// a paragraph open across the ATX line below it (no heading), while a `\begin{x}` whose `\end{x}` is on the line (or below it) interrupts the paragraph (the heading is found). Every answer below is what the
// PARENT gives at n = 3: this file's short assertion (`FEW`) passes at `4d1944c` and states each of them, and the long assertion of the same row states the same answer.
//
// THE CLOCK. The limit is one second for 40,000 repeats (200,000 or 240,000 characters). The parent takes 3.7 s or more on the first scan alone; a linear reader takes a few milliseconds. It is not raised
// to make a row pass. The control rows (a shape that is linear today and must stay so) are written to pass on the parent.

const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = performance.now();
  const result = run();
  return { result, ms: performance.now() - started };
};

describe("the Session 339 clock helper", () => {
  it("timed reports the milliseconds the run took and hands back its result", () => {
    const { result, ms } = timed(() => {
      const started = performance.now();
      while (performance.now() - started < 30) {
        /* spin */
      }
      return "done";
    });
    expect(result).toBe("done");
    expect(ms).toBeGreaterThanOrEqual(25);
  });
});

describe("Session 339 — a line that repeats `\\end{` with no `}`, read by the raw-TeX `\\end{}` index and probe (the BACKLOG item \"Three more quadratic single-line shapes\", part 9)", () => {
  const FEW = 3;
  const MANY = 40_000;
  const LIMIT_MS = 1000;
  const CONTROL_MANY = 200_000;
  const WIDE = "\\end{" + String.fromCharCode(0x100);

  const names = (text: string): string[] => findHeadings(text).map((h) => h.text);
  const flat = (symbols: OutlineSymbol[]): string[] => symbols.flatMap((s) => [`${s.kind}:${s.name}`, ...flat(s.children)]);

  /** The line, a blank line, an ATX heading, a label, a cell with an option line, a plain fence: lines 0, 1, 2, 4, 6 to 9, 11 to 13. */
  const doc = (id: string, line: string): string =>
    `${line}\n\n# H${id}\n\n![x](y){#fig-${id}}\n\n\`\`\`{r}\n#| echo: false\n1\n\`\`\`\n\n\`\`\`text\nplain\n\`\`\`\n`;

  type Row = { site: string; many?: number; build: (n: number) => string; read: (text: string) => unknown; answer: unknown };

  const ROWS: Row[] = [
    // The first scan, `\end{` x n alone on a line, through every reader that reaches it.
    { site: "findHeadings", build: (n) => doc("a01", "\\end{".repeat(n)), read: names, answer: ["Ha01"] },
    { site: "findHeadings with the knitr hint", build: (n) => doc("a02", "\\end{".repeat(n)), read: (text) => findHeadings(text, "knitr").map((h) => h.text), answer: ["Ha02"] },
    { site: "buildOutline", build: (n) => doc("a03", "\\end{".repeat(n)), read: (text) => flat(buildOutline(text)), answer: ["heading:Ha03", "cell:```{r}"] },
    { site: "findAllCells", build: (n) => doc("a04", "\\end{".repeat(n)), read: (text) => findAllCells(text).map((c) => [c.startLine, c.endLine]), answer: [[6, 9]] },
    { site: "findCellOptionLines", build: (n) => doc("a05", "\\end{".repeat(n)), read: (text) => findCellOptionLines(text).map((o) => o.line), answer: [7] },
    { site: "findCodeFenceOpeners", build: (n) => doc("a06", "\\end{".repeat(n)), read: (text) => findCodeFenceOpeners(text).map((o) => o.line), answer: [11] },
    { site: "findBodyLines", build: (n) => doc("a07", "\\end{".repeat(n)), read: (text) => findBodyLines(text).map((b) => b.line), answer: [0, 1, 2, 3, 4, 5, 10, 14] },
    { site: "findFrontMatter", build: (n) => doc("a08", "\\end{".repeat(n)), read: findFrontMatter, answer: null },
    { site: "indexLabels", build: (n) => doc("a09", "\\end{".repeat(n)), read: (text) => indexLabels(text).map((l) => [l.id, l.line]), answer: [["fig-a09", 4]] },
    { site: "findLabel", build: (n) => doc("a10", "\\end{".repeat(n)), read: (text) => findLabel(text, "fig-a10")?.line, answer: 4 },
    { site: "resolveDocumentEngine", build: (n) => doc("a11", "\\end{".repeat(n)), read: (text) => resolveDocumentEngine("a.qmd", text), answer: "knitr" },
    // The same scan on a line of two-byte characters.
    { site: "findHeadings, a line holding U+0100 (two-byte)", build: (n) => doc("w01", WIDE.repeat(n)), read: names, answer: ["Hw01"] },
    { site: "buildOutline, a line holding U+0100 (two-byte)", build: (n) => doc("w02", WIDE.repeat(n)), read: (text) => flat(buildOutline(text)), answer: ["heading:Hw02", "cell:```{r}"] },
    // The place of the line: inside a code fence and inside a block quote (the index reads EVERY line, unanchored).
    { site: "inside a code fence", build: (n) => `\`\`\`\n${"\\end{".repeat(n)}\n\`\`\`\n\n# Hf01\n`, read: names, answer: ["Hf01"] },
    { site: "behind a block quote marker", build: (n) => `> ${"\\end{".repeat(n)}\n\n# Hq01\n`, read: names, answer: ["Hq01"] },
    // The answer depends on the index: an `\end{x}` is or is not on the line. Under an open paragraph, a `\begin{x}` with no `\end{x}` is text, so the ATX line below it is no heading.
    { site: "after a `\\begin{x}` line, the run alone: the environment is never closed, so the ATX line below it is no heading", build: (n) => `para\n\\begin{x}\n${"\\end{".repeat(n)}\n# Hb01\n`, read: names, answer: [] },
    { site: "on the `\\begin{x}` line, behind its `}`: still never closed", build: (n) => `para\n\\begin{x}${"\\end{".repeat(n)}\n# Hb02\n`, read: names, answer: [] },
    { site: "on the `\\begin{x}` line behind its own `\\end{x}`: closed where it stands, so the ATX line is a heading", build: (n) => `para\n\\begin{x}\\end{x}${"\\end{".repeat(n)}\n# Hb03\n`, read: names, answer: ["Hb03"] },
    // The probe: a line that STARTS with an `\end{name}` is read again, LIFO, against the stack of open environments.
    { site: "a line that starts with `\\end{a}` and then repeats `\\end{`: one pop", build: (n) => `para\n\\begin{a}\nbody\n\\end{a}${"\\end{".repeat(n)}\n# Hp01\n`, read: names, answer: ["Hp01"] },
    { site: "the same, indented two spaces", build: (n) => `para\n\\begin{a}\nbody\n  \\end{a}${"\\end{".repeat(n)}\n# Hp02\n`, read: names, answer: ["Hp02"] },
    { site: "buildOutline of the same", build: (n) => `para\n\\begin{a}\nbody\n\\end{a}${"\\end{".repeat(n)}\n# Hp03\n`, read: (text) => flat(buildOutline(text)), answer: ["heading:Hp03"] },
    { site: "findAllCells of the same, with a cell below", build: (n) => `para\n\\begin{a}\nbody\n\\end{a}${"\\end{".repeat(n)}\n# Hp04\n\n\`\`\`{r}\n1\n\`\`\`\n`, read: (text) => findAllCells(text).map((c) => [c.startLine, c.endLine]), answer: [[6, 8]] },
    { site: "two names on the line, both popped, innermost first (`\\end{b}\\end{a}`)", build: (n) => `para\n\\begin{a}\n\\begin{b}\nbody\n\\end{b}\\end{a}${"\\end{".repeat(n)}\n# Hp05\n`, read: names, answer: ["Hp05"] },
    { site: "the first name is not the innermost open one but the second is (`\\end{b}\\end{a}` with only `a` open)", build: (n) => `para\n\\begin{a}\nbody\n\\end{b}\\end{a}${"\\end{".repeat(n)}\n# Hp06\n`, read: names, answer: ["Hp06"] },
    { site: "a name that is not open pops nothing, so the line stays text until the real `\\end{a}`", build: (n) => `para\n\\begin{a}\nbody\n\\end{b}${"\\end{".repeat(n)}\n\\end{a}\n# Hp07\n`, read: names, answer: ["Hp07"] },
    { site: "a name that is open nowhere: nothing pops and the heading below stays hidden", build: (n) => `para\n\\begin{a}\nbody\n\\end{b}${"\\end{".repeat(n)}\n# Hp08\n`, read: names, answer: [] },
    { site: "the probe on a line of two-byte characters", build: (n) => `para\n\\begin{a}\nbody\n\\end{a}${WIDE.repeat(n)}\n# Hp09\n`, read: names, answer: ["Hp09"] },
    // CONTROLS: shapes that are linear today and must stay so. These pass on the parent.
    { site: "CONTROL: 200,000 complete `\\end{a}` on one line, behind a `\\begin{a}`", many: CONTROL_MANY, build: (n) => `para\n\\begin{a}\n${"\\end{a}".repeat(n)}\n# Hc01\n`, read: names, answer: ["Hc01"] },
    { site: "CONTROL: 200,000 complete `\\end{a}` on one line, not at its start", many: CONTROL_MANY, build: (n) => `para\n\\begin{a}\ntext ${"\\end{a}".repeat(n)}\n\n# Hc02\n`, read: names, answer: ["Hc02"] },
    { site: "CONTROL: `\\end{` repeated 200,000 times with one `}` at the very end", many: CONTROL_MANY, build: (n) => `para\n\\begin{x}\n${"\\end{".repeat(n)}}\n# Hc03\n`, read: names, answer: [] },
    { site: "CONTROL: a line of 200,000 `\\end{}`, none of them an environment that was opened", many: CONTROL_MANY, build: (n) => `para\n\\begin{x}\n${"\\end{}".repeat(n)}\n# Hc04\n`, read: names, answer: [] },
  ];

  it.each(ROWS.map((row) => [row.site, row] as const))("%s: is read in linear time, and the answer is the stated one with a short run and with the long run", (_site, row) => {
    expect(row.read(row.build(FEW))).toEqual(row.answer);
    const text = row.build(row.many ?? MANY);
    const { result, ms } = timed(() => row.read(text));
    expect(result).toEqual(row.answer);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, 120_000);

  // The rows above fix MANY, the limit and the control size: 4,000 repeats, a limit of 100 s or a control of 2,000 would pass the parent too.
  it("keeps the sizes and the limit the clock rows are built on", () => {
    expect([FEW, MANY, LIMIT_MS, CONTROL_MANY]).toEqual([3, 40_000, 1000, 200_000]);
  });
});
