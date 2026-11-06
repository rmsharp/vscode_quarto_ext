import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { type BibliographyStat, type Citation, createCitationCache, readCitations } from "../../src/core/citations";

// Session 343, part (4), SIB-07. `loadCitations` (`src/providers/citation.ts`) read and parsed EVERY bibliography a document declares on EVERY completion request: at five lines an entry the parse is 2.3 / 10.2 / 39.7 ms
// at 1,000 / 5,000 / 20,000 entries (the lead's probe sib07, a median of 7 in a fresh process, load 6 to 15), and the cost is proportional to the bytes. `createCitationCache` (`src/core/citations.ts`) keeps the PARSED
// citations of each file, keyed by its absolute path, and reuses them while the file's modification time and size are both what they were when it was read. Everything here runs on stand-ins for `readFile` and `stat`
// (`fakeFs`): the rows COUNT what the cache asks of them, which is a claim without a clock (Learning 913), and compare every answer with `readCitations`, the function the cache replaces, kept as the oracle.
//
// THE ONE BLIND SPOT, stated and pinned by a row of its own: a file rewritten within one millisecond to the SAME size, with the same modification time, is not seen (the mtime granularity of the file system), as with any
// build tool that decides by stat. The signature is read BEFORE the content, so a file that changes between the two is read again at the next ask, never served stale.

const DIR = path.resolve("/work/doc");
const at = (rel: string): string => path.resolve(DIR, rel);

interface FakeFile {
  content: string;
  mtimeMs: number;
  /** The size `stat` reports; the content's length when absent. */
  size?: number;
  /** `stat` answers, `readFile` rejects. */
  unreadable?: boolean;
}

/** A file system of stand-ins: every `stat` and `readFile` is logged, in order, as `stat:<path>` and `read:<path>`; a missing file rejects both. */
function fakeFs(initial: Record<string, FakeFile> = {}) {
  const files = new Map<string, FakeFile>(Object.entries(initial).map(([rel, file]) => [at(rel), file]));
  const events: string[] = [];
  return {
    files,
    events,
    set: (rel: string, file: FakeFile | undefined): void => void (file === undefined ? files.delete(at(rel)) : files.set(at(rel), file)),
    readFile: async (absolute: string): Promise<string> => {
      events.push("read:" + absolute);
      const file = files.get(absolute);
      if (file === undefined || file.unreadable === true) throw new Error("ENOENT: " + absolute);
      return file.content;
    },
    stat: async (absolute: string): Promise<BibliographyStat> => {
      events.push("stat:" + absolute);
      const file = files.get(absolute);
      if (file === undefined) throw new Error("ENOENT: " + absolute);
      return { mtimeMs: file.mtimeMs, size: file.size ?? file.content.length };
    },
    reads: (): number => events.filter((e) => e.startsWith("read:")).length,
    stats: (): number => events.filter((e) => e.startsWith("stat:")).length,
  };
}

/** A BibTeX file of `[key, title]` entries. */
const bibtex = (entries: Array<[string, string]>): string => entries.map(([key, title]) => `@article{${key},\n  author = {Author of ${key}},\n  title = {${title}},\n  year = {2020}\n}\n`).join("\n");
/** A CSL-JSON file of `[key, title]` entries. */
const csl = (entries: Array<[string, string]>): string => JSON.stringify(entries.map(([key, title]) => ({ id: key, title, author: [{ family: "Doe", given: "J" }], issued: { "date-parts": [[2021]] } })));

const FILES: Record<string, FakeFile> = {
  "a.bib": { content: bibtex([["a1", "A one"], ["a2", "A two"], ["shared", "from A"]]), mtimeMs: 1000 },
  "b.json": { content: csl([["b1", "B one"], ["shared", "from B"], ["b2", "B two"]]), mtimeMs: 2000 },
  "empty.bib": { content: "", mtimeMs: 3000 },
  "bad.json": { content: "[ not json", mtimeMs: 3500 },
  "bom.bib": { content: "﻿" + bibtex([["bom1", "Under a byte order mark"]]), mtimeMs: 3700 },
  "locked.bib": { content: bibtex([["locked1", "Cannot be read"]]), mtimeMs: 4000, unreadable: true },
  // "missing.bib" is not in the file system
};
const POOL = ["a.bib", "b.json", "empty.bib", "missing.bib", "locked.bib"];

