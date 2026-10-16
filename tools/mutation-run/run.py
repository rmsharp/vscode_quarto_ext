#!/usr/bin/env python3
"""Mutation runner: apply ONE mutant at a time to a throwaway git worktree, run the tests, restore, print a verdict per mutant.

    python3 tools/mutation-run/run.py <mutants.json> [--tests FILE ...] [--only ID ...] [--worktree DIR | --ref REV]
                                      [--cmd "COMMAND"] [--timeout SEC] [--titles N] [--repo DIR]

A mutants file is a JSON array of {name, file, from, to, expect, why}: `from` must occur EXACTLY ONCE in `file` (overlapping matches count: the runner refuses to
guess which of two to edit), `to` replaces it, `expect` is "killed" (the default: a test must fail under it) or "survives" (a recorded gap: no test may notice yet).
`file` must stay inside the worktree (an absolute path, a `..` that leaves it, or a symlink out of it, such as the linked node_modules, is SKIPPED).
The tracked lists are in `mutants/`; `tools/mutation-run/README.md` says which is which.

What it does, in order:
  1. Makes a detached worktree of <ref> (HEAD by default) under the system temp directory, links the repo's node_modules into it, and copies each --tests file
     from the WORKING tree into it, so a row you have not committed yet is run. Source files are always the COMMITTED ones: commit a source edit first, or the
     runner is testing a tree you did not mutate. With --worktree DIR (a linked worktree of the repo, which you made) it uses that tree AS IT STANDS instead: nothing
     is copied into it, --ref is refused, and it is left in place.
  2. Runs the tests once unmutated (the BASELINE). Red baseline = exit 3: every verdict after it would be meaningless.
  3. For each mutant: replace `from` by `to`, run the tests, put the file back byte for byte (checked), and print KILLED (n failing) or SURVIVES.
     Under the default command (vitest) a non-zero exit with NO failing test (a syntax or import error the mutant caused) is ERROR, never a kill.
     A run that outlives --timeout is killed with its whole process group and counts as a KILL, without titles: it is the one verdict a loaded machine can fake.
  4. Reports whether the run changed any tracked file in the worktree (`worktree after the run: clean`), and removes the worktree it made. It never edits the repo
     you ran it from, and it refuses --worktree unless that is the root of a linked worktree.

Exit: 0 every verdict matched its `expect`; 1 a verdict contradicted it; 2 bad command line or spec; 3 red baseline; 4 a mutant was SKIPPED or ERROR (4 outranks 1);
5 a file could not be restored (the worktree is left in place and named); 6 an unexpected failure (the cleanup still ran); 130 Ctrl-C; 143 SIGTERM.
Run it ALONE: a load-flaky timing row counts as a kill, and the failing titles it prints (--titles) are how you tell a flake from a real kill.
"""
import argparse
import json
import os
import re
import shlex
import shutil
import signal
import subprocess
import sys
import tempfile
import time


def die(code, message):
    print(f"mutation-run: {message}", file=sys.stderr)
    sys.exit(code)


def load_spec(path):
    try:
        with open(path, encoding="utf-8") as f:
            spec = json.load(f)
    except (OSError, ValueError) as err:
        die(2, f"cannot read {path}: {err}")
    if not isinstance(spec, list) or not spec:
        die(2, f"{path} must be a non-empty JSON array")
    seen = set()
    for i, m in enumerate(spec):
        if not isinstance(m, dict):
            die(2, f"mutant {i} is not an object")
        for key in ("name", "file", "from", "to"):
            # `to` may be empty (a deletion); the other three may not
            if not isinstance(m.get(key), str) or (m[key] == "" and key != "to"):
                die(2, f"mutant {i} lacks a {'string' if key == 'to' else 'non-empty string'} {key!r}")
        if m["from"] == m["to"]:
            die(2, f"mutant {m['name']!r}: from and to are equal")
        if m.get("expect", "killed") not in ("killed", "survives"):
            die(2, f"mutant {m['name']!r}: expect must be 'killed' or 'survives'")
        if m["name"] in seen:
            die(2, f"duplicate mutant name {m['name']!r}")
        seen.add(m["name"])
    return spec


def git(repo, *args, check=True):
    r = subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True, errors="replace")
    if check and r.returncode != 0:
        die(2, f"git {' '.join(args)} failed in {repo}: {r.stderr.strip()}")
    return r


