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

  it("does NOT offer top-level-only keys on a nested execute line (gating)", async () => {
    const doc = await openFixture();
    // Line 3 "  enabled: false" — nested under execute:. Top-level-only document
    // keys (`title`, the schema-only `csl`) must NOT appear here; only execute
    // children do (asserted positively in the 6d-6 block).
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(3, 2),
    );
    const labels = documentOptionLabels(list);
    assert.ok(!labels.includes("title"), `top-level 'title' must not leak into a nested slot; got ${JSON.stringify(labels)}`);
    assert.ok(!labels.includes("csl"), "schema-only top-level 'csl' must not leak into a nested slot");
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

  it("offers NO document value items on a prose line with an enum key (discriminating)", async () => {
    // `toc` HAS a value enum, so were front-matter value gating to leak into prose
    // (a `toc:` line with no `---` block), its true/false WOULD appear — making this
    // negative able to fail. A non-enum key (`A note:`) would pass trivially.
    const doc = await openInMemory("Some prose.\n\ntoc: here\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(2, 5), // value slot after "toc: "
      ":",
    );
    assert.deepStrictEqual(documentValueLabels(list), [], "no document values in prose");
  });
});

/**
 * Slice 6d-6 — nested KEY completion one level under the `execute:` container.
 * The provider offers the curated execute children there, and ONLY there: not at
 * the top level (a cell-shared flag like `echo`/`eval`/`warning` is NOT a
 * `document-*` key, so it is a clean nested-only discriminator), not under a
 * non-allow-listed container, and not in prose/cells. The set is curated-only in
 * v1 (the live schema assembles the execute object across files — deferred), so
 * the positive cases are environment-independent.
 */
describe("Quarto: YAML nested execute-key completion (6d-6)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("offers the execute children on an indented line under execute:", async () => {
    const doc = await openFixture();
    // Line 3 "  enabled: false" — col 2 is the nested key slot under execute:.
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(3, 2),
    );
    const labels = documentOptionLabels(list);
    for (const expected of ["echo", "eval", "enabled", "freeze", "keep-md"]) {
      assert.ok(
        labels.includes(expected),
        `should offer execute child ${expected}; got ${JSON.stringify(labels)}`,
      );
    }
  });

  it("completes a partially-typed nested key (`ec` → echo/eval)", async () => {
    const doc = await openInMemory("---\nexecute:\n  ec\n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(2, 4), // after the partial nested key "ec"
    );
    const labels = documentOptionLabels(list);
    assert.ok(labels.includes("echo") && labels.includes("eval"), `got ${JSON.stringify(labels)}`);
  });

  it("nested replace range covers the whole key token", async () => {
    const doc = await openInMemory("---\nexecute:\n  freeze: auto\n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(2, 4), // inside "fr|eeze"; key spans [2,8)
    );
    const item = (list?.items ?? []).find((i) => i.detail === "Quarto document option");
    assert.ok(item, "at least one document-key item");
    const range = replaceRange(item);
    assert.ok(range, "the item carries a replace range");
    assert.strictEqual(range.start.character, 2, "replaces from the nested key start");
    assert.strictEqual(range.end.character, 8, "replaces through the end of 'freeze'");
  });

  it("does NOT offer a nested-only execute child (`echo`) at the top level (no leak)", async () => {
    // `echo` is a cell-shared execution flag, not a `document-*` key, so it must
    // appear ONLY under execute: — never at the document root. This pairs with the
    // positive above to prove the nested path runs without cross-polluting top level.
    const doc = await openInMemory("---\nti\n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 2), // a top-level key slot
    );
    const labels = documentOptionLabels(list);
    assert.ok(!labels.includes("echo"), `'echo' must not appear at top level; got ${JSON.stringify(labels.slice(0, 12))}…`);
    assert.ok(!labels.includes("eval"), "'eval' must not appear at top level");
  });

  it("bails under a non-allow-listed container (`website:`)", async () => {
    const doc = await openInMemory("---\nwebsite:\n  ti\n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(2, 4), // nested under website:, not allow-listed
    );
    assert.deepStrictEqual(documentOptionLabels(list), [], "no nested keys under a non-container");
  });

  it("offers NO execute keys on an indented prose line (gating)", async () => {
    const doc = await openInMemory("Some prose.\n\n  echo\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(2, 4), // an indented line in prose, no front matter
    );
    assert.deepStrictEqual(documentOptionLabels(list), [], "no execute keys outside front matter");
  });
});

