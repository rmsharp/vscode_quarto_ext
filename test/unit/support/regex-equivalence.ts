// Shared by the tests that keep an OLD regex spelling as the oracle for a rewritten one (Learning 738): the strings to try, the comparison, and a clock.

export const LS = String.fromCharCode(0x2028);
export const PS = String.fromCharCode(0x2029);
export const NBSP = String.fromCharCode(0xa0);
export const BOM = String.fromCharCode(0xfeff);
export const IDEOGRAPHIC = String.fromCharCode(0x3000);
export const EM_SPACE = String.fromCharCode(0x2003);
export const NEL = String.fromCharCode(0x85);

/** The characters `\s` matches and `String.prototype.trim` removes (ECMAScript WhiteSpace and LineTerminator), spelled out so that a reading by definition takes the set from the specification and not from `\s`. */
export const JS_WHITESPACE: ReadonlySet<string> = new Set([
  "\t", "\n", "\v", "\f", "\r", " ", NBSP, BOM, LS, PS, String.fromCharCode(0x1680),
  ...Array.from({ length: 11 }, (_, i) => String.fromCharCode(0x2000 + i)),
  String.fromCharCode(0x202f), String.fromCharCode(0x205f), IDEOGRAPHIC,
]);

/** The two answers are the same match: both refuse, or both match at the same index with the same whole match and the same groups (an unset group included). */
export function sameMatch(a: RegExpExecArray | null, b: RegExpExecArray | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  if (a.index !== b.index || a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

/** Every string of 0..maxLength characters over `alphabet`, shortest first, without holding a level in memory. */
export function* everyString(alphabet: readonly string[], maxLength: number): Generator<string> {
  yield "";
  for (let length = 1; length <= maxLength; length++) {
    const digits = new Array<number>(length).fill(0);
    for (;;) {
      let text = "";
      for (let i = 0; i < length; i++) {
        text += alphabet[digits[i]];
      }
      yield text;
      let place = length - 1;
      while (place >= 0 && digits[place] === alphabet.length - 1) {
        digits[place] = 0;
        place--;
      }
      if (place < 0) {
        break;
      }
      digits[place]++;
    }
  }
}

/** How many strings `everyString` yields: 1 + a + a^2 + ... + a^length. */
export function countStrings(alphabetSize: number, maxLength: number): number {
  let total = 0;
  let level = 1;
  for (let length = 0; length <= maxLength; length++) {
    total += level;
    level *= alphabetSize;
  }
  return total;
}

/** Every string made from one of `heads` by putting one UTF-16 code unit at any place of it, or in place of any one of its characters (the sweep that pins a character class no alphabet reached). */
export function* everyCodeUnitEdit(heads: readonly string[]): Generator<string> {
  for (const head of heads) {
    for (let at = 0; at <= head.length; at++) {
      for (let unit = 0; unit < 0x10000; unit++) {
        const ch = String.fromCharCode(unit);
        yield head.slice(0, at) + ch + head.slice(at);
        if (at < head.length) yield head.slice(0, at) + ch + head.slice(at + 1);
      }
    }
  }
}

/** How many strings `everyCodeUnitEdit` yields: (2 x length + 1) x 65,536 for each head. */
export function countCodeUnitEdits(heads: readonly string[]): number {
  return heads.reduce((sum, head) => sum + (2 * head.length + 1) * 0x10000, 0);
}

/** Compare two spellings over `lines`: how many were compared, how many the OLD spelling matched, and the first few disagreements. */
export function compare(oldPattern: RegExp, newPattern: RegExp, lines: Iterable<string>): { compared: number; accepted: number; disagreements: string[] } {
  let compared = 0;
  let accepted = 0;
  const disagreements: string[] = [];
  for (const text of lines) {
    const expected = oldPattern.exec(text);
    compared++;
    if (expected !== null) accepted++;
    if (!sameMatch(newPattern.exec(text), expected) && disagreements.length < 5) {
      disagreements.push(JSON.stringify(text));
    }
  }
  return { compared, accepted, disagreements };
}

/** Mulberry32: a seeded generator, so a failure replays. */
export function seededRandom(seed: number): () => number {
  let state = seed;
  return (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Run `pattern` on each line and report the slowest, stopping at the first one past `limitMs` (a quadratic spelling takes seconds a line: no need to time the rest). */
export function slowestExec(pattern: RegExp, lines: Iterable<string>, limitMs: number): { slowestText: string; slow: boolean } {
  let slowest = 0;
  let slowestText = "";
  for (const text of lines) {
    const started = performance.now();
    pattern.exec(text);
    const took = performance.now() - started;
    if (took > slowest) {
      slowest = took;
      slowestText = JSON.stringify(text.slice(0, 16));
    }
    if (slowest >= limitMs) {
      break;
    }
  }
  return { slowestText, slow: slowest >= limitMs };
}
