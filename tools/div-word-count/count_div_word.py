#!/usr/bin/env python3
"""Count what the OLD bare-word test of a fenced div accepted, for the oracle of Session 338, without a regular expression and without any code of the TypeScript.

`test/unit/div-word-equivalence.test.ts` pins how many strings of each enumeration the old pattern `/^[\\p{L}\\p{N}_-]+$/u` accepted (`ACCEPTED`). Those numbers must not come from the code
under test, or a comparison could pass by both being wrong the same way. This script derives them from the DEFINITION of the grammar -- a string is a bare word when it is not empty and
every code point of it is a letter (Unicode category L*), a number (category N*), an underscore or a dash -- by a loop over the code points, using Python's `unicodedata` for the letter
and number kinds and no `re` at all.

    python3 -I tools/div-word-count/count_div_word.py              # all five counts, about 5 seconds
    python3 -I tools/div-word-count/count_div_word.py "D1 len 7"   # one of them

JavaScript strings are UTF-16: an alphabet member may be one code unit, a lone surrogate, or two code units that pair, and two members that sit side by side can pair (a high
surrogate then a low one is ONE astral letter in JavaScript and two code points in a Python `str`). So every string is built as a list of 16-bit code units and decoded into code
points by hand, exactly as a `u`-flag regular expression reads it: a high surrogate followed by a low one is one code point, any other surrogate stands alone and is neither a letter nor a number.

The seeded count reproduces the test's generator: Mulberry32 (`seededRandom` of `test/unit/support/regex-equivalence.ts`) seeded with 338, then the same piece list and draws as the
'100,000 seeded words' row. The ASCII sweep reproduces `everyAsciiEdit` of the test: each ASCII code unit put at every place of four heads, and in place of each of their characters. If the test's
alphabets, pieces, heads or seed change, change them here too, and compare the lines this prints with the `ACCEPTED` constant.
Do NOT use it for the sweep of every code unit: that count depends on the Unicode version (Node 22.23 has 17.0, `unicodedata` of Python 3.9 has 13.0), which is why the test only bounds it.
"""
import itertools
import sys
import unicodedata


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


def is_member(cp):
    """A letter, a number, `_` or `-`. A surrogate that stands alone has category Cs, so it is none."""
    if cp in (0x5F, 0x2D):
        return True
    category = unicodedata.category(chr(cp))
    return category.startswith("L") or category.startswith("N")


def accepts(units):
    """True when the string is one or more members and nothing else."""
    points = code_points(units)
    return len(points) > 0 and all(is_member(cp) for cp in points)


# The alphabets of the exhaustive rows of the test, as lists of code units. D2 and D3 hold a lone high and a lone low surrogate (0xD835, 0xDC00) that PAIR when they sit side by side
# into U+1D400, MATHEMATICAL BOLD CAPITAL A, a letter that takes two code units.
ALPHABETS = {
    "D1 len 7": ([utf16(c) for c in ["a", "9", "_", "-", ":", ".", " "]], 7),
    "D2 len 6": ([utf16(c) for c in ["-", "_", ".", "é", "中", "\ud835", "\udc00", "²", "٣"]], 6),
    "D3 len 7": ([utf16(c) for c in ["a", "\n", " ", "\ud835", "\udc00", " "]], 7),
}
SEEDED_PIECES = [
    "a", "a", "a", "Zz", "9", "09", "_", "-", "-", ":", ".", " ", "é", "中", "\U0001d400", "\U0001f600", "\ud835", "\udc00", "²", "٣", "\n",
]
SEEDED_STRINGS = 100_000
SEED = 338
ASCII_HEADS = ["ab-c_9", "a", "-", "\U0001d400"]

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


def count_ascii_sweep():
    """Each of the 128 ASCII code units put at every place of each head (before, between and after its code units) and in place of each of its code units."""
    total = accepted = 0
    for head in ASCII_HEADS:
        units = utf16(head)
        for at in range(len(units) + 1):
            for unit in range(128):
                inserted = units[:at] + [unit] + units[at:]
                total += 1
                accepted += accepts(inserted)
                if at < len(units):
                    replaced = units[:at] + [unit] + units[at + 1:]
                    total += 1
                    accepted += accepts(replaced)
    return total, accepted


def main(argv):
    names = [*ALPHABETS, "seeded", "ascii sweep"]
    wanted = argv or names
    for name in wanted:
        if name == "seeded":
            total, accepted = count_seeded()
        elif name == "ascii sweep":
            total, accepted = count_ascii_sweep()
        elif name in ALPHABETS:
            alphabet, max_length = ALPHABETS[name]
            total, accepted = count_enumeration(alphabet, max_length)
        else:
            print(f"unknown count {name!r}; choose from {names}", file=sys.stderr)
            return 2
        print(f"{name}: strings={total} accepted={accepted}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
