import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { findCellOptionLines } from "../../src/core/qmd/model";

/**
 * Row-by-row pin of the cell-option comment-character table (`LANG_COMMENT_CHARS`,
 * `core/qmd/model.ts`), Session 299.
 *
 * Until S299 only 12 of its 46 rows then were pinned (measured: changing the opener of any of the
 * other 34 failed no unit test; the table has 47 rows since S300 added `mermaid`), so a one-row typo (`lua: ["--"]` to `["#"]`) passed every unit test while
 * quarto renders `{lua}` + `#| echo: banana` exit 0 — the typo lands as a false positive, the
 * cardinal sin. Re-typing the table into a test would only
 * copy the transcription error, so the expectation here is a MACHINE-EXTRACTED excerpt of
 * quarto's own resource (`test/fixtures/lang-comment-chars/quarto-1.7.33.json`, the key
 * `handlers/lang-comment-chars.yml` of the installed `yaml-intelligence-resources.json`), and
 * the oracle layer (`test/oracle/lang-comment-chars.oracle.test.ts`, opt-in, needs quarto) diffs
 * that fixture against the live install, so a drift from quarto is caught whenever it runs.
 *
 * Every row is exercised through the public `findCellOptionLines`, the way the product reads a
 * cell: the table is private, and a test of behaviour survives a refactor of it.
 */

/** A row as quarto stores it: a line comment is one string, a block comment `[open, close]`. */
type RawRow = string | [string, string];

const FIXTURE = path.join(__dirname, "../fixtures/lang-comment-chars/quarto-1.7.33.json");
const QUARTO_ROW_COUNT = 47;

const rows = Object.entries(JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, RawRow>).map(
  ([lang, raw]) => {
    const chars = typeof raw === "string" ? [raw] : raw;
    return { lang, open: chars[0], close: chars[1] ?? null };
  },
);

/**
 * Quarto's cell recognizer captures the language as `([=A-Za-z]+)`: a token holding a digit
 * (`d3`, `fortran95`) is never a cell, so those two rows can never be reached.
 */
const isCellToken = (lang: string): boolean => /^[=A-Za-z]+$/.test(lang);

const modelled = rows.filter((r) => isCellToken(r.lang));
const blockRows = modelled.filter((r) => r.close !== null);

/** `it.each` rows as tuples, so `%s` titles read `{lua}: `--|`` and not vitest's quoted form. */
const tuples = (rs: typeof rows) => rs.map((r) => [r.lang, r.open, r.close] as const);

/** `<open>| echo: banana`, plus the closer a block-comment language requires. */
function directive(open: string, close: string | null): string {
  return `${open}| echo: banana` + (close === null ? "" : ` ${close}`);
}

/** The one option line `directive(open, ...)` must yield in `{lang}`: its slots do not depend on the closer. */
function expectedOptionLine(lang: string, open: string) {
  const keyStart = open.length + 2; // the opener, the pipe, one space
  const valueStart = keyStart + "echo: ".length;
  return {
    line: 1,
    cellStartLine: 0,
    cellLang: lang,
    prefix: `${open}|`,
    contentEndCol: valueStart + "banana".length,
    keySlot: { startCol: keyStart, endCol: keyStart + "echo".length },
    valueSlot: { startCol: valueStart, endCol: valueStart + "banana".length },
  };
}

/** A one-cell document whose first body line is `line`. */
function cell(lang: string, line: string): string {
  return ["```{" + lang + "}", line, "x", "```"].join("\n");
}

describe("LANG_COMMENT_CHARS — every row of quarto's own table (S299)", () => {
  it("the fixture is the whole of quarto's table", () => {
    // A guard on the fixture itself: dropping a row from it would silently shrink this pin.
    expect(rows).toHaveLength(QUARTO_ROW_COUNT);
  });

  it.each(tuples(modelled))("{%s}: `%s|` opens a cell option", (lang, open, close) => {
    expect(findCellOptionLines(cell(lang, directive(open, close)))).toEqual([expectedOptionLine(lang, open)]);
  });

  it.each(tuples(modelled))("{%s}: another language's opener (not `%s|`) is no cell option", (lang, open, close) => {
    // The cardinal-sin direction: quarto renders each of these exit 0, so flagging one squiggles
    // a document quarto accepts.
    const foreign = open === "#" ? "//" : "#";
    expect(findCellOptionLines(cell(lang, directive(foreign, close)))).toEqual([]);
  });

  it.each(tuples(blockRows))("{%s}: a `%s|` line without its closer is no cell option", (lang, open) => {
    expect(findCellOptionLines(cell(lang, directive(open, null)))).toEqual([]);
  });

  it.each(tuples(blockRows))("{%s}: a `%s|` line needs no space before its closer", (lang, open, close) => {
    // Quarto tests `line.trimEnd().endsWith(closer)`, so `/*| echo: banana*/` is a directive. A row
    // whose closer carried a leading space (` */`) passes the spaced spelling above and drops this one.
    expect(findCellOptionLines(cell(lang, `${open}| echo: banana${close}`))).toEqual([
      expectedOptionLine(lang, open),
    ]);
  });

  it.each(tuples(rows.filter((r) => !isCellToken(r.lang))))(
    "{%s}: a token holding a digit is no cell, so its `%s|` row is unreachable",
    (lang, open, close) => {
      expect(findCellOptionLines(cell(lang, directive(open, close)))).toEqual([]);
    },
  );

  // The pins above prove every quarto row is PRESENT and right; they cannot show the table holds no
  // OTHER row, and an extra row is the cardinal-sin direction (it reads `%%|` where quarto reads
  // `#|`, so it squiggles a document quarto accepts and drops a true positive). Added after the S300
  // review ran two such mutants (`Mermaid: ["%%"]`, `typst: ["//"]`) through all 380 tests of the four
  // files that pin the `mermaid` row, and both passed. Both samples are probed through the public API.
  it.each(tuples(modelled.filter((r) => r.open !== "#")))(
    "{%s}: its upper-case and capitalised spellings are unknown languages taking the `#` default (not `%s|`)",
    (lang, open, close) => {
      // Quarto does not fold case before the lookup: `{SQL}` (S161) and `{DOT}`/`{Dot}`/`{Mermaid}`
      // (S162) each take the `#` default and the ordinary cell schema, measured against 1.7.33.
      const variants = new Set([lang.toUpperCase(), lang[0].toUpperCase() + lang.slice(1)]);
      for (const variant of variants) {
        expect(
          rows.some((r) => r.lang === variant),
          `${variant} is itself a fixture row, so this test would be wrong`,
        ).toBe(false);
        expect(findCellOptionLines(cell(variant, directive("#", null))), `${variant} + #|`).toHaveLength(1);
        expect(findCellOptionLines(cell(variant, directive(open, close))), `${variant} + ${open}|`).toEqual([]);
      }
    },
  );

  it.each(["typst", "banana", "html"])("{%s}: a language quarto has no row for takes the `#` default", (lang) => {
    // `{banana}` was measured against 1.7.33 in S161; the other names go through the same lookup (an own
    // property of the table, else `#`). A guard that the sample is really absent from quarto's table:
    expect(rows.some((r) => r.lang === lang)).toBe(false);
    expect(findCellOptionLines(cell(lang, directive("#", null)))).toHaveLength(1);
    for (const other of ["//", "--", "%%", "%", "!"]) {
      expect(findCellOptionLines(cell(lang, directive(other, null))), `${lang} + ${other}|`).toEqual([]);
    }
  });
});
