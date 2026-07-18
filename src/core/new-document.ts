/**
 * Pure, `vscode`-free content builder for `quarto.newDocument`
 * (plan `docs/planning/2026-07-09-onboarding-walkthrough-plan.md` §2).
 *
 * Zero CLI involvement (Finding 1 — no `quarto create document` CLI feature
 * exists in 1.7.33). Lives in `core/` and MUST NOT import `vscode`
 * (architecture plan §3.3).
 */

/**
 * The document formats the new-document command family can preset. `html` is
 * the plain-document default (`quarto.newDocument` / `quarto.fileNewDocument`);
 * `revealjs` is the presentation preset (`quarto.newPresentation`, item 17c).
 * A closed union, not a free string: `format` is a trusted internal preset,
 * never user input, so it needs no YAML escaping.
 */
export type NewDocumentFormat = "html" | "revealjs";

/**
 * Build the content of a new blank Quarto document. `title` is trimmed; an
 * empty/whitespace-only title becomes "Untitled" (matches Posit's own fixed
 * default). The title is emitted as a double-quoted YAML scalar with `"`/`\`
 * escaped — untrusted user input must not corrupt the front matter for any
 * title text. `format` defaults to `html` (the plain-document preset), so
 * every existing single-argument caller is unchanged; `quarto.newPresentation`
 * passes `revealjs` (item 17c).
 */
export function buildNewDocumentContent(
  title: string,
  format: NewDocumentFormat = "html",
): string {
  const trimmed = title.trim();
  const safe = trimmed.length > 0 ? trimmed : "Untitled";
  return `---\ntitle: "${escapeYamlDoubleQuoted(safe)}"\nformat: ${format}\n---\n\n`;
}

/**
 * Escape a string for embedding in a double-quoted YAML scalar: backslash
 * first (so an already-escaped `\"` isn't double-escaped), then the quote
 * character itself.
 */
function escapeYamlDoubleQuoted(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
