// The census stage's own vitest config — deliberately separate from `vitest.config.ts`, which runs
// the unit suite and must never pick up a stage that needs a personal corpus and 30 minutes.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tools/realdoc-score/census.test.ts"],
    environment: "node",
    testTimeout: 1_800_000,
  },
});