describe("Session 343 -- the bibliography cache asks the file system as little as the answer allows (counted; the claim has no clock)", () => {
  it("N reads of one unchanged file read it ONCE and stat it N times (the first read is the only miss)", async () => {
    const fs = fakeFs(FILES);
    const cache = createCitationCache(fs);
    for (let n = 1; n <= 5; n++) {
      expect((await cache.read(["a.bib"], DIR)).map((c) => c.key)).toEqual(["a1", "a2", "shared"]);
      expect([fs.reads(), fs.stats()]).toEqual([1, n]);
    }
    expect(fs.events.slice(0, 3)).toEqual(["stat:" + at("a.bib"), "read:" + at("a.bib"), "stat:" + at("a.bib")]);
  });

  it("the file's signature is read BEFORE its content: a miss is `stat` then `readFile`, a hit is `stat` alone", async () => {
    const fs = fakeFs(FILES);
    const cache = createCitationCache(fs);
    await cache.read(["a.bib", "b.json"], DIR);
    await cache.read(["a.bib", "b.json"], DIR);
    expect(fs.events).toEqual(["stat:" + at("a.bib"), "read:" + at("a.bib"), "stat:" + at("b.json"), "read:" + at("b.json"), "stat:" + at("a.bib"), "stat:" + at("b.json")]);
  });

  it("a file that changes between the stat and the read is read AGAIN at the next ask, never served stale (the signature kept is the one read before the content)", async () => {
    const fs = fakeFs({ "a.bib": { content: bibtex([["old1", "Old"]]), mtimeMs: 10 } });
    const racing = {
      stat: fs.stat,
      readFile: async (absolute: string): Promise<string> => {
        const content = await fs.readFile(absolute);
        fs.set("a.bib", { content: bibtex([["new1", "New"]]), mtimeMs: 20 }); // the file is rewritten just after its content was read
        return content;
      },
    };
    const cache = createCitationCache(racing);
    expect((await cache.read(["a.bib"], DIR)).map((c) => c.key)).toEqual(["old1"]);
    expect((await cache.read(["a.bib"], DIR)).map((c) => c.key)).toEqual(["new1"]);
    expect((await cache.read(["a.bib"], DIR)).map((c) => c.key)).toEqual(["new1"]);
    expect(fs.reads()).toBe(2);
  });

  it("a read of no path asks the file system nothing and answers []", async () => {
    const fs = fakeFs(FILES);
    const cache = createCitationCache(fs);
    expect(await cache.read([], DIR)).toEqual([]);
    expect(fs.events).toEqual([]);
  });

  it("a changed modification time re-reads, and so does a changed size, each alone; the same two numbers again do not", async () => {
    const fs = fakeFs({ "a.bib": { content: bibtex([["a1", "v1"]]), mtimeMs: 100, size: 50 } });
    const cache = createCitationCache(fs);
    const keys = async (): Promise<string[]> => (await cache.read(["a.bib"], DIR)).map((c) => `${c.key}:${c.title}`);
    expect(await keys()).toEqual(["a1:v1"]);
    expect(fs.reads()).toBe(1);
    fs.set("a.bib", { content: bibtex([["a1", "v2"]]), mtimeMs: 101, size: 50 }); // the time alone moved
    expect(await keys()).toEqual(["a1:v2"]);
    expect(fs.reads()).toBe(2);
    fs.set("a.bib", { content: bibtex([["a1", "v3"]]), mtimeMs: 101, size: 51 }); // the size alone moved
    expect(await keys()).toEqual(["a1:v3"]);
    expect(fs.reads()).toBe(3);
    expect(await keys()).toEqual(["a1:v3"]); // nothing moved
    expect(fs.reads()).toBe(3);
    fs.set("a.bib", { content: bibtex([["a1", "v4"]]), mtimeMs: 99, size: 51 }); // an OLDER time is a change too (a restored backup)
    expect(await keys()).toEqual(["a1:v4"]);
    expect(fs.reads()).toBe(4);
  });

  it("THE BLIND SPOT, pinned: a rewrite that keeps the modification time and the size is not seen, and the old citations are served", async () => {
    const fs = fakeFs({ "a.bib": { content: bibtex([["a1", "AAAA"]]), mtimeMs: 100, size: 80 } });
    const cache = createCitationCache(fs);
    expect((await cache.read(["a.bib"], DIR)).map((c) => c.title)).toEqual(["AAAA"]);
    fs.set("a.bib", { content: bibtex([["a1", "BBBB"]]), mtimeMs: 100, size: 80 }); // the same two numbers, other content
    expect((await cache.read(["a.bib"], DIR)).map((c) => c.title)).toEqual(["AAAA"]);
    expect(fs.reads()).toBe(1);
  });

  it("the cache compares the numbers it kept and not the object `stat` handed back: a stat that returns ONE object it edits in place is read as the change it is", async () => {
    const shared: BibliographyStat = { mtimeMs: 1, size: 10 };
    let content = bibtex([["a1", "first"]]);
    let reads = 0;
    const cache = createCitationCache({
      stat: async () => shared,
      readFile: async () => {
        reads++;
        return content;
      },
    });
    expect((await cache.read(["x.bib"], DIR)).map((c) => c.title)).toEqual(["first"]);
    content = bibtex([["a1", "second"]]);
    shared.mtimeMs = 2;
    expect((await cache.read(["x.bib"], DIR)).map((c) => c.title)).toEqual(["second"]);
    expect(reads).toBe(2);
  });

  // The values a number can hold (Learning 914): a fraction, NaN, the infinities, -0, 2^53. `===` is the comparison: a NaN is never equal to itself, so it re-reads at every ask (the safe direction for a stat that cannot say),
  // and 0 and -0 are one signature.
  describe.each([
    ["a fraction", 1234.5678, 1],
    ["zero", 0, 1],
    ["minus zero", -0, 1],
    ["plus Infinity", Infinity, 1],
    ["minus Infinity", -Infinity, 1],
    ["2^53", 2 ** 53, 1],
    ["a negative number", -5, 1],
    ["NaN", NaN, 2],
  ] as Array<[string, number, number]>)("modification time %s", (_name, value, readsAfterTwoAsks) => {
    it(`two asks with the same value read ${readsAfterTwoAsks} time(s); a different value reads again`, async () => {
      const fs = fakeFs({ "a.bib": { content: bibtex([["a1", "t"]]), mtimeMs: value, size: 10 } });
      const cache = createCitationCache(fs);
      await cache.read(["a.bib"], DIR);
      await cache.read(["a.bib"], DIR);
      expect(fs.reads()).toBe(readsAfterTwoAsks);
      fs.set("a.bib", { content: bibtex([["a1", "t"]]), mtimeMs: value === 7 ? 8 : 7, size: 10 });
      await cache.read(["a.bib"], DIR);
      expect(fs.reads()).toBe(readsAfterTwoAsks + 1);
    });
  });

  describe.each([
    ["a fraction", 12.5, 1],
    ["zero", 0, 1],
    ["minus zero", -0, 1],
    ["plus Infinity", Infinity, 1],
    ["2^53", 2 ** 53, 1],
    ["NaN", NaN, 2],
  ] as Array<[string, number, number]>)("size %s", (_name, value, readsAfterTwoAsks) => {
    it(`two asks with the same value read ${readsAfterTwoAsks} time(s); a different value reads again`, async () => {
      const fs = fakeFs({ "a.bib": { content: bibtex([["a1", "t"]]), mtimeMs: 5, size: value } });
      const cache = createCitationCache(fs);
      await cache.read(["a.bib"], DIR);
      await cache.read(["a.bib"], DIR);
      expect(fs.reads()).toBe(readsAfterTwoAsks);
      fs.set("a.bib", { content: bibtex([["a1", "t"]]), mtimeMs: 5, size: value === 7 ? 8 : 7 });
      await cache.read(["a.bib"], DIR);
      expect(fs.reads()).toBe(readsAfterTwoAsks + 1);
    });
  });

  it("zero and minus zero are one signature: a stat that answers 0 and then -0 does not re-read", async () => {
    let mtimeMs = 0;
    let reads = 0;
    const cache = createCitationCache({
      stat: async () => ({ mtimeMs, size: 3 }),
      readFile: async () => {
        reads++;
        return bibtex([["z", "zero"]]);
      },
    });
    await cache.read(["z.bib"], DIR);
    mtimeMs = -0;
    await cache.read(["z.bib"], DIR);
    expect(reads).toBe(1);
  });

  it("a stat that does not carry two numbers (no field, a string, null) is not a signature: the file is read at every ask and nothing is kept", async () => {
    for (const odd of [{}, { mtimeMs: 1 }, { size: 1 }, { mtimeMs: "1", size: "1" }, { mtimeMs: null, size: null }, { mtimeMs: undefined, size: undefined }]) {
      let reads = 0;
      const cache = createCitationCache({
        stat: async () => odd as unknown as BibliographyStat,
        readFile: async () => {
          reads++;
          return bibtex([["o", "odd"]]);
        },
      });
      const first = await cache.read(["o.bib"], DIR);
      const second = await cache.read(["o.bib"], DIR);
      expect([reads, first.map((c) => c.key), second.map((c) => c.key)]).toEqual([2, ["o"], ["o"]]);
    }
  });
});

