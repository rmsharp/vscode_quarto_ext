import { describe, expect, it } from "vitest";
import { buildOutline, findAllCells, findCellOptionLines, findHeadings, type OutlineSymbol } from "../../src/core/qmd/model";
import { indexLabels } from "../../src/core/refs";

// Session 340 — the BACKLOG item "Slow shapes and residuals found by Session 339's review round", part (1). The raw-TeX probe in `computeRegions` (model.ts) copies the whole stack of open environments
// (`const probe = [...rawTexEnvStack]`) for every line that STARTS with an `\end{name}`, whether or not the line pops anything. A document that holds D environments open and then reads L such lines pays D
// for each of them: the cost is the depth times the lines, and not the one copy per closing line that Session 339's DEEP STACK row (40,000 nested openers, ONE closing line) measures. Measured at `9238682`
// (Session 340, one fresh process per timing, Node 22, `findHeadings`, load 9): `\begin{a}` x N and then `\end{a}` x N, one per line, 88.5 / 224.6 / 895.9 / 3,085.6 ms at N = 10,000 / 20,000 / 40,000 /
// 80,000 (4x per doubling); `\begin{a}` x 80,000, `\end{b}` x 80,000 (a name that is open nowhere, so the line pops nothing) and a final `\end{a}` 5,537.3 ms; the same with 20,000 openers and 200,000
// unmatched closers 5,081.7 ms. The profile of the second at 40,000 puts 72.7% of the time in `computeRegions` itself and 17.8% in the garbage collector.
//
// WHAT THE ANSWER IS. A `\begin{a}` is a real opener only when an `\end{a}` is on its line or below it (`lastRawTexEnvEnd`); an `\end{name}` is a real closer only when `name` is the innermost open
// environment (LIFO). So in the first shape every `\end{a}` closes the `\begin{a}` above it, the paragraph is interrupted and the ATX line is a heading; in the second the `\end{b}` lines close nothing and are
// paragraph text, and the one `\end{a}` at the end is what interrupts the paragraph; in the third the `\end{a}` is BELOW the ATX line, every `\begin{a}` is a real opener, the `\end{b}` lines are text and the
// ATX line is hidden. Every answer below is what the PARENT gives: the short assertion (`FEW`) of each row passes at `9238682` and states it, and the long assertion of the same row states the same answer.
//
// THE CLOCK. The limit is one second for 80,000 environments (about 1.4 million characters). The parent takes 3 s or more; a linear reader takes a fraction of a second. It is not raised to make a row
// pass. The control rows (a shape that is linear today and must stay so: a stack that never grows past one, and closers that meet an empty stack) are written to pass on the parent.

const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = performance.now();
  const result = run();
  return { result, ms: performance.now() - started };
};

