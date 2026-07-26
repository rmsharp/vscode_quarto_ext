import { describe, expect, it } from "vitest";
import { documentEngineForScoping } from "../../src/core/document-engine";
import { findFrontMatterTopLevelLines } from "../../src/core/yaml-frontmatter-values";
import { findNestedFrontMatterValueLines } from "../../src/core/yaml-frontmatter-nested-values";
import { frontMatterContentLines } from "../../src/core/qmd/model";

/**
 * Drive the resolver the way the feature does — from the real enumerators over a real
 * document — so a pin cannot pass against a hand-built input shape the enumerators
 * never actually produce.
 */
const resolve = (text: string, fileName = "doc.qmd") =>
  documentEngineForScoping(
    fileName,
    findFrontMatterTopLevelLines(text),
    findNestedFrontMatterValueLines(text),
    frontMatterContentLines(text),
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

  it("selects on the CONTAINER form too — a mapping is a truthy node", () => {
    // `jupyter:` carrying a kernelspec block is the other everyday spelling of the alias,
    // and quarto's `if (yaml["jupyter"])` is just as true for a mapping as for a string.
    // Measured: `jupyter:` / `  kernelspec:` / `    name: python3` … + `{r}` +
    // `#| cache: banana` renders **exit 0**, against the no-key control at exit 1.
    // Missing this form is not a harmless gap — it leaves an {r} cell in a jupyter
    // document scoped to knitr, which is the very false positive this session removes.
    expect(
      resolve(doc("jupyter:\n  kernelspec:\n    name: python3\n    language: python\n")),
    ).toBe("jupyter");
    expect(resolve(doc("markdown:\n  wrap: none\n"))).toBe("markdown");
    // Measured: `knitr:` / `  opts_chunk:` / `    collapse: true` + `{python}` +
    // `#| cache: banana` renders exit 1 — the container form selects knitr as well.
    expect(resolve(doc("knitr:\n  opts_chunk:\n    collapse: true\n"))).toBe("knitr");
  });

  it("does NOT mistake an indented PLAIN SCALAR body for a mapping — it may parse FALSY", () => {
    // Found by the S164 §9 review and re-measured firsthand. `knitr:` + an indented `false`
    // is not a block at all: it is the multi-line plain scalar `knitr: false`, so quarto's
    // `if (yaml["knitr"])` is FALSE and knitr is NOT selected. Measured with a {python} cell
    // carrying `#| cache: banana` — **exit 0** — against the engine-AGNOSTIC control on the
    // same front matter (`#| echo: banana`, exit 1) proving validation really ran, and
    // against `knitr:` + indented `true`, which renders exit 1 because knitr IS selected there.
    // Claiming knitr here widened every cell to knitr's 43 fields and squiggled a document
    // quarto ACCEPTS — the cardinal sin, in the one direction this module must never get
    // wrong. Blank- and comment-skipping widened the same hole (both measured exit 0).
    expect(resolve(doc("knitr:\n  false\n"))).toBeUndefined();
    expect(resolve(doc("knitr:\n\n  false\n"))).toBeUndefined();
    expect(resolve(doc("knitr: # off\n  false\n"))).toBeUndefined();
    // Same shape on a narrowing engine: `markdown:` + indented `false` renders exit 1 with an
    // {r} cell, i.e. quarto did NOT select markdown either.
    expect(resolve(doc("markdown:\n  false\n"))).toBeUndefined();
  });

  it("still selects on a real mapping or sequence body — the L5 capability is intact", () => {
    expect(resolve(doc("knitr:\n  opts_chunk:\n    collapse: true\n"))).toBe("knitr");
    expect(resolve(doc("jupyter:\n  kernelspec:\n    name: python3\n"))).toBe("jupyter");
    // A block SEQUENCE body is truthy too — measured, `jupyter:` + `  - a` selects jupyter
    // (it fails later inside the jupyter engine's own kernelspec check, which only runs once
    // that engine has been chosen).
    expect(resolve(doc("jupyter:\n  - a\n"))).toBe("jupyter");
  });

  it("does NOT select on a BLOCK-SCALAR indicator — an empty block scalar is the empty string", () => {
    // Measured: `jupyter: |` with no body + an {r} cell + `#| cache: banana` renders exit 1,
    // i.e. jupyter was NOT selected — the folded value is "" and quarto's truthiness test
    // fails. Reading `|` as an ordinary truthy token cost a true positive.
    expect(resolve(doc("jupyter: |\n"))).toBeUndefined();
    expect(resolve(doc("jupyter: >\n"))).toBeUndefined();
  });

  it("does NOT select on a NODE-PROPERTY token — quarto tests the PARSED node, which may be falsy", () => {
    // Found by the S164 §9 review and re-measured firsthand with a {python} cell carrying
    // `#| cache: banana`: `knitr: !!bool false`, `knitr: &a false`, and an alias
    // `x: &a false` + `knitr: *a` ALL render **exit 0** — quarto resolved each to boolean
    // false and did not select knitr — against the engine-agnostic control on the same front
    // matter at exit 1. Comparing the RAW token read every one of them as truthy and claimed
    // knitr, squiggling documents quarto accepts. The module header claimed node properties
    // "can never manufacture" a wrong claim; that was true of the `engine:` NAME comparison
    // and false here, where the test is truthiness rather than equality.
    for (const value of ["!!bool false", "&a false", "*a", "!!str false"]) {
      expect(resolve(doc(`knitr: ${value}\n`)), value).toBeUndefined();
    }
    // The cost is a true positive when the tagged node is TRUTHY — `knitr: !!bool true`
    // renders exit 1, i.e. knitr really is selected there and we now stay silent. FP-safe.
    expect(resolve(doc("knitr: !!bool true\n"))).toBeUndefined();
  });

  it("DOES select on a quoted falsy-looking string — the parsed value is a truthy string", () => {
    // The deliberate inversion, now pinned. Measured: `jupyter: "false"` and `jupyter: 'false'`
    // both render exit 1 with `Jupyter kernel 'false' not found` — an error only the JUPYTER
    // engine raises, so jupyter was selected and the quoted scalar is truthy. Adding `"false"`
    // to the falsy table would silently break this.
    expect(resolve(doc('jupyter: "false"\n'))).toBe("jupyter");
    expect(resolve(doc("jupyter: 'false'\n"))).toBe("jupyter");
  });

  it("skips a BLANK line between an engine-named key and its mapping body", () => {
    // Measured: `jupyter:` + a blank line + an indented `kernelspec:` block renders exit 1
    // with `Invalid Jupyter kernelspec` — again a jupyter-engine-only error, so the blank
    // line did not end the mapping and jupyter was selected. This pins the blank half of the
    // skip positively; the falsy-scalar tests above only pin it negatively.
    expect(resolve(doc("jupyter:\n\n  kernelspec:\n    name: python3\n"))).toBe("jupyter");
  });

  it("does NOT mistake a comment-only block for children — that node is still null", () => {
    // A comment is not content, so `jupyter:` here is null and quarto renders the same
    // document exit 1. Reading it as a mapping would claim an engine nothing selected.
    expect(resolve(doc("jupyter:\n  # nothing yet\n"))).toBeUndefined();
    expect(resolve(doc("jupyter:\n\ntoc: true\n"))).toBeUndefined();
  });
});

