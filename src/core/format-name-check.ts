/**
 * Pure, `vscode`-free validation of a top-level output-format NAME (the scalar
 * `format: <name>` in a `.qmd`, format-name validation plan §3.1 A). A faithful
 * mirror of `quarto render` 1.7.33's FRONT-MATTER SCHEMA validator
 * `makeFrontMatterFormatSchema` (quarto.js:16697-16748) — NOT the differently-
 * permissive render-dispatch `parseFormatString` (§2.1 / dragon #1).
 *
 * FALSE-NEGATIVE ONLY (the hard product rule): never flag a format name Quarto's
 * schema layer accepts. The predicate returns `true` (KNOWN → do not flag) for
 * anything the schema `anyOf` union admits; the feature flags only when it returns
 * `false` AND the reader's built-in set is known-complete (`formatNamesForValidation()
 * !== null`, the online-only gate — plan §3.1 B / dragon #3).
 */

/**
 * Escape a built-in name for use as a regex literal. A no-op for today's names
 * (all `[a-z0-9_]`), but guards against a future built-in carrying a regex
 * metacharacter so it is matched LITERALLY rather than as a pattern.
 */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whether `name` is a format Quarto's front-matter SCHEMA layer accepts — a
 * faithful mirror of `makeFrontMatterFormatSchema`'s `anyOf` union: a custom
 * `.lua` writer, OR a built-in `b` optionally wrapped by an `<ext>-` prefix
 * and/or a `[-+]<modifier>` suffix (both optional and combinable). `builtIn` is
 * the RAW built-in set from `SchemaIndex.formatNamesForValidation()` (unfiltered
 * — it INCLUDES the hidden legacy variants html4/html5/…; plan §2.2 dragon). Pure;
 * never throws.
 */
export function isKnownFormatName(name: string, builtIn: ReadonlySet<string>): boolean {
  if (/^.+\.lua$/.test(name)) {
    return true; // custom Lua pandoc writer (^.+\.lua$)
  }
  for (const b of builtIn) {
    // <ext>- prefix (optional) + the built-in b + [-+]<modifier> suffix (optional).
    if (new RegExp(`^(.+-)?${escapeRegExp(b)}([-+].+)?$`).test(name)) {
      return true;
    }
  }
  return false;
}

/** The diagnostic message for an unrecognized output format. */
export function formatNameMessage(name: string): string {
  return `Unknown output format ${name}.`; // NOT quarto's unhelpful "must instead be 'ansi'"
}
