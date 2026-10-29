#!/usr/bin/env python3
"""Recount, without the project's code, the numbers `test/unit/knitr-string-mask-equivalence.test.ts` pins (Session 337, part 7 of the Session 336 single-line RangeError item).

The test compares `blankQuotedStrings` (the index loop) with the OLD global replace in `knitrHeaderOptions`,

    segment.replace(/"(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'/g, '""')

and pins, per row, how many strings were compared, in how many the old mask changed something, how many strings it blanked in all and how many characters those held. Those numbers must not come
from the code under test, or a comparison could pass by both being wrong the same way. This script derives them twice, by two readings that share nothing with the TypeScript or with each other:

    1. Python's `re`, with the pattern spelled the way the specification reads the TypeScript one: `.` is any code unit but a line terminator, which Python's `.` is not (it excludes only LF), so the
       class `[^\\n\\r\\u2028\\u2029]` stands in for it;
    2. a hand loop that follows the definition: a quote opens a string; the string runs to the next quote of the same kind, a backslash taking the character after it (any but a line terminator, and a
       backslash before a line terminator, or at the end, makes the string fail); a string that fails is skipped by one character and the scan goes on.

    python3 -I tools/knitr-string-mask-count/count_masked.py     # prints one line per row: label, compared, changed, blanked, characters

If the test's alphabets, lengths, templates or seeds change, change them here too and compare the lines this prints with the `COUNTS` constants in the test. The seeded row has no second implementation
(it draws from a generator of its own): its counts come from the old pattern in the test alone.
"""
import itertools
import re

LS = " "
PS = " "
OLD = re.compile(r"\"(?:[^\"\\]|\\[^\n\r  ])*\"|'(?:[^'\\]|\\[^\n\r  ])*'")
TERMINATORS = "\n\r" + LS + PS


def by_regex(text):
    """The matches of the pattern, as (start, end) pairs, left to right and not overlapping."""
    return [(m.start(), m.end()) for m in OLD.finditer(text)]


def by_loop(text):
    """The same matches from the definition."""
    found = []
    at = 0
    n = len(text)
    while at < n:
        quote = text[at]
        if quote != '"' and quote != "'":
            at += 1
            continue
        j = at + 1
        end = -1
        while j < n:
            c = text[j]
            if c == quote:
                end = j + 1
                break
            if c == "\\":
                if j + 1 >= n or text[j + 1] in TERMINATORS:
                    break
                j += 2
            else:
                j += 1
        if end < 0:
            at += 1
        else:
            found.append((at, end))
            at = end
    return found


def count(label, texts):
    compared = changed = blanked = characters = 0
    for text in texts:
        a = by_regex(text)
        b = by_loop(text)
        assert a == b, (label, text, a, b)
        compared += 1
        if a:
            changed += 1
        blanked += len(a)
        characters += sum(end - start for start, end in a)
    print(label, compared, changed, blanked, characters)


def every_string(alphabet, max_length):
    yield ""
    for length in range(1, max_length + 1):
        for picks in itertools.product(alphabet, repeat=length):
            yield "".join(picks)


WIDE = ['"', "'", "\\", "a", " ", ",", "(", "=", LS, "\n", "\r", PS]
NARROW = ['"', "'", "\\", "a", LS]


def sweep_templates():
    """(before, after) pairs around the swept code unit: every structural position of a string token, for both quotes."""
    pairs = []
    for q, o in (('"', "'"), ("'", '"')):
        pairs += [
            ("", q + "ab" + q),  # before a string
            (q, q),  # the whole body
            (q + "a", "b" + q),  # inside
            (q + "a\\", q),  # right after a backslash, then the closer
            (q + "a\\", "b" + q),  # right after a backslash, more body
            (q + "a\\b", q),  # right after an escaped character
            (q + "a\\\\", q),  # right after an escaped backslash
            (q + "a", ""),  # the end of an unterminated string
            (q + "a" + q, ""),  # right after the closer, at the end
            (q + "a" + q, q + "b" + q),  # between two strings
            (q + "a" + q, "b"),  # after the closer, before plain text
            (q + "a" + o, o + q),  # inside the other quote
            ("", "\\" + q + "a" + q),  # before a backslash and a quote outside any string
            ("\\", q + "a" + q),  # right after a backslash outside a string
            (q + "\\", ""),  # after a trailing backslash of an unterminated string
        ]
    return pairs


def every_code_unit():
    for before, after in sweep_templates():
        for code in range(0x10000):
            yield before + chr(code) + after


def main():
    count("wide", every_string(WIDE, 5))
    count("narrow", every_string(NARROW, 9))
    count("sweep", every_code_unit())
    print("templates", len(sweep_templates()))


if __name__ == "__main__":
    main()
