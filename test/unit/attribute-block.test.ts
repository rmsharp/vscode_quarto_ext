import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { divOpenerVerdict, parseAttributeBlock } from "../../src/core/qmd/attribute-block";

const MARKDOWN = { commonmarkDialect: false, pandocEscapes: true } as const;

describe("divOpenerVerdict — pandoc div-fence production, markdown family", () => {
  it("a quote opens only as the first character of a value, so the apostrophe in O'Brien is content", () => {
    // pandoc: Div ("",["callout-note"],[("data-author","O'Brien"),("title","Note")])
    expect(divOpenerVerdict(" {.callout-note data-author=O'Brien title='Note'}", MARKDOWN)).toEqual({
      kind: "attr",
      attr: {
        id: "",
        classes: ["callout-note"],
        kvs: [
          { key: "data-author", raw: "O'Brien", quote: null },
          { key: "title", raw: "Note", quote: "'" },
        ],
      },
    });
  });

  // Rows below are pandoc 3.6.3's own Attr, re-measured with `quarto pandoc -f markdown -t native`
  // (scratchpad/s281/q.sh): the Div's (id, classes, kvs).
  const attr = (id: string, classes: string[], kvs: [string, string, '"' | "'" | null][] = []) => ({
    kind: "attr" as const,
    attr: { id, classes, kvs: kvs.map(([key, raw, quote]) => ({ key, raw, quote })) },
  });
  it.each([
    ["one class holds its dots: .a.b is ONE class", " {.a.b #x k=v}", attr("x", ["a.b"], [["k", "v", null]])],
    ["an id may start with a digit", " {#1a}", attr("1a", [])],
    ["a lone - is the unnumbered class", " {-}", attr("", ["unnumbered"])],
    ["the last #id wins", " {.a #b #c}", attr("c", ["a"])],
    ["an empty quoted value is an empty value", ' {k=""}', attr("", [], [["k", "", '"']])],
    ["both quote kinds, spaces inside", " {k='a b' j=\"c d\"}", attr("", [], [["k", "a b", "'"], ["j", "c d", '"']])],
    ["a bare value may be empty: k= .c is k=\"\" plus class c", " {k= .c}", attr("", ["c"], [["k", "", null]])],
    ["a key keeps - _ : and non-ASCII letters; a class may start with a non-ASCII letter", " {.é k:x-y=1}", attr("", ["é"], [["k:x-y", "1", null]])],
  ])("%s", (_name, tail, expected) => {
    expect(divOpenerVerdict(tail, MARKDOWN)).toEqual(expected);
  });

  // Verdicts for what is NOT an attribute block, each re-measured by `scratchpad/s281/q.sh`.
  // A one-literal-class div is `word`; a paragraph is `refused`.
  it.each([
    ["a class not led by a letter fails the block, then the WORD route reads it", " {.1a}", { kind: "word", word: "{.1a}", fallback: true }],
    ["a key not led by a letter", " {1k=v}", { kind: "word", word: "{1k=v}", fallback: true }],
    ["- glued to a word is not the unnumbered atom", " {-x}", { kind: "word", word: "{-x}", fallback: true }],
    ["a bare word with no braces is the class", " callout-note :::", { kind: "word", word: "callout-note", fallback: false }],
    ["a failed block followed only by the tail rule is a one-class div", " {.callout-note!} :::", { kind: "word", word: "{.callout-note!}", fallback: true }],
    ["a LEADING NBSP makes the whole spec one word (NBSP is a word character)", " \u00a0{.callout-note}", { kind: "word", word: "\u00a0{.callout-note}", fallback: false }],
    ["once a block has parsed, WORD is never tried", " {.a}x", { kind: "refused", reason: "trailing-text" }],
    ["a failed block whose WORD is followed by more text is paragraph text", " {.callout-note title}", { kind: "refused", reason: "invalid-token" }],
    ["the quote fallback: a quote followed by a space is a bare value, so the next word is a bare string", ' {k=" zz"}', { kind: "refused", reason: "invalid-token" }],
    ["a blank tail is a closer, never an opener", "   ", { kind: "refused", reason: "invalid-token" }],
    ["a block still open at the end of the line cannot be decided by one line", " {.a", { kind: "open-at-eol" }],
    ["a quote-fallback character with only blanks behind it is open-at-eol", ' {k=" ', { kind: "open-at-eol" }],
    ["a quoted value that never closes on the line is open-at-eol", ' {k="abc', { kind: "open-at-eol" }],
  ])("%s", (_name, tail, expected) => {
    expect(divOpenerVerdict(tail, MARKDOWN)).toEqual(expected);
  });

  it("the tail rule allows blanks around a colon run after a parsed block", () => {
    expect(divOpenerVerdict(" {.a} :::  ", MARKDOWN)).toEqual(attr("", ["a"]));
  });

  it("a backslash escape is stepped over: \\} does not close the block, \\<space> does not end a bare value", () => {
    expect(divOpenerVerdict(" {k=a\\}b}", MARKDOWN)).toEqual(attr("", [], [["k", "a\\}b", null]]));
    expect(divOpenerVerdict(" {k=a\\ b}", MARKDOWN)).toEqual(attr("", [], [["k", "a\\ b", null]]));
    expect(divOpenerVerdict(' {.a title="x\\"y"}', MARKDOWN)).toEqual(attr("", ["a"], [["title", 'x\\"y', '"']]));
  });

  it("markdown_strict does not escape a space (`\\<space>` is a backslash then a separator)", () => {
    const strict = { commonmarkDialect: false, pandocEscapes: false } as const;
    expect(divOpenerVerdict(" {k=a\\ b}", strict)).toEqual({ kind: "refused", reason: "invalid-token" });
  });

  it("the CommonMark family is unmeasured: it refuses nothing", () => {
    expect(divOpenerVerdict(" {.a}", { commonmarkDialect: true, pandocEscapes: true })).toEqual({ kind: "unmeasured" });
  });
});

