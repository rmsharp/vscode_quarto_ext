# What still diverges on real documents, and why

**Audit, Session 265 (2026-09-18).** Workstream:
`docs/methodology/workstreams/AUDIT_WORKSTREAM.md`. Prior audit in this series:
[`docs/REAL-DOCUMENT-TRIAGE.md`](REAL-DOCUMENT-TRIAGE.md) (Session 251).

Operator's pick at Phase 0: *re-score the 3,383 authored documents against quarto at the current
code, attribute every remaining divergence, and re-rank the backlog by real-document reach.*

⚠ **The corpus is personal.** Like the census README
(`docs/planning/scripts/attribute-block/README.md`), this report never names a corpus path, directory
or file; unlike it, a document is identified by its **ordinal** — its 1-based line in
`scratchpad/s251/realfiles.txt` — plus counts. Every minimal reproduction below uses invented names
and text (`scratchpad/s265/repro/synthetic/`), and each was re-run firsthand as quoted.

---

## Audit summary

| | |
|---|---|
| **Scope** | The same 3,383 authored `.qmd`/`.Rmd` documents Session 251 scored; the same 2,438 with usable quarto ground truth. |
| **Criteria** | Does the shipped `findHeadings` (`src/core/qmd/model.ts`) — the list the Outline shows — give the same sequence of heading **levels** quarto renders? Where not, what is the cause, and does an open `BACKLOG.md` item describe it? |
| **Instrument** | Session 251's, unchanged, then corrected for three defects (I1–I3). Six builds, from Session 251's code to HEAD, run over one frozen copy of the corpus. |
| **Coverage** | **43 of 43** divergent documents attributed, **0 unexplained**; every attribution adversarially re-checked by an independent agent; every minimal reproduction re-run firsthand. |
| **Finding count** | Of the 43: **26** are measurement artifacts (three instrument defects), **17** are real model divergences from **seven** root causes (R1–R7: 10 documents fixable, 7 a decision). The corrected instrument also exposes **3** code-generated headings (R8) the old one hid. **Eight root causes**, and no open backlog item describes the trigger of any of them. |

### The four headline corrections

1. **The Outline now matches quarto on 2,395 of 2,438 authored documents (98.24%), up from 2,314
   (94.91%)** on Session 251's own instrument. Every model change since Session 251 was a pure gain:
   no document went from agreeing to diverging, no heading quarto renders was deleted, and no false
   heading was added.

2. **26 of the 43 remaining divergences are the ruler, not the model.** With the instrument corrected,
   agreement is **2,418 of 2,438 (99.18%)** and **20** documents diverge
   (`scratchpad/s265/score_corrected.py`). The same corrected ruler puts Session 251's code at 2,332
   (95.65%) and 106.

