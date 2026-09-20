import { promises as fs } from "node:fs";
import * as path from "node:path";
import Mocha from "mocha";

/**
 * Mocha entry point invoked inside the Extension Development Host. Discovers and
 * runs every compiled `*.test.js` under this directory.
 */
export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: "bdd", color: true, timeout: 20000 });
  const testsRoot = __dirname;

  for (const file of await findTestFiles(testsRoot)) {
    mocha.addFile(file);
  }

  await new Promise<void>((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} integration test(s) failed.`));
      } else {
        resolve();
      }
    });
  });
}

async function findTestFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findTestFiles(full)));
    } else if (entry.name.endsWith(".test.js")) {
      files.push(full);
    }
  }
  return files;
}
