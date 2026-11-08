import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { seededRandom } from "./regex-equivalence";

// Session 345, part P2: the documents `indexLabels`, `cellTargetContext` and `plainFrontMatter` are compared on (the old spelling against the live one). Four kinds, every one deterministic:
//   1. STRUCTURED: the PRODUCT of the slots of a document with one cell in it (the opener, with its indent and its list host; the option block; the body; the closer or none; what follows), so every combination of the
//      shapes that decide a label is drawn, and the product of the front-matter variants and the cells that read them.
//   2. SHAPES: every sequence of up to three lines out of an alphabet of the line shapes that matter (the front-matter fences, the engine keys, a heading with an id, the fences, the option lines, the channels).
//   3. SEEDED: whole documents composed from random segments (seed 345001), each then written with a line terminator, a prefix and sometimes cut short.
//   4. TRACKED: every `.qmd`, `.md` and `.Rmd` file of the repository (`git ls-files`).
// Each generator is a function that returns a fresh iterable, and the file that uses it floors how many texts it drew (Learning 929): a generator that silently drew nothing would otherwise pass every row.

export type Engine = undefined | "knitr" | "jupyter" | "markdown" | "julia" | "ambiguous";
/** Every value of the engine argument: omitted, the two the index reads, and the three it leaves alone. */
export const ENGINES: readonly Engine[] = [undefined, "knitr", "jupyter", "markdown", "julia", "ambiguous"];
export const BOM = String.fromCharCode(0xfeff);
/** CR, CRLF, LF, U+2028, U+2029 and a form feed: the line terminators a text may be written with (only the first two split a line). */
export const TERMINATORS: readonly string[] = ["\n", "\r\n", "\r", " ", " ", "\f"];
/** What may come before the first line: nothing, a byte order mark, blank lines, spaces, a tab and a line. */
export const PREFIXES: readonly string[] = ["", BOM, "\n", "  ", "\n\n   ", "\t\n", BOM + "\n"];

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// 1. STRUCTURED

interface Opener {
  /** The lines before the fence (a list item that hosts it). */
  before: string[];
  /** The fence line, indent included. */
  open: string;
  /** The indent of the fence, which the cell's own lines carry. */
  pad: string;
}
const OPENERS: readonly Opener[] = [
  { before: [], open: "```{python}", pad: "" },
  { before: [], open: "```{r}", pad: "" },
  { before: [], open: "```{r fig-hdr}", pad: "" },
  { before: [], open: "```{r tbl-hdr, echo=FALSE}", pad: "" },
  { before: [], open: "```{r sec-hdr}", pad: "" },
  { before: [], open: "```{ojs}", pad: "" },
  { before: [], open: "  ```{python}", pad: "  " },
  { before: [], open: "    ```{python}", pad: "    " },
  { before: ["- item", ""], open: "  ```{r fig-lh}", pad: "  " },
  { before: [], open: "```{python fig-pyhdr}", pad: "" },
  { before: ["1. item", ""], open: "   ```{python}", pad: "   " },
];

interface Options {
  lines: string[];
  /** `pad`: the lines carry the fence's indent; `col0`: they sit at column 0 whatever the fence's indent; `deep`: two spaces deeper than the fence. */
  at: "pad" | "col0" | "deep";
}
const OPTION_BLOCKS: readonly Options[] = [
  { lines: [], at: "pad" },
  { lines: ["#| label: fig-a"], at: "pad" },
  { lines: ["#| label: sec-b"], at: "pad" },
  { lines: ["#| label: eq-c"], at: "pad" },
  { lines: ["#| label: tbl-d", "#| eval: false"], at: "pad" },
  { lines: ["#| eval: false", "#| label: fig-e"], at: "pad" },
  { lines: ["#| include: false", "#| label: fig-f"], at: "pad" },
  { lines: ["#| fig-cap: |", "#|   label: fig-n", "#| label: fig-m"], at: "pad" },
  { lines: ["#| label: lst-g", "#| output: false"], at: "pad" },
  { lines: ["#| label: fig-j"], at: "col0" },
  { lines: ["#| label: fig-k"], at: "deep" },
  { lines: ["#| label: 'tbl-q'", "#| echo: false"], at: "pad" },
  { lines: ["#|   label: fig-o", "#| echo: false"], at: "pad" },
  { lines: ["#| # a comment", "#| echo: false"], at: "pad" },
];

