# Changelog — Authoritative Action Ledger

The cumulative, append-only record of **actions taken** in this repository — across backlog
items, repository issues, and ad-hoc work. It is the authoritative answer to *"what was done
here, ever?"* Every session records its actions here at close-out (`SESSION_RUNNER.md`
Phase 3F); Phase 0 reconciles it against `git log` and backfills anything a crashed or
out-of-band session missed. Taking an action — any commit, or any non-commit action — and
not recording it is failure mode #27. Old entries may be archived, never deleted.

**The rules** — how to add an entry, source tags, reading and archiving — are in
[§The Action Ledger](docs/methodology/FRAMEWORK_APPARATUS.md#the-action-ledger), which `bin/sync`
keeps current. ledger-format: 2 — keep this marker; `bin/status` reads it.

**Archived 230 record(s), 2026-06-30 → 2026-08-24** into [`docs/archive/CHANGELOG-through-2026-08-24.md`](docs/archive/CHANGELOG-through-2026-08-24.md) — same format, same order, frozen.
Losslessness is proved by [`docs/archive/CHANGELOG-through-2026-08-24.md.verify.sh`](docs/archive/CHANGELOG-through-2026-08-24.md.verify.sh), which re-derives L1/L2/L3 from git; run it rather
than trusting this sentence. Written by `methodology_trim.py` v1.1.1.

## 2026-09

### 2026-10-07 · [BL-CommonMark-family readers: what the Session 296 rules still miss — the container model, the quote extent, raw HTML inside a container and a div that interrupts a paragraph; all measured, corpus reach 0 of 3,383] Session 297: the four run-to-the-end rules of the CommonMark readers fire only where the front matter PROVES the reader

`src/core/qmd/model.ts` (`1d237399` claim; checkpoints `33b562f6`, `2c9211f4`, `c4952c91`, `6f38b80a`, `b6091c80`, `0c711ec7`; rows `7c582732`): the backlog's row (6) said the front-matter `from:` resolver reads a CommonMark reader where quarto reads the default for six rendered shapes (a `from:` inside a flow collection, a re-declared anchor, a block inside a fence), and Session 296's run-to-the-end rules then delete every heading below a trigger; the fix was priced as "a plain top-level scalar test". The six controls reproduced (seven: control 046 lost more headings too), and were a sample of an open-ended space. Measured first: the controls' cached renders, a 100-spelling x 5-trigger grid (500 documents, `scratchpad/s297/gf`: the parent deleted in 55 cells) and a sixth trigger (an unclosed `<!--`, `gf2`). Result: `frontMatterProvesReader` and a `commonmarkProven` flag gating FOUR sites: the unclosed plain fence, the type 3-5 HTML block, the degenerate comment (Session 296) and the unclosed-comment swallow (Session 289, found by the sixth trigger: the identical hole in the identical 11 spellings, in the pre-Session-296 build too). The proof is a WHITELIST: the front matter opens after ASCII blank lines only with a non-blank first line, quarto's own region scanner agrees on that one region, no lone `\r`, no fence marker, `<!--` or line starting with `---` inside it, no include shortcode or `metadata-file(s)` key anywhere, a body that holds a `---` delimiter (also one an HTML comment disguises) mentions no `from`, backslash or `<!--`, every front-matter line fits a small grammar (plain keys and list items whose values close on their line, block text skipped by indent, wrapped quotes and flows followed only from a value start, a plain scalar's continuation line declines), and exactly one governing `from` exists (column 0, or under `format:` / `html:` as the only format with no body delimiter) whose text is byte-identical to the resolver's. Three designs, each broken by blind authors and each time by a new CLASS: a bracket counter (round 1: 36 documents the pre-Session-296 build had right), a quote lexer (round 2: a glued `#`, a colon glued to a quote, odd dash-item keys, non-ASCII whitespace, a lone `\r`, a body block the region scanner's fence tracker hides) and the whitelist (round 3: a comment disguising a delimiter, two blank lines then `----`, a later block replacing `format:`, an include shortcode, `metadata-files`). Measured against quarto and against three critic leads (refuted: `pandoc-args -f markdown`, `--from=`, `--reader=` and a project `_quarto.yml` reader do NOT override a document's own `from:`). Final: 0 of 887 scored blind and realistic documents (19 lens directories) where the pre-Session-296 build is right and this one deletes (the parent: 205; 18 documents delete identically in every build); the grid's deletion cells 55 to 0 and the comment grid's 11 to 0; Session 296's 3,979 probes: 8 lost fixes (controls corpus) and 5 deletions removed, and the 38 regressions against the pre-Session-296 build are all among Session 296's 43 pinned ones; 1,055 misread twins (`pg`): 0 deletions where the older build was right (the Session 296 rules not gated cost 105 phantoms); 334 realistic documents keep 88 of 103 fixes (85%); a differential fuzz against js-yaml (about 5 million documents, 1.25 million on the final build) reports 0 hazards and finds 4,830 in the parent and 963 in the first whitelist; corpus 0 of 3,383 changed; real-document score unchanged at 2,423 of 2,438; 4,463 tests to 4,583 (the Session 297 suite holds 126, six Session 296 rows that pinned the wrong answers retired; 10 RESIDUAL rows pin phantoms the fix leaves). Mutation: 93 single-term mutants, 41 killed by the unit suite, 14 more by new rows (11 from their shortest rendered killer documents, 3 by crafted rendered witnesses for guards no document reached), 14 left because the mutant is RIGHT where the real build declines on purpose, 24 unobservable (invalid-YAML shapes or subsumed guards). Residuals and every decline are filed in the backlog (a new item, with the measured costs); the Session 296 rules not gated (105 phantoms, 0 deletions), the critic's five unrendered rule-side leads and the unmeasured knitr and julia engines too; row (6) removed from the CommonMark item; learnings 655-664. Cost: 20 authoring agents (about 4.4M subagent tokens, none rendered) in three workflows plus one critic, about 2,650 renders by the caller at 3 wide, 93 mutants, no screen-taking run (`test:integration` not run: core-only change). Close-out: `SESSION_NOTES.md` trimmed to three pairs (drops the Session 293/294 pair); `check-backlog` OK; `npm run package`: exit 0 (compile with both type checks, bundle, `check-package` OK with 42 files, `.vsix` of 44 files and 1.85 MB, 14:41 because `vsce` walks the 70 GB untracked `scratchpad/`); `quality_ratchet`: 2/2 pass · 0 fail · 0 unmeasured · results bba236856bad · manifest 8845021a4049 at head 18f3196b (read from the results file; the run took 7:06); the gate timeout was raised to 3,600 s for the release-gate command, as in Sessions 295 and 296, because the runner's 600 s default is shorter than `npm run check-package` while `vsce` walks the 70 GB untracked scratchpad.

### 2026-10-07 · [BL-Kernel-cell closing and the unbounded second look — what Sessions 293, 294 and 295's rules still leave: containers deeper than their code depth, the free case's stacked and multi-line block enders, the kernels the reader declines, and the surfaces that still read the validation view; all measured, corpus reach 0 of 3,383] Session 296: under a CommonMark-family reader an indented non-handler opener is never a cell, and the fence, HTML-block and container rules that exposes

`src/core/qmd/model.ts` (`87eb5003` claim; checkpoints `84ac6590`, `229e0aaf`, `e68fb483`, `569b41b2`, `1cae5708`, `e276455d`, `fd57abfd`, `fb40ac61`, `fa951d0e`, `5dc59ce4`, `df44b4c4`, `cdd31d2b`, `c4261e0d`; rows `78addae8`, `035ed551`, `844a0b3c`, `ee67e495`): the backlog's residual 3(f) said that under `gfm`, `commonmark` and `commonmark_x` quarto lists the heading inside an indented non-handler opener in nearly every context, because an ATX line interrupts a paragraph there, and that 33 of 96 reader-grid documents were still deleted. A 288-document context grid and a 336-document language x indent grid (`scratchpad/s296/{g1,g2}`) showed the answer depends on nothing but the context above the opener (identical across engine markdown and jupyter, the three readers and indents 4 and 8); one disjunct in the free case fixed 60 of 108 deleted documents and a 240-document container grid (`g3`) took the free case into list items deeper than their code depth. A first blind round (10 lenses, 609 documents) scored against the PARENT build then found 94 documents where HEAD was right and the new build was not, every one an older gap that the cell pairing had hidden by accident, and the work became the rules that make the CommonMark readers' own block structure faithful: an example-list marker above withdraws nothing; an UNCLOSED plain fence runs to the end of the document; HTML blocks of types 3-5 (`<?`, `<!X`, CDATA) and the degenerate comments `<!-->` and `<!--->` swallow to their end marker; a fence interrupts a paragraph at a list item's content column and ENDS where the item ends; the old fence window stays inside or after a quote. A second round (10 lenses aimed at those rules, 549 documents) showed the two run-to-the-end rules delete everything below a wrong trigger even with no opener in the document (154 regressions), and eight gates, each one measured fact, cut that to 27: a plain info string only (no backtick, no braces except a class or id attribute), no live fenced div, no raw HTML block that may be open above, a one-line block ends the paragraph above it, the degenerate comment only at indent 0-3 at top level, only CommonMark list markers count as a container column (`columnIsCommonmark`; `commonmark_x` keeps pandoc's fancy lists), and an ATX line, a fence or a type 2-5 HTML start closes the items deeper than it without a blank line (`cmBlockStartEndsItems`). A seeded 1,200-document product grid (`gen_prod.cjs`) found seven deletions slice 6 had caused (a list inside a block quote), fixed by keeping the old window in quotes. Two mutation passes (74 mutants of the session's terms, 64 killed) found five gates of mine that HURT (a mutant matched quarto where the real build did not): relaxing them, with a closing-marker guard for an unclosed raw block inside a container, added 35 fixes and no regression; ten killer documents and nine witnesses became rows; the 10 survivors are equivalent or unobservable by construction (recorded in the new BACKLOG item). Evidence: 3,979 rendered probe documents (quarto 1.7.33, ne mode, exit 0), 1,215 fixed and 43 regressed against the parent build, every regression a pinned RESIDUAL row (about a dozen deletion-direction shapes: multi-marker lines, markers that cannot interrupt a paragraph, a capital initial under `commonmark_x`, six misread `from:` controls); the 155 documents of a third, REALISTIC round (six personas told not to attack): 2 fixed, 0 regressed; 27,853 (document x pandoc reader) pairs with the reader rewritten to a non-CommonMark one: identical in both builds (the 91 that differ are 13 documents whose reader a rewrite does not reach); the engine-aware corpus (3,383 documents) is byte-identical, so the real reach is ZERO; the real-document score is unchanged at 2,423 of 2,438. Tests 4,225 to 4,463, types clean. Disclosures: the guard rows, the pinned RESIDUAL rows and the mutation killers and witnesses passed on arrival (RED was shown for every slice and gate family); `test:integration` NOT run (needs the screen; core-only change); a table-insertion script silently dropped the first row of 12 generated tables, found only because a mutant survived a row written to kill it (the rows were added in `ee67e495`); `mutate296.py` wrote its bundles into the S295 directory until moved. Non-commit actions: three workflows (`wf_80e1f897-230` 10 agents about 1.71M subagent tokens, `wf_5176adda-c93` 10 agents about 2.42M, `wf_e8f7eb46-14a` 6 agents about 0.55M), all told never to render, about 3,660 `quarto render --no-execute` runs by the caller at 3 wide with a load gate of 25 and each `*_files` folder deleted right after (the load of 64 that appeared once was Photos analysis and an R job); the BACKLOG item rewritten (residual 3(f) removed, the CommonMark residuals filed as their own item) and PROJECT_LEARNINGS rows 645 to 654; the dashboard run (76/100, the same critical flag, 21 vulns; its copy is v2.18.0 against canonical v2.21.0, an update the operator may want). `npm run package` (compile with both type checks, bundle, `check-package` OK with 42 files, a 44-file 1.84 MB `.vsix`, 14 minutes 43 seconds) exit 0; `context_budget.py`: SESSION_NOTES.md 11,725 B ok (HANDOFFS, BACKLOG and PROJECT_LEARNINGS were already over). Close-out commits: `1fa215f2` (the five close-out documents), `699e8b28` (SESSION_NOTES.md trimmed to three pairs in its own commit; the Session 292 evaluation and Session 293 self-assessment pair dropped, `git show 1fa215f2:SESSION_NOTES.md` recovers it) and the history-lines chore commit that carries this paragraph (`.context-budget-history.jsonl` and `dashboard_history.jsonl`, staged by exact path). `quality_ratchet: 2/2 pass · 0 fail · 0 unmeasured · results bba236856bad · manifest 8845021a4049` at head `f08d70cd`, the head the results file records, read rather than assumed (a CHANGELOG.md commit had landed first, so `ledger-lag` was 0; the run used the same two gates and commands with the runner's gate timeout raised to 3,600 s through `run_gates.__defaults__`, because `npm run check-package` outlasts the 600 s default while vsce walks the 70 GB untracked scratchpad).

### 2026-10-06 · [BL-Kernel-cell closing and the unbounded second look — what Sessions 293, 294 and 295's rules still leave: containers deeper than their code depth, the free case's stacked and multi-line block enders, the kernels the reader declines, and the surfaces that still read the validation view; all measured, corpus reach 0 of 3,383] Session 295: an indent-4 non-kernel opener below a thematic break, definition, code line, comment, table, line block, closing HTML tag or closed kernel cell is indented code

`src/core/qmd/model.ts` (`bd2eb301` claim; slices `f66d2054`, `e95386ec`, `5054f40c`, `fc1602c8`, `c5641628`, `9acca86e`, `f6229aa9`, `b01d21ad`; fixes `b5002b1d`, `8cc5001d`, `33afabf1`, `740cfdef`, `67f8f9a0`): the backlog's residual 3 said the free case's block-boundary list (`endsBlock`, five line shapes) was incomplete, so both builds deleted the heading inside an indented `{bash}` opener sitting directly under a break, a table, a definition, a comment, a closing tag or an indented code line. Measured first: an 87-construct grid x three contexts (after a blank line, under a heading, under a prose line), 129 HTML tag names x six shapes (774 documents), an outer-element grid, a 225-pair stacking matrix, a 16 construct x 10 reader grid (320 documents), and seven blind authoring agents (458 documents). Six rules, each test first (RED shown): a thematic break, a link-reference definition and an indented code line that began at a boundary end the block (a bullet-spelled `- - -` no longer opens a list container there); a column-0 comment, a comment region closed at the end of a line, a line of 7+ hashes; a pipe table, grid table or line block read as a RUN of text; the closer of a real kernel cell; a raw HTML block element that completes on the line above (exactly `PANDOC_BLOCK_CLOSE_TAGS` plus `PANDOC_EITHER_TAGS`, any indent, a lone `<div>`, not inside an open `pre`/`script`/`style`/`textarea`). The first cut asked the scanner's `paragraphOpen` whether the construct began fresh, which is false after raw TeX, a comment and a break; two adversarial rounds (542 and 532 documents) found 9 documents HEAD had right that it broke, fixed by reading the TEXT above (`startsAtBoundary`, `isBoundaryLine`, `runStart`) and by `headingAngleEnd` for tags, and a reader grid found that the first cut listed a heading `markdown_strict` swallows (no pipe tables, line blocks or grid tables there), so tables and line blocks are gated by `freeCaseTableReader`, comments are ungated (after a blank line they end the block under all ten readers) and the HTML rule runs outside pandoc's markdown only for a run that begins with a tag. Three mutation rounds (42 -> 65 -> 63 -> 67 single-term mutants): the final 67 leave 7 survivors, all proved unobservable over 4,665 rendered documents, and the rounds removed three harmful or dead terms (`lastFenceLine`, a delimiter-shaped-header guard, the CommonMark gate on comments). Final: 4,689 probe documents scored, 1,588 fixed, 0 regressions; Session 293/294's 2,160 probes 0 regressions; corpus 0 of 3,383 changed; real-document score unchanged at 2,423 of 2,438; 4,225 unit tests (was 4,028); `check-backlog` OK. Residuals filed in the backlog item (stacked enders of different kinds, a definition's title on the next line, simple and multiline tables, a grid span border, `Some text <div>`, the CommonMark readers, a self-closing `<script/>`). Cost: 21 authoring agents (about 1.63M subagent tokens), 4,707 renders at 3 wide or fewer, no screen-taking run (`test:integration` not run: core-only change). Close-out: `SESSION_NOTES.md` trimmed to three pairs (drops the Session 291/292 pair, `f62cfcd2`); the dashboard and context-budget history lines this session's runs appended (`f00c94aa`); `npm run package` exit 0 (compile with both type checks, bundle, `check-package` OK with 42 files, `.vsix` of 44 files and 1.84 MB, about 15 minutes because `vsce` walks the 65 GB untracked `scratchpad/`); `check-backlog` OK; a headless `buildOutline` check lists the heading and no bogus bash cell for a break and for a pipe table, and keeps the swallowed heading under `markdown_strict`; `quality_ratchet` 2/2 pass (results `bba236856bad`, manifest `8845021a4049`, head `d7f5227a`; the first run timed out at the runner's 600 s default, see the receipt).

### 2026-10-06 · [BL-Kernel-cell closing and the unbounded second look — what Session 293's rules still leave: non-kernel languages at indent 4+ under jupyter, fences deeper than a container's code depth under markdown, and the surfaces that still read the validation view; all measured, corpus reach 0 of 3,383] Session 294: under jupyter a cell is the document's kernel language or a handler, and every other indented opener in the free case is indented code

`src/core/qmd/model.ts`, new `src/core/qmd/jupyter-kernel.ts` (`71f6f443` claim; checkpoints `56b34867`, `623dd19f`, `ad00f65e`, `67d818fa`, `8539b37e`, `77f96f9b`, `35196f6c`, `cff15b72`, `0b5f0622`): the backlog's residual 1 said `{bash}`, `{sh}`, `{js}`, `{julia}` and `{sql}` at indent 4 under jupyter are plain pandoc fences that this model swallowed. Rendering 51 languages (102 documents, `scratchpad/s294/g1`) showed the rule is a NEGATIVE list: quarto lists the heading for every language but `python` (the kernel), `ojs` and `mermaid` (handlers) and `dot` (claimed, the render fails), `{ipython}` and `{Python}` included. Then two adversarial rounds (ten authoring lenses, rendered by the caller, scored per probe against quarto) found two defects of MY OWN design, both fixed test-first: (1) the kernel is not always python (`jupyter: {kernelspec: {language: julia}}` makes `{julia}` the swallowing cell and `{python}` the plain fence; 5 round-1 regressions), so `jupyterKernelLanguage` reads it from the front matter (python by default, the explicit `kernelspec.language` in any spelling, `null` for a kernel named but not described, which keeps the old behaviour: quarto fails that render, so it is a pinned CHOICE) and every rule that named `python` (the skip, the exact-indent closer, the dead partition) now reads it; (2) "no key found" had answered python for front matter the reader could not read (7 round-2 regressions: an escaped or complex key, an indented root, JSON, a multi-line flow document, a decoy inside a quoted scalar, a mid-document metadata block), so python is now claimed only for front matter the reader sees through. Evidence: Session 294's own sets score 917 documents, 462 fixed and 58 regressed, every regression a PHANTOM in one family (a blank line inside a raw HTML element, a raw TeX environment, a quarto-removed div or a multiline table, where the model keeps no state and the old pairing was right by accident; a 70-construct census and a 48-document grid found the one trigger, an indent-4 text line under a non-div block tag; all pinned as RESIDUAL rows and filed with the census); Session 293's 1,124 rendered probes give 0 regressions and 17 fixes; the engine-aware corpus (3,383 documents) is byte-identical, so the real reach is ZERO; the real-document score is unchanged at 2,423 of 2,438. Tests 3,781 to 4,024, types clean. Mutation: 27 mutants of the new terms killed; the 28th, the `engine === "jupyter"` term of the skip, was EQUIVALENT (the kernel is null under every other engine) and was removed. Disclosures: guard rows (the context rows, the other-engine rows, the fail-safe rows, 38 of the 70 kernel rows and the python parser rows) passed on arrival; one commit message (`dfa7b93c`) carried a wrong document count and was amended to `67d818fa`; one `npm test` run failed once (1 file, 1 test; I did not capture which) and has not repeated in every full run since (five consecutive green runs were checked on purpose); the cause is unknown; `test:integration` NOT run (needs the screen; core-only change), and the Outline tree the providers build was checked headlessly (`buildOutline` with the resolved engine lists the heading and no bash cell). Non-commit actions: two workflows (`wf_488ed8c3-b41` 6 agents, about 1.14M subagent tokens; `wf_bbf40e65-169` 4 agents, about 0.93M), both told never to render, about 1,270 `quarto render --no-execute` runs by the caller at 3 wide or fewer, each `*_files` folder deleted right after and each batch of 12 held until the 1-minute load fell below 25 (the load of 37 to 55 was other projects' VM, Playwright and `next-server`); a scratch scorer that REFUSES a stale bundle; the dashboard run (76/100, the same critical flag, 21 vulns; its copy is v2.18.0 against canonical v2.21.0, an update the operator may want); the BACKLOG item rewritten (residual 1 gone, nine measured residuals kept, the raw-block item given the census) and PROJECT_LEARNINGS rows 630 to 635. Close-out commits: `8d06aa93` (the five close-out documents), `c455e7bb` (SESSION_NOTES.md trimmed to three pairs in its own commit; the Session 290 evaluation and Session 291 self-assessment pair dropped, `git show 8d06aa93:SESSION_NOTES.md` recovers it), `2950fcad` (the dashboard and context-budget history lines this session's runs appended). `npm run package` (compile with both type checks, bundle, `check-package` OK with 42 files, a 44-file 1.84 MB `.vsix`, 13 minutes) exit 0. Memory `feedback_cap_render_load` extended. After close-out a reviewer's pass over the new module measured two QUADRATIC regexes in it (`KEY_LINE` and the comment strip in `scalarOf`): one 30,000-space front-matter line cost about 550 ms through `findHeadings`. Fixed test-first with four timing rows (150 ms budget; hostile lines now 0.5 to 3.7 ms), tests 4,024 to 4,028, the 27 mutants still all killed with no skips; learning 636. `quality_ratchet: 2/2 pass · 0 fail · 0 unmeasured · results bba236856bad · manifest 8845021a4049` at head `592f7628`, the head the results file records, read rather than assumed (the first run read 1/2 because `ledger-lag` was 2 until a commit touching this file landed; the second ran before the performance fix and was repeated after it).

### 2026-10-06 · [BL-`indentedCellFenceAt` over-reaches with NO container open and NO paragraph open] Session 293: a jupyter python cell closes only at its own indent, an unclosed one is dropped, and engine markdown has no indented-cell look outside handlers

`src/core/qmd/model.ts` (`2a243264` claim; checkpoints `51e86bbc`, `06ca4176`, `3c9ee863`, `a2e4f1aa`): the backlog item blamed an "over-reaching second look"; rendering showed the real cause is the closer. Quarto's jupyter RENDER partitioner pairs a python cell only with a closer at a BYTE-IDENTICAL indent (128 documents, opener x closer indent x blank|paragraph above, both modes exit 0: HEAD deleted the heading inside on 112), while its YAML-VALIDATION partitioner pairs at any indent (S178, re-measured), so the any-indent `CELL_FENCE_CLOSE` stays for every caller that passes no engine. Ten rules, each test-first (RED shown first): (1) engine jupyter + python: exact-indent closer (`closesOnOwnIndent`, `OpenCellFence.indent`, the `ci|` index bucket, `isCloser`); (2) an opener with no exact closer is DROPPED, not paragraph text: the line below starts a fresh block when a closer-shaped line lies below, glues to the paragraph above when none does; (3) engine markdown: the unbounded second look is skipped for an indent-4+ `{lang}` line, except `ojs`, `mermaid`, `dot` (20 languages measured); (4) the dropped line is no setext title; (5) after a dropped kernel opener no later python cell is a cell (the partition never recovers; handlers still pair); (6) the handler exemption (round 1 found slice 3 had broken 20 HEAD-correct probes, 8 deletions); (7) the markdown skip applies only in the FREE case; (8) `CELL_FENCE_CLOSE` ends in `\s*` as quarto's does; (9) the free case means a block boundary directly above (`endsBlock`); (10) a `(@)` example marker above withdraws it. The no-paragraph term was measured redundant and removed. Two older tests that PINNED the divergence (Sessions 277 and 280) flipped to quarto's answer after their documents were re-rendered. Evidence: 1,031 rendered probes scored per probe against quarto with the engine each document resolves to (the matrices, six round-1 lenses of 415 and three round-2 lenses of 193 documents; every claim is quarto's, never an agent's): 593 fixed, 2 regressions, both phantoms of older families (a TeX environment spanning a blank line; quarto's partition being blind to outer fences), ZERO deletion regressions; the jupyter grid 16 to 128 right, the markdown grid 96 to 128, knitr unchanged. Corpus (engine-aware, 3,383 documents: markdown 981, jupyter 41, knitr 2,199, unresolved 162): 0 changed; real-document score unchanged at 2,423 of 2,438; a naive textual scan found indented or mismatched cells only in knitr documents, so the real reach is ZERO. Tests 3,723 to 3,781, types clean. Mutation: every term killed except the quote term of `indentedCellFenceFor`, unobservable over 1,075 probes and documented. `test:integration` NOT run (needs the screen; core-only change); the Outline tree the providers build was checked headlessly (`buildOutline` with the resolved engine: `[cell, A, B]` where HEAD gave `[cell, cell, B]`). Non-commit actions: two workflows (`wf_855ac535-03f` 6 authoring agents, about 1.03M subagent tokens; `wf_711854f5-eea` 3 agents, about 0.59M), both told never to render, the caller rendering at 2 to 3 wide; one agent left about 2,000 working files in `scratchpad/s293/adv/L4work` (untracked); the `*_files` library folders of every render batch were deleted after scoring because Spotlight indexing, not quarto, took the load to 209; the dashboard run (76/100, the same critical flag, 21 vulns; its copy is v2.18.0 against canonical v2.20.0, an update the operator may want); memory `feedback_cap_render_load` refined; the BACKLOG item replaced by the residual item *"Kernel-cell closing and the unbounded second look — what Session 293's rules still leave …"* (nine measured residuals) and PROJECT_LEARNINGS rows 623 to 629. `SESSION_NOTES.md` was trimmed to three pairs in its own commit (the Session 289 evaluation and Session 290 self-assessment pair dropped; `git show ed8b15b9:SESSION_NOTES.md` recovers it). quality_ratchet after the trim commit: 2/2 pass, results bba236856bad, manifest 8845021a4049.

### 2026-10-05 · [BL-Three callout-title shapes still wrong beside the direct-child rule — div lifetime, reader-dependent lazy continuation, and the tabset rule's own holes; all DELETE, all PRE-EXISTING, all at zero corpus reach] Session 292: a fenced div that ends early (its quote or list item ended) stops claiming the Outline's headings, in nine rules

`src/core/qmd/model.ts` (`4be8a9c6` claim; checkpoints `26735481`, `42a5ef54`, `ebf6759f`, `01a778a7`, `a8544d80`, `3304e6e2`, `29fc0ef6`, `d06b16b7`, `96fc8114`): a callout swallows its first heading and a `.panel-tabset` swallows each tab heading only while the div is alive, and the model kept a quote- or list-hosted div alive past its container. Shipped as FLAGS, not pops (`ended`, read through `liveDiv`), so the div stack evolves exactly as at HEAD: (1) a marked blank with fewer `>` than the opener ends it; (2) where an ATX line interrupts a paragraph (a resolved reader without `blank_before_header`), an ATX line with fewer markers ends it; (3) the lazy-opener depth carry is textual-only (not `commonmark`/`commonmark_x`/`gfm`); (4) a marked blank ends a list item hosting a div, flagged by comparing the dedented line with the host column read from the opener's own position; (5) a dedented ATX ends a CommonMark list item's div; (6) a heading in a quote nested inside a quoted tabset is not a tab once the level is learned; (6b) a shallower heading directly below a deeper quote line is lazily inside it under textual-lazy readers; (8) an unmarked closer resets the carried quote depth (closes the back-to-back callouts item). TDD, RED shown at the previous checkpoint for every slice; each slice's reader and geometry rule came from a fresh rendered matrix (65, 78, 18, 8 and 60 documents). Evidence: 45,940 cached renders, FINAL omits fewer of quarto's headings on 622 and MORE on 0; 5,566 fresh adversarial probes from nine lenses, right 1,238 (HEAD) to 2,882, 2,033 fixed, ZERO deletion regressions, 36 genuine phantoms, 46 old defects un-masked (plain-div twin already wrong at HEAD), 18 un-twinned phantoms; real-document score unchanged 2,423 of 2,438; corpus 0 of 3,383 differ; 3,634 to 3,723 tests; mutation 26 of 32 killed, the six survivors proved unobservable and documented. Found by the adversaries and fixed: the first design popped early and moved later closers onto other divs; the global column pop deleted headings on the default reader (49 genuine deletions in variant D, 36 in E) and was replaced by a div-only flag; a tab/compact-marker guard blocked 30 correct answers in a 40-document rendered sample (the unguarded build was right on 30, the guarded on none) and was dropped. Two Session 291 residual rows flipped to the rendered truth (the Session 258 G21 pin was flipped by the first cut and restored when the global pop went); BACKLOG item rewritten to what is left. Disclosed: the nine-lens workflow was STOPPED EARLY by me because its renders drove the load average to about 500 (the operator asked); the `markers` lens produced 13 probes with truth, `refute` none, and the verifier stage never ran, so regressions were triaged by me with plain-div twins. `test:integration` NOT run (needs the screen; core-only change). Non-commit actions: the stopped workflow `wf_e017682a-4b9`, orphan render processes killed by path, memory `feedback_cap_render_load`, and about 440,000 regenerable scratch files of mine deleted (the unrendered `adv/default/pool*` and `adv/markers/pool*` input pools and the `*_files` library folders of this session's renders) because the ratchet's release-gate (`check-package` runs `vsce ls`, which walks the whole untracked `scratchpad/`) took about 15 minutes against the ratchet's 600-second limit and read as `127`; it now takes about 7 minutes and passes (quality_ratchet 2/2, results bba236856bad). Pruning older sessions' scratch is the operator's call.

### 2026-10-05 · [BL-The callout rule's "the first block is a heading" test never checks that the heading is a DIRECT child of the div — a heading inside a block quote or list item that opens the callout is suppressed] Session 291: a heading inside a quote or list item that opens a callout is no longer suppressed by the Outline

`src/core/qmd/model.ts` (`calloutTitleTakes`, the setext call site, the first-block marker, the div entry): a callout's first heading is its title bar only when it is the div's first BLOCK and a DIRECT child. Decided by (1) STRICTLY MORE `>` markers than the opener's effective depth, judged at the ATX line or the setext UNDERLINE (fewer or none is a lazy continuation, still lifted; a lazy opener sits at the depth of the quote it continues, carried through unmarked lines; an unmarked underline indented past the host's content column in an UNQUOTED callout hands the decision to the title line's own depth); (2) a setext title whose list marker `setextTitleText` strips (a bullet, or an ordered marker over an underline at the content column) is a heading inside a list item; (3) a bare `>` deeper than the opener is an empty quote and so the first block, recorded in a new `firstBlockLine` so the tabset rule keeps `firstContentLine`. **The filed item was half right:** its LIST half was not the callout rule's at all — an ATX heading on a list-marker line is dropped everywhere (the Session 261 marker-line item), which a plain-div twin showed in minutes (`twin.cjs` + `cmp.cjs`, ATTR CALLOUT-ONLY / BOTH / TWIN-ONLY); the list shapes the callout rule alone deleted are a setext title on a bullet or content-column ordered marker line. Evidence: workflow 1 (10 agents, ~2.5M tokens, five measuring lenses + five refuters, ~8,000 rendered probes) and workflow 2 (4 blind adversarial lenses, ~1M tokens, ~14,000 probes), every claim re-classified mechanically against HEAD and the final build; ~2,900 callout probes deleting to right. 158 probes of the adversarial grid and 17 of the measuring grid go right to PHANTOM, none right to deleting, and each is a pre-existing defect the old over-broad rule had hidden (the plain-div twin is wrong at HEAD too): the ordered-lookalike marker grammar (`Fig.`, `A.`, `Dr.`, `(ab)`, 142), a callout inside a REMOVED conditional block, a lazy opener after two bare nested markers (2). The change is MONOTONE by construction and proved so without an oracle: 196,156 documents (every scratchpad source plus the 3,383-document corpus), 5,319 changed, 5,397 headings added, 0 dropped. Score unchanged 2,423/2,438; corpus 0 of 3,383 moved. TDD: RED shown for each of 14 slices; 3,634 tests (+44); every term of the rule killed by a mutant after two redundant terms (`inQuote`, an entry-depth guard) were removed. Two defects of MY making surfaced only through independent lenses and are fixed: the first cut copied the tabset rule's `inQuote` + `containerDepth` terms (111 HEAD-right probes became phantoms; the mutation run had shown both terms unpinned), and moving the shared `firstContentLine` for the empty-quote rule stopped tabsets learning their tab level. Disclosed, not fixed (two new BACKLOG items; pinned as `RESIDUAL` rows): div lifetime across a marked blank of fewer markers, reader-dependent lazy continuation under the CommonMark-family readers, the tabset rule's own nested-quote hole, the AST first-block cases (footnote / link-reference definitions, YAML above the heading, theorem-like divs). Learnings #613-#617. No `test:integration` run (needs the screen; core-only change). Commits: claim `7f8e5dc0`, checkpoints `2ed0b821`, `d40b82b2`, `3c003149`, `94eace04`, close-out. BACKLOG item replaced by its residuals.

### 2026-10-05 · [BL-The class-ORDER rule compares only callout-vs-tabset, but quarto dispatches a div to the FIRST class that has ANY registered handler — so `.content-visible` written first wins, and this model still suppresses] Session 290: a conditional class written before a callout/tabset class takes the div dispatch, so the Outline no longer deletes its headings

`src/core/qmd/model.ts` (`5ca18838`): quarto dispatches a div to the FIRST class token that names a registered handler (the callout family, `.panel-tabset`, or `.content-visible` / `.content-hidden`), and the model compared callout-vs-tabset only, so a conditional written first lost the callout's first heading and every tab heading (a deletion). `divHandlerOf` / `firstDivHandler` decide the structured path; the regex fallback gains `conditionalClassIndex` and reads every class from the quote-masked spec (`legacyDivPanelTabset` had read the unmasked one, so a quoted value holding ` .panel-tabset ` made a plain div a tabset; 27 probes deleting→right as a by-catch). Evidence: 1,923 measurement probes in six lenses (only nine class NAMES ever change a dispatch; 0 of 3,383 corpus documents write any class before a callout/tabset) and 3,679 adversarial probes in four lenses, each claim re-rendered by a refuter. TDD: 71 tests, 31 RED at HEAD, RED shown per slice; 12 mutants killed (one survived round one: fused-value guards added). A refuter found the first cut deleted one MORE heading than HEAD in a contrived `commonmark_x` shape; fixed. Re-classifying 4,366 rendered probes against HEAD, the first cut and the final build: 1,292 deleting→right, 107 deleting→phantom, 97 right→phantom (63 where the condition REMOVES the block, 21 theorem/proof, 13 near-miss spellings), 0 right→deleting, 0 deleting more than HEAD. Score unchanged 2,423/2,438; corpus 0 of 3,383 moved; 3,590 tests, types clean. Disclosed, not fixed: removal is not modelled (a phantom; `BACKLOG.md`'s format-gated item records the position taken), a dot-fused class under `commonmark_x` (pinned), and the regex-route residuals (one new BACKLOG item). Commits: claim `b8effaa1`, `5ca18838`, close-out. BACKLOG item removed.

