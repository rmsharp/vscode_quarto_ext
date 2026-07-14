import { describe, expect, it } from "vitest";
import manifest from "../../package.json";
import { OUR_LEGEND } from "../../src/core/embedded/semantic-tokens";

/**
 * The `contributes.semanticTokenScopes` half of the D4 decision (BACKLOG item 16, Slice 3).
 *
 * `OUR_LEGEND` carries two foreign token names — `module` and `intrinsic` — because they are
 * the two Pylance declines to style itself (see the triage rule in `semantic-tokens.ts`). This
 * manifest entry is what makes that win SERVER-INDEPENDENT: it maps each carried name straight
 * to the TextMate scope VS Code's own built-in default rule probes for that name's superType,
 * scoped to `language: "quarto"`.
 *
 * Why it is needed at all, given the superType chain already resolves `module` when Pylance is
 * installed: VS Code's `semanticTokenScopes` handler validates SHAPE ONLY and never looks the
 * type id up in the registry, so our rule matches the BARE name with no registry involvement.
 * A python server that emits `module` but ships no `contributes.semanticTokenTypes` (basedpyright,
 * Jedi, Ruff) therefore still gets the colour. Without this entry, that server's `module` tokens
 * resolve to nothing and silently drop back to TextMate.
 *
 * Declarative JSON is TDD-exempt per `CLAUDE.md` — but the COUPLING below is not declarative, it
 * is an invariant across two files that can rot in silence, and this is the precedent set by
 * `walkthrough.test.ts` / `snippets.test.ts`.
 */

/** The standard VS Code semantic token types. Anything else in our legend is a carried name. */
const STANDARD_TYPES = [
  "namespace", "class", "enum", "interface", "struct", "typeParameter", "type",
  "parameter", "variable", "property", "enumMember", "decorator", "event",
  "function", "method", "macro", "label", "comment", "string", "keyword",
  "number", "regexp", "operator",
];

const contributed = (manifest as { contributes: Record<string, unknown> }).contributes
  .semanticTokenScopes as { language: string; scopes: Record<string, string[]> }[] | undefined;

describe("contributes.semanticTokenScopes (D4, Slice 3)", () => {
  it("is contributed, and scoped to `quarto` — a rule for any other language is inert on a .qmd", () => {
    // VS Code gates a scope rule on the MODEL's languageId. A `.qmd` model is `quarto`, which is
    // precisely why Pylance's own `"language": "python"` rules cannot colour one token of ours —
    // and why ours must say `quarto` and not, say, `python`.
    expect(contributed).toBeDefined();
    expect(contributed).toHaveLength(1);
    expect(contributed?.[0].language).toBe("quarto");
  });

  it("maps EXACTLY the foreign names OUR_LEGEND carries — no dead rules, no unstyled carries", () => {
    // 🔑 The invariant that can rot silently, in either direction:
    //
    //   - a carried name with NO scope rule degrades to superType-only, so it works ONLY while a
    //     server that registers the superType is installed — the bug this entry exists to prevent;
    //   - a scope rule for a name NOT in the legend is dead code that no test would ever catch,
    //     because it simply never matches anything.
    //
    // Both are invisible at runtime. Pin the two sets equal.
    const carried = OUR_LEGEND.tokenTypes.filter((t) => !STANDARD_TYPES.includes(t));
    const styled = Object.keys(contributed?.[0].scopes ?? {});

    expect([...carried].sort()).toEqual([...styled].sort());
    expect(carried).toEqual(["module", "intrinsic"]);
  });

  it("probes the SAME TextMate scope VS Code's own built-in rule uses for each superType", () => {
    // Read firsthand out of the shipped bundle (v1.126.0):
    //   i("namespace", …, [["entity.name.namespace"]])
    //   i("operator",  …, [["keyword.operator"]])
    // Using the same probes means our rule resolves to byte-identically the colour a real `.py`
    // gets, in whatever theme the user has — rather than inventing a colour of our own.
    expect(contributed?.[0].scopes.module).toEqual(["entity.name.namespace"]);
    expect(contributed?.[0].scopes.intrinsic).toEqual(["keyword.operator"]);
  });

  it("does NOT contribute semanticTokenTypes — that registry is global and owner-blind", () => {
    // Deliberate, and the reason is a footgun worth pinning: VS Code's token-TYPE registry is one
    // flat map keyed by bare id (`tokenTypeById[id] = …`, last-writer-wins) and its deregistration
    // (`deregisterTokenType(id) { delete this.tokenTypeById[id] }`) is owner-blind and un-refcounted.
    // If we declared Pylance's ids, OUR uninstall would delete PYLANCE's registration — degrading
    // the colours in the user's plain `.py` files, which have nothing to do with this extension.
    const contributes = (manifest as { contributes: Record<string, unknown> }).contributes;
    expect(contributes.semanticTokenTypes).toBeUndefined();
  });
});
