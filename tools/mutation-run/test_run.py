#!/usr/bin/env python3
"""Self-test for run.py: every case builds a throwaway git repo and drives the runner as a subprocess, so what is tested is the command line a session types.

    python3 tools/mutation-run/test_run.py        (stdlib only; about 10 s)

Not wired into `npm test`: that suite is the extension's own, and this tool ships nothing. Run it after any edit to run.py.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
RUN = os.path.join(HERE, "run.py")

CHECK = 'import sys\nsys.exit(0 if "alpha" in open("src.txt").read() else 1)\n'  # a suite that only guards "alpha"
EXTRA = 'import sys\nsys.exit(0 if "beta" in open("src.txt").read() else 1)\n'  # an UNCOMMITTED row that guards "beta"
ONE = {"name": "M1 alpha", "file": "src.txt", "from": "alpha", "to": "ALPHA", "expect": "killed"}
TWO = {"name": "M2 beta", "file": "src.txt", "from": "beta", "to": "BETA", "expect": "survives"}


def git(cwd, *args):
    return subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@t", *args], cwd=cwd, capture_output=True, text=True, check=True)


class RunnerTest(unittest.TestCase):
    def setUp(self):
        self.repo = tempfile.mkdtemp(prefix="mutation-run-selftest-")
        git(self.repo, "init", "-q")
        self.write("src.txt", "alpha\nbeta\nbeta\n")
        self.write("check.py", CHECK)
        git(self.repo, "add", "src.txt", "check.py")
        git(self.repo, "commit", "-q", "-m", "seed")

    def tearDown(self):
        shutil.rmtree(self.repo, ignore_errors=True)

    def write(self, name, text):
        with open(os.path.join(self.repo, name), "w") as f:
            f.write(text)

    def read(self, name):
        with open(os.path.join(self.repo, name)) as f:
            return f.read()

    def run_runner(self, mutants, *extra, cmd="python3 check.py"):
        self.write("mutants.json", json.dumps(mutants))
        r = subprocess.run([sys.executable, RUN, os.path.join(self.repo, "mutants.json"), "--repo", self.repo, "--cmd", cmd, *extra], capture_output=True, text=True, timeout=120)
        return r.returncode, r.stdout + r.stderr

    def test_a_killed_mutant_and_a_surviving_one_each_get_their_verdict(self):
        one = dict(ONE, **{"from": "alpha"})
        two = dict(TWO, **{"from": "beta\nbeta"})  # occurs once
        rc, out = self.run_runner([one, two])
        self.assertEqual(rc, 0, out)
        self.assertRegex(out, r"M1 alpha\s+KILLED")
        self.assertRegex(out, r"M2 beta\s+SURVIVES")

    def test_an_expectation_the_verdict_contradicts_exits_1(self):
        one = dict(ONE, **{"from": "alpha"})
        two = dict(TWO, **{"from": "beta\nbeta", "expect": "killed"})
        rc, out = self.run_runner([one, two])
        self.assertEqual(rc, 1, out)
        self.assertIn("EXPECTED killed", out)

    def test_a_pattern_that_is_absent_or_repeated_is_skipped_and_exits_4(self):
        for pattern, count in (("gamma", 0), ("beta", 2)):
            rc, out = self.run_runner([dict(ONE, **{"from": pattern})])
            self.assertEqual(rc, 4, out)
            self.assertIn(f"SKIPPED (pattern occurs {count} times)", out)

    def test_a_red_baseline_exits_3_before_any_mutant_runs(self):
        self.write("check.py", "import sys\nsys.exit(1)\n")
        git(self.repo, "add", "check.py")
        git(self.repo, "commit", "-q", "-m", "red")
        rc, out = self.run_runner([ONE])
        self.assertEqual(rc, 3, out)
        self.assertNotIn("KILLED", out)

    def test_the_main_tree_is_never_mutated_and_the_throwaway_worktree_is_removed(self):
        before = self.read("src.txt")
        rc, out = self.run_runner([ONE])
        self.assertEqual(rc, 0, out)
        self.assertEqual(self.read("src.txt"), before)
        self.assertEqual(git(self.repo, "worktree", "list").stdout.count("\n"), 1)

    def test_a_named_worktree_that_is_the_main_clone_is_refused_with_exit_2(self):
        rc, out = self.run_runner([ONE], "--worktree", self.repo)
        self.assertEqual(rc, 2, out)
        self.assertEqual(self.read("src.txt"), "alpha\nbeta\nbeta\n")

    def test_an_uncommitted_test_file_named_with_tests_reaches_the_worktree(self):
        self.write("extra_check.py", EXTRA)
        two = dict(TWO, **{"from": "beta\nbeta", "to": "x\nx", "expect": "killed"})
        # the suite check.py does not guard "beta": the mutant survives
        rc, out = self.run_runner([dict(two, expect="survives")])
        self.assertEqual(rc, 0, out)
        # extra_check.py was never committed: the baseline can only be green if --tests copied it into the worktree, and it then kills the mutant
        rc, out = self.run_runner([two], "--tests", "extra_check.py", cmd="python3")
        self.assertEqual(rc, 0, out)
        self.assertRegex(out, r"M2 beta\s+KILLED")

    def test_only_runs_the_named_mutants(self):
        rc, out = self.run_runner([ONE, dict(TWO, **{"from": "beta\nbeta"})], "--only", "M1")
        self.assertEqual(rc, 0, out)
        self.assertIn("M1 alpha", out)
        self.assertNotIn("M2 beta", out)

    def test_a_malformed_spec_exits_2(self):
        rc, out = self.run_runner([{"name": "no fields"}])
        self.assertEqual(rc, 2, out)
        rc, out = self.run_runner([dict(ONE, **{"to": "alpha"})])  # from == to
        self.assertEqual(rc, 2, out)
        rc, out = self.run_runner([dict(ONE, expect="maybe")])
        self.assertEqual(rc, 2, out)


if __name__ == "__main__":
    unittest.main(verbosity=2)