### 2026-10-02 · [BL-The raw-block swallow family is UNBOUNDED in construct space, and it now includes a DELETION shape] Session 289: unclosed `<!--` no longer empties the Outline

`findHeadings` (`src/core/qmd/model.ts`, `f4939251`): a `<!--` with no `-->` on any line below is paragraph text under pandoc's markdown readers (rendered, 55 probes, both modes), so it falls through as a body line; `gfm`/`commonmark`/`commonmark_x` keep swallowing to EOF (CommonMark HTML block). TDD, RED shown; 48 pinned rows; three mutants killed. Score unchanged 2,423/2,438; 0 of 3,383 corpus documents move. A 4-lens workflow (655 probes) found no deletion; accepted phantoms: mid-document/project `from: gfm`, tabset titles (pre-existing). BACKLOG item trimmed.

### 2026-10-01 · [BL-R6 residuals — what the positively-established silence rule leaves at HEAD's answer] Session 288: shape (d), values the knitr reader does not evaluate, shipped

`src/core/qmd/model.ts`: `splitRHeaderArguments` splits the chunk header as R arguments (balanced brackets, escaped strings, unnamed slots, `%op%`), `evaluateRLogical` reads `TRUE`/`FALSE` with `! & && | || ( )` at R's precedence, `KNITR_PIPE_FALSE` covers all twelve YAML false spellings, and `#| echo: !expr <logical>` is read. Also fixes a PRE-EXISTING deleting defect: an R raw string `r"(...)"` hid an `echo=FALSE` from R but not from the old reader (3 rendered rows). From 310 probes in both modes (modes agreed on all that render) and a 4-lens adversarial pass (4,990 probes; 242,547 expressions differential-tested against R, 0 mismatches). TDD: RED shown for each of five slices; seven mutants killed. 3,471 tests pass, types clean; score unchanged 2,423/2,438. The pass reproduced three pre-existing or contrived deleting hazards (bare `F` reassigned, `opts_hooks`/redefined `&`, output-printing echo-silenced chunks); disclosed in `BACKLOG.md`, not fixed. Commits: claim `ca8ddd4a`, `aa8078e9`, `5982b8b1`, close-out.

### 2026-10-01 · [BL-R6 residuals — what the positively-established silence rule leaves at HEAD's answer] Session 287: shape (b), document-level echo/include defaults, shipped

`knitrDocumentDefaults` in `src/core/qmd/model.ts` reads `execute:` / `knitr: opts_chunk:` / top-level `echo`/`include: false` from the leading front matter by ACCOUNTING (counts every such key, trusts an option only when each was read); doc `echo` is trusted for r/R/python/awk/css/js/node/rcpp only (shell-like engines are loud when executed), doc `include` for all twelve. TDD: RED shown for the placement, engine-split and 7 adversarial rows; three mutants killed (6, 1, 4 rows). A 4-lens adversarial workflow (1,264 probes) found 3 real defects, all fixed: a quoted `#` hiding a key, `? echo` explicit keys / column-0 flow continuation, and `opts_chunk$set` runtime defaults. Score unchanged 2,423/2,438; 3,318 tests. Residuals filed in BACKLOG (b).

### 2026-10-01 · [BL-R6 residuals — what the positively-established silence rule leaves at HEAD's answer] Session 286: shape (a), non-R engines, shipped

`KNITR_SILENT_ENGINES` in `src/core/qmd/model.ts` extends the silence rule from R to python, bash, sh, zsh, perl, ruby, awk, rcpp, css, js and node, from 130 rendered probes in both modes; an empty chunk stays silent only for r/python (found by the adversarial pass, re-rendered firsthand). Unestablished engines keep HEAD's answer (listed in `BACKLOG.md`). TDD, RED shown; 3,246 tests passing; score unchanged 2,423/2,438. Commits: claim `86e2ddcc`, fix and close-out `79fa2e40`.

### 2026-10-01 · [ad hoc] Dropped the oldest close-out pair from SESSION_NOTES.md (S281 evaluation + S282 self-assessment)

S256 retention rule: the live file holds three pairs. The dropped pair is one `git show` away. No other edit in the commit.

### 2026-10-01 · [BL-R6 residuals — what the positively-established silence rule leaves at HEAD's answer] Shipped shape (c): a knitr chunk with no code is silent, so a stray fence above it stays unclosed

Session 285, TDD (RED for the empty-chunk row and for the four external-code rows against a naive rule, then GREEN; 9 pins and controls after). `knitrChunkHasNoCode` in `knitrChunkIsSilent` (`src/core/qmd/model.ts`). Rendered with quarto 1.7.33, both modes, probes in `scratchpad/s285/`. `file=`/`code=`/`ref.label=` excluded (they echo); `child=` kept at HEAD's answer (disclosed). Mutant killed (4 tests). Real-document score unchanged 2,423/2,438. 3,208 tests passing, types clean. Shape (c) marked CLOSED in the BACKLOG item. Claimed in `a6c77146`.

### 2026-10-01 · [ad hoc] Backfilled (reconcile-on-read): undocumented commit e7e8a156 -- SESSION_NOTES.md trim

Phase 0 of Session 285 found one commit past the ledger frontier (`1f166d35`): `e7e8a156` dropped the oldest close-out pair (S280 evaluation + S281 self-assessment) from `SESSION_NOTES.md` per the S256 retention rule. Source: `git log`. No behaviour change.

### 2026-10-01 · [BL-Under `commonmark_x`, `::: {.callout-note title="   "}` is a callout whose title is the heading below it, and this model keeps that heading] Shipped: a whitespace-only (ASCII space/tab) double-quoted callout title is empty under commonmark_x

Session 284, TDD (4 RED rows, then GREEN; 3 guards). Fix in `legacyDivCalloutTitleSlot` (`src/core/qmd/model.ts`), scoped to the commonmark dialect. Rendered with quarto 1.7.33. Real-document score unchanged 2,423/2,438. 3,193 tests passing. Item removed from `BACKLOG.md`; learning #606.

### 2026-10-01 · [BL-P3 exposes two PRE-EXISTING phantom families that a refused opener used to hide by accident] Measured corpus reach of both families: zero; decided no src/ change
- **Change:** claimed S283 (`8f685bc0`), scanned all 3,383 authored documents for tabset openers with a non-heading first line, raw TeX environments, `<script>`/`<pre>` and unclosed `<!--` holding a `#` line, and compared model vs quarto heading counts. Reach is 0 for both; the realdoc score is unchanged (2,423 of 2,438). The item stays in `BACKLOG.md`, deferred, with the measurement appended; learning #605 added.
- **Commit/PR:** the close-out commit following `8f685bc0`
- **Session:** S283
- **Model:** Claude Sonnet 5.5 (claude-sonnet-5-5)

### 2026-10-01 · [ad hoc] Dropped the oldest close-out pair from SESSION_NOTES.md (S278 evaluation + S279 self-assessment)
- **Change:** `SESSION_NOTES.md` retention rule (CLAUDE.md, three pairs steady state). The dropped pair is recoverable with `git show HEAD~1:SESSION_NOTES.md` (the close-out commit).
- **Commit/PR:** this entry's own commit
- **Session:** S282
- **Model:** Claude Sonnet 5.5 (claude-sonnet-5-5)

### 2026-10-01 · [BL-The attribute spec is matched with regexes and never TOKENIZED as pandoc tokenizes it, so an opener pandoc REFUSES is still read as a callout — plus seven grammar gaps beside it] Closed out Session 282 -- P3 shipped
- **Change:** close-out record: `HANDOFFS.md` receipt complete, `SESSION_NOTES.md` pair written, learning #604, `BACKLOG.md` tokenizer item updated (P3 shipped; what it deliberately leaves). The plan's P1-P3 are done; P4 stays optional.
- **Commit/PR:** this entry's own commit
- **Session:** S282
- **Model:** Claude Sonnet 5.5 (claude-sonnet-5-5)

### 2026-10-01 · [BL-The attribute spec is matched with regexes and never TOKENIZED as pandoc tokenizes it, so an opener pandoc REFUSES is still read as a callout — plus seven grammar gaps beside it] P3 C3 -- runtime gate: refused openers keep their headings in the real host
- **Change:** `test/integration/suite/outline.test.ts` gains one row (bare-key callout, refused inner opener in a tabset, plus the two accepted-opener controls). Run with the operator's explicit go-ahead right before launch: `npm run test:integration`, 554 passing, 0 failing.
- **Commit/PR:** this entry's own commit
- **Session:** S282
- **Model:** Claude Sonnet 5.5 (claude-sonnet-5-5)