/**
 * Slice 6d-6 (continuation) — nested VALUE completion on a `key:` line one level
 * under the `execute:` container. The provider offers that child's grounded value
 * enum (the [container, key] path resolves the RIGHT key), with the same colon-
 * abutting leading-space and whole-token replace-range behavior as a top-level
 * value, and ONLY there: not under a non-allow-listed container, and the existing
 * top-level value path is unchanged. Curated-only in v1, so env-independent.
 */
describe("Quarto: YAML nested execute-value completion (6d-6 cont.)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("offers values for a cell-shared flag absent from the flat document list (`  echo: ` → true/false/fenced)", async () => {
    // echo/eval/output/warning/error/include live in schema/cell-*.yml, NOT in any
    // document-*.yml, so they are absent from frontMatterKeys([]). Their nested
    // values resolve ONLY via frontMatterKeys(["execute"]) (the curated execute
    // set) — the faithful discriminator that the [container] lookup runs (a
    // top-level lookup, as before this slice, would offer nothing here).
    const doc = await openInMemory("---\nexecute:\n  echo: \n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(2, 8), // value slot after "  echo: "
    );
    const labels = documentValueLabels(list);
    for (const expected of ["true", "false", "fenced"]) {
      assert.ok(
        labels.includes(expected),
        `should offer echo value ${expected}; got ${JSON.stringify(labels)}`,
      );
    }
  });

  it("offers a nested child's value enum (`  cache: ` → true/false/refresh)", async () => {
    const doc = await openInMemory("---\nexecute:\n  cache: \n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(2, 9), // value slot after "  cache: "
    );
    const labels = documentValueLabels(list);
    for (const expected of ["true", "false", "refresh"]) {
      assert.ok(
        labels.includes(expected),
        `should offer cache value ${expected}; got ${JSON.stringify(labels)}`,
      );
    }
  });

  it("resolves the RIGHT key under execute (`freeze` has `auto`, not `refresh`)", async () => {
    // The [container, key] parentPath must name the key being valued: `freeze`
    // offers `auto` (its enum) and NOT `refresh` (which belongs to `cache`). This
    // proves the per-key lookup, not just that some execute value appears.
    const doc = await openInMemory("---\nexecute:\n  freeze: \n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(2, 10), // value slot after "  freeze: "
    );
    const labels = documentValueLabels(list);
    assert.ok(labels.includes("auto"), `freeze should offer 'auto'; got ${JSON.stringify(labels)}`);
    assert.ok(!labels.includes("refresh"), "freeze must NOT offer cache's 'refresh'");
  });

  it("inserts a leading space when the nested value abuts the colon (`:` trigger)", async () => {
    const doc = await openInMemory("---\nexecute:\n  cache:\n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(2, 8), // right after the colon
      ":",
    );
    const item = (list?.items ?? []).find(
      (i) => i.detail === "Quarto document option value" && labelText(i) === "true",
    );
    assert.ok(item, `the 'true' value item; got ${JSON.stringify(documentValueLabels(list))}`);
    assert.strictEqual(insertTextOf(item), " true", "leading space added");
  });

  it("nested value replace range covers the whole value token", async () => {
    const doc = await openInMemory("---\nexecute:\n  freeze: auto\n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(2, 10), // value "auto" spans [10,14)
    );
    const item = (list?.items ?? []).find(
      (i) => i.detail === "Quarto document option value",
    );
    assert.ok(item, "at least one document value item");
    const range = replaceRange(item);
    assert.ok(range, "the item carries a replace range");
    assert.strictEqual(range.start.character, 10, "replaces from the value start");
    assert.strictEqual(range.end.character, 14, "replaces through the end of 'auto'");
  });

  it("leaves the top-level value path unchanged (`toc: ` → true/false, no regression)", async () => {
    // The provider now looks up frontMatterKeys(parentPath.slice(0,-1)); for a
    // top-level value parentPath=[key] that slice is [], so the top-level path is
    // preserved. A nested-only value (`refresh`) must not leak up here.
    const doc = await openInMemory("---\ntoc: \n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 5), // top-level value slot after "toc: "
    );
    const labels = documentValueLabels(list);
    assert.ok(labels.includes("true") && labels.includes("false"), `toc true/false; got ${JSON.stringify(labels)}`);
    assert.ok(!labels.includes("refresh"), "a nested-only value must not leak to top level");
  });

  it("offers NO nested values under a non-allow-listed container (`website:`)", async () => {
    // Keyed on `cache`, which WOULD offer true/false/refresh under execute: — so a
    // value-gate leak under a non-allow-listed container would surface those values
    // and fail this test (Learning #29e: key a negative on enum-bearing data).
    const doc = await openInMemory("---\nwebsite:\n  cache: x\n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(2, 9), // value slot under a non-container
    );
    assert.deepStrictEqual(documentValueLabels(list), [], "no nested values under a non-container");
  });
});

