import { describe, expect, it } from "vitest";
import { languagesInMarkdown } from "../../src/core/document-engine";
import { resolveDocumentEngine } from "../../src/core/document-engine-resolve";

// Session 343, part (4) of the BACKLOG item "What Session 342's review round found beside the typing-path cures", SIB-06. `languagesInMarkdown` (`src/core/document-engine.ts`) de-duplicated the fence languages of a
// document with `Array.includes`, so `resolveDocumentEngine` (which reads that list for every document with no engine in its front matter, per Outline refresh, per completion in a knitr-aware surface and
// per diagnostics pass) cost the square of the number of DISTINCT fence languages. The lead's probe (a fresh process per size, median of three, load 6 to 15) at 4,000 / 16,000 / 64,000 distinct languages:
// 35.6 / 284.9 / 4,322.2 ms, against 14.3 / 60.2 / 203.7 ms for the same number of fences in ONE language.
//
// THE CLOCK. One criterion, a RATIO in one process: `resolveDocumentEngine` over 64,000 fences of 64,000 distinct languages, over the same call on 64,000 fences of ONE language (the linear residue the
// cure leaves: the front-matter enumerators and the regex, Learning 919). The parent's ratio is 21 at 64,000 and the cure's is about 1; the limit is 4 (a machine that is slow all through moves both windows and
// cancels; it is NOT load-proof, and a figure under 2 is noise, Learning 877). The keystroke gap does not apply: this is one call on a fresh text, not a typing stream. `timeAgainstBaseline` reads each window on a
// clock the helper's own rows can drive (Learning 910): a window that did not tick is not a fast run, so `clockBreaks` refuses it. The texts are fresh for every call (a tag on the last line), because the
// model's scans are memoised on the exact text.
//
// THE ORACLE is the old spelling, verbatim (`oldLanguagesInMarkdown`), over every sequence of up to five fences drawn from three alphabets of three languages each (two spell one language in two cases, because
// the language is lower-cased before it is compared) and over seeded documents of fence shapes the regex counts and does not count. The answer row at 64,000 distinct languages states the list it expects without
// running the old spelling, which would take seconds there.

