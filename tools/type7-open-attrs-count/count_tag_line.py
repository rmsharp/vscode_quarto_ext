#!/usr/bin/env python3
# Recount of the pinned counts of test/unit/type7-open-attrs-equivalence.test.ts (Session 337).
# usage: python3 -I tools/type7-open-attrs-count/count_tag_line.py [enum|seeded|sweep|all]
# Run it with `python3 -I`; the tools/ directory is not packaged (.vscodeignore).
# Session 337 ran it and compared its output with the pinned counts of the test named above (accepted counts of E1 to E6, the seeded sample and the sweep): all equal. The strings totals are computed by the test from its alphabets.
# Independent recount of the Session 337 type-7 equivalence counts. Shares no code with the TypeScript.
# Two readings of the old pattern: Python `re` (with \Z for the end, since Python's $ also matches before a final newline)
# and a set-of-states machine written from the grammar in prose. They must agree with each other and with the TS counts.
import itertools, re, sys

OLD = re.compile(r'^ {0,3}(?:<[A-Za-z][A-Za-z0-9-]*(?:[ \t]+[A-Za-z_:][A-Za-z0-9_.:-]*(?:[ \t]*=[ \t]*(?:"[^"]*"|\'[^\']*\'|[^ \t"\'=<>`]+))?)*[ \t]*/?>|</[A-Za-z][A-Za-z0-9-]*[ \t]*>)[ \t]*\Z')

BLANK = ' \t'
ALNUM = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
LET = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')

def step(states, ch):
    out = set()
    for s in states:
        kind = s[0]
        if kind == 'indent':
            n = s[1]
            if ch == ' ' and n < 3:
                out.add(('indent', n + 1))
            if ch == '<':
                out.add(('lt',))
        elif kind == 'lt':
            if ch in LET:
                out.add(('tagname',))
            if ch == '/':
                out.add(('closeslash',))
        elif kind in ('tagname', 'aftervalue', 'gap', 'attrname', 'nameblank', 'bare'):
            # every state in which the tag may end or another attribute may begin
            if ch == '/':
                out.add(('slash',))
            if ch == '>':
                out.add(('end',))
            if kind == 'tagname' and (ch in ALNUM or ch == '-'):
                out.add(('tagname',))
            if kind in ('tagname', 'aftervalue', 'attrname', 'bare') and ch in BLANK:
                out.add(('gap',) if kind != 'attrname' else ('nameblank',))
            if kind in ('gap', 'nameblank') and ch in BLANK:
                out.add((kind,))
            if kind in ('gap', 'nameblank') and (ch in LET or ch in '_:'):
                out.add(('attrname',))
            if kind == 'attrname' and (ch in ALNUM or ch in '_.:-'):
                out.add(('attrname',))
            if kind in ('attrname', 'nameblank') and ch == '=':
                out.add(('eq',))
            if kind == 'bare' and ch not in ' \t"\'=<>`':
                out.add(('bare',))
        elif kind == 'eq':
            if ch in BLANK:
                out.add(('eq',))
            elif ch == '"':
                out.add(('dq',))
            elif ch == "'":
                out.add(('sq',))
            elif ch not in '=<>`':
                out.add(('bare',))
        elif kind == 'dq':
            out.add(('aftervalue',) if ch == '"' else ('dq',))
        elif kind == 'sq':
            out.add(('aftervalue',) if ch == "'" else ('sq',))
        elif kind == 'slash':
            if ch == '>':
                out.add(('end',))
        elif kind == 'end':
            if ch in BLANK:
                out.add(('end',))
        elif kind == 'closeslash':
            if ch in LET:
                out.add(('closename',))
        elif kind == 'closename':
            if ch in ALNUM or ch == '-':
                out.add(('closename',))
            elif ch in BLANK:
                out.add(('closeblank',))
            elif ch == '>':
                out.add(('end',))
        elif kind == 'closeblank':
            if ch in BLANK:
                out.add(('closeblank',))
            elif ch == '>':
                out.add(('end',))
    return out

def machine(line):
    states = {('indent', 0)}
    for ch in line:
        states = step(states, ch)
        if not states:
            return False
    return ('end',) in states

def count(lines, label):
    compared = accepted = bad = 0
    for line in lines:
        compared += 1
        a = OLD.match(line) is not None
        b = machine(line)
        if a:
            accepted += 1
        if a != b:
            bad += 1
            if bad <= 5:
                print('  DISAGREE', repr(line), a, b)
    print(f'{label}: compared {compared} accepted {accepted} python-disagreements {bad}', flush=True)

