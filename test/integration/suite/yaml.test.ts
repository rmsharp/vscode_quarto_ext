import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const FIXTURE = path.resolve(ROOT, "test/fixtures/yaml-completion.qmd");

async function openFixture(): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument(FIXTURE);
  await vscode.window.showTextDocument(doc);
  return doc;
}

function labelText(item: vscode.CompletionItem): string {
  return typeof item.label === "string" ? item.label : item.label.label;
}

/** Items contributed by the Quarto YAML cell-option provider (tagged by `detail`). */
function cellOptionLabels(list: vscode.CompletionList | undefined): string[] {
  return (list?.items ?? [])
    .filter((i) => i.detail === "Quarto cell option")
    .map(labelText);
}

/** Cell-option VALUE items contributed by the YAML provider (tagged by `detail`). */
function cellValueLabels(list: vscode.CompletionList | undefined): string[] {
  return (list?.items ?? [])
    .filter((i) => i.detail === "Quarto cell option value")
    .map(labelText);
}

/** Front-matter (document) key items contributed by the YAML provider. */
function documentOptionLabels(list: vscode.CompletionList | undefined): string[] {
  return (list?.items ?? [])
    .filter((i) => i.detail === "Quarto document option")
    .map(labelText);
}

/** Front-matter (document) VALUE items contributed by the YAML provider. */
function documentValueLabels(list: vscode.CompletionList | undefined): string[] {
  return (list?.items ?? [])
    .filter((i) => i.detail === "Quarto document option value")
    .map(labelText);
}

/** Open an in-memory `.qmd`-language document (no fixture file needed). */
async function openInMemory(content: string): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument({ language: "quarto", content });
  await vscode.window.showTextDocument(doc);
  return doc;
}

/** The string form of a completion item's insertText. */
function insertTextOf(item: vscode.CompletionItem): string {
  const t = item.insertText;
  return typeof t === "string" ? t : (t?.value ?? "");
}

/** The range a completion item replaces (single-Range or insert/replace form). */
function replaceRange(item: vscode.CompletionItem): vscode.Range | undefined {
  const r = item.range as
    | vscode.Range
    | { inserting: vscode.Range; replacing: vscode.Range }
    | undefined;
  if (!r) {
    return undefined;
  }
  return "replacing" in r ? r.replacing : r;
}

/**
 * Exercise the real registered YAML completion provider exactly as the editor
 * does, and verify the inverted provider-gating contract (plan §4.3): cell-option
 * keys complete on a `#|` line but never in prose, code, or front matter, and the
 * `@` providers still work in prose (no cross-pollution). Environment-independent
 * — no Quarto CLI / Jupyter needed (Learnings #3/#9/#14).
 */
describe("Quarto: YAML cell-option key completion", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("completes cell-option keys on a #| line in a {python} cell", async () => {
    const doc = await openFixture();
    // Line 11 "#| echo: false" — cursor at col 3 (start of the key slot).
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(11, 3),
    );
    const labels = cellOptionLabels(list);
    for (const expected of ["echo", "eval", "output", "warning", "label", "fig-cap"]) {
      assert.ok(
        labels.includes(expected),
        `should offer cell option ${expected}; got ${JSON.stringify(labels)}`,
      );
    }
  });

  it("replace range covers the whole key token on a mid-token cursor", async () => {
    const doc = await openFixture();
    // Line 11 "#| echo: false": cursor at col 5 (inside "ec|ho"); key spans [3,7).
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(11, 5),
    );
    const item = (list?.items ?? []).find((i) => i.detail === "Quarto cell option");
    assert.ok(item, "at least one cell-option item");
    const range = replaceRange(item);
    assert.ok(range, "the item carries a replace range");
    assert.strictEqual(range.start.character, 3, "replaces from the key start");
    assert.strictEqual(range.end.character, 7, "replaces through the end of 'echo'");
  });

  it("offers NO cell-option keys on a prose line", async () => {
    const doc = await openFixture();
    // Line 8 "Some prose mentioning @sec-intro here." — col 4 is plain prose.
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(8, 4),
    );
    assert.deepStrictEqual(cellOptionLabels(list), [], "no YAML items in prose");
  });

  it("offers NO cell-option keys on a code line inside the cell", async () => {
    const doc = await openFixture();
    // Line 12 "x = 1" — a code line, not a #| option line.
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(12, 3),
    );
    assert.deepStrictEqual(cellOptionLabels(list), [], "no YAML items on code");
  });

  it("offers NO cell-option keys at a value position (past the colon)", async () => {
    const doc = await openFixture();
    // Line 11 "#| echo: false" — col 9 is in the value 'false' (Slice 6d-2).
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(11, 9),
    );
    assert.deepStrictEqual(cellOptionLabels(list), [], "no key items at a value");
  });

  it("offers NO cell-option keys in YAML front matter", async () => {
    const doc = await openFixture();
    // Line 1 'title: …' — front matter, not a cell-option line.
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 0),
    );
    assert.deepStrictEqual(cellOptionLabels(list), [], "no YAML items in front matter");
  });

  it("does not break @ cross-ref completion in prose (no cross-pollution)", async () => {
    const doc = await openFixture();
    // Line 8 col 23 — right after the '@' of '@sec-intro'.
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(8, 23),
      "@",
    );
    const labels = (list?.items ?? []).map(labelText);
    assert.ok(
      labels.includes("@sec-intro"),
      `@ completion still works in prose; got ${JSON.stringify(labels)}`,
    );
  });
});

