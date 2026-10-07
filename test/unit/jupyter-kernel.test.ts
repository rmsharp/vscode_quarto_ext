import { describe, expect, it } from "vitest";
import { jupyterKernelLanguage } from "../../src/core/qmd/jupyter-kernel";

// Every row is a front matter quarto 1.7.33 rendered (`quarto render --no-execute`, html), exit 0, with one indent-4 `{lang}` opener below
// a blank line: the language that came out as a CELL (its heading swallowed) is the kernel's; the other was a plain fence. The documents
// are `scratchpad/s294/k1`, `k2` and `k3`. A row whose render FAILED (exit 1: a kernel that is not installed here, `jupyter: true`, a
// mapping with no `language`) has no oracle, and its answer is `null`: the language is not written in the document, so nothing can say.
const lines = (text: string): string[] => text.split("\n");

describe("jupyterKernelLanguage (Session 294) — the language the document's jupyter kernel runs", () => {
  // SLICE 1. A document that names no kernel runs python; an explicit `kernelspec.language` in block form names its own.
  it.each([
    ["no front matter at all", null, "python"],
    ["front matter naming no kernel", lines('title: "K"'), "python"],
    ["`engine: jupyter` alone picks python (`k1_engine_only`)", lines("engine: jupyter"), "python"],
    ["a mapping whose language is python (`k1_map_python`)", lines("jupyter:\n  kernelspec:\n    name: python3\n    display_name: Python 3\n    language: python"), "python"],
    ["a `jupyter:` key under `format:` is no kernel of the document's (`k2_format_jupyter_key_ignored`)", lines("format:\n  html:\n    jupyter: julia-1.9"), "python"],
  ] as [string, string[] | null, string | null][])("%s", (_label, frontMatter, expected) => {
    expect(jupyterKernelLanguage(frontMatter)).toBe(expected);
  });
  it.each([
    ["julia (`k1_map_julia`)", "jupyter:\n  kernelspec:\n    name: julia-1.10\n    display_name: Julia\n    language: julia", "julia"],
    ["the language is lower-cased: `Julia` names the `{julia}` cell (`k1_map_Julia_cap`)", "jupyter:\n  kernelspec:\n    name: julia-1.10\n    display_name: Julia\n    language: Julia", "julia"],
    ["the explicit language beats the kernel NAME: name julia, language python (`k1_map_conflict_name_julia_lang_python`)", "jupyter:\n  kernelspec:\n    name: julia-1.10\n    display_name: Julia\n    language: python", "python"],
    ["...and the other way round (`k1_map_conflict_name_python3_lang_julia`)", "jupyter:\n  kernelspec:\n    name: python3\n    display_name: Python 3\n    language: julia", "julia"],
    ["language written first (`k2_block_lang_first`)", "jupyter:\n  kernelspec:\n    language: julia\n    name: julia-1.10\n    display_name: Julia", "julia"],
    ["a double-quoted value (`k2_block_quoted_dq`)", 'jupyter:\n  kernelspec:\n    name: julia-1.10\n    display_name: Julia\n    language: "julia"', "julia"],
    ["a single-quoted value (`k2_block_quoted_sq`)", "jupyter:\n  kernelspec:\n    name: julia-1.10\n    display_name: Julia\n    language: 'julia'", "julia"],
    ["a trailing comment (`k2_block_comment`)", "jupyter:\n  kernelspec:\n    name: julia-1.10\n    display_name: Julia\n    language: julia   # the kernel", "julia"],
    ["a quoted key (`k2_block_quoted_key`)", 'jupyter:\n  kernelspec:\n    name: julia-1.10\n    display_name: Julia\n    "language": julia', "julia"],
    ["four-space indentation (`k2_block_indent4`)", "jupyter:\n    kernelspec:\n        name: julia-1.10\n        display_name: Julia\n        language: julia", "julia"],
    ["blank lines between the keys (`k2_block_tab_free_blank_lines`)", "jupyter:\n\n  kernelspec:\n\n    name: julia-1.10\n    display_name: Julia\n    language: julia", "julia"],
    ["a kernel NAME that is the word `language` (`k2_block_language_python_in_dict_key_name`)", "jupyter:\n  kernelspec:\n    name: language\n    display_name: Julia\n    language: julia", "julia"],
    ["a `language:` under ANOTHER top-level key is not the kernel's (`k2_two_jupyter_like_keys`)", "jupyter:\n  kernelspec:\n    name: julia-1.10\n    display_name: Julia\n    language: julia\nformat:\n  html:\n    language: python", "julia"],
    ["a `language:` directly under `jupyter:` is ignored; `kernelspec.language` decides (`k2_language_not_under_kernelspec`)", "jupyter:\n  language: julia\n  kernelspec:\n    name: python3\n    display_name: Python 3\n    language: python", "python"],
  ] as [string, string, string][])("explicit language, block form: %s", (_label, frontMatter, expected) => {
    expect(jupyterKernelLanguage(lines(frontMatter))).toBe(expected);
  });
  // SLICE 2. The scalar form: `python3` is the one name whose language the document itself settles (the python3 kernelspec is the one
  // installed here, `k1_scalar_python3`); a quoted or commented spelling is the same name (`k3`). Any OTHER kernel name has no language
  // in the document, and quarto fails the render where its kernelspec is missing, so there is no oracle and the answer is `null`.
  it.each([
    ["`jupyter: python3` (`k1_scalar_python3`)", "jupyter: python3", "python"],
    ["a double-quoted name (`k3_dq`)", 'jupyter: "python3"', "python"],
    ["a single-quoted name (`k3_sq`)", "jupyter: 'python3'", "python"],
    ["a trailing comment (`k3_comment`)", "jupyter: python3   # the kernel", "python"],
    ["`engine: jupyter` beside `jupyter: python3` (`k3_engine_jupyter_and_key`)", "engine: jupyter\njupyter: python3", "python"],
  ] as [string, string, string][])("scalar kernel name: %s", (_label, frontMatter, expected) => {
    expect(jupyterKernelLanguage(lines(frontMatter))).toBe(expected);
  });
  it.each([
    ["an uninstalled julia kernel (`k1_scalar_julia19`: exit 1)", "jupyter: julia-1.9"],
    ["an uninstalled R kernel (`k1_scalar_ir`: exit 1)", "jupyter: ir"],
    ["an uninstalled bash kernel (`k1_scalar_bash`: exit 1)", "jupyter: bash"],
    ["the bare name `python`, which is no installed kernel (`k1_scalar_python`: exit 1)", "jupyter: python"],
    ["`Python3` in capitals, kernel names being case-sensitive (`k3_cap`: exit 1)", "jupyter: Python3"],
    ["`jupyter: true` (`k1_scalar_true`: exit 1)", "jupyter: true"],
    ["a mapping that writes only a kernel name (`k1_map_name_only_julia`: exit 1)", "jupyter:\n  kernelspec:\n    name: julia-1.10\n    display_name: Julia"],
    ["a mapping with no `kernelspec` at all", "jupyter:\n  foo: bar"],
    ["a bare `jupyter:`", "jupyter:"],
    ["an alias for the language, which this reader does not resolve", "jupyter:\n  kernelspec:\n    name: x\n    language: *lang"],
    ["a language value that is no plain token", "jupyter:\n  kernelspec:\n    name: x\n    language: [julia]"],
  ] as [string, string][])("no oracle, so unknown: %s", (_label, frontMatter) => {
    expect(jupyterKernelLanguage(lines(frontMatter))).toBeNull();
  });

  // SLICE 3. Flow mappings: every spelling rendered with the language as the kernel's (`k2_flow_*`, `k2_anchor_value`).
  it.each([
    ["the kernelspec as a flow mapping (`k2_flow_inner`)", "jupyter:\n  kernelspec: {name: julia-1.10, display_name: Julia, language: julia}", "julia"],
    ["the whole `jupyter:` value as a flow mapping (`k2_flow_outer`)", "jupyter: {kernelspec: {name: julia-1.10, display_name: Julia, language: julia}}", "julia"],
    ["quoted values in a flow mapping (`k2_flow_outer_quoted`)", 'jupyter: {kernelspec: {name: "julia-1.10", display_name: "Julia", language: "julia"}}', "julia"],
    ["an anchored value (`k2_anchor_value`)", "jupyter:\n  kernelspec:\n    name: julia-1.10\n    display_name: Julia\n    language: &lang julia", "julia"],
    ["a flow kernelspec that writes no language", "jupyter: {kernelspec: {name: julia-1.10}}", null],
    ["a `language` beside, not inside, the kernelspec of a flow mapping", "jupyter: {language: julia, kernelspec: {name: python3}}", null],
  ] as [string, string, string | null][])("flow and anchored forms: %s", (_label, frontMatter, expected) => {
    expect(jupyterKernelLanguage(lines(frontMatter))).toBe(expected);
  });
  // A double-quoted value may hold an escaped quote, a comma and a colon; none of them may end the entry or the mapping. (Pure
  // reading-robustness rows, not rendered: the kernel language here is the one the document writes, and a reader that loses its place
  // would answer `null` or a wrong language, so the rows pin that it neither does.)
  it.each([
    ["an escaped quote, a comma and a colon inside a quoted display name", 'jupyter: {kernelspec: {display_name: "Ju \\"li\\", a: b", name: j, language: julia}}', "julia"],
    ["an escaped quote followed by a comma inside one quoted display name", 'jupyter: {kernelspec: {display_name: "x \\", y", name: j, language: julia}}', "julia"],
    ["a quoted display name that holds a closing brace", 'jupyter: {kernelspec: {display_name: "}", name: j, language: julia}}', "julia"],
    ["a single-quoted display name with a doubled quote", "jupyter: {kernelspec: {display_name: 'It''s, J', name: j, language: julia}}", "julia"],
    ["a `language` nested deeper inside the kernelspec is not the kernelspec's own", "jupyter:\n  kernelspec:\n    name: x\n    metadata:\n      language: julia", null],
    ["a flow value after an unquoted key with spaces", "jupyter: {kernelspec: {display_name: Julia 1.10, name: j, language: julia}}", "julia"],
    ["text after the closing brace that is not a comment makes the value unknown", "jupyter: {kernelspec: {name: j, language: julia}} trailing", null],
    ["an unterminated flow mapping is unknown", "jupyter: {kernelspec: {name: j, language: julia}", null],
  ] as [string, string, string | null][])("flow reading is robust: %s", (_label, frontMatter, expected) => {
    expect(jupyterKernelLanguage(lines(frontMatter))).toBe(expected);
  });
  // SLICE 4. "PYTHON BY DEFAULT" IS A CLAIM THAT THE FRONT MATTER WAS UNDERSTOOD. Round 2's spelling lens found seven documents (`scratchpad/s294/adv2/K1`,
  // ne mode, exit 0) whose front matter plainly names a kernel in a form this reader does not read, so "no `jupyter:` key, therefore python" was
  // wrong and the rule skipped the kernel's own cell (the old pairing was right). Six of them name julia (quarto swallowed the `{julia}` cell), one is
  // a DECOY: a `jupyter:` line sits inside a multi-line quoted scalar, so the kernel really is python. In every case the honest answer is "not sure":
  // `null`, which keeps the old behaviour. The reader answers python only for a front matter it can see through: plain column-0 keys, no unclosed
  // quote, no duplicate `jupyter` key, and no `jupyter:` key written again in the body (a mid-document metadata block merges into the metadata).
  it.each([
    ["an escaped key spelling `\\u0075` (`K1_022`: julia)", '"j\\u0075pyter":\n  kernelspec:\n    name: julia-1.9\n    language: julia'],
    ["the whole front matter indented (`K1_058`: julia)", '  title: "x"\n  jupyter:\n    kernelspec:\n      name: julia-1.9\n      language: julia'],
    ["the whole front matter as one JSON line (`K1_059`: julia)", '{"title": "x", "jupyter": {"kernelspec": {"name": "julia-1.9", "language": "julia"}}}'],
    ["the whole front matter as a multi-line flow mapping (`K1_060`: julia)", '{\n  title: "x",\n  jupyter: {kernelspec: {name: julia-1.9, language: julia}}\n}'],
    ["a complex `? key` (`K1_061`: julia)", 'title: "x"\n? jupyter\n: {kernelspec: {name: julia-1.9, language: julia}}'],
    ["a `jupyter:` line INSIDE a multi-line quoted scalar, a decoy (`K1_062`: python)", 'title: "x"\ndescription: "a long text\njupyter: {kernelspec: {name: julia-1.9, language: julia}}\n ends here"'],
    ["a single-quoted scalar left open across lines", "title: 'x\njupyter: python3\n y'"],
    ["two top-level `jupyter` keys, which a YAML loader refuses", "jupyter: python3\njupyter:\n  kernelspec:\n    name: x\n    language: julia"],
    ["a sequence at the root", "- title\n- jupyter: python3"],
  ] as [string, string][])("a front matter this reader cannot see through is unknown: %s", (_label, frontMatter) => {
    expect(jupyterKernelLanguage(lines(frontMatter))).toBeNull();
  });
  it("a `jupyter:` key written again in the body is unknown, whatever the front matter says (`K1_065`: julia; a mid-document metadata block merges in)", () => {
    expect(jupyterKernelLanguage(lines("title: x\njupyter: python3"), lines("text\n\n---\njupyter:\n  kernelspec: {name: j, language: julia}\n---"))).toBeNull();
    expect(jupyterKernelLanguage(null, lines("---\njupyter: python3\n---"))).toBeNull();
  });
  // ...and the guard must not be a hair trigger: ordinary front matter keeps answering python (an apostrophe in a plain scalar, a quoted value that
  // closes, a comment, a blank line, a `jupyter` word elsewhere, a body that never writes the key).
  it.each([
    ["an apostrophe inside a plain scalar", "title: Don't panic\ndescription: It's here"],
    ["a quoted value that closes on its line, with a colon inside", 'title: "A: B"\nsubtitle: \'C: D\''],
    ["comments and blank lines between plain keys", "# a comment\ntitle: x\n\nauthor: y   # trailing"],
    ["the word jupyter inside another value", "title: Using jupyter notebooks\nengine: jupyter"],
    ["a nested mapping and a block scalar", "format:\n  html:\n    toc: true\nabstract: |\n  jupyter: not a key\n  text"],
  ] as [string, string][])("a front matter it can see through still defaults to python: %s", (_label, frontMatter) => {
    expect(jupyterKernelLanguage(lines(frontMatter), lines("body text\n\n```{python}\nx = 1\n```"))).toBe("python");
  });
  // SLICE 6. A HOSTILE LINE MUST NOT STALL THE OUTLINE. This reader runs on the editor's debounced scan, and its first line regex overlapped two
  // character classes: a 30,000-space front-matter line cost about 550 ms (quadratic), measured through `findHeadings`. The budget is generous
  // (150 ms against a linear cost of a few) so a loaded machine does not flake the row, and each shape reaches a different line pattern.
  const SPACES = " ".repeat(30000);
  it.each([
    ["a key line with no colon", ["a" + SPACES + "b"]],
    ["a `jupyter:` value followed by spaces and a letter", ["jupyter: x" + SPACES + "y"]],
    ["a `language:` value followed by spaces and a letter", ["jupyter:", "  kernelspec:", "    name: x", "    language: julia" + SPACES + "y"]],
    ["an ordinary one-line description of 30,000 characters", ["title: x", "description: " + "word ".repeat(6000)]],
  ] as [string, string[]][])("a very long line does not stall the reader: %s", (_label, frontMatter) => {
    const start = performance.now();
    jupyterKernelLanguage(frontMatter);
    expect(performance.now() - start).toBeLessThan(150);
  });
});
