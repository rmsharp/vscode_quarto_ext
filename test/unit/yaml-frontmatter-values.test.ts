import { describe, expect, it } from "vitest";
import { findFrontMatterValueLines } from "../../src/core/yaml-frontmatter-values";

describe("findFrontMatterValueLines — top-level front-matter value lines", () => {
  it("emits a top-level scalar value line with key, value range, and raw token", () => {
    const text = ["---", "toc: true", "---", "", "Body."].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "toc", valueRange: { startCol: 5, endCol: 9 }, rawToken: "true" },
    ]);
  });

  it("emits multiple top-level scalars in document order, with exact ranges", () => {
    const text = ["---", "toc: yes", "number-sections: maybe", "df-print: banana", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "toc", valueRange: { startCol: 5, endCol: 8 }, rawToken: "yes" },
      { line: 2, key: "number-sections", valueRange: { startCol: 17, endCol: 22 }, rawToken: "maybe" },
      { line: 3, key: "df-print", valueRange: { startCol: 10, endCol: 16 }, rawToken: "banana" },
    ]);
  });
});

describe("findFrontMatterValueLines — bounded to the front matter (never the body)", () => {
  it("excludes a `key: value` line in the document BODY (front-matter scanner bounds the scan)", () => {
    const text = ["---", "toc: false", "---", "", "date: today", "toc: yes"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "toc", valueRange: { startCol: 5, endCol: 10 }, rawToken: "false" },
    ]);
  });

  it("returns [] for a document with no front matter", () => {
    const text = ["Just prose.", "", "toc: true"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([]);
  });

  it("handles an UNTERMINATED front-matter block (last line counts as content)", () => {
    const text = ["---", "toc: yes"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "toc", valueRange: { startCol: 5, endCol: 8 }, rawToken: "yes" },
    ]);
  });

  it("handles CRLF line endings", () => {
    const text = ["---", "toc: yes", "---", ""].join("\r\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "toc", valueRange: { startCol: 5, endCol: 8 }, rawToken: "yes" },
    ]);
  });
});

describe("findFrontMatterValueLines — never a false line (out-of-scope shapes are skipped)", () => {
  it("skips a block-opener (no scalar value) but emits its top-level scalar sibling", () => {
    const text = ["---", "format:", "number-sections: true", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 2, key: "number-sections", valueRange: { startCol: 17, endCol: 21 }, rawToken: "true" },
    ]);
  });

  it("skips a comment-only value (treated as no scalar)", () => {
    const text = ["---", "toc: # just a comment", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([]);
  });

  it("skips NESTED (indented) value lines — v2, not v1", () => {
    const text = ["---", "format:", "  html:", "    toc: true", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([]);
  });

  it("skips comment lines and block-sequence items", () => {
    const text = ["---", "# a comment", "toc: false", "- seqitem", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 2, key: "toc", valueRange: { startCol: 5, endCol: 10 }, rawToken: "false" },
    ]);
  });
});

describe("findFrontMatterValueLines — value-token grammar (quotes, comments, multi-colon)", () => {
  it("retains the quotes of a quoted value in rawToken and its range", () => {
    const text = ["---", 'toc: "true"', "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "toc", valueRange: { startCol: 5, endCol: 11 }, rawToken: '"true"' },
    ]);
  });

  it("strips a trailing unquoted inline comment from the value token", () => {
    const text = ["---", "toc: false # note", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "toc", valueRange: { startCol: 5, endCol: 10 }, rawToken: "false" },
    ]);
  });

  it("splits on the FIRST (mapping) colon, keeping a colon inside the value (title: My Talk: 2026)", () => {
    const text = ["---", "title: My Talk: 2026", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "title", valueRange: { startCol: 7, endCol: 20 }, rawToken: "My Talk: 2026" },
    ]);
  });
});

