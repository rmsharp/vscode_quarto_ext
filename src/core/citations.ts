/**
 * Pure, `vscode`-free parser for bibliography files referenced by a Quarto
 * document (architecture plan §3.3, Phase 6c).
 *
 * Turns the contents of a `.bib` (BibTeX) or CSL-JSON file into a flat list of
 * `Citation`s — one per entry — so the adapter (`providers/citation.ts`) can
 * offer each citekey as a completion on `@`. Parsing is deliberately focused on
 * what completion needs (key + a little display detail), not a faithful
 * round-trip of either format.
 */

import * as path from "node:path";

/** One bibliography entry, reduced to what citation completion needs. */
export interface Citation {
  /** The citekey — what an `@key` reference points at. */
  key: string;
  /** The entry title, if present (display detail). */
  title?: string;
  /** The author(s), as a display string, if present. */
  author?: string;
  /** The publication year, if present. */
  year?: string;
}

/**
 * Parse `content` (a `.bib` or CSL-JSON file) into citations, in file order.
 * The format is auto-detected; unparseable input yields `[]` rather than
 * throwing (a malformed bib must never break completion).
 */
export function parseCitations(content: string): Citation[] {
  // Strip a leading UTF-8 BOM: `JSON.parse` rejects it (CSL-JSON would silently
  // fail to load), and it is meaningless for BibTeX.
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }
  // CSL-JSON is a JSON array; a `.bib` never starts with `[`.
  if (content.trimStart().startsWith("[")) {
    return parseCslJson(content);
  }
  return parseBibtex(content);
}

/**
 * Append every citation of `more` to `target`, in order, one at a time.
 *
 * ⚠ **WHY A LOOP AND NOT `target.push(...more)`.** A call with a spread argument puts one stack slot per
 * element on the call stack, so a bibliography with more entries than the stack holds threw
 * `RangeError: Maximum call stack size exceeded` in the adapter's `loadCitations`: the completion listed
 * every citekey up to 106,319 entries and nothing from 106,320 (the bare spread throws from 110,428;
 * BibTeX and CSL-JSON alike; Node 22.23.3, fresh process per probe). The `catch` around it is EMPTY (a
 * missing or unreadable bibliography must not break completion), so the throw was swallowed and the file
 * added no citation at all. The adapter cannot be unit-tested (it imports `vscode`), which is why the
 * accumulation lives here.
 *
 * The length is read ONCE, before the loop: `appendCitations(x, x)` doubles `x`, as the spread did, and
 * does not chase the list it is growing. The old statement lives on as the oracle of
 * `test/unit/spreads-equivalence.test.ts` (`oldAppend`).
 */
export function appendCitations(target: Citation[], more: readonly Citation[]): void {
  const length = more.length;
  for (let i = 0; i < length; i++) {
    target.push(more[i]);
  }
}

/**
 * The citations of every bibliography a document declares, de-duplicated by citekey (first wins), in
 * declared/file order. Each path in `relPaths` is resolved against `dir`, the document's own directory,
 * and read with `readFile`, so that this loop can run without `vscode`. A missing or unreadable bibliography
 * is skipped — a broken bibliography must never break completion. The loop was the adapter's `loadCitations`
 * until the review of Session 338, which found that six behaviour mutants of it passed every unit test: only
 * a gate that read the adapter's SOURCE noticed the cure's call. ⚠ Since Session 343 NO production code calls
 * it (`createCitationCache` is the adapter's reader, and `s343-citation-wiring-pin.test.ts` forbids this call
 * there): it is kept as the ORACLE of `s343-citation-cache-rows.test.ts`, which compares every answer of the
 * cache with it.
 *
 * ⚠ The `catch` is EMPTY on purpose and it covers the append too, as it did in the adapter: it is what
 * swallowed the `RangeError` of the old spread (see {@link appendCitations}), so a throw from the parser
 * or the append is still read as "this file adds nothing", not as an error to show.
 */
export async function readCitations(
  relPaths: readonly string[],
  dir: string,
  readFile: (absolutePath: string) => Promise<string>,
): Promise<Citation[]> {
  const all: Citation[] = [];
  for (const rel of relPaths) {
    try {
      const content = await readFile(path.resolve(dir, rel));
      appendCitations(all, parseCitations(content));
    } catch {
      // Missing/unreadable bib file — skip it; offer what we can.
    }
  }
  return dedupeByKey(all);
}

