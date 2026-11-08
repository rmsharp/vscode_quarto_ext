// Session 345, part P2: THE OLD SPELLING of `cellTargetContext` and `plainFrontMatter`, kept as the oracle: the text of `src/core/qmd/model.ts` at the base commit acbc51f, VERBATIM, sliced piece by piece
// (`FRONTMATTER_CLOSE`, `MARKDOWN_CHANNEL`, `cellTargetContext`, `PLAIN_ENGINE_KEYS`, `PLAIN_ODD_SPACE`, `trimEndSpaces`, `plainFrontMatter`, `metadataBlockBelow`). Each one splits the whole text for itself,
// which is what the cure removes. Nothing is added but the import below (the two patterns and the type are the live model's, which the cure does not touch). Do not edit it by hand.
import { PLAIN_ITEM_LINE, PLAIN_KEY_LINE, type CellTargetContext } from "../../../src/core/qmd/model";

const FRONTMATTER_CLOSE = /^(?:---|\.\.\.)[ \t]*$/;

/** A line that names a way for code to write MARKDOWN at run time ({@link CellTargetContext.writesMarkdown}). */
const MARKDOWN_CHANNEL =
  /asis|\bMarkdown\s*\(|\bdisplay\s*\(|\bHTML\s*\(|IPython\.display|%%(?:markdown|html|latex)|(?<!`)`r\s+[^`]|(?<!`)`\{(?:r|python|julia)\}\s+[^`]|\{\{<|\bchild\s*[=:]/;

/** The document-level facts the cell readers need, read once per document. */
export function cellTargetContext(text: string): CellTargetContext {
  return {
    codeFromElsewhere: /read_chunk|read_demo|read_rforge|knit_code|opts_chunk/.test(text),
    unseenCode:
      /opts_hooks|opts_template|opts_knit|knit_hooks|knit_engines|set_alias|opts[._-]label|knit_child|knit_expand|metadata-files|\bsource\b|(?<![\w.$@])(?:eval|evalq|parse|do\.call|match\.fun|get0?|mget|exec|execfile|system2?)\s*\(|getNamespace|getFromNamespace|getExportedValue|asNamespace|loadNamespace|__import__|import_module|importlib|runpy|py_run_|source_python|import_from_path|readLines|\w:::\w/.test(
        text,
      ),
    writesMarkdown: false,
    markdownLines: text
      .split(/\r?\n/)
      .flatMap((line, n) => (MARKDOWN_CHANNEL.test(line) ? [n] : [])),
    keepsHidden: /keep-hidden/.test(text),
    opaqueFrontMatter: !plainFrontMatter(text),
  };
}

const PLAIN_ENGINE_KEYS: ReadonlySet<string> = new Set(["jupyter", "knitr", "engine", "julia"]);

/**
 * A space-like character other than an ASCII space or tab: the engine resolver trims with JavaScript's `\s`, which takes these, and
 * YAML does not, so `engine: knitr` followed by one reads as knitr to the resolver and as the string `knitr<nbsp>` to quarto
 * (hunt3 plain-gate a01-a18; the reviewer's trace). The front matter may hold none.
 */
const PLAIN_ODD_SPACE = /[\u0085\u00a0\u1680\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]/;
/** `value` without its trailing ASCII spaces, in one pass (a lazy regex over a long space run is quadratic). */
function trimEndSpaces(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === " ") {
    end--;
  }
  return value.slice(0, end);
}

/**
 * Whether the document's front matter is PLAIN (Session 304): absent, or the first thing in the file and made of nothing but
 * lines YAML and the engine resolver can only read one way. This is a WHITELIST, because the resolver reads the block as text and
 * round 2 of the hunt showed a blacklist of the spellings that blind it never ends (see `CellTargetContext.opaqueFrontMatter`).
 *
 * Plain means: if the first non-blank line is `---`, it is the FIRST line (a byte order mark, a leading space or a blank line before
 * it fails this, because the resolver trims) and a `---` or `...` line closes it; every line is blank, a `#` comment, a `key: value` line or a `- item`, all indented by spaces and the first content line at
 * column 0 with every column-0 line a key; a value is empty (a block follows), a block-scalar indicator (its indented block is
 * skipped as text), a plain scalar with no quote, bracket, brace, backslash, `&`, `*`, `!`, `?`, `%` or `@` start and no `: ` or
 * ` #` inside, a double-quoted string with no backslash or inner quote, a single-quoted string with no inner quote, or a one-line
 * flow list of such words. The four engine keys (`jupyter`, `knitr`, `engine`, `julia`) may not be quoted, because
 * `jupyter: ""` is false to quarto and truthy to the resolver (hunt2 e23, e24). Anything else — and a document whose first
 * non-blank line is `---` but not the first line — is not plain.
 *
 * ⚠ This only decides whether the text can be trusted; it models none of YAML. An apostrophe in a title (`title: Bob's`) makes a
 * front matter not plain and declines the rules for that document: a lost removal, the safe side.
 */
export function plainFrontMatter(text: string): boolean {
  const lines = text.split(/\r?\n/);
  let first = 0;
  while (first < lines.length && lines[first].trim() === "") {
    first++;
  }
  if (first >= lines.length) {
    return true;
  }
  if (!/^---[ \t]*$/.test(lines[first])) {
    // The resolver trims the text before it looks for the opener, so ` ---` or `<nbsp>---` opens a block it reads here.
    return lines[first].trim() !== "---" && !metadataBlockBelow(lines, 0);
  }
  if (first !== 0) {
    return false;
  }
  let end = -1;
  for (let j = 1; j < lines.length && end < 0; j++) {
    if (FRONTMATTER_CLOSE.test(lines[j])) {
      end = j;
    }
  }
  if (end < 0) {
    return false;
  }
  const plainWord = /^[^\s"'[\]{}&*!|>%@`#,?:-][^"'[\]{}\\]*$/;
  let openValue = -1; // the column of the last key whose value sits on its own line: a deeper line would CONTINUE that scalar
  const flowItem = /^(?:"[^"\\]*"|'[^']*'|[\w.@/+ -]+)$/;
  let sawContent = false;
  let blockOver = -1; // lines indented deeper than this belong to a block scalar
  for (let j = 1; j < end; j++) {
    const line = lines[j];
    if (PLAIN_ODD_SPACE.test(line)) {
      return false;
    }
    if (line.trim() === "") {
      continue;
    }
    const indent = /^ */.exec(line)?.[0].length ?? 0;
    if (blockOver >= 0 && indent > blockOver) {
      continue;
    }
    blockOver = -1;
    if (/^ *#/.test(line)) {
      continue;
    }
    if ((!sawContent && indent !== 0) || (openValue >= 0 && indent > openValue)) {
      return false; // the first content line is at column 0, and a deeper line would continue the value above it
    }
    openValue = -1;
    sawContent = true;
    const key = PLAIN_KEY_LINE.exec(line);
    if (key === null) {
      const item = PLAIN_ITEM_LINE.exec(line);
      const itemValue = item === null ? "" : trimEndSpaces(item[2]);
      if (item === null || indent === 0 || !(plainWord.test(itemValue) || /^"[^"\\]*"$|^'[^']*'$/.test(itemValue))) {
        return false;
      }
      openValue = indent;
      continue;
    }
    if (indent === 0 && key[2] !== undefined) {
      return false;
    }
    const raw = key[4] ?? "";
    const hash = raw.indexOf(" #");
    const value = trimEndSpaces(hash < 0 ? raw : raw.slice(0, hash));
    if (value === "") {
      continue;
    }
    const quoted = /^"[^"\\]*"$|^'[^']*'$/.test(value);
    if (/^[|>][+-]?[0-9]?$/.test(value)) {
      blockOver = indent;
      continue;
    }
    openValue = indent + (key[2]?.length ?? 0);
    if (quoted) {
      if (PLAIN_ENGINE_KEYS.has(key[3])) {
        return false;
      }
    } else if (value.startsWith("[")) {
      const body = /^\[(.*)\]$/.exec(value)?.[1];
      if (body === undefined || (body.trim() !== "" && !body.split(",").every((word) => flowItem.test(word.trim())))) {
        return false;
      }
    } else if (!plainWord.test(value) || /:(?: |$)/.test(value)) {
      return false;
    }
  }
  return !metadataBlockBelow(lines, end + 1);
}
/**
 * Whether a `---` line at or after `from` opens what pandoc reads as a METADATA BLOCK: preceded by a blank line (or the start of
 * the text) and followed at once by a line of text. Quarto merges such a block into the document's metadata wherever it sits
 * (hunt3 plain-gate a32-a36, rendered), so one written with an escape can set `keep-hidden` or an engine out of sight. A thematic
 * break (blank line after it) and a setext underline (text line before it) are not blocks.
 */
function metadataBlockBelow(lines: readonly string[], from: number): boolean {
  for (let j = from; j + 1 < lines.length; j++) {
    if (/^---[ \t]*$/.test(lines[j]) && lines[j + 1].trim() !== "" && (j === 0 || lines[j - 1].trim() === "")) {
      return true;
    }
  }
  return false;
}
