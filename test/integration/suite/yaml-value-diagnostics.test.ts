import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";

const EXTENSION_ID = "rmsharp.vscode-quarto-ext";
const DIAGNOSTIC_CODE = "quarto-invalid-option-value";

// out/test/integration/suite -> project root
const ROOT = path.resolve(__dirname, "../../../..");
const CELL_OPTIONS = path.resolve(ROOT, "test/fixtures/yaml-value-diagnostics/cell-options.qmd");
const VALID_CELLS = path.resolve(ROOT, "test/fixtures/yaml-value-diagnostics/valid-cells.qmd");
const FRONT_MATTER = path.resolve(ROOT, "test/fixtures/yaml-value-diagnostics/front-matter.qmd");
const VALID_FRONT_MATTER = path.resolve(ROOT, "test/fixtures/yaml-value-diagnostics/valid-front-matter.qmd");
const NESTED_FRONT_MATTER = path.resolve(ROOT, "test/fixtures/yaml-value-diagnostics/nested-front-matter.qmd");
const VALID_NESTED_FRONT_MATTER = path.resolve(ROOT, "test/fixtures/yaml-value-diagnostics/valid-nested-front-matter.qmd");
const NUMERIC_FRONT_MATTER = path.resolve(ROOT, "test/fixtures/yaml-value-diagnostics/numeric-front-matter.qmd");
const VALID_NUMERIC_FRONT_MATTER = path.resolve(ROOT, "test/fixtures/yaml-value-diagnostics/valid-numeric-front-matter.qmd");
const CONTAINER_VALUES = path.resolve(ROOT, "test/fixtures/yaml-value-diagnostics/container-values.qmd");
const VALID_CONTAINER_VALUES = path.resolve(ROOT, "test/fixtures/yaml-value-diagnostics/valid-container-values.qmd");
const ASPECTRATIO_FRONT_MATTER = path.resolve(ROOT, "test/fixtures/yaml-value-diagnostics/aspectratio-front-matter.qmd");
const INVALID_FORMAT_NAME = path.resolve(ROOT, "test/fixtures/format-name/invalid.qmd");
const VALID_FORMAT_NAME = path.resolve(ROOT, "test/fixtures/format-name/valid.qmd");
const VALID_ASPECTRATIO_FRONT_MATTER = path.resolve(
  ROOT,
  "test/fixtures/yaml-value-diagnostics/valid-aspectratio-front-matter.qmd",
);

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return predicate();
}

async function openActive(file: string): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument(file);
  await vscode.window.showTextDocument(doc);
  return doc;
}

/** Only THIS feature's diagnostics (not the unknown-key sibling, which shares source "Quarto"). */
function valueDiagnostics(uri: vscode.Uri): vscode.Diagnostic[] {
  return vscode.languages.getDiagnostics(uri).filter((d) => d.code === DIAGNOSTIC_CODE);
}

