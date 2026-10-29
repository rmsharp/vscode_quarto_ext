#!/usr/bin/env python3
# Recount of the pinned counts of test/unit/grid-plain-border-equivalence.test.ts (Session 337).
# usage: python3 -I tools/grid-plain-border-count/count_border.py tiny|blanks|wide|sweep
# Run it with `python3 -I`; the tools/ directory is not packaged (.vscodeignore).
# Session 337 ran it and compared its output with the pinned counts of the test named above (accepted counts 6,764 / 1,672 / 74 / 54): all equal. The strings totals are computed by the test from its alphabets.
# An independent Python 3 port of the DEFINITION of GRID_PLAIN_BORDER (no code shared with the TypeScript).
# Definition: the line is `+`, then one or more cells (a run of one or more `-` and then a `+`), then spaces and tabs to the end.
import itertools
import re
import sys

NBSP = " "


def border_by_cells(line: str) -> bool:
    """Walk the line cell by cell."""
    if not line.startswith("+"):
        return False
    at = 1
    cells = 0
    n = len(line)
    while at < n and line[at] == "-":
        while at < n and line[at] == "-":
            at += 1
        if at >= n or line[at] != "+":
            return False
        at += 1
        cells += 1
    if cells == 0:
        return False
    return all(ch in " \t" for ch in line[at:])


# The old pattern ported with re.fullmatch (Python's `$` also matches before a final newline; fullmatch does not).
OLD = re.compile(r"\+(?:-+\+)+[ \t]*")


def border_by_regex(line: str) -> bool:
    return OLD.fullmatch(line) is not None


def border(line: str) -> bool:
    a = border_by_cells(line)
    b = border_by_regex(line)
    if a != b:
        print("PORT DISAGREES", repr(line), a, b)
        sys.exit(1)
    return a


def enumerate_count(alphabet, max_length):
    total = 0
    accepted = 0
    for length in range(0, max_length + 1):
        for tup in itertools.product(alphabet, repeat=length):
            total += 1
            if border("".join(tup)):
                accepted += 1
    return total, accepted


def sweep(heads):
    total = 0
    accepted = 0
    for head in heads:
        for at in range(len(head) + 1):
            for unit in range(0x10000):
                c = chr(unit)
                total += 1
                accepted += border(head[:at] + c + head[at:])
                if at < len(head):
                    total += 1
                    accepted += border(head[:at] + c + head[at + 1:])
    return total, accepted


if __name__ == "__main__":
    which = sys.argv[1]
    if which == "tiny":
        print("tiny", enumerate_count(["+", "-"], 20))
    elif which == "blanks":
        print("blanks", enumerate_count(["+", "-", " ", "\t"], 11))
    elif which == "wide":
        print("wide", enumerate_count(["+", "-", " ", "\t", "=", "x", "\n", NBSP], 7))
    elif which == "sweep":
        heads = ["+-+", "+--+-+ ", "+-+\t", "+-+-+", "+-", "+", "-+", "+ -+", "+--+x"]
        print("sweep", sweep(heads))