/**
 * Slice 6d-2 — cell-option VALUE completion. The provider offers a known key's
 * curated value enum after the colon, and only there: never at the key slot, in
 * prose, in front matter, or for an unknown key. Environment-independent.
 */
describe("Quarto: YAML cell-option value completion", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("completes the value enum after a known key (`#| echo: `)", async () => {
    const doc = await openFixture();
    // Line 11 "#| echo: false" — col 9 is the start of the value slot.
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(11, 9),
    );
    const labels = cellValueLabels(list);
    for (const expected of ["true", "false", "fenced"]) {
      assert.ok(
        labels.includes(expected),
        `should offer echo value ${expected}; got ${JSON.stringify(labels)}`,
      );
    }
  });

  it("value replace range covers the whole value token", async () => {
    const doc = await openFixture();
    // Line 11 "#| echo: false": value "false" spans [9,14).
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(11, 9),
    );
    const item = (list?.items ?? []).find(
      (i) => i.detail === "Quarto cell option value",
    );
    assert.ok(item, "at least one value item");
    const range = replaceRange(item);
    assert.ok(range, "the item carries a replace range");
    assert.strictEqual(range.start.character, 9, "replaces from the value start");
    assert.strictEqual(range.end.character, 14, "replaces through the end of 'false'");
  });

  it("inserts a value as-is when a space already follows the colon", async () => {
    const doc = await openFixture();
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(11, 9),
    );
    const item = (list?.items ?? []).find(
      (i) => i.detail === "Quarto cell option value" && labelText(i) === "true",
    );
    assert.ok(item, "the 'true' value item");
    assert.strictEqual(insertTextOf(item), "true", "no leading space when one exists");
  });

  it("inserts a leading space when the value abuts the colon (`:` trigger)", async () => {
    // No space after the colon yet — accepting must produce valid `key: value`.
    const doc = await openInMemory("```{python}\n#| eval:\n```\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 8), // right after the colon
      ":",
    );
    const item = (list?.items ?? []).find(
      (i) => i.detail === "Quarto cell option value" && labelText(i) === "true",
    );
    assert.ok(item, `the 'true' value item; got ${JSON.stringify(cellValueLabels(list))}`);
    assert.strictEqual(insertTextOf(item), " true", "leading space added");
  });

  it("offers NO value items at the key slot", async () => {
    const doc = await openFixture();
    // Line 11 col 3 — the key slot, not a value position.
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(11, 3),
    );
    assert.deepStrictEqual(cellValueLabels(list), [], "no value items at the key");
  });

  it("offers NO values for an unknown key", async () => {
    const doc = await openInMemory("```{python}\n#| bogus:\n```\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 9), // value position after "bogus:"
      ":",
    );
    assert.deepStrictEqual(cellValueLabels(list), [], "no values for an unknown key");
  });

  it("offers NO value items on a prose line with a colon (`:` must not pop)", async () => {
    const doc = await openInMemory("Some prose.\n\nA note: here.\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(2, 8), // after "A note: "
      ":",
    );
    assert.deepStrictEqual(cellValueLabels(list), [], "no value items in prose");
  });

  it("offers NO value items inside a trailing inline comment", async () => {
    const doc = await openInMemory("```{python}\n#| echo: false  # note\n```\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 19), // inside "# note"
    );
    assert.deepStrictEqual(cellValueLabels(list), [], "no value items in the comment");
  });

  it("offers NO value items in YAML front matter", async () => {
    const doc = await openFixture();
    // Line 3 "  enabled: false" — front matter; col 11 is past its colon.
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(3, 11),
      ":",
    );
    assert.deepStrictEqual(cellValueLabels(list), [], "no value items in front matter");
  });
});

