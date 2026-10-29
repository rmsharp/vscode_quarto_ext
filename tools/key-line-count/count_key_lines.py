#!/usr/bin/env python3
# Recount of the pinned counts of test/unit/key-line-equivalence.test.ts (Session 337).
# usage: python3 -I tools/key-line-count/count_key_lines.py [all|seeded|...]
# Run it with `python3 -I`; the tools/ directory is not packaged (.vscodeignore).
# Session 337 ran it and compared its output with the pinned counts of the test named above (matched, valued and prefix-character counts of the enumerations, the edits and the seeded sample (the DEF rows are cross-checks the test does not pin)): all equal. The strings totals are computed by the test from its alphabets.
# Independent recount of the pinned counts of test/unit/key-line-equivalence.test.ts.
# It shares no code with the TypeScript: a Python `re` port of the OLD pattern (the dot spelled out as the four ECMAScript line terminators, `$` as `\Z`),
# a brute-force reading of the definition (every cut into prefix, key, gap, colon, rest), a port of mulberry32 and of the seeded generator, and the code-unit edits.
# Run with: python3 -I recount.py
import itertools
import re
import sys

LS = "\u2028"
PS = "\u2029"
NBSP = "\u00a0"

DOT = r"[^\n\r\u2028\u2029]"
OLD = re.compile(
    r"[ \t]*(?:-[ \t]+)*(?:\"[^\"\\]*\"|'[^']*'|[A-Za-z0-9_](?:[A-Za-z0-9_. -]*[A-Za-z0-9_.-])?)[ \t]*:(?:[ \t]+(?![ \t])(" + DOT + r"*)|)\Z"
)
PREFIX = re.compile(r"[ \t]*(?:-[ \t]+)*")


def old_read(line):
    m = OLD.match(line)
    if m is None:
        return None
    return ("v", m.group(1)) if m.group(1) is not None else ("u", None)


# ---- the definition, brute force ----
WORD = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_")


def blank(c):
    return c == " " or c == "\t"


def is_prefix(t):
    i = 0
    while i < len(t) and blank(t[i]):
        i += 1
    while i < len(t):
        if t[i] != "-":
            return False
        i += 1
        if not (i < len(t) and blank(t[i])):
            return False
        while i < len(t) and blank(t[i]):
            i += 1
    return True


def is_key(t):
    if len(t) >= 2 and t[0] == '"':
        inner = t[1:-1]
        return t[-1] == '"' and '"' not in inner and "\\" not in inner
    if len(t) >= 2 and t[0] == "'":
        return t[-1] == "'" and "'" not in t[1:-1]
    if len(t) == 0 or t[0] not in WORD:
        return False
    if len(t) == 1:
        return True
    if not (t[-1] in WORD or t[-1] in ".-"):
        return False
    return all((c in WORD or c in ". -") for c in t[1:-1])


def definition_read(line):
    outcomes = set()
    n = len(line)
    for p in range(n + 1):
        if not is_prefix(line[:p]):
            continue
        for k in range(p + 1, n + 1):
            if not is_key(line[p:k]):
                continue
            c = k
            while c < n and blank(line[c]):
                c += 1
            if c >= n or line[c] != ":":
                continue
            rest = line[c + 1:]
            if rest == "":
                outcomes.add(("u", None))
            elif blank(rest[0]):
                r = 0
                while r < len(rest) and blank(rest[r]):
                    r += 1
                text = rest[r:]
                if not any(ch in "\n\r\u2028\u2029" for ch in text):
                    outcomes.add(("v", text))
    assert len(outcomes) <= 1, (line, outcomes)
    return next(iter(outcomes)) if outcomes else None


def definition_prefix_end(line):
    best = 0
    for p in range(len(line) + 1):
        if is_prefix(line[:p]):
            best = p
    return best


def every_string(alphabet, max_length):
    yield ""
    for length in range(1, max_length + 1):
        for combo in itertools.product(alphabet, repeat=length):
            yield "".join(combo)


def tally(lines, by_definition=False, counts=None):
    compared = matched = valued = prefix_chars = 0
    for line in lines:
        compared += 1
        r = old_read(line)
        if r is not None:
            matched += 1
            if r[0] == "v":
                valued += 1
        pe = PREFIX.match(line).end()
        prefix_chars += pe
        if by_definition:
            assert definition_read(line) == r, line
            assert definition_prefix_end(line) == pe, line
    return {"compared": compared, "matched": matched, "valued": valued, "prefixChars": prefix_chars}


