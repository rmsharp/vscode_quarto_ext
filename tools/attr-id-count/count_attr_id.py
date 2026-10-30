#!/usr/bin/env python3
"""Recount the pinned rows of `test/unit/attr-id-run-equivalence.test.ts` from the DEFINITION of an attribute id, without a regular expression and without any code of the TypeScript (Session 338).

The test keeps two OLD patterns of `src/core/qmd/model.ts` as oracles for two index loops:

    ATTR_ID_ALL          /#([\\p{L}\\p{N}_:.-]+)/gu                       every `#` and the identifier characters right after it, left to right        -> attributeIds
    ATTR_ATOM_COMMONMARK /^(?:#[\\p{L}\\p{N}_:.-]+|\\.[\\p{L}\\p{N}_:-]+)$/u    the whole token is `#` and identifier characters, or `.` and the same without the dot   -> commonmarkAttributeAtom

and it pins, for each enumeration, how many strings were read (`strings`), how many held at least one id (`withIds`), how many ids there were in all (`ids`) and how many strings the commonmark atom
accepted (`atoms`). Those numbers must not come from the code under test, or a comparison could pass by both being wrong the same way. This script derives them from the rule, in a different shape
from the loops: an id is a MAXIMAL run of identifier characters (a Unicode letter or number, `_`, `:`, `.`, `-`) whose first character has a `#` right before it; the atom is a first character `#`
followed by one or more identifier characters, or a first character `.` followed by one or more of them that are no `.`. It decodes the UTF-16 code units by hand (a high surrogate followed by a low one is
ONE code point, as a `u`-flag pattern reads it; a lone surrogate is a code point that is neither a letter nor a number) and asks Python's `unicodedata` for the kinds.

    python3 -I tools/attr-id-count/count_attr_id.py                 # every count, about 30 seconds
    python3 -I tools/attr-id-count/count_attr_id.py "D1 len 7"      # one of them

The sweep of ASCII code units (`sweep ascii`) puts each of the 128 ASCII code units at every place of the heads the test names (inserted at each index, and in place of each character) and counts the same four
things: the test pins that half exactly. The non-ASCII half depends on the Unicode version (Node 22.23 knows 17.0, `unicodedata` of Python 3.9 knows 13.0), which is why the test only compares it with the old pattern.

The seeded count reproduces the test's generator: Mulberry32 (`seededRandom` of `test/unit/support/regex-equivalence.ts`) seeded with 338, then the same piece list and draws as the '100,000 seeded tokens' row.
If the test's alphabets, lengths, heads, pieces or seed change, change them here too and compare what this prints with the `COUNTS` constant.
"""
import itertools
import sys
import unicodedata

MASK = 0xFFFFFFFF


def code_points(units):
    """Decode a list of UTF-16 code units the way a `u`-flag pattern reads it."""
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
    """The code units of a Python string (an astral character becomes a pair; a lone surrogate stays one unit)."""
    units = []
    for ch in text:
        cp = ord(ch)
        if cp >= 0x10000:
            cp -= 0x10000
            units.extend([0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF)])
        else:
            units.append(cp)
    return units


def is_letter_or_number(cp):
    if 0xD800 <= cp <= 0xDFFF:
        return False  # a lone surrogate half
    return unicodedata.category(chr(cp))[0] in ("L", "N")


def is_identifier(cp):
    return is_letter_or_number(cp) or cp in (0x5F, 0x3A, 0x2E, 0x2D)  # _ : . -


def is_class_character(cp):
    return is_letter_or_number(cp) or cp in (0x5F, 0x3A, 0x2D)  # _ : -   (no dot)


def ids_of(units):
    """The ids: each maximal run of identifier characters whose first character has a `#` right before it."""
    s = code_points(units)
    n = len(s)
    found = 0
    i = 0
    while i < n:
        if not is_identifier(s[i]):
            i += 1
            continue
        j = i
        while j < n and is_identifier(s[j]):
            j += 1
        if i > 0 and s[i - 1] == 0x23:
            found += 1
        i = j
    return found