describe("findFrontMatterValueLines — the key/value SEPARATOR guard (P2, THE cardinal-sin FP, plan §2.8)", () => {
  it("parses `key:: value` at the SEPARATOR — key `toc:`, not `toc` (quarto renders it exit 0)", () => {
    // YAML's key is `toc:`, not `toc`. The `.qmd` front-matter top level is an OPEN key
    // set, so quarto accepts the odd key and renders exit 0 (firsthand-verified, S148),
    // while splitting at the FIRST colon yields the bogus value token `: true` — which
    // the matcher flags against toc's closed boolean enum. A cardinal-sin false positive.
    // Scanning forward to the real separator makes the key `toc:`, which matches no
    // schema field, so the feature skips it exactly as it skips any unknown key. The
    // no-diagnostic end state is locked in the integration suite.
    const text = ["---", "toc:: true", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "toc:", valueRange: { startCol: 6, endCol: 10 }, rawToken: "true" },
    ]);
  });

  it("does NOT emit a `key:value` line with NO space (quarto exit 1 — an accepted safe FN)", () => {
    const text = ["---", "toc:banana", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([]);
  });

  it("STILL emits when blanks precede the colon (`toc : banana` — quarto exit 1, a real mapping)", () => {
    // The trap this locks: the key SPAN ends at 3 (trailing blanks trimmed) but the colon
    // is at 4, so a guard applied at `keySlot.endCol` reads the colon itself as the
    // following character and wrongly skips the line. `toc : true` renders exit 0 and
    // `toc : banana` exit 1 (both firsthand-verified, S148), so this must stay validated.
    const text = ["---", "toc : banana", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "toc", valueRange: { startCol: 6, endCol: 12 }, rawToken: "banana" },
    ]);
  });

  it("still emits a TAB-separated value (`toc:\ttrue` renders exit 0 — a real mapping)", () => {
    const text = ["---", "toc:\tfalse", "---"].join("\n");
    expect(findFrontMatterValueLines(text).map((v) => v.key)).toEqual(["toc"]);
  });

  it("does NOT arm the multi-line skip from a NON-separator opener — safe, the shape is quarto-REJECTED", () => {
    // The guard's `continue` happens before the scanFlow arming, so `title:"…` no longer
    // arms the quote and the following line IS emitted. Safe for a structural reason: a
    // multi-line quoted/flow value can only OPEN as the VALUE of a mapping, so with no
    // separator there is no value and the next mapping-looking line is a YAML PARSE error
    // — quarto exits 1 with a YAMLException (firsthand-verified, S148). Agreement, not the
    // cardinal-sin FP. Locked so a future change to the guard's placement surfaces here.
    const text = ["---", 'title:"a long title that wraps', 'columns: wide"', "---"].join("\n");
    expect(findFrontMatterValueLines(text).map((v) => v.key)).toEqual(["columns"]);
  });

  it("ARMS the multi-line skip when a LATER colon is the separator (`a:b: \"text` — quarto exit 0)", () => {
    // §9-review finding, confirmed firsthand. The guard asked only about the FIRST colon,
    // but here the SECOND one is the separator: YAML's key is `a:b` and its value opens a
    // multi-line quoted scalar that folds the next line in. quarto renders it exit 0.
    // Treating the line as a non-mapping skipped the scanFlow arming, so `columns: wide"`
    // was emitted and flagged — a cardinal-sin FP this session INTRODUCED. The fix is to
    // scan forward for the first colon that IS a separator, not to judge the first colon.
    const text = ["---", 'a:b: "a long value that wraps', 'columns: wide"', "---"].join("\n");
    expect(findFrontMatterValueLines(text).map((v) => v.key)).toEqual(["a:b"]);
  });

  it("STILL arms the multi-line skip from a real separator opener (`title: \"…` renders exit 0)", () => {
    // The control that makes the case above safe rather than a regression: WITH the space
    // the colon is a separator, the guard passes, the arming works, and the folded
    // continuation line is skipped exactly as before — on a document quarto renders exit 0.
    // The OPENER line itself is still emitted here (this enumerator pushes, then arms; the
    // project enumerator instead skips its opener), but `title` is OPEN so nothing is
    // flagged. What matters is that `columns` — closed, numeric — is NOT emitted.
    const text = ["---", 'title: "a long title that wraps', 'columns: wide"', "---"].join("\n");
    expect(findFrontMatterValueLines(text).map((v) => v.key)).toEqual(["title"]);
  });
});

