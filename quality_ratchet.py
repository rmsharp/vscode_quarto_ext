#!/usr/bin/env python3
"""quality_ratchet.py — declared quality thresholds that bind every actor and only tighten.

WHY THIS EXISTS
---------------
The methodology's quality gates are mostly questions the actor asks itself. A
self-certified gate does not scale under N agents; it multiplies. The alternative is
to enforce on the ARTIFACT: a project declares the thresholds it already meets
(tests pass, coverage >= X, complexity <= Y, a link check exits 0) in one
machine-readable file, and a hook refuses any commit that LOOSENS one of them. The
threshold starts where the project is and only ever moves toward better. That is
the whole mechanism — a ratchet, not a ruler.

WHAT IT DOES NOT DO
-------------------
It ships no linter, coverage runner, or complexity tool: the methodology recommends,
it does not reimplement. Which command produces each number is the project's choice
(BOOTSTRAP.md Step 10 lists options per stack). It never edits code, never adjudicates
a review finding, and a gate it cannot run reports UNMEASURED, never pass. It holds
THRESHOLDS, not commands: a changed `command` or `extract` is printed as a warning and
left to review — the results file will show the discontinuity.

There is deliberately no --force. Loosening a threshold is a decision, and the only
way to take it is to edit .quality-gates.json under plan-mode approval and commit
with --no-verify, which the hook prints as a recorded bypass (SAFEGUARDS.md, Blast
Radius Limits; SESSION_RUNNER.md failure mode #17).

The comparison is between the staged manifest and the NEWEST PARSEABLE COMMITTED one
in the branch's history that declares a gate -- not merely HEAD's copy. So removing
the manifest (or emptying it) is refused as the loosest loosening, re-adding it lower
after a bypassed removal is still a loosening against the version that was removed,
and a corrupted or emptied HEAD copy is skipped rather than treated as a fresh start. A branch that removed its manifest and left it
removed is not locked: with nothing staged and nothing at HEAD there is nothing to
ratchet. What the hook cannot see: merge, rebase and cherry-pick commits, which the
chained ledger hook skips before the ratchet runs -- a manifest conflict resolved by
loosening during a merge is caught by the dashboard's read of the manifest's history,
not by the hook.

Python 3 stdlib only, cross-platform. Conventions follow context_budget.py.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

VERSION = "1.1.0"
CONFIG_NAME = ".quality-gates.json"
DEFAULT_RESULTS = ".quality-gates-results.json"
DIRECTIONS = ("min", "max")

R = "\033[0m"; B = "\033[1m"; D = "\033[2m"
RED = "\033[31m"; YEL = "\033[33m"; GRN = "\033[32m"; CYN = "\033[36m"

CLEAN, WARN, REFUSED, USAGE = 0, 1, 2, 3


# === PLUMBING ===

def run(argv, cwd=None, timeout=None, shell=False):
    try:
        p = subprocess.run(argv, cwd=cwd, capture_output=True, text=True,
                           timeout=timeout, shell=shell)
    except (OSError, subprocess.TimeoutExpired) as e:
        return 127, "", str(e)
    return p.returncode, p.stdout, p.stderr


def find_root(start=None):
    """The project root: the nearest directory at or above `start` holding the manifest, else
    the git toplevel. The fallback is what lets --precommit judge a commit that REMOVES the
    manifest from the worktree (PR #82 review, 2a/4): a walk that only looks for the file
    exited 3 there, before the removal was ever compared to anything -- and in the hook
    install-hook writes, that exit refused every later commit in the repository."""
    start = os.path.abspath(start or os.getcwd())
    d = start
    while True:
        if os.path.exists(os.path.join(d, CONFIG_NAME)):
            return d
        parent = os.path.dirname(d)
        if parent == d:
            break
        d = parent
    rc, out, _ = run(["git", "rev-parse", "--show-toplevel"], cwd=start)
    return out.strip() if rc == 0 and out.strip() else None


def load_manifest_text(text, where):
    """Parse manifest JSON; return (cfg, defects). Defects are strings a human can act on."""
    try:
        cfg = json.loads(text)
    except ValueError as e:
        return None, [f"{where}: not valid JSON ({e})"]
    return cfg, config_defects(cfg)


def config_defects(cfg):
    out = []
    gates = cfg.get("gates") if isinstance(cfg, dict) else None
    if not isinstance(gates, list):
        return ["`gates` must be a list"]
    seen = set()
    for i, g in enumerate(gates):
        tag = f"gate[{i}]"
        if not isinstance(g, dict):
            out.append(f"{tag}: not an object"); continue
        name = g.get("name")
        if not name or not isinstance(name, str):
            out.append(f"{tag}: missing `name`"); continue
        tag = f"gate {name!r}"
        if name in seen:
            out.append(f"{tag}: duplicate name — the ratchet keys on names")
        seen.add(name)
        if g.get("direction") not in DIRECTIONS:
            out.append(f"{tag}: `direction` must be one of {DIRECTIONS}")
        try:
            float(g.get("threshold"))
        except (TypeError, ValueError):
            out.append(f"{tag}: `threshold` must be a number")
        if "extract" in g:
            try:
                re.compile(g["extract"])
            except re.error as e:
                out.append(f"{tag}: `extract` is not a valid regex ({e})")
            if not g.get("command"):
                out.append(f"{tag}: `extract` without `command` — nothing to extract from")
    return out


def gate_map(cfg):
    return {g["name"]: g for g in cfg.get("gates", []) if isinstance(g, dict) and g.get("name")}


def blob_text(root, rev_path):
    rc, out, _ = run(["git", "cat-file", "-p", rev_path], cwd=root)
    return out if rc == 0 else None


HISTORY_MAX = 50   # manifest commits walked back from HEAD for the comparison base


def newest_committed(root):
    """(cfg, sha) of the newest PARSEABLE, defect-free manifest in HEAD's history of the file
    THAT DECLARES AT LEAST ONE GATE, or (None, None) if none was ever committed. A commit
    that deleted the file, one whose copy does not parse, and one whose gate list is empty
    (a bypassed emptying, or the seed adopters receive) are all skipped rather than read as
    a fresh start: the base is what was last declared, and only a tightening moves it."""
    rc, out, _ = run(["git", "log", "--format=%H", f"--max-count={HISTORY_MAX}", "--", CONFIG_NAME],
                     cwd=root)
    if rc != 0:
        return None, None
    for sha in out.split():
        text = blob_text(root, f"{sha}:{CONFIG_NAME}")
        if text is None:
            continue
        cfg, defects = load_manifest_text(text, f"{sha[:7]} {CONFIG_NAME}")
        if cfg is not None and not defects and gate_map(cfg):
            return cfg, sha[:7]
    return None, None


def head_sha(root):
    rc, out, _ = run(["git", "rev-parse", "--short", "HEAD"], cwd=root)
    return out.strip() if rc == 0 else None


def sha12(obj):
    return hashlib.sha256(json.dumps(obj, sort_keys=True).encode()).hexdigest()[:12]


# === THE RATCHET (--precommit) ===

def compare(old_cfg, new_cfg):
    """Return (refusals, warnings) for the transition old -> new. Pure; no git.

    Refused: a gate removed; a direction changed; a `min` threshold lowered; a `max`
    threshold raised. Warned: a command/extract changed (the ratchet cannot judge it).
    Adding a gate and tightening a threshold always pass."""
    refusals, warnings = [], []
    old, new = gate_map(old_cfg), gate_map(new_cfg)
    for name, og in old.items():
        ng = new.get(name)
        if ng is None:
            refusals.append(f"gate {name!r} removed (was {og.get('direction')} "
                            f"{og.get('threshold')}) — removing a gate is the loosest loosening")
            continue
        if og.get("direction") != ng.get("direction"):
            refusals.append(f"gate {name!r}: direction {og.get('direction')} -> "
                            f"{ng.get('direction')} — a direction flip is not a tightening")
            continue
        try:
            ot, nt = float(og.get("threshold")), float(ng.get("threshold"))
        except (TypeError, ValueError):
            continue  # config_defects reports it; the ratchet has nothing to compare
        if og.get("direction") == "min" and nt < ot:
            refusals.append(f"gate {name!r}: floor lowered {ot:g} -> {nt:g}")
        elif og.get("direction") == "max" and nt > ot:
            refusals.append(f"gate {name!r}: ceiling raised {ot:g} -> {nt:g}")
        for k in ("command", "extract"):
            if og.get(k) != ng.get(k):
                warnings.append(f"gate {name!r}: `{k}` changed — the ratchet holds thresholds, "
                                f"not commands; review the diff and the next results file")
    return refusals, warnings


BYPASS_COST = """\
  · This commit makes a declared threshold weaker than HEAD's. Loosening requires
    plan-mode approval, in its own commit, with the reason in the ledger
    (SAFEGUARDS.md, Blast Radius Limits). Tightening never needs approval.
  · Bypass once: git commit --no-verify — recorded, not exempt: the manifest's git
    history shows the loosening and the dashboard reports it as a risk."""


def precommit(root):
    staged = blob_text(root, f":{CONFIG_NAME}")
    if staged is None:
        # Not in the index. Either it was never here / already removed at HEAD (nothing to
        # ratchet -- a branch that opted out must not be locked), or this commit REMOVES it.
        if blob_text(root, f"HEAD:{CONFIG_NAME}") is None:
            return CLEAN
        old_cfg, sha = newest_committed(root)
        gone = gate_map(old_cfg) if old_cfg else {}
        if not gone:
            return CLEAN  # nothing parseable ever declared a gate; removing it loosens nothing
        print(f"{RED}{B}quality-ratchet: REFUSED — manifest removed ({len(gone)} gate(s) declared "
              f"in {sha}: {', '.join(sorted(gone))}){R}")
        print(f"  {RED}✗ removing the manifest is the loosest loosening there is{R}")
        print(BYPASS_COST)
        return REFUSED
    new_cfg, defects = load_manifest_text(staged, "staged " + CONFIG_NAME)
    if new_cfg is None or defects:
        for m in defects:
            print(f"{RED}quality-ratchet: config defect — {m}{R}")
        print(f"{RED}refused: a manifest with defects would gate nothing{R}")
        return REFUSED
    old_cfg, sha = newest_committed(root)
    if old_cfg is None:
        print(f"{D}quality-ratchet: first manifest commit ({len(new_cfg['gates'])} gate(s)) — "
              f"nothing to compare against{R}")
        return CLEAN
    head_copy = blob_text(root, f"HEAD:{CONFIG_NAME}")
    head_cfg = load_manifest_text(head_copy, "HEAD")[0] if head_copy is not None else None
    if head_copy is None or not gate_map(head_cfg or {}):
        print(f"{D}quality-ratchet: comparing against {sha}, the newest committed manifest that "
              f"declares a gate (HEAD's copy is absent, unparseable, or empty){R}")
    refusals, warnings = compare(old_cfg, new_cfg)
    for m in warnings:
        print(f"{YEL}quality-ratchet: warning — {m}{R}")
    if refusals:
        print(f"{RED}{B}quality-ratchet: REFUSED — {len(refusals)} threshold(s) loosened{R}")
        for m in refusals:
            print(f"  {RED}✗ {m}{R}")
        print(BYPASS_COST)
        return REFUSED
    added = set(gate_map(new_cfg)) - set(gate_map(old_cfg))
    if added:
        print(f"{D}quality-ratchet: {len(added)} gate(s) added: {', '.join(sorted(added))}{R}")
    return CLEAN


# === MEASUREMENT (--run) ===

def measure_gate(root, g, timeout, memo=None):
    """Run one gate. Returns a result dict; `status` is pass | fail | unmeasured. `memo` is a
    per-run dict: two gates over the same command (a suite's passed count and its failed
    count) run it once — the same run, the same output, two numbers read from it."""
    res = {"name": g["name"], "direction": g["direction"], "threshold": float(g["threshold"]),
           "measured": None, "status": "unmeasured", "note": ""}
    cmd = g.get("command")
    if not cmd:
        res["note"] = "declared, no command"
        return res
    if memo is not None and cmd in memo:
        rc, out, err = memo[cmd]
    else:
        rc, out, err = run(cmd, cwd=root, timeout=timeout, shell=True)
        if memo is not None:
            memo[cmd] = (rc, out, err)
    text = out + err
    if g.get("extract"):
        m = re.search(g["extract"], text, re.MULTILINE)
        if not m or not m.groups():
            res["note"] = f"extract matched nothing (exit {rc})"
            return res
        try:
            res["measured"] = float(m.group(1))
        except ValueError:
            res["note"] = f"extract captured {m.group(1)!r}, not a number"
            return res
    else:
        res["measured"] = float(rc)   # no extract: the exit code IS the measurement
    ok = (res["measured"] >= res["threshold"] if g["direction"] == "min"
          else res["measured"] <= res["threshold"])
    res["status"] = "pass" if ok else "fail"
    return res


def run_gates(root, cfg, timeout=600):
    memo = {}
    results = [measure_gate(root, g, timeout, memo) for g in cfg.get("gates", [])]
    summary = {s: sum(1 for r in results if r["status"] == s)
               for s in ("pass", "fail", "unmeasured")}
    snapshot = {"gates": results, "summary": summary,
                "manifest": sha12(cfg.get("gates", [])), "head": head_sha(root)}
    snapshot["results"] = sha12(snapshot["gates"])
    snapshot["ran_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    snapshot["version"] = VERSION
    return snapshot


def summary_line(snap):
    s, n = snap["summary"], len(snap["gates"])
    return (f"quality_ratchet: {s['pass']}/{n} pass · {s['fail']} fail · "
            f"{s['unmeasured']} unmeasured · results {snap['results']} · manifest {snap['manifest']}")


def render(snap, title):
    print(f"\n{D}{'─' * 74}{R}")
    colour = GRN if snap["summary"]["fail"] == 0 and snap["summary"]["unmeasured"] == 0 else (
        RED if snap["summary"]["fail"] else YEL)
    print(f"  {B}{title}{R}  {colour}{B}{summary_line(snap).split(': ', 1)[1]}{R}")
    print(f"{D}{'─' * 74}{R}")
    print(f"  {D}{'gate':<30}{'rule':>14}{'measured':>12}  status{R}")
    for r in snap["gates"]:
        rule = f"{'>=' if r['direction'] == 'min' else '<='} {r['threshold']:g}"
        meas = "—" if r["measured"] is None else f"{r['measured']:g}"
        col = {"pass": GRN, "fail": RED, "unmeasured": YEL}[r["status"]]
        note = f"  {D}{r['note']}{R}" if r.get("note") else ""
        print(f"  {r['name'][:30]:<30}{rule:>14}{meas:>12}  {col}{r['status']}{R}{note}")
    print(f"{D}{'─' * 74}{R}")
    print(f"  {D}cite in the receipt:{R} {summary_line(snap)}\n")


def results_path(root, cfg):
    return os.path.join(root, cfg.get("results_file") or DEFAULT_RESULTS)


def load_results(root, cfg):
    p = results_path(root, cfg)
    if not os.path.exists(p):
        return None
    try:
        return json.load(open(p))
    except ValueError:
        return None


def do_run(root, cfg, as_json=False):
    snap = run_gates(root, cfg)
    with open(results_path(root, cfg), "w") as f:
        json.dump(snap, f, indent=1, sort_keys=True)
        f.write("\n")
    if as_json:
        print(json.dumps(snap, indent=1, sort_keys=True))
    else:
        render(snap, "quality gates — run")
    if snap["summary"]["fail"]:
        return REFUSED
    return WARN if snap["summary"]["unmeasured"] else CLEAN


def do_status(root, cfg, as_json=False):
    snap = load_results(root, cfg)
    n = len(cfg.get("gates", []))
    if snap is None:
        msg = f"{n} gate(s) declared, never run here — `quality_ratchet.py --run` measures them"
        print(json.dumps({"gates": n, "results": None, "note": msg}) if as_json
              else f"{YEL}quality-ratchet: {msg}{R}")
        return WARN if n else CLEAN
    stale = snap.get("manifest") != sha12(cfg.get("gates", []))
    if as_json:
        snap["stale"] = stale
        print(json.dumps(snap, indent=1, sort_keys=True))
    else:
        render(snap, f"quality gates — last run {snap.get('ran_at', '?')} at {snap.get('head', '?')}")
        if stale:
            print(f"{YEL}quality-ratchet: the manifest changed since that run — re-run before "
                  f"citing it{R}")
    if stale:
        return WARN
    return REFUSED if snap["summary"]["fail"] else (WARN if snap["summary"]["unmeasured"] else CLEAN)


# === HOOK ===

HOOK = """#!/bin/sh
# installed by quality_ratchet.py — refuses a commit that LOOSENS a declared quality
# threshold in .quality-gates.json, or removes the manifest. Tightening and adding pass.
exec python3 "$(git rev-parse --show-toplevel)/{tool}" --precommit
"""


def hook_text(tool_relpath):
    """The hook execs the copy that installed it. Adopters hold the tool at the root; the
    canonical repo under starter-kit/ — a hook that assumed the root broke every commit
    in a fresh clone of the latter (PR #82 review, section 4)."""
    return HOOK.format(tool=tool_relpath.replace(os.sep, "/"))


def install_hook(root):
    rc, gd, err = run(["git", "rev-parse", "--git-dir"], cwd=root)
    if rc:
        print(f"{RED}not a git repository: {err}{R}"); return USAGE
    gd = gd.strip() if os.path.isabs(gd.strip()) else os.path.join(root, gd.strip())
    rc3, top, _ = run(["git", "rev-parse", "--show-toplevel"], cwd=root)
    top = top.strip() if rc3 == 0 and top.strip() else root
    tool = os.path.relpath(os.path.abspath(__file__), top)
    rc2, configured, _ = run(["git", "config", "--get", "core.hooksPath"], cwd=root)
    configured = configured.strip()
    if rc2 == 0 and configured:
        hooks = configured if os.path.isabs(configured) else os.path.join(root, configured)
    else:
        hooks = os.path.join(gd, "hooks")
    os.makedirs(hooks, exist_ok=True)
    p = os.path.join(hooks, "pre-commit")
    if os.path.exists(p):
        existing = open(p, errors="ignore").read()
        if "quality_ratchet.py" in existing:
            print(f"  already installed at {p}"); return CLEAN
        print(f"{YEL}a pre-commit hook already exists at {p} and is not ours — chain it:{R}")
        print(f"  add this line before its final exit (after a ledger gate, if you run one):\n"
              f"    python3 \"$(git rev-parse --show-toplevel)/{tool}\" --precommit || exit $?")
        return WARN
    open(p, "w").write(hook_text(tool)); os.chmod(p, 0o755)
    print(f"  installed {p}")
    print(f"  {D}bypass with `git commit --no-verify` — recorded, not exempt{R}")
    return CLEAN


# === SELFTEST ===

def selftest():
    """Observe every gate FAILING as well as passing, in a throwaway git repo."""
    fails, passed = [], [0]

    def check(label, cond):
        print(f"  {GRN + 'PASS' if cond else RED + 'FAIL'}{R}  {label}")
        (passed.__setitem__(0, passed[0] + 1) if cond else fails.append(label))

    py = sys.executable.replace("\\", "/")
    base = {"version": 1, "gates": [
        {"name": "three", "direction": "min", "threshold": 3,
         "command": f'"{py}" -c "print(3)"', "extract": r"(\d+)"},
        {"name": "exit-zero", "direction": "max", "threshold": 0, "command": f'"{py}" -c "pass"'},
    ]}
    # --- pure ratchet arithmetic ---
    loosened = json.loads(json.dumps(base)); loosened["gates"][0]["threshold"] = 2
    raised = json.loads(json.dumps(base)); raised["gates"][1]["threshold"] = 1
    tightened = json.loads(json.dumps(base)); tightened["gates"][0]["threshold"] = 4
    removed = {"version": 1, "gates": base["gates"][:1]}
    flipped = json.loads(json.dumps(base)); flipped["gates"][0]["direction"] = "max"
    added = json.loads(json.dumps(base)); added["gates"].append(
        {"name": "new", "direction": "max", "threshold": 0})
    cmd_changed = json.loads(json.dumps(base)); cmd_changed["gates"][1]["command"] = "true"
    check("lowering a floor is refused", compare(base, loosened)[0])
    check("raising a ceiling is refused", compare(base, raised)[0])
    check("removing a gate is refused", compare(base, removed)[0])
    check("flipping a direction is refused", compare(base, flipped)[0])
    check("tightening passes", not compare(base, tightened)[0])
    check("adding a gate passes", not compare(base, added)[0])
    check("a changed command warns, not refuses",
          not compare(base, cmd_changed)[0] and compare(base, cmd_changed)[1])
    check("config defects are reported", config_defects({"gates": [{"name": "x", "direction": "up",
                                                                     "threshold": "n"}]}))
    # --- the hook, end to end, in a throwaway repo ---
    with tempfile.TemporaryDirectory() as d:
        run(["git", "init", "-q", d]); run(["git", "-C", d, "config", "user.email", "t@t"])
        run(["git", "-C", d, "config", "user.name", "t"])
        here = os.path.abspath(__file__)
        import shutil; shutil.copy(here, os.path.join(d, "quality_ratchet.py"))
        json.dump(base, open(os.path.join(d, CONFIG_NAME), "w"))
        run(["git", "-C", d, "add", "-A"]); run(["git", "-C", d, "commit", "-q", "-m", "base"])
        # --run: both gates pass; a results file appears; the summary line is citable
        rc, out, _ = run([py, "quality_ratchet.py", "--run"], cwd=d)
        check("--run exits 0 when every gate passes", rc == CLEAN)
        check("--run writes the results file", os.path.exists(os.path.join(d, DEFAULT_RESULTS)))
        check("--run prints a citable summary line", "quality_ratchet: 2/2 pass" in out)
        rc, out, _ = run([py, "quality_ratchet.py", "--status"], cwd=d)
        check("--status reads the last run", rc == CLEAN and "2/2 pass" in out)
        # a failing gate: exit 2; an uncommanded gate: unmeasured, exit 1
        failing = json.loads(json.dumps(base)); failing["gates"][0]["threshold"] = 4
        json.dump(failing, open(os.path.join(d, CONFIG_NAME), "w"))
        rc, out, _ = run([py, "quality_ratchet.py", "--run"], cwd=d)
        check("--run exits 2 on a failed gate", rc == REFUSED and "1 fail" in out)
        unm = json.loads(json.dumps(base)); unm["gates"].append(
            {"name": "declared-only", "direction": "min", "threshold": 1})
        json.dump(unm, open(os.path.join(d, CONFIG_NAME), "w"))
        rc, out, _ = run([py, "quality_ratchet.py", "--run"], cwd=d)
        check("a gate with no command is UNMEASURED (exit 1), never pass",
              rc == WARN and "1 unmeasured" in out)
        # the ratchet through git: install the hook, stage a loosening, commit is refused
        run([py, "quality_ratchet.py", "install-hook"], cwd=d)
        json.dump(loosened, open(os.path.join(d, CONFIG_NAME), "w"))
        run(["git", "-C", d, "add", CONFIG_NAME])
        rc, _, err = run(["git", "-C", d, "commit", "-q", "-m", "loosen"])
        check("the installed hook refuses a loosened threshold", rc != 0 and "REFUSED" in err + _)
        rc, _, _ = run(["git", "-C", d, "commit", "-q", "--no-verify", "-m", "loosen anyway"])
        check("--no-verify bypasses it (recorded in history, not exempt)", rc == 0)
        json.dump(tightened, open(os.path.join(d, CONFIG_NAME), "w"))
        run(["git", "-C", d, "add", CONFIG_NAME])
        rc, _, _ = run(["git", "-C", d, "commit", "-q", "-m", "tighten"])
        check("the installed hook passes a tightened threshold", rc == 0)
        # the deletion hole: removal refused; re-add lower after a bypass still refused; no lockout
        run(["git", "-C", d, "rm", "-q", CONFIG_NAME])
        rc, out, err = run(["git", "-C", d, "commit", "-q", "-m", "remove the manifest"])
        check("removing the manifest is refused as the loosest loosening",
              rc != 0 and "manifest removed" in out + err)
        rc, _, _ = run(["git", "-C", d, "commit", "-q", "--no-verify", "-m", "remove anyway"])
        check("--no-verify bypasses the removal too (recorded)", rc == 0)
        open(os.path.join(d, "unrelated.txt"), "w").write("x\n")
        run(["git", "-C", d, "add", "unrelated.txt"])
        rc, _, _ = run(["git", "-C", d, "commit", "-q", "-m", "unrelated"])
        check("a branch that removed its manifest is not locked", rc == 0)
        json.dump(loosened, open(os.path.join(d, CONFIG_NAME), "w"))
        run(["git", "-C", d, "add", CONFIG_NAME])
        rc, out, err = run(["git", "-C", d, "commit", "-q", "-m", "re-add lower"])
        check("re-adding the manifest lower than the removed one is refused",
              rc != 0 and "REFUSED" in out + err)
        json.dump(tightened, open(os.path.join(d, CONFIG_NAME), "w"))
        run(["git", "-C", d, "add", CONFIG_NAME])
        rc, _, _ = run(["git", "-C", d, "commit", "-q", "-m", "re-add as it was"])
        check("re-adding it at or above the removed thresholds passes", rc == 0)
    if fails:
        print(f"\n{RED}selftest: {len(fails)} of {len(fails) + passed[0]} checks FAILED{R}")
        return REFUSED
    print(f"\n{GRN}selftest: OK — {passed[0]} checks observed failing and passing{R}")
    return CLEAN


# === CLI ===

def print_usage():
    print(f"quality_ratchet.py v{VERSION} — declared quality thresholds that only tighten")
    print("")
    print("Usage: python3 quality_ratchet.py <command> [--json]")
    print("")
    print("Commands:")
    print("  --run          Run every declared gate, write the results file, print the table")
    print("                 and a citable summary line. Exit 2 on any fail, 1 on unmeasured.")
    print("  --status       Report the last run without running anything.")
    print("  --precommit    What the hook runs: refuse a staged .quality-gates.json whose")
    print("                 thresholds are looser than HEAD's. Tightening/adding always pass.")
    print("  install-hook   Install (or explain how to chain) the pre-commit hook. Opt-in.")
    print("  --selftest     Observe every gate FAILING as well as passing.")
    print("  -h, --help     Show this help and exit.")
    print("")
    print("Exit: 0 clean · 1 warn/unmeasured · 2 refused/failed · 3 config or usage")
    print("")
    print("There is deliberately no --force. Loosening a threshold is an edit to")
    print(f"{CONFIG_NAME} under plan-mode approval, committed with --no-verify — a recorded bypass.")


def main():
    args = sys.argv[1:]
    if not args or "-h" in args or "--help" in args:
        print_usage(); return CLEAN if args else USAGE
    if "--selftest" in args:
        return selftest()
    if "--force" in args:
        print(f"{RED}there is no --force; edit {CONFIG_NAME} under plan-mode approval instead{R}")
        return USAGE
    root = find_root()
    if root is None:
        print(f"{RED}no {CONFIG_NAME} found at or above {os.getcwd()}{R}")
        print("  This tool refuses to invent thresholds for a project that has not declared them.")
        return USAGE
    if "--precommit" in args:
        return precommit(root)
    if not os.path.exists(os.path.join(root, CONFIG_NAME)):
        print(f"{RED}no {CONFIG_NAME} found at or above {os.getcwd()}{R}")
        print("  This tool refuses to invent thresholds for a project that has not declared them.")
        return USAGE
    cfg, defects = load_manifest_text(open(os.path.join(root, CONFIG_NAME)).read(), CONFIG_NAME)
    if cfg is None or defects:
        for m in defects:
            print(f"{RED}quality-ratchet: config defect — {m}{R}")
        return USAGE
    as_json = "--json" in args
    if "install-hook" in args:
        return install_hook(root)
    if "--run" in args:
        return do_run(root, cfg, as_json)
    if "--status" in args:
        return do_status(root, cfg, as_json)
    print_usage(); return USAGE


if __name__ == "__main__":
    sys.exit(main())
