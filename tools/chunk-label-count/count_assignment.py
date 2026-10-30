#!/usr/bin/env python3
"""Count what the OLD argument pattern of `knitrChunkHeaderLabel` accepted, for the oracle of Session 338, without a regular expression and without any code of the TypeScript.

`test/unit/knitr-header-assignment-equivalence.test.ts` pins how many strings of each enumeration the old pattern accepts, how many of those have a quoted name (group 3 set) and how many have a
value (group 5 set). Those numbers must not come from the code under test, or a comparison could pass by both being wrong the same way. The pattern was

    /^([ \\t]*(?:([\\p{L}.][\\p{L}\\p{N}._]*)|(["'])([^"'\\\\]*)\\3)[ \\t]*=(?!=)[ \\t]*)([^ \\t](?:[\\s\\S]*[^ \\t])?)?[ \\t]*$/u

and this script derives the counts from its GRAMMAR by listing EVERY way to cut the string into the parts of the pattern (leading blanks, a name, blanks, an equals sign that no equals sign follows, blanks, an
optional value that starts and ends with a non-blank, blanks), a different algorithm from the single pass of the TypeScript cure. The grammar is unambiguous: a string that parses has exactly one cut, and this
script stops with an error if it ever finds two (a count that depended on which one the pattern's backtracking took would not be a count). Python's `unicodedata` gives the letter and number kinds, and no `re` is used.

    python3 -I tools/chunk-label-count/count_assignment.py            # every count, about 4 seconds
    python3 -I tools/chunk-label-count/count_assignment.py E1         # one of them

JavaScript strings are UTF-16: an alphabet member may be one code unit, a lone surrogate, or two code units that pair, and two members that sit side by side can pair (a high surrogate then a low one is ONE astral
letter in JavaScript and two code points in a Python `str`). So every string is built as a list of 16-bit code units and decoded into code points by hand, exactly as a `u`-flag regular expression reads it: a high
surrogate followed by a low one is one code point, any other surrogate stands alone and is neither a letter nor a number.

The seeded count reproduces the test's generator: Mulberry32 (`seededRandom` of `test/unit/support/regex-equivalence.ts`) seeded with 338, then the same piece list and draws as the '100,000 seeded headers'
row. If the test's alphabets, pieces or seed change, change them here too, and compare the lines this prints with the `ACCEPTED` constant.
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


def is_blank(cp):
    return cp == 0x20 or cp == 0x09


def is_quote(cp):
    return cp == 0x22 or cp == 0x27


def parses(units):
    """Every way to cut the string into the parts of the pattern, as tuples of (name_kind, name_start, name_end, quoted_end, equals_at, value_start, value_end)."""
    p = code_points(units)
    n = len(p)
    found = set()
    for a in range(0, n + 1):  # the leading blanks are p[0:a]
        if a > 0 and not is_blank(p[a - 1]):
            break
        names = []  # (kind, end of the name including its closing quote)
        if a < n and (is_letter(p[a]) or p[a] == 0x2E):  # a bare name: a letter or a dot, then letters, numbers, dots, underscores
            for b in range(a + 1, n + 1):
                if b > a + 1 and not (is_letter(p[b - 1]) or is_number(p[b - 1]) or p[b - 1] == 0x2E or p[b - 1] == 0x5F):
                    break
                names.append(("bare", b))
        if a < n and is_quote(p[a]):  # a quoted name: the same quote closes it, and nothing between is a quote or a backslash
            for c in range(a + 1, n):
                if c > a + 1 and (is_quote(p[c - 1]) or p[c - 1] == 0x5C):
                    break
                if p[c] == p[a]:
                    names.append(("quoted", c + 1))
        for kind, end in names:
            for d in range(end, n + 1):  # blanks p[end:d], then the equals sign at d
                if d > end and not is_blank(p[d - 1]):
                    break
                if d < n and p[d] == 0x3D and not (d + 1 < n and p[d + 1] == 0x3D):
                    for e in range(d + 1, n + 1):  # blanks p[d+1:e], then the value
                        if e > d + 1 and not is_blank(p[e - 1]):
                            break
                        # No value: the blanks after the equals sign go to the group in front of the value (the pattern's blank run there is greedy), so they all do, up to the end.
                        if e == n:
                            found.add((kind, a, end, d, e, None))
                        if e < n and not is_blank(p[e]):
                            for f in range(e + 1, n + 1):
                                if not is_blank(p[f - 1]) and all(is_blank(c) for c in p[f:]):
                                    found.add((kind, a, end, d, e, f))
    return found


def read(units):
    """The groups the pattern would capture, as (accepted, quoted, valued), or None when the string is refused."""
    found = parses(units)
    if len(found) > 1:
        raise SystemExit(f"ambiguous: {units!r} has {len(found)} parses: {sorted(found, key=str)}")
    if not found:
        return None
    kind, _a, _end, _d, _e, f = next(iter(found))
    return (kind == "quoted", f is not None)


# The alphabets and lengths of the exhaustive rows of the test, as lists of code units. E3 holds a lone high and a lone low surrogate (0xD835, 0xDC00) that PAIR when they sit side by side into U+1D400,
# MATHEMATICAL BOLD CAPITAL A, a letter that takes two code units.
ALPHABETS = {
    "E1": ([utf16(c) for c in ["a", "1", ".", "_", "=", " "]], 7),
    "E2": ([utf16(c) for c in ['"', "'", "\\", "a", "=", " ", "\t"]], 6),
    "E3": ([utf16(c) for c in ["a", "é", "\ud835", "\udc00", "²", "1", "=", " "]], 6),
    "E4": ([utf16(c) for c in ["a", "=", " ", "\u00a0", "\n", "."]], 7),
}
SEEDED_PIECES = [
    "a", "label", "x.y", "1", " ", "  ", "\t", "=", "=", "==", '"', "'", "\\", "é", "\U0001d400", "\ud835", "\udc00", "²", "٣", "-", "_", "$", "\n", '"x"', "'y'", "fig-a", "\u00a0",
]
SEEDED_STRINGS = 100_000
SEED = 338

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


def tally(strings):
    total = accepted = quoted = valued = 0
    for units in strings:
        total += 1
        result = read(units)
        if result is not None:
            accepted += 1
            quoted += 1 if result[0] else 0
            valued += 1 if result[1] else 0
    return total, accepted, quoted, valued


def enumeration(alphabet, max_length):
    for length in range(0, max_length + 1):
        for members in itertools.product(alphabet, repeat=length):
            yield [u for member in members for u in member]


def seeded():
    random = seeded_random(SEED)
    pieces = [utf16(p) for p in SEEDED_PIECES]
    for _ in range(SEEDED_STRINGS):
        count = int(random() * 13)
        units = []
        for _ in range(count):
            units.extend(pieces[int(random() * len(pieces))])
        yield units


def main(argv):
    wanted = argv or [*ALPHABETS, "seeded"]
    for name in wanted:
        if name == "seeded":
            counts = tally(seeded())
        elif name in ALPHABETS:
            alphabet, max_length = ALPHABETS[name]
            counts = tally(enumeration(alphabet, max_length))
        else:
            print(f"unknown count {name!r}; choose from {[*ALPHABETS, 'seeded']}", file=sys.stderr)
            return 2
        print(f"{name}: strings={counts[0]} accepted={counts[1]} quoted={counts[2]} valued={counts[3]}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
