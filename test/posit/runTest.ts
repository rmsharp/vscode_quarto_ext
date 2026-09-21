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

/**
 * The probes the observation opens, written fresh each run so the file IS the record.
 *
 * `ext` defaults to `qmd` and `frontMatter` to a markdown-engine stub. Session 271 added both:
 * R2's shape is a KNITR one and the corpus spells it in `.Rmd`, so forcing `engine: markdown`
 * on every probe would have observed a different document from the one in question. A probe that
 * changes either MUST come with its own control — see `control_rmd`.
 */
const PROBES: ReadonlyArray<{
  name: string;
  body: string;
  why: string;
  ext?: string;
  frontMatter?: string;
}> = [
  {
    name: "control",
    why: "an ordinary ATX heading outside any construct — if THIS shows nothing, Posit is not running",
    body: "## Control Heading\n\nProse.\n",
  },
  {
    name: "control_rmd",
    why: "the .Rmd control -- if THIS shows nothing, Posit provides no symbols for .Rmd at all and every .Rmd row below is 'no provider', not 'no heading'",
    ext: "Rmd",
    frontMatter: "---\ntitle: control_rmd\n---\n",
    body: "## Control Heading Rmd\n\nProse.\n",
  },
  {
    name: "r01_r5_rmd",
    why: "THE SHAPE, and the row that DECIDES. Corpus ordinal 2391's spelling: a {cpp11, eval = FALSE} chunk with a blank line in its body, then a heading, then a bare fence pair. quarto RENDERS the heading (.Rmd, real knitr execution, exit 0, <h4> count 1) because knitr consumes the chunk before pandoc sees it. HEAD deleted it; Session 273 shows it. If Posit shows NO heading here, this is a DECISION and the fix should be reverted",
    ext: "Rmd",
    frontMatter: "---\ntitle: r01_r5_rmd\n---\n",
    body: "## Kept Before\n\n```{r}\nx <- 1\n```\n\n```{cpp11, eval = FALSE}\nint alpha;\n\nint bravo;\n```\n\n#### Alpha After Chunk\n\nProse.\n\n```\nplain\n```\n",
  },
  {
    name: "r02_r5_qmd_markdown",
    why: "THE ENGINE AXIS, and the second row that DECIDES. The IDENTICAL body as a .qmd under `engine: markdown`, where knitr never runs: quarto renders NO heading (exit 0, <h4> count 0) and this model reports none, on both builds. If Posit shows a heading HERE, Posit is engine-blind and simply pairs the fence -- which means the Session 273 guard test pins this model AGAINST Posit, and that has to be recorded as a decision rather than left implicit",
    frontMatter: "---\ntitle: r02_r5_qmd_markdown\nengine: markdown\n---\n",
    body: "## Kept Before\n\n```{cpp11, eval = FALSE}\nint alpha;\n\nint bravo;\n```\n\n#### Bravo After Chunk\n\nProse.\n\n```\nplain\n```\n",
  },
  {
    name: "r03_digit_led_rmd",
    why: "THE LEADING-LETTER NARROWING, the third row that DECIDES. knitr CLAIMS a digit-led engine name, but its rewrite target is a pandoc CLASS and pandoc refuses a class that does not start with a letter -- so quarto renders NO heading (.Rmd, exit 0, <h4> count 0) and HEAD was already right. Session 273 deliberately did NOT widen here. If Posit shows the heading, Posit follows knitr alone and this model follows quarto",
    ext: "Rmd",
    frontMatter: "---\ntitle: r03_digit_led_rmd\n---\n",
    body: "## Kept Before\n\n```{r}\nx <- 1\n```\n\n```{2x, eval = FALSE}\nint alpha;\n\nint bravo;\n```\n\n#### Charlie After Chunk\n\nProse.\n\n```\nplain\n```\n",
  },
  {
    name: "r04_bare_cpp11_rmd",
    why: "CORROBORATING, not deciding (Learning #569). The bare {cpp11} spelling, which quarto's readqmd tag rewrite turns into a valid info string: quarto renders the heading (exit 0, <h4> count 1) and this model already agreed on BOTH builds. It is here to show that a `no heading` answer on r01 would be about the OPTION TAIL and not about the engine name",
    ext: "Rmd",
    frontMatter: "---\ntitle: r04_bare_cpp11_rmd\n---\n",
    body: "## Kept Before\n\n```{r}\nx <- 1\n```\n\n```{cpp11}\nint alpha;\n\nint bravo;\n```\n\n#### Delta After Chunk\n\nProse.\n\n```\nplain\n```\n",
  },
  {
    name: "r05_hyphen_rmd",
    why: "CORROBORATING. A hyphen is outside knitr's [a-zA-Z0-9_] class, so knitr leaves the chunk for pandoc and pandoc refuses it: quarto renders NO heading (.Rmd, exit 0, <h4> count 0) and this model reports none on both builds. It bounds the fix from the other side -- Session 273 must NOT have widened this far",
    ext: "Rmd",
    frontMatter: "---\ntitle: r05_hyphen_rmd\n---\n",
    body: "## Kept Before\n\n```{r}\nx <- 1\n```\n\n```{r-foo, eval = FALSE}\nint alpha;\n\nint bravo;\n```\n\n#### Echo After Chunk\n\nProse.\n\n```\nplain\n```\n",
  },
  {
    name: "r06_tilde_rmd",
    why: "BY-CATCH for the item Session 273 FILES rather than fixes. knitr's chunk.begin is backtick-anchored and `keep-md` leaves a ~~~ chunk verbatim, yet quarto still RENDERS the heading (.Rmd, exit 0, <h4> count 1) while this model reports none -- a pandoc-layer divergence with a different cause and zero corpus reach. One free row that tells the session which picks it up whether it is a defect or a decision",
    ext: "Rmd",
    frontMatter: "---\ntitle: r06_tilde_rmd\n---\n",
    body: "## Kept Before\n\n```{r}\nx <- 1\n```\n\n~~~{zzz9, eval = FALSE}\nint alpha;\n\nint bravo;\n~~~\n\n#### Foxtrot After Chunk\n\nProse.\n\n~~~\nplain\n~~~\n",
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
    const front = probe.frontMatter ?? `---\ntitle: ${probe.name}\nengine: markdown\n---\n`;
    await fs.writeFile(path.join(workspace, `${probe.name}.${probe.ext ?? "qmd"}`), `${front}\n${probe.body}`);
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
        QMD_POSIT_PROBES: JSON.stringify(PROBES.map((p) => ({ name: p.name, why: p.why, ext: p.ext ?? "qmd" }))),
        QMD_POSIT_OUT: process.env.QMD_POSIT_OUT ?? path.join(process.cwd(), "scratchpad", "s273", "posit-observation.txt"),
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
