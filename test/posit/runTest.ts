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
    name: "m01_heading_blank_closer",
    why: "THE CORPUS SHAPE — a mid-document --- span holding an ATX heading with a BLANK line before the closer; all 80 headings this model deletes across 30 corpus documents are this spelling (quarto: exit 0, heading ABSENT)",
    body: "## Kept Before\n\nText.\n\n---\n## Alpha Slide Head\n\n---\n\n## Kept After\n",
  },
  {
    name: "m02_keys_only",
    why: "a mid-document span holding a REAL YAML key and no heading — does Posit model mid-document YAML metadata at all? (quarto: exit 0, nothing rendered for the span)",
    body: "## Kept Before\n\nText.\n\n---\nnote: bravo\n---\n\n## Kept After\n",
  },
  {
    name: "m03_keys_and_heading",
    why: "a real key AND an ATX pressed against it inside one span — this model reports neither on BOTH builds, so it is the row that says whether the change is complete (quarto: exit 0, nothing)",
    body: "## Kept Before\n\nText.\n\n---\nnote: charlie\n## Charlie Inside\n---\n\n## Kept After\n",
  },
  {
    name: "m04_quoted_keys",
    why: "the BLOCK-QUOTE walk (Session 231) — a metadata triple carried inside a quote; never observed before (quarto: exit 0, empty blockquote, nothing rendered)",
    body: "## Kept Before\n\nText.\n\n> ---\n> note: delta\n> ---\n\n## Kept After\n",
  },
  {
    name: "m05_quoted_heading",
    why: "the quoted walk carrying an ATX heading — the deleting half of the same rule; never observed before (quarto: exit 0, nothing)",
    body: "## Kept Before\n\nText.\n\n> ---\n> ## Echo Quoted\n> ---\n\n## Kept After\n",
  },
  {
    name: "m06_tight_closer",
    why: "the TIGHT spelling — no blank before the closer, so pandoc reads a SETEXT underline and the text keeps its literal hashes; ZERO corpus documents spell it this way, and it is the row that tells us whether Posit shows '## Foxtrot Tight' or 'Foxtrot Tight' (quarto: exit 0, nothing)",
    body: "## Kept Before\n\nText.\n\n---\n## Foxtrot Tight\n---\n\n## Kept After\n",
  },
  {
    name: "m07_consecutive",
    why: "TWO spans in one document, the shape a slide deck actually has (quarto: exit 0, neither heading rendered)",
    body: "## Kept Before\n\nText.\n\n---\n## Golf One\n\n---\n\nMiddle prose.\n\n---\n## Hotel Two\n\n---\n\n## Kept After\n",
  },
  {
    name: "m08_from_gfm",
    why: "the READER-RESOLUTION capability that shares this code (Session 211) — a span whose own `from:` selects a non-consuming reader, so quarto RENDERS the span itself as h2:'from: gfm' and BOTH builds of this model already agree",
    body: "## Kept Before\n\nText.\n\n---\nfrom: gfm\n---\n\n## Kept After\n",
  },
  {
    name: "m09_dots",
    why: "a span terminated by YAML's `...` document-end marker — this model withholds the span on BOTH builds (quarto: exit 0, nothing)",
    body: "## Kept Before\n\nText.\n\n---\nnote: india\n...\n\n## Kept After\n",
  },
  {
    name: "m10_noblank_above",
    why: "the OPENER PRECONDITION control — a paragraph line directly above the opener means pandoc consumes NOTHING and reads two setext headings instead; quarto renders BOTH ('Juliet paragraph line.' and 'note: juliet') and both builds of this model already agree",
    body: "## Kept Before\n\nJuliet paragraph line.\n---\nnote: juliet\n---\n\n## Kept After\n",
  },
  {
    name: "m11_fm_only",
    why: "THE FRONT-MATTER CONTROL — does Posit list the document's OWN front-matter keys as Outline rows? If it does not, Posit models the opening block and only the opening block, which is exactly what this change would make this model do",
    frontMatter: "---\ntitle: m11_fm_only\nauthor: Kilo Author\nengine: markdown\n---\n",
    body: "## Only Real Heading\n\nText.\n",
  },
  {
    name: "m12_deck_rmd",
    why: "R2's deck for contrast — a quiet knitr chunk inside the span, which this model ALREADY shows on both builds because a span holding a fence is excluded; quarto renders 'Lima Slide One' and 'November Slide Three' and swallows 'Mike Slide Two'",
    ext: "Rmd",
    frontMatter: "---\ntitle: m12_deck_rmd\n---\n",
    body: "## Lima Slide One\n\nProse one.\n\n---\n## Mike Slide Two\n```{r, echo = FALSE, results = 'hide'}\nx <- 1\n```\n\n---\n## November Slide Three\n\nProse three.\n",
  },
  {
    name: "m13_strict",
    why: "the READER axis — under `from: markdown_strict` quarto does NOT consume the span and renders h2:'## Oscar Strict' with its literal hashes; both builds of this model already agree, so this row pins the reader gate rather than the change",
    frontMatter: "---\ntitle: m13_strict\nfrom: markdown_strict\n---\n",
    body: "## Kept Before\n\nText.\n\n---\n## Oscar Strict\n---\n\n## Kept After\n",
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
        QMD_POSIT_OUT: process.env.QMD_POSIT_OUT ?? path.join(process.cwd(), "scratchpad", "s272", "posit-observation.txt"),
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
