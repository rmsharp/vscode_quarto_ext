import * as nodeFs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  appendCitations,
  type BibliographyStat,
  CITATION_CACHE_MAX_FILES,
  type Citation,
  type CitationCache,
  type CitationCacheOptions,
  createCitationCache,
  parseCitations,
  readCitations,
} from "../../src/core/citations";

// Session 344, part (8)(c) of "What Session 342's review round found beside the typing-path cures". `createCitationCache` (Session 343) read a file once per MISS, and N asks that overlap before the first read has finished
// are N misses: 5 overlapping first asks to one 2,000-entry bibliography made 5 reads and 5 parses (a probe in a fresh process, real files). The cure: an ask that `stat`s the same three numbers as a read in flight shares it.
// The rows COUNT what the cache asks of `readFile` (a claim without a clock, Learning 913) on stand-ins whose `readFile` can be held open, so that "a read is in flight" is a state the row builds and not a race it hopes for.
//
//  - the first describe is the cure and its hazards, one row each: a file rewritten while a read is in flight (each of the three numbers alone), a stat that cannot say, a superseded read, in either order of settling and when it fails;
//  - then a shared read that fails, and what a settled read leaves behind (nothing);
//  - then the Session 343 cache itself, kept verbatim, as the ORACLE of every ask that does not overlap, and two seeded models of asks that do overlap (one with files rewritten mid-flight);
//  - last, three rows on a REAL file system: overlapping asks, `chmod 000` and a retargeted symbolic link (the item called the last two blind spots). A chmod always moves the change time, so it is seen; a retargeted link is seen
//    whenever the two targets' change times differ, and they are equal only for two files last changed within one tick of the file system's clock (what was measured is in the docstring of `createCitationCache`).

const DIR = path.resolve("/work/doc");
const at = (rel: string): string => path.resolve(DIR, rel);

interface FakeFile {
  content: string;
  mtimeMs: number;
  /** The size `stat` reports; the content's length when absent. */
  size?: number;
  ctimeMs?: number;
  /** `stat` answers, `readFile` rejects. */
  unreadable?: boolean;
}

/** A file system of stand-ins whose `readFile` can be held open. Every `stat` and `readFile` is logged as `stat:<path>` and `read:<path>`; a missing file rejects both. */
function fakeFs(initial: Record<string, FakeFile> = {}, jitter: (op: "stat" | "read", absolute: string) => number = () => 0) {
  const files = new Map<string, FakeFile>(Object.entries(initial).map(([rel, file]) => [at(rel), file]));
  const events: string[] = [];
  const gates: Array<{ open: () => void; fail: (error: Error) => void }> = [];
  let holding = false;
  return {
    files,
    events,
    set: (rel: string, file: FakeFile | undefined): void => void (file === undefined ? files.delete(at(rel)) : files.set(at(rel), file)),
    /** From now on (until `hold(false)`) every `readFile` that finds its file waits for its own gate: the i-th read started is `open(i)`ed or `fail(i, error)`ed, and answers what the file held when it STARTED. */
    hold: (on = true): void => void (holding = on),
    open: (i: number): void => gates[i].open(),
    openAll: (): void => gates.forEach((gate) => gate.open()),
    fail: (i: number, error: Error): void => gates[i].fail(error),
    readFile: async (absolute: string): Promise<string> => {
      events.push("read:" + absolute);
      const file = files.get(absolute);
      if (file === undefined) throw new Error("ENOENT: " + absolute);
      for (let ticks = jitter("read", absolute); ticks > 0; ticks--) await Promise.resolve();
      if (file.unreadable === true) throw new Error("EACCES: " + absolute);
      if (holding) await new Promise<void>((open, fail) => gates.push({ open, fail }));
      return file.content;
    },
    stat: async (absolute: string): Promise<BibliographyStat> => {
      events.push("stat:" + absolute);
      const file = files.get(absolute);
      if (file === undefined) throw new Error("ENOENT: " + absolute);
      for (let ticks = jitter("stat", absolute); ticks > 0; ticks--) await Promise.resolve();
      return { mtimeMs: file.mtimeMs, size: file.size ?? file.content.length, ...(file.ctimeMs === undefined ? {} : { ctimeMs: file.ctimeMs }) };
    },
    reads: (): number => events.filter((e) => e.startsWith("read:")).length,
    stats: (): number => events.filter((e) => e.startsWith("stat:")).length,
  };
}

/** A BibTeX file of `[key, title]` entries. */
const bibtex = (entries: Array<[string, string]>): string => entries.map(([key, title]) => `@article{${key},\n  author = {Author of ${key}},\n  title = {${title}},\n  year = {2020}\n}\n`).join("\n");
const keys = (answer: Array<{ key: string }>): string[] => answer.map((c) => c.key);
/** Let every promise that can settle without the outside world settle. */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

