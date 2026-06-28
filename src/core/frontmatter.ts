/**
 * Pure, `vscode`-free reader for the YAML front matter of a Quarto `.qmd`
 * document (architecture plan §3.3, Phase 6c).
 *
 * The region model (`core/qmd/model`) deliberately SKIPS front matter, so the
 * citation layer needs its own way to read the one key it cares about:
 * `bibliography:`. Rather than add a YAML dependency for a single key, this is a
 * focused reader that understands the handful of forms Quarto accepts for that
 * key (a string, a flow list, or a block list). Full YAML is out of v1 scope.
 */

/** The `---` line that opens a YAML front-matter block — only valid at line 0. */
const FRONTMATTER_OPEN = /^---[ \t]*$/;
/** A YAML front-matter terminator: `---` or `...` (YAML's document-end marker). */
const FRONTMATTER_CLOSE = /^(?:---|\.\.\.)[ \t]*$/;

/**
 * The lines of the leading YAML front-matter block (between the opening `---` and
 * its terminator), or `null` if the document has no front matter. The fence lines
 * are excluded.
 */
function frontMatterLines(text: string): string[] | null {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0 || !FRONTMATTER_OPEN.test(lines[0])) {
    return null;
  }
  const body: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (FRONTMATTER_CLOSE.test(lines[i])) {
      return body;
    }
    body.push(lines[i]);
  }
  // An unterminated front-matter block: treat the rest of the document as it.
  return body;
}

/** Strip a surrounding pair of matching single or double quotes from a scalar. */
function unquote(value: string): string {
  const v = value.trim();
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0]) {
    return v.slice(1, -1);
  }
  return v;
}

/**
 * Remove a trailing YAML end-of-line comment from a raw value. A `#` starts a
 * comment only when it is outside any quotes and preceded by whitespace (or
 * begins the value) — so `refs.bib # main` loses the comment while a `#` inside
 * `"a#b.bib"` survives. The remaining text is returned untrimmed (callers trim).
 */
function stripComment(raw: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (c === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (
      c === "#" &&
      !inSingle &&
      !inDouble &&
      (i === 0 || /\s/.test(raw[i - 1]))
    ) {
      return raw.slice(0, i);
    }
  }
  return raw;
}

/**
 * The bibliography file path(s) declared in the document's YAML front matter, in
 * order, or `[]` if none. Handles the three forms Quarto accepts:
 *   - a scalar:      `bibliography: refs.bib`
 *   - a flow list:   `bibliography: [a.bib, b.bib]`
 *   - a block list:  `bibliography:` then `  - a.bib` lines
 */
export function bibliographyPaths(text: string): string[] {
  const lines = frontMatterLines(text);
  if (lines === null) {
    return [];
  }
  const keyIndex = lines.findIndex((l) => /^bibliography:/.test(l));
  if (keyIndex === -1) {
    return [];
  }
  const value = stripComment(lines[keyIndex].replace(/^bibliography:/, "")).trim();

  // Block-list form: the key has no inline value; the paths are `- item` lines
  // beneath it. YAML allows the sequence dashes at the key's own indentation, so
  // zero leading whitespace is accepted; the loop stops at the first non-item
  // line (a sibling key, a blank line, or end of front matter).
  if (value === "") {
    const items: string[] = [];
    for (let i = keyIndex + 1; i < lines.length; i++) {
      const m = /^\s*-\s+(.*)$/.exec(lines[i]);
      if (!m) {
        break;
      }
      const item = unquote(stripComment(m[1]).trim());
      if (item !== "") {
        items.push(item);
      }
    }
    return items;
  }

  // Flow-list form: `[a.bib, b.bib]`.
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map(unquote)
      .filter((p) => p !== "");
  }

  // Scalar form: `bibliography: refs.bib`. An explicitly empty value is no bib.
  const scalar = unquote(value);
  return scalar === "" ? [] : [scalar];
}
