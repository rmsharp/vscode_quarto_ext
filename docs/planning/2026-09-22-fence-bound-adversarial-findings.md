# A fence inside a list item, and a backtick in a fence's info string — measured, attempted twice, NOT shipped

**Session 276, 2026-09-21/22.** Records the research, the two candidate rules, and the two adversarial
passes that rejected them, for the `BACKLOG.md` item *"A bare fence inside a list item, and a backtick
fence whose info string holds a backtick, are fences to this model and not to pandoc"*. **No `src/`
change shipped.** The item stays open; this document is why, and what a future fix needs first.

Corpus documents are named by ordinal only (Learning #548). Every probe named below lives under
`scratchpad/s276/` (untracked) with its `quarto render` cached beside it in `.render-cache.json`.

## 1. The defect, confirmed

Quarto 1.7.33, plain `.qmd`, markdown engine (`scratchpad/s276/w0`): a fence inside a list item whose
only closer lies after the item has ended is **no fence to pandoc** — the item is collected from raw
lines first, and pandoc's markdown reader builds no code block from a fence its container leaves
unclosed. This model pairs it with the later closer and **deletes every heading between**. Likewise
```` ```a`b ````: pandoc's info word may hold no backtick (either fence character), and the model opens
one. Deletion direction, pre-existing, measured in bullet, ordered, tilde, info-string and
blank-separated shapes (`w01`–`w08`).

**Corpus reach: zero.** Over all 3,383 authored documents, no fence inside a container has its HEAD
closer past the container's end, and no newly refusable backtick line reaches the open site
(instrumented, `prototype-reach`). Every candidate build below left all 3,383 model outputs
byte-identical to HEAD, and the real-document score unchanged at 2,423 / 2,438.

## 2. The rule that was derived (research: 6 agents, ~550 rendered probes)

Measured by `li-extent`, `containers-readers`, `backtick-info`, `cells-engines`, `prototype-reach` and a
completeness critic (`scratchpad/s276/<lens>/`, each with its rendered matrix):

- A **plain** fence opened inside a list item, footnote body or definition body may be closed only
  before that container's end. Cells and knitr-claimed chunks are exempt (quarto claims them first).
- The item's end, from its own marker line over raw lines: a non-blank line shallower than the
  content column after a blank line; a lazy pandoc **list start**; a fence line in the item's
  **first chunk**; a lazy `:::` / `</div>` inside an enclosing div.
- The backtick rule: pandoc readers refuse a backtick in the info **word** (before a trailing
  attribute block, after quarto's brace-tag rewrite) on either fence character; CommonMark readers
  refuse any backtick in a backtick fence's info string.
- Other readers diverge: CommonMark closes an unclosed fence at its container's end instead of
  refusing it; some readers lack a fence character entirely.

## 3. Candidate 1 — the rule as derived (broad)

On the 606 designed probes it agreed with quarto on **504** against HEAD's **286**, with **zero** rows
where HEAD agreed and it did not; built under strict TDD, every guard mutation-tested.

**Adversarial round 1** (5 lenses, 1,075 probes, every claim re-rendered by an independent skeptic):
**203** verified regressions. Over all **1,844** unique rendered probes: **435 fixes, 626
regressions**, most of them deletions. Five families:

1. **"Real container" cannot see raw constructs.** A marker after a blank line inside `<pre>`,
   `<script>`, a TeX environment, a multi-line HTML comment, mid-document YAML or a table row is taken
   as a real list (`adv/realness/r01`, `r06`, `r10`, `r12`, `r13`).
2. **Lazy look-alike list starts end items early**: `p. 12`, `dd.`, `mid.`, `(1.`, and tab-separated
   markers whose content column this model computes wrongly (`adv/verify-end-line`).
3. **A refusal FREES its closer**, which lands on older misreads HEAD's pairing hid — above all a fence
   at indent 1–3 directly under a paragraph line, which pandoc does not open and this model does
   (`adv/stale-walkout/z01`, `z10`).
4. **Lazy `:::` / `</div>` item ends and knitr's re-indentation** of cell output move the true end
   (`adv/stale-walkout/d01`, `adv/verify-engines-cells/a_kq_ul_tn_blank0`).
5. **Backtick**: lines pandoc swallows into an inline code span are read as live (an `===` becomes a
   setext underline); quoted closers are not consumed; readers without fences; CommonMark's freed
   closer; knitr inline R on the fence line (`adv/verify-backtick`).

## 4. Candidate 2 — "N1", narrowed to what was positively established

A simple-document gate (default reader, markdown engine, no raw HTML/TeX line starts, divs, tables,
shortcodes, second YAML block), top-level list items only (column 0, bullet or decimal then spaces,
not a setext title, after a blank line or an ATX heading, or a tight sibling not yet ended), no lazy
list-start end, a **freed-lines guard** (refuse only if every freed fence line is one this model
reads as pandoc does, memoized — a naive walk measured 9 ms → 298 ms), and the backtick refusal only
at top level with a blank line below. Over the 1,844 probes: **0 regressions, 138 fixes**; 3,017 unit
tests green; mutants killed or measured unobservable over the whole set.

**Adversarial round 2** (5 new lenses, 1,074 probes, skeptic-verified): **169** verified regressions.
Over all **3,105** unique rendered probes: **499 fixes, 622 regressions.** New families, each a hole
in a guard that looked complete:

1. **Gate escapes**: mid-line TeX whose argument spans a blank line (`\mbox{…`, `\footnote{…`,
   `\newcommand{…`), HTML tags with non-ASCII names (`<é`, `<日`), processing instructions (`<?php`),
   one-column multiline tables (`adv2/gate-escape`).
2. **The first-chunk flag** cleared by code-depth fence-shaped or marker-shaped lines
   (`adv2/list-edges`).
3. **Stale real items** after lazy starts N1 no longer reads — `(@)`, `A.  x`, `I.  x` — and lone CR
   line endings.
4. **Guard gaps**: freed lines swallowed by inline code or `$` math were exempted; a refusal can flip
   the fence parity past HEAD's closer (`adv2/freed-guard`, `adv2/backtick-n1`).
5. **Body realness**: footnote labels pandoc reads as reference-link definitions (`[^^1]:`, `[^[1]:`),
   and terms that are themselves list markers (`A. Term`) (`adv2/bodies`).

## 5. Conclusion — why nothing shipped, and what must come first

Both candidates **refuse a fence HEAD paired**, and a refusal frees every line down to HEAD's closer.
Those lines are then read by a model that does not parse raw TeX commands, raw HTML inline tags,
inline code and math spans across lines, or pandoc's exact list-start grammar — so each guard only
moves the hole, and each adversarial round found a new family at roughly the same rate. With **zero
corpus reach** on either side, trading one deletion family for several others is not progress. The
stop rule applied was the one attached to the option the operator chose mid-session ("Adopt N1,
re-attack"): if the second pass found confirmed regressions that could not be closed without
widening risk, ship nothing and record instead.

A sound fix needs, first, at least:

- **Pandoc's paragraph-interrupt rule for fences** — only a column-0 BACKTICK fence with a closer
  interrupts a paragraph (`containers-readers/pi01`–`pi04`, `backtick-info/m/m83`). HEAD already
  deletes on it, and it is the misread most refusals expose.
- **Consumed-span modelling for a refused opener** — pandoc's exact-run inline code pairing, and the
  in-span lines treated as text (`backtick-info` rule 5; Session 224's own `m49`).
- **One list-start predicate shared by the push, the pop and any end rule**, measured against
  pandoc's set (`(@)`, `A.  x`, pandoc's roman parse, tab-separated markers' columns).
- **Awareness of the raw constructs that swallow a blank line and a marker** — or a different source
  of truth for "is this container real".

The two builds, their diffs and the harness are in `scratchpad/s276/` (`cand.diff`, `n1final.diff`,
`n1-final-full.diff` with its 27 unit tests and one real-host row, `harness/probe.py`, `harness/crossall.py`). The 3,105-probe
cross-scorer runs in seconds and should be the regression gate for any future attempt.