describe("Session 344 -- asks that overlap share ONE read and ONE parse", () => {
  it("N overlapping first asks to one file read it ONCE (the file system is asked N times for its numbers, once for its content), and each gets its own list of the same parsed citations", async () => {
    const fs = fakeFs({ "a.bib": { content: bibtex([["a1", "A one"], ["a2", "A two"]]), mtimeMs: 10 } });
    const cache = createCitationCache(fs);
    const answers = await Promise.all([1, 2, 3, 4, 5].map(() => cache.read(["a.bib"], DIR)));
    expect([fs.reads(), fs.stats()]).toEqual([1, 5]);
    for (const answer of answers) expect(answer.map((c) => c.key)).toEqual(["a1", "a2"]);
    // one parse: the five lists hold the very same citation objects, and five lists are five lists
    for (const answer of answers) answer.forEach((citation, i) => expect(citation).toBe(answers[0][i]));
    expect(new Set(answers).size).toBe(5);
    expect(answers.every((answer) => answer.every((citation) => Object.isFrozen(citation)))).toBe(true); // shared by five asks: frozen for all of them
    expect(answers[0]).toEqual(await readCitations(["a.bib"], DIR, fs.readFile));
  });

  it("a file read once and then EDITED, asked five times at once: the five asks meet the stale entry and share ONE read, as five first asks to a file with no entry do", async () => {
    const fs = fakeFs({ "a.bib": { content: bibtex([["v1", "One"]]), mtimeMs: 10 } });
    const cache = createCitationCache(fs);
    expect(keys(await cache.read(["a.bib"], DIR))).toEqual(["v1"]);
    fs.set("a.bib", { content: bibtex([["v2", "Two"]]), mtimeMs: 20 });
    const answers = await Promise.all([1, 2, 3, 4, 5].map(() => cache.read(["a.bib"], DIR)));
    expect(answers.map(keys)).toEqual([["v2"], ["v2"], ["v2"], ["v2"], ["v2"]]);
    expect(fs.reads()).toBe(2); // the first read, and ONE for the five
  });

  for (const [label, file, count] of [
    ["an EMPTY file (size 0)", { content: "", mtimeMs: 10 }, 0],
    ["a file stamped with the epoch (modification time 0)", { content: bibtex([["e1", "Epoch"]]), mtimeMs: 0 }, 1],
  ] as const) {
    it(`five overlapping first asks to ${label} read it once: a zero is a signature like any other number`, async () => {
      const fs = fakeFs({ "e.bib": file });
      const cache = createCitationCache(fs);
      const answers = await Promise.all([1, 2, 3, 4, 5].map(() => cache.read(["e.bib"], DIR)));
      expect([fs.reads(), answers.map((answer) => answer.length)]).toEqual([1, [count, count, count, count, count]]);
    });
  }

  it("a file rewritten between two asks' stats while a read is in flight is read AGAIN: the second ask is never served what the read started under the old numbers parsed (modification time)", async () => {
    const fs = fakeFs({ "a.bib": { content: bibtex([["old1", "Old"]]), mtimeMs: 10 } });
    const cache = createCitationCache(fs);
    fs.hold();
    const first = cache.read(["a.bib"], DIR);
    await flush();
    expect(fs.reads()).toBe(1); // the premise: ask 1's read is in flight, held open
    fs.set("a.bib", { content: bibtex([["new1", "New"]]), mtimeMs: 20 });
    const second = cache.read(["a.bib"], DIR);
    await flush();
    fs.openAll();
    expect((await first).map((c) => c.key)).toEqual(["old1"]); // ask 1 read under the old numbers and answers what the file held then
    expect((await second).map((c) => c.key)).toEqual(["new1"]);
    expect(fs.reads()).toBe(2);
  });

  it("the same, when the SIZE alone moved between the two stats (the modification time is the same): the second ask reads again", async () => {
    const fs = fakeFs({ "a.bib": { content: bibtex([["old1", "Old"]]), mtimeMs: 10, size: 100 } });
    const cache = createCitationCache(fs);
    fs.hold();
    const first = cache.read(["a.bib"], DIR);
    await flush();
    fs.set("a.bib", { content: bibtex([["new1", "New"]]), mtimeMs: 10, size: 101 });
    const second = cache.read(["a.bib"], DIR);
    await flush();
    fs.openAll();
    expect((await first).map((c) => c.key)).toEqual(["old1"]);
    expect((await second).map((c) => c.key)).toEqual(["new1"]);
    expect(fs.reads()).toBe(2);
  });

  it("the same, when the CHANGE time alone moved (a same-size replacement by a tool that sets the modification time itself): the second ask reads again", async () => {
    const fs = fakeFs({ "a.bib": { content: bibtex([["old1", "Old"]]), mtimeMs: 10, size: 100, ctimeMs: 500 } });
    const cache = createCitationCache(fs);
    fs.hold();
    const first = cache.read(["a.bib"], DIR);
    await flush();
    fs.set("a.bib", { content: bibtex([["new1", "New"]]), mtimeMs: 10, size: 100, ctimeMs: 501 });
    const second = cache.read(["a.bib"], DIR);
    await flush();
    fs.openAll();
    expect((await first).map((c) => c.key)).toEqual(["old1"]);
    expect((await second).map((c) => c.key)).toEqual(["new1"]);
    expect(fs.reads()).toBe(2);
  });

  // The share test is an EQUALITY on each of the three numbers: a file replaced by one whose number is OLDER (cp -p, rsync -t, tar, unzip from an older copy) or SMALLER is as much a change as a later or larger one.
  // The first two rows are on a stat without a change time (the contract of the pure API: compared on the two numbers it has; `fs.stat` always carries one, which moves too), the third is on one that carries it.
  for (const [label, was, now] of [
    ["modification time", { mtimeMs: 20, size: 100 }, { mtimeMs: 10, size: 100 }],
    ["size", { mtimeMs: 10, size: 101 }, { mtimeMs: 10, size: 100 }],
    ["change time", { mtimeMs: 10, size: 100, ctimeMs: 501 }, { mtimeMs: 10, size: 100, ctimeMs: 500 }],
  ] as const) {
    it(`a file replaced while a read is in flight, its ${label} going DOWN, is read again: the second ask is never handed what the read started under the higher number parsed`, async () => {
      const fs = fakeFs({ "a.bib": { content: bibtex([["old1", "Old"]]), ...was } });
      const cache = createCitationCache(fs);
      fs.hold();
      const first = cache.read(["a.bib"], DIR);
      await flush();
      fs.set("a.bib", { content: bibtex([["new1", "New"]]), ...now });
      const second = cache.read(["a.bib"], DIR);
      await flush();
      fs.openAll();
      expect([keys(await first), keys(await second), fs.reads()]).toEqual([["old1"], ["new1"], 2]);
    });
  }

  it("a stat that cannot say (no numbers, a string, a NaN in any of the three) is no signature to share under: three overlapping asks read three times, as they would without the sharing", async () => {
    const odd: unknown[] = [{}, { mtimeMs: 1 }, { size: 1 }, { mtimeMs: "1", size: "1" }, { mtimeMs: null, size: null }, { mtimeMs: NaN, size: 3 }, { mtimeMs: 1, size: NaN }, { mtimeMs: 1, size: 3, ctimeMs: NaN }];
    const reported: string[] = [];
    for (const stat of odd) {
      let reads = 0;
      const cache = createCitationCache({
        stat: async () => stat as BibliographyStat,
        readFile: async () => {
          reads++;
          return bibtex([["o", "odd"]]);
        },
      });
      const answers = await Promise.all([1, 2, 3].map(() => cache.read(["o.bib"], DIR)));
      reported.push(`${JSON.stringify(stat)} -> ${reads} reads, ${answers.map((a) => a.length).join("+")} entries`);
    }
    expect(reported).toEqual(odd.map((stat) => `${JSON.stringify(stat)} -> 3 reads, 1+1+1 entries`));
  });

  it("a read that a newer one superseded does not take the newer one's place: R1 (old numbers) settles while R2 (new numbers) is in flight, and an ask under the new numbers still JOINS R2", async () => {
    const fs = fakeFs({ "a.bib": { content: bibtex([["old1", "Old"]]), mtimeMs: 10 } });
    const cache = createCitationCache(fs);
    fs.hold();
    const first = cache.read(["a.bib"], DIR);
    await flush();
    fs.set("a.bib", { content: bibtex([["new1", "New"]]), mtimeMs: 20 });
    const second = cache.read(["a.bib"], DIR);
    await flush();
    expect(fs.reads()).toBe(2); // the premise: two reads in flight, R1 under time 10 and R2 under time 20
    fs.open(0);
    expect(keys(await first)).toEqual(["old1"]);
    const third = cache.read(["a.bib"], DIR);
    await flush();
    expect(fs.reads()).toBe(2); // the third ask joined R2
    fs.open(1);
    expect(keys(await second)).toEqual(["new1"]);
    expect(keys(await third)).toEqual(["new1"]);
    const before = fs.reads();
    expect(keys(await cache.read(["a.bib"], DIR))).toEqual(["new1"]); // and R2's entry is the one kept
    expect(fs.reads()).toBe(before);
  });

  it("a superseded read that settles LAST does not replace the newer read's entry: R2 settles, then R1, and the next ask under the new numbers is a hit", async () => {
    const fs = fakeFs({ "a.bib": { content: bibtex([["old1", "Old"]]), mtimeMs: 10 } });
    const cache = createCitationCache(fs);
    fs.hold();
    const first = cache.read(["a.bib"], DIR);
    await flush();
    fs.set("a.bib", { content: bibtex([["new1", "New"]]), mtimeMs: 20 });
    const second = cache.read(["a.bib"], DIR);
    await flush();
    fs.open(1);
    expect(keys(await second)).toEqual(["new1"]);
    fs.open(0);
    expect(keys(await first)).toEqual(["old1"]); // R1 answers its own ask with what it read, whatever the cache keeps
    fs.hold(false); // a read the cache should not have to make then shows as a count and not as a hang
    const before = fs.reads();
    expect(keys(await cache.read(["a.bib"], DIR))).toEqual(["new1"]);
    expect(fs.reads()).toBe(before);
  });

  it("a superseded read that settles FIRST, while the newer one is still in flight, keeps no entry: the file back at R1's numbers (other content, the same size) is read again, not served what R1 parsed", async () => {
    const fs = fakeFs({ "a.bib": { content: bibtex([["aaaa", "A"]]), mtimeMs: 10 } });
    const cache = createCitationCache(fs);
    fs.hold();
    const first = cache.read(["a.bib"], DIR);
    await flush();
    fs.set("a.bib", { content: bibtex([["cccc", "C"]]), mtimeMs: 20 });
    const second = cache.read(["a.bib"], DIR);
    await flush();
    expect(fs.reads()).toBe(2); // the premise: R1 under time 10 and R2 under time 20, both in flight
    fs.open(0);
    expect(keys(await first)).toEqual(["aaaa"]);
    fs.hold(false);
    fs.set("a.bib", { content: bibtex([["bbbb", "B"]]), mtimeMs: 10 }); // R1's numbers again, as bytes of the same length
    expect(keys(await cache.read(["a.bib"], DIR))).toEqual(["bbbb"]);
    fs.openAll();
    await second;
  });

  it("the same, seen on a full cache: a superseded read that settles first takes no slot, so a file the bound would drop for it is still a hit while the newer read is in flight", async () => {
    const fs = fakeFs(Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`f${i}.bib`, { content: bibtex([[`k${i}`, `title ${i}`]]), mtimeMs: 1 + i }])));
    const cache = createCitationCache(fs);
    for (let i = 0; i < CITATION_CACHE_MAX_FILES; i++) await cache.read([`f${i}.bib`], DIR);
    expect(fs.reads()).toBe(16); // the cache holds f0 to f15
    fs.hold();
    const first = cache.read(["f16.bib"], DIR);
    await flush();
    fs.set("f16.bib", { content: bibtex([["k16", "rewritten"]]), mtimeMs: 100 });
    const second = cache.read(["f16.bib"], DIR);
    await flush();
    expect(fs.reads()).toBe(18); // the premise: R1 and R2 of f16 in flight
    fs.open(0);
    await first;
    expect(keys(await cache.read(["f0.bib"], DIR))).toEqual(["k0"]);
    expect(fs.reads()).toBe(18); // f0 was not dropped to make room for R1's entry
    fs.openAll();
    expect(keys(await second)).toEqual(["k16"]);
  });

  it("a superseded read that FAILS after the newer read settled does not drop the newer read's entry: R2 settles, then R1 fails (its ask adds nothing, as it would alone), and the next ask under the new numbers is a hit", async () => {
    const fs = fakeFs({ "a.bib": { content: bibtex([["old1", "Old"]]), mtimeMs: 10 } });
    const cache = createCitationCache(fs);
    fs.hold();
    const first = cache.read(["a.bib"], DIR);
    await flush();
    fs.set("a.bib", { content: bibtex([["new1", "New"]]), mtimeMs: 20 });
    const second = cache.read(["a.bib"], DIR);
    await flush();
    expect(fs.reads()).toBe(2); // the premise: R1 under time 10 and R2 under time 20, both in flight
    fs.open(1);
    expect(keys(await second)).toEqual(["new1"]);
    fs.fail(0, new Error("EIO: a.bib"));
    expect(keys(await first)).toEqual([]);
    fs.hold(false); // a read the cache should not have to make then shows as a count and not as a hang
    const before = fs.reads();
    expect(keys(await cache.read(["a.bib"], DIR))).toEqual(["new1"]);
    expect(fs.reads()).toBe(before);
  });

  it("the same when an ask SHARED the superseded read and sees its rejection too: both asks add nothing, and R2's entry is still the one kept", async () => {
    const fs = fakeFs({ "a.bib": { content: bibtex([["old1", "Old"]]), mtimeMs: 10 } });
    const cache = createCitationCache(fs);
    fs.hold();
    const owner = cache.read(["a.bib"], DIR);
    const sharer = cache.read(["a.bib"], DIR);
    await flush();
    expect(fs.reads()).toBe(1); // the premise: one read in flight for two asks
    fs.set("a.bib", { content: bibtex([["new1", "New"]]), mtimeMs: 20 });
    const second = cache.read(["a.bib"], DIR);
    await flush();
    expect(fs.reads()).toBe(2);
    fs.open(1);
    expect(keys(await second)).toEqual(["new1"]);
    fs.fail(0, new Error("EIO: a.bib"));
    expect([keys(await owner), keys(await sharer)]).toEqual([[], []]);
    fs.hold(false);
    const before = fs.reads();
    expect(keys(await cache.read(["a.bib"], DIR))).toEqual(["new1"]);
    expect(fs.reads()).toBe(before);
  });

  it("two DIFFERENT files that carry the same three numbers, asked at once, are two reads with two answers: a read is shared by the path it was started for, not by its numbers", async () => {
    const fs = fakeFs({ "a.bib": { content: bibtex([["a1", "A"]]), mtimeMs: 7, size: 100, ctimeMs: 9 }, "b.bib": { content: bibtex([["b1", "B"]]), mtimeMs: 7, size: 100, ctimeMs: 9 } });
    const cache = createCitationCache(fs);
    const [a, b] = await Promise.all([cache.read(["a.bib"], DIR), cache.read(["b.bib"], DIR)]);
    expect([keys(a), keys(b), fs.reads()]).toEqual([["a1"], ["b1"], 2]);
  });

  it("two files whose paths differ only in CASE, with the same three numbers, asked at once, are two reads with two answers: a read is shared by the whole path, not by a lower-cased spelling of it", async () => {
    const fs = fakeFs({ "Refs.bib": { content: bibtex([["upper", "U"]]), mtimeMs: 7, size: 100, ctimeMs: 9 }, "refs.bib": { content: bibtex([["lower", "L"]]), mtimeMs: 7, size: 100, ctimeMs: 9 } });
    const cache = createCitationCache(fs);
    const [a, b] = await Promise.all([cache.read(["Refs.bib"], DIR), cache.read(["refs.bib"], DIR)]);
    expect([keys(a), keys(b), fs.reads()]).toEqual([["upper"], ["lower"], 2]);
  });

  it("two files of ONE name in two directories, with the same three numbers, asked at once, are two reads with two answers: a read is shared by the whole path, not by its base name", async () => {
    const fs = fakeFs({ "x/refs.bib": { content: bibtex([["xx", "X"]]), mtimeMs: 7, size: 100, ctimeMs: 9 }, "y/refs.bib": { content: bibtex([["yy", "Y"]]), mtimeMs: 7, size: 100, ctimeMs: 9 } });
    const cache = createCitationCache(fs);
    const [a, b] = await Promise.all([cache.read(["x/refs.bib"], DIR), cache.read(["y/refs.bib"], DIR)]);
    expect([keys(a), keys(b), fs.reads()]).toEqual([["xx"], ["yy"], 2]);
  });

  it("two caches share nothing even while a read is in flight: the same file asked of each at once is read twice", async () => {
    const fs = fakeFs({ "a.bib": { content: bibtex([["a1", "A"]]), mtimeMs: 7 } });
    const one = createCitationCache(fs);
    const two = createCitationCache(fs);
    const [first, second] = await Promise.all([one.read(["a.bib"], DIR), two.read(["a.bib"], DIR)]);
    expect([keys(first), keys(second), fs.reads()]).toEqual([["a1"], ["a1"], 2]);
  });

  it("a file whose stat stops saying drops its entry (the read that follows is its own): when the numbers come back as they were, the file is read again, not served from the entry kept before", async () => {
    let stat: unknown = { mtimeMs: 100, size: 50 };
    let content = bibtex([["a", "A"]]);
    let reads = 0;
    const cache = createCitationCache({
      stat: async () => stat as BibliographyStat,
      readFile: async () => {
        reads++;
        return content;
      },
    });
    expect(keys(await cache.read(["x.bib"], DIR))).toEqual(["a"]);
    stat = {};
    content = bibtex([["b", "B"]]);
    expect(keys(await cache.read(["x.bib"], DIR))).toEqual(["b"]);
    stat = { mtimeMs: 100, size: 50 };
    expect(keys(await cache.read(["x.bib"], DIR))).toEqual(["b"]);
    expect(reads).toBe(3);
  });
});

