/**
 * Pandoc 3.6.3's markdown-family attribute grammar and div-fence production (Session 281, P2 of
 * `docs/planning/2026-09-14-attribute-tokenizer-plan.md`).
 *
 * ⚠ A LEAF: this file imports nothing, so both bundles can import it, and a unit test enforces it.
 */

/** The reader facts the grammar depends on (structurally `model.ts`'s `AttributeBlockReader`). */
export interface AttributeDialect {
  /** CommonMark family. Not implemented: every entry point answers `unmeasured`. */
  readonly commonmarkDialect: boolean;
  /** true: `\` escapes any non-alphanumeric (markdown, mmd, github); false: markdown_strict / phpextra. */
  readonly pandocEscapes: boolean;
}

/** One key=value exactly as WRITTEN. Values are NOT decoded. */
export interface AttrValue {
  readonly key: string;
  readonly raw: string;
  /** `"` or `'` when quoted; null when bare. */
  readonly quote: '"' | "'" | null;
}

/** Pandoc's Attr as its READER folds it: order kept, duplicates kept. */
export interface ParsedAttr {
  readonly id: string;
  readonly classes: readonly string[];
  readonly kvs: readonly AttrValue[];
}

export type AttributeBlockScan =
  | { readonly kind: "attr"; readonly attr: ParsedAttr; readonly end: number }
  | { readonly kind: "refused"; readonly reason: "invalid-token" | "open-at-eol"; readonly at: number }
  | { readonly kind: "unmeasured" };

export type DivOpenerVerdict =
  | { readonly kind: "attr"; readonly attr: ParsedAttr }
  | { readonly kind: "word"; readonly word: string; readonly fallback: boolean }
  | { readonly kind: "refused"; readonly reason: "invalid-token" | "trailing-text" }
  | { readonly kind: "open-at-eol" }
  | { readonly kind: "unmeasured" };

