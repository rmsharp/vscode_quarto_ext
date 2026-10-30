#!/usr/bin/env python3
"""Recount the pinned numbers of `test/unit/label-value-equivalence.test.ts` from the DEFINITION of the two grammars, not from the project's code (Session 338, part C of the "Eleven more places" item).

The test keeps the two OLD patterns of `src/core/refs.ts` as its oracle (`CELL_LABEL_VALUE`, the value of a cell's `#| label:` option, and `NARROW_LABEL`, the id of a brace group that is no attribute block)
and pins, for each enumeration, how many strings the pattern accepts. Those numbers must not come from the code under test, or a comparison could pass by both being wrong the same way. This script shares no
code with the TypeScript and uses no regular expression at all: it derives them from the two rules the patterns state.

    cell value:  an optional opening quote (" or '), taken only when an identifier START follows it, then an identifier START, then any identifier characters;
                 the START is a letter, a number or `_`; the identifier characters are letters, numbers and `_ : . -`; the id is the longest such run (the pattern is not anchored at the end), and the
                 match is the quote (if taken) and the id. Nothing is accepted when no START stands where the id must begin: a quote followed by a non-START makes the whole value fail.
    narrow id:   `#`, then `fig`, `tbl`, `eq` or `lst`, then `-`, then ONE OR MORE identifier characters; the id is `fig-...` (everything after the `#`), the longest such run.

A string is a list of UTF-16 code units, as the `u`-flag pattern reads it: a high surrogate followed by a low one is ONE code point (an astral letter), any other surrogate stands alone and is neither a
letter nor a number. So every string below is built as a list of 16-bit code units and decoded into code points by hand.

    python3 -I tools/label-value-count/count_label_value.py              # every count, about 9 seconds
    python3 -I tools/label-value-count/count_label_value.py "cell A1"    # one of them

It prints one line per count: the label, the number of strings, how many are accepted, and (cell) how many consumed a quote, and the SUM of the id lengths in UTF-16 code units. Compare them with the
constants of the test (`CELL_COUNTS`, `NARROW_COUNTS`, `ASCII_SWEEP`).

⚠ Which characters are letters and numbers is the Unicode version of the interpreter (Python 3.10 knows Unicode 13, Node 22 knows 17). The alphabets below use only characters whose category is the same in
both (`a`, `é`, `²`, `٣`, the astral `𝐀`, a lone surrogate, an emoji, ASCII punctuation), and the sweep of every code unit pins only its ASCII half (units below 128) exactly: the test leaves the non-ASCII half
to the comparison with the old pattern alone.

The seeded counts reproduce the test's generator: Mulberry32 (`seededRandom` of `test/unit/support/regex-equivalence.ts`) seeded with 338, then the same piece lists and draws as the seeded rows. If the test's
alphabets, token lists, pieces, heads or seed change, change them here too.
"""
import itertools
import sys
import unicodedata

HIGH = 0xD835  # the first half of U+1D400, MATHEMATICAL BOLD CAPITAL A, a letter that takes two code units
LOW = 0xDC00  # the second half


def code_points(units):
    """Decode a list of UTF-16 code units the way a `u`-flag pattern reads a string: a pair is one code point, a lone surrogate stands alone. Returns (code point, width in code units) pairs."""
    points = []
    i = 0
    while i < len(units):
        u = units[i]
        if 0xD800 <= u <= 0xDBFF and i + 1 < len(units) and 0xDC00 <= units[i + 1] <= 0xDFFF:
            points.append((0x10000 + ((u - 0xD800) << 10) + (units[i + 1] - 0xDC00), 2))
            i += 2
        else:
            points.append((u, 1))
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


def is_start(cp):
    return is_letter(cp) or is_number(cp) or cp == 0x5F  # a letter, a number or _


def is_ident(cp):
    return is_start(cp) or cp in (0x3A, 0x2E, 0x2D)  # and : . -


def cell_value(units):
    """(accepted, quoted, id length in code units) of the cell-label value grammar; the match length is the quote and the id."""
    s = code_points(units)
    n = len(s)
    for taken in ((1, 0) if n > 0 and s[0][0] in (0x22, 0x27) else (0,)):
        if taken < n and is_start(s[taken][0]):
            end = taken
            while end < n and is_ident(s[end][0]):
                end += 1
            return True, taken == 1, sum(w for _, w in s[taken:end])
    return False, False, 0


KINDS = [[ord(c) for c in kind] for kind in ("fig", "tbl", "eq", "lst")]


def narrow_id(units):
    """(accepted, id length in code units) of the brace-group id grammar: `#`, a kind, `-`, one or more identifier characters; the id is everything after the `#`."""
    s = code_points(units)
    n = len(s)
    if n == 0 or s[0][0] != 0x23:
        return False, 0
    for kind in KINDS:
        k = 1 + len(kind)
        if [cp for cp, _ in s[1:k]] == kind and k < n and s[k][0] == 0x2D:
            end = k + 1
            if end < n and is_ident(s[end][0]):
                while end < n and is_ident(s[end][0]):
                    end += 1
                return True, sum(w for _, w in s[1:end])
    return False, 0


# ---- the enumerations of the test ----