describe("Session 344 -- a shared read that fails", () => {
  it("rejects for EVERY sharer as it would for each alone (each adds nothing from that file and keeps the other), is attempted ONCE, and does not poison the next ask, which reads the file again", async () => {
    const fs = fakeFs({ "a.bib": { content: bibtex([["a1", "A one"]]), mtimeMs: 1 }, "b.bib": { content: bibtex([["b1", "B one"]]), mtimeMs: 2 } });
    const cache = createCitationCache(fs);
    fs.hold();
    const asks = [1, 2, 3].map(() => cache.read(["a.bib", "b.bib"], DIR));
    await flush();
    expect(fs.reads()).toBe(1); // the premise: a.bib is in flight ONCE, for three asks (an ask goes to its second file after its first)
    fs.fail(0, new Error("EIO: a.bib"));
    await flush();
    expect(fs.reads()).toBe(2); // the three asks went on to b.bib, in flight ONCE
    fs.open(1);
    expect((await Promise.all(asks)).map(keys)).toEqual([["b1"], ["b1"], ["b1"]]);
    expect(fs.reads()).toBe(2);
    fs.hold(false);
    expect(keys(await cache.read(["a.bib", "b.bib"], DIR))).toEqual(["a1", "b1"]); // a.bib is read AGAIN (the failed read left nothing behind), b.bib is a hit
    expect(fs.reads()).toBe(3);
    expect(keys(await cache.read(["a.bib", "b.bib"], DIR))).toEqual(["a1", "b1"]);
    expect(fs.reads()).toBe(3);
  });
});

