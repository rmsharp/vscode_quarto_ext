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
  // CSL-JSON is a JSON array; a `.bib` never starts with `[`.
  if (content.trimStart().startsWith("[")) {
    return parseCslJson(content);
  }
  return parseBibtex(content);
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
    return String(parts[0][0]);
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
    if (content[j] !== "{") {
      i = at + 1;
      continue;
    }
    const close = matchBrace(content, j);
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

/** The index of the `}` matching the `{` at `open`, or -1 if unbalanced. */
function matchBrace(s: string, open: number): number {
  let depth = 0;
  for (let k = open; k < s.length; k++) {
    if (s[k] === "{") {
      depth++;
    } else if (s[k] === "}") {
      depth--;
      if (depth === 0) {
        return k;
      }
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
