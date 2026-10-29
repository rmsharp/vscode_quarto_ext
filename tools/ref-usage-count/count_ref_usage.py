#!/usr/bin/env python3
"""Recount the exhaustive rows of `test/unit/ref-usage-equivalence.test.ts` from the DEFINITION of a cross-reference usage, not from the project's code (Session 337).

The test pins, for each enumeration, how many lines it read (`strings`), how many cross-reference usages the old `REF_USAGE` pattern found in them (`usages`) and for how many (line, cursor column) pairs
`refIdAt` answered an id (`answered`). Those numbers must not come from the code under test, or a comparison could pass by both being wrong the same way. This script shares no code with the TypeScript
and does not use a regular expression: it derives them from the rule the old pattern states.

    a usage is an `@` that no ASCII letter, digit or `_` comes right before, then one of fig- tbl- sec- eq- lst-, then an id;
    the id is the longest run of code points, counted from the first, in which each is a REGCHAR (a Unicode letter or number, or `_`) or an internal-punctuation mark (one of :.#$%&+?<>~/-) with a REGCHAR
    right after it, and whose first is a REGCHAR; a usage's range is the columns from its `@` to the end of its id, both counted;
    a column is "answered" when it lies in the range of some usage (columns 0 through the line's length plus one).

A line is a list of UTF-16 code units, as the pattern reads it: a high surrogate followed by a low one is ONE code point (an astral letter), a lone one is a code point that is neither a letter nor a number.

    python3 -I tools/ref-usage-count/count_ref_usage.py      # prints one line per row: the label, then strings, usages, answered

⚠ Which characters are letters and numbers is the Unicode version of the interpreter (Python 3.10 knows Unicode 13, Node 22 knows 17), and the two differ by 72 code units of the Basic Multilingual
Plane. The rows below use only characters whose category is the same in both (`a`, `_`, `é`, `日`, `𝐀`, `٣`, a lone surrogate, an emoji, a combining mark), and the sweep that puts every code unit in every place
pins its ASCII half exactly and leaves its non-ASCII half to the comparison with the old pattern alone.

If the test's alphabets, lengths, heads or column sets change, change them here too, and compare what this prints with the constants in the test (`ENUMERATIONS`, the ASCII sweep). The seeded row's count has no
second implementation (it draws from a generator of its own): it is counted from the old pattern in the test alone.
"""
import itertools
import unicodedata

KINDS = [[ord(c) for c in kind] for kind in ("fig-", "tbl-", "sec-", "eq-", "lst-")]
PUNCT = {ord(c) for c in ":.#$%&+?<>~/-"}
AT = ord("@")

_class_cache = {}


def is_ascii_word(unit):
    return 48 <= unit <= 57 or 65 <= unit <= 90 or unit == 95 or 97 <= unit <= 122


def is_regchar(code_point):
    if code_point < 128:
        return is_ascii_word(code_point)
    if code_point in _class_cache:
        return _class_cache[code_point]
    if 0xD800 <= code_point <= 0xDFFF:
        answer = False  # a lone surrogate is neither a letter nor a number
    else:
        answer = unicodedata.category(chr(code_point))[0] in ("L", "N")
    _class_cache[code_point] = answer
    return answer


def code_points(units, start):
    """The code points of units[start:], each with the index of the unit it starts at; a high surrogate and the low one after it make one."""
    points = []
    i = start
    while i < len(units):
        unit = units[i]
        if 0xD800 <= unit <= 0xDBFF and i + 1 < len(units) and 0xDC00 <= units[i + 1] <= 0xDFFF:
            points.append((0x10000 + ((unit - 0xD800) << 10) + (units[i + 1] - 0xDC00), i))
            i += 2
        else:
            points.append((unit, i))
            i += 1
    return points


def usage_end(units, at):
    """Where the usage whose `@` is at `at` ends (just past its last unit), or -1."""
    if units[at] != AT:
        return -1
    if at > 0 and is_ascii_word(units[at - 1]):
        return -1
    after = at + 1
    kind = next((k for k in KINDS if units[after:after + len(k)] == k), None)
    if kind is None:
        return -1
    points = code_points(units, after + len(kind))
    if not points or not is_regchar(points[0][0]):
        return -1
    kept = 0
    while kept < len(points):
        code_point = points[kept][0]
        follower = kept + 1 < len(points) and is_regchar(points[kept + 1][0])
        if not (is_regchar(code_point) or (code_point in PUNCT and follower)):
            break
        kept += 1
    return len(units) if kept == len(points) else points[kept][1]


