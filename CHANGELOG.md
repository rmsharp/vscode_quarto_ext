# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

When completing work, remove the item from `BACKLOG.md` and add an entry here.

## [Unreleased]

### 2026-08-18 · [ad hoc] Session 219 — which id a multi-id attribute block defines is a reader split, and the ids come from the tokens (SHIPPED)

- **Model:** Claude Opus 5.
- **The rule, measured before it was written.** 200 documents rendered through the real `quarto render` path (quarto 1.7.33): the pandoc three — no `from:`, `markdown`, `markdown_phpextra` — define the **LAST** `#` in a heading attribute block, and `commonmark_x` defines the **FIRST**. `ATTR_ID` took the first for every reader, so three of the four honouring readers got a cross-reference target the rendered document does not define, and the fourth was right by luck. 20 of 20 predictions on the calibration set were called correctly before rendering, including the three- and four-id rows that make "the last wins" falsifiable against "the second wins".
- **Two rows carry the value and they point opposite ways,** because `src/core/refs.ts` keeps only `sec-` ids: `{#intro #sec-t16}` really defines `sec-t16` and this model indexed nothing, while `{#sec-t17 #intro}` really defines `intro` — no `sec-` target at all — and this model indexed `sec-t17`, a fabricated one.
- **⚠ A regression this session shipped and its own adversarial pass caught.** `ATTR_KEY_VALUE`'s bare value admits a `#`, so `{#sec-x01 key=#sec-fake}` is a valid block whose real id is `sec-x01`; C1 scanned the block's raw text and took `sec-fake`. The pre-session build was right on all 12 such rows by accident, established by probing the pre-session source rather than by reading the diff. C3 takes the ids from `headingAttributeTokens` instead, where a key=value token contributes none.
- **A second layer, predicted before any code:** `idColumn` resolved a label with `lastIndexOf('#' + id)`, which finds the shorter id inside the longer whenever two share a prefix — reachable only through `commonmark_x`, and invisible to the id string. The fix takes the last occurrence ending at an identifier boundary, keeping the trailing-occurrence rule a Session 8 adversarial test depends on.
- **Measurement.** Calibration 46/100 → **100/100**; adversarial 76/100 → **98/100**; FIXED 76, **INTRODUCED 0**. Predecessor sweep of **46,329 documents** across 4,995 directories: **TEXT moved in ZERO**, 13 id/label rows moved and all 13 were wrong before — 7 land on quarto's rendered answer, 6 delete an id mined out of a quoted value. Repo control **byte-identical** over 113 tracked documents.
- **Verification.** `check-types` 0 · `compile` 0 · `compile-tests` 0 · `npm test` **2113 passed / 66 files** (baseline 2095) · `test:oracle` 131 / 124 agree / 4 lost TP / 3 CARDINAL FP / 0 unrelated (byte-identical to S180–S218) · `check-package` OK 42 files / 5.55 MB · `check-backlog` OK · `test:integration` **530 passing / 0 failing / exit 0** (baseline 528, +2). NOT RUN: `test:lsp` — no LSP surface touched.
- **Filed, not fixed:** a reference to an id containing `:`, `.` or a non-ASCII letter cannot be resolved at all — `refIdAt`'s `ID_CHAR` is `[A-Za-z0-9_-]` while the definition side admits pandoc's set, so the extension offers `@sec-meth:ods` in completion and then cannot navigate to it.
- **Commits:** `3990ddff` (1B claim, eight decision rules), `a4141883` (guard), `9721927a` (C1), `fcf27ea7` (C2), `bdd9381d` (C3), `9c432e4f` (C4).

### 2026-08-12 · [ad hoc] Session 218 — a trailing brace group is an attribute block only when it is one, per reader (SHIPPED)

- **Model:** Claude Opus 5.
- **Fixed** the over-fire that this project's own backlog called *"the only open item that FABRICATES a `sec-` label"*: `HEADING_ATTRIBUTE` said only WHERE a heading's trailing `{…}` would be, so prose that merely ended in braces was stripped as though it were an attribute block, and an ESCAPE inside the block — `{#sec-a\:x}`, which quarto renders as ordinary text while defining **no id at all** — was stripped and entered in the `src/core/refs.ts` cross-reference index. The editor offered a completion for a section identifier the rendered document never defines.
- **Added** `headingAttributesValid` with a quote-aware tokenizer (`headingAttributeTokens`) and four measured token grammars: `ATTR_KEY_VALUE`, `ATTR_ATOM_RUN`, `ATTR_KEY_VALUE_COMMONMARK`, `ATTR_ATOM_COMMONMARK`. `commonmarkDialect` is now threaded into `buildHeading` and so reaches BOTH the ATX and setext paths.
- **⚠ Validity is READER-SPLIT and the item was filed with no reader clause.** The pandoc three (no `from:`, `markdown`, `markdown_phpextra`) agree on all 68 measured shapes; `commonmark_x` — the only CommonMark-family reader that honours the block — diverges on twelve, eleven by rejecting what the pandoc family accepts (`{-}`, `{}`, `{key=}`, `{#a#b}`, `{.c1.c2}`, a single-quoted value, …) and **one by accepting what it rejects** (`{.1cls}`), so no single tightness dial expresses it. `{-}` alone pays for the split: it is pandoc's documented shorthand for `.unnumbered`.
- **⚠ The item's own filed grammar would have shipped a regression.** It sketched the fix as "`#id`, `.class`, `key=val`, whitespace-separated", which rejects `{-}` and rejects `{key="a b"}` — both blocks quarto really strips.
- **Measured:** 605 documents rendered through the real `quarto render` path (quarto 1.7.33) and scored per document against the pre-session build on identical bytes — designed and adversarial **292 → 411 of 473**, with **ZERO TRUE REGRESSIONS** by the explicit `agreed_pre and not agreed_post` check. A 45,543-document re-score of every predecessor corpus moved **13 documents, with `AGREE pre 0/13`**. The 113 tracked markdown documents are BYTE-IDENTICAL across four views. `cal3` was a 24-shape PREDICTION SET called before rendering: **21/24**.
- **⚠ Disclosed:** this session introduced a text-adding regression in its own character class (`[A-Za-z]` for a class's first character, which keeps `{.クラス}`) and its own adversarial pass caught it two commits later; six rows the character-similarity direction oracle scored as moving AWAY were each adjudicated by reading and are all more correct.
- **Verification:** `check-types` 0 · `compile` 0 · `compile-tests` 0 · `npm test` **2095 passed / 66 files** · `test:oracle` 131 / 124 agree (byte-identical to S180–S217) · `test:integration` **528 passing / 0 failing / exit 0** · `check-package` OK 42 files · `check-backlog` OK.
- **Backlog:** closed the brace-group validity item; filed four — which id a multi-id block defines (a reader split, index-affecting), a heading that is only a block reporting nothing, the two-block and closing-run orderings, and `commonmark_x`'s non-ASCII key.
- Commits `912e23f5` (claim), `f2d7a5cd` (guard), `84e07196`, `46833455`, `ce5f455f`.

### 2026-08-11 · [ad hoc] Session 217 — a heading's backslash escapes are processed, per reader and by parity (SHIPPED)

- **Model:** Claude Opus 5.
- This model processed **no markdown escapes anywhere**, so a heading kept every backslash quarto
  consumes — and the two `(?<!\\)` lookbehinds two prior sessions added to work around that gap
  each looked at **one character**, so an escaped backslash before a real construct defeated both.
  `# Cal Echo Esc\#` renders `h1:Cal Echo Esc#` and this model reported the backslash;
  `# Adv Esc Backslash \\{#sec-advesb}` renders `h1:Adv Esc Backslash \` **and defines
  `id="sec-advesb"`**, and this model reported the whole literal and indexed nothing.
- **⚠ The item was filed by two consecutive handoffs as "a general escape pass over heading text",
  with no reader clause at all, and the escapable set is a THREE-WAY reader split.** Measured over
  213 documents, nine readers, each with its own plain control:

  | set | rule | readers |
  |---|---|---|
  | A | any punctuation **or symbol**, non-ASCII included (pandoc `all_symbols_escapable`) | *(no `from:`)* · `markdown` · `markdown_mmd` · `markdown_github` |
  | B | the 32 ASCII punctuation characters (CommonMark 6.1) | `gfm` · `commonmark` · `commonmark_x` |
  | C | `` !#()*+-.>[\]_`{} `` — Markdown.pl's set **plus `>`** | `markdown_strict` · `markdown_phpextra` |

  Set B is exactly `FRONTMATTER_COMMONMARK_FROM`, but A-vs-C cuts the pandoc family 4–2, so no
  existing flag expresses this and reusing one would decode 16 characters two readers render
  literally. ⚠ **Two of nine pre-render predictions were wrong** — `markdown_mmd` and
  `markdown_phpextra` sit on the opposite sides from where they were predicted, in the
  text-deleting direction. ⚠ `markdown_github` is with `markdown`, the fifth consecutive session
  it splits from the name pandoc documents it as a synonym for.
- **⚠ `markdown` and `gfm` agree on all 32 ASCII punctuation characters and diverge on exactly
  two non-ASCII symbols.** Thirty-two agreeing rows would have justified merging them into one
  set; the `\±` / `\€` probes existed only to make that merge visibly wrong, and they did.
- **Parity** replaces both lookbehinds with `(?<=(?:^|[^\\])(?:\\\\)*)`: an escape needs an ODD run
  of backslashes, so a construct is real after an EVEN run. Confirmed on the full 0–3 ladder ×
  two constructs × three readers — no predecessor had rendered the ladder, only single rungs.
  This is the **only** way the rule reaches `src/core/refs.ts`, since the model has no auto-id
  generation; all 18 predecessor id moves land on quarto's answer.
- Two Set-A special cases that belong to no set: `\<space>` is a **non-breaking space** and a
  trailing `\` is a **hard line break**. Both invisible to every predecessor extractor column,
  which collapses whitespace — so a naive `\\(.)` → `$1` decode would have scored GREEN on the
  nbsp row while being wrong. ⚠ This also closes a residual **Session 203** filed and could not
  fix (`b_markdown_solo`).
- **⚠ Session 216's heading-deleting regression was reproduced exactly — same constant, same
  function — and its own gotcha is why it cost nothing.** Even-parity newly matches
  `#Cal Tg2 Attr \\{#sec-tg2}`, and `markdown_phpextra` is the one reader with both a tight ATX
  row and attribute honouring, so `tightAtxWouldWorsen` began declining a heading quarto renders.
  **All 2052 unit tests passed while that row was deleted.** The 18-document call-site corpus
  existed *before* the change because S216's gotcha 1 said to build it. That corpus then justified
  removing **both** of the function's other clauses, each adjudicated per shape; only the
  setext-underline clause survives, and `ATX_CLOSING_ESCAPED` is deleted.
- **Five predecessor pins reversed**, every one proven by extracting its exact bytes and
  rendering. ⚠ One had been asserting a **different document from the one it cited** for three
  sessions: the comment names a two-backslash corpus document, the TypeScript literal `"\\{"`
  produces one. Both spellings are now pinned.
- **Measurement.** 664 documents rendered through the real `quarto render` path (1.7.33) and
  scored per document against the pre-session build on identical bytes, plus a **45,259-document**
  re-score of every predecessor corpus across 3,614 directories. Designed **107 → 309 of 319, with
  all six per-corpus predictions EXACT** (61, 132, 18, 80, 7, 11 — written to `CALIBRATION.md`
  before any code). Adversarial 13 → 28 of 33. Predecessors: 284 movers, every one rendered, **279
  fixed, 0 introduced**. Repo control 115 documents **byte-identical** across four views and proven
  effective by injection in the same run (5 movers all to quarto, 5 stayers held, 10/10).
  ⚠ **Zero true regressions**, established mechanically over all ten corpora at once by an explicit
  `agreed_pre and not agreed_post` check (130 → 644 of 664); the eight re-textings were then scored
  for **direction** by character similarity, and the two that moved *away* are disclosed, pinned
  and filed rather than reported as "no regressions".
- ⚠ **Two instrument defects were built and caught in-session, both in the harness created to avoid
  instrument defects**: a `|` join chosen precisely because the corpus escapes a comma, then
  defeated by a corpus that escapes a pipe; and a scorer id-heuristic that ate seven rows whose
  text legitimately ends in `#`. Both were found only by re-deriving the expected pre-score by
  hand and reconciling it against the measured one — and both pointed the *safe* way, the first in
  this family to do so.
- TDD: 10-block guard written and run green **before** the change, covering `indexLabels` and —
  a first — three rows this model gets wrong and must go on getting wrong. **Six RED→GREEN cycles,
  all six authored-first**, no disclosed deviation.
- Verification: `compile` 0 · `npm test` **2062** (+22) · `test:oracle` 131/124 agree
  (byte-identical to S180–S216) · `check-package` OK 42 files / 5.55 MB · `check-backlog` OK ·
  `test:integration` **526 passing / 0 failing** (+2), on the operator's go-ahead sought in advance.
  Not run: `test:lsp` (no LSP surface touched); no blind sweep (tenth session).
- `BACKLOG.md`: two items removed (the escape gap and the single-character lookbehind), three
  filed (the code-span decode, `\<space>` before a closing run, `\<TAB>`), and the brace-validity
  item augmented with the sharper witness this session found.

### 2026-08-11 · [ad hoc] Session 217 pre-flight — the methodology dashboard is re-synced from canonical (v2.13.0 → v2.15.2)

- **Model:** Claude Opus 5.
- `methodology_dashboard.py` had been stale for **eighteen consecutive sessions**, each of which
  noted it at Phase 0 and correctly declined to act on it (it is not project code and fixing it is
  not a deliverable). The re-synced copy was found **uncommitted in the working tree** at this
  session's Phase 0 and is **byte-identical to the canonical**
  `/Users/rmsharp/Development/methodology/starter-kit/methodology_dashboard.py` at v2.15.2 —
  verified with `diff -q` before committing, so nothing was hand-edited on the way in and the
  copy stays syncable (CLAUDE.md, "Customizations Go in CLAUDE.md, Not in Synced Files").
- Committed **on its own, before any deliverable work**, per SAFEGUARDS' pre-flight rule ("commit
  everything clean before starting"). It is **not** this session's deliverable; the session was
  claimed for the markdown-escape item immediately after.
- What the upstream versions bring, for the record: `.qmd`/`.rmd` added to `DOC_EXTS` and `.r`
  given a `LANG_MAP` row (BL-34 — both were falling through to "other" and counting no LOC, which
  matters here since this repo is a Quarto extension); a context-budget gate registered in
  `_FRAMEWORK_INSTALLED_CONTENT` with a `version_re is not None` guard for the entry that
  identifies itself by signature alone; `--sync` given an optional single-target directory plus a
  `--force` gate that refuses to overwrite a git-tracked or newly-`.gitignore`-uncovered target;
  and the staleness warning now prints the **scoped** re-sync command first rather than only the
  portfolio-wide sweep.
- ⚠ **No new root file arrived with this sync**, so `check-package`'s deny-by-default allowlist is
  unaffected — unlike the v2.8.0 → v2.13.0 sync (`189c77ac`), which had to stop two new root files
  shipping in the `.vsix`. Re-verified rather than assumed.

### 2026-08-11 · [ad hoc] Session 216 — the heading attribute block is honoured per reader, and needs no space before it (SHIPPED)

- **Model:** Claude Opus 5.
- `HEADING_ATTRIBUTE` stripped a trailing `{…}` for **every** reader and **only** when whitespace
  preceded the brace. Quarto's answer is neither. `# Cal Alpha Tight{#sec-alpha-ti}` renders
  `<section id="sec-alpha-ti"><h1>Cal Alpha Tight</h1>` while this model reported the whole literal
  and indexed no id; and five of the nine measured readers render the block as **ordinary text**,
  where this model stripped it and put a `sec-` target in the cross-reference index that the
  rendered document never defines.
- **⚠ Two filed backlog items turned out to be one, proved from a predecessor's already-rendered
  TSVs before the session was claimed.** `BACKLOG.md` sized the unspaced brace "LOW for the regex"
  and filed the `header_attributes` reader table separately, instructing the next session to
  measure whether they are one. They are: `s215/cal2/b_attrtight_gfm` is correct today only
  because two wrong rules cancel, so the narrow fix alone turns a right row wrong.
- **Measured reader table** (`scratchpad/s216/cal`, 63 documents, nine readers × seven shapes) —
  honours the block: no `from:` · `markdown` · `markdown_phpextra` · `commonmark_x`; renders it
  literal: `markdown_strict` · `markdown_mmd` · `markdown_github` · `gfm` · `commonmark`.
  **⚠ A 4–5 split that is NOT `FRONTMATTER_COMMONMARK_FROM`** — `commonmark_x` sits with
  `markdown` — and **⚠ `markdown_github` behaves like `gfm` here**, the opposite of the trap
  Sessions 214 and 215 each hit, so the inherited learning rather than the base name was what
  would have produced the wrong row.
- **⚠ The extension outranks the base and LAST WINS**, all four rows measured and all eight `cal3`
  spellings predicted before rendering. The scan takes the final occurrence rather than copying
  `fromKeepsBlankBeforeHeader`, whose first-match defect remains an open item one constant over.
- **⚠ A heading-DELETING regression was introduced mid-session and caught before release.**
  `tightAtxWouldWorsen` declines the tight ATX spelling whenever `HEADING_ATTRIBUTE` matches, and
  widening that constant made it delete `#Cal Tight Attr{#sec-x}` under `markdown_strict` /
  `markdown_mmd` — while 2039 unit tests, five corpora, the repo control and the injection control
  were all green. Found by grepping the widened constant's other call sites at backlog-drain time;
  fixed by gating that clause too, which **also recovered the three rows the second filed item
  predicted a reader table would recover**.
- **Verification.** 210 documents rendered through the real `quarto render` path plus a
  44,416-document re-score of every predecessor corpus (3,593 directories). Designed 63 → 110/119
  with all three pre-code predictions exact; adversarial 11 → 21/27; injection 4 → 9/10 with all
  five designed movers landing on quarto's answer; the 115-document repo control byte-identical
  across four views; 33 predecessor movers, every one rendered, 0/32 → 24/32. **Zero true
  regressions**, established mechanically rather than by eye. Four pre-existing pins reversed, all
  four fixes, all four proven by rendering their exact bytes. `npm test` 2040 passed;
  `test:integration` 524 passing / 0 failing (baseline 522), run twice because `src/` changed
  after the first; `test:oracle` byte-identical to S180–S215; `check-package` OK; `check-backlog`
  OK.
- **Closes two `BACKLOG.md` items**, each on the evidence that filed it: the `HEADING_ATTRIBUTE`
  leading-whitespace defect (S215) and the tight-hash attribute decline / `header_attributes`
  per-reader table (S212). Three new items filed. Learnings #360–#363.

### 2026-08-11 · [ad hoc] Session 215 — a trailing `#` run needs no space before it in the pandoc readers (SHIPPED)

- **Model:** Claude Opus 5.
- **What shipped.** `# Cal Learning C#` renders `<h1>Cal Learning C</h1>` and this model reported
  `Cal Learning C#`. `ATX_CLOSING`'s leading `(?:^|[ \t]+)` — and the docstring sentence claiming
  that a `#` which is part of a word is preserved — were both measured wrong. The ATX path now
  chooses its closing-sequence spelling per reader (`ATX_CLOSING_PANDOC` / `ATX_CLOSING`, via
  `atxClosingRun`); the setext path is untouched and still keeps its run verbatim, which is what
  quarto does there under both spellings.
- **⚠ The item's reader clause was wrong and the base table refuted it on the first render, for
  the second session running.** The entry says the strip happens "under EVERY reader", generalising
  from the two readers Session 212 measured. It is a clean 6–3 split: the pandoc `markdown*`
  family strips — `markdown_github` included, though pandoc documents it as a deprecated `gfm`
  synonym — and `gfm` / `commonmark` / `commonmark_x` do not, because CommonMark §4.2 requires the
  closing sequence to be *preceded by a space*. The `_spaced` control column is what makes this a
  split rather than a shrug: all nine readers strip when a space precedes the run.
- **⚠ The obvious regex deletes a character quarto keeps.** `# Cal Echo Esc\#` renders
  `Cal Echo Esc#` under both reader families — `\#` is an escaped hash, not a closing run — and a
  bare `#+[ \t]*$` yields `Cal Echo Esc\`. `ATX_CLOSING_PANDOC` carries `(?<!\\)` for that one
  rendered row.
- **⚠ "`ATX_CLOSING_UNSPACED` becomes dead code" was true of the constant and false of its clause.**
  Two of its three measured shapes became correct and are now accepted with quarto's exact text;
  the third would have turned *reports nothing* into *reports the wrong text*, so the decline was
  NARROWED to `ATX_CLOSING_ESCAPED` rather than deleted.
- **Measured.** 199 documents rendered through the real `quarto render` path (1.7.33), scored per
  document against the pre-session build, plus a 44,359-row re-score of every predecessor corpus
  across 3,592 directories. Designed 73 → 102/114 with every corpus landing exactly on its
  pre-code prediction; adversarial 11 → 20/28; injection 5 → 10/10. **Zero true regressions**,
  established by an explicit agreed-pre-but-not-post check rather than by eye. Of 57 moved
  predecessor rows, the 7 outside this session's own corpora are all Session 212's — including the
  two documents the backlog entry cited as its evidence, so the item is closed on the evidence that
  filed it.
- **Verification.** `npm test` 2023 passed / 66 files · `test:integration` 522 passing / 0 failing
  / exit 0 · `test:oracle` 131 / 124 agree (byte-identical to S180–S214) · `check-package` OK ·
  `check-backlog` OK. Guard-first, 3 RED→GREEN.
- **Filed, not bundled.** `HEADING_ATTRIBUTE` carries the identical leading-whitespace defect one
  constant over; and this model processes no markdown escapes anywhere.

### 2026-08-11 · [ad hoc] Session 214 — a SETEXT UNDERLINE swallows the ATX heading above it (SHIPPED)

- **Model:** Claude Opus 5.
- **What shipped.** `# Heading` directly above `===` renders as ONE heading in quarto — the
  underline claims the ATX line, the UNDERLINE's spelling sets the level, and the literal `#`
  survives into the text. This model matched the ATX row and reported the stripped name at the
  hashes' level. `setextUnderlineSwallowsAtx` declines the ATX match so the setext row claims the
  line; nothing downstream changed, because the setext text pipeline was already correct.
- **⚠ The item's reader clause was wrong and the base table refuted it on the first render.** The
  entry says "under EVERY reader including plain `markdown`". It is a clean 6–3 split: the whole
  pandoc `markdown*` family swallows — `markdown_github` included, though pandoc documents it as a
  deprecated `gfm` synonym — and `gfm` / `commonmark` / `commonmark_x` do not, because CommonMark
  §4.3 requires a setext underline to follow a PARAGRAPH and an ATX heading is not one.
- **⚠ This reverses a deliberate Session 182 decision that Session 199 named as a separate
  capability in advance**, and `closesParagraph` carries an arm built on top of that decline. The
  setext row's own reset replaces it — pinned on the exact document the arm was written for.
- **⚠ The adversarial pass found a DELETION and it is closed rather than disclosed.** Pressed
  against a `:::` opener the setext row never fires, so an ungated decline lost the section
  entirely. The gate now passes the body-run counter's next value, so the decline fires only when
  the setext row will accept the line — purely additive by construction.
- **Measured.** 207 documents rendered through the real `quarto render` path (1.7.33), scored per
  document against the pre-session build on identical bytes, plus a 44,013-document re-score of
  every predecessor corpus across 3,584 directories. Designed 60 → 108/110, INTRODUCED 0
  (cal 24→36, cal2 15→38, cal3 21→34); adversarial 7 → 18/22, INTRODUCED 0; all three per-corpus
  predictions in `scratchpad/s214/CALIBRATION.md`, written before any code, were exact.
  Predecessor re-score: 75 rows moved, **0/75 → 74/75, 0 regressions**. Repo control: 114 of 115
  tracked documents byte-identical across four views, the ONE mover landing on quarto's rendered
  truth, proven effective by injection (5 moved, 5 held, 10/10 agree with quarto). Three
  pre-existing red pins all FIXES, rendered rather than reasoned (1/5 → 5/5) — one of them
  Session 199's disclosed "one error this change INTRODUCES", now closed.
- **Verification.** `check-types` 0 · `check-types:unit` 0 · `compile` 0 · `compile-tests` 0 ·
  `npm test` 2007 passed / 66 files (baseline 1993) · `test:oracle` 131 / 124 agree / 4 lost TP /
  3 CARDINAL FP / 0 unrelated (BYTE-IDENTICAL to S180–S213) · `check-package` OK 42 files /
  5.55 MB · `check-backlog` OK · `test:integration` **521 passing / 0 failing / exit 0**
  (baseline 520), green first time. NOT RUN: `test:lsp` — no LSP surface touched.
- **⚠ Also corrected:** the integration suite's premise comment for
  `test/fixtures/closes-paragraph.qmd` listed quarto's headings and OMITTED this one; its
  assertion had the heading at the wrong level and the wrong text. Fixture bytes untouched.
- Commits `89e33b3` (1B claim) · `8ba237f` (C1) · `a38fc37` (C2) · `afc52fd` (C3) · this close-out.

### 2026-08-11 · [ad hoc] Session 213 — a mid-document YAML metadata block is CONSUMED by its reader (SHIPPED)

- **Model:** Claude Opus 5.
- Closed the SETEXT half of Session 204's `yaml_12` / Session 205's `yaml_13`, whose
  reader-selection half Session 211 shipped. A YAML metadata block below the document's first
  content line renders NOTHING under the readers that consume it; this model read its last content
  line plus the closing `---` as a setext heading, putting a section in the outline no reader ever
  sees and a phantom `sec-` id in the cross-reference index.
- **⚠ The backlog entry's prescribed enumerator was the wrong one, in the DELETING direction.** It
  named `midDocumentMetadataBlocks` — quarto's YAML *regions*, read for metadata. The consumption
  is *pandoc's* `yaml_metadata_block`, which requires the opening `---` to start a block; where it
  does not, pandoc claims it as a setext underline instead. `cal3/h3_above_md` renders both
  headings and consumes nothing. Ten `cal4` rows bound the precondition (Learning #351).
- **⚠ The house per-reader predicate shape would have shipped three deletions.**
  `+yaml_metadata_block` turns consumption on for four markdown-family bases and is inert on the
  three CommonMark ones, so the base gates the extension rather than the reverse (Learning #352).
- Three `-yaml_metadata_block` spellings are DECLINED and carry a disclosed phantom: with the
  extension off, `markdown` reaches "no heading" via a MULTILINE TABLE, a mechanism `cal2/c3_ext`
  proves switches off (Learning #353).
- **Measurement:** 118 documents rendered through the real `quarto render` path (quarto 1.7.33),
  scored per document against the pre-session build. Designed corpora 66/100 → 87/100 (FIXED 21),
  adversarial 3/18 → 17/18, **INTRODUCED 0 in every corpus**. Predecessor re-score over 43,579
  documents in 3,574 directories: 52 rows moved, **0/51 → 51/51**, INTRODUCED 0 — including five
  `s187/adv/L04` documents where the pre-session build was DELETING a heading and now is not.
- **Verification:** `check-types` 0 · `check-types:unit` 0 · `compile` 0 · `compile-tests` 0 ·
  `npm test` 1993 passed / 66 files · `test:oracle` 131 / 124 agree / 4 lost TP / 3 CARDINAL FP
  (byte-identical to S180–S212) · `test:integration` **520 passing / 0 failing / exit 0** ·
  `check-package` OK 42 files / 5.55 MB · `check-backlog` OK. Repo control over all 115 tracked
  markdown-family documents BYTE-IDENTICAL across four views, proven effective by injection.
- Commits: `d19cc04` (rule + four predecessor pin reversals), `7b68173` (six pins),
  `fe5adca` (integration test), plus the `d01f518` claim and this close-out.

### 2026-08-11 · [ad hoc] Session 212 — a reader with `space_in_atx_header` OFF accepts `#Heading` (SHIPPED)

- **Model:** Claude Opus 5.
- `#Heading` with no space after the hashes is a real heading under a reader that drops
  pandoc's `space_in_atx_header`, and `ATX_HEADING` requires the space — so the heading was
  **deleted**. Three witnesses from Session 205's blind `dial` lens (`dial_06`, `dial_07`,
  `dial_08`) plus Session 202's `free_05`; all four now agree, 0/4 → 4/4.
- **⚠ The item named THREE readers and the render says FOUR — and a fourth `markdown_*`
  reader answers the opposite way.** `markdown_phpextra` accepts the tight hash and no
  session had measured it; `markdown_github`, spelled like the three that accept, REFUSES.
  Both confirmed on a second shape. Session 209's "a classifier may not reason from the
  name" trap in a new place.
- `fromRequiresSpaceInAtxHeader` reuses `fromHasConstruct`, whose fail-safe (`true` — keep
  requiring the space) is already today's behaviour, so only a positive resolution to a
  measured base can widen anything. The extension outranks the base in both directions and
  the LAST occurrence wins, measured in both orders.
- **⚠ `ATX_HEADING_TIGHT` carries `(?!#)`.** With the separator merely optional,
  `#######x` matches six of seven hashes and INVENTS `h6:#x` where quarto renders nothing —
  the trap the cheap fix walks into, measured on all four accepting spellings.
- **⚠ Three shapes DECLINE so the change stays purely additive**, each a separate
  pre-existing defect proven by its SPACED twin: a setext underline below (which outranks
  the ATX heading and keeps the literal `#`), a trailing attribute block (kept by two of the
  four accepting readers), and a trailing hash run `ATX_CLOSING` will not strip (wrong for
  every reader, including plain `markdown`). All three filed.
- **⚠ One regression caused and closed in-session**, found by the adversarial pass and by no
  designed document: inside a CLOSED raw HTML block the content is literal, so the tight
  hash there is a phantom. Bounded by 8 documents — a blank line does NOT end such a block,
  and an UNCLOSED opener never becomes literal at all.
- **Measured:** 118 documents rendered through the real `quarto render` path (1.7.33) —
  designed 47/84 → 66/84, adversarial 3/18 → 17/18, controls 6/12 → 11/12, **INTRODUCED 0
  in every corpus**. Predecessor re-score over **43,401** documents in 3,562 directories
  moved 4 rows, all four the filed item's own witnesses. Repo control over all 115 tracked
  markdown-family documents **byte-identical** across 4 views, proven effective by injection
  in the same run (5 movers moved, 5 stayers held).
- **Verification:** `check-types` 0 · `compile` 0 · `compile-tests` 0 · `npm test` 1981
  passed / 66 files · `test:oracle` 131 / 124 agree / 4 lost TP / 3 CARDINAL FP / 0
  unrelated (byte-identical to S180–S211) · `check-package` OK 42 files / 5.55 MB ·
  `check-backlog` OK · `test:integration` **519 passing / 0 failing / exit 0** (baseline
  518, +1). NOT RUN: `test:lsp` — no LSP surface touched.

### 2026-08-11 · [ad hoc] Session 211 — a mid-document YAML block's `from:` selects the reader (SHIPPED)

- **Model:** Claude Opus 5.
- A `---` / `from: gfm` / `---` block below the front matter really does select the reader.
  Quarto reads EVERY YAML region in a document for metadata and then hands pandoc the whole
  file, so such a block selects the reader AND — when the resolved reader is gfm — renders as a
  setext heading. This model resolved only the document's opening block, so the heading below a
  mid-document block was **deleted**. Four witnesses across four sessions (S205 `yaml_13`; S207
  `path_04`/`bnd_13`/`bnd_15`; S210 `a13_second_block`).
- **⚠ The rule the backlog item stated is wrong in the deleting direction.** Both the item and
  Session 210's handoff say quarto "merges the blocks and the LATER one wins" — generalised from
  one witness where the cheap and honest readings agree. `cal2/q1_gfm_then_nofrom` is the
  document where they disagree (a later block carrying **no** `from:`), and quarto renders the
  pressed heading, so "last block wins" would delete it. The measured rule is **the last block
  whose `from:` SELECTS**. Found before any code was written (Learning #345).
- **The scanner this needed was already in the repo.** `src/core/qmd/quarto-yaml-regions.ts` is a
  verbatim port of quarto's `breakQuartoMd`, mentioned by neither the handoff nor the item;
  found by grepping for the `---` regex rather than a function name (Learning #346). Reuse was
  not adoption — the port and quarto were measured to disagree on termination in **both**
  directions, so `YamlRegion` gained `terminated` (additive) and the walk adds the `...` rule.
- Made purely **additive** by filtering on the document's first content line, so a block that
  opens the document keeps exactly its previous classification.
- Three regressions caused and all three closed in-session — an empty `from:`, a fence inside a
  block, and a block inside an HTML comment; the last found only by the adversarial pass.
- **Measured:** 86 documents rendered through quarto 1.7.33 plus a 43,176-document re-score of
  every predecessor corpus. Designed 32/70 → 51/70 (FIXED 19, INTRODUCED 0); adversarial 6/18 →
  12/18; all 13 predecessor documents that moved are fixes (0/13 → 10/13, INTRODUCED 0). Repo
  control over 115 tracked documents byte-identical across four views, proven effective by
  injection. `npm test` 1966 passed; `test:integration` 518 passing; oracle byte-identical to
  S180–S210. ⚠ The first integration run was lost to a `test(`/`it(` error (Learning #347).
- **Scope:** the reader-selection half only. The setext half (S204's `yaml_12`) remains filed.

### 2026-08-11 · [ad hoc] Session 210 — a blank line before the opening `---` no longer hides front matter (SHIPPED)

- **Model:** Claude Opus 5.
- Quarto renders `\n---\ntitle: t\nfrom: gfm\n---\n` exactly as it renders the same bytes without
  the leading blank. This model required the opener at line 0, so the block was invisible — which
  both **FABRICATED** a heading (the closing `---` underlines the last YAML line into a setext
  `h2`) and **DELETED** the real heading below (the reader was never resolved, so the paragraph
  bail re-engaged). The residual half of Session 203's six-spellings item; Session 206 shipped the
  other five and scoped this one out deliberately.
- **⚠ Quarto has TWO mechanisms here, not one, and they disagree.** Its own front-matter reader
  handles line 0 — where an unterminated block or a `...` terminator makes it **refuse the
  document outright (exit 1)**. Pandoc's `yaml_metadata_block` handles what follows a blank —
  where `...` DOES terminate and an unterminated block is ordinary body. Measured, not assumed.
- **⚠ The leading run may be any length and any whitespace**, including FOUR spaces, a TAB, a form
  feed, a vertical tab and a NO-BREAK SPACE (bytes verified, not trusted from probe names). The
  ` {0,3}` cap that governs nearly every other block rule in `qmd/model.ts` does **not** apply —
  the instinctive fix would have left four of those spellings broken.
- **⚠ The cheap fix is wrong in three places and each one DELETES.** Skipping leading blanks and
  testing `FRONTMATTER_OPEN` regresses `c2_hrgap` and `c3_leadws`, and — worst — opens an
  unterminated block that runs to end of document, deleting **every heading in it**. The shipped
  predicate adds a blank-below-opener clause and a terminator clause, both scoped to `i > 0` so
  the change is **purely ADDITIVE**: a document whose line 0 is `---` is classified
  byte-identically to before.
- `frontMatterOpenIndex` is now the single opener predicate, replacing two sites that had drifted
  apart (the scanner's `i === 0` and `frontMatterContent`'s own `lines[0]` test) — Learning #14
  restored where it had quietly lapsed.
- **⚠ A THIRD surface disagrees and is deliberately left alone.** Quarto **validates** front matter
  only at byte 0 even though it renders it after a blank (Session 171: 10 of 17 keys exit 0 in
  that shape). S171's own FP-guard pin went red first, exactly as its author predicted;
  `collectValueSources` now gates both front-matter enumerators on byte 0.
- **Measurement.** 51 documents rendered as a CALIBRATION **before any code**
  (`scratchpad/s210/CALIBRATION.md`), then 68 rendered in total. Designed corpora **17/47 → 40/47,
  FIXED 23, INTRODUCED 0**. Adversarial pass 5/12 → 11/12. Predecessor re-score: **42,753
  documents across 3,537 corpora**, keyed by directory; 18 rows moved, 8 unique documents, all
  rendered and adjudicated **0/8 → 8/8, INTRODUCED 0** — two that looked like heading deletions
  are fixes, and three are this item's own filed witnesses (S203/S205/S206). Repo control: all
  **115** tracked markdown-family documents BYTE-IDENTICAL across four views, proven EFFECTIVE BY
  INJECTION in the same run (5 designed movers moved, 5 stayers held).
- **Completeness pass** over all **15** consumers (Learning #331 — this is a widening): each agrees
  with its byte-0 twin, differs by exactly the +1 line offset (verified mechanically), or differs
  by the byte-0 design above. **Three probes were DEAD on first design** and were rebuilt before
  being read as coverage (Learning #339).
- **DISCLOSED, filed not fixed:** a blank after a **line-0** opener is still read as front matter
  (6 rendered rows) — left because `inFrontMatter` gates YAML completion and `---`/*(blank)* is
  what a user has on screen mid-typing. And a **second YAML block overrides the first**, found by
  the adversarial pass; proven pre-existing by its byte-0 control and filed onto the mid-document
  `from:` item.
- Verification: `check-types` 0 · `compile` 0 · `compile-tests` 0 · `npm test` **1942 passed / 66
  files** (baseline 1922) · `test:oracle` **131 / 124 agree / 4 lost TP / 3 CARDINAL FP / 0
  unrelated** (BYTE-IDENTICAL to S180–S209) · `test:integration` **517 passing / 0 failing / exit
  0** (baseline 516) · `check-package` OK 42 files / 5.54 MB · `check-backlog` OK 140 open.
  NOT RUN: `test:lsp` (no LSP surface touched); **no BLIND sweep** — fan-out unavailable under a
  session-level instruction, the THIRD session running (Learning #338).
- Commits `c43e87f` (claim) · `4a8f7ba` (the fix) · `92c5567` (pins) · `8c848f5` (adversarial
  pins) · `7901f32` (integration test) · this close-out.

### 2026-08-10 · [ad hoc] Session 209 — Phase 0 health snapshot recorded

`methodology_dashboard.py` appended its Phase 0 run to `dashboard_history.jsonl` (health 76/100,
1 high risk, 6 vulnerabilities — all devDependency-only). Logged as its own action so the ledger
frontier stays at `HEAD` rather than leaving the file dirty for the next session's Orient.

### 2026-08-10 · [ad hoc] Session 209 — the container column stack knows which containers each READER has (SHIPPED)

**Model:** Claude Opus 5.

`contentColumns` pushed a content column of `indent + 4` for a footnote definition (`[^1]: x`)
and for a definition-list body (`:   x` / `~   x`) under **every** reader. The readers measurably
differ per construct, so the stack was opening containers that the declared reader does not have —
and because a container's column is what separates its content from INDENTED CODE, the resulting
column was wrong in both directions at once. Ranked #1 by every session from S202 through S208 and
never picked; operator-selected at Phase 0 from an empty Active section.

`CONTENT_COLUMN_4_OPEN` is split into `FOOTNOTE_DEFINITION_OPEN` and `DEFINITION_LIST_BODY_OPEN`,
and each is gated on its own predicate (`fromHasFootnotes`, `fromHasDefinitionLists`) over eight
measured reader bases. Keyed on a POSITIVE resolution: an unresolvable `from:`, an unmeasured base
and no key at all all keep the old unconditional push, which is the phantom direction.

⚠ **The extension list OUTRANKS the base, in both directions and on both constructs, and a
predicate keyed on the base name alone would DELETE real headings** — `gfm+definition_lists`
renders a definition list and `markdown-definition_lists` does not. The two extensions are
independent (`markdown-footnotes` has definition lists and no footnotes), and LAST occurrence wins,
measured in both orders. The base table has the same trap: `markdown_github` and `markdown_strict`
are both `markdown_*` and the first has footnotes with no definition lists while the second has
neither, so no grouping coarser than the exact name is safe.

**Measurement — 246 documents rendered fresh through the real `quarto render` path (quarto
1.7.33), plus a 37,810-document re-score of every predecessor corpus. INTRODUCED 0 in every
designed corpus.** Calibration grid 34/72 → 58/72 (FIXED 24); the round-2 grid 36/52 → 45/52; the
budgeted completeness pass over all seven consumers of the stack 29/42 → 41/42; the adversarial
pass 13/28 → 27/28. Of the 26 predecessor documents that moved, 22 are clean fixes, three are
recoveries carrying the already-filed interior-whitespace text gap, and one is a new phantom that
belongs to an already-filed row — each classified by a feature-free control, not by argument. No
heading is lost anywhere.

⚠ **The completeness pass earned its keep and took THREE probe designs to do it.** The fence
column set is invisible to a heading scan when the fence is closed and invisible to the cell view
because `indentedCellFenceAt` bypasses the column set; the first two probes returned identical
answers for test and control, which reads as clean coverage and is none. The third found the only
row in the session that moves in the heading-RECOVERING direction — two real headings.

Discharges the 6 phantoms Session 202 disclosed and named the fix for; that pin is re-asserted in
the opposite direction rather than deleted. Also corrects two inherited test comments, one of which
had been inaccurate about its own `_md` control since Session 203.

Backlog: the merged item is drained and **split into three** measured entries (a required TERM
line, an unreferenced footnote definition, and a container pop inside another container), per
Learning #340; the lone-indented-line item is strengthened with new evidence. 138 → 140 open.

Verification: `check-types` 0 · `compile` 0 · `compile-tests` 0 · `npm test` **1922 passed**
(baseline 1909) · `test:oracle` 131 / 124 agree / 4 lost TP / 3 CARDINAL FP / 0 unrelated
(byte-identical to S180–S208) · `test:integration` **516 passing / 0 failing / exit 0** (baseline
515) · `check-package` OK 42 files / 5.54 MB · `check-backlog` OK. Repo control over all 115 tracked
markdown-family documents byte-identical across all four views, proven effective by injection in
the same run (5 designed movers moved, 5 stayers held). NOT RUN: `test:lsp` — no LSP surface
touched. ⚠ NOT RUN and it matters: no BLIND sweep — subagent fan-out unavailable under a
session-level instruction (Learning #338), so the residual list is the author's own.

Learnings #339–#341.

### 2026-08-10 · [ad hoc] Session 208 — a per-format `from:` written in FLOW style selects the reader (SHIPPED)

Session 207 shipped the BLOCK spelling of the `format:` → `html:` → `from:` path and left the
FLOW spelling as its own disclosed residual, filed on one blind document. That document was
heading-DELETING (two real headings lost, one invented), and the item is now closed for every
flow spelling measured.

⚠ **THE OBVIOUS IMPLEMENTATION IS RIGHT ON THE WITNESS DOCUMENT BY LUCK, AND WRONG ON HALF THE
GRID.** Reusing the existing flat `FLOW_FROM_ENTRY` pattern — which takes the first `from:` after
a `{` or `,` — gives the right answer on `format: {html: {from: commonmark}, docx: {from: markdown}}`
only because html is written first. Writing both format ORDERS against both reader DIRECTIONS
shows it reads two of four rows backwards, and three rendered refusals
(`format: {html: {execute: {from: gfm}}}`, `format: {docx: {html: {from: gfm}}}`,
`website: {html: {from: gfm}}`, each identical to its no-`from:` twin) show the rule is the EXACT
path and nothing weaker. So the fix is a path walk: `flowEntries` / `flowValue` / `flowPathValue`
over a flow REGION joined across lines, because a flow mapping may span them and quarto honours
one that does.

The same walk replaced Session 206's whole-flow front-matter arm, whose two flat patterns
(`FRONTMATTER_FLOW_FROM_KEY`, `FLOW_FROM_ENTRY`) were wrong in BOTH directions on six of eight
rows — `{title: t, params: {from: markdown}, from: gfm}` renders as gfm (they read markdown, a
DELETED heading) and `{title: t, params: {from: gfm}}` renders as the default (they read gfm, an
INVENTED one). Both are deleted, with a tombstone keeping the measurement they carried.

⚠ **ONE REGRESSION CAUSED AND CLOSED IN-SESSION, found by an adversarial pass written against
this session's own change.** Resolving the PATH but not a YAML ALIAS left the value unreadable,
and an unreadable value relaxes the heading column set by design — so a document anchoring
`markdown` gained a heading quarto does not render. The pre-session build was accidentally right
there, and every `gfm` row of the 153-document designed corpus scored it clean.

⚠ **TWO NEW QUARTO FURNISHINGS**, the twelfth and thirteenth, each settled by a feature-free
control pair rather than by argument: `h2:Other Formats` (a document offering more than one
format) and `h2:Footnotes`. The first made 24 CORRECT documents score as disagreements; the
second cost Session 207's realistic corpus 12 of 16 rows on re-measurement. Thirteen for
thirteen, every furnishing has pointed in the direction that makes a heading-deleting change
look safe.

**Measurement.** 337 documents rendered through the real `quarto render` path (quarto 1.7.33),
each scored per document against the pre-session build on identical bytes. Designed
(`cal`/`cal2`/`cal3`, 153 scorable) **81 → 153**, INTRODUCED 0, FIXED 72. The budgeted
completeness pass, one probe per CONSUMER SITE in the NEW spellings (27) **12 → 27**, INTRODUCED
0. The adversarial pass (10 scorable of 16; six shapes quarto refuses outright) **1 → 10**.
Fourteen predecessor corpora re-scored SEPARATELY (Learning #332): **INTRODUCED 0 everywhere**,
and the item's own witness corpus `s207/adv/fmt` **15/16 → 16/16**. Repo control: all four views
over all **115** tracked markdown-family documents BYTE-IDENTICAL, proven effective by injection
in the same run (5 designed movers moved, 5 stayers held, every prediction right first time).

⚠ **NO BLIND SWEEP THIS SESSION** — subagent fan-out was unavailable under a session-level
instruction, and the adversarial pass is not a substitute for an independent witness. Recorded
as a gap rather than papered over.

**Backlog:** the item is REWRITTEN to its remaining half (b) — a non-active format's `from:` is
still refused, a measured fail-safe whose bound (`--to html` in every harness) is undischarged
and is an adapter-layer question. Nothing drained; 138 open items unchanged.

### 2026-08-10 · [ad hoc] Session 207 — a front-matter `from:` selects the reader by its YAML PATH (SHIPPED)

Both ends of one question were wrong, and one mechanism answers both: *where in the YAML does
this `from:` sit, and does that position select the reader?* The KEY predicate matched at ANY
indent, so a block scalar's ordinary prose selected a reader; the VALUE resolver read the TOP
level only, so a per-format `format:`/`html:`/`from:` — which quarto really does honour — had its
value thrown away. `FRONTMATTER_FROM_KEY` is gone, replaced by `frontMatterSelectsReader`, and
Session 206's value loop is now `mappingFromValueLine(block, indent, topLevelForms)`, run over the
per-format mapping and then over the top level.

⚠ **THE NESTED DECLARATION OUTRANKS THE TOP-LEVEL ONE.** Measured in both directions AND in both
file orders — four documents. `cal` `c_fmhg_topm` / `c_fmhm_topg` put the nested key first;
`cal2` `q_topm_fmhg` / `q_topg_fmhm` put the top-level key first and render the same way, which is
what separates "the nested one wins" from "the first one wins". `cal` alone cannot tell those
apart. Three of the six precedence assertions were **heading-DELETING** before this session:
quarto renders under the nested reader and this model suppressed under the top-level one.

⚠ **THE NARROWING'S POLARITY IS THE INVERSE OF THE THREE SESSIONS THAT WIDENED THIS KEY**, and
that shaped the whole design. Firing wrongly costs a phantom; failing to fire where quarto DID
select re-engages the paragraph bail *and* collapses the heading column set to `[0]`, and both
delete a real heading. So the guard block was written before the narrowing, and only positions
measured NOT to select are refused: `params:`, `website:`, `execute:`, a block scalar's interior.

⚠ **Only `html:` is resolved, and that refusal is a measured fail-safe with a precisely bounded
gap.** A per-format `from:` belongs to the format being RENDERED (`q_pdfg`, `q_htmlm_pdfg`,
`q_htmlg_pdfm`), and the corpus renders `--to html`, so it cannot speak for a pdf-only document
previewed as pdf. Refusing keeps a phantom where resolving could delete. Filed as the residual.

**Measurement.** 386 documents rendered fresh through the real `quarto render` path (quarto
1.7.33), each scored PER DOCUMENT against the pre-session build on identical bytes.
**INTRODUCED 0 across all 368 scored documents.**

| corpus | scored | pre → post | adjudication |
|---|---|---|---|
| designed (`cal` `cal2` `ctl` `comp` `pins`) | 118 | 63 → **114** | INTRODUCED 0 · FIXED 51 · CARRIED 4 |
| blind (`path` `fmt` `real` `bnd`, 4 lenses) | 63 | 32 → **57** | INTRODUCED 0 · FIXED 25 · CARRIED 6 |
| predecessors' own named corpora, re-measured | 187 | 152 → **169** | INTRODUCED 0 · FIXED 17 · CARRIED 18 |

`comp` is the budgeted completeness pass — one probe per CONSUMER SITE, all five enumerated in
the 1B claim before any result was seen, each written in the NEW spellings. It scored 25/25.
Session 206's own `cmk` and `gnd` reach 32/32, and every blind lens returned INTRODUCED 0.

**Instrument proven effective in the same run.** The repo control — all 115 tracked
markdown-family documents, all four views (headings, cells, outline, refs) — is byte-identical
across the two builds, and the injection control fired exactly as designed: 5 designed movers
moved, 5 designed stayers and all 115 real documents held.

⚠ **Two harness defects found and closed, both of which produced numbers that looked like
catastrophic regressions.** (1) Merging per-corpus probe files into one dict silently overwrote
colliding document basenames — `yaml_01` and `real_01` exist in several sessions' blind corpora,
38 of 198 staged documents collided, and two whole corpora scored `0/16`. `score207.py` now
REFUSES a duplicate name rather than relying on remembering to score per corpus. (2) A
`bibliography:` key grows a trailing `h2:References`; the realistic blind corpus scored 8/16 until
it was normalised, and it is now proven by the feature-free control pair `ctl2` `y_bib`/`y_nobib`.
That is the SEVENTH distinct piece of quarto furniture found across S205–S207, and like all six before it
pointed in the direction that makes a heading-deleting change look safe.

**Verification.** `check-types` 0 · `compile` 0 · `compile-tests` 0 · `npm test` **1,895 passed /
66 files** (baseline 1,883) · `test:integration` **514 passing / 0 failing / exit 0** (baseline
513, green first time, on the operator's go-ahead sought in advance) · `test:oracle` **131 / 124
agree / 4 lost TP / 3 CARDINAL FP / 0 unrelated** (byte-identical to S180–S206) · `check-package`
OK 42 files / 5.54 MB · `check-backlog` OK 138 open items. NOT RUN: `test:lsp` — no LSP surface
touched.

Commits: `02c036a` (1B claim) · `a2feb37` (the path-aware key) · `9b51a83` (the per-format value
and its precedence) · `19430ff` (the outline surface) · close-out.

### 2026-08-10 · [ad hoc] Session 206 — a front-matter `from:` is resolved as YAML, not as one line shape (SHIPPED)

A YAML value has many spellings and a line regex has one. `FRONTMATTER_FROM_KEY` could never
match a line beginning with a quote, and `FRONTMATTER_COMMONMARK_FROM` demanded the value sit on
the key's own line at column 0 — so a quoted `"from": gfm`, a flow mapping, a next-line scalar, a
block scalar, a uniformly indented mapping and an anchor/alias pair were each invisible. Two
filed items (Session 205's ranked #2 and #3), one capability, one resolver.

**The design, and why it is shaped this way.** `frontMatterFromValueLine` resolves the front
matter's TOP-LEVEL `from:` once, from the whole block, and rewrites it as the canonical line
`from: <value>` for Sessions 202's and 205's MEASURED allowlists to classify unchanged. For a
plain top-level key the line handed over is byte-identical to the source line, so those
allowlists cannot move by construction. The KEY question fails OPEN (not firing suppresses a
heading quarto renders) and stays a set of cheap line regexes at ANY indent; every VALUE question
fails CLOSED (firing wrongly DELETES) and returns `null` — today's behaviour — whenever it cannot
resolve with confidence. "Top level" is the SHALLOWEST content line, not column 0, which is what
makes a uniformly indented mapping reachable while leaving an `abstract: |` block scalar's prose
unreachable: YAML requires that content to be indented past its own key.

**⚠ The session shipped a regression and closed it, and the budgeted completeness pass is what
caught it.** Widening the KEY fed `dialectOverride`'s OTHER consumer — the ATX heading COLUMN set
— for two spellings that had never reached it. The 64-document ground corpus scored INTRODUCED 0
because every one of its documents reads that flag through the paragraph bail; the completeness
pass, one probe per CONSUMER written with the NEW spellings, returned INTRODUCED 2 at once.
Measured over 56 further documents: the 0-3 column window belongs to the COMMONMARK FAMILY, not
to the presence of a `from:` key. The narrowing is keyed on a POSITIVE resolution to a measured
markdown base, never on the absence of a CommonMark one — a nested per-format `from: gfm` really
is honoured by quarto, so narrowing on absence would have deleted headings (Learning #327).

**Measurement.** **287 documents** rendered fresh through the real `quarto render` path (quarto
1.7.33) — 193 designed, 30 re-measured from predecessors, 64 blind; 10 excluded for quarto exit
1 — each scored PER DOCUMENT against the pre-session build on identical bytes. The four scored
corpora: gnd 20/32 → 30/32 (the paragraph bail), cmk 21/32 → 31/32 (the setext COLUMN row, where
a wrong resolution DELETES), comp 28/33 → 33/33 (one probe per consumer), pins 9/23 → 22/23 (the
exact asserted bytes, on their own bytes). **INTRODUCED 0, FIXED 48** after the regression close.
The other 72 designed documents are the two column grids (56) that decided the regression fix and
16 controls in five feature-free sets. The predecessors' OWN named
corpora improve too and introduce nothing: Session 203's `yaml` 5/12 → 10/12 and Session 205's
`yaml` 9/16 → 12/16. The BLIND sweep — 4 independent lenses, 64 documents, none of which saw the
designed corpora — returned INTRODUCED 0 and FIXED 0, and delivered three new filings plus five
independent witnesses to one pre-existing item (Learning #330).

**⚠ Three EXTRACTOR artifacts, all settled by feature-free control pairs rather than by argument**
(Learning #328): `number-sections: true` wraps the section number in a `<span>`, so every heading
in such a document vanished from the nesting-safe scan (fixed in `render206.sh`); `markdown_strict`
turns `intraword_underscores` OFF, so this project's own `snake_case` document NAMES became `<em>`
and the corpus was invisible to its own extractor for exactly the readers it was testing; and
quarto's `toc:`, `citation:`, `license:` and `copyright:` keys each grow a generated heading, now
normalised on both the scoring and adjudication paths.

- TDD: 8 RED→GREEN, each RED confirmed to fail on the BEHAVIOUR. The 4-case GUARD block was
  written BEFORE the value resolver it guards (S204's gotcha 5, inherited a third time) and pins
  the block-scalar hazard on the DELETING row, where the failure hurts.
- Verification: `check-types` 0 · `compile` 0 · `compile-tests` 0 · `npm test` 1883 passed / 66
  files (baseline 1864, +19) · `test:oracle` 131 / 124 agree / 4 lost TP / 3 CARDINAL FP / 0
  unrelated (BYTE-IDENTICAL to S180–S205) · `check-package` OK 42 files / 5.53 MB ·
  `check-backlog` OK, 138 open items · `test:integration` **513 passing / 0 failing / exit 0**
  (baseline 512, +1). Repo control: all four views over all 115 tracked markdown-family documents
  BYTE-IDENTICAL, proven EFFECTIVE BY INJECTION in the same run (4 designed movers moved, 6
  stayers stayed). NOT RUN: `test:lsp` — no LSP surface touched.
- Backlog: the quoted-key item is DRAINED; the six-spellings item is REWRITTEN to its residual (a
  blank line before the opening `---` is front-matter BLOCK detection, not the reader question),
  and four items are newly filed.
- Model: Claude Opus 5.

### 2026-08-10 · [ad hoc] Session 205 — `blank_before_header` belongs to the READER, not to the presence of a `from:` key (SHIPPED)

Pandoc's `blank_before_header` makes an ATX heading pressed against an open paragraph not a
heading. This model implements it — and `dialectOverride` switched it off for the whole document
the moment ANY `from:` key appeared, so `from: markdown` lost a rule that no front matter at all
already got. Session 180 took that trade knowingly and wrote its cost into `FRONTMATTER_FROM_KEY`'s
own docstring; this session paid it down.

**⚠ The filed item said the rule was UNMODELLED, and the tell that it wasn't sat in the item's own
cited evidence, in a column the item never compared.** Session 204's ground grid carries a `nofrom`
twin of every `from: markdown` row. Quarto renders the twins identically; this model did not — all
7 phantom `md` rows had an agreeing `nofrom` twin. Diagnosing from the symptom would have produced
a second HTML-block rule; the defect was one boolean, in the `from:` scan.

- `fromKeepsBlankBeforeHeader` resolves the `from:` VALUE for the ATX paragraph bail alone — a
  THIRD flag beside `dialectOverride` and `commonmarkDialect`, never a refinement of either.
  `dialectOverride`'s other consumer (the heading COLUMN set) asks a different question, keeps its
  presence-keying and its own permitted phantom, and its rows are measured unmoved.
- **The extension outranks the base in BOTH directions, and both are measured.**
  `markdown+emoji-blank_before_header` renders the pressed heading; `markdown_strict+blank_before_header`
  suppresses it on a base that renders it unadorned. So the rule is: base exactly `markdown`, or any
  measured `markdown_*` base carrying `+blank_before_header`, minus anything carrying
  `-blank_before_header`.
- **`markdown_strict` is the trap.** It, `markdown_mmd`, `markdown_phpextra` and `markdown_github`
  each RENDER the pressed heading, so a prefix match on `markdown` — the obvious way to widen for
  `markdown+emoji` — deletes four readers' worth of real headings.
- Anchored at column 0. Measured, not inherited: with a real `from: gfm` at column 0 and an
  `abstract: |` block scalar whose prose begins `from: markdown`, firing on the scalar deletes the
  heading quarto renders (`spl` `s_collide`).
- **A regression this session CAUSED, and closed under its own declared decision rule:** restoring
  the bail exposed that `?>` was matched by nothing. `HTML_BLOCK_OR_INLINE_OPEN` carried a row
  commented "closer `</?…`", which is not how a processing instruction closes. It was invisible
  while the bail was off — the right answer came out for the wrong reason. Found only by
  re-measuring the filed item's own named documents against the new build. `]]>` is the control
  that keeps the row from being widened: CDATA does not end at its closer.

**Measurement.** 262 documents rendered fresh through the real `quarto render` path (quarto 1.7.33),
198 designed + 64 blind, 15 excluded for quarto exit 1; each scored per document against the
pre-session build on identical bytes. Designed agreement 99/153 → 147/153 and the pins 10/26 → 26/26;
blind agreement 29/64 → 45/64. **INTRODUCED 0 · FIXED 64 · REACHABLE 0** across all corpora, and
Session 204's own corpora re-scored on the new build improve too — its `end` 67/72 → 72/72 and its
`gnd` 155/180 → 162/180, both INTRODUCED 0. Repo control byte-identical across all four views over
all 115 tracked markdown documents, proven effective by injection in the same run (4 movers moved,
5 stayers stayed). `test:oracle` byte-identical to S180–S204 at 124/131.

**Two harness artifacts found and disclosed, each proven by a feature-free control rather than by
argument:** quarto's alternate-formats sidebar prepends `h2:Other Formats` to any document naming a
non-HTML `format:`, and a footnote definition appends a generated `h2:Footnotes`. Both were scoring
as headings this model had lost; the second was masking a genuine two-heading recovery.

Filed: 6 new items (a quoted `from:` KEY, a mid-document YAML `from:`, `-space_in_atx_header`
readers, callout-title consumption, non-markdown readers, and the heading COLUMN set left
deliberately unmoved). Session 204's default-reader item is rewritten down to its residual half
(a closed `<pre>`'s literal interior), not drained — that half is still open.

### 2026-08-10 · [ad hoc] Session 204 — a CommonMark raw HTML BLOCK swallows the headings inside it (SHIPPED)

Under a CommonMark-family reader (`gfm`, `commonmark`, `commonmark_x`) a raw HTML block covers
every line until its end condition, and quarto renders no heading — ATX or setext — inside one.
This model had no notion of being inside such a block, so it reported them: `<div>` /
`# Ctl Html Heading` under `from: gfm` rendered nothing and we reported a heading.

The state shipped is a REGION whose type names its END CONDITION, which is what the filed item's
one-line framing could not express. CommonMark type 6 (a known block-tag name) and type 7 (any
complete tag alone on a line, and only where no paragraph is open) end at a blank line; type 1 —
`<pre>`, `<script>`, `<style>`, `<textarea>` — ends at its OWN closing tag, ignores blank lines
entirely, and when unclosed runs to end of document. Types 2 to 5 already behaved correctly and
are deliberately untouched.

Three obvious-looking answers were refuted by rendering before any of them shipped:

- **"Swallow to the next blank line"** fails in BOTH directions. An unclosed `<pre>` swallows
  past blanks to end of document, and a heading directly below `</pre>` — with no blank line
  anywhere — is real.
- **Reusing `PANDOC_BLOCK_OPEN_TAGS`**, already in this file and answering the same question,
  would DELETE 24 real headings: pandoc's list carries DocBook names CommonMark lacks. The two
  lists are indistinguishable with no paragraph open, because type 7 accepts any complete tag —
  only an OPEN PARAGRAPH separates them.
- **Widening the dialect allowlist** to `markdown_strict` / `_github` / `_mmd` / `_phpextra`,
  which a blind lens and a 20-document control both suggested, would have deleted 22 real
  headings per reader and silently moved Sessions 202 and 203's rows, which read the same flag.
  A 144-document grid showed those four agree with `gfm` on only 14 of 36 cells.

Measured over 766 documents rendered through the real `quarto render` path (quarto 1.7.33), 686
designed plus 80 from four blind lenses, each scored per document against the pre-session build
on identical bytes: designed agreement 236 → 310, blind 35 → 57, per-error adjudication
INTRODUCED **0** / FIXED 96 / REACHABLE 1 / CARRIED 71. All 113 tracked markdown-family documents
in the repo are byte-identical across all four views, proven effective by injection in the same
run. `npm test` 1835 (+7), `test:integration` 511 (+1), `test:oracle` unchanged since Session 180.

Seven findings filed, none of them fixed here: the container-column blindness of the new indent
test, the default reader's own HTML-block rule, two comment-region defects, the refuted dialect
widening, a `<!DOCTYPE html>` residual of Session 203's interrupt list, and a block-quote
deletion. Learnings #319–#322.

### 2026-08-10 · [ad hoc] Session 203 — a setext TITLE is the WHOLE OPEN PARAGRAPH under a CommonMark reader (SHIPPED)

`consecutiveBody === 1` gated the setext underline unconditionally, so a title could be exactly
one line under every reader. Quarto's default reader really does admit exactly one; a
CommonMark-family reader (`gfm`, `commonmark`, `commonmark_x`) admits the WHOLE open paragraph,
all its lines trimmed and joined with single spaces, in every container and with no cap.

⚠ The filed item named no fix — it stated that the counter is dialect-blind and stopped. The
join itself was ONE RED→GREEN cycle; the other NINE were GUARDS against fabrications the item
never mentions. An indented code RUN already sits at `consecutiveBody === 2`, so admitting the
whole paragraph promotes CODE to a heading. A construct that INTERRUPTS a paragraph stitches a
title out of two different blocks. A FENCE can OPEN the run — reachable precisely because an
unclosed fence is deliberately not treated as a region (Session 179). `(1)` is a list under
`commonmark_x` and plain text everywhere else.

Two new block-classification lists were added, and the DEFAULT of each is the inverse of its
neighbour's: `COMMONMARK_PARAGRAPH_INTERRUPT` declines a title when a pattern is present (a
residual) and fabricates when one is missing, so it is "when in doubt, put it in" — the exact
opposite of `OPENS_FRESH_BLOCK` six lines above it. `COMMONMARK_RUN_OPENS_BLOCK` is a separate
FIRST-line list, because a bullet or ordered marker opens a run whose content IS a paragraph.

Four measured edges, none guessed: `1. x` interrupts and `2. x` does not; `- x` interrupts and a
bare `-` does not; `# x` interrupts and `#x` does not; and a GFM table does not interrupt a
paragraph with or without its delimiter row.

TEN RED→GREEN cycles. SIX closed fabrications this change itself introduced — three found by
BLIND adversarial lenses that had seen none of the designed corpora, three by the session's own
completeness pass.

MEASURED: 484 documents rendered through the real `quarto render` path, quarto 1.7.33 — 366
designed + 118 blind (+2 excluded, quarto exit 1). Designed agreeing 229 → 324. Blind agreeing
34 → 69. Per-error adjudication against the pre-session build on identical bytes: INTRODUCED 0,
REACHABLE 29, CARRIED 62, FIXED 130. The two remaining root causes — a definition body's
container column and an HTML-block opener releasing the line below it — are proven PRE-EXISTING
through the ATX row, a consumer this session never touches, and filed. That control also
CORRECTS what Session 202 filed: the definition column is wrong under all four readers, not the
two the item named.

Verification: check-types 0 · compile 0 · compile-tests 0 · npm test 1828 passed / 66 files ·
test:oracle 131 / 124 agree / 4 lost TP / 3 CARDINAL FP / 0 unrelated (byte-identical to
S180–S202) · test:integration 510 passing / 0 failing / exit 0 · check-package OK 42 files /
5.53 MB · check-backlog OK 123 open items. Repo control: all 115 tracked markdown-family
documents byte-identical across all four views, proven effective by injection against the final
build. Not run: test:lsp — no LSP surface touched.

- **Model:** Claude Opus 5

### 2026-08-10 · [ad hoc] Session 202 — a setext underline's column is DIALECT-DEPENDENT (SHIPPED)

`setextUnderlineLevel` was handed `[0, ...contentColumns]` unconditionally and had no
`dialectOverride` consumer where `atxHeadingMatch` got one in Session 199. Under quarto's
default reader that set is exactly right — an EQUALITY against column 0 or any open container
column, 192 rows of 192. Under a CommonMark-family `from:` it is the opposite SHAPE: a
TOLERANCE of 0-3 past the INNERMOST open content column, with column 0 excluded unless it IS
the innermost, because CommonMark forbids a setext underline on a lazy continuation line.

⚠ The filed item proposed reusing Session 199's flag. That flag keys on the `from:` key's
PRESENCE and never on its value — deliberate, because for the ATX row the cost of guessing
wrong is a phantom. Here it is a DELETION: `from: markdown` and `from: markdown_strict` both
render the heading at underline column 0 where `gfm` renders none. A second flag was added
beside it rather than a refinement of it, keyed on a MEASURED allowlist of base names.
`markdown_github` is in the pandoc-markdown half despite pandoc documenting it as a deprecated
synonym for `gfm` — verified against the raw HTML.

Six RED→GREEN cycles. Three of them closed errors this change had introduced, each a heading
deletion, and all three were found by BLIND adversarial lenses that had seen none of the
designed corpora: a `from:` inside a YAML block scalar (the key is now anchored at column 0);
the underline's own line opening the container it was measured against (a lone `-` is both);
and a container CommonMark has no marker for (`a. `) displacing the correct innermost column.

MEASURED: 706 documents rendered through the real `quarto render` path, quarto 1.7.33 — 597
designed + 109 blind. Designed agreeing 442 → 568. Blind agreeing 30 → 33. Per-error
adjudication against the pre-session build on identical bytes: INTRODUCED 8, REACHABLE 4,
CARRIED 90, FIXED 139. All 12 non-CARRIED errors are ONE family — the container stack does not
know which containers each reader has — proven pre-existing through the ATX row, disclosed, and
filed rather than hidden by reaching into shared machinery three rows read.

Verification: check-types 0 · compile 0 · compile-tests 0 · npm test 1817 passed / 66 files
(baseline 1810) · test:integration 509 passing / 0 failing / exit 0 (baseline 508) ·
test:oracle 131 / 124 agree / 4 lost TP / 3 CARDINAL FP / 0 unrelated (BYTE-IDENTICAL to
S180–S201) · check-package OK 42 files / 5.52 MB · check-backlog OK 119 open items
(116 − 1 completed + 4 filed). Repo control: all four views over all 115 tracked
markdown-family documents BYTE-IDENTICAL, proven effective by INJECTION against the final
build. NOT RUN: test:lsp — no LSP surface touched.

- **Model:** claude-opus-5


### 2026-08-10 · [ad hoc] Session 201 — a bullet marker on a setext title is STRIPPED, not declined (SHIPPED)

`BULLET_LIST_MARKER` was `/^ {0,3}[-*+][ \t]/`, tested against the setext TITLE line, and it
gated a blanket DECLINE: if the title began with a bullet marker, no heading was emitted at all.
It was filed for three sessions as the last of the three ` {0,3}` caps — "too narrow at a
container column" — and both prior sessions' receipts ranked it as a text divergence that "can
neither delete nor fabricate a heading".

**It was a heading DELETION, at every column, since this model's first commit.** Rendered
through the real `quarto render` path, `- solo item` / `---` produces
`<ul><li><h2 id="solo-item">solo item</h2></li></ul>` and this model produced nothing. The
guard's own docstring described that HTML correctly — "Pandoc strips the marker and nests the
heading INSIDE the `<li>`" — and then concluded the model "must decline (a false negative)". The
fact was right and the inference wrong: the heading exists and its text is obtainable.

**So the filed fix would have spread the harm.** `ATX_HEADING` (S199) and `FENCE_OPEN` (S200)
decide whether a construct is RECOGNISED; this row decided whether to EMIT AT ALL. Making it
container-relative would have converted a text divergence into a deletion on top of the deletion
already there. The three candidate rules were written into the 1B claim before any render, and
the calibration refuted the filed one in six documents.

**And this row carries no column rule for recognition — a third answer where the two adjacent
rows already disagreed.** By the time it runs, `setextUnderlineLevel` has ruled on the
underline's column and a title past code depth is code, so the only column question left is "is
the title INDENTED CODE?" — which is also, exactly, what the old ` {0,3}` was: code depth
counted from source column 0 instead of from the container, accidentally right at top level and
wrong at every container column.

Five measured behaviours, each shipped through its own RED:

1. The marker run is STRIPPED — `- - - x` renders `h1:x`; the run stops at the first non-bullet,
   so `- 1. x` keeps `1. x` and `- > x` keeps `> x`.
2. A title that is ONLY markers has an EMPTY innermost item and yields no heading (`- -`,
   `-   -`, `- * -`, `+ + +`). The old decline covered these by accident.
3. A bullet-spelled THEMATIC BREAK keeps its markers LITERALLY — `- - -` renders `h1:- - -`.
   `+ + +` does not, because `+` is not a break character: one character apart, opposite answers.
4. At INDENTED-CODE DEPTH the line is not a list item, so the marker survives. Top level strips
   0-3 and keeps 4+; inside a `-   item` (content column 4) strips 4-7 and keeps 8+.
5. The strip walks ONE MARKER AT A TIME, carrying the content column each opens — a gap wider
   than four spaces puts the next marker in code, so `-` + 5 spaces + `- x` strips only the first.

Behaviours 4 and 5 are errors this change introduced, both found by BLIND adversarial lenses
after the designed corpora had scored clean on them, and both closed here rather than filed.

**Measurement.** 474 documents rendered through the real `quarto render` path (quarto 1.7.33):
365 designed + 109 blind from nine independent lenses, each scored per document against the
pre-session build on identical bytes. Designed agreement 214 → 332; blind agreement 20 → 51.
Per-error adjudication: **INTRODUCED 0 · REACHABLE 10 · CARRIED 43 · FIXED 159.** Every one of
the 10 reachable rows carries a rendered MARKER-FREE twin on which the pre-session build errs
identically, in three pre-existing families: a lazy setext underline under `from: gfm` /
`from: commonmark`, an untracked region (`<style>`, an unclosed `<textarea>`, a `\begin{center}`
environment), and a stale container column outliving a closed fenced div. Both instruments were
proven effective — the repo control by injection against the final build, the adjudicator by
argument swap.

**Verification.** `check-types` 0 · `compile` 0 · `compile-tests` 0 · `npm test` 1810 passed / 66
files · `test:oracle` 131 / 124 agree / 4 lost TP / 3 CARDINAL FP / 0 unrelated (byte-identical
to S180–S200) · `test:integration` **508 passing / 0 failing / exit 0** on the operator's
go-ahead sought in advance, green first time · `check-package` OK 42 files / 5.52 MB ·
`check-backlog` OK 116 open items. Repo control byte-identical across all four views over 115
tracked documents. Not run: `test:lsp` — no LSP surface touched.

Three pins closed in place, each re-rendered on its own bytes first: the two FOUNDING decline
tests (wrong since the project's first commit) and Session 197's FAMILY B. Eight findings filed,
one backlog item drained, and one stale cross-reference to this guard corrected in the item that
carried it.

- **Model:** Claude Opus 5, with nine blind adversarial sub-agents whose 112 documents were
  adjudicated mechanically rather than on their claims.

### 2026-08-10 · [ad hoc] Session 200 — a FENCE's indent is CONTAINER-RELATIVE (SHIPPED)

`FENCE_OPEN` was `/^ {0,3}(([`~])\2{2,})(.*)$/` and `FENCE_CLOSE` the matching closer —
CommonMark §4.5's 0-3 space tolerance, measured from SOURCE column 0. Inside a container it
refused the fenced code block quarto builds there, so the region never opened, its content was
scanned as ordinary markdown, and the title below its closer was never at
`consecutiveBody === 1`. The last of the three sites of this class.

**The rule is a TOLERANCE relative to the enclosing block's content column — deliberately NOT
the EQUALITY Session 199 measured one row away for ATX headings.** Two adjacent rows, two
different answers: quarto's pandoc gives an ATX heading no leading-space slack at all, while a
fence keeps CommonMark's 0-3 slack and merely measures it from the container. Measured over a
96-document grid (8 container shapes × 12 indents, every one quarto exit 0): top level accepts
0-3, `- item` accepts 0-5, `-   item` accepts 0-7, a three-deep list accepts 0-9. That is
exactly the complement of `indentedCodeLine`, so the rule is REUSED rather than re-derived and
the two cannot drift. ⚠ The observable had to be the fence's INFO STRING in a class attribute:
an unrecognised fence at indent 4+ is an INDENTED code block, which renders `<pre><code>`
exactly as a recognised one does and emits no heading either way.

**The CLOSER shipped in the same commit because widening the opener alone is a measurable
no-op.** A fence opens only if `hasCloserBelow` finds a closer (S179), and `FENCE_CLOSE`
carried the same cap — so on the very documents the item was filed on, the widened opener still
declined. Measured independently over 72 documents: the closer follows the identical rule and
does NOT have to match the opener's own column. The pre-pass index now keys plain closers by
COLUMN, because an over-accepting lookahead would open a region that runs to end of document
and swallow every heading below it.

**One error this change introduced, found by the completeness pass and closed here:** a plain
fence does not in general interrupt an open PARAGRAPH. The obvious `paragraphOpen` bail is
measurably wrong — at column 0 the fence does interrupt — so what ships is the narrow boundary
"this change does not apply while a paragraph is open", as a bounded `[0]` rather than a `null`
suspension (Learning #301). The interrupt rule itself is filed, not guessed.

**Measurement.** 513 documents rendered fresh through the real `quarto render` path (quarto
1.7.33); 270 of them scored per document against the pre-session build on identical bytes.
Agreeing 214 → 246, lost headings 45 → 19, phantoms 11 → 5. Per-error adjudication:
**INTRODUCED 0, REACHABLE 0, CARRIED 24, FIXED 32.** The adversarial half was BLIND — 110
documents from eight independent lenses plus a completeness critic, none of which had seen the
designed corpora — and the adjudicator was itself proven effective by argument swap. Repo
control: all four views over all 113 tracked documents BYTE-IDENTICAL, proven effective by
injection (4 measured movers moved, 4 stayers stayed).

**Verification.** `check-types` 0 · `compile` 0 · `compile-tests` 0 · `npm test` 1804 passed /
66 files (baseline 1802) · `test:oracle` 131 / 124 agree / 4 lost TP / 3 CARDINAL FP
(BYTE-IDENTICAL to S180–S199) · `check-package` OK 42 files / 5.52 MB · `check-backlog` OK 109
open items (106 − 1 completed + 4 filed by the adversarial sweep) · `test:integration` 507
passing / 0 failing / exit 0 (baseline 506), green first time. NOT RUN: `test:lsp` — no LSP surface touched.

Commits: `528f943` (1B claim) · `7c1768c` (C1 the container-relative rule, opener + closer) ·
`a020105` (C2 the open-paragraph boundary) · `c598261` (C3 the runtime wiring evidence) ·
close-out (this commit).

### 2026-08-10 · [ad hoc] Session 199 — an ATX heading's indent is a COLUMN EQUALITY (SHIPPED)

`ATX_HEADING` was `/^ {0,3}(#{1,6})[ \t]+(.+)$/` — CommonMark §4.2's 0-3 space tolerance,
measured from SOURCE column 0. It was wrong in BOTH directions at once, which is why neither
widening nor narrowing it alone was the fix.

**The surprise, and it was hand-verified against the raw HTML rather than through an
extractor: quarto's pandoc gives an ATX heading NO leading-space tolerance at all.** At top
level `   ### Indented three` renders the literal `<p>### Indented three</p>`, while
`### No indent first` renders `<h3>`. Measured over a 121-document grid — 8 container shapes ×
11 indents × 2 levels, every one quarto exit 0 — the rule that fits all 121 rows is the one
`setextUnderlineLevel` has carried since Session 192: the indent must EQUAL a column in
`[0, ...contentColumns]`. A `- item` offers 0 and 2; `-   item` offers 0 and 4; three-deep
bullets offer 0, 2, 4 AND 6 — the whole stack, not the innermost. The sweep runs past `c+3`
into `c+4`, where the line is indented code, because a corpus stopping at `c+3` cannot tell a
correct rule from one that never refuses.

Shipped as narrowing FIRST, then widening: opening the leading class before the column test
existed would have left a window where the row over-accepts at every indent. Four RED→GREEN,
each RED confirmed to fail on the behaviour rather than the plumbing.

**Two fail-safes, both found by measurement rather than by design.** A BLOCK QUOTE suspends
the rule entirely — the first draft argued no quote gate was needed and a Session 189 pin
refuted it within the minute, since a block inside the quote clears `paragraphOpen` without
clearing `quoteOpen`, and pandoc strips the quote's markers and re-parses. A `from:` FRONT
MATTER KEY relaxes it to CommonMark's own bounded 0-3 set: `gfm` and `commonmark` genuinely
DO have the tolerance, so applying the equality there DELETED real headings. That regression
was caused by this session and found by its own completeness pass; the first fix for it
suspended the rule outright and fabricated a heading at column 4 under all five keys, because
`null` had become wider than the ` {0,3}` fallback it replaced.

**Measurement.** 189 documents rendered fresh through the real `quarto render` path (quarto
1.7.33) across three corpora, scored per document against the pre-session build on identical
bytes: 99 → 181 agreeing, phantoms 30 → 6, losses 11 → 2. Per-error adjudication returns
**INTRODUCED 1, CARRIED 7, FIXED 54, changed-in-place 0**. Repo control: all four views over
all 113 tracked documents BYTE-IDENTICAL, proven effective by injection (4 measured movers
moved, 4 measured stayers stayed, the 113 verified unchanged in the same run).

**The one introduced error is disclosed, not closed:** the ATX-swallow's TEXT at a container
column. Pandoc swallows an ATX line into a setext heading below it keeping the literal `#`;
this model strips it on purpose (Session 182's filed decision — an outline row reading
`# Heading Above` is noise). The pre-session build was right there BY ACCIDENT, because
` {0,3}` never saw the heading, so the `===` claimed the line as a setext title with the `#`
intact. What ships is uniform: the `#` is now stripped at column 0 and column 4 alike, where
the two columns previously disagreed with each other. No heading is deleted or fabricated —
both renderers emit one `h1` and only the text differs. Reversing it is a separate capability
(FM #26), and the filed item is extended with this container spelling.

Closes the filed item "`ATX_HEADING`'s own ` {0,3}` deletes a real heading at column 4 or
deeper" (Session 189), and closes in place four inherited pins: Session 194's FAMILY 2 in both
spellings, Session 193's FAMILY 5, and the original CommonMark indentation test — which
asserted the 0-3 tolerance and was **wrong from the start**, written from the spec rather than
from a render.

- **Model:** claude-opus-5

### 2026-08-09 · [ad hoc] Session 198 — the container POP's SUPPRESSION CONDITION (SHIPPED)

`computeRegions` closed every container column deeper than a shallow non-blank line whenever
`!paragraphOpen`. That flag was a PROXY for "this line is a lazy continuation, so it closes
nothing", and it is false for TWO different reasons: no paragraph is open, or the line above is
a BLOCK. A consumed setext underline, an ATX heading, a thematic break, a fence, an HTML comment
and an indented code line each set it false and so each armed a pop pandoc does not make. The
setext underline was the expensive one — that branch `continue`s, so a column-0 line below closed
a list pandoc keeps OPEN and the underline further down matched no column at all, DELETING its
heading. Session 197's blind 222-document adversarial sweep found it by four independent lenses
and ranked it #1; it was the largest single loss mechanism in that sweep.

The condition is now `the line above was BLANK, or this line is a LIST START`. That one condition
answers BOTH separately-filed items, which is why they were done together as Session 197's own
item instructed: the pop-armed-by-a-consumed-underline (heading-DELETING) and Session 192's
RAGGED-STACK pop (phantom direction), the same line of code read in opposite directions.

Operator-selected via `AskUserQuestion` at Phase 0 from an empty Active section. **Strict TDD:
THREE RED→GREEN**, each RED confirmed to fail on the behaviour rather than the plumbing —
`h1:Real Title` missing, `h1:Eta Ragged Title` surviving, and `h1:Probe Title` missing.

**⚠ THE THIRD RED IS THE POINT OF THE SESSION: the first two halves, shipped alone, DELETE REAL
HEADINGS, and the designed corpus said they were clean.** A 203-document sweep built from the
mechanism scored them at zero new errors in either direction. A 300-document completeness pass
aimed at the OTHER TWO readers of `contentColumns` then measured THREE NEW LOSSES, every one the
same shape: a footnote or definition-list container, a shallow LIST START, and a probe at the
container's own content column that quarto still honours. Each was adjudicated against the
pre-session build on identical bytes — PRE agreed with quarto, POST did not — so by the decision
rule this session's 1B claim declared in advance they are CAUSED by the change and were closed
here rather than filed. Pandoc breaks a LIST ITEM's lazy absorption at a sibling marker; a
definition body has no siblings and absorbs the marker like any other line. The stack now carries
a KIND per column, because a column alone cannot answer it. **Third session running in which a
clean designed corpus was wrong** (S196: 0 → 39 blind losses; S197: 0/0 → 262; S198: 0/0 → 3) —
recorded as Learning #298.

**THE MEASUREMENT.** ~1,000 documents rendered fresh through the real `quarto render` path
(quarto 1.7.33), over eight corpora.

| corpus | documents | what it measures |
|---|---|---|
| pop | 64 | the rule's SHAPE — 8 spellings of the line above x 4 shallow x 2 body |
| pop2 / pop3 / pop4 | 139 | WHICH spellings close a container, and at what depth |
| adv | 300 | the completeness pass, aimed at the other two readers |
| reg / nest | 72 | the three regressions minimised, and the two container kinds nested |
| pins | 17 | every inherited pin, re-rendered on its exact bytes before being flipped |

Scored against the pre-session build on all 592 scorable documents: **documents agreeing
335 → 468**, **phantom headings 102 → 14**, **lost headings 139 → 78**, and **not one document's
error set grew in either direction**.

**⚠ A CORRECTION TO THIS SESSION'S OWN FIRST FIGURE.** The residual loss count was first computed
as 135. Fifty-seven of those are `h2:Footnotes` — a section quarto GENERATES for any document
carrying a footnote, which appears in no source document and which this model can never emit. The
honest residual is 78 (pre-session 139). Seventh extractor/scorer defect in this lineage and the
first that inflated the number against the change rather than concealing one (Learning #297).

**⚠ THE MARKER TEST IS DELIBERATELY NARROWER THAN `listItemContentColumn`, and reusing that
function would have deleted headings.** That function accepts `Dr.` and `Mr.` ON PURPOSE, because
on the PUSH side a column wrongly opened is a cheap phantom. The POP inverts the cost. Measured:
`Dr. Vasquez logged it.` at column 0 leaves the enclosing item OPEN in quarto. All 24 marker
spellings were measured rather than inherited — 18 close, 6 do not (Learning #295).

**⚠ THE FIRST MARKER CORPUS SCORED SIX OF 24 WRONG AND THE ERROR WAS THE PROBE, NOT THE DATA.**
It asked whether a container at content column 4 survives, using a setext probe at column 4 — and
`10.`, `iv.`, `IV.`, `(1)`, `(a)` and `-	` all open their OWN column 4, so the probe rendered
from the NEW container. Re-run at a three-deep geometry probing column 6, which no column-0
marker can reach, all six flipped (Learning #296).

**Closed in place, each RE-RENDERED before the flip:** Session 197's FAMILY D (both spellings) and
Session 192's FAMILY 5(a). **Also re-rendered and confirmed ACCURATE rather than flipped:** the
`model.ts:1587` comment claiming a heading, thematic break, fence opener and HTML comment each END
a list — all four do, when a blank precedes them, and this model already agreed on all eight
shapes.

**Phase 3E — RUN on the operator's explicit go-ahead sought IN ADVANCE, and GREEN:**
`test:integration` **505 passing / 0 failing / exit 0** (baseline 504, +1), the new assertion
watched BY NAME at line 311 of `scratchpad/s198/integration.log`. ⚠ It touches
`test/fixtures/setext-fresh-block.qmd` NOT AT ALL — it opens its own in-memory documents through
the suite's existing `openInMemory` helper, so no exact-set `assert.deepStrictEqual` over that
fixture can be extended by it. Sessions 196 and 197 each lost a full screen-taking run to exactly
that coupling; this is the first of the three not to (Learning #299).

**Verification at close.** `check-types` **0** · `compile` **0** · `compile-tests` **0** ·
`npm test` **1797 passed / 66 files** (baseline 1794, +3) · `test:oracle` **131 / 124 agree /
4 lost TP / 3 CARDINAL FP / 0 unrelated** (BYTE-IDENTICAL to S180–S197) · `check-package` **OK
42 files / 5.52 MB** · `check-backlog` **OK**. **Repo control:** all four views over all 113
tracked `md`/`qmd` documents BYTE-IDENTICAL, proven **EFFECTIVE BY INJECTION** — 4 injected
documents moved and 4 untouched ones did not, in the same run. ⚠ The FIRST injection attempt
split 2/4 and the fault was the EXPECTATION, not the control: two of the four shapes chosen as
"movers" are shapes both builds agree on — one of them precisely because the third RED→GREEN
restored the pre-build's answer there. Verified in isolation before the injection was re-run.
NOT RUN: `test:lsp` — no LSP surface touched.

**Model:** Claude Opus 5.

### 2026-08-09 · [ad hoc] Session 197 — a SETEXT UNDERLINE's own indent is measured in COLUMNS (SHIPPED)

The LAST of the six places in `src/core/qmd/model.ts` that measured a line's indentation as a
count of characters. `SETEXT_H1`/`SETEXT_H2` were `/^( *)=+[ \t]*$/` and `setextUnderlineLevel`
compared `m[1].length` — a count of leading SPACES — against a set of COLUMNS. A tab-indented run
therefore did not match the regex at all and could never be an underline at any column, in any
container. Both regexes now take `[ \t]*` and the column comes from `indentColumn`, the one
definition the container pop, `indentedCodeLine`, `rawTexMacroLineIsBlock`, `listItemContentColumn`
and `CONTENT_COLUMN_4_OPEN` already share.

Operator-selected via `AskUserQuestion` at Phase 0 from an empty Active section; Session 196's
ranked #1 and Session 195's ranked #2. **Strict TDD: two RED→GREEN**, one per row — the `=` row,
then the `-` row, which needed its own measurement because a dash run is also the shape of a
thematic break, a table delimiter and a front-matter fence.

**⚠ IT CORRECTS A CONCLUSION RECORDED IN THE MODEL'S OWN SOURCE, and the correction is measured
twice over.** `setextUnderlineLevel`'s docstring said "⚠ A TAB is not the content column", citing
`- item` / `  Some Title` / `\t===`, which renders no heading. The measurement was right and the
rule inferred from it was not: that container's content column is **2** and a tab reaches **4**, so
the document shows only that 4 ≠ 2 (Learning #282). Re-rendered at a container whose column IS 4,
the tab lands exactly on it and quarto renders the heading. ⚠ And the cited document's own control
does not hold either — re-rendered, the SPACE spelling of those exact bytes renders no heading
either, because `  Some Title` is a lazy continuation and a 2-line paragraph never promotes. Both
halves of a ⚠ note were wrong in a way only a render could show.

**THE KEY NUMBER IS THE EQUIVALENCE, NOT THE ERROR COUNT** (Learning #286). Quarto answers
identically for a tab-indented underline and the spaces reaching the same column in **762 of 762**
pairs with no counterexample — 540 from a systematic sweep whose spellings were enumerated
mechanically rather than hand-picked, and 222 from a corpus built by nine agents trying to refute
the change. This build went **468/540 → 540/540**.

| corpus | scored | PRE (agree/phantom/LOST) | SHIPPED | new LOST | new phantom |
|---|---|---|---|---|---|
| gnd — the systematic EQUIVALENCE sweep | 864 | 660 / 0 / 72 | **732 / 0 / 0** | **0** | **0** |
| crit — the session's OWN completeness pass | 27 | 3 / 0 / 16 | 15 / 3 / 4 | **0** | 3 |
| adv — 222 BLIND adversarial, 8 lenses + a critic | 222 | 179 / 3 / 46 | 169 / 234 / 56 | 30 | 232 |
| repo — all 113 tracked `md`/`qmd` documents, four views | 113 | — | **BYTE-IDENTICAL** | 0 | 0 |

**⚠ THE BLIND SWEEP MEASURED 262 NEW ERRORS AND EVERY ONE IS PRE-EXISTING — decided mechanically,
per document, against the real renderer.** Expanding every leading tab to the spaces reaching the
same column produces the exact twin of a document; render both and ask what the PRE build did on
the twin. All 232 new phantoms and all 30 new LOSSES — the expensive direction — came back
pre-existing: the pre-session build was right by ACCIDENT, matching no tab-indented underline at
all, which masked defects the far more common space spelling already has (Learning #280 seen from
the other side). Hand-verified on five, including the realistic field-notes document whose
all-spaces twin fabricates the identical phantom on the pre-session build. **The instrument was
itself checked for effectiveness**: fed a synthetic twin-PRE that agrees with quarto everywhere it
returns 228 INTRODUCED, so it can say something other than "pre-existing".

**⚠ SHIPPED ON AN EXPLICIT OPERATOR DECISION, with the exposure measured and presented first.** The
1B claim declared the rule in advance — *would this defect exist if my change did not ship?* — and
all 262 answered NO CHANGE, so by that rule they are pinned and filed rather than closed here. The
magnitude was put to the operator anyway, with the attribution: on a candidate build (a patched
COPY, never production code) that also narrows the filed prose-as-list-marker rule, the exposure
drops from 232 phantoms to 104 and 30 losses to 22 — so **55% of it traces to that one already-filed
rule**. Narrowing it here would have been a second capability (FM #26) and its own two-directional
score is unmeasured, so it was declined and filed.

**Closed in place, each RE-RENDERED rather than flipped:** Session 194's FAMILY 1 (`h1:Papa Tab
Underline`) and Session 194's FAMILY 3 (`h1:Golf Tab Sibling Title`) — the latter being the document
Session 196 recorded as unable to demonstrate its own fix, because it needed BOTH sessions' changes
at once.

**Filed, not fixed — five families, each pinned with rendered controls in
`test/unit/qmd-model.test.ts` and each a real `- [ ]` line in `BACKLOG.md`** (grep counts pasted at
close-out, per Session 196's gotcha 6): the two KNOWN RESIDUALS already in `SETEXT_H1`'s docstring;
`BULLET_LIST_MARKER`'s own ` {0,3}` cap; **NEW — `FENCE_OPEN`'s ` {0,3}` cap is not
container-relative**, so a fence at a container's content column is not a fence and the title after
its closer is lost (proven independent of this change by control, in all spaces); and **NEW — the
container pop is ARMED by a consumed underline**, because the setext branch sets
`paragraphOpen = false`, so a column-0 line below closes a list pandoc keeps open.

**Two instrument defects found and fixed before their results were read as data** (Learning #235,
now five and six in this project's lineage). (a) The equivalence script compared heading SETS while
every probe title embeds its own document name, so twins could never compare equal — it reported
the premise refuted on exactly the 72 pairs where it holds, and "confirmed" only where both answers
were empty. (b) The scorer compared quarto's HTML-decoded text against this model's source text, so
a heading containing `>` counted as a phantom AND a loss on a heading both renderers produce.

**Verification.** `check-types` 0 · `compile` 0 · `compile-tests` 0 · `npm test` **1794 passed / 66
files** (baseline 1791, +3) · `test:oracle` **131 / 124 agree / 4 lost TP / 3 CARDINAL FP / 0
unrelated** (BYTE-IDENTICAL to S180–S196) · `check-package` **OK 42 files / 5.52 MB** ·
`check-backlog` **OK**. Repo control: all four views over all 113 tracked documents BYTE-IDENTICAL,
proven **EFFECTIVE BY INJECTION** — 8 injected documents split exactly 4 moved / 4 stayed with the
113 verified unchanged in the same run. ~1,350 documents rendered fresh through the real
`quarto render` path (quarto 1.7.33). NOT RUN: `test:lsp` — no LSP surface touched.

- **Model:** Claude Opus 5 (implementation, measurement and adjudication); the blind adversarial
  corpus was generated by nine delegated agents and rendered and scored by the session itself.

### 2026-08-09 · [ad hoc] Session 196 — a container OPENER's own indent is measured in COLUMNS, and an opener at code depth opens nothing (SHIPPED)

The last two of the six places in `src/core/qmd/model.ts` that measure a line's indentation for
the container-column machinery. `listItemContentColumn` and `CONTENT_COLUMN_4_OPEN` both anchored
on `( *)` — spaces only — so a TAB-indented list marker, footnote definition or definition-list
definition matched nothing and opened NO tracked content column at all. Operator-selected via
`AskUserQuestion` at Phase 0 from an empty Active section; Session 195's ranked #1, and the family
Session 194 filed from its own firsthand completeness pass.

**⚠ ONE DISCLOSED SCOPE AMENDMENT, and the measurement forced it.** The opener change alone was
declared complete by this session's own 1,265-document ground corpus — NEW LOST = 0, 21 headings
recovered, all 24 new phantoms proven per document to be their space twin's pre-existing error. A
BLIND 240-document adversarial sweep from eight lenses, none of which saw that corpus, then
measured **39 NEW LOST**. `contentColumns` has three consumers and the ground corpus's probe was a
setext underline, through which pushing a column can only ADD a heading; the lenses reached
`indentedCodeLine`, where pushing a column RAISES the code base, turns a code block into an open
paragraph, and `blank_before_header` deletes the ATX heading below. So an opener at code depth now
opens nothing — the guard is `indentedCodeLine` itself, reused rather than re-derived. Shipping the
opener change alone would have deleted 39 real headings (Learning #285).

**THE measurement.** 1,519 documents rendered fresh through the real `quarto render` path
(1,265 ground + 240 blind + 240 blind space-twins − overlap; plus 14 critic documents, 5 isolation
documents, 4 inherited pins and the extended fixture), scored per heading with the two error
directions separate:

| corpus | scored | PRE (agree/phantom/LOST) | **SHIPPED** | new LOST | new phantom |
|---|---|---|---|---|---|
| gnd — the EQUIVALENCE sweep, 5 contexts × 24 openers × 11 columns | 1,265 | 241 / 35 / 35 | **262 / 30 / 14** | **0** | 9 |
| advflat — 240 BLIND adversarial, 8 lenses, none of which saw `gnd` | 240 | 181 / 42 / 58 | **226 / 23 / 13** | 2 | 14 |
| crit — the completeness critic's own 7 predicted regressions | 14 | — | — | **0** | **0** |

**68 headings recovered, 47 phantoms drained.** Every one of the 25 remaining new errors —
including BOTH losses — was checked MECHANICALLY against its own space twin, rendered: all 25 are
PRE-EXISTING in the space spelling, from three separately-filed rules (prose read as a list marker,
the footnote content column, the marker-TAB push). Zero introduced defects (Learning #286).

**The falsifiable property.** The design is an EQUIVALENCE, not a threshold: every tab spelling is
paired against the space spelling reaching the same column, so it could refute the change as easily
as confirm it. Quarto answers identically in **495/495** ground pairs and **240/240** blind pairs —
735 with no counterexample. Our build went 450/495 and 114/240 before to **495/495 and 240/240**
after: the change achieves exactly that property and nothing else.

**Closed in place, each re-rendered rather than flipped:** Session 194's FAMILY 4 (a four-space
marker is code, not a container) and the indented half of Session 193's FAMILY 2. ⚠ Session 194's
FAMILY 4 was reported as "filed, not fixed" and ranked #6 in its What's-Next, but `grep` finds it
was **never in `BACKLOG.md`** — it existed only as a test pin and as handoff prose (Learning #288).

**Filed, not fixed — one NEW family, with a complete measured answer.** A footnote or
definition-list definition's content column is `base + 4`, not its own indent + 4. Together with the
code-depth guard this explains **all twenty** footnote rows of the ground corpus exactly. Pinned with
rendered controls as FAMILY B and FAMILY C. Also confirmed with rendered documents, both
pre-existing and both already on the backlog: a callout inside a list item, and a `\begin{center}`
environment at a container's content column — by-catch from the critic whose own thesis was refuted
(Learning #287).

**TDD gate — satisfied, three times**, each RED confirmed to fail on the BEHAVIOUR:
`expected [] to deeply equal [ 'h1:Probe Title' ]` for the list marker, again for the footnote
definition, and `expected [] to deeply equal [ 'h1:Lens3 Doc01 Alfa' ]` for the amendment.

**⚠ Phase 3E — RUN on the operator's explicit go-ahead sought in advance, and GREEN:**
`test:integration` **503 passing / 0 failing / exit 0** (baseline 502, +1), the new assertion watched
BY NAME at line 313 of `scratchpad/s196/integration2.log`. The fixture was re-rendered FIRST: quarto
emits fourteen headings on the new bytes and this model emits exactly those fourteen; the pre-session
build emits fourteen too but a DIFFERENT fourteen, differing in both directions — a count could not
have told the builds apart, the SET can.

**Verification at close.** `check-types` **0** · `compile` **0** · `compile-tests` **0** ·
`npm test` **1791 passed / 66 files** (baseline 1787, +4) · `test:oracle` **131 / 124 agree / 4 lost
TP / 3 CARDINAL FP / 0 unrelated** (BYTE-IDENTICAL to S180–S195) · `check-package` **OK 42 files /
5.52 MB** · `check-backlog` **OK, 103 open items**. Repo control: all four views over all 113 tracked
`md`/`qmd` documents BYTE-IDENTICAL, proven EFFECTIVE BY INJECTION — 8 injected documents split
exactly 4 moved / 4 stayed, with the 113 verified unchanged in the same probe run. NOT RUN:
`test:lsp` — no LSP surface touched.

**Commits.** 1B claim `0e51409`. **C1** `713db69` — the two openers measured in columns, two
RED→GREEN. **C2** `5beb7bc` — the scope amendment, its RED→GREEN, and the two inherited pins closed
in place. **C3** `77f1e08` — the fixture extended and re-rendered, three named controls at the real
Outline provider, exact set eleven → fourteen. Close-out (this commit). Every commit at or under the
5-file cap.

### 2026-08-09 · [ad hoc] Session 195 — `BACKLOG.md` holds only OPEN work, and a deny-by-default check keeps it that way (SHIPPED)

Both halves of the operator-designated item: the re-accumulated completed work is drained, and
the missing backstop exists. Shipping the drain alone is the experiment Session 150 already ran,
and it regressed within a few sessions.

**The measurement, taken firsthand, and it corrects the filed figures in both directions.** The
item said "17 tombstone lines plus 19 further completed-work records — 36 blocks, ~24 KB, 15% of
the 165 KB file". Measured by a rule applied to the file: **24 blocks, 33 KB, 20% of it** — fewer
blocks and more bytes. The "36" counted the sessions named inside the blocks rather than the
blocks: one 4.3 KB block alone rolls up eleven sessions (S151–S161). `BACKLOG.md` goes from
169,019 to 135,182 bytes, 429 lines to 238, and from 119 unchecked boxes to 103 real open items —
17 of those boxes were never work.

**Every block was verified against `CHANGELOG.md` and `PROJECT_LEARNINGS.md` before deletion, and
each `FULLY_REDUNDANT` verdict was then adversarially attacked.** 24 blocks verified, the 10
judged fully redundant re-attacked by an independent skeptic told to assume the verdict wrong; 2
came back refuted. Both refutations were then checked by hand and both turned out to be the same
shape: the **measurement** is in the ledger and the **correction of the original filing's own
wording** is not. That is the root cause of the whole re-accumulation, and it is now
`PROJECT_LEARNINGS.md` #283.

**One block held OPEN work, and nothing else in the repository recorded it.** Inside the Session
183 tombstone: the lone `+` inside a list item, whose candidate gate suspension is measured at 2
recovered headings against 32 new phantoms — an operator decision, never shipped. `32 new
phantoms` had exactly **one** hit across all tracked files, and Learning #236 mentions the lone
`+` only as a corpus example. It is restored to "Up Next" as an open item. This is the single
strongest argument against the bulk deletion the item's own headline proposed.

**Salvaged, because it is recorded nowhere else and would change a future session's decision:**

- **The `scratchpad/` residual is deliberately NOT disposable.** Session 186 pruned 2,332 MB (91%)
  of regenerable `quarto render` byproduct back to 212 MB; the remainder is the cited, non-
  regenerable set and re-pruning it would break tracked citations. `.vscodeignore` records the
  prune and its gate, but not that the residual is load-bearing.
- **Session 186's own prescribed grep was a ~29% sample.** "grep `docs/planning/` for
  `scratchpad/`" reaches only **23 of the 78** paths cited across all tracked files, so following
  the item's own instruction would have worked from under a third of the citation set.
- **`basefont` and nine other CommonMark-§4.6-only names are not in pandoc's sets at all**, and 47
  pandoc names CommonMark lacks are in. `test/unit/qmd-model.test.ts` cites `BACKLOG.md` for
  `<basefont size="3">` as the measured case; that citation now resolves here.
- **Session 187's central refutation:** `<ins>x</ins>` and `<em>x</em>` render BYTE-IDENTICALLY
  against an open paragraph. The filed item asserted the opposite and listed thirteen
  `eitherBlockOrInline` names as block openers on the strength of it, conflating pandoc's two
  sets. Of the sixteen it named, only `meta`, `canvas` and `output` are in `blockTags`. The
  mechanism is in `src/core/qmd/model.ts`'s docstring; the refuted claim itself was held only by
  the tombstone.
- **A filed SEVERITY or RARITY rating is a hypothesis** — corrected in 7 of the 24 blocks, in
  every case toward "worse than filed". `PROJECT_LEARNINGS.md` #284.

**Deliberately NOT salvaged, with the reason:** figures that CONTRADICT the ledger rather than
extend it. The Session 194 block records "1,915 documents scored, 54 phantoms drained, 134
headings recovered" where this file records 1,932 / 55 / 136 for the same measurement; the Session
193 block says the threshold "held in all ten containers measured" where both the ledger and
`src/core/qmd/model.ts` enumerate six. Copying a superseded figure forward would install a
contradiction in the authoritative record. Credit-attribution nuances ("the item's own warning was
RIGHT") were also dropped: the measurements they attach to are all recorded, and attribution
changes no future decision.

**The gate.** `check-backlog.js` at the repo root beside `check-package.js`, `npm run
check-backlog`, and asserted by `test/unit/backlog-hygiene-gate.test.ts` so it runs on **every
`npm test`** — deliberately the always-run path rather than the release path, because the practice
it catches happens at close-out, many sessions between releases. It reads a block's **LEAD**, not
the block: MEASURED, 35 lines contain `SHIPPED Session` and only 17 are records, so a whole-block
search reds on ~18 open items that legitimately cite shipped work — and a gate that cries wolf
gets deleted. Parenthetical asides are stripped for the same reason, from a real document.

**Strict TDD**, five behaviours, each RED before GREEN and each RED confirmed to fail on the
behaviour rather than the plumbing. **Verification:** `check-types` 0 · `compile` 0 · `npm test`
**1787 passed / 66 files** (baseline 1782 / 65 — one new file, five new tests, no regressions) ·
`check-package` **OK 42 files / 5.52 MB, byte-identical to the baseline** — the two new root files
are excluded in `.vscodeignore` · `check-backlog` **OK, 103 open items**.

**Phase 3E — no runtime surface changed, verified rather than asserted.** `src/` carries no
functional edit, so `dist/` behaviour is unchanged and `test:integration` was not run; the
byte-identical packaged artifact above is the evidence. `test:lsp` and `test:oracle` likewise not
run — no `src/` surface touched.

### 2026-08-09 · [ad hoc] Session 194 — GROOMING DECISION: `BACKLOG.md`'s re-accumulated completed work is filed as the next deliverable

A non-commit action recorded per failure mode #27 (a grooming decision escapes a commit-only
reflex). After Session 194's close-out the operator pointed at `- [ ] **REMOVED — SHIPPED
Session 182.**` and asked how completed records had got into an open-items file.

**Measured firsthand, not estimated:** 17 unchecked checkboxes whose body is a
`REMOVED — SHIPPED Session N` tombstone, plus 19 further completed-work records — **36 blocks,
~24 KB, 15% of the 165 KB file**, contributed by **30 sessions between S137 and S194**.
**Session 194's own close-out (`aa930d0`) added one**, so this is a live practice rather than
historical drift. The defect is the `- [ ] ` marker rather than the prose: a completed record
wearing an open-task checkbox, so 17 of the file's 114 unchecked boxes are not work.

**Session 150 already ran the deletion half** — 115 KB, 46% of the file, with a "keep it clean"
note preserved at lines 95–99 — and the practice regressed within a few sessions, because
nothing detects the regression. The ledger has a Phase 3F write-gate **and** Phase 0
reconcile-on-read; `check-package.js` is deny-by-default; `BACKLOG.md` has the instruction and
neither backstop.

Filed as the first item under "Up Next" with both halves stated: verify each block against
`CHANGELOG.md` and `PROJECT_LEARNINGS.md` before deleting (spot-checked — the learnings the
tombstones cite all exist and the sessions they name all have ledger entries, so most are
redundant, but the tombstones carry post-hoc corrections of the shipped items' own claims, which
is why sessions kept them), then add the missing gate. **No cleanup was performed in this
session** — it is a separate deliverable, and shipping the deletion without the gate is the
experiment Session 150 already ran. **Model:** Claude Opus 5.

### 2026-08-09 · [ad hoc] Session 194 — recorded its own Phase 0 health snapshot

One appended `dashboard_history.jsonl` row from the mandated Phase 0 step 5
`methodology_dashboard.py` run: v2.13.0, health **76**, risk **high** ×1, issues **0**,
vulns **6** (5 high + 1 moderate, devDependency-only), 1,038 commits. Unchanged from
Session 193's snapshot on every axis except the commit count. Logged as its own action
because the run mutates a tracked file (failure mode #27). **Model:** Claude Opus 5.

### 2026-08-09 · [ad hoc] Session 194 — IMPLEMENTATION: a line's indentation is measured in COLUMNS, not in spaces (SHIPPED)

The `contentColumns` stack closed containers by comparing a count of leading SPACES against
the open content columns, while every other column-aware rule in `src/core/qmd/model.ts`
expands a tab to the next 4-column stop. A tab-indented line therefore looked shallower than
it is and popped a container that was still open. Because that stack sits under readers of
OPPOSITE polarity, the one defect both invented and deleted headings.

Measured as an **equivalence**, not a threshold, so the answer was not presupposed (Learning
#279): 432 ground documents rendered through the real `quarto render` path, pairing every tab
spelling against the SPACE spelling reaching the same column — 6 containers × 13 columns ×
up to 4 spellings × 2 consumer families. Quarto answered identically in **276 of 276** pairs.

`indentColumn` is now the one definition of "how deep is this line" and is shared by three
call sites. The second, `rawTexMacroLineIsBlock`, is a **disclosed scope amendment**: it was
declared out of scope at claim, and re-scoring Session 193's own corpora (Learning #276) then
measured **6 NEW LOST headings** there — the old wrong pop had been masking a pre-existing tab
blindness in that row, and correcting the pop exposed it (Learning #280). Shipping the
container fix alone would have deleted six real headings, so the row was closed in the same
session and the amendment recorded rather than the regression filed (Learning #281).

**1,932 documents scored** with the two error directions separate — 704 rendered fresh this
session and 1,228 re-scored from Session 193's cached renders (a 705th, the extended fixture,
was rendered and compared by hand). **NEW PHANTOM 0 and NEW LOST 0
on every corpus, as empty SETS rather than smaller numbers.** 55 phantoms drained and 136 real
headings recovered. Blind adversarial: 240 documents from eight lenses that never saw the
designed corpus — 0 new errors either way, 13 headings recovered. Repo control: all four views
over all 113 tracked `md`/`qmd` documents byte-identical, proven effective by injection
(8 injected, exactly 4 moved / 4 stayed).

`check-types` 0 · `compile` 0 · `compile-tests` 0 · `npm test` **1782 passed / 65 files**
(baseline 1779, +3) · `test:oracle` **131 / 124 / 4 / 3 / 0**, byte-identical to S180–S193 ·
`check-package` OK, 42 files / 5.52 MB · **`test:integration` 502 passing / 0 failing /
0 pending, exit 0** (baseline 501), the new assertion watched by name at line 312.
NOT RUN: `test:lsp` — no LSP surface touched. **Model:** Claude Opus 5.

Filed, not fixed — four families of the SAME rule, each pinned with a rendered control: the
setext underline's tab (which corrects a conclusion recorded in this file's own source,
Learning #282), `ATX_HEADING`'s own ` {0,3}` (now measured as a LOSS family too, not only a
phantom family), and the two remaining spaces-only openers `listItemContentColumn` and
`CONTENT_COLUMN_4_OPEN`. Also left open, both re-confirmed and both distinct mechanisms
bundled under the same board item: the RAGGED-stack pop and the marker-tab push.

### 2026-08-09 · [ad hoc] Session 193 — recorded its own Phase 0 health snapshot

One appended `dashboard_history.jsonl` row from the mandated Phase 0 step 5
`methodology_dashboard.py` run: v2.13.0, health **76**, risk **high** ×1, issues **0**,
vulns **6** (5 high + 1 moderate, devDependency-only), 1,031 commits. Unchanged from
Session 192's snapshot on every axis except the commit count. Logged as its own action
because the run mutates a tracked file (failure mode #27). **Model:** Claude Opus 5.

### 2026-08-09 · [ad hoc] Session 193 — IMPLEMENTATION: an INDENTED CODE line is measured from the containing block's CONTENT COLUMN (SHIPPED)

`INDENTED_CODE_LINE` tested a literal four spaces. Pandoc re-parses a container's content
DEDENTED, so the indented-code threshold inside a container is four past THAT container's
content column. The new `indentedCodeLine(line, columns)` measures the line's indent in
COLUMNS — tabs advancing to the next 4-column stop, absolutely — and compares it against
`base + 4`, where `base` is the deepest open content column at or below the line's own.
Measured over 300 ground documents before any code changed: the threshold is exactly
`contentColumn + 4` in every container — top level 4, `- ` 6, `1. ` 7, `-   ` 8,
footnote/definition 8, three-deep nest 10.

**The row had THREE consumers and the filed item named one.** `CLOSES_PARAGRAPH` removes
phantom ATX headings (the one described); `OPENS_FRESH_BLOCK` and the code-RUN exception
both move headings the other way, so each was swept in its own right and all three
returned the same threshold. The run exception carried the largest single effect —
**80 recovered headings**, where a title at its container's own content column had been
read as the second line of a code run — attributed by ABLATION (a build with only that
call site reverted scores the setext sweep at 98/0/86 against 178/0/6 as shipped).

**The filed magnitude was overstated by 80%.** Re-scoring Session 189's seven cached
corpora (4,124 documents) measured 61 residual phantoms, of which this drains 20 — not
the 36 claimed. The 16 survivors all have an INDENTED ATX heading line and belong to
`ATX_HEADING`'s cap.

5,352 documents scored (1,254 rendered fresh, 4,124 re-scored), plus 33 hand-compared controls. **NEW LOST = 0 on every
corpus**, as an empty set; NEW PHANTOM = 2, both proven by substitution to be the
`contentColumns` stack's spaces-only pop rather than this rule. 106 phantoms drained,
107 headings recovered. Repo control byte-identical over 113 tracked documents, proven
effective by injection (4 moved / 4 stayed). `test:integration` 501 passing, exit 0.
Six residual families pinned, each with its control; one of them — a blank line inside an
indented code block re-arming the next code line as a setext title — is new and was
previously unfiled. **Model:** Claude Opus 5.

### 2026-08-09 · [ad hoc] Session 192 — recorded its own Phase 0 health snapshot

One appended `dashboard_history.jsonl` row from the mandated Phase 0 step 5
`methodology_dashboard.py` run: v2.13.0, health **76**, risk **high** ×1, issues **0**,
vulns **6** (5 high + 1 moderate, devDependency-only), 1,025 commits. Unchanged from
Session 191's snapshot on every axis. Logged as its own action because the run mutates a
tracked file (failure mode #27: an action is owed a ledger line even when it is one row).
**Model:** Claude Opus 5.

### 2026-08-09 · [ad hoc] Session 192 — IMPLEMENTATION: a SETEXT underline is anchored at the containing block's CONTENT COLUMN (SHIPPED)

`SETEXT_H1`/`SETEXT_H2` carried ` {0,3}`, transcribed from CommonMark §4.3. Pandoc's
markdown reader is not CommonMark here: `setextHeader` applies `skipNonindentSpaces` to
the TITLE line and then reads the underline run with no leading-space parser at all, so
the run must begin exactly where the enclosing block's content begins. The new
`setextUnderlineLevel(line, columns)` tests that indent for **equality** against
`[0, ...contentColumns]` — Session 189's machinery, reused, not a second column model.

**The filed item's MEASUREMENT was right and its PRESCRIBED FIX was wrong, in the
heading-DELETING direction.** It says the underline is "anchored at column 0" and names
`SETEXT_UNDERLINE_RUN` as the model to copy; every document behind that claim — Session
182's original rows and Session 191's 27-document factorial alike — has **no container**.
Re-rendered before a line of code changed (Learning #251): a `- ` item renders the heading
at underline column 2, a `1. ` item at 3, a `-   ` item at 4, and three-deep nested bullets
at 0, 2, 4 **and** 6. The prescription would have deleted every one of those.

**511 documents scored** against the real `quarto render` path — 54 ground (underline
indent / title indent / both, as three separate corpora), 162 container, 17 environment,
8 re-measuring Session 191's FAMILY 1, 10 trigger-removal controls, and **270 BLIND
adversarial from nine lenses** (eight plus a completeness critic). Per heading, two
directions separate; the polarity is INVERTED from Session 191's, so a LOST heading is the
expensive error here.

| corpus | scored | PRE (agree/phantom/LOST) | SHIPPED |
|---|---|---|---|
| designed (ground + container + env + fam1) | 241 | 50 / 66 / 15 | **63 / 0 / 2** |
| advflat (BLIND, 9 lenses) | 270 | 142 / 82 / 115 | **189 / 60 / 68** |

**97 phantoms drained, 57 headings recovered, and NEW LOST = 0 on both corpora — an empty
SET, not a smaller number.** The 2 residual designed losses are the block-quote cell,
byte-identical on the pre-build and already filed. Eleven new phantoms are disclosed and
pinned in five families, each with its control: seven proven pre-existing, one classified
by family and labelled as inference, three a genuinely new consumer of the `contentColumns`
arithmetic — which this change does not modify, only reads.

**Phase 3E ran GREEN BEFORE this commit**, on the operator's explicit go-ahead sought in
advance: `test:integration` **500 passing / 0 failing / 0 pending, exit 0**, the new
assertion watched BY NAME at line 310 of the log. Repo control: all four views over all
**113** tracked `md`/`qmd` documents BYTE-IDENTICAL, proven EFFECTIVE BY INJECTION.

Verification: `check-types` 0 · `compile` 0 · `compile-tests` 0 · `npm test` **1777 passed
/ 65 files** (baseline 1775, +2) · `test:oracle` **131 / 124 / 4 / 3 / 0** (byte-identical
to S180–S191) · `check-package` **OK 42 files / 5.52 MB**. `test:lsp` not run — no LSP
surface touched.

Commits: `5bcea8d` (1B claim), `ac1ee38` (the equality rule + RED→GREEN), `9d7aa38` (the
provider controls + eleven disclosed residuals), `c728ad0` (the footnote-spelling pin a
Phase 3F cross-reference check found dangling), and this close-out.
**Model:** Claude Opus 5.

### 2026-08-09 · [ad hoc] Session 191 — recorded its own Phase 0 health snapshot

One appended `dashboard_history.jsonl` row from the mandated Phase 0 step 5
`methodology_dashboard.py` run: `2026-08-09T09:09`, v2.13.0, health **76**, risk **high** ×1,
1,019 commits, 6 vulns. Health flat at 76 across the last four snapshots; the single high-risk
flag remains the standing `npm audit` count of 6 (5 high + 1 moderate, **devDependency-only**,
so none reaches a shipped artifact), open since Session 186.

Logged rather than waved through, which is the same position this session's Phase 0 reconcile
took against `47d9514` an hour earlier: the append is an action, `SESSION_RUNNER.md` permits
exactly two reconcile no-ops, and "protocol telemetry" is not one of them. Its own commit
because the close-out commit was already at the 5-file blast-radius cap.

### 2026-08-09 · [ad hoc] Session 191 — IMPLEMENTATION: a class-A raw-TeX macro OPENS a fresh block (SHIPPED)

`opensFreshBlock` now tests `RAW_TEX_BLOCK_MACRO` beside `HTML_BLOCK_OPEN`, ahead of its
`paragraphOpen` bail. One line.

**A PREDICATE WITH AN EARLY BAIL HAS TWO ANSWER SETS, AND NOTHING CROSS-CHECKED THE PRE-BAIL
ONE.** `closesParagraph` and `opensFreshBlock` ask nearly the same question and both bail on
`paragraphOpen`. Session 188 put the class-A raw-TeX macro ahead of `closesParagraph`'s bail,
because class A interrupts a paragraph in every context. Nothing put it ahead of
`opensFreshBlock`'s, which reached raw TeX only *behind* the bail via `rawTexMacroLineIsBlock` —
the class-A∪B row gated on the containing block's content column. So `pendingFreshBlock` stayed
false, `consecutiveBody` never returned to 1, and the `===` below the macro's successor was never
read as a setext underline:

    This paragraph is still open.
    \maketitle
    ATX Below
    ===

renders `<h1>ATX Below</h1>` and this model produced **nothing at all**. Not mis-levelled, not
mis-named — absent. **A setext heading is a strictly stronger test than an ATX one** (ATX needs
only the paragraph CLOSED; setext additionally needs the line below to START a fresh paragraph),
which is how an eight-session-old divergence survived a 499-test integration suite.

**THE MEASUREMENT — 2,555 documents rendered through the real `quarto render` path this session,
plus 2,780 re-scored from Session 190's five corpora**, scored per heading with the two error
directions kept separate. ⚠ The polarity is INVERTED from Session 190's: `OPENS_FRESH_BLOCK`
ADDS headings, so a PHANTOM is the expensive error here.

| corpus | docs scored | PRE (agree/phantom/LOST) | **SHIPPED** |
|---|---|---|---|
| gnd — the filed item's own document, 3 classes × 9 indents × 2 underlines × 2 contexts | 108 | 34 / 0 / 24 | **58 / 0 / 0** |
| ctx — 20 containers × 3 classes × 9 indents × 2 underlines × 2 contexts | 2,159 | 848 / 98 / 436 | **1272 / 98 / 12** |
| advflat — 240 BLIND adversarial documents, 8 lenses | 238 | 36 / 14 / 89 | **89 / 24 / 36** |
| S190 ctx (re-scored) | 1,728 | 642 / 77 / 216 | **858 / 77 / 0** |
| S190 advflat (re-scored) | 239 | 92 / 24 / 35 | **97 / 25 / 30** |
| S190 gnd / cls / mask (re-scored) | 813 | 674 / 9 / 0 | **674 / 9 / 0** |

**722 REAL HEADINGS RECOVERED, and the NEW-LOSS set is EMPTY at set level in every corpus.**
The filed magnitude was **exactly right** — 216 filed, 216 drained on the predecessor's own
corpus, the first exact one in three sessions. The same hoist also fixed a second family the
item never mentioned: class A at indent 1–3 with **no** paragraph open, falling in the gap
between the content-column row (indent 0) and `INDENTED_CODE_LINE` (indent 4+).

**ELEVEN NEW PHANTOMS, TEN OF THEM PROVEN PRE-EXISTING RATHER THAN ARGUED.** Learning #263's
control was applied to *every* one, not only the suspicious ones (Learning #269): take the same
document, replace this session's trigger with `<div>` — an opener `HTML_BLOCK_OPEN` already
tested ahead of the same bail on the pre-build — and re-run on the OLD build. Nine of ten
fabricate the identical heading there. They are two already-filed defects reached through a
fourth doorway: `SETEXT_H1`/`SETEXT_H2`'s own ` {0,3}` indent (Session 182's item, now the
largest phantom family on the board and re-measured through three independent openers at
underline columns 1, 2 and 3), and raw regions this scanner does not track (Session 190's item,
now with a SETEXT spelling and two new region kinds). The one that is not explained is a TEXT
divergence rather than a fabrication — `\maketitle` followed by a line opening with `[` has that
bracket group consumed as its optional argument across the newline, so quarto's heading text is
`: https://example.com` where ours keeps the bracket. Read off the rendered HTML directly. All
three families are pinned in the unit suite, each beside the control that proves it.
**Narrowing back would have hidden them while re-deleting 722 real headings.**

⚠ **THE `\hrule` SCARE WAS NOT ABOUT `\hrule`** (Learning #268). A 27-document full-factorial
sweep over macro × macro-indent × payload showed the macro and its indent are both irrelevant
and the *underline's* indent is everything. Naming the family after the construct just changed
would have produced a fix to the wrong row, in the heading-deleting direction.

⚠ **`RAW_TEX_ENV_OPEN` is also absent from `opensFreshBlock`, and it is MEASURED INERT** — 12 of
12 documents agree; quarto renders no setext heading after a closed, unclosed or orphan
environment in either context. Recorded so no successor re-investigates it as a gap.

**TDD gate — satisfied.** ONE behaviour driven RED→GREEN with the RED confirmed to fail for the
right reason (`expected [] to deeply equal [ 'h1:ATX Below' ]` at the filed item's own document),
carrying class-B and class-C control groups in the same `it()` at all nine indents and both
underline spellings (Learning #242). Labelled test-after in the file: the three disclosed
residual families with their pre-existence controls.

**⚠ SCOPE held (FM #26).** `SETEXT_H1`/`SETEXT_H2`'s ` {0,3}` is a one-row change I could have
made in five minutes, and it is **filed, not fixed** — it is a NARROWING and needs its own
two-direction score.

**⚠ Phase 3E — run BEFORE the close-out commit on the operator's explicit go-ahead sought in
advance, and GREEN:** `test:integration` **499 passing / 0 failing / 0 pending, exit 0**, with
`narrowing CLOSES_PARAGRAPH reaches the real Outline provider (Session 184)` watched by name at
line 312 of `scratchpad/s191/integration.log`. The fixture gained a PRESENT control (the setext
heading the missing hoist deleted) and an ABSENT control (the class-B case that decides the
change); re-rendered first — quarto emits fourteen headings on those exact bytes and this model
emits exactly those fourteen.

**Repo control:** all four views over all **113** tracked `md`/`qmd` documents are
BYTE-IDENTICAL, and the control is proven EFFECTIVE BY INJECTION — exactly the 2 of 6
deliberately-divergent documents that should move do, while class B, class C, class-A-with-ATX
and plain prose do not.

**Verification at every checkpoint boundary:** `check-types` **0** · `compile` **0** ·
`compile-tests` **0** · `npm test` **1775 passed / 65 files** (baseline 1773 — 2 new tests, no
regressions) · `test:oracle` **131 documents / 124 agree / 4 lost TP / 3 CARDINAL FP / 0
unrelated** (BYTE-IDENTICAL to S180–S190) · `check-package` **OK 42 files / 5.52 MB**. NOT RUN:
`test:lsp` — no LSP surface touched.

Commits: `2ed1a5b` (1B claim), `da505ad` (C1 — the hoist + RED→GREEN), `07e5ce2` (C2 — fixture,
integration controls, residual pins), and this close-out. `PROJECT_LEARNINGS.md` #267–270.
`BACKLOG.md`: 1 item shipped out, 3 extended with measured evidence, 2 filed.

### 2026-08-09 · [ad hoc] Backfilled (reconcile-on-read): undocumented commit `47d9514` — two Phase 0 dashboard snapshots

Session 191's Phase 0 step 6 found exactly one commit past the `CHANGELOG.md` frontier
(`c6b1663`) with no ledger entry: **`47d9514`, `chore(dashboard)`** — two appended
`dashboard_history.jsonl` rows (`2026-08-08T23:34` and `2026-08-09T01:10`; both v2.13.0,
health **76**, risk **high**, **6** vulns), the first inherited uncommitted from Session 189's
Orient and the second Session 190's own. One file, 2 insertions; no source, test, build or
packaging file is touched, so no verification figure moves.

**Its commit message declines a ledger entry in as many words** — *"No CHANGELOG entry: this is
telemetry appended by the protocol's own orientation step, not a project action."* Recorded here
regardless. `SESSION_RUNNER.md` Phase 0 permits exactly **two** reconcile no-ops (a non-empty
frontier with an empty `<frontier>..HEAD`, or a project that records a "no CHANGELOG" opt-out in
`CLAUDE.md`), and a per-commit self-exemption is neither — "too small to log" is failure mode #27
rather than an exception to it. **This file's own precedent is split, which is itself the argument
for logging it:** the identical telemetry commit was logged at Session 187 (`fe1e05b`, "Action 2")
and left unlogged at Session 188 (`6f3b0d3`). A ledger whose coverage depends on which session
touched the file is not an authoritative ledger.

Backfill only — it records a commit that already exists, and is not this session's deliverable.

### 2026-08-09 · [ad hoc] Session 190 — IMPLEMENTATION: a class-A raw-TeX macro is INDENT-INSENSITIVE (SHIPPED)

Removed `RAW_TEX_BLOCK_MACRO`'s ` {0,3}` indent cap. Its leading-whitespace class is now
`[ \t]*`, unbounded.

**THE CAP NEVER MODELLED ANYTHING.** Class A does not reach pandoc's `rawTeXBlock` on the path
that matters here. It interrupts an open paragraph by making `inlineCommand'` FAIL —
`guard $ isInlineCommand name || not (isBlockCommand name)` — and that guard runs at the
**inline** level, reached through `inline`'s `'\\'` dispatch on a paragraph's continuation
line, where the leading whitespace has already been consumed as inter-word space. There is no
`skipNonindentSpaces` on that path and no column rule anywhere near it. So ` {0,3}` was not
CommonMark's indented-code rule in disguise; it simply lost the class-A test on indented
lines, and Session 183's `paragraphOpen` bail then **deleted the heading below every one of
them**. `HTML_BLOCK_OPEN` made this identical repair at Session 185 for the identical reason.

**⚠ THE TWO RAW-TeX ROWS MUST STAY INCONSISTENT WITH EACH OTHER.** Class B carries the
containing block's content column exactly (Session 189); class A carries no cap at all.
Measured in both directions: giving class A the content column deletes every heading under an
indented `\maketitle`, and giving class B no cap restores the 1,043 phantoms S189 removed. The
word "indent" names two rows that fail in opposite directions (Learning #260).

**THE MEASUREMENT — 2,772 documents rendered through the real `quarto render` path** (plus 240
blind adversarial ones from eight lenses that had never seen this session's corpora, and 498
re-scored from two predecessors' corpora), scored **per heading with the two error directions
kept separate**:

| corpus | docs | PRE (agree/phantom/LOST) | **SHIPPED** |
|---|---|---|---|
| gnd — the filed item's own documents | 30 | 6 / 0 / 11 | **17 / 0 / 0** |
| cls — 73 class-A names × 9 indents | 774 | 219 / 0 / 438 | **657 / 0 / 0** |
| ctx — 20 containers × 3 classes | 540 | 178 / 28 / 102 | **253 / 28 / 27** |
| fresh — no paragraph open | 540 | 389 / 49 / 27 | **389 / 49 / 27** |
| sx — the SETEXT polarity, both spellings | 648 | 0 / 0 / 270 | **0 / 0 / 270** |
| advflat — BLIND adversarial, 8 lenses | 240 | 60 / 21 / 70 | **92 / 25 / 38** |
| **TOTAL** | **2,772** | **852 / 98 / 918** | **1408 / 102 / 362** |

**556 real headings recovered. The NEW-LOSS set is EMPTY at set level, not merely by count.**
The `fresh` and setext corpora are byte-identical, measured in their own right rather than
reasoned about (Learning #233) — and measuring the setext one is what turned up the
216-heading `opensFreshBlock` gap now filed in `BACKLOG.md`.

**FOUR NEW PHANTOMS, EVERY ONE CHARACTERIZED FIRSTHAND, AND ONE IS NOT REAL.** The fourth is a
document `quarto render` **exits 1** on — the known `...` front-matter item — so it has no
heading truth at all. The other three are one defect: an indented class-A macro inside a raw
region this scanner does not track (a multi-line inline code span, an RCDATA `<textarea>`, a
CDATA section). **The cap was MASKING those, not guarding them** — the pre-S190 build already
emits all three with the macro at **column 0**, re-rendered and pinned as a control beside each
residual (Learning #263).

**REPO CONTROL:** all four views (headings, cells, outline, crossref labels) over all **115**
tracked `md`/`qmd` files are **byte-identical** across the change, and the control is proven
**effective by injection** — exactly 3 of 6 deliberately divergent documents move while the
115 do not.

**CORRECTION TO THE FILED ITEM's own magnitude, published rather than quietly dropped.** S189
ranked this item #1 on "8 of the 21 losses on S188's corpus". Re-scored after shipping, it
drains **5** — identical whether counted by heading, by document, or by
document-carrying-a-drained-loss. Mechanism and polarity were right; the size was overstated.

**Verification** (run at every checkpoint boundary): `check-types` 0 · `compile` 0 ·
`compile-tests` 0 · `npm test` **1773 passed / 65 files** (baseline 1771 — 2 new tests, no
regressions) · `test:oracle` **131 documents / 124 agree / 4 lost TP / 3 CARDINAL FP / 0
unrelated** (byte-identical to S180–S189) · `check-package` **OK 42 files / 5.52 MB**.
**Phase 3E:** `test:integration` **499 passing / 0 failing / 0 pending, exit 0**, run on the
operator's explicit go-ahead **before** the close-out commit. NOT RUN: `test:lsp` — no LSP
surface touched.

**Model:** Claude Opus 5.

### 2026-08-09 · [ad hoc] Session 189 — IMPLEMENTATION: a raw-TeX block starts at the CONTAINING BLOCK's content column (SHIPPED)

Replaced the raw-TeX row's literal ` {0,3}` indent with a test against the containing block's
**content column**, the scanner-state capability the filed item named and Session 184 lacked.

**THE ROW WAS WRONG IN BOTH DIRECTIONS, AND THE TWO ARE NOT SYMMETRIC.** Pandoc's
`rawTeXBlock` begins `lookAhead $ try $ char '\' >> letter` with no `skipNonindentSpaces`
before it, so the backslash must sit at the **current parse column**. At top level that column
is 0, and ` \clearpage` is ordinary paragraph text — three phantom headings per macro. But
inside a list item pandoc re-parses the item's content **dedented**, so the item's content
column IS that sub-document's column 0; demanding a literal 0 deletes the heading under every
raw-TeX block anyone indents inside a list. Session 184 built exactly that literal-0 form,
measured **3 phantoms removed against 1 real heading deleted**, and rejected it. The column is
not a constant, so `computeRegions` now carries it.

**THE MARKER → COLUMN RULE, MEASURED EXHAUSTIVELY** (2,394 documents: 19 marker spellings × 7
spacings × 2 marker indents × a 0–8 indent sweep) is
`markerIndent + markerLength + spacesAfter`, with three corrections no reading of CommonMark
would give: **five or more spaces collapse to one** (`-     x` is column 2, not 6, while
`-    x` really is 5); a **tab expands to the next multiple of 4 columns** (`-\tx` → 4,
`100.\tx` → 8); and a marker **alone** on its line gives `marker + 0`, so `-` is column 1, not
CommonMark's 2. Footnote definitions and definition-list definitions are always column **4**.
Every ancestor container's column stays open, blank lines preserve them, a shallower line
closes them — and a **lazy continuation** does not, because a shallow line under an open
paragraph belongs to that paragraph.

**A BLOCK QUOTE SUSPENDS THE RULE, AND THAT IS THE LARGEST DELETION TRAP IN THE CHANGE.**
`> q` / `>` / `   \clearpage` renders the heading **inside** the blockquote at every indent
0–8 (verified against rendered HTML, not inferred). This model carries no block-quote
container, so while one may be open the old ` {0,3}` width is kept — phantoms, never deletions.

**MEASURED — 4,125 documents** through the real `quarto render` path, scored per heading with
the two error directions separate: item 30/15/4 → 30/**0**/4; content-column 129/171/83 →
129/36/83; lifetime 51/46/23 → 51/**0**/23; block-quote 52/37/38 → 52/4/38; marker table
314/750/206 → 314/**1**/206; **setext** (the opposite polarity, measured in its own right)
36/60/36 → 36/**0**/36; and **275 blind adversarial documents from eight lenses** 58/25/49 →
58/20/49. **1,043 phantoms removed, ZERO new losses and ZERO new phantoms — proven at set
level, not by comparing counts.** Repo control: all four views over all 113 tracked md/qmd
files move on exactly one — the fixture this session edited — and the control is proven
**effective by injection**.

**FILED, NOT FIXED.** `INDENTED_CODE_LINE` tests a literal 4 spaces and is column-blind the
same way this row was, which accounts for 36 of the 41 residual phantoms; `ATX_HEADING`'s own
` {0,3}` loses an indented heading at column 4+; `A. x` is pandoc's initial-in-a-name rule and
we admit its column on purpose. Each is a real `- [ ]` line in `BACKLOG.md`.

- **Model:** claude-opus-5

### 2026-08-08 · [ad hoc] Session 188 — IMPLEMENTATION: pandoc classifies raw TeX by macro NAME too, in three classes (SHIPPED)

Replaced the bare `/^ {0,3}\\[a-zA-Z]/` row with pandoc's own raw-TeX macro classification,
transcribed from `Text.Pandoc.Readers.LaTeX` at **pandoc 3.6.3** (the build quarto 1.7.33
bundles) and then **measured entry by entry** — 736 candidate names in three contexts,
**5,680 documents** rendered through the real `quarto render` path.

**NEITHER GATE IS THE ONE THE FILED ITEM ASSUMED.** `endline` in the markdown reader carries
no raw-TeX guard at all; a paragraph is interrupted iff `inlineCommand'` FAILS, and its guard
is `isInlineCommand name || not (isBlockCommand name)`.

**736 names collapsed into exactly SIX measured behaviours — three classes:**

- **A — block in EVERY context** (73 names), the only class that interrupts an open paragraph.
  It splits three ways by **arity**: 20 block bare or with arguments, 46 block ONLY with an
  argument (`\section{x}` is a block; a bare `\section` is nothing), 7 block ONLY without one
  (`\par` is a block and `\par{x}` is NOT — the leftover group opens a paragraph).
- **B — block only where no paragraph is open.** The five names pandoc puts in BOTH lists on
  purpose (`clearpage hspace newpage pagebreak vspace`) plus every unknown macro. It is the
  default and needs no list.
- **C — inline in EVERY context** (294 names after arity re-verification).

**RESOLVES AN APPARENT CONTRADICTION ON THIS PROJECT'S OWN RECORD.** `RAW_TEX_ENV_OPEN`'s
docstring measured a bare macro INLINE against an open paragraph; `BACKLOG.md` measured the
same names as BLOCKS. Both were right — they measured different contexts.

**A CORPUS DEFECT CAUGHT BY A CONTROL, NOT BY A SWEEP.** The discovery probe gave every macro
a single `{x}`, which is malformed for a multi-argument macro, so `\newcommand` measured as
class C. Re-rendering all 316 class-C candidates at realistic arity (1,264 documents) found
**22** that are blocks at their true arity — `newcommand`, `renewcommand`, `providecommand`,
`parbox`, `rule`, `hypertarget`, `newtheorem`, `epigraph` and 14 more. Every one would have
been a deleted heading; `\newcommand{\foo}{bar}` is one of the eleven spellings the filed item
names. This is the class of error S184 shipped and needed a post-hoc sweep to find.

**SCORE, per heading, two directions separate:**

| corpus | PRE | **SHIPPED** |
|---|---|---|
| item — the filed item's own 11 spellings | 35 / 6 / **3** | **43 / 1 / 0** |
| env — environments | 4 / 4 / **2** | **6 / 2 / 2** |
| tail — 8 macros × 12 tails × 2 contexts | 114 / 61 / **17** | **154 / 38 / 0** |
| advflat — blind adversarial, 223 docs, 8 lenses | 135 / 47 / **41** | **164 / 38 / 21** |
| **TOTAL** (agree / phantom / LOST) | **296 / 119 / 63** | **375 / 80 / 23** |

**40 headings RECOVERED, 39 phantoms removed, and the new-loss set is EMPTY at set level** —
all 23 remaining losses are a strict subset of the 63 pre-existing.

**BOTH of the project's disclosed raw-TeX residuals are now closed.** Three unit assertions and
one INTEGRATION assertion inverted rather than deleted, each verified end to end — the crossref
one against quarto's own `Unable to resolve crossref @sec-tex` warning and rendered `?@sec-tex`
marker. `test/fixtures/closes-paragraph-narrow.qmd` re-rendered: quarto and this model now agree
on all 11 headings exactly.

**Two instrument defects found and fixed before scoring** (the fifth and sixth in this family,
both pointing the direction that makes a change look safe): macOS's case-insensitive filesystem
collapsed 62 name pairs and mislabelled the survivors; the inherited model-side probe filters to
`.qmd`, so a repo control over `.md` files silently covered 45 of 113 and still reported
"byte-identical".

**Scope split held (FM #26):** the adjacent ` {0,3}` INDENT item was declared out of scope at
claim and stayed out — and the adversarial sweep confirmed the cut, since its
container-content-column family is 7 of the 23 residual losses.

**Verification:** `check-types` 0 · `npm test` **1765 passed / 65 files** · `test:oracle`
**131 documents / 124 agree / 4 lost TP / 3 CARDINAL FP / 0 unrelated** (BYTE-IDENTICAL to
S180–S187) · `check-package` OK 42 files / **5.52 MB** (up from 5.51 — the 294-name list) · `test:integration` **499 passing / 0
failing / 0 pending, exit 0**, run BEFORE the close-out commit on the operator's go-ahead.
Repo control over all 113 tracked md/qmd files in all four views moves on exactly one, a
phantom removal quarto's own render confirms; proven effective by injection.

### 2026-08-08 · [ad hoc] Session 188 pre-flight — commit the methodology sync (v2.8.0 → v2.13.0), and close the packaging leak it opened

Committed the 11-file methodology framework sync that was sitting uncommitted in the working
tree at Session 188's Orient — 9 modified (`SESSION_RUNNER.md`, `BOOTSTRAP.md`,
`CLAUDE_TEMPLATE.md`, `RECOMMENDED_SKILLS.md`, four under `docs/methodology/`, and
`methodology_dashboard.py` **v2.8.0 → v2.13.0**) plus 2 new root files
(`FRAMEWORK_LEARNINGS.md`, `methodology_trim.py`). Not this session's deliverable — a
pre-flight action taken on operator instruction so the tree was clean and the release gate
green before work began (SAFEGUARDS Pre-Flight Checklist).

**⚠ PROVENANCE: this is a methodology-repo User Acceptance Test, written into this project
BEFORE being pushed upstream.** The committed copies are a **pre-release** canonical state.
If canonical changes before it is pushed, these files drift from the eventual released
version and `bin/sync` will refuse to overwrite them (BOOTSTRAP "Drift safety") until
re-synced with `--force` or reconciled by hand.

**The sync broke the release gate, and S174's gate caught it.** `node check-package.js`
**FAILED** at Orient: the two new root files are not named in `.vscodeignore`, which is a
**denylist** that names each methodology artifact individually (`SESSION_RUNNER.md`,
`methodology_dashboard.py`, …), so both would have shipped inside the `.vsix` — 44 files /
5.61 MB against a real extension of 42 / 5.51 MB. This is the third instance of the exact
class S174 built the deny-by-default gate for (`tsconfig.unit.json` at S173, `scratchpad/`
at S174), and the first where the new root files arrived from *outside* the project. Fixed by
adding the two missing denylist lines; `check-package` is **OK — 42 files, 5.51 MB**, byte-for-byte
S185/S186/S187's figures.

**This is itself a UAT finding for canonical:** adding root-level files to the distribution
silently breaks any adopter whose packaging gate is a top-level allowlist, and neither
`BOOTSTRAP.md` nor the sync guidance mentions the packaging surface.

**What the sync changes for sessions here:** the framework's learnings table moved out of
`SESSION_RUNNER.md` into the new `FRAMEWORK_LEARNINGS.md` (read on demand, not every
session); Phase 3D gains a requirement that the two **forward-looking** handoff fields
("What's next", "Gotchas") be derived or explicitly labelled a guess, since re-reading
cannot check a prediction; Phase 3F gains an optional **Model:** bullet convention; and
the dashboard's stale-version flag that S186 and S187 both carried is resolved.
`methodology_trim.py` is a new ledger trimmer (dry-run by default) for `CHANGELOG.md` /
`HANDOFFS.md` — installed, not yet used.

**Verification:** `check-types` 0 · `npm test` 1762 passed / 65 files · `check-package` OK
42 files / 5.51 MB. No source file touched.

### 2026-08-08 · [ad hoc] Session 187 — IMPLEMENTATION: pandoc classifies by tag NAME, in two sets, and the set names are the rule (SHIPPED)

Replaced CommonMark §4.6's tag list in `src/core/qmd/model.ts` with pandoc's own classification,
transcribed from `Text.Pandoc.Readers.HTML.TagCategories` at **pandoc 3.6.3** (the build quarto
1.7.33 bundles) and then **measured entry by entry** — six shapes across four contexts, **2,051
documents rendered through the real `quarto render` path**, plus a 219-document adversarial sweep.

**The rule is CONTEXT-DEPENDENT, and pandoc's two set names say so.** `blockTags`
(`blockHtmlTags ∪ blockDocBookTags ∪ epubTags`) is block in every context; `eitherBlockOrInline`
is block only where no paragraph is already open. Against an open paragraph 98 openers and 100
closers interrupt; with none open, 115 and 117. Three measured exceptions to the source:
`!DOCTYPE` (rejected by `htmlTag`'s own `isName` guard), and `textarea`/`title` (RCDATA — the
unclosed opener swallows the document, so it opens nothing while its CLOSER is block).

**Drains three filed items**, which were one artefact read in two directions: family (a) of
Session 183's deletion item (heading-DELETING, HIGH), the raw-HTML width row, and
`HTML_BLOCK_OPEN`'s list being CommonMark's rather than pandoc's.

**REFUTES the central claim of the filed item it implements.** `BACKLOG.md` asserted
"`<ins>x</ins>` opens a block and `<em>x</em>` does not" and listed thirteen further names as
block openers. Rendered, the two lines are byte-identical. Of the sixteen names the item listed,
only `meta`, `canvas` and `output` are in `blockTags`; the rest are `eitherBlockOrInline`.

**SCORE, per heading, two directions separate:**

| corpus | build | agree | phantom | LOST |
|---|---|---|---|---|
| designed, 2,223 docs | pre-S187 | 1467 | 303 | 453 |
| designed, 2,223 docs | **SHIPPED** | **2207** | **16** | **0** |
| adversarial sweep, 219 docs | pre-S187 | — | 105 | 111 |
| adversarial sweep, 219 docs | **SHIPPED** | — | **81** | **111** |

**453 headings recovered, 312 phantoms removed, ZERO deletions, ZERO new phantom classes.**

**The adversarial sweep found three DELETIONS and eight phantoms this session had introduced**,
none findable by any corpus it designed: every probe written here put the tag ALONE on its line,
so the TAIL of the line was an invisible axis. One root cause, three disguises — a tag line is a
block opener only if it ENDS AT a `>` or contains no `>` at all. A second axis: `eitherBlockOrInline`
needs column zero where `blockTags` tolerates 0–3 spaces.

**Scope split at claim (FM #26):** pandoc's block-MACRO list is a different artefact from a
different reader and was declared out of scope; the raw-TeX items remain open.

Commits: 1B claim `6fd3633`; C1 `eeec268`; C2 `84c1f73`; C3 `7c1e405`; C4 `7c44197`; C5 `3b293f2`;
close-out (this commit). Verification: check-types 0, compile 0, compile-tests 0, `npm test` 1762
passed / 65 files, `test:oracle` exit 0 — 131 documents, 124 agree, 4 lost TP, 3 CARDINAL FP, 0
unrelated (byte-identical to S180–S186), `check-package` OK 42 files / 5.51 MB, and **`test:integration`
499 passing / 0 failing / 0 pending, exit 0**. **Phase 3E RUN with explicit operator instruction,
after the close-out commit** (`41c4946`) rather than before it — out of protocol order, and recorded
as such. The two assertions this session INVERTED were watched BY NAME at lines 312–313 of the
captured log, through the real registered `DocumentSymbolProvider`.

### 2026-08-08 · [ad hoc] Session 186 — MAINTENANCE: the record said 97 MB, the disk said 2.5 GB, and the visible signal could not tell the difference (DONE)

Brought the uncommitted surface into a correct, recorded state. **Five actions, one intent** —
four commits plus one non-commit action (the prune leaves no tracked change, and is logged here
because FM #27 counts actions, not commits).

**Action 1 — `b54b583`, `chore(claude)`: committed `.claude/settings.json`.** One line,
`claude-opus-4-8` → `claude-opus-5`. The file's **only** prior commit in all of history is
`2f8084c` (2026-07-11), which created it — the model line had never once been bumped by a
commit, only carried dirty, for ~28 sessions since 2026-07-25. Nothing in the build, test,
type-check or packaging path reads it.

**Action 2 — `fe1e05b`, `chore(dashboard)`: committed four `dashboard_history.jsonl` rows.**
The Phase 0 orientation snapshots of Sessions 183, 184, 185 and 186. Last committed at
`8dd11a5` (S182); **20 commits had landed since without it**, while S174's and S175's notes
both assert it "rides this close-out commit". **Corrects a false premise seven earlier
receipts used to justify leaving it dirty** — "rewritten at every Phase 0, therefore noise"
is wrong: `methodology_dashboard.py` opens the file in **append** mode, so an uncommitted row
is *lost*, not regenerated. Carries the only record in the repo of `npm audit` going 2 → 6.

**Action 3 — non-commit: pruned 2,332 MB (91%) of regenerable byproduct from `scratchpad/`.**
2,600,816 KB → 212,460 KB; 52,796 → 19,788 files; 20,650 → 4,096 dirs. Deleted only
`*_files/`, `.quarto/`, `_site/`, `_book/` — the `quarto render` output in which each
~200-byte probe document carries its own full copy of the bootstrap/quarto JS+CSS bundle.
**Gated on a proven disjointness check, not on a pattern** (Learning #248): 78 `scratchpad/`
tokens extracted from tracked files → 38 still existing → 2,768 top-most delete-set dirs →
**zero** cited path inside the delete set → delete → **all 38 re-asserted present afterwards**.
Build matrix byte-unchanged across the operation: `compile` 0, `npm test` **1754 / 65**,
`check-package` **OK 42 files / 5.51 MB** — S185's close figures, exact.

**Action 4 — `6e2e2b7`, `docs(backlog)`: corrected the record at all four sites and filed
three findings.** The "~97 MB" figure was wrong by **26×** and appeared at two sites in
`BACKLOG.md`, in this file's S174 entry, and in `.vscodeignore`'s decision comment. The item's
other claims failed in the same direction: its growth model understated by ~15× on average and
**130×** for `s183` alone (39,069 files), and its description of the contents was wrong **in
kind** — 90% of the bytes were regenerable render output, not "probe scripts and fixture trees".
**Two of S174's three non-gitignore premises survive measurement** (it does cost exactly one
line; it does mask no other stray file — all 51,873 untracked-and-unignored files were under
`scratchpad/`, zero elsewhere); **the third fails, and it is the load-bearing one — the signal
is SIZE-BLIND.** A collapsed `?? scratchpad/` line is byte-identical at 97 MB and at 2.5 GB.
The S174 decision stands; the figure was never a measurement (Learning #247).

**Filed, not fixed** (each a real `- [ ]` in `BACKLOG.md`): (1) **51% of the `scratchpad/`
paths cited by tracked documents already dangled** — 40 of 78, *before* this prune, which lost
zero — including two findings documents cited by committed planning docs; a structural
durability defect whose exposure is **live** in the current S185 receipt (Learning #249).
(2) **`.vscode-test/` is 18 GB** — 7.2× scratchpad — and being gitignored has **no** visible
signal at all; only `1.129.0` is pinned (`test/integration/runTest.ts:38`) and
`test/lsp/runTest.ts` pins nothing, which is how four downloads accumulated. (3) **`npm audit`
2 → 6**, devDependency-only, all `fixAvailable`, production tree empty.

**Scope held (1 and done):** no source logic was touched, so the strict-TDD gate does not fire
(`CLAUDE.md`'s declarative/no-logic exemption); the verification owed instead — that the build
matrix is byte-unchanged — was measured at both ends. The `.vscode-test/` 18 GB finding was
**filed, not acted on**, and no backlog item was started.

**Learnings #247–#249** added to `PROJECT_LEARNINGS.md`.

### 2026-08-03 · [ad hoc] Session 185 — IMPLEMENTATION: the indent is not part of pandoc's html-block rule, and a line block continues (SHIPPED)

Recovered **184 of the real ATX headings Session 183's `paragraphOpen` gate deletes, adding
ZERO deletions**, measured per heading in both directions over **465 documents** rendered
through the real `quarto render` path (quarto 1.7.33) across eleven corpora:
pre-S183 113 phantom / 128 lost · pre-S185 35 / 239 · **SHIPPED 42 / 55** — better than the
pre-Session-183 build in *both* directions.

**(b) `HTML_BLOCK_OPEN`'s indent cap was never a model of anything.** The filed item described
family (b) as a `{0,3}`-versus-4-space boundary where "the gate suppresses the closer"; a
nine-rung indent ladder refuted both halves. Pandoc's html-block rule does not look at leading
whitespace at all — `<div>` against a two-line open paragraph releases the heading below it at
0/1/3/4/5/6/8 spaces, one tab, two tabs, space+tab and tab+space alike, while `<span>`, `<em>`
and `<not-a-tag` release it at none of them — and the opener alone deletes, with no closer
needed. The class became `[ \t]*`. The TAG remains the whole rule.

**(c) A pandoc LINE BLOCK's continuation line no longer opens a paragraph.** New state, each
guard its own RED and each measured: the block may only open where no paragraph already is; a
pipe TABLE's body row is spelled identically so a table RULE row (pipe delimiter *or* grid
border) disarms it; the opener is `|` + space-or-tab + content at column 0, with `|line one`,
a bare `|`, `| `, `|  ` and every indented `|` measured NOT to be line blocks; and the sticky
table flag clears at every region boundary that ends a block, not only at a blank line.

**The session's own mutation pass produced a mutant more correct than the code.**
`LINE_BLOCK_CONTINUATION` was written `/^[ \t]+\S/` on the reasoning that a continuation "must
have content"; pandoc's rule is only that the line begins with whitespace, and the `\S` deleted
four real headings on lines whose sole content is a form feed, a vertical tab or a
non-breaking space. Corrected, and pinned.

**A 12-lens adversarial sweep (193 documents, written by agents that did not design the
corpora) found ZERO deletions on every lens** — the check Session 184's sweep failed. It found
seven new phantoms; four proved PRE-EXISTING by rendering the column-0 twin against three
builds, and three were fixed. Mutation pass: 24 mutants, 24 killed, 0 survivors.

Filed, not fixed: an unclosed condition-1 tag swallows the document; `HTML_BLOCK_OPEN`'s tag
list is CommonMark's rather than pandoc's; a whole-line HTML comment does not close a pandoc
paragraph and `COMMENT_FULL_LINE` treats it as if it does; a setext underline below a
continuation is invisible (and the obvious fix is measured to invent a heading).

Verified: check-types 0, compile 0, compile-tests 0, `npm test` 1754/65, `test:oracle` exit 0
(byte-identical to S180–S184), `check-package` OK 42 files / 5.51 MB, `test:integration` 499
passing exit 0 with the new Outline pin watched by name in the captured log.

### 2026-08-02 · [ad hoc] Session 184 — IMPLEMENTATION: CLOSES_PARAGRAPH's rows match the construct, and two "obvious" narrowings are refuted (SHIPPED)

Session 183 fixed *when* `CLOSES_PARAGRAPH`'s rows apply. This session asked *what* they
match — and found that the more important defect ran the other way.

**Session 183 shipped a heading-DELETING regression, and this fixes 20 of it.** Its gate
hoisted `HTML_BLOCK_OPEN` ahead of the `paragraphOpen` bail, but that constant carries
CommonMark §4.6 **condition 6** only, so `<pre>`, `<script>`, `<style>` and `<textarea>` —
condition 1 — fell through to the gated wide row: their opener closed the paragraph, their
BODY line opened a new one, and their CLOSER was suppressed by the bail, leaving a paragraph
open across the heading below. `<pre>` / `code` / `</pre>` / `# ATX Below` renders
`<pre>code</pre><h1>ATX Below</h1>`; we rendered nothing. Those four tags now sit in the
hoisted interrupter, where measurement says they belong.

**One narrowing shipped.** The link-reference row excludes only a VALID footnote label — `^`
then one or more characters that are neither whitespace nor another `^` — a rule derived from
an exhaustive sweep of 17 label spellings on the real render path.

**Two narrowings were built, scored clean, and then REFUTED by an adversarial sweep.** Both
the raw-HTML and raw-TeX narrowings scored **ZERO headings lost over 476 rendered documents**
and were measured **deleting 31 real headings** once 121 shapes no corpus contained were
rendered: `<meta>`, `<svg>`, `<button>`, `<video>`, `<audio>`, `<canvas>`, `<object>`,
`<embed>`, `<noscript>`, `<map>`, `<output>`, `<progress>`, `<area>`, `<applet>`, `<ins>`,
`<del>` all open raw HTML blocks outside CommonMark §4.6, and `\vspace{1em}`,
`\usepackage{…}`, `\newcommand{…}`, `\setlength{…}`, `\definecolor{…}`, `\newpage[2]`,
`\newpage{}`, `\clearpage\newpage` are all raw BLOCKS despite carrying braces. Pandoc
classifies both by NAME, not by the shape of the line. Both rows reverted to wide.

**Three prescriptions the filed item proposed are measured WRONG**, each now pinned: requiring
a LEADING pipe deletes 4 real headings (pandoc pipe tables need no leading or trailing pipe);
excluding a LONE `+` deletes 6 (a bare `+` is an empty list item and really is block-level);
and borrowing `OPENS_FRESH_BLOCK`'s link-ref fragment deletes a 5th by rejecting `[]:`.

**The mutation pass found a real question and the answer was no.** Forbidding the raw-TeX
row's 0-3 space indent is measured MORE correct at top level (3 phantoms) and wrong inside a
LIST ITEM, where content sits at column 2 and `\clearpage` really is at its block's column 0.
It deleted 1 real heading, so it was implemented, measured and rejected.

**THE MEASUREMENT.** 597 documents rendered through the real `quarto render` path (quarto
1.7.33), scored per heading with the two error directions separate:

| build | phantoms | lost headings |
|---|---|---|
| pre-Session-183 | 325 | 38 |
| Session 183 (baseline) | 186 | 78 |
| Session 184 first try | 143 | 107 (rejected) |
| **SHIPPED** | **180** | **57** |

Better than the baseline in BOTH directions, and **zero deletions introduced by this session**
(provenance established per document against three builds). Over the repo's 110 tracked
md/qmd files all four views are byte-identical, with the control proven EFFECTIVE by
injection. Mutation pass: 18 mutants, 0 survivors, restore verified by content. Oracle exit 0
— 131 documents, 124 agree, 4 lost TP, 3 CARDINAL FP, byte-identical to S180–S183.
`check-package` OK, 42 files / 5.51 MB. Integration suite **498 passing, exit 0**, with the
new Outline pin watched by name in the captured log.

### 2026-08-02 · [ad hoc] Session 183 — IMPLEMENTATION: CLOSES_PARAGRAPH's remaining nine rows are gated on an OPEN paragraph (SHIPPED)

Session 182 gated the thematic-break row on `!paragraphOpen` and deliberately left the other
nine ungated, because gating them blind is the heading-DELETING direction. This audits all
nine against the real renderer and gates them.

**The defect was never one row.** All nine ignored `paragraphOpen`, so every exempt construct
closed a paragraph even where pandoc treats it as LAZY CONTINUATION. Measured over **241
documents** rendered through the real `quarto render` path — three corpora (104 one-line
constructs, 42 well-formed multi-line constructs, 96 container variants), scored per HEADING
with both error directions reported separately:

| | phantoms (we invent) | lost (we delete) |
|---|---|---|
| before | 133 | 21 |
| after | **68** | **21** |

**65 phantoms removed, ZERO added, ZERO real headings lost.** All 21 "lost" are EMPTY-titled
headings this model deliberately declines to emit — unchanged, and not lost content.

**Gating alone is neither sufficient nor safe.** Three construct classes genuinely interrupt an
open paragraph and are hoisted ahead of the bail, each because gating it was measured to delete
real headings:

* **HTML block openers** — `<div>` makes the prose above it stop being a `<p>`; `<span>` does not.
* **Raw TeX ENVIRONMENTS** (`\begin{…}`/`\end{…}`) but **not** bare macros — `\begin{center}`
  interrupts, `\clearpage` does not. The `\end` half matters: it is the line directly above
  the heading.
* **CLOSER lines** (`:::`, `...`) — structural, and the subtlest finding: a closer follows its
  own construct's CONTENT, so to a per-line scanner with no block nesting it ALWAYS looks like
  it faces an open paragraph. Gating them deleted four real headings.

And the gate is **suspended inside a block quote**: measured, `> quoted one` / `    ---` /
`# ATX Below` renders `<h2>quoted one</h2><h1>ATX Below</h1>`, because in a quote's lazy
continuation a 4-space-indented `---` IS a setext underline. This model has no block-quote
context and got that right only by accident; the gate would have turned the accident into a
deleted heading.

**Five of Session 180's DISCLOSED RESIDUAL phantoms are now fixed**, and their stated
justification is refuted: they claimed tightening would delete `SESSION_NOTES.md`'s "Session 83
Handoff Evaluation" heading. Rendered, quarto swallows that line into the paragraph above it —
it was a phantom, caused by a `|` inside an inline-code regex firing the wide `/\|/` row.

**Two instrument defects were found and fixed**, both by the adversarial pass, both in the
harness inherited from Session 182. `<pre>` was tokenised as an empty `p:`; far worse, container
tags were paired with a lazy closing match, so one match consumed a whole `<blockquote>`/`<table>`
and every heading nested inside it vanished from the data — reporting "quarto emits no heading"
where quarto emits one, the exact direction that makes a heading-deleting change look safe.
Every figure taken before the fix was void and re-measured.

TDD: three behaviours RED→GREEN, each RED confirmed for the right reason; two of the three REDs
were regressions this session's own GREEN introduced, one caught by Session 180's pre-existing
pins and one by a shape the adversarial pass found that neither corpus contained. Adversarial
pass: 13 mutants, 7 survivors on the first run, every one then MEASURED wrong against quarto
(none was more correct than the shipped code) and pinned; re-run 13/13 killed.

Verification: check-types 0, compile 0, compile-tests 0, `npm test` **1730 / 65**,
`test:oracle` exit 0 (131 documents, 124 agree / 4 lost TP / 3 cardinal FP / 0 unrelated —
byte-identical to Sessions 180, 181 and 182, so zero diagnostics regression), `check-package`
OK 42 files / 5.51 MB, **`test:integration` 497 passing, exit 0** in a real Extension
Development Host. Repo control over 109 tracked md/qmd files and all four views: exactly ONE
change, the `SESSION_NOTES.md` phantom above, removed. Learnings #235–#238.

### 2026-08-02 · [ad hoc] Session 182 — IMPLEMENTATION: an `=` run is paragraph text, and a thematic break needs a closed paragraph (SHIPPED)

`CLOSES_PARAGRAPH` carried two rows that had never been scored individually — Session 180
scored the list as a whole against a corpus. Both are wrong, in opposite ways, and the
obvious repair of the first deletes real headings.

The `=+` row claimed an `=` run closes a paragraph. It is reachable only at
`consecutiveBody !== 1`, and measured on the real `quarto render` path every such position
renders the opposite: the run is ordinary paragraph **text**, so the paragraph stays open and
the `#` line below is swallowed as continuation — **30 phantom headings across 7 of the 10
reachable positions**. Row removed.

The thematic-break row is right only where **no paragraph is open**. Against an open one
`***`, `___`, `---` and their spaced spellings are lazy continuation — the `---` spelling
proves it outright by rendering as an **em dash**, which only happens to paragraph text —
for **34 more phantoms**. The row is lifted out of the list and gated on `!paragraphOpen`,
the same rule `INDENTED_CODE_LINE` documents and `opensFreshBlock` already applies. The
other nine rows are deliberately **not** gated: they are unmeasured against an open
paragraph, and gating them is the heading-deleting direction.

**Removing the `=+` row alone deletes 5 real headings.** Pandoc swallows an ATX line into a
setext heading when a run follows it directly — `# Heading Above` / `===` renders
`<h1># Heading Above</h1>`, literal `#` and all — and that swallow closes the block, making
the heading below it real. This model declines the swallow, so the closure is recovered
explicitly via `prevWasAtxHeading`. Its `-` half additionally recovers **3 pre-existing lost
true positives**: `-` and `--` are too short for the thematic-break row, so nothing ever
matched them.

**The scoring metric was blind before the corpus was.** Comparing heading SETS for equality
reported "0 rows broken" for the shipped candidate; four documents already differed for an
unrelated reason, and a row that is already unequal cannot become more unequal. Re-scored
per heading with both error directions reported separately, that candidate was deleting five
real headings.

**The mutation pass found two live bugs that 220 rendered documents and 1724 unit tests had
both passed** — the ATX-adjacency regex borrowed ` {0,3}` from `SETEXT_H1` where the indent is
correct (the swallow needs column 0, so ` ===` invented a heading), and the adjacency flag was
cleared at the foot of the scanner loop, which every `continue` path skips, so it leaked
across blank lines and whole fenced regions. 19 mutants, 5 survivors, all real; re-run 19/19
killed.

Measured against a pre-S182 build from `git archive 01b85d9` over **220 rendered documents**:
**85 phantom headings removed, 0 added, 3 lost true positives recovered, 0 real headings
lost.** Over the repo's 108 markdown/qmd files all four views — headings, cells, outline,
refs — are byte-identical; that control was proven effective by injection, and the probe
baseline cross-checked against the git-archive build (0 mismatches / 204 documents).

Three behaviours driven RED→GREEN, the second being the regression the first GREEN
introduced. `test:oracle` byte-identical to Sessions 180 and 181 — zero diagnostics
regression. ⚠ `test:integration` did **not** reach exit 0: the new pin passed in both runs
with 495 tests alongside it, but two runs failed on disjoint, unrelated tests (render
timeouts, then a semantic-tokens call count) — nondeterminism this session partly caused by
leaving quarto slow after ~400 renders. Not measured against the pre-S182 baseline.

Learnings #231–#234.

### 2026-08-02 · [ad hoc] Session 181 — IMPLEMENTATION: a setext underline may claim the line below a block construct (SHIPPED)

A setext underline was recognized only at `consecutiveBody === 1` — the line above had to be
the first line after a blank. Any block-level line above the title inflated the counter, so
the underline was never inspected and the heading was dropped from the outline, breadcrumbs,
sticky scroll, workspace symbols and the **cross-reference index**. Quarto renders it:
`    indented code` / `Setext Title` / `===` is `<h1>Setext Title</h1>`, and `@sec-`
references to such a heading resolve to real links.

**The obvious implementation deletes headings, and only a pre-existing pin caught it.**
Resetting the counter AT the block line passed the filed defect's RED and every test written
for it — and silently deleted a heading the previous build got right. A setext underline
directly below a block line claims THAT line, overriding the block reading: `    indented
code` / `===` renders `<h1>indented code</h1>`, and `***`, `___`, `##`, `| a | b |`,
`[x]: url` and `\clearpage` all behave the same way. The shipped rule is a one-line
**deferral** — a block line makes the line BELOW it a fresh paragraph start and keeps its own
claim — with one measured exception: an indented run of 2+ lines is firmly code. Session 180's
M8 pin is what red-flagged the regression.

**The two lists have opposite safety polarity and must never be unified.** `CLOSES_PARAGRAPH`
is deliberately permissive because a pattern it misses DELETES an ATX heading;
`OPENS_FRESH_BLOCK` is deliberately restrictive because a pattern it wrongly includes INVENTS
a setext heading. Reusing `closesParagraph` here — the instinctive one-liner — manufactures
**24 measured phantom headings** (`:::`, `+---+`, `a | b`, `[^1]:`, `<span>`, `...`, `===`).
A mutant pin kills that substitution.

**Measured:** 136 documents through the real `quarto render` path across six corpora, replayed
against the pre-S181 build (`git archive 66cacc2`): **81 agree / 40 lost TP / 12 phantom →
116 / 5 / 12** — 35 rows toward quarto, **0 away**, phantom count identical on both sides. Over
the repo's 109 markdown/qmd files (2140 headings) all four views — headings, cells, outline,
refs — are byte-identical; that control was proven effective by injecting a known-divergent
document. Adversarial pass: 17 mutants, 5 survivors, all real, all closed and re-killed.

Gate: check-types 0, compile 0, compile-tests 0, unit **1716 passed / 65 files**, `test:oracle`
exit 0 (131 documents, 124 agree / 4 lost TP / 3 cardinal FP — byte-identical to Session 180),
`check-package` OK 42 files / 5.51 MB, `test:integration` **495 passing, exit 0** in a real
Extension Development Host.

Filed, not fixed (each measured): Session 180's `=+` entry in `CLOSES_PARAGRAPH` is wrong in
all three positions where it is reachable (four phantom rows); its thematic-break entry is
pinned by nothing; and three items Session 180 reported as "filed" never reached `BACKLOG.md`.

### 2026-08-02 · [ad hoc] Session 180 — IMPLEMENTATION: an ATX heading cannot interrupt an open paragraph (SHIPPED)

Quarto renders with pandoc's `markdown` dialect, where `blank_before_header` is on by default: an
ATX heading pressed directly against a preceding non-blank line is paragraph continuation, not a
heading. Our `ATX_HEADING` test was applied to any body line with no such rule, so we emitted a
**phantom heading** — into the outline, breadcrumbs, sticky scroll, workspace symbols, and into the
**cross-reference index**, where a phantom `{#sec-methods}` became a completion and go-to-definition
target for a link `quarto render` emits as `?@sec-methods`, its unresolved-reference marker.

**The filed prescription was measurably wrong, in the direction that deletes user-visible content.**
The item said "a one-line adjacency test in `computeRegions` — a heading needs a blank or a region
boundary above it". Built on a scratchpad copy of `src` and scored against the real renderer, that
rule moves **10 documents toward quarto and 5 away**: a heading below a thematic break, a pipe-table
row, an indented code block, a link-reference definition or a raw HTML block is REAL, and the naive
rule deletes it — including, on this repo's own 108 markdown/qmd files, `SESSION_NOTES.md`'s
"Session 83 Handoff Evaluation" heading. The rule shipped is pandoc's instead: a heading may not
interrupt an **open paragraph**. `paragraphOpen` is deliberately SEPARATE state from
`consecutiveBody`, which serves the setext disambiguation — folding them changes which setext
underlines are recognized.

**`CLOSES_PARAGRAPH` is permissive on purpose, and the asymmetry is load-bearing.** A line it misses
deletes a heading quarto really renders; a line it matches too eagerly merely retains a pre-existing
phantom. Five such residuals are measured, disclosed and pinned as KNOWN RESIDUAL; closing any of
them costs a measured real heading (the "precise table" variant closes one phantom and deletes one).

**`blank_before_header` is a DEFAULT, not an invariant.** A front-matter `from:
markdown-blank_before_header`, `markdown_strict`, `gfm` or `commonmark` — or a nested per-format
`format:`/`  html:`/`    from:` — really does bring the heading back, all four measured on the real
render path; without a bail this change becomes a real-heading deletion on those documents. The bail
keys on the key's presence, not on resolving the dialect, so it fails closed. `reader:` was proposed
by the adversarial pass and **refuted by measurement** — quarto rejects that key outright (exit 1).

Measured by replaying the pre-S180 build (`git archive 4b0125e`) over **92 documents rendered through
the real `quarto render` path**: **24 rows toward quarto, 0 away, 10 retained residuals.** Over the
repo's **108 real markdown/qmd files (2133 headings)** all four views — headings, cells, outline,
refs — are **byte-identical**. `quarto pandoc -f markdown` was proven unfaithful for cell fences and
was not used as the oracle. Three behaviours driven RED→GREEN, plus a fourth RED supplied free by an
existing pin. The adversarial pass ran 21 mutants; **3 survived and all three were real holes**,
each closed with the document where the two implementations first diverge. Re-run: 21 of 21 killed.
`test:integration` **494 passing, exit 0** in a real Extension Development Host, including a new pin
that queries the registered `DocumentSymbolProvider` the Outline view itself calls. The oracle is
unchanged at 131 documents / 124 agree / 4 lost TP / 3 cardinal FP — zero diagnostics regression.

### 2026-08-02 · [ad hoc] Session 179 — IMPLEMENTATION: a fence quarto never closes is not a code block at all (SHIPPED)

Three **cardinal-sin false positives** and one **lost true positive**, from a single rule with two
halves the filed item named separately. Quarto closes a cell only on a fence whose backtick run is
EXACTLY the opener's — `breakQuartoMd`'s `line.match(endCodeRegEx)[1].length === inCode`, read out of
the installed 1.7.33 — where CommonMark, and so our `isCloser`, accepted any run at least as long;
and an unterminated cell was emitted as a cell running to end of document. Measured vs 1.7.33 with
the 3/3 twin at exit 1: a 3-tick/4-tick, a 4-tick/3-tick and an unterminated cell all render **exit
0** and all three were flagged.

**The defect had a second user-visible surface nobody had filed.** `breakQuartoMd` never pushes the
opening fence into its line buffer, so a cell it never closes is emitted by the final
`flushLineBuffer("markdown", …)` WITHOUT the opener: quarto **deletes** it and everything below is
ordinary markdown. All three shapes render the body as a paragraph, none is executed, and a heading
below each is a real `<h1>` — while our model ran two of the three to EOF. On the pre-S179 build a
`# Top` document with a 4-tick/3-tick cell produced the outline `[{Top → children: ["```{r}"]}]`:
both sections gone from the outline, breadcrumbs and sticky scroll.

The gate is uniform across both fence kinds because that is what the renderer implements — pandoc's
`markdown` (quarto's dialect, not `commonmark`) requires a fence to be CLOSED or it is not a code
block, measured at line 0, after a blank, and mid-paragraph. Only the closer's LENGTH rule stays
split: plain `>=`, cell `===`. A closer INDEX keeps the now-universal lookahead affordable
(0.7 ms → 162 ms → 2.1 ms per scan on a 2000-opener document).

Replayed the pre-S179 build over the same 131-document corpus: **119 agree / 5 lost TP / 6 cardinal
FP → 124 / 4 / 3.** Four rows changed, all toward agreement, **zero regressed**. Verified in a real
Extension Development Host (`test:integration` 493 passing) and, for the outline half, against the
pre-fix build headlessly. The operator ratified the shared-scanner fix site over the S177
`collectValueSources` seam, and ratified removing the runnable-while-typing affordance that five
tests deliberately encoded. Learnings #220–#222.

### 2026-08-01 · [ad hoc] Session 178 — IMPLEMENTATION: an indented cell fence is a cell to quarto (SHIPPED)

Five **lost true positives**: quarto's cell opener is `^\s*(```+)\s*\{([=A-Za-z]+)( *[ ,].*)?\}\s*$`
— leading whitespace **unbounded**, tabs included — and its closer `^\s*(```+)\s*$`, where
CommonMark's fence rule, and so our `FENCE_OPEN`/`FENCE_CLOSE`, caps both at 3 spaces. An
indented cell was therefore validated by quarto and invisible to us. Filed by Session 172.

**The filed item's CAUTION was the thing measurement refuted, not its defect.** The item warned
that adopting `\s*` would turn a fence inside an indented code block into a cell "for the outline,
run-cell, virtual documents and highlighting, which is the widening direction" — and rated the
whole thing LOW, "non-idiomatic input". Grounded firsthand vs 1.7.33: a fully indented ```` ```{r} ````
fence+body, placed after a paragraph and a blank line so it sits in genuine CommonMark
indented-code context, is **EXECUTED by knitr** — a `6 * 7` body printed `[1] 42` into the
rendered HTML. There is no documentation idiom for Quarto to protect; an author cannot show a
cell as literal example text by indenting it. A list-nested indented cell renders as a properly
highlighted code cell, so indented cells are a legitimate idiom we were blind to at 4+ spaces.
The prior decision the caution rested on (Learning #14(b), where an adversarial review ADDED the
3-space cap) was reached from CommonMark reasoning before anyone measured quarto — and its two
test pins survive today only because their fixture's fence is UNCLOSED, a shape quarto also
declines to treat as a cell. The fix site went to the operator with the measurements attached
and was ratified before any code.

**Scoped to quarto's own asymmetry.** Only the CELL opener and the CELL closer widen; quarto's
PLAIN fence opener is `^```` (column 0), so a non-cell fence keeps CommonMark's cap and the
region model is otherwise byte-identical. And an indented cell must be **CLOSED**: quarto flushes
an unclosed fence's lines as markdown and builds no cell (measured exit 0 against its closed
twin's exit 1), so opening one would have manufactured a brand-new cardinal false positive —
which this session's own first implementation did, until its control caught it. The column-0
unterminated cell keeps its runnable-while-typing affordance unchanged.

**THE measurement.** Replaying the pre-S178 build (`git archive ff6d7a8 src` → `QMD_ORACLE_SRC`)
over the same 121-document corpus: pre-S178 **109 agree / 9 lost TP / 3 CARDINAL FP**, this build
**114 / 4 / 3**. Five lost true positives recovered, the cardinal-FP count **identical** on both
sides, zero rows regressed — and all five CONTROL rows are `agree` on **both** builds, which is
what makes "no new false positive" a measurement rather than a hope for a change that can only
ever ADD flags.

**The adversarial pass found two holes in this session's own pins.** Five mutants, each verified
to have landed before its result was read. Two died at both levels. Two survived: removing the
`CELL_INFO` gate survived all 1636 unit tests — *including the control written for exactly that
mutant*, whose fixture had an indented closer and so let the mutant decline for the wrong reason
— and was caught only by an oracle row; and narrowing quarto's `\s` indent class to `[ \t]`
survived unit AND corpus entirely, though a form feed, a vertical tab and a **no-break space**
indent each render exit 1 (NBSP being what pasting indented code out of a rendered web page
produces). Both are now closed at both levels. A third (tilde fences) was measured EQUIVALENT for
the cell surface and deliberately left unkilled.

Three behaviours driven RED→GREEN with the RED confirmed for the right reason each time; the
first GREEN arrived for the WRONG reason (an unterminated cell running to EOF) and one
`findAllCells` call exposed it. Verified in a real Extension Development Host: `test:integration`
**492 passing**, including a new pin asserting the exact diagnostic line set on an indented cell,
its plain-fence control and its unterminated control. Filed, not fixed: the fence closer's LENGTH
rule diverges from quarto in both directions (two further measured cardinal FPs).

Files: `src/core/qmd/model.ts`; `test/unit/qmd-model.test.ts`; `test/unit/yaml-value-flags.test.ts`;
`test/oracle/corpus.ts`; `test/oracle/baseline.json`; `test/integration/suite/yaml-value-diagnostics.test.ts`;
`test/fixtures/yaml-value-diagnostics/indented-cell.qmd`; `PROJECT_LEARNINGS.md` #217–#219.
Commits `6d1e382`, `2e61ed2`, `0862150`, `1313a18`, `1ff7102`.

### 2026-08-01 · [ad hoc] Session 177 — IMPLEMENTATION: a column-0 `---` swallows the cells below it (SHIPPED)

A live **cardinal false positive**: quarto validates NOTHING inside a YAML region, and we
squiggled cells that fall in one. Filed by Session 171 for the INDENTED-opening case;
measurement found the same root cause behind **five** more shapes and closed **six**.

**The mechanism, read out of the installed 1.7.33 rather than from the filed description.**
`breakQuartoMd`'s `yamlRegEx` is `/^---\s*$/` — anchored at COLUMN 0 **and tested on every
line, not only line 0** — and a fence builds a cell only when `inPlainText()` (`!inCodeCell &&
!inCode && !inYaml`). So any column-0 `---` opens a region that swallows every cell below it
until the next one, and `partitionCellOptionsMapped` never runs inside it. The single exemption
is `isYamlDelimiter`'s `skipHRs` arm — a `---` with a blank line BOTH above and below is a
thematic break — and it is **asymmetric**: `skipHRs` is passed `!inYaml`, so a blank-surrounded
`---` still CLOSES an open region.

**What the filed item got wrong, and how it was caught.** Its prescription — and S176's receipt
repeating it — said to teach cell ENUMERATION the rule in `core/qmd/model.ts`. Measured, that
site is wrong: the swallow belongs to quarto's VALIDATION pass, not to the document. The
rendered HTML of a swallowed document still carries the cell as a real highlighted code cell
(knitr executes it, pandoc emits it, and the `#|` line is consumed as an option rather than
printed), so teaching `findAllCells` the rule would have dropped real, runnable cells from six
consumers — outline, cell-background, refs, diagram-regions, virtual-doc and run-cell — on
documents quarto renders successfully. The seam chosen instead is `collectValueSources`, whose
ONE product consumer is the squiggle. Operator ratified the divergence before any code.

**Measured, not derived.** Replaying the pre-S177 build (`git archive 4907e2f src` →
`QMD_ORACLE_SRC`) over the same 111-document corpus: pre-S177 **97 agree / 4 lost TP / 9
CARDINAL FP**, this build **104 / 4 / 3**. Six cardinal false positives closed, zero lost true
positives, zero rows regressed — and all seven CONTROL rows are `agree` on BOTH builds, which is
what makes "no lost TP" a measurement rather than a hope.

**Adversarial pass on its own change** (the first in six sessions): three mutants run against the
new pins. Dropping the HR exemption and dropping fence tracking each died at both the scanner and
the document level; inverting the exemption's open/close asymmetry died at the **scanner level
only**. That gap was closed with a measured document (`---`/`title: t`/blank/`---`/blank/cell
renders exit 1) plus a corpus row, and the mutant now dies at both levels.

New: `src/core/qmd/quarto-yaml-regions.ts` (pure), `test/unit/quarto-yaml-regions.test.ts`.
Commits `b8b8d27` (fix, RED→GREEN), `46aa8f2` (corpus + baseline + scanner pins), `8c8597a` (the
asymmetry pin), `78f34d9` (learnings #214–#216). Verified: `compile` 0, `compile-tests` 0, unit
**1626 passed / 65 files**, `test:oracle` exit 0, `check-package` OK 42 files / 5.50 MB. Phase 3E
runtime verification offered and declined by the operator — see the handoff for the limitation.

### 2026-08-01 · [ad hoc] Session 176 — DOCUMENTATION FIX: `CLAUDE.md`'s Tech Stack section states the stack that was built (SHIPPED)

The twin of Session 175's fix, ~11 lines above it in the same auto-loaded file. The section
described an intended default awaiting ratification — *"Not yet scaffolded — the stack below is
the intended default, to be ratified in the first planning session"* — and left open an
architecture question that was answered long ago: *"`vscode-languageclient` / LSP if a
language-server architecture is chosen"*.

**The claim this session inherited was its own, and it was wrong.** The BACKLOG item Session 175
filed — written by the same author — says the extension *"ships zero runtime npm dependencies"*.
`package.json` does have no `dependencies` key at all, but `katex` and `markdown-it` sit in
`devDependencies`, and "devDependency" answers a build-time question, not a shipping one. Measured
against the **built bundles** rather than the manifest:

- `dist/extension.js` mentions `markdown-it` **0** times. Both `src/` imports are `import type`,
  erased at build; the instance comes from VS Code's own `vscode.markdown-it-renderer` — the only
  string `dist/notebook-renderer.js` actually contains.
- `katex` appears in `dist/extension.js` only as references to the **vendored** `media/katex/`
  assets served to a webview, never as a bundled library.
- `vscode-textmate` / `vscode-oniguruma`: **0** in both bundles (test-only).

So the accurate statement is *"nothing is installed from npm at runtime"*, with the two apparent
exceptions named and explained — not "zero runtime dependencies". A second inherited claim was
imprecise the same way: that item says `vscode-languageclient` *"appears nowhere in the repo"*; the
sweep found it in four `docs/planning/*` records. What is true, and what the file now says, is that
it is in neither `package.json` nor any source file.

Everything else re-measured rather than assumed correct for looking plausible: `engines.vscode`
`^1.90.0` with `vscode` marked external and never bundled; two esbuild bundles (cjs/node18 and
esm/browser); **the Quarto CLI is the one external program the extension runs** — all six `spawn()`
call sites take their binary from `quarto/cli.ts`'s `configuredBinary()`, and no site passes a
hard-coded literal; `src/core/` imports `vscode` **nowhere**, which is what confines it to
`src/extension.ts`, `src/features/`, `src/providers/` and `src/quarto/` and makes the bulk of the
project headlessly unit-testable; KaTeX / Mermaid / Graphviz ship as vendored static assets under
`media/`, each disclosed in `NOTICE`.

**The change resolved a disagreement rather than creating one.** `README.md:167` independently
states *"No language server is bundled, and none is required"*; the governing file now agrees with
it. No placeholder framing remains in any live artifact.

Closes the filed item. One new item filed: `CONTEXT.md:43` still records the language-support
decision as *"RESOLVED (Session 1, awaiting operator ratification)"* — the decision content is
accurate and matches what shipped, but ~175 sessions of work under that architecture is the
ratification, and a settled decision framed as provisional invites a future session to reopen it.

### 2026-08-01 · [ad hoc] Session 175 — DOCUMENTATION FIX: `CLAUDE.md`'s Build/Test/Verify section describes the real build (SHIPPED)

`CLAUDE.md` is auto-loaded into every session's context before the session reads anything
else, and `SAFEGUARDS.md` makes its "build equivalent" the command a session runs after every
substantive change. That section was still a placeholder from before the extension was
scaffolded — *"Placeholder until the extension is scaffolded. Once it exists, the build
equivalent … is expected to be:"*, after ~170 sessions — and it annotated `npm test` as
`@vscode/test-electron`. It is **vitest** over `test/unit`; `@vscode/test-electron` is
`npm run test:integration`.

**`CLAUDE.md` had been contradicting itself the whole time.** Line 100, in the TDD section,
has always said it correctly — *"unit-tested headlessly with `npm test` (vitest); `vscode`
adapters are verified with `@vscode/test-electron`"* — 60 lines below the block that denied
it. A session reading top-down met the wrong claim first. The cross-reference sweep over the
derived corpus (373 tracked files minus the four append-only history files) found the wrong
claim in **no other live artifact**: the contradiction was internal to this one file.

The section is now a table of what each of the 13 npm scripts **actually runs**, measured
rather than transcribed — `package.json`'s surface is not the behaviour, since `npm run`
resolves chains and the release gate is reached by an edge no `npm run` shows:

- Which files each tsconfig project checks was read out of `tsc --listFiles`, not off the
  `include` arrays: `tsconfig.json` → `src`; `tsconfig.unit.json` → `test/unit`;
  `tsconfig.test.json` → `test/integration`, `test/lsp`, `test/oracle`.
- `npm test` is hermetic, confirmed by grep: no `child_process` and no `vscode` import
  anywhere in `test/unit`.
- **The load-bearing claim was verified firsthand rather than quoted from Session 174:** a
  bare `npx vsce package` — which touches none of our npm scripts — still printed
  `Executing prepublish script` and `check-package: OK`. The `vscode:prepublish` edge, not
  the `package` script, is what makes the gate unavoidable.
- The one figure inherited rather than measured was the oracle's cold cost ("minutes"), so
  it was measured: the cache was moved aside and the suite run cold — **94.9 s vs 0.36 s
  warm**, with the regenerated cache **byte-identical** to the backup and the identical
  verdict (99 documents: 91 agree / 4 lost TP / 4 cardinal FP), so the number is real and
  nothing was damaged to get it.

**An unmeasured claim was removed rather than softened.** The draft said the two Electron
suites take over the screen "for minutes"; they were not run this session (they seize the
operator's screen and need explicit go-ahead), so the duration is gone and only what the
session can support remains.

Mechanically confirmed rather than eyeballed: all 13 scripts named in the table exist in
`package.json`, and the only script *not* in the table is `vscode:prepublish` — deliberately,
because it is an edge `vsce` walks rather than a command anyone runs, and it is described in
the prose above the table instead.

Closes the filed item. Two new items filed: `CLAUDE.md`'s **Tech Stack** section carries the
same stale "not yet scaffolded" framing plus a dangling *"`vscode-languageclient` / LSP if a
language-server architecture is chosen"* (measured: no `vscode-languageclient` anywhere,
`dependencies` empty — that question resolved to *no*), raised with the operator who chose to
keep this session to the filed item; and `vitest.config.ts` / `vitest.oracle.config.ts` are
type-checked by **no** tsconfig project (found by the same `--listFiles` measurement).

### 2026-08-01 · [ad hoc] Session 174 — IMPLEMENTATION: the `scratchpad/` `.vsix` packaging leak (SHIPPED)

The untracked `scratchpad/` directory shipped inside every `.vsix` from ~2026-07-21:
**3043 of the artifact's 3085 files, 84.68 MB uncompressed**, against a real extension of
42 files — and `npx vsce package` exited 0 throughout. Measured before and after by reading
the produced artifact with `unzip -Z1`, not by trusting an exit code: **3087 entries /
29.73 MB → 44 / 1.8 MB** (42 extension files plus vsce's two manifest entries).

**The deliverable was not the two `.vscodeignore` lines; it was inverting the default.**
`.vscodeignore` is a DENYLIST, so the packaged set is allow-by-default: anything new at the
repo root ships unless a human remembers, and no build, test, type-check or packaging step
can observe the mistake. That default went wrong twice in eleven days — `tsconfig.unit.json`
(Session 173) and `scratchpad/`. `check-package.js` now checks the packaged set
**deny-by-default** against an explicit top-level allowlist, and it proved the point on its
first run by reporting **two** violations rather than one: `scratchpad` (3043 files) and
`check-package.js` itself, the brand-new root-level file written thirty seconds earlier,
which would have shipped exactly as `tsconfig.unit.json` did.

It asserts three things: the allowlist; **presence** of every allowlisted root (an
over-broad exclusion that drops `dist/` is the same defect pointed the other way, and such a
`.vsix` packages, publishes and installs perfectly cleanly); and file-count / byte ceilings
as backstops for a leak *inside* an allowed root.

**The wiring point was chosen by measurement.** Pointing `vscode:prepublish` at a
marker-writing probe: `vsce package` runs it (1 marker), `vsce ls` does not (0). The first
half makes `vscode:prepublish` strictly stronger than the project's own `package` script —
vsce walks that edge itself, so even a bare `npx vsce package` now runs the gate. The second
half is what makes the design possible: the gate shells out to `vsce ls` from inside
`vscode:prepublish`, which would have been infinite recursion had the answer gone the other
way. `test/unit/package-contents-gate.test.ts` pins that reachability, with the traversal
extended to model the implicit edge (no `npm run` appears in it).

**Mutation-proven in three directions.** A stray root-level file makes `npm run package`
**ERROR with no artifact produced** — the gate blocks a release rather than describing one
afterwards; cutting the wiring reds exactly 3 of the 4 pins (the 4th correctly stays green,
pinning a different property); excluding `dist/**` reds the presence check.

**The oracle's faithfulness is measured, not assumed.** `vsce ls` and a real `.vsix` are
identical as sets with exactly two differences — the archive adds `extension.vsixmanifest` +
`[Content_Types].xml` outside the `extension/` prefix, and two files are RENAMED on the way
in (`LICENSE`→`LICENSE.txt`, `README.md`→`readme.md`). That justifies a ~7s oracle over a
~36s one producing a 30 MB artifact, and the renames would have silently broken an allowlist
spelled from the archive's names. The re-derivation command lives in the script.

**⚠ `scratchpad/` was deliberately NOT added to `.gitignore`** (decision recorded in
`.vscodeignore`). The `?? scratchpad/` line in every Phase 0 `git status` is the only
human-visible trace that ~97 MB of prior-session scratch lives in this repo; it costs exactly
one line because git collapses the directory, and it masks no other stray file. Silencing it
would buy cosmetic quiet at the price of the one signal that would ever surface this.
Reversing the decision is one line; the `.vsix` stays protected either way.

**Known blind spot, documented at both sites:** the allowlist is top-level only, so a
`media/screenshots/**` leak sits inside an allowed root where only the ceilings could catch
it — `docs/F5-VISUAL-CHECKLIST.md`'s manual `vsce ls` step is still required and is marked
as such. `docs/SECURITY-AUDIT.md`'s standing "the published `.vsix` contains only the
esbuild bundle plus static assets" invariant — false for ~11 days, and re-verified by hand
at a point in time by a person who had to think to look — is now enforced on every packaging
run.

Also filed: `methodology_dashboard.py` is two minor versions stale (v2.8.0 vs v2.10.2), and
`scratchpad/` is ~97 MB with nothing pruning it (an operator decision — several planning
documents cite files inside it as their grounding record).

`src/` is byte-identical to the session's 1B claim; zero runtime surface changed.


### 2026-07-27 · [ad hoc] Session 173 — IMPLEMENTATION: the `test/unit` type-check gate (SHIPPED)

Nothing type-checked `test/unit`. `tsconfig.json` includes only `["src"]`,
`tsconfig.test.json` only `test/integration/**`, `test/lsp/**` and `test/oracle/**`, and
vitest transpiles with esbuild without checking types — so a unit test could ship as a
TypeScript error that every green run reported as passing. S162 shipped exactly that: an
`L1` pin calling `namesFor("none")` against a helper whose hand-copied union lacked
`"none"`.

`tsconfig.unit.json` type-checks all **62** unit test files (+45 `src` files transitively),
and `check-types` now chains `check-types:unit`, which puts the gate on `compile` and
therefore on `package`, `vscode:prepublish`, `test:integration` and `test:lsp` — none of
which name it. `test/unit/type-check-gate.test.ts` pins that chain by REACHABILITY,
expanding `npm run <name>` transitively rather than matching one script's spelling.

**Mutation-proven in both directions.** Re-creating S162's exact shape:

    npm test              exit 0   <- 1589 passed. Type nonsense, reported green.
    npm run check-types   exit 2   <- TS2345: Argument of type '"none"' is not
                                      assignable to parameter of type 'LangName'.
    npm run compile       exit 2   <- packaging and both integration runners blocked.

Reverse: cutting the wiring reds exactly 2 of the 6 pins; the 4 that pin the tsconfig
itself correctly stay green.

**The filed cost estimate was wrong by an order of magnitude, in the direction that would
have wasted the session.** Ten handoffs quoted "~25 pre-existing errors across ~10 unit
test files … decide whether to fix or `@ts-expect-error` each". Under options faithful to
how vitest executes those files there are **2**. The other 23 are artifacts of the base
project's `module: commonjs` and missing `resolveJsonModule`: 8× TS2732 on the
`package.json` imports, then 6× TS18046 and 5× TS7006 all downstream of that one option
(with the JSON untyped, everything derived from it degrades to `unknown`/`any`), and 4×
TS1343 because `import.meta` needs an ESM `module`. Acting on the filed number would have
meant editing ~23 tests that were never wrong.

**The compiler options were the real deliverable, and the incantation every handoff has
quoted since S162 is the wrong one here.** Matrix, errors as (total / in `src` / in `test`):

    module=es2022   res=node      ->  2 / 0 / 2   <- adopted
    module=esnext   res=node      ->  2 / 0 / 2
    module=es2022   res=node10    ->  2 / 0 / 2
    module=preserve res=bundler   ->  8 / 6 / 2
    module=esnext   res=bundler   ->  8 / 6 / 2
    module=node16   res=node16    ->  6 / 0 / 6
    module=nodenext res=nodenext  ->  6 / 0 / 6

`moduleResolution: bundler` injects 6 phantom TS2702 errors into
`src/core/notebook-callout.ts` — a file `npm run check-types` passes clean — because
ESM-style resolution drops the `export =` namespace interop this project's `commonjs` +
`esModuleInterop` relies on. `node16`/`nodenext` fail the other way: the package is CJS, so
the 4 `import.meta` uses come back as TS1470. Recorded cost of the adopted pair: node10
resolution ignores `exports` maps, a false negative in the safe direction. `rootDir: "."`
is required — the inherited `rootDir: "src"` reports TS6059 on all 62 files.

The two genuine errors are fixed behaviour-preservingly: the stub grammar in
`test/unit/tokenize.test.ts` and `test/unit/grammar-embedded-breadth.test.ts` is now built
with `vsctm.parseRawGrammar` — the typed entry point the real branch beside it already
uses — over `JSON.stringify` of the identical literal, so the returned value is unchanged.
A bare `as vsctm.IRawGrammar` does not compile (TS2352); `as unknown as` would punch a hole
in the very check this gate applies; spelling out `repository: { $self, $base }` would hand
the engine fabricated rules it overwrites on the next line.

**Running the release gate found a defect this change shipped.** `.vscodeignore` excludes
build inputs one line per file, so `tsconfig.unit.json` was packaged INTO the `.vsix`;
`vsce package` exits 0 either way and only the produced file tree shows it (Learning #7 in a
form no corpus grep reaches). Fixed, verified absent from the real artifact. It also
surfaced a larger PRE-EXISTING one, filed not fixed: the untracked `scratchpad/` directory
is **3043 of the package's 3085 files** and has been since ~2026-07-21; the real extension
is 42 files.

`npm run check-types:unit` retires the hand-typed per-file incantation every handoff has
carried since S162, and `CLAUDE.md` now names it.

Commits: 1B claim `26a0f36`; **C1** `b2937d1` [RED→GREEN] the project + the 2 errors;
**C2** `2f30f4e` [RED→GREEN] the wiring + 6 pins; **C3** `223cea8` the two falsified live
claims; **C4** `b38b62a` the `.vsix` leak; **C5** `b1c6e54` backlog; close-out. `src/` is
byte-identical throughout. `PROJECT_LEARNINGS.md` #199–#202.

### 2026-07-27 · [ad hoc] Session 172 — IMPLEMENTATION: the `CELL_INFO` fence-token grammar is quarto's (SHIPPED)

`CELL_INFO` (`src/core/qmd/model.ts`) now carries quarto's own cell-fence recognizer,
transcribed from `breakQuartoMd` in the installed 1.7.33 and read out of
`/Applications/quarto/bin/quarto.js` rather than from the docstrings quoting it:

    -  /^\{([A-Za-z][A-Za-z0-9_-]*)[^}]*\}$/
    +  /^\{([A-Za-z][=A-Za-z]*)( *[ ,].*)?\}$/

A fence token quarto does not recognise is not a cell to it **at all** — `breakQuartoMd`
builds no code cell, `partitionCellOptionsMapped` never runs, and nothing inside is
validated — so we were squiggling documents `quarto render` exits 0 on.

**The old tail was wrong in BOTH directions**, which is what all three filed items missed.
Too permissive: `{python3}`, `{fortran95}`, `{d3}`, `{r.foo}`, `{r-foo}`, `{r_foo}`, `{ré}`,
a TAB-separated info string, and `{r=1}` were all cells to us and none to quarto — and the
`[^}]*` tail TRUNCATED rather than rejected, so `{r.foo}` and `{ré}` each arrived as an `{r}`
cell, indistinguishable from a real one at the outline, the virtual-document language map,
run-cell and diagnostics at once. Too restrictive: a class excluding `}` cannot span a `}`
inside a quoted chunk option, so the **well-formed** knitr header `` ```{r, fig.cap="}"} ``
was not a cell to us while quarto validates it.

Closes three filed items sharing one root cause — the digit-bearing fence token (S161 review,
plus S166's dotted `{r.foo}` update), the glued `{mermaid=x}` whose language is really
`mermaid=x` (S162 review), and the Session 16 `findDiagramRegions` over-detection — and three
shapes no filing named: hyphen, underscore, and a non-ASCII letter.

Measured, not derived, by replaying the pre-S172 build (`git archive faaeae9 src` ->
`QMD_ORACLE_SRC`) over the same 99-document oracle corpus: **80 agree / 6 lost TP / 13 cardinal
FP → 91 / 4 / 4.** Nine cardinal false positives closed, two lost true positives recovered,
zero rows regressed. ~85 firsthand `quarto render --no-execute` measurements in four batches,
each carrying known-answer controls.

Two things deliberately NOT done, both measured and both filed. (a) The `=`-led raw-block
branch: quarto accepts a leading `=`, and it really does validate raw blocks — `{=html}` +
`#| echo: banana` renders exit 1, and knitr-only `#| cache: banana` renders exit 1 in a knitr
document, so a raw block takes the document engine's schema. Adopting it WIDENS what we
squiggle onto a new block class, so the item is re-rated with its mechanism rather than closed;
the two FP GUARD pins are the enforced boundary, and a mutant adopting quarto's grammar
verbatim kills exactly those two out of 1574 tests. (b) `FENCE_OPEN`'s 3-space indentation cap:
quarto's recognizer opens with unbounded `\s*`, and a 4-space-, tab- and 8-space-indented fence
with a column-0 option all render exit 1 while we stay silent — a different regex, newly filed.

⚠ Standing hazard recorded at `document-engine.ts`: quarto has THREE fence grammars, and the
engine-selection scan (`[a-zA-Z0-9_]+`) must stay different from the cell recognizer
(`[=A-Za-z]+`). `{python3}` is a LANGUAGE but not a CELL; `{=html}` is a CELL but not a
LANGUAGE. Consolidating ours — as a BACKLOG item and a src docstring both proposed — regresses
both directions.

Verification: check-types clean; compile-tests clean; unit **1583 / 62 files**; oracle 99
documents, gate green; integration **491 passing**, taken RED first (3 failing, in both
directions, with the CANARY passing) and GREEN after restoring.

### 2026-07-27 · [ad hoc] Session 171 — IMPLEMENTATION: leading whitespace no longer hides the front matter from engine scoping (SHIPPED)

A blank line — or spaces, or a tab — before the opening `---` hid a document's front matter
from us and never from quarto. `partitionYamlFrontMatter`, which quarto uses to select the
ENGINE, opens with `lines(markdown.trimLeft())`; `scanRegions` opens front matter only at
line 0. S165 could therefore only **decline** there, and declining means keeping the per-cell
language approximation — knitr for an `{r}` cell — so we squiggled a knitr-only key on a
document `quarto render` accepts. That was the last remaining cardinal false positive in this
family whose root cause was ours rather than an unreadable input.

`resolveDocumentEngine` — the ONE entry point both engine consumers share since S169 — now
derives all four of its text-derived arguments from `text.trimStart()`.

**The filed fix was wrong, and this is the substance of the session.** `BACKLOG.md` had said
since S164 that closing this "means teaching the scanner quarto's `trimLeft`"; the clause was
copied into `document-engine.ts` twice, restated by S165, and carried into S170's handoff as
ranked recommendation #1. Quarto runs **two** partitioners over the same syntax and they
disagree on purpose — read firsthand out of `/Applications/quarto/bin/quarto.js`, not from the
docstring that quoted one of them:

```js
// ENGINE selection
const mdLines = lines(markdown.trimLeft());              // partitionYamlFrontMatter
// FRONT-MATTER VALUE validation
const nb = await breakQuartoMd(src);                     // validateDocumentFromSource
if (firstCell.source.value.startsWith("---")) { /* …validate front matter… */ }
```

That second test is a literal byte-0 test with no trim, so quarto performs **no front-matter
value validation at all** on a document with any leading whitespace. Measured across 17 keys
whose bad value quarto rejects at line 0, re-rendered behind a single leading blank line,
**10 render exit 0**: `number-sections`, `code-fold`, `fig-width`, `fig-align`, `keep-md`,
`freeze`, `cache`, `link-citations`, `execute`, `bibliography`. Teaching the shared scanner
the `trimLeft` would have closed one cardinal false positive and opened ten. Fixing it at the
engine entry point leaves `yaml-value-flags.ts` enumerating from the untrimmed text, and the
**FP GUARD** pin in `test/unit/yaml-value-flags.test.ts` fails first if that ever changes
(mutation-proven: it is the only test of 1562 that dies when the value enumerator adopts the
trim).

**Grounded firsthand vs quarto 1.7.33**, ~60 renders. The claim: a leading blank line, then
`---`/`title: t`/`engine: markdown`/`---`, then `{r}` + `#| cache: banana` renders **exit 0**
— with `#| echo: banana` at exit 1 proving cell validation ran, and the `engine:` line removed
at exit 1 proving knitr is the fallback. Every leading-whitespace spelling behaves the same:
two blank lines, a spaces-only line, a tab, CRLF, and an **indented** `---` (JS `trimLeft`
strips spaces as well as newlines, so `"   ---"` matches `kRegExBeginYAML` after it).

**The replay is the argument.** `git archive d112f35 src` → `QMD_ORACLE_SRC` over the same
86-document corpus:

| build | agree | lost TP | **cardinal FP** |
|---|---|---|---|
| pre-S171 (`d112f35`) | 73 | 3 | **10** |
| this build | 78 | 3 | **5** |

Five closed, none regressed. The corpus grew 78 → 86: it already carried a row *named*
`REVIEW blank line BEFORE --- + engine: markdown`, baselined `agree` — but that row's flagged
cell is `{python}`, whose language fallback answers jupyter, so it stayed silent for the wrong
reason and read as coverage. The eight new rows use `{r}` cells, which discriminate.

**Filed, not fixed:** an **indented** opening `---` is a cardinal FP with a different root
cause — `breakQuartoMd` anchors its `yamlRegEx` at column 0, so `   ---` opens nothing, then
the *closing* `---` opens a region that never closes and swallows every cell, and quarto
validates nothing at all (exit 0 even with the engine-agnostic control). Pre-existing,
established by replay, recorded as oracle row `S171 indented --- + NO engine + {r} + cache
(KNOWN residual)` and filed in `BACKLOG.md`.

Also corrected: completion does **not** move for this document class, contrary to the
"both surfaces move" framing S169/S170 established — `completionEngineFor` maps a `"markdown"`
document to the `"unknown"` scope, which falls back to the cell language, exactly as
`undefined` did before.

Verification: check-types clean; compile-tests clean; unit **1562 / 62 files**; oracle 86
documents / 78 agree / 3 lost TP / 5 cardinal FP / 0 unrelated; integration **RED 485 + 1
failing → GREEN 486** (operator-approved, both runs). Seven commits: `d112f35` (1B claim),
`5d6ef0d`, `923d5b8`, `63b5f60`, `0f1c8b6`, `aba4ff8`, `d55fcb8`.

### 2026-07-27 · [ad hoc] Session 170 — IMPLEMENTATION: an `.Rmd` is knitr for EVERY cell (SHIPPED)

`documentEngineForScoping` answered `undefined` on quarto's `kRmdExtensions`. That was a
**veto** — it stopped a front-matter `engine:` key from silencing a document quarto validates
anyway — but it left both consumers on their per-cell language guess, so an `.Rmd`'s
`{python}` cell was scoped to jupyter and up to **20** knitr-only flaggable fields were lost
on every such file. Since S169 it cost completion too: that session taught completion the
document engine, and this branch was the one place its fix was **inert**. It now answers
`"knitr"`, which is what quarto uses for every cell of an `.Rmd`.

**Grounded firsthand vs quarto 1.7.33**, on a document whose only cell is `{python}` — the
language whose own fallback is jupyter, so a knitr verdict cannot have come from the
languages: `doc.Rmd` + `#| cache: banana` renders **exit 1**; the byte-identical `doc.qmd`
renders exit 0; the key removed renders exit 0; the agnostic `#| echo: banana` renders exit 1.
`.rmd`, `.RMD` and `.Rmarkdown` all exit 1, and `{sql}`/`{ojs}`/`{bash}` cells exit 1 too.

**The widening was swept, not argued.** knitr is the one answer that widens what we squiggle
(+20 fields; every other engine maps to the same 23-field agnostic set). All 20 —
`cache`, `cache-lazy`, `cache-rebuild`, `cache-comments`, `autodep`, `tidy`, `collapse`,
`prompt`, `fig-width`, `fig-height`, `fig-format`, `fig-dpi`, `fig-asp`, `fig-show`,
`external`, `sanitize`, `interval`, `purl`, `message`, `results` — were rendered as
`#| <field>: banana` in a `{python}` cell of a `doc.Rmd`. **All 20 exit 1.** Valid values stay
valid (`cache: true`, `fig-width: 6`, `results: hide` all exit 0), and the handler carve-out
holds: `{dot}` + `//| cache: banana` renders exit 0 and `cellOptionScopeFor`'s `"none"` guard
sits above the engine, so it is not flagged.

**The `.Rmd` is the ONE document class whose engine is CERTAIN**, and that was measured rather
than reasoned. `claimsFile` runs before `fileExecutionEngine` partitions anything, so none of
the three open items that make other documents' engines uncertain can reach it — a
front-matter override, a project `engines: [jupyter, knitr]` that reorders that very loop, and
an `{{< include >}}` whose child holds a `{julia}` cell all still render exit 1 on a `doc.Rmd`.

**The oracle grew twelve `.Rmd` rows (66 → 78 documents).** The corpus was 100% `.qmd`, so the
extension branch had never been inside its horizon — C1 ran byte-identically green over all 66
because none of them could observe it. Replayed against the pre-S170 build
(`git archive af5a4bb src`) over the same 78: **63 agree / 11 lost TP / 4 cardinal FP** there
against **71 / 3 / 4** here. Eight rows move from lost-TP to agree and the cardinal-FP count is
**identical on both sides** — the measurement that made a widening safe to ship.

**Runtime-verified RED then GREEN** with the operator's go-ahead (FM #24), on the only surface
that sees a file name: a byte-identical fixture pair (`rmd-python-cell.Rmd` / `.qmd`) shared by
the completion and diagnostics suites. RED with the one line reverted: **481 passing / 2
failing**, the completion failure printing the whole 49-key jupyter set with `cache` absent,
both `.qmd` controls passing in the same run. GREEN: **483 passing / 0 failing**.

Commits: 1B claim `fcb2862`; **C1** `5147b1b` [RED→GREEN] the decision + the validator;
**C2** `5786d0f` completion's inherited pins and the docstring that denied them; **C3**
`ff70cf8` the oracle corpus + replay; **C4** `fe64c9f` the integration fixture pair; **C5**
`0025055` the four corpus sites the change made stale. Close-out (this commit). Closes
BACKLOG's "An `.Rmd`/`.rmd` is knitr for EVERY cell"; files a new one in its place (an
`.Rmarkdown` never activates the extension at all, so the decision handles an extension the
editor never delivers).

### 2026-07-27 · [ad hoc] Session 169 — IMPLEMENTATION: cell-option completion learns the document engine (SHIPPED)

Cell-option **completion** scoped a cell's option list by the cell LANGUAGE
(`engineFor`, in `completionContextAt`) while the value **validator** scoped it by the
DOCUMENT engine (`cellOptionScopeFor`). Since S165 the document engine resolves for
essentially every document, so the two disagreed on ordinary files — and in the direction
that hurts: in a knitr document we **squiggled a knitr-only key in a `{python}`/`{ojs}`/`{js}`
cell that completion refused to offer**. Filed by the S164 §9 review, widened by S165's,
ranked #1 by S168.

**Grounded firsthand vs quarto 1.7.33**, three documents differing by one line: an `{r}` cell
plus a `{python}` cell carrying `#| cache: banana` renders **exit 1**
(`Field "cache" has value banana`); the same document without the key renders exit 0 (so the
exit 1 is the value, not the shape); the `{python}` cell ALONE renders exit 0 (so it is the
OTHER cell that puts `cache` in scope).

**The rule**, stated once: completion adopts the validator's scope wherever that scope names a
real engine, and keeps its existing over-offer wherever the validator NARROWS — `"unknown"`
(a markdown/julia/ambiguous/unresolved document, where quarto ACCEPTS the knitr-only key as
merely inert) and `"none"` (a `{dot}`/`{mermaid}` handler cell, where adopting it would hand
`cellOptions` the EMPTY set and delete handler-cell completion outright). Invariant: the
offered set is never a strict subset of the flagged set. `ctx.engine` stays typed
`CellEngine | undefined`, so the provider's `index.cellOptions(ctx.engine)` call is unchanged.

**It is not all one direction, and the first draft of the docstrings said it was.** Measured
before/after per language: `{python}` and `{ojs}`/`{js}` in a knitr document GAIN
`cache`/`fig-width`/`fig-height` and lose nothing — the fix; but `{sql}`/`{bash}` in an
engine-resolved document NARROW from the unfiltered set, and an `{r}` cell in a jupyter
document loses those same three keys. Both narrowings are correct (quarto ignores those keys
there) and both are now documented rather than hidden behind the invariant.

**NEW `src/core/document-engine-resolve.ts`** — the one place the engine is resolved from a
snapshot, called by BOTH `core/yaml-value-flags.ts` and `providers/yaml.ts`. `yaml-context.ts`
cannot host it (the front-matter enumerators import that module), and a second hand-written
copy of the five-argument wiring is the mirror-drift class S166–S168 spent three sessions
removing. The rewire of `valueFlags` was proven behaviour-identical by an oracle differential:
per-row detail lines **byte-identical** across all 66 corpus documents (59 agree / 3 lost TP /
4 cardinal FP / 0 unrelated), and the diff was proven able to fire first — dropping one
argument flips a row to `cardinal-fp` and exits 1.

**Runtime verification: RED then GREEN.** With the pre-S169 rule restored the integration
suite ran **478 passing / 1 failing**, the failure naming the full jupyter set the old
provider offered in a knitr document; restored, **479 passing / 0 failing**. Unit 1530 → 1549.

**§9 review** (`wf_d5bc1c1b-cc8`, 65 agents, `agents_error: 0`, ~3.7M subagent tokens):
29 findings, **all 29 factually confirmed**, 20 also consequence-confirmed, plus 3 critic
findings. Verdicts were recorded separately per verifier rather than requiring unanimity —
9 findings were factually confirmed but consequence-refuted and would have been buried
otherwise. Corrections applied in `027bbcb` (four unpinned branches, including the HIGH one:
excluding `{ojs}` from the fix re-opened the exact defect and survived all 1545 tests),
`498bcf9` (three false claims of mine — the enumerator swap is a COMPILE ERROR not a silent
type-check, `{sql}` was never a refused-offer case, and the cost model was inverted: the
enumerators are 92% of the 0.14 ms, not the language scan), and `e036b15` (two corpus sites
outside `src/` my own sweep structurally could not reach). One finding was **refuted on
adjudication**: the "comment-only" proof is empty over the commit it names (51 lines only if
run over the whole session diff, which includes real code).

**Disclosed, not fixed:** the fix is INERT on an `.Rmd` — the one document class whose engine
is certain — because the extension veto returns `undefined` there. Filed against BACKLOG's
existing `.Rmd` item, which owns that veto.

### 2026-07-27 · [ad hoc] Session 168 — IMPLEMENTATION: the value-flag decision lifted into `src/core/` (SHIPPED)

Executed `docs/planning/2026-07-26-value-flag-decision-core-lift-plan.md` as one pre-declared
vertical slice, five checkpoint commits. **`test/oracle/flags.ts` — the hand-written mirror of
the feature's cell-option loop, and the harness's own stated "single biggest weakness" — is
DELETED.** The oracle and the editor now call one implementation,
`src/core/yaml-value-flags.ts` (`collectValueSources` / `hasNoValueLines` / `valueFlags`).
`src/features/yaml-value-diagnostics.ts` goes 366 → 98 lines and keeps only what is
irreducibly `vscode`: the `.qmd` gate, the debounce/generation contract, and the
`ValueFlag` → `vscode.Diagnostic` construction.

**No behaviour change was intended and none was measured.** The strongest evidence is the
differential check at Layer 3: the oracle's per-row `ours [...]` detail lines are
**byte-identical** before and after, on all 66 corpus documents — the same flags, not merely
the same row classes (two different non-empty flag sets both score `agree`, so row-class
equality alone would have been too weak). The diff was itself proven able to detect a
one-token change before the result was believed. Row classes unchanged: 59 agree, 3 lost TP,
4 cardinal FP, 0 unrelated.

The three loops moved **verbatim** — all 133 comment lines of measured quarto behaviour, every
`continue` reason, and the `break`/`continue` asymmetry the plan's dragon 3 warns about. That
warning is now a PIN rather than prose: a mutant swapping the top-level `continue` for `break`
is caught (it would exit before a later `format:` line and lose a true positive quarto really
rejects), while the same swap in the nested loop survives, confirming the two sites are not
symmetric.

Strict TDD, four RED→GREEN cycles, one per surface. The adapter's RED is the one that matters
(slice gate d): with the decision stubbed, the integration suite fails **72** tests including
*positive controls*, not merely negative assertions — the check S163 gotcha #5 demands, since
a suite of negative assertions passes against a dead provider. Restored: **477 passing**.

The two front-matter loops and the format-name branch — ~136 of the 272 moved lines — had
**never been covered by any headless test** and are not covered by the oracle either (its
driver scores `.cell`). They now carry per-branch pins: 30 in
`test/unit/yaml-value-flags.test.ts`, unit 1494 → 1519 net.

Two findings worth carrying forward. **(1) The plan's own dangling-reference grep was
incomplete** — it did not name `loadCoreApi`, whose third consumer
(`test/unit/oracle-corpus.test.ts`) went red on deletion; the pin was retargeted, not dropped.
**(2) `compile-tests` stayed clean throughout that breakage**, because `tsconfig.test.json`
covers `test/oracle/**` and `test/integration/**` but not `test/unit/**` — S162's filed
"nothing type-checks `test/unit`" gap manifesting as a real caught defect rather than a
hypothetical one.

Accepted cost, recorded at `load.ts` and in the README (plan dragon 1): **replay now reaches
back only to S168**, since no earlier commit contains `core/yaml-value-flags`. Freezing the
mirror as a legacy replay path was rejected — it would reinstate the artefact whose existence
was the problem.

Closes the `BACKLOG.md` item *"The oracle MIRRORS the feature's flag decision instead of
calling it, because the decision lives behind `vscode`"* (filed S166, planned S167).

**§9 adversarial review, run with the operator's go-ahead** (`wf_6af3a3c3-cab`): 6 read-only
lenses, 2 perspective-diverse verifiers per finding with verdicts recorded **separately**
(never requiring unanimity — that predicate is what nearly buried S167's panel), plus a
completeness critic. **31 agents, `agents_error: 0`, ~2.4M subagent tokens, 12 findings + 1
critic finding — ALL 12 factually confirmed by an independent verifier**, and every one
re-adjudicated firsthand with a command before anything changed. The behaviour-preservation
lens found **nothing**, which is the result that mattered most. Three correction commits:

- `fa84385` — **a false claim this session introduced**: the new adapter docstring said
  `validate-yaml` "suppresses two of the three" surfaces. It gates all three loops; the
  front-matter format NAME is the exemption, and the core module the sentence redirects to
  said so, leaving two files contradicting each other about measured quarto behaviour. Plus
  **7 live `src/` cross-references** the lift falsified (the panel claimed 8; adjudicated
  firsthand it is 7 — one is a true historical statement about an earlier move). Layer 5's
  staleness sweep was scoped to `test/oracle/` and could not reach any of them.
- `7d29e97` — **six branches whose mutants survived the entire 1519-test suite**, three of
  them guarding measured CARDINAL FALSE POSITIVES: the `contentEndCol` clamp (S161), the
  backslash escape skip (P3/S149), the real-separator rule (S148), `isWrongValue` itself,
  two of `hasNoValueLines`'s three conjuncts, and the flag SPANS on three of four emit
  sites. Each gap was confirmed by running the predicted mutation first; each mutant was
  re-run after pinning and now dies. Unit 1519 → 1530.
- `312f88c` — three stale pointers and an unrunnable worked example: two more copies of the
  `test/unit/oracle-*.test.ts` glob claim (in `vitest.oracle.config.ts` and the driver's own
  header — the README's copy was fixed in Layer 5, so the repo carried the same sentence
  three times, one true and two stale), a comment naming the deleted mirror, and the
  README's replay example `git archive 87b3f38`, which sat directly above the new warning
  saying replay no longer reaches that far.

**Two findings are recorded rather than fixed, because they are about the record itself.**
(1) The **Layer 3 checkpoint commit `c0d4fd2` left `npm test` red** — it removed
`loadCoreApi` while a unit test still imported it, and Layer 3's stated gates
(`compile-tests`, `test:oracle`) structurally cannot see `test/unit`; the Layer 4 commit
message then misattributed the cause to the file deletions one commit later. (2) **Two
comment lines were reworded during a move the plan required to be verbatim** ("this session
removes from" → "S148 removes from", and the same for "this session's own L1"): the
rewording is more accurate once the code leaves the session that wrote it, but the L1 commit
message's claim that every comment moved verbatim is therefore false. Both are left in
history rather than rewritten — the checkpoint commits are this slice's recovery mechanism
and rewriting them at close-out trades a documented defect for an undocumented risk.
Recorded as `PROJECT_LEARNINGS.md` #181 and #182.

### 2026-07-26 · [ad hoc] Session 167 — PLANNING: lifting the value-flag decision into `src/core/` (PLAN ONLY)

`docs/planning/2026-07-26-value-flag-decision-core-lift-plan.md`. The architecture/refactor
plan for extracting the pure "what would we squiggle?" decision out of
`src/features/yaml-value-diagnostics.ts` into a new `src/core/yaml-value-flags.ts`, so the
feature and the exit-code oracle call ONE implementation and `test/oracle/flags.ts` — the
hand-written mirror that has already drifted undetected once — is deleted. Five layers,
pre-declared as one vertical slice with per-layer checkpoint commits and verification.

**No code was written.** Implementation is a separate session (FM #18). The `BACKLOG.md` item
stays open and now points at the plan.

An adversarial review panel was run with the operator's go-ahead (`wf_25552832-cd9`; 6 lenses,
2 refuters per finding, a completeness critic; 77 agents, 0 errors, ~4.4M subagent tokens).
It reported `survivors: []` — an **artefact of the survival predicate**, which required both
refuters to agree and so recorded findings the factual refuter had independently CONFIRMED as
killed. Reading the per-agent results instead of the summary yielded **29 grounded defects in
the plan's first draft**, every one re-verified firsthand and corrected; §11 of the plan is
the record. The two most serious were false *justifications* rather than false conclusions:
an inventory grep whose pattern could not match the file it searched (Learning #180), and a
`break`/`continue` safety rationale that, followed literally, licensed the one edit in the
refactor that loses a true positive.

### 2026-07-26 · [ad hoc] Session 166 — IMPLEMENTATION: the exit-code replay oracle, committed as an opt-in harness (SHIPPED)

The end-to-end oracle had been the primary safety evidence for two consecutive sessions
(S164's 17 documents, S165's 64) and lived only in disposable session scratchpads — so the
strongest claim either made, "0 regressed", could not be re-checked by anyone afterwards.
It is now `test/oracle/`, run with `npm run test:oracle`.

It replays this extension's OWN cell-option flag decision over a 66-document corpus,
renders each with the real `quarto` CLI, and classifies every row **agree / lost-TP /
cardinal-FP / unrelated**. Opt-in and outside `test/unit/` because it needs quarto on PATH
and a minute of wall clock; the pure logic it composes (verdict parsing, classification,
comparison, the baseline-reason gate) is pinned headlessly and runs in the default suite.

**Measured this session, quarto 1.7.33:**

| build | agree | lost TP | cardinal FP |
|---|---|---|---|
| this build | 59 | 3 | **4** |
| pre-S165 (`87b3f38`, via `git archive` + `QMD_ORACLE_SRC`) | 41 | 9 | **16** |

18 rows better, none worse — independently reproducing all three of S165's headline
numbers from a re-implemented harness rather than trusting the claim. All four remaining
cardinal false positives were adjudicated **by replay, not assertion**: each is also wrong
pre-S165, so each is PRE-EXISTING, and `baseline.json` names the mechanism and filed item
for every one (two include shapes, the `execute: {engine: markdown}` FLOW spelling, and the
`{r.foo}` dotted fence token — the last being the CELL_INFO root cause under a spelling the
filed item does not name).

**Porting it was an audit, and it found three defects two sessions of use had not:**

- **the mirror had drifted.** `cellOptionFlags` must re-walk `computeValueDiagnostics`'s
  loop because that function imports `vscode`; S165's copy omitted the S163 `validate-yaml`
  escape hatch entirely. No corpus row used the flag, so nothing could catch it. Closed,
  pinned, and proven by a mutant that reproduces S165's version exactly — it kills both new
  hatch pins while the positive control survives. Two corpus rows added for the flag.
- **the quarto resource path was true on one machine** (`/Applications/quarto/...`). Now
  resolved the way the product resolves it, through the already-tested `parseSharePath`.
- **the schema was parsed by the CURRENT build's parser while replaying an OLD build.** The
  parser now comes from the build under test, so a replay is faithful.

**Three gates, each observed FAILING before being trusted:** a regression fails the run with
every regressed row NAMED (the pre-S165 replay fails with 18); a baseline row recorded as
wrong with no written reason fails the run (verified by deleting one — it named that row);
and a row present in only one of baseline/run is reported incomparable rather than dropped,
because silent omission is exactly how S165's oracle reported "0 regressed" while twelve
regressions sat outside its corpus. A missing baseline seeds itself and still fails.

Layers, each RED→GREEN with a checkpoint commit: **L1** `3b07d8f` the pure classification
logic; **L2** `d845714` the flag mirror + the escape hatch; **L3** `d855cd2` the corpus and
the build-under-test loader; **L4a** `a7a8409` the baseline-reason gate, **L4b** `64b24da`
the driver + adjudicated baseline, **L4c** `9d3f525` the README + harness type-checking.
Verification: unit **1465 → 1494**; check-types clean; `compile-tests` clean and now
type-checking `test/oracle/**` (the integration runner's mocha walk is rooted at its own
suite directory and never reaches it — read, not assumed); the oracle itself run cold (66
real renders), warm, against two builds, and with both gates deliberately failed. Zero
`src/` changes. Nine targeted mutants, each killing exactly its own pin.

### 2026-07-26 · [ad hoc] Session 165 — IMPLEMENTATION: the DEFAULT (no-override) document engine (SHIPPED)

Quarto scopes a cell's option schema to the **document's** engine. Session 164 taught this
extension to honour an explicit front-matter `engine:` override; when the front matter names no
engine — the ordinary case — quarto resolves one from the document's own cell languages
(`markdownExecutionEngine`: languages outer, engines inner; knitr claims `r`, jupyter claims
`julia`, markdown claims nothing; then any non-`ojs`, non-handler language forces jupyter; else
markdown). That answer is **document-wide and order-dependent**, and we were still scoping each
cell to its own language. Measured firsthand vs 1.7.33, `cache` being knitr-only and
closed-valued so `#| cache: banana` renders exit 1 iff quarto resolved knitr:

- `{julia}` then `{r}`, `cache` on the `{r}` cell → **exit 0** and we squiggled it (cardinal FP)
- `{r}` then `{python}`, `cache` on the `{python}` cell → **exit 1** and we were silent (lost TP)

**The language set is a transcription of quarto's own `languagesInMarkdown` regex, not a walk of
`findAllCells`** — a safety requirement, not a style choice: quarto's scan is context-free, so a
`{julia}` fence inside a ```` example block, a blockquote, a 4-space code block, an HTML comment,
a tab-indented fence or a front-matter block scalar all count for it and none are cells to us.
All six measured exit 0; a cell-list reading would have answered knitr on every one.

Layers, each RED→GREEN with a checkpoint commit: **L1** `1fec09e` the fallback + the
`{{< include >}}` decline (includes are expanded pre-engine and measurably flip the answer both
ways); **L2** `a203987` an UNMATCHED selector falls through while an UNREADABLE one declines;
**L3** `f0d306b` four integration pins, RED-verified twice; `bc4d61d` the oracle's verdict
recorded in the docstring; **L4** `e2413f6` the §9 review corrections.

**The §9 review found TWELVE cardinal-sin false positives L2 introduced**, all in the one
direction the module names as dangerous. Root cause in one sentence: before this session a
decline was inert (the caller fell back to the per-cell language, which was all it had), and the
language fallback turned a decline into a confident document-wide answer — knitr, on any document
holding an `{r}` cell. So `engine: &a markdown` / `*a` / `>-`+body / empty+continuation, the same
nested under `execute:`, an engine-named key with `!!bool true` / `&a true` / a `|` body / a
column-0 sequence, `execute: *a` and `execute: &a`, and a blank line before the opening `---` all
render exit 0 while we claimed knitr and squiggled the non-`{r}` cells. L4 fixes all twelve with
one rule — a shape we decline to READ must BLOCK the fallback, while one we read and find to name
nothing must not — and pins the neighbours it must not over-correct (`engine: banana`,
`engine: MARKDOWN`, `jupyter: false` all still fall through, measured exit 1). Two true positives
are given up knowingly (`engine: &a knitr`, `engine: |` + a literal body): telling them from their
exit-0 twins needs YAML chomping semantics. The review also caught five knitr-POSITIVE pins left
vacuous (the `{python}`-document rule applied in only one direction) and four false doc claims of
mine, including three shapes I called invisible to `findAllCells` that it sees perfectly well.

**Verification.** Unit 1449 → 1465; integration 477 passing / 0 failing, run four times (RED
twice with the fallback stubbed to its pre-S165 answer — the first RED caught an off-by-one in my
own test — then GREEN, then again on the shipping build after L4); `check-types` and both
test-file type-checks clean throughout; thirteen targeted mutants, each killing a specific pin. The
headline evidence is an end-to-end oracle replaying this feature's own flag decision against
`quarto render`'s exit code over **64 documents**, run against three builds via `git archive`:
pre-S165 `FP 16`, the flawed intermediate `FP 16` with **12 regressions**, the shipping build
`FP 4` — **18 improved, 0 regressed** against the pre-session baseline, with every remaining
false positive pre-existing and filed.

### 2026-07-25 · [ad hoc] Session 164 — IMPLEMENTATION: honour the front-matter `engine:` override (SHIPPED)

Quarto scopes a cell's option schema to the **document's** engine. This extension scoped it to
the **cell's language**, so an `{r}` cell in a document that had overridden its engine was
validated against knitr regardless — squiggling documents `quarto render` **accepts**.
**PRE-EXISTING** (`engineFor` has always keyed on the cell language alone). Filed by the
Session 161 §9 review, verified firsthand by S161, operator-selected at Phase 0.

Read from the render path rather than inferred:

```js
// renderFileInternal → validateDocument(context)
//   → validateDocumentFromSource(target.markdown, context.engine.name)
//     → partitionCellOptionsMapped(lang, cell.sourceWithYaml, true, engine)
let schema = engineOptionsSchema[engine];   // markdown | knitr | jupyter | julia
// and each of those four is `cell-*` filtered by the field's own tags.engine (makeEngineSchema)
```

The filter is the one `SchemaIndex.cellOptions` already implements, so the only missing input
was the engine NAME.

`src/core/document-engine.ts` (new) owns the rule. `documentEngineForScoping` reads the three
spellings of the override out of the document's own front matter — a top-level `engine: <name>`,
the same key under `execute:`, and a truthy top-level key literally NAMED after an engine
(`jupyter: python3`, or `jupyter:` above a kernelspec mapping) — and
`cellOptionScopeFor(lang, engine)` uses it in place of the language guess.

**Both directions, both measured.** `engine: markdown` + `{r}` + `#| cache: banana` renders
exit 0 and is now silent (it was flagged); `engine: knitr` + `{python}` + `#| cache: banana`
renders exit 1 and is now flagged (it was silent). An engine-agnostic option such as
`#| echo: banana` still renders exit 1 under `engine: markdown` and is still flagged — the
override narrows the scope, it does not turn validation off.

**Three deliberate limits, each grounded.** On an `.Rmd`/`.rmd` the override is IGNORED, because
`claimsFile` gives knitr the file before any front matter is read (measured: exit 1 there, exit 0
for the same text as `.qmd`) — and this extension's languageId opens `.Rmd`. When the front
matter selects *two* engines the resolver declines and narrows to the agnostic set, because
quarto's answer is genuinely order-dependent (the same two keys in opposite order render exit 1
and exit 0) and a project `engines:` list reorders the selector loop besides. And the
handler-language exemption (S162) still outranks the engine, because quarto swaps that schema by
LANGUAGE.

**The safety story was swept, not argued.** Our scope model was compared against quarto's own
`makeEngineSchema` filter over every one of the 43 `cell-*` fields this feature can actually flag
(`isWrongValue("banana", f)`), for all four engines: they agree exactly — no field we would flag
that quarto would not, and none quarto flags that we would not. `cellOptions("knitr")` is 43
fields and every other scope is the same 23, so only a *knitr* answer can widen anything; the
falsy-value table that guards it was measured spelling by spelling.

Residuals filed rather than folded in: the default (no-override) language path, `.Rmd`
whole-document knitr scoping, the FLOW spelling `execute: {engine: markdown}`, node-property
value spellings, the project `engines:` reorder, and a latent multi-engine `tags.engine`
modelling gap that is inert today.

**The §9 review earned its cost three times over.** It found three cardinal-sin false
positives this session had INTRODUCED, all in the one direction the design named as
dangerous (claiming knitr wrongly), each re-measured firsthand before any code moved:
an indented plain-scalar body read as a container (`knitr:` / `  false` — quarto exit 0,
we squiggled it); a node-property value read as a truthy string (`knitr: !!bool false`,
`&a false`, an alias — all exit 0); and two partitioner/ordering skews (a blank first
content line, which quarto's ENGINE partitioner rejects outright, and a later unreadable
`execute.engine` that overwrites an earlier `engine: knitr` — a mere case typo suffices).
L6-L8 fix all of them. The review also falsified five claims in the session's own prose,
including a handler-cell justification whose supporting measurement turned out to be a
graphviz syntax error misread as a chunk-option error.

Final state: an end-to-end replay of the feature's own scope decision against
`quarto render`'s exit code over 17 documents reports **zero cardinal false positives,
every case agreeing**.


### 2026-07-25 · [ad hoc] Session 163 — IMPLEMENTATION: honour quarto's `validate-yaml: false` escape hatch (SHIPPED)

Quarto documents a document-wide opt-out from YAML validation, and this extension ignored
it — squiggling documents `quarto render` **accepts**. That is the cardinal sin in its most
explicit form: the user has literally asked for validation to be off and we overrode them.
`features/yaml-value-diagnostics.ts` never read the key. **PRE-EXISTING.**

Two gates in quarto behave as one. The render pipeline skips its whole validation pass:

```js
const validate = context.format.render?.["validate-yaml"];
if (validate !== false) { const r = await validateDocument(context); ... }
```

and `readAndValidateYamlFromMappedString` repeats the test per mapped string
(`annotation.result["validate-yaml"] !== false`), which is what gives the **per-cell** form.

`src/core/validate-yaml.ts` (new) owns the rules; the feature consumes them. A top-level
front-matter `validate-yaml: false` now suppresses all three `.qmd` value surfaces, and a
cell may opt out on its own with `#| validate-yaml: false`, scoped to that cell.

**Grounded firsthand vs quarto 1.7.33 before any code** (`--no-execute`, 58 documents across
three passes, plus a read of quarto's own `validateDocumentFromSource`,
`parseAndValidateCellOptions` and the render-path gate in `bin/quarto.js`). Each probe was
paired with a control differing ONLY in the flag:

- **the value must be a YAML 1.2 core boolean.** `false`/`False`/`FALSE` disarm (exit 0);
  `no`/`No`/`off`/`n`/`"false"`/`'false'`/`0`/`null`/`~`/`true` do **not** (exit 1). The
  `no`/`off` row is the trap — YAML **1.1** would read those as booleans and quarto's parser
  does not, so a matcher built from that intuition would silence documents quarto validates.
- **position matters**: nested under `execute:` the key does nothing (exit 1).
- **per-cell scope**: disarms every key in its own cell; does **not** leak to the next cell;
  does **not** disarm the front matter; order-independent within the block; works under any
  comment char (`--|` in `{sql}`); only inside the cell's LEADING option run (S160), which
  `findCellOptionLines` already reports, so position needed no new check.
- **lexical**: a trailing `# comment`, extra spacing, trailing whitespace and a quoted key
  (`"validate-yaml": false`, and `#| "validate-yaml": false`) all disarm.

**THE HEADLINE — the filed item's prescription was wrong, and following it would have traded
a false positive for a lost true positive.** The item said "the gate belongs at the top of
`computeValueDiagnostics` (covering all three sources)". Measured: `validate-yaml: false` +
`format: banana` still renders **exit 1** with `Unknown format banana`, because an
unresolvable output format fails in format RESOLUTION — earlier than, and independently of,
the validation pass the flag gates. The control (`format: html` + the flag + an invalid cell
option) renders exit 0, so it is specifically the NAME that survives. The gate therefore sits
**below** the front-matter `format` branch, and an integration test guards exactly that.

**AND THE FORMAT NAME IS NOT THE ONLY SURVIVOR — this session first claimed it was, and the
§9 review caught it.** The exhaustive sweep the correction demanded: all **170** top-level
keys this feature can actually flag (`isWrongValue("banana", field)`, which is the domain that
matters — a key we cannot flag can never cost a true positive, the S162 `layout` lesson), one
render each with the flag set. **26 still render exit 1** — `toc`, `citeproc`, `ascii`,
`incremental`, `columns`, `dpi`, `wrap`, `eol` and 18 more — and each renders exit 1 without
the flag too, so every one is a real value error we reported before and are silent on now.
They survive because **pandoc** rejects them in its Aeson decoder, not the quarto YAML-schema
layer the flag gates. The remaining 144 render exit 0. The design stands on the measured trade
— 144 unconditional false positives removed against 26 lost true positives, and an over-flag
is the cardinal sin — but it is a trade, not the "one exception" the first draft asserted.
Not fixed here because the survivor set belongs to pandoc's decoder and shifts with pandoc
version and output format, so hard-coding 26 names is the brittle transcription Learning #174
warns about. Filed with the sweep. Also filed: four YAML spellings that disarm quarto and that
the raw-token matcher misses — anchored, tagged, aliased, and value-on-the-next-line — with
the trap that makes the obvious fix wrong (`!!str false` renders exit 1, `!!bool "false"`
renders exit 0, so a tag inverts the quoted-scalar rule).

**What it still does not see, recorded rather than glossed.** Quarto's gate reads RESOLVED
metadata, so the flag also arrives via a `format:` sub-key, `_quarto.yml` (project-wide, and
for `_quarto.yml` itself) and a directory's `_metadata.yml` — all measured at exit 0, all
still flagged by us, all filed. And per-format resolution **overrides** the top level: root
`validate-yaml: false` plus `format: html: validate-yaml: true` renders exit 1 while we now
stay silent — a lost true positive this change introduces, in the FP-safe direction, filed
and documented at the function.

`CellOptionLine` gained `cellStartLine` (additive) so option lines group back into cells
exactly, rather than by inferring cell identity from line-number adjacency.

Verification: check-types clean; unit **1399 → 1411**; integration **466 → 469**, RED-verified
against a real reverted tree first (3 failing, each for its stated reason — that run is also
what exposed one of the three integration tests as vacuous, since its "suppressed" line used
a key this feature never flags at document root; swapped to one it does).

### 2026-07-25 · [ad hoc] Backfilled (reconcile-on-read): undocumented commit `b30eadf` — the `validate-yaml: false` backlog item's scope grounded firsthand (S162 post-close-out)

Recorded at Session 163's Phase 0 reconcile. Session 162's `§9` review `Workflow` finished **after**
its close-out commit, so this one documentation commit landed past the S162 ledger entry above and
never got an entry of its own.

`b30eadf` (`BACKLOG.md` only, no code) grounds the still-open **`validate-yaml: false`** item that
S162 filed as its recommended next pick. All measurements taken firsthand against controls that
differ only in the flag:

- per-cell `#| validate-yaml: false` → **exit 0**, `#| validate-yaml: true` → **exit 1** — so it is
  the **VALUE** that disarms validation, not the presence of the key
- front-matter scalar: `validate-yaml: false` + `code-fold: banana` → exit 0, control → exit 1
- nested front matter: `execute:` / `echo: banana` → exit 0, control → exit 1

So the escape hatch covers **all three `.qmd` value surfaces**, and the mechanism is recorded too
(`partitionCellOptionsMapped`'s `validate` argument into `parseAndValidateCellOptions`, the same
`if (schema === undefined || !validate)` short-circuit S162's handler scope is built on). Whether
`_quarto.yml` honours the flag remains ungrounded.

No behaviour change — documentation only.

### 2026-07-25 · [ad hoc] Session 162 — IMPLEMENTATION: a cell-HANDLER language is validated by no cell schema (SHIPPED)

Quarto registers a small set of cell **handlers** — `handlers/languages.yml` is exactly
`["mermaid","dot"]` — and `parseAndValidateCellOptions` swaps the engine's cell schema for
`handlers/<lang>/schema.yml` when the cell language is one of them:

```js
let schema = engineOptionsSchema[engine];
if (getYamlIntelligenceResource("handlers/languages.yml").indexOf(language) !== -1) {
  try { schema = getYamlIntelligenceResource(`handlers/${language}/schema.yml`); }
  catch (_e) { schema = undefined; }
}
if (schema === undefined || !validate) { /* parse WITHOUT validating */ }
```

`handlers/dot/schema.yml` does not exist, so the lookup throws and **nothing** in a `{dot}` cell
is validated; `handlers/mermaid/schema.yml` does exist but declares only `mermaid-format` and
`theme` and admits every other key. Either way no `cell-*` field reaches a handler cell, so
`features/yaml-value-diagnostics.ts` was squiggling documents quarto **accepts** — the cardinal
sin. **PRE-EXISTING**: the pre-S161 hard-coded `//` reached `{dot}` identically.

`cellOptionScopeFor` (`src/core/yaml-context.ts`) now returns a new `"none"` scope for a handler
language, and `SchemaIndex.cellOptions("none")` is the empty set — the last point on the same
narrowing axis S161 L2 opened: full ⊇ engine ⊇ intersection ⊇ ∅. `"none"` needs its own branch
because, unlike `"unknown"`, it is not expressible as a filter over `SchemaField.engine`: it must
drop the engine-**agnostic** fields too.

**Grounded firsthand vs quarto 1.7.33 before any code** (`--no-execute`, 53 documents, plus a read
of quarto's own `parseAndValidateCellOptions`). In a markdown-engine document `{dot}` + `//| echo`,
`fig-align`, `eval`, `cache`, `code-fold` each `: banana` all render **exit 0**, as do `{mermaid}`
+ `#| echo: banana` and `%%| echo: banana`; the control `{sql}` + `--| echo: banana` renders
**exit 1**, as do 12 further languages spanning every comment-char family including the unknown
`{banana}` — so the exclusion is provably minimal. Post-fix agreement measured on 14 documents:
**0 disagreements**.

**Two facts the filed item did not carry, both load-bearing.** (1) The handler match is
**CASE-SENSITIVE** — quarto tests `languages.indexOf(language)` against the raw fence token with
no folding, so `{DOT}`, `{Dot}` and `{Mermaid}` are ordinary unknown languages and each renders
**exit 1** on `#| echo: banana`. A case-folding exclusion would have converted three measured true
positives into silence; the pin that guards this kills a `toLowerCase` mutant. (2) The item's claim
that quarto "renders ANY option value in those cells exit 0" is **false for `{mermaid}`**: its
handler schema enforces `mermaid-format` (`%%| mermaid-format: banana` → exit 1) and `theme`
(rejects a non-scalar). Neither is a member of `cellOptions()`, so the fix is unaffected.

**What the suppression costs, measured rather than asserted.** The §9 review found that L1's
"costs no true positive" was false, and firsthand adjudication upheld it. An exhaustive sweep of
all **47** keys this feature can flag in a `{dot}` cell, one render each, in both engines: a
markdown-engine document renders **46 of 47 exit 0** — the exception, `layout`, is an OPEN-valued
field we never flagged either way, so every key we could actually FLAG renders exit 0 there — while
a **knitr** document makes exactly one flaggable key —
`include` — a real value-dependent failure (`//| include: banana` → exit 1 from knitr's own
`if (options$include)`; `//| include: false` → exit 0). We flagged it before and are silent now.
The trade is deliberate: `cellOptionScopeFor` receives only the cell LANGUAGE and cannot know the
document engine, so it is one conditional false negative against 46 unconditional false positives,
and an over-flag is the cardinal sin. A second, narrower true positive is also given up —
`` ```{mermaid=x} `` is the language `mermaid=x` to quarto (its recognizer is `([=A-Za-z]+)`, `=`
inside the class) and takes the ordinary schema, but our `CELL_INFO` truncates at `=` so it
arrives as `mermaid` and matches. Both are filed, with the `engine:` override and the `CELL_INFO`
fence-token deliverable that would respectively fix them.

**Scope held to validation.** Emission and completion are deliberately untouched, and both are
pinned against the plausible-but-wrong alternative fix. For `{dot}`/`{mermaid}` specifically the
only live consumer of the enumerator besides diagnostics is cell-option **completion** — the
embedded virtual-doc builders bail on an unmapped `cellLanguageId` before consulting option lines,
and neither `core/refs.ts` nor `core/cell-background.ts` calls it at all.

Strict TDD, six layers, RED verified per layer by measurement: the scope pin RED against the real
pre-fix tree, the `"none"`-is-empty pin RED with the branch reverted (it returned `echo`, `eval`,
`code-fold` — precisely the FP set), the two preservation pins RED against targeted mutants, and
the integration layer RED against a reverted `cellOptionScopeFor` (the pre-fix tree reported
`flagged lines: 5,6,11,16,21`). Unit 1393 → 1399, integration 464 → 466, check-types clean; the
GREEN integration run doubles as the Phase 3E runtime smoke test.

**The review's own accounting.** `wf_3e866168-ab8` — 6 lenses, 2 adversarial refuters per
finding, 47 agents. Every finding acted on was confirmed firsthand before acting, including
re-deriving the key sweep rather than trusting the lens (which corrected its count). The code was
right throughout; what the review kept finding was that the STORY told about it was not — a
four-consumer blast-radius claim wrong on all four counts, "costs no true positive", "theme is
unenforced", four unqualified "renders exit 0" sites, "Three scopes" listing four, "every one of
those lines was flagged" (it was five of seven), a TS2345 no check in this repo can see, and —
the worst — an L2 completion pin that named the exact wrong fix it guarded and then failed to
catch it, because it asserted `.kind` where the provider filters on `.engine`.

Commits: `a60fd10` (L1 fix + unit pins), `dd51509` (L2 blast-radius pins), `82bda78` (L3
integration), `e36c1ac` (L4 stale docstring), `33cf8b6` (L5 four review-found defects in my own
work), `a101fe9` (L6 two false claims about what the suppression costs), `5a2ede1` (L7 the
markdown half of the sweep, measured rather than inferred: 46 of 47), `523a283` (L8 the vacuous
completion pin plus two more false claims, from the sixth lens).

### 2026-07-25 · [ad hoc] Session 161 — IMPLEMENTATION: the cell-option comment char is scoped to the cell LANGUAGE (SHIPPED)

`findCellOptionLines` (`src/core/qmd/model.ts`) hard-coded exactly two comment characters
(`#` and `//`) while quarto builds its cell-option directive pattern **per cell language**
from its own `kLangCommentChars` table (`^<comment>\s*\| ?`). One root cause, defective in
**both** directions, both grounded firsthand vs quarto 1.7.33 (`--no-execute`, 57 documents)
**before any code**:

- **Lost true positive** — `{sql}` + `--| echo: banana` renders **exit 1** with a real
  `Field "echo" has value banana`, and we emitted nothing.
- **Cardinal-sin false positive** — `{sql}` + `#| echo: banana` renders **exit 0** (quarto
  reads no directive there at all) and we emitted it for value-diagnostics to squiggle.

Both patterns are now built per cell from quarto's table, once per cell rather than per
line, with no process-lifetime cache (the key is a user-supplied fence token). The
strict/permissive split S160 introduced is preserved: the strict pattern decides what is
EMITTED, the permissive one where the block ENDS.

**Grounding overturned the filed item twice.** (1) A **block-comment** language (`c`, `css`,
`sas`, `ocaml`) carries a *second* delimiter: quarto requires `line.trimEnd().endsWith(suffix)`,
strips it from the YAML content, and treats a line lacking it as a NON-directive — so it also
ENDS the block. Measured both ways: a closed directive renders exit 1, the same line unclosed
renders exit 0. (2) The lookup is **case-SENSITIVE** — quarto never lowercases the fence token,
so `{SQL}` is simply an unknown language taking the `#` default (`{SQL}` + `--|` → exit 0,
`{SQL}` + `#|` → exit 1).

**Two false positives this session's own first layer would have shipped, each caught by its
own verification and fixed before release.** Neither was in the filed item.

- **Engine scope.** Quarto scopes its cell schema to the DOCUMENT's engine, which a cell
  language does not determine. `{sql}` + `--| cache: banana` renders exit 1 in a knitr
  document but **exit 0** in a markdown- or jupyter-engine one. Resolving newly-emitted keys
  against the full field set would have squiggled a document quarto accepts, so
  `cellOptionScopeFor` maps an undeterminable engine to a new `"unknown"` scope —
  the engine-agnostic intersection. Completion still passes `engineFor`, since an over-offer
  is benign where an over-flag is not.
- **The block-comment closer in the value span.** Value-diagnostics re-derives spans from the
  RAW line text (it must resolve the true YAML separator, S159), which still carries the
  closer — so `/*| echo: false */`, a **valid** directive quarto renders exit 0, failed
  `echo`'s closed set as `false */`. `CellOptionLine.contentEndCol` is the bound the feature
  now clamps to; for every line-comment language it is the end of the line, so the clamp is
  provably a no-op there.

**The mandatory §9 adversarial review** (`wf_c7cd5eb0-9af`, 6 lenses, 34 agents,
`agents_error:0`, ~1.99M subagent tokens) raised 5 findings; **all 5 were confirmed
firsthand before acting**. Two were defects in this session's own work and were fixed: the
engine-scope integration pin justified itself with a **false claim** — its document contained
an `{r}` cell, which makes the document knitr, so quarto renders it exit 1 and the assertion
was pinning an accepted safe false negative while claiming to guard a false positive (found
independently by two lenses; the control now lives in its own document) — and `escapeRegExp`
was load-bearing but unpinned, since ocaml's `(*` is the only opener with a regex grouping
metacharacter (an `{ocaml}` pin now kills that mutant, and is the only test that does).
Three findings are PRE-EXISTING with root causes of their own and are filed: handler
languages (`{dot}`/`{mermaid}`) are never schema-validated by quarto; a digit-bearing fence
token (`{fortran95}`, `{d3}`) is not a cell to quarto at all; and front-matter `engine:`
overrides the document engine. The old hard-coded `#`/`//` reached all three identically, so
this change widens none of them — and in each case it silences one of the two directions.

Strict TDD, six checkpoint-committed layers. 32 tests added: 21 in the enumerator (16 RED
against a real pre-fix tree; the rest RED against targeted mutants — a lowercasing lookup, a
prototype-walking index, an unescaping `escapeRegExp`), 8 consumer pins for the vdoc and
completion surfaces, 3 schema/scope pins, and 4 end-to-end integration tests. Commits
`3eb7d96` (L1), `ab54333` (L2), `53a99f2` (L3), `8e6058b` (L4+L5), `b05ea4c` (L6).
unit **1361 → 1393**, integration **460 → 464**, exit 0, runtime smoke PASS.

### 2026-07-25 · [ad hoc] Session 160 — IMPLEMENTATION: the `#|` leading-option-block cardinal-sin FP (SHIPPED)

`findCellOptionLines` (`src/core/qmd/model.ts`) now reports only a cell's **leading
contiguous block** of `#|`/`//|` directive lines, as quarto does. It previously scanned
every body line — resetting the continuation state on a non-directive line but carrying
on — so it emitted directive-looking lines anywhere in the cell and value-diagnostics
squiggled them. That flagged documents `quarto render` **accepts**: the cardinal sin.

Grounded firsthand vs quarto 1.7.33 (`--no-execute`, ~45 documents) **before any code**.
The block ends at the first body line that is not a directive, and four terminator shapes
each render **exit 0** for an invalid option below them: **code**, a **blank line**, a
**whitespace-only line**, and a **plain `# comment`** — on both the `#` (python/r/knitr)
and `//` (ojs) comment-char families. Four shapes that look like terminators are not, and
still render **exit 1**: a bare `#|`, a `#| ` with empty content, a gapless `#|key:`, and
a spaced `# | key:`. Testing the *directive pattern* rather than "is this code" is what
makes the terminator set exactly quarto's.

**A pre-existing test pinned the bug.** `"finds multiple option lines and ignores
interleaved code"` asserted `[1, 2, 4]` on the ungrounded comment *"not contiguous, but
still a `#|` line"*. That exact document renders exit 0; move the same option into the
leading block and it renders exit 1. Corrected to `[1, 2]`, with the measurement recorded
at the site.

**The §9 review found a defect in this session's own fix, and firsthand adjudication
upheld it.** L1 reused `CELL_OPTION_PREFIX` as the terminator, but that regex is
deliberately stricter than quarto's real predicate (`^<comment>\s*\| ?`) because it must
also slice the line into key/value spans: its gap is `[ \t]` not `\s`, and it ends
`(.*)$` where `.` excludes U+2028/U+2029. Harmless while it only decided whether *one*
line was emitted — but the `break` promoted it to deciding how *long* the block is, which
turned a one-line false negative into a whole-cell **lost true positive**. Measured: a
non-breaking space or vertical tab in the gap, or a U+2028 in a directive's value, each
renders exit 1 with a real `Field "echo" has value banana`, was reported pre-S160, and
was silent after L1. Fixed by splitting the roles — a new permissive
`CELL_OPTION_DIRECTIVE` decides where the block **ends**, `CELL_OPTION_PREFIX` still
decides what is **emitted** — so an unparseable directive line is skipped rather than
ending the block. Emission is unchanged, so the correction can only restore true
positives, never add a diagnostic.

Blast radius, all pinned: a below-the-block `#|` line is now **code**, so it stays in the
language vdoc, forwards to the language server, and no longer offers cell-option
completion — which is what quarto treats it as. The documented invariant
`embeddedLanguagesIn(text) ⟺ buildVirtualContent(text,L).trim() !== ""` still holds.

Verification: check-types clean; unit **1340 → 1361**; integration **458 → 460**, runtime
smoke exit 0. All 8 recovery pins RED-verified against a real pre-fix tree; every
over-suppression pin RED against a targeted mutant; the per-cell pin strengthened after
the review showed a "terminates only in the first cell" mutant surviving it. §9 review:
`wf_f82621a3-a49`, 6 lenses + 2 independent refuters per finding, **34 agents**,
`agents_error: 0`, `agents_empty_result: 0`, 2.53M subagent tokens.

Residuals filed in `BACKLOG.md`, including a **correction to a previously-filed root
cause**: quarto does validate `{sql}` cell options — via `--|`, SQL's comment char — so
the `{sql}` and wrong-comment-char items are not "engine scope" and not two defects, but
one hard-coded-comment-char root cause that is both a lost TP and an FP across 13+ cell
languages.

### 2026-07-25 · [ad hoc] Session 159 — IMPLEMENTATION: the quoted-KEY divergence, `.qmd` front-matter surfaces (SHIPPED)

Brought the `.qmd` front-matter VALUE-diagnostics surfaces to key-unquoting parity
with `_quarto.yml`: a YAML mapping key now has one matching layer of quoting stripped
before it is resolved against the schema's bare field names. Filed Session 149 (§9
review surface-parity lens) as a LOW, safe-direction parity gap.

**Not a parity nicety — a LIVE lost true positive.** Grounded firsthand vs `quarto
render --no-execute` 1.7.33 BEFORE any code: `"toc": banana` (top level), `execute:` /
`  "echo": banana` and `format:` / `  html:` / `    "toc": banana` (nested), and
`#| "echo": banana` (cell option) ALL render **exit 1 with a real VALUE error** — the
same `Field "X" has value banana, which must instead be …` quarto gives the unquoted
line — yet every one was SILENT. Single-quoted forms behave identically, and
`"format": banana` additionally bypassed the format-NAME path, which the consumer
reaches only when the key literal equals `format`.

Fix: one shared `unquoteKey`, moved from `project-yaml.ts`'s private helper to
`yaml-context.ts` (the module that already hosts the shared YAML grammar) and applied
in `findFrontMatterValueLines` and `findNestedFrontMatterValueLines`. It requires a
MATCHING leading/trailing pair, which keeps it FP-safe: `"toc` and `"toc" x` are left
intact, resolve against no field, and stay silent — and both are documents quarto
rejects with a structural `YAMLException`, never a value error (Learning #171b).
`"toc ": banana` (space inside the quotes) is a DIFFERENT key that quarto accepts
**exit 0**; it unquotes to `toc ` and stays silent. Escapes are deliberately not
decoded (`"\u0074oc"` stays a safe FN — the same limitation the value-side `unquote`
carries). Resolves the nested-value plan's §10 Q2, which had recommended mirroring the
top-level "quotes retained" imprecision and revisiting "only if the review shows a real
miss."

**The mandatory §9 adversarial review (5 lenses, 19 agents) raised a HIGH finding
against this change and firsthand adjudication upheld it**, so the session also
shipped a correction and a partial revert:

- `mappingColonAt` scanned for the first colon followed by whitespace WITHOUT skipping
  a quoted key, so `"a: b": "text` split inside the quotes and the enumerators'
  continuation guard never armed — the line quarto FOLDS into that value was read as a
  real mapping and flagged, on documents quarto renders **exit 0**. Measured with the
  real enumerators against the real installed schema: with a BARE folded key that FP
  was already live pre-S159; unquoting would have widened it to quoted folded keys.
  The separator scan now skips a quoted key region (honoring YAML escapes), which only
  ever moves the scan start later — so it can turn a mis-split into a correct split or
  into "no separator", never invent one. Net: the widening is gone AND the pre-existing
  front-matter FP is gone.
- The **cell-option half was REVERTED**. Its arm token comes from `findCellOptionLines`'
  own `m[4].indexOf(":")`, so `#| a:b: "text` disarms the guard the same way; that FP is
  likewise pre-existing with a bare folded key. `model.ts` is deliberately import-free
  (`yaml-context.ts` imports IT), so it cannot share the fix without the cross-module
  grammar consolidation `BACKLOG.md` already tracks. Filed with its grounding and the
  required fix order (arm grammar first, then the unquote) rather than shipped.

The review also surfaced a **live PRE-EXISTING cardinal-sin FP unrelated to this work**
— a `#|` line after code in a cell (`` ```{python} `` / `1+1` / `#| echo: banana`)
renders exit 0 and we flag it — verified firsthand and filed as the recommended next
pick.

unit 1329 → 1340, integration 456 → 458, check-types clean, runtime smoke PASS.

### 2026-07-25 · [ad hoc] Backlog grooming (post-S158, operator-directed) — filed the CHANGELOG-header format migration

Filed a new `BACKLOG.md` "Up Next" item (operator request): migrate this file's
header/preamble to the current v3.1+ "Authoritative Action Ledger" seed format so
`bin/status` no longer flags it `present (stale format)`, keeping every existing dated
entry intact. No behavioral change — a standalone header swap for a future session.

### 2026-07-25 · [ad hoc] Session 158 — IMPLEMENTATION: the block-scalar (`|`/`>`) cell-option false-positive fix (SHIPPED)

Made `findCellOptionLines` (`src/core/qmd/model.ts`) block-scalar-aware. Quarto
folds every `#|` line of a cell into ONE YAML block, so a cell-option value that
opens a YAML block scalar (`|` literal / `>` folded, with optional chomping/indent
indicators + trailing comment) folds every MORE-indented following `#|` line into
its literal content. The enumerator's continuation state (`scanFlow`) tracked only
quotes + `{}[]` flow depth — never `|`/`>` — so `#| fig-cap: |` / `#|   echo:
banana` had its folded `echo: banana` emitted as an independent option and
value-diagnostics flagged it: a cardinal-sin FALSE POSITIVE on a doc quarto renders
**exit 0**. Filed S154/S155 (§9 gate-completeness lens), PRE-EXISTING (byte-identical
pre/post the S154 arming work), LOW/pathological.

Fix: track an open block scalar by the folded-indent of its opening key (the
post-pipe whitespace `m[3]` minus the ONE space quarto's `^#\s*\| ?` directive
strips — `CELL_OPTION_PREFIX` captures that indentation into `m[3]` and drops it
from `m[4]`). Skip every blank `#|` line and every line MORE indented than the
opener; the first non-blank line back at or below that indent ENDS the block and is
a real option again (strictly-greater is quarto-faithful — a sibling at the same
folded-indent renders exit 1). The node-property strip is reused, so an anchored
block scalar (`&a |`) arms too. A new `BLOCK_SCALAR_HEADER` regex gates the arm.

Grounded firsthand vs `quarto render --no-execute` 1.7.33 BEFORE any code
(esbuild-bundle of the import-free `model.ts` + real exit codes): the FP shapes
(`|`, `>`, `|-`, `| # comment`, `&a |`, `>-`, `|2`) render exit 0; a bare
`#| echo: banana` and a DEDENTED sibling render exit 1; blank `#|` lines stay in
the block. Strict TDD, per-layer RED→GREEN with per-boundary checkpoint commits:
unit describe (8 pins; 7 RED-verified against the pre-fix source, 1 an over-arming
mutant-verified regression guard), unit 1321→1329; 2 integration tests VERIFIED RED
against the pre-fix source (454/2-fail → 456/0), runtime smoke PASS. Mandatory §9
review (`wf_bba35d38-f9f`, 5 lenses + adversarial verify): 3 lenses CLEAN
(missed-sites — the 3 value enumerators are indent-based by construction, no
block-scalar FP; header-regex; indent-model), 2 findings both adjudicated firsthand
and fixed in-session (a vacuous plain-pipe pin → made non-vacuous; an intermediate-band
over-skip → documented as an immaterial safe-FN that fires only on docs quarto
already rejects with a structural `YAMLException`). Commits `a64ec4b` (fix+unit),
`7535fb8` (integration), `202d69f` (§9 test-quality + doc), + this close-out.
PROJECT_LEARNINGS #171.

### 2026-07-25 · [ad hoc] Session 157 — IMPLEMENTATION: the continuation-path node-property-blind scanFlow lost-TP fix (SHIPPED)

Fixed the SIBLING decision path to the single-line arm S156 corrected, at the
shared root. `findCellOptionLines` (`src/core/qmd/model.ts`) decides "does this
`#|` value open a multi-line fold?" in two places — the single-line arm (S156)
and the multi-line-continuation skip `scanFlow(m[4], …)` (~:547). The shared
`scanFlow` helper was node-property-blind for QUOTES: a quote inside a YAML
node-property NAME (anchor `&a'b`, alias `*a'b`, tag `!t'x`) is a legal
`ns-anchor-char`, not a scalar delimiter, but `scanFlow` read it as opening a
quoted scalar. So an anchor-name quote in a CONTINUATION line of an already-open
flow — or MID-flow on a single line (`#| myopt: [one, &a'b]`) — armed a phantom
quote that swallowed the following real `#|` option, a lost TRUE POSITIVE.

Fix: `scanFlow`'s outside-quotes branch now recognizes a node-property introducer
(`&`/`*`/`!`) and skips its NAME (to the next whitespace or c-flow-indicator
`,[]{}`), so a quote in the name is never a delimiter. Brackets terminate the
name, so depth counting is unchanged — only the spurious quote-open is prevented.
Being in the shared helper, this correctly fixes the same latent defect on all
four enumerator surfaces (cell-option continuation + single-line arm, and the
three front-matter/project VALUE enumerators), with no regression (§9
over-suppression lens clean; missed-sites lens confirmed the blast radius).
Also corrected `scanFlow`'s docstring (it falsely claimed whole-token scanning
was "node-property-aware" — it was aware of brackets, blind to quotes-in-names)
and the `findCellOptionLines` residual comment.

Grounded firsthand vs quarto 1.7.33: `#| myopt: [` / `#| one, &a'b` / `#| ]`
folds a list (exit 0) and flags only the swallowed `#| echo: banana` (exit 1) —
a genuine lost TP; the double-quote (`&a"b`) variant is identical. Strict TDD:
6 unit pins (5 RED-verified recovery + 1 preservation), unit 1315→1321; 2
integration tests RED-verified against the pre-fix source (recovery test failed
453/1 → 454/0), integration 452→454; check-types clean; runtime smoke PASS.

The mandatory §9 review (5 lenses + adversarial verify, `wf_2be01ba3-f22`,
14 agents, `agents_error:0`) confirmed the fix correct and found 3 test-quality
gaps (all fixed in the same session, not filed): the no-over-suppression
integration guard used `#| number-sections` on the folded line — NOT a validated
CELL option, so the guard was vacuous (switched to a folded `#| echo`, fixing the
identical pattern in the S156 sibling test too); unit U4 used a quote-free tag
`!!str x` that did not discriminate the `!` arm (switched to `!t'x`); and the
double-quote `&a"b` continuation shape was unpinned (added). It also confirmed
BACKLOG.md still listed this now-fixed item (removed here at close-out).

### 2026-07-24 · [ad hoc] Session 156 — IMPLEMENTATION: the findCellOptionLines strip over-exclusion parity fix (SHIPPED)

Corrected the node-property strip in the `#|`/`//|` cell-option enumerator
(`findCellOptionLines`, `src/core/qmd/model.ts`) from the over-excluding
`[^\s[\]{}"']` to the YAML-exact `[^\s,[\]{}]`, matching the three front-matter/
project VALUE enumerators (S155). A quote is a LEGAL YAML anchor-name char (the
c-flow-indicators an anchor NAME may not contain are ONLY `,[]{}`), so the old
charset stopped the strip at a quote INSIDE an anchor name (`&a'b`), leaving `'b`
whose `'` armed a phantom quote that swallowed the following real `#|` option.

Grounded firsthand vs quarto 1.7.33: this is a genuine lost TRUE POSITIVE, NOT
the safe FN the backlog had filed it as (with the lost-TP question flagged
UNVERIFIED). `#| myopt: &a'b` (an unknown/null-tolerant option) renders exit 0,
so the swallowed `#| echo: banana` (exit 1) is the SOLE error — a real dropped
diagnostic. Strict TDD: 4 unit pins (3 RED→GREEN + 1 preservation), unit
1311→1315; 2 integration tests RED-verified against the pre-fix source
(451 passing/1 failing → 452/0), integration 450→452; check-types clean;
runtime smoke PASS.

The mandatory §9 review (5 lenses + adversarial verify, `wf_06a97818-8e0`,
`agents_error:0`) found — and I filed, not fixed — a separate PRE-EXISTING lost
TP: the multi-line-continuation `scanFlow` (~line 547) is node-property-blind, so
an anchor-name quote in a CONTINUATION line of an already-open flow still swallows
the following option (grounded firsthand; the continuation path is byte-identical
pre/post-S156). Corrected the fix's own comment to name that real residual rather
than the benign single-line shape it had cited.

### 2026-07-24 · [ad hoc] Session 155 — IMPLEMENTATION: the abutting-anchor node-property strip fix, 3 value enumerators (SHIPPED)

Corrected the node-property strip in the three `.qmd`/`_quarto.yml` VALUE enumerators
(`findProjectConfigValueLines` in `src/core/project-yaml.ts`, `findFrontMatterValueLines` in
`src/core/yaml-frontmatter-values.ts`, `findNestedFrontMatterValueLines` in
`src/core/yaml-frontmatter-nested-values.ts`) so the continuation-guard arm correctly SEES a flow
opener abutting an anchor (`&a[one,`, no space). The S153 strip `/^(?:[&!][^\s]*[ \t]+)+/` let its
greedy `[^\s]*` swallow the abutting `[` and then, finding no required trailing whitespace, stripped
nothing — so the opener was read as `&`, the arm never fired, and the folded continuation was
emitted and flagged. **NOT latent as filed:** grounded firsthand vs quarto 1.7.33, list-accepting
keys make the fold render exit 0 on all three surfaces — `resources: &a[one,`/`toc: banana]`
(project), `keywords: &a[one,`/`df-print: banana]` (fm), `format:`/`html:`/`fig-cap: &a[one,`/
`number-sections: banana]` (nested) — so the folded closed-enum key was flagged on a document quarto
ACCEPTS: a live cardinal-sin false positive on all three surfaces (S154 filed it as latent because it
only tried `title:`, a non-list key that renders exit 1). Fixed with the YAML-exact anchor-name
charset `/^(?:[&!][^\s,[\]{}]*[ \t]*)+/` — excludes ONLY the flow indicators `,[]{}`; KEEPS quotes,
which are legal anchor-name chars. The mandatory §9 review caught that the initial port of S154's
`[^\s[\]{}"']` charset over-excluded quotes, causing an over-suppression false-NEGATIVE regression
(`myref: &a'b` phantom-folds a following real key quarto rejects, exit 1) — corrected in-session with
the YAML-exact charset. Strict TDD, per-site RED→GREEN; integration verified RED against pre-fix code
(`git checkout daae2a7`) then GREEN. Unit 1305→1311, integration 447→450, check-types clean, runtime
smoke PASS. Commits `4e4a48f`/`9fb2243`/`51b46e6` (initial abutting fix), `4d13b38` (integration, 3
surfaces + fixture), `a0e12d9`/`8114fd4`/`b93592b` (charset over-suppression correction), `97f1b5f`
(§9 test-quality fixture-comment fix). §9 review `wf_d4d42586-d66` (5 lenses + adversarial verify,
`agents_error:0`, `agents_empty_result:0`). Filed: the identical charset over-exclusion on the
cell-option site (`src/core/qmd/model.ts`, S154's surface — safe-FN there).

### 2026-07-24 · [ad hoc] Session 154 — IMPLEMENTATION: the `findCellOptionLines` phantom-quote FN fix (SHIPPED)

Brought `findCellOptionLines` (`src/core/qmd/model.ts`, the `#|`/`//|` cell-option enumerator — the
THIRD and last continuation-guard arming site) to the SAME first-char-opener arming discipline the
three value enumerators already share, closing the last site of the phantom-quote defect class S153
fixed in the two `.qmd` front-matter enumerators (PROJECT_LEARNINGS #166). Grounded firsthand vs
`quarto render` 1.7.33 before writing code.

- **Defect A (phantom-quote FALSE NEGATIVE):** the arm scanned `scanFlow` over the WHOLE post-prefix
  token (`key: value`), so an inner apostrophe/quote/bracket in a PLAIN value armed a phantom quote
  whose continuation guard swallowed the following real option. `#| fig-cap: Don't do this` (quarto
  exit 0) swallowed `#| echo: banana` which quarto REJECTS (exit 1) — never flagged. Fixed by
  narrowing the arm to the VALUE token's first character (past a stripped node property) opening
  `"'[{`, mirroring `project-yaml.ts` `findProjectConfigValueLines`.
- **Node-property strip hardening (§9 review, cardinal-sin FP the narrowing would otherwise
  introduce):** the ported strip regex `/^(?:[&!][^\s]*[ \t]+)+/` did not strip an anchor/tag
  ABUTTING a flow bracket (`&a[one,`, no space — js-yaml/quarto accept and fold it, exit 0), so it
  under-armed and flagged the folded continuation. Fixed to `/^(?:[&!][^\s[\]{}"']*[ \t]*)+/` (a
  strict superset of the old strip — only arms more, the FN-safe direction).

Strict TDD: unit 1300→1305 (RED→GREEN + boundary/regression pins), integration 445→447 (2 end-to-end
tests in a real host — the previously-swallowed `#| echo: banana` now flags; a genuine multi-line
quoted `#| fig-cap` still folds its continuation, canary-proven non-vacuous). Mandatory §9 review
`wf_7456a5f0-85a` (4 lenses + adversarial verify, `agents_error:0`) — caught the abutting-anchor FP
(fixed) and two out-of-scope items (the same weaker strip regex latent in the 3 reference enumerators;
a pre-existing block-scalar `|`/`>` cell-option FP), both filed in `BACKLOG.md`.

### 2026-07-24 · [ad hoc] Session 153 — IMPLEMENTATION: the `.qmd` sibling-enumerator OLD arming fix (SHIPPED)

Brought the two `.qmd` front-matter value enumerators — `findFrontMatterValueLines`
(`src/core/yaml-frontmatter-values.ts`) and `findNestedFrontMatterValueLines`
(`src/core/yaml-frontmatter-nested-values.ts`) — to the SAME multi-line-continuation arming
discipline `findProjectConfigValueLines` (`_quarto.yml`) already had, closing the last two value
enumerators that still used the OLD whole-token, emit-only arming. Two defects fixed per enumerator,
both grounded firsthand vs `quarto render` 1.7.33 (blast radius bounded by the `---` fences):

- **Defect B — the cardinal-sin false POSITIVE.** The continuation guard was armed only from EMITTED
  lines, so a multi-line quoted/flow scalar opened on a SKIPPED line (an indented line, a
  block-sequence item, a column-0 line for the nested pass) left its fold unguarded, and a folded
  mapping-looking continuation was emitted and flagged with an Error squiggle on a document quarto
  renders exit 0. Grounded: `format:\n  html:\n    css: "styles\ndf-print: banana\nmore"` folds
  df-print into css (exit 0) yet the top-level enumerator emitted+flagged df-print; `title: "My
  great\nexecute:\n  echo: banana\nend"` folds echo into title (exit 0) yet the nested enumerator
  emitted+flagged echo. Fixed by arming ABOVE the emission scope guards, for every scalar-bearing
  line.
- **Defect A — the phantom-quote false NEGATIVE.** The arm scanned the WHOLE value token, so an inner
  apostrophe in a plain scalar (`title: Don't Panic`, quarto exit 0) armed a phantom `'` that
  swallowed the rest of the front matter — silently disabling validation of every following key.
  Fixed by narrowing the arm to a token whose FIRST character (past a stripped leading node property
  `&anchor `/`!tag `) opens `"'[{`; the node-property strip keeps the anchored-opener case
  `foo: &a { …` arming, which is why the old code scanned the whole token.

Strict TDD (RED→GREEN per enumerator; the Defect-B FP test emitted the folded key before the fix).
Unit 1293→1300 (56 files, zero regressions — all prior arming tests, incl. the §7.2 block-scalar and
anchored/quote-aware flow locks, unchanged); integration 441→445 (four end-to-end tests in a real
Extension Development Host: FP shapes produce no diagnostic while a `df-print: banana` canary does,
FN shapes now flag the previously-swallowed key). Commits `cae6a66` (site A), `250c489` (site B),
`bc4e612` (integration), `9759fb7` (doc-drift: the stale `project-yaml.ts` divergence note, Learning
#10). Mandatory §9 review (`wf_e7af7feb-c34`, 4 lenses + adversarial verify, `agents_error:0`) came
back CLEAN on the two changed enumerators: over-suppression confirmed the `"'[{` gate complete and
the new arm a strict subset of the old; branch-interaction confirmed the emission gate byte-identical
(no new FP); re-grounding independently reproduced all four verdicts and proved the pins non-vacuous;
the only surviving finding was the out-of-scope missed-site below. **Filed (out of scope, FM #26):**
`findCellOptionLines` (the THIRD value enumerator, `#|` cell options) has the SAME Defect A —
`#| fig-cap: Don't do this` swallows a later `#| echo: banana` (quarto exit 1) — grounded firsthand;
a differently-structured surface needing its own slice.

### 2026-07-24 · [ad hoc] Session 152 — IMPLEMENTATION: format-name Combo 3 — validate the top-level scalar `format:` NAME in `_quarto.yml` (SHIPPED)

Closed the last top-level-scalar divergence between the `.qmd` and `_quarto.yml` value surfaces: a
wrong output-format NAME at column 0 of `_quarto.yml` (`format: banana`) now squiggles, matching
`quarto render` 1.7.33's `_quarto.yml` schema-layer rejection (grounded firsthand: exit 1, `Field
"format" has value banana, which must instead be 'ansi'`). Implemented as a ~15-line branch in
`src/features/yaml-project-value-diagnostics.ts`'s `"document"` arm running the SAME bespoke
predicate the `.qmd` surface has used since S145 (null-gate → flow/block/backslash hygiene skip →
`unquote` → `isKnownFormatName` → `formatNameMessage`), NOT `isWrongValue` (which cannot see
`format` — its names are injected after closedness annotation, so `valuesClosed` stays unset).
Unblocked by S149's column-0 `container:"document"` emission. The backslash hygiene skip is the P3
escape-decoding guard (S151) carried onto this surface exactly as the S151 handoff warned:
`format: "\x68tml"` decodes to `html` (quarto exit 0) but `unquote` does no escape decoding, so
without the guard `isKnownFormatName` would miss and flag a value quarto accepts. Strict TDD:
integration RED (2 tests, `format: banana` → 0 diagnostics) → GREEN. FP-safety owned firsthand
in-session: 0 cardinal FPs across 37 format-name shapes, cross-checking feature-decision vs real
quarto. Mandatory §9 review (Workflow `wf_e8d7c0c9-7da`, 5 lenses): over-suppression /
branch-interaction / re-grounding CLEAN and non-vacuous (an independent ~45-value FP battery, 0 FPs);
survivors were 1 LOW safe-FN missed site (`_metadata.yml`, filed not fixed) + 5 doc-staleness items
(`docs/POSIT-COMPARISON.md`, a unit-test comment, 3 planning snapshots — all fixed;
`PROJECT_LEARNINGS.md` #155 correctly left as append-only). Commits: 1B claim `a672255`; prep
`4d3baed` (retire the format:banana FN-lock from the document-key fixture); feature `5f76f83`;
doc-drift `da44f95` (Learning #10 whole-corpus reconcile); this close-out. check-types clean; unit
1293; integration 436 → 441 (5 new tests). Removed Combo 3 (sub-item a) from `BACKLOG.md`; filed the
`_metadata.yml` coverage gap.

### 2026-07-24 · [ad hoc] Session 151 — IMPLEMENTATION: PREREQUISITE P3, the escape-decoding FP (SHIPPED)

Fixed a live cross-surface cardinal-sin false positive on shipped code. `unquote`
(`src/core/yaml-value-check.ts`) returns the raw text between quotes with **no YAML escape
decoding**, so a DOUBLE-quoted value whose escapes decode to a value `quarto render` 1.7.33
accepts was flagged with an Error squiggle on a document quarto renders **exit 0**. Grounded
firsthand vs quarto 1.7.33 and the real installed schema: `toc-location: "\x62ody"` → exit 0
(folds to `body`), `df-print: "ka\x62le"` → exit 0 (`kable`), `format: "\x68tml"` → exit 0
(`html`), `echo: "\x66enced"` → exit 0 (`fenced`); negative controls (`"\x62anana"`,
`format: banana`) still render exit 1 and still flag.

**Two sites, one defect class.** The item was filed against `isWrongValue` only (`~1 line`),
but the root cause is the shared `unquote`, which has TWO live consumers — `isWrongValue`'s
enum membership and the `.qmd` format-scalar path's `isKnownFormatName` — both carrying the
identical FP (the "TWO → FOUR" undercount of P2/S148). Fixed both:

- **Site A** (`83fa35c`) — `isWrongValue`'s shared hygiene skip gains `|| rawToken.includes("\\")`;
  feeds all four value surfaces (.qmd cell/front-matter/nested, `_quarto.yml` enum).
- **Site B** (`a450a4d`) — the `.qmd` format-scalar path (`features/yaml-value-diagnostics.ts`)
  gains the same guard before `isKnownFormatName`. `_quarto.yml` has no format path (Combo 3
  deferred), so site A already covers its enum surface.
- **Doc-drift** (`b6fc20f`) — `unquote`'s "no escape decoding" comment now cross-references the
  guard (Learning #7).

FALSE-NEGATIVE ONLY and escape-form-agnostic: a closed-enum member / format name never itself
contains a backslash, so the guard introduces zero new false positives; it only stops flagging
backslash-bearing values, which after decoding are either accepted (the FP removed) or rejected
(now a safe FN). Strict TDD (RED before each GREEN); unit 1288→1293, integration 433→436 in a
real Extension Development Host; zero regressions. MANDATORY §9 adversarial review
(`wf_13a81e7c-28a`, 4 lenses) returned CLEAN — the first in this family to find nothing
author-missed, because the two failure modes of a suppression fix (a missed sibling site;
over-suppression) were grounded pre-emptively. Learning #164. Operator-selected at Phase 0.

### 2026-07-24 · [ad hoc] Session 150 — AUDIT + REMEDIATION: `BACKLOG.md` ledger hygiene (COMPLETE)

Operator-raised at Phase 0: `BACKLOG.md` had been accumulating completed items instead of
removing them at close-out, contrary to its own header rule and SESSION_RUNNER Phase 3F ("for a
completed backlog item, remove it from `BACKLOG.md` in the same commit"). Measured extent: **115 KB
of the 250 KB file — 46% — was completed work**: 35 top-level `[x]` blocks plus 41 nested, against
42 top-level open items. The file is now **59 KB with 46 open items and zero completed ones**.

Deleting was verified, not assumed. Two independent audit lenses ran over every completed block
before anything was removed. The **evidence-token lens** (commit SHA / plan path / session number /
Learning number, each checked against `CHANGELOG.md`) cleared 34 of 35 blocks. The **forward-looking-
content lens** — grepping the doomed regions for operator instructions, standing constraints and
known limitations, which by construction have no ledger home — produced 24 hits, 22 of them marker
words inside historical prose (spot-verified: two blocks claiming residuals were "filed below" do
resolve to real open items). Between them the lenses found **five things a bulk delete would have
destroyed**:

- two genuinely-open `- [ ]` sub-items nested under completed parents (depth-3+ project-config
  values; sequence-form `navbar:`/`sidebar:` grandchildren), promoted to top level in `16d9b06`;
- two pieces of open work written as *prose* sub-bullets with no checkbox — the Marketplace publish
  prerequisites (a registered publisher + a PAT; flip `package.json`'s `"preview": true` when the
  listing is stable) and the standing "`format-cell` against a real Python formatter remains
  UNPROVEN" verification gap — promoted in `5da671a`; and
- one genuine **failure-mode-#27 ledger gap**: Session 36's Phase 6d-6+ (b2-iii) deep-nesting PLAN
  shipped as commit `6223e15` but was never recorded, so the block scheduled for deletion held its
  last surviving trace. Backfilled in `814b589` (a separate dated entry above, at its own date).

Two unchecked boxes nested under completed parents were confirmed NOT to be live work — Session 120
descoped `b2-iii` and declared Phase 6d complete — and were removed with their parent. The
still-open "Post-Posit-comparison feature roadmap" tracker was condensed from 44 lines / 82 KB to
7 lines / 4 KB, keeping its two standing operator directives (the Visual/WYSIWYG-editor exclusion
and the three unranked "soft comparison" findings) and its two open candidates, and dropping 16
completed ranked items, 17 completed sub-slices, and 3 closed grooming decisions — one of which,
the front-matter/cell-option VALUE-validation bullet, was additionally **stale**, still reading
"PLANNED, ready to implement" for work that shipped across Sessions 124-149.

The removal invalidated every positional citation to the file, so the same session rewrote
**194 of them across 70 files** (`2188b8e`), including shipped `src/` comments. Four spellings were
in use (`BACKLOG:NNN`, `BACKLOG item N`, `BACKLOG item #N`, plus four one-off legacy forms) and all
are now gone from live artifacts. Each target was resolved from git history (`git blame` the citing
line, then `git show <sha>:BACKLOG.md`) rather than guessed — which showed the convention had been
**broken before this session touched it**: 12 of 34 distinct cited line numbers already landed on
blank or unrelated lines, and `BACKLOG:177` was wrong the day it was written. Citations now read
`CHANGELOG: <title>, Session N` for shipped work (the majority — those items no longer exist here,
so a title-based `BACKLOG` reference would have been a fresh dangling link) or `BACKLOG: <item
title>` for the six still open. Per operator decision the ~523 occurrences in append-only history
(`SESSION_NOTES.md`, `HANDOFFS.md`, `CHANGELOG.md`, `PROJECT_LEARNINGS.md`) were left untouched;
`BACKLOG.md`'s header now explains how to resolve a historical citation and forbids new positional
ones.

Verification: `check-types` clean, unit **1288** passing, integration **433** passing in a real
Extension Development Host — each exactly the Session 149 baseline, zero regressions. A first
citation-rewrite attempt using a quoted form broke 5 test files (citations sit inside
`describe(...)`/`it(...)` string literals, not only in comments); it was caught by `npm test`,
reverted, and redone quote- and backtick-free. Learning #163.

### 2026-07-23 · [ad hoc] Session 149 — IMPLEMENTATION: ③ general document-key VALUE validation in `_quarto.yml` (SHIPPED)

Implemented `docs/planning/2026-07-23-quarto-yml-document-key-value-validation-plan.md` §4.1 —
the third and last slice of that plan's 3-session arc (① P shipped S147, ② P2 shipped S148),
under the project-wide strict-TDD gate.

A wrong value of a recognized general document key at **column 0 of `_quarto.yml`**
(`toc: banana`, `number-sections: yes`, `fig-width: wide`, `df-print: KABLE`,
`toc-depth: banana`) now gets an Error squiggle matching `quarto render` 1.7.33's
`readAndValidateYamlFromFile` layer. Zero new reader, matcher or message code: a column-0 line
that is not a pure block-opener falls through the enumerator's SHARED emission tail with the
synthetic `container:"document"`, and the feature resolves it against `frontMatterKeys([])` —
the same reader call the `.qmd` top-level surface has made since S125. Measured consequence:
the two surfaces agree on 377 of 378 top-level fields (2,646 comparisons, 6 divergences, all
`format:`, which is the one deliberate one — Combo 3, deferred).

The same restructure fixed **defect B**: column-0 lines used to return before the `scanFlow`
arming, so a mapping-looking line folded inside a column-0 multi-line quoted value was read as
a real child and flagged on a document quarto renders exit 0 — three such live false positives
measured firsthand, including an anchored form the plan had not listed. The arming was also
NARROWED to a token whose first character (past `&anchor `/`!tag `) opens a quoted or flow
scalar; the shipped whole-token scan made an ordinary `title: Don't Panic` arm a phantom quote
and swallow every remaining line of the file. Narrowing additionally restored two measured true
positives on the already-shipped indented paths.

**The mandatory §9 adversarial review (`wf_e4bd89e6-696`, 5 render-verified lenses with
refute-first skeptics per finding; 39 agents, 781 tool calls) earned its keep decisively: it
caught a cardinal-sin false positive this slice had ITSELF introduced.** The "column-0 values
are armed by the same tail as every other level" premise holds only for lines that REACH the
tail, and five scope guards return before it — so a multi-line value opened on a skipped line
(under an unrecognized top-level block, on a block-sequence item, at depth-3+) armed nothing and
its fold became a flagged document key on a file quarto renders exit 0. Reproduced firsthand and
proven silent against the pre-slice enumerator before any change, then fixed RED→GREEN by
hoisting the arming above every scope guard; a second half — a sequence item's own quoted scalar
has no separator colon, so the "no colon ⇒ no value" reasoning never applied — needed its own
RED→GREEN. All 24 of the reviewers' false-positive cases are resolved: 21 silent (quarto exit 0),
3 correctly flagged (quarto exit 1 SCHEMA). One lens returned CLEAN.

Verified firsthand: check-types clean; unit 1278 → 1288; integration 425 → 433 green in a real
Extension Development Host (this project's runtime smoke). Author grounding: 82 render-grounded
cases with 0 cardinal-sin false positives and 10 enumerated safe false negatives, a 14-case
adversarial battery against the narrowing itself, and a scan of all 16 committed `_quarto.yml`
fixtures showing every prior diagnostic count unchanged. Break-revert-proven at both layers and
through the real host.

Commits: `06e0566` L1 [INERT] · `0e81e06` L2 [GO-LIVE] · `9d5ec90` L3 fixtures + integration ·
`02a056b` L4/L5 the review and its fix · `b07bc44` doc-drift + three dated plan corrections.

Filed, not fixed here: **P3**, a live cross-surface cardinal-sin FP the review's surface-parity
lens found (`unquote` does no escape decoding, so `toc-location: "\x62ody"` — which quarto folds
to `body` and renders exit 0 — is flagged, on BOTH surfaces, pre-existing since S125); the `.qmd`
sibling enumerators' two older arming behaviors; and a quoted-KEY divergence in the safe
direction.

### 2026-07-23 · [ad hoc] Session 148 — IMPLEMENTATION: PREREQUISITE P2, the key/value-separator FP fix (SHIPPED)

Implemented `docs/planning/2026-07-23-quarto-yml-document-key-value-validation-plan.md` §2.8 + §4.0b —
the second prerequisite of that plan's 3-session arc, under the project-wide strict-TDD gate.

YAML's block-mapping key/value separator is a colon followed by space, tab, or end of line. Every
value path instead split at the first colon, so `toc:: true` — whose real key is `toc:`, unknown but
ACCEPTED on an OPEN key set, `quarto render` 1.7.33 exit 0 — was read as key `toc` with the bogus
value token `: true` and flagged. A cardinal-sin false positive, live on shipped code.

FOUR value paths carried it, not the two the plan named: `findProjectConfigValueLines`,
`findFrontMatterValueLines`, `findNestedFrontMatterValueLines` (unnamed by the plan, found by grep +
firsthand render), and the `#|` CELL-OPTION loop (found only by the mandatory §9 review). It was also
live at DEPTH-2 under `website:`, which the plan's table had recorded as agreement. A 36-case battery
across all four surfaces, every case paired with a firsthand quarto exit code: 14 measured
cardinal-sin FPs → 0, with 7 residual false negatives, every one on a document quarto rejects.

Two design rules the implementation had to discover, both now recorded in-code and in the plan for
the remaining slice:
- The rule is DIAGNOSTICS-side. Applying it inside the shared `topLevelSlots`/`slotsOf` grammar
  removes a deliberate completion affordance (on a `key:value` line the provider offers the value
  with a prepended space, repairing a user mid-typing). It belongs in each value path instead.
- It must SCAN FORWARD to the first separator colon (`mappingColonAt`), never merely test the first
  one: on `a:b: "text` a later colon is the separator, and treating the line as a non-mapping loses
  the `scanFlow` arming and flags the folded continuation on a doc quarto renders exit 0 — an FP this
  session introduced and the §9 review caught.

Commits: `ebecd3d` L1 [INERT] · `9cdcd23` L2 [GO-LIVE] `_quarto.yml` · `1217b86` L3 + `a43f758` L4a
(guard moved out of the shared grammar) · `c83ef87` L4b `.qmd` nested · `6bc3cd0`/`20b8799` L5 locks
in a real host · `893045a` L6 arming · `ffd0ac4` doc-drift · `d150c45`/`7c496fd`/`db480f2` L7
`mappingColonAt` · `48dc384` L8 cell options · `d1cb06c` doc reconcile.
unit 1241 → 1278; integration 420 → 425; check-types clean.


### 2026-07-23 · [ad hoc] Session 147 — IMPLEMENTATION: PREREQUISITE P, the null-enum-member FP fix (SHIPPED)

Implemented `docs/planning/2026-07-23-quarto-yml-document-key-value-validation-plan.md` §2.5 + §4.0 —
the first of the three-session arc that plan defines, and the value family's **second cross-surface
CORRECTNESS fix** after S139 (not a coverage slice). Removes a **cardinal-sin false positive that was
live on shipped code**: `valuesOfSchema` maps enum members through `scalarToYaml` (which returns
`null` for a JSON `null`) and filters them out, while `closednessOfSchema` still reports the enum
CLOSED — so `auto-play-media: null` (and `~`/`Null`/`NULL`) was flagged on the `.qmd` top level
(S125), the `.qmd` per-format path, and `_quarto.yml`'s `format:` container (S143), although
`quarto render` 1.7.33 exits 0 on every one of them and quarto's own rejection clause reads
``one of: `null`, `true`, `false``.

Commits: `51264af` **L1 [INERT]** — `SchemaField.acceptsNull` + `acceptsNullOfSchema`, which mirrors
the sibling annotators' arm order and depth guard but folds `anyOf` with **OR** (they prove a
restriction; this proves an admission) and **resolves `ref` into `definitions`**. `20b6b8c`
**L2 [GO-LIVE]** — an `acceptsNull`-gated branch in `isWrongValue` using the anchored, case-EXACT
`NULL_SPELLINGS = /^(?:null|Null|NULL|~)$/`, plus `valueMessage` listing `null` first as quarto does.
`78b573c` **L3** — locks on all three affected surfaces (two `.qmd` fixtures + the `_quarto.yml`
per-format fixture, a different feature and DiagnosticCollection). `f28856f` **L4** — the MANDATORY
§9 adversarial review (`wf_ef8b6c4b-254`: 4 quarto-render-verified lenses + an independent
verify-or-refute skeptic per finding; 13 agents, 513 tool calls) and the fix it produced.

**The review earned its keep.** fp-cardinal / annotator-parity / surface-sweep all returned CLEAN —
fp-cardinal independently re-ran the full 167-probe battery (167/167 exit 1) and rendered 90 further
names the top-level battery could not reach (nested `.qmd`, project depth-1/2, cell options,
`execute:` children, per-format-only), all exit 1. doc-drift filed 9 findings, of which independent
skeptics confirmed 2 (both folded). But the real catch was a LOW/latent note from a CLEAN lens: the
new walk's `{enum: <object>}` arm **returned** where both siblings **fall through**, so a node with
an enum object lacking a `values` array plus a later null-admitting arm would resolve CLOSED via that
later arm yet stay unmarked — the cardinal-sin false positive, in the unsafe direction. Unreachable
in 1.7.33, reproduced firsthand through the real reader, fixed RED→GREEN. The author's own
arm-by-arm read had missed it by comparing WHICH arms exist rather than their fall-through semantics.
`857f5fe` reconciles doc-drift (POSIT-COMPARISON ×2; a dated correction note on the S146 plan's §2.5
blast-radius line, which is right about the FP but wrong about the schema).

**3 validated fields** Quarto-wide (`auto-play-media`, `preload-iframes`,
`ipynb-shell-interactivity`). A **fourth** name, `output-file`, admits null behind a `ref` but
resolves OPEN, so it was never validated and never a false positive — S146's scan missed it because
it treated `node.ref` as an object when the DSL makes it a string; that is precisely why the shipped
walk resolves the `ref` arm. `NuLl` and the quoted `"null"` keep flagging, as do the other 167
closed/numeric top-level fields.

Verification: exhaustive batteries generated FROM THE LIVE READER (not sampled) — **167/167**
still-flagged null probes quarto-REJECTED (0 surviving FPs) and **12/12** newly-silent probes
quarto-ACCEPTED, so the matcher agrees with quarto 179/179 on the whole top-level null surface. A
depth-50 re-scan with extra arms (`allOf`/`oneOf`/`arrayOf`/`object.properties`) finds the same 4
names, so the depth-5 guard hides nothing. Break-revert-proven at both layers: a case-insensitive
regex, an unanchored regex and an `!== false` gate each turn a distinct unit test red, and
suppressing the annotation turns 6 integration tests red. The offline curated path carries zero
exposure (no curated field is both closed and null-admitting). `check-types` clean; unit
**1223→1241**; integration **417→420**.

### 2026-07-23 · [ad hoc] Session 146 — PLANNING: general top-level document-key VALUE validation in `_quarto.yml`

Wrote `docs/planning/2026-07-23-quarto-yml-document-key-value-validation-plan.md` (commit `0c1a149`):
flag a wrong CLOSED/numeric value of a recognized **general document key at column 0** of `_quarto.yml`
(`toc: banana`, `number-sections: yes`, `fig-width: wide`, `code-fold: banana`) — the case beyond the
shipped `execute:` (S141) and `format:` (S143) containers — matching `quarto render` 1.7.33's
`readAndValidateYamlFromFile` layer. It ships with **zero new matcher/reader/message code** (the reader
`frontMatterKeys([])`, matcher `isWrongValue` and message `valueMessage` are the same three the `.qmd`
top-level surface has used since S125); the gap is enumerator plumbing — `findProjectConfigValueLines`
never emits a column-0 scalar.

**The grounding and the mandatory §9 adversarial review (`Workflow` `wf_314c0811-6c9`) uncovered THREE
pre-existing, LIVE cardinal-sin false positives, two of them on ALREADY-SHIPPED surfaces.** None is
introduced by the planned slice; all three are firsthand-verified in both directions:
**(A)** `valuesOfSchema` drops a literal `null` enum member while `closednessOfSchema` still marks the
field CLOSED, so `auto-play-media: null` is flagged today on the `.qmd` top-level (S125) and per-format
(S143) surfaces though `quarto render` exits 0 — exactly 3 fields Quarto-wide → **prerequisite slice P**.
**(B)** the `_quarto.yml` column-0 continuation guard is never armed, so a mapping-looking line folded
inside a column-0 multi-line quoted value (or a valid-YAML column-0 flow collection) is flagged on a
document quarto accepts → **fixed in-slice**, with a narrowed opener rule the review proved necessary
(the verbatim arming would make an ordinary `title: Don't Panic` swallow the rest of the file).
**(C)** every enumerator splits at `indexOf(":")`, but YAML's separator is a colon + space/tab/EOL, so
`toc:: true` (quarto's key is `toc:`, accepted on an OPEN key set) is flagged — live today on `.qmd` and
on `_quarto.yml`'s `execute:` → **prerequisite slice P2**.

Grounding (firsthand, Quarto 1.7.33): 170/170 wrong-value probes **generated from the live reader** are
schema-rejected; 169/170 valid-value probes exit 0; an enum-parity diff against quarto's own
`which must instead be …` clauses for all 170 rejections (3 divergences → defect A); a 936-shape author FP
battery (614 flagged shapes rendered, 614/614 genuinely rejected); and a scan of all 14 committed
`_quarto.yml` fixtures showing none gains a diagnostic. Baselines verified, not assumed: `check-types`
clean, unit 1223, integration 417.

Deliverable = the plan; **no code** (FM #18/#19). Implementation is a 3-session arc: P → P2 → the slice.
Learning #159 (a battery's size is not its coverage; diff against the tool's own error text).

### 2026-07-23 · [ad hoc] Session 145 — IMPLEMENTATION: validate the scalar `format:` NAME in `.qmd` (Combo 1, SHIPPED)

Implemented the S144 plan `docs/planning/2026-07-22-quarto-format-name-validation-plan.md` §4.1 gate-(a)
L1→L4 contract as ONE strict-TDD vertical slice. An unknown/typo'd top-level output-format NAME in a
`.qmd` (`format: banana`/`reveal`/`word`) now gets an Error squiggle matching `quarto render` 1.7.33's
front-matter **schema** layer (`makeFrontMatterFormatSchema`), while extension formats, pandoc modifiers,
hidden legacy variants, extension+modifier combos, and custom `.lua` writers stay silent (0 cardinal-sin FPs).
Commits: `5333bd7` L1 [INERT] pure `isKnownFormatName` regex-mirror predicate + `formatNameMessage` +
`escapeRegExp` · `47f68e4` L2 [INERT] `SchemaIndex.formatNamesForValidation()` raw built-in set (71) / `null`
offline + `collectRawFormatNames` · `bf42cb3` L3 [GO-LIVE] the `fm.key==="format"` branch in
`yaml-value-diagnostics.ts` (null-gate → hygiene → `unquote` → predicate); THREE FN-lock tests reconciled by
intent-preserving swap (the grep+feature-sim caught a third count-dependent test the plan under-counted) ·
`8fefa5b` L4 fixtures + integration (401→417) + the §9-review CARDINAL-FP fix. Unit 1158→1223.

The MANDATORY 4-lens `quarto render`-verified §9 review (`wf_f9e2f6f5-ae4`) **earned its keep**: the
predicate-parity lens found a grounded cardinal-sin FP the plan + L1 tests + both sims missed — quarto's
schema is `regexSchema("^.+\.lua$")` whose STRING `\.` collapses to a **wildcard** dot at compile time
(runtime `^.+.lua$`), so quarto accepts any ≥2-chars+`lua` name (`foolua`/`aalua`), not only a literal `.lua`;
the literal-dot predicate false-positived on all of them. Firsthand-verified (quarto render) → fixed the regex
to the wildcard, RED→GREEN; a 50-name render-vs-predicate battery → **0 cardinal FPs, 0 divergences**. The
offline-gate lens returned PLAN-SOUND; the fp-cardinal + doc-drift lenses (retry-capped) were discharged
firsthand. Doc-drift reconciled whole-corpus (`docs/POSIT-COMPARISON.md` ×3 + two in-code "both surfaces"
comments). Learning #158. **Deferred (still OPEN):** Combo 3 (`_quarto.yml` scalar — entangled with the general
document-key case), Combos 2/4 (container-key form both surfaces), multi-format MAPPING-form names, nearest-match hint.

### 2026-07-22 · [ad hoc] Session 144 — PLANNING: validate the scalar `format:` NAME (`.qmd` + `_quarto.yml`)

Wrote `docs/planning/2026-07-22-quarto-format-name-validation-plan.md` — a grounded plan to flag an
unknown/typo'd top-level output-format NAME (`format: banana`/`reveal`/`word`) with an Error squiggle
matching `quarto render` 1.7.33's front-matter **schema** layer, WITHOUT false-positiving on extension
formats, pandoc modifiers, hidden legacy variants, extension+modifier combos, or custom `.lua` writers.
Deliverable = the PLAN; NO code (FM #18/#19). **Headline (the opposite of the S143 slice): this slice
ADDS a bespoke matcher** — format-name acceptance is a REGEX UNION (`makeFrontMatterFormatSchema`:
`^(.+-)?<name>([-+].+)?$` per built-in name + `^.+\.lua$`), not the flat closed enum `isWrongValue`
requires. Scoped to Combo 1 (`.qmd` scalar — the only surface×form already emitting the token);
Combos 2/3/4 deferred (§4.3). The MANDATORY 4-lens `quarto render`-verified §9 review
(`wf_fc737cbf-672`) **refuted the first-draft predicate** (it had mirrored quarto's render-dispatch
`parseFormatString`, the wrong layer, shipping 2 cardinal-sin FP classes: `.lua` writers and
`<ext>-<builtin>-<mod>` names) and PROVED the fix; every finding firsthand-verified and folded, the
corrected regex-mirror predicate re-verified → 0 divergences over the 32-case matrix + 51-case battery.
Learning #157 (ground a mimicked validator on the exact layer whose output you reproduce, not a
downstream one that disagrees).

### 2026-07-22 · [ad hoc] Session 143 — IMPLEMENTATION: `format:` per-format option VALUE validation in `_quarto.yml` (SHIPPED)

Implemented `docs/planning/2026-07-22-quarto-yml-format-value-validation-plan.md` as one strict-TDD
vertical slice — the value-validation family's tenth slice and its fourth `_quarto.yml`-surface item
(after depth-1 S135, depth-2 S137, `execute:` S141). A wrong CLOSED/numeric value of a per-format
option in `_quarto.yml` (`format:\n  html:\n    toc: banana`/`df-print: banana`/`fig-format: banana`/
`toc-depth: banana`; `revealjs.transition: banana`; `pdf.number-sections: banana`) now shows an Error
squiggle matching `quarto render` 1.7.33's `readAndValidateYamlFromFile` schema layer. **Zero new
reader/matcher/message code** — the change was a value-side `"format"` container in `VALUE_CONTAINERS`
(`src/core/project-yaml.ts`) + a resolver branch in `src/features/yaml-project-value-diagnostics.ts`
routing format depth-2 lines through `frontMatterKeys(["format", fmt])` → `perFormatOptions(fmt)`, the
SAME reader path the `.qmd` surface already ships. Gate-(a) 4-layer contract: `ad891fa` L1 [INERT]
type-widen + resolver branch (dormant) · `9a4e811` L2 [GO-LIVE] `"format"`→`VALUE_CONTAINERS` +
RED→GREEN enumerator emit + depth-1-skip + multi-format + KEY-isolation lock · `3cf6814` L3 fixtures +
integration (real host). L4 MANDATORY §9 review (`wf_cbfd34f2-147`: fp-cardinal / container-isolation /
surface-parity / doc-drift) returned all 4 lenses PLAN-SOUND — 0 code defects, 0 cardinal-sin FPs,
converging with the author's own 27-value FP battery + a compiled feature-sim over both fixtures. Unit
1154→1158, integration 397→401. `BACKLOG.md` item flipped `[x]` SHIPPED; `docs/POSIT-COMPARISON.md`
reconciled (per-format value coverage added, remaining-gap prose narrowed to the scalar `format:` NAME +
general document-key case); `PROJECT_LEARNINGS.md` #156.

### 2026-07-22 · [ad hoc] Session 142 — PLANNING: `format:` per-format option VALUE validation in `_quarto.yml`

Wrote `docs/planning/2026-07-22-quarto-yml-format-value-validation-plan.md` — the value-validation
family's tenth slice (planned) and its fourth `_quarto.yml`-surface item (after `execute:`, S141).
Flags a wrong CLOSED/numeric per-format option value in `_quarto.yml` (`format → <fmt> → <option>`,
e.g. `format:\n  html:\n    toc: banana`) with an Error squiggle matching `quarto render` 1.7.33's
`readAndValidateYamlFromFile` schema layer. Headline (grounded firsthand — `quarto render` + a fresh
compiled-reader harness against current source, cross-checked 1:1): ZERO new reader/matcher/message
logic — `frontMatterKeys(["format", fmt])` → `perFormatOptions(fmt)` + `isWrongValue` + `valueMessage`
already validate this on the `.qmd` document surface (shipped + integration-tested); the gap is a
value-side `format` container in `VALUE_CONTAINERS` + a feature resolver branch. Gate-(a) 4-layer
contract (L1 [INERT] → L2 [GO-LIVE] → L3 fixtures+integration → L4 §9 review). Adversarial plan review
`wf_4c1ebefd-c10` (fp-cardinal / enumerator-reality / resolver-parity / doc-drift): all 4 lenses
PLAN-SOUND, 0 cardinal-sin FPs; 1 LOW (citation precision) folded. Deliverable = the PLAN; NO code
(FM #18/#19). Learning #155.

### 2026-07-22 · [ad hoc] Session 141 — IMPLEMENTATION: `execute:` document-key VALUE validation in `_quarto.yml` (SHIPPED)

Flag a wrong CLOSED value of a top-level `execute:` block's child in `_quarto.yml`
(`echo: banana`/`cache: nope`/`freeze: banana`/`error: 5`/`daemon: banana`) with an Error
squiggle matching `quarto render` 1.7.33's `readAndValidateYamlFromFile` schema layer — the
value-validation family's ninth slice, third on the `_quarto.yml` surface. **Zero new core
code**: reuses `frontMatterKeys(["execute"])`→`CURATED_EXECUTE_KEYS` + `isWrongValue` +
`valueMessage` (the same machinery the `.qmd` document surface uses, S128). Implemented the
S140 plan's gate-(a) 4-layer contract as one strict-TDD vertical slice: L1 `4f67523` [INERT]
widen `ProjectConfigValueLine.container` +`"execute"` + route `execute→frontMatterKeys` in
the feature (dormant); L2 `e1e0ea3` [GO-LIVE] a value-ONLY `isValueContainer`/`VALUE_CONTAINERS`
used solely in `findProjectConfigValueLines` (the unknown-KEY enumerator's
`PROJECT_CONFIG_CONTAINERS` left untouched — dragon 1) + RED→GREEN unit tests + a KEY-isolation
lock; L3 `97a18bf` fixtures + integration in a real host. L4 the mandatory 4-lens
`quarto render`-verified §9 review `Workflow` (`wf_208f743b-ced`: fp-cardinal / container-isolation
/ surface-parity / doc-drift) — all PLAN-SOUND, 0 cardinal-sin FPs, converging with a 37-case
author FP battery. Unit 1149→1154, integration 393→397. Reconciled `docs/POSIT-COMPARISON.md`
(execute no longer an open gap) + `BACKLOG.md` (flipped SHIPPED). Learning #154.

### 2026-07-21 · [ad hoc] Session 140 — PLANNING: `execute:` document-key VALUE validation in `_quarto.yml`
Wrote `docs/planning/2026-07-21-quarto-yml-execute-value-validation-plan.md` — the value-validation family's **ninth** slice (planned) and its **third `_quarto.yml`-surface** item, the S135-deferred sub-bullet (b) "near-term win". **Deliverable = the PLAN; NO code** (FM #18/#19 — the plan↔implementation boundary). The plan flags a wrong CLOSED value of a child of a top-level `execute:` block in `_quarto.yml` (`echo: banana`/`cache: nope`/`freeze: banana`/`error: 5`/`daemon: banana`) with an Error squiggle matching `quarto render` 1.7.33's `readAndValidateYamlFromFile` schema layer. **Headline (grounded firsthand): ships with ZERO new core code** — the matcher `isWrongValue`, message `valueMessage`, and reader `frontMatterKeys(["execute"])`→`CURATED_EXECUTE_KEYS` already exist and already validate `execute:` children on the DOCUMENT surface (S128); quarto's execute-value behavior in `_quarto.yml` is a **1:1 match** with those annotations (full battery grounded: 11 closed children flag/accept correctly; `output` OPEN → never flag; `daemon` numeric; `error` boolean-only; unknown children ACCEPTED by quarto → **value-only scope is a CORRECTNESS requirement, not just scope**). The gap is pure surface plumbing: **(A)** a value-side `execute` container in `findProjectConfigValueLines`, **(B)** routing `execute → frontMatterKeys(["execute"])` in the feature. **HIGH dragon:** the value + unknown-KEY enumerators share `PROJECT_CONFIG_CONTAINERS`, so `execute` MUST go in a value-only predicate (else the KEY feature flags `custom-thing`, a cardinal-sin FP). Gate-(a) 4-layer contract (L1 inert routing+type-widen → L2 enumerator go-live → L3 fixtures+integration → L4 §9 review). **MANDATORY §9 adversarial review** — a 4-lens `quarto render`-verified `Workflow` (`wf_3380b341-948`: fp-cardinal / container-isolation / surface-parity / design-inventory) — returned **0 HIGH / 1 MEDIUM / 2 LOW / 9 INFO** (the three risk lenses PLAN-SOUND with **zero cardinal-sin FPs** across an independent battery); all 3 actionable findings re-verified firsthand + folded (the MEDIUM: execute DOES have object-valued children `knitr`/`jupyter`/`julia`/`server` — the §2.4 "no object child" claim was corrected, the safe-FN re-based on the curated reader's absent `.children`, + a new L3 depth-2 name-collision regression fixture). `PROJECT_LEARNINGS.md` #153; `BACKLOG.md` gains a PLANNED-ready Up Next item. Operator picked "execute: keys in _quarto.yml" via `AskUserQuestion` (Active empty).

### 2026-07-21 · [ad hoc] Session 139 — IMPLEMENTATION: the GENERAL numeric-member-enum matcher fix (cross-surface, SHIPPED)
Implemented `docs/planning/2026-07-21-numeric-member-enum-matcher-fix-plan.md` as ONE strict-TDD vertical slice — the value-validation family's FIRST cross-surface CORRECTNESS fix. Taught the SHARED value matcher `isWrongValue` (`src/core/yaml-value-check.ts`) that a **numeric-member enum** — a closed enum whose members are YAML *numbers* — is validated by PARSED value, not string membership, so quarto's numeric coercion (`169.0`≡`169`, `+169`, `0169`, `3.0`≡`3`, `04`, `3e0`) stops being flagged. **Design (Option B):** a new `SchemaField.numericMemberEnum` bit set from raw JS member-TYPE detection (`numericMemberEnumOfSchema`, which distinguishes `enum:[3,4]` from a string enum `enum:["3","4"]` — a distinction the stringified `values` `["3","4"]` has lost) at the shared `annotateClosedness` choke point, consumed by a `Number()`/NaN-safe numeric-equality branch (`isWrongNumericMember`); the S137 `openNumericMemberEnum` guard + its orphaned `NUMERIC_LITERAL` const were **DELETED** (net simplification — `version` stays closed and is now validated correctly). Layers, checkpoint-committed: **L1** (`c2e0680`) matcher branch [INERT] + unit truth-table incl. the NaN-underscore RED row (`4_3`≡43, `Number("4_3")`=NaN — the S138 §9-review HIGH); **L2** (`80fe4fc`) the annotation → DOCUMENT-surface `aspectratio` GO-LIVE; **L3a** (`b75b2f5`) delete the guard → PROJECT-surface `version` GO-LIVE (also exposed + fixed a latent S137 fixture-fidelity bug: the fixture used JS-string enum members `["3","4"]` where the real schema uses numbers `[3,4]`, which the old value-keyed guard masked); **L3b** (`fb3805e`) fixtures (`version: 5` + an aspectratio fixture pair covering BOTH reachabilities) + integration; **L4** (`0143bc5`) MANDATORY §9 review. **Net product effect: killed ≥3 LIVE shipped `aspectratio` cardinal-sin FPs** (`169.0`/`+169`/`0169` flagged though quarto accepts, via BOTH top-level front matter and nested `format.beamer`) AND **restored `version` validation** (`version: 5` now flagged; `3.0` accepted) on website + book. Every fixture value render-grounded against `quarto render` 1.7.33 (invalid exit-1 SCHEMA, valid exit-0). The MANDATORY §9 adversarial review — an independent 4-lens `quarto render`-verified `Workflow` (`wf_00c4cf2f-334`: fp-cardinal / guard-deletion-safety / type-keying-soundness / doc-drift) PLUS the author's own firsthand FP battery (wide numeric forms, both positions) + a 225-project-grandchild guard-safety scan — returned **ZERO code defects, ZERO cardinal-sin FPs** (the S138 planning panel had already caught + folded the NaN/underscore HIGH, so the implementation panel + author grounding converged clean); the doc-drift lens caught one stale test comment, fixed in L4. Unit **1149** / integration **393**. Reuses `NUMBER_LITERAL`/`valueMessage` (both UNCHANGED); the four `isWrongValue` consumers gain correct behavior for free. `PROJECT_LEARNINGS.md` #152; `docs/POSIT-COMPARISON.md` reconciled; `BACKLOG.md` item flipped SHIPPED. Operator picked "Implement numeric-enum fix" via `AskUserQuestion` (Active empty).

### 2026-07-21 · [ad hoc] Session 138 — PLANNING: the GENERAL numeric-member-enum matcher fix (cross-surface)
Wrote `docs/planning/2026-07-21-numeric-member-enum-matcher-fix-plan.md` — the deferred general fix filed at S136/S137 close-out (`BACKLOG.md`). **Deliverable = the PLAN; NO code shipped (FM #18/#19 — implementation is the next session).** The fix: teach the SHARED value matcher `isWrongValue` (`src/core/yaml-value-check.ts`) that a **numeric-member enum** — a closed enum whose members are YAML *numbers* — is validated by PARSED VALUE, so quarto's numeric coercion (`3.0`≡`3`, `+169`≡`169`, `04`≡`4`) stops being flagged. Grounded firsthand (esbuild harnesses over the real installed 1.7.33 schema via `parseSchemaIndex` + ~40 `quarto render` probes): the complete surface is exactly **2 distinct schema positions** (`aspectratio` document front-matter; `google-analytics.version` project depth-2 under `website:` + `book:`), both bare `enum` with JS-number members, quarto's coercion accept-set uniform (accept an unquoted number literal coercing to a member; reject out-of-set numbers, non-numbers, AND quoted strings like `"3"`/`"169"`). Two current shipped defects: `aspectratio` has ≥3 LIVE cardinal-sin FPs today (`169.0`/`+169`/`0169` flagged though quarto accepts, via BOTH the top-level and nested `format.beamer` paths), and `version` was defused to a safe FN by S137's `openNumericMemberEnum` guard (no validation — `version: 5` unflagged). Design (Option B): annotate a new `SchemaField.numericMemberEnum` bit from JS member-type detection (distinguishes `[3,4]` from a string-enum `["3","4"]`, which the stringified `values` cannot) + a numeric-equality branch in `isWrongValue` + DELETE the S137 `openNumericMemberEnum` guard (net simplification). A §4 strict-TDD gate-(a) contract across 4 layers (L1 matcher branch [INERT] → L2 annotation (aspectratio go-live) → L3 delete guard (version go-live) + fixtures + integration → L4 MANDATORY §9 review). **MANDATORY adversarial plan-review Workflow (`wf_f52ca1a1-827`, 4 lenses):** returned a HIGH + two MEDIUMs, all re-verified firsthand and folded — HIGH: the numeric branch would ship a cardinal-sin FP on member-valued digit-group underscores (`aspectratio: 4_3`≡43 quarto exit 0, but `Number("4_3")`=NaN) → folded the `NaN`-safe step + `Number()` pin into the §3.1 C algorithm + a RED truth-table row + dragon 11; MEDIUM: `aspectratio`'s nested `format.beamer` second FP path; MEDIUM: the "no mixed enum exists" overclaim (`brand-font-weight` exists but is unreachable) corrected to a reachability invariant. `PROJECT_LEARNINGS.md` #151. `BACKLOG.md` gains a plan pointer (NOT flipped shipped — FM #18). Operator picked "Numeric-member-enum matcher fix" via `AskUserQuestion` (Active empty).

### 2026-07-21 · [ad hoc] Session 137 — IMPLEMENTATION: DEPTH-2 value validation for `_quarto.yml` project-config containers (SHIPPED)
A wrong CLOSED value TWO levels under `_quarto.yml`'s `project:`/`website:`/`book:` blocks now shows an Error squiggle matching `quarto render` 1.7.33's `readAndValidateYamlFromFile` schema layer — the value-validation family's SEVENTH slice, extending S135's depth-1 one level deeper. Implemented the S136 plan §4 gate-(a) contract as ONE strict-TDD vertical slice across 4 checkpoint-committed layers: **L1** (`ce96a20`) `projectFieldsFromProperties` populates `SchemaField.children` via the EXISTING `objectChildren` (no new resolver — S134's tier-i/tier-ii split DISSOLVED, grounded 0-mismatch: `resolveObjectProperties` resolves all grandchildren, no `super` at depth-2) + the numeric-member-enum-OPEN guard (`openNumericMemberEnum` unsets `valuesClosed` on any grandchild enum with a numeric-literal member — `google-analytics.version` coerces `3.0`≡`3` exit 0, a cardinal-sin FP the string matcher would hit) [INERT]. **L2** (`87832b5`) `findProjectConfigValueLines` generalized to a bounded 2-level path-aware state machine (`ProjectConfigValueLine` + `path: string[]`; `path=[]` depth-1 byte-identical, `path=[child]` depth-2) keeping the scanFlow continuation guard (break-revert-proven load-bearing) + an inert `path.length!==0` compute guard [INERT]. **L3** (`750c81e`) GO-LIVE — `resolveProjectValueField` resolves BY PATH (never bare name — `book.type` CSL enum collides with `book.cookie-consent.type`, a cardinal-sin FP if resolved by name), two firsthand-grounded fixture dirs (invalid exit-1 SCHEMA on 7 grandchildren, valid exit 0), a 3-test integration `describe` passing against the REAL schema. **L4** (`39df89c`) MANDATORY §9 adversarial review — an independent 4-lens `quarto render`-verified `Workflow` (`wf_bb28eded-98b`) AND the author's own firsthand sweep. **The review caught a HIGH cardinal-sin FP present at DEPTH-1 too (S135-shipped, INHERITED, that S135's own review + this session's author sweep both missed):** a multi-line-quoted/flow value's OPENING line (`location: "nav\` folded to `navbar`) was emitted with an unresolvable token and flagged against the closed enum, though quarto FOLDS the escaped-newline scalar to a valid member and renders exit 0 — fixed by never emitting a multi-line opener (the scanFlow guard armed only continuation lines, not the opener), re-verified firsthand (render exit 0) + guarded by a fixture row + unit tests. The other lenses (closedness-coercion, anyof-collision) returned SOUND; the numeric-coercion + by-path-collision guards verified correct. Flags 57 of 59 closed-schema positions (`google-analytics.version` ×2 left OPEN as a safe FN); surface = 8 nested containers across website + book (via `super base-website`). Unit **1134** / integration **391**. Reuses `isWrongValue`/`valueMessage`/`createDebouncedDiagnosticsFeature`/`annotate*`/the S135 feature+collection UNCHANGED. `docs/POSIT-COMPARISON.md` reconciled (one → two levels, remaining gap narrowed to depth-3+); `BACKLOG.md` item flipped SHIPPED (deferred: depth-3+, sequence-form, the general numeric-member matcher fix); `PROJECT_LEARNINGS.md` #150. Operator picked "Implement depth-2 slice" via `AskUserQuestion` (Active empty).

### 2026-07-21 · [ad hoc] Session 136 — PLANNING: DEPTH-2 value validation for `_quarto.yml` project-config containers
Wrote `docs/planning/2026-07-21-quarto-yml-depth2-value-validation-plan.md` — extend S135's shipped depth-1 slice one level deeper (value-validate a wrong CLOSED value of a `project:`/`website:`/`book:` GRANDCHILD, e.g. `website.navbar.collapse-below: banana`). **Deliverable = the PLAN; NO code shipped** (FM #18/#19 — implementation is a separate session). **Key architectural finding (grounded firsthand, `scratchpad/rop-compare.cjs`): the tier-i/tier-ii split S134 drew DISSOLVES** — the EXISTING shared `resolveObjectProperties` (via `objectChildren`, already anyOf-aware) resolves ALL 55 closed depth-2 grandchildren with 0 mismatches vs a super+anyOf union resolver; no `super` is needed at depth-2. So the reader is a ≈2-line `objectChildren` reuse (populate `SchemaField.children`), same cost for `project.preview` (S134's "cheap" tier) and `navbar/sidebar/search` (S134's "harder anyOf" tier). Operator picked the full 55+ position surface over a `project.preview`-only subset (Phase 0 `AskUserQuestion`) once the grounding flipped the cost model. Design: a ≈2-line reader + a bounded 2-level depth-2 enumerator (the load-bearing new work, scanFlow-aware — the FP surface now has NO column-0 backstop) + a path-aware compute; no new resolver/matcher/message/feature (all reused from S135). **The MANDATORY 4-lens `quarto render`-verified adversarial-review `Workflow` (`wf_c99d35f6-b02`) returned fp-cardinal UNSOUND (HIGH)** — a real cardinal-sin FP the author's own grounding missed: `google-analytics.version` (enum[3,4]) can't be string-matched because quarto coerces YAML numerics (`version: 3.0`≡`3` renders exit 0 but the matcher flags it); all 5 findings (1 HIGH + 2 MEDIUM + 2 LOW) re-verified firsthand and folded (reader leaves numeric-member enums OPEN as a safe FN; +4 numeric grandchildren; open-graph partial-arm; `book.type` collision is a cardinal-sin; close-out docs owed). Final surface: 59 closed-schema positions (55 enum/bool + 4 numeric), 57 flagged / 2 safe-FN. `PROJECT_LEARNINGS.md` #149; `BACKLOG.md` depth-2 item annotated PLANNED (plan pointer, NOT flipped shipped).

### 2026-07-21 · [BL-47] Session 135 — IMPLEMENTATION: value validation for `_quarto.yml` project-config containers (`project:`/`website:`/`book:`, SHIPPED)
A wrong CLOSED value one level under `_quarto.yml`'s `project:`/`website:`/`book:` blocks now shows an Error squiggle matching `quarto render` 1.7.33's `readAndValidateYamlFromFile` schema layer — the value-validation family's SIXTH slice and FIRST on the `_quarto.yml` surface (the sibling the document slices S131/S132 grounded OUT). Built the S134 plan §4 gate-(a) contract as ONE strict-TDD vertical slice across 4 checkpoint-committed layers: **L1** (`0441b6b`) `SchemaIndex.projectFields(container)` — a super-chain-aware annotated child-FIELD resolver, built by threading each property's schema through the EXISTING `resolveClosedKeysObject` super-merge (own-wins) and annotating via the reused `valuesOfSchema`/`annotateClosedness`/`annotateScalarType`; `projectKeys` name-set unregressed. **L2** (`2556f69`) `findProjectConfigValueLines` — a scanFlow-aware bare-YAML value enumerator (the KEY enumerator's container tracking + the nested enumerator's `scanFlow` continuation guard, the FP surface the KEY side lacks). **L3** (`f128bf7` + `2b4f512`) GO-LIVE — relocated `valueMessage` to the pure `yaml-value-check.ts` (both surfaces import one message fn), a new filename-gated `registerYamlProjectValueDiagnosticsFeature` (its own `quarto-project-value` collection/code, so it never collides with the KEY feature's entries), `extension.ts` wiring, two firsthand-grounded `_quarto.yml` fixture dirs, and a 5-test integration `describe` in a real VS Code host. Flags `draft-mode: hidden` / `downloads: mobi` / `sharing: mastodon` / `repo-actions: fork` / `execute-dir: banana`; grounded to **16 (container,child) positions** (project 1, website 6, book 9 incl. the 45-value CSL `type`). `project.type` stays OPEN (`{string:{completions}}` — an off-list value fails DOWNSTREAM `Unsupported project type`, NOT the schema layer, so never flagged — the cardinal-sin trap); `manuscript:` OUT (0 closed children). **L4 MANDATORY §9 review CLEAN — 0 code defects, 0 cardinal-sin FPs**: my own firsthand sweep (12 exotic continuation shapes + all 16 closed positions A/B'd against `quarto render` exit codes) AND an independent 4-lens `quarto render`-verified `Workflow` (`wf_41f3d723-ce5` — fp-scanflow across 37 shapes, closedness-cardinal, super-resolution, lifecycle-drift), both CONVERGING on zero; the super-resolution lens instrumented the real-schema merge and proved own-wins can never flip a child's closedness (the only 2 own-vs-super name collisions are both OPEN=OPEN). Unit **1116** / integration **388**. Reuses `isWrongValue`/`valueMessage`/`createDebouncedDiagnosticsFeature`/`annotate*`; the shipped KEY feature and every `.qmd` document-surface value path are untouched. Operator picked "Implement S134 plan" via `AskUserQuestion` (Active empty). `docs/POSIT-COMPARISON.md` reconciled (3rd `DiagnosticCollection`, Session-135 coverage, remaining-gap narrowed to depth-2 + `.ipynb`); `BACKLOG.md` item flipped SHIPPED (deferred follow-ups retained); `PROJECT_LEARNINGS.md` #148.

### 2026-07-21 · [ad hoc] Session 134 — PLANNING: value validation for `_quarto.yml` project-config containers (`project:`/`website:`/`book:`)
Wrote `docs/planning/2026-07-21-quarto-yml-value-validation-plan.md` — the value-validation family's SIXTH slice and FIRST on the `_quarto.yml` surface (the sibling the document slices S131/S132 grounded OUT). **Deliverable = the PLAN; NO code shipped** (FM #18/#19 — implementation is a separate session). Established firsthand the key architectural asymmetry (Learning #147): the `_quarto.yml` surface resolves key NAMES only (`buildProjectConfigKeys`→`resolveClosedKeys*`, super/resolveRef-merged), and `resolveObjectProperties` does NOT walk `super`, so the S132 "reuse already-annotated `.children`" trick does NOT transfer — this slice needs three genuinely-new pieces (a project-scoped super-aware child-FIELD resolver, a scanFlow-aware bare-YAML value enumerator, a thin filename-gated feature), all reusing the shared `isWrongValue`+`valueMessage`. Grounded via a parser-mirroring harness (super-merge) + `quarto render` 1.7.33 (~25 probes): the depth-1 closed surface is **16 (container,child) positions** (project `execute-dir`; website 6; book 9 via super base-website+csl-item-shared incl. the 45-value CSL `type`; manuscript 0), every one schema-rejected on a bad value (exit 1), every open child exit 0 — zero closedness FPs. Two cardinal-sin subtleties grounded: `project.type` is `{string:{completions}}` → schema-OPEN (`banana` fails DOWNSTREAM, not the schema layer) so it stays unflagged/uncurated; and the multi-line-quoted-continuation FP (Learning #143) is LIVE because the slice adds a new enumerator. Hardened by a mandatory 4-lens `quarto render`-verified plan-review `Workflow` (`wf_17740275-975`): soundness + fp-cardinal SOUND/0-findings (both independently re-grounded clean), completeness + doc-drift SOUND_WITH_FIXES/3-LOW — all 3 re-verified firsthand and folded (`project.preview.*` cheaper deferred depth-2; `execute:` in `_quarto.yml` schema-validated today; `book.type` 45 not 44 values). `BACKLOG.md` gained the implementation item (plan pointer, NOT flipped shipped — impl session's job); `PROJECT_LEARNINGS.md` #147. `docs/POSIT-COMPARISON.md` untouched (no shipped feature to reconcile yet).

### 2026-07-21 · [ad hoc] Session 133 — MAINTENANCE: clear high-severity `brace-expansion` dev-dependency vulnerability
Cleared **GHSA-3jxr-9vmj-r5cp** (`brace-expansion` DoS via exponential-time expansion of consecutive non-expanding `{}` groups) — the single High-severity finding on the health dashboard. Two transitive **dev-only** installs bumped via the non-breaking `npm audit fix` (semver-compatible, **not** `--force`): `brace-expansion` **5.0.6 → 5.0.7** (via `@vscode/vsce` → `minimatch@10.2.5`) and **2.1.1 → 2.1.2** (via `mocha` → `minimatch@5.1.9`). **`package-lock.json` only — `package.json` untouched** (transitive-only fix). The vuln was never in the shipped product: the extension has **zero runtime dependencies** (esbuild bundles `src/` only) and `brace-expansion` is absent from `dist/`; both affected packages are the dev toolchain (test-glob + package-glob). Verified **faithfully** via the full matrix, each surface exercising the changed glob code — `npm run compile` clean, **1095 unit**, **383 integration** (real extension host, exit 0), `npx @vscode/vsce package` → clean `.vsix` (44 files). `npm audit`: **1 high → 0**. Operator picked "Clear the dep vuln" via `AskUserQuestion` (Active empty). `PROJECT_LEARNINGS.md` #146.

### 2026-07-21 · [BL-47] Session 132 — IMPLEMENTATION: value validation for 15 OTHER closed front-matter containers (SHIPPED)
Implemented the Session-131 plan (`docs/planning/2026-07-20-other-container-value-validation-plan.md`) as ONE strict-TDD vertical slice, L1→L4. A wrong CLOSED value one level under any of 15 other `.qmd` front-matter containers (`crossref.chapters: banana`, `listing.type: fancy`, `mermaid.theme: sunset`, `editor.mode: wysiwyg`, `chalkboard.theme: green`, `lightbox.effect: sparkle` → Error; valid/open/mixed-dimension/`listing:`-as-sequence → nothing) now shows an Error squiggle matching `quarto render` 1.7.33. Exactly the plan's two-change design: **(1)** a GENERAL `frontMatterKeys` `length===1` branch (`topLevelFields.find(name).children ?? []` — the children are already resolved + `annotate*`-stamped by `toField`→`objectChildren` at parse time), placed AFTER the `execute`/`format` length-1 branches; **(2)** the 15 grounded container names added to the single gate `NESTED_CONTAINERS`. The Phase-3 diagnostics loop, `isWrongValue`, `valueMessage`, and all three value-line enumerators are UNCHANGED; key/value completion under the 15 containers comes along for free (verified, no regression). `website`/`book`/`project` grounded OUT (`_quarto.yml` project-config surface); `brand`/`jupyter` grounded OUT (no closed one-level children). Commits: `6bca0be` L1 reader branch [INERT] + `62828d3` L2 `NESTED_CONTAINERS` +15 [GO-LIVE] + `823241d` L3 two grounded fixtures + a 5th integration `describe` + a completion describe + `705547e` L4. **The MANDATORY §9 adversarial review — the author's own firsthand sweep (15-container closedness matrix + name-collision + ~12 exotic continuation shapes, all `quarto render` + harness-verified) AND a fresh independent 4-lens `quarto render`-verified `Workflow` (`wf_660c796c-95d`), both — found ZERO cardinal-sin FPs and zero code defects; the FIRST value slice in the family (S124/125/128/130 each caught a real FP at L4) to come back clean**, because it added no new enumerator/matcher and reused the already-hardened shared `scanFlow`+`isWrongValue` (no new FP surface). L4 added a regression guard locking the container-agnostic quoted-fold skip on the new surface. `PROJECT_LEARNINGS.md` #145; `BACKLOG.md` item (line 48) → SHIPPED and line 47's deferral resolved; `docs/POSIT-COMPARISON.md` reconciled (Ours bullet, Notes, feature list :319, Outline recap). 1095 unit / 383 integration.

### 2026-07-20 · [BL-47] Session 131 — PLANNING: value validation for other closed front-matter containers

Wrote `docs/planning/2026-07-20-other-container-value-validation-plan.md` — the fourth widening of the value-validation family (cell/top-level/nested/numeric all shipped), reaching the value of a recognized child key one level under any OTHER closed object container in `.qmd` front matter. **Deliverable = the PLAN only; NO code shipped** (FM #18/#19 — implementation is the next session). **Scope corrected empirically** (as every prior value slice was): the operator's named `crossref:`/`website:`/`brand:`/`jupyter:` reduces to a different, richer grounded set — `website`/`book`/`project` are absent from `document-*` (project config, an `_quarto.yml` surface); `brand`/`jupyter` have no closed one-level children (0 diagnostics). The real grounded set is **15 top-level object containers / 35 validatable closed-or-numeric children** (crossref, listing, mermaid, editor, lightbox, chalkboard, scroll-view, menu, about, code-tools, identifier, ibooks, grid, notebook-preview-options, html-math-method). **Design — a general mechanism, ~2 core lines:** a general `frontMatterKeys` `length===1` branch returning `topLevelFields.find(name).children ?? []` (the children are ALREADY resolved + `annotateClosedness`/`annotateScalarType`-stamped by `toField`→`objectChildren` at parse time — no new parsing/curation) + the 15 grounded names added to `NESTED_CONTAINERS`; the Phase-3 diagnostics loop, matcher, and message are UNCHANGED, and completion improves for free through the shared reader. Grounded firsthand against `quarto render` 1.7.33 (the ACTUAL `parseSchemaIndex` esbuild-bundled over the installed schema + 48 invalid + 35 valid probes: all 35 marked-closed children reject off-list values exit 1, zero closedness FPs; open strings exit 0) + a 4-lens adversarial plan-review `Workflow` (`wf_e36facbb-375`): soundness + fp-cardinal SOUND with zero findings, completeness + doc-drift SOUND_WITH_FIXES with 4 LOW findings, all firsthand-verified and folded (the boolean-or-object safe-FN class, the `:554`→`:555` insertion line, def-vs-call-site line labels, explicit L3/L4 DONE). `PROJECT_LEARNINGS.md` #144; `BACKLOG.md` item 47 gains a plan pointer (NOT flipped to shipped — impl session's job). No `src/`/`test/` change.

### 2026-07-20 · [BL-47] Session 130 — IMPLEMENTATION: numeric type-aware front-matter VALUE validation (SHIPPED)

Implemented the S129 plan (`docs/planning/2026-07-20-numeric-frontmatter-value-validation-plan.md`) as ONE strict-TDD vertical slice — a non-number VALUE of an already-recognized numeric option now shows an Error squiggle in `.qmd` on all four surfaces, matching `quarto render` 1.7.33's YAML-schema layer (`columns: wide` top-level, `format.html.fig-dpi: hi` per-format, `execute.daemon: banana` nested, cell `#| layout-ncol: two` → Error; valid numbers, `execute.daemon: 30`/`daemon: true` (number-or-bool), `linestretch: 2em` (mixed-open), `number-offset: [1,2]` (array, skip-guarded) → nothing). **L1** (`2a8c1e4`) new `SchemaField.scalarType:"number"` + `numericTypeOfSchema` detector (structural sibling of `closednessOfSchema` — SPLIT bare-string arm so `number`/`integer` resolve numeric BEFORE the generic string→open fallback; `maybeArrayOf` recurses → `number-offset`) stamped by `annotateScalarType` at the two reader choke points + hand-annotated curated `daemon` — INERT layer. **L2** (`0360b1d`, GO-LIVE) `isWrongValue` numeric branch (shared skip first, then dispatch on `scalarType`) + `isWrongNumber` + the verified-superset `R` number-literal regex + `valueMessage` numeric arm placed FIRST (else curated `daemon` mis-messages "expected true or false"); numeric squiggles go live here (all three loops already call the shared matcher — NO new loop). **L3** (`8cb56af`) two fixtures grounded to `quarto render` (flag fixture exit 1 SCHEMA, valid FP-battery fixture exit 0) + a 4th integration `describe`. **L4** (`a85405b` + `779fa8c`) the **MANDATORY §9 adversarial review** (a fresh multi-lens `quarto render`-verified `Workflow` AND my own firsthand sweep, both independently) caught TWO cardinal-sin FPs of ONE class — **quote-blind value-line enumerators**: a multi-line quoted scalar's continuation (`title: "…\n columns: wide"` top-level, `#| fig-cap: "…\n fig-height: wide"` cell) folds into the string (quarto exit 0) but was misparsed as a mapping and flagged, now LIVE because the numeric branch validates keys that were previously OPEN. Fixed TDD by porting the nested enumerator's quote-aware `scanFlow` (S128) to BOTH the top-level and cell enumerators (relocated `scanFlow` to `qmd/model.ts` to avoid an import cycle). Exotica/resolution/lifecycle lenses CLEAN; 35 real-schema field names marked numeric with zero string/enum leak. Mirrors ONLY quarto's YAML-schema layer — the integer/float rejection (`toc-depth: 2.5`) is a downstream pandoc error the extension does NOT flag (Learning #142). Unit 1085 (+19 numeric-matcher/scalar-type + 3 top-level-quote + 4 cell-quote) / integration 377 (+5) / check-types clean / clean 44-file `.vsix`. `PROJECT_LEARNINGS.md` #143; `BACKLOG.md` item 47 → SHIPPED; `docs/POSIT-COMPARISON.md` reconciled (numeric SHIPPED). `.ipynb`, offline `CURATED_FORMAT_OPTIONS`, integer-typed pandoc-layer validation, and other closed containers (`crossref:`/`website:`/`brand:`/`jupyter:`) remain deferred (plan §4.3).

### 2026-07-20 · [BL-47] Session 129 — PLANNING: numeric type-aware front-matter VALUE validation

Wrote `docs/planning/2026-07-20-numeric-frontmatter-value-validation-plan.md` (the v2 "numeric" slice deferred by the two prior value-validation plans). Deliverable = the PLAN only; implementation is a later session (FM #18/#19 — no code shipped). Design: ONE new `SchemaField` bit `scalarType:"number"`, derived by a `numericTypeOfSchema` detector (structural sibling of `closednessOfSchema`) stamped at the two `annotateClosedness` choke points + a hand-annotated curated `daemon`, plus an `isWrongValue` numeric branch — so numeric validation reaches cell / top-level / nested / per-format surfaces through the SHARED matcher with **no new loop or enumerator** (smaller than the nested slice). Grounded firsthand against `quarto render` 1.7.33: a non-number is rejected at quarto's **YAML-schema layer** on every surface (39 marked numeric fields: 38 bare-`number` + `number-offset` + `daemon`/`toc-expand` number-or-bool); a quoted number is rejected too (flag it); the integer/float rejection (`toc-depth: 2.5`) is a **downstream pandoc-layer** error the extension must NOT mirror (Learning #142). Two `Workflow`s hardened it: a grounding workflow characterized the number-literal acceptance boundary (a verified superset regex `R`, false-negative-only, zero-FP) + an independent completeness/FP critic (caught the `section` cross-container FP risk → per-schema-node annotation rule); a 3-lens adversarial review of the DRAFT plan returned "sound and implementable" with 1 HIGH + 4 MEDIUM + 2 LOW refinements, ALL folded in (`number-offset` reclassification; L2-is-go-live / message-in-L2-FIRST; `dpi:.inf`→`fig-width:.inf` fixture + schema-accept-vs-exit-0 criterion; named `BACKLOG:47`/`POSIT-COMPARISON:466,797` doc-drift targets; `_1`/`10:30` and bare-string-split corrections). `PROJECT_LEARNINGS.md` #142. No code, tests, or `.vsix` change — planning session.

### 2026-07-20 · [BL-46] Session 128 — IMPLEMENTATION: nested front-matter VALUE validation (SHIPPED)

Implemented the S127 plan (`docs/planning/2026-07-20-nested-frontmatter-value-validation-plan.md`) as ONE strict-TDD vertical slice — a wrong VALUE of an already-recognized **nested** front-matter key now shows an Error squiggle in `.qmd`, matching `quarto render` 1.7.33 (`execute.echo: maybe`, `execute.eval: banana`, `format.html.toc: yes`, `format.html.number-sections: yes`, `format.html.df-print: banana` → Error; `execute.output`/`execute.daemon` (OPEN), `format.html.theme` (OPEN), unknown keys, and valid values → nothing). **L1** (`67d5daa`) hand-annotate `CURATED_EXECUTE_KEYS` closedness (11 closed; `daemon`/`output` LEFT OPEN — `daemon: 30`/`output: banana` render exit 0, so a closed mark would false-positive). **L2** (`0de922c`) new pure `src/core/yaml-frontmatter-nested-values.ts` `findNestedFrontMatterValueLines`, reusing the now-exported `nestedParentPath` in a forward loop + a quote-aware/node-property-aware `scanFlow`. **L3** (`2f73839`) a third loop in `computeValueDiagnostics` inverting the completion lookup `frontMatterKeys(parentPath).find(name===key)` (parentPath EXCLUDES the key) + 2 fixtures + a 3rd integration `describe`. **L4** (`1756a23`) the **MANDATORY §9 adversarial review** (a 4-lens `quarto render`-verified `Workflow`) caught ONE confirmed **CRITICAL** cardinal-sin FP the plan's flow/block-scalar guards missed — a MULTI-LINE QUOTED scalar (`title: "…\n echo: x"` renders exit 0, yet `echo` was flagged) → fixed by unifying the continuation tracker (`scanFlow`) to also follow an unterminated quote; the other 3 lenses (resolution / lifecycle / doc-drift) were CLEAN. Every closedness/FP claim rendered firsthand with quarto 1.7.33. Unit 1055 (+29) / integration 372 (+5) / check-types clean / clean 44-file `.vsix`. `PROJECT_LEARNINGS.md` #141; `docs/POSIT-COMPARISON.md` reconciled (nested values SHIPPED). Numeric type-aware, `.ipynb`, offline-fallback annotation, and other closed containers (`crossref:`/`website:`/`brand:`/`jupyter:`) remain deferred (item 47).

### 2026-07-20 · [BL-46] Session 127 — PLANNING: nested front-matter VALUE validation (plan doc only)

Wrote `docs/planning/2026-07-20-nested-frontmatter-value-validation-plan.md` (512 lines) — the design for the v2 **nested** front-matter value-validation slice the S123 plan (§4.3) deferred: flag a wrong VALUE of an already-recognized nested key (under `execute:`, `format:\n <fmt>:`) with an Error squiggle matching `quarto render` 1.7.33. **Grounded firsthand** (every `execute.*`/`format.<fmt>.*` closedness + FP-shape row rendered personally with quarto 1.7.33) + a grounding `Workflow` that compiled the reader (`parseSchemaIndex`) against the installed schema and confirmed per-format closedness is derived correctly (zero divergence → no format schema change needed). **Key design decisions:** reuse the completion provider's own lookup inverted (`frontMatterKeys(parentPath).find(name===key)`), reuse+export the existing `nestedParentPath` in a forward loop (not a hand-rolled path stack), EXTEND `computeValueDiagnostics` with a third loop (NOT a new feature — corrects the S126 "3rd caller" framing), and hand-annotate ONLY `CURATED_EXECUTE_KEYS` closedness (11 closed; `daemon`/`output` stay OPEN — boolean-or-number/anyOf-free-arm). Scoped as ONE strict-TDD implementation vertical slice (the §4 gate-(a) contract). **Mandatory 5-lens adversarial review of the plan** (each finding `quarto render`-verified): execute + format closedness CLEAN, citations CLEAN; caught a **CRITICAL + HIGH** false positive in the flow-tracking design (anchored/tagged flow opener bypassing a first-char arm; quote-naive under-count at depth with no column-0 backstop) → hardened to a quote-aware + node-property-aware `flowScan`; and a **MEDIUM** coverage-disclosure gap (other closed containers `crossref:`/`website:`/`brand:` are unreachable safe FNs) → §4.3. `PROJECT_LEARNINGS.md` #140. **Deliverable is the plan only** — implementation is a separate strict-TDD session (plan↔code boundary, FM #18). Numeric type-aware, `.ipynb`, offline-fallback annotation, and other closed containers remain deferred.

### 2026-07-20 · [BL-47] Session 126 — extract `createDebouncedDiagnosticsFeature` shared skeleton (REFACTOR, strict TDD, plan-mode gated)

Behavior-preserving extraction of the ~75-line `DiagnosticCollection` lifecycle that the unknown-KEY feature (`src/features/yaml-diagnostics.ts`) and the VALUE feature (`src/features/yaml-value-diagnostics.ts`) had both copied (rule-of-two, filed by the S123 plan). New **`src/features/debounced-diagnostics.ts`** exports **`createDebouncedDiagnosticsFeature({collectionName, gate, compute})`** returning a `register…Feature(context)` closure. The factory owns the shared machinery — 350 ms debounce, per-URI **generation guard** (the Session-47 concurrency fix; bumped synchronously in `refresh` before `await spec.compute`), D4 cancel-before-delete on close, and the prime-open-docs loop — and is a **pure writer**: `compute(document, {source, isCurrent})` returns `Diagnostic[] | null` (`null` = superseded/closed → write nothing; `[]` = clear; non-empty = set). Each feature became a thin caller (`export const registerXxxFeature = createDebouncedDiagnosticsFeature({...})`) supplying only its gate (filename for `_quarto.yml` vs `languageId==="quarto"` for `.qmd`), its collection/source/code constants, and a `compute` — the old private `refreshDiagnostics` body with its guards relocated **verbatim** (the empty-fast-path `isCurrent`, the post-await `isClosed||!isCurrent`, and the S124 pre-await text snapshot in `computeValueDiagnostics`). `src/extension.ts` (the only caller) is unchanged. Built strict-TDD via a NEW synthetic-feature integration suite (`test/integration/suite/debounced-diagnostics.test.ts`, 6 tests RED→GREEN each, RED shown at an assertion via a no-op stub): open→write, the `null` sentinel, non-gated ignored, debounced coalescing (exercises `cancelPending`), the **Session-47 generation-guard race made deterministic** with a blocked slow `compute` (genuinely new automated coverage — the two real suites can only smoke-test it manually), and prime-open-docs. The onDidClose/D4 handler ships as a verbatim copy with a documented no-automated-coverage note (closing an untitled doc auto-clears diagnostics → a false GREEN; same gap the real suites record). A `Plan`-agent design audit (PASS + 3 folded-in faithfulness constraints) bracketed the work with a post-implementation adversarial diff review that returned **no regression** across 8 faithfulness checks. Net **−240/+81** LOC across the two features. `BACKLOG.md` item 47 → `[x]`; `PROJECT_LEARNINGS.md` #139. Verified: check-types clean, **1026 unit** (unchanged — features are integration-only), **367 integration** (+6 new; both existing diagnostics suites unchanged and green = behavior preserved), clean **44-file `.vsix`**. v2 value-validation (nested/numeric/`.ipynb`) and the value-slot/prefix grammar consolidation remain filed (separate sessions).

### 2026-07-20 · [BL-43] Session 125 — Phase 2: top-level front-matter VALUE validation (SHIPPED, strict TDD)

Implemented Phase 2 of the value-validation plan (`docs/planning/2026-07-19-value-validation-plan.md` §4.2): a wrong VALUE of an already-recognized **top-level front-matter** key now shows an **Error** squiggle in `.qmd`, matching `quarto render` 1.7.33 (`toc: yes`, `number-sections: "false"` quoted-boolean, `df-print: banana` enum-non-member, `cache: banana` enum-with-boolean-members off-list, `pdf-engine: PDFLATEX` wrong-case → flagged; `toc: True`, `documentclass: myclass` (OPEN `string.completions`), `format: html`, `title:` free string → never flagged). New pure **`findFrontMatterValueLines`** (`src/core/yaml-frontmatter-values.ts`) mirrors `findProjectConfigKeyLines`, is bounded by the single `findFrontMatter`/`frontMatterContentLines` scanner (Learning #14 — never a second `---` parser), and reuses the now-exported `topLevelSlots` grammar; wired into the Phase-1 feature after the cell path (resolve each top-level scalar against `frontMatterKeys([])`, reuse the surface-agnostic `isWrongValue`, values sliced from the pre-await snapshot). **Top-level `format` stays intentionally UNVALIDATED** — its enum is injected in `indexOf` after `valuesClosed` is derived, so the matcher skips it (a safe false negative; closing the list would false-positive on extension/custom formats). **Mandatory §9 adversarial review (4-lens/13-agent `Workflow`, each finding `quarto render`-verified) returned 9/9 CONFIRMED / 0 refuted** and caught 2 cardinal-sin false positives, both fixed strict-TDD: (1) a YAML node property on a value — anchor/alias/tag (`toc: &a true`, `!!bool true`, `*a` all render exit 0) → the shared `isWrongValue` non-scalar skip guard now also skips a token beginning with `&`/`*`/`!` (protects the Phase 1 cell path too); (2) multi-line flow-collection continuation lines at column 0 (`mymeta: {` / `toc: yes,` / `x: 1}` renders exit 0) misread as top-level mappings → `findFrontMatterValueLines` now tracks flow depth and skips continuation lines. Added front-matter test coverage for the case-miss and enum-with-boolean-members families. Reconciled 3 `docs/POSIT-COMPARISON.md` staleness spots (feature now validates front-matter values; remaining gap narrowed to nested values + `format` + unknown keys). `BACKLOG.md` item 43 Phase 2 → SHIPPED (v2 nested/numeric/`.ipynb` stays open); `PROJECT_LEARNINGS.md` #138. Verified: check-types clean, **1026 unit** (+18), **361 integration** (+5), clean **44-file `.vsix`**. v2 (nested front-matter / numeric / `.ipynb`) and the `createDebouncedDiagnosticsFeature` extract remain filed (separate sessions).

### 2026-07-19 · [BL-43] Session 124 — Phase 1: cell-option VALUE validation (SHIPPED, strict TDD)

Implemented Phase 1 of the value-validation plan (`docs/planning/2026-07-19-value-validation-plan.md` §4.1): a wrong VALUE of an already-recognized `#|`/`//|` cell option now shows an **Error** squiggle in `.qmd`, matching `quarto render` 1.7.33 (`echo: maybe`, `code-overflow: banana`, a quoted boolean `echo: "true"` → flagged; `echo: True`, `output: banana` (open anyOf), `animation-hook: myhook` (open `string.completions`) → never flagged). Four-layer vertical slice: **`SchemaField.valuesClosed`/`acceptsBoolean`** derived by `closednessOfSchema` (the inverted-risk sibling of `valuesOfSchema` — an unproven node defaults to OPEN, so a `string:{completions}` field stays open despite a non-empty `values`; curated cell constants hand-annotated vs firsthand-grounded 1.7.33 shapes, `output` left OPEN); a pure **`isWrongValue`** matcher (`src/core/yaml-value-check.ts` — six unquoted boolean spellings, quote-rejecting, vs unquote+case-sensitive enum membership; skips open sets / non-scalars / empty tokens); **`engineFor`** exported (single-sourced); and **`src/features/yaml-value-diagnostics.ts`** — a sibling of the unknown-key feature copying its DiagnosticCollection lifecycle (350ms debounce, per-URI generation guard, cancel-before-delete) but gating on `languageId==="quarto"` with its own `quarto-value` collection + `quarto-invalid-option-value` code. **Mandatory §9 adversarial review (10-agent `Workflow`, each finding `quarto render`-verified) returned 6/6 CONFIRMED / 0 refuted** and caught 2 cardinal-sin false positives + 1 robustness gap, all fixed strict-TDD: (1) an enum whose members include YAML booleans (`message: {enum:[true,false,"NA"]}`) accepts `message: True` (exit 0) → `acceptsBoolean` now keys on "enum contains a boolean member"; (2) a quoted value + trailing comment (`fig-align: "center" # note`, exit 0) → quote-aware `unquote`; (3) never re-read `document.lineAt(staleLine)` after the schema await → snapshot-based extraction. Reconciled 3 `docs/POSIT-COMPARISON.md` staleness spots (2nd DiagnosticCollection; cell-option value diagnostics now shipped, keys still banned). `BACKLOG.md` item 43 Phase 1 → SHIPPED (Phase 2 front-matter stays open); `PROJECT_LEARNINGS.md` #137. Verified: check-types clean, **1008 unit** (+30), **356 integration** (+5), clean **44-file `.vsix`**. Phase 2 (top-level front-matter values) is a separate strict-TDD session (plan↔code boundary, FM #18).

### 2026-07-19 · [BL-43] Session 123 — PLAN: front-matter / cell-option VALUE validation

Planning session (deliverable = one plan doc, no production code). Wrote `docs/planning/2026-07-19-value-validation-plan.md` (v1.1) — a diagnostic that flags a wrong VALUE of an already-recognized Quarto key with an Error squiggle matching `quarto render` 1.7.33. Design: a NEW sibling feature `src/features/yaml-value-diagnostics.ts` (copies the `yaml-diagnostics.ts` skeleton), **enum-only-closedness-aware** (add `SchemaField.valuesClosed`/`acceptsBoolean`; validate only provably-closed fields), severity Error (grounded: render-fatal in both front matter AND cell metadata — supersedes the 2026-07-09 plan's stale "cell options not validated" claim). Two vertical-slice implementation phases (cell options → top-level front-matter); nested/numeric/.ipynb deferred to v2. Grounded firsthand by an 8-agent Workflow + planner renders; adversarially reviewed by a 16-agent Workflow that caught one CONFIRMED critical false-positive (`string.completions` misclassified as closed → would flag `engine: banana`/`documentclass: myclass`, which render exit 0) — fixed (string always open; corrected census 45/219 open). Also committed `docs/planning/scripts/count-value-field-shapes.mjs` (re-derivable census). `BACKLOG.md` item 43 updated to PLANNED (Phase 1/2 + v2 + a `createDebouncedDiagnosticsFeature` extract filed); `PROJECT_LEARNINGS.md` #136. Implementation is a separate strict-TDD session per phase (plan↔code boundary, FM #18).

### 2026-07-19 · [ad hoc] Session 122 post-close-out — RUNTIME EYEBALL confirms the box CSS renders

After the S122 close-out (`fb6d6b8`), the operator launched an isolated Extension Development Host (via the staged `scratchpad/launch-eyeball.sh`; the `code` CLI, not on the operator's PATH, was resolved to the app-bundle binary after a first attempt) and confirmed via screenshot that the notebook callout box CSS **renders** — all callout types appear as coloured admonition boxes (left accent bar + theme-adaptive tinted header + per-type Bootstrap icon) in live `.ipynb` markdown cells. This upgrades the box CSS from *ship-verified* to *runtime-confirmed rendering* — the first visual confirmation of the box styling, and the end-to-end validation that the `markdown-style` shadow-DOM channel fix (`1515fd8`) works. Item 17d is now fully done end-to-end (structure runtime-confirmed S121; box CSS runtime-confirmed S122). Docs-only addendum (`BACKLOG.md` 194/189, `HANDOFFS.md` S122 runtime_smoke, `SESSION_NOTES.md`); no production change.

### 2026-07-19 · [BL-194] Session 122 — FIX: notebook callout box CSS now ships via the `markdown-style` shadow-DOM channel (repairs the S120 follow-on (B); item 17d box CSS ship-verified)

Fixed the runtime-confirmed defect S121 found (BACKLOG #194). VS Code renders every notebook markdown cell inside a shadow root and clones into it only `#_defaultStyles` plus elements carrying `class="markdown-style"`; the S120-injected `<style>` lacked the class, so it never crossed the shadow boundary and the box CSS silently did not render. `injectCalloutStyles` (`src/webview/notebook-renderer.ts`) now tags the injected `<style>` `class="markdown-style"` (kept the `id` for idempotency); a bare classed `<style>` hits the built-in clone loop's else-branch (`d.cloneNode(true)`) and is cloned per-cell — grounded firsthand in VS Code's shipped `markdown-language-features/notebook-out/index.js`, and a `<template>` wrapper is not required. `calloutStyles()` itself was correct; only the shipping mechanism was wrong. Strict TDD: RED unit test (injected element carries `markdown-style` against the fake `StyleHost`) → GREEN; integration ship-check the bundle now contains `markdown-style` (grep 0 → 1). A 4-lens adversarial `Workflow` panel (11 agents) returned CLEAN on mechanism (firsthand-resolving the activate-before-clone timing) and regression, refuted a test-hardening finding, and flagged the docs the fix made stale (reconciled: BACKLOG #194 marked done + its inverted `grep → 0` proof corrected; item 17d's "RUNTIME-CONFIRMED NON-FUNCTIONAL" past-tensed). **Ship-verified** (check-types clean; 978 unit; 351 integration; clean 44-file `.vsix` carrying the class) — the on-screen RE-EYEBALL is operator-gated (kit staged in scratchpad) and not yet re-run, so the box CSS is confirmed shipping via the correct channel, not yet confirmed rendering on screen. Learning #135 (fix) + #134 (diagnosis). Also filed a pre-existing `docs/POSIT-COMPARISON.md` notebook-renderer parity-doc staleness (out of scope for this fix).

### 2026-07-19 · [ad hoc] Session 121 — RUNTIME VERIFICATION of the item-17d notebook callout rendering (structure works; the S120 box CSS does not — shadow-DOM channel)

Runtime-verification deliverable (no production code change). A collaborative operator-launched Extension Development Host eyeball — plus a firsthand read of VS Code's shipped built-in notebook markdown renderer (`markdown-language-features/notebook-out/index.js`) — resolved the open risk S120 deferred: whether the head-injected callout `<style>` reaches notebook markdown cells. **Result:** the callout STRUCTURE (all five types, custom titles (D), collapsible `<details>` (E)) RENDERS correctly in a live `.ipynb` markdown cell — confirmed visually for the first time across the whole S113–S119 thread. **But the S120 box CSS (follow-on B) does NOT apply:** VS Code renders every notebook markdown cell inside a SHADOW ROOT (`renderOutputItem` → `o.attachShadow({mode:"open"})`, no light-DOM path) and clones only `#_defaultStyles` plus elements tagged `class="markdown-style"` into it; our `injectCalloutStyles` appends a bare `<style>` (no `markdown-style` class) to `document.head`, which cannot cross the shadow boundary — so callouts render as plain unstyled title+body. Artifact proof (found without a GUI): `grep markdown-style dist/notebook-renderer.js` → 0. `calloutStyles()` (the CSS string) is correct and unit-tested; only the shipping mechanism is wrong. Corrected `BACKLOG.md` item 17d's "FULLY COMPLETE" claim (structure shipped + runtime-confirmed; box CSS confirmed non-functional) and filed the fix as a new BACKLOG item (ship the CSS via the `markdown-style` channel — its own strict-TDD session). Learning #134. Verification-only: no code touched, so no `.vsix`/test rerun.

### 2026-07-19 · [ad hoc] Backfilled (reconcile-on-read): undocumented commit `5f43732` — S120 post-close-out runtime-eyeball breadcrumb

Reconcile-on-read backfill (Phase 0 step 6). After the Session 120 close-out commit (`155cb18`, the ledger frontier), a lone post-close-out commit `5f43732` recorded to `SESSION_NOTES.md` that the operator-authorized Extension Development Host eyeball of the callout boxes was **inconclusive** — the GUI would not launch from the sandboxed tool context and the notebook opened in a window that had not loaded our extension (`--extensionDevelopmentPath` absent), so it rendered without our renderer. It flags an untested risk (a head-injected `<style>` may not reach VS Code notebook markdown cells — CSP / shadow DOM / separate renderer container) for a dedicated runtime-verification session. Docs-only, no production change; recorded here so the durable ledger reflects the action.

### 2026-07-19 · [BL-17d] Session 120 — CSS box styling for the notebook markdown-cell callout renderer (BACKLOG item 17d follow-on (B); item 17d now FULLY COMPLETE)

Feature (strict TDD). The notebook markdown-cell Quarto callouts now render as coloured admonition boxes. New pure-core `calloutStyles()` (`src/core/notebook-callout.ts`) returns the CSS the renderer webview injects: a base `.callout` box (border, rounded corners, header/body padding, collapsible-`<summary>` cursor, icon `::before` scaffold) plus, per known callout type, the grounded `quarto render` 1.7.33 accent (`border-left-color` + a theme-adaptive translucent header tint via `hexToRgb` — a disclosed divergence from quarto's fixed light tint so it reads in both light and dark VS Code themes) and the grounded per-type Bootstrap-Icons glyph (info-circle/lightbulb/exclamation-triangle/cone-striped/exclamation-circle) as a data-URI `background-image`. `injectCalloutStyles()` (`src/webview/notebook-renderer.ts`) injects it once (idempotent by element id; `<head>` or `documentElement` fallback) from `activate`. The CSS targets OUR class structure (`.callout`/`.callout-header`/`.callout-title`/`.callout-body`, both the `<div>` and `<details>`/`<summary>` forms), NOT quarto's Bootstrap DOM — a visual/semantic equivalent (same posture as the S119 `<details>` collapse slice). The palette + icon↔type mapping were grounded firsthand vs quarto 1.7.33 and independently re-verified before any test; the icons are Bootstrap Icons (MIT, disclosed in `NOTICE`). Strict TDD: 4 RED→GREEN increments (`17f136b` base box + per-type accent+tint + per-type icon; `f4905b9` the injection helper) + 2 regression-lock coverage batches (`68e7883`, in `f4905b9`) + an integration ship-check (`fd23874`). A 5-lens adversarial `Workflow` panel (11 agents) found 3 in-scope findings — 1 refuted (global-scope `.callout` selectors over the user's own Quarto content, accepted) and 2 genuine doc/structure defects (a stranded JSDoc + a stale `CALLOUT_STYLE` reference left by the increment edits) fixed at root (`c16a573`). Rendered box is EYEBALL-ONLY (no webview DOM read-back); verified via the unit suite (the CSS string) + the integration bundle ship-check. 977 unit (+17) / 350 integration (+1) / clean 44-file `.vsix` (notebook-renderer bundle ~18.4 KB, was ~13.1; markdown-it still host-provided, grep 0). Learning #133. Item 17d is now fully complete (all follow-ons A/B/C/D/E shipped).

### 2026-07-19 · [ad hoc] Session 120 — Phase 6d b2-iii DESCOPED (operator decision); Phase 6d declared a complete milestone

Grooming decision (no code). At Phase 0, with the BACKLOG "Active" section empty, the operator was offered the sole remaining Phase 6d slice — `b2-iii-deep` (depth-4 deep-nesting + `super`/`resolveRef` inheritance merge, the plan's own explicitly-optional residue past its recommended stopping point) — and chose to **descope it**, declaring Phase 6d a complete milestone. `BACKLOG.md` updated: the Phase 6d parent marked COMPLETE and `b2-iii-deep` marked `[~]` DESCOPED (re-openable on a new operator decision; the plan `docs/planning/2026-06-30-phase-6d6b2iii-deep-nesting-plan.md` keeps it buildable-if-chosen). No production change.

### 2026-07-19 · [BL-17d] Session 119 — collapsible callouts (`collapse` → `<details>`) in the notebook markdown-cell renderer (BACKLOG item 17d follow-on (E))

Feature (strict TDD). `src/core/notebook-callout.ts` now renders a Quarto callout carrying a `collapse` attribute as a collapsible HTML `<details>` element, grounded firsthand vs `quarto render` 1.7.33 before any test. This renderer is JS-free (quarto's HTML uses Bootstrap collapse toggled by JS), so the faithful static equivalent is a `<details>` whose `<summary>` is the callout header: `collapse="true"` (or unquoted `collapse=true`) starts collapsed; **any** other value — `"false"`, `"TRUE"`, `"True"`, `"maybe"`, `""` — is collapsible but starts expanded (`<details open>`), matching quarto (any collapse value is collapsible; only the exact lowercase `true` starts collapsed); a callout with no `collapse` attribute stays the pre-existing non-collapsible `<div>` (unchanged). `collapse` composes with both title sources (a `title=` attribute and an extracted leading heading land in the `<summary>`). A generic (non-callout) div's `collapse=` is untouched — it stays a plain `data-collapse` attribute, byte-matching quarto (`<div class="foo" data-collapse="true">`). Increments `0ba05f2` (collapse → `<details>`/`<summary>`), `e137350` (value-dependent open/closed state), `344310b` (case-sensitivity / close-form / title & type interactions / generic-div isolation regression-lock coverage). A 6-lens adversarial `Workflow` panel (14 agents) then caught one genuine in-scope defect — a literal `data-collapse="true"` written directly on a callout was hijacked as the collapse control (both a source `collapse=` and a literal `data-collapse=` normalise to the same `data-collapse` name via `htmlAttrName`), where quarto treats `data-collapse` as an inert passthrough on a non-collapsible callout — fixed (`27c952d`) by a new `calloutCollapse` that keys on the SOURCE `collapse` key; the panel's other confirmed divergences (a bare `collapse` flag with no value; a leading-whitespace quoted value) were adjudicated firsthand as pre-existing-root and documented on the divergences item in `BACKLOG.md` (#12–#13). `check-types` clean, 960 unit (+14: 105 in notebook-callout) / 349 integration (unchanged — pure-core, no wiring/manifest touched) / clean 44-file `.vsix` (notebook-renderer bundle ~13.1 KB; markdown-it still host-provided, grep 0). Learning #132.

### 2026-07-19 · [BL-17d] Session 118 — custom callout titles in the notebook markdown-cell renderer (BACKLOG item 17d follow-on (D))

Feature (strict TDD). `src/core/notebook-callout.ts` now renders custom callout titles, matching `quarto render` 1.7.33 / pandoc 3.6.3 (grounded firsthand before any test). A non-empty `title=` attribute on a callout (`::: {.callout-note title="Foo"}` → title "Foo") overrides the default type name; otherwise a leading heading (any level, ATX `##` or setext underline) becomes the title and is removed from the body (`::: {.callout-note}` / `## My Title` / body → title "My Title", heading gone). `title=` wins over a leading heading (the heading then stays in the body); an empty `title=""` or an empty leading heading falls back to the default type name (the empty heading is still stripped); the title is rendered as inline markdown via `md.renderInline` (`**b**` → `<strong>`, with `&`/`<`/`>` escaped). Generic (non-callout) divs are untouched — their `title=` stays a plain HTML attribute and headings inside them are never extracted. Implementation: the block rule extracts `title=` via the existing `parseDivAttrs` tokenizer and, after tokenising the body, splices out a leading `heading_open`/`inline`/`heading_close` triple and carries the title on the open token's `meta`; `renderCalloutOpen` (now a closure over `md`, threaded the render `env`) renders it. The 17 existing callout tests and the generic-div path are unchanged. Commits `ea9ba17` (title= attribute), `8325f72` (leading-heading extraction), `7415739` (inline-markdown fidelity), `6cff2bd` (precedence/empty/setext/escaping regression-lock coverage). A 6-lens adversarial `Workflow` panel (19 agents) then caught one genuine in-scope regression — an empty leading heading (`##`) produced a blank title bar where quarto falls back to the default — fixed (`3c56ba9`) by only setting the title when the extracted heading is non-empty, still splicing it out; the panel's other findings (heading-attribute leak, `}`-in-title callout→div flip, multi-line setext, whitespace-only value) were adjudicated firsthand as pre-existing-root divergences and documented on the divergences item in `BACKLOG.md`. `check-types` clean, 946 unit (+16: 90 in notebook-callout) / 349 integration (unchanged — pure-core, no wiring/manifest touched) / clean 44-file `.vsix` (notebook-renderer bundle 12.2 KB; markdown-it still host-provided, grep 0). Learning #131.

### 2026-07-19 · [ad hoc] Session 117 — fix HIGH nested same-length fenced-div mis-pairing in the notebook markdown-cell renderer (BACKLOG item filed at S116 close-out)

Bug fix (strict TDD). `src/core/notebook-callout.ts`'s `calloutRule` closing-fence scan accepted the FIRST fence of at least the opener's length as the closer, with **no nesting/depth tracking** — so an inner and outer Pandoc fenced div of the same `:::` length made the outer grab the INNER div's closer and close early, ejecting following content and folding the real outer closer into literal `<p>` text. Common in real Quarto docs (a `.callout-note` inside a `.panel-tabset`, a `.column` inside `.columns`); pre-existing since S113, affecting both the callout admonition path and the generic-div path (shared scan). **Fix (`f11e7c8`):** the scan now tracks nesting depth — each fence line is a CLOSER when only whitespace follows the colons (decrement at depth>0, else our closer) or a nested OPENER when its params open a div by our own rules (new `isDivOpener`: a known callout class or a generic div with an id/class/attr); the closer's colon count is now independent of the opener's (needing only ≥ 3), matching pandoc (a `::::` div closes on `:::`). Grounded firsthand vs quarto-bundled pandoc 3.6.3 across same-length, mixed-length, unbalanced, bare-word, callout-in-generic, generic-in-callout, and triple nesting. A 5-lens adversarial `Workflow` panel then caught a regression the depth fix introduced — the flat scan had no fenced-code awareness, so a `:::`-looking OPENER shown as example code inside a ```` ``` ````/`~~~` block was counted as a nested opener and consumed the div's real closer (verified firsthand: pre-fix matched pandoc, post-depth-fix broke). **Fix (`66c2913`):** the scan tracks fenced-code state (mirroring markdown-it's fence rule) and treats every line inside a code block, `:::` included, as literal — also resolving the pre-existing bare-`:::`-inside-code early-close. The panel's other findings (empty `::: {}` and paragraph-glued openers nested in a div) were adjudicated firsthand as pre-existing/self-consistent, out of scope (noted on the divergences item in `BACKLOG.md`). Callout admonition path byte-identical (17 callout tests unchanged). `check-types` clean, 930 unit (+12: 8 nesting + 4 code-fence) / 349 integration (unchanged) / clean 44-file `.vsix`; markdown-it still host-provided (grep 0). Commits `f11e7c8`, `66c2913`. Learning #130.

### 2026-07-19 · [BL-17d] Session 116 — generic-div key=value attributes + bare-word shorthand in the notebook markdown-cell renderer (BACKLOG item 17d follow-on)

Feature (strict TDD). The notebook markdown-cell renderer (`src/core/notebook-callout.ts`) now EMITS `key=value` attributes on generic Pandoc fenced divs and accepts the bare-word shorthand, matching `quarto render`: `::: foo` ≡ `::: {.foo}` → `<div class="foo">`, and `::: {.box key=v style="s"}` → `<div class="box" data-key="v" style="s">`. S115's strip-and-ignore `parseDivAttrs` was replaced by a real attribute tokenizer implementing pandoc's rules — the HTML5 `data-` prefix rule for unknown attribute names (a **214-name known-attribute passthrough set derived firsthand from the quarto-bundled pandoc 3.6.3**), `class=`/`id=` merge into the class list / id, class + duplicate-attribute dedup, and attribute order id→classes→source-order. Attribute values are decoded through the host markdown-it's `unescapeAll` (backslash escapes + HTML character references), reproducing pandoc's litChar so `\.csv`→`.csv` and `&amp;`→`&amp;` (no double-encoding). The callout admonition path is byte-identical (the 17 callout tests are unchanged and green; `calloutType` runs first, the generic-div branch handles only what it rejects). Grounded firsthand vs pandoc 3.6.3 and hardened by a 6-lens adversarial `Workflow` panel that caught 4 real in-scope bugs — 21 missing event-handler names (the first firsthand derivation's candidate list was incomplete), un-decoded backslash/entity values, a `{…}`-glued-trailing bare-word regression introduced by a same-session restructure, and a leading-underscore key over-acceptance — all fixed TDD. The panel also surfaced (verified firsthand, filed to `BACKLOG.md`, NOT fixed — pre-existing/out-of-scope) a HIGH nested-same-length-fenced-div mis-pairing bug plus several LOW cosmetic/pathological divergences. `check-types` clean, 918 unit (+32) / 349 integration (unchanged) / clean 44-file `.vsix`; markdown-it still host-provided (bundle ~9.9 KB, grep 0). Commits `0ea4c83`, `94e109d`, `a6451e3`, `931f308`, `caa571c`, `b470655`, `4e809d3`, `eb79946`, `dc20e88`. Learning #129.

### 2026-07-18 · [BL-17d] Session 115 — render generic Pandoc fenced divs in the notebook markdown-cell renderer (BACKLOG item 17d follow-on C)

Feature (strict TDD). The notebook markdown-cell renderer (`src/core/notebook-callout.ts`) now renders a non-callout Pandoc fenced div `::: {.className}` (with an id and/or class(es)) as a plain `<div id=… class=…>body</div>` instead of raw `:::` text — filling the gap the callout-only rule left (S113/S114 rendered only the five known callout types). A new generic-div branch (`div_open`/`div_close` tokens, id/class carried via `token.attrSet` and rendered through `renderer.renderAttrs`) runs only when `calloutType` rejects the class, so the callout admonition path is byte-identical (the 17 pre-existing callout tests are unchanged and green). `key=value` attributes and bare-word `::: foo` shorthand are deferred; `key=value` segments are stripped before id/class extraction so a `.`/`#` inside a quoted value is never misread. The exact `<div>` output was grounded firsthand against `quarto render`/pandoc (id first, classes space-joined, last-id-wins, interior dots kept).

Two RED→GREEN feature increments (classes → id) + coverage guards, then a 5-lens adversarial `Workflow` panel found and this session fixed one MEDIUM (a `.`/`#` inside a quoted `key="value"` value fabricated a phantom class/id, e.g. `::: {style="padding: .5em"}` → `<div class="5em">`, breaking the deferred-key=value fall-through contract on common input; fixed by stripping key=value before scanning) and two LOW Pandoc-fidelity gaps (several ids kept the first not the last; interior-dot names `.a.b`/`#id.class` were truncated) — each verified firsthand against pandoc 3.1.1 before fixing, all TDD. Commits `2e073bb` (classes) / `87d51b1` (id + guards) / `572cc5c` (key=value strip fix) / `c91b82c` (multi-id + interior-dot fix). Verified: `check-types` clean, **886 unit** (872 + 14 in the callout suite), **349 integration** (unchanged — the `notebookRenderer` wiring/manifest are untouched), clean **44-file `.vsix`**; the notebook-renderer bundle is 4.5 KB with markdown-it still host-provided (grep 0). `PROJECT_LEARNINGS.md` #128. Deferred follow-ons (all LOW): (B) CSS box styling, (D) custom callout titles, (E) `collapse`, and generic-div `key=value`/bare-word shorthand.

### 2026-07-18 · [BL-17d] Session 114 — render tip/warning/caution/important callouts; first-known-class-wins fix (BACKLOG item 17d follow-on A)

Feature (strict TDD). The notebook markdown-cell callout renderer (`src/core/notebook-callout.ts`), shipped for `callout-note` only in S113, now renders **all five Quarto callout types** — `note`/`tip`/`warning`/`caution`/`important` — as their admonition blocks (`class="callout callout-<type>"` + default title). The single-type block rule was generalised to a data-driven `CALLOUT_TITLES` map: the export `calloutNotePlugin` was renamed **`calloutPlugin`**, one `callout_open`/`callout_close` token pair carries the type on `token.info`, and the renderer reads the class + title from the map. Done in the right TDD order — a behavior-preserving refactor (note-only, all 865 tests stayed green) then each new type added RED→GREEN.

**Adversarially verified by a 3-lens panel, which caught a regression the generalisation introduced:** the first-cut capturing regex had a greedy `[^}]*` before the capture, so a div listing two `.callout-*` classes locked onto the **last** one — `{.callout-note .callout-bogus}` rendered nothing and `{.callout-note .callout-tip}` flipped to tip (both regressions vs the note-only literal). Fixed to **first-known-callout-class-wins** (a scan, not a single capture), which also restores byte-identical single-class output and correctly resolves a real class followed by a `.callout-*` substring inside an attribute value. Two false positives the panel flagged (non-ASCII `.callout-noté`; `.callout-` inside an attr value with no real class) are pre-existing — shared with the note-only code, unchanged this session.

CSS box styling remains a deferred follow-on (still structural-only — the `:::` markers vanish and the body renders under the type's title, but no coloured box yet; eyeball-only). Commits `d8f656e` (refactor/rename, no behavior change), `ffff176` (four new types), `e19e603` (first-known-class-wins fix). `check-types` clean, **872 unit** (865 + 7), **349 integration** (unchanged — wiring untouched), clean **44-file `.vsix`**; markdown-it still host-provided (not bundled). Learning #127.

### 2026-07-18 · [BL-17d] Session 113 — notebook markdown-cell callout-note renderer (BACKLOG item 17d)

Feature (strict TDD). New **`contributes.notebookRenderer`** (`quarto-mit.markdown-it-callout`, extending VS Code's built-in `vscode.markdown-it-renderer`) renders a Quarto **`::: {.callout-note}`** fenced div as a note-admonition block inside `.ipynb` **markdown** cells, instead of showing raw `:::` text. First slice = the `callout-note` type only.

Genuinely new contribution-point infrastructure (first `notebookRenderer`, first browser/esm bundle, first `markdown-it` dependency). The mechanism was grounded **firsthand** against the shipped VS Code built-ins (`markdown-language-features/notebook-out/index.js` declares the base renderer whose API is `extendMarkdownIt: cb => cb(md)`; `markdown-math`/`ipynb` `notebook-out/*.js` are the `extends`-based worked examples): the renderer entrypoint runs in the notebook renderer **webview sandbox** and installs a markdown-it plugin into the host-provided `md`.

- **Core (`src/core/notebook-callout.ts`, pure `vscode`-free §3.3):** `calloutNotePlugin(md)` registers a container block rule (count the opening `:` run → validate the `{.callout-note}` attribute block → scan the closing fence → tokenise the body as markdown between `callout_note_open`/`callout_note_close` tokens) plus renderer rules emitting the callout markup. `import type MarkdownIt` only, so the shipped webview bundle never contains markdown-it (it uses the base renderer's instance). RED (module-missing) → GREEN; 10 unit tests through `md.render()`.
- **Adapter/infra:** `src/webview/notebook-renderer.ts` (`activate(ctx)` fetches the base renderer via `ctx.getRenderer("vscode.markdown-it-renderer")` and installs the plugin); `esbuild.js` gains a 2nd context (`platform:'browser', format:'esm'`, no externals) emitting `dist/notebook-renderer.js` (2.8 KB); `package.json` declares the contribution. `markdown-it` + `@types/markdown-it` added as devDependencies (test-time only).
- **Verification:** `check-types` clean; **865 unit** (855 + 10); **349 integration** (346 + 3), gate-d break-revert-proven by breaking the manifest renderer id; clean **44-file `.vsix`** (43 + `dist/notebook-renderer.js`). The on-screen box is eyeball-only (the renderer webview DOM has no ext-host read-back); the first slice is structural (the `:::` markers vanish and the body renders under a "Note" label) — CSS box styling is a filed follow-on.

### 2026-07-18 · [BL-17e] Session 112 — quarto.newNotebook: create a new Quarto .ipynb notebook (BACKLOG item 17e)

Feature (strict TDD). New **`quarto.newNotebook`** ("New Quarto Notebook") command creates a new in-memory (untitled, unsaved) Quarto `.ipynb` notebook — a raw YAML front-matter cell (`title` + `format: html`) followed by an empty python starter code cell — and opens it in the notebook editor. Discoverable in the command palette and File▸New File….

The front-matter cell is a `NotebookCellKind.Code` cell with `languageId: "raw"`, which VS Code's built-in `jupyter-notebook` serializer writes as a Jupyter `cell_type: "raw"` cell — how Quarto reads a notebook's YAML front matter. That mapping was verified **firsthand against the shipped serializer** (`notebookSerializerWorker.js` `S(t)`; `ipynbMain.node.js` `F1`), not assumed, and additionally **machine-verified in the Extension Development Host in both directions** (save: `Code`+`"raw"` → `cell_type "raw"`; load: `cell_type "raw"` → `Code`+`"raw"`). The adapter mirrors VS Code's own `ipynb.newUntitledIpynb`, seeding `NotebookData.metadata = { cells: [], metadata: {}, nbformat: 4, nbformat_minor: 5 }` per call so the saved file carries a valid nbformat header.

New pure `src/core/new-notebook.ts` (`buildNewNotebookCells(title)` returns `vscode`-free `{ languageId, value }` cell descriptors; reuses `buildNewDocumentContent` for title normalization + YAML escaping; deliberately no markdown cell, so the resident notebook cannot leak markdown-heading workspace symbols) and `src/features/new-notebook.ts` adapter, wired in `src/extension.ts`. Core RED→GREEN unit-tested (6); adapter integration-tested (5: registration, the two-cell creation path, the "Untitled" fallback, the save-direction serializer proof, the load-direction serializer guard) and break-revert-proven (gate d): breaking the command id reddens exactly the 3 command-dependent tests while the serializer guards stay green. Adversarially reviewed — 5/5 load-bearing claims survived refutation, no correctness bug. `check-types` clean, 855 unit (849 + 6), 346 integration (341 + 5), clean 43-file `.vsix`. Commits `7125bf4` (core), `3978965` (adapter/manifest/wiring), `66843e9` (save-direction proof + per-call metadata). Learning #125.

### 2026-07-18 · [BL-17a] Session 111 — cell-execution code-cell background highlighting (BACKLOG item 17a)

Feature (strict TDD). Executable `{lang}` code cells in a `.qmd` now get a faint background tint so each reads as a distinct block — a STATIC decoration of cells that *can* run (Run Cell delegates out-of-process, so there is no running-cell state to reflect), matching Posit's default behavior. New pure `src/core/cell-background.ts` (`cellBackgroundRanges` maps `findAllCells` to fence-inclusive whole-line spans; `resolveCellBackgroundSettings` + `DEFAULT_CELL_BACKGROUND` resolve config with defaults) and `src/features/cell-background.ts` adapter (a config-gated whole-line `vscode.TextEditorDecorationType`, kept in sync on active/visible-editor, document, and configuration changes; gated on `quarto.cells.background.enabled` + the quarto languageId). Three `contributes.configuration` keys — `quarto.cells.background.enabled` (default `true`), `.light` (`#0000000F`), `.dark` (`#FFFFFF14`). Core RED→GREEN unit-tested; adapter integration-tested (document→ranges bridge + enabled/languageId gating + apply path, break-revert-proven); a manifest guard pins the `package.json` defaults to `DEFAULT_CELL_BACKGROUND`. `check-types` clean, 849 unit (835 + 14), 341 integration (337 + 4), clean 43-file `.vsix`. Gate d: VS Code exposes no read-back for applied decorations, so the enabled/languageId gating and apply path are the faithfully-tested surfaces and the rendered tint is confirmed by the exercised runtime path (activate ran the feature in the EDH; `setDecorations` ran with real ranges) plus an eyeball check — the visual pixels are not machine-observable. Commits `a36f273` (core), `b5cbf28` (adapter/config/wiring). Learning #124.

### 2026-07-18 · [BL-17c] Session 110 — create-document-family presets: quarto.newPresentation + quarto.fileNewDocument (BACKLOG:64 item 17c)

Feature (strict TDD). The two `.qmd` presets of `BACKLOG:64` item 17c — create-document-family discoverability commands over the existing untitled-`.qmd` path (Posit parity, `POSIT-COMPARISON.md` Session 67):

- **`quarto.newPresentation`** → opens an untitled `.qmd` with `format: revealjs`.
- **`quarto.fileNewDocument`** → the File▸New File… variant of `newDocument` (untitled `.qmd`, `format: html`); contributed to `contributes.menus["file/newFile"]` and hidden from the command palette (`when:"false"`) so it doesn't duplicate `quarto.newDocument`.

`buildNewDocumentContent` (`src/core/new-document.ts`) is now parameterized by a `NewDocumentFormat` union (`html`|`revealjs`, default `html` — every existing caller byte-identical); the three commands share one `newQuartoBuffer` helper. **Verification:** RED→GREEN on the core format parameterization (a genuine AssertionError, not a type error); 835 unit (834+1) / 337 integration (333+4) / clean 43-file `.vsix`; break-revert-proven the integration wiring (registration/behavior tests red when the two registrations are disabled, while the manifest-reading `file/newFile` menu test stays green — gate d). Commits `62a172d` (core) + `c76661b` (wiring).

**Scope decision (operator, S110).** The third Posit command, `quarto.newNotebook`, creates an `.ipynb` — a different mechanism (notebook creation, not a text buffer) — so it was split out of 17c into new **item 17e** rather than bundled here. `BACKLOG:64` item 17c marked `[x]`; item 17e appended (`BACKLOG.md` 189 → 190 lines; item 17c rewritten in place, so no cited line shifted). Technique recorded as `PROJECT_LEARNINGS.md` #123.

### 2026-07-18 · [ad hoc] Session 109 — split BACKLOG:64 item 17 (the 4-way bundle) into individually-grabbable items 17a–17d

Backlog grooming / triage (doc-only, strict-TDD-exempt — no product logic; verification is citation-integrity). `BACKLOG:64` item 17 — a "lower priority / narrower audience" bundle of four unrelated sub-features that could not be picked or estimated as one unit — was decomposed into four individually-grabbable items:

- **17a** cell-execution code-cell background highlighting (`quarto.cells.background.*`) — cosmetic decoration; cell-range infra already exists.
- **17b** Reticulate execution pathway (`quarto.cells.useReticulate`) — needs engine (Knitr/Jupyter) detection, which does not exist yet (the load-bearing unknown to scope first).
- **17c** create-project-family discoverability (`quarto.newPresentation`/`.newNotebook`/`.fileNewDocument`) — thin presets over existing `quarto.newDocument`/`quarto.createProject`.
- **17d** notebook markdown-cell Quarto-aware renderer (`contributes.notebookRenderer`) — new contribution-point infra; niche.

**Method (preserves the line-number citation scheme).** `BACKLOG:NNN` citations are line-number-based (17 distinct cited lines across code/docs/tests, highest 185). Item 17's single physical line (line 64) was rewritten IN PLACE as a 1-line pointer, and 17a–17d were APPENDED at the end of the file (185 → 189 lines), so no cited line shifted — verified by `git diff --numstat` (`5  1`, one line modified in place) and by spot-printing every cited line post-edit (each still resolves to its original item). No `src/`/`test/`/`package.json` change. The technique is recorded as `PROJECT_LEARNINGS.md` #122.

### 2026-07-18 · [BL-176] Session 108 — deliberate dev-toolchain upgrade cleared all 7 `npm audit` advisories

Dev-toolchain maintenance session (config; strict-TDD-exempt — no product logic, the full verification
matrix is the correctness proof). `BACKLOG:176` closed `[x]`.

**Changed.** `npm audit` went from **7 vulnerabilities (4 moderate / 2 high / 1 critical)** to **0**, the
right way — a deliberate, separately-verified bump, *not* `npm audit fix --force` (which downgrades
mocha to 8.1.3 for zero end-user benefit). Three edits to `package.json` (+ `package-lock.json`):
`esbuild` `^0.24.2`→`^0.28.1` (bundler; clears the esbuild dev-server advisory); `vitest`
`^2.1.8`→`^3.2.7` (unit runner; resolves `vite`→7.3.6, `vite-node`→3.2.4, `@vitest/mocker`→3.2.7 — all
above their vulnerable ranges — and clears the critical vitest-UI advisory `<3.2.6`); and a new
`overrides: { "serialize-javascript": "^7.0.7" }` (clears the `serialize-javascript` high advisory
**and** mocha's transitive-only advisory in one pin). `mocha` kept at `^10.8.2`: even the latest mocha
(11.7.6) still pins `serialize-javascript ^6.0.2`, so bumping mocha cannot clear it — only the override
does — and a major mocha bump adds breaking-change risk for no audit benefit. The override is inert to
runtime (mocha runs single-process here; `serialize-javascript` is only exercised by mocha's parallel
reporter).

**Verified (full matrix).** `check-types` clean; **834 unit** under vitest 3.2.7 (46 files, count
unchanged — no vitest-3 breakage); **333 integration** in a real VS Code Extension Development Host that
loads the actual esbuild-0.28.1 bundle (so the bundle is runtime-exercised, not just compiled — not FM
#24); clean **43-file `.vsix`**; `npm audit --json` → `{moderate:0, high:0, critical:0, total:0}`. The
standing "none of these ship" invariant re-verified four ways (empty runtime `dependencies`, no `src/`
imports, whole-token grep of `dist/extension.js` → 0, `vsce ls` → 0 `node_modules`). `docs/SECURITY-AUDIT.md`
updated to the cleared posture with the per-advisory resolution recorded.

### 2026-07-17 · [BL-103] Session 107 — the after-dispatch deactivate re-registration race fixed with a global `deactivated` latch

Implementation session (strict TDD). `BACKLOG:103` closed `[x]`.

**Fixed.** A cell forward dispatched *entirely after* `disposeAllVdocs` runs re-registered a vdoc
holding the user's real cell source into the just-cleared maps. `ensureVdoc` snapshots the monotonic
`disposeAllEpoch` before its awaits and re-checks after, but that counter bumps exactly once per
deactivate — so a forward that snapshots the already-final value slips both re-checks and reaches
`live.set`/`filesOf().set`. Reachable because `deactivate()` fire-and-forgets `void disposeAllVdocs()`
and the host disposes provider subscriptions afterward, so a debounced semantic-tokens pass can still
dispatch through a live provider past the bump; nothing in that session reclaims the stranded file.
The fix is a module-global `deactivated` boolean, set in `disposeAllVdocs` alongside the epoch bump,
checked at the top of `ensureVdoc`, and cleared by a new `resetDeactivation()` called from `activate()`
(a disable→re-enable without a window reload retains the JS module, so a never-reset latch would leave
embedded features dead).

**Rejected the predecessor handoff's unsourced "needs a per-document latch."** A per-document latch
shares the epoch's set-side blind spot — an after-dispatch forward may be for a document in no map to
key a per-owner latch on — so the latch must be global. The filed premise that the fix "would apply
symmetrically to `disposeVdocs`" is likewise false and is corrected on the record: the per-document
close sibling is unreachable (a closed document receives no forward; semantic tokens' retry timer is
cleared by `provider.forget()` in the same close handler) and self-healing (a re-registration lands in
`docFiles`, reclaimed at session-end `disposeAllVdocs`). Pinned in a comment at `disposeVdocs`.

**Test hygiene (the item's two filed nits).** The doc-close in-flight assertion is tightened from a
dead `if (uri !== undefined)` branch to `assert.strictEqual(uri, undefined)` (matching its S91
deactivate sibling); the cross-suite coupling from tests calling the process-global `disposeAllVdocs()`
mid-suite is closed by `afterEach(resetDeactivation)` in every latch-setting describe, making the suite
order-independent.

A RED integration test observed a real stranded `vdoc-mit.*.py`; the guard is break-revert-proven
load-bearing (disabled → the new test reddens, the epoch-guarded mid-forward sibling stays green); a
5-lens plus completeness-critic adversarial review found no refutation. Bounds: `check-types` clean,
**834 unit** (unchanged — `ensureVdoc` imports `vscode`, no headless surface), **333 integration**
(332 + 1 new), clean 43-file `.vsix`.

### 2026-07-17 · [BL-182/183] Session 106 — Phase 3 (final) of the OS temp-vdoc sweep plan: the false "self-healing" comment corrected

Implementation session, comment-only (TDD-exempt — no logic changed). `BACKLOG:182` (umbrella) and
`BACKLOG:183` (this comment) both closed; the whole `docs/planning/2026-07-16-os-temp-vdoc-sweep-plan.md`
plan is now shipped (Phase 1 S103, Phase 2 S104, Phase 3 S106).

**Fixed.** Two source comments in `src/features/embedded-vdoc.ts` claimed a cross-window / OS-reaper
delete of an in-use vdoc file is *"self-healing: `ensureVdoc` notices the model is gone and re-mints."*
That mechanism is false (measured in a real Extension Development Host, plan §3.5): `isModelOpen()` tests
the **in-memory model** (`vscode.workspace.textDocuments`), not the file — it returns `true` for a file
deleted 10s earlier, flipping false only at a ~180s eviction. So `ensureVdoc` never "notices" the delete;
the case is **harmless because the model outlives the file** (requests are served from the open in-memory
document, not the file on disk), not self-healing. Both sites — the `ensureVdoc` reuse branch (`:196-201`)
and the `sweepStaleVdocs` docstring (`:354-361`) — now state the measured mechanism; `grep -ran
"self-healing" src/` returns nothing.

**Verified.** `check-types` clean; **834 unit** and **332 integration** both **unchanged** (a comment
edit moves no test count — the plan's own DONE signal); clean 43-file `.vsix`. The two new comment
rewordings were run through a 3-lens adversarial refutation pass (mechanism / overclaim / code-consistency)
before commit — all three returned "not refuted"; one flagged that naming "completions" (Python
completions go through out-of-process Pylance, whose file-watcher was the plan's explicitly *unmeasured*
caveat) generalized past the hover-only measurement, so the wording was tightened to "requests are served
from the open in-memory document" to state only the measured mechanism.

**Record corrected.** The plan's §3.4/C2/§3.6 citation of `embedded-vdoc.ts:373-375` as the disclosure
comment had rotted (that line is now `sweepFolder`'s *ownership* comment); re-pinned to `:551-553`
(`vdocDirFor`'s "information disclosure" docstring). `BACKLOG:183`'s stale claim that "Phase 3's scope is
the `:348-354` comment alone" was corrected — there were two `self-healing` sites, both fixed.

### 2026-07-17 · [BL-184] Session 105 — de-binary-fied `core/embedded/vdoc-path.ts`: the NUL-byte key separator is now the escape `"\0"`

Implementation session, strict TDD. `BACKLOG:184` closed.

**Fixed.** `src/core/embedded/vdoc-path.ts` held two raw NUL bytes — `vdocKeyString`'s field
separator (`.join("\0")`, written as a literal `0x00`) and an inline copy of it quoted in the
docstring above. Consequences, both re-measured firsthand this session: `git diff` rendered the file
`Bin … 0 insertions` (every change to it invisible to review), and `grep -rn` **silently skipped** it
(exiting 0, reading like "no match") — so any grep-based evidence inventory over `src/`, which this
project mandates for deletion-shaped work, was blind to the delete-loop ownership grammar the file
owns (`TEMP_DIR_RE`, `isOurVdocFileName`, `VDOC_DIR_SEGMENTS`). The fix replaces the source literal NUL
with the escape `"\0"`: the **emitted byte is unchanged** (the key is an in-memory `Map` key only —
one call site, `embedded-vdoc.ts:190`, never persisted or cross-session — so the change is provably
inert), but the source is now plain text. Rejected the item's own prescription to swap in a new
printable separator: that re-prices the collision risk rather than removing it (you must then prove the
new char cannot occur in any field value), whereas byte-identity is provable by an exact-equality test.
The false "the separator is a space" comment in the docstring and the unit test is corrected to "NUL
byte."

**Tests.** RED→GREEN on a new `test/unit/source-hygiene.test.ts` that scans `src/**/*.ts` for any NUL
byte — RED (flagged `vdoc-path.ts` at byte 8990) before the fix, GREEN after, and a durable regression
guard against reintroduction anywhere in `src/`. Plus an exact-byte pin on `vdocKeyString` output
(`… .join("\0")`, with `includes("\\0") === false`) that catches the classic `"\0"`→`"\\0"` two-char
typo; break-revert-proven load-bearing (only that pin reddens under the typo). Full matrix: `check-types`
clean, **834 unit** (832 + 2 new), **332 integration** (unchanged — no regression), clean 43-file `.vsix`.
The runtime value is byte-identical by construction and by the exact pin, so there is no runtime
behaviour change to smoke-test; the integration Extension Development Host exercised the vdoc path
regardless and is unchanged.

Commit `c3354c9` (deliverable: the fix + both tests + `BACKLOG:184` → `[x]`); 1B claim `63fb45b`.

### 2026-07-17 · [BL-182] Session 104 — SHIPPED Phase 2 of the OS temp-dir vdoc sweep: the fallback dir stays 0700 after a delete-underneath

Implementation session, strict TDD. **Phase 2 of `docs/planning/2026-07-16-os-temp-vdoc-sweep-plan.md`**.
`BACKLOG:182` **stays open** — only Phase 3 (the comment fix) remains.

**Fixed.** `vdocDirFor` memoises the private `mkdtemp` fallback directory for the whole session and,
before this change, returned it to every later untitled forward without re-checking that it still
existed. If the OS reaper (Linux, ~10 days) or the user deleted it, the next `ensureVdoc` write went
through `vscode.workspace.fs.writeFile`, whose internal `mkdirp` **silently re-creates** the parent with
`fs.promises.mkdir` and **no mode argument** → `0777 & ~umask` (**0755** measured at umask 022, **0777
world-writable** at umask 000). The user's actual cell source then landed in a world-readable directory —
a real information disclosure on Linux, where `/tmp` is world-listable and `readdir` defeats `mkdtemp`'s
unpredictability. It also falsified a shipped `README.md:174` promise ("`0700` on macOS and Linux").

**How.** `vdocDirFor` now `stat`s the memoised directory before handing it back; on `ENOENT` it re-mints
a fresh `0700` `mkdtemp`. The re-mint uses the same **identity-CAS** discipline the module's existing
`.catch` models (`if (fallbackDirPromise === memo)`), so two concurrent forwards that both find the
directory gone do not each mint one and orphan the loser's (the BL-102 leak class the plan flagged as its
un-named dragon). No resolved-value companion to `fallbackDirPromise` was reintroduced (S101 removed it
deliberately).

**Correction on the record.** The filed cause ("a reclaim racing a live forward can downgrade the dir")
no longer holds after Phase 1: the sweep's self-skip + ESRCH-only liveness guard mean our *own* sweep can
never delete a live directory, so the real trigger is OS/user deletion. `BACKLOG:182` updated to match.

**Verified.** RED-proven — the identical integration test observed `0755` with the fix absent (a clean-build
assertion failure, not a build break), then `0700` with it present. `check-types` clean; **832** unit
(unchanged — the branch imports `vscode`, so it has no headless unit surface); **332** integration (331 +
1); clean 43-file `.vsix`. Runtime-exercised end-to-end in a real Extension Development Host (the new test
drives a real untitled document, a real filesystem deletion, and a real `writeFile`, then stats the real
resulting directory mode). Files: `src/features/embedded-vdoc.ts` (`vdocDirFor`),
`test/integration/suite/embedded-vdoc.test.ts` (new describe). Commit `f4c4009`.

### 2026-07-17 · [BL-182] Session 103 — SHIPPED Phase 1 of the OS temp-dir vdoc sweep: a crash's stranded vdocs are now reclaimed

Implementation session. **Phase 1 of `docs/planning/2026-07-16-os-temp-vdoc-sweep-plan.md`**, shipped as
ONE operator-ratified 4-layer vertical slice with a checkpoint commit and the full verification matrix at
every layer boundary. `BACKLOG:182` **stays open** — Phases 2 and 3 remain.

**Fixed.** A crash, SIGKILL or host teardown with an untitled `.qmd` open stranded that document's vdocs
— the user's actual cell source, not a cache — in the OS temp dir, where nothing ever reclaimed them
(`sweepStaleVdocs` only reads `<workspace>/.quarto/vdoc-mit/`). Until the OS cleared them: at reboot on
macOS, ~10 days on a typical Linux, **never on Windows**.

**Added.** `hostDiscriminator` / `tempVdocDirPrefix` / `tempVdocDirParse` in the pure
`core/embedded/vdoc-path.ts` (L1, `575c9a3`); `isProcessDead` + `sweepStaleTempVdocs(dir?)` in
`features/embedded-vdoc.ts`, and `mkdtemp` now stamped `quarto-mit-vdoc-<host>-<pid>-XXXXXX` (L2,
`c4aff29`); activation wiring + the `README.md` correction (L3, `41f8956`); the guard matrix (L4,
`d437968`). The sweep reclaims **only** directories bearing our host tag whose owning PID is
`ESRCH`-dead — **`EPERM` means ALIVE**, and inverting that would delete a live window's source.

**Runtime-verified**, not merely built: fixtures planted in the real `$TMPDIR` and a real Extension
Development Host activation reclaimed the dead-PID directory while G0 (foreign host), G2 (live foreign
PID) and G4/G5 (foreign file) each spared theirs. A previous run's own leaked directory was reclaimed as
corroboration. Every guard break-revert-proven individually.

**Corrected after a 57-agent adversarial review** (`3797e2e`, `6514064`): `hostDiscriminator`'s docstring
inverted G0's failure direction in the dangerous direction (a host-tag collision makes G0 *fail open* → a
wrong delete; the *leak* comes from a hostname change) — the plan's §4.2 row carried the same error and is
corrected too; `os.hostname()`/`os.tmpdir()` sat outside the try in a `void`-called function (a C6
unhandled-rejection hole at startup); two comments this change itself made stale; a README `0700` promise
that cannot hold on Windows; and two tests that passed without proving what they claimed.

**Filed, not fixed** (both at the end of `BACKLOG.md`): `vdoc-path.ts` holds two raw NUL bytes so git and
grep read it as **binary** — pre-existing, and it silently defeats the grep-based inventory this project's
planning sessions depend on; and the 🐉1 EPERM discriminator cannot run as root or on Windows.

**Verification:** `check-types` clean, **832 unit** (+4), **331 integration** (+10), clean 43-file `.vsix`.

*Commit span for this entry:* `c18eb72` (1B claim) … `86069c3` (dashboard snapshot), i.e. the whole
session — the slice (`575c9a3`, `c4aff29`, `41f8956`, `d437968`), the review fixes (`3797e2e`,
`6514064`), and the close-out records (`ffe3f84`, `3d430f9`, `86069c3`). *Recorded here so the next
Phase 0 reconcile sees a frontier at HEAD rather than a spurious gap: the close-out commits are the
mechanics of this one action, not separate unrecorded actions.*

### 2026-07-16 · [ad hoc] Session 102 — PLANNED the OS temp-dir vdoc sweep (`BACKLOG:182`); the item's severity and its filed fix both CORRECTED on measured grounds

Planning session. **No `src/` or `test/` change** (verified by checksum — the deliverable is the plan;
FM #18 keeps plan and implementation in separate sessions).

**Added** `docs/planning/2026-07-16-os-temp-vdoc-sweep-plan.md` — a design plan for reclaiming the
virtual documents a crash strands in the OS temp dir. The code defect is confirmed and airtight
(re-verified firsthand): `extension.ts:73` sweeps only workspace folders, `os.tmpdir()` has exactly one
executable site (`embedded-vdoc.ts:390`), and nothing ever reclaims the untitled-document fallback dir.
**Recommendation:** host-tag + PID-stamped `mkdtemp` (`quarto-mit-vdoc-<h>-<pid>-XXXXXX`), reclaiming
only `ESRCH`-dead PIDs bearing our own host tag (`EPERM` means ALIVE). Three phases, each a session,
each with DONE criteria and verification commands. Grammar executed against a real `mkdtemp`, not
merely specified.

**Corrected `BACKLOG:182` in place** (line-number citations preserved; 30 verified unmoved) on three
measured points: (1) its headline evidence — "56 dirs with 2–11 real vdoc files" — measures **0** today
and was a developer-machine artifact (the test host is SIGKILLed each run), not a user's rate; (2) its
security clause "0644 files inside a 0700 dir" is **refuted** — `writeFile` with no mode is
`0666 & ~umask` (0666 at umask 000), so the bound is the *directory alone*, making this **disk-hygiene,
not cross-user disclosure**; (3) its proposed fix (reuse the workspace `INSTANCE_ID` skip) would delete
a **live** sibling window's directory, which VS Code then silently resurrects at **0755** — a hygiene
fix causing the exact disclosure the code exists to prevent. Real bounds: macOS = reboot interval,
Debian = 10 days, **Windows = unbounded** (the actual win). `globalStorageUri` evaluated and **rejected**
(turns rare cross-window collisions into always; adds profile fragmentation).

**Surfaced a scheduling constraint that reframes the item:** the directory grammar locks at first
publish, and the extension has **never** shipped (v0.0.1, `preview: true`, 0 git tags, CHANGELOG all
`[Unreleased]`) — so the design is free to get right today and frozen the moment `vsce publish` runs.

**Filed (not fixed), new item at the END of "Polish / deferred":** `embedded-vdoc.ts:333-337`'s
"self-healing" claim is **false** — `isModelOpen()` returned true for a file deleted 10s earlier
(flipping only at an unrelated ~180s model-eviction mark); the bottom line survives for the opposite
reason (the model *outlives* the file). Includes the new, unrelated finding that vdoc models
self-destruct at ~180s in normal operation, with the `_cleanup()`-valve interaction unmeasured.

**Also noted:** `README.md:170-173` already promises the swept behaviour and is **false today** for
untitled documents — Phase 1 pays that debt off rather than creating one.

Learning #113 recorded: a claim inherited from your own subagent is still inherited — the plan's first
draft carried a dragon labelled "Measured" that was a probe's prose gloss, refuted by its own review.

### 2026-07-16 · [ad hoc] Session 102 — recorded the health-dashboard snapshot

`dashboard_history.jsonl` — the append from Phase 0 step 5's mandated `methodology_dashboard.py` run
(health 78/100; the single "critical" risk flag is the known dev-only `npm audit` posture accepted in
Session 13 — `dependencies: {}`, so nothing ships). Logged as its own action rather than folded into
the close-out commit above: it is a separate commit, and "too small to log" is failure mode #27, not an
exception.

### 2026-07-16 · [ad hoc] Session 101 — FIXED the `fallbackDirPromise` memo lifecycle: `BACKLOG:102` CLOSED and `BACKLOG:121` leg (b) FIXED (one code surface)

Fixed both filed defects in `src/features/embedded-vdoc.ts`'s untitled-document fallback state — they are the same
~6 lines, not two areas, which is why they were taken together. Under strict TDD: both tests RED first for the right
reason, then GREEN, and all three source changes break-revert-proven load-bearing against their own tests.

- **`:102` — a deactivate racing an unresolved `mkdtemp` leaked the private 0700 temp directory.** CONFIRMED by
  observation, with two corrections to the filed item. It is **not a race**: `disposeAllVdocs` reaches its fallback
  check after `await Promise.all(...)`, which for the untitled-first-forward case is a microtask, and microtasks
  always drain before the loop can deliver `mkdtemp`'s threadpool completion — so the leak is the common case
  (2 of 2 unstubbed runs). And **the filed fix was insufficient**: with only "observe `fallbackDirPromise`", the
  directory still survived every run, EMPTY — the in-flight forward writes its file before the non-recursive `rmdir`
  lands, `rmdir` fails ENOTEMPTY, and the forward's own epoch guard then removes the file, leaving the very empty
  directory the fix targets. Needed a third change: a pre-write epoch re-check in `ensureVdoc`.
- **`:121b` — a transient `mkdtemp` failure latched a rejected promise for the whole session**, leaving completion /
  hover / go-to-definition / signature help / in-cell outline / Format Cell silently dead on every untitled `.qmd`
  until a window reload. The filed text understated it: the reset sat behind the success-only `if`, so a rejection was
  cleared by *nothing*, deactivate included. Fixed at the rejection site, guarded on still being the same attempt.
- **The resolved `fallbackDir` companion variable is deleted.** The diff removed its last real read, leaving
  write-only state behind a comment calling it live; holding the memo only as its promise is what makes the state
  unmisreadable, and reading a resolved value during the creation window *was* the bug.
- **Filed, not fixed (scope):** a crash with an untitled `.qmd` open strands the user's source in the OS temp dir
  permanently — nothing sweeps it (`extension.ts:73` sweeps only workspace folders). Found by looking at the machine:
  56 leaked directories, 2–11 real vdoc files each. Bigger than either item fixed here.

Files: `src/features/embedded-vdoc.ts`, `test/integration/suite/embedded-vdoc.test.ts` (+2 tests, new describe),
`BACKLOG.md` (`:102` → `[x]`, `:121` leg (b) resolved, both rewritten IN PLACE to preserve 30 line-number citations;
new item appended at the end), `PROJECT_LEARNINGS.md` #111, `HANDOFFS.md`, `SESSION_NOTES.md`.
321 integration (was 319) / 828 unit / check-types clean / clean 43-file `.vsix`.

### 2026-07-16 · [ad hoc] Session 100 — PINNED the RANGE axis of `BACKLOG:125` (both legs), made its coverage STRUCTURAL, and CLOSED the item

Pinned the (b) RANGE-registry axis S99 left characterized-but-unpinned — the divergence path our `{ojs}`/`{js}` cells
actually traverse, since the built-in TypeScript extension registers ONLY a range provider (1.129.0: 0 doc / 1 range).
Two new integration tests, both RED-first in a real Extension Development Host and both break-revert-proven to
discriminate. **No `src/` production code changed and none can be** — the non-fix proof is unchanged (provider identity
never crosses the RPC boundary).

**What the session found that the record did not have.** (1) The existing suite never exercised this branch at all: the
Slice-2 javascript stand-in registers a *document* provider, which makes `hki` true and silently reroutes every `{ojs}`
test onto the document path — the test environment and production traversed *different branches*, the concrete instance
of Learning #109 (now Learning #110). (2) The THROW leg is real and has no document-axis counterpart: `ZNt` swallows
per-provider errors and its `uki` record has no error field at all, where the doc path's `dki` carries one and `mki`
rethrows — so a crashing server is a safe no-op on the document path and a WRONG COLOUR on the range path. (3) The
legend fall-through passes NO range, landing on VS Code's own self-warned blind branch while the correct `ZNt`-based
pairing sits one line below it.

**Coverage is now structural rather than input-specific.** `has()` and `_orderedForEach()` filter the same `_score>0`
over the same `_entries`, so `hki(i,t)` <=> `rdn(i,t)!==null` and both commands always pick the SAME registry per
snapshot: doc non-empty -> document axis (S99 pin); doc empty -> range axis (S100 pins); both empty -> we degrade. That
trichotomy is exhaustive over ALL inputs, so `{r}`/`{julia}` need no separate measurement — a claim the previous,
javascript-specific framing could not make.

**The item is CLOSED** — the first time either axis's session could say so. What licenses it is the structural argument
above (S99 lacked it and its close would have been false); both axes are pinned, no fix is constructible on either, a
default install is safe, and the only residual action — upstream escalation — is contingent on a user report. The two
pins stay as tripwires.

**A third precondition was raised, and REFUTED — including against my own first draft.** The review's scope lens
proposed a "two-read race": our two `executeCommand`s each re-read the registry (`_updateScores` per invocation, no
shared snapshot), so a mutation between them would diverge the pair with no decline, no throw and no tie group. I
adopted it and wrote it into the record as measured. It is false, and I confirmed the refutation with my own
positive-controlled probe in a real EDH: the sequential recipe `await legendCmd(); registerB(); await tokensCmd()` DOES
diverge (proving the probe is not blind), but our actual `Promise.all` shape — with the rival registered at every
earliest moment (same tick, `queueMicrotask`, `setTimeout(0)`, `setImmediate`) — never saw it (`bCalls=0`, every run).
There is no window: the ext-host send chain is synchronous, so both messages queue in ONE tick on a FIFO channel, and
each handler completes its registry read before its first await; a registration lands before both or after both. **"No
shared snapshot" is not "an observable interleaving"** — the latter needs an await, and there is none. My evidence for
the race was S89's *prose* retry note reasoned backwards, i.e. an inherited diagnosis treated as a measurement — the
exact #107 trap, committed while authoring a learning about it (Learning #110's second half now records that).

Also corrected two claims of my own the review caught: the "observationally identical" tripwire note (false — `ZNt`
calls every provider, so a leg-(1) fix DOUBLES the call counts) and an overclaim that the premise assertions guard
against built-in TS interference (they do not; `isBuiltin` ordering does). Files:
`test/integration/suite/semantic-tokens.test.ts` (the new describe + the S99 pin's now-stale cross-reference),
`BACKLOG.md` (`:125` -> `[x]`, rewritten IN PLACE to preserve its 7 line-number citations), `PROJECT_LEARNINGS.md`
#110. 319 integration (was 317) / 828 unit / check-types clean / clean 43-file `.vsix`.

### 2026-07-16 · [ad hoc] Session 99 — CONFIRMED + PINNED the document axis of `BACKLOG:125` (semantic-token legend/stream provider divergence); item stays OPEN

Proved firsthand, in a real Extension Development Host, that VS Code's semantic-token legend and token stream really
can come from DIFFERENT providers — and corrected the item's filed *mechanism*, which was wrong in three ways. The two
commands do NOT resolve "independently": both read the same `orderedGroups(model)[0]` tie-group, deterministically and
stably (`_time` DESC — the last-registered of a tie owns the legend). They index that one group by DIFFERENT rules —
the legend command takes `group[0][0]` BLIND (never calling it), while the tokens command returns the FIRST member that
ANSWERS — so they agree **iff `group[0][0]` answers**. That precondition, a top provider that DECLINES, is the whole bug
and the filing omitted it. New integration test "PINS a VS Code platform defect…" stages it with a declining rival
python provider carrying an inverted legend; the RED showed `function.declaration@1:0` where the answering provider
meant `variable.readonly@1:0` — a silently WRONG colour, not a dropped token. The test is retained as a tripwire.

**No production code changed, and none can be:** both proposed fix directions are refuted from the API's own bytes.
S98's handoff framing ("fetch legend + stream atomically from the same provider") is impossible — the answering
provider's identity never crosses the RPC boundary (`SemanticTokens` is `{resultId,data}`; registration carries no
extension id), so we cannot pair atomically **and cannot detect** that it happened. The tempting range-pair swap is a
regression (separate registry; fallback runs doc→range and never range→doc, so it would drop every full-only server).

**The item is NOT closed** — the standing 6-lens adversarial review refuted this session's own planned conclusion. A
SECOND divergence path survives in the RANGE registry, and it is the one our `{ojs}`/`{js}` cells already traverse:
the built-in TS extension registers only a range provider (0 doc registrations), so `javascript` has no document
provider and both commands fall through, the legend one with no range argument — which VS Code itself warns is
"might be out-of-sync" and answers with a blind `r[0]`. That axis is characterized but unpinned, and is BROADER
(`ZNt` swallows errors, so a THROW diverges too). `BACKLOG:125` rewritten in place with both axes; the (b) pin is the
next actionable step. Learning #109. 317 integration (was 316) / 828 unit / check-types clean / clean 43-file `.vsix`.

### 2026-07-16 · [ad hoc] Session 98 — CLOSED test-coverage MEDIUM (`BACKLOG:123`): pinned per-language semantic-token isolation

Pinned the claim that a throwing embedded-language server takes nothing down with it. `streamFor`'s try/catch is
per-language (every exit a value), so a failing server drops out of the `Promise.all` and the merge proceeds with
whatever streams arrived — but the integration suite only ever made a stand-in throw when it was the *only* language
(the Slice-1 "…when the language server ERRORS" test), so "a failing server takes nothing with it" was asserted, not
pinned. Added ONE Slice-2 test — "keeps the OTHER language's tokens when one server THROWS": a throwing python
stand-in + a healthy javascript one over the STRADDLED fixture, asserting `tokens !== undefined`, both languages
genuinely asked, and the decoded stream is EXACTLY `["variable.readonly@4:0"]` (python's throw dropped, javascript's
one token surviving and decoded against its own inverted legend). **No `src/` production code changed** — the shipped
code was already correct; this closes a test-**coverage** gap. Break-revert-proven to discriminate (swapping
`streamFor`'s `catch { return undefined }` for a re-throw reddens exactly this test + the Slice-1 "…ERRORS" test),
reverted to byte-identical HEAD. Standing 4-lens adversarial review + synthesis found zero test-quality defects and
confirmed the item's premise accurate (flipped to `[x]` without reframing) and the reverse orientation not a residual
gap. **316 integration** (was 315) / 828 unit / check-types clean.

### 2026-07-15 · [ad hoc] Session 97 — FIXED MEDIUM: semantic-token modifier fidelity (`BACKLOG:127`) — carry `typeHintComment`, REFUTE `builtin`

Resolved the modifier axis of the semantic-token fidelity item, and **corrected its filed headline**. Firsthand
grounding (a real-Pylance 2026.2.1 probe + effective Dark-2026 theme-trie resolution, last-wins) split the item's
two instances in opposite directions. **(a) `typeHintComment` — FIXED:** real Pylance tags a legacy `# type:`
comment's interior `class.typeHintComment` (verified on the wire); we were clearing the modifier and repainting the
comment interior as a live type (`entity.name.type` #4EC9B0 teal vs the `.py`'s #8b949e comment colour). Now carry
the modifier in `OUR_LEGEND` + a `quarto`-scoped `*.typeHintComment` → `comment.typehint.type.notation.python`
contribution mirroring Pylance's own rule (the shape of the shipped `module` fix, on the modifier axis). **(b)
`builtin` (the filed HEADLINE) — REFUTED, not carried:** Pylance ships no `function.builtin`/`variable.builtin`
scope rule, so a real `.py` shows `print`/`__name__` in the plain `function`/`variable` colour — exactly what our
bare-modifier `.qmd` already shows; carrying `builtin` would *diverge* from the `.py` even in the default theme.
Strict TDD (RED shown before GREEN on both the legend carry and the manifest rule). Standing multi-agent adversarial
review (6 candidates → 3 test/doc-quality survivors, all fixed; the correctness lenses confirmed the decision and one
caught a hex-citation error, corrected). No `src/` behavior beyond the legend + manifest; 828 unit / 315 integration
/ 14 real-LSP / check-types clean / clean 43-file `.vsix`. Learning #108.

### 2026-07-15 · [ad hoc] Session 96 — FIXED MEDIUM: the 4 RED integration tests; refuted the S95 "1.129 drift" diagnosis

Greened the integration suite (`BACKLOG :119`), and **corrected its filed root cause**. The 4 failures in
`semantic-tokens.test.ts` "multi-language merge (Slice 2)" were NOT VS Code version drift (as S95 filed): they
reproduce identically (311 pass / 4 fail, same 4× `@0:0`) on BOTH VS Code 1.128.1 and 1.129.0. True cause: since
S93, `buildVirtualContent` injects `# type: ignore` on a python vdoc's line 0, and the stand-in
`tokensForNonBlankLines` emits a token per non-blank line — so it spuriously tokenized the mute comment, landing
a token at `.qmd` line 0 (no coordinate remap). Production was always correct (real Pylance emits no token there,
pinned in `real-lsp.test.ts:469`). Fix: (1) the stand-in now skips the `# type: ignore` line (models a real
server) — greening all 4 with unchanged, semantically-correct expectations; (2) `test/integration/runTest.ts`
now pins `version: "1.129.0"` (genuine hygiene against future drift, though drift was not the cause). Corrected
`BACKLOG :119`, `PROJECT_LEARNINGS.md` #106(c), and added #107. 315 integration / 825 unit / clean 43-file `.vsix`.

### 2026-07-15 · [ad hoc] Session 95 — FIXED MEDIUM: memoised `scanRegions` (the 2+2N per-pass rescan)

Fixed the S89-filed MEDIUM (`BACKLOG :118`): a semantic-token pass re-scanned the whole document **2+2N times**
(N = embedded languages) because the shared region parser `scanRegions` (`src/core/qmd/model.ts`) had no cache —
`embeddedLanguagesIn` scans twice and `buildVirtualContent` scans twice more per language, on every debounced pass
for every visible `.qmd`. Added a **single-entry (last-value) memo keyed on the exact document text** (renamed the
scan body to `computeRegions`; `scanRegions` now serves the cache), collapsing all same-text calls in a pass to
**one** scan while evicting naturally on text change (a `Map` keyed on full text would grow unboundedly). Sound
because `computeRegions` is a pure function of `text`. The three accessors that handed out internal arrays
(`findHeadings`/`findAllCells`/`findBodyLines`) now `.slice()` so the shared cache can't be corrupted by a caller.
Strict TDD: contract tests (aliasing-independence + full-text keying) break-revert-proven to discriminate; the
2+2N→1 collapse proven firsthand with throwaway instrumentation (10→1 scans on a 4-language doc), reverted before
commit. 825 unit (+6) / type-check clean / clean 43-file `.vsix`. Standing 10-agent adversarial review: 1 real LOW
(docstring over-claimed isolation for element mutation — `.slice()` copies the spine, not elements — and one
tautological test), both fixed. Integration suite delta ZERO (see the new BACKLOG finding on its 4 pre-existing
failures). Learning #106.

### 2026-07-15 · [ad hoc] Session 94 — REFUTED the S89 passive-minting "cheap fix" (evidence-based BACKLOG correction; MEDIUM→LOW) + fixed a stale item-14 sub-bullet

Investigated the S89-filed MEDIUM "`{r}`/`{julia}` semantic-token vdoc minting is passive." The operator picked
it at Phase 0; grounding it firsthand **refuted the filed fix before any production code** (Learning #105). The
proposed cheap fix — "gate `embeddedLanguagesIn`'s targets on the languageId being registered via
`needsLanguageExtension`/`getLanguages()`" — cannot work: VS Code core ships built-in *language-basics*
extensions (grammar + config, **no server**) for `r`, `julia`, `python`, and `javascript`
(`<VSCode.app>/Contents/Resources/app/extensions/{r,julia,python,javascript}`, v1.128.0), so `getLanguages()`
returns all four in every standard VS Code and `needsLanguageExtension` is `false` for the whole mapped set. A
RED integration test whose **premise was asserted** (`!getLanguages().includes("r")`) fired on the first run;
the app-bundle inspection confirmed the cause. Two further facts: the first speculative mint is architecturally
unavoidable (no API detects a semantic-tokens provider without a real document; an `undefined` legend is not a
reliable "no provider" signal — S89), and the residual harm is bounded (the vdoc is gitignored, disposed on
close, swept on activation). **Deliverable = an evidence-based `BACKLOG.md` correction**: the item is rewritten
to record the refutation, downgraded **MEDIUM→LOW**, and the only correct approach (an unavoidable-first-mint
lifecycle change) documented for a future session; the installed-R-server diagnostics concern is cross-linked to
the (unmeasured) R/Julia-leak item. No production code shipped (the fix was refuted, not implemented). Also
**corrected a stale BACKLOG sub-bullet** (`BACKLOG.md:54`): item 14 Slice 2 (filepath `CompletionItemProvider`)
was SHIPPED in Session 81, but its sub-bullet was left at `[ ] PENDING` when S81 flipped the parent to `[x]` —
that lone stale `[ ]` is what the S91/S92/S93 handoffs kept re-ranking as the top "next" candidate. `PROJECT_LEARNINGS.md`
#105 appended.

### 2026-07-15 · [ad hoc] Session 93 — FIXED HIGH: the `diagnosticMode:"workspace"` embedded-vdoc Problems-panel leak (candidate G)

Implemented candidate G from the Session 92 plan: a python-gated file-level `# type: ignore` injected on the
vdoc's already-blanked line 0, in both pure builders (`src/core/embedded/virtual-doc.ts` `buildVirtualContent`
+ `buildCellVirtualContent`). Under Pylance's non-default `python.analysis.diagnosticMode: "workspace"`, the
background vdoc models were diagnosed on their tracked membership (injected at `didOpen`, location-independent)
and flooded the Problems panel with phantom errors on `.quarto/vdoc-mit/*.py` paths; the file-level mute
suppresses Pyright's type/name/import diagnostics while preserving completion/hover/imports. Gated python-only
(a `#` is a JS syntax error) and to non-whitespace python body content — the same condition `embeddedLanguagesIn`
uses, NOT `keep.size > 0`, so the `embeddedLanguagesIn ⟺ non-empty` invariant holds (the plan's stated gate was
refined at the contract re-verification — Learning #103). Line 0 is never a code body line, so the write shifts
no coordinate.

Verified **RED→GREEN live** against real Pylance 2026.2.1 under `QMD_LSP_DIAGMODE=workspace` (`npm run
test:lsp:workspace`): pre-fix the fixture's vdocs carried `"df" is not defined` / `Import "pandas" could not be
resolved`; post-fix zero vdoc diagnostics, completion preserved, no line-0 semantic token. The standing
11-agent adversarial review found ZERO surviving defects; the completeness critic's items were test/tooling
hardening (a `control.py` liveness control replacing a blind sleep; a `test:lsp:workspace` script; a
cell-at-line-0 unit test). Commits `48bdf2a` (L1) / `772e0dc` (L2) / `15840c5` (review response). 819 unit /
13 real-LSP (workspace) / clean 43-file `.vsix`.

**Scope (honest):** FIXED for the persistent type/name/import phantom class (the cross-cell "df is not defined"
and unresolved-import pollution the item is really about). Does NOT suppress transient parse/syntax errors
(`os.` mid-typing) — `# type: ignore` cannot; filed as a residual. R/Julia are UNMEASURED (no such servers
here); the fix SHAPE extends but the string `# type: ignore` is Pyright-specific — filed. Format Cell has an
unverified cell-at-line-0 adjacency edge — filed. `BACKLOG.md` HIGH marked FIXED (python) with the three
follow-ups; `docs/POSIT-COMPARISON.md` noted.

### 2026-07-14 · [ad hoc] Session 92 — PLAN: the `diagnosticMode:"workspace"` embedded-vdoc Problems-panel leak

Design/architecture plan (`docs/planning/2026-07-14-embedded-vdoc-diagnostics-leak-plan.md`) for the HIGH
"Polish / deferred" item — embedded vdocs publishing phantom diagnostics into the Problems panel under
Pylance's non-default `python.analysis.diagnosticMode: "workspace"`. Firsthand grounding against real Pylance
2026.2.1 **refuted the obvious fix** (relocating vdocs out of the workspace — the OS-temp vdocs leaked
identically, because Pyright injects tracked membership at `didOpen` time, location-independent) and
**confirmed the recommended fix**: a file-level `# type: ignore` on the vdoc's already-blanked line 0
(python-gated) fully suppresses the leak while preserving completion (n=273) and emitting **no** spurious
line-0 semantic token. A 13-agent adversarial review of the first draft refuted its initial recommendation (a
`deleteQuietly`→`WorkspaceEdit` disposal-timing change: partial + max blast radius on the S88/S91 race paths)
and surfaced the in-content class. **Plan only — no code shipped; implementation is a separate session
(FM #18/#19).** Learning #102.

### 2026-07-14 · [ad hoc] Session 91 — FIXED (HIGH): the `disposeAllVdocs` deactivate-strand race

An in-flight embedded-language forward (semantic tokens fire on a debounced timer up to the moment
the window closes) that resumed after extension **deactivate** re-registered its virtual document,
stranding a copy of the user's cell source in `.quarto/vdoc-mit/` until the next session's activation
sweep. The sibling `disposeVdocs` (document close) was guarded in Session 88 by a per-document epoch;
`disposeAllVdocs` bumped no epoch, so the shutdown race was unguarded. Fixed with a single monotonic
global shutdown generation (`disposeAllEpoch`), bumped synchronously-first in `disposeAllVdocs` and
snapshotted before `ensureVdoc`'s awaits — a per-owner bump could NOT reach the race (at deactivate
there is no `docUri` and the forward is not yet in any map; the RED test proved it, stranding a real
`vdoc-mit.*.py`). Bump is synchronous-first so the guard holds even though `deactivate()`
fire-and-forgets `disposeAllVdocs`. Commits `a634564` (fix + RED-proven integration test) and
`43b0ac1` (test tightening from the S91 review). Adversarially reviewed (9 agents; 5 of 6 lenses
empty); two residual PRE-EXISTING LOWs filed to `BACKLOG.md`. Learning #101. 811 unit / 315
integration / clean 43-file `.vsix`.

### 2026-07-14 · [BL-16] Session 90 — item 16 Slice 3 SHIPPED: the D4 legend decision. **Item 16 is CLOSED.**

Semantic highlighting via the embedded language's LSP is now complete end to end. Slice 3 resolved D4
(plan §5.4) — and the obvious answer was a **regression**, which is the finding.

- **Carry exactly `module`** (`src/core/embedded/semantic-tokens.ts` `OUR_LEGEND`) + a new
  `contributes.semanticTokenScopes` for `language: "quarto"` (`module` → `entity.name.namespace`).
  Deliberately NO `contributes.semanticTokenTypes` — that registry is a global bare-id-keyed map whose
  deregistration is owner-blind, so declaring Pylance's ids would mean our uninstall degrades the user's
  plain `.py` files.
- **Why not carry all 12 foreign names and "recover" the measured 36% we drop:** a `.qmd`'s `{python}`
  cell is *already* coloured by VS Code's bundled MagicPython grammar, so the semantic layer paints OVER
  a grammar that is mostly right — a carried-but-unstyleable name **overrides** TextMate rather than
  degrading to it. `magicFunction` would have turned `__init__` from #DCDCAA to #d2a8ff purple.
  (Learning #99, the **triage rule**: a serving extension's own `semanticTokenScopes` entry for a type is
  that author saying the superType default is *wrong* for it — and those entries are `python`-gated, so
  inert on a `.qmd`. The set with no entry is the set safe to carry.)
- **The standing adversarial review (61 agents) caught a real defect in this slice's own work** — 11th
  consecutive slice. `intrinsic` passed the triage rule and was carried, but real Pylance never emits it
  (it sends `variable`+`builtin`; token type 18 has zero emission sites), so it was a dead legend entry
  AND a dead manifest rule — the exact defect this slice's own new test claimed to prevent. Dropped, and
  the test hole closed. (Learning #100: a legend is not a promise of emission.)
- Proven against **real Pylance**: `module@3:7`, `module@8:11`. 811 unit / 314 integration / 12 real-LSP;
  clean 43-file `.vsix`. Filed 3 new items (the modifier partial-override, `self`'s `.qmd`-vs-`.py`
  colour, the unpinned standard legend).

<!-- Add entries here as work is completed. Group by month when the list grows. -->

### 2026-07-14 · [BL-16] (Session 89 — **every language in your document is now semantically coloured, not just `{python}`.** Item 16 Slice 2 SHIPPED; only Slice 3 remains, so item 16 stays open.)

**A `.qmd` that mixes `{python}`, `{r}`, `{julia}` and `{ojs}` now gets each language coloured by that
language's own server** — all merged into one stream, correctly ordered, with each server's token names
and modifier bits translated out of its own legend and into ours.

- **`{ojs}` cells are coloured too, by VS Code's own built-in TypeScript/JavaScript service** — no extra
  extension to install. Proven end to end with **two real servers at once**: a document whose `{ojs}` cell
  sits between two `{python}` cells comes back correctly interleaved from real Pylance and the real
  built-in service.
- **Typing in your prose no longer rewrites a file on disk.** Previously every keystroke — anywhere in the
  document, including in a paragraph — rebuilt, rewrote and reopened a virtual document for *every*
  language in it, several times a second, and made the language server re-analyse from scratch each time.
  It now happens only when you change **code** (plan 🐉8; the backlog item is closed).
- A language whose server is missing, slow, or failing quietly drops out on its own; the other languages
  are unaffected, and its cells keep their normal colouring. If a server was merely still starting, we now
  ask VS Code to come back — it would not have on its own.
- Fixed along the way: a cell fenced ```` ```{constructor} ```` (or any other `Object.prototype` name)
  caused a copy of that cell's source to be written to `.quarto/vdoc-mit/…​.undefined` on every pass.

Slice 3 (theming — carrying a server's own token names, which is what recovers the 36% of Pylance's
tokens we currently leave to the static grammar) is the only part of item 16 still to come.

### 2026-07-13 · [BL-16] (Session 88 — **NEW: semantic highlighting for `{python}` cells, from your own language server.** Item 16 Slice 1 SHIPPED; Slices 2–3 remain, so item 16 stays open.)

**Your `{python}` cells are now coloured by Pylance, not just by a static grammar.**

Until now, code inside a Quarto cell was coloured only by TextMate rules — pattern matching, which
cannot tell a function from a variable that happens to look like one. VS Code supports a second,
semantic layer, driven by the language server you already have installed. This adds it.

- New `quarto` `DocumentSemanticTokensProvider` forwards the document to your Python server and
  translates its answer back into `.qmd` coordinates. Verified end to end against **real Pylance**
  (`npm run test:lsp`, with a control proving Pylance was alive), not a stand-in: `CONSTANT` comes back
  as `variable.declaration.readonly`, `main` as `function.declaration`, `getcwd` as `function` — each on
  its real cell-body line.
- **No Python extension installed → nothing changes.** Cells keep their TextMate colouring. Same for a
  document with no `{python}` cells (no vdoc is written and no language server is woken), a server that
  declines, a server that errors, and a workspace we cannot write to. The feature degrades; it never
  throws.
- **Known limit, measured rather than hidden:** we carry only the *standard* VS Code token types, so
  names specific to Pylance — `module` (`os`, `typing`), `selfParameter` (every `self`),
  `builtinConstant` (`True`/`None`), `magicFunction` (`__init__`) — are dropped and keep their TextMate
  colour. That is **13 of 36 tokens (36%)** on a representative file. Degraded, never *wrong*: a dropped
  token cannot be mis-coloured. Carrying them is a deliberate, separate decision (Slice 3).
- Scope: `{python}` only this slice. `{r}` / `{julia}` / `{ojs}` come with the multi-language merge
  (Slice 2).

Also fixed, found by the slice's adversarial review: a forward still in flight when you closed the
`.qmd` could strand a copy of your source in `.quarto/vdoc-mit/` for the rest of the session; a
"Compare with HEAD" diff of a `.qmd` would write your Python out to a temp directory and start a
language server on it; and a large prose-only `.qmd` rebuilt a full copy of itself on every keystroke
before discovering it had no Python in it.

### 2026-07-13 · [BL-18] (Session 87 — **FIXED: embedded-language features silently returned nothing from real language servers.** Item 18 CLOSED; item 16 unblocked.)

**If you write `{python}` cells, these features did not work, and there was no way to tell.**

Completion, hover, go-to-definition, signature help and in-cell outline symbols inside code cells all
returned **nothing** from a real language server — quietly, with no error and no warning, looking
exactly like "no language extension installed". This shipped in Phase 6e and has been broken ever
since.

**Cause.** Those features hand the target language's provider a *virtual document* containing the
cell's code. The vdoc used a custom URI scheme (`quarto-embedded:`), and real language servers
register their providers against a `documentSelector` scoped to the schemes they can read
(`file:`/`untitled:`/`vscode-notebook-cell:`). No provider was ever registered for our vdocs, so
every request correctly returned nothing. Measured against real Pylance, identical content and
position: **306 completions on a `file:` URI, 0 on ours**; in-cell symbols, 2 → 0. `{ojs}` was the
lone exception, because VS Code's *built-in* TS/JS provider happens to be scheme-agnostic.

**Fix.** The vdoc is now a real `file:` document under `<workspaceRoot>/.quarto/vdoc-mit/` (gitignored;
written per forward, deleted when the document closes, swept at activation). All three
`TextDocumentContentProvider` registrations are gone.

**A second, latent bug the fix exposed — Format Cell could destroy your document.** Once a real
formatter could finally answer, it did what formatters do: it trimmed the whitespace-only lines that
the vdoc uses to blank out everything around the cell. Those lines are the cell's *fences* in the real
document. The edit filter used `findCellAtPosition`, which is inclusive of fence lines, so it accepted
them:

    BEFORE  ```{ojs}\nx   =   1\n```
    AFTER   \nx = 1\n              <- both fences deleted; the cell is no longer a cell

Unreachable before this slice (no formatter ever answered), and invisible to the tests (the stand-in
only ever produced body-confined edits). Now filtered on body membership, and pinned by a test.

**Why no test caught any of this, and what changed.** Every stand-in provider was registered on
`{ scheme: <our custom scheme> }` — the *exact axis* real servers discriminate by — so the suite was
structurally incapable of detecting that no real server registers there. 754 unit and 287 integration
tests were green throughout. Adding more doubles could never have found it. This release therefore
also ships **`npm run test:lsp`**: a real-Pylance harness that exercises the forwards against an actual
language server, with a control in the same run proving the server was alive. It is local-only and
skips loudly (never silently) when Pylance is absent, because Pylance cannot be redistributed to CI.

`docs/POSIT-COMPARISON.md` claimed parity for these features throughout, and has been corrected.

A 21-agent adversarial review (8 lenses × 2 skeptics + a completeness critic) on the shipped slice
found and fixed a set of real issues at the root: two concurrent-mint disk leaks; a start-line-shift
vdoc that was stranded until document close; two "concurrency" integration tests that passed even with
the cell discriminator removed (the same test-double disease this fix is about); and a day-one
gitignore gap. It also surfaced — and the harness then confirmed empirically — that under the
**non-default** `python.analysis.diagnosticMode: "workspace"`, Pylance publishes diagnostics against
the vdoc files (zero under the default `openFilesOnly`); that is a hard problem of its own (deleting a
vdoc does not retract its diagnostics, and VS Code cannot force-close a background model) and is filed
as tracked follow-up rather than half-fixed.

767 unit / 300 integration / 10 real-LSP; clean 43-file `.vsix`.

### 2026-07-12 · [BL-16] (Session 86 — PLANNING: embedded-LSP vdoc scheme migration + semantic highlighting. **Plan written; item 16 stays open. A SHIPPED DEFECT was uncovered and filed as new BACKLOG item 18.**)

- **Deliverable:** `docs/planning/2026-07-12-embedded-lsp-scheme-and-semantic-tokens-plan.md` (v2). Plan only — implementation is a separate session per slice (FM #18).
- **The finding that reshaped the session:** item 16's premise was refuted by firsthand spike. Semantic tokens cannot ride this project's virtual-document architecture — **for any language, not even VS Code's built-in TS/JS** — because the vdocs use **custom URI schemes** and real language servers filter by scheme in their LSP `documentSelector`.
- **Collateral (the bigger news): three SHIPPED features are broken in production for `{python}`.** Embedded completion / hover / go-to-definition / signature-help (Phase 6e) and in-cell outline symbols return **NOTHING** from real Pylance. Proven with a passing control in the same Extension Development Host run (real `file:` `.py` → 306 completions / 1 hover / 2 symbols / 2 semantic tokens; our `quarto-embedded:` vdoc → **0 / 0 / 0 / none**), with visibility, timing, and content-freshness confounds all ruled out. `{ojs}` works only because VS Code's built-in TS/JS provider happens to be scheme-agnostic. **Filed as new BACKLOG item 18 (HIGH).**
- **Root cause of the miss:** every embedded test registers a stand-in provider on `{ scheme: <our-custom-scheme> }` — the exact axis real servers discriminate by — so a 100%-green suite was *structurally incapable* of detecting that no real server registers for that scheme. (Learning #94.)
- **Adversarial review of the draft plan** (138-agent `Workflow`: 7 refutation lenses × 2 independent skeptics + a completeness critic; ~8.1M subagent tokens): **65 candidates → 46 survivors**. Every load-bearing survivor re-verified firsthand by the author; the plan was **rewritten at the root** as v2. Three of the v1 draft's own claims were **wrong** and are corrected: the root-cause narrative, the Posit-location fact, and the cache-invalidation mechanism (the file watcher is **async** — measured ≈1017 ms stale window — so a write-then-request design would have highlighted one edit behind, silently).
- **No `src/` code written** (planning session). Working tree clean apart from the plan + close-out docs.

### 2026-07-12 · [BL-15] (Session 85 — `quarto.previewScript` Slice 2 SHIPPED: the Posit-parity gating layer. **BACKLOG item 15 is now CLOSED — both commands, both slices.**)

The `quartoRenderScriptActive` content-driven context key (`updateRenderScriptContext` in `src/features/preview.ts`, recomputed on active-editor change / document edit / at registration, mirroring `execution.ts`'s `updateCellContext`), plus the manifest gating it drives: the mutually-exclusive `ctrl+shift+k`/`cmd+shift+k` pair on **both** `quarto.preview` and `quarto.previewScript`, an `editor/title` entry, a palette gate, and three render-script activation events. A new `isPreviewableRenderScript` is the ONE predicate behind both the command gate and the key, so the two can never disagree.

Two deliberate, disclosed divergences from Posit, both grounded firsthand against the VS Code 1.128 build:

- **Keybinding scope (operator decision).** `ctrl+shift+k` is VS Code's built-in **Delete Line** (`editor.action.deleteLines`, `primary: 3113`, weight 100; an external extension's keybindings register at weight 400+ and win). Posit gates `quarto.preview` on a bare `!quartoRenderScriptActive`, which is true in essentially every editor — so mirroring it would hijack Delete Line in every file type. Ours is scoped `editorLangId == quarto && !quartoRenderScriptActive`; mutual exclusion is preserved and Delete Line survives outside Quarto documents.
- **Palette gate.** Gated on `resourceExtname`, not on the context key — see below.

A 34-agent adversarial-review `Workflow` (6 lenses × 2 skeptics) on the all-green slice found **3 real defects, all fixed at the root**: (1) **HIGH** — gating the *palette* entry on `quartoRenderScriptActive` made the command **unreachable** for a lone `.py`/`.jl` script (the key is only settable post-activation, and VS Code does not activate an extension to evaluate a `when` clause), a regression the plan's own text simultaneously prescribed and denied; (2) `doc.getText()` was materialized on every keystroke for every document before the cheap extension check could reject it (measured: 9.5 ms per keypress on a 10 MB file) — a new pure `isRenderScriptExtension` now runs first; (3) `workspaceContains:**/*.{qmd,rmd}` is case-sensitive and never matched `.Rmd`, one of this extension's own registered Quarto extensions.

754 unit / 287 integration; `check-types` clean; clean 43-file `.vsix`.

### 2026-07-12 · [BL-15] (Session 84 — `quarto.previewScript` Slice 1 SHIPPED: the Preview Script command; item 15 stays open — Slice 2 Posit-parity gating is a separate future session)

Added **`Quarto: Preview Script...`** — preview a standalone Quarto *render script*, executing `docs/planning/2026-07-12-preview-script-plan.md` §6 Slice 1. New pure `src/core/render-script.ts` `isRenderScript` recognizes **both** render-script kinds (jupyter-percent `.py`/`.jl`/`.r`; knitr-spin `.r`), keyed on the file extension as Quarto's own detector is; `previewActiveScript` in `src/features/preview.ts` gates on it and reuses `PreviewManager.openPreview` unchanged; `package.json` gains the command. Deliberate, operator-confirmed divergence from the CLI's **buggy** percent regex (its unanchored `raw]` branch makes Quarto treat ordinary code containing `data[raw]` as a render script — confirmed firsthand: it boots a python kernel for such a file); ours adds the missing group and refuses it. Strict TDD; the accept path is a **real kernel-free** `quarto preview` round-trip via a knitr `spin.R` fixture. A 21-agent adversarial review found 6 surviving defects in the all-green slice; the 4 in-slice ones were fixed at the root — most notably a **quadratic-backtracking ReDoS** in the spin regex (3.7 s of blocked extension host on an unclosed header + long whitespace run) that also falsified the plan's "cheap on every keystroke" premise for Slice 2. 741 unit / 283 integration; clean 43-file `.vsix`. Also filed a **pre-existing** preview-lifecycle bug (a `git:` diff close reaps a live preview) to Polish/deferred, operator-confirmed as out of this slice's contract.

### 2026-07-12 · [BL-15] (Session 83 — `quarto.previewScript` PLANNING; plan written, item 15 stays open — implementation is a separate future session)
Wrote `docs/planning/2026-07-12-preview-script-plan.md` for BACKLOG item 15's second half, `quarto.previewScript` (preview a standalone `.py`/`.jl`/`.r` Quarto render script). **PLAN ONLY** — no implementation code; item 15 stays open (`previewScript` PLANNED, not shipped). Firsthand-grounded against Quarto 1.7.33 (the MIT CLI `quarto.js`) + Posit's public manifest (`gh api`, clean-room) + the codebase, then adversarially verified by a 14-agent `Workflow` (5 refutation lenses × per-finding skeptic, ~687K subagent tokens) that found **8 confirmed defects in the first draft** — all corrected and re-verified firsthand. **Two material corrections to Session 82's premise (Learning #90's "scan for `# %%`"):** (1) there are **two** render-script kinds, not one — Jupyter percent scripts (`# %% [markdown]`/`[raw]` cell → jupyter engine; `isJupyterPercentScript` quarto.js:37362) AND **knitr *spin*** scripts (`.r`/`.R` with a `#' ---`…`#' ---` roxygen header → the knitr engine, NO jupyter kernel; `isKnitrSpinScript` quarto.js:28691); (2) the CLI's percent-detection regex is buggy (unanchored `raw]` alternation matches ordinary code). The plan specifies a pure `src/core/render-script.ts` `isRenderScript` detector (both paths, extension-keyed), reuse of `PreviewManager.openPreview` unchanged, a Shape A (command-only) vs Shape B (Posit-parity context-key + keybinding + activation) scope decision, a knitr `spin.R` kernel-free accept-path test fixture, per-phase completion criteria, and 4 open questions for the implementation kickoff. Learning #91 appended.

### 2026-07-12 · [BL-15] (Session 82 — `quarto.previewFormat` per-format preview QuickPick, item 15 half — `previewScript` deferred)
New `quarto.previewFormat` ("Preview Format…") command: enumerate a document's declared output formats from its front-matter `format:` block (`src/core/preview-format.ts` `parseDeclaredFormats`, reusing the shared `frontMatterContentLines` scanner), offer them in a QuickPick (or Quarto's implicit `html` default), and preview the chosen one via `quarto preview <file> --no-browser --to <fmt>` (`buildPreviewArgs`, sibling of `buildRenderArgs`). `PreviewManager.openPreview` gained a `{to}` option (same-format reveal / different-format restart). Strict TDD. A 21-agent adversarial review of the all-green slice caught + fixed 6 real defects at the root (a HIGH session-identity restart race, the untested restart branch, a flow-collection garbage-`--to`-token bug, an untested `["html"]` fallback, a weak gate-d discriminator, a LOW startup-window drop). `previewScript` deferred to its own future session — research found it needs new content-driven context-key infrastructure the BACKLOG's "moderate scope" understated (Learning #90). 726 unit (+18) / 281 integration (+5); `check-types` clean; clean 43-file `.vsix`.

### 2026-07-12 · [BL-14] (Session 81 — _quarto.yml filepath completion, item 14 Slice 2 of 2, SHIPPED — item 14 now fully complete)
- New pure `src/core/project-links.ts` `valueContextAt(text, line, col)` — a cursor-position value-slot detector returning `{token, replaceRange}` or `null`. Handles the same three shapes as Slice 1's `findPathValueCandidates` (`key: value`, `- value`, `- key: value` inline mappings), reusing `mappingColonIndex` + `valueSlotAfterColon` so the detector and the scanner never disagree on where a value begins.
- New `src/providers/filepath-completion.ts` `registerFilepathCompletionFeature` — a `CompletionItemProvider` on the SAME pattern-based `DocumentSelector` (`{pattern:"**/_quarto.{yml,yaml}"}`) as the link provider (triggers `:`/`-`/`/`, no events/debounce). `valueContextAt → null → undefined` inverse-gates it to value slots; the value-so-far is split at the last `/`, the prefix `path.resolve`d against `path.dirname(document.fileName)` and `vscode.workspace.fs.readDirectory`d, and each entry mapped to a `CompletionItemKind.File`/`Folder` item (folders suffixed `/`, label shows the entry name while insert/filter text carry the typed directory prefix, a leading space prepended when the slot abuts the colon). No schema query — the offered items are exactly what is on disk (plan §0/§2.1). Wired in `extension.ts`.
- A 7-agent adversarial-review `Workflow` on the SHIPPED slice (5 finder lenses × 2-skeptic refutation; 4 lenses clean) confirmed one real defect: `valueContextAt` lacked the upper bound its sibling `frontMatterContextAt` enforces (`col <= slot.endCol`), so a cursor PAST the value token (in a trailing inline comment, e.g. `chapters: intro.qmd  # note`) returned a context that would overrun the comment on accept. Fixed at the root (`col > slot.endCol → null`) — core correctness should not rely on VS Code's downstream fuzzy filter (Learning #89).
- Strict TDD throughout (RED confirmed for the right reason at core + integration for each behavior, plus the review-driven fix). New `test/fixtures/filepath-completion/` (a `_quarto.yml` + `refs.bib`/`intro.qmd` + `chapters/{part1,part2}.qmd`). 708 unit (+13) / 276 integration (+5); `npm run check-types` clean; clean 43-file `.vsix` (unchanged count — provider bundles into `dist/`, fixtures are test-only). `BACKLOG.md` item 14 marked `[x]` (both slices shipped); `docs/POSIT-COMPARISON.md` document-links row + At-a-Glance table updated to full parity (Real gaps 11→10, Parity 20→21); `PROJECT_LEARNINGS.md` Learning #89 appended.

### 2026-07-12 · [BL-14] (Session 80 — _quarto.yml document links, item 14 Slice 1 of 2, SHIPPED)
- New pure `src/core/project-links.ts` `findPathValueCandidates` — a whole-document scanner emitting every `key: value` scalar, `- value` sequence scalar, and `- key: value` inline-mapping value token (span + unquoted text) at any depth, skipping blank/comment/container lines and boolean literals. Reuses `yaml-context.ts`'s now-exported `valueSlotAfterColon` grammar, anchored at the YAML mapping colon via a new `mappingColonIndex` (first `:` followed by whitespace/EOL).
- New `src/providers/document-links.ts` `registerQuartoYamlDocumentLinksFeature` — an existence-checked `vscode.DocumentLinkProvider` on a pattern-based `DocumentSelector` (`{pattern:"**/_quarto.{yml,yaml}"}`, no events/debounce/generation-counter — plan §2.3). Each candidate is `path.resolve`d against the config file's own dir and `fs.stat`ed (`Promise.allSettled`); only values that resolve to a real file/directory become links. Glob (`*`) candidates excluded; directories link too (Q4). Wired in `extension.ts`. **Whole-document scope**, not `project:`/`website:`/`book:`-only (plan §0; gate-d integration discriminator: a root-level `bibliography: refs.bib` links).
- **A 24-agent adversarial-review `Workflow` caught the dominant real-world path shape being silently unlinked** — inline-mapping sequence items `- href: page.qmd` / `- part: intro.qmd` (website navbar/sidebar, book chapters), which the plan's §2.5 example (bare scalars only) had led the first impl to miss. Fixed via `mappingColonIndex` (RED→GREEN); also fixed a low-severity colon-in-quoted-key case for free. Flow collections (`[a, b]`) and a pathological quoted key with `": "` inside are deferred as fail-safe, documented limitations (Polish/deferred; `PROJECT_LEARNINGS.md` #88).
- Strict TDD (RED confirmed at core + integration layers). `npm test` 695/695 unit (+13); `npm run test:integration` 271/271 (+9); `npm run check-types` clean; clean 43-file `.vsix` (unchanged count — provider bundles into `dist/extension.js`, fixtures are test-only). Slice 2 (filepath `CompletionItemProvider`) remains a separate future session. `PROJECT_LEARNINGS.md` Learning #88 appended (87→88).

### 2026-07-11 · [ad hoc] (Session 80 — operator-requested Claude Code config)
- Created a committed project `.claude/settings.json` pinning this repository's default Claude Code model to `claude-opus-4-8` (Opus 4.8). The personal `.claude/settings.local.json` remains gitignored (unchanged).

### 2026-07-11 · [BL-14] (Session 79 — _quarto.yml document links + filepath autocompletion, BACKLOG item 14, PLANNING SESSION — plan written, not implemented)
- Wrote `docs/planning/2026-07-11-quarto-yml-document-links-plan.md` via a 6-agent research + adversarial-verification `Workflow`. **Headline finding: item 14's own BACKLOG text ("reuses existing `core/project-yaml.ts`/`core/yaml-context.ts` infrastructure") is wrong** — that infrastructure covers only 15 of 50 empirically-confirmed path-typed fields in the installed Quarto schema (`project:`/`website:`/`book:` only); the other 35 (`bibliography`, `csl`, `css`, `template`, `include-in-header`, etc.) live in the general document front-matter schema. Independently, Posit's own shipped PR #906 (grounded via public-only facts — PR description/CHANGELOG/discussion, never their AGPL source) is confirmed to be a non-schema-driven, whole-document, existence-checked heuristic.
- **Scope lock, operator-confirmed via a mid-planning `AskUserQuestion`:** build the same whole-document, existence-checked heuristic. Plan recommends two vertical-slice sessions (`DocumentLinkProvider`; filepath `CompletionItemProvider`), sharing one new pure-core module (`src/core/project-links.ts`). Also found unlike `yaml-diagnostics.ts`, this feature can use a simpler pattern-based `DocumentSelector`, avoiding the diagnostics feature's event/debounce/generation-counter machinery.
- `BACKLOG.md` item 14 updated to `PLANNED Session 79` with the plan-doc pointer (stays open — implementation is a separate future session). `PROJECT_LEARNINGS.md` Learning #87 appended (86→87).

### 2026-07-11 · [BL-13] (Session 78 — cell navigation + cache-clearing commands + quarto.runCurrent, BACKLOG items 13(d)/13(e), SHIPPED — all 5 sub-items of item 13 now shipped)
- **Item 13(d):** `quarto.goToNextCell`/`quarto.goToPreviousCell` (`src/features/execution.ts`) — pure cursor-navigation siblings of the existing `runNextCell`/`runPreviousCell`, no delegate dispatch, keybound `Ctrl+PageDown`/`Ctrl+PageUp` (`Cmd+` on macOS) matching Posit's own manifest. `quarto.clearCache` (`src/features/clear-cache.ts`, new) spawns `quarto render <file> --cache-refresh` (confirmed against the installed Quarto CLI's own `--help` and quarto.org's code-execution docs), editor-title-menu placed. Discovered `--cache-refresh` creates a `<doc>_cache/` directory as a real side effect — gitignored and cleaned up in the new integration test.
- **Item 13(e):** `quarto.runCurrent` ("Run Current Code") registers the same selection-or-current-line handler as the existing `runSelectedLines`, keybound `Ctrl+Alt+C`/`Cmd+Alt+C` — **not** Posit's own `Ctrl+Enter`, which this project's pre-existing `quarto.runCell` already claims (a disclosed keybinding-scheme divergence discovered this session; see `PROJECT_LEARNINGS.md` Learning #86). Posit's own manifest (fetched directly, facts only, never their implementation source) confirms `runCurrent` is genuinely distinct from `runSelection`, but the exact internal behavior is unverifiable without reading their AGPL source — implemented as a disclosed, defensible judgment call.
- Both items TDD-gated (not declarative-exempt): RED confirmed for the right reason at each layer (`buildCacheRefreshArgs` missing; `command not found` for all 3 new commands) → GREEN. Also corrected pre-existing staleness in `docs/POSIT-COMPARISON.md`'s Format Cell row (still said "Not implemented" despite shipping Session 75, found while updating this same document for this session's own item 13(d)/(e) closures). `npm run check-types` clean; `npm test` 682/682 (+2); `npm run test:integration` 262/262 (+13); clean 43-file `.vsix`, unchanged file count.

### 2026-07-11 · [BL-13] (Session 77 — standalone dot/mermaid/typst registration + list-table/fragment snippets, BACKLOG items 13(b)/13(c), SHIPPED)
- **Item 13(b):** registered `dot` (`.dot`/`.gv`), `mermaid` (`.mmd`), and `typst` (`.typ`) as standalone, first-class VS Code languages — new `contributes.languages` entries + a dedicated `languages/<id>-language-configuration.json` each (comments, brackets, auto-closing/surrounding pairs), independent of the embedded-grammar scopes item 13(a) added inside `.qmd` code cells. Registration + config only (no TextMate grammar), grounded via `WebSearch`/`WebFetch` against each language's own official docs. Corrected a factual error carried in `docs/POSIT-COMPARISON.md`/`BACKLOG.md`: Typst source files use `.typ`, not `.typst` (confirmed against the installed Quarto CLI's own bundled `.typ` templates — `PROJECT_LEARNINGS.md` Learning #85).
- **Item 13(c):** added the 2 residual snippets — `qlisttable` (Quarto 1.9's `::: {.list-table}` bullet-based table syntax) and `qfragment` (reveal.js `::: {.fragment}` incremental slide reveal) — grounded against Quarto's own public docs, not Posit's AGPL extension.
- Declarative, TDD-exempt per `CLAUDE.md`'s carve-out; proved genuine RED → GREEN via a new `test/unit/standalone-languages.test.ts` manifest-shape suite, then strengthened with real-EDH runtime proof: 3 new `language.test.ts` cases (extension-based language detection against real on-disk fixtures) + 2 new `snippets.test.ts` cases (`vscode.executeCompletionItemProvider` firing). `npm run check-types` clean; `npm test` 680/680 (+22); `npm run test:integration` 249/249 (+5); clean 43-file `.vsix` (+3).
- Also corrected pre-existing staleness found in `docs/POSIT-COMPARISON.md`'s "At a Glance" summary table while updating it for this item: "outline granularity" (Sessions 71–74) and "Format Cell" (Session 75) were still listed as open real gaps despite being fully shipped — moved to Parity, gap count corrected 14 → 12.

### 2026-07-11 · [BL-13] (Session 76 — embedded-grammar breadth, BACKLOG item 13(a), SHIPPED)
- Expanded `syntaxes/quarto.tmLanguage.json`'s cell-language repository + `package.json`'s `embeddedLanguages` map from 5 to 20 scopes: added `bash`/`c`/`cpp`/`csharp`/`fsharp`/`rust`/`go`/`sql`/`lua`/`ruby`/`php`/`perl`/`java`/`dockerfile`/`powershell`. Each engine token/languageId/TextMate scope (e.g. `source.shell`, `source.cs`) confirmed directly against this repo's own bundled `.vscode-test` VS Code install's built-in extensions (`PROJECT_LEARNINGS.md` Learning #84) — zero guessing, zero copying from Posit's manifest.
- TDD: proved the mechanism fully vertical for `bash` (genuine RED — missing repository rule/scope mapping — then GREEN) via the project's existing headless-tokenization harness (`vscode-textmate`/`vscode-oniguruma`); the remaining 14 (mechanically identical, and — per `CLAUDE.md`'s own carve-out — pure grammar JSON is TDD-exempt) added as one disclosed batch, RED → GREEN, in new `test/unit/grammar-embedded-breadth.test.ts` (small inline fixtures, not the shared `test/fixtures/sample.qmd`, to avoid any cross-suite blast radius).
- Deliberately excluded: `dot`/`mermaid`/`typst` (a separate registration mechanism — item 13(b)) and Stan/PRQL/Scala/others from Posit's undisclosed "and more" (no confirmed VS-Code-bundled scope). `npm run check-types` clean; `npm test` 658/658 (+15, zero regressions); `npm run test:integration` 244/244 unchanged (grammar/manifest-only change); clean 40-file `.vsix`, unchanged file count.

### 2026-07-11 · [BL-12] (Session 75 — Format Cell, `quarto.formatCell`, SHIPPED)
- New `quarto.formatCell` command delegates a code cell's body to its embedded language's own installed formatter (Black/autopep8 for Python, `styler` for R, etc.), via the same per-cell virtual-document forwarding recipe as item 11 slice 2's in-cell symbol forwarding. `buildCellVirtualContent` already blanks the cell's own `#|`/`//|` option lines and every other cell, so the forwarded formatter can never reflow a directive or another cell's body — Posit's own headline requirement for this feature falls out of reuse, not new logic.
- No new `core/` logic; TDD ran entirely at the integration layer via a scheme-keyed stand-in `DocumentFormattingEditProvider` (RED: 10/10 new tests failed on "command not found" → GREEN). Includes an out-of-cell edit filter (defense-in-depth, mirroring `embedded.ts`'s `filterOutOfCellEdits`) and an empirical staleness check confirming `executeFormatDocumentProvider` does not share `executeDocumentSymbolProvider`'s per-URI result-cache quirk (`PROJECT_LEARNINGS.md` Learning #83) — the simple reused-URI vdoc store sufficed.
- Ships with a `Ctrl+K Ctrl+F`/`Cmd+K Cmd+F` keybinding matching Posit's, gated on the existing `quarto.inCodeCell` context key. `npm run check-types` clean; `npm test` 643/643 unit, unchanged; `npm run test:integration` 244/244 (+10); clean 40-file `.vsix`, unchanged file count.

### 2026-07-11 · [ad hoc] (Session 75 — codified automatic AskUserQuestion candidate-presentation at Phase 0)
- Added an "Additional Phase 0 steps" override to `CLAUDE.md` (was `(none)`): whenever `BACKLOG.md`'s "Active" section is empty at Phase 0, present the ranked open candidates via `AskUserQuestion` immediately after the orientation report, rather than a bare stop-and-wait or free-form prose. Formalizes a pattern already used ad hoc in Sessions 71/73/74. No `src/`/`test/` files touched — pure process documentation, TDD-exempt.
- Confirmed all items surfaced by Session 67's refreshed ("2nd") Posit gap analysis remain accounted for in `BACKLOG.md`: items 12–17 (Up Next, ranked) and item 11's two deferred sub-items (Polish/deferred) are all present; nothing missing.

### 2026-07-11 · [BL-11] (Session 74 — outline in-cell code symbol forwarding, pixel-level F5 visual confirmation, `BACKLOG.md` item 11 slice 2, SHIPPED)
- **Verification-only, no code changes.** Closed the gap Session 73 disclosed: a pixel-level F5 visual pass proving in-cell code symbol forwarding actually renders real nested symbols in the live Outline panel, not just at the command/API layer.
- A scratch `{ojs}` fixture (a `computeSum` function + a `total` variable — `{ojs}` maps to `javascript`, served by VS Code's built-in TS/JS language service with no extra extension needed) was opened in an isolated, `--disable-extensions` Extension Development Host. The resulting screenshot shows the `{ojs}` cell node recursively expanded into `computeSum` (with its own nested `data.reduce() callback` child, proving the language service's real recursive symbol tree forwarded through) and `total`. Both slices of item 11 are now fully verified at both the command/API and pixel layers; `BACKLOG.md` item 11 checked off.
- **Mid-session near-miss, fully disclosed and corrected:** a bundle-ID collision between the isolated EDH and the operator's own real, already-running VS Code (same `com.microsoft.VSCode` identifier) caused GUI-automation targeting confusion; separately, this VS Code build's Copilot welcome dialog default-focuses "Continue with GitHub," and a scripted `Return` keypress meant to dismiss it instead opened a real GitHub OAuth authorization page. No authorization was granted (verified and closed immediately). Recorded as a new `feedback`-type memory (`confirm-before-screen-prompting-actions`) — screen-affecting actions now require the operator's explicit pre-approval, not after-the-fact disclosure. The operator ultimately ran the isolated-EDH launch by hand and captured the screenshot themselves.
- `npm run check-types` clean; `npm test` 643/643 unit, unchanged (no logic touched).

### 2026-07-11 · [BL-11] (Session 73 — outline in-cell code symbol forwarding, `BACKLOG.md` item 11 slice 2, SHIPPED)
- **Implemented** `BACKLOG.md` item 11 slice 2 (in-cell code symbol forwarding), executing Session 70's plan (`docs/planning/2026-07-10-outline-granularity-plan.md` §2.3/§5/§6) — the natural continuation of Sessions 71–72's shipped, fully-verified slice 1 toggle. Each mapped-language cell's body now forwards into its own `DocumentSymbolProvider` and splices the result in as that cell's outline children.
- New pure `buildCellVirtualContent(text, cell)` (`src/core/embedded/virtual-doc.ts`) isolates exactly ONE cell's body — distinct from the existing `buildVirtualContent(text, languageId)`, which keeps every cell of a language (correct for cursor-position forwarding; would merge two same-language cells' symbols into one list here). New adapter-layer `InCellSymbolStore` (`src/providers/outline.ts`, its own `quarto-outline-symbols` scheme) mints a version-stamped vdoc URI on every outline computation and evicts the previous version per cell, defeating `executeDocumentSymbolProvider`'s per-URI cache (plan §2.3/Learning #78) — proven via a real-EDH test that edits a cell between two computations.
- TDD throughout (RED confirmed for the right reason at each layer): 5 new vitest unit tests for the pure per-cell content builder, then 6 new real `@vscode/test-electron` integration tests (a scheme-keyed stand-in `DocumentSymbolProvider`, mirroring `embedded.test.ts`'s own pattern) for the adapter. One test's first draft was itself wrong — calling `executeDocumentSymbolProvider` twice with no intervening edit does not re-invoke the provider a second time — corrected mid-session and recorded as `PROJECT_LEARNINGS.md` Learning #81.
- No `package.json` changes needed. 643 unit (+5) / 234 integration (+6) passing; `npm run check-types` clean; clean 40-file `.vsix` (unchanged file count). **Disclosed, not performed:** a pixel-level F5 visual pass with a real language extension — the real-EDH integration suite is this session's Phase 3E bar (Learning #3), matching slice 1's own precedent (pixel verification followed as a separate session, Session 72, once wanted).

### 2026-07-11 · [BL-11] (Session 72 — outline toggle pixel-level F5 visual verification, `BACKLOG.md` item 11 slice 1, SHIPPED)
- **Completed** the pixel-level F5 visual verification for `BACKLOG.md` item 11 slice 1 (outline show/hide-cells toggle) — the first `BACKLOG.md` "Active" item, filed by Session 71 and blocked there on an iTerm2 restart to activate a newly-granted macOS Screen Recording permission. Verification-only; no `src/`/`test/` files touched.
- Relaunched the isolated Extension Development Host exactly per Session 71's own documented command. `screencapture` itself now worked, but scripting actual clicks/keystrokes into the EDH hit two further, silent obstacles Session 71 never reached: the custom `.vscode-test` process isn't enumerable via `System Events` even with Accessibility granted (fixed by activating via its exact POSIX `.app` bundle path, not process name), and frontmost focus silently reverts to iTerm2 between separate Bash tool invocations (fixed by chaining activate+interact+screenshot into one shell call per step). `PROJECT_LEARNINGS.md` Learning #80 appended.
- Captured 3 real screenshots proving the live round-trip: Outline panel's `{python}`/`{r}`/`{julia}`/`{ojs}` cell nodes present by default, absent (no expand chevron) after running **Quarto: Toggle Code Cells in Outline** once, and present again (chevron restored) after running it a second time.
- `BACKLOG.md` item 11 updated to record slice 1 as verified at both the command/API layer (Session 71) and the pixel layer (this session); the "Active" section returned to empty.
- `npm run check-types` clean; `npm test` 638/638 unit, unchanged (no logic touched).

### 2026-07-11 · [BL-11] (Session 71 — outline show/hide-cells toggle, `BACKLOG.md` item 11 slice 1, SHIPPED)
- **Shipped** `BACKLOG.md` item 11 slice 1 (outline show/hide-cells toggle infrastructure), executing Session 70's plan (`docs/planning/2026-07-10-outline-granularity-plan.md` §6), following `docs/methodology/workstreams/DEVELOPMENT_WORKSTREAM.md` with this project's strict TDD gate. New `quarto.symbols.showCodeCellsInOutline` setting (default `true`) + `quarto.toggleCodeCellsInOutline` command gate the outline's already-existing flat cell nodes; in-cell symbol forwarding (slice 2) is a separate, not-yet-started future session per the operator's own decision.
- Operator resolved the plan's 4 open questions (§9) via `AskUserQuestion` before any code: split the slices (Q1), defer the R2 empirical spike (Q2), defer sub-feature (c) as its own unranked `BACKLOG.md` Polish/deferred item (Q3), ship without the R3 cosmetic re-expand-on-toggle fix, filed as its own unranked Polish/deferred item (Q4).
- **Stronger empirical finding than the plan anticipated:** `vscode.executeDocumentSymbolProvider`'s per-URI caching (Session 70, Learning #77) also stales a REAL on-disk document across a config-only change, not just a virtual document — discovered when this slice's own integration test failed unexpectedly (`4 !== 0`) against a real, previously-queried fixture. Fixed with the dispose-and-re-register live-refresh pattern the plan had already sketched (§2.4) for a different reason (UI polish) — proven load-bearing for basic command-API correctness instead. `PROJECT_LEARNINGS.md` Learning #78 appended.
- TDD throughout: `hideCellsInOutline` (pure recursive filter, `core/qmd/model.ts`) unit-tested RED→GREEN first (vitest), then the `src/providers/outline.ts` adapter (live config read, dispose/re-register, the toggle command) integration-tested RED→GREEN against a real Extension Development Host (`test/integration/suite/outline.test.ts`).
- Attempted a scripted F5-equivalent visual pass via the `verify` skill; blocked at the final `screencapture` call by a macOS Screen Recording (TCC) permission this sandboxed shell lacked. `PROJECT_LEARNINGS.md` Learning #79 appended (the permission gap plus a `--user-data-dir` unix-socket-path-length gotcha found along the way). Operator granted iTerm2 Screen Recording permission mid-close-out, but it needs an iTerm2 restart to take effect (ending this session) — the retry is filed as the first `BACKLOG.md` "Active" item with exact relaunch commands.
- `npm run check-types` clean; `npm test` 638/638 unit (+4); `npm run test:integration` 228/228 (+2, both new toggle tests).

### 2026-07-10 · [ad hoc] (Session 70 — outline granularity plan, `BACKLOG.md` item 11, PLANNED not shipped)
- **Planned** `BACKLOG.md` item 11 (outline granularity — in-cell code symbols + a show/hide toggle) — `docs/planning/2026-07-10-outline-granularity-plan.md`, following `docs/methodology/workstreams/ARCHITECTURE_WORKSTREAM.md`. Unlike item 10, no push/pull architectural wall exists — the feature reuses this project's existing pull-forwarding pattern (`src/providers/embedded.ts`'s pure `core/embedded/` helpers, unchanged).
- Two interface gotchas found via 3 parallel background research forks plus 6 firsthand scratch Extension Development Host tests (written/run/deleted, never committed): (1) `vscode.DocumentSymbolProvider` has no refresh event — a live toggle needs a dispose-and-re-register pattern (confirmed via VS Code core's own notebook outline and Posit's own PR #974 review history, AGPL source never read); (2) `vscode.executeDocumentSymbolProvider` caches per-URI internally — empirically proven firsthand and independently corroborated by a 2025 VS Code GitHub comment — so in-cell symbol forwarding needs a new, version-varying vdoc URI store, not the existing `VirtualDocStore`'s stable-key convention.
- `BACKLOG.md` item 11 annotated PLANNED. `PROJECT_LEARNINGS.md` Learning #77 appended (also fixed a pre-existing rows-75/76 physical-ordering swap in the same edit).
- Documentation-only — no `src/`/`test/` files retained, TDD-exempt per `CLAUDE.md`'s declarative-content carve-out. `npm run check-types` clean; `npm test` 634/634 unit, unchanged.

### 2026-07-10 · [ad hoc] (Session 69 — closed `BACKLOG.md` item 10 under Option A, code-cell diagnostics forwarding)
- **Closed** `BACKLOG.md` item 10 (code-cell diagnostics forwarding) as investigated, not pursued, executing Session 68's plan's own deferred decision (`docs/planning/2026-07-10-code-cell-diagnostics-plan.md` §9 Q1). Operator resolved both of the plan's remaining open questions via `AskUserQuestion`: **Q1 = Option A** — accept code-cell diagnostics forwarding as a permanent, documented architectural gap (parity treatment with the excluded Visual Editor), rather than Option B's heavier self-spawned-LSP-client architecture; **Q4 = yes** — file the Problems-panel-leakage audit of the existing `src/providers/embedded.ts` forwarding vdocs as a new, unranked `BACKLOG.md` Polish/deferred candidate.
- **`docs/POSIT-COMPARISON.md` corrected**: the "Code-cell language embedding" row's Notes, the At-a-Glance "Real gaps" annotation, and the "Session 67 refresh" priority-order list's item 1 (which still carried the disproven "builds on the existing forwarding infrastructure" framing) all updated to reflect the investigated, permanently-accepted-gap status, with a pointer to the plan's full evidence trail.
- Documentation-only — no `src/`/`test/` files touched, TDD-exempt per `CLAUDE.md`'s declarative-content carve-out. `npm run check-types` clean; `npm test` unchanged (no logic touched).

### 2026-07-10 · [ad hoc] (Session 68 — code-cell diagnostics forwarding plan, `BACKLOG.md` item 10, PLANNED not shipped)
- **Planned** `BACKLOG.md` item 10 (code-cell diagnostics forwarding — embedded-LSP diagnostics, e.g. Pylance/Ruff squiggly underlines, inside `.qmd` code cells) — `docs/planning/2026-07-10-code-cell-diagnostics-plan.md`, following `docs/methodology/workstreams/ARCHITECTURE_WORKSTREAM.md`. Operator picked "Item 10" directly.
- **Headline finding**: the item's own original framing ("a new forwarding kind on the existing `src/providers/embedded.ts` architecture") was empirically wrong — that architecture is pull-based (`vscode.executeXxxProvider`) and VS Code's own docs state directly that request-forwarding does not serve diagnostics (push-based only). Confirmed three independent ways: VS Code's own official Extension API docs; 5 firsthand scratch Extension Development Host integration tests (written, run, deleted, never committed) showing this project's existing vdoc pattern gets zero diagnostics unless the document is a genuinely visible, ACTIVE editor tab — incompatible with the user editing their real `.qmd` tab; and Posit's own public PR prose (`quarto-dev/quarto` #980/#1013, description text only, never their AGPL source), which independently confirms they solved this by abandoning delegation to the user's installed extension for a much heavier self-spawned-language-server architecture.
- **Decision left to the operator, not resolved this session**: the plan presents Option A (accept the gap as permanent, parity with the excluded Visual Editor) vs. Option B (build Posit's heavier architecture for Python first, 3 license-verified MIT server candidates: Pyright, Ruff, Pyrefly), with a stated lean toward A. `BACKLOG.md` item 10 annotated PLANNED with the corrected framing. `PROJECT_LEARNINGS.md` Learning #75 appended.

### 2026-07-10 · [ad hoc] (Session 67 — refreshed Posit gap analysis, `docs/POSIT-COMPARISON.md`)
- **Refreshed** `docs/POSIT-COMPARISON.md` against Posit's *current* official Quarto VS Code extension — last comprehensively re-swept at Session 42 (spot-corrected through Session 65), citing a version ceiling of v1.132.0; Posit had since shipped 3 more releases (v1.133.0–v1.135.0, with v1.136.0 open/unreleased). Operator chose this over re-prioritizing `BACKLOG.md`'s remaining 16 Polish/deferred items, per an argument recorded in `SESSION_NOTES.md` (the Polish/deferred list had no new information to re-rank by; the comparison doc had a real "unknown unknowns" blind spot).
- **Methodology**: an exhaustive structural diff of Posit's current manifest (every `contributes.commands`/`configuration`/`languages`/`menus` entry, not just previously-covered categories) + a changelog diff since v1.132.0 + a docs/marketplace prose scan + a repo-only re-check of our own current source, run via a background `Workflow` (4 parallel recon agents → 1 synthesis/diff agent → 3 independent adversarial refuters per candidate finding, mirroring this doc's own original Session 42 refute-check methodology). 28 candidate findings; 18 survived unverified, 10 were refuted-with-correction (the refuter caught a real inaccuracy in the claim's own framing — e.g. an undercounted command family, a stale "moved to the Activity Bar" claim reverted 9 days later in 2022 — while the underlying finding remained genuine).
- **Result**: 8 new rows added (Format Cell, cell navigation/cache commands, Reticulate execution, `_quarto.yml` document links/filepath completion, standalone `.dot`/`.mmd`/`.typst` language registration, cell-background highlighting, preview-command-family breadth, and a "Soft comparison"-bucketed extensibility-surfaces row) — total 39 rows (31 original + 8 new). 3 existing rows had their headline verdict revised (syntax highlighting and code-cell language embedding: Parity → Real gap; outline/symbols: Parity → Real gap). The single largest incremental (non-Visual-Editor) gap found: Posit forwards embedded-language-server diagnostics (squiggly underlines) directly into `.qmd` code cells since v1.133.0; this project has none. Also fixed a pre-existing arithmetic drift (the At a Glance table's bucket counts summed to 28 against a claimed 31 rows) by adding a 5th "Soft / ambiguous comparison" bucket and resolving the 3 previously-unbucketed rows into it.
- Added `BACKLOG.md` items 10–17 (ranked, feeding from the refresh's priority order) under the existing "Post-Posit-comparison feature roadmap" item; none implemented this session (audit/research deliverable only, per `SESSION_RUNNER.md`'s planning-vs-implementation boundary). `PROJECT_LEARNINGS.md` Learning #74 appended, generalizing the "manifest-diff catches unknown-unknowns; read the refuter's corrected claim, not just its refuted boolean" methodology lesson.
- Documentation-only session — no `src/` or `test/` files touched; TDD gate N/A per `CLAUDE.md`'s declarative-content carve-out. `npm run check-types` clean; `npm test` 634/634 unit passing, unchanged (regression check for a docs-only change, this project's established convention).

### 2026-07-10 · [ad hoc] (Session 66 — setext heading support in the outline, `BACKLOG.md` Polish/deferred item, SHIPPED)
- **Shipped** setext heading recognition in `core/qmd/model.ts` — a single-line paragraph underlined with `=`/`-` is now recognized as a level-1/2 heading, alongside the existing ATX support. Deferred from Phase 6a (Session 7); picked this session from the Polish/deferred backlog via `AskUserQuestion`.
- **Grounded the `---` disambiguation empirically against the real Quarto CLI** (both `quarto render`/bundled Pandoc and a separate system `pandoc`, cross-checked) before writing any code, rather than assuming CommonMark spec behavior. Found 3 rules undocumented by CommonMark that shaped scope: a 2+-line paragraph never promotes to a setext heading in Pandoc's `markdown` reader (unlike gfm/commonmark); a setext underline right after an ATX heading swallows the ATX line's literal text in real Pandoc (deliberately NOT replicated, to avoid regressing a pre-existing unrelated test); a lone bullet-list item nests/strips-the-marker in real Pandoc (guarded against — declines rather than emitting a wrongly-titled heading), while an ordered-list/blockquote marker does not (needs no guard). Full trace: `PROJECT_LEARNINGS.md` Learning #73.
- Strict TDD: first test written and run RED for the right reason before any implementation; the general, holistically-grounded implementation then passed 12 more cases as a disclosed byproduct, except the bullet-list guard (its own genuine RED before its fix). 13 new unit tests + 1 new integration test (real `vscode.executeDocumentSymbolProvider`, a new `test/fixtures/setext.qmd` fixture) — Phase 3E runtime verification for this Outline-view/breadcrumb-affecting change.
- `npm run check-types` clean; `npm test` 634/634 unit passing (+13, zero regressions across all 36 suites); `npm run test:integration` 221/221 passing (+1); `.vsix` packaged file count unchanged.

### 2026-07-10 · [ad hoc] (Session 65 — spell-checking implementation, `BACKLOG.md` item 9, SHIPPED)
- **Shipped** `BACKLOG.md` "Up Next" item 9 — spell checking — implementing Session 64's plan. Operator resolved all 3 open questions via `AskUserQuestion`, all recommended options: README pointer + a new `docs/SPELL-CHECK.md`; ship cross-ref/citation suppression in v1; workspace-scoped settings as the primary documented example. Documentation-only — no `src/` code, no `package.json` change.
- New `docs/SPELL-CHECK.md` (setup, the 8-pattern `cSpell.languageSettings` recipe, a why-the-naive-setup-fails table, an accurate license note, 6 disclosed limitations, workspace/user scope guidance) + a short `README.md` "Spell checking" pointer section — the first `docs/*.md` file ever linked from `README.md` (`docs/**` stays `.vscodeignore`d).
- **Re-verified the recipe against the real `cspell` CLI** (`npx cspell@10.0.1`), extracted programmatically from the final doc text: 23 baseline issues (15 false positives) → 8 with the recipe applied, zero false positives, all genuine typos caught. Caught and root-caused a self-inflicted scratch-directory config-auto-discovery bug along the way rather than reporting the resulting false finding — `PROJECT_LEARNINGS.md` Learning #72.
- **Verified the packaging-level consequence of the delivery decision**: a real `npx vsce package` run confirms the relative `docs/SPELL-CHECK.md` README link is rewritten to a GitHub blob URL, so it resolves correctly on the Marketplace listing (not a silent 404).
- `docs/POSIT-COMPARISON.md`'s spell-checking row corrected (no longer a gap — "we're now ahead of Posit's own source editor"); its "At a Glance" table corrected (Parity 18→19, We're ahead 3→4, Real gaps 6→4), also fixing a pre-existing Session 63 miss (notebook conversion's own row already said "Parity reached" but the summary table was never updated).
- `npm run compile` clean; `npm test` 617/617 unit passing, unchanged.

### 2026-07-10 · [ad hoc] (Session 64 — spell-checking plan, `BACKLOG.md` item 9, PLANNED not shipped)
- **Planned** (not implemented) `BACKLOG.md` "Up Next" item 9 — spell checking — per the Planning workstream. Deliverable: `docs/planning/2026-07-10-spell-checking-plan.md`. Recommends a documentation-only `cSpell.languageSettings` config recipe for the third-party `streetsidesoftware.code-spell-checker` extension, scoping it to Quarto's prose regions. No `src/` code, no `package.json` contribution.
- **Firsthand `cspell` CLI verification** (constructed multi-region `.qmd` fixture, `npx cspell@10.0.1`): a naive setup produces 18 false positives (front matter, code cells, cell options, inline code, math, HTML comments, cross-ref labels/citations); the crafted recipe brings it to 0, all 6 genuine typos still caught. Found and fixed a real CRLF-handling bug in the front-matter exclusion pattern.
- **Corrected a load-bearing claim from Session 61's grill-me**: cspell's PUBLISHED VS Code extension is GPL-3.0-or-later, not MIT (only the underlying `cspell-lib` engine is MIT); the setting Session 61 named (`cSpell.enabledLanguageIds`) is deprecated, and its replacement already defaults to checking any languageId. Both corrected in the plan and in `BACKLOG.md`'s own item-9 text.
- `PROJECT_LEARNINGS.md` Learning #71 appended (verify third-party license/config-setting claims against primary sources, even ones a prior session already asserted).
- Leaves 3 open questions for the operator/executor (delivery-mechanism location, cross-ref/citation suppression scope, workspace- vs. user-settings framing), each with a stated recommendation.

### 2026-07-10 · [ad hoc] (Session 63 — notebook `.ipynb` conversion implementation, `BACKLOG.md` item 8)
- **Shipped** `BACKLOG.md` "Up Next" item 8 — notebook (`.ipynb`) conversion — implementing Session 62's plan. Operator resolved plan §8 Q1 directly: **Option B**, two Posit-mirroring commands `quarto.convertToIpynb`/`quarto.convertToQmd` (not a single unified command), this project's first `contributes.menus.commandPalette` section.
- New `src/core/convert-args.ts` (pure, strict TDD — `inferConvertDirection`/`deriveConvertOutputPath`/`buildConvertArgs`) and `src/features/convert-notebook.ts` (thin adapter): resolves the active `.qmd`/`.ipynb` source, saves if dirty, modal-confirms an overwrite (this project's first modal prompt), spawns `quarto convert --output <derived-path>`, opens the result with the API matching its kind (`showTextDocument` vs. `showNotebookDocument`).
- Real-CLI integration testing (`test/integration/suite/convert-notebook.test.ts`, both directions, overwrite confirm/cancel both exercised) caught two genuine bugs during development: a fire-and-forget race where the command's promise resolved before the converted file was actually opened; and cross-suite `workspace-symbol` pollution from a loaded-but-never-disposed `NotebookDocument` (VS Code's built-in notebook features surface a resident notebook's markdown-cell headings as workspace symbols regardless of tab visibility) — fixed via heading-free fixture content.
- `docs/POSIT-COMPARISON.md`'s notebook row corrected to reflect parity (Ours/Posit's cells and the previously-stale Notes line, plan §8 Q4).
- 220 integration (+5) / 617 unit (+7); clean 38-file `.vsix` (unchanged file count).
- `PROJECT_LEARNINGS.md` Learning #70 appended.
- Runtime GUI (F5) visual pass of Command-Palette `when`-clause filtering explicitly declined by the operator (live-desktop disruption) — disclosed, not silently skipped; automated real-CLI/real-Extension-Host integration coverage already exceeds this project's documented "integration tests are stronger than F5 for wiring/activation/dispatch" standard (Learning #3).

### 2026-07-10 · [ad hoc] (Session 62 — notebook `.ipynb` conversion plan, `BACKLOG.md` item 8)
- **Planned** (not implemented) `BACKLOG.md` "Up Next" item 8 — notebook (`.ipynb`) conversion — per the Planning workstream. Deliverable: `docs/planning/2026-07-10-notebook-conversion-plan.md`. Recommends a thin adapter shelling out to the existing MIT `quarto convert` CLI subcommand (direction auto-inferred from the active document's extension), always passing an explicitly pre-derived `--output` path rather than relying on the CLI's own implicit default. No vendored asset, no new notebook UI needed — VS Code's own built-in `ipynb` extension (MIT, bundled) already provides that.
- **Firsthand CLI verification** (scratch-dir round trip + edge cases against the installed 1.7.33 binary) found three real behaviors absent from `quarto.org`'s public docs: `quarto convert` silently overwrites an existing output file (no prompt); the generated notebook's `kernelspec` metadata is hardcoded to Python 3 regardless of the source cell's actual engine (an `{r}`-cell `.qmd` converts cleanly but falsely claims a Python kernel); `{ojs}` cells are not split into notebook code cells at all (swallowed as literal markdown text). All three are disclosed in the plan (§6) as upstream-CLI limitations, not fixed.
- **Confirmed directly in the installed `@types/vscode`**: an open `.ipynb` is a `NotebookEditor`/`NotebookDocument` (`window.activeNotebookEditor`), never a `TextEditor`/`TextDocument` — the adapter design accounts for both cases from the start.
- **External research, cited (AGPL look-but-don't-copy gate honored)**: confirmed Posit's own Quarto extension already ships this exact feature (`quarto.convertToIpynb`/`quarto.convertToQmd`, shipped v1.132.0, `quarto-dev/quarto#955`) — this is parity catch-up, not a differentiator, reframing Session 61's original grill-me framing. `docs/POSIT-COMPARISON.md:311-316` already has this row with the same facts (good cross-validation); its *Notes* line is flagged as now-stale (claims notebook-renderer/serializer work is needed — it is not) for the future implementing session to correct.
- One open design question left for the executor/operator (§8 Q1): one unified `quarto.convertNotebook` command with runtime direction detection (recommended, smaller manifest surface) vs. two direction-specific commands mirroring Posit's exact naming (this project's first `contributes.menus` addition).
- `PROJECT_LEARNINGS.md` Learning #69 appended (68→69, ascending order confirmed) — verify CLI/API behavior firsthand rather than trusting public docs or memory when planning around an external tool or an unfamiliar VS Code API surface.
- Pure planning session — zero `src/`/`test/` files touched, no implementation (FM #18/#19, plan↔implementation boundary).

### 2026-07-10 · [ad hoc] (Session 61 grill-me decisions — 5 remaining `docs/POSIT-COMPARISON.md` gaps)
- **Ran a `/grill-me` session deciding priority for all 5 remaining real gaps** vs. Posit's extension (WYSIWYG editor stayed excluded per the standing Session 43 operator directive), extending Session 43's own precedent (Learning #50) by grounding EVERY candidate's cost/viability/framing via direct research (grep, `WebSearch`/`WebFetch`, `gh api`) before asking about it, not only a post-ranking scoping pass on the winners — see `PROJECT_LEARNINGS.md` Learning #68. That grounding flipped or substantially narrowed 4 of 5 candidates' prior "parked"/"deferred"/"unranked" framing. **Decisions (all promoted into `BACKLOG.md` "Up Next" item 17):** (1) **Notebook `.ipynb` conversion — RANKED** (new item 8), reversing Session 43's "parked" call after the operator confirmed a real need; scoped to both directions via `quarto convert` (MIT Quarto CLI), confirmed fully MIT-clean — VS Code's own built-in `ipynb` extension (MIT, bundled) handles the notebook UI, no serializer code needed. (2) **Contextual Assist Panel — kept parked**, but reframed as a likely future build-out (code-doc lookup is a partial gap via existing embedded-hover infra; image thumbnails is a genuine zero; either needs a new sidebar `WebviewViewProvider`). (3) **Spell checking — RANKED** (new item 9): ship a scoped cspell config recipe, not a spell-check engine — `streetsidesoftware.code-spell-checker` (MIT) already spell-checks arbitrary language IDs; the real gap is prose-region scoping (an open upstream `quarto-dev/quarto#29` issue), which this project's existing `scanRegions` classifier already computes. (4) **Zotero integration — DECIDED: mostly already covered** — this project's existing `.bib` citekey completion (Phase 6c) already works with a Better-BibTeX-exported Zotero library, operator-confirmed sufficient; the live in-editor Zotero-API picker variant is parked. (5) **YAML front-matter/cell-option "unknown-key" diagnostics — CLOSED, not a real gap** — confirms Session 46's own prior empirical finding that all 3 surfaces are open schemas by Quarto's own design (a permanent scope boundary, not deferred work); filed a genuinely distinct new candidate instead (type/enum validation on already-recognized keys). Pure decision/documentation session, no code touched, TDD-exempt.

### 2026-07-10 · [ad hoc] (Session 60 — `docs/POSIT-COMPARISON.md` staleness fixed)
- **Fixed**: `docs/POSIT-COMPARISON.md` still described 4 already-shipped features as open Posit-only gaps — the 3 the `BACKLOG.md` item named (YAML schema diagnostics, shipped Session 47; project-level render, shipped Session 45; getting-started walkthrough, shipped Session 51) **plus a 4th the item's own scope note missed** (create-project/create-document commands, shipped Sessions 49–50), found by re-verifying each "Real gaps"/"Additional Findings" row against `BACKLOG.md` rather than trusting the filed item's list. Corrected all 4 rows' *Ours*/*Notes* text to Present + shipping session + file pointers; YAML diagnostics is disclosed as a **partial** parity (covers only `_quarto.yml`'s `project:`/`website:`/`book:` blocks, not front matter/cell options — Posit still has broader coverage there). Updated the "At a Glance" table (Real gaps 9→6, Parity 15→18) and struck through the corresponding "What This Suggests for Future Work" list items, consistent with the existing precedent for the run-cell-family/snippets/Graphviz entries. Pure documentation edit, TDD-exempt per `CLAUDE.md`'s declarative-content carve-out. `BACKLOG.md`'s "Polish / deferred" item removed (resolved).

### 2026-07-10 · [ad hoc] (Session 59 — `.vscodeignore` methodology-artifact packaging leak fixed)
- **Fixed**: `PROJECT_LEARNINGS.md` and `HANDOFFS.md` were never added to `.vscodeignore`'s methodology-artifact exclusion block when introduced (Sessions 39/38) — `npm run package` shipped both inside the `.vsix` (160 KB + 15 KB) despite neither being part of the extension (found incidentally, Session 40; filed `BACKLOG.md`, fixed this session). Added both filenames to the existing block. Verified via `npm run package` + `vsce ls --tree`: file count dropped 42→40, neither file present, `npm run check-types` clean. Declarative config edit, TDD-exempt per `CLAUDE.md`.

### 2026-07-10 · [ad hoc] (Session 58 image paste implementation — BACKLOG "Phase 7 authoring aids" now fully SHIPPED)
- **Implemented** BACKLOG.md "Phase 7 authoring aids" final remaining slice — image paste + drag-drop — per Session 57's plan (`docs/planning/2026-07-09-image-paste-plan.md`). Operator resolved the plan's 3 open questions via `AskUserQuestion` before code: Q1 destination = `images/` subfolder; Q2 drag-and-drop parity bundled into v1 (adds L4); Q3 filename trusts `DataTransferFile.name` when present/non-empty, generates otherwise.
- **L1** (`df3bd8f`): pure `core/image-paste.ts` (`extensionForMimeType`/`deriveImageName`/`resolveNonCollidingName`/`buildImageRelativePath`/`buildImagePasteInsertText`), strict TDD, the collision-avoidance loop break-revert-proven.
- **L2** (`5b0e26c`): `providers/image-paste.ts` `QmdImagePasteEditProvider` registered via `vscode.languages.registerDocumentPasteEditProvider({language:"quarto"}, ...)`, zero `package.json` contribution needed.
- **L3** (`2763bad`): integration tests that refine the plan's own D1 disclosure — `vscode.DataTransfer`/`DataTransferItem` do not runtime-validate class identity, so a duck-typed object satisfying the `DataTransferFile` interface flows through the REAL registered provider like a real OS paste would, closing most of the "byte-read path is F5-only" gap (mime-routing, fallback, AND the real write + collision-avoidance path via `vscode.workspace.applyEdit` + a real on-disk fixture, break-revert-proven). `PROJECT_LEARNINGS.md` Learning #66.
- **L4** (`5942108`): `QmdImageDropEditProvider` — drag-and-drop parity bundled into v1 per Q2, sharing L1's core via a refactored `buildImageResult` + a near-mirror adapter, its own 3 integration tests.
- Confirmed ahead of Posit's own source editor, not parity catch-up (their source-mode `.qmd` paste-image remains an open, unimplemented feature request). `docs/POSIT-COMPARISON.md` updated ("True parity in absence" 2→1, "We're ahead" 2→3, the image-paste row detail corrected).
- 610 unit (+15) / 215 integration (+8); clean 42-file `.vsix` (unchanged file count — zero size/manifest impact, per plan §5); `npm run check-types` clean.
- `BACKLOG.md`'s "Phase 7 authoring aids" item checked off — **Phase 7 is now fully complete.**

### 2026-07-09 · [ad hoc] (Session 57 image-paste plan — Phase 7 authoring aids, PLANNED not shipped)
- **Planned** BACKLOG.md "Phase 7 authoring aids" remaining slice (image paste), following the Planning workstream — `docs/planning/2026-07-09-image-paste-plan.md`. No pre-declared layer contract existed, so per `SESSION_RUNNER.md`'s Vertical Slice Sessions gate (a) this is a planning session, mirroring Session 55's treatment of Graphviz.
- Confirmed via VS Code's own MIT built-in source (`microsoft/vscode`, `extensions/markdown-language-features`) that `.qmd` gets zero built-in image-paste support (scoped to `['markdown','prompt','instructions','chatagent','skill']`, not `quarto`). Confirmed via Posit's public GitHub Discussions that their own source-editor paste-image is likewise unimplemented (open feature request; only their excluded AGPL Visual Editor supports it) — this would ship ahead of Posit's source editor, not parity catch-up.
- Plan recommends `vscode.languages.registerDocumentPasteEditProvider` (zero `package.json` contribution, mirrors `providers/workspace-symbols.ts`), no webview/CSP/vendored asset. Discloses a genuine structural F5-only verification gap (no `execute*Provider` command for paste providers; `DataTransferItem` can't be test-synthesized as file-backed) and leaves 4 open questions for operator/executor sign-off (destination folder, drag-drop bundling, filename trust, a live-drag sanity check).
- `BACKLOG.md` annotated PLANNED (still an open checkbox, not shipped). `PROJECT_LEARNINGS.md` Learning #65 appended.

### 2026-07-09 · [ad hoc] (Session 56 graphviz `{dot}` diagram rendering — BACKLOG item #7 now fully SHIPPED)
- **Implemented** BACKLOG.md "Up Next" item #7, per Session 55's plan (`docs/planning/2026-07-09-graphviz-dot-rendering-plan.md`), as ONE vertical-slice session. Operator resolved the plan's one open question (§9 Q1, EPL-2.0 Graphviz-core disclosure) via Phase 0/1 conversation: accept-and-disclose.
- **L1** (`c1a1864`): vendored `@viz-js/viz`'s `dist/viz-global.js` into `media/graphviz/` (re-verified this session, no version/hash drift from the plan's research). `NOTICE` gains a Graphviz section disclosing the EPL-2.0 Graphviz-core + MIT Expat/wrapper provenance — the first non-MIT-only vendored artifact. `CLAUDE.md`/`CONTEXT.md`/`README.md`'s unqualified "MIT-licensed" framing corrected to disclose the vendored component.
- **L2+L3** (`7e08247`): `core/diagram-preview-html.ts` CSP gains `'wasm-unsafe-eval'` only (exact-equality locked, break-revert-proven); the `dot` branch renders via `Viz.instance().renderString(...)` (lazily instantiated) instead of the old placeholder; `features/diagram-preview.ts` gains `graphvizRoot()` + widened `localResourceRoots` + `vizJsUri` wiring.
- **L4** (`08bb026`): integration smoke test — a `{dot}` document opens the diagram-preview webview without crashing, parity with the existing Mermaid open-test.
- **Phase 3E strengthened beyond disclosed "F5-only residue"** (`PROJECT_LEARNINGS.md` Learning #64): executed the real generated `<script>` template plus the real vendored `viz-global.js` in a hand-stubbed Node `vm` DOM, proving a real `{dot}` region produces real Graphviz SVG through the actual shipped code path.
- 595 unit (+2) / 207 integration (+1); clean 42-file `.vsix` (+1); `npm run check-types` clean. `docs/POSIT-COMPARISON.md` corrected to reflect parity (Real gaps 10→9).

### 2026-07-09 · [ad hoc] (Session 55 graphviz `{dot}` diagram rendering — plan only, BACKLOG item #7 PLANNED not yet shipped)
- **Planned** BACKLOG.md "Up Next" item #7: graphviz (`{dot}`) diagram rendering — `docs/planning/2026-07-09-graphviz-dot-rendering-plan.md`. No code changed this session.
- Empirically verified (downloaded and ran both real candidate npm packages in Node, byte-inspected their shipped bundles, fetched Graphviz's own official license page) what a prior session's untested assumption had only guessed at: recommends vendoring `@viz-js/viz`'s `dist/viz-global.js` with a CSP change adding `'wasm-unsafe-eval'` only (not the broader `'unsafe-eval'`).
- One operator-facing open question before implementation can start (plan §9 Q1): the vendored asset also contains a compiled copy of Graphviz, which is EPL-2.0 (corrected from an initial EPL-1.0 assumption) — the first non-MIT-only third-party artifact this project would ship inside the `.vsix`.
- `PROJECT_LEARNINGS.md` Learning #63 appended: carried-forward "needs X" claims across multiple session handoffs are hypotheses, not facts, however many times repeated.

### 2026-07-09 · [ad hoc] (Session 54 workspace symbol provider — BACKLOG item #6 now fully SHIPPED)
- **Implemented** BACKLOG.md "Up Next" item #6: a workspace symbol provider ("Go to Symbol in Workspace"). New `src/core/workspace-symbols.ts` (`flattenOutline`, `matchesWorkspaceQuery`) + `src/providers/workspace-symbols.ts` `registerWorkspaceSymbolsProvider`, reusing the existing `core/qmd/model` `buildOutline` tree (the same one the Outline view/breadcrumbs use) across every `**/*.qmd` file via `vscode.workspace.findFiles`. No `package.json` contribution needed.
- **New testing infrastructure (Learning #62):** no prior integration suite in this project opened a workspace folder in the Extension Development Host — `findFiles` needs one to search. `test/integration/runTest.ts` now opens `test/fixtures/project` (the existing render-project fixture) as the shared workspace folder for the whole integration run; verified safe for `render-project.ts`'s `resolveStartAndBoundary` (the only other `workspace.workspaceFolders` consumer) by re-running the full integration suite, not just the new one.
- Strict TDD throughout: 6 unit tests for the pure core layer (RED-first), then the adapter's integration test written and confirmed failing (0 matches, no provider/no folder) before implementation. 4 integration tests (cross-file find, nested-subdirectory find, empty-query aggregation, non-matching-query filtering), all break-revert-proven.
- 593 unit (+6) / 206 integration (+4); clean 41-file `.vsix` (unchanged file count — new source bundles into `dist/extension.js`).

### 2026-07-09 · [ad hoc] (Session 53 Quarto code snippets — BACKLOG item #5 now fully SHIPPED)
- **Implemented** BACKLOG.md "Up Next" item #5: Quarto code snippets. New `snippets/quarto.json` (13 snippets) registered via `package.json` `contributes.snippets`. Genuinely declarative JSON, TDD-exempt per `CLAUDE.md`'s carve-out.
- Covers front matter, all 4 executable-cell languages (python/r/julia/ojs — deliberately fence-only, since `#|` option entry is already handled by the existing Phase 6d completion feature), callouts (one snippet, a `${1|note,tip,warning,caution,important|}` choice placeholder), fenced divs, tabset panels, and one snippet per cross-reference kind this extension's own `core/refs.ts` recognizes (fig/tbl/eq/sec/lst) — grounded against `test/fixtures/crossrefs.qmd` and `core/refs.ts`'s own `KIND_PREFIX`/`INLINE_LABEL` patterns, not against Posit's AGPL extension (Learning #1).
- Added a manifest-shape regression-guard unit test (`test/unit/snippets.test.ts`, 30 tests — precedent: Session 51's `walkthrough.test.ts`) plus a genuine runtime-verification integration test (`test/integration/suite/snippets.test.ts`, 2 tests, via `vscode.executeCompletionItemProvider` — VS Code's built-in snippet provider is reachable there, so this proves the contributed snippet fires for real and is correctly language-scoped). All break-revert-proven.
- 587 unit (+30) / 202 integration (+2); clean 41-file `.vsix` (+1). `docs/POSIT-COMPARISON.md`'s snippets entry corrected to reflect parity (10 real gaps, down from 11).

### 2026-07-09 · [ad hoc] (Session 52 run-cell command family completion — BACKLOG item #4 now fully SHIPPED)
- **Implemented** BACKLOG.md "Up Next" item #4: the 4 missing run-cell family commands (`quarto.runSelectedLines`, `quarto.runNextCell`, `quarto.runPreviousCell`, `quarto.runCellsBelow`) plus default keybindings across the resulting 9-command family. Strict TDD, one command at a time, each shown genuine RED (`command '...' not found`) before implementation, 4 checkpoint commits (`c097574`/`595942b`/`95be370`/`ef79ee3`).
- All 4 reuse the existing `core/cells.ts`/`core/execution-delegate.ts` primitives — no new `core/` functions needed. `runNextCell`/`runPreviousCell` use a single cursor-line filter that works whether the cursor is inside a cell or in prose, and move the cursor into the cell that ran so repeated invocation steps through the document (Learning #59).
- `package.json` (`3d5a60b`): 4 new `contributes.commands` entries + keybindings for ALL 9 run-cell commands, including the 3 pre-existing ones (`runCellsAbove`/`runAllCells`/`insertCell`) that had never had a keybinding. Deliberately avoided `ctrl+alt+up`/`ctrl+alt+down` for Next/Previous Cell — VS Code's own stock keybindings claim those for multi-cursor add-above/below (Learning #59) — using a `ctrl+alt+<letter>` scheme instead.
- 557 unit (unchanged) / 200 integration (+11); clean 40-file `.vsix` (unchanged file count). `docs/POSIT-COMPARISON.md`'s run-cell-family entry corrected to reflect parity (11 real gaps, down from 12); a pre-existing, unrelated staleness in the same doc (3 other already-shipped items still listed as open gaps) filed as its own `BACKLOG.md` Polish/deferred item, not fixed in this session.

### 2026-07-09 · [ad hoc] (Session 51 onboarding walkthrough implementation — Track C of BACKLOG item #3, item #3 now fully SHIPPED)
- **Implemented** Track C (the walkthrough) of `BACKLOG.md` "Up Next" item #3, per `docs/planning/2026-07-09-onboarding-walkthrough-plan.md` §4 (Session 48's plan). Kickoff §7 Q4 (per-step `media` content) resolved via `AskUserQuestion`: minimal per-step markdown panel.
- New `package.json` `contributes.walkthroughs`: one walkthrough (`quartoGettingStarted`, `featuredFor: ["**/*.qmd"]`), 5 steps tying together `quarto.verifyInstallation`, `quarto.newDocument` (Track A), `quarto.createProject` (Track B), `quarto.render`/`quarto.preview`, and `quarto.runCell` (with a closing pointer to `quarto.previewMath`/`quarto.previewDiagram`). 5 new `media/walkthrough/*.md` step panels. No new TypeScript — genuinely declarative, TDD-exempt per CLAUDE.md.
- Went beyond the plan's own "no test required" call: added `test/unit/walkthrough.test.ts` (23 tests) as a manifest-shape regression guard — asserts step count, that every `media.markdown` path resolves on disk, and that every `command:`/`onCommand:` reference names a real registered command. Break-revert-proven against a deliberately broken media path.
- 557 unit (+23) / 189 integration (unchanged); clean 40-file `.vsix` (+5 walkthrough media files). **Disclosed gap (FM #24):** no manual F5 visual pass was performed — this agent has no GUI-driving tool available in this session; the operator should confirm the walkthrough renders correctly via `workbench.action.openWalkthrough` before relying on it.
- `BACKLOG.md` item #3 (all three tracks — A, B, C) is now fully SHIPPED.

### 2026-07-09 · [ad hoc] (Session 50 quarto.createProject implementation — Track B of BACKLOG item #3)
- **Implemented** Track B (`quarto.createProject`) of `BACKLOG.md` "Up Next" item #3, per `docs/planning/2026-07-09-onboarding-walkthrough-plan.md` §3 (Session 48's plan). Two kickoff questions resolved before code: Q2 confirmed empirically against the real installed Quarto 1.7.33 CLI (scratch-dir spawn, 0.126s, exit 0, no new process) — `create-project` does not auto-launch an editor; Q3 resolved via `AskUserQuestion` — open the new project as the workspace.
- New command **`Quarto: Create Project`**: `src/core/create-project-args.ts` `buildCreateProjectArgs` (pure, sibling of `render-args.ts`'s `buildRenderProjectArgs`) + `src/features/create-project.ts` `registerCreateProjectFeature` (three sequential prompts — `showQuickPick` type → `showOpenDialog` parent folder → `showInputBox` name/title — → `resolveBinary` → spawn the legacy, non-prompting `quarto create-project` CLI alias → on success, `vscode.commands.executeCommand("vscode.openFolder", ...)`). Wired in `extension.ts`; one new `package.json` command entry.
- Strict TDD throughout (RED shown before GREEN for the adapter's integration test — `command 'quarto.createProject' not found` before any adapter code existed); two checkpoint commits — L1 core+unit `343598f`, L2 adapter/wiring/integration `cdebaa4` — full verify matrix (unit/types/integration/package) run at both boundaries.
- Confirmed `showQuickPick`/`showOpenDialog` extend the established monkey-patch stub technique cleanly; introduced a new OS-temp-dir integration-test pattern (`mkdtempSync`, removed unconditionally in `afterEach`) and a new technique — intercepting `vscode.commands.executeCommand` itself — to test the `vscode.openFolder` success path without triggering a real Extension Development Host reload (`PROJECT_LEARNINGS.md` Learning #57).
- 534 unit (+6) / 189 integration (+3); clean 35-file `.vsix`; `npm run check-types` clean. `BACKLOG.md` item #3 updated (Track B checked off; Track C now startable, both dependencies shipped).

### 2026-07-09 · [ad hoc] (Session 49 quarto.newDocument implementation — Track A of BACKLOG item #3)
- **Implemented** Track A (`quarto.newDocument`) of `BACKLOG.md` "Up Next" item #3, per `docs/planning/2026-07-09-onboarding-walkthrough-plan.md` §2 (Session 48's plan). Kickoff Q5 resolved via `AskUserQuestion`: kept the plan's recommended optional title prompt.
- New command **`Quarto: New Quarto Document`**: `src/core/new-document.ts` `buildNewDocumentContent` (pure — trims the title, falls back to `"Untitled"` on empty/whitespace, double-quote-escapes embedded `"`/`\`) + `src/features/new-document.ts` `registerNewDocumentFeature` (thin adapter: `showInputBox` → build content → open as an untitled `language: "quarto"` buffer; no disk write, no CLI shell-out — `quarto create document` does not exist as a CLI feature, Session 48 Finding 1). Wired in `extension.ts`; one new `package.json` command entry.
- Strict TDD throughout (RED shown before GREEN for every new behavior); two checkpoint commits — L1 core+unit `a32c54d`, L2 adapter/wiring/integration `fde25d0` — full verify matrix (unit/types/integration/package) run at both boundaries.
- Confirmed the `showInformationMessage`/`openExternal` monkey-patch stub technique extends cleanly to `showInputBox` (`PROJECT_LEARNINGS.md` Learning #56) — written test-first, RED confirmed as `command 'quarto.newDocument' not found` before any adapter code existed.
- 528 unit (+5) / 186 integration (+3); clean 35-file `.vsix`; `npm run check-types` clean. `BACKLOG.md` item #3 updated (Track A checked off; Tracks B/C remain).

### 2026-07-09 · [ad hoc] (Session 48 onboarding-walkthrough plan)
- **Planned** `BACKLOG.md` "Up Next" item #3 (onboarding: getting-started walkthrough + `quarto.newDocument`/`quarto.createProject` scaffolding commands) — `docs/planning/2026-07-09-onboarding-walkthrough-plan.md`. No implementation this session (FM #18/#19).
- Grounded via a 4-agent parallel research `Workflow` (~265K subagent tokens, 118 tool calls): firsthand CLI source-read + live invocation of `quarto create`/`quarto create-project` against the installed 1.7.33 binary; VS Code's `contributes.walkthroughs` schema verified against `microsoft/vscode`'s own extension-point source; this repo's own L1→L4 command-adding pattern, `engines.vscode`, reusable media, and test-fixture conventions; Posit's public (AGPL look-but-don't-copy) black-box UX for its equivalent commands + walkthrough.
- **Two headline scope corrections to BACKLOG's original framing** (plan §0): (1) `quarto create document` does not exist as a CLI feature in 1.7.33 — `quarto.newDocument` must synthesize its own YAML-safe template in TypeScript (genuine logic, not declarative config); `quarto.createProject` likewise needs an arg-builder + three prompt APIs (`showInputBox`/`showQuickPick`/`showOpenDialog`) unused anywhere in this codebase before, plus a brand-new OS-temp-dir integration-test pattern. Only the walkthrough itself is genuinely declarative/TDD-exempt. (2) The three components are independently-useful capabilities with a real dependency edge (the walkthrough needs the other two commands' IDs to exist first) — recommended as **three separate implementation sessions**, not "ship together, one session" as BACKLOG originally framed it.
- `BACKLOG.md` item #3 updated to point at the plan; `PROJECT_LEARNINGS.md` Learning #55 appended.

### 2026-07-09 · [ad hoc] (Session 47 YAML-diagnostics implementation)
- **Shipped `quarto.yml`/`_quarto.yaml` schema diagnostics** — implements `BACKLOG.md` "Up Next" item #2 end to end, per Session 46's plan (`docs/planning/2026-07-09-yaml-schema-diagnostics-plan.md`), as one vertical-slice session. New always-on feature: opening a `_quarto.yml`/`_quarto.yaml` scans its `project:`/`website:`/`book:` blocks for keys the installed Quarto schema doesn't recognize and surfaces each as an Error `Diagnostic`. Four checkpoint-committed layers: **L1** (`32d21b0`) `src/core/yaml-schema.ts` `SchemaIndex.projectKeys`/`resolveClosedKeys` (incl. the `book:` `super`/`$ref` merge chain, grounded against the real installed Quarto 1.7.33 schema) + new `src/core/project-yaml.ts` `findProjectConfigKeyLines`. **L2** (`edf4491`) new `src/features/yaml-diagnostics.ts` `DiagnosticCollection` adapter (filename-gated document events, 350ms debounce) + `extension.ts`/`package.json` (`onLanguage:yaml` activation fix) wiring. **L3** (`fd126f1`) valid/invalid `_quarto.yml` fixtures, both grounded against the real Quarto CLI (`quarto inspect`). **L4** (`4d1b4f1`) integration tests via `vscode.languages.getDiagnostics`.
- **Adversarial review + fixes** (`0680e98`/`2f503df`): a 26-agent `Workflow` review of this session's own just-shipped code found and this session fixed 2 HIGH-severity, core-promise-violating false positives (a quoted YAML key compared against the schema WITH its quote characters attached; the filename gate was a suffix test — `.endsWith("_quarto.yml")` — rather than an exact basename check) plus 6 more confirmed MEDIUM/LOW findings (a redundant depth cap on the closed-key resolver removed; a stale-content-overwrite race fixed with a per-URI generation counter; a flaky integration test hardened; 3 test-coverage gaps closed). Two LOW-severity, safe-direction gaps (an anchored/quoted container header disables scanning of that block) documented in `BACKLOG.md`, not fixed — cross-module, out of scope. `PROJECT_LEARNINGS.md` Learning #54 appended (incl. a process-integrity finding: running the 26-agent review without worktree isolation let concurrent agents' own scratch files become visible to each other, misread by one agent as a possible injection — investigated, resolved as mundane, no malicious injection substantiated). `BACKLOG.md` item #2 marked done; a new deferred "proactive from `.qmd` context" enhancement filed.
- 523 unit (+33) / 183 integration (+7); clean 35-file `.vsix`; `npm run check-types` clean.

### 2026-07-09 · [ad hoc] (Session 46 YAML-diagnostics plan)
- **Wrote `docs/planning/2026-07-09-yaml-schema-diagnostics-plan.md`** — an implementation plan for `BACKLOG.md` "Up Next" item #2 (YAML schema diagnostics). Planning-only session (no implementation, FM #18/#19). Grounded via a 6-agent research `Workflow` (4 research agents + 2 adversarial verifiers, ~467K subagent tokens, 205 tool calls). **Headline finding, and the reason v1's scope is a fraction of the item's original framing:** a live probe of the installed Quarto 1.7.33 CLI (fabricated key vs. genuine typo of a real option, every candidate surface, independently reproduced twice with different fixtures) found `.qmd` front-matter top-level keys, cell options (`#|`/`//|`), per-format nested options, and `_quarto.yml`'s own ROOT keys are all **open** — a typo and a custom field are indistinguishable to `quarto render` itself (both exit 0, silent). Only the **interior of `_quarto.yml`'s `project:`/`website:`/`book:` blocks** is genuinely closed and already enforced by `quarto render`/`quarto inspect` today, root-caused directly in the bundled `quarto.js` CLI source. Presented this to the operator via `AskUserQuestion` mid-session; operator confirmed the recommended narrow, safe scope. Also killed a previously-flagged "validation-shaped `json-schemas.json`" lead (confirmed twice: an unused, non-standard, dangling byproduct of Quarto's own build tooling, never read back at runtime — everything needed is already in the completion-shaped file this extension already reads) and corrected the item's own stated dependency on Session 45's `findProjectRoot` (not actually needed by the corrected v1). The plan's own headline design dragon (`book:`'s `super`/`$ref` merge chain) is fully grounded with a precise gate-d discriminator key (`announcement`) for a future implementing session to verify against. `BACKLOG.md` item #2 updated to point at the plan with the corrected framing; `PROJECT_LEARNINGS.md` Learning #53 appended.

### 2026-07-09 · [ad hoc] (Session 45 project-level-render implementation)
- **Shipped `quarto.renderProject` ("Render Project")** — implements `BACKLOG.md` "Up Next" item #1 end to end, per Session 44's plan (`docs/planning/2026-07-09-project-level-render-plan.md`), as one vertical-slice session (operator-ratified over splitting into two, plan §9 Q1). Four checkpoint-committed layers: **L1** (`cc66fbe`) new pure `src/core/project.ts` `findProjectRoot` (ancestor walk for `_quarto.yml`/`_quarto.yaml`, bounded at an optional directory, DI'd `exists`) + 6 unit tests, both load-bearing guards break-revert-proven. **L2** (`e61386b`) `src/core/render-args.ts` +`buildRenderProjectArgs` + new `src/features/render-project.ts` (Tier A/B folder-editor resolution, spawn/report with `cwd` PINNED to the discovered root — never a bare no-args `quarto render`, the plan's grounded headline finding) + `package.json`/`extension.ts` wiring. **L3** (`70dc234`) the first `_quarto.yml`-having test fixture in this repo (`test/fixtures/project/`), sanity-rendered against the real installed Quarto 1.7.33 CLI before committing. **L4** (`0da5dab`) `test/integration/suite/render-project.test.ts` — 4 tests against the real fixture, including a whole-project-vs-partial-render discriminator and a cwd-pin discriminator (proven via monkey-patching `vscode.window.showInformationMessage`/`vscode.env.openExternal`), both break-revert-proven by reproducing the naive "bare render, cd near the file" bug and confirming RED before reverting. Also fixed a Session 44 `HANDOFFS.md` receipt's self-referential `commit: pending` field (reconciled to `65f28bb`, per this file's own documented convention). 490 unit (+7) / 176 integration (+4); clean 35-file `.vsix`. `BACKLOG.md` item #1 marked `[x]` SHIPPED; `PROJECT_LEARNINGS.md` Learning #52 appended.

### 2026-07-09 · [ad hoc] (Session 44 project-level-render plan)
- **Wrote `docs/planning/2026-07-09-project-level-render-plan.md`** — an implementation plan for `BACKLOG.md` "Up Next" item #1 (Project-level render, ranked via Session 43's grill-me decision). Planning-only session (no implementation, FM #18/#19). Grounded via a 6-agent research `Workflow` (code inventory, Quarto docs/source, VS Code workspace-API conventions, and — the headline method — a **live empirical test of the installed Quarto 1.7.33 CLI** against a scaffolded temp project, independently re-verified by a second adversarial agent from scratch). **Key finding:** bare `quarto render` (no arguments) run from a project subdirectory silently renders only that directory's files while inheriting the ancestor project's config — a naive "cd to the discovered root, call bare render" design would ship a silent under-render bug for the most common invocation shape (editing a nested file). The plan locks the design to an explicit `quarto render <root>` invocation (confirmed reliable regardless of cwd) with `cwd` pinned to the root (a second trap: Quarto's reported output path is relative to the target directory, not the spawning process's cwd). Recommends one vertical-slice implementing session (pure discovery core → adapter/command/package.json wiring → new test fixture → integration tests), with a 2-session split left as an explicit alternative. `BACKLOG.md` item #1 updated with a pointer + summary; `PROJECT_LEARNINGS.md` Learning #51 appended (the live-CLI-grounding pattern, extending this project's prior "ground firsthand" learnings from static schema data to dynamic external-tool behavior). Also reconciled a Phase 0 `HANDOFFS.md` gap (commit `a7f3910`, no receipt) as a `status: reconciled` block, committed separately (`e1adcbe`).

### 2026-07-09 · [ad hoc] (gitignore docs render artifacts)
- **Added `docs/*.html`/`docs/*_files/` to `.gitignore`**, operator-directed follow-up right after Session 43's close-out. `docs/POSIT-COMPARISON.html` (a stray local `quarto render` output of `docs/POSIT-COMPARISON.md`, never committed) had been flagged untracked at Session 43's Phase 0 orientation and left unresolved pending the operator's call; the operator's answer was "don't commit it," so it's now permanently excluded rather than left as a recurring untracked-file flag at every future orientation. Mirrors the existing `test/fixtures/*.html` render-artifact exclusion.

### 2026-07-09 · [ad hoc] (Session 43 grill-me decisions)
- **Ran a `/grill-me` session to rank `docs/POSIT-COMPARISON.md`'s 12 "Real gaps" + "Additional Findings" candidates against the operator's actual priorities** (BACKLOG.md "Documentation" item, follow-up to Session 42). Operator excluded the Visual (WYSIWYG) editor from this round mid-orientation. Grounded early recommendations against the codebase before asking (grep-verified: no diagnostics/`DiagnosticCollection` code, no `snippets`/`walkthroughs` contribution points, no `_quarto.yml`/project-root discovery — all matched the comparison doc's claims). Elicited two load-bearing usage facts not inferable from the repo (multi-file Quarto projects/books are the dominant workflow; new-user/Marketplace adoption matters), then ranked by (frequency × silent-failure-prevention × workflow-class breadth) instead of raw gap size. A scoping question on item #2 (should YAML diagnostics cover `_quarto.yml`?) surfaced a hidden infrastructure dependency on item #1 (`_quarto.yml` discovery doesn't exist yet, and Project-level render builds exactly that) — swapped the order rather than duplicate the discovery code across two sessions. **Final ranking (promoted into `BACKLOG.md` "Up Next"):** 1. Project-level render (v1 = render only) → 2. YAML diagnostics (v1 = unknown-key-only, depends on #1) → 3. Onboarding (walkthrough + scaffolding commands) → 4. Run-cell family (all 4 missing commands + keybindings) → 5. Snippets → 6. Workspace symbol provider → 7. Graphviz rendering; `.ipynb` conversion and a Contextual Assist Panel parked (not ranked); Zotero and Visual-Editor-scoped spell check deferred (coupled to the WYSIWYG exclusion). See `PROJECT_LEARNINGS.md` Learning #50 for the reusable rank-then-scope pattern. (Session 43.)

### 2026-07-09 · [ad hoc] (Posit feature-comparison doc)
- **Authored `docs/POSIT-COMPARISON.md`** — a 31-row feature-comparison matrix vs. Posit's official AGPL-3.0 Quarto VS Code extension (operator-requested, Session 29; BACKLOG.md "Documentation" item). Grounded in our own inventory (`ROADMAP.md` + `package.json` + `src/`) and researched Posit inventory (marketplace listing, `quarto.org` docs, the `quarto-dev/quarto` repo's public README/CHANGELOG/manifest — features only, never implementation code, per `PROJECT_LEARNINGS.md` Learning #1's AGPL look-but-don't-copy gate). Built via a `Workflow` run: 5 parallel domain-research agents → 1 synthesis agent → 31 independent per-row adversarial-verify agents (Bash+Grep to re-check our claims, WebFetch to re-check Posit's cited sources). 14 of 31 rows (45%) had a real defect caught and corrected at verify time — stale citations, a fabricated quote, a wrong citation URL, an overclaim on our own code, an undercounted gap, and one claim with the competitive direction reversed. Found we're verifiably ahead on 2 fronts (format-scoped nested option completion; default Bold/Italic keybindings, which Posit removed in 2022 and never restored) and behind on 12 real gaps (largest: no YAML diagnostics/validation, no Visual Editor). See `PROJECT_LEARNINGS.md` Learning #49 for the reusable verify-pass pattern. (Session 42.)

### 2026-07-09 · [ad hoc] (copyright dedup fix)
- **Fixed the `copyright` front-matter key name-collision dedup bug** — `collectFields` (`src/core/yaml-schema.ts`) deduplicated same-named fields across `schema/document-*.yml` files by first-occurrence-wins, an accident of JSON key order (a file-naming artifact), not correctness. Quarto defines `copyright` in both `document-attributes.yml` (bare, property-less, JATS-only) and `document-metadata.yml` (the real object with `year`/`holder`/`statement`) — the poorer definition iterated first and silently won, so its richer sibling's children were discarded for every format, not just JATS (review-caught, Session 37). Switched `collectFields` to richest-wins (by `children.length + values.length`), keeping first-seen ORDER via a `Map` so only content, not position, changes on a collision. Grep-verified the same collision shape against 3 other duplicated document-key names (`logo`/`subject`/`footer`); none regress since their duplicates tie in richness. Strict TDD: RED via a fixture mirroring the real collision (poorer entry inserted first, matching real JSON key order), then the minimal fix. New integration test proves it end-to-end against the REAL installed Quarto 1.7.33 schema (`format:\n  html:\n    copyright:\n      <here>` now offers `year`/`holder`/`statement`, previously nothing), break-revert-proven (`quartoSharePath` forced to throw reds the new test + 17 other reader-derived tests while the curated `code-tools` control stays green). 483 unit (+1) / 172 integration (+1); clean 35-file `.vsix`; compile clean. (Session 41.)

### 2026-07-09 · [ad hoc] (b2-iii-value)
- **Phase 6d-6+ (b2-iii-value) — deep-nested per-format option VALUE completion** — After a sub-key one object level under a per-format option (`format:\n  <fmt>:\n    <opt>:\n      <key>: <here>`), the YAML provider now offers that sub-key's resolved enum/boolean values (e.g. `format:\n  html:\n    html-math-method:\n      method: <here>` → `plain`/`webtex`/`gladtex`/`mathml`/`mathjax`/`katex`; `format:\n  html:\n    crossref:\n      chapters: <here>` → `true`/`false`). **Detector and provider UNCHANGED** (both already generic over `parentPath`, confirmed by trace + a new break-revert-proven detector test locking the 4-element value-context shape). All new code is THREE `valuesOfSchema` (`src/core/yaml-schema.ts`) extensions, ground-truthed against the real installed Quarto 1.7.33 schema before coding: (a) the definition-enum-OBJECT form `{enum:{values:[...]}}` some `definitions.yml` entries use (`math-methods`) — distinct from the plain-array `{enum:[...]}` form (`page-column`); (b) the `{tags, schema:...}` wrapper indirection some `properties` entries use (`editor.render-on-save`); (c) the object-wrapped `{boolean:{description,default}}` DSL form (`crossref.chapters`/`ref-hyperlink`, `chalkboard.read-only`) — found by Session 37's adversarial review, not in the original plan. Strict TDD throughout: RED shown for each of the 3 gaps (a failing unit test against a fixture mirroring the real shape), then the minimal fix, 3 checkpoint commits. Confirmed already-working inline cases needed zero code (`code-tools.toggle`) and a free-text sub-key still offers nothing without crashing (`grid.sidebar-width`). 6 new integration tests against the REAL installed schema (not just the fixture), break-revert-proven (`quartoSharePath` forced to throw): the 3 gate-d tests + the leading-space test go RED while the curated-served controls stay GREEN, confirming the fixes are reader-derived. 482 unit (+4) / 171 integration (+6); clean 35-file `.vsix`; compile clean. **b2-iii-deep (depth-4 + `super`/`allOf`) remains deferred** — not touched this session. (Session 40; `docs/planning/2026-06-30-phase-6d6b2iii-deep-nesting-plan.md` §6 b2-iii-value slice, now SHIPPED.)

### 2026-07-09 · [ad hoc] (later)
- **Extracted CLAUDE.md's "Project-specific Learnings" table into a committed `PROJECT_LEARNINGS.md`** — The table had grown to 45 rows / 159 KB of CLAUDE.md's 164 KB (~97%), and CLAUDE.md is loaded in full into every session's context, so every session was paying that cost regardless of relevance. Moved the table verbatim (byte-exact `diff`-verified) into a new project-owned, git-committed `PROJECT_LEARNINGS.md` at the project root; CLAUDE.md's "Project-specific Learnings" subsection now carries a short pointer paragraph with a **plain Markdown link** (`[PROJECT_LEARNINGS.md](PROJECT_LEARNINGS.md)`), deliberately not an `@`-import, which would auto-expand into context every session and defeat the purpose. Net: CLAUDE.md 164 KB → 5.8 KB. The synced `SESSION_RUNNER.md`/`BOOTSTRAP.md`/`CLAUDE_TEMPLATE.md`/`docs/methodology/HOW_TO_USE.md` all hard-code the heading "CLAUDE.md → Project-Specific Methodology Adaptations → Project-specific Learnings" as where sessions record learnings — kept that heading text stable in CLAUDE.md (only its content changed to a pointer) so those synced instructions still resolve correctly without editing any synced file. Appended Learning #46 (this extraction pattern) to `PROJECT_LEARNINGS.md` itself, per its own new "append here, not CLAUDE.md" instruction. Pure docs restructuring, no logic — TDD-exempt per CLAUDE.md's own exemption clause; verified with `npm run compile` (clean) + `python3 methodology_dashboard.py` (unchanged 78/100) + a repo-wide grep for stray `@`-imports and the old heading (clean). (Session 39; PROJECT_LEARNINGS.md Learning #46.)

### 2026-07-09 · [ad hoc]
- **Methodology sync to canonical `KJ5HST/methodology` (v3.5)** — Ran `../methodology/bin/sync .` from the already-current sibling checkout (`origin`→`rmsharp/methodology` fork, `upstream`→`KJ5HST/methodology`, both at `main`/0 commits behind). `bin/status .` confirmed zero locally-modified tracked files first, so the sync applied cleanly with no `--force`. Updated: `SESSION_RUNNER.md`, `SAFEGUARDS.md`, `RECOMMENDED_SKILLS.md`, `BOOTSTRAP.md`, `methodology_dashboard.py`, `docs/methodology/ITERATIVE_METHODOLOGY.md`, `docs/methodology/HOW_TO_USE.md`, and 4 workstream docs (`AUDIT_WORKSTREAM.md`, `RESEARCH_EXHAUSTIVE_VERIFICATION_CAMPAIGN.md`, `INHERITED_CODEBASE_FAMILIARIZATION_CAMPAIGN.md`, `TEMPLATE_CAMPAIGN.md`). Created (new seed): `HANDOFFS.md` — a durable, git-committed, session-level close-out receipt ledger (`status: pending` at Phase 1B → `status: complete` at Phase 3D), which Phase 0 step 6 now also reconciles alongside `CHANGELOG.md`. Verified: `npm run compile` clean (zero `src/**` files touched), `python3 methodology_dashboard.py` clean (78/100 health; the 1 pre-existing CRITICAL flag is the documented dev-only npm-audit posture, Learning #20, unrelated to this sync). Pure docs/tooling sync — no unit-test gate applies. (Session 38; CLAUDE.md Learning #45.)

### 2026-06-30 (latest)
- **Phase 6d-6+ (b2-iii-key) — deep-nested per-format option KEY completion (v2)** — Under a concrete format option that is itself object-valued (`format:\n  <fmt>:\n    <opt>:\n      <here>`), the YAML provider now offers that option's resolved sub-keys, one object level deep (e.g. `format:\n  html:\n    code-tools:\n      <here>` → `source`/`toggle`/`caption`; `format:\n  html:\n    theme:\n      <here>` → `light`/`dark`). Detector: `src/core/yaml-context.ts` `nestedParentPath` generalized from a bounded 2-level cap to an N-level ancestor walk (climbs any number of pure-mapping levels, returning the full path only when the root is a column-0 `format:`). Reader: new pure `src/core/yaml-schema.ts` `resolveObjectProperties` (walks `anyOf`/`ref`/`maybeArrayOf`/the `{schema: X}` indirection, `seenRefs`-cycle-guarded), `childDescription` (nested description lookup), and `objectChildren` (composes these, capped at exactly ONE object level) wired into `toField` via `SchemaField.children`; `frontMatterKeys` gained a `parentPath.length>=3 && [0]==="format"` navigation branch. **Provider UNCHANGED** (generic over `parentPath`). Curated offline fallback added for `code-tools`/`theme`. **Grounding found the plan's own algorithm description was incomplete** — reaching the real 40 object-valued options needs bare `arrayOf` and the `{schema: X}` wrapper unwrapped too, not just the three forms the plan named. Adversarial review (5-lens/3-refuter, 23 agents, ~3.06M tokens): 6 raised → 3 confirmed. Fixed: (medium) a bare **unconditional** `arrayOf` option (e.g. `other-links`, `filters` — a sequence, never a mapping) must NOT be unwrapped the same as `maybeArrayOf`, or it offers schema-invalid mapping-key completions; the fix removes the bare-`arrayOf` branch entirely. (low) a malformed `properties` typed as a JSON array silently produced index-named garbage keys (`typeof x==="object"` is true for arrays); fixed with an explicit `!Array.isArray` guard. (low) `childDescription`'s resolved output was untested; added coverage. All three break-revert-proven, including against the real installed schema. This session also discovered and closed a ghost-session gap: a first attempt at this slice had committed only its detector layer, then ended without closing out — the checkpoint-commit discipline meant no work was lost. 482 unit / 165 integration; clean 33-file `.vsix`. **b2-iii-value (the value-side complement) is the next open 6d work; b2-iii-deep remains deferred.** (Session 37; CLAUDE.md Learning #44.)
- **Phase 6d-6+ (b2-ii) — per-format option VALUE completion (v2, a TEST-ONLY slice)** — Under `format:\n  <fmt>:\n    <key>: <here>` in the front matter, the YAML provider now offers `<key>`'s enum values, scoped to the concrete format (`format:\n  html:\n    code-overflow:` → `scroll`/`wrap`; under `format:\n  gfm:` it offers nothing, since `code-overflow` isn't valid there — the value discrimination falls out of the key filter). **No production code changed** — traced firsthand that the whole value path already existed after b2-i: the detector (`src/core/yaml-context.ts` `nestedKeyContextAt:198-208`) already emits `{kind:"frontmatter-value", parentPath:["format",fmt,key]}`, the provider (`src/providers/yaml.ts:102-115`) is generic over `parentPath` (unchanged, like Sessions 23/25/26/32/41), and the reader (`src/core/yaml-schema.ts` `frontMatterKeys(["format",fmt])`) returns per-format fields already carrying resolved `.values` (from `toField`→`valuesOfSchema`). The slice is 6 tests only (3 unit + 3 integration). Gate-d discriminator `code-overflow` (`$html-all`, `document-code` context, enum `scroll`/`wrap`, absent from the curated fallback) is simultaneously reader-only (a green proves the reader resolved a per-format value end-to-end) and format-discriminating. Strict TDD adapted to a test-only slice: the RED evidence is break-revert (each runtime-conditional so the build compiles). Adversarial review (5-lens/3-refuter, 11 agents, ~1.1M tokens): **2 raised → 0 confirmed** (13th consecutive clean review); both were the same label nuance — the real `toc` carries `tags.formats:["!man","!$docbook-all","!$jats-all"]` (all-except, valid for html AND gfm), so "universal" was reworded to "gfm-valid" (comment-only). 459 unit / 158 integration; clean 33-file `.vsix`. **b2-iii (deep nesting) remains the only deferred/open 6d work.** (Session 35; CLAUDE.md Learning #42.)

### 2026-06-30 (later)
- **Phase 6d-6+ (b2-i) — per-format option KEY completion (v2)** — Under `format:\n  <fmt>:\n    <key>` in the front matter, the YAML provider now offers exactly the option keys Quarto considers valid for the concrete format (`format:\n  html:` and `format:\n  gfm:` offer different sets). New pure `src/core/format-aliases.ts` (`expandFormatAliases` recursive+cycle-guarded, `formatMatches` — Quarto's `useSchema`: untagged=universal, `!`-negation=all-except, positive-must-match); `src/core/yaml-context.ts` generalized `nestedKeyContextAt` via a bounded 2-level ancestor walk rooted at `format` (`nestedParentPath`; `nearestShallowerLine` now returns a line index); `src/core/yaml-schema.ts` captures `SchemaField.formats`/`.contexts`, extracts the alias table, builds the per-format source, and adds the `frontMatterKeys(["format",fmt])` filter branch + `CURATED_FORMAT_OPTIONS` offline fallback. The provider (`src/providers/yaml.ts`) was unchanged (generic over `parentPath`). **The cell-* fold-in predicate is `tags.contexts` matches `document-*` (Quarto's `getFormatSchema`/`objectRefSchemaFromContextGlob("document-*")`), not merely `tags.formats` present** — a fidelity fix from the per-phase adversarial review (5-lens/3-refuter, 3 raised → 1 confirmed/2 refuted), grounded to an exact match with `getFormatSchema` over the real 1.7.33 schema. Strict TDD, 4 vertical layers, every guard break-revert-proven. 456 unit / 155 integration; clean 33-file `.vsix`. b2-ii (per-format VALUE) is confirmed test-only; b2-iii (deep nesting) remains deferred. (Session 34; CLAUDE.md Learning #41.)

### 2026-06-30 · [ad hoc] Backfilled (Session 150 BACKLOG audit): Phase 6d-6+ (b2-iii) deep-nesting PLAN — commit `6223e15`
- **Phase 6d-6+ (b2-iii) PLAN — deep nesting of object-valued per-format options (planning deliverable, no code)** — Authored `docs/planning/2026-06-30-phase-6d6b2iii-deep-nesting-plan.md` (46 KB), the per-slice plan for completion of sub-keys/values one or more object levels under a concrete per-format option (`format:\n  html:\n    <opt>:\n      <sub>`). Grounding **right-sized the inherited "recursive `schema.yml` walk 🐉" for the second time** (after (b2), Learning #40a): `schema/schema.yml` is the DSL meta-grammar, and deep-nested completion is a **bounded, depth- and cycle-guarded object-property resolver** — mirroring Quarto's own `navigateSchemaByInstancePath` + `getObjectCompletions` over `document-*` + `definitions.yml` — the same shape as the existing `valuesOfSchema`, NOT a meta-graph walk. An adversarial verifier **refuted** the hypothesis that b2-iii would be "free like b2-ii": it is genuine new code. Measured surface: 40 object-valued options (all `document-*`), `allOf` unused, `super` only in citation/brand, max depth 4, one reachable cycle (`about→links`). Decomposed into ~2 vertical implementation sessions. No code changed. (Session 36; `PROJECT_LEARNINGS.md` Learning #43.)
  - *Backfill provenance: this planning deliverable shipped as commit `6223e15` but no session ever wrote its ledger entry — failure mode #27. It was found by Session 150's per-item audit of `BACKLOG.md`'s completed blocks, where its only surviving record was the "Phase 6d" block being removed. Its implementation successors were correctly logged at the time (b2-iii-key and b2-iii-value below; the residual `b2-iii-deep` was descoped by operator decision in Session 120, logged above), so this entry closes the one gap in that chain.*

### 2026-06-30
- **Phase 6d-6+ (b2) PLAN — per-format options (planning deliverable, no code)** — Authored `docs/planning/2026-06-30-phase-6d6b2-per-format-options-plan.md`, the per-slice plan for completion of options under a concrete format name (`format:\n  html:\n    <opt>`). Grounding (firsthand + a 7-agent workflow with two adversarial verifiers) **dissolved the inherited "recursive `schema.yml` object-graph walk 🐉"**: per-format option scoping is a **flat `tags.formats` filter** (alias-expanded via the closed 14-entry `format-aliases.yml`, negation-aware — Quarto's own `getFormatSchema`/`useSchema`), NOT a meta-schema walk. So (b2) decomposes into ~2 vertical implementation sessions (b2-i per-format KEY, b2-ii per-format VALUE — likely test-only) with the provider unchanged; deep nesting + `super`/`allOf` (b2-iii) is the only deferred recursive-graph residue. The naive flat-union v1 is documented as a rejected anti-pattern (wrong 49–76 %/format; not even cheaper). No code changed. (Session 33; CLAUDE.md Learning #40.)
- **Phase 6e Slice 6e-5 — embedded-cell SIGNATURE-HELP forwarding (the FINAL 6e slice — 6e plan COMPLETE)** — Typing inside a call in a `{python}`/`{r}`/`{julia}`/`{ojs}` code-cell body now forwards the signature-help request — identity-mapped via the per-language `quarto-embedded://` virtual document + `vscode.executeSignatureHelpProvider` — to the user's installed language extension, returning its `SignatureHelp` **UNCHANGED**. This is the SIMPLEST request type: a single `SignatureHelp` carries no URI, no document-coordinate range (its parameter ranges are offsets within the signature label string), and no edits → there is **nothing to remap** (unlike 6e-4's URI-swap) and **nothing to merge** (unlike 6e-3's `Hover[]` collapse — signature help returns one provider's result). **The whole slice is a thin ADAPTER addition** (`EmbeddedSignatureHelpProvider` in `src/providers/embedded.ts`, registered via one `registerSignatureHelpProvider(QMD, …, ...SIG_TRIGGERS)` line — sig trigger chars `(`/`,`, distinct from completion's `.` — sharing the ONE `VirtualDocStore`); **`core/embedded/*` is UNCHANGED** — the gate `embeddedCellAt` and blanker `buildVirtualContent` are generic over request type, so there is no new core code and (correctly) **no new unit test** (the third consecutive request-type slice proving that; the new logic walks `vscode.SignatureHelp`/`SignatureHelpContext` types → adapter-only, verified via test-electron). The provider gates BEFORE any `await`, forwards the context trigger char for fidelity, and returns the command's result (or `undefined`) unchanged; off-region (prose, YAML, fence, `#|` line, unmapped cell) yields nothing; an empty upstream degrades to no signature help without throwing. Built strict-TDD (tracer RED→GREEN), with the **gate break-revert-proven** to discriminate (runtime-conditional `?? {python default}` so the build stayed clean — Learning #38d): forcing it open reds EXACTLY the 3 off-region gating tests. The faithful test suite is correctly **smaller** (5: tracer + 3 gating + degradation) than hover's 7 or def's 8 — no identity-range / pass-through / merge guard exists to write for a result with no doc-coordinate/URI/merge (don't pad with non-discriminating tests). **431 unit + 150 integration** green (+0 unit / +5 integration — all signature help); clean 33-file `.vsix` (1.3 MB, no new deps); `npm audit` unchanged (7 dev-only); `core/embedded/` stays `vscode`-free (no core change). Adversarial review (5-lens/3-refuter, 5 agents, ~455K tokens): **0 raised** (12th consecutive clean review — every lens found nothing; the lenses fetched the diff firsthand via git, no `args` inlining). **6e-1…6e-5 ALL DONE → the Phase 6e plan is COMPLETE** (diagnostics are out of scope — the technique can't forward them). The deferred Posit feature-comparison is now unblocked. (Learning #39.) (Session 32)
- **Phase 6e Slice 6e-4 — embedded-cell GO-TO-DEFINITION forwarding** — Go-to-definition on a symbol inside a `{python}`/`{r}`/`{julia}`/`{ojs}` code-cell body now forwards the request — identity-mapped via the per-language `quarto-embedded://` virtual document + `vscode.executeDefinitionProvider` — to the user's installed language extension; the returned `Location`/`LocationLink`'s vdoc URI is **swapped back to the source `.qmd`** (the ONE residual remap the 6e plan flagged — the range is identity-mapped, returned unchanged), while a definition into another file passes through. **The whole slice is a thin ADAPTER addition** (`EmbeddedDefinitionProvider` + `remapDefinitions`/`remapDefinition`/`isLocationLink` in `src/providers/embedded.ts`, registered via one `registerDefinitionProvider(QMD, …)` line sharing the ONE `VirtualDocStore`); **`core/embedded/*` is UNCHANGED** — `embeddedCellAt`/`buildVirtualContent` are generic over request type, so there is no new core code and (correctly) no new unit test (the remap walks `vscode.Uri`/`Location`/`LocationLink` types → adapter-only, verified via test-electron, like `mergeHovers`/`filterOutOfCellEdits`). The remap is **conditional** (swaps only the vdoc URI; a library-source def passes through) and handles **both result shapes** (`Location.uri` and `LocationLink.targetUri`, type-guarded on `targetUri !== undefined`); the range is identity-mapped → returned with only the URI changed; an empty/undefined upstream → `undefined` (clean no-op, never throws). The provider's heterogeneous `(Location|LocationLink)[]` return is cast once at the boundary (VS Code resolves each element at runtime — the exact shape `executeDefinitionProvider` itself returns). Off-region (prose, YAML, fence, `#|` line, unmapped cell) yields nothing. Built strict-TDD (tracer RED→GREEN — the URI-swap is RED-driven), with **four guards break-revert-proven** to discriminate, **each runtime-conditional so the build stayed clean** (a TS6133 unused-param break is a BUILD break, not a behavioral RED — Learning #33d/#38d): gate-open → exactly the 3 off-region tests; unconditional-swap → exactly the other-file pass-through; skip-the-LocationLink-branch → exactly the LocationLink test (which also proves `executeDefinitionProvider` preserves the `LocationLink` shape); mutate-the-range → exactly the range-identity test. **431 unit + 145 integration** green (+0 unit / +8 integration — all go-to-def); clean 33-file `.vsix` (1.3 MB, no new deps); `npm audit` unchanged (7 dev-only); `core/embedded/` stays `vscode`-free (no core change). Adversarial review (5-lens/3-refuter, 5 agents, ~504K tokens): **0 raised** (11th consecutive clean review — every lens found nothing; the lenses fetched the diff firsthand via git, no `args` inlining). 6e-1 + 6e-2 + 6e-3 + 6e-4 done; **6e-5 signature help** (no remap — single `SignatureHelp`, sig trigger chars `(`/`,`) is the last optional 6e slice, after which the 6e plan is complete. (Learning #38.) (Session 31)
- **Phase 6e Slice 6e-3 — embedded-cell HOVER forwarding** — Hovering a symbol inside a `{python}`/`{r}`/`{julia}`/`{ojs}` code-cell body now forwards the request — identity-mapped via the per-language `quarto-embedded://` virtual document + `vscode.executeHoverProvider` — to the user's installed language extension, returning its hover UNCHANGED. **The whole slice is a thin ADAPTER addition** (`EmbeddedHoverProvider` + `mergeHovers` in `src/providers/embedded.ts`, registered via `registerHoverProvider(QMD, …)` sharing the ONE `VirtualDocStore`); **`core/embedded/*` is UNCHANGED** — `embeddedCellAt`/`buildVirtualContent` are generic over request type, so there is no new core code and (correctly) no new unit test (the new logic walks `vscode.Hover` types → verified via test-electron, like `filterOutOfCellEdits`). `vscode.executeHoverProvider` returns a `Hover[]` (one per contributing provider); `mergeHovers` `flatMap`s every hover's `.contents` into the single `Hover` VS Code expects from one provider and keeps the first range — identity-mapped, so it is a valid `.qmd` range returned with **no remap** (hovers carry no URI, unlike 6e-4 definitions); an empty/undefined upstream result → `undefined` (clean no-op, never throws). Off-region (prose, YAML, fence, `#|` line, unmapped cell) yields nothing; **no degradation hint in hover** (the completion provider owns the one-time `getLanguages()` hint — hover deliberately doesn't re-nag). Built strict-TDD (tracer RED→GREEN), with the gate (3 off-region tests), the identity-range passthrough, and the multi-hover merge each **break-revert-proven** to discriminate. **431 unit + 137 integration** green (+0 unit / +7 integration — all hover); clean 33-file `.vsix` (1.3 MB, no new deps); `npm audit` unchanged (7 dev-only); `core/embedded/` stays `vscode`-free (no core change). Adversarial review (5-lens/3-refuter, 11 agents, ~898K tokens): **0 confirmed** (10th consecutive clean review); the two refuted tests-lens niceties on `mergeHovers` (the empty/degradation branch + the multi-hover merge path) were applied test-first. 6e-1 + 6e-2 + 6e-3 done; 6e-4 go-to-def (URI-swap remap) / 6e-5 signature help remain optional same-mechanism follow-ons. (Learning #37.) (Session 30)
- **Phase 6e Slice 6e-2 — `{r}` / `{julia}` / `{ojs}` completion forwarding + graceful degradation** — Extends 6e-1 to all four mapped languages. Completion inside an `{r}`, `{julia}`, or `{ojs}` code-cell body now forwards the cursor — identity-mapped — into the user's installed **R / Julia / Observable-JS** extension via the same per-language `quarto-embedded://` virtual document + `vscode.executeCompletionItemProvider`; when no matching extension is registered it degrades cleanly (no crash) with a **one-time, non-blocking** "install the … extension" hint. **A whole capability from a DATA change:** the forwarding slice was purely growing the pure `cellLanguageId` map (`r→{r,.r}`, `julia→{julia,.jl}`, `ojs→{javascript,.js}`, plus a `js→javascript` alias) — `embeddedCellAt`/`buildVirtualContent` are generic over the map and `src/providers/embedded.ts` was UNCHANGED for forwarding (like Sessions 23/25/32 where the provider branch was already generic). **The ojs token≠languageId dragon** (engine token `ojs` → languageId `javascript`, ext `.js`; R7) is mapped, not assumed — and proven end-to-end: the `{ojs}` integration test asserts the `.js` virtual document resolves to languageId `javascript` in the bare host. **Graceful degradation** is the §3.3 split: a pure `needsLanguageExtension(languageId, registered) = !registered.includes(languageId)` (keyed on `vscode.languages.getLanguages()`, **never on an empty completion result** — an installed extension returns empty mid-token, so keying on emptiness would nag; §9 Q6) + a thin one-time hint in the provider (`javascript`/`python` are built-in so `{ojs}`/`{python}` never hint; non-blocking, never throws). The multi-language virtual document already preserves cross-cell same-language state (an `import` in one `{python}` cell is visible to the next). Built strict-TDD across **2 vertical slices** (forwarding → degradation), checkpoint-committed at each boundary; the two 6e-1 deferral shape-locks were flipped (Learning #29c). **§9 Q8 split resolved:** `.js` (ojs) resolves to languageId `javascript` (built-in language-basics), but `.r`/`.jl` likely do NOT → their `{scheme:"quarto-embedded"}`-keyed stand-ins fire regardless; the REAL r/julia feature needs the user's extension installed. **431 unit + 130 integration** green (+13 unit / +2 integration); clean 33-file `.vsix` (1.3 MB, no new deps); `npm audit` unchanged (7 dev-only); `core/embedded/` stays `vscode`-free. **Gate-d:** the `{julia}` degradation test was strengthened (per the review) so a scheme stand-in records the call (proving the forward ran — `calls.length===1`) while returning no items, and **break-revert-proven** — removing the `julia` map entry reds exactly that test on `calls.length 0!=1` (Learning #29d). Adversarial review (5-lens/3-refuter, 8 agents, ~772K tokens): **1 raised → 0 survived** (9th consecutive clean review; fidelity/gating/degradation/scope lenses found zero; the one tests-lens finding was applied test-first as the strengthening above). 6e-1 + 6e-2 together are a complete, shippable 6e *completion* milestone; 6e-3 hover / 6e-4 go-to-def / 6e-5 signature help remain optional same-mechanism follow-ons. (Learning #36.) (Session 29)
- **Phase 6e Slice 6e-1 — Python completion forwarding + shared infra (the tracer bullet)** — The first 6e implementation slice. Typing inside a `{python}` code cell body now forwards the cursor — identity-mapped — into the user's installed **Python extension** via a per-language **virtual document** (`quarto-embedded://` scheme) + `vscode.executeCompletionItemProvider`, returning its completions; nothing leaks onto prose / YAML / fence lines / `#|` option lines / `{r}` cells, and an out-of-cell auto-import edit can never corrupt the front matter. **MIT-clean** (forwards to the user's own extension — same posture as Phase 5 run-cell; no code copied, no dependency bundled, `dependencies` stays `{}`). Per §3.3 the logic is pure `vscode`-free core: `src/core/embedded/lang-map.ts` (`cellLanguageId` — engine→languageId, python only) + `src/core/embedded/virtual-doc.ts` (`embeddedCellAt` — the cursor BODY-gate; `buildVirtualContent` — the length-preserving whole-document blanker that keeps matching cell bodies verbatim and blanks every other line to an equal-length space run, newlines preserved, built line-based from the raw text so it is CRLF-safe — the plan's "identity offset mapping", `result.length === text.length`). Both are **views over the shared `scanRegions` model** (no 2nd scanner — Learning #14). The thin adapter `src/providers/embedded.ts` (`registerEmbeddedLanguageFeature`, wired in `extension.ts`) holds all `vscode` types: a `VirtualDocStore` content provider + an `EmbeddedCompletionProvider` (`{language:"quarto"}` selector, trigger `.`) that gates via `embeddedCellAt` BEFORE any await (the disjoint complement of the YAML `#|`/front-matter and `@` prose providers — the recurring Learning #15b cross-pollination trap, here in its third provider), builds the vdoc, forwards, then `filterOutOfCellEdits` strips any out-of-cell `additionalTextEdits` (an auto-import anchored at the vdoc module top would otherwise identity-map to the front matter). Built strict-TDD across **3 vertical layers** (pure core → adapter+wiring → integration), checkpoint-committed at each boundary. **418 unit + 128 integration** green (+13 unit / +7 integration); clean 33-file `.vsix` (1.3 MB, no new deps); `npm audit` unchanged (7 dev-only). **§9 Q8 resolved empirically:** the `.py` virtual document resolves to languageId `python` in the bare `@vscode/test-electron` host (built-in python language-basics ships the `.py` association), so the Learning #13b stand-in — keyed by `{scheme:"quarto-embedded"}` and capturing the invoked URI + languageId + vdoc text — proves the request routed THROUGH the vdoc, not a direct quarto-doc hit. **Gate-d:** FOUR guards break-revert-proven discriminating — the fence-exclusion + `#|`-exclusion (core units), the gate itself (forcing it open reds exactly the 4 gating integration tests, which otherwise passed trivially while the feature was absent — Learning #9), and the corruption filter (broken by compute-but-don't-apply so the build stayed clean — Learning #33d); plus an **edit-sync regression** that PROVES rebuild-per-request defeats staleness (VS Code re-queries the content provider per `executeCompletionItemProvider`; the assertion fails on stale content), validating the plan's §2.4 mitigation rather than assuming it. **Design note:** the vdoc Map is keyed by the canonical `uri.toString()` (symmetric by VS Code's document-identity contract), not the plan §5 sketch's `uri.path.slice(1)` (which trips `Uri.parse` path-decoding — the same class as the sample's hardcoded `-4`); eviction is via an owners index, not substring matching. Adversarial review (17 agents, ~1.4M tokens): **4 raised → 0 confirmed** (8th consecutive clean review; fidelity/gating/scope lenses found zero); two refuted-but-worthwhile niceties applied (the both-directions corruption test + the edit-sync regression); two refuted robustness findings backlogged as secondary-edit-filter defense-in-depth (`command` + divergent primary `textEdit`, the latter structurally impossible — VS Code clamps a primary completion range to the cursor line). A voluntary "inspired-by" NOTICE attribution was added for the MIT VS Code embedded-languages guide + `vscode-extension-samples`. The completion-popup *visual* is F5-only residue; behavior/wiring is integration-proven. **6e-2 (r/julia/ojs + graceful degradation) reuses all of this** — only `cellLanguageId` grows + a degradation hint. (Learning #35.) (Session 28)
- **Phase 6e — embedded-cell language completion: implementation plan** (planning session, no code) — Wrote `docs/planning/2026-06-29-phase-6e-embedded-cell-completion-plan.md`, decomposing the parent architecture plan's one-line 6e 🐉 into vertical slices. **Technique decision (the dragon tamed):** a thin `{language:"quarto"}` provider forwards completion/hover/definition requests into the user's already-installed Python/R/Julia/OJS extension via a per-language **virtual document** + `vscode.executeCompletionItemProvider` — using the MIT VS Code "Embedded Languages" guide's **whole-document blanking → identity offset mapping** (one vdoc per languageId; every non-embedded char → an equal-length space, newlines preserved), so the feared bidirectional offset math collapses to ONE pure, headlessly-testable `buildVirtualContent` and cross-cell same-language state is preserved — NOT per-cell extraction. **MIT-clean** (forwards to the user's own extensions, same posture as Phase 5 run-cell; nothing copied or bundled; a voluntary NOTICE attribution like the mjbvz grammar precedent). **Scope = 5 vertical slices:** 6e-1 python completion + shared infra (the tracer) → 6e-2 r/julia/ojs + graceful degradation → 6e-3 hover → 6e-4 go-to-definition (the one residual URI-swap remap) → 6e-5 signature help; diagnostics are out of scope (the technique structurally can't forward them) and no LSP is needed. The plan carries a **grep-verified reuse/gaps inventory** (file:line; reuses the shared `scanRegions` cell model, the YAML provider's gating template, and the Phase-5 stand-in test pattern; flags 5 gaps incl. the missing "cursor in a cell BODY" predicate), the **pure-core interface contracts** (`core/embedded/lang-map.ts`, `core/embedded/virtual-doc.ts`, `providers/embedded.ts`), and the load-bearing traps — a HIGH **secondary-edit corruption** hazard (an auto-import `additionalTextEdits` identity-maps to the front matter; region-filter via `embeddedCellAt`), the recurring **provider cross-pollination** trap (now in its third provider — gate to cell body only, before any await), and the gate-d **faithful-stand-in** requirement (the bare test host has no python/r/julia extension). Produced via a 6-agent investigate+ground workflow + a 6-lens refute-by-default review of the draft (17 raised → 10 confirmed, materially reshaping it). **At close-out, an independent 6-agent fan-out re-greped all 30 inventory citations: 29 verbatim, 2 corrected** (a `core/`→`src/providers/citation.ts:99` path and a `§3`→`§6` section label). **Implementation is separate sessions, one slice each, strict TDD — start with 6e-1.** (Learning #34.) (Session 27)

### 2026-06-29
- **Phase 6d Slice 6d-6+ (continuation, b1) — top-level `format:` scalar value completion** — Inside the YAML front matter, after the colon on the top-level `format:` key (`format: <here>`), the provider now offers Quarto **output-format names** (`html`, `pdf`, `docx`, `revealjs`, `beamer`, `typst`, …) as the value — the small adjacent win flagged in Session 25's handoff. Previously this offered nothing useful because the flat `schema/document-*.yml` models `format` only as a same-named **epub-scoped string** field with no value enum (a name collision; the only `format` doc-field is `document-epub.yml` `schema:"string"`). The fix is **pure-core, one change**: `src/core/yaml-schema.ts` `indexOf` enriches the top-level `format` field's `.values` with the format names (the same reader-derived-or-curated set offered as KEYS one level under `format:`), **derived into a new `topLevelFields` list so the raw curated/parsed arrays stay untouched**, serving BOTH the parsed reader and the curated fallback. The **context AND provider were both unchanged** — the 6d-5 `frontmatter-value` context already returns `parentPath:["format"]` for a top-level `format:` value, and the provider's generic value branch already resolves `frontMatterKeys([]).find(name).values`. Reader-derived (so it tracks the user's Quarto), degrading to the curated `CURATED_FORMAT_NAMES` subset offline. Built strict-TDD across **2 vertical layers** (pure-core data enrichment → integration verification), checkpoint-committed at each. **405 unit + 121 integration** green (+2 unit / +5 integration); clean 33-file `.vsix`; `npm audit` unchanged (7 dev-only, no new deps). **Gate-d:** the reader test asserts the reader-only `docbook`/`texinfo` (absent from the curated fallback); a **runtime-conditional** `quartoSharePath`-throw break-revert reds ONLY the `texinfo` enrichment test ("got exactly the 14 curated formats") while the `html` positive and the no-leak control stay green from curated — proving the values are reader-derived AND degrade. (The break must be runtime-conditional: a first attempt with an unconditional early `throw` broke *compilation* via unreachable-code type-narrowing, so the test never ran — a build break is not a behavioral RED.) Adversarial review (5 agents, ~440K tokens): **0 findings raised** (7th consecutive clean review). The completion-popup *visual* is F5-only residue; behavior/wiring is integration-proven. (Learning #33.) (Session 26)
- **Phase 6d Slice 6d-6+ (continuation) — `format:` → format-name nested completion** — Inside the YAML front matter, on an indented key line one level under `format:`, the provider now offers Quarto **output-format names** (`html`, `pdf`, `docx`, `revealjs`, `beamer`, `typst`, … — 65 visible). Unlike the curated-only `execute:` children, the FULL format list is **reader-derived** from the user's **installed** Quarto schema: `core/yaml-schema.ts` `collectFormatNames` reads the live `pandoc/formats.yml` list, concatenates Quarto's synthesized formats (`md`/`hugo`/`dashboard`/`email`), and drops the hidden legacy variants (`html4`/`html5`, `epub2`/`epub3`, `docbook4`/`docbook5`) — replicating Quarto's own `makeFrontMatterFormatSchema` (found in the installed `editor/tools/yaml/web-worker.js`) — so format completion tracks the user's Quarto version, degrading to a curated `CURATED_FORMAT_NAMES` subset offline. **Design distinction:** format names HAVE a clean readable list, so reader-derived + curated fallback is the faithful choice (the 6d-3 pattern), whereas the `execute:` children are curated-only (no single readable list). Per §3.3 all new logic is pure `vscode`-free core: `src/core/yaml-context.ts` added `"format"` to `NESTED_CONTAINERS` (one allow-list entry — the Session 23 nested KEY+VALUE detector already generalizes over the container, bailing on per-format-option deeper nesting); `src/core/yaml-schema.ts` added `collectFormatNames`/`isHiddenFormat`/`FORMAT_SYNTHESIZED`/`CURATED_FORMAT_NAMES` and an `indexOf` 3rd `formatFields` param serving `frontMatterKeys(["format"])`. **`src/providers/yaml.ts` was unchanged** — its `frontmatter-key` branch already queries `frontMatterKeys(ctx.parentPath)` generically (like Session 23). Per-format options (the level under a format name), deeper nesting, and the top-level `format: html` scalar are deferred (FM #18). Built strict-TDD across **3 vertical layers** (detector allow-list → reader+curated data → provider+integration), checkpoint-committed at each boundary. **403 unit + 116 integration** green (+12 unit / +7 integration); clean 33-file `.vsix`; `npm audit` unchanged (7 dev-only, no new deps). **Gate-d:** the detector allow-list was break-revert-proven (dropping `"format"` reds the 3 positive format unit tests); the integration enrichment uses `texinfo` (reader-only, absent from the curated fallback) and a `quartoSharePath`-throw break-revert reds ONLY `texinfo` ("got exactly the 14 curated formats") while the curated-served positives stay green — proving the reader ran AND the fallback serves; a `revealjs`-not-at-top-level paired control proves no cross-pollution (no format name collides with a top-level document key — verified firsthand). Adversarial review (20 agents, ~1.53M tokens): **5 raised → 0 confirmed** (6th consecutive clean review); the one applied item made the unit hide-filter assertions fully discriminating (added all six legacy variants to the fixture so each `not.toContain` can fail). The completion-popup *visual* is F5-only residue; behavior/wiring is integration-proven. (Learning #32.) (Session 25)
- **Phase 6d Slice 6d-6 (continuation) — nested `execute:` VALUE completion** — The value-side complement of the nested-KEY slice. Inside the YAML front matter, on an indented line one level under `execute:`, after a known execute child-key `key:`, the provider now offers that child's grounded value enum: `echo: ` → `true`/`false`/`fenced`, `output: ` → `true`/`false`/`asis`, `cache: ` → `true`/`false`/`refresh`, `freeze: ` → `true`/`false`/`auto`, and the remaining children (`eval`/`warning`/`error`/`include`/`enabled`/`daemon`/`daemon-restart`/`keep-md`/`keep-ipynb`) → `true`/`false` (`daemon`'s number-timeout form is non-enumerable). Values are grounded firsthand against the installed Quarto 1.7.33 schema and are **curated-only** — the same source as the nested keys (`frontMatterKeys(["execute"])` = `CURATED_EXECUTE_KEYS`), consistent with the curated-only nested-KEY decision. Per §3.3 the new logic is pure `vscode`-free core: `src/core/yaml-context.ts` `nestedKeyContextAt` gained a value branch (past the colon → `{frontmatter-value, parentPath:[container, key]}`), and the value-slot grammar was extracted into a shared `valueSlotAfterColon(lineText, colon)` helper now used by BOTH `topLevelSlots` and the nested path (one value-slot grammar; `model.ts` `slotsOf` remains a separate mirror — consolidation is BACKLOG). `src/core/yaml-schema.ts` `CURATED_EXECUTE_KEYS` gained grounded `values` on all 13 children (exact full-set equality test — Learning #26). `src/providers/yaml.ts` generalized the `frontmatter-value` branch from `frontMatterKeys([])` to `frontMatterKeys(ctx.parentPath.slice(0,-1))` — ONE line that resolves both a top-level value (path `[key]` → `[]`) and a nested value (path `["execute",key]` → `["execute"]`), reusing the entire 6d-2/6d-5 value path (`valueItems`, leading-space-on-`:`, whole-token replace range) with no new value machinery. Built strict-TDD across **3 vertical layers** (detector → curated values → provider+integration), checkpoint-committed at each boundary. **391 unit + 109 integration** green (+6 unit / +7 integration); clean 33-file `.vsix`; `npm audit` unchanged (7 dev-only, no new deps). **Gate-d (the load-bearing catch):** `cache`/`freeze`/`enabled`/`daemon`/`daemon-restart`/`keep-md`/`keep-ipynb` are literal entries in `schema/document-execute.yml`/`document-render.yml`, so the flat `frontMatterKeys([])` already contained them — naive `cache`/`freeze` tests passed even with the OLD provider (a non-faithful baseline). A firsthand schema probe confirmed the cell-shared flags (`echo`/`eval`/`output`/`warning`/`error`/`include`) are absent from every `document-*` file, so the `echo:` nested-value test is the faithful discriminator (RED with `frontMatterKeys([])`, GREEN only via `frontMatterKeys(["execute"])`); the detector value branch was separately break-revert-proven. Adversarial review (8 agents, ~690K tokens): **1 raised → 0 confirmed** (5th consecutive clean review; 4 of 5 lenses found nothing); the one applied item keyed the non-container negative on enum-bearing `cache` so a value-gate leak would surface values (Learning #29e). The completion-popup *visual* is F5-only residue; behavior/wiring is integration-proven. (Learning #31.) (Session 24)
- **Phase 6d Slice 6d-6 (v1) — nested KEY completion under the `execute:` container** — The first nested slice and the plan's "cheap one-level approximation". Inside the YAML front matter, on an indented line one level under `execute:`, the provider now offers the execute child-keys (`echo`/`eval`/`output`/`warning`/`error`/`include`/`cache`/`freeze`/`enabled`/`daemon`/`daemon-restart`/`keep-md`/`keep-ipynb`) from a curated, grounded set with our own descriptions. The position detector is deliberately conservative — it offers nested keys ONLY when nesting is unambiguous and **bails (`null`) on anything else** (non-allow-listed container, scalar/block-scalar/flow parent value, deeper nesting, sequence item, value position) rather than offer wrong keys (plan §7). Per §3.3, all new logic is pure `vscode`-free core: `src/core/yaml-context.ts` `frontMatterContextAt` now takes the full document text (so it can scan upward) and falls through to new `nestedKeyContextAt` + `nearestShallowerLine` gated by an allow-list `NESTED_CONTAINERS = {execute}`; `src/core/yaml-schema.ts` gained `CURATED_EXECUTE_KEYS` (13), served by `SchemaIndex.frontMatterKeys(["execute"])` for BOTH the parsed and the curated index. **The execute children are curated-only in v1**: Quarto assembles the execute object across 5 schema files via a `document-execute` context glob (`cell-codeoutput`/`cell-textoutput` shared flags enter via a context tag; the same-named knitr `cache` in `cell-cache.yml` is excluded; `document-execute`/`document-render` supply the rest) with no single readable list, and `quarto render` validation is lenient — so a curated grounded set is the faithful v1 (mirrors 6d-1 curated → 6d-3 reader), with the recursive live-schema assembly deferred. **`src/providers/yaml.ts` was unchanged** — its `frontmatter-key` branch already queries `frontMatterKeys(ctx.parentPath)` generically. Built strict-TDD across **3 vertical layers** (detector → curated schema → provider+integration), checkpoint-committed at each boundary. **385 unit + 102 integration** green (+13 unit / +6 integration); clean 33-file `.vsix`; `npm audit` unchanged (7 dev-only, no new deps). The two load-bearing detector guards (allow-list, scalar-parent bail) were **break-revert-proven**; faithfulness end-to-end is proven by a paired positive/negative control — `echo`/`eval` are cell-shared flags absent from every `document-*` file (verified firsthand), so they appear ONLY under `execute:` and never at the top level. Adversarial review (11 agents, ~876K tokens): **2 raised → 0 confirmed** (4th consecutive clean review; 3 of 5 lenses found nothing); the one applied item corrected a docstring source-file attribution for `cache` (verified firsthand against Quarto's assembly logic). The completion-popup *visual* is F5-only residue; behavior/wiring is integration-proven. (Learning #30.) (Session 23)
- **Phase 6d Slice 6d-5 — front-matter top-level VALUE completion** — The value-side complement of 6d-4. Inside the YAML front matter, after a known top-level `key:`, the provider now offers that key's enum/boolean values — `toc: true/false`, `number-sections: true/false`, and schema-resolved enums such as `editor: source/visual` and `engine: jupyter/knitr` — read from the user's **installed** Quarto schema, degrading to curated `toc`/`number-sections` booleans when the schema can't be read. Gated as the complement of the cell-option value provider (no document-value items in prose/code/cells, none for a free-text key; `@` completion stays suppressed in front matter). Per §3.3, all new logic is pure `vscode`-free core: `src/core/yaml-context.ts` `topLevelKeySlot` became `topLevelSlots` (computing the key AND value token spans on a top-level front-matter line, mirroring the cell-option `slotsOf` value grammar — skip leading whitespace, strip an unquoted trailing inline comment, keep quoted scalars), and `frontMatterContextAt` returns a `frontmatter-value` context (with `parentPath` carrying the key being valued) past the colon. `src/core/yaml-schema.ts` gave the curated `toc`/`number-sections` keys `values: [true, false]` for the offline fallback. **The runtime schema reader was unchanged** — it already resolves document-key value enums (`parseSchemaIndex` → `toField` → `valuesOfSchema`, reused since 6d-3/6d-4; 173 of 378 visible document fields carry resolvable values). `src/providers/yaml.ts` handles the `frontmatter-value` kind by offering the top-level key's values from `frontMatterKeys([])`, reusing the cell-option value path (`valueItems`/`valueItem` parameterized by a `detail` string → `"Quarto document option value"`, the same leading-space-on-`:` normalization and whole-token replace range). Strict TDD across **3 vertical layers** (context discriminator → curated values + reader contract → provider + integration), checkpoint-committed at each boundary. **372 unit + 96 integration** green (+11 unit / +8 integration); clean 33-file `.vsix`; `npm audit` unchanged (7 dev-only, no new deps). **Gate-d proven by a `quartoSharePath`-throw break-revert**: the schema-only `editor`→source/visual enrichment test reds while curated `toc` value completion stays green (a meta-lesson recorded — Learning #29d — after a first break that used an ignored CLI flag and falsely stayed green). Adversarial review (12 agents, ~970K tokens): **2 raised → 0 confirmed** (3rd consecutive clean review); the one applied item hardened the prose gating test to key on an enum-bearing key. The completion-popup *visual* is F5-only residue; behavior/wiring is integration-proven. (Learning #29.) (Session 22)
- **Phase 6d Slice 6d-4 — front-matter top-level KEY completion** — The first front-matter slice. Inside the YAML front matter (the leading `---`…`---`), typing a top-level key now offers document-key suggestions (`title`, `author`, `format`, `bibliography`, `toc`, `csl`, …) read from the user's **installed** Quarto schema (`schema/document-*.yml` — the 378 visible flat names), degrading to a curated `CURATED_FRONTMATTER_KEYS` set when the schema can't be read. It is the COMPLEMENT of the cell-option provider on the shared `{language:"quarto"}` selector, gated so the two never cross-pollute (no document-option items in prose/code/cells/nested/value positions; `@` cross-ref/citation completion stays suppressed in front matter). Per §3.3, all new logic is pure `vscode`-free core: `src/core/qmd/model.ts` gained the missing front-matter region surface — `findFrontMatter` (fence-inclusive span), `inFrontMatter` (interior-content predicate), `frontMatterContentLines` (interior lines) — as **views over the single `scanRegions` pass** (a `FrontMatterSpan` captured in that pass; no second scanner — Learning #14), with a break-revert-proven agreement guard; `src/core/frontmatter.ts`'s duplicate `---` parser was **folded** onto `frontMatterContentLines` and deleted. `src/core/yaml-context.ts` gained a `frontmatter-key` branch (`topLevelKeySlot` — column-0 keys only; indented/nested, value-position, block-sequence, comment, and fence lines all yield null). `src/core/yaml-schema.ts` gained `SchemaIndex.frontMatterKeys(parentPath)` (top-level for the document root, `[]` for nested), collected via a shared `collectFields(data, prefix, defs)` over `schema/document-*` (hidden excluded; whole-index degradation to curated), plus `CURATED_FRONTMATTER_KEYS` (13 keys, own descriptions). `src/providers/yaml.ts` serves them tagged `detail:"Quarto document option"`. **No new dependency** — the entire 6d-3 reader/cache/fallback adapter is reused untouched. Known limitation: pure CONTAINER keys like `execute` are NOT in the flat `document-*` name list (they live in `schema/schema.yml`'s object graph — recursive resolution deferred to 6d-6), so `execute` is offered only from the curated fallback (offline), not when the live schema reads. Built strict-TDD across **6 vertical layers** (checkpoint commit each, ≤5 files), full matrix green at each boundary. A **5-lens / 3-refuter refute-by-default adversarial review** (14 agents, ~881K tokens) ran: **3 raised → 0 confirmed** (the second 6d slice with a clean review); the one real fix was a docstring-precision correction (`format` IS in the flat list — only `execute` is the clean container-omission example). Verified: **+35 vitest cases** (14 front-matter model + 9 FM-key context + 4 curated FM + 7 FM parse/degradation; **361 total**) + **7 new `@vscode/test-electron` cases** (top-level keys complete in front matter; a schema-only key `csl` proves the reader enriched the FM set end-to-end; both-direction gating; **88 total**); **gate-d proven by TWO break-reverts** (disabling the front-matter skip reds the agreement guard via a phantom heading+cell; breaking `quartoSharePath` reds the `csl` enrichment test while the curated FM keys keep serving). Clean **33-file** `.vsix` (1.3 MB); `npm audit` unchanged at 7 (no new deps); §3.3 guardrail intact. The completion-popup *visual* is F5-only residue; behavior/wiring is integration-proven. (Learning #28.) (Session 21)
- **Phase 6d Slice 6d-3 — YAML cell-option schema READER (the 🐉 dragon slice)** — Cell-option completion now reads the user's **INSTALLED** Quarto schema (`<share>/editor/tools/yaml/yaml-intelligence-resources.json`) instead of only the curated set: typing `#| ` in an executable cell offers the **full** option set (94 visible of 97, `hidden` excluded) with descriptions, and a known option's value enum is **resolved from the live schema** (e.g. `column` → all 18 `page-column` values, resolved from `schema/definitions.yml` — so there is no hand-transcription to drop a value). Options are **engine-filtered** (knitr-only options no longer offered in `{python}`/`{ojs}` cells; unknown engine → full set). On ANY failure — Quarto absent, the undocumented `quarto --paths` shape changed, the file missing/unreadable, the JSON malformed — it **degrades to the curated `CURATED_CELL_OPTIONS` fallback**, never an error (completion-only, never-throw). This SWAPS the data source behind the provider; the detection (`findCellOptionLines`), position discriminator (`completionContextAt`), and inverted gating (plan §4.3) are unchanged, and the `values`/`valueSlot`/value-branch surface from 6d-2 is reused intact. Runtime-read means **zero version drift, +0 `.vsix` bytes, and no NOTICE** (nothing redistributed — the schema is MIT, in the CLI the extension already depends on). Per §3.3, two NEW pure `vscode`-free core modules: `src/core/quarto-paths.ts` `parseSharePath(stdout)` (defensively parses the **undocumented** `quarto --paths` — last `…/share` line, else last non-empty) and `src/core/yaml-schema.ts` `parseSchemaIndex(jsonText)→SchemaIndex` (BOM-strip; resolves only the SIMPLE value forms — `boolean`/`enum`/`anyOf`-of-those/`maybeArrayOf`-of-those/`ref` one hop/`string.completions`, deferring `arrayOf`/deep `super`-`resolveRef`, which the real schema confirms are non-enumerable; non-string enum values stringified, e.g. `true`→`"true"`; `tags.engine` string|list; `hidden`/`document-*` excluded; never throws → `CURATED_SCHEMA_INDEX`). Thin adapters: `src/quarto/cli.ts` `quartoSharePath()` (spawns `--paths`) and `src/features/yaml-schema-source.ts` (caches the load once per session, degrades to curated on any spawn/read failure); `src/providers/yaml.ts` became **async** and serves both keys and values from `index.cellOptions(engine)`. Built strict-TDD across **5 vertical layers** (checkpoint commit each, ≤5 files), full matrix green at each boundary. A **5-lens / 3-refuter refute-by-default adversarial review** (26 agents) then ran: **7 raised → 0 confirmed** — the fidelity lens found **zero** value-resolution defects (the first 6d slice with a clean review; corroborated by an independent python resolver mirrored over the real file). The one real fix was a stale module docstring (refreshed); the hang/cache-pinning/marker-list items are documented + BACKLOG (the hung-spawn risk is a pre-existing project-wide spawn posture, not a 6d-3 regression). Verified: **29 new vitest cases** (6 `parseSharePath` + 23 `parseSchemaIndex`; **326 total**) + **2 new `@vscode/test-electron` cases** (a schema-only key + its value enum appear end-to-end in the host; **81 total**); **gate-d degradation proven by a documented break-revert** of `quartoSharePath` (the 2 enrichment tests red while curated keeps serving). Clean **33-file** `.vsix` (1.29 MB; new core bundled); `npm audit` unchanged at 7 (no new deps — `node:fs` is built-in); §3.3 guardrail intact. The completion-popup *visual* is F5-only residue; behavior/wiring is integration-proven. (Learning #27.) (Session 20)

### 2026-06-28
- **Phase 6d Slice 6d-2 — `#|` cell-option VALUE completion (second 6d slice)** — After a known cell-option key's colon, typing on a `#|` (python/r/julia) or `//|` (ojs/js) line now offers that option's **value** enum: booleans (`eval`/`warning`/`error`/`include`/`cache` → `true`/`false`), `echo` (`true`/`false`/`fenced`), `output` (`true`/`false`/`asis`), `code-fold` (`true`/`false`/`show`), `fig-align` (`default`/`left`/`right`/`center`), and `column` (the full 18-value `page-column` enum). Values fire ONLY in the value slot (after the colon) and are suppressed at the key, in prose, in code, in front matter, for an unknown key, and inside a trailing inline comment — the same inverted-gating contract as 6d-1 (plan §4.3); `@` completion still works in prose. Free-text/numeric options (`label`, `fig-cap`, `code-summary`, `layout-ncol`) offer no values. When the value abuts the colon (the `:` trigger fires before a space is typed), the inserted text is prefixed with a space so accepting yields valid `key: value` YAML. The runtime schema reader (full set + descriptions + resolved enums) remains the later Slice 6d-3 — this ships curated enums grounded in the live Quarto 1.7.33 schema. Per §3.3 the slice grew the same pure modules: `src/core/qmd/model.ts` `findCellOptionLines` gained a `valueSlot` span (computed in one `slotsOf` pass with `keySlot`; terminated at an unquoted YAML inline comment, quoted scalars left intact), `src/core/yaml-context.ts` `completionContextAt` gained a `cell-option-value` branch (`parentPath:[key]`, a `replaceRange` over the whole value token), and `src/core/yaml-schema.ts` `CURATED_CELL_OPTIONS` gained grounded `values`; `src/providers/yaml.ts` is the thin adapter (value items tagged `detail:"Quarto cell option value"`; leading-space normalization decided from the live line; `filterText` kept bare so fuzzy matching works). Built strict-TDD with a checkpoint commit per layer (model → context → data → provider), each at a green full matrix. A **5-lens / 3-refuter refute-by-default adversarial review** (4 raised → **4 confirmed / 0 refuted**) then hardened it, both distinct defects fixed test-first: the curated `page-column` enum had **17 of 18 values** (the base `page-inset` was dropped transcribing the probe output — and the `column` test's `toContain` spot-check, unlike its `toEqual` siblings, missed it; fixed the value AND tightened the test to full-enum exact equality), and `slotsOf` swallowed a **trailing inline comment** into the value span (so values popped while editing the comment and accepting one clobbered it; fixed to terminate the value at the unquoted comment start, with model + context + integration regression tests). Verified: 24 new vitest cases (**297 total**) + 9 `@vscode/test-electron` cases (**79 total**) via `executeCompletionItemProvider` — positive value cases proven RED→GREEN, the inverted-gating negatives proven faithful by the RED baseline, edge cases (no-space leading space, unknown key, prose colon, inline comment) tested on in-memory `openTextDocument` docs that genuinely exercise the registered provider. Clean **33-file** `.vsix` (1.29 MB; new core bundled); `npm audit` unchanged at 7 (no new deps); §3.3 guardrail intact (no `vscode` import in `core/`). The completion-popup *visual* appearance is F5-only residue; behavior/wiring is integration-proven. (Learning #26.) (Session 19)
- **Phase 6d Slice 6d-1 — `#|` cell-option KEY completion (first 6d slice)** — Typing on a `#|` (python/r/julia) or `//|` (ojs/js) cell-option line inside an executable cell now offers cell-option **key** suggestions (`echo`, `eval`, `output`, `warning`, `label`, `fig-cap`, …) from a curated set with descriptions; the list fires ONLY in a key slot and is suppressed in prose, code, value positions, and front matter (the inverse of the `@` providers' prose gate — plan §4.3), while `@` cross-ref/citation completion still works in prose. The runtime schema reader (full 97-option set) is the later Slice 6d-3 — this slice ships the curated fallback 6d-3 degrades to. Per §3.3 the logic is pure/`vscode`-free in three modules: `src/core/qmd/model.ts` `findCellOptionLines` (a **view over the shared `findAllCells` scanner** — Learning #14, no 2nd scanner — so a `#|` in prose / a non-executable ```` ```python ```` block / a fence line is never reported; `CELL_OPTION_PREFIX` matches Quarto's real `^#\s*\| ?` directive — column-0-anchored, whitespace allowed between the comment char and the pipe), `src/core/yaml-context.ts` `completionContextAt(text, offset)` (the position discriminator — a `cell-option-key` context or `null` off-region), and `src/core/yaml-schema.ts` (`SchemaField` + `CURATED_CELL_OPTIONS`, ~18 names verified against the live Quarto 1.7.33 schema with our own descriptions → license-clean). `src/providers/yaml.ts` `YamlCompletionProvider` is the thin adapter (gated to the key slot; triggers `| : -`; items tagged `detail:"Quarto cell option"`; `{inserting,replacing}` range so a mid-token accept doesn't duplicate the suffix). Built strict-TDD (16 cell-option-lines + 11 yaml-context + 4 yaml-schema behaviors). A **5-lens / 3-refuter refute-by-default adversarial review** (8 raised → **3 confirmed / 5 refuted**) then hardened it, all fixes test-first: the prefix regex **over-detected indented `#|`** (Quarto treats an indented directive as code) and **under-detected `# |`** (Quarto's `\s*` allows the gap) — both fixed by aligning to Quarto's actual `optionCommentPattern` (verified against the installed CLI source + an empirical `quarto render`); and **two "skip-region agreement" unit tests were trivially green** (fenceless fixtures passed for the "no cell" reason) — replaced with fixtures nesting a real `{python}` cell inside front matter / an HTML comment, proven faithful by break-revert. The review's refuted findings were correctly out of scope (non-contiguous-`#|` over-detection, prefix/language-agnostic matching per the plan contract, a missing front-matter `@`-suppression test already covered by the 6b/6c suites, and the `refs.ts` `CELL_LABEL_OPTION` duplication — deferred to the 6d-2 consolidation). Verified: 31 new vitest cases (**273 total**) + 7 `@vscode/test-electron` cases (**70 total**) via `executeCompletionItemProvider` — the no-cross-pollination contract proven with positive + negative `detail`-discriminator controls and a RED baseline (the negatives stayed green when the provider was wired; the positive flipped RED→GREEN). Clean **33-file** `.vsix` (1.29 MB; new core bundled, fixture excluded); `npm audit` unchanged at 7 (no new deps); §3.3 guardrail intact (no `vscode` import in `core/`). The completion-popup *visual* appearance is F5-only residue; behavior/wiring is integration-proven. (Learning #25.) (Session 18)
- **Phase 6d — YAML/`#|` cell-option completion: spike + implementation plan** (planning session, no code) — Resolved the parent plan's 🐉 "needs Quarto's YAML schema" dragon and wrote `docs/planning/2026-06-28-phase-6d-yaml-completion-plan.md`. **Schema-source decision:** the completion data (option names, descriptions, value enums, jupyter-vs-knitr engine tags) ships in the Quarto **CLI** share dir — `<share>/editor/tools/yaml/yaml-intelligence-resources.json` (97 cell-option + 414 front-matter key names), which is **MIT** (the CLI, not Posit's AGPL extension — confirmed against `COPYING.md`/`COPYRIGHT`, no carve-out, via a refute-by-default licensing check). The standard `json-schemas.json` was rejected (it's the validation schema keyed by type names — lacks the completion-shaped grouping/tags/descriptions). Approach: **runtime-read** the user's own install (zero version drift, +0 bytes, **no redistribution → no NOTICE**), resolving the share dir via the **undocumented** `quarto --paths` (parse defensively — it's absent from `--help`), with a **tiny curated static fallback** so the feature degrades to "fewer suggestions," never a crash or false "unknown key." **Scope decision:** an adversarial scope check **refuted** "6d is one capability" — it's ~5 (two cost axes: position detector + schema-subset/value-interpreter), so the plan slices it **one-context-per-session, vertical**: 6d-1 `#|` cell-option KEY (curated; smallest, ship first) → 6d-2 cell-option VALUE → 6d-3 schema reader (the dragon slice) → 6d-4 front-matter KEY → 6d-5 front-matter VALUE → 6d-6+ 🐉 format-conditional nested (optional). The plan carries a **grep-verified reuse/gaps inventory** (file:line; reuses the shared `scanRegions` model, the `{start,typed,end}` completion-context shape, the `{inserting,replacing}` range trick, provider registration — and flags the 5 gaps incl. the missing front-matter region surface), the **pure-core interface contracts** (`findCellOptionLines`/`findFrontMatter` model additions, `core/yaml-context.ts` `completionContextAt`, `core/yaml-schema.ts` reader), and the load-bearing **inverted provider-gating trap** (the new YAML provider is the complement of the `@` providers — it must fire only in front matter + `#|` lines, on a shared whole-doc selector). Produced via a 7-agent investigate+adversarially-verify workflow; the licensing/scope/stability skeptics each changed the plan. **Implementation is separate sessions, one slice each, strict TDD — start with 6d-1.** (Learning #24.) (Session 17)
- **Phase 7 (v2) — Diagram preview webview (`Quarto: Preview Diagram`)** — Added `quarto.previewDiagram`: it detects every ```` ```{mermaid} ```` and ```` ```{dot} ```` diagram cell in the active `.qmd` and renders each **Mermaid** cell in a webview beside the editor with **vendored Mermaid** (MIT, `media/mermaid/`), re-rendering live (debounced) as the tracked document changes; a single panel is reused and re-targeted across invocations. Graphviz (`{dot}`) cells are detected but shown as source + a "not yet rendered" note (rendering them needs a separate WASM renderer — a future slice). Per §3.3 the logic is pure/`vscode`-free in two modules: `src/core/diagram-regions.ts` (`findDiagramRegions` — a thin **filter over the shared `findAllCells` scanner**, no second scanner per Learning #14, so the non-executable forms — plain ```` ```mermaid ````, ```` ```{{mermaid}} ````, ```` ```{.dot} ```` — are excluded for free) and `src/core/diagram-preview-html.ts` (`buildDiagramPreviewHtml` — the Mermaid webview HTML with a strict nonce CSP). `src/features/diagram-preview.ts` is the thin adapter (`DiagramPreviewManager`; `asWebviewUri` + `localResourceRoots` for the vendored bundle). Built strict-TDD (10 red→green detection behaviors + 6 HTML-builder + 6 adapter). **Vendoring fact (Learning #23):** Mermaid ships `dist/mermaid.min.js` (3.56 MB self-contained UMD bundle exposing `globalThis.mermaid`) and an ESM build that explodes into 1167 lazy chunk files (unusable under `default-src 'none'`); the UMD bundle was verified to have 0 runtime `import(`/`import.meta`/`new Function(` and only dead lodash `Function("return this")` fallbacks, so it needs **no `'unsafe-eval'`** and loads as a classic nonce'd `<script>`. It is vendored as the **single file** with sha256/version provenance in `NOTICE` and is **NOT a devDependency** (Mermaid's large dev tree would bloat `node_modules` and perturb the documented audit posture) — `npm audit` stayed **7**, Learning #20 intact. A **6-lens refute-by-default adversarial review** (4 raised → **4 confirmed / 0 spurious**) then hardened it, fixes TDD'd: the CSP gained **`img-src ${cspSource} data:`** so Mermaid **C4 / architecture-beta** diagrams' inert `data:image` icons load (they were silently blocked by `default-src 'none'`; `data:` images can't execute, scripts stay strictly nonce-only); and **two gate-d test over-claims** were renamed to what they prove (a "re-render on edit" integration test asserted only panel-count = no-stacking, not re-render; a "mermaid vs dot" unit test asserted two static-template strings = presence, not engine discrimination — the per-engine branch runs client-side). One confirmed **shared-model gap** (the shared `CELL_INFO` over-detects glued malformed info strings like `{mermaid=x}`/`{dot=1}` — affects all `findAllCells` consumers) is documented in the `diagram-regions.ts` docstring + BACKLOG, deferred to its own cross-cutting pass. Verified: 16 new vitest cases (**242 total**) + 6 `@vscode/test-electron` cases (**63 total**) that register the command, open a `.qmd`, run it, and assert a webview tab opened via `vscode.window.tabGroups`/`TabInputWebview` (single-panel reuse, edit→no-stacking, non-quarto no-op; no Quarto CLI or kernel needed). Clean **33-file** `.vsix` (**1.29 MB**; the 3.56 MB Mermaid asset compresses ~3×). The webview's Mermaid SVG *visual* render is F5-only residue. (Learning #23.) (Session 16)
- **Phase 7 (v2) — Math preview webview (`Quarto: Preview Math`)** — Added `quarto.previewMath`: it detects every inline `$…$` and display `$$…$$` LaTeX region in the active `.qmd` and renders them in a webview beside the editor with **vendored KaTeX** (MIT, `media/katex/`), re-rendering live (debounced) as the tracked document changes; a single panel is reused and re-targeted across invocations. Per §3.3 the logic is pure/`vscode`-free in two modules: `src/core/math-regions.ts` (`findMathRegions` — Pandoc `tex_math_dollars` inline rules: open-after-nonspace, close-before-nonspace, close-not-before-digit, `\$` escaping, `$$` display wins over `$`; consumes the shared `scanRegions` so math is never found in YAML/comments/cells, and masks inline code spans) and `src/core/math-preview-html.ts` (`buildMathPreviewHtml` — the KaTeX webview HTML with a strict nonce CSP). `src/features/math-preview.ts` is the thin adapter (`MathPreviewManager`; `asWebviewUri` + `localResourceRoots` for the vendored assets). Built strict-TDD (16 red→green core behaviors + 5 HTML-builder + 5 adapter). A **5-lens refute-by-default adversarial review** (14 raised → **5 confirmed / 9 refuted**) then hardened it, fixes TDD'd: **inline code spans** (`` `$x$` `` in prose) were falsely reported as math — fixed by reusing the same masking `refs.ts` already does, **relocated to the shared `core/qmd/model`** so both consumers share one implementation (Learning #14), detecting on the masked copy but slicing content from the unmasked source; the **CSP unit test** was strengthened from a `toContain` (which a `script-src 'unsafe-inline'` regression would have passed) to a parsed-directive exact-equality, verified faithful by break-revert (gate d); and the live re-render is now **debounced** (it had reloaded the webview, losing scroll, on every keystroke). Two confirmed **shared-model gaps** (mid-line-opened/closed HTML comments — they affect `refs` too) are documented in the `math-regions.ts` docstring + BACKLOG, deferred to their own cross-cutting `scanRegions` pass. The review also correctly **refuted an over-fix** (U+2028/2029 are valid in ES2019+ webview `<script>` literals). Verified: 24 new vitest cases (**226 total**) + 6 `@vscode/test-electron` cases (**57 total**) that register the command, open a `.qmd`, run it, and assert a webview tab opened via `vscode.window.tabGroups`/`TabInputWebview` (single-panel reuse, edit→re-render, non-quarto no-op; no Quarto CLI or kernel needed). KaTeX (js + css + woff2-only, ~588 KB) is attributed in `NOTICE` and ships as a webview asset (not a bundled runtime dependency — `npm audit` unchanged, Learning #20). Clean **32-file** `.vsix` (368.5 KB; the +338 KB over Session 14 is the KaTeX renderer). The webview's KaTeX *visual* render is F5-only residue. (Learning #22.) (Session 15)
- **Phase 7 (v2) — Formatting toggles (first v2 feature)** — Added `Quarto: Toggle Bold`, `Toggle Italic`, and `Toggle Code`: they wrap or unwrap the current selection — or the word at a bare cursor — in `**` / `*` / `` ` `` markers, leaving the inner text selected so a second invocation round-trips. Bound to `ctrl/cmd+b` and `ctrl/cmd+i` (scoped to `editorLangId == quarto`); all three are on the command palette; toggling with nothing selected and the cursor not in a word inserts an empty marker pair with the cursor between. Per §3.3 the logic is pure/`vscode`-free in `src/core/format-toggle.ts` (`toggleFormat` — wrap, outer-/inner-marker unwrap, cursor-to-word expansion, and the load-bearing `*`-vs-`**` disambiguation so italic-over-bold wraps rather than corrupting the bold); `src/features/formatting.ts` is the thin adapter (gated to `.qmd`, primary selection only, restores the selection via `positionAt` against the live post-edit document). Built strict-TDD (10 red→green core behaviors). A **5-lens / 3-refuter refute-by-default adversarial review** (11 raised → **3 confirmed / 8 refuted**) then hardened it, all fixes TDD'd: an empty-selection disambiguation hole where italic-toggling a bare cursor inside a literal `**` silently **deleted** it (now inserts an empty pair via new inner-neighbour guards); ASCII-only word expansion that split accented prose (`café` → `**caf**é`, now Unicode-aware `/[\p{L}\p{N}_]/u`); and a substring keybinding-scope test strengthened to exact-equality (gate-d faithfulness). Verified: 12 new vitest cases (**202 total**) + 9 `@vscode/test-electron` cases (**51 total**) that drive the real editor and pin the offset mapping end to end (no Quarto CLI or kernel needed); clean **10-file** `.vsix` (29.82 KB; bundle 47.75 KB). Multi-cursor support is deferred (BACKLOG Polish). (Learning #21.) (Session 14)
- **Release prep — `npm audit` posture decision (v1 release prep is now agent-complete)** — Reviewed all 7 reported vulnerabilities (4 moderate / 2 high / 1 critical) and **accepted them as dev-only**, documented in a new `docs/SECURITY-AUDIT.md`. Every advisory lives in build/test tooling (`esbuild` the bundler, `vitest` the unit runner, `mocha` the integration runner, and their transitives `vite`/`vite-node`/`@vitest/mocker`/`serialize-javascript`) and **none reaches an end user** — verified four ways: `package.json` `"dependencies": {}` is empty, `src/` imports none of the vulnerable packages, the shipped bundle `dist/extension.js` contains none of their names, and `vsce ls` confirms the `.vsix` ships only `dist/extension.js` + static assets (no `node_modules`). No fix was applied because plain `npm audit fix` fixes **0 of 7** (confirmed via `--dry-run`) and `npm audit fix --force` is breaking and net-negative — it would major-bump esbuild (0.24→0.28) and vitest (2→3) and **downgrade** mocha (10→8.1.3), risking the verified 190-unit/42-integration/clean-`.vsix` pipeline to silence advisories on dev-server/dev-UI surfaces this project never exercises (headless one-shot builds and tests). The advisories themselves (esbuild/vite dev-server access, Vitest-UI-server file read, serialize-javascript RCE/DoS) require attack surfaces not present in this usage. A deliberate, separately-verified toolchain upgrade to clear them the right way is tracked in `BACKLOG.md` (Polish / deferred). No code, dependency, or `package.json` change — unit/integration baselines unchanged; clean **10-file** `.vsix` (29.09 KB; ships only `dist/extension.js` + static assets, no `node_modules`) reconfirmed via `npm run package`. (Learning #20.) **v1 release prep is now agent-complete; the only remaining step is the operator-only `vsce publish`** (Marketplace publisher `rmsharp` + PAT; `preview: true` set). (Session 13)
- **Release prep (item 3) — F5 visual pass + README screenshots** — Captured five faithful screenshots of the live extension and wired them into a new `## Screenshots` section in `README.md` (replacing the placeholder): **syntax highlighting**, **document outline**, the **`@` completion** popup (cross-reference labels and bibliography citekeys coexisting in one list), the **live preview** pane, and the **render** Output channel. **Faithfulness mattered:** the user has Posit's official Quarto extension (`quarto.quarto`) installed, which runs in the Extension Development Host and merges its grammar/outline/completion/preview/commands with ours — so the dev host was relaunched with `--disable-extensions` (keeps the under-development extension, disables all installed ones; the tell was Posit's `Run Cell` CodeLens, which we don't provide) to capture *only* our extension's UI (CLAUDE.md Learning #19). Added a render-clean showcase fixture (`test/fixtures/showcase.qmd`, doc-level `execute: enabled: false` so it needs no kernel) and a repeatable runbook (`docs/F5-VISUAL-CHECKLIST.md`). Screenshots are kept OUT of the `.vsix` (`.vscodeignore media/screenshots/**`, icon still ships); vsce rewrites the relative README paths to repo raw URLs (verified by unzipping the packaged readme). Verified: clean **10-file** `.vsix` (29.09 KB, `media/` ships only `icon.png`), README links resolve. **This closes the "F5-only visual residue" every prior phase (5 / 6a–6c) carried** — all feature visuals are now eyeballed live. **Remaining release prep:** the `npm audit` posture decision; actual `vsce publish` is an operator step (Marketplace publisher + PAT). (Session 12)
- **Release prep (item 2) — marketplace metadata + listing README rewrite** — Set the real marketplace metadata on `package.json`: `publisher` `rmsharp`, an original `icon` (`media/icon.png` — a 256×256 document-card with a `</>` code-cell and an "MIT" badge, generated from an SVG via `rsvg-convert`, deliberately **not** Quarto's trademarked logo), `keywords`, `bugs`, `homepage`, a `galleryBanner`, `preview: true` (honest 0.0.1 first-listing state), a polished `description` naming the full shipped feature set, and `categories` Programming Languages + Data Science. Rewrote `README.md` for the Marketplace — **fixes the stale status line** (it claimed code-cell execution + editor intelligence were "still to come", but they shipped in Phases 5 / 6a–6c): an accurate grouped feature tour, requirements, quick start, commands/keybindings/settings tables, and the MIT clean-room / AGPL look-but-don't-copy attribution (drafted via a judge-panel + accuracy-critic multi-agent workflow against a fixed factual brief, so no fabricated or overreaching claims). **Caught + fixed a real coupling the unit suite + packaging missed:** changing `publisher` changed the runtime extension ID `vscode-quarto-ext.vscode-quarto-ext` → `rmsharp.vscode-quarto-ext`, which the integration suite hard-codes per file — the full `test:integration` run RED'd **8 "should be discoverable"** `before all` failures, fixed across all 8 suites (CLAUDE.md Learning #18). Verified: clean **10-file** `.vsix` (28.82 KB) with `media/icon.png` embedded (confirmed via `vsce ls`), **190/190** unit + **42/42** integration green; no extension/runtime behavior changed. **Remaining release prep:** item 3 (F5 visual pass + screenshots) and the `npm audit` posture decision. (Session 11)
- **Release prep (item 1) — git remote wired + packaging metadata** — Added the `origin` remote (`rmsharp/vscode_quarto_ext`, default branch `master`), added the `repository` field to `package.json`, dropped `--allow-missing-repository` from the `package` script (vsce reads `repository` from `package.json`, so packaging no longer needs the flag), and lifted the README relative-link restriction (the `LICENSE` reference is now a relative link — Learnings #5/#17). The local project history was force-pushed over GitHub's auto-init commit (`--force-with-lease`; the histories were unrelated). Verified: a clean **9-file** `.vsix` packages without the flag and 190/190 unit tests stay green; no extension/runtime behavior changed (pure packaging metadata). **Remaining release prep:** real marketplace metadata (`publisher`/`icon`/`keywords`/`bugs`/`homepage`), a listing `README.md` with screenshots from an F5 pass, and an `npm audit` posture decision. (Session 10)
- **Phase 6c — Citation completion (v1 is now feature-complete)** — Typing `@` in `.qmd` prose now also offers the **citekeys** from the bibliography named in the document's YAML `bibliography:` key (with the entry's title as detail), inserting `@key`. It coexists with Phase 6b cross-references on the same `@` trigger — VS Code merges both providers and filters by the typed text, so `@fig` shows cross-refs and `@kn` shows citations. Per §3.3 the logic is pure/`vscode`-free: `src/core/frontmatter.ts` (`bibliographyPaths` — reads the one key the region model skips, in scalar / flow-list / block-list forms, no YAML dependency) and `src/core/citations.ts` (`parseCitations` — a BibTeX + CSL-JSON parser that never throws; `citationCompletionContext` — a citekey-aware `@`-token scanner); `src/providers/citation.ts` is the thin adapter (reads the bib file relative to the document, gated to prose via `isReferenceableLine`). Built strict-TDD (20 red→green core cycles). A **5-lens adversarial review** (three refute-by-default verifiers each; 13 raised → **12 confirmed / 1 refuted**) then hardened it, all fixes TDD'd: a zero-indent YAML block list, a trailing `# comment`, and an empty quoted scalar are handled; brace-matching is quote-aware (a stray `{` in a quoted value no longer discards the rest of the file); a UTF-8 BOM is stripped before `JSON.parse` (a BOM-saved CSL-JSON otherwise loaded zero citations silently); parenthesis-delimited BibTeX entries and odd CSL `date-parts` are handled; and — the key catch — **citekeys with `:`/`.`** (biblatex/DBLP) now complete correctly (reusing the cross-ref `ID_CHAR` scanner had reintroduced the mid-token suffix-duplication + no-fire-after-`:` bug, the finding-E class from Learning #15). Verified: 40 new vitest cases (**190 total**) + 8 `@vscode/test-electron` cases (**42 total**) via `vscode.executeCompletionItemProvider` (faithful, env-independent; incl. coexistence, in-cell gating, a colon-key whole-token replace, and three degradation paths whose guards were proven discriminating by break-revert). `.vsix` ships clean (bundle 36.3 KB → 43.3 KB). **v1 — highlight, render, preview, run-cell, outline, cross-ref + citation completion — is feature-complete; next is release/packaging prep.** (Session 9)

### 2026-06-27
- **Phase 6b — Cross-reference completion + go-to-definition** — Typing `@` in `.qmd` prose now offers the document's cross-reference labels (`@fig-…`, `@tbl-…`, `@sec-…`, `@eq-…`, `@lst-…`) and **Go to Definition** on a `@ref` jumps to where its label is defined. Labels are indexed from three structural sources, all built on the shared `core/qmd/model.ts` scanner (Learning #14 — no third scanner): `{#sec-…}` ids on headings (the heading attribute, previously parsed-and-discarded, is now kept as `Heading.id`), `#|`/`//|` `label:` options inside code cells, and inline `{#fig-/tbl-/eq-/lst-…}` attribute blocks on prose (images, divs, display equations). Per §3.3 the index is pure/`vscode`-free (`src/core/refs.ts`: `indexLabels`, `refIdAt`, `crossrefCompletionContext`, `findLabel`, `isReferenceableLine`); `src/providers/crossref.ts` is the thin adapter (completion trigger `@`, definition). Built strict-TDD (10 red→green core cycles). An **adversarial 5-lens review** (two refute-by-default verifiers each; 10 confirmed, several traced through `quarto render`) then hardened it — 7 fixes: go-to-def column targets the trailing `{#sec-id}` (not an earlier mention), cell-`label:` parsing handles quotes/punctuation, headings contribute only section labels, inline backtick code spans and whole-line/inline HTML comments no longer yield phantom labels, completion replaces the whole `@id` token (no suffix duplication), and **both providers are gated out of code cells / front matter / comments** (where `@` is a decorator/macro/email). Verified: 39 new vitest cases (**150 total**) + 9 `@vscode/test-electron` cases (**34 total**) via `vscode.executeCompletionItemProvider`/`executeDefinitionProvider` (faithful, env-independent; incl. in-cell negative tests with a prose control). `.vsix` ships clean (bundle 29.3 KB → 36.3 KB). **Deferred (documented scope):** a `{#fig-…}` inside a CommonMark §4.4 *indented* (4-space) code block is still indexed (needs a list-aware scanner pass — backlog). **F5-only residue:** the completion popup's visual feel (no `code` CLI); behavior is fully integration-proven. (Session 8)
- **Phase 6a — Document outline / symbols** — Added a `DocumentSymbolProvider` for `.qmd` so the **Outline view and breadcrumbs** populate with the document's headings (nested by level) and code cells (as leaves under their section). This establishes the shared **`core/qmd/model.ts` region model** that Phases 6b–6e will consume: a single `scanRegions` pass classifies every line — YAML front matter, block HTML comments, code fences, ATX headings — and `findHeadings` / `findAllCells` / `findCellAtPosition` / `buildOutline` are thin views over it. **Phase 5's `core/cells.ts` was folded in** (now a re-export shim) so cell-finding has one implementation shared with heading detection. Per §3.3 the model is pure/`vscode`-free; `src/providers/outline.ts` is the thin adapter (maps `OutlineSymbol` → `vscode.DocumentSymbol`; headings→`String`, cells→`Function`; ranges clamped to the document). Registering a provider needs no `package.json` contribution. Built strict-TDD (red→green per behavior). An **adversarial 5-lens review** (refute-by-default verification, 8 confirmed) then hardened it: front matter and HTML comments are now skipped by cell detection too (a fenced example in a YAML block scalar / `<!-- -->` is no longer a phantom cell or runnable cell — the fix also benefits Phase 5 run-cell), fence indentation is capped at 0–3 spaces (CommonMark §4.5) to match the ATX rule, the Pandoc `{#sec-id .class}` heading attribute is stripped from the display name, and an all-hash heading (`## ##`) is dropped. Verified: 38 new vitest cases (**111 total**) + 1 `@vscode/test-electron` case (**25 total**) that asserts the full `sample.qmd` symbol tree faithfully via `vscode.executeDocumentSymbolProvider` (no CLI/Jupyter needed). `.vsix` ships clean (bundle 24.6 KB → 29.3 KB). **Deferred (documented scope):** setext (`===`/`---`) headings. **F5-only residue:** the Outline view's visual rendering is not headlessly verifiable (no `code` CLI); the symbol structure is fully proven by the integration test. (Session 7)
- **Phase 5 — `Quarto: Run Cell` family** — Added `quarto.runCell`, `quarto.runCellAndAdvance`, `quarto.runCellsAbove`, `quarto.runAllCells`, and `quarto.insertCell`. They find the code cell at the cursor and **delegate** execution to the user's language extension — Jupyter for Python, the R/Julia extensions — by selecting the cell's code and invoking that extension's command (feature-detected at runtime); when none is installed they show a clear warning and never crash. Run-cell does **not** shell out to the Quarto CLI, owns no long-lived process (the Phase-4 lifecycle dragon does not recur), and runs the **in-editor buffer** (no save — the delegated path's dependency is the user's kernel, not the CLI). `ctrl+enter` / `shift+enter` are bound only inside a cell via a `quarto.inCodeCell` context key. Per §3.3, the logic is pure/`vscode`-free: `core/cells.ts` (`findAllCells`/`findCellAtPosition` — a CommonMark-faithful backtick/tilde fence scanner that excludes plain ` ```python ` fences, the `{{python}}` display form, `{.python}` Pandoc classes, and `{lang}` fences nested in outer/tilde fences) and `core/execution-delegate.ts` (`delegateCommandsFor`/`pickDelegate`/`buildCellSnippet`); `src/features/execution.ts` is the adapter. Built strict-TDD (red→green per behavior). An **adversarial multi-agent review** (23 findings, 10 confirmed) then surfaced and fixed: a dead-on-arrival keybinding gap (no `onLanguage:quarto` activation), Run All aborting at the first cell lacking a delegate, tilde-fence false positives, advance-past-empty-cell, and context-key staleness. Verified: 27 new vitest cases (**73 total**) + 8 new `@vscode/test-electron` cases (**24 total**) — the latter faithfully prove dispatch by registering a **stand-in** delegate (the clean host has no Jupyter) and asserting the selected cell text. `.vsix` ships clean (bundle 16.5 KB → 24.6 KB). **F5-only residue:** the keybinding feel and real run-in-interactive-window with Jupyter installed are not headlessly verifiable (no `code` CLI). (Session 6)
- **Phase 4 — `Quarto: Preview`** — Added the `quarto.preview` command: it spawns `quarto preview <active.qmd> --no-browser`, parses the `Browse at http://localhost:<port>/` line (on **STDERR**, ANSI-wrapped — verified live; stdout is empty), and embeds that URL in a webview pane beside the editor (auto-reloads on save via Quarto's own livereload). It **owns the process lifecycle**: the server is reaped on pane close, document close, and extension deactivate — no orphans. The dragon was process-tree reaping: Quarto's bash wrapper spawns a `deno` worker, and killing the wrapper first reparents the worker (it orphans), so the child is spawned **detached** and the whole process group is signalled atomically (`process.kill(-pid, SIGTERM→SIGKILL)`). Per the §3.3 guardrail, `core/preview-url.ts` (`parseBrowseUrl`) and `core/preview-html.ts` (`buildPreviewHtml` — CSP `default-src 'none'`, frames only the preview origin, HTML-escaped) are pure/`vscode`-free; `src/features/preview.ts` is the adapter. Built strict-TDD (red→green per behavior). An **adversarial multi-agent review** then found a TOCTOU double-invocation race (two rapid invocations orphaned the first server) plus four lower-severity issues, all fixed and the race regression-tested. Verified: 12 new vitest cases (45 total) + 2 new `@vscode/test-electron` cases (10 total) — the lifecycle test spawns a real preview and asserts the **deno worker** (not just the wrapper — a faithfulness fix) is reaped on close, no orphan. `.vsix` ships clean (bundle 8.5 KB → 16.5 KB). **F5-only residue:** the webview's visual render, livereload-in-iframe, and notification wording are not headlessly verifiable (no `code` CLI). (Session 5)
- **Methodology — strict TDD is now mandatory project-wide** — Per operator directive, all implementation/bug-fix work follows red→green→refactor TDD (vertical slices, test-first) for the project's duration. Recorded in `CLAUDE.md` (the correct non-synced file) as a binding override subsection + Learnings #10. (Session 5)
- **Phase 3 — `Quarto: Render`** — Added the `quarto.render` command: it spawns `quarto render <active.qmd>` and streams stdout+stderr verbatim to a dedicated "Quarto Render" Output channel. Success/failure is keyed off the **exit code** (Quarto writes progress, the `Output created:` marker, AND errors all to STDERR — verified live); on exit 0 it parses the output path and offers to open it, on non-zero it points to the channel where the error (e.g. the missing-Jupyter `nbformat` traceback) already shows verbatim. Missing CLI fails soft via `resolveBinary()`/`QuartoNotFound`. Per the §3.3 guardrail, `src/core/render-args.ts` (`buildRenderArgs` + `parseOutputPath`, ANSI-tolerant) is pure/`vscode`-free; `src/features/render.ts` is the thin adapter. Verified: 9 new vitest cases (38 total), 3 new `@vscode/test-electron` cases (7 total) — the success case renders `sample.qmd` to HTML in a real host and the failure case (`render-error.qmd`, invalid format → deterministic exit 1) confirms no host crash. **Faithful-verification note:** the test host resolves a Jupyter-capable Python, so the missing-Jupyter degradation is verified live via the CLI, not in the host (see CLAUDE.md Learning #9). `.vsix` still ships clean (bundle 4.8 KB → 8.5 KB). (Session 4)
- **Phase 2 — `.qmd` highlighting** — Registered the `quarto` language for `.qmd`/`.rmd`/`.Rmd` and shipped an original `text.html.quarto` TextMate grammar (`syntaxes/quarto.tmLanguage.json`) that delegates prose to VS Code's built-in markdown grammar **by reference** (no source copied) and adds Quarto-specific rules: YAML front matter (→`source.yaml`) and brace-wrapped `{python}`/`{r}`/`{julia}`/`{ojs}` code cells (→ embedded `source.*`, scoped `meta.embedded.block.*` and mapped in `contributes.grammars.embeddedLanguages`). Added `language-configuration.json` (brackets, comment toggle, autoclose, folding) and `/NOTICE` (MIT attribution — licensing gate; **resolves the deferred base-grammar decision by not forking**). Verified headlessly: 7 new `vscode-textmate`+`vscode-oniguruma` tokenization tests prove the embedded scopes + plain-fence discrimination, 10 structural guards, and a `@vscode/test-electron` test confirms `.qmd` opens as `quarto` in a real host; `quarto render` of the fixture exits 0. `.vsix` now ships 9 files. (Session 3)
- **Phase 1 — walking skeleton** — Scaffolded the extension (TypeScript + esbuild + `@vscode/vsce`, `engines.vscode ^1.90.0`, MIT `LICENSE`) with the `core/`-vs-adapter boundary in place (`src/core/version.ts` is pure/`vscode`-free; `src/quarto/cli.ts` is the CLI adapter; `src/extension.ts` is thin). Shipped the `Quarto: Verify Installation` command (resolves `quarto.path`→PATH, reports version or actionable error). Test harness: 12 vitest unit tests + 2 `@vscode/test-electron` integration tests (activation + end-to-end command execution against the real CLI). **Confirmed test-electron downloads + runs VS Code headlessly here** (resolves plan §14's load-bearing assumption). `npm run package` produces a clean 6-file `.vsix`. Operator ratified plan §12 (v1 scope, Tier B, stack, engine ^1.90.0; base grammar deferred to Phase 2). (Session 2)
- **Architecture & implementation plan** — Produced `docs/planning/2026-06-27-extension-architecture-plan.md`: resolved the TextMate-vs-LSP decision (Tier A grammar → Tier B in-process providers → defer Tier C LSP; `vscode`-free core guardrail), confirmed Posit's extension is AGPL-3.0 (build on MIT upstreams instead), inventoried features, and laid out 7 vertical-slice phases with DONE gates and verification commands. Draft pending operator ratification (plan §12). (Session 1)
- **Project bootstrap** — Initialized git and installed the Iterative Session Methodology (KJ5HST/methodology v3.0, committed mode) via upstream `bin/sync`. Created `CLAUDE.md`, `CONTEXT.md`, `BACKLOG.md`, `.gitignore`; generated the health dashboard. Project goal: MIT-licensed VS Code extension replicating Posit's Quarto extension features. (Session 0)