describe("Session 344 -- nothing is left in flight, and the bound is the bound it was", () => {
  const many = (): ReturnType<typeof fakeFs> => fakeFs(Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`f${i}.bib`, { content: bibtex([[`k${i}`, `title ${i}`]]), mtimeMs: 1 + i }])));

  it("a read that settled leaves no record behind: 17 files each asked twice AT ONCE (one read each), then the first one asked again under the same numbers is read AGAIN (the bound dropped it) and the last is a hit", async () => {
    const fs = many();
    const cache = createCitationCache(fs);
    for (let i = 0; i <= 16; i++) await Promise.all([cache.read([`f${i}.bib`], DIR), cache.read([`f${i}.bib`], DIR)]);
    expect(fs.reads()).toBe(17);
    await cache.read(["f16.bib"], DIR);
    expect(fs.reads()).toBe(17);
    await cache.read(["f0.bib"], DIR);
    expect(fs.reads()).toBe(18);
  });

  it("the reads in flight are not bounded by the cache's 16 files: 17 files, each asked twice, all in flight at once (the reads held open), are 17 reads", async () => {
    const fs = many();
    const cache = createCitationCache(fs);
    fs.hold();
    const asks: Array<Promise<unknown>> = [];
    for (let i = 0; i <= 16; i++) asks.push(cache.read([`f${i}.bib`], DIR), cache.read([`f${i}.bib`], DIR));
    await flush();
    expect(fs.reads()).toBe(17); // the premise: 17 reads in flight for 34 asks
    fs.openAll();
    await Promise.all(asks);
    expect(fs.reads()).toBe(17);
  });

  it("a read that failed leaves no record behind, whatever the number of sharers: it is attempted again at every later ask, and asks that overlap the retry share the RETRY", async () => {
    const fs = fakeFs({ "a.bib": { content: bibtex([["a1", "A one"]]), mtimeMs: 1 } });
    const cache = createCitationCache(fs);
    fs.hold();
    for (let round = 0; round < 3; round++) {
      const asks = [cache.read(["a.bib"], DIR), cache.read(["a.bib"], DIR)];
      await flush();
      expect(fs.reads()).toBe(round + 1); // one attempt for the two asks of the round, and a new one for the next round
      fs.fail(round, new Error("EIO round " + round));
      expect((await Promise.all(asks)).map((answer) => answer.length)).toEqual([0, 0]);
    }
    fs.hold(false);
    expect((await Promise.all([cache.read(["a.bib"], DIR), cache.read(["a.bib"], DIR)])).map(keys)).toEqual([["a1"], ["a1"]]);
    expect(fs.reads()).toBe(4);
  });
});

