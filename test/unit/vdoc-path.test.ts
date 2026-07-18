import { describe, expect, it } from "vitest";
import {
  hostDiscriminator,
  isOurVdocFileName,
  tempVdocDirParse,
  tempVdocDirPrefix,
  VDOC_DIR_SEGMENTS,
  vdocFileName,
  vdocInstanceId,
  vdocKeyString,
  type VdocKey,
} from "../../src/core/embedded/vdoc-path";

/**
 * The pure naming + ownership layer for the `file:`-scheme virtual documents
 * (BACKLOG item 18, plan §6.1).
 *
 * Most of what is asserted here is a SAFETY property, not a formatting one:
 * `isOurVdocFileName` and `VDOC_DIR_SEGMENTS` together bound a DELETE loop
 * (`sweepStaleVdocs`) that runs inside the user's workspace. Posit's Quarto
 * extension writes files of the same purpose (`.vdoc.<id>.<ext>`) into the sibling
 * directory `.quarto/vdoc/`, and many users have both extensions installed.
 */
describe("vdoc-path: ownership and the sweep boundary", () => {
  it("recognizes a name it generated, and never one of Posit's", () => {
    const ours = vdocFileName("abc123", 7, "py");

    expect(isOurVdocFileName(ours)).toBe(true);
    // Posit's real shape, read from the installed quarto.quarto-1.134.0 bundle:
    //   join(dir, ".vdoc." + generatedId() + "." + ext)
    expect(isOurVdocFileName(".vdoc.a1b2c3d4.py")).toBe(false);
  });

  it("never claims a file the user (or anyone else) wrote", () => {
    for (const foreign of [
      ".vdoc.abc.py", // Posit
      ".vdoc.abc.def.py", // Posit, were their id ever to contain a dot
      "analysis.py", // an ordinary user file
      "vdoc-mit.py", // our prefix, but not our shape
      "vdoc-mit..1.py", // empty instance id
      "vdoc-mit.abc.py", // no version segment
      "vdoc-mit.abc.notanumber.py", // version is not numeric
      "prefix-vdoc-mit.abc.1.py", // our shape, but not at the start
      "vdoc-mit.abc.1.py.bak", // our shape, but not at the end
      "", // degenerate
    ]) {
      expect(isOurVdocFileName(foreign), `must not claim ${foreign}`).toBe(false);
    }
  });

  it("generates a name that cannot escape its directory", () => {
    // `ext` is supplied by the lang-map (py/r/jl/js), never by user input — but the
    // ownership gate is the last line of defence before a delete, so it must reject
    // any name carrying a path separator regardless of how one got there.
    expect(isOurVdocFileName("vdoc-mit.abc.1.py/../../secrets")).toBe(false);
    expect(isOurVdocFileName("../vdoc-mit.abc.1.py")).toBe(false);
    expect(vdocFileName("abc", 1, "py")).not.toContain("/");
  });

  it("lives in .quarto/vdoc-mit — never Posit's .quarto/vdoc", () => {
    // The FIRST of the two independent guards keeping our sweeper away from Posit's
    // live vdocs (the second is the filename prefix, above). If this ever becomes
    // ["\.quarto", "vdoc"], the sweeper starts deleting their files.
    expect([...VDOC_DIR_SEGMENTS]).toEqual([".quarto", "vdoc-mit"]);
  });

  it("round-trips the instance id, and reports none for a foreign name", () => {
    expect(vdocInstanceId(vdocFileName("w9x8y7", 3, "r"))).toBe("w9x8y7");
    expect(vdocInstanceId(".vdoc.a1b2.py")).toBeNull();
    expect(vdocInstanceId("analysis.py")).toBeNull();
  });
});

/**
 * The temp-dir grammar (plan `docs/planning/2026-07-16-os-temp-vdoc-sweep-plan.md` §4.2).
 *
 * These names bound a DELETE loop that runs in the OS temp dir — a directory shared with
 * every other process on the machine, unlike the workspace sweep's private
 * `.quarto/vdoc-mit/`. The host tag and the PID are not decoration: they are the only two
 * guards (G0/G2) standing between the sweep and a LIVE sibling window's data, because a
 * live window's own directory passes every other guard by construction (§4.3).
 */
