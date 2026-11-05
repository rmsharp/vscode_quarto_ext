#!/usr/bin/env python3
"""Recount the pinned numbers of `test/unit/preview-url-scanner-equivalence.test.ts` from the DEFINITION of the rule, not from the project's code (Session 341, part 3 of the "Slow shapes and residuals found by Session 339's review round" item)

The test keeps the OLD spelling of the stderr handler of `quarto preview` as its oracle (append every chunk to one string, `parseBrowseUrl` the whole string after each chunk) and compares the new scanner with it over every
split into one to three chunks of every string of an enumeration, and over seeded random documents. Its pinned counts (how many (string, split) pairs were compared, how many the old spelling ever answered, and at which
push) must not come from the code under test, or a comparison could pass by both being wrong the same way. This script shares no code with the TypeScript and uses no regular expression:

    a line:       the text up to a "\\n"; the text after the LAST "\\n" is an incomplete line and can never answer.
    SGR escape:   ESC, "[", digits and semicolons, "m"; removed in ONE left-to-right pass (the removal is not run again on its own result), line by line (an escape holds no "\\n").
    a match:      in a stripped line, "Browse at", then one or more blanks (space or tab), then "http://" or "https://", then one or more characters that are none of space, tab, CR, LF (the URL: all of that run),
                  then only spaces, tabs and carriage returns up to the end of the line. The leftmost "Browse at" that completes wins.
    the answer:   the first complete line that matches. It is answered at the first push whose text, all pushes so far joined, reaches that line's newline.

    python3 -I tools/preview-scan-count/count_answers.py              # every count, about 2 seconds
    python3 -I tools/preview-scan-count/count_answers.py E1           # one of them (E1, E2, E3, E4)

It prints one line per count: the label, the pairs compared, how many the old spelling answered, and where it answered. Compare them with the numbers of the test: the `compared`, `answered` and `answeredAt` of the three
entries of `ENUMERATIONS` (E1 and E3 are token enumerations of up to five tokens, E2 puts two escapes into the marker line; `answeredAt` is how many were answered at the first, the second and the third push) and the
two literals of the seeded row (E4: the `answered` documents of `SEEDED_COUNT`, and the sum of the pushes at which they were answered).

The seeded count reproduces the test's generator: Mulberry32 (`seededRandom` of `test/unit/support/regex-equivalence.ts`) seeded with 341, then the same lists and the same draws in the same order as the seeded row of
the test. If the lists, the draws or the seed change, change them here too.
"""
import itertools
import sys

# ---- the enumerations: token lists and the longest string, as in the test ----
E1_TOKENS = ["Browse at", " ", "\t", "\r", "\n", "http://x", "x"]
# E2 is not a token enumeration: the line "Browse at http://x\n" with TWO of these inserted, at any two places (the first at or before the second).
E2_BASE = "Browse at http://x\n"
E2_INSERTS = ["\x1b[0m", "\x1b[3m", "\x1b[", "\x1b", "[0m", "\x1b[32;1m"]
E3_TOKENS = ["Browse at http://x\n", "\x1b", "[", "3", "m", "x"]
MAX_TOKENS = 5

# ---- the seeded row ----
SEED = 341
SEEDED_COUNT = 30_000
SGRS = ["\x1b[32m", "\x1b[39m", "\x1b[4m", "\x1b[0m", "\x1b[1;31m", "\x1b[", "\x1b"]
NOISE = ["processing file: sample.qmd", "Output created: sample.html", "Watching files for changes", "  1/12 [unnamed-chunk-1]", "Browse", " at", "Browse at", "http://localhost:3958/", ""]
BLANKS = ["", " ", "\t", " \t ", "\r", "\r\r"]
GAPS = [" ", "\t", "  "]
URLS = ["http://localhost:3958/", "https://x.y/z", "http://a", "https://localhost:1/#f"]
BROKEN = ["Browse at ftp://z/\n", "Browse athttp://x/\n", "Browse at http://\n", "Browse at http://x/ y\n", "browse at http://x/\n", "Browse at http://x/\rz\n", "Browse at http://x/"]

M32 = 0xFFFFFFFF


def mulberry32(seed):
    """`seededRandom`: the state steps by 0x6d2b79f5 and is mixed with two 32-bit multiplications; every value is kept as an unsigned 32-bit integer."""
    state = seed & M32

    def next_value():
        nonlocal state
        state = (state + 0x6D2B79F5) & M32
        t = ((state ^ (state >> 15)) * (1 | state)) & M32
        t = (t + (((t ^ (t >> 7)) * (61 | t)) & M32)) & M32 ^ t
        return ((t ^ (t >> 14)) & M32) / 4294967296

    return next_value


def strip_sgr(line):
    """Remove every `ESC [ digits-and-semicolons m` in one left-to-right pass."""
    out = []
    i = 0
    n = len(line)
    while i < n:
        if line[i] == "\x1b" and i + 1 < n and line[i + 1] == "[":
            j = i + 2
            while j < n and line[j] in "0123456789;":
                j += 1
            if j < n and line[j] == "m":
                i = j + 1
                continue
        out.append(line[i])
        i += 1
    return "".join(out)