describe("Quarto: cell-option VALUE diagnostics (.qmd, plan §4.1 Phase 1)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("flags exactly the 3 wrong closed-set values, and NOTHING for open/valid values", async () => {
    const doc = await openActive(CELL_OPTIONS);
    assert.ok(
      await waitFor(() => valueDiagnostics(doc.uri).length >= 3, 5000),
      "expected value diagnostics to appear within 5s of opening",
    );

    const diags = valueDiagnostics(doc.uri);
    assert.strictEqual(
      diags.length,
      3,
      `expected exactly 3, got: ${diags.map((d) => `${d.range.start.line}:${d.message}`).join(" | ")}`,
    );

    const byLine = new Map(diags.map((d) => [d.range.start.line, d]));
    // echo: maybe (line 7) — closed boolean, arbitrary string.
    assert.ok(byLine.get(7)?.message.includes("maybe"), "echo: maybe should flag on line 7");
    // code-overflow: banana (line 14) — closed string enum.
    assert.ok(byLine.get(14)?.message.includes("banana"), "code-overflow: banana should flag on line 14");
    // echo: "true" (line 16) — a QUOTED boolean is a string → rejected.
    assert.ok(byLine.get(16), "echo: \"true\" (quoted boolean) should flag on line 16");

    for (const d of diags) {
      assert.strictEqual(d.severity, vscode.DiagnosticSeverity.Error);
      assert.strictEqual(d.code, DIAGNOSTIC_CODE);
    }
  });

  it("never flags an OPEN set — output (anyOf free arm) or animation-hook (string.completions)", async () => {
    const doc = await openActive(CELL_OPTIONS);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 3, 5000));
    const lines = valueDiagnostics(doc.uri).map((d) => d.range.start.line);
    // output: banana (line 9) and animation-hook: myhook (line 15) both render exit 0 →
    // the cardinal-sin guard must leave them unflagged even with a bogus value.
    assert.ok(!lines.includes(9), "output: banana (open anyOf) must NOT be flagged");
    assert.ok(!lines.includes(15), "animation-hook: myhook (open string.completions) must NOT be flagged");
    // eval: true (line 8) is a valid boolean — also unflagged.
    assert.ok(!lines.includes(8), "eval: true (valid) must NOT be flagged");
  });

  it("targets the VALUE token range, not the whole line (echo: maybe → the `maybe` span)", async () => {
    const doc = await openActive(CELL_OPTIONS);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 3, 5000));
    const d = valueDiagnostics(doc.uri).find((x) => x.range.start.line === 7);
    assert.ok(d);
    // `#| echo: maybe` — `maybe` starts at column 9.
    assert.strictEqual(d.range.start.character, 9, "range should start at the value token");
    assert.strictEqual(d.range.end.character, 14, "range should end at the value token");
  });

  it("produces ZERO diagnostics for a .qmd whose cell-option values are all valid or open", async () => {
    const doc = await openActive(VALID_CELLS);
    await new Promise((r) => setTimeout(r, 400));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "first check");
    await new Promise((r) => setTimeout(r, 500));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "second check, later");
  });

  it("never flags a `key:: value` CELL OPTION — the separator FP (P2, the fourth surface)", async () => {
    // The fourth value enumerator carrying this defect — found by the §9 review, not by
    // my own battery, which varied the surface but never the cell-option axis. `slotsOf`
    // (core/qmd/model.ts) splits at the first colon, so `#| echo:: banana` was read as key
    // `echo` with the bogus value `: banana` and flagged, though quarto renders it exit 0
    // (grounded single-valued: `#| echo:: true` and `#| echo:: banana` both exit 0, while
    // `#| echo: banana` and `#| echo:banana` both exit 1).
    const doc = await openActive(VALID_CELLS);
    await new Promise((r) => setTimeout(r, 500));
    const line = doc.getText().split(/\r?\n/).findIndex((t) => t === "#| echo:: banana");
    assert.ok(line >= 0, "fixture drift: the `#| echo:: banana` row is gone");
    const hit = valueDiagnostics(doc.uri).find((d) => d.range.start.line === line);
    assert.ok(hit === undefined, `#| echo:: banana renders exit 0 and must NOT be flagged (got: ${hit?.message})`);
  });

  it("re-scans live on edit (debounced) and drops a diagnostic once the value is fixed", async () => {
    const doc = await openActive(CELL_OPTIONS);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 3, 5000));

    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);
    await editor.edit((builder) => {
      builder.replace(doc.lineAt(7).range, "#| echo: false");
    });

    assert.ok(
      await waitFor(() => valueDiagnostics(doc.uri).length === 2, 3000),
      "fixing echo: maybe → echo: false should drop the count from 3 to 2 after the debounce",
    );
  });
});

