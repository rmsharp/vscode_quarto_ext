# Reclaiming the OS temp-dir vdocs a crash leaves behind — Design Plan

`BACKLOG.md:182` (filed Session 101, "Polish / deferred"). Planning session: **Session 102**.
Workstream: `docs/methodology/workstreams/ARCHITECTURE_WORKSTREAM.md`.

---

## 0. How this plan was produced (evidence provenance) — and the headline

Four evidence streams, per the Architecture workstream's §7 "Verify Assumptions" and its anti-pattern
#3 (*documentation-level verification* — trusting docs/README claims without reading the
implementation):

1. **The real code**, read at HEAD `d73a841` (`src/features/embedded-vdoc.ts`,
   `src/core/embedded/vdoc-path.ts`, `src/extension.ts`) — §2, §3.
2. **The real machine** — measured node probes for `mkdtemp`/`writeFile` modes, `process.kill(pid,0)`
   errnos, and a live `ps` census of this box's running extension hosts (§3.2, §3.3).
3. **The real VS Code 1.129.0 bundle** (the version `runTest.ts` pins), byte-traced for
   `workspace.fs.writeFile`'s parent-creation path, the text-model lifecycle, and
   `globalStorageUri`'s construction (§3.4, §3.5, §3.6).
4. **A 12-agent adversarial fleet** (6 grounding agents, each paired with an independent refuter
   instructed to default to *refuted* when it could not reproduce the evidence). Every agent ran under
   a **read-only remit**, with probes confined to a scratchpad outside the repo — a direct response to
   Learning #112, where a delegated agent deleted a source hunk and a sibling then "confirmed" a false
   finding against the corrupted tree. **Tree integrity was checksummed before and after the fleet and
   matched exactly** (`c2a7c11f…`), so every finding below was computed against the correct tree.

> ### Headline — four findings, all measured, and they reshape the item
>
> 1. **The filed severity is overstated, and the security clause is REFUTED as written.** `BACKLOG:182`
>    says the files are "0644 inside a 0700 dir, so the disclosure is bounded by the directory mode."
>    The *directory* half is true and in fact **stronger** than claimed (0700 is a ceiling — umask can
>    only subtract from it, never widen it). The *file* half is false: `writeFile` with no mode yields
>    `0666 & ~umask`, measured at **0666 under umask 000**. The bound comes from the **directory
>    alone**. And on macOS `os.tmpdir()` is itself a per-user `0700` container (`/var/folders/…/T`),
>    a second independent gate. **This is a disk-hygiene/lifetime leak, not a cross-user disclosure**
>    (§3.2).
> 2. **The filed fix walks into a real deletion hazard.** The item says to reuse the workspace sweep's
>    `INSTANCE_ID` skip. That reasoning **inverts** for the temp dir: the workspace sweep excuses
>    collateral damage because two windows on one root is *rare* (`embedded-vdoc.ts:333-337`), whereas
>    concurrent windows each holding an untitled `.qmd` is ordinary — and each gets its **own** temp
>    dir, so a naive prefix scan reclaims a live sibling's. **Calibrated honestly:** a `ps` census
>    confirmed two live extension hosts (PIDs 1304, 14933) sharing one TMPDIR on this box — but that is
>    a near-tautology (`$TMPDIR` is per-user), and it does **not** measure the load-bearing half, that
>    both hold an untitled `.qmd` concurrently. **That half is inherited from S101 and remains
>    unmeasured.** The design does not rest on it: G2 is chosen on *failure-direction* grounds — it
>    fails toward leak — which holds however rare the collision turns out to be (§3.3).
> 3. **Deleting a live window's directory is not harmless — it silently downgrades that window's
>    privacy for the rest of the session.** `vscode.workspace.fs.writeFile` **does** re-create missing
>    parents (byte-traced), so there is *no* latched-failure risk — but it re-creates them with
>    `fs.mkdir(path)` and **no mode arg**, so the directory comes back **0755, not `mkdtemp`'s 0700**,
>    and the self-heal is *silent* (no `ENOENT` to hook recovery onto). This is the single strongest
>    argument for real liveness rather than "delete it, it'll self-heal" (§3.4).
> 4. **`embedded-vdoc.ts:333-337`'s "self-healing" claim is REFUTED — the mechanism is false.**
>    `isModelOpen()` does **not** notice a deleted file: measured *true* for a file deleted 10s
>    earlier, flipping only at an unrelated ~180s model-eviction mark. The comment's **bottom line
>    ("not dangerous") survives, but for the opposite reason it gives** — the model *outlives* the
>    file, so the forward is answered from RAM. Correct the comment; the code is fine (§3.5).
>
> **Recommendation (§4): stamp the extension-host PID into the `mkdtemp` prefix and reclaim only
> `ESRCH`-dead directories.** It preserves every existing security property, and its failure direction
> is *leak, never delete* — the right way for a delete loop to fail. **`globalStorageUri` is rejected**
> (§5): it turns "rare" collisions into "always" and adds profile fragmentation.
>
> **Honest sizing (§3.7): this is LOW-to-MODERATE hygiene, not a correctness bug.** macOS bounds the
> leak at the **reboot interval** (proven by disassembly: the age-based reaper's `rmdir` is gated
> behind `cbnz x21` and is unreachable — what actually clears `T/` is a boot wipe); Debian bounds it at
> 10 days; **Windows has no default reaper, so it is effectively unbounded there — that is the real
> win.** A vdoc is kilobytes of text. **Do not over-engineer this**: no lock-file protocol, no
> heartbeat daemon, no native dependency.

---

## 1. Executive summary (TL;DR)