const BODIES: readonly string[][] = [
  [],
  ["x = 1"],
  ["Markdown(x)"],
  ["print('{#fig-a}')"],
  ["```"],
  ["x = 1", "#| label: fig-late"],
  ["plot(1)", "source('f.R')"],
];

/** `pad` + closing fence, a closing fence at column 0, or no closer (an unterminated cell). */
const CLOSERS: readonly ((pad: string) => string[])[] = [(pad) => [pad + "```"], () => ["```"], () => []];

const TAILS: readonly string[] = [
  "",
  "\n![c](a.png){#fig-a}\n",
  "\n# H {#sec-b}\n",
  "\nSome text.\n\n---\nlabel: fig-z\n---\n\nMore.\n",
  "\n```{r}\n#| label: fig-t\nplot(1)\n```\n",
  "\nSee @fig-a and `r 1+1` inline.\n",
];

const PLAIN_FRONT = "---\ntitle: t\n---\n\n";

/** One document per combination of an opener, an option block, a body, a closer and a tail: 11 x 14 x 7 x 3 x 6 = 19,404. */
export function* structuredDocuments(): Generator<string> {
  for (const opener of OPENERS) {
    for (const block of OPTION_BLOCKS) {
      const optionPad = block.at === "pad" ? opener.pad : block.at === "col0" ? "" : opener.pad + "  ";
      for (const body of BODIES) {
        for (const close of CLOSERS) {
          for (const tail of TAILS) {
            const lines = [...opener.before, opener.open, ...block.lines.map((l) => optionPad + l), ...body.map((l) => opener.pad + l), ...close(opener.pad)];
            yield PLAIN_FRONT + lines.join("\n") + "\n" + tail;
          }
        }
      }
    }
  }
}

