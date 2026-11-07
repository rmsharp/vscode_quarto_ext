import { describe, expect, it } from "vitest";
import { isRenderScript, isRenderScriptDocument, type RenderScriptSource } from "../../src/core/render-script";

// Session 344, part (8)(a) of "What Session 342's review round found beside the typing-path cures" (SIB-08): the render-script predicate read the WHOLE buffer, with `getText()`, on every keystroke of a
// `.py`, `.jl` or `.r` document. `isRenderScriptDocument(fileName, document)` answers the same question by reading the document line by line through `{ lineCount, lineAt(i).text }` (what a
// `vscode.TextDocument` gives) and stops as soon as the answer is decided.
//
// THE ORACLE below is the old function, VERBATIM (Learning 738): the two regular expressions, the extension rule and the three lines of `isRenderScript` as they stood at `9266998`. It is a copy and
// not an import, so that a later respelling of `src/core/render-script.ts` cannot move the thing the lazy function is held to. The first row holds the copy to the source.
//
// WHAT IS PROVED, AND HOW. The hard requirement is that the lazy answer is IDENTICAL to `isRenderScript(fileName, lines.join(eol))` for every document and file name, where the extension host
// joins the lines with the document's end of line. The lazy function is not told the end of line, so every document below is compared with BOTH joins ("\n" and "\r\n"): equality with both is the
// proof that neither pattern tells them apart, for the documents drawn (it is not assumed).
//   1. EXHAUSTIVE passes: every token sequence up to a length, over small alphabets whose tokens are the pieces of a line. A line break is a token (B), so an empty line is two of them side by side, and
//      the lines of a document are what lies between breaks. Four alphabets (percent, percent with raw, spin, wide) and the one-edit-and-two-edit neighbourhood of eight documents that ARE render scripts.
//   2. EVERY UTF-16 CODE UNIT in the gaps of a script (what `\s` is, asked of the engine and not of a table written here).
//   3. SEEDED larger documents (mulberry32), drawn so that about a third are scripts, over thirteen file names.
//   4. The quirks the task names, one row each.
// A document's lines are what `vscode` hands out, so no line holds "\n" or "\r"; the seeded pass also draws lines that hold both, as a margin, and the lazy function must not care.

// ---- THE ORACLE: src/core/render-script.ts at 9266998, verbatim ----------------------------------------------------------------------------------------------------------------------------------

/** Path A: the file opens with a Jupyter percent markdown/raw cell. */
const PERCENT_CELL = /^\s*#\s*%%+\s+\[(markdown|raw)\]/;
/** Extensions the jupyter/julia engines claim as percent scripts. */
const PERCENT_EXTENSIONS = [".py", ".jl", ".r"];
/** Path B: the file opens with a roxygen `#' ---` ... `#' ---` front-matter block. */
const SPIN_HEADER = /^\s*#'\s*---[\s\S]+?#'\s*---/;
/** The knitr engine only spins R. */
const SPIN_EXTENSION = ".r";
/** The lowercased extension of `fileName`, including the dot (`""` if none). */
function extensionOf(fileName: string): string {
  const base = fileName.slice(Math.max(fileName.lastIndexOf("/"), fileName.lastIndexOf("\\")) + 1);
  const dot = base.lastIndexOf(".");
  // `dot <= 0` also rejects a dotfile (`.env`), which has no extension.
  return dot <= 0 ? "" : base.slice(dot).toLowerCase();
}
function oracle(fileName: string, text: string): boolean {
  const ext = extensionOf(fileName);
  if (PERCENT_EXTENSIONS.includes(ext) && PERCENT_CELL.test(text)) {
    return true;
  }
  return ext === SPIN_EXTENSION && SPIN_HEADER.test(text);
}

// ---- the document the lazy function is handed ---------------------------------------------------------------------------------------------------------------------------------------------------------

interface CountingDocument extends RenderScriptSource {
  /** The index of every `lineAt` call, in order. */
  readonly reads: number[];
}

/** A document of `lines`, as the extension host gives one: `lineAt` throws for an index outside it (`Illegal value for `line``), and every call is recorded. */
function documentOf(lines: readonly string[]): CountingDocument {
  const reads: number[] = [];
  return {
    lineCount: lines.length,
    reads,
    lineAt(index: number) {
      if (!Number.isInteger(index) || index < 0 || index >= lines.length) {
        throw new RangeError(`Illegal value for \`line\`: ${index}`);
      }
      reads.push(index);
      return { text: lines[index] };
    },
  };
}

/** True iff `reads` is 0, 1, 2 ... k-1: every line it read it read once, in order, from the top, and none past the end. */
function isPrefixInOrder(reads: readonly number[], lineCount: number): boolean {
  if (reads.length > lineCount) return false;
  for (let i = 0; i < reads.length; i++) {
    if (reads[i] !== i) return false;
  }
  return true;
}

