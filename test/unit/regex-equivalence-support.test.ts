import { describe, expect, it } from "vitest";
import { compare, countCodeUnitEdits, countStrings, everyCodeUnitEdit, everyString, sameMatch, seededRandom, slowestExec } from "./support/regex-equivalence";

// Session 319 — the helpers that `blank-tail-equivalence.test.ts` stands on. Each comparison there trusts `sameMatch` to see an index, a group and an unset group,
// `compare` to count, `everyString` to enumerate and `slowestExec` to report a slow line; a helper that quietly stopped doing one of them would turn every row green (the mutation review of Session 319 found six such
// edits surviving). These rows pin them.

describe("Session 319 — sameMatch", () => {
  it("two refusals are the same answer, a refusal and a match are not", () => {
    expect(sameMatch(null, null)).toBe(true);
    expect(sameMatch(/a/.exec("a"), null)).toBe(false);
    expect(sameMatch(null, /a/.exec("a"))).toBe(false);
  });

  it("the same index, whole match and groups are the same answer", () => {
    expect(sameMatch(/(a)(b)?/.exec("xab"), /(a)(b)?/.exec("xab"))).toBe(true);
  });

  it("a different index is a different answer even when the match and the groups read the same", () => {
    expect(sameMatch(/(a)/.exec("ab a"), /(a)/.exec("b a"))).toBe(false);
  });

  it("a different whole match is a different answer even when the groups read the same", () => {
    expect(sameMatch(/(a)b?/.exec("ab"), /(a)/.exec("ab"))).toBe(false);
  });

  it("a different group is a different answer", () => {
    expect(sameMatch(/(a)(b|c)/.exec("ab"), /(a)(b|c)/.exec("ac"))).toBe(false);
  });

  it("an unset group is not an empty one", () => {
    expect(sameMatch(/(a)(b)?/.exec("a"), /(a)(b*)/.exec("a"))).toBe(false);
  });

  it("a different number of groups is a different answer", () => {
    expect(sameMatch(/(a)/.exec("a"), /(a)()/.exec("a"))).toBe(false);
  });
});

describe("Session 319 — everyString and countStrings", () => {
  it("yields the empty string and then every string by length, in order", () => {
    expect([...everyString(["a", "b"], 2)]).toEqual(["", "a", "b", "aa", "ab", "ba", "bb"]);
  });

  it("yields only the empty string for a length of zero", () => {
    expect([...everyString(["a", "b"], 0)]).toEqual([""]);
  });

  it("counts what it yields", () => {
    for (const [size, length] of [[1, 3], [2, 4], [3, 3], [5, 2]]) {
      const alphabet = Array.from({ length: size }, (_, i) => String.fromCharCode(97 + i));
      expect([...everyString(alphabet, length)]).toHaveLength(countStrings(size, length));
    }
    expect(countStrings(6, 7)).toBe(335_923);
  });

  it("holds each string once", () => {
    const all = [...everyString(["a", "b", "c"], 4)];
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("Session 319 — compare", () => {
  it("counts the strings compared and the strings the OLD pattern matched, and finds no disagreement between a pattern and itself", () => {
    const result = compare(/^a/, /^a/, ["a", "ab", "b", ""]);
    expect(result).toEqual({ compared: 4, accepted: 2, disagreements: [] });
  });

  it("reports a disagreement in what the two patterns match, in a group and in an unset group", () => {
    expect(compare(/^a/, /^b/, ["a", "b"]).disagreements).toEqual(['"a"', '"b"']);
    expect(compare(/^(a)/, /^(b|a)/, ["a"]).disagreements).toEqual([]);
    expect(compare(/^(a)(b)?/, /^(a)(b*)/, ["a"]).disagreements).toEqual(['"a"']);
  });

  it("keeps only the first five disagreements", () => {
    expect(compare(/^a/, /^b/, ["a", "a", "a", "a", "a", "a", "a"]).disagreements).toHaveLength(5);
  });
});

describe("Session 319 — seededRandom", () => {
  it("replays a seed, differs between seeds and stays in [0, 1)", () => {
    const first = seededRandom(7);
    const again = seededRandom(7);
    const other = seededRandom(8);
    const a = Array.from({ length: 50 }, () => first());
    expect(Array.from({ length: 50 }, () => again())).toEqual(a);
    expect(Array.from({ length: 50 }, () => other())).not.toEqual(a);
    expect(a.every((value) => value >= 0 && value < 1)).toBe(true);
  });
});

describe("Session 319 — slowestExec", () => {
  // `(a+)+$` on a run of `a` and then `b` is exponential in the run: 24 letters take well over 50 ms and a run of 3 takes microseconds.
  const exponential = /^(a+)+$/;

  it("reports a slow line, names it, and stops at the first one", () => {
    const { slowestText, slow } = slowestExec(exponential, ["aaa", `${"a".repeat(26)}b`, "never reached"], 50);
    expect(slow).toBe(true);
    expect(slowestText).toBe(JSON.stringify(`${"a".repeat(16)}`));
  });

  it("reports no slow line when every line is fast, and still names the slowest", () => {
    const { slowestText, slow } = slowestExec(exponential, ["aaa", "aab", "b"], 50);
    expect(slow).toBe(false);
    expect(slowestText.length).toBeGreaterThan(0);
  });
});

// Session 335 review — `everyCodeUnitEdit` is the sweep that pins a character class no alphabet reached (a form feed, a full-width stop, a vertical tab): the oracle files that hold an old spelling put every UTF-16 code unit
// into each head and in place of each of its characters. A sweep that quietly covered fewer units or fewer positions would turn those rows green.
describe("Session 335 review — everyCodeUnitEdit and countCodeUnitEdits", () => {
  it("yields an insertion and a replacement of every code unit at every place, and the count says how many", () => {
    const edits = [...everyCodeUnitEdit(["ab"])];
    expect(edits.length).toBe(countCodeUnitEdits(["ab"]));
    expect(countCodeUnitEdits(["ab", ""])).toBe((2 * 2 + 1) * 0x10000 + 0x10000);
    const seen = new Set(edits);
    for (const unit of [0, 0x0c, 0x20, 0x41, 0xff1e, 0xd800, 0xffff]) {
      const ch = String.fromCharCode(unit);
      for (const expected of [ch + "ab", "a" + ch + "b", "ab" + ch, ch + "b", "a" + ch]) {
        expect(seen.has(expected)).toBe(true);
      }
    }
  });

  it("an empty head is only inserted into, and no head is edited in place of a character it has not got", () => {
    const edits = [...everyCodeUnitEdit([""])];
    expect(edits.length).toBe(0x10000);
    expect(edits.every((text) => text.length === 1)).toBe(true);
  });
});
