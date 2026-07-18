import { describe, expect, it } from "vitest";
import { buildNewDocumentContent } from "../../src/core/new-document";

/**
 * `buildNewDocumentContent` builds the content of a new blank Quarto
 * document: front matter (`title:`/`format: html`) with no body, ready to
 * type into. `title` is emitted as a double-quoted YAML scalar (plan
 * `docs/planning/2026-07-09-onboarding-walkthrough-plan.md` §2.4).
 */
describe("buildNewDocumentContent", () => {
  it("emits a plain title quoted verbatim, with format fixed to html", () => {
    expect(buildNewDocumentContent("My Notes")).toBe(
      '---\ntitle: "My Notes"\nformat: html\n---\n\n',
    );
  });

  it("emits the given format when one is supplied (revealjs for a presentation — item 17c)", () => {
    expect(buildNewDocumentContent("My Talk", "revealjs")).toBe(
      '---\ntitle: "My Talk"\nformat: revealjs\n---\n\n',
    );
  });

  it("falls back to \"Untitled\" for an empty title (matches Posit's own default)", () => {
    expect(buildNewDocumentContent("")).toBe(
      '---\ntitle: "Untitled"\nformat: html\n---\n\n',
    );
  });

  it("falls back to \"Untitled\" for a whitespace-only title", () => {
    expect(buildNewDocumentContent("   \t  ")).toBe(
      '---\ntitle: "Untitled"\nformat: html\n---\n\n',
    );
  });

  it("escapes embedded double-quotes and backslashes (plan §2.2/§5 D3 — untrusted input must not break YAML)", () => {
    expect(buildNewDocumentContent('She said "hi" and used C:\\path')).toBe(
      '---\ntitle: "She said \\"hi\\" and used C:\\\\path"\nformat: html\n---\n\n',
    );
  });

  it("a title containing a colon stays valid YAML (colon sits inside the double-quoted scalar, not at top level)", () => {
    const content = buildNewDocumentContent("My: Notes");
    const titleLine = content.split("\n")[1];
    expect(titleLine).toBe('title: "My: Notes"');
    // The scalar is fully quoted, so the embedded colon can't be misread as a
    // second top-level `key:` — the line has exactly one unquoted `: ` (the
    // key/value separator), immediately followed by the opening quote.
    expect(titleLine.indexOf(": ")).toBe(titleLine.indexOf('"') - 2);
  });
});
