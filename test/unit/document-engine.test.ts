import { describe, expect, it } from "vitest";
import { documentEngineForScoping } from "../../src/core/document-engine";
import { findFrontMatterValueLines } from "../../src/core/yaml-frontmatter-values";
import { findNestedFrontMatterValueLines } from "../../src/core/yaml-frontmatter-nested-values";

/**
 * Drive the resolver the way the feature does — from the real enumerators over a real
 * document — so a pin cannot pass against a hand-built input shape the enumerators
 * never actually produce.
 */
const resolve = (text: string, fileName = "doc.qmd") =>
  documentEngineForScoping(
    fileName,
    findFrontMatterValueLines(text),
    findNestedFrontMatterValueLines(text),
  );

const doc = (fm: string) => `---\ntitle: t\n${fm}---\n\n\`\`\`{r}\n#| cache: banana\n1 + 1\n\`\`\`\n`;

describe("Session 164 — documentEngineForScoping: the top-level `engine:` scalar", () => {
  it("resolves each of quarto's four engine names", () => {
    expect(resolve(doc("engine: markdown\n"))).toBe("markdown");
    expect(resolve(doc("engine: knitr\n"))).toBe("knitr");
    expect(resolve(doc("engine: jupyter\n"))).toBe("jupyter");
    expect(resolve(doc("engine: julia\n"))).toBe("julia");
  });

  it("is undefined when the front matter names no engine at all", () => {
    expect(resolve(doc(""))).toBeUndefined();
    expect(resolve("no front matter here\n")).toBeUndefined();
  });

  it("accepts a QUOTED engine name — quarto compares the parsed scalar", () => {
    // `engine: "markdown"` and `engine: 'markdown'` both render exit 0 on a document
    // whose `{r}` cell carries `#| cache: banana` — measured firsthand vs 1.7.33.
    expect(resolve(doc('engine: "markdown"\n'))).toBe("markdown");
    expect(resolve(doc("engine: 'markdown'\n"))).toBe("markdown");
  });

  it("is CASE-SENSITIVE in both the key and the value, exactly as quarto is", () => {
    // `engine: MARKDOWN` compares `format.execute.engine === "markdown"` and misses, so
    // quarto falls through to language resolution and renders the same document exit 1;
    // `Engine:` is not a recognized key at all. Folding either would silence a document
    // quarto really does validate.
    expect(resolve(doc("engine: MARKDOWN\n"))).toBeUndefined();
    expect(resolve(doc("engine: Markdown\n"))).toBeUndefined();
    expect(resolve(doc("Engine: markdown\n"))).toBeUndefined();
  });

  it("ignores an engine name quarto does not know", () => {
    // `engine: banana` is NOT itself a front-matter schema error (the control
    // `engine: banana` + `#| cache: true` renders exit 0), and quarto falls through to
    // language resolution — so the same document with `#| cache: banana` renders exit 1.
    expect(resolve(doc("engine: banana\n"))).toBeUndefined();
  });
});

describe("Session 164 — documentEngineForScoping: the nested `execute: engine:` spelling", () => {
  it("resolves `execute:` / `  engine: <name>`", () => {
    // Measured: `execute:` / `  engine: markdown` + `{r}` + `#| cache: banana` → exit 0,
    // and `execute:` / `  engine: knitr` + `{python}` + `#| cache: banana` → exit 1.
    // Quarto folds a top-level `engine:` into `format.execute.engine` (`metadataAsFormat`,
    // `kEngine` ∈ `kExecuteDefaultsKeys`), so the two spellings are the same key.
    expect(resolve(doc("execute:\n  engine: markdown\n"))).toBe("markdown");
    expect(resolve(doc("execute:\n  engine: knitr\n"))).toBe("knitr");
  });

  it("does NOT read an `engine:` nested anywhere else", () => {
    // `format:` / `  html:` / `    engine: markdown` + `{r}` + `#| cache: banana` renders
    // exit 1 — engine resolution reads the RAW top-level front matter (plus `execute:`),
    // never per-format metadata. Reading it there would silence a validated document.
    expect(resolve(doc("format:\n  html:\n    engine: markdown\n"))).toBeUndefined();
  });
});