/**
 * What identifies a bibliography file's content without reading it: its modification time (milliseconds), its size (bytes) and, when the file system says, its CHANGE time (`ctimeMs`).
 * The change time is what a tool that sets the modification time itself cannot reach (cp -p, rsync -t, touch -r, tar, unzip, a reproducible-build normaliser): a same-size replacement
 * by one of them keeps the first two numbers and moves the third. `fs.stat` always reports it; a stand-in that does not is compared on the two numbers it has.
 */
export interface BibliographyStat {
  mtimeMs: number;
  size: number;
  ctimeMs?: number;
}

/** The two things the cache needs of the file system, handed in by the adapter so that the cache can run without `vscode` (`fs.readFile` as UTF-8 text, and `fs.stat`). */
export interface CitationCacheOptions {
  readFile: (absolutePath: string) => Promise<string>;
  stat: (absolutePath: string) => Promise<BibliographyStat>;
}

/** The bibliographies of a document, read through a cache: the same answer as {@link readCitations}. */
export interface CitationCache {
  read(relPaths: readonly string[], dir: string): Promise<Citation[]>;
}

/** How many bibliography files the cache keeps; the least recently used one is dropped for the next. */
export const CITATION_CACHE_MAX_FILES = 16;

/** What the cache keeps for one file: the signature it was read under, and what it parsed to. */
interface CachedBibliography {
  mtimeMs: number;
  size: number;
  ctimeMs: number | undefined;
  citations: readonly Citation[];
}

/**
 * The bibliographies of a document, read through a cache of PARSED files (Session 343, SIB-07). The answer is
 * {@link readCitations}'s, for every input (that function is the oracle of `test/unit/s343-citation-cache-rows.test.ts`);
 * the difference is what it asks of the file system. The adapter used to read and parse every declared bibliography
 * on every completion request: at 20,000 entries of five lines each the parse alone is 40 ms, proportional to the bytes.
 *
 * For each declared path, in order:
 *  - the file is `stat`ed FIRST. If the cache holds it under the same modification time AND the same size AND the same
 *    change time, its parsed citations are reused and the file is not read. Otherwise it is read and parsed, and the
 *    entry replaced.
 *  - **the signature kept is the one read BEFORE the content.** A file rewritten between the `stat` and the read is then
 *    kept under the old signature, the next ask sees the new one and reads it again; read after the content, it would
 *    be kept under the new signature with the old content, and served stale for good.
 *  - a file that cannot be `stat`ed or read adds nothing, exactly as in `readCitations`, and its entry is DROPPED, so a
 *    file that comes back with the very numbers it had before is read again and not served from a stale entry.
 *
 * The cross-file de-duplication by key (first wins, in declared order) is done at EVERY ask over the entries, not kept:
 * the same two cached files answer differently when they are declared the other way round.
 *
 * ⚠ **THE BLIND SPOT.** A file rewritten to the SAME size that leaves the modification time, the size AND the change time as
 * they were is not seen. The change time cannot be set from user space, so what is left is a rewrite within the same tick
 * of the file system's clock (within one millisecond, at its granularity), as with any build tool that decides by stat;
 * a tool that sets the MODIFICATION time itself (cp -p, rsync -t, touch -r, tar, unzip) moves the change time and is seen
 * (Session 343's review round: the first spelling kept two numbers and missed it). `ino` is not part of the signature: a
 * symlink retargeted to a same-size file with the same three numbers is served as the old file. `===` is the comparison,
 * so a `NaN` (a stat that cannot say) is never equal to itself and the file is read at every ask, and `0` and `-0` are
 * one signature. A stat that does not carry the first two numbers is no signature at all: the file is read at every ask
 * and nothing is kept for it. A change time the stat does not carry (`undefined`) is equal to itself.
 *
 * The cache is keyed by the file's ABSOLUTE path, so two documents that declare one file by two spellings share an
 * entry, and it holds at most {@link CITATION_CACHE_MAX_FILES} files, least recently used first out (a `Map` iterates in
 * insertion order and a hit re-inserts). A document that declares more files than that still gets all of them: the
 * answer is built from what each ask read or reused, never from what is still held afterwards.
 *
 * The citations handed back are shared with the entries, so they are FROZEN: an edit of one throws in strict code (and
 * does nothing in sloppy code) instead of corrupting what the next ask is served from. The list is the caller's own.
 */
