import { describe, expect, it } from "vitest";
import { documentEngineForScoping } from "../../src/core/document-engine";
import { findFrontMatterTopLevelLines } from "../../src/core/yaml-frontmatter-values";
import { findNestedFrontMatterValueLines } from "../../src/core/yaml-frontmatter-nested-values";
import { frontMatterContentLines } from "../../src/core/qmd/model";

/**
 * Drive the DECISION from the real enumerators over a real document, so a pin cannot pass
 * against a hand-built input shape the enumerators never actually produce.
 *
 * ⚠ **This is deliberately NOT byte-for-byte what the feature does, since S171.** The
 * shipped entry point is `resolveDocumentEngine`, which `trimStart()`s the text before
 * deriving these four arguments — quarto's engine partitioner is `lines(markdown.trimLeft())`.
 * This helper passes the text through untouched, which is what keeps the leading-whitespace
 * guard below reachable and testable at the decision level. For what the product answers on
 * those documents, see `test/unit/document-engine-resolve.test.ts`.
 */
const resolve = (text: string, fileName = "doc.qmd") =>
  documentEngineForScoping(
    fileName,
    findFrontMatterTopLevelLines(text),
    findNestedFrontMatterValueLines(text),
    frontMatterContentLines(text),
    text,
  );

const doc = (fm: string) => `---\ntitle: t\n${fm}---\n\n\`\`\`{r}\n#| cache: banana\n1 + 1\n\`\`\`\n`;

/**
 * The same document with a `{python}` cell instead of an `{r}` one — so its LANGUAGE
 * fallback is jupyter rather than knitr (S165).
 *
 * Every pin whose point is "the front matter does NOT select knitr" must use this one.
 * With `doc()` the language fallback answers knitr anyway, so such a pin would pass just
 * as happily against a build that wrongly SELECTED knitr — the vacuous-pin habit this
 * project keeps catching. It is also how those cases were measured in the first place:
 * S164's own comments record `{python}` cells for the falsy and node-property probes.
 */
const pyDoc = (fm: string) =>
  `---\ntitle: t\n${fm}---\n\n\`\`\`{python}\n#| cache: banana\n1 + 1\n\`\`\`\n`;

describe("Session 164 — documentEngineForScoping: the top-level `engine:` scalar", () => {
  it("resolves each of quarto's four engine names", () => {
    expect(resolve(doc("engine: markdown\n"))).toBe("markdown");
    // S165 §9: the knitr rows use `pyDoc`. On an `{r}` document the LANGUAGE fallback answers
    // knitr too, so a build that failed to read the override entirely would still pass — the
    // pyDoc rule applied in only one direction (the review's test-quality lens).
    expect(resolve(pyDoc("engine: knitr\n"))).toBe("knitr");
    expect(resolve(doc("engine: jupyter\n"))).toBe("jupyter");
    expect(resolve(doc("engine: julia\n"))).toBe("julia");
  });

  it("falls back to the cell LANGUAGES when the front matter names no engine at all", () => {
    // S165: this pin read `undefined` until the language fallback existed. Both answers are
    // measured — `{r}` + `#| cache: banana` renders exit 1 (knitr), and a document with no
    // cell fences at all is `markdownEngine` by quarto's final `return`.
    expect(resolve(doc(""))).toBe("knitr");
    expect(resolve("no front matter here\n")).toBe("markdown");
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
    // S165 L2: the fall-through is now MODELLED, so the expected value is the language answer
    // (`knitr`, from the `{r}` cell) rather than `undefined` — measured, `engine: MARKDOWN` +
    // `#| cache: banana` renders exit 1. The pin still discriminates: a build that folded the
    // case would answer `markdown`.
    expect(resolve(doc("engine: MARKDOWN\n"))).toBe("knitr");
    expect(resolve(doc("engine: Markdown\n"))).toBe("knitr");
    expect(resolve(doc("Engine: markdown\n"))).toBe("knitr");
  });

  it("ignores an engine name quarto does not know", () => {
    // `engine: banana` is NOT itself a front-matter schema error (the control
    // `engine: banana` + `#| cache: true` renders exit 0), and quarto falls through to
    // language resolution — so the same document with `#| cache: banana` renders exit 1.
    // S165 L2: `knitr` IS that exit-1 fall-through. A build that accepted the unknown name as
    // a selector would answer something else entirely.
    expect(resolve(doc("engine: banana\n"))).toBe("knitr");
    expect(resolve(pyDoc("engine: banana\n"))).toBe("jupyter");
  });
});

