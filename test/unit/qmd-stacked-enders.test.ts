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
  const probe = (eng: Eng, ctx: Ctx, x: string[], open = "    ", from: string | null = null): string =>
    doc(
      ...(from === null ? FRONT[eng] : ["---", 'title: "T"', "engine: markdown", `from: ${from}`, "---", ""]),
      "## Before",
      ...(ctx === "blank" ? ["", "Prose before.", ""] : ctx === "paragraph" ? ["", "Para above."] : []),
      ...x,
      `${open}\`\`\`{bash}`,
      "## In",
      "x = 1",
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
