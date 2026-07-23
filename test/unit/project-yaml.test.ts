import { describe, expect, it } from "vitest";
import {
  findProjectConfigKeyLines,
  findProjectConfigValueLines,
  isProjectConfigFileName,
} from "../../src/core/project-yaml";

describe("findProjectConfigKeyLines — direct children of project:/website:/book:", () => {
  it("finds direct children of project:", () => {
    const text = ["project:", "  title: My Project", "  type: website"].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([
      { line: 1, container: "project", key: "title", keyRange: { startCol: 2, endCol: 7 } },
      { line: 2, container: "project", key: "type", keyRange: { startCol: 2, endCol: 6 } },
    ]);
  });

  it("finds direct children of website:", () => {
    const text = ["website:", "  title: My Site", "  navbar: {}"].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([
      { line: 1, container: "website", key: "title", keyRange: { startCol: 2, endCol: 7 } },
      { line: 2, container: "website", key: "navbar", keyRange: { startCol: 2, endCol: 8 } },
    ]);
  });

  it("finds direct children of book:", () => {
    const text = ["book:", "  title: My Book", "  chapters:"].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([
      { line: 1, container: "book", key: "title", keyRange: { startCol: 2, endCol: 7 } },
      { line: 2, container: "book", key: "chapters", keyRange: { startCol: 2, endCol: 10 } },
    ]);
  });

  it("ignores a top-level container that is not project:/website:/book:", () => {
    const text = ["format:", "  html:", "    toc: true"].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([]);
  });
});

describe("findProjectConfigKeyLines — never a false flag (out-of-scope shapes are skipped)", () => {
  it("skips deeper nesting under a project: child (only the container's OWN indent is scanned)", () => {
    const text = ["project:", "  execute-dir: file", "    fake-deep: 1"].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([
      { line: 1, container: "project", key: "execute-dir", keyRange: { startCol: 2, endCol: 13 } },
    ]);
  });

  it("skips a dedent back to a shallower indent under the same container", () => {
    const text = [
      "project:",
      "  render:",
      "    - \"*.qmd\"",
      " type: website", // 1-space dedent, not the established 2-space child indent
    ].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([
      { line: 1, container: "project", key: "render", keyRange: { startCol: 2, endCol: 8 } },
    ]);
  });

  it("skips block-sequence items ('- ...') at the container's own indent", () => {
    const text = ["project:", "  - not-a-key", "  type: website"].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([
      { line: 2, container: "project", key: "type", keyRange: { startCol: 2, endCol: 6 } },
    ]);
  });

  it("never flags a column-0 sibling key as a child, even when the container has no children yet", () => {
    // project: has NO indented child before the column-0 `bibliography:` line —
    // a naive scanner that lets the first-seen-indent default to 0 here would
    // misread `bibliography` as a project: child. It must not.
    const text = ["project:", "bibliography: refs.bib"].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([]);
  });

  it("does not enter a container written with an inline scalar value (not a pure mapping)", () => {
    const text = ["project: not-a-mapping", "  type: website"].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([]);
  });

  it("ignores blank lines and full-line comments inside a container without breaking the scan", () => {
    const text = [
      "project:",
      "",
      "  # a comment",
      "  type: website",
    ].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([
      { line: 3, container: "project", key: "type", keyRange: { startCol: 2, endCol: 6 } },
    ]);
  });
});

describe("findProjectConfigKeyLines — multiple containers in one document", () => {
  it("scans project:, website:, and book: independently, each with its own child indent", () => {
    const text = [
      "project:",
      "  type: website",
      "website:",
      "  title: Site",
      "book:",
      "  title: Book",
    ].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([
      { line: 1, container: "project", key: "type", keyRange: { startCol: 2, endCol: 6 } },
      { line: 3, container: "website", key: "title", keyRange: { startCol: 2, endCol: 7 } },
      { line: 5, container: "book", key: "title", keyRange: { startCol: 2, endCol: 7 } },
    ]);
  });

  it("returns an empty array for a document with none of project:/website:/book:", () => {
    const text = ["format:", "  html:", "    toc: true"].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([]);
  });

  it("returns an empty array for an empty document", () => {
    expect(findProjectConfigKeyLines("")).toEqual([]);
  });
});