describe("Quarto: top-level front-matter VALUE diagnostics (.qmd, plan §4.2 Phase 2)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("flags exactly the 6 wrong top-level values (incl. the unknown format name), and NOTHING for open/valid/free-string", async () => {
    const doc = await openActive(FRONT_MATTER);
    assert.ok(
      await waitFor(() => valueDiagnostics(doc.uri).length >= 6, 5000),
      "expected front-matter value diagnostics to appear within 5s of opening",
    );

    const diags = valueDiagnostics(doc.uri);
    assert.strictEqual(
      diags.length,
      6,
      `expected exactly 6, got: ${diags.map((d) => `${d.range.start.line}:${d.message}`).join(" | ")}`,
    );

    const byLine = new Map(diags.map((d) => [d.range.start.line, d]));
    // toc: yes (line 1) — closed boolean, bare non-boolean string.
    assert.ok(byLine.get(1)?.message.includes("yes"), "toc: yes should flag on line 1");
    // number-sections: "false" (line 2) — a QUOTED boolean is a string → rejected.
    assert.ok(byLine.get(2), 'number-sections: "false" (quoted boolean) should flag on line 2');
    // df-print: banana (line 3) — closed string enum, total non-member.
    assert.ok(byLine.get(3)?.message.includes("banana"), "df-print: banana should flag on line 3");
    // format: htlm (line 6) — unknown output-format NAME (schema-rejected typo of `html`),
    // validated by the bespoke format-name predicate (format-name validation plan §3.1).
    assert.ok(
      byLine.get(6)?.message.includes("htlm"),
      "format: htlm (unknown output format) should flag on line 6",
    );
    assert.ok(
      byLine.get(6)?.message.includes("Unknown output format"),
      "the format-name message is the bespoke one, not the closed-enum message",
    );
    // cache: banana (line 8) — enum whose members include booleans ([true,false,refresh]); banana is off-list.
    assert.ok(byLine.get(8)?.message.includes("banana"), "cache: banana should flag on line 8");
    // pdf-engine: PDFLATEX (line 9) — closed string enum, WRONG CASE (membership is case-sensitive).
    assert.ok(byLine.get(9)?.message.includes("PDFLATEX"), "pdf-engine: PDFLATEX (wrong case) should flag on line 9");

    for (const d of diags) {
      assert.strictEqual(d.severity, vscode.DiagnosticSeverity.Error);
      assert.strictEqual(d.code, DIAGNOSTIC_CODE);
    }
  });

  it("flags an unknown top-level `format` NAME but never an OPEN field, a valid boolean, or a free string", async () => {
    const doc = await openActive(FRONT_MATTER);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 6, 5000));
    const lines = valueDiagnostics(doc.uri).map((d) => d.range.start.line);
    // documentclass: myclass (line 5) — OPEN string.completions → never flagged.
    assert.ok(!lines.includes(5), "documentclass: myclass (open) must NOT be flagged");
    // format: htlm (line 6) — an unknown output-format NAME is now VALIDATED against
    // quarto's front-matter schema layer and flagged (format-name validation plan §3.1).
    assert.ok(lines.includes(6), "format: htlm (unknown output format) MUST be flagged");
    // citations-hover: true (line 4) is a valid boolean; title: (line 7) is a free string.
    assert.ok(!lines.includes(4), "citations-hover: true (valid) must NOT be flagged");
    assert.ok(!lines.includes(7), "title: (free string) must NOT be flagged");
  });

  it("targets the VALUE token range, not the whole line (df-print: banana → the `banana` span)", async () => {
    const doc = await openActive(FRONT_MATTER);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 3, 5000));
    const d = valueDiagnostics(doc.uri).find((x) => x.range.start.line === 3);
    assert.ok(d);
    // `df-print: banana` — `banana` starts at column 10.
    assert.strictEqual(d.range.start.character, 10, "range should start at the value token");
    assert.strictEqual(d.range.end.character, 16, "range should end at the value token");
  });

  it("produces ZERO diagnostics for a .qmd whose front-matter values are all valid or open", async () => {
    const doc = await openActive(VALID_FRONT_MATTER);
    await new Promise((r) => setTimeout(r, 400));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "first check");
    await new Promise((r) => setTimeout(r, 500));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "second check, later");
  });

  it("never flags a YAML null on a null-admitting top-level field (auto-play-media/preload-iframes/ipynb-shell-interactivity)", async () => {
    // The null-arm lock (document-key plan §2.5, prerequisite P). Before the `acceptsNull`
    // fix these three lines were flagged although `quarto render` 1.7.33 exits 0 on each —
    // `valuesOfSchema` drops the literal `null` enum member while `closednessOfSchema` still
    // marks the field CLOSED. Asserted per-line so a regression names the offending row.
    const doc = await openActive(VALID_FRONT_MATTER);
    await new Promise((r) => setTimeout(r, 500));
    const byLine = new Map(valueDiagnostics(doc.uri).map((d) => [d.range.start.line, d.message]));
    for (const [line, label] of [
      [8, "auto-play-media: null"],
      [9, "preload-iframes: ~"],
      [10, "ipynb-shell-interactivity: NULL"],
    ] as const) {
      // (line numbers unshifted — the P2 separator rows were appended BELOW these)
      assert.ok(
        !byLine.has(line),
        `${label} renders exit 0 and must NOT be flagged (got: ${byLine.get(line)})`,
      );
    }
  });

  it("re-scans live on edit (debounced) and drops a diagnostic once a value is fixed", async () => {
    const doc = await openActive(FRONT_MATTER);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 6, 5000));

    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);
    await editor.edit((builder) => {
      builder.replace(doc.lineAt(1).range, "toc: true");
    });

    assert.ok(
      await waitFor(() => valueDiagnostics(doc.uri).length === 5, 3000),
      "fixing toc: yes → toc: true should drop the count from 6 to 5 after the debounce",
    );
  });
});

