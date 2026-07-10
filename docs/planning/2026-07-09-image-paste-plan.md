# Image Paste (Phase 7 Authoring Aid): Implementation Plan

**Status:** PLAN (draft for an executor session). Produced by Session 57 (2026-07-09).
**Governs:** `BACKLOG.md` "Phase 7 authoring aids" — remaining slice: **image paste** (`BACKLOG.md:60`). The last unimplemented item in that phase; formatting toggles, math preview, diagram preview (Mermaid + Graphviz), and snippets are all already shipped.
**Scope lock:** register a `vscode.DocumentPasteEditProvider` for `.qmd` documents that, when the paste payload contains image data, writes the image to disk and inserts a Markdown image reference (`![](path)`) at the cursor — replacing VS Code's default fallback (raw base64 / nothing useful) the same way the built-in markdown extension does for `.md` files.
**Out of scope (v1, pending operator sign-off in §4):** drag-and-drop parity (`DocumentDropEditProvider`) — same core, thin mirror adapter, deferred to an operator decision (Q2); a configurable destination-glob setting (VS Code's own `markdown.copyFiles.destination` equivalent) — v1 uses one fixed convention (Q1); alt-text prompting; non-image file types; the Visual Editor (excluded project-wide, Session 43, `BACKLOG.md:31`).

---

## 0. Evidence provenance

Grounded firsthand this session, not from memory or the Phase 7 backlog line's own placeholder wording (`BACKLOG.md:60` says only "image paste," no design detail — this is genuinely undesigned, unlike items #4–6 which were mechanical extensions of an existing pattern).

- **Read the installed `@types/vscode` (1.125.0, `engines.vscode` floor is `^1.90.0`) directly**, not documentation summaries: `vscode.languages.registerDocumentPasteEditProvider`/`registerDocumentDropEditProvider` (`node_modules/@types/vscode/index.d.ts:15271`, `:15293`), the `DocumentPasteEditProvider` interface (`:6351`), `DataTransferFile` (`:11957`, a `data(): Thenable<Uint8Array>` accessor), `DataTransferItem` (`:11979`), and `WorkspaceEdit.createFile`'s `contents?: Uint8Array | DataTransferFile` option (`:4069`). Both registration functions need **zero `package.json` contribution** — same class as `providers/workspace-symbols.ts`'s own header comment already documents for `registerWorkspaceSymbolProvider`.
- **Fetched VS Code's own built-in reference implementation of this exact feature** (`github.com/microsoft/vscode`, MIT — Microsoft's own code, not Posit's AGPL extension, so no look-but-don't-copy gate applies; consulted via `gh api`/`WebFetch` against `extensions/markdown-language-features/src/languageFeatures/copyFiles/{dropOrPasteResource,newFilePathGenerator}.ts` and `src/extension.shared.ts`). **Load-bearing finding: it is registered against a fixed language-ID list, `markdownLanguageIds = ['markdown', 'prompt', 'instructions', 'chatagent', 'skill']`** (`extensions/markdown-language-features/src/util/file.ts:22`, confirmed via `gh api`, not assumed) — `quarto` is not in that list, so **`.qmd` files get zero built-in image-paste support today**, confirming this is a real, unclaimed gap, not a duplicate of existing behavior.
- **Researched Posit's own extension via public sources only** (Learning #1's AGPL-3.0 look-but-don't-copy gate: marketplace listing, `quarto.org` docs, and `quarto-dev`'s public GitHub Discussions/CHANGELOG — never the AGPL extension source itself). Finding: **Posit's source-mode `.qmd` editor does not support clipboard image paste either** — it is an open, unresolved feature request in their own public trackers (`quarto-dev/quarto-cli` Discussions **#7623** "Paste Image in Source editor" and **#4385** "Allow inclusion of images from the clipboard"). Only their AGPL **Visual Editor** (Panmirror, excluded project-wide per Session 43) supports it, saving into a `./images` folder per community discussion (a UX data point, not implementation detail — no source was read). **This means shipping v1 here is not parity catch-up — it is ahead of what Posit's own source editor does today**, a genuine differentiator, not a copy target.
- **Confirmed no `execute*Provider`-style command exists for paste/drop providers** — grepped `@types/vscode` for `executeDocumentPaste`/`executeDocumentDrop`: no match, unlike every other provider type this project has shipped (`vscode.executeWorkspaceSymbolProvider`, `executeCompletionItemProvider`, etc. all exist). This is a real, disclosed integration-testing gap, not an oversight — see §4 D1.
- **Confirmed `DataTransferItem` cannot be test-synthesized as file-backed**: its only public constructor is `constructor(value: any)` (`:11979`); `.asFile()`'s own doc comment says it returns `undefined` when "the item is either not a file or the file data cannot be accessed" — there is no public API to construct an item where `.asFile()` resolves. A hand-built `vscode.DataTransfer` in a test can exercise the mime-type-routing/no-op paths but **cannot** exercise the real byte-read path. See §4 D1.
- **Re-read this project's own architecture pattern** (`core/` pure + `providers/`/`features/` thin `vscode` adapter, `CLAUDE.md` §3.3 guardrail) against `src/providers/workspace-symbols.ts` (closest precedent: a provider needing no `package.json` contribution) and `src/core/new-document.ts`/`src/features/new-document.ts` (closest precedent: a feature that constructs content and writes/opens a document, no webview). Confirmed **no webview, no CSP, no vendored asset is needed** — unlike every other Phase 7 slice (math/diagram preview) this is pure TypeScript, ~0 `.vsix` size impact.
- Grepped `package.json` for any existing paste/drop contribution or conflicting `quarto.*` command/setting — none found; `onLanguage:quarto` activation already covers it, no manifest change needed to activate.