export function createCitationCache(options: CitationCacheOptions): CitationCache {
  const entries = new Map<string, CachedBibliography>();

  /** The parsed citations of one file, from the entry if its signature is unchanged and from the file if not; throws if the file cannot be `stat`ed or read. */
  async function citationsOf(absolute: string): Promise<readonly Citation[]> {
    const signature = await options.stat(absolute);
    const { mtimeMs, size, ctimeMs } = signature;
    const known = typeof mtimeMs === "number" && typeof size === "number";
    const kept = entries.get(absolute);
    if (known && kept !== undefined && kept.mtimeMs === mtimeMs && kept.size === size && kept.ctimeMs === ctimeMs) {
      entries.delete(absolute);
      entries.set(absolute, kept); // most recently used
      return kept.citations;
    }
    const citations = parseCitations(await options.readFile(absolute)).map((citation) => Object.freeze(citation));
    entries.delete(absolute);
    if (known) {
      entries.set(absolute, { mtimeMs, size, ctimeMs, citations });
      while (entries.size > CITATION_CACHE_MAX_FILES) {
        const oldest = entries.keys().next();
        if (oldest.done === true) break;
        entries.delete(oldest.value);
      }
    }
    return citations;
  }

  return {
    async read(relPaths, dir) {
      const merged: Citation[] = [];
      for (const relPath of relPaths) {
        let absolute = "";
        try {
          absolute = path.resolve(dir, relPath);
          appendCitations(merged, await citationsOf(absolute));
        } catch {
          // A file that cannot be stat'ed or read adds nothing, and what was kept for it is stale from now on.
          entries.delete(absolute);
        }
      }
      return dedupeByKey(merged);
    },
  };
}

/** Keep only the first citation for each key, preserving order. */
function dedupeByKey(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  return citations.filter((c) => {
    if (seen.has(c.key)) {
      return false;
    }
    seen.add(c.key);
    return true;
  });
}

// ── Completion context ──────────────────────────────────────────────────────

/** Where an in-progress `@key` citation begins, and what has been typed so far. */
export interface CitationCompletionContext {
  /** 0-based column of the `@` that starts the citation being typed. */
  start: number;
  /** The key text typed between the `@` and the cursor (may be `""`). */
  typed: string;
  /** 0-based column just past the end of the key token (for the replace range). */
  end: number;
}

/**
 * A character allowed inside a citekey for completion token-scanning. Pandoc
 * citekeys are alphanumerics, `_`, and internal punctuation; this uses the
 * practical subset that real keys use (`:` `.` `+` `/` `-`, e.g. biblatex
 * `Knuth:1984`, DBLP `DBLP:journals/...`, dotted `einstein.1905`) and excludes
 * the exotic Pandoc chars (`#$%&?<>~`) to avoid over-matching prose.
 *
 * ⚠ **THIS IS A FLAT CLASS PLUS {@link CITEKEY_TRAILING_PUNCT}; `core/refs` NOW SPELLS THE
 * SAME PANDOC RULE THE OTHER WAY.** Session 220 measured `citeKey` directly and expressed it
 * as "internal punctuation is admitted only when a regchar follows it" (`REF_ID_PUNCT`),
 * which needs no trailing trim because a trailing punctuation char is never consumed in the
 * first place. That form also admits the exotic characters excluded here, since the follower
 * clause — not a narrow class — is what keeps it off prose. The two files agreed before and
 * still agree; only the spelling differs. Unifying them is unfiled work, not an accident.
 */
const CITEKEY_CHAR = /[A-Za-z0-9_:.+/-]/;
/** Punctuation a citekey may not END in (Pandoc) — trimmed from the replace range. */
const CITEKEY_TRAILING_PUNCT = /[:.+/-]/;
/** A word character that, immediately before an `@`, marks it as an email — not a citation. */
const WORD_CHAR = /[A-Za-z0-9_]/;