describe("Session 343 -- which files share an entry, and what the bound drops", () => {
  it("two documents that declare the same file by two spellings share ONE entry: `refs.bib` from its own directory and `../doc/refs.bib` from a sibling's", async () => {
    const fs = fakeFs({ "refs.bib": { content: bibtex([["r1", "shared"]]), mtimeMs: 5 } });
    const cache = createCitationCache(fs);
    await cache.read(["refs.bib"], DIR);
    await cache.read(["../doc/refs.bib"], path.resolve("/work/other"));
    await cache.read(["./refs.bib"], DIR);
    expect(fs.reads()).toBe(1);
    expect(fs.stats()).toBe(3);
  });

  it("two files of one name in two directories are TWO entries, each read once", async () => {
    const fs = fakeFs({ "refs.bib": { content: bibtex([["here", "x"]]), mtimeMs: 5 }, "../other/refs.bib": { content: bibtex([["there", "y"]]), mtimeMs: 5 } });
    const cache = createCitationCache(fs);
    expect((await cache.read(["refs.bib"], DIR)).map((c) => c.key)).toEqual(["here"]);
    expect((await cache.read(["refs.bib"], path.resolve("/work/other"))).map((c) => c.key)).toEqual(["there"]);
    expect((await cache.read(["refs.bib"], DIR)).map((c) => c.key)).toEqual(["here"]);
    expect((await cache.read(["refs.bib"], path.resolve("/work/other"))).map((c) => c.key)).toEqual(["there"]);
    expect(fs.reads()).toBe(2);
  });

  it("two caches share nothing", async () => {
    const fs = fakeFs(FILES);
    const one = createCitationCache(fs);
    const two = createCitationCache(fs);
    await one.read(["a.bib"], DIR);
    await two.read(["a.bib"], DIR);
    expect(fs.reads()).toBe(2);
  });

  // 17 files of one citation each: f0 .. f16. The bound is 16 files, and the one dropped is the least recently USED.
  const many = (): ReturnType<typeof fakeFs> => fakeFs(Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`f${i}.bib`, { content: bibtex([[`k${i}`, `title ${i}`]]), mtimeMs: 1 + i }])));

  it("the 17th file drops the first: f0 is read again, f16 is not", async () => {
    const fs = many();
    const cache = createCitationCache(fs);
    for (let i = 0; i <= 16; i++) await cache.read([`f${i}.bib`], DIR);
    expect(fs.reads()).toBe(17);
    await cache.read(["f16.bib"], DIR);
    expect(fs.reads()).toBe(17);
    await cache.read(["f0.bib"], DIR);
    expect(fs.reads()).toBe(18);
  });

  it("the file dropped is the least recently USED, not the oldest read: f0 asked again after f15 survives the 17th file, and f1 does not", async () => {
    const fs = many();
    const cache = createCitationCache(fs);
    for (let i = 0; i <= 15; i++) await cache.read([`f${i}.bib`], DIR); // 16 entries, f0 the oldest
    await cache.read(["f0.bib"], DIR); // a hit: f0 is now the newest
    expect(fs.reads()).toBe(16);
    await cache.read(["f16.bib"], DIR); // the 17th file: f1 is the least recently used
    expect(fs.reads()).toBe(17);
    await cache.read(["f0.bib"], DIR);
    expect(fs.reads()).toBe(17); // f0 is still there
    await cache.read(["f1.bib"], DIR);
    expect(fs.reads()).toBe(18); // f1 was dropped
  });

  it("a file that CHANGED replaces its own entry and does not grow the cache: with 16 files held, one rewritten, the other 15 still hit", async () => {
    const fs = many();
    const cache = createCitationCache(fs);
    for (let i = 0; i <= 15; i++) await cache.read([`f${i}.bib`], DIR);
    fs.set("f3.bib", { content: bibtex([["k3", "rewritten"]]), mtimeMs: 999 });
    expect((await cache.read(["f3.bib"], DIR)).map((c) => c.title)).toEqual(["rewritten"]);
    expect(fs.reads()).toBe(17);
    for (let i = 0; i <= 15; i++) await cache.read([`f${i}.bib`], DIR);
    expect(fs.reads()).toBe(17);
  });

  it("a file that CHANGED counts as just used: with 16 held, the OLDEST rewritten and a 17th file read, the one dropped is the next oldest (f1), not the file just rewritten (f0)", async () => {
    const fs = many();
    const cache = createCitationCache(fs);
    for (let i = 0; i <= 15; i++) await cache.read([`f${i}.bib`], DIR);
    fs.set("f0.bib", { content: bibtex([["k0", "rewritten"]]), mtimeMs: 999 });
    await cache.read(["f0.bib"], DIR); // a miss: read again, and the newest entry now
    await cache.read(["f16.bib"], DIR); // the 17th file
    expect(fs.reads()).toBe(18);
    await cache.read(["f0.bib"], DIR);
    expect(fs.reads()).toBe(18); // f0 is still there
    await cache.read(["f1.bib"], DIR);
    expect(fs.reads()).toBe(19); // f1 is the one that went
  });

  it("a modification time that moves by a fraction of a millisecond is a change (file systems report sub-millisecond times): 1000.25, 1000.75 and 1000.2500001 are three signatures", async () => {
    const fs = fakeFs({ "a.bib": { content: bibtex([["a1", "t"]]), mtimeMs: 1000.25, size: 10 } });
    const cache = createCitationCache(fs);
    await cache.read(["a.bib"], DIR);
    fs.set("a.bib", { content: bibtex([["a1", "t"]]), mtimeMs: 1000.75, size: 10 });
    await cache.read(["a.bib"], DIR);
    fs.set("a.bib", { content: bibtex([["a1", "t"]]), mtimeMs: 1000.2500001, size: 10 });
    await cache.read(["a.bib"], DIR);
    expect(fs.reads()).toBe(3);
  });

  it("a file whose stat carries no signature is kept nowhere, so read after 16 held files it does not push the oldest one out", async () => {
    const fs = many();
    fs.set("odd.bib", { content: bibtex([["odd", "no signature"]]), mtimeMs: 1 });
    const none = { mtimeMs: undefined, size: undefined } as unknown as BibliographyStat;
    const cache = createCitationCache({ readFile: fs.readFile, stat: (absolute) => (absolute.endsWith("odd.bib") ? Promise.resolve(none) : fs.stat(absolute)) });
    for (let i = 0; i <= 15; i++) await cache.read([`f${i}.bib`], DIR);
    expect((await cache.read(["odd.bib"], DIR)).map((c) => c.key)).toEqual(["odd"]);
    const before = fs.reads();
    await cache.read(["f0.bib"], DIR);
    expect(fs.reads()).toBe(before); // f0 is still held
  });

  it("a document that declares MORE files than the bound gets every one of them, in order, at the first ask and at the second", async () => {
    const fs = many();
    const cache = createCitationCache(fs);
    const declared = Array.from({ length: 20 }, (_, i) => `f${i}.bib`);
    const expected = await readCitations(declared, DIR, fs.readFile);
    const first = await cache.read(declared, DIR);
    const second = await cache.read(declared, DIR);
    expect(first.map((c) => c.key)).toEqual(Array.from({ length: 20 }, (_, i) => `k${i}`));
    expect(first).toEqual(expected);
    expect(second).toEqual(expected);
  });

  it("a file declared twice in one document is read once and listed once", async () => {
    const fs = fakeFs(FILES);
    const cache = createCitationCache(fs);
    expect((await cache.read(["a.bib", "a.bib"], DIR)).map((c) => c.key)).toEqual(["a1", "a2", "shared"]);
    expect(fs.reads()).toBe(1);
  });
});

