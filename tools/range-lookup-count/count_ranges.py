#!/usr/bin/env python3
"""Recount the pinned numbers of `test/unit/range-lookup-equivalence.test.ts` from the DEFINITION of a body line, not from the project's code (Session 342, part 3 of the "What Session 341's review round found beside
the Outline and preview cures" item).

The test compares `createRangeLookup(text)` (`src/core/embedded/virtual-doc.ts`) with the OLD per-line spelling (`embeddedCellAt`, and the loops of `filterOutOfCellEdits` and `rangeWithinCell`) over every document of a
line alphabet, and pins how much that reached: how many documents, how many cells the model finds, how many whole-number lines were asked of `hitAt` and how many of those are hits, how many (start, end) ranges were asked,
how many of them each language check keeps, and how many (range, cell) pairs `rangeInCellBody` keeps. Those numbers must not come from the code under test, or a comparison could pass by both being wrong the same way.
This script shares no code with the TypeScript, uses no regular expression and no `text.split`:

    cell:       a line that is exactly three backticks and `{name}` opens a cell of language `name` when nothing is open; a line that is exactly three backticks opens a plain block when nothing is open; while a block is
                open only a line of exactly three backticks closes it (any other line is body); a block that is never closed is dropped (a cell nothing closes is no cell: the model says so).
    body:       the lines between the fences. A body of no line, or of one blank line, is an EMPTY code string: the cell has no body line at all (the documented edge). Otherwise it has as many body lines as the body has lines.
    options:    the cell's LEADING run of lines equal to `#| echo: false` (the only option line of the alphabets).
    hit:        a whole-number line `i` is a hit when it is one of the cell's body lines that is not an option line, and the cell's engine maps to a language: `python` to python, `r` to r (`bash` maps to none,
                and neither does `Python`: the engine token is read as written, so an upper-case token is no mapped engine and its cell has no hit).
    lines:      for each document, one question for every line from -1 to two past the last, that is (the number of lines + 3).
    ranges:     for each document, every start from -1 to one past the last line against every end from -1 to one past the last line, start above end included: (the number of lines + 3) squared of them. A range
                `start..end` has the lines `start, start + 1, ..., end` (none when start is above end).
    language:   a range is kept for a language when EVERY line of it is a hit of that language (a range with no line is kept for every language, `javascript` included, which no alphabet uses).
    cell:       a range is kept for a cell when EVERY line of it is a hit and the cell holding the line (fences included) is that very cell.

    python3 -I tools/range-lookup-count/count_ranges.py          # all four, under a minute
    python3 -I tools/range-lookup-count/count_ranges.py R1       # one of them (H1, H2, R1, R2)

It prints one line per enumeration. Compare them with the numbers of the test (the `counts` rows of H1, H2, R1 and R2).

The alphabets reproduce the test's: if its lines or its lengths change, change them here too.
"""
import itertools
import sys

OPTION = "#| echo: false"
MAPPED = {"python": "python", "r": "r"}
LANGS = ("python", "r", "javascript")

LINES_1 = {"a": "```{python}", "b": "```{r}", "c": "```{bash}", "d": "```", "e": OPTION, "f": "x = 1", "g": "", "h": "  ", "i": "prose", "j": "# Heading", "k": "```{Python}"}
LINES_2 = {"a": "```{python}", "b": "```{r}", "d": "```", "e": OPTION, "f": "x = 1", "g": ""}

SPECS = {
    "H1": (LINES_1, 5, False),
    "H2": (LINES_2, 7, False),
    "R1": (LINES_1, 4, True),
    "R2": (LINES_2, 5, True),
}


def words(symbols, max_length):
    """Every word of 0..max_length symbols, the empty one included."""
    yield ""
    for length in range(1, max_length + 1):
        for word in itertools.product(symbols, repeat=length):
            yield "".join(word)


def cells_of(lines):
    """The closed cells of a list of lines, as (language, open line, close line, body lines)."""
    found = []
    open_kind = None
    open_lang = ""
    open_at = 0
    for i, line in enumerate(lines):
        if open_kind is None:
            if line == "```":
                open_kind, open_lang, open_at = "plain", "", i
            elif len(line) > 4 and line[:4] == "```{" and line[-1] == "}":
                open_kind, open_lang, open_at = "cell", line[4:-1], i
        elif line == "```":
            if open_kind == "cell":
                found.append((open_lang, open_at, i, lines[open_at + 1:i]))
            open_kind = None
    return found


def hits_of(cells):
    """line -> (language, start line of its cell), for every whole-number hit line."""
    hit = {}
    for lang, open_at, _close_at, body in cells:
        if lang not in MAPPED:
            continue
        count = 0 if (len(body) == 0 or (len(body) == 1 and body[0] == "")) else len(body)
        run = 0
        while run < count and body[run] == OPTION:
            run += 1
        for i in range(open_at + 1 + run, open_at + 1 + count):
            hit[i] = (MAPPED[lang], open_at)
    return hit


def count(spec):
    alphabet, max_length, ranges = spec
    docs = cells = line_asks = hits = pairs = cell_asks = cell_kept = 0
    kept = {name: 0 for name in LANGS}
    for word in words(sorted(alphabet), max_length):
        logical = [alphabet[s] for s in word] if word else [""]
        total = len(logical)
        found = cells_of(logical)
        hit = hits_of(found)
        docs += 1
        cells += len(found)
        for line in range(-1, total + 2):
            line_asks += 1
            if line in hit:
                hits += 1
        if not ranges:
            continue
        for start in range(-1, total + 2):
            for end in range(-1, total + 2):
                pairs += 1
                span = range(start, end + 1)
                for name in LANGS:
                    if all(line in hit and hit[line][0] == name for line in span):
                        kept[name] += 1
                for _lang, open_at, _close_at, _body in found:
                    cell_asks += 1
                    if all(line in hit and hit[line][1] == open_at for line in span):
                        cell_kept += 1
    return docs, cells, line_asks, hits, pairs, kept, cell_asks, cell_kept


def main():
    wanted = sys.argv[1:] or ["H1", "H2", "R1", "R2"]
    for name in ("H1", "H2", "R1", "R2"):
        if name in wanted:
            docs, cells, line_asks, hits, pairs, kept, cell_asks, cell_kept = count(SPECS[name])
            line = f"{name}: docs {docs} cells {cells} lineAsks {line_asks} hits {hits}"
            if SPECS[name][2]:
                line += f" pairs {pairs} python {kept['python']} r {kept['r']} javascript {kept['javascript']} cellAsks {cell_asks} cellKept {cell_kept}"
            print(line)


if __name__ == "__main__":
    main()