// ── The Session 343 cache, kept as the ORACLE of the sequential rows (Learning 738) ──
// `createCitationCacheS343` is `createCitationCache` of the base of Session 344, character for character, with its helper types and `dedupeByKey` (which the module does not export) beside it. Asks that do not overlap must see
// the file system EXACTLY as they did: the same stats and reads in the same order, the same answers, the same files kept under the bound.

interface CachedBibliographyS343 {
  mtimeMs: number;
  size: number;
  ctimeMs: number | undefined;
  citations: readonly Citation[];
}

function createCitationCacheS343(options: CitationCacheOptions): CitationCache {
  const entries = new Map<string, CachedBibliographyS343>();

  /** The parsed citations of one file, from the entry if its signature is unchanged and from the file if not; throws if the file cannot be `stat`ed or read. */
  async function citationsOf(absolute: string): Promise<readonly Citation[]> {
    const signature = await options.stat(absolute);
    const { mtimeMs, size, ctimeMs } = signature;
    const known = typeof mtimeMs === "number" && typeof size === "number";
    const kept = entries.get(absolute);
    if (known && kept !== undefined && kept.mtimeMs === mtimeMs && kept.size === size && kept.ctimeMs === ctimeMs) {
      entries.delete(absolute);
      entries.set(absolute, kept); // most recently used
      return kept.citations;
    }
    const citations = parseCitations(await options.readFile(absolute)).map((citation) => Object.freeze(citation));
    entries.delete(absolute);
    if (known) {
      entries.set(absolute, { mtimeMs, size, ctimeMs, citations });
      while (entries.size > CITATION_CACHE_MAX_FILES) {
        const oldest = entries.keys().next();
        if (oldest.done === true) break;
        entries.delete(oldest.value);
      }
    }
    return citations;
  }

  return {
    async read(relPaths, dir) {
      const merged: Citation[] = [];
      for (const relPath of relPaths) {
        let absolute = "";
        try {
          absolute = path.resolve(dir, relPath);
          appendCitations(merged, await citationsOf(absolute));
        } catch {
          // A file that cannot be stat'ed or read adds nothing, and what was kept for it is stale from now on.
          entries.delete(absolute);
        }
      }
      return dedupeByKeyS343(merged);
    },
  };
}