def matches(text):
    """Does this stripped line (its newline implied) hold a `Browse at <http(s) URL>` ending the line?"""
    marker = "Browse at"
    start = 0
    while True:
        at = text.find(marker, start)
        if at == -1:
            return False
        k = at + len(marker)
        j = k
        while j < len(text) and text[j] in " \t":
            j += 1
        if j > k and text.startswith("http", j):
            m = j + 4
            if m < len(text) and text[m] == "s":
                m += 1
            if text.startswith("://", m):
                u = m + 3
                e = u
                while e < len(text) and text[e] not in " \t\r\n":
                    e += 1
                if e > u and all(ch in " \t\r" for ch in text[e:]):
                    return True
        start = at + 1


def answer_end(text):
    """The number of characters a push must have reached for the old spelling to answer (the position just past the newline of the first matching line), or None if it never answers."""
    lines = text.split("\n")
    reached = 0
    for line in lines[:-1]:
        reached += len(line) + 1
        if matches(strip_sgr(line)):
            return reached
    return None


def every_string(tokens, max_tokens):
    yield ""
    for length in range(1, max_tokens + 1):
        for combo in itertools.product(tokens, repeat=length):
            yield "".join(combo)


def every_insertion(base, inserts):
    """The base line with `x` put at place `i` and `y` at place `j` (of the BASE, i <= j), for every `x` and `y` of the list."""
    for i in range(len(base) + 1):
        for j in range(i, len(base) + 1):
            for x in inserts:
                for y in inserts:
                    yield base[:i] + x + base[i:j] + y + base[j:]


def count_enumeration(strings):
    """Every split into one, two or three chunks (a cut may fall anywhere, so a chunk may be empty): where does each answer?"""
    compared = 0
    answered = 0
    at_push = [0, 0, 0]
    for text in strings:
        n = len(text)
        need = answer_end(text)
        compared += 1
        if need is not None:
            answered += 1
            at_push[0] += 1
        for a in range(n + 1):
            compared += 1
            if need is not None:
                answered += 1
                at_push[0 if a >= need else 1] += 1
            for b in range(a, n + 1):
                compared += 1
                if need is not None:
                    answered += 1
                    at_push[0 if a >= need else (1 if b >= need else 2)] += 1
    return compared, answered, at_push


def seeded_line(rand):
    kind = int(rand() * 5)
    if kind == 0:
        line = ""
        for _ in range(1 + int(rand() * 3)):
            line += NOISE[int(rand() * len(NOISE))]
            if rand() < 0.3:
                line += SGRS[int(rand() * len(SGRS))]
        return line + "\n"
    if kind == 1:
        line = ""
        if rand() < 0.3:
            line += NOISE[int(rand() * len(NOISE))] + " "
        line += "Browse at"
        if rand() < 0.3:
            line += SGRS[int(rand() * len(SGRS))]
        line += GAPS[int(rand() * len(GAPS))]
        if rand() < 0.3:
            line += SGRS[int(rand() * len(SGRS))]
        line += URLS[int(rand() * len(URLS))]
        if rand() < 0.3:
            line += SGRS[int(rand() * len(SGRS))]
        line += BLANKS[int(rand() * len(BLANKS))]
        return line + "\n"
    if kind == 2:
        return BROKEN[int(rand() * len(BROKEN))]
    if kind == 3:
        line = SGRS[int(rand() * len(SGRS))]
        if rand() < 0.5:
            line += "\n"
        return line
    return "x" * (1 + int(rand() * 400)) + "\n"


def seeded_document(rand):
    text = ""
    for _ in range(1 + int(rand() * 8)):
        text += seeded_line(rand)
    if rand() < 0.33 and text.endswith("\n"):
        text = text[:-1]
    mode = int(rand() * 3)
    if mode == 0 and len(text) > 120:
        mode = 1
    if mode == 0:
        return text, [i + 1 for i in range(len(text))]
    if mode == 1:
        cuts = sorted(int(rand() * (len(text) + 1)) for _ in range(1 + int(rand() * 10)))
        return text, cuts + [len(text)]
    size = 1 + int(rand() * 64)
    return text, [min(at + size, len(text)) for at in range(0, len(text), size)] or [0]


def count_seeded():
    """For a split given by the end of each chunk: the old spelling answers at the first chunk whose end reaches the newline of the first matching line."""
    rand = mulberry32(SEED)
    compared = 0
    answered = 0
    at_sum = 0
    for _ in range(SEEDED_COUNT):
        text, ends = seeded_document(rand)
        compared += 1
        need = answer_end(text)
        if need is not None:
            answered += 1
            at_sum += next(i for i, end in enumerate(ends) if end >= need)
    return compared, answered, at_sum


COUNTS = {
    "E1": lambda: count_enumeration(every_string(E1_TOKENS, MAX_TOKENS)),
    "E2": lambda: count_enumeration(every_insertion(E2_BASE, E2_INSERTS)),
    "E3": lambda: count_enumeration(every_string(E3_TOKENS, MAX_TOKENS)),
    "E4": count_seeded,
}

if __name__ == "__main__":
    wanted = sys.argv[1:] or list(COUNTS)
    for label in wanted:
        compared, answered, where = COUNTS[label]()
        print(f"{label}: compared {compared:,}  answered {answered:,}  {'answeredAt' if label != 'E4' else 'sum of pushes'} {where}")