// ---- the differential -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const LF = "\n";
const CRLF = "\r\n";

/** Why the lazy answer for `(fileName, lines)` is not the oracle's on a join with either end of line, or `undefined` when it is. */
function disagreement(fileName: string, lines: readonly string[]): string | undefined {
  const document = documentOf(lines);
  const got = isRenderScriptDocument(fileName, document);
  const viaLf = oracle(fileName, lines.join(LF));
  const viaCrlf = oracle(fileName, lines.join(CRLF));
  if (got !== viaLf || got !== viaCrlf) {
    return `${fileName} ${JSON.stringify(lines)}: lazy ${got}, oracle ${viaLf} on LF and ${viaCrlf} on CRLF`;
  }
  if (!isPrefixInOrder(document.reads, lines.length)) {
    return `${fileName} ${JSON.stringify(lines)}: lines read ${JSON.stringify(document.reads.slice(0, 12))}, not a prefix in order`;
  }
  return undefined;
}

/** Collects the first few disagreements of a pass and how many documents it saw and how many the oracle accepted. */
class Tally {
  documents = 0;
  accepted = 0;
  readonly problems: string[] = [];
  note(fileName: string, lines: readonly string[]): void {
    this.documents++;
    if (oracle(fileName, lines.join(LF))) this.accepted++;
    if (this.problems.length < 5) {
      const problem = disagreement(fileName, lines);
      if (problem !== undefined) this.problems.push(problem);
    }
  }
}

/** The line break, as a token. */
const B = "\n";

/** The lines of a document written as tokens: the pieces between line breaks (so `[]` is one empty line, and `[B]` two). */
const linesOfTokens = (tokens: readonly string[]): string[] => tokens.join("").split(B);

/** Every token sequence of length 0 to `maxLength` over `alphabet`, once each, depth first. */
function enumerateTokens(alphabet: readonly string[], maxLength: number, visit: (tokens: readonly string[]) => void): void {
  const sequence: string[] = [];
  const walk = (): void => {
    visit(sequence);
    if (sequence.length === maxLength) return;
    for (const token of alphabet) {
      sequence.push(token);
      walk();
      sequence.pop();
    }
  };
  walk();
}

describe("Session 344 — the oracle is the source's isRenderScript (the copy has not drifted)", () => {
  it("a fixed battery gives the same answer through the copy and the source", () => {
    const names = ["/tmp/a.py", "/tmp/a.jl", "/tmp/a.r", "/tmp/a.R", "/tmp/a.qmd", "/tmp/a", ""];
    const texts = ["", "\n\n", "# %% [markdown]", "# %% [raw]\nx", "x\n# %% [markdown]", "#' ---\n#' title: T\n#' ---\n", "#' ---\nx\n", "#' ---#' ---", "  \t# %%\n\n [markdown]"];
    for (const name of names) {
      for (const text of texts) {
        expect(isRenderScript(name, text), `${name} ${JSON.stringify(text)}`).toBe(oracle(name, text));
      }
    }
  });
});

/** The lead's pieces of a line: an empty line is two breaks side by side; the rest are the characters and words a script's first lines are made of. */
const WIDE = [B, " ", "\t", "#", "%", "'", "-", "[", "]", "markdown", "raw", "x", "\u2028", "\ufeff", "\u00a0"];
/** The tokens a one-edit and two-edit neighbourhood draws from: `WIDE` and the three runs that a script is made of. */
const EDITS = [...WIDE, "%%", "#'", "---"];

