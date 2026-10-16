#!/usr/bin/env python3
"""Self-test for run.py: every case builds a throwaway git repo and drives the runner as a subprocess, so what is tested is the command line a session types.

    python3 tools/mutation-run/test_run.py        (stdlib only; about 20 s idle)

Not wired into `npm test`: that suite is the extension's own, and this tool ships nothing. Run it after any edit to run.py.
"""
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
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
        self.tmp = tempfile.mkdtemp(prefix="mutation-run-selftest-tmp-")  # the runner's TMPDIR: whatever is left in it after a run is a leak
        git(self.repo, "init", "-q")
        self.write("src.txt", "alpha\nbeta\nbeta\n")
        self.write("check.py", CHECK)
        git(self.repo, "add", "src.txt", "check.py")
        git(self.repo, "commit", "-q", "-m", "seed")

    def tearDown(self):
        shutil.rmtree(self.repo, ignore_errors=True)
        shutil.rmtree(self.tmp, ignore_errors=True)

    def commit(self, *names):
        git(self.repo, "add", *names)
        git(self.repo, "commit", "-q", "-m", "update " + " ".join(names))

    def leaked(self):
        """(entries left in the runner's TMPDIR, lines of `git worktree list`): a clean run leaves ([], 1)."""
        return os.listdir(self.tmp), git(self.repo, "worktree", "list").stdout.count("\n")

    def write(self, name, text):
        with open(os.path.join(self.repo, name), "w") as f:
            f.write(text)

    def read(self, name):
        with open(os.path.join(self.repo, name)) as f:
            return f.read()

    def argv(self, mutants, *extra, cmd="python3 check.py"):
        self.write("mutants.json", json.dumps(mutants))
        argv = [sys.executable, RUN, os.path.join(self.repo, "mutants.json"), "--repo", self.repo, *extra]
        if cmd is not None:
            argv += ["--cmd", cmd]
        return argv

    def run_runner(self, mutants, *extra, cmd="python3 check.py", env=None):
        """cmd=None leaves out --cmd, so the runner takes its default (`npx vitest run`) and parses vitest's summary."""
        r = subprocess.run(self.argv(mutants, *extra, cmd=cmd), capture_output=True, text=True, timeout=120, env={**os.environ, "TMPDIR": self.tmp, **(env or {})})
        return r.returncode, r.stdout + r.stderr

    def fake_vitest(self, body):
        """A stand-in `npx` first on PATH: `body` is a shell script run in the worktree, so it can read the (possibly mutated) src.txt."""
        bin_dir = os.path.join(self.repo, "fakebin")
        os.makedirs(bin_dir, exist_ok=True)
        path = os.path.join(bin_dir, "npx")
        with open(path, "w") as f:
            f.write("#!/bin/sh\n" + body)
        os.chmod(path, 0o755)
        return dict(os.environ, PATH=bin_dir + os.pathsep + os.environ["PATH"])

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
        # The suite fails if the MAIN tree's src.txt differs while it runs, so a runner that mutates the main tree and restores it afterwards is seen DURING the run.
        self.write("check.py", 'import os, sys\nsys.exit(0 if open(os.environ["MAIN_SRC"]).read() == "alpha\\nbeta\\nbeta\\n" else 1)\n')
        self.commit("check.py")
        rc, out = self.run_runner([dict(ONE, expect="survives")], env={"MAIN_SRC": os.path.join(self.repo, "src.txt")})
        self.assertEqual(rc, 0, out)
        self.assertRegex(out, r"M1 alpha\s+SURVIVES")
        self.assertEqual(self.read("src.txt"), "alpha\nbeta\nbeta\n")
        self.assertEqual(self.leaked(), ([], 1))

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

    def test_under_vitest_a_failing_test_is_a_kill_and_its_title_is_printed(self):
        env = self.fake_vitest('if grep -q ALPHA src.txt; then echo " FAIL  test/unit/x.test.ts > a row title 12ms"; echo "      Tests  2 failed | 5 passed (7)"; exit 1; fi\necho "      Tests  7 passed (7)"\n')
        rc, out = self.run_runner([ONE], cmd=None, env=env)
        self.assertEqual(rc, 0, out)
        self.assertRegex(out, r"M1 alpha\s+KILLED \(2 failing\)")
        self.assertIn("FAIL  test/unit/x.test.ts > a row title", out)
        self.assertNotIn("title 12ms", out)  # the duration is cut from the title

    def test_under_vitest_a_non_zero_exit_with_no_failing_test_is_an_error_not_a_kill(self):
        env = self.fake_vitest('if grep -q ALPHA src.txt; then echo "SyntaxError: Unexpected token"; exit 1; fi\necho "      Tests  7 passed (7)"\n')
        rc, out = self.run_runner([ONE], cmd=None, env=env)
        self.assertEqual(rc, 4, out)
        self.assertRegex(out, r"M1 alpha\s+ERROR")
        self.assertNotIn("KILLED", out)

    def test_a_run_past_the_timeout_is_a_kill(self):
        self.write("check.py", 'import sys, time\ntext = open("src.txt").read()\nif "ALPHA" in text:\n    time.sleep(30)\nsys.exit(0)\n')
        git(self.repo, "add", "check.py")
        git(self.repo, "commit", "-q", "-m", "slow under the mutant")
        rc, out = self.run_runner([ONE], "--timeout", "3")
        self.assertEqual(rc, 0, out)
        self.assertRegex(out, r"M1 alpha\s+KILLED \(timeout\)")

    def test_a_second_primary_clone_is_refused_too(self):
        other = tempfile.mkdtemp(prefix="mutation-run-selftest-clone-")
        try:
            git(self.repo, "clone", "-q", self.repo, os.path.join(other, "c"))
            rc, out = self.run_runner([ONE], "--worktree", os.path.join(other, "c"))
            self.assertEqual(rc, 2, out)
            self.assertIn("primary clone", out)
        finally:
            shutil.rmtree(other, ignore_errors=True)

    def test_the_repos_node_modules_is_linked_into_the_worktree(self):
        os.makedirs(os.path.join(self.repo, "node_modules"))
        # the command ignores src.txt, so the mutant survives; the baseline is green only if the link exists (a red baseline would exit 3)
        rc, out = self.run_runner([dict(ONE, expect="survives")], cmd="python3 -c 'import os, sys; sys.exit(0 if os.path.isdir(\"node_modules\") else 1)'")
        self.assertEqual(rc, 0, out)
        self.assertIn("baseline green", out)

    def test_ref_names_the_commit_the_worktree_is_made_from(self):
        self.write("check.py", "import sys\nsys.exit(1)\n")
        git(self.repo, "add", "check.py")
        git(self.repo, "commit", "-q", "-m", "red")
        rc, out = self.run_runner([ONE], "--ref", "HEAD~1")
        self.assertEqual(rc, 0, out)
        self.assertRegex(out, r"M1 alpha\s+KILLED")

    def test_two_mutants_with_one_name_and_a_missing_tests_file_exit_2(self):
        rc, out = self.run_runner([ONE, ONE])
        self.assertEqual(rc, 2, out)
        self.assertIn("duplicate", out)
        rc, out = self.run_runner([ONE], "--tests", "no_such_test.py")
        self.assertEqual(rc, 2, out)
        self.assertIn("no_such_test.py", out)
        self.assertEqual(self.leaked(), ([], 1))

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

    # ---- the review round of Session 316 (findings C01 to C12 of its runner lens)

    def test_a_setup_failure_leaves_no_worktree_and_no_temp_dir(self):
        rc, out = self.run_runner([ONE], "--ref", "no-such-ref")
        self.assertEqual(rc, 2, out)
        self.assertEqual(self.leaked(), ([], 1))

    def test_a_timeout_kills_the_whole_process_tree(self):
        pidfile = os.path.join(self.tmp, "grandchild.pid")
        self.write("check.py", 'import os, subprocess, sys, time\nif "ALPHA" in open("src.txt").read():\n    p = subprocess.Popen(["sleep", "60"])\n    open(os.environ["PIDFILE"], "w").write(str(p.pid))\n    time.sleep(60)\nsys.exit(0)\n')
        self.commit("check.py")
        rc, out = self.run_runner([ONE], "--timeout", "3", env={"PIDFILE": pidfile})
        self.assertEqual(rc, 0, out)
        self.assertRegex(out, r"M1 alpha\s+KILLED \(timeout\)")
        with open(pidfile) as f:
            pid = int(f.read())
        self.addCleanup(lambda: os.path.exists("/proc") or subprocess.run(["kill", "-9", str(pid)], capture_output=True))
        for _ in range(40):
            if subprocess.run(["ps", "-p", str(pid), "-o", "stat="], capture_output=True, text=True).stdout.strip() in ("", "Z"):
                break
            time.sleep(0.25)
        else:
            self.fail(f"the grandchild {pid} outlived the runner's timeout")

    def test_a_mutant_whose_file_leaves_the_worktree_is_skipped_and_nothing_outside_changes(self):
        outside = os.path.join(self.tmp, "outside.txt")
        with open(outside, "w") as f:
            f.write("alpha\n")
        os.makedirs(os.path.join(self.repo, "node_modules", "dep"))
        with open(os.path.join(self.repo, "node_modules", "dep", "x.txt"), "w") as f:
            f.write("alpha\n")
        os.symlink(outside, os.path.join(self.repo, "link.txt"))
        self.write("check.py", 'import os, sys\nok = open(os.environ["MAIN_SRC"]).read() == "alpha\\nbeta\\nbeta\\n" and open(os.environ["OUTSIDE"]).read() == "alpha\\n" and open(os.environ["MAIN_DEP"]).read() == "alpha\\n"\nsys.exit(0 if ok else 1)\n')
        self.commit("check.py", "link.txt")
        env = {"MAIN_SRC": os.path.join(self.repo, "src.txt"), "OUTSIDE": outside, "MAIN_DEP": os.path.join(self.repo, "node_modules", "dep", "x.txt")}
        for file in (os.path.join(self.repo, "src.txt"), "../../outside.txt", "link.txt", "node_modules/dep/x.txt"):
            rc, out = self.run_runner([dict(ONE, file=file)], env=env)
            self.assertEqual(rc, 4, f"{file}: {out}")
            self.assertIn("SKIPPED (", out, file)
            self.assertNotIn("KILLED", out, file)
            self.assertEqual(self.leaked(), (["outside.txt"], 1))  # the file this test put there, and no leaked worktree

    def test_a_named_linked_worktree_is_used_as_it_stands_and_left_in_place(self):
        lw = os.path.join(self.tmp, "lw")
        git(self.repo, "worktree", "add", "--detach", lw, "HEAD")
        with open(os.path.join(lw, "check.py"), "a") as f:
            f.write("# MY UNCOMMITTED WORK\n")
        rc, out = self.run_runner([ONE], "--worktree", lw, "--tests", "check.py")
        self.assertEqual(rc, 0, out)
        self.assertRegex(out, r"M1 alpha\s+KILLED")
        with open(os.path.join(lw, "check.py")) as f:
            self.assertIn("# MY UNCOMMITTED WORK", f.read())  # --tests is NOT copied over a named worktree
        with open(os.path.join(lw, "src.txt")) as f:
            self.assertEqual(f.read(), "alpha\nbeta\nbeta\n")  # the mutated file is restored
        self.assertTrue(os.path.isdir(lw))
        self.assertIn("worktree after the run: clean", out)  # its own uncommitted edit is not the run's doing

    def test_a_named_worktree_with_ref_or_inside_a_primary_clone_is_refused(self):
        lw = os.path.join(self.tmp, "lw")
        git(self.repo, "worktree", "add", "--detach", lw, "HEAD")
        rc, out = self.run_runner([ONE], "--worktree", lw, "--ref", "HEAD")
        self.assertEqual(rc, 2, out)
        os.makedirs(os.path.join(self.repo, "sub"))
        rc, out = self.run_runner([ONE], "--worktree", os.path.join(self.repo, "sub"))
        self.assertEqual(rc, 2, out)
        self.assertEqual(self.read("src.txt"), "alpha\nbeta\nbeta\n")

    def test_a_modified_committed_test_file_is_not_reported_dirty_but_a_stray_write_is(self):
        self.write("check.py", CHECK + "# edited and not committed\n")
        rc, out = self.run_runner([ONE], "--tests", "check.py", cmd="python3")
        self.assertEqual(rc, 0, out)
        self.assertIn("worktree after the run: clean", out)
        self.write("check.py", CHECK)
        rc, out = self.run_runner([dict(ONE, expect="survives")], cmd="python3 -c \"open('src.txt', 'a').write('x')\"")
        self.assertEqual(rc, 0, out)
        self.assertIn("worktree after the run: DIRTY", out)

    def test_a_failing_test_is_titled_once_and_unittest_style_lines_count(self):
        env = self.fake_vitest('if grep -q ALPHA src.txt; then echo " \u00d7 suite > a row title 3ms"; echo " FAIL  test/unit/x.test.ts > suite > a row title"; echo "      Tests  1 failed | 5 passed (6)"; exit 1; fi\necho "      Tests  6 passed (6)"\n')
        rc, out = self.run_runner([ONE], cmd=None, env=env)
        self.assertEqual(rc, 0, out)
        self.assertEqual(out.count("a row title"), 1, out)
        self.write("check.py", 'import sys\nif "ALPHA" in open("src.txt").read():\n    print("FAIL: test_x (mod.Class)")\n    sys.exit(1)\n')
        self.commit("check.py")
        rc, out = self.run_runner([ONE])
        self.assertEqual(rc, 0, out)
        self.assertIn("FAIL: test_x (mod.Class)", out)

    def test_an_unexpected_failure_exits_6_with_a_message_and_cleans_up(self):
        rc, out = self.run_runner([ONE], cmd="no-such-prog-xyz")
        self.assertEqual(rc, 6, out)
        self.assertIn("internal error", out)
        self.assertNotIn("Traceback", out)
        self.assertEqual(self.leaked(), ([], 1))

    def test_a_source_file_that_is_not_utf8_is_skipped_and_output_that_is_not_utf8_is_read(self):
        with open(os.path.join(self.repo, "bin.txt"), "wb") as f:
            f.write(b"\xff\xfe alpha\n")
        self.commit("bin.txt")
        rc, out = self.run_runner([dict(ONE, file="bin.txt")])
        self.assertEqual(rc, 4, out)
        self.assertIn("SKIPPED (", out)
        rc, out = self.run_runner([ONE], cmd="python3 -c \"import sys; sys.stdout.buffer.write(bytes([233, 255])); sys.exit(1 if 'ALPHA' in open('src.txt').read() else 0)\"")
        self.assertEqual(rc, 0, out)
        self.assertRegex(out, r"M1 alpha\s+KILLED")

    def test_sigterm_stops_the_run_and_cleans_up(self):
        pidfile = os.path.join(self.tmp, "child.pid")
        p = subprocess.Popen(self.argv([ONE], cmd="sh -c 'echo $$ > \"$PIDFILE\"; exec sleep 60'"), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env={**os.environ, "TMPDIR": self.tmp, "PIDFILE": pidfile})
        for _ in range(60):  # wait until the test command is running
            if os.path.exists(pidfile) and open(pidfile).read().strip():
                break
            time.sleep(0.25)
        with open(pidfile) as f:
            pid = int(f.read())
        self.addCleanup(lambda: subprocess.run(["kill", "-9", str(pid)], capture_output=True))
        p.send_signal(signal.SIGTERM)
        out, _ = p.communicate(timeout=60)
        self.assertEqual(p.returncode, 143, out)
        self.assertEqual(self.leaked(), (["child.pid"], 1))
        for _ in range(40):
            if subprocess.run(["ps", "-p", str(pid), "-o", "stat="], capture_output=True, text=True).stdout.strip() in ("", "Z"):
                break
            time.sleep(0.25)
        else:
            self.fail(f"the test command {pid} outlived the runner's SIGTERM")

    def test_overlapping_occurrences_count_as_repeats(self):
        self.write("ov.txt", "aaa\n")
        self.commit("ov.txt")
        rc, out = self.run_runner([dict(ONE, file="ov.txt", **{"from": "aa", "to": "bb"})])
        self.assertEqual(rc, 4, out)
        self.assertIn("SKIPPED (pattern occurs 2 times)", out)

    def test_a_skipped_mutant_outranks_a_contradicted_expectation_in_the_exit_code(self):
        rc, out = self.run_runner([dict(ONE, expect="survives"), dict(ONE, name="M3 gamma", **{"from": "gamma"})])
        self.assertEqual(rc, 4, out)
        self.assertIn("EXPECTED survives", out)


if __name__ == "__main__":
    unittest.main(verbosity=2)
