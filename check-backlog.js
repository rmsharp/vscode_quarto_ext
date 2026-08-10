#!/usr/bin/env node
/**
 * The hygiene gate on `BACKLOG.md` — it holds OPEN work only
 * (CHANGELOG: BACKLOG.md holds only open work, Session 195).
 *
 * ## Why this exists
 *
 * The file's own header has said "Open, actionable work items only" since it was
 * written, and SESSION_RUNNER Phase 3F says to remove a completed item in the
 * same commit that records it in the ledger. Neither is a mechanism, and the
 * practice regressed twice: Session 150 deleted 115 KB of re-accumulated
 * completed work — 46% of the file — and wrote "keep it clean"; by Session 194
 * the file carried 24 records / 32 KB again, contributed by 30 sessions, and
 * that session's own close-out added one.
 *
 * The contrast is the whole argument. The authoritative ledger does not drift,
 * because it has a Phase 3F write-gate AND a Phase 0 reconcile-on-read. The
 * packaged file set does not drift, because `check-package.js` is
 * deny-by-default. `BACKLOG.md` had the instruction and neither backstop — and
 * an instruction that nothing checks is a preference. This is the missing check.
 *
 * ## What it asserts, and why it reads only the LEAD
 *
 * A completed record is one whose OWN LEAD — the block's first bold span —
 * announces the work is over, either by opening with a completion word or by
 * naming the session that finished it.
 *
 * ⚠ Reading the whole block instead would be wrong, and this is MEASURED, not
 * reasoned: of the 35 lines in the file that contain `SHIPPED Session`, only 17
 * are records. The rest are OPEN items that legitimately cite shipped work
 * ("⚠ CORRECTED BY SESSION 189, WHICH SHIPPED …"), and a gate that reds on
 * those gets switched off — the same outcome as having no gate. A record ASSERTS
 * its own completion; an open item CITES someone else's.
 *
 * Parenthetical asides are stripped from the lead before the test for the same
 * reason, and that too came from a real document rather than from caution:
 * "Quoted-KEY divergence — the CONTAINER half (the leaf half SHIPPED Session
 * 159)" is an item that is still OPEN over its container half.
 *
 * ⚠ Do NOT relax this to a substring search for "SHIPPED". The measured cost is
 * ~18 false positives against ~95 open items, and the first session to meet them
 * will delete the gate rather than the records.
 */

/** A block opens at a checkbox, a `***`-emphasised record, or a heading. */
const BLOCK_OPEN = /^(?:- \[[ x]\] |\*\*\*|#)/;

/** The block's first bold span — its lead. */
const LEAD = /\*\*(.+?)\*\*/s;

/** A lead that OPENS by announcing the work is over. */
const OPENS_AS_DONE = /^(?:REMOVED|DONE|COMPLETED|SHIPPED|CLOSED|LANDED|MERGED)\b/;

/** A lead that names the session which finished the work. */
const NAMES_ITS_SESSION =
  /(?:SHIPPED|ACTED ON|DONE|COMPLETED|CLOSED|LANDED|FIXED|RESOLVED|IMPLEMENTED|MERGED|REMOVED)(?:\s+\w+){0,3}\s+Session\s+\d+/;

/**
 * A lead's parenthetical asides, removed innermost-first.
 *
 * This is what separates a RECORD from a REFERENCE, and it is the whole reason
 * the gate reads the lead rather than the block. An open item routinely cites
 * shipped work — "the CONTAINER half (the leaf half SHIPPED Session 159)" is
 * open over its container half — and the citation is a parenthetical, while a
 * record's own completion is asserted in the main clause.
 */
function withoutAsides(lead) {
  let text = lead;
  for (;;) {
    const next = text.replace(/\([^()]*\)/g, " ");
    if (next === text) return text;
    text = next;
  }
}

function blocksOf(markdown) {
  const lines = markdown.split("\n");
  const blocks = [];
  let current = null;
  lines.forEach((line, index) => {
    if (BLOCK_OPEN.test(line)) {
      if (current) blocks.push(current);
      current = { line: index + 1, text: [line] };
    } else if (current) {
      current.text.push(line);
    }
  });
  if (current) blocks.push(current);
  return blocks;
}

function findCompletedRecords(markdown) {
  const found = [];
  for (const block of blocksOf(markdown)) {
    const match = LEAD.exec(block.text.join("\n"));
    if (!match) continue;
    // `***Lead**` is bold INSIDE italic, so the bold capture keeps the italic's
    // opening `*`. Strip it — the lead is the words, not the emphasis.
    const lead = match[1].split(/\s+/).join(" ").trim().replace(/^\*+/, "");
    const claim = withoutAsides(lead);
    if (OPENS_AS_DONE.test(claim) || NAMES_ITS_SESSION.test(claim)) {
      found.push({ line: block.line, lead });
    }
  }
  return found;
}

function main() {
  const fs = require("node:fs");
  const path = require("node:path");
  const file = path.join(__dirname, "BACKLOG.md");

  if (!fs.existsSync(file)) {
    console.error(`check-backlog: ${file} not found.`);
    process.exit(2);
  }

  const markdown = fs.readFileSync(file, "utf8");
  const records = findCompletedRecords(markdown);
  const open = (markdown.match(/^- \[ \] /gm) || []).length;

  if (records.length > 0) {
    console.error(
      `check-backlog: FAIL — ${records.length} completed-work record(s) in BACKLOG.md, ` +
        `among ${open} unchecked boxes\n`,
    );
    for (const record of records) {
      console.error(`  ✗ BACKLOG.md:${record.line}  ${record.lead}`);
    }
    console.error(
      `\n  Completed work belongs in CHANGELOG.md, and anything worth carrying` +
        `\n  forward — a corrected magnitude, a refuted prescription — belongs in` +
        `\n  PROJECT_LEARNINGS.md. Record it there, then delete the block here.`,
    );
    process.exit(1);
  }

  console.log(
    `check-backlog: OK — no completed-work records, ${open} open items.`,
  );
}

if (require.main === module) main();

module.exports = { findCompletedRecords };