describe("Session 344 — the lazy answer is the oracle's: exhaustive passes", () => {
  it("the percent alphabet: every token sequence of up to 8 tokens over {line break, space, #, %, [, ], markdown}, for .jl", () => {
    const alphabet = [B, " ", "#", "%", "[", "markdown", "]"];
    const tally = new Tally();
    enumerateTokens(alphabet, 8, (tokens) => tally.note("/tmp/a.jl", linesOfTokens(tokens)));
    expect(tally.problems).toEqual([]);
    // the pass is not vacuous: the oracle accepts 30 of these documents (the minimal script `#%% [markdown]` with a space or a line break for its gap, two of seven tokens, and 28 of eight), counted by running it
    expect(tally.accepted).toBe(30);
    expect(tally.documents).toBe(1 + 7 + 7 ** 2 + 7 ** 3 + 7 ** 4 + 7 ** 5 + 7 ** 6 + 7 ** 7 + 7 ** 8);
  }, 120_000);

  it("the percent alphabet with raw: every token sequence of up to 7 tokens over {line break, space, #, %, [, ], raw, markdown}, for .py and .r", () => {
    const alphabet = [B, " ", "#", "%", "[", "]", "raw", "markdown"];
    for (const fileName of ["/tmp/a.py", "/tmp/a.r"]) {
      const tally = new Tally();
      enumerateTokens(alphabet, 7, (tokens) => tally.note(fileName, linesOfTokens(tokens)));
      expect(tally.problems).toEqual([]);
      // `#%% [markdown]` and `#%% [raw]`, each with a space or a line break for its gap
      expect(tally.accepted).toBe(4);
    }
  }, 120_000);

  it("the spin alphabet: every token sequence of up to 7 tokens over {line break, space, #', ---, -, #, ', x}, for .r (a spin script) and .py (never one)", () => {
    const alphabet = [B, " ", "#'", "---", "-", "#", "'", "x"];
    for (const fileName of ["/tmp/a.r", "/tmp/a.py"]) {
      const tally = new Tally();
      enumerateTokens(alphabet, 7, (tokens) => tally.note(fileName, linesOfTokens(tokens)));
      expect(tally.problems).toEqual([]);
      if (fileName.endsWith(".r")) expect(tally.accepted).toBeGreaterThan(100);
      else expect(tally.accepted).toBe(0);
    }
  }, 120_000);

  it("the wide alphabet: every token sequence of up to 5 tokens over the 15 pieces (line break, space, tab, #, %, ', -, [, ], markdown, raw, x, U+2028, U+FEFF, U+00A0), for six file names", () => {
    for (const fileName of ["/tmp/a.py", "/tmp/a.jl", "/tmp/a.r", "/tmp/a.R", "/tmp/a.qmd", "/tmp/a"]) {
      const tally = new Tally();
      enumerateTokens(WIDE, 5, (tokens) => tally.note(fileName, linesOfTokens(tokens)));
      expect(tally.problems).toEqual([]);
      expect(tally.documents).toBe(1 + 15 + 15 ** 2 + 15 ** 3 + 15 ** 4 + 15 ** 5);
    }
  }, 120_000);

  /** The scripts the neighbourhood pass starts from: percent and spin, with line breaks between tokens, a byte order mark, a no-break space and a line separator, a header with a closer after a line of text. */
  const SCRIPTS: ReadonlyArray<readonly string[]> = [
    ["#", "%", "%", " ", "[", "markdown", "]"],
    ["#", " ", "%", "%", "%", " ", "[", "raw", "]"],
    ["\ufeff", "#", B, "%", "%", B, "[", "markdown", "]"],
    [B, B, "\u00a0", "#", "\u2028", "%", "%", "\t", "[", "raw", "]", B, "x"],
    ["#'", "---", " ", "#'", "---"],
    ["#'", " ", "---", B, "x", B, "#'", " ", "---"],
    ["\ufeff", "#'", B, "---", "x", "#'", "\u00a0", "---", "-"],
    [B, "#'", "\u2028", "---", B, "#'", B, B, "---"],
  ];

  /** Every sequence within `edits` edits (an insertion, a deletion or a substitution of one token) of one of `bases`, once each. */
  function neighbourhood(bases: ReadonlyArray<readonly string[]>, edits: number, alphabet: readonly string[]): Map<string, string[]> {
    const seen = new Map<string, string[]>();
    const key = (tokens: readonly string[]): string => JSON.stringify(tokens);
    let frontier: Array<readonly string[]> = [...bases];
    for (const base of bases) seen.set(key(base), [...base]);
    for (let round = 0; round < edits; round++) {
      const next: Array<readonly string[]> = [];
      for (const tokens of frontier) {
        const consider = (candidate: string[]): void => {
          const k = key(candidate);
          if (!seen.has(k)) {
            seen.set(k, candidate);
            next.push(candidate);
          }
        };
        for (let at = 0; at <= tokens.length; at++) {
          for (const token of alphabet) consider([...tokens.slice(0, at), token, ...tokens.slice(at)]);
        }
        for (let at = 0; at < tokens.length; at++) {
          consider([...tokens.slice(0, at), ...tokens.slice(at + 1)]);
          for (const token of alphabet) consider([...tokens.slice(0, at), token, ...tokens.slice(at + 1)]);
        }
      }
      frontier = next;
    }
    return seen;
  }

  it("the neighbourhood of eight scripts: every document within two edits (insert, delete or replace a token of the 18) of one, for six file names", () => {
    const documents = neighbourhood(SCRIPTS, 2, EDITS);
    for (const fileName of ["/tmp/a.py", "/tmp/a.jl", "/tmp/a.r", "/tmp/a.R", "/tmp/a.qmd", "/tmp/a"]) {
      const tally = new Tally();
      for (const tokens of documents.values()) tally.note(fileName, linesOfTokens(tokens));
      expect(tally.problems).toEqual([]);
      if (fileName.endsWith(".qmd") || fileName === "/tmp/a") expect(tally.accepted).toBe(0);
      else expect(tally.accepted).toBeGreaterThan(2000);
    }
  }, 120_000);

  it("every UTF-16 code unit, in the gaps of a percent and of a spin script (what \\s is, asked of the engine): 65,536 characters in 14 places, for .py and .r", () => {
    const tally = new Tally();
    for (let unit = 0; unit < 0x10000; unit++) {
      const c = String.fromCharCode(unit);
      for (const fileName of ["/tmp/a.py", "/tmp/a.r"]) {
        // before the `#`, between `#` and `%%`, between `%%` and `[`, inside `[markdown]` and after it
        tally.note(fileName, [`${c}# %% [markdown]`]);
        tally.note(fileName, [`#${c}%% [raw]`]);
        tally.note(fileName, [`# %%${c}[markdown]`]);
        tally.note(fileName, [`# %% [mark${c}down]`]);
        tally.note(fileName, [`# %% [markdown]${c}`]);
        // the same character alone on a line between the tokens
        tally.note(fileName, ["#", c, "%%", c, "[markdown]"]);
        // spin: before the opener, between `#'` and `---`, after it, before the closer's `#'`, between its `#'` and `---`
        tally.note(fileName, [`${c}#' ---`, `#' ---`]);
        tally.note(fileName, [`#'${c}---`, "x", "#' ---"]);
        tally.note(fileName, [`#' ---${c}#' ---`]);
        tally.note(fileName, [`#' ---x${c}#' ---`]);
        tally.note(fileName, [`#' ---`, `#'${c}---`]);
        tally.note(fileName, [`#' ---`, `#'`, c, `---`]);
        tally.note(fileName, [`#' ---`, `#'${c}-${c}--`]);
        tally.note(fileName, [`#' ---`, `#' ${c}`, `---`]);
      }
    }
    expect(tally.problems).toEqual([]);
    expect(tally.accepted).toBeGreaterThan(100_000);
  }, 120_000);
});