def atom(units):
    """The commonmark atom: `#` and one or more identifier characters, or `.` and one or more identifier characters that are no `.`."""
    s = code_points(units)
    if len(s) < 2:
        return False
    if s[0] == 0x23:
        return all(is_identifier(c) for c in s[1:])
    if s[0] == 0x2E:
        return all(is_class_character(c) for c in s[1:])
    return False


class Totals:
    def __init__(self):
        self.strings = self.with_ids = self.ids = self.atoms = 0

    def add(self, units):
        self.strings += 1
        k = ids_of(units)
        if k > 0:
            self.with_ids += 1
        self.ids += k
        if atom(units):
            self.atoms += 1

    def line(self, name):
        return f"{name}: strings={self.strings} withIds={self.with_ids} ids={self.ids} atoms={self.atoms}"


# The alphabets of the exhaustive rows, as lists of code units. D2 and D3 hold a lone high and a lone low surrogate (0xD835, 0xDC00) that PAIR when they sit side by side into U+1D400,
# MATHEMATICAL BOLD CAPITAL A, a letter that takes two code units; D2 also holds the emoji U+1F600, two code units that are neither a letter nor a number.
ALPHABETS = {
    "D1 len 7": ([utf16(c) for c in ["#", "a", "_", ":", ".", "-", "!"]], 7),
    "D2 len 6": ([utf16(c) for c in ["#", ".", "-", "é", "\ud835", "\udc00", "²", "٣", "\U0001f600"]], 6),
    "D3 len 8": ([utf16(c) for c in ["#", "a", "-", "\ud835", "\udc00"]], 8),
}
SEEDED_PIECES = [
    "#a", "#a", "#b1", "#", "#é", "#", "-", ".", ".a", "!", "a", "_", ":", "\ud835", "\udc00", "\U0001d400", "#\U0001d400", ".\U0001d400", "中", "#中",
]
SEEDED_STRINGS = 100_000
SEED = 338
# The heads of the sweep: a code unit at each place of each. The test runs the id heads through `attributeIds` and the atom heads through `commonmarkAttributeAtom`, but the count here is over BOTH kinds of
# head for both questions, so that a head's contribution is stated once.
SWEEP_ID_HEADS = ["#ab#cd", "a#b", "#"]
SWEEP_ATOM_HEADS = [".a-b_c", "#a.b:c", "#", "."]


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
    totals = Totals()
    for length in range(0, max_length + 1):
        for members in itertools.product(alphabet, repeat=length):
            totals.add([u for member in members for u in member])
    return totals


def count_seeded():
    random = seeded_random(SEED)
    pieces = [utf16(p) for p in SEEDED_PIECES]
    totals = Totals()
    for _ in range(SEEDED_STRINGS):
        count = int(random() * 13)
        units = []
        for _ in range(count):
            units.extend(pieces[int(random() * len(pieces))])
        totals.add(units)
    return totals


def count_sweep_ascii(heads):
    """Every ASCII code unit inserted at each index of each head, and put in place of each character of it."""
    totals = Totals()
    for head in heads:
        units = utf16(head)
        for at in range(len(units) + 1):
            for unit in range(128):
                totals.add(units[:at] + [unit] + units[at:])
                if at < len(units):
                    totals.add(units[:at] + [unit] + units[at + 1 :])
    return totals


def main(argv):
    wanted = argv or [*ALPHABETS, "seeded", "sweep ascii ids", "sweep ascii atoms"]
    for name in wanted:
        if name == "seeded":
            totals = count_seeded()
        elif name == "sweep ascii ids":
            totals = count_sweep_ascii(SWEEP_ID_HEADS)
        elif name == "sweep ascii atoms":
            totals = count_sweep_ascii(SWEEP_ATOM_HEADS)
        elif name in ALPHABETS:
            alphabet, max_length = ALPHABETS[name]
            totals = count_enumeration(alphabet, max_length)
        else:
            print(f"unknown count {name!r}; choose from {[*ALPHABETS, 'seeded', 'sweep ascii ids', 'sweep ascii atoms']}", file=sys.stderr)
            return 2
        print(totals.line(name), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