/**
 * If 0-based `column` on `lineText` sits inside an in-progress `@key` citation
 * (a bare `@`, or `@` followed by citekey characters), return where the `@` is,
 * the key typed so far, and the end of the whole key token; otherwise `null`.
 * An `@` preceded by a word character is an email, not a citation. The `end`
 * spans the full key (including any `:`/`.` past the cursor) so accepting a
 * completion mid-token replaces the whole token, but stops before trailing
 * sentence punctuation so an `@key.` does not eat the period.
 */
export function citationCompletionContext(
  lineText: string,
  column: number,
): CitationCompletionContext | null {
  let i = column - 1;
  while (i >= 0 && CITEKEY_CHAR.test(lineText[i])) {
    i--;
  }
  if (i < 0 || lineText[i] !== "@") {
    return null;
  }
  if (i > 0 && WORD_CHAR.test(lineText[i - 1])) {
    return null;
  }
  let end = column;
  while (end < lineText.length && CITEKEY_CHAR.test(lineText[end])) {
    end++;
  }
  while (end > column && CITEKEY_TRAILING_PUNCT.test(lineText[end - 1])) {
    end--;
  }
  return { start: i, typed: lineText.slice(i + 1, column), end };
}

// ── CSL-JSON ────────────────────────────────────────────────────────────────

/** One author object in CSL-JSON: a structured name or a `literal` string. */
interface CslName {
  family?: string;
  given?: string;
  literal?: string;
}

/** A single CSL-JSON reference item (only the fields completion uses). */
interface CslItem {
  id?: unknown;
  title?: unknown;
  author?: unknown;
  issued?: { "date-parts"?: unknown };
}

/** Parse a CSL-JSON array into citations; malformed JSON yields `[]`. */
function parseCslJson(content: string): Citation[] {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) {
    return [];
  }
  const citations: Citation[] = [];
  for (const raw of data as CslItem[]) {
    if (raw === null || typeof raw !== "object" || typeof raw.id !== "string") {
      continue;
    }
    const citation: Citation = { key: raw.id };
    if (typeof raw.title === "string" && raw.title !== "") {
      citation.title = raw.title;
    }
    const author = cslAuthors(raw.author);
    if (author !== "") {
      citation.author = author;
    }
    const year = cslYear(raw.issued);
    if (year !== "") {
      citation.year = year;
    }
    citations.push(citation);
  }
  return citations;
}

/** Format a CSL-JSON author array as `"Family, Given; …"` (or a literal name). */
function cslAuthors(author: unknown): string {
  if (!Array.isArray(author)) {
    return "";
  }
  return author
    .map((a: CslName) => {
      if (a === null || typeof a !== "object") {
        return "";
      }
      if (typeof a.literal === "string") {
        return a.literal;
      }
      if (typeof a.family === "string") {
        return typeof a.given === "string" && a.given !== ""
          ? `${a.family}, ${a.given}`
          : a.family;
      }
      return "";
    })
    .filter((s) => s !== "")
    .join("; ");
}

/** Extract the year from a CSL-JSON `issued.date-parts` structure. */
function cslYear(issued: CslItem["issued"]): string {
  const parts = issued?.["date-parts"];
  if (Array.isArray(parts) && Array.isArray(parts[0]) && parts[0].length > 0) {
    const year = parts[0][0];
    // Only a number or non-empty string is a real year; a null/object leaf in a
    // malformed date-parts must not become the string "null"/"[object Object]".
    if (typeof year === "number" || (typeof year === "string" && year !== "")) {
      return String(year);
    }
  }
  return "";
}

// ── BibTeX ────────────────────────────────────────────────────────────────

/** BibTeX `@type` blocks that declare no citation and must be skipped. */
const NON_ENTRY_TYPES = new Set(["string", "comment", "preamble"]);

