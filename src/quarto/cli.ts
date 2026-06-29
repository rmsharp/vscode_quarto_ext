/**
 * The Quarto CLI adapter — the one external integration point (plan §8).
 *
 * Unlike `core/`, this module is allowed to import `vscode` (for configuration)
 * and `node:child_process` (to spawn the CLI). Every later phase (render,
 * preview, execution) builds on the resolution + graceful-degradation
 * infrastructure established here.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as vscode from "vscode";
import { parseSharePath } from "../core/quarto-paths";
import { parseQuartoVersion } from "../core/version";

const execFileAsync = promisify(execFile);

/**
 * Thrown when the Quarto CLI cannot be executed or returns no parseable
 * version. The caller is expected to surface an actionable message rather than
 * crash (plan §9: "Quarto CLI absent / wrong version").
 */
export class QuartoNotFound extends Error {
  constructor(
    readonly attemptedPath: string,
    override readonly cause?: unknown,
  ) {
    super(
      `Could not run Quarto at "${attemptedPath}". ` +
        `Is the Quarto CLI installed and on your PATH?`,
    );
    this.name = "QuartoNotFound";
  }
}

export interface QuartoInstallation {
  /** The command or absolute path used to invoke Quarto. */
  path: string;
  /** The resolved version string, e.g. `"1.7.33"`. */
  version: string;
}

/**
 * The configured Quarto command: the `quarto.path` setting if non-empty,
 * otherwise the bare `quarto` (resolved against the `PATH`).
 */
export function configuredBinary(): string {
  const configured = vscode.workspace
    .getConfiguration("quarto")
    .get<string>("path", "")
    .trim();
  return configured.length > 0 ? configured : "quarto";
}

/**
 * Resolve and validate the Quarto CLI by invoking `<bin> --version`.
 *
 * @throws {QuartoNotFound} when the binary cannot be executed or its
 *   `--version` output contains no recognizable semver.
 */
export async function resolveBinary(): Promise<QuartoInstallation> {
  const bin = configuredBinary();
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(bin, ["--version"]));
  } catch (err) {
    throw new QuartoNotFound(bin, err);
  }
  const version = parseQuartoVersion(stdout);
  if (!version) {
    throw new QuartoNotFound(
      bin,
      new Error(`Unexpected "quarto --version" output: ${stdout.trim()}`),
    );
  }
  return { path: bin, version };
}

/**
 * Resolve Quarto's share directory by invoking `<bin> --paths` (Phase 6d plan
 * §2.4 — the YAML schema lives under it). `--paths` is UNDOCUMENTED (absent from
 * `quarto --help`), so its output is parsed defensively in the pure core
 * (`parseSharePath`); re-verify it on a Quarto upgrade alongside the `Browse at`
 * / `Output created` stderr markers (Learnings #4/#8/#11/#25).
 *
 * @throws {QuartoNotFound} when the binary cannot be executed, or `--paths`
 *   yields no resolvable share directory.
 */
export async function quartoSharePath(): Promise<string> {
  const bin = configuredBinary();
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(bin, ["--paths"]));
  } catch (err) {
    throw new QuartoNotFound(bin, err);
  }
  const share = parseSharePath(stdout);
  if (share === null) {
    throw new QuartoNotFound(
      bin,
      new Error(`Unexpected "quarto --paths" output: ${stdout.trim()}`),
    );
  }
  return share;
}
