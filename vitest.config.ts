import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Pure-core unit tests only. Integration tests (test/integration) run under
    // @vscode/test-electron via `npm run test:integration`, never vitest.
    include: ["test/unit/**/*.test.ts"],
    environment: "node",
  },
});