// ---- SEEDED larger documents -------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/** A seeded generator (mulberry32), so a failure names a reproducible document. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FILE_NAMES = ["/tmp/a.py", "/tmp/a.jl", "/tmp/a.r", "/tmp/a.R", "/tmp/A.PY", "/tmp/a.Jl", "C:\\x\\a.R", "/tmp/a.qmd", "/tmp/a.rmd", "/tmp/a.txt", "/tmp/a", "", "/tmp/.py"];

/** Pieces of a line for the seeded documents: whole lines of code and the half-lines a header is made of, with the exotic whitespace among them. */
const SEED_PIECES = [
  "", "", " ", "  ", "\t", "#", "# ", "#'", "#' ", "%%", "%%%", "%", "'", "---", "----", "--", "-", "[markdown]", "[raw]", "[", "]", "markdown", "raw", "x", "x <- 1", "import os", "print(raw)", "data[raw]",
  "\u2028", "\ufeff", "\u00a0", "\u3000", "\u2003", "\u180e", "\u0085", "\u200b", "#' title: T", "#' format: html", "# %%", "# %% [markdown]", "#' ---", "#'---", "# Hello",
];

/** A seeded document: about a third are percent scripts, a third spin scripts, the rest noise; some have an edit or two, some a long tail; a few hold a "\r" or "\n" inside a line. */
function seededDocument(next: () => number): string[] {
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)];
  const below = (n: number): number => Math.floor(next() * n);
  const kind = next();
  let tokens: string[] = [];
  const blanks = (): string[] => {
    const out: string[] = [];
    for (let i = below(4); i > 0; i--) out.push(pick(["", "", "", " ", "\t", "\ufeff", "\u00a0", "\u2028", "  \u3000"]), B);
    return out;
  };
  // a gap that is one space, or a line break, or a run of whitespace of either kind
  const gap = (): string[] => (next() < 0.5 ? [" "] : next() < 0.6 ? [B] : [pick([" ", "\t", "\u00a0"]), pick([B, " ", "\u2028", ""])]);
  if (kind < 0.33) {
    tokens = [...blanks(), "#", ...(next() < 0.5 ? gap() : []), "%", "%", ...(next() < 0.2 ? ["%"] : []), ...gap(), "[", pick(["markdown", "raw"]), "]"];
  } else if (kind < 0.66) {
    const middle: string[] = [];
    for (let i = below(6); i > 0; i--) middle.push(pick(["x <- 1", "#' title: T", "# note", "", "#' ---x"]), B);
    tokens = [...blanks(), "#'", ...(next() < 0.5 ? [" "] : next() < 0.3 ? [B] : []), "---", ...(next() < 0.2 ? ["-"] : []), B, ...middle];
    if (next() < 0.75) tokens.push("#'", ...(next() < 0.7 ? [" "] : next() < 0.5 ? [B] : []), "---");
  } else {
    for (let i = below(6); i > 0; i--) tokens.push(pick(SEED_PIECES), ...(next() < 0.5 ? [B] : []));
  }
  for (let edits = next() < 0.5 ? 1 + below(2) : 0; edits > 0; edits--) {
    const at = below(tokens.length + 1);
    const how = next();
    if (how < 0.4) tokens.splice(at, 0, pick(EDITS));
    else if (how < 0.7 && tokens.length > 0) tokens.splice(Math.min(at, tokens.length - 1), 1);
    else if (tokens.length > 0) tokens.splice(Math.min(at, tokens.length - 1), 1, pick(EDITS));
  }
  const lines = linesOfTokens(tokens);
  const tail = next() < 0.02 ? 2_000 : below(40);
  for (let i = 0; i < tail; i++) lines.push(pick(SEED_PIECES) + (next() < 0.7 ? pick(SEED_PIECES) : ""));
  if (next() < 0.03) lines[below(lines.length)] += pick(["\r", "\n", "\r\n"]);
  return lines;
}