describe("Session 164 — documentEngineForScoping: the nested `execute: engine:` spelling", () => {
  it("resolves `execute:` / `  engine: <name>`", () => {
    // Measured: `execute:` / `  engine: markdown` + `{r}` + `#| cache: banana` → exit 0,
    // and `execute:` / `  engine: knitr` + `{python}` + `#| cache: banana` → exit 1.
    // Quarto folds a top-level `engine:` into `format.execute.engine` (`metadataAsFormat`,
    // `kEngine` ∈ `kExecuteDefaultsKeys`), so the two spellings are the same key.
    expect(resolve(doc("execute:\n  engine: markdown\n"))).toBe("markdown");
    expect(resolve(pyDoc("execute:\n  engine: knitr\n"))).toBe("knitr"); // pyDoc: see above
  });

  it("documents WHY the resolver's depth guard is currently unreachable", () => {
    // The §9 review reported the `parentPath.length === 1` guard as pinned by nothing, and it
    // is right that the mutant dropping it survives — but not because the pin is missing.
    // NOTHING deeper than `["execute"]` is ever emitted under `execute:` at all, so no input
    // can reach the clause. Faking a pin here would be the vacuous-test habit this project
    // keeps catching; instead this pins the ENUMERATOR contract the guard depends on, so if
    // that ever changes, the next session is told the guard has become load-bearing.
    const deeper = findNestedFrontMatterValueLines(
      "---\ntitle: t\nexecute:\n  daemon:\n    engine: markdown\n---\n",
    );
    expect(deeper.filter((r) => r.parentPath[0] === "execute" && r.parentPath.length > 1)).toEqual(
      [],
    );
    // …while the depth-1 child IS emitted, which is what the resolver actually consumes.
    const atOne = findNestedFrontMatterValueLines(
      "---\ntitle: t\nexecute:\n  engine: markdown\n---\n",
    );
    expect(atOne.map((r) => `${r.parentPath.join(".")}.${r.key}`)).toEqual(["execute.engine"]);
  });

  it("does NOT read an `engine:` nested anywhere else", () => {
    // `format:` / `  html:` / `    engine: markdown` + `{r}` + `#| cache: banana` renders
    // exit 1 — engine resolution reads the RAW top-level front matter (plus `execute:`),
    // never per-format metadata. Reading it there would silence a validated document.
    // S165: `knitr` (the language answer for that same exit-1 document) rather than
    // `undefined`; a build that DID read the per-format key would answer `markdown`.
    expect(resolve(doc("format:\n  html:\n    engine: markdown\n"))).toBe("knitr");
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
    // S165: `knitr` IS that fall-through, now modelled. Still discriminating on an `{r}`
    // document, because a build that read the value as truthy would answer `jupyter`.
    for (const value of ["false", "False", "FALSE", "null", "Null", "NULL", "~", "0", "''", '""']) {
      expect(resolve(doc(`jupyter: ${value}\n`)), value).toBe("knitr");
    }
  });

  it("does NOT select on a bare key with no value — that node is null", () => {
    // `jupyter:` alone renders exit 1 (and is itself a front-matter schema error).
    // S165 §9: `undefined` rather than the language answer, because an empty token with no
    // indented children is ALSO how a COLUMN-0 sequence body looks to `opensBlockAt`, and that
    // one IS truthy (`markdown:` + a column-0 `- x` renders exit 0 — quarto selected it). We
    // cannot tell the two apart, so we decline instead of guessing in the knitr direction.
    // Nothing is lost: a genuinely bare key is a front-matter schema error either way.
    expect(resolve(doc("jupyter:\n"))).toBeUndefined();
    expect(resolve(doc("markdown:\n"))).toBeUndefined();
  });

  it("is not fooled by a NESTED key that merely shares the name", () => {
    expect(resolve(doc("execute:\n  jupyter: python3\n"))).toBe("knitr");
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
    // `#| cache: banana` renders exit 1 — the container form selects knitr as well. S165 §9:
    // that measurement used a `{python}` document and so must this pin, or the language
    // fallback supplies the same answer and the pin stops discriminating.
    expect(resolve(pyDoc("knitr:\n  opts_chunk:\n    collapse: true\n"))).toBe("knitr");
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
    // S165: these MUST use the `{python}` document. On an `{r}` one the language fallback now
    // answers knitr anyway, so the pin would pass just as happily against a build that wrongly
    // SELECTED knitr here — it would stop discriminating exactly the defect it exists for.
    // `pyDoc` is also the shape they were measured on (see the exit 0 above).
    // S165 §9: `undefined` rather than the language answer. The value is on a continuation
    // line we do not read, and it may just as well be `true` — measured, `knitr:` + an
    // indented `true` renders exit 1, i.e. quarto DOES select knitr there. Declining covers
    // both; the effective scope for these documents is unchanged (a {python} cell lands on
    // the agnostic set either way).
    expect(resolve(pyDoc("knitr:\n  false\n"))).toBeUndefined();
    expect(resolve(pyDoc("knitr:\n\n  false\n"))).toBeUndefined();
    expect(resolve(pyDoc("knitr: # off\n  false\n"))).toBeUndefined();
    // Same shape on a narrowing engine: `markdown:` + indented `false` renders exit 1 with an
    // {r} cell, i.e. quarto did NOT select markdown either.
    expect(resolve(pyDoc("markdown:\n  false\n"))).toBeUndefined();
    expect(resolve(doc("markdown:\n  false\n"))).toBeUndefined();
  });

  it("still selects on a real mapping or sequence body — the L5 capability is intact", () => {
    expect(resolve(pyDoc("knitr:\n  opts_chunk:\n    collapse: true\n"))).toBe("knitr"); // pyDoc: see above
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
    // S165: `knitr` is the language fall-through that exit 1 records. A build reading `|` as
    // an ordinary truthy token would answer `jupyter`, so the pin still discriminates.
    // S165 §9: `undefined`. An empty block scalar is falsy, but a NON-empty one is a truthy
    // string — measured, `markdown: |` + an indented body renders exit 0, i.e. selected. The
    // token cannot tell us which, so the answer is "cannot read", not "falsy".
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
    // S165: the `{python}` document, for the same reason as the indented-scalar pin above and
    // because that is what the exit-0 measurements used — on an `{r}` document the language
    // fallback answers knitr, so a build that wrongly read `!!bool false` as truthy would be
    // indistinguishable from a correct one.
    // S165 §9: `undefined` rather than the language answer, for the same reason — the mirror
    // `markdown: !!bool true` and `markdown: &a true` both render exit 0 (quarto selected),
    // so a node property is unreadable in BOTH directions and must block the fallback.
    for (const value of ["!!bool false", "&a false", "*a", "!!str false"]) {
      expect(resolve(pyDoc(`knitr: ${value}\n`)), value).toBeUndefined();
    }
    // The cost is a true positive when the tagged node is TRUTHY — `knitr: !!bool true`
    // renders exit 1, i.e. knitr really is selected there and we now stay silent. FP-safe.
    expect(resolve(pyDoc("knitr: !!bool true\n"))).toBeUndefined();
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
    // S165: `knitr` is that exit-1 fall-through; a build seeing children would answer `jupyter`.
    // S165 §9: `undefined` — same empty-token-with-no-children class as the bare key above.
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
    // S165: on the `{python}` document these are `jupyter` — the LANGUAGE answer quarto's own
    // exit 0 records — rather than `undefined`, and that is also the shape they were measured
    // on. A build that read the rejected block would answer `knitr` and squiggle it.
    expect(
      resolve("---\n\nknitr: true\n---\n\n```{python}\n#| cache: banana\n1 + 1\n```\n"),
    ).toBe("jupyter");
    expect(resolve("---\n\nknitr: true\n---\n\ntext\n")).toBe("markdown");
    expect(resolve("---\n\nengine: knitr\n---\n\ntext\n")).toBe("markdown");
    expect(resolve("---\n\nknitr:\n  opts_chunk:\n    echo: false\n---\n\ntext\n")).toBe("markdown");
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
    // back to the language, which is exactly what `undefined` made us do. Forcing "ambiguous"
    // here would be a needless narrowing, and `engine: banana` alone with an {r} cell renders
    // exit 1, which only the language fallback gets right.
    // S165 L2: that fall-back is now the ANSWER rather than an approximation.
    expect(resolve(doc("execute:\n  engine: banana\n"))).toBe("knitr");
    expect(resolve(doc("engine: banana\n"))).toBe("knitr");
    expect(resolve(pyDoc("execute:\n  engine: banana\n"))).toBe("jupyter");
  });

  it("still declines when the UNREADABLE selector is the only one — S165 L2", () => {
    // The distinction L2 draws, and the reason it is not simply "unresolved ⇒ fall back".
    //
    //   `engine: banana`             — we can READ it and it names nothing. Quarto matches
    //                                  nothing either, so it falls to the languages and so do
    //                                  we. Measured: + `{r}` cache → exit 1 (knitr);
    //                                  + `{julia}` first → exit 0 (jupyter).
    //   `execute: {engine: markdown}` — we cannot read the flow mapping's MEMBERS. Quarto CAN,
    //                                  and honours it: measured, that document's `{r}` cell
    //                                  with `#| cache: banana` renders **exit 0** (control
    //                                  `#| echo: banana`: exit 1, so validation ran). Falling
    //                                  back to the languages here would answer knitr and
    //                                  squiggle a document quarto ACCEPTS — the cardinal sin,
    //                                  newly manufactured by this session rather than
    //                                  inherited. So it declines.
    //
    // The cost is measured and accepted: a flow `execute:` that contains NO engine key really
    // does fall to the languages (`execute: {echo: false}` + `{r}` cache → exit 1) and we now
    // stay silent there — a lost true positive in the FP-safe direction, and the same answer
    // this feature gave before S165 for that document's non-r cells.
    expect(resolve(doc("execute: {engine: markdown}\n"))).toBeUndefined();
    expect(resolve(doc("execute: {echo: false}\n"))).toBeUndefined();
    expect(resolve(pyDoc("execute: {engine: knitr}\n"))).toBeUndefined();
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
    expect(resolve(pyDoc("engine: knitr\nexecute:\n  engine: knitr\n"))).toBe("knitr"); // pyDoc: see above
  });
});

