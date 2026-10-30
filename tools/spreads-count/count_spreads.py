#!/usr/bin/env python3
"""Recount the exhaustive rows of `test/unit/spreads-equivalence.test.ts` from the DEFINITION of what they enumerate, not from the project's code (Session 338, part E).

The test keeps the two OLD spellings (a call with a spread argument: `result.push(...flattenOutline(...))` in `flattenOutline` and `all.push(...parseCitations(content))` in the citation adapter) beside the cures and
compares them over every input of two small families. Those counts must not come from the code under test, or a comparison could pass by both being wrong the same way. This script shares no code with the TypeScript.

    forests: every ordered forest of 0 to 8 nodes, each node a heading or a cell. A forest is read as its depth sequence: node 0 has depth 0 and each later node has a depth between 0 and the
             previous node's depth plus one (a node can be a child of the previous node, a sibling of it, or a sibling of one of its ancestors). The script ENUMERATES the sequences one by one and
             does not use a closed formula; the number of kind assignments of a forest of n nodes is 2^n. The test compares each (forest, kinds) twice, once with the default container name and once with an explicit one.
    pairs:   every pair (target, more) of strings of 0 to 4 characters over a 3-letter alphabet, each string read as a list of citations (one per character), and every string once with itself as both lists
             (the aliased call `appendCitations(x, x)`).

    python3 -I tools/spreads-count/count_spreads.py      # prints one line per row: the label, then the counts the test pins

The seeded row of the test draws from a generator of its own: its count has no second implementation and is counted from the old spelling in the test alone.
"""
import itertools

MAX_NODES = 8
ALPHABET = 3
MAX_LEN = 4


def depth_sequences(n):
    """Every depth sequence of length n: d0 = 0, then 0 <= d(i+1) <= d(i) + 1."""
    if n == 0:
        yield ()
        return

    def extend(prefix):
        if len(prefix) == n:
            yield tuple(prefix)
            return
        for depth in range(0, prefix[-1] + 2):
            prefix.append(depth)
            yield from extend(prefix)
            prefix.pop()

    yield from extend([0])


def main():
    forests_total = 0
    kinded_total = 0
    nodes_total = 0
    roots_total = 0
    for n in range(0, MAX_NODES + 1):
        forests = 0
        roots = 0
        for seq in depth_sequences(n):
            forests += 1
            roots += sum(1 for d in seq if d == 0)
        kinded = forests * 2**n
        forests_total += forests
        kinded_total += kinded
        nodes_total += kinded * n
        roots_total += roots * 2**n
        print(f"forests n={n}: forests={forests} kinded={kinded}")
    print(f"forests total: forests={forests_total} kinded={kinded_total} compared={2 * kinded_total} nodes={nodes_total} roots={roots_total}")

    strings = sum(ALPHABET**k for k in range(0, MAX_LEN + 1))
    print(f"strings over {ALPHABET} letters up to {MAX_LEN}: {strings}")
    print(f"pairs: {strings * strings}")
    print(f"aliased: {strings}")
    # The total elements the pairs hold, to pin that the family is not empty of structure: every pair counts its two lists' lengths.
    elements = 0
    for target in itertools.chain.from_iterable(itertools.product(range(ALPHABET), repeat=k) for k in range(0, MAX_LEN + 1)):
        for more in itertools.chain.from_iterable(itertools.product(range(ALPHABET), repeat=k) for k in range(0, MAX_LEN + 1)):
            elements += len(target) + len(more)
    print(f"pair elements: {elements}")


if __name__ == "__main__":
    main()