describe("findProjectConfigKeyLines — quoted keys (adversarial review, Session 47)", () => {
  it("unquotes a double-quoted key so it compares equal to its unquoted form", () => {
    const text = ['project:', '  "output-dir": docs'].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([
      // keyRange spans the FULL token on screen, quotes included (col 2..14 = `"output-dir"`,
      // 12 chars); `key` is the unquoted logical name used for schema comparison.
      { line: 1, container: "project", key: "output-dir", keyRange: { startCol: 2, endCol: 14 } },
    ]);
  });

  it("unquotes a single-quoted key the same way", () => {
    const text = ["project:", "  'output-dir': docs"].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([
      { line: 1, container: "project", key: "output-dir", keyRange: { startCol: 2, endCol: 14 } },
    ]);
  });

  it("real-world case: a quoted UNKNOWN key is still reported (as its unquoted name), not silently swallowed", () => {
    const text = ["project:", '  "bogus-key": true'].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([
      { line: 1, container: "project", key: "bogus-key", keyRange: { startCol: 2, endCol: 13 } },
    ]);
  });
});

describe("findProjectConfigKeyLines — a leading UTF-8 BOM does not disable scanning (adversarial review, Session 47)", () => {
  it("still recognizes project: as a container when the file starts with a BOM", () => {
    const text = "﻿project:\n  bogus-key: 1";
    expect(findProjectConfigKeyLines(text)).toEqual([
      { line: 1, container: "project", key: "bogus-key", keyRange: { startCol: 2, endCol: 11 } },
    ]);
  });
});

describe("findProjectConfigValueLines — one-level scalar values under project:/website:/book:", () => {
  it("emits {container, key, valueRange, rawToken} for each direct scalar child, spans exact", () => {
    const text = ["website:", "  draft-mode: hidden", "  title: My Site"].join("\n");
    expect(findProjectConfigValueLines(text)).toEqual([
      // `hidden` spans cols 14..20 on `  draft-mode: hidden`
      { line: 1, container: "website", path: [], key: "draft-mode", valueRange: { startCol: 14, endCol: 20 }, rawToken: "hidden" },
      { line: 2, container: "website", path: [], key: "title", valueRange: { startCol: 9, endCol: 16 }, rawToken: "My Site" },
    ]);
  });

  it("tracks each container independently across the document", () => {
    const text = [
      "project:",
      "  execute-dir: banana",
      "book:",
      "  downloads: mobi",
    ].join("\n");
    expect(findProjectConfigValueLines(text)).toEqual([
      { line: 1, container: "project", path: [], key: "execute-dir", valueRange: { startCol: 15, endCol: 21 }, rawToken: "banana" },
      { line: 3, container: "book", path: [], key: "downloads", valueRange: { startCol: 13, endCol: 17 }, rawToken: "mobi" },
    ]);
  });

  it("does not emit the block-opener itself (no scalar value), but DOES emit its depth-2 grandchild", () => {
    const text = ["website:", "  navbar:", "    title: Nav"].join("\n");
    // `navbar:` opens a nested block (empty value → not emitted); its `title:` grandchild
    // is now in DEPTH-2 scope and emitted with path=["navbar"] (`title` spans cols 11..14).
    expect(findProjectConfigValueLines(text)).toEqual([
      { line: 2, container: "website", path: ["navbar"], key: "title", valueRange: { startCol: 11, endCol: 14 }, rawToken: "Nav" },
    ]);
  });

  it("emits a flow-sequence value as its `[…]` token (the matcher, not the enumerator, skips it)", () => {
    const text = ["website:", "  repo-actions: [edit, source]"].join("\n");
    expect(findProjectConfigValueLines(text)).toEqual([
      { line: 1, container: "website", path: [], key: "repo-actions", valueRange: { startCol: 16, endCol: 30 }, rawToken: "[edit, source]" },
    ]);
  });

  it("unquotes a quoted key so it resolves against the schema's bare name", () => {
    const text = ["website:", '  "draft-mode": hidden'].join("\n");
    const got = findProjectConfigValueLines(text);
    expect(got).toHaveLength(1);
    expect(got[0].key).toBe("draft-mode");
    expect(got[0].rawToken).toBe("hidden");
  });

  it("skips deeper nesting, dedents, block-sequence items, comments, and unknown containers", () => {
    const text = [
      "metadata:", // unknown container (not a recognized value container — was `format:` before S143 made format live)
      "  html:",
      "    toc: bad",
      "website:",
      "  # a comment",
      "  draft-mode: gone",
      "    deeper: x", // deeper than the container's own child indent → skipped
      "  - seqitem", // block-sequence item → skipped
    ].join("\n");
    expect(findProjectConfigValueLines(text)).toEqual([
      { line: 5, container: "website", path: [], key: "draft-mode", valueRange: { startCol: 14, endCol: 18 }, rawToken: "gone" },
    ]);
  });

  it("returns [] for an empty document and one whose only top-level container is unrecognized", () => {
    expect(findProjectConfigValueLines("")).toEqual([]);
    // `metadata` is not a recognized value container → its descendants are skipped. (This
    // was `format:` before S143 made `format` a live value container; `format:\n  html:\n
    //    toc: banana` now emits, proven in the format describe below.)
    expect(findProjectConfigValueLines("metadata:\n  html:\n    toc: true")).toEqual([]);
  });
});