/** Scan every `@type{ … }` entry in BibTeX `content`. */
function parseBibtex(content: string): Citation[] {
  const citations: Citation[] = [];
  let i = 0;
  while (i < content.length) {
    const at = content.indexOf("@", i);
    if (at === -1) {
      break;
    }
    let j = at + 1;
    while (j < content.length && /[A-Za-z]/.test(content[j])) {
      j++;
    }
    const type = content.slice(at + 1, j).toLowerCase();
    while (j < content.length && /\s/.test(content[j])) {
      j++;
    }
    // BibTeX entries are delimited by `{ … }` or, less commonly, `( … )`.
    const opener = content[j];
    if (opener !== "{" && opener !== "(") {
      i = at + 1;
      continue;
    }
    const close =
      opener === "{" ? matchBrace(content, j) : matchParen(content, j);
    if (close === -1) {
      break;
    }
    if (!NON_ENTRY_TYPES.has(type)) {
      const entry = parseEntryBody(content.slice(j + 1, close));
      if (entry) {
        citations.push(entry);
      }
    }
    i = close + 1;
  }
  return citations;
}

/**
 * The index of the `}` matching the entry-opening `{` at `open`, or -1 if
 * unbalanced. Quote-aware: a `"…"` quoted field value sits at brace depth 1, and
 * braces inside it are literal (e.g. `note = "open { brace"`), so they must not
 * count toward depth — otherwise one stray brace in a quoted value swallows or
 * discards the rest of the file.
 */
function matchBrace(s: string, open: number): number {
  let depth = 0;
  let inQuote = false;
  for (let k = open; k < s.length; k++) {
    const c = s[k];
    if (c === '"' && depth === 1) {
      inQuote = !inQuote;
    } else if (inQuote) {
      continue;
    } else if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        return k;
      }
    }
  }
  return -1;
}

/**
 * The index of the `)` closing a parenthesis-delimited entry opened at `open`,
 * or -1 if unbalanced. The entry ends at the first `)` that is at brace depth 0
 * and outside a quoted value, so a `)` inside a `{…}` field value (e.g.
 * `title = {Foo (bar)}`) does not end the entry early.
 */
function matchParen(s: string, open: number): number {
  let depth = 0;
  let inQuote = false;
  for (let k = open + 1; k < s.length; k++) {
    const c = s[k];
    if (c === '"' && depth === 0) {
      inQuote = !inQuote;
    } else if (inQuote) {
      continue;
    } else if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
    } else if (c === ")" && depth === 0) {
      return k;
    }
  }
  return -1;
}

/**
 * Parse one entry body (everything between the outer braces): the citekey, then
 * `name = value` fields. Returns `null` if there is no citekey.
 */
function parseEntryBody(body: string): Citation | null {
  const parts = splitTopLevel(body);
  const key = parts[0].trim();
  if (key === "") {
    return null;
  }
  const fields: Record<string, string> = {};
  for (let p = 1; p < parts.length; p++) {
    const eq = parts[p].indexOf("=");
    if (eq === -1) {
      continue;
    }
    const name = parts[p].slice(0, eq).trim().toLowerCase();
    if (name !== "") {
      fields[name] = stripValue(parts[p].slice(eq + 1));
    }
  }
  const citation: Citation = { key };
  if (fields.title) {
    citation.title = fields.title;
  }
  if (fields.author) {
    citation.author = fields.author;
  }
  if (fields.year) {
    citation.year = fields.year;
  }
  return citation;
}

/**
 * Split an entry body on top-level commas — those outside any `{…}` group and
 * outside a `"…"` quoted value. A `"` only opens/closes a quoted value at brace
 * depth 0 (inside braces it is a literal character), matching BibTeX.
 */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inQuote = false;
  let cur = "";
  for (let k = 0; k < body.length; k++) {
    const c = body[k];
    if (c === '"' && depth === 0) {
      inQuote = !inQuote;
    } else if (!inQuote && c === "{") {
      depth++;
    } else if (!inQuote && c === "}") {
      depth--;
    } else if (!inQuote && c === "," && depth === 0) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  parts.push(cur);
  return parts;
}

/**
 * Reduce a raw field value to display text: strip a surrounding `{…}` or `"…"`
 * wrapper, drop inner braces (BibTeX capitalization-protection), and collapse
 * whitespace. A bare value (e.g. a numeric `year = 2021`) is left as-is.
 */
function stripValue(raw: string): string {
  let v = raw.trim();
  if (
    (v.startsWith("{") && v.endsWith("}")) ||
    (v.startsWith('"') && v.endsWith('"'))
  ) {
    v = v.slice(1, -1);
  }
  return v.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}
