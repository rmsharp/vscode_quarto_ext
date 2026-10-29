#!/usr/bin/env python3
# Recount of the pinned counts of test/unit/empty-native-div-equivalence.test.ts and test/unit/support/empty-native-div-oracle.ts (Session 337).
# usage: python3 -I tools/empty-native-div-count/count_empty_div.py dense|tag|attr8|framed|seeded|sweep
# Run it with `python3 -I`; the tools/ directory is not packaged (.vscodeignore).
# Session 337 ran it and compared its output with the pinned counts of the test named above (accepted counts of dense6, tag6, attr8, framed, seeded and sweep): all equal. The strings totals are computed by the test from its alphabets.
# Independent recount for the empty native div equivalence rows (Session 337). Shares no code with the TypeScript.
# It ports the DEFINITION (a set of positions the attribute block may stop at) and, as a second reading, the old pattern
# in Python's own `re` with ASCII semantics and fullmatch (Python's `$` accepts a trailing newline, so fullmatch is used).
# usage: python3 -I recount.py <part>
import itertools
import re
import sys

OLD = re.compile(r"[ \t]*<div\b(?:[^>\"']|\"[^\"]*\"|'[^']*')*>[ \t]*</div>[ \t]*", re.IGNORECASE | re.ASCII | re.DOTALL)


def is_word(c):
    return c is not None and (("a" <= c <= "z") or ("A" <= c <= "Z") or ("0" <= c <= "9") or c == "_")


def sp(c, letter):
    return c == letter or c == letter.upper()


def at_(s, i):
    return s[i] if 0 <= i < len(s) else None


def closer_and_blanks(s, frm):
    i = frm
    while at_(s, i) in (" ", "\t"):
        i += 1
    if at_(s, i) != "<" or at_(s, i + 1) != "/" or not sp(at_(s, i + 2), "d") or not sp(at_(s, i + 3), "i") or not sp(at_(s, i + 4), "v") or at_(s, i + 5) != ">":
        return False
    i += 6
    while at_(s, i) in (" ", "\t"):
        i += 1
    return i == len(s)


def definition(s):
    n = len(s)
    i = 0
    while at_(s, i) in (" ", "\t"):
        i += 1
    if at_(s, i) != "<" or not sp(at_(s, i + 1), "d") or not sp(at_(s, i + 2), "i") or not sp(at_(s, i + 3), "v"):
        return False
    start = i + 4
    if is_word(at_(s, start)):
        return False
    reach = bytearray(n + 2)
    reach[start] = 1
    for k in range(start, n):
        if not reach[k]:
            continue
        u = s[k]
        if u not in ">\"'":
            reach[k + 1] = 1
        elif u != ">":
            j = s.find(u, k + 1)
            if j >= 0:
                reach[j + 1] = 1
    for k in range(start, n):
        if reach[k] and s[k] == ">" and closer_and_blanks(s, k + 1):
            return True
    return False


def count(strings):
    compared = 0
    accepted = 0
    bad = []
    for s in strings:
        compared += 1
        d = definition(s)
        if d:
            accepted += 1
        if len(bad) < 3 and d != bool(OLD.fullmatch(s)):
            bad.append(repr(s))
    return {"compared": compared, "accepted": accepted, "pyre_vs_definition_disagreements": bad}


def every(alphabet, max_len):
    yield ""
    for n in range(1, max_len + 1):
        for t in itertools.product(alphabet, repeat=n):
            yield "".join(t)


LS = " "
PS = " "
NBSP = " "
DENSE = ["<div", "</div>", ">", " ", "\t", "a", '"', "'"]
TAG = ["<", "div", "DIV", ">", "</", "/", '"', "'", " ", "a"]
ATTR = ["<", "div", ">", "</", '"', " ", "a"]
LEADS = ["", " ", "\t", " \t", "    "]
NAMES = ["div", "DIV", "dIv", "di", "dive", "div_", "div1", "dİv"]
BODY = [" ", "a", ">", '"', "'", "\n"]
TAILS = ["></div>", ">  </div>", "> </DIV>\t", "></div>x", "></div", "></ div>", ">", "></div></div>"]
HEADS = [
    "<div></div>",
    "<DIV x></DIV>",
    '  <div a="b>c">\t</div> ',
    "<div a='b>c' d></div>",
    '<div a="b></div>',
    "<div>x</div>",
    "\t<div\n></div>",
]


def framed():
    for lead in LEADS:
        for name in NAMES:
            for body in every(BODY, 5):
                for tail in TAILS:
                    yield lead + "<" + name + body + tail


def sweep():
    for head in HEADS:
        for at in range(len(head) + 1):
            for unit in range(0x10000):
                ch = chr(unit)
                yield head[:at] + ch + head[at:]
                if at < len(head):
                    yield head[:at] + ch + head[at + 1:]


def mulberry32(seed):
    state = seed & 0xFFFFFFFF

    def nxt():
        nonlocal state
        state = (state + 0x6D2B79F5) & 0xFFFFFFFF
        t = ((state ^ (state >> 15)) * (1 | state)) & 0xFFFFFFFF
        t = (((t + (((t ^ (t >> 7)) * (61 | t)) & 0xFFFFFFFF)) & 0xFFFFFFFF) ^ t)
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return nxt


S_LEADS = ["", "", "", " ", "  ", "   ", "    ", "\t", " \t"]
S_NAMES = ["div", "div", "div", "DIV", "Div", "dIV", "di", "dive", "div_", "div1", "div-"]
S_ATTRS = ["a", " ", "  ", "b=c", ' x="y"', " x='y'", ' x="a>b"', " x='a>b'", '"', "'", "=", "\n", "\r", LS, PS, NBSP, "/", "-", "\t", "İ"]
S_GAPS = ["", "", "", " ", "  ", "\t", " \t", NBSP, "x"]
S_CLOSERS = ["</div>", "</div>", "</div>", "</div>", "</DIV>", "</Div>", "</ div>", "</div", "</div >", "</p>", "</dive>", "<div>"]
S_TAILS = ["", "", "", "", " ", "  ", "\t", " \t", "x", "\r", "\n", NBSP, LS, "</div>", " a"]


def seeded(seed, n):
    nxt = mulberry32(seed)

    def pick(lst):
        return lst[int(nxt() * len(lst))]

    for _ in range(n):
        text = pick(S_LEADS) + "<" + pick(S_NAMES)
        parts = int(nxt() * 6)
        for _p in range(parts):
            text += pick(S_ATTRS)
        if nxt() < 0.875:
            text += ">"
        text += pick(S_GAPS)
        text += pick(S_CLOSERS)
        text += pick(S_TAILS)
        yield text


part = sys.argv[1]
if part == "dense":
    print("dense6", count(every(DENSE, 6)))
elif part == "tag":
    print("tag6", count(every(TAG, 6)))
elif part == "attr8":
    print("attr8", count(every(ATTR, 8)))
elif part == "framed":
    print("framed", count(framed()))
elif part == "seeded":
    print("seeded", count(seeded(3371, 300000)))
elif part == "sweep":
    print("sweep", count(sweep()))
else:
    raise SystemExit("unknown part")
