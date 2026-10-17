const TERMINATORS = "\n\r\u2028\u2029";

/**
 * `text` without its trailing ` #` comment: everything from the first blank (one of `blanks`) that is followed by `#`, provided no line terminator comes after that `#`.
 *
 * It answers exactly what `text.replace(/[ \t]#.*$/, "")` answered (`blanks` is `" \t"`; `" "` for `/ #.*$/`), without the regex's cost. `.*$` stops at a `\n`, `\r`, U+2028 and
 * U+2029, so a ` #` with one of them after it cannot match, and the engine used to find that out once per ` #` pair of the text (quadratic: 100,000 pairs then U+2028 took 11 s).
 * Only a pair that starts at or after the last terminator, less one, can match, so one scan from the end finds where to begin and one scan forward finds the first pair.
 */
export function cutHashComment(text: string, blanks: string): string {
  let from = 0;
  for (let k = text.length - 1; k >= 0; k--) {
    if (TERMINATORS.includes(text[k])) {
      from = Math.max(0, k - 1);
      break;
    }
  }
  for (let i = from; i + 1 < text.length; i++) {
    if (text[i + 1] === "#" && blanks.includes(text[i])) {
      return text.slice(0, i);
    }
  }
  return text;
}
