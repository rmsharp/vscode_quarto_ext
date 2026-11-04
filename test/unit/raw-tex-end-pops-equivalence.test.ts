import { describe, expect, it } from "vitest";
import { rawTexEndNames, rawTexEndPops } from "../../src/core/qmd/model";
import { everyString, seededRandom } from "./support/regex-equivalence";

// The enumerations take several seconds each on a loaded machine; the sibling equivalence files give their heavy rows the same ceiling.
const HEAVY_ROW_MS = 120_000;

// Session 340 — the BACKLOG item "Slow shapes and residuals found by Session 339's review round", part (1). The raw-TeX probe in `computeRegions` asks, for a line that starts with an `\end{name}`, how many of the
// open environments the line closes: it copied the whole stack of open environments (`const probe = [...rawTexEnvStack]`) and, for each `\end{name}` on the line in order, popped the copy when its top was that name.
// The copy is made on EVERY such line, whether or not the line pops anything, so a deep stack and many closing lines cost the depth times the lines. `rawTexEndPops(stack, line)` answers the same question without the
// copy: it keeps how much of the stack is still open (`top`) and reads the stack, which it never changes, at `top - 1`. The OLD spelling is kept here, copied from the parent `9238682` (`src/core/qmd/model.ts`
// before the cure), as the oracle (Learning 738), beside a reading by definition that is recursive, copies each stack it passes down and shares no state; the stack handed to the function is FROZEN, so a spelling
// that pops the caller's stack throws instead of passing. The pinned counts (how many (stack, line) pairs pop at least once, and how many pops in all) come from those two and from the Python recount
// `tools/raw-tex-pops-count/count_pops.py`, which shares no code with this file, and never from the code under test.

// ---- The OLD spelling, copied from the parent `9238682`. ----
function oldPops(stack: readonly string[], line: string): number {
  const probe = [...stack];
  let texEndPops = 0;
  for (const name of rawTexEndNames(line)) {
    if (probe[probe.length - 1] === name) {
      probe.pop();
      texEndPops++;
    }
  }
  return texEndPops;
}

// ---- A reading by DEFINITION: the first name closes the innermost environment when it is that name, and the rest of the names are read against what is left. ----
function definitionPops(stack: readonly string[], names: readonly string[]): number {
  if (names.length === 0) {
    return 0;
  }
  const [first, ...rest] = names;
  if (stack.length > 0 && stack[stack.length - 1] === first) {
    return 1 + definitionPops(stack.slice(0, -1), rest);
  }
  return definitionPops(stack, rest);
}

const END = "\\end{";
// The stack symbols of the enumerations and the name each stands for; the third is the EMPTY name.
const STACK_NAMES: Record<string, string> = { a: "a", b: "b", c: "" };
const TOKENS_1 = [END + "a}", END + "b}", END + "}", END, "}", "x"];
const TOKENS_2 = [END + "a}", END + "b}", "x"];

type Count = { compared: number; popping: number; pops: number; disagreements: string[] };

/** Compare the new function with the old spelling and with the reading by definition over `pairs`: how many were compared, how many the OLD spelling popped at least once, how many pops in all, and the first few disagreements. */
function compareAll(pairs: Iterable<[readonly string[], string]>): Count {
  let compared = 0;
  let popping = 0;
  let pops = 0;
  const disagreements: string[] = [];
  for (const [stack, line] of pairs) {
    const expected = oldPops(stack, line);
    compared++;
    if (expected > 0) {
      popping++;
      pops += expected;
    }
    const now = rawTexEndPops(stack, line);
    const defined = definitionPops(stack, rawTexEndNames(line));
    if ((now !== expected || defined !== expected) && disagreements.length < 5) {
      disagreements.push(`${JSON.stringify(stack)} ${JSON.stringify(line)}: old ${expected}, now ${now}, by definition ${defined}`);
    }
  }
  return { compared, popping, pops, disagreements };
}

/** Every stack over the symbols up to `stackMax` deep, against every line over the tokens up to `lineMax` tokens. Each stack is frozen. */
function* everyPair(symbols: readonly string[], stackMax: number, tokens: readonly string[], lineMax: number): Generator<[readonly string[], string]> {
  const lines = [...everyString(tokens, lineMax)];
  for (const word of everyString(symbols, stackMax)) {
    const stack = Object.freeze([...word].map((symbol) => STACK_NAMES[symbol]));
    for (const line of lines) {
      yield [stack, line];
    }
  }
}

