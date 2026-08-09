#!/usr/bin/env python3
"""methodology_trim.py — the ledger trimmer.

Moves the oldest records out of a grow-and-must-be-read ledger into a frozen shard under
`docs/archive/`, and refuses to do it unless the move is provably lossless.

Implements the ledger-trimmer design (S35). `bin/sync` installs this file at your project root
and does NOT install that design, which lives only in the methodology repository as
`docs/planning/ledger-trimmer-design.md` — deliberately, since it is a working document for the
tool's authors rather than something an adopter operates. No URL is given for it on purpose: it
has not been published to a public remote, and a link that 404s is worse than a path plus the
repository's name. The design is the spec and this file does not re-open it; whoever changes this
module reads its §2 (the three-zone record model), §4 (the three assertions) and §5 (the trigger)
first, from a checkout of that repository. Nothing mechanical protects this reference:
`bin/check-links` validates only the distributed *markdown*, so a dangling citation inside this
module is never reported.

WHY THREE ASSERTIONS AND NOT ONE
    The manual procedure this replaces proved whole-file byte identity under concatenation, and
    that proof passed while a paragraph was silently lost (`020ba3f` — the pre-v3.0 scope footer
    of the root CHANGELOG, still missing today). It *had* to pass: moving a paragraph from the
    live file into the shard is exactly byte-preserving under concatenation. So:

      L1  concatenation identity, scoped to the RECORDS zone   — is every record byte still somewhere?
      L2  zone pinning                                          — is every byte still in the RIGHT file?
      L3  record partition, per record, by identity+order+bytes — was it a pure move, or a move plus an edit?

    None of the three is the whole-file check, and that is deliberate: the unscoped whole-file form
    is unsatisfiable on any run that regenerates the pointer (design §4.2).

DEFAULTS THAT ARE INVERTED ON PURPOSE
    Dry run is the default; `--write` is required to touch anything. The tool never commits, and
    it never runs `git mv` (design P2 — `--no-renames` in the FM #27 pre-commit hook means a
    rename-shaped trim passes a gate meant to notice it).

Python 3 stdlib only, cross-platform — this file is destined for adopter roots (design §6.1).
"""

from __future__ import annotations

import argparse
import datetime
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

TRIM_VERSION = "1.1.1"   # 1.1.0: GRAMMAR_MISMATCH — a grammar this tool cannot read
                         # is no longer reported as an empty file (UAT F1). New finding code and
                         # a new exit status on a distributed tool, so: minor, not patch.

# --- Tunables, all of them judgment, all of them labelled as such in the design ---------------
READ_CAP_LINES = 2000          # agent `Read` truncation cap — harness behaviour, not a repo property
DEFAULT_BUDGET_BYTES = 64 * 1024   # design §5.4: calibrated to the three sizes this repo operated at
LINE_FIRE_BELOW = 15           # design §5.2, the published rate rule, kept verbatim
LINE_STOP_ABOVE = 30
BYTE_STOP_FRACTION = 0.5       # hysteresis — stops a trim re-firing on the next record
SRF_RED = 1.00                 # plan §3.3 H3: at or above this, a reset is the wrong move
ARCHIVE_DIR = "docs/archive"
REBASE_PREFIX = "../../"       # docs/archive/<shard>.md -> repo root is exactly two levels

# --- "is this plausibly a fresh seed?" — a DIFFERENT question from "is it over its budget" ----
# Deliberately its own literal rather than an alias of DEFAULT_BUDGET_BYTES, and deliberately not
# `opts.budget_bytes`: --budget-bytes tunes when a trim FIRES, and the seeds invite an adopter to
# lower it. Wiring that knob into this test would let a calibration choice decide whether the tool
# tells you your ledger grammar is wrong — and a budget set below 12,124 B would declare the seed
# we ship to be unreadable. The two numbers may drift apart; nothing should couple them.
SEED_PLAUSIBLE_MAX_BYTES = 64 * 1024


# =============================================================================================
# Findings — the tool's output vocabulary.
#
# Tests assert on CODES, never on the process exit code: the exit code is a union over every
# check the tool runs, so adding one check silently re-labels unrelated assertions (design §6.3).
# =============================================================================================

class Finding:
    __slots__ = ("code", "message")

    def __init__(self, code, message):
        self.code = code
        self.message = message

    def __repr__(self):
        return "Finding(%s)" % self.code


class Result:
    """Everything one --file evaluation produced. `codes` is the assertable surface."""

    def __init__(self, path):
        self.path = path
        self.findings = []
        self.exit = 0
        self.plan = None          # TrimPlan, when one was computed
        self.written = []         # paths actually written

    def add(self, code, message, exit_code=None):
        self.findings.append(Finding(code, message))
        if exit_code is not None and exit_code > self.exit:
            self.exit = exit_code
        return self

    @property
    def codes(self):
        return [f.code for f in self.findings]

    def has(self, code):
        return code in self.codes


# =============================================================================================
# Config table — a table in the tool, never a config file.
#
# A file with no entry exits 3. It does NOT fall back to a generic rule, because a generic rule
# is exactly what would mis-zone an adopter's differently-shaped ledger (design §6.3).
# =============================================================================================

class LedgerSpec:
    def __init__(self, basename, record_kind, footer_mode, date_of_record,
                 record_start=None, fence_info=None, regenerated=(), budget_bytes=DEFAULT_BUDGET_BYTES,
                 content_probe=None, seed_negation=None):
        self.basename = basename
        self.record_kind = record_kind        # "heading" | "fence"
        self.record_start = record_start      # compiled regex, for record_kind == "heading"
        self.fence_info = fence_info          # info string, for record_kind == "fence"
        self.footer_mode = footer_mode        # "separator" | "none"
        self.date_of_record = date_of_record  # callable(record_text) -> "YYYY-MM-DD" or None
        self.regenerated = list(regenerated)  # [(name, compiled regex w/ 3 groups, value_fn)]
        self.budget_bytes = budget_bytes
        self.content_probe = content_probe    # loose "this LOOKS like a record" regex, or None
        self.seed_negation = seed_negation    # the seed comment's own "and there are no X below"


def _changelog_date(text):
    m = re.match(r"^### (\d{4}-\d{2}-\d{2}) · ", text)
    return m.group(1) if m else None


def _handoff_date(text):
    m = re.search(r"^date: (\d{4}-\d{2}-\d{2})\s*$", text, re.M)
    return m.group(1) if m else None


LEDGERS = {
    "CHANGELOG.md": LedgerSpec(
        basename="CHANGELOG.md",
        record_kind="heading",
        # Anchored on the dated, source-tagged heading the ledger's own audit grep uses.
        record_start=re.compile(r"^### \d{4}-\d{2}-\d{2} · \["),
        footer_mode="separator",
        date_of_record=_changelog_date,
        # The live root ledger carries no count sentence today, so this list is empty and the
        # pointer block below is the whole of the front-matter change. Declared-empty is not the
        # same as unchecked: L2 still confines the front-matter diff to the pointer block.
        regenerated=(),
        # Evidence that entries EXIST in a grammar this config cannot read. Anchored to a line
        # that could plausibly BE a record — an ATX heading or a table row — not to "a date
        # somewhere on the line", which also matches ordinary front-matter prose describing dates.
        # Measured over the real population: the anchored form loses no detection — 147 and 87 hits
        # on the two ledgers the UAT named, and 11 and 4 on two more found while building this fix
        # and NOT part of that audit — while dropping to zero on both shipped seeds and on dated
        # prose. Do not re-attribute all four to the UAT; it examined six repositories, not eight.
        content_probe=re.compile(r"^(#{1,6} |\|).*\d{4}-\d{2}-\d{2}"),
        # No separate negation: for a HEADING-keyed ledger the probe already subsumes it. Every
        # `### <date>` line is also `#{1,6} `-shaped and dated, so a negation here can never be the
        # only signal that fires, and a clause no mutant can falsify is a comment shaped like a
        # guard. HANDOFFS.md keeps one because its records are fences, where that is not true.
        seed_negation=None,
    ),
    "HANDOFFS.md": LedgerSpec(
        basename="HANDOFFS.md",
        record_kind="fence",
        fence_info="handoff",
        # Declared to have NO footer: trailing prose below the last fence belongs to that receipt.
        # The declaration is asserted, not assumed — see classify_zones().
        footer_mode="none",
        date_of_record=_handoff_date,
        regenerated=(
            ("retained receipt count",
             re.compile(r"(This file currently holds \*\*)(\d+)(\*\*)"),
             lambda ctx: str(ctx["retained"])),
        ),
        # The SAME probe as CHANGELOG.md, deliberately. The first draft left this None on the
        # argument that a receipt ledger keeps its records inside fences — true of a WORKING one,
        # and beside the point for a broken one: a ledger whose receipts are not ```handoff fences
        # keeps them somewhere, and heading-shaped is the likeliest somewhere. Leaving it None also
        # made the tool's strictness depend on which of two filenames you were holding, which is a
        # guard you can walk around by picking a name. Measured at zero hits on the shipped seed
        # (its worked receipt is inside a 4-backtick wrapper, and the probe is fence-aware).
        content_probe=re.compile(r"^(#{1,6} |\|).*\d{4}-\d{2}-\d{2}"),
        # This file's seed states its own freshness rule in its own terms — fresh "While this line
        # is present AND there are no `session:` blocks below" — so the negation is `session:`,
        # not a dated heading. Fence-aware, so the seed's wrapped example does not count itself.
        seed_negation=re.compile(r"^session:\s"),
    ),
}


