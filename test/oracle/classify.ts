/**
 * The oracle's pure decision logic — no I/O, no quarto, no filesystem.
 *
 * Everything here is a function of text and booleans so it can be pinned headlessly by
 * `test/unit/oracle-classify.test.ts` in the default `npm test` run, while the parts that
 * actually shell out to `quarto` stay in the opt-in driver.
 */

/** One completed `quarto render --no-execute` invocation. */
export interface QuartoRun {
  code: number;
  stdout: string;
  stderr: string;
}

/** What that run tells us — and, crucially, what it does NOT tell us. */
export interface QuartoVerdict {
  code: number;
  /** Quarto rejected a VALUE: its own validation text says so. The only evidence that counts. */
  rejects: boolean;
  /** The matched validation line, truncated — kept so a surprising row can be read, not guessed at. */
  why: string;
  /** A nonzero exit carrying no validation text: quarto failed for some OTHER reason. */
  unrelated: boolean;
}

/**
 * Quarto injects SGR colour codes INSIDE its messages, not merely around them — the real
 * 1.7.33 output reads `Field "<ESC>[34mcache<ESC>[39m" has value ...`, so a matcher that
 * does not strip first never sees `Field "cache"` (S163 gotcha, re-grounded S166).
 */
const ANSI = /\x1b\[[0-9;]*m/g;

/** Lines that constitute quarto's own YAML VALUE rejection — the only evidence that counts. */
const VALIDATION_TEXT = /Field "|must instead be|Validation of YAML/;

/**
 * How one document scored. Deliberately NOT a symmetric "match/mismatch": flagging a
 * document quarto accepts is the cardinal sin, staying silent where it rejects is safe,
 * and a row quarto never finished judging is worth nothing at all.
 */
export type RowClass = "agree" | "cardinal-fp" | "lost-tp" | "unrelated";

export function classifyRow(
  weFlag: boolean,
  verdict: Pick<QuartoVerdict, "rejects" | "unrelated">,
): RowClass {
  if (verdict.unrelated) {
    return "unrelated"; // quarto never got far enough to have an opinion — score nothing
  }
  if (weFlag) {
    return verdict.rejects ? "agree" : "cardinal-fp";
  }
  return verdict.rejects ? "lost-tp" : "agree";
}

/**
 * Baseline rows recorded as WRONG that carry no written reason.
 *
 * The failure this guards against is procedural, not technical: when the oracle fails, the
 * cheapest way to make it pass is to re-seed the baseline, which turns a newly introduced
 * cardinal false positive into an "expected" one with nobody having decided that. Requiring
 * a reason for every non-agreeing row makes that a deliberate, reviewable edit. A lost true
 * positive needs one too — safe is not the same as free, and the trade belongs in writing.
 */
export function unexplainedRows(
  rows: Record<string, RowClass>,
  known: Record<string, string>,
): string[] {
  return Object.entries(rows)
    .filter(([, cls]) => cls === "cardinal-fp" || cls === "lost-tp")
    .filter(([name]) => (known[name] ?? "").trim().length === 0)
    .map(([name]) => name);
}

/** The result of replaying two builds over the SAME corpus. */
export interface Comparison {
  /** Rows that got better, named. */
  improved: string[];
  /** Rows that got worse, NAMED — a count alone is what let S165 believe "0 regressed". */
  regressed: string[];
  /** Rows whose class did not move. */
  unchanged: number;
  /** Rows quarto failed on unrelatedly in either build — no information, so not scored. */
  skipped: string[];
  /** Rows present in only ONE build. Surfaced rather than dropped: a silently omitted row
   *  reads as "0 regressed" while nothing actually examined it. */
  incomparable: string[];
}

/**
 * Score `after` against `before` over the rows they share.
 *
 * For a fixed document quarto's verdict is fixed, so a row can only ever move between the
 * two classes that verdict permits: `cardinal-fp` <-> `agree` when quarto accepts, and
 * `lost-tp` <-> `agree` when it rejects. Any move toward `agree` is an improvement; any
 * move away from it is a regression.
 */
export function compareRuns(
  before: Record<string, RowClass>,
  after: Record<string, RowClass>,
): Comparison {
  const improved: string[] = [];
  const regressed: string[] = [];
  const skipped: string[] = [];
  const incomparable: string[] = [];
  let unchanged = 0;
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const name of names) {
    const a = before[name];
    const b = after[name];
    if (a === undefined || b === undefined) {
      incomparable.push(name);
      continue;
    }
    if (a === "unrelated" || b === "unrelated") {
      skipped.push(name);
      continue;
    }
    if (a === b) {
      unchanged++;
    } else if (b === "agree") {
      improved.push(name);
    } else {
      regressed.push(name);
    }
  }
  return { improved, regressed, unchanged, skipped, incomparable };
}

export function verdictOf(run: QuartoRun): QuartoVerdict {
  const lines = `${run.stdout}\n${run.stderr}`
    .replace(ANSI, "")
    .split("\n")
    .map((l) => l.trim());
  const matching = lines.filter((l) => VALIDATION_TEXT.test(l));
  // Prefer the line that NAMES the key and value over the generic banner, so a surprising
  // row can be read straight from the report instead of re-derived by hand.
  const detail = matching.find((l) => l.includes('Field "')) ?? matching[0] ?? "";
  const rejects = matching.length > 0;
  return {
    code: run.code,
    rejects,
    why: detail.slice(0, 160),
    unrelated: run.code !== 0 && !rejects,
  };
}