describe("Session 164 — documentEngineForScoping: the FILE EXTENSION claims first", () => {
  // `fileExecutionEngine` runs `engine.claimsFile(file, ext)` over every engine BEFORE it
  // ever partitions the front matter, and knitr claims `kRmdExtensions = [".rmd",
  // ".rmarkdown"]` (compared lowercased). Our `quarto` languageId opens .qmd, .rmd AND
  // .Rmd, so on the R-Markdown extensions the override below is dead text. Measured: each
  // of these renders exit 1 — quarto validated against knitr anyway — while the identical
  // document named .qmd renders exit 0.
  //
  // S170 turned the answer from `undefined` (a VETO on the override, leaving the caller on
  // its per-cell language guess) into `"knitr"` (the veto AND quarto's actual scope). The
  // veto half is what these rows still assert: whatever the front matter says, the answer
  // does not move.
  it("ignores every front-matter override on an R-Markdown extension", () => {
    for (const name of ["doc.Rmd", "doc.rmd", "doc.RMD", "/a/b/doc.rmarkdown"]) {
      expect(resolve(doc("engine: markdown\n"), name), name).toBe("knitr");
      expect(resolve(doc("jupyter: python3\n"), name), name).toBe("knitr");
      expect(resolve(doc("execute:\n  engine: jupyter\n"), name), name).toBe("knitr");
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

describe("Session 165 — documentEngineForScoping: the DEFAULT engine, from the cell languages", () => {
  it("resolves a document with a {julia} cell BEFORE an {r} cell to jupyter, not knitr", () => {
    // THE headline false positive this session removes. Quarto's language fallback is
    // document-wide and ORDER-DEPENDENT: `markdownExecutionEngine` iterates the LANGUAGES
    // outer and the ENGINES inner, and jupyter claims `julia` while knitr claims `r`, so
    // whichever of the two appears FIRST decides the whole document.
    //
    // Measured firsthand vs 1.7.33, one `quarto render --no-execute` each:
    //   {julia} then {r}, `#| cache: banana` on the {r} cell → exit 0   ← we squiggled this
    //   {julia} then {r}, `#| echo:  banana` on the {r} cell → exit 1   ← validation DID run
    //   {r} alone,        `#| cache: banana`                 → exit 1   ← knitr really is it
    const jlThenR =
      "---\ntitle: t\n---\n\n```{julia}\n1 + 1\n```\n\n```{r}\n#| cache: banana\n1 + 1\n```\n";
    expect(resolve(jlThenR)).toBe("jupyter");
  });

  it("gives the SAME document the other answer when the {r} cell comes first", () => {
    // The order really is the whole rule — measured, `{r}` then `{julia}` renders exit 1.
    const rThenJl =
      "---\ntitle: t\n---\n\n```{r}\n#| cache: banana\n1 + 1\n```\n\n```{julia}\n1 + 1\n```\n";
    expect(resolve(rThenJl)).toBe("knitr");
  });

  it("scopes a NON-r cell to knitr when the document holds an {r} cell anywhere", () => {
    // The other direction of the same fix, and the one that WIDENS: quarto validates every
    // cell of a knitr document against knitr's schema, whatever the cell's own language.
    // Measured, `#| cache: banana` on the {python} cell renders **exit 1** in both orders,
    // against the {python}-alone control at exit 0 — true positives this feature used to lose.
    expect(resolve(`${doc("").replace("#| cache: banana\n", "")}\n\`\`\`{python}\n1\n\`\`\`\n`)).toBe(
      "knitr",
    );
    expect(resolve("---\ntitle: t\n---\n\n```{python}\n1\n```\n\n```{r}\n1\n```\n")).toBe("knitr");
    expect(resolve("---\ntitle: t\n---\n\n```{r}\n1\n```\n\n```{sql}\nselect 1\n```\n")).toBe(
      "knitr",
    );
  });

  it("applies quarto's SECOND loop — an unclaimed language forces jupyter, else markdown", () => {
    // `for (const l of languages) if (l !== "ojs" && !handlerLanguages.includes(l)) return
    // jupyterEngine; return markdownEngine`. Measured: `{python}`/`{sql}` alone → exit 0 on
    // `cache` and exit 1 on `echo`, i.e. validated but not against knitr; `{ojs}` alone → the
    // same pair. jupyter and markdown are indistinguishable DOWNSTREAM (`cellOptionScopeFor`
    // maps both to the agnostic set) — these pin the transcription itself, which is what makes
    // the knitr answer above trustworthy.
    const only = (lang: string) => `---\ntitle: t\n---\n\n\`\`\`{${lang}}\nx\n\`\`\`\n`;
    expect(resolve(only("python"))).toBe("jupyter");
    expect(resolve(only("sql"))).toBe("jupyter");
    expect(resolve(only("ojs"))).toBe("markdown"); // the `!== "ojs"` exception
    expect(resolve(only("dot"))).toBe("markdown"); // a cell-HANDLER language
    expect(resolve(only("mermaid"))).toBe("markdown");
    expect(resolve(only("julia"))).toBe("jupyter"); // claimed in the FIRST loop, by jupyter
    // Mixed: the handler/ojs exceptions only hold while EVERY language is exempt.
    expect(resolve(only("dot") + "```{python}\nx\n```\n")).toBe("jupyter");
    // No cell fences at all — quarto's final `return markdownEngine`.
    expect(resolve("---\ntitle: t\n---\n\njust prose\n")).toBe("markdown");
  });

  it("counts a fence quarto's CONTEXT-FREE regex counts, wherever it sits", () => {
    // Each of these `{julia}` fences is invisible to a nesting-aware cell scanner and visible
    // to quarto, and each renders the whole document **exit 0** on the {r} cell's
    // `#| cache: banana` (control: `#| echo: banana` → exit 1, so validation ran). Reading the
    // engine off `findAllCells` would answer knitr for all five and squiggle documents quarto
    // ACCEPTS — this is why the language set is a transcription of quarto's regex, not a
    // re-use of our own model.
    const withJulia = (fenced: string) =>
      `---\ntitle: t\n---\n\n${fenced}\n\`\`\`{r}\n#| cache: banana\n1 + 1\n\`\`\`\n`;
    expect(resolve(withJulia("````\n```{julia}\n1\n```\n````\n"))).toBe("jupyter"); // example block
    expect(resolve(withJulia("> ```{julia}\n> 1\n> ```\n"))).toBe("jupyter"); // blockquote
    expect(resolve(withJulia("   ```{julia}\n   1\n   ```\n"))).toBe("jupyter"); // indented
    expect(resolve(withJulia("    ```{julia}\n    1\n    ```\n"))).toBe("jupyter"); // indented code
    expect(resolve(withJulia("<!--\n```{julia}\n1\n```\n-->\n"))).toBe("jupyter"); // HTML comment
    expect(resolve(withJulia("\t```{julia}\n\t1\n\t```\n"))).toBe("jupyter"); // tab-indented
    expect(resolve(withJulia("````{julia}\n1\n````\n"))).toBe("jupyter"); // 4 backticks
    expect(resolve(withJulia("``` {julia}\n1\n```\n"))).toBe("jupyter"); // space after the ticks
    // …and a fence in the FRONT MATTER counts too: quarto scans the whole file text.
    expect(
      resolve("---\ntitle: |\n  ```{julia}\n---\n\n```{r}\n#| cache: banana\n1 + 1\n```\n"),
    ).toBe("jupyter");
  });

  it("does NOT count a fence quarto's regex rejects", () => {
    // The mirror set, and the direction where a LOOSER transcription would cost true
    // positives rather than manufacture false ones. Each renders exit 1 — knitr — because the
    // `{julia}` line is not a language to quarto.
    const withJulia = (fenced: string) =>
      `---\ntitle: t\n---\n\n${fenced}\n\`\`\`{r}\n#| cache: banana\n1 + 1\n\`\`\`\n`;
    expect(resolve(withJulia("```{julia} x\n1\n```\n"))).toBe("knitr"); // trailing text
    expect(resolve(withJulia("```{ julia }\n1\n```\n"))).toBe("knitr"); // spaces inside braces
  });

  it("reads the token the way quarto's regex does — lowercased, digits allowed, no dots", () => {
    // `.toLowerCase()`: measured, `{R}` + `#| cache: banana` renders exit 1.
    expect(resolve("---\ntitle: t\n---\n\n```{R}\n#| cache: banana\n1 + 1\n```\n")).toBe("knitr");
    // knitr's attribute forms are part of the same match.
    expect(resolve("---\ntitle: t\n---\n\n```{r, echo=FALSE}\n1\n```\n")).toBe("knitr");
    // `[a-zA-Z0-9_]+` admits DIGITS, unlike quarto's CELL recognizer `([=A-Za-z]+)`: `{r9}` is
    // a language but not a cell (measured, its own `#| cache: banana` renders exit 0), so it
    // reaches the second loop and forces jupyter rather than leaving the document markdown.
    expect(resolve("---\ntitle: t\n---\n\n```{r9}\nx\n```\n")).toBe("jupyter");
    // …but a DOT is in neither recognizer: `{r.foo}` is not a language and not a cell
    // (measured, both `#| cache: banana` and `#| echo: banana` render exit 0). Until S172 our
    // own `CELL_INFO` read it as an `{r}` cell and this comment cited that as a divergence the
    // raw-text resolution kept out of the engine answer; `CELL_INFO` now carries quarto's cell
    // grammar, so it agrees here too. The pin below is unchanged and still discriminating — it
    // asserts the ENGINE, which has always come from the raw text, never from the cell list.
    expect(resolve("---\ntitle: t\n---\n\n```{r.foo}\nx\n```\n")).toBe("markdown");
  });

  it("DECLINES on an `{{< include >}}` — the text quarto resolves against is not ours", () => {
    // `resolveFullMarkdownForFile` expands includes BEFORE the engine is chosen, and it flips
    // the answer both ways (measured): a child holding `{julia}` above an `{r}` cell renders
    // exit 0 where the include-free control renders exit 1, and a child holding `{r}` above a
    // `{python}` cell renders exit 1 where the control renders exit 0. Position matters too, so
    // the answer cannot even be bounded without reading the included files. `undefined`
    // restores exactly the per-cell behaviour this extension already had — never a new flag.
    expect(
      resolve(
        "---\ntitle: t\n---\n\n{{< include child.qmd >}}\n\n```{r}\n#| cache: banana\n1\n```\n",
      ),
    ).toBeUndefined();
    // Deliberately looser than quarto's own block-shortcode rule: an indented or inline
    // spelling declines too, because over-declining is the safe direction.
    expect(resolve("---\ntitle: t\n---\n\n  {{< include a.qmd >}}\n\n```{r}\n1\n```\n")).toBeUndefined();
    expect(resolve("---\ntitle: t\n---\n\ntext {{<include a.qmd>}}\n\n```{r}\n1\n```\n")).toBeUndefined();
    // A DIFFERENT shortcode is not an include and does not disturb the fallback.
    expect(resolve("---\ntitle: t\n---\n\n{{< video x >}}\n\n```{r}\n1\n```\n")).toBe("knitr");
  });

  it("answers an R-Markdown extension from the EXTENSION, never from the languages (S170)", () => {
    // The `.Rmd` branch returns before any of this, so the language fallback must not be
    // what produces the answer. The `{python}`-only row is what separates the two: its
    // fallback is jupyter, so `"knitr"` there can only have come from the extension.
    expect(resolve(doc(""), "doc.Rmd")).toBe("knitr");
    expect(resolve("---\ntitle: t\n---\n\n```{python}\n1\n```\n", "doc.rmd")).toBe("knitr");
    // …and a document with no cell fences at all, where the fallback answers `markdown`.
    expect(resolve("---\ntitle: t\n---\n\njust prose\n", "doc.Rmd")).toBe("knitr");
  });
});

describe("Session 165 §9 — a shape we DECLINE to read must block the fallback", () => {
  // The review's headline finding, and the defect S165's own L2 introduced. Before the
  // language fallback existed, failing to resolve a token was inert: the caller dropped back
  // to the per-cell language, which was all it had anyway. With the fallback, a decline
  // becomes a CONFIDENT document-wide answer — and on a document holding an {r} cell that
  // answer is knitr, so EVERY cell gets squiggled, not just the {r} ones.
  //
  // `pyDoc` here would not discriminate: its fallback is jupyter, the same agnostic scope the
  // fix produces. These MUST use the {r} document, where the broken answer (knitr) and the
  // correct one (undefined -> per-cell) differ.
  const rDoc = (fm: string) =>
    `---\ntitle: t\n${fm}---\n\n\`\`\`{r}\n1\n\`\`\`\n\n\`\`\`{python}\n#| cache: banana\n1\n\`\`\`\n`;

  it("declines on an `engine:` value whose VALUE is not in the token", () => {
    // Each renders **exit 0** on that document (control `#| echo: banana`: exit 1, so cell
    // validation ran; `engine: markdown` control: also exit 0) — quarto resolved the node and
    // chose markdown, while L2 answered knitr and flagged the {python} cell.
    expect(resolve(rDoc("engine: &a markdown\n"))).toBeUndefined();
    expect(resolve(rDoc("xx: &a markdown\nengine: *a\n"))).toBeUndefined();
    expect(resolve(rDoc("engine: >-\n  markdown\n"))).toBeUndefined();
    expect(resolve(rDoc("engine:\n  markdown\n"))).toBeUndefined();
    expect(resolve(rDoc("engine: !!str markdown\n"))).toBeUndefined();
    // …and the same defect in the NESTED loop.
    expect(resolve(rDoc("execute:\n  engine: &a markdown\n"))).toBeUndefined();
  });

  it("still falls through on a value it CAN read that names no engine", () => {
    // The half of L2 that was right, and that this fix must not undo: quarto's loop misses
    // these too and falls to the languages. Measured, `engine: banana` on that document
    // renders **exit 1** with `Field "cache" has value banana`.
    expect(resolve(rDoc("engine: banana\n"))).toBe("knitr");
    expect(resolve(rDoc("engine: MARKDOWN\n"))).toBe("knitr");
    expect(resolve(rDoc("engine: 'banana'\n"))).toBe("knitr");
  });

  it("declines on an ENGINE-NAMED key whose truthiness we cannot resolve", () => {
    // Same defect, other selector: `readTruthiness` used to answer a flat `false` here, the
    // key did not select, nothing else did, and the document fell to the languages. Measured
    // exit 0 for all four — quarto selected markdown.
    expect(resolve(rDoc("markdown: !!bool true\n"))).toBeUndefined();
    expect(resolve(rDoc("markdown: &a true\n"))).toBeUndefined();
    expect(resolve(rDoc("markdown: |\n  x\n"))).toBeUndefined();
    expect(resolve(rDoc("markdown:\n- x\n"))).toBeUndefined(); // a COLUMN-0 sequence body
  });

  it("still falls through on an engine-named key that is definitely FALSY", () => {
    // Quarto's `if (yaml[engine.name])` is false here too, so it also falls to the languages —
    // measured, `jupyter: false` + an {r} cell renders exit 1. Declining would be a needless
    // narrowing, and this is the pin that keeps the fix from over-correcting.
    expect(resolve(rDoc("jupyter: false\n"))).toBe("knitr");
    expect(resolve(rDoc("jupyter: null\n"))).toBe("knitr");
    expect(resolve(rDoc("jupyter: 0\n"))).toBe("knitr");
  });

  it("declines on ANY scalar token on `execute:`, not just a flow mapping", () => {
    // L2 tested `rawToken.startsWith("{")`. An anchor or an alias is just as unreadable, and
    // both render **exit 0** on that document (controls at exit 1).
    expect(resolve(rDoc("xx: &a\n  engine: markdown\nexecute: *a\n"))).toBeUndefined();
    expect(resolve(rDoc("execute: &a\n  engine: markdown\n"))).toBeUndefined();
    expect(resolve(rDoc("execute: {engine: markdown}\n"))).toBeUndefined();
    // A block mapping leaves the token empty and IS readable through its children.
    expect(resolve(rDoc("execute:\n  engine: markdown\n"))).toBe("markdown");
  });

  it("DECISION LEVEL: declines untrimmed text whose front matter our scanner never saw", () => {
    // `partitionYamlFrontMatter` runs `lines(markdown.trimLeft())`, so a blank line BEFORE the
    // opening `---` hides the block from `scanRegions` and not from quarto. Measured: that
    // document with `engine: markdown` renders **exit 0** (control `#| echo: banana`: exit 1;
    // the same document without the `engine:` line: exit 1). Before S165 the skew cost only
    // the {r} cells — falling back to the languages here would widen it to every cell, which
    // is what this guard prevents.
    //
    // ⚠ **S171 means the PRODUCT no longer reaches this guard for these two inputs.**
    // `resolveDocumentEngine` trims first, so the real answer for the first document is now
    // `"markdown"` — pinned in `document-engine-resolve.test.ts` and in the S171 block of
    // `yaml-value-flags.test.ts`. What is pinned HERE is the decision's own contract given
    // untrimmed input, which is still exercised by first lines that start with `---` without
    // being a fence (`----`, `---foo`): those match `startsWith` but not `FRONTMATTER_OPEN`,
    // so the guard still fires for them after the trim. Quarto's `kRegExBeginYAML` rejects
    // them too and falls through to the languages, making that decline a lost TP, not an FP.
    // ⚠ **SESSION 210 — the first two inputs no longer reach the guard at all, and this block's
    // own note predicted it.** The note above already recorded that quarto's answer for the
    // first document is `"markdown"` (its partitioner runs `lines(markdown.trimLeft())`) and
    // that only the caller's trim was making the product agree. S210 taught `scanRegions` the
    // same leading-blank rule, so the DECISION now reaches quarto's answer directly rather than
    // via the caller — an agreement, not a skew. The guard's live purpose is unchanged and is
    // asserted below: first lines that start with `---` WITHOUT being a fence.
    expect(resolve(`\n${rDoc("engine: markdown\n")}`)).toBe("markdown");
    // Each leading-whitespace document now answers exactly what its BYTE-0 TWIN answers, which
    // is the property the change was for. The twin is asserted beside it so the pin proves
    // agreement rather than merely recording a value — without it, both sides could drift
    // together and the assertion would still pass.
    expect(resolve(`\n\n  \n${rDoc("")}`)).toBe(resolve(rDoc("")));
    expect(resolve(rDoc(""))).toBe("knitr");
    expect(resolve(`\n${rDoc("engine: markdown\n")}`)).toBe(resolve(rDoc("engine: markdown\n")));
    // ⚠ The note's `----` / `---foo` examples are NOT assertable here: those documents open no
    // front matter at all, so this decision never sees one and resolves per-cell exactly like
    // the no-front-matter documents asserted below. Verified rather than assumed — asserting
    // `toBeUndefined()` for them returns `"knitr"`.
    // A document that genuinely has no front matter still resolves normally.
    expect(resolve("```{r}\n#| cache: banana\n1\n```\n")).toBe("knitr");
    expect(resolve("just prose\n\n```{python}\nx\n```\n")).toBe("jupyter");
  });
});