/**
 * Slice 6d-6 (continuation) — nested KEY completion under the `format:` container,
 * where the children are Quarto OUTPUT-FORMAT names (`html`, `pdf`, `revealjs`, …).
 * Unlike the curated execute children, the format list is reader-derived from the
 * live `pandoc/formats.yml` (the host has the real Quarto CLI — Learning #9), so a
 * SCHEMA-ONLY format absent from the curated fallback (`texinfo`) proves the reader
 * ran end-to-end, and the legacy variants Quarto hides (`html4`/`html5`) prove the
 * `hideFormat` filter ran. Format names appear ONLY under `format:` — never at the
 * document root (no cross-pollution) — and a per-format-options position (the value
 * after a format name) benignly offers nothing (a deferred deeper slice).
 */
describe("Quarto: YAML nested format-name completion (6d-6 cont.)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("offers output-format names on an indented line under format:, hiding legacy variants", async () => {
    const doc = await openInMemory("---\nformat:\n  \n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(2, 2), // blank indented key slot under format:
    );
    const labels = documentOptionLabels(list);
    for (const expected of ["html", "pdf", "docx", "revealjs", "beamer"]) {
      assert.ok(
        labels.includes(expected),
        `should offer format ${expected}; got ${JSON.stringify(labels.slice(0, 12))}…`,
      );
    }
    // Quarto's hideFormat suppresses the longer html/epub/docbook variants.
    for (const hidden of ["html4", "html5", "epub2", "epub3", "docbook4", "docbook5"]) {
      assert.ok(!labels.includes(hidden), `legacy variant ${hidden} must be hidden`);
    }
  });

  it("enriches with a SCHEMA-ONLY format absent from the curated fallback (`texinfo`)", async () => {
    // texinfo is in the live pandoc/formats.yml but NOT in CURATED_FORMAT_NAMES, so a
    // green here can ONLY come from the runtime reader (cf. the 6d-3 code-overflow /
    // 6d-4 csl enrichment proofs).
    const doc = await openInMemory("---\nformat:\n  \n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(2, 2),
    );
    const labels = documentOptionLabels(list);
    assert.ok(
      labels.includes("texinfo"),
      `reader should enrich format names with texinfo; got ${labels.length} formats: ${JSON.stringify(labels.slice(0, 8))}…`,
    );
  });

  it("nested replace range covers the whole format-name token", async () => {
    const doc = await openInMemory("---\nformat:\n  revealjs\n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(2, 4), // inside "re|vealjs"; token spans [2,10)
    );
    const item = (list?.items ?? []).find((i) => i.detail === "Quarto document option");
    assert.ok(item, "at least one document-key item");
    const range = replaceRange(item);
    assert.ok(range, "the item carries a replace range");
    assert.strictEqual(range.start.character, 2, "replaces from the nested key start");
    assert.strictEqual(range.end.character, 10, "replaces through the end of 'revealjs'");
  });

  it("does NOT offer a format name (`revealjs`) at the top level (no leak)", async () => {
    // revealjs is a format name, not a `document-*` key, so it must appear ONLY under
    // format: — never at the document root. Pairs with the positive above to prove the
    // nested format path runs without cross-polluting the top level.
    const doc = await openInMemory("---\nre\n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 2), // a top-level key slot
    );
    const labels = documentOptionLabels(list);
    assert.ok(!labels.includes("revealjs"), `'revealjs' must not appear at top level; got ${JSON.stringify(labels.slice(0, 12))}…`);
  });

  it("bails under a non-allow-listed container (`website:`)", async () => {
    const doc = await openInMemory("---\nwebsite:\n  htm\n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(2, 5), // nested under website:, not allow-listed
    );
    assert.deepStrictEqual(documentOptionLabels(list), [], "no format names under a non-container");
  });

  it("offers NO format names on an indented prose line (gating)", async () => {
    const doc = await openInMemory("Some prose.\n\n  html\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(2, 4), // an indented line in prose, no front matter
    );
    assert.deepStrictEqual(documentOptionLabels(list), [], "no format names outside front matter");
  });

  it("offers NO values for a per-format-options position (`  html: …` is deferred)", async () => {
    // The value after a format name is where per-format options would nest — a
    // deferred deeper slice. A format name carries no value enum, so the provider
    // benignly offers nothing here rather than wrong values.
    const doc = await openInMemory("---\nformat:\n  html: default\n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(2, 10), // value slot after "  html: "
    );
    assert.deepStrictEqual(documentValueLabels(list), [], "no values offered for a format name");
  });
});