describe("Session 344 — the lazy answer is the oracle's: seeded documents", () => {
  it("120,000 seeded documents of 1 to 2,000 lines, each under a seeded file name: every answer is the oracle's on both ends of line", () => {
    const next = random(344);
    const tally = new Tally();
    let longest = 0;
    for (let i = 0; i < 120_000; i++) {
      const lines = seededDocument(next);
      longest = Math.max(longest, lines.length);
      tally.note(FILE_NAMES[Math.floor(next() * FILE_NAMES.length)], lines);
    }
    expect(tally.problems).toEqual([]);
    // the generator's own rows: it draws scripts and non-scripts in numbers, and some long documents
    expect(tally.accepted).toBeGreaterThan(120_000 * 0.1);
    expect(tally.accepted).toBeLessThan(120_000 * 0.5);
    expect(longest).toBeGreaterThan(1_500);
  }, 120_000);
});

// ---- the quirks, one row each --------------------------------------------------------------------------------------------------------------------------------------------------------------------------

describe("Session 344 — the quirks the lazy answer must keep", () => {
  /** The lazy answer for `lines`, held to the oracle on both ends of line first. */
  function lazy(fileName: string, lines: readonly string[]): boolean {
    expect(disagreement(fileName, lines)).toBeUndefined();
    return isRenderScriptDocument(fileName, documentOf(lines));
  }

  it("a document with no lines is not a script (the host never gives one; the join of nothing is the empty text)", () => {
    expect(isRenderScriptDocument("/tmp/a.py", documentOf([]))).toBe(oracle("/tmp/a.py", [].join(LF)));
    expect(isRenderScriptDocument("/tmp/a.r", documentOf([]))).toBe(false);
  });

  it("one empty line, and a thousand of them, are not a script", () => {
    expect(lazy("/tmp/a.py", [""])).toBe(false);
    expect(lazy("/tmp/a.r", new Array<string>(1000).fill(""))).toBe(false);
  });

  it("any number of blank lines, a byte order mark, a no-break space and a line separator may come first (they are all \\s)", () => {
    expect(lazy("/tmp/a.py", ["", "", "", "# %% [markdown]"])).toBe(true);
    expect(lazy("/tmp/a.py", ["\ufeff# %% [markdown]"])).toBe(true);
    expect(lazy("/tmp/a.py", ["\u00a0", "\u2028\u2029 ", "\t# %% [raw]"])).toBe(true);
    expect(lazy("/tmp/a.r", ["\ufeff#' ---", "#' ---"])).toBe(true);
    expect(lazy("/tmp/a.r", ["", "\u00a0", "#' ---", "#' ---"])).toBe(true);
  });

  it("the percent pattern's \\s* and \\s+ span line breaks: `#` / `%%` / `[markdown]` on three lines is a script", () => {
    expect(lazy("/tmp/a.py", ["#", "", "%%", "  ", "[markdown]"])).toBe(true);
    expect(lazy("/tmp/a.jl", ["# %%", "[raw]"])).toBe(true);
    expect(lazy("/tmp/a.py", ["#%%[markdown]"])).toBe(false);
    expect(lazy("/tmp/a.py", ["# %", "% [markdown]"])).toBe(false);
    expect(lazy("/tmp/a.py", ["# %% [mark", "down]"])).toBe(false);
  });

  it("the spin pattern's \\s* spans line breaks, and its closer may be anywhere later", () => {
    expect(lazy("/tmp/a.r", ["#'", "---", "x", "#'", "", "---"])).toBe(true);
    expect(lazy("/tmp/a.r", ["#' ---", ...new Array<string>(5000).fill("x <- 1"), "#' ---"])).toBe(true);
    expect(lazy("/tmp/a.r", ["#' ---", "#' title: T", "x <- 1"])).toBe(false);
  });

  it("the closer needs one character of its own after the opener: `#' ---#' ---` is not a script, `#' --- #' ---` is, and so is a closer on the next line", () => {
    expect(lazy("/tmp/a.r", ["#' ---#' ---"])).toBe(false);
    expect(lazy("/tmp/a.r", ["#' --- #' ---"])).toBe(true);
    expect(lazy("/tmp/a.r", ["#' ---", "#' ---"])).toBe(true);
    expect(lazy("/tmp/a.r", ["#' ----", "#' ---"])).toBe(true);
    // the fourth dash is the character the closer needs
    expect(lazy("/tmp/a.r", ["#' ----#' ---"])).toBe(true);
    expect(lazy("/tmp/a.r", ["#' ---#' ---"])).toBe(false);
  });

  it("the extension decides which pattern applies: .py and .jl are percent only, .r (either case) both, nothing else", () => {
    const spin = ["#' ---", "#' title: T", "#' ---"];
    const percent = ["# %% [markdown]", "# Hi"];
    for (const fileName of ["/tmp/a.py", "/tmp/a.jl", "/tmp/A.PY"]) {
      expect(lazy(fileName, percent)).toBe(true);
      expect(lazy(fileName, spin)).toBe(false);
    }
    for (const fileName of ["/tmp/a.r", "/tmp/a.R", "C:\\x\\a.R"]) {
      expect(lazy(fileName, percent)).toBe(true);
      expect(lazy(fileName, spin)).toBe(true);
    }
    for (const fileName of ["/tmp/a.qmd", "/tmp/a.rmd", "/tmp/a.txt", "/tmp/a", "", "/tmp/.py", "/tmp/a.py.bak"]) {
      expect(lazy(fileName, percent)).toBe(false);
      expect(lazy(fileName, spin)).toBe(false);
    }
  });

  it("ordinary code that merely contains `raw]` is not a script (the divergence from quarto's own pattern)", () => {
    expect(lazy("/tmp/a.py", ["import numpy", "arr = data[raw]", "print(arr)"])).toBe(false);
    expect(lazy("/tmp/a.py", ["# %%", "x = 1", "", "# %% [raw]", "hi"])).toBe(false);
  });
});