// A seeded sample of deeper stacks and longer lines: a stack of 0 to 12 names from a pool that holds the empty name, a name with a blank and a capital, and a line of 0 to 14 pieces, each repeated 1 to 3 times. The seed
// is written beside the count it produces (Learning 791).
const SEED = 340;
const SEEDED_COUNT = 1_000_000;
const POOL = ["a", "b", "c", "", "a b", "A"];
const PIECES = [END + "a}", END + "b}", END + "c}", END + "}", END + "a b}", END + "A}", END, "}", "x", " ", END + "a}" + END + "b}", END + "b}" + END + "a}"];
function* seededPairs(seed: number, count: number): Generator<[readonly string[], string]> {
  const next = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    const depth = Math.floor(next() * 13);
    const stack = Object.freeze(Array.from({ length: depth }, () => POOL[Math.floor(next() * POOL.length)]));
    let line = "";
    const parts = Math.floor(next() * 15);
    for (let part = 0; part < parts; part++) {
      line += PIECES[Math.floor(next() * PIECES.length)].repeat(1 + Math.floor(next() * 3));
    }
    yield [stack, line];
  }
}

const ENUMERATIONS: Array<{ label: string; symbols: readonly string[]; stackMax: number; tokens: readonly string[]; lineMax: number; compared: number; popping: number; pops: number }> = [
  { label: "every stack of 3 names up to 4 deep against every line of 6 tokens up to 5", symbols: ["a", "b", "c"], stackMax: 4, tokens: TOKENS_1, lineMax: 5, compared: 1_129_051, popping: 587_000, pops: 786_501 },
  { label: "every stack of 2 names up to 6 deep against every line of 3 tokens up to 8", symbols: ["a", "b"], stackMax: 6, tokens: TOKENS_2, lineMax: 8, compared: 1_249_807, popping: 1_175_580, pops: 2_994_360 },
];

describe("Session 340 — rawTexEndPops: the new function answers what the copy of the stack answered", () => {
  it.each(ENUMERATIONS.map((e) => [e.label, e] as const))("%s", (_label, e) => {
    const result = compareAll(everyPair(e.symbols, e.stackMax, e.tokens, e.lineMax));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(e.compared);
    expect(result.popping).toBe(e.popping);
    expect(result.pops).toBe(e.pops);
  }, HEAVY_ROW_MS);

  it(`${SEEDED_COUNT.toLocaleString("en-US")} seeded pairs of a deeper stack and a longer line (seed ${SEED})`, () => {
    const result = compareAll(seededPairs(SEED, SEEDED_COUNT));
    expect(result.disagreements).toEqual([]);
    expect(result.compared).toBe(SEEDED_COUNT);
    expect(result.popping).toBe(477_153);
    expect(result.pops).toBe(835_844);
  }, HEAVY_ROW_MS);

  // What each pair pops, stated by hand: the names of the line are read in order against the TOP of the stack as the pops so far have left it; a name that is not the top closes nothing, even when it is open further down.
  const STATED: Array<[string, readonly string[], string, number]> = [
    ["nothing open, nothing on the line", [], "", 0],
    ["nothing open, one closer", [], END + "a}", 0],
    ["the top is the name", ["a"], END + "a}", 1],
    ["the top is another name", ["a"], END + "b}", 0],
    ["the name is open further down, not on top", ["a", "b"], END + "a}", 0],
    ["two names, innermost first", ["a", "b"], END + "b}" + END + "a}", 2],
    ["two names, outermost first: the first is not the top, the second is", ["a", "b"], END + "a}" + END + "b}", 1],
    ["the same name twice over one environment", ["a"], END + "a}" + END + "a}", 1],
    ["the same name twice over two", ["a", "a"], END + "a}" + END + "a}", 2],
    ["the same name twice over [b, a]", ["b", "a"], END + "a}" + END + "a}", 1],
    ["a name that is open nowhere, then one that is on top", ["a"], END + "b}" + END + "a}", 1],
    ["three names closing three", ["a", "b", "c"], END + "c}" + END + "b}" + END + "a}", 3],
    ["three names, the middle one not on top", ["a", "b", "c"], END + "c}" + END + "a}" + END + "b}", 2],
    ["the empty name over the empty name", [""], END + "}", 1],
    ["the empty name over a, b", ["a", "b"], END + "}", 0],
    ["a name with a blank", ["a b"], END + "a b}", 1],
    ["a name with a blank is not its first word", ["a b"], END + "a}", 0],
    ["a capital is another name", ["a"], END + "A}", 0],
    ["a name padded on the left is another name", ["a"], END + " a}", 0],
    ["a name padded on the right is another name", ["a"], END + "a }", 0],
    ["a name that starts with the open one is another name", ["a"], END + "ab}", 0],
    ["an opener with no brace closes nothing", ["a"], END, 0],
    ["a closer and then an opener with no brace", ["a"], END + "a}" + END, 1],
    ["an opener that is followed by another before any brace takes the text up to the brace as its name (`\\end{a`), not `a`", ["a"], END + END + "a}", 0],
    ["the same line over a stack that holds that name", ["\\end{a"], END + END + "a}", 1],
    ["text around the names does not matter", ["a", "b"], "x" + END + "b}y " + END + "a}z", 2],
  ];
  it.each(STATED)("%s: stated as %#", (_label, stack, line, expected) => {
    expect(oldPops(stack, line)).toBe(expected);
    expect(definitionPops(stack, rawTexEndNames(line))).toBe(expected);
    expect(rawTexEndPops(Object.freeze([...stack]), line)).toBe(expected);
  });

  // A cap on the count (or on the names read) that sits above every row of the enumerations: the enumerations pop at most eight from one line.
  it.each([
    ["5,000 closers over 5,000 environments of one name close them all", new Array<string>(5000).fill("a"), (END + "a}").repeat(5000), 5000],
    ["6,000 closers over 5,000 environments close 5,000", new Array<string>(5000).fill("a"), (END + "a}").repeat(6000), 5000],
    ["5,000 closers over 5,000 alternating environments, innermost first", Array.from({ length: 5000 }, (_, i) => (i % 2 === 0 ? "a" : "b")), (END + "b}" + END + "a}").repeat(2500), 5000],
    ["5,000 closers over 5,000 alternating environments, outermost first: the first name meets the wrong top and is lost, every later one pops", Array.from({ length: 5000 }, (_, i) => (i % 2 === 0 ? "a" : "b")), (END + "a}" + END + "b}").repeat(2500), 4999],
  ] as Array<[string, string[], string, number]>)("%s", (_label, stack, line, expected) => {
    const frozen = Object.freeze([...stack]);
    expect(rawTexEndPops(frozen, line)).toBe(expected);
    expect(oldPops(frozen, line)).toBe(expected);
  });

  it("does not change the stack it is given", () => {
    const stack = ["a", "b", "b"];
    expect(rawTexEndPops(stack, END + "b}" + END + "b}" + END + "a}")).toBe(3);
    expect(stack).toEqual(["a", "b", "b"]);
  });
});

