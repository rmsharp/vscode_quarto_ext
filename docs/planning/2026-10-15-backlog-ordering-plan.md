# Backlog ordering plan

*Session 315, 2026-10-15. Planning only: no source code changed. Keys `B<line>` name an item as it stood in `BACKLOG.md` at commit `1ed4197a` (resolve with `git show 1ed4197a:BACKLOG.md`); they are frozen and never a line of the live file.*

> **The standing rule (operator, Session 315, verbatim intent):** address backlog items in the order that creates robust code, which is sometimes implementation- and testing-sensitive (a pin or prerequisite lands before the change it protects), and address feature gaps cohesively: finish working on a feature until it is done instead of jumping around.

## Current position (update at every close-out)

| Field | Value |
|---|---|
| In flight | Slow-input sweep (Sessions 311-314, pins done in Session 316, B88 part (8) done in Session 317, B88 part (7) in Session 318, B89 parts (5)+(9) in Session 319, B89 part (4) in Session 320, B89 part (3) in Session 321, B89 part (8) in Session 322, B89 part (6a) in Session 323, the Session 317 item's part (1) in Session 324, the same item's part (2) together with the Session 319 item's part (3) in Session 325, the same item's part (3) together with the `{` half of the Session 311 item's part (6) in Session 326, the `$` half of that part in Session 327, the same item's part (3) in Session 328, the same item's part (5), found already closed and pinned, in Session 329, the Session 318 item's parts (2) and (3), a heading's closing-hash run and trailing attribute block, in Session 330, the Session 319 item's part (1), consecutive container-column lines, in Session 331): every measured part of B89 is closed ((6b) stays a pin; (6c) and (7) are limits); the four items filed in Sessions 317, 318, 319 and 322 are next (nine overflow and slow-input families, of which parts (1) to (3) are closed and parts (4) to (9) remain; eight regexes and a paragraph reader; container columns, quoted openers, angle constructs, unanchored scans and stack overflows; a per-cell-line region lookup and two extensions), ending in one terminal bounded session with a stop line. The operator decided at Session 325 that the sweep's unrun 68% (rule P5, the seeded generator under `tools/`) belongs to that terminal session. |
| Next group to offer at Phase 0 | `g02` — Slow-input sweep; its next session is open and the operator picks at Phase 0. Derived from the table order and the finishing-a-feature rule: the Session 311 item's parts (3), (5) and (6) are closed (part (6): its `{` half in Session 326, its `$` half in Session 327; part (3), refused fence openers with no blank line between them, in Session 328; part (5), a front-matter block scalar and many `---` groups, in Session 329, where both documents were found already linear, closed by Sessions 314 and 322, and are pinned), and its parts (4), (10) and (11) remain, which the item itself ranks by how likely a real document is to meet them: (4) many unclosed flow-mapping openers in one front matter (invalid YAML), (10) sizes beyond any real document, (11) many kinds of refused fence opener in one run (hundreds of different fence lengths; new in Session 328). The plan's candidate row lists the four filed items and not that item: ask which rule places it. The other candidates: the Session 318 item's part (9), a long paragraph under `from: gfm` (Session 329 added two more shapes that reach it, `text` + an unclosed raw-HTML opener repeated under mid-document `from: gfm` blocks, and `- item` followed by many `===` lines, the steepest so far), the same Session 318 item's parts (1) and (4) to (7), five more regexes that need a deliberately odd line (`GRID_TABLE_BORDER`, `htmlLineHasText`, `linkDefinitionAt`'s attribute check, the knitr `options(` scan, `YAML_ALIAS_VALUE`; its parts (2), (3) and (8) are closed, Session 330 closed (2) and (3)); the Session 322 item's part (1) and the Session 317 item's stack overflows (4) to (9) follow. The Session 319 item's part (1), consecutive container-column lines, is closed in Session 331; what it leaves for a long definition list is that under `from: commonmark_x` a `~ a` line still pays the Session 318 item's part (9), the paragraph scan, which is therefore the nearer candidate. Session 327's review round added a part (10) to the Session 311 item (sizes beyond any real document, shared with the parent: a run of more than 2^27 characters, 9.2 million regions in the preview) and measured a constant-factor cost in its own cure (1.08x on real documents, up to 1.4x on a shape built for it), decided against in CHANGELOG, Session 327. Session 326 filed two items in `BACKLOG.md` "Up Next" (`isAttributeBlock`'s prefix test is quadratic in a leading run times the groups on a line; the first-versus-last group at `fenceAttributeId` is unpinned for a fence whose first word is not brace-led) and one in Polish (the `braceGroups` table's constant cost). Session 328's review round added part (11) to the Session 311 item and filed two Polish items (the cure's constant factor, 1.007 to 1.07x; a duplicated test helper). |
| Groups closed | `g01` (Session 316) |
| Decisions answered | none yet; each is asked once, at or before the group named in the Decisions table (first: D8 before g05, D2 and D3 before g03) |

**How a session uses this plan.** At Phase 0, offer the next item of the group already in progress first; if none is in progress, offer the first group in the order below whose hard prerequisites are closed. Say in each picker option which rule placed it (dependency, finishing a feature, or neither). One session works one deliverable from one group and stops (a group's first session is its first deliverable); each group below is a series of separate sessions. A group is **closed** when every core item is done or is filed as a RESIDUAL record with a named owner. At close-out, update the status column of the order table and this block, in the same commit as the session's other records.

## Principles

- P1 In flight first: the slow-input sweep (B90 pins, then B88 and B89, ending in one bounded terminal session) leads; hygiene and tooling follow before a new feature opens.
- P2 Pins precede the change they protect; producers precede consumers. HARD prerequisite: the earlier group's code or committed measured fixture, NAMED, must exist. SOFT: it only needs deciding, re-measuring or re-ranking. CLOSED: every core item is done, or filed as a RESIDUAL record owned by a group in group_order or 'D1: unscheduled' (never a deferred row or g29).
- P3 Finish a feature before the next opens. YAML-VALIDATION spans g09-g13 on purpose: false-positive fixes first (g09-g11), then grammar consolidation (g08), then the lost-true-positive widenings that consume it (g12, g13); g07 is phantom-direction and sits with the phantom groups. Label index, then Outline, in dependency order; seams and missing features (g32-g37) last.
- P4 Items are keyed B<line>, frozen at 1ed4197a (git show 1ed4197a:BACKLOG.md). The Session 252 deferral is every item under the Enumeration-only heading (B407 and later): deferred:true, after a group's core items, excluded from criteria, estimates and hard prerequisites (D1). PROMOTED items (B501, B593's arm-token half) are core.
- P5 Evidence is re-based: scratchpad/ is untracked and trimmed (s276, s292 gone; s277 holds one file; s301/hunt is empty), so each group commits a seeded generator plus quarto 1.7.33 rendered answers as its tracked fixture in its first session, expected values from the PARENT build; at most 3 concurrent renders. Also gone: s282, s290, s293, s295 to s298 and the B112 harness (gen_rows.cjs, check_rows.cjs, stktable.cjs, rdrtable.cjs); groups rebuild rows from tracked RESIDUAL rows.
- P6 Gates and stop line. test:oracle (the cell-option flag decision) goes red only where scanRegions, cell partition or flag decisions change; Outline and label-index groups close on their OWN tracked fixture plus a ratchet row; tools/realdoc-score/run.sh head is cited before and after, never a closure clause. Outline-moving groups: at most two fresh adversarial passes ('new' = red against the parent), then RESIDUAL rows; a deleting-direction RESIDUAL needs a rendered decision record, and session 1 records the BASELINE COUNT of deleting RESIDUAL rows, which the group may not raise. Counting convention: a RESIDUAL row's test title starts 'RESIDUAL (deleting)', '(phantom)' or '(text)'; one tracked test (g14) counts the 'deleting' prefix against a recorded baseline and fails when the count rises.
- P7 Diagnostics rank false positives (the cardinal sin) above lost true positives; the Outline ranks deletion, then phantom, then text, measured witnesses first (so g24 and g25 precede the phantom groups). Where quarto render and Posit disagree it is a decision (D15), not a defect.
- P8 No unit test imports adapter code (src/quarto, src/features, src/providers): a group with adapter logic OPENS by extracting a vscode-free function into src/core (plan-mode approval, D8) and says which rows run in vitest and which need the integration run, OPEN until approved. Standing rule: screen-taking runs (test:integration, test:lsp, observe:posit) need the operator's go-ahead at the start of the session that runs them. Strict TDD; clean-room.

## Totals

- Core sessions (groups in the order below): **202**
- Extra sessions if the Session 252 deferral were lifted: **75**
- Core sessions without the decision-gated groups: **195**

Estimates are planning figures, not commitments: each assumes the parts-per-session stated in the group.

## Decisions