describe("Quarto: scalar `format:` NAME validation (.qmd, Combo 1, format-name plan §3.1)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  /**
   * Open a `.qmd` from inline content as an (unshown) untitled `quarto` document —
   * the value feature gates on languageId only, so `onDidOpenTextDocument` primes
   * it without an editor to close (no dirty-untitled save prompt). Unique URI per
   * call, so diagnostics never bleed between battery cases.
   */
  async function openInline(content: string): Promise<vscode.TextDocument> {
    return vscode.workspace.openTextDocument({ language: "quarto", content });
  }

  it("flags an unknown format NAME (format: banana) with the bespoke message over the value token span", async () => {
    const doc = await openActive(INVALID_FORMAT_NAME);
    assert.ok(
      await waitFor(() => valueDiagnostics(doc.uri).length >= 1, 5000),
      "expected a format-name diagnostic within 5s of opening",
    );
    const diags = valueDiagnostics(doc.uri);
    assert.strictEqual(diags.length, 1, `expected exactly 1, got: ${diags.map((d) => d.message).join(" | ")}`);
    const d = diags[0];
    assert.strictEqual(d.range.start.line, 2, "the diagnostic is on the `format: banana` line (0-based line 2)");
    assert.strictEqual(d.message, "Unknown output format banana.");
    // `format: banana` — `banana` starts at column 8, ends at column 14.
    assert.strictEqual(d.range.start.character, 8, "range starts at the value token");
    assert.strictEqual(d.range.end.character, 14, "range ends at the value token");
    assert.strictEqual(d.severity, vscode.DiagnosticSeverity.Error);
    assert.strictEqual(d.code, DIAGNOSTIC_CODE);
  });

  it("produces ZERO diagnostics for a valid format (format: revealjs)", async () => {
    const doc = await openActive(VALID_FORMAT_NAME);
    await new Promise((r) => setTimeout(r, 500));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "first check");
    await new Promise((r) => setTimeout(r, 500));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "second check, later");
  });

  // Each unknown/schema-rejected name → exactly one flag on the format line (line 1).
  // `foo-bar` is the sharp one: the render-dispatch `parseFormatString` ACCEPTS it,
  // but the front-matter SCHEMA layer (which we mirror) REJECTS it; `html-` is a bare
  // trailing delimiter the `([-+].+)` suffix cannot satisfy.
  for (const name of ["reveal", "word", "foo-bar", "html-"]) {
    it(`flags the unknown format name '${name}'`, async () => {
      const doc = await openInline(`---\nformat: ${name}\n---\n\nBody.\n`);
      assert.ok(
        await waitFor(() => valueDiagnostics(doc.uri).length >= 1, 5000),
        `expected '${name}' to be flagged within 5s`,
      );
      const diags = valueDiagnostics(doc.uri);
      assert.strictEqual(diags.length, 1, `expected exactly 1 for '${name}', got ${diags.length}`);
      assert.strictEqual(diags[0].range.start.line, 1, "on the format line");
      assert.ok(diags[0].message.includes("Unknown output format"), "uses the bespoke format-name message");
    });
  }

  // The FP battery — every form quarto's front-matter SCHEMA layer ACCEPTS must stay
  // silent. A `df-print: banana` CANARY (line 1) MUST flag, proving the schema loaded
  // and the compute ran in the SAME atomic pass; the assertion is then that the
  // `format:` line (line 2) is NOT among the flagged lines (an FP-safe true negative).
  // Covers: hidden legacy variant, extension format, base+modifier, extension+modifier,
  // custom .lua writer, flow list (itself schema-invalid → FP-safe FN skip), quoted,
  // and a synthesized format.
  for (const name of [
    "html5",
    "foo-html",
    "markdown+emoji",
    "html-smart",
    "foo-html-smart",
    "my-writer.lua",
    "foolua", // NO literal dot — quarto's wildcard-dot lua schema accepts it (§9-review fix, S145)
    "[html, pdf]",
    '"revealjs"',
    "dashboard",
  ]) {
    it(`does NOT flag the schema-accepted form 'format: ${name}' (canary proves the pass ran)`, async () => {
      const doc = await openInline(`---\ndf-print: banana\nformat: ${name}\n---\n\nBody.\n`);
      assert.ok(
        await waitFor(
          () => valueDiagnostics(doc.uri).some((d) => d.range.start.line === 1),
          5000,
        ),
        "the df-print: banana canary (line 1) should flag, proving the value pass ran",
      );
      const flaggedLines = valueDiagnostics(doc.uri).map((d) => d.range.start.line);
      assert.ok(
        !flaggedLines.includes(2),
        `format: ${name} (schema-accepted) must NOT be flagged; flagged lines: ${flaggedLines.join(",")}`,
      );
    });
  }
});

