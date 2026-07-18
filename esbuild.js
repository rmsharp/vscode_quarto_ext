const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

// Two independent bundles:
//  1. The extension itself — runs in the Node-based extension host (`vscode`
//     is host-provided, never bundled).
//  2. The notebook markdown-cell renderer (BACKLOG item 17d) — runs in the
//     notebook renderer webview, a browser sandbox with no `vscode`/Node. VS
//     Code loads it as a self-contained ES module and calls its `activate`
//     export, so it bundles with no externals. Its markdown-it instance comes
//     from the base `vscode.markdown-it-renderer` at runtime, so markdown-it is
//     not bundled here either.
const configs = [
  {
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node18",
    outfile: "dist/extension.js",
    external: ["vscode"],
    sourcemap: !production,
    minify: production,
    logLevel: "info"
  },
  {
    entryPoints: ["src/webview/notebook-renderer.ts"],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2020",
    outfile: "dist/notebook-renderer.js",
    sourcemap: !production,
    minify: production,
    logLevel: "info"
  }
];

async function main() {
  const contexts = await Promise.all(configs.map((config) => esbuild.context(config)));

  if (watch) {
    await Promise.all(contexts.map((ctx) => ctx.watch()));
  } else {
    await Promise.all(contexts.map((ctx) => ctx.rebuild()));
    await Promise.all(contexts.map((ctx) => ctx.dispose()));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