/**
 * Slice 6d-6+ — top-level `format:` SCALAR value completion. After the colon on a
 * top-level `format:` line (`format: <here>`), the provider offers the same
 * output-format names it offers as KEYS one level under `format:` — surfaced as
 * the `format` key's value enum (the flat document-key list models `format` only
 * as an epub-scoped string with no enum, a name collision). The provider is
 * UNCHANGED: the generic `frontmatter-value` path resolves them. Reader-derived
 * (the host has the real Quarto CLI — Learning #9), so a SCHEMA-ONLY format absent
 * from the curated fallback (`texinfo`) proves the reader ran end-to-end; the
 * names appear ONLY as the `format:` value (never on another key — no leak).
 */
describe("Quarto: YAML top-level format scalar value completion (6d-6+)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("completes output-format names as the top-level `format:` value", async () => {
    const doc = await openInMemory("---\nformat: \n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 8), // the value slot after "format: "
    );
    const labels = documentValueLabels(list);
    for (const expected of ["html", "pdf", "docx", "revealjs", "beamer"]) {
      assert.ok(
        labels.includes(expected),
        `should offer format value ${expected}; got ${JSON.stringify(labels.slice(0, 12))}…`,
      );
    }
    // Quarto's hideFormat suppresses the longer html/epub/docbook variants — they
    // must not be offered as values either.
    for (const hidden of ["html4", "html5", "epub2", "epub3", "docbook4", "docbook5"]) {
      assert.ok(!labels.includes(hidden), `legacy variant ${hidden} must be hidden`);
    }
  });

  it("enriches with a SCHEMA-ONLY format absent from the curated fallback (`texinfo`)", async () => {
    // texinfo is in the live pandoc/formats.yml but NOT in CURATED_FORMAT_NAMES, so a
    // green here can ONLY come from the runtime reader (gate d) — break-revert-provable
    // by forcing quartoSharePath to throw (texinfo disappears, curated html stays).
    const doc = await openInMemory("---\nformat: \n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 8),
    );
    const labels = documentValueLabels(list);
    assert.ok(
      labels.includes("texinfo"),
      `reader should enrich format values with texinfo; got ${labels.length} formats: ${JSON.stringify(labels.slice(0, 8))}…`,
    );
  });

  it("inserts a leading space when the value abuts the colon (`:` trigger)", async () => {
    const doc = await openInMemory("---\nformat:\n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 7), // right after the colon
      ":",
    );
    const item = (list?.items ?? []).find(
      (i) => i.detail === "Quarto document option value" && labelText(i) === "html",
    );
    assert.ok(item, `the 'html' value item; got ${JSON.stringify(documentValueLabels(list).slice(0, 8))}…`);
    assert.strictEqual(insertTextOf(item), " html", "leading space added");
  });

  it("value replace range covers the whole format-name token", async () => {
    const doc = await openInMemory("---\nformat: html\n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 8), // value "html" spans [8,12)
    );
    const item = (list?.items ?? []).find(
      (i) => i.detail === "Quarto document option value",
    );
    assert.ok(item, "at least one document value item");
    const range = replaceRange(item);
    assert.ok(range, "the item carries a replace range");
    assert.strictEqual(range.start.character, 8, "replaces from the value start");
    assert.strictEqual(range.end.character, 12, "replaces through the end of 'html'");
  });

  it("does NOT offer a format name (`html`) as another key's value (no leak)", async () => {
    // `toc` has its own enum (true/false), so were the format-name enrichment to leak
    // onto every key's values, `html` WOULD appear here — making this negative able to
    // fail (Learning #29e: key a negative on enum-bearing data).
    const doc = await openInMemory("---\ntoc: \n---\n");
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(1, 5), // the value slot after "toc: "
    );
    const labels = documentValueLabels(list);
    assert.ok(labels.includes("false"), `toc still offers its own enum; got ${JSON.stringify(labels)}`);
    assert.ok(!labels.includes("html"), `'html' must not leak onto toc's values; got ${JSON.stringify(labels)}`);
  });
});