describe("vdoc-path: the temp-dir grammar (the crash-reclaim boundary)", () => {
  it("derives a 6-char lowercase-hex host tag, stable for one hostname", () => {
    const tag = hostDiscriminator("some-laptop.local");

    // 6 lowercase hex chars is what the anchored grammar accepts (`[0-9a-f]{6}`); any
    // other shape makes a directory this host writes unparseable to its own sweep.
    expect(tag).toMatch(/^[0-9a-f]{6}$/);
    // Stable: the tag is re-derived at every activation and must match what a PREVIOUS
    // session stamped, or the sweep skips its own leftovers forever (G0 fails to leak).
    expect(hostDiscriminator("some-laptop.local")).toBe(tag);
  });

  it("builds the mkdtemp prefix with its trailing dash (🐉2 — an EXACT-string pin)", () => {
    // 🐉2, and the assertion shape is the point. `mkdtemp` appends its 6 random chars
    // with NO separator of its own — measured firsthand this session:
    //   prefix "quarto-mit-vdoc-2954b2-93497-"  ->  quarto-mit-vdoc-2954b2-93497-liatFS   ✓ parses
    //   prefix "quarto-mit-vdoc-2954b2-93497"   ->  quarto-mit-vdoc-2954b2-93497OU5bb0    ✗ matches NOTHING
    // So dropping the dash makes every directory we create unparseable to our own sweep:
    // a TOTAL, SILENT leak — in the safe direction, which is exactly why no behavioural
    // test would ever catch it. Only an exact-string assertion discriminates this; a
    // `toMatch`/round-trip assertion passes happily with the dash gone.
    expect(tempVdocDirPrefix("2954b2", 93497)).toBe("quarto-mit-vdoc-2954b2-93497-");
  });

  it("round-trips the host and pid off a REAL mkdtemp name", () => {
    // Not a hand-written string: this is verbatim output from `mkdtemp` on this machine
    // (probed firsthand this session), so the grammar is pinned against what the syscall
    // actually produces rather than against what we imagine it produces.
    expect(tempVdocDirParse("quarto-mit-vdoc-2954b2-93497-liatFS")).toEqual({
      host: "2954b2",
      pid: 93497,
    });
    // `pid` must be a NUMBER — it is handed straight to `kill(pid, 0)`.
    expect(tempVdocDirParse("quarto-mit-vdoc-2954b2-93497-liatFS")?.pid).toBe(93497);
  });

  it("claims nothing it did not name — null is SKIP, never 'reclaim it anyway'", () => {
    // Guard G1, and the stakes are higher here than for the workspace sweep: this loop
    // runs in the OS temp dir, next to every other process's files. A name we do not
    // positively recognise is someone else's data.
    for (const foreign of [
      "quarto-mit-vdoc-2954b2-93497OU5bb0", // 🐉2: our own name, minus the trailing dash
      // The REAL legacy shape: `mkdtemp(tmpdir + "quarto-mit-vdoc-")` -> prefix + 6 random
      // chars, no host tag and no pid. Verified against actual directories still sitting in
      // this machine's $TMPDIR (quarto-mit-vdoc-BLjvTa, -crPIgP, -NZ9UpT, ...). These are
      // deliberately NOT reclaimable: with no pid there is no way to know whether the window
      // that made one is still alive, and guessing would delete live data. They leak, and
      // that is the correct trade — nothing has ever shipped, so they exist only on dev boxes.
      "quarto-mit-vdoc-BLjvTa",
      "quarto-mit-vdoc-14933-rzvF0U", // a plausible-but-fabricated shape no version ever wrote
      "quarto-mit-vdoc-ZZZZZZ-1-abcdef", // host tag not hex
      "quarto-mit-vdoc-2954b2-abc-abcdef", // pid not numeric
      "quarto-mit-vdoc-2954b2--abcdef", // empty pid
      "quarto-mit-vdoc-2954b2-1-abcdef/../../etc", // traversal, trailing
      "../quarto-mit-vdoc-2954b2-1-abcdef", // traversal, leading
      "quarto-mit-vdoc-2954b2-1-abcdefg", // 7 suffix chars, not 6
      "pre-quarto-mit-vdoc-2954b2-1-abcdef", // our shape, not at the start
      ".vdoc.a1b2c3d4.py", // Posit's
      "com.apple.launchd.aBcDeF", // an ordinary temp-dir neighbour
      "", // degenerate
    ]) {
      expect(tempVdocDirParse(foreign), `must not claim ${foreign}`).toBeNull();
    }
  });
});