### 2026-10-01 · [BL-The attribute spec is matched with regexes and never TOKENIZED as pandoc tokenizes it, so an opener pandoc REFUSES is still read as a callout — plus seven grammar gaps beside it] P3 adversarial pass: 6,477 documents, 38 phantom-direction regressions filed and pinned
- **Change:** one workflow (12 agents, 0 errors, ~0.83M subagent tokens): six lenses (containers, readers, tokenizer boundary, closer pairing, interplay, multi-line/TAB) and six re-scores of the plan's closer-pairing items. Raw result files, re-aggregated firsthand: 999 FIXED, 38 REGRESSION (the agents' own summaries said 0), 0 of them losing a real heading. All 38 reduce to two pre-existing phantom families (refused opener as a tabset's first content; inside a raw TeX or raw HTML block) that HEAD hid by accident -- each identical with plain text in the same spot (`scratchpad/s282/ctl`). Pinned as 3 RESIDUAL rows; filed in `BACKLOG.md` with the `commonmark_x` `title="   "` phantom. Closer-pairing re-score: 2 of 6 items moved toward quarto (5 to 7 and 6 to 7 of their witnesses), 4 did not move, none away.
- **Commit/PR:** this entry's own commit
- **Session:** S282
- **Model:** Claude Sonnet 5.5 (claude-sonnet-5-5)

### 2026-10-01 · [BL-The attribute spec is matched with regexes and never TOKENIZED as pandoc tokenizes it, so an opener pandoc REFUSES is still read as a callout — plus seven grammar gaps beside it] P3 C2 -- a single-line REFUSED `:::` opener is paragraph text
- **Change:** `src/core/qmd/model.ts`: `divOpenerRefused` (fenced-div reader, a measured reader -- no `from:` or base `markdown` -- not CommonMark, no `{{<` or `key= value` pre-pass shape, and the leaf's verdict `refused`, never `open-at-eol`) feeds ONE `divRefused` flag that forces `unmatchedConstruct` and suppresses the `divColumns` push; `divTailMayBePrepassed` is the shared pre-pass test. 36 of the 146 rendered rows move to quarto's answer, 0 regress, 32 stay wrong on purpose (CommonMark, unmeasured readers, multi-line and open-at-eol openers). Three comments that called `title="   "` a blank-looking title are corrected (pandoc refuses the block under markdown). Census: corpus 0/0/0 threw=0; positive control changes exactly patchC's 23 non-`_cmx` documents, each to patchC's headings, none of the 10 `_cmx`. Real-document score 2,423 of 2,438, unchanged. All 10 plan mutants are killed.
- **Commit/PR:** this entry's own commit
- **Session:** S282
- **Model:** Claude Sonnet 5.5 (claude-sonnet-5-5)

### 2026-10-01 · [BL-The attribute spec is matched with regexes and never TOKENIZED as pandoc tokenizes it, so an opener pandoc REFUSES is still read as a callout — plus seven grammar gaps beside it] P3 C1 -- 38 guard and residual rows, all green at HEAD
- **Change:** `test/unit/qmd-model.test.ts` gains describe "Session 282": 21 GUARD rows (accepted openers, the `=` route, open-at-eol openers, TAB columns, a gated-in reader, the 8 rows the null encoding breaks) and 17 RESIDUAL rows asserting HEAD's answer with quarto's recorded. Every expected value was re-rendered with quarto 1.7.33 (146 rows, `scratchpad/s282`); none differed from the plan's recorded truth.
- **Commit/PR:** this entry's own commit
- **Session:** S282
- **Model:** Claude Sonnet 5.5 (claude-sonnet-5-5)

### 2026-10-01 · [BL-The attribute spec is matched with regexes and never TOKENIZED as pandoc tokenizes it, so an opener pandoc REFUSES is still read as a callout — plus seven grammar gaps beside it] Claimed Session 282 for P3 (in progress)
- **Change:** session claim only -- P3 of the attribute-tokenizer plan (single-line refused `:::` openers become paragraph text). Operator approved proceeding past plan §9.5 step 1's drift rule and planning a `test:integration` run.
- **Commit/PR:** this entry's own commit
- **Session:** S282
- **Model:** Claude Sonnet 5.5 (claude-sonnet-5-5)

### 2026-09-30 · [ad hoc] Dropped the oldest close-out pair from SESSION_NOTES.md (S277 evaluation + S278 self-assessment)
- **Change:** `SESSION_NOTES.md` retention rule (CLAUDE.md, three pairs steady state). The dropped pair is recoverable with `git show df56d4ff:SESSION_NOTES.md`.
- **Commit/PR:** this entry's own commit
- **Session:** S281
- **Model:** Claude Sonnet 5.5 (claude-sonnet-5-5)

### 2026-09-30 · [BL-⚠ HIGH — SHIPPED CODE DELETES RENDERED HEADINGS: the TABSET reads never got Session 259's three fixes] S281 closed out -- two backlog items removed, one annotated, receipt complete
- **Change:** `BACKLOG.md` loses the tabset-reads item and the `maskQuotedValues` regression item (both closed by P2; outcome in the entries below) and annotates the attribute-tokenizer item with P2's four measured residuals; `PROJECT_LEARNINGS.md` row #603; `SESSION_NOTES.md` (S280 handoff evaluation, S281 self-assessment, ACTIVE TASK) and the S281 `HANDOFFS.md` receipt, `status: complete`.
- **Commit/PR:** this entry's own commit
- **Session:** S281
- **Model:** Claude Sonnet 5.5 (claude-sonnet-5-5)

### 2026-09-30 · [BL-⚠ HIGH — SHIPPED CODE DELETES RENDERED HEADINGS: the TABSET reads never got Session 259's three fixes] P2 runtime gate -- the Outline row, run and green (553 passing)
- **Change:** `test/integration/suite/outline.test.ts` gains one row (the `m03` apostrophe shape plus a plain-callout and a `.panel-tabset`-in-a-value control). `npm run test:integration` ran with the operator's go-ahead right before launch: 553 passing, 0 failing. Adversarial passes found 0 regressions: 24,000 leaf comparisons against live pandoc, 753 + 1,231 model documents against `quarto render`.
- **Commit/PR:** this entry's own commit
- **Session:** S281
- **Model:** Claude Sonnet 5.5 (claude-sonnet-5-5)

### 2026-09-30 · [BL-⚠ HIGH — SHIPPED CODE DELETES RENDERED HEADINGS: the TABSET reads never got Session 259's three fixes] P2 layer 2 -- a `:::` opener is classified from pandoc's own tokens (markdown family)
- **Change:** `src/core/qmd/model.ts` — `divFenceRole` returns the UNTRIMMED, TAB-expanded `tail` (with `baseColumn`), new `divSpecReading` reads it through the leaf, `divCalloutTitleSlot` / `divPanelTabset` take `(attrs, tail, reader)` and fall back to `legacyDivCalloutTitleSlot` / `legacyDivPanelTabset` for every shape the tokenizer is not faithful for. 56 new rows in `test/unit/qmd-model.test.ts` (33 RED at HEAD, each re-rendered through quarto 1.7.33; 21 guards; 2 TAB-column rows). Census over the corpus: 0 / 0 / 0, `threw=0`; real-document score 2,423 of 2,438, unchanged. Closes the tabset-reads item and the `maskQuotedValues` regression item for markdown-family documents.
- **Commit/PR:** this entry's own commit
- **Session:** S281
- **Model:** Claude Sonnet 5.5 (claude-sonnet-5-5)

### 2026-09-30 · [BL-⚠ HIGH — SHIPPED CODE DELETES RENDERED HEADINGS: the TABSET reads never got Session 259's three fixes] P2 layer 1 -- the attribute-block leaf, its pandoc truth fixture and generator
- **Change:** new import-free `src/core/qmd/attribute-block.ts` (`parseAttributeBlock`, `divOpenerVerdict`), `test/unit/attribute-block.test.ts` (32 rows), `test/unit/attribute-block-truth.json` (804 rows per dialect, live `quarto pandoc` 3.6.3) and `docs/planning/scripts/attribute-block/truth.mjs` (`--check` exits 0). Nothing imports the leaf yet, so behaviour is unchanged. Mutation pass: 11 of 14 killed, the 3 survivors are equivalent.
- **Commit/PR:** this entry's own commit
- **Session:** S281
- **Model:** Claude Sonnet 5.5 (claude-sonnet-5-5)

### 2026-09-30 · [BL-⚠ HIGH — SHIPPED CODE DELETES RENDERED HEADINGS: the TABSET reads never got Session 259's three fixes] Session 281 claimed -- P2 of the attribute-tokenizer plan (in progress)
- **Change:** Phase 1B claim -- `SESSION_NOTES.md` ACTIVE TASK rewritten and a `status: pending` receipt opened in `HANDOFFS.md`. P2 also closes the `maskQuotedValues` regression item; Phase 3F records the outcome.
- **Commit/PR:** this entry's own commit
- **Session:** S281
- **Model:** Claude Sonnet 5.5 (claude-sonnet-5-5)

### 2026-09-30 · [ad hoc] Backfilled (reconcile-on-read): undocumented commit ba6eb69e -- S280 close-out measurement rows
- **Change:** `ba6eb69e` appended the S280 close-out rows to `.context-budget-history.jsonl` and `dashboard_history.jsonl` (data only, no logic). It had no ledger entry; recorded by the Session 281 Phase 0 reconcile. `HANDOFFS.md` needs no new receipt: both commits since its frontier (`e6e64dc7`) are S280 follow-ups already named in the S280 receipt's ledger.
- **Commit/PR:** this entry's own commit
- **Session:** S281 (Phase 0 reconcile)
- **Model:** Claude Sonnet 5.5 (claude-sonnet-5-5)

### 2026-09-30 · [ad hoc] Dropped the oldest close-out pair from SESSION_NOTES.md (S276 evaluation + S277 self-assessment)
- **Change:** `SESSION_NOTES.md` retention rule (CLAUDE.md, three pairs steady state). The dropped pair is recoverable with `git show ba238160:SESSION_NOTES.md`.
- **Commit/PR:** this entry's own commit
- **Session:** S280
- **Model:** Claude Sonnet 5.5 (claude-sonnet-5-5)

### 2026-09-30 · [ad hoc] S280 closed out -- receipt complete, notes written
- **Change:** `SESSION_NOTES.md` (S279 handoff evaluation, S280 self-assessment, ACTIVE TASK) and the S280 `HANDOFFS.md` receipt, `status: complete`. The fix itself is the entry below.
- **Commit/PR:** this entry's own commit
- **Session:** S280
- **Model:** Claude Sonnet 5.5 (claude-sonnet-5-5)

### 2026-09-30 · [BL-A fence directly below an open LINE BLOCK deletes a rendered heading] A fence directly below a line-block row is continuation text, not an opener
- **Change:** `lineBlockContinuationRefuses` and `fromHasLineBlocks` in `src/core/qmd/model.ts`, called from the fence-opener path beside `paragraphInterruptRefuses`. 17 new unit rows (`test/unit/qmd-model.test.ts`, three describe blocks); matrix `scratchpad/s280` went from 15 of 54 divergent at HEAD to 1. The BACKLOG item is removed and its five measured residual shapes filed as one item; learning #602.
- **Commit/PR:** this entry's own commit
- **Session:** S280 · **Verified:** 17 rows RED before GREEN (two corrected after re-measurement), every clause killed by a mutation, `npm run compile` and `npm test` (3,021) green, corpus neutral (2,423/2,438, `model.tsv` and `rawadj.tsv` byte-identical to HEAD); two adversarial rounds, 46 agents, ~1,900 rendered probes, 29 regression documents confirmed and fixed or recorded; none remain except the accepted project-config-reader phantom. Integration suite NOT run (core-only change, no screen-taking run authorised).
- **Model:** Claude Sonnet 5.5 (claude-sonnet-5-5)

### 2026-09-30 · [BL-A fence directly below an open LINE BLOCK deletes a rendered heading] S280 claimed (in progress)
- **Change:** `SESSION_NOTES.md` claim stub and a `status: pending` `HANDOFFS.md` receipt. Phase 3F records the outcome.
- **Commit/PR:** this entry's own commit
- **Session:** S280
- **Model:** Claude Sonnet 5.5 (claude-sonnet-5-5)

### 2026-09-30 · [ad hoc] Backfilled (reconcile-on-read): undocumented commits 2372f469..f73dc05e -- post-S279 housekeeping
- **Change:** no code. Two commits landed after S279's close-out ledger entry: `5263e507` dropped the oldest close-out pair from `SESSION_NOTES.md` (the CLAUDE.md retention rule) and `f73dc05e` appended the post-trim measurement rows to `.context-budget-history.jsonl` and `dashboard_history.jsonl`. Provenance: `git log` and `git show --stat`, read at Session 280 Phase 0.
- **Commit/PR:** this entry's own commit
- **Session:** S280 (Phase 0 reconcile)
- **Model:** Claude Sonnet 5.5 (claude-sonnet-5-5)

### 2026-09-30 · [ad hoc] Measured: the corpus ground truth's exit-1 rows are document failures, not pandoc failures
- **Change:** no code. Re-rendered all 942 non-zero-exit rows of `quarto_v2.tsv` at the fixed arm64 pandoc: 938 exit 1 stay 1, 3 exit -2 stay -2, ordinal 1646 (139) now 0. Recorded as learning #601, `SESSION_NOTES.md` and the S279 `HANDOFFS.md` receipt, now `status: complete`.
- **Commit/PR:** this entry's own commit
- **Session:** S279 · **Verified:** the five named witness ordinals re-rendered by hand, each exit 1 with R "Execution halted"; 26 of a 79-row cause sample unclassified.
- **Model:** Claude Sonnet 5.5 (claude-sonnet-5-5)

### 2026-09-30 · [ad hoc] S279 claimed -- re-measure the knitr exit-1 ground-truth rows (in progress)
- **Change:** `SESSION_NOTES.md` claim stub and a `status: pending` `HANDOFFS.md` receipt. Phase 3F records the outcome.
- **Commit/PR:** this entry's own commit
- **Session:** S279
- **Model:** Claude Sonnet 5.5 (claude-sonnet-5-5)

### 2026-09-22 · [ad hoc] Correction: the claim-commit sha cited in SESSION_NOTES.md's ACTIVE TASK was wrong
- **Change:** `SESSION_NOTES.md` -- the ACTIVE TASK's commit list corrected from `1c2a1ab7` to the real claim commit `5e2f1823`, and the close-out commit `774f67c8` added. The records sha `45ddaf63` was already right.
- **Commit/PR:** this entry's own commit
- **Session:** S278 · **Verified:** ⚠ **The wrong sha was written BEFORE the commit existed** -- an unverified identifier in the one file Phase 0 orders every session to read, which is the same class of defect as publishing a test count as an expectation (#600, and this session's own criticism of its predecessor). Both shas are now read back from `git log --oneline --grep`: `5e2f1823 docs(session): claim Session 278`, `45ddaf63 docs(records): the x86-pandoc item is fixed at the root`, `774f67c8 docs(session): close out Session 278`. The lesson: write commit references AFTER the commit, or leave the slot empty.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-22 · [ad hoc] The post-trim budget measurement row backing the entry above
- **Change:** `.context-budget-history.jsonl` -- the row `python3 context_budget.py` appended when run against the committed trim.
- **Commit/PR:** this entry's own commit
- **Session:** S278 · **Verified:** the appended row reads `"SESSION_NOTES.md": 18064`; the file is 255 lines, both inside the 120,000 B / 400-line ceilings, with no line over 280 B. Still OVER, pre-existing and owed: `HANDOFFS.md`, `BACKLOG.md`, `PROJECT_LEARNINGS.md`.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-22 · [ad hoc] The oldest close-out pair dropped from SESSION_NOTES.md (S274 evaluation + S275 self-assessment)
- **Change:** `SESSION_NOTES.md` -- the oldest pair removed so the live file holds three, the steady state the retention rule sets. 70 lines deleted and nothing else in the file touched (upstream BL-36). ⚠ **This supersedes a sentence in the close-out entry above**, which said the NEXT session owed this trim: the rule puts it at Phase 3D, on the session that writes its own pair, and that is this one.
- **Commit/PR:** this entry's own commit
- **Session:** S278 · **Verified:** `grep -c '^## Session '` -> **6**, i.e. exactly three pairs (S277 evaluation by S278 / S278 self-assessment, S276 by S277 / S277, S275 by S276 / S276); `git diff --stat` for the commit reads `1 file changed, 70 deletions(-)` -- deletions only. The dropped pair stays one command away: `git show 774f67c8:SESSION_NOTES.md`.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-22 · [ad hoc] Session 278 close-out -- the handoff receipt, the predecessor evaluation and the self-assessment
- **Change:** `HANDOFFS.md` -- the S278 receipt completed from `status: pending` to `status: complete` with all six requirements, `predecessor_score: 7` and `self_score: 8`. `SESSION_NOTES.md` -- ACTIVE TASK rewritten for the next session, plus the close-out pair (S277 evaluation + S278 self-assessment). ⚠ The S277 evaluation states in its first line that it was written by the same model that wrote the handoff it scores, so it is a self-check rather than an independent score.
- **Commit/PR:** this entry's own commit
- **Session:** S278 · **Verified:** `quality_ratchet: 2/2 pass · 0 fail · 0 unmeasured · results bba236856bad · manifest 8845021a4049` at head `45ddaf63` -- the head the RESULTS FILE records, read rather than assumed. `npm run compile` exit 0, `npx vitest run` 66 files / 3004 passed, `check-backlog` OK 216 open items. `SESSION_NOTES.md` 325 lines with no line over 280 B; it now holds FOUR close-out pairs, so the next session owes the retention trim (`CLAUDE.md` §SESSION_NOTES retention) in a commit of its own.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-22 · [BL-`/usr/local/bin/pandoc` on this machine is an x86_64 binary, and every knitr render through the default PATH exits 1] FIXED at the root -- the item removed, the retired workaround recorded, and the ground-truth question it blocked handed on
- **Change:** `BACKLOG.md` -- the x86-pandoc item DELETED (fixed, not deferred); 216 open items. `PROJECT_LEARNINGS.md` -- row #600, which records what the compound workaround hid and why the obvious PATH fix would have been wrong. ⚠ `PROJECT_LEARNINGS.md` #591/#599, the S277 receipt's `runtime_smoke` and gotcha (5), and the S276/S277 close-out pairs are append-only history and are deliberately NOT edited: they were true when written, and the live guidance lives in `SESSION_NOTES.md`'s ACTIVE TASK and in the S278 receipt, which name the superseded claim explicitly.
- **Commit/PR:** this entry's own commit
- **Session:** S278 · **Verified:** after the removal, at the DEFAULT PATH, no workaround, no cache: `which -a pandoc` -> `/opt/homebrew/bin/pandoc` alone (arm64, 3.11); `test/fixtures/sample.qmd` exit 0; both `r5tilde` `.Rmd` probes exit 0 and AGREE with the shipped build; `npm run test:integration` **552 passing, 0 failing, exit 0** (go-ahead taken BEFORE the launch), against S277's 547/5 on the identical tree. `git grep` confirms the only remaining live mention of the workaround is the line that retires it. `node check-backlog.js` OK, 216 open items. No `src/` or `test/` file touched by this session at all -- `git diff` against S277's close-out is empty for both trees.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-22 · [BL-`/usr/local/bin/pandoc` on this machine is an x86_64 binary, and every knitr render through the default PATH exits 1] Session 278 claimed (in progress) -- the environment item is FIXED; the records that depend on it are being corrected
- **Change:** `SESSION_NOTES.md` ACTIVE TASK rewritten to claim the session; `HANDOFFS.md` opens the S278 receipt at `status: pending`. No `src/` or `test/` file touched.
- **Commit/PR:** this entry's own commit
- **Session:** S278 · **Verified:** the operator removed the shadowing 2023 Intel install (`pkgutil --forget net.johnmacfarlane.pandoc`, the three binaries and three man pages) after installing Homebrew's arm64 pandoc 3.11. Measured firsthand AFTER the removal, all at the DEFAULT PATH with no workaround and no cache: `which -a pandoc` -> `/opt/homebrew/bin/pandoc` alone, `file` says `Mach-O 64-bit executable arm64`, `pandoc --version` 3.11; `test/fixtures/sample.qmd` renders exit 0 and produces `sample.html`; `scratchpad/s277/r5tilde/t01_tilde.Rmd` and `t02_backtick_ctrl.Rmd` render exit 0 and AGREE with the shipped build; `npm run test:integration` **552 passing, 0 failing, exit 0** with the operator's go-ahead taken BEFORE the launch.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-22 · [ad hoc] The post-trim budget measurement row backing the entry above
- **Change:** `.context-budget-history.jsonl` -- the rows `python3 context_budget.py` appended when run against the committed trim, the evidence for the figure the trim entry cites.
- **Commit/PR:** this entry's own commit
- **Session:** S277 · **Verified:** `context_budget.py` -> `SESSION_NOTES.md` **ok** (18,414 B / 120,000 B, 258 lines / 400), `CLAUDE.md` ok. Still OVER, pre-existing and owed: `HANDOFFS.md`, `BACKLOG.md` 355,402 B, `PROJECT_LEARNINGS.md` -- the D7 trims named in the handoff.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-22 · [ad hoc] The oldest close-out pair dropped from SESSION_NOTES.md (S273 evaluation + S274 self-assessment)
- **Change:** `SESSION_NOTES.md` -- the oldest pair removed so the live file holds three, the steady state the retention rule in `CLAUDE.md` sets. 92 lines deleted and nothing else in the file touched, because a positional proof breaks otherwise (upstream BL-36).
- **Commit/PR:** this entry's own commit
- **Session:** S277 · **Verified:** the file's `## ` headings are now exactly ACTIVE TASK + three pairs (S276 evaluation by S277 / S277 self-assessment, S275 by S276 / S276, S274 by S275 / S275); 258 lines, and `git diff --stat` for the commit reads `1 file changed, 92 deletions(-)` -- deletions only. The dropped pair stays one command away: `git show 1effdbef:SESSION_NOTES.md`.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-22 · [ad hoc] Session 277 close-out -- the handoff receipt, the predecessor evaluation and the self-assessment
- **Change:** `HANDOFFS.md` -- the S277 receipt completed from `status: pending` to `status: complete` with all six requirements, `predecessor_score: 9` and `self_score: 8`. `SESSION_NOTES.md` -- ACTIVE TASK rewritten for the next session, plus the close-out pair (S276 evaluation + S277 self-assessment).
- **Commit/PR:** this entry's own commit
- **Session:** S277 · **Verified:** `quality_ratchet: 2/2 pass · 0 fail · 0 unmeasured · results bba236856bad · manifest 8845021a4049` at head `1effdbef` -- the head the RESULTS FILE records, read rather than assumed. `python3 context_budget.py`: `SESSION_NOTES.md` **ok** (25,649 B / 120,000 B, 350 lines / 400, no line over 280 B); `CLAUDE.md` ok. Still OVER, pre-existing and owed: `HANDOFFS.md`, `BACKLOG.md` 354,892 B, `PROJECT_LEARNINGS.md`. No `status: pending` receipt remains (the one grep hit is that string quoted inside an older receipt's gotchas, which is the fence-aware counting caveat this file documents).
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-22 · [BL-Pre-existing fence-grammar defects measured by Session 276's research] The records for the paragraph-interrupt fix: decision (7), the item it closed, and five new items from its measurements
- **Change:** `BACKLOG.md` — the COMPLETED tilde/knitr-header item (Session 273) removed, item (a) of the Session 276 research item marked CLOSED at top level, RECORD item retitled SIX -> SEVEN DECIDED with bullet (7) and its two deciding plus two corroborating probes, the candidates note updated, the x86-pandoc item annotated with the 5 integration failures it causes, and FIVE new items filed with their witnesses (the container-relative form of the rule; the reader branches and two disclosed residuals; the UNBOUNDED raw-block unmask family and its new DELETION shape; `indentedCellFenceAt`'s over-reach with no container open; a fence below an open LINE BLOCK). `CLAUDE.md` — the decision count and the rebuttal clause updated for (7). `PROJECT_LEARNINGS.md` — rows #593-#599.
- **Commit/PR:** this entry's own commit
- **Session:** S277 · **Verified:** `node check-backlog.js` OK — no completed-work records, **217 open items** (212 after the removal, +5 filed). Every cross-reference added here was checked against the file it names: the removed item's replacement text sits in the ledger entry above it, `CLAUDE.md`'s three edited passages were re-read after editing, and the RECORD item's bullet count now matches its title and its closing bullet (seven, seven, seven). No `src/` or `test/` file touched by this commit.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-22 · [BL-Pre-existing fence-grammar defects measured by Session 276's research] The paragraph-interrupt rule, item (a): only a column-0 BACKTICK fence interrupts an open paragraph
- **Change:** `src/core/qmd/model.ts` gains `paragraphInterruptRefuses`, one more disjunct of the existing `refused` path at the fence-opener site. With a paragraph open, no container column open, a reader this rule was measured against, and outside a lazy block-quote line, a plain fence opener is ordinary paragraph text unless it is a BACKTICK run at exactly column 0. `fenceColumns` is untouched, so `candidate.columns` keeps HEAD's value; cells (`info !== null`) and knitr-claimed chunks are never asked; the refusal reuses Session 224's `consumedCloserLine` bookkeeping. 6 RED->GREEN rows + 4 GUARD rows in `test/unit/qmd-model.test.ts`, 1 real-host row in `test/integration/suite/outline.test.ts`, 4 probes in `test/posit/runTest.ts`.
- **BY-CATCH, and it closes a filed item:** the tilde half fixes *"a TILDE fence whose info string is a knitr-style chunk header deletes a heading BOTH oracles show"* (Session 273), whose own note predicted the cause was "in the pandoc layer" -- it was. Re-measured on `.Rmd` with real knitr execution (`scratchpad/s277/r5tilde/t01_tilde.Rmd`, exit 0): quarto emits the `<h4>`, HEAD reported nothing, this build reports it. That item is removed from `BACKLOG.md` in the records commit that follows.
- **OPERATOR DECISION (7), and it DEPARTS from Posit** -- the second of the recorded decisions to do so, after (6). `npm run observe:posit` with the operator's go-ahead taken BEFORE the launch (`quarto.quarto 1.138.0`, `ours-loaded: false`, both controls green, 13 passing, exit 0, transcript `scratchpad/s277/posit-observation.txt`): Posit's Outline HIDES both headings quarto renders (`s01_para_bt_indent1` -> `Bravo Tail` only, `s02_para_tilde_c0` -> `Delta Tail` only) and agrees with quarto on both controls (`s03` column-0 backtick, `s04` under `from: gfm`). Every probe was rendered through real quarto first and proved byte-identical to the bytes the harness writes. The operator chose `quarto render`, on the rebuttal clause of `CLAUDE.md` §Clean-room boundary (`quarto-dev/quarto#829`, open).
- **Commit/PR:** this entry's own commit
- **Session:** S277 · **Verified:** TDD, RED shown before GREEN for every clause -- the indent half, the fence character, the reader gate, the container suspension, the lazy-quote guard (backtick-only), the consumed closer and the knitr exemption each failed for the right reason before its code existed. `npm run compile` exit 0; `npx vitest run` **66 files / 3004 passed**. Measured over **4,573 rendered probes** with `quarto render` as oracle (Session 276's corpus plus this session's, five adversarial lenses aimed at this rule; `scratchpad/s277/gate/crossall2.py`, `final3.json`): **371 rows made right that HEAD gets wrong, 255 of them heading DELETIONS, against 57 made wrong** -- every one of the 57 a PRE-EXISTING misread losing its cover, each with an isolation control rendered with no fence anywhere that HEAD already fails (raw-TeX environments 39, raw-HTML/unclosed-comment 10 of which 3 DELETE, format-gated divs 4 filed by S257, mid-document YAML 1). Corpus NEUTRAL and proved so: `model.tsv` and `rawadj.tsv` **byte-identical** to HEAD over all 3,383 documents, `findAllCells` byte-identical (21,340 cells), `tools/realdoc-score/run.sh` **2438 / agree 2423 / divergent 15** with identical ordinal lists before and after. Runtime: `npm run test:integration` in a real Extension Development Host with the go-ahead taken BEFORE the launch -- **547 passing, the new Session 277 row PASSING (44 ms)**, and **5 failing, every one an environment failure proved independent of this change**: all five spawn the real quarto CLI on a fixture with `{r}` cells, and the fixture fails to render BY HAND at the default PATH (`sh: /usr/local/bin/pandoc: Bad CPU type in executable`, no `sample.html`) while the documented workaround renders it exit 0 -- the filed x86-pandoc item, now measured to break 5 integration tests as well.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-22 · [BL-Pre-existing fence-grammar defects measured by Session 276's research] Session 277 claimed (in progress) -- the paragraph-interrupt prerequisite, item (a)
- **Change:** `SESSION_NOTES.md` ACTIVE TASK rewritten to claim the session; `HANDOFFS.md` opens the S277 receipt at `status: pending`. No `src/` or `test/` file touched by this commit.
- **Commit/PR:** this entry's own commit
- **Session:** S277 · **Verified:** Phase 0 reconciled clean -- CHANGELOG frontier `f50527da` WAS HEAD (0 undocumented commits); newest receipt S276 `status: complete`; `.quality-gates-results.json` 2/2 pass (results `bba236856bad`, manifest `8845021a4049`, head `6b41be1a`) matching that receipt's citation. Build measured green BEFORE anything: `npm run compile` exit 0, `npx vitest run` 66 files / 2991 passed. `gh issue list` empty (this project uses none). Dashboard 76/100, risk HIGH (BACKLOG.md 346,581 B past the 262,144 B hard read refusal; HANDOFFS.md 233,697 B; npm audit 9).
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-22 · [ad hoc] The post-trim budget measurement row backing the entry above
- **Change:** `.context-budget-history.jsonl` -- the one row `python3 context_budget.py` appended when run against the committed trim, the evidence for the figure the trim entry cites (`SESSION_NOTES.md` 18,860 B).
- **Commit/PR:** this entry's own commit
- **Session:** S276 · **Verified:** the appended row reads `"SESSION_NOTES.md": 18860`; `context_budget.py` -> `SESSION_NOTES.md` **ok** (18,860 / 120,000 B), `CLAUDE.md` ok. Still OVER, pre-existing and owed: `HANDOFFS.md` 233,697 B, `BACKLOG.md` 346,581 B, `PROJECT_LEARNINGS.md` 1,041,086 B (the D7 trims named in the handoff).
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-22 · [ad hoc] The oldest close-out pair dropped from SESSION_NOTES.md (S272 evaluation + S273 self-assessment)
- **Change:** `SESSION_NOTES.md` -- the Session 272 handoff evaluation (by Session 273) and the Session 273 self-assessment removed, so the live file holds the steady-state THREE pairs (`CLAUDE.md` §SESSION_NOTES.md retention). **7,467 B removed; 259 lines / 18,860 B remain.** Both records stay one command away: `git show 4c6fb997:SESSION_NOTES.md`, the close-out commit just before this one.
- **Commit/PR:** this entry's own commit
- **Session:** S276 · **Verified:** the working file was asserted byte-identical to `git show HEAD:SESSION_NOTES.md` before the cut (`git diff --quiet HEAD`), and the trim diff holds deletions only (0 added lines), the pair being the file's tail -- a trim commit carries no other edit to the file it trims (upstream BL-36).
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-22 · [ad hoc] Session 276 close-out -- the handoff receipt, the predecessor evaluation, the self-assessment and learning #592
- **Change:** `SESSION_NOTES.md` -- ACTIVE TASK rewritten to "NONE -- Session 276 closed out", the Session 275 handoff evaluation (**9/10**) and the Session 276 self-assessment (**7/10**) prepended. `HANDOFFS.md` -- the S276 receipt completed (`status: complete`). `PROJECT_LEARNINGS.md` -- #592 (attack the cheap prototype before the TDD port).
- **Commit/PR:** this entry's own commit
- **Session:** S276 · **Verified:** `python3 quality_ratchet.py --run` -> **2/2 pass · 0 fail · 0 unmeasured · results bba236856bad · manifest 8845021a4049**, at head `6b41be1a` -- the head the results file records. `src/` and `test/` byte-identical to HEAD (`git diff --stat HEAD -- src test` empty); `npm run compile` exit 0, `npm test` 66 files / 2991 passed, `check-backlog` OK 213. No Extension Development Host run was owed: no runtime surface changed.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-22 · [BL-A bare fence inside a list item, and a backtick fence whose info string holds a backtick, are fences to this model and not to pandoc] Measured, attempted twice under two adversarial passes, and NOT shipped -- the item stays open with its findings recorded
- **Change:** NO `src/` or `test/` change. New `docs/planning/2026-09-22-fence-bound-adversarial-findings.md` (the derived rule, both candidates, both adversarial rounds, the prerequisites a retry needs). `BACKLOG.md`: the item keeps its place with a dated note pointing at the findings; its Active-section mention updated; two items filed -- *Pre-existing fence-grammar defects measured by Session 276's research* (a)-(i), and the x86_64 `/usr/local/bin/pandoc` that fails every knitr render through the default PATH (with a note that the corpus ground truth's knitr exit-1 rows may be environment failures). `PROJECT_LEARNINGS.md` #586-#591. `dashboard_history.jsonl`: the Phase 0 dashboard row.
- **Commit/PR:** this entry's own commit
- **Session:** S276 · **Verified:** research, 6 agents, ~550 rendered probes; corpus reach MEASURED ZERO (every build left all 3,383 model outputs byte-identical to HEAD; real-document score unchanged, 2,423 / 2,438). Candidate 1 (broad): 504 of 606 designed probes agree against HEAD's 286, then a 5-lens adversarial pass (1,075 probes, 203 skeptic-verified regressions) -- over 1,844 unique rendered probes 435 fixes, 626 HEAD-correct rows broken. Candidate 2 (N1, narrowed; 0 regressions over those 1,844, 138 fixes, 3,017 unit tests green, guards mutation-tested): a second 5-lens pass (1,074 probes, 169 verified) -- over 3,105 unique probes 499 fixes, 622 broken. The stop rule of the option the operator chose applied; `src/` and `test/` were reverted to HEAD (`npm run compile` exit 0, `npm test` 66 files / 2991 passed), the full attempt kept in `scratchpad/s276/n1-final-full.diff`.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-21 · [BL-A bare fence inside a list item, and a backtick fence whose info string holds a backtick, are fences to this model and not to pandoc] Session 276 claimed (in progress) — reach and ground truth measured first, then strict TDD
- **Change:** `SESSION_NOTES.md` ACTIVE TASK rewritten as the Session 276 claim stub; `HANDOFFS.md` opens a `status: pending` S276 receipt, inserted at the first line that IS a `` ```handoff `` fence (asserted to precede the S275 block), not at the prose mention in the header.
- **Commit/PR:** this entry's own commit
- **Session:** S276 · **Verified:** Phase 0 reconciled clean — `CHANGELOG.md` frontier `5cc2717a` WAS HEAD (0 undocumented commits); newest receipt S275 `status: complete`; `.quality-gates-results.json` records results `bba236856bad`, manifest `8845021a4049`, 2/2 pass (re-run at head `5cc2717a`, same results hash S275 cited). Build measured green before anything: `npm run compile` exit 0, `npm test` 66 files / 2991 passed, `check-backlog` OK 211 open items.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [ad hoc] The post-trim budget measurement row backing the entry above
- **Change:** `.context-budget-history.jsonl` — the one row `python3 context_budget.py` appended when it was run against the committed trim. It is the evidence for the figure the trim entry above cites (`SESSION_NOTES.md` 22,645 B), which the trim commit itself could not contain.
- **Commit/PR:** this entry's own commit
- **Session:** S275 · **Verified:** the appended row reads `"SESSION_NOTES.md": 22645`, matching the trim entry exactly; `context_budget.py` → `SESSION_NOTES.md` **ok** (22,645 / 120,000 B). A row the same checker had appended earlier against an intermediate, never-committed version of the file (22,646 B) was discarded uncommitted rather than recorded.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [ad hoc] The oldest close-out pair dropped from SESSION_NOTES.md (S271 evaluation + S272 self-assessment)
- **Change:** `SESSION_NOTES.md` — the Session 271 handoff evaluation and the Session 272 self-assessment removed, so the live file holds the steady-state THREE pairs (`CLAUDE.md` §SESSION_NOTES.md retention). **7,172 B removed; 298 lines, 22,645 B remain** (measured after the write).
- **Commit/PR:** this entry's own commit
- **Session:** S275 · **Verified:** a trim commit must contain no other edit to the file being trimmed (upstream BL-36), and this one does not — the working file was asserted byte-identical to `git show HEAD:SESSION_NOTES.md` before the cut, and the retained portion asserted a **BYTE-IDENTICAL PREFIX** of it, ending on a single newline as the previous trim's did. The dropped pair is one command away: `git show a7354c71:SESSION_NOTES.md`.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [ad hoc] Session 275 close-out — the handoff receipt, the predecessor evaluation and the self-assessment
- **Change:** `SESSION_NOTES.md` — ACTIVE TASK rewritten to "NONE — Session 275 closed out", the Session 274 handoff evaluation (**9/10**) and the Session 275 self-assessment (**7/10**) prepended. `HANDOFFS.md` — the S275 receipt completed (`status: complete`).
- **Commit/PR:** this entry's own commit
- **Session:** S275 · **Verified:** `python3 quality_ratchet.py --run` → **2/2 pass · 0 fail · 0 unmeasured · results bba236856bad · manifest 8845021a4049**, at head `2f63dfa0` — the head the results file records, read rather than assumed. `SESSION_NOTES.md` 390 lines after the write, under the 400-line ceiling, no line over 280 B. The receipt's twelve fields present, and its gate citation uses the `quality_ratchet:` form (a `quarto_ratchet` typo caught and fixed before the commit).
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] The item is COMPLETE and removed — all eight root causes closed, decided or not modelable — and three items filed from what R6 left behind
- **Change:** `BACKLOG.md` — the item removed, since with R6 CLOSED every sub-item is CLOSED (R1, R4, R5, R6), DECIDED (R2, R3, R7 — the RECORD item) or recorded NOT MODELABLE (R8, which stays documented in `docs/REAL-DOCUMENT-RESCORE.md`); its one open bullet, the F7 zero-reach by-catch, carried VERBATIM into an item of its own; two items filed — *"R6 residuals — what the positively-established silence rule leaves at HEAD's answer"* (seven measured classes, including that only the engine-aware Outline sees the change) and *"A bare fence inside a list item, and a backtick fence whose info string holds a backtick, are fences to this model and not to pandoc"* (PRE-EXISTING, deletion direction, found by the adversarial pass); the Active note and the ranking guidance rewritten to say the score now has NO fixable divergence left to rank. `docs/REAL-DOCUMENT-RESCORE.md` — a dated CLOSED note on the R6 reproduction and a correction to the "not measured under real execution" caveat. `PROJECT_LEARNINGS.md` — rows #581–#585.
- **Commit/PR:** this entry's own commit
- **Session:** S275 · **Verified:** the claim that every remaining divergence is decided or unmodelable is measured, not asserted — the 15 divergent ordinals at HEAD (`phantom [2147, 2275]`, `lost [482, 491, 610, 1352, 2566, 2898]`, `level` the seven R7 files) are set-identical to R2 ∪ R3 ∪ R7 ∪ R8 in the report's own attribution table. `node check-backlog.js` → OK, **211 open items** (209 − 1 completed + 3 filed). Each class in the residuals item is labelled firsthand-measured or agent-measured where it stands.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] The real-host proof for R6 — the recovered heading reaches the user-visible Outline, and the echoed twin stays hidden
- **Change:** `test/integration/suite/outline.test.ts` — one row beside Session 273's R5 row, through the same `outline.ts` path with the engine resolved from the text: the heading above an `echo=FALSE` chunk is PRESENT, and the same heading above an `echo=TRUE` chunk is ABSENT.
- **Commit/PR:** this entry's own commit
- **Session:** S275 · **Verified:** both halves measured on the row's exact bytes as `.Rmd`, `quarto render` exit 0 with real execution AND `--no-execute` (silent: both headings, `<p>```</p>`, 0 `<pre>`; echoed: only "Heading After Chunk", 1 `<pre>`). `resolveDocumentEngine` answers "knitr" for those bytes under "Untitled-1", "/tmp/Untitled-1", "doc.qmd" and "doc.Rmd", measured headlessly first. `npm run test:integration` with the operator's go-ahead taken BEFORE launch, VS Code 1.129.0: **551 passing, exit 0** (550 + this row), run against the narrowed rule (`d5997bf4`). One unhandled rejection was logged after the debounced-diagnostics suite's re-scan test (`debounced-diagnostics.js:118`, a refresh writing to a disposed collection); every test passed, no heading-model code is on its stack, and it is not attributed to this change — NOT verified pre-existing, which would need a second screen run.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] R6 narrowed after an adversarial pass — the first cut DELETED headings on ten shapes, and a chunk is now silent only when that is positively established
- **Change:** `src/core/qmd/model.ts` — the silence test now trusts knitr's R engine only (`r`/`R`, no `engine=`), reads the chunk header as a FLAT option list and refuses any header holding a bracket, backslash, backtick or stray quote, reads a leading `#|` run only in the plain `#| key: value` shape (YAML's whitespace-led comment rule honoured, repeated keys refused, only the measured falses `false`/`FALSE`/`no`), and matches knitr's delimiters with ASCII whitespace. A silent closer is withheld only from a top-level, unquoted opener whose info string holds no backtick. The two regexes that were quadratic on long space runs are rewritten linear. `test/unit/qmd-model.test.ts` — 5 RED→GREEN rows and 3 guards in a deletion-visible shape (a later plain block, so a wrong "silent" DELETES instead of adding a phantom); the vacuous mismatched-closer assertion replaced by two discriminating ones; comments that overclaimed corrected.
- **Commit/PR:** this entry's own commit
- **Session:** S275 · **Verified:** an adversarial workflow (4 lenses, 27 findings, each re-measured by an independent skeptic) found that commit `b1f054ac` DELETED "Heading After Chunk" on 10 measured shapes quarto renders and the pre-fix build kept — `dot`/`mermaid` chunks with `echo=FALSE` and `engine="dot"` (quarto re-emits their fence whatever `echo` says), `echo=FALSE` inside an R call, five `#|` spellings knitr does not read as that option, and a no-break space on the header line — plus carried a PRE-EXISTING list-item/backtick-info runaway one heading further. All re-rendered firsthand (exit 0 in both modes). Strict TDD: each new row shown RED for the right reason first. **12 of 12 mutants** of the new rules redden a test (the one survivor on the first pass, the bracket test, was killed by adding the `paste(...)` shape). Probe batches vs `quarto render --no-execute`: the 28-probe batch goes **14 → 23**, the 5 misses all HEAD's own answers on shapes the rule deliberately leaves alone. `npm run compile` exit 0; `npm test` **66 files / 2991 passed**; `tools/realdoc-score/run.sh s275-revised` → **2423 of 2438**, unchanged from the first cut, and over all 3,383 documents still exactly **2 changed (2519 +1, 2900 +5), 0 headings lost**. Timings on the refuters' shapes at 40k spaces: block-quoted opener 973 → 0.4 ms, `#|` value 1,435 → 0.2 ms. ⚠ **Corrections to the `b1f054ac` entry and commit message:** "every expectation a measured render, exit 0 in both modes" was false for the mismatched-closer row (exit 1 with real execution, and its assertion was vacuous) and for the markdown-engine row (only renderable with front matter added); and the silence rule it described was wrong on the ten shapes above.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] R6 — a stray fence skips the closer of a knitr chunk that emits no fence, so the heading below it survives
- **Change:** `src/core/qmd/model.ts` — in a knitr document a fence-blind pre-pass (`knitrSilentChunkClosers`, knitr's own `chunk.begin`/`chunk.end`) finds the chunks whose options positively silence them (`echo`/`include` resolved false: a leading `#| ` line first, then the header's LAST assignment, quoted strings blanked), and their closers are withheld from every fence opened OUTSIDE the chunk — in the opener's lookahead (a second closer index) and in the in-region closer check. Any irregular knitr pairing (nested opener, mismatched closer, unclosed chunk) keeps HEAD's answer for the whole document. `test/unit/qmd-model.test.ts` — 5 RED→GREEN rows and 7 guards.
- **Commit/PR:** this entry's own commit
- **Session:** S275 · **Verified:** strict TDD — each of the 5 behaviour rows shown failing for the right reason before its code (e.g. `expected [ 'Heading After Chunk' ] to deeply equal [ 'Heading Under Test', …(1) ]`). Every expectation is a MEASURED `quarto render` of the test's exact bytes as `.Rmd`, exit 0 with real execution AND `--no-execute`. Three mutants (lift the leading-`#|` limit, drop the required space, drop the nested-opener bail) each redden a guard. `npm run compile` exit 0; `npm test` **66 files / 2983 passed** (+12). `tools/realdoc-score/run.sh s275-green` → **scored 2438 agree 2423 (99.34% → 99.38%), divergent 16 → 15**, ordinal 2519 out of `lost`. Document by document over all 3,383: **2 changed — 2519 +1, 2900 +5 (unscored, quarto exits 1) — 0 headings lost.** The ground truth was re-measured under REAL execution first: 2519 as it sits on disk fails to render (a data file is missing), and a what-if copy with the data supplied renders exit 0 showing the heading — so the divergence is real under both conventions.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] Session 275 claimed (in progress) — sub-item (f), R6, measured under real chunk execution first
- **Change:** `SESSION_NOTES.md` ACTIVE TASK rewritten as the Session 275 claim stub; `HANDOFFS.md` opens a `status: pending` receipt. ⚠ **And one repair:** Session 274's claim had inserted its receipt INSIDE the `HANDOFFS.md` header sentence — it matched the first `` ```handoff `` in the file, which is prose — so the sentence *"The record grammar is FENCE-AWARE, so `grep -c …` is not a valid recount"* was split around the block. Restored, and the S274 block moved UNEDITED to the top of the receipts. Work in progress — Phase 3F records the outcome.
- **Commit/PR:** this entry's own commit
- **Session:** S275 · **Verified:** Phase 0 reconciled clean — `CHANGELOG.md` frontier `de23dfb5` WAS HEAD (0 undocumented commits); newest receipt S274 `status: complete`, and its `quality_ratchet` citation checked against `.quality-gates-results.json` (results `bba236856bad`, manifest `8845021a4049`, head `ab4f8855`, 2/2 pass — matching). Build measured green before anything: `npm run compile` exit 0; `npm test` **66 files / 2971 passed**; `check-backlog` OK, **209 open items** — all identical to the S274 receipt. The repair is proved, not asserted: the restored header is byte-identical to `git show e979bd4f^:HANDOFFS.md` up to the first receipt, and the S274 block is the exact bytes it held at `de23dfb5` (a script asserted both before writing).
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [ad hoc] The post-trim budget measurement row backing the entry above
- **Change:** `.context-budget-history.jsonl` — the one row `python3 context_budget.py` appended when it was run to verify the trim. It is the evidence for the numbers the trim entry above cites (`SESSION_NOTES.md` 25,762 B), which the trim commit itself could not contain: the row is written by the run that measures the committed file, so it necessarily lands after it.
- **Commit/PR:** this entry's own commit
- **Session:** S274 · **Verified:** the appended row reads `"SESSION_NOTES.md": 25762`, matching the trim entry's cited figure exactly; `git status` clean apart from the untracked `scratchpad/` afterwards. This file is tracked and append-only, and the same row lands on every session that runs the budget checker (S273 receipt, gotcha 5).
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [ad hoc] The oldest close-out pair dropped from SESSION_NOTES.md (S270 evaluation + S271 self-assessment)
- **Change:** `SESSION_NOTES.md` — the Session 270 handoff evaluation and the Session 271 self-assessment removed, so the live file holds the steady-state THREE pairs (`CLAUDE.md` §SESSION_NOTES.md retention). **7,235 B removed; 331 lines, 25,762 B remain** (measured after the write, not before — Learning #552).
- **Commit/PR:** this entry's own commit
- **Session:** S274 · **Verified:** a trim commit must contain no other edit to the file being trimmed (upstream BL-36), and this one does not — the retained portion was proved a **BYTE-IDENTICAL PREFIX** of `git show HEAD:SESSION_NOTES.md` **before** the file was written, by an assertion that would have refused the write otherwise. That is the positional proof, not an assertion. The dropped pair is one command away: `git show d952f7ee:SESSION_NOTES.md`. `python3 context_budget.py` → `SESSION_NOTES.md` **ok** (331 / 400 lines, 25,762 / 120,000 B, longest line 205 B of 280) — back under the line ceiling the close-out commit briefly exceeded at 426.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [ad hoc] Session 274 close-out — the handoff receipt, the predecessor evaluation and the self-assessment
- **Change:** `HANDOFFS.md` S274 receipt completed (`status: pending` → `complete`, `self_score: 8`, `predecessor_score: 9`, all six requirements filled). `SESSION_NOTES.md` ACTIVE TASK rewritten to the closed state, plus the Session 273 handoff evaluation and the Session 274 self-assessment. `PROJECT_LEARNINGS.md` +4 rows (#577 re-run the record's own bytes when an agent contradicts it; #578 a public upstream maintainer statement rebuts a "mirror the other product" default; #579 #576's tell is conditional — an unchanged count is correct for a records-only change; #580 a zero from an issue tracker may mean the tracker is unused). `.context-budget-history.jsonl` carries the rows this session's own tool runs appended.
- **Commit/PR:** this entry's own commit
- **Session:** S274 · **Verified:** `quality_ratchet: 2/2 pass · 0 fail · 0 unmeasured · results bba236856bad · manifest 8845021a4049` at head `ab4f8855` — the head the results file itself records, read rather than assumed. `grep -c '^status: pending' HANDOFFS.md` → **0**. Each new learning row confirmed present exactly once and the table's row count re-derived at **580**, matching the highest row number. ⚠ **No Extension Development Host run, and that is the correct discharge of Phase 3E rather than a skip** — no `src/` file was touched, so there is no runtime behaviour for a host run to observe, and such runs take the operator's screen. `tools/realdoc-score/run.sh s274-close` = **2438 scored / agree 2422 (99.34%) / divergent 16**, ordinal lists byte-identical to the S273 close figure. ⚠ `SESSION_NOTES.md` is **426 lines** at this commit, over its 400-line ceiling; the retention trim (`CLAUDE.md` §SESSION_NOTES.md retention) follows in its OWN commit, because a trim commit must contain no other edit to the file being trimmed (upstream BL-36).
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [BL-RECORD — five DECIDED questions about what the Outline shows, plus ONE now measured and still OPEN, so a future session does not re-derive them] RECORD (6) is DECIDED — the Outline follows `quarto render`, and it is the ONE decision of the six that does not mirror Posit
- **Change:** operator decision. `BACKLOG.md` — the RECORD item's title goes from "five DECIDED … plus ONE now measured and still OPEN" to **SIX DECIDED**, and bullet **(6)** is rewritten from OPEN to DECIDED with the upstream evidence, the unmeasured cost of the alternative, the measured "nothing is filed anywhere" result, and the Session 274 re-measurement; the Active pointer and the tilde item's contrast clause updated so neither still implies (6) is open; the trailing bullet's stale set-size claims fixed ("all three answers" → six; "Sessions 267 and 270" → 267, 270, 271, 272 and 274). `CLAUDE.md` §Clean-room boundary — the "the product mirrors Posit" line gains the **rebuttal clause** it needs to stay true, with the bar stated (a public upstream maintainer statement, read black-box) and its stale two-decision count corrected to six. `test/unit/qmd-model.test.ts` — the three R5 rows that read as provisional now name decision (6) and carry its reasoning. `test/integration/suite/outline.test.ts` — the same, on the adapter-level row. `docs/REAL-DOCUMENT-RESCORE.md` — the R5 reproduction gains a dated DECIDED block, plus the correction that its own stated trigger was falsified by Session 273. **No `src/` file touched.**
- **Commit/PR:** this entry's own commit
- **Session:** S274 · **Verified:** ⚠ **The deciding evidence was read firsthand and is public, not a bundle grep** — [`quarto-dev/quarto#829`](https://github.com/quarto-dev/quarto/issues/829), confirmed **OPEN** at this commit, filed 2025-09-26 by **vezwork, the Quarto VS Code extension maintainer**: *"it does seem that the outline should match the TOC that ends up in the rendered document"*; `cscheid` (quarto-cli) replies it "should be a concern of quarto-cli", and vezwork answers *"yes please."* Its shape is `:::` divs, **not** fences, so it is NOT a duplicate — what it settles is the principle. Also confirmed OPEN and maintainer-filed: [`quarto-cli#14182`](https://github.com/quarto-dev/quarto-cli/issues/14182) by `mcanouil`. ⚠ **"Nothing is filed" is MEASURED:** `gh issue list --state all` on `rmsharp/vscode_quarto_ext` → **zero** issues (issues enabled); upstream, 29 searches on `quarto-cli`, 38 on `quarto` plus the archived `quarto-vscode`, complete label sweeps of `code-blocks` and `ast`, Discussions and the web — **seven candidates, all seven refuted** by an adversarial pass, the one agent lost to an API error replaced by hand. ⚠ **A search agent CONTRADICTED the S273 record and was refuted by measurement:** it claimed the digit-led probe does not swallow and that the blank line is the lever. The exact harness bytes, extracted from the compiled `out/test/posit/runTest.js` rather than retyped, rendered through **quarto 1.7.33**: `r02` `<h4>`=0, `r03`=0, `r05`=0, `r01`=1, `r06`=1 — **Session 273's figures exactly**. A 2×2 on `r03` shows the lever is the **trailing bare fence**, not the blank line (with it `<h4>`=0 under both blank-line spellings; without it `<h4>`=1 under both), and the raw HTML puts `#### Charlie After Chunk` **inside `<pre><code>`** while emitting `{.2x .cell-code}` — knitr claimed the chunk, pandoc refused the class, the S273 mechanism read rather than inferred. The agent's probe had no trailing fence: the exact error S273 filed as **Learning #573**. Gates: `npm run check-types` exit 0; `npm test` **66 files / 2971 passed** — ⚠ **identical to baseline, and that is the CORRECT result here**, unlike the wiring change of #576: this deliverable changes no behaviour, only comments and records, so a moved count would have been the defect. `npm run compile-tests` exit 0; `check-backlog` OK, **209 open items**; `context_budget.py` → `CLAUDE.md` 22,329 B of 28,000 **ok**. Every cited cross-reference re-resolved before commit (both upstream issues, Learning #573, the S273 transcript path). **NOT DONE and deliberately left open:** filing upstream — this project has never filed an upstream issue, and that precedent is the operator's to set.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [BL-RECORD — five DECIDED questions about what the Outline shows, plus ONE now measured and still OPEN, so a future session does not re-derive them] Session 274 claimed — RECORD bullet (6) becomes a decision, on upstream evidence found at Phase 0
- **Change:** `SESSION_NOTES.md` ACTIVE TASK rewritten as the Session 274 claim stub; `HANDOFFS.md` opens a `status: pending` receipt. Work in progress — Phase 3F records the outcome.
- **Commit/PR:** this entry's own commit
- **Session:** S274 · **Verified:** Phase 0 reconciled clean — `CHANGELOG.md` frontier `dcac6b2a` WAS HEAD (0 undocumented commits), newest receipt S273 `status: complete`, and its `quality_ratchet` citation checked against `.quality-gates-results.json` (manifest `8845021a4049`, head `089aa978`, 2/2 pass — matching). Build measured green before anything: `npm run compile` exit 0; `npm test` **66 files / 2971 passed**; `check-backlog` OK, **209 open items** — all three identical to the S273 receipt. ⚠ **The answer to "is this filed anywhere?" is NO, measured:** `gh issue list --state all` on `rmsharp/vscode_quarto_ext` → **zero issues** (issues ARE enabled; this project has never used them). Upstream: 29 searches on `quarto-dev/quarto-cli`, 38 on `quarto-dev/quarto` plus the archived `quarto-vscode`, complete label sweeps of `code-blocks` and `ast`, Discussions and the open web — **seven candidates, all seven refuted** by an adversarial pass; the one agent that died on an API error was replaced by hand (`quarto-dev/quarto#488` — no symbols for `.Rmd` at all, unrelated). ⚠ **And the S273 record was re-measured rather than quoted, because a search agent contradicted it:** the EXACT harness bytes, extracted from the compiled `out/test/posit/runTest.js` rather than retyped, rendered through quarto 1.7.33 give r02 `<h4>`=0, r03=0, r05=0, r01=1, r06=1 — the S273 figures exactly, digit-led probe included.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [ad hoc] The oldest close-out pair dropped from SESSION_NOTES.md (S269 evaluation + S270 self-assessment)
- **Change:** `SESSION_NOTES.md` — the Session 269 handoff evaluation and the Session 270 self-assessment removed, so the live file holds the steady-state THREE pairs (`CLAUDE.md` §SESSION_NOTES.md retention). **6,297 B removed; 335 lines, 26,015 B remain** (measured after the write, not before — Learning #552).
- **Commit/PR:** this entry's own commit
- **Session:** S273 · **Verified:** a trim commit must contain no other edit to the file being trimmed (upstream BL-36), and this one does not — the retained portion was proved a **BYTE-IDENTICAL PREFIX** of `git show HEAD:SESSION_NOTES.md` before the file was written, which is the positional proof, not an assertion. The dropped pair is one command away: `git show 9d712e24:SESSION_NOTES.md`. `python3 context_budget.py` → SESSION_NOTES.md **ok** (335 / 400 lines, 26,015 / 120,000 B, no line over 280 B) — back under the line ceiling the close-out commit briefly exceeded at 417.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [ad hoc] Session 273 close-out — the handoff receipt, the predecessor evaluation and the self-assessment
- **Change:** `HANDOFFS.md` S273 receipt completed (`status: pending` → `complete`, `self_score: 8`, `predecessor_score: 9`, all six requirements filled). `SESSION_NOTES.md` ACTIVE TASK rewritten to the closed state, plus the Session 272 handoff evaluation and the Session 273 self-assessment. `.context-budget-history.jsonl` and `dashboard_history.jsonl` carry the rows this session's own tool runs appended.
- **Commit/PR:** this entry's own commit
- **Session:** S273 · **Verified:** runtime gate run with the operator's go-ahead — `npm run test:integration` in a real Extension Development Host, **550 passing, exit 0**, including the new adapter-level R5 row. `quality_ratchet: 2/2 pass · 0 fail · 0 unmeasured · results bba236856bad · manifest 8845021a4049` at head `089aa978`, the head the results file itself records. `grep -c '^status: pending' HANDOFFS.md` → 0. ⚠ `SESSION_NOTES.md` is **417 lines** at this commit, over its 400-line ceiling; the retention trim (`CLAUDE.md` §SESSION_NOTES.md retention) follows in its OWN commit, because a trim commit must contain no other edit to the file being trimmed (upstream BL-36).
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] The adapter-level proof that the engine reaches the model in the real host
- **Change:** `test/integration/suite/outline.test.ts` — one Session 273 test asserting BOTH halves through `vscode.executeDocumentSymbolProvider`: the knitr-claimed chunk's heading reaches the user-visible Outline, and the digit-led twin does not. `PROJECT_LEARNINGS.md` +1 row (#576).
- **Commit/PR:** this entry's own commit
- **Session:** S273 · **Verified:** `npm run test:integration` in a real Extension Development Host with the operator's go-ahead — **550 passing, exit 0**, including the new R5 row. ⚠ **Why this commit exists at all:** the FIRST integration run returned **549 passing, exit 0** — the baseline count — and that green proved only that the rewired adapters had not broken. Nothing in it could show the engine actually REACHED the model, because no test asserted the new behaviour at the adapter level, and the unit suite cannot close that gap since it calls `findHeadings(text, "knitr")` directly and so assumes the wiring under test. That is failure mode #24 with an unchanged test count as its tell. Both assertions were pre-checked headlessly first: `resolveDocumentEngine` answers `"knitr"` for these bytes under `Untitled-1`, `/tmp/Untitled-1` and `doc.qmd` alike, so an untitled in-memory document exercises the real path. Exact-set pins and fixture uses re-counted on CODE lines, **24** and **1**, both unchanged.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] The Posit observation for R5 — and the two records its by-catch produced
- **Change:** `test/posit/runTest.ts` — the 13 decided mid-document-metadata probes replaced by a six-probe R5 family (three DECIDING, two corroborating, one by-catch), both controls kept, output path moved to `scratchpad/s273/`. `test/unit/qmd-model.test.ts` — four guard comments rewritten against the observation, so no row silently reads as settled. `BACKLOG.md` — sub-item **(e)** R5 CLOSED with its corrected trigger and corrected fix sites, a new **open** RECORD bullet **(6)**, a new tilde item, and the Active section's stale pointers and score figure refreshed. `PROJECT_LEARNINGS.md` +4 rows (#572–#575).
- **Commit/PR:** this entry's own commit
- **Session:** S273 · **Verified:** `npm run observe:posit` ran in a real Extension Development Host with the operator's go-ahead taken **BEFORE** the launch — **9 passing, exit 0**, `quarto.quarto 1.135.0 active=true`, `ours-loaded: false`, both controls green. Every probe was rendered through real quarto BEFORE the run, and the rendered bytes were read back out of the compiled `out/test/posit/runTest.js` so the two oracles answered for the identical bytes: all 8 exit 0, and every `<h4>` count matches the claim written into that probe's `why:`. `npm test` 66 files / 2971 passed. Transcript: `scratchpad/s273/posit-observation.txt`.
- **The deciding row settled the session's question in the fix's favour:** on `r01_r5_rmd`, `quarto render` emits the heading AND Posit's Outline shows it, while HEAD deleted it. R5 was a defect against **both** oracles, not a quarto/Posit decision — so the fix stands on an observation rather than on a proxy.
- **⚠ And the by-catch is worth more than the confirmation.** (1) Posit shows the heading on THREE shapes `quarto render` swallows (`r02` markdown-engine, `r03` digit-led, `r05` hyphen) — the first MEASURED quarto/Posit disagreement no session has ruled on, and the product does **not** mirror Posit there, which is the opposite of decisions (1)–(5). **PRE-EXISTING**; this session moved the knitr arm only, where the two oracles agree. Filed as open RECORD bullet (6) for the operator, and pinned by three now-honestly-commented rows. (2) On `r06_tilde_rmd` both oracles show a heading this model hides, which promotes the tilde divergence from unknown to a plain **DEFECT** — filed with its observation and with the reason the obvious fix is wrong (knitr is provably not the cause; `keep-md` leaves a `~~~` chunk verbatim).
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] The engine reaches the Outline — R5's recovered heading, measured at +1 of 3,383 with 0 lost
- **Change:** `src/core/qmd/model.ts` — `buildOutline` takes the same optional `EngineHint` and forwards it, and `regionsCache` becomes **two-entry** so an engine-aware caller and an engine-blind one stop evicting each other. `src/providers/outline.ts` and `src/providers/workspace-symbols.ts` — each resolves the engine from the `TextDocument` it already holds and passes it down; that is the ONLY place the engine is resolved. `tools/realdoc-score/census.test.ts` — the census asks the same question the product asks, resolving from the same build under test.
- **Commit/PR:** this entry's own commit
- **Session:** S273 · **Verified — the score moved, and the control proves it was the `src/` change:** `tools/realdoc-score/run.sh s273-final` → **`scored 2438 agree 2422 (99.34%) divergent 16 phantom 2 lost 7 level 7`**, `lost [482, 491, 610, 1352, 2519, 2566, 2898]` — ordinal **2391 leaves `lost`**, phantom unchanged at 2, level unchanged at 7. The control, the engine-aware census run against the PRE-FIX `src/` (`git archive 0c6bd30e`): `s273-headctl: scored 2438 agree 2421 (99.30%) divergent 17 … lost [… 2391 …]` — the exact baseline, so the +1 is the model, not the harness. **Document-by-document bundle diff over all 3,383 corpus documents: 1 document changed, 1 heading GAINED, 0 LOST** — ordinal 2391, 17 → 18, and the gained row is `h4:16. Ok but I really want to call cpp11::unwind_protect() manually`, exactly the heading `quarto render` emits.
- **Gates on this tree:** `npm run compile` exit 0 · `npm test` **66 files / 2971 passed** · `npm run test:oracle` exit 0, **131 documents / 124 agree / 4 lost TP / 3 CARDINAL FP / 0 unrelated** — byte-identical to the standing S180-onward figure, so no cell, cell-option line or diagnostic moved.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] R5 — the model learns that knitr runs before pandoc, and stops letting a claimed chunk's closer swallow the heading below it
- **Change:** `src/core/qmd/model.ts` — a new `KNITR_CHUNK_INFO` predicate beside `CELL_INFO` (which is UNTOUCHED), a type-only `DocumentEngine` import and an `EngineHint` alias, `scanRegions`/`computeRegions`/`findHeadings` threading an optional engine, `regionsCache` keyed on text **and** engine, and one `knitrClaims` clause at the `refused` computation. `test/unit/qmd-model.test.ts` — the R5 suite: one RED-first behaviour test plus seven guards.
- **Commit/PR:** this entry's own commit
- **Session:** S273 · **Verified:** strict TDD — the behaviour test was written first and shown failing FOR THE RIGHT REASON (`expected [] to deeply equal [ 'After Chunk' ]`, the heading swallowed by the runaway region) before any `src/` edit. `npm run compile` exit 0; `npm test` **66 files / 2971 passed** (2963 at baseline, +8 new, **0 moved**). ⚠ **This commit is behaviour-INERT for every existing caller and that is measured, not asserted:** `tools/realdoc-score/run.sh s273-c1` → `scored 2438 agree 2421 (99.30%) divergent 17 phantom 2 lost 8 level 7`, the byte-identical baseline, because the census is still engine-blind. Every expectation in the suite was measured against real `quarto render` with real knitr execution (quarto 1.7.33, knitr 1.51, R 4.6.1) BEFORE it was written (Learning #552).
- **⚠ The naive predicate was wrong and an adversarial pass caught it.** knitr's own grammar is `[a-zA-Z0-9_]+`, but its rewrite target is a pandoc CLASS and pandoc refuses a class that does not begin with a letter — so a digit-led or `_`-led engine name runs away anyway, one stage later, and HEAD was already right. Shipping knitr's grammar verbatim would have manufactured 5 phantoms and frozen one into the suite. The predicate is knitr's grammar **∩** pandoc's class grammar, `[A-Za-z][A-Za-z0-9_]*`, with both measured tables in the docstring. Re-measured firsthand: `quarto pandoc` opens `.zzz9`/`.x2`/`.x_`/`.cpp11`/`.glue_sql` and refuses `.2x`/`._x`/`.99`/`.9zzz`; end to end on `.Rmd`, `<h4>` count 1 for `{zzz9,…}`/`{cpp11,…}`/`{glue_sql,…}` and **0** for `{2x,…}`/`{_zzz,…}`.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] Session 273 claimed (in progress) — sub-item (e), R5
- **Change:** Phase 1B claim only — `SESSION_NOTES.md` ACTIVE TASK rewritten to the R5 task, and a `status: pending` S273 receipt opened in `HANDOFFS.md`. `dashboard_history.jsonl` carries the row Phase 0's own `methodology_dashboard.py` run appended. No `src/` file touched.
- **Commit/PR:** this entry's own commit
- **Session:** S273 · **Verified:** Phase 0 reconcile found 0 undocumented commits (`CHANGELOG.md` frontier `d15ef936` WAS HEAD), the newest receipt (S272) `status: complete`, and its `quality_ratchet` citation matching `.quality-gates-results.json` exactly (results `bba236856bad`, manifest `8845021a4049`, head `77c403df`, 2/2 pass). Build measured green at claim time: `npm run compile` exit 0, `npm test` 66 files / 2963 passed. Baseline score re-run firsthand BEFORE any edit: `tools/realdoc-score/run.sh s273-orient` → `scored 2438 agree 2421 (99.30%) divergent 17 phantom 2 lost 8 level 7`, R5 = ordinal 2391 still in `lost`. ⚠ Recorded at claim time because it changes the task: **every stated line number for R5 is stale** (`model.ts` is 10,003 lines; `BACKLOG.md`'s `:6024` lands on `endLine: number;`), and **the backlog states R5's trigger wrong** — it is a digit in the engine name PLUS an `=` inside the braces, not "spaced options".
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [ad hoc] The Session 272 gate-run measurements recorded, and one corrected figure
- **Change:** `.context-budget-history.jsonl` and `dashboard_history.jsonl` — the appended rows from this session's `python3 context_budget.py` and `python3 methodology_dashboard.py` runs. `CHANGELOG.md` — the trim entry's remaining-size figure corrected from a written-before-measured 24,117 B to the measured **24,082 B**.
- **Commit/PR:** this entry's own commit
- **Session:** S272 · **Verified:** `wc -c SESSION_NOTES.md` → 24082, and `context_budget.py` prints the same. Both history files are TRACKED and every tool run appends to them, so they are staged by exact path rather than swept up. This is the SECOND unmeasured number this session (the first was "every one a real slide title" about the 80 recovered headings, corrected in `model.ts` before it was committed) — recorded here rather than quietly fixed, because two in one session is the pattern worth carrying forward.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [ad hoc] The oldest close-out pair dropped from SESSION_NOTES.md (S268 evaluation + S269 self-assessment)
- **Change:** `SESSION_NOTES.md` — the Session 268 handoff evaluation and the Session 269 self-assessment removed, so the live file holds the steady-state THREE pairs (`CLAUDE.md` §SESSION_NOTES.md retention). 4,440 B removed; **311 lines, 24,082 B** remain (measured after the write, correcting a figure this entry first carried unmeasured — Learning #552).
- **Commit/PR:** this entry's own commit
- **Session:** S272 · **Verified:** a trim commit must contain no other edit to the file being trimmed (upstream BL-36), and this one does not — the retained portion was proved BYTE-IDENTICAL to `git show HEAD:SESSION_NOTES.md` up to the cut point before the file was written. The dropped pair is one command away: `git show f8297b28:SESSION_NOTES.md`. `python3 context_budget.py` → SESSION_NOTES.md ok (311 / 400 lines, 24,117 / 120,000 B, no line over 280 B).
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [ad hoc] Session 272 close-out — the handoff receipt, the predecessor evaluation and the self-assessment
- **Change:** `HANDOFFS.md` S272 receipt completed (`status: pending` → `complete`, `self_score: 8`, `predecessor_score: 9`, all six requirements filled). `SESSION_NOTES.md` ACTIVE TASK rewritten to the closed state, plus the Session 271 handoff evaluation and the Session 272 self-assessment.
- **Commit/PR:** this entry's own commit
- **Session:** S272 · **Verified:** runtime gate run with the operator's go-ahead — `npm run test:integration` in a real Extension Development Host, **549 passing, exit 0**, including both the reversed Outline test and Session 211's reader-resolution test. `quality_ratchet: 2/2 pass · 0 fail · 0 unmeasured · results bba236856bad · manifest 8845021a4049` at head `77c403df`, the head the results file itself records. `grep -c '^status: pending' HANDOFFS.md` → 0.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [ad hoc] Session 272 learnings — #568–#571 — and the records the fix closes and opens
- **Change:** `PROJECT_LEARNINGS.md` +4 rows (a fail-safe that hides a defect makes its removal look like a regression; check which probe rows DISCRIMINATE before spending the screen; reverse pins in place with their reason rather than deleting the suite; the separation surface is a measurement and the skip reached four features). `BACKLOG.md` — the completed mid-document-metadata item removed, decision **(5)** added to the RECORD item (the title goes four → five), the two stale pointers to the closed item rewritten, and the EMPTY `---` / `---` pair the fix UNMASKS filed as a new item with its reach.
- **Commit/PR:** this entry's own commit
- **Session:** S272 · **Verified:** the unmasked defect's reach was scanned over the frozen 3,383-document snapshot with its definition stated (a line exactly `---` at column 0 with a blank line above and another `---` on the next line): **1 occurrence in 1 document**, ordinal 2256, which `quarto render` exits 1 on — and it is the single non-slide-title row among the 80 the fix recovers. Its pre-existence is measured, not argued: the PRE-change build answers `h2:---` for the identical bytes under `from: gfm` where no suppression applied. `check-backlog` OK, 208 open items.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [BL-⚠ NEW (Session 271) — THE MID-DOCUMENT METADATA RULE DELETES HEADINGS POSIT SHOWS, in 30 documents quarto cannot render, and it buys the scorable corpus NOTHING] The Outline stops modelling mid-document YAML metadata — 80 headings back, 0 lost
- **Change:** `src/core/qmd/model.ts` — the SPAN arm of the mid-document metadata enumeration is gone: `consumedMetadataBlockLines`, its block-quote walk `blockQuoteRuns`, `fromConsumesMetadataBlock`, `READER_CAN_CONSUME_METADATA_BLOCK`, the `MetadataBlock` interface and the `continue` at the head of the scan loop (−286 lines net). `midDocumentMetadataRegions` collapses back into `midDocumentMetadataBlocks`, which still resolves a mid-document `from:` exactly as Session 211 measured. 25 unit expectations and 2 integration assertions reversed, each marked `⚠ REVERSED BY SESSION 272` with its reason; the inverse-polarity guards (the heading-is-PRESENT rows) are untouched and stayed green throughout.
- **Commit/PR:** this entry's own commit
- **Session:** S272 · **Verified:** TDD — ONE failing test first (`RED->GREEN: a heading inside a mid-document metadata block is REPORTED — the corpus spelling`), shown failing for the right reason (the heading absent, its control present) before any `src/` edit. Oracle: `npm run observe:posit`, `quarto.quarto-1.135.0`, `ours-loaded: false`, both controls green — Posit shows the heading for ALL SEVEN suppressed spellings and lists NO front-matter key (`m11_fm_only`), so it models the opening block and only the opening block. Score: `tools/realdoc-score/run.sh s272-final` = **2421 / 2438 (99.30%), divergent 17**, the IDENTICAL ordinal lists as the s272-baseline run; bundle diff baseline→final = **30 documents, 80 headings GAINED, 0 LOST**, and `model.tsv`/`rawadj.tsv` are BYTE-IDENTICAL to the throwaway build every number was measured on. All 30 are `.Rmd` and `quarto render` exits 1 on all 30 (measured against the ground truth, not assumed), so zero scorable documents are affected. Gates: `npm test` 66 files / 2963 passed; `npm run compile` exit 0; `npm run test:oracle` exit 0 (1 passed — the import closure reaches model.ts only through `findCellOptionLines`, which reads the `cells` view); `npm run check-package` OK, 42 files, 5.60 MB; `check-backlog` OK, 208 open items. The 6 integration assertions were pre-checked headlessly against `core/` before any Extension Development Host run.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [BL-⚠ NEW (Session 271) — THE MID-DOCUMENT METADATA RULE DELETES HEADINGS POSIT SHOWS, in 30 documents quarto cannot render, and it buys the scorable corpus NOTHING] Thirteen probes that ask the oracle question about the FEATURE, not two spellings
- **Change:** `test/posit/runTest.ts` — the R2/R3 probe set (both questions DECIDED, Sessions 270 and 271) replaced by a mid-document-metadata family: the corpus spelling, the tight spelling, a real-keys span, a keys-plus-heading span, both block-quote spellings, two consecutive spans, a `...`-terminated span, the `from: gfm` reader-resolution row, the no-blank-above precondition control, a front-matter-only control, R2's deck for contrast, and a `from: markdown_strict` row. `QMD_POSIT_OUT` now defaults to `scratchpad/s272/`. Both controls kept unchanged. No `src/` file touched.
- **Commit/PR:** this entry's own commit
- **Session:** S272 · **Verified:** every one of the 15 probe files was rendered through real `quarto render --to html` FIRST (all exit 0), and the bytes the harness writes were then proved BYTE-IDENTICAL to the rendered files by re-reading the compiled `out/test/posit/runTest.js` — so both oracles answer for the same bytes. `npm run compile-tests` exit 0.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [BL-⚠ NEW (Session 271) — THE MID-DOCUMENT METADATA RULE DELETES HEADINGS POSIT SHOWS, in 30 documents quarto cannot render, and it buys the scorable corpus NOTHING] Session 272 claimed (in progress)
- **Change:** Phase 1B claim only — `SESSION_NOTES.md` ACTIVE TASK rewritten to the new task, `HANDOFFS.md` opened with a `status: pending` S272 receipt. No `src/` file touched.
- **Commit/PR:** this entry's own commit
- **Session:** S272 · **Verified:** Phase 0 reconcile found 0 undocumented commits (CHANGELOG frontier `91307feb` WAS HEAD), the newest receipt (S271) `status: complete`, and its `quality_ratchet` digests matching `.quality-gates-results.json` exactly (results `bba236856bad`, manifest `8845021a4049`, 2/2 pass). Build measured green at claim time: `npm run compile` exit 0, `npm test` 66 files / 2962 passed.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [ad hoc] The S271 receipt's hazard gotcha corrected to match the measurement
- **Change:** `HANDOFFS.md` gotchas (4) and (5) — the receipt still told the next session that the same-stem `.rmarkdown` deletion does not reproduce. It does; the gotcha now carries the measured collateral form, its knitr condition and its two controls, and (5) is rewritten as the probe lesson.
- **Commit/PR:** this entry's own commit
- **Session:** S271 · **Verified:** the receipt is the file the next session's Phase 0 actually reads, so a wrong claim there outlives one in any other file. Same measurements as the entry below it: chunk present → exit 0, `s.html` written, `s.rmarkdown` DELETED; no chunk → survives; `s.md` → survives.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [ad hoc] Post-close-out correction — the `.rmarkdown` collateral DOES reproduce, and my refutation of it was the under-tested probe
- **Change:** `BACKLOG.md`'s `.Rmarkdown` item — the "does NOT reproduce" line replaced by the measured collateral form, with its condition and its control; the oracle-count item corrected from four README places to five (six with `load.ts`). `PROJECT_LEARNINGS.md` #567 rewritten so its second half is the mirror-image lesson. `SESSION_NOTES.md` ACTIVE TASK and self-assessment corrected to match.
- **Commit/PR:** this entry's own commit
- **Session:** S271 · **Verified:** measured after the workflow's last three verifiers landed. `quarto render s.qmd --to html` with an R chunk in `s.qmd`: **exit 0**, `s.html` written, **`s.rmarkdown` DELETED**; the same test with no chunk leaves it untouched, which is the probe that produced the wrong refutation. Control: a same-stem `s.md` **survives** and `other.rmarkdown` survives, so the collateral is specific to the `.rmarkdown` extension and the same stem. The count: `grep -n '66' test/oracle/README.md test/oracle/load.ts` → :7, :71, :89, :111, :127 and `load.ts:21`.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [ad hoc] `.context-budget-history.jsonl` — the final-tree measurement of Session 271's growth
- **Change:** one appended row from the close-out's `python3 context_budget.py` run (exit 2, unchanged: the same three files over ceiling, and `SESSION_NOTES.md` back inside it at 21,291 B / 286 lines after the trim). Against the S270 row it prices this session: `BACKLOG.md` +10,262 B, `HANDOFFS.md` +8,212 B, `PROJECT_LEARNINGS.md` +5,522 B, `SESSION_NOTES.md` +2,671 B, `CLAUDE.md` unchanged.
- **Commit/PR:** this entry's own commit
- **Session:** S271 · **Verified:** the deltas are subtractions between the two adjacent rows of the file itself, computed rather than typed (#552, and #567 for the same reason one line up). `BACKLOG.md` is the largest grower because this session filed two items and rewrote four blocks; it is the one to watch.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [ad hoc] `SESSION_NOTES.md` — the oldest close-out pair dropped (S267 evaluation by S268 + S268 self-assessment)
- **Change:** 56 lines deleted and nothing else, per the three-pair retention rule (`CLAUDE.md`, Session 256). The pair stays in git: `git show 75d69b29:SESSION_NOTES.md`.
- **Commit/PR:** this entry's own commit
- **Session:** S271 · **Verified:** the count is `git diff --numstat` on the final tree, not an estimate (#552) — `0	56	SESSION_NOTES.md`, deletions only, so the trim carries no other edit to the file it trims (upstream BL-36). The file holds three pairs and 286 lines against the 400-line ceiling.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [ad hoc] Session 271 closed out — R2 decided rather than open, and the same observation found the defect pointing the other way
- **Change:** the S271 `HANDOFFS.md` receipt set `status: complete` (self 8, predecessor 9); `SESSION_NOTES.md` ACTIVE TASK rewritten (NONE; the blank-line precondition, the two measurement slips and the recommended next pick sit where every session reads them) plus the S270 evaluation and the S271 self-assessment.
- **Commit/PR:** this entry's own commit
- **Session:** S271 · **Verified:** `quality_ratchet: 2/2 pass · 0 fail · 0 unmeasured · results bba236856bad · manifest 8845021a4049` at `66c93321` — the head `.quality-gates-results.json` itself records, read rather than assumed. `npm run compile` exit 0; vitest 2962/2962 in 66 files; `npm run check-package` OK, 42 files, 5.61 MB; `check-backlog` OK. `tools/realdoc-score/run.sh s271-final` = **2,421 / 2,438 (99.30%), divergent 17**, and `model.tsv`, `model.cjs` and `rawadj.tsv` are all **byte-identical** to `s271-baseline` across all 3,383 corpus documents, so "no behaviour changed" is proved rather than asserted. Runtime: `npm run observe:posit` 11 passing, exit 0, in a real Extension Development Host with the operator's go-ahead taken before the launch.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [ad hoc] The fan-out's verification pass folded in — one of my own numbers corrected, one agent consensus refuted, two findings filed
- **Change:** `BACKLOG.md` — the `.rmarkdown` hazard's exit code **corrected from 0 to 1** with the slip disclosed in place; the same-stem variant recorded as NOT reproducing; the mid-document-metadata item gains a corpus reach scan with its definition stated; a new LOW item files the oracle corpus's stale "66" prose against a real 131. `PROJECT_LEARNINGS.md` gains #567.
- **Commit/PR:** this entry's own commit
- **Session:** S271 · **Verified:** all four re-measured firsthand, not taken from the agents. `quarto render t.rmarkdown --to html` redirected to a file, twice: `exit=1 input=DELETED html=no` — the earlier "exit 0" was the status of a `head` in the pipeline (#567). `quarto render s.qmd` with `s.rmarkdown` beside it: exit 0, `s.html` written, **`s.rmarkdown` survived**, refuting a claim two independent agents agreed on. `grep -c '^  {' test/oracle/corpus.ts` → **131** against five "66" occurrences in `README.md` and `load.ts`. The shape scan over the frozen snapshot: **104 of 3,383 documents, 384 tight occurrences** (a sibling agent's looser definition gave 310, which is why the definition is written into the item).
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [ad hoc] Session 271 learnings — #562–#566, the four the R2 decision paid for and the one it got wrong
- **Change:** `PROJECT_LEARNINGS.md` gains five rows. #562 a score that excludes failing documents cannot price a change that touches them — read the bundle diff before the score line. #563 when the other branch of a divergence is a render FAILURE, "match quarto" has no target. #564 ask the oracle before building, and render every probe through quarto first so both oracles answer for the same bytes. #565 a black-box probe needs a control for every dimension it varies, not one per run. #566 a mechanism that explains the observation is not a measured mechanism — delete the part you called load-bearing and re-render.
- **Commit/PR:** this entry's own commit
- **Session:** S271 · **Verified:** every row cites a measurement made this session. #566 records this session's own error: the `Duplicate key: ['::']` mechanism was written into the record from inference and refuted by rendering the variant that removes it.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] R2's mechanism corrected from inference to measurement — and the `.rmarkdown` render hazard recorded
- **Change:** decision (4) and the `docs/REAL-DOCUMENT-RESCORE.md` block now state the MEASURED predicate instead of the inferred one: the gate is pandoc's structural `yaml_metadata_block` opener precondition, not "is the span valid YAML"; the heading line parses because it is a YAML COMMENT; the `::: {.cell}` pair is a passenger, not the cause; and three preconditions are spelled out, the first being **no blank line between the opening `---` and the heading**. The `.Rmarkdown` item gains the render hazard.
- **Commit/PR:** this entry's own commit
- **Session:** S271 · **Verified:** four probes rendered firsthand on quarto 1.7.33 after a 16-agent fan-out proposed the refinements — `v01_blank_after_opener` exit 0 WITH `Swallowed Heading` (one blank line and the shape stops firing); `v02_prose_in_span` exit 1 at quarto's own pre-knitr reader (`Error reading metadata from …`, a different stage from the Lua failure); `v03_no_celldiv` and `v04_with_celldiv` both exit 0 and both heading-free, so the cell div is incidental. The `.rmarkdown` hazard re-run in isolation: `quarto render probe.rmarkdown` **exits 0**, writes no HTML, and **deletes the input file**. Corpus exposure measured at zero — 2,051 `.rmd` + 1,332 `.qmd`, no `.rmarkdown`.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] R2 is DECIDED, not fixed — and the observation's by-catch is filed as a new deletion-direction item
- **Change:** `BACKLOG.md` — sub-item (b), R2, rewritten as DECIDED (three sub-items remain, (e), (f), (h)); the RECORD item goes from three decided questions to four, with (4) carrying the observation, the corrected binary mechanism and the measured cost; the Active pointer refreshed. A NEW item filed: the mid-document metadata rule deletes headings Posit shows. `docs/REAL-DOCUMENT-RESCORE.md` — the R2 row flagged decided, and a dated DECIDED block added to its reproduction. **No `src/` file touched.**
- **Commit/PR:** this entry's own commit
- **Session:** S271 · **Verified:** every number is a measurement made this session, not a quote (#552). Baseline `tools/realdoc-score/run.sh s271-baseline` = **2,421 / 2,438 (99.30%), divergent 17**, phantoms exactly [2147, 2275]. The cost of matching quarto: a throwaway build with `FENCE_ANYWHERE_IN_BLOCK` dropped scores 2,422 / 2,438 while its document-by-document bundle diff removes **90 headings from 32 documents, 31 of them quarto-exit-1**. The by-catch: a throwaway build with `midDocumentMetadataRegions` returning `[]` recovers **80 headings across 30 documents, all 30 quarto-exit-1, and the score does not move** (identical ordinal lists). Mechanism re-measured on quarto 1.7.33: quiet chunk → exit 0, heading gone; echoing chunk / `eval=FALSE` / hidden plot → **exit 1**, `YAML parse exception`. Oracle: `npm run observe:posit`, 11 passing, both controls green, `ours-loaded: false`.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] Six R2 probes for the black-box harness, and the observation they were built to make
- **Change:** `test/posit/` gains a per-probe `ext` and `frontMatter` (R2 is a KNITR shape the corpus spells in `.Rmd`, so forcing `engine: markdown` on every probe would have observed a different document), an `.Rmd` control beside the `.qmd` one, and six probes: R2 in `.Rmd` and in `.qmd`, the no-chunk variant, a real-keys mid-document block, and a five-slide slidify deck. The control assertion now covers both controls.
- **Commit/PR:** this entry's own commit
- **Session:** S271 · **Verified:** `npm run observe:posit` ran in a real Extension Development Host with the operator's go-ahead BEFORE launch — 11 passing, exit 0, `quarto.quarto 1.135.0 active=true`, `ours-loaded: false`, and both controls green (`Constant:Control Heading`, `Constant:Control Heading Rmd`), so a `(no symbols)` row means "no heading", not "no provider". Every probe file was rendered through real quarto 1.7.33 FIRST, so Posit's answer and quarto's are recorded for the same bytes. `npm run compile-tests` exit 0 before the launch — the S270 traps (unpinned VS Code, mocha `suite`/`test`) cost two launches then and none here.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] Session 271 claimed — (b), R2: a knitr `---` pair swallows a heading (IN PROGRESS)
- **Change:** Phase 1B. `SESSION_NOTES.md` ACTIVE TASK rewritten to the R2 task; a `status: pending` receipt opened in `HANDOFFS.md`; `dashboard_history.jsonl` carries Phase 0's own row. No `src/` file touched.
- **Commit/PR:** this entry's own commit
- **Session:** S271 · **Verified:** Orient reconciled clean and measured, not quoted — `CHANGELOG.md` frontier `641c2f3f` IS HEAD (0 undocumented commits); newest receipt S270 `status: complete`, and its `quality_ratchet` citation matches `.quality-gates-results.json` exactly (head `a55d90e1`, results `bba236856bad`, manifest `8845021a4049`, 2/2 pass). `npm run check-types` exit 0; vitest 2962/2962 in 66 files; `check-backlog` OK, 206 open items. `context_budget.py` exits 2 on the three known files; `npm audit` is 9 (5 high, 4 moderate), all devDependency.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [ad hoc] `.context-budget-history.jsonl` — the final-tree measurement of Session 270's growth
- **Change:** one appended row from the close-out's `python3 context_budget.py` run (exit 2, unchanged: the same three files over ceiling). Against the S269 row it prices this session: `BACKLOG.md` +2,473 B, `HANDOFFS.md` +6,274 B, `PROJECT_LEARNINGS.md` +4,400 B, `SESSION_NOTES.md` +4,391 B, `CLAUDE.md` unchanged.
- **Commit/PR:** this entry's own commit
- **Session:** S270 · **Verified:** the deltas are subtractions between the two adjacent rows of the file itself, not estimates (#552). ⚠ Recorded here because the record should carry it: the first draft of this line was TYPED FROM EXPECTATION and three of its five numbers were wrong — corrected before the commit by running the subtraction. That is #552's failure mode surviving in the session that appended two learnings about measuring before writing.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [ad hoc] `SESSION_NOTES.md` — the oldest close-out pair dropped (S266 evaluation by S267 + S267 self-assessment)
- **Change:** 51 lines deleted and nothing else, per the three-pair retention rule (`CLAUDE.md`, Session 256). The pair stays in git: `git show c7f6fff2:SESSION_NOTES.md`.
- **Commit/PR:** this entry's own commit
- **Session:** S270 · **Verified:** the count is `git diff --numstat` on the final tree, not an estimate (#552) — `0	51	SESSION_NOTES.md`, deletions only, so the trim carries no other edit to the file it trims (upstream BL-36). The file holds three pairs and 258 lines against the 400-line ceiling, 18,620 B against 120,000.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-20 · [ad hoc] Session 270 closed out — R3 is decided rather than open, and the project has a black-box instrument it lacked
- **Change:** the S270 `HANDOFFS.md` receipt set `status: complete` (self 8, predecessor 8); `SESSION_NOTES.md` ACTIVE TASK rewritten (NONE; the oracle-first rule, the pinning and mocha-ui traps, and the recommended next pick sit where every session reads them) plus the S269 evaluation and the S270 self-assessment.
- **Commit/PR:** this entry's own commit
- **Session:** S270 · **Verified:** `quality_ratchet: 2/2 pass · 0 fail · 0 unmeasured · results bba236856bad · manifest 8845021a4049` at `a55d90e1` — the head `.quality-gates-results.json` itself records, read rather than assumed. `npm test` 2962/2962 in 66 files; `npm run check-types` exit 0; `npm run check-package` OK, 42 files, 5.61 MB; `check-backlog` OK, 206 open items. `tools/realdoc-score/run.sh s270-final` = **2,421 / 2,438 (99.30%), divergent 17**, identical to `s270-baseline`; `model.tsv` and `model.cjs` **byte-identical** between the two runs across all 3,383 corpus documents, so "no behaviour changed" is proved, not asserted. Runtime: `npm run observe:posit` 5 passing, exit 0, in a real Extension Development Host with the operator's go-ahead.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] Session 270 learnings — #558–#561, the black-box harness and three traps it and the corpus sweep exposed
- **Change:** `PROJECT_LEARNINGS.md` gains four rows. #558 how to learn what another extension shows without reading its source, and the two design constraints that make the harness readable (the symbol command MERGES providers; the control is the only assertion) plus the unpinned-version trap. #559 an audit's counts can be right while its mechanism is wrong, and the tell is that its own repro does not reproduce. #560 pandoc's ATX rule is column-exact everywhere, so a container fix needs no indent tolerance of its own. #561 a corpus document quarto refuses to render is invisible to the score and still open in somebody's editor.
- **Commit/PR:** this entry's own commit
- **Session:** S270 · **Verified:** each row states something measured this session — #558 from the harness's own two runs (the 1.138.0 `ENOENT` and the 1.129.0 success), #559 from the 9-point overhang sweep against the audit's sentence, #560 from the in-cell and top-level indent probes side by side, #561 from `quarto_v2.tsv` showing ordinals 304 and 615 at exit 1.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] R3 is DECIDED, not fixed — grid-table cells hold blocks, and none of what they hold is an Outline heading
- **Change:** operator decision after the black-box observation. `BACKLOG.md`'s head item goes from FIVE open sub-items to FOUR — (c) is now DECIDED, so 7 of the 17 divergent documents remain described by an open sub-item and 4 are fixable; the Active note recommends (b), R2, next instead of (c). The RECORD item grows from two decisions to three, and the new one is the first of the three to rest on an OBSERVATION rather than a bundle grep. `docs/REAL-DOCUMENT-RESCORE.md` gains a dated correction: its R3 mechanism is wrong and its counts are right.
- **Commit/PR:** this entry's own commit
- **Session:** S270 · **Verified:** every claim in the record was measured this session, not quoted. Baseline `tools/realdoc-score/run.sh s270-baseline` = **2,421 / 2,438 (99.30%), divergent 17** — unchanged by this decision, by construction, since no `src/` file is touched. The audit's "one body row ONE character wider" does not fire (measured); two or more does, at 2, 3, 4, 5, 8, 12, 20, 32, 49. A second trigger — a `+===+` divider truncated at a column boundary — is measured and was absent from the audit. Corpus reach re-derived from `snapshot.json` and `quarto_v2.tsv`: 63 of 3,383 documents hold a grid border; 482/491/610 give 3+3+2 = 8 lost headings; 304 and 615 hold `| ### ` lines and quarto exits **1** on both. `check-backlog` OK, 206 open items.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] A BLACK-BOX harness for Posit's Outline, and the R3 observation it was built to make
- **Change:** `npm run observe:posit` (`test/posit/`) launches an Extension Development Host holding a throwaway extensions dir with ONLY `quarto.quarto` and a do-nothing host extension, so `vscode.executeDocumentSymbolProvider` returns Posit's symbols and no one else's. This is the method `CLAUDE.md` §Clean-room boundary requires in place of reading their AGPL-3.0 source, made repeatable: two prior sessions used a bundle grep and both recorded that it should have been an observation. One assertion only — the control — because "no symbols" and "no provider" are otherwise indistinguishable.
- **Commit/PR:** this entry's own commit
- **Session:** S270 · **Verified:** run with the operator's explicit go-ahead. Control `## Control Heading` -> `Constant:Control Heading`, so Posit provided symbols; `ours-loaded: false`, so nothing of this extension was in the host. All three R3 shapes -> **(no symbols)**: an ATX heading at column 0 of a well-formed grid cell, a multi-line cell fusing into a setext h1, and the over-wide-row spelling of ordinal 491. Artefact: `scratchpad/s270/posit-observation.txt`. `npm run check-package` OK, 42 files, 5.61 MB — the new test root does not reach the `.vsix`.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] Session 270 claimed — sub-item (c), R3: grid-table cells hold blocks (in progress)
- **Change:** Phase 1B claim — `SESSION_NOTES.md` ACTIVE TASK rewritten to the R3 task, and a `status: pending` receipt opened in `HANDOFFS.md`. `dashboard_history.jsonl` carries the row Phase 0's own `methodology_dashboard.py` run appended. Operator-picked at Phase 0 by `AskUserQuestion` from four ranked options (R3 recommended; the others were the attribute-tokenizer plan's P2, R2's knitr `---` pair, and reducing the three over-budget mandated-read files). No code touched yet.
- **Commit/PR:** this entry's own commit
- **Session:** S270 · **Verified:** Orient measured, not quoted — `CHANGELOG.md` frontier `c717413a` **is** HEAD, so 0 undocumented commits; `git rev-list --count --no-merges c717413a..HEAD` = 0; newest `HANDOFFS.md` receipt S269 `status: complete` and its `quality_ratchet` citation (`results bba236856bad · manifest 8845021a4049` at `014db19b`) matches `.quality-gates-results.json` exactly; `npm test` 2962/2962 in 66 files; `npm run check-types` exit 0; `check-backlog` OK, 206 open items; `context_budget.py` exit 2 on `HANDOFFS.md`/`BACKLOG.md`/`PROJECT_LEARNINGS.md`; `npm audit` 9 advisories (5 high, 4 moderate), all devDependency.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] `.context-budget-history.jsonl` — the final-tree measurement of Session 269's growth
- **Change:** one appended row from the close-out's `python3 context_budget.py` run (exit 2, unchanged: the same three files over ceiling). Against the S268 row it prices this session: `HANDOFFS.md` +5,663 B, `PROJECT_LEARNINGS.md` +3,427 B, `SESSION_NOTES.md` +1,045 B, `BACKLOG.md` −110 B, `CLAUDE.md` unchanged.
- **Commit/PR:** this entry's own commit
- **Session:** S269 · **Verified:** the deltas are subtractions between the two adjacent rows of the file itself, not estimates (#552).
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] `SESSION_NOTES.md` — the oldest close-out pair dropped (S265 evaluation by S266 + S266 self-assessment)
- **Change:** 58 lines deleted and nothing else, per the three-pair retention rule (`CLAUDE.md`, Session 256). The pair stays in git: `git show df417435:SESSION_NOTES.md`.
- **Commit/PR:** this entry's own commit
- **Session:** S269 · **Verified:** the count is `git diff --numstat` on the final tree, not an estimate (#552) — `0	58	SESSION_NOTES.md`, deletions only; the file holds three pairs and 214 lines against the 400-line ceiling.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] Session 269 closed out — R4 is closed and the Outline agrees with quarto on 2,421 of 2,438 authored documents
- **Change:** the S269 `HANDOFFS.md` receipt set `status: complete` (self 8, predecessor 8); `SESSION_NOTES.md` ACTIVE TASK rewritten (NONE; the instrument trap, the two-bundle diff habit and the recommended next pick sit where every session reads them) plus the S268 evaluation and the S269 self-assessment.
- **Commit/PR:** this entry's own commit
- **Session:** S269 · **Verified:** `quality_ratchet: 2/2 pass · 0 fail · 0 unmeasured · results bba236856bad · manifest 8845021a4049` at `014db19b` — the head the results file itself records, checked rather than assumed after scoring the predecessor down for that exact slip. `npm test` 2962/2962; `npm run check-types` exit 0; `npm run check-package` OK 42 files 5.61 MB; `check-backlog` OK 206 open items; `npm run test:integration` 549 passing exit 0; `tools/realdoc-score/run.sh s269-final` = 2,421 / 2,438 (99.30%) divergent 17.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] Session 269 records — backlog sub-item (d) closed, learnings #554–#557
- **Change:** `BACKLOG.md` loses the `(d)` R4 bullet and its head item now reads FIVE sub-items behind 10 of the 17 divergent documents (7 fixable); the Active note and the ranking guidance carry the measured 2,421 / 2,438 (99.30%) and recommend `(c)`, R3, next. `PROJECT_LEARNINGS.md` gains four rows: #554 the ground-truth extractor is blind to exactly the shapes a heading-content rule is about, #555 a one-document sweep of block-opening constructs is contaminated by its own earlier rows, #556 the same name tables answer different questions under inverted defaults, #557 decide decline-the-match vs drop-the-emission by rendering the two shapes that separate them.
- **Commit/PR:** this entry's own commit
- **Session:** S269 · **Verified:** row numbers checked contiguous (550–557); `node check-backlog.js` OK, 206 open items; `npm test` 2962/2962. Every number in the backlog edits is from this session's own `tools/realdoc-score/run.sh` output, not quoted (#552).
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] R4 runtime gate — the Outline the user sees, in a real Extension Development Host
- **Change:** `test/integration/suite/outline.test.ts` gains the Session 269 row: an ABSENT half over the two CORPUS shapes (`### 1. <Section heading>` and `## \maketitle`, ordinals 3004 and 1985) asserting both are out of the Outline while the headings either side survive, and a PRESENT half over four neutralisers (code span, `\<` escape, math, inline tag) so the ABSENT half cannot pass for a build that has simply stopped showing headings that mention a tag or a macro.
- **Commit/PR:** this entry's own commit
- **Session:** S269 · **Verified:** `npm run test:integration` — **549 passing, exit 0** (measured; the Session 266 record says 548 before this row). Operator consent taken before launch, as the screen-taking gate requires. The row is in what ran: `grep -c` finds it in the emitted `out/test/integration/suite/outline.test.js`.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] R4 — `applet`/`object` removed from the refusing set, the rest of the surface pinned, 28 mutants run
- **Change:** `applet` and `object` are OUT of `HEADING_BLOCK_TAG_OPEN`. This session had put them in on its own measurement and that measurement was wrong: `tools/realdoc-score/extract_headings.py` reports no heading for `### T <applet>` because the `<applet>` element swallows the rest of the HTML including the heading's own `</h3>`, while the render really contains `<h3 class="anchored">T098 <applet>`. Reading the raw HTML instead re-classifies all 233 name probes: the opener set is EXACTLY `PANDOC_BLOCK_CLOSE_TAGS` and no `PANDOC_EITHER_TAGS` name participates. Also: 11 rows (R4c–R4m, labelled TEST-AFTER) pinning the setext spelling, closing tags, `textarea`/`title`, the two arity rules, the absent tail rule, all six levels, trailer stripping, the tag-name boundary, the two DIFFERENT reader sets and their extension override; and the recovered `SETEXT_H1` raw-HTML residual.
- **Commit/PR:** this entry's own commit
- **Session:** S269 · **Verified:** 28 mutants over the new gate, **27 killed** (`scratchpad/s269/tools/mutants.py`) — including one that puts `applet`/`object` back, which the corrected row now kills. The single survivor is the CDATA branch, disclosed in its docstring as an unobservable term rather than repaired. `npm test` 2962/2962; `npm run check-types` exit 0; `tools/realdoc-score/run.sh s269-final` = scored 2438 agree 2421 (99.30%) divergent 17. Blast radius measured document by document over the whole corpus: **exactly 2 of 3,383 outlines change, 1985 and 3004** — the two R4 documents, nothing else in text or level.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] R4, HTML half — a block-level tag anywhere in a heading's content means the line is no heading
- **Change:** `src/core/qmd/model.ts` gains `headingAngleEnd`, an HTML5-tokenizer-shaped reader for the `<` branch of the same scan: comments, CDATA sections and processing instructions consume their interior (an UNTERMINATED one consumes nothing), `<!DOCTYPE` does not, the name ends at the first whitespace / `/` / `>` with every other character part of it, and attributes are scanned QUOTE-AWARE — without a `>` outside quotes there is no tag. Names come from the existing `PANDOC_BLOCK_CLOSE_TAGS` list with two measured deltas: `applet` and `object` also refuse as OPENERS (the only 2 of 16 `PANDOC_EITHER_TAGS` that do), and `</script>` alone does not refuse as a CLOSER. A tenth reader flag gates it on THREE bases — `markdown`, `markdown_mmd`, `markdown_phpextra` — a different set from the TeX half's on the same nine documents.
- **Commit/PR:** this entry's own commit
- **Session:** S269 · **Verified:** strict TDD — RED `R4b` shown first (`### 1. <Section heading>`, the corpus shape at ordinal 3004), then GREEN. `tools/realdoc-score/run.sh s269-r4` = **scored 2438 agree 2421 (99.30%) divergent 17 phantom 2 lost 8 level 7**, against a baseline measured this session of agree 2419 (99.22%) divergent 19 phantom 4: ordinals 1985 and 3004 leave the divergent list and the lost and level lists are unchanged. `npm test` 2951/2951; `npm run check-types` exit 0. Name sets measured one document per name (114 opener probes, 119 closer probes) — a single-document sweep of the same names is unsound and reported `applet`/`object` backwards.
- **Found on the way:** one pinned PRE-EXISTING phantom is recovered by this change — `SETEXT_H1`'s documented raw-HTML residual (`<div>` under a `===`, Session 197's Family A). Re-rendered and the pin rewritten; its raw-TeX twin (`\clearpage`) is class B and is unchanged.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] R4, TeX half — a class-A block macro anywhere in a heading's content means the line is no heading
- **Change:** `src/core/qmd/model.ts` gains `headingContentRefused` — a left-to-right SCAN of the heading's raw content (not a containment test) that skips code spans, `\`-escapes, math, bracketed inline content, quarto shortcodes and a macro's own argument groups, and refuses the line at a class-A block macro. Three new anchored name predicates read the EXISTING `PANDOC_BLOCK_MACROS_*` tables under a different arity rule: no tail rule, BARE kills with or without braces, ARG needs a BRACED group (an optional `[…]` does not satisfy it), and the default is ALLOW — an unknown macro keeps its heading, the opposite of `RAW_TEX_BLOCK_OR_MACRO_LINE`. Gated by a ninth reader flag, `fromRefusesBlockInHeading`, whose fail-safe answer is KEEP and whose `-raw_tex` extension outranks the base name. Read at ONE site, `buildHeading`, so the ATX and setext paths share it.
- **Commit/PR:** this entry's own commit
- **Session:** S269 · **Verified:** strict TDD — RED `R4a` shown first, failing with the phantom `h2:\maketitle` (the corpus shape, ordinal 1985), then GREEN. `npm test` 2950/2950 (66 files); `npm run check-types` exit 0; the 19 `Session 269 GUARD` rows still green. The allow/deny direction is measured: a default-deny predicate reaches 18 corpus documents and 73 heading lines, against the 1 line R4 is about.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] R4 guards — 19 rows pinning the heading content a block-token gate must NOT refuse
- **Change:** `test/unit/qmd-model.test.ts` gains `Session 269 GUARD`: 19 rows, all GREEN before any `src/` change, over the shapes measured to NEUTRALISE a block token — code spans, `\<` escapes, `\\`, entities, math, link label/destination/title, inline notes and bracketed spans, comments, CDATA, processing instructions, quarto shortcodes, a raw inline TeX command's braced argument, a tag inside another tag's quoted attribute value, inline and unknown tag names, non-tag angle brackets, class-B/C macros, unsatisfied ARG arity, the setext control, and the two downstream-state rows. A containment test over the raw line deletes every one of them.
- **Commit/PR:** this entry's own commit
- **Session:** S269 · **Verified:** `npx vitest run -t "Session 269 GUARD"` 19 passed; `npm run check-types` exit 0. Every row is a `quarto render --to html --no-execute` (quarto 1.7.33) of those exact bytes, re-run firsthand in `scratchpad/s269/probes/verify/` (40 shapes) after four measuring agents and two adversarial refuters proposed them.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] Session 269 claimed — sub-item (d), R4: a block-level HTML tag or TeX command in ATX content means the line is not a heading (in progress)
- **Change:** Phase 1B claim — `SESSION_NOTES.md` ACTIVE TASK rewritten to the R4 task, and a `status: pending` receipt opened in `HANDOFFS.md`. The two tracked measurement logs `.context-budget-history.jsonl` and `dashboard_history.jsonl` carry the append Phase 0's own runs made. Operator-picked at Phase 0 by `AskUserQuestion` from four ranked options (R4 recommended; the others were the attribute-tokenizer plan's P2, R3 grid-table cells, and a catch-all). No code touched yet.
- **Commit/PR:** this entry's own commit
- **Session:** S269 · **Verified:** Phase 0 found 0 undocumented commits (`CHANGELOG.md` frontier `a33319fa` is HEAD) and every receipt complete; `npm run compile` exit 0 and `npm test` 2930/2930 on the tree this claim commits on top of. Target is a MEASURED 2 authored documents / 3 phantom headings (`docs/REAL-DOCUMENT-RESCORE.md` R4).
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] `SESSION_NOTES.md` — the oldest close-out pair dropped (S264 evaluation by S265 + S265 self-assessment)
- **Change:** 51 lines deleted and nothing else, per the three-pair retention rule (`CLAUDE.md`, Session 256). The pair stays in git: `git show 0dafb94d:SESSION_NOTES.md`.
- **Commit/PR:** this entry's own commit
- **Session:** S268 · **Verified:** the count is `git diff --numstat` on the final tree, not an estimate (Learning #552); the diff shows deletions only
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] Session 268 closed out — the real-document measure is tracked and adopted
- **Change:** the S268 `HANDOFFS.md` receipt set `status: complete` (self 8, predecessor 9); `SESSION_NOTES.md` ACTIVE TASK rewritten (NONE; the measure's command and HEAD number now sit where every session reads them) plus the S267 handoff evaluation and the S268 self-assessment. Commits this session: `a529ad38` claim · `f56d3cc4` scorer · `b444d843` census + raw-HTML · `e27236ef` driver + README · `f2bac897` fenced-div closed · `0a8c1395` adoption · `ed135ec7` ledger correction · `3a6e451d` learnings · this close-out · a notes trim to follow.
- **Commit/PR:** this entry's own commit
- **Session:** S268 · **Verified:** `quality_ratchet: 2/2 pass · 0 fail · 0 unmeasured · results bba236856bad · manifest 8845021a4049` at `3a6e451d`; `npm test` 2930/2930; `check-types` exit 0; `check-package` OK 42 files; `check-backlog` OK 206 open items; `tools/realdoc-score/run.sh head` = 2,419 / 2,438
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] Session 268 learnings #552–#553 — measure before you write the number; move an instrument only with byte-identical controls
- **Change:** two rows appended to `PROJECT_LEARNINGS.md`: #552, two ledger entries in two sessions quoted a size that did not exist yet, so write the command and paste its output; #553, an instrument moves into tracked code only when every stage reproduces its old output byte for byte, with a second known input and a packaging control that can fail.
- **Commit/PR:** this entry's own commit
- **Session:** S268 · **Verified:** row numbers checked contiguous (550–553)
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] Ledger correction — the adoption entry's `CLAUDE.md` size (21,412 → 21,234 B)
- **Change:** the adoption entry's `**Session:**` line quoted a size written before the file was final; `wc -c` says 21,234 B. Corrected in place with the correction disclosed on the line itself. ⚠ This is the SECOND such slip in two sessions (Session 267 wrote 58 lines where the trim deleted 60), which is why Session 268 files it as a learning rather than a one-off.
- **Commit/PR:** this entry's own commit
- **Session:** S268 · **Verified:** `wc -c CLAUDE.md` → 21234
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] The corrected real-document score is ADOPTED as the standing measure (report Recommendation 4)
- **Change:** `CLAUDE.md` gains §The real-document measure — the command, when to run it (after any change reaching `findHeadings`, cited in the close-out receipt), and the two ⚠ facts that make it a habit rather than a gate: the corpus is personal, so neither CI nor `.quality-gates.json` can run it, and a corpus document is named only by its ordinal. `BACKLOG.md`'s Active note now reads F3/F5 as decided (Session 267), F6 as closed (Session 268), and points at the tracked measure.
- **Commit/PR:** this entry's own commit
- **Session:** S268 · **Verified:** the measure it adopts is the one this session made reproducible from tracked files (2,419 / 2,438 at HEAD, 2,418 on `b5_head`); `check-backlog` OK, 206 open items; `CLAUDE.md` 21,234 B of its 28,000 B ceiling (⚠ this line first said 21,412 — a size written before the file was final, the second such slip in two sessions; see the correction entry above)
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [BL-A QUARTO FENCED DIV / CALLOUT is a container `contentColumns` never pushes] Closed on the operator's word — both halves are answered and its own example agrees
- **Change:** the item is removed from `BACKLOG.md`. Filed Session 193, it bundled two questions: whether a `:::` opener pushes a content column (it does not need to — Session 189 measured a plain fenced div's content column as 0) and the callout-title rule (shipped Session 257). Its own example, indented and unindented, yields no heading in the model and none in quarto (Session 265 F6; the model half re-checked at HEAD in Session 266), and it explains none of the 19 divergent authored documents. `check-backlog` could not see it, because its lead did not announce completion — which is why it needed the operator's word.
- **Commit/PR:** this entry's own commit
- **Session:** S268 · **Verified:** `check-backlog` OK — 206 open items, one fewer than before
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] The real-document measure, part 3 of 3 — one driver, a README, and the measure is reproducible from tracked files alone
- **Change:** `tools/realdoc-score/run.sh` runs all four stages for a label and any directory holding `src/` (so a past build scores over byte-identical input), writing intermediates to `$REALDOC_DATA/runs/<label>/`; `README.md` states what is tracked, what is personal and never committed, the ordinal-only rule, how to compare two builds, how to read the number — and the known gap that the ground-truth RENDER passes are not here.
- **Commit/PR:** this entry's own commit
- **Session:** S268 · **Verified:** from the tracked scripts only, `run.sh head` reproduces **2,419 / 2,438** (99.22%) in ~4.3 s warm, and `run.sh b5_head scratchpad/s265/builds/b5_head` reproduces **2,418 / 2,438** with ordinal 2494 the single difference — the two numbers this session's DONE named; `check-package` OK, 42 files
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] The real-document measure, part 2 of 3 — the census and raw-HTML stages move into `tools/realdoc-score/`
- **Change:** `tools/realdoc-score/census.test.ts` (stage 1, a build's `findHeadings` over the frozen corpus; `CENSUS_*` renamed to `REALDOC_SRC` / `REALDOC_CORPUS` / `REALDOC_OUT`, each missing one now naming itself), `vitest.census.config.ts` (its own config — the unit `vitest.config.ts` must never pick up a stage needing a personal corpus and 30 minutes) and `rawhtml_adjust.js` (stage 2; the model bundle is now a REQUIRED argument, where the old default pointed at a file beside the script in `scratchpad/`). `tsconfig.unit.json` includes `tools/**/*.ts`, so `check-types` covers the one tracked `.ts` here that nothing else would.
- **Commit/PR:** this entry's own commit
- **Session:** S268 · **Verified:** stage 1's output is byte-identical (`cmp`) to Session 265's HEAD census over the same corpus (3,383 documents, 0 threw, 28,162 headings) and stage 2's to its `rawadj_s266.tsv` (14 documents, 98 raw tags); the scan logic of stage 2 is byte-identical by `diff`; `npm run check-types` exit 0
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] The real-document measure, part 1 of 3 — the scorer moves into `tools/realdoc-score/`
- **Change:** `tools/realdoc-score/score.py` (Session 265's `score_corrected.py`, with every `scratchpad/` path replaced by `REALDOC_DATA` / `REALDOC_ORDINALS` and a stated error for each missing input), `scorelib.py` (its library half; the hard-coded `divergent.json` CLI is gone, the uncorrected `score()` kept as the Session 251 baseline) and `extract_headings.py` (the corrected extractor; executable code byte-identical to `extract_headings_v2.py`, three personal document paths in its comments replaced by corpus ordinals 1, 28, 308/669 — Learning #548). `.vscodeignore` gains `tools/**`, in this same commit, so no commit on `master` is red.
- **Commit/PR:** this entry's own commit
- **Session:** S268 · **Verified:** the tracked scorer reproduces **2,419 / 2,438** at HEAD and **2,418 / 2,438** on Session 265's `b5_head` build, ordinal lists identical, and matches `score_corrected.py` on the same inputs; `diff` shows the extractor's code region differs only in the scrubbed comment; `check-package` OK — 42 files, and RED (`unexpected tools`) with the `.vscodeignore` line removed, then byte-restored
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] Session 268 claimed — adopt the real-document score as a standing, tracked measure; close the fenced-div item (in progress)
- **Change:** `SESSION_NOTES.md` ACTIVE TASK stub and a `status: pending` S268 receipt in `HANDOFFS.md`; the Phase 0 dashboard telemetry append rides along. Operator-directed after the S267 close-out report (report Rec. 4 and F6); scope and location chosen by `AskUserQuestion`.
- **Commit/PR:** this entry's own commit (the claim)
- **Session:** S268 · **Verified:** n/a — docs-only
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] Ledger correction — the notes-trim entry's line count (58 → 60)
- **Change:** the immediately preceding entry's `**Change:**` line said 58 lines deleted; `380d23fe` deletes 60. The number was written before the deletion ran. Corrected in place with the correction disclosed on the line itself, rather than left wrong in the authoritative ledger.
- **Commit/PR:** this entry's own commit
- **Session:** S267 · **Verified:** `git show --stat 380d23fe` — `SESSION_NOTES.md | 60 ------`
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] `SESSION_NOTES.md` — the oldest close-out pair dropped (S263 evaluation by S264 + S264 self-assessment)
- **Change:** 60 lines deleted and nothing else, per the three-pair retention rule (`CLAUDE.md`, Session 256). The pair stays in git: `git show 7c685b47:SESSION_NOTES.md`. ⚠ **Corrected in place by `380d23fe`'s successor:** this line first said 58, a count written before the deletion ran; `git diff --stat` on `380d23fe` says 60.
- **Commit/PR:** this entry's own commit
- **Session:** S267 · **Verified:** `git diff --stat` shows deletions only
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] Session 267 closed out — the decision records and the clean-room boundary
- **Change:** the S267 `HANDOFFS.md` receipt set `status: complete` (self 8, predecessor 8); `SESSION_NOTES.md` ACTIVE TASK rewritten (NONE; the open item is a black-box confirmation of the Posit half of both decisions) plus the S266 handoff evaluation and the S267 self-assessment. Commits this session: `7ec75319` claim · `9216c338` records · this close-out · a notes trim to follow.
- **Commit/PR:** this entry's own commit
- **Session:** S267 · **Verified:** `quality_ratchet: 2/2 pass · 0 fail · 0 unmeasured · results bba236856bad · manifest 8845021a4049` at `9216c338`; `npm test` 2930/2930; `check-backlog` OK (207 open items)
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] Two operator decisions recorded — raw HTML `<hN>` are not Outline headings; R7's appendix re-level is not mirrored — plus the clean-room practice
- **Change:** `BACKLOG.md` — a RECORD item holding both decisions, and the head item's `(g)` sub-item retired into it (six sub-items remain, behind 12 of the 19 divergent documents, 9 of them fixable). `CLAUDE.md` — §Clean-room boundary: Posit's extension is AGPL-3.0 (`"license": "agpl-3.0"`, AGPL v3 in its `LICENSE.txt`, `quarto.quarto-1.135.0`), so behaviour parity is the goal and its source is not a reference; settle "what does Posit do?" by black-box observation, and where `quarto render` and Posit's Outline disagree, that is a decision rather than a defect. ⚠ Both decisions' Posit half rests on a BUNDLE GREP, labelled as such in the record and awaiting a black-box confirmation nothing yet depends on.
- **Commit/PR:** this entry's own commit
- **Session:** S267 · **Verified:** no code change — the model already implements both answers (re-checked this session on the fenced-div example); `check-backlog` OK, 207 open items; `CLAUDE.md` 19,905 B of its 28,000 B ceiling
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] Session 267 claimed — record two operator decisions and the clean-room practice (in progress)
- **Change:** `SESSION_NOTES.md` ACTIVE TASK stub and a `status: pending` S267 receipt in `HANDOFFS.md`; the Phase 0 dashboard telemetry append rides along. Operator-directed after the S266 close-out report; no backlog item names these decisions (grepped), hence `[ad hoc]`.
- **Commit/PR:** this entry's own commit (the claim)
- **Session:** S267 · **Verified:** n/a — docs-only
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] Session 266 closed out — (a), R1
- **Change:** the S266 `HANDOFFS.md` receipt set `status: complete` (self 8, predecessor 9); `SESSION_NOTES.md` ACTIVE TASK rewritten (NONE; recommended next pick the same item's (d), R4, with the re-score recipe) plus the S265 handoff evaluation and the S266 self-assessment; one `context_budget.py` telemetry append. Commits this session: `801aa776` claim · `8256fb4d` fix · `9b3d878e` runtime gate · `132c7a9a` learnings · `efd7e7d0` notes trim · this close-out.
- **Commit/PR:** this entry's own commit
- **Session:** S266 · **Verified:** `quality_ratchet: 2/2 pass · 0 fail · 0 unmeasured · results bba236856bad · manifest 8845021a4049` at `efd7e7d0`; `npm run check-types` exit 0; `npm test` 2930/2930; `npm run test:integration` 548 passing; `check-backlog` OK (206 open items)
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] `SESSION_NOTES.md` — the oldest close-out pair dropped (S262 evaluation by S263 + S263 self-assessment)
- **Change:** 51 lines deleted and nothing else, per the three-pair retention rule (`CLAUDE.md`, Session 256). The pair stays in git: `git show 132c7a9a:SESSION_NOTES.md`.
- **Commit/PR:** this entry's own commit
- **Session:** S266 · **Verified:** `git diff --stat` shows deletions only
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] Session 266 learnings #549–#551 — unmasking vs causing, inherited gates, polarity is not a measurement
- **Change:** three rows appended to `PROJECT_LEARNINGS.md`: #549 classify a new divergence as inherited only from a rendered twin; #550 a construct routed through an existing branch inherits that branch's blind spots; #551 render the case a "declining is safe" rule guards against before applying it.
- **Commit/PR:** this entry's own commit
- **Session:** S266 · **Verified:** n/a — docs-only; row numbers checked contiguous (540–551)
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] The runtime gate for (a), R1 — an outline row in a real Extension Development Host, run and green
- **Change:** `test/integration/suite/outline.test.ts` — one row through `vscode.executeDocumentSymbolProvider`: PRESENT, a 64-`#` run and a text-bearing `########` run release three glued `##` headings and are no outline rows themselves; ABSENT, the same run pressed under prose releases nothing. Both documents rendered through quarto 1.7.33 first (`scratchpad/s266/probes/v/i1`, `i2`): quarto agrees with this build and not with HEAD's on PRESENT.
- **Commit/PR:** this entry's own commit
- **Session:** S266 · **Verified:** `npm run test:integration` exit 0, 548 passing (547 before the row, run first with the operator's consent; this run after a second explicit yes)
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] Sub-item (a), R1 — a line of 7+ `#` is a pandoc header: it ends the paragraph, and the outline never shows it
- **Change:** `src/core/qmd/model.ts` — `DEEP_ATX_HEADER` (and its tight twin) and `deepAtxHeaderLineIsBlock`, read by `closesParagraph` and `opensFreshBlock` under the ATX row's column rule and paragraph question, plus one `SIMPLE_TABLE_HEADER_OUTRANKED` row. The run stays a BODY line, so an underline below still claims it. A first build routed the run through the ATX branch; the adversarial pass refuted it (a quoted `> #######` / `> ---` lost its heading, R5) and it never reached a commit. `test/unit/qmd-model.test.ts` — R1–R8, G1–G9 and one RESIDUAL pin. `BACKLOG.md` — (a) removed from its item, the Active note now recommends (d), the headline numbers and the item's `model.ts` line citations updated, and one by-catch item filed ("What a line of 7+ `#` used to MASK …").
- **Commit/PR:** this entry's own commit
- **Session:** S266 · **Verified:** strict TDD, every R row RED for its stated reason before GREEN (R8 written after its term, and says so); `npm test` 2930/2930; `check-types` exit 0; 14/14 mutants killed; corpus re-score 2,419 / 2,438 (was 2,418), ordinal 2494 +26 headings and 0 removed, no other document's headings, outline, cells, body lines or fence openers moved; 422 designed probes: 117 fixed, 0 broken; 1,941 adversarial probes: 398 fixed, 379 new phantoms, every one inherited from a rendered twin.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [BL-The Outline's last real-document divergences — eight root causes behind the 20 authored documents that still differ from quarto, no trigger of them described by an open item] Session 266 claimed — sub-item (a), R1: a line of 7+ `#` ends the paragraph (in progress)
- **Change:** `SESSION_NOTES.md` ACTIVE TASK stub and a `status: pending` S266 receipt in `HANDOFFS.md`; the Phase 0 dashboard telemetry append rides along. Operator-picked at Phase 0 (option 1 of 4, the recommended one).
- **Commit/PR:** this entry's own commit (the claim)
- **Session:** S266 · **Verified:** n/a — docs-only
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] Session 265 closed out — audit: the real-document re-score
- **Change:** the S265 `HANDOFFS.md` receipt set `status: complete` (self 7, predecessor 8); `SESSION_NOTES.md` ACTIVE TASK rewritten (NONE; recommended next pick the Up Next head item's (a), R1, with the re-score recipe) plus the S264 handoff evaluation and the S265 self-assessment; one `context_budget.py` telemetry append. Commits this session: `2c611290` claim · `ad7a52a4` report + backlog · `2bf70504` learnings · `d403fc37` notes trim · this close-out.
- **Commit/PR:** this entry's own commit
- **Session:** S265 · **Verified:** `quality_ratchet: 2/2 pass · 0 fail · 0 unmeasured · results bba236856bad · manifest 8845021a4049` at `d403fc37`; `npm run compile` exit 0; `npm test` 2912/2912; `check-backlog` OK (205 open items)
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] `SESSION_NOTES.md` — the oldest close-out pair dropped (S261 evaluation by S262 + S262 self-assessment)
- **Change:** 63 lines deleted and nothing else, per the three-pair retention rule (`CLAUDE.md`, Session 256). The pair stays in git: `git show 2bf70504:SESSION_NOTES.md`.
- **Commit/PR:** this entry's own commit
- **Session:** S265 · **Verified:** `git diff --stat` shows deletions only
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] Session 265 records — learnings #545–#548
- **Change:** `PROJECT_LEARNINGS.md` gains four rows from the re-score: #545 a renamed input changes the engine quarto measures under; #546 construct presence is an upper bound, attribution the measure; #547 define "heading" by the parser the product mirrors, not the rendered tag; #548 give every headline number a script and grep every "synthetic" string against the corpus. None is a mechanical invariant, so none is a gate.
- **Commit/PR:** this entry's own commit
- **Session:** S265 · **Verified:** n/a — docs-only
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-19 · [ad hoc] Audit: the real-document re-score — 98.24% agreement at HEAD (99.18% with the instrument corrected); the 20 divergences left come from eight root causes no open item describes
- **Change:** `docs/REAL-DOCUMENT-RESCORE.md` (new): six builds (Session 251 → HEAD) scored over one frozen copy of the 3,383-document authored corpus; Session 251's published numbers reproduced exactly first (three controls). Every change since Session 251 was a pure gain (45 + 21 + 15 documents fixed, 0 newly divergent, 0 real headings deleted). All 43 divergent documents attributed (a 14-agent diagnose-then-refute workflow; 23 reproductions re-run firsthand): 26 are instrument artifacts — I1 quarto UI chrome, I2 raw HTML `<hN>`, I3 every `.Rmd` rendered as `.qmd` (which also hid 3 real divergences) — and the corrected instrument (`scratchpad/s265/score_corrected.py`) gives 2,418 / 2,438 with 20 divergent. `BACKLOG.md`: new "Up Next" head item *The Outline's last real-document divergences — eight root causes …* ((a)–(h), R1 a 7+ `#` line = 26 lost headings in one document); the Active note's candidates and ranking guidance rewritten to supersede Session 251's; the fenced-div container item annotated as probably complete (operator decision, report F6). Privacy: corpus documents named only by ordinal; every quoted reproduction uses invented text. The report was reviewed by three agents (numbers, privacy, citations) before commit and their confirmed findings corrected.
- **Commit/PR:** this entry's own commit
- **Session:** S265 · **Verified:** `node check-backlog.js` OK (205 open items); `npm test` 66 files / 2912 passed; no `src/` or `test/` change
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] Session 265 claimed — audit: re-score the 3,383 authored documents at HEAD and re-rank the backlog by real reach (in progress)
- **Change:** `SESSION_NOTES.md` ACTIVE TASK stub and a `status: pending` S265 receipt in `HANDOFFS.md`; the Phase 0 dashboard telemetry append rides along. Operator-picked at Phase 0 (option 1 of 4); no backlog item names this re-score (grepped), hence `[ad hoc]`.
- **Commit/PR:** this entry's own commit (the claim)
- **Session:** S265 · **Verified:** n/a — docs-only
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] Pushed `master` to `origin` (public), `ebaf7460..20e2708c` — 216 commits, Sessions 230–264
- **Change:** GitHub `rmsharp/vscode_quarto_ext` `master` moves from `ebaf7460` (Session 229, the last push, 2026-08-19) to `20e2708c`, a fast-forward (0 behind after a fresh fetch). Operator-directed ("push it"), then confirmed with the full scope shown: 216 commits, not only this session's 14. Before pushing, the range was scanned for secrets, key files, `.vsix`, `scratchpad/` and `node_modules` content, and none was found (48 files changed).
- **Commit/PR:** no commit, a non-commit action; this entry's own commit is the first after the push and is NOT pushed — the next push carries it
- **Session:** S264 · **Verified:** `git push` exit 0 (`ebaf7460..20e2708c  master -> master`); `git ls-remote origin refs/heads/master` = `20e2708c3f06…` = local HEAD; `git rev-list --left-right --count master...origin/master` = `0 0`
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] Session 264's handoff corrected — D7 is decided and nothing is owed upstream; both were written as open
- **Change:** after S264 closed out, methodology Session 191 recorded P8 in the upstream plan (row `:1009`, block `:354`; `10f931a`, `0b7e672`), filed the `check-handoff` fence bug as BL-72 (S192 claimed its fix, `96de3ee`), and recorded the operator's D7 decision for this project: `HANDOFFS.md` STAYS in `.context-budget.json` at 65,536 B, and the remedy is a trim here, not dropping the warning. S264's handoff still called both open, in three places, now corrected: `SESSION_NOTES.md` ACTIVE TASK; the S264 receipt's `active_task`, `whats_next` #2(a) and #3, `key_files` (plan anchors re-read at methodology `b27236e`: `:956` → `:1009`, and the rest) and gotcha 3; and the `HANDOFFS.md` comment in `.context-budget.json`, which said the entry was over "until the operator decides". No threshold changed. Noted for the trim: the trimmer fires only above 196,608 B, so it needs `--budget-bytes` or `--cut N --force`.
- **Commit/PR:** the commit that ships this entry
- **Session:** S264 · **Verified:** every cited methodology anchor re-read at `b27236e` (`:354`, `:392`, `:960`, `:985`, `:1009`, `:1228`–`:1240`; the three commits exist); `grep -c ':956'` = 0 in `SESSION_NOTES.md` and `HANDOFFS.md`; `.context-budget.json` parses; `grep -c '^status: pending' HANDOFFS.md` = 0
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] Session 264 close-out amended — the receipt cites the gate run; self-score lowered to 7
- **Change:** the S264 `HANDOFFS.md` receipt's `runtime_smoke` now cites the gate run and drops its "no gates, no citation owed" line, `whats_next` #5 tells the next session that every close-out runs the ratchet, and `self_score` goes 8 → 7. `SESSION_NOTES.md`'s ACTIVE TASK names the gates, and the self-assessment records the miss: this session closed out against the Orient-time runner rather than the one it had just synced, and the operator had to send the close-out back.
- **Commit/PR:** the commit that ships this entry; the gates themselves are `d71e5870`
- **Session:** S264 · **Verified:** `quality_ratchet: 2/2 pass · 0 fail · 0 unmeasured · results bba236856bad · manifest 8845021a4049` at `d71e5870`; `grep -c '^status: pending' HANDOFFS.md` = 0
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] The project's first quality gates — `release-gate` and `ledger-lag` — declared from Learning #544 (operator's decision)
- **Change:** `.quality-gates.json`, empty since the sync, now declares two gates at their measured values: `release-gate` (`npm run check-package` must exit 0; ~48 s) and `ledger-lag` (commits after the newest commit touching `CHANGELOG.md` must be 0 — Phase 0's reconcile set, and the set that makes the trimmer refuse with `P1_UNDOCUMENTED`). Learning #544's *When to apply* now points at them. Every close-out from here runs `python3 quality_ratchet.py --run` and cites its line in the receipt (`SESSION_RUNNER.md` Phase 3E); the ratchet means a gate is loosened only by plan-mode approval, in its own commit. The pre-commit hook (`install-hook`) is NOT installed. **Why:** the synced Phase 3C says *a mechanical learning is a gate, not a row*, and this session had closed out against the Orient-time runner, which lacked that rule. The operator chose both gates over `ledger-lag` alone, accepting ~48 s per close-out to catch a new root file at the close-out of the session that adds it. **Also on the record:** under the same synced rules, removing a gate takes approval, its own commit and a reason in the ledger. Dropping `CHANGELOG.md` from `.context-budget.json` had the first and third, but shared `4b727a9d` with the `CLAUDE.md` text that records it.
- **Commit/PR:** the commit that ships this entry
- **Session:** S264 · **Verified:** `quality_ratchet: 2/2 pass · 0 fail · 0 unmeasured · results bba236856bad · manifest 8845021a4049` on the working tree before this commit; controls — `ledger-lag` measures 1 → `fail` after an empty unrecorded commit (scratch clone), `release-gate` exits 1 → `fail` with a throwaway root file (real tree, file removed after)
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] Session 264 closed out — BL-57 P8 done for this project: methodology synced, both ledger seeds migrated, legacy tags recorded
- **Change:** `SESSION_NOTES.md` carries the S263 handoff evaluation (8/10) and the S264 self-assessment (8/10); the S264 `HANDOFFS.md` receipt is `status: complete`. The operator-facing findings P8 surfaced are in the receipt's `whats_next` #2–#3: the D7 budget question for `HANDOFFS.md`, two synced-rule references to `HANDOFFS.md` sections this file does not carry, and the methodology repo's `bin/check-handoff` skipping the newest receipt behind the seed section's ```` ```sh ```` fence. **One correction to this session's claim entry, which is not edited:** it says per-commit entries "arrive with this sync", but the old Phase 3F already said one per commit; what the sync added is the claim's *(in progress)* entry.
- **Commit/PR:** the close-out commit (ships this entry); session commits `48d1790c`, `e8c395b3`, `b8a503e7`, `acb43e0b`, `69f0dd43`, `4b727a9d`, `e2ad2dbb`, `6d66070a`, `3fa063aa`, `a8e56e54`
- **Session:** S264 · **Verified:** on the final tree — `compile` exit 0, `npm test` 2912/2912 (66 files), `check-package` OK (42 files), `check-backlog` OK (204 open); `bin/status` all `current`, both ledgers `present`; trimmer L1–L3 OK on both ledgers; archive proofs OK. Runtime smoke n/a — docs and config only.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] `SESSION_NOTES.md` — the oldest close-out pair dropped (S260 evaluation by S261 + S261 self-assessment)
- **Change:** 69 lines removed, old :143–211; lines :1–142 byte-identical. The retention rule in `CLAUDE.md` holds the live file at three pairs once this session's own pair lands. The dropped pair stays one command away: `git show 6d66070a:SESSION_NOTES.md`.
- **Commit/PR:** the commit that ships this entry — a trim commit, with no other edit to `SESSION_NOTES.md`
- **Session:** S264 · **Verified:** `cmp` of kept lines 1–142 against the parent; `git diff -U0` is one hunk, `-143,69`
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] Session 264 records — learnings #543–#544
- **Change:** `PROJECT_LEARNINGS.md` gains #543 (a methodology sync can finish open backlog items, and `[ad hoc]` hides it — grep `BACKLOG.md` before tagging) and #544 (deny a sync's new root files before the sync commit; give every commit its own entry so the trimmer can verify it).
- **Commit/PR:** the commit that ships this entry
- **Session:** S264 · **Verified:** n/a — docs-only
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] BL-57 P8 — two phrases in the `.context-budget.json` comments `4b727a9d` rewrote, made exact
- **Change:** the top-level comment said "the 65,536 B read-mandated ceilings" matched the trimmer's budget; only the two ledgers' did — it now says so and notes `BACKLOG.md` uses the same number with no trimmer. The `HANDOFFS.md` comment said "62,521 B after the Session 254 trim"; that trim (`867e0fa2`) left 52,850 B, and 62,521 B is the size when the config was written at Session 255 (`d4c90592`). The error predates this session, but it sat inside a sentence `4b727a9d` rewrote. No number the tool reads changed.
- **Commit/PR:** the commit that ships this entry
- **Session:** S264 · **Verified:** `git show 867e0fa2:HANDOFFS.md | wc -c` = 52,850 and `git show d4c90592:HANDOFFS.md | wc -c` = 62,521; `python3 -m json.tool` parses the config
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [BL-Migrate `CHANGELOG.md`'s header/preamble to the current v3.1+ "Authoritative Action Ledger" seed format] Done by `acb43e0b` — the item leaves `BACKLOG.md` one commit late
- **Change:** the Session 158 grooming item is removed from `BACKLOG.md` "Up Next". Its own acceptance test holds: `bin/status --source=local` reads `CHANGELOG.md` `present`, and every entry is byte-identical. **Correction:** `acb43e0b`'s entry was tagged `[ad hoc]` and left the item open, against the rule that a finished backlog item leaves `BACKLOG.md` in the same commit. Found by this session's adversarial verification, not by `check-backlog`, which sees completed records rather than finished open items.
- **Commit/PR:** `acb43e0b` did the work; the commit that ships this entry removes the item
- **Session:** S264 · **Verified:** `bin/status` `present`; `node check-backlog.js` OK, 206 → 204 open items (this item and the next)
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [BL-`methodology_dashboard.py` is two minor versions stale] Done by the sync `b8a503e7` — the item leaves `BACKLOG.md` one commit late
- **Change:** the Session 174 item is removed from `BACKLOG.md` "Up Next". The dashboard is now v2.18.0, canonical at fork `0ab3881`, and `bin/status` reads it `current`. **Correction:** `b8a503e7`'s entry was tagged `[ad hoc]` and left the item open; the item itself asked to be done together with the header migration, and it was.
- **Commit/PR:** `b8a503e7` did the work; the commit that ships this entry removes the item
- **Session:** S264 · **Verified:** `python3 methodology_dashboard.py --help` banner v2.18.0; `bin/status` `current`
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] BL-57 P8 — `CLAUDE.md` records this ledger's legacy tags and its `[BL-<item title>]` form; `CHANGELOG.md` leaves `.context-budget.json`
- **Change:** a new `CLAUDE.md` Adaptations subsection, *`CHANGELOG.md` conventions (Session 264)*: backlog items are tagged `[BL-<item title>]` (no `]` in the title), methodology work `[ad hoc]`; the `[BACKLOG: <title>]` tags, the untagged June 2026 shard entries and the positional `[BL-<N>]` tags are legacy, left as written, with the command that lists what the audit skips; `## [Unreleased]` is gone. `.context-budget.json` drops its `CHANGELOG.md` entry (the operator's decision; the rules say no session reads the file whole), corrects two comments the sync made false (65,536 B is no longer the trimmer's budget — trim v1.5.0 archives above 196,608 B), and lists `quality_ratchet.py` among the synced files it checks for drift. `CLAUDE.md` :102 and :146, the lines the plan names, were read against the new rules and need no change.
- **Commit/PR:** the commit that ships this entry
- **Session:** S264 · **Verified:** `python3 -m json.tool` parses the config; `context_budget.py` no longer reports `CHANGELOG.md`, reads `CLAUDE.md` 17,989 B `ok` (ceiling 28,000) and `quality_ratchet.py` `synced ok`; the new command lists 11 skipped headings (5 `[BACKLOG: …]`, 6 untagged), identically in zsh and bash.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] BL-57 P8 — `HANDOFFS.md` gains the current seed's `## Size, and when to archive` section above the trimmer's pointer block; every receipt untouched
- **Change:** the seed's section (`starter-kit/HANDOFFS.md:89`–`148` at fork `0ab3881`, carrying `handoffs-format: 2`) is inserted as new lines 29–88, plus one blank line, directly above the pointer block — plan item (21) and `BOOTSTRAP.md:387`–`388`, the *add, don't replace* route. The count sentence (:20–22), this project's fence-aware warning (:23–27), the pointer block and every receipt stay byte-identical. The insertion point was re-derived at the claim: the plan read it at `58f7bcbd` and it still held.
- **Commit/PR:** the commit that ships this entry; also records the plan's §9.8 check on the header commit `acb43e0b`
- **Session:** S264 · **Verified:** `cmp` — new :1–28 = old :1–28, :29–88 = seed :89–148, :89 blank, :90–end = old :29–end; `grep -c '^```handoff'` 17 → 17. §9.8 on `acb43e0b` (`CHANGELOG.md`, bounds 1 8): `only the block changed`; control bounds 1 7: `lines removed outside the block: [(6, 3)]`.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] BL-57 P8 — `CHANGELOG.md`'s Keep-a-Changelog header (old lines 1–8) replaced by the current seed's thin header; the shard pointer and every entry untouched
- **Change:** the header now points to [§The Action Ledger](docs/methodology/FRAMEWORK_APPARATUS.md#the-action-ledger) and carries `ledger-format: 2`. The block, re-derived by content at the claim, is old lines 1–8 — `# Changelog` through `## [Unreleased]`, the Keep-a-Changelog heading dropped as `airqino` dropped it: the ledger groups by month. The trimmer's archive-pointer block (old :10–12) and every entry are byte-identical.
- **Commit/PR:** the commit that ships this entry
- **Session:** S264 · **Verified:** `cmp` — new :1–12 equal the seed's :1–12, new :13–end equal old :9–end apart from this entry; the plan's §9.8 check on this commit is recorded in the next entry. `grep -c '^### '` 25 → 26 and the audit 250 → 251 (zsh and bash alike): this entry in, and the block held no `### ` line.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] BL-57 P8 — methodology synced from fork `main` `0ab3881`: one `bin/sync --source=local` run, one commit, 14 files
- **Change:** 11 synced files updated (`SESSION_RUNNER.md`, `FRAMEWORK_LEARNINGS.md`, `SAFEGUARDS.md`, `BOOTSTRAP.md`, `methodology_dashboard.py` v2.18.0, `methodology_trim.py` v1.5.0, `context_budget.py` v1.2.0, `docs/methodology/ITERATIVE_METHODOLOGY.md`, `HOW_TO_USE.md`, `workstreams/DEVELOPMENT_WORKSTREAM.md`, `workstreams/AUDIT_WORKSTREAM.md`) and 3 created (`quality_ratchet.py`, the seed `.quality-gates.json` with `gates: []`, `docs/methodology/FRAMEWORK_APPARATUS.md`, the ledger rules' new home). From here on, one ledger entry per commit. Past `SAFEGUARDS.md`'s five-file cap by the operator's plan item (18): exactly the files the dry run listed, plus this entry.
- **Commit/PR:** the commit that ships this entry
- **Session:** S264 · **Verified:** dry run exit 0, 14 files, and the real run wrote the same 14; `bin/status --source=local` reads every tracked file `current` (only the `CHANGELOG.md` and `HANDOFFS.md` seeds `present (stale format)`, migrated next); `check-package: OK — 42 files`.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] BL-57 P8, before the sync — the three root files the methodology sync adds are denied from the `.vsix`, so no commit on `master` fails `check-package`
- **Change:** `.vscodeignore` denies `quality_ratchet.py`, `.quality-gates.json` and `.quality-gates-results.json`; `.gitignore` ignores the last, as the seed manifest says to by default. Landed BEFORE the sync on purpose: item (18) keeps the sync commit to exactly the files `bin/sync` writes.
- **Commit/PR:** the commit that ships this entry
- **Session:** S264 · **Verified:** measured in scratch clones at `48d1790c` — pre-sync `check-package: OK — 42 files`; after the sync `FAIL` on `.quality-gates.json` and `quality_ratchet.py` (and on the results file after `quality_ratchet.py --run`); with these lines `OK — 42 files`, before and after the sync. `npm test` 2912/2912 both sides. Re-run on the real tree after the sync commit.
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [ad hoc] Session 264 claimed — BL-57 P8 of the upstream methodology plan (in progress)
- **Change:** `SESSION_NOTES.md` ACTIVE TASK stub and a `status: pending` S264 receipt in `HANDOFFS.md`; the Phase 0 telemetry appends rode along.
- **Commit/PR:** `48d1790c` — recorded here, one commit late: the claim followed this project's old one-entry-per-session practice, and the per-commit rule (the claim carries an *(in progress)* entry) arrives with this session's sync.
- **Session:** S264 · **Verified:** n/a — docs-only
- **Model:** Claude Opus 5 (claude-opus-5)

