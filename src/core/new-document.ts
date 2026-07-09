/**
 * Pure, `vscode`-free content builder for `quarto.newDocument`
 * (plan `docs/planning/2026-07-09-onboarding-walkthrough-plan.md` §2).
 *
 * Zero CLI involvement (Finding 1 — no `quarto create document` CLI feature
 * exists in 1.7.33). Lives in `core/` and MUST NOT import `vscode`
 * (architecture plan §3.3).
 */

/**
 * Build the content of a new blank Quarto document. `title` is trimmed; an
 * empty/whitespace-only title becomes "Untitled" (matches Posit's own fixed
 * default). The title is emitted as a double-quoted YAML scalar with `"`/`\`
 * escaped — untrusted user input must not corrupt the front matter for any
 * title text. Format is fixed to `html` for v1 (no format picker).
 */
export function buildNewDocumentContent(title: string): string {
  const trimmed = title.trim();
  const safe = trimmed.length > 0 ? trimmed : "Untitled";
  return `---\ntitle: "${escapeYamlDoubleQuoted(safe)}"\nformat: html\n---\n\n`;
}

/**
 * Escape a string for embedding in a double-quoted YAML scalar: backslash
 * first (so an already-escaped `\"` isn't double-escaped), then the quote
 * character itself.
 */
function escapeYamlDoubleQuoted(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