describe("findProjectConfigValueLines — scanFlow continuation guard (THE cardinal-sin FP, plan §2.3/§7.3)", () => {
  it("does NOT emit a mapping-looking line folded inside a multi-line QUOTED value (quarto renders it exit 0)", () => {
    // `title: "…` opens an unterminated double-quoted scalar; the `draft-mode: x` on the
    // next line is part of that quoted title (quarto folds it, exit 0). A naive line
    // scanner would emit `draft-mode: x` and the matcher would flag it — a cardinal-sin
    // FP. The scanFlow guard turns it into a correct non-emit. `reader-mode: bad` AFTER
    // the closing quote IS a real child and IS emitted.
    const text = [
      "website:",
      '  title: "a long title that wraps',
      "  draft-mode: not-a-real-value here\"",
      "  reader-mode: bad",
    ].join("\n");
    const got = findProjectConfigValueLines(text);
    // `title` OPENS the multi-line quote (unresolvable opener → not emitted, §9-review HIGH);
    // the folded `draft-mode` line is skipped; only `reader-mode` after the close quote is real.
    expect(got.map((v) => v.key)).toEqual(["reader-mode"]);
    expect(got.find((v) => v.key === "draft-mode"), "the folded draft-mode line must NOT be emitted").toBeUndefined();
  });

  it("does NOT emit a mapping-looking continuation line of a multi-line FLOW collection (at the container's OWN indent, so only scanFlow — not the indent guard — catches it)", () => {
    const text = [
      "website:",
      "  repo-actions: [",
      "  draft-mode: gone]", // indent 2 == container child indent; a naive scanner emits it (FP)
      "  reader-mode: false",
    ].join("\n");
    const got = findProjectConfigValueLines(text);
    // `repo-actions: [` OPENS a multi-line flow collection (unresolvable opener → not
    // emitted); the folded `draft-mode: gone]` line is inside the still-open flow → skipped;
    // only `reader-mode` after the `]` is a real, complete scalar.
    expect(got.map((v) => v.key)).toEqual(["reader-mode"]);
    expect(got.find((v) => v.key === "draft-mode"), "the in-flow draft-mode line must NOT be emitted").toBeUndefined();
  });
});

