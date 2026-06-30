/**
 * Pure, `vscode`-free map from a Quarto cell *engine* token to the VS Code
 * *language* it forwards to (architecture §3.3 — this module MUST NOT import
 * `vscode`). It mirrors the `embeddedLanguages` declaration in `package.json`
 * (`python→python`, `r→r`, `julia→julia`, `ojs→javascript`), but that grammar
 * config is TextMate-only and cannot route providers (Learning #6/#15b), so
 * Phase 6e needs this map to drive request forwarding into the user's installed
 * language extension (plan §5, G3).
 *
 * Scope grows per slice: 6e-1 maps `python` only; 6e-2 adds `r`/`julia`/`ojs`.
 * Any engine token outside the mapped set returns `null`, so the embedded
 * provider does not forward for that cell.
 */

/** The forwarding target for an embedded cell engine. */
export interface EmbeddedLang {
  /** The VS Code languageId to forward the request to, e.g. `"python"`. */
  languageId: string;
  /**
   * The virtual-document file extension (no dot), e.g. `"py"`. This is what
   * makes VS Code resolve the virtual doc's languageId, so it drives routing
   * to the embedded language's providers (plan §2.4).
   */
  ext: string;
}

/** Engine token → forwarding target. 6e-1: python. 6e-2: + r/julia/ojs. */
const LANGUAGES: Readonly<Record<string, EmbeddedLang>> = {
  python: { languageId: "python", ext: "py" },
  r: { languageId: "r", ext: "r" },
  julia: { languageId: "julia", ext: "jl" },
  // OJS (Observable JS) executes as JavaScript: the engine token is `ojs` but the
  // languageId is `javascript` (R7 / package.json embeddedLanguages) — map it, do
  // not assume identity. `js` is a defensive alias for the same target (the
  // project's option-prefix logic already pairs "ojs/js" — model.ts:170).
  ojs: { languageId: "javascript", ext: "js" },
  js: { languageId: "javascript", ext: "js" },
};

/**
 * The forwarding target for cell engine `lang`, or `null` for an engine outside
 * the mapped set (no forwarding). 6e-1 maps only `python`.
 */
export function cellLanguageId(lang: string): EmbeddedLang | null {
  return LANGUAGES[lang] ?? null;
}

/**
 * The graceful-degradation signal (plan §2.5 / §9 Q6): whether a one-time "install
 * the language extension" hint is warranted for `languageId`, given the host's
 * `registeredLanguages` (`vscode.languages.getLanguages()`). A hint is warranted
 * iff the target languageId is NOT registered — i.e. no extension can possibly
 * serve completion for those cells.
 *
 * This deliberately keys on the registered-language SET, never on an empty
 * completion result: `executeCompletionItemProvider` returns nothing both when no
 * extension is installed AND when an installed extension simply has no suggestion
 * (the common case while typing), so keying on an empty result would nag installed
 * users (§9 Q6). `javascript` is always built-in, so `{ojs}` cells never trip this.
 */
export function needsLanguageExtension(
  languageId: string,
  registeredLanguages: readonly string[],
): boolean {
  return !registeredLanguages.includes(languageId);
}