CELL_ALPHABETS = {
    # A1: the quotes, the identifier classes and one character no identifier holds
    "cell A1": ([utf16(c) for c in ['"', "'", "a", "1", "_", ":", ".", "-", "$"]], 6),
    # A2: the Unicode kinds, with the two HALVES of an astral letter as members of their own
    "cell A2": ([utf16(c) for c in ['"', "'", "a", "-", "é", "\ud835", "\udc00", "²", "٣"]], 6),
}
NARROW_TOKENS = {
    # N1: the structural pieces of the grammar and its near misses, as tokens
    "narrow N1": ([utf16(c) for c in ["#", "fig-", "tbl-", "eq-", "lst-", "fig", "Fig-", "sec-", "a", "-", ".", "$"]], 5),
    # N2: the Unicode kinds after a kind prefix, as tokens
    "narrow N2": ([utf16(c) for c in ["#fig-", "#eq-", "a", "-", "é", "\ud835", "\udc00", "²", "٣", "."]], 6),
}

SEED = 338
SEEDED = 100_000
CELL_PIECES = ['"', "'", "a", "B", "1", "_", ":", ".", "-", "$", " ", "é", "\ud835", "\udc00", "\U0001d400", "²", "٣", "\U0001f600", "fig-", "x1"]
NARROW_HEADS = ["#fig-", "#tbl-", "#eq-", "#lst-", "#sec-", "#fig", "fig-", "#"]
NARROW_PIECES = ["a", "b1", "-", ".", "_", ":", "$", " ", "é", "\ud835", "\udc00", "\U0001d400", "²", "٣", "}", "fig-"]

# The sweep of every ASCII code unit (the full 65,536 are the test's, and only its ASCII half is counted here): a unit is put at each place of a head and in place of each of its characters.
CELL_SWEEP_HEADS = ['"fig-a.b', "'x_1", "a", ""]
NARROW_SWEEP_HEADS = ["#fig-a.b", "#tbl-x_1", "#eq-a", "#lst-_", "#fig-"]

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


def count_cell(strings):
    total = accepted = quoted = id_units = 0
    for units in strings:
        total += 1
        ok, q, length = cell_value(units)
        if ok:
            accepted += 1
            id_units += length
            if q:
                quoted += 1
    return total, accepted, quoted, id_units


def count_narrow(strings):
    total = accepted = id_units = 0
    for units in strings:
        total += 1
        ok, length = narrow_id(units)
        if ok:
            accepted += 1
            id_units += length
    return total, accepted, id_units


def enumerate_units(alphabet, max_length):
    for length in range(0, max_length + 1):
        for members in itertools.product(alphabet, repeat=length):
            yield [u for member in members for u in member]


def seeded_cell():
    random = seeded_random(SEED)
    pieces = [utf16(p) for p in CELL_PIECES]
    for _ in range(SEEDED):
        count = int(random() * 13)
        units = []
        for _ in range(count):
            units.extend(pieces[int(random() * len(pieces))])
        yield units


def seeded_narrow():
    random = seeded_random(SEED)
    heads = [utf16(h) for h in NARROW_HEADS]
    pieces = [utf16(p) for p in NARROW_PIECES]
    for _ in range(SEEDED):
        units = list(heads[int(random() * len(heads))])
        count = int(random() * 9)
        for _ in range(count):
            units.extend(pieces[int(random() * len(pieces))])
        yield units


def ascii_edits(heads):
    """Every string made from a head by putting one ASCII code unit at any place of it, or in place of any one of its characters (the test's `everyCodeUnitEdit`, units 0 to 127 only)."""
    for head in heads:
        units = utf16(head)
        for at in range(len(units) + 1):
            for unit in range(128):
                yield units[:at] + [unit] + units[at:]
                if at < len(units):
                    yield units[:at] + [unit] + units[at + 1:]


def main(argv):
    wanted = argv or [*CELL_ALPHABETS, *NARROW_TOKENS, "cell seeded", "narrow seeded", "cell ascii sweep", "narrow ascii sweep"]
    for name in wanted:
        if name in CELL_ALPHABETS:
            alphabet, max_length = CELL_ALPHABETS[name]
            total, accepted, quoted, id_units = count_cell(enumerate_units(alphabet, max_length))
            print(f"{name}: strings={total} accepted={accepted} quoted={quoted} idUnits={id_units}", flush=True)
        elif name in NARROW_TOKENS:
            alphabet, max_length = NARROW_TOKENS[name]
            total, accepted, id_units = count_narrow(enumerate_units(alphabet, max_length))
            print(f"{name}: strings={total} accepted={accepted} idUnits={id_units}", flush=True)
        elif name == "cell seeded":
            total, accepted, quoted, id_units = count_cell(seeded_cell())
            print(f"{name}: strings={total} accepted={accepted} quoted={quoted} idUnits={id_units}", flush=True)
        elif name == "narrow seeded":
            total, accepted, id_units = count_narrow(seeded_narrow())
            print(f"{name}: strings={total} accepted={accepted} idUnits={id_units}", flush=True)
        elif name == "cell ascii sweep":
            total, accepted, quoted, id_units = count_cell(ascii_edits(CELL_SWEEP_HEADS))
            print(f"{name}: strings={total} accepted={accepted} quoted={quoted} idUnits={id_units}", flush=True)
        elif name == "narrow ascii sweep":
            total, accepted, id_units = count_narrow(ascii_edits(NARROW_SWEEP_HEADS))
            print(f"{name}: strings={total} accepted={accepted} idUnits={id_units}", flush=True)
        else:
            print(f"unknown count {name!r}", file=sys.stderr)
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
