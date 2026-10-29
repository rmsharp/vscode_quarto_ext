import { describe, expect, it } from "vitest";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";
import { findLabel, isReferenceableLine, refIdAt } from "../../src/core/refs";

// The Session 337 rows for part 6 of the BACKLOG item "Eight more single-line RangeError shapes and three more quadratic ones" (REF_USAGE, `refs.ts`).
//
// The class of Session 335's and 336's rows: V8 keeps one entry of its regex backtrack stack per repetition of a quantified GROUP, and REF_USAGE read an id as `(?:REGCHAR|PUNCT(?=REGCHAR))*`, so a cross-reference token of
// 8,388,573 repetitions throws `RangeError: Maximum call stack size exceeded` in `refIdAt`, the core function behind the hover and the go-to-definition token reader (`providers/crossref.ts`).
//
// Bisected at HEAD `8ebce73` (Session 337, one fresh process per probe, lower bound verified OK first): `@fig-` + `a` x 8,388,572 reads, x 8,388,573 THROWS. The unit `.a` throws from 4,194,286 units, but only behind a
// letter: `@fig-` + `.a` x N is not a reference at all (a `.` right after the kind prefix fails its follower test, so the answer is null and nothing throws), and `@fig-a` + `.a` x N throws at exactly 4,194,286 (one
// repetition for `.` and one for `a`, 2 x 4,194,286 + 1 = 8,388,573). Of the entries the item tried, ONLY `refIdAt` throws: `isReferenceableLine`, `findBodyLines`, `findHeadings`, `buildOutline` (no hint, knitr, jupyter),
// `findAllCells`, `indexLabels`, `findLabel` (no hint, knitr) and `resolveDocumentEngine` all read the same line at 8,388,573 and at 16,800,000 without throwing. `refIdAt` takes no engine hint; the provider passes the
// resolved engine to `findLabel` AFTER it, so the definition path is read here once per engine the resolver can answer ("markdown", "knitr", "jupyter"), calling the same core functions in the order
// `CrossrefDefinitionProvider.provideDefinition` does.
//
// Every size is about twice the first throw (Learning 775). The answer is what the old pattern gives at a size where it does not throw (run firsthand at 8,000,000 and at 4 units), and where the long answer is a
// 16.8-million-character id it is compared whole and described by its length.

const timed = <T>(run: () => T): { result: T; ms: number } => {
  const started = Date.now();
  const result = run();
  return { result, ms: Date.now() - started };
};