/** Pandoc's `isSpace`: [\t-\r] and the Unicode Zs class (NBSP included; U+2028, ZWSP, U+FEFF are NOT). */
const PANDOC_SPACE = /^[\t-\r\p{Zs}]$/u;
/** `alphaNum` of pandoc's identifier: Unicode letters and numbers (combining marks are neither). */
const ALPHA_NUM = /^[\p{L}\p{N}]$/u;
const LETTER = /^\p{L}$/u;
/** What `\` may escape, `all_symbols_escapable` (S217): any punctuation or symbol, and a space. */
const ESCAPABLE_ALL_SYMBOLS = /^[\p{P}\p{S} ]$/u;
/** What `\` may escape under markdown_strict / phpextra (S217): Markdown.pl's set plus `>`. */
const ESCAPABLE_LEGACY = /^[!#()*+\-.>[\\\]_`{}]$/;

/** The code point starting at `s[i]` as a string ("" past the end). */
function charAt(s: string, i: number): string {
  const cp = s.codePointAt(i);
  return cp === undefined ? "" : String.fromCodePoint(cp);
}
function isAsciiBlank(c: string): boolean {
  return c === " " || c === "\t";
}
function isIdChar(c: string): boolean {
  return c === "-" || c === "_" || c === ":" || c === "." || ALPHA_NUM.test(c);
}
/** The end of the run of identifier characters starting at `i` (`i` when there is none). */
function idRunEnd(s: string, i: number): number {
  let j = i;
  for (let c = charAt(s, j); c !== "" && isIdChar(c); c = charAt(s, j)) {
    j += c.length;
  }
  return j;
}
/** The index past the escape pair at `s[i]` (a backslash), or `i` when it escapes nothing. */
function escapeEnd(s: string, i: number, dialect: AttributeDialect): number {
  const next = charAt(s, i + 1);
  const escapable = dialect.pandocEscapes ? ESCAPABLE_ALL_SYMBOLS : ESCAPABLE_LEGACY;
  return next !== "" && escapable.test(next) ? i + 1 + next.length : i;
}

/** The fold of one `key=value`: `id=` sets the id, `class=` splits in place, anything else is kept. */
function foldValue(attr: { id: string; classes: string[]; kvs: AttrValue[] }, kv: AttrValue): void {
  if (kv.key === "id") {
    attr.id = kv.raw;
  } else if (kv.key === "class") {
    let word = "";
    for (const c of kv.raw) {
      if (PANDOC_SPACE.test(c)) {
        if (word !== "") {
          attr.classes.push(word);
        }
        word = "";
      } else {
        word += c;
      }
    }
    if (word !== "") {
      attr.classes.push(word);
    }
  } else {
    attr.kvs.push(kv);
  }
}

/**
 * ONE attribute block starting at `s[start]`: pandoc 3.6.3's markdown-family `attributes` production.
 * `s` is ONE line (CR removed, TABs already expanded over the physical line). Separators are ASCII
 * space and TAB only.
 */
export function parseAttributeBlock(s: string, start: number, dialect: AttributeDialect): AttributeBlockScan {
  if (dialect.commonmarkDialect) {
    return { kind: "unmeasured" };
  }
  if (s[start] !== "{") {
    return { kind: "refused", reason: "invalid-token", at: start };
  }
  const attr = { id: "", classes: [] as string[], kvs: [] as AttrValue[] };
  const refuse = (at: number): AttributeBlockScan => ({ kind: "refused", reason: "invalid-token", at });
  let i = start + 1;
  for (;;) {
    while (isAsciiBlank(s[i] ?? "")) {
      i++;
    }
    if (i >= s.length) {
      return { kind: "refused", reason: "open-at-eol", at: s.length };
    }
    const c = charAt(s, i);
    if (c === "}") {
      return { kind: "attr", attr, end: i + 1 };
    }
    if (c === "#") {
      const end = idRunEnd(s, i + 1);
      if (end === i + 1) {
        return refuse(i);
      }
      attr.id = s.slice(i + 1, end);
      i = end;
    } else if (c === ".") {
      if (!LETTER.test(charAt(s, i + 1))) {
        return refuse(i);
      }
      const end = idRunEnd(s, i + 1);
      attr.classes.push(s.slice(i + 1, end));
      i = end;
    } else if (c === "-") {
      attr.classes.push("unnumbered");
      i++;
    } else if (LETTER.test(c)) {
      const keyEnd = idRunEnd(s, i);
      if (s[keyEnd] !== "=") {
        return keyEnd >= s.length ? { kind: "refused", reason: "invalid-token", at: i } : refuse(i);
      }
      const key = s.slice(i, keyEnd);
      const value = readValue(s, keyEnd + 1, dialect);
      if (value.kind === "open") {
        return { kind: "refused", reason: "open-at-eol", at: s.length };
      }
      foldValue(attr, { key, raw: value.raw, quote: value.quote });
      i = value.end;
    } else {
      return refuse(i);
    }
  }
}

type ValueRead =
  | { readonly kind: "value"; readonly raw: string; readonly quote: '"' | "'" | null; readonly end: number }
  | { readonly kind: "open" };

/** The value after `=` at `s[i]`: pandoc's quoted value, its `""` / `''` shorthand, or a bare run. */
function readValue(s: string, i: number, dialect: AttributeDialect): ValueRead {
  const q = s[i];
  if (q === '"' || q === "'") {
    const after = charAt(s, i + 1);
    if (after === q) {
      return { kind: "value", raw: "", quote: q, end: i + 2 };
    }
    // pandoc's `enclosed`: a quote followed by any space (or the end of the line) is NOT an opener.
    if (after !== "" && !PANDOC_SPACE.test(after)) {
      let j = i + 1;
      while (j < s.length) {
        if (s[j] === "\\") {
          const next = escapeEnd(s, j, dialect);
          j = next === j ? j + 1 : next;
        } else if (s[j] === q) {
          return { kind: "value", raw: s.slice(i + 1, j), quote: q, end: j + 1 };
        } else {
          j++;
        }
      }
      return { kind: "open" };
    }
  }
  let j = i;
  while (j < s.length && !isAsciiBlank(s[j]) && s[j] !== "}") {
    if (s[j] === "\\") {
      const next = escapeEnd(s, j, dialect);
      j = next === j ? j + 1 : next;
    } else {
      j++;
    }
  }
  return { kind: "value", raw: s.slice(i, j), quote: null, end: j };
}

/** `[ \t]* :* [ \t]* EOL` from `i`. */
function onlyTailRuleFrom(s: string, i: number): boolean {
  let j = i;
  while (isAsciiBlank(s[j] ?? "")) {
    j++;
  }
  while (s[j] === ":") {
    j++;
  }
  while (isAsciiBlank(s[j] ?? "")) {
    j++;
  }
  return j >= s.length;
}

/**
 * What a `:::` opener's tail opens, per pandoc's div-fence production:
 *     tail := [ \t]* ( attributes | WORD ) [ \t]* :* [ \t]* EOL,   WORD := [^ \t]+
 * `attributes` is tried first; ONCE A BLOCK HAS PARSED, WORD IS NEVER TRIED.
 */
export function divOpenerVerdict(tail: string, dialect: AttributeDialect): DivOpenerVerdict {
  if (dialect.commonmarkDialect) {
    return { kind: "unmeasured" };
  }
  let i = 0;
  while (isAsciiBlank(tail[i] ?? "")) {
    i++;
  }
  if (i >= tail.length) {
    return { kind: "refused", reason: "invalid-token" };
  }
  if (tail[i] === "{") {
    const scan = parseAttributeBlock(tail, i, dialect);
    if (scan.kind === "unmeasured") {
      return { kind: "unmeasured" };
    }
    if (scan.kind === "attr") {
      return onlyTailRuleFrom(tail, scan.end)
        ? { kind: "attr", attr: scan.attr }
        : { kind: "refused", reason: "trailing-text" };
    }
    if (scan.reason === "open-at-eol") {
      return { kind: "open-at-eol" };
    }
  }
  let end = i;
  while (end < tail.length && !isAsciiBlank(tail[end])) {
    end++;
  }
  const word = tail.slice(i, end);
  return onlyTailRuleFrom(tail, end)
    ? { kind: "word", word, fallback: word.startsWith("{") }
    : { kind: "refused", reason: "invalid-token" };
}
