import { describe, expect, it } from "vitest";
import { findCompletedRecords } from "../../check-backlog.js";

/**
 * The regression guard on `BACKLOG.md`'s one rule: it holds OPEN work only
 * (CHANGELOG: BACKLOG.md holds only open work, Session 195).
 *
 * The gap this pins closed: the file's header has said "Open, actionable work
 * items only" since it was written, and SESSION_RUNNER Phase 3F says to remove a
 * completed item in the same commit that records it — and neither is a
 * mechanism. Session 150 deleted 115 KB of re-accumulated completed work (46% of
 * the file) and wrote "keep it clean"; by Session 194 it had re-accumulated 24
 * records / 32 KB from 30 sessions, and that session's own close-out added one.
 *
 * Contrast the two things in this repo that do NOT drift: the authoritative
 * ledger has a Phase 3F write-gate AND a Phase 0 reconcile-on-read, and
 * `check-package.js` is deny-by-default. `BACKLOG.md` had the instruction and
 * neither backstop. An instruction that nothing checks is a preference.
 */
describe("the backlog hygiene gate", () => {
  it("finds a completed record wearing an open-task checkbox", () => {
    // The exact shape the operator pointed at, verbatim from BACKLOG.md line 208
    // as it stood at Session 194's close.
    const markdown = [
      "## Up Next",
      "",
      "- [ ] **REMOVED — SHIPPED Session 182.** *(BOTH `CLOSES_PARAGRAPH` items",
      "  above were one deliverable; see `CHANGELOG.md`, 2026-08-02.)*",
      "",
    ].join("\n");

    const found = findCompletedRecords(markdown);

    expect(found.map((r) => r.lead)).toEqual(["REMOVED — SHIPPED Session 182."]);
  });

  it("finds a completed record that carries no checkbox at all", () => {
    // The filed item proposed "no `- [ ] ` line contains REMOVED/SHIPPED".
    // MEASURED against the real file: that rule is blind to 7 of the 24 records,
    // which is a third of them — these `***`-emphasised blocks never wear a
    // checkbox. Verbatim from BACKLOG.md line 216 at Session 194's close.
    const markdown = [
      "***The raw-TeX block-MACRO list — SHIPPED Session 188.** `CLOSES_PARAGRAPH`",
      "and `OPENS_FRESH_BLOCK` now carry pandoc's own macro classification.*",
      "",
    ].join("\n");

    const found = findCompletedRecords(markdown);

    expect(found.map((r) => r.lead)).toEqual([
      "The raw-TeX block-MACRO list — SHIPPED Session 188.",
    ]);
  });

  it("does NOT flag an open item whose lead parenthetically cites shipped work", () => {
    // ⚠ THE LOAD-BEARING CASE, and the reason this gate reads only the LEAD.
    // MEASURED against the real file: 35 lines contain `SHIPPED Session` and
    // only 17 are tombstones, so a rule that scans a whole block reds on ~18
    // genuinely open items that merely CITE shipped work — and a gate that cries
    // wolf gets deleted, which is the same outcome as having none.
    //
    // This one is the hard case: the citation is inside the LEAD itself, so
    // lead-scoping alone is not enough. Verbatim from BACKLOG.md line 324, an
    // item that is OPEN over its container half.
    const markdown = [
      "- [ ] **Quoted-KEY divergence — the CONTAINER half (the leaf half SHIPPED",
      "  Session 159)** (verified firsthand S159, **lost true positives, safe",
      "  direction, LOW**). S159 unquoted the LEAF key on both surfaces.",
      "",
    ].join("\n");

    expect(findCompletedRecords(markdown)).toEqual([]);
  });
});
