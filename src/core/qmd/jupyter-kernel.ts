/**
 * The language of the jupyter KERNEL a document runs, as its own front matter fixes it (Session 294).
 *
 * Quarto's jupyter engine treats exactly one code-cell language as the kernel's: that cell closes only at its own indent and a
 * mismatched one is dropped (Session 293), while every OTHER `{lang}` opener is a plain pandoc fence. Which language is the kernel
 * is not always python. Rendered with quarto 1.7.33 (`quarto render --no-execute`, `scratchpad/s294/k1`, `k2`, `k3`):
 *
 *  - a document that names no kernel, or `jupyter: python3`, runs python;
 *  - a `jupyter:` mapping whose `kernelspec` writes a `language` runs THAT language, whatever the kernel's `name` says, in any
 *    spelling (block or flow, quoted or not, commented, anchored, in any key order); a `language` written anywhere else
 *    (directly under `jupyter:`, under `format:`) is not the kernel's;
 *  - a kernel NAMED but not described (`jupyter: julia-1.9`, `jupyter: ir`, `jupyter: true`, a mapping with no `language`) has a
 *    language only an installed kernelspec could say, and quarto FAILS the render where it is missing (exit 1) — so there is no
 *    oracle, and the answer here is `null` ("not written in the document"), never a guess.
 *
 * The caller keeps its old behaviour for `null`. A project `_quarto.yml` that sets `jupyter:` is invisible to a scanner of one
 * document, like every other project-level key.
 *
 * ⚠ **"PYTHON" IS A CLAIM THAT THE FRONT MATTER WAS UNDERSTOOD, NOT A DEFAULT FOR WHAT WAS NOT.** Seven adversarial documents
 * (`scratchpad/s294/adv2/K1`) named a kernel in a form this reader does not read (an escaped key, an indented root, JSON, a
 * multi-line flow document, a complex `? key`, a `jupyter:` line hidden inside a multi-line quoted scalar, a mid-document metadata
 * block) and "no key found" had answered python: the skip then removed the kernel's own cell. So `python` is returned only for
 * front matter `seesThrough` (plain column-0 keys, no scalar or flow collection left open, one `jupyter` key at most) whose body
 * never writes a `jupyter:` key of its own; anything else is `null`.
 *
 * Pure: the front matter's CONTENT lines in, a lower-cased language or `null` out. No import from `model.ts`, which imports this.
 */

/** A top-level (column 0) `jupyter` key and everything after its colon. */
const JUPYTER_KEY = /^(?:jupyter|"jupyter"|'jupyter')[ \t]*:(.*)$/;

