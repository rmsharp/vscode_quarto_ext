#!/usr/bin/env python3
"""Count how often the OLD paragraph-interrupt scan answers `true` over the exhaustive rows of `test/unit/paragraph-interrupt-equivalence.test.ts`, from the code-depth rule and a hand classification of the lines, not from the project's code (Session 332).

The test pins how many comparisons of its exhaustive row the old expression answers `true` for (`ANSWERED.exhaustive` of `ANSWERED.compared`). Those numbers must not come from the code under test, or a
comparison could pass by both being wrong the same way. This script derives them from two facts:

    a line interrupts a paragraph when it matches the interrupt list (a block start: an ATX heading, a bullet, a thematic break, an HTML-ish opener, ...) AND it is not INDENTED CODE;
    a line at indent column `col` is indented code when `col >= base + 4`, where `base` is the deepest open container column not past `col` (column 0 is always open).

The ten lines of the reduced alphabet are classified by hand below (is the line a block start, and at which column does it sit). The window is the paragraph's lines below its first:
`lines[max(0, len - w) + 1:]` for a count `w` above 1, and empty otherwise.

    python3 -I tools/paragraph-interrupt-count/count_answered.py     # prints: 11111 790120 422640  (lists, comparisons, answered true)
                                                                     #         11111 3023320 904840 (the same lists asked after EVERY line, the "keeps what it has read" row)

If the test's alphabet, list length, count range or column sets change, change them here too, and compare the two lines this prints with the `ANSWERED` constants (the first line) and the `WARM_ANSWERED` constants (the second). The seeded row's count has no second
implementation (it draws from a 42-line alphabet with a generator of its own): it is counted from the old spelling in the test alone.
"""
import itertools

SYMS = ["x", "#x", "    four spaces", "# H", "<span>a</span>", "- b", "    - b", "      - b", "---", ""]
# (does the line match the interrupt list, the column its text starts at). `#x` is no ATX heading, `    four spaces` and the empty line match nothing.
PATTERN = {
    "x": (False, 0),
    "#x": (False, 0),
    "    four spaces": (False, 4),
    "# H": (True, 0),
    "<span>a</span>": (True, 0),
    "- b": (True, 0),
    "    - b": (True, 4),
    "      - b": (True, 6),
    "---": (True, 0),
    "": (False, 0),
}
COLUMN_SETS = [[], [2], [4], [2, 4], [3], [2, 6], [5], [0, 2]]
MAX_LENGTH = 4


def interrupts(symbol, columns):
    block_start, col = PATTERN[symbol]
    if not block_start:
        return False
    base = max(c for c in [0] + columns if c <= col)
    return not (col >= base + 4)


def main_after_every_line():
    """The second row: the same lists, the paragraph asked about after each line is added (prefix lengths 0 to L), for every count from -1 to the prefix's length + 3."""
    lists = compared = answered = 0
    for length in range(0, MAX_LENGTH + 1):
        for picks in itertools.product(range(len(SYMS)), repeat=length):
            lists += 1
            for upto in range(0, length + 1):
                lines = [SYMS[i] for i in picks[:upto]]
                for w in range(-1, upto + 4):
                    for columns in COLUMN_SETS:
                        compared += 1
                        if w > 1 and any(interrupts(t, columns) for t in lines[max(0, upto - w) + 1 :]):
                            answered += 1
    print(lists, compared, answered)


def main():
    lists = compared = answered = 0
    for length in range(0, MAX_LENGTH + 1):
        for picks in itertools.product(range(len(SYMS)), repeat=length):
            lists += 1
            lines = [SYMS[i] for i in picks]
            for w in range(-1, length + 4):
                for columns in COLUMN_SETS:
                    compared += 1
                    if w > 1 and any(interrupts(t, columns) for t in lines[max(0, length - w) + 1 :]):
                        answered += 1
    print(lists, compared, answered)


if __name__ == "__main__":
    main()
    main_after_every_line()
