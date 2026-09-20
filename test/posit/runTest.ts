import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

/**
 * The Posit OBSERVATION harness (`npm run observe:posit`) — Session 270.
 *
 * ## Why this exists
 *
 * `CLAUDE.md` §Clean-room boundary says Posit's extension is **AGPL-3.0**, so its source is
 * not a reference this MIT project builds from, and it names the one legitimate way to settle
 * *"what does Posit do?"*: **black-box observation** — enable their extension, open a document
 * holding the shape, and read the Outline off the screen. Two prior sessions reached into their
 * bundle instead, and both said afterwards that it should have been an observation.
 *
 * This harness is that observation, automated so it is repeatable and so its answer is a
 * recorded artefact rather than a remembered glance. It reads Posit's **rendered behaviour**
 * through VS Code's public `executeDocumentSymbolProvider` API. It never reads their code.
 *
 * ## Why it does NOT load this extension
 *
 * `extensionDevelopmentPath` points at a THROWAWAY DO-NOTHING extension, not at this repo.
 * `vscode.executeDocumentSymbolProvider` merges the results of EVERY registered provider, so
 * loading ours beside Posit's would make every symbol unattributable — the same reasoning the
 * real-LSP harness records for excluding `quarto.quarto` from ITS run, pointing the other way.
 * The throwaway extensions dir therefore holds `quarto.quarto` and nothing else, and this
 * repo's own `dist/` is never on the host's extension path.
 *
 * ## The control, which is not optional
 *
 * Every run opens `control.qmd`, an ordinary `## Heading` outside any table. If Posit reports
 * no symbol for THAT, Posit is not running and every other line of the output is meaningless —
 * "no symbol" and "no provider" are indistinguishable without it. The suite fails loudly in
 * that case rather than reporting a tidy row of zeros.
 *
 * ## Not a gate, and not in CI
 *
 * This asserts nothing about THIS extension. It is an instrument that prints what another
 * extension does, for a decision a human then makes. It also takes over the screen (a real
 * Extension Development Host window), so it is opt-in and run with the operator's go-ahead.
 */

/** The one extension the observation needs. */
const REQUIRED = "quarto.quarto";

async function findPosit(): Promise<string | undefined> {
  const extRoot = path.join(os.homedir(), ".vscode", "extensions");
  let entries: string[];
  try {
    entries = await fs.readdir(extRoot);
  } catch {
    return undefined;
  }
  const dir = entries.find((e) => e.startsWith(`${REQUIRED}-`) || e === REQUIRED);
  return dir === undefined ? undefined : path.join(extRoot, dir);
}

/** The probes the observation opens, written fresh each run so the file IS the record. */
const PROBES: ReadonlyArray<{ name: string; body: string; why: string }> = [
  {
    name: "control",
    why: "an ordinary ATX heading outside any table — if THIS shows nothing, Posit is not running",
    body: "## Control Heading\n\nProse.\n",
  },
  {
    name: "r3a_atx_in_cell",
    why: "R3 half A — an ATX heading at column 0 of a well-formed grid-table cell (quarto renders h3)",
    body:
      "Intro.\n\n" +
      "+-----------------+------------------+\n" +
      "| ### Alpha       | body one         |\n" +
      "+-----------------+------------------+\n" +
      "| plain           | ### Beta         |\n" +
      "+-----------------+------------------+\n\n" +
      "After.\n",
  },
  {
    name: "r3b_setext_in_cell",
    why: "R3 half B — a multi-line cell whose two lines fuse into a setext h1 (quarto renders h1)",
    body:
      "Intro.\n\n" +
      "+-----------------+------------------+\n" +
      "| Cell A          | Cell B           |\n" +
      "| ======          | ======           |\n" +
      "+-----------------+------------------+\n\n" +
      "After.\n",
  },
  {
    name: "r3b_overwide",
    why: "R3 half B as the corpus spells it — an over-wide body row makes +====+ stop dividing (quarto renders h1 x3)",
    body:
      "Intro.\n\n" +
      "+-----------------------+----------------------------------------+------------------------------+\n" +
      "| Feature               | R Markdown                             | Quarto                       |\n" +
      "+=======================+========================================+==============================+\n" +
      "| item 1                | left 1                                 | right 1                      |\n" +
      "+-----------------------+----------------------------------------+------------------------------+\n" +
      "| item 2                | left 2                                 | right 2                                               |\n" +
      "+-----------------------+----------------------------------------+------------------------------+\n\n" +
      "After.\n",
  },
];