describe("findFrontMatterValueLines — multi-line flow collections (adversarial review, S125)", () => {
  // A value that opens an unclosed flow mapping `{…}` / sequence `[…]` spans
  // several lines; its continuation lines sit at column 0 and MUST NOT be
  // re-parsed as independent top-level mappings — quarto renders the whole thing
  // exit 0, so emitting e.g. `toc` from a continuation line would be a cardinal-sin
  // false positive downstream.
  it("does NOT emit column-0 continuation lines of a multi-line flow MAPPING", () => {
    const text = ["---", "mymeta: {", "toc: yes,", "x: 1}", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "mymeta", valueRange: { startCol: 8, endCol: 9 }, rawToken: "{" },
    ]);
  });

  it("resumes validation on the top-level line AFTER a multi-line flow SEQUENCE closes", () => {
    const text = ["---", "filters: [a,", "b]", "toc: yes", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "filters", valueRange: { startCol: 9, endCol: 12 }, rawToken: "[a," },
      { line: 3, key: "toc", valueRange: { startCol: 5, endCol: 8 }, rawToken: "yes" },
    ]);
  });

  it("does not enter flow-skip for a value that merely CONTAINS a bracket mid-scalar or is a QUOTED string", () => {
    // Neither opens a flow collection (a collection must START with [/{), so the
    // following top-level line stays validated — no over-suppression.
    const text = ["---", 'title: "A [ Talk"', "toc: yes", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "title", valueRange: { startCol: 7, endCol: 17 }, rawToken: '"A [ Talk"' },
      { line: 2, key: "toc", valueRange: { startCol: 5, endCol: 8 }, rawToken: "yes" },
    ]);
  });

  it("does not enter flow-skip for a single-line balanced flow collection", () => {
    const text = ["---", "filters: [a, b]", "toc: yes", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "filters", valueRange: { startCol: 9, endCol: 15 }, rawToken: "[a, b]" },
      { line: 2, key: "toc", valueRange: { startCol: 5, endCol: 8 }, rawToken: "yes" },
    ]);
  });
});

describe("findFrontMatterValueLines — multi-line QUOTED scalars (adversarial review, S130)", () => {
  // A multi-line single/double-QUOTED scalar folds its continuation line into the
  // value even when that continuation sits at COLUMN 0 — quarto renders the whole
  // span exit 0 as one string. So a continuation like `columns: wide"` is NOT a new
  // top-level mapping; emitting it would be a cardinal-sin false positive (the numeric
  // branch flags `columns`/`fig-width`, which were previously OPEN and masked it).
  // The quote-naive flow counter misses this (an open quote holds no `[]{}` brackets);
  // the fix is the quote-aware scanner the nested enumerator already uses (S128).
  it("does NOT emit the column-0 continuation of a multi-line DOUBLE-quoted scalar", () => {
    const text = ["---", 'title: "hello', 'columns: wide"', "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "title", valueRange: { startCol: 7, endCol: 13 }, rawToken: '"hello' },
    ]);
  });

  it("does NOT emit the column-0 continuation of a multi-line SINGLE-quoted scalar", () => {
    const text = ["---", "subtitle: 'intro", "fig-width: huge'", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "subtitle", valueRange: { startCol: 10, endCol: 16 }, rawToken: "'intro" },
    ]);
  });

  it("resumes validation on the top-level line AFTER the closing quote", () => {
    const text = ["---", 'title: "hello', 'world"', "toc: yes", "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "title", valueRange: { startCol: 7, endCol: 13 }, rawToken: '"hello' },
      { line: 3, key: "toc", valueRange: { startCol: 5, endCol: 8 }, rawToken: "yes" },
    ]);
  });
});

