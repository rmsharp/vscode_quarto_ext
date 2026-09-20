// The real-document measure, stage 2: the raw-HTML heading adjustment (the operator decision of
// Session 267 — a raw `<hN>` line is NOT an Outline heading). For every document, insert each
// LINE-START raw `<h1>`-`<h6>` tag found outside ``` / ~~~ fences into the shipped model's heading
// list at its source line, and write the adjusted LEVEL list. If raw passthrough tags are the only
// difference, the adjusted list equals quarto's.
// (Session 265's `tools/rawhtml_adjust.js`, moved here and adopted as the standing measure, S268.)
//
// Usage: node tools/realdoc-score/rawhtml_adjust.js <corpus.json> <out.tsv> <model.cjs>
// The model bundle is REQUIRED — the old default pointed at a file beside the script in scratchpad.
const fs = require("fs");
const [, , corpus, out, model] = process.argv;
if (!corpus || !out || !model) {
  console.error("realdoc-score: usage: rawhtml_adjust.js <corpus.json> <out.tsv> <model.cjs>");
  process.exit(2);
}
const { findHeadings } = require(require("path").resolve(model));
const docs = JSON.parse(fs.readFileSync(corpus, "utf8"));
const rows = []; let withRaw = 0, rawTotal = 0;
for (const [p, text] of docs) {
  const lines = text.split(/\r?\n/);
  let fence = null; let comment = false; const raw = [];
  lines.forEach((ln, i) => {
    // Skip HTML comments (quarto never renders a tag inside one) — tracked across lines.
    if (comment) { if (ln.includes("-->")) comment = false; return; }
    if (!fence && /^\s{0,3}<!--/.test(ln) && !ln.includes("-->")) { comment = true; return; }
    const f = ln.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (f) { if (!fence) fence = f[1][0]; else if (f[1][0] === fence) fence = null; return; }
    if (fence) return;
    const m = ln.match(/^\s{0,3}<h([1-6])(?=[\s>])/i);
    // A raw tag with class "title" is dropped by the extractor (its `"title" in class` rule), so it is
    // not in quarto's column either — leave it out here too, or the two rules disagree.
    if (m && !/class\s*=\s*["'][^"']*\btitle\b/i.test(ln)) raw.push({ level: Number(m[1]), line: i });
  });
  if (!raw.length) continue;
  withRaw++; rawTotal += raw.length;
  const hs = findHeadings(text).map((h) => ({ level: h.level, line: h.line }));
  const merged = hs.concat(raw).sort((a, b) => a.line - b.line);
  rows.push([p, raw.length, merged.map((h) => h.level).join(",")].join("\t"));
}
fs.writeFileSync(out, rows.join("\n") + "\n");
console.log(`documents with line-start raw <hN> outside fences: ${withRaw}; raw tags: ${rawTotal}`);