describe("findProjectConfigValueLines — DEPTH-2 grandchildren under a block-opener child (depth-2 value plan §3.2 B)", () => {
  it("emits a depth-2 grandchild line with path=[child], keeping depth-1 scalars as path=[]", () => {
    const text = [
      "website:",
      "  navbar:",
      "    collapse-below: sm",
      "    pinned: true",
      "  draft-mode: hidden",
    ].join("\n");
    const got = findProjectConfigValueLines(text);
    expect(got.map((v) => ({ key: v.key, path: v.path }))).toEqual([
      { key: "collapse-below", path: ["navbar"] },
      { key: "pinned", path: ["navbar"] },
      { key: "draft-mode", path: [] },
    ]);
    // exact value span on the first grandchild (`sm` at cols 20..22 of `    collapse-below: sm`)
    expect(got.find((v) => v.key === "collapse-below")).toMatchObject({
      container: "website",
      valueRange: { startCol: 20, endCol: 22 },
      rawToken: "sm",
    });
  });

  it("resolves a grandchild path for project.preview and book (super-merged)", () => {
    const project = findProjectConfigValueLines(["project:", "  preview:", "    browser: nope"].join("\n"));
    expect(project.map((v) => ({ container: v.container, path: v.path, key: v.key }))).toEqual([
      { container: "project", path: ["preview"], key: "browser" },
    ]);
    const book = findProjectConfigValueLines(["book:", "  sidebar:", "    style: dock"].join("\n"));
    expect(book.map((v) => ({ container: v.container, path: v.path, key: v.key }))).toEqual([
      { container: "book", path: ["sidebar"], key: "style" },
    ]);
  });

  it("does NOT emit a mapping-looking line folded inside a multi-line QUOTED grandchild value (the depth-2 scanFlow FP, NO column-0 backstop, §2.3/dragon 2)", () => {
    // `title: "…` opens an unterminated quote at DEPTH-2; the `collapse-below:` line is
    // folded into the quoted title (quarto renders exit 0). Emitting it and letting the
    // matcher flag it would be a cardinal-sin FP. The scanFlow continuation guard skips it.
    const text = [
      "website:",
      "  navbar:",
      '    title: "a long title that wraps',
      '    collapse-below: not-a-real-value"',
      "    pinned: false",
    ].join("\n");
    const got = findProjectConfigValueLines(text);
    // `title` OPENS the multi-line quote (unresolvable opener → not emitted); the folded
    // `collapse-below` line is scanFlow-skipped; only `pinned` after the close quote is real.
    expect(got.map((v) => v.key)).toEqual(["pinned"]);
    expect(
      got.find((v) => v.key === "collapse-below"),
      "the folded depth-2 collapse-below line must NOT be emitted",
    ).toBeUndefined();
  });

  it("does NOT emit depth-3+ grandchildren (double-capped), but still catches a depth-2 sibling after a depth-3 block (§2.2/dragon 7)", () => {
    const text = [
      "website:",
      "  navbar:",
      "    tools:", // depth-2 block-opener — not emitted (no scalar)
      "      - icon: github", // depth-3 — skipped
      "    collapse-below: sm", // depth-2 sibling after the depth-3 block — still caught
    ].join("\n");
    const got = findProjectConfigValueLines(text);
    expect(got.map((v) => ({ key: v.key, path: v.path }))).toEqual([
      { key: "collapse-below", path: ["navbar"] },
    ]);
  });

  it("does NOT emit a grandchild under a SEQUENCE-form child (a `- ` item hosts no depth-2 mapping value — safe FN, dragon 6)", () => {
    const text = ["website:", "  sidebar:", "    - id: main", "      style: docked"].join("\n");
    expect(findProjectConfigValueLines(text)).toEqual([]);
  });

  it("treats `navbar: true` as a depth-1 scalar (anyOf boolean arm) — no child scope opened (dragon 5)", () => {
    const text = ["website:", "  navbar: true", "  draft-mode: hidden"].join("\n");
    const got = findProjectConfigValueLines(text);
    expect(got.map((v) => ({ key: v.key, path: v.path }))).toEqual([
      { key: "navbar", path: [] },
      { key: "draft-mode", path: [] },
    ]);
  });
});