3. **No open backlog item describes the trigger of any of the 20.** The ranked "Up Next" heading list
   has **zero** attributed divergence on scorable authored documents at HEAD. The one link: R2's
   model-side refusal is the workaround an open item documents (*"The ported region grammar's
   `START_CODE` is anchored at column 0 …"*), but that item's trigger is an indented fence in a YAML
   region, not R2's. The real-reach work is eight newly found root causes, and the largest is one
   regex.

4. **The error direction flipped.** At Session 251, 81 documents showed *extra* Outline entries; at
   HEAD 4 do. Of the 57 headings still wrong, **39 are headings the Outline misses**, 7 are at the
   wrong level and 11 are extra.

---

## The instrument

### Reproducing Session 251 first

Session 251's model census, corpus text and quarto renders were reused, not rebuilt — so before
anything else the reuse was checked against its published numbers. Three controls, all exact:

| control | expected (Session 251) | measured |
|---|---|---|
| its code (`b50e5f6b`) re-run over its stored corpus text | its stored census | **identical on all 3,383 documents** |
| scored against its ground truth | 2,314 / 2,438 agree, 124 divergent | **2,314 / 2,438, 124** |
| divergence split | 81 phantom (+217), 34 lost (−157), 9 level-only | **81 (+217), 34 (−157), 9** |

### A frozen corpus, because the live one moved

95 of the 3,383 documents changed on disk after 2026-08-25, and the render cache is keyed by path,
not content. So every build was run over the **text Session 251 stored** (`scratchpad/s251/real.pkl`),
which is exactly the text quarto rendered. Checks on that choice:

- **Cache integrity:** the 95 changed documents were re-rendered from their stored text. 54 of 55
  that rendered before give identical headings; the 55th differs in text only (a heading that prints
  today's date).
- **Live corpus:** scoring today's text instead gives the **same 43 divergent documents with identical
  heading lists**. The result does not depend on the snapshot.
- **Renderability:** all 942 documents that failed to render in August were re-rendered. **941 still
  fail**, the same way; the one change is a document that crashed quarto with exit 139 and now renders
  (and agrees) from the same text on the same quarto 1.7.33 — so that crash was environmental.
  Installing Jupyter since August moved no ground truth.

Pinned inputs (unchanged since the census README pinned them):
`scratchpad/s251/realfiles.txt` sha256 `838144e8…d0d13c`; `scratchpad/s251/quarto_real3.tsv` sha256
`5226b08d…dab81`. This session's tooling is under `scratchpad/s265/`: `census.test.ts` (the model over
a frozen corpus, any build), `score.py` (Session 251's rules), `headings.py` (per-heading transitions),
and the corrected instrument — `score_corrected.py`, which reads `extract_headings_v2.py`'s output,
the real-extension renders from `render_keep.py`, and `tools/rawhtml_adjust.js`.

### Three defects in the instrument

Each was found by attributing a divergence, and each was then checked against **every** cached render,
not only the documents that exposed it.

| # | defect | what it did | documents | fix, and its check |
|---|---|---|---:|---|
| I1 | **quarto's own UI counted as headings** (two kinds) | `code-tools: true` adds a hidden "view source" dialog whose title is a real `<h5>Source Code</h5>`; `license:` / `copyright:` / `citation:` front matter mints appendix sections with real `<h2>Reuse` / `Copyright` / `Citation`. None has a source line. | 12 of the 43 | Skip four exact ids (`quarto-embedded-source-code-modal`, `quarto-reuse`, `quarto-copyright`, `quarto-citation`). Re-extracting all 2,441 cached renders changes **exactly those 12** heading lists and no other. ⚠ Skipping `#quarto-appendix` or class `quarto-appendix-heading` instead would delete real headings — an author's `{.appendix}` section and a hoisted bibliography heading carry the same class (checked with a render). |
| I2 | **raw HTML heading tags counted as headings** | An author-typed `<h2>…</h2>` line is a pandoc `RawBlock`, not a `Header`: it gets no section, no TOC entry and no cross-reference id. The extractor counted every `<hN>` tag. | 13 of the 43 (91 tags) | Inserting each line-start raw tag — outside fences and HTML comments, and not `class="title"`, which the extractor already drops — into the model's list at its source line reproduces quarto's level sequence **exactly** in all 13, and moves no agreeing document. ⚠ This is a **definition** — see F3. |
| I3 | **every `.Rmd` rendered under a `.qmd` name** | Session 251's renderer copied each document to `doc.qmd`. A real `.Rmd` is always knitr; a `.qmd` with no `{r}` chunk is not. So the 339 `.Rmd` files with no R chunk were rendered under the wrong engine. | 1 of the 43 → agree; 3 outside it → diverge | Re-rendered with the real extension: 210 of the 214 that render are unchanged; ordinal 2448 flips to **agree**, and **3 agreeing documents flip to diverge** (R8). Controls: 79 `.Rmd` files *with* R chunks give identical headings under both names. Exit codes: unchanged for all 339. |

---

## Findings

### F1 — Six builds, one corpus: where the gain came from

Session 251's instrument throughout, so every row compares with its published 94.91%.

| build | commit | agree | divergent | fixed | newly divergent | real headings deleted | false headings added |
|---|---|---:|---:|---:|---:|---:|---:|
| Session 251 | `b50e5f6b` | 2,314 (94.91%) | 124 | — | — | — | — |
| Session 257 — callout title slot | `ae9e8d94` | 2,359 (96.76%) | 79 | 45 | 0 | 0 | 0 |
| Session 258 — panel-tabset tab labels | `e12cb34b` | 2,380 (97.62%) | 58 | 21 | 0 | 0 | 0 |
| Session 259 — callout attribute values | `f6c8ee3e` | 2,380 | 58 | 0 | 0 | 0 | 0 |
| Session 261 — callout reader gate | `6e1b0601` | 2,380 | 58 | 0 | 0 | 0 | 0 |
| **HEAD** — Session 263's `{{lang}}` fence | `2c611290` | **2,395 (98.24%)** | **43** | 15 | 0 | 0 | 0 |

The heading columns count, per document, each heading removed that quarto renders (a removal is a
loss only where the new build now has fewer of that level-and-text than quarto) and each heading added
that quarto does not render. Sessions 257 and 258 removed 110 and 108 false entries; Session 263
restored 27 real headings and removed 5 false ones. Sessions 259 and 261 changed no heading in any
scorable document.

⚠ **"Lost" rose from 34 to 45 documents at Session 258 without any new loss.** Eleven documents had
both kinds of error; clearing their false tab labels left the pre-existing losses as the net.

### F2 — The 20 real divergences: eight root causes

Ranked by headings affected. "Docs" counts scorable authored documents at HEAD under the corrected
instrument; the two rows marked *decision* and *not modelable* are ranked last on purpose.

| # | root cause | docs | headings | direction | where |
|---|---|---:|---:|---|---|
| R1 | **A line of 7 or more `#` is an empty heading, so it ends the paragraph** — the model caps the bare-run closer at 6 | 1 | 26 | lost | `model.ts:1992`; `:111`, `:129` |
| R2 | **A `---` pair around a knitr chunk that emits nothing becomes YAML after knitr runs** — the heading inside is swallowed ⚠ *DECIDED not open, Session 271 — the Outline keeps the heading; see the R2 reproduction below* | 2 | 8 | phantom | `model.ts:3108`, `:3243` |
| R3 | **A grid table's cells hold blocks** — an ATX heading in a well-formed cell renders; so does a setext pair that an over-wide row fuses into one cell ⚠ *mechanism corrected, and DECIDED not open, Session 270 — see the R3 reproduction below* | 3 | 8 | lost | `model.ts:111`, `:833`, `:4456`–`:4511` |
| R4 | **A block-level HTML tag or TeX command anywhere in ATX content means the line is not a heading** | 2 | 3 | phantom | `model.ts:111`; tables at `:1366`, `:1485` |
| R5 | **knitr's chunk grammar is not quarto's** — a digit-bearing engine with spaced options is a chunk to knitr; the model refuses it and lets its closer open a fence | 1 | 1 | lost | `model.ts:5937`, `:7228`–`:7260` |
| R6 | **In a knitr document, a stray ` ``` ` pairs with a later chunk's closer in the model** — knitr consumed that closer first | 1 | 1 | lost | `model.ts:7258`, `:9411` |
| R7 | *decision* — **quarto's HTML appendix re-levels the last section's heading to `h2`** when that section holds only the heading and citeproc adds `#refs` | 7 | 7 | level | none — no document-level pass |
| R8 | *not modelable* — **a heading printed by inline R** | 3 | 3 | lost | — |
| | **total** | **20** | **57** | | |

Documents by root cause: R1 ordinal 2494 · R2 2147, 2275 · R3 482 (well-formed), 491 and 610
(over-wide row) · R4 1985 (TeX), 3004 (HTML) · R5 2391 · R6 2519 · R7 837, 838, 840–843, 847 (seven
files of one R package, one template) · R8 1352, 2566, 2898.

**R2 and an open item.** The refusal that makes R2 a phantom is `FENCE_ANYWHERE_IN_BLOCK`, the
workaround recorded by *"The ported region grammar's `START_CODE` is anchored at column 0, where quarto
tracks an INDENTED fence inside a YAML region"*, which already notes it "costs a phantom rather than a
heading" and that the port feeds the validation partitioner (`core/yaml-value-flags.ts`), so a change
there needs its own oracle run. Fixing that item would not fix R2: R2 needs to know what knitr leaves
behind, not where a fence sits.

**Minimal reproductions** (each rendered with `quarto render --to html --no-execute`, quarto 1.7.33;
"model" is `findHeadings` at HEAD):

- **R1** — `engine: markdown`; a line of 64 `#`, then `## After Sixty Four Run` and
  `## Chained After Heading` on the next two lines. Quarto: both headings. Model: neither. The same
  with 7 `#`, and with `######## eight with text`. Controls: 6 `#` agrees; a run pressed under
  prose gives no heading in either. ⚠ A fix must stay at column 0: an **indented** `  ######` above
  `## X` gives no heading in quarto, but the model already reports one today (a zero-reach phantom
  found while bounding this).
- **R2** — knitr document: `## Kept Before` · `Text.` · blank · `---` · `## Swallowed Heading` ·
  ` ```{r, echo = FALSE} ` · `x <- 1` · ` ``` ` · blank · `---`. Quarto: no `Swallowed Heading` (knitr
  turns the chunk into an empty `::: {.cell}`, the span becomes valid YAML, and the `#` line is a
  YAML comment). Model: reports it. Given the post-knitr text directly, the model already agrees.
  ⚠ Depends on the chunk emitting nothing: under real execution a chunk with visible output makes the
  block invalid YAML and quarto exits 1. The diagnosing agent measured both affected documents exiting
  1 when executed (one on a plot, one on an unrelated setup-chunk error); not re-verified.

  > ⚠ **DECIDED, Session 271 — the Outline KEEPS this heading, and the row above stays as a record of
  > the RENDER, not of a defect.** The unverified sentence above is now verified, and the mechanism is
  > binary rather than conditional. Measured firsthand on quarto 1.7.33 (`scratchpad/s271/probes/`):
  > a chunk that leaves NOTHING behind (`echo=FALSE`; `echo=FALSE, results='hide'`; `include=FALSE`)
  > gives exit 0 and no heading. ⚠ The leftover is OBSERVED, not inferred: rendered with
  > `keep-md: true`, the intermediate `.html.md` holds `---` / `## Swallowed Heading` / blank /
  > `::: {.cell}` / blank / `:::` / blank / blank / `---` (`scratchpad/s271/keepmd/`). YAML reads
  > `::: {.cell}` as the key `::` with a flow-mapping value and `:::` as `::` again — hence quarto's
  > own `YAML warning (line 7 column 1): Duplicate key: ['::']`. ⚠ But the cell div is a **passenger**:
  > deleting both lines by hand swallows the heading just the same. What makes the span parse is that
  > the heading line is a YAML COMMENT. ⚠ And the shape needs **no blank line between the opening
  > `---` and the heading** — insert one and the heading RENDERS, which is why this bites slidify
  > decks specifically; a PROSE line in the span kills the render instead, at quarto's own pre-knitr
  > metadata reader (`Error reading metadata from …`), a different stage from the Lua failure. A
  > chunk whose SOURCE or OUTPUT survives (default `echo`; `eval=FALSE`, which still echoes; a plot
  > under `results='hide'`, which `results` does not suppress) makes the span invalid YAML and
  > `quarto render` **fails** — exit 1, `YAML parse exception`, `Error running Lua`. **There is no
  > spelling where quarto renders that heading.** `.qmd` and `.Rmd` behave identically, and with no
  > chunk at all the heading is swallowed too.
  >
  > **The oracle:** `npm run observe:posit` against `quarto.quarto-1.135.0` (`ours-loaded: false`,
  > both controls green) returns `Constant:Swallowed Heading` for this shape in both `.Rmd` and
  > `.qmd`, and all five `## Slide N` of a five-slide slidify deck where quarto renders three. Posit
  > shows it, this model shows it, `CLAUDE.md` §Clean-room boundary says the product mirrors Posit.
  >
  > **The cost of the other choice, measured before deciding:** dropping `FENCE_ANYWHERE_IN_BLOCK`
  > scores *better* (2,421 → 2,422 of 2,438) and removes **90 headings from 32 documents, 31 of which
  > `quarto render` exits 1 on** — slidify decks where every slide boundary is a bare `---` and quarto
  > dies reading a slide as YAML. The score sees 1 of the 32. ⚠ A by-catch of the same observation is
  > filed separately and is NOT covered by this decision: on the no-chunk spelling the model DELETES a
  > heading Posit shows, 80 headings across 30 documents — see `BACKLOG.md`.
- **R3** — `engine: markdown`; `+-----------+------------------+` / `| ### Alpha | body one |` / … —
  quarto renders `h3 Alpha` inside the `<td>`; a pipe table does not. A heading in a non-first column
  renders too. The over-wide half: one body row one character wider than its border makes pandoc add
  a narrow column, the `+====+` separator stops being a head divider, and `Head A` / `====` fuse into a
  setext `h1` inside a cell. The author wrote no heading there.

  > ⚠ **CORRECTION, Session 270 — the over-wide half's MECHANISM as stated above is wrong, and its
  > counts are right.** Measured on quarto 1.7.33 against a faithful reproduction of ordinal 491's
  > shape (invented text, `scratchpad/s270/probes/me/`): a body row **one** character wider than its
  > border is the single overhang that does **not** fire — pandoc absorbs it into a 1%-wide trailing
  > column and `+====+` keeps working as a head divider (`<thead>` present). **Two or more** fires;
  > measured at 2, 3, 4, 5, 8, 12, 20, 32 and 49, and at both the second and the last body row.
  > The measured variable is the row's **last non-whitespace character** landing two or more columns
  > past the border's right edge — trailing whitespace is stripped before the column is measured and
  > never fires, and a non-pipe character out there fires with the closing `|` still flush.
  > ⚠ **A SECOND, INDEPENDENT TRIGGER the row above does not mention:** a `+===+` divider
  > **truncated at a column boundary** — its trailing `+` sitting exactly on one of the top border's
  > internal offsets — produces the same fusion with every row flush. Plus-offset alignment against
  > the top border is the variable, not column count. ⚠ Also measured: the headless collapse
  > (`thead` 1 → 0) and the phantom `h1` are **separable** — some shapes collapse the header and
  > render no heading at all.
  > The document and heading counts (3 docs, 8 lost) are unaffected and were re-derived from
  > `quarto_v2.tsv`: ordinal 482 gives 3 ATX, 491 gives 3 fused `h1`, 610 gives 2.
  > **R3 is now DECIDED rather than open** — see `BACKLOG.md`'s RECORD item, decision (3), and
  > `CHANGELOG.md` under Session 270. The decision rests on a black-box observation of Posit's
  > Outline (`npm run observe:posit`), not on this report.
- **R4** — `engine: markdown`; `### 2. Overview <section>` and `## Intro \maketitle`. Quarto: neither
  is a heading (pandoc's inline parser refuses a block tag or command, and the line becomes literal
  text plus a raw block). Model: both. Inline ones stay headings in both: `### 3. Inline <span>ok</span>`
  renders `h3`, and so does a tag whose name is not a block tag.
- **R5** — knitr document (an `{r}` chunk selects knitr): ` ```{fortran95, eval = FALSE} ` ·
  `integer a` · blank · `integer b` · ` ``` ` · blank · `#### After Chunk`. Quarto: `h4 After Chunk`.
  Model: none. Controls (diagnosing agent, re-checked by its verifier): a letters-only engine with the
  same options, and the same engine with `,eval=FALSE` unspaced, agree; the same bytes under
  `engine: markdown` give none in both.

  > ⚠ **CLOSED, Session 273 — and this row's stated TRIGGER is falsified.** It is not "a digit-bearing
  > engine with spaced options": `{glue_sql, connection = con}` has no digit and fires,
  > `{cpp11,eval=FALSE}` has a digit and does not. The real gate is knitr's chunk grammar INTERSECTED
  > WITH pandoc's class grammar, `[A-Za-z][A-Za-z0-9_]*` — knitr consumes the chunk before pandoc sees
  > it, but knitr's rewrite target is a pandoc CLASS and pandoc refuses one not beginning with a letter.
  > The counts in this row are right. See `CHANGELOG.md`, Session 273.
  >
  > ⚠ **DECIDED, Session 274 — the `engine: markdown` arm named in the controls above is a
  > quarto/Posit DISAGREEMENT, and the Outline FOLLOWS `quarto render`.** For those bytes quarto emits
  > no heading and this model emits none — but **Posit's Outline shows the heading** (observed,
  > `npm run observe:posit`, probe `r02_r5_qmd_markdown`), because Posit pairs the fence engine-blind.
  > The decision is to keep following the render, and it is the ONE decision of the six that does not
  > mirror Posit: Posit's own maintainers hold that the Outline should match the rendered TOC
  > ([`quarto-dev/quarto#829`](https://github.com/quarto-dev/quarto/issues/829), open), so the
  > behaviour is an acknowledged upstream defect rather than a design choice. See `BACKLOG.md`'s
  > RECORD item, decision (6), for the evidence, the unmeasured cost of the alternative, and the
  > Session 274 re-measurement that confirmed the probe figures.
- **R6** — knitr document: `prose` · blank · a bare ` ``` ` · blank · `## After Stray Fence` · blank ·
  ` ```{r demo, echo=FALSE} ` · `y <- 2` · ` ``` `. Quarto: `h2 After Stray Fence` (the stray fence is
  left unclosed and renders as `<p>```</p>`). Model: none. Controls: `echo = TRUE` (the chunk's own
  output re-closes the stray fence) and `engine: markdown` give none in both.

  > ✅ **CLOSED, Session 275 — and measured under REAL execution first.** Ordinal 2519 as it sits on
  > disk does not render with execution at all (exit 1, a data file it reads is missing); a what-if
  > copy with the data supplied renders exit 0 and shows the heading, as `--no-execute` does, so the
  > divergence was real under both conventions. The mechanism is exactly this row's: knitr replaces a
  > chunk it claims with its output, and a chunk that emits NO fence leaves the stray fence unclosed.
  > ⚠ But what a chunk emits is wider than `echo`: `dot`/`mermaid`/`ojs` re-emit their own fence
  > whatever `echo` says, and a non-echoed chunk that PRINTS emits a bare-fenced block when it runs.
  > The fix therefore reads a chunk as silent only when that is positively established, and an
  > adversarial pass found ten shapes on which a looser first cut deleted headings. Score 2422 →
  > **2423** of 2438; over all 3,383 documents 2 change (2519 +1, 2900 +5), 0 headings lost. With it,
  > every root cause in this report is closed, decided or not modelable. See `CHANGELOG.md`,
  > Session 275, and `BACKLOG.md`'s *"R6 residuals"* for what the rule leaves at HEAD's answer.
- **R7** — `engine: markdown`, one inline `references:` entry, `# Method` / `See @doe2001.` /
  `# Sources` as the last line. Quarto: `h1 Method`, **`h2` Sources**. Model: `h1 Sources`. It fires on
  any trailing section, whatever its text, and is HTML-only (quarto's `processDocumentAppendix`).
  Controls: no citation, an explicit `::: {#refs}` div, or `appendix-style: none` keep `h1` and agree;
  with text after the heading quarto keeps the author's `h1` **and** mints its own `h2 References`, so
  that document still differs — by the other mechanism.
- **R8** — an `.Rmd`: `# First` · `Some text.` · blank · `` `r if (knitr::is_html_output()) '## Printed By R {-}'` ``.
  Rendered under its real name: `h1 First`, `h2 Printed By R`. Model: `h1 First`. Rendered as `.qmd`
  (no R chunk, so no knitr): `h1 First` — which is how Session 251's instrument hid all three.

### F3 — Raw HTML headings are a definition, not a defect (operator decision)

91 raw `<h1>`–`<h6>` tags in 13 documents render as heading-sized text. Counting them as headings, as
the old instrument did, would make them the largest "defect" left. They are not headings to anything
this extension mirrors: pandoc parses them as `RawBlock`, quarto's own TOC omits them (checked with
`toc: true`, `toc-depth: 6`), and Posit's Outline builds its entries only from markdown-it
`heading_open` tokens (checked in its bundled `lsp.js`). The model follows all three, and this audit
scores them that way. Listing raw `<hN>` in the Outline would be a new feature beyond Posit parity,
not a fix.

### F4 — Three headings no static reader can know (R8)

Three `.Rmd` documents print a heading from inline R, conditioned on the output format. Knitr evaluates
inline R even under `--no-execute`, so quarto renders the heading; the model sees a paragraph. The
right answer depends on running R, so this is recorded rather than filed as a fix. R8 was found after
the diagnosis workflow ran: it is reproduced firsthand (above) but was not re-checked by a second agent.

### F5 — The appendix re-level (R7) mirrors a presentation step, not a parse

R7 has the most documents but is one template in one package, and it is quarto's HTML post-processor
moving an author's heading into the page's appendix and re-levelling it. Mirroring it needs citation
resolution, four metadata gates and a "section holds only its heading" test, and it would make the
Outline HTML-specific (PDF and docx keep the source level). It has the shape of the existing
decision item *"A tabset's PREAMBLE is dropped by quarto and kept by this model, on purpose."*
**Recommended disposition: record the decision, do not implement.**

### F6 — A backlog item whose own example now agrees

*"A QUARTO FENCED DIV / CALLOUT is a container `contentColumns` never pushes"* (filed Session 193) names
two questions. The callout-title rule shipped in Session 257. The column question needs no code:
Session 189 measured a plain fenced div's content column as 0, so `contentColumns` correctly never
pushes one (`divColumns`, `model.ts:6529`, is a different thing — the stack of opener columns used to
match closers). Its own example as filed (`::: {.callout-note}` / `   ## Larkspur Callout Title` / body /
`:::`) gives no heading in the model or in quarto at HEAD — and already gave none at Session 251.
Unindented, the same heading was a phantom at Session 251 and agrees at HEAD (Session 257). It explains
none of the 20. **Candidate for closure — operator decision**; `check-backlog` cannot see it, because
its lead does not announce completion.

### F7 — Found while bounding, zero reach here

- A cell tag quarto's engine does not consume is passed to pandoc verbatim — under `engine: markdown`,
  or for a language no jupyter kernel claims — and pandoc refuses spellings like `{r, echo=FALSE}`, so
  a blank-line-separated body renders as live markdown. The model never checks a cell tag against
  pandoc (`model.ts:7228`). 0 scorable documents.
- Under `engine: markdown`, ` ```{fortran95,eval=FALSE} ` (unspaced) with a later fence below it: the
  model accepts the opener, pandoc refuses it and its closer opens a code block that swallows the next
  heading — a model phantom. 0 documents. Probably a member of the attribute-tokenizer plan's deferred
  shapes or of *"What P1's faithful tag rewrite UN-MASKED"*; not checked.
- An indented bare hash run: see R1's ⚠.
- The instrument drops a heading whose rendered text is empty (`## \emph{x}` can render an empty
  `<h2>`), and it counts an inline raw `<hN>` inside a paragraph. Neither occurs in a divergent document.

---

## Items audited

| item | status |
|---|---|
| 43 documents divergent at HEAD under Session 251's instrument | **43 / 43 attributed**; each by one agent, re-checked by a second instructed to refute it (18 root-cause records — a cause found in two clusters counts twice: 18 upheld, 0 refuted, 0 amended in substance); 23 of their reproductions re-run firsthand, and every reproduction quoted in F2 re-run again with invented text |
| R8 | found after the workflow, by I3; reproduced firsthand; **no second-agent check** |
| instrument artifacts I1, I2 | checked against **all 2,441** cached renders: move exactly the predicted documents, nothing else |
| instrument artifact I3 | all **339** no-R-chunk `.Rmd` files re-rendered under their real name, plus 79 with R chunks as controls |
| the 942 documents with no ground truth | all re-rendered: 941 still fail |
| every open `BACKLOG.md` item | R1–R7 grepped against the backlog and the ledgers by two agents each, and the report re-checked by a third: **no** open item describes any of their triggers; R2's refusal is an open item's workaround (F2) |
| this report | reviewed by three agents (numbers re-derived, privacy, code citations); their confirmed findings are corrected here |

## Comparison with the prior audit

| metric | Session 251 | Session 265 | trend |
|---|---:|---:|---|
| structural agreement, Session 251's instrument | 94.91% | 98.24% | ↑ |
| structural agreement, corrected instrument | 95.65% | **99.18%** | ↑ |
| divergent documents, corrected instrument | 106 | **20** | ↓ |
| of which phantom / lost / level-only | 81 / 16 / 9 | 4 / 9 / 7 | ↓ |
| divergent documents explained by an open backlog item | 108 (construct presence — an upper bound) | **0** (by attribution) | — |
| unexplained | 16 → 5 | **0** | ↓ |
| instrument defects found | 3 (page chrome, tail-stripping, `id="footnotes"`) | 3 more (I1–I3) | — |

## Recommendations

1. **Take R1 next.** It is the largest real loss left — 26 headings in one document — and the fix is a
   widening of one closer row plus the text-bearing `#######` sibling, with the column-0 caution. Then
   R4 (one fix site for both halves), then R2.
2. **Decide, don't build, R7**, and decide the raw-HTML definition (F3). Both are recorded here so a
   future session does not re-derive them.
3. **Close or annotate the fenced-div item (F6).**
4. **Make the corrected instrument the standing measure.** `score_corrected.py` reproduces this
   report's 2,418 / 20 from three changes to Session 251's instrument (I1–I3), with no hand-made
   exception, and once the one-time re-renders exist it runs in seconds. It stays machine-specific:
   the corpus is personal and never committed.
5. **Stop ranking the existing heading items by "real documents containing the construct".** At HEAD
   none of them explains a divergent document. Presence counts measured an upper bound; attribution
   measures the cause.

## Coverage

| | |
|---|---|
| builds scored | 6 / 6, every one over the same frozen text |
| divergent documents attributed | **43 / 43**, plus the 3 the corrected instrument exposed |
| documents with usable ground truth | 2,438 (72%); 2,439 counting the former crash |

**Not covered.** The 941 documents quarto cannot render — for them the Outline is the only structure
the user ever sees, and nothing here measures it. Text-only differences (249 documents, dominated by
smart quotes and stripped emphasis, as in Session 251) were counted, not classified. Every render used
`--no-execute`; R2 and R6 depend on what a chunk emits and were not measured under real execution
beyond the controls above. (R6 was, by Session 275 — see its dated note above.) It is one machine's corpus, and R7's seven documents are one template.