describe("Session 343 -- a file that disappears, cannot be read, or comes back", () => {
  it("a missing file adds nothing and is not read (`stat` failed); a file that APPEARS between two asks is read at the second", async () => {
    const fs = fakeFs({ "a.bib": FILES["a.bib"] });
    const cache = createCitationCache(fs);
    expect((await cache.read(["a.bib", "late.bib"], DIR)).map((c) => c.key)).toEqual(["a1", "a2", "shared"]);
    expect(fs.events.filter((e) => e.startsWith("read:") && e.includes("late"))).toEqual([]);
    fs.set("late.bib", { content: bibtex([["late1", "arrived"]]), mtimeMs: 7 });
    expect((await cache.read(["a.bib", "late.bib"], DIR)).map((c) => c.key)).toEqual(["a1", "a2", "shared", "late1"]);
  });

  it("a file that DISAPPEARS adds nothing from then on, and its entry is dropped: restored with the very same time and size it is read again, not served from the old entry", async () => {
    const original: FakeFile = { content: bibtex([["gone1", "before"]]), mtimeMs: 50, size: 90 };
    const fs = fakeFs({ "a.bib": original });
    const cache = createCitationCache(fs);
    expect((await cache.read(["a.bib"], DIR)).map((c) => c.key)).toEqual(["gone1"]);
    fs.set("a.bib", undefined);
    expect(await cache.read(["a.bib"], DIR)).toEqual([]);
    fs.set("a.bib", { content: bibtex([["back1", "after"]]), mtimeMs: 50, size: 90 }); // the same two numbers, other content
    expect((await cache.read(["a.bib"], DIR)).map((c) => c.key)).toEqual(["back1"]);
    expect(fs.reads()).toBe(2);
  });

  it("a file that exists but cannot be read adds nothing; its stale entry is dropped, so it is not served once it can be read again with the old time and size", async () => {
    const fs = fakeFs({ "a.bib": { content: bibtex([["k1", "readable"]]), mtimeMs: 50, size: 90 } });
    const cache = createCitationCache(fs);
    expect((await cache.read(["a.bib"], DIR)).map((c) => c.key)).toEqual(["k1"]);
    fs.set("a.bib", { content: bibtex([["k2", "locked"]]), mtimeMs: 60, size: 90, unreadable: true });
    expect(await cache.read(["a.bib"], DIR)).toEqual([]);
    fs.set("a.bib", { content: bibtex([["k3", "unlocked"]]), mtimeMs: 50, size: 90 });
    expect((await cache.read(["a.bib"], DIR)).map((c) => c.key)).toEqual(["k3"]);
  });

  it("a locked file is not cached as empty: each ask tries it again, and an unreadable file between two readable ones does not stop the loop", async () => {
    const fs = fakeFs(FILES);
    const cache = createCitationCache(fs);
    const declared = ["a.bib", "locked.bib", "b.json"];
    expect((await cache.read(declared, DIR)).map((c) => c.key)).toEqual(["a1", "a2", "shared", "b1", "b2"]);
    await cache.read(declared, DIR);
    expect(fs.events.filter((e) => e === "read:" + at("locked.bib"))).toHaveLength(2);
  });

  it("a `stat` or a `readFile` that THROWS (does not reject) is a skipped file too", async () => {
    const cache = createCitationCache({
      stat: ((absolute: string) => {
        if (absolute.endsWith("sync-stat.bib")) throw new Error("sync stat");
        return Promise.resolve({ mtimeMs: 1, size: 1 });
      }) as (p: string) => Promise<BibliographyStat>,
      readFile: ((absolute: string) => {
        if (absolute.endsWith("sync-read.bib")) throw new Error("sync read");
        return Promise.resolve(bibtex([["ok", "fine"]]));
      }) as (p: string) => Promise<string>,
    });
    expect((await cache.read(["sync-stat.bib", "sync-read.bib", "good.bib"], DIR)).map((c) => c.key)).toEqual(["ok"]);
  });

  it("a file whose stat fails is never read, even where readFile could have answered", async () => {
    const reads: string[] = [];
    const cache = createCitationCache({
      stat: async () => {
        throw new Error("no stat");
      },
      readFile: async (absolute) => {
        reads.push(absolute);
        return bibtex([["k", "t"]]);
      },
    });
    expect(await cache.read(["a.bib"], DIR)).toEqual([]);
    expect(reads).toEqual([]);
  });
});