describe("findProjectConfigValueLines — DEPTH-2 exotic continuation shapes never leak a folded mapping (L4 §9 author sweep — all grounded exit 0/rejected-downstream, never a schema FP)", () => {
  it("skips a mapping-looking line folded inside a SINGLE-quoted grandchild value (and does not emit the opener)", () => {
    const text = ["website:", "  navbar:", "    title: 'wraps", "    collapse-below: not-real'", "    pinned: false"].join("\n");
    const got = findProjectConfigValueLines(text);
    expect(got.map((v) => v.key)).toEqual(["pinned"]);
  });

  it("skips a mapping-looking continuation of an unclosed FLOW collection in a grandchild value (and does not emit the opener)", () => {
    const text = ["website:", "  navbar:", "    foreground: {a: 1,", "    collapse-below: x}", "    pinned: false"].join("\n");
    const got = findProjectConfigValueLines(text);
    expect(got.map((v) => v.key)).toEqual(["pinned"]);
  });

  it("skips BLOCK-scalar content (deeper than the grandchild indent — the indent guard, since scanFlow is blind to `|`/`>`), still catching a later depth-2 sibling", () => {
    const text = ["website:", "  navbar:", "    title: |", "      collapse-below: not-real", "    pinned: false"].join("\n");
    const got = findProjectConfigValueLines(text);
    // `title:` emits (rawToken `|`, matcher-skipped anyway); its indented content is
    // depth-3 → not emitted; `pinned` is a real depth-2 sibling → emitted.
    expect(got.map((v) => v.key)).toEqual(["title", "pinned"]);
  });

  it("does NOT emit the OPENING line of a multi-line DOUBLE-quoted value — quarto FOLDS the escaped newline to a valid member (exit 0), but the raw opener token (`\"nav\\`) is not a plain scalar the matcher can reduce, so emitting it is a cardinal-sin FP (the §9-review HIGH, present at depth-1 too)", () => {
    // `location: "nav\` opens a double-quoted scalar continued via an escaped newline;
    // quarto folds `"nav\<nl>  bar"` -> `navbar` (a valid enum member) and renders exit 0.
    // The scanFlow guard skips the CONTINUATION line, but the OPENING line was previously
    // emitted with token `"nav\` and flagged against [navbar,sidebar] = FP. It must not emit.
    const text = ["website:", "  search:", '    location: "nav\\', '      bar"', "    limit: 20"].join("\n");
    const got = findProjectConfigValueLines(text);
    expect(
      got.map((v) => v.key),
      "the multi-line-quoted opener must not be emitted; the depth-2 `limit` after it still is",
    ).toEqual(["limit"]);
  });

  it("does NOT emit the OPENING line of a multi-line SINGLE-quoted or unclosed-FLOW value either (same class — folded/continued value unknowable)", () => {
    const sq = findProjectConfigValueLines(["website:", "  navbar:", "    title: 'a\\", "      b'", "    pinned: false"].join("\n"));
    expect(sq.map((v) => v.key), "single-quoted multi-line opener not emitted").toEqual(["pinned"]);
    const flow = findProjectConfigValueLines(["website:", "  repo-actions: [", "  edit]", "  title: x"].join("\n"));
    expect(flow.map((v) => v.key), "unclosed-flow opener not emitted; the scalar after `]` is").toEqual(["title"]);
  });

  it("emits an anchored grandchild value verbatim (the matcher's leading-`&` guard makes it a non-flag, not the enumerator's job — no cardinal-sin FP)", () => {
    const text = ["website:", "  navbar:", "    collapse-below: &a sm"].join("\n");
    const got = findProjectConfigValueLines(text);
    expect(got.map((v) => ({ key: v.key, path: v.path, rawToken: v.rawToken }))).toEqual([
      { key: "collapse-below", path: ["navbar"], rawToken: "&a sm" },
    ]);
  });
});

