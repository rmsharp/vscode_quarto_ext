import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { findHeadings } from "../../src/core/qmd/model";

/** The headings the Outline lists for a knitr document. */
const outline = (lines: readonly string[]): string[] => findHeadings(lines.join("\n"), "knitr").map((h) => h.text);

describe("Session 309 — a chunk that PRINTS with its code not echoed emits TWO bare fences, and pandoc pairs fences strictly in order", () => {
  // MEASURED, quarto 1.7.33 with knitr 1.51, exit 0, real execution (`scratchpad/s309/geo3`, untracked; 256 documents, fixture `test/fixtures/knitr-print-geometry/`).
  // A chunk with `echo=FALSE` whose code prints hands pandoc an OUTPUT block: a bare ``` line, the text, a bare ``` line. A stray bare fence above the document pairs with the
  // FIRST bare fence below it (that block's opener) and swallows every heading between them; the block's own closer then opens a region that pairs with the NEXT printing
  // chunk's opener, and so on, so every heading from the stray fence down to the opener of the LAST printing chunk is swallowed. The chunk's closer after it has nothing to pair with.
  it("a stray fence above three printing chunks swallows every heading down to the last chunk's opener (g_p-p-p_s0)", () => {
    expect(
      outline([
        "---", 'title: "geo"', "---", "", "Intro.", "", "```", "",
        "```{r, echo=FALSE}", 'print("p0")', "```", "", "# H0", "",
        "```{r, echo=FALSE}", 'print("p1")', "```", "", "# H1", "",
        "```{r, echo=FALSE}", 'print("p2")', "```", "", "# H2", "",
      ]),
    ).toEqual(["H2"]);
  });

  // Rows of the same behaviour, PASSING ON ARRIVAL (disclosed: only the row above was written red): every sequence of three chunk kinds over P (a printing chunk, code not
  // echoed), Q (a quiet one), L (echoed, no output) and LP (echoed and printing) with the stray fence at each of four positions, 256 documents rendered with quarto 1.7.33.
  // The answers equal a fence-pairing simulator that was frozen BEFORE any render (256 of 256). HEAD answered 242 of them.
  type Row = [string, string, string[]];
  const rows = (JSON.parse(readFileSync(path.join(__dirname, "../fixtures/knitr-print-geometry/quarto-1.7.33.json"), "utf8")) as { rows: Row[] }).rows;
  it("covers the whole fixture: 256 documents", () => {
    expect(rows).toHaveLength(256);
  });
  it.each(rows.map((r) => [r[0], r] as const))("rendered: %s", (_name, r) => {
    expect(findHeadings(r[1], "knitr").map((h) => h.text)).toEqual(r[2]);
  });
});

