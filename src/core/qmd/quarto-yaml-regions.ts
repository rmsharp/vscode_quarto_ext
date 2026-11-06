/**
 * The line spans quarto's VALIDATION partitioner reads as YAML — and therefore
 * does not read as cells.
 *
 * A deliberate mirror of `breakQuartoMd`'s own state machine, read out of the
 * installed quarto 1.7.33 (`/Applications/quarto/bin/quarto.js`). See
 * `test/unit/quarto-yaml-regions.test.ts` for the measured behaviour each rule
 * reproduces.
 */

/** One YAML region: the delimiter lines and everything between them, inclusive. */
export interface YamlRegion {
  /** 0-based line of the `---` that opened the region. */
  readonly startLine: number;
  /** 0-based line of the closing `---`, or the document's last line if it never closes. */
  readonly endLine: number;
  /**
   * Whether the region actually CLOSED on a delimiter, as against running out of document.
   *
   * ⚠ The two are not interchangeable for a consumer that reads the region's CONTENT. Quarto
   * honours a `from:` in a terminated mid-document block and ignores one in an unterminated
   * block — measured over `scratchpad/s211/cal` (`c01_mid_gfm` selects; `c06_unterm_gfm`,
   * `q2_unterm_swallow` do not). Additive in Session 211: the original
   * consumer (`core/yaml-value-flags.ts`) reads only the two line numbers.
   */
  readonly terminated: boolean;
}

/**
 * Quarto's `yamlRegEx`, verbatim: three dashes at COLUMN 0, then only whitespace.
 * Anchored at the line start with no leading-whitespace allowance, which is the
 * whole reason an indented `---` opens nothing.
 */
const YAML_DELIMITER = /^---\s*$/;

/**
 * Quarto's `isYamlDelimiter`, including its `skipHRs` arm: a `---` with a BLANK
 * line both above and below is a thematic break, not a delimiter.
 *
 * `breakQuartoMd` passes `skipHRs = !inYaml`, so the exemption applies only when a
 * region would OPEN — a blank-surrounded `---` still CLOSES an open one. The
 * first and last lines of the document are never exempt (`index > 0` and
 * `index < length - 1` in quarto's own guard), which is why front matter at line 0
 * opens normally even when line 1 is blank.
 */
function isYamlDelimiter(lines: readonly string[], index: number, skipHRs: boolean): boolean {
  if (!YAML_DELIMITER.test(lines[index])) {
    return false;
  }
  return !(
    skipHRs &&
    index > 0 &&
    lines[index - 1].trim() === "" &&
    index < lines.length - 1 &&
    lines[index + 1].trim() === ""
  );
}

/**
 * Quarto's three fence recognizers, verbatim. They are NOT our `FENCE_OPEN`
 * (`qmd/model.ts`), and the differences are load-bearing rather than incidental:
 * the executable-cell opener tolerates leading whitespace while the PLAIN opener
 * is anchored at column 0, and the closer tolerates leading whitespace again.
 *
 * ⚠ The option tail is `([ ,].*)?`, quarto's `( *[ ,].*)?` with the leading ` *` dropped (Session 313):
 * both accept exactly the strings that start with a space or a comma, and the ` *` is what made a long run of
 * spaces quadratic (each retry gives back one space and `.*` re-reads the rest). Only group 1, the backtick run, is read.
 */