# =============================================================================================
# Fence tracking — mandatory, and the seed files are the proof.
#
# `starter-kit/CHANGELOG.md` holds 3 `^### YYYY-MM-DD` lines and ALL 3 are inside fenced
# documentation examples; `starter-kit/HANDOFFS.md` holds 1 ```handoff and it is inside a
# 4-backtick wrapper. A trimmer that is not fence-aware trims an adopter's freshly seeded
# ledger on day one (design §2.2).
# =============================================================================================

_FENCE = re.compile(r"^(`{3,}|~{3,})(.*)$")


def fence_scan(lines):
    """Yield (index, stripped_line, inside_before, info_string).

    `inside_before` is the fence state BEFORE this line, so a fence-opening line reports False —
    which is what makes a ```handoff opener recognisable as a record start.
    """
    marker = None
    for i, raw in enumerate(lines):
        s = raw.rstrip("\r\n")
        inside_before = marker is not None
        m = _FENCE.match(s)
        info = ""
        if marker is None:
            if m:
                marker = (m.group(1)[0], len(m.group(1)))
                info = m.group(2).strip()
        else:
            ch, n = marker
            if m and m.group(1)[0] == ch and len(m.group(1)) >= n and m.group(2).strip() == "":
                marker = None
        yield i, s, inside_before, info


def code_span_ranges(line):
    """Character ranges covered by inline code spans, so a link inside one is out of domain.

    Not hypothetical: the 2026-08-01 shard contains `](../../` inside an inline code span, in a
    sentence explaining the rebase. A naive key rewrites the explanation of the rewrite.
    """
    ranges = []
    i = 0
    n = len(line)
    while i < n:
        if line[i] == "`":
            j = i
            while j < n and line[j] == "`":
                j += 1
            ticks = j - i
            k = j
            while k < n:
                if line[k] == "`":
                    m = k
                    while m < n and line[m] == "`":
                        m += 1
                    if m - k == ticks:
                        ranges.append((i, m))
                        i = m
                        break
                    k = m
                else:
                    k += 1
            else:
                break
            continue
        i += 1
    return ranges


# =============================================================================================
# Zone classification — declared, never inferred. Ambiguity is a refusal.
# =============================================================================================

class Zones:
    def __init__(self, lines, starts, footer_start):
        self.lines = lines
        self.starts = starts                  # record start line indices
        self.footer_start = footer_start      # index, or len(lines) when there is no footer
        self.front_end = starts[0] if starts else footer_start

    @property
    def front(self):
        return "".join(self.lines[:self.front_end])

    @property
    def footer(self):
        return "".join(self.lines[self.footer_start:])

    def record_spans(self):
        """[(start, end)] — a record runs to the next record start, or to the footer.

        Design §2.2 defines both families this way: a record ends at "the line before the next
        record start / footer". Inter-record scaffolding (`## YYYY-MM` group headings, `---`
        separators) therefore rides inside the preceding record's span and moves with it. That is
        a partition; regenerating those headings in both files would be duplication, which L3
        forbids by construction.
        """
        spans = []
        for k, s in enumerate(self.starts):
            e = self.starts[k + 1] if k + 1 < len(self.starts) else self.footer_start
            spans.append((s, e))
        return spans

    def records(self):
        return ["".join(self.lines[s:e]) for s, e in self.record_spans()]


def classify_zones(text, spec, result):
    """Split into FRONT MATTER | RECORDS | FOOTER. Returns Zones, or None after a refusal."""
    lines = text.splitlines(keepends=True)
    starts, hrs = [], []
    for i, s, inside, info in fence_scan(lines):
        if inside:
            continue
        if spec.record_kind == "heading" and spec.record_start.match(s):
            starts.append(i)
        elif spec.record_kind == "fence" and info == spec.fence_info:
            starts.append(i)
        if s.strip() == "---":
            hrs.append(i)

    if not starts:
        return Zones(lines, [], len(lines))

    last = starts[-1]
    tail_hrs = [i for i in hrs if i > last]

    if spec.footer_mode == "separator":
        # A footer is a standalone `---` after the last record start whose remainder contains no
        # further record start. In a newest-on-top file this sits exactly where an oldest-first
        # cut takes from, which is how the scope footer migrated into the shard.
        for i in tail_hrs:
            if "".join(lines[i + 1:]).strip():
                return Zones(lines, starts, i)
        return Zones(lines, starts, len(lines))

    if spec.footer_mode == "none":
        # Declared to have no footer — and the declaration is ASSERTED. Trailing content set apart
        # by a separator is content the config cannot name, so the run aborts with the span printed
        # rather than sweeping it into a record that is about to move.
        for i in tail_hrs:
            span = "".join(lines[i + 1:])
            if span.strip():
                result.add(
                    "ZONE_UNCLASSIFIED",
                    "%s declares footer_mode='none', but line %d is a standalone '---' with %d B of "
                    "content after it that the config cannot classify. Refusing rather than guessing "
                    "which zone it belongs to. Span:\n%s"
                    % (spec.basename, i + 1, len(span.encode("utf-8")), _indent(span[:400])),
                    exit_code=2,
                )
                return None
        return Zones(lines, starts, len(lines))

    result.add("NO_CONFIG", "unknown footer_mode %r for %s" % (spec.footer_mode, spec.basename), exit_code=3)
    return None


def _safe_cut_key(key):
    """A cut key must be a flat filename fragment — no separator, no leading dot."""
    return bool(re.match(r"^[A-Za-z0-9][A-Za-z0-9._-]*$", key or ""))


def _indent(s, pad="    | "):
    return "\n".join(pad + ln for ln in s.splitlines())


# =============================================================================================
# The only permitted mutation: a uniform ../../ prefix on root-relative link targets.
#
# The domain predicate IS the contract. `](` alone is not it: on the corpus the design cites, of
# 23 link targets in the 2026-08-01 shard exactly ONE is a genuine candidate and 14 are absolute
# URLs the bare key would have rewritten into `](../../https://…)`.
# =============================================================================================

_LINK = re.compile(r"\]\(([^)\s]*)\)")
_SCHEME = re.compile(r"^[A-Za-z][A-Za-z0-9+.\-]*:")


def _in_domain(target):
    if not target:
        return False
    if _SCHEME.match(target):          # absolute URL / mailto:
        return False
    if target.startswith("#"):         # in-page anchor
        return False
    if target.startswith("/"):         # absolute path
        return False
    if target.startswith("../"):       # already relative — prefixing it is not invertible
        return False
    return True


def _map_links(text, fn):
    """Apply fn to every in-domain link target outside fenced blocks and inline code spans."""
    lines = text.splitlines(keepends=True)
    out = []
    for i, s, inside, info in fence_scan(lines):
        raw = lines[i]
        if inside or _FENCE.match(s):
            out.append(raw)
            continue
        spans = code_span_ranges(raw)

        def repl(m):
            if any(a <= m.start() < b for a, b in spans):
                return m.group(0)
            new = fn(m.group(1))
            return m.group(0) if new is None else "](%s)" % new

        out.append(_LINK.sub(repl, raw))
    return "".join(out)


def transform_record(text):
    return _map_links(text, lambda t: REBASE_PREFIX + t if _in_domain(t) else None)


def invert_record(text):
    def back(t):
        if not t.startswith(REBASE_PREFIX):
            return None
        stripped = t[len(REBASE_PREFIX):]
        return stripped if _in_domain(stripped) else None
    return _map_links(text, back)


def check_invertible(records, result):
    """Apply the transform then its inverse and assert the round-trip is the identity.

    "Uniform because uniform is invertible and therefore provable" — operationally, this. A record
    that already carries a `../`-prefixed target cannot survive the round-trip, so it is rejected
    rather than silently mangled.
    """
    bad = []
    for idx, rec in enumerate(records):
        if invert_record(transform_record(rec)) != rec:
            bad.append(idx)
    if bad:
        result.add(
            "TRANSFORM_NOT_INVERTIBLE",
            "the ../../ rebase does not round-trip to the identity on record(s) %s — refusing. A "
            "record carrying an already-relative ('../') link target cannot be rebased provably."
            % ", ".join(str(b) for b in bad),
            exit_code=2,
        )
        return False
    return True


# =============================================================================================
# The three assertions. Pure functions over the in-memory partition, so a test can drive each
# one RED with a corrupted triple and watch it fail before any green is trusted.
# =============================================================================================