describe("findProjectConfigValueLines — a top-level execute: block's children (execute value plan §3.2)", () => {
  it("emits a depth-1 execute child with container:\"execute\", path:[], span exact", () => {
    const text = ["execute:", "  echo: banana"].join("\n");
    // `echo` at indent 2; `banana` spans cols 8..14 on `  echo: banana`.
    expect(findProjectConfigValueLines(text)).toEqual([
      { line: 1, container: "execute", path: [], key: "echo", valueRange: { startCol: 8, endCol: 14 }, rawToken: "banana" },
    ]);
  });

  it("is closedness-BLIND — emits open (output), numeric (daemon), and unknown (custom-thing) children too; the FEATURE decides what to flag", () => {
    const text = ["execute:", "  output: banana", "  daemon: 30", "  custom-thing: whatever"].join("\n");
    // All three are emitted; downstream the feature skips output (open), daemon (numeric
    // accept), and custom-thing (unknown → resolver undefined). The enumerator's job is
    // enumeration, not closedness.
    expect(findProjectConfigValueLines(text).map((v) => ({ container: v.container, key: v.key }))).toEqual([
      { container: "execute", key: "output" },
      { container: "execute", key: "daemon" },
      { container: "execute", key: "custom-thing" },
    ]);
  });

  it("tracks execute: alongside project:/website:/book: in one document", () => {
    const text = ["execute:", "  echo: banana", "project:", "  output-dir: docs"].join("\n");
    expect(findProjectConfigValueLines(text).map((v) => ({ container: v.container, key: v.key }))).toEqual([
      { container: "execute", key: "echo" },
      { container: "project", key: "output-dir" },
    ]);
  });

  it("emits a DEPTH-2 grandchild under an execute block-opener child with path=[child] (the name-collision surface: path, not bare key)", () => {
    // `knitr:` opens a nested block; `cache: banana` under it emits path=["knitr"], NOT a
    // depth-1 execute.cache. The feature resolves BY PATH → knitr ∉ CURATED_EXECUTE_KEYS
    // → undefined → skip (a safe FN; quarto itself rejects the knitr shape). Bare-name
    // resolution would mis-hit the closed execute.cache and flag `banana` — a cardinal-sin FP.
    const text = ["execute:", "  knitr:", "    cache: banana"].join("\n");
    expect(findProjectConfigValueLines(text)).toEqual([
      { line: 2, container: "execute", path: ["knitr"], key: "cache", valueRange: { startCol: 11, endCol: 17 }, rawToken: "banana" },
    ]);
  });

  it("KEY-ISOLATION LOCK (dragon 1): findProjectConfigKeyLines still IGNORES execute — the unknown-KEY feature must never flag an execute child key", () => {
    // The value enumerator recognizes execute; the KEY enumerator must NOT. Quarto ACCEPTS
    // unknown execute keys (`custom-thing: whatever` → exit 0), so flagging one would be a
    // cardinal-sin FP. This locks the two container predicates apart: adding `execute` to
    // the shared `PROJECT_CONFIG_CONTAINERS` (instead of the value-only `VALUE_CONTAINERS`)
    // would turn this red.
    const text = ["execute:", "  echo: banana", "  custom-thing: whatever"].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([]);
    // Sanity: the VALUE enumerator DOES see them (proving the two predicates genuinely differ).
    expect(findProjectConfigValueLines(text).map((v) => v.container)).toEqual(["execute", "execute"]);
  });
});