describe("Session 164 — documentEngineForScoping: the ENGINE-NAMED top-level key", () => {
  // Quarto's loop tests `yaml[engine.name]` for TRUTHINESS before it tests
  // `format.execute.engine`, so a top-level `jupyter:`/`knitr:`/`markdown:`/`julia:` key
  // is itself an engine selector. `jupyter: python3` is the common real-world spelling.
  it("treats a truthy engine-named key as selecting that engine", () => {
    // Measured: `jupyter: python3` + `{r}` + `#| cache: banana` → exit 0 (the knitr-only
    // `cache` is not in jupyter's schema), against the no-key control at exit 1.
    expect(resolve(doc("jupyter: python3\n"))).toBe("jupyter");
    expect(resolve(doc("markdown: true\n"))).toBe("markdown");
    expect(resolve(doc("jupyter: true\n"))).toBe("jupyter");
  });

  it("does NOT select on a FALSY value — quarto tests JS truthiness of the parsed node", () => {
    // Every one of these renders the same document exit 1, i.e. quarto fell through to
    // language resolution and used knitr — measured firsthand vs 1.7.33, one render each.
    for (const value of ["false", "False", "FALSE", "null", "Null", "NULL", "~", "0", "''", '""']) {
      expect(resolve(doc(`jupyter: ${value}\n`)), value).toBeUndefined();
    }
  });

  it("does NOT select on a bare key with no value — that node is null", () => {
    // `jupyter:` alone renders exit 1 (and is itself a front-matter schema error).
    expect(resolve(doc("jupyter:\n"))).toBeUndefined();
    expect(resolve(doc("markdown:\n"))).toBeUndefined();
  });

  it("is not fooled by a NESTED key that merely shares the name", () => {
    expect(resolve(doc("execute:\n  jupyter: python3\n"))).toBeUndefined();
  });
});

describe("Session 164 — documentEngineForScoping: two selectors that DISAGREE", () => {
  // Quarto's answer here is genuinely order-dependent — measured firsthand, the SAME two
  // keys in the opposite order give opposite results:
  //   `engine: markdown` then `execute:`/`  engine: knitr` → exit 1 (knitr won)
  //   `execute:`/`  engine: knitr` then `engine: markdown` → exit 0 (markdown won)
  // and a project-level `engines: [jupyter, knitr]` reorders the selector loop on top of
  // that (measured: flips the same document from exit 0 to exit 1). We read neither the
  // key order's effect on `metadataAsFormat` nor `_quarto.yml`, so we decline to guess.
  it("returns `ambiguous` when the front matter selects more than one engine", () => {
    expect(resolve(doc("engine: markdown\nexecute:\n  engine: knitr\n"))).toBe("ambiguous");
    expect(resolve(doc("engine: jupyter\nmarkdown: true\n"))).toBe("ambiguous");
  });

  it("does NOT call the SAME engine named twice ambiguous", () => {
    // No reorder and no key order can change a set with one member.
    expect(resolve(doc("engine: jupyter\njupyter: python3\n"))).toBe("jupyter");
    expect(resolve(doc("engine: knitr\nexecute:\n  engine: knitr\n"))).toBe("knitr");
  });
});

describe("Session 164 — documentEngineForScoping: the FILE EXTENSION claims first", () => {
  // `fileExecutionEngine` runs `engine.claimsFile(file, ext)` over every engine BEFORE it
  // ever partitions the front matter, and knitr claims `kRmdExtensions = [".rmd",
  // ".rmarkdown"]` (compared lowercased). Our `quarto` languageId opens .qmd, .rmd AND
  // .Rmd, so on the R-Markdown extensions the override below is dead text. Measured: each
  // of these renders exit 1 — quarto validated against knitr anyway — while the identical
  // document named .qmd renders exit 0.
  it("ignores every front-matter override on an R-Markdown extension", () => {
    for (const name of ["doc.Rmd", "doc.rmd", "doc.RMD", "/a/b/doc.rmarkdown"]) {
      expect(resolve(doc("engine: markdown\n"), name), name).toBeUndefined();
      expect(resolve(doc("jupyter: python3\n"), name), name).toBeUndefined();
      expect(resolve(doc("execute:\n  engine: jupyter\n"), name), name).toBeUndefined();
    }
  });

  it("still honours the override on .qmd and on an unsaved/extensionless document", () => {
    expect(resolve(doc("engine: markdown\n"), "doc.qmd")).toBe("markdown");
    expect(resolve(doc("engine: markdown\n"), "/a/b/doc.QMD")).toBe("markdown");
    expect(resolve(doc("engine: markdown\n"), "Untitled-1")).toBe("markdown");
    // A name that merely CONTAINS the extension is not that extension.
    expect(resolve(doc("engine: markdown\n"), "doc.rmd.qmd")).toBe("markdown");
    expect(resolve(doc("engine: markdown\n"), "my.rmd.notes.qmd")).toBe("markdown");
  });
});
