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
  // ⚠ That one-line rule holds for printing and QUIET chunks only (this row, and every P/Q row below). An ECHOED chunk below ends a region at its own bare closer (its opening fence has an
  // info string and cannot close one), so with an echoed chunk above the last printing chunk the rule over-hides (the test critic's C1: 26 of the 81 fixture rows with a printing chunk).
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

  // `results = "hold"` and `results = "markup"` leave the printed text where it was (rendered, c003, c012), but the string is masked before the option is judged, so the first cut
  // read them as unreadable and declined (the test critic's C3: the branch was dead code).
  it("a setup call that sets `results = \"hold\"` leaves the printed text alone (c003)", () => {
    expect(stm(["print(summary(x))"], { header: "{r}", pre: [...SETUP('knitr::opts_chunk$set(echo = FALSE, results = "hold")'), ...PRE] })).toEqual(PRINTS);
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
  // quiet (y001-y116); the 36 look-alikes (q001-q040, five numbers absent) were never candidates: 31 print nothing (`plot`, `hist`, `invisible`, `set.seed`, an assignment, ...) and 5 DO print
  // (`NULL`, `message()`, `warning()`, `Sys.setlocale()`, `dev.off()`; the model reads the two stderr ones since the message rows below, and is right).
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
  // `[grid/name, document, quarto's headings, this model's headings when the fixture was written, HEAD's (Session 308)]`, 410 documents from five grids (`scratchpad/s309/stm`,
  // `fn`, `msg`, `nm`, `ko`, untracked; generators in `tools/knitr-print-grids/`). The HEAD column is STORED DATA (the code of Session 308 is not in this tree), so the two assertions that
  // read it are fixture self-checks, not a live comparison.: see the fixture's own `note`. PASSING ON ARRIVAL, disclosed: written after the rules above, and pinned CLOSED-WORLD (Learning 685), so a rule that starts
  // or stops hiding a heading on any row fails here until the fixture is regenerated on purpose.
  type StatementRow = [string, string, string[], string[], string[]];
  const FIXTURE = path.join(__dirname, "../fixtures/knitr-print-statements/quarto-1.7.33.json");
  const statementRows = (JSON.parse(readFileSync(FIXTURE, "utf8")) as { rows: StatementRow[] }).rows;
  const model = (r: StatementRow): string[] => findHeadings(r[1], "knitr").map((h) => h.text);

  it("covers the whole fixture: 410 documents", () => {
    expect(statementRows).toHaveLength(410);
  });

  it("agrees with quarto on 342 of them (HEAD, Session 308, agreed on 98)", () => {
    expect(statementRows.filter((r) => model(r).join("|") === r[2].join("|"))).toHaveLength(342);
    expect(statementRows.filter((r) => r[4].join("|") === r[2].join("|"))).toHaveLength(98);
  });

  // THE PROPERTY THIS SESSION EXISTS TO KEEP: a wrong "prints" hides a heading quarto renders. Four documents lose a heading, and HEAD loses the same four, but NOT because the model calls
  // a quiet chunk a print: all four print, quarto hides `Between` exactly as the model does, and with `collapse` knitr writes the printed lines (`## Min. 1st Qu. ...`, `## 1 2 3 3 4 5`)
  // OUTSIDE any fence, where a line that begins `## ` is a HEADING that quarto lists and the source does not hold. The model cannot know them (stm c005 `collapse` and `comment = NA`,
  // o012, p012 and ko o16 are the same). The exemption is by id, so a real regression on these four would pass it: their pinned rows are what catches one.
  it("loses a heading quarto lists only on the four `collapse` documents whose printed lines are headings, which HEAD loses too", () => {
    const hiding = statementRows.filter((r) => r[2].some((t) => !model(r).includes(t))).map((r) => r[0]);
    expect(hiding).toEqual(["stm/s_c005", "stm/s_o012", "stm/s_p012", "ko/s_o16_collapse"]);
    expect(statementRows.filter((r) => r[2].some((t) => !r[4].includes(t))).map((r) => r[0])).toEqual(hiding);
  });

  it("is right on every document HEAD was right on", () => {
    expect(statementRows.filter((r) => r[4].join("|") === r[2].join("|") && model(r).join("|") !== r[2].join("|")).map((r) => r[0])).toEqual([]);
  });

  it.each(statementRows.map((r) => [r[0], r] as const))("pinned: %s", (_name, r) => {
    expect(model(r)).toEqual(r[3]);
  });
});