describe("Session 343 -- the answer is readCitations' answer, on enumerated and on seeded bibliographies", () => {
  /** Every sequence of 0 to `maxLength` members of `alphabet`. */
  function sequences(alphabet: readonly string[], maxLength: number): string[][] {
    const all: string[][] = [[]];
    let layer: string[][] = [[]];
    for (let length = 1; length <= maxLength; length++) {
      const next: string[][] = [];
      for (const prefix of layer) for (const member of alphabet) next.push([...prefix, member]);
      all.push(...next);
      layer = next;
    }
    return all;
  }

  it("every sequence of up to four paths over a BibTeX file, a CSL-JSON file with a key in common, an empty file, a missing file and a locked file (781 documents): the first ask (all misses), the second (all hits) and a cache shared by all of them equal readCitations", async () => {
    const all = sequences(POOL, 4);
    expect(all).toHaveLength(781);
    const fs = fakeFs(FILES);
    const shared = createCitationCache(fs);
    const disagreements: string[] = [];
    for (const declared of all) {
      const expected = await readCitations(declared, DIR, fs.readFile);
      const fresh = createCitationCache(fs);
      for (const [label, got] of [
        ["first ask", await fresh.read(declared, DIR)],
        ["second ask", await fresh.read(declared, DIR)],
        ["shared cache", await shared.read(declared, DIR)],
      ] as Array<[string, Citation[]]>) {
        if (JSON.stringify(got) !== JSON.stringify(expected)) disagreements.push(`${declared.join(",")} (${label})`);
      }
    }
    expect(disagreements).toEqual([]);
  });

  it("the cross-file de-duplication is done at every ask over the CACHED files: the key two files share is the first declared file's, in either order, from the same two entries", async () => {
    const fs = fakeFs(FILES);
    const cache = createCitationCache(fs);
    const ab = await cache.read(["a.bib", "b.json"], DIR);
    const ba = await cache.read(["b.json", "a.bib"], DIR);
    expect(ab.find((c) => c.key === "shared")?.title).toBe("from A");
    expect(ba.find((c) => c.key === "shared")?.title).toBe("from B");
    expect(ab.map((c) => c.key)).toEqual(["a1", "a2", "shared", "b1", "b2"]);
    expect(ba.map((c) => c.key)).toEqual(["b1", "shared", "b2", "a1", "a2"]);
    expect(fs.reads()).toBe(2);
  });

  it("a BOM, a file that is not JSON under a `[`, and an empty file give what readCitations gives", async () => {
    const fs = fakeFs(FILES);
    const cache = createCitationCache(fs);
    for (const declared of [["bom.bib"], ["bad.json"], ["empty.bib"], ["bom.bib", "bad.json", "empty.bib", "a.bib"]]) {
      expect(await cache.read(declared, DIR)).toEqual(await readCitations(declared, DIR, fs.readFile));
      expect(await cache.read(declared, DIR)).toEqual(await readCitations(declared, DIR, fs.readFile));
    }
  });

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

  it("500 seeded histories of 12 asks over 6 files whose contents, times and sizes change, vanish and come back between asks: every answer equals readCitations over the files as they stand at that ask", async () => {
    const next = seeded(343);
    const pickOf = <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)];
    const keyPool = ["k1", "k2", "k3", "k4", "k5", "Smith2020", "doe:1999", "x"];
    const names = ["f0.bib", "f1.json", "f2.bib", "f3.bib", "f4.json", "f5.bib"];
    const makeContent = (): string => {
      const entries = Array.from({ length: Math.floor(next() * 4) }, (): [string, string] => [pickOf(keyPool), "T" + Math.floor(next() * 1000)]);
      return next() < 0.4 ? csl(entries) : bibtex(entries);
    };
    let moves = 0;
    let hits = 0;
    const disagreements: string[] = [];
    for (let history = 0; history < 500; history++) {
      const fs = fakeFs();
      let clock = 1;
      // The signatures each file has had in this history. A file that goes back to one it had (the size alone moving twice under one time: A, B, A) is the blind spot the row above pins, not a disagreement, so the
      // model never makes that move: a size-alone change to a signature the file has had becomes a change of the time as well.
      const had = new Map<string, Set<string>>();
      const signatureOf = (file: FakeFile): string => `${file.mtimeMs}:${file.size ?? file.content.length}`;
      const put = (name: string, file: FakeFile): void => {
        fs.set(name, file);
        had.set(name, (had.get(name) ?? new Set<string>()).add(signatureOf(file)));
      };
      for (const name of names) if (next() < 0.8) put(name, { content: makeContent(), mtimeMs: clock++ });
      const cache = createCitationCache(fs);
      for (let ask = 0; ask < 12; ask++) {
        // between asks: some files change (the time moves, the size moves, or both: never neither), vanish, appear or stay
        for (const name of names) {
          const roll = next();
          const current = fs.files.get(at(name));
          if (roll < 0.25 && current !== undefined) {
            const content = makeContent();
            const how = next();
            const previousSize = current.size ?? current.content.length;
            const sameSize = how < 0.33; // the time alone moves
            const sameTime = how >= 0.33 && how < 0.66 && content.length !== previousSize && !(had.get(name)?.has(`${current.mtimeMs}:${content.length}`) ?? false); // the size alone moves, to a size not had under this time
            put(name, { content, mtimeMs: sameTime ? current.mtimeMs : clock++, size: sameSize ? previousSize : undefined });
            moves++;
          } else if (roll < 0.32) fs.set(name, undefined);
          else if (roll < 0.4 && current === undefined) put(name, { content: makeContent(), mtimeMs: clock++ });
        }
        const declared = Array.from({ length: Math.floor(next() * 5) }, () => pickOf(names));
        const before = fs.reads();
        const got = await cache.read(declared, DIR);
        if (fs.reads() === before && declared.some((rel) => fs.files.has(at(rel)))) hits++;
        const expected = await readCitations(declared, DIR, fs.readFile);
        if (JSON.stringify(got) !== JSON.stringify(expected)) disagreements.push(`history ${history} ask ${ask}: ${declared.join(",")}`);
      }
    }
    expect(disagreements).toEqual([]);
    // the sample is what the title says: files really changed, and many asks were answered with no read at all
    expect(moves).toBeGreaterThan(2000);
    expect(hits).toBeGreaterThan(400);
  }, 60_000);
});