/**
 * Slice 6d-3 — the runtime schema reader enriches cell-option completion from the
 * user's INSTALLED Quarto schema. These assert an option that exists ONLY in the
 * full schema, never in the curated fallback (`code-overflow`), so a green proves
 * the reader ran end-to-end: it cannot pass via the curated set. The host runs the
 * real Quarto CLI (Learnings #4/#9/#11). With Quarto absent the provider degrades
 * to curated — proven by the pure parser's fallback unit tests and a documented
 * break-revert of `quartoSharePath` (these two tests go RED, `echo` stays green).
 */
describe("Quarto: YAML cell-option schema enrichment (6d-3)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("enriches keys with a schema-only option not in the curated set", async () => {
    const doc = await openInMemory("```{python}\n#| \n```\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 3), // the empty key slot after "#| "
    );
    const labels = cellOptionLabels(list);
    assert.ok(
      labels.includes("code-overflow"),
      `reader should enrich keys with code-overflow; got ${labels.length} options: ${JSON.stringify(labels.slice(0, 8))}…`,
    );
  });

  it("resolves a schema-only option's value enum (`code-overflow` → scroll/wrap)", async () => {
    const doc = await openInMemory("```{python}\n#| code-overflow:\n```\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 17), // the empty value slot after the colon
      ":",
    );
    const labels = cellValueLabels(list);
    for (const v of ["scroll", "wrap"]) {
      assert.ok(labels.includes(v), `code-overflow value ${v}; got ${JSON.stringify(labels)}`);
    }
  });
});

/**
 * Slice 6d-4 — front-matter top-level KEY completion. The provider offers document
 * keys inside the `---` block, and ONLY there: never in prose, code, or a cell-
 * option line, and the `@` cross-ref provider stays suppressed in front matter
 * (the complement of the §4.3 gating). `title`/`format`/`bibliography`/`toc` are
 * in both the curated set and the schema, so the positive cases are environment-
 * independent; a SCHEMA-ONLY key (`csl`) proves the runtime reader enriched the
 * front-matter set too (it cannot appear via the curated fallback).
 */
describe("Quarto: YAML front-matter key completion (6d-4)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("completes top-level document keys inside the front matter", async () => {
    const doc = await openFixture();
    // Line 1 'title: …' — col 0 is the start of the top-level key slot.
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 0),
    );
    const labels = documentOptionLabels(list);
    for (const expected of ["title", "author", "format", "bibliography", "toc"]) {
      assert.ok(
        labels.includes(expected),
        `should offer document key ${expected}; got ${JSON.stringify(labels.slice(0, 10))}…`,
      );
    }
  });

  it("replace range covers the whole key token on a mid-token cursor", async () => {
    const doc = await openFixture();
    // Line 1 "title: …": cursor at col 2 (inside "ti|tle"); key spans [0,5).
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 2),
    );
    const item = (list?.items ?? []).find((i) => i.detail === "Quarto document option");
    assert.ok(item, "at least one document-key item");
    const range = replaceRange(item);
    assert.ok(range, "the item carries a replace range");
    assert.strictEqual(range.start.character, 0, "replaces from the key start");
    assert.strictEqual(range.end.character, 5, "replaces through the end of 'title'");
  });

  it("enriches front-matter keys with a schema-only key not in the curated set", async () => {
    const doc = await openInMemory("---\nti\n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 2), // partial top-level key "ti"
    );
    const labels = documentOptionLabels(list);
    assert.ok(
      labels.includes("csl"),
      `reader should enrich front-matter keys with csl; got ${labels.length} keys: ${JSON.stringify(labels.slice(0, 8))}…`,
    );
  });

  it("offers NO document keys on a prose line", async () => {
    const doc = await openFixture();
    // Line 8 prose.
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(8, 4),
    );
    assert.deepStrictEqual(documentOptionLabels(list), [], "no document keys in prose");
  });

  it("offers NO document keys on a cell-option line", async () => {
    const doc = await openFixture();
    // Line 11 "#| echo: false" — a cell-option line, not front matter.
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(11, 3),
    );
    assert.deepStrictEqual(documentOptionLabels(list), [], "no document keys in a cell");
  });

  it("offers NO document keys on an indented (nested) front-matter line (6d-4 is top-level)", async () => {
    const doc = await openFixture();
    // Line 3 "  enabled: false" — nested under execute:, indented.
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(3, 2),
    );
    assert.deepStrictEqual(documentOptionLabels(list), [], "no keys on a nested line");
  });

  it("keeps @ cross-ref completion SUPPRESSED in front matter (complement gating)", async () => {
    // `@sec-intro` is defined in the fixture body; the crossref provider must not
    // fire in front matter (isReferenceableLine excludes it).
    const doc = await openInMemory("---\ntitle: @\n---\n\n# Intro {#sec-intro}\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 8), // right after the '@' in front matter
      "@",
    );
    const labels = (list?.items ?? []).map(labelText);
    assert.ok(
      !labels.includes("@sec-intro"),
      `@ completion must be suppressed in front matter; got ${JSON.stringify(labels)}`,
    );
  });
});

