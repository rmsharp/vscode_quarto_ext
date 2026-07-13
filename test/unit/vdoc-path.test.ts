import { describe, expect, it } from "vitest";
import {
  isOurVdocFileName,
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

  it("cannot be forged by a docUri that embeds the separator", () => {
    // The separator is a space, which cannot occur in a URI — so no field value can
    // spoof another key's string. Two genuinely different keys stay different.
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
