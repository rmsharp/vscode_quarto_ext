import { promises as fs } from "node:fs";
import * as path from "node:path";
import Mocha from "mocha";

/**
 * Mocha entry point for the real-LSP harness. A generous timeout: this run waits on a
 * real language server to start, index an interpreter's stdlib, and answer — which is
 * seconds, not milliseconds.
 */
export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: "bdd", color: true, timeout: 120_000, slow: 10_000 });
  const testsRoot = __dirname;

  for (const file of await fs.readdir(testsRoot)) {
    if (file.endsWith(".test.js")) {
      mocha.addFile(path.join(testsRoot, file));
    }
  }

  await new Promise<void>((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} real-LSP test(s) failed.`));
      } else {
        resolve();
      }
    });
  });
}
