import { describe, expect, it } from "vitest";
import { findCellOptionLines } from "../../src/core/qmd/model";

describe("findCellOptionLines — detection inside executable cells", () => {
  it("finds a single `#|` option line in a {python} cell", () => {
    const text = [
      "```{python}", // 0  opening fence
      "#| echo: false", // 1  option line
      "x = 1", // 2  code
      "```", // 3  closing fence
    ].join("\n");
    expect(findCellOptionLines(text)).toEqual([
      {
        line: 1,
        cellLang: "python",
        prefix: "#|",
        contentEndCol: 14,
        keySlot: { startCol: 3, endCol: 7 }, // "echo"
        valueSlot: { startCol: 9, endCol: 14 }, // "false"
      },
    ]);
  });

  it("detects the `//|` prefix in an {ojs} cell", () => {
    const text = ["```{ojs}", "//| echo: true", "x = 1", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([
      {
        line: 1,
        cellLang: "ojs",
        prefix: "//|",
        contentEndCol: 14,
        keySlot: { startCol: 4, endCol: 8 },
        valueSlot: { startCol: 10, endCol: 14 }, // "true"
      },
    ]);
  });

  it("reports an empty keySlot for a bare prefix line `#| ` (key not yet typed)", () => {
    const text = ["```{python}", "#| ", "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.keySlot).toEqual({ startCol: 3, endCol: 3 });
  });

  it("covers the whole partially-typed key (`#| ec`)", () => {
    const text = ["```{r}", "#| ec", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([
      {
        line: 1,
        cellLang: "r",
        prefix: "#|",
        contentEndCol: 5,
        keySlot: { startCol: 3, endCol: 5 },
        valueSlot: null, // no colon yet → no value slot
      },
    ]);
  });

  it("excludes trailing whitespace before the colon (`#| key : v`)", () => {
    const text = ["```{python}", "#| echo : false", "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.keySlot).toEqual({ startCol: 3, endCol: 7 }); // "echo", not "echo "
  });

  it("returns null keySlot for a block-sequence item line (`#|   - x`)", () => {
    const text = ["```{python}", "#| fig-cap:", "#|   - a", "```"].join("\n");
    const opts = findCellOptionLines(text);
    expect(opts).toHaveLength(2);
    expect(opts[0].keySlot).toEqual({ startCol: 3, endCol: 10 }); // "fig-cap"
    expect(opts[1].keySlot).toBeNull(); // the `- a` sequence item
  });

  it("finds multiple option lines and STOPS at interleaved code", () => {
    // This test used to assert [1, 2, 4], on the comment "not contiguous, but still a
    // #| line" — an assumption about quarto that was never grounded, and that is wrong.
    // Measured firsthand vs quarto 1.7.33 (`--no-execute`) on THIS EXACT document with
    // line 4 given an invalid value (`#| eval: banana`): it renders exit 0 — quarto never
    // reads line 4 at all. Move the same option up into the leading block and the same
    // document renders exit 1, `Field "eval" has value banana`. So line 4 is an ordinary
    // comment, and emitting it made value-diagnostics squiggle a document quarto ACCEPTS
    // (S160). The corrected expectation is the leading block only.
    const text = [
      "```{python}", // 0
      "#| echo: false", // 1
      "#| label: fig-a", // 2
      "import numpy", // 3 — code: ENDS the option block
      "#| eval: true", // 4 — below the block, so an ordinary comment
      "```", // 5
    ].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 2]);
  });
});

describe("findCellOptionLines — does NOT detect outside executable cells", () => {
  it("ignores a `#|`-shaped line in prose", () => {
    expect(findCellOptionLines("Some prose\n#| echo: false\nmore")).toEqual([]);
  });

  it("ignores a `#|` line in a non-executable ```python block (no braces)", () => {
    const text = ["```python", "#| echo: false", "x = 1", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([]);
  });

  // These embed a REAL ```{python} fence INSIDE the skip region: only the shared
  // scanner's front-matter / comment skipping stops it from opening a cell. If
  // that skipping regressed, findAllCells would open the cell and the `#|` line
  // would be detected — so these go RED, faithfully exercising the Learning #14
  // agreement (a fenceless fixture would pass for the trivial "no cell" reason).
  it("ignores a {python} cell nested in YAML front matter (skip-region agreement)", () => {
    const text = ["---", "```{python}", "#| echo: false", "```", "title: t", "---", "prose"].join("\n");
    expect(findCellOptionLines(text)).toEqual([]);
  });

  it("ignores a {python} cell nested in an HTML comment (skip-region agreement)", () => {
    const text = ["<!--", "```{python}", "#| echo: false", "```", "-->", "prose"].join("\n");
    expect(findCellOptionLines(text)).toEqual([]);
  });

  it("does not report the fence lines themselves", () => {
    const text = ["```{python}", "x = 1", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([]);
  });
});

describe("findCellOptionLines — value slot (6d-2)", () => {
  it("spans the value token after `key: ` (`#| echo: false`)", () => {
    const text = ["```{python}", "#| echo: false", "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.valueSlot).toEqual({ startCol: 9, endCol: 14 }); // "false"
  });

  it("reports an empty value slot after a colon + space (`#| echo: `)", () => {
    const text = ["```{python}", "#| echo: ", "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.valueSlot).toEqual({ startCol: 9, endCol: 9 });
  });

  it("reports an empty value slot right after the colon (`#| echo:`)", () => {
    const text = ["```{python}", "#| echo:", "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.valueSlot).toEqual({ startCol: 8, endCol: 8 });
  });

  it("is null when the line has no colon yet (`#| ec`)", () => {
    const text = ["```{r}", "#| ec", "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.valueSlot).toBeNull();
  });

  it("skips multiple spaces after the colon (`#| echo:   true`)", () => {
    const text = ["```{python}", "#| echo:   true", "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.valueSlot).toEqual({ startCol: 11, endCol: 15 }); // "true"
  });

  it("excludes trailing whitespace from the value span (`#| echo: false  `)", () => {
    const text = ["```{python}", "#| echo: false  ", "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.valueSlot).toEqual({ startCol: 9, endCol: 14 }); // "false", no trailing ws
  });

  it("is null for a block-sequence item line (`#|   - a`)", () => {
    const text = ["```{python}", "#| fig-cap:", "#|   - a", "```"].join("\n");
    const opts = findCellOptionLines(text);
    expect(opts[1].keySlot).toBeNull();
    expect(opts[1].valueSlot).toBeNull();
  });

  it("excludes a trailing YAML inline comment from the value span", () => {
    const text = ["```{python}", "#| echo: false  # turn off", "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.valueSlot).toEqual({ startCol: 9, endCol: 14 }); // "false", not the comment
  });

  it("treats a comment-only value as empty (`#| echo:  # x`)", () => {
    const text = ["```{python}", "#| echo:  # x", "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.valueSlot).toEqual({ startCol: 10, endCol: 10 }); // empty value before the comment
  });

  it("keeps a quoted value intact (does not split on a `#` inside quotes)", () => {
    const text = ["```{python}", '#| label: "a # b"', "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.valueSlot).toEqual({ startCol: 10, endCol: 17 }); // the whole "a # b" scalar
  });
});

describe("findCellOptionLines — Quarto-faithful prefix matching", () => {
  // Quarto's directive pattern is `^#\s*\| ?` (anchored at col 0; whitespace
  // allowed between the comment char and the pipe). Match it exactly.
  it("does NOT detect an INDENTED `#|` line (Quarto treats it as code)", () => {
    const text = ["```{python}", "  #| echo: false", "x = 1", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([]);
  });

  it("does NOT detect an indented `//|` line", () => {
    const text = ["```{ojs}", "  //| echo: true", "x = 1", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([]);
  });

  it("DETECTS `# |` with a space between the comment char and the pipe", () => {
    const text = ["```{r}", "# | echo: false", "x <- 1", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([
      {
        line: 1,
        cellLang: "r",
        prefix: "#|",
        contentEndCol: 15,
        keySlot: { startCol: 4, endCol: 8 },
        valueSlot: { startCol: 10, endCol: 15 }, // "false"
      },
    ]);
  });

  it("DETECTS `#  |` with extra space (and normalizes the prefix)", () => {
    const text = ["```{python}", "#  | echo: false", "```"].join("\n");
    const [opt] = findCellOptionLines(text);
    expect(opt.prefix).toBe("#|");
    expect(opt.keySlot).toEqual({ startCol: 5, endCol: 9 }); // "echo" after "#  | "
  });
});

describe("findCellOptionLines — multi-line QUOTED / flow values (adversarial review, S130)", () => {
  // Quarto folds every `#|` line of a cell into ONE YAML block, so a multi-line
  // quoted scalar's continuation `#|` line is INSIDE the value, not a new option.
  // Emitting it would let value-diagnostics flag e.g. `#| fig-height: wide"` (a
  // numeric cell option) on a doc quarto renders exit 0 — a cardinal-sin FP the
  // numeric slice made live for fig-width/fig-height/layout-ncol.
  it("does NOT emit a `#|` continuation line inside a multi-line DOUBLE-quoted value", () => {
    const text = [
      "```{r}",
      '#| fig-cap: "a caption that wraps',
      '#| fig-height: wide"',
      "1 + 1",
      "```",
    ].join("\n");
    // Only the fig-cap line (line 1) is a real option; line 2 is its continuation.
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1]);
  });

  it("resumes option detection on the `#|` line AFTER the closing quote", () => {
    const text = [
      "```{r}",
      '#| fig-cap: "a',
      '#| b"',
      "#| echo: false",
      "1 + 1",
      "```",
    ].join("\n");
    // fig-cap (1) opens, line 2 (`b"`) closes it, echo (3) is a real option again.
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 3]);
  });

  it("does NOT emit a `#|` continuation line inside a multi-line FLOW collection", () => {
    const text = [
      "```{r}",
      "#| fig-subcap: [one,",
      "#| fig-height: 3]",
      "1 + 1",
      "```",
    ].join("\n");
    // fig-subcap opens `[`; the `#| fig-height: 3]` line is its continuation.
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1]);
  });

  it("still emits a normal option after a single-line quoted value (no over-suppression)", () => {
    const text = ["```{r}", '#| fig-cap: "a short caption"', "#| fig-width: 3", "1 + 1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 2]);
  });
});

describe("findCellOptionLines — arming discipline parity: the phantom-quote FN (Defect A, S154)", () => {
  // The continuation guard arms only when a value ACTUALLY opens a multi-line quoted
  // scalar / flow collection — decided by the value token's FIRST character (past a
  // stripped node property), NOT by a scanFlow over the whole `key: value`. An inner
  // apostrophe / quote / bracket in a PLAIN scalar is literal YAML text and must not
  // arm a phantom quote that swallows the following real option — the mirror of the
  // fix S153 shipped for the two `.qmd` front-matter value enumerators (the third and
  // last site of the phantom-quote defect class; PROJECT_LEARNINGS #166). Grounded
  // firsthand vs quarto render 1.7.33: `#| fig-cap: Don't do this` renders exit 0, while
  // the swallowed `#| echo: banana` renders exit 1 ("must instead be `true` or `false`").
  it("does NOT let an inner APOSTROPHE in a plain value swallow the following option", () => {
    const text = ["```{python}", "#| fig-cap: Don't do this", "#| echo: banana", "1+1", "```"].join("\n");
    // Both are real options; the apostrophe in fig-cap is literal, not a quote opener.
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 2]);
  });

  it("does NOT let an inner DOUBLE-QUOTE in a plain value swallow the following option", () => {
    // The other half of the defect class: an inner `"` in a plain scalar is literal too.
    // Before the S154 fix the whole-token scan armed a phantom `"` and swallowed line 2.
    const text = ["```{python}", '#| fig-cap: he said "hi', "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 2]);
  });

  it("STILL arms a genuine SINGLE-quoted multi-line value (narrowing did not disable `'` openers)", () => {
    // Preserved behavior: a value that genuinely OPENS with `'` still folds its
    // continuation, so `#| b'` (line 2) is skipped and `#| echo` (line 3) resumes.
    const text = ["```{r}", "#| fig-cap: 'a", "#| b'", "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 3]);
  });

  it("STILL arms an ANCHORED flow opener — the node-property strip is load-bearing", () => {
    // `&a ` is stripped BEFORE the first-char test, so the `[` is seen as the opener and
    // the flow arms; without the strip the opener would be `&` and line 2 would leak.
    const text = ["```{r}", "#| fig-subcap: &a [one,", "#| fig-height: 3]", "#| echo: false", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 3]);
  });

  it("arms an anchored flow opener that ABUTS the bracket with NO space (`&a[one,`) — quarto folds it, exit 0", () => {
    // js-yaml/quarto accept an anchor abutting a flow bracket and fold the continuation
    // (fig-cap takes a list, so `#| fig-cap: &a[one,` / `#| echo: banana]` renders exit 0).
    // The strip's name charset excludes the flow indicators `,[]{}`, so it stops at — and sees
    // — the `[` opener; flagging the folded `#| echo: banana]` would be a cardinal-sin FP (S154).
    const text = ["```{python}", "#| fig-cap: &a[one,", "#| echo: banana]", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1]);
  });
});

describe("findCellOptionLines — anchor-name QUOTE strip parity (over-suppression correction, S156)", () => {
  // The node-property strip's name charset must exclude ONLY the YAML flow indicators
  // `,[]{}` (the chars an anchor / tag NAME may not contain). A quote is a LEGAL
  // anchor-name char and must be KEPT in the name, never treated as an opener. The S154
  // strip `[^\s[\]{}"']` over-excluded quotes, so a quote INSIDE an anchor name (`&a'b`)
  // stopped the strip early, leaving `'b` whose `'` armed a phantom single-quote that
  // swallowed the following real option — an over-suppression FALSE NEGATIVE. This is the
  // same correction S155 shipped on the three front-matter / project VALUE enumerators
  // (`[^\s[\]{}"']` → `[^\s,[\]{}]`; PROJECT_LEARNINGS #168). Grounded firsthand vs quarto
  // render 1.7.33: `#| myopt: &a'b` (an unknown / null-tolerant option) renders exit 0, so
  // the swallowed `#| echo: banana` (exit 1 — "must instead be `true` or `false`") is the
  // SOLE error — a genuine lost TRUE POSITIVE, not a safe FN.
  it("does NOT let an APOSTROPHE in an anchor NAME arm a phantom quote (`&a'b`)", () => {
    const text = ["```{python}", "#| myopt: &a'b", "#| echo: banana", "1+1", "```"].join("\n");
    // `&a'b` anchors a null value; `'` is a legal anchor-name char, so nothing is opened
    // and the real `#| echo: banana` (line 2) is a normal option again, not a continuation.
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 2]);
  });

  it("does NOT let a DOUBLE-QUOTE in an anchor NAME arm a phantom quote (`&a\"b`)", () => {
    const text = ["```{python}", '#| myopt: &a"b', "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 2]);
  });

  it("does NOT let a quote in a TAG NAME arm a phantom quote (`!t'x`)", () => {
    const text = ["```{python}", "#| myopt: !t'x", "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 2]);
  });

  it("STILL arms an anchor abutting a flow BRACE (`&a{one:`) — the flow indicators stay excluded", () => {
    // The correction narrows the name charset to exclude ONLY `,[]{}`, so an abutting `{` / `[`
    // (both flow indicators) is still SEEN as the opener and the continuation guard still arms.
    const text = ["```{python}", "#| fig-cap: &a{one:", "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1]);
  });
});

describe("findCellOptionLines — node-property-name quote on the CONTINUATION path (S157)", () => {
  // S156 corrected the SINGLE-LINE arm's node-property strip; the multi-line-continuation
  // path (the `scanFlow(m[4], …)` skip at the top of the loop) was a SIBLING code path with
  // the SAME defect, fixed here at the shared root: `scanFlow` treated a quote as a scalar
  // opener even inside a node-property NAME (`&a'b` / `*a'b` / `!t'x`), where the quote is a
  // legal char, not a delimiter. So an anchor-name quote in a CONTINUATION line of an
  // already-open flow armed a phantom quote that swallowed the following real option — a lost
  // TRUE POSITIVE. Grounded firsthand vs quarto render 1.7.33: `#| myopt: [` / `#| one, &a'b`
  // / `#| ]` (an unknown / null-tolerant key folding a list) renders exit 0, so the swallowed
  // `#| echo: banana` (exit 1 — "must instead be `true` or `false`") is the SOLE error — a
  // genuine lost TP. The same bug also reached the single-line arm's own `scanFlow` call when
  // the anchor sits MID-flow (`#| myopt: [one, &a'b]`), also grounded exit-1-sole-error.
  it("recovers the option swallowed by an anchor-name quote in a CONTINUATION line (`&a'b`)", () => {
    const text = ["```{python}", "#| myopt: [", "#| one, &a'b", "#| ]", "#| echo: banana", "1+1", "```"].join("\n");
    // myopt opens `[` (line 1); the continuation `#| one, &a'b` (line 2) carries an anchor whose
    // NAME contains a quote (legal, not an opener); `#| ]` (line 3) closes the flow; the real
    // `#| echo: banana` (line 4) is a normal option again — not swallowed by a phantom quote.
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 4]);
  });

  it("recovers the option after a DOUBLE-quote in a continuation-line anchor name (`&a\"b`)", () => {
    // The double-quote arm of the same class — pinned separately so a regression that re-admitted
    // ONLY `"` (not `'`) into scanFlow's node-property terminator charset cannot escape the suite
    // (every other scanFlow-path test uses `'` or a tag). Non-vacuous and a genuine lost TP:
    // grounded firsthand, pre-fix emits [1] and quarto renders `#| myopt: [` / `#| one, &a"b` /
    // `#| ]` exit 0, flagging only the swallowed `#| echo: banana` (exit 1) — same shape as `&a'b`.
    const text = ["```{python}", "#| myopt: [", '#| one, &a"b', "#| ]", "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 4]);
  });

  it("recovers the option when the anchor-name quote sits MID-flow on a SINGLE line (`[one, &a'b]`)", () => {
    // The same root-cause fix also reaches the single-line arm's own `scanFlow` call: a COMPLETE
    // flow `[one, &a'b]` used to leave a phantom open `'` (its `]` fell inside the phantom quote,
    // so depth never returned to 0), arming a continuation that swallowed line 2. quarto renders
    // `#| myopt: [one, &a'b]` exit 0 and flags only `#| echo: banana` (exit 1).
    const text = ["```{python}", "#| myopt: [one, &a'b]", "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 2]);
  });

  it("recovers the option after an ALIAS-name quote in a continuation line (`*a'b`)", () => {
    // Aliases are node properties too; `*a'b` in a continuation line no longer arms a phantom
    // quote. (A DEFINED alias folds and renders; an UNDEFINED one self-errors — either way the
    // scanner must not over-suppress the following option.)
    const text = ["```{python}", "#| myopt: [", "#| one, *a'b", "#| ]", "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 4]);
  });

  it("does NOT let a quote in a TAG name (`!t'x`) in a continuation line arm a phantom quote", () => {
    // Pins the `!` (tag) arm of scanFlow's node-property skip. This DISCRIMINATES the fix — pre-fix
    // scanFlow read the `'` in the tag name as a scalar opener and swallowed line 4 (emitted [1]);
    // post-fix emits [1, 4]. NB this is a scanner-CONSISTENCY pin, not a live-lost-TP recovery like
    // `&`/`*`: quarto 1.7.33 rejects a quote-in-tag-name (`unknown tag`, exit 1 on the tag line)
    // before it would flag the following option, so no quarto-accepted TP is at stake here — but the
    // scanner must still treat all three node-property introducers (`&`/`*`/`!`) identically.
    const text = ["```{python}", "#| myopt: [", "#| one, !t'x", "#| ]", "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 4]);
  });

  it("does NOT over-suppress: a genuine multi-line DOUBLE-quoted scalar containing a `[` still folds its continuation", () => {
    // The load-bearing guard: the node-property skip must not disable real quoted-scalar
    // continuation detection. `fig-cap: "a [b` opens a genuine double quote (with a literal `[`
    // inside it); line 2 `c] d"` closes it; `#| echo: banana` (line 3) resumes. Line 2 must stay
    // skipped — emitting it would be the cardinal-sin FP scanFlow exists to prevent.
    const text = ["```{python}", '#| fig-cap: "a [b', '#| c] d"', "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 3]);
  });
});

describe("findCellOptionLines — block-scalar (`|`/`>`) value folds its continuation (S158)", () => {
  // Quarto folds every `#|` line of a cell into ONE YAML block, so a value that OPENS a
  // YAML block scalar (`|` literal / `>` folded) consumes every following `#|` line more
  // indented than the opening key — that mapping-looking continuation is the block's literal
  // content, NOT a new option. `findCellOptionLines`'s continuation state (`scanFlow`) tracked
  // only quotes + `{}[]` flow depth, never `|`/`>`, so it emitted the folded continuation and
  // value-diagnostics flagged it — a cardinal-sin FALSE POSITIVE on a doc quarto renders exit 0.
  // Grounded firsthand vs quarto render --no-execute 1.7.33: `#| fig-cap: |` / `#|   echo: banana`
  // renders exit 0 (echo:banana is fig-cap's literal block content), while the bare `#| echo:
  // banana` renders exit 1 ("must instead be `true` or `false`"). The folded-indent quarto sees
  // is the post-pipe whitespace minus the one space its `^#\s*\| ?` directive strips, so a line
  // is block content iff its folded-indent EXCEEDS the opener's (strictly greater — a sibling at
  // the SAME indent renders exit 1, a real option).
  it("does NOT emit a mapping-looking `#|` line folded into a `|` literal block scalar", () => {
    const text = ["```{python}", "#| fig-cap: |", "#|   echo: banana", "1+1", "```"].join("\n");
    // fig-cap opens a literal block (line 1); `#|   echo: banana` (line 2, indent 2 > 0) is its
    // folded content, not a real option — emitting it flags a doc quarto accepts (exit 0).
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1]);
  });

  it("does NOT emit a `#|` line folded into a `>` FOLDED block scalar", () => {
    // The `>` (folded) indicator folds its more-indented continuation the same way; grounded
    // firsthand exit 0. Pins the `>` branch of BLOCK_SCALAR_HEADER (pre-fix emitted [1, 2]).
    const text = ["```{python}", "#| fig-cap: >", "#|   echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1]);
  });

  it("folds a block scalar with a chomping/indent indicator (`|-`)", () => {
    // A header may carry a chomping (`+`/`-`) and/or indentation (`1`–`9`) indicator; `|-` is
    // still a block-scalar opener (grounded firsthand exit 0). Pins the indicator alternation.
    const text = ["```{python}", "#| fig-cap: |-", "#|   echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1]);
  });

  it("folds a block scalar whose header carries a trailing comment (`| # a caption`)", () => {
    // A `#` comment may follow the indicators on the header line; the continuation still folds
    // (grounded firsthand exit 0). Pins the optional-comment tail of BLOCK_SCALAR_HEADER.
    const text = ["```{python}", "#| fig-cap: | # a caption", "#|   echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1]);
  });

  it("STILL arms an ANCHORED block scalar (`&a |`) — the node-property strip is load-bearing", () => {
    // `&a ` is stripped BEFORE the header test, so `|` is seen as the opener and the block arms;
    // quarto folds the anchored block the same way (grounded firsthand exit 0).
    const text = ["```{python}", "#| fig-cap: &a |", "#|   echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1]);
  });

  it("does NOT over-suppress: a real sibling option DEDENTED back to the key indent still emits", () => {
    // The load-bearing termination guard: the block ends at the first non-blank `#|` line at or
    // BELOW the opener's folded-indent. Here `#|   line one` (indent 2) is block content but
    // `#| echo: banana` (indent 0) is a real sibling option — quarto renders it exit 1 ("must
    // instead be `true` or `false`"), so it MUST still be emitted and flagged (grounded firsthand).
    // Over-suppressing it would turn the FP fix into a lost TRUE POSITIVE.
    const text = ["```{python}", "#| fig-cap: |", "#|   line one", "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 3]);
  });

  it("keeps a BLANK `#|` line inside the block scalar (blank lines are block content)", () => {
    // A blank `#|` line is always part of an open block scalar, so it does NOT end the block; the
    // following more-indented `#| echo: banana` stays folded (grounded firsthand exit 0).
    const text = ["```{python}", "#| fig-cap: |", "#|   line one", "#|", "#|   echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1]);
  });

  it("does NOT arm a plain value that merely CONTAINS a pipe (`a | b`) — an over-broad header regex would over-suppress", () => {
    // A `|` is a block-scalar indicator only at the START of a value; `fig-cap: a | b` is a plain
    // scalar, so it must NOT arm a block-scalar skip. The follow-on `#| echo: false` is INDENTED
    // (folded-indent 2) so it DISCRIMINATES the arm: with the correctly-anchored header regex the
    // plain value does not arm and BOTH lines emit ([1, 2]); an over-broad regex that matched
    // `a | b` would arm a block scalar and SUPPRESS line 2 ([1]). Verified firsthand RED against an
    // over-arming mutant (`BLOCK_SCALAR_HEADER = /\|/`): it emits [1] (§9 test-quality lens, S158).
    // (This shape is malformed YAML — a more-indented mapping under a PLAIN scalar renders quarto
    // exit 1, YAMLException; a SAME-indent sibling would emit regardless of arm state and so cannot
    // discriminate — hence the indented follow-on. The pin guards the enumerator's arm invariant,
    // not a quarto-exit-0 fold.)
    const text = ["```{python}", "#| fig-cap: a | b", "#|   echo: false", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 2]);
  });
});

describe("findCellOptionLines — quarto honors only the cell's LEADING option block (S160)", () => {
  it("does NOT emit a `#|` line that follows CODE", () => {
    // Quarto reads a cell's `#|` directives ONLY from the leading contiguous run of
    // directive lines and stops at the first body line that is not one; a `#|` after
    // code is an ordinary comment. Grounded firsthand vs quarto 1.7.33: this document
    // renders exit 0, yet we emitted the line and value-diagnostics squiggled it — a
    // cardinal-sin FALSE POSITIVE on a document quarto ACCEPTS.
    const text = ["```{python}", "1+1", "#| echo: banana", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([]);
  });

  it("does NOT emit a `#|` line below a BLANK line", () => {
    // A blank line is not a directive line, so it ends the block: quarto renders this
    // exit 0 (grounded firsthand). Note the option ABOVE the blank IS still honored —
    // quarto reports its value errors (exit 1) — so this pins the boundary, not a
    // wholesale suppression.
    const text = ["```{python}", "#| label: cell-a", "", "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1]);
  });

  it("does NOT emit a `#|` line below a WHITESPACE-ONLY line", () => {
    // Same terminator class as the blank line, and the same firsthand exit 0 — the test
    // is `CELL_OPTION_PREFIX` matching, so a line of spaces is as much a terminator as
    // code. Distinct from the blank-line pin because a `trim()`-based terminator test
    // would treat the two differently.
    const text = ["```{python}", "#| label: cell-a", "   ", "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1]);
  });

  it("does NOT emit a `#|` line below a plain `#` comment", () => {
    // A plain comment is not a directive line either (quarto's directive needs the pipe),
    // so it ends the block — grounded firsthand exit 0 both as the cell's FIRST line and
    // mid-block. This is the most realistic FP shape of the set: a `#|` option left below
    // an explanatory comment.
    const text = ["```{python}", "#| label: cell-a", "# a plain comment", "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1]);
  });

  it("emits NOTHING when a blank line precedes the cell's first `#|` line", () => {
    // The block starts at body line 0. A leading blank means it never opens at all, so
    // every following `#|` line is an ordinary comment — quarto renders this exit 0.
    const text = ["```{python}", "", "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([]);
  });

  it("ends the block PER CELL — every cell gets its own leading block and its own terminator", () => {
    // The terminator must not leak across cells, and must apply to EVERY cell rather than
    // only the first. Cell one's post-code option is dropped and cell two's LEADING option
    // is still emitted — but cell two ALSO carries a post-code option, which is what makes
    // this pin discriminate: a mutant that terminates only while scanning the first cell
    // yields [6, 8] here, and the simpler two-cell shape (without line 8) could not tell
    // the two apart. Grounded firsthand as one document: quarto reports ONLY the `eval`
    // error, exit 1 — neither line 2 nor line 8.
    const text = [
      "```{python}", // 0
      "1+1", // 1 — code ends cell one's block (which never opened)
      "#| echo: banana", // 2 — ordinary comment
      "```", // 3
      "", // 4
      "```{python}", // 5
      "#| eval: banana", // 6 — cell two's LEADING block: a real option
      "2+2", // 7 — code ends cell two's block too
      "#| warning: banana", // 8 — ordinary comment, in the SECOND cell
      "```", // 9
    ].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([6]);
  });

  it("applies to the `//|` (ojs) comment-char family too", () => {
    // Grounded firsthand on the `//` family independently: `//|` after code renders exit 0,
    // and a `//|` block interrupted by a blank line renders exit 0 for the option below it.
    const text = ["```{ojs}", "1+1", "//| echo: banana", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([]);
  });

  // ── The OVER-SUPPRESSION direction ──────────────────────────────────────────────
  // These four shapes LOOK like block terminators but are not: quarto still reports the
  // value errors of the block they sit in (exit 1, grounded firsthand). They are the
  // pins that stop this fix becoming a lost TRUE POSITIVE, and each is RED against a
  // plausible over-eager terminator, not merely against the pre-fix source (Learning
  // #171c — a pin that passes pre-fix AND survives every mutant is vacuous).

  it("a BARE `#|` line does NOT end the block", () => {
    // Grounded firsthand: `#| label: cell-a` / `#|` / `#| echo: banana` renders exit 1 on
    // echo, so the bare line is part of the block. RED against the plausible mutant
    // `if (m === null || m[4].trim() === "") break;` — which yields [1].
    const text = ["```{python}", "#| label: cell-a", "#|", "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 2, 3]);
  });

  it("a `#| ` line with EMPTY content does NOT end the block", () => {
    // The trailing-space spelling of the same shape, likewise exit 1 firsthand. Kept
    // distinct from the bare pin because the gap lands in `m[3]` rather than being absent,
    // so a terminator keyed on the gap would separate them.
    const text = ["```{python}", "#| ", "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 2]);
  });

  it("a GAPLESS `#|key: value` line does NOT end the block", () => {
    // Quarto accepts a directive with no space after the pipe: `#|label: cell-a` /
    // `#| echo: banana` renders exit 1 on echo (grounded firsthand). RED against a mutant
    // that required the ` ` gap to continue the block — which would yield [2].
    const text = ["```{python}", "#|label: cell-a", "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 2]);
  });

  it("a SPACED `# | key: value` line does NOT end the block", () => {
    // Quarto's directive pattern allows whitespace between the comment char and the pipe
    // (`^#\s*\| ?`): `# | label: cell-a` / `#| echo: banana` renders exit 1 on echo, and
    // `# | echo: banana` alone as the first body line renders exit 1 too (both grounded
    // firsthand). So this line is an option, not a plain comment that terminates.
    const text = ["```{python}", "# | label: cell-a", "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1, 2]);
  });
});

describe("findCellOptionLines — the block TERMINATOR is quarto's directive pattern, not our stricter one (S160 §9)", () => {
  // Quarto's own predicate is `^<comment>\s*\| ?` — a PREFIX test using `\s` (ALL
  // whitespace) with no end anchor. Our `CELL_OPTION_PREFIX` is deliberately stricter: its
  // gap is `[ \t]` and it ends `(.*)$`, where `.` excludes U+2028/U+2029. That strictness
  // was harmless while it only decided whether ONE line was emitted — an unparseable
  // directive line was silently skipped and everything below it still validated. The S160
  // `break` promoted the same regex to deciding how LONG the block is, which turned that
  // one-line false negative into a whole-cell LOST TRUE POSITIVE. Found by this session's
  // own §9 review, against this session's own change, and adjudicated firsthand.
  //
  // Every shape below renders quarto exit 1 with a real `Field "echo" has value banana`
  // VALUE error, and every one WAS emitted by the pre-S160 enumerator — so shipping the
  // strict terminator would have been a regression, not merely an unfixed gap.
  // Termination now tests the permissive directive pattern; EMISSION still requires the
  // strict one, so an unparseable directive line is skipped rather than ending the block.

  const NBSP = "\u00A0"; // matched by `\s`, NOT by `[ \t]`
  const VTAB = "\u000B"; // ditto
  const LSEP = "\u2028"; // matched by `\s`; also excluded by `.`

  it("a NON-BREAKING SPACE in the gap does not end the block", () => {
    const text = ["```{python}", `#${NBSP}| label: cell-a`, "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([2]);
  });

  it("a VERTICAL TAB in the gap does not end the block", () => {
    const text = ["```{python}", `#${VTAB}| label: cell-a`, "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([2]);
  });

  it("a U+2028 LINE SEPARATOR inside a directive's value does not end the block", () => {
    // `(.*)$` cannot match this line at all — `.` excludes U+2028 — so the strict regex
    // rejects it even though quarto reads it as part of the cell's YAML block.
    const text = ["```{python}", `#| fig-cap: a${LSEP}b`, "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([2]);
  });

  it("STILL ends the block on a line that is not a directive at all", () => {
    // The control: relaxing the terminator must not stop real terminators terminating.
    // `#x| oops` has no whitespace-only gap between `#` and `|`, so it is not a directive
    // under EITHER pattern — quarto renders the option below it exit 0, and it must stay
    // unflagged. Without this, the fix above could be satisfied by never terminating.
    const text = ["```{python}", "#| label: cell-a", "#x| oops", "#| echo: banana", "1+1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1]);
  });
});

describe("findCellOptionLines — the comment char is scoped to the cell LANGUAGE (S161)", () => {
  // Quarto builds its cell-option directive pattern per LANGUAGE from its own
  // `kLangCommentChars` table (`^<comment>\s*\| ?`), not from a fixed `#`/`//` pair.
  // Grounded firsthand vs quarto 1.7.33 (`--no-execute`): `{sql}` + `--| echo: banana`
  // renders exit 1 with `Field "echo" has value banana` (this was a LOST TRUE POSITIVE
  // — we emitted nothing), while `{sql}` + `#| echo: banana` renders exit 0 (a
  // cardinal-sin FALSE POSITIVE — we emitted and value-diagnostics squiggled it).
  it("emits a `--|` option line in a {sql} cell", () => {
    const text = ["```{sql}", "--| echo: banana", "SELECT 1", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([
      {
        line: 1,
        cellLang: "sql",
        prefix: "--|",
        contentEndCol: 16,
        keySlot: { startCol: 4, endCol: 8 }, // "echo"
        valueSlot: { startCol: 10, endCol: 16 }, // "banana"
      },
    ]);
  });

  // The remaining openers in quarto's table. Each renders quarto exit 1 with a real
  // `Field "echo" has value banana` and emitted NOTHING before this fix.
  it("emits a `%|` option line in a {matlab} cell", () => {
    const text = ["```{matlab}", "%| echo: banana", "1", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([
      { line: 1, cellLang: "matlab", prefix: "%|", contentEndCol: 15,
        keySlot: { startCol: 3, endCol: 7 }, valueSlot: { startCol: 9, endCol: 15 } },
    ]);
  });

  it("emits a `!|` option line in a {fortran} cell", () => {
    const text = ["```{fortran}", "!| echo: banana", "1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => [o.line, o.prefix])).toEqual([[1, "!|"]]);
  });

  it("emits a `⍝|` option line in an {apl} cell (a non-ASCII opener)", () => {
    const text = ["```{apl}", "⍝| echo: banana", "1", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([
      { line: 1, cellLang: "apl", prefix: "⍝|", contentEndCol: 15,
        keySlot: { startCol: 3, endCol: 7 }, valueSlot: { startCol: 9, endCol: 15 } },
    ]);
  });

  it("emits a `*|` option line in a {stata} cell — a single-element `*` with NO suffix", () => {
    const text = ["```{stata}", "*| echo: banana", "1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => [o.line, o.prefix])).toEqual([[1, "*|"]]);
  });

  // BLOCK-comment languages carry a second delimiter (`commentChars[1]`). Quarto requires
  // the line to `trimEnd().endsWith(suffix)` and strips it from the YAML content.
  it("emits a suffixed `/*| … */` option line in a {c} cell, with the suffix OUTSIDE the slots", () => {
    const text = ["```{c}", "/*| echo: banana */", "1;", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([
      { line: 1, cellLang: "c", prefix: "/*|", contentEndCol: 16,
        keySlot: { startCol: 4, endCol: 8 }, // "echo"
        valueSlot: { startCol: 10, endCol: 16 } }, // "banana", NOT "banana */"
    ]);
  });

  it("emits a suffixed `*| …;` option line in a {sas} cell (`;` is sas's closer)", () => {
    const text = ["```{sas}", "*| echo: banana;", "1;", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([
      { line: 1, cellLang: "sas", prefix: "*|", contentEndCol: 15,
        keySlot: { startCol: 3, endCol: 7 }, valueSlot: { startCol: 9, endCol: 15 } },
    ]);
  });

  it("emits a suffixed `(*| … *)` option line in an {ocaml} cell (a PAREN opener)", () => {
    // `(*` is the only opener in the table containing a regex GROUPING metacharacter, so this
    // is the pin that makes `escapeRegExp` load-bearing: drop `(` and `)` from its char class
    // and the generated pattern becomes a capture group, which shifts every group index and
    // throws on the unbalanced `*)`. Nothing else in the suite reaches that (§9 review, S161).
    // Grounded firsthand: this document renders quarto exit 1, `Field "echo" has value banana`.
    const text = ["```{ocaml}", "(*| echo: banana *)", "1", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([
      { line: 1, cellLang: "ocaml", prefix: "(*|", contentEndCol: 16,
        keySlot: { startCol: 4, endCol: 8 }, valueSlot: { startCol: 10, endCol: 16 } },
    ]);
  });

  it("trims whitespace AFTER the closer before testing for it, as quarto does", () => {
    const text = ["```{c}", "/*| echo: banana */   ", "1;", "```"].join("\n");
    expect(findCellOptionLines(text)[0].valueSlot).toEqual({ startCol: 10, endCol: 16 });
  });

  it("does NOT emit a block-comment directive that is missing its closer", () => {
    // Grounded firsthand: `{c}` + `/*| echo: banana` (unclosed) renders quarto exit 0 —
    // quarto reads no directive there at all, so flagging it would be the cardinal sin.
    const text = ["```{c}", "/*| echo: banana", "1;", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([]);
  });

  it("an UNCLOSED block-comment line ENDS the option block, like any non-directive", () => {
    // Grounded firsthand: quarto renders this exit 0 — the unclosed middle line terminates
    // its leading block, so the invalid option BELOW it is never read (S160's rule, reached
    // here through the suffix half of the directive predicate).
    const text = [
      "```{c}",
      "/*| eval: false */", // 1  a real directive
      "/*| output: true", // 2  no closer -> NOT a directive -> ends the block
      "/*| echo: banana */", // 3  below the block: an ordinary comment to quarto
      "1;",
      "```",
    ].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1]);
  });

  // The FALSE-POSITIVE direction: our two previously hard-coded chars, in cells where
  // quarto reads no directive at all. Every one of these renders quarto exit 0.
  it("does NOT emit `#|` in a {sql} cell (the cardinal-sin FP)", () => {
    const text = ["```{sql}", "#| echo: banana", "SELECT 1", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([]);
  });

  it("does NOT emit `//|` in a {python} cell", () => {
    const text = ["```{python}", "//| echo: banana", "x = 1", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([]);
  });

  it("does NOT emit `#|` in an {ojs} cell", () => {
    const text = ["```{ojs}", "#| echo: banana", "x = 1", "```"].join("\n");
    expect(findCellOptionLines(text)).toEqual([]);
  });

  it("does NOT emit `#|` or `//|` in a {c} cell", () => {
    const hash = ["```{c}", "#| echo: banana", "1;", "```"].join("\n");
    const slash = ["```{c}", "//| echo: banana", "1;", "```"].join("\n");
    expect(findCellOptionLines(hash)).toEqual([]);
    expect(findCellOptionLines(slash)).toEqual([]);
  });

  // A wrong-comment-char line is not a directive, so it TERMINATES quarto's leading block
  // (S160) — the same root cause one step more visible. Both grounded firsthand at exit 0.
  it("a wrong-char `#|` line mid-block ENDS a {sql} cell's option block", () => {
    const text = [
      "```{sql}",
      "--| eval: false", // 1  a real directive
      "#| echo: false", // 2  not a directive in {sql} -> ends the block
      "--| echo: banana", // 3  below the block -> an ordinary comment to quarto
      "SELECT 1",
      "```",
    ].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1]);
  });

  it("a wrong-char `//|` line mid-block ENDS a {python} cell's option block", () => {
    const text = [
      "```{python}",
      "#| eval: false", // 1
      "//| echo: false", // 2  not a directive in {python} -> ends the block
      "#| echo: banana", // 3  below the block
      "x = 1",
      "```",
    ].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1]);
  });

  // Quarto does NOT lowercase the fence token before the table lookup, so a capitalized
  // language is simply UNKNOWN and takes the `#` default. Both directions grounded firsthand.
  it("the language lookup is CASE-SENSITIVE — {SQL} takes the `#` default, not `--`", () => {
    const dashes = ["```{SQL}", "--| echo: banana", "SELECT 1", "```"].join("\n");
    const hash = ["```{SQL}", "#| echo: banana", "SELECT 1", "```"].join("\n");
    expect(findCellOptionLines(dashes)).toEqual([]); // quarto exit 0
    expect(findCellOptionLines(hash).map((o) => o.line)).toEqual([1]); // quarto exit 1
  });

  it("an UNKNOWN language falls back to `#`, and only `#`", () => {
    const hash = ["```{banana}", "#| echo: banana", "1", "```"].join("\n");
    const slash = ["```{banana}", "//| echo: banana", "1", "```"].join("\n");
    expect(findCellOptionLines(hash).map((o) => o.line)).toEqual([1]); // quarto exit 1
    expect(findCellOptionLines(slash)).toEqual([]); // quarto exit 0
  });

  it("reports where the YAML content ENDS, so a consumer can clamp the closer off", () => {
    // `keySlot`/`valueSlot` are already computed from the suffix-stripped content, but a
    // consumer that re-derives spans from the RAW line text (value-diagnostics does, to
    // find the real YAML separator — S159) cannot see the closer and would slice
    // `banana */` as the value. Worse, it would then flag `/*| echo: false */` — a document
    // quarto renders exit 0 — because `false */` is not in echo's closed value set.
    // `contentEndCol` is that bound. For a line-comment language it is the end of the
    // remainder, so clamping to it is a no-op.
    const c = ["```{c}", "/*| echo: banana */", "1;", "```"].join("\n");
    expect(findCellOptionLines(c)[0].contentEndCol).toBe(16); // just past "banana"
    const spaced = ["```{c}", "/*| echo:  banana  */", "1;", "```"].join("\n");
    expect(findCellOptionLines(spaced)[0].contentEndCol).toBe(17); // just past "banana"
    const py = ["```{python}", "#| echo: banana", "x = 1", "```"].join("\n");
    expect(findCellOptionLines(py)[0].contentEndCol).toBe(15); // the whole line
    const trailing = ["```{python}", "#| echo: banana   ", "x = 1", "```"].join("\n");
    expect(findCellOptionLines(trailing)[0].contentEndCol).toBe(18); // trailing ws included
  });

  it("resolves the table by OWN properties only — `{constructor}` is not a language", () => {
    // `lang` is user input straight out of the fence; a bare index would walk the prototype
    // chain and hand `commentCharsFor` a function instead of a table entry.
    const text = ["```{constructor}", "#| echo: banana", "1", "```"].join("\n");
    expect(findCellOptionLines(text).map((o) => o.line)).toEqual([1]);
  });
});

describe("findCellOptionLines — a cell-HANDLER language still EMITS; only validation narrows (S162)", () => {
  it("still reports the option lines of a `{dot}` cell", () => {
    // S162 stops value-diagnostics from FLAGGING options in a `{dot}`/`{mermaid}` cell,
    // because quarto validates a handler cell against `handlers/<lang>/schema.yml` — for
    // `dot`, a resource that does not exist — and so renders any option value there exit 0.
    // That narrowing belongs to the DIAGNOSTICS path alone (`cellOptionScopeFor` →
    // `"none"`, `yaml-context.ts`). This enumerator is shared with the outline, embedded
    // virtual documents, cell-background highlighting and the cross-reference index, none
    // of which care which schema validates the cell — a `//| label: fig-g` in a `{dot}`
    // cell is still a real label quarto resolves `@fig-g` against. Suppressing here instead
    // would be the plausible-looking fix that silently breaks all four.
    const text = [
      "```{dot}",
      "//| label: fig-g",
      "//| echo: banana",
      "digraph {a->b}",
      "```",
    ].join("\n");
    const lines = findCellOptionLines(text);
    expect(lines.map((o) => o.line)).toEqual([1, 2]);
    expect(lines.map((o) => o.cellLang)).toEqual(["dot", "dot"]);
  });
});