describe("Quarto: NESTED front-matter VALUE diagnostics (.qmd, nested plan §3.4 Phase 3)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("flags exactly the 5 wrong nested values (execute + format.html), and NOTHING for open/unknown", async () => {
    const doc = await openActive(NESTED_FRONT_MATTER);
    assert.ok(
      await waitFor(() => valueDiagnostics(doc.uri).length >= 5, 5000),
      "expected nested front-matter value diagnostics to appear within 5s of opening",
    );

    const diags = valueDiagnostics(doc.uri);
    assert.strictEqual(
      diags.length,
      5,
      `expected exactly 5, got: ${diags.map((d) => `${d.range.start.line}:${d.message}`).join(" | ")}`,
    );

    const byLine = new Map(diags.map((d) => [d.range.start.line, d]));
    // execute.echo: maybe (line 2) — curated closed boolean+fenced.
    assert.ok(byLine.get(2)?.message.includes("maybe"), "execute.echo: maybe should flag on line 2");
    // execute.eval: banana (line 3) — curated closed boolean.
    assert.ok(byLine.get(3)?.message.includes("banana"), "execute.eval: banana should flag on line 3");
    // format.html.toc: yes (line 8) — reader-derived closed boolean.
    assert.ok(byLine.get(8)?.message.includes("yes"), "format.html.toc: yes should flag on line 8");
    // format.html.number-sections: yes (line 9) — reader-derived closed boolean.
    assert.ok(byLine.get(9)?.message.includes("yes"), "format.html.number-sections: yes should flag on line 9");
    // format.html.df-print: banana (line 10) — reader-derived closed enum non-member.
    assert.ok(byLine.get(10)?.message.includes("banana"), "format.html.df-print: banana should flag on line 10");

    for (const d of diags) {
      assert.strictEqual(d.severity, vscode.DiagnosticSeverity.Error);
      assert.strictEqual(d.code, DIAGNOSTIC_CODE);
    }
  });

  it("never flags an OPEN nested field (output/daemon/theme) or an UNKNOWN nested key", async () => {
    const doc = await openActive(NESTED_FRONT_MATTER);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 5, 5000));
    const lines = valueDiagnostics(doc.uri).map((d) => d.range.start.line);
    // execute.output: banana (line 4) — OPEN anyOf free arm → never flagged.
    assert.ok(!lines.includes(4), "execute.output: banana (open) must NOT be flagged");
    // execute.daemon: 30 (line 5) — OPEN boolean-or-number → never flagged (numeric slice's job).
    assert.ok(!lines.includes(5), "execute.daemon: 30 (open) must NOT be flagged");
    // format.html.theme: banana (line 11) — OPEN free string → never flagged.
    assert.ok(!lines.includes(11), "format.html.theme: banana (open) must NOT be flagged");
    // format.html.notarealoption: yes (line 12) — UNKNOWN key → never flagged.
    assert.ok(!lines.includes(12), "format.html.notarealoption: yes (unknown) must NOT be flagged");
  });

  it("targets the VALUE token range at depth (format.html.toc: yes → the `yes` span)", async () => {
    const doc = await openActive(NESTED_FRONT_MATTER);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 5, 5000));
    const d = valueDiagnostics(doc.uri).find((x) => x.range.start.line === 8);
    assert.ok(d);
    // `    toc: yes` — `yes` starts at column 9 (4 indent + "toc: ").
    assert.strictEqual(d.range.start.character, 9, "range should start at the value token");
    assert.strictEqual(d.range.end.character, 12, "range should end at the value token");
  });

  it("produces ZERO diagnostics for a .qmd whose nested values are all valid or open", async () => {
    const doc = await openActive(VALID_NESTED_FRONT_MATTER);
    await new Promise((r) => setTimeout(r, 400));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "first check");
    await new Promise((r) => setTimeout(r, 500));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "second check, later");
  });

  it("never flags a YAML null on a null-admitting PER-FORMAT field (format.html.ipynb-shell-interactivity / format.revealjs.preload-iframes)", async () => {
    // The null-arm lock on the .qmd per-format surface (document-key plan §2.5, prerequisite
    // P) — a different resolution path from the top-level lock above (`frontMatterKeys(["format",
    // fmt])`, not `frontMatterKeys([])`). Both lines render exit 0 (grounded single-valued).
    const doc = await openActive(VALID_NESTED_FRONT_MATTER);
    await new Promise((r) => setTimeout(r, 500));
    const byLine = new Map(valueDiagnostics(doc.uri).map((d) => [d.range.start.line, d.message]));
    for (const [line, label, rowText] of [
      [15, "format.html.ipynb-shell-interactivity: null", "    ipynb-shell-interactivity: null"],
      [18, "format.revealjs.preload-iframes: ~", "    preload-iframes: ~"],
    ] as const) {
      // Pin the row TEXT as well as its number: inserting a fixture row above one of these
      // shifts it onto a different, also-unflagged line, so a bare `!has(line)` would keep
      // passing while silently checking the wrong row (S148 nearly did exactly that).
      assert.strictEqual(
        doc.lineAt(line).text,
        rowText,
        `fixture drift: line ${line} is no longer ${label}`,
      );
      assert.ok(
        !byLine.has(line),
        `${label} renders exit 0 and must NOT be flagged (got: ${byLine.get(line)})`,
      );
    }
  });

  it("never flags a `key:: value` TOP-LEVEL line — the separator FP (toc / fig-width)", async () => {
    // The separator lock on the .qmd top-level surface (document-key plan §2.8, prerequisite
    // P2). YAML's keys here are `toc:` and `fig-width:` — unknown on this OPEN key set, so
    // quarto renders exit 0 (both grounded single-valued). Before the guard we split at the
    // first colon and flagged the bogus `: true` / `: wide` tokens against toc's closed
    // boolean enum and fig-width's numeric branch — both matcher branches covered.
    const doc = await openActive(VALID_FRONT_MATTER);
    await new Promise((r) => setTimeout(r, 500));
    const byLine = new Map(valueDiagnostics(doc.uri).map((d) => [d.range.start.line, d.message]));
    for (const [line, label] of [
      [11, "toc:: true"],
      [12, "fig-width:: wide"],
    ] as const) {
      assert.strictEqual(
        doc.lineAt(line).text,
        label,
        `fixture drift: line ${line} is no longer ${label}`,
      );
      assert.ok(
        !byLine.has(line),
        `${label} renders exit 0 and must NOT be flagged (got: ${byLine.get(line)})`,
      );
    }
  });

  it("never flags a `key:: value` NESTED line — the separator FP (execute.echo / format.html.toc)", async () => {
    // The separator lock on the .qmd NESTED surface (document-key plan §2.8, prerequisite
    // P2) — the enumerator the plan did not name. YAML's key on `echo:: banana` is `echo:`,
    // unknown on an OPEN key set, so quarto renders exit 0 (grounded single-valued); before
    // the guard we split at the first colon and flagged the bogus value token `: banana`.
    const doc = await openActive(VALID_NESTED_FRONT_MATTER);
    await new Promise((r) => setTimeout(r, 500));
    const byLine = new Map(valueDiagnostics(doc.uri).map((d) => [d.range.start.line, d.message]));
    for (const [line, label, rowText] of [
      [8, "execute.echo:: banana", "  echo:: banana"],
      [16, "format.html.toc:: banana", "    toc:: banana"],
    ] as const) {
      assert.strictEqual(
        doc.lineAt(line).text,
        rowText,
        `fixture drift: line ${line} is no longer ${label}`,
      );
      assert.ok(
        !byLine.has(line),
        `${label} renders exit 0 and must NOT be flagged (got: ${byLine.get(line)})`,
      );
    }
  });

  it("re-scans live on edit (debounced) and drops a nested diagnostic once the value is fixed", async () => {
    const doc = await openActive(NESTED_FRONT_MATTER);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 5, 5000));

    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);
    await editor.edit((builder) => {
      builder.replace(doc.lineAt(2).range, "  echo: false");
    });

    assert.ok(
      await waitFor(() => valueDiagnostics(doc.uri).length === 4, 3000),
      "fixing execute.echo: maybe → echo: false should drop the count from 5 to 4 after the debounce",
    );
  });
});