def assert_L1(before_records, retained_records, shard_records, result):
    """records(live_after) ++ invert(transform(records(shard))) == records(live_before).

    Scoped to the RECORDS zone. The unscoped whole-file form is unsatisfiable on any run that
    regenerates the pointer, and does not hold on the real event either (design §4.2).

    NOTE — THE OPERAND ORDER IS THE REVERSE OF THE DESIGN'S §4.2 FORMULA, AND THE DESIGN IS WRONG.
    §4.2 writes `invert(transform(records(shard))) ++ records(live_after)`, which holds only for an
    OLDEST-on-top ledger. Both ledgers here are NEWEST-on-top — the shard takes the oldest records,
    from the BOTTOM — so the retained (newer) records precede the archived (older) ones. The
    design's order fails on the very first real run, at char 26 of a reconstruction with the correct
    total length: not loss, just the two halves swapped. Found by implementing it; recorded in the
    S37 close-out rather than silently corrected.
    """
    reconstructed = "".join(retained_records) + "".join(invert_record(r) for r in shard_records)
    original = "".join(before_records)
    if reconstructed != original:
        i = _first_diff(reconstructed, original)
        result.add(
            "L1_MISMATCH",
            "records-zone concatenation is not byte-identical to the pre-trim records zone: first "
            "difference at char %d (reconstructed %d B, original %d B)."
            % (i, len(reconstructed.encode("utf-8")), len(original.encode("utf-8"))),
            exit_code=2,
        )
        return False
    return True


def assert_L2(before_zones, after_front, after_footer, shard_text, declared_inserts, reversals,
              result):
    """Zone pinning — every FOOTER byte stays live and is absent from the shard; the FRONT MATTER
    diff is confined to the declared regenerated fields and the pointer block.

    This is the assertion whose absence cost a paragraph.
    """
    ok = True
    footer = before_zones.footer

    if footer.strip():
        if after_footer != footer:
            result.add(
                "L2_FOOTER_ALTERED",
                "the FOOTER zone (%d B) is not byte-identical in the live file after the trim. The "
                "footer is file-scoped, not a record; it is pinned to live, always."
                % len(footer.encode("utf-8")),
                exit_code=2,
            )
            ok = False
        # Compare against the INVERTED shard. A footer swept into the records zone travels through
        # the ../../ rebase on its way in, so its link targets are rewritten and a verbatim
        # substring test misses it — including on the real 020ba3f footer, whose one link is
        # exactly the kind the transform rewrites.
        if footer.strip() and (footer.strip() in shard_text
                               or footer.strip() in invert_record(shard_text)):
            result.add(
                "L2_FOOTER_MOVED",
                "the FOOTER zone appears in the shard. In a newest-on-top file the footer sits "
                "exactly where an oldest-first cut takes from, so it migrates BY POSITION unless "
                "something pins it — this is the `020ba3f` loss, caught.",
                exit_code=2,
            )
            ok = False

    # The front-matter diff must be CONFINED to the declared changes — itself an assertion, not a
    # carve-out. Proved by REVERSING each declared change and requiring the original bytes back:
    # remove the pointer block, then put every regenerated field's old value back. Anything else
    # that moved survives the reversal and shows up as a mismatch.
    #
    # The exception is load-bearing and was first written as a contradiction — the zone model says
    # front matter is rewritten (counts and pointers change every run), while a flat "byte-identical"
    # L2 forbids exactly that. Naming the regenerated fields is what makes both true at once, and it
    # converts the rewrite from an unconstrained edit into a bounded one.
    residue = after_front
    for n, block in enumerate(declared_inserts):
        if not block:
            continue          # an optional declared insertion this run did not make
        if block in residue:
            residue = residue.replace(block, "", 1)
        elif n == 0:
            result.add("L2_POINTER_MISSING",
                       "the shard pointer block is not present verbatim in the rewritten front "
                       "matter; a severed record set with no pointer to its shard is the failure "
                       "mode that ruled out truncate-and-let-git-be-the-archive.", exit_code=2)
            ok = False
        else:
            result.add("L2_DECLARED_INSERT_MISSING",
                       "a declared front-matter insertion is not present verbatim: %r" % block[:60],
                       exit_code=2)
            ok = False
    for rx, old, new in reversals:
        m = rx.search(residue)
        if m and m.group(2) == new:
            residue = residue[:m.start()] + m.group(1) + old + m.group(3) + residue[m.end():]
    if residue != before_zones.front:
        i = _first_diff(residue, before_zones.front)
        result.add(
            "L2_FRONTMATTER_UNDECLARED",
            "the FRONT MATTER changed outside the declared regenerated fields and the pointer "
            "block: reversing every declared change does not restore the original bytes (first "
            "residual difference at char %d). Front matter may be rewritten only where the config "
            "says it may be." % i,
            exit_code=2,
        )
        ok = False
    return ok


def assert_L3(before_records, retained_records, shard_source_records, result):
    """Record partition by identity, ORDER and byte-equality of each record.

    Not hypothetical: the first manual archive moved 19 receipts and rewrote the RETAINED S22
    receipt in the same commit (1,791 -> 1,799 chars). The correction was right; bundling it into
    the move made "the move was verbatim" unfalsifiable. A run is a pure partition, or it aborts.
    """
    rebuilt = list(retained_records) + list(shard_source_records)
    if len(rebuilt) != len(before_records):
        result.add(
            "L3_RECORD_COUNT",
            "record partition is not a partition: %d before, %d after (retained %d + archived %d)."
            % (len(before_records), len(rebuilt), len(retained_records), len(shard_source_records)),
            exit_code=2,
        )
        return False
    altered = [i for i, (a, b) in enumerate(zip(before_records, rebuilt)) if a != b]
    if altered:
        i = altered[0]
        result.add(
            "L3_RECORD_ALTERED",
            "record %d is not byte-identical across the move (%d B before, %d B after). A trim is a "
            "pure move; an edit co-mingled with it makes losslessness unfalsifiable. Altered "
            "record(s): %s" % (i, len(before_records[i].encode("utf-8")),
                               len(rebuilt[i].encode("utf-8")),
                               ", ".join(str(x) for x in altered)),
            exit_code=2,
        )
        return False
    return True


def _first_diff(a, b):
    n = min(len(a), len(b))
    for i in range(n):
        if a[i] != b[i]:
            return i
    return n


# =============================================================================================
# git helpers
# =============================================================================================

def git(repo, *args):
    try:
        p = subprocess.run(["git", "-C", str(repo)] + list(args),
                           capture_output=True, text=True, check=False)
    except OSError:
        return None
    return p.stdout.rstrip("\n") if p.returncode == 0 else None


def git_bytes(repo, *args):
    try:
        p = subprocess.run(["git", "-C", str(repo)] + list(args),
                           capture_output=True, check=False)
    except OSError:
        return None
    return p.stdout if p.returncode == 0 else None


def repo_root(path):
    r = git(path.parent if path.is_file() else path, "rev-parse", "--show-toplevel")
    return Path(r) if r else None


def size_at(repo, sha, relpath):
    b = git_bytes(repo, "show", "%s:%s" % (sha, relpath))
    return None if b is None else len(b)


def lines_at(repo, sha, relpath):
    b = git_bytes(repo, "show", "%s:%s" % (sha, relpath))
    return None if b is None else b.decode("utf-8", "replace").count("\n")


# =============================================================================================
# The trigger — two metrics, because there are two distinct failure modes.
#
#   Lines protect against SILENT TRUNCATION (a Read past the cap returns no error and no marker).
#   Bytes protect against CONTEXT TAX (G1, the operator's stated goal).
#
# The two take different FORMS and transplanting one onto the other does not work: "cut until back
# above 30" is unreachable on the byte metric at EVERY budget, even trimming to a single record.
# =============================================================================================

class Trigger:
    def __init__(self):
        self.line_headroom = None
        self.line_abstains = None      # reason string when the rate cannot be computed
        self.size_bytes = 0
        self.budget = DEFAULT_BUDGET_BYTES
        self.srf = None                # (value, boundary_sha) for the most recent archive
        self.srf_largest = None        # (value, boundary_sha) for H3's own largest-drop boundary
        self.srf_abstains = None

    @property
    def line_fires(self):
        return self.line_headroom is not None and self.line_headroom < LINE_FIRE_BELOW

    @property
    def byte_fires(self):
        return self.size_bytes > self.budget

    @property
    def fires(self):
        return self.line_fires or self.byte_fires

    def stops(self, size_bytes, line_count, de, dl):
        """Both stop conditions must hold. Fire if EITHER fires; stop only when BOTH stop."""
        byte_ok = size_bytes <= int(self.budget * BYTE_STOP_FRACTION)
        if de and dl and de > 0 and dl > 0:
            headroom = (READ_CAP_LINES - line_count) * de // dl
            line_ok = headroom > LINE_STOP_ABOVE
        else:
            line_ok = True         # the rate abstains; it cannot veto a stop it cannot compute
        return byte_ok and line_ok