const START_CODE_CELL = /^\s*(```+)\s*\{([=A-Za-z]+)([ ,].*)?\}\s*$/;
const START_CODE = /^```/;
const END_CODE = /^\s*(```+)\s*$/;

/**
 * Quarto's `tickCount`: backticks in the line's FIRST space-delimited token, which
 * is how a plain opener records the run length its closer must match.
 */
function tickCount(line: string): number {
  return Array.from(line.split(" ")[0] ?? "").filter((c) => c === "`").length;
}

/** The YAML regions of `text`, in document order. */
export function quartoYamlRegions(text: string): YamlRegion[] {
  const lines = text.split(/\r?\n/);
  const regions: YamlRegion[] = [];
  let openLine: number | null = null;
  // Quarto's own two fence counters. `inCode` is the backtick run length of the open
  // fence (0 when none); `inCodeCell` additionally marks it as an executable cell.
  let inCode = 0;
  let inCodeCell = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const inYaml = openLine !== null;
    // The branch ORDER is quarto's and is not interchangeable: the delimiter test runs
    // first and wins, so a `---` outside any fence toggles the region before any fence
    // recognizer can look at it.
    const endMatch = END_CODE.exec(line);
    if (isYamlDelimiter(lines, i, !inYaml) && !inCodeCell && inCode === 0) {
      if (openLine === null) {
        openLine = i;
      } else {
        regions.push({ startLine: openLine, endLine: i, terminated: true });
        openLine = null;
      }
      continue;
    }
    const cellMatch = START_CODE_CELL.exec(line);
    if (cellMatch !== null && !inCodeCell && inCode === 0 && !inYaml) {
      inCodeCell = true;
      inCode = cellMatch[1].length;
    } else if (endMatch !== null && inCode !== 0 && endMatch[1].length === inCode) {
      inCodeCell = false;
      inCode = 0;
    } else if (START_CODE.test(line) && inCode === 0) {
      // A plain fence — and, when a region is already open, an executable-cell fence
      // too: quarto's cell branch requires `inPlainText()`, so inside YAML the cell
      // opener falls through to here and is tracked as an ordinary code fence.
      inCode = tickCount(line);
    }
  }
  if (openLine !== null) {
    // An unclosed region runs to the end of the document — quarto's `inYaml` is
    // never turned off again, so everything below is swallowed.
    regions.push({ startLine: openLine, endLine: lines.length - 1, terminated: false });
  }
  return regions;
}

/** Whether 0-based `line` falls inside any region (delimiter lines included). */
export function inQuartoYamlRegion(regions: readonly YamlRegion[], line: number): boolean {
  return regions.some((r) => line >= r.startLine && line <= r.endLine);
}

/**
 * An array is ORDERED when every region has `startLine <= endLine` and every region after the first starts STRICTLY after the one before it ends. `quartoYamlRegions` returns one every time (it pushes a region at the
 * line that closes it and opens the next one on a later line). A NaN bound fails both comparisons, so such an array is not ordered.
 */
function isOrdered(regions: readonly YamlRegion[]): boolean {
  let previousEnd = NaN;
  for (let i = 0; i < regions.length; i++) {
    const { startLine, endLine } = regions[i];
    if (!(startLine <= endLine) || (i > 0 && !(previousEnd < startLine))) {
      return false;
    }
    previousEnd = endLine;
  }
  return true;
}

/**
 * `inQuartoYamlRegion(regions, line)` for ONE array asked MANY times: make the lookup once, ask it for each line.
 *
 * `collectValueSources` asks once per cell option line, and `inQuartoYamlRegion` is a pass over every region, so the enumeration cost regions times option lines (64,000 pairs of a `---` region and a cell with an
 * option line took 4.2 s, 2.9 to 4.0 s of it this filter). The answer is exactly `inQuartoYamlRegion`'s, for every array and every line:
 *   - an ORDERED array (see `isOrdered`, checked ONCE here) is answered by a binary search for the last region whose start is at or below the line: in an ordered array the regions that start at or below a line are a
 *     prefix of it, every one of them but the last ends before the next one starts, so only the last of them can hold the line, and it holds it when the line is at or below its end. A line that is NaN is at or above no start,
 *     so nothing is found and the answer is false, as `some` finds no region that holds it.
 *   - any other array (unsorted, overlapping, nested, a start after its end, a NaN bound) is answered by `inQuartoYamlRegion` itself, a pass over every region: slower, and the oracle's answer by construction.
 * The array must not change while the lookup is in use (the parameter is `readonly`), and its elements are regions: `quartoYamlRegions`'s output is the one caller's array.
 */
export function createYamlRegionLookup(regions: readonly YamlRegion[]): (line: number) => boolean {
  if (!isOrdered(regions)) {
    return (line) => inQuartoYamlRegion(regions, line);
  }
  return (line) => {
    let low = 0;
    let high = regions.length - 1;
    let found = -1;
    while (low <= high) {
      const middle = low + ((high - low) >> 1);
      if (regions[middle].startLine <= line) {
        found = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return found !== -1 && line <= regions[found].endLine;
  };
}