// ---- the lines read: COUNTS, not clocks ---------------------------------------------------------------------------------------------------------------------------------------------------------------

/** `n` copies of `line`. */
const filler = (n: number, line = "x = 1"): string[] => new Array<string>(n).fill(line);

/** The lines `isRenderScriptDocument` asked for in `lines` under `fileName`, in order. */
function readsOf(fileName: string, lines: readonly string[]): number[] {
  const document = documentOf(lines);
  isRenderScriptDocument(fileName, document);
  return document.reads;
}

/** `[0, 1, ... count-1]`. */
const firstLines = (count: number): number[] => Array.from({ length: count }, (_, i) => i);

const MILLION = 1_000_000;

describe("Session 344 — a document whose leading lines decide the answer is read for those lines, not for the document", () => {
  // The cost the cure removes (SIB-08): `getText()` joined the whole buffer on every keystroke of a .py, .jl or .r document, for 0.09 ms at 5,000 lines and 12 ms at 500,000 to answer a question that the first
  // line answers. A COUNT of the lines asked for is the property: it does not move with the load of the machine, and the answer is the one the differential holds to the oracle.

  it("a plain script reads its first line and no other, whatever its length (1,000,000 lines)", () => {
    expect(readsOf("/tmp/a.py", ["import os", ...filler(MILLION)])).toEqual([0]);
    expect(readsOf("/tmp/a.r", ["library(x)", ...filler(MILLION)])).toEqual([0]);
    expect(readsOf("/tmp/a.jl", ["using Plots", ...filler(MILLION)])).toEqual([0]);
  });

  it("a percent script reads its first line (1,000,000 lines)", () => {
    expect(readsOf("/tmp/a.py", ["# %% [markdown]", ...filler(MILLION)])).toEqual([0]);
    expect(readsOf("/tmp/a.jl", ["# %% [raw]", ...filler(MILLION)])).toEqual([0]);
  });

  it("a file whose extension no pattern claims reads nothing (1,000,000 lines)", () => {
    for (const fileName of ["/tmp/a.qmd", "/tmp/a.rmd", "/tmp/a.txt", "/tmp/a.json", "/tmp/a", "", "/tmp/.py", "/tmp/a.py.bak"]) {
      expect(readsOf(fileName, ["# %% [markdown]", ...filler(MILLION)]), fileName).toEqual([]);
    }
  });

  it("leading blank lines are read, one each, and the first line with text decides (1,000 blank lines, then code, then 1,000,000 lines)", () => {
    expect(readsOf("/tmp/a.py", [...filler(1000, ""), "import os", ...filler(MILLION)])).toEqual(firstLines(1001));
    expect(readsOf("/tmp/a.py", [...filler(1000, " \t ﻿"), "# %% [markdown]", ...filler(MILLION)])).toEqual(firstLines(1001));
  });

  it("a percent marker split over lines is read for the lines it takes (`#`, a blank, `%%`, blanks, `[raw]`: five lines)", () => {
    expect(readsOf("/tmp/a.py", ["#", "", "%%", "  ", "[raw]", ...filler(MILLION)])).toEqual(firstLines(5));
  });

  it("a percent marker that cannot be completed stops at the line that breaks it (a lone `%` ends its line, `[mark` ends its line, `#` then code)", () => {
    expect(readsOf("/tmp/a.py", ["# %", "% [markdown]", ...filler(MILLION)])).toEqual([0]);
    expect(readsOf("/tmp/a.py", ["# %% [mark", "down]", ...filler(MILLION)])).toEqual([0]);
    expect(readsOf("/tmp/a.py", ["# %%[markdown]", ...filler(MILLION)])).toEqual([0]);
    expect(readsOf("/tmp/a.py", ["#", "", "x = 1", ...filler(MILLION)])).toEqual([0, 1, 2]);
  });

  it("a spin script is read to the end of its header (`#' ---`, a line, `#' ---`: three lines, then 1,000,000 lines)", () => {
    expect(readsOf("/tmp/a.r", ["#' ---", "#' title: T", "#' ---", ...filler(MILLION)])).toEqual(firstLines(3));
    expect(readsOf("/tmp/a.r", ["#'", "", "---", "x", "#'", "---", ...filler(MILLION)])).toEqual(firstLines(6));
  });

  it("a spin header whose closer is far away is read to the closer and no further (5,000 lines between, then 1,000,000 lines)", () => {
    expect(readsOf("/tmp/a.r", ["#' ---", ...filler(5000), "#' ---", ...filler(MILLION)])).toEqual(firstLines(5002));
  });

  it("a spin header that cannot be completed stops at the line that breaks it (`#' x`, `#' -`, `#' --x`: one line each)", () => {
    expect(readsOf("/tmp/a.r", ["#' title: T", ...filler(MILLION)])).toEqual([0]);
    expect(readsOf("/tmp/a.r", ["#' -", "--", ...filler(MILLION)])).toEqual([0]);
    expect(readsOf("/tmp/a.r", ["#' --x", ...filler(MILLION)])).toEqual([0]);
    expect(readsOf("/tmp/a.py", ["#' ---", "#' ---", ...filler(MILLION)])).toEqual([0]);
  });

  it("a header opened and never closed is read to the end, each line once (1,000,000 lines of roxygen after `#' ---`)", () => {
    const lines = ["#' ---", ...filler(MILLION, "#' title: T")];
    expect(readsOf("/tmp/a.r", lines)).toEqual(firstLines(lines.length));
  });

  it("no shape is read twice or past its end: 1,000,000 blank lines, 1,000,000 lines of `#'`, 1,000,000 lines of `#' x` after an opener", () => {
    for (const lines of [filler(MILLION, ""), filler(MILLION, "#'"), ["#' ---", ...filler(MILLION, "#' x")], ["#'", ...filler(MILLION, "#'")], [...filler(MILLION, " "), "# %%"]]) {
      expect(readsOf("/tmp/a.r", lines)).toEqual(firstLines(lines.length));
    }
  });
});