describe("Quarto: NUMERIC front-matter VALUE diagnostics (.qmd, numeric plan §4.1 Phase 4)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("flags exactly the 4 wrong numeric values (all four surfaces), and NOTHING for valid numbers", async () => {
    const doc = await openActive(NUMERIC_FRONT_MATTER);
    assert.ok(
      await waitFor(() => valueDiagnostics(doc.uri).length >= 4, 5000),
      "expected numeric value diagnostics to appear within 5s of opening",
    );

    const diags = valueDiagnostics(doc.uri);
    assert.strictEqual(
      diags.length,
      4,
      `expected exactly 4, got: ${diags.map((d) => `${d.range.start.line}:${d.message}`).join(" | ")}`,
    );

    const byLine = new Map(diags.map((d) => [d.range.start.line, d]));
    // columns: wide (line 1) — top-level number.
    assert.ok(byLine.get(1)?.message.includes("wide"), "columns: wide should flag on line 1");
    // format.html.fig-dpi: hi (line 6) — per-format number.
    assert.ok(byLine.get(6)?.message.includes("hi"), "format.html.fig-dpi: hi should flag on line 6");
    // execute.daemon: banana (line 9) — nested number-OR-boolean. The message MUST mention
    // "number" (regression-lock the §3.4 arm ordering — daemon also has values:[true,false]
    // + acceptsBoolean, so an appended-late arm would mis-message "expected true or false").
    assert.ok(byLine.get(9)?.message.includes("banana"), "execute.daemon: banana should flag on line 9");
    assert.ok(
      byLine.get(9)?.message.includes("number"),
      `execute.daemon: banana message must mention "number", got: ${byLine.get(9)?.message}`,
    );
    // cell #| layout-ncol: two (line 24) — cell-metadata number.
    assert.ok(byLine.get(24)?.message.includes("two"), "cell #| layout-ncol: two should flag on line 24");

    for (const d of diags) {
      assert.strictEqual(d.severity, vscode.DiagnosticSeverity.Error);
      assert.strictEqual(d.code, DIAGNOSTIC_CODE);
    }
  });

  it("never flags a valid number, a number-or-boolean's valid form, or a valid boolean", async () => {
    const doc = await openActive(NUMERIC_FRONT_MATTER);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 4, 5000));
    const lines = valueDiagnostics(doc.uri).map((d) => d.range.start.line);
    // fig-width: 6.5 (2) / toc-expand: 3 (3) / format.html.fig-width: 300 (7) /
    // execute.daemon-restart: true (10) / cell #| fig-width: 3 (25) — all VALID.
    for (const [ln, desc] of [
      [2, "fig-width: 6.5 (valid number)"],
      [3, "toc-expand: 3 (number-or-boolean, number form)"],
      [7, "format.html.fig-width: 300 (valid number)"],
      [10, "execute.daemon-restart: true (valid boolean)"],
      [25, "cell #| fig-width: 3 (valid number)"],
    ] as [number, string][]) {
      assert.ok(!lines.includes(ln), `${desc} must NOT be flagged (line ${ln})`);
    }
  });

  it("targets the VALUE token range, not the whole line (columns: wide → the `wide` span)", async () => {
    const doc = await openActive(NUMERIC_FRONT_MATTER);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 4, 5000));
    const d = valueDiagnostics(doc.uri).find((x) => x.range.start.line === 1);
    assert.ok(d);
    // `columns: wide` — `wide` starts at column 9.
    assert.strictEqual(d.range.start.character, 9, "range should start at the value token");
    assert.strictEqual(d.range.end.character, 13, "range should end at the value token");
  });

  it("produces ZERO diagnostics for a .qmd whose numeric values are all valid, exotic, or open (FP battery)", async () => {
    const doc = await openActive(VALID_NUMERIC_FRONT_MATTER);
    await new Promise((r) => setTimeout(r, 400));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "first check");
    await new Promise((r) => setTimeout(r, 500));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "second check, later");
  });

  it("re-scans live on edit (debounced) and drops a numeric diagnostic once the value is fixed", async () => {
    const doc = await openActive(NUMERIC_FRONT_MATTER);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 4, 5000));

    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);
    await editor.edit((builder) => {
      builder.replace(doc.lineAt(1).range, "columns: 2");
    });

    assert.ok(
      await waitFor(() => valueDiagnostics(doc.uri).length === 3, 3000),
      "fixing columns: wide → columns: 2 should drop the count from 4 to 3 after the debounce",
    );
  });
});

