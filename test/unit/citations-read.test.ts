import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { readCitations } from "../../src/core/citations";

// The review of Session 338 (the BACKLOG item "Eleven more places that throw `RangeError` on a long line or a long list", site 8). The accumulation of the citations of every declared bibliography lived in
// `loadCitations` of `src/providers/citation.ts`, which imports `vscode` and so could not be run by a unit test: the review applied six behaviour mutants to it (empty the list after each file, read only the first
// file, never read, keep the duplicates, reverse the files before de-duplicating, resolve against the working directory) and the only thing that noticed any of them was a gate that READ THE SOURCE TEXT of the
// adapter. The loop now lives in `core/citations.ts` as `readCitations`, with the file reader handed in, and these rows run it with a reader of their own.

const bib = (...keys: string[]): string => keys.map((k) => `@article{${k},\n  title = {Title ${k}},\n  author = {Doe, Jane},\n  year = {2001}\n}`).join("\n");

/** A reader over a map of absolute path to text that records every path asked for; a path not in the map is a missing file. */
function reader(files: Record<string, string>): { read: (p: string) => Promise<string>; asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    read: async (p: string) => {
      asked.push(p);
      if (!(p in files)) {
        throw new Error(`ENOENT: ${p}`);
      }
      return files[p];
    },
  };
}

const DIR = path.resolve("/project/docs");
const at = (...parts: string[]): string => path.resolve(DIR, ...parts);

describe("readCitations — the citations of every bibliography a document declares", () => {
  it("one file: its citations, in file order", async () => {
    const { read } = reader({ [at("refs.bib")]: bib("a", "b", "c") });
    expect((await readCitations(["refs.bib"], DIR, read)).map((c) => c.key)).toEqual(["a", "b", "c"]);
  });

  it("every declared file is read, in the order declared, and none is read twice", async () => {
    const { read, asked } = reader({ [at("one.bib")]: bib("a"), [at("two.bib")]: bib("b"), [at("three.bib")]: bib("c") });
    expect((await readCitations(["one.bib", "two.bib", "three.bib"], DIR, read)).map((c) => c.key)).toEqual(["a", "b", "c"]);
    expect(asked).toEqual([at("one.bib"), at("two.bib"), at("three.bib")]);
  });

  it("a path is resolved against the document's own directory, a parent directory included", async () => {
    const { read, asked } = reader({ [at("refs.bib")]: bib("a"), [path.resolve("/project/shared/more.bib")]: bib("b") });
    expect((await readCitations(["refs.bib", "../shared/more.bib"], DIR, read)).map((c) => c.key)).toEqual(["a", "b"]);
    expect(asked).toEqual([path.resolve("/project/docs/refs.bib"), path.resolve("/project/shared/more.bib")]);
  });

  it("the citations of an earlier file are not lost when a later file is read (the list is not reset, nor swapped for the last file's)", async () => {
    const { read } = reader({ [at("one.bib")]: bib("a", "b"), [at("two.bib")]: bib("c") });
    expect((await readCitations(["one.bib", "two.bib"], DIR, read)).map((c) => c.key)).toEqual(["a", "b", "c"]);
  });

  it("a key declared twice keeps its FIRST citation, in the file that comes first, whatever the order of the files", async () => {
    const files = {
      [at("one.bib")]: "@article{dup,\n  title = {From one},\n  year = {2001}\n}",
      [at("two.bib")]: "@article{dup,\n  title = {From two},\n  year = {2002}\n}\n@article{other,\n  title = {Other}\n}",
    };
    const forward = await readCitations(["one.bib", "two.bib"], DIR, reader(files).read);
    expect(forward.map((c) => [c.key, c.title])).toEqual([["dup", "From one"], ["other", "Other"]]);
    const backward = await readCitations(["two.bib", "one.bib"], DIR, reader(files).read);
    expect(backward.map((c) => [c.key, c.title])).toEqual([["dup", "From two"], ["other", "Other"]]);
  });

  it("a key repeated inside one file is listed once", async () => {
    const { read } = reader({ [at("refs.bib")]: bib("a", "a", "b") });
    expect((await readCitations(["refs.bib"], DIR, read)).map((c) => c.key)).toEqual(["a", "b"]);
  });

  it("a file that cannot be read is skipped and the others are still offered (a broken bibliography must never break completion)", async () => {
    const { read, asked } = reader({ [at("one.bib")]: bib("a"), [at("three.bib")]: bib("c") });
    expect((await readCitations(["one.bib", "missing.bib", "three.bib"], DIR, read)).map((c) => c.key)).toEqual(["a", "c"]);
    expect(asked).toEqual([at("one.bib"), at("missing.bib"), at("three.bib")]);
  });

  it("no declared file: nothing is read and nothing is offered", async () => {
    const { read, asked } = reader({});
    expect(await readCitations([], DIR, read)).toEqual([]);
    expect(asked).toEqual([]);
  });

  it("the citation carries what the parser read: key, title, author and year", async () => {
    const { read } = reader({ [at("refs.bib")]: bib("a") });
    expect(await readCitations(["refs.bib"], DIR, read)).toEqual([{ key: "a", title: "Title a", author: "Doe, Jane", year: "2001" }]);
  });
});

describe("readCitations — a bibliography longer than the stack holds a spread of", () => {
  // `all.push(...parseCitations(content))` threw `RangeError` from about 110,000 entries and the adapter's empty `catch` swallowed it, so the file added no citation at all.
  it("250,000 entries in one file and 3 in another: every key is offered once, in order", async () => {
    const count = 250_000;
    const parts: string[] = new Array(count);
    for (let i = 0; i < count; i++) {
      parts[i] = `@article{k${i},\n  title = {T${i}}\n}`;
    }
    const { read } = reader({ [at("big.bib")]: parts.join("\n"), [at("small.bib")]: bib("x", "y", "k0") });
    const all = await readCitations(["big.bib", "small.bib"], DIR, read);
    expect(all).toHaveLength(count + 2);
    expect(all[0].key).toBe("k0");
    expect(all[count - 1].key).toBe(`k${count - 1}`);
    expect(all.slice(count).map((c) => c.key)).toEqual(["x", "y"]);
  }, 60_000);
});