describe("Session 309 — WHICH silenced chunks print: a statement that certainly emits an output block", () => {
  // MEASURED, quarto 1.7.33 with knitr 1.51, exit 0, real execution (`scratchpad/s309/stm`, untracked; ids `w` (printers), `n` (look-alikes), `o` and `p` (the chunk's own
  // options), `f` (front matter), `c` (a setup call), `m` (masking)). Every row is ONE document: the headings Top and After, a stray bare fence under Top, the heading Between,
  // ONE silenced chunk under Between. A chunk that PRINTS hands pandoc a bare fence, so the stray one pairs with it and swallows Between (`PRINTS`); a quiet chunk leaves all three
  // headings (`QUIET`). A WRONG "prints" DELETES a heading quarto renders, so every rule below is positive: anything not read as a certain print keeps HEAD's answer (silent).
  const PRE = ["```{r setup0, include=FALSE}", "x <- c(3, 1, 2, 5, 4)", "df <- cars", "fit <- lm(dist ~ speed, data = cars)", "```", ""];
  interface Stm { header?: string; front?: string[]; pre?: string[] }
  const stm = (code: string[], o: Stm = {}): string[] =>
    outline(["---", 'title: "s"', ...(o.front ?? []), "---", "", ...(o.pre ?? PRE), "# Top", "", "```", "", "## Between", "", `\`\`\`${o.header ?? "{r, echo=FALSE}"}`, ...code, "```", "", "## After", ""]);
  const PRINTS = ["Top", "After"];

  it("`cat()` of a string literal prints (w005)", () => {
    expect(stm(['cat("hello\\n")'])).toEqual(PRINTS);
  });

  it("`summary(x)` as a whole statement prints (w008)", () => {
    expect(stm(["summary(x)"])).toEqual(PRINTS);
  });

  it("`print()` of a text call prints (w030)", () => {
    expect(stm(["print(summary(x))"])).toEqual(PRINTS);
  });

  const QUIET = ["Top", "Between", "After"];
  const MASK = (...code: string[]): string[] => [...PRE, "```{r mask, include=FALSE}", ...code, "```", ""];
  it("a document that REDEFINES `print` above the chunk: `print(\"hi\")` prints nothing (m001)", () => {
    expect(stm(['print("hi")'], { pre: MASK("print <- function(x, ...) invisible(x)") })).toEqual(QUIET);
  });

  it("a NAMED ARGUMENT that spells a function (`data.frame(mean = 1, head = 1)`) is no redefinition: `summary(x)` still prints (rendered, one document)", () => {
    expect(stm(["summary(x)"], { pre: MASK("res <- data.frame(mean = mean(x), head = 1)") })).toEqual(PRINTS);
  });

  it("`results=\"hide\"` on the chunk: the printed text is dropped, so the chunk is quiet (o001)", () => {
    expect(stm(["print(summary(x))"], { header: '{r, echo=FALSE, results="hide"}' })).toEqual(QUIET);
  });

  // The DOCUMENT's defaults (front matter). `execute: echo: false` silences the code in both modes; the print is read for the EXECUTING mode, as every setup-call default is.
  it("`execute: echo: false` and a printing chunk with no options of its own (f001)", () => {
    expect(stm(["print(summary(x))"], { header: "{r}", front: ["execute:", "  echo: false"] })).toEqual(PRINTS);
  });
  it("`execute: output: false` hides every output block, so the chunk is quiet (f006)", () => {
    expect(stm(["print(summary(x))"], { header: "{r}", front: ["execute:", "  echo: false", "  output: false"] })).toEqual(QUIET);
  });

  // A setup chunk's `knitr::opts_chunk$set(echo = FALSE)` runs only when the document EXECUTES; the Outline follows the executing mode (Session 308, confirmed by the operator at
  // Session 309), where the printing chunk below it emits an output block.
  const SETUP = (...code: string[]): string[] => ["```{r setup, include=FALSE}", ...code, "```", ""];
  it("a setup call `opts_chunk$set(echo = FALSE)` and a printing chunk with no options of its own (c001)", () => {
    expect(stm(["print(summary(x))"], { header: "{r}", pre: [...SETUP("knitr::opts_chunk$set(echo = FALSE)"), ...PRE] })).toEqual(PRINTS);
  });

  it("a setup call that ALSO sets `results = \"hide\"`: the default hides the printed text (c002)", () => {
    expect(stm(["print(summary(x))"], { header: "{r}", pre: [...SETUP('knitr::opts_chunk$set(echo = FALSE, results = "hide")'), ...PRE] })).toEqual(QUIET);
  });

  // `cat()` of a string that is only whitespace or whitespace escapes writes a blank: knitr emits no output block (rendered, `scratchpad/s309/one/ws1`-`ws5`; found by the
  // chunk-level join over the blind lenses: 2 of 220 chunks called certain prints were `cat("\\n")`). `cat("a\\n")` and `print(" ")` print (ws4, ws6).
  it("`cat(\"\\n\")` writes only a newline, so the chunk is quiet (ws1)", () => {
    expect(stm(['cat("\\n")'])).toEqual(QUIET);
  });

  // THE FUNCTION GRID (`scratchpad/s309/fn`): the same layout with a longer setup chunk (`g`, `tab`), ONE whole statement per document. 116 base-R calls printed and none was
  // quiet (y001-y116); the 31 look-alikes that print nothing (`plot`, `hist`, `invisible`, `set.seed`, an assignment, ...) were never candidates (q001-q040).
  const FN_PRE = [
    "```{r setup0, include=FALSE}", "x <- c(3, 1, 2, 5, 4)", "g <- factor(c('a','b','a','b','a'))", "df <- cars", "fit <- lm(dist ~ speed, data = cars)",
    "tab <- table(mtcars$cyl, mtcars$gear)", "```", "",
  ];
  it("`median(x)` as a whole statement prints (y001)", () => {
    expect(stm(["median(x)"], { pre: FN_PRE })).toEqual(PRINTS);
  });

  // MESSAGES and WARNINGS (`scratchpad/s309/msg`, rendered): a `message()` or `warning()` writes a block of its own (stderr), which `message` and `warning` options switch off, and
  // rendered: `execute: warning: false` ALSO hides a message while `execute: message: false` hides nothing, so any such option, anywhere, declines.
  const MSG_PRE = ["```{r setup0, include=FALSE}", "x <- c(3, 1, 2, 5, 4)", "```", ""];
  it("`message(\"hi\")` under `echo=FALSE` writes an output block (m001)", () => {
    expect(stm(['message("hi")'], { pre: MSG_PRE })).toEqual(PRINTS);
  });

  it("`message=FALSE` on the chunk switches the message off (m002)", () => {
    expect(stm(['message("hi")'], { pre: MSG_PRE, header: "{r, echo=FALSE, message=FALSE}" })).toEqual(QUIET);
  });

  it("a setup call that sets `message = FALSE` switches the message off (m004)", () => {
    expect(stm(['message("hi")'], { header: "{r}", pre: [...SETUP("knitr::opts_chunk$set(echo = FALSE, message = FALSE)"), ...MSG_PRE] })).toEqual(QUIET);
  });

  it("`execute: warning: false` switches a warning off (m016) and, measured, a MESSAGE too (m015)", () => {
    const front = ["execute:", "  echo: false", "  warning: false"];
    expect(stm(['warning("hi")'], { header: "{r}", front, pre: MSG_PRE })).toEqual(QUIET);
    expect(stm(['message("hi")'], { header: "{r}", front, pre: MSG_PRE })).toEqual(QUIET);
  });
});

