#!/usr/bin/env python3
"""Count what the OLD `R_SYMBOL_CHAIN` accepted, without a regular expression (Session 337).

`test/unit/r-symbol-chain-equivalence.test.ts` pins how many strings of each enumeration the old pattern accepts (`ACCEPTED`). Those numbers must not come from the code under test, or a
comparison could pass by both readings being wrong the same way. This script shares no code with the TypeScript: it splits a token at its `-` and `:` and judges each piece (the first
piece must be a name; each later piece a name or a canonical integer), using Python's `unicodedata` for the letter and number kinds and no `re` at all.

    python3 -I tools/r-symbol-chain-count/count_accepted.py            # every count, about 6 seconds
    python3 -I tools/r-symbol-chain-count/count_accepted.py "NARROW"   # one of them

The seeded count reproduces the test's generator: Mulberry32 from `test/unit/support/regex-equivalence.ts` seeded with 3370, then the same piece list and draws as the seeded row. If the test's
alphabets, pieces or seed change, change them here too, and compare the lines this prints with the `ACCEPTED` constants.
The ASCII slice of the code-unit sweep is counted here; the rest of it is NOT: that count depends on the Unicode version (Node 22.23 has 17.0, `unicodedata` of Python 3.10 has 13.0), which is why
the test only bounds it. The alphabets below use characters whose category has never changed (a Latin letter, `e` with an acute, a mathematical bold capital, an Arabic-Indic digit, a superscript two).
"""
import itertools
import sys
import unicodedata


def is_letter(c):
    return unicodedata.category(c).startswith("L")


def is_number(c):
    return unicodedata.category(c).startswith("N")


def is_name(piece):
    """A letter, then letters, numbers, `_` and `.`."""
    if piece == "" or not is_letter(piece[0]):
        return False
    return all(is_letter(c) or is_number(c) or c in "_." for c in piece[1:])


def is_integer(piece):
    """`0`, or one to four ASCII digits that do not start with `0`."""
    if piece == "0":
        return True
    return 1 <= len(piece) <= 4 and piece[0] in "123456789" and all(c in "0123456789" for c in piece)


def accepts(token):
    pieces = [[]]
    for c in token:
        if c == "-" or c == ":":
            pieces.append([])
        else:
            pieces[-1].append(c)
    pieces = ["".join(p) for p in pieces]
    return is_name(pieces[0]) and all(is_name(p) or is_integer(p) for p in pieces[1:])


# The alphabets and lengths of the test's `ENUMERATIONS`.
E_ACUTE = "é"
BOLD_A = "\U0001d400"
ARABIC_THREE = "٣"
SUPERSCRIPT_TWO = "²"
ALPHABETS = {
    "WIDE": (["a", E_ACUTE, BOLD_A, "0", "1", "5", ARABIC_THREE, SUPERSCRIPT_TWO, "-", ":", "_", ".", "$", " "], 5),
    "DIGITS": (["a", "0", "1", "-", ":"], 8),
    "NARROW": (["a", "-", ":", "0", "1", "_", "."], 7),
}


def count_enumeration(alphabet, max_length):
    compared = accepted = code_points = 0
    for length in range(0, max_length + 1):
        for chars in itertools.product(alphabet, repeat=length):
            token = "".join(chars)
            compared += 1
            if accepts(token):
                accepted += 1
                code_points += len(token)
    return compared, accepted, code_points


def mulberry32(seed):
    state = [seed & 0xFFFFFFFF]

    def next_value():
        state[0] = (state[0] + 0x6D2B79F5) & 0xFFFFFFFF
        t = state[0]
        t = ((t ^ (t >> 15)) * (1 | t)) & 0xFFFFFFFF
        t = ((t + (((t ^ (t >> 7)) * (61 | t)) & 0xFFFFFFFF)) & 0xFFFFFFFF) ^ t
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return next_value


SEED = 3370
SEEDED_COUNT = 300_000
PIECES = [
    "a", "ab", "a1", "a.b", "a_b", E_ACUTE, BOLD_A, "-", ":", "-", ":", "0", "1", "12", "123", "1234", "12345", "01", "_", ".", " ", "$",
    ARABIC_THREE, SUPERSCRIPT_TWO, "-a", ":b", "-1", "-0", ":10", "--", "-a-b",
]


def count_seeded():
    nxt = mulberry32(SEED)
    compared = accepted = code_points = 0
    for _ in range(SEEDED_COUNT):
        text = ""
        parts = int(nxt() * 13)
        for _ in range(parts):
            piece = PIECES[int(nxt() * len(PIECES))]
            text += piece * (1 + int(nxt() * 3))
        compared += 1
        if accepts(text):
            accepted += 1
            code_points += len(text)
    return compared, accepted, code_points


def count_ascii_sweep():
    """For each position of the sweep (see the test), how many of the 128 ASCII code units make the token a chain."""
    from_test = [
        ("c", lambda c: c),
        ("c + a", lambda c: c + "a"),
        ("a + c", lambda c: "a" + c),
        ("a + c + b", lambda c: "a" + c + "b"),
        ("a + c + -a", lambda c: "a" + c + "-a"),
        ("a- + c", lambda c: "a-" + c),
        ("a- + c + b", lambda c: "a-" + c + "b"),
        ("a-b + c + d", lambda c: "a-b" + c + "d"),
        ("a-b + c", lambda c: "a-b" + c),
        ("a-1 + c", lambda c: "a-1" + c),
        ("a-1 + c + b", lambda c: "a-1" + c + "b"),
        ("a: + c", lambda c: "a:" + c),
        ("a: + c + 1", lambda c: "a:" + c + "1"),
        ("a-0 + c", lambda c: "a-0" + c),
        ("a-12 + c", lambda c: "a-12" + c),
        ("a-123 + c + 5", lambda c: "a-123" + c + "5"),
        ("a-1234 + c", lambda c: "a-1234" + c),
        ("a-b- + c", lambda c: "a-b-" + c),
        ("c + -a", lambda c: c + "-a"),
        ("a + c + -1", lambda c: "a" + c + "-1"),
    ]
    return [(name, sum(1 for u in range(128) if accepts(build(chr(u))))) for name, build in from_test]


def main():
    wanted = sys.argv[1] if len(sys.argv) > 1 else None
    for name, (alphabet, max_length) in ALPHABETS.items():
        if wanted in (None, name):
            compared, accepted, code_points = count_enumeration(alphabet, max_length)
            print(f"{name} len {max_length}: compared {compared} accepted {accepted} codePoints {code_points}")
    if wanted in (None, "SEEDED"):
        compared, accepted, code_points = count_seeded()
        print(f"SEEDED seed {SEED}: compared {compared} accepted {accepted} codePoints {code_points}")
    if wanted in (None, "ASCII"):
        for name, n in count_ascii_sweep():
            print(f"ASCII {name}: {n}")


if __name__ == "__main__":
    main()