describe("Session 343 -- what a caller can do to the answer", () => {
  it("pushing to, sorting or emptying the list handed back changes nothing of the next ask's", async () => {
    const fs = fakeFs(FILES);
    const cache = createCitationCache(fs);
    const first = await cache.read(["a.bib", "b.json"], DIR);
    first.push({ key: "zzz" });
    first.reverse();
    first.length = 0;
    expect((await cache.read(["a.bib", "b.json"], DIR)).map((c) => c.key)).toEqual(["a1", "a2", "shared", "b1", "b2"]);
  });

  it("the citations handed back are FROZEN, so a caller that edits one throws instead of corrupting the entry the next ask is served from", async () => {
    const fs = fakeFs(FILES);
    const cache = createCitationCache(fs);
    const first = await cache.read(["a.bib"], DIR);
    expect(first.every((c) => Object.isFrozen(c))).toBe(true);
    expect(() => {
      first[0].title = "edited";
    }).toThrow(TypeError);
    expect((await cache.read(["a.bib"], DIR))[0].title).toBe("A one");
  });

  it("two asks that overlap (nothing awaited between them) both answer right, and the third finds one entry", async () => {
    const fs = fakeFs(FILES);
    const cache = createCitationCache(fs);
    const [one, two] = await Promise.all([cache.read(["a.bib", "b.json"], DIR), cache.read(["b.json", "a.bib"], DIR)]);
    expect(one).toEqual(await readCitations(["a.bib", "b.json"], DIR, fs.readFile));
    expect(two).toEqual(await readCitations(["b.json", "a.bib"], DIR, fs.readFile));
    const before = fs.reads();
    await cache.read(["a.bib", "b.json"], DIR);
    expect(fs.reads()).toBe(before);
  });
});

describe("Session 343 -- a bibliography past the stack's reach (the Session 338 spread) goes through the cache whole, at the first ask and at the second", () => {
  it("120,000 entries (a bare spread throws from 110,428): all are listed, first, middle and last in place", async () => {
    const entries = Array.from({ length: 120_000 }, (_, i): [string, string] => [`key${i}`, `t${i}`]);
    const fs = fakeFs({ "big.bib": { content: bibtex(entries), mtimeMs: 1 } });
    const cache = createCitationCache(fs);
    for (let ask = 0; ask < 2; ask++) {
      const got = await cache.read(["big.bib"], DIR);
      expect(got).toHaveLength(120_000);
      expect([got[0].key, got[60_000].key, got[119_999].key]).toEqual(["key0", "key60000", "key119999"]);
    }
    expect(fs.reads()).toBe(1);
  }, 60_000);
});
