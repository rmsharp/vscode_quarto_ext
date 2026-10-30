#!/usr/bin/env python3
"""Count what the OLD first-slot reader and the OLD `HEADER_LABEL_ID` accepted, for the oracle of Session 338, without a regular expression and without any code of the TypeScript.

`test/unit/chunk-label-token-equivalence.test.ts` pins how many strings of each enumeration the old readers accept. Those numbers must not come from the code under test, or a comparison could pass by both
being wrong the same way. This script derives them from the grammar, with Python's `unicodedata` for the letter and number kinds and no `re` at all:

  * FIRST SLOT (`readChunkLabelToken(text, true)`): a text of two or more characters that starts with a quote, ends with the same quote and holds no quote and no backslash between is read as the string it
    spells (a QUOTED answer, offset 1); otherwise a text of one or more letters, numbers, `_`, `:`, `.` and `-` is the text written (a PLAIN answer, offset 0); anything else is refused.
  * HEADER LABEL (`HEADER_LABEL_ID`): `fig-` or `tbl-` and then one or more letters, numbers, `_`, `:`, `.` and `-`, and nothing else, answered with its kind.

    python3 -I tools/chunk-label-count/count_token.py            # every count, about 4 seconds
    python3 -I tools/chunk-label-count/count_token.py T1         # one of them

JavaScript strings are UTF-16: an alphabet member may be one code unit, a lone surrogate, or two code units that pair, and two members that sit side by side can pair (a high surrogate then a low one is ONE astral
letter in JavaScript and two code points in a Python `str`). So every string is built as a list of 16-bit code units and decoded into code points by hand, exactly as a `u`-flag regular expression reads it: a high
surrogate followed by a low one is one code point, any other surrogate stands alone and is neither a letter nor a number. (The quoted pattern has no `u` flag and reads code units; the characters it excludes are
ASCII, so the two readings agree on every string.)

The seeded counts reproduce the test's generator: Mulberry32 (`seededRandom` of `test/unit/support/regex-equivalence.ts`) seeded with 338 and 3381, then the same piece lists and draws as the seeded rows.
If the test's alphabets, pieces or seeds change, change them here too, and compare the lines this prints with the `COUNTS` constants.
Do NOT use it for the sweep of every code unit: that count depends on the Unicode version (Node 22.23 has 17.0, `unicodedata` of Python 3.9 has 13.0), which is why the test only bounds it.
"""
import itertools
import sys
import unicodedata


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
    return not (0xD800 <= cp <= 0xDFFF) and unicodedata.category(chr(cp)).startswith("L")


def is_number(cp):
    return not (0xD800 <= cp <= 0xDFFF) and unicodedata.category(chr(cp)).startswith("N")


def is_identifier(cp):
    return is_letter(cp) or is_number(cp) or cp in (0x5F, 0x3A, 0x2E, 0x2D)  # _ : . -


def first_slot(units):
    """'quoted', 'plain' or None."""
    p = code_points(units)
    if len(p) >= 2 and p[0] in (0x22, 0x27) and p[-1] == p[0] and all(c not in (0x22, 0x27, 0x5C) for c in p[1:-1]):
        return "quoted"
    if len(p) >= 1 and all(is_identifier(c) for c in p):
        return "plain"
    return None


def header_kind(units):
    """'fig', 'tbl' or None."""
    p = code_points(units)
    for kind, prefix in (("fig", [0x66, 0x69, 0x67, 0x2D]), ("tbl", [0x74, 0x62, 0x6C, 0x2D])):
        if p[:4] == prefix and len(p) >= 5 and all(is_identifier(c) for c in p[4:]):
            return kind
    return None


# The alphabets and lengths of the exhaustive rows of the test, as lists of code units (a member may be several characters). T3 and K1 hold a lone high and a lone low surrogate (0xD835, 0xDC00) that PAIR
# when they sit side by side into U+1D400, MATHEMATICAL BOLD CAPITAL A, a letter that takes two code units.
FIRST = {
    "T1": ([utf16(c) for c in ["a", "1", "_", ":", ".", "-", " ", "$"]], 6),
    "T2": ([utf16(c) for c in ['"', "'", "\\", "a", "-", ":"]], 6),
    "T3": ([utf16(c) for c in ["a", "é", "\ud835", "\udc00", "²", "٣", "-", "$"]], 6),
}
HEADER = {
    "K1": ([utf16(c) for c in ["fig-", "tbl-", "fig", "tbl", "-", "a", ":", "$", "é", "\ud835", "\udc00"]], 5),
    "K2": ([utf16(c) for c in ["f", "t", "i", "b", "g", "l", "-", "a"]], 6),
}
SEEDED_FIRST_PIECES = ["a", "fig-x", "1", "_", ":", ".", "-", " ", '"', "'", "\\", "$", "é", "\U0001d400", "\ud835", "\udc00", "²", "٣", "a:b", "tbl-"]
SEEDED_HEADER_PIECES = ["fig-", "tbl-", "fig", "tbl", "-", "a", "x1", ":", ".", "_", "$", " ", "é", "\U0001d400", "\ud835", "\udc00", "²"]
SEEDED_STRINGS = 100_000
SEED_FIRST = 338
SEED_HEADER = 3381

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


def enumeration(alphabet, max_length):
    for length in range(0, max_length + 1):
        for members in itertools.product(alphabet, repeat=length):
            yield [u for member in members for u in member]


def seeded(pieces_text, seed):
    random = seeded_random(seed)
    pieces = [utf16(p) for p in pieces_text]
    for _ in range(SEEDED_STRINGS):
        count = int(random() * 13)
        units = []
        for _ in range(count):
            units.extend(pieces[int(random() * len(pieces))])
        yield units


def tally(strings, reader, answers):
    total = 0
    counts = {answer: 0 for answer in answers}
    for units in strings:
        total += 1
        answer = reader(units)
        if answer is not None:
            counts[answer] += 1
    return total, counts


def run(name):
    if name in FIRST:
        alphabet, max_length = FIRST[name]
        return tally(enumeration(alphabet, max_length), first_slot, ["quoted", "plain"])
    if name in HEADER:
        alphabet, max_length = HEADER[name]
        return tally(enumeration(alphabet, max_length), header_kind, ["fig", "tbl"])
    if name == "seeded-first":
        return tally(seeded(SEEDED_FIRST_PIECES, SEED_FIRST), first_slot, ["quoted", "plain"])
    if name == "seeded-header":
        return tally(seeded(SEEDED_HEADER_PIECES, SEED_HEADER), header_kind, ["fig", "tbl"])
    return None


def main(argv):
    wanted = argv or [*FIRST, *HEADER, "seeded-first", "seeded-header"]
    for name in wanted:
        result = run(name)
        if result is None:
            print(f"unknown count {name!r}; choose from {[*FIRST, *HEADER, 'seeded-first', 'seeded-header']}", file=sys.stderr)
            return 2
        total, counts = result
        print(f"{name}: strings={total} " + " ".join(f"{k}={v}" for k, v in counts.items()), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