describe("the Session 340 clock helper", () => {
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

describe("Session 340 — a deep stack of raw-TeX environments and many lines that start with an `\\end{name}` (the BACKLOG item \"Slow shapes and residuals found by Session 339's review round\", part 1)", () => {
  const FEW = 3;
  const MANY = 80_000;
  const LIMIT_MS = 1000;
  const CONTROL_MANY = 100_000;

  const names = (text: string): string[] => findHeadings(text).map((h) => h.text);
  const flat = (symbols: OutlineSymbol[]): string[] => symbols.flatMap((s) => [`${s.kind}:${s.name}`, ...flat(s.children)]);

  /** A heading, a label, a cell with an option line: the tail starts at line `s` (heading `s`, label `s + 2`, cell `s + 4` to `s + 7`, its option line `s + 5`). */
  const tail = (id: string): string => `# H${id}\n\n![x](y){#fig-${id}}\n\n\`\`\`{r}\n#| echo: false\n1\n\`\`\`\n`;
  const OPEN = "\\begin{a}\n";
  const CLOSE = "\\end{a}\n";

  /** `para`, n openers, n closers one per line, the tail: the tail starts at line `1 + 2 * n`. */
  const nested = (id: string, n: number): string => `para\n${OPEN.repeat(n)}${CLOSE.repeat(n)}${tail(id)}`;

  type Row = { site: string; many?: number; build: (n: number) => string; read: (text: string) => unknown; answer: (n: number) => unknown };

  const ROWS: Row[] = [
    // The first shape, through every reader that reaches the region scan: n openers, then n closers, one per line.
    { site: "findHeadings, n openers and n closers one per line", build: (n) => nested("a01", n), read: names, answer: () => ["Ha01"] },
    { site: "buildOutline", build: (n) => nested("a02", n), read: (text) => flat(buildOutline(text)), answer: () => ["heading:Ha02", "cell:```{r}"] },
    { site: "findAllCells", build: (n) => nested("a03", n), read: (text) => findAllCells(text).map((c) => [c.startLine, c.endLine]), answer: (n) => [[5 + 2 * n, 8 + 2 * n]] },
    { site: "findCellOptionLines", build: (n) => nested("a04", n), read: (text) => findCellOptionLines(text).map((o) => o.line), answer: (n) => [6 + 2 * n] },
    { site: "indexLabels", build: (n) => nested("a05", n), read: (text) => indexLabels(text).map((l) => [l.id, l.line]), answer: (n) => [["fig-a05", 3 + 2 * n]] },
    // A line that holds two names, the first of which is open nowhere: the line is read in full and pops one.
    { site: "two names per closing line (`\\end{b}\\end{a}`), the first open nowhere", build: (n) => `para\n${OPEN.repeat(n)}${"\\end{b}\\end{a}\n".repeat(n)}${tail("a06")}`, read: names, answer: () => ["Ha06"] },
    // A closing line that is indented, and one that is behind a block quote marker (the strip is applied before the probe).
    { site: "indented two spaces", build: (n) => `para\n${OPEN.repeat(n)}${"  \\end{a}\n".repeat(n)}${tail("a07")}`, read: names, answer: () => ["Ha07"] },
    // The second shape: names that are open nowhere. The probe pops nothing, and it still copies the stack.
    { site: "n openers, n `\\end{b}` lines that pop nothing, one `\\end{a}`", build: (n) => `para\n${OPEN.repeat(n)}${"\\end{b}\n".repeat(n)}${CLOSE}${tail("b01")}`, read: names, answer: () => ["Hb01"] },
    { site: "buildOutline of the same", build: (n) => `para\n${OPEN.repeat(n)}${"\\end{b}\n".repeat(n)}${CLOSE}${tail("b02")}`, read: (text) => flat(buildOutline(text)), answer: () => ["heading:Hb02", "cell:```{r}"] },
    { site: "few openers, many `\\end{b}` lines that pop nothing, one `\\end{a}`", build: (n) => `para\n${OPEN.repeat(Math.max(1, Math.floor(n / 4)))}${"\\end{b}\n".repeat(n * 2)}${CLOSE}${tail("b03")}`, read: names, answer: () => ["Hb03"] },
    // The third shape: the `\end{a}` is BELOW the ATX line, so every `\begin{a}` is a real opener, the `\end{b}` lines are paragraph text and the ATX line is hidden.
    { site: "the same with the only `\\end{a}` below the ATX line: the heading stays hidden", build: (n) => `para\n${OPEN.repeat(n)}${"\\end{b}\n".repeat(n)}# Hb04\n${CLOSE}`, read: names, answer: () => [] },
    // CONTROLS: shapes that are linear today and must stay so. These pass on the parent.
    { site: "CONTROL: 100,000 openers each closed on the next line (the stack never grows past one)", many: CONTROL_MANY, build: (n) => `para\n${(OPEN + CLOSE).repeat(n)}${tail("c01")}`, read: names, answer: () => ["Hc01"] },
    { site: "CONTROL: 100,000 `\\end{b}` lines under an empty stack", many: CONTROL_MANY, build: (n) => `para\n${"\\end{b}\n".repeat(n)}# Hc02\n`, read: names, answer: () => [] },
  ];

  it.each(ROWS.map((row) => [row.site, row] as const))("%s: is read in linear time, and the answer is the stated one with a short run and with the long run", (_site, row) => {
    expect(row.read(row.build(FEW))).toEqual(row.answer(FEW));
    const many = row.many ?? MANY;
    const text = row.build(many);
    const { result, ms } = timed(() => row.read(text));
    expect(result).toEqual(row.answer(many));
    expect(ms).toBeLessThan(LIMIT_MS);
  }, 120_000);

  // A closing name far along its line. The probe reads EVERY name of a line that starts with an `\\end{name}`, wherever it sits; a read that stops after a fixed number of characters would lose the name and leave the
  // paragraph open (the ATX line below it hidden). Every answer is what the parent gives.
  const names2 = (text: string): string[] => findHeadings(text).map((h) => h.text);
  it.each([
    ["the closing name is 5,000 characters into its line", `para\n\\begin{a}\nbody\n\\end{b}${" ".repeat(5000)}\\end{a}\n# Hl01\n`, ["Hl01"]],
    ["the closing name is 200,000 characters into its line", `para\n\\begin{a}\nbody\n\\end{b}${" ".repeat(200_000)}\\end{a}\n# Hl02\n`, ["Hl02"]],
    ["the same line with a name that is open nowhere at the end: the heading stays hidden", `para\n\\begin{a}\nbody\n\\end{b}${" ".repeat(5000)}\\end{c}\n\\end{a}\n# Hl03\n`, ["Hl03"]],
    ["the same line, the real closer below it only: the paragraph is open at the ATX line", `para\n\\begin{a}\nbody\n\\end{b}${" ".repeat(5000)}\\end{c}\n# Hl04\n\\end{a}\n`, []],
  ] as Array<[string, string, string[]]>)("%s", (_label, text, expected) => {
    expect(names2(text)).toEqual(expected);
  });

  // The rows above fix MANY, the limit and the control size: 8,000 environments, a limit of 100 s or a control of 1,000 would pass the parent too.
  it("keeps the sizes and the limit the clock rows are built on", () => {
    expect([FEW, MANY, LIMIT_MS, CONTROL_MANY]).toEqual([3, 80_000, 1000, 100_000]);
  });
});