/**
 * Slice 6d-5 — front-matter top-level VALUE completion. After a known top-level
 * `key:` the provider offers that key's enum/boolean values, and ONLY there:
 * never at the key slot, in prose, in a cell-option value, or for a key with no
 * enum. `toc` is boolean in both the curated set and the schema, so the positive
 * case is environment-independent; a SCHEMA-ONLY enum (`editor` → source/visual)
 * proves the runtime reader resolved front-matter values end-to-end (it cannot
 * appear via the curated fallback).
 */
describe("Quarto: YAML front-matter value completion (6d-5)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("completes the value enum after a known boolean key (`toc: `)", async () => {
    const doc = await openInMemory("---\ntoc: \n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 5), // the value slot after "toc: "
    );
    const labels = documentValueLabels(list);
    for (const expected of ["true", "false"]) {
      assert.ok(
        labels.includes(expected),
        `should offer toc value ${expected}; got ${JSON.stringify(labels)}`,
      );
    }
  });

  it("value replace range covers the whole value token", async () => {
    const doc = await openInMemory("---\ntoc: false\n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 5), // value "false" spans [5,10)
    );
    const item = (list?.items ?? []).find(
      (i) => i.detail === "Quarto document option value",
    );
    assert.ok(item, "at least one document value item");
    const range = replaceRange(item);
    assert.ok(range, "the item carries a replace range");
    assert.strictEqual(range.start.character, 5, "replaces from the value start");
    assert.strictEqual(range.end.character, 10, "replaces through the end of 'false'");
  });

  it("inserts a leading space when the value abuts the colon (`:` trigger)", async () => {
    const doc = await openInMemory("---\ntoc:\n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 4), // right after the colon
      ":",
    );
    const item = (list?.items ?? []).find(
      (i) => i.detail === "Quarto document option value" && labelText(i) === "true",
    );
    assert.ok(item, `the 'true' value item; got ${JSON.stringify(documentValueLabels(list))}`);
    assert.strictEqual(insertTextOf(item), " true", "leading space added");
  });

  it("resolves a SCHEMA-ONLY key's value enum (`editor` → source/visual)", async () => {
    const doc = await openInMemory("---\neditor: \n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 8), // the value slot after "editor: "
    );
    const labels = documentValueLabels(list);
    for (const v of ["source", "visual"]) {
      assert.ok(labels.includes(v), `editor value ${v}; got ${JSON.stringify(labels)}`);
    }
  });

  it("offers NO value items at the key slot", async () => {
    const doc = await openInMemory("---\ntoc: false\n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 0), // the key slot, not a value position
    );
    assert.deepStrictEqual(documentValueLabels(list), [], "no value items at the key");
  });

  it("offers NO values for a key with no enum (`title: `)", async () => {
    const doc = await openInMemory("---\ntitle: \n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 7), // value position after "title: "
    );
    assert.deepStrictEqual(documentValueLabels(list), [], "no values for a free-text key");
  });

  it("offers NO document value items in a cell-option value position (no cross-pollution)", async () => {
    const doc = await openInMemory("```{python}\n#| echo: false\n```\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 9), // cell-option value position
    );
    assert.deepStrictEqual(documentValueLabels(list), [], "no document values in a cell");
  });

  it("offers NO document value items on a prose line with a colon (`:` must not pop)", async () => {
    const doc = await openInMemory("Some prose.\n\nA note: here.\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(2, 8), // after "A note: "
      ":",
    );
    assert.deepStrictEqual(documentValueLabels(list), [], "no document values in prose");
  });
});