### 2026-09-18 · [BACKLOG: a ```` ```{{lang}} ```` display fence — quarto's documented verbatim-cell idiom — is refused as a fence] P1 of the attribute-tokenizer plan — fences read after quarto's backtick tag rewrite; 41 headings restored in 23 real documents, and the one deletion P1 itself introduced, modelled away

- **Operator-picked at Phase 0** (option 1 of 4, the recommended one). Claimed in `0a33f600`; the operator's
  §12 decisions recorded in `7e4ee16f` — **P1 only approved**, the runtime gate consented at Orient.
- **The fix, strict TDD, every RED shown for its stated reason** — C1 `39d3a6aa` (13 guards, green first);
  C2 `d27114bc`: `quartoFenceTagRewrite` (readqmd.lua:37-40, :95-100) on the PHYSICAL line before
  `fenceInfoOpensBlock`, Session 224's brace clause deleted — REDs `dd2`, `p5`, `l04`, `d0` and a linearity row
  (241 ms → <50 ms; the scan fuzzed against both transcribed patterns, 10.7M strings, 0 disagreements); C3
  `2a69d6c4`: refs' intercept deleted, `fenceAttributeId` scans the rewritten line — RED `lst-i06`.
- **Every plan DONE number reproduced**: census 23 docs +41/−6 headings, 8 +8 cells, 2 +2 labels, `threw=0`,
  exactly the README's 23 digests; the fence grid's 10 rows fixed, none broken; M0–M10 killed; oracle
  131/124/4/3; all 12 headings restored on the 9 unrendered pages confirmed by render, none removed.