def every(alphabet, maxlen):
    yield ''
    for n in range(1, maxlen + 1):
        for t in itertools.product(alphabet, repeat=n):
            yield ''.join(t)

def with_prefixes(prefixes, alphabet, maxlen):
    for p in prefixes:
        for t in every(alphabet, maxlen):
            yield p + t

WIDE = [' ', '\t', '/', '>', 'b', '=', '"', "'", '`', '<']
FRAMES = ['', ' ', ' <a', '   <a', '    <a', '<', '</', '</a', '<1', '<a_', '<a-1']
FRAME_TAIL = [' ', '\t', '<', '/', '>', 'a', '-', '=', '"']
PIECES = [' b', ' b=', 'c', '"c"', "'c'", ' ', '>', '/>', '\t']
CLOSER_TAIL = [' ', '\t', '>', 'a', '-', '/', '1']
ATTR_TAIL = ['=', ' ', '"', "'", 'c', '>', '/']
NAME_TAIL = [' ', '/', '>', 'b', '1', '-', '_', ':', '.', '=', '"', '<']

HEADS = [' <a1 b-c = d/ e>\t', '<a b="c" d=\'e\'/>', '</a1 >']

def sweep(heads):
    for head in heads:
        for at in range(len(head) + 1):
            for unit in range(0x10000):
                ch = chr(unit)
                yield head[:at] + ch + head[at:]
                if at < len(head):
                    yield head[:at] + ch + head[at + 1:]

def imul(a, b):
    return (a * b) & 0xFFFFFFFF

def mulberry32(seed):
    state = [seed & 0xFFFFFFFF]
    def nxt():
        state[0] = (state[0] + 0x6d2b79f5) & 0xFFFFFFFF
        s = state[0]
        t = imul(s ^ (s >> 15), 1 | s)
        t = (((t + imul(t ^ (t >> 7), 61 | t)) & 0xFFFFFFFF) ^ t) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return nxt

NBSP = ' '
LS = ' '
LEADS = ['', '', '', ' ', '  ', '   ', '    ', '\t']
OPENERS = ['<a', '<a', '<a', '</a', '<A-1', '<a_', '<1', '<']
ATTRIBUTES = [' b', ' b=c', ' b="c"', " b='c'", ' b = c', ' b="c d"', ' b=c/', ' _:.-', ' ', '\t', '/', '"', "'", '=', '`', '<', '>', ' 1', 'x', ' b=""']
ENDINGS = ['>', '>', '>', '/>', ' />', '', '>  ', '>\t', '> x', '\r>', '>\n']
TRAILERS = ['', '', '', ' ', '\t', 'x', '\r', NBSP, LS]

def seeded(seed, n):
    nxt = mulberry32(seed)
    for _ in range(n):
        text = LEADS[int(nxt() * len(LEADS))] + OPENERS[int(nxt() * len(OPENERS))]
        parts = int(nxt() * 7)
        for _p in range(parts):
            text += ATTRIBUTES[int(nxt() * len(ATTRIBUTES))]
        text += ENDINGS[int(nxt() * len(ENDINGS))]
        text += TRAILERS[int(nxt() * len(TRAILERS))]
        yield text

which = sys.argv[1] if len(sys.argv) > 1 else 'all'
if which in ('enum', 'all'):
    count(with_prefixes(['<a'], WIDE, 6), 'E1 <a + 10 chars up to 6')
    count(with_prefixes(FRAMES, FRAME_TAIL, 5), 'E2 11 frames + 9 chars up to 5')
    count(with_prefixes(['<a'], PIECES, 6), 'E3 <a + 9 pieces up to 6')
    count(with_prefixes(['</a'], CLOSER_TAIL, 6), 'E4 </a + 7 chars up to 6')
    count(with_prefixes(['<a b'], ATTR_TAIL, 6), 'E5 <a b + 7 chars up to 6')
    count(with_prefixes(['<a'], NAME_TAIL, 6), 'E6 <a + 12 chars up to 6')
if which in ('seeded', 'all'):
    count(seeded(3371, 1_000_000), 'SEEDED 1,000,000 seed 3371')
if which in ('sweep', 'all'):
    count(sweep(HEADS), 'SWEEP three heads, every code unit at every place')
