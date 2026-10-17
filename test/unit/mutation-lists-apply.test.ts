import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Session 319 — a gate on the tracked mutation lists. `tools/mutation-run/run.py` SKIPS a mutant whose `from` does not occur exactly once in its file ("pattern occurs 0 times", exit 4), and nothing
// else notices: Session 318 respelled two patterns and 26 mutants of the lists below stopped applying (15 of its own and 11 of Session 316's) while their README rows still said "all killed". A list that
// no longer applies pins nothing, so every list is read here against the tree as it stands. This checks that a mutant CAN be applied, not what the tests then do with it: that is the runner's job.

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const directory = resolve(root, "tools", "mutation-run", "mutants");

interface Mutant {
  name: string;
  file: string;
  from: string;
  to: string;
  expect?: string;
}

/** How often `needle` occurs in `text`, overlapping matches counted (the runner refuses to guess which of two to edit). */
function occurrences(text: string, needle: string): number {
  let count = 0;
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) {
    count++;
  }
  return count;
}

const lists = readdirSync(directory)
  .filter((name) => name.endsWith(".json"))
  .sort();

describe("Session 319 — every tracked mutation list still applies", () => {
  it("there are lists to check", () => {
    expect(lists.length).toBeGreaterThanOrEqual(10);
  });

  it.each(lists)("%s: each mutant's `from` occurs exactly once in its file, and its edit changes something", (list) => {
    const mutants = JSON.parse(readFileSync(resolve(directory, list), "utf8")) as Mutant[];
    const problems: string[] = [];
    const seen = new Set<string>();
    for (const mutant of mutants) {
      if (seen.has(mutant.name)) {
        problems.push(`${mutant.name}: the name is used twice in this list`);
      }
      seen.add(mutant.name);
      const path = resolve(root, mutant.file);
      if (!path.startsWith(root) || !existsSync(path)) {
        problems.push(`${mutant.name}: ${mutant.file} is not a file inside the repository`);
        continue;
      }
      const count = occurrences(readFileSync(path, "utf8"), mutant.from);
      if (count !== 1) {
        problems.push(`${mutant.name}: \`from\` occurs ${count} times in ${mutant.file}`);
      }
      if (mutant.from === mutant.to) {
        problems.push(`${mutant.name}: \`from\` and \`to\` are the same text`);
      }
      if (mutant.expect !== undefined && mutant.expect !== "killed" && mutant.expect !== "survives") {
        problems.push(`${mutant.name}: expect is ${JSON.stringify(mutant.expect)}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
