#!/usr/bin/env python3
"""Recount the pinned numbers of `test/unit/raw-tex-end-pops-equivalence.test.ts` from the DEFINITION of the rule, not from the project's code (Session 340, part 1 of the "Slow shapes and residuals found by Session 339's review round" item)

The test keeps the OLD spelling of the raw-TeX probe in `computeRegions` (`src/core/qmd/model.ts` at `9238682`) as its oracle: copy the whole stack of open environments, then for each `\\end{name}` on the line, in
order, pop the copy when its top is that name. Those numbers (how many (stack, line) pairs pop at least once, and how many pops in all) must not come from the code under test, or a comparison could pass by both being
wrong the same way. This script shares no code with the TypeScript and uses no regular expression:

    names of a line:  the leftmost `\\end{` starts one; its name is everything up to the FIRST `}` after the `{`; the next search starts AFTER that `}`; an `\\end{` with no `}` after it ends the scan.
    pops:             read the names in order against a stack; a name equal to the innermost open environment closes it (one pop) and exposes the next one; any other name closes nothing.

    python3 -I tools/raw-tex-pops-count/count_pops.py              # every count, about 20 seconds
    python3 -I tools/raw-tex-pops-count/count_pops.py "E1"         # one of them (E1, E2, E3)

It prints one line per count: the label, the number of pairs, how many pop at least once, and the pops in all. Compare them with the constants of the test (`ENUMERATIONS`, `SEEDED`).

The seeded count reproduces the test's generator: Mulberry32 (`seededRandom` of `test/unit/support/regex-equivalence.ts`) seeded with 340, then the same pools, pieces and draws as the seeded row. If the alphabets, token
lists, pools, pieces or seed change, change them here too.
"""
import itertools
import sys

END = "\\end{"

# The stack symbols of the enumerations, and the name each stands for (the third is the EMPTY name).
STACK_NAMES = {"a": "a", "b": "b", "c": ""}
TOKENS_1 = [END + "a}", END + "b}", END + "}", END, "}", "x"]
TOKENS_2 = [END + "a}", END + "b}", "x"]

POOL = ["a", "b", "c", "", "a b", "A"]
PIECES = [END + "a}", END + "b}", END + "c}", END + "}", END + "a b}", END + "A}", END, "}", "x", " ", END + "a}" + END + "b}", END + "b}" + END + "a}"]
SEED = 340
SEEDED_COUNT = 1_000_000

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


def names_of(line):
    """The names of the `\\end{name}` delimiters on one line, by the rule above, with no regular expression."""
    names = []
    at = 0
    while True:
        open_at = line.find(END, at)
        if open_at == -1:
            return names
        close = line.find("}", open_at + 5)
        if close == -1:
            return names
        names.append(line[open_at + 5 : close])
        at = close + 1


def pops(stack, line):
    """How many environments of `stack` the line closes: the names are read in order against the top of the stack as it is left by the pops so far."""
    top = len(stack)
    count = 0
    for name in names_of(line):
        if top > 0 and stack[top - 1] == name:
            top -= 1
            count += 1
    return count


def every_string(alphabet, max_length):
    yield ()
    for length in range(1, max_length + 1):
        yield from itertools.product(alphabet, repeat=length)


def enumerate_pairs(stack_alphabet, stack_max, tokens, line_max):
    lines = ["".join(t) for t in every_string(tokens, line_max)]
    for symbols in every_string(stack_alphabet, stack_max):
        stack = [STACK_NAMES[s] for s in symbols]
        for line in lines:
            yield stack, line


def seeded_pairs(seed, count):
    nxt = mulberry32(seed)
    for _ in range(count):
        depth = int(nxt() * 13)
        stack = [POOL[int(nxt() * len(POOL))] for _ in range(depth)]
        line = ""
        for _ in range(int(nxt() * 15)):
            line += PIECES[int(nxt() * len(PIECES))] * (1 + int(nxt() * 3))
        yield stack, line


def count(pairs):
    compared = popping = total = 0
    for stack, line in pairs:
        compared += 1
        n = pops(stack, line)
        if n > 0:
            popping += 1
            total += n
    return compared, popping, total


COUNTS = {
    "E1": lambda: enumerate_pairs("abc", 4, TOKENS_1, 5),
    "E2": lambda: enumerate_pairs("ab", 6, TOKENS_2, 8),
    "E3": lambda: seeded_pairs(SEED, SEEDED_COUNT),
}

if __name__ == "__main__":
    wanted = sys.argv[1:] or list(COUNTS)
    for label in wanted:
        compared, popping, total = count(COUNTS[label]())
        print(f"{label}: pairs {compared:,}  popping {popping:,}  pops {total:,}")
