import * as assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

/**
 * What Posit's Outline shows for the R3 grid-table shapes — the black-box observation
 * `CLAUDE.md` §Clean-room boundary requires in place of reading their AGPL-3.0 source
 * (Session 270). See `test/posit/runTest.ts` for why this host loads Posit and NOT us.
 *
 * This asserts nothing about this extension's behaviour. Its ONE assertion is the control:
 * that Posit is actually running. Everything else it PRINTS, and writes to
 * `QMD_POSIT_OUT`, so the decision it feeds is made from a recorded artefact.
 */

const workspace = process.env.QMD_POSIT_WORKSPACE ?? "";
const probes: { name: string; why: string; ext?: string }[] = JSON.parse(process.env.QMD_POSIT_PROBES ?? "[]");
const outPath = process.env.QMD_POSIT_OUT ?? "";

/** Flatten a DocumentSymbol tree to `kind:name` rows, depth-first, as the Outline shows it. */
function flatten(symbols: vscode.DocumentSymbol[], depth = 0): string[] {
  const rows: string[] = [];
  for (const s of symbols) {
    rows.push(`${"  ".repeat(depth)}${vscode.SymbolKind[s.kind]}:${s.name}`);
    rows.push(...flatten(s.children ?? [], depth + 1));
  }
  return rows;
}

describe("Posit's Outline, observed black-box (Session 270)", () => {
  const record: string[] = [];

  after(async () => {
    const text = record.join("\n") + "\n";
    console.log("\n" + text);
    if (outPath !== "") {
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await fs.writeFile(outPath, text);
    }
  });

  it("Posit's extension is present and activates", async () => {
    const ext = vscode.extensions.getExtension("quarto.quarto");
    assert.ok(ext !== undefined, "quarto.quarto is not installed in the throwaway extensions dir");
    await ext.activate();
    record.push(`extension: quarto.quarto ${ext.packageJSON.version as string} — active=${String(ext.isActive)}`);
    record.push(`ours-loaded: ${String(vscode.extensions.all.some((e) => e.id.toLowerCase().includes("vscode-quarto-ext")))}`);
    record.push("");
  });

  for (const probe of probes) {
    it(`Outline for ${probe.name}`, async () => {
      const uri = vscode.Uri.file(path.join(workspace, `${probe.name}.${probe.ext ?? "qmd"}`));
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: false });
      // Posit's provider may register a moment after activation; poll rather than race.
      let symbols: vscode.DocumentSymbol[] = [];
      for (let attempt = 0; attempt < 20; attempt++) {
        symbols =
          (await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            "vscode.executeDocumentSymbolProvider",
            uri,
          )) ?? [];
        if (symbols.length > 0) {
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      const rows = flatten(symbols);
      record.push(`## ${probe.name}.${probe.ext ?? "qmd"} — ${probe.why}`);
      record.push(rows.length === 0 ? "   (no symbols)" : rows.map((r) => `   ${r}`).join("\n"));
      record.push("");

      if (probe.name === "control" || probe.name === "control_rmd") {
        // THE ONE ASSERTION. Without it "no symbols" cannot be told from "no provider",
        // and every other row printed by this run would be unreadable.
        assert.ok(
          rows.length > 0,
          `CONTROL FAILED (${probe.name}): Posit reported no symbol for an ordinary '## Control Heading'. ` +
            "Posit is not providing document symbols in this host, so the other rows in this " +
            "run mean nothing — they are 'no provider', not 'no heading'.",
        );
      }
    });
  }
});