describe("vdoc-path: the key", () => {
  const base: VdocKey = {
    docUri: "file:///w/a.qmd",
    languageId: "python",
    ext: "py",
    kind: "cell",
    cellStartLine: 10,
  };

  it("discriminates cells of the same language in the same document", () => {
    // 🐉4. `outline.ts` forwards EVERY cell concurrently (nested `Promise.all` at
    // :175/:207). Two same-language cells that share a key would share a vdoc path,
    // and the two concurrent writes would race — each cell rendering the other's
    // symbols. The cell discriminator is what makes that unrepresentable.
    expect(vdocKeyString({ ...base, cellStartLine: 10 })).not.toBe(
      vdocKeyString({ ...base, cellStartLine: 20 }),
    );
  });

  it("discriminates the two content SHAPES for one (document, language)", () => {
    // `kind: "lang"` holds every cell of a language (`buildVirtualContent`, used by
    // cursor-position forwards); `kind: "cell"` holds exactly one (`buildCellVirtualContent`,
    // used by in-cell symbols and Format Cell). Same document, same language, but
    // different bytes — so they must never share a path.
    expect(vdocKeyString({ ...base, kind: "lang" })).not.toBe(
      vdocKeyString({ ...base, kind: "cell" }),
    );
  });

  it("discriminates documents and languages", () => {
    expect(vdocKeyString({ ...base, docUri: "file:///w/b.qmd" })).not.toBe(
      vdocKeyString(base),
    );
    expect(
      vdocKeyString({ ...base, languageId: "r", ext: "r" }),
    ).not.toBe(vdocKeyString(base));
  });

  it("is stable for the same key", () => {
    expect(vdocKeyString({ ...base })).toBe(vdocKeyString({ ...base }));
  });

  it("joins fields with a NUL byte — the exact separator, pinned against a silent refactor", () => {
    // The separator is written as the escape `"\0"` in source (a raw NUL byte made
    // git and grep read the whole file as binary — BACKLOG:184). This pins the
    // RUNTIME separator to U+0000, so swapping it for any other character — or the
    // classic `"\\0"` typo (backslash-zero, TWO chars, a real behaviour change) —
    // turns this red instead of shipping silently.
    expect(vdocKeyString(base)).toBe(
      ["file:///w/a.qmd", "python", "py", "cell", "10"].join("\0"),
    );
    // Belt-and-braces on the two-char `\0` regression specifically: the key must
    // contain the NUL control character, never a literal backslash-zero.
    expect(vdocKeyString(base).includes("\0")).toBe(true);
    expect(vdocKeyString(base).includes("\\0")).toBe(false);
  });

  it("cannot be forged by a docUri that embeds separator-like content", () => {
    // The separator is a NUL byte — it cannot occur in a URI, a languageId, or an
    // extension, so no field value can splice across field boundaries to spoof
    // another key's string. A docUri stuffed with the other fields' text stays one
    // field, so it still differs from a genuinely different key.
    expect(vdocKeyString({ ...base, docUri: "file:///w/a.qmd python py cell 10" })).not.toBe(
      vdocKeyString(base),
    );
  });
});

describe("vdoc-path: the file name", () => {
  it("gives every write a distinct path, so two writes can never race", () => {
    // Uniqueness comes from the monotonic version, NOT from a hash of the key — so
    // there is no hash-collision failure mode in which two live cells overwrite each
    // other's vdoc.
    const a = vdocFileName("inst", 1, "py");
    const b = vdocFileName("inst", 2, "py");
    expect(a).not.toBe(b);
    expect(isOurVdocFileName(a) && isOurVdocFileName(b)).toBe(true);
  });

  it("ends in the extension VS Code resolves the languageId from", () => {
    // The trailing `.py`/`.r`/`.jl`/`.js` is the ONLY reason the vdoc resolves to the
    // target language at all — without it no provider matches and the forward is
    // silently dead (which is precisely the defect this module exists to fix).
    expect(vdocFileName("i", 1, "py").endsWith(".py")).toBe(true);
    expect(vdocFileName("i", 1, "r").endsWith(".r")).toBe(true);
    expect(vdocFileName("i", 1, "jl").endsWith(".jl")).toBe(true);
    expect(vdocFileName("i", 1, "js").endsWith(".js")).toBe(true);
  });

  it("does not begin with a dot", () => {
    // Deliberate: the containing directory is already hidden, and a dotted name would
    // opt these files into the "ignore hidden files" default glob that Pyright/Pylance
    // ship — the exact tool we need to read them.
    expect(vdocFileName("i", 1, "py").startsWith(".")).toBe(false);
  });
});