/** Keep only the first citation for each key, preserving order. */
function dedupeByKeyS343(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  return citations.filter((c) => {
    if (seen.has(c.key)) {
      return false;
    }
    seen.add(c.key);
    return true;
  });
}

/** A small seeded generator (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("Session 344 -- asks that do NOT overlap see the file system exactly as the Session 343 cache did (the old spelling is the oracle)", () => {
  const NAMES = Array.from({ length: 20 }, (_, i) => `f${i}${i % 3 === 0 ? ".json" : ".bib"}`); // 20 files: more than the bound of 16
  const csl = (entries: Array<[string, string]>): string => JSON.stringify(entries.map(([key, title]) => ({ id: key, title })));

  /** One seeded history of awaited asks over a file system that changes, vanishes, locks and comes back between asks; the stats, the reads and the answers it saw. */
  async function sequentialHistory(seed: number, make: (options: CitationCacheOptions) => CitationCache): Promise<{ events: string[]; answers: string[] }> {
    const next = seeded(seed);
    const pickOf = <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)];
    const keyPool = ["k1", "k2", "k3", "Smith2020", "doe:1999", "x"];
    const fs = fakeFs();
    let clock = 1;
    const fresh = (name: string): FakeFile => {
      const entries = Array.from({ length: Math.floor(next() * 3) }, (): [string, string] => [pickOf(keyPool), "T" + Math.floor(next() * 1000)]);
      return { content: name.endsWith(".json") ? csl(entries) : bibtex(entries), mtimeMs: clock++, unreadable: next() < 0.1 };
    };
    for (const name of NAMES) if (next() < 0.8) fs.set(name, fresh(name));
    const cache = make(fs);
    const answers: string[] = [];
    for (let ask = 0; ask < 14; ask++) {
      for (const name of NAMES) {
        const roll = next();
        const current = fs.files.get(at(name));
        if (roll < 0.2 && current !== undefined) fs.set(name, { ...fresh(name), size: next() < 0.3 ? current.size ?? current.content.length : undefined }); // a new time, sometimes the old size
        else if (roll < 0.26) fs.set(name, undefined);
        else if (roll < 0.34 && current === undefined) fs.set(name, fresh(name));
      }
      const declared = Array.from({ length: Math.floor(next() * 6) }, () => pickOf(NAMES));
      answers.push(declared.join(",") + " => " + JSON.stringify(await cache.read(declared, DIR)));
    }
    return { events: fs.events, answers };
  }

  it("300 seeded histories of 14 asks over 20 files (more than the bound), the file system changing, vanishing, locking and coming back between asks: the stats, the reads and the answers are the old cache's, in the same order", async () => {
    let reads = 0;
    const different: string[] = [];
    for (let seed = 1; seed <= 300; seed++) {
      const old = await sequentialHistory(seed, createCitationCacheS343);
      const now = await sequentialHistory(seed, createCitationCache);
      reads += now.events.filter((e) => e.startsWith("read:")).length;
      if (JSON.stringify(now) !== JSON.stringify(old)) different.push(`seed ${seed}`);
    }
    expect(different).toEqual([]);
    expect(reads).toBeGreaterThan(5000); // the sample is what the title says: the bound is crossed and many files are read
  });
});