def archive_events(repo, spec):
    """[(sha, pre_size, post_size, relpath)] for every shard of this ledger, oldest first.

    Derived by GLOB over docs/archive/, never from hardcoded literal paths: `bin/tests.sh` wires
    exactly one shard by literal path in two places, so a second shard would never be checked and
    the suite would still pass (design §8.2).
    """
    adir = repo / ARCHIVE_DIR
    if not adir.is_dir():
        return []
    stem = spec.basename[:-3] if spec.basename.endswith(".md") else spec.basename
    events = []
    for shard in sorted(adir.glob("%s-*.md" % stem)):
        rel = shard.relative_to(repo).as_posix()
        sha = git(repo, "log", "--diff-filter=A", "-1", "--format=%H", "--", rel)
        if not sha:
            continue
        pre = size_at(repo, sha + "^", spec.basename)
        post = size_at(repo, sha, spec.basename)
        if pre is None or post is None or pre <= post:
            continue
        events.append((sha, pre, post, rel))
    # Order by position in the commit graph, NEWEST first, then reverse — never by %ct. Two
    # archives committed in the same second are ordinary (a script, a test), and a timestamp tie
    # falls back to sha order, which is arbitrary: "the most recent archive" would then be a coin
    # flip, and the SRF refusal is decided by exactly that choice.
    #
    # MUTATION NOTE, recorded rather than papered over: replacing this with a plain `events.sort()`
    # (i.e. sha order) SURVIVES the test suite. It is not an equivalent mutant — sha order is wrong
    # in general — but for a two-event fixture sha order coincides with graph order about half the
    # time, and commit shas vary run to run, so no functional test can kill it deterministically.
    # Claiming it as covered would be the inflated-mutation-score failure this repo already names.
    walk = git(repo, "rev-list", "--topo-order", "HEAD") or ""
    rank = {sha: i for i, sha in enumerate(walk.split())}
    events.sort(key=lambda e: -rank.get(e[0], 1 << 30))
    return events


def evaluate_trigger(repo, path, spec, zones, budget, result):
    t = Trigger()
    t.budget = budget
    text = read_text(path)
    t.size_bytes = len(text.encode("utf-8"))
    line_count = text.count("\n")
    rel = path.relative_to(repo).as_posix()

    events = archive_events(repo, spec)

    # --- the line rate, re-derived from the file every read, abstaining out loud ---------------
    de = dl = None
    if not events:
        t.line_abstains = "no prior archive of this ledger — the rate has no baseline"
    else:
        split = events[-1][0]
        base_lines = lines_at(repo, split, rel)
        base_text = git_bytes(repo, "show", "%s:%s" % (split, rel))
        if base_lines is None or base_text is None:
            t.line_abstains = "the baseline blob %s:%s is unreadable" % (split[:7], rel)
        else:
            base_zones = classify_zones(base_text.decode("utf-8"), spec, Result(path))
            # classify_zones returns None on a REFUSAL — that is not a count of zero. Treating it
            # as zero makes `de` the whole current record count and prints a confidently inflated
            # headroom for a baseline the tool would itself refuse to read.
            if base_zones is None:
                t.line_abstains = ("the baseline blob %s:%s does not classify under this ledger's "
                                   "declared grammar — abstaining rather than assuming it held zero "
                                   "records" % (split[:7], rel))
                base_records = None
            else:
                base_records = len(base_zones.starts)
            dl = line_count - base_lines
            de = None if base_records is None else len(zones.starts) - base_records
            if de is not None and de > 0 and dl > 0:
                t.line_headroom = (READ_CAP_LINES - line_count) * de // dl
            elif de is None:
                pass                                   # already abstaining, with a stated reason
            else:
                t.line_abstains = ("fewer than one record written since the last split "
                                   "(%s records, %s lines)" % (de, dl))

    # --- SRF: reported for BOTH boundaries, because they differ by 3x on the same file ---------
    if not events:
        t.srf_abstains = ("no prior archive — SRF is undefined before a ledger's first archive "
                          "(H3's own stated limit). Abstaining rather than computing a zero.")
    else:
        def srf(pre, post):
            return None if pre == post else (t.size_bytes - post) / float(pre - post)
        recent = events[-1]
        t.srf = (srf(recent[1], recent[2]), recent[0])
        largest = max(events, key=lambda e: e[1] - e[2])
        t.srf_largest = (srf(largest[1], largest[2]), largest[0])

    result.plan_trigger = t
    return t, de, dl


# =============================================================================================
# The plan
# =============================================================================================

class TrimPlan:
    def __init__(self):
        self.retained = []
        self.archived = []
        self.shard_rel = None
        self.verify_rel = None
        self.cut_key = None
        self.span = None
        self.before_bytes = 0
        self.after_bytes = 0
        self.live_after = None
        self.shard_text = None
        self.verify_text = None
        self.ledger_entry = None
        self.pointer_block = None


def choose_cut(zones, spec, trigger, de, dl, explicit, spec_date, result):
    """Pick how many records to retain. Cuts are by POSITION in file order, never by sorting on a
    parsed key: this ledger interleaves two independent S<N> sequences that collide, and a calendar
    day straddles the existing cut (design §2.3)."""
    records = zones.records()
    n = len(records)
    front_b = len(zones.front.encode("utf-8"))
    foot_b = len(zones.footer.encode("utf-8"))
    front_l = zones.front.count("\n")
    foot_l = zones.footer.count("\n")

    def resulting(k):
        keep = records[:k]
        b = front_b + foot_b + sum(len(r.encode("utf-8")) for r in keep)
        l = front_l + foot_l + sum(r.count("\n") for r in keep)
        return b, l

    if explicit is not None:
        k = _explicit_retain(records, spec, explicit, spec_date, result)
        if k is None:
            return None
        return k

    for k in range(n - 1, 0, -1):
        b, l = resulting(k)
        if trigger.stops(b, l, de, dl):
            return k
    return 1


def _explicit_retain(records, spec, explicit, repo, result):
    if explicit.isdigit():
        k = int(explicit)
        if not (0 < k < len(records)):
            result.add("CUT_OUT_OF_RANGE",
                       "--cut %s must retain between 1 and %d records" % (explicit, len(records) - 1),
                       exit_code=3)
            return None
        return k
    date = explicit
    if explicit.startswith("@"):
        iso = git(repo, "log", "-1", "--format=%cs", explicit[1:])
        if not iso:
            result.add("CUT_UNKNOWN_REF", "--cut %s: no such git ref" % explicit, exit_code=3)
            return None
        date = iso
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
        result.add("CUT_BAD_KEY", "--cut %s is neither a count, a YYYY-MM-DD date, nor @<ref>"
                   % explicit, exit_code=3)
        return None
    # Archive every record dated <= date; records are newest-on-top, so retain the prefix.
    k = 0
    for rec in records:
        d = spec.date_of_record(rec)
        if d is not None and d <= date:
            break
        k += 1
    if k == 0 or k >= len(records):
        result.add("CUT_OUT_OF_RANGE",
                   "--cut %s selects %d retained records of %d — refusing" % (explicit, k, len(records)),
                   exit_code=3)
        return None
    return k


# =============================================================================================
# What the trimmer writes
# =============================================================================================

def assemble_live(front, retained, footer):
    """Rebuild the live file from its three zones.

    A named step rather than an inline concatenation, so a test can replace it and prove that L2
    is wired to the ARTIFACT: with `assert_L2` handed the before-footer as its after-footer (the
    defect this file shipped once), a footer-dropping assembly is written with [L2_OK].
    """
    return front + "".join(retained) + footer


def build_pointer_block(spec, shard_rel, verify_rel, count, span, live_rel):
    first, last = span
    return (
        "**Archived %d record(s), %s → %s** into [`%s`](%s) — same format, same order, frozen.\n"
        "Losslessness is proved by [`%s`](%s), which re-derives L1/L2/L3 from git; run it rather\n"
        "than trusting this sentence. Written by `methodology_trim.py` v%s.\n\n"
        % (count, first, last, shard_rel, shard_rel, verify_rel, verify_rel, TRIM_VERSION)
    )


def insert_pointer(front, block):
    """Insert the pointer block immediately before the LAST standalone '---' in front matter, or
    at the end of front matter when there is none. Deterministic and declared, so L2 can confine
    the front-matter diff to exactly this span."""
    lines = front.splitlines(keepends=True)
    hr = None
    for i, s, inside, _info in fence_scan(lines):
        if not inside and s.strip() == "---":
            hr = i
    if hr is None:
        return front + ("\n" if front and not front.endswith("\n\n") else "") + block
    return "".join(lines[:hr]) + block + "".join(lines[hr:])


def apply_regenerated(front, spec, ctx, result):
    """Regenerate declared front-matter fields. Each is COMPUTED, never carried forward, because
    every one of them has already drifted by hand (HANDOFFS.md's own count said 19 while the file
    held 20, and the file's own blockquote admits the number is unguarded).

    Returns (new_front, reversals) where reversals is [(regex, old_value, new_value)] — L2 replays
    it backwards to prove the front-matter diff is confined to exactly these spans.
    """
    out = front
    reversals = []
    for name, rx, fn in spec.regenerated:
        new = fn(ctx)
        m = rx.search(out)
        if not m:
            result.add("FRONTMATTER_FIELD_ABSENT",
                       "declared regenerated field %r not found in front matter — its value cannot "
                       "be kept true. Add it, or remove it from the config." % name)
            continue
        old = m.group(2)
        if old != new:
            result.add("FRONTMATTER_FIELD_REGENERATED", "%s: %s → %s" % (name, old, new))
        out = out[:m.start()] + m.group(1) + new + m.group(3) + out[m.end():]
        reversals.append((rx, old, new))
    return out, reversals


def build_shard(spec, live_rel, shard_rel, records, span, cut_key):
    first, last = span
    body = "".join(transform_record(r) for r in records)
    back = REBASE_PREFIX + live_rel
    head = (
        "# %s — archive: %s → %s\n"
        "\n"
        "Retired records from [`%s`](%s), moved here so the live ledger stays small enough to read\n"
        "in one pass. Same format, same newest-on-top order — this is the same ledger, continued.\n"
        "\n"
        "Holds **%d record(s), %s → %s**. Cut key: `%s`. Counts here are computed from the file\n"
        "itself, never carried forward. This shard is frozen: it states no forward-looking rule,\n"
        "because the live file owns those and a copy of one was wrong a day after it was written.\n"
        "\n"
        "---\n"
        "\n"
        % (spec.basename, first, last, live_rel, back, len(records), first, last, cut_key)
    )
    return head + body


