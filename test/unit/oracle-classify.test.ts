import { describe, expect, it } from "vitest";
import { classifyRow, compareRuns, verdictOf } from "../oracle/classify";

/**
 * The oracle's central lesson, pinned: AN EXIT CODE IS NOT A MEASUREMENT.
 *
 * S164 wrote a `{dot}` probe whose body was `1 + 1`, read its exit 1 as a structural
 * chunk-option rejection, and put the misreading into a docstring as fact; it was a
 * Graphviz syntax error. S165's oracle counted a transient exit 139 (SIGSEGV) as a lost
 * true positive. Both are the same defect: treating "quarto failed" as "quarto rejected
 * this value". The only evidence that quarto rejected a VALUE is quarto's own validation
 * text, so that — not the exit code — is what decides `rejects`.
 */
describe("verdictOf — a quarto run's verdict comes from its error TEXT", () => {
  it("a clean exit 0 is not a rejection", () => {
    const v = verdictOf({ code: 0, stdout: "pandoc \n  to: html\n", stderr: "" });
    expect(v.rejects).toBe(false);
    expect(v.unrelated).toBe(false);
  });

  it("reads a real rejection whose ANSI codes sit INSIDE the message", () => {
    // Captured verbatim from `quarto render doc.qmd --no-execute` against 1.7.33 on an
    // `{r}` cell carrying `#| cache: banana`. Note where the escapes fall: `Field "` and
    // the key are separated by one, so a matcher that does not strip ANSI first sees
    // `Field "<ESC>[34mcache` and never matches. Everything lands on stderr, not stdout.
    const v = verdictOf({
      code: 1,
      stdout: "",
      stderr:
        "\x1b[91mERROR: Validation of YAML cell metadata failed.\x1b[39m\n" +
        "ERROR: In file doc.qmd\n" +
        '(line 6, columns 11--17) Field "\x1b[34mcache\x1b[39m" has value \x1b[34mbanana\x1b[39m,' +
        " which must instead be `true` or `false`\n" +
        "\x1b[91mERROR: Render failed due to invalid YAML.\x1b[39m\n",
    });
    expect(v.rejects).toBe(true);
    expect(v.unrelated).toBe(false);
    // `why` names the offending key and value, so a surprising row can be read rather
    // than re-derived — the generic "Validation ... failed" banner would not.
    expect(v.why).toContain('Field "cache" has value banana');
  });

  it("a nonzero exit carrying NO validation text is UNRELATED, never a rejection", () => {
    // Captured verbatim from `quarto render ok.qmd --to banana` against 1.7.33: a real
    // exit 1 from a completely different rejection layer (format resolution), with a
    // stack trace and no validation text. Counting this as "quarto rejected the value"
    // is precisely the defect that made S164 write a Graphviz syntax error into a
    // docstring as fact, and made S165's oracle score a transient SIGSEGV as a lost
    // true positive. It must be reported as unrelated so the row is re-run, not scored.
    const v = verdictOf({
      code: 1,
      stdout: "",
      stderr:
        "\x1b[91mERROR: Unknown format banana\n\nStack trace:\n" +
        "    at resolveFormats (file:///Applications/quarto/bin/quarto.js:81801:19)\n" +
        "    at eventLoopTick (ext:core/01_core.js:175:7)\n",
    });
    expect(v.rejects).toBe(false);
    expect(v.unrelated).toBe(true);
  });

  it("counts the directory-metadata spelling, which never says 'Field'", () => {
    // `_metadata.yml` rejections read `... has value banana, which must instead be 'ansi'`
    // with no `Field "` prefix, so keying only on `Field "` would score them as silence.
    const v = verdictOf({
      code: 1,
      stdout: "",
      stderr: "ERROR: Directory metadata validation failed: has value banana, which must instead be 'ansi'\n",
    });
    expect(v.rejects).toBe(true);
    expect(v.unrelated).toBe(false);
  });
});

