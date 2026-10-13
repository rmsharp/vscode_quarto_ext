import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { parseSharePath } from "../../src/core/quarto-paths";
import { quartoVersion } from "./load";

/**
 * The comment-char fixture against the LIVE install (Session 299). Opt-in: `npm run test:oracle`.
 *
 * `test/unit/lang-comment-chars.test.ts` pins every row of the model's `LANG_COMMENT_CHARS`
 * against `test/fixtures/lang-comment-chars/quarto-1.7.33.json`, headlessly, on every `npm test`.
 * That is only as good as the fixture, so this test re-derives the fixture from the installed
 * quarto and fails if they differ. It cannot live in the default run: it needs quarto installed,
 * and its verdict depends on the installed VERSION. It renders nothing, so unlike the corpus
 * oracle it is instant.
 *
 * The source is the key `handlers/lang-comment-chars.yml` of
 * `<share>/editor/tools/yaml/yaml-intelligence-resources.json`: quarto's effective table, its
 * static `kLangCommentChars` plus the `mermaid` overlay. Checked firsthand against 1.7.33, the
 * 46 static rows equal the table in `bin/quarto.js`, the one `quarto render` reads cell options
 * with. (`share/filters/modules/constants.lua` holds a DIFFERENT 57-row table for code
 * annotations, so it is no source for this.)
 *
 * When this goes red the table or the fixture moved. Overwrite the fixture with `REGENERATE`
 * below, read the diff in `git diff`, and decide each new or changed row: add it to
 * `LANG_COMMENT_CHARS`, or list it as deliberately not modelled in the unit test (and bump its
 * `QUARTO_ROW_COUNT`). If the quarto VERSION moved, also rename the file and edit `FIXTURE` here
 * and in the unit test.
 */

const FIXTURE = path.resolve(process.cwd(), "test/fixtures/lang-comment-chars/quarto-1.7.33.json");
const RESOURCE_KEY = "handlers/lang-comment-chars.yml";

/** Run from the repository root; prints the fixture, one row per line, on stdout. */
const REGENERATE = `node -e '
const cp = require("node:child_process"), fs = require("node:fs"), path = require("node:path");
const share = cp.execFileSync("quarto", ["--paths"], { encoding: "utf8" }).split("\\n")[1];
const res = JSON.parse(fs.readFileSync(path.join(share, "editor/tools/yaml/yaml-intelligence-resources.json"), "utf8"));
const t = res["${RESOURCE_KEY}"];
console.log("{\\n" + Object.entries(t).map(([k, v]) => "  " + JSON.stringify(k) + ": " + JSON.stringify(v)).join(",\\n") + "\\n}");
' > ${path.relative(process.cwd(), FIXTURE)}`;

/** The installed quarto's own table, exactly as its resource stores it. */
function installedTable(): Record<string, unknown> {
  const share = parseSharePath(execFileSync("quarto", ["--paths"], { encoding: "utf8" }));
  if (share === null) {
    throw new Error("`quarto --paths` produced no share directory");
  }
  const file = path.join(share, "editor", "tools", "yaml", "yaml-intelligence-resources.json");
  const resources = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  const table = resources[RESOURCE_KEY];
  if (typeof table !== "object" || table === null) {
    // Fail loudly: a quarto that moved the table must not read as "no rows to compare".
    throw new Error(`${file} has no \`${RESOURCE_KEY}\` object`);
  }
  return table as Record<string, unknown>;
}

describe("the comment-char fixture against the installed quarto (S299)", () => {
  it("is the table the installed quarto reads cell options with", () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Record<string, unknown>;
    const installed = installedTable();
    const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

    const diff = {
      /** In the installed quarto and not in the fixture: a language quarto gained. */
      added: Object.keys(installed).filter((k) => !(k in fixture)),
      /** In the fixture and not in the installed quarto: a language quarto dropped. */
      removed: Object.keys(fixture).filter((k) => !(k in installed)),
      /** In both with different characters. */
      changed: Object.fromEntries(
        Object.keys(fixture)
          .filter((k) => k in installed && !same(fixture[k], installed[k]))
          .map((k) => [k, { fixture: fixture[k], installed: installed[k] }]),
      ),
    };
    expect(
      diff,
      `quarto ${quartoVersion()} reads a different comment-char table than the fixture. ` +
        `Overwrite the fixture with (then read the git diff):\n${REGENERATE}`,
    ).toEqual({ added: [], removed: [], changed: {} });
  });
});
