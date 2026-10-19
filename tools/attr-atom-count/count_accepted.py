#!/usr/bin/env python3
"""Count what the OLD `ATTR_ATOM_RUN` accepted, without a regular expression (Session 324).

`test/unit/attr-atom-run-equivalence.test.ts` pins how many strings of each enumeration the old pattern accepts (`ACCEPTED`). Those numbers must not come from the code under
test, or a comparison could pass by both patterns being wrong the same way. This script derives them from the grammar by a memoised parse over every start position (the
straightforward reading of the old pattern: `-`, or `#` and one or more identifier characters, or `.` and a letter and any identifier characters, one or more atoms),
using Python's `unicodedata` for the letter and number kinds and no `re` at all.

    python3 -I tools/attr-atom-count/count_accepted.py            # all four counts, about 10 seconds
    python3 -I tools/attr-atom-count/count_accepted.py "B len 9"  # one of them

The seeded count reproduces the test's generator: Mulberry32 from `test/unit/support/regex-equivalence.ts` seeded with 324, then the same piece list and draws as the
'100,000 seeded tokens' row. If the test's alphabets, pieces or seed change, change them here too, and compare the four lines this prints with the `ACCEPTED` constant.
Do NOT use it for the sweep of every code unit: that count depends on the Unicode version (Node 22.23 has 17.0, `unicodedata` of Python 3.9 has 13.0), which is why the test only bounds it.
"""
import itertools
import sys
import unicodedata
from functools import lru_cache


def is_letter(c):
    return unicodedata.category(c).startswith("L")


def is_number(c):
    return unicodedata.category(c).startswith("N")


def is_ident(c):
    return is_letter(c) or is_number(c) or c in "_:.-"


def accepts(s):
    """True when `s` is one or more atoms: `-`, `#` I+, or `.` L I*, with I = letter, number, `_`, `:`, `.`, `-`."""
    n = len(s)
    if n == 0:
        return False

    @lru_cache(maxsize=None)
    def parse(i):
        if i == n:
            return True
        c = s[i]
        if c == "-" and parse(i + 1):
            return True
        if c == "#":
            j = i + 1
            while j < n and is_ident(s[j]):
                j += 1
                if parse(j):
                    return True
        if c == "." and i + 1 < n and is_letter(s[i + 1]):
            j = i + 2
            if parse(j):
                return True
            while j < n and is_ident(s[j]):
                j += 1
                if parse(j):
                    return True
        return False

    return parse(0)


# The alphabets of the exhaustive rows of the test (ALPHABET_A, ALPHABET_B, ALPHABET_C), as code points.
ALPHABETS = {
    "A len 6": (["-", "#", ".", "A", "1", "_", ":", "!"], 6),
    "B len 9": ([".", "A", "-", "#", "!"], 9),
    "C len 6": (["-", "#", ".", "é", "\U0001d400", "²", "٣", "\U0001f600"], 6),
}
SEEDED_PIECES = ["-", "-", "#a", "#1", ".A", ".A", ".é", ".", "#", "!", "A", "_", ":", "\U0001d400", ".1", "x"]
SEEDED_STRINGS = 100_000
SEED = 324

MASK = 0xFFFFFFFF


def imul(a, b):
    return (a * b) & MASK


def seeded_random(seed):
    """Mulberry32, bit for bit the generator of `seededRandom` in the test support module."""
    state = [seed & MASK]

    def next_float():
        state[0] = (state[0] + 0x6D2B79F5) & MASK
        s = state[0]
        t = imul(s ^ (s >> 15), 1 | s)
        t = ((t + imul(t ^ (t >> 7), 61 | t)) ^ t) & MASK
        return ((t ^ (t >> 14)) & MASK) / 4294967296

    return next_float


def count_enumeration(alphabet, max_length):
    total = accepted = 0
    for length in range(0, max_length + 1):
        for chars in itertools.product(alphabet, repeat=length):
            total += 1
            if accepts("".join(chars)):
                accepted += 1
    return total, accepted


def count_seeded():
    random = seeded_random(SEED)
    accepted = 0
    for _ in range(SEEDED_STRINGS):
        pieces = int(random() * 13)
        token = "".join(SEEDED_PIECES[int(random() * len(SEEDED_PIECES))] for _ in range(pieces))
        if accepts(token):
            accepted += 1
    return SEEDED_STRINGS, accepted


def main(argv):
    wanted = argv or [*ALPHABETS, "seeded"]
    for name in wanted:
        if name == "seeded":
            total, accepted = count_seeded()
        elif name in ALPHABETS:
            alphabet, max_length = ALPHABETS[name]
            total, accepted = count_enumeration(alphabet, max_length)
        else:
            print(f"unknown count {name!r}; choose from {[*ALPHABETS, 'seeded']}", file=sys.stderr)
            return 2
        print(f"{name}: strings={total} accepted={accepted}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