describe("findFrontMatterValueLines — arming discipline parity with findProjectConfigValueLines (BACKLOG: .qmd sibling-enumerator OLD arming, Session 153)", () => {
  // Two arming defects the `_quarto.yml` value enumerator already fixed but the `.qmd`
  // siblings still carried (grounded firsthand vs quarto 1.7.33; blast radius bounded by the
  // `---` fences). Both directions below render exit 0 (FP) or exit 1 (FN) — measured, not
  // assumed:
  //  • Defect B (the FALSE-POSITIVE, the one that matters): the continuation guard was armed
  //    only from EMITTED (column-0) lines, so a value opened on a SKIPPED line (indented,
  //    sequence item, no-colon) left its fold unguarded and its folded continuation was read
  //    as a real mapping and flagged on a document quarto renders exit 0.
  //  • Defect A (the false NEGATIVE): the arm scanned the WHOLE value token, so an inner quote
  //    in a plain scalar (`title: Don't Panic`) armed a phantom quote that swallowed the rest
  //    of the front matter — silently disabling validation of every following key.
  it("Defect B: does NOT emit a column-0 key folded inside an INDENTED multi-line quoted scalar", () => {
    // `css: "styles` opens a double-quoted scalar on an INDENTED line the top-level enumerator
    // skips; `df-print: banana` is FOLDED into that string and there is NO top-level df-print
    // key at all (quarto renders exit 0 — grounded firsthand). Arming only from emitted lines
    // left the fold unguarded, so df-print was emitted and flagged: a cardinal-sin FP.
    const text = ["---", "format:", "  html:", '    css: "styles', "df-print: banana", 'more"', "---"].join("\n");
    expect(findFrontMatterValueLines(text).map((v) => v.key)).toEqual([]);
  });

  it("Defect B: does NOT emit a column-0 key folded inside a SEQUENCE-item multi-line quoted scalar", () => {
    // `- "data` (an indented block-sequence item, no colon at all) opens a quoted scalar that
    // folds `df-print: banana` into the `resources` list; there is no top-level df-print key
    // (quarto exit 0, grounded firsthand). The arm token for a no-colon line is its content
    // past the leading `- `, so the sequence item arms even though it is never emitted.
    const text = ["---", "resources:", '  - "data', "df-print: banana", 'end"', "---"].join("\n");
    expect(findFrontMatterValueLines(text).map((v) => v.key)).toEqual([]);
  });

  it("Defect A: STILL emits a real key after an apostrophe-bearing plain scalar (no phantom quote)", () => {
    // `title: Don't Panic` is a plain scalar — the `'` is literal, quarto renders exit 0 — so it
    // must NOT arm a quote. `df-print: banana` below it is a real invalid value (quarto exit 1)
    // and MUST be emitted; the OLD whole-token arm set a phantom `'` that swallowed it (a FN).
    const text = ["---", "title: Don't Panic", "df-print: banana", "---"].join("\n");
    expect(findFrontMatterValueLines(text).map((v) => v.key)).toEqual(["title", "df-print"]);
  });

  it("control: a PLAIN column-0 closed-enum value is still emitted (no over-suppression)", () => {
    const text = ["---", "df-print: banana", "---"].join("\n");
    expect(findFrontMatterValueLines(text).map((v) => v.key)).toEqual(["df-print"]);
  });

  it("ABUTTING-ANCHOR strip (S155): an anchor abutting a flow bracket (`&a[one,`, no space) still arms — quarto folds it, exit 0", () => {
    // The node-property strip's name charset must EXCLUDE the YAML flow indicators `,[]{}` so it stops at —
    // and thus SEES — an opener that ABUTS the anchor with no space. The OLD strip
    // `/^(?:[&!][^\s]*[ \t]+)+/` let its greedy `[^\s]*` swallow the `[`, then the REQUIRED trailing
    // ws failed to match, so `keywords: &a[one,` was read as opening with `&`, the arm never fired,
    // and the folded `df-print: banana]` was emitted and flagged on a document `quarto render`
    // 1.7.33 RENDERS exit 0 (`keywords: &a[one,` / `df-print: banana]` folds to
    // `keywords: [one, {df-print: banana}]` — grounded firsthand: exit 0; a cardinal-sin FP).
    const abut = ["---", "keywords: &a[one,", "df-print: banana]", "---"].join("\n");
    expect(findFrontMatterValueLines(abut).map((v) => v.key)).toEqual(["keywords"]);
    // Emission RESUMES once the flow closes: `code-fold: banana` after the `]` is real again.
    const resumes = ["---", "keywords: &a[one,", "df-print: banana]", "code-fold: banana", "---"].join("\n");
    expect(findFrontMatterValueLines(resumes).map((v) => v.key)).toEqual(["keywords", "code-fold"]);
    // Parity: the abutting form now behaves IDENTICALLY to the SPACED (`&a [one,`) form, which
    // already armed — the change is a strict superset (it strips MORE, never less, of a property).
    const spaced = ["---", "keywords: &a [one,", "df-print: banana]", "---"].join("\n");
    expect(findFrontMatterValueLines(spaced).map((v) => v.key)).toEqual(["keywords"]);
  });

  it("ANCHOR-NAME QUOTE (S155 §9): a quote INSIDE an anchor name (`&a'b`) is a legal name char, NOT a quote opener — must not phantom-fold a following real key", () => {
    // YAML's flow indicators are ONLY `,[]{}`; a quote is a LEGAL anchor-name char. So `myref: &a'b`
    // is a node named `a'b` with a NULL value quarto ACCEPTS (exit 0), and `df-print: banana` below
    // it is a SEPARATE real key quarto REJECTS (exit 1, sole error). The name charset must KEEP
    // quotes so `&a'b` strips WHOLE and does NOT arm a phantom `'` that swallows `df-print`. Grounded
    // firsthand: myref+`df-print: banana` exit 1 (sole df-print error); myref+`df-print: kable` exit
    // 0 (proving myref: null accepted). The over-excluding S154 charset `[^\s[\]{}"']` dropped the TP.
    const q = ["---", "myref: &a'b", "df-print: banana", "---"].join("\n");
    expect(findFrontMatterValueLines(q).map((v) => v.key)).toEqual(["myref", "df-print"]);
  });
});

