#!/usr/bin/env python3
"""Count what the OLD `ATTR_ATOM_RUN` accepted, for the id-run oracle of Session 337, without a regular expression and without any code of the TypeScript.

`test/unit/attr-atom-id-run-equivalence.test.ts` pins how many strings of each enumeration the old pattern accepts (`ACCEPTED`). Those numbers must not come from the code
under test, or a comparison could pass by both being wrong the same way. This script derives them from the grammar of the ORIGINAL spelling (Session 324's alternation: one or
more atoms, `-`, or `#` and one or more identifier characters, or `.` and a letter and any identifier characters) by a memoised parse over every start position, a different
algorithm from the single pass of `attributeAtomRun`, using Python's `unicodedata` for the letter and number kinds and no `re` at all.

    python3 -I tools/attr-atom-count/count_id_run.py              # all four counts, about 10 seconds
    python3 -I tools/attr-atom-count/count_id_run.py "D1 len 8"   # one of them

JavaScript strings are UTF-16: an alphabet member may be one code unit, a lone surrogate, or two code units that pair, and two members that sit side by side can pair (a high
surrogate then a low one is ONE astral letter in JavaScript and two code points in a Python `str`). So every string is built as a list of 16-bit code units and decoded into code
points by hand, exactly as a `u`-flag regular expression reads it: a high surrogate followed by a low one is one code point, any other surrogate stands alone and is neither a letter nor a number.

The seeded count reproduces the test's generator: Mulberry32 (`seededRandom` of `test/unit/support/regex-equivalence.ts`) seeded with 337, then the same piece list and draws as
the '100,000 seeded tokens' row. If the test's alphabets, pieces or seed change, change them here too, and compare the four lines this prints with the `ACCEPTED` constant.
Do NOT use it for the sweep of every code unit: that count depends on the Unicode version (Node 22.23 has 17.0, `unicodedata` of Python 3.9 has 13.0), which is why the test only bounds it.
"""
import itertools
import sys
import unicodedata
from functools import lru_cache


def code_points(units):
    """Decode a list of UTF-16 code units the way a `u`-flag pattern reads a string."""
    points = []
    i = 0
    while i < len(units):
        u = units[i]
        if 0xD800 <= u <= 0xDBFF and i + 1 < len(units) and 0xDC00 <= units[i + 1] <= 0xDFFF:
            points.append(0x10000 + ((u - 0xD800) << 10) + (units[i + 1] - 0xDC00))
            i += 2
        else:
            points.append(u)
            i += 1
    return points


def utf16(text):
    """The code units of a Python string (astral characters become a pair; a lone surrogate stays one unit)."""
    units = []
    for ch in text:
        cp = ord(ch)
        if cp >= 0x10000:
            cp -= 0x10000
            units.extend([0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF)])
        else:
            units.append(cp)
    return units


def is_letter(cp):
    return unicodedata.category(chr(cp)).startswith("L")


def is_number(cp):
    return unicodedata.category(chr(cp)).startswith("N")


def is_ident(cp):
    return is_letter(cp) or is_number(cp) or cp in (0x5F, 0x3A, 0x2E, 0x2D)  # _ : . -


def accepts(units):
    """True when the string is one or more atoms: `-`, `#` I+, or `.` L I*, with I = letter, number, `_`, `:`, `.`, `-`."""
    s = code_points(units)
    n = len(s)
    if n == 0:
        return False

    @lru_cache(maxsize=None)
    def parse(i):
        if i == n:
            return True
        c = s[i]
        if c == 0x2D and parse(i + 1):  # -
            return True
        if c == 0x23:  # #
            j = i + 1
            while j < n and is_ident(s[j]):
                j += 1
                if parse(j):
                    return True
        if c == 0x2E and i + 1 < n and is_letter(s[i + 1]):  # . then a letter
            j = i + 2
            if parse(j):
                return True
            while j < n and is_ident(s[j]):
                j += 1
                if parse(j):
                    return True
        return False

    return parse(0)


# The alphabets of the exhaustive rows of the test, as lists of code units. D2 and D3 hold a lone high and a lone low surrogate (0xD835, 0xDC00) that PAIR when they sit side by side
# into U+1D400, MATHEMATICAL BOLD CAPITAL A, a letter that takes two code units.
ALPHABETS = {
    "D1 len 8": ([utf16(c) for c in ["#", "a", "1", "-", ".", "!"]], 8),
    "D2 len 6": ([utf16(c) for c in ["-", "#", ".", "é", "\ud835", "\udc00", "²", "٣"]], 6),
    "D3 len 7": ([utf16(c) for c in ["-", "#", ".", "a", "\ud835", "\udc00"]], 7),
}
SEEDED_PIECES = [
    "#a", "#a", "#a", "#b1", "#", "#é", "-", "-", ".A", ".", "!", "a", "_", ":", ".1", "\ud835", "\udc00", "\U0001d400", "#\U0001d400", ".\U0001d400",
]
SEEDED_STRINGS = 100_000
SEED = 337

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
        for members in itertools.product(alphabet, repeat=length):
            total += 1
            units = [u for member in members for u in member]
            if accepts(units):
                accepted += 1
    return total, accepted


def count_seeded():
    random = seeded_random(SEED)
    pieces = [utf16(p) for p in SEEDED_PIECES]
    accepted = 0
    for _ in range(SEEDED_STRINGS):
        count = int(random() * 13)
        units = []
        for _ in range(count):
            units.extend(pieces[int(random() * len(pieces))])
        if accepts(units):
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
