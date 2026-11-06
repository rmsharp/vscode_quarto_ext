#!/usr/bin/env python3
"""Recount the pinned numbers of `test/unit/yaml-region-lookup-equivalence.test.ts` from the DEFINITION of a region, not from the project's code (Session 342, part 2 of the "What Session 341's review round found beside
the Outline and preview cures" item).

The test compares `createYamlRegionLookup(regions)` (`src/core/qmd/quarto-yaml-regions.ts`) with the OLD `inQuartoYamlRegion(regions, line)` over every array and every line of three enumerations, and pins how much
that reached: how many arrays, how many questions, how many answered "inside", and (E1) how many arrays are ordered by definition, which is the set the lookup is allowed to answer by a binary search. Those numbers must
not come from the code under test, or a comparison could pass by both being wrong the same way. This script shares no code with the TypeScript, uses no regular expression and no `Array.prototype.some`:

    inside:    a line is inside a region when start <= line and line <= end, both IEEE comparisons (so a NaN bound or a NaN line is never inside, -0 equals 0, an infinity compares as itself).
               A line is inside an ARRAY when it is inside at least one of its regions.
    ordered:   every region has start <= end, and every region after the first starts strictly after the one before ends (end(i-1) < start(i)). A NaN fails both, an equal end and start fails the second.
    E1:        every array of 0, 1, 2 and 3 regions, each region one of the 9 x 9 pairs of the bound pool, asked every line of the line pool.
    E2:        every array of 0 to 5 regions built by a GAP and a WIDTH for each region (gap 1, 2 or 3 lines after the previous end, width 0, 1 or 2), the first measured from line -1; asked every half line from -1 to the
               last end plus 1.
    E3:        the arrays of m regions [3i, 3i + 1] for m = 0 to 300, asked every half line from -1 to 3m + 1.

    python3 -I tools/yaml-region-count/count_regions.py          # all three, a few seconds
    python3 -I tools/yaml-region-count/count_regions.py E1       # one of them (E1, E2, E3)

It prints one line per enumeration. Compare them with the numbers of the test (the `counts` rows of E1, E2 and E3). The pools reproduce the test's: if its pools or its lengths change, change them here too.
"""
import itertools
import sys

NAN = float("nan")
INF = float("inf")

# The pool of bounds (nine) and the pool of lines (thirteen) of E1.
BOUNDS = [-INF, -1.0, -0.0, 0.0, 0.5, 1.0, 2.0, NAN, INF]
LINES = [-INF, -1.0, -0.5, -0.0, 0.0, 0.25, 0.5, 1.0, 1.5, 2.0, 3.0, NAN, INF]


def inside_region(start, end, line):
    return start <= line and line <= end


def inside_array(regions, line):
    for start, end in regions:
        if inside_region(start, end, line):
            return True
    return False


def ordered(regions):
    previous_end = None
    for start, end in regions:
        if not (start <= end):
            return False
        if previous_end is not None and not (previous_end < start):
            return False
        previous_end = end
    return True


def e1():
    pairs = [(s, e) for s in BOUNDS for e in BOUNDS]
    # The set of lines (by index) each pair holds: an array holds the union, so a count needs no loop over the regions' lines for every array.
    holds = [frozenset(i for i, line in enumerate(LINES) if inside_region(s, e, line)) for s, e in pairs]
    arrays = asks = trues = ordered_arrays = ordered_asks = ordered_trues = 0
    for length in range(0, 4):
        for picks in itertools.product(range(len(pairs)), repeat=length):
            regions = [pairs[p] for p in picks]
            held = frozenset().union(*[holds[p] for p in picks]) if picks else frozenset()
            arrays += 1
            asks += len(LINES)
            trues += len(held)
            if ordered(regions):
                ordered_arrays += 1
                ordered_asks += len(LINES)
                ordered_trues += len(held)
    return arrays, asks, trues, ordered_arrays, ordered_asks, ordered_trues


def half_lines(first, last):
    """Every multiple of one half from first to last, both included."""
    k = int(first * 2)
    while k <= int(last * 2):
        yield k / 2
        k += 1


def e2():
    arrays = asks = trues = 0
    for length in range(0, 6):
        for shape in itertools.product(itertools.product((1, 2, 3), (0, 1, 2)), repeat=length):
            regions = []
            current = -1
            for gap, width in shape:
                start = current + gap
                end = start + width
                regions.append((start, end))
                current = end
            arrays += 1
            for line in half_lines(-1, current + 1):
                asks += 1
                if inside_array(regions, line):
                    trues += 1
    return arrays, asks, trues


def e3():
    arrays = asks = trues = 0
    for m in range(0, 301):
        regions = [(3 * i, 3 * i + 1) for i in range(m)]
        arrays += 1
        for line in half_lines(-1, 3 * m + 1):
            asks += 1
            if inside_array(regions, line):
                trues += 1
    return arrays, asks, trues


def main():
    wanted = sys.argv[1:] or ["E1", "E2", "E3"]
    if "E1" in wanted:
        a, q, t, oa, oq, ot = e1()
        print(f"E1: arrays {a} asks {q} inside {t} orderedArrays {oa} orderedAsks {oq} orderedInside {ot}")
    if "E2" in wanted:
        a, q, t = e2()
        print(f"E2: arrays {a} asks {q} inside {t}")
    if "E3" in wanted:
        a, q, t = e3()
        print(f"E3: arrays {a} asks {q} inside {t}")


if __name__ == "__main__":
    main()