**The defect (verified firsthand, airtight).** `src/extension.ts:73` calls
`sweepStaleVdocs(vscode.workspace.workspaceFolders ?? [])`, and `sweepFolder`
(`embedded-vdoc.ts:345-346`) only ever reads `<folder>/.quarto/vdoc-mit/`. `os.tmpdir()` has **exactly
one executable site** in the whole of `src/` — the `mkdtemp` at `embedded-vdoc.ts:390` — and
`sweepStaleVdocs` has **exactly one call site**. So the fallback directory that holds *every* untitled
or out-of-workspace document's vdocs is swept by nothing, ever. The module's own comment at `:295`
already concedes it. A clean `deactivate` reclaims it (Session 101's fix); a crash, SIGKILL, or host
teardown does not.

**Reproduced live during this very session.** A probe extension host was killed without a clean
deactivate and left `$TMPDIR/quarto-mit-vdoc-crPIgP` behind, mode `0700` exactly as predicted. It is
**empty** — so the *directory-survival* mechanism reproduced firsthand; the "2–11 real vdoc files
inside" part did not reproduce in that instance (§3.1).

**The fix.** Three changes, one capability:

| # | Change | File |
|---|--------|------|
| 1 | `mkdtemp` prefix carries the ext-host PID: `quarto-mit-vdoc-<pid>-XXXXXX` | `embedded-vdoc.ts:390` |
| 2 | A new pure naming/parsing pair + anchored grammar for that directory name | `core/embedded/vdoc-path.ts` |
| 3 | `sweepStaleTempVdocs()` — reclaim only directories whose PID is `ESRCH`-dead | `embedded-vdoc.ts` + `extension.ts:73` |

**Six guards bound the new delete loop (§4.3) — but they are NOT equals, and saying so is the point.**
Two of them carry the whole design: **G0** (the directory's host tag is ours, so its PID means something
here) and **G2** (that PID is provably dead — `ESRCH` only; **`EPERM` means alive**). Those are the only
guards standing between the sweep and a *live* window's data, and each fails toward **leak**. The other
four — the anchored grammar, a real non-symlink directory we own, `isOurVdocFileName` on every file
inside, and a deliberately **non-recursive `rmdir`** — bound the blast radius against *foreign* data,
and a live sibling's directory passes all four by construction. **There is no defense-in-depth on the
hazard that matters; an earlier draft of this plan claimed there was.**

**Three sessions, in order** (§6): Phase 1 the reclaim slice; Phase 2 the `0700` re-assertion; Phase 3
the record corrections. **Phase 1 is proposed as a 4-layer vertical slice and needs operator
ratification (§9 Q1) — it is a delete loop, and recoverability, not verifiability, is the ceiling on
slice size.**

---

## 2. Context

### 2.1 Problem statement

An untitled (or out-of-workspace) `.qmd` has no workspace root to write vdocs into, so
`vdocDirFor` (`embedded-vdoc.ts:377-413`) falls back to a private `mkdtemp` directory. That directory
is memoised in `fallbackDirPromise` (`:147`) for the session and removed only by `disposeAllVdocs`
(`:277`), which runs only at a **clean** deactivate. On any exit that skips deactivate — a crash, a
SIGKILL, a host teardown — the directory survives with whatever vdocs were live at that moment, and
**nothing will ever reclaim it**: `disposeAllVdocs` is spent, and `sweepStaleVdocs` cannot see it.

The path is not exotic. The extension's own **New Quarto Document** command (`features/new-document.ts:33-36`)
opens an untitled buffer, and semantic tokens (`providers/semantic-tokens.ts:65-67` registers
`{ language: "quarto", scheme: "untitled" }`) are the one forward VS Code fires **with no user gesture**,
on a debounced timer. So vdocs land in the temp dir merely from having an untitled `.qmd` visible.

### 2.2 Hard constraints

| # | Constraint | Source |
|---|-----------|--------|
| C1 | The vdoc must be a real `file:` document on disk | Item 18 / Learning #94 — real LSPs filter by scheme; a custom scheme returned 0 completions vs 306 |
| C2 | The temp dir must stay **unpredictable and private** | `embedded-vdoc.ts:551-553` — writing user source to a predictable location is disclosure |
| C3 | Any delete loop is bounded by **ownership, never pattern-matching** | `vdoc-path.ts:24-42` — the sweep must never reach Posit's `.quarto/vdoc/` |
| C4 | `core/` must not import `vscode` and is unit-tested headlessly | architecture §3.3 |
| C5 | Strict TDD — RED before GREEN, one test at a time | `CLAUDE.md` operator directive |
| C6 | Degrade silently; never surface an error the user cannot act on | `embedded-vdoc.ts:243-248` |

### 2.3 Current state

```
activation ── sweepStaleVdocs(workspaceFolders)  ──► <root>/.quarto/vdoc-mit/   ✅ swept
                                                      └─ guards: our dir + isOurVdocFileName + skip own INSTANCE_ID

ensureVdoc ──► vdocDirFor(doc)
                 ├─ doc IS in a workspace folder ──► <root>/.quarto/vdoc-mit/    ✅ swept
                 └─ doc has NO workspace folder  ──► mkdtemp($TMPDIR/quarto-mit-vdoc-)
                                                      └─ memoised in fallbackDirPromise (session-long)
                                                         ├─ clean deactivate ──► disposeAllVdocs rmdirs it   ✅
                                                         └─ CRASH / SIGKILL  ──► ❌ NOTHING EVER RECLAIMS IT
```

### 2.4 Reversible vs locked

- **Reversible:** the sweep function, the activation wiring, the liveness predicate. All additive.
- **Locks at FIRST PUBLISH — not today:** the **directory-name grammar**. Once a release is in users'
  hands, a later version that changes the prefix cannot reclaim the directories the released version
  left: they match nothing and become permanently unreclaimable orphans. **But §3.8 measures that this
  extension has never been published** — so the grammar is *fully open right now*, and every
  grammar-shaped decision in this plan (the host discriminator G0 especially) is free today and
  impossible after the v1 listing. **That is a scheduling fact, not a detail: land Phase 1 before
  `vsce publish`.**

---

## 3. Research findings — every assumption, measured

Each finding below was produced by a grounding agent and attacked by an independent refuter. Verdicts
are the refuter's, not the grounder's.

### 3.1 The filed evidence no longer reproduces — but the code defect is airtight

| Filed claim | Status | Measurement |
|---|---|---|
| `src/extension.ts:73` passes only `workspaceFolders` | **CONFIRMED** | verbatim |
| `sweepFolder` only reads `<folder>/.quarto/vdoc-mit/` | **CONFIRMED** | `VDOC_DIR_SEGMENTS`, `vdoc-path.ts:69` |
| Nothing else enumerates `os.tmpdir()` | **CONFIRMED** | `grep -rn "tmpdir\|mkdtemp" src/` → one executable site (`:390`); all others are comments |
| "56 dirs, each with 2–11 real vdoc files" | **DOES NOT REPRODUCE** | **0** across `$TMPDIR`, `/tmp`, `/var/folders`. Not a sandbox artifact: node's own `os.tmpdir()` resolves to the same path, which holds 328 other entries. S101's own notes recorded ~14 remaining at its close |
| "~1 leaked dir per integration run" | **TRUE BUT MISLEADING** | a *developer-machine* artifact — the test host is SIGKILLed every run. **Not a user's rate**: a user leaks one dir per actual crash with an untitled `.qmd` open |

**The code defect is untouched by the evidence evaporating.** What changed is only the *severity
framing*. And the mechanism reproduced live in this session (§1).

### 3.2 V1 — permission modes: the directory is the whole bound `[PARTIAL]`

Measured across forced umasks (`0700 & ~umask` predicted vs observed — match at every point):

```
umask 0000 -> mkdtemp DIR 0700     FILE writeFile(no mode) 0666   <-- world-WRITABLE
umask 0022 -> mkdtemp DIR 0700     FILE writeFile(no mode) 0644
umask 0077 -> mkdtemp DIR 0700     FILE writeFile(no mode) 0600
umask 0777 -> mkdtemp DIR 0000
```

- **The dir half is stronger than filed.** `0700` is a **ceiling**: umask can only subtract. No umask
  can make a `mkdtemp` dir group- or world-readable.
- **The file half is REFUTED as filed.** "0644" is an accident of umask 022, not a property of the
  code. `writeFile` with no mode is `0666 & ~umask`.
- **macOS has a second gate:** `/var/folders/dg/…/T` is itself `drwx------`, contrasted with
  `/private/tmp` at `drwxrwxrwt`.
- **Design consequence:** *never write a vdoc anywhere but inside the mkdtemp dir* — the file mode is
  not a gate you may lean on. And **`BACKLOG:182`'s "the disclosure is bounded by the directory mode"
  should be restated**: it is bounded by the directory mode *alone*, and on macOS doubly so.

> **Gap (honest):** the probe measured `fs.promises.writeFile`; the real vdoc write (`:218`) goes
> through `vscode.workspace.fs.writeFile`, whose resulting mode was **not** directly measured. The
> `mkdtemp` half has no such gap — the real code calls node `fs.mkdtemp` exactly as the probe did.

### 3.3 V2 — PID liveness works, and the multi-window premise is measured `[CONFIRMED]`

```
process.kill(pid, 0):
  own live pid       -> no throw
  reaped child       -> ESRCH        (dead)
  pid 99999 (unused) -> ESRCH        (dead)
  pid 1 (launchd)    -> EPERM        (ALIVE — exists, owned by uid 0, ps -p 1 confirms)
```

- **`ESRCH` ⇔ no such process; `EPERM` ⇒ the process EXISTS but is not ours.** The naive
  `try { kill(pid,0) } catch { dead }` is a **bug** — it reclaims on `EPERM`, i.e. deletes a live
  foreign process's directory. The predicate must be `catch (e) { if (e.code === "ESRCH") reclaim; else skip; }`.
- **The trailing separator is load-bearing — but NOT for the reason an earlier draft of this plan
  claimed.** `mkdtemp` appends its six random chars **directly** onto whatever prefix it is given, with
  no separator of its own: `mkdtemp("…/quarto-mit-vdoc-1234-")` → `quarto-mit-vdoc-1234-H4xogb`, but
  `mkdtemp("…/quarto-mit-vdoc-54827")` → `quarto-mit-vdoc-548278u7zTF` (measured). An earlier draft
  said that name "parses as PID 548278" and labelled it *Measured*. **That is false under this plan's
  own §4.2 grammar, and I verified it myself rather than inheriting it:**

  ```
  /^quarto-mit-vdoc-([0-9]+)-[A-Za-z0-9]{6}$/ against:
    "quarto-mit-vdoc-548278u7zTF"   ->  NO MATCH (null)     <-- no second separator
    "quarto-mit-vdoc-54827-8u7zTF"  ->  MATCH pid=54827
  ```

  The "548278" reading was a **prose gloss** from the grounding probe (whose scratch parser was a bare
  `parseInt`-style split), transcribed into the plan as a measured property of an anchored regex it was
  never run against. **The real consequence of dropping the dash is the opposite kind of failure:** the
  name matches *nothing*, `tempVdocDirParse` returns `null`, the sweep silently reclaims **nothing**, and
  every directory the release writes is **permanently unreclaimable**. That is a *total* failure in the
  *safe* direction — a dead no-op, not a wrong delete. It stays a dragon (🐉2) on that basis, but it is
  **not** in 🐉1's failure-direction-inverting class, and the test that pins it is an **exact-string
  assertion on `tempVdocDirPrefix`**, not a parse assertion (a parse assertion returns `null` for that
  name under *any* implementation, so it discriminates nothing).
- **Unpredictability is preserved.** `mkdtemp` still appends 6 random chars and still creates the dir
  `0700` with a PID in the prefix; two calls with the same PID prefix produce distinct dirs. The PID
  segment is **purely additive metadata** — it costs nothing in collision resistance.
- **The premise is real and measured, not theorised.** A `ps` census found **two live ext hosts** —
  PIDs 1304 and 14933, both children of the one main `Code` process, for two distinct window uuids —
  **sharing one TMPDIR**. A naive "reclaim every `quarto-mit-vdoc-*`" sweep would delete a live
  sibling's vdocs.
- **The failure direction is safe:** PID reuse reads *alive* (leak); an unreaped zombie reads *alive*
  (leak, and it clears once the parent reaps). Both are **leak-not-delete**, and the leak is bounded.

> **Gaps:** darwin-only. On Linux `/tmp` is shared *across users*, so an `EPERM` (other-user) PID
> collision is genuinely reachable there — **the `EPERM`-as-alive rule matters more on Linux than on
> the box that was measured.** Windows has no POSIX signals; node emulates `kill(pid,0)` and its
> `EPERM`/`ESRCH` behaviour for a live foreign/elevated process is **UNVERIFIED**. Whether a crashed
> ext host restarts with a fresh PID or lingers as a zombie was **not** measured — see 🐉3.
> **Practical note for the executor:** `grep -i extensionHost` finds nothing on macOS; the ext host is
> `Code Helper (Plugin)` with `--utility-sub-type=node.mojom.NodeService`.

### 3.4 V3 — `writeFile` DOES create parents, and that is the problem `[CONFIRMED]`

Byte-traced through the pinned 1.129.0 bundle: `ExtHostConsumerFileSystem.writeFile` @1030319 calls
`await n.mkdirp(s.impl, s.extUri, s.extUri.dirname(o))` **before** the write; `mkdirp` @1031304 walks up
and creates down, swallowing `EntryExists`.

1. **No latched-failure risk — leg (a) holds.** If the memoised fallback dir vanishes, the next
   `ensureVdoc` write **silently re-creates it and succeeds**. `fallbackDirPromise` does **not** need a
   "re-create if vanished" step, and `:243`'s catch will not start returning `undefined` forever.
   **This is not the Session 101 rejected-memo bug class repeated.**
2. **But the resurrected directory comes back `0755`, not `0700`.** VS Code re-creates it with
   `fs.promises.mkdir(path)` and **no mode arg** → `0777 & ~umask` → **0755 measured**. That directly
   voids the guarantee `vdocDirFor`'s own comment (`:551-553`) rests on. **A sweep that deletes a live
   window's directory silently downgrades that window's privacy for the rest of the session.**
3. **The self-heal is silent and total** — `mkdirp` swallows the error, so `writeFile` will *never*
   surface `ENOENT` for a vanished parent. Any "the dir was swept, mint a fresh private one" logic must
   **detect the deletion itself with an explicit `stat`**; the error signal a designer would expect to
   hook does not exist.
4. **Blast radius is platform-dependent.** On macOS the `0700` `/var/folders/…/T` ancestor contains a
   `0755` child. On Linux `os.tmpdir()` is `/tmp`, world-listable — a `0755` child **is** readable by
   any local user, and `readdir(/tmp)` defeats `mkdtemp`'s unpredictability.

> **Gap:** no live EDH probe of `writeFile`-into-a-deleted-dir; the verdict rests on a complete static
> trace plus measured node semantics. The ext-host umask was not measured in-process (every file VS
> Code wrote on this box is 0644 ⇒ consistent with umask 022).

### 3.5 V5 — the "self-healing" comment is REFUTED `[REFUTED]`

`embedded-vdoc.ts:333-337` claims a cross-window delete is *"self-healing: `ensureVdoc` notices the
model is gone and re-mints on the next request."* Measured in a real EDH:

- **`isModelOpen()` does NOT detect the delete.** It returned **true** for a file deleted 10s earlier,
  flipping only at an unrelated **~180s** model-eviction mark. So `ensureVdoc` does *not* "notice the
  model is gone" as a consequence of the sweep; for up to 180s the reuse branch (`:178-185`) returns the
  URI of a file that no longer exists.
- **The bottom line survives, for the opposite reason.** `executeHoverProvider` against the deleted-file
  URI returned a full result with the provider invoked against in-RAM content. The model is
  *orphan-marked, not disposed*; the LSP got `didOpen` and gets no `didClose` until the drop. **The
  correct framing is "harmless because the model outlives the file," not "self-healing because the
  model dies with the file."** No code change indicated — **the comment needs correcting** (Phase 3).
- **Genuinely new, unrelated to any sweep:** every vdoc model self-destructs **~180s** after
  `openTextDocument` in normal single-window operation, and the reuse branch never refreshes that clock.
  So `isModelOpen() === false` on an unchanged-content reuse is the **steady state** for any cell idle
  >3 minutes — not the rare cross-window artifact the comment implies. The code handles it correctly
  (falls through, mints a fresh version, deletes the old file), so this is a **mental-model gap, not a
  defect** — but it means the vdoc file churns once per 3-minute idle gap per cell, and a `_cleanup()`
  valve (at 60 live refs the oldest 10 are force-disposed) could drop models **earlier** than 180s on a
  many-cell document. **That interaction is unmeasured** and is filed, not fixed (§8).

> **Gap (the biggest in this plan):** the probe's hover provider ran **in the extension host** — the
> best case, reading only `doc.getText()`. **A real out-of-process LSP (Pylance, rust-analyzer) was not
> measured**; it has its own file watcher and may drop the deleted file from its program or fail module
> resolution against a vanished path. Claim 2 is verified for **VS Code's dispatch plumbing only**.

### 3.6 V4 — `globalStorageUri` rejected `[PARTIAL]`

It **does** relocate the scan to one known path (a genuine win), but:

- **It does not solve cross-window liveness — it inverts the risk.** `INSTANCE_ID` is in the
  *filename*, and today `mkdtemp` gives each window its **own** directory, so collision probability
  there is zero. globalStorage is **one directory shared by every window in the profile**, so every
  concurrent window pair collides and each start-up sweep deletes live files of every other running
  window. The `:333-337` justification rests entirely on *rare*; globalStorage makes it **always**.
- **Profile fragmentation** (new failure mode): `globalStorageHome` is profile-scoped, so N profiles
  give N dirs and a sweep in one cannot see another's orphans. `os.tmpdir()` is profile-independent and
  catches them all. Measured instance: the test harness's `--user-data-dir` already yields a separate
  globalStorage.
- **Security is weaker** (0755 + predictable vs 0700 + unpredictable), though `~/Library` at 0700 means
  no other local user can traverse it on macOS.

**It buys the cheap problem (the scan) and worsens the expensive one (liveness).** Rejected.

### 3.7 V6 — how long is "forever", really `[PARTIAL]`

| Platform | Bound | Basis |
|---|---|---|
| **macOS** | **the reboot interval** | The age-based `dirhelper` pass **never `rmdir`s** — the single `rmdir` in the binary is gated behind `cbnz x21` and is unreachable unless threshold==0. What actually clears `T/` is an age-independent **boot wipe** (measured: `T/` 1 of 611 entries predate boot; the not-in-list sibling `C/` 538 of 541 do). So the advertised "3 days" does not bound the directory |
| **Debian/Linux** | **10 days** | ships upstream's `q /tmp 1777 root root 10d` unpatched |
| **Windows** | **effectively unbounded** | no always-on age reaper; Storage Sense is **off by default** |

- **The claimed latent bug does NOT exist on macOS.** The reaper cannot delete a live window's vdoc
  *directory* (age mode never `rmdir`s; the boot pass runs before any user process exists). Do not file
  it. On Linux it is real in principle but needs a live window idle ≥10 days.
- **Design constraints that fall out:** use **`mtime`, never `atime`/`birthtime`** (measured: writes do
  not refresh atime; birthtime is immutable — macOS's own crtime+atime predicate would mark a
  continuously-*written* vdoc deletable at 3 days). Beware **liar timestamps**: a dir created 0.48d ago
  was measured holding a file whose birthtime reads 571.83d (macOS `copyfile` preserves `ATTR_CMN_CRTIME`).
  **Our sweep is more dangerous than the OS's** — the OS never `rmdir`s in age mode; ours would.
- **Sizing:** a vdoc is kilobytes. For scale, this TMPDIR holds 2.9 GiB / 31,851 files from every tool
  on the box. **This is hygiene, not disk exhaustion, and correctness is unaffected.**

> **Gaps, and one label correction owed.** Linux and Windows are **100% sourced, 0% measured** — no box
> available; the Windows 7-day `LastAccess` figure is weakly sourced (a third-party site, not
> Microsoft). **And the macOS row above mixes a measurement with an inference:** the *boot-wipe census*
> (`T/` 1-of-611 vs `C/` 538-of-541) is the measurement, and it is what carries the conclusion. The
> *disassembly* ("the `rmdir` is gated behind `cbnz x21` and is unreachable") is a supporting
> **inference** — the single `rmdir` call site sits behind branches whose operands were read but whose
> full reachability was not exhaustively proven. Stated precisely: **no reachable age-mode `rmdir` path
> was found**, and the filesystem census independently agrees. That is strong, and it is not the same
> as byte-proven. The practical instruction ("don't file a macOS latent-reaper bug") follows from the
> census, which stands on its own.

### 3.8 Release status — the grammar is not locked yet `[MEASURED]`

```
package.json: version 0.0.1 · preview: true · publisher rmsharp
git tag       -> 0 tags
CHANGELOG.md  -> "## [Unreleased]" is the ONLY release heading
```
`BACKLOG.md:23` records the remaining step as operator-only: *"actual `vsce publish` needs a registered
Marketplace publisher `rmsharp` + a PAT; `preview: true` is set."*

**The extension has never been published.** Two consequences, both load-bearing: no user machine can
hold a directory written by a released version (so §9 Q2's compatibility question dissolves), and the
directory-name grammar is **still free to change** — which is the entire reason G0 is affordable (§4.1).

---

## 4. Decision — host-scoped, PID-stamped `mkdtemp` + an `ESRCH`-only reclaim

### 4.1 The shape

```
mkdtemp($TMPDIR/quarto-mit-vdoc-<h>-<pid>-) ──► $TMPDIR/quarto-mit-vdoc-3f9a1c-14933-rzvF0U/  (0700)
                                                     │       │      │
                                                     │       │      └─ 6 random chars: unpredictable (C2)
                                                     │       └─ ext-host PID: the liveness key
                                                     └─ host discriminator: 6 hex of a hash of os.hostname()
                                                        — the scope in which that PID means anything

activation ── sweepStaleTempVdocs()
                └─ readdir($TMPDIR)
                     └─ for each entry matching /^quarto-mit-vdoc-([0-9a-f]{6})-([0-9]+)-[A-Za-z0-9]{6}$/
                          ├─ h !== ourHostHash ?            -> SKIP  (G0: a PID from another
                          │                                           namespace/machine is meaningless)
                          ├─ pid === process.pid ?          -> SKIP  (our own live dir)
                          ├─ kill(pid,0) throws ESRCH ?     -> RECLAIM
                          ├─ kill(pid,0) throws EPERM ?     -> SKIP  (alive, not ours)
                          └─ no throw ?                     -> SKIP  (alive)
                                └─ RECLAIM = delete only isOurVdocFileName files, then NON-recursive rmdir
```

**Why the host discriminator (G0) — and why it must be decided NOW.** `kill(pid, 0)` answers "is this
PID alive **in my PID namespace**". If a directory's PID was minted in a *different* namespace or on a
*different machine*, `ESRCH` does not mean "dead" — it means "meaningless", and the sweep would
**delete a live window's directory**. That is the one case where the failure direction inverts from
*leak* to *delete*, and §3.4 then completes the damage: VS Code silently resurrects the directory at
**0755**, so a hygiene fix would cause the exact disclosure `embedded-vdoc.ts:551-553` exists to
prevent.

**Honest sizing:** this is **not** routine. In every *default* VS Code Remote mode (Dev Containers,
Remote-SSH, WSL, Codespaces) the extension host runs **inside** the remote environment and uses **that
environment's** `os.tmpdir()`, which is not shared with the host — so the sweeper is the only writer
and PIDs are namespace-consistent. Reaching the hazard needs a **non-default shared `$TMPDIR`**: an
explicit `/tmp` bind-mount into a container, or `TMPDIR=$HOME/tmp` on an NFS home shared by two
machines at the same uid. **Both are unusual — and both are real.**

It is adopted anyway because the cost is ~3 lines and the timing is **now-or-never**: §2.4 shows the
grammar locks at first publish, and §3.8 measures that **publish has not happened yet**. Buying an
unconditional safety property for a delete loop, for free, while the door is still open, is the right
trade. It is *not* astronaut architecture (workstream anti-pattern #2) — it removes an unstated
precondition from a claim the plan makes about deleting the user's data.

### 4.2 Interface contracts (interface-first — `core/` is pure, `vscode`-free, per C4)

**New in `src/core/embedded/vdoc-path.ts`** (pure; unit-tested headlessly):

| Function | Input | Output | Error | Notes |
|---|---|---|---|---|
| `hostDiscriminator(hostname: string)` | `os.hostname()` | 6 lowercase hex chars | total; never throws | A non-cryptographic hash. **Not** a security control — a scope tag (G0). ⚠ **CORRECTED S103: this row said "Collisions cost only a missed reclaim (leak)" and that is BACKWARDS** — a collision makes G0 *fail open* (`parsed.host === ours` passes for another machine's dir), so it costs a **wrong delete**, not a leak; the *leak* comes from a hostname CHANGE. Measured: `node7582.cluster.local` and `node8137.cluster.local` both → `477c36`; ~3% at 1000 hosts. Only reachable when two machines share one `$TMPDIR`, which is why 24 bits is still accepted — but the cost is not zero. §4.1 already stated this correctly; the table did not |
| `tempVdocDirPrefix(host: string, pid: number)` | host tag + PID | `` `quarto-mit-vdoc-${host}-${pid}-` `` | total; never throws | **The trailing `-` is load-bearing** (§3.3). This is the string handed to `mkdtemp` |
| `tempVdocDirParse(name: string)` | a directory basename | `{host, pid} \| null` | total; never throws | `null` for anything not matching the anchored grammar — **a non-match is NOT-OURS (skip), never a parse failure to reclaim** |

**Grammar (locks at first publish — see §2.4 and §3.8):**
```ts
const TEMP_DIR_RE = /^quarto-mit-vdoc-([0-9a-f]{6})-([0-9]+)-[A-Za-z0-9]{6}$/;
```
Mirrors `NAME_RE` (`vdoc-path.ts:72`): anchored at both ends, so no traversal (`..`, `/`) can appear in
an accepted name — the property `test/unit/vdoc-path.test.ts:52-53` already pins for the file grammar.

**This grammar was EXECUTED against a real `mkdtemp`, not just written down** (Learning #111 — a remedy
nobody has run is a guess in a confident voice; that is exactly how this plan's own 🐉2 went wrong):

```
mkdtemp(os.tmpdir() + "quarto-mit-vdoc-<sha256(hostname)[0..6]>-<process.pid>-")
  produced: quarto-mit-vdoc-2954b2-78955-TmpX86
  round-trip: host=2954b2 pid=78955   (matches the inputs exactly)

TEMP_DIR_RE rejects, as required:
  quarto-mit-vdoc-3f9a1c-548278u7zTF     dashless prefix -> no match  (🐉2: total leak, safe direction)
  quarto-mit-vdoc-14933-rzvF0U           the PID-less shape -> no match
  quarto-mit-vdoc-ZZZZZZ-1-abcdef        non-hex host tag -> no match
  quarto-mit-vdoc-3f9a1c-1-abcdef/../x   traversal -> no match
  .vdoc.a1b2c3d4.py                      Posit's -> no match
```

The executor still writes these as RED-first unit tests (C5) — this is evidence the *contract* is
sound, not a substitute for the tests.

**New in `src/features/embedded-vdoc.ts`:**

| Function | Contract |
|---|---|
| `sweepStaleTempVdocs(dir?: vscode.Uri): Promise<void>` | Reclaims every temp vdoc dir under `dir` (default `os.tmpdir()`) whose host tag is ours **and** whose owning ext host is provably dead. **Never throws** (C6). Fire-and-forget from activation |
| `isProcessDead(pid: number): boolean` | `true` **only** on `ESRCH`. `EPERM` ⇒ `false` (alive). No throw ⇒ `false`. **Exported for test** — the 🐉1 inversion must be pinnable directly |

**Changed:** `vdocDirFor` (`:390`) uses `tempVdocDirPrefix(hostDiscriminator(os.hostname()), process.pid)`.

**The optional `dir` parameter is a deliberate testability seam, and the plan is making that call
rather than leaving it to the executor.** Without it, every `§8` fixture would have to be written into
the developer's **real, shared** `$TMPDIR` — which §3.3 measured is *concurrently in use by two live
extension hosts on this very machine*, so a test fixture and a real window's live directory would sit
in the same namespace. Tests pass the seam an owned `mkdtemp` directory and clean it in a `finally`;
production calls it with no argument. The cost is one optional parameter with a safe default; the
alternative is a delete-loop test suite operating on the developer's live temp dir. (The `live`/
`docFiles`/`disposeEpoch` module state is untouched by this — the seam is a *directory*, not a store.)

**Deliberately UNCHANGED:** `sweepStaleVdocs`'s signature. §7 shows it has **5 test call sites**, all
passing `workspaceFolders ?? []`. Adding the temp sweep as a **separate exported function** rather than
overloading the existing one keeps those 5 sites untouched and keeps the two delete loops — one bounded
by the workspace, one by the temp dir — separately readable and separately testable. They have
different guards and different hazards; merging them would hide that.

### 4.3 Failure-mode analysis — six guards, only two of which matter

| # | Guard | What it stops | Fails toward |
|---|-------|---------------|--------------|
| G0 | Host discriminator matches ours | reclaiming on a PID minted in another namespace/machine, where `ESRCH` means *meaningless*, not *dead* | **leak** |
| G1 | Anchored dir grammar | any directory we did not name — including Posit's, and any traversal | skip |
| G2 | PID `ESRCH`-dead only (**`EPERM` ⇒ alive**) | deleting a live sibling window's dir | **leak** |
| G3 | `lstat` — real directory, not a symlink, owned by our uid | a planted symlink in a world-writable `/tmp` (Linux; nil on macOS's 0700 TMPDIR) | skip |
| G4 | `isOurVdocFileName` on every file inside | deleting a foreign file that happens to sit in a matching dir | skip |
| G5 | **Non-recursive `rmdir`** | forcing a directory that still holds anything unexpected | skip |

> **⚠ These guards are NOT interchangeable, and an earlier draft of this plan said they were.** It
> claimed "every guard fails toward leave it alone — for the loop to delete a live window's data, G1
> *and* G2 *and* G3 *and* G4 must all be wrong simultaneously." **That is false, and the table above
> refutes it.** A live sibling window's directory passes G1 (we named it), G3 (a real directory we
> own — we made it), G4 (every file inside is `vdoc-mit.*` — we wrote them) and G5 (the `rmdir`
> succeeds precisely because G4 just emptied it) **by construction**. Those four guards bound the
> blast radius against *foreign* data; **only G0 and G2 stand between the sweep and a LIVE window's
> data.** There is no defense-in-depth on the hazard that matters — say so plainly rather than
> counting guards that cannot fire.

**What that means in practice.** G0 and G2 carry the design. Each is individually simple and each
fails toward *leak*: G2 because a live process always reads either no-throw or `EPERM` **within one
namespace** (measured, §3.3), and G0 because it refuses to evaluate G2 outside that premise. Together
they make "leak, never delete" **unconditional**; G2 alone makes it conditional on an unstated
assumption about `$TMPDIR` not being shared across a namespace boundary.

**Blast radius if it goes wrong anyway:** bounded to files *we* wrote (`isOurVdocFileName` matches only
`vdoc-mit.<hex>.<n>.<ext>`, which nothing but this extension creates) — and §3.5 measured that even
deleting a live vdoc cannot break an active forward, because the model outlives the file. The residual
harm is the §3.4 privacy downgrade (0755), which needs Linux + a permissive umask + a local attacker +
an already-unusual shared `$TMPDIR`.

---

## 5. Alternatives considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| **A. Do nothing** | zero risk; zero code; macOS bounds it at reboot and Debian at 10 days; the leak is KBs (§3.7) | **Windows never reaps** → unbounded accumulation of the user's source; a crash is exactly when it happens | **Genuinely tenable** — this is the honest fallback if the operator judges the priority too low (§9 Q3). Rejected because Windows is unbounded and the fix is small |
| **B. Prefix scan, no liveness** (as filed) | simplest; no grammar change | Deletes live sibling windows' dirs — **measured: 2 ext hosts share one TMPDIR** (§3.3) — and each delete silently downgrades that window to **0755** for the session (§3.4) | **Rejected on measurement.** The item's "reuse the INSTANCE_ID skip" reasoning inverts for temp |
| **C. `context.globalStorageUri`** | one stable known path; no prefix scan; no randomness | Turns *rare* collisions into *always*; profile fragmentation; 0755 + predictable | **Rejected** (§3.6) — buys the cheap problem, worsens the expensive one |
| **D. Stable parent** `<tmp>/quarto-mit-vdoc/<random>/` | narrow scan; unambiguous | A **predictable parent** in Linux's 1777 `/tmp` is a classic pre-creation/symlink target (CWE-377) — it trades away C2, the exact property `:551-553` exists to hold | Rejected — needs `lstat`+owner+mode hardening of the parent to claw back what `mkdtemp` gives free |
| **E. Age/mtime guard** | no PID; no new grammar | Reclaims a live-but-idle window's dir; **liar timestamps measured** (a 0.48d-old dir holding a file claiming 571.83d); atime unreliable under Linux `relatime` | Rejected (§3.7) — the failure direction is *delete a live dir*, the wrong way to fail |
| **F. Lock file / flock** | systemd-tmpfiles honours BSD locks — one mechanism would buy safety from both our sweep *and* the Linux reaper | **Node has no built-in `flock`** → a native dependency, against `dependencies: {}` | Rejected — disproportionate at this priority (§3.7) |
| **G. Route untitled docs to an open workspace folder** | collapses the leak to folderless windows only; reuses the swept path | Writes an untitled scratch doc's source into an unrelated project's `.quarto/`; does not fix the folderless case | Rejected — partial, with a real surprise for the user |

---

## 6. Migration path — three sessions, each with a STOP

### Phase 1 — the reclaim slice ⚠ **needs operator ratification as a slice (§9 Q1)**

**One capability:** *a dead session's temp vdoc dir is reclaimed at the next activation; a live
sibling's is never touched.* Proposed as a 4-layer vertical slice with a checkpoint commit at **every**
layer boundary (SAFEGUARDS' 5-file cap is per-commit).

| Layer | Work | Checkpoint commit |
|---|---|---|
| **L1** | `core/embedded/vdoc-path.ts`: `hostDiscriminator`, `tempVdocDirPrefix`, `tempVdocDirParse` + unit tests | ✅ |
| **L2** | `embedded-vdoc.ts`: `vdocDirFor` uses the host+PID prefix; `isProcessDead`; `sweepStaleTempVdocs(dir?)` | ✅ |
| **L3** | `extension.ts:73`: wire the temp sweep alongside the workspace sweep; **+ the `README.md:170-173` correction** (§12) | ✅ |
| **L4** | integration tests (§8) | ✅ |

> **Each layer must be RED-first (C5), and the layer table is an ORDERING, not a licence to batch.**
> L1 means *one* failing unit test → the minimal pure function → repeat; it does not mean "write all of
> `vdoc-path.ts`, then all of its tests". L4 is where the *integration* tests live because they need L2
> and L3 to exist to drive — it is **not** a "tests last" phase, and if L2 is written without its unit
> tests first, the TDD gate is broken regardless of what lands in L4.

**What DONE looks like:** a directory stamped with a dead PID **and our host tag** is gone after
activation; a directory stamped with a live **foreign** PID is untouched (🐉7 — **not** `process.pid`,
which the self-skip branch intercepts before the guard); a directory stamped with a foreign **host tag**
and a dead PID is untouched; a foreign-named directory is untouched; a matching directory holding a
foreign file keeps both the file and the directory.

**Verification commands (run at EVERY layer boundary — gate (c)):**
```bash
npm run check-types
npm test                       # unit — expect 828 + the new L1 cases
npm run test:integration       # expect 321 + the new L4 cases
npx @vscode/vsce package       # clean 43-file .vsix
```
**Faithfulness (gate d):** the L4 tests MUST create their fixture directories with a **dead** PID
obtained by spawning and reaping a real child (`ESRCH`-verified), **not** a hard-coded high number —
§3.3 measured that an unused PID gives `ESRCH` today, but a hard-coded constant is a fixture that can
silently become live. **Break-revert each guard (G0–G5) individually** and confirm the matching test
goes red; a guard no test discriminates is a guard that is not there. **G2's break-revert is the one to
watch** — §8's trap box explains why the obvious fixture cannot detect its removal.

**This phase is one session. Close out when done.**

### Phase 2 — re-assert `0700` on the fallback dir (the §3.4 finding)

**Why separate:** it is a *different* defect (a silent privacy downgrade on the self-heal path) that
Phase 1's liveness guard does **not** make reachable — with G2 in place, our sweep never deletes a live
dir, so the 0755 resurrection is only reachable via an OS/user deletion. Independent capability,
independent session.

**What DONE looks like:** after the fallback directory is deleted out from under a live session, the
next `ensureVdoc` write lands in a directory that is **0700**, not 0755. Note §3.4(3): `writeFile` never
surfaces `ENOENT`, so the detection must be an **explicit `stat`** in `vdocDirFor` — there is no error
to hook. **Dragon:** the fix must not reintroduce a resolved-value companion to `fallbackDirPromise`
(`:141-146` — S101 deleted it deliberately; do not bring it back).

**Verification commands:**
```bash
npm run check-types
npm test                       # unit — count unchanged from Phase 1's close
npm run test:integration       # + the new mode-assertion test
npx @vscode/vsce package       # clean 43-file .vsix
```
**The DONE assertion, concretely:** an integration test that `mkdtemp`s the fallback dir via a real
untitled forward, `rmdir`s it out from under the live session, forces a second forward, then
`nodeFs.stat`s the resurrected dir and asserts `(mode & 0o777) === 0o700`. **Break-revert it:** with the
fix reverted the same test must observe `0o755` (§3.4's measured value) — if it does not, the test is
not reaching the path.

**This phase is one session. Close out when done.**

### Phase 3 — correct the record (the §3.5 refutation)

> **✅ SHIPPED Session 106 (2026-07-17) — Phase 3 complete; with it the WHOLE plan is now shipped.** Both
> `self-healing` instances were corrected to the measured mechanism — *harmless because the model outlives
> the file* — instead of the refuted *self-healing because the model dies with the file*: the `ensureVdoc`
> reuse-branch comment (`embedded-vdoc.ts:196-201`) and the `sweepStaleVdocs` docstring (`:354-361`).
> `grep -ran "self-healing" src/` now returns nothing; test counts UNCHANGED (comment-only, TDD-exempt).
> The four §3.4/C2/§3.6 `:551-553` citations below were **re-pinned this session** from the rotted
> `:373-375` (which by S106 pointed at `sweepFolder`'s *ownership* comment, not the disclosure one) to
> `:551-553` — `vdocDirFor`'s "information disclosure" docstring. **Re-grep the phrase, not the number, if
> you return here: line numbers have now rotted three times.** `BACKLOG:182` (umbrella) and `:183` (this
> comment) both closed `[x]`. Commit: see `CHANGELOG.md` 2026-07-17 · [BL-182/183].

> **⚠ RE-PINNED after Phase 1 shipped (Session 103).** Every line number below was written against the
> pre-Phase-1 file and Phase 1 moved all of them — the old `:445-448` now lands *inside code Phase 1
> added*. The citations here are re-verified by grep as of `6514064`. **Re-grep before trusting them
> again:** this is the second time this plan's line numbers have rotted, and `grep -rn` **cannot see
> `vdoc-path.ts` at all** (it holds two raw NUL bytes, so git and grep read it as binary — use
> `grep -a`; filed at the end of `BACKLOG.md`).
>
> **Phase 3's scope SHRANK.** The `:295` half is **already done**: Session 103 rewrote that comment in
> the same change that falsified it, because a change should not leave its own claims stale. What
> remains is the `self-healing` comment alone.

Correct the false "self-healing" mechanism at **`embedded-vdoc.ts:348-354`** (was `:333-337`, inside
`sweepStaleVdocs`'s docstring) to what was measured: *the model outlives the file, so a cross-window
delete cannot break an active forward.* Comment-only; no logic change (C5's TDD gate does not apply to
a comment, but nothing else may ride along).

Supporting locations, re-verified: `isModelOpen()` is at **`:627-630`** (was `:445-448`); the reuse
branch that returns a URI whose file may be gone is at **`:190-199`** (was `:178-185`) and carries a
*second* instance of the same false word — `grep -ran "self-healing" src/` currently returns **two**
hits (`:196` and `:352`), not one. Phase 3 must fix both.

**What DONE looks like:** `embedded-vdoc.ts:348-354` states the measured mechanism (the model outlives
the file) rather than the refuted one (the model dies with the file); `grep -ran "self-healing" src/`
surfaces no remaining instance of the false claim. **Use `-ran`, not `-an`:** without `-r` the command
exits 0 having searched nothing, which reads exactly like success (verified — this plan's own author
made that mistake while writing this line). The `-a` is for `vdoc-path.ts`, which plain grep cannot read.

**Verification commands:**
```bash
npm run check-types
npm test                       # unit — MUST be unchanged; a comment edit moves no count
npm run test:integration       # MUST be unchanged
```
A moved test count is the signal that something other than a comment changed.

**This phase is one session — and it is small enough to be a candidate for merging into Phase 1's L2
commit if the operator prefers (§9 Q4). Close out when done.**

---

## 7. Evidence-based inventory (MANDATORY — this plan has deletion shape)

Every reference below came from an actual search, not from architectural knowledge. Run at HEAD `d73a841`.

**`grep -rn "sweepStaleVdocs" src/ test/` → 14 hits.** The signature is **NOT** changing (§4.2), so all
5 test call sites stay green untouched:

| File:line | Kind |
|---|---|
| `src/extension.ts:15` | import |
| `src/extension.ts:73` | **the only call site — Phase 1 L3 changes this line** |
| `src/features/embedded-vdoc.ts:46`, `:295` | docstring/comment (`:295` **must be corrected** — it says the temp dir is swept by nothing) |
| `src/features/embedded-vdoc.ts:339` | definition |
| `test/unit/vdoc-path.test.ts:17` | docstring |
| `test/integration/suite/embedded-vdoc.test.ts:11` | import |
| `test/integration/suite/embedded-vdoc.test.ts:343` | docstring |
| `test/integration/suite/embedded-vdoc.test.ts:411, 422, 433, 447, 461` | **5 call sites, all `sweepStaleVdocs(vscode.workspace.workspaceFolders ?? [])`** |
| `test/integration/suite/embedded-vdoc.test.ts:656` | comment |

**Other affected symbols:**

| Symbol | Hits | Bearing on this plan |
|---|---|---|
| `mkdtemp` / `tmpdir` | 11 in `src/` | **exactly ONE executable site: `embedded-vdoc.ts:390`** (Phase 1 L2 changes it); all 10 others are comments |
| `fallbackDirPromise` | 12 (9 src / 3 test) | Phase 2's surface. `:147` decl, `:303-304` reset, `:388-412` creation |
| `VDOC_DIR_SEGMENTS` | 13 | **workspace only — untouched by this plan.** `test/unit/vdoc-path.test.ts:61` pins it to `[".quarto","vdoc-mit"]` exactly |
| `isOurVdocFileName` | 17 | reused as G4 — **unchanged** |
| `vdocInstanceId` / `INSTANCE_ID` | 6 / 3 | the **file**-level ownership stamp; unchanged. `INSTANCE_ID` is **not exported** — a test needing it must go through a written file's name |
| `vdocFileName` | 13 | unchanged |
| `disposeAllVdocs` | 27 | **untouched** — Session 101's fix owns the clean-deactivate path; this plan owns only the crash path |

**Dangling-reference check for Phase 1 (re-run after this plan's own revision changed the names):**
`hostDiscriminator` / `tempVdocDirPrefix` / `tempVdocDirParse` / `sweepStaleTempVdocs` / `isProcessDead`
each return **0 hits** across `src/` and `test/` — all five names are free. `process.pid` returns **0
hits** in `src/` *and* `test/`, and `hostname` returns **0 hits** in `src/`, so Phase 1 introduces the
first use of both.

---

## 8. Verification plan

**How we will know it works.** The integration suite (`@vscode/test-electron`, a real extension host) is
the faithful surface: it is killed without a clean deactivate on every run, which **is** the production
crash path — this suite has been *manufacturing* the very leak the plan fixes, ~1 dir per run (§3.1).
That makes it an unusually honest fixture.

| Test | Asserts | Guard |
|---|---|---|
| dead-PID dir is reclaimed | dir gone after `sweepStaleTempVdocs()` | the feature |
| **live FOREIGN-PID dir is untouched** | dir + contents intact | **G2 — the load-bearing one** |
| our own dir (`process.pid`) is untouched | dir + contents intact | the self-skip branch (**not** G2 — see below) |
| `EPERM` PID is treated as alive | dir intact (fixture: a root-owned PID, e.g. 1) | G2 |
| **foreign-host dir with a dead PID is untouched** | dir + contents intact | **G0** |
| foreign dir name untouched | e.g. `quarto-mit-vdoc-nopid/`, `.vdoc.abc.py/` | G1 |
| our dir holding a foreign file | file kept, dir kept (rmdir fails ENOTEMPTY) | G4+G5 |
| symlink not followed (dir level) | **the TARGET's file survives** | G3 |
| symlink not followed (file level) | a `vdoc-mit.*`-named symlink inside a reclaimable dir: **its target survives** | G3/G4 |
| round-trip grammar (unit) | `tempVdocDirParse(mkdtemp-produced name)` yields `{host, pid}` matching what was passed in | L1 |
| prefix shape (unit) | `` tempVdocDirPrefix(1234) === `quarto-mit-vdoc-<h>-1234-` `` — **exact string, incl. the trailing `-`** | 🐉2 |

> ### ⚠ Two fixture traps the executor MUST NOT walk into — both found by this plan's own review
>
> **1. `process.pid` cannot test G2.** §4.1 evaluates `pid === process.pid → SKIP` **before** the
> liveness check, so a `process.pid` fixture is intercepted by the self-skip branch and **never
> reaches `isProcessDead` at all** — the test would stay green with **G2 deleted**. This is the exact
> shape of Learning #109 (a test that passes without exercising the code it names). The live-PID
> fixture **must be a live FOREIGN pid**: spawn a long-lived child
> (`spawn(process.execPath, ["-e", "setTimeout(()=>{},60000)"])` — verified feasible), name the
> fixture dir with **its** pid, assert the dir survives, and SIGKILL the child in the `finally`.
> Keep `process.pid` as a **separate** test for the self-skip branch.
>
> **2. The `EPERM` row is the only test that catches the 🐉1 inversion.** A naive
> `catch { dead }` implementation passes every other row unscathed — the live-foreign row's `kill`
> does not throw at all. Do not drop this row because pid 1 "feels like a hack": it is the only
> discriminator for the single most dangerous mistake in the design.

**Runtime verification (Phase 3E).** The 321-test real-EDH suite exercises the actual activation and
`mkdtemp` paths in a real host — that is the runtime evidence, as it was for S101. **No F5 pass is
needed: this deliverable adds no drivable UI surface.** `npm run test:lsp` is **not** required — no path
here involves a real language server.

**Post-run hygiene check — and note the earlier draft of this plan got its acceptance criterion wrong,
in a way that would have sent the executor chasing a non-bug.** It said the count should "trend to 0".
It cannot: 🐉5 and §3.1 both say the suite SIGKILLs its host every run, so **each run leaves its own
corpse behind by construction**. The steady state after a run is **1**, not 0.

The real signal is that the count **stops growing**: after `npm run test:integration`, exactly one
`quarto-mit-vdoc-*` dir should remain — the current run's own, stamped with the just-killed host's PID —
and the *previous* run's dir should be gone, reclaimed by this run's activation. So:

```bash
# after each of two consecutive integration runs:
ls -d "$TMPDIR"quarto-mit-vdoc-* 2>/dev/null | wc -l    # expect 1 both times, not 1 then 2
```

Make the check **PID-aware** rather than count-based where possible: assert the surviving dir's PID
parses to the run's own host, and that no dir carrying an *older* run's dead PID survives. Counting has
a second, undetectable reading the executor should know about: **a count of 0 means the suite exercised
no untitled forward that run**, which makes the check vacuous rather than passing.

---

## 9. Decisions the operator should make before Phase 1

**Q1 — Is Phase 1 one vertical slice, or two sessions?** ⚠ *The one that matters.* The four layers are
one capability and one pre-declared contract (this plan), which satisfies the slice test (FM #26). But
`SESSION_RUNNER.md` is explicit that **recoverability, not verifiability, is the ceiling on slice
size**, and this is a delete loop. **Recommendation: one slice**, on the precedent of Session 45
(project-level render: 4 checkpoint-committed layers, one session) and Session 47 — both delete-free,
which is the honest disanalogy. Splitting L1+L2 from L3+L4 is the conservative alternative and costs
one session.

**Q2 — ~~Should the sweep also reclaim the CURRENT, PID-less dirs?~~ WITHDRAWN — the premise is false,
and its replacement is a scheduling point worth more than the question was.** An earlier draft asked
the operator to weigh a backwards-compatibility branch for directories "left by a shipped version".
**No such directory can exist:** §3.8 measures version `0.0.1`, `preview: true`, **zero git tags**, and a
CHANGELOG that is entirely `[Unreleased]` — *the extension has never been published*. The only PID-less
directories anywhere are on developer machines (currently **1**, from this session's own probes), and
`rm -rf` clears them. No compat branch, no age heuristic, no operator decision.

**What replaces it:** the grammar locks at **first publish**, not today (§2.4) — so the sequencing
question is real and the answer is easy. **Land Phase 1 before the v1 Marketplace listing** and the
whole compatibility problem never exists. Ship the listing first and G0 becomes unbuyable at any price.

**Q3 — Is this worth doing at all?** Alternative A (do nothing) is genuinely tenable: macOS bounds it at
reboot, Debian at 10 days, and the payload is kilobytes. **Recommendation: do it** — Windows is
unbounded, it is the user's source, and Phase 1 is small. But this is a **LOW-priority hygiene fix**,
and the plan should not pretend otherwise. **The one thing that makes it time-sensitive rather than
merely worthwhile is Q2's scheduling point:** the grammar is free to get right now and frozen the moment
the extension is published.

**Q4 — Does Phase 3 (the comment correction) merit its own session,** or should it ride Phase 1's L2
commit, given it corrects a comment about the very lifecycle L2 touches?

---

## 10. Scope boundary — what this plan does NOT change

- **`disposeAllVdocs` and the clean-deactivate path.** Session 101 owns it; this plan owns only the
  crash path.
- **The workspace sweep** (`sweepFolder`, `VDOC_DIR_SEGMENTS`, `isOurVdocFileName`) — unchanged. Its
  `INSTANCE_ID`-mismatch trade-off stays as it is; §3.5 shows it is **safer than its own comment
  claims**, just for a different reason.
- **`sweepStaleVdocs`'s signature** — deliberately, to keep 5 test call sites untouched (§4.2, §7).
- **`BACKLOG:121` leg (a)** (unbounded `disposeEpoch`) and **`BACKLOG:103`** (after-dispatch deactivate)
  — adjacent vdoc-lifecycle LOWs, deliberately out of scope.
- **Any liveness mechanism beyond G0+G2** — no lock file, no `flock`, no heartbeat, no background timer,
  no native dependency. §3.7 sizes this as LOW-priority hygiene; a protocol would be disproportionate.
- **The PID-less directories already on developer machines** (measured: 1). No compatibility branch —
  §3.8 shows nothing has ever shipped, so the population is developer-only and `rm -rf` clears it.
- **The ~180s model-eviction lifetime and the `_cleanup()` valve interaction** (§3.5) — a genuinely new
  finding, **filed not fixed**: the code already handles it correctly, and characterising the valve is a
  measurement job, not this plan's.

---

## 11. Dragons 🐉 (Learning #3 — not all phases are equally risky)

| 🐉 | Where | Why it bites |
|---|---|---|
| **🐉1** | **`EPERM` is ALIVE** (Phase 1 L2) | `try { kill(pid,0) } catch { dead }` is the natural thing to write and it is **wrong** — it reclaims a live foreign process's dir. Measured: pid 1 → `EPERM`, demonstrably alive. **This inverts the whole failure direction.** Matters more on Linux, where `/tmp` is cross-user. **The `EPERM` row in §8 is its only discriminator** — every other row passes against the naive version |
| **🐉2** | **The trailing dash** (Phase 1 L1) | `mkdtemp` appends its 6 random chars with **no separator of its own**, so a prefix missing the trailing `-` yields `quarto-mit-vdoc-<h>-548278u7zTF`, which the anchored grammar **rejects** — the sweep then reclaims **nothing, ever**, silently. A *total* failure in the *safe* direction. Pin it with an **exact-string assertion on `tempVdocDirPrefix`**; a parse assertion discriminates nothing (§3.3) |
| **🐉3** | **Ext-host restart semantics** (Phase 1) | **UNVERIFIED** — whether a crashed/reloaded ext host returns with a fresh PID or lingers as a zombie was not measured. A zombie reads *alive* (safe: leak). **Verify firsthand before relying on reload-window behaviour** |
| **🐉4** | **Real out-of-process LSPs** (§3.5) | The "harmless" verdict is measured for VS Code's dispatch plumbing **only**. Pylance et al. have their own watchers. If Phase 1 ever deletes a live dir (it should not — G0+G2), this is where the surprise lives |
| **🐉5** | **The suite manufactures the bug** (Phase 1 L4) | The integration host is SIGKILLed every run, so the suite leaks a dir per run **by design**. A test asserting "$TMPDIR is clean" will be polluted by *sibling* runs and by the run's own corpse. Scope every assertion to fixtures the test itself created (this is why §4.2 has the `dir` seam) |
| **🐉6** | **`BACKLOG:NNN` is a LINE NUMBER** | 30 citations deep (15→`:127`, 7→`:125`, 3→`:102`, 2→`:121`, 2→`:119`, 1→`:123`). Rewrite items **in place**; append new ones at the **END**. Retiring the scheme is a real, separate cleanup |
| **🐉7** | **`process.pid` cannot test G2** (Phase 1 L4) | The self-skip branch intercepts it **before** the liveness check, so the obvious "live PID" fixture never reaches the guard it claims to pin and stays green with **G2 deleted** (Learning #109's exact shape). Use a **live foreign** pid — spawn a long-lived child. See §8's trap box |
| **🐉8** | **A PID is only meaningful in its own namespace** (Phase 1 L1/L2) | Across a namespace/machine boundary (`$TMPDIR` bind-mounted into a container; NFS home + `TMPDIR=$HOME/tmp`), a **live** process's PID reads `ESRCH` → the sweep **deletes live data**, and §3.4's silent 0755 resurrection turns a hygiene fix into a disclosure. G0 exists solely for this. **Not routine** (default remote modes don't share `$TMPDIR`) but **now-or-never**, since the grammar locks at publish |

---

## 12. Impact analysis

| Surface | Impact | Action required |
|---|---|---|
| `core/embedded/vdoc-path.ts` | +3 pure functions (`hostDiscriminator`, `tempVdocDirPrefix`, `tempVdocDirParse`), +1 regex | unit tests (L1) |
| `features/embedded-vdoc.ts` | `mkdtemp` prefix; +`sweepStaleTempVdocs`; +`isProcessDead`; `:295` comment becomes false | L2 + integration tests |
| `extension.ts:73` | +1 fire-and-forget call | L3 |
| **`README.md:170-173`** | **it already promises what this plan delivers — and the promise is FALSE today** | **L3 (docs ride the wiring commit)** |
| `sweepStaleVdocs` + its 5 test call sites | **none** — signature unchanged | none |
| The workspace vdoc path | **none** | none |
| Untitled-doc forwards | dir name changes; behaviour identical | none |
| `dependencies: {}` | **none** — `node:process`, `node:os` are built-in | none |
| `.vsix` | no new files | confirm 43-file package |

**The README finding deserves its own paragraph, because it inverts the usual doc-drift story.**
`README.md:170-173` currently tells users that virtual documents *"live in `.quarto/vdoc-mit/` inside
your workspace, are deleted when the document closes, and **any left behind by a crash are swept at
startup**."* For an untitled `.qmd` **both halves are wrong today**: the vdocs do not live in the
workspace (they go to the OS temp dir), and nothing sweeps them at startup — that is precisely this
plan's defect. So the extension is **already documented as behaving the way Phase 1 makes it behave**.
Phase 1 does not create a documentation debt; **it pays one off.** The edit is one sentence in that
paragraph naming the fallback (an untitled or out-of-workspace `.qmd` has no workspace root, so its
vdocs go to a private `0700` directory in the OS temp dir instead, swept at the next startup), and it
should land with L3. Note this is a **user-facing** correction of a claim about where their source is
written — not cosmetic polish, and worth doing even if the operator picks Alternative A (do nothing),
in which case the README must instead be corrected *downward* to stop promising a sweep that does not
happen.

**What might break:** the only user-visible risk is the delete loop. Its two load-bearing guards — G0 and
G2 (§4.3) — both fail toward *leak*, the four others bound the blast radius to files this extension
itself wrote, and its worst realistic outcome (deleting a live vdoc) was **measured** not to break an
active forward, because the model outlives the file (§3.5). The residual is §3.4's silent 0755
resurrection, which needs Linux **and** a permissive umask **and** a local attacker **and** a
non-default shared `$TMPDIR` — the conjunction G0 exists to break.

---

## 13. Provenance and corrections owed to the record

This plan **corrects `BACKLOG:182`** on two measured points (§3.1, §3.2): the "56 directories" evidence
no longer reproduces (0 today) and was a developer-machine artifact rather than a user rate; and the
"0644 files inside a 0700 dir" security clause is refuted as written — the bound is the **directory
alone**. The item is rewritten **in place** (🐉6) to point at this plan.

It also **files, without fixing** (§10): the false `:333-337` self-healing comment (Phase 3 here), and
the ~180s vdoc-model eviction lifetime plus its unmeasured `_cleanup()`-valve interaction.

**How much of §3 to trust, stated precisely — because a blanket assurance is exactly the thing this
project keeps catching.** An earlier draft of this section said "everything in §3 is measured or
byte-traced", which was itself an overclaim that laundered §3.7's macOS *inference* into a fact. The
honest breakdown:

| Claim class | Status | Where |
|---|---|---|
| The code defect (sweep scope, single `mkdtemp` site, single call site) | **measured**, and re-verified by me firsthand | §3.1, §7 |
| Permission modes, `kill` errnos, grammar round-trip, release status | **measured** on this box | §3.2, §3.3, §3.8 |
| `writeFile`'s `mkdirp` + the 0755 resurrection | **byte-traced** in the pinned 1.129.0 bundle + measured node semantics; **no live EDH probe** | §3.4 |
| The `isModelOpen`/180s refutation | **measured in a real EDH** — but with an **in-process** provider, not a real out-of-process LSP (🐉4) | §3.5 |
| macOS boot-wipe bound | **census measured**; the disassembly reachability is an **inference** | §3.7 |
| Linux / Windows reaping | **sourced, not measured** — no box available | §3.7 |
| Both windows concurrently holding an untitled `.qmd` | **inherited from S101, unmeasured** — the design deliberately does not rest on it | §1, §3.3 |

**This plan's own review refuted three of its claims before it was committed** — the "five independent
guards" defense-in-depth framing (§4.3), the 🐉2 trailing-dash mis-parse (§3.3), and the "trend to 0"
hygiene criterion (§8) — plus the false §9 Q2 premise. Each is now corrected **in place, with the error
left visible** rather than quietly rewritten, because the next session should be able to see which
claims were tested and which merely sounded right. This project's Learnings #107–#112 record six
consecutive sessions in which an inherited premise, or a plan's own confident remedy, needed refuting.
**The 🐉2 error is the clearest instance yet: it was a grounding agent's prose gloss, transcribed into a
dragon and labelled "Measured", inside a plan that warns against exactly that.** Trust the labels in the
table above over any sentence's tone, including this one's.