const FRONTS: readonly string[] = [
  "",
  "---\nengine: jupyter\n---\n\n",
  "---\nengine: knitr\n---\n\n",
  "---\ntitle: t\nengine: markdown\n---\n\n",
  '---\ntitle: "a\\x41"\n---\n\n',
  "---\nkeep-hidden: true\n---\n\n",
  BOM + "---\nengine: knitr\n---\n\n",
  "---\nengine: knitr\n",
  "\n---\nengine: jupyter\n---\n\n",
  "---\ntitle: 'It''s'\n---\n\n",
  "---\nformat:\n  html:\n    code-fold: true\nengine: jupyter\n---\n\n",
  "---\nengine: jupyter\n---\n\nText\n\n---\nkeep-hidden: true\n---\n\n",
];
const CELLS: readonly string[] = [
  "```{r}\n#| label: fig-a\n#| eval: false\nplot(1)\n```\n",
  "```{python}\n#| label: tbl-b\n#| include: false\nx\n```\n",
  "```{r fig-c}\nplot(1)\n```\n",
  "```{python}\n#| label: fig-d\nprint(1)\n```\n",
  "```{r}\n#| label: sec-e\n```\n",
  "```{python}\n#| label: fig-f\nMarkdown(x)\n```\n",
];
/** One document per combination of a front-matter variant, a cell and a tail: 12 x 6 x 6 = 432. */
export function* frontMatterDocuments(): Generator<string> {
  for (const front of FRONTS) {
    for (const cell of CELLS) {
      for (const tail of TAILS) {
        yield front + cell + tail;
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// 2. SHAPES

const SHAPES: readonly string[] = [
  "---",
  "...",
  "engine: knitr",
  "engine: jupyter",
  "keep-hidden: true",
  "title: 'x",
  "",
  "# H {#sec-a}",
  "```{python}",
  "```{r fig-h}",
  "```{r}",
  "```",
  "  ```{python}",
  "#| label: fig-a",
  "#| label: sec-b",
  "#| eval: false",
  "  #| label: eq-c",
  "Markdown(x)",
  "x = 1",
  "![c](a.png){#fig-p}",
  "::: {#tbl-q}",
  "<!-- c -->",
  "- item",
  "  ```{r}",
];
/** Every sequence of up to three of the line shapes, written with LF: 1 + 24 + 576 + 13,824 = 14,425. */
export function* shapeDocuments(): Generator<string> {
  yield "";
  for (const a of SHAPES) {
    yield a;
    for (const b of SHAPES) {
      yield a + "\n" + b;
      for (const c of SHAPES) {
        yield a + "\n" + b + "\n" + c;
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// 3. SEEDED

export const SEED = 345001;

/** A cell composed at random from the slots above, at the document's own indent. */
function randomCell(rand: () => number): string[] {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
  const opener = pick(OPENERS);
  const block = pick(OPTION_BLOCKS);
  const optionPad = block.at === "pad" ? opener.pad : block.at === "col0" ? "" : opener.pad + "  ";
  const body = pick(BODIES);
  const close = pick(CLOSERS);
  return [...opener.before, opener.open, ...block.lines.map((l) => optionPad + l), ...body.map((l) => opener.pad + l), ...close(opener.pad)];
}

/** `count` whole documents, each of up to a few dozen lines, composed from the seed `SEED`; written with a terminator, a prefix and sometimes cut short. */
export function* seededDocuments(count: number): Generator<string> {
  const rand = seededRandom(SEED);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
  const prose = ["Some prose.", "See @fig-a and @tbl-b.", "![Cap](a.png){#fig-p}", "![Cap](a.png){#fig-q key=v}", "{#tbl-s}", "$$ x $$ {#eq-m}", "::: {#lst-d .callout}", ":::", "`r 1 + 1` inline", "{{< include a.qmd >}}", "<!-- {#fig-hidden} -->", "- item {#sec-li}", "> quote {#fig-bq}", ""];
  const headings = ["# One {#sec-one}", "## Two", "## Three {#sec-three .unnumbered}", "### Four {#fig-notsec}", "Title\n=====", "# Plain heading"];
  const fenced = ["```python", "x = 1", "```", "~~~", "text {#fig-tilde}", "~~~", "```{#lst-x .python}", "y = 2", "```"];
  for (let n = 0; n < count; n++) {
    const lines: string[] = [];
    lines.push(...pick(FRONTS).split("\n").slice(0, -1));
    const blocks = 1 + Math.floor(rand() * 8);
    for (let i = 0; i < blocks; i++) {
      const roll = rand();
      if (roll < 0.45) {
        lines.push("", ...randomCell(rand));
      } else if (roll < 0.6) {
        lines.push("", pick(headings));
      } else if (roll < 0.85) {
        lines.push("", pick(prose));
      } else if (roll < 0.92) {
        lines.push("", ...fenced);
      } else {
        lines.push("", "---", "label: fig-z", "---", "");
      }
    }
    const terminator = TERMINATORS[n % TERMINATORS.length];
    const prefix = PREFIXES[Math.floor(n / TERMINATORS.length) % PREFIXES.length];
    let text = prefix + lines.join(terminator);
    // every fifth document is cut short, anywhere, so a block is left unterminated
    if (n % 5 === 4) {
      text = text.slice(0, Math.floor(rand() * (text.length + 1)));
    }
    yield text;
  }
}

/** `texts` written with each terminator, behind each prefix: the matrix of the line endings and of what may come first. */
export function* writtenEveryWay(texts: readonly string[]): Generator<string> {
  for (const text of texts) {
    const lines = text.split("\n");
    for (const terminator of TERMINATORS) {
      for (const prefix of PREFIXES) {
        yield prefix + lines.join(terminator);
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// 4. TRACKED

/** Every tracked `.qmd`, `.md` and `.Rmd` file of the repository, as `[path, text]`. */
export function trackedDocuments(): Array<[string, string]> {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const listed = execFileSync("git", ["ls-files", "-z", "--", "*.qmd", "*.md", "*.Rmd"], { cwd: root, encoding: "utf8", maxBuffer: 1 << 24 });
  return listed
    .split("\0")
    .filter((path) => path !== "")
    .map((path): [string, string] => [path, readFileSync(resolve(root, path), "utf8")]);
}