describe("Session 309 — every statement shape rendered with quarto 1.7.33, document by document", () => {
  // `[grid/name, document, quarto's headings, this model's headings when the fixture was written, HEAD's (Session 308)]`, 342 documents from three grids (`scratchpad/s309/stm`,
  // `fn`, `msg`, untracked): see the fixture's own `note`. PASSING ON ARRIVAL, disclosed: written after the rules above, and pinned CLOSED-WORLD (Learning 685), so a rule that starts
  // or stops hiding a heading on any row fails here until the fixture is regenerated on purpose.
  type StatementRow = [string, string, string[], string[], string[]];
  const FIXTURE = path.join(__dirname, "../fixtures/knitr-print-statements/quarto-1.7.33.json");
  const statementRows = (JSON.parse(readFileSync(FIXTURE, "utf8")) as { rows: StatementRow[] }).rows;
  const model = (r: StatementRow): string[] => findHeadings(r[1], "knitr").map((h) => h.text);

  it("covers the whole fixture: 342 documents", () => {
    expect(statementRows).toHaveLength(342);
  });

  it("agrees with quarto on 281 of them (HEAD, Session 308, agreed on 89)", () => {
    expect(statementRows.filter((r) => model(r).join("|") === r[2].join("|"))).toHaveLength(281);
    expect(statementRows.filter((r) => r[4].join("|") === r[2].join("|"))).toHaveLength(89);
  });

  // THE PROPERTY THIS SESSION EXISTS TO KEEP: a wrong "prints" hides a heading quarto renders. Three documents do, and HEAD hides the same three: with `collapse` the printed lines
  // (`## [1] 3`) are written OUTSIDE any fence, and a line that begins `## ` is a HEADING that quarto lists (s_c005 `comment = NA` is the same, o012, p012). The model cannot know them.
  it("never hides a heading quarto renders, except the three `collapse` documents that HEAD hides too", () => {
    const hiding = statementRows.filter((r) => r[2].some((t) => !model(r).includes(t))).map((r) => r[0]);
    expect(hiding).toEqual(["stm/s_c005", "stm/s_o012", "stm/s_p012"]);
    expect(statementRows.filter((r) => r[2].some((t) => !r[4].includes(t))).map((r) => r[0])).toEqual(hiding);
  });

  it("is right on every document HEAD was right on", () => {
    expect(statementRows.filter((r) => r[4].join("|") === r[2].join("|") && model(r).join("|") !== r[2].join("|")).map((r) => r[0])).toEqual([]);
  });

  it.each(statementRows.map((r) => [r[0], r] as const))("pinned: %s", (_name, r) => {
    expect(model(r)).toEqual(r[3]);
  });
});