/**
 * The asymmetry that IS this project's doctrine, pinned as a truth table.
 *
 * Flagging a document `quarto render` accepts is the CARDINAL SIN — the user sees a
 * squiggle on correct work. Staying silent where quarto rejects is a lost true positive:
 * regrettable, but safe. The oracle exists to count the first and name the second, so the
 * two must never collapse into a single "mismatch" bucket.
 */
describe("classifyRow — the four outcomes, and why they are not symmetric", () => {
  const rejecting = { rejects: true, unrelated: false };
  const accepting = { rejects: false, unrelated: false };
  const broken = { rejects: false, unrelated: true };

  it("we flag and quarto accepts — the CARDINAL false positive", () => {
    expect(classifyRow(true, accepting)).toBe("cardinal-fp");
  });

  it("we are silent and quarto rejects — a lost true positive (safe)", () => {
    expect(classifyRow(false, rejecting)).toBe("lost-tp");
  });

  it("we flag and quarto rejects — agreement", () => {
    expect(classifyRow(true, rejecting)).toBe("agree");
  });

  it("we are silent and quarto accepts — agreement", () => {
    expect(classifyRow(false, accepting)).toBe("agree");
  });

  it("an unrelated quarto failure is scored as NEITHER, whatever we said", () => {
    // The row carries no information about our correctness: quarto never got far enough
    // to have an opinion. Scoring it either way manufactures a result from a crash.
    expect(classifyRow(true, broken)).toBe("unrelated");
    expect(classifyRow(false, broken)).toBe("unrelated");
  });
});

/**
 * The comparison that turns a claim into a number.
 *
 * S165 shipped a change believing it safe, and only replaying the PREVIOUS build over the
 * same corpus revealed twelve regressions. Its own smaller corpus had reported "0
 * regressed" — a property of the sample, not of the change. So this comparison must name
 * every regressed row rather than counting them, and must refuse to score a row it cannot
 * actually compare instead of silently treating it as unchanged.
 */
describe("compareRuns — improved, regressed, and what it refuses to score", () => {
  it("a cardinal false positive that became agreement is an improvement", () => {
    const c = compareRuns({ a: "cardinal-fp" }, { a: "agree" });
    expect(c.improved).toEqual(["a"]);
    expect(c.regressed).toEqual([]);
  });

  it("agreement that became a cardinal false positive is a REGRESSION, named", () => {
    const c = compareRuns({ a: "agree" }, { a: "cardinal-fp" });
    expect(c.regressed).toEqual(["a"]);
    expect(c.improved).toEqual([]);
  });

  it("a recovered lost true positive is an improvement; a newly lost one is a regression", () => {
    expect(compareRuns({ a: "lost-tp" }, { a: "agree" }).improved).toEqual(["a"]);
    expect(compareRuns({ a: "agree" }, { a: "lost-tp" }).regressed).toEqual(["a"]);
  });

  it("an unchanged row is counted, not named", () => {
    const c = compareRuns({ a: "agree", b: "cardinal-fp" }, { a: "agree", b: "cardinal-fp" });
    expect(c.unchanged).toBe(2);
    expect(c.improved).toEqual([]);
    expect(c.regressed).toEqual([]);
  });

  it("a row that is UNRELATED in either build is skipped, never scored", () => {
    const c = compareRuns({ a: "unrelated" }, { a: "cardinal-fp" });
    expect(c.skipped).toEqual(["a"]);
    expect(c.regressed).toEqual([]);
    expect(c.improved).toEqual([]);
  });

  it("a row missing from either build is reported as incomparable, NOT as unchanged", () => {
    // The silent-omission failure in its cheapest form: if one build lacks a row and the
    // comparison quietly drops it, the report reads "0 regressed" while a row went
    // unexamined. That is the shape of the mistake S165 made at corpus scale.
    const c = compareRuns({ a: "agree", gone: "agree" }, { a: "agree", added: "agree" });
    expect(c.incomparable.sort()).toEqual(["added", "gone"]);
    expect(c.unchanged).toBe(1);
  });
});