WIDE = ["k", "-", " ", "\t", ":", '"', "'", "\\", "\r"]
DENSE = ["k", "-", " ", ":", "\t"]
QUOTES = ['"', "'", "k", ":", " ", "\\", "-"]
FOILS = ["k", "_", "9", ".", "-", " ", ":", "!", NBSP]
AFTER_COLON = [" ", "\t", "x", "\r", LS, PS, "\n", ":"]
AFTER_HEADS = ["k:", "- k:", "k: ", '"k":']

# The enumerated alphabet writes `k` for the key class; the same letter stands for the key class in both ports.
which = sys.argv[1] if len(sys.argv) > 1 else "all"

if which in ("all", "enum"):
    print("WIDE<=7", tally(every_string(WIDE, 7)))
    print("DENSE<=9", tally(every_string(DENSE, 9)))
    print("QUOTES<=7", tally(every_string(QUOTES, 7)))
    print("FOILS<=6", tally(every_string(FOILS, 6)))
    print("AFTER<=6", tally(h + s for h in AFTER_HEADS for s in every_string(AFTER_COLON, 6)))

if which in ("all", "def"):
    # the brute-force definition on the smaller sets in full, and on every 37th string of the bigger ones
    print("DEF QUOTES<=6", tally(every_string(QUOTES, 6), True))
    print("DEF FOILS<=5", tally(every_string(FOILS, 5), True))
    print("DEF AFTER<=4", tally((h + s for h in AFTER_HEADS for s in every_string(AFTER_COLON, 4)), True))
    print("DEF WIDE<=6", tally(every_string(WIDE, 6), True))
    print("DEF DENSE<=8", tally(every_string(DENSE, 8), True))
    print("DEF seeded-free sample of WIDE<=7 (every 37th)", tally((s for i, s in enumerate(every_string(WIDE, 7)) if i % 37 == 0), True))

HEADS = ["- k: v", " - - k :", '"k" : v', "'k': v", "a-b.1 :\tv", "k:", "k:  "]


def code_unit_edits(heads):
    for head in heads:
        for at in range(len(head) + 1):
            for unit in range(0x10000):
                ch = chr(unit)
                yield head[:at] + ch + head[at:]
                if at < len(head):
                    yield head[:at] + ch + head[at + 1:]


if which in ("all", "edits"):
    print("EDITS", tally(code_unit_edits(HEADS)))


# ---- mulberry32 and the seeded generator ----
M = 0xFFFFFFFF


def mulberry32(seed):
    state = [seed & M]

    def nxt():
        state[0] = (state[0] + 0x6D2B79F5) & M
        s = state[0]
        t = ((s ^ (s >> 15)) * (1 | s)) & M
        t = ((t + (((t ^ (t >> 7)) * (61 | t)) & M)) & M) ^ t
        return ((t ^ (t >> 14)) & M) / 4294967296

    return nxt


LEAD_PIECES = ["", " ", "  ", "\t", "- ", "-\t", "-  ", "-", " - ", "- - ", "--", "-\u00a0"]
KEY_PIECES = ["k", "key", "a b", "a  b", "a.b", "a-b", "a_1", "9", "_", "k ", "k\t", ".k", "-k", "k.", "k-", '"k"', "'k'", "\"k'", "'k\"", '"a b"', '"a\\"b"', "'a\\'", '""', "''", '"a:b"', "\u00e9", "k!", '"', "'"]
GAPS = ["", "", " ", "\t", "  ", " \t "]
BLANK_PIECES = ["", " ", " ", "\t", "  ", " \t", "x", "\r", LS, "\u00a0"]
VALUE_PIECES = ["", "v", "a b", "[a", '"q', " ", "\t", "\r", LS, PS, "\n", "x\ry", "# c", "{a: b}", ":", "- x", "\u00a0"]


def seeded_lines(seed, count):
    nxt = mulberry32(seed)

    def pick(pieces):
        return pieces[int(nxt() * len(pieces))]

    for _ in range(count):
        line = ""
        leads = int(nxt() * 4)
        for _p in range(leads):
            line += pick(LEAD_PIECES)
        line += pick(KEY_PIECES)
        if nxt() < 0.25:
            line += pick(KEY_PIECES)
        line += pick(GAPS)
        if nxt() < 0.9:
            line += ":"
        line += pick(BLANK_PIECES)
        values = int(nxt() * 3)
        for _p in range(values):
            line += pick(VALUE_PIECES)
        yield line


if which in ("all", "seeded"):
    print("SEEDED 300000 seed 3371", tally(seeded_lines(3371, 300000)))
    print("SEEDED def 20000 seed 3371", tally(list(seeded_lines(3371, 20000)), True))