LEDGER_ENTRY_TEMPLATE = (
    "### %(date)s · [ad hoc] Ledger trim: `%(live)s` → `%(shard)s` "
    "(%(n)d record(s), %(before)s B → %(after)s B)\n"
    "\n"
    "**Written by:** `methodology_trim.py` v%(ver)s — a tool action, not a session's judgment.\n"
    "Moved the oldest **%(n)d** record(s) (%(first)s → %(last)s) out of [`%(live)s`](%(live)s) into\n"
    "[`%(shard)s`](%(shard)s). Losslessness is asserted by L1 (records-zone concatenation), L2 (zone\n"
    "pinning) and L3 (record partition), and is **re-derivable** — run [`%(verify)s`](%(verify)s)\n"
    "rather than trusting a digest printed here. Live file %(before)s B → %(after)s B (%(pct)s).\n"
    "\n"
)


def build_ledger_entry(live_rel, shard_rel, verify_rel, n, span, before_b, after_b, today):
    first, last = span
    pct = "−%.1f%%" % (100.0 * (before_b - after_b) / before_b) if before_b else "n/a"
    return LEDGER_ENTRY_TEMPLATE % {
        "date": today, "live": live_rel, "shard": shard_rel, "verify": verify_rel,
        "n": n, "first": first, "last": last, "ver": TRIM_VERSION,
        "before": "{:,}".format(before_b), "after": "{:,}".format(after_b), "pct": pct,
    }


def insert_ledger_entry(ledger_text, spec, entry, today, result):
    """Prepend the entry at the top of the records zone, under a `## YYYY-MM` heading matching its
    month — creating the heading when the month has turned.

    Returns (text, month_heading_added). The heading, when added, lands in the FRONT MATTER zone
    (it sits above the first record), so it is a declared front-matter insertion and L2 is told
    about it rather than tripping over it.

    A month boundary is reported, not silently smoothed over: the previous month's heading is left
    above the new one, where it heads nothing. The tool never commits, so this is one line for the
    operator to move — which is strictly better than silently re-filing the retained records of the
    old month under the new month's heading, which is what the first draft did.
    """
    z = classify_zones(ledger_text, spec, result)
    if z is None:
        return None, ""
    month = today[:7]
    front = "".join(z.lines[:z.front_end])
    rest = ledger_text[len(front):]
    heading = ""
    if not re.search(r"^## %s\s*$" % re.escape(month), front, re.M):
        heading = "## %s\n\n" % month
        entry = heading + entry
    return front + entry + rest, heading


# =============================================================================================
# The re-runnable proof. A digest without its payload definition and its command is an assertion
# wearing a hash's clothes — the last hand-published one is not reproducible from the artifacts.
# =============================================================================================

VERIFY_TEMPLATE = r"""#!/usr/bin/env bash
# Losslessness proof for @@SHARD@@ — generated by methodology_trim.py v@@VER@@.
#
# Self-contained and FROZEN: it embeds the record grammar it was written against, so a later change
# to the trimmer cannot silently change what this shard's proof means. Re-derives L1 (records-zone
# concatenation), L2 (zone pinning) and L3 (record partition). Exits non-zero on failure.
# Run it; do not trust a digest. The last hand-published digest for this repo is not reproducible
# from the artifacts it describes, which is the whole reason this file exists.
#
# NOTE: file contents are read by python, never through $(...) — command substitution strips
# trailing newlines, which silently truncates the LAST record and fails L1/L3 on a correct trim.
# That is not hypothetical: it is what the first version of this script did.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 3
LIVE=@@LIVE@@
SHARD=@@SHARD@@
INJECTED=@@INJECTED@@
TRIM_SHA="$(git log --diff-filter=A -1 --format=%H -- "$SHARD" 2>/dev/null)"
export LIVE SHARD INJECTED TRIM_SHA
python3 - <<'PYEOF_VERIFY'
import os, re, subprocess, sys

RECORD_KIND = "@@KIND@@"
RECORD_START = r"@@START@@"
FENCE_INFO = "@@INFO@@"
FOOTER_MODE = "@@FOOTER@@"
PREFIX = "../../"

FENCE = re.compile(r"^(`{3,}|~{3,})(.*)$")
LINK = re.compile(r"\]\(([^)\s]*)\)")
SCHEME = re.compile(r"^[A-Za-z][A-Za-z0-9+.\-]*:")


def scan(lines):
    marker = None
    for i, raw in enumerate(lines):
        s = raw.rstrip("\r\n")
        inside = marker is not None
        m = FENCE.match(s)
        info = ""
        if marker is None:
            if m:
                marker = (m.group(1)[0], len(m.group(1)))
                info = m.group(2).strip()
        else:
            ch, n = marker
            if m and m.group(1)[0] == ch and len(m.group(1)) >= n and m.group(2).strip() == "":
                marker = None
        yield i, s, inside, info


def spans(line):
    r = []
    i = 0
    n = len(line)
    while i < n:
        if line[i] == "`":
            j = i
            while j < n and line[j] == "`":
                j += 1
            t = j - i
            k = j
            while k < n:
                if line[k] == "`":
                    mm = k
                    while mm < n and line[mm] == "`":
                        mm += 1
                    if mm - k == t:
                        r.append((i, mm))
                        i = mm
                        break
                    k = mm
                else:
                    k += 1
            else:
                break
            continue
        i += 1
    return r


def indomain(t):
    return bool(t) and not SCHEME.match(t) and not t.startswith(("#", "/", "../"))


def maplinks(text, fn):
    lines = text.splitlines(keepends=True)
    out = []
    for i, s, inside, _info in scan(lines):
        raw = lines[i]
        if inside or FENCE.match(s):
            out.append(raw)
            continue
        sp = spans(raw)

        def repl(m):
            if any(a <= m.start() < b for a, b in sp):
                return m.group(0)
            new = fn(m.group(1))
            return m.group(0) if new is None else "](" + new + ")"

        out.append(LINK.sub(repl, raw))
    return "".join(out)


def invert(text):
    def back(t):
        if not t.startswith(PREFIX):
            return None
        s = t[len(PREFIX):]
        return s if indomain(s) else None
    return maplinks(text, back)


def zones(text):
    lines = text.splitlines(keepends=True)
    starts, hrs = [], []
    for i, s, inside, info in scan(lines):
        if inside:
            continue
        if RECORD_KIND == "heading" and re.match(RECORD_START, s):
            starts.append(i)
        elif RECORD_KIND == "fence" and info == FENCE_INFO:
            starts.append(i)
        if s.strip() == "---":
            hrs.append(i)
    if not starts:
        return "".join(lines), [], ""
    foot = len(lines)
    if FOOTER_MODE == "separator":
        for i in [h for h in hrs if h > starts[-1]]:
            if "".join(lines[i + 1:]).strip():
                foot = i
                break
    recs = []
    for k, st in enumerate(starts):
        en = starts[k + 1] if k + 1 < len(starts) else foot
        recs.append("".join(lines[st:en]))
    return "".join(lines[:starts[0]]), recs, "".join(lines[foot:])


def show(ref, path):
    p = subprocess.run(["git", "show", "%s:%s" % (ref, path)], stdout=subprocess.PIPE)
    if p.returncode:
        sys.exit("verify: cannot read %s:%s" % (ref, path))
    return p.stdout.decode("utf-8")


def readf(path):
    with open(path, "r", encoding="utf-8", newline="") as fh:
        return fh.read()


LIVE, SHARD = os.environ["LIVE"], os.environ["SHARD"]
TRIM, INJ = os.environ["TRIM_SHA"], int(os.environ["INJECTED"])
if TRIM:
    before, after, shard = show(TRIM + "^", LIVE), show(TRIM, LIVE), show(TRIM, SHARD)
    origin = "the trim commit " + TRIM[:7]
else:
    before, after, shard = show("HEAD", LIVE), readf(LIVE), readf(SHARD)
    origin = "HEAD vs the working tree (trim not yet committed)"

bfront, br, bfoot = zones(before)
afront, ar, afoot = zones(after)
sfront, sr, _sfoot = zones(shard)
ar_cmp = ar[INJ:]
fails = []
ran = []

# --- L1: records-zone concatenation ---------------------------------------------------------
ran.append("L1")
if "".join(ar_cmp) + "".join(invert(r) for r in sr) != "".join(br):
    fails.append("L1 records-zone concatenation is not byte-identical")

# --- L2: zone pinning. BOTH halves — footer AND front matter. -------------------------------
# The footer half is conditional (a ledger may legitimately have no footer); the front-matter
# half is not, and its absence is why an earlier version of this script printed "L1, L2 and L3
# hold" after running zero L2 assertions on both of this repo's real ledgers.
if bfoot.strip():
    ran.append("L2/footer")
    if afoot != bfoot:
        fails.append("L2 FOOTER is not byte-identical in the live file")
    if bfoot.strip() in shard or bfoot.strip() in invert(shard):
        fails.append("L2 FOOTER migrated into the shard")

ran.append("L2/front-matter")
# Front matter may GAIN declared blocks (the shard pointer, a new month heading); it may not lose
# or reword anything. Every non-blank line of the original must survive verbatim in the new front
# matter, and none of it may have travelled into the shard.
missing = [ln for ln in bfront.splitlines() if ln.strip() and ln not in afront]
if missing:
    fails.append("L2 FRONT MATTER lost %d line(s), first: %r" % (len(missing), missing[0][:70]))
leaked = [ln for ln in bfront.splitlines()
          if ln.strip() and len(ln.strip()) > 24 and (ln in sfront or ln in "".join(sr))]
if leaked:
    fails.append("L2 FRONT MATTER leaked %d line(s) into the shard, first: %r"
                 % (len(leaked), leaked[0][:70]))

# --- L3: record partition ---------------------------------------------------------------------
ran.append("L3")
rebuilt = list(ar_cmp) + [invert(r) for r in sr]
if len(rebuilt) != len(br):
    fails.append("L3 record count %d != %d" % (len(rebuilt), len(br)))
else:
    bad = [i for i, (x, y) in enumerate(zip(br, rebuilt)) if x != y]
    if bad:
        fails.append("L3 record(s) not byte-identical across the move: %s" % bad)

print("source : %s" % origin)
print("records: %d before = %d retained + %d archived (%d entry injected by the trim)"
      % (len(br), len(ar_cmp), len(sr), INJ))
print("checked: %s" % ", ".join(ran))
for f in fails:
    print("FAIL:", f)
if fails:
    sys.exit(1)
# State what actually ran, never a blanket claim: on a ledger with no footer the footer clause is
# genuinely inapplicable, and saying "L2 holds" would be asserting something nothing tested.
print("OK: %s hold for %s" % (", ".join(ran), SHARD))
PYEOF_VERIFY
"""


