import { describe, expect, it } from "vitest";
import { BIBLIOGRAPHY_ITEM_LINE } from "../../src/core/frontmatter";
import { cutHashComment } from "../../src/core/hash-comment";
import { SEQUENCE_ITEM_LINE } from "../../src/core/preview-format";
import { KEY_LINE } from "../../src/core/qmd/jupyter-kernel";
import { INDENTED_LINE } from "../../src/core/yaml-context";
import { isWrongValue } from "../../src/core/yaml-value-check";
import {
  ATX_CLOSING,
  ATX_HEADING,
  ATX_HEADING_TIGHT,
  DIV_FENCE,
  KNITR_ECHO_INCLUDE_LINE,
  LINK_DEFINITION_LINE,
  PIPE_DELIMITER_ROW,
  PLAIN_ITEM_LINE,
  PLAIN_KEY_LINE,
  PROOF_KEY_LINE,
  TABLE_RULE_ROW,
  TOP_LEVEL_ANCHOR_DECL,
  cellOptionPrefixFor,
} from "../../src/core/qmd/model";
import { BOM, EM_SPACE, IDEOGRAPHIC, LS, NBSP, NEL, PS, compare, countStrings, everyString, seededRandom, slowestExec } from "./support/regex-equivalence";

// Session 319 — the BACKLOG item "Other regexes still quadratic on a long run of blanks, CR or U+2028", parts (5) and (9). A pattern that reads a run of blanks and then `(.*)$` (or `(.+)$`) fails on a line
// holding a CR, U+2028 or U+2029 after the run, because `.` stops there, and the engine used to find that out once per way of splitting the run: it gave the blanks back one at a time and the tail re-read
// what was given back (quadratic: 100,000 blanks then CR took 6 s in one `exec`; `pathological-inputs.test.ts` has the documents). Each site below now ends its run in a lookahead (or, where the tail
// can match a blank-only rest by taking blanks back, asks once up front that the line holds no terminator). The cure is only sound if the new pattern answers what the old one answered on EVERY line, GROUPS
// INCLUDED (the callers read them, and an unset group is not an empty one), so the old spelling is kept here as the oracle (Learning 738). Learning 779: the lookahead idiom is an argument per site, never a copy.

