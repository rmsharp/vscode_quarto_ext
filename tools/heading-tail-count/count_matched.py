#!/usr/bin/env python3
"""Count what the OLD `ATX_CLOSING_PANDOC` and `HEADING_ATTRIBUTE` matched, from their definitions and with no regular expression for the match itself (Session 330).

`test/unit/heading-tail-equivalence.test.ts` pins how many strings of each enumeration, seeded sample and grid the old patterns match (`matched`). Those numbers must not come from the
code under test, or a comparison could pass by both being wrong the same way. This script derives them from the patterns read literally:

    ATX_CLOSING_PANDOC   (?<=(?:^|[^\\\\])(?:\\\\\\\\)*)#+[ \\t]*$        a `#`, a lookbehind (some k >= 0 pairs of backslashes, then the start or a character that is no backslash),
                                                                 one or more `#`, blanks, the end
    HEADING_ATTRIBUTE    (?<=(?:^|[^\\\\])(?:\\\\\\\\)*)\\{[^}]*\\}[ \\t]*$    a `{`, the same lookbehind, characters up to the first `}`, that `}`, blanks, the end

    python3 -I tools/heading-tail-count/count_matched.py            # all ten counts, a few minutes
    python3 -I tools/heading-tail-count/count_matched.py "ATX_CLOSING_PANDOC 8 chars up to 7"   # one of them

The seeded counts reproduce the test's generator: Mulberry32 from `test/unit/support/regex-equivalence.ts` with the seeds and piece lists of the test. If the test's alphabets, pieces, runs or
seeds change, change them here too, and compare the lines this prints with the `matched` constants.
"""
import itertools
import sys

MASK = 0xFFFFFFFF
NBSP = " "
LS = " "
BLANKS = " \t"


def lookbehind_ok(t, i):
    """`(?<=(?:^|[^\\])(?:\\\\)*)` at index i, read literally: some k >= 0 with k pairs of backslashes just before i, and before them the start of the text or a character that is no backslash."""
    k = 0
    while i - 2 * k >= 0:
        start = i - 2 * k
        if t[start:i] != "\\" * (2 * k):
            return False
        if start == 0 or t[start - 1] != "\\":
            return True
        k += 1
    return False


def closing_matches(t):
    if not t.rstrip(BLANKS).endswith("#"):
        return False
    n = len(t)
    for i in range(n):
        if t[i] != "#" or not lookbehind_ok(t, i):
            continue
        j = i
        while j < n and t[j] == "#":
            j += 1
        while j < n and t[j] in BLANKS:
            j += 1
        if j == n:
            return True
    return False


def attribute_matches(t):
    if not t.rstrip(BLANKS).endswith("}"):
        return False
    n = len(t)
    for i in range(n):
        if t[i] != "{" or not lookbehind_ok(t, i):
            continue
        j = i + 1
        while j < n and t[j] != "}":
            j += 1
        if j == n:
            continue
        j += 1
        while j < n and t[j] in BLANKS:
            j += 1
        if j == n:
            return True
    return False


NARROW_CLOSING = ["#", "\\", " ", "\t", "a"]
WIDE_CLOSING = ["#", "\\", " ", "\t", "\r", NBSP, LS, "a"]
NARROW_ATTRIBUTE = ["{", "}", "\\", " ", "\t", "a"]
WIDE_ATTRIBUTE = ["{", "}", "\\", " ", "\r", NBSP, "#", LS]
TOKENS_CLOSING = ["#", "##", "\\", "\\\\", "\\\\\\", " ", "a", "\\#", "# ", " #", "\t", "\U0001F600"]
TOKENS_ATTRIBUTE = ["{", "}", "{{", "}}", "\\", "\\\\", "\\\\\\", " ", "a", "\\{", "{#sec-a}", "\t", "#", "\U0001F600"]

ENUMERATIONS = {
    "ATX_CLOSING_PANDOC 5 chars up to 10": (closing_matches, NARROW_CLOSING, 10),
    "ATX_CLOSING_PANDOC 8 chars up to 7": (closing_matches, WIDE_CLOSING, 7),
    "ATX_CLOSING_PANDOC 12 tokens up to 6": (closing_matches, TOKENS_CLOSING, 6),
    "HEADING_ATTRIBUTE 6 chars up to 9": (attribute_matches, NARROW_ATTRIBUTE, 9),
    "HEADING_ATTRIBUTE 8 chars up to 7": (attribute_matches, WIDE_ATTRIBUTE, 7),
    "HEADING_ATTRIBUTE 14 tokens up to 6": (attribute_matches, TOKENS_ATTRIBUTE, 6),
}

SEEDED_COUNT = 300_000
SEEDED = {
    "ATX_CLOSING_PANDOC seeded": (closing_matches, 3301, ["#", "#", "\\", "\\", " ", "\t", "a", "ab", "# ", "\\\\", "#a"]),
    "HEADING_ATTRIBUTE seeded": (attribute_matches, 3302, ["{", "{", "}", "\\", "\\", " ", "\t", "a", "ab", "{#sec-a}", "\\\\", "{a}", "#"]),
}

RUNS = [0, 1, 2, 3, 4, 5, 8, 9, 100, 101]


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


def closing_grid():
    for before in ["", "a", "#", "a#", " "]:
        for backslashes in RUNS:
            for hashes in RUNS:
                for blanks in [0, 1, 3]:
                    for tail in ["", "b", "#", "\\"]:
                        yield before + "\\" * backslashes + "#" * hashes + " " * blanks + tail


def attribute_grid():
    for before in ["", "a", "}", "a}"]:
        for backslashes in RUNS:
            for braces in RUNS:
                for closers in [0, 1, 2]:
                    for blanks in [0, 1, 3]:
                        for tail in ["", "y"]:
                            yield before + "\\" * backslashes + "{" * braces + "x" + "}" * closers + " " * blanks + tail


GRIDS = {
    "ATX_CLOSING_PANDOC grid": (closing_matches, closing_grid),
    "HEADING_ATTRIBUTE grid": (attribute_matches, attribute_grid),
}


def count_enumeration(matches, alphabet, max_length):
    total = matched = 0
    for length in range(0, max_length + 1):
        for chars in itertools.product(alphabet, repeat=length):
            total += 1
            if matches("".join(chars)):
                matched += 1
    return total, matched


def count_seeded(matches, seed, pieces):
    random = seeded_random(seed)
    matched = 0
    for _ in range(SEEDED_COUNT):
        parts = int(random() * 13)
        text = ""
        for _ in range(parts):
            piece = pieces[int(random() * len(pieces))]
            text += piece * (1 + int(random() * 3))
        if matches(text):
            matched += 1
    return SEEDED_COUNT, matched


def count_grid(matches, texts):
    total = matched = 0
    for text in texts():
        total += 1
        if matches(text):
            matched += 1
    return total, matched


def main(argv):
    names = [*ENUMERATIONS, *SEEDED, *GRIDS]
    wanted = argv or names
    for name in wanted:
        if name in ENUMERATIONS:
            total, matched = count_enumeration(*ENUMERATIONS[name])
        elif name in SEEDED:
            total, matched = count_seeded(*SEEDED[name])
        elif name in GRIDS:
            total, matched = count_grid(*GRIDS[name])
        else:
            print(f"unknown count {name!r}; choose from: {', '.join(names)}", file=sys.stderr)
            return 2
        print(f"{name}: compared {total:,}, matched {matched:,}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