describe("attribute-block.ts is a LEAF that reads pandoc whitespace, not JavaScript's", () => {
  // Comments are stripped first: the docstrings name `\s` and `.trim(` to say they are forbidden.
  const code = readFileSync(path.join(__dirname, "../../src/core/qmd/attribute-block.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  it("imports nothing, so both bundles can import it", () => {
    expect(code).not.toMatch(/^\s*import\b|\brequire\(/m);
  });
  it("uses no \\s class (JS \\s is not pandoc's space)", () => {
    expect(code).not.toContain("\\s");
  });
  it("never calls .trim( (it strips NBSP, which pandoc keeps)", () => {
    expect(code).not.toContain(".trim(");
  });
});

interface TruthSide {
  kind: "attr" | "word" | "refused";
  fallback: boolean;
  id: string;
  classes: string[];
  kvs: [string, string][];
}
interface TruthRow {
  id: string;
  spec: string;
  dialect: "markdown" | "markdown_strict";
  indent: number;
  tailCol: number;
  oneLine: TruthSide;
  continuation: TruthSide;
}

/** The caller's duty: pandoc expands TABs to 4-column stops of the PHYSICAL line before parsing. */
function expandTabs(text: string, startCol: number): string {
  let out = "";
  let col = startCol;
  for (const ch of text) {
    if (ch === "\t") {
      const n = 4 - (col % 4);
      out += " ".repeat(n);
      col += n;
    } else {
      out += ch;
      col += 1;
    }
  }
  return out;
}

describe("conformance — the leaf against pandoc's own Attr (test/unit/attribute-block-truth.json)", () => {
  const truth = JSON.parse(
    readFileSync(path.join(__dirname, "attribute-block-truth.json"), "utf8"),
  ) as { rows: TruthRow[] };
  // pandoc 3.6.3 refuses every INDENTED opener, so only indent 0 reaches the tail grammar.
  const rows = truth.rows.filter((r) => r.indent === 0);
  const wrong: string[] = [];
  const residual: string[] = [];
  let openAtEol = 0;
  for (const r of rows) {
    const dialect = { commonmarkDialect: false, pandocEscapes: r.dialect === "markdown" };
    const tail = expandTabs(" " + r.spec, r.tailCol);
    const v = divOpenerVerdict(tail, dialect);
    const t = r.oneLine;
    if (v.kind === "open-at-eol") {
      openAtEol++;
      const scan = parseAttributeBlock(tail, tail.indexOf("{"), dialect);
      if (scan.kind !== "refused" || scan.at !== tail.length) {
        wrong.push(`${r.id} ${r.dialect}: open-at-eol with at !== end`);
      }
      continue;
    }
    if (v.kind !== t.kind) {
      wrong.push(`${r.id} ${r.dialect} ${JSON.stringify(r.spec)}: leaf ${v.kind} vs pandoc ${t.kind}`);
      continue;
    }
    if (v.kind === "word" && v.fallback !== t.fallback) {
      wrong.push(`${r.id} ${r.dialect} ${JSON.stringify(r.spec)}: fallback ${v.fallback} vs ${t.fallback}`);
    }
    if (v.kind === "refused" && r.continuation.kind !== "refused") {
      wrong.push(`${r.id} ${r.dialect} ${JSON.stringify(r.spec)}: refused but the continuation framing opens a div`);
    }
    if (v.kind === "attr") {
      const a = v.attr;
      const idClassesDiffer = a.id !== t.id || JSON.stringify(a.classes) !== JSON.stringify(t.classes);
      if (idClassesDiffer && /class=[^}]*[&\\]/.test(r.spec)) {
        // KNOWN RESIDUAL: a `class=` value holding an entity or escape is undecoded here, and the
        // model routes it to HEAD's reading (plan §2.2 divSpecReading).
        residual.push(`${r.id} ${r.dialect} class=: ${JSON.stringify(r.spec)}`);
      } else if (idClassesDiffer) {
        wrong.push(`${r.id} ${r.dialect} ${JSON.stringify(r.spec)}: id/classes ${a.id} ${a.classes} vs ${t.id} ${t.classes}`);
      }
      const keys = a.kvs.map((k) => k.key);
      if (JSON.stringify(keys) !== JSON.stringify(t.kvs.map((k) => k[0]))) {
        wrong.push(`${r.id} ${r.dialect} ${JSON.stringify(r.spec)}: kv keys ${keys} vs ${t.kvs.map((k) => k[0])}`);
      } else {
        a.kvs.forEach((k, i) => {
          if (k.raw !== t.kvs[i][1]) {
            residual.push(`${r.id} ${r.dialect} ${k.key}: raw ${JSON.stringify(k.raw)} vs pandoc ${JSON.stringify(t.kvs[i][1])}`);
          }
        });
      }
    }
  }
  it("agrees on kind, fallback, id, classes and kv keys on every indent-0 row", () => {
    expect(wrong).toEqual([]);
  });
  it("counts the open-at-eol rows (each decided by the next line, never a refusal)", () => {
    expect(openAtEol).toBeGreaterThan(0);
  });
  it("KNOWN RESIDUAL: raw values differ from pandoc's decoded value only where an escape or entity is written", () => {
    // Values are not decoded (filed). Every residual row must hold a backslash or an entity.
    expect(residual.filter((x) => !/\\\\|&/.test(x))).toEqual([]);
  });
});