interface Site {
  /** The pattern as Session 318 left it: the oracle. It must hold no copy of the guard. */
  old: RegExp;
  now: RegExp;
  /** Text the new source holds and the old one does not. */
  guard: string;
  /** The characters of the site's own grammar; every alphabet below is built from them. */
  marks: readonly string[];
  /** Beginnings that reach the blank run: each is accepted when followed by a blank run and then a letter. */
  heads: readonly string[];
  /** The blanks the run reads, the commonest first. */
  blanks: readonly string[];
  /** Indents the pattern also accepts in front of a head ("" is always tried). */
  indents: readonly string[];
  /** The longest string of the first enumeration (its alphabet is the marks, a blank, a tab, a CR, U+2028 and a letter). */
  shortLength: number;
  /** False when a long indent is refused (` {0,3}`), so a line that starts with one is not an ACCEPTED line. */
  longIndent?: boolean;
  /** What may follow the head and a long blank run on a line the pattern accepts (default: nothing, a letter, words, a long word). */
  acceptedTails?: readonly string[];
  /** The tails of the seeded sample and the grid (default `TAILS`). */
  tails?: readonly string[];
  /** How long the near-miss lines are when the OLD spelling answers them (default 1,000): a pattern with a quadratic KEY costs the oracle 20 ms a line there. */
  smallLength?: number;
  /** Lines of `n` characters that are slow for a reason the shapes below do not cover (a quadratic with no terminator in it, say). */
  extraLines?: (n: number) => string[];
  /** Characters just outside the site's grammar (a key's `_` and capital, a name's comma, a marker's star): added to every enumeration, so a class edited to drop or admit one is seen. */
  foils?: readonly string[];
  /** Lines the pattern ACCEPTS with a run or a token of `n` characters somewhere other than the first blank run (a long key, a gap before the colon): a cap on any run the other lines do not reach is seen. */
  acceptedLines?: (n: number) => string[];
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The cell-option prefix as Session 318 left it: the gap after the pipe is not guarded. */
const oldCellOptionPrefix = (open: string): RegExp => new RegExp("^(" + escapeRegExp(open) + ")([ \\t]*)\\|([ \\t]*)(.*)$");
const cellOptionSite = (open: string): Site => ({
  old: oldCellOptionPrefix(open),
  now: cellOptionPrefixFor({ open, close: null }),
  guard: "(?![ \\t])",
  marks: [open, "|"],
  heads: [`${open}|`, `${open} |`, `${open}\t|`],
  blanks: [" ", "\t"],
  indents: [],
  shortLength: 7,
  acceptedLines: (n) => [`${open}${" ".repeat(n)}| x`, `${open}${"\t".repeat(n)}|x`, `${open}|${" ".repeat(n)}x`],
});

/** A run of seven or more `#` is no heading (the Outline caps at six): both readers must refuse these, and neither is a head any other row builds (a head is accepted by definition). */
const sevenHashes = (n: number): string[] => ["#######", "####### x", "#######x", "#######  ", `#######${" ".repeat(n)}x`, `${"#".repeat(n)} x`, `${"#".repeat(n)}x`];

// ⚠ APPEND a new site at the END: each site's seeded sample is seeded with 319 plus its position here, so an entry put in the middle moves every later site's seed and its pinned `seeded` count
// (Session 320 put TABLE_RULE_ROW mid-table first and five later sites failed their seeded rows).
const SITES: Record<string, Site> = {
  DIV_FENCE: { old: /^[ \t]*:{3,}(?!:)[ \t]*(.*)$/, now: DIV_FENCE, guard: "(?![ \\t])", marks: [":"], heads: [":::", "::::", ":::::"], blanks: [" ", "\t"], indents: [" ", "   ", "    ", "\t"], shortLength: 7, acceptedLines: (n) => [":".repeat(n), `${":".repeat(n)} x`] },
  ATX_HEADING: { old: /^[ \t]*(#{1,6})[ \t]+(.+)$/, now: ATX_HEADING, guard: "(?=[ \\t].*$)", marks: ["#"], heads: ["#", "##", "######"], blanks: [" ", "\t"], indents: [" ", "   ", "    ", "\t"], shortLength: 7, extraLines: sevenHashes },
  ATX_HEADING_TIGHT: { old: /^[ \t]*(#{1,6})(?!#)[ \t]*(.+)$/, now: ATX_HEADING_TIGHT, guard: "(?=.*$)", marks: ["#"], heads: ["#", "##", "######"], blanks: [" ", "\t"], indents: [" ", "   ", "    ", "\t"], shortLength: 7, extraLines: sevenHashes },
  PROOF_KEY_LINE: { old: /^([A-Za-z0-9_][A-Za-z0-9_.-]*):(?:[ \t]+(.*))?$/, now: PROOF_KEY_LINE, guard: "(?![ \\t])", marks: ["k", ":"], foils: ["_", "A", "9", "."], heads: ["k:", "key:", "a.b-c:", "k1:"], blanks: [" ", "\t"], indents: [], shortLength: 6, acceptedLines: (n) => [`${"k".repeat(n)}:`, `${"a.b-".repeat(Math.floor(n / 4))}: x`, `${"_".repeat(n)}: x`, `A${"9".repeat(n)}: x`] },
  PLAIN_KEY_LINE: { old: /^( *)(- +)?([A-Za-z_][A-Za-z0-9_.-]*) *:(?: +(.*))?$/, now: PLAIN_KEY_LINE, guard: "(?! )", marks: ["k", ":", "-"], foils: ["_", "A", "9", "."], heads: ["k:", "- k:", "key.a-b:"], blanks: [" "], indents: [" ", "   ", "    "], shortLength: 6, acceptedLines: (n) => [`${"k".repeat(n)}: x`, `k${" ".repeat(n)}: x`, `-${" ".repeat(n)}k: x`, `${" ".repeat(n)}- k: x`, `_${"A9.-".repeat(Math.floor(n / 4))}: x`] },
  PLAIN_ITEM_LINE: { old: /^( *)- +(.*)$/, now: PLAIN_ITEM_LINE, guard: "(?! )", marks: ["-"], heads: ["-"], blanks: [" "], indents: [" ", "   ", "    "], shortLength: 7, acceptedLines: (n) => [`- ${"x".repeat(n)}`] },
  KNITR_ECHO_INCLUDE_LINE: { old: /^(echo|include):[ \t]*(.*)$/, now: KNITR_ECHO_INCLUDE_LINE, guard: "(?![ \\t])", marks: ["echo:", "include:"], foils: ["ECHO:", "exclude:", "echo="], heads: ["echo:", "include:"], blanks: [" ", "\t"], indents: [], shortLength: 6, acceptedLines: (n) => [`echo: ${"x".repeat(n)}`, `include:${" ".repeat(n)}false`] },
  LINK_DEFINITION_LINE: { old: /^ {0,3}\[[^\^\]][^\]]*\]:[ \t]*(.*)$/, now: LINK_DEFINITION_LINE, guard: "(?![ \\t])", marks: ["[", "]", ":", "^"], heads: ["[a]:", "[ab c]:", "[1]:"], blanks: [" ", "\t"], indents: [" ", "  ", "   ", "    "], shortLength: 7, longIndent: false, acceptedLines: (n) => [`[${"a".repeat(n)}]: /u`, `[${"a b ".repeat(Math.floor(n / 4))}]: /u`, `[a]: ${"/u".repeat(Math.floor(n / 2))}`] },
  "CELL_OPTION_PREFIX #": cellOptionSite("#"),
  "CELL_OPTION_PREFIX //": cellOptionSite("//"),
  "CELL_OPTION_PREFIX (*": cellOptionSite("(*"),
  PIPE_DELIMITER_ROW: {
    old: /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/,
    now: PIPE_DELIMITER_ROW,
    guard: "(?:[ \\t]*\\|)?[ \\t]*$",
    marks: ["|", "-", ":"],
    heads: ["-", "|-", ":-:", "|--"],
    blanks: [" ", "\t"],
    indents: [" ", "  ", "   ", "    "],
    shortLength: 6,
    longIndent: false,
    acceptedTails: ["", "|", "|-", " | - |", " |:-|"], // a cell straight after the blanks is no cell: the pipe between cells is what the pattern asks for
    tails: ["", "-", "|", " | - ", ":-:", "x", "\r", LS, PS, " \r", "-\r", "-|\r", "|-", "-x"],
    foils: ["*", "=", "+"],
    // A long run AFTER a pipe and then a wrong character (`-|` and blanks and a letter), which none of the head-and-run shapes build, and long cells and cell counts the pattern accepts. The dash run of a
    // LATER cell is one of them (`-|`, dashes, a letter): a respelling that splits that run in two is the same language and quadratic, and only this line times it (Session 320 review).
    extraLines: (n) => [`-|${" ".repeat(n)}x`, `|-|${" ".repeat(n)}x`, `-|${" ".repeat(n)}-`, `|:-:|${" ".repeat(n)}-|${" ".repeat(n)}x`, `|${"- ".repeat(Math.floor(n / 2))}x`, `-|${"-".repeat(n)}x`, `|-|${"-".repeat(n)}x`],
    acceptedLines: (n) => ["-".repeat(n), `|${" ".repeat(n)}-`, `|-|${" ".repeat(n)}-`, `-${" ".repeat(n)}|${" ".repeat(n)}-`, `${"-|".repeat(Math.floor(n / 2))}-`, `|${"-|".repeat(Math.floor(n / 2))}`, `   |${" ".repeat(n)}:-:${" ".repeat(n)}|`],
  },
  // `\s` takes a CR, U+2028 and U+2029 as blanks, so a terminator RIGHT after the run is part of it; the slow line has the terminator after a word (`near-miss` shapes 3 and 5).
  BIBLIOGRAPHY_ITEM_LINE: { old: /^\s*-\s+(.*)$/, now: BIBLIOGRAPHY_ITEM_LINE, guard: "(?!\\s)", marks: ["-"], foils: ["*", "+"], heads: ["-"], blanks: [" ", "\t", NBSP, "\v", IDEOGRAPHIC], indents: [" ", "  ", "\t"], shortLength: 7 },
  SEQUENCE_ITEM_LINE: { old: /^-[ \t]+(.*)$/, now: SEQUENCE_ITEM_LINE, guard: "(?![ \\t])", marks: ["-"], foils: ["*", "+"], heads: ["-"], blanks: [" ", "\t"], indents: [], shortLength: 7 },
  JUPYTER_KEY_LINE: {
    old: /^[ \t]*(?:-[ \t]+)*(?:"[^"\\]*"|'[^']*'|[A-Za-z0-9_](?:[A-Za-z0-9_. -]*[A-Za-z0-9_.-])?)[ \t]*:(?:[ \t]+(.*)|)$/,
    now: KEY_LINE,
    guard: "(?![ \\t])",
    marks: ["k", ":", "-", '"', "'"],
    heads: ["k:", "- k:", '"k":', "'k':", "a b:", "k.1 :"],
    blanks: [" ", "\t"],
    indents: [" ", "  ", "\t"],
    shortLength: 6,
    foils: ["_", "9", "\\"],
    acceptedLines: (n) => [`${"k".repeat(n)}: x`, `k${" ".repeat(n)}: x`, `${"- ".repeat(Math.floor(n / 2))}k: x`, `"${"k".repeat(n)}": x`, `'${"k".repeat(n)}': x`, `${"a ".repeat(Math.floor(n / 2))}b: x`],
  },
  INDENTED_LINE: { old: /^([ \t]+)(.*)$/, now: INDENTED_LINE, guard: "(?![ \\t])", marks: ["-"], heads: [""], blanks: [" ", "\t"], indents: [], shortLength: 8 },
  // Two quadratics in one pattern: the tail (as above) and the KEY, which needs no terminator (`extraLines`: a key and blanks and no colon, blanks before the colon, blanks inside a quote).
  TOP_LEVEL_ANCHOR_DECL: {
    old: /^(["']?)[^:]*\1[ \t]*:[ \t]*&([^\s,[\]{}]+)[ \t]+(.*)$/,
    now: TOP_LEVEL_ANCHOR_DECL,
    guard: "(?![ \\t])",
    marks: ['"', "'", ":", "&"],
    heads: ["k: &a", '"k": &a', "'k':&a", ": &a", "a b : &name"],
    blanks: [" ", "\t"],
    indents: [" ", "\t"],
    shortLength: 6,
    smallLength: 200,
    foils: [",", "[", "}"],
    acceptedLines: (n) => [`k: &${"a".repeat(n)} x`, `k:${" ".repeat(n)}&a x`, `k${" ".repeat(n)}: &a x`, `"${"k".repeat(n)}": &a x`, `${"k".repeat(n)}: &a x`],
    extraLines: (n) => [
      `kx${" ".repeat(n)}`,
      `kx${"\t".repeat(n)}`,
      `k${" ".repeat(n)}: x`,
      `"k"${" ".repeat(n)}: x`,
      `"${" ".repeat(n)}x"${" ".repeat(n)}: x`,
      `"${" ".repeat(n)}`,
      `'${" ".repeat(n)}x'${" ".repeat(n)}`,
      `${" ".repeat(n)}: x`,
      `"k"${" ".repeat(n)}: &${"a".repeat(10)}`,
    ],
  },
  // Session 320, part (4). TWO quadratics in one pattern, and neither needs a terminator: the pipe body's last cell ends in `[ \t]*`, an optional pipe and then the shared `\s*`, so a blank run after the
  // last cell is split between the two runs for ANY character that ends the match (`-`, 32,000 blanks, a letter: 617 ms); and the grid body's `[-+=: ]*` and `\s*` share the space the same way (`+`, blanks, a
  // letter). The pipe body takes `PIPE_DELIMITER_ROW`'s spelling (each blank run in front of the pipe it belongs to); the grid body asks for its last non-space character before the shared `\s*`.
  TABLE_RULE_ROW: {
    old: /^ {0,3}(?:\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?|\+[-+=: ]*)\s*$/,
    now: TABLE_RULE_ROW,
    guard: "(?:[ \\t]*\\|)?",
    marks: ["|", "-", ":", "+", "="],
    foils: ["*"],
    heads: ["-", "|-", ":-:", "|--", "+", "+-", "+=", "+:"],
    blanks: [" ", "\t"],
    indents: [" ", "  ", "   ", "    "],
    shortLength: 6,
    longIndent: false,
    acceptedTails: [""], // a letter, a colon or a dash straight after the blanks ends both bodies (a cell after blanks needs its pipe); a PIPE after the blanks is accepted by the pipe body, and `acceptedLines` has it
    tails: ["", "-", "|", " | - ", ":-:", "x", "\r", LS, PS, " \r", "-\r", "-|\r", "|-", "-x", "+", " +", "=", "\f", NBSP],
    extraLines: (n) => [
      `-:${" ".repeat(n)}x`,
      `-:${" ".repeat(n)}\rx`,
      `|${" ".repeat(n)}x`,
      `-|${" ".repeat(n)}x`,
      `-|${" ".repeat(n)}-`,
      `|:-:|${" ".repeat(n)}-|${" ".repeat(n)}x`,
      // The dash run of a LATER cell, then a letter: only these two time a respelling that splits that run in two (the same language, 8 s at 32,000 dashes; Session 320 review).
      `-|${"-".repeat(n)}x`,
      `|-|${"-".repeat(n)}x`,
      `+${" ".repeat(n)}-${" ".repeat(n)}x`,
      `+-${" ".repeat(n)}-${" ".repeat(n)}\rx`,
      `+${"- ".repeat(Math.floor(n / 2))}x`,
      `|${"-|".repeat(Math.floor(n / 2))}x`,
      `-${" |-".repeat(Math.floor(n / 3))}x`,
      `${"-".repeat(n)}x`,
      `+${"=".repeat(n)}x`,
    ],
    acceptedLines: (n) => [
      `-${" ".repeat(n)}`,
      `-${" ".repeat(n)}|`,
      `|${" ".repeat(n)}-`,
      `|-|${" ".repeat(n)}-`,
      `-${" ".repeat(n)}|${" ".repeat(n)}-`,
      `${"-|".repeat(Math.floor(n / 2))}-`,
      `|${"-|".repeat(Math.floor(n / 2))}`,
      `   |${" ".repeat(n)}:-:${" ".repeat(n)}|${" ".repeat(n)}`,
      `-${" ".repeat(n)}\f${" ".repeat(n)}`,
      `-${" ".repeat(n)}\r`,
      // A long DASH run in the pipe body (a cap on `-+` anywhere but the first cell is seen by the cell lines above; the first cell, the colons and a run after a pipe are these).
      "-".repeat(n),
      `:${"-".repeat(n)}:`,
      `|${"-".repeat(n)}|`,
      `-|${"-".repeat(n)}`,
      `+${" ".repeat(n)}`,
      `+${"-".repeat(n)}`,
      `+${"- ".repeat(Math.floor(n / 2))}`,
      `+${"=:".repeat(Math.floor(n / 2))} `,
      `+${" ".repeat(n)}-`,
      `+${" ".repeat(n)}-${" ".repeat(n)}`,
      `+-${" ".repeat(n)}+${" ".repeat(n)}\f`,
      `   +${"-+".repeat(Math.floor(n / 2))}`,
    ],
  },
  // Session 320, part (4). An UNANCHORED search whose pattern begins with `[ \t]+`: the engine tried it from every blank inside a run, so a heading with n blanks inside it cost n^2/2 and no hash
  // was needed (`x`, 32,000 blanks, `y`: 620 ms in one `exec`). The guard asks that the blank before the start is no blank, so only the start of a run is tried; the match is the same one (a match from the
  // middle of a run implies one from its start, which is further left), and `buildHeading` reads `text.replace(closing, "")`, so the INDEX of the match is part of the answer and `compare` checks it.
  ATX_CLOSING: {
    old: /(?:^|[ \t]+)#+[ \t]*$/,
    now: ATX_CLOSING,
    guard: "(?<![ \\t])",
    marks: ["#"],
    foils: ["\\"],
    heads: ["x", "#", "##", "x #", "x#", "x ##", " #"],
    blanks: [" ", "\t"],
    indents: [" ", "   ", "\t"],
    shortLength: 8,
    longIndent: false,
    acceptedTails: ["#", "##", " #", "# "], // a closing run is a hash run at the end: a letter after the blanks ends it
    extraLines: (n) => [
      " ".repeat(n),
      `${" ".repeat(n)}x`,
      `${"\t".repeat(n)}x`,
      `x${" ".repeat(n)}${"#".repeat(n)}${" ".repeat(n)}y`,
      `x${" ".repeat(n)}${"#".repeat(n)}`,
      `${"#".repeat(n)}${" ".repeat(n)}y`,
      `x ${"#".repeat(n)}y`,
      `${" #".repeat(Math.floor(n / 2))}y`,
      `${" #".repeat(Math.floor(n / 2))}`,
      `x${" ".repeat(Math.floor(n / 2))}\t${" ".repeat(Math.floor(n / 2))}y`,
    ],
    acceptedLines: (n) => [
      `x${" ".repeat(n)}#`,
      `x ${"#".repeat(n)}`,
      `x ${"#".repeat(n)}${" ".repeat(n)}`,
      `${" ".repeat(n)}#${" ".repeat(n)}`,
      `x${"\t".repeat(n)}#`,
      "#".repeat(n),
      `${"#".repeat(n)}${" ".repeat(n)}`,
      `x${" ".repeat(n)}${"#".repeat(n)}${" ".repeat(n)}`,
      `${" #".repeat(Math.floor(n / 2))}`,
      // A search is unanchored, so a line it ACCEPTS can hold a long run that fails before the match, and the OLD spelling is quadratic on that run (250 ms at 20,000, 995 ms at 40,000): the first run stops
      // at 5,000 so the oracle can answer this line at every size. The near-miss lines hold the long failing runs, and the clock row times them.
      `a${" ".repeat(Math.min(n, 5_000))}b${" ".repeat(n)}#`,
    ],
  },
};

// How many strings of each comparison the OLD spelling accepts, counted from the old spelling alone: no comparison below can pass by both sides refusing everything, and an edit to the oracle moves the count.
// The three enumerated counts were also taken with Python's `re` (`.` and `$` spelled out), so the oracle's answers do not rest on V8 alone (Learning 780 asks for a count from a reader that is not a regex; Python's engine is a second regex engine, which is as far as this goes).
const ACCEPTED: Record<string, { short: number; wide: number; exotic: number; seeded: number; grid: number }> = {
  DIV_FENCE: { short: 651, wide: 61, exotic: 115, seeded: 34268, grid: 2400 },
  ATX_HEADING: { short: 6792, wide: 852, exotic: 2304, seeded: 28562, grid: 2130 },
  ATX_HEADING_TIGHT: { short: 10548, wide: 2260, exotic: 9424, seeded: 33344, grid: 2340 },
  PROOF_KEY_LINE: { short: 27195, wide: 3705, exotic: 4665, seeded: 7429, grid: 584 },
  PLAIN_KEY_LINE: { short: 28876, wide: 3576, exotic: 4020, seeded: 18583, grid: 876 },
  PLAIN_ITEM_LINE: { short: 1818, wide: 310, exotic: 922, seeded: 18467, grid: 288 },
  KNITR_ECHO_INCLUDE_LINE: { short: 74898, wide: 22222, exotic: 61882, seeded: 8606, grid: 320 },
  LINK_DEFINITION_LINE: { short: 14574, wide: 253, exotic: 286, seeded: 21530, grid: 1920 },
  "CELL_OPTION_PREFIX #": { short: 6468, wide: 554, exotic: 1385, seeded: 8719, grid: 480 },
  "CELL_OPTION_PREFIX //": { short: 6468, wide: 554, exotic: 1385, seeded: 8572, grid: 480 },
  "CELL_OPTION_PREFIX (*": { short: 6468, wide: 554, exotic: 1385, seeded: 8582, grid: 480 },
  PIPE_DELIMITER_ROW: { short: 3695, wide: 995, exotic: 995, seeded: 12128, grid: 1466 },
  TABLE_RULE_ROW: { short: 25385, wide: 23341, exotic: 16270, seeded: 32842, grid: 6974 },
  ATX_CLOSING: { short: 448674, wide: 3981, exotic: 3981, seeded: 7510, grid: 944 },
  BIBLIOGRAPHY_ITEM_LINE: { short: 171156, wide: 31144, exotic: 26418, seeded: 60899, grid: 2240 },
  SEQUENCE_ITEM_LINE: { short: 18662, wide: 1170, exotic: 2928, seeded: 7387, grid: 144 },
  JUPYTER_KEY_LINE: { short: 49977, wide: 5744, exotic: 6692, seeded: 29662, grid: 3504 },
  INDENTED_LINE: { short: 43690, wide: 3110, exotic: 14762, seeded: 32881, grid: 144 },
  TOP_LEVEL_ANCHOR_DECL: { short: 5460, wide: 350, exotic: 468, seeded: 31183, grid: 2220 },
};

const TERMINATORS = ["\r", LS, PS] as const;
/** Lines the NEW spelling is timed on, how long one `exec` may take on them (a quadratic spelling takes seconds), and the sizes of the lines the OLD spelling accepts and the NEW one is compared on. */
const NEAR_MISS_CHARACTERS = 50_000;
const CLOCK_LIMIT_MS = 100;
const ACCEPTED_SIZES = [5_000, 50_000, 200_000] as const;
const SEEDED_LINES = 100_000;
/** The strip's pair-heavy texts and the terminators they use. */
const STRIP_PAIRS = 200_000;
const STRIP_TERMINATORS = ["\r", LS, PS, "\n"] as const;
const TAILS = ["", "x", "r", "x y", "{r}", "#", "x#", "\r", LS, PS, "x\r", " \r", "x ", "x\r "] as const;
const RUNS = [0, 1, 2, 3, 4, 31, 32, 33, 64, 100] as const;

const shortAlphabet = (site: Site): string[] => [...site.marks, ...(site.foils ?? []), " ", "\t", "\r", LS, "x"];
const wideAlphabet = (site: Site): string[] => [...site.marks, ...(site.foils ?? []), " ", "\t", "\r", "\n", LS, PS, "\f", NBSP, "x"];
const exoticAlphabet = (site: Site): string[] => [...site.marks, ...(site.foils ?? []), " ", "\t", "\v", BOM, IDEOGRAPHIC, EM_SPACE, NEL, "\r", "x"];

function* seededLines(site: Site, seed: number): Generator<string> {
  const random = seededRandom(seed);
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  for (let i = 0; i < SEEDED_LINES; i++) {
    let line = pick(["", "", " ", "  ", "\t", " \t", "   ", "    "]) + pick(site.heads);
    line += pick(["", " ", "  ", "\t", " \t ", "         ", " ".repeat(Math.floor(random() * 40))]);
    line += pick(site.tails ?? TAILS);
    if (random() < 0.4) line += pick(["\r", LS, PS, "\r\n", "\n"]);
    if (random() < 0.4) line += pick(["x", " ", "\t", pick(site.marks)]);
    yield line;
  }
}

function* gapGrid(site: Site): Generator<string> {
  for (const indent of ["", ...site.indents]) {
    for (const head of site.heads) {
      for (const run of RUNS) {
        for (const blank of site.blanks) {
          for (const tail of site.tails ?? TAILS) {
            yield `${indent}${head}${blank.repeat(run)}${tail}`;
          }
        }
      }
    }
  }
}

/** Lines of `n` characters that the pattern ACCEPTS (or refuses) and that make a backtracking engine re-read a long suffix. */
function nearMissLines(site: Site, n: number): string[] {
  const lines: string[] = [];
  for (const head of site.heads) {
    for (const terminator of ["", ...TERMINATORS]) {
      for (const blank of site.blanks) {
        const run = blank.repeat(n);
        lines.push(
          `${head}${run}${terminator}`,
          `${head}${run}${terminator}x`,
          `${head}${run}x${terminator}x`,
          `${head}${run}x`,
          `${head}${run}x${run}${terminator}`,
          `${head}${run}${terminator}${run}`,
          (head + blank).repeat(Math.floor(n / (head.length + 1))) + terminator,
        );
        for (const indent of site.indents) {
          lines.push(`${indent}${run}${head}${run}${terminator}`);
        }
        // A long run after each BEGINNING of the head, not only after all of it (`k` and blanks and a letter, `-` and blanks and a letter): a guard in the wrong place leaves the shorter beginnings slow.
        for (let cut = 1; cut < head.length; cut++) {
          lines.push(`${head.slice(0, cut)}${run}x`);
          if (terminator !== "") lines.push(`${head.slice(0, cut)}${run}${terminator}x`);
        }
      }
    }
  }
  return site.extraLines === undefined ? lines : [...lines, ...site.extraLines(n)];
}

function* longAcceptedLines(site: Site): Generator<string> {
  for (const n of ACCEPTED_SIZES) {
    for (const head of site.heads) {
      for (const blank of site.blanks) {
        for (const tail of site.acceptedTails ?? ["", "x", "x y", "r".repeat(n)]) {
          yield `${head}${blank.repeat(n)}${tail}`;
        }
        if (site.longIndent !== false) {
          for (const indent of site.indents) {
            yield `${indent}${blank.repeat(n)}${head}${blank}x`;
          }
        }
      }
    }
    if (site.acceptedLines !== undefined) {
      yield* site.acceptedLines(n);
    }
  }
}

describe("Session 319 — the blank-run patterns answer what their unguarded spellings answered", () => {
  const names = Object.keys(SITES);

  // The sizes, limits and terminators the rows below depend on. A row that was quietly weakened (a clock row run at 5,000 characters instead of 50,000, a terminator dropped from the list) would still pass.
  it("keeps the sizes, the clock limit and the terminators its rows are built on", () => {
    expect([...TERMINATORS]).toEqual(["\r", LS, PS]);
    expect([...STRIP_TERMINATORS]).toEqual(["\r", LS, PS, "\n"]);
    expect(NEAR_MISS_CHARACTERS).toBe(50_000);
    expect(CLOCK_LIMIT_MS).toBe(100);
    expect([...ACCEPTED_SIZES]).toEqual([5_000, 50_000, 200_000]);
    expect(STRIP_PAIRS).toBe(200_000);
    expect(SEEDED_LINES).toBe(100_000);
    // Each site's seeded sample is seeded with 319 plus its POSITION in SITES, so an entry put anywhere but the end moves every later site's seed and its pinned `seeded` count. Pin the order, so
    // that mistake fails here with a readable diff and not as five unrelated seeded rows (Session 320 made it once): a new site is an entry, five counts, and one name at the end of this list.
    expect(names).toEqual([
      "DIV_FENCE",
      "ATX_HEADING",
      "ATX_HEADING_TIGHT",
      "PROOF_KEY_LINE",
      "PLAIN_KEY_LINE",
      "PLAIN_ITEM_LINE",
      "KNITR_ECHO_INCLUDE_LINE",
      "LINK_DEFINITION_LINE",
      "CELL_OPTION_PREFIX #",
      "CELL_OPTION_PREFIX //",
      "CELL_OPTION_PREFIX (*",
      "PIPE_DELIMITER_ROW",
      "BIBLIOGRAPHY_ITEM_LINE",
      "SEQUENCE_ITEM_LINE",
      "JUPYTER_KEY_LINE",
      "INDENTED_LINE",
      "TOP_LEVEL_ANCHOR_DECL",
      "TABLE_RULE_ROW",
      "ATX_CLOSING",
    ]);
    for (const name of names) {
      expect(SITES[name].shortLength, name).toBeGreaterThanOrEqual(6);
      expect(SITES[name].smallLength ?? 1_000, name).toBeGreaterThanOrEqual(200);
    }
  });

  // The sizes above are pinned as values; whether each LEG is built at all is not. A site whose `extraLines`, `acceptedLines` or shorter-beginnings loop was quietly dropped keeps every pin and loses the lines
  // that catch a cap or a respelling (Session 320 review: each leg was a single point of failure). The counts are what each leg builds at 1,000 characters.
  it.each([
    ["PIPE_DELIMITER_ROW", { nearMiss: 429, extra: 7, accepted: 141, acceptedLines: 7 }],
    ["TABLE_RULE_ROW", { nearMiss: 831, extra: 15, accepted: 114, acceptedLines: 22 }],
    ["ATX_CLOSING", { nearMiss: 682, extra: 10, accepted: 198, acceptedLines: 10 }],
  ])("%s builds every leg it was given", (name, legs) => {
    const site = SITES[name];
    expect({
      nearMiss: nearMissLines(site, 1_000).length,
      extra: site.extraLines?.(1_000).length,
      accepted: [...longAcceptedLines(site)].length,
      acceptedLines: site.acceptedLines?.(1_000).length,
    }).toEqual(legs);
  });

  // A clock row that cannot fail is no row. The OLD spelling is quadratic on the same lines, so the function the real row calls must say "slow" about it (20,000 characters: the old table pattern takes
  // 240 ms on the first slow line, and `slowestExec` stops there).
  it.each(["TABLE_RULE_ROW", "ATX_CLOSING"])("the clock row can fail: %s's old spelling is slow on its own near-miss lines", (name) => {
    expect(slowestExec(SITES[name].old, nearMissLines(SITES[name], 20_000), CLOCK_LIMIT_MS).slow).toBe(true);
  }, 120_000);

  it("pins an accepted count for every site", () => {
    expect(Object.keys(ACCEPTED).sort()).toEqual([...names].sort());
  });

  // The oracle is the UNGUARDED spelling. A later "tidy-up" that added the guard to this table would turn every comparison below into the new pattern against itself. The second assertion is a substring test:
  // it is the ONLY row that notices an edit of the guard that changes no answer and no cost (a `\r` added to its class), and the only one for a guard narrowed to a class no site generates (U+202F); where the
  // guard text stays and its effect is weakened, it is the clock rows below that fail.
  it.each(names)("the oracle for %s is the spelling without the guard, and the new source holds it", (name) => {
    expect(SITES[name].old.source).not.toContain(SITES[name].guard);
    expect(SITES[name].now.source).toContain(SITES[name].guard);
  });

  it.each(names)("%s agrees, groups included, on every string of the site's marks, a blank, a tab, a CR, U+2028 and a letter, up to its length", (name) => {
    const site = SITES[name];
    const alphabet = shortAlphabet(site);
    const { compared, accepted, disagreements } = compare(site.old, site.now, everyString(alphabet, site.shortLength));
    expect(disagreements).toEqual([]);
    expect(compared).toBe(countStrings(alphabet.length, site.shortLength));
    expect(accepted).toBe(ACCEPTED[name]?.short);
  }, 300_000);

  it.each(names)("%s agrees, groups included, on every string of up to 5 characters over its marks, all four terminators, a form feed and a no-break space", (name) => {
    const site = SITES[name];
    const alphabet = wideAlphabet(site);
    const { compared, accepted, disagreements } = compare(site.old, site.now, everyString(alphabet, 5));
    expect(disagreements).toEqual([]);
    expect(compared).toBe(countStrings(alphabet.length, 5));
    expect(accepted).toBe(ACCEPTED[name]?.wide);
  }, 120_000);

  // `\s` is wider than `[ \t]`: a vertical tab, a byte order mark, an ideographic space and an em space are in it, a next-line character (U+0085) is not.
  it.each(names)("%s agrees, groups included, on every string of up to 5 characters over a vertical tab, a byte order mark, an ideographic space, an em space and a next-line character", (name) => {
    const site = SITES[name];
    const alphabet = exoticAlphabet(site);
    const { compared, accepted, disagreements } = compare(site.old, site.now, everyString(alphabet, 5));
    expect(disagreements).toEqual([]);
    expect(compared).toBe(countStrings(alphabet.length, 5));
    expect(accepted).toBe(ACCEPTED[name]?.exotic);
  }, 120_000);

  // The enumerations hold the alphabets a site's author thought of. A class edited to ADMIT a character no alphabet holds (`_` in a rule row's dash class, a zero-width space in its tail, a star in a closing run)
  // changes no answer anywhere they look. So every UTF-16 code unit is put into each head at every position, and in place of each character of it, and the two spellings must answer alike (Session 320 review: eight
  // source mutants of the two new sites survived until this row; the pinned count is the number of strings, which a row that quietly swept fewer would not reach).
  it.each(names)("%s answers like the old spelling when any one code unit is put into a head, or in place of one of its characters", (name) => {
    const site = SITES[name];
    const edited = function* (): Generator<string> {
      for (const head of site.heads) {
        for (let at = 0; at <= head.length; at++) {
          for (let unit = 0; unit < 0x10000; unit++) {
            const ch = String.fromCharCode(unit);
            yield head.slice(0, at) + ch + head.slice(at);
            if (at < head.length) yield head.slice(0, at) + ch + head.slice(at + 1);
          }
        }
      }
    };
    const { compared, disagreements } = compare(site.old, site.now, edited());
    expect(disagreements).toEqual([]);
    expect(compared).toBe(site.heads.reduce((sum, head) => sum + (2 * head.length + 1) * 0x10000, 0));
  }, 120_000);

  it.each(names)("%s agrees, groups included, on 100,000 seeded lines", (name) => {
    const site = SITES[name];
    const lines = [...seededLines(site, 319 + names.indexOf(name))];
    const { compared, accepted, disagreements } = compare(site.old, site.now, lines);
    expect(disagreements).toEqual([]);
    // The sample must carry every kind of terminator: the accepted count cannot tell a CR from a line separator (no site accepts either), so a sample that dropped one would pass.
    expect(["\r", LS, PS, "\n"].map((terminator) => lines.some((line) => line.includes(terminator)))).toEqual([true, true, true, true]);
    expect(compared).toBe(SEEDED_LINES);
    expect(accepted).toBe(ACCEPTED[name]?.seeded);
  }, 120_000);

  // A guard that quietly CAPPED a run (`[ \t]{0,40}`) or a gap would be seen by neither the enumeration nor the sample. Every run length is swept here on both sides of the small caps (31, 32, 33, 64, 100);
  // a cap of 4,096 is what the lines of 5,000 to 200,000 characters below are for.
  it.each(names)("%s agrees, groups included, on a grid of indent, run length, blank and tail on both sides of the usual caps", (name) => {
    const site = SITES[name];
    const { compared, accepted, disagreements } = compare(site.old, site.now, gapGrid(site));
    expect(disagreements).toEqual([]);
    expect(compared).toBe((1 + site.indents.length) * site.heads.length * RUNS.length * site.blanks.length * (site.tails ?? TAILS).length);
    expect(accepted).toBe(ACCEPTED[name]?.grid);
  }, 120_000);

  // The enumeration cannot see cost. The old spelling is quadratic on the near-miss lines (a long run then a terminator, in several shapes), so the answers are compared at 1,000 characters (a few
  // milliseconds for the old spelling) and the NEW pattern is timed on the same shapes at 50,000 (seconds a line for the old one, a millisecond or two for the new): a guard that goes missing, guards the
  // wrong character, or sits after a group that re-reads the tail passes every comparison and fails the clock.
  it.each(names)("%s answers each near-miss line (1,000 characters, or the site's own length) like the old spelling, groups included", (name) => {
    const site = SITES[name];
    const lines = nearMissLines(site, site.smallLength ?? 1_000);
    const { compared, accepted, disagreements } = compare(site.old, site.now, lines);
    expect(disagreements).toEqual([]);
    expect(compared).toBe(lines.length);
    expect(accepted).toBeGreaterThan(0);
  }, 120_000);

  it.each(names)("%s refuses or accepts each near-miss line of 50,000 characters in linear time", (name) => {
    const { slowestText, slow } = slowestExec(SITES[name].now, nearMissLines(SITES[name], NEAR_MISS_CHARACTERS), CLOCK_LIMIT_MS);
    expect({ slowestText, slow }).toEqual({ slowestText, slow: false });
  }, 120_000);

  // A CAP on a run (`{0,4096}`: the obvious other cure for a quadratic regex) would answer every line above as before and refuse a line the old spelling accepts. So lines each pattern ACCEPTS are
  // compared here at 5,000, 50,000 and 200,000 characters: the old spelling is linear on a line it accepts, so it stays the oracle. Every line is one it accepts, or both sides could be refusing.
  it.each(names)("%s answers each line it accepts, of 5,000 to 200,000 characters, like the old spelling, groups included", (name) => {
    const site = SITES[name];
    const { compared, accepted, disagreements } = compare(site.old, site.now, longAcceptedLines(site));
    expect(disagreements).toEqual([]);
    expect(compared).toBeGreaterThan(0);
    expect(accepted).toBe(compared);
  }, 120_000);
});

// The unanchored sibling, part (9): `text.replace(/[ \t]#.*$/, "")` (and the same with a space only) is retried at every ` #` pair when a terminator follows, so it is a function now, `cutHashComment`.
// The oracle is the two old `replace` calls, compared as RESULT STRINGS: the strip removes from the first ` #` whose rest holds no terminator, so a text with a terminator after a pair keeps that pair
// (and a later pair, after the last terminator, can still be cut).
describe("Session 319 — cutHashComment answers what the unanchored replace answered", () => {
  interface Strip {
    old: (text: string) => string;
    now: (text: string) => string;
    /** How many strings of each enumeration the old call changes, counted with Python's `re` (so the comparison cannot pass by both sides changing nothing). */
    changed: { a: number; b: number; c: number };
  }
  const STRIPS: Record<string, Strip> = {
    "[ \\t]#.*$": { old: (text) => text.replace(/[ \t]#.*$/, ""), now: (text) => cutHashComment(text, " \t"), changed: { a: 139_806, b: 271_700, c: 71_754 } },
    " #.*$": { old: (text) => text.replace(/ #.*$/, ""), now: (text) => cutHashComment(text, " "), changed: { a: 71_697, b: 271_700, c: 36_353 } },
    // Session 320, part (4): the two `[ \t]+#.*$` strips of `knitrDocumentDefaults`, both followed by `.trim()`. The regex removes from the START of the blank run before the `#`, `cutHashComment` from the blank
    // right before it, so the two results differ by blanks the `.trim()` removes: that is the whole argument, and this row compares the results AFTER the trim, which is what both callers read.
    "[ \\t]+#.*$ then trim()": { old: (text) => text.replace(/[ \t]+#.*$/, "").trim(), now: (text) => cutHashComment(text, " \t").trim(), changed: { a: 2_273_094, b: 1_149_692, c: 1_022_244 } },
  };
  const names = Object.keys(STRIPS);

  function compareStrips(strip: Strip, texts: Iterable<string>): { compared: number; changed: number; disagreements: string[] } {
    let compared = 0;
    let changed = 0;
    const disagreements: string[] = [];
    for (const text of texts) {
      const expected = strip.old(text);
      compared++;
      if (expected !== text) changed++;
      if (strip.now(text) !== expected && disagreements.length < 5) disagreements.push(JSON.stringify(text));
    }
    return { compared, changed, disagreements };
  }

  // The oracle is the regex `replace` and not the function under test: a later tidy-up that wrote `cutHashComment` into a strip's `old` would turn every comparison below into the new function against
  // itself, and the pinned `changed` counts (counts of strings the oracle changes) would not notice (Learning 780; Session 320 review).
  it.each(names)("%s: the oracle is a regex replace and not cutHashComment", (name) => {
    expect(STRIPS[name].old.toString()).toContain(".replace(/");
    expect(STRIPS[name].old.toString()).not.toContain("cutHashComment");
  });

  // The comparer is a helper like any other: given a strip that answers wrongly it must say so, and count what it compared and what the oracle changed.
  it("compareStrips counts the texts, the texts the oracle changes, and records a disagreement", () => {
    const wrong: Strip = { old: (text) => text.replace("a", ""), now: (text) => `${text}!`, changed: { a: 0, b: 0, c: 0 } };
    expect(compareStrips(wrong, ["a", "b"])).toEqual({ compared: 2, changed: 1, disagreements: ['"a"', '"b"'] });
    expect(compareStrips({ ...wrong, now: wrong.old }, ["a", "b"])).toEqual({ compared: 2, changed: 1, disagreements: [] });
  });

  const ALPHABET_A = [" ", "\t", "#", "x", "\r", "\n", LS, PS];
  const ALPHABET_B = [" ", "#", LS, "x"];
  // The characters `\s` and the terminators leave out or take: a vertical tab, a form feed and a no-break space are not blanks to the strip, and a next-line character and a vertical tab are not line ends.
  const ALPHABET_C = [" ", "\t", "#", "\v", "\f", NBSP, NEL, "\r", LS, "x"];

  it.each(names)("%s: the result is the same on every string of up to 7 characters over a blank, a tab, a hash, a letter and all four terminators", (name) => {
    const { compared, changed, disagreements } = compareStrips(STRIPS[name], everyString(ALPHABET_A, 7));
    expect(disagreements).toEqual([]);
    expect(compared).toBe(countStrings(ALPHABET_A.length, 7));
    expect(changed).toBe(STRIPS[name].changed.a);
  }, 120_000);

  // Eleven characters hold four pairs and a terminator in the middle: the shapes where the first pair is NOT the one that is cut.
  it.each(names)("%s: the result is the same on every string of up to 10 characters over a blank, a hash, a line separator and a letter", (name) => {
    const { compared, changed, disagreements } = compareStrips(STRIPS[name], everyString(ALPHABET_B, 10));
    expect(disagreements).toEqual([]);
    expect(compared).toBe(countStrings(ALPHABET_B.length, 10));
    expect(changed).toBe(STRIPS[name].changed.b);
  }, 120_000);

  it.each(names)("%s: the result is the same on every string of up to 6 characters over a vertical tab, a form feed, a no-break space, a next-line character and the usual blanks and terminators", (name) => {
    const { compared, changed, disagreements } = compareStrips(STRIPS[name], everyString(ALPHABET_C, 6));
    expect(disagreements).toEqual([]);
    expect(compared).toBe(countStrings(ALPHABET_C.length, 6));
    expect(changed).toBe(STRIPS[name].changed.c);
  }, 120_000);

  it.each(names)("%s: the result is the same on 100,000 seeded texts of up to 14 pieces", (name) => {
    const random = seededRandom(3190);
    const pieces = ["a", " ", "  ", "\t", " #", " # c", "#", "x y", "\r", LS, PS, "\n", '"', ":", " #:", "# "];
    const texts: string[] = [];
    for (let i = 0; i < 100_000; i++) {
      let text = "";
      for (let k = Math.floor(random() * 15); k > 0; k--) text += pieces[Math.floor(random() * pieces.length)];
      texts.push(text);
    }
    const { compared, changed, disagreements } = compareStrips(STRIPS[name], texts);
    expect(disagreements).toEqual([]);
    expect(compared).toBe(100_000);
    expect(changed).toBeGreaterThan(10_000);
  }, 120_000);

  // The shapes that cost the regex seconds, answered at 1,000 pairs by the oracle and TIMED at 200,000 for the function: a terminator after the last pair, one before every pair, none, and one at the very end.
  const pairShapes = (n: number): string[] => {
    const pairs = " #".repeat(n);
    const lines: string[] = [];
    for (const terminator of STRIP_TERMINATORS) {
      lines.push(`1${pairs}${terminator}`, `1${pairs}${terminator}x`, `1${terminator}${pairs}`, `1${pairs}${terminator}${pairs}`, `1${pairs}${terminator} #`, `${terminator}${pairs}`);
    }
    lines.push(`1${pairs}`, `1${pairs} `, `${pairs}x`, "#".repeat(n), "\t#".repeat(n), `a${"  ".repeat(n)}#${LS}`);
    // Session 320: a run with no hash in it at all (the `[ \t]+#.*$` strip was quadratic on this), a run of tabs, and a run that a form feed splits.
    lines.push(`false${" ".repeat(2 * n)}x`, `false${" ".repeat(2 * n)}`, `false${"\t".repeat(2 * n)}x`, `x${" ".repeat(n)}\f${" ".repeat(n)}y`, `${" ".repeat(2 * n)}#`);
    return lines;
  };

  it.each(names)("%s: the result is the same on each pair-heavy text of 1,000 pairs", (name) => {
    const { compared, changed, disagreements } = compareStrips(STRIPS[name], pairShapes(1_000));
    expect(disagreements).toEqual([]);
    expect(compared).toBe(pairShapes(1_000).length);
    expect(changed).toBeGreaterThan(0);
  });

  it.each(names)("%s: each pair-heavy text of 200,000 pairs is cut in linear time", (name) => {
    let slowest = 0;
    let slowestText = "";
    for (const text of pairShapes(STRIP_PAIRS)) {
      const started = performance.now();
      STRIPS[name].now(text);
      const took = performance.now() - started;
      if (took > slowest) {
        slowest = took;
        slowestText = JSON.stringify(text.slice(0, 12));
      }
    }
    expect({ slowestText, slow: slowest >= CLOCK_LIMIT_MS }).toEqual({ slowestText, slow: false });
  }, 120_000);

  // The blanks each call site hands to the strip are part of its answer. The value checker's two sites read a SPACE only (a tab before the hash is no comment, so `1<TAB># c` is not a number),
  // which is a difference nothing else in the suite sees. The proof's site (`" \t"`) and the jupyter reader have no caller-level difference: their blank class is pinned by the enumerations above.
  it("the value checker's strips read a space only: a tab before the hash is no comment, a space is", () => {
    const number = { name: "fig-width", scalarType: "number" } as const;
    const member = { name: "aspectratio", valuesClosed: true, values: ["43", "169"], numericMemberEnum: true };
    expect(isWrongValue("1\t# c", number)).toBe(true);
    expect(isWrongValue("1 # c", number)).toBe(false);
    expect(isWrongValue("43\t# c", member)).toBe(true);
    expect(isWrongValue("43 # c", member)).toBe(false);
  });
});