describe("findProjectConfigValueLines — a top-level format: block's per-format option values (format value plan §3.2)", () => {
  it("emits a DEPTH-2 per-format option with container:\"format\", path:[fmt], span exact (the RED→GREEN driver)", () => {
    const text = ["format:", "  html:", "    toc: banana"].join("\n");
    // `toc` at indent 4; `banana` spans cols 9..15 on `    toc: banana`. `format → html → toc`
    // is the exact depth-2 shape of `website → navbar → collapse-below` — path=["html"], NOT a
    // depth-1 format.toc. Before go-live (`format` ∉ VALUE_CONTAINERS) this returned [] (today's
    // `format:\n  html:\n    toc: true` → [] baseline); adding `format` makes it emit.
    expect(findProjectConfigValueLines(text)).toEqual([
      { line: 2, container: "format", path: ["html"], key: "toc", valueRange: { startCol: 9, endCol: 15 }, rawToken: "banana" },
    ]);
  });

  it("is resolution-BLIND — also emits a DEPTH-1 format line (the format NAME itself, `html: default`, path=[]); the FEATURE skips it", () => {
    // `html: default` is a depth-1 scalar under `format:` — the enumerator emits it with
    // path=[] (it enumerates, it does not resolve). The FEATURE's format branch handles only
    // path.length===1 (depth-2), so a path=[] line → undefined → skip: the top-level `format:`
    // scalar (a format NAME) is a deliberate FN on THIS `_quarto.yml` surface (Combo 3, deferred;
    // the `.qmd` scalar NAME is validated as of S145, Combo 1 — format-name validation plan §4.3).
    const text = ["format:", "  html: default"].join("\n");
    // `default` spans cols 8..15 on `  html: default`.
    expect(findProjectConfigValueLines(text)).toEqual([
      { line: 1, container: "format", path: [], key: "html", valueRange: { startCol: 8, endCol: 15 }, rawToken: "default" },
    ]);
  });

  it("tracks multiple format-name blocks (html + pdf) under one format:, each with its own path", () => {
    const text = ["format:", "  html:", "    toc: banana", "  pdf:", "    number-sections: nope"].join("\n");
    expect(findProjectConfigValueLines(text).map((v) => ({ container: v.container, path: v.path, key: v.key, rawToken: v.rawToken }))).toEqual([
      { container: "format", path: ["html"], key: "toc", rawToken: "banana" },
      { container: "format", path: ["pdf"], key: "number-sections", rawToken: "nope" },
    ]);
  });

  it("KEY-ISOLATION LOCK (dragon 1): findProjectConfigKeyLines still IGNORES format — the unknown-KEY feature must never flag a per-format option key", () => {
    // The value enumerator recognizes format; the KEY enumerator must NOT. Quarto ACCEPTS
    // unknown per-format option keys (`custom-opt: whatever` → exit 0), so flagging one would
    // be a cardinal-sin FP. This locks the two container predicates apart: adding `format` to
    // the shared `PROJECT_CONFIG_CONTAINERS` (instead of the value-only `VALUE_CONTAINERS`)
    // would turn this red.
    const text = ["format:", "  html:", "    toc: banana", "    custom-opt: whatever"].join("\n");
    expect(findProjectConfigKeyLines(text)).toEqual([]);
    // Sanity: the VALUE enumerator DOES see them (proving the two predicates genuinely differ).
    expect(findProjectConfigValueLines(text).map((v) => v.container)).toEqual(["format", "format"]);
  });
});

describe("isProjectConfigFileName — the filename gate is EXACT, never a suffix match (adversarial review, Session 47)", () => {
  it("accepts the exact basenames", () => {
    expect(isProjectConfigFileName("/a/b/_quarto.yml")).toBe(true);
    expect(isProjectConfigFileName("/a/b/_quarto.yaml")).toBe(true);
    expect(isProjectConfigFileName("_quarto.yml")).toBe(true);
  });

  it("rejects a file that merely ENDS WITH the target name (the confirmed false-positive shape)", () => {
    expect(isProjectConfigFileName("/a/b/not_quarto.yml")).toBe(false);
    expect(isProjectConfigFileName("/a/b/my_quarto.yml")).toBe(false);
    expect(isProjectConfigFileName("/a/b/backup_quarto.yaml")).toBe(false);
    expect(isProjectConfigFileName("/a/b/template_quarto.yml")).toBe(false);
  });

  it("rejects an unrelated file, and a directory component that happens to match", () => {
    expect(isProjectConfigFileName("/a/_quarto.yml/b.txt")).toBe(false);
    expect(isProjectConfigFileName("/a/b/readme.md")).toBe(false);
  });
});
