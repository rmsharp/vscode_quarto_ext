// Session 262 — a location-independent two-build census over THREE views (findHeadings,
// findAllCells, indexLabels), the before/after instrument of
// docs/planning/2026-09-14-attribute-tokenizer-plan.md. Both builds are imported by ABSOLUTE
// directory, so the file can live anywhere. Run it from the repo root; see README.md beside it.
//   CENSUS_BASELINE=<dir holding src/>   (required; build it: git archive <sha> src | tar -x -C <dir>)
//   CENSUS_CURRENT=<dir holding src/>    (default: process.cwd(), i.e. the working tree)
//   CENSUS_LIST=<file of absolute paths> (default: scratchpad/s251/realfiles.txt)
//   CENSUS_OUT=<file>                    (default: $TMPDIR/census.out) — one CHANGED row per doc per view
//   CENSUS_MIN_READ=<n>                  (default: 3001, for the 3,383-document corpus; 1 for a probe list)
// The run FAILS if fewer than CENSUS_MIN_READ documents were read, or if either build threw on any.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

const BASE = process.env.CENSUS_BASELINE ?? "";
const CUR = process.env.CENSUS_CURRENT ?? process.cwd();
const LIST = process.env.CENSUS_LIST ?? "scratchpad/s251/realfiles.txt";
const OUT = process.env.CENSUS_OUT ?? join(tmpdir(), "census.out");
type Build = { model: any; refs: any };
async function load(dir: string): Promise<Build> {
  if (!existsSync(`${dir}/src/core/qmd/model.ts`)) throw new Error(`no build at "${dir}" (git archive <sha> src | tar -x -C <dir>)`);
  return { model: await import(`${dir}/src/core/qmd/model`), refs: await import(`${dir}/src/core/refs`) };
}
const VIEWS: Record<string, (b: Build, t: string) => string[]> = {
  headings: (b, t) => b.model.findHeadings(t).map((h: any) => `h${h.level}:${h.text}`),
  cells: (b, t) => b.model.findAllCells(t).map((c: any) => `${c.startLine}-${c.endLine}:${c.lang}`),
  labels: (b, t) => b.refs.indexLabels(t).map((l: any) => `${l.kind}:${l.id}@${l.line}`),
};
it("two-build census", async () => {
  const [base, cur] = [await load(BASE), await load(CUR)];
  const paths = readFileSync(LIST, "utf8").split("\n").filter((p) => p.trim());
  const tally: Record<string, { changedDocs: number; added: number; removed: number }> = {};
  for (const v of Object.keys(VIEWS)) tally[v] = { changedDocs: 0, added: 0, removed: 0 };
  let read = 0, threw = 0;
  const out: string[] = [];
  for (const p of paths) {
    let t: string;
    try { t = readFileSync(p, "utf8"); } catch { continue; }
    read++;
    for (const [v, f] of Object.entries(VIEWS)) {
      let a: string[], b: string[];
      try { a = f(cur, t); b = f(base, t); } catch (e) { threw++; out.push(`THREW\t${v}\t${p}\t${String(e).slice(0, 120)}`); continue; }
      if (JSON.stringify(a) === JSON.stringify(b)) continue;
      const bs = [...b]; let added = 0;
      for (const x of a) { const k = bs.indexOf(x); if (k >= 0) bs.splice(k, 1); else added++; }
      tally[v].changedDocs++; tally[v].added += added; tally[v].removed += bs.length;
      out.push(`CHANGED\t${v}\t${p}\tbase=${b.join(" | ")}\tcur=${a.join(" | ")}`);
    }
  }
  writeFileSync(OUT, out.join("\n") + "\n");
  console.log(`CENSUS listed=${paths.length} read=${read} threw=${threw} ` +
    Object.entries(tally).map(([v, s]) => `| ${v} changedDocs=${s.changedDocs} added=${s.added} removed=${s.removed}`).join(" "));
  expect(read).toBeGreaterThanOrEqual(Number(process.env.CENSUS_MIN_READ ?? 3001));
  // A build that THROWS on a document is skipped above before the diff, so without this line it
  // would count as "unchanged" — and a throw empties that document's whole Outline (the provider
  // has no try/catch). Found by Session 262's plan review; the THREW rows are in CENSUS_OUT.
  expect(threw).toBe(0);
}, 1_800_000);