describe("findFrontMatterValueLines — QUOTED-KEY parity with findProjectConfigValueLines (S159)", () => {
  it("emits a double-quoted key UNQUOTED, so it resolves against the schema's bare names", () => {
    // Quoting a key is YAML-legal and semantically identical to its bare form: `quarto render`
    // 1.7.33 rejects `"toc": banana` with the SAME error it gives the unquoted line — `Field "toc"
    // has value banana, which must instead be true or false` (exit 1, grounded firsthand). Emitting
    // the key with its quotes still attached resolved against no field, so the diagnostic was
    // silently lost while the byte-identical line in `_quarto.yml` was correctly flagged
    // (`findProjectConfigValueLines` has unquoted since S47) — the surface-parity gap filed S149.
    const text = ["---", '"toc": banana', "---"].join("\n");
    expect(findFrontMatterValueLines(text)).toEqual([
      { line: 1, key: "toc", valueRange: { startCol: 7, endCol: 13 }, rawToken: "banana" },
    ]);
  });

  it("emits a SINGLE-quoted key unquoted too (`'toc': banana` renders exit 1 identically)", () => {
    // Grounded firsthand: `'toc': banana` → exit 1, `Field "toc" has value banana`.
    const text = ["---", "'toc': banana", "---"].join("\n");
    expect(findFrontMatterValueLines(text).map((v) => v.key)).toEqual(["toc"]);
  });

  it("emits the quoted `format` key unquoted, so the format-NAME path recognizes it", () => {
    // The consumer branches on `fm.key === "format"` before the generic matcher, so a quoted
    // `format` key must unquote or the whole format-name validation is skipped for it.
    // Grounded firsthand: `"format": banana` → exit 1, `Field "format" has value banana`.
    const text = ["---", '"format": banana', "---"].join("\n");
    expect(findFrontMatterValueLines(text).map((v) => v.key)).toEqual(["format"]);
  });

  it("keeps a key whose quotes do NOT form a matching pair intact — no over-stripping", () => {
    // The FP guard. Each of these is a document quarto rejects with a STRUCTURAL YAMLException
    // (exit 1, never a value error — grounded firsthand: `unexpected end of the stream within a
    // double quoted scalar` / `end of the stream or a document separator is expected`), so the
    // faithful answer is silence. Leaving the key intact achieves that: it resolves against no
    // schema field. An over-eager unquote (stripping whenever EITHER end is a quote) would
    // resurrect `toc` here and flag a structurally-broken document with a wrong-reason value
    // error — Learning #171b, and the mutant these three pins discriminate against.
    const unterminated = ["---", '"toc: banana', "---"].join("\n");
    expect(findFrontMatterValueLines(unterminated).map((v) => v.key)).toEqual(['"toc']);
    const trailingText = ["---", '"toc" x: banana', "---"].join("\n");
    expect(findFrontMatterValueLines(trailingText).map((v) => v.key)).toEqual(['"toc" x']);
    const mismatchedPair = ["---", `"toc': banana`, "---"].join("\n");
    expect(findFrontMatterValueLines(mismatchedPair).map((v) => v.key)).toEqual([`"toc'`]);
  });

  it("does NOT equate a quoted key whose CONTENT differs from the bare name (`\"toc \"` is a different key)", () => {
    // `"toc ": banana` is the key `toc ` (trailing space INSIDE the quotes), which front matter's
    // OPEN key set accepts — grounded firsthand: quarto renders it **exit 0**. Unquoting yields
    // `toc `, which matches no schema field, so we stay silent. Flagging it would be a
    // cardinal-sin false positive on a document quarto accepts.
    const text = ["---", '"toc ": banana', "---"].join("\n");
    expect(findFrontMatterValueLines(text).map((v) => v.key)).toEqual(["toc "]);
  });

  it("leaves the naive-colon split of a quoted key CONTAINING a colon unchanged (still silent)", () => {
    // `"a: b": banana` — `mappingColonAt` is not quote-aware inside the KEY region, so the split
    // lands at the colon INSIDE the quotes, yielding key `"a` (no matching pair → left intact)
    // and value `b": banana`. quarto renders this **exit 0** (the key `a: b` is unknown on the
    // open front-matter set), so silence is correct. Pre-existing behavior this change does not
    // alter — pinned so a future quote-aware colon scan has to consider the interaction.
    const text = ["---", '"a: b": banana', "---"].join("\n");
    expect(findFrontMatterValueLines(text).map((v) => v.key)).toEqual(['"a']);
  });
});