describe("Quarto: OTHER-container front-matter VALUE diagnostics (.qmd, other-container plan §4.1 Phase 5)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("flags exactly the 6 wrong closed values across 6 other containers, at their value spans", async () => {
    const doc = await openActive(CONTAINER_VALUES);
    assert.ok(
      await waitFor(() => valueDiagnostics(doc.uri).length >= 6, 5000),
      "expected other-container value diagnostics to appear within 5s of opening",
    );

    const diags = valueDiagnostics(doc.uri);
    assert.strictEqual(
      diags.length,
      6,
      `expected exactly 6, got: ${diags.map((d) => `${d.range.start.line}:${d.message}`).join(" | ")}`,
    );

    // (line, value token, [startCol, endCol]) — each a wrong CLOSED child of a
    // different container, grounded to `quarto render` 1.7.33 exit 1 (schema layer).
    const expected: Array<[number, string, number, number]> = [
      [2, "banana", 12, 18], //   chapters: banana   (crossref, closed bool)
      [4, "fancy", 8, 13], //     type: fancy        (listing, closed enum)
      [6, "sunset", 9, 15], //    theme: sunset       (mermaid, closed enum)
      [8, "wysiwyg", 8, 15], //   mode: wysiwyg       (editor, closed enum)
      [10, "green", 9, 14], //    theme: green        (chalkboard, closed enum)
      [12, "sparkle", 10, 17], // effect: sparkle     (lightbox, closed enum)
    ];
    const byLine = new Map(diags.map((d) => [d.range.start.line, d]));
    for (const [line, token, startCol, endCol] of expected) {
      const d = byLine.get(line);
      assert.ok(d, `expected a diagnostic on line ${line} (value ${token})`);
      assert.ok(d.message.includes(token), `line ${line} message should name the value "${token}"`);
      assert.strictEqual(d.range.start.character, startCol, `line ${line} value should start at col ${startCol}`);
      assert.strictEqual(d.range.end.character, endCol, `line ${line} value should end at col ${endCol}`);
      assert.strictEqual(d.severity, vscode.DiagnosticSeverity.Error);
      assert.strictEqual(d.code, DIAGNOSTIC_CODE);
    }
  });

  it("produces ZERO diagnostics for the valid/open/sequence FP battery across containers", async () => {
    const doc = await openActive(VALID_CONTAINER_VALUES);
    await new Promise((r) => setTimeout(r, 400));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "first check");
    await new Promise((r) => setTimeout(r, 500));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "second check, later");
  });

  it("re-scans live on edit (debounced) and drops a container diagnostic once the value is fixed", async () => {
    const doc = await openActive(CONTAINER_VALUES);
    assert.ok(await waitFor(() => valueDiagnostics(doc.uri).length >= 6, 5000));

    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);
    await editor.edit((builder) => {
      // `  mode: wysiwyg` (editor, line 8) → a valid enum member.
      builder.replace(doc.lineAt(8).range, "  mode: visual");
    });

    assert.ok(
      await waitFor(() => valueDiagnostics(doc.uri).length === 5, 3000),
      "fixing editor.mode: wysiwyg → mode: visual should drop the count from 6 to 5 after the debounce",
    );
  });
});