- **Adversarial certification** (7 agents, 555 probes; every claim re-rendered and checked in code): 91 of 97
  "introduced" findings un-masked pre-existing errors, filed by root cause; 1 quarto-internal split (k03);
  **5 P1's own** — readqmd's line-0 `{}` PROPAGATION, which the plan left "not modelled": strictly worse than
  P1's parent (`c25` −5 headings; `e03`/`e04` a lost cell). **Operator decision mid-session** (`a2699040`):
  model it — C3b `51449f24`, RED `c01`, guards g1–g3, 18/18 docstart probes now match quarto, M11–M15 killed.
- **Runtime gate** C4 `7c84e94a`: operator yes before launch; `test:integration` 547 passing (545 + 2).
- **Records** `1c768656` (the un-masked item, deferred item (f), the plan's P1 DONE banner, learnings
  #538–#542); notes trim `5fb65912`; this close-out removes the `{{lang}}` BACKLOG item.
- **Found on the way:** the plan's census timing control shares one module load, reading P1 at 1.39× with no
  real slowdown (two copies read 1.00×, Learning #538).

### 2026-09-14 · [BACKLOG: The attribute spec is matched with regexes and never TOKENIZED as pandoc tokenizes it] The attribute-tokenizer plan — four phases, the real-reach regression beside them, and the census that proves them

- **Operator-picked at Phase 0** (option 1 of 4, the recommended one): plan one tokenizer rather than
  patch either HIGH item. Claimed 2026-09-11 in `7a2397e2`. **PLAN ONLY — no file under `src/` or
  `test/` changed.**
- **The plan (`452ce271`)** — `docs/planning/2026-09-14-attribute-tokenizer-plan.md`: one import-free
  leaf, `src/core/qmd/attribute-block.ts`, built from measurement. P1 quarto's backtick fence-tag rewrite
  (the recommended stop; no tokenizer; 23 documents, +41 headings, −6 phantoms, +8 cells, +2 labels);
  P2 the leaf and accepted `:::` openers; P3 single-line refusals through the div stack (correcting, by
  measurement, the claim note's "not the `divColumns` push"); P4 (optional) the fence info rule. Every
  div/heading item it closes measures **0 of 3,383** documents; its ground truth is quarto's READER VIEW,
  not raw pandoc.
- **The census tool rides with the plan** (operator decision, mid-session, option 1 of 3): three files
  under `docs/planning/scripts/attribute-block/` — a three-view two-build census that fails on any throw;
  controls re-run from the committed copy (identity 0/0/0; pre-S257 108/+0/−289; P1 prototype 23/+41/−6,
  cells 8, labels 2), and P1's expected changed set as path digests, no paths.
- **Found, measured and filed: a Session 224 regression** — a ```` ```{{python}} ```` display fence is
  refused as a fence and swallows headings in 23 real documents (`95241beb`'s parent reports both
  headings of the witness, `95241beb` one). The new head of "Up Next"; the plan's P1.
- **Records (`61bcce86`):** that item; one consolidated *"Deferred by the attribute-tokenizer plan"*
  item; reach-0 annotations on the three items the plan schedules; five appends. `BACKLOG.md` 302,927 →
  313,343 B (+10,416), `check-backlog` OK, 206 open. Learnings #531–#537 (`PROJECT_LEARNINGS.md`
  +6,855 B).
- **Notes trim (`4b69957b`):** the oldest SESSION_NOTES pair (S257 eval + S258 self-assessment), deletion
  only.
- **How it was made:** four workflows — research (15 agents), a design panel (8), a plan review (11: 46
  findings + 4 critic gaps, 1 blocker) and a second review of the revision (6: 15 findings, 0 blockers)
  — about 10.9M subagent tokens; every load-bearing claim re-measured by the main session (plan §11.2).
  P3's blank-line rule was dropped after review (two measured deletion hazards, zero reach).
- **Gates:** `npm run compile` clean; `npm test` 2,875 passing / 66 files. No runtime behaviour changed,
  so no runtime gate (stated in the receipt, not skipped).
- **Model:** Claude Opus 5.

### 2026-09-11 · [BACKLOG: SHIPPED CODE DELETES A RENDERED HEADING: six of the nine readers have no `fenced_divs`, and the CALLOUT rule fires there anyway] The callout reader gate — 36 rendered losses fixed, no heading removed anywhere, and everything it un-masks filed

- **Operator-picked at Phase 0** (option 1 of 4, the recommended one); claimed 2026-09-10 in
  `468b310a`.
- **The fix (`ec1e1cfa`), strict TDD.** `calloutTitleTakes` now reads `fencedDivsDialect`, the flag
  the tabset rule has read since Session 258. RED first: R1 failed with `[Before, After]` where
  quarto renders `[Before, Inside, After]`, under every one of the six readers with no fenced divs.
  One condition of logic; the rest is tests, comments and records.
- **Measured before and after through quarto 1.7.33, against a baseline worktree at the parent
  commit:** 71 documents (`scratchpad/s261/rdr`, `tight`, `ext`, and the filed witness
  `s258/fix/d2`) — 36 LOST → AGREE across the ATX, setext, bare-word and glued spellings and the
  extension and quoted forms of the reader; 1 AGREE → PHANTOM, the disclosed push case. A two-build
  census over the 3,383 authored documents changed 0 of 28,103 headings: only 6 declare any
  `from:`, all of them readers WITH fenced divs, so the fix's reach in this corpus is zero.
- **Guards (`8b5884f5`, widened in `0f5ddff7`):** R2–R7, each tied to a render. A six-mutant harness
  (`scratchpad/s261/mutate.py`, a no-op control among them) kills every row, and every mutant is
  killed by at least one row. Plus the runtime row in `test/integration/suite/outline.test.ts`.
- ⚠ **A 157-agent adversarial certification — six lenses, 331 probes, 150 refuter verdicts, a
  completeness critic — and then every probe and twin re-rendered by the main session (1,419).** It
  reported 75 findings as introduced. All 75 reproduce, and none is new wrong logic: each is a shape
  whose PLAIN-DIV twin is wrong the same way in both builds — the title rule used to swallow the
  heading and so masked the error — or a front-matter resolver misread. The gate removed no heading
  anywhere. The comment that said the push "shows through in ONE measured place" was wrong and is
  corrected (`0f5ddff7`), with R6 widened to `+blank_before_header` and R7 pinning the duplicate-
  anchor misread in both directions.
- **Filed, not fixed.** The push-under-reader defect is carried into the existing "`divColumns` is
  pushed for `:::` lines that are not divs at all" item, which the completed item named as the wider
  defect. Three new items: the reader resolver's misreads (a dozen shapes, both directions); six
  pre-existing heading losses found beside the callout rule; five pre-existing phantom and text
  families. The completed item is removed from the head of "Up Next".
- **Runtime gate — satisfied, operator-authorised before it took the screen, and run last.**
  `npm run test:integration` launched a real VS Code Extension Development Host: **545 passing,
  exit 0** — Session 260's 544 plus this session's outline row, which drives
  `vscode.executeDocumentSymbolProvider` on a `from: gfm` callout and its default-reader twin. It ran
  only after every render and the mutation harness had finished, behind guards that refused to
  start it with a dirty `model.ts` or a live render; the one later edit to `model.ts` is a
  comment's count.
- **Records:** learnings #525–#530; the oldest `SESSION_NOTES.md` pair dropped in its own
  deletion-only commit (`c96e6a81`).
- **Commits:** `468b310a` claim · `ec1e1cfa` fix · `8b5884f5` guards · `0f5ddff7` corrected comment +
  pins · `c96e6a81` notes trim · `6e1b0601` records (the filings, learnings #525–#530, one
  comment's count) · the close-out commit carrying both ledgers.

### 2026-09-10 · [ad hoc] Session 260 — finish the close-out Session 259 abandoned: runtime gate closed, the fix certified, a regression found, and five root-cause items filed

- **Operator-picked at Phase 0** (option 1 of 4) after this session's reconcile found Session 259
  dead before Phase 3. The ledger half was repaired at Phase 0 — see the backfill entry below,
  written by this session in `7739ddd2`. This entry records everything else a close-out owed.
- **Runtime gate — satisfied, not waived, operator-authorised first.** `npm run test:integration`
  launched a real VS Code Extension Development Host against Session 259's shipped `findHeadings`:
  **544 passing, exit 0**, including the Session 257 and 258 outline rows that drive
  `vscode.executeDocumentSymbolProvider`. No code changed this session, so it ran against exactly
  what Session 259 shipped.
- **Session 259's fix is certified against its original witnesses, firsthand.** Session 258's
  rendered witnesses `d3`/`d4` now AGREE with quarto, and a baseline worktree at `efd5f478` rebuilt
  this session reproduces the deletions they were filed for.
- ⚠ **A seven-lens adversarial certification pass found that Session 259 introduced a deletion
  regression of its own.** 66 findings, every one rendered through quarto 1.7.33 and re-run by a
  refuter, and then every one re-rendered by this session: all 66 reproduce, 65 with exactly the
  claimed direction and origin, and the one mislabel is a finder's "phantom" that is really a
  deletion. 39 deletions (7 introduced, 32 pre-existing) and 27 phantoms (16 introduced, 11
  pre-existing). Seven are deletions the BASELINE did not make, and six share one root cause:
  `maskQuotedValues` pairs quotes blindly, so an escaped quote or a literal apostrophe in an
  unquoted value blanks a real `title=`, and the title lookup Session 259 moved onto the mask
  finds nothing. The seventh is an opener pandoc refuses outright, which the same change
  exposed. Session 259 bought a phantom fix with a deletion.
- **Filed, not fixed, by root cause — five items for 66 findings**, at the head of `BACKLOG.md`
  "Up Next" under the existing reader-gate item: the tabset reads that never got Session 259's
  fixes (the three residuals its commits said were filed and were not, plus an asymmetry Session
  259 created at `model.ts:4181` vs `:4245`); the `maskQuotedValues` regression; `.content-visible`
  winning quarto's class dispatch (read firsthand at `main.lua:1147-1155`); the callout first-block
  test ignoring containers; and the attribute spec never being tokenized as pandoc tokenizes it.
- **Removed the item Session 259 solved** from the head of "Up Next", where every future Phase 0
  would otherwise have ranked a fixed defect first.
- **Five learnings, #520–#524**, none of which existed: a commit saying "filed" is not a filing;
  a guard's stated reason no probe separates is an assertion (Session 259's own best move);
  routing a read through a normaliser inherits the normaliser's errors; a dead session loses its
  verification, not only its paperwork; a harness hard-coding a session temp path dies with it.
- **Gates.** `npm run compile` clean; `npm test` 2868 passing / 66 files; `check-backlog` OK;
  `check-package` OK, 42 files / 5.60 MB, roots unchanged.
- **Commits (5).** `7739ddd2` the Phase 0 reconcile · `e2825dcc` claim · `08ceabd4` the records
  (five backlog items and learnings #520–#524; its title says "six root causes" because the tabset
  item carries two — the inherited holes and Session 259's own `:4181`/`:4245` asymmetry) ·
  `8e6546a6` the SESSION_NOTES trim, deletion-only as CLAUDE.md requires · and the close-out
  commit, which carries this line AND both ledgers, so both frontiers land at `HEAD` together.
- **Non-commit actions.** Ran `npm run test:integration` on the operator's screen, authorised
  first; ran a 73-agent certification workflow; removed this session's baseline worktree and
  pruned Session 259's dead one (`git worktree prune`), whose directory no longer existed.
- **Context budget.** All four over-ceiling files grew and none was reduced. `HANDOFFS.md` has now
  been over its ceiling at eight consecutive close-outs.
- **A correction to this session's own records commit.** `08ceabd4` cited the class-terminator
  lens's probes under a directory named "classterm", which never existed — they are in
  `scratchpad/s260/boundary/`. Caught by checking every cited path before close-out; fixed in the
  close-out commit.
- **Model:** Claude Opus 5.

## 2026-08

### 2026-08-27 · [ad hoc] Backfilled (reconcile-on-read): undocumented commits `9d0aecd4`..`f6c8ee3e` — Session 259 shipped the callout attribute-value fix and then ended without any close-out

- ⚠ **This entry is a Phase 0 reconcile written on 2026-09-09, not a close-out.** Session 259
  claimed the task, authored five commits, and left **no** `CHANGELOG.md` entry, **no** completed
  `HANDOFFS.md` receipt (its 1B stub is still `status: pending`), no `SESSION_NOTES.md` close-out
  pair, no `PROJECT_LEARNINGS.md` rows, and did not remove the completed item from `BACKLOG.md`.
  The commits are summarised from their own messages and from the artifacts in
  `scratchpad/s259/`; nothing here is a claim this session verified beyond the gates named below.
- **What the commits did — `BACKLOG.md` "Up Next" head item, the HIGH heading-DELETING defect
  filed by Session 258 against Session 257's shipped `divCalloutTitleSlot`.** The predicate tested
  its two class patterns against the WHOLE attribute spec, so any `.callout…` substring anywhere in
  that spec read as a class and deleted the heading below it.
- **The filed item called the fix "one token"; the commit message reports it is three** — a leading
  token boundary `(?:^|[\s{])`, a trailing terminator `(?=[\s}]|#[\w:.-])` (a `.` is an identifier
  character to pandoc, so `{.callout-note.foo}` is ONE class literally named `callout-note.foo`),
  and `maskQuotedValues()`, because a quoted value may hold a token that is whitespace-delimited on
  both sides (`data-x="a .callout-note b"`) that no boundary test can distinguish from a class.
- **A fourth commit reversed a guard's stated reason after mutation refuted it.** Mutant M8 swapped
  the mask's filler for a space and flipped nothing; the probe built to separate the claim showed a
  closing quote OPENS the next token rather than ending one (`::: {.note x="q".callout-note}` is a
  real callout, rendered), so masking the quotes away had introduced a phantom two commits earlier.
  The boundary is asymmetric: a quote may PRECEDE a class, it may not TERMINATE one.
- **Evidence recorded in the commits.** A 43-probe grid rendered through quarto 1.7.33
  (`scratchpad/s259/probes`), both builds run side by side from a worktree at the parent commit:
  baseline **25 divergent (24 deletions + 1 phantom) → 3**. The 3 that remain are Session 258's
  shipped `divPanelTabset` carrying the same two holes (h1/h3/k1) — **and, contrary to the commit
  messages' "filed, not fixed", no `BACKLOG.md` item for them exists; the filing never happened.**
  Strict TDD is claimed per commit with the RED rows named (R1–R10, R3/R5/R7/R9 as controls).
- **Gates re-run at this reconcile, 2026-09-09, on the tree as committed:** `npm run compile`
  clean, `npm test` **2868 passing / 66 files**, `node check-backlog.js` OK (198 open). No runtime
  smoke test (Phase 3E) is recorded by Session 259 and none was run here.
- **Commits (5).** `9d0aecd4` claim · `23231f40` the token boundary, the terminator and the value
  mask (R1–R5) · `bd1382db` the `title=`-inside-a-value read (R6–R7) · `0a6b72a0` the closing-quote
  asymmetry, found by mutation (R8–R10) · `f6c8ee3e` the comment correction, no behaviour change.
- **Model:** Claude Opus 5 (Session 259); reconciled by Claude Opus 5 (Session 260).

### 2026-08-26 · [BACKLOG: EVERY heading inside a `::: {.panel-tabset}` is a TAB LABEL] The panel-tabset tab-label divergence — 21 authored documents fixed, 0 regressions

- **Shipped the rule.** Every heading at a `.panel-tabset` div's TAB LEVEL is a tab label, not a
  heading: quarto's filter puts its inlines in an `<a role="tab">` nav link and emits no `<hN>`.
  `findHeadings` reported all of them, so the Outline offered sections the reader never sees.
- **The rule is quarto's own code, not an inference.** `parse_tabset_contents`
  (`/Applications/quarto/share/filters/main.lua:21643`) takes the FIRST `Header` among the div's
  DIRECT blocks, freezes its level, and makes a tab of every direct-child `Header` at EXACTLY that
  level. Three consequences the filed item did not state, each rendered before any code was written:
  the tab level is the FIRST heading's level and **not** the shallowest (`### First` / `## Second`
  renders `h2:Second`); the test is EQUALITY and not `level <= tabLevel` (a `#` between two `##`
  tabs renders as a real `h1`); and tab-hood is a CONTAINER test, so a heading inside a nested div,
  list item or quote is real at the very level its siblings were consumed at.
- **Measured over Session 251's 3,383-document authored corpus**, baseline regenerated from the
  parent commit in a throwaway worktree: structural divergence **80 → 59 documents**, agreement
  **96.72% → 97.58%**, **21 fixed / 0 regressed**; at heading granularity **151 removed, 0 added,
  and 0 of the removals are headings quarto renders**, with 0 newly-introduced losses across all
  2,438 scored documents.
- ⚠ **My own adversarial pass found ELEVEN category-A defects in code that had already passed a
  90-document rendered grid, 2,844 unit tests and the corpus score.** The shape: S257's callout rule
  claims ONE line, so every pre-existing "the div stack is wrong here" defect cost at most one
  heading — a tabset claims EVERY heading at its tab level for as long as the entry lives, which
  turns each of them into an unbounded deletion. Four fixes, each driven RED first: a div opened
  inside a QUOTE now dies with the quote (it was deleting headings in *later* quotes, three in one
  witness); a div naming BOTH a callout and a tabset is resolved by CLASS ORDER; the tab level is
  learned only from the div's FIRST CONTENT LINE (the fail-safe against a phantom heading, or a real
  `Header` this model cannot see, setting the wrong level); and the six readers without
  `fenced_divs` have no div to suppress.
- **Closed two long-standing pinned residuals as a side effect**, re-rendered to confirm: Session
  229 R5 and Session 233 R1 — a div opened inside a quote and "closed" outside it. Both assertions
  are reversed in place.
- **Evidence.** A 117-document rendered grid (103 agree, **0 lost**, 12 disclosed phantoms, 2 quarto
  errors) and TWELVE mutants that each redden the shipped rows — `scratchpad/s258/mutate.py`,
  `mutate_tests.py`. Runtime gate satisfied: `npm run test:integration` **544 passing, exit 0**,
  including a new `outline.test.ts` row driving `vscode.executeDocumentSymbolProvider`.
- **Commits (6).** `5da87bc5` claim · `80fce2da` the rule, 27 unit rows and the runtime row ·
  `e12cb34b` the four post-adversarial fixes · `d519f434` the records · `3c1f2dda` close-out ·
  plus the both-ledgers commit and a final telemetry append (`.context-budget-history.jsonl`,
  `dashboard_history.jsonl`), folded into the same commit as this line so BOTH frontiers stay at
  `HEAD`. ⚠ **A LEDGER CANNOT RECORD THE COMMIT
  THAT FOLLOWS IT**, so whichever of `CHANGELOG.md` / `HANDOFFS.md` moves last is the only one
  with a zero frontier — touch BOTH in the final commit or the next Phase 0 reconcile chases a
  phantom gap (inherited from Session 257, and it held).
- **Model:** Claude Opus 5.

### 2026-08-26 · [ad hoc] File four items and annotate two, from Session 258's measurements

- **Two are HIGH and both are heading-DELETING defects in code that already ships** (Session 257's
  callout rule), each rendered firsthand and neither fixed here, to hold 1-and-done:
  `divCalloutTitleSlot` matches its class name inside an attribute VALUE
  (`::: {.note data-x=".callout-note"}` deletes a real heading; the `title=` spelling is masked,
  which is why it survived review), and the callout rule fires under the six readers that have no
  `fenced_divs`. Session 258 fixed its own half of the second one and left the flag ready to read.
- Also filed: the tabset PREAMBLE residual (a decision, with the 0-of-68 measurement behind it), and
  the `divColumns` pushes for `:::` lines that are not divs.
- Annotated the raw-HTML div item to cover BOTH rules rather than being filed twice, and the
  format-gated `.content-hidden` item with the measurement that a tabset's labels ARE real headings
  under `--to latex` and `--to gfm` — a second member of that same undecided question, already
  shipped.
- **Model:** Claude Opus 5.


### 2026-08-26 · [ad hoc] Relocate Session 257's 28 ground-truth witnesses to the path they are cited at

- ⚠ **The 23 distinct `scratchpad/s257/probes/p<N>` citations written into `src/`, the tests and all
  three record files pointed at files that did not exist** — the probes had been rendered in `/tmp`,
  which would have erased them before the next session read a word. Found by executing Phase 3F's
  *verify cross-references added this session* bullet literally, **after** the close-out commit.
  `git diff` cannot surface this: it shows the citation added, never the destination not created
  (Learning #7's shape; recorded as #514).
- All 28 `.qmd` sources plus their rendered `.html` now sit at the cited path with a `README.md`
  table naming what each one pins. Every cited name verified to resolve. The witnesses are
  untracked, matching this project's long-standing convention for `scratchpad/` evidence.

### 2026-08-26 · [BACKLOG: A heading inside a CALLOUT is consumed as the callout's title] The callout title slot — 44 authored documents fixed, 0 regressions

- **The defect.** Quarto's callout filter lifts a callout div's FIRST BLOCK, when it is a header,
  into the title bar: it emits no `<hN>`, no `<section>` and no `sec-` anchor for it. An `@sec-`
  reference to such a heading renders as quarto's unresolved `<strong>?@sec-hotel</strong>`.
  `findHeadings` reported the heading anyway, putting a section in the Outline the reader never
  sees — and offering a cross-reference target quarto cannot resolve. Filed by Session 205, ranked
  #1 by real-document reach by the Session 251 audit, unfixed for 52 sessions.
- **The measured result, over Session 251's 3,383-document authored corpus.** Structural
  divergence **124 → 80 documents**; structural agreement **94.91% → 96.72%**. **44 documents
  fixed, 0 regressed.** At heading granularity: **138 headings removed, 0 added, and 0 of the
  removals are headings quarto actually renders** — no deletion in the forbidden direction. 29 of
  the 138 sit in 20 documents quarto itself refuses to render (exit ≠ 0), so they are unscorable
  and disclosed rather than counted. Baseline regenerated from the parent commit in a throwaway
  worktree rather than read from S251's stored census, which was several model changes stale.
- **The rule is narrow, and every boundary was rendered before it was coded.** It fires only when
  the heading is the callout's own first block: a paragraph, code block, thematic break, HTML
  comment or nested div above it all defeat the lift, and only the FIRST heading is taken — a
  second one in the same callout is a real heading. It keys on a closed set of types
  (`note`/`tip`/`warning`/`caution`/`important`) plus **bare `.callout`**, which renders
  `callout-none` chrome and lifts a title exactly as the named five do — the one member Quarto's
  own documentation would not predict. `.callout-bogus` and `.note` are not callouts at all.
  ⚠ **A NON-EMPTY `title=` takes the slot and the heading then SURVIVES**, but `title=""` and
  `title=''` do not, and `title="   "` does — the gate is an empty quoted value, not the presence
  of the attribute. That last one was found by an adversarial verifier attacking the first cut of
  the predicate, and re-measured firsthand before it was believed.
- **Disclosed residual, declined on a measurement.** The filed item names two spellings and this
  closes one. The RAW-HTML form (`<div class="callout-note">`) really does render a callout and is
  still a phantom — but **244 of the 3,383 authored documents carry a fenced callout div and ZERO
  carry a raw-HTML one**, and closing it needs a `<div>`/`</div>` container the scanner does not
  have. Re-filed in `BACKLOG.md` with that measurement and pinned live as guard G12, so the
  phantom is asserted rather than forgotten.
- Also closes **two disclosed-residual pins** that Sessions 193 and 215 each filed against this
  exact phantom, and files two new items: the format-gated `.content-hidden` / `.content-visible`
  divs (NEW, unfiled — quarto deletes the whole block, but the answer is target-format-dependent,
  so the decision is the hard part) and the negative result recording the twelve div classes
  measured NOT to consume a heading, `.tabset` among them.
- Strict TDD: R1–R4 each shown RED before GREEN, R4 twice. 19 new assertions plus a drift gate
  asserting `model.ts`'s `CALLOUT_TYPES` equals `notebook-callout.ts`'s `CALLOUT_TITLES` key set.
  `npm test` 2817 / 66 files; `compile` clean; `check-package` OK 42 files / 5.60 MB;
  `check-backlog` OK 195 open.
- **The runtime gate was SATISFIED, not waived** — operator-authorised, since it takes over the
  screen. `npm run test:integration` launched a real VS Code Extension Development Host:
  **543 passing, exit 0**, including a new `outline.test.ts` row that drives
  `vscode.executeDocumentSymbolProvider` — the command the Outline view itself calls — and
  asserts the lifted heading is absent, a SECOND heading in the same callout is present, the
  headings outside it are present, and the same document with a non-callout class keeps its
  heading. Commits (7): `e7dd276e` claim, `a80a6de8` the rule, `ae9e8d94` the empty-title
  correction plus guards and gate, `c89b9608` the runtime test, `27485730` the records
  (BACKLOG/learnings), `2e6cab8c` close-out, `45e1e515` the commit list, and this both-ledgers commit.

### 2026-08-26 · [ad hoc] `SESSION_NOTES.md` is TRANSIENT, not append-only — retention rule added to `CLAUDE.md`

- A reduction with no rule attached regrows; this file had already been drained twice under an
  instruction to *"keep it clean"*. `CLAUDE.md` now carries the rule: **at Phase 3D, after writing
  your own close-out pair, delete the oldest so the live file holds at most three.** Three is the
  steady state, not a target — you write one and drop one, so the count never moves (~240 of the
  400-line ceiling).
- ⚠ **The root cause is a contradiction in canonical's own seed**, not local sloppiness.
  `../methodology/starter-kit/SESSION_NOTES.md` says at line 5 *"This file is transient — it is
  overwritten every session"* and at line 27 *"Session history accumulates below this line."* Those
  cannot both be followed. This project followed line 27 for **256 sessions**. Canonical's own repo,
  110 sessions of dogfooding, has **no `SESSION_NOTES.md` at all**, and its manifest
  (`bin/_manifest.py:120`) states the file *"is rewritten wholesale every session"*.
- Learnings `PROJECT_LEARNINGS.md` #506–#508 recorded. Session 256 close-out; predecessor scored
  7/10, self-score 8/10. Five commits: `3e1cf42f` claim, `b06ac6b2` trim (deliberately pure),
  `75bddb56` packaging guard, `b688d8b3` close-out, and this ledger commit.

### 2026-08-26 · [ad hoc] Deny `__pycache__/` in the packaging and git ignore lists

- ⚠ **The 5th instance of the new-root-file class** (Sessions 173, 174, 188, 255): `check-package`
  went RED at 43 files. Establishing *why* `methodology_trim.py` refuses `SESSION_NOTES.md` meant
  importing it as a module rather than shelling out, which drops a `__pycache__/` at the repo root.
  `vsce ls` obeys `.vscodeignore`, not `.gitignore`, so it was packaged.
- Denied in **both** ignore files rather than merely deleted — the three methodology tools at the
  root are Python, so the next session that imports one recreates it. Back to OK: 42 files,
  5.59 MB, roots unchanged.

### 2026-08-26 · [ad hoc] Reduce `SESSION_NOTES.md` → `docs/archive/SESSION_NOTES-through-S253.md` (738 record(s), 3,949,501 B → 13,454 B)

- The file Phase 0 step 2 **orders every session to read** stood at 3,949,501 B / 13,942 lines
  against a 120,000 B / 400-line ceiling — 33x over, and larger than both ledgers combined before
  the Session 254 trim. Now **13,454 B / 172 lines**, a 99.66% reduction. Retained: front matter,
  `## ACTIVE TASK`, and the two most recent close-out pairs (Session 255's and Session 254's).
- ⚠ **`methodology_trim.py` could not do this, and that is a property of the tool, not an omission.**
  `--file SESSION_NOTES.md --check` exits 3 with `NO_CONFIG`: its `LEDGERS` table
  (`methodology_trim.py:186`) holds exactly two entries and it reads **no config of any kind** —
  no env var, no config file, no plugin hook (searched exhaustively). Nor could a `LedgerSpec` be
  written for it: `date_of_record` is REQUIRED and `evaluate()` freezes the oldest **by date**,
  while **458 of the file's 740 records carry no date at all** and only 88 of 740 headings carry
  one. Its reduction axis is the **session number**. And the tool is canonical-owned (TRACKED in
  `bin/_manifest.py:50`), so the table cannot be edited locally anyway.
- **This is upstream BL-32, already open and undecided** (raised 2026-08-11) — *not* filed as new.
  Canonical met the identical wall on its own `BACKLOG.md` and answered it the same way: reduce by
  hand, prove it with an **identity-keyed** check. This shard is a second data point under BL-32.
- **Losslessness proved by a hand-written, self-locating check** —
  `docs/archive/SESSION_NOTES-through-S253.md.verify.sh`, C0–C6, modelled on canonical's
  `BACKLOG-archive-2026-08-15.md.verify.sh`. It is keyed on each record's own heading identity,
  never on position, so it cannot fail the way four of six upstream proofs do (BL-36). Records are
  byte-identical — deliberately **not** link-rebased, so C2/C3 are true byte identity rather than
  identity-modulo-a-transform; stated cost is that relative links inside archived records resolve
  against the repo root.
- **Written test-first.** The proof was authored before the split existed and driven RED through six
  injected defect classes (dropped record, edited record, duplicated record, swapped halves,
  false count, tampered front matter). That RED pass found **three real defects in this session's
  own tooling** — an off-by-one trailing newline that gave the last archived record a byte the
  original never had, a proof that crashed instead of reporting FAIL, and a corruption mode that
  never reached the check it targeted. All three fixed, then GREEN: C0–C6 pass, 743 records =
  5 retained + 738 archived, byte accounting exact.

### 2026-08-26 · [ad hoc] Session 255 — this project was not a current adopter; sync, install, gate, and file upstream

- **Session span:** 2026-08-26 (commits `3aea788e`..close-out). **Model:** Claude Opus 5. **Methodology adoption.** Operator directive: *"do it all in one session"*, plus the question *"should we place a backlog item in `../methodology` … or are the corrections already there?"*
- **Origin.** S254's close-out asked whether corrective actions existed. Comparing this repo against `../methodology/bin/_manifest.py` (26 rows) showed **we were not a current adopter**: **2 files missing** (`context_budget.py` TRACKED, `.context-budget.json` SEED) and **6 TRACKED files drifted** (`SESSION_RUNNER.md`, `FRAMEWORK_LEARNINGS.md`, `RECOMMENDED_SKILLS.md`, `BOOTSTRAP.md`, `methodology_dashboard.py`, `methodology_trim.py`). The 4 differing SEED files are *supposed* to diverge; 14 rows were byte-identical.
- ⚠ **LEARNING #499 WAS ALREADY SOLVED UPSTREAM AND I WAS ABOUT TO REBUILD IT.** `context_budget.py`'s own docstring: *"MEASUREMENT ALONE WAS ALREADY PRESENT AND DID NOT WORK … So this tool GATES … rather than a second thing to print."* Canonical's config governs both ledgers at **`max_bytes: 65536`** — the same constant `methodology_trim.py` uses. Upstream the two tools are a **pair**; we had one. (Learning #503.)
- ⚠ **THE DRIFT WAS INVISIBLE BY CONSTRUCTION.** An adopter may not edit these files, so zero local edits means `git status` is silent — six files stale and two never installed, with no signal anywhere. `bin/sync` needed **no `--force`**; it distinguishes *behind canonical* from *locally modified*, correcting what I had told the operator from the docs rather than from `--dry-run`. (Learning #504.)
- **`methodology_trim.py` v1.1.1 → v1.3.0**, which fixes **BL-27**. Both shard proofs regenerated and **both now PASS** — including `HANDOFFS-through-2026-08-24.md.verify.sh`, the one known-bad artifact S254 shipped deliberately. **That is a third independent confirmation the S254 trim was lossless, from the very artifact that had claimed otherwise.** BL-41 turned out to change only *collision* handling (`-2`, `-3`, …) and renames nothing existing — correcting my own earlier characterisation of that sync as risky.
- **`SESSION_RUNNER.md` changed mid-session and was diffed before continuing under it.** It adds **failure mode #28, "Unbounded mandatory read"** — the general form of what S254 fixed by hand — and a degradation row that is Learning #499 as protocol: *"The signal is not missing — nothing gates on it. Do not add a second report. Add a gate."*
- ⚠ **THE NEW GATE IMMEDIATELY FOUND SOMETHING BIGGER THAN THE S254 TRIM.** `SESSION_NOTES.md` is **3,946,063 B / 13,912 lines** against a 120,000 B ceiling — **larger than both ledgers combined before the trim** — and it is the file Phase 0 step 2 *orders* every session to read. Sessions 254 and 255 each read ~160 lines and inferred the rest: **failure mode #28, committed twice by the sessions that documented it.** Also over: `PROJECT_LEARNINGS.md` 950,857 B and `BACKLOG.md` 284,130 B. **Ceilings deliberately not raised** — raising one to silence a warning records the problem as the standard.
- **Configured, not left as the generic seed:** `LEARNINGS.md` → `PROJECT_LEARNINGS.md`; `CHANGELOG.md`/`HANDOFFS.md`/`BACKLOG.md` added as read-mandated at 65,536; `synced` expanded 2 → 10 entries so the drift above can never again be invisible; `protected_min_bytes` 800 → **700**, derived from this project's 732 B purpose statement rather than inherited, and that statement fenced in `CLAUDE.md`.
- **`check-package` FAILED exactly as predicted at claim** — `context_budget.py` and `.context-budget.json` are new root files and `.vscodeignore` is a **denylist**. Fourth instance of the S173/S174/S188 class. Three denylist lines added; back to **OK, 42 files / 5.59 MB**, roots unchanged.
- **UPSTREAM (`../methodology`, commit `1674b2a`) — the answer to the operator's question was BOTH.** Already fixed there and flowing on a push: **BL-27**, **BL-41**. ⚠ **And one finding was already filed as BL-46**, raised 2026-08-25 from a cross-repo sweep that names this repo and quotes its exact error — I nearly duplicated it. **BL-46's half (1) is this project's work and S254 completed it**, annotated in place. ⚠ **Its proposed remedy is too narrow and only we could show it:** BL-46 says the adopter *"never deleted"* the sentinel; we **had** — the trimmer refused because of the **trailing `---` and comment**, which the seed never mentions, so BL-46's sentinel-keyed detector **would not have fired here**. Three genuinely new items raised after checking each for duplicates: **BL-47** (seed budget config omits the two ledgers the trimmer bounds), **BL-48** (seed `HANDOFFS.md` lacks the count sentence its own `LedgerSpec` declares), **BL-49** (`content_probe` runs only at zero records, so a partial grammar mismatch freezes a wrong published span — the S254 shard labelled `2026-06-30` whose true oldest entry is `2026-06-27`). (Learning #505.)
- ⚠ **NOT DONE, deliberately:** **nothing was pushed.** `../methodology` is 398 commits ahead of `upstream/main`; `origin` is the fork, `upstream` is `KJ5HST/methodology`. A PR is outward-facing and needs the operator's explicit go-ahead. Also not done: reducing `SESSION_NOTES.md`, `PROJECT_LEARNINGS.md`, `BACKLOG.md` — now *gated* rather than invisible, and the named next deliverable.
- **Phase 3E: NOT APPLICABLE**, stated rather than skipped — synced documents, config, denylist lines. No `src/` change. Both new tools were RUN, which is the meaningful smoke test here.
- **Verification.** `npm run compile` clean · `npm test` **2796 passed / 66 files** · `check-package` **OK 42 / 5.59 MB** · `check-backlog` **OK 193 open items** · `methodology_trim.py --check` **does not fire** on either ledger · both regenerated `verify.sh` **OK** · upstream `BACKLOG-DETAIL.md.verify.sh` **OK, C1–C5 green**.
- **Backlog:** 193 → **193** (this was adoption maintenance, not a backlog item). Upstream: 23 → **26** open items.

### 2026-08-26 · [ad hoc] Ledger trim: `HANDOFFS.md` → `docs/archive/HANDOFFS-through-2026-08-24.md` (211 record(s), 1,801,150 B → 52,850 B)

**Written by:** `methodology_trim.py` v1.1.1 — a tool action, not a session's judgment.
Moved the oldest **211** record(s) (2026-07-09 → 2026-08-24) out of [`HANDOFFS.md`](HANDOFFS.md) into
[`docs/archive/HANDOFFS-through-2026-08-24.md`](docs/archive/HANDOFFS-through-2026-08-24.md). Losslessness is asserted by L1 (records-zone concatenation), L2 (zone
pinning) and L3 (record partition), and is **re-derivable** — run [`docs/archive/HANDOFFS-through-2026-08-24.md.verify.sh`](docs/archive/HANDOFFS-through-2026-08-24.md.verify.sh)
rather than trusting a digest printed here. Live file 1,801,150 B → 52,850 B (−97.1%).

### 2026-08-26 · [ad hoc] Ledger trim: `CHANGELOG.md` → `docs/archive/CHANGELOG-through-2026-08-24.md` (230 record(s), 831,830 B → 44,190 B)

**Written by:** `methodology_trim.py` v1.1.1 — a tool action, not a session's judgment.
Moved the oldest **230** record(s) (2026-06-30 → 2026-08-24) out of [`CHANGELOG.md`](CHANGELOG.md) into
[`docs/archive/CHANGELOG-through-2026-08-24.md`](docs/archive/CHANGELOG-through-2026-08-24.md). Losslessness is asserted by L1 (records-zone concatenation), L2 (zone
pinning) and L3 (record partition), and is **re-derivable** — run [`docs/archive/CHANGELOG-through-2026-08-24.md.verify.sh`](docs/archive/CHANGELOG-through-2026-08-24.md.verify.sh)
rather than trusting a digest printed here. Live file 831,830 B → 44,190 B (−94.7%).

### 2026-08-26 · [ad hoc] Session 254 — the trimmer was inert since bootstrap; both ledgers trimmed

- **Session span:** 2026-08-25 → 2026-08-26 (commits `fe4d029d`..close-out); dated by close-out, which crossed midnight.
- **Model:** Claude Opus 5. **Records maintenance.** Operator directive: *"lossless trim of `CHANGELOG.md` and `HANDOFFS.md`"*, with the diagnosis *"the trimmer has been inert since bootstrap — the seed-sentinel line was never deleted, so it refuses with `[ZONE_UNCLASSIFIED]`. 1.78 MB behind a one-line bootstrap miss, with the tool installed and reporting to nobody."*
- ⚠ **THIS ENTRY IS WRITTEN BEFORE THE TRIM, NOT AT CLOSE-OUT, AND THE TOOL IS WHY.** `methodology_trim.py` has a **P1 precondition** that refuses to trim while the undocumented set is non-empty: *"the undocumented set is non-empty (2 commit(s) since the ledger frontier `e8edafa`). A trim commit advances that frontier and would hide them PERMANENTLY. Reconcile first, then trim."* A trim moves the oldest records out of the live file, so the ledger frontier jumps — and any commit not yet recorded when that happens is not merely late, it is **unrecoverable by the Phase 0 reconcile**, whose whole method is `<frontier>..HEAD`. **Phase 3F's "record at close-out" and the trimmer's P1 are in direct tension, and P1 wins.** (Learning #498.)
- **The defect.** `HANDOFFS.md` ended with a standalone `---` and 113 B of orphaned seed comment — `<!-- Receipts go below, newest on top. Delete the seed-sentinel line above when you add the first one. -->` — sitting *below the oldest receipt*. The spec declares `footer_mode='none'` for this file and **asserts that declaration rather than assuming it**, so trailing content set apart by a separator is content the config cannot name, and the tool refused rather than sweeping it into a record that was about to move.
- ⚠ **IT HAS BEEN THERE SINCE THE FILE WAS BORN.** `git show 9f119c73:HANDOFFS.md` (2026-07-09, Session 38's methodology sync) already ends with that `---` + comment — **in the same commit that added the first receipt**, which is exactly the moment the comment instructs its own deletion. The `METHODOLOGY-SEED-SENTINEL` token itself is **already gone** from both ledgers, so the sentinel line *was* deleted and its separator and comment were not. A half-finished bootstrap, which is why it read as finished for 216 sessions.
- **Nothing was lost by deleting it.** Of the comment's two sentences, *"Delete the seed-sentinel line above"* is unsatisfiable (no sentinel exists) and *"Receipts go below, newest on top"* is already stated in the front matter — *"One `handoff` block per session (not per commit), newest on top."*
- ⚠ **THE TOOL WAS INSTALLED, FIRING, AND REPORTING TO NOBODY.** Session 188's sync recorded it verbatim as **"installed, not yet used"** and no session ran it in the 66 sessions since. Nothing in Phase 0 reads it, no test asserts it, and the dashboard does not surface it — so a refusal aimed at a one-line defect sat unread while both ledgers grew past their budget. **`CHANGELOG.md` 826,389 B (12.6×) and `HANDOFFS.md` 1,800,590 B (27×) against a 65,536 B budget**, both read at every Phase 0.
- ⚠ **A SECOND, UNRELATED DEFECT THE TRIMMER EXPOSED: TWO RECEIPTS WERE WRITTEN WITHOUT THEIR CLOSING FENCE.** S227 (line 418) and S226 (line 430), both 2026-08-19, each lack the bare ` ``` ` that terminates a `handoff` block. The record grammar is **fence-aware**, so the tool read **S227 + S226 + S225 as ONE merged record** — 216 record starts over a file holding **218** receipts. Swept the whole file: exactly these two, no others. Repaired by inserting the closer after each block's last field, matching the closer/blank/next-opener shape every well-formed receipt uses. **218 records now parse.**
- ⚠ **THE REPAIR HAD TO PRECEDE THE TRIM.** Both receipts date to 2026-08-19, inside the archive cut — trimming first would have **frozen the broken partition into an immutable shard** whose own record count was permanently wrong. Losslessness was never at risk (L1 asserts concatenation over the whole records zone, so a merged span moves intact); what was at risk was the **partition being true**. **NOT fixed, because it cannot be without fabricating content:** both receipts also lack `gotchas:` and `whats_next:`, which were never written.
- **A third bootstrap gap, same class as the first:** the config declares a regenerated front-matter field `retained receipt count` keyed to `(This file currently holds \*\*)(\d+)(\*\*)`; this file never had the sentence, so every run reported `FRONTMATTER_FIELD_ABSENT` — *"its value cannot be kept true. Add it, or remove it from the config."* Added the sentence to `HANDOFFS.md` rather than editing `methodology_trim.py`, which is **synced** and would block future syncs if edited locally.
- ⚠ **`grep -c '^```handoff' HANDOFFS.md` IS NOT A VALID RECOUNT — it reports 219.** It matches the worked example inside the 4-backtick documentation wrapper. My first draft of the count sentence shipped 219 for exactly this reason and was corrected to 218 before commit; the trap is now documented in the sentence itself, because the canonical repo's own count sentence drifted the same way (*"it read **3** from the S94 trim until this line was corrected"*).
- **THE TRIMS, both at a clean calendar seam (`--cut 2026-08-24`) rather than the tool's computed positional cut, which raised `CUT_STRADDLES_DAY` — the default would have named each shard `through-2026-08-25` while 2026-08-25 records stayed live, making the name a span label instead of a day boundary. The clean seam costs ~10 KB of live file and leaves both comfortably under budget.**
  - `CHANGELOG.md` **831,830 B → 44,190 B (−94.7%)**, 230 of 237 records to [`docs/archive/CHANGELOG-through-2026-08-24.md`](docs/archive/CHANGELOG-through-2026-08-24.md). `L1_OK` `L2_OK` `L3_OK` `P1A_OK` (ledger gained exactly one entry, 7 → 8).
  - `HANDOFFS.md` **1,801,150 B → 52,850 B (−97.1%)**, 211 of **218** receipts to [`docs/archive/HANDOFFS-through-2026-08-24.md`](docs/archive/HANDOFFS-through-2026-08-24.md). Retained S248–S254. `FRONTMATTER_FIELD_REGENERATED` count 218 → 7. **218, not 216 — the fence repair is what makes the partition true, and both repaired receipts are inside this shard.**
  - **Both triggers now DO NOT FIRE.** Combined **2,632,980 B → 97,040 B**, a 96.3% reduction in what every Phase 0 reads.
- ⚠ **ONE KNOWN-BAD ARTIFACT SHIPPED DELIBERATELY: `HANDOFFS-through-2026-08-24.md.verify.sh` REPORTS `FAIL`, AND THE FAILURE IS SPURIOUS.** *"L2 FRONT MATTER lost 1 line(s)"* — the regenerated count line. **Known upstream as BL-27 and already fixed in canonical v1.3.0**; this project runs **v1.1.1**, the pre-release UAT copy Session 188 installed. Root cause read in both versions: v1.1.1's `build_verify()` substitutes only `SHARD/LIVE/VER/INJECTED/KIND/START/INFO/FOOTER` and **never receives `spec.regenerated`**, while the in-process `assert_L2` *is* given the `reversals` list and replays it backwards — so the exported proof is strictly weaker than the check it claims to reproduce, and it fails in the direction that looks like corruption. It **cannot** fire on `CHANGELOG.md`, which declares zero regenerated fields — which is exactly why that shard's script passes and this one does not. Explained beside the artifact in [`docs/archive/README.md`](docs/archive/README.md). **Do not fix by editing `methodology_trim.py` — it is synced.** (Learning #501.)
- **LOSSLESSNESS ESTABLISHED THREE WAYS PER FILE, one sharing no code with the tool.** (1) the tool's in-process `L1`/`L2`/`L3`/`P1A`, asserted on the artifacts about to be written, not on the input partition; (2) `scratchpad/s254-verify.py` — an independent verifier with its own fence scanner, record splitter, code-span finder and link inverter — **8/8 PASS on both files**, including the **ORDERED record list compared byte-for-byte** against `git show <baseline>:<file>`; (3) the front-matter diff read by hand, confirming exactly the declared changes. The `CHANGELOG` shard's emitted `verify.sh` also **passes** (*"237 before = 7 retained + 230 archived"*).
- **The seam is proved ON THE ARTIFACTS, not from the absence of a warning** — retained and archived date sets do not intersect, the newest archived date equals each shard's name key, and the oldest retained date is strictly newer. (The canonical repo's own S107 receipt names *"a missing warning line is not evidence"* as the trap; applied deliberately here.)
- ⚠ **NOT DONE, and named rather than left implicit:** syncing `methodology_trim.py` to v1.3.0 and regenerating the failing script. v1.3.0 also changes shard naming (BL-41), so it is its own deliverable, not a drive-by. The two repaired receipts (S227, S226) remain **content-incomplete** — both lack `gotchas:` and `whats_next:`, which were never written and cannot be supplied without fabricating them.
- **ADVERSARIAL AUDIT: FOUR INDEPENDENT LENSES WERE TASKED WITH *REFUTING* LOSSLESSNESS, AND ALL FOUR FAILED TO.** Byte/line accounting, per-record identity+order, non-record scaffolding, and reconstruction from git history — each writing its own fence-aware extractor, importing nothing from `methodology_trim.py` or from my verifier. **No loss, no undeclared alteration, on either file.** The decisive shared result: concatenating each live records zone with its shard's reproduces the pre-trim records zone **byte-for-byte** (CHANGELOG 823,945 chars; HANDOFFS 1,791,612). 230/230 and 211/211 moved records byte-identical with **zero rebase insertions needed** — every eligible-looking link sat inside an inline code span or a fence, so the permitted mutation legitimately fired zero times. The full-history walk (286 revisions of `CHANGELOG.md`, 441 of `HANDOFFS.md`) located every sampled record. Byte arithmetic closed to **zero unexplained residual** on both trims.
- ⚠ **THE AUDIT FOUND TWO REAL SECONDARY DEFECTS THAT NO BYTE-LEVEL PROOF COULD SEE, BOTH NOW FIXED.**
  - **The CHANGELOG shard's published span is wrong at its old end.** Its `h1`, its own "Holds 230 record(s)" sentence and the live pointer block all say **2026-06-30 → 2026-08-24**; the content reaches back to **2026-06-27**. The record grammar is a date **plus a source tag** (`· [`), and the project's **six earliest entries predate that convention** — so they are not record starts, ride inside the oldest tagged record's span, and contribute to neither the count nor the computed span. **236 dated `###` headings, 230 counted records.** Nothing is missing; the *label* is wrong, and the label is the index people search. Corrected in [`docs/archive/README.md`](docs/archive/README.md), which is hand-owned; the shard header and pointer block are tool-generated and were left as written rather than hand-edited. (Learning #502.)
  - ⚠ **A WARNING I ADDED THIS SESSION WAS MADE FALSE BY MY OWN TRIM, TWO COMMITS LATER.** The `HANDOFFS.md` front-matter note said `grep -c '^```handoff'` *over-counts because it matches the worked example below* — but the trim moved that example into the shard, so the live file now has exactly 7 and the grep is **correct**. The sentence was actively telling readers to distrust a right answer. Rewritten to state the fence-aware rule, note that the grep agrees *today* and why, and keep the 219-vs-218 evidence. **A note about a file's contents can be invalidated by the very operation it was written to survive.**
- **Verification.** `npm run compile` clean · `npm test` **2796 passed / 66 files** · `check-package` **OK, 42 files / 5.59 MB** (roots unchanged) · `check-backlog` **OK, 193 open items** · `methodology_trim.py --check` **trigger does not fire** on either ledger (was: FIRES / refuses).
- **Phase 3E: NOT APPLICABLE**, stated rather than skipped — markdown records moved between files; no `src/` change, no runtime behaviour, nothing to launch. The gates above are the build equivalent.
- **Backlog:** 193 → **193** (0 closed, 0 filed — this was maintenance, not a backlog item).
- **Commits:** `fe4d029d` claim · `263521e1` seed-footer fix · `6a3a6e59` fence repair + count field · `5eec38df` pre-trim ledger record · `8326cdd9` CHANGELOG trim · `867e0fa2` HANDOFFS trim · `669b42e0` archive README · close-out.

### 2026-08-25 · [ad hoc] Session 253 — a severity premise the audit refuted, annotated in place

- **Session span:** 2026-08-25 (commits `aed7c9e1`..close-out); dated by close-out.
- **Model:** Claude Opus 5. **BACKLOG annotation.** Operator directive: *"Do not promote and make that one annotation."*
- **Deliverable:** one annotation on the `Indented (4-space) code blocks as a skip-region` item in "Polish / deferred". **Nothing moved, nothing promoted, nothing filed** — Up Next 67, Polish 126, total 193, all unchanged.
- **What it records.** The item justifies its severity as *"Low severity (uncommon construct)"*. Session 251's audit measures that construct in **180 of 3,383 authored documents (5.3%) — the highest construct count of all 192 items**. That half of the justification is refuted, and the original words are struck through rather than deleted so the supersession is visible.
- ⚠ **THE ANNOTATION ARGUES AGAINST ITS OWN HEADLINE NUMBER, WHICH IS THE POINT.** 180 is **construct presence measured with the WRONG INSTRUMENT for this item**: Session 251 scored `findHeadings` against `quarto render`, and this item describes a **CROSS-REFERENCE** defect (`{#fig-…}` inside an indented block indexed as a phantom label). The cross-ref surface was never measured, so the defect's real incidence is **UNKNOWN, not 180**. The 22 heading-divergent documents the construct co-occurs with are mixed-direction (12 phantom / 8 lost / 2 level) — the shape of coincidence, not cause. The annotation states what is owed before anyone sizes the item: measure the cross-ref behaviour over the real corpus the way headings were measured.
- **Origin — a flag of mine that did not survive reading the items.** At Session 252's close-out I raised 4 `REACHES_REAL` items sitting in "Polish / deferred" as a possible promotion, on their presence counts. Asked for the motivation, I read them: **three have ZERO divergent documents** (L437 13/0, L453 2/0 and explicitly *"accepted/documented Session 116"*, L441 0/0 and a cross-module refactor that `SAFEGUARDS.md` requires to go through plan mode — arguably mis-classified as `parser` by the audit). Only this one had any signal, and its signal is the wrong instrument. **Recommendation reversed to do-not-promote before the operator acted on it**; the operator confirmed. What survived is this annotation. (Learning #497.)
- **Phase 3E: NOT APPLICABLE**, stated rather than skipped — one sentence added to one markdown item; no runtime behaviour, no `src/` change.
- **Verification.** `check-backlog` **OK, 193 open items** · `npm test` **2796 passed / 66 files** · section counts unchanged at 67 + 126 = 193, confirming nothing moved.
- **Backlog:** 193 → **193** (0 closed, 0 filed, 0 moved, 1 annotated).

### 2026-08-25 · [ad hoc] Session 252 — the 90 enumeration-only items, downgraded with their measurement attached

- **Session span:** 2026-08-25 (commits `0d042777`..close-out); dated by close-out.
- **Model:** Claude Opus 5. **BACKLOG re-section.** Operator directive after reading Session 251's audit: *"downgrade them to Polish / deferred"*, with the annotation requirement raised as a question — *"will these include information that they do not touch document in our inventory?"* — answered YES and implemented.
- **Deliverable:** the 90 items Session 251 measured at **0 of 3,383 authored documents** moved from `BACKLOG.md` "Up Next" to "Polish / deferred", under a new `### Enumeration-only` subsection, each carrying a tag naming the measurement and its detector. **Up Next 157 → 67; Polish / deferred 36 → 126; total unchanged at 193.** No `src/` change.
- **Move and annotate only — nothing deleted, no item's own prose altered.** Verified as a SET comparison, not a count: all **193 item texts preserved byte-for-byte** modulo the appended tag. A count check would not have caught a loss — `check-backlog.js` counts `- [ ]` lines and would have reported 192 as happily as 193.
- ⚠ **THE DETECTOR FILENAMES ARE POSITIONAL AND THE BASE COMMIT IS NOT THE OBVIOUS ONE — THIS NEARLY MIS-TARGETED 83 OF THE 90 ITEMS.** `final.json`'s `line` field is each item's `BACKLOG.md` line number as read at the START of Session 251, i.e. `b85626f3`. Session 251 then FILED the panel-tabset item at line 52, shifting every line below it by +2 in its own close-out `b50e5f6b`. Items in this file sit exactly two lines apart (item, blank), **so resolving against `b50e5f6b` maps target k onto item k+1 — which is still a valid item start, and therefore resolves SILENTLY AND WRONGLY.** Only the 7 targets that happened to land on non-item lines tripped the "is it an item start" guard; the other 83 would have been mis-tagged. Caught by an INDEPENDENT cross-check of each resolved line against the title `final.json` recorded for it. This is precisely the hazard `BACKLOG.md`'s own header documents — *"any insertion above a cited line silently retargets it at a different item, which is worse than a broken link because it still looks valid"* — met in practice, by the session that had just written an audit about it. (Learning #496.)
- **What each moved item now carries:** `⚠ **ENUMERATION-ONLY (S251): 0 of 3,383 authored documents** — detector \`scratchpad/s251/det/<N>.py\`. Downgraded from Up Next by Session 252; see the section note above.` The method, the caveats and the promotion route are stated ONCE in the subsection note rather than repeated 90 times.
- **The subsection note is explicit about what the claim is NOT** — construct absence in ONE corpus (3,383 files but only 2,026 distinct basenames, one machine, R-centric), not a finding that any item is wrong; and it gives the promotion route: show the construct in a document someone wrote and move it back. Session 251's own adversarial pass cleared that bar six times.
- ⚠ **THE MOVE MADE ONE CROSS-REFERENCE STALE AND THE PHASE 3F SWEEP CAUGHT IT.** `BACKLOG.md`'s "Active" section names four "Remaining candidates"; the **quoted-KEY CONTAINER half** and its cell-option twin are two of them, and both are among the 90. The pointer now says so, and a new **Ranking guidance** note beside it records the audit's finding — rank by real-document reach, not enumerated document count. Verified before/after against the pre-move copy, so "stale" is a measurement rather than a guess: the other three named candidates are unmoved.
- **Deliberately NOT done:** the 4 `REACHES_REAL` items already sitting in "Polish / deferred" — the mirror-image problem — were left alone. Promoting them is the opposite action and was not asked for; raised for the operator instead.
- **Phase 3E (runtime smoke test): NOT APPLICABLE and stated rather than skipped.** One markdown file re-sectioned; no runtime behaviour, no `src/` change, nothing to launch.
- **Verification.** `check-backlog` **OK, 193 open items** · `npm test` **2796 passed / 66 files** (`backlog-hygiene-gate.test.ts` runs on every `npm test`, so the file is asserted twice) · set-equality of all 193 item texts before/after · section counts 67 + 126 = 193. Pre-move copy preserved at `scratchpad/s251/BACKLOG.md.pre-downgrade`.
- **Artifacts:** `scratchpad/s251/downgrade.py` — the move, with `--check` dry-run, the title cross-check that caught the off-by-two, and a set-equality postcondition.
- **Backlog:** 193 → **193** (0 closed, 0 filed, 90 re-sectioned).

### 2026-08-25 · [ad hoc] Session 251 — which backlog items touch a document a human wrote

- **Session span:** 2026-08-25 (commits `52b04173`..close-out); dated by close-out.
- **Model:** Claude Opus 5. **AUDIT**, `docs/methodology/workstreams/AUDIT_WORKSTREAM.md`. The operator DECLINED all five of Session 250's ranked candidates at Phase 0 and asked instead: *"Sort the 192 BL items by whether they affect real documents versus enumeration-only, so I can see how many actually matter."*
- **Deliverable:** `docs/REAL-DOCUMENT-TRIAGE.md` — one audit report classifying all **192 of 192** open `BACKLOG.md` items on a real-document-impact axis, plus the instrument that makes the axis measurable. Published also as an Artifact for the operator. **No `src/` change.**
- ⚠ **THE CORPUS THIS PROJECT HAS SWEPT FOR ~70 SESSIONS CONTAINS NO REAL DOCUMENTS.** All **60,998** paths in `scratchpad/s249/corpusfiles.txt` live under `scratchpad/` and are prior sessions' own generated probe output; median document **51 bytes / 5 lines**. So the nine items recording *"corpus weight ZERO"* — each citing exactly a probe-corpus size (`60,998`, `51,382`, `49,193`) — were measured probes-against-probes. The phrase has never meant "does not affect real documents", and it is routinely the deciding sentence at triage. ⚠ In fairness the project DOES keep a real-document control (`repofiles.txt`, 114 files) but it is 69 of its own methodology `.md` files plus 45 of its own `.qmd` fixtures, and it answers *"did my change move it?"* (regression), not *"does this occur in the wild?"* (prevalence).
- **NEW INSTRUMENT — a 3,383-document corpus of AUTHORED `.qmd`/`.Rmd`**, median **112 lines** (p90 464, max 4,397): 4,910 found, minus 1,467 byte-identical duplicates, 53 cloud-storage stubs, 3 unreadable, 4 empty. 1,332 `.qmd` + 2,051 `.Rmd`; 2,283 user projects, **602 quarto-web**, 456 R-package vignettes. All 3,383 rendered through the real quarto CLI, **HTML cached gzipped at 28 MB** so re-extraction never needs quarto again.
- ⚠ **THE RANKED LIST INVERTS UNDER MEASUREMENT.** Session 250's **#1 recommendation** (L52) and its #2, #3, #4 and #5 each occur in **0 of 3,383** authored documents; the item reaching the most (L56, 82) was not ranked. Every zero was adversarially re-attacked by a second agent forbidden the original detector, and upheld.
- ⚠ **THE SHIPPED MODEL AGREES WITH QUARTO ON 94.91% OF AUTHORED DOCUMENTS** — 2,314 of 2,438 scored (2,441 exit 0, minus 3 `{{< include >}}`). The **124** divergent: 81 phantom (217 extra Outline entries), 34 lost (157 missing), 9 wrong level.
- ⚠ **THE DOMINANT REAL CAUSE IS QUARTO'S OWN `:::` DIVS, NOT THE SETEXT GRAMMAR.** L268 (52 divergent documents) and L180 (50), both all-phantom, both already filed, **both unranked** — while the top of the list is a family with zero real reach. Confirmed by reading `wsfct/web/docs/articles/intro-for-leaders.qmd`: four `::: {.callout-*}` blocks each with a `##` inside, each a phantom Outline entry.
- ⚠ **NEW UNFILED DEFECT — EVERY heading inside a `::: {.panel-tabset}` is a TAB LABEL.** 11 of the 16 divergent documents no filed item explained. Minimal pair measured both halves firsthand: quarto renders `h2:Real Heading` + `h2:After`; this model reports those **plus** `h2:Tab A` and `h2:Tab B`. `grep -i tabset BACKLOG.md` and `grep -ri panel-tabset src/` were both EMPTY. ⚠ NOT covered by the two filed callout items: they key on `.callout-*` and lift the **FIRST** heading into a title bar; a tabset consumes **EVERY** heading, so a callout-derived fix leaves every tab after the first as a phantom. Invisible to enumeration because a 5-line probe never builds a tabset. Filed as Session 251 R1.
- ⚠ **THE INHERITED HTML EXTRACTOR IS UNSOUND ON AUTHORED DOCUMENTS — the FIFTH in a family of four already documented in `render250.sh`'s own header.** `H_DIRECT` requires heading text to contain no `<`, so it **drops** `## A concrete \`SKILL.md\`` (a `<code>` span — the heading-losing direction, like all four predecessors) and **invents** `Contents` / `Other Formats` from quarto's page chrome. Replaced with a real HTML parser skipping chrome by container class/id.
- ⚠ **THREE ARTIFACTS OF MY OWN INSTRUMENT WERE FOUND AND REMOVED, ALL POINTING THE SAME WAY.** Divergences fell **272 → 151 → 136 → 124**: quarto page chrome scored as headings the model lost (121 documents), blind tail-stripping of `References` deleting headings authors wrote (15), and skipping `id="footnotes"` which is also an author's own `## Footnotes` (12 rows). Every one made the model look worse; the 124 is what survived.
- **41% OF THE REAL `.Rmd` CORPUS HAS NO GROUND TRUTH.** 942 of 3,383 fail `quarto render`; **1,395 (41.2%)** carry an rmarkdown `output:` key quarto's front-matter validation rejects, 168 are `_`-prefixed include fragments. The extension still provides an Outline for those files, so for 41% of real R Markdown documents no render can check it.
- **A REAL DOCUMENT CRASHES QUARTO** — `broom/doc/bootstrapping.Rmd` (a published CRAN vignette) returns **exit 139**, a real-world instance of L377's generated-document crash class.
- **CONSTRUCT CENSUS — the probe corpus over-represents exactly what the backlog is about.** `from:` key: **0.12% real (4 documents, 2 unique) vs 7.9% probe**. Genuine setext headings: **3.67% real vs 32.17% probe** (8.8×). Conversely executable cells: **63.9% real vs 2.0% probe**; YAML front matter 77.9% vs 14.0%.
- **VERDICTS — 192/192, 0 unassigned.** **90 PROBE_ONLY** · **68 NOT_A_DOCUMENT_ITEM** (42 feature, 22 repo, 4 docs) · **34 REACHES_REAL**. Of the **124 parser items**, **73% have no reach into any authored document**.
- **Adversarial pass:** every `PROBE_ONLY` verdict attacked by a second agent forbidden the first agent's detector — **6 overturns**, each with a named document. ⚠ One found a defect OUTSIDE its own batch: **L66**, whose record claims *"corpus weight ZERO over 60,998 documents"*, is live in a real document — `1. alpha` / `2. bravo` / `---` gives the model `h2:"2. bravo"` and quarto `h2:"bravo"`. **The trigger needs an ordered list with ≥2 items**, which a 2-6 line probe never builds.
- **Agent claims verified firsthand rather than taken:** all **147** detectors re-run by this session, all passing their own control. **7 counts disagreed** with what the agents reported; my re-run governs, moving **5 verdicts** (3 down from REACHES_REAL, 2 up). Recorded in `final.json`, not smoothed away.
- **Two of the audit's own hypotheses were WRONG and caught by checking.** (a) 196 documents where the model reports zero headings despite `#` lines — correct behaviour, they are `.Rmd` files that are one R chunk and every `#` is an R comment. (b) A `\x01` in heading text looked like a control character leaking into the Outline — it was my own census writer's separator; a probe against `findHeadings` showed 0 of 22 headings carry it.
- **Phase 3E (runtime smoke test): NOT APPLICABLE and stated rather than skipped.** The deliverable is a report plus one backlog filing; no runtime behaviour, no `src/` change, nothing to launch.
- **Verification.** `npm run compile` exit 0 (both projects) · `npm test` **2796 passed / 66 files** (unchanged from claim) · `check-backlog` **OK, 193 open items**. NOT RUN: `test:integration` / `test:lsp` (screen-taking, no adapter surface touched) and `test:oracle` (no model change).
- **Artifacts:** `scratchpad/s251/` — `realfiles.txt` (the corpus list), `real.pkl`/`probe.pkl` (cached corpora), `det/` (147 calibrated detectors), `scan.py` (aborts on an uncalibrated detector), `extract_headings.py`, `render_real.py` + `htmlcache/`, `score_real.py`, `attribute.py`, `rescan_all.py`, `reconcile.py`, `final.json`, `struct_diverge.txt`.
- **Backlog:** 192 → **193** (0 closed, 1 filed — the audit classifies, it does not close).

### 2026-08-25 · [ad hoc] Session 250 — a roman marker is pandoc's parse, not the roman character set

- **Session span:** 2026-08-25 (commits `6a5f1513`..close-out); dated by close-out.
- **Model:** Claude Opus 5. IMPLEMENTATION, strict TDD. The operator picked Session 249's R4 at Phase 0 from the ranked `AskUserQuestion` candidate list — recommended there as the cheapest of the heading-DELETING candidates whose fix already existed in the file.
- **Deliverable:** `isPandocsRoman` (new) and the post-filter of `emptyItemMarkerIsPandocs` in `src/core/qmd/model.ts` — one capability, "which multi-letter runs are roman numerals pandoc would take". Closes **the empty-item half of Session 249's R4**; re-files the container-pop half with the measurement that declined it.
- ⚠ **THE FILED ITEM WAS RIGHT ABOUT THE DEFECT, RIGHT ABOUT THE FIX, AND WRONG THAT IT APPLIES TO BOTH CALL SITES.** It named eleven tokens and asked for the same narrowing in both post-filters. The defect is far larger than eleven — the character class is wrong on **274 of 441** tokens at lengths 2-3 and **2,482 of 3,151** at lengths 4-9 — and pandoc's tier parser is wrong on **ZERO of all 3,592**, exhaustively at lengths 2, 3 and 4 and stratified at 5-9. But the two post-filters are NOT the same question, and the second one measured 4,178 WORSE.
- ⚠ **THE TWO POST-FILTERS ASK DIFFERENT QUESTIONS OF THE SAME BYTES.** `emptyItemMarkerIsPandocs` asks what the line MEANS — is it an empty item? — and pandoc's parse is the whole answer. `popsEnclosingContainer` asks whether the marker CLOSES the container above, and that answer must mirror the PUSH `listItemContentColumn` performs on the same line. That push deliberately over-accepts `[a-zA-Z]{1,9}` — G4 has pinned `Elephants.` and `Dr.` for exactly this reason since Session 249 — and it pushes a column for `ixix.`, `dd.` and `cmcm.` just as it does for those two, measured firsthand. Narrowing only the POP de-synchronises the pair, strands the outer container's column, and a later underline AT that column invents a heading. (Learning #487.)
- ⚠ **THE DECLINE IS A MEASUREMENT, NOT A JUDGEMENT.** The pop narrowing was built as a candidate `src` copy and scored: **461 BETTER against 4,178 WORSE**, class-weighted over the 4,729 documents (of 1,679,616 enumerated across 36 line kinds) whose answer it moves, against 643 rendered witnesses. The 461 are real and are the heading-DELETING direction the item named; they are left wrong on purpose and re-filed, because the way to close them is to narrow the PUSH and the POP together. (Learning #488.)
- ⚠ **THE POP PREDICATE'S ROMAN BRANCH HAD ZERO TEST COVERAGE AT HEAD, AND AN ADVERSARIAL AGENT PROVED IT RATHER THAN ASSERTED IT.** Both `return true` and `return false` at that line survived the entire 2,792-test suite. The new R3 guard is the first coverage it has ever had, and mutant N7 — the narrowing itself — now fails against it. This is also why the unit suite alone could never have caught the regression: only the enumeration plus the render could. (Learning #489.)
- ⚠ **THE HEADING-BLIND GRID.** The 443-document container-pop geometry inherited from Session 249's `r5` scores quarto's BLOCKS skeleton correctly and is worth nothing for scoring the MODEL: quarto renders NO heading in it in either direction, so this model scores 443/443 on it before and after any change. The defect is visible only through the empty-item geometry (170/444 → 444/444). An instrument validated for one question is not validated for the next one. (Learning #490.)
- **TDD gate:** the RED was written first and confirmed to fail for the right reason (`expected [ 'h2:bravo' ] to deeply equal []`), then the minimal GREEN, then the full suite. **1 RED→GREEN cycle** for the one term that moved, plus **3 test-after guards** (R2 the valid-roman control, R3 the declined half, R4 the residual with its control). ⚠ `src/core/qmd/model.ts` restored **byte-identical** after all 7 mutants.
- **Measurement.** **6,098 documents** rendered through the real quarto CLI 1.7.33 across five grids, every exit code read, **all 6,098 exit 0**. Ground truth EXHAUSTIVE where affordable: every lowercase 2- and 3-character run and every uppercase 2-character run over `[ivxlcdm]` in BOTH geometries (887), every lowercase 4-character run (2,401), stratified at 5-9 (750), 643 pop witnesses, 1,861 shipped-change witnesses. Character class wrong on **2,756**; tier parser wrong on **0**. Corpus sweep **60,998 documents** and the repo's own 114 tracked files: **ZERO movers, both**. Enumeration **4,100,625 documents** over 45 line kinds → 45,573 movers in 349 classes, class-weighted against the rendered witnesses: **42,569 BETTER, 1,072 WORSE, 1,932 SIDEWAYS**. A second enumeration of **1,679,616** over 36 line kinds scored the declined half. Mutation hunt **7 mutants: 6 killed** (each by the intended guard, N7 by R3), 1 kept with a proof.
- **Residual, disclosed and filed.** 1,072 worse documents remain, **308 of them one class**: a prose token alone on a line with a block quote under it invents an ATX heading. **PRE-EXISTING and merely widened** — the control is what proves it: `Etc.` and `Dr.`, prose tokens the predicate already rejected, report the same phantom in the PRE-CHANGE build on the same bytes. Corpus weight ZERO. Filed as Session 250 R2, guarded at R4.
- **Verification.** `npm run check-types` exit 0 (both projects) · `npm test` **2796 passed / 66 files** (2792 at claim, **+4**) · `npm run test:oracle` green · `check-package` **OK 42 files / 5.59 MB** · `check-backlog` **OK** · `npm run package` **exit 0** (44 files, 1.83 MB) · `npm run test:integration` **542 passing / exit 0**, on the shipping build, on an operator go-ahead sought IN ADVANCE with every assertion pre-checked headlessly first — all 22 integration fixtures unmoved and `closes-paragraph-gate.qmd` still exactly 40 headings. NOT RUN: `test:lsp` — no LSP surface touched.
- **Backlog:** 191 → 192 (one closed, two filed).

### 2026-08-25 · [ad hoc] Session 249 — a marker's ordinal run is as long as its reader takes

- **Session span:** 2026-08-25 (commits `5805d920`..close-out); dated by close-out.
- **Model:** Claude Opus 5. IMPLEMENTATION, strict TDD. The operator picked Session 248's ranked #3 at Phase 0 from the ranked `AskUserQuestion` candidate list, promoted to #1 there on Session 248's own tiebreaker — a heading DELETED outranks a TEXT divergence — at the lowest filed effort among the heading-deleting candidates.
- **Deliverable:** the ordinal run in `ORDERED_MARKER_SRC` (with `ORDERED_MARKER_SRC_COMMONMARK`, `ROMAN_RUN_LOWER`/`ROMAN_RUN_UPPER`, `LONG_ROMAN_SRC`, `LIST_ITEM_OPEN_COMMONMARK`), and the two independent respellings of it in `emptyItemMarkerIsPandocs` and `popsEnclosingContainer`, in `src/core/qmd/model.ts` — one capability, "how long may a list marker's ordinal run be, and for which reader". The fixture and outline-test changes are adapter-side wiring evidence. Closes **Session 247's R3**.
- ⚠ **THE FILED ITEM WAS RIGHT ABOUT THE OWNER AND WRONG ABOUT THE RULE, IN BOTH HALVES.** It described "a marker longer than NINE characters" — a cap to be raised. The DECIMAL run is UNBOUNDED: rendered at every width from 1 to 24 and at 30, 40, 50, 64 and 100 digits, all opening an `<ol>`, with `.`, `)` and the parenthesised form alike. The LETTER half is not a length rule at all but pandoc's ORDER-RESPECTING roman parser — `mmmmmmmmmm`, `iiiiiiiiii` and twenty `m`s are markers though none is a valid numeral, while `ixixixixix` is not, and a NON-roman letter run is never a marker at any length. (Learning #482.)
- ⚠ **THE CAP IS CORRECT FOR THREE OF THE NINE READERS, AND THAT SPLIT IS MEASURED RATHER THAN ASSUMED.** Nine readers × eight markers = 72 documents, every one exit 0: `gfm`, `commonmark` and `commonmark_x` stop at nine and the other six do not. The set is EXACTLY `FRONTMATTER_COMMONMARK_FROM` — the same six-three split `atxClosingRun` already turns on, arrived at independently. A widening applied unconditionally would report a heading quarto does not render under a third of the readers. (Learning #483.)
- ⚠ **A CHARACTER CLASS IS NOT A PARSER.** The obvious `[ivxlcdm]{10,}` spelling is measurably wrong on `ixixixixix.` — ten characters all drawn from the roman set, rendering a bare `<p>`. Transcribing pandoc's own tier order predicts all 17 rendered roman-letter tokens. Every tier is OPTIONAL, so the run also matches the EMPTY string; a `{10}` lookahead keeps a bare `.` from becoming a marker AND makes the widening strictly additive. Guarded at G3 and G8. (Learning #484.)
- ⚠ **THE PRICE WAS PAID AT EACH INDEPENDENT RESPELLING, AND THE SESSION 248 HANDOFF NAMED BOTH IN ADVANCE.** While `emptyItemMarkerIsPandocs` lagged at `{1,9}`, `LIST_ITEM_EMPTY` matched a marker-only long line and that predicate denied it, so the line fell through to the setext path — 817 disagreements over 54,225 enumerated documents. While `popsEnclosingContainer` lagged, a long marker pushed a content column and CLOSED nothing, so columns accumulated (`[11,11,11,11]` where `1.` holds `[2]`) and the stale ones matched later underlines. Both comments have read "at any width" since Sessions 198 and 248 while their regexes capped at nine; they are true now.
- ⚠ **MY OWN FIRST ENUMERATION VERDICT WAS A SIGN ERROR CAUSED BY MY OWN SAMPLING.** Rendering 100% of the LOSS classes and a stepped ~20% of the GAIN classes produced 313 WORSE against 144 BETTER. Rendering all 1,587 classes reversed it: per class 453 → 585 (+132), per document 12,447 → 27,373 (+14,926). (Learning #485.)
- ⚠ **THREE MUTANTS SURVIVED THE FIRST HUNT AND TWO OF THEM WERE GUARD WEAKNESS, NOT REDUNDANCY.** A candidate `src` copy with all three reader gates removed, scored over 1,867 rendered documents, found 6 rows where the ungated build DELETES a real heading — all in Session 198's 2/4/6 container-pop geometry, which no alphabet or design grid contained. One new guard row (G7) killed both. The one genuine survivor is kept with a proof at its call site. (Learning #486.)
- **Measurement.** 1,867 documents rendered through the real quarto CLI 1.7.33 across nine grids, every exit code read and 32 non-zero rows discarded as not-data. Design grids 222 documents: 130 → 189 exactly right, 67 BETTER, 8 WORSE, 0 SIDEWAYS. Corpus sweep 60,998 documents and the repo's own 114 tracked files: **ZERO movers, both**. Enumeration 782,969 documents over five alphabets → 1,587 transition classes, **all 1,587 rendered**: per class +132, per document +14,926. Three candidate `src` copies built and SCORED rather than argued (`expA` the empty-item widening, `expB` the pop widening at 13 BETTER / 0 WORSE, `expN` all three gates removed). Mutation hunt 9 mutants: 8 killed, 1 kept with a proof. `src/core/qmd/model.ts` restored byte-identical after every mutant.
- **Residual, disclosed.** 453 worse classes / 12,447 documents remain, and they are TWO pre-existing, width-independent families, both demonstrated at `1.` and `123456789.` where this model has always been wrong: a `---` after a stack of empty items is a THEMATIC BREAK (67 classes, filed as R1) and a line consumed as a setext TITLE still pushes its list content column (386 classes, filed as R2). Also filed: the `fancy_lists` reader axis (R3), the roman post-filter that is a character class (R4), and one agent-reported item explicitly marked NOT verified firsthand (R5).
- **Verification.** `npm run check-types` exit 0; `npm test` **2792 passed / 66 files** (2779 at claim); `npm run test:oracle` byte-identical; `npm run package` green (44 files, 1.83 MB); `npm run test:integration` **542 passing / exit 0**, on the shipping build, on an operator go-ahead sought IN ADVANCE with every assertion pre-checked headlessly first — the model's 40 headings match quarto's 40 EXACTLY and in order. Fixture premise re-rendered, not assumed: 36 → 40 headings, the 36 byte-identical and in the same order, exactly four added.
- **Backlog:** 187 → 191 (one closed, five filed).

### 2026-08-25 · [ad hoc] Session 248 — a marker-only line is a complete empty item

- **Session span:** 2026-08-24/25 (commits `b991d711`..close-out); dated by close-out.
- **Model:** Claude Opus 5. IMPLEMENTATION, strict TDD. The operator picked Session 247's ranked #2 at Phase 0 from the ranked `AskUserQuestion` candidate list, promoted to #1 there because it DELETES a heading where Session 247's own #1 is a TEXT divergence with measured corpus weight zero.
- **Deliverable:** the second arm of `emptySiblingItem`, plus `listItemOpensHere`, `emptyItemMarkerIsPandocs`, `listItemOpensAtPrevLine`/`listItemAboveHeader` and `simpleTableOpensHere`'s `headerIsItemOfOpenList` in `src/core/qmd/model.ts` — one capability, "does a marker-only line count as a body line of the item it opens". The fixture and adapter changes are test-side wiring evidence.
- ⚠ **TWO FILED ITEMS WERE ONE MISSING CONJUNCT, FILED A SESSION APART UNDER DIFFERENT SYMPTOMS.** Session 247's R4 (`1.` / `bravo` / `---` renders `ol>h2` and every build reported NOTHING, because the marker line counted as a body line and the run reached 2) and Session 246's own R4 (`-` / `# Probe Z` renders `ul>h1` and no build reported the ATX, because `paragraphOpen` was left set) are the same term: a marker-only line that OPENS a list is an empty item, exactly as a sibling one is. Session 246 gated its rule on a list being open ABOVE the line, so the FIRST marker of a list was outside it by construction. One conjunct closed both. (Learning #477.)
- ⚠ **THE TWO ARMS ARE GATED DIFFERENTLY AND THE ASYMMETRY IS COMMONMARK'S OWN, NOT TIDINESS.** An EMPTY item may not interrupt a paragraph, so with prose open above it a lone `-` is a level-2 UNDERLINE and a lone `1.` is ordinary text — `alpha` / `-` / `bravo` / `---` renders BOTH headings and `alpha` / `1.` / `bravo` / `---` renders a bare `<p>`. A SIBLING marker interrupts nothing — it ENDS the item it is a sibling of — so it is an empty item even with a paragraph open. The arms cannot be merged; guarded at G1, G2 and G3, all written BEFORE the gate.
- ⚠ **CLEARING A FLAG THAT WAS TRUE BY ACCIDENT BROKE A READER THAT USED IT AS A PROXY, AND ONLY THE ENUMERATION SAW IT.** An empty item opens no paragraph — the whole point — but `simpleTableOpensHere` reads `paragraphOpenAboveHeader` as a proxy for *"some block above has already claimed this header row"*, true of a marker-only line only because that line used to be miscounted as paragraph content. With the accident gone, a bare marker became eligible as a simple table's HEADER and `inSimpleTable` suppressed the setext row: **53 of 120 heading-losing transition classes**, on a build where SEVEN other gates were green. Instrumented rather than argued — the two traces are identical through `titleLineCount` and diverge on `inSimpleTable` alone. The repair was a sentence already written one screen away for block quotes (`headerContinuesQuote`), with "list" for "quote". (Learning #478.)
- ⚠ **A SHARED GRAMMAR'S DELIBERATE OVER-ACCEPTANCE IS SAFE ONLY BEHIND THE SECOND GATE THAT MAKES IT SAFE, AND A NEW CONSUMER DOES NOT INHERIT THAT GATE.** `LIST_ITEM_EMPTY` is built on `ORDERED_MARKER_SRC`, which accepts `[a-zA-Z]{1,9}` before a `.`/`)` — safe for the STRIP because a pseudo-marker opens a column no underline is accepted at, and its docstring says so. An EMPTY item has no second gate, so every 1-9 letter prose token ending in a period, alone on a line, became a complete list item: `Etc.`, `Ibid.`, `Mr.`, `xyz.`, `Etc)` and two ATX spellings, **7 measured phantoms**. Repaired with `popsEnclosingContainer`'s measured rule minus its initial-in-a-name exclusion, which cannot apply to a marker alone on its line (`A.` / `bravo` / `---` renders `ol>h2`). (Learning #479.)
- ⚠ **AN AGENT READING THE GRAMMAR FOUND WHAT NINE RENDERED GRIDS COULD NOT.** 93 rendered probes, 60,998 corpus documents, 6,200,000 enumerated documents and a 15-mutant hunt were ALL green on the `Etc.` family, for one reason: not one alphabet contained a multi-letter prose token ending in a period. A fan-out agent asked what else the regex admits, named the already-filed backlog item it belongs to, and said plainly that it had not rendered. All 7 witnesses reproduced firsthand. (Learning #480.)
- ⚠ **TWO PINS IN SESSION 182'S BLOCK ASSERTED AN ANSWER QUARTO DOES NOT GIVE.** `"   -"` in M9/M10's loop and the `-` row in M13 both went red. Every measured example in those comments is an `=` run; the dash spellings were added by analogy and never rendered. Re-rendered on the exact bytes, `# Heading Above` / `   -` / `# ATX Below` and `# Heading Above` / `` / `-` / `# ATX Below` both render `section>h1>ul>h1` with BOTH headings. Third consecutive session in which an inherited red test was a filed defect's obituary rather than a regression.
- **TDD gate:** the guard block FIRST — **8 `it()`s green BEFORE any `src/` change**, every row rendered, weighted to the rows the obvious spellings break (G1's paragraph-interrupt gate, G2 one container in, G3 the sibling arm that cannot be folded into it). **3 RED→GREEN cycles**, each RED confirmed to fail for the right reason (`expected [ 'h2:bravo' ] to deeply equal []`, then `expected [] to deeply equal [ 'h2:1.' ]`, then `expected [ 'h2:bravo' ] to deeply equal []`), and **two of the three were regressions this session's own change created and its own gates caught**. **10 test-after pins (C1-C10)** and **1 residual pin (R1)**. ⚠ `src/core/qmd/model.ts` restored **byte-identical** after each of the 10 and then 15 mutants.
- **Measurement:** **1,047 documents** rendered through the real `quarto render` path (quarto 1.7.33) across ten grids, **every exit code read and 35 non-zero rows DISCARDED as not-data**. Design grids 93 documents: 44 movers, **44 BETTER, 0 WORSE, 0 SIDEWAYS**. Corpus sweep **60,998 documents**: 17 heading movers, **0 cell movers**, EVERY mover rendered — **16 exactly right, 0 worse**, and the 1 "sideways" is per-heading one heading's text corrected with a pre-existing phantom left untouched. Repo sweep 114 tracked files: 1 mover, and it is this session's own fixture moving exactly as intended. Enumeration **6,200,000 documents** across eight alphabets — 572,401 movers in 11,107 transition classes, stratified by DIRECTION (96 LOSS, 389 TEXT, 10,622 GAIN); **all 96 LOSS and all 389 TEXT rendered in full** plus a STEPPED sample of 400 GAIN, 885 documents scored: exactly right **55 → 479**. **Three candidate spellings built as `src` copies and SCORED, and the score contradicted the reasoning twice**: a NARROW arm loses on every grid (467 vs 479) because the one-line lag puts it out of reach, the table-outrank wins or ties everywhere (494), the pandoc-marker narrowing is **12/12 against 5** and identical on all eight other grids. Mutation hunt **15 mutants: 14 died**; N4 is redundant BY CONSTRUCTION — an indented code line already opens a fresh block AND closes any paragraph — proven on **7 directly NAMED reaching shapes** and 362,144 enumerated documents across two alphabets, and kept with the proof at the call site. (Learnings #477-#481.)
- **Residual, disclosed and filed:** an empty item's BODY line is still eligible as a simple table's header row — **55 of 11,107** transition classes, **36 of them behind a CommonMark-family `from:` prefix**, **corpus weight ZERO** over 60,998 documents and over the repo's own 114. **PRE-EXISTING IN KIND**: Session 246's sibling arm already opens no paragraph and quarto really does build a table under one (`-   alpha` / `-` / `bravo` / `   -` / `charlie` renders `ul>table`, and BOTH builds report nothing). Its OTHER leg is an INDENTED CODE line as the header row, which is measured to be a real header, so the two legs cannot be closed by one term. Pinned as R1.
- **Verification at close:** `check-types` **0** · `check-types:unit` **0** · `compile` **0** · `compile-tests` **0** · `npm test` **2779 passed / 66 files** (baseline 2760, **+19**) · `test:oracle` **131 / 124 agree / 4 lost TP / 3 CARDINAL FP / 0 unrelated** (BYTE-IDENTICAL to S180-S247, verified by swapping the pre-change build in and diffing the full output) · `check-package` **OK 42 files / 5.59 MB** · `check-backlog` **OK, 187 open items** · `npm run package` **exit 0** · `test:integration` **542 passing / exit 0**. NOT RUN: `test:lsp` — no LSP surface touched.
- **Phase 3E:** green **TWICE**, both on an operator go-ahead sought IN ADVANCE, and the second run is against the exact build that ships — `src/` changed after the first (the third fix), so the gate was re-run rather than left one commit stale. All assertions pre-checked headlessly first (`scratchpad/s248/precheck248.test.ts` — S211's gotcha 3 for a **THIRTY-FOURTH** session), including an EXACT outline-vs-quarto match IN ORDER on all 36 names and a re-check of every prior session's assertion on this shared fixture, both directions; the one differing name is Session 241's already-filed internal-whitespace collapse, on a Session 247 row and not on this session's. The fixture's premise was **re-rendered, not assumed**: 32 → 36 headings, the 32 prior byte-identical and in the same order, exactly four added. ⚠ The underlines sit at the marker's own WIDTH, because an empty item's content column is one LEFT of a populated item's, and because a column-0 `---` would pair with an existing one and fail the render with exit 1. `src/` did NOT change after the second run.
- **Backlog:** **2 CLOSED** (Session 247's R4, the operator's pick; and Session 246's R4 as free by-catch on the same conjunct), **1 FILED**; 188 → **187** open items.
- **Commits:** 1B claim `b991d711` · FIX 1 `1159f9fa` · FIX 2 `b9161fc1` · WIRING `c8d14468` · FIX 3 `3af05aed` · close-out.

