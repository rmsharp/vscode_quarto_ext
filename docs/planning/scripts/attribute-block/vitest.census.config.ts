import { defineConfig } from "vitest/config";
import * as path from "node:path";
export default defineConfig({ test: { include: [path.join(__dirname, "census.test.ts")], environment: "node", testTimeout: 1_800_000 } });