describe("the clock helper of the Session 337 rows", () => {
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

describe("Session 337 — a cross-reference token of millions of characters that a pattern read as a quantified group (the BACKLOG item \"Eight more single-line RangeError shapes and three more quadratic ones\", part 6)", () => {
  const FEW = 4;
  // 4 s: the loop that replaces the group reads 16.8 million characters in 55 ms for one letter and 174 ms for `.a` pairs (measured on a prototype, load about 10), the composite rows add the document-level readers
  // (`isReferenceableLine` 40 ms, `resolveDocumentEngine` 57 ms, `findLabel` with the knitr hint 221 ms, measured at 16.8 million), 373 ms in all at worst, so 4 s is more than ten times the cost; a quadratic reading of
  // a line this long takes hours, so the limit still tells the two apart.
  const LIMIT_MS = 4000;

  /** Small stand-in for an answer that can be a 16.8-million-character id: its length and edges, so a failure prints a line and not the blob. */
  const summary = (id: string | null): { length: number; head: string; tail: string } | null => (id === null ? null : { length: id.length, head: id.slice(0, 12), tail: id.slice(-6) });

  interface Case {
    /** The line the cursor sits on. */
    line: string;
    /** 0-based cursor column on `line`. */
    column: number;
    /** The whole document, for the rows that read the way the definition provider does. */
    text?: string;
    /** 0-based index of `line` in `text`. */
    lineIndex?: number;
  }
  interface Row {
    site: string;
    unit: string;
    many: number;
    build: (run: string) => Case;
    /** The id the old pattern gives: the whole token for the cursor positions it counts as inside, null otherwise. */
    id: (run: string) => string | null;
    /** The literal answer for FEW units, stated by hand. */
    shortId: string | null;
  }

  /** `CrossrefDefinitionProvider.provideDefinition`'s body, with the document's text and line passed in. */
  const definition = (c: Case): { referenceable: boolean; engine?: string; id?: string | null; label?: [number, number] | null } => {
    const text = c.text as string;
    const lineIndex = c.lineIndex as number;
    if (!isReferenceableLine(text, lineIndex)) {
      return { referenceable: false };
    }
    const id = refIdAt(c.line, c.column);
    if (id === null) {
      return { referenceable: true, id };
    }
    const engine = resolveDocumentEngine("a.qmd", text);
    const label = findLabel(text, id, engine);
    return { referenceable: true, engine, id, label: label === null ? null : [label.line, label.column] };
  };

  const doc = (head: string, line: string): Case & { text: string; lineIndex: number } => {
    const text = `${head}Intro.\n\n${line}\n\n![x](y){#fig-short}\n`;
    return { line, column: line.length - 3, text, lineIndex: head.split("\n").length - 1 + 2 };
  };
  const SHORT_TAIL = " and @fig-short";

  const ROWS: Row[] = [
    { site: "the item's own shape: `@fig-` + n of `a`, the cursor inside the id", unit: "a", many: 16_800_000, build: (run) => ({ line: `@fig-${run}`, column: 2 }), id: (run) => `fig-${run}`, shortId: "fig-aaaa" },
    { site: "the cursor one character BEFORE the `@`: not inside the token, so null", unit: "a", many: 16_800_000, build: (run) => ({ line: `See @fig-${run}`, column: 3 }), id: () => null, shortId: null },
    { site: "the cursor ON the `@`", unit: "a", many: 16_800_000, build: (run) => ({ line: `Look @fig-${run}`, column: 5 }), id: (run) => `fig-${run}`, shortId: "fig-aaaa" },
    { site: "the cursor in the middle of the id", unit: "a", many: 16_800_000, build: (run) => ({ line: `Cf. @fig-${run}`, column: 9 }), id: (run) => `fig-${run}`, shortId: "fig-aaaa" },
    { site: "the cursor at the END of the token (one past its last character counts)", unit: "a", many: 16_800_000, build: (run) => ({ line: `As in @fig-${run}`, column: `As in @fig-${run}`.length }), id: (run) => `fig-${run}`, shortId: "fig-aaaa" },
    { site: "the cursor two past the end of the token: null", unit: "a", many: 16_800_000, build: (run) => ({ line: `Also @fig-${run}`, column: `Also @fig-${run}`.length + 1 }), id: () => null, shortId: null },
    { site: "kind `eq`: n of `a`", unit: "a", many: 16_800_000, build: (run) => ({ line: `Where @eq-${run}`, column: 8 }), id: (run) => `eq-${run}`, shortId: "eq-aaaa" },
    { site: "internal punctuation: `@fig-a` and n of `.a` (two group repetitions a unit)", unit: ".a", many: 8_400_000, build: (run) => ({ line: `Dotted @fig-a${run}`, column: 10 }), id: (run) => `fig-a${run}`, shortId: "fig-a.a.a.a.a" },
    { site: "internal punctuation: `@sec-a` and n of `:a`", unit: ":a", many: 8_400_000, build: (run) => ({ line: `Colon @sec-a${run}`, column: 8 }), id: (run) => `sec-a${run}`, shortId: "sec-a:a:a:a:a" },
    { site: "a long token and then a short one, the cursor on the short one: the first match is the long one", unit: "a", many: 16_800_000, build: (run) => ({ line: `@fig-${run}${SHORT_TAIL}`, column: `@fig-${run}${SHORT_TAIL}`.length - 3 }), id: () => "fig-short", shortId: "fig-short" },
    { site: "a long token whose id stops at a doubled punctuation run (`..`): the id is the part before it", unit: "a", many: 16_800_000, build: (run) => ({ line: `Stop @fig-${run}..b`, column: 7 }), id: (run) => `fig-${run}`, shortId: "fig-aaaa" },
  ];

  it.each(ROWS.map((row) => [row.site, row] as const))("%s: is read without throwing, in linear time, with 4 units and with the long run", (_site, row) => {
    const short = row.build(row.unit.repeat(FEW));
    expect(refIdAt(short.line, short.column)).toBe(row.shortId);
    const run = row.unit.repeat(row.many);
    const c = row.build(run);
    expect(c.line.length).toBeGreaterThan(run.length); // the timed line holds the whole run
    const { result, ms } = timed(() => refIdAt(c.line, c.column));
    const want = row.id(run);
    expect(summary(result)).toEqual(summary(want));
    expect(result === want).toBe(true);
    expect(ms).toBeLessThan(LIMIT_MS);
  }, 120_000);

  // The definition provider's path: the document-level readers first, then `refIdAt`, then `findLabel` with the engine the resolver answers. The label is defined on the last line of the document.
  const PATHS: Array<{ site: string; head: string; engine: string; label: [number, number] }> = [
    { site: "no engine key (the resolver answers markdown)", head: "", engine: "markdown", label: [4, 9] },
    { site: "front matter `engine: knitr` (the label index is read with the knitr hint)", head: "---\nengine: knitr\n---\n\n", engine: "knitr", label: [8, 9] },
    { site: "front matter `jupyter: python3` (the label index is read with the jupyter hint)", head: "---\njupyter: python3\n---\n\n", engine: "jupyter", label: [8, 9] },
  ];

  it.each(PATHS.map((p) => [p.site, p] as const))("the definition path with %s: the long token is skipped and the short one's label is found, in linear time", (_site, p) => {
    const short = doc(p.head, `@fig-${"a".repeat(FEW)}${SHORT_TAIL}`);
    expect(definition(short)).toEqual({ referenceable: true, engine: p.engine, id: "fig-short", label: p.label });
    const longRun = "a".repeat(16_800_000);
    const c = doc(p.head, `@fig-${longRun}${SHORT_TAIL}`);
    const { result, ms } = timed(() => definition(c));
    expect(result).toEqual({ referenceable: true, engine: p.engine, id: "fig-short", label: p.label });
    expect(ms).toBeLessThan(LIMIT_MS);
  }, 120_000);

  it("builds a different line for every row and a different document for every definition path", () => {
    const lines = ROWS.map((row) => row.build(row.unit.repeat(FEW)).line);
    expect(new Set(lines).size).toBe(ROWS.length);
    const texts = PATHS.map((p) => doc(p.head, `@fig-${"a".repeat(FEW)}${SHORT_TAIL}`).text);
    expect(new Set(texts).size).toBe(PATHS.length);
  });

  // The parent THROWS from 8,388,573 repetitions of the group, so no limit passes it there; a run below that, or a unit that is not the throwing one, would pass on it, and a limit of minutes would pass a quadratic cure.
  it("keeps the sizes, the limit and the units the Session 337 rows are built on", () => {
    expect([FEW, LIMIT_MS]).toEqual([4, 4000]);
    expect(ROWS.map((row) => `${row.unit}x${row.many}`)).toEqual([
      ...Array.from({ length: 7 }, () => "ax16800000"),
      ".ax8400000",
      ":ax8400000",
      "ax16800000",
      "ax16800000",
    ]);
    // every run is at least twice the last size that reads (8,388,572 repetitions of the group; a unit of two characters, `.a` or `:a`, is two repetitions)
    for (const row of ROWS) {
      expect(row.unit.length * row.many).toBeGreaterThanOrEqual(2 * 8_388_572);
    }
  });
});
