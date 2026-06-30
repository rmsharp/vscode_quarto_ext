# Phase 6e — Embedded-cell language completion (virtual-document request forwarding): Implementation Plan

**Status:** PLAN (draft for executor sessions). Produced by a planning-only session (Session 27) — no code shipped. Grounded in firsthand inspection of the current tree + a 6-agent investigation/grounding workflow.
**Author:** Session 27 (2026-06-29).
**Governs:** `docs/planning/2026-06-27-extension-architecture-plan.md` §6 "Phase 6e" (lines 326, 328–334) and §6 line 330 ("here be dragons"). This plan decomposes that one-line sketch into vertical slices.
**Out of scope:** Embedded-cell **diagnostics** (the request-forwarding technique structurally cannot forward diagnostics — see §2.5 / §7); a real out-of-process **LSP** (Tier C, deferred with the LSP decision); Phase 6d (YAML/`#|` schema completion — shipped) and Phase 7 authoring aids. This plan delivers **completion** as its core (6e-1/6e-2), with **hover** and **go-to-definition** as optional follow-on slices (6e-3/6e-4).

---

## §0. How this plan was produced (evidence provenance)

Every load-bearing file:line in §4 was **confirmed firsthand this session** (read in the current tree, not trusted from an agent), per Learning #24 ("when a delegated finding is load-bearing, verify it firsthand"). The technique in §2 is grounded in the **official MIT VS Code "Embedded Programming Languages" guide** and the MIT `microsoft/vscode-extension-samples/lsp-embedded-request-forwarding` sample (URLs in §2.2), fetched and read this session.

A 6-agent investigation workflow inventoried four code subsystems (region/cell model, grammar+`package.json` wiring, provider registration/gating, the Phase 5 run-cell delegation precedent), grounded the forwarding technique against the live guide, and extracted the house plan format. Three adversarial verdicts **materially shaped this plan**:

- **Technique / offset-mapping (changed the design):** the parent plan's "per-cell virtual document + offset mapping" framing is **not** the guide's recipe. The guide uses **whole-document blanking** (one virtual doc per language, every non-embedded char → space, newlines preserved) which gives **identity offset mapping** (zero translation, zero edit-remapping) AND preserves cross-cell same-language state. This plan adopts whole-doc blanking and **demotes the offset-mapping dragon from "the risk" to "a contained, headlessly-testable pure-core function"** (§2.3, §5). This is the headline finding.
- **Faithful verification (gate d):** the clean `@vscode/test-electron` host has **no** Python/R/Julia extension, so a forwarding test that depends on a real language extension would be unfaithful. The fix is the **Learning #13b stand-in pattern**: register a stand-in completion provider for the embedded language in the test and assert the forward chain routes to it env-independently (§6 verification).
- **Gating / scope (confirmed the trap):** 6e shares the `{language:"quarto"}` selector with the YAML and `@` providers and must be the **exact disjoint complement** of both (cell BODY only, excluding fence lines AND `#|` option lines) — the recurring Learning #15b/#24/#25 cross-pollination trap, here in its third provider (§4.3).

