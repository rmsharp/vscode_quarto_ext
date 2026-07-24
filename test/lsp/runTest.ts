import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

/**
 * The real-LSP harness (`npm run test:lsp`) — CHANGELOG: embedded-language forwarding did not reach real language servers, Session 87.
 *
 * ## Why this exists at all
 *
 * The ordinary integration suite (`npm run test:integration`) cannot detect the class of
 * defect this harness exists to catch, and no amount of adding to it ever could.
 *
 * Every embedded forward was tested with a stand-in provider registered on **our own URI
 * scheme** — the exact axis a real language server discriminates by. Such a double
 * trivially fires for our vdocs, so the suite was 100% green while, in production, real
 * Pylance registered no provider for that scheme and every forward returned nothing:
 * completion, hover, go-to-definition, signature help, and in-cell outline symbols were
 * all silently dead for `{python}`, for many sessions, with a green CI.
 *
 * > A test double registered on the same axis the real dependency discriminates by
 * > cannot detect that the real dependency rejects that axis.
 *
 * The only cure is a test against the real dependency. That is this.
 *
 * ## What it does
 *
 * Launches an Extension Development Host with a **throwaway extensions directory**
 * containing only `ms-python.python` + `ms-python.vscode-pylance`, copied out of the
 * user's own installation. It deliberately does NOT use the user's real extensions
 * directory, because Posit's `quarto.quarto` registers the same `.qmd` language and would
 * merge its providers with ours, making the results unattributable.
 *
 * Every assertion is paired with a **control** on a real `.py` file in the same run. A
 * spike without a control is not evidence: without it, "0 completions" cannot be
 * distinguished from "Pylance never started".
 *
 * ## Not wired into CI, on purpose
 *
 * Pylance's licence restricts redistribution and it cannot be freely downloaded in CI, so
 * this is a local, opt-in gate. When Pylance is absent it exits with a loud SKIP — never
 * a silent pass, because a harness that quietly does nothing is worse than no harness.
 */

/** The two extensions the harness needs, and nothing else. */
const REQUIRED = ["ms-python.python", "ms-python.vscode-pylance"];

async function findInstalled(): Promise<Map<string, string> | undefined> {
  const extRoot = path.join(os.homedir(), ".vscode", "extensions");
  let entries: string[];
  try {
    entries = await fs.readdir(extRoot);
  } catch {
    return undefined;
  }
  const found = new Map<string, string>();
  for (const id of REQUIRED) {
    // Directories are `<publisher>.<name>-<version>[-<platform>]`; match the id prefix.
    const dir = entries.find((e) => e.startsWith(`${id}-`) || e === id);
    if (dir === undefined) {
      return undefined;
    }
    found.set(id, path.join(extRoot, dir));
  }
  return found;
}

async function main(): Promise<void> {
  const installed = await findInstalled();
  if (installed === undefined) {
    // A loud skip, never a silent pass. Exit 0 so this does not fail a developer's local
    // run just for not having Pylance — but say so unmissably.
    console.log(
      [
        "",
        "=".repeat(78),
        "  SKIPPED: npm run test:lsp — Pylance is not installed.",
        "",
        `  This harness needs ${REQUIRED.join(" + ")} in ~/.vscode/extensions.`,
        "  It is the ONLY test that can prove embedded forwarding actually reaches a",
        "  real language server. The stand-in suites CANNOT detect that class of defect",
        "  (CHANGELOG: embedded-language forwarding did not reach real language servers, Session 87) — they were all green while the feature was dead.",
        "",
        "  Install the Python + Pylance extensions in VS Code, then re-run.",
        "=".repeat(78),
        "",
      ].join("\n"),
    );
    return;
  }

  // A throwaway extensions dir holding ONLY the two we need. The user's real one is left
  // untouched, and Posit's quarto.quarto — which claims the same .qmd language — is
  // excluded, so any result we see is unambiguously produced by OUR extension.
  const extensionsDir = await fs.mkdtemp(path.join(os.tmpdir(), "qmd-lsp-ext-"));
  for (const [id, src] of installed) {
    await fs.cp(src, path.join(extensionsDir, path.basename(src)), { recursive: true });
    console.log(`  [harness] staged ${id}`);
  }

  // The scratch workspace: a real folder, so our vdocs get a real `.quarto/vdoc-mit/`.
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "qmd-lsp-ws-"));
  await fs.mkdir(path.join(workspace, ".vscode"), { recursive: true });
  await fs.writeFile(
    path.join(workspace, ".vscode", "settings.json"),
    JSON.stringify(
      {
        // Pylance analyses on open; keep it to open files so the run is fast and so we
        // measure the default diagnostic posture, not a workspace-wide crawl.
        "python.analysis.diagnosticMode": process.env.QMD_LSP_DIAGMODE ?? "openFilesOnly",
        "python.defaultInterpreterPath": process.env.QMD_LSP_PYTHON ?? "python3",
      },
      null,
      2,
    ),
  );

  // The CONTROL file: an ordinary .py on disk. If Pylance cannot complete `os.` HERE,
  // Pylance is not running and every other result in this run is meaningless.
  await fs.writeFile(path.join(workspace, "control.py"), "import os\nos.\n");

  // MUST be short. VS Code's IPC socket path has a ~103-character limit, and a
  // --user-data-dir inside the repo blows past it with a bare EINVAL that looks like
  // anything but a path-length problem.
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "qmd-lsp-u-"));

  try {
    await runTests({
      extensionDevelopmentPath: path.resolve(__dirname, "../../../"),
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
      extensionTestsEnv: { QMD_LSP_WORKSPACE: workspace, QMD_LSP_DIAGMODE: process.env.QMD_LSP_DIAGMODE ?? "openFilesOnly" },
    });
  } catch (err) {
    console.error("Real-LSP tests failed:", err);
    process.exitCode = 1;
  } finally {
    await fs.rm(extensionsDir, { recursive: true, force: true });
    await fs.rm(userDataDir, { recursive: true, force: true });
    await fs.rm(workspace, { recursive: true, force: true });
  }
}

void main();
