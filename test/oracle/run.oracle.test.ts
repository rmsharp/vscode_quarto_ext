import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyRow,
  compareRuns,
  unexplainedRows,
  verdictOf,
  type QuartoVerdict,
  type RowClass,
} from "./classify";
import { CORPUS, entryOf, entryTextOf, type OracleCase } from "./corpus";
import { cellOptionFlags } from "./flags";
import { DEFAULT_SRC, loadCoreApi, loadSchemaIndex, quartoVersion } from "./load";

/**
 * THE END-TO-END ORACLE. Opt-in: `npm run test:oracle`.
 *
 * It renders every corpus document with the real `quarto` CLI, so it is excluded from the
 * default `npm test` run by living outside `test/unit/`. The pure logic it composes is
 * pinned headlessly in `test/unit/oracle-*.test.ts` and DOES run by default.
 *
 * What it asserts: no row may become a CARDINAL FALSE POSITIVE that the committed baseline
 * does not already record. Improvements are reported and are not failures — but they are
 * not silently absorbed either, because the baseline is meant to be updated deliberately.
 */

const BASELINE_FILE = path.resolve(process.cwd(), "test/oracle/baseline.json");
const CACHE_FILE = path.resolve(process.cwd(), "test/oracle/.quarto-cache.json");

interface Baseline {
  quarto: string;
  build?: string;
  note: string;
  /** Why each non-agreeing row is accepted, and where it is filed. Enforced, not decorative. */
  known?: Record<string, string>;
  rows: Record<string, RowClass>;
}

type Cache = Record<string, QuartoVerdict>;

const cache: Cache = fs.existsSync(CACHE_FILE)
  ? (JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) as Cache)
  : {};

/**
 * Render one case with the real CLI and read its verdict from the error TEXT.
 *
 * The retry is the point: a nonzero exit carrying no validation text is quarto failing for
 * an unrelated reason — a crash, a missing kernel, a flaky run — and S165 lost a true
 * positive to a transient SIGSEGV that its first pass scored as a rejection. One retry,
 * then the row is reported UNRELATED and excluded from scoring rather than guessed at.
 */
function renderVerdict(c: OracleCase, quarto: string): QuartoVerdict {
  const key = JSON.stringify({ quarto, files: c.files, entry: entryOf(c) });
  const hit = cache[key];
  if (hit !== undefined) {
    return hit;
  }
  const attempt = (): QuartoVerdict => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qmd-oracle-"));
    try {
      for (const [rel, content] of Object.entries(c.files)) {
        const full = path.join(dir, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content);
      }
      try {
        execFileSync("quarto", ["render", entryOf(c), "--no-execute"], {
          cwd: dir,
          stdio: ["ignore", "pipe", "pipe"],
        });
        return verdictOf({ code: 0, stdout: "", stderr: "" });
      } catch (e) {
        const err = e as { status?: number; stdout?: Buffer; stderr?: Buffer };
        return verdictOf({
          code: err.status ?? -1,
          stdout: String(err.stdout ?? ""),
          stderr: String(err.stderr ?? ""),
        });
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
  let v = attempt();
  if (v.unrelated) {
    v = attempt();
  }
  cache[key] = v;
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1));
  return v;
}

describe("end-to-end oracle — our flag decision vs a real `quarto render`", () => {
  it(
    "introduces no cardinal false positive the baseline does not already record",
    async () => {
      const quarto = quartoVersion();
      const api = await loadCoreApi(DEFAULT_SRC);
      const index = await loadSchemaIndex(DEFAULT_SRC);

      const actual: Record<string, RowClass> = {};
      const detail: string[] = [];
      for (const c of CORPUS) {
        const text = entryTextOf(c);
        if (text === undefined) {
          throw new Error(`corpus case "${c.name}" names an entry it does not carry`);
        }
        const flags = cellOptionFlags(text, entryOf(c), api, index);
        const verdict = renderVerdict(c, quarto);
        const row = classifyRow(flags.length > 0, verdict);
        actual[c.name] = row;
        detail.push(
          `${row.padEnd(12)} exit ${String(verdict.code).padEnd(3)} ours [${flags.join(" ")}] — ${c.name}` +
            (verdict.unrelated ? `\n             why: ${verdict.why || "(no validation text)"}` : ""),
        );
      }

      const tally = (k: RowClass) => Object.values(actual).filter((v) => v === k).length;
      console.log(
        [
          `\nBUILD    ${DEFAULT_SRC}`,
          `QUARTO   ${quarto}`,
          ...detail,
          `\n${CORPUS.length} documents: ${tally("agree")} agree, ${tally("lost-tp")} lost TP, ` +
            `${tally("cardinal-fp")} CARDINAL FP, ${tally("unrelated")} unrelated`,
        ].join("\n"),
      );

      if (!fs.existsSync(BASELINE_FILE)) {
        // Bootstrap: record what this build does so later runs have something to regress
        // against. Deliberately still fails, so a missing baseline can never read as a pass.
        const seed: Baseline = {
          quarto,
          note: "Seeded on first run. Review every cardinal-fp row before trusting this file.",
          rows: actual,
        };
        fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(seed, null, 2)}\n`);
        throw new Error(`no baseline existed; seeded ${BASELINE_FILE} — review it, then re-run`);
      }

      const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8")) as Baseline;
      const c = compareRuns(baseline.rows, actual);
      if (c.improved.length > 0) {
        console.log(`\nIMPROVED (${c.improved.length}):\n  ${c.improved.join("\n  ")}`);
      }
      if (c.skipped.length > 0) {
        console.log(`\nSKIPPED — unrelated quarto failure (${c.skipped.length}):\n  ${c.skipped.join("\n  ")}`);
      }
      if (c.regressed.length > 0) {
        console.log(`\n** REGRESSED (${c.regressed.length}):\n  ${c.regressed.join("\n  ")}`);
      }

      // Every row the BASELINE records as wrong must carry a written reason. Re-seeding
      // the file is the cheapest way to make a failing oracle pass, and this is what stops
      // that from quietly promoting a new defect to "expected".
      expect(unexplainedRows(baseline.rows, baseline.known ?? {})).toEqual([]);
      // A row the baseline and this run do not share is NOT quietly dropped: that is the
      // silent omission which lets a report read "0 regressed" while nothing examined it.
      expect(c.incomparable).toEqual([]);
      expect(c.regressed).toEqual([]);
      if (baseline.quarto !== quarto) {
        console.log(
          `\nNOTE: baseline was measured against quarto ${baseline.quarto}, this run used ${quarto}.`,
        );
      }
    },
    { timeout: 30 * 60 * 1000 },
  );
});