/** The Session 342 list of `languagesInMarkdown`, verbatim: the oracle. */
function oldLanguagesInMarkdown(text: string): string[] {
  const fenceLanguage = /^[\t >]*```+\s*\{([a-zA-Z0-9_]+)([ ,].*)?\}\s*$/gm;
  const languages: string[] = [];
  let match = fenceLanguage.exec(text);
  while (match !== null) {
    const language = match[1].toLowerCase();
    if (!languages.includes(language)) {
      languages.push(language);
    }
    match = fenceLanguage.exec(text);
  }
  return languages;
}

/** Quarto's two language loops (`engineFromLanguages`), verbatim and spelled again here: what an engine is, given the list the oracle made. */
function oldEngineFromLanguages(languages: readonly string[]): "knitr" | "jupyter" | "markdown" {
  for (const language of languages) {
    if (language === "r") return "knitr";
    if (language === "julia") return "jupyter";
  }
  for (const language of languages) {
    if (language !== "ojs" && language !== "mermaid" && language !== "dot") return "jupyter";
  }
  return "markdown";
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE CLOCK'S OWN CLOCK (Learning 910).

/** What one run measured: the milliseconds of the baseline window (`baselineMs`), of the run's window (`ms`), and what the run returned. */
interface Timed<T> {
  result: T;
  ms: number;
  baselineMs: number;
}

/** Run `baseline`, then `run`, each in its own window of `now` (milliseconds). */
function timeAgainstBaseline<T>(baseline: () => unknown, run: () => T, now: () => number = () => performance.now()): Timed<T> {
  const t0 = now();
  baseline();
  const t1 = now();
  const result = run();
  const t2 = now();
  return { result, ms: t2 - t1, baselineMs: t1 - t0 };
}

const costRatio = (run: { ms: number; baselineMs: number }): number => run.ms / run.baselineMs;

/** The one clock criterion, named with its numbers: the run's window under `ratioLimit` times the baseline's. `[]` keeps it. A window that did not tick (0, negative or NaN) keeps nothing: a clock stuck at 0 makes every ratio true. */
function clockBreaks(run: { ms: number; baselineMs: number }, ratioLimit: number): string[] {
  if (!(run.ms > 0 && run.baselineMs > 0)) return [`a window of the clock did not tick: ${run.baselineMs} ms for the one-language text, ${run.ms} ms for the distinct languages`];
  return costRatio(run) < ratioLimit ? [] : [`resolveDocumentEngine took ${costRatio(run).toFixed(2)} times the one-language text, not under ${ratioLimit} times`];
}

/** A stand-in that spins `ms` milliseconds on the real clock. */
const spinning = (ms: number) => (): number => {
  const started = performance.now();
  while (performance.now() - started < ms) {
    /* spin */
  }
  return ms;
};

describe("the Session 343 clock helpers of the languages rows (the clock rows' own clock is pinned here: Learning 910)", () => {
  it("timeAgainstBaseline reads each window on a clock only the stand-ins advance: the numbers are exact on any load, the order is baseline then run, each runs once", () => {
    let t = 1000;
    const order: string[] = [];
    const run = timeAgainstBaseline(
      () => {
        order.push("baseline");
        t += 40;
      },
      () => {
        order.push("run");
        t += 130;
        return "answer";
      },
      () => t,
    );
    expect(run).toEqual({ result: "answer", ms: 130, baselineMs: 40 });
    expect(order).toEqual(["baseline", "run"]);
  });

  it("timeAgainstBaseline's default clock is real time: a baseline that spins 15 ms and a run that spins 25 ms are read as at least that, each in its own window", () => {
    const run = timeAgainstBaseline(spinning(15), spinning(25));
    expect(run.result).toBe(25);
    expect(run.baselineMs).toBeGreaterThanOrEqual(15 - 1);
    expect(run.ms).toBeGreaterThanOrEqual(25 - 1);
    expect(run.baselineMs + run.ms).toBeGreaterThanOrEqual(40 - 2);
  });

  it("costRatio is the run's window over the baseline's: the parent's 4,322 over 204 is 21, the cure's 1.1 times the baseline is 1.1, a baseline read as 0 is no ratio at all", () => {
    expect(costRatio({ ms: 130, baselineMs: 40 })).toBe(3.25);
    expect(costRatio({ ms: 4322.2, baselineMs: 203.7 })).toBeCloseTo(21.2, 1);
    expect(costRatio({ ms: 224, baselineMs: 203.7 })).toBeCloseTo(1.1, 1);
    expect(costRatio({ ms: 10, baselineMs: 0 })).toBe(Infinity);
  });

  it("clockBreaks refuses the parent's measurements and accepts the cure's, the limit is strict, and a window read as 0, as NaN or as negative keeps nothing, either window", () => {
    expect(clockBreaks({ ms: 4322.2, baselineMs: 203.7 }, 4)).toHaveLength(1); // 64,000 distinct languages at the parent
    expect(clockBreaks({ ms: 224, baselineMs: 203.7 }, 4)).toEqual([]); // the same at the cure
    expect(clockBreaks({ ms: 399.9, baselineMs: 100 }, 4)).toEqual([]);
    expect(clockBreaks({ ms: 400, baselineMs: 100 }, 4)).toHaveLength(1); // exactly the limit
    expect(clockBreaks({ ms: 10, baselineMs: 0 }, 4)).toHaveLength(1);
    expect(clockBreaks({ ms: NaN, baselineMs: 100 }, 4)).toHaveLength(1);
    expect(clockBreaks({ ms: 100, baselineMs: NaN }, 4)).toHaveLength(1);
    expect(clockBreaks({ ms: 100, baselineMs: -5 }, 4)).toHaveLength(1);
    expect(clockBreaks({ ms: 0, baselineMs: 100 }, 4)).toHaveLength(1); // a run read as 0 is not a fast run
    expect(clockBreaks({ ms: 0, baselineMs: 0 }, 4)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE CLOCK THROUGH THE PUBLIC ENTRY.

/** The distinct-language fences: `count` fences, the i-th in language `lang<i>`, the last one `{r}` (so the answer is knitr only if the whole list was read to its end), then a tag that makes the text new. */
function distinctFences(count: number, tag: string): string {
  const fences = Array.from({ length: count - 1 }, (_, i) => "```{lang" + i + "}\nx\n```");
  fences.push("```{r}\nx\n```");
  return fences.join("\n") + "\n" + tag;
}

/** The same number of fences, all in ONE language, then a tag. */
function oneLanguageFences(count: number, tag: string): string {
  return Array.from({ length: count }, () => "```{python}\nx\n```").join("\n") + "\n" + tag;
}

/** The ratio limit of the clock row: the parent's is 21 at 64,000 distinct languages and the cure's about 1 (the lead's probe, load 6 to 15). */
const RATIO_LIMIT = 4;
const DISTINCT_LANGUAGES = 64_000;

describe("Session 343 -- resolveDocumentEngine over thousands of DISTINCT fence languages costs about the same call on one language, not their square (the BACKLOG item \"What Session 342's review round found beside the typing-path cures\", part 4, SIB-06)", () => {
  it(`${DISTINCT_LANGUAGES.toLocaleString("en-US")} distinct languages: the engine is knitr (the last fence is {r}), and the call takes under ${RATIO_LIMIT} times the same call on ${DISTINCT_LANGUAGES.toLocaleString("en-US")} fences of one language`, () => {
    resolveDocumentEngine("a.qmd", distinctFences(64, "warm")); // the code is compiled before either window opens
    const run = timeAgainstBaseline(
      () => resolveDocumentEngine("a.qmd", oneLanguageFences(DISTINCT_LANGUAGES, "control")),
      () => resolveDocumentEngine("a.qmd", distinctFences(DISTINCT_LANGUAGES, "distinct")),
    );
    expect(run.result).toBe("knitr");
    expect(run.baselineMs).toBeGreaterThan(0);
    expect(run.ms).toBeGreaterThan(0);
    expect(clockBreaks(run, RATIO_LIMIT).join("; ")).toBe("");
  }, 120_000);

  it("keeps the size and the limit the clock row is built on", () => {
    expect([RATIO_LIMIT, DISTINCT_LANGUAGES]).toEqual([4, 64_000]);
    expect(distinctFences(3, "t").split("\n")).toEqual(["```{lang0}", "x", "```", "```{lang1}", "x", "```", "```{r}", "x", "```", "t"]);
    expect(oneLanguageFences(2, "t").split("\n")).toEqual(["```{python}", "x", "```", "```{python}", "x", "```", "t"]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE ANSWER AT THE SIZE WHERE THE QUADRATIC SPELLING EXCEEDS A SECOND, AND THE ORACLE.

/** The fence a language is written in. */
const fence = (language: string): string => "```{" + language + "}\nx\n```";

/** Every sequence of 0 to `maxLength` members of `alphabet`, shortest first, each in lexicographic order of the alphabet's positions. */
function sequences(alphabet: readonly string[], maxLength: number): string[][] {
  const all: string[][] = [[]];
  let layer: string[][] = [[]];
  for (let length = 1; length <= maxLength; length++) {
    const next: string[][] = [];
    for (const prefix of layer) {
      for (const member of alphabet) next.push([...prefix, member]);
    }
    all.push(...next);
    layer = next;
  }
  return all;
}

/** A small seeded generator (mulberry32): the same seed, the same documents, on any machine. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("Session 343 -- the list languagesInMarkdown makes is the one the Array.includes spelling made: the same languages, lower-cased, each once, in first-appearance order", () => {
  it("at 64,000 distinct languages (the size where the quadratic spelling took 4 s) the list is the 63,999 languages in the order they appear, and then r", () => {
    const text = distinctFences(DISTINCT_LANGUAGES, "answer");
    const expected = Array.from({ length: DISTINCT_LANGUAGES - 1 }, (_, i) => "lang" + i);
    expected.push("r");
    expect(languagesInMarkdown(text)).toEqual(expected);
  }, 120_000);

  it("at 64,000 fences of 10 spellings of 7 languages that come back round and round, the list is the 7 languages once each, lower-cased, in the order they FIRST appear", () => {
    const names = ["Zed", "alpha", "ALPHA", "beta", "r9", "Gamma", "gamma", "zed", "delta", "eps"];
    const text = Array.from({ length: DISTINCT_LANGUAGES }, (_, i) => fence(names[(i * 7 + (i >> 4)) % names.length])).join("\n");
    const seen: string[] = [];
    for (let i = 0; i < DISTINCT_LANGUAGES; i++) {
      const language = names[(i * 7 + (i >> 4)) % names.length].toLowerCase();
      if (!seen.includes(language)) seen.push(language);
    }
    expect(seen).toHaveLength(7);
    expect(languagesInMarkdown(text)).toEqual(seen);
  });

  // The named rows: what the docstring says, each as a short document.
  it.each([
    ["no fence at all", "# Title\n\nprose\n", []],
    ["the empty text", "", []],
    ["one fence", fence("python"), ["python"]],
    ["the same language twice", [fence("python"), fence("python")].join("\n"), ["python"]],
    ["two case variants are one language, spelled as the FIRST was written lower-cased", [fence("Python"), fence("python"), fence("PYTHON")].join("\n"), ["python"]],
    ["the order is the first appearance, not the last, not alphabetical", [fence("b"), fence("a"), fence("b"), fence("c"), fence("a")].join("\n"), ["b", "a", "c"]],
    ["julia then r, then r again", [fence("julia"), fence("r"), fence("R"), fence("julia")].join("\n"), ["julia", "r"]],
    ["r then julia", [fence("r"), fence("julia")].join("\n"), ["r", "julia"]],
    ["the names an object would answer for before it was asked (__proto__, constructor, toString, hasOwnProperty, valueOf) are languages like any other, each once", ["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf", "__proto__", "CONSTRUCTOR", "tostring"].map(fence).join("\n"), ["__proto__", "constructor", "tostring", "hasownproperty", "valueof"]],
    ["a fence the regex does not count (text after the brace, a space inside the braces) adds nothing", ["```{python} trailing", "```{ julia }", fence("ojs")].join("\n"), ["ojs"]],
    ["a fence the regex counts in a quote, behind a tab and with four backticks", ["> ```{b}", "\t```{c}", "````{d}", "``` {e}"].join("\n"), ["b", "c", "d", "e"]],
    ["the attribute tails knitr writes", ["```{r, echo=FALSE}", "```{R echo=TRUE}", "```{Python3, a=1}"].join("\n"), ["r", "python3"]],
  ] as Array<[string, string, string[]]>)("%s", (_name, text, expected) => {
    expect(languagesInMarkdown(text)).toEqual(expected);
    expect(oldLanguagesInMarkdown(text)).toEqual(expected); // the oracle says the same: the row states the old answer
  });

  it("two calls on one text give the same list (the regex is built per call: a /g regex carries its lastIndex)", () => {
    const text = [fence("r"), fence("b"), fence("r")].join("\n");
    expect(languagesInMarkdown(text)).toEqual(["r", "b"]);
    expect(languagesInMarkdown(text)).toEqual(["r", "b"]);
  });

  it("the list handed back is the caller's: pushing to it changes nothing of the next call's", () => {
    const text = [fence("a"), fence("b")].join("\n");
    const first = languagesInMarkdown(text);
    first.push("zzz");
    first.reverse();
    expect(languagesInMarkdown(text)).toEqual(["a", "b"]);
  });

  describe.each([
    ["r, R and julia", ["r", "R", "julia"]],
    ["Py, py and r", ["Py", "py", "r"]],
    ["a, A and b", ["a", "A", "b"]],
  ] as Array<[string, string[]]>)("every sequence of up to five fences over %s (364 documents)", (_name, alphabet) => {
    const all = sequences(alphabet, 5);

    it("is 364 sequences, the first empty and the last five long", () => {
      expect(all).toHaveLength(364);
      expect(all[0]).toEqual([]);
      expect(all[363]).toHaveLength(5);
    });

    it("the list equals the old spelling's for every one, and the engine resolveDocumentEngine answers is the one the old list makes", () => {
      const disagreements: string[] = [];
      for (const sequence of all) {
        const text = sequence.map(fence).join("\n");
        const old = oldLanguagesInMarkdown(text);
        const got = languagesInMarkdown(text);
        if (JSON.stringify(got) !== JSON.stringify(old)) disagreements.push(`${sequence.join(",")}: ${JSON.stringify(got)} against ${JSON.stringify(old)}`);
        const engine = resolveDocumentEngine("a.qmd", text);
        if (engine !== oldEngineFromLanguages(old)) disagreements.push(`${sequence.join(",")}: the engine ${String(engine)} against ${oldEngineFromLanguages(old)}`);
      }
      expect(disagreements).toEqual([]);
    });
  });

  it("3,000 seeded documents of fence shapes the regex counts and does not count, over 60 languages in two cases: the list equals the old spelling's for every one", () => {
    const next = seeded(343);
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)];
    const names = [...Array.from({ length: 40 }, (_, i) => "lang" + i), "r", "R", "julia", "Julia", "python", "Python", "ojs", "mermaid", "dot", "__proto__", "constructor", "Lang3", "LANG3", "r9", "R9", "Py", "py", "a", "A", "b"];
    const shapes: Array<(n: string) => string> = [
      (n) => "```{" + n + "}",
      (n) => "```{" + n + "}",
      (n) => "```{" + n + ", echo=FALSE}",
      (n) => "```{" + n + " echo=FALSE}",
      (n) => "````{" + n + "}",
      (n) => "> ```{" + n + "}",
      (n) => "\t```{" + n + "}",
      (n) => "``` {" + n + "}",
      (n) => "```{" + n + "} trailing",
      (n) => "```{ " + n + " }",
      (n) => "```" + n,
      (n) => "    ```{" + n + "}    ",
    ];
    const fill = ["", "prose", "# Heading", "x = 1", "```", "<!-- ```{julia} -->", "---"];
    const disagreements: string[] = [];
    for (let doc = 0; doc < 3000; doc++) {
      const lines: string[] = [];
      const count = Math.floor(next() * 40);
      for (let i = 0; i < count; i++) lines.push(next() < 0.6 ? pick(shapes)(pick(names)) : pick(fill));
      const text = lines.join(next() < 0.2 ? "\r\n" : "\n");
      const old = oldLanguagesInMarkdown(text);
      const got = languagesInMarkdown(text);
      if (JSON.stringify(got) !== JSON.stringify(old)) disagreements.push(`doc ${doc}: ${JSON.stringify(got)} against ${JSON.stringify(old)}`);
    }
    expect(disagreements).toEqual([]);
  });
});