describe("Session 344 — the lines read are exactly the lines the answer needs", () => {
  // "Decided" is defined from the ORACLE alone, with no knowledge of how the lazy function works: after `k` lines the answer is decided when the document ends there, or the oracle accepts the first `k`
  // lines (a match in a prefix is a match in the document: neither pattern is anchored at the end), or NO continuation accepts them. The continuations are the probes below: for every live state of the two
  // patterns, one that completes it. The lazy function must have read a line count that is decided and whose predecessor is not: it stopped as soon as it could, and not before.
  const PROBES: readonly string[][] = [["# %% [markdown]"], ["%% [markdown]"], ["[markdown]"], ["#' ---"], ["---", "#' ---"], ["#' ---", "#' ---"]];

  function decided(fileName: string, lines: readonly string[], k: number): boolean {
    if (k >= lines.length) return true;
    const prefix = lines.slice(0, k);
    if (oracle(fileName, prefix.join(LF))) return true;
    return !PROBES.some((probe) => oracle(fileName, [...prefix, ...probe].join(LF)));
  }

  /** Why the lines `isRenderScriptDocument` read of `(fileName, lines)` are not the ones its answer needs, or `undefined`. */
  function readsProblem(fileName: string, lines: readonly string[]): string | undefined {
    const reads = readsOf(fileName, lines);
    const ext = extensionOf(fileName);
    const claimed = PERCENT_EXTENSIONS.includes(ext) || ext === SPIN_EXTENSION;
    const shown = `${fileName} ${JSON.stringify(lines.slice(0, 12))}: read ${reads.length} of ${lines.length}`;
    if (!claimed || lines.length === 0) return reads.length === 0 ? undefined : `${shown}, where it needs none`;
    if (reads.length === 0) return `${shown}, where it needs the first`;
    if (!decided(fileName, lines, reads.length)) return `${shown}: stopped before the answer was decided`;
    if (reads.length > 1 && decided(fileName, lines, reads.length - 1)) return `${shown}: read on after the answer was decided`;
    return undefined;
  }

  /** Runs `readsProblem` over `documents` under each of `fileNames` and returns the first few problems. */
  function problemsOf(fileNames: readonly string[], documents: Iterable<readonly string[]>): string[] {
    const problems: string[] = [];
    for (const lines of documents) {
      for (const fileName of fileNames) {
        if (problems.length < 5) {
          const problem = readsProblem(fileName, lines);
          if (problem !== undefined) problems.push(problem);
        }
      }
    }
    return problems;
  }

  function* tokenDocuments(alphabet: readonly string[], maxLength: number): Generator<string[]> {
    const all: string[][] = [];
    enumerateTokens(alphabet, maxLength, (tokens) => all.push(linesOfTokens(tokens)));
    yield* all;
  }

  it("the percent alphabet, up to 6 tokens, for .jl: every document is read for exactly the lines its answer needs", () => {
    expect(problemsOf(["/tmp/a.jl"], tokenDocuments([B, " ", "#", "%", "[", "markdown", "]"], 6))).toEqual([]);
  }, 120_000);

  it("the spin alphabet, up to 6 tokens, for .r and .py", () => {
    expect(problemsOf(["/tmp/a.r", "/tmp/a.py"], tokenDocuments([B, " ", "#'", "---", "-", "#", "'", "x"], 6))).toEqual([]);
  }, 120_000);

  it("the wide alphabet, up to 4 tokens, for .py, .r and .qmd", () => {
    expect(problemsOf(["/tmp/a.py", "/tmp/a.r", "/tmp/a.qmd"], tokenDocuments(WIDE, 4))).toEqual([]);
  }, 120_000);

  it("the one-edit neighbourhood of six scripts, for .py and .r", () => {
    const SCRIPTS: ReadonlyArray<readonly string[]> = [
      ["#", "%", "%", " ", "[", "markdown", "]"],
      ["﻿", "#", B, "%", "%", B, "[", "markdown", "]"],
      [B, B, " ", "#", " ", "%", "%", "\t", "[", "raw", "]", B, "x"],
      ["#'", "---", " ", "#'", "---"],
      ["#'", " ", "---", B, "x", B, "#'", " ", "---"],
      ["﻿", "#'", B, "---", "x", "#'", " ", "---", "-"],
    ];
    const documents: string[][] = [];
    for (const base of SCRIPTS) {
      documents.push(linesOfTokens(base));
      for (let at = 0; at <= base.length; at++) {
        for (const token of EDITS) {
          documents.push(linesOfTokens([...base.slice(0, at), token, ...base.slice(at)]));
          if (at < base.length) documents.push(linesOfTokens([...base.slice(0, at), token, ...base.slice(at + 1)]));
        }
        if (at < base.length) documents.push(linesOfTokens([...base.slice(0, at), ...base.slice(at + 1)]));
      }
    }
    expect(problemsOf(["/tmp/a.py", "/tmp/a.r"], documents)).toEqual([]);
  }, 120_000);

  it("20,000 seeded documents, under the seeded file names", () => {
    const next = random(3440);
    const documents: string[][] = [];
    const names: string[] = [];
    for (let i = 0; i < 20_000; i++) {
      documents.push(seededDocument(next));
      names.push(FILE_NAMES[Math.floor(next() * FILE_NAMES.length)]);
    }
    const problems: string[] = [];
    for (let i = 0; i < documents.length && problems.length < 5; i++) {
      const problem = readsProblem(names[i], documents[i]);
      if (problem !== undefined) problems.push(problem);
    }
    expect(problems).toEqual([]);
  }, 120_000);

  it("the model itself: the probes decide what they should (a live state is live, a dead one dead, the end of the document decides)", () => {
    expect(decided("/tmp/a.py", ["#", "", "x"], 2)).toBe(false);
    expect(decided("/tmp/a.py", ["#", "", "x"], 3)).toBe(true);
    expect(decided("/tmp/a.py", ["# %", "% [markdown]"], 1)).toBe(true);
    expect(decided("/tmp/a.py", ["# %%", "[markdown]"], 1)).toBe(false);
    expect(decided("/tmp/a.py", ["# %%", "[markdown]"], 2)).toBe(true);
    expect(decided("/tmp/a.r", ["#' ---", "x", "x"], 2)).toBe(false);
    expect(decided("/tmp/a.r", ["#'", "---", "#' ---"], 1)).toBe(false);
    expect(decided("/tmp/a.r", ["#'", "-", "--"], 2)).toBe(true);
    expect(decided("/tmp/a.py", ["#' ---", "#' ---"], 1)).toBe(true);
  });
});
