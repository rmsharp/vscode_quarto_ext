# Plan — Embedded-LSP virtual-document scheme migration + semantic highlighting

**Session:** 86 (PLANNING) · **Date:** 2026-07-12 · **Workstream:** `ARCHITECTURE_WORKSTREAM.md`
**Backlog:** item 16 (semantic highlighting via the embedded language's LSP) — **plus a shipped defect this plan's grounding uncovered.**
**Status:** PLAN ONLY (v2). Implementation is a separate session per slice (FM #18/#19). Strict TDD applies to those sessions.

> **v2 note.** The v1 draft was subjected to a 138-agent adversarial review (7 refutation lenses × 2
> independent skeptics + a completeness critic): **65 candidates → 46 survivors**. Every load-bearing
> survivor was re-verified firsthand by the author and fixed **at the root** by rewriting rather than
> patching (Learning #7 — avoid cross-reference drift). Three of v1's own claims were **wrong** and are
> corrected here: the root-cause narrative (§3), the Posit location fact (§2.4), and the
> cache-invalidation mechanism (§5.4). What survived is recorded; what was refuted was deleted.

---

## §0 — Headline: item 16 is blocked by a defect in shipped code, and they share one root cause

This session set out to plan semantic highlighting. The mandatory assumption-verification step
(`ARCHITECTURE_WORKSTREAM.md` Phase 2 Step 7) instead found that **the virtual-document architecture
every embedded-language feature is built on does not reach real language servers.**

Established firsthand (§2), each with a passing control in the same run:

1. **Semantic tokens cannot ride the current virtual-document architecture — for any language.**
   Not Pylance, and not even VS Code's own built-in TypeScript/JavaScript provider.
2. **The root cause is the URI *scheme*, not semantic tokens.** Language servers filter by scheme in
   their LSP `documentSelector`. Our vdocs use custom schemes (`quarto-embedded`,
   `quarto-outline-symbols`, `quarto-format-cell`), which real servers silently ignore.
3. **Consequently, shipped features are broken in production.** `{python}` completion, hover,
   go-to-definition, signature help, and in-cell outline symbols return **nothing** from real Pylance.

**One root fix — moving the vdoc to a `file:` URI — repairs the shipped features *and* unblocks item 16.**
Posit's extension independently made that same choice (§2.4). This plan is one architectural change
delivered in slices: **Slice 0 repairs the foundation; Slices 1–3 build semantic highlighting on it.**

> **Scope note (FM #26).** Slice 0 and Slices 1+ are *separate sessions*, not one mega-slice. They are
> planned in one document because they are one root cause and Slice 1 is meaningless without Slice 0.
> Operator ratified this scope at the S86 kickoff.

---

## §1 — Context

### 1.1 What item 16 asked for

> *Since v1.127.0, Posit layers VS Code semantic-tokens highlighting (from e.g. Pylance) on top of
> static TextMate grammar coloring for embedded code. A new `SemanticTokensProvider` mechanism, not a
> registration/config change. Likely warrants its own planning session.* — `BACKLOG.md` item 16

### 1.2 The prior that had to be tested, not trusted

BACKLOG **item 10** (code-cell *diagnostics* forwarding) was **CLOSED as not-pursuable** (Session 69):
request-forwarding is pull-based; diagnostics are push-only. Semantic tokens *look* pull-based, which
would put them on the same footing as the four forwards already shipped in `src/providers/embedded.ts`.

**That analogy is exactly the kind of claim this project has been burned by** (Learnings #91/#92/#93:
*treating a plan as a checklist to transcribe rather than a claim to test*). It was tested. It is false
in a way nobody predicted — and the failure is **not** where item 10's was.

### 1.3 Hard constraints

| Constraint | Source |
|---|---|
| MIT licensing; no code copied from Posit's AGPL extension (facts/APIs only) | Learning #1 |
| No bundled language servers; delegate to what the user already has installed | Project posture, Phase 5/6e |
| Degrade gracefully: no language extension → fall back to the TextMate grammar, never to nothing | 6e §2.5 |
| Pure logic in `core/` (vscode-free, unit-tested); `vscode` only in adapters | Architecture §3.3 |
| Strict TDD on every implementation slice | `CLAUDE.md` (operator directive) |

---

## §2 — Empirical grounding (the spike)

All results firsthand, in a real Extension Development Host (VS Code **1.128**) with **real Pylance**
(`ms-python.vscode-pylance-2026.2.1`) + `ms-python.python-2026.4.0` loaded from an isolated
`--extensions-dir`, a real interpreter, a real workspace folder. Spike sources and raw logs: session
scratchpad (`spike-src/`, `pylance*.log`, `fresh.log`, `leak2.log`, `disc.log`). Operator approved the
Pylance-loaded run.

### 2.1 The API surface (read out of the shipped 1.128 bundle, then confirmed at runtime)

**There is no `vscode.executeDocumentSemanticTokensProvider`.** The family is named `provide*`, not
`execute*` — a plan reasoning by analogy from `executeCompletionItemProvider` would have prescribed a
command id that does not exist:

| Command | Args | Returns |
|---|---|---|
| `vscode.provideDocumentSemanticTokens` | `[Uri]` | `SemanticTokens` (`data: Uint32Array`) |
| `vscode.provideDocumentSemanticTokensLegend` | `[Uri]` | `SemanticTokensLegend` |
| `vscode.provideDocumentRangeSemanticTokens` | `[Uri, Range]` | `SemanticTokens` |
| `vscode.provideDocumentRangeSemanticTokensLegend` | `[Uri, Range]` | `SemanticTokensLegend` |

They are ext-host **API commands**: callable via `executeCommand`, but **not enumerated by
`vscode.commands.getCommands(true)`**. *(Do not write a test that asserts their presence via
`getCommands` — it fails while the command works. Cost the author a cycle.)*

### 2.2 Three mechanics that differ from every existing forward

Established with a **stand-in** provider, so these are properties of *VS Code*, not of any one server:

| # | Finding | Consequence |
|---|---|---|
| **M1** | `provideDocumentSemanticTokens` does **not** force-open the document model. Against an unopened vdoc it returns `undefined`; the provider is **never invoked**. `await workspace.openTextDocument(vdocUri)` first, and it works. Visibility is irrelevant. *(Posit's bundle calls `openTextDocument` on its vdoc too — independent corroboration.)* | Copying the `embedded.ts` pattern verbatim yields a provider that **silently returns nothing**. |
| **M2** | Once the model is opened, VS Code **caches** it. Overwriting a `TextDocumentContentProvider`'s backing content at a stable URI serves **stale** text forever; firing `onDidChange` fixes it. | Any model-opening forward needs an invalidation strategy or highlighting freezes at the first keystroke. |
| **M3** ⚠ | **Rewriting an on-disk `file:` vdoc DOES invalidate the model — but ASYNCHRONOUSLY.** Measured: after `writeFile`, the *immediately* following request returned the **STALE** token count; it converged only after **≈1017 ms**. | **The file watcher is NOT a synchronous invalidation primitive.** A write-then-request sequence with no convergence step tokenizes stale text on **every** edit. This killed v1's design (§5.4). |

**Identity mapping holds and needs no remap.** `buildVirtualContent` blanks non-cell lines to
**equal-length space runs**, so tokens come back already in `.qmd` coordinates. Verified byte-exact: a
`{python}` cell on lines 7–8 produced `[7,0,6,…][1,0,5,…]` → absolute lines 7 and 8. Blanked lines
yield zero tokens.

### 2.3 The wall: real language servers filter by URI scheme

Same host, same Pylance, same content (`import os\nos.\n`), same position:

| Target URI scheme | Completion | Hover | Doc symbols | Semantic tokens |
|---|---|---|---|---|
| `quarto-embedded:` **(ours)** | **0** | **0** | **0** | **none** (no legend) |
| `untitled:` | ✅ 3 `os` members | — | — | ✅ 2 |
| `file:` | ✅ 306 items (`abort`, `chdir`, `getcwd`…) | ✅ 1 | ✅ 2 | ✅ 2 |

**Confounds ruled out.** The failing vdoc was made **visible**, given an **8-second** wait, and its text
asserted to be exactly `"import os\nos.\n"` *at request time*. Still zero. It is the scheme.

**Severity calibration — `{ojs}` is the exception that proves the rule:**

| Forward target | Custom-scheme completion | Custom-scheme semantic tokens |
|---|---|---|
| Pylance (external LSP) — `{python}` | ❌ 0 | ❌ none |
| Built-in TS/JS — `{ojs}` | ✅ 52 items (`charAt`, `slice`, `trim`…) | ❌ **none** |

VS Code's *built-in* TS/JS provider is scheme-agnostic **for completion**, so `{ojs}` completion works
today. **Semantic tokens work for no language at all on a custom scheme** — even built-in. Item 16 is
impossible on the current architecture regardless of language.
**Not tested:** built-in TS/JS semantic tokens on a **`file:`** `.js` document. Slice 3 must probe it
before claiming `{ojs}` semantic highlighting either way. *(The `file:` semantic-token results above are
Python/Pylance, not JS.)*

### 2.4 Corroboration: what Posit actually does (**v1 got this wrong**)

Factual inspection of the installed `quarto.quarto-1.134.0` bundle (design facts only — no code read
for reuse, per Learning #1's look-but-don't-copy gate):

```
workspaceFolders?.find(f => docPath.startsWith(f.uri.fsPath))
  → Uri.joinPath(folder.uri, ".quarto", "vdoc").fsPath      // the vdoc DIRECTORY
join(dir, ".vdoc." + <generatedId>() + "." + ext)           // the vdoc FILENAME
writeFileSync(path, content);  Uri.file(path);  await workspace.openTextDocument(uri)
```

**Posit writes `.vdoc.<id>.<ext>` into `<workspaceRoot>/.quarto/vdoc/`** — a hidden directory under the
workspace root. **NOT** a sibling of the `.qmd` (v1's claim — an inference the author never verified,
and the review correctly attacked) and **not** the OS temp dir. The id is **generated per call**, so
each computation gets a **fresh path** — which is precisely how they dodge M2/M3 (§5.4).

This independently confirms: the **`file:` scheme**, the **mandatory `openTextDocument`** (M1), and the
**fresh-path-per-computation** invalidation strategy.

### 2.5 What did *not* reproduce (recorded so the next session does not re-litigate it)

- **Problems-panel diagnostics leakage: NOT observed.** A `file:` vdoc containing a genuine error
  (`undefined_name_xyz + 1`), with the model opened and **proven processed by Pylance** (semantic tokens
  returned), published **0 diagnostics** on the vdoc and **0** vdoc URIs into the global diagnostics set
  (10 s settle). ⚠ **Caveat, and it is load-bearing:** this was under Pylance's **default**
  `diagnosticMode: openFilesOnly`. A user on `diagnosticMode: workspace` is **untested**, Posit hit
  exactly this class of bug (`quarto-dev/quarto` PR #832), and `BACKLOG.md` already carries an open item
  for it. **Slice 0 must re-probe under both diagnostic modes.** Do not treat "not observed" as "cannot
  happen."
- **The dot-prefix is not fatal.** `.vdoc.x.py` (hidden) and `vdoc-x.py` (visible) returned **identical**
  results (3 semantic tokens, 3 `os` completions). Pyright/Pylance's default `**/.*` exclude does not
  suppress an explicitly-opened file. *(An earlier probe suggested otherwise; that was a no-retry timing
  artifact, not a real exclusion.)*
- **An indented cell body** (`  x = 1` at module level, from a cell nested in a list) produced **0**
  diagnostics — no IndentationError surfaced.

---

## §3 — Root cause (**v1's account was inverted — corrected**)

`vscode-languageclient` registers a server's providers against a `documentSelector` scoped to the
schemes the server can read — typically `[{scheme:'file'},{scheme:'untitled'},{scheme:'vscode-notebook-cell'}]`.
A custom scheme is not in that set, so **no provider is ever registered for our vdoc**, and
`executeXxxProvider` correctly returns nothing. No error, no warning, no way to detect it from inside
the extension.

**Why the tests never caught it — the real mechanism.** v1 claimed the stand-ins were registered as
`{ language: "python" }` (a selector with no scheme filter, matching any scheme). **That is backwards.**
Firsthand: every stand-in is registered as **`{ scheme: <our-custom-scheme> }`** — a selector with **no
language filter, pinned to the exact axis real servers filter on**:

`test/integration/suite/embedded.test.ts:77` (completion), `:405`/`:430` (hover), `:654` (definition),
`:885` (signature help); `test/integration/suite/outline.test.ts:55`; `test/features/format-cell.test.ts:37`.
**Zero** occurrences of `{ language: "python" }` as a provider selector anywhere in the suites.

So the suite was **structurally incapable** of detecting the defect: it asserted that a request reaches a
provider registered *on our scheme*, which is trivially true and says nothing about whether any *real*
server registers on that scheme. The generalizable lesson is sharper than "doubles are permissive":

> **A test double registered on the same axis the real dependency discriminates by cannot detect that the
> real dependency rejects that axis.** (Learning, §11.)

**Direct consequence for Slice 0:** migrating to `file:` makes **all six stand-in registrations stop
firing**, and a naive `{ scheme: "file" }` replacement is *unusable* — it would fire for every file in
the test host and collide with real providers. Slice 0 must re-key them explicitly (a glob
`{ scheme: "file", pattern: "**/.vdoc.*" }`, or assert on the recorded `document.uri.path`). **This is
a required sub-task, not an incidental test edit.**

---

## §4 — Evidence-based inventory (grep, 2026-07-12)

**Three** custom schemes, three content-provider stores, six forwards:

| # | Feature | File | Scheme const | Forward | Status vs real Pylance |
|---|---|---|---|---|---|
| 1 | Embedded completion / hover / definition / signature-help (6e) | `src/providers/embedded.ts:34` | `quarto-embedded` | `executeCompletionItemProvider` `:164`, `executeHoverProvider` `:221`, `executeDefinitionProvider` `:273`, `executeSignatureHelpProvider` `:359` | **BROKEN (proven)** for `{python}`; `{ojs}` works |
| 2 | Outline in-cell symbols | `src/providers/outline.ts:49` | `quarto-outline-symbols` | `executeDocumentSymbolProvider` `:239` | **BROKEN (proven)** — `file:` → 2 symbols, vdoc → 0 |
| 3 | Format cell | `src/features/format-cell.ts:41` | `quarto-format-cell` | `executeFormatDocumentProvider` `:129` | **UNPROVEN** — architecturally identical, but no Python formatter extension was in the isolated host, so even `file:` returned 0 edits. **Do not claim broken; do not claim working. Slice 0 re-probes with `ms-python.black-formatter` present.** |

**Shared core (vscode-free):** `src/core/embedded/virtual-doc.ts` — `embeddedCellAt`,
`buildVirtualContent` (all cells of one language), `buildCellVirtualContent` (exactly one cell).
`src/core/embedded/lang-map.ts` — `cellLanguageId`, `needsLanguageExtension`.

**Stores (all three deleted by Slice 0):** `VirtualDocStore` (`embedded.ts:86`), `InCellSymbolStore`
(`outline.ts:103`), `FormatCellVirtualDocStore` (`format-cell.ts:61`).

**Wiring:** `src/extension.ts:50` `registerFormatCellFeature`, `:54` `registerOutlineProvider`,
`:61` `registerEmbeddedLanguageFeature`.

**🔑 Concurrency fact that constrains the design:** `outline.ts:175` and `:207` forward **every cell
concurrently** via nested `Promise.all`, each reaching `store.set(docUri, cell.startLine, …)`. Its vdoc
URI is keyed by **cell start-line AND a version counter** (`outline.ts:131-135`). Any shared vdoc key
that lacks a cell discriminator therefore produces a **write race** in which cells receive each other's
symbols. (§6.1.)

**Docs that assert the now-false parity** (must be corrected in Slice 0, not deferred):
`docs/POSIT-COMPARISON.md:286` (*"Ours: Present for completion/hover/go-to-definition/signature-help"*)
and `:301` (*"We still match on substance for completion/hover/go-to-def/signature-help across all four"*).

---

## §5 — Design decisions

### 5.1 D1 — Where the vdoc lives (**the load-bearing decision**)

| Option | Servers accept? | Pros | Cons | Verdict |
|---|---|---|---|---|
| **A. Keep custom scheme** | ❌ No (proven) | No change | Feature does not work; item 16 impossible | **Rejected — refuted** |
| **B. `untitled:`** | ✅ Yes (proven) | No disk writes | Cannot use `TextDocumentContentProvider`; untitled docs join the dirty/unsaved set and can trigger a **"Save changes?"** prompt; no directory context | **Rejected** |
| **C. `<workspaceRoot>/.quarto/vdoc/.vdoc.<id>.<ext>`** | ✅ Yes (proven) | Real `file:` URI. **One hidden, scoped directory** → the sweeper never touches the user's tree. `.quarto/` is already Quarto's own conventional cache dir (commonly gitignored). Cannot collide with user files. **This is what Posit ships.** | Still writes into the workspace; needs `.gitignore` guidance; no workspace folder → needs a fallback | **RECOMMENDED** |
| **D. Sibling `.vdoc.<id>.<ext>` next to the `.qmd`** | ✅ Yes | Same-directory module resolution for relative imports | Litters every content directory; sweeping means walking the user's tree (dangerous, §6.3); v1 wrongly claimed this was Posit's design | **Rejected** |
| **E. OS temp dir** | ✅ Yes | No workspace pollution | Writes the user's source into a world-shared dir at a predictable path (**information disclosure + symlink/TOCTOU**); loses directory context | **Fallback only**, via `mkdtemp` (0700), never a predictable path |

**Recommendation: C**, with **E-via-`mkdtemp`** only when there is no workspace folder.

> 🐉 **Dragon — namespace collision with Posit.** Posit uses **exactly** `<root>/.quarto/vdoc/.vdoc.<id>.<ext>`.
> Many users (including this operator) have **both** extensions installed. If we use the same directory
> *and* the same filename shape, our sweeper will **delete Posit's live vdocs** and vice-versa.
> **Therefore: use a distinct directory — `<workspaceRoot>/.quarto/vdoc-mit/`** (still under `.quarto/`,
> so it inherits the same gitignore convention) and sweep **only** that directory. **Never** a
> workspace-wide recursive delete by filename pattern. **Q1 for the operator.**

### 5.2 D2 — Cache invalidation (**v1's answer was wrong; M3 refutes it**)

v1 said "write the file and VS Code's file watcher invalidates the model — no event plumbing at all."
**M3 proves that is racy**: the request immediately after a write sees stale text, converging only after
≈1 s. On a per-keystroke provider that means highlighting is persistently one edit behind.

| Option | Mechanism | Verdict |
|---|---|---|
| Rely on the watcher | write → request | ❌ **Refuted by M3** (≈1 s stale window) |
| Await convergence | write → poll/await until `openTextDocument(uri).getText() === content` | Workable; polling is ugly; needs a timeout |
| **Fresh path per computation** | mint `.vdoc.<id>.<ext>` with a **new id each computation**; delete the previous | ✅ **RECOMMENDED** — no cached model exists, so there is nothing to invalidate and **no race**. |

**Fresh-path-per-computation is doubly corroborated:** it is what **Posit** does (generated id per call,
§2.4) *and* what **this project's own `outline.ts` already does** (version-stamped URI, `:98`,
`:131-135`).

> **It also resolves the outline RESULT-cache problem.** `outline.ts`'s version-stamped URI does **not**
> defend against a model-*text* cache — it defends against `vscode.executeDocumentSymbolProvider`'s
> **result** cache, which **Learning #78 proves stales a REAL on-disk document too**. Moving to `file:`
> therefore does **not** make it unnecessary. **v1 instructed the implementer to delete it. That would
> have reintroduced Session 71's bug. Do not delete it — generalize it.**

### 5.3 D3 — The vdoc key (**must carry a discriminator**)

A single path per `(document, language)` is **wrong**: outline forwards N cells concurrently onto it
(§4), and the three features write **different content shapes** for the same `(doc, language)`
(`buildVirtualContent` whole-language vs `buildCellVirtualContent` single-cell). The key must be:

```
(documentUri, languageId, kind, cellStartLine?, version)
   kind ∈ { "lang"  (embedded completion/hover/def/sig; semantic tokens)  — whole-language content
          , "cell"  (outline in-cell symbols; format-cell)                — single-cell content }
```
`version` increments per computation (D2). Consumers therefore never collide, and no two concurrent
forwards share a path.

### 5.4 D4 — Our declared `SemanticTokensLegend`

`registerDocumentSemanticTokensProvider(selector, provider, legend)` needs the legend **up front**, but
the server's legend is only knowable at runtime. Pylance's real legend (captured in the spike) is **29
types** — the standard set plus `module`, `intrinsic`, `selfParameter`, `clsParameter`, `magicFunction`,
`builtinConstant`, `parenthesis`, `curlybrace`, `bracket`, `colon`, `semicolon`, `arrow` — and **8
custom modifiers**.

**Declare a static legend = the standard VS Code token types/modifiers, PLUS the foreign names we choose
to carry through.** A foreign name absent from our legend is **dropped** (that token keeps its TextMate
colour — safe degradation, never a *wrong* colour).

> ⚠ **v1 contradiction, now fixed.** v1 said "drop unknown names" *and* relied on the `superType` chain
> (`selfParameter→parameter`) for theming — but a dropped token has no type at all, so it can never reach
> its superType. **Resolve it in Slice 3, explicitly:** either (a) include the foreign names in our
> legend and contribute `semanticTokenScopes` for `language: "quarto"`, or (b) **map** unknown names to
> their `superType` (readable from the extension's `contributes.semanticTokenTypes`) rather than dropping
> them. Dropping is the *fallback*, not the theming strategy.

**Modifier bitset caution:** modifiers are a **bitset**, not an index. Remapping must rebuild the bitset
bit-by-bit against our legend; a naive index copy silently mis-colours. Unknown modifier bits are
cleared, **not** the whole token dropped.

### 5.5 D5 — Multi-language merge

```
mergeSemanticTokens(streams: TokenStream[], ourLegend: Legend): Uint32Array
```
Decode each stream to absolute `(line, char, length, typeName, modifierNames)` → remap names into our
legend → **sort by (line, char)** → re-encode as deltas. Sorting is **mandatory** (VS Code requires
ascending document order; two languages' streams interleave arbitrarily).

### 5.6 D6 — Which languages ship semantic tokens in v1

`{python}` only (proven). `{r}`/`{julia}` come free **if** the user's extension serves tokens on `file:`
— no code difference, so enabled but not *claimed*. `{ojs}`→`javascript`: **untested on `file:`** (§2.3)
— Slice 3 probes it; if built-in TS/JS declines, `{ojs}` keeps TextMate colouring and nothing regresses.

---

## §6 — Interface contracts

### 6.1 `core/embedded/vdoc-path.ts` (NEW — pure, vscode-free)

```ts
export type VdocKind = "lang" | "cell";
export interface VdocKey {
  docUri: string; languageId: string; kind: VdocKind;
  cellStartLine?: number;       // required when kind === "cell"
  version: number;              // increments per computation (D2)
}

/** The vdoc's file NAME. Pure; no I/O. */
export function vdocFileName(key: VdocKey): string;
//  -> ".vdoc.<hash(docUri,languageId,kind,cellStartLine)>.<version>.<ext>"
//  contract: distinct for distinct keys; filesystem-safe; no path separators;
//            NEVER equal to Posit's shape for the same inputs (we live in a
//            different directory anyway -- see D1's dragon).

/** Is `name` one of OUR vdoc artifacts? Drives sweeping. MUST NOT match Posit's. */
export function isOurVdocFileName(name: string): boolean;
```
**Error contract:** pure, total, never throw.

### 6.2 `core/embedded/semantic-tokens.ts` (NEW — pure, vscode-free)

```ts
export interface Legend { tokenTypes: string[]; tokenModifiers: string[]; }
export interface TokenStream { data: Uint32Array; legend: Legend; }

export function decodeTokens(s: TokenStream): AbsToken[];
export function mergeSemanticTokens(streams: TokenStream[], ourLegend: Legend): Uint32Array;
```
**Contract:** output sorted ascending by `(line, char)`; token **types** absent from `ourLegend` are
dropped (or superType-mapped, D4); **modifier** bits absent from `ourLegend` are **cleared, not
token-dropping**; empty input → empty output; a malformed stream (length not a multiple of 5) is treated
as **empty, not thrown** — a bad server must degrade to TextMate colouring, never break the document.

### 6.3 `features/embedded-vdoc.ts` (NEW — the `vscode` adapter all four consumers share)

```ts
/** Write the vdoc, open its model, and return its file: URI. Deletes the previous version. */
export async function ensureVdoc(doc: TextDocument, key: VdocKey, content: string): Promise<Uri | undefined>;
//  - mints a FRESH path (new `version`) per computation -> no cached model -> no M2/M3 race
//  - deletes the PREVIOUS version's file for this key
//  - `await workspace.openTextDocument(uri)` before returning (M1 is MANDATORY)
//  - returns undefined when no writable location exists -> caller degrades to "no forward",
//    exactly as today's no-extension path does. NEVER throws.

/** Delete every vdoc owned by `docUri`, and close its models. */
export async function disposeVdocs(docUri: Uri): Promise<void>;

/** Delete stale vdocs left by a crashed session. Scoped to OUR directory ONLY. */
export async function sweepStaleVdocs(folders: readonly WorkspaceFolder[]): Promise<void>;
```

> 🔒 **Sweep safety (a HIGH review finding).** `sweepStaleVdocs` must be **ownership-scoped**, never a
> pattern-matched recursive delete over the workspace. Hard rules:
> 1. It may only delete inside `<workspaceRoot>/.quarto/vdoc-mit/` — **never** the user's tree, **never**
>    Posit's `.quarto/vdoc/`.
> 2. It must not delete a **concurrently-running second window's** live vdocs. Include a per-window
>    instance id in the filename and only sweep **other** ids that are older than a threshold, or sweep
>    only our own instance's leftovers at activation.
> 3. `disposeVdocs` must also **close the model**, not merely unlink the file — deleting a file does not
>    fire `didClose` to the language server, which would otherwise keep analyzing a ghost document.

### 6.4 `providers/semantic-tokens.ts` (NEW — the item-16 adapter)

```ts
export function registerSemanticTokensProvider(context: ExtensionContext): void;
//  registerDocumentSemanticTokensProvider({language:"quarto"}, provider, OUR_LEGEND)
//
//  provideDocumentSemanticTokens(doc):
//    streams = []
//    for each languageId L present in doc:                    // needs a small core helper (§6.5)
//      content = buildVirtualContent(doc.getText(), L)        // reused UNCHANGED
//      uri     = await ensureVdoc(doc, {kind:"lang", languageId:L, version:++v, ...}, content)
//      if (!uri) continue                                     // graceful degradation
//      legend  = await executeCommand("vscode.provideDocumentSemanticTokensLegend", uri)
//      tokens  = await executeCommand("vscode.provideDocumentSemanticTokens", uri)
//      if (legend && tokens) streams.push({data: tokens.data, legend})
//    return new SemanticTokens(mergeSemanticTokens(streams, OUR_LEGEND))
```
*(`ensureVdoc` performs the `openTextDocument` — M1 — so the provider never has to remember it.)*

### 6.5 Small addition to `core/embedded/virtual-doc.ts`

v1 claimed this module was **unchanged**; that is not viable. §6.4 needs one helper that does not exist:

```ts
/** The distinct forwarding languageIds present in `text` (deduped, stable order). */
export function embeddedLanguagesIn(text: string): string[];
```
Everything else in the module (`embeddedCellAt`, `buildVirtualContent`, `buildCellVirtualContent`) is
genuinely unchanged — the blanking/identity-mapping contract is exactly what makes tokens land in `.qmd`
coordinates.

---

## §7 — The slice plan

> Each slice is **ONE session**. Close out when its DONE criteria are met. Do not start the next.

### Slice 0 — Migrate the vdoc to a `file:` document (**repairs shipped features**)

**Layers:** (L1) `core/embedded/vdoc-path.ts` + unit tests · (L2) `features/embedded-vdoc.ts`
(`ensureVdoc`/`disposeVdocs`/`sweepStaleVdocs`) · (L3) migrate `providers/embedded.ts` · (L4) migrate
`providers/outline.ts` + `features/format-cell.ts`; delete all three content-provider stores.

**Required sub-tasks the implementer will otherwise miss:**
- **Re-key all six stand-in registrations** off `{ scheme: <custom> }` (§3). A `{scheme:"file"}` selector
  is unusable. Use `{ scheme:"file", pattern:"**/.vdoc.*" }` or assert on `document.uri.path`.
- **Every existing embedded/format-cell integration test opens an UNTITLED `.qmd`.** After Slice 0 an
  untitled document has no workspace directory, so the whole suite must move to real on-disk fixtures
  (or the untitled path must route to the `mkdtemp` fallback and be asserted).
- **Do NOT delete outline's version-stamped-URI mechanism** — generalize it (§5.2, Learning #78).
- **Re-probe format-cell** (§4 row 3) with a real Python formatter installed; and re-probe the
  Problems-panel leakage under **both** `diagnosticMode` settings (§2.5).

**DONE when:**
- [ ] `{python}` completion, hover, go-to-definition, signature-help and in-cell outline symbols return
      **real Pylance results** in the real-LSP harness (§10.2).
- [ ] A `.qmd` with **2+ same-language cells** returns distinct, correctly-attributed in-cell symbols
      per cell (the concurrency/collision regression guard, §5.3).
- [ ] An edit followed immediately by a request returns **fresh** tokens/symbols (the M3 race guard).
- [ ] `{ojs}` still works (no regression on the half that worked).
- [ ] No `.vdoc.*` survives closing the document, or a crash + reactivate; the sweep **never** touches
      anything outside our own directory (test it against a decoy `.vdoc.*` in the user's tree **and** a
      decoy in Posit's `.quarto/vdoc/` — both must survive).
- [ ] All three `registerTextDocumentContentProvider` calls are **gone**.
- [ ] `docs/POSIT-COMPARISON.md:286`/`:301` corrected (they currently claim parity for these features).

**Verify:** `check-types` · `npm test` · `npm run test:integration` · **`npm run test:lsp`** (§10.2) ·
`npm run package` · `git status` clean.

🐉 **Dragons:** disk writes in the workspace; the Posit namespace collision (§5.1); sweep safety (§6.3);
the M3 race; the untitled-`.qmd` fixture problem.

### Slice 1 — Semantic tokens, single language (`{python}`)

**Layers:** (L1) `core/embedded/semantic-tokens.ts` `decodeTokens` + single-stream re-encode + the
legend/modifier-bitset remap + unit tests · (L2) `providers/semantic-tokens.ts` + `extension.ts` wiring.

**DONE when:** a `.qmd` with one `{python}` cell yields real Pylance semantic tokens at correct `.qmd`
coordinates (real-LSP harness); no python cells → empty set, never throws; no language extension →
empty set, TextMate colouring intact.

🐉 M1 (the silent `undefined`); the modifier **bitset** remap; ascending-order requirement.

### Slice 2 — Multi-language merge

**Layers:** (L1) `mergeSemanticTokens` + `embeddedLanguagesIn` + unit tests · (L2) provider queries every
language present.

**DONE when:** a `.qmd` mixing `{python}` and `{r}`/`{ojs}` returns one correctly-ordered,
legend-consistent array; a language whose server returns nothing degrades silently.

🐉 N sequential forwards **per keystroke**, each a disk write + `openTextDocument` — **measure it** and
debounce/cache if the cost is real. This is the plan's biggest performance unknown.

### Slice 3 — Theming, `{ojs}`, and the legend decision

Verify real colours in a real window; resolve D4 (superType mapping vs. carrying foreign names +
`contributes.semanticTokenScopes` for `language: "quarto"`); probe built-in TS/JS semantic tokens on
`file:` for `{ojs}`; update `docs/POSIT-COMPARISON.md`'s item-16 row.

---

## §8 — Here be dragons (ranked)

| # | Dragon | Why it bites | Mitigation |
|---|---|---|---|
| 🐉1 | **Sweep safety** | An ownership-blind pattern delete in the user's workspace can destroy Posit's live vdocs, a second window's live vdocs, or user files | §6.3's three hard rules. Scoped directory; instance id; decoy tests. |
| 🐉2 | **M3 — the async watcher** | Write-then-request returns **stale** text for ≈1 s. Silent: highlighting is just always one edit behind | Fresh path per computation (§5.2) |
| 🐉3 | **M1 — the silent `undefined`** | `provideDocumentSemanticTokens` on an unopened model returns nothing, no error. Looks exactly like "no extension installed" | `ensureVdoc` owns the `openTextDocument`. Write the test that fails if it is removed. |
| 🐉4 | **The vdoc key with no cell discriminator** | Outline forwards N cells **concurrently** onto one path → cells get each other's symbols | §5.3's key |
| 🐉5 | **A double registered on the axis under test** | This is what hid the defect. A `{scheme:<ours>}` stand-in can never reveal that no real server registers on `<ours>` | §10.2's real-LSP harness; re-key the six stand-ins |
| 🐉6 | **Deleting outline's version-stamped URI** | It guards a **result** cache that stales real on-disk docs too (Learning #78) — the scheme change does not touch it | §5.2. Generalize, don't delete. |
| 🐉7 | **Problems-panel leakage** | Not observed under default `diagnosticMode`, but Posit hit it (PR #832) and BACKLOG already tracks it | Re-probe under `diagnosticMode: workspace` in Slice 0 |
| 🐉8 | **Per-keystroke disk writes** | Every edit in a code cell writes files in the user's git tree | Write only on content change; debounce; measure (Slice 2) |

---

## §9 — Impact analysis

### 9.1 What changes
**Source:** `providers/embedded.ts`, `providers/outline.ts`, `features/format-cell.ts` (all three lose
their store); new `core/embedded/vdoc-path.ts`, `core/embedded/semantic-tokens.ts`,
`features/embedded-vdoc.ts`, `providers/semantic-tokens.ts`; one helper added to
`core/embedded/virtual-doc.ts` (§6.5); `extension.ts` wiring.
**Tests:** the three integration suites (re-key the stand-ins; move off untitled fixtures); new
`test:lsp` runner + script in `package.json`.
**Docs:** `docs/POSIT-COMPARISON.md` (`:286`, `:301`, item-16 row), `BACKLOG.md` (the defect item),
`CHANGELOG.md`, `README.md` (`.gitignore` guidance for `.quarto/vdoc-mit/`), `PROJECT_LEARNINGS.md`.

### 9.2 What explicitly does NOT change (scope boundary)
`embeddedCellAt`, `buildVirtualContent`, `buildCellVirtualContent`, `lang-map.ts` — the blanking /
identity-mapping contract is what makes tokens land in `.qmd` coordinates. No change to the TextMate
grammar, run-cell delegation, preview, render, or YAML/citation completion. **Item 10 (diagnostics)
stays closed** — a `file:` vdoc does not make push-diagnostics reachable; the vdoc is still not the
user's editor tab.

### 9.3 Failure modes
| Failure | Blast radius | Behaviour |
|---|---|---|
| No language extension | One language | No tokens/forwards; TextMate colouring intact (today's behaviour) |
| No workspace folder / unwritable dir | One document | `mkdtemp` fallback; if that fails, `ensureVdoc` → `undefined` → no forward. Never throws. |
| Malformed token stream | One document | Treated as empty (§6.2). TextMate colouring intact. |
| Crash mid-session | Workspace | Stale vdocs in our scoped dir; swept at next activation |
| Slow server | One keystroke | VS Code cancels slow providers; tokens arrive next pass |

---

## §10 — Verification plan

### 10.1 The gap this plan exists to close
> **A green suite proved nothing.** Every embedded stand-in is registered on `{ scheme: <our-custom-scheme> }`
> — the exact axis real servers discriminate by. Such a double is *structurally incapable* of revealing
> that no real server registers for that scheme. Adding more stand-in tests cannot detect this class of
> defect. **Only a real server can.**

### 10.2 NEW permanent infrastructure: the real-LSP harness (`npm run test:lsp`)

A second `@vscode/test-electron` runner (spike-proven this session; sources in the session scratchpad,
ready to promote) that:
- copies `ms-python.python` + `ms-python.vscode-pylance` into a **throwaway `--extensions-dir`** (never
  the user's own — Posit's `quarto.quarto` registers the same `.qmd` language and collides),
- launches a scratch workspace with a pinned interpreter,
- runs **only** the embedded suites, asserting **real Pylance** results (e.g. `os.` → `getcwd`),
- **carries a CONTROL** on a real `file:` `.py` in the same run, so "Pylance isn't up" is distinguishable
  from "our forward is broken." *A spike without a control is not evidence.*
- **`--user-data-dir` must be short** (`os.tmpdir()`, not the repo): VS Code's IPC socket path has a
  103-char limit and fails `EINVAL` otherwise. *(Cost the author a cycle; documented so it costs the
  implementer none.)*
- **Skips with a loud SKIP (never a silent pass) when Pylance is absent** — the precondition is real and
  must be visible.

### 10.3 Per-slice gates
`check-types` · `npm test` · `npm run test:integration` · `npm run test:lsp` · `npm run package` ·
`git status` clean. **Note:** once `.quarto/vdoc-mit/` is gitignored, `git status` can no longer detect a
stray vdoc — so Slice 0 must assert cleanup **directly** (`fs.readdir` on the vdoc dir), not via
`git status`.

---

## §11 — Learning to record (Slice 0 close-out)

> **A test double registered on the same axis the real dependency discriminates by cannot detect that the
> real dependency rejects that axis.** Our stand-ins were keyed on `{scheme: <our custom scheme>}` — the
> precise thing Pylance filters on — so a 100%-green suite coexisted with a feature that returned nothing
> in production for many sessions. The remedy is not "more doubles" but **at least one test against the
> real dependency**, with a control proving the real dependency was alive.

---

## §12 — Open questions for the implementation kickoff (operator)

1. **🔑 Q1 — Vdoc directory.** `<workspaceRoot>/.quarto/vdoc-mit/` (**recommended** — under Quarto's
   conventional hidden dir, but a *distinct* name so our sweeper can never delete Posit's live vdocs,
   which use `.quarto/vdoc/` with the identical `.vdoc.<id>.<ext>` shape). Alternative: our own
   top-level `.qmd-vdoc/`. *This is the plan's biggest trade-off.*
2. **Q2 — Slice 0 framing.** Ship as a **`fix:`** with a CHANGELOG entry naming the defect and a new
   BACKLOG item (**recommended** — users have a broken feature and deserve to see the fix), or fold it
   silently into item 16's feature work?
3. **Q3 — Priority.** Confirm Slice 0 runs **next session**, ahead of Slices 1–3.
4. **Q4 — `test:lsp` in CI.** Local-only opt-in (**recommended** — Pylance's licence restricts
   redistribution and it cannot be freely downloaded in CI), or attempt CI wiring?
5. **Q5 — `{ojs}` regression risk.** `{ojs}` completion works **today** on the custom scheme. Migrating to
   `file:` should keep it working (built-in TS/JS accepts `file:` too), but it is the one thing that
   currently works and could break. Confirm it is a Slice 0 DONE gate (**recommended: yes**).

---

## §13 — Alternatives considered (honest)

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| **Spawn our own language server** (item 10's Option B; Posit's diagnostics path) | Full control; would also solve diagnostics | Abandons "delegate to what the user has installed"; bundles/manages a server; far larger | Out of proportion; operator already chose Option A for item 10 |
| **Semantic tokens from our own TextMate-derived analysis** | No LSP dependency | Not semantic at all; duplicates the grammar | Defeats the purpose of item 16 |
| **`vscode-notebook-cell:` scheme** | Accepted by ms-python's selector | Owned by VS Code's notebook infrastructure; we have no notebook; forging the scheme is not a supported extension point | Rejected |
| **Do nothing; close item 16 like item 10** | Zero work | Leaves three shipped features broken for `{python}` — the dominant workflow | The defect makes inaction untenable |

---

## §14 — What this plan does NOT do

- It does not implement anything (FM #18). Slice 0 is the next session.
- It does not touch the pre-existing `onDocumentClosed` preview-lifecycle bug (still Polish/deferred).
- It does not claim `format-cell` is broken (§4 row 3 is explicitly **unproven**).
- It does not claim the Problems-panel leakage cannot happen — only that it **was not observed** under
  the default `diagnosticMode` (§2.5).
- It does not resurrect item 10 (diagnostics).