// The function on a stack the oracle cannot take: the old spelling copies the stack on every call, so 30,000 calls over 100,000 open environments move three billion references and take seconds; the new function reads
// one place of the stack per name and takes milliseconds. The clock is wall time, so the row that must fail runs the OLD spelling over the same calls.
describe("Session 340 — rawTexEndPops on a deep stack", () => {
  const LIMIT_MS = 1000;
  const DEPTH = 100_000;
  const CALLS = 30_000;
  const OLD_FLOOR_MS = 1000;
  const clock = <T,>(run: () => T): { result: T; ms: number } => {
    const started = performance.now();
    const result = run();
    return { result, ms: performance.now() - started };
  };
  // The top is a name no other place holds, so a spelling that reads the wrong place of a stack this deep (or only the first 65,536 places of it) answers differently.
  const deep = Object.freeze([...new Array<string>(DEPTH - 1).fill("a"), "z"]);
  const calls = (pops: (stack: readonly string[], line: string) => number, line: string): number => {
    let total = 0;
    for (let i = 0; i < CALLS; i++) {
      total += pops(deep, line);
    }
    return total;
  };

  it.each([
    ["a closer that is the top: every call pops once", END + "z}", CALLS],
    ["a closer that is open nowhere: no call pops", END + "b}", 0],
    ["a closer that is open only further down: no call pops", END + "a}", 0],
    ["a line of three closers, two of them open nowhere", END + "b}" + END + "z}" + END + "c}", CALLS],
    ["a line that pops the top and then five of the `a` under it", END + "z}" + (END + "a}").repeat(5), 6 * CALLS],
  ] as Array<[string, string, number]>)("%s", (_label, line, expected) => {
    const { result, ms } = clock(() => calls(rawTexEndPops, line));
    expect(result).toBe(expected);
    expect(ms).toBeLessThan(LIMIT_MS);
  });

  it("the clock row can fail: the old spelling takes over a second on the same 30,000 calls", () => {
    const { result, ms } = clock(() => calls(oldPops, END + "b}"));
    expect(result).toBe(0);
    expect(ms).toBeGreaterThan(OLD_FLOOR_MS);
  }, HEAVY_ROW_MS);

  // A depth of 10,000, a limit of 100 s or a floor of 1 ms would pass the parent too.
  it("keeps the sizes, the limit and the floor the clock rows above are built on", () => {
    expect([LIMIT_MS, DEPTH, CALLS, OLD_FLOOR_MS]).toEqual([1000, 100_000, 30_000, 1000]);
  });
});