def build_verify(spec, live_rel, shard_rel, injected):
    out = VERIFY_TEMPLATE
    for key, val in (("@@SHARD@@", shard_rel), ("@@LIVE@@", live_rel), ("@@VER@@", TRIM_VERSION),
                     ("@@INJECTED@@", str(injected)), ("@@KIND@@", spec.record_kind),
                     ("@@START@@", spec.record_start.pattern if spec.record_start else ""),
                     ("@@INFO@@", spec.fence_info or ""), ("@@FOOTER@@", spec.footer_mode)):
        out = out.replace(key, val)
    return out


# =============================================================================================
# Atomic writes. A crash must never leave a record in neither file.
# =============================================================================================

def read_text(path):
    """Read verbatim: newline='' keeps CRLF intact, so byte-equality assertions mean what they say.

    Not Path.read_text(newline=...) — that keyword is Python 3.13+, and this file is stdlib-only
    and cross-platform by contract.
    """
    with open(str(path), "r", encoding="utf-8", newline="") as fh:
        return fh.read()


def atomic_write(path, text, executable=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".mtrim-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as fh:
            fh.write(text)
            fh.flush()
            os.fsync(fh.fileno())
        if executable:
            os.chmod(tmp, 0o755)
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


# =============================================================================================
# P1 / P1a — the frontier-poisoning countermeasures.
#
# Phase 0 reconcile computes frontier = git log -1 -- CHANGELOG.md and treats frontier..HEAD as
# the undocumented set. A trim commit rewrites CHANGELOG.md, so it advances that frontier past any
# commit that was never recorded — permanently hiding it. Reproduced end to end (design §8.1).
# =============================================================================================

def check_P1(repo, ledger_rel, result):
    frontier = git(repo, "log", "-1", "--format=%H", "--", ledger_rel)
    if not frontier:
        result.add("P1_NO_LEDGER",
                   "no commit has ever recorded %s — self-provision and reconcile before trimming"
                   % ledger_rel, exit_code=2)
        return False
    count = git(repo, "rev-list", "--count", "--no-merges", "%s..HEAD" % frontier)
    n = int(count) if count and count.isdigit() else 0
    if n:
        listing = git(repo, "log", "--no-merges", "--oneline", "%s..HEAD" % frontier) or ""
        result.add(
            "P1_UNDOCUMENTED",
            "the undocumented set is non-empty (%d commit(s) since the ledger frontier %s). A trim "
            "commit advances that frontier and would hide them PERMANENTLY. Reconcile first, then "
            "trim.\n%s" % (n, frontier[:7], _indent(listing)),
            exit_code=2,
        )
        return False
    return True


def check_P1a(ledger_path, spec_for_ledger, expected_after_partition, result):
    """Post-condition: the ledger gained exactly one record, and that record is this trim.

    P1 runs BEFORE the trim commit exists, so it constrains only the commits before it. The FM #27
    hook does not close the remainder: it passes on mere CO-STAGING of the ledger and never checks
    that an entry was ADDED — and a ledger trim co-stages it by construction.

    `expected_after_partition` is the count the ledger would hold if this run wrote NO entry — which
    is len(retained) when the trimmed file IS the ledger, and the ledger's own pre-run count when it
    is not. Getting that wrong is not academic: the first draft of this function compared against the
    ledger's pre-trim count in both cases, and this assertion caught it on the first real write.
    """
    text = read_text(ledger_path)
    z = classify_zones(text, spec_for_ledger, Result(ledger_path))
    after = len(z.starts) if z else -1
    want = expected_after_partition + 1
    if after != want:
        result.add(
            "P1A_LEDGER_ENTRY",
            "post-condition failed: the ledger holds %d record(s), expected %d (one more than the "
            "%d it would hold after the partition alone). Without that entry the trim's very first "
            "act would be to hide itself." % (after, want, expected_after_partition),
            exit_code=2,
        )
        return False
    result.add("P1A_OK", "ledger gained exactly one entry (%d → %d)"
               % (expected_after_partition, after))
    return True


# =============================================================================================
# Zero records — "I found nothing" and "I could not read this" are different answers.
#
# This branch used to give one answer to both, at exit 0, in the words reserved for a fresh seed:
# a 597,717 B ledger holding 130 dated entries and a 1,239,085 B one keying its entries on table
# rows under 8 `## YYYY-MM` group headings were both
# told they held "zero records ... nothing to archive. (A freshly seeded ledger looks exactly like
# this ...)" — byte-identical to what a genuine 324 B seed is told, and with the same exit status,
# so a wrapper reading the code was told everything was fine. Neither file uses the declared
# `### YYYY-MM-DD · [tag]` heading; one uses an em dash, the other keys entries on table rows.
# That is UAT finding F1, and the failure shape is the worst available for a tool whose entire
# justification is that manual trimming does not happen.
#
# Design §6.3's exit table already said `3 | usage error: ... no records`, and this branch shipped
# with no exit code at all. Restoring 3 for the unreadable half is a return to the ratified table.
# KEEPING 0 FOR THE GENUINELY-EMPTY HALF IS ADDED POLICY, labelled here as such: a day-one adopter
# running --check from a hook must not be handed a usage error for a correctly-seeded file, and the
# design's own edge-case list ("zero archivable records → 0 with a stated reason") shows the family
# it belongs to. ZONE_UNCLASSIFIED is the model the refusal copies — refuse, name the evidence,
# print the offending span, and do not guess.
# =============================================================================================

def classify_empty(path, text, spec, result):
    """Decide whether a zero-record file is a fresh seed or a grammar we cannot read."""
    lines = text.splitlines()
    size_bytes = len(text.encode("utf-8"))       # same source and unit as Trigger.size_bytes
    line_count = text.count("\n")                # same unit as evaluate_trigger's line_count
    hits, negations = [], 0
    for i, s, inside, _info in fence_scan(lines):
        if inside:
            continue                             # a fenced example is documentation, not a record
        if spec.content_probe is not None and spec.content_probe.search(s):
            hits.append((i + 1, s))
        if spec.seed_negation is not None and spec.seed_negation.match(s):
            negations += 1

    # `negations` is EVIDENCE, not bookkeeping. The seed's negation test is the seed's own answer to
    # "has anything been recorded below?", so a file that answers yes and still parses to zero
    # records is a mismatch by definition. The first draft computed that answer and discarded it,
    # which left a receipt ledger of bare `session:` blocks — nothing for the probe to see —
    # reporting NO_RECORDS at exit 0: F1 intact in the file this branch had just been widened to
    # cover.
    evidence = bool(hits) or negations > 0

    # THERE IS DELIBERATELY NO SEED-SENTINEL EXEMPTION HERE, and it was tried.
    # An earlier draft let a ledger still carrying METHODOLOGY-SEED-SENTINEL suppress the probe, on
    # the theory that a seed documenting example dates should not be accused of being broken. It
    # left one shape of F1 uncovered — NOT a regression, and the difference matters to whoever reads
    # this next. A 6,150 B ledger with 120 real table-row entries and the sentinel left in place
    # answered `[NO_RECORDS]` at exit 0, because table rows do not match the `^###` negation, so the
    # seal held while 121 probe hits were thrown away. That case behaved identically BEFORE any of
    # this existed; it was never correct, so nothing was re-broken. The defect was a guard whose
    # negation test was narrower than the evidence it suppressed — which is a question about which
    # record shapes were enumerated, not about what changed. A seal you can hold open by choosing a
    # record shape is worse than no seal, because F1's lesson is that silence costs the most.
    # The seeds are protected by the probe being ANCHORED instead: both ship with zero hits, which
    # `TestGrammarMismatchFixtureControls` pins, so a seed edit that would flag every adopter fails
    # in OUR suite rather than at their root. That is the right place to catch it. The accepted cost
    # is stated rather than hidden: an adopter who adds a dated `##` heading or a dated table row to
    # their own front matter, while holding no records, gets a loud false refusal. Loud and wrong is
    # recoverable; quiet and wrong is what this whole finding is about.
    if not (size_bytes > SEED_PLAUSIBLE_MAX_BYTES or line_count > READ_CAP_LINES or evidence):
        result.add("NO_RECORDS",
                   "%s holds zero records under its declared grammar — nothing to archive. (A "
                   "freshly seeded ledger looks exactly like this, and must not be trimmed.)"
                   % path.name)
        return result

    where = ""
    if hits:
        n, first = hits[0]
        where = ("\n  First line that looks like a record but is not one, at line %d:\n%s"
                 % (n, _indent(first[:200])))
    result.add(
        "GRAMMAR_MISMATCH",
        "%s holds %s B on %s line(s) and NOT ONE record the declared grammar can read. This is a "
        "file this tool cannot parse, not a file with nothing in it — %s. Refusing rather than "
        "reporting an absence.\n  Declared record start (%s): %s\n  Lines matching the looser "
        "content probe: %d%s%s\n  Fix the config entry for this file, or bring the ledger to the "
        "declared grammar. Do not trim until one of those is true."
        % (spec.basename, "{:,}".format(size_bytes), "{:,}".format(line_count),
           "records are visibly present in another shape" if hits else
           ("the ledger's own freshness test says content has been recorded below"
            if negations else "a freshly seeded ledger is small, and this is not"),
           spec.record_kind,
           spec.record_start.pattern if spec.record_start else "```%s" % spec.fence_info,
           len(hits),
           ("" if spec.seed_negation is None else
            " (and %d line(s) matching this ledger's own freshness test)" % negations),
           where),
        exit_code=3,
    )
    return result


# =============================================================================================
# Driver
# =============================================================================================

def evaluate(path, opts, result):
    spec = LEDGERS.get(path.name)
    if spec is None:
        result.add("NO_CONFIG",
                   "%s has no entry in the config table. There is deliberately no generic fallback: "
                   "a generic rule is what would mis-zone a differently-shaped ledger." % path.name,
                   exit_code=3)
        return result
    if not path.is_file():
        result.add("FILE_ABSENT", "%s does not exist" % path, exit_code=3)
        return result
    path = path.resolve()          # relative_to(repo) below needs both sides absolute
    repo = repo_root(path)
    if repo is None:
        result.add("NOT_A_REPO", "%s is not inside a git work tree" % path, exit_code=3)
        return result

    text = read_text(path)
    zones = classify_zones(text, spec, result)
    if zones is None:
        return result
    if not zones.starts:
        classify_empty(path, text, spec, result)
        return result

    # Validate --cut before anything else consumes it: the key is interpolated straight into the
    # shard PATH, and `--cut @refs/tags/v1.0` is an ordinary git ref that would otherwise write
    # docs/archive/CHANGELOG-through-refs/tags/v1.0.md — nested, and therefore invisible to the
    # single-level glob that both the rate trigger and this tool use to find their own baseline.
    if opts.cut and not opts.cut.isdigit() and not _safe_cut_key(opts.cut.lstrip("@")):
        result.add("CUT_KEY_UNSAFE",
                   "cut key %r would not produce a flat, single-level shard name. §4.5(b) makes "
                   "the flat docs/archive/<BASENAME>-through-<CUTKEY>.md shape mandatory precisely "
                   "because a nested or differently-cased name is silently excluded from the glob, "
                   "and the trigger then computes against the wrong baseline."
                   % opts.cut.lstrip("@"), exit_code=3)
        return result

    budget = opts.budget_bytes or spec.budget_bytes
    trigger, de, dl = evaluate_trigger(repo, path, spec, zones, budget, result)
    result.trigger = trigger

    if trigger.line_abstains:
        result.add("LINE_METRIC_ABSTAINS", trigger.line_abstains)
    else:
        result.add("TRIGGER_LINES",
                   "line headroom %d record(s) (fires below %d)" % (trigger.line_headroom, LINE_FIRE_BELOW))
    result.add("TRIGGER_BYTES", "%s B against a %s B budget" %
               ("{:,}".format(trigger.size_bytes), "{:,}".format(budget)))
    if trigger.srf_abstains:
        result.add("SRF_UNDEFINED", trigger.srf_abstains)
    else:
        v, sha = trigger.srf
        lv, lsha = trigger.srf_largest
        if sha == lsha:
            note = ("both boundaries resolve to the same archive, so there is nothing to choose "
                    "between here")
        elif v <= 0 or lv <= 0:
            # A non-positive SRF means the file is now no larger than it was right after that
            # archive — real information, but a ratio between the two is not meaningful.
            note = ("at least one boundary gives a non-positive SRF (the file has not grown back "
                    "past it at all), so the two are not usefully compared as a ratio")
        else:
            note = ("the two boundaries differ by %.2fx on the same file; the refusal below uses "
                    "the MOST RECENT one, which is a policy addition on top of H3 (H3 says \"the "
                    "largest single size drop\") and is labelled as an addition, not dressed as a "
                    "reading" % (v / lv))
        result.add("SRF", "SRF %.4f vs the most recent archive %s; %.4f vs H3's largest-drop "
                          "boundary %s — %s" % (v, sha[:7], lv, lsha[:7], note))

    if opts.check:
        result.exit = 1 if trigger.fires else 0
        result.add("CHECK", "trigger %s" % ("FIRES" if trigger.fires else "does not fire"))
        return result

    if not trigger.fires and opts.cut is None:
        result.add("NOTHING_TO_DO", "under budget and above the line floor — nothing to do")
        return result

    if not check_P1(repo, ledger_rel_for(repo), result):
        return result

    if trigger.srf and trigger.srf[0] is not None and trigger.srf[0] >= SRF_RED and not opts.force:
        result.add(
            "SRF_RED",
            "SRF %.4f (RED) against %s. The last archive has been entirely given back; archiving "
            "again resets the LEVEL and not the RATE — see plan §3.3, whose action rule for RED is "
            "\"do not archive again\". Re-run with --force to archive anyway."
            % (trigger.srf[0], trigger.srf[1][:7]),
            exit_code=2,
        )
        return result

    records = zones.records()
    k = choose_cut(zones, spec, trigger, de, dl, opts.cut, repo, result)
    if k is None:
        return result
    if k <= 0:
        result.add("WOULD_EMPTY",
                   "trimming to satisfy the trigger would leave zero records, which makes the "
                   "receipt checker hard-fail. Floor is one record.", exit_code=2)
        return result

    retained, archived = records[:k], records[k:]
    if not archived:
        result.add("NOTHING_TO_DO", "the computed cut archives zero records")
        return result

    if not check_invertible(archived, result):
        return result

    dates = [spec.date_of_record(r) for r in archived]
    dates = [d for d in dates if d]
    span = (min(dates), max(dates)) if dates else ("unknown", "unknown")
    cut_key = opts.cut if (opts.cut and not opts.cut.isdigit()) else span[1]
    cut_key = cut_key.lstrip("@")

    # The cut key is interpolated straight into the shard PATH, so it must not be able to carry a
    # separator. `--cut @refs/tags/v1.0` is an ordinary git ref and would otherwise write
    # docs/archive/CHANGELOG-through-refs/tags/v1.0.md — nested, and therefore invisible to the
    # single-level glob that both the rate trigger and this tool use to find their own baseline.
    if not _safe_cut_key(cut_key):
        result.add("CUT_KEY_UNSAFE",
                   "cut key %r would not produce a flat, single-level shard name. §4.5(b) makes the "
                   "flat docs/archive/<BASENAME>-through-<CUTKEY>.md shape mandatory precisely "
                   "because a nested or differently-cased name is silently excluded from the glob, "
                   "and the trigger then computes against the wrong baseline." % cut_key,
                   exit_code=3)
        return result

    # Cuts are POSITIONAL, so a calendar day can straddle one — 2026-07-30 already appears in both
    # the live file and the existing archive. Say so, because "-through-<date>" reads as a boundary
    # claim and in that case it is only a span label.
    retained_dates = {spec.date_of_record(r) for r in retained} - {None}
    if cut_key in retained_dates:
        result.add(
            "CUT_STRADDLES_DAY",
            "the cut key %s also appears among the RETAINED records, so the shard name is a span "
            "label and not a day boundary. The cut is positional by design (§2.3); pass "
            "--cut <earlier date> if you want a clean calendar seam." % cut_key)

    stem = spec.basename[:-3]
    shard_rel = "%s/%s-through-%s.md" % (ARCHIVE_DIR, stem, cut_key)
    shard_path = repo / shard_rel
    verify_rel = shard_rel + ".verify.sh"

    # Write-once. Two runs can resolve to the same cut key, and overwriting would destroy the first
    # shard's records while L1/L2/L3 all still pass — they quantify only over THIS run's triple.
    # The one corruption the three assertions cannot see, so it is excluded by construction.
    if shard_path.exists():
        result.add("SHARD_EXISTS",
                   "%s already exists. Refusing to overwrite: a collision destroys the earlier "
                   "shard's records while all three assertions still pass, because none of them "
                   "quantifies over any other file in %s. Disambiguate with --cut."
                   % (shard_rel, ARCHIVE_DIR), exit_code=2)
        return result

    live_rel = path.relative_to(repo).as_posix()
    plan = TrimPlan()
    plan.retained, plan.archived = retained, archived
    plan.shard_rel, plan.verify_rel, plan.cut_key, plan.span = shard_rel, verify_rel, cut_key, span
    plan.shard_text = build_shard(spec, live_rel, shard_rel, archived, span, cut_key)
    plan.pointer_block = build_pointer_block(spec, shard_rel, verify_rel, len(archived), span, live_rel)

    front, reversals = apply_regenerated(zones.front, spec, {"retained": len(retained)}, result)
    front = insert_pointer(front, plan.pointer_block)
    live_after_core = assemble_live(front, retained, zones.footer)

    plan.before_bytes = len(text.encode("utf-8"))
    today = opts.today or datetime.date.today().isoformat()
    ledger_rel = ledger_rel_for(repo)
    trims_the_ledger = (live_rel == ledger_rel)

    # The reported "after" size must be the size of the file actually written — and when the trimmed
    # file IS the ledger, the entry stating that size is itself part of it. Iterate to a fixed point
    # rather than publish a figure that is short by the length of its own entry: the number is baked
    # into a frozen dated record, and a hand-typed size in this repo has now been wrong three times.
    plan.after_bytes = len(live_after_core.encode("utf-8"))
    month_heading = ""
    for _ in range(5):
        entry = build_ledger_entry(live_rel, shard_rel, verify_rel, len(archived), span,
                                   plan.before_bytes, plan.after_bytes, today)
        if trims_the_ledger:
            candidate, month_heading = insert_ledger_entry(live_after_core, spec, entry,
                                                           today, Result(path))
        else:
            candidate, month_heading = live_after_core, ""
        size = len(candidate.encode("utf-8"))
        if size == plan.after_bytes:
            break
        plan.after_bytes = size
    else:
        result.add("SIZE_UNCONVERGED",
                   "the reported live size did not reach a fixed point; refusing to publish a figure "
                   "that is not the size of the file written.", exit_code=2)
        return result
    plan.ledger_entry = entry
    plan.live_after = candidate
    if month_heading:
        prior = re.findall(r"(?m)^## (\d{4}-\d{2})\s*$", live_after_core[:len(front)])
        if prior:
            result.add("LEDGER_MONTH_BOUNDARY",
                       "this entry opens a new month section (%s) while the ledger's front matter "
                       "still ends with ## %s, which now heads nothing. Move that one line below "
                       "the new entry before committing — the tool will not reorder a heading it "
                       "cannot prove is safe to move, and it never commits."
                       % (month_heading.strip(), prior[-1]))
    plan.verify_text = build_verify(spec, live_rel, shard_rel,
                                    injected=1 if trims_the_ledger else 0)
    result.plan = plan

    # --- THE ASSERTIONS RUN ON THE ARTIFACTS, NOT ON THE INPUT PARTITION ------------------------
    #
    # This is the whole point, and the first build of this tool got it exactly wrong. It asserted
    # over `records`, `records[:k]` and `records[k:]` — but `records[:k] ++ records[k:] == records`
    # is an IDENTITY, so L1 and L3 could never fire, and L2 was handed the BEFORE footer as its
    # "after" argument, so its clause compared a value with itself. All three were comments shaped
    # like guards: a write path that silently dropped a record printed [L1_OK] [L2_OK] [L3_OK]
    # [WROTE] while the independent verify.sh caught it. Design §6.4 says it plainly — "verify
    # L1/L2/L3 on the in-memory RESULT; only then write" — and the result is these two strings.
    #
    # So: re-parse what is about to be written, with the same grammar, and assert over that.
    shard_zones = classify_zones(plan.shard_text, spec, Result(path))
    live_zones = classify_zones(plan.live_after, spec, Result(path))
    if shard_zones is None or live_zones is None:
        result.add("ARTIFACT_UNPARSEABLE",
                   "the text this run would write does not parse under its own declared grammar — "
                   "refusing to write something the proof could not read back.", exit_code=2)
        return result
    injected = 1 if trims_the_ledger else 0
    after_records = live_zones.records()[injected:]
    shard_records = shard_zones.records()
    shard_source = [invert_record(r) for r in shard_records]

    ok = assert_L1(records, after_records, shard_records, result)
    ok = assert_L2(zones, live_zones.front, live_zones.footer, plan.shard_text,
                   [plan.pointer_block, month_heading], reversals, result) and ok
    ok = assert_L3(records, after_records, shard_source, result) and ok
    if not ok:
        return result
    result.add("L1_OK", "records-zone concatenation is byte-identical (asserted on the artifacts)")
    result.add("L2_OK", "zones pinned; front-matter diff confined to declared changes")
    result.add("L3_OK", "%d record(s) partitioned; every one byte-identical across the move"
               % len(records))

    if not opts.write:
        result.add("DRY_RUN",
                   "would archive %d of %d record(s) (%s → %s) to %s; live %s B → %s B. Nothing "
                   "written — pass --write."
                   % (len(archived), len(records), span[0], span[1], shard_rel,
                      "{:,}".format(plan.before_bytes), "{:,}".format(plan.after_bytes)))
        return result

    # --- the write: shard first, then live. At no point is a record in neither file. ------------
    ledger_path = repo / ledger_rel
    ledger_spec = LEDGERS.get(Path(ledger_rel).name)
    lz = classify_zones(read_text(ledger_path), ledger_spec, Result(ledger_path))
    # What the ledger would hold if this run wrote NO entry — the partition's own outcome.
    expected_after_partition = len(retained) if trims_the_ledger else (len(lz.starts) if lz else 0)

    atomic_write(shard_path, plan.shard_text)
    result.written.append(shard_rel)
    atomic_write(repo / verify_rel, plan.verify_text, executable=True)
    result.written.append(verify_rel)
    atomic_write(path, plan.live_after)
    result.written.append(live_rel)
    if not trims_the_ledger:
        lt, _lh = insert_ledger_entry(read_text(ledger_path),
                                      ledger_spec, plan.ledger_entry, today, result)
        atomic_write(ledger_path, lt)
        result.written.append(ledger_rel)

    check_P1a(ledger_path, ledger_spec, expected_after_partition, result)
    result.add("WROTE", "archived %d record(s) to %s; live %s B → %s B"
               % (len(archived), shard_rel, "{:,}".format(plan.before_bytes),
                  "{:,}".format(plan.after_bytes)))
    return result


def ledger_rel_for(repo):
    return "CHANGELOG.md"


def report(result, opts):
    print("== %s ==" % result.path)
    for f in result.findings:
        print("  [%s] %s" % (f.code, f.message))
    if result.written:
        print("\n  WRITTEN (uncommitted — this tool never commits):")
        for w in result.written:
            print("    %s" % w)
        live = [w for w in result.written if not w.startswith(ARCHIVE_DIR)]
        shards = [w for w in result.written if w.startswith(ARCHIVE_DIR)]
        print("\n  Rollback:  git checkout -- %s && rm -f %s"
              % (" ".join(live), " ".join(shards)))
        print("  Verify:    bash %s" % (result.plan.verify_rel if result.plan else ""))
        print("  Then commit yourself — one ledger, one shard, one entry, one commit, one revert.")


def main(argv=None):
    p = argparse.ArgumentParser(
        prog="methodology_trim.py",
        description="Trim a grow-and-must-be-read ledger into a frozen shard, provably losslessly.")
    p.add_argument("--file", action="append", default=[], metavar="PATH",
                   help="the ledger to trim (repeatable). Required.")
    p.add_argument("--write", action="store_true",
                   help="actually write. Absent -> dry run, which is the default.")
    p.add_argument("--cut", metavar="N|YYYY-MM-DD|@REF", help="override the computed cut point")
    p.add_argument("--budget-bytes", type=int, default=None, help="override the byte budget")
    p.add_argument("--force", action="store_true", help="proceed despite the SRF-RED refusal")
    p.add_argument("--check", action="store_true",
                   help="evaluate the trigger and report; never writes, even with --write")
    p.add_argument("--today", help=argparse.SUPPRESS)   # test seam: deterministic dates
    p.add_argument("--version", action="version", version="methodology_trim.py v" + TRIM_VERSION)
    opts = p.parse_args(argv)

    if not opts.file:
        p.print_usage(sys.stderr)
        print("methodology_trim.py: --file is required", file=sys.stderr)
        return 3
    if opts.write and not opts.check and len(opts.file) > 1:
        print("methodology_trim.py: one --file per --write. A batched trim has a rollback that "
              "cannot be expressed as one revert, and the 5-file per-commit cap applies regardless.",
              file=sys.stderr)
        return 3

    worst = 0
    for f in opts.file:
        result = Result(Path(f))
        evaluate(Path(f), opts, result)
        report(result, opts)
        worst = max(worst, result.exit)
    return worst


if __name__ == "__main__":
    sys.exit(main())
