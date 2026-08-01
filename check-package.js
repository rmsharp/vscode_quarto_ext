#!/usr/bin/env node
/**
 * The release gate on what actually ships inside the `.vsix`
 * (CHANGELOG: the scratchpad/ .vsix packaging leak, Session 174).
 *
 * ## Why this exists
 *
 * `.vscodeignore` is a DENYLIST, so the packaged file set is allow-by-default:
 * anything new at the repo root ships unless someone remembers to exclude it.
 * `vsce package` reports a clean exit either way, so nothing in the build,
 * test, type-check or packaging pipeline can observe the mistake — only reading
 * the produced file tree can. That default has been wrong twice, both found by
 * hand and only because one session happened to read the tree:
 *
 *   - `tsconfig.unit.json` shipped inside the `.vsix` the day it was added
 *     (Session 173, fixed in the same session).
 *   - the untracked `scratchpad/` directory shipped from ~2026-07-21 until
 *     Session 174: **3043 of the artifact's 3085 files, 84.68 MB uncompressed**,
 *     against a real extension of 42 files.
 *
 * This script inverts the default. The packaged set is checked DENY-BY-DEFAULT
 * against `ALLOWED_ROOTS` below, so a new top-level file or directory reds here
 * instead of silently shipping. It is wired ahead of `vsce package` in the
 * `package` script, and `test/unit/package-contents-gate.test.ts` pins that
 * wiring — a gate nothing runs is the same hole with extra files.
 *
 * ## The oracle, and why `vsce ls` rather than the artifact
 *
 * MEASURED, not assumed (Session 174): the entries of a real `.vsix` and the
 * output of `vsce ls` are IDENTICAL as sets, with exactly two differences, both
 * outside the question this gate asks:
 *
 *   1. the archive adds `extension.vsixmanifest` and `[Content_Types].xml` at
 *      its top level, outside the `extension/` prefix that holds everything
 *      `vsce ls` prints;
 *   2. two files are RENAMED on the way in — `LICENSE` -> `LICENSE.txt` and
 *      `README.md` -> `readme.md`. `ALLOWED_ROOTS` therefore spells them as
 *      `vsce ls` prints them, not as the archive stores them.
 *
 * So `vsce ls` is a faithful predictor of the shipped set at ~7s, where
 * packaging and unzipping costs ~36s and a 30 MB artifact. Re-derive the
 * equivalence rather than trusting this paragraph if `@vscode/vsce` is upgraded:
 *
 *   npx vsce package -o /tmp/probe.vsix && unzip -Z1 /tmp/probe.vsix \
 *     | grep '^extension/' | sed 's|^extension/||' | sort > /tmp/a
 *   npx vsce ls | sort > /tmp/b && diff /tmp/a /tmp/b
 *
 * ⚠ Do NOT "simplify" this into a re-implementation of `.vscodeignore`
 * semantics. A hand-transcribed copy of another tool's matching rules is the
 * failure this project has been burned by repeatedly; the only faithful answer
 * to "what ships" is the one vsce itself computes.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Every top-level path segment the packaged extension is allowed to contain,
 * spelled as `vsce ls` prints it (see the rename note above).
 *
 * Adding an entry here is the deliberate act of deciding a new thing ships.
 * Removing one is the deliberate act of deciding it does not — the presence
 * check below means an over-broad `.vscodeignore` that silently dropped `dist/`
 * reds here too, which is the more dangerous direction of the same defect.
 */
const ALLOWED_ROOTS = [
  "LICENSE",
  "NOTICE",
  "README.md",
  "dist",
  "language-configuration.json",
  "languages",
  "media",
  "package.json",
  "snippets",
  "syntaxes",
];

/**
 * Obesity backstops for a leak INSIDE an allowed root, which the allowlist
 * cannot see. Both are ceilings with roughly 2x headroom over the artifact
 * measured at Session 174 (42 files, 5.50 MB uncompressed), deliberately not
 * equalities: ordinary growth — another KaTeX font, another bundle — must never
 * red, while the leak class actually observed here reds by 30x on count and
 * 15x on bytes.
 */
const MAX_FILES = 100;
const MAX_BYTES = 12 * 1024 * 1024;

function packagedPaths() {
  const vsce = path.join(__dirname, "node_modules", ".bin", "vsce");
  if (!fs.existsSync(vsce)) {
    console.error(
      `check-package: ${vsce} not found — run \`npm install\` first.`,
    );
    process.exit(2);
  }
  // `vsce ls` writes one repo-relative path per line to stdout and nothing to
  // stderr (measured). maxBuffer is raised because the failing case is by
  // definition an enormous file list — the 1 MB default would throw before the
  // gate could report what leaked.
  const stdout = execFileSync(vsce, ["ls"], {
    cwd: __dirname,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout.split("\n").map((line) => line.trim()).filter(Boolean);
}

function main() {
  const paths = packagedPaths();
  const failures = [];

  // 1. Deny-by-default: nothing outside the allowlist may ship.
  const byRoot = new Map();
  for (const p of paths) {
    const root = p.split("/")[0];
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root).push(p);
  }
  for (const [root, members] of [...byRoot].sort()) {
    if (ALLOWED_ROOTS.includes(root)) continue;
    const sample = members.slice(0, 3).join(", ");
    failures.push(
      `unexpected \`${root}\` in the package — ${members.length} file(s), e.g. ${sample}` +
        (members.length > 3 ? ", …" : "") +
        `\n    Either exclude it in .vscodeignore, or add it to ALLOWED_ROOTS here if it really should ship.`,
    );
  }

  // 2. Presence: an over-broad exclusion that drops a shipping root is the
  //    same defect pointed the other way, and a `.vsix` missing `dist/` still
  //    packages and publishes cleanly.
  for (const root of ALLOWED_ROOTS) {
    if (!byRoot.has(root)) {
      failures.push(
        `\`${root}\` is missing from the package — something in .vscodeignore is excluding it.`,
      );
    }
  }

  // 3. Obesity backstops.
  const bytes = paths.reduce((sum, p) => {
    try {
      return sum + fs.statSync(path.join(__dirname, p)).size;
    } catch {
      return sum;
    }
  }, 0);
  if (paths.length > MAX_FILES) {
    failures.push(
      `${paths.length} files exceeds the ${MAX_FILES}-file ceiling.`,
    );
  }
  if (bytes > MAX_BYTES) {
    failures.push(
      `${(bytes / 1024 / 1024).toFixed(2)} MB uncompressed exceeds the ` +
        `${(MAX_BYTES / 1024 / 1024).toFixed(0)} MB ceiling.`,
    );
  }

  const summary =
    `${paths.length} files, ${(bytes / 1024 / 1024).toFixed(2)} MB uncompressed, ` +
    `roots: ${[...byRoot.keys()].sort().join(" ")}`;

  if (failures.length > 0) {
    console.error(`check-package: FAIL — ${summary}\n`);
    for (const failure of failures) console.error(`  ✗ ${failure}`);
    console.error(
      `\n  The packaged set is what \`vsce ls\` reports; run it to see every path.`,
    );
    process.exit(1);
  }

  console.log(`check-package: OK — ${summary}`);
}

main();