def kill_group(p):
    try:
        os.killpg(p.pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        pass


def run_tests(cwd, cmd, timeout):
    """(exit code, output, seconds). The command runs in its own process group so a timeout, Ctrl-C or SIGTERM takes `npx`, node and every vitest worker with it."""
    env = dict(os.environ, NO_COLOR="1", FORCE_COLOR="0", CI="1")
    t0 = time.time()
    p = subprocess.Popen(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, errors="replace", env=env, start_new_session=True)
    try:
        out, _ = p.communicate(timeout=timeout)
        return p.returncode, out, time.time() - t0
    except subprocess.TimeoutExpired:
        kill_group(p)
        p.communicate()
        return 124, "TIMEOUT", time.time() - t0
    except BaseException:
        kill_group(p)
        p.wait()
        raise


def failing_titles(out, limit):
    """One entry per failing test: the `FAIL ...` / `FAIL:` / `ERROR:` lines (vitest's summary, unittest), else the `x` lines of a reporter that has no such line."""
    def collect(prefixes):
        titles = []
        for line in out.splitlines():
            s = line.strip()
            if s.startswith(prefixes):
                title = re.sub(r"\s+\d+ms$", "", s)[:160]
                if title not in titles:
                    titles.append(title)
        return titles
    return (collect(("FAIL ", "FAIL:", "ERROR:")) or collect(("×", "✗")))[:limit]


def verdict_of(rc, out, vitest_mode):
    """(class, text): class is killed | survives | error."""
    if rc == 124:
        return "killed", "KILLED (timeout)"
    if rc == 0:
        return "survives", "SURVIVES"
    if not vitest_mode:
        return "killed", f"KILLED (exit {rc})"
    tests = re.search(r"^\s*Tests\s+(.*)$", out, re.M)
    failed = re.search(r"(\d+) failed", tests.group(1)) if tests else None
    if failed:
        return "killed", f"KILLED ({failed.group(1)} failing)"
    return "error", f"ERROR (exit {rc}, no test failed: a collection or syntax error is not a kill)"


def occurrences(text, pattern):
    """How many places `pattern` matches in `text`, overlapping ones included (`aa` is in `aaa` twice)."""
    n = 0
    at = text.find(pattern)
    while at != -1:
        n += 1
        at = text.find(pattern, at + 1)
    return n


def inside(wt, rel):
    """The real path of `rel` under `wt` when it is a file that stays inside it, else None."""
    root = os.path.realpath(wt)
    real = os.path.realpath(os.path.join(wt, rel))
    return real if real.startswith(root + os.sep) and os.path.isfile(real) else None


def tracked_changes(wt):
    return set(git(wt, "status", "--porcelain", "--untracked-files=no", check=False).stdout.splitlines())


def check_linked_worktree(wt, repo):
    if not os.path.isdir(wt):
        die(2, f"{wt} does not exist")
    top = git(wt, "rev-parse", "--show-toplevel", check=False).stdout.strip()
    if not top or os.path.realpath(top) != os.path.realpath(wt):
        die(2, f"{wt} is not the root of a git worktree: refusing to mutate files inside some other tree")
    gitdir = os.path.realpath(os.path.join(wt, git(wt, "rev-parse", "--git-dir").stdout.strip()))
    common = os.path.realpath(os.path.join(wt, git(wt, "rev-parse", "--git-common-dir").stdout.strip()))
    if gitdir == common or os.path.realpath(wt) == os.path.realpath(repo):
        die(2, f"{wt} is a primary clone, not a linked worktree: refusing to mutate it (omit --worktree to get a throwaway one)")


def run_all(args, spec, repo, wt, cmd, vitest_mode):
    """Baseline, then every mutant; returns the exit code. `wt` is set up and stays the caller's to clean."""
    before = tracked_changes(wt)
    print(f"mutation-run: {len(spec)} mutant(s), worktree {wt}, command: {' '.join(cmd)}", flush=True)
    rc, out, secs = run_tests(wt, cmd, args.timeout)
    if rc != 0:
        print(out[-3000:])
        print(f"mutation-run: BASELINE RED (exit {rc}, {secs:.0f}s): no verdict below this line would mean anything", file=sys.stderr)
        return 3
    print(f"baseline green [{secs:.0f}s]", flush=True)
    counts = {"killed": 0, "survives": 0, "error": 0, "skipped": 0, "mismatch": 0}
    for m in spec:
        path = inside(wt, m["file"])
        if path is None:
            print(f"{m['name']:60s} SKIPPED (file {m['file']!r} is not a file inside the worktree)", flush=True)
            counts["skipped"] += 1
            continue
        with open(path, "rb") as f:
            original = f.read()
        try:
            text = original.decode("utf-8")
        except UnicodeDecodeError:
            print(f"{m['name']:60s} SKIPPED (file {m['file']!r} is not UTF-8 text)", flush=True)
            counts["skipped"] += 1
            continue
        occurs = occurrences(text, m["from"])
        if occurs != 1:
            print(f"{m['name']:60s} SKIPPED (pattern occurs {occurs} times)", flush=True)
            counts["skipped"] += 1
            continue
        try:
            with open(path, "wb") as f:
                f.write(text.replace(m["from"], m["to"]).encode("utf-8"))
            rc, out, secs = run_tests(wt, cmd, args.timeout)
        finally:
            with open(path, "wb") as f:
                f.write(original)
        with open(path, "rb") as f:
            if f.read() != original:
                print(f"mutation-run: COULD NOT RESTORE {path}; worktree left at {wt}", file=sys.stderr)
                return 5
        cls, text_verdict = verdict_of(rc, out, vitest_mode)
        counts[cls] += 1
        line = f"{m['name']:60s} {text_verdict} [{secs:.0f}s]"
        want = m.get("expect", "killed")
        if cls != "error" and cls != want:
            counts["mismatch"] += 1
            line += f"  EXPECTED {want}"
        print(line, flush=True)
        if cls == "killed":
            for title in failing_titles(out, args.titles):
                print(f"      {title}", flush=True)
        elif cls == "error":
            last = out.strip().splitlines()[-1][:200] if out.strip() else "(no output)"
            print(f"      {last}", flush=True)
    stray = sorted(tracked_changes(wt) - before)
    print(f"worktree after the run: {'clean' if not stray else 'DIRTY ' + repr(stray)}")
    print(f"mutation-run: {counts['killed']} killed, {counts['survives']} survive, {counts['error']} error, {counts['skipped']} skipped; {counts['mismatch']} contradict their expectation")
    return 4 if counts["skipped"] or counts["error"] else (1 if counts["mismatch"] else 0)


def main():
    """Returns the exit code."""
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("mutants")
    ap.add_argument("--tests", nargs="*", default=[], help="test files (paths relative to the repo root), copied from the working tree and passed to the command")
    ap.add_argument("--only", nargs="*", default=[], help="run only mutants whose name starts with one of these")
    ap.add_argument("--worktree", help="use this linked worktree as it stands instead of making one (nothing is copied into it; it is left in place)")
    ap.add_argument("--ref", help="the commit the throwaway worktree is made from (default HEAD; refused with --worktree)")
    ap.add_argument("--cmd", help="the test command (default: npx vitest run); non-zero exit counts as a kill")
    ap.add_argument("--timeout", type=int, default=600)
    ap.add_argument("--titles", type=int, default=4, help="failing test titles to print per kill")
    ap.add_argument("--repo", help="the repository (default: the one containing the current directory)")
    args = ap.parse_args()

    spec = load_spec(args.mutants)
    if args.only:
        spec = [m for m in spec if any(m["name"].startswith(p) for p in args.only)]
        if not spec:
            die(2, f"--only {args.only} matches no mutant")
    repo = os.path.abspath(args.repo) if args.repo else git(os.getcwd(), "rev-parse", "--show-toplevel").stdout.strip()
    vitest_mode = args.cmd is None
    cmd = (shlex.split(args.cmd) if args.cmd else ["npx", "vitest", "run"]) + list(args.tests)

    made = None  # the temp directory this run owns; None for a named worktree, and once a file could not be restored
    try:
        if args.worktree:
            if args.ref is not None:
                die(2, "--ref is meaningless with --worktree: that tree is used as it stands")
            wt = os.path.abspath(args.worktree)
            check_linked_worktree(wt, repo)
            for t in args.tests:
                if not os.path.isfile(os.path.join(wt, t)):
                    die(2, f"--tests {t}: no such file in {wt} (nothing is copied into a named worktree)")
        else:
            for t in args.tests:
                if not os.path.isfile(os.path.join(repo, t)):
                    die(2, f"--tests {t}: no such file under {repo}")
            made = tempfile.mkdtemp(prefix="mutation-run-")
            wt = os.path.join(made, "wt")
            git(repo, "worktree", "add", "--detach", wt, args.ref or "HEAD")
            if os.path.isdir(os.path.join(repo, "node_modules")):
                os.symlink(os.path.join(repo, "node_modules"), os.path.join(wt, "node_modules"))
            for t in args.tests:
                os.makedirs(os.path.dirname(os.path.join(wt, t)), exist_ok=True)
                shutil.copyfile(os.path.join(repo, t), os.path.join(wt, t))
        code = run_all(args, spec, repo, wt, cmd, vitest_mode)
        if code == 5:
            made = None  # the worktree holds the unrestored file: leave it where it is
        return code
    finally:
        if made is not None:
            git(repo, "worktree", "remove", "--force", os.path.join(made, "wt"), check=False)
            shutil.rmtree(made, ignore_errors=True)


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(143))
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("mutation-run: interrupted", file=sys.stderr)
        sys.exit(130)
    except SystemExit:
        raise
    except Exception as err:  # the cleanup in main()'s finally has already run
        print(f"mutation-run: internal error: {type(err).__name__}: {err}", file=sys.stderr)
        sys.exit(6)