---

## 1. Interface contracts

### `core/image-paste.ts` (pure, no `vscode` import)

```ts
// Given a MIME type, suggest a file extension when the OS-provided file name
// is missing/generic (a raw clipboard image paste, not a dragged real file,
// often carries a generic or empty DataTransferFile.name — see Q3).
export function extensionForMimeType(mimeType: string): string | undefined;

// Build the Markdown image-reference text to insert, POSIX-slash-normalized
// regardless of host platform.
export function buildImagePasteInsertText(relativePath: string): string;

// Given a desired base name + extension and a predicate for "does this path
// already exist" (injected, so it's pure — the adapter supplies workspace.fs.stat),
// return the first non-colliding name: name.ext, then name-1.ext, name-2.ext, ...
// Mirrors VS Code's own newFilePathGenerator.ts loop (MIT, read for precedent
// per §0 — not copied verbatim; this project's own naming/structure).
export function resolveNonCollidingName(
  baseName: string,
  ext: string,
  exists: (candidateName: string) => boolean,
): string;
```

### `providers/image-paste.ts` (thin adapter)

```ts
export function registerImagePasteFeature(context: vscode.ExtensionContext): void;
// registers:
vscode.languages.registerDocumentPasteEditProvider(
  { language: "quarto" },
  new QmdImagePasteEditProvider(),
  { pasteMimeTypes: ["image/*"], providedPasteEditKinds: [vscode.DocumentDropOrPasteEditKind.Empty.append("image")] },
);
```

`provideDocumentPasteEdits(document, ranges, dataTransfer, context, token)`:
1. Scan `dataTransfer` entries for a mime type matching `image/*`.
2. Call `item.asFile()`; if `undefined` (no file-backed payload — e.g. the paste wasn't an image at all, or a platform surfaces it differently), return `undefined` and let VS Code fall through to default paste behavior. **Never break a normal text paste.**
3. Read bytes via `file.data()`.
4. Resolve the destination directory (v1: fixed convention, §4 Q1) relative to the document's own folder.
5. Compute a non-colliding filename via the pure core helper (`workspace.fs.stat` supplies the `exists` predicate).
6. Build a `WorkspaceEdit`: `edit.createFile(destUri, { contents: bytes })`.
7. Return one `DocumentPasteEdit` with `insertText` from the pure core builder and `additionalEdit: edit`.

---

## 2. Layer contract (vertical slice)

| Layer | What | Verification |
|---|---|---|
| **L1** | `core/image-paste.ts` + unit tests (`extensionForMimeType`, `buildImagePasteInsertText`, `resolveNonCollidingName` — all pure, fully unit-testable, strict TDD) | `npm test` |
| **L2** | `providers/image-paste.ts` adapter + `extension.ts` wire (no `package.json` change needed — confirmed §0) | `npm run check-types`, manual construction test (below) |
| **L3** | Integration test: instantiate `QmdImagePasteEditProvider` directly (not via a command — none exists, §0) with a hand-built `vscode.DataTransfer`/`DataTransferItem` to prove mime-type routing and the "no file-backed payload → returns undefined, doesn't throw" fallback path | `npm run test:integration` — **disclosed as coverage/parity, not a full RED→GREEN of the real byte-read path** (§4 D1) |
| **L4 (conditional on Q2)** | `DocumentDropEditProvider` mirror, reusing the same L1 core + a near-identical adapter class | same as L2/L3, own checkpoint commit regardless of Q2's answer (SAFEGUARDS 5-file cap) |

Each layer gets its own checkpoint commit per `SAFEGUARDS.md`'s blast-radius cap. This is a small enough total surface (2–3 new files, no vendored asset, no manifest change) that all layers likely fit in one session — re-verify the contract is still accurate at the executor session's own Orient before starting, per the Vertical Slice Sessions gate (a).

---

## 3. Failure modes / open questions (operator sign-off needed before/at implementation kickoff)

**D1 (disclosed, structural — read before implementing).** Unlike every prior Phase 6/7 slice, **the core paste mechanism itself, not just a CSP/webview edge, cannot be exercised by an automated test** (§0: no `execute*Provider` command exists for paste providers, and `DataTransferItem.asFile()` cannot be test-synthesized). The L1 core logic (naming, collision-avoidance, insert-text) is fully unit-tested; the L3 integration test proves routing/fallback but **not** that a real clipboard image produces a real file + real inserted text. That proof is F5-only — state this plainly at Phase 3E, the same discipline Session 56 applied to Graphviz's CSP gap (`PROJECT_LEARNINGS.md` Learning #64), though here the gap is larger (the whole mechanism, not one directive) and can't be closed the way Learning #64 closed Graphviz's (there is no generated `<script>` template to execute in a `vm` sandbox — this is native editor-host behavior, not webview content).

**Q1 — destination folder (needs an operator decision).** Options: (a) a fixed `images/` subfolder next to the document (matches the Posit Visual Editor convention noted in §0, requires creating the subfolder); (b) directly next to the document, no subfolder (simplest, zero folder-creation edge cases); (c) a configurable destination-glob setting mirroring VS Code's own `markdown.copyFiles.destination` (most flexible, most scope — a v2 candidate, not v1, given nothing in this project's existing `quarto.*` settings does path-templating yet). **Recommend (b) for v1** — simplest, no new failure surface (a subfolder that doesn't exist yet needs its own creation step; VS Code's own `createFile` does create intermediate directories, so (a) is not actually harder to implement — but (b) still has less new *behavior* to design/test/document for a first slice). Not decided here.

