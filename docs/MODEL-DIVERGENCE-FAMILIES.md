# The measured model↔quarto divergences, grouped into families

**Audit, Session 230 (2026-08-19).** Workstream:
`docs/methodology/workstreams/AUDIT_WORKSTREAM.md`.

---

## Audit summary

| | |
|---|---|
| **Scope** | The three "mover archive" corpora — `scratchpad/s225/all`, `scratchpad/s226/all`, `scratchpad/s227/all` — **903 rows** of rendered `quarto render` ground truth. |
| **Criteria** | For each row, does `findHeadings` (`src/core/qmd/model.ts`) at HEAD return exactly the heading list quarto rendered? Where it does not, what is the *cause*, and is that cause already an open `BACKLOG.md` item? |
| **Coverage** | **903 of 903 rows scored.** 782 agree. 121 disagree; 5 of those are instrument artifacts (2 of quarto's own minted appendix headings, 3 of the deliberate empty-heading omission `SETEXT_H1` documents), leaving **116 real divergences — all 116 classified, 0 unassigned.** |
| **Finding count** | **16 families.** 12 already filed, **3 newly filed**, 1 partially covered. Plus **one record-hygiene finding** (three duplicate clusters in `BACKLOG.md`). |

### The two headline corrections to the premise

This audit was filed by Session 229 as *"116 measured divergences … the largest body of
measured, known-wrong behaviour in the project, and most of it is not individually filed —
`BACKLOG.md` names roughly a dozen model defects."* Both halves of that framing are wrong,
and correcting them is most of this audit's value.

1. **116 rows are 25 distinct documents, and two of them are 87 of the rows.** The archives
   are corpus *unions*: the same source document was swept by several predecessor sessions and
   appears once per sweep. Deduplicated by SHA-256 of the source bytes, the 116 rows collapse
   to 25 documents; `s199/inject/test_fixtures_closes-paragraph-gate.qmd` accounts for 45 rows
   and `s194/repo/r050.qmd` for 42. **The row count measures corpus overlap, not defect
   volume.**

2. **The backlog names far more than a dozen model defects, and 12 of the 16 families were
   already filed.** Counting only heading-model items, `BACKLOG.md` carries several dozen —
   with entries as broad as *"The BLOCK QUOTE is a container this model does not carry at
   all"* and *"111 heading losses and 81 phantoms … OUTSIDE the tag rule."* The archives are
   overwhelmingly **re-evidence for already-filed work**, not unfiled work.

**The genuinely new yield is 3 defects and 1 record-hygiene finding — from 116 rows.** That is
a low yield, and it is the honest answer: the predecessor sessions that produced these archives
filed what they found.

---

## Method, and what each step is worth

1. **Reproduced Session 229's classification firsthand** — `scratchpad/s229/hist/classify.test.ts`
   returns `{footnotesArtifact: 2, emptyHeading: 3, both: 0, realDivergence: 116}`, matching its
   record exactly.
2. **Validated the extractor before trusting it** (the inherited gotcha): `scratchpad/s229/extract.py`
   scores **54/56** against Session 227's recorded `TRUTH.json`, and the two misses are exactly
   `s227/r3/n03` and `s227/r4/p02` — the named rows, which is a stronger check than a bare count.
3. **Re-extracted quarto's answer from the stored HTML for all 25 distinct documents.** All 25
   agree with `TRUTH.json`. **No ground-truth claim in this report is inherited** — each was
   re-read from the rendered document.
4. **Deduplicated by source bytes**, which is what produced finding 1 above.
5. **Probed the model on minimal shapes and controls** (`scratchpad/s230/probe*.test.ts`, 4 rounds)
   so that a family label names a reproducible rule rather than one archived document.
   ⚠ These probe the **model only**; every claim about quarto comes from step 3.

**⚠ Two of this audit's own hypotheses were refuted by those probes, and both would have been
wrong filings.** (a) An indented setext underline looked like an unguarded phantom — the model
in fact refuses it at every indent 1–8 at top level; the real cause of `s197/adv/a0011` is that
`Dr.` is read as an *ordered-list marker* (already filed). (b) The pipe/grid/tab rows looked
like block-quote blindness — they reproduce identically with no quote in the document.

---

## The 16 families

Direction: **phantom** = model reports a heading quarto does not render; **lostTP** = quarto
renders a heading the model does not report; **text** = same headings, different text.

| # | Family | Rows | Docs | Dir. | Rendered witness | Status |
|---|---|---:|---:|---|---|---|
| F01 | A **setext heading inside a block quote** is not reported | 46 | 2 | lostTP | `scratchpad/s226/all/61f6fd8096e5.qmd` | **FILED ×2** — L63 (S225) *and* L236 (S183). ⚠ duplicate |
| F02 | Heading text is the **SOURCE** text; quarto's is the **RENDERED** text | 42 | 1 | text | `scratchpad/s225/all/013e01e764b9.qmd` | FILED — L142 |
| F03 | Inside a quote, the setext underline **does not swallow the ATX line** above it | 2 | 2 | text | `scratchpad/s225/all/07852b580fc7.qmd` | FILED — L244, **refined below** |
| F04 | A **lazy continuation into a quote** under `gfm`: lines joined, `>` kept in the title | 3 | 3 | phantom | `scratchpad/s225/all/fde0914520c9.qmd` | FILED — L208 + L240, **refined below** |
| F05 | A **fence inside a quote** is invisible to the fence rows | 4 | 2 | phantom | `scratchpad/s225/all/03890ac7b86c.qmd` | FILED — L182 (names the witness by path) |
| F06 | A whole-line **HTML comment / HTML block inside a quote** | 2 | 2 | phantom | `scratchpad/s225/all/451cbd737154.qmd` | FILED — L224 (comment), L65 / L130 (`<div>`) |
| F07 | A **table-shaped line standing alone** is a fresh block here and a paragraph to pandoc | 3 | 3 | phantom | `scratchpad/s225/all/a45bbabe2b16.qmd` | **NEW** |
| F08 | A **TAB-indented line inside a quote** is a block here and a paragraph to pandoc | 1 | 1 | phantom | `scratchpad/s225/all/7df5a4f1add3.qmd` | ✅ **RESOLVED — Session 236** |
| F09 | Prose read as an **ordered-list marker** opens a column that admits an indented underline | 2 | 2 | phantom | `scratchpad/s225/all/59a103bf11ff.qmd` | FILED — L238, **new witness shape** |
| F10 | A **block quote at column 0 does not pop** the open list's content columns | 1 | 1 | phantom | `scratchpad/s225/all/9cd4f31f5ce6.qmd` | FILED — L208 (new spelling: the quote as a *pop*) |
| F11 | A **CLOSED raw-TeX environment with a paragraph OPEN above it** is treated as a block | 2 | 1 | phantom | `scratchpad/s225/all/b4f8e8f0c741.qmd` | **NEW** (L196 covers only *unclosed*) |
| F12 | A raw-TeX macro on an **unquoted line between two quoted lines** | 2 | 1 | phantom | `scratchpad/s225/all/ab52713a0844.qmd` | FILED — L208 |
| F13 | A **nested (`>>`) quote** whose content is tab-indented | 2 | 1 | phantom | `scratchpad/s225/all/02244e693236.qmd` | FILED — L208 |
| F14 | A **one-line closed env with trailing prose** is not a block | 2 | 1 | phantom | `scratchpad/s226/all/bd974dd3fe5d.qmd` | FILED — L198 (the raw-TeX TAIL family) |
| F15 | **Non-markdown reader** (`markdown+literate_haskell`) | 1 | 1 | phantom | `scratchpad/s225/all/d52944760569.qmd` | FILED — L120 (names `dial_16`) |
| F16 | **Unreferenced footnote** dropped by pandoc, headings reported from inside it | 1 | 1 | phantom | `scratchpad/s227/all/d0067.qmd` | **FILED ×3** — L54, L148, L166. ⚠ duplicate |
| | **Total** | **116** | **25** | | | |

Machine-readable form: `scratchpad/s230/FAMILIES.json`, `scratchpad/s230/DIVERGENCES.json`.

---

## The three new findings, with their evidence

### F07 — a table-shaped line standing alone is a fresh block here, a paragraph to pandoc

Rendered, `> line one` / `> line two` / *(blank)* / `> a | b` / `> # ATX Below` renders **no
heading**; this model reports `ATX Below`. Same for `+---+---+`. **The block quote is not the
cause** — with the markers removed, `para.` / *(blank)* / `a | b` / `# ATX Below` reports the
heading here too. What the model is doing is classifying the lone line as a *fresh non-paragraph
block*, which lets the `#` line through; pandoc reads it as an ordinary paragraph and
`blank_before_header` suppresses the heading.

⚠ **Two matched controls in the same corpus are measured RIGHT and must not move.**
`R1row_bq_mark__closed` (`> | a | b |` / `> # ATX Below`) renders the heading and this model
reports it; `R4indent_bq_mark__closed` (`>     ---`) likewise. So the fix is not "a line
containing `|` is a paragraph" — the discriminator between `a | b` (suppresses) and
`| a | b |` (renders) is unresolved by this audit and needs its own render before anyone codes it.

Witnesses: `s183/c3/R1pipe_bq_mark__closed`, `s183/c3/R2grid_bq_mark__closed`,
`s183/R2-gridborder-refute/work/p12_bqpipe`.

> **RESOLVED by Session 235 — and the discriminator this audit left open is not the leading pipe.**
> Rendered across 87 purpose-built documents in three rounds plus 123 adjudicated sweep movers
> (`scratchpad/s235/`), a table-shaped line is block-level in exactly four cases: it is a pandoc
> **line block** (`|` then whitespace or end of line, at the container's content column — so
> `| a | b |` renders and `|a|b|` does not, and neither does the same line indented one space); it
> is a **grid table's border** that reaches another border through `|` rows in one direction or the
> other; it is a **pipe table's delimiter** under a header carrying a `|` of its own, with no
> paragraph open when that header began; or it is any other `+` row — `+`, `+ -`, `+ + +`,
> `+   +`, `+ - + - +`, `+ ---` — all list items whose content opens no paragraph. Both matched
> controls this audit flagged are unmoved. ⚠ The audit's own framing (`a | b` versus `| a | b |`)
> named only the pipe half; the grid border is two of the three witnesses and needed a separate,
> two-directional lookahead. See `tableShapedLineIsBlock` in `src/core/qmd/model.ts` and the
> Session 235 guard block.

### F08 — a TAB-indented line inside a quote ✅ RESOLVED (Session 236)

`> line one` / `> line two` / *(blank)* / `> \t code` / `> # ATX Below` renders **no heading**;
this model reports one. ⚠ Its 4-space twin `R4indent_bq_mark__closed` renders the heading and the
model agrees — so quarto splits tab from spaces here, and the model does not. Filed separately from
F07 because it is column arithmetic, not line shape, and because the project already has two
"counts spaces only" items (L206(a), L214) that a fix should be scored against together.

⚠ **RESOLVED BY SESSION 236.** The cause was `raw.slice(quoteContentStart)`: slicing the marker
off destroys the line's absolute column, and a tab is the one indent that depends on it. After
`> ` a tab begins at column 2 and reaches 4 — two columns of content indent, not four.
`quoteContentLine` re-expresses the leading run in the quote's own coordinates at the single
site where the coordinate system is lost. ⚠ **The two "counts spaces only" siblings this entry
says to score against were BOTH already fixed by Session 194** and were re-rendered to confirm
it (Learning #431). Round 1: 47 documents, model 35 → 47 agreeing, 12 recovered, 0 broken.
Corpus sweep: 6 mover rows / **2 distinct documents, both re-rendered and both RECOVERED**.

### F11 — a CLOSED raw-TeX environment with a paragraph OPEN above it

`> Quoted prose with the quoted paragraph still open` / `> \begin{center}` / `> # ATX Below` /
`> \end{center}` renders **no heading**; this model reports one. ⚠ L196 covers an **unclosed**
`\begin{x}` and an **orphan** `\end{x}`, and its own control shows a properly closed environment
*is* a block. This row adds the third case: closed, but with a paragraph already open above it.
The model reproduces the phantom unquoted, so the quote is not the discriminator.

---

## Refinements to already-filed items

These are measured facts the existing item does not carry. Each is annotated on the item itself.

- **L244** (the ATX-swallow) — the swallow **is** implemented at top level today:
  `# Adv Quote Head` / `===` reports the literal `# Adv Quote Head`, which is what quarto
  renders. It does **not** fire inside a block quote, where the same shape reports
  `Adv Quote Head`. The residual is therefore quote-scoped, not a blanket decline.
- **L240** (a container opener used as a setext title keeps its marker) — the item lists
  `[^2]:`, `:`, `~` and `(a)` as the uncovered marker classes. **`>` is a fifth**, measured on
  three documents, and it appears only under `from: gfm`.
- **L238** (`listItemContentColumn` accepts `[a-zA-Z]{1,9}` before a `.`) — a new witness
  *shape*: the spurious container column does not only admit a heading, it admits a **setext
  underline** four columns in. Probed: `Dr. Watson kept careful notes.` / `    ===` reports a
  heading; `Mr Watson …` (no period) does not; a >9-letter first word does not; and the
  underline at 8 columns does not.
- **L208** (the block quote is a container this model does not carry) — two spellings it does
  not list: a quote at column 0 failing to **pop** an open list's content columns (F10), and a
  macro on an **unquoted** line between two quoted lines (F12).

---

## ⚠ Record-hygiene finding: three duplicate clusters in `BACKLOG.md`

Verified firsthand by reading each pair side by side. **Reported, not acted on** — merging
backlog entries is an editorial judgement about other sessions' records, so it is filed for an
operator decision rather than performed here (the precedent is the existing
`rawTexMacroLineIsBlock` record-hygiene item).

| Cluster | Items | Verdict |
|---|---|---|
| A setext heading inside a block quote is not reported | **L63** (S225) · **L236** (S183) | **Duplicates.** Same defect, same shape. L236's own witness — `> quoted one` / `    ---` / `# ATX Below` — *is* this audit's F01 45-row document. L63 is the later filing and adds the diagnosis (`consumedMetadataBlockLines` reads raw lines). ⚠ **L109** (S213) is a *third, related* entry — the `> ---` / `> note: alpha` / `> ---` triple under `gfm` — and is **not** a duplicate: its `markdown` twin agrees with the model. But L63 discusses that same triple, so whoever closes L63 must read L109 first. |
| An unreferenced footnote is dropped and we report headings from inside it | **L54** (S227) · **L148** (S209) · **L166** (S201) | **Three filings of one defect**, from three sessions. L148 and L166 are near-verbatim in title. L54 adds the fenced-div spelling and the explicit "the defect is the DROP" framing. |
| A quarto fenced div / callout is a container `contentColumns` never pushes | **L210** (S193) · **L242** (S192) | **L242 is superseded.** It is S192's completeness-critic *lead*, explicitly marked `NOT INDEPENDENTLY MEASURED`; L210 is the same claim after S193 measured it and pinned it as FAMILY 4. |

**Why it matters beyond tidiness:** two successive handoffs ranked a filed item #1 without
re-running its premise (Session 228's finding). A backlog where one defect appears three times
inflates the apparent size of the unfiled surface — which is exactly the premise error this
audit had to correct at the top.

---

## Structural observations

- **The block quote dominates — but as a setting more often than as a cause.** F01, F03, F04,
  F05, F06, F08, F10, F12, F13 — **9 of 16 families, 63 of 116 rows** — are documents in which
  a block quote is present. ⚠ Probed with the markers removed, only **4** change the model's
  answer (F01, F03, F04, F12); **4 do not** (F06, F08, F10, F13), and F05 was not probed
  unquoted. So the quote is genuinely the cause in fewer places than the witness paths suggest,
  and a "fix the block quote" session would leave F06, F08, F10 and F13 exactly where they are.
  `BACKLOG.md`'s own assessment (L208: *"the largest measured residual family"*) still holds by
  volume — it is the framing of *every quoted witness as a quote defect* that does not.
- **The most-replicated divergence is not a defect in the usual sense.** F02 is 42 rows — 36%
  of the total — on a single **real-world** 902-line document (this repo's own design plan),
  and it is the deliberate convention that an outline shows *source* text: of its 35 headings,
  12 differ, 8 by a kept backtick pair and 2 by `smart` curly quotes. It is the only family
  whose witness is not an adversarial probe.
- **The archives cannot find what they do not contain.** Every family here was already
  reachable from a predecessor session's own corpus. A sweep over stored corpora re-evidences;
  it does not discover. (Session 229's gotcha 1 made the same point from the other side.)
- **None of the 116 is a regression.** Session 229 established this by re-scoring each archive
  against its own close-out build (`git archive` of `bb4fd6a4`, `911ed697`, `3717e624`), each
  reproducing that session's recorded wrong-count exactly (79/79, 57/57, 3/3), with 0 rows
  correct-at-close and wrong-today. This audit did not re-derive that; it is cited, not claimed.

## What this audit did NOT do

- **No new `quarto render`.** Every quarto answer is a stored render re-extracted firsthand.
  Where a family's mechanism needs quarto's answer for a shape no archive contains — F07's
  `a | b` vs `| a | b |` discriminator above all — that is stated as unresolved rather than
  reasoned to a conclusion.
- **No `src/` change.** This is an audit; the three new defects are filed, not fixed.
- **No subagent fan-out / blind lens**, unavailable under a session-level instruction for the
  twenty-third session running. Every classification here is single-author, which is the same
  blindness Learning #402 names — a family I had no shape for would not appear.
