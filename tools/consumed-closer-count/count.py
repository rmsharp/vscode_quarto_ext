# Session 328. An independent port of the OLD consumedCloserLine and of isCloser (and its helpers), used only to re-derive the counts
# that test/unit/consumed-closer-equivalence.test.ts pins: [questions asked, answers that found a closer]. Nothing here imports the TypeScript.
#
#   python3 -I tools/consumed-closer-count/count.py <row> [histories]
#   rows: singlesA singlesB pairsA3 pairsB3 sweepsA sweepsB triplesA3 triplesB2 seeded     (seeded takes the number of histories, 300000 in the test)
#
# JS `\s` and `String.prototype.trim()` strip one set (WhiteSpace and LineTerminator); Python's `\s` and `str.strip()` do not match it, so the set is spelled out (WS).
# singlesA takes about 5 s and seeded about 7 s (measured by the Session 328 review at a load near 80); pairsB3 enumerates 9.1 million questions one by one.
import itertools, re, sys

# JS \s and String.prototype.trim() strip the same set (WhiteSpace + LineTerminator); Python's \s and str.strip() do not match it exactly.
WS = '[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]'
FENCE_CLOSE = re.compile(r'[ \t]*((?=([`~]))(?:`{3,}|~{3,}))[ \t]*\Z')
CELL_CLOSE = re.compile(WS + r'*((?=([`~]))(?:`{3,}|~{3,}))' + WS + r'*\Z')
LEAD = re.compile(WS + '*')
BLANK = re.compile(WS + r'*\Z')

def indent_column(line):
    col = 0
    for ch in line:
        if ch == ' ': col += 1
        elif ch == '\t': col += 4 - (col % 4)
        else: break
    return col

def is_code_depth(col, columns):
    base = 0
    for c in columns:
        if c <= col and c > base: base = c
    return col >= base + 4

def is_closer(line, kind):
    is_cell, char, ln, indent, columns = kind
    if is_cell:
        m = CELL_CLOSE.match(line)
    else:
        m = FENCE_CLOSE.match(line)
        if m is not None and is_code_depth(indent_column(line), columns): m = None
    if m is None or m.group(2) != char: return False
    if indent is not None and LEAD.match(line).group(0) != indent: return False
    return len(m.group(1)) == ln if is_cell else len(m.group(1)) >= ln

def old(lines, frm, kind, cache):
    k = frm
    while k < len(lines):
        if BLANK.match(lines[k]): return -1
        key = (lines[k], kind)
        if key not in cache: cache[key] = is_closer(lines[k], kind)
        if cache[key]: return k
        k += 1
    return -1

NBSP, LS, BOM, IDEO = '\u00a0', '\u2028', '\ufeff', '\u3000'
LINES_A = ['', '```', '````', '~~~', '  ```', '    ```', 'word']
LINES_B = ['', NBSP, '\f', LS, BOM, IDEO, '```', '\f```', '```' + NBSP, '\t```', '```x', '> ```']
KINDS = [(False,'`',3,None,(0,)), (False,'~',3,None,(0,)), (False,'`',4,None,(0,)), (False,'`',3,None,(0,4)), (False,'`',3,'',(0,)),
         (False,'`',3,'  ',(0,)), (True,'`',3,None,(0,)), (True,'`',4,None,(0,)), (True,'~',3,None,(0,)), (True,'`',3,'  ',(0,))]
ALL = [(c,ch,l,i,cols) for c in (False,True) for ch in '`~' for l in (3,4,5) for i in (None,'','  ','\t') for cols in ((0,),(0,2),(0,4),(0,3,6))]
assert len(KINDS) == 10 and len(ALL) == 192
cache = {}

def docs(tokens, max_lines):
    for n in range(max_lines + 1):
        for combo in itertools.product(tokens, repeat=n):
            yield list(combo)

def singles(tokens, max_lines):
    asked = found = 0
    for lines in docs(tokens, max_lines):
        for frm in range(len(lines) + 2):
            for kind in KINDS:
                asked += 1
                if old(lines, frm, kind, cache) >= 0: found += 1
    return asked, found