**Q2 — drag-and-drop parity in v1 or deferred.** L1's core is fully shared and L2's adapter is a near-mirror (`DocumentDropEditProvider` vs `DocumentPasteEditProvider` differ only in the registration call and callback signature, both already read in full at `:6259`/`:6351`). Low incremental cost suggests bundling as L4 of one slice; but `SESSION_RUNNER.md`'s vertical-slice gate (a) requires the **full** layer set pre-declared and operator-approved before code starts — this must be decided now, not discovered mid-session. **Recommend v1** (bundle it — the marginal cost is one more adapter class + one more test file, not a new capability), but flagging for explicit sign-off since it changes the slice's declared layer count.

**Q3 — trusting `DataTransferFile.name`.** A dragged real file usually carries its real OS filename; a raw clipboard paste (e.g. a screenshot, not a saved file) often does not — VS Code's own built-in feature still uses `file.name` as its base (per `getDesiredNewFilePath`, §0), suggesting the OS/Electron layer already synthesizes a reasonable name (e.g. `image.png`) even for a raw paste. This can't be verified without a live paste (no GUI-driving tool in this environment — the same disclosed constraint as Learnings #51/#58). **Recommend**: trust `file.name` when present and non-empty (mirroring the built-in extension's own behavior, which has had years of real-world exposure), falling back to a generated name (`image` + `extensionForMimeType(mimeType)`) only when it's empty — verify this assumption empirically at the executor session's Phase 3E (a live paste), not blindly.

**Q4 — does anything already happen today when dragging a file onto a `.qmd` editor?** VS Code core (not the markdown extension) has a generic, language-agnostic drop behavior that inserts a dropped file's path as plain text — this is a different, lower-value behavior than the markdown extension's copy-into-workspace-and-link-as-image enhancement, and it does not conflict with or duplicate what this plan proposes (reasoned through via `DocumentDropEditProviderMetadata`'s own doc comment distinguishing `text/uri-list` generic handling from the `files`/image-specific path, §0 citations) — no code was found in `src/` that touches drop handling today. Treated as resolved, not blocking; re-confirm with a quick live drag-and-drop check at the executor session's kickoff if there's any surprise.

---

## 4. Alternatives considered (rejected)

- **A command-based flow** (`Quarto: Paste Image`, keybinding, reading `vscode.env.clipboard`) — **rejected**: `vscode.env.clipboard` is text-only (`readText`/`writeText`, no image accessor); there is no extension-facing API to read raw clipboard image bytes outside the paste/drop-provider mechanism. Confirmed by reading the full `env` namespace in `@types/vscode`.
- **Reading/adapting Posit's Visual Editor image-paste implementation** — **rejected**: AGPL-3.0 (Learning #1 gate); also a different editor model (Panmirror rich-text) this project has excluded entirely (Session 43).

---

## 5. Boundary notes

- Zero `.vsix` size/file-count impact beyond the new `.js` bundling into the existing `dist/extension.js` — no vendored asset, unlike every other Phase 7 slice.
- No CSP/webview surface — the hardening concerns that dominated the Math/Diagram/Graphviz plans don't apply here.
- This is the **last item in Phase 7 authoring aids** (`BACKLOG.md:60`) and in the entire post-Posit-comparison backlog arc that began at Session 43 — after this ships, `BACKLOG.md`'s remaining open items are all "Polish / deferred" (low-severity, cross-module, or explicitly optional), not ranked feature work. Flag this at the executor session's close-out; do not re-triage Polish/deferred in the same session (FM #2), per this project's own established discipline across Sessions 52/54/56.