/** The number of leading spaces of `line`, or -1 for a blank or comment-only line (which never ends a block). */
function indentOf(line: string): number {
  if (/^[ \t]*(?:#.*)?$/.test(line)) {
    return -1;
  }
  return /^ */.exec(line)![0].length;
}

/** `rest` of a `key: rest` line with its comment, its quotes and a leading anchor removed, or `null` when it is not a plain scalar. */
function scalarOf(rest: string): string | null {
  let value = rest.trim();
  const quoted = /^(["'])(.*?)\1(?:[ \t]+#.*)?$/.exec(value);
  if (quoted !== null) {
    return quoted[2];
  }
  // The comment is cut at the first `#` that follows whitespace. (Not `value.replace(/[ \t]+#.*$/, "")`: unanchored, that backtracks
  // quadratically over a long run of spaces, 30,000 of them costing about 550 ms.)
  const hash = value.search(/[ \t]#/);
  value = (hash < 0 ? value : value.slice(0, hash)).trimEnd().replace(/^&\S+[ \t]+/, "");
  return value === "" || /^[*{["'|>!&]/.test(value) ? null : value;
}

/** A language token, lower-cased, or `null` when the text is not a plain one. */
function languageOf(text: string | null): string | null {
  return text !== null && /^[A-Za-z][\w.+#-]*$/.test(text) ? text.toLowerCase() : null;
}

/** `key: rest` at exactly `indent` spaces, with the key optionally quoted. */
function keyLine(line: string, indent: number, key: string): string | null {
  const m = new RegExp(`^ {${indent}}(?:${key}|"${key}"|'${key}')[ \\t]*:(.*)$`).exec(line);
  return m === null ? null : m[1];
}

/**
 * The top-level `key: value` entries of a SINGLE-LINE flow mapping `{...}` (values kept raw, keys unquoted), or `null` when `text`
 * is not a well-formed one: unbalanced, an entry with no colon, or anything after the closing brace but a comment.
 */
function flowEntries(text: string): Map<string, string> | null {
  const body = text.trim();
  if (!body.startsWith("{")) {
    return null;
  }
  const entries = new Map<string, string>();
  let depth = 0;
  let quote: string | null = null;
  let start = 1;
  let colon = -1;
  const flush = (end: number): boolean => {
    const entry = body.slice(start, end);
    if (entry.trim() === "" && end === body.length - 1 && entries.size > 0) {
      return true;
    }
    if (colon < 0) {
      return false;
    }
    const key = body.slice(start, colon).trim().replace(/^(["'])(.*)\1$/, "$2");
    entries.set(key, body.slice(colon + 1, end).trim());
    colon = -1;
    return true;
  };
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quote !== null) {
      if (c === "\\" && quote === '"') {
        i++; // an escaped character in a double-quoted scalar (`\"` does not end it)
      } else if (c === quote) {
        quote = null;
      }
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === "{" || c === "[") {
      depth++;
    } else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) {
        if (!flush(i) || !/^[ \t]*(?:#.*)?$/.test(body.slice(i + 1))) {
          return null;
        }
        return entries;
      }
    } else if (depth === 1 && c === ":" && colon < 0) {
      colon = i;
    } else if (depth === 1 && c === ",") {
      if (!flush(i)) {
        return null;
      }
      start = i + 1;
    }
  }
  return null;
}

/** The language a flow `kernelspec` mapping writes, or `null`. */
function flowKernelspecLanguage(kernelspec: string): string | null {
  const language = flowEntries(kernelspec)?.get("language");
  return language === undefined ? null : languageOf(scalarOf(language));
}

/** Whether `code` is a space or a tab: the two blanks of YAML. */
function isBlankUnit(code: number): boolean {
  return code === 32 || code === 9;
}

/** Whether `code` is one of `[A-Za-z0-9_]`. */
function isWordUnit(code: number): boolean {
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95;
}

/** Whether `code` ends a line for `.`: LF, CR, U+2028 or U+2029. */
function isLineEndUnit(code: number): boolean {
  return code === 10 || code === 13 || code === 0x2028 || code === 0x2029;
}

/**
 * Where the dash prefix of `line` ends: its blanks, and then every `-` that has a blank behind it with the blanks that follow (the language `[ \t]*(?:-[ \t]+)*`, Session 337).
 *
 * It was the pattern: V8 keeps one entry of its regex backtrack stack per repetition of a GROUP, so a front matter line of 3,355,428 or more `- ` threw `RangeError: Maximum call stack size exceeded`
 * (bisected at `8ebce73`, a fresh process per probe, the unit `-\t` and `-  ` the same), and the error reached every reader of the document that the engine resolver calls jupyter. The loop takes what the
 * greedy pattern took: no key starts at a blank or at a `-`, so no shorter prefix can be followed by one, and the prefix is never given back.
 */
export function dashPrefixEnd(line: string): number {
  let at = 0;
  while (isBlankUnit(line.charCodeAt(at))) {
    at++;
  }
  while (line.charCodeAt(at) === 45 && isBlankUnit(line.charCodeAt(at + 1))) {
    at += 2;
    while (isBlankUnit(line.charCodeAt(at))) {
      at++;
    }
  }
  return at;
}

/** What {@link readKeyLine} found after the colon: `undefined` for a colon with nothing after it, `""` for blanks only, else the rest of the line from its first non-blank character. */
export interface KeyLineRead {
  value: string | undefined;
}

/**
 * `key:` at the start of a line (plain or simply quoted, no escapes), with the rest of the line as `value`; `null` when the line is no key line. It was the pattern
 * `^[ \t]*(?:-[ \t]+)*(?:"[^"\\]*"|'[^']*'|[A-Za-z0-9_](?:[A-Za-z0-9_. -]*[A-Za-z0-9_.-])?)[ \t]*:(?:[ \t]+(?![ \t])(.*)|)$` (`KEY_LINE`) until Session 337, when its dash group overflowed the regex stack; the pattern is the oracle of
 * `test/unit/key-line-equivalence.test.ts`.
 *
 * ⚠ A plain key ENDS on a non-space character: the pattern wrote `[A-Za-z0-9_. -]*[A-Za-z0-9_.-]`, not `[...]*?` followed by `[ \t]*`. The overlapping classes backtracked quadratically on a long run of spaces
 * (30,000 spaces cost about 550 ms through `findHeadings`, Session 294). Here the key is the longest run of its class and the blanks before the colon are read after it, which is the same line: the colon is in neither class.
 *
 * ⚠ The blank run after the colon is the WHOLE run (Session 319: the pattern ended it in the lookahead `(?![ \t])`, because a CR, U+2028 or U+2029 after it makes `(.*)$` fail and the engine retried it once per way
 * of splitting the run, 6 s on 100,000). Exact, because the value may be empty and may itself start with a blank. `value` is `undefined` for a colon with nothing after it and `""` for blanks only,
 * and `leavesOpen` reads the difference. The value holds no line terminator (`.` takes none), so a line with one after the colon is no key line.
 */
export function readKeyLine(line: string): KeyLineRead | null {
  let at = dashPrefixEnd(line);
  const first = line.charCodeAt(at);
  if (first === 34) {
    // `"[^"\\]*"`: the first `"` closes it, and a backslash before it makes the line no key line
    at++;
    while (at < line.length && line.charCodeAt(at) !== 34 && line.charCodeAt(at) !== 92) {
      at++;
    }
    if (line.charCodeAt(at) !== 34) {
      return null;
    }
    at++;
  } else if (first === 39) {
    const close = line.indexOf("'", at + 1);
    if (close < 0) {
      return null;
    }
    at = close + 1;
  } else if (isWordUnit(first)) {
    at++;
    while (isWordUnit(line.charCodeAt(at)) || line.charCodeAt(at) === 46 || line.charCodeAt(at) === 32 || line.charCodeAt(at) === 45) {
      at++;
    }
  } else {
    return null;
  }
  while (isBlankUnit(line.charCodeAt(at))) {
    at++;
  }
  if (line.charCodeAt(at) !== 58) {
    return null;
  }
  at++;
  if (at === line.length) {
    return { value: undefined };
  }
  if (!isBlankUnit(line.charCodeAt(at))) {
    return null;
  }
  while (isBlankUnit(line.charCodeAt(at))) {
    at++;
  }
  for (let i = at; i < line.length; i++) {
    if (isLineEndUnit(line.charCodeAt(i))) {
      return null;
    }
  }
  return { value: line.slice(at) };
}

/** Whether the value written on `line` opens a quoted scalar or a flow collection that the same line does not close. */
function leavesOpen(line: string): boolean {
  const value = (readKeyLine(line)?.value ?? line.slice(dashPrefixEnd(line))).trim();
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (quote !== null) {
      if (c === "\\" && quote === '"') {
        i++;
      } else if (c === quote) {
        quote = null;
      }
    } else if ((c === '"' || c === "'") && (i === 0 || /[\s{[,:]/.test(value[i - 1]))) {
      quote = c;
    } else if (c === "{" || c === "[") {
      depth++;
    } else if (c === "}" || c === "]") {
      depth--;
    } else if (c === "#" && (i === 0 || /\s/.test(value[i - 1]))) {
      break;
    }
  }
  return quote !== null || depth > 0;
}

/**
 * Whether this reader can SEE THROUGH `frontMatter`: its first content line is an unindented `key:` line, every unindented line is
 * one (plain or simply quoted, no escape), no scalar or flow collection is left open across lines, and `jupyter` is written at most
 * once. Only then does "no `jupyter:` key" mean "no kernel is named".
 */
function seesThrough(frontMatter: readonly string[]): boolean {
  let jupyterKeys = 0;
  let first = true;
  for (const line of frontMatter) {
    const indent = indentOf(line);
    if (indent < 0) {
      continue;
    }
    if (indent === 0 || first) {
      if (indent !== 0 || readKeyLine(line) === null) {
        return false;
      }
      if (JUPYTER_KEY.test(line)) {
        jupyterKeys++;
      }
    }
    first = false;
    if (leavesOpen(line)) {
      return false;
    }
  }
  return jupyterKeys <= 1;
}

export function jupyterKernelLanguage(frontMatter: readonly string[] | null, body: readonly string[] = []): string | null {
  // A `jupyter:` key written again in the body is a mid-document metadata block, which quarto merges into the metadata.
  if (body.some((line) => JUPYTER_KEY.test(line)) || (frontMatter !== null && !seesThrough(frontMatter))) {
    return null;
  }
  const at = frontMatter === null ? -1 : frontMatter.findIndex((line) => JUPYTER_KEY.test(line));
  if (frontMatter === null || at < 0) {
    return "python";
  }
  // `jupyter: <value>` on the key's own line: the one name whose language the document settles, or a whole flow mapping.
  const sameLine = JUPYTER_KEY.exec(frontMatter[at])![1].trim();
  if (sameLine !== "" && !sameLine.startsWith("#")) {
    if (sameLine.startsWith("{")) {
      const kernelspec = flowEntries(sameLine)?.get("kernelspec");
      return kernelspec === undefined ? null : flowKernelspecLanguage(kernelspec);
    }
    return scalarOf(sameLine) === "python3" ? "python" : null;
  }
  // The block under `jupyter:`: every following line that is indented, blank or a comment.
  const block: string[] = [];
  for (let i = at + 1; i < frontMatter.length && (indentOf(frontMatter[i]) !== 0); i++) {
    block.push(frontMatter[i]);
  }
  const childIndent = block.map(indentOf).find((n) => n > 0);
  if (childIndent === undefined) {
    return null;
  }
  const kernelspec = block.findIndex((line) => keyLine(line, childIndent, "kernelspec") !== null);
  if (kernelspec < 0) {
    return null;
  }
  // `kernelspec: {name: x, language: y}` written as a flow mapping on its own line.
  const inline = keyLine(block[kernelspec], childIndent, "kernelspec")!.trim();
  if (inline.startsWith("{")) {
    return flowKernelspecLanguage(inline);
  }
  const rest = block.slice(kernelspec + 1);
  const end = rest.findIndex((line) => {
    const n = indentOf(line);
    return n >= 0 && n <= childIndent;
  });
  const inside = end < 0 ? rest : rest.slice(0, end);
  const grandIndent = inside.map(indentOf).find((n) => n > childIndent);
  if (grandIndent === undefined) {
    return null;
  }
  for (const line of inside) {
    const value = keyLine(line, grandIndent, "language");
    if (value !== null) {
      return languageOf(scalarOf(value));
    }
  }
  return null;
}