| Id | Question | Recommendation | Needed before | Groups |
|---|---|---|---|---|
| D1 | Confirm the Session 252 policy for this plan: schedule no item under the Enumeration-only heading (B407 and later, 94 items) unless its construct appears in a document someone wrote? Two promotions are forced by core work: B501 (g27) and B593's arm-token half (g12). | Keep it. Groups close on core items; deferred tails stay listed after them. g03's drains of completed or duplicate records after that line are housekeeping that precedes this decision. | g11 | g07, g11, g12, g15, g16, g17, g18, g20, g21, g22, g23, g26, g27, g28, g29, g30, g31 |
| D2 | B183: merge duplicates B451 and B547 into B535, and re-measure or drain B585, the SUPERSEDED Session 192 fenced-div lead (not independently measured)? | Yes; fold each unique clause first, CHANGELOG entry before the drain; re-measure B585 only if a group needs it. | g03 | g03 |
| D3 | B267: what is the policy for dangling scratchpad citations? | Commit each group's small generator and rendered rows as tracked fixtures; stop citing scratchpad paths in durable documents. | g03 | g03 |
| D5 | B178: add scratchpad/ to .gitignore (reverses Session 174; git status stops listing it)? | Yes, after checking nothing depends on git status listing scratchpad/. | g04 | g04 |
| D6 | B269: delete the three superseded VS Code downloads (about 2.5 GB), clear user-data/WebStorage (about 14 GB, effect unmeasured) and pin a version in test/lsp/runTest.ts? | Delete the three downloads and pin the version; leave WebStorage until measured. | g04 | g04 |
| D7 | B326 part (2): a different-format preview request during the 60 s startup window: restart, queue or only show feedback? | Queue the latest request and show feedback; never kill a starting process. | g05 | g05 |
| D8 | Plan-mode approval for each cross-module extraction or shared-function change (SAFEGUARDS: no cross-module refactor without plan mode), given once per group at the start of its first such session? | Yes, once per group; the design note names the seam and the differential or characterisation rows that pin it. | g05 | g05, g08, g09, g10, g12, g13, g14, g15, g20, g24, g27, g32, g33, g34, g35, g36 |
| D9 | May the extension read project files off-editor (_quarto.yml, _metadata.yml of the document's own project) through an adapter-supplied, cached project context that src/core consumes (B254 (b)(c); project-level rows of B95, B86, B108, B117, B297)? | Yes, bounded to the document's project root and built in g09 for its first consumer; if no, those rows are recorded limits. | g09 | g09, g10, g13, g14, g25 |
| D10 | B254 parts (a) and (d): which format's validate-yaml flag wins for a diagnostic that is not per-format? | Follow quarto's measured precedence in the fixture; where a diagnostic cannot express it, stay silent. | g09 | g09 |
| D11 | B256: accept a sourced rule for the 26 pandoc-validated keys, or record the survivor set as a limit? | Record a limit unless a non-hard-coded source exists (Learning 174); the set varies with pandoc. | g09 | g09 |
| D12 | B210: may the extension read included files off-editor (recursive, re-triggered on child edits)? | No until D9's seam exists; keep the decline and name the two include rows RESIDUAL. | g10 | g10 |
| D13 | B589 (only if D1 promotes it): should raw {=html} blocks appear as cells in the Outline and get a Run Cell lens, or only be validated? | Validated only. | g11 | g11 |
| D14 | B263: put the container-key format diagnostic on the first child line or the name token; want the nearest-match hint? | Name token; no hint until asked. | g13 | g13 |
| D15 | Outline oracle: does quarto-dev/quarto issue 829's principle (the outline matches the rendered TOC) govern all new Outline and label-index fixes, or does each row need a black-box Posit observation? B230's quote-scoped swallow follows the answer mechanically. | Render governs by default, recorded as standing decision (8) beside (6) and (7); one approved observe:posit batch only where a fix touches a pandoc-only construct (fancy_lists, definition lists, footnotes, attribute grammar); a disagreement becomes a decision. | g10 | g07, g10, g12, g14, g15, g16, g17, g18, g19, g20, g21, g22, g23, g24, g25, g26, g27, g28, g30, g31 |
| D16 | B86 part (3): may the render mode be inferred from execute: eval or enabled false, not only from quarto.symbols.renderMode? | Yes as the default for documents that say so; the setting overrides; executing stays the default otherwise. | g14 | g14 |
| D17 | Which OPEN callers receive the resolved engine: Run Cell, the cell background and the virtual-document language map (diagnostics, refs, completion and the Outline already do; the refs render mode is g14's, B86 (5))? Includes whether the diagnostics-grade resolver may route {python} cells down the R pathway (B365, reticulate). | Virtual-document map yes (g24); Run Cell and the cell background only where quarto's partitioner differs measurably; reticulate no until a user asks (if yes, route only when the resolver returns knitr); record the rest as limits. | g14 | g14, g24, g36 |
| D18 | B297 part (f): schedule the optional P4 slice (one fence-info rule shared by model and refs; 29 deletions, 7 phantoms, 13 label errors, 0 corpus reach) or leave it RESIDUAL? | Leave it unscheduled (optional, zero reach); fix B298 parts (1) and (3) narrowly in g18. | g18 | g18, g25 |
| D19 | B104: retry once with the g18 grid, or record RESIDUAL now (two failed attempts, zero reach)? | One retry after B106's discriminator lands; any HEAD-correct row broken means RESIDUAL. | g19 | g19 |
| D21 | B140 and B196: keep format-gated divs a phantom with no target format and record a non-active format's from: reader as a limit, or pass the editor's preview target into src/core (an adapter change) to model removal and the tabset-label answer? | Keep the phantom and record the limit; revisit only if a preview target can reach src/core. | g26 | g26, g27 |
| D23 | B330: mirror Posit's three-way quarto.symbols.exportToWorkspace with R-package detection? | Yes (small; mirrors Posit since v1.127.0), after the other groups. | g35 | g35 |
| D25 | B367: revisit the 13 notebook-renderer divergences at all (the record says only if a real document hits one)? | No; close as accepted unless a notebook hits one; if yes start with parts (2), (3), (9), (12). | g37 | g37 |
| D26 | Parked needs-decision records (B172, B277, B279, B281's hover bullet, B289, B340, B509, B557): answer when convenient? | None blocks a group; B279 gates B308, B509 gates B505 part (e); raise B557 in g16 only if wanted. | none (no group needs it) |  |
| D27 | The operator-named gaps format-name checks (B263, B273, B275, B334) and _metadata.yml coverage (B265) sit at g12 and g13, after the false-positive groups g10 and g11, about 57 sessions in. Pull g08, g12 and g13 ahead of g10 and g11? | No: a false positive on correct work is the cardinal sin (P7), so g10 and g11 first. The hard graph allows g09, g08, g12, g13, g10, g11 if the operator reorders; say so at the start of g10. | g10 | g10, g11, g08, g12, g13 |

## The order at a glance

| # | Group | Name | Features | Sessions | Hard prerequisites | Decisions | Status |
|---|---|---|---|---|---|---|---|
| 1 | g01 | Sweep pins: cell-header literals | ROBUSTNESS-PERF, CELL-OPTIONS | 2 | — | — | closed (Session 316, 1 session) |
| 2 | g02 | Slow-input sweep (in flight, Sessions 311-314) | ROBUSTNESS-PERF | 11 | — | — | open (fifteen sessions done: Session 317, B88 part (8); Session 318, B88 part (7); Session 319, B89 parts (5)+(9); Session 320, B89 part (4); Session 321, B89 part (3); Session 322, B89 part (8); Session 323, B89 part (6a); Session 324, the Session 317 item's part (1); Session 325, its part (2) with the Session 319 item's part (3); Session 326, its part (3) with the `{` half of the Session 311 item's part (6); Session 327, the `$` half of that part; Session 328, the Session 311 item's part (3); Session 329, the Session 311 item's part (5), found already closed and pinned; Session 330, the Session 318 item's parts (2) and (3); Session 331, the Session 319 item's part (1)) |
| 3 | g03 | Record hygiene: stale prose, drains, duplicates | DOC-RECORD | 5 | — | D2, D3 | open |
| 4 | g04 | Test and build tooling, advisories, repo safety | TOOLING-BUILD | 4 | — | D5, D6 | open |
| 5 | g05 | Preview lifecycle and format parsing | PREVIEW-RENDER | 3 | — | D7, D8 | open |
| 6 | g06 | .Rmarkdown activation and language registration | ACTIVATION-SCOPE | 2 | — | — | open |
| 7 | g09 | validate-yaml: false escape hatch | YAML-VALIDATION | 9 | — | D8, D9, D10, D11 | open |
| 8 | g10 | Document engine override resolution | ENGINE, CELL-OPTIONS, OUTLINE-MODEL | 8 | g09 | D8, D9, D12, D15, D27 | open |
| 9 | g11 | Cell-option validation scope | CELL-OPTIONS | 5 | g10 | D1, D13 | open |
| 10 | g08 | YAML separator and value-slot grammar consolidation | YAML-VALIDATION, YAML-COMPLETION, CELL-OPTIONS | 4 | — | D8 | open |
| 11 | g12 | Separator consumers: arm token, empty slot, links | YAML-VALIDATION, YAML-COMPLETION, CELL-OPTIONS, OTHER | 5 | g09 | D1, D8 | open |
| 12 | g13 | Project-config value validation | YAML-VALIDATION | 7 | g09, g08 | D8, D9, D14 | open |
| 13 | g14 | Knitr silence rule completion | OUTLINE-MODEL, XREF | 10 | — | D8, D9, D15, D16, D17 | open |
| 14 | g15 | Cross-reference label index: remaining families | XREF | 10 | g14, g10 | D1, D8, D15, D17 | open |
| 15 | g17 | Raw TeX macro blocks and environments | OUTLINE-MODEL | 6 | — | D1, D15 | open |
| 16 | g16 | List and definition containers: columns, markers, runs | OUTLINE-MODEL | 9 | g17 | D1, D15 | open |
| 17 | g18 | Fence grammar | OUTLINE-MODEL | 10 | — | D1, D15, D18 | open |
| 18 | g19 | Fences inside containers and the container-relative interrupt | OUTLINE-MODEL | 6 | g16, g18, g15 | D15, D19 | open |
| 19 | g22 | Leaf blocks: stacked enders and line blocks | OUTLINE-MODEL | 5 | g19 | D1, D15 | open |
| 20 | g24 | Kernel and knitr cell closing, engine view | OUTLINE-MODEL | 9 | g22, g15 | D8, D15, D17 | open |
| 21 | g25 | Fenced div attribute tokenizer and class dispatch | OUTLINE-MODEL | 8 | — | D9, D15, D18 | open |
| 22 | g07 | Front-matter and YAML-region boundary agreement | YAML-VALIDATION, OUTLINE-MODEL | 5 | — | D1, D15 | open |
| 23 | g20 | HTML comment tracking in scanRegions | OUTLINE-MODEL, XREF | 3 | — | D1, D8, D15 | open |
| 24 | g21 | Raw HTML blocks and tag lines | OUTLINE-MODEL | 5 | — | D1, D15 | open |
| 25 | g23 | Setext titles, dash rules and setext heading text | OUTLINE-MODEL | 6 | g16 | D1, D15 | open |
| 26 | g26 | Fenced div lifetime, callouts, tabsets, raw divs | OUTLINE-MODEL | 9 | g25, g16, g23 | D1, D15, D21 | open |
| 27 | g27 | Front-matter reader proof and non-active format | OUTLINE-MODEL | 6 | g09 | D1, D8, D15, D21 | open |
| 28 | g28 | CommonMark-family reader rules and closure | OUTLINE-MODEL | 5 | g18, g16 | D1, D15 | open |
| 29 | g30 | Heading text fidelity | OUTLINE-MODEL | 2 | — | D1, D15 | open |
| 30 | g31 | Cross-reference scanning tail | XREF | 3 | g16, g15 | D1, D15 | open |
| 31 | g32 | CLI spawn timeout and schema-source retry | ROBUSTNESS-PERF, YAML-COMPLETION | 3 | — | D8 | open |
| 32 | g33 | Embedded-language virtual-document lifecycle | EMBEDDED-LANG | 5 | — | D8 | open |
| 33 | g34 | Multi-selection formatting toggles | OTHER | 2 | — | D8 | open |
| 34 | g35 | Outline toggle and R-package workspace symbols | OTHER | 3 | — | D8, D23 | open |
| 35 | g36 | Reticulate execution routing | ENGINE | 3 | — | D8, D17 | open |
| 36 | g37 | Notebook-renderer pandoc fidelity | NOTEBOOK-RENDERER | 4 | — | D25 | open |

Deferred (Session 252 enumeration-only; not scheduled unless decision D1 lifts it): g29 (Block-quote container).

## Groups

### g01 — Sweep pins: cell-header literals

*Features: ROBUSTNESS-PERF, CELL-OPTIONS. Estimate: 2 session(s).*

**Scope.** Test-only. Pin the unpinned non-tail parts of the four code-cell header literals through public entries and commit a mutation runner, so the sweep's regex rewrites are protected. No src change.

**Why this place.** Pins precede the rewrites they guard. B88 parts (3) and (7) rewrite FENCE_OPEN, INDENTED_CELL_FENCE_OPEN and fenceMatchAt, whose group 3 the CELL_INFO and KNITR_CHUNK_INFO trims consume (model.ts 10623, 10679, 12867, 12915). The START_CODE_CELL and languagesInMarkdown pins guard g07's B192 and g10.

| Item | Role | Deferred | What |
|---|---|---|---|
| B90 The NON-TAIL parts of the four code-cell header literals are pinned by no unit test: a mutant of the leading whitespace run, th... | pin-first | no | Eleven mutants: four re-run survivors, seven reviewer-measured; one pin row each. |

**Done when.** All eleven mutants B90 lists (four re-run survivors, seven reviewer-measured) are killed by a new row GREEN on HEAD and RED under the mutant, or shown equivalent in writing; the mutation runner takes any mutant list and is tracked under tools/ with this list; git diff -- src is empty; npm test and check-types:unit pass.

**Verification.** `npm test`; `npm run check-types:unit`; `tracked mutation runner under tools/ (new, this group)`

**Surface.** vitest through public entries plus the tracked runner

**Cannot enforce.** Mutants outside B90's list; a survivor's equivalence is argued, not proved.

**First session.** Author the mutation runner and exact mutant list (the S313/S314 scripts are untracked); add rows for the four re-run survivors, expected values copied from the parent build.

**Outcome (Session 316, one session, not two).** Closed against its criterion. `tools/mutation-run/` (runner, 28-case self-test, 33-mutant self-check, README) and `test/unit/cell-header-literal-pins.test.ts` (76 rows); all eleven B90 mutants killed, `git diff -- src` empty. A two-workflow review (4 probe agents, 4 reviewers, 123 further mutants) widened it: 85 of those are killed by the pins, 25 by older files, 16 are argued equivalent and survive on purpose (`tools/mutation-run/mutants/`). It also refuted the session's own "E01 is equivalent" record, found the INDENTED_CELL_FENCE_OPEN gap g02's fence rewrites need, and found six runner defects. One finding is filed in g14 (the no-break-space direction of the knitr claim).

### g02 — Slow-input sweep (in flight, Sessions 311-314)

*Features: ROBUSTNESS-PERF. Estimate: 11 session(s).*

**Scope.** Finish the sweep, crash first: scanRegions RangeError on a 2.1M-character line, then fence patterns, closer scans, flowRegion, block scalars, braceGroups, findMathRegions, blank-run regexes, nesting depth, insideHtmlComment; end with one bounded terminal session. Estimate: 11 shapes at about one per session (B88 (7), B89 (5), (9) share a cause), the differential generator, the terminal session.

**Why this place.** Later groups rewrite these functions; make them linear once, first. Profile one shape before a family rule (the B89 trap).

**Soft prerequisites** (decide, re-measure or re-rank only):
- `g01` — B90's pins guard the fence and closer rewrites, B88 (3) and (7) only; B88 (8)'s crash row does not wait.

| Item | Role | Deferred | What |
|---|---|---|---|
| B88 What is still quadratic or deep enough to overflow after Session 311, every shape re-measured on the final tree (`066cfcc1`) an... | implementation | no | Parts (3)-(8): scanRegions crash first, then five quadratic shapes. |
| B89 Other regexes still quadratic on a long run of blanks, CR or U+2028 after Session 312: a sweep's list, the code-cell header tai... | follow-up | no | Parts (3), (4), (5)+(9), (6a), (8) measured and now closed (Sessions 321, 320, 319, 323, 322); (6b) stays a pin; (6c), (7) limits. |
| (filed Session 317) Nine more single-line overflow and slow-input families, none of them in Session 317's diff | follow-up | no | (1) exponential attribute atoms (CLOSED Session 324), (2) heading text quadratic (CLOSED Session 325), (3) native div quadratic, (4)-(9) regex-stack overflows of B88 (8)'s class. |
| (filed Session 318) Eight more regexes and one paragraph reader that are quadratic on a long line or a long paragraph, none of them in Session 318's diff | follow-up | no | (1)-(8) eight regexes (grid-table border, closing hashes, heading attribute, HTML tag strip, link definition attribute, knitr `options(` scan, YAML alias, `echo`/`include` reader), (9) the eager `titleLineCount` slice under `from: gfm`. |

**Done when.** Each measured shape (B88 parts (3)-(8); B89 parts (3), (4), (5)+(9), (6a), (8)) has a counter or doubling row RED on HEAD and GREEN after, and a small-n equality row RED under a mutant. Rewritten regexes have an exhaustive old-versus-new proof; every other rewrite (closer scan, flowRegion, braceGroups, findMathRegions, insideHtmlComment, block scalars, consumedCloserLine, fenceMatchAt) keeps the OLD function in the test and passes a seeded differential over generated fence, flow, brace, comment and block-scalar documents before removal. scanRegions returns on a 2,100,000-character line; B89 (6b) stays its pin (RESIDUAL, D1: unscheduled); the terminal session files ONE RESIDUAL record and the sweep stops. B105 (i) (consumedCloserLine quadratic over consecutive refused openers) closes with B88 (3).

**Verification.** `npm test`; `npm run test:oracle`; `npm run check-types:unit`

**Surface.** vitest counter rows, exhaustive regex-equivalence scripts, seeded old-versus-new differentials, oracle byte-identity

**Cannot enforce.** Other quadratic shapes (the sampler bounds, never proves); wall-clock timings under load.

**First session.** B88 part (8): RED row that scanRegions does not throw on one line of 2,100,000 '-', then '*' and '_'; profile with node --cpu-prof, rewrite the recursive pattern iteratively, prove old and new identical exhaustively. This session may run before g01: the crash row touches no header literal.

**Outcome of the first session (Session 317).** B88 part (8) is closed against its criterion, and it was five patterns, not one: `THEMATIC_BREAK`, `THEMATIC_BREAK_ANY_INDENT` (new, the CommonMark interrupt list's spelling), `BULLET_THEMATIC_BREAK`, `DASH_COLUMN_LINE` and `DASH_ONLY_LINE` all read a run as a quantified group, which costs V8's regex stack one entry per repetition (first overflow at 2,097,144 repetitions). Each is literal markers and a one-class tail now; the old spelling is the oracle in `test/unit/thematic-break-equivalence.test.ts` (every string of up to 7 characters, 100,000 seeded lines, a 194,400-line gap grid, 132 near-miss lines of 50,000 characters per pattern) and `pathological-inputs.test.ts` holds the document rows. Mutation: 51 pattern mutants, 49 killed and 2 argued equivalent; 4 wiring mutants, 3 killed and 1 argued equivalent (`tools/mutation-run/mutants/b88-thematic-break*.json`). The review round (5 agents) found two things the first draft missed: ambiguous tails that an enumeration cannot see (so the pin rows time a FAILING long line as well as an accepted one) and a CommonMark interrupt row nothing pinned. A parent-versus-HEAD differential over 342,528 documents found no difference.

**Filed during execution (Session 317):** the BACKLOG item "Nine more single-line overflow and slow-input families, none of them in Session 317's diff" (found by a sweep that ran 32% of its planned grid and a static pass over 540 regex sites; all pre-existing). Not yet counted in the totals above; estimate 3 to 5 more sessions for the group (parts (4) to (9) are part (8)'s class and cheap once a family rule exists; (1) to (3) need a profile first). The sweep's untracked harness is why the first session on it commits a seeded generator (rule P5).

**Outcome of the second session (Session 318).** B88 part (7) is closed against its criterion, and it was three patterns, not the `\s*$` tails the item named: `FENCE_OPEN`, `INDENTED_CELL_FENCE_OPEN` and `DIV_FENCE` read a run and then `(.*)$`, and a CR, U+2028 or U+2029 made the tail fail once per split of the run (one `exec` 6 s at 100,000 characters). Each run now ends in a lookahead (`(?!`)`, `(?!~)`, `(?!:)`); the old spelling is the oracle in `test/unit/fence-run-equivalence.test.ts` (31 tests: every string of up to 7 and of 5 characters over two alphabets, 100,000 seeded lines, a gap grid, near-miss lines at 1,000 and 50,000 characters, accepted lines of 5,000 to 200,000 characters, two enumerations for the blanks and prefixes the alphabets lacked) and `pathological-inputs.test.ts` holds 24 document rows (22 fail on the parent, 5.7 to 12.4 s each). Mutation: 36 mutants, 32 killed and 4 argued equivalent; the review's 17 more, all killed. The review round (5 lenses) found no semantic difference over about 120 million strings per pattern and 1.92 million documents, and found the test gaps (a `{3,4096}` cap, a vertical tab, a byte order mark, an oracle that could drift, a fourth call site, nine duplicate titles) that the fixes closed. `DIV_FENCE`'s blank tail stays with B89 part (5).

**Filed during execution (Session 318):** the BACKLOG item "Eight more regexes and one paragraph reader that are quadratic on a long line or a long paragraph, none of them in Session 318's diff" (found by a sweep of 545 regex sites and a 14,900-row timing pass; every shape was re-run firsthand at two sizes, and the long-paragraph cause was corrected by a profile). Not yet counted in the totals above; estimate 2 to 4 more sessions for the group on top of the Session 317 item's 3 to 5. Two older BACKLOG notes it contradicts were corrected in the same commit. Rule P5 stands: the first session on the filed items commits a seeded generator under `tools/`.

**Outcome of the third session (Session 319).** B89 parts (5) and (9) are closed against their criterion, and the item's list was a sample: fifteen patterns in five files plus a ` #` strip with three call sites, not the thirteen sites it named, and four of those named shapes were linear (`preview-format.ts:39`, `jupyter-kernel.ts:30`, `frontmatter.ts:77` for the shape given, `jupyter-kernel.ts:43` unreachable). Twelve patterns are a blank run and `(.*)$` and end the run in `(?![ \t])` (exact: the tail may be empty); `ATX_HEADING` and its tight reader are NOT exact under that idiom (`(.+)` must find a character: `#` and three blanks matches by giving a blank back) and ask once up front that the line holds no terminator; `PIPE_DELIMITER_ROW` is a different mechanism (two blank runs touched, so any ending character was quadratic) and was restructured; `TOP_LEVEL_ANCHOR_DECL` held two quadratics, the key one needing no terminator, cubic together; `cutHashComment` replaces `text.replace(/[ \t]#.*$/, "")` in three places. The old spelling is the oracle in `test/unit/blank-tail-equivalence.test.ts` (a table of 17 sites: enumerations, a seeded sample, a gap grid, near-miss lines timed at 50,000 characters, accepted lines to 200,000, foil characters; the strip has its own three enumerations) with 55 document rows in `pathological-inputs.test.ts`, all failing on the parent (5.5 to 22.3 s, median 6.0 s, against a 1 s limit). Mutation: 51 mutants (48 killed, 3 argued equivalent) and the review round's 77 (61 killed, 16 survive: 15 argued equivalent and one redundant). A parent-versus-final differential over 730,000 generated documents found no difference and did not see two of its six control mutants. The review round (4 lenses, 1.49 million subagent tokens, 20 billion comparisons with no semantic difference) found 43 test gaps, the lists of Sessions 316 and 318 that had silently stopped applying (26 mutants) and a dozen records errors, all fixed; it left a gate, `test/unit/mutation-lists-apply.test.ts`. `TABLE_RULE_ROW` still carries the old delimiter-row alternation (part (4)).

**Filed during execution (Session 319):** the BACKLOG item "More quadratic and stack-overflow shapes found by Session 319's sweep and review, none of them in its diff" (container columns, quoted openers, angle constructs, unanchored scans, regex-stack overflows; every shape re-run in a fresh process). Not yet counted in the totals above; estimate 2 to 4 more sessions for the group on top of the earlier items' 3 to 5 and 2 to 4. Rule P5 stands: the first session on the filed items commits a seeded generator under `tools/`.

**Outcome of the fourth session (Session 320).** B89 part (4) is closed against its criterion, and the item's list was a sample again: five sites (three patterns and the two calls of one strip), with shapes it did not name. `TABLE_RULE_ROW` had two quadratics that need no terminator (the pipe body's last cell, optional pipe and the shared `\s*` touch; the grid body's `[-+=: ]*` shares the space with `\s*`; a three-blank indent made it 4 times worse): the pipe body takes `PIPE_DELIMITER_ROW`'s spelling and the grid body is `\+(?:[-+=: ]*[-+=:])?`. `ATX_CLOSING` was an unanchored search that began with `[ \t]+` and was tried from every blank of a run: `(?<![ \t])` makes a run's first blank the only start (exact: a match from mid-run implies one from the run's first blank, so the leftmost never starts there; the index is compared too). The two `[ \t]+#.*$` strips of `knitrDocumentDefaults` became `cutHashComment(…, " \t").trim()` (quadratic on a plain blank run, on trailing blanks, on one hash and a terminator, and on ` #` pairs). `parseOutputPath` reads the marker's line once (`Output created:([ \t]*)(.*)`) and cuts the trailing blanks by a scan (the quadratic is real and unlikely: about 7,000 consecutive blanks on an `Output created:` line to cost 100 ms). The old spelling is the oracle in `test/unit/blank-tail-equivalence.test.ts` (two new sites appended LAST, since each site's seed is its position, and a strips entry) and `test/unit/output-created-equivalence.test.ts` (the old function, token enumerations of up to 6 pieces, a 100,000-output sample); 24 of the 118 new rows fail on the parent (19 document rows at 6.1 to 20.8 s, the guard row and the 50,000-character clock row of each of the two table entries, and the output file's clock row at 42 s); the other 94 compare the old spelling with itself or pin what must not change. Mutation: 76 mutants (73 killed, 3 argued equivalent in `tools/mutation-run/mutants/b89-closing-run.json`); two verdicts of the first draft were wrong and fixed (a cap on the first dash run survived a table with no long dash line; `[-+=:]+` was argued equivalent and is quadratic). A research workflow of four read-only agents on a pinned copy of the parent proposed the same cure for `ATX_CLOSING` and the knitr strips and a different spelling for `TABLE_RULE_ROW` (`[^\S ]`) and for `parseOutputPath` (an alternation); their comparers ran their own proposals, so the committed patterns were compared by the session itself (`TABLE_RULE_ROW`: 883,708,281, 153,391,689, 39,089,245 and 1,227,133,513 strings; `ATX_CLOSING`: 48 and 21 million; `parseOutputPath`: two enumerations of 597,871 sequences and 100,000 seeded outputs), with no difference. **Review round** (`wf_90077d8c-979`, five read-only lenses on a pinned copy, 1,454,540 subagent tokens): the equivalence lens found no difference in about 1.52 billion strings and 472,000 documents (25 control mutants; `TABLE_RULE_ROW` also proven equal by a product-automaton search); the mutation lens ran 124 more mutants and kept 19 real source mutants and 28 of 38 test-file mutants alive, the performance lens found no new quadratic; the records lens found 14 errors and the simplify lens 13 notes. Fixed: a one-code-unit sweep of every site, a later cell's dash run, four knitr rows (a form feed or a no-break space before the hash), nine `parseOutputPath` rows, guards on the two oracles, tests of the helpers, the output pattern respelled with `.`; 21 mutants added to the list. Not done, stated: the compare and slowest-line loops are copied again (S6), the seed is still a table position (S8, Learning 791), the magic divisors of the near-miss shapes (S10). Two gates were added: no raw U+2028 or U+2029 in `src/`, and the order of the SITES table. Nothing new was filed: the backslash run of `ATX_CLOSING_PANDOC` joins the Session 318 item, and `TABLE_RULE_ROW`'s group per cell (a stack overflow at 1,700,000 cells, unchanged) stays the Session 317 item's part (4).

**Outcome of the fifth session (Session 321).** B89 part (3) is closed against its criterion, and it was ONE site, not a list: the gap between `#|` and a cell option key in `indexLabels`, read by an unanchored `/[ \t]*$/.exec(...)` over the text before the key. The search is retried from every position, so a blank run that is not at the end of that text (the run between the `#` and the `|`) was scanned to its end from each of its blanks and then refused: 42 / 156 / 614 ms at 8,000 / 16,000 / 32,000 blanks and 5.98 s at 100,000 (load about 5; the item's own 43 / 161 / 628 held). `trailingBlanks` (`refs.ts`) takes the run from the Session 312 helper `trimEndBlanks`, which scans back from the end: 3.6 ms at 32,000, 8.2 ms at 1,000,000. The scan back is about 4 times the old search when the gap itself ends in a very long run (140 ms against 35 at 50,000,000 blanks), the trade the helper already carries. The old spelling is the oracle in `test/unit/cell-option-gap-equivalence.test.ts` (58 tests: every string of three alphabets, 488,281 / 137,257 / 299,593; 100,000 seeded texts; every UTF-16 code unit alone, after, before and between blanks; near-miss clock rows at 20,000, 50,000 and 1,000,000 blanks; 31 behaviour rows through `indexLabels`: the fold and compare lines, long gaps, a list item, CRLF; a sentinel for its own limit, sizes and alphabets) and `pathological-inputs.test.ts` holds 7 document rows (6 fail on the parent at 6.0 to 6.8 s against a 1 s limit; the control passes). Mutation: 14 mutants, all killed; the review round's 34 (17 killed by the rows added after it, 17 argued equivalent and recorded as surviving). A parent-versus-HEAD differential over 800,000 documents found no difference and could not see its NBSP control (the call site only ever hands the helper blanks, so the unit enumerations pin that). **Review round** (`wf_43a50d7c-b48`, four read-only lenses on a pinned copy, 973,248 subagent tokens): the equivalence lens reported no difference in about 108 million strings and 3.1 million document and engine pairs, with edited copies of the helper (a first run, spaces only, an off-by-one, a cap) as visible controls; the performance lens found no new superlinear site in 817 shapes and 554 regex sources, every one it re-found already in BACKLOG; the mutation lens ran 190 mutants and found five test gaps, each reproduced with the project's runner before it was closed: the fold and compare lines (a gap that contains a space, a fold capped at 2, a tab as 8 columns, a step of one, parity), a 4,096-character window on the prefix, a helper that keeps the old search under 40,000 characters, blank classes outside the alphabets (U+2003, U+200B, U+1680), and the file's own constants; 8 rows and one more near-miss size closed them; the records lens found wrong text (a load-60 timing, `trimEnd()` said to strip U+0085, a title, two descriptions). Not done, stated: the document rows' limit is pinned by a sentinel, not by its use (a row weakened tenfold survives; only vitest's 5 s default timeout would still fail the parent's 6 s), and `run.py` cuts a failing title at 160 characters, which hides which Session 321 row failed. Nothing new was filed; the ATTR_ATOM_RUN item gained its cold-start note.

**Outcome of the sixth session (Session 322).** B89 part (8) is closed against its criterion, and it was ONE function for all six entries: `midDocumentMetadataBlocks` asked `insideHtmlComment` for each YAML block below the front matter, and that scanned every line from the top (blocks x lines). `htmlCommentOpenAt(lines)` keeps how far it has read and whether a comment was open there; the blocks of a document arrive in strictly increasing order of start line, so each line is read once between them, and a line before the position read to starts again from the top (production never asks it), which keeps the old function's answer for any line in any order. `findHeadings` on the item's shape (6 lines a block, fresh process, load about 5): 87 / 235 / 742 / 2,892 / 10,511 ms at 1,000 to 16,000 blocks before (the item's 2.9 s held), 199 ms at 8,000 and 2,189 ms at 128,000 after (about 2x per doubling); all six entries match. The old function is the oracle in `test/unit/html-comment-open-equivalence.test.ts` (56 tests: three enumerations of 488,281 / 349,525 / 55,987 documents, 100,000 seeded documents, a row that regions are asked in increasing order, linear and repeated-ask clock rows, 18 `findHeadings` rows with answers taken from the parent, and a sentinel for the file's limits, sizes and alphabets) and `pathological-inputs.test.ts` holds 12 document rows (11 fail on the parent at 2.7 to 5.0 s against 1 s; the control passes). Mutation: 31 edits, 29 killed and 2 argued equivalent. The five-lens review found no difference in 10 million call pairs and 5.7 million exhaustive documents, seven test gaps (11 mutants, 8 of which survived the first rows), and 12 wrong statements in text, all fixed.

**Outcome of the seventh session (Session 323).** B89 part (6a) is closed against its criterion, and it was ONE function: the ancestor climb of `nestedParentPath`, which `findNestedFrontMatterValueLines` asks for every nested line. It climbed every ancestor of the line, reading each one's whole indent twice (two anchored regexes) and prepending its key, so a line `d` levels down cost `d` hops of `d` characters: cubic in the depth while the text grows with its square. Given an index, each content line's chain of containers is built once from the chain of its nearest shallower line and kept in `index.chains` (a linked list, so chains share their tails; no recursion, because a pasted file can be 12,000 levels deep). One key per level, `findNestedFrontMatterValueLines`, fresh process, two runs each, load 8 to 10: the parent 27 / 57 / 252 / 1,512 to 1,585 / 10,485 to 10,791 ms at 200 / 400 / 800 / 1,600 / 3,200 levels (the item's 1.2 s at 1,600 and 8.5 s at 3,200 held, at load 40: 1,203 and 8,262 ms), the fix 19 / 27 / 54 / 142 / 498 to 522 ms; 800 levels and 8,000 siblings 6.3 to 7.0 s before and 0.8 s after. `resolveDocumentEngine`, `collectValueSources` and `valueFlags` pay the same cost, because they call it, and fall with it. The old climb is the oracle in `test/unit/container-chain-equivalence.test.ts` (50 tests: every document of up to five lines over eight kinds of line, 37,448 documents, and of six lines over seven, 117,649; 4,000 seeded random walks; 12,024 staircases of up to twelve levels under twelve roots broken by eleven lines at each position; every line asked in three orders through one index, a fresh one and none; the counts of what was asked were derived by arithmetic first and match; a wrong oracle must be reported) and the cost is pinned as lines READ, which does not move with the load: 400 of 401 for a 400-level staircase against 160,400 on the parent. `pathological-inputs.test.ts` holds 9 clock rows (RED on the parent at 5.3 to 16.4 s; the limit is 2,500 ms), `nested-values-index-call.test.ts` counts that the enumerator builds one index and passes it. Mutation: 45 edits, 41 killed and 4 argued equivalent. **Review round** (`wf_7b847a93-d5c`, five lenses and a critic, 1,561,995 subagent tokens, 324 tool calls, about 6 hours of wall time at load 4 to 52): no input on which the new answers differ from the old (318,000 generated documents, 19.6 million asks, 12 deep and wide documents, 1,920,000 odd asks, 3,382 authored documents), no path array shared between entries, 15 source edits that every pin file let through (all shown surviving, all killed now), a comparison loop that could not fail, read bounds with slack, a limit with 1.4 to 1.9 times of headroom, and wrong statements in text (nine from the records lens, three from the simplify lens), fixed where they sit in files and listed in the ledger where they sit in commit messages. Not done, stated: merging the two branches of `nestedParentPath` (a smaller design, but it changes the completion path and 11 mutants' texts); caching a path array per chain link (a trunk of 800 with 64,000 siblings needs a 512 MB old space; the parent needed more).

**Outcome of the eighth session (Session 324).** The Session 317 item's part (1) is closed against its criterion, and it was ONE pattern, wider than the item said. `ATTR_ATOM_RUN` read `-`, `#id` and `.class` atoms under a `+`, and an id's tail and a class's tail both hold `.` and `-`, so a token whose last character is wrong was tried under every split: exponential in the classes (cold, one fresh process each, load about 5: 276 / 1,094 / 4,326 / 17,230 ms at 22 / 24 / 26 / 28; warm 30 / 115 / 455 ms at 22 / 24 / 26), twice as heavy after an id, base 3 with a dash after each class, and QUADRATIC for a run of dashes after an id or a class (100,000: 12.3 s, a shape the item did not name), on all seven routes that judge an attribute block (a heading, a backtick and a tilde fence info string, an image, a span, a div). The cure is the same language written as its shape, `^(?!$)-*(class)?(#id)*$` (dashes, at most one class, then ids), exported for the oracle: 30 classes take 2.7 ms cold (load 18), 100,000 dashes after an id 10 ms, linear to 1.6 million characters (the performance lens). The old alternation is the oracle in `test/unit/attr-atom-run-equivalence.test.ts` (3,040,592 strings over three alphabets, accepted counts taken by a recogniser that uses no regular expression, `tools/attr-atom-count/count_accepted.py`; 100,000 seeded tokens counted by its port of the generator; every BMP code unit in six positions; 21 near-miss shapes at 20,000 / 50,000 / 1,000,000 characters; 9,000,000 dashes) and `pathological-inputs.test.ts` holds 19 document rows (12 fail on the parent at 3.7 to 12.3 s against 1,000 ms, answers equal; the 7 controls pass). Mutation: 50 edits in `tools/mutation-run/mutants/s317-attr-atom-run.json`, 46 killed and 4 argued equivalent. **Review round** (`wf_f4782c7f-c93`, five read-only lenses on a pinned copy, about 27 minutes, 200 tool calls, 923,678 subagent tokens): no input on which the new answers differ from the old in about 58 million strings, 120,000 random-block documents and an exact product walk of two automata; the cure confirmed linear by an independent timing of about 60 shapes; four language-preserving mutants of the id loop that every committed row let through (an optional dash, dot, digit or `[_:]` after the id's tail: reproduced here, five rows added, all killed); and the records lens's wrong statements (a '74-byte' figure that is 68, a false 'by luck' example, 'the first five rows' for six, a title that read backwards), fixed where they sit. Not done, stated: the ids are still a quantified group, so a token of about 3.36 million ids (`#a`, 6.7 million characters) throws `RangeError` as before (the Session 319 item's part (5), now with its bisected boundary; a class-first token shifts it by one repetition); `headingAttributeTokens` builds a token a character at a time (about 115 bytes resident a character: a 6 MB heading line peaks at 694 MB; the performance lens's measurement, not re-run); the commonmark arm of `headingAttributeId`'s `atoms` is unobservable (the mutation lens, B03: every token reaching it is already valid); `test:integration` NOT run. Nothing new was filed.

**Outcome of the ninth session (Session 325).** The Session 317 item's part (2) is closed against its criterion, together with the Session 319 item's part (3) (the same function; the operator's standing directive of Session 315 put both in one session), and the item's attributions were wrong for two of its four shapes. A bare `{` run and a bare backslash run are not `headingContentRefused`: their time is in `HEADING_ATTRIBUTE` and `ATX_CLOSING_PANDOC` (the Session 318 item's parts (2) and (3), still open; a bare backslash run needs no brace or hash for either: 64,000 took 2,668 ms in `findHeadings`). The scan itself was quadratic on thirteen shapes (warm, load 3 to 6: a backtick x 64,000 5.6 s, `[` x 64,000 5.6 s, `\a[` x 32,000 4.8 s, `<a` x 64,000 8.3 s, `<!--` x 32,000 8.8 s, and the rest), because an opener with no closer read to the end of the line and answered "one character on". The cure is a per-line `HeadingLine` whose tables are built once: backtick runs filed by length, the end of every bracket group from one stack pass, the last search that found nothing for each marker, a right-to-left table of the first `>` outside quotes. 32 rows in `pathological-inputs.test.ts` (22 fail on the parent at 3.4 to 10.5 s against 1,000 ms on the clock alone, 9 controls and guards pass there, the 200,000-CDATA row is held by a mutant; every row 31 ms or less now); the old functions, copied by script and checked against the parent on 1,000,000 strings, are the oracle in `test/unit/heading-scan-equivalence.test.ts` (4,338,975 enumerated strings, 500,000 seeded, 51 hand-stated rows, twelve escapable-and-gate variants); 76 mutants (65 killed, 11 argued equivalent), 22 invented by the review (all killed after the new rows), 1 killed only by the older suite. **Review round** (`wf_b711409d-bcc`, six read-only lenses on the committed tree, 68 minutes, 303 tool calls, 1,186,325 subagent tokens): no input on which the cure differs from the parent in about 2.15 billion position-level comparisons, 18 million seeded ones and 210,000 documents through the public readers; nothing superlinear left in the scan over 2,765 shapes; 22 real test gaps (near-miss tokens, three needles of seven tokens, four call sites with no clock row, a variant rotation that followed the last token), reproduced here and closed; the records lens's nine wrong statements, fixed where they sit. Not done, stated: the tables are built at the FIRST question (about 1 us more on a heading with a link; `endsHtmlBlock` 1.6 to 1.8 times: filed); transient memory about 24 bytes a character (150,000,000 `[` threw `RangeError`); the sweep's unrun 68% (rule P5) belongs to the terminal session by the operator's decision of this session; `test:integration` NOT run.

**Filed during execution (Session 325):** the BACKLOG item "The heading scan builds a table at its FIRST question, which costs a short line a constant and `endsHtmlBlock`'s one-shot call 1.6 to 1.8 times" (Polish / deferred; measured by the design lens, with its untried-in-tree cure). Not counted in the totals above; an optional polish, not a measured defect of the sweep.

**Filed during execution (Session 322):** the BACKLOG item "More superlinear shapes found by Session 322's sweep, none of them in its diff" (a per-cell-option-line region lookup in `collectValueSources`, cells x regions: 5.8 s at 64,000 of each; two extensions: a mid-document `from: gfm` starts the paragraph slowdown, and valid nested flows are quadratic like the unclosed ones; each re-run firsthand at load 7 to 8.6). Not yet counted in the totals above; estimate 1 to 2 more sessions for the group on top of the earlier items' 3 to 5, 2 to 4 and 2 to 4. Rule P5 stands: the first session on the filed items commits a seeded generator under `tools/`.

**Outcome of the fifteenth session (Session 331).** The Session 319 item's part (1) is closed against its criterion, and the cause was the item's hypothesis, confirmed by a profile before the cure was read: `computeRegions` kept the container columns in three parallel arrays, and a line that opens a column and pops nothing (`: a`, `~ a`, `  : a`, `> : a`, `[^1]: a`, `A. a`, `I. a`, `aa. a`) left one more entry, which every per-line reader then scanned. 16,000 lines of each shape took 3.9 to 4.1 s on the parent (fresh process, cold, load 7 to 10) and take 55 to 65 ms now, 64,000 lines 145 to 170 ms; `findAllCells`, `indexLabels` and `buildOutline` fall with it; `~ a` under `from: commonmark_x`, cubic on the parent (5.2 s at 1,500 lines), now costs what plain paragraph lines cost (203 / 744 / 2,842 ms at 1,500 / 3,000 / 6,000 against 189 / 682 / 2,603), which is the Session 318 item's part (9). The cure is `ColumnStack` (`src/core/qmd/column-stack.ts`): the entries and their order as before, each question answered from an aggregate kept at push and pop, the helpers handed a cached array of the distinct columns (proved set-only twice: two blind classifications, and the whole suite and 20,000 documents with every helper given a deduplicated, reversed array). `test/unit/column-stack.test.ts` holds the class against the plain arrays (every sequence of up to four operations, 83,521, and 15,000 seeded ones), `column-stack-wiring.test.ts` 31 document rows with the parent's answers, and `pathological-inputs.test.ts` 24 rows (20 RED on the clock alone at 2.5 to 4.0 s against 1,000 ms before the cure, 18 to 38 ms after, and one relative `commonmark_x` row). A parent-versus-cure differential found 0 differences in 600,000 generated documents, and its controls showed it was blind to 3 of 9 deliberate breakages, which aimed searches then found witnesses for. Mutation: 80 edits, 77 killed and 3 argued equivalent; the five-lens review (`wf_24338eb5-04f`) found 0 differences in about 24.5 million documents, 12 test gaps (20 of its 40 edits survived: 12 killed by rows added after it, 8 argued or unwitnessed), and 15 wrong statements in text, all fixed. Left open and recorded in `BACKLOG.md`: the paragraph scan under `commonmark_x`, a per-line cost in the number of DISTINCT columns open (750 nested bullets then 40,000 `: a` lines 0.8 s), and a copy of the columns at each quote entry. The cure also removes a `RangeError` the parent threw when a block quote opened over a very deep stack (a spread into call arguments; 16,000 entries at `--stack-size=100`, about 115,000 at the default by extrapolation, not verified).

### g03 — Record hygiene: stale prose, drains, duplicates

*Features: DOC-RECORD. Estimate: 5 session(s).*

**Scope.** Doc corrections, then drain verified-completed parked records (B189, B222 with pointer B206, B338, B449, B455, B511, B515, B541, B559, B563, B579) and fold duplicates (B451 and B547 into B535; B513 into B115 part (3)) in the same commit; each claim re-verified, CHANGELOG entry first. Also commit B289's 67-byte witness under test/fixtures (B267's policy) and correct B297 (m)'s stale records. About four records per session.

**Why this place.** No code dependency; early drains stop later sessions redoing closed work. Fold-then-drain avoids the Session 195 trap (a duplicate's unique clause lost).

**Decisions needed:** D2, D3

| Item | Role | Deferred | What |
|---|---|---|---|
| B122 The oracle corpus is 131 documents and its prose says 66 | cleanup | no | Delete six hard-coded 66s against a 131-document corpus. |
| B248 `CONTEXT.md` records the language-support decision as "awaiting operator ratification" — 175 sessions later | cleanup | no | CONTEXT.md still says awaiting ratification. |
| B370 `docs/POSIT-COMPARISON.md` understates notebook-renderer parity (PRE-EXISTING, LOW). | cleanup | no | POSIT-COMPARISON denies the shipped notebook-renderer contribution. |
| B143 RECORD — SEVEN DECIDED questions about what the Outline shows, so a future session does not re-derive them | cleanup | no | Lead says 'all six'; seven decisions recorded; record stays. |
| B232 RECORD GAP — Session 180 reported three items as "filed, not fixed" and none of them reached this file | cleanup | no | File the five blank_before_header phantoms as one record, owner g27. |
| B230 DOCUMENTATION DEFECT: `SETEXT_H1`'s docstring claims we match quarto by declining the ATX-swallow, and the claim is refuted | cleanup | no | SETEXT_H1 docstring contradicts code; decision stays with g23. |
| B206 ⚠ RECORD-HYGIENE FINDING, verified firsthand but NOT acted on: the `rawTexMacroLineIsBlock` item below is a COMPLETED record, a... | cleanup | no | Pointer: verify the rawTexMacroLineIsBlock block per claim; drain with B222. |
| B183 ⚠ RECORD-HYGIENE FINDING, verified firsthand but NOT acted on: TWO duplicate clusters in this file | decision | no | Merge footnote duplicates into B535; B585 is the superseded lead: re-measure or drain. |
| B267 51% of the `scratchpad/` paths cited by TRACKED documents no longer exist, and two are findings documents cited by committed pl... | decision | no | Policy for dangling scratchpad citations; commits B289's witness. |

**Done when.** check-backlog and npm test pass; the six sites that said 66 (README five, load.ts one) state no hard-coded count (git grep -nw 66 on those two files is empty); B248, B370 and B143 stale claims are fixed; B232's five phantoms are filed once (owner g27); the SETEXT_H1 docstring matches the code; each drain has a CHANGELOG entry written first; the unique clauses of three duplicates (label only: B451, B547, B513) now live in B115 or B535 (label only); B289's witness is a tracked fixture; B297 (m)'s stale 'from: dialect' part (c) is re-verified and corrected.

**Verification.** `npm run check-backlog`; `npm test`; `git grep -nw 66 -- test/oracle/README.md test/oracle/load.ts (the six sites)`

**Surface.** check-backlog gate, backlog-hygiene unit test, grep

**Cannot enforce.** A completed block worded as an open defect hides open decisions from check-backlog; only per-claim reading catches it.

**First session.** B122: delete the six hard-coded 66 mentions (README five, load.ts one); confirm 131 from corpus.ts; leave baseline.json and corpus.ts history alone; npm test green.

### g04 — Test and build tooling, advisories, repo safety

*Features: TOOLING-BUILD. Estimate: 4 session(s).*

**Scope.** Settle the scratchpad ignore rule, type-check the vitest configs, report excluded scorer documents, bump the six dev-only advisory packages and record the 2-to-6 change, dedupe the integration EXTENSION_ID, rename a dishonest test, decide the .vscode-test size.

**Why this place.** Repo safety first; the bump precedes the record so the record is final; type-check coverage gates later test-config edits.

**Decisions needed:** D5, D6

| Item | Role | Deferred | What |
|---|---|---|---|
| B178 ⚠ `scratchpad/` IS UNTRACKED BUT NOT IGNORED, so a single `git add -A` stages ~85,000 files and ~2.4 GB into a commit | decision | no | git add -A would stage about 85,000 scratchpad files. |
| B250 The two root-level vitest config files are type-checked by no tsconfig project | cleanup | no | Both vitest configs sit in no tsconfig. |
| B218 `FRONTMATTER_CLOSE`'s `...` terminator makes a document quarto REFUSES TO RENDER score as a divergence | cleanup | no | Scorer skips non-zero-exit rows but does not report the count. |
| B304 New `npm audit` advisory: `fast-uri` 3.1.2 — high, DEV-ONLY | cleanup | no | Deliberate dev-only fast-uri bump; never npm audit fix --force. |
| B271 `npm audit` went 2 → 6 advisories and no document in the repo records the change | cleanup | no | Record the 2-to-6 audit change after the bump. |
| B359 De-duplicate the integration `EXTENSION_ID` constant | cleanup | no | 34 integration files hold their own EXTENSION_ID. |
| B354 Honest test name for the math-preview "re-render on edit" integration test | cleanup | no | Rename the math-preview re-render test to what it proves. |
| B269 `.vscode-test/` is 18 GB — 7.2× `scratchpad/` — and being gitignored it has NO visible signal at all | decision | no | .vscode-test is 18 GB; test/lsp pins no VS Code version. |

**Done when.** D5 recorded (applied if adopted); check-types fails on a planted error in each vitest config; git grep 'const EXTENSION_ID' test/integration finds only the shared module; npm audit names none of the six packages or states each survivor; npm run package passes with the file list unchanged; docs/SECURITY-AUDIT.md states the measured count; score.py prints the excluded count (no tracked gate sees it: REALDOC_DATA is personal, so one run on the operator's machine is the record); D6 recorded.

**Verification.** `npm run check-types`; `npm run compile-tests (type-checks the integration suite)`; `npm test`; `npm run check-package`; `npm run package`; `npm audit (npm CLI, needs network)`; `npm run test:integration (optional; go-ahead per P8)`

**Surface.** tsc, vitest, check-package, the vsce package pipeline

**Cannot enforce.** Runtime behaviour; npm audit needs network; WebStorage clearing's effect on test runs is unmeasured.

**First session.** B178: put the one-line .gitignore choice (D5) to the operator, record the answer in methodology/CHANGELOG.md, apply it after checking nothing depends on git status listing scratchpad/.

### g05 — Preview lifecycle and format parsing

*Features: PREVIEW-RENDER. Estimate: 3 session(s).*

**Scope.** Extract the close and startup-reservation policies into a vscode-free core module (preview.ts imports vscode), then fix the two reproduced defects: closing a Git diff of a previewed file kills the preview, and a different-format request during startup is dropped; plus nested flow collections in format:.

**Why this place.** Small, reproduced, independent; the pure policy comes first so RED rows run headlessly.

**Decisions needed:** D7, D8

| Item | Role | Deferred | What |
|---|---|---|---|
| B324 Preview lifecycle: closing a non-`file:` editor (e.g. a Git diff) for a previewed document silently kills the live preview | implementation | no | Closing a git: diff of a previewed file kills the preview. |
| B326 `previewFormat`: nested flow collections in `format:` + a differing-format request dropped during preview startup | follow-up | no | Startup guard ignores the requested format; nested flow collections split naively. |

**Done when.** A unit row on the extracted close policy shows a git: or untitled: close never disposes a file-keyed session (RED first); a different-format request during startup follows D7 (RED first); parseFlowCollection keeps nested flow collections whole; one integration row (preview, open the Git diff, close it, preview still alive) is recorded OPEN until the operator approves the run.

**Verification.** `npm test`; `npm run compile`; `npm run test:integration (go-ahead per P8)`

**Surface.** vitest on extracted pure policies plus one integration row

**Cannot enforce.** Real preview-process timing and the VS Code diff-editor lifecycle without the screen-taking run.

**First session.** B324: extract onDocumentClosed's decision into a pure core function gated on uri.scheme; RED row for a git: URI; then fix features/preview.ts and check preview, previewFormat, previewScript.

### g06 — .Rmarkdown activation and language registration

*Features: ACTIVATION-SCOPE. Estimate: 2 session(s).*

**Scope.** Register every spelling document-engine.ts treats as an R Markdown input in contributes.languages and the workspaceContains glob. Ground quarto's side per spelling under a DISTINCT stem in its own throwaway directory, one render at a time (macOS is case-insensitive; B212: rendering an .rmarkdown input exits 1 and deletes it). Registration needs no successful render.

**Why this place.** One declarative change after a grounding session; no engine-group dependency.

| Item | Role | Deferred | What |
|---|---|---|---|
| B212 An `.Rmarkdown` file never activates this extension at all, so the `.Rmd` scope S170 shipped is unreachable there | implementation | no | Only .qmd, .rmd, .Rmd are registered; document-engine handles .rmarkdown. |

**Done when.** Each spelling (.rmarkdown, .Rmarkdown, .RMarkdown, .RMD) has a recorded quarto answer from its own directory, by document-engine.ts's with-and-without 'cache: banana' technique plus a no-code control (a lowercase .rmarkdown cannot render, per B212); a unit pin shows documentEngineForScoping treats each like .Rmd; every spelling quarto claims as knitr is registered in languages and the glob; test/unit/package-activation.test.ts expects each spelling in contributes.languages extensions AND in a workspaceContains glob (globs match case-sensitively, so each spelling needs its own entry), written RED before package.json changes; the case-distinct language-id test is one integration run, OPEN until approved.

**Verification.** `npm test (test/unit/package-activation.test.ts is the gate that goes red: edit its expectations first)`; `npm run test:integration (go-ahead per P8; case-distinct language-id row)`

**Surface.** vitest plus one integration registration test

**Cannot enforce.** Real .Rmarkdown corpora (zero in the 3,383-document corpus); VS Code language-id matching without the approved run.

**First session.** B212: copy a small .Rmd to a distinct stem per spelling, each in its own throwaway directory; render one at a time with and without '#| cache: banana' plus a no-code control; record exit codes against document-engine.ts's table; add the unit pin; no package.json change yet.

### g09 — validate-yaml: false escape hatch

*Features: YAML-VALIDATION. Estimate: 9 session(s).*

**Scope.** Honour validate-yaml: false wherever quarto does (format sub-key, anchored, tagged, aliased, _quarto.yml's own flag in the two project features) without stripping a node property (!!str false exits 1). Build the YAML node resolver as a no-import leaf; the adapter half opens by extracting the project-config gate into src/core (D8). Settle the 26 pandoc-validated keys. Estimate 9 includes the D9 seam (7 if no).

**Why this place.** False positives first: B258 (a)-(c) and B254 (a) need only the leaf and wait behind no refactor; B254 (b)'s cheap half ships unconditionally; B258 (d) needs enumerator emission, so g12 owns it; member-document suppression waits on D9; the lost true positive B256 is last.

**Decisions needed:** D8, D9, D10, D11

| Item | Role | Deferred | What |
|---|---|---|---|
| B258 Four YAML spellings of `validate-yaml: false` disarm quarto and we keep squiggling | prerequisite | no | (a) anchor, (b) tag, (c) alias need the leaf resolver; (d) next-line value is g12's. |
| B254 The `validate-yaml` escape hatch reaches a document from THREE places we still do not read, and per-format resolution can re-ar... | implementation | no | (a) format sub-key false positive; (b) _quarto.yml's own flag is cheap; member documents (b), (c) wait on D9. |
| B256 `validate-yaml: false` does NOT suppress the 26 top-level keys PANDOC validates, and S163's document gate silences all of them | decision | no | 26 of 170 top-level keys still exit 1 under validate-yaml: false. |

**Done when.** A tracked quarto 1.7.33 fixture holds root, format: html:, per-format true over root false, _quarto.yml itself, _metadata.yml, the four node spellings, a duplicate-anchor row (&a true, then &a false, then validate-yaml: *a; first and last binding disagree) where the leaf binds the MOST RECENT anchor or declines when a name is bound twice, !!str false versus !!bool 'false', and the 26 keys; diagnostics are silent wherever quarto exits 0 (the 26 keys follow D11); yaml-node.ts is a leaf with an import-graph test; the extracted pure project-config gate runs in vitest, and _quarto.yml carrying the flag is silent in both _quarto.yml features (one integration row, OPEN until approved); .qmd member-document suppression follows D9; B258 (d) is g12's.

**Verification.** `npm test`; `npm run check-types:unit`; `npm run test:integration (go-ahead per P8; adapter row only)`

**Surface.** vitest over a tracked quarto fixture; one integration row for the adapter wiring

**Cannot enforce.** Multi-root workspaces and nested projects; pandoc-version variance of the 26 keys; adapter wiring without the approved run.

**First session.** B258: build src/core/qmd/yaml-node.ts (anchor, tag, alias, next-line resolution; failure direction a parameter) test-first against a rendered matrix of validate-yaml spellings, with a test pinning that it imports nothing.

### g10 — Document engine override resolution

*Features: ENGINE, CELL-OPTIONS, OUTLINE-MODEL. Estimate: 8 session(s).*

**Scope.** Pin all four handler-language lists, then make documentEngineForScoping (shared by five providers, D8) match quarto's engine selection for flow, node-property, ordered and include spellings so an {r} cell never gets a cardinal false positive; decide the include-expanded language set.

**Why this place.** Pins first (B92), false positives (B240) before lost true positives (B242), B210 last because it needs reads and a decision.

**Hard prerequisites** (code or a committed fixture must exist):
- `g09` — yaml-node.ts leaf resolver and anchor table, consumed for anchored, tagged and aliased engine spellings.

**Decisions needed:** D8, D9, D12, D15, D27

| Item | Role | Deferred | What |
|---|---|---|---|
| B92 Nothing pins `CELL_HANDLER_LANGUAGES` to quarto's two handler languages: a third one survives every unit test | pin-first | no | Pin CELL_HANDLER_LANGUAGES and its three sibling lists. |
| B240 The FLOW spellings of the `engine:` override are honoured by quarto and invisible to us | implementation | no | Flow engine spellings render exit 0 but we keep flagging. |
| B242 Node-property spellings of the override, and the truthy values L6/L7 deliberately gave up | follow-up | no | Node-property and block-scalar spellings: two lost true positives. |
| B244 A project `engines:` list reorders quarto's selector loop and we cannot see it | implementation | no | engine: versus execute.engine: is decided by document order. |
| B210 An `{{< include >}}` makes the document's language set unknowable, and the DECLINE we chose keeps a measured cardinal false pos... | decision | no | Include shortcode makes the language set unknowable; needs D12. |

**Done when.** A tracked quarto 1.7.33 fixture holds flow, indented-flow, column-0 sequence, engine versus execute.engine order, anchored, tagged, aliased, block-scalar and include rows; for an {r} cell with '#| cache: banana' our decision equals quarto's (exit 0 under markdown, 1 under knitr) on every row; the two measured lost true positives are flagged; project engines: lists stay an 'ambiguous' decline; each pinned handler list rejects any language outside its own set (the two ojs lists allow ojs), by looping lang-comment-chars; include rows follow D12; B112 part (6)'s rendered rows (adv/L4/L4_019, 020, 022-025, 037; headings compared with findHeadings) are GREEN or RESIDUAL (D1: unscheduled); the knitr-no-execute fixture and the label-index suites show no heading or label moves from a resolver change.

**Verification.** `npm test (including the knitr-no-execute fixture and label-index no-move rows)`; `npm run test:oracle`; `npm run check-types:unit`

**Surface.** vitest over a tracked fixture plus the oracle

**Cannot enforce.** Project-level engines: lists and extension engines; include reads in a real multi-file project.

**First session.** B92: loop cellOptionScopeFor over every lang-comment-chars language except mermaid and dot (plus typst) asserting none is 'none', and the same through the three sibling lists' public entries; RED by adding a third language in a scratch copy.

### g11 — Cell-option validation scope

*Features: CELL-OPTIONS. Estimate: 5 session(s) (+3 if the deferral is lifted).*

**Scope.** Ground the old-knitr option-format guess first (a possible live false positive), then flag only what quarto flags in a handler cell of a knitr document, per key and never by widening the scope: include yes; cache, echo, include: false no. If promoted: raw {=html} cells, grammar before consumers.

**Why this place.** B260 first (false positive, one render set); B252 per key because widening the handler scope is the cardinal sin; B589 touches every cell consumer, so last.

**Hard prerequisites** (code or a committed fixture must exist):
- `g10` — B92's pinned handler-list rows (the four lists) that the per-key scope change must keep green.

**Decisions needed:** D1, D13

| Item | Role | Deferred | What |
|---|---|---|---|
| B260 An `{r}` cell whose leading option block quarto guesses as OLD-KNITR format is never validated, but we flag it | pin-first | no | Possible live false positive; 18 documents hold the shape. |
| B252 A KNITR document validates a handful of chunk options in a cell-HANDLER cell, and S162's `"none"` scope deliberately gives one... | implementation | no | include: banana in a {dot} cell of a knitr document exits 1. |
| B589 Raw `` ```{=html} `` / `` ```{=latex} `` blocks ARE validated by quarto, and we still enumerate none of them | implementation | yes | Raw {=html} blocks are validated; CELL_INFO grammar first, consumers later. |

**Done when.** A tracked sweep fixture renders the 47 flaggable keys in a {dot} cell of a knitr document and of an engine: markdown document; only include: banana is newly flagged, every other row (cache: banana, echo: banana, include: false) stays silent, and layout: banana stays a recorded pre-existing lost true positive; an {r} cell whose option block a rendered grid shows quarto guesses as old-knitr is silent exactly when quarto exits 0; npm test and test:oracle pass.

**Verification.** `npm test`; `npm run test:oracle`; `npm run check-types:unit`

**Surface.** vitest (cells, yaml-value-flags) plus oracle rows

**Cannot enforce.** Run Cell and the virtual-document language map in a real window.

**First session.** B260: render {r} cells whose option block has no colon, no leading whitespace and lines ending in commas or holding =, with '#| echo: banana' variants; commit quarto's exit code per shape before touching any suppression.

### g08 — YAML separator and value-slot grammar consolidation

*Features: YAML-VALIDATION, YAML-COMPLETION, CELL-OPTIONS. Estimate: 4 session(s).*

**Scope.** Part A, no behaviour change (B357): route slotsOf, valueSlotAfterColon and mappingContainerKey's whole-value comment test through one import-free helper per rule, behind a differential pin over the enumerators' emitted raw tokens. Part B, a stated change (B300): project-links' mappingColonIndex takes the shared whitespace rule, with its own rendered row. keySpanAt and mappingContainerKey keep first-colon KEY semantics until g12 (B302 (b), B328) and g13 (B334, B591). B89 (6b), a different whole-line comment rule that ADDS flags, is not part of it.

**Why this place.** The grammar is the producer for g12 and g13, which add flags on it; consolidating once lets them land on one grammar. It follows the false-positive groups g09 to g11 because nothing there needs it.

**Soft prerequisites** (decide, re-measure or re-rank only):
- `g02` — Re-run g02's size rows after the consolidation.

**Decisions needed:** D8

| Item | Role | Deferred | What |
|---|---|---|---|
| B357 Consolidate the YAML value-slot grammar between `yaml-context.ts` and `model.ts` | prerequisite | no | slotsOf and valueSlotAfterColon are byte-identical; share one leaf helper, adding mappingContainerKey and keySpanAt. |
| B300 The YAML key/value-separator grammar is implemented TWICE | prerequisite | no | mappingColonIndex accepts any whitespace after the colon; use the shared rule. |

**Done when.** slotsOf, valueSlotAfterColon and mappingContainerKey's comment test call one exported helper per rule (git grep: one definition per rule); a differential over a generated slot grid AND the raw tokens the front-matter, nested and project enumerators emit shows Part A byte-identical to the parent, and goes red when the shared call is removed in a worktree; Part B changes answers only on rendered rows, listed; keySpanAt's and mappingContainerKey's first-colon answers are pinned unchanged; B89 (6b) untouched; npm test, check-types:unit and test:oracle pass.

**Verification.** `npm test`; `npm run check-types:unit`; `npm run test:oracle`

**Surface.** vitest differential rows plus the oracle

**Cannot enforce.** That new modules will not re-grow a private grammar; completion in a real editor window.

**First session.** B357: add the test-only differential for slotsOf and valueSlotAfterColon over a generated slot grid and the enumerators' raw tokens; pin keySpanAt's and mappingContainerKey's first-colon answers; write the shared-leaf design note for plan-mode approval (D8).

### g12 — Separator consumers: arm token, empty slot, links

*Features: YAML-VALIDATION, YAML-COMPLETION, CELL-OPTIONS, OTHER. Estimate: 5 session(s) (+2 if the deferral is lifted).*

**Scope.** On g08's grammar: make the cell-option arm token use the real separator (a live false positive, PROMOTED out of the deferral); stop an empty value slot abutting a comment gluing 'true#' (insert-text rule extracted to core first); teach the key enumerator key::; take B258 (d), validate-yaml's next-line value; make the _quarto.yml link scanner flow- and quote-aware. If promoted: B595.

**Why this place.** B593 first (a live false positive; it needs g08's separator rule); B342 is an insertion bug; B302, B328 and B258 (d) are safe false negatives or silences; B595 shares the helpers and follows.

**Hard prerequisites** (code or a committed fixture must exist):
- `g09` — src/core/qmd/yaml-node.ts, consumed by B258 (d) (validate-yaml's next-line value).

**Soft prerequisites** (decide, re-measure or re-rank only):
- `g08` — Part A's value-slot helper, if B342 reuses it; mappingColonAt and isMappingSeparator already exist in yaml-context.ts.

**Decisions needed:** D1, D8

| Item | Role | Deferred | What |
|---|---|---|---|
| B593 Quoted-KEY on the `#\|` cell-option surface — a lost TP that is BLOCKED on the cell arm-token grammar | implementation | no | PROMOTED: the arm token uses the first colon, a live false positive on a bare folded key; quoting stays deferred. |
| B342 Empty value slot abutting a trailing inline comment can glue value to comment | implementation | no | Empty value slot before a comment glues 'true#'. |
| B302 Separator fix residual: two false-negative classes, both on quarto-REJECTED documents | implementation | no | Teach the key enumerator the 'key::' separator rule. |
| B328 `_quarto.yml` document-link scanner: flow-collection and pathological-quoted-key value shapes | follow-up | no | Link scanner: flow collections and a quote-aware colon. |
| B595 Quoted keys diverge in three non-diagnostic readers and in YAML completion | follow-up | yes | Quoted keys in frontmatter, preview-format, completion. |

**Done when.** '#| a:b: "text' then '#| echo: banana"' is silent where quarto renders exit 0 (rendered first); accepting a value completion on an empty slot before '#' yields 'key: true #' in a vitest row on the extracted insert-text function (RED first), its provider wiring one integration row, OPEN until approved; 'type:: html' under project: is flagged as quarto's exit 1; a next-line validate-yaml: false is silent; chapters and opts links yield per-element links; no row moves where the parent agreed, and the knitr-no-execute fixture and the label-index suites show no heading or label moves (the arm token feeds cellOptionLinesOf); npm test and test:oracle pass.

**Verification.** `npm test`; `npm run test:oracle`; `npm run check-types:unit`; `npm run test:integration (go-ahead per P8; completion row)`

**Surface.** vitest plus oracle rows and one completion integration row

**Cannot enforce.** Completion in a real editor window and the provider wiring without the approved run.

**First session.** B593: render the bare folded-key shape ('#| a:b: "text' then '#| echo: banana"') and a quoted twin under quarto 1.7.33, add the RED row on findCellOptionLines, then make the arm token use the existing mappingColonAt and isMappingSeparator (yaml-context.ts).

### g13 — Project-config value validation

*Features: YAML-VALIDATION. Estimate: 7 session(s).*

**Scope.** Open by extracting the project-value arms and gate (resolveProjectValueField and the per-arm compute) into src/core (D8). Enter anchored and quoted project:/website:/book: headers, lift the one-level enumerator caps, add sequence-item descent, check container-key and mapping-form format names, then widen the gate to _metadata.yml scoped to document keys, format: and execute:.

**Why this place.** One enumerator edited once: entry, caps and descent, new emission, then the new file. Each ADDS flags, so each needs false-positive grounding and follows the false-positive groups.

**Hard prerequisites** (code or a committed fixture must exist):
- `g09` — The extracted project-config gate and its validate-yaml: false rows, before the gate widens to _metadata.yml.
- `g08` — The shared comment and value-slot helper that B334 and B273 reuse (Part A); the key-separator behaviour stays g12's and g13's own.

**Decisions needed:** D8, D9, D14

| Item | Role | Deferred | What |
|---|---|---|---|
| B334 YAML schema diagnostics: an anchored or quoted `project:`/`website:`/`book:` container header silently disables scanning of tha... | implementation | no | Anchored or quoted project: header disables the block scan. |
| B275 Sequence-form `navbar:`/`sidebar:` grandchildren | prerequisite | no | Sequence-item descent in the enumerator. |
| B273 DEPTH-3+ `_quarto.yml` project-config values | implementation | no | Lift the one-level children and path-length caps. |
| B263 Validate the scalar `format:` NAME on the remaining surfaces + polish (S145 §4.3 deferrals) | implementation | no | Container-key and mapping-form format names (D14). |
| B265 The project-value diagnostics feature does not cover directory-level `_metadata.yml`/`_metadata.yaml` | implementation | no | Widen the gate to _metadata.yml with field-set scoping. |
| B591 Quoted-KEY divergence — the CONTAINER half (the leaf half SHIPPED Session 159) | follow-up | yes | Label only: the same mappingContainerKey fix as B334; verify its rows, not scheduled alone. |

**Done when.** Valid and invalid project fixtures with quarto 1.7.33 exit codes, run in vitest on the extracted arms, cover anchored and quoted headers (label only: B591's quoted containers), depth-3 values, sequence-form grandchildren, container-key and mapping-form format names, and _metadata.yml document, format and execute keys: invalid ones are flagged once at the exact range, valid ones silent; validate-yaml: false in _metadata.yml or _quarto.yml stays silent; a rendered row (_quarto.yml validate-yaml: false plus _metadata.yml format: banana) is followed, or recorded as a D9-gated limit; project: keys in _metadata.yml are neither flagged nor offered; the adapter wiring is one integration row, OPEN until approved.

**Verification.** `npm test`; `npm run check-types:unit`; `npm run test:integration (go-ahead per P8; project diagnostics)`

**Surface.** vitest over committed project fixtures plus one integration run

**Cannot enforce.** Multi-project workspaces elsewhere; fields quarto accepts that have no schema entry.

**First session.** Extract resolveProjectValueField and the per-arm compute from features/yaml-project-value-diagnostics.ts into a pure core function with characterisation rows (plan-mode approval, D8); then B334 starts with a RED fixture: 'project: &p' above 'type: banana' renders exit 1 and is not flagged.

### g14 — Knitr silence rule completion

*Features: OUTLINE-MODEL, XREF. Estimate: 10 session(s).*

**Scope.** Pin the one deleting hazard with no row, then close header-borne code channels (deleting), chunks inside containers, decline rules, executing-reading defects and host gaps. ONE pure core function resolves the render mode (setting plus D16's execute: rules); indexLabels takes it and the providers call it (D8). Ten sessions: nine parts about one each, plus the tracked model-column rewrite script (P5); B95's pin shares session 1.

**Why this place.** Completes the Session 308-310 thread against a warm tracked measure; B95's pins protect B86's predicates; settling indexLabels' signature here lets g15 edit it once.

**Soft prerequisites** (decide, re-measure or re-rank only):
- `g02` — Re-run g02's size rows if scanRegions changes.
- `g09` — If D9 is yes, project-level opts_chunk rows become closable.

**Decisions needed:** D8, D9, D15, D16, D17

**Filed during execution (Session 316):** the BACKLOG item "`knitrClaims` trims the info string with JavaScript's `trim()` ..." (the no-break-space direction of the knitr claim; LOW; measure with quarto black-box first, then one row per character).

| Item | Role | Deferred | What |
|---|---|---|---|
| B95 R6 residuals — what the positively-established silence rule leaves at HEAD's answer | pin-first | no | Pin redefined & (no row); F rebound and opts_hooks already pinned. |
| B86 What the Outline's silence rule still gets wrong after Session 310: it can now be read for `--no-execute`, and what is left is... | implementation | no | Nine parts: header-and-pipe channel (deleting), containers, mode, decline rules, host pins. |

**Done when.** knitr-no-execute-fixture.test.ts is a ONE-WAY ratchet on two named pairs: the no-execute reading against quarto's --no-execute headings (r5 vs r4: right >= 668, hiding <= 27) and, as a NEW row at HEAD's values, the executing (default) reading against quarto's executing headings (r6 vs r3: right >= 542, hiding <= 70); the existing right(6) = 376 and hiding(6) = 178 (default reading vs the no-execute render) stay as written contrast and move only in a commit that says why. Model columns are rewritten by a tracked script that re-reads each row's stored document, never by regen.py (which would overwrite the engine column of knitr-print-noexec). The redefined-& hazard is a RESIDUAL row in the qmd-model R6 block; each hiding row is named by id; indexLabels(text, engine, mode) exists with a core row and providers/crossref.ts passes it (one integration row, OPEN until approved); renderMode has a pinned resource scope and README row; D16 and D17 applied or recorded; P6 bound.

**Verification.** `npm test (the fixture ratchet, both pairs)`; `the tracked model-column rewrite script (new, this group; score_modes.py --fixture needs untracked paired renders)`; `npm run test:integration (go-ahead per P8; resource scope and the crossref wiring row)`

**Surface.** vitest over the tracked 707-pair fixture and its ratchet

**Cannot enforce.** Project-level opts_chunk and real execution output; the personal corpus is never a gate.

**First session.** B95: pin the redefined-& hazard as a RESIDUAL row in the qmd-model R6 block (the fixture's constants would move), add the r6-vs-r3 ratchet row at HEAD's values (542, 70), add the P6 counting test (RESIDUAL titles prefixed 'RESIDUAL (deleting)' counted against a recorded baseline), make regen.py refuse knitr-print-noexec; list the 27 hiding rows by id; no model change.

### g15 — Cross-reference label index: remaining families

*Features: XREF. Estimate: 10 session(s) (+3 if the deferral is lifted).*

**Scope.** Rebuild the witness set first (the 174 Session 301 hunt documents are gone), then the cheapest families: engine: markdown guard (7b), blank first line (4), U+2028 (8), engine-resolver header labels (9), YAML spellings (2), engine-dependent grammar (5), --no-execute via g14's mode (1)(ii), lost spellings (1)(iv)-(v); plus the attribute-only heading id B185. About 1.1 families per session after the rebuild.

**Why this place.** After its producers: the mode parameter (g14) and the engine resolver (g10); g09's node resolver serves part of family (2). B185 rides here because it is scored on the index too.

**Hard prerequisites** (code or a committed fixture must exist):
- `g14` — indexLabels takes the render mode.
- `g10` — resolveDocumentEngine fixes (B240-B244) that family (9) consumes.

**Soft prerequisites** (decide, re-measure or re-rank only):
- `g09` — yaml-node.ts serves family (2)'s anchor, tag, alias and next-line spellings; block scalars, flow mappings and escaped keys are g15's own.
- `g11` — B260's old-knitr guess decides which option lines the index may read.

**Decisions needed:** D1, D8, D15, D17

| Item | Role | Deferred | What |
|---|---|---|---|
| B84 What the cross-reference LABEL INDEX still gets wrong after Session 305 — families (2) to (10), every row rendered; family (1),... | implementation | no | Ten families; 335 agree, 58 phantoms, 32 lost at Session 301; the hunt must be rebuilt. |
| B185 A heading whose text is ONLY a valid attribute block is reported as no heading at all, and its `sec-` id is lost with it | implementation | no | '# {#sec-x05}' reports no heading and loses its sec- id. |
| B491 A `}` inside a QUOTED attribute value defeats `[^}]*`, so the whole literal is reported for a heading quarto renders cleanly | follow-up | yes | A } in a quoted attribute value defeats the strip. |
| B481 Only the LAST of two attribute blocks is stripped, and under `commonmark_x` a closing hash run after the block defeats the stri... | follow-up | yes | Only the last of two attribute blocks is stripped. |
| B483 `commonmark_x` rejects a NON-ASCII key and this model accepts it, deleting text the reader sees | follow-up | yes | commonmark_x rejects a non-ASCII key. |

**Done when.** A rebuilt seeded fixture (test/fixtures/xref-label-families, quarto 1.7.33) records HEAD's agreement as the baseline, held by a ratchet row (agreements never fall, phantoms and lost never rise); families (2), (4), (5), (7b), (8), (9), (1)(ii), (1)(iv), (1)(v) rise with no row worse than the parent or are RESIDUAL pins; (3), (6), (6b), (1)(iii), (10), (7) remainder (plain scalar continued or with space, nested label, repeated label, non-cell language tokens; measured rows k22, k31, k36, b15, p05, p09, p10, p12, o04, m05, e01, u01) and (1)(i) (sub-families alpha to eta named) are filed in B84 as RESIDUAL, owner D1: unscheduled, except g19 re-scores (6b)'s list-item fence rows and g24 (6)'s closer-indent rows; '# {#sec-x05}' agrees in findHeadings and indexLabels. P6 bound.

**Verification.** `npm test (the ratchet row and refs tests)`; `npm run check-types:unit`

**Surface.** vitest over refs tests, a tracked fixture, the oracle

**Cannot enforce.** Agreement over the personal 1,368-label corpus (never a gate); run-time-generated labels.

**First session.** Rebuild the hunt: a seeded generator from B84's family lists, seeded by scratchpad s301/probes, s303/hunt, s305/grid1 and the tracked knitr-header-shapes, no-target-shapes and cell-label-kinds fixtures; render once at <= 3 concurrent; commit generator and answers as test/fixtures/xref-label-families; record HEAD's counts; no src change. Record the deleting-RESIDUAL baseline (P6).

### g17 — Raw TeX macro blocks and environments

*Features: OUTLINE-MODEL. Estimate: 6 session(s) (+2 if the deferral is lifted).*

**Scope.** Close the raw-TeX heading losses (multi-line arguments, environments, lookalikes), the arity-tolerant tail rule and the environment interior skip. B216 family (b), the container content column, is handed to g16; B110's HTML-tag parts go to g21; quote rows stay RESIDUAL. About four losses per session.

**Why this place.** Deleting direction with 23 measured losses (B216) and the one tail construct present in 132 authored documents (B214); neither needs list columns, so it precedes g16; the interior skip is last.

**Decisions needed:** D1, D15

| Item | Role | Deferred | What |
|---|---|---|---|
| B216 23 residual heading losses in four families, none of them Session 188's | implementation | no | Deleting: 23 losses in four families; family (b), the container column, is g16's. |
| B214 The raw-TeX TAIL family behind the paragraph bail — ~50 residual phantoms, and the obvious fix is MEASURED DELETING three real... | follow-up | no | 132 documents hold the tail construct; the obvious rule deletes headings. |
| B110 The raw-block swallow family is UNBOUNDED in construct space, and it now includes a DELETION shape | implementation | no | No interior skip for environments such as tikzpicture and minipage. |
| B447 A CLOSED raw-TeX environment with a paragraph OPEN above it is treated as a block, and pandoc does not interrupt the paragraph | follow-up | yes | Closed environment under an open paragraph treated as a block. |
| B561 Three residual phantoms: an indented class-A macro inside a raw region this scanner does not track | follow-up | yes | Multi-line code-span, RCDATA and CDATA region state. |

**Done when.** A tracked fixture (test/fixtures/raw-tex, quarto 1.7.33) holds B216 families (a), (c), (d), family (b)'s 7 rows for g16, B214's tail witnesses (clearpage and prose, vspace*{1em}, vspace2, newcommand{foo}{bar}) and interior witnesses (tikzpicture, minipage, table, figure, lstlisting, algorithm, a user-defined environment); findHeadings agrees on every row except family (b) or it is a named RESIDUAL under P6; the three guarded macros stay blocks; B298 part (7)'s raw-TeX-environment rows are rendered here; B110's HTML-tag trigger and unclosed script/textarea rows are g21's.

**Verification.** `npm test`

**Surface.** vitest over a tracked fixture plus committed LaTeX probes

**Cannot enforce.** The open set of user-defined environments and macros.

**First session.** B216 family (a): render the eight multi-line-argument rows (argument closing on a later line, space before the brace, optional bracket), add RED rows, then span the argument to its closing brace. Record the deleting-RESIDUAL baseline (P6).

### g16 — List and definition containers: columns, markers, runs

*Features: OUTLINE-MODEL. Estimate: 9 session(s) (+10 if the deferral is lifted).*

**Scope.** Settle the container-maintenance block once: footnote and definition column (base + 4), letter and roman markers by reader (ONE flag beside commonmarkDialect gating push and pop), the single-capital initial, one column per marker on a line, the sibling marker, B105 part (g)'s tab half and B216 family (b). Quote-in-list rows are RESIDUAL (D1: unscheduled). Eight to nine parts, about one per session.

**Why this place.** B208 is the smallest deleting item with measured witnesses (its reach is the 1,265-document ground corpus) and edits the push site the marker items share; deleting before phantom before text.

**Hard prerequisites** (code or a committed fixture must exist):
- `g17` — test/fixtures/raw-tex family (b) rows, consumed for the container column.

**Soft prerequisites** (decide, re-measure or re-rank only):
- `g01` — The mutation runner takes any mutant list.
- `g02` — Re-run g02's size rows after the push-site edit.

**Decisions needed:** D1, D15

| Item | Role | Deferred | What |
|---|---|---|---|
| B208 A footnote or definition-list definition's content column is `base + 4`, NOT its own indent + 4 — so the same document is wrong... | implementation | no | Deleting: footnote and definition column is base + 4. |
| B164 ⚠ LETTER/ROMAN list markers are accepted by only THREE of the nine readers, and this model accepts them under all nine | implementation | no | Deleting: letter and roman markers open lists under three of nine readers. |
| B198 A multi-marker run (`- - - x`) opens ONE container content column where pandoc opens THREE | implementation | no | Deleting: '- - - x' opens one column, pandoc three. |
| B170 A list marker that shares its parent's LINE never opens the inner content column | follow-up | no | Deleting: wide same-line marker never opens the inner column. |
| B224 `A. x` — a single capital and EXACTLY one space — is not a list, and we open a container for it anyway | implementation | no | 'A. x' is an initial, not a list. |
| B166 ⚠ An ordered marker whose list is ALREADY OPEN above strips at EVERY underline column, and this build keeps it at an outer one | follow-up | no | Text: sibling ordered marker strips at every underline column. |
| B553 A list marker ABSORBED LAZILY into a definition body opens its content column relative to the DOCUMENT, not relative to that body | follow-up | yes | Lazy list in a definition body; rework with the quote container. |
| B537 A definition or footnote container inside ANOTHER container survives a shallow list start, and this model pops it | follow-up | yes | Nested definition or footnote container popped by a shallow list. |
| B535 An UNREFERENCED footnote definition is dropped from quarto's output entirely, and `contentColumns` still opens a container for it | implementation | yes | Unreferenced footnote drop via a [^label] scan; carries B451, B547 clauses. |
| B533 A definition-list body needs a TERM LINE above it, and `contentColumns` pushes a column for a bare `:` line with no term anywhere | follow-up | yes | Definition body needs a term line. |
| B411 ⚠ The container-pop half of the roman post-filter cannot be narrowed ALONE — the PUSH and the POP must narrow together | follow-up | yes | Roman push and pop must narrow together. |
| B419 An UPPERCASE letter with a PERIOD and ONE space is an initial in a name, not a list marker | follow-up | yes | Same arity rule at popsEnclosingContainer. |
| B581 `listItemContentColumn` accepts `[a-zA-Z]{1,9}` before a `.`/`)`, so ordinary PROSE opens a container column — and the filed `A... | follow-up | yes | Prose such as 'Mr. Smith' opens a marker column. |
| B415 `LIST_MARKER_PREFIX` carries only bullets and decimals, so a div fence behind an `a.`, `#.`, `iv.` or `(1)` marker is not seen | follow-up | yes | LIST_MARKER_PREFIX misses a./#./iv./(1) before a div fence. |
| B503 Six heading LOSSES Session 261's adversarial pass found beside the callout rule, none of them caused by it | implementation | yes | Heading on a list-marker line is lost. |
| B545 A bullet-spelled THEMATIC BREAK still pushes a container content column, admitting a heading below it | follow-up | yes | Bullet-spelled thematic break still pushes a column. |
| B425 Session 240's marker-KEPT column set `[0, ...outerColumns]` is missing a constant 2, and only a TWO-LEVEL stack whose INNER con... | follow-up | yes | Marker-kept column set misses a constant 2. |

**Done when.** A tracked grid (marker kinds by the nine readers; footnote and definition shapes; multi-marker runs; tab rows of B105 (g); B216 (b) rows) in test/fixtures/list-containers scores under npm test; letters and romans open lists only with no from:, markdown and commonmark_x, push (listItemContentColumn) and pop (popsEnclosingContainer) share ONE flag, and the guard row '-   outer / ixix. shallow / iv. shallow / ---' renders h2:shallow (label only: B411); zero deleted headings under commonmark_x; FAMILY B and C pins reversed in place, G2 green; the authored mutant list is killed; P6 bound.

**Verification.** `npm test`; `npm run test:oracle`; `tracked mutation runner (g01)`

**Surface.** vitest over a tracked grid plus committed adversarial rows

**Cannot enforce.** Unseen nestings (Session 189 measured 39 deletions when the stack moved); the personal corpus is never a gate.

**First session.** Author and commit the mutant list for listItemContentColumn and popsEnclosingContainer (run with g01's runner), record the deleting-RESIDUAL baseline, then B208: render FAMILY B and C, reverse their pins (RED), push base + 4 at the CONTENT_COLUMN_4_OPEN call site (GREEN).

### g18 — Fence grammar

*Features: OUTLINE-MODEL. Estimate: 10 session(s) (+1 if the deferral is lifted).*

**Scope.** Build a NEW seeded probe generator and committed render fixture from the item texts (the Session 276 probe set is gone; two sessions), then close the fence-opener defects: refused-opener closer pairing by exact run (consumedCloserLine), readers with no fence character, container-end closing under CommonMark readers, an unclosed longer fence, interrupts, B298's tag-rewrite causes. Twelve parts after the fixture, about 1.5 per session.

**Why this place.** The grid pins every fence change and g19's twice-failed work; deleting rows (B202, B108, B105 (b)-(d)) first. B105 (b) is a multi-line closer search, not a span primitive: maskInlineCode stays as is.

**Soft prerequisites** (decide, re-measure or re-rank only):
- `g16` — List-marker arithmetic settled first.
- `g02` — g02's size-doubling rows, re-run after B105 (b) changes consumedCloserLine.

**Decisions needed:** D1, D15, D18

| Item | Role | Deferred | What |
|---|---|---|---|
| B105 Pre-existing fence-grammar defects measured by Session 276's research -- each wrong at HEAD, independent of any fence bound, an... | prerequisite | no | Parts (b)-(h): (b) refused-opener closer pairing; (e) container-end closing; (f) knitr half; (g)'s tab half is g16's. |
| B202 An unclosed LONGER fence lets its inner SHORTER runs open a region, deleting the headings between them | implementation | no | Deleting: an unclosed longer fence opens regions from inner shorter runs. |
| B108 The reader branches the Session 277 paragraph-interrupt rule does not model, and its two DISCLOSED residuals | implementation | no | Deleting: strict, phpextra, -backtick_code_blocks never interrupt a paragraph. |
| B298 What P1's faithful tag rewrite UN-MASKED — 91 measured findings in eight PRE-EXISTING root causes, each at 0 corpus reach; on s... | follow-up | no | Eight causes: (1)-(3), (6) here; (4), (5) g19; (7) g17, g21; (8) RESIDUAL. |
| B555 Under `from: markdown_strict` a fenced code block does not exist at all, and we still open a region for one | implementation | yes | markdown_strict has no fenced code block yet we open a region. |

**Done when.** A tracked seeded generator under tools/ and a committed fixture of at least 1,200 probes (quarto 1.7.33) record a NEW baseline at HEAD; B105 parts (b), (c), (d), (e), (h), B202, B108 (a) and B298 parts (1), (2), (3), (6) each show RED to GREEN with zero HEAD-correct rows broken, or a RESIDUAL pin with its rendered answer; B105 (i) closes with g02's B88 (3); part (f) starts with one render grid (jupyter and markdown halves closed, Sessions 293-295; knitr is a no-oracle RESIDUAL); (g)'s roman half and B298 (8) are RESIDUAL (D1: unscheduled); g02's rows still pass; P6 bound.

**Verification.** `npm test`; `npm run test:oracle`; `tracked generator and cross-scorer under tools/ (new, this group)`

**Surface.** vitest plus a tracked headless cross-scorer over cached renders

**Cannot enforce.** Constructs outside the generated grid; Session 276's exact probes.

**First session.** Session 1 of the fixture: write the seeded generator from the item texts (B105, B202, B108, B298), not the B104 narrative, and review its coverage of each family; no render, no src change. Session 2 renders at <= 3 concurrent, commits answers and records HEAD's counts. Record the deleting-RESIDUAL baseline (P6).

### g19 — Fences inside containers and the container-relative interrupt

*Features: OUTLINE-MODEL. Estimate: 6 session(s).*

**Scope.** Recognise an indented fence at a list item's content column, apply the container-relative interrupt rule with a tight-versus-loose discriminator, close B298 parts (4) and (5), and make ONE bounded retry of the bare-fence-in-list-item and backtick-info rules Session 276 twice failed to ship.

**Why this place.** Needs g18's grid and g16's column arithmetic; B104 last, with an explicit go or no-go (D19) because it failed twice at zero reach.

**Hard prerequisites** (code or a committed fixture must exist):
- `g16` — listItemContentColumn arithmetic.
- `g18` — The tracked fence grid and fence prerequisites.
- `g15` — test/fixtures/xref-label-families rows for B84 (6b).

**Decisions needed:** D15, D19

| Item | Role | Deferred | What |
|---|---|---|---|
| B106 The paragraph-interrupt rule is CONTAINER-RELATIVE, and Session 277 shipped only the TOP LEVEL | prerequisite | no | Container-relative interrupt equality needs a tight-versus-loose discriminator. |
| B168 ⚠ An INDENTED fenced code block inside a list item is not recognised, so its contents are parsed as markdown | implementation | no | Indented fence in a list item is not recognised. |
| B104 A bare fence inside a list item, and a backtick fence whose info string holds a backtick, are fences to this model and not to p... | implementation | no | Deleting: bare fence in a list item, backtick-info fence; two attempts failed. |

**Done when.** The discriminator is isolated from fresh renders and pinned before any rule; the container-relative interrupt, the indented-fence rule and B298 parts (4), (5) flip their g18-grid rows to rendered answers with zero HEAD-correct rows broken, or are RESIDUAL under P6; B84 (6b)'s list-item fence rows (deeper than the item column, tab-indented) are re-scored from g15's fixture; B104 ships after ONE retry or is RESIDUAL per D19 (the old 626/622 bar is replaced by the g18 grid); B200 is drained; g18's grid re-run.

**Verification.** `npm test`; `npm run test:oracle`; `g18 cross-scorer`

**Surface.** vitest plus the g18 cross-scorer and a fresh rendered grid

**Cannot enforce.** Constructs outside the grid; the personal corpus is never a gate.

**First session.** B106: isolate the tight-versus-loose list-item discriminator from a fresh rendered grid (fence character x column x container x tight/loose) and pin it before writing any rule. Record the deleting-RESIDUAL baseline (P6).

### g22 — Leaf blocks: stacked enders and line blocks

*Features: OUTLINE-MODEL. Estimate: 5 session(s) (+3 if the deferral is lifted).*

**Scope.** Close the BlockBoundaries residuals: the one deleting stacked-enders row and its siblings, and the line-block continuation shapes. If promoted: link-reference spellings, an empty item's body as a simple-table header, the headerless simple table.

**Why this place.** B113's rows are already pinned RESIDUAL, so each flips mechanically; B117 (a) needs g19's container-relative discriminator.

**Hard prerequisites** (code or a committed fixture must exist):
- `g19` — g19's tight-versus-loose discriminator fixture, consumed by B117 (a) only.

**Decisions needed:** D1, D15

| Item | Role | Deferred | What |
|---|---|---|---|
| B113 Stacked block enders in the free case — what Session 298's rule still leaves, every row measured | implementation | no | Stacked enders: row (5) deletes 1 of 38,976; row (8) swallows a heading. |
| B117 Five shapes `lineBlockContinuationRefuses` deliberately leaves at HEAD's answer (Session 280) | follow-up | no | Deleting shapes (a), (c), (d); (a) needs g19's discriminator. |
| B575 17 PRE-EXISTING deletions surfaced by the same sweep, none of them Session 183's or 184's | implementation | yes | 17 deletions from link-reference spellings. |
| B417 ⚠ An empty item's BODY line is still eligible as a SIMPLE TABLE's header row | implementation | yes | Empty item's body line eligible as a table header. |
| B437 ⚠ A HEADERLESS pandoc simple table is still a construct this model does not have, so the line it eats is reported as a heading | follow-up | yes | Headerless simple table is not modelled. |

**Done when.** The Session 298 RESIDUAL rows (qmd-stacked-enders.test.ts) and the line-block rows are re-rendered into test/fixtures/leaf-blocks (quarto 1.7.33); deleting rows recover and phantom rows are fixed or re-pinned; B117 (a) uses g19's discriminator; B113 part (1), the container pop, is RESIDUAL (D1: unscheduled); every OPENS_FRESH_BLOCK change passes a two-directional score; P6 bound.

**Verification.** `npm test`

**Surface.** vitest over a tracked fixture plus committed probes

**Cannot enforce.** The unbounded space of table and block-start constructs.

**First session.** B113 row (5): render the grid-table, pipe-table, indented-dash-run document (the one deleting stack) and fix it, flipping its pinned RESIDUAL row. Record the deleting-RESIDUAL baseline (P6).

### g24 — Kernel and knitr cell closing, engine view

*Features: OUTLINE-MODEL. Estimate: 9 session(s).*

**Scope.** Verify B120 and B204 by render; then B112's open parts, deleting first: (2), (3)(b)-(e), (3)(g), (5), (9). Part (1) is a pinned CHOICE (no oracle); (4) is g16's, (6) g10's, (8) unmeasurable (julia absent), (10) record-only. Apply D17 to its open callers (Run Cell, cell background, vdoc language map) through one extracted pure function (D8). Nine sessions, parts paired by shared function.

**Why this place.** Two verifications first (may close with no code); deleting direction (P7), so it precedes the phantom groups; part (3)(c)-(e) re-uses g22's leaf-block rows.

**Hard prerequisites** (code or a committed fixture must exist):
- `g22` — test/fixtures/leaf-blocks rows that B112 part (3)(c)-(e) overlaps.
- `g15` — test/fixtures/xref-label-families rows for B84 (6)'s closer indent.

**Soft prerequisites** (decide, re-measure or re-rank only):
- `g10` — B112 part (6)'s rows now live in g10; re-run them if g24 changes the engine view.

**Decisions needed:** D8, D15, D17

| Item | Role | Deferred | What |
|---|---|---|---|
| B120 A cell tag no engine consumes is passed to pandoc verbatim — a zero-reach by-catch of the Session 265 re-score (report F7) | pin-first | no | Render '{r, echo=FALSE}' under engine: markdown; may close with no code. |
| B204 An unterminated CELL fence inside a BLOCK QUOTE makes quarto emit no headings at all, and we emit the one below it | pin-first | no | Cannot-tell: render the unterminated cell in a quote. |
| B112 Kernel-cell closing and the unbounded second look — what Sessions 293, 294 and 295's rules still leave: containers deeper than... | implementation | no | Ten parts, deleting first; (7) is D17, (8) unmeasurable, (10) record-only. |

**Done when.** B120 and B204 each have a rendered answer and a pin (fixed, closed, or RESIDUAL under P6); B112 parts (2), (3)(b)-(e), (3)(g), (5), (9) (eight probe shapes) are RED to GREEN or RESIDUAL rows with rendered answers, deleting first; part (1) is a pinned CHOICE; B84 (6)'s closer-indent rows are re-scored from g15's fixture; B112 part (6)'s rows are g10's; Session 293-295 suites stay green; the extracted D17 function is tested in vitest, and its Run Cell, cell-background and vdoc-map wiring is OPEN until the approved integration run, or the limit is recorded; test:oracle passes.

**Verification.** `npm test`; `npm run test:oracle`; `npm run check-types:unit`

**Surface.** vitest plus the oracle and tracked fixtures

**Cannot enforce.** Julia, extension handlers and {Julia} (no julia installed; R is).

**First session.** B120: render '{r, echo=FALSE}' under engine: markdown and the unspaced '{fortran95,eval=FALSE}' with a later fence, compare with the model, then pin or close. Record the deleting-RESIDUAL baseline (P6). Rows are rebuilt from the tracked RESIDUAL rows: the Session 293-297 harnesses are untracked.

### g25 — Fenced div attribute tokenizer and class dispatch

*Features: OUTLINE-MODEL. Estimate: 8 session(s).*

**Scope.** Re-render B132's Session 259 witness first (P3 shipped; the premise may be stale), then B141's deleting regex-route shapes (class= unread, odd escaped quotes, class after quote, ASCII lookahead, NBSP between classes, dot-fused pair, multi-line opener) and B297's deleting parts (a), (d), (e), (j); every other sub-part gets an owner or a RESIDUAL record. About 16 parts, two per session.

**Why this place.** Deleting direction with no list or container dependency, so it precedes the phantom groups (P7); witness re-render first, B297 the bounded tail. The optional fence-info slice (plan phase P4) is D18's decision.

**Soft prerequisites** (decide, re-measure or re-rank only):
- `g02` — Re-run g02's size rows if scanRegions changes.

**Decisions needed:** D9, D15, D18

| Item | Role | Deferred | What |
|---|---|---|---|
| B132 The attribute spec is matched with regexes and never TOKENIZED as pandoc tokenizes it, so an opener pandoc REFUSES is still rea... | implementation | no | P3 shipped; re-render the witness first, then (ii)-(iv) and grammar gaps. |
| B141 Div class-dispatch residuals the Session 290 adversarial pass measured, all PRE-EXISTING and all at zero corpus reach | implementation | no | Deleting regex-route rows (a)-(g), multi-line opener, nested-quote rows. |
| B297 Deferred by the attribute-tokenizer plan — every shape here is MEASURED and at 0 corpus reach; the evidence and each shape's wi... | follow-up | no | Parts (a)-(m): (a), (d), (e), (j) here; (f) is D18, (k) is D9, (m) is g03's; rest RESIDUAL. |

**Done when.** B132's witness is re-rendered under the default, markdown and CommonMark-family readers and pinned, not assumed deleting; test/fixtures/div-attribute-grammar (quarto 1.7.33) holds three rows per B141 family (a)-(g), the multi-line opener and B297 (a), (d), (e), (j); findHeadings agrees on every row or it is RESIDUAL under P6; other sub-parts have an owner (g26: theorem, tabset preamble, raw div; g03: B297 (m); B297 (f) and (k): RESIDUAL, D1: unscheduled, which a D18 or D9 answer may reopen) or a RESIDUAL record (D1: unscheduled; nested-quote rows).

**Verification.** `npm test`

**Surface.** vitest over a tracked quarto fixture plus committed adversarial rows

**Cannot enforce.** Project-level readers and quote-container rows; the personal corpus is never a gate.

**First session.** B132: re-render the Session 259 witness (a callout opener whose data-x value holds an unbalanced title quote) under the default, markdown and CommonMark-family readers (divOpenerRefused shipped in Session 282) and pin each answer; fix only a row that still deletes. Record the deleting-RESIDUAL baseline (P6).

### g07 — Front-matter and YAML-region boundary agreement

*Features: YAML-VALIDATION, OUTLINE-MODEL. Estimate: 5 session(s) (+2 if the deferral is lifted).*

**Scope.** Make quarto-yaml-regions.ts, FRONTMATTER_CLOSE and the Outline's front-matter scan agree with quarto on where front matter and YAML regions end: last-line ---, an indented fence inside a region, a --- claimed by a setext underline, and the one oracle row of unknown mechanism. Pin START_CODE and END_CODE before editing them.

**Why this place.** Phantom-direction, rare input, so it sits with the phantom groups. Measure first (B238, B187), pin START_CODE and END_CODE (B90 does not cover them), then B192, then docstrings.

**Soft prerequisites** (decide, re-measure or re-rank only):
- `g09` — B192 feeds the validation partitioner: re-run g09, g10 and g11's fixtures after it.
- `g02` — Region and block-scalar scans are already linear.

**Decisions needed:** D1, D15

| Item | Role | Deferred | What |
|---|---|---|---|
| B238 A `---` on the document's LAST line: our line split and quarto's disagree about whether the HR exemption applies | pin-first | no | One render settles the last-line --- exemption. |
| B187 A `---` that a setext underline has already claimed can still open a mid-document YAML metadata region here, stranding a phanto... | pin-first | no | Mostly closed by Session 272; render the '...' witness, pin or retire. |
| B192 The ported region grammar's `START_CODE` is anchored at column 0, where quarto tracks an INDENTED fence inside a YAML region | implementation | no | START_CODE anchors at column 0; quarto tracks an indented fence. |
| B234 One measured corpus row that `breakQuartoMd` alone does not explain | cleanup | no | Which pass validates the inner cell? Black-box renders only. |
| B587 `FRONTMATTER_CLOSE` accepts `...` as a front-matter terminator and quarto REFUSES TO RENDER such a document | decision | yes | FRONTMATTER_CLOSE accepts '...'; the region scanner does not. |
| B529 A blank or whitespace-only line immediately AFTER a LINE-0 opening `---` is still read as front matter, and quarto does not rea... | decision | yes | Blank after a line-0 '---' deletes a real h2. |

**Done when.** A committed quarto 1.7.33 fixture holds a last-line ---, an indented plain fence in a YAML region and an indented closer, and quartoYamlRegions agrees or the row is a named RESIDUAL; START_CODE and END_CODE mutants (leading space, closer indent) die; B187's witness is pinned or drained; B234's mechanism is in the docstrings, or after three discriminating render batches recorded as 'mechanism unknown'; g09 to g11 fixtures and oracle verdicts unchanged except named rows. P6 bound.

**Verification.** `npm test`; `npm run test:oracle`

**Surface.** vitest, the 131-document oracle, a tracked render fixture

**Cannot enforce.** Typing-time editor behaviour (needs observe:posit); mechanisms inside quarto-cli (clean-room).

**First session.** B238: render a trailing paragraph / blank / --- / EOF document with quarto and add the quartoYamlRegions row for the same bytes to a tracked fixture. Record the deleting-RESIDUAL baseline (P6).

### g20 — HTML comment tracking in scanRegions

*Features: OUTLINE-MODEL, XREF. Estimate: 3 session(s) (+3 if the deferral is lifted).*

**Scope.** Character-level comment delimiter tracking in scanRegions (shared by Outline, math regions and refs, D8), reusing the existing maskInlineCode so mid-line openers and closers agree with quarto. If promoted: the 4-space comment, the position-blind closer, a whole-line comment and an open paragraph.

**Why this place.** One tracker serves several rows; each consumer (outline, math preview, refs, citations) gets a regression row. Phantom direction, so after g24 and g25.

**Soft prerequisites** (decide, re-measure or re-rank only):
- `g18` — If B105 (b) alters inlineCodeSpans, re-run these rows.

**Decisions needed:** D1, D8, D15

| Item | Role | Deferred | What |
|---|---|---|---|
| B352 Mid-line HTML comments in `scanRegions` | prerequisite | no | Mid-line comments give false math positives and negatives. |
| B577 The comment region's `COMMENT_CLOSE` test is POSITION-BLIND, losing a heading after a comment with an unterminated sibling | implementation | yes | COMMENT_CLOSE is position-blind. |
| B517 An INDENTED `<!--` at 4 spaces is indented CODE, not a comment block, and the comment region does not look at the indent at all | implementation | yes | A 4-space <!-- is code; the comment region ignores indent. |
| B569 A whole-line HTML comment does NOT close a pandoc paragraph, and `COMMENT_FULL_LINE` treats it as if it does | follow-up | yes | A whole-line comment does not close a pandoc paragraph. |

**Done when.** A tracked fixture (test/fixtures/html-comments, quarto 1.7.33) holds math inside a mid-line-opened comment and real math after a mid-line -->, with code spans and fences on the same lines; B352's rows agree with quarto on the existing maskInlineCode (inline-code-spans.test.ts untouched); outline, refs, citations and math-region suites stay green; test:oracle passes. P6 bound.

**Verification.** `npm test`; `npm run test:oracle`

**Surface.** vitest over a tracked fixture plus the shared-scanner suites

**Cannot enforce.** Comment constructs beyond the rendered grid.

**First session.** B352: RED rows for math inside a mid-line-opened comment and real math after a mid-line -->, with a code span and a fence on the same lines; then track delimiter positions on top of maskInlineCode with outline, refs and citations regression rows. Record the deleting-RESIDUAL baseline (P6).

### g21 — Raw HTML blocks and tag lines

*Features: OUTLINE-MODEL. Estimate: 5 session(s) (+5 if the deferral is lifted).*

**Scope.** Settle B228 (tags at indent 1-3) by render, close B226's tag-line classes ('<div' with no '>', an invalid attribute name) and take B110's HTML-tag parts (indent-4 trigger under a start tag, unclosed script and textarea). If promoted: tags in quotes, closed pre and div interiors per reader, unclosed condition-1 tags, the three sweep families.

**Why this place.** Two renders settle whether work remains (B228), then phantoms from most to least measured (B226: 16 in a 2,223-document corpus). Phantom direction (P7), so after g24 and g25.

**Soft prerequisites** (decide, re-measure or re-rank only):
- `g20` — Reuse the comment tracker if tag state needs it.
- `g02` — Re-run g02's size rows if region state changes.

**Decisions needed:** D1, D15

| Item | Role | Deferred | What |
|---|---|---|---|
| B228 An `eitherBlockOrInline` tag at indent 1–3 is NOT block, and at indent 0 it is | pin-first | no | Cannot-tell: render an indent 1-3 tag above an ATX line. |
| B226 A tag line with TRAILING CONTENT is prose, and we treat it as a block opener | follow-up | no | 16 phantoms: '<div' with no '>' and invalid attribute names. |
| B519 A `<div>` inside a BLOCK QUOTE deletes a real heading under the default reader | pin-first | yes | Render '> <div>' first; needs B115 part (3). |
| B521 A CLOSED `<pre>`…`</pre>` keeps its content LITERAL under the default reader, and this model reports the heading-looking lines... | follow-up | yes | Closed <pre> interior stays literal. |
| B523 `markdown_strict`, `markdown_github`, `markdown_mmd` and `markdown_phpextra` swallow a CLOSED `<div>` block, and that is NOT th... | follow-up | yes | Closed <div> swallowed by four non-CommonMark readers. |
| B571 An UNCLOSED CommonMark condition-1 tag swallows the rest of the document, and we emit headings from inside it | follow-up | yes | Unclosed condition-1 tag swallows the document. |
| B567 111 heading losses and 81 phantoms the adversarial sweep found in areas OUTSIDE the tag rule | follow-up | yes | 111 losses, 81 phantoms in three families; re-sweep. |

**Done when.** B228 is rendered and pinned (fixed only if the render disagrees); B226's two residual classes agree under the default reader in test/fixtures/raw-html (quarto 1.7.33) or are named RESIDUAL; B110's HTML-tag trigger, its unclosed script/textarea rows and B298 part (7)'s pre/script/style/textarea rows are rendered and agree or are RESIDUAL, and its mid-document YAML-block member is one RESIDUAL record (D1: unscheduled); no pin moves from agree to disagree; P6 bound.

**Verification.** `npm test`

**Surface.** vitest over a tracked fixture plus committed adversarial rows

**Cannot enforce.** The open set of raw HTML constructs.

**First session.** B228: render an indent 1-3 <button> above an ATX line under the default reader, pin the answer, and fix only if the render disagrees. Record the deleting-RESIDUAL baseline (P6).

### g23 — Setext titles, dash rules and setext heading text

*Features: OUTLINE-MODEL. Estimate: 6 session(s) (+9 if the deferral is lifted).*

**Scope.** An empty ---/--- pair, a dash rule under a dash rule in a lazy quote, a blank in indented code, a setext-eaten ordered marker, setext text whitespace collapse, and the quote-scoped ATX-swallow decision. If promoted: the column-lifetime root, fresh-block counter rows (B441 and B495 share one ':::' grid), bare-marker titles, marker text.

**Why this place.** Measured witness first, then the shared discriminator rows as one change; B230's decision follows D15; text rows last. Phantom direction (P7), so after g24 and g25.

**Hard prerequisites** (code or a committed fixture must exist):
- `g16` — listItemContentColumn: contentColumns reads g16's per-marker push; gates B174 only, B124, B180, B220 and B176 need nothing from g16.

**Decisions needed:** D1, D15

| Item | Role | Deferred | What |
|---|---|---|---|
| B124 ⚠ NEW (Session 272) — an EMPTY `---` / `---` pair is read as a setext heading whose text is `---`, and the mid-document metadat... | implementation | no | One witness (exits 1); the cheap fix is refuted by six deleting rows. |
| B180 A dash rule directly under another dash rule is read as its own setext TITLE, and the second underlines the first | follow-up | no | Dash rule under dash rule in a lazy quote is a phantom. |
| B220 A BLANK LINE INSIDE AN INDENTED CODE BLOCK re-arms the following code line as a setext title | follow-up | no | A blank in indented code re-arms the next line as a title. |
| B174 An ordered marker EATEN by its own setext underline leaves the list's content column on `contentColumns`, so a quote below it i... | follow-up | no | Ordered marker eaten by its underline leaves its column pushed. |
| B176 Heading TEXT keeps runs of internal spaces that quarto collapses to one | implementation | no | Heading text keeps internal space runs quarto collapses. |
| B421 ⚠ A list column SURVIVES a line the setext parse consumed as a title, so a bare marker below it looks like a sibling of a list... | implementation | yes | Pop the pushed list column when an underline consumes its line. |
| B409 ⚠ A line consumed as a setext TITLE still pushes its list content column, so a later underline at that column invents a heading | follow-up | yes | Same lifetime root; 386 of 453 worse classes. |
| B543 A bullet-marker line is absent from `OPENS_FRESH_BLOCK`, so a marker title in a TIGHT list — or directly under another marker l... | implementation | yes | Bullet missing from OPENS_FRESH_BLOCK loses a tight list title. |
| B441 A block quote directly under a DIV OPENER is invisible to the setext path, at every column | implementation | yes | Quote under a ':::' opener; shares B495's grid. |
| B495 A setext underline pressed DIRECTLY against a `:::` fenced-div opener claims nothing, so no heading forms there at all | implementation | yes | Underline against a ':::' opener claims nothing. |
| B573 A SETEXT underline below a line-block continuation is invisible to this model, and the obvious fix is REFUTED | follow-up | yes | Setext below a line-block continuation is lost. |
| B551 A bare `-` or `*` used as a setext TITLE reports a heading whose text is the marker, where quarto reports none | follow-up | yes | A bare - or * as title reports the marker. |
| B583 A container OPENER line used as a setext title keeps its MARKER in the heading text | follow-up | yes | Footnote and definition openers as titles keep markers. |
| B585 Quarto FENCED DIVS and callouts are a container `contentColumns` never pushes | cleanup | yes | Unmeasured leads; mechanism 2 is B421's. |
| B423 ⚠ A `-` rule underlined by a `-` rule INSIDE a quote emits a phantom the top-level twin does not | follow-up | yes | Same discriminator inside a quote; closes with B180. |
| B407 ⚠ A `---` after a stack of EMPTY LIST ITEMS is a THEMATIC BREAK, and this model reads it as a setext underline | implementation | yes | '---' after empty list items is a thematic break. |
| B445 A quoted ATX heading pressed under a lazy underline is a SETEXT title whose text keeps the `#` | follow-up | yes | Quoted ATX under a lazy underline keeps its #. |
| B527 A LONE indented line is reported as a setext title under a CommonMark reader, where quarto renders none | implementation | yes | Lone indented line reported as a setext title. |

**Done when.** B124's witness, its six refuting rows and the markdown_strict control, B180's, B220's and B174's pins and B176's collapsed-whitespace pin are re-rendered into test/fixtures/setext (quarto 1.7.33) and flipped or named; B230's quote-scoped swallow follows D15 (reverse if render governs); every OPENS_FRESH_BLOCK change passes a two-directional score; P6 bound.

**Verification.** `npm test`

**Surface.** vitest over a tracked fixture plus committed adversarial rows

**Cannot enforce.** Reach beyond one corpus witness; unseen reader variants.

**First session.** B124: render the empty --- / --- pair under the default and strict readers plus the six refuting rows (RED), then make the pair a thematic-break pair in a reader-aware way. Record the deleting-RESIDUAL baseline (P6).

### g26 — Fenced div lifetime, callouts, tabsets, raw divs

*Features: OUTLINE-MODEL. Estimate: 9 session(s) (+2 if the deferral is lifted).*

**Scope.** Decide the format-gated div position (D21, with the tabset-label answer), then guard the divColumns push for non-div lines, fix callout and tabset lifetime in lists, the callout first-block proxy and theorem-like divs, the tabset preamble and raw-HTML div spellings. If promoted: a closer popping inner containers, the two-closer phantom. Six items, about 1.5 sessions each.

**Why this place.** Decision first (B130, B134, B138 wait on it); the predicate before the rules that read the stack; raw div last (needs the container capability).

**Hard prerequisites** (code or a committed fixture must exist):
- `g25` — divOpenerRefused and test/fixtures/div-attribute-grammar.
- `g16` — listItemContentColumn arithmetic for callout lifetime in lists.
- `g23` — test/fixtures/setext grid; contentColumns is edited by both groups.

**Decisions needed:** D1, D15, D21

| Item | Role | Deferred | What |
|---|---|---|---|
| B140 ⚠ NEW, UNFILED: a FORMAT-GATED div (`.content-hidden` / `.content-visible`) deletes its whole block, headings included, and thi... | decision | no | Format-gated divs with no target format; decide with tabset labels. |
| B136 `divColumns` is pushed for `:::` lines that are not divs at all — inside a raw-TeX environment, below a mid-line HTML comment,... | prerequisite | no | divColumns is pushed for ':::' lines that are not divs. |
| B128 Callout-title DIV LIFETIME — what Session 292's rules still leave: a quote hosted in a list item under a pandoc-markdown reader... | implementation | no | Callout lifetime in quote and list; invasive. |
| B130 A callout's FIRST BLOCK is an AST notion and the model's first-content-line proxy disagrees with it in the PHANTOM direction —... | implementation | no | Definitions above a heading lift it in quarto; theorem divs too. |
| B134 A tabset's PREAMBLE is dropped by quarto and kept by this model, on purpose | follow-up | no | Tabset preamble kept as a fail-safe. |
| B138 ⚠ The RAW-HTML spelling of a callout still reports a phantom, and it measures ZERO of 3,383 authored documents | follow-up | no | Raw div callout and tabset need a div container; zero reach. |
| B549 A fenced div's CLOSER does not pop a container opened INSIDE it, so the stale content column outlives the div | follow-up | yes | A div closer does not pop containers opened inside it. |
| B453 A PHANTOM: an OUTER top-level div plus an inner one in a list item, both closed by column-0 closers | follow-up | yes | Two non-interchangeable column-0 closers leave a phantom. |

**Done when.** D21 is recorded; test/fixtures/div-lifetime (quarto 1.7.33) rows for each witness (list-hosted callout, early-ended inner div, glued heading under no-div readers, callout first-block shapes, theorem-like divs, tabset preamble, raw-div spellings) agree or are named decided RESIDUAL; B84 (6)'s format-gated rows follow D21; g23's setext grid re-run shows no move; the R15 fail-safe suite stays green or is reversed on purpose; B162 is drained when B134, B138 and B140 close; P6 bound.

**Verification.** `npm test`; `npm run observe:posit (optional; go-ahead per P8)`

**Surface.** vitest over a tracked fixture plus committed adversarial rows

**Cannot enforce.** The target output format (adapter layer; src/core cannot see it); Posit behaviour without observe:posit.

**First session.** B140: read src/core/preview-format.ts to size whether a target format can reach the scanner, put D21 to the operator with the Session 290 measurements (63 of 4,366 probes went right to phantom), record the answer; no src change. Record the deleting-RESIDUAL baseline (P6).

### g27 — Front-matter reader proof and non-active format

*Features: OUTLINE-MODEL. Estimate: 6 session(s) (+4 if the deferral is lifted).*

**Scope.** Make the front-matter reader proof decline less where it can be sure (alias, block value, per-format spelling, hazards) through the g09 node resolver. B501 is PROMOTED: this group's widening creates its deleting hazard, since topLevelAnchor binds the FIRST anchor of a name and YAML the most recent. Settle the non-active format's from: reader (D21). If promoted: last-wins extension list, per-format fall-through, escaped keys, the merge key.

**Why this place.** B501's resolver fix precedes the alias row; the proof is a producer for reader-axis rules and reuses the g09 leaf; deleting-direction deferred fixes follow.

**Hard prerequisites** (code or a committed fixture must exist):
- `g09` — yaml-node.ts leaf for aliases and anchors.

**Decisions needed:** D1, D8, D15, D21

| Item | Role | Deferred | What |
|---|---|---|---|
| B501 The front-matter reader RESOLVER misreads the reader in a dozen more shapes — and since Session 261 the callout rule follows ev... | prerequisite | no | PROMOTED: topLevelAnchor binds the first anchor where YAML binds the latest; the alias widening deletes headings without the fix. |
| B116 The proof of the reader declines more than it must, and the Session 296 rules it does not gate still read the resolver's reader... | implementation | no | Proof declines more than it must; costs phantoms; reuse the g09 leaf. |
| B196 Only the `html:` per-format block's `from:` is resolved — a NON-ACTIVE format's `from:` is refused, and that refusal is a measu... | decision | no | A non-active format's from: needs the editor's preview target. |
| B493 The extension list is LAST-WINS and `fromKeepsBlankBeforeHeader` tests DISABLES-FIRST | implementation | yes | Extension list is last-wins; the blank_before_header check is disables-first. |
| B539 A per-format `from:` whose VALUE cannot be resolved falls through to the top-level one, where the measured precedence says it s... | implementation | yes | Unresolvable per-format from: falls through against measured precedence. |
| B497 An escaped-unicode KEY inside a flow mapping (`{"fro\u006D": gfm}`) is invisible, and the miss DELETES a heading | implementation | yes | Escaped-unicode key in a flow mapping is invisible, deleting. |
| B499 A YAML MERGE KEY (`<<: *defaults`) pulls a nested `from:` into top-level scope, and this model resolves neither the merge nor t... | follow-up | yes | Merge key: render, pin as safe, close. |

**Done when.** A tracked fixture (test/fixtures/reader-resolver, quarto 1.7.33) holds one rendered row per B116 spelling (alias, block value, next line, per-format, hazards) and a duplicate-anchor row whose first and last binding disagree; fromValueLine binds the most recent anchor, or declines when a name is bound twice, and topLevelAnchor agrees with the g09 leaf's rule or is replaced by it; findHeadings reads each row as quarto does or declines by named row; Session 297's RESIDUAL rows and g03's five blank_before_header phantoms are reversed in place or named; no row moves from agree to disagree; D21 followed; P6 bound.

**Verification.** `npm test`

**Surface.** vitest over a tracked quarto fixture

**Cannot enforce.** Project-level from: (a recorded phantom) and the preview target.

**First session.** B501 first: a RED duplicate-anchor row (one anchor name bound twice, first and last disagree, rendered under quarto 1.7.33); make the resolver bind the most recent anchor; then B116's alias row through the g09 leaf, pinning each spelling's rendered answer. Record the deleting-RESIDUAL baseline (P6). Rows are rebuilt from the tracked RESIDUAL rows: the Session 293-297 harnesses are untracked.

### g28 — CommonMark-family reader rules and closure

*Features: OUTLINE-MODEL. Estimate: 5 session(s) (+4 if the deferral is lifted).*

**Scope.** Container stack and quote extent under proven CommonMark readers, raw HTML in containers, a div interrupting a paragraph under commonmark_x, the cells closer pairing; B513's column-relative route is folded in (g03). Seven parts, about 1.4 per session. If promoted: DOCTYPE setext titles, interrupt lists, five phantom families, the closure audit of 379 masked rows.

**Why this place.** Last structural group: needs g16's per-marker push, re-runs g18's grid and re-checks g27's reader proof; deleting part (1) first, then phantoms.

**Hard prerequisites** (code or a committed fixture must exist):
- `g18` — g18's tracked fence grid; fenceColumns is edited by both groups.
- `g16` — listItemContentColumn's per-marker push for multi-marker lines (B115 part (1)).

**Soft prerequisites** (decide, re-measure or re-rank only):
- `g27` — frontMatterProvesReader exists; re-run if g27 widens it.
- `g21` — B115 part (3) container HTML route reuses g21's state.

**Decisions needed:** D1, D15

| Item | Role | Deferred | What |
|---|---|---|---|
| B115 CommonMark-family readers: what the Session 296 rules still miss — the container model, the quote extent, raw HTML inside a con... | implementation | no | Seven parts; (1) multi-marker and initials under commonmark_x delete. |
| B525 A `<!DOCTYPE html>` line makes Session 203's `COMMONMARK_RUN_OPENS_BLOCK` decline a setext title quarto renders | pin-first | yes | DOCTYPE setext title lost under unproven readers. |
| B531 Session 203's deny-by-default interrupt list costs SIX measured residuals under readers where the construct is ordinary text | follow-up | yes | Deny-by-default interrupt lists are reader-blind. |
| B505 Five PHANTOM / TEXT families Session 261's adversarial pass found, none of them filed before | follow-up | yes | Five phantom families. |
| B507 What a line of 7+ `#` used to MASK — Session 266's adversarial pass, 379 phantom rows, none of them caused by it | cleanup | yes | Closure audit of the 379 masked rows. |

**Done when.** The Session 296 RESIDUAL rows for B115 are re-rendered into test/fixtures/commonmark-readers (quarto 1.7.33) and fixed or re-pinned; the multi-marker deleting documents recover; the default markdown reader's rows do not move (oracle unchanged); g18's fence grid re-run shows no move; B115 part (2)'s quote-container rows are RESIDUAL (D1: unscheduled); P6 bound.

**Verification.** `npm test`; `npm run test:oracle`

**Surface.** vitest over a tracked fixture plus committed adversarial rows

**Cannot enforce.** Project-level readers; knitr and julia under these readers (unmeasured).

**First session.** B115 part (1): render multi-marker container lines ('- - item', '1. 1. item', 'A. x') under gfm, commonmark and commonmark_x, then fix the deleting rows with g16's per-marker push. Record the deleting-RESIDUAL baseline (P6). Rows are rebuilt from the tracked RESIDUAL rows: the Session 293-297 harnesses are untracked.

### g30 — Heading text fidelity

*Features: OUTLINE-MODEL. Estimate: 2 session(s) (+2 if the deferral is lifted).*

**Scope.** Close the useful subset of the rendered-text gap on the ATX path: entity decode and the trim set (NBSP and BOM are content). The header_attributes reader split and phantom sec- id shipped (Sessions 216, 218). If promoted: escapes inside code spans and the non-breaking-space escapes.

**Why this place.** Text-only divergences rank last among Outline groups; scored on text and id, which count scorers cannot see.

**Soft prerequisites** (decide, re-measure or re-rank only):
- `g23` — B176's whitespace collapse shares this text pipeline.

**Decisions needed:** D1, D15

| Item | Role | Deferred | What |
|---|---|---|---|
| B194 A MULTI-LINE heading makes the SOURCE-vs-RENDERED text gap visible on a surface that never had it | implementation | no | Rendered-text gap; escapes and entities are the useful subset. |
| B485 The heading escape decode fires INSIDE a CODE SPAN, where quarto keeps the backslash literal | follow-up | yes | Escape decode fires inside a code span. |
| B487 `\<space>` immediately before a trailing closing-hash run is read as a HARD BREAK, so the non-breaking space is lost | follow-up | yes | Backslash-space before a closing run loses its nbsp. |
| B489 `\<TAB>` is a NON-BREAKING SPACE to pandoc and this model does not decode it | follow-up | yes | Backslash-TAB is a non-breaking space. |

**Done when.** A tracked fixture (test/fixtures/heading-text, quarto 1.7.33) compares heading text AND id for entity decode, NBSP and BOM trim, links, footnote refs and shortcodes; the subset B194 names agrees or is a RESIDUAL row; npm test passes. P6 bound.

**Verification.** `npm test`

**Surface.** vitest over a text-aware tracked fixture

**Cannot enforce.** Inline rendering of links and footnotes (not modelled); count scorers are blind to text rows.

**First session.** B194: render entity, NBSP/BOM, link, footnote-ref and shortcode headings and commit a text-and-id fixture recording HEAD's agreement; no src change. Record the deleting-RESIDUAL baseline (P6).

### g31 — Cross-reference scanning tail

*Features: XREF. Estimate: 3 session(s) (+8 if the deferral is lifted).*

**Scope.** Measure, then decide, the indented-code skip region for refs and scanRegions (list-aware). If promoted: display-math and caption ids, bare {#fig-} groups, a brace group after ) or ], indented top-level fig divs, a second image attribute block, commonmark_x shapes on images and divs, the @-is-an-email test, surrogate-pair completion.

**Why this place.** B361 consumes the list-aware column model g16 settles; the deferred productions follow B473's measurement and B465's grammars.

**Hard prerequisites** (code or a committed fixture must exist):
- `g16` — listItemContentColumn and the list-containers grid, for B361's build session only; its measurement needs nothing.
- `g15` — test/fixtures/xref-label-families ratchet.

**Decisions needed:** D1, D15

| Item | Role | Deferred | What |
|---|---|---|---|
| B361 Indented (4-space) code blocks as a skip-region | pin-first | no | 180 documents hold it; cross-reference incidence unknown; measure first. |
| B473 Source 3 now carries the reader split, but Sources 2 and 3's OTHER dialect questions were never asked | pin-first | yes | Render eleven attribute shapes under commonmark_x. |
| B465 The two quarto-owned productions — display math and table captions — keep the unvalidated scan, so five measured shapes are pha... | follow-up | yes | Display math and caption ids: three grammars. |
| B469 A `{#fig-…}` group with nothing in front of it to carry attributes is still indexed | follow-up | yes | Bare {#fig-} groups. |
| B467 A brace group adjacent to a `)` or `]` that closes nothing is read as an attribute block | implementation | yes | A brace group after ) or ] read as attributes. |
| B471 A top-level INDENTED `::: {#fig-…}` is a phantom, and the one-character tightening is measured to be WORSE | implementation | yes | Indented top-level fig div phantom. |
| B475 A SECOND adjacent attribute block is indexed although only the FIRST one is the block | implementation | yes | Index only the first image attribute block. |
| B477 The `@`-is-an-email test is a character class where pandoc's rule is `notAfterString`, and it is wrong in BOTH directions | implementation | yes | REF_USAGE email test wrong in both directions. |
| B479 The cross-ref completion scanner walks UTF-16 code units, so an ASTRAL letter in an id reaches go-to-definition but not completion | follow-up | yes | Completion walks UTF-16 code units. |

**Done when.** B361's cross-reference incidence over the realdoc corpus is recorded in docs/REAL-DOCUMENT-TRIAGE.md before any code; then a list-aware skip that does not false-skip 4-space list-item continuation is built, or recorded as a decided limit; g15's index-agreement ratchet does not fall. P6 bound.

**Verification.** `npm test (g15's ratchet row)`

**Surface.** vitest on refs tests plus a one-off personal-corpus measurement

**Cannot enforce.** Corpus-wide behaviour (machine-specific, cannot gate).

**First session.** B361: run indexLabels over the realdoc file list with and without indented-code lines skipped and render the differing documents to size the incidence; no src change. Record the deleting-RESIDUAL baseline (P6).

### g32 — CLI spawn timeout and schema-source retry

*Features: ROBUSTNESS-PERF, YAML-COMPLETION. Estimate: 3 session(s).*

**Scope.** Extract a vscode-free spawn runner (bin, args, timeout, injected exec) and a retry-aware schema-source loader into src/core (cli.ts and yaml-schema-source.ts import vscode), then time-limit the short quarto CLI calls and cache only a successful parse.

**Why this place.** Seam first; B346's timeout produces the failure B348 must survive; independent of other groups.

**Decisions needed:** D8

| Item | Role | Deferred | What |
|---|---|---|---|
| B346 Project-wide CLI spawn timeout | implementation | no | Two CLI probes pass no timeout; cli.ts imports vscode. |
| B348 Schema-reader cache: retry after a transient first-load failure | follow-up | no | createSchemaSource memoises a fallback after one failure. |

**Done when.** With an injected exec that never resolves, resolveBinary and quartoSharePath reject with QuartoNotFound within the timeout (a real node -e child with a short timeout also works); the schema loader then returns the curated index and does not cache it, and a loader that fails once then succeeds retries (debounced) and caches only the successful parse; adapters are thin callers; npm run compile passes; render and preview spawns stay out of scope.

**Verification.** `npm test`; `npm run compile`

**Surface.** vitest on extracted core seams with injected exec and loader

**Cannot enforce.** A genuinely wedged binary; other operating systems.

**First session.** B346: extract the runner into src/core taking bin, args and an injected exec with a timeout; RED row with a never-resolving fake for the --version probe; the adapter becomes a thin caller.

### g33 — Embedded-language virtual-document lifecycle

*Features: EMBEDDED-LANG. Estimate: 5 session(s).*

**Scope.** Extract isProcessDead and the vdoc bookkeeping (docFiles, disposeEpoch, per-language mint state) into vscode-free core so lifecycle rows run headlessly and as root; pin the semantic-token legend; then prune disposeEpoch, reconcile superseded cell vdocs, retire passive {r}/{julia} minting and release the vdoc stranded after the last cell is deleted.

**Why this place.** Independent cleanups first: the isProcessDead seam, then the test-only legend pin; smallest state fix, then the per-cell reconcile, then B312 and B320 on one state machine.

**Soft prerequisites** (decide, re-measure or re-rank only):
- `g32` — Same seam-extraction pattern.

**Decisions needed:** D8

| Item | Role | Deferred | What |
|---|---|---|---|
| B363 The `🐉1` EPERM discriminator cannot run as root or on Windows, and the whole temp-sweep suite is POSIX-shaped | cleanup | no | isProcessDead imports vscode; inject the kill probe. |
| B318 Semantic tokens: the 23 STANDARD token types in `OUR_LEGEND` are pinned by nothing | cleanup | no | 17 of 23 standard legend token types are unpinned. |
| B314 `disposeEpoch` grows unboundedly | implementation | no | disposeEpoch is never pruned. |
| B322 Within-session accumulation of superseded cell vdocs during heavy editing | implementation | no | A shifted cellStartLine strands the old cell vdoc. |
| B312 `{r}`/`{julia}` semantic-token vdoc minting is PASSIVE (no user gesture) — but the S89-filed "cheap fix" is REFUTED; downgraded... | implementation | no | Passive {r}/{julia} minting; dispose after INCOMPLETE_RETRIES. |
| B320 Semantic tokens: deleting the last `{python}` cell strands the previous vdoc until the `.qmd` closes | follow-up | no | Last-cell deletion strands the vdoc; belongs with B312. |

**Done when.** The vdoc state machine has unit rows: closing N documents leaves no disposeEpoch entry for a never-vdoc document; inserting a line above a cell leaves exactly the live set; exhausting INCOMPLETE_RETRIES disposes the language vdoc; deleting the last {python} cell disposes it; deleting any standard type from OUR_LEGEND turns npm test red; an approved test:integration embedded-vdoc run shows .quarto/vdoc-mit holds only live files after scripted edits.

**Verification.** `npm test`; `npm run check-types:unit`; `npm run test:integration (go-ahead per P8)`; `npm run test:lsp (optional, go-ahead per P8)`

**Surface.** vitest on extracted state machines plus an Extension Development Host run

**Cannot enforce.** Real language-server model retention and the R and Julia leaks (parked B306); Windows beyond the injected probe.

**First session.** B363: extract isProcessDead with an injected kill probe into src/core; rows for no-throw, EPERM and ESRCH that pass under root; the adapter imports the core function.

### g34 — Multi-selection formatting toggles

*Features: OTHER. Estimate: 2 session(s).*

**Scope.** Apply formatting toggles to every selection and recompute N resulting selections across shifting offsets; the pure offset mapping is extracted to core first.

**Why this place.** Self-contained and low priority; the pure mapping is tested headlessly.

**Decisions needed:** D8

| Item | Role | Deferred | What |
|---|---|---|---|
| B344 Multi-cursor / multi-selection formatting | implementation | no | Formatting toggles use only editor.selection. |

**Done when.** A pure core function mapping N selections to N edits and N new selections passes unit rows for 1 to 5 overlapping and adjacent selections (RED first); an approved integration row asserts editor.selections keeps its length after a toggle.

**Verification.** `npm test`; `npm run test:integration (go-ahead per P8)`

**Surface.** vitest on a pure function plus one integration test

**Cannot enforce.** Box and column selection and IME interaction in a real window.

**First session.** B344: RED test of a pure selection-mapping function for two cursors on one line; GREEN; then wire features/formatting.ts.

### g35 — Outline toggle and R-package workspace symbols

*Features: OTHER. Estimate: 3 session(s).*

**Scope.** Keep the Outline's expansion across the show/hide setting re-registration (renderMode already re-registers, outline.ts 64-69; the fix covers both triggers) or close as will-not-fix after checking the re-expand command is public API, and add the three-way quarto.symbols.exportToWorkspace setting with DESCRIPTION-file R-package detection and filtering as pure core functions.

**Why this place.** B332 first (it may close as will-not-fix); B330 is a new setting with a narrower audience. No dependency on g14.

**Decisions needed:** D8, D23

| Item | Role | Deferred | What |
|---|---|---|---|
| B332 Outline show/hide toggle: cosmetic re-expand-on-toggle fix | implementation | no | Setting changes rebuild the Outline collapsed; verify API first. |
| B330 Sub-feature (c) — R-package workspace-symbol exclusion | implementation | no | Three-way exportToWorkspace with DESCRIPTION detection. |

**Done when.** An approved integration run shows the Outline keeps its expansion across a setting toggle, or B332 is closed as will-not-fix with the public-API check recorded; unit tests show DESCRIPTION detection and the default/all/none filter (D23 applied); the README settings table lists quarto.symbols.exportToWorkspace.

**Verification.** `npm test`; `npm run compile`; `npm run test:integration (go-ahead per P8)`

**Surface.** vitest plus one integration run

**Cannot enforce.** Real tree expand state without the screen-taking run; VS Code releases that change the command.

**First session.** B332: verify from public VS Code documentation that the re-expand command is stable public API, record the answer, then wire it or close as will-not-fix.

### g36 — Reticulate execution routing

*Features: ENGINE. Estimate: 3 session(s).*

**Scope.** Decide (D17) whether the diagnostics-grade engine resolver may route execution, then add the delegate-selection branch sending {python} cells down the R pathway in a knitr document, behind quarto.cells.useReticulate.

**Why this place.** Narrow audience and a missing feature, so below the false-positive groups; its surface is execution routing, not diagnostics; it follows g10 so the resolver is settled.

**Soft prerequisites** (decide, re-measure or re-rank only):
- `g10` — documentEngineForScoping exists; B365 names it built.

**Decisions needed:** D8, D17

| Item | Role | Deferred | What |
|---|---|---|---|
| B365 Item 17b — Reticulate execution pathway for mixed R/Python Knitr documents | decision | no | Config and routing legs remain; check the resolver is safe for execution. |

**Done when.** A written decision records which resolver routes execution; with engine knitr and the setting on, pickDelegate and delegateCommandsFor send {python} cells to the R path (RED first) and the resolver's declines (.Rmd, include, unreadable selector) fall back to current behaviour; Run Cell on a mixed document is one integration run, OPEN until approved; or D17 answers no, the decision is recorded and the group closes.

**Verification.** `npm test`; `npm run check-types:unit`; `npm run test:integration (go-ahead per P8)`

**Surface.** vitest on execution-delegate.ts plus one integration run

**Cannot enforce.** Real reticulate execution and interpreter availability.

**First session.** B365: read-only investigation and written decision on routing suitability, with characterisation pins of today's three declines (.Rmd, include, unreadable selector); RED starts at the routing branch.

### g37 — Notebook-renderer pandoc fidelity

*Features: NOTEBOOK-RENDERER. Estimate: 4 session(s).*

**Scope.** Close the 13 numbered low-severity divergences of the notebook callout renderer, about three per session: standalone (2) and (3) first, then the leaf-dependent ones; first measure whether quarto's readqmd pre-passes apply to .ipynb markdown cells.

**Why this place.** Pathological or cosmetic, so last; the browser-safe attribute leaf shipped in P2 (attribute-block.ts has no imports) and can be adopted now.

**Soft prerequisites** (decide, re-measure or re-rank only):
- `g25` — Re-check the leaf after g25's route fixes.

**Decisions needed:** D25

| Item | Role | Deferred | What |
|---|---|---|---|
| B367 Notebook-renderer: minor pandoc-fidelity divergences (all LOW, mostly PRE-EXISTING; accepted/documented Session 116). | implementation | no | 13 low divergences; (2) and (3) first. |

**Done when.** Each of the 13 divergences is fixed with a rendered pandoc answer row in the notebook-callout tests, or closed as accepted with a stated reason (D25); npm test and npm run compile (renderer bundle) pass; an approved integration run confirms the renderer in a notebook.

**Verification.** `npm test`; `npm run compile`; `npm run test:integration (go-ahead per P8)`

**Surface.** vitest on notebook-callout.ts plus the renderer bundle

**Cannot enforce.** Real notebook rendering without the screen-taking run; whether quarto pre-passes apply to ipynb.

**First session.** B367 parts (2) and (3): render an empty '::: {}' and a paragraph-interrupting div through pandoc and add RED rows in the notebook-callout tests.

## Deferred groups (Session 252 enumeration-only)

Every item in these groups sits under the BACKLOG section that Session 252 moved out of "Up Next" because the construct appears in 0 of 3,383 authored documents. The standing promotion bar is: show the construct in a document someone wrote.

### g29 — Block-quote container

Promotion-gated. Settle closesParagraph's coordinate contract inside a quote, model the quote as a container with its own content column, then close the dependent rows (quote-end restore, outer stack across the quote switch, indented run claiming a quoted line, table rows, lazy continuation, quoted setext and HTML blocks). Session 189 measured 39 deletions when the stack last moved.

| Item | Role | What |
|---|---|---|
| B427 ⚠ A SUSPENDED PARAGRAPH BAIL EVALUATES THE BLOCK RULES IN THE WRONG COORDINATE SPACE, so `paragraphQuoted` cannot take the cont... | decision | Which stack closesParagraph measures inside a quote. |
| B565 The BLOCK QUOTE is a container this model does not carry at all, and it is the largest measured residual family | follow-up | The quote carries no container; the largest residual family. |
| B457 The phantom the quote suspension buys back | follow-up | Outer stack must survive the quote switch. |
| B433 ⚠ The quote-end RESTORE brings back a container the quote's own line closed, so an ATX below it is reported where quarto render... | implementation | Quote-end restore reinstates a closed container. |
| B443 A PHANTOM under a CommonMark reader: the indented `=` run claims the RAW quoted line | implementation | Indented '=' run claims a raw quoted line under CommonMark. |
| B429 A quote marker inside an OPEN pandoc simple table is read as a quote, where quarto reads it as a CELL | implementation | Quote marker in a simple table read as a quote. |
| B431 `tableNeighbour` reads a line at `i ± offset` against THIS line's container stack, which may be a different container entirely | implementation | tableNeighbour needs the neighbour's own stack. |
| B413 ⚠ A prose token alone on a line, with a block quote under it, invents an ATX heading | implementation | Prose token plus quote invents an ATX heading. |
| B439 A TWO-LINE quoted paragraph takes an indented dash run as a lazy continuation, and the ATX below is swallowed with it | implementation | Indented dash run taken as lazy continuation swallows the ATX. |
| B435 `setextTitleQuoted` asks whether the line IMMEDIATELY above the title is marked, where Session 237's rule is "a quote was alrea... | implementation | setextTitleQuoted tests only the line above. |
| B459 A CommonMark HTML block inside a quote is not opened | follow-up | Quoted CommonMark HTML block is not opened. |

If promoted — done when: No core item. If promoted: a design note under docs/planning records the contract and approach; test/fixtures/quote-container holds the rows filed 'D1: unscheduled' by g16, g19, g25, g28 and B84, plus B427's 16 witnesses, re-rendered; the change flips them with zero HEAD-correct rows broken and a clean second adversarial pass, else RESIDUAL and stop. (+12 sessions).

## Parked items (not scheduled)

| Item | Reason | Note |
|---|---|---|
| B246 LATENT: a multi-engine `tags.engine` list is modelled as engine-AGNOSTIC | blocked | Latent until quarto gives a closed-valued field a multi-engine tag; add a schema-drift pin at the next quarto bump. |
| B306 R/Julia leak measurement under `diagnosticMode: "workspace"` | blocked | Needs a real R or Julia language server in test:lsp and a screen run; julia is not installed. |
| B308 Format Cell adjacency edge from candidate G's line-0 mute — cell whose fence is at document line 0 | blocked | Needs a real Python formatter in the harness (B279); likely a non-issue. |
| B310 Residual: transient PARSE/SYNTAX-error diagnostics on a mid-typing cell still leak under `diagnosticMode: "workspace"` | blocked | No clean in-content fix; matches Posit's acknowledged residual. |
| B336 Embedded-completion secondary-edit filter — defense-in-depth for `command` + divergent primary `textEdit` | blocked | Latent defence in depth; waits on a future completion-item-resolution slice. |
| B350 `parseSchemaIndex` all-or-nothing degradation across categories (forward-compat) | blocked | Impossible with the installed 1.7.33 schema; awaits a real partial-schema quarto. |
| B189 The mid-document metadata-block precondition is an UNDER-approximation: a CLOSED FENCE or CLOSED RAW HTML BLOCK above the opene... | completed-verified | consumedMetadataBlockLines was deleted by Session 272; drain in g03 after per-claim verification. |
| B222 `rawTexMacroLineIsBlock` counts SPACES ONLY, so a TAB-indented raw-TeX macro at a container's content column is invisible | completed-verified | Headline claim false at HEAD; drain with pointer B206 in g03 after per-claim verification. |
| B338 Audit `src/providers/embedded.ts`'s existing completion/hover/go-to-def/signature-help forwarding vdocs for spurious global-Pro... | completed-verified | Sessions 86-93 measured and muted the leak; drain in g03 after per-claim check. |
| B449 A quoted metadata block whose CLOSER is lazily continued (unmarked) is consumed by quarto and not by this model | completed-verified | Superseded by the Session 272 decision; drain in g03 after confirming no open decision rides in the block. |
| B455 A div opened INSIDE a block quote and closed OUTSIDE it | completed-verified | Closed by Session 258; both pins reversed in place; drain in g03. |
| B511 The heading COLUMN set is still keyed on the PRESENCE of a `from:` key, and Session 205 left it that way deliberately | completed-verified | Closed by Session 206; stale leftover; drain in g03. |
| B515 This model runs an unterminated `<!--` to END OF DOCUMENT where quarto's DEFAULT reader ends it at the next BLANK line | completed-verified | Closed by Session 289 with tests; drain in g03. |
| B541 The `from:` dialect reaches constructs beyond headings, and three of them are measured losses | completed-verified | All three rows shipped; drain in g03. |
| B559 `RAW_TEX_ENV_OPEN` matches an UNCLOSED `\begin{x}` and an ORPHAN `\end{x}`, and neither is a block | completed-verified | Session 226 tracks begin/end pairing; drain in g03. |
| B563 The `contentColumns` STACK's arithmetic is now read by THREE rows, and two independent defects in it are measured | completed-verified | Sub-item (b) closed by Session 198, (a) discharged by Session 236; drain in g03. |
| B579 The CLOSER-LINE exemption retains phantoms on purpose, and could be closed by tracking div nesting | completed-verified | Session 226 tracks div depth and the unmatched-closer bail; drain in g03. |
| B200 A plain fence does NOT in general interrupt an open PARAGRAPH, and this model has no such rule at all | duplicate | Top-level rule shipped Session 277; the container-relative remainder is B106 (g19); drain when B106 closes. |
| B451 A heading inside an UNREFERENCED footnote is reported, and pandoc drops the whole note | duplicate | Duplicate of B535; fold its R1 pin reference into B535 and drain in the same g03 commit. |
| B513 An HTML-BLOCK opener at a CONTAINER's content column is invisible to the type-6/type-7 test, whose indent is absolute | duplicate | Duplicate of B115 part (3); fold its column-relative HTML type 6/7 route into B115 and drain in the same g03 commit. |
| B547 An UNREFERENCED footnote definition's content is dropped from quarto's output entirely, and we report headings from inside it | duplicate | Duplicate of B535; fold its corpus-design caution into B535 and drain in the same g03 commit. |
| B172 ⚠ Six terms of the marked-blank rule are UNOBSERVABLE over 746,496 enumerated documents, and two of them may now be dead | needs-decision | Six unobservable marked-blank terms; removal needs plan-mode approval, never plain deletion; zero reach (D26). |
| B277 Marketplace publish prerequisites — OPERATOR STEP, not an agent task. | needs-decision | Marketplace publisher and PAT are operator steps; no publish near-term (D26). |
| B279 `format-cell` against a REAL Python formatter remains UNPROVEN | needs-decision | Python formatter in the lsp harness declined; leave Format Cell unproven or approve; gates B308 (D26). |
| B281 Post-Posit-comparison feature roadmap — the residual open candidates. | needs-decision | Roadmap umbrella; its off-editor project read is D9, and its hover and Contextual Assist Panel bullet is asked in D26. |
| B289 One container document makes `quarto render` CRASH — exit 139 (SIGSEGV), not a diagnostic | needs-decision | Upstream quarto SIGSEGV with a 67-byte repro; g03 commits the witness; filing upstream is the operator's call (D26). |
| B340 `CURATED_EXECUTE_KEYS` hidden-visibility fidelity tuning | needs-decision | Mirror quarto's hiding of enabled, daemon and daemon-restart or harden the shape-lock test; no wrong completion today (D26). |
| B509 Readers outside the markdown family are modelled as markdown, and two of them render nothing we report | needs-decision | Report nothing for a declared non-markdown reader, or keep modelling; gates B505 part (e) (D26). |
| B557 A LONE `+` inside a list item: suspending the `paragraphOpen` gate for it is measured at 2 recovered against 32 new phantoms —... | needs-decision | Lone + in a list item: 2 headings recovered against 32 new phantoms, wrong side of the false-positive doctrine; may be raised in g16 (D26). |
| B94 P3 exposes two PRE-EXISTING phantom families that a refused opener used to hide by accident | record-only | Decided: no src change, zero reach, three RESIDUAL rows pinned. Reopen only if the shape appears; re-read with B110's raw-block parts in g21. |
| B162 RECORD — the div classes measured NOT to consume a heading, so a future session does not re-measure them | record-only | Negative-result record; drain when g26 closes B134, B138 and B140. |
| B236 `{{< include >}}` / indented-`---` neighbours: quarto's own two partitioners disagree, and only one of them was ever mirrored | record-only | Standing caution: quarto's two partitioners disagree; two FP GUARD pins hold it; g07 keeps them green. |
| B316 Semantic tokens: `self` renders a different colour on a `.qmd` than in a real `.py` | record-only | Cosmetic self colour difference on a .qmd; deliberate, filed not-recommended. |
| B463 A `sec-` id on a fenced code block is defined by quarto and deliberately not indexed | record-only | A sec- id on a fence is deliberately not indexed (refs.test.ts H11); reopen only on new author-expectation evidence. |

## Risks and assumptions

- Witness attrition: scratchpad/ was trimmed in Session 302 (s276, s292 gone, s277 one file, s301/hunt empty), so Outline and index groups re-derive rows from item text as tracked fixtures; symbols named in records may be renamed.
- Nearly every Outline item has zero authored-corpus reach (B208's is the 1,265-document ground corpus), and neither test:oracle (cell-option flags) nor realdoc-score (heading levels) sees an Outline or label-index regression: safety rests on each group's own rendered fixture, ratchet row and P6. A change can be wrong with every gate green.
- Defect versus decision: no headless measure consults Posit and observe:posit takes the screen; D15 sets the default, yet a deleting-direction group may still prove to be a decision.
- Deferral: if kept, g29 never runs and about 75 deferred sessions stay open, quote-dependent rows staying RESIDUAL (D1: unscheduled); if lifted, g29 carries Session 189's 39-deletion hazard and a stop rule. B501 is lifted for g27 alone.
- Project context: if D9 is no, B254 (b)(c), B210 and the project-level rows of B95, B86, B108, B117 and B297 stay limits and g09 shrinks by about two sessions; if yes, g09 builds an adapter seam.
- Estimates are points (202 core sessions, range roughly 160-260, plus 75 if the deferral is lifted); XL records (B84, B105, B112, B141, B297, B298) historically exceed their part counts, so each has a stop line. core_sessions_without_decision_gated drops g36 and g37, whose criteria close on a 'no' (D17, D25).
- Verdicts are keyed to quarto 1.7.33 and knitr 1.51; a version bump invalidates every tracked fixture. julia is not installed (R is), so B112 part (8) is unmeasurable here.
- Screen-taking runs cannot meet their integration rows without the operator's go-ahead (P8); a session without one records the row OPEN, and adapter wiring is verified only there.
- RESIDUAL records filed during the plan sit outside its B<line> key space; cite them by title (B232's five phantoms, B84's six families, B89 (6b)).
- The operator-named gaps format-name checks and _metadata.yml coverage arrive at g12 and g13, after the false-positive groups; D27 puts that order to the operator before g10.
- g14's ratchet pair (r6 vs r3: 542 right, 70 hiding) is computed at 1ed4197a from test/fixtures/knitr-print-noexec; the existing 376 and 178 score the default reading against the no-execute render and are contrast only.

## Review record

- **Round 1 (31 agents, read-only):** 12 readers inventoried all 221 open items, 12 grounders verified symbols and completion claims, three planners (robustness, cohesion and gating lenses) drafted, one synthesised 43 groups, three reviewers returned 55 findings (4 high, 33 medium, 18 low). The orchestrating session re-checked 7 of 7 spot-checked findings firsthand; all were right (the prerequisite deadlock on the deferral, untracked evidence, adapter code no unit test can import).
- **Round 2 (reviser + 3 reviewers):** restructured around the Session 252 deferral, hard versus soft prerequisites, standing decisions and the in-flight sweep; 36 core groups. The reviewers returned 52 findings (3 high, 25 medium, 24 low). The orchestrator confirmed the three highs and six others against the repository (the oracle gates only cell-option flags, no unit test imports an adapter module, the front-matter resolver binds the first anchor, maskInlineCode already exists, the Outline already re-registers on the render-mode setting, the Session 301 hunt directory is empty).
- **Round 3 (reviser + 2 fidelity reviewers):** applied the 52 findings; the reviewers returned 18 more (2 high, both the same defect in g14's ratchet, 7 medium, 9 low). The orchestrator confirmed the high (the ratchet scored the wrong render; regen.py would overwrite the fixture's engine column; the new pair 542 / 70 was recomputed) and applied all 18 by patch.
- **Stop line.** Three rounds, 125 findings, falling from structural to local. A fourth round would find new local wording, so none was run: what execution turns up is recorded in this plan at the session that finds it. Disposition ids: `dependency#n`, `accuracy#n`, `criteria#n` are round 1; `R2dep#n`, `R2acc#n`, `R2cri#n` round 2; `R3fid#n`, `R3gat#n` round 3.

| Finding | Disposition | How |
|---|---|---|
| dependency#0 | applied | B252 is per key: only include is flagged in a knitr handler cell; a tracked 47-key sweep supplies control rows that stay silent (g11). |
| dependency#1 | applied | g05, g32 and g33 extract vscode-free seams into src/core first (spawn runner, retry policy, kill probe); g09, g12, g13 and g24 now do the same for their adapter parts. |
| dependency#2 | partly | Exhaustive regex proofs, plus a seeded old-versus-new differential with the OLD function kept in the test for every non-regex rewrite (g02). The fence harness is not hoisted: it gates rule changes (g18). |
| dependency#3 | applied | g18 builds a NEW seeded generator and committed fixture; the 3,105-probe set and its 626/622 numbers are declared non-reproducible. |
| dependency#4 | applied | START_CODE and END_CODE pins are added in g07 before B192 edits them; the 'protects B192' claims are dropped. |
| dependency#5 | applied | Items are keyed B<line>, frozen at 1ed4197a; the deferral is the Enumeration-only heading (B407 and later), not a live line number. |
| dependency#6 | applied | B441 moved into g23 beside B495: one consecutiveBody grid, one two-directional score. |
| dependency#7 | applied | g18 starts B105 (b), a consumedCloserLine search, and re-runs g02's rows; g20 reuses the existing maskInlineCode, so its edge is soft; no shared primitive is claimed. |
| dependency#8 | applied | Live-regression claim dropped; g16's rationale is size, ground-corpus witnesses and the shared push site; B132 is re-rendered first (g25). |
| dependency#9 | partly | g09 builds a no-import leaf (yaml-node.ts) with a failure-direction parameter; B116 reuses it; B501 (topLevelAnchor binds the first anchor) is PROMOTED into g27 as a core part. |
| dependency#10 | applied | g08 consolidates the grammar (now with mappingContainerKey and keySpanAt) after the false-positive groups g09 to g11 and before its consumers g12 and g13; its differential covers raw enumerator tokens. |
| dependency#11 | partly | Asked once as D9 before g09, the first core consumer; the seam is built there if yes. No separate pre-knitr group: those project rows are RESIDUAL by criteria. |
| dependency#12 | applied | g14 pins the redefined-& hazard as a RESIDUAL row in the qmd-model R6 block (the fixture ratchet is one-way); F rebound and opts_hooks rows exist (grep verified). |
| dependency#13 | applied | B260's grounding render opens g11, before B252. |
| dependency#14 | applied | B513 folds into B115 part (3) in g03; B519 renders in g21 with a RESIDUAL fallback; B110's HTML parts move to g21. |
| dependency#15 | applied | Quote-in-list rows (B503 part (b), B553) are RESIDUAL, owner D1: unscheduled; g16 no longer requires them. |
| dependency#16 | applied | g03 scopes git grep -nw 66 to README.md and load.ts; baseline.json and corpus.ts history stay (extra hits verified). |
| dependency#17 | partly | Handler-list pins move to g10 (B92), where the four lists are edited (grep verified), not g01, which protects the sweep. g36's rows are characterisation pins. |
| dependency#18 | partly | Applied: g33 order B322, B312, B320; fold-then-drain; B254/B265 link. Rebutted: folding B595 into g05; its leg is parseDeclaredFormats (preview-format.ts:31), not parseFlowCollection (:107), and it is deferred. |
| accuracy#0 | applied | g29 is off group_order; no hard prerequisite names a deferral-only group; 'closed' is defined; B361 no longer needs the attribute group. |
| accuracy#1 | applied | g25 re-renders B132's witness first (P3 shipped); no criterion assumes a deleting heading. |
| accuracy#2 | applied | Claim removed; Outline groups use committed rendered probes; realdoc head is a no-regression line only (P6). |
| accuracy#3 | applied | As dependency#3. |
| accuracy#4 | applied | g18 re-runs g02's size-doubling rows after B105 part (b), now a soft edge (g18 consumes no g02 function or fixture); the 'must not re-edit' sentence is dropped. |
| accuracy#5 | applied | g03 folds each duplicate's unique clause into B535 or B115 in the same commit as its drain. |
| accuracy#6 | applied | Done criteria, estimates and hard prerequisites cover core items only; deferred rows follow them. |
| accuracy#7 | applied | g15 scopes B84's families; (3), (6), (6b), (1)(iii), (10) and (1)(i) are filed RESIDUAL there (D1: unscheduled), g19 and g24 re-score named rows; the baseline is a rebuilt fixture. |
| accuracy#8 | applied | B254 (b)'s cheap half ships unconditionally in g09; g13 adds silent _quarto.yml and _metadata.yml rows. |
| accuracy#9 | applied | As dependency#13. |
| accuracy#10 | applied | As dependency#10. |
| accuracy#11 | partly | Dropped g35-to-g34, g19-to-g11 and B164's resolver prerequisite. B216 and B214 stay one item in g17, which now precedes g16; family (b) goes to g16. |
| accuracy#12 | partly | B328 stays in g12 with its own criteria; B342 gets a unit row on an extracted insert-text function; B595 (deferred) keeps its preview-format leg. |
| accuracy#13 | applied | g02 is scoped to measured shapes; g03's grep is scoped; g01 allows 'shown equivalent'. |
| accuracy#14 | applied | B212 moved to g06, enumerates four spellings and drops the g11 dependency (document-engine.ts:751 handles .rmarkdown). |
| accuracy#15 | partly | B230's docstring fix moves to g03 (stale at model.ts:901-903). B297 (m): the bundle-size comment is gone (git grep empty); its stale part (c) is g03's. |
| accuracy#16 | applied | Restated as point estimates: 200 core sessions plus 75 if the deferral is lifted; totals are fields. |
| criteria#0 | applied | D1 is asked once before g11, the first group holding a deferred item; hard and soft are defined (P2); 'closed' is defined; g29 sits outside group_order. |
| criteria#1 | applied | Criteria re-based on new committed generators and fixtures; the 3,105 and 117 probes are no longer targets. |
| criteria#2 | applied | g25 gives each B141 and B297 sub-part an owner (g26, D18, D9, g03) or a RESIDUAL record (D1: unscheduled); B297 (j) is core there. |
| criteria#3 | applied | g14's gate is the npm test ratchet, lowered with each fix; the 27 rows are listed by id; score_modes.py only writes the fixture. |
| criteria#4 | partly | Applied: label index after knitr, B212 early, B318 into g33, splits named in P3. YAML-VALIDATION spans g09 to g13 for stated reasons (P3). Reticulate stays g36: low severity, execution surface. |
| criteria#5 | applied | As dependency#1. |
| criteria#6 | applied | g03 re-estimated to 5 sessions, grep scoped, duplicates folded then drained, B232 filed once. |
| criteria#7 | applied | Estimates rebuilt from numbered parts; parts that cannot close are RESIDUAL with owners (B112 parts (8)-(10)). |
| criteria#8 | applied | B112 part (8) is unmeasurable (julia absent, R present), (10) record-only, (9) in scope; D17 asks once, in g14. |
| criteria#9 | applied | D15 sits before the first Outline-moving group (g14) and lists every Outline-moving group: render governs by default; observe:posit only for pandoc-only constructs. |
| criteria#10 | applied | g09's resolver is a no-import leaf with an import-graph test; model.ts value-imports only qmd siblings (model.ts:42-46), so no cycle. |
| criteria#11 | applied | P6: committed seeded probes, 'new' means red against the parent, two fresh passes then RESIDUAL rows. |
| criteria#12 | applied | g02 ends with a terminal bounded session and one RESIDUAL record; B89 (6b) stays its existing pin, RESIDUAL (D1: unscheduled). |
| criteria#13 | applied | g15 records the HEAD baseline from a rebuilt fixture; families (3), (6), (6b), (1)(iii) are RESIDUAL there (D1: unscheduled). |
| criteria#14 | applied | B589 is deferred; grammar and consumers are separate; D13 asks only if promoted. |
| criteria#15 | applied | Realdoc-live claim removed; B537's a7_pop is 'add' (no a7_pop in test/unit, src or the CHANGELOG). |
| criteria#16 | applied | Corrected: A3 and G13 (refs.test.ts 1182, 1339) belong to deferred B475, Z4 to B471, Z5 to B467 (g31 deferred rows); they stay green unreversed and are dropped from every criterion. |
| criteria#17 | applied | START_CODE and END_CODE pins added in g07; B234 gets a three-batch stop rule. |
| criteria#18 | applied | g01's first session authors the tracked mutation runner; g36's rows are characterisation pins. |
| R2dep#0 | applied | B501 is PROMOTED into g27 (topLevelAnchor binds the first anchor, model.ts:3383); duplicate-anchor row added. |
| R2dep#1 | applied | g09, g12, g13 and g24 open adapter work with a core extraction; criteria split vitest rows from integration rows. |
| R2dep#2 | applied | g08 now covers mappingContainerKey and keySpanAt (yaml-context.ts:327-340 has its own colon test); g13's edge names them. |
| R2dep#3 | applied | Edge removed: outline.ts:64-69 already re-registers on renderMode; g35 covers both triggers. |
| R2dep#4 | applied | B105 (e) goes to g18, the tab half of (g) to g16; (f) opens with one render grid (jupyter, markdown closed: CHANGELOG 293-295). |
| R2dep#5 | applied | g20's edge is soft: it reuses maskInlineCode (model.ts:12838); g18 claims no shared primitive. |
| R2dep#6 | applied | Hard edges keep only a named function or fixture; g14, g16, g18, g21, g25, g28, g36 go soft where they name only a re-measure or ordering preference; g11 keeps B92's pin rows. |
| R2dep#7 | applied | g02 keeps the OLD function in the test and runs a seeded differential for every non-regex rewrite. |
| R2dep#8 | applied | B89 (6b) leaves g08 (a different comment rule that adds flags); its pin stays RESIDUAL, D1: unscheduled. |
| R2dep#9 | applied | The hazard row is a RESIDUAL row in the qmd-model R6 block; fixture constants hold; the criterion is a one-way ratchet. Round 3: the r6-vs-r3 pair and a tracked rewrite script replace the regen.py clause. |
| R2dep#10 | applied | D15 precedes g14, the first Outline-moving group in order (g07 moved later), and lists them all. |
| R2dep#11 | applied | g26 re-runs g23's setext grid and g28 re-runs g18's grid; both edges name the fixture. |
| R2dep#12 | applied | g01 names what it guards: B88 (3), (7) fence patterns feed the CELL_INFO trims (model.ts:10623, 12867); START_CODE_CELL pins guard g07. |
| R2dep#13 | applied | g24 and g25 precede the phantom groups (P7); B216 (b) goes to g16, which follows g17. |
| R2acc#0 | applied | g16 gates push and pop by one flag and needs B411's guard row GREEN (label only). |
| R2acc#1 | applied | g18 opens (f) with one render grid; only the knitr half remains, a no-oracle RESIDUAL; 'already closed' is allowed. |
| R2acc#2 | applied | g06 grounds each spelling in its own throwaway directory (document-engine.ts technique); registration needs no render. |
| R2acc#3 | applied | Six hard edges scoped, softened or deleted; g17 precedes g16; B361's measurement waits for nothing. |
| R2acc#4 | applied | Handovers sit in g19's and g24's criteria or are RESIDUAL records in g15 (D1: unscheduled), sub-families named. |
| R2acc#5 | applied | P6: a deleting RESIDUAL needs a rendered decision record; session 1 records a baseline count the group may not raise. |
| R2acc#6 | applied | g24 splits B112: (8) unmeasurable, (10) record-only, (9) in scope, (1) a pinned CHOICE. |
| R2acc#7 | applied | Shipped header_attributes and sec- id work leaves g30 (model.ts:2267-2299); re-estimated at 2. |
| R2acc#8 | applied | B593's arm-token half is PROMOTED into g12 (model.ts:12631 splits at the first colon); quoting stays deferred. |
| R2acc#9 | applied | g09 now precedes g07 and g08; B258 (d), the one part needing enumerator emission, is g12's. |
| R2acc#10 | applied | g09 says 'both _quarto.yml features' (two modules gate on isProjectConfigFileName); .qmd members sit under D9. |
| R2acc#11 | applied | g13 adds the rendered _quarto.yml validate-yaml: false plus _metadata.yml row; a D9-gated limit if quarto exits 0. |
| R2acc#12 | applied | Corrected: A3, G13 (B475), Z4 (B471), Z5 (B467) are deferred rows in refs.test.ts; they stay green, unreversed. |
| R2acc#13 | applied | As R2dep#7. |
| R2acc#14 | applied | g03 commits B289's 67-byte witness; D26 lists B281's hover bullet. |
| R2acc#15 | applied | B90 has eleven mutants; D2 calls B585 the superseded lead; B318 and B363 are cleanups; the reticulate ask joins D17. |
| R2cri#0 | applied | Each group names only gates that can go red: its own fixture and ratchet; test:oracle only where cells or flags change; the oracle-index claim is gone. |
| R2cri#1 | applied | g15's first session rebuilds the hunt from B84's lists and surviving seeds, sized as a rebuild. |
| R2cri#2 | applied | As R2dep#5. |
| R2cri#3 | applied | As R2dep#8. |
| R2cri#4 | applied | As R2dep#9, with the regen.py procedure for each constant change. Round 3: corrected to a two-pair ratchet (R3gat#0). |
| R2cri#5 | applied | D17 names the open callers only (Run Cell, cell background, vdoc map, refs render mode); g24 drops the label index. |
| R2cri#6 | applied | One standing plan-mode decision (D8) before g05, listed in every group that extracts a seam or changes a shared function. |
| R2cri#7 | applied | As R2acc#2; the case-distinct test is VS Code language-id matching in the approved integration run. |
| R2cri#8 | applied | As R2acc#4, plus B105 (e) in g18, B298 (7) rows in g17 and g21, (8) RESIDUAL, and g03's explicit B297 (m) fix. |
| R2cri#9 | applied | RESIDUAL owners are scheduled groups or 'D1: unscheduled'; core criteria name deferred rows 'label only'. |
| R2cri#10 | applied | The format-gated-div and preview-target asks merge before g26; the reticulate ask joins D17; B230 follows D15; screen runs are P8's standing rule; D9 is listed in g25. |
| R2cri#11 | applied | g36 closes on a D17 'no'; totals are fields; g36 and g37 are the decision-gated groups. |
| R2cri#12 | applied | g32: the spawns reject with QuartoNotFound (cli.ts:61-72, 89-100); the loader returns the curated index uncached. |
| R2cri#13 | applied | As R2dep#3. |
| R2cri#14 | applied | g18's fixture takes two sessions, derived from the item texts; estimate 10. |
| R2cri#15 | applied | g10: each pinned handler list rejects languages outside its own set; the ojs lists allow ojs. |
| R2cri#16 | applied | g16's first session authors the mutant list; g01 is a soft edge whose runner takes any list. |
| R2cri#17 | applied | Count is eleven (four re-run, seven reviewer-measured); g01 stays at 2. |
| R2cri#18 | applied | As R2dep#6; g02's terminal session releases the soft edges. |
| R2cri#19 | applied | As R2acc#12. |
| R2cri#20 | applied | P3 states why YAML-VALIDATION spans g09 to g13; B591 sits in g13 beside B334 (label only). |
| R2cri#21 | applied | Estimates state parts per session; g09's 9 includes the D9 seam; g02, g15, g16, g18, g25 rechecked. |
| R3fid#0 | applied | g14's ratchet is now two named pairs (r5 vs r4: 668/27; new r6 vs r3: 542/70, recomputed firsthand); 376/178 kept as contrast; regen.py named only to be refused for knitr-print-noexec; a tracked model-column script replaces it. |
| R3fid#1 | applied | g08 split: Part A (slotsOf, valueSlotAfterColon, comment test) byte-identical; Part B (B300) a stated change with a rendered row; keySpanAt and mappingContainerKey keep first-colon semantics until g12 and g13. |
| R3fid#2 | applied | g14 owns indexLabels(text, engine, mode) with a core row and one integration row; D17 and g24 no longer claim the refs render mode. |
| R3fid#3 | applied | g09's done criterion adds a rendered duplicate-anchor row and a most-recent-or-decline rule for the leaf; g27 requires topLevelAnchor to agree with it or be replaced. |
| R3fid#4 | applied | D15 moves before g10 and lists g10 and g12; both gain heading and label no-move rows; g12 gets a hard edge on g09 naming yaml-node.ts. |
| R3fid#5 | applied | P6 gains a counting convention (title prefix 'RESIDUAL (deleting)') and one tracked counting test, added in g14's first session. |
| R3fid#6 | applied | B105 (i) closes with B88 (3) in g02 and g18; the mid-document YAML member of B298 (7) is one RESIDUAL record in g21. |
| R3fid#7 | partly | P5 lists the further missing directories and harness; g24, g27, g28 rebuild rows from tracked RESIDUAL rows; g24 on g10 demoted to soft; g23 and g28 edges name listItemContentColumn. |
| R3gat#0 | applied | Same defect as R3fid#0; see that disposition. |
| R3gat#1 | applied | Same as R3fid#1; g13's edge on g08 re-stated as the shared comment and value-slot helper only. |
| R3gat#2 | applied | B84 family (7) remainder is named a RESIDUAL (D1: unscheduled) with its twelve measured row ids; the operator may promote it. |
| R3gat#3 | applied | g06's gate is test/unit/package-activation.test.ts, written RED first, with one entry per spelling in both lists; check-package removed (it cannot see a package.json change). |
| R3gat#4 | applied | B112 part (6)'s rows move into g10's done criterion with a headings check; the g24 edge on g10 is soft. |
| R3gat#5 | applied | 'P6 bound.' added to g07, g15, g20, g30 and g31. |
| R3gat#6 | applied | g25 owners: B297 (f) and (k) are RESIDUAL, D1: unscheduled; B297 (m) is g03's. |
| R3gat#7 | applied | g03's criterion now says the six sites state no hard-coded count (git grep empty), matching B122's fix. |
| R3gat#8 | applied | g04's score.py clause is marked no-gate: verified by one run on the operator's machine. |
| R3gat#9 | partly | Edges scoped to the consuming item; g02 may run its crash row before g01 (edge soft); g13's format-name and _metadata.yml order goes to the operator as D27 rather than being moved; B361's measurement stays in g31. |

## Where each key went (B<line> at 1ed4197a)

Titles are in the group and parked tables above; resolve any key with `git show 1ed4197a:BACKLOG.md`.

- **g01**: B90
- **g02**: B88, B89
- **g03**: B122, B143, B183, B206, B230, B232, B248, B267, B370
- **g04**: B178, B218, B250, B269, B271, B304, B354, B359
- **g05**: B324, B326
- **g06**: B212
- **g09**: B254, B256, B258
- **g10**: B92, B210, B240, B242, B244
- **g11**: B252, B260, B589
- **g08**: B300, B357
- **g12**: B302, B328, B342, B593, B595
- **g13**: B263, B265, B273, B275, B334, B591
- **g14**: B86, B95
- **g15**: B84, B185, B481, B483, B491
- **g17**: B110, B214, B216, B447, B561
- **g16**: B164, B166, B170, B198, B208, B224, B411, B415, B419, B425, B503, B533, B535, B537, B545, B553, B581
- **g18**: B105, B108, B202, B298, B555
- **g19**: B104, B106, B168
- **g22**: B113, B117, B417, B437, B575
- **g24**: B112, B120, B204
- **g25**: B132, B141, B297
- **g07**: B187, B192, B234, B238, B529, B587
- **g20**: B352, B517, B569, B577
- **g21**: B226, B228, B519, B521, B523, B567, B571
- **g23**: B124, B174, B176, B180, B220, B407, B409, B421, B423, B441, B445, B495, B527, B543, B551, B573, B583, B585
- **g26**: B128, B130, B134, B136, B138, B140, B453, B549
- **g27**: B116, B196, B493, B497, B499, B501, B539
- **g28**: B115, B505, B507, B525, B531
- **g30**: B194, B485, B487, B489
- **g31**: B361, B465, B467, B469, B471, B473, B475, B477, B479
- **g32**: B346, B348
- **g33**: B312, B314, B318, B320, B322, B363
- **g34**: B344
- **g35**: B330, B332
- **g36**: B365
- **g37**: B367
- **g29**: B413, B427, B429, B431, B433, B435, B439, B443, B457, B459, B565
- **parked**: B94, B162, B172, B189, B200, B222, B236, B246, B277, B279, B281, B289, B306, B308, B310, B316, B336, B338, B340, B350, B449, B451, B455, B463, B509, B511, B513, B515, B541, B547, B557, B559, B563, B579
