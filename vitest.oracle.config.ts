import { defineConfig } from "vitest/config";

/**
 * The OPT-IN oracle run (`npm run test:oracle`).
 *
 * Separate from `vitest.config.ts` because this suite shells out to the real `quarto` CLI
 * once per corpus document: it needs a machine with quarto installed, takes minutes rather
 * than seconds, and its verdict depends on the installed quarto VERSION. None of that
 * belongs in the default `npm test`, which must stay hermetic and fast — so the oracle's
 * pure logic is pinned there instead (`test/unit/oracle-*.test.ts`) and only the live
 * measurement lives here.
 */
export default defineConfig({
  test: {
    include: ["test/oracle/**/*.oracle.test.ts"],
    environment: "node",
    // One corpus at a time: the runs are quarto-bound, and interleaved output would make
    // the per-document report unreadable.
    fileParallelism: false,
  },
  // The oracle loads the BUILD UNDER TEST by absolute path so an older commit can be
  // replayed from `git archive` (see test/oracle/load.ts). Vite refuses to serve files
  // outside the project root unless told otherwise.
  server: { fs: { allow: ["/"] } },
});