def pairs(tokens, max_lines):
    # every ordered pair of questions, enumerated one by one
    asked = found = 0
    for lines in docs(tokens, max_lines):
        qs = [(frm, kind) for frm in range(len(lines) + 2) for kind in KINDS]
        hit = {q: old(lines, q[0], q[1], cache) >= 0 for q in qs}
        for first in qs:
            for second in qs:
                asked += 2
                found += hit[first] + hit[second]
    return asked, found

def sweeps(tokens, max_lines):
    # three histories per document: every kind ascending, every kind descending, all kinds interleaved at each position
    asked = found = 0
    for lines in docs(tokens, max_lines):
        n = len(lines)
        hit = {(frm, ki): old(lines, frm, KINDS[ki], cache) >= 0 for frm in range(n + 2) for ki in range(len(KINDS))}
        for ki in range(len(KINDS)):
            for frm in range(n + 2):
                asked += 1; found += hit[(frm, ki)]
        for ki in range(len(KINDS)):
            for frm in reversed(range(n + 2)):
                asked += 1; found += hit[(frm, ki)]
        for frm in range(n + 2):
            for ki in range(len(KINDS)):
                asked += 1; found += hit[(frm, ki)]
    return asked, found

def triples(tokens, max_lines):
    # every ordered triple of questions of ONE kind
    asked = found = 0
    for lines in docs(tokens, max_lines):
        n = len(lines)
        for kind in KINDS:
            hit = [old(lines, frm, kind, cache) >= 0 for frm in range(n + 2)]
            for a, b, c in itertools.product(range(n + 2), repeat=3):
                asked += 3
                found += hit[a] + hit[b] + hit[c]
    return asked, found

def mulberry(seed):
    state = [seed & 0xFFFFFFFF]
    def rnd():
        state[0] = (state[0] + 0x6d2b79f5) & 0xFFFFFFFF
        s = state[0]
        t = ((s ^ (s >> 15)) * (1 | s)) & 0xFFFFFFFF
        t = ((t + (((t ^ (t >> 7)) * (61 | t)) & 0xFFFFFFFF)) & 0xFFFFFFFF) ^ t
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return rnd

def seeded(n_histories):
    # Signed-int semantics matter in JS (| 0), but every value here is reduced to unsigned 32 bits before use, as Math.imul and >>> do.
    random = mulberry(328)
    pool = [LINES_A, LINES_B]
    asked = found = 0
    for n in range(n_histories):
        letters = pool[n % 2]
        count = int(random() * random() * 40)
        lines = []
        for _ in range(count):
            pick = letters[int(random() * len(letters))]
            if BLANK.match(pick) and random() < 0.7: lines.append('```text i')
            else: lines.append(pick)
        length = 1 + int(random() * 8)
        frm = int(random() * (count + 2))
        hist = []
        for _ in range(length):
            if random() < 0.2: frm = int(random() * (count + 2))
            else: frm = min(count + 1, frm + int(random() * 4))
            hist.append((frm, int(random() * len(ALL))))
        for frm, w in hist:
            asked += 1
            if old(lines, frm, ALL[w], cache) >= 0: found += 1
    return asked, found

which = sys.argv[1]
if which == 'singlesA': print(singles(LINES_A, 6))
elif which == 'singlesB': print(singles(LINES_B, 4))
elif which == 'pairsA3': print(pairs(LINES_A, 3))
elif which == 'pairsB3': print(pairs(LINES_B, 3))
elif which == 'sweepsA': print(sweeps(LINES_A, 5))
elif which == 'sweepsB': print(sweeps(LINES_B, 4))
elif which == 'triplesA3': print(triples(LINES_A, 3))
elif which == 'triplesB2': print(triples(LINES_B, 2))
elif which == 'seeded': print(seeded(int(sys.argv[2]) if len(sys.argv) > 2 else 300000))