describe("Session 164 — documentEngineForScoping: quarto's ENGINE partitioner is stricter", () => {
  // Quarto uses TWO front-matter partitioners. Validation goes through `breakQuartoMd`, which
  // only needs the block to open and close with `---`. ENGINE selection goes through
  // `partitionYamlFrontMatter`, which ALSO returns null when the first content line is blank
  // or is itself a fence:
  //
  //   if (mdLines.length < 3 || !mdLines[0].match(kRegExBeginYAML)) return null;
  //   else if (mdLines[1].trim().length === 0 || mdLines[1].match(kRegExEndYAML)) return null;
  //
  // so on such a document quarto resolves NO engine from the front matter and falls back to
  // the cell languages. Found by the S164 §9 review; measured firsthand.
  it("declines when the first front-matter content line is BLANK", () => {
    // `---` / blank / `knitr: true` / `---` + a {python} cell with `#| cache: banana` renders
    // **exit 0** — knitr was never selected — while the same front matter with `#| echo:
    // banana` renders exit 1, proving cell validation really ran, and the identical document
    // WITHOUT the blank line renders exit 1 (knitr genuinely selected). Reading the block here
    // widened every cell to knitr's 43 fields and squiggled a document quarto ACCEPTS.
    expect(resolve("---\n\nknitr: true\n---\n\ntext\n")).toBeUndefined();
    expect(resolve("---\n\nengine: knitr\n---\n\ntext\n")).toBeUndefined();
    expect(resolve("---\n\nknitr:\n  opts_chunk:\n    echo: false\n---\n\ntext\n")).toBeUndefined();
    // The control: the SAME front matter without the leading blank line does select.
    expect(resolve("---\nknitr: true\n---\n\ntext\n")).toBe("knitr");
  });

  it("still resolves normally for an ordinary front matter", () => {
    expect(resolve(doc("engine: markdown\n"))).toBe("markdown");
  });
});

describe("Session 164 — documentEngineForScoping: an UNREADABLE competing selector", () => {
  // `metadataAsFormat` ASSIGNS into `format.execute.engine` while walking `Object.keys`, so a
  // later `execute.engine` OVERWRITES an earlier top-level `engine:` — including when its own
  // value names no engine at all, in which case quarto ends up selecting NOTHING and falls
  // back to the cell languages. If we can read the first spelling but not the second, the set
  // we see has one member and we would answer with full confidence. Found by the §9 review.
  it("returns `ambiguous` when a resolved selector is joined by one we cannot read", () => {
    // All three render **exit 0** with a {python} cell's `#| cache: banana` (control with
    // `#| echo: banana`: exit 1, so validation ran; control `engine: knitr` alone: exit 1).
    // A mere CASE TYPO in the second spelling is enough to trigger it.
    expect(resolve(doc("engine: knitr\nexecute:\n  engine: Knitr\n"))).toBe("ambiguous");
    expect(resolve(doc("engine: knitr\nexecute:\n  engine: banana\n"))).toBe("ambiguous");
    expect(resolve(doc("engine: knitr\nexecute: {engine: markdown}\n"))).toBe("ambiguous");
  });

  it("does NOT manufacture ambiguity when NOTHING resolved", () => {
    // `execute:` / `  engine: banana` alone renders exit 0 with a {python} cell — quarto fell
    // back to the language, which is exactly what `undefined` makes us do. Forcing
    // "ambiguous" here would be a needless narrowing, and `engine: banana` alone with an {r}
    // cell renders exit 1, which only the language fallback gets right.
    expect(resolve(doc("execute:\n  engine: banana\n"))).toBeUndefined();
    expect(resolve(doc("engine: banana\n"))).toBeUndefined();
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
    expect(resolve(doc("jupyter: python3\nknitr:\n  opts_chunk:\n    collapse: true\n"))).toBe(
      "ambiguous",
    );
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
