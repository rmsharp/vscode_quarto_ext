#!/usr/bin/env python3
"""Recount the pinned numbers of `test/unit/cell-vdoc-builder-equivalence.test.ts` from the DEFINITION of a fence, not from the project's code (Session 341, part 2 of the "Slow shapes and residuals found by Session 339's
review round" item).

The test compares `createCellVdocBuilder(text)` (`src/core/embedded/virtual-doc.ts`) with the OLD `buildCellVirtualContent` and with `findCellAtPosition` over every document of a line alphabet, and pins how much that
reached: how many documents, how many cells the model finds, how many of those map to a forwarding target, how many are python, how many vdocs start with the mute, how many kept lines they hold and how many `cellAt`
questions were asked. Those numbers must not come from the code under test, or a comparison could pass by both being wrong the same way. This script shares no code with the TypeScript, uses no regular expression and
no `text.split`:

    cell:       a line that is exactly three backticks and `{name}` opens a cell of language `name` when nothing is open; a line that is exactly three backticks opens a plain block when nothing is open; while a block is open
                only a line of exactly three backticks closes it (any other line, a fence with an info string included, is body); a block that is never closed is dropped (a cell nothing closes is no cell: the model says so).
    body:       the lines between the fences.
    options:    the cell's LEADING run of lines equal to `#| echo: false` (the only option line of the alphabets): a `#|` line under any other line is code.
    kept:       the lines after the options, EXCEPT that a body whose joined text is empty (no line, or one blank line) keeps nothing: the count of body lines of such a cell is zero.
    mute:       a python cell with a kept line that is not whitespace only (Python `strip`, which for the ASCII of these alphabets is what `trim` is).
    keptLines:  the kept lines that are not the empty string, as the vdoc holds them: a CRLF document keeps the `\\r` of every body line, so a blank body line is `\\r`, which is not empty.
    cellAt:     for each document, one question for every line from -1 to two past the last, that is (the number of lines + 3).

    python3 -I tools/cell-vdoc-count/count_cells.py          # both, about a second
    python3 -I tools/cell-vdoc-count/count_cells.py E1       # one of them (E1, E2)

It prints one line per enumeration: docs, cells, mapped, python, mutes, keptLines, cellAtChecks. Compare them with the numbers of the test (the `counts(tally)` rows of E1 and E2).

The alphabets reproduce the test's: if its lines or its lengths change, change them here too.
"""
import itertools
import sys

MAPPED = {"python", "r", "julia", "ojs", "js"}
OPTION = "#| echo: false"

E1 = (
    {"a": "```{python}", "b": "```{r}", "c": "```{bash}", "d": "```", "e": OPTION, "f": "x = 1", "g": "", "h": "  ", "i": "prose", "j": "# Heading"},
    5,
    ["\n", "\r\n"],
)
E2 = (
    {"a": "```{python}", "b": "```{r}", "d": "```", "e": OPTION, "f": "x = 1", "g": ""},
    7,
    ["\n"],
)


def words(symbols, max_length):
    """Every word of 0..max_length symbols, the empty one included."""
    yield ""
    for length in range(1, max_length + 1):
        for word in itertools.product(symbols, repeat=length):
            yield "".join(word)


def cells_of(lines):
    """The closed cells of a list of lines, as (language, body lines)."""
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
                found.append((open_lang, lines[open_at + 1:i]))
            open_kind = None
    return found


def count(spec):
    alphabet, max_length, endings = spec
    docs = cells = mapped = python = mutes = kept_lines = cell_at = 0
    for word in words(sorted(alphabet), max_length):
        logical = [alphabet[s] for s in word] if word else [""]
        for ending in endings:
            docs += 1
            cell_at += len(logical) + 3
            for lang, body in cells_of(logical):
                cells += 1
                if lang in MAPPED:
                    mapped += 1
                if lang == "python":
                    python += 1
                # The leading option run, then what is kept (nothing when the body is empty or one blank line).
                k = 0
                while k < len(body) and body[k] == OPTION:
                    k += 1
                nothing = len(body) == 0 or (len(body) == 1 and body[0] == "")
                kept = [] if nothing else body[k:]
                # A CRLF document: every body line is followed by a line end, so it holds its `\r`.
                physical = [line + ("\r" if ending == "\r\n" else "") for line in kept]
                kept_lines += sum(1 for line in physical if line != "")
                if lang == "python" and any(line.strip() != "" for line in physical):
                    mutes += 1
    return docs, cells, mapped, python, mutes, kept_lines, cell_at


def main():
    wanted = sys.argv[1:] or ["E1", "E2"]
    for name, spec in (("E1", E1), ("E2", E2)):
        if name in wanted:
            docs, cells, mapped, python, mutes, kept_lines, cell_at = count(spec)
            print(f"{name}: docs {docs} cells {cells} mapped {mapped} python {python} mutes {mutes} keptLines {kept_lines} cellAtChecks {cell_at}")


if __name__ == "__main__":
    main()
