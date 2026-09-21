// The real-document measure, stage 1: run a given build's SHIPPED `findHeadings` over the frozen
// corpus and write one TSV row per document — `PATH \t N \t h<lvl>:<text>` joined by U+001E.
// (Session 265's `census.test.ts`, moved here and adopted as the standing measure, Session 268.)
//
// The build is chosen by REALDOC_SRC (a directory holding `src/`), so every build sees
// byte-identical input: the corpus is read ONCE from JSON, never from the live files. That is what
// makes two builds' numbers comparable — Session 265 measured 95 corpus documents changing on disk
// between its own runs.
//
// It is a vitest file only because that is the cheapest way to import the model's TypeScript
// directly; it asserts one thing (a row per document) and is NOT part of `npm test` — `vitest.config.ts`
// includes `test/unit/**` only. `run.sh` beside this file invokes it with its own config.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const need = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`realdoc-score: set ${name} (see tools/realdoc-score/README.md)`);
  return v;
};
const RS = "\u001e";

describe("realdoc-score census", () => {
  it("runs findHeadings over every corpus document", async () => {
    const src = need("REALDOC_SRC");
    const mod = await import(resolve(src, "src/core/qmd/model.ts"));
    // The census must ask the SAME question the product asks (Session 273): the Outline adapter
    // resolves the engine from the document and passes it, so a census that did not would score
    // a code path the user never reaches. Resolved from the SAME build as the model under test.
    const eng = await import(resolve(src, "src/core/document-engine-resolve.ts"));
    const docs: [string, string][] = JSON.parse(readFileSync(need("REALDOC_CORPUS"), "utf8"));
    const rows: string[] = [];
    let threw = 0;
    let total = 0;
    for (const [p, text] of docs) {
      let hs: { level: number; text: string }[];
      try {
        hs = mod.findHeadings(text, eng.resolveDocumentEngine(p, text));
      } catch (e) {
        threw++;
        rows.push([p, "THREW", String(e).slice(0, 120)].join("\t"));
        continue;
      }
      total += hs.length;
      rows.push(
        [p, String(hs.length), hs.map((h) => `h${h.level}:${h.text.replace(/\s+/g, " ").trim()}`).join(RS)].join("\t"),
      );
    }
    writeFileSync(need("REALDOC_OUT"), rows.join("\n") + "\n");
    console.log(`\nrealdoc-score census src=${src} docs=${docs.length} threw=${threw} headings=${total}`);
    expect(rows.length).toBe(docs.length);
  });
}, 1_800_000);
