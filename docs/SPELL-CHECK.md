# Spell Checking

*Last reviewed: 2026-07-10 (Session 65). Recipe empirically validated against a real `cspell` CLI run
(v10.0.1) — see [Verification](#verification) below.*

This extension does not ship its own spell checker. Instead, this page gives you a ready-made
configuration recipe that scopes the popular third-party
[`streetsidesoftware.code-spell-checker`](https://marketplace.visualstudio.com/items?itemName=streetsidesoftware.code-spell-checker)
extension ("cspell") to `.qmd` prose — so it stops flagging YAML keys, code-cell identifiers, math, and
cross-reference tokens as misspellings, and checks only the text you actually wrote.

## Why not build our own spell checker?

Spell checking itself is a solved problem — `cspell` already does it well, and many users have it
installed for other file types already. What's missing is *scoping*: pointed at a `.qmd` file with no
configuration, cspell checks everything as plain prose, including your YAML front matter, Python/R
variable names, LaTeX math, and citation keys. This page closes that gap with an eight-line config
addition, not a new engine.

## Setup

1. Install the [**Code Spell Checker**](https://marketplace.visualstudio.com/items?itemName=streetsidesoftware.code-spell-checker)
   extension (`streetsidesoftware.code-spell-checker`).
2. Add the following to your project's `.vscode/settings.json` (recommended — it's team-shareable and
   version-controlled alongside your `.qmd` files; see [Scope: workspace vs. user](#scope-workspace-vs-user)
   below for the alternative):

   ```jsonc
   // cSpell settings — add to .vscode/settings.json (or your user settings.json).
   // Requires the "streetsidesoftware.code-spell-checker" extension.
   {
     // cSpell checks any languageId by default (cSpell.enabledFileTypes' own
     // "*": true default) — no explicit "enable quarto" step is normally
     // needed. If you've customized cSpell.enabledFileTypes and removed the
     // wildcard, add "quarto": true to it explicitly.

     // Scope checking to Quarto's prose regions only.
     "cSpell.languageSettings": [
       {
         "languageId": "quarto",
         "ignoreRegExpList": [
           "/^---\\r?\\n[\\s\\S]*?\\r?\\n---\\s*$/m",       // YAML front matter
           "/^\\s*(`{3,}|~{3,})[\\s\\S]*?^\\s*\\1\\s*$/gm", // any fenced block (code cells + #|///| options)
           "/`[^`\\r\\n]+`/g",                              // inline code spans
           "/<!--[\\s\\S]*?-->/g",                           // HTML comments
           "/\\$\\$[\\s\\S]*?\\$\\$/g",                      // display math
           "/\\$[^$\\r\\n]+\\$/g",                           // inline math
           "/\\{[^}\\r\\n]*\\}/g",                           // Pandoc attribute blocks ({#fig-x}, {.class}, {r})
           "/@[a-zA-Z][\\w-]*/g"                             // cross-ref / citation tokens (@fig-x, @smith2020)
         ]
       }
     ]
   }
   ```

3. Open (or reload) a `.qmd` file — spell-check squiggles now appear only in prose, headings, and
   front-matter text values, not in code, YAML keys, math, or cross-reference/citation tokens.

## What this recipe skips, and why

| Region | Example | Skipped because |
|---|---|---|
| YAML front matter | `title: "My Analyis"` block | Whole block excluded — keys aren't prose, and splitting keys from values reliably needs more than a regex can do safely (see [Known limitations](#known-limitations)) |
| Fenced code (any fence, any language) | ` ```{python}` … ` ``` `, incl. `#\|`/`//\|` cell options | Variable names, string literals, and option keys aren't English prose |
| Inline code spans | `` `df.head()` `` | Same reason, inline form |
| HTML comments | `<!-- TODO -->` | Editorial notes in arbitrary shorthand, not prose |
| Math | `$x^2$`, `$$\int f(x)\,dx$$` | LaTeX math syntax isn't English |
| Pandoc attribute blocks | `{#fig-result}`, `{.callout-note}` | Structural markup, not prose |
| Cross-reference / citation tokens | `@fig-result`, `@smith2020` | Identifiers, not prose |

## License

The underlying `cspell`/`cspell-lib` engine library is **MIT**. The **published VS Code extension**
(`streetsidesoftware.code-spell-checker`) is **GPL-3.0-or-later**. This project only *recommends* the
extension for you to install yourself — the same pattern already used for the Jupyter/R/Julia
code-execution extensions this project delegates to (see the [README](../README.md#requirements)) — no
cspell code is vendored, bundled, or combined with this MIT-licensed project's own source.

## Known limitations

1. **Regex-based, not AST-based.** The recipe scopes checking with regular expressions over raw text,
   the same mechanism `cspell` uses everywhere (it has no way to plug into this extension's own
   TypeScript parser, and no TextMate-grammar-scope-based checking mode exists in `cspell` today). Like
   any regex-based approach, pathological input (e.g. a fence-like sequence inside something that isn't
   really a fence) could in principle confuse it — the same risk class this project's own region
   classifier already carries.
2. **A customized `cSpell.enabledFileTypes` can disable this entirely.** If you've already overridden
   `cSpell.enabledFileTypes` and removed its `"*": true` wildcard default, `.qmd` files won't be checked
   at all until you add `"quarto": true` back. Most users never touch this setting, so this rarely
   applies.
3. **Front-matter values are excluded along with keys.** A typo in a `title:`/`abstract:`/`description:`
   value (genuinely prose-like text) is not caught, because the recipe skips the whole front-matter
   block rather than splitting keys from values. This is a deliberate trade-off for robustness — see
   `docs/planning/2026-07-10-spell-checking-plan.md` §0.4/§4 for the finer-grained alternative this
   recipe chose not to take.
4. **No bundled dictionary.** Legitimate technical jargon in prose — package names, statistical terms —
   will still be flagged unless you add it to your own [`cSpell.words`](https://cspell.org/configuration/)
   list. This is intentional; a curated jargon dictionary is a separate, open-ended maintenance burden
   this project doesn't take on.
5. **Editor-only.** This recipe affects VS Code's live editing experience only. It has no effect on
   `quarto render`, CI, or any other editor.
6. **This extension's own `.qmd` grammar is unaffected.** The recipe is pure `settings.json`
   configuration for a separate, user-installed extension — it changes nothing about this project's own
   syntax highlighting, completion, or diagnostics.

## Scope: workspace vs. user

The recipe above works identically whether it's in a project's `.vscode/settings.json` (shown above —
recommended, since it travels with the project and is shared across a team) or your personal, global
user `settings.json` (applies to every `.qmd` file you open, on this machine only). Use whichever fits
how you work; there's no functional difference.

## Verification

This recipe was validated by running the real `cspell` CLI (`npx cspell@10.0.1`) against a constructed
`.qmd` fixture exercising every region above. With no recipe: 18 issues flagged, only 6 of which were
genuine typos. With this recipe applied: 0 false positives, all 6 genuine typos still caught — including
a sanity check confirming a real typo immediately adjacent to a citation token is still caught, not
accidentally suppressed. Full grounding, prior-art research, and the disclosed trade-offs behind this
recipe's design are in `docs/planning/2026-07-10-spell-checking-plan.md`.
