import { mkdirSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { findHeadings } from "../../src/core/qmd/model";

// Session 298 — STACKED BLOCK ENDERS in the free case (row (3)(a) of the Kernel-cell backlog item).
//
// Session 295 taught the free case (an indented `{bash}` opener below a line that ENDS A BLOCK is indented code, not a cell) a list of enders: a thematic break, a link-reference
// definition, an indented code line, a whole-line comment, a table, a line block, a closing HTML tag. Each ender counted only where it BEGAN AT A BLOCK BOUNDARY (a blank line, a
// heading, a fence line) or extended a run of its own kind. A second ender stacked DIRECTLY under a first one began at no boundary, so it was refused: 204 of the 450 documents of
// Session 295's `stk` grid (every ordered pair of 15 constructs, `scratchpad/s295/stk`) were still deleted, where pandoc is between blocks after the first ender and so after the second.
//
// Every document below is built EXACTLY as `scratchpad/s298/gen_wide.cjs` and `scratchpad/s295/gen_stack.cjs` build it (front matter with a `title:` and `engine: markdown`, `## Before`,
// a blank line, `Prose before.`, a blank line, the stack, an indent-4 `{bash}` opener DIRECTLY below it, `## In` inside, the closer, `## After`) and was rendered with quarto 1.7.33 in ne
// mode (exit 0). quarto lists `In` exactly where pandoc is between blocks at the opener.
describe("Session 298 — stacked block enders in the free case", () => {
  const doc = (...lines: string[]) => lines.join("\n") + "\n";
  const texts = (text: string, engine?: "jupyter" | "markdown" | "knitr" | "julia" | "ambiguous") => findHeadings(text, engine).map((h) => h.text);
  type Eng = "jupyter" | "markdown";
  const FRONT: Record<Eng, string[]> = {
    jupyter: ["---", 'title: "T"', "---", "", "```{python}", "1 + 1", "```", ""],
    markdown: ["---", 'title: "T"', "engine: markdown", "---", ""],
  };
  // The stack sits after a blank line + prose (`blank`), directly under the `## Before` heading (`heading`) or directly under a prose line (`paragraph`).
  type Ctx = "blank" | "heading" | "paragraph";
  const probe = (eng: Eng, ctx: Ctx, x: string[], open = "    ", from: string | null = null, after: string[] = []): string =>
    doc(
      ...(from === null ? FRONT[eng] : ["---", 'title: "T"', "engine: markdown", `from: ${from}`, "---", ""]),
      "## Before",
      ...(ctx === "blank" ? ["", "Prose before.", ""] : ctx === "paragraph" ? ["", "Para above."] : []),
      ...x,
      `${open}\`\`\`{bash}`,
      "## In",
      "x = 1",
      ...after,
      `${open}\`\`\``,
      "",
      "## After",
      "",
      "tail",
    );
  // EMIT_ROWS=<dir> writes every row's document and its claimed headings there INSTEAD OF asserting, so the claims can be rendered and compared with quarto
  // (`scratchpad/s298/render.sh` then `check_rows.cjs`; Learning #650: a row's claim is quarto's answer by construction, not mine).
  const EMIT = process.env.EMIT_ROWS;
  const emitted: Record<string, string[]> = {};
  const claim = (text: string, eng: Eng, expected: string[], label: string): void => {
    if (EMIT) {
      mkdirSync(EMIT, { recursive: true });
      const name = `r${String(Object.keys(emitted).length + 1).padStart(4, "0")}_${eng}`;
      writeFileSync(path.join(EMIT, `${name}.qmd`), text);
      emitted[name] = expected;
      writeFileSync(path.join(EMIT, "expect.json"), JSON.stringify(emitted));
      return;
    }
    expect(texts(text, eng), label).toEqual(expected);
  };
  const LISTED = ["Before", "In", "After"]; // the opener is indented CODE: quarto lists the heading inside it
  const SWALLOWED = ["Before", "After"]; //   the opener is paragraph text or a raw continuation: quarto swallows it

  // SLICE 35. MUTATION KILLERS AND ONE FIX. 191 single-term mutants of slices 28-34: 124 died to the suite, 67 survived. `mutdiff` scored the survivors against 7,188 rendered documents (`scratchpad/s298`): 24 are OBSERVABLE (a
  // rendered document tells the mutant from the real build, so each got a row below from its shortest killers), 6 more got a witness from a generator re-run against each mutant with the oracle as judge
  // (rendered, `scratchpad/s298/mw5`), and 37 are UNOBSERVABLE (size caps, perf prechecks, guards that a caller already gives, terms another term subsumes) and stay as fail-safes. These rows pass on arrival, as
  // mutation killers do; ONE did not: P07, the rule that took an indented HTML line for a table's header row, was `net harmful` (its removal fixed `review3/contexts/r3_031` and broke nothing): an indented tag that is a LINE
  // BLOCK's continuation line begins no block, so it is no header row, and the dash column under it is a break (`| two` / `  </div>` / `- - -`: quarto lists `In`).
  it("RED->GREEN: `| two` / `  </div>` / `- - -` directly under the heading: the indented closing tag is a line block's continuation, and the opener below the break is indented code", () => {
    claim(probe("markdown", "heading", ["| two", "  </div>", "- - -"]), "markdown", LISTED, "markdown, heading context");
  });
  it.each<[string, "blank" | "heading" | "paragraph", string[], string | null, string[]]>([
    ["H02: an indented one-line button and a comment", "blank", [" <button>x</button>", "<!-- c -->"], null, SWALLOWED],
    ["H02: an indented closing script tag and a break", "blank", ["  </script>", "***"], null, SWALLOWED],
    ["H02: an indented lone div under -raw_html and a break", "blank", ["  <div>", "***"], "markdown-raw_html", SWALLOWED],
    ["H08: an open simple table and a one-line div as its row", "blank", ["  a   b", "  --- ---", "  1   2", "<div>x</div>"], null, SWALLOWED],
    ["H08: an open simple table and a closing div as its row", "blank", ["  a   b", "  --- ---", "  1   2", "</div>"], null, SWALLOWED],
    ["H08: a headed simple table and a closing div as its row", "blank", ["h1  h2", "--- ---", "a   b", "</div>"], null, SWALLOWED],
    ["T07: a line block, a dash column and a tab code line", "blank", ["| line one", "| line two", "- - -", "\ttab code line"], null, LISTED],
    ["D01/D03/R02: a closed simple table and a comment", "blank", ["  a   b", "  --- ---", "  1   2", "  --- ---", "<!-- c -->"], null, LISTED],
    ["D01/D03/R02: a closed simple table and a multi-line comment", "blank", ["  a   b", "  --- ---", "  1   2", "  --- ---", "<!--", "note", "-->"], null, LISTED],
    ["A09: a line block's first line and its equals underline", "blank", ["| one", "==="], null, ["Before", "| one", "In", "After"]],
    ["W13/A01: an ATX line under prose without blank_before_header", "blank", ["### Delta Four"], "markdown-blank_before_header", ["Before", "Delta Four", "In", "After"]],
    ["A12: a closed pre element and a dash run", "blank", ["<pre>", "x", "</pre>", "---"], null, LISTED],
    ["A12: a closing div under a prose line and a dash run", "paragraph", ["</div>", "---"], null, LISTED],
    ["S08: a closed fence and an empty ATX line", "blank", ["```", "x", "```", "##"], null, LISTED],
    ["S08: a multi-line comment and an empty ATX line", "blank", ["<!--", "note", "-->", "##"], null, LISTED],
    ["S08: a closed pre element and an empty ATX line", "blank", ["<pre>", "x", "</pre>", "##"], null, LISTED],
    ["S08: a multi-line comment and an ATX line under the heading", "heading", ["<!--", "note", "-->", "## Mid"], null, ["Before", "Mid", "In", "After"]],
    ["T02/T03: a top rule under the heading's text is its setext underline, then a blank-ended table and an indented dash run", "heading", ["----------", "Hdr  Hd2", "---  ---", "a    b", "", "----------", " ---"], null, ["## Before", "After"]],
    ["Q06: a lone grid border and a comment", "blank", ["+---+---+", "<!-- c -->"], null, SWALLOWED],
    ["C11: a pipe table without a body, a dash column and a setext heading", "blank", ["| a | b |", "|---|---|", "- - -", "Title", "====="], null, ["Before", "Title", "In", "After"]],
    ["K03c: a spaced star break, an empty comment and a dash run under a prose line", "paragraph", ["* * * ", "<!---->", "---"], null, SWALLOWED],
    ["S09: a star run and a dash run under a prose line, a multi-line comment", "paragraph", ["*****", "---", "<!--", "note", "-->"], null, SWALLOWED],
  ])("MUTATION KILLER: an indent-4 `{bash}` opener below %s", (_label, ctx, x, from, expected) => {
    claim(probe("markdown", ctx, x, "    ", from), "markdown", expected, `${from ?? "no from"}, ${ctx} context`);
  });

  // SLICE 33. THE ROUND-4 SWEEP OF THE ROUND-3b FIXES (the same generator re-run over 38,976 documents: 109 candidates, 83 of them one wrong underline rule, 22 distinct documents after it, every one rendered with quarto 1.7.33
  // in ne mode, exit 0, `scratchpad/s298/r4a`). Five causes, each the parent's accident exposed by an earlier slice:
  // (a) A `Table:` OR `:` LINE IS A CAPTION, NOT A HEADER ROW: the dash lines below it are paragraph text and nothing closes (`r4a_001`, `005`, `007`, `018`).
  // (b) THE PARENT'S `endsBlock(line above)` TOOK AN INDENTED DASH RUN OR A BARE `=` FOR AN UNDERLINE OR A BREAK: a dash run is a setext underline only at column 0 and only under ONE text line, so ` ---` under a table, `=` under a
  // table and a column-0 `---` under the third line of a paragraph are text. It held only while a list column the model opened by mistake swallowed the opener first (slice 30 closed it): the free case now asks the block
  // boundary answer alone (`r4a_009`, `011`, `015`, `017`, `020`).
  // (c) AN INDENTED LINE IS NO PROSE: `  cont` under `| one` is a line block's continuation, so the `Title` / `=====` below it is a heading (`r4a_014`: `In` is listed).
  // (d) A `=` RUN NEEDS A TEXT LINE ABOVE TO BE AN UNDERLINE: under a blank line or a break it is a paragraph, and a comment stacked under it is lazy text (`r4a_016`).
  // (e) A TOP RULE IS NOT AN UNDERLINE: `----------` directly under a text line is that line's setext underline, so the lines below are a headed SIMPLE table that a blank line ends (`r4a_022`: `In` is listed).
  it.each<[string, "blank" | "heading" | "paragraph", string[], string | null, string[]]>([
    ["(a) a table, a caption line and a headerless indented table", "blank", ["| a | b |", "|---|---|", "| 1 | 2 |", "", "Table: Cap", " - - -", "a b c", " - - -"], null, SWALLOWED],
    ["(a) a caption line and a headerless table indented one", "blank", ["Table: Cap", " - - -", "a b c", " - - -"], null, SWALLOWED],
    ["(a) a caption line and a headerless table indented three", "blank", ["Table: Cap", "   - - -", "a b c", "   - - -"], null, SWALLOWED],
    ["(a) a caption line and a headerless table with two-dash columns, then a comment", "blank", ["Table: Cap", "-- --", "a b", "-- --", "<!-- c -->"], null, SWALLOWED],
    ["(b) a headed table with an indented rule, a break under it and no simple tables", "blank", ["Col A  Col B", "   - - -", "a b", "   - - -", "---"], "markdown-simple_tables", SWALLOWED],
    ["(b) an invalid grid border, a table with an indented rule and an indented dash run", "blank", ["+===+===+", "| a | b |", "+===+===+", "Col A  Col B", "   - - -", "a b", " ---"], null, SWALLOWED],
    ["(b) an indented headerless table, a blank line and an indented dash pair", "heading", [" - - -", "a b c", " - - -", "", "   ---", "   ---"], null, SWALLOWED],
    ["(d) an equals sign under a blank line, a comment and a pipe table", "blank", ["=", "<!-- c -->", "| a | b |", "|---|---|", "| 1 | 2 |"], null, SWALLOWED],
    ["(e) a multiline table under a setext heading, its closing rule, a dash column and a multi-line comment, no grid tables", "paragraph", ["----------", "Hdr  Hd2", "---  ---", "a    b", "", "----------", "- - -", "<!--", "n", "-->", ""], "markdown-grid_tables", ["Before", "Para above.", "In", "After"]],
  ])("RED->GREEN: an indent-4 `{bash}` opener below %s", (_label, ctx, x, from, expected) => {
    claim(probe("markdown", ctx, x, "    ", from), "markdown", expected, `${from ?? "no from"}, ${ctx} context`);
  });

  // The same round-4 rows whose only other difference from quarto is a heading this model gets wrong ON ITS OWN (a pre-existing misread, in the parent too): they assert the one question these slices answer, whether `In` is
  // listed. `Title` / `=====` below a table with an indented rule under `-simple_tables` is paragraph text to quarto and a setext heading here; `=` under a pipe table's last row is text to quarto and an underline of `| 1 | 2 |`
  // here; `Title` / `=====` under a line block's continuation line is a heading to quarto that this model does not list. (Rendered `review4`, `r4a_011`, `r4a_017`, `r4a_014`.)
  it.each<[string, string[], string | null, boolean]>([
    ["a headed table with an indented rule, an equals underline under it and no simple tables", ["Col A  Col B", "   - - -", "a b", "   - - -", "Title", "====="], "markdown-simple_tables", false],
    ["a table with an indented rule, a pipe table and a bare equals sign", ["Col A  Col B", "   - - -", "a b", "   - - -", "| a | b |", "|---|---|", "| 1 | 2 |", "="], null, false],
    ["a line block with a continuation line, a text line and its equals underline, a comment", ["| one", "  cont", "Title", "=====", "<!--", "n", "-->"], null, true],
  ])("RED->GREEN: `In` below %s is listed only as quarto does", (label, x, from, listed) => {
    expect(texts(probe("markdown", "blank", x, "    ", from), "markdown").includes("In"), label).toBe(listed);
  });

  // SLICE 34. A READER SWITCHES THE THREE TABLE CONSTRUCTS OFF ONE BY ONE. `markdown-line_blocks` still has pipe tables and grid tables, `markdown-pipe_tables` still has line blocks and grid tables, and `markdown-grid_tables` still has
  // the other two, so a table that ends above a `***` still ends a block there. The first reader gate switched all three off when any one was (`freeCaseTableReader`), and the parent had no table rule at all. Rendered
  // with quarto 1.7.33 in ne mode, exit 0 (`scratchpad/s298/r4b`: 5 table shapes x 3 readers x 2 tails, 30 documents; 12 deletions of the parent are listed now); found by the round-4 tables sweep.
  it.each<[string, string[], string]>([
    ["a pipe table and a break under markdown-line_blocks", ["| a | b |", "|---|---|", "| 1 | 2 |", "***"], "markdown-line_blocks"],
    ["a pipe table without bars and a break under markdown-line_blocks", ["a | b", "--|--", "1 | 2", "***"], "markdown-line_blocks"],
    ["a grid table and a break under markdown-line_blocks", ["+---+---+", "| a | b |", "+---+---+", "***"], "markdown-line_blocks"],
    ["a grid table and a break under markdown-pipe_tables", ["+---+---+", "| a | b |", "+---+---+", "***"], "markdown-pipe_tables"],
    ["a pipe table and a break under markdown-grid_tables", ["| a | b |", "|---|---|", "| 1 | 2 |", "***"], "markdown-grid_tables"],
    ["a line block and a break under markdown-grid_tables", ["| one", "| two", "***"], "markdown-grid_tables"],
  ])("RED->GREEN: an indent-4 `{bash}` opener below %s is indented code", (_label, x, from) => {
    claim(probe("markdown", "blank", x, "    ", from), "markdown", LISTED, from);
  });

  // SLICE 32. THE SIMPLE-TABLE RULES OF THE ROUND-3b TABLES HUNTER (`scratchpad/s298/review3b/tables`: 40,000 generated documents, 10 candidates in 5 classes, every kept document rendered with quarto 1.7.33 in ne mode, exit 0).
  // (a) THE CLOSING RULE OF A MULTILINE OR HEADERLESS TABLE IS NO HEADER ROW: `-----` / `a` / blank / `-----` (and the headed form with a top rule) is one table that its second rule closes, so a `- - -` below the second rule is
  // a break and the opener below it is indented code; the first stacking took the closing rule for a header row and deleted the heading (`r3b_001`, `r3b_002`: quarto lists `In`).
  // (b) A BLANK LINE ENDS A HEADED SIMPLE TABLE (one with no top rule): a dash-column line after the blank is the rule of a SECOND table, not the closing rule of the first, and the rows under it, a comment among them, are
  // rows (`r3b_003`-`005`: swallowed). A table keeps its rows across a blank line only when it is multiline (a top rule above its header) or headerless.
  // (c) AN INDENTED DASH RUN IS NO SETEXT UNDERLINE: ` ---` under `## Before` begins a block, a one-column table's header row, and the `- - -` below it is that table's dash line (`r3b_006`, `r3b_007`: swallowed).
  // (d) AN INDENTED DASH RUN IS A ONE-COLUMN TABLE'S DASH LINE (` ---` / ` ---` / `***`, `---` / ` ---` / `***`): pandoc needs the indent to tell it from an underline (`r3b_008`-`011`: swallowed).
  // (e) A CODE LINE UNDER A PROSE LINE IS A LAZY CONTINUATION, NOT CODE, so the indented line after the blank line below it BEGINS the code block, and `- - -` under that one line is a table's dash line (`r3b_024`).
  // (f) THE ROWS OF AN OPEN SIMPLE TABLE END NOTHING: a fence pair, a break and a definition under `- - - -` directly below a prose line are all rows up to the blank line (`r3b_028`).
  it.each<[string, "blank" | "heading", string[], string | null, string[]]>([
    ["(a) a multiline one-column table's closing rule and a dash column", "blank", ["-----", "a", "", "-----", "- - -"], null, LISTED],
    ["(a) a headed multiline table's closing rule and a dash column", "blank", ["----------", "H  H", "---  ---", "a  b", "", "----------", "- - -"], null, LISTED],
    ["(b) a second table after a blank line, then a comment", "blank", ["H  H", "--  --", "a  b", "", "c  d", "--  --", "<!-- c -->"], null, SWALLOWED],
    ["(b) a second table after a blank line, then a multi-line comment", "heading", ["Hdr  Hd2", "---  ---", "a    b", "", "c    d", "---  ---", "<!--", "n", "-->"], null, SWALLOWED],
    ["(b) a second table after a blank line, then a comment, under markdown-grid_tables", "blank", ["Hdr  Hd2", "---  ---", "a    b", "", "c    d", "---  ---", "<!-- c -->"], "markdown-grid_tables", SWALLOWED],
    ["(c) an indented dash run under the heading, then a dash column", "heading", [" ---", "- - -"], null, SWALLOWED],
    ["(c) a dash run indented three under the heading, then a dash column", "heading", ["   ---", "- - -"], null, SWALLOWED],
    ["(d) two indented dash runs and a break", "blank", [" ---", " ---", "***"], null, SWALLOWED],
    ["(d) two indented dash runs and a definition under the heading", "heading", [" ---", " ---", "[a]: /u"], null, SWALLOWED],
    ["(d) a break, an indented dash run and a break", "blank", ["---", " ---", "***"], null, SWALLOWED],
    ["(d) an indented break, an indented dash run and a break", "blank", [" ***", " ---", "***"], null, SWALLOWED],
    ["(e) a lazy code line, a blank line, a code line and a dash column", "blank", ["Para above.", "    code", "", "    more", "- - -"], null, SWALLOWED],
    ["(f) a dash column under a prose line, a fence pair, a break and a definition", "blank", ["Para above.", "- - - -", "~~~", "~~~", "* * *", "[a]: /u"], null, SWALLOWED],
  ])("RED->GREEN: an indent-4 `{bash}` opener below %s", (_label, ctx, x, from, expected) => {
    claim(probe("markdown", ctx, x, "    ", from), "markdown", expected, `${from ?? "no from"}, ${ctx} context`);
  });
  // The same shapes with the pieces that keep them apart (quarto lists `In` for each; every one is a grid pair or a corpus row already rendered): a table closed by a blank line and a break after it, a real underline, a code run that
  // begins a block.
  it.each<[string, string[], string[]]>([
    ["a headed simple table, a blank line and a break", ["H  H", "--  --", "a  b", "", "***"], LISTED],
    ["a setext heading with a column-0 dash underline and a dash column", ["Title", "-----", "- - -"], ["Before", "Title", "In", "After"]],
    ["two code lines that begin a block and a dash column", ["    a", "", "    b", "- - -"], LISTED],
  ])("GUARD: an indent-4 `{bash}` opener below %s", (_label, x, expected) => {
    claim(probe("markdown", "blank", x), "markdown", expected, "markdown");
  });

  // SLICE 31. THE BASE READER'S DEFAULTS ARE NOT IN THE `from:` STRING. `simple_tables`, `native_divs` and `markdown_in_html_blocks` are on in pandoc's own `markdown` unless a `-` removes them and OFF in `markdown_strict`, `_github`,
  // `_mmd` and `_phpextra` unless a `+` adds them. The first reader gates read "not turned off", so `markdown_strict+simple_tables` had no simple tables (`***` / `- - -` was two breaks and the opener
  // was listed where quarto swallows it) and `markdown_strict-markdown_in_html_blocks` took `<div>x</div>` for a native div whose text swallows the opener (quarto lists it: with `native_divs` off the element is raw HTML). A lone `<div>` ends
  // a block where it is a native div, or a raw block (`native_divs` off AND markdown not parsed inside HTML blocks); under pandoc's markdown with only `-native_divs` it is inline text. The same effective
  // default makes a one-line `<button>x</button>` a paragraph under a strict reader (no `markdown_in_html_blocks`), which is what ends the comment-then-button phantoms. Rendered with quarto 1.7.33 in ne mode, exit 0
  // (`scratchpad/s298/review3b/readers/r3b_001`-`009`, and 36 probes over six strict-family readers, `scratchpad/s298/rdr3`); found by the round-3b readers hunter.
  it.each<[string, "blank" | "heading", string[], string, string[]]>([
    ["markdown_strict+simple_tables: a break and a dash-column line", "blank", ["***", "- - -"], "markdown_strict+simple_tables", SWALLOWED],
    ["markdown_github+simple_tables: a definition and a dash-column line", "blank", ["[a]: /u", "- - -"], "markdown_github+simple_tables", SWALLOWED],
    ["markdown_phpextra+simple_tables: a code line and a dash-column line", "heading", ["    c", "- - -"], "markdown_phpextra+simple_tables", SWALLOWED],
    ["markdown_strict-markdown_in_html_blocks: a one-line div", "blank", ["<div>x</div>"], "markdown_strict-markdown_in_html_blocks", LISTED],
    ["markdown-native_divs-markdown_in_html_blocks: a one-line div", "blank", ["<div>x</div>"], "markdown-native_divs-markdown_in_html_blocks", LISTED],
    ["markdown-native_divs-markdown_in_html_blocks: a lone opening div", "blank", ["<div>"], "markdown-native_divs-markdown_in_html_blocks", LISTED],
    ["markdown_strict-native_divs: a lone opening div", "blank", ["<div>"], "markdown_strict-native_divs", LISTED],
    ["markdown_strict: a comment and a one-line button", "blank", ["<!-- c -->", "<button>x</button>"], "markdown_strict", SWALLOWED],
    ["markdown_github: a comment and a one-line button", "blank", ["<!-- c -->", "<button>x</button>"], "markdown_github", SWALLOWED],
  ])("RED->GREEN: an indent-4 `{bash}` opener below %s", (_label, ctx, x, from, expected) => {
    claim(probe("markdown", ctx, x, "    ", from), "markdown", expected, from);
  });
  // `markdown-native_divs` alone keeps its lone `<div>` as inline text (the opener is swallowed; rendered, the Session 298 reader grid), and the effective defaults leave pandoc's own markdown and a bare `from:` alone.
  it("GUARD: an indent-4 `{bash}` opener below a lone opening div under markdown-native_divs stays swallowed", () => {
    claim(probe("markdown", "blank", ["<div>"], "    ", "markdown-native_divs"), "markdown", SWALLOWED, "markdown-native_divs");
  });

  // SLICE 30. A BULLET-SPELLED BREAK UNDER THE SECOND LINE OF A PARAGRAPH IS PARAGRAPH TEXT AND OPENS NO LIST. `- - -` and `* * *` open no list column where they begin a block (Session 295); under an open paragraph they kept
  // the column, which was harmless while a bare `:::` under prose counted as a boundary (slice 26 made it text, and `- - -` under it began no block). The column then outlived the closed fence below it and the opener
  // was read as inside the list item: quarto lists `In`, this build deleted it. Under the FIRST line of a paragraph the line is a simple table's dash line (a header row above it) and keeps its old reading.
  // Rendered with quarto 1.7.33 in ne mode, exit 0 (`scratchpad/s298/review3b/codes/r3b_025`-`027`); found by the round-3b codes hunter.
  it.each<[string, string[]]>([
    ["a bare div fence, a dash-column line and an empty fence under a prose line", ["Para above.", ":::", "- - -", "```", "```"]],
    ["a bare div fence, a star-column line and an empty fence under a prose line", ["Para above.", ":::", "* * *", "```", "```"]],
    ["a bare div fence, a dash-column line and a raw fence under a prose line", ["Para above.", ":::", "- - -", "```{=html}", "```"]],
  ])("RED->GREEN: an indent-4 `{bash}` opener below %s is indented code", (_label, x) => {
    claim(probe("markdown", "blank", x), "markdown", LISTED, "markdown");
  });
  it("GUARD: an indent-4 `{bash}` opener below a dash-column line and a closed fence directly under a prose line stays swallowed (the simple table runs to the blank line)", () => {
    claim(probe("markdown", "blank", ["Para above.", "- - -", "```", "x", "```"]), "markdown", SWALLOWED, "markdown");
  });

  // SLICE 29. A `[a]:` LINE THAT PANDOC READS AS TEXT IS NO LINK DEFINITION, AND A TILDE FENCE UNDER PROSE IS NO FENCE. Pandoc's definition grammar is wide (the URL may sit on the next line, unquoted junk after it
  // is part of it) but refuses three shapes, each of which is then paragraph text and ends nothing: a URL that starts with `[` (`[a]:[b]: /u`, a bare `[a]:` over a line that starts `[`), a quoted title
  // with junk after it (`[a]: /u 't' x`) and a bare `[a]: ` with no URL to follow it (`linkDefinitionAt`). A bare fence line ends a block only where it CLOSES a fence the scanner opened: a `~~~` line
  // under a prose line is text to pandoc (a backtick fence interrupts a paragraph, a tilde fence does not), so its twin below is text too, and so is an unclosed ``` line. A first, stricter cut (`[label]: url`
  // and nothing else) deleted 9 headings the parent had right (a bare `[a]:` over the opener, a URL on the next line, link attributes), which is why the grammar above is the wide one. Found by the round-3b
  // codes hunter, rendered with quarto 1.7.33 in ne mode, exit 0, all swallowed (`scratchpad/s298/review3b/codes/r3b_001`-`008`, `013`, `015`).
  it.each<[string, "blank" | "heading", string[]]>([
    ["two bare definitions and a break", "heading", ["[a]:", "[a]:", "***"]],
    ["a break and two bare definitions", "blank", ["***", "[a]:", "[a]:"]],
    ["a bare definition, a definition and a break", "blank", ["[a]:", "[a]: /u", "***"]],
    ["two definitions on one line and a code line", "blank", ["[a]:[b]: /u", "    code"]],
    ["two definitions on one line and a break", "heading", ["[a]:[b]: /u", "***"]],
    ["a definition with junk after its title and a break", "heading", ["[a]: /u 't' x", "***  "]],
    ["a definition with junk after its title and a code line", "blank", ["[a]: /u 't' x", "     code"]],
    ["a definition with no URL and an indented definition", "blank", ["[a]: ", "    [a]: /u"]],
    ["a tilde fence under a prose line, two comments", "blank", ["Para above.", "~~~", "x", "~~~", "<!-- a -->", "<!-- b -->"]],
    ["a raw tilde fence under a prose line, two comments", "blank", ["Para above.", "~~~{=html}", "<i>x</i>", "~~~", "<!-- a -->", "<!-- b -->"]],
  ])("RED->GREEN: an indent-4 `{bash}` opener below %s is swallowed", (_label, ctx, x) => {
    claim(probe("markdown", ctx, x), "markdown", SWALLOWED, `markdown, ${ctx} context`);
  });
  // RESIDUAL, kept on purpose (PHANTOM; rendered `review3b/codes/r3b_009`, quarto swallows the opener): a bare `[a]:` directly above a tilde fence and two comments. The scanner reads the bare `[a]:` as a
  // definition, not as an open paragraph, so it opens the fence (which pandoc reads as text under the paragraph) and its closer is recorded. The parent refused every stack and was right by accident.
  it("RESIDUAL, kept on purpose: the opener below a bare definition, a tilde fence and two comments is listed here (quarto swallows it)", () => {
    expect(texts(probe("markdown", "heading", ["[a]:", "~~~~ {.cls}", "x", "~~~~", "<!-- a -->", "<!-- b -->"]), "markdown")).toEqual(["Before", "In", "After"]); // quarto: Before, After
  });
  // The real shapes still end a block: a definition with a quoted or parenthesised title, an angle-bracket URL and a fence under a blank line (quarto lists `In`; the first three are grid pairs of slice 1).
  it.each<[string, string[]]>([
    ["a definition with a double-quoted title and a break", ["[a]: /u \"T\"", "***"]],
    ["a definition with a parenthesised title and a break", ["[a]: /u (T)", "***"]],
    ["a definition with an angle-bracket URL and a break", ["[a]: <b c>", "***"]],
    ["a closed tilde fence after a blank line and two comments", ["", "~~~", "x", "~~~", "<!-- a -->", "<!-- b -->"]],
    ["a closed backtick fence under a prose line and two comments", ["Para above.", "```", "x", "```", "<!-- a -->", "<!-- b -->"]],
    // the wide grammar: the first stricter cut deleted each of these (rendered `dev2/adv/advr_053`-`055`, `dev2/lookalike/lkal_011`, `dev2/long/long_002`, `long_039`, all quarto-listed)
    ["a bare label, the opener being its URL line", ["[a]:"]],
    ["a bare label with its URL on the next, indented line", ["[a]:", "    /url"]],
    ["a definition with link attributes", ["[a]: /url {.cls}"]],
    ["a chain of definitions, one with its URL on the next line", ["[a1]: http://example.com/one", "[a2]: /two \"Title Two\"", "[a3]:", "    /three", "[a4]: /four (Four)"]],
    ["a break, a definition and a bare label", ["***", "[a1]: /a1", "[a2]:"]],
  ])("GUARD: an indent-4 `{bash}` opener below %s is indented code", (_label, x) => {
    claim(probe("markdown", "blank", x), "markdown", LISTED, "markdown");
  });
  it("GUARD: an indent-4 `{bash}` opener below a definition with unquoted junk after its URL is indented code under markdown_mmd (rendered `dev/reader/drdr_041`)", () => {
    claim(probe("markdown", "heading", ["[a]: /u width=20 height=30"], "    ", "markdown_mmd"), "markdown", LISTED, "markdown_mmd");
  });

  // SLICE 28. A LINE THAT LOOKS LIKE A BLOCK ENDER ENDS ONE ONLY WHERE IT BEGINS A BLOCK. Slice 1 took an ATX heading, a setext underline and a fenced-div opener above a line as proof that pandoc is between
  // blocks, which is true only where the heading, the underline or the opener is a real one. Directly under a prose line `# H` is paragraph text (`blank_before_header`), a `=====` under two text lines
  // is text (a setext heading takes ONE line), `::: {.x}` is text, and an underline under a comment line that sits inside a paragraph is text, so two comments (or a comment and a definition)
  // stacked under them are lazy text and the opener below is swallowed. The parent build refused every stack and was right; the first stacking took each of these lines for a boundary and listed `In`.
  // Found by the round-3b differential hunters, rendered with quarto 1.7.33 in ne mode, exit 0, all swallowed (`scratchpad/s298/review3b/codes/r3b_010`-`020`, `023`, `review3b/tables/r3b_012`-`014`).
  it.each<[string, "blank" | "heading", string[]]>([
    ["an ATX line under a prose line, two comments", "blank", ["Para above.", "# H", "<!-- a -->", "<!-- b -->"]],
    ["an empty ATX line under a prose line, a definition and a comment", "blank", ["Para above.", "# ", " [a]: /u", "<!-- c -->"]],
    ["an equals run under two prose lines, two comments", "blank", ["Para above.", "Text", "=====", "<!-- a -->", "<!-- b -->"]],
    ["a fenced-div opener under a prose line, two comments", "blank", ["Para above.", "::: {.x}", "<!-- a -->", "<!-- b -->"]],
    ["an equals run under two text lines directly under a heading, two comments", "heading", ["Text", "Text", "===", "<!-- a -->", "<!-- b -->"]],
    ["a dash run under two text lines directly under a heading, a comment and a definition", "heading", ["Text", "Text", "---", "<!-- c -->", "[a]: /u"]],
    ["an equals run under an indented ATX line and a text line, two comments", "heading", ["   # H", "Text", "===", "<!-- a -->", "<!-- b -->"]],
    ["a comment line with text, a fenced-div opener, two comments", "blank", ["<!-- c --> text", "::: {.x}", "<!-- a -->", "<!-- b -->"]],
    ["a comment line with text, an ATX line, two comments", "blank", ["<!-- c --> text", "# H", "<!-- a -->", "<!-- b -->"]],
    ["a dash run under an indented ATX line and a text line, a comment and a definition", "blank", ["   # H", "Text", "---", "<!-- c -->", "[a]: <http://a.example>"]],
    ["a dash run under a comment line inside a paragraph, a break and a code line", "blank", ["x", "<!-- c -->", "-----", "***", "    code"]],
    ["a dash run under a comment line inside a paragraph, a dash column and a break", "heading", ["x", "<!-- c -->", "-----", "- - -", "***"]],
  ])("RED->GREEN: an indent-4 `{bash}` opener below %s is swallowed", (_label, ctx, x) => {
    claim(probe("markdown", ctx, x), "markdown", SWALLOWED, `markdown, ${ctx} context`);
  });
  // RESIDUAL, kept on purpose (PHANTOM; rendered `review3b/tables/r3b_014`, quarto swallows the opener): a pipe delimiter row with no header (`--|--`) is paragraph text, and a comment and a dash run under it are lazy text. Only
  // a line that is certainly prose proves the line below it continues a paragraph (`provableProse`), and a delimiter-shaped line is not one, so the dash run keeps the textual answer. The parent was right by accident.
  it("RESIDUAL, kept on purpose: the opener below a dash run under a comment under a headerless pipe delimiter row is listed here (quarto swallows it)", () => {
    expect(texts(probe("markdown", "heading", ["--|--", "<!-- c -->", "-----", " - - -", "| 1 | 2 |"]), "markdown")).toEqual(["Before", "In", "After"]); // quarto: Before, After
  });
  // The real headings and underlines still end a block: the same stacks with a blank line above them (quarto lists `In`; each is one of the 450 documents the grid of slice 1 renders).
  it.each<[string, "blank" | "heading", string[]]>([
    ["an ATX line after a blank line, two comments", "blank", ["", "# H", "<!-- a -->", "<!-- b -->"]],
    ["a text line and its setext underline after a blank line, two comments", "blank", ["Title", "=====", "<!-- a -->", "<!-- b -->"]],
    ["a fenced div after a blank line, two comments", "blank", ["::: {.x}", "<!-- a -->", "<!-- b -->"]],
  ])("GUARD: an indent-4 `{bash}` opener below %s is indented code", (_label, ctx, x) => {
    claim(probe("markdown", ctx, x), "markdown", x[0] === "" ? ["Before", "H", "In", "After"] : x[0] === "Title" ? ["Before", "Title", "In", "After"] : LISTED, `markdown, ${ctx} context`);
  });

  // SLICE 1. A FRESH ONE-LINE BLOCK STACKED UNDER ANOTHER FRESH ONE-LINE BLOCK. After a thematic break pandoc is between blocks, so the next line begins a block: a link-reference
  // definition, a thematic break of another spelling or an indented code line then ends itself and the opener below it is indented code. Rendered (`scratchpad/s295/stk`,
  // `st_<A>_then_<B>_m`: both engines, 450 documents). Under a prose line (the `paragraph` context) the first break is paragraph text and nothing changes.
  it.each<[string, string[]]>([
    ["a link definition under a thematic break", ["***", "[a]: https://a.example"]],
  ])("RED->GREEN: an indent-4 `{bash}` opener below %s is indented code", (_label, x) => {
    for (const eng of ["jupyter", "markdown"] as const) {
      claim(probe(eng, "blank", x), eng, LISTED, `${eng}: after a blank line`);
    }
  });

  // SLICE 2. A DASH-COLUMN LINE (`- - -`) DIRECTLY UNDER A ONE-LINE BLOCK IS A SIMPLE-TABLE DASH LINE, NOT A BREAK. Pandoc tries `table` BEFORE `hrule`, `referenceKey` and an
  // indented code block, so a one-line block of those kinds is read as the HEADER ROW of a simple table whenever the line below it is a run of dashes separated by spaces; the table
  // then swallows every line up to the next blank line, the indent-4 opener included. `***` / `- - -` is a one-column-pair table with the header `***`
  // (`quarto pandoc -t native`: `Table ... Plain [ Str "**" ] ... Plain [ Str "*" ]`). Rendered: `st_hr_then_hrb`, `st_hrb_then_hrb`, `st_ref_then_hrb`, `st_code_then_hrb` (all swallowed);
  // `st_cmt_then_hrb`, `st_cmt2_then_hrb`, `st_pipe_then_hrb`, `st_lb_then_hrb`, `st_grid_then_hrb`, `st_hdr7_then_hrb` and `st_atx_then_hrb` are listed, because an HTML comment, a table, a line
  // block of two lines, a grid table and a header are consumed whole BEFORE the table parser tries them (the guard "a third thematic break stacked on two others" of Session 295 is the same
  // fact, rendered in the `heading` context).
  it.each<[string, string[]]>([
    ["a thematic break", ["***", "- - -"]],
    ["a bullet-spelled thematic break", ["- - -", "- - -"]],
    ["a link definition", ["[a]: https://a.example", "- - -"]],
    ["an indented code line", ["    some code", "- - -"]],
  ])("RED->GREEN: an indent-4 `{bash}` opener below `- - -` under %s is swallowed (a simple table's dash line)", (_label, x) => {
    for (const eng of ["jupyter", "markdown"] as const) {
      claim(probe(eng, "blank", x), eng, SWALLOWED, `${eng}: after a blank line`);
    }
  });

  // SLICE 3. A WHOLE-LINE COMMENT UNDER WHICH ANOTHER BLOCK IS STACKED. An HTML comment on its own line at column 0 is a raw block that ends itself, so pandoc is between blocks
  // after it and the next line begins a fresh block — and the `table` parser never tries the comment as a header row (`htmlBlock` is parsed first), so even a dash-column line below it is
  // a break. Rendered (`scratchpad/s295/stk`: `st_cmt_then_hr`, `_hrb`, `_ref`, `_code`, `_cmt`, both engines): all listed.
  it.each<[string, string[]]>([
    ["a thematic break", ["<!-- c -->", "***"]],
    ["a bullet-spelled thematic break", ["<!-- c -->", "- - -"]],
    ["a link definition", ["<!-- c -->", "[a]: https://a.example"]],
    ["an indented code line", ["<!-- c -->", "    some code"]],
    ["another comment", ["<!-- c -->", "<!-- d -->"]],
  ])("RED->GREEN: an indent-4 `{bash}` opener below %s stacked under a one-line comment is indented code", (_label, x) => {
    for (const eng of ["jupyter", "markdown"] as const) {
      claim(probe(eng, "blank", x), eng, LISTED, `${eng}: after a blank line`);
    }
  });

  // SLICE 4. A TABLE OR A LINE BLOCK UNDER WHICH ANOTHER BLOCK IS STACKED. A pipe table, a grid table and a line block that began at a boundary end themselves (Session 295), so the
  // next line begins a fresh block: a thematic break, a bullet-spelled one (a table is consumed whole before `table` could take it for a header), a link definition, an indented code line,
  // a comment. Rendered (`scratchpad/s295/stk`: `st_{pipe,lb,grid}_then_{hr,hrb,ref,code,cmt}`, both engines): all listed.
  const TABLES: [string, string[]][] = [
    ["a pipe table", ["| a | b |", "|---|---|", "| 1 | 2 |"]],
    ["a two-line line block", ["| line one", "| line two"]],
    ["a grid table", ["+---+---+", "| a | b |", "+---+---+"]],
  ];
  const BELOW: [string, string[]][] = [
    ["a thematic break", ["***"]],
    ["a bullet-spelled thematic break", ["- - -"]],
    ["a link definition", ["[a]: https://a.example"]],
    ["an indented code line", ["    some code"]],
    ["a comment", ["<!-- c -->"]],
  ];
  it.each(TABLES.flatMap(([t, tx]) => BELOW.map(([b, bx]): [string, string[]] => [`${b} stacked under ${t}`, [...tx, ...bx]])))(
    "RED->GREEN: an indent-4 `{bash}` opener below %s is indented code",
    (_label, x) => {
      for (const eng of ["jupyter", "markdown"] as const) {
        claim(probe(eng, "blank", x), eng, LISTED, `${eng}: after a blank line`);
      }
    },
  );
  // SLICE 7. A MULTI-LINE COMMENT UNDER WHICH ANOTHER BLOCK IS STACKED. A comment region that opens at column 0 on a fresh block and closes at the end of a line is one raw block that ends
  // itself; the scanner knows its last line (it skipped the region), no text-only test does. Rendered (`scratchpad/s295/stk`: `st_cmt2_then_{hr,hrb,ref,code,cmt,pipe}`, both engines): listed.
  it.each<[string, string[]]>([
    ["a thematic break", ["<!--", "note", "-->", "***"]],
    ["a bullet-spelled thematic break", ["<!--", "note", "-->", "- - -"]],
    ["a link definition", ["<!--", "note", "-->", "[a]: https://a.example"]],
    ["an indented code line", ["<!--", "note", "-->", "    some code"]],
    ["a one-line comment", ["<!--", "note", "-->", "<!-- c -->"]],
    ["a pipe table", ["<!--", "note", "-->", "| a | b |", "|---|---|", "| 1 | 2 |"]],
    ["a second multi-line comment", ["<!--", "note", "-->", "<!--", "more", "-->"]],
  ])("RED->GREEN: an indent-4 `{bash}` opener below %s stacked under a multi-line comment is indented code", (_label, x) => {
    for (const eng of ["jupyter", "markdown"] as const) {
      claim(probe(eng, "blank", x), eng, LISTED, `${eng}: after a blank line`);
    }
  });

  // SLICE 8. A RAW HTML BLOCK ELEMENT UNDER WHICH ANOTHER BLOCK IS STACKED. A raw block element that completes on its line (a closing tag, a one-line element, a lone `<div>`, a
  // `<details>` and its summary, an either-class `<button>` that began fresh) leaves pandoc between blocks (Session 295), so the next line begins a fresh block. Rendered
  // (`scratchpad/s298/wide_blank`, `wb_{div_c,div_1,div_o,details,btn}__<B>`, engine markdown): listed.
  const HTML_FIRST: [string, string[]][] = [
    ["a closing div", ["</div>"]],
    ["a one-line div", ["<div>x</div>"]],
    ["a lone opening div", ["<div>"]],
    ["a details element with its summary", ["<details>", "<summary>s</summary>"]],
    ["a one-line button", ["<button>x</button>"]],
  ];
  const HTML_BELOW: [string, string[]][] = [
    ["a thematic break", ["***"]],
    ["a link definition", ["[a]: /url"]],
    ["an indented code line", ["    code"]],
    ["a comment", ["<!-- c -->"]],
    ["a pipe table", ["| a | b |", "|---|---|", "| 1 | 2 |"]],
    ["a seven-hash line", ["####### Seven"]],
  ];
  it.each(HTML_FIRST.flatMap(([h, hx]) => HTML_BELOW.map(([b, bx]): [string, string[]] => [`${b} stacked under ${h}`, [...hx, ...bx]])))(
    "RED->GREEN: an indent-4 `{bash}` opener below %s is indented code",
    (_label, x) => {
      claim(probe("markdown", "blank", x), "markdown", LISTED, "markdown");
    },
  );

  // SLICE 11. MORE ONE-LINE BLOCKS THAT `table` IS TRIED ON FIRST. The header-row rule of slice 2 holds for every one-line block pandoc parses AFTER `table`: a one-line line block (`| one`;
  // a two-line one is read whole, so its `- - -` is a break) and a raw HTML line that leaves text behind its tag (`<div>x</div>` is the raw block `<div>` and then the text `x</div>`, which is the
  // header row; `</div>` alone is consumed whole, so its `- - -` is a break). Rendered (`wb_{lb1,btn,details,div_1,p_1}__hr_sdash`: swallowed; `wb_{div_c,div_o,lb2}__hr_sdash`: listed).
  it.each<[string, string[]]>([
    ["a one-line line block", ["| one", "- - -"]],
    ["a one-line div", ["<div>x</div>", "- - -"]],
    ["a one-line button", ["<button>x</button>", "- - -"]],
    ["a one-line paragraph element", ["<p>x</p>", "- - -"]],
    ["a details element with its summary", ["<details>", "<summary>s</summary>", "- - -"]],
  ])("RED->GREEN: an indent-4 `{bash}` opener below `- - -` under %s is swallowed (a simple table's dash line)", (_label, x) => {
    claim(probe("markdown", "blank", x), "markdown", SWALLOWED, "markdown");
  });
  it.each<[string, string[]]>([
    ["a closing div", ["</div>", "- - -"]],
    ["a lone opening div", ["<div>", "- - -"]],
    ["a two-line line block", ["| one", "| two", "- - -"]],
  ])("GUARD: an indent-4 `{bash}` opener below `- - -` under %s is still indented code (the block is consumed whole first)", (_label, x) => {
    claim(probe("markdown", "blank", x), "markdown", LISTED, "markdown");
  });

  // SLICE 14. THE SIMPLE-TABLE RULE BELONGS TO PANDOC'S OWN MARKDOWN. `***` / `- - -` is a table (and the opener is swallowed) only where the reader HAS simple tables; `markdown_strict`,
  // `markdown_mmd`, `markdown_phpextra`, `markdown_github` and `markdown-simple_tables` read two thematic breaks, so the opener below them is indented code. Rendered (`scratchpad/s298/rdr298`,
  // `rd_{hr,ref,code}_hrb__<reader>`, 78 documents): listed under those five readers, swallowed under `markdown` and under `markdown` with `-pipe_tables`, `-line_blocks`, `-grid_tables` or `-raw_html`.
  const SIMPLE_TABLE_STACKS: [string, string[]][] = [
    ["a thematic break", ["***", "- - -"]],
    ["a link definition", ["[a]: /u", "- - -"]],
    ["an indented code line", ["    c", "- - -"]],
  ];
  it.each(
    SIMPLE_TABLE_STACKS.flatMap(([l, x]) =>
      ["markdown_strict", "markdown_mmd", "markdown_phpextra", "markdown_github", "markdown-simple_tables"].map((r): [string, string, string[]] => [`${l} under the reader ${r}`, r, x]),
    ),
  )("RED->GREEN: `- - -` under %s is a break, so the opener is indented code", (_label, reader, x) => {
    claim(probe("markdown", "blank", x, "    ", reader), "markdown", LISTED, reader);
  });
  it.each(
    SIMPLE_TABLE_STACKS.flatMap(([l, x]) =>
      ["markdown-pipe_tables", "markdown-line_blocks", "markdown-grid_tables", "markdown-raw_html"].map((r): [string, string, string[]] => [`${l} under the reader ${r}`, r, x]),
    ),
  )("GUARD: `- - -` under %s is still a simple table's dash line", (_label, reader, x) => {
    claim(probe("markdown", "blank", x, "    ", reader), "markdown", SWALLOWED, reader);
  });

  // SLICE 15. COMMENTS AND HTML ELEMENTS END A BLOCK ONLY WHERE THE READER HAS RAW HTML. With `-raw_html` an HTML comment or a closing tag is paragraph text, so the opener below it is a lazy
  // continuation and quarto swallows it; the free case believed the comment ended the block, wrongly for one construct (a phantom before Session 298) and, once enders stacked, for every stack through
  // one. An element with TEXT between its tags (`<button>x</button>`, `<div>x</div>`) ends a block only where `markdown_in_html_blocks` is on. Rendered (`scratchpad/s298/rdr2_298`, 90 documents,
  // `r2_<stack>__<reader>`): swallowed under `markdown-raw_html`, `markdown-raw_html-native_divs` and `markdown_strict-raw_html`; the one-line elements under `-markdown_in_html_blocks`.
  const RAW_HTML_OFF = ["markdown-raw_html", "markdown-raw_html-native_divs", "markdown_strict-raw_html"];
  it.each(
    RAW_HTML_OFF.flatMap((r) =>
      [
        ["a one-line comment", ["<!-- c -->"]],
        ["a multi-line comment", ["<!--", "n", "-->"]],
        ["a closing div", ["</div>"]],
        ["a complete table", ["<table>", "<tr><td>x</td></tr>", "</table>"]],
        ["a comment under a thematic break", ["***", "<!-- c -->"]],
        ["a thematic break under a comment", ["<!-- c -->", "***"]],
        ["a link definition under a closing div", ["</div>", "[a]: /u"]],
      ].map(([l, x]): [string, string, string[]] => [`${l as string} under ${r}`, r, x as string[]]),
    ),
  )("RED->GREEN: the opener below %s is swallowed (no raw HTML, so no raw block ends)", (_label, reader, x) => {
    claim(probe("markdown", "blank", x, "    ", reader), "markdown", SWALLOWED, reader);
  });
  it.each<[string, string[]]>([
    ["a one-line button", ["<button>x</button>"]],
    ["a one-line div", ["<div>x</div>"]],
    ["a thematic break under a one-line button", ["***", "<button>x</button>"]],
  ])("RED->GREEN: the opener below %s under `-markdown_in_html_blocks` is swallowed", (_label, x) => {
    claim(probe("markdown", "blank", x, "    ", "markdown-markdown_in_html_blocks"), "markdown", SWALLOWED, "markdown-markdown_in_html_blocks");
  });

  // SLICE 16. A LONE OPENING `<div>` IS A NATIVE DIV, NOT RAW HTML. It ends the block wherever `native_divs` is on, `-raw_html` included (the div opens a container and the opener below is a fresh block
  // inside it), and does not end it with `-native_divs` (then it is a raw tag that runs on). Rendered (`rdr2_298`: `r2_divo__markdown_raw_html`: listed; `r2_divo__markdown_native_divs`,
  // `r2_divo__markdown_raw_html_native_divs`: swallowed). Found as the one regression of the first `-raw_html` gate.
  it("RED->GREEN: the opener below a lone `<div>` under `-raw_html` is indented code (a native div, not raw HTML)", () => {
    claim(probe("markdown", "blank", ["<div>"], "    ", "markdown-raw_html"), "markdown", LISTED, "markdown-raw_html");
  });
  it.each(["markdown-native_divs", "markdown-raw_html-native_divs"])("RED->GREEN: the opener below a lone `<div>` under `%s` is swallowed (a raw tag that runs on)", (reader) => {
    claim(probe("markdown", "blank", ["<div>"], "    ", reader), "markdown", SWALLOWED, reader);
  });

  // SLICE 19. A DASH-COLUMN LINE THAT OPENS A HEADERLESS TABLE, AND THE LIST COLUMN IT USED TO OPEN. A `- - -` whose next line is not blank and which has another dash-only line anywhere below it is
  // the top rule of a HEADERLESS simple table, whose rows run to that second rule: the opener directly under it is a row (swallowed). With a blank line next, or no rule below, it is a break (slices 1-2).
  // The first cut of slices 1-2 made the dash line "begin at a boundary" and so stopped the bullet-spelled-break narrowing from opening the list column that had swallowed these rows by accident
  // (the parent was right for the wrong reason): found by the round-2 adversarial lens, `dev2/adv/advr_013_sevenhash_then_dashcolumn_footer` and `advr_019_deep_poison_linkdef_dash_rows` (both
  // swallowed by quarto). Under a header candidate the same `- - -` is a header-row table (slice 2) and gets the same treatment.
  it("RED->GREEN: an indent-4 `{bash}` opener below `#######` / `- - -` with a second `- - -` below it is swallowed (a headerless table)", () => {
    claim(probe("markdown", "blank", ["#######", "- - -"], "    ", null, ["- - -"]), "markdown", SWALLOWED, "markdown");
  });
  it("RED->GREEN: the rows of a table opened by `- - -` under a link definition are swallowed, a raw HTML line among them included", () => {
    claim(probe("markdown", "blank", ["[a]: /u", "- - -", "    code", "<div>x</div>"]), "markdown", SWALLOWED, "markdown");
  });
  it.each<[string, string[], string[]]>([
    ["a lone dash-column line", ["- - -"], ["- - -"]],
    ["a dash-column line with a plain rule below", ["- - -"], ["-----"]],
    ["a dash-column line after a comment", ["<!-- c -->", "- - -"], ["- - -"]],
  ])("RED->GREEN: the opener below %s with a second rule below it is swallowed (a headerless table)", (_label, x, after) => {
    claim(probe("markdown", "blank", x, "    ", null, after), "markdown", SWALLOWED, "markdown");
  });

  // SLICE 23. SIX FINDINGS OF THE SECOND INDEPENDENT REVIEW (`scratchpad/s298/review2`, a reader armed with pandoc and the code; each document rendered with quarto). (1) A ONE-LINE LINE BLOCK IS A TABLE
  // HEADER CANDIDATE WHEREVER IT BEGINS A BLOCK, under a code line, a comment or a link definition as well as under a blank line (`r2_002`, `r2_018`, `r2_019`: the comment and the definition hold a pipe,
  // which the first cut took for a pipe-table row). (2) AN INDENTED HTML LINE IS NO RAW BLOCK START (pandoc's `htmlBlock` needs the `<` in the first column), so even a bare `   </div>` is a header
  // row for a `- - -` (`r2_005`). (3) THE TEXT-BETWEEN-TAGS GATE OF `-markdown_in_html_blocks` WAS MEASURED FOR `<div>` AND `<button>` ONLY: `<p>x</p>` still ends the block (`r2_010`). (4) A BLOCK QUOTE
  // ABSORBS EVERY NON-BLANK LINE BELOW ITS MARKED LINES under pandoc's markdown, so a `</div>` under `> q` begins nothing and the `***` below it follows suit (`r2_023`). (5) A DASH RUN UNDER A DASH RUN IS AN
  // UNDERLINE of it, which is text (`r2_001`: `-----` / `-----` is a setext heading, so the `- - -` below is a break and the opener is code). (6) A LINE BLOCK ABSORBS AN INDENTED LINE AS ITS CONTINUATION, so
  // a bar line after `| one` / `    code` is the same block's next line and the pipe table it looks like is not one (`r2_004`).
  it.each<[string, string[]]>([
    ["a one-line line block under an indented code line", ["    code", "| one", "- - -"]],
    ["a one-line line block under a comment holding a pipe", ["<!-- a | b -->", "| one", "- - -"]],
    ["a one-line line block under a link definition holding a pipe", ["[a]: /u|v", "| one", "- - -"]],
    ["an indented closing div", ["   </div>", "- - -"]],
    ["a closing div under a quote line, then a thematic break", ["> q", "</div>", "***"]],
    ["a pipe table under a line block and its continuation line", ["| one", "    code", "| a | b |", "|---|---|", "| 1 | 2 |"]],
  ])("RED->GREEN: the opener below %s is swallowed", (_label, x) => {
    claim(probe("markdown", "blank", x), "markdown", SWALLOWED, "markdown");
  });
  it("RED->GREEN: the opener below `<p>x</p>` under `-markdown_in_html_blocks` is indented code (only div and either-class elements are gated)", () => {
    claim(probe("markdown", "blank", ["<p>x</p>"], "    ", "markdown-markdown_in_html_blocks"), "markdown", LISTED, "markdown-markdown_in_html_blocks");
  });
  it("RED->GREEN: the opener below `-----` / `-----` / `- - -` is indented code (the second dash run underlines the first)", () => {
    expect(texts(probe("markdown", "blank", ["-----", "-----", "- - -"]), "markdown")).toContain("In");
  });
  it("RED->GREEN: a `> q` directly under a prose line is paragraph text, so the `</div>` below it still ends the block (only a quote that begins a block absorbs)", () => {
    claim(probe("markdown", "paragraph", ["> q", "</div>"]), "markdown", LISTED, "markdown, paragraph context");
  });
  it("RED->GREEN: a `>` inside a quoted attribute does not make an empty element look like it holds text (`<div title=\"a>b\"></div>` is no header row)", () => {
    claim(probe("markdown", "blank", ['<div title="a>b"></div>', "- - -"]), "markdown", LISTED, "markdown");
  });
  // SLICE 27. THE CONTEXTS HUNTER OF ROUND 3 (`scratchpad/s298/review3/contexts`: 124,714 generated documents, 31 kept, 8 regressions, each rendered): the stack sits UNDER something. A simple table under a
  // paragraph line, a quote line, a raw TeX environment or a line block is not a table at all (its header does not begin a block), so its closing rule closes nothing; and a code line or a tag inside an open
  // list item or definition is not a top-level block, so what follows it is not fresh. All swallowed by quarto (`r3_001`-`r3_004`, `r3_008`, `r3_009`).
  it.each<[string, string[]]>([
    ["a simple-table lookalike under a paragraph line", ["Para above.", "  a   b", "  --- ---", "  1   2", "  --- ---", "<!-- c -->"]],
    ["a simple-table lookalike under a quote line", ["> q", "  a   b", "  --- ---", "  1   2", "  --- ---", "<!--", "-->"]],
    ["a simple-table lookalike under a raw TeX environment", ["\\begin{equation}", "\\end{equation}", "  --- ---", "  1   2", "  --- ---"]],
    ["a simple-table lookalike under a line block", ["| one", "  a   b", "  --- ---", "  1   2", "  --- ---", "| a | b |", "|---|---|"]],
    ["a code line inside a list item, then a bullet-spelled break", ["- a", "", "      code", "* * *"]],
  ])("RED->GREEN: directly under the heading, the opener below %s is swallowed", (_label, x) => {
    claim(probe("markdown", "heading", x), "markdown", SWALLOWED, "markdown, heading context");
  });

  // RESIDUAL, kept on purpose (PHANTOM; rendered `review3/contexts/r3_009`, quarto swallows the opener): `: def` / blank / `</div>` / `- - -`. The definition's column is popped by the unindented tag, so the
  // textual answer sees a fresh top-level stack where pandoc keeps the tag and the rule inside the definition. The parent was right by accident (stacking refused). Filed with the container-pop rows.
  it("RESIDUAL, kept on purpose: the opener below a closing tag and a dash-column line that follow a definition is listed here (quarto swallows it)", () => {
    expect(texts(probe("markdown", "heading", [": def", "", "</div>", "- - -"]), "markdown")).toEqual(["Before", "In", "After"]); // quarto: Before, After
  });

  // SLICE 29 (promoted from a RESIDUAL row; rendered `review3/contexts/r3_018`, `r3_019`, quarto swallows the opener): an UNCLOSED backtick fence line directly under the heading, then a tag or a rule, then more.
  // Pandoc reads the lone ``` as the start of an inline code span that runs to the next ``` (the opener's own closer line) and swallows the whole stack. A bare fence line is a boundary only where it
  // closes a fence the scanner opened, and nothing closes this one, so the stack is lazy text.
  it.each<[string, string[]]>([
    ["a closing tag and a thematic break", ["```", "</div>", "***"]],
    ["a simple table's rule and a comment", ["```", "  --- ---", "<!-- c -->"]],
  ])("RED->GREEN: under an unclosed fence line, %s are no enders (the opener is swallowed)", (_label, x) => {
    claim(probe("markdown", "heading", x), "markdown", SWALLOWED, "markdown, heading context");
  });

  // SLICE 26. THE HTML HUNTER OF ROUND 3 (`scratchpad/s298/review3/html`: a differential fuzz of 232,032 generated documents against the parent and pandoc kept 40; 34 were regressions, each rendered).
  // Stacking THROUGH a raw HTML line is the leakiest rule of the change: a block-class tag needs no freshness to end a block directly above the opener (it interrupts a paragraph), but a line made fresh BY
  // such a tag inherits none of that, and pandoc's HTML contexts (an open `<li>`, an indented tag, a list item, a quote, a run that runs to the blank line under a reader outside pandoc's markdown)
  // each change what follows. So (1) an HTML line makes the NEXT line fresh only at column 0, where it begins a block itself (the one exception: `<summary>` under a lone `<details>`), and only under
  // pandoc's own markdown. (2) The raw-content gate asks for a CLOSED element (an unclosed `<pre>` swallows nothing: `r3_016`). (3) A bare `:::` with no fenced div open is text, not a fence (`r3_013`). (4) Native
  // divs under `-raw_html` are counted by the lines that start or end them (an indented `    </div>` is code, a split or self-closing opener opens, a `<div>x</div>` leaves its div open: `r3_018`-`r3_024`).
  it("RED->GREEN: an unclosed <pre> swallows nothing, so the opener below `<pre>` / blank / `***` is indented code", () => {
    claim(probe("markdown", "blank", ["<pre>", "", "***"]), "markdown", LISTED, "markdown");
  });
  it("RED->GREEN: a bare `:::` with no fenced div open is text, so the comments stacked under it end nothing", () => {
    claim(probe("markdown", "blank", [":::", "<!--- c --->", "<!-- <div> -->"]), "markdown", SWALLOWED, "markdown");
  });
  it.each<[string, string[]]>([
    ["an indented closer between the opener and the closer", ["<div>", "    </div>", "</div>"]],
    ["an opening tag split over two lines", ["<div", 'class="a">', "</div>"]],
    ["a self-closing div tag", ["<div/>", "</div>"]],
    ["a one-line div whose text swallows its own closer", ["<div>x</div>", "</div>"]],
    ["an empty div with a greater-than sign inside a quoted attribute", ['<div title="a>b"></div>']],
  ])("RED->GREEN: under `-raw_html` the opener below %s is indented code (a native div closes)", (_label, x) => {
    claim(probe("markdown", "blank", x, "    ", "markdown-raw_html"), "markdown", LISTED, "markdown-raw_html");
  });
  it.each<[string, string, string[]]>([
    ["a thematic break and a lone div tag with an attribute", "markdown_strict-raw_html", ["***", '<div class="a">']],
    ["a one-line either-class element and a thematic break", "markdown_strict", ["<button>x</button>", "***"]],
    ["a one-line either-class element and a comment", "markdown_phpextra", ["<ins>x</ins>", "<!-- c -->"]],
    ["a bare fence line and a closing div", "markdown_strict", [":::", "</div>"]],
    ["a div with a markdown attribute and a code line", "markdown_phpextra", ['<div markdown="1">', "    b"]],
    ["a closed fence and a closing list", "markdown_strict", ["```", "```", "</ul>"]],
  ])("RED->GREEN: the opener below %s under %s is swallowed (a raw HTML block runs to the blank line there)", (_label, reader, x) => {
    claim(probe("markdown", "blank", x, "    ", reader), "markdown", SWALLOWED, reader);
  });

  // SLICE 25. THREE MORE FINDINGS OF THE SECOND REVIEW (rendered, `review2/r2_022`, `r2_026`, `r2_027`). (1) A closing tag is a ROW of the simple table above it, not a block ender: `Text` / `--- ---` /
  // `</div>` / `***` is one table whose rows swallow everything to the blank line, so the `***` under the tag is no fresh break (a block-class tag needs no freshness to end a block, which is only true under a
  // paragraph). (2) A LIST-LIKE CLOSING RULE is filed, not fixed (the residual below). (3) THE LIST COLUMN that a header-row `- - -` used to open
  // by accident, and which swallowed the rows, must not outlive a table that CLOSES before the opener (`-----` / `- - -` / `Title` / `-----`: the table ends at the second rule).
  it("RED->GREEN: a closing tag under a simple table's rule is a row of that table, so the thematic break below it ends nothing", () => {
    claim(probe("markdown", "blank", ["Text", "--- ---", "</div>", "***"]), "markdown", SWALLOWED, "markdown");
  });
  // RESIDUAL, kept on purpose (DELETION; rendered `review2/r2_026`, quarto lists `In`; filed under row (3)(c) of the Kernel-cell item): `- - -` / `a` / `- - -` is a HEADERLESS table closed by its second rule, but
  // the scanner's own simple-table state (Session 239) reads `a` over the closing rule as a new table's HEADER and swallows the `## In` heading below as a row, whatever the free case says. A future simple-table
  // rule for headerless tables flips this on purpose.
  it("RESIDUAL, kept on purpose: the opener below the closing `- - -` of a headerless table is still swallowed (quarto lists `In`)", () => {
    expect(texts(probe("markdown", "blank", ["- - -", "a", "- - -"]), "markdown")).toEqual(["Before", "After"]); // quarto: Before, In, After
  });
  it("RED->GREEN: the opener below a header-row table that closes before it is indented code (`-----` / `- - -` / `Title` / `-----`)", () => {
    expect(texts(probe("markdown", "blank", ["-----", "- - -", "Title", "-----"]), "markdown")).toContain("In");
  });
  it("GUARD: the rows of a header-row table that never closes still swallow an indented opener below them (deep rows)", () => {
    claim(probe("markdown", "blank", ["[a]: /u", "- - -", "    code", "<div>x</div>"]), "markdown", SWALLOWED, "markdown");
  });
  it("GUARD: the opener below a closing tag that is NOT under a table's rule is still indented code", () => {
    claim(probe("markdown", "blank", ["Text", "</div>"]), "markdown", LISTED, "markdown");
  });
  it("GUARD: the opener below a line block and its continuation line is still indented code (the continuation is absorbed, the next heading is a heading)", () => {
    claim(probe("markdown", "blank", ["| one", "    code"]), "markdown", LISTED, "markdown");
  });

  // SLICE 22. THE BOUNDARIES ARE LINEAR IN THE DOCUMENT. A late question (`startsAt` for a multi-line comment, an opener, a thematic break far down a long file) fills the memo for every line above it, and each
  // line asked its run start by scanning back up to 1,000 lines: 40,000 indented lines then a comment cost 16 times the scan itself (101 ms to 1,653 ms), 40,000 link definitions 10 times, found by the independent
  // review and re-measured here. The run starts are now memoised per predicate. The bound is a RATIO to the same document without the late question, so a loaded machine does not make it flaky.
  const timeOf = (text: string): number => {
    let best = Infinity;
    for (let n = 0; n < 3; n++) {
      const t0 = process.hrtime.bigint();
      findHeadings(text + `\n<!-- unique ${n} ${best} -->\n`, "markdown");
      best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6);
    }
    return best;
  };
  const longDoc = (line: (i: number) => string, n: number, question: string[]): string =>
    doc("---", 'title: "T"', "engine: markdown", "---", "", ...Array.from({ length: n }, (_v, i) => line(i)), ...question);
  it.each<[string, (i: number) => string, number]>([
    ["indented code lines", (i) => `    code ${i}`, 20000],
    ["link definitions", (i) => `[r${i}]: /u${i}`, 20000],
    ["indented text lines (a line-block run)", (i) => `  indented text ${i}`, 20000],
  ])("RED->GREEN: a late multi-line comment after %s costs a small multiple of the scan alone", (_label, line, n) => {
    const question = ["<!--", "c", "-->", "    ```{bash}", "x", "    ```"];
    const base = timeOf(longDoc(line, n, ["", "plain text"]));
    const late = timeOf(longDoc(line, n, ["", ...question]));
    expect(late, `late ${late.toFixed(0)} ms against ${base.toFixed(0)} ms`).toBeLessThan(base * 4 + 150);
  }, 60000);
  it("RED->GREEN: a line of 20,000 `<div` with no `>` does not make the tag scan quadratic", () => {
    const text = doc("---", 'title: "T"', "engine: markdown", "---", "", "<div".repeat(20000), "", "***", "    ```{bash}", "x", "    ```");
    expect(timeOf(text)).toBeLessThan(150);
  }, 60000);

  // SLICE 21. THREE FINDINGS OF THE INDEPENDENT CODE REVIEW (`scratchpad/s298/review1`, each rendered). (1) NOTHING ENDS A BLOCK INSIDE AN OPEN RAW-CONTENT ELEMENT: everything in a `<pre>` (or a
  // `<script>`, `<style>`, `<textarea>`) is raw text, so a stack of enders inside it ends nothing and the opener is swallowed; only the HTML rule asked the scanner's raw-content depth (the parent was right
  // here by accident: stacking was refused). (2) A `<div></div>` OPENED AND CLOSED ON ONE LINE is an empty native div under `-raw_html` too (`<div>x</div>` is not: the text swallows the closer). (3) A
  // CLOSING TAG UNDER A READER OUTSIDE PANDOC'S MARKDOWN: not fixed, see below.
  it("RED->GREEN: a stack of enders inside an open <pre> ends nothing, so the opener is swallowed", () => {
    claim(
      doc("---", 'title: "T"', "engine: markdown", "---", "", "## Before", "", "Prose before.", "", "<pre>", "", "***", "[a]: http://x", "    ```{bash}", "## In", "x = 1", "    ```", "</pre>", "", "## After", "", "tail"),
      "markdown", SWALLOWED, "markdown");
  });
  it("RED->GREEN: the opener below `<div></div>` under `-raw_html` is indented code (an empty native div closes at once)", () => {
    claim(probe("markdown", "blank", ["<div></div>"], "    ", "markdown-raw_html"), "markdown", LISTED, "markdown-raw_html");
  });
  // (Finding 3 of the first review, a closing tag under a reader outside pandoc's markdown, is NOT fixed: the HTML run there runs to the blank line, and the round-3 hunter's documents `r3_025`, `r3_035` showed the
  // "begins at a boundary" refinement wrong for them. The parent's rule stays; rendered rows `rd_hr_divc__markdown_{strict,github,mmd,phpextra}` list `In` and remain a filed residual.)

  // SLICE 20. A SIMPLE TABLE NEEDS A ROW, AND ITS CLOSING RULE ENDS IT. (1) A dash-column line whose next line is another dash-only line has no row between them: `- - -` / `-----` is a setext
  // heading whose text is `- - -`, not a table, and the opener below is indented code (rendered, `dev/stack3/dst3_032_five_thematic_spellings`: `Before`, `- - -`, `In`, `After`). (2) The rule
  // that closes a headerless table ends it, so the opener below the closing rule is indented code, whatever kind of rule it is (rendered, `dev/tables/dtbl_018_simple_headerless_dash_frame`).
  // Both were right under the first cut by luck; the headerless rule (slice 19) lost them, and neither counted as a regression because the parent was wrong on both.
  it("RED->GREEN: an indent-4 `{bash}` opener below `- - -` / `-----` (a setext heading, no row between) is indented code", () => {
    claim(probe("markdown", "blank", ["***", "___", "* * *", "- - -", "-----"]), "markdown", ["Before", "- - -", "In", "After"], "markdown");
  });
  it("RED->GREEN: an indent-4 `{bash}` opener below the closing rule of a headerless simple table is indented code", () => {
    claim(probe("jupyter", "blank", ["-------     ------ ----------", "     12     12        12", "     13     13        13", "-------     ------ ----------"]), "jupyter", LISTED, "jupyter");
  });

  // SLICE 18. AN ATX LINE IS TEXT TO A DASH RUN BELOW IT. Pandoc tries `setextHeader` before `atxHeader`, so `## Before` / `---` is a setext heading whose text is `## Before` (the model already reports
  // it so): the `---` is an underline, not a break, and the `- - -` under it begins a fresh block. Found by the heading-context grid (`scratchpad/s298/wide_heading`, `wh_hr_dash3__hr_sdash`: listed).
  it("RED->GREEN: an indent-4 `{bash}` opener below `---` / `- - -` directly under the `## Before` heading is indented code", () => {
    claim(probe("markdown", "heading", ["---", "- - -"]), "markdown", ["## Before", "In", "After"], "markdown, heading context");
  });

  // SLICE 17. A `</div>` THAT CLOSES AN OPEN NATIVE DIV ENDS THE BLOCK EVEN WITHOUT RAW HTML. With `native_divs` on, `<div>` opens a container and the `</div>` that closes it ends the block whatever
  // `raw_html` says; an ORPHAN `</div>` has nothing to close and is text under `-raw_html` (slice 15). The scanner counts the open native divs above each line. Found by the round-2 holdout
  // (`dev2/readers/rdr2_035_norh_div_closed`: quarto lists `In`, the first `-raw_html` gate deleted it; the parent was right). `<div>` / `<div>` / `</div>` is not rendered here.
  it("RED->GREEN: the opener below `<div>` / `</div>` under `-raw_html` is indented code (the native div closes)", () => {
    claim(probe("markdown", "blank", ["<div>", "</div>"], "    ", "markdown-raw_html"), "markdown", LISTED, "markdown-raw_html");
  });
  it("GUARD: the opener below an ORPHAN `</div>` under `-raw_html` stays swallowed (nothing to close)", () => {
    claim(probe("markdown", "blank", ["</div>"], "    ", "markdown-raw_html"), "markdown", SWALLOWED, "markdown-raw_html");
  });

  // SLICE 13. A DASH RUN THAT UNDERLINES THE TEXT ABOVE IS NO BLOCK START, SO IT IS NO TABLE HEADER. `-----` directly under a text line is that line's setext underline, and the `- - -` below it
  // begins a fresh block (a break); the same dashes under a blank line or a heading ARE a break of their own and stay a header-row candidate (slice 2). Found by the full wide grid: the first cut of
  // slice 2 took every thematic break, an underline included, for a header and swallowed the opener (`wb_setext2__hr_sdash`: listed, with the setext heading `Title`). The same shape closes a
  // mid-document `---` / `k: v` / `---` block (`wb_yaml__hr_sdash`: `In` is listed; the model still reports `k: v` as a heading there, the filed mid-document metadata item).
  it("RED->GREEN: an indent-4 `{bash}` opener below `- - -` under a setext heading with a dash underline is indented code", () => {
    claim(probe("markdown", "blank", ["Title", "-----", "- - -"]), "markdown", ["Before", "Title", "In", "After"], "markdown");
  });
  it("RED->GREEN: an indent-4 `{bash}` opener below `- - -` under a mid-document `---` / `k: v` / `---` block lists `In`", () => {
    expect(texts(probe("markdown", "blank", ["---", "k: v", "---", "- - -"]), "markdown")).toContain("In");
  });

  // SLICE 12. A `|` LINE DIRECTLY UNDER A TABLE OR A LINE BLOCK CONTINUES IT. Line blocks, pipe tables and pipe rows all start with a bar, so a bar line under one is the same block's next line, not
  // a block that begins fresh: stacking through the table above made `| a | b |` under a line block, and the last row of a pipe table under its delimiter row, begin at a boundary, which then
  // let an indented comment under them end a line block that pandoc never starts. Rendered (`wb_lb_cont__pipe`, `wb_lb_cont__pipe_hdr`, `wb_pipe__cmt_ind`, engine markdown): swallowed.
  it.each<[string, string[]]>([
    ["a pipe table under a line block with a continuation line", ["| one", "  cont", "| a | b |", "|---|---|", "| 1 | 2 |"]],
    ["a pipe table without a body under a line block with a continuation line", ["| one", "  cont", "| a | b |", "|---|---|"]],
    ["an indented comment under a pipe table", ["| a | b |", "|---|---|", "| 1 | 2 |", " <!-- c -->"]],
  ])("RED->GREEN: an indent-4 `{bash}` opener below %s is swallowed", (_label, x) => {
    claim(probe("markdown", "blank", x), "markdown", SWALLOWED, "markdown");
  });

  // SLICE 9. A GRID TABLE UNDER A LINE BLOCK. The run of lines starting `|` or `+` that makes a grid table was searched back over every such line, so the `| one` line of a line block above the
  // top border was taken for the start of the run and the table was thought to begin at a non-boundary. A grid table begins at its first border line, as a line block begins at its first bar
  // line (slice 5). Rendered (`scratchpad/s298/wide_blank`, `wb_lb1__grid`, `wb_lb2__grid`, engine markdown): listed.
  it.each<[string, string[]]>([
    ["a grid table under a one-line line block", ["| one", "+---+---+", "| a | b |", "+---+---+"]],
    ["a grid table under a two-line line block", ["| one", "| two", "+---+---+", "| a | b |", "+---+---+"]],
  ])("RED->GREEN: an indent-4 `{bash}` opener below %s is indented code", (_label, x) => {
    claim(probe("markdown", "blank", x), "markdown", LISTED, "markdown");
  });

  // SLICE 10. `- - -` UNDER A MULTI-LINE CODE BLOCK IS A BREAK. Pandoc tries `table` only at the FIRST line of a block, so an indented code block of two or more lines (a blank line inside
  // it included) is read whole and the `- - -` below it starts a fresh block, a thematic break; only a ONE-line code block is a table's header row (slice 2). Rendered (`wb_code2__hr_sdash`,
  // `wb_code_blank__hr_sdash`, engine markdown): listed.
  it.each<[string, string[]]>([
    ["two code lines", ["    a", "    b", "- - -"]],
    ["two code lines with a blank line between", ["    a", "", "    b", "- - -"]],
  ])("RED->GREEN: an indent-4 `{bash}` opener below `- - -` under %s is indented code", (_label, x) => {
    claim(probe("markdown", "blank", x), "markdown", LISTED, "markdown");
  });

  // SLICE 6. THE STACK IS EVALUATED WITHOUT RECURSING THROUGH ITS DEPTH. "Is pandoc between blocks above this line" asks the same question of the line above it, so a stack of N enders was
  // N frames deep: a document with 15,000 thematic breaks and link definitions stacked directly (a generated reference list, an auto-built separator ladder) overflowed the JavaScript stack
  // inside `findHeadings`. The answer is computed once per line, bottom-up, and memoised per document and reader.
  it("RED->GREEN: a stack of 15,000 alternating thematic breaks and link definitions does not overflow the stack", () => {
    const stack: string[] = [];
    for (let n = 0; n < 15000; n++) {
      stack.push(n % 2 === 0 ? "***" : "[a]: https://a.example");
    }
    for (const eng of ["jupyter", "markdown"] as const) {
      expect(() => texts(probe(eng, "blank", stack), eng), eng).not.toThrow();
    }
  });
  // SLICE 5. A LINE BLOCK STACKED UNDER ANOTHER FRESH BLOCK. The run of `| ` lines and indented continuation lines that makes a line block was searched back over EVERY indented line, so an indented
  // CODE line directly above it was taken for the start of the run and the line block was thought to begin at a non-boundary. The block begins at its first `| ` line (rendered,
  // `scratchpad/s295/stk` `st_code_then_lb`: listed). The same line block under a thematic break, a link definition and a comment already passes (slice 4).
  it.each<[string, string[]]>([
    ["a two-line line block under an indented code line", ["    some code", "| line one", "| line two"]],
    ["a one-line line block under an indented code line", ["    some code", "| line one"]],
    ["a line block with a continuation line under two code lines", ["    a", "    b", "| line one", "  cont"]],
  ])("RED->GREEN: an indent-4 `{bash}` opener below %s is indented code", (_label, x) => {
    for (const eng of ["jupyter", "markdown"] as const) {
      claim(probe(eng, "blank", x), eng, LISTED, `${eng}: after a blank line`);
    }
  });
});