async function main(): Promise<void> {
  const posit = await findPosit();
  if (posit === undefined) {
    // A loud skip, never a silent pass — the same doctrine as the real-LSP harness.
    console.log(
      [
        "",
        "=".repeat(78),
        `  SKIPPED: observe:posit — ${REQUIRED} is not installed.`,
        "",
        `  This harness needs ${REQUIRED} in ~/.vscode/extensions. It is the BLACK-BOX way`,
        "  CLAUDE.md requires for settling what Posit's Outline shows, in place of reading",
        "  their AGPL-3.0 source.",
        "=".repeat(78),
        "",
      ].join("\n"),
    );
    return;
  }
  console.log(`  [harness] observing ${path.basename(posit)}`);

  // Throwaway extensions dir holding ONLY Posit. This repo's extension is never staged.
  const extensionsDir = await fs.mkdtemp(path.join(os.tmpdir(), "qmd-posit-ext-"));
  await fs.cp(posit, path.join(extensionsDir, path.basename(posit)), { recursive: true });

  // A do-nothing host extension, so `runTests` has an extensionDevelopmentPath that is NOT
  // this repo. Without this the host would load our providers beside Posit's.
  const hostDir = await fs.mkdtemp(path.join(os.tmpdir(), "qmd-posit-host-"));
  await fs.writeFile(
    path.join(hostDir, "package.json"),
    JSON.stringify(
      {
        name: "posit-observation-host",
        version: "0.0.0",
        engines: { vscode: "^1.90.0" },
        main: "./main.js",
        contributes: {},
      },
      null,
      2,
    ),
  );
  await fs.writeFile(path.join(hostDir, "main.js"), "exports.activate = () => {};\nexports.deactivate = () => {};\n");

  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "qmd-posit-ws-"));
  for (const probe of PROBES) {
    await fs.writeFile(path.join(workspace, `${probe.name}.qmd`), `---\ntitle: ${probe.name}\nengine: markdown\n---\n\n${probe.body}`);
  }

  // MUST be short — VS Code's IPC socket path has a ~103-character limit.
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "qmd-posit-u-"));

  try {
    await runTests({
      // Pinned to the SAME baseline the integration runner pins (`test/integration/runTest.ts`),
      // for its reason and one more. Left unpinned this floats to the latest stable, and on
      // 2026-09-19 that was 1.138.0, whose app bundle names its binary `Code` where the
      // installed `@vscode/test-electron` still spawns `Electron` — a bare ENOENT that looks
      // like anything but a version drift. An observation must also be REPEATABLE: the answer
      // it records is "what Posit's Outline shows in THIS editor", so the editor is held fixed.
      version: "1.129.0",
      extensionDevelopmentPath: hostDir,
      extensionTestsPath: path.resolve(__dirname, "./suite/index"),
      launchArgs: [
        workspace,
        "--extensions-dir",
        extensionsDir,
        "--user-data-dir",
        userDataDir,
        "--skip-welcome",
        "--skip-release-notes",
        "--disable-workspace-trust",
      ],
      extensionTestsEnv: {
        QMD_POSIT_WORKSPACE: workspace,
        QMD_POSIT_PROBES: JSON.stringify(PROBES.map((p) => ({ name: p.name, why: p.why }))),
        QMD_POSIT_OUT: process.env.QMD_POSIT_OUT ?? path.join(process.cwd(), "scratchpad", "s270", "posit-observation.txt"),
      },
    });
  } catch (err) {
    console.error("Posit observation failed:", err);
    process.exitCode = 1;
  } finally {
    await fs.rm(extensionsDir, { recursive: true, force: true });
    await fs.rm(hostDir, { recursive: true, force: true });
    await fs.rm(userDataDir, { recursive: true, force: true });
    await fs.rm(workspace, { recursive: true, force: true });
  }
}

void main();