describe("Quarto: ASPECTRATIO numeric-member VALUE diagnostics (.qmd, matcher plan §2.4 — both reachabilities)", () => {
  before(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} should be discoverable`);
    await ext.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("flags exactly the 2 wrong aspectratio values — top-level out-of-set + nested format.beamer quoted — each at its value span", async () => {
    const doc = await openActive(ASPECTRATIO_FRONT_MATTER);
    assert.ok(
      await waitFor(() => valueDiagnostics(doc.uri).length >= 2, 5000),
      "expected aspectratio value diagnostics to appear within 5s of opening",
    );

    const diags = valueDiagnostics(doc.uri);
    assert.strictEqual(
      diags.length,
      2,
      `expected exactly 2, got: ${diags.map((d) => `${d.range.start.line}:${d.message}`).join(" | ")}`,
    );

    const byLine = new Map(diags.map((d) => [d.range.start.line, d]));
    // top-level `aspectratio: 5` (line 2) — out-of-set number, quarto exit 1 SCHEMA.
    assert.ok(byLine.get(2)?.message.includes("aspectratio"), "top-level aspectratio: 5 should flag on line 2");
    // nested `format.beamer.aspectratio: "169"` (line 5) — quoted form, quarto rejects it.
    assert.ok(byLine.get(5)?.message.includes("aspectratio"), "nested format.beamer.aspectratio: \"169\" should flag on line 5");

    // Exact value spans (half-open): `aspectratio: ` is 13 chars → `5` at 13..14 top-level;
    // nested is 4-indented → `"169"` at 17..22.
    assert.deepStrictEqual(
      [byLine.get(2)?.range.start.character, byLine.get(2)?.range.end.character],
      [13, 14],
      "top-level aspectratio value `5` spans cols 13..14",
    );
    assert.deepStrictEqual(
      [byLine.get(5)?.range.start.character, byLine.get(5)?.range.end.character],
      [17, 22],
      "nested aspectratio value `\"169\"` spans cols 17..22",
    );

    for (const d of diags) {
      assert.strictEqual(d.severity, vscode.DiagnosticSeverity.Error);
      assert.strictEqual(d.code, DIAGNOSTIC_CODE);
    }
  });

  it("produces ZERO diagnostics for coerced-valid aspectratio (169.0 top-level, 4_3 nested) — the LIVE cardinal-sin FP is GONE (both reachabilities)", async () => {
    // Every value renders exit 0: `aspectratio: 169.0` ≡ 169 (top-level), and the nested
    // `format.beamer.aspectratio: 4_3` ≡ 43 whose Number("4_3") is NaN (the §9-review HIGH —
    // a naive Number()!==member branch would false-positive it). Before this fix, the
    // top-level 169.0 was flagged with a red Error squiggle in a real host (the shipped FP).
    const doc = await openActive(VALID_ASPECTRATIO_FRONT_MATTER);
    await new Promise((r) => setTimeout(r, 400));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "first check");
    await new Promise((r) => setTimeout(r, 500));
    assert.strictEqual(valueDiagnostics(doc.uri).length, 0, "second check, later");
  });
});