describe("Session 309 — a BARE NAME and `print(name)` print when the name holds text", () => {
  // MEASURED (`scratchpad/s309/nm`, untracked): 43 documents in the statement layout, one chunk under test whose statement is a bare name or `print(name)`, the name assigned in the
  // setup chunk above. A bare name always evaluates visibly, so it prints text unless the object is one knitr or a package renders another way (a `kable()` table, a plot, an
  // htmlwidget, a class with a `knit_print` method): the model therefore needs to know HOW the name was assigned, from the code above it.
  const NAME_PRE = (...code: string[]): string[] => ["```{r setup0, include=FALSE}", "x <- c(3, 1, 2, 5, 4)", "g <- factor(c('a','b','a','b','a'))", "df <- cars", ...code, "```", ""];
  const nm = (code: string[], pre: string[], o: { header?: string; front?: string[] } = {}): string[] =>
    outline(["---", 'title: "s"', ...(o.front ?? []), "---", "", ...pre, "# Top", "", "```", "", "## Between", "", `\`\`\`${o.header ?? "{r, echo=FALSE}"}`, ...code, "```", "", "## After", ""]);
  const PRINTS = ["Top", "After"];

  it("a vector assigned above, printed by its name (n001)", () => {
    expect(nm(["v"], NAME_PRE("v <- c(1, 2)"))).toEqual(PRINTS);
  });

  const QUIET = ["Top", "Between", "After"];
  it("the same name reassigned to a `kable()` table INSIDE an `if` above: the value is a table now (n008)", () => {
    expect(nm(["v"], NAME_PRE("v <- c(1, 2)", "if (TRUE) v <- knitr::kable(df)"))).toEqual(QUIET);
  });

  it("`class(v) <- \"knit_asis\"` above makes knitr write the value as raw markdown, not a fenced block (n020)", () => {
    expect(nm(["v"], NAME_PRE("v <- c(1, 2)", 'class(v) <- "knit_asis"'))).toEqual(QUIET);
  });
});

describe("Session 309 — the new passes read a pathological chunk in linear time", () => {
  // Timed firsthand (Learning 717): HEAD reads these in 340 ms and 46 ms, this build in about 900 ms and 550 ms (one parse per chunk body, memoized; the first cut parsed each chunk three
  // times and took 1.3 s). The bound is LOOSE on purpose, because the suite runs these beside 70 other files: what it must catch is a reader that is not linear (a quadratic one takes
  // minutes at these sizes), and a real document reads in milliseconds.
  const timed = (code: string[]): { names: string[]; ms: number } => {
    const text = ["---", "title: t", "---", "", "```{r setup0, include=FALSE}", "x <- 1", "```", "", "# Top", "", "```", "", "## Between", "", ...code, "", "## After", ""].join("\n");
    const before = performance.now();
    const names = findHeadings(text, "knitr").map((h) => h.text);
    return { names, ms: performance.now() - before };
  };
  it("a silenced chunk of a million `summary(x);` statements on ONE line", () => {
    const { names, ms } = timed(["```{r, echo=FALSE}", "summary(x); ".repeat(1000000), "```"]);
    expect(ms).toBeLessThan(4000);
    expect(names).toEqual(["Top", "After"]);
  });
  // The test critic's find (Session 309 review): the `options(` check scanned to the end of the line for a `)` at EVERY `options(`, so N unclosed calls cost N squared (40,000: 6 s).
  it("a silenced chunk whose one line holds 40,000 unclosed `options(` calls", () => {
    const { names, ms } = timed(["```{r, echo=FALSE}", "options(".repeat(40000), "summary(x)", "```"]);
    expect(ms).toBeLessThan(3000);
    expect(names).toEqual(["Top", "Between", "After"]);
  });
  it("a silenced chunk of 300,000 assignment lines", () => {
    const { names, ms } = timed(["```{r, echo=FALSE}", ...Array.from({ length: 300000 }, (_, i) => `v${i} <- ${i}`), "summary(x)", "```"]);
    expect(ms).toBeLessThan(4000);
    expect(names).toEqual(["Top", "After"]);
  });
});

describe("Session 309 — what the blind round B found", () => {
  // Round B: 150 fresh blind documents (`scratchpad/s309/round-b`, untracked), each with one stray fence, rendered with quarto 1.7.33 in the executing mode (and `--no-execute`).
  // The ids are theirs. Every row is the document as the author wrote it, and its answer is what quarto rendered.
  const doc = (...lines: string[]): string[] => findHeadings(lines.join("\n"), "knitr").map((h) => h.text);

  // A chunk with a `child=` option emits the CHILD DOCUMENT's own output, whose fences this scan cannot see (the child here prints, stays quiet, echoes). A call default makes the
  // chunk silent in the executing mode, and silent chunks are skipped: the first cut of Session 309 deleted `Combined Totals` here (hostile_18; the front matter's default did the same
  // before this session).
  // The model cannot read the child files, so it answers the SAFE side: quarto swallows `Quiet Child` and `Echoed Child` (the child that prints and the child that echoes pair with the
  // stray fence), and the model still lists them (a PHANTOM, pinned), but `Combined Totals`, which quarto shows, is never hidden.
  it("a `child=` chunk is never assumed silent: `Combined Totals` is shown, `Quiet Child` and `Echoed Child` stay phantoms (hostile_18)", () => {
    expect(doc(...["---", "title: \"Assembling a Report From Child Documents\"", "format: html", "---", "", "```{r setup, include=FALSE}", "knitr::opts_chunk$set(echo = FALSE, comment = NA)", "```", "", "# Child Documents", "", "A long report is easier to maintain when its parts live in separate files.", "", "## Why Split", "", "Each part can be edited and tested alone.", "", "## Printing Child", "", "The first child prints a summary of the `women` data.", "", "```", "", "```{r, child=\"_child_print.Rmd\"}", "```", "", "## Quiet Child", "", "```{r, child=\"_child_quiet.Rmd\"}", "```", "", "## Echoed Child", "", "```{r, child=\"_child_echo.Rmd\"}", "```", "", "## Combined Totals", "", "```{r}", "cat(\"Total height:\", child_total, \"\\n\")", "```", "", "## Closing", "", "The parts have been assembled.", ""])).toEqual(["Child Documents", "Why Split", "Printing Child", "Quiet Child", "Echoed Child", "Combined Totals", "Closing"]);
  });
});
