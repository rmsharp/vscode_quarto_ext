# One attribute tokenizer — reading `{…}` blocks the way quarto does

**Plan — Session 262 (claimed 2026-09-11, written 2026-09-14).** Architecture plan for replacing
the regex readers of pandoc attribute blocks with ONE measured tokenizer — and for the one fix in
the same family that real documents actually hit.

**Status: PLAN ONLY.** Session 262 changed no file under `src/` or `test/`. Each phase below is its
own session (SESSION_RUNNER FM #18). Workstream: `docs/methodology/workstreams/ARCHITECTURE_WORKSTREAM.md`.
**Every code anchor is cited as a greppable phrase plus its line at `7a2397e2`** (whose `src/` and
`test/` are byte-identical to Session 261's close-out `02819773`). Lines shift legitimately once a
phase edits a file; the phrase is the anchor. **"Session N" below means the executing session's own
number.**

**Origin:** operator-picked at Session 262's Phase 0, over patching either HIGH item on its own. The
two HIGH deletion-direction heads of `BACKLOG.md` "Up Next" — *"the TABSET reads never got Session
259's three fixes"* and *"`maskQuotedValues` pairs quote characters blindly"* — change the same
logic, and *"The attribute spec is matched with regexes and never TOKENIZED as pandoc tokenizes it"*
says one tokenizer subsumes both. Sessions 260 and 261 each said to decide that in a plan session.

**How it was made (§11).** A 15-agent research workflow measured pandoc's grammar, quarto's
consumers, the real-document reach and the instruments. An 8-agent design panel drafted three
competing plans, scored them with three judges and synthesised the winner; its completeness critic
found 19 gaps. **An 11-agent adversarial review of the drafted plan then kept 46 findings and its
critic added 4 more** — including one blocker and several deletion hazards; a 6-agent second review of the revision then kept 15 more (0 blockers). Every one is resolved
in this version (§11.4 lists what changed). The main session re-measured every load-bearing claim this
plan carries (§11.2). **BACKLOG items are cited by TITLE, never by line number** (BACKLOG.md's own
header; Learning #496).

---

## 0. The decision in one page

**The headline is not what the task assumed.** Measured over the 3,383 authored documents of
`docs/REAL-DOCUMENT-TRIAGE.md`, every div-opener and heading-attribute defect the three backlog items
describe occurs in **zero** documents. The one defect in this family that real documents hit —
**23 documents, 41 hidden headings** — is quarto's ```` ```{{python}} ```` display fence. It is a
**regression Session 224's own fence-info rule introduced** (`95241beb`), unfiled until this session,
and fixing it needs **no tokenizer at all**.

So the plan is ordered by measured value:

| Phase | What a reader gets | Corpus reach | Depends on |
|---|---|---|---|
| **P1** | quarto's fence-tag rewrite: a ```` ```{{lang}} ```` block stops swallowing the headings, cells and labels below it | **23 docs: +41 headings, −6 phantoms, +8 cells, +2 labels** | — |
| **P2** | the tokenizer; accepted `:::` openers are classified from pandoc's own tokens (closes both HIGH items for markdown-family documents) | 0 | nothing (P1 optional) |
| **P3** | a `:::` opener pandoc refuses **on its own line** is paragraph text, not a div | 0 | P2 |
| **P4** *(optional)* | one faithful fence info rule — location and validity — shared by the model and the cross-reference index | 0 | P1, P2 |

**Recommended: run P1.** It is the only measured win, one helper in two files, and it changes no
existing expectation — 2,875 of 2,875 unit tests pass under **behaviour-equivalent scratch
prototypes** of it (the design panel's model-only copy, and a model-plus-refs copy re-run by the main
session; neither is yet the §2.2 interface or its linear scan, which P1 itself must prove). Continue to
P2 and P3 only if closing author-reachable deletion shapes, and ending the Sessions 257–261 regex
treadmill, is worth three sessions to you. **Stop after P2** if you do not want the div stack touched
(§9).

**What this plan does NOT do** (§8): the heading/inline path keeps Session 218's grammar, and the
commonmark_x branch, value decoding, quarto's `=` fix-up, multi-line and open-at-end-of-line refusals,
the notebook renderer and theorem/proof headings are filed with evidence — each at zero measured reach.

**Your decisions** are collected in §12.

---

## 1. Context

### 1.1 The problem — three grammars, each wrong somewhere else

A pandoc attribute block — the `{#id .class key=value}` after a `:::` div opener, a heading, a code
fence, an image or a span — is parsed in this codebase by **three independent grammars**, and none
of them is pandoc's:

| Grammar | Where (at `7a2397e2`) | Used for | How it fails (measured) |
|---|---|---|---|
| **Div regex readers** | `const DIV_FENCE` `model.ts:4000`, `function maskQuotedValues(` `:4108`, `function divCalloutTitleSlot(` `:4130`, `function divPanelTabset(` `:4223`, `function calloutClassIndex(` `:4258` | the Outline's callout-title and tabset suppression | 23 separate regex decisions. `calloutClassIndex` is handed the masked spec at `:4181` and the raw one at `:4245`; the brace-shape gates (`:4164`, `:4231`) test the raw spec; the title KEY is found in the masked spec and its VALUE read from the raw one (`:4151`–`:4153`); any non-blank tail opens a div (`:4048`). **46 headings lost and 21 phantoms on 172 rendered probes; 64 of 124 callout variants delete under `commonmark_x`.** |
| **Heading tokenizer** | `function headingAttributeTokens(` `model.ts:552`, `function headingAttributesValid(` `:620`, `function headingAttributeId(` `:299`, `export function braceGroups(` `:364`, `const HEADING_ATTRIBUTE` `:254` | heading ids and text; cross-reference ids (`refs.ts` Sources 3 and 4); code-fence validity (`model.ts:5860`) | splits on JS `\s`, so NBSP separates (`:582`); a quote opens anywhere and nothing escapes inside it (`:577`, `:380`); a quoted value may start with whitespace; `-` only inside atom runs; `\}` refused in a bare value. **22 of 120 validity verdicts and 17 of 75 Attr projections wrong**; fabricates and loses `sec-`/`fig-` ids |
| **Notebook tokenizer** | `function tokenizeDivAttrs(` `notebook-callout.ts:169`, `function parseDivAttrs(` `:236`, `function buildDivAttrs(` `:294`, plus the separate `calloutType` regex (`:52`, `:68`) | the notebook renderer's callouts | the right control structure (a quote opens only after `=`, backslash escapes inside quotes, one bad token refuses the block) with the wrong character sets (ASCII `\w`, no `:` in ids, no `-`), JS `\s`, and one decode for every reader; `calloutType` disagrees with its own tokenizer on the same bytes. **87 of 304 single-line probes wrong** |

The first two fail on **complementary** shapes — 5 shared, 27 in the union — so neither can simply
be promoted. And every session that has touched the div readers since Session 257 has shipped a
defect in them or found one another session shipped: Session 258 found eleven in its own green,
corpus-scored change; Session 259 moved the title read onto `maskQuotedValues` and bought a phantom
fix with a deletion (Learning #522); Session 260's certification filed five root causes for 66
findings; Session 261's gate un-masked every pre-existing plain-div error under a no-div reader
(Learning #525).

### 1.2 What "faithful" means here — quarto's reader, not pandoc

**Pandoc uses ONE attribute grammar per reader family, in every context.** A block gets the same
verdict and the same `Attr` on a div opener, an ATX heading, a span, a link, an image, a code fence
and inline code (120/120 shapes heading-vs-div under `markdown`; 321 probes × 4 contexts; 7 specs ×
7 contexts). Re-measured by the main session: `data-author=O'Brien title='Note'` gives the identical
`Attr` on a div and on a heading, and `data-x=" zz"` is refused on both. **That is what licenses one
tokenizer.** There are two families — the markdown family (`markdown`, `markdown_mmd`,
`markdown_github` identical; `markdown_strict` and `markdown_phpextra` differing only in their
backslash-escape set) and the CommonMark family (`commonmark_x`, `gfm+fenced_divs`,
`commonmark+fenced_divs+attributes`), which disagree on 58 of 125 div verdicts in both directions.

**But the ground truth for this product is what `quarto render` shows, and quarto rewrites the source
before pandoc reads it** (`/Applications/quarto/share/pandoc/datadir/readqmd.lua:128-143`):

- **`:::` openers.** `lpegfenceddiv.attempt_to_fix_fenced_div` turns `key= value` / `key =value` into
  `key=value` under a narrow precondition, and the shortcode pass makes a `{{< >}}` inside a
  DOUBLE-quoted value refuse an opener pandoc accepts. Both run before the reader flavour is chosen,
  so they apply under `commonmark_x` too. Re-measured by the main session: `::: {.callout-note title=
  .x}` — raw pandoc reads classes `[callout-note, x]` and an empty title, which would lift the
  heading; `quarto render` titles the callout `.x` and keeps `<h2>Inside</h2>`. **A tokenizer
  faithful to pandoc alone deletes that heading.**
- **Backtick fences.** A leading `{+[^.=\r\n]+}+` tag on a backtick fence at line start becomes a
  same-length word (`readqmd.lua:37-40` find, `:95-100` replace; on the document's FIRST line the
  pattern is `{+[^.=\r\n]*}+`). That is what makes quarto's documented verbatim-cell idiom
  ```` ```{{python}} ```` a code block.
- **Every input.** CR is dropped and a TAB is expanded to the next 4-column stop before any of it, so
  a TAB changes both decoded values and — after a `\` — verdicts, depending on its column.

A batch oracle built on that view — CR drop, `expandtabs(4)`, the two pre-passes, pandoc, the
restoring AST walk — reproduced `quarto render`'s pre-AST dump on **150 of 150** rows; raw
`quarto pandoc` matched on 39.

### 1.3 Constraints

| Constraint | Source | Consequence |
|---|---|---|
| Strict TDD, one test at a time, RED shown before GREEN | CLAUDE.md, operator directive | every layer that adds logic names its first failing test; rows that pass on arrival are *characterization pins*, counted apart |
| ≤ 5 files per commit | SAFEGUARDS §Blast Radius (per commit) | every phase is cut at ≤ 5-file checkpoints, close-out included (§4 preamble) |
| `src/core/` never imports `vscode` | CLAUDE.md §Tech Stack | the tokenizer is pure |
| **Two bundles** | `esbuild.js:17-34`: `dist/extension.js` (cjs, node — `model.ts`, `refs.ts`) and `dist/notebook-renderer.js` (esm, **browser** — `notebook-callout.ts`) | a module both import must be a **leaf with no imports**: no `node:`, `vscode`, DOM or runtime markdown-it |
| Deletion is the cardinal sin | project doctrine | where the tokenizer's view is unmeasured it answers "unmeasured" and the caller keeps HEAD — it never refuses (§2.5) |
| `vitest` does not type-check `test/unit` | CLAUDE.md gotcha | every phase runs `npm run check-types` (which includes `check-types:unit`) |
| The integration suite seizes the screen | CLAUDE.md; the operator's standing rule | consent at Orient, then an explicit yes immediately before launching (§9.4) |
| Pandoc is GPL, Posit's extension AGPL | Learning #1 | look-but-don't-copy; the spec is measured, never transcribed |
| **The corpus is personal** | `docs/REAL-DOCUMENT-TRIAGE.md`; the census README | fixtures hold synthetic strings only; the corpus LIST is cited by its scratchpad path and sha256; **in a tracked file an individual corpus document is identified only by a digest or its ordinal in the list, plus counts — never by path or directory name**; the corpus is never committed |

### 1.4 What it is worth — measured, and mostly zero

| Question (3,383 authored documents) | Answer |
|---|---|
| Distinct div openers the current readers get wrong vs pandoc (is-a-div, callout class, title, tabset, class order) | **0** of 240 (477 documents); pandoc refuses 0 of 241 |
| Documents containing ANY shape behind the three HIGH/tokenizer items or the class-order item | **0** |
| Heading attribute blocks the model disagrees on (honoured, id) | **0** of 1,837 distinct ATX + 28 setext |
| Documents on a CommonMark-family reader, set in the document or by a project `_quarto.yml` / `_metadata.yml` | **0** |
| **```` ```{{lang}} ```` display fences whose Outline changes when read as quarto reads them** | **23 documents (12 unique quarto-web pages): 41 hidden headings restored, 6 phantoms removed, 8 cells and 2 cross-reference labels restored; 27/27 additions and 6/6 removals confirmed against quarto renders** |

Re-measured by the main session through `scratchpad/s260/check.py`
(`scratchpad/s262/reach/probe_dd/dd2.qmd`): quarto renders `[Hidden One, After Plain]`; the model
and its baseline both report `[After Plain]`. The mechanism, run on the bundled model:
`braceGroups("{{python}}")` returns one group ending at index 8 of a 10-character info string, so
`fenceInfoOpensBlock` takes its "no block ends the info string" branch and refuses any string holding
a brace (`return !/[{}]/.test(info)`, `model.ts:5828`) — before the quarto-intercept clause at
`:5848` is reached. With a blank line inside the block, the block's own closer then opens a fence that
runs to the next ```` ``` ```` and swallows everything between. **It is a regression:** the parent of
`95241beb` (Session 224, *"a fence opener whose info string quarto refuses opens no code region"*)
reports both headings of `dd2.qmd`; `95241beb` reports one (re-run by the main session).

**What the div-path work is worth instead.** (a) **One refused state an author types through** —
`::: {.callout-note title}`, a bare key before the `=`, is paragraph text to pandoc, and today the
Outline hides the heading below it. (The other two typing states, `title="x` and `title=`, are
open at end of line: in a flat document the model already shows the heading below them, and their
effects inside a tabset or on a heading glued under the closer are filed, not planned — §8.) (b)
**Ending the regression treadmill** of §1.1 by replacing three grammars with one measured leaf and a
committed conformance fixture. (c) Against that, **the regression surface the swap must PRESERVE is
large**: the callout reader correctly suppresses 138 headings in 71 documents and the tabset reader
151 in 46 (0 of 217 scorable suppressions are deletions); 556 documents have honoured heading blocks,
374 with explicit ids; 255 reach the non-cell fence path; **184 headings sit glued directly under an
opener line in 94 documents**.

---

## 2. Decision

### 2.1 One leaf module, created in P2

**`src/core/qmd/attribute-block.ts`** — pandoc 3.6.3's markdown-family attribute grammar and div-fence
production, with **zero imports**, so both bundles can import it. It sits beside its main consumer:
`model.ts`'s only import today is its sibling leaf (`import { quartoYamlRegions } from
"./quarto-yaml-regions";`, `model.ts:42`), and `refs.ts` already imports from `./qmd/model`
(`refs.ts:22-32`). The leaf constraint is enforced by a unit test: after comments are stripped, the
file contains no `import`, no `\s` and no `.trim(`.

**It is created in P2, not P1.** P1 needs no tokenizer, and a module created first would be a
horizontal layer (FM #25) standing in front of the plan's only real win.

**Why a new module rather than a promoted one — the deletion test** (ARCHITECTURE_WORKSTREAM
§Refactor Heuristics). Delete `headingAttributeTokens` and its work does not concentrate at a
neighbour; delete `tokenizeDivAttrs` likewise. Their failures are complementary (§1.1), so the work
concentrates in *a new, smaller, more focused module that did not exist* — the heuristic's third
outcome: **replace**, taking the notebook tokenizer's control structure and Session 218's measured
character sets and reader split, plus the rules neither has (pandoc whitespace, not JS `\s`; pandoc's
quote fallback; `-` as `unnumbered`).

### 2.2 Interface contract

```ts
// ══════ P1 — exported from src/core/qmd/model.ts (moved, body unchanged, into the leaf in P4) ══════

/**
 * Quarto's qmd-reader tag rewrite for a PLAIN fence (quarto 1.7.33 readqmd.lua:37-40, :95-100).
 * APPLIES only when `physicalLine` — the RAW document line, before any block-quote strip — matches
 * /^[ \t\f\v]*`{3}/ (quarto's own anchor). Measured: a list marker or `> ` before the backticks
 * defeats it; a list-continuation indent, a 2-space indent and four backticks do not; a TILDE fence
 * is never rewritten.
 * THE TAG: after the backtick run and any [ \t\f\v]*, a run of `{`, then everything up to the LAST `}`
 * before the first `.`, `=`, CR or LF. ⚠ Its length is THE TAG'S OWN — from its first `{` to its last
 * `}` inclusive; the leading [ \t\f\v]* is NOT counted — and must be >= 3, or >= 2 when
 * `documentStart` (the document's physical line 0, where readqmd uses `*`, so `{}` is a tag there and
 * nowhere else). `{{python}}`, `{a} {b}`, `{a} x}` and `{{a}` are each ONE tag; `{a} {.b}` yields `{a}`.
 * Counting the gap is a DELETION: ``` {}x after front matter would open a fence quarto refuses.
 * REPLACEMENT: 'x'.repeat(tag length) — same length (so columns hold), no whitespace, brace or backtick.
 * PRECONDITION: `info` is the suffix of `physicalLine` after its backtick run (FENCE_OPEN's group 3,
 * model.ts:5548, which keeps the gap). Returns `info` unchanged when the rewrite does not apply.
 * ⚠ MUST BE LINEAR. The literal regex /^([ \t\f\v]*)(\{+[^.=\r\n]+\}+)/ backtracks quadratically —
 * re-measured: 2.6 ms at 2,000 braces, 40 ms at 8,000, 155 ms at 16,000 — and computeRegions runs on
 * every edit. Scan once: let open = the index of the first `{` after the gap; find the first [.=\r\n]
 * after the `{` run; close = lastIndexOf('}') before it; length = close + 1 − open. (A fuzz of this
 * reading against the literal regex found 0 disagreements over 2.4M exhaustive and 0.7M random strings,
 * both variants, and 0 of 300,000 against quarto's own Lua patterns — review safety lens.)
 */
export function quartoFenceTagRewrite(physicalLine: string, info: string, documentStart: boolean): string;

/**
 * Whether a PLAIN (non-cell) fence's info string opens a code block. The 4th parameter
 * `quartoIntercepts` is REMOVED: the caller passes the rewritten info, and the stage-1 clause
 * (`if (quartoIntercepts && block.start === 0 && !/[.=]/.test(info))`, model.ts:5848) is deleted —
 * the rewrite subsumes it. Call site (`!fenceInfoOpensBlock(fence[3]`, model.ts:7155):
 *   fenceInfoOpensBlock(quartoFenceTagRewrite(raw, fence[3], i === 0), commonmarkDialect, pandocEscapes)
 * where `raw` is `const raw = lines[i];` (model.ts:6512).
 */
function fenceInfoOpensBlock(infoString: string, commonmarkDialect: boolean, pandocEscapes: boolean): boolean;

/**
 * refs.ts. The intercept at refs.ts:680 is deleted. ⚠ The rewrite must apply to the LINE this
 * function scans, not only to `info`: it runs braceGroups(lineText) (:696), the word count (:707) and
 * idColumnIn on the whole line, so a helper that rewrites only `info` leaves `{#lst-h06}` visible and
 * re-mints an id quarto never defines (pinned today by H6, refs.test.ts:1458). Build
 *   scan = run[0] + quartoFenceTagRewrite(physicalLine, lineText.slice(run[0].length), documentStart)
 * and use `scan` everywhere below; same length, so the columns at :399 hold. The caller
 * (`const found = fenceAttributeId(`, refs.ts:382) passes fence.text and fence.line === 0. Inside a
 * quote the physical line starts with `>`, so the rewrite never fires there (Session 225's rule).
 */
function fenceAttributeId(lineText: string, reader: AttributeBlockReader, physicalLine: string, documentStart: boolean): { id: string; column: number } | undefined;

// ══════ P2 — src/core/qmd/attribute-block.ts (new; LEAF: zero imports; enforced by a unit test) ══════

/** The reader facts the grammar depends on. Structurally identical to model.ts's
 *  AttributeBlockReader (model.ts:447); redeclared so the leaf imports nothing. */
export interface AttributeDialect {
  /** CommonMark family. NOT implemented by this plan: every entry point returns
   *  { kind: "unmeasured" } and callers keep HEAD — a reader whose grammar is unmeasured refuses nothing. */
  readonly commonmarkDialect: boolean;
  /** true: all_symbols_escapable (markdown, markdown_mmd, markdown_github) — `\` escapes any
   *  non-alphanumeric. false: markdown_strict / markdown_phpextra — the Markdown.pl set \`*_{}[]()>#+-.! */
  readonly pandocEscapes: boolean;
}

/** One key=value exactly as WRITTEN. Values are NOT decoded (no escapes, no entities): decoding is filed. */
export interface AttrValue {
  readonly key: string;
  /** Quoted: the text between the quotes. Bare: the whole run (may hold quotes, NBSP, `{`, escape
   *  pairs; may be empty). */
  readonly raw: string;
  /** `"` or `'` quoted; null bare. ⚠ PANDOC'S QUOTE FALLBACK: a `"` or `'` followed by ASCII
   *  whitespace or end of line opens NO quoted value — the value is that one quote character, BARE, and
   *  parsing continues. So `title=" zz"` is refused at the bare string `zz"`, while `title=" ` followed
   *  by only [ \t]* to end of line is open-at-eol (the block may continue; W1 below). A markdown quoted
   *  value whose first character is NBSP or another non-ASCII space is likewise re-read as BARE, quotes
   *  included. */
  readonly quote: '"' | "'" | null;
}

/** Pandoc's Attr as its READER folds it (not as its HTML writer does): order kept, duplicates kept. */
export interface ParsedAttr {
  /** The LAST `#id` atom or `id=` value (the markdown family lets the last win); "" when none. */
  readonly id: string;
  /** Source order: `.name` atoms (`.a.b` is ONE class; `.a#b` glues an id); `-` as "unnumbered"
   *  (alone, spaced or glued; `-title=zz` is `-` plus title=zz); the words of a `class=` value at its
   *  position, split on pandoc's isSpace — [\t\n\v\f\r] or \p{Zs}, so NBSP splits and U+2028, ZWSP
   *  and U+FEFF do not. */
  readonly classes: readonly string[];
  /** Every other key=value in source order, duplicates kept (quarto reads the FIRST `title`). */
  readonly kvs: readonly AttrValue[];
}

export type AttributeBlockScan =
  /** `end` = the index just past the closing `}`. */
  | { readonly kind: "attr"; readonly attr: ParsedAttr; readonly end: number }
  /** "invalid-token": parsing stopped, BEFORE the end of the line, at a token pandoc cannot place —
   *  final on one line: a bare key (`{.note title}`, also at end of line) or a bare string (`"q"`); a
   *  bare word left by the quote fallback (`title=" zz"`); a class not led by a letter; NBSP or another
   *  non-ASCII space used as a separator; `-x`; WHITESPACE BEFORE `=` (a bare key). ⚠ Whitespace AFTER
   *  `=` is NOT a refusal on its own: the bare value may be empty, so `k= .c` is k="" plus class c and
   *  `k= #i` is k="" plus id i (pandoc-markdown K14, K15); `k= v` refuses only because `v` is a bare word
   *  (K12). Also returned, with at === start, when s[start] !== "{".
   *  "open-at-eol": the end of `s` was reached inside the braces or inside a quoted value, or after a
   *  quote-fallback character with nothing but [ \t]* behind it. Pandoc lets a block continue across ONE
   *  newline, so one line cannot decide it; no caller may read it as a refusal. */
  | { readonly kind: "refused"; readonly reason: "invalid-token" | "open-at-eol"; readonly at: number }
  | { readonly kind: "unmeasured" };

/** ONE attribute block starting at s[start]: pandoc 3.6.3's markdown-family `attributes` production.
 *  `s` is ONE line with any CR removed and **its TABs already expanded to 4-column stops of the
 *  PHYSICAL line** — pandoc expands them before parsing, so a TAB after `\` changes the VERDICT by
 *  its column (`{k=a\<TAB>b}`: refused where the TAB becomes 3 spaces, accepted where it becomes 1;
 *  pandoc-markdown B26). The caller expands over the whole physical line before any quote/list strip.
 *  Separators are ASCII space and TAB only — never JS \s, never trim(). Backslash escapes (per
 *  dialect.pandocEscapes) are stepped over when finding the end of a value. */
export function parseAttributeBlock(s: string, start: number, dialect: AttributeDialect): AttributeBlockScan;

/**
 * What a `:::` opener's tail opens, per pandoc's div-fence production:
 *     tail := [ \t]* ( attributes | WORD ) [ \t]* :* [ \t]* EOL,   WORD := [^ \t]+  (NBSP is a WORD char)
 * `attributes` is tried first; ONCE A BLOCK HAS PARSED, WORD IS NEVER TRIED (`{.a}x` is refused).
 * Re-measured: `{.callout-note!} :::`, `{.a :::`, `{callout-tip} ` and `callout-note :::` each open a
 * one-literal-class div; `{.a}x` is paragraph text.
 * `tail` = everything after the colon run, UNTRIMMED, CR removed, TABs expanded as above. Callers never
 * pass a blank tail (a blank tail is a CLOSER, model.ts:4048); if one does, the verdict is
 * refused/"invalid-token".
 */
export type DivOpenerVerdict =
  | { readonly kind: "attr"; readonly attr: ParsedAttr }
  /** A div whose ONE class is the literal word. fallback: false — the tail begins with a word that is
   *  not `{` (`callout-note`, `callout-note :::`, and a LEADING-NBSP spec, whose word begins with NBSP);
   *  fallback: true — the word begins with `{`: a failed block followed only by the tail rule
   *  (`{.callout-note!} :::`, `{callout-tip} `, `{.a :::`, an NBSP-joined spec). */
  | { readonly kind: "word"; readonly word: string; readonly fallback: boolean }
  /** Not a div: the line is paragraph text. "trailing-text": a block PARSED and something other than the
   *  tail rule follows (`{.a}x`). "invalid-token": the block failed and the WORD alternative failed its tail
   *  rule (`{.callout-note title}`: the word `{.callout-note`, then ` title}`); also a blank tail. */
  | { readonly kind: "refused"; readonly reason: "invalid-token" | "trailing-text" }
  /** The block reached end of line still open: the next line decides. Multi-line blocks are filed. */
  | { readonly kind: "open-at-eol" }
  | { readonly kind: "unmeasured" };
export function divOpenerVerdict(tail: string, dialect: AttributeDialect): DivOpenerVerdict;

// ══════ P2 — src/core/qmd/model.ts consumers ══════

// divFenceRole (`function divFenceRole(`, model.ts:4035) gains `tail: string` — m[1] UNTRIMMED, with
// the physical line's TABs expanded — so it also gains `baseColumn`, the physical column of `line[0]` (the
// quote base `columnAtOffset(raw, quoteContentStart)`, else 0: inside a quote `line` is quoteContentLine(raw,
// …), which keeps later TABs raw, model.ts:6627, :5110-5118), and expands from the tail's offset in the
// UNSTRIPPED `line`, never from the LIST_MARKER_PREFIX-stripped string. Today `attrs: m[1].trim(),` (:4053)
// strips NBSP and trailing
// whitespace, and those decide the WORD and the refusal. `role`, `column`, `viaListMarker` and
// `attrs` are unchanged.

/** The quarto-relevant reading of an opener, or null when HEAD's legacy readers must answer. Null when:
 *   - reader.commonmarkDialect;
 *   - the tail contains `{{<` (quarto refuses a shortcode in a double-quoted value);
 *   - the tail matches /[ \t]=|=[ \t]/ (quarto's lpegfenceddiv fix-up shapes — deliberately BROADER
 *     than quarto's own precondition, so e.g. `title="a = b"` also stays on HEAD's reading);
 *   - the verdict is refused, open-at-eol or unmeasured;
 *   - a class= value's raw text holds `\` or `&` (undecoded, so its words may not be quarto's classes);
 *   - the first title's raw value begins with U+FEFF (quarto strips ONE BOM before its emptiness test,
 *     so a bare `title=<U+FEFF>` is EMPTY to quarto and non-empty raw; HEAD agrees with quarto there by
 *     accident, fill-2 x2_md_bare_ufeff). */
interface DivSpecReading {
  readonly classes: readonly string[];         // attr.classes, or [word]
  readonly firstTitleRaw: string | undefined;  // raw of the FIRST kv whose key === "title" (case-sensitive)
}
function divSpecReading(tail: string, reader: AttributeBlockReader): DivSpecReading | null;

/** Both keep their names and gain (tail, reader). A non-null reading answers; a null reading falls
 *  through to HEAD's bodies, renamed legacyDivCalloutTitleSlot / legacyDivPanelTabset. maskQuotedValues
 *  and calloutClassIndex are then reachable only from those two. Over a reading the semantics are
 *  HEAD's, on EXACT class tokens: callout = the first class that is `callout` or `callout-<t>`
 *  (t ∈ CALLOUT_TYPES) comes before any `panel-tabset`, and there is no NON-EMPTY first title (raw
 *  emptiness equals decoded emptiness for every measured shape except a leading U+FEFF, routed above);
 *  tabset = `panel-tabset` is present with no callout class before it. */
function divCalloutTitleSlot(attrs: string, tail: string, reader: AttributeBlockReader): boolean;
function divPanelTabset(attrs: string, tail: string, reader: AttributeBlockReader): boolean;

// ══════ P3 — src/core/qmd/model.ts ══════

/** Whether pandoc refuses this opener ON ITS OWN LINE, so the line is paragraph text. FALSE unless ALL of:
 *   - fencedDivsDialect && measuredRefusalReader — computed in computeRegions beside
 *     `const fencedDivsDialect` (model.ts:6279) as
 *         fromValueLine === null || FRONTMATTER_MARKDOWN_BASE_FROM.test(fromValueLine)
 *     (model.ts:2120: base `markdown` with any extensions, and none of the `markdown_*` variants).
 *     fill-1 measured the DEFAULT reader's refusal structure (plus commonmark_x); the regex also admits
 *     `markdown` with any ±extension, and the second review measured `markdown-blank_before_header` on 9
 *     shapes: 6 move to quarto's render, 3 stay put, none is lost. `markdown_strict`,
 *     `_phpextra`, `_mmd` and `_github` with +fenced_divs lack blank_before_header (model.ts:2119-2123)
 *     and are NOT gated in. ⚠ "No DOCUMENT-level `from:`" is not proof of quarto's default reader: a
 *     project `_quarto.yml` can set one that src/core cannot see (§2.5);
 *   - !reader.commonmarkDialect;
 *   - the tail holds no `{{<` and does not match /[ \t]=|=[ \t]/;
 *   - divOpenerVerdict is "refused" — NEVER "open-at-eol", whatever the next line holds. */
function divOpenerRefused(tail: string, reader: AttributeBlockReader, fencedDivsDialect: boolean, measuredRefusalReader: boolean): boolean;
// At `? !divAtColumn || divOpenerInterrupts` (model.ts:8354) the open arm gains `|| divRefused`.
// At `} else if (divRole === "open" && divAtColumn && !divOpenerInterrupts) {` (:8360) the push guard
// gains `&& !divRefused`. NO code path sets divFence to null for a refusal.

// ══════ P4 (optional) — added to src/core/qmd/attribute-block.ts ══════

export function quartoFenceTagRewrite(physicalLine: string, info: string, documentStart: boolean): string; // moved from model.ts

/** Pandoc's fenced-code info production, after the caller's tag rewrite: skip [ \t]; a raw `{=fmt}`
 *  must be the WHOLE info (its format name as permissive as RAW_ATTRIBUTE — Learning #393); otherwise
 *  an optional brace-free word (no backtick, `{`, `}` or Unicode whitespace), [ \t]*, and an optional
 *  attribute block — which must be VALID (parseAttributeBlock "attr"); then ONLY [ \t]* to end of line
 *  (NBSP and FF are not skipped). */
export type FenceInfoVerdict =
  | { readonly kind: "closed" }
  | { readonly kind: "open"; readonly raw: boolean;
      /** The block carrying the fence's Attr; null for a bare word, an empty info or a raw block. */
      readonly block: { readonly start: number; readonly end: number; readonly attr: ParsedAttr } | null }
  | { readonly kind: "unmeasured" };
export function fenceInfoVerdict(info: string, dialect: AttributeDialect): FenceInfoVerdict;
```

### 2.3 Who does what

**The leaf** (P2, extended in P4) owns pandoc's markdown-family `attributes` production — separators
(ASCII space and TAB only), the id/class/key character classes (IdChar = Unicode letters and digits
plus `-_:.`; ids may start with a digit; classes and keys start with a letter), the quote rules and
quote fallback, escape stepping, the reader fold, the end offset and the refusal reason — and pandoc's
div-fence production. Under `commonmarkDialect` it returns `unmeasured`. In P4 it gains the fence-info
production and the moved tag rewrite.

**The callers** own: normalisation (`computeRegions` splits on `/\r?\n/`; the div caller strips a lone
CR and expands TABs over the physical line before passing the tail); whether the tag rewrite applies
(only the region scanner and `CodeFenceOpener` know the physical line and `i === 0`); quarto's `:::`
pre-passes, which are **not modelled** and are routed to HEAD's reading (§2.5); container geometry
(start column, `divFenceRole`'s column rule, the quote strip, list markers); dialect resolution
(`computeRegions`' `commonmarkDialect` `:6239`, `fencedDivsDialect` `:6279`, `pandocEscapes` `:6297`,
and P3's `measuredRefusalReader`; refs' `attributeBlockReader` `model.ts:462`); what a refusal MEANS
(P2: HEAD's reading, byte for byte; P3: `unmatchedConstruct=true` and no push); and quarto's consumer
semantics, which stay in `model.ts` — `CALLOUT_TYPES`, the FIRST title and its raw-emptiness test, the
callout-vs-tabset order, the tab level.

### 2.4 Data flow

- **Div path.** `:::` line → `divFenceRole` (`:4035`; gains `tail`) → `divSpecReading` (P2; null →
  legacy readers) and `divOpenerRefused` (P3) → the `divColumns` entry (`:8360-8369`) →
  `calloutTitleTakes` (`:6660`) / `tabsetTabTakes` (`:6694`) → `findHeadings` → `buildOutline` →
  `providers/outline.ts`.
- **Fence path.** raw line → `FENCE_OPEN` (`:5548`) → `fenceMatchAt` → `CELL_INFO` (cells skip the
  tokenizer) → `quartoFenceTagRewrite` (P1) → `fenceInfoOpensBlock` (`:7155`; P4 delegates to
  `fenceInfoVerdict`) → regions → `findAllCells` and the region views (§6).
- **Id path.** `findCodeFenceOpeners` (`:9066`) → `fenceAttributeId` (`refs.ts:670`; P1 rewrite, P4
  location and validity) → `indexLabels` Source 4 → `providers/crossref.ts`. Source 3
  (`refs.ts:314-337`, `braceGroups` + `attributeBlockId`) is untouched by this plan.

### 2.5 What is deliberately NOT modelled, and where each goes

**The rule: where the tokenizer's view is unmeasured it answers "unmeasured" or returns a null reading,
and the caller keeps HEAD's reading byte for byte. It never refuses.** Over-refusal deletes (fill-1's
patchF: refusing the accepted `{.note}` deleted two headings).

| Not modelled | Routed to | Why | Filed as |
|---|---|---|---|
| quarto's `=` fix-up (`key= value`) | HEAD's reading, via the `/[ \t]=\|=[ \t]/` route | a pandoc-only reading deletes (fill-0 A1, re-measured) — **but the route also keeps HEAD's deletions on 9 fix-up-BLOCKED refused shapes** (fill-0 `b16`, `b19`, `b20`, `b28`, `b29`, `T4`, `Q1`, `Q3`, `Q4`, e.g. `::: {.callout-note data-x= y}` plus trailing spaces: quarto renders `Inside`, HEAD hides it) | the deferred-shapes item (§8) |
| `{{<` in a double-quoted value | HEAD's reading, via the `{{<` route | quarto refuses the opener; pandoc accepts it (fill-0 f01/f02) | same |
| the CommonMark family | `unmeasured` → HEAD | 58/125 verdicts differ; 0 corpus documents | same |
| **a reader set OUTSIDE the document** — a project `_quarto.yml` top-level `from:` or `format: <fmt>: from:`, or `_metadata.yml` | nowhere: src/core cannot see it (`model.ts:2096-2098`) | quarto honours it; P2 then classifies and P3 refuses on markdown's grammar. Measured by the review's safety lens with two scratch projects set to `commonmark_x`: P2's reading of `class="callout-note x"` and P3's refusal of `{.note title}` each hide a heading quarto renders there. HEAD already misreads such documents elsewhere (a heading pressed against prose). 0 of 3,383 corpus documents sit under such a file | disclosed here, in P2/P3 cannot-enforce and in §8; your call, §12 |
| values decoded, and quarto's zero-inlines empty-title rule | raw values; `class=` holding `\` or `&`, and a title led by U+FEFF → HEAD | raw emptiness equals decoded emptiness for every other measured shape; a lenient decode deletes (fill-2) | same |
| multi-line attribute blocks, and every open-at-eol opener | `open-at-eol` → HEAD, whatever the next line holds | a value ending in an odd run of `\` carries across the blank line (backslash-newline is an escaped character — re-measured: `title="x\` / blank / `y"}` is a callout titled `x y`); continuation inside lists and quotes is unprobed; 0 corpus documents | same |
| the heading/inline path | Session 218's grammar, unchanged | 0 of 1,837 distinct heading blocks disagree; the largest regression surface in the project | the heading-id append (§8) |

---

## 3. Evidence-based inventory

### 3.1 How it was built, and re-run

Twenty-one grep sweeps, each an argv list with no shell (`scratchpad/s262/inventory/greps.py`),
**re-run by the main session into `scratchpad/s262/main/greps/` with identical hit counts**:

| Sweep | What | Hits |
|---|---|---|
| a | declarations whose name mentions attr/class/title/tabset/callout/fence/label | 127 (12 files) |
| b1–b9 | escaped braces, `[^}`, `panel-tabset`, `\.callout`, `title=`, `#`-id patterns, `new RegExp(`, `{=`, brace-char compares | 27, 14, 21, 5, 19, 7, 27, 12, 27 |
| **b10** | **quote-pairing regexes and quote-char compares** | **42 (11 files)** |
| **b11** | **identifier character classes** | **14 (4 files)** |
| c1–c4 | importers of `qmd/model`, of the attribute exports, of `notebook-callout`, of `refs` | 19, 23, 1, 2 |
| c6 | uses of every second-order symbol (§3.2) | 105 (7 files) |
| c5 | test files importing the attribute exports / `notebook-callout` / `CALLOUT_TYPES` | 5 files |
| d1–d3 | `syntaxes/quarto.tmLanguage.json`, `snippets/quarto.json`, `package.json` | 20, 11, 1 |

⚠ **Sweeps a and b1–b9 hit `maskQuotedValues` and the notebook's `NAME_CHAR`/`KEY_START`/`KEY_CHAR`
zero times.** Only b10 and b11 find them — an inventory built from names and brace patterns alone
misses the regression site of the `maskQuotedValues` item. A reconciliation maps every code-line hit
to exactly one of 88 rows with **0 left over** (`scratchpad/s262/inventory/reconcile.py`). ⚠ Per
Learning #115 a `grep -rn` sweep is blind to a file holding a NUL byte: **no file under `src/` holds
one** (re-checked). **P1 adds a stale-docs sweep the research did not run** (§4 P1 DONE 5).

### 3.2 The second-order symbols, by file (sweep c6, re-run)

| Symbol | Files (hits) | In scope? |
|---|---|---|
| `divFenceRole`, `DIV_FENCE`, `divCalloutTitleSlot`, `divPanelTabset`, `calloutClassIndex`, `maskQuotedValues` | `model.ts` only (5, 8, 5, 4, 3, 2) | **yes** |
| `headingAttributeTokens`, `headingAttributesValid`, `headingAttributeId`, `fenceInfoOpensBlock` | `model.ts` only (5, 8, 5, 2) | **yes** |
| `fenceAttributeId` | `refs.ts` (3), `model.ts` (1, a comment) | **yes** |
| `tokenizeDivAttrs`, `parseDivAttrs`, `calloutType` | `notebook-callout.ts` (3, 3, 3); `calloutType` also `model.ts` (1, a comment) | inventoried; notebook adoption filed |
| `FRONTMATTER_COMMONMARK_FROM`, `fromEscapesAllSymbols`, `fromHasFencedDivs`, `fromHonoursHeaderAttributes` | `model.ts` only | **no — the tokenizer's PARAMETERS**, resolved from `from:` |
| `CELL_INFO` | `model.ts`, `document-engine.ts`, `yaml-context.ts`, `diagram-regions.ts` | **no** — a quarto cell production, not pandoc `Attr` |
| `RAW_ATTRIBUTE` | `model.ts` only | **no** — `{=fmt}` is a separate production (Learning #393) |
| `FENCE_OPEN` | `model.ts`, `quarto-yaml-regions.ts` | **no** — delimiter shape |

### 3.3 Owner phase per symbol (grep loop over 26 symbols at `7a2397e2`)

- **`quartoIntercepts`** — param `model.ts:5797`, `refs.ts:673`; code `model.ts:5848`, `refs.ts:680`. → **P1** deletes both clauses and the model parameter; refs takes `physicalLine` + `documentStart`.
- **`fenceInfoOpensBlock`** — def `model.ts:5793`; single call `:7155`. → **P1** (three parameters); **P4** delegates to `fenceInfoVerdict`.
- **`fenceAttributeId`** — def `refs.ts:670`; call `:382`. → **P1** (tag rewrite on the scanned line), **P4** (location and validity).
- **`findCodeFenceOpeners` / `CodeFenceOpener`** — `model.ts:9066` / `:5921`; `refs.ts:379`. → unchanged; P1 reads `fence.text` and `fence.line`.
- **`FENCE_OPEN`** (`:5548`), **`consumedCloserLine`** (`:6107`), **`FENCE_RUN`** (`refs.ts:634`) → unchanged.
- **`braceGroups`** — def `model.ts:364`; uses `:5813` (fence), `refs.ts:322` (Source 3), `refs.ts:696` (fence id). → the fence uses leave in **P4**; `:322` stays.
- **`RAW_ATTRIBUTE`** — def `:5771`; use `:5857`. → **P4** (the whole-info raw clause moves into `fenceInfoVerdict`).
- **`headingAttributesValid`** — def `:620`; uses `:441`, `:5860` (fence), `:9539`. → the fence use leaves in **P4**; the rest unchanged.
- **`attributeBlockId`** — def `:437`; uses `refs.ts:329` (Source 3), `:710` (fence id). → the fence use leaves in **P4**; `:329` stays.
- **`AttributeBlockReader` / `attributeBlockReader`** — `model.ts:447` / `:462`. → unchanged; the leaf redeclares `AttributeDialect`.
- **`FRONTMATTER_MARKDOWN_BASE_FROM`** — `model.ts:2120`. → **P3** reads it for `measuredRefusalReader`.
- **`divFenceRole`** — def `:4035`; single call `:8226`. → **P2** adds `tail`.
- **`DIV_FENCE`** — def `:4000`; uses `:4041`, `:4042`, and the shape list `:5690`. → unchanged.
- **`maskQuotedValues`** (`:4108`, use `:4140`), **`calloutClassIndex`** (`:4258`, uses `:4181`, `:4245`) → **P2**: legacy-only.
- **`divCalloutTitleSlot`** (`:4130`, call `:8365`), **`divPanelTabset`** (`:4223`, call `:8367`) → **P2**: the dispatcher keeps the name; HEAD's body becomes `legacy…`. Their comment mentions (`:4117`, `:4250`, `:4253`, `:6447`, `:6450`) are swept by symbol in P2 DONE 6.
- **`CALLOUT_TYPES`** (`:4069`) → unchanged; `divSpecReading` reads it.
- **`CLOSER_LINE`** (`:3965`, use `:4964`) → unchanged. It is tail-blind, which is why a null encoding of a refusal is forbidden.
- **`unmatchedConstruct`** (`:8350-8357`) and **`divOpenerInterrupts`** (`:8304`) → **P3** edits the open arm (`:8354`) and adds `divRefused` beside the push guard (`:8360`); `:8304` itself is unchanged.
- **`isAttributeBlock`** (`refs.ts:202`) → unchanged.
- **New files:** `src/core/qmd/attribute-block.ts`, `test/unit/attribute-block.test.ts`, `test/unit/attribute-block-truth.json`, `docs/planning/scripts/attribute-block/truth.mjs` (all P2); `docs/planning/scripts/attribute-block/{census.test.ts, vitest.census.config.ts, README.md}` (committed WITH this plan — operator decision, §11.3).

### 3.4 The 32 in-scope rows, reconciled to an owner

The inventory lens marked 32 rows IN SCOPE, in three files. Each is owned by a phase or held by a
named filing — none is silently dropped:

| # | Row (at `7a2397e2`) | Owner |
|---|---|---|
| 1 | `HEADING_ATTRIBUTE` `model.ts:254` (locator; `[^}]*` cannot span a quoted `}`) | filed: heading/inline path (§8) |
| 2–3 | `ATTR_ID_ALL` `:271`, `headingAttributeId` `:299` | filed: heading/inline path |
| 4 | `BraceGroup`/`braceGroups` `:341`/`:364` | **P4** removes the fence uses; Source 3 use filed |
| 5 | `attributeBlockId` `:437` (exported facade) | **P4** removes the fence-id use; Source 3 use filed |
| 6–7 | `ATTR_KEY_VALUE` `:482`, `ATTR_ATOM_RUN` `:509` | heading path filed; fence reliance ends in **P4** |
| 8–9 | `ATTR_ATOM_COMMONMARK` `:527`, `ATTR_KEY_VALUE_COMMONMARK` `:535` | filed: commonmark_x grammar |
| 10–11 | `headingAttributeTokens` `:552`, `headingAttributesValid` `:620` | heading path filed; fence reliance ends in **P4** |
| 12 | `DIV_FENCE` `:4000` + `divFenceRole` `:4035` | **P2** (`tail`) |
| 13 | `maskQuotedValues` `:4108` | **P2** (legacy-only) |
| 14 | `divCalloutTitleSlot` `:4130` | **P2** |
| 15 | `divPanelTabset` `:4223` | **P2** |
| 16 | `calloutClassIndex` `:4258` | **P2** (legacy-only) |
| 17 | `buildHeading` `:9520-9553` | filed: heading/inline path |
| 18 | the `divFenceRole` call `:8226` | **P2** (`tail`), **P3** (refusal) |
| 19 | the push `:8360-8369` | **P2** (arguments), **P3** (guard) |
| 20 | `fenceInfoOpensBlock` `:5793-5861` | **P1**, **P4** |
| 21 | reader-flag plumbing into `computeRegions` (`:6239`, `:6279-6297`, `:7150-7156`) | **P1** (call site `:7155`), **P2/P3** (reader passed; P3's `measuredRefusalReader`) |
| 22–29 | `notebook-callout.ts`: `ATTR_BLOCK`+`calloutType`, `DivToken`/`NAME_CHAR`/`KEY_START`/`KEY_CHAR`, `tokenizeDivAttrs`, `parseDivAttrs`, `calloutCollapse`, `buildDivAttrs`, `isDivOpener`, `calloutRule` | filed: notebook adoption (the leaf is browser-safe, so adoption needs no bundle change) |
| 30 | `refs.ts:92` `DEFINED_ID_CHAR_CLASS` (the same set as the leaf's IdChar) | filed (the deferred item, §8): a zero-behaviour dedupe with no reach, contingent on §12's unification question |
| 31 | `indexLabels` Sources 3/4 (`refs.ts:314-337`, `:379-402`) | **P1**, **P4** (Source 4); Source 3 filed |
| 32 | `fenceAttributeId` `refs.ts:670` | **P1**, **P4** |

### 3.5 Deliberately out of scope, with the reason

- **`NARROW_LABEL` (`refs.ts:166`)** — display math and table captions are quarto's own productions,
  not pandoc `Attr`. The tokenizer must NOT be applied there (Learning #384).
- **`RAW_ATTRIBUTE` (`model.ts:5771`)** — `{=fmt}` is not an attribute block (Learning #393). The fence
  caller keeps testing it before the tokenizer.
- **`CELL_INFO` and the cell-fence readers** — `{r}`, `{python}`, `{r, echo=FALSE}` are engine
  productions pandoc refuses.
- **Raw-HTML tag attributes (`model.ts:5503`)**, the **reader-flag gates** (the tokenizer's
  parameters — their misreads are the reader-resolver item, and the tokenizer inherits every one,
  Learning #526), **declarative files**, and **`refs.ts:202` `isAttributeBlock` / `:560-631`** (the
  geometry of where a group sits, not its contents — which is also why `::: {#fig-x} :::` is indexed
  only through the `NARROW_LABEL` fallback today).

### 3.6 Test surfaces that must stay green

`test/unit/qmd-model.test.ts` — the Session 257 (`:16360`, `:16481`, `:16755`), 258 (`:16777`,
`:17185`, `:17572`, `:17661`, `:17756`, `:17847`), 259 (`:17917`) and 261 (`:18095`) describe blocks,
the Session 218/219 heading rows and the Session 224/225 fence rows (`describe("GUARD — fences that
must go on opening a code region (Session 224)"`, `:9483`); `test/unit/refs.test.ts` — Session 222
(`:1197`, `:1226`, `:1345`) and 223 (`:1426`, `:1571`, including H6 at `:1458`); `test/unit/cells.test.ts`
(`:35`, `:296` — `{{python}}` is not a cell); `test/unit/notebook-callout.test.ts`;
`test/unit/notebook-renderer.test.ts`; and `test/integration/suite/notebook-renderer.test.ts`,
`outline.test.ts` (`:2936`, `:3003`, `:3087`) and `crossref.test.ts`.

⚠ **Two pinned rows are right for the wrong reason.** `qmd-model.test.ts:16459` and `:18042` assert
that `::: {.callout-note title="   "}` keeps its heading, and their comments — and the rationale at
`model.ts:4141-4147` — say the whitespace title "supplies a blank-looking title". Measured: **pandoc
refuses that opener outright** (a markdown quoted value may not start with ASCII whitespace: the quote
falls back to a bare `"`, and the rest is a bare string), so there is no callout at all. **The
assertions stay; their reasons change in P3.** Under `commonmark_x` the div does form, quarto treats
the whitespace title as empty, and the heading is LIFTED — filed with the commonmark_x grammar.

---

## 4. Phases

**Rules for every phase.** One capability, one session, strict TDD: the first RED of **each layer** is
named and recorded as an **assertion** failure — create a stub export first, so a missing import never
counts. **Rows that pass on first run after a wiring are characterization PINS, counted apart from
RED→GREEN cycles in the close-out**, and a pin earns its place only if a named mutant can make it fail.
Residuals are pinned in the house idiom — an `it("KNOWN RESIDUAL: …")` row asserting HEAD's current
value with quarto's truth in the comment (`qmd-model.test.ts:1600`, `:1668`); `it.fails` has no
precedent in `test/unit` and passes on any throw. Checkpoint commits are ≤ 5 files. **The gate at every
boundary** is `npm run check-types && npm test && npm run compile` plus the phase's inventory grep;
every phase's close-out verification also records `npm run check-package` (file count and size).
Mutants are applied **only in a `git archive HEAD | tar -x` copy with `node_modules` symlinked** (never
the tracked tree). **Every census run** writes its own `CENSUS_OUT=$PWD/scratchpad/sN/census-<run>.out`,
keeps it, and must report **`threw=0`** (the tool fails otherwise); its wall-clock must be ≤ 1.2× the
same session's identity-control run (§9.5 step 6). The runtime gate follows §9.4. **Close-out is
several commits, each ≤ 5 files**, as in Session 261: a records commit (`PROJECT_LEARNINGS.md` plus any
`BACKLOG.md` annotations); the `SESSION_NOTES.md` trim alone (CLAUDE.md's retention rule); and the
close-out commit (`CHANGELOG.md` with any `BACKLOG.md` removal in the same commit, `HANDOFFS.md`,
`SESSION_NOTES.md`, telemetry).

### P1 — Quarto's backtick fence-tag rewrite, in the region scanner and the fence-id reader

**Capability.** A plain fence's info string is judged after quarto's readqmd tag rewrite, through ONE
exported helper, `quartoFenceTagRewrite(physicalLine, info, documentStart)`, shared by `model.ts` and
`refs.ts` (§2.2). The stage-1 intercepts at `model.ts:5848` and `refs.ts:680` are deleted. **No
tokenizer.**

**Depends on:** nothing.

**Value and reach — the plan's ONLY measured corpus reach, and the recommended stop.** A reader of any
page that SHOWS a cell with quarto's verbatim idiom (```` ```{{python}} ````, ```` ```{{r}} ````) with a
blank line inside gets back the headings, cells and labels the model hides today. The census against a
behaviour-equivalent prototype of this phase (the main session, from the committed census copy; README
row 3): **headings 23 docs, +41/−6; cells 8 docs, +8; labels 2 docs, +2**, 0 throws. Direction: 27/27
additions confirmed in the 16 documents with a Session 251 render; all 6 removals render-confirmed by
fill-3's `verify.py` (3 unique headings in 2 pages, each in two checkouts). On fill-3's 92-row
default-reader fence grid it fixes **10** of the 46 rows HEAD gets wrong — 2 deletions (`l04`, `l06`)
and 8 phantoms (`l02`, `q03`, `q04`, `q05`, `q06`, `q10`, `q13`, `q16`) — and breaks none (scored
HEAD→P1 with a refs-inclusive prototype by two review agents). `l08` (```` ~~~{a} {.b} ````) stays a
deletion: that is the location rule (P4). Also fixed: the `lst-i06` label under both readers, and the
line-0 ```` ```{}x ```` phantom (`d0`). The unit suite passes 2,875 of 2,875 under the refs-inclusive
prototype (re-run by the main session).

**Files.** `src/core/qmd/model.ts`, `src/core/refs.ts`, `test/unit/qmd-model.test.ts`,
`test/unit/cells.test.ts`, `test/unit/refs.test.ts`; `test/integration/suite/outline.test.ts` and
`crossref.test.ts` only after a consented run.

**First RED — layer 1 (region scanner).** `test/unit/qmd-model.test.ts`, new describe `"Session N —
quarto rewrites a brace tag on a BACKTICK fence before pandoc reads it (readqmd.lua:37-40)"`,
`it("a \`\`\` {{python}} verbatim block with a blank line inside keeps its own closer, so the heading
after it is not swallowed")`. Input: the lines of `scratchpad/s262/reach/probe_dd/dd2.qmd` —
`['---','title: dd2 probe','---','','``` {{python}}','#| echo: false','','x = 1','```','','## Hidden
One','','text','','```','plain','```','','## After Plain']`. Assert `findHeadings(text).map(h =>
h.text)` equals `['Hidden One','After Plain']` (quarto 1.7.33 renders both). **Today it returns
`['After Plain']`** (re-run by the main session): the group `{python` does not end the info
(`:5813-5815`), the no-block branch refuses any brace (`:5828`), and with the blank line inside, the
unconsumed closer opens a fence running to line 14.

**First RED — layer 2 (fence-id reader)**, written after the layer-1 checkpoint. `test/unit/refs.test.ts`:
`indexLabels` of `['~~~{#lst-i06}','x = 1','~~~']` contains `lst-i06` (quarto defines it under both
readers). **Today it returns `[]`**: `refs.ts:680` intercepts any brace-led info without `.` or `=`
and never tests the fence character.

**DONE.**
1. **Guards, green at HEAD (commit C1)** — synthetic texts, each with quarto's truth (the `p*` rows are
   from `scratchpad/s262/design-A-value/probe_docs.json` / `probe_results.json`; front matter
   `engine: markdown` omitted):
   - `p2`: `- ```{{python}}` / `  x = 1` / blank / `  # Hidden Two` / blank / `  ````` / blank / `# After` → `['Hidden Two','After']` (`FENCE_OPEN` is `^[ \t]*`-anchored, so a marker line is never a fence — the row guards a future widening); `p3`: the same behind `1. ` → `['Hidden Three','After']`.
   - `p7`: ```` ~~~{{python}} ```` / `x = 1` / blank / `# Hidden Seven` / blank / ```` ~~~ ```` / blank / `# After` → `['Hidden Seven','After']` (tilde: never rewritten).
   - `p8`: ```` > ```{{python}} ```` / `> x = 1` / `>` / `> # Hidden Eight` / `>` / ```` > ``` ```` / blank / `# After` → `['Hidden Eight','After']` (the physical line starts with `>`).
   - `p9`: ```` ```{{r}} extra ```` … `# Hidden Nine` … → `['Hidden Nine','After']`; `p10`: ```` ```{{python}}{.a} ```` … `# Hidden Ten` … → `['After']`.
   - `d2`: front matter, then ```` ```{}x ```` / `x = 1` / blank / `# Hidden A` / blank / ```` ``` ```` / blank / `# After A` → `['Hidden A','After A']` (not document start; re-rendered by the main session).
   - **`sp_gap` and `tab_gap`**: `d2` with ```` ``` {}x ```` and ```` ```<TAB>{}x ```` → `['Hidden A','After A']` (the gap is not part of the tag; `sp_gap` re-rendered by the main session, `tab_gap` by the review's safety lens).
   - **Render first, then pin:** a 4-space-indented ```` ```{{python}} ```` inside a list item with a blank line inside (unmeasured; fill-3 `Q4`).
   - fill-3's rows `q07`, `q08`, `q09`, `q12`, `q15` and the cascade control `c05` (texts in `scratchpad/s262/fill-3/docs.json` and `cascade_docs.json`) — right at HEAD and after P1, and no mutant can make them fail, so they are guards, not pins.
   - The Session 224/225 fence rows and refs' Session 223 guards stay green; `cells.test.ts:35` and `:296` stay green.
2. **RED→GREEN, as an ordered minimal-GREEN sequence** (so each step is red for its own reason; the
   second review built every step and confirmed each row turns where stated):
   1. `dd2` — GREEN writes the rewrite on the PHYSICAL line (the `p8` guard forces physical, not
      quote-stripped) with a column-0 anchor (```` /^`{3}/ ````), `documentStart = false`, and **keeps**
      the `:5848` clause.
   2. `p5` (a two-space-indented ```` ```{{python}} ```` block with a blank line → `['After']`) — RED under
      the column-0 anchor (it returns HEAD's `['Hidden Five','After']`); GREEN widens the anchor to
      quarto's ```` /^[ \t\f\v]*`{3}/ ````.
   3. fill-3 `l04` (```` ~~~{a} ```` / blank / `# Inside` / blank / ```` ~~~ ```` → `['Inside']`) — RED
      (the clause opens a tilde fence); GREEN deletes the `:5848` clause.
   4. `d0` (`['```{}x','x = 1','','# Hidden A','','```','','# After A']` → `['After A']`, re-rendered by
      the main session) — RED; GREEN adds `documentStart`.
   5. **Pins**, each made able to fail by a named mutant (DONE 9): `p1_top` (a top-level
      ```` ```{{python}} ```` block with a blank line → `['After']`; M0), `p4` (list continuation; M9),
      `p6` (four backticks; M10), the `cells.test.ts` row (a ```` ```{{python}} ```` block with a blank
      line, then a ```` ```{python} ```` cell carrying `#| label: fig-z` — `findAllCells` finds the python
      cell and `indexLabels` finds `fig-z`; HEAD finds neither; M0), the grid rows the rewrite now carries
      (`q03`–`q06`, `q10`, `q13`, `q16` newly fixed; `q11`, `q14` right at HEAD only through the deleted
      clause; M0), `l02` (M10), `l06` (M2, M3), and the cascades `c01`/`c02` (```` ```{{python}} ```` /
      ```` ```{{r}} ```` with a blank line inside, then `# After` and `# Tail`; M0).
   6. Layer 2: `lst-i06` — RED; GREEN deletes `refs.ts:680` and rewrites the scanned line. H6 stays green.
3. **The helper is LINEAR:** a row calls `quartoFenceTagRewrite("```" + "{".repeat(20000), "{".repeat(20000),
   documentStart)` for `documentStart` false and true, and asserts each returns in under 50 ms (the
   literal regex takes ~245 ms there; a braces-only physical line would fail the anchor and prove nothing).
4. **Residual, pinned:** `it("KNOWN RESIDUAL: a tilde fence with two brace groups keeps the location
   rule's deletion")` — `['~~~{a} {.b}','','# Inside','','~~~','','# After']` asserts HEAD's
   `['h1:After']`, with quarto's `['h1:Inside','h1:After']` in the comment; owned by P4. Beside it, two
   fill-3 cascade rows P1 leaves wrong (texts in `scratchpad/s262/fill-3/cascade_docs.json`), each a
   `KNOWN RESIDUAL` owned by P4: `c03` (```` ```{.a} {.b} ```` — HEAD and P1 `['h1:After','h1:Tail']`,
   quarto `['h1:Inside','h1:Tail']`: the location rule) and `c04` (```` ```{data-author=O'Brien} ```` —
   HEAD and P1 `['h1:Inside','h1:Tail']`, quarto `['h1:After','h1:Tail']`: `braceGroups` opens a quote at
   the apostrophe).
5. **Docs follow the code.** The clause and comment at `model.ts:5837-5850` and the intercept at
   `refs.ts:680` are replaced by the helper, whose comment cites `readqmd.lua:37-40` and `:95-100`, the
   physical-line anchor, the backtick-only scope, the tag's own length and the document-start star, and
   discloses the unmodelled propagation of a line-0 tag. **The stale-docs sweep** — `git grep -n -i -e
   intercept -e 'stage-1' -e 'stage 1' -- src test/unit` — has 25 hits at `7a2397e2`; each is rewritten
   or deleted except the one unrelated hit, `qmd-model.test.ts:11638` ("the band must not intercept it"):
   `model.ts:5797`, `:5837`, `:5838`, `:5848`, `:5931` (`CodeFenceOpener.contentStart`'s docstring);
   `refs.ts:643`, `:644`, `:654`, `:664`, `:667`, `:673`, `:680`; `qmd-model.test.ts:9525` (`b14`),
   `:9822`, `:9824`, `:9826` (C3); `refs.test.ts:1458`, `:1459` (H6), `:1632`, `:1635`, `:1636` (P3b),
   `:1653` (P5), `:1665`, `:1667` (P6). **The sweep cannot reach** the caller comment at `refs.ts:377-381`
   ("see `fenceAttributeId` for the two-stage grammar") — check it by eye, or with `git grep -n -i
   'two-stage' -- src test/unit`. `grep -rn quartoIntercepts src/core` is empty.
6. The gate is green: `npm test` (2,875 plus the new rows), `check-types`, `compile`, `check-package`.
7. **Census against P1's parent:** headings changedDocs 23 / added 41 / removed 6; cells 8 / 8 / 0;
   labels 2 / 2 / 0; `threw=0` (documents edited since 2026-09-14 aside). **Every changed document's
   path digest must be one of the 23 in `docs/planning/scripts/attribute-block/README.md` §"P1's expected
   changed set" — a digest outside it is a STOP.** Record changed documents in tracked files only by
   digest or page key, never by path.
8. **Direction.** Render COPIES of one checkout of each of the 9 pages the README marks "no — render in
   P1 DONE 8" into `scratchpad/sN/render/`, front matter forced to `engine: markdown`; **never render in
   the operator's own checkout**. (Their paths are enumerated in the design panel's P1 DONE 7,
   `scratchpad/s262/main/design_result.json`, rendered at `scratchpad/s262/main/synthesis.md`; match a
   path to its page key with the README's formula. Never paste the paths into a tracked file.) Record
   each restored heading, by page key, as rendered / not rendered / render failed. An unconfirmed
   ADDITION is recorded as a phantom (the permitted direction); a removal the render contradicts STOPS
   the phase.
9. **Mutants**, each killed by at least one row: **M0 `quartoFenceTagRewrite` returns `info` unchanged**
   (`dd2`, `p1_top`, the cells row, the carried grid rows and `c01`/`c02` fail — measured, it also kills
   `d0`, `p4`, `p5`, `p6` and `l02`); M1 rewrite the quote-stripped line instead of the
   physical line (`p8` fails); M2 rewrite tilde fences (`p7` fails); M3 restore the `:5848` clause (`l04`
   fails); M4 drop `documentStart` (`d0` fails); M5 restore `refs.ts:680` (`lst-i06` fails); M6 rewrite
   `info` only and scan the original line in refs (H6 fails); **M7 count the leading whitespace toward
   the tag's length** (`sp_gap` fails); **M8 restore the literal regex** (the linearity row fails);
   **M9 anchor at column 0 only** (`p5`, `p4` fail); **M10 exactly three backticks** (`p6` fails).
10. The oracle is a declared no-op: `! grep -q '```{{' test/oracle/corpus.ts && npm run test:oracle`
    still reports 131 documents: 124 agree, 4 lost TP, 3 cardinal FP (warm ~1 s needs the untracked
    `test/oracle/.quarto-cache.json`; cold ~1.5 min).
11. **Runtime gate (§9.4):** one `outline.test.ts` row with the `dd2` shape through
    `vscode.executeDocumentSymbolProvider` (mocha BDD: `it(`, never `test(`), and one `crossref.test.ts`
    row on an **in-memory** quarto document (copy `outline.test.ts`'s `openInMemory` helper — the crossref
    provider's selector is language-only, `src/providers/crossref.ts:22`; the shared on-disk fixture and
    its fixed click positions are not touched): `executeCompletionItemProvider` after `@` lists `lst-i06`
    and `fig-z`.

**Commands.**
```bash
npx vitest run test/unit/qmd-model.test.ts -t "BACKTICK fence"   # RED first (record it), then GREEN
npx vitest run test/unit/cells.test.ts test/unit/refs.test.ts
npm run check-types && npm test && npm run compile && npm run check-package
grep -rn 'quartoIntercepts' src/core                              # empty
git grep -n -i -e intercept -e 'stage-1' -e 'stage 1' -- src test/unit   # only qmd-model.test.ts:11638 left
git grep -n -i 'two-stage' -- src test/unit                        # refs.ts:377-381 rewritten by hand
mkdir -p scratchpad/sN/base && git archive <P1-parent-sha> src | tar -x -C scratchpad/sN/base
CENSUS_BASELINE=$PWD/scratchpad/sN/base CENSUS_OUT=$PWD/scratchpad/sN/census-identity.out CENSUS_CURRENT=$PWD/scratchpad/sN/base \
  npx vitest run --config docs/planning/scripts/attribute-block/vitest.census.config.ts   # identity: 0/0/0, threw=0 (time it)
CENSUS_BASELINE=$PWD/scratchpad/sN/base CENSUS_OUT=$PWD/scratchpad/sN/census-p1.out \
  npx vitest run --config docs/planning/scripts/attribute-block/vitest.census.config.ts   # 23/41/6 · 8/8/0 · 2/2/0, threw=0
# the fence grid, HEAD→P1, without touching scratchpad/s262:
sed "s#\.\./\.\./\.\./src#$PWD/scratchpad/sN/base/src#" scratchpad/s262/fill-3/fh.ts > scratchpad/sN/fh_base.ts
sed "s#\.\./\.\./\.\./src#$PWD/src#"                   scratchpad/s262/fill-3/fh.ts > scratchpad/sN/fh_impl.ts
for b in base impl; do npx esbuild scratchpad/sN/fh_$b.ts --bundle --platform=node --format=cjs --outfile=scratchpad/sN/fh_$b.cjs; done
# a copy of compare_grid.py that reads fill-3 by absolute path and takes both bundles as arguments
# (all four edits it needs; the second review ran exactly this and got the numbers below):
sed -e 's/^import json, os, subprocess, collections$/import json, os, subprocess, collections, sys/' \
    -e "s#os.path.join(HERE, \"..\", \"fill-3\")#\"$PWD/scratchpad/s262/fill-3\"#" \
    -e 's#run(os.path.join(F3, "fh.cjs"), #run(sys.argv[1], #' \
    -e 's#run(os.path.join(HERE, "fh_p1.cjs"), #run(sys.argv[2], #' \
    scratchpad/s262/design-A-value/compare_grid.py > scratchpad/sN/cg.py
python3 scratchpad/sN/cg.py scratchpad/sN/fh_base.cjs scratchpad/sN/fh_impl.cjs
#   expect: exactly the 10 rows above move to agree and none move the other way; md DELETION 29 / PHANTOM 7
#   after P1; md lst labels 78 ok / 1 fixed (i06) / 13 wrong
mkdir -p scratchpad/sN/mut && git archive HEAD | tar -x -C scratchpad/sN/mut && ln -s "$PWD/node_modules" scratchpad/sN/mut/node_modules
! grep -q '```{{' test/oracle/corpus.ts && npm run test:oracle     # 131 / 124 / 4 / 3
quarto render scratchpad/sN/render/<page>.qmd --to html --quiet     # each copied page
npm run test:integration                                            # ONLY per §9.4
```

**Surface.** Local machine, headless: vitest over `findHeadings`, `findAllCells` and `indexLabels`;
the census over the operator's personal corpus; fill-3's 92 × 2 grid with quarto 1.7.33 render truth;
`quarto render` of synthetic rows and copied pages; `test:oracle`; the Extension Development Host per §9.4.

**What that surface cannot enforce.**
- The census is model against model — no direction. Direction comes only from renders (fill-3
  `verify.py`, Session 251's, DONE 8); Session 251's ground truth is keyed by path and stale for 3
  documents. No phase runs the three-way scorer the README pins.
- Renders forced to `engine: markdown` skip a page's knitr/jupyter pass. They are faithful here only
  because knitr's chunk regex (mirrored at `document-engine.ts:514`) cannot match `{{lang}}`.
- Other quarto versions, or a `readqmd.lua` whose patterns change.
- **Not modelled:** readqmd then rewrites that same tag string after EVERY later line-start backtick run
  in the document (0 corpus documents start with a ```` ```{} ```` fence); VT/FF between the fence run and
  the tag; readqmd's `*` pattern is anchored at every `find` start (`readqmd.lua:41-47`), so an empty
  `{}` tag can follow an earlier tag on the same line. All filed (§8).
- **Region views beyond the three censused** move with the fence regions in the 23 documents (§6): body
  lines (math regions, reference-able lines), cell-option lines, cell backgrounds, Run Cell/CodeLens,
  `#|` completion and diagnostics, and Pylance virtual documents (`test:lsp` is not run). Engine
  resolution is unaffected (`document-engine.ts` imports nothing from the model).
- The Outline and cross-reference adapters are exercised only per §9.4.

**Commits.** C1 (3 files): guard rows in `qmd-model.test.ts`, `refs.test.ts`, `cells.test.ts`. C2 (3):
`model.ts`, `qmd-model.test.ts`, `cells.test.ts` — the layer-1 checkpoint. C3 (2): `refs.ts`,
`refs.test.ts` — the layer-2 checkpoint. C4 (2): `outline.test.ts`, `crossref.test.ts` — only per §9.4.
Close-out per the rules above; its `BACKLOG.md` removal of the ```` ```{{lang}} ```` item rides with its
`CHANGELOG.md` entry.

**Revert point.** P1's parent. C1 changes no behaviour; C2 alone is a safe resting state (the model is
faithful, refs keeps its pre-existing tilde miss); C3 reverts on its own.

**Slice.** A pre-declared VERTICAL SLICE — one capability (fences read after quarto's tag rewrite)
across L1 region scanner (C2), L2 fence-id reader (C3) and the adapter rows (C4).
- **Gate (a):** this plan, once approved; at Orient, §9.5 step 1 over P1's files —
  `src/core/qmd/model.ts src/core/refs.ts test/unit/qmd-model.test.ts test/unit/refs.test.ts
  test/unit/cells.test.ts test/integration/suite/outline.test.ts test/integration/suite/crossref.test.ts`
  — shows nothing but this plan's earlier phases; these phrases resolve: `function fenceInfoOpensBlock(`,
  `if (quartoIntercepts && block.start === 0`, `!fenceInfoOpensBlock(fence[3]`, `const raw = lines[i];`,
  refs' `if (quartoIntercepts && info.startsWith`, `fence.contentStart === 0,`.
- **(b)** every checkpoint ≤ 5 files. **(c)** the full gate at each boundary; the census after C2.
  **(d)** truth is quarto render, cited per row; the census is non-regression evidence only.
- **Tier:** all layers on the strongest tier (the gates are judgement-heavy); no layer delegated.

**Session boundary.** One session. Close out when DONE is met; do not start P2.

### P2 — The tokenizer; accepted and one-word `:::` openers are read through it (markdown family)

**Capability.** For markdown-family documents, a `:::` opener pandoc accepts — or turns into a
one-literal-class div — is classified from pandoc's own tokens (ordered classes and the FIRST title),
replacing the regexes over `maskQuotedValues`. Every shape the tokenizer is not yet faithful for keeps
HEAD's reading byte for byte (§2.5).

**Depends on:** nothing in code (P1's commits, or none).

**Value and reach: 0 corpus documents** (the div readers agree with pandoc on all 240 distinct live
tails in 477 documents). What changes for a reader who writes one of these spellings: the Outline stops
deleting a heading quarto renders, or stops showing one quarto lifts — `data-author=O'Brien
title='Note'` (the item's "most plausible real spelling"); `title="How .panel-tabset works"` (deletes
every tab-level heading in the div); `{.panel-tabset.foo}`; an escaped quote; `data-x=a"b title="T"`;
`class="callout-note"`; `{-.callout-note}`; `{.callout-note#été}`; `callout-note :::`; a leading-NBSP
spec; `class="callout-note<NBSP>x"`; a bare NBSP title. Probe level (div-readers `table.json`,
rendered): 12 LOST (`t01`, `t02`, `t05`, `m01`–`m05`, `m09`, `m11`, `r08`, `r12`) and 8 PHANTOM (`t03`,
`t04`, `t08`, `t09`, `m10`, `r07`, `r16`, `r18`), plus fill-2's 7 markdown bare-Unicode-space title
deletions. None of the 20 group rows hits a P2 null route (review critic). It closes *"the TABSET reads
never got Session 259's three fixes"* and *"`maskQuotedValues` pairs quote characters blindly"* for
markdown-family documents, plus the accepted-shape rows of *"The attribute spec is matched with regexes
and never TOKENIZED"*.

**Files.** `src/core/qmd/attribute-block.ts` (new), `test/unit/attribute-block.test.ts` (new),
`test/unit/attribute-block-truth.json` (new; synthetic spec strings only), `docs/planning/scripts/attribute-block/truth.mjs`
(new), `src/core/qmd/model.ts`, `test/unit/qmd-model.test.ts`; `outline.test.ts` per §9.4.

**First RED — layer 1 (leaf).** Create the file first, exporting the P2 signatures with bodies that
return `{ kind: 'refused', reason: 'invalid-token' }`. Then in `attribute-block.test.ts`, describe
`"divOpenerVerdict — pandoc div-fence production, markdown family"`, `it("a quote opens only as the
first character of a value, so the apostrophe in O'Brien is content")`: `divOpenerVerdict(" {.callout-note
data-author=O'Brien title='Note'}", { commonmarkDialect: false, pandocEscapes: true })` equals `{ kind:
'attr', attr: { id: '', classes: ['callout-note'], kvs: [{ key: 'data-author', raw: "O'Brien", quote:
null }, { key: 'title', raw: 'Note', quote: "'" }] } }` — pandoc's `Div ("",["callout-note"],
[("data-author","O'Brien"),("title","Note")])`, re-measured by the main session.

**First RED — layer 2 (model)**, shown RED at Orient and written after the layer-1 checkpoint, in a new
describe `"Session N — a ::: opener is classified from pandoc's own tokens (markdown family)"`:
`names(['## Before','','::: {.callout-note data-author=O\'Brien title=\'Note\'}','','## Inside One','',
'body one','','## Inside Two','','body two','',':::','','## After'])` equals `['h2:Before','h2:Inside One',
'h2:Inside Two','h2:After']` (quarto render of div-readers `m03`, callout title `Note`). **HEAD returns
`['h2:Before','h2:Inside Two','h2:After']`**: `maskQuotedValues` pairs the apostrophe in O'Brien with
the opening quote of `'Note'`, masking `title=`, so the explicit-title exit never fires.

**DONE.**
1. **Layer 1, test-first, one measured row per cycle.** Derive rows from
   `scratchpad/s262/pandoc-markdown/results.md`, div-readers `native.json` and
   `design-J1-correctness/fallback_tail_probes.json` — **do not paste `reference.ts`**. Cover:
   separators (ASCII space/TAB only; an NBSP-joined spec is one word); `#id` (IdChar+, digit first OK,
   combining marks refuse); `.class` (letter first; `.a.b` one class; `.a#b` glues an id); `-` →
   `unnumbered` (alone, spaced, glued; `-x` refuses); keys (letter first; **whitespace BEFORE `=` is a
   bare key and refuses — K11; after `=` the bare value may be empty — `k= .c` → k="" + class c, K14;
   `k= #i` → k="" + id i, K15; `k= v` refuses at the bare word — K12**); quoted values (**pandoc's quote
   fallback**: `title=" zz"` refuses at `zz"`; `title=" ` + [ \t]* to end of line is open-at-eol; NBSP-led
   re-read as bare, quotes included); escapes stepped over per `pandocEscapes`; **B26's two EXPANDED spellings**
   (`{k=a\   b}`, the TAB expanded to 3 spaces, refuses; `{k=a\ b}`, expanded to 1, is accepted — the
   leaf never sees a TAB);
   bare values (end at ASCII space/TAB or `}`; may be empty); the fold (last id wins; `id=` sets;
   `class=` splits in place on [\t\n\v\f\r] or \p{Zs}; duplicate keys kept); the div production
   (attributes | word, then `[ \t]*:*[ \t]*` to end, no word retry after a parsed block); open-at-eol;
   `commonmarkDialect` → `unmeasured`.
2. **The leaf test:** after stripping comments, `attribute-block.ts` has no `import`, no `\s`, no `.trim(`.
3. **Conformance:** a test replays `attribute-block-truth.json` — verdict kind, **`fallback`**, id,
   classes and kv keys match on every row whose module verdict is not open-at-eol; open-at-eol rows are
   counted, and each has `at === spec.length` through `parseAttributeBlock(spec, spec.indexOf('{'),
   dialect)`; a kv value is compared where pandoc's value equals the raw text, and each row where they
   differ (an escape or entity) is a `KNOWN RESIDUAL` row asserting the raw value, with pandoc's decoded
   value in the comment. **The fixture carries a second, CONTINUATION framing** (`::: <spec>` / `}` /
   blank / `x` / blank / `:::`): every row whose `divOpenerVerdict` kind is `refused` — whatever the
   reason; that is P3's predicate — must be refused there too — the
   check that "final on one line" really is final. Any other red row is the next TDD cycle. The harness
   expands each fixture spec's TABs from its column in `::: <spec>` before calling the leaf.
4. **`truth.mjs`'s own controls** (it holds classification logic; §12.3 asks whether that is enough): at
   least ten hand-checked specs with their expected class, asserted by `truth.mjs --check` — `attr`;
   `word` fallback:false (`callout-note :::`, and the leading-NBSP spec); `word` fallback:true
   (`{.callout-note!} :::`, `{callout-tip} `, and `{.a` — in the one-line framing pandoc makes it a `{.a`
   div, so the leaf's open-at-eol row shows there as fallback:true); `refused` (`{.a}x`, `{.callout-note
   title}` — truth.mjs derives no reason, so its controls assert the kind only); and B26's two expanded
   spellings.
5. **Layer-2 guards, green before the edit** (an optional 1-file commit): `::: {.callout-note title=
   .x}` keeps `Inside` (fill-0 A1; re-rendered by the main session); `::: {.callout-note
   data-x="{{< meta t >}}"}` keeps `Inside` (f01); under `from: commonmark_x`, `::: {class="callout-note
   x"}` keeps `Inside`; the FIRST title wins (`title="" title="x"` lifts); a bare `title=<U+FEFF>`
   lifts, as quarto does (the U+FEFF route; fill-2 `x2_md_bare_ufeff`); R4/R7's `title="   "` rows keep
   their expectation through the legacy route; **the twelve classes BACKLOG's *"RECORD — the div classes
   measured NOT to consume a heading"* lists each keep a heading placed after a blank line**
   (`.column-margin`, `.aside`, `.hidden`, `.cell`, `.card`, `.panel-sidebar`, `.panel-input`,
   `.column-body`, `.columns`, `.unnumbered`, a `::: {#fig-…}` div, bare `.tabset`; only `.tabset` is
   pinned today, `qmd-model.test.ts:17214`); every Session 257–261 pin stays green (0 of 119 distinct
   test openers flip).
6. **Layer-2 RED→GREEN, one row per cycle:** the O'Brien row; then the 20 group rows above; the
   markdown `class="callout-note<NBSP>x"` row (`['h2:Before','h2:After']`); div-readers `s04`
   (`::: callout-note :::`), `s32` (a LEADING NBSP — pandoc reads the WORD `<NBSP>{.callout-note}`, a
   plain div, fallback:false), `s03`/`s36` (trailing colon run); fill-2 `md_bare_nbsp`. Each cites its
   rendered witness; pins that pass on arrival are counted apart.
7. `divFenceRole` returns `tail`; the push-site calls (`calloutTitleSlot:
   divCalloutTitleSlot(divFence!.attrs),` / `isTabset: divPanelTabset(divFence!.attrs),`, `:8365`/`:8367`)
   pass the tail and the reader. `maskQuotedValues` and `calloutClassIndex` are reached only from the two
   legacy bodies, whose docstrings name the six null routes and the filings that hold them. **Sweep by
   symbol:** `grep -n -w 'divCalloutTitleSlot\|divPanelTabset' src/core/qmd/model.ts` — every comment hit
   (`:4117`, `:4250`, `:4253`, `:6447`, `:6450` at `7a2397e2`) describes the dispatcher or the legacy
   body it now names. Add one sentence to the note at `model.ts:2096-2098` saying that the div-path
   consumers of the `from:` flags now classify on markdown's grammar, and so misread a document whose
   reader a project file sets (do not claim the note was a global invariant before).
8. **Mutants:** M1 take the LAST title (the first-title row fails); M2 drop the `=` route (A1 fails); M3
   drop the `{{<` route (f01 fails); M4 route commonmark_x through the tokenizer (the commonmark_x
   `class=` row fails); M5 split `class=` on ASCII only (the NBSP class row fails); M6 trim the tail
   (`s32` fails); **M7 treat any class starting `callout` or containing `tabset` as a handler (a guard
   from the RECORD item's twelve classes fails — `.tabset`, the only one of the twelve M7 reaches)**; **M8 treat a quote
   followed by whitespace to end of line as a final invalid-token (a continuation-framing conformance row
   fails)**; **M9 drop the U+FEFF route (the `title=<U+FEFF>` guard fails)**.
9. The gate is green, and `node docs/planning/scripts/attribute-block/truth.mjs --check` exits 0.
10. The census against P2's parent: **0 changed documents in all three views, `threw=0`** — P2 is where
    a new scanner first runs on every opener tail in 477 corpus documents, so a throw here is the
    likeliest place the Outline would empty.
11. Runtime gate (§9.4): one outline row with the `m03` shape.

**Commands.**
```bash
npx vitest run test/unit/attribute-block.test.ts
node docs/planning/scripts/attribute-block/truth.mjs --check   # ONE quarto pandoc call per dialect and framing, diffed against the committed fixture
npx vitest run test/unit/qmd-model.test.ts -t "Session N"
npm run check-types && npm test && npm run compile && npm run check-package
grep -n '^import' src/core/qmd/attribute-block.ts              # empty (the leaf test asserts the same)
grep -n -w 'divCalloutTitleSlot\|divPanelTabset\|maskQuotedValues\|calloutClassIndex\|legacyDivCalloutTitleSlot\|legacyDivPanelTabset' src/core/qmd/model.ts
mkdir -p scratchpad/sN/base && git archive <P2-parent-sha> src | tar -x -C scratchpad/sN/base
CENSUS_BASELINE=$PWD/scratchpad/sN/base CENSUS_OUT=$PWD/scratchpad/sN/census-p2.out \
  npx vitest run --config docs/planning/scripts/attribute-block/vitest.census.config.ts   # 0 / 0 / 0, threw=0
npm run test:integration                                        # ONLY per §9.4
```

**The fixture generator** (`truth.mjs`) writes every synthetic spec in two framings — `::: <spec>` +
blank + `x` + blank + `:::`, and the continuation framing above — separated by sentinel paragraphs, in
ONE `quarto pandoc -f markdown -t json` call per dialect (plus `-f markdown_strict+fenced_divs` for
`pandocEscapes=false`); TAB rows are written at two columns. It classifies: a Div whose Attr is
`("", [w], [])` with `w` equal to the tail's first `[^ \t]+` run is `word` (fallback iff `w` starts with
`{` — an accepted block can never yield a class containing `{`); any other Div is `attr`; no Div is
`refused`. The fixture header records pandoc 3.6.3 and the regeneration command. **It is deliberately
raw pandoc**: the leaf models pandoc's grammar, and quarto's `:::` pre-passes are routed around by the
caller.

**Surface.** Local machine, headless: vitest; the fixture generator against live `quarto pandoc`
3.6.3; the census over the corpus — the real surface this change could damage (138 callout suppressions
in 71 documents, 151 tabset suppressions in 46, 184 glued headings in 94); the Extension Development
Host per §9.4.

**What that surface cannot enforce.** No corpus document exercises a fixed shape, so a census of 0 is
non-regression evidence only; every fix is a synthetic row with a rendered witness. The fixture is raw
pandoc, blind to quarto's reader view (those shapes are routed to HEAD and carried by render-checked
guards). The `=` route is broader than quarto's fix-up, so e.g. `{.panel-tabset.foo title="a = b"}` stays
on HEAD's reading. Values are raw, so `title="&#32;"`-type phantoms remain. **A reader set by a project
`_quarto.yml` is invisible**: in such a project P2 classifies on markdown's grammar and can hide a heading
quarto renders (§2.5). CommonMark-family documents are unchanged by construction; multi-line openers stay
HEAD's; the notebook renderer is untouched.

**Commits.** Layer 1 checkpoint (4 files): the leaf, its test, the fixture, the generator. Layer 2: an
optional guard commit (1 file), then the checkpoint (2 files: `model.ts`, `qmd-model.test.ts`). The
runtime row (1 file) per §9.4. Close-out per the rules above.

**Revert point.** Per SESSION_RUNNER §Vertical Slice Sessions: **the layer-1 checkpoint is the declared
in-session cut line.** If layer 2 cannot produce its evidence, the session closes out at that checkpoint
and records layer 2 as in progress — the leaf is inert there (nothing imports it; tree-shaken from both
bundles). Reverting to P2's parent instead, so that no unused module sits in the tree, is a deviation the
operator must choose explicitly.

**Slice.** A pre-declared VERTICAL SLICE — one capability (`:::` openers classified from pandoc's
tokens) over L1 (the leaf, its fixture, generator and tests) and L2 (the model.ts consumer and its
rows). Gate (a): §9.5 step 1 over P2's files — `src/core/qmd/model.ts src/core/qmd/attribute-block.ts
test/unit/qmd-model.test.ts test/unit/attribute-block.test.ts test/unit/attribute-block-truth.json
docs/planning/scripts/attribute-block/truth.mjs test/integration/suite/outline.test.ts`; these phrases
resolve: `function maskQuotedValues(`, `function divCalloutTitleSlot(`, `function divPanelTabset(`,
`function calloutClassIndex(`, `attrs: m[1].trim(),`, `calloutTitleSlot: divCalloutTitleSlot(divFence!.attrs),`,
`isTabset: divPanelTabset(divFence!.attrs),`. (b) checkpoints of 4 and 2 files. (c) the full gate at each
boundary. (d) L1's truth is pandoc's own Attr, regenerated live by `--check`; L2's truth is quarto
render, cited per row. **Tier:** strongest tier throughout.

**Session boundary.** One session. Close out when DONE is met; do not start P3. **P2 is the stop point
that leaves the div stack untouched.**

### P3 — A `:::` opener pandoc refuses on its own line is paragraph text, not a div

**Capability.** When `divOpenerRefused` holds (§2.2), `computeRegions` keeps role `open`, forces
`unmatchedConstruct=true` in the open arm (`:8354`) and pushes no `divColumns` entry (`:8360`). The line
then neither opens a div nor closes the paragraph above it, and its `:::` closer pairs as pandoc pairs
it. This is the only encoding measured safe (fill-1 patchB/patchC: 43/43 structural probes). **Only
verdicts final on ONE line are refused; an opener that is open at end of line keeps HEAD's reading,
whatever the next line holds.**

**Depends on:** P2 (the leaf's verdict).

**⚠ This phase changes the `divColumns` push, which Session 262's claim note put out of scope.** That
note ("not the `divColumns` push") was the planner's guess before the research; the research measured
it wrong. A refusal can only be delivered through the push: reading a refused spec as a plain div
(patchR) keeps 6 tabset re-pairing deletions and breaks 8 rows HEAD gets right; unmatched-only keeps all
22 deletions; no-push-only adds 12 phantoms. The change is confined to single-line refusals on the
measured readers; the item *"`divColumns` is pushed for `:::` lines that are not divs at all"* stays open
for its raw-TeX, comment and no-div-reader cases, and the Session 261 R6 pins (`qmd-model.test.ts:18179-18211`)
do not flip.

**Why no blank-line rule.** An earlier draft also refused an open-at-eol opener followed by a blank
line. The plan review measured that rule wrong twice: a value ending in an odd run of `\` carries across
the blank line (backslash-newline is an escaped character — re-measured by the main session: `title="x\`
/ blank / `y"}` is a callout titled `x y`, and refusing it deletes the heading below its closer), and its
only fixes are zero-reach nested and glued shapes (the model already shows the heading below `title="x`
and `title=` in a flat document). It is filed (§8), with its evidence.

**Value and reach: 0 corpus documents** (0 of 1,884 corpus opener lines are refused). What changes for
a reader: a `:::` line pandoc refuses on its own line no longer hides the heading below it — a typo, or
**the bare-key state an author types through, `::: {.callout-note title}`** (re-measured: pandoc makes
it paragraph text and renders the `## H` below; HEAD returns `[]`). It also stops a refused inner opener
in a tabset from re-pairing the closers (history `d10`, fill-1 `r5`). Probe level: fill-1's 43
structural probes — HEAD 11 DELETE, 6 PHANTOM; patchB/patchC 43/43 — plus div-readers `r01`, `r02`,
`r03`, `r06`; each is recorded as reached or unreached by a single-line refusal. It closes the
single-line refused-opener rows of *"The attribute spec is matched with regexes and never TOKENIZED"*
and `d10`.

**Files.** `src/core/qmd/model.ts`, `test/unit/qmd-model.test.ts`; `attribute-block.ts` and its test
only if a refusal reason needs correcting; `outline.test.ts` per §9.4.

**First RED.** `qmd-model.test.ts`, describe `"Session N — a ::: opener pandoc refuses is paragraph
text"`, `it("a bare key refuses the block, so the blank-separated heading below renders (fill-1 r3)")`:
`names(['::: {.callout-note title}','','## H','',':::'])` equals `['h2:H']`. **HEAD returns `[]`**
(re-run by the main session): `DIV_FENCE` opens a div for any non-empty tail, the push records a
callout with no title, and `calloutTitleTakes` lifts `## H`. The row is still red after P2, which routes
refused specs to HEAD's reading — so it fails for exactly the missing refusal.

**DONE.**
1. **Guards, green before the edit (commit C1).** Texts are synthetic; keys are from
   `scratchpad/s262/fill-1/probes.json` (full keys given) and `false_refusal_docs.json`, truth from
   `truth.json` / `false_refusal_truth.json`:
   - **The 8 rows the null encoding breaks**, each `[]` unless noted: `r1_para_above_glued` (`Some text` /
     `::: {.callout-note title}` / `## H` / `:::`); `r2_glued_no_para` (`::: {.callout-note title}` /
     `## H` / `:::`); `Q1_quote_glued` (`> ::: {.callout-note title}` / `> ## H` / `> :::`);
     `Q5_quote_para_above_glued` (`> Some text` / `> ::: {.callout-note title}` / `> ## H` / `> :::`);
     `Q6_quote_lazy_glued_heading` (`> ::: {.callout-note title}` / `## H`);
     `I8_callout_refused_in_callout_glued` (`::: {.callout-note}` / blank / `Intro.` / blank / `::: {.callout-note
     title}` / `## H` / `:::`); `C1_itemcol_glued` (`- item` / blank / `  ::: {.callout-note title}` / `  ##
     H` / `  :::`); `G_bare_key__glued` (`::: {.callout-note title}` / `## H` / `:::` / blank / `## After`
     → `['h2:After']`).
   - **False-refusal controls:** `F1_stray_closer_glued_tail` (`::: {.callout-note}` / blank / `Intro.` /
     blank / `::: {.note}` / blank / `body` / blank / `:::` / blank / `:::` / `## Tail` → `['h2:Tail']`);
     `F4_glued` (`::: {.note}` / `## H` / `:::` → `['h2:H']`).
   - **The routes and gates:** the `=` repair, glued so the route is visible — `G_kv_space_after__glued`
     (`::: {.callout-note title= "x"}` / `## H` / `:::` / blank / `## After` → `['h2:H','h2:After']`:
     quarto's fix-up makes it a callout titled `x`) and `eqB` (`::: {.callout-note title= "x"}` / blank /
     `body` / blank / `:::` / `## After` → `['h2:After']`), both green at HEAD and render-checked;
     `X2_callout_dataxzz_blank_cmx` (`from: commonmark_x`; `::: {.callout-note data-x=" zz"}` / blank /
     `## H` / blank / `:::` / blank / `## After` → `['h2:After']`); and `r1` under `from:
     markdown-blank_before_header`, a reader the gate admits, keeps HEAD's answer.
   - **TAB columns** (render first, then pin at quarto's answer): `> ::: {.callout-note k=a\<TAB>b}` and
     `- ::: {.callout-note k=a\<TAB>b}`, each followed by a blank-separated heading — pandoc ACCEPTS both,
     because the TAB's PHYSICAL column expands it to one space (the second review's probes); expanding
     from the stripped line's column 0 gives three spaces and a refusal.
   - **Open at end of line stays HEAD's** (the dropped rule): the one-word fallback in a tabset
     (`::: {.panel-tabset}` / blank / `## Tab A` / blank / `::: {.a` / blank / `x` / `:::` / blank / `## Tab B`
     / blank / `:::` → `[]`; re-measured: pandoc makes `{.a` a one-class div, both tabs stay tabs); the
     backslash-newline callout (`::: {.callout-note title="x\` / blank / `y"}` / blank / `body` / blank /
     `:::` / `## After` → `['h2:After']`; re-measured); the quote fallback (`::: {.note title=" ` / `}` /
     blank / `body` / blank / `:::` / `## After`, and its `data-x=" ` twin → `['h2:After']`; the review's
     safety lens rendered both).
   - **KNOWN RESIDUAL rows** (HEAD's value asserted, quarto's in the comment; each owned by §8's deferred
     item): the nested open-at-eol row (`::: {.panel-tabset}` / blank / `## Tab A` / blank / `x` / blank /
     `::: {.note title="x` / blank / `inner` / `:::` / blank / `## After Inner` / blank / `:::`: HEAD `[]`,
     quarto `['h2:After Inner']` — re-rendered by the main session); the glued phantom (`::: {.callout-note
     title="x` / blank / `## H` / blank / `:::` / `## After`: HEAD `['h2:H','h2:After']`, quarto
     `['h2:H']`); `W1` (`::: {.note title=" ` / `}` / `## H` / `:::` / blank / `## After`: HEAD
     `['h2:After']`, quarto `['h2:H','h2:After']` — pandoc makes it a plain `.note` div); the fix-up-blocked
     `b16` (`::: {.callout-note data-x= y}` plus three trailing spaces) and `b28`
     (`::: {.callout-note data-x= y title}`), each with a blank-separated `## Inside` and `## After`:
     quarto `['h2:Inside','h2:After']` — these two flip legitimately only when the fix-up is modelled;
     dropping the `=` route also flips them, and deletes `## H`/`## After` elsewhere (M9). **The unmeasured
     readers:** the `r2`, `r3` and `d10` shapes under `from: markdown_strict+fenced_divs`,
     `markdown_phpextra+fenced_divs`, `markdown_mmd+fenced_divs` and `markdown_github+fenced_divs` — 12
     rows, each asserting HEAD's `[]`, with quarto's render in the comment (`r2`/`r3` → `['h2:H']`, `d10` →
     `['h2:After Inner']`). Invert one only once that reader's refusal structure has been measured and the
     gate widened deliberately; admitting the reader alone is mutant M6, not a fix.
2. **RED→GREEN:** `r3`; `r5`/`d10` (`::: {.panel-tabset}`, blank, `## Tab A`, blank, `x`, blank,
   `::: {.note title}`, `inner`, `:::`, blank, `## After Inner`, blank, `:::` → `['h2:After Inner']`; HEAD
   `[]`: the push records the refused inner opener, its `:::` pops that entry, and `## After Inner` stays a
   tab); then each remaining single-line HEAD deletion and phantom among the 43 structural probes and
   `r01`, `r02`, `r06`; and `r2` under `from: markdown-blank_before_header` (→ `['h2:H']`; HEAD `[]` — a
   pin once `r3` is GREEN). Pins counted apart.
3. **One predicate.** The open arm gains `|| divRefused`, the push guard gains `&& !divRefused`; `grep -n
   divRefused src/core/qmd/model.ts` shows exactly the declaration and those two uses; no path sets
   `divFence` to null for a refusal; `measuredRefusalReader` is computed once, beside `const
   fencedDivsDialect`.
4. **Correct the comments, not the expectations:** R4 (`qmd-model.test.ts:16446-16460`), R7
   (`:18035-18042`) and `model.ts:4141-4147` say `title="   "` is a blank-looking title; under markdown
   pandoc REFUSES it. Refute the replacement prose against the measurement before committing it
   (Learning #119).
5. **Mutants:** M1 keep the push (`r5`, `C5`, `P3` fail); M2 no push but unmatched stays false (`r2`,
   `Q1`, `Q6` fail; `r1` does not — `divOpenerInterrupts` already forces it unmatched and unpushed); M3
   encode refusal as `divFenceRole(...) === null` (the 8 guards fail); M4 refuse
   `{.note}` (`F1`, `F4` fail); M5 drop the commonmark gate (`X2_cmx` fails); **M6 admit the unmeasured
   markdown readers** (a strict/phpextra/mmd/github KNOWN RESIDUAL row flips — the mutant, not a fix);
   **M7 refuse an open-at-eol opener
   followed by a blank line** (the backslash-newline guard fails); **M8 treat a quote followed by
   whitespace to end of line as refused** (the quote-fallback guard fails); **M9 drop the `=` route
   from `divOpenerRefused`** (`G_kv_space_after__glued` and `eqB` fail — P2's A1 and f01 do not react to
   it); **M10 expand the tail's TABs from the stripped line's column 0** (a TAB-column row fails).
6. **Re-score the six closer-pairing items** — before and after, recording before / after / moved? for
   each in the close-out: *"A block quote directly under a DIV OPENER is invisible to the setext path, at
   every column"*; *"A PHANTOM: an OUTER top-level div plus an inner one in a list item, both closed by
   column-0 closers"*; *"A div opened INSIDE a block quote and closed OUTSIDE it"*; *"The phantom the quote
   suspension buys back"*; *"A fenced div's CLOSER does not pop a container opened INSIDE it, so the stale
   content column outlives the div"*; *"The CLOSER-LINE exemption retains phantoms on purpose, and could be
   closed by tracking div nesting"*.
7. The gate is green. The census against P3's parent: 0 in all three views, `threw=0`. **The positive
   control:** the same census over fill-1's 98 probe files (`CENSUS_LIST=scratchpad/s262/fill-1/ctrl_list.txt
   CENSUS_MIN_READ=1`) must change **exactly the 23 non-`_cmx` documents patchC changed**
   (`scratchpad/s262/fill-1/census_ctrl_patchC.out`), each to patchC's headings
   (`scratchpad/s262/fill-1/model_patchC.json`), and **none of the 10 `_cmx` documents patchC changed** —
   a changed `_cmx` document is mutant M5 in the wild: STOP. Compare path SETS, not files: the reference
   is fill-1's older 4-field format (`CHANGED\t<path>\t…`, the path in column 2) and the committed tool
   writes `CHANGED\t<view>\t<path>\t…` (column 3); map a path to `model_patchC.json` by its basename without
   `.qmd`. If `scratchpad/s262/fill-1` has been pruned,
   this step is skipped with the reason recorded.
8. Runtime gate (§9.4): one outline row with the `r5`/`d10` shape.

**Commands.**
```bash
npx vitest run test/unit/qmd-model.test.ts -t "Session N"       # guards green, then RED, then GREEN
npm run check-types && npm test && npm run compile && npm run check-package
grep -n 'divRefused' src/core/qmd/model.ts                      # declaration + the :8354 arm + the :8360 guard
mkdir -p scratchpad/sN/base && git archive <P3-parent-sha> src | tar -x -C scratchpad/sN/base
CENSUS_BASELINE=$PWD/scratchpad/sN/base CENSUS_OUT=$PWD/scratchpad/sN/census-p3.out \
  npx vitest run --config docs/planning/scripts/attribute-block/vitest.census.config.ts   # 0 / 0 / 0, threw=0
CENSUS_BASELINE=$PWD/scratchpad/sN/base CENSUS_OUT=$PWD/scratchpad/sN/census-p3-ctrl.out \
  CENSUS_LIST=scratchpad/s262/fill-1/ctrl_list.txt CENSUS_MIN_READ=1 \
  npx vitest run --config docs/planning/scripts/attribute-block/vitest.census.config.ts   # exactly the 23, none of the _cmx 10
npm run test:integration                                         # ONLY per §9.4
```

**Surface / what it cannot enforce.** Vitest; the census over the corpus and over fill-1's probe files;
the Extension Development Host per §9.4. **The corpus cannot fail this phase** — 0 corpus opener lines
are refused — so the fixes exist only in synthetic rows. **The `=` route keeps HEAD's reading, and its
deletions, on 9 fix-up-blocked refused shapes** (fill-0 `b16`, `b19`, `b20`, `b28`, `b29`, `T4`, `Q1`,
`Q3`, `Q4`). Open-at-eol openers, readers without `fenced_divs`, the unmeasured markdown readers,
CommonMark-family documents and multi-line openers are deliberately untouched. **A reader set by a
project `_quarto.yml` is invisible** (§2.5): there P3 can refuse an opener quarto accepts. **refs still
mints ids from refused openers**: `::: {#fig-x .callout-note data-x=" zz"}` indexes `fig-x` at HEAD while
pandoc makes the line a paragraph with no id — after P3 the model and refs disagree on that line (filed).

**Commits.** C1 (1 file): the guard rows. C2 (2 files): `model.ts`, `qmd-model.test.ts` (4 files if a
refusal reason in the leaf needs a fix). C3 (1 file): the outline row per §9.4. Close-out per the rules
above.

**Revert point.** P3's parent. The guard commit is a safe resting state. **A partial encoding — either
half alone — is never a resting state: revert all of C2.**

**Slice.** Single layer (the model.ts wiring plus rows); the runtime row is the adapter check. Not a
vertical slice. Gate (a): §9.5 step 1 over P3's files — `src/core/qmd/model.ts
src/core/qmd/attribute-block.ts test/unit/qmd-model.test.ts test/unit/attribute-block.test.ts
test/integration/suite/outline.test.ts` — and these phrases resolve: `? !divAtColumn ||
divOpenerInterrupts`, `} else if (divRole === "open" && divAtColumn && !divOpenerInterrupts) {`,
`const CLOSER_LINE`, `const FRONTMATTER_MARKDOWN_BASE_FROM`. **Tier:** strongest.

**Session boundary.** One session, started only once the operator has approved this plan including P3.
Close out when DONE is met; do not start P4.

### P4 *(optional — below the value line)* — The fence info rule moves onto the tokenizer

**Capability.** One function, `fenceInfoVerdict` in the leaf, decides whether a plain fence's info
string opens a code block and which attribute block carries its Attr — **location and validity** (§2.2).
`fenceInfoOpensBlock` (`model.ts:5793`) and `fenceAttributeId` (`refs.ts:670`) both call it; the
duplicated "last group, at most one word" rule (`model.ts:5813-5836`, `refs.ts:696-709`) is deleted.

**Depends on:** P1 (the rewrite it moves) and P2 (the leaf).

**Value and reach: 0 corpus documents.** After P1, fill-3's default-reader grid still has 29 heading
deletions and 7 phantoms in four classes — two brace groups (including `l08`), a raw block not alone,
NBSP/FF after the info, quote and escape end offsets — and **13 label errors** (14 at HEAD; P1's refs
layer fixes `lst-i06`); 12 once quarto's `-N` suffixing of `lst-i09` is discounted. Plus a validity row
the grid lacks: history `d09`, ```` ```{.python data-x=" zz"} ```` — pandoc refuses the fence and quarto
renders the heading inside it; HEAD opens a region and hides it (re-measured). A reader sees these only
through spellings no corpus document uses (```` ```{.a} {.b} ````, ```` ```python ```` + NBSP,
```` ```{=html} {.a} ````, ```` ```{#lst-x data-author=O'Brien} ````). Structural value: one info rule
instead of two copies.

**Files.** The leaf and its test, `model.ts`, `qmd-model.test.ts`, `refs.ts`, `refs.test.ts`;
`outline.test.ts` per §9.4.

**First RED — layer 1:** stub `fenceInfoVerdict` returning `{ kind: "unmeasured" }` first; then
`fenceInfoVerdict('{.a} {.b}', { commonmarkDialect: false, pandocEscapes: true })` equals `{ kind:
'closed' }` — red by assertion. **Layer 2:** `names(['```{.a} {.b}','','# Inside','','```','','# After'])`
equals `['h1:Inside','h1:After']` (fill-3 `g01`); HEAD and P1 both return `['h1:After']` —
`model.ts:5834` counts `{.a}` as the one permitted word. **Its minimal GREEN does NOT delegate:** it adds
`|| /[{}]/.test(info.slice(0, block.start))` to HEAD's prefix-word check (pandoc's word is brace-free) —
measured by the second review on the P1 prototype: `g01` green, 2,875/2,875. Then `d09`, RED against THAT tree:
`names(['```{.python data-x=" zz"}','','# Inside','','```','','## After'])` equals
`['h1:Inside','h2:After']`; the post-`g01` tree still returns `['h2:After']`, and its GREEN is the
delegation to `fenceInfoVerdict`, which also retires the `g01` patch. (An executor who delegates on `g01`
instead finds `d09` passing on arrival: record it as a pin that M4 makes able to fail, not a cycle.)
**Layer 3:** `indexLabels` of
`['```{#lst-i10 data-author=O\'Brien}','x = 1','```']` contains `lst-i10`; after P1 it returns `[]`
(`braceGroups` opens a quote at the apostrophe, `model.ts:380-381`).

**DONE.** (1) Fill-3's grid: default-reader headings 92/92; lst ids compared as DISTINCT BASE ids (the
scorer strips quarto's trailing `-N` suffix before comparing) agree on every row, including `i13`
(```` ```{#lst-i13 .a}<NBSP> ````: quarto `[]`, HEAD `['lst-i13']`) and `i11` (an escaped `}` in a bare
value). CommonMark rows are non-regression, not a target (92/92 at HEAD; the leaf returns `unmeasured`).
(2) The P1 `KNOWN RESIDUAL` row for `l08` is inverted to quarto's answer; `d09` is GREEN. (3) The
Session 223/224/225 pins stay green. (4) `grep -n 'braceGroups(' src/core/qmd/model.ts src/core/refs.ts`
shows only the definition and Source 3; `quartoFenceTagRewrite` lives in the leaf; P1's direct rows for
it in `qmd-model.test.ts` import it from `./attribute-block` (redirected in L2), so L3's dropping of
`model.ts`'s re-export breaks no import; `RAW_ATTRIBUTE`'s permissive format name is kept. (5) The census
against P4's parent: 0 in all three views, `threw=0`; `test:oracle` unchanged; the gate green. (6) Mutants:
M1 restore last-group selection (`g01` fails); M2 treat NBSP after the info as whitespace (`t04` fails);
M3 accept a raw block that is not the whole info (`r02` fails); M4 skip the block's validity (`d09` fails).
(7) Runtime gate (§9.4): one outline row with the `g01` shape.

**Commands.**
```bash
npx vitest run test/unit/attribute-block.test.ts test/unit/qmd-model.test.ts test/unit/refs.test.ts
npm run check-types && npm test && npm run compile && npm run check-package
grep -n 'braceGroups(' src/core/qmd/model.ts src/core/refs.ts   # definition + refs Source 3 only
mkdir -p scratchpad/sN/base && git archive <P4-parent-sha> src | tar -x -C scratchpad/sN/base
CENSUS_BASELINE=$PWD/scratchpad/sN/base CENSUS_OUT=$PWD/scratchpad/sN/census-p4.out \
  npx vitest run --config docs/planning/scripts/attribute-block/vitest.census.config.ts   # 0 / 0 / 0, threw=0
# the grid, parent→P4: build fh_base/fh_impl and scratchpad/sN/cg.py exactly as in P1's commands, then
# edit cg.py's label comparison to strip a trailing -N from each id before comparing
npm run test:oracle
npm run test:integration                                          # ONLY per §9.4
```

**Surface.** Local machine, headless: vitest; fill-3's grid with quarto 1.7.33 render truth
(`scratchpad/s262/fill-3/`); the census; `test:oracle`; the Extension Development Host per §9.4.

**What that surface cannot enforce.** No corpus document exercises a fixed shape, so the census is
non-regression only. The base-id label comparison is blind to quarto's `-N` suffixing (not modelled).
CommonMark rows are non-regression only. Shapes absent from the 92-row grid are covered only by their
unit rows (e.g. `d09`). **The grid's truth lives in prunable scratch: if `scratchpad/s262/fill-3` has
been pruned, DONE (1) cannot be verified** — record it as not met, and the unit rows remain.

**Commits.** L1 (2 files): `attribute-block.ts`, `attribute-block.test.ts` — adds `fenceInfoVerdict` AND
moves `quartoFenceTagRewrite` in with its unit rows; inert. L2 (2 files): `model.ts`, `qmd-model.test.ts`
— `fenceInfoOpensBlock` delegates; `model.ts` re-exports the rewrite; P1's direct rows are redirected to
`./attribute-block`. L3 (3 files): `refs.ts`, `refs.test.ts`, `model.ts` — `fenceAttributeId` delegates;
refs imports the rewrite from `./qmd/attribute-block`; the re-export is dropped.

**Revert point.** L2's checkpoint is a safe resting state (the model is faithful, refs keeps its own
rule); L1 alone is inert; otherwise P4's parent. **Slice:** pre-declared vertical slice, L1 leaf, L2
model, L3 refs; gate (a): §9.5 step 1 over P4's files — `src/core/qmd/attribute-block.ts
test/unit/attribute-block.test.ts src/core/qmd/model.ts test/unit/qmd-model.test.ts src/core/refs.ts
test/unit/refs.test.ts test/integration/suite/outline.test.ts` — and the anchors `function
fenceInfoOpensBlock(`, `function fenceAttributeId(`, `const groups = braceGroups(lineText);` and the
rewrite helper resolve. **Tier:** strongest. **Session boundary:** one session; the plan ends here.

---

## 5. Here be dragons

- **🐉 The div fallback shares the block's tail rule.** Stating the fallback as "no ASCII whitespace in
  the tail" (two of the three designs did) refuses openers pandoc accepts — `{.callout-note!} :::`,
  `{.a :::`, `callout-note :::`, `{callout-tip} ` — and P3 would then delete a glued heading and
  re-pair the closers. The contract is pandoc's production (§2.2); the four shapes and `{.a}x` were
  re-measured by the main session.
- **🐉 "Final on one line" must really be final.** Pandoc's quote fallback makes `title=" ` at end of
  line OPEN, not refused, and a value ending in an odd run of `\` carries across even a blank line.
  Refusing either deletes the heading below the orphaned closer. P3 refuses only true single-line
  failures; the fixture's continuation framing and mutants P2-M8, P3-M7, P3-M8 hold the line.
- **🐉 P1's gate is quarto's anchor on the PHYSICAL line.** Rewriting behind a list marker or `> ` opens
  a fence quarto refuses and hides the heading inside it — a new DELETION. Gate on the raw line; keep the
  list-marker, tilde and quote guards and mutants M1/M2.
- **🐉 The tag's length is its OWN.** Counting the gap between the backticks and the tag rewrites
  ```` ``` {}x ```` after front matter into a fence quarto refuses. `sp_gap`/`tab_gap` and mutant M7.
- **🐉 P1's refs layer must rewrite the scanned line.** `fenceAttributeId` scans the whole line, not
  `info`; rewriting `info` alone re-mints `{#lst-h06}` (H6). Mutant M6.
- **🐉 Document start is physical line 0, not the line after front matter.** Re-rendered: ```` ```{}x ````
  opens a fence on line 0 and does not after front matter.
- **🐉 The literal tag regex is quadratic** (155 ms at 16,000 braces) and `computeRegions` runs on every
  edit. The helper is a single linear scan; a time-bounded row with the backtick prefix, and mutant M8.
- **🐉 P1 moves the region set, not just headings.** Across 54 documents the set of fence openers changes
  (+187/−50, design A's `corpus_diff`); cells change in 8, labels in 2; every region view moves with it
  (§6). Three census views, and a declared oracle no-op.
- **🐉 A pandoc-only reading of `:::` specs deletes what quarto keeps** (`title= .x`, `{{<` in a
  double-quoted value). Both are routed to HEAD, behind render-checked guards and mutants — at the price
  of keeping HEAD's deletions on 9 fix-up-blocked shapes (filed).
- **🐉 A reader the model cannot see.** A project `_quarto.yml` can set the reader; P2 and P3 then read
  on markdown's grammar. Disclosed; your call (§12).
- **🐉 The untrimmed tail.** `attrs: m[1].trim()` strips NBSP and trailing whitespace — exactly what
  decides the word and the refusal (`s32`, a leading NBSP). `divFenceRole` also returns the raw `tail`.
- **🐉 A wrong refusal deletes** (patchF). Refuse only on a single-line `refused` verdict; never on
  open-at-eol, never under CommonMark, never on unmeasured readers, never for fix-up or shortcode shapes.
- **🐉 The refusal encoding has two load-bearing halves.** Both edits, or neither (M1/M2); never the null
  encoding (M3 — `CLOSER_LINE` is tail-blind).
- **🐉 A census that cannot see a crash.** A build that throws on a document used to count as unchanged;
  the committed tool now fails on any throw, and every census step requires `threw=0`.
- **🐉 The corpus certifies only non-regression.** Every phase after P1 has 0 corpus reach; a green
  census cannot see one fixed shape. Every handoff says "reach 0" (Learning #528).
- **🐉 Pins passing on arrival are not TDD cycles.** After a wiring most listed rows pass first time;
  claiming them as cycles makes the close-out's "RED shown before GREEN" false. P1's sequence (DONE 2)
  names what makes each step red.
- **🐉 Anchors drift by construction.** P1 rewrites `model.ts:5793-5861`, so later lines shift. Anchor by
  phrase; own-plan drift is expected; foreign drift voids the contract.
- **🐉 The legacy regex readers survive** behind six null routes. A future "cleanup" that reads those
  specs as plain divs measurably breaks rows (patchR). A route is deleted only with the faithful model
  for its shapes.
- **🐉 Raw `class=` values.** `class="callout\-note"` before `.panel-tabset` would let the tabset win and
  delete the tab headings if read raw; a `class=` holding `\` or `&` routes to HEAD.
- **🐉 The leaf constraint.** One import breaks the future browser adoption; a `node:` import breaks the
  renderer bundle. `AttributeDialect` is redeclared; the leaf test asserts no import.

---

## 6. Impact analysis

| System | Impact | Action |
|---|---|---|
| `findHeadings` → `buildOutline` → `providers/outline.ts`, `workspace-symbols.ts` | P1: 23 documents (+41/−6). P2–P4: 0 documents; synthetic shapes only | census headings view; outline runtime row (§9.4) |
| `findAllCells` → `cells.ts`, `cell-background.ts`, `yaml-context.ts`, `diagram-regions.ts`, `embedded/virtual-doc.ts`, `features/execution.ts` | P1: +8 cells in 8 documents (Run Cell/CodeLens, backgrounds, `#|` completion, virtual documents) | census cells view; `cells.test.ts` row; Pylance vdocs NOT run (`test:lsp`) |
| **region views** — `findBodyLines` → `math-regions.ts`; `findBodyLines` via `isReferenceableLine` (`refs.ts:421`) → `providers/citation.ts`; `findCellOptionLines` (through `findAllCells`) → `yaml-value-flags.ts`; `findCodeFenceOpeners` → refs Source 4 | P1: the region set changes in 54 documents | not censused beyond the three views — disclosed (P1 cannot-enforce) |
| `indexLabels` → `providers/crossref.ts` | P1: +2 labels, `lst-i06`; P4: grid label fixes | census labels view; crossref runtime row (§9.4) |
| `document-engine.ts`, `document-engine-resolve.ts` | **none** — the first imports nothing from the model; the second reads only `frontMatterContentLines` | — |
| `src/core/notebook-callout.ts` / `dist/notebook-renderer.js` | **none** — adoption filed | — |
| `src/extension.ts` activation, `package.json` | **none** | — |
| `test/oracle` | **none** — its corpus has no `{{lang}}` fence, no `:::` and no `{#` | declared no-op, re-run in P1 and P4 |
| **User-visible** | P1: the Outline, cells and labels of 23 real documents; P2–P4: only on spellings no corpus document uses | — |

### Faithful verification, per surface (slice gate d)

| Surface | What it genuinely proves | What it does **not** |
|---|---|---|
| `npm test` (vitest, `test/unit`) | the leaf against pandoc's measured rows; `findHeadings`/`findAllCells`/`indexLabels` on rendered-witness rows | nothing about quarto itself; does not type-check (`check-types` does) |
| the truth fixture + `truth.mjs --check` | the leaf's verdicts equal live pandoc 3.6.3's `Attr`, in both framings | quarto's reader view (routed around); decoded values |
| the census (`docs/planning/scripts/attribute-block/`) | which documents moved, in three views, against a named parent; that no build threw | direction — model vs model; any zero-reach fix |
| renders (fill-3 grid, probe rows, copied pages) | direction: what quarto 1.7.33 shows | other quarto versions; knitr/jupyter passes when forced to `engine: markdown` |
| mutants in `git archive` copies | that each guard and pin row can fail for its stated reason | shapes no row covers |
| `npm run test:oracle` | cell-option flags unchanged | div or heading attributes — it sees none |
| `npm run check-package` | no new file leaks into the `.vsix` | behaviour |
| `npm run test:integration` (§9.4) | the Outline and cross-reference adapters on the phase's shape | shapes without a row |

---

## 7. Alternatives considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| **Patch in place** — port Session 259's three fixes into the tabset reads; make `maskQuotedValues` open a quote only after `=` | smallest diff; closes two HIGH items in one session each | leaves three grammars; routing a read through a normaliser inherits its errors (Learning #522) — the exact failure of Session 259 | the operator chose to plan instead; the treadmill is the problem |
| **Promote the notebook tokenizer** | the right control structure; right on all 8 quote/escape shapes | ASCII `\w`, no `:`/`-`, JS `\s`, one decode for every reader (would CREATE Outline deletions); wrong on 16 of 94 braced shapes; lives in the browser bundle | seeds the design; code not reused |
| **Extend Session 218's heading tokenizer** | measured character sets and reader split; three consumers already share it | quote opens anywhere, no escapes, JS `\s`; 22/120 validity and 17/75 projection errors; returns only tokens, a boolean and an id | its core needs a rewrite anyway, and its heading consumer is the largest zero-defect regression surface |
| **A separate tooling session (P0) for the census, scorer and fixture** | durable instruments before any phase relies on them | a zero-value session gating the only measured win | the census rides with this plan (§11.3); the fixture rides with P2 |
| **Land the tokenizer dark, then the reader view, then consumers** | each truth source gets its own conformance run | two sessions leave nothing working for a reader (FM #25) | leaf + first consumer are one pre-declared vertical slice (P2) |
| **An outline-truth ratchet file** | runs on every `npm test`; a DELETION entry is forbidden | a new file and a generated witness fixture, needing a P0 | `KNOWN RESIDUAL` rows in each phase give the same visible flip |
| **A pandoc-faithful reading without quarto's reader view** | simpler; the fixture is the whole truth | deletes `title= .x` and `{{<`-in-value headings quarto keeps | the spec is what quarto renders |
| **Model the `=` fix-up exactly** | faithful on fill-0's grid; would fix the 9 blocked shapes | an intricate precondition; 0 corpus reach | filed with the measured rule |
| **Encode a refused opener as `divFenceRole(...) === null`** | the smallest edit | `CLOSER_LINE` is tail-blind: 10 phantoms, 8 correct rows broken | only unmatched + no push is safe |
| **Read a refused spec as a plain div in P2 (patchR)** | deletes the legacy readers earlier | 6 re-pairing deletions, 15 phantoms, 8 correct rows broken | HEAD's reading kept until P3 |
| **A blank-line rule in P3** (open-at-eol + blank next line → the WORD branch decides) | reaches the `title="x` and `title=` typing states inside tabsets | measured wrong twice (backslash-newline carries across the blank; the quote fallback); its only fixes are zero-reach nested/glued shapes | dropped after review; filed with its evidence |
| **Full multi-line lookahead in the refusal predicate** | gets `{…` + `}` on the next line right; fixes g05/g06 | continuation inside lists and quotes unprobed; a wrong refusal deletes | filed |
| **Decode values in P2** | exact values; closes tier-1 empty-title phantoms | a lenient decode deletes; the designs that tried it contradicted their own fixture | raw values are safe for everything P2 decides |
| **Reach "one grammar" for the whole extension in this plan** | one grammar everywhere | ~six more capabilities over the 556-document heading surface and the browser bundle, all at 0 reach | each filed, back only with measured reach |
| **The fence info rule before the div path** | the strongest evidence (a patched copy matched 184/184 grid documents) | zero reach, implausible spellings | kept, last and optional |

---

## 8. Scope boundary — what this plan does NOT do, and where each is recorded

Explicitly out of scope (FM #26). Each is held by a named filing made at Session 262's close-out, cited
by title — the plan holds the evidence; the backlog holds pointers (BACKLOG is over its size budget, so
nothing is filed twice; the close-out records the net byte delta in its `CHANGELOG.md` entry):

- **Filed as its own new item (head of "Up Next"):** the ```` ```{{lang}} ```` display-fence regression —
  this plan's P1.
- **Annotated in place (no new item):** *"the TABSET reads never got Session 259's three fixes"*,
  *"`maskQuotedValues` pairs quote characters blindly"* and *"The attribute spec is matched with regexes
  and never TOKENIZED"* — each gains its plan phase and its measured corpus reach of 0.
- **Appended to existing items:** `d10` (a refused inner opener re-pairs the closers) to *"`divColumns`
  is pushed for `:::` lines that are not divs at all"*; the heading/inline id fabrications and losses
  (a whitespace-led quoted value, an NBSP separator; an apostrophe in a bare value, an escaped quote,
  `id=`, an attribute glued after a closing quote — heading-tokenizer `a11`; a key holding `,` or `(`) and
  the refuted `\<space>` comment at `model.ts:565-571` to *"A `}` inside a QUOTED attribute value defeats
  `[^}]*`"*; the notebook's first-duplicate `collapse=`, its adoption path and the unmeasured `.ipynb`
  reader question to *"Notebook-renderer: minor pandoc-fidelity divergences"*; `.content-hidden` with NO
  condition removing its block under every format to *"a FORMAT-GATED div (`.content-hidden` /
  `.content-visible`) deletes its whole block"*; Session 262's re-measure (70 of 960 path tokens
  dangling, 7.3%) to *"51% of the `scratchpad/` paths cited by TRACKED documents no longer exist"*.
- **One new "deferred by the attribute-tokenizer plan" item**, each shape measured and at 0 corpus
  reach: (a) quarto's `=` fix-up (with its exact precondition) and the `{{<`-in-double-quoted-value
  refusal for `:::` openers, `{.callout-note = x}` gluing into a fallback class, the **9 fix-up-blocked
  refused shapes the `=` route keeps deleting** (fill-0 `b16`, `b19`, `b20`, `b28`, `b29`, `T4`, `Q1`,
  `Q3`, `Q4`), and the fix-up's firing on heading lines too (fill-0 `P7`: the model's heading text
  differs); (b) an unterminated `{{<` truncating quarto's reader output; (c) decoded values and quarto's
  zero-inlines empty-title rule (tier 1 whitespace-only closes 41 of 100 phantoms, tier 2 the other 59);
  (d) the commonmark_x grammar (64 of 124 callout variants delete — still true after P4; fill-1's cmx
  DELETE rows; `title=''` and `title="   "`; the standalone attribute line; the cmx fence label `i01`; the
  cmx 3-space-indented opener phantom `T29c`; and *"Source 3 now carries the reader split, but Sources 2
  and 3's OTHER dialect questions were never asked"*); (e) **open-at-eol and multi-line refusals** — the
  dropped blank-line rule with its two measured hazards (backslash-newline; the quote fallback), the
  nested `title="x` tabset deletion, the glued phantom, `W1`, and the multi-line accepted-opener deletions
  `g05`/`g06`; (f) the fence info rule — LOCATION and VALIDITY (history `d09`) — if P4 is not scheduled,
  and P1's unmodelled residuals (readqmd's line-0 tag propagating to later backtick runs; VT/FF between
  the fence run and the tag; readqmd's `*` pattern at every `find` start; quarto's `-1`/`-2` id suffixing);
  (g) theorem/proof first-heading consumption (15 phantoms, 1 corpus document; `{#thm-x .callout-note}`
  makes quarto FATAL); (h) `divOpenerInterrupts` ignoring the reader (`r6_cmx`); (i) refs minting ids from
  refused openers; (j) the markdown_strict/phpextra/mmd/github refusal deletions P3 deliberately leaves;
  (k) **a reader set by a project `_quarto.yml` or `_metadata.yml`** — invisible to src/core; (l) the
  `refs.ts:92` id-class dedupe (contingent on §12's unification question); (m) the refuted bundle-size
  comment at `model.ts:4062-4067`; `test/oracle/README.md`'s stale corpus count (66, where a run scores
  131); and record hygiene: part (c) of *"The `from:` dialect reaches constructs beyond headings, and three
  of them are measured losses"* is stale (history `d13`: quarto and the model now agree) — re-verify, then
  correct it with a CHANGELOG entry.
- **Not touched at all:** the reader resolver (*"The front-matter reader RESOLVER misreads the reader in
  a dozen more shapes"*), quarto's first-handler dispatch across all nine handler classes (*"The
  class-ORDER rule compares only callout-vs-tabset"*) and format-gated divs — HEAD's callout-vs-tabset
  order is kept verbatim; display math and table captions (Learning #384); `RAW_ATTRIBUTE` as an Attr
  (Learning #393); `test:lsp`; and a pandoc-grounded sweep of div, fence, image and span ids over the
  corpus (the census's labels view is the two-build `indexLabels` gate; a pandoc-grounded sweep is new
  tooling at 0 measured reach).

---

## 9. Sessions, stop points, and the rules that bind every phase

### 9.1 Sessions

| Session | Deliverable | Depends on | Stop condition |
|---|---|---|---|
| **262 (this one)** | this plan, the census instruments, the filings | — | committed. **STOP.** |
| **P1** | fences read after quarto's tag rewrite (vertical slice, 2 layers + adapter rows) | — | P1 DONE. **Recommended stop.** |
| **P2** | the leaf + accepted `:::` openers (vertical slice, 2 layers) | none in code | P2 DONE. **Stop here to leave the div stack untouched.** |
| **P3** | single-line refused `:::` openers are paragraph text (single layer) | P2 | P3 DONE. The natural end of the plan. |
| **P4** *(optional)* | one fence info rule, location and validity (vertical slice, 3 layers) | P1, P2 | P4 DONE. The plan ends. |

### 9.2 Stop points

- **After P1:** the only measured win — 23 real documents match quarto. No new module; no existing
  expectation changed.
- **After P2:** both HIGH items closed for markdown-family documents; the leaf exists with a committed
  pandoc truth fixture; the corpus unmoved.
- **After P3:** markdown-family `:::` openers on the measured readers are classified and refused by
  pandoc's grammar wherever one line decides it; the Sessions 257–261 regex treadmill is off the default
  path. **What still keeps HEAD's reading, deletions included:** open-at-eol and multi-line openers, the
  9 fix-up-blocked shapes behind the `=` route, the unmeasured markdown readers, and CommonMark-family
  documents (64 of 124 callout variants delete there — still true after P4).
- **After P4:** the fence info rule is faithful and shared; the grid reads 92/92.

### 9.3 The revert rule

A slice that cannot produce a boundary's evidence closes out at its last clean checkpoint and records
the rest as in progress (SESSION_RUNNER §Vertical Slice Sessions). P1: C2 alone is a resting state. P2:
the layer-1 checkpoint is the declared cut line. **P3: either half of the encoding alone is never a
resting state — revert C2 whole.** P4: L2's checkpoint is a resting state. Whatever lands owes its
`HANDOFFS.md` receipt and `CHANGELOG.md` entry (FM #27).

### 9.4 The runtime gate (Phase 3E)

Every behaviour phase declares an adapter layer — a `test:integration` row — and runs it under the
operator's standing rule for anything that takes over the screen:
1. **At Orient, ask whether this phase may run `test:integration`.** That is plan-level consent, and it
   fixes the layer set: if the operator declines here, the adapter layer is dropped from the declared
   layers before any code.
2. **Immediately before launching, state the exact command and that a VS Code window will take over the
   screen, then wait for an explicit yes.** An earlier "yes" at Orient is not that yes.
3. **If consent is declined at either point,** the adapter DONE item is recorded as **NOT MET**, the
   handoff names "Outline adapter unverified" as a defect (FM #24), the adapter row is filed as an
   in-progress follow-up, and the phase is not DONE — it closes out at its last clean checkpoint. The row
   is never committed un-run (`test/integration` is type-checked only by `compile-tests`).

### 9.5 Orient re-verification, for every executor

1. `git log --oneline 7a2397e2..HEAD -- <every file the phase will edit>` shows nothing but this plan's
   earlier phases. Foreign drift voids the phase: re-plan.
2. The phase's anchors resolve **by phrase**.
3. `npm test` is green at its recorded count; `npm run check-types` is clean.
4. `quarto --version` is 1.7.33 — otherwise run `truth.mjs --check` and re-render any cited witness
   before trusting it.
5. Re-run the phase's first-RED input and record today's answer in the handoff.
6. **The census identity control** (`CENSUS_BASELINE` = `CENSUS_CURRENT` = a `git archive HEAD` copy):
   0 in all three views, `threw=0`. Time it — every later census run that session must take ≤ 1.2× as long.
7. **Set the deepest available reasoning mode** — ARCHITECTURE_WORKSTREAM's refactor directive binds the
   implementation, not only the plan.

**If `scratchpad/s262` has been pruned:** the phase's own RED rows — each shown failing for its stated
reason — the synthetic texts inlined above, and the numbers recorded here are the re-verification. The
steps that need scratch and cannot run are recorded as not met with the reason: P1 DONE 8's page list
(its page keys are in the README), P3 DONE 7's positive control, P4 DONE (1)'s grid.

---

## 10. Verification checklist (architecture)

- [x] Every component has one responsibility — the leaf parses; `model.ts` applies quarto's semantics
  and container geometry; refs indexes ids (§2.3)
- [x] Input, output and error contracts are defined, including `s[start] !== "{"`, a blank tail, the
  quote fallback, the rewrite's replacement, its length and its precondition (§2.2)
- [x] No circular dependency — the leaf imports nothing; `model.ts` and `refs.ts` import it (§2.1)
- [x] Failure modes analysed, including the encodings and the rule the design forbids (§5, §7)
- [x] A migration path with a rollback point at every layer, and the one state that is never a resting
  point named (§9.3)
- [x] Performance assumptions verified — the literal tag regex measured quadratic and replaced by a
  linear scan with a time-bounded row and a mutant; census wall-clock ≤ 1.2× the identity run in every
  phase (§4 rules)
- [x] Assumptions verified against code and measurement — every anchor re-read; the claims in §11.2
  re-measured by the main session
- [x] Alternatives documented with honest cons (§7); the scope boundary explicit — what changes and what
  does not (§6, §8)

---

## 11. Research and review record

### 11.1 The four workflows

| Run | Agents | Wall-clock | Subagent tokens | What it did |
|---|---|---|---|---|
| research `wf_2bb8409a-f6d` | 15, 0 errors | ~85 min | ~4.0M | ten lenses (three tokenizers, the inventory, pandoc under `markdown` and under CommonMark, quarto's consumers, reach, instruments, history), a completeness critic, four gap fills (quarto's reader view, the refusal encoding, decoded values, the fence location rule) |
| design `wf_f2d0ebd4-f37` | 8, 0 errors | ~127 min | ~3.0M | three designers (value-, risk-, architecture-first), three judges (correctness, executor, protocol), a synthesis, a completeness critic (19 gaps) |
| plan review `wf_bb03cf16-802` | 11, 0 errors | ~71 min | ~2.5M | five lenses over the drafted plan (facts, executor, safety, protocol, completeness), an adversarial verifier per lens, and a completeness critic: **46 findings survived verification (1 blocker), plus 4 critic gaps** |
| second review `wf_c34c4651-1ff` | 6, 0 errors | ~44 min | ~1.4M | three lenses over the REVISED plan (facts, TDD and safety, resolution), each adversarially verified: 45 of the previous 50 found resolved cleanly; **15 new findings survived (0 blockers)**, all resolved below |

Judge totals across the three judges: **value-first 94.5**, risk-first 82, architecture-first 79. The
synthesis started from the value-first design and grafted from the other two. Every lens's structured
return is in `scratchpad/s262/_results/<lens>.json`, the design panel's in
`scratchpad/s262/main/design_result.json`, the plan review's in `scratchpad/s262/main/review_result.json`
(rendered at `review.md`), and the brief that fed the panel in `scratchpad/s262/main/DESIGN_BRIEF.md` —
untracked and prunable; **the numbers that matter are written into this document.**

### 11.2 Re-measured by the main session, not taken from an agent

1. `data-author=O'Brien title='Note'`: the identical Attr on a div and a heading; `data-x=" zz"` refused
   on both.
2. A `{…}` holding NBSP: a div whose one class is the literal text.
3. `::: {.callout-note title= .x}`: raw pandoc `[callout-note, x]` + empty title; `quarto render` keeps
   `<h2>Inside</h2>`, callout titled `.x`.
4. The `{{lang}}` deletion through `check.py` (quarto `[Hidden One, After Plain]`, model and baseline
   `[After Plain]`) and through the bundled model; the mechanism (`braceGroups("{{python}}")` → one group
   ending at index 8 of 10); **the regression**: `95241beb`'s parent reports both headings, `95241beb` one.
5. The 21-sweep inventory, with identical hit counts; no NUL-bearing file under `src/`; the stale-docs
   sweep's 25 hits; `refs.ts:377`'s "two-stage".
6. The div production's tail rule: `{.callout-note!} :::`, `{.a :::`, `{callout-tip} `,
   `callout-note :::` open one-class divs; `{.a}x` is paragraph text.
7. The typing states: `title}` + blank → pandoc paragraph, HEAD `[]`; `title="x` + blank and `title=` +
   blank → HEAD already shows the heading in a flat document.
8. `class="callout-note x"` → classes `[callout-note, x]`.
9. Document start: ```` ```{}x ```` on line 0 renders `['After A']`; after front matter it renders
   `['Hidden A','After A']`; ```` ``` {}x ```` (a space gap) after front matter renders both.
10. The literal tag regex: 2.6 / 40 / 155 ms at 2,000 / 8,000 / 16,000 braces.
11. The replacement rows: the nested `title="x` tabset row (HEAD `[]`; quarto render `['After Inner']`,
    tab `Tab A`); the one-word `{.a` guard (HEAD `[]`, pandoc a `{.a` div); the glued phantom (HEAD
    `['h2:H','h2:After']`, pandoc absorbs `## After`); `d09` (HEAD `['h2:After']`, pandoc refuses the
    fence); `W1` (HEAD `['h2:After']`, pandoc a `.note` div with title `"`); the backslash-newline callout
    (HEAD `['h2:After']`, pandoc a callout titled `x\n y`).
12. The census tool from its committed copy, with its throw assertion: identity 0/0/0, the P1 prototype
    23/41/6 · 8/8/0 · 2/2/0, pre-Session-257 108/+0/−289 · 0 · 0 — every run 3,383 read, 0 throws; and
    P1's 23 changed documents' path digests (12 unique pages, 3 already rendered by fill-3).
13. The unit suite under the refs-inclusive P1 prototype: 2,875 of 2,875.
14. `FRONTMATTER_MARKDOWN_BASE_FROM` (`model.ts:2120`) matches base `markdown` with extensions and none of
    the `markdown_*` variants; every code and test anchor this plan cites, by grep at `7a2397e2`.

### 11.3 Decisions taken during the session

- **Operator, Phase 0:** plan the tokenizer, rather than patch either HIGH item.
- **Operator, mid-session:** commit the census tool with this plan (option 1 of 3) — three files under
  `docs/planning/scripts/attribute-block/`, validated by recorded controls rather than unit tests,
  following Session 123's `docs/planning/scripts/count-value-field-shapes.mjs`. Never packaged
  (`.vscodeignore`: `docs/**`), never run by `npm test` (`vitest.config.ts` includes only
  `test/unit/**/*.test.ts`), type-checked by no tsconfig.
- **Planner:** the claim note's "not the `divColumns` push" is corrected by measurement (§4 P3).
- **Planner, after the review:** P3's blank-line rule is dropped rather than patched — two measured
  deletion hazards for zero-reach fixes (§4 P3, §7).

### 11.4 What the reviews changed

From the design panel's judges and critic, and then the plan review — each re-derived before it was
applied:

| Defect in a draft | Correction |
|---|---|
| two designs stated the div fallback as "no ASCII whitespace in the tail" — refusing openers pandoc accepts, in the deletion direction | pandoc's production, shared tail rule, no word retry (re-measured) |
| two designs claimed P1 fixes `l08` | it is the location rule; P1 fixes exactly 10 grid rows; `l08` is a `KNOWN RESIDUAL` owned by P4 |
| ~9 lens verdicts were built on raw pandoc | quarto's reader view flips them (fill-0); the reader-view oracle matches quarto 150/150 |
| **(blocker)** P3's second RED already passed at HEAD, and its blank-line rule had no failing test | the rule is dropped; the rows become guards and KNOWN RESIDUALs; P3's value is restated to the one typing state it reaches |
| P3's blank-line rule refused backslash-newline and quote-fallback openers pandoc accepts | dropped (above); the quote fallback now in the leaf's contract, with a continuation framing in the fixture |
| P3's gate could not express "base `markdown`" through its parameters | `measuredRefusalReader`, computed from `FRONTMATTER_MARKDOWN_BASE_FROM` |
| a project `_quarto.yml` reader was never considered | disclosed (§2.5, P2/P3, §8) and put to you (§12) |
| P1's tag length was ambiguous; the natural slip deletes | "the tag's own length"; `sp_gap`/`tab_gap` guards; mutant M7 |
| six P1 rows were listed as RED→GREEN that pass on arrival | an ordered minimal-GREEN sequence (dd2 → l04 → d0), the rest pins made falsifiable by mutants |
| P1's linearity row could not fail (a braces-only line misses the anchor), and no mutant restored the regex | exact inputs with the backtick prefix; mutant M8 |
| the grid command rebuilt the "HEAD" column from the working tree and overwrote research evidence | parent and implementation bundled separately into `scratchpad/sN`; never write under `scratchpad/s262` |
| `grep -c … && npm run test:oracle` never ran the oracle; P2/P3 census lines lacked `mkdir -p` | `! grep -q … &&`; `mkdir -p` everywhere |
| the census counted a throwing build as unchanged | the committed tool now fails on any throw; `threw=0` in every census step; one `CENSUS_OUT` per run |
| the corpus-citation rule said "by path" | documents identified only by digest or ordinal; P1's expected set committed as digests |
| the runtime gate forbade the just-in-time confirmation the operator's rule requires | consent at Orient AND an explicit yes immediately before launch; declined → NOT MET, not DONE |
| P4 had no Commands or Surface; its stub made its first RED pass; its label count and file lists were off; `d09` was dropped | added; stub returns `unmeasured`; 13 labels; P1's rows redirected in L2; `d09` is filed with a row and mutant M4 — a RED only if `g01`'s GREEN does not delegate |
| `truth.mjs` holds logic with no named check, and disagreed with the contract on the leading-NBSP spec | its own controls; `fallback` compared in conformance; the leading-NBSP spec is fallback:false; §12.3 |
| the leaf's contract refused `k= .c` and ignored TAB columns | whitespace only BEFORE `=` refuses; TABs expanded over the physical line by the caller; K14, K15, B26 rows |
| a bare `title=<U+FEFF>` would have become a new phantom | routed to HEAD (M9) |
| nine fix-up-blocked deletions, five P1 residuals and several measured shapes were disclosed but filed nowhere | all in §8's filings |
| P3's positive control had no floor | exactly the 23 non-`_cmx` documents patchC changed, none of its 10 `_cmx` ones |
| smaller fixes | BACKLOG cited by title everywhere (a draft of M7 had cited the RECORD item by its line number); the six closer-pairing items named; §6's region edges corrected; P3 guards and F1/F4 texts inlined; the stale-docs sweep listed hit by hit; `check-package` added; close-out split into ≤ 5-file commits; "Session N" defined; the 2,875 figure attributed to behaviour-equivalent prototypes |
| the census README would have published a personal directory name | counts and hashes only |
| **(second review)** the grid recipe crashed as written; two cascade rows could not be pins, and most pins had no killing mutant; P1's step 1 hid an untested anchor tolerance; P3's `=` route had no guard that could fail and no mutant; the 12 unmeasured-reader rows asserted deletions as guards; M2's kill list and M7's example were wrong; the refusal reasons contradicted the controls; the TAB duty had no physical column; the positive control compared two file formats; `d09` was a pin, not a RED; the gate's "only measured readers" was false for `markdown±ext` | a tested `sed`-generated copy; `c03`/`c04` KNOWN RESIDUAL and `c05`/`q07`… guards; mutant M0; `p5` as an explicit RED; glued `=` guards and P3-M9; the 12 as KNOWN RESIDUAL; M2 → `r2`/`Q1`/`Q6`, M7 → `.tabset`; disjoint reasons and a `refused`-kind continuation check; `baseColumn`, TAB-column rows and P3-M10; path-set comparison; `g01`'s non-delegating GREEN; the measured `markdown-blank_before_header` rows |

---

## 12. Decisions for the operator

1. **Approve the plan** (the gate (a) contract) — all four phases, or up to a stop point (§9.2).
2. **P3 changes the `divColumns` push** for single-line refused openers on the measured readers (§4 P3).
   Approve it, or stop after P2.
3. **`truth.mjs`** holds classification logic. Is it validated enough by its recorded controls, its
   `--check` against live pandoc and the conformance run (the census tool's standard, §11.3) — or does the
   strict-TDD directive want it written test-first? And is its fixture's home,
   `test/unit/attribute-block-truth.json` (a JSON file in `test/unit` itself, no new directory; synthetic
   strings only), acceptable?
4. **A reader set by a project `_quarto.yml`** is invisible to the model (§2.5). Accept that P2 and P3
   read such documents on markdown's grammar (0 of 3,383 corpus documents are affected), or keep P2's
   reclassification and P3's refusals off until the adapter can pass the project's reader into the model?
5. **The runtime gate** (§9.4): consent at Orient, then an explicit yes right before launch; a declined
   run leaves the phase NOT DONE with "Outline adapter unverified" as a defect. Acceptable?
6. **The HIGH labels** on *"the TABSET reads never got Session 259's three fixes"* and
   *"`maskQuotedValues` pairs quote characters blindly"* now carry a measured corpus reach of 0, while the
   ```` ```{{lang}} ```` item reaches 23 documents. This plan annotates the reach and does not relabel.
7. **P4 at all?** Zero reach, implausible spellings, structural value only.
8. **Two markdown-family grammars indefinitely?** After P4 the extension keeps the new leaf (div and
   fence) and Session 218's grammar (heading and inline) side by side, unless a measured reason to unify
   appears.