describe("Session 344 -- asks that overlap, files that change while they are in flight (a seeded model)", () => {
  /** The version `n` of a file: one citation `k` whose title says which version it is; the time moves with the version, and so does the size once a number gains a digit. */
  const versionContent = (n: number): string => bibtex([["k", "v" + n]]);
  const versionOf = (answer: Array<{ title?: string }>): number => Number((answer[0]?.title ?? "v-1").slice(1));

  it("400 seeded histories of up to 14 steps (ask a file, rewrite a file, let a few ticks pass) with a random delay in every stat and read: no ask is ever answered with a version OLDER than the file held when it asked, or newer than it held when it was answered; and asks DO share reads", async () => {
    const names = ["a.bib", "b.bib", "c.bib"];
    let asked = 0;
    let read = 0;
    let rewrittenInFlight = 0;
    const violations: string[] = [];
    for (let seed = 1; seed <= 400; seed++) {
      const next = seeded(seed);
      const calls = new Map<string, number>();
      const jitter = (op: "stat" | "read", absolute: string): number => {
        const n = (calls.get(op + absolute) ?? 0) + 1;
        calls.set(op + absolute, n);
        return (seed * 31 + n * 7 + absolute.length * 3 + (op === "read" ? 5 : 0)) % 5;
      };
      const fs = fakeFs({}, jitter);
      const version = new Map<string, number>();
      const write = (name: string): void => {
        const n = (version.get(name) ?? 0) + 1;
        version.set(name, n);
        fs.set(name, { content: versionContent(n), mtimeMs: n * 10 });
      };
      for (const name of names) write(name);
      const cache = createCitationCache(fs);
      const pending: Array<Promise<void>> = [];
      for (let step = 0; step < 14; step++) {
        const roll = next();
        const name = names[Math.floor(next() * names.length)];
        if (roll < 0.5) {
          const atAsk = version.get(name) ?? 0;
          asked++;
          pending.push(
            cache.read([name], DIR).then((answer) => {
              const got = versionOf(answer);
              const atAnswer = version.get(name) ?? 0;
              if (atAnswer > atAsk) rewrittenInFlight++;
              if (got < atAsk || got > atAnswer) violations.push(`seed ${seed} step ${step} ${name}: asked at v${atAsk}, answered at v${atAnswer}, got v${got}`);
            }),
          );
        } else if (roll < 0.75) {
          write(name);
        } else {
          for (let ticks = Math.floor(next() * 8); ticks > 0; ticks--) await Promise.resolve();
        }
      }
      await Promise.all(pending);
      read += fs.reads();
    }
    expect(violations).toEqual([]);
    expect(asked).toBeGreaterThan(2000);
    expect(asked - read).toBeGreaterThan(900); // asks answered without a read of their own: hits and shared reads
    expect(rewrittenInFlight).toBeGreaterThan(600); // and the file really was rewritten while asks were in flight
  });

  it("300 seeds of two groups each, a group of 1 to 3 overlapping asks over up to 4 files, nothing changing: every answer of both groups is readCitations' answer, and in the FIRST group of each seed a file that can be read is read at most ONCE (a locked file is tried again by every later ask, by design)", async () => {
    const names = ["a.bib", "b.json", "c.bib", "gone.bib", "locked.bib"];
    const files: Record<string, FakeFile> = {
      "a.bib": { content: bibtex([["a1", "A"], ["shared", "from A"]]), mtimeMs: 1 },
      "b.json": { content: JSON.stringify([{ id: "b1", title: "B" }, { id: "shared", title: "from B" }]), mtimeMs: 2 },
      "c.bib": { content: bibtex([["c1", "C"]]), mtimeMs: 3 },
      "locked.bib": { content: bibtex([["l1", "L"]]), mtimeMs: 4, unreadable: true },
    };
    const disagreements: string[] = [];
    let groupsThatShared = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const next = seeded(seed);
      const calls = new Map<string, number>();
      const fs = fakeFs(files, (op, absolute) => {
        const n = (calls.get(op + absolute) ?? 0) + 1;
        calls.set(op + absolute, n);
        return (seed + n * 3 + absolute.length) % 4;
      });
      const cache = createCitationCache(fs);
      for (let group = 0; group < 2; group++) {
        const declared = Array.from({ length: 1 + Math.floor(next() * 3) }, () => Array.from({ length: Math.floor(next() * 5) }, () => names[Math.floor(next() * names.length)]));
        const before = fs.reads();
        const answers = await Promise.all(declared.map((one) => cache.read(one, DIR)));
        const readsOfGroup = fs.events.slice(0).filter((e) => e.startsWith("read:")).length - before;
        const perFile = new Map<string, number>();
        for (const e of fs.events.filter((e) => e.startsWith("read:"))) perFile.set(e, (perFile.get(e) ?? 0) + 1);
        if (group === 0) {
          // the first group meets an empty cache: a file is read at most once however many asks name it. A file whose read FAILS is the exception by design (an ask that comes after the failure tries again), so it is left out.
          for (const [event, count] of perFile) if (count > 1 && !event.endsWith("locked.bib")) disagreements.push(`seed ${seed}: ${event} read ${count} times in the first group`);
          if (declared.length > 1 && readsOfGroup < declared.reduce((total, one) => total + one.length, 0)) groupsThatShared++;
        }
        for (let i = 0; i < declared.length; i++) {
          const expected = await readCitations(declared[i], DIR, async (absolute) => {
            const file = fs.files.get(absolute);
            if (file === undefined || file.unreadable === true) throw new Error("ENOENT");
            return file.content;
          });
          if (JSON.stringify(answers[i]) !== JSON.stringify(expected)) disagreements.push(`seed ${seed} group ${group} ask ${i}: ${declared[i].join(",")}`);
        }
      }
    }
    expect(disagreements).toEqual([]);
    expect(groupsThatShared).toBeGreaterThan(100); // the sample is what the title says: reads were shared
  });
});