def usages_of(units):
    found = []
    for at, unit in enumerate(units):
        if unit == AT:
            end = usage_end(units, at)
            if end >= 0:
                found.append((at, end))
    return found


def to_units(text):
    """A Python string as UTF-16 code units: an astral character is two, a lone surrogate (a Python character of its own) stays one."""
    units = []
    for ch in text:
        code_point = ord(ch)
        if code_point > 0xFFFF:
            code_point -= 0x10000
            units.append(0xD800 + (code_point >> 10))
            units.append(0xDC00 + (code_point & 0x3FF))
        else:
            units.append(code_point)
    return units


def answered_columns(units, usages):
    columns = set()
    for start, end in usages:
        columns.update(c for c in range(start, end + 1) if 0 <= c <= len(units) + 1)
    return len(columns)


def count_enumeration(alphabet, max_length):
    """Every concatenation of 0..max_length symbols of the alphabet: strings, usages, answered."""
    symbols = [to_units(symbol) for symbol in alphabet]
    strings = usages = answered = 0
    for length in range(0, max_length + 1):
        for combo in itertools.product(symbols, repeat=length):
            units = [u for symbol in combo for u in symbol]
            strings += 1
            if AT in units:
                found = usages_of(units)
                usages += len(found)
                answered += answered_columns(units, found)
    return strings, usages, answered


def boundary_columns(units, found):
    """The columns the sweep compares: 0, the length and one past it, and around each `@` and each usage's end."""
    columns = {0, len(units), len(units) + 1}
    ends = dict(found)
    for at, unit in enumerate(units):
        if unit == AT:
            columns.update((at - 1, at, at + 1))
            if at in ends:
                columns.update((ends[at] - 1, ends[at], ends[at] + 1))
    return columns


def count_ascii_sweep(heads):
    """Every ASCII character put at every place of each head, inserted and in place of the character there: strings, usages, answered (over the boundary columns)."""
    strings = usages = answered = 0
    for head in heads:
        for place in range(len(head) + 1):
            for unit in range(128):
                ch = chr(unit)
                texts = [head[:place] + ch + head[place:]]
                if place < len(head):
                    texts.append(head[:place] + ch + head[place + 1:])
                for text in texts:
                    units = to_units(text)
                    found = usages_of(units)
                    strings += 1
                    usages += len(found)
                    covered = boundary_columns(units, found)
                    answered += sum(1 for c in covered if any(start <= c <= end for start, end in found))
    return strings, usages, answered


ASTRAL_LETTER = "\U0001d400"
HIGH = "\ud835"
LOW = "\udc00"
EMOJI = "\U0001f600"
ENUMERATIONS = [
    ("7 symbols (@, fig-, eq-, a letter, ., -, a blank), up to 7", ["@", "fig-", "eq-", "a", ".", "-", " "], 7),
    ("8 symbols (@sec-, a letter, _, :, #, ., e-acute, a blank), up to 6", ["@sec-", "a", "_", ":", "#", ".", "\u00e9", " "], 6),
    ("11 symbols (@tbl-, an astral letter, a high and a low surrogate alone, an emoji, a digit, a letter, a dot, a combining mark, a blank), up to 5",
     ["@tbl-", "a", ASTRAL_LETTER, HIGH, LOW, EMOJI, "\u0663", "\u65e5", ".", "\u0301", " "], 5),
    ("8 symbols (@, fig-, tbl-, lst-, a, _, e-acute, a blank), up to 6", ["@", "fig-", "tbl-", "lst-", "a", "_", "\u00e9", " "], 6),
]
HEADS = ["@fig-a.b", " @eq-a:b_"]

if __name__ == "__main__":
    for label, alphabet, max_length in ENUMERATIONS:
        print(label, *count_enumeration(alphabet, max_length), sep=" | ")
    print("ASCII sweep of the heads", HEADS, *count_ascii_sweep(HEADS), sep=" | ")
