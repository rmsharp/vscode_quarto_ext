/**
 * Pure, `vscode`-free helpers for the `Quarto: Preview Format…` command
 * (`BACKLOG.md` item 15). Two concerns:
 *
 *  - `parseDeclaredFormats` — enumerate a document's declared output formats from
 *    its front-matter `format:` block, so the command can offer them in a
 *    QuickPick. A view over the shared front-matter scanner
 *    (`frontMatterContentLines`), never a second `---` parser (Learning #14).
 *  - `buildPreviewArgs` — construct the `quarto preview` argv, optionally pinning
 *    a format via `--to` (verified: `quarto preview <file> --no-browser --to
 *    <fmt>` renders the chosen format — `--to` is forwarded to `quarto render`,
 *    per the CLI's own `preview --help`). Sibling of `render-args.ts`'s
 *    `buildRenderArgs`; kept here so the preview feature owns its own arg grammar.
 *
 * Lives in `core/` and MUST NOT import `vscode` (architecture §3.3 guardrail) so
 * both stay unit-testable headlessly.
 */

import { frontMatterContentLines } from "./qmd/model";

/**
 * The declared output formats of a Quarto document, in document order, read from
 * the top-level `format:` key of its YAML front matter:
 *
 *  - `format: html`            → `["html"]`            (scalar)
 *  - `format:\n  html:\n  pdf:`→ `["html", "pdf"]`     (block mapping children)
 *
 * Returns `[]` when the document has no front matter, or no top-level `format:`
 * key — the caller decides the fallback (Quarto's implicit default is `html`).
 */
export function parseDeclaredFormats(text: string): string[] {
  const lines = frontMatterContentLines(text);
  if (lines === null) {
    return [];
  }
  for (let i = 0; i < lines.length; i++) {
    // `^format` (column 0, no indent) — only the TOP-LEVEL format key, never a
    // `format:` nested under some other key.
    const m = /^format[ \t]*:(.*)$/.exec(lines[i]);
    if (m === null) {
      continue;
    }
    const scalar = stripComment(m[1]).trim();
    if (scalar.length > 0) {
      // A flow collection (`{html: default}` / `[html, pdf]`) is destructured
      // into its member format names — never returned as one opaque token,
      // which would reach `--to` verbatim and fail (adversarial review, S82).
      const flow = parseFlowCollection(scalar);
      return flow !== null ? flow : [unquote(scalar)];
    }
    // Empty value after the colon → a block mapping/sequence follows; collect
    // its IMMEDIATE children (the format names), not their nested options.
    return childFormatNames(lines, i + 1);
  }
  return [];
}

/**
 * The immediate children of a block `format:` key, starting at line index
 * `start`. Children live at the first indentation level below `format:` (which
 * is at column 0); deeper-indented lines are that format's own options and are
 * skipped, and a return to column 0 (the next top-level key) ends the block.
 */
function childFormatNames(lines: string[], start: number): string[] {
  const names: string[] = [];
  let childIndent = -1;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().length === 0 || isComment(line)) {
      continue;
    }
    const indent = leadingWhitespace(line);
    if (indent === 0) {
      break; // back to a top-level key — the format block is over
    }
    if (childIndent === -1) {
      childIndent = indent;
    }
    if (indent < childIndent) {
      break; // dedented below the child level — block over
    }
    if (indent > childIndent) {
      continue; // a nested option of a format, not a format name
    }
    const name = childName(line.slice(indent));
    if (name !== null) {
      names.push(name);
    }
  }
  return names;
}

/**
 * Destructure a YAML flow collection into its member format names, or return
 * `null` if `scalar` is not a flow collection (does not start with `{`/`[`):
 *
 *  - `{html: default, pdf: default}` → `["html", "pdf"]`  (flow mapping keys)
 *  - `[html, pdf]`                    → `["html", "pdf"]`  (flow sequence items)
 *  - `{}` / `[]`                      → `[]`
 *
 * A tolerant comma-split — it does NOT handle a flow collection nested inside
 * another (a comma inside `{a: {x: 1, y: 2}}`), which is astronomically rare in
 * a `format:` block and, like the block-collection paths, degrades to a MISSING
 * name, never a wrong `--to` (the caller falls back to Quarto's default).
 * Documented limitation (Polish/deferred).
 */
function parseFlowCollection(scalar: string): string[] | null {
  const first = scalar[0];
  if (first !== "{" && first !== "[") {
    return null;
  }
  const isMapping = first === "{";
  const close = isMapping ? "}" : "]";
  let inner = scalar.slice(1);
  if (inner.endsWith(close)) {
    inner = inner.slice(0, -1);
  }
  const names: string[] = [];
  for (const raw of inner.split(",")) {
    const part = raw.trim();
    if (part.length === 0) {
      continue;
    }
    if (isMapping) {
      const colon = part.indexOf(":");
      const key = unquote((colon === -1 ? part : part.slice(0, colon)).trim());
      if (key.length > 0) {
        names.push(key);
      }
    } else {
      const v = unquote(part);
      if (v.length > 0) {
        names.push(v);
      }
    }
  }
  return names;
}

/**
 * Extract a format name from a child line's content (indentation already
 * stripped): a block-sequence item `- html` or a mapping key `html:` /
 * `html: default`. Returns `null` for a line that is neither.
 */
function childName(content: string): string | null {
  const seq = /^-[ \t]+(.*)$/.exec(content);
  if (seq !== null) {
    const v = unquote(stripComment(seq[1]).trim());
    return v.length > 0 ? v : null;
  }
  const colon = content.indexOf(":");
  if (colon !== -1) {
    const key = unquote(content.slice(0, colon).trim());
    return key.length > 0 ? key : null;
  }
  return null;
}

/** True if `line`'s first non-whitespace character is `#` (a YAML comment). */
function isComment(line: string): boolean {
  return line.trimStart().startsWith("#");
}

/** Count leading spaces/tabs. */
function leadingWhitespace(line: string): number {
  return line.length - line.trimStart().length;
}

/**
 * Build the argv for `quarto preview <file> --no-browser [--to <format>]`.
 * `--no-browser` mirrors the plain-preview feature (the extension embeds the URL
 * in a webview, never the OS browser). An empty/whitespace `to` is omitted so
 * Quarto previews the document's own first `format:`.
 */
export function buildPreviewArgs(
  file: string,
  opts: { to?: string } = {},
): string[] {
  const args = ["preview", file, "--no-browser"];
  const to = opts.to?.trim();
  if (to) {
    args.push("--to", to);
  }
  return args;
}

/** Strip an unquoted trailing `# comment` from a YAML scalar fragment. */
function stripComment(s: string): string {
  const hash = s.indexOf("#");
  return hash === -1 ? s : s.slice(0, hash);
}

/** Remove matching surrounding single or double quotes from a scalar. */
function unquote(s: string): string {
  if (s.length >= 2) {
    const q = s[0];
    if ((q === '"' || q === "'") && s[s.length - 1] === q) {
      return s.slice(1, -1);
    }
  }
  return s;
}