describe("Session 344 -- on a real file system", () => {
  const readerOver = (log: string[]) => ({
    readFile: async (absolute: string): Promise<string> => {
      log.push("read");
      return nodeFs.promises.readFile(absolute, "utf8");
    },
    stat: (absolute: string): Promise<BibliographyStat> => nodeFs.promises.stat(absolute),
  });
  const tempDir = (): string => nodeFs.mkdtempSync(path.join(os.tmpdir(), "s344-citations-"));
  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
  /** Wait until the clock is `ms` past the file's change time, so that the next change is stamped with a later time on a coarse clock too (at most 60 tries of 10 ms: a file system whose clock is not this machine's would otherwise be waited on for good). */
  async function letClockPass(file: string, ms: number): Promise<void> {
    for (let tries = 0; tries < 60 && Date.now() - nodeFs.statSync(file).ctimeMs < ms; tries++) await sleep(10);
  }
  const canLockOut = process.platform !== "win32" && typeof process.getuid === "function" && process.getuid() !== 0;

  it("five overlapping first asks to one bibliography read it once (the stat is a real one, resolved by the event loop)", async () => {
    const dir = tempDir();
    try {
      nodeFs.writeFileSync(path.join(dir, "refs.bib"), bibtex(Array.from({ length: 200 }, (_, i): [string, string] => [`key${i}`, `t${i}`])));
      const log: string[] = [];
      const cache = createCitationCache(readerOver(log));
      const answers = await Promise.all([1, 2, 3, 4, 5].map(() => cache.read(["refs.bib"], dir)));
      expect(log).toEqual(["read"]);
      expect(answers.map((answer) => answer.length)).toEqual([200, 200, 200, 200, 200]);
    } finally {
      nodeFs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(!canLockOut)("`chmod 000` after a cached read is SEEN, because a chmod always moves the change time: the cache reads again, the read fails, and the file adds nothing, which is readCitations' answer (the item's 'blind to chmod 000' did not reproduce)", async () => {
    const dir = tempDir();
    const file = path.join(dir, "refs.bib");
    try {
      nodeFs.writeFileSync(file, bibtex([["k1", "readable"]]));
      await letClockPass(file, 50);
      const log: string[] = [];
      const cache = createCitationCache(readerOver(log));
      expect(keys(await cache.read(["refs.bib"], dir))).toEqual(["k1"]);
      const before = nodeFs.statSync(file);
      nodeFs.chmodSync(file, 0o000);
      const after = nodeFs.statSync(file);
      expect([after.mtimeMs === before.mtimeMs, after.size === before.size, after.ctimeMs === before.ctimeMs]).toEqual([true, true, false]); // the premise: the change time is the one number that moved
      expect(await cache.read(["refs.bib"], dir)).toEqual([]);
      expect(log).toEqual(["read", "read"]);
      expect(await readCitations(["refs.bib"], dir, (absolute) => nodeFs.promises.readFile(absolute, "utf8"))).toEqual([]); // and that is the oracle's answer
      nodeFs.chmodSync(file, 0o644);
      expect(keys(await cache.read(["refs.bib"], dir))).toEqual(["k1"]); // readable again: read again, not served from the entry the failure dropped
    } finally {
      nodeFs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a symlink retargeted to another file of the SAME size and the same modification time is seen when the two targets' change times differ (stat follows the link, so the signature is the target's)", async () => {
    const dir = tempDir();
    try {
      const a = path.join(dir, "A.bib");
      const b = path.join(dir, "B.bib");
      const link = path.join(dir, "current.bib");
      nodeFs.writeFileSync(a, bibtex([["va", "AAAA"]]));
      await letClockPass(a, 50);
      nodeFs.writeFileSync(b, bibtex([["vb", "AAAA"]]));
      const same = new Date("2024-01-01T00:00:00.000Z");
      nodeFs.utimesSync(a, same, same);
      await letClockPass(a, 50);
      nodeFs.utimesSync(b, same, same); // the modification times are now equal, and the sizes are; B's change time is the later one
      try {
        nodeFs.symlinkSync(a, link);
      } catch {
        return; // no symbolic links here (Windows without the privilege)
      }
      const log: string[] = [];
      const cache = createCitationCache(readerOver(log));
      expect(keys(await cache.read(["current.bib"], dir))).toEqual(["va"]);
      nodeFs.unlinkSync(link);
      nodeFs.symlinkSync(b, link);
      const sa = nodeFs.statSync(a);
      const sb = nodeFs.statSync(b);
      expect([sa.mtimeMs === sb.mtimeMs, sa.size === sb.size, sa.ctimeMs === sb.ctimeMs]).toEqual([true, true, false]); // the premise: only the change time tells the two targets apart
      expect(keys(await cache.read(["current.bib"], dir))).toEqual(["vb"]);
      expect(log).toEqual(["read", "read"]);
    } finally {
      nodeFs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