A **6-lens / refute-by-default adversarial review of the *draft* of this plan** (this session) raised 17, confirmed 10, and **materially changed it**: (1) a **High** doc-corruption hazard — a completion's `additionalTextEdits` (auto-import) anchors at the vdoc's module top, which under whole-doc blanking identity-maps to `.qmd` line 0 = the YAML front matter, so accepting it would write `import …` into the front matter unless out-of-cell edits are filtered (now §7 High row + a 6e-1 obligation); (2) the clean-room wording was tightened (the recipe is **written independently**, not "byte-for-byte" copied) and a **voluntary** NOTICE attribution added (§2.1/§2.2); (3) **signature help split out** of 6e-4 into its own slice 6e-5 (FM #26); (4) the `#|`-blanking decision, completion trigger-char mechanism, vdoc↔store key symmetry, `vdocs` Map eviction, and the degradation-hint trigger were corrected (§5/§6/§9). The `gate-d` lens stalled mid-run; its dimension — **faithful stand-in-test viability** (does the vdoc's languageId resolve in the bare test host?) — is captured by the author as a load-bearing assumption to verify at 6e-1 (§9 Q8, §7).

---

## §1. Executive summary (TL;DR)

**The dragon is tamed, not slain by brute force.** Embedded-cell completion does **not** need an LSP and does **not** need bidirectional offset arithmetic. The VS Code request-forwarding technique, using **whole-document blanking + identity offset mapping**, lets a thin `{language:"quarto"}` `CompletionItemProvider` re-dispatch the cursor — *unchanged* — into the user's already-installed Python/R/Julia/OJS extension via a per-language **virtual document** and `vscode.executeCompletionItemProvider`, then return the result **unchanged**. The only genuinely new machinery is one pure, length-preserving blanking function (unit-testable headlessly) + a thin `TextDocumentContentProvider` adapter.

| Slice | Capability | Ships (trigger → result) | Note |
|---|---|---|---|
| **6e-1** | Python completion forwarding **+ all shared infra** | Type inside a `{python}` cell → the Python extension's completions appear; nothing leaks into prose/YAML/fence lines | The tracer bullet; builds the scheme + blanking + gate + forwarding. Biggest slice. |
| **6e-2** | Extend to `{r}` / `{julia}` / `{ojs}` cells + graceful degradation | Completion in those cells when the matching extension is installed; a clear no-op (no crash, optional one-time hint) when absent | Thin: a static lang→languageId map grows + multi-language vdoc + degradation. |
| **6e-3** *(optional, v2.x)* | Embedded **hover** | Hovering a symbol in a cell shows the language extension's hover | Same vdoc/scheme; `executeHoverProvider`; no remap (identity). |
| **6e-4** *(optional, v2.x)* | Embedded **go-to-definition** | Go-to-def on a symbol in a cell jumps to its definition in the same file | `executeDefinitionProvider`; **URI-swap remap** of returned `Location`s back to the `.qmd` (the one residual offset/URI hazard). |
| **6e-5** *(optional, v2.x)* | Embedded **signature help** | Typing inside a call (`f(`) shows parameter hints | Same vdoc/scheme; `executeSignatureHelpProvider`; no remap (identity). |

**Recommended stopping points:** after **6e-1** the headline capability (code completion inside cells) works for the most common engine; after **6e-2** it covers all four mapped languages — that is a complete, shippable 6e milestone. 6e-3/6e-4 are optional extensions of the same mechanism. **Each slice = one session, strict TDD, vertical (provider registered → forward → items appear).**

---

## §2. The forwarding mechanism, resolved (source / posture / technique decision)

### 2.1 Licensing — the hard gate (MIT-clean, CONFIRMED)

6e **copies no code and bundles no runtime dependency.** It forwards completion requests to **the user's own already-installed language extensions** (Python, R, Julia, …) — exactly the trust/licensing model already used by Phase 5 run-cell delegation (Learning #13: we invoke external command IDs / providers we did not author and do not ship). Refutation angles checked:

- *Do we vendor or redistribute anything?* No. No schema file, no library, no asset — so **no `NOTICE` entry is legally required** (nothing is redistributed) and no `npm audit` surface change (Learning #20/#23 untouched; `dependencies` stays `{}`). **But** the project's own `NOTICE` convention attributes the MIT *technique* source even when no code is copied — e.g. the grammar-injection idea credits `mjbvz/vscode-fenced-code-block-grammar-injection-example` with an explicit "does not embed or copy" disclaimer (`NOTICE:28-33`). 6e adopts a directly parallel thing (the request-forwarding *technique*), so add a **voluntary** "Third-party references" *inspired-by* entry for the MIT VS Code embedded-languages guide + `microsoft/vscode-extension-samples` (`lsp-embedded-request-forwarding`), matching that precedent.
- *Do we adapt Posit's AGPL extension?* No. Posit uses the same upstream VS Code technique; we implement it independently from the **MIT** VS Code guide + MIT sample (clean-room — Learning #1). We read the MIT sample for the recipe; we write our own code.
- *Does the technique itself encumber us?* No. `vscode.executeCompletionItemProvider` and `registerTextDocumentContentProvider` are first-party VS Code API.

**Determination: MIT-clean, trivially.** Same posture as run-cell delegation.

### 2.2 Which mechanism to consume (grounded against the live guide)

| Approach | What it is | Verdict |
|---|---|---|
| **Request forwarding** (`registerTextDocumentContentProvider` + `vscode.executeCompletionItemProvider`) | Build a virtual doc for the embedded language; re-dispatch the request to whatever extension is registered for that language | **[CHOSEN]** — no LSP, works in-process, the documented technique |
| Language service in-process | Run a JS language library (e.g. a Python analyzer) inside the extension host | Rejected — huge dep, duplicates the user's installed tooling, not MIT-trivial |
| Out-of-process LSP (Tier C) | A separate server process | Rejected for 6e — deferred with the LSP decision (architecture §"Tier C") |

**Sources (read this session):**
- Guide: `https://code.visualstudio.com/api/language-extensions/embedded-languages` (the "Request Forwarding" section, NOT "Language Services").
- Sample: `https://github.com/microsoft/vscode-extension-samples/tree/main/lsp-embedded-request-forwarding` — `client/src/embeddedSupport.ts` (`getCSSVirtualContent`) + `client/src/extension.ts` (the interceptor).
- Command reference: `https://code.visualstudio.com/api/references/commands` (`vscode.executeCompletionItemProvider`, `executeHoverProvider`, `executeDefinitionProvider`, `executeSignatureHelpProvider`).

The sample's host is an LSP-based HTML extension that intercepts via `middleware.provideCompletionItem`. **Our non-LSP substitution:** a plain `vscode.languages.registerCompletionItemProvider({language:"quarto"}, …)` whose body runs the *same recipe*. The forwarding core (content provider + `executeCompletionItemProvider`) is **structurally the sample's recipe, but written independently (clean-room — §2.1), not copied**, with documented deltas: our own scheme name, a `lastIndexOf(".")` extension parse (NOT the sample's hardcoded `-4` — §2.4), and a plain `registerCompletionItemProvider` instead of LSP middleware. *Read the sample for the recipe; do not paste its code.*

### 2.3 Offset-mapping strategy — **🐉 the load-bearing decision** (whole-doc blanking → identity mapping)

| Strategy | Offset mapping | Cross-cell same-language state | Edit-remap of results | Verdict |
|---|---|---|---|---|
| **Whole-document blanking** (one vdoc per language; every non-matching char → space, newlines preserved; matching cell bodies kept in place) | **Identity** — pass `position` unchanged, return result unchanged | **Preserved** (all `{python}` cells coexist in the one python vdoc → an `import` in cell 1 is visible to cell 2) | **None** for completion/hover | **[CHOSEN]** |
| Per-cell extracted vdoc (just the one cell's body) | Real bidirectional translation (`virtualLine = qmdLine − cellStartLine`; every returned `Range`/`textEdit`/`additionalTextEdits` shifted back) | **Lost** (each request sees one cell) | Required, error-prone | Rejected — this is the "offset-math risk" the parent plan feared; the guide avoids it for exactly these reasons |

**Why identity mapping holds (and is CRLF-safe):** the guide blanks **per line** — `text.split("\n").map(line => " ".repeat(line.length)).join("\n")` — then restores the embedded regions. Because each line is replaced by spaces of *equal length* and the `\n` join is preserved, the virtual doc has the **same character count and the same newline positions** as the source, so offset *N* (and `(line,col)`) is identical in both. This survives **CRLF**: splitting on `\n` leaves a trailing `\r` in each line, which `line.length` counts and `" ".repeat` replaces with a space — CR→space changes the character but **preserves length** (the model's `Cell.code` is LF-normalized, model.ts:51/516, so we must blank from the **raw document text**, not from `Cell.code`, and operate **line-based** rather than offset-slicing to stay CRLF-safe — see §5).

**Consequence for the plan:** the "offset mapping" hazard collapses to **one pure function** — `buildVirtualContent(text, languageId)` whose only obligations are (a) keep exactly the matching cells' interior body lines, (b) blank everything else to equal-length space runs, (c) preserve every newline. That function is headlessly unit-testable (assert `result.length === text.length`, newline positions identical, only matching-cell body lines non-blank). The dragon becomes a test target, not a runtime risk.

**⚠ The one thing identity-mapped result passthrough does NOT cover (a High risk — §7):** a returned completion item's **secondary** edits — `additionalTextEdits` (e.g. an auto-import the language server anchors at the module top) and any post-accept `command` — come back in vdoc coordinates that, under whole-doc blanking, identity-map to **valid `.qmd` offsets that frequently lie OUTSIDE any cell body** (module top = vdoc line 0 = the `.qmd`'s `---` front matter). So "return the CompletionList unchanged" is safe **only for the primary cursor-range insertion**; the secondary edits must be **region-filtered** (drop any whose range is not inside a same-language cell body — §5, §6 6e-1). This is a structural consequence of whole-doc blanking, **not** a coordinate-translation bug — region membership, not coordinate validity, is the guard.

### 2.4 The fragile/undocumented mechanics (parse/handle DEFENSIVELY)

- **Virtual-doc URI convention:** `quarto-embedded://<languageId>/<encodeURIComponent(originalUri)>.<ext>`. The trailing **file extension drives language routing** (`.py`/`.r`/`.jl`/`.js`) — it is what makes VS Code resolve the vdoc's languageId. The sample's content provider parses the original URI with `uri.path.slice(1).slice(0,-4)` — the **`-4` is hardcoded to `.css`**; for Quarto the extensions differ in length (`.py`=3, `.r`=2, `.jl`=3, `.js`=3), so **parse the extension by `lastIndexOf(".")`, never copy the `-4`** (gotcha confirmed in the sample read).
- **Edit-sync:** VS Code caches virtual-doc text. Either **rebuild + re-store the Map on every request** (the sample's approach — simplest, correct) and/or fire `onDidChange(vdocUri)`. v1: rebuild-per-request.
- **Trigger-character propagation:** pass `context.triggerCharacter` as the 3rd arg to `executeCompletionItemProvider`, and register our quarto provider with the **union of the embedded languages' trigger characters** (e.g. `.`, `(`) so VS Code actually invokes us on them.
- **No re-entrancy:** the vdoc's languageId is `python`/`r`/`julia`/`javascript`, **never `quarto`**, so `executeCompletionItemProvider` against the vdoc runs the embedded language's providers — not ours — and cannot re-enter our quarto provider (no infinite loop). Scope the provider to `{language:"quarto"}`, never to the `quarto-embedded` scheme.
- Add **`vscode.executeCompletionItemProvider` re-dispatch behavior + the URI scheme** to the project's "re-verify on a VS Code API upgrade" mental list (analogous to the `quarto --paths` markers, Learnings #4/#8/#11/#27).

### 2.5 Graceful degradation (no extension installed)

`executeCompletionItemProvider` returns an empty/zero-item list when **no extension is registered for the embedded language** (e.g. the user has no Python extension). 6e must degrade exactly like coloring and run-cell do (Learning #6/#13): return `undefined`/empty (so VS Code shows nothing extra — never a crash), optionally a **one-time, non-blocking** hint ("install the Python extension for in-cell completion"). **Never throw.** R/Julia/OJS completion only works if the user has those extensions — that is expected and acceptable.

---

## §3. Scope — 6e is 2 core capabilities (+3 optional), not one session

An adversarial scope check confirms 6e is **not** one session. It varies on two independent axes:

- **Request type** (the vertical axis): completion → hover → definition → signature help. Each is the *same* forwarding mechanism but a *different* `execute*Provider` command and a *different* result-handling obligation: **completion** — filter out-of-cell *secondary* edits (`additionalTextEdits`/`command`; §2.3/§7 High row), no position remap; **hover** / **signature help** — none (identity-mapped ranges, no URI, no edits); **definition** — URI-swap the returned `Location`s back to the `.qmd`. These are independently shippable user-visible capabilities (4 request types → slices 6e-1/2 completion, 6e-3 hover, 6e-4 definition, 6e-5 signature help).
- **Language set** (a data axis): python first (tracer), then r/julia/ojs (a static map grows + multi-language vdoc + degradation).

**Binding "do not violate" slicing rules:**
1. **No horizontal pure-core-only session** (FM #25). The blanking/gate core must ship *inside* a slice that also wires the provider and proves an end-to-end forward. 6e-1 is the tracer bullet (infra + python + a working completion), never "build `core/embedded/*` with no provider."
2. **No bundling two request types** (FM #26). Completion, hover, and definition are separate slices/sessions — they have different remap obligations and different faithful-verification harnesses.
3. **No bundling the plan with code** (FM #18). This planning session ships only this document.
4. Slice smallest-surface-first and isolate the residual hazard: 6e-1 gets the machinery right with ONE language; 6e-4 isolates the only result-remap (definition URI-swap).

(6e-1 and 6e-2 *may* be collapsed into one session **only** if, after 6e-1, the executor confirms the language-map + degradation is genuinely trivial — see §9 Q3. Default: separate.)

---

## §4. Evidence-based inventory (MANDATORY — grep-verified, confirmed firsthand this session)

6e is **additive** (new files only; no deletion/rename/migration), so the inventory is a reuse/gaps map, not a reference-deletion sweep.

> **Inventory re-verified at close-out (2026-06-30).** An independent 6-agent fan-out re-greped all 30 §4 / §2.1 citations against the live tree: **29 confirmed verbatim**; **2 corrected in place** — G5's path (`core/citation.ts` → `src/providers/citation.ts:99`; the line number and the file-URI-guard claim were already correct) and the header's dragons label (`§3` → `§6`, line 330 lives in Phase 6, not §3). No reuse/gap claim was refuted on substance.

### 4.1 Reuse (every row read firsthand in the current tree)

| # | Component | Location (file:line) | How 6e uses it |
|---|---|---|---|
| R1 | `Cell { startLine; endLine; lang; code }` | `src/core/qmd/model.ts:44-53` | The cell at the cursor; `lang` is the engine token to route on. **Line-based; no char offsets, no fence text.** |
| R2 | `findCellAtPosition(text, line): Cell \| null` | `src/core/qmd/model.ts:524-531` | The cursor→cell primitive. **⚠ INCLUSIVE of both fence lines** (`line >= startLine && line <= endLine`, :526) — 6e must itself exclude fences (see G2). |
| R3 | `findAllCells(text): Cell[]` | `src/core/qmd/model.ts:383` | Enumerate executable cells for `buildVirtualContent` (keep matching-language bodies). A view over the one `scanRegions` pass — **do not add a 2nd scanner** (Learning #14). |
| R4 | `findCellOptionLines(text): CellOptionLine[]` | `src/core/qmd/model.ts:406` | The `#|`/`//|` lines belong to the YAML provider's region; 6e must **exclude** them from its cell-body gate (clean partition). |
| R5 | `CELL_INFO` regex / `scanRegions` | `src/core/qmd/model.ts:138, 234` | Defines executable-cell-ness (excludes `{{python}}` display, `{.python}` class, plain ```` ```python ````, tilde fences, ≥4-space indent). 6e inherits this classification. |
| R6 | `cellCodeRange(cell): vscode.Range \| null` (private) | `src/features/execution.ts:167-176` | The existing recipe for turning line-based cell bounds into an interior range (`firstLine=startLine+1`, …). **Confirms the model is line-based, not offset-based** — informs §5's line-based blanking. |
| R7 | `embeddedLanguages` map | `package.json:66-72` | The authoritative engine→languageId pairs (`python→python`, `r→r`, `julia→julia`, `ojs→javascript`). 6e mirrors these as a pure TS map (G3); it is **TextMate-only and cannot route providers**. |
| R8 | YAML provider: `QMD={language:"quarto"}`, gate-before-await, `TRIGGERS` | `src/providers/yaml.ts:25, 33, 52-62` | The registration + gating template to copy: shared selector, `ctx===null → return undefined` **before any `await`** (:60-62), trigger chars. The `:15` comment is the canonical statement that **embedded scopes don't reroute providers** (Learning #15b). |
| R9 | `isReferenceableLine(text, line)` | `src/core/refs.ts:172` | The prose-only gate for the `@` providers. 6e's region (cell body) is the **complement** of this AND of the YAML region — reuse it to write the no-leak regression (no 6e items on a prose line). |
| R10 | Phase 5 delegation: `pickDelegate` / `delegateCommandsFor` / `showNoDelegate` | `src/core/execution-delegate.ts:18, 40-51`; `src/features/execution.ts:215-229` | The precedent for "forward to an external capability + degrade with a clear message, never crash." 6e's degradation (§2.5) mirrors `showNoDelegate`'s non-throwing `showWarningMessage`. |
| R11 | Stand-in delegate test pattern (Learning #13b) | `test/integration/suite/execution.test.ts:28-39, 170-182` | The faithful-verification template: register a stand-in for the external capability and assert the chain routes to it, env-independently. 6e's forwarding tests adapt this (register a stand-in completion provider for `python`). |
| R12 | `activationEvents: ["onLanguage:quarto"]` | `package.json:42-44` | Already present → a provider registered in `activate()` is live on `.qmd` open. **No Learning #13a dead-on-arrival trap** (6e registers a provider, not a context-key-gated keybinding). |
| R13 | offsetAt/positionAt adapter precedent | `src/features/formatting.ts:47-65`; `src/providers/yaml.ts:57` | How adapters map `vscode.Position`↔offset. 6e's adapter needs almost none of this (identity mapping passes `position` straight through), but it is the pattern if any conversion is needed. |

### 4.2 Gaps (what 6e must ADD; nothing to reuse)

| # | Gap | Evidence (file:line) | Built in slice |
|---|---|---|---|
| G1 | **No request-forwarding / virtual-doc machinery exists.** `grep -rE "executeCompletionItemProvider\|registerTextDocumentContentProvider\|provideTextDocumentContent\|embedded-content"` over `src/` returns **nothing** (only integration tests call `executeCompletionItemProvider`). This is genuinely new architecture here. | grep firsthand: 0 hits in `src/` | 6e-1 |
| G2 | **No "cursor is in a cell BODY" predicate.** `findCellAtPosition` is inclusive of fence lines (:526); nothing answers "strictly inside the code body, not a fence, not a `#|` line." | `model.ts:524-531`; `model.ts:406` | 6e-1 |
| G3 | **No pure engine→languageId resolver in core.** The map exists only as declarative grammar config (`package.json:66-72`); `engineFor` (`yaml-context.ts:334`) returns the *execution engine* (knitr/jupyter), not a languageId. | `package.json:66-72`; `yaml-context.ts:334` | 6e-1 (python entry) → 6e-2 (rest) |
| G4 | **No length-preserving virtual-content builder.** `Cell.code` is LF-normalized (`model.ts:516`) so it cannot be sliced into a CRLF source; need a line-based blank built from the raw text. | `model.ts:516` | 6e-1 |
| G5 | **No `quarto-embedded` URI scheme / content provider registration.** | grep: 0 `scheme`/content-provider uses in `src/` except a bibliography file-URI guard (`src/providers/citation.ts:99`) | 6e-1 |

### 4.3 The load-bearing trap (verify before trusting)

Two named traps + one tamed dragon:

1. **🪤 Embedded TextMate scope is NOT a routing key (Learning #6/#15b).** You **cannot** register a `{language:"python"}` provider and expect it to fire inside the `.qmd` — the `meta.embedded.block.python` scope only drives *coloring*. The in-repo comment at `yaml.ts:15` states this. **This is the entire reason 6e needs the virtual-doc forwarding machinery.** Do not attempt a selector shortcut.
2. **🪤 Provider cross-pollination (the recurring trap, now in its third provider).** 6e shares `{language:"quarto"}` with the YAML and `@` providers. Its region must be the **exact disjoint complement**: executable cell **BODY** lines only — *excluding* the opening/closing fence lines (R2 is inclusive) and the `#|`/`//|` option lines (R4, which belong to YAML). Gate via a pure predicate that returns `null` off-region, and add a **both-directions no-cross-pollination regression** (no embedded items on a prose/`@` line or a `#|` line; YAML/`@` still suppressed inside the cell body). Gate **before any `await`** (R8; Learning #27).
3. **🐉 (tamed) Offset mapping.** Resolved by §2.3's whole-doc blanking → identity mapping. The residual obligations are: (a) `buildVirtualContent` must be **length- and newline-preserving** (the headline unit test), (b) edit-sync (rebuild-per-request), (c) **completion's secondary edits** (`additionalTextEdits`/`command`) identity-map to valid offsets *outside* the cell and must be **region-filtered** (§2.3; the §7 High row; a 6e-1 obligation), (d) **definition results carry the vdoc URI** and must be URI-swapped back to the `.qmd` (range is identity-mapped) — isolated in 6e-4.

4. **`.rmd`/`.Rmd` are covered for free; knitr-attribute cells too.** `package.json:53-56` maps `.qmd`, `.rmd`, AND `.Rmd` all to languageId `quarto`, so the `{language:"quarto"}` selector fires in R Markdown documents as well (desirable — their `{r}`/`{python}` cells forward the same way; no separate case). A knitr-attribute info string like ```` ```{r, echo=FALSE} ```` still yields `Cell.lang="r"` (`CELL_INFO` captures group 1 and swallows the trailing attributes — R5), so it routes correctly. Noted so the executor does not treat `.Rmd` as a distinct path.

---

## §5. Interface contracts (interface-first; all core types, never `vscode.*`)

**The §3.3 guardrail (restated, governing):** *"The intelligence core is a pure-TS library that does not import `vscode`. The extension is a thin adapter that registers providers and translates between `vscode.*` types and core types."* Every provider is **`(vscode args) → translate → core fn → translate → vscode result`** (architecture §8:370; 6d plan §5:147). Core functions take/return core types only, so they are unit-testable headlessly and portable to a server.

Contracts grown **just-enough per slice** (annotated). All live under `src/core/embedded/`.

```ts
// core/embedded/lang-map.ts — pure, vscode-free. Mirrors package.json embeddedLanguages (R7/G3).
export interface EmbeddedLang {
  /** The VS Code languageId to forward to. */ languageId: string;  // "python" | "r" | "julia" | "javascript"
  /** The virtual-doc file extension (drives VS Code language routing — §2.4). */ ext: string; // "py" | "r" | "jl" | "js"
}
// 6e-1: python only. 6e-2: + r, julia, ojs (and the js/javascript aliases). Returns null for any
// engine token outside the mapped set → 6e returns undefined (no forwarding) for that cell.
export function cellLanguageId(lang: string): EmbeddedLang | null;
```

```ts
// core/embedded/virtual-doc.ts — pure, vscode-free. The heart of 6e (G2/G4); headlessly unit-tested.

/** What 6e found at the cursor: the forwardable cell's engine + its routing target. null off-region. */
export interface EmbeddedHit { lang: string; languageId: string; ext: string; }

/**
 * The gate (G2). Returns a hit ONLY when `line` is an interior code-BODY line of an executable cell
 * whose engine maps (cellLanguageId !== null): i.e. line strictly between the fences (terminated:
 * startLine < line < endLine; unterminated: startLine < line <= endLine), AND not a #|//| option line
 * (findCellOptionLines), AND cellLanguageId(cell.lang) !== null. null on fences, #| lines, prose,
 * front matter, comments, and unmapped-language cells. A view over findCellAtPosition + findAllCells +
 * findCellOptionLines — NO new scanner (Learning #14).
 */
export function embeddedCellAt(text: string, line: number): EmbeddedHit | null;

/**
 * The blanking function (G4). Returns a virtual document for ONE languageId: every line that is an
 * interior code-body line of a cell whose cellLanguageId(...).languageId === languageId is kept VERBATIM
 * from `text`; every other line (prose, YAML, fences, #| option lines, other-language cells) is replaced
 * by a space-run of EQUAL length; newlines preserved. CONTRACT (the headline tests):
 *   buildVirtualContent(text, L).length === text.length  &&  identical newline positions  (identity map)
 * Built LINE-BASED from the RAW `text` (never from Cell.code, which is LF-normalized) → CRLF-safe (§2.3).
 */
export function buildVirtualContent(text: string, languageId: string): string;
```

```ts
// providers/embedded.ts — thin vscode adapter (the impure plumbing). Added in 6e-1, extended 6e-3/6e-4/6e-5.
//
// registerEmbeddedLanguageFeature(context):
//   1. const SCHEME = "quarto-embedded"; const vdocs = new Map<string,string>();   // key === the vdoc URI's path-without-leading-slash
//   2. registerTextDocumentContentProvider(SCHEME, {
//        provideTextDocumentContent(uri) { return vdocs.get(uri.path.slice(1)); } });  // SYMMETRIC lookup — no decode, no ext-strip
//   3. registerCompletionItemProvider({ language: "quarto" }, completionProvider, ...TRIGGERS);  // TRIGGERS = union of the embedded
//                                                                     //   languages' trigger chars, passed as REGISTRATION ARGS (not a
//                                                                     //   package.json contribution — yaml.ts:43 / R8)
//   4. onDidCloseTextDocument(doc => { for (const k of vdocs.keys()) if (k.startsWith(keyFor(doc))) vdocs.delete(k); });  // EVICT — the Map must not grow unbounded (§7)
//
// completionProvider.provideCompletionItems(document, position, _tok, context):
//   const text = document.getText();
//   const hit = embeddedCellAt(text, position.line);
//   if (!hit) return undefined;                                       // gate BEFORE any await (R8; Learning #27); no re-entry (vdoc lang ≠ quarto, §2.4)
//   const content = buildVirtualContent(text, hit.languageId);
//   const key = `${encodeURIComponent(document.uri.toString(true))}.${hit.ext}`;   // the SAME string used to store AND as the URI path
//   vdocs.set(key, content);                                          // rebuild-per-request (edit-sync, §2.4)
//   const vdocUri = vscode.Uri.parse(`${SCHEME}://${hit.languageId}/${key}`);      // path === "/"+key  →  provider's uri.path.slice(1) === key
//                                                                     //   (Uri.parse percent-(de)codes the path — round-trip-ASSERT key===uri.path.slice(1) in a test, §6 6e-1)
//   const list = await vscode.commands.executeCommand<vscode.CompletionList>(
//     "vscode.executeCompletionItemProvider", vdocUri, position, context.triggerCharacter);
//   return filterOutOfCellEdits(list, text, hit);                     // identity map: PRIMARY insertion unchanged; but DROP any item whose
//                                                                     //   additionalTextEdits / divergent textEdit / command range is NOT inside a
//                                                                     //   same-language cell body (via embeddedCellAt) — else an auto-import corrupts
//                                                                     //   the front matter (§2.3 caveat, §7). v1 default: itemResolveCount=0 + strip
//                                                                     //   additionalTextEdits (§9 Q5).
```

Notes: the adapter holds **all** `vscode` types (Uri, Position, CompletionList, the content provider, `executeCommand`); the core holds the gate + the blank (zero `vscode` imports). `filterOutOfCellEdits` lives in the adapter (it walks `vscode.CompletionItem` types) but decides membership with the **pure** `embeddedCellAt` (a returned edit's range → is its line a same-language cell body?). Hover (6e-3), definition (6e-4), and signature help (6e-5) reuse `embeddedCellAt` + `buildVirtualContent` + the same vdoc/scheme — only the `execute*Provider` command and the result-handling differ.

---

## §6. The slices (each = ONE session, strict TDD, vertical)

**Per-slice format (verbatim house directive):** *Goal → New/changed files → What DONE looks like → Verify → Dragons (🐉) → Session boundary.* The **5-file-per-commit** cap (SAFEGUARDS) holds with a **checkpoint commit at each layer boundary** (core → adapter → integration). Verification runs the full matrix at **each** boundary (vertical-slice gate c).

### Slice 6e-1 — Python completion forwarding (the tracer bullet + shared infra)

- **Goal:** With the cursor inside a `{python}` cell body, typing forwards the request to the user's Python extension and shows its completions; nothing appears on prose, YAML, fence lines, or `#|` lines.
- **New/changed:** `core/embedded/lang-map.ts` (new — `cellLanguageId`, python entry only) · `core/embedded/virtual-doc.ts` (new — `embeddedCellAt`, `buildVirtualContent`) · `providers/embedded.ts` (new — content provider + completion provider + `filterOutOfCellEdits`, gated) · `extension.ts` (+`registerEmbeddedLanguageFeature`) · `test/unit/embedded-virtual-doc.test.ts` + `test/integration/suite/embedded.test.ts` (new). **`package.json`: none** — trigger characters are passed as registration args to `registerCompletionItemProvider` (yaml.ts:43 / R8), NOT a contribution; registering a provider needs no contribution (R12). *Stage across ≥3 checkpoint commits to respect the 5-file cap.*
- **DONE:** (1) unit: `buildVirtualContent(text,"python")` keeps only `{python}` body lines, blanks the rest (incl. fences and `#|` lines), `result.length === text.length`, newline positions identical (incl. a CRLF fixture); `embeddedCellAt` returns a hit on a python body line and `null` on the opening/closing fence, a `#|` line, prose, and a `{r}` cell; the vdoc key round-trips (`Uri.parse(built).path.slice(1) === key`). (2) integration (test-electron, **stand-in** python completion provider per R11/Learning #13b): triggering completion inside a `{python}` cell returns the stand-in's item; **no embedded item** on a prose `@` line or a `#|` line (both-directions regression, §4.3); YAML/`@` completion still fires in their regions. (3) an item carrying an `additionalTextEdits` whose range is in the front matter is **dropped** (or `itemResolveCount=0` + `additionalTextEdits` stripped) — **accepting a completion never mutates the front matter / prose** (§2.3 caveat, §7 High row).
- **Verify:** `npm test` (unit RED→GREEN: blanking length/newline invariants + the gate predicate); `npm run test:integration` (the stand-in forward chain + the inverted-gating regression, via `executeCompletionItemProvider`); `npm run compile`; `npm run package` (clean `.vsix`); `grep` confirms no `vscode` import in `core/embedded/`.
- **Dragons (🐉):** the gate MUST exclude fence lines (R2 is inclusive) and `#|` lines (R4) or it cross-pollutes/forwards on non-code; `buildVirtualContent` MUST be length-preserving from the **raw text** (not `Cell.code`) or CRLF docs misalign (§2.3); the content provider MUST parse/key the vdoc URI **symmetrically** (round-trip-assert `key === uri.path.slice(1)`, §5) — do not copy the sample's `-4` (§2.4); **out-of-cell secondary edits** (auto-import `additionalTextEdits`) MUST be filtered/stripped or accepting corrupts the front matter (§2.3, §7 High row). **Faithful-test viability (the stalled-lens gap — verify here):** confirm the vdoc's languageId actually resolves in the bare `@vscode/test-electron` host so the stand-in fires — `python`/`javascript` ship built-in language definitions, but **`r`/`julia` likely do NOT**, so r/julia stand-in tests (6e-2) may need to register the stand-in by `{scheme:"quarto-embedded"}` rather than `{language:"julia"}`; and the test MUST prove the request forwarded **through the vdoc** (e.g. the stand-in captures the URI it was invoked on), not via a direct quarto-doc hit (§9 Q8; gate d).
- **Boundary:** one session. Close out when python completion forwards and the gating regression is green. **Do not also do R/Julia/OJS, hover, definition, or signature help.**

### Slice 6e-2 — Extend to `{r}` / `{julia}` / `{ojs}` + graceful degradation

- **Goal:** Completion forwards inside `{r}`, `{julia}`, and `{ojs}` cells when the matching extension is installed; when absent, a clean no-op (no crash; optionally a one-time hint).
- **New/changed:** `core/embedded/lang-map.ts` (+r/julia/ojs/js entries) · `providers/embedded.ts` (degradation hint when `executeCompletionItemProvider` yields nothing and no provider is registered) · tests in `test/unit/embedded-virtual-doc.test.ts` (+multi-language: a doc with `{python}`+`{r}` cells → the python vdoc blanks the r cell and vice versa) + `test/integration/suite/embedded.test.ts` (+stand-ins for r/julia; +degradation).
- **DONE:** unit — `cellLanguageId("r"|"julia"|"ojs")` returns the right `{languageId,ext}`; a mixed-language doc yields per-language vdocs that each keep only their own cells (exact full-set equality, Learning #26). integration — a `{r}` cell forwards to an r stand-in; a `{julia}` cell with no provider returns no items and does **not** throw.
- **Verify:** `npm test`; `npm run test:integration` (per-language stand-ins + degradation, gate d); `npm run compile`; `npm run package`.
- **Dragons (🐉):** the engine token for OJS is `ojs` but the languageId is `javascript` (R7) — map it, don't assume identity; verify the multi-language vdoc keeps cross-cell same-language state (an import in `{python}` cell 1 is in the python vdoc for cell 2).
- **Boundary:** one session. Close out when all four mapped languages forward and degrade cleanly. **Do not also do hover or definition.** *(May merge with 6e-1 only per §9 Q3.)*

### Slice 6e-3 *(optional, v2.x)* — Embedded hover

- **Goal:** Hovering a symbol in a code cell shows the language extension's hover.
- **New/changed:** `providers/embedded.ts` (+a `HoverProvider` on `{language:"quarto"}` reusing `embeddedCellAt`+`buildVirtualContent`, forwarding via `vscode.executeHoverProvider`) · tests.
- **DONE / Verify:** integration — hover inside a `{python}` cell returns the stand-in hover provider's content; `undefined` off-region. `npm test`/`test:integration`/`compile`/`package`.
- **Dragons (🐉):** hover results carry a `Range` (identity-mapped — no remap) but **no URI** → return unchanged. Confirm `executeHoverProvider` honors the vdoc content provider the same way.
- **Boundary:** one session. **Do not also do definition.**

### Slice 6e-4 *(optional, v2.x)* — Embedded go-to-definition

- **Goal:** Go-to-definition on a symbol in a cell jumps to its definition within the same `.qmd`.
- **New/changed:** `providers/embedded.ts` (+a `DefinitionProvider` forwarding via `vscode.executeDefinitionProvider`) · `core/embedded/` (+a pure URI/Location remap helper if it can be expressed without `vscode` types, else in the adapter) · tests.
- **DONE / Verify:** integration — definition inside a `{python}` cell resolves to a `Location` **whose URI is the `.qmd` (not the vdoc URI)** and whose range, thanks to identity mapping, points at the correct `.qmd` line. `npm test`/`test:integration`/`compile`/`package`.
- **Dragons (🐉):** **the one residual remap** — `executeDefinitionProvider` returns `Location[]`/`LocationLink[]` carrying the **vdoc URI**; swap it back to the source document URI (range is identity-mapped, so only the URI changes). A definition that points *outside* any embedded region (into blanked space, or to another file) must be passed through or dropped sensibly. **Signature help is NOT bundled here** — it is a distinct request type with its own stand-in harness (§3 rule 2 / FM #26) and needs no remap, so mixing it in would dilute this slice's single URI-swap concern; it is the optional **Slice 6e-5**.
- **Boundary:** one session. Close out when go-to-def resolves to `.qmd` coordinates. **Do not also do signature help.**

### Slice 6e-5 *(optional, v2.x)* — Embedded signature help

- **Goal:** Typing inside a call (e.g. `f(`) in a code cell shows the language extension's signature/parameter hints.
- **New/changed:** `providers/embedded.ts` (+a `SignatureHelpProvider` on `{language:"quarto"}` reusing `embeddedCellAt`+`buildVirtualContent`, forwarding via `vscode.executeSignatureHelpProvider`, registered with the embedded languages' signature trigger chars `(` / `,`) · tests.
- **DONE / Verify:** integration — signature help inside a `{python}` cell returns the stand-in `SignatureHelpProvider`'s `SignatureHelp`; `undefined` off-region. `npm test` / `test:integration` / `compile` / `package`.
- **Dragons (🐉):** signature-help results carry **no URI and no edits** (identity-mapped ranges only) → return unchanged; the secondary-edit hazard (§2.3) does not apply. Use signature trigger chars distinct from completion's.
- **Boundary:** one session.

---

## §7. Failure-mode / risk analysis

| Risk | Severity | Mitigation |
|---|---|---|
| **Provider cross-pollination** (shared `{language:"quarto"}` selector — §4.3 trap 2) | **High** | Gate to cell BODY only (exclude fences + `#|` lines); both-directions no-leak regression; gate before await. The exact recurring Learning #15b/#24/#25 discipline. |
| **Embedded scope mistaken for a routing key** (§4.3 trap 1) | **High** | Do not register a `{language:python}` selector; forward explicitly via vdoc + `executeCompletionItemProvider`. Documented in `yaml.ts:15`. |
| **Secondary-edit corruption** — a completion's `additionalTextEdits` (auto-import) / post-accept `command`, computed by the embedded server at the vdoc's *module top*, identity-maps to a **valid `.qmd` offset OUTSIDE any cell** (front matter/prose), so accepting writes `import …` into the YAML | **High** | Region-filter returned items: DROP any `additionalTextEdits` / divergent `textEdit` / `command` whose range is not inside a same-language cell body (`embeddedCellAt`). v1 default `itemResolveCount=0` + strip `additionalTextEdits`. "Return unchanged" covers the **primary** insertion only. Integration-test that an auto-import completion does not mutate the front matter (§2.3, §6 6e-1). |
| **Virtual-content not length/newline-preserving** (CRLF drift) | **Medium** | `buildVirtualContent` is line-based from raw text; unit-assert `.length` + newline positions on an LF *and* a CRLF fixture (§2.3). |
| **Stale virtual doc after edits** | **Medium** | Rebuild + re-store the Map on every request (the sample's approach); optionally fire `onDidChange` (§2.4). |
| **Diagnostics cannot forward** | Medium (scope) | **Out of scope** — the technique structurally can't (no pull/push command through the vdoc). Documented limitation; would need a real LSP (Tier C). Do not promise squiggles. |
| **`-4` extension-parse bug copied from the sample** | Medium | Parse the vdoc extension with `lastIndexOf(".")`; unit/inline-test the decode for `.py`/`.r`/`.jl`/`.js` (§2.4). |
| **Definition results carry the vdoc URI** | Medium (6e-4 only) | URI-swap back to the `.qmd`; range is identity-mapped. Isolated in 6e-4 with its own remap test. |
| **No language extension installed** | Low | Degrade to `undefined`/empty, never throw; optional one-time hint **gated on a queryable signal, NOT an empty result** (§2.5, §9 Q6; mirrors `showNoDelegate`). |
| **`CELL_INFO` over-detection of glued malformed info strings** (`{python=x}`) | Low | Pre-existing shared-model gap (diagram-regions.ts:18-31 + BACKLOG); 6e inherits it. Not a 6e spot-fix (cross-cutting, FM #18). Malformed input only. |
| **`vdocs` Map grows unbounded** (one entry per (doc,lang), never evicted) | Low | `onDidCloseTextDocument` → delete the closed doc's keys; or keep only the latest per (doc,lang) (§5). Cross-doc/-lang key *collisions* are NOT a risk (key = encoded URI + per-language ext). |
| **Rebuild-per-request cost on large docs** — `buildVirtualContent` blanks the whole doc on every keystroke | Low | O(lines) string work; VS Code debounces/cancels completion. If it ever matters, cache keyed by `document.version`+languageId (deferred — §9 Q7). |
| **Coexistence with Posit's Quarto extension** — if the user also has `quarto.quarto` installed, both may surface embedded completions | Low | Both forward to the SAME underlying language provider, so items are near-duplicates VS Code largely de-dups; offer a `quarto.embeddedCompletion.enable` off-switch (§9 Q6). The operator runs Posit's extension (Learning #19). |
| **Faithful verification (gate d)** — depends on the vdoc languageId resolving in the bare host, and on proving the forward routed *through the vdoc* | Medium | Learning #13b stand-in: register a stand-in provider for the embedded language; assert the chain routes to it env-independently. `python`/`javascript` are built-in; `r`/`julia` may not be → register the stand-in by `{scheme:"quarto-embedded"}` or contribute the association. The stand-in should capture the invoked URI to prove the vdoc path, not a direct hit (§6 6e-1, §9 Q8). |

---

## §8. Alternatives considered

| Alternative | Why not |
|---|---|
| Register a `{language:"python"}` completion provider and rely on the embedded scope to route | **Does not work** — embedded TextMate scopes only color; they do not reroute providers (Learning #6/#15b; `yaml.ts:15`). This is the trap, not the design. |
| Per-cell extracted virtual document | Needs real bidirectional offset translation + remap of every returned `Range`/`textEdit`/`additionalTextEdits`, and **loses cross-cell same-language state**. The guide avoids it; whole-doc blanking is strictly safer (§2.3). |
| Bundle a JS Python/R language service in-process | Huge dependency, duplicates the user's tooling, not MIT-trivial, `npm audit` surface — rejected (§2.2). |
| Out-of-process LSP (Tier C) | Deferred with the LSP decision; 6e explicitly does not need it (architecture §"Tier C"). |
| Build `core/embedded/*` as a standalone no-UI session, then wire it later | Forbidden horizontal slice (FM #25). The core ships inside the 6e-1 tracer bullet. |
| Bundle completion + hover + definition in one session | FM #26 — three request types, three remap obligations, three faithful harnesses. Separate sessions. |

---

## §9. Open questions for the executor (resolve at implementation, not now)

1. **Scheme name:** `quarto-embedded` (proposed) — confirm no collision; the authority segment (`//python/`) is decorative, the **extension** routes the language.
2. **Trigger characters:** the union of the embedded languages' triggers (`.`, `(`, …) vs relying on 24×7 IntelliSense. Pick triggers that don't fire 6e in the wrong region (the gate suppresses anyway, but triggers shape *when* VS Code invokes us).
3. **Collapse 6e-1 + 6e-2?** Default **no** — keep separate for tracer discipline + a tight stand-in test surface. Merging would be a **documented plan revision** (re-confirming the slice contract, Vertical-Slice gate (a)), not a silent runtime call.
4. **`#|` option lines are blanked unconditionally** (decided — this is §5's `buildVirtualContent` contract): they are Quarto directives, not target-language code, and for `ojs`/`js` `#|` is not even a comment. Blanking uniformly keeps the contract simple and never feeds the embedded server non-code. (Re-open only if a future feature needs to surface them.)
5. **`itemResolveCount` + secondary-edit filtering:** **default `itemResolveCount=0` and strip `additionalTextEdits` in 6e-1** (§7 High row). The guard is **region membership, not coordinate validity** — auto-import edits identity-map to *valid* `.qmd` offsets that lie OUTSIDE the cell (the front matter). Only enable item resolution once `filterOutOfCellEdits` (via `embeddedCellAt`) is in place. Structural consequence of whole-doc blanking, not a coordinate-translation problem.
6. **Degradation hint trigger + an off-switch.** `executeCompletionItemProvider` CANNOT report "no provider registered" — it returns an empty list both when no extension is installed AND when an installed extension simply has no suggestion (the common case while typing). **So the hint MUST NOT key on an empty result** (it would nag installed users). Gate any hint on a queryable signal — e.g. `vscode.languages.getLanguages()` not containing the target languageId (note `javascript` is always built-in → OJS never needs a hint) — or default to pure silence. Also consider a `quarto.embeddedCompletion.enable` setting (off-switch; eases coexistence with Posit's extension — Learning #19).
7. **Cross-platform / VS Code-version re-verification** of the `registerTextDocumentContentProvider` + `executeCompletionItemProvider` behavior on upgrade (add to the re-verify list, §2.4).
8. **Faithful-test viability (gate d — the stalled-lens gap).** Confirm at 6e-1 that the vdoc's languageId resolves in the bare `@vscode/test-electron` host so a stand-in provider fires: `python`/`javascript` ship built-in language definitions, but `r`/`julia` likely do NOT (no `.r`/`.jl`→languageId association without their extensions). If so, register the r/julia stand-in by `{scheme:"quarto-embedded"}` (or have the extension contribute the association) rather than `{language:"julia"}`, and make the stand-in **capture the URI it was invoked on** to prove the request forwarded **through the vdoc** (not a direct quarto-doc hit).

---

## §10. Per-slice quick reference

| Slice | One-line goal | Key new file(s) | Depends on | Session(s) |
|---|---|---|---|---|
| 6e-1 | Python completion forwards into a `{python}` cell | `core/embedded/lang-map.ts`, `core/embedded/virtual-doc.ts`, `providers/embedded.ts` | — (builds infra) | 1 |
| 6e-2 | R / Julia / OJS completion + graceful degradation | (extends lang-map + provider) | 6e-1 | 1 |
| 6e-3 *(opt)* | Embedded hover | (extends `providers/embedded.ts`) | 6e-1 | 1 |
| 6e-4 *(opt)* | Embedded go-to-definition | (extends provider + URI-swap remap) | 6e-1 | 1 |
| 6e-5 *(opt)* | Embedded signature help | (extends `providers/embedded.ts`) | 6e-1 | 1 |

**Recommended stopping points:** after **6e-1** (the high-value tracer: completion in `{python}` cells) or after **6e-2** (all four mapped languages — a complete 6e milestone). 6e-3/6e-4 are optional same-mechanism extensions.

*End of plan. This is a planning deliverable — not a license to start coding. The first executor session should start with **Slice 6e-1** and close out when python completion forwards with the inverted-gating regression green.*
