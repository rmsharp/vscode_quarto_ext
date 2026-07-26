import { describe, expect, it } from "vitest";
import { CORPUS, entryTextOf } from "../oracle/corpus";
import { DEFAULT_SRC, loadCoreApi } from "../oracle/load";

/**
 * Structural pins on the corpus itself.
 *
 * The oracle keys every result — dumps, baselines, build-to-build comparison — by a case's
 * NAME. A duplicate name therefore does not produce a duplicate row; it silently
 * overwrites one, and the run reports a smaller corpus than it claims to have measured.
 * That is the same class of failure as S165's "0 regressed" over a corpus that was missing
 * the twelve rows that regressed: not a wrong answer, an unasked question.
 */
describe("CORPUS — structural invariants the reporting depends on", () => {
  it("carries the documents S165 measured", () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(60);
  });

  it("has no duplicate case name", () => {
    const seen = new Map<string, number>();
    for (const c of CORPUS) {
      seen.set(c.name, (seen.get(c.name) ?? 0) + 1);
    }
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([name]) => name);
    expect(dupes).toEqual([]);
  });

  it("every case's entry file exists in its own file map", () => {
    // A mistyped entry makes `files[entry]` undefined, which either throws inside the
    // mirror or — worse — is read as an empty document that flags nothing and scores
    // "agree" forever.
    const broken = CORPUS.filter((c) => entryTextOf(c) === undefined).map((c) => c.name);
    expect(broken).toEqual([]);
  });
});

describe("loadCoreApi — the build under test is a parameter, not a constant", () => {
  it("loads every core function the mirror calls from the repo's own src", async () => {
    const api = await loadCoreApi(DEFAULT_SRC);
    const missing = Object.entries(api)
      .filter(([, v]) => typeof v !== "function")
      .map(([k]) => k);
    expect(missing).toEqual([]);
  });
});
