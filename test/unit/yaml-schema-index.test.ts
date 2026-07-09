import { describe, expect, it } from "vitest";
import {
  CURATED_CELL_OPTIONS,
  CURATED_EXECUTE_KEYS,
  CURATED_FRONTMATTER_KEYS,
  CURATED_SCHEMA_INDEX,
  parseSchemaIndex,
} from "../../src/core/yaml-schema";

/**
 * A small fixture mirroring the SHAPE of the real installed schema file
 * `<share>/editor/tools/yaml/yaml-intelligence-resources.json` (probed live
 * against Quarto 1.7.33): a dict keyed by `schema/<file>.yml`; `cell-*` files
 * hold option entries; `definitions.yml` holds `{id, …}` refs; `document-*`
 * files hold front-matter keys (which cell-option completion must ignore).
 * Synthetic and small so the parser tests are hermetic — the real installed
 * file is exercised end-to-end in the integration host (Slice 6d-3 layer 5).
 */
const FIXTURE = JSON.stringify({
  "schema/cell-codeoutput.yml": [
    {
      name: "echo",
      schema: { anyOf: ["boolean", { enum: ["fenced"] }] },
      description: { short: "Show code.", long: "long form…" },
    },
    { name: "eval", schema: "boolean", description: "Evaluate the cell." },
    // A DOCUMENT-CONTEXT cell option (tags.contexts names a document-* context):
    // Quarto's getFormatSchema folds it into the per-format source (plan §2.3), so
    // it is a genuine per-format document option (kept under a matching format).
    {
      name: "code-fold",
      tags: { formats: ["$html-all"], contexts: ["document-code"] },
      schema: { anyOf: ["boolean", { enum: ["show"] }] },
      description: "Collapsible code (HTML only).",
    },
  ],
  "schema/cell-figure.yml": [
    { name: "fig-cap", schema: { maybeArrayOf: "string" }, description: "Figure caption" },
    { name: "fig-width", tags: { engine: "knitr" }, schema: "number", description: "Width" },
    {
      name: "fig-align",
      schema: { enum: ["default", "left", "right", "center"] },
      description: "Alignment",
    },
    // A CELL-ONLY option: it carries a tags.formats but NO document-* context, so
    // Quarto's getFormatSchema does NOT offer it at document/format level. The
    // per-format fold-in must EXCLUDE it (predicate is the document context, not
    // merely tags.formats present) — the review-caught over-offer discriminator.
    {
      name: "fig-alt",
      tags: { formats: ["$html-all"] },
      schema: "string",
      description: "Figure alt text (cell-only — no document context).",
    },
  ],
  "schema/cell-pagelayout.yml": [
    { name: "column", schema: { ref: "page-column" }, description: { short: "Page column" } },
  ],
  "schema/cell-cache.yml": [
    { name: "cache", tags: { engine: "knitr" }, schema: "boolean", description: "Cache." },
    {
      name: "export",
      hidden: true,
      tags: { engine: "jupyter" },
      schema: "boolean",
      description: "Hidden — must be excluded.",
    },
  ],
  "schema/cell-textoutput.yml": [
    { name: "tags", tags: { engine: "jupyter" }, schema: { maybeArrayOf: "string" }, description: "Jupyter cell tags" },
    {
      name: "tbl-colwidths",
      tags: { engine: ["knitr", "jupyter"] },
      schema: { anyOf: ["boolean", { enum: ["auto"] }] },
      description: "Widths",
    },
    { name: "code-overflow", schema: { enum: ["scroll", "wrap"] }, description: "Overflow" },
    { name: "message", tags: { engine: "knitr" }, schema: { enum: [true, false, "NA"] }, description: "Messages" },
    { name: "label", schema: "string", description: { short: "Unique label" } },
    {
      name: "animation-hook",
      tags: { engine: "knitr" },
      schema: { string: { completions: ["ffmpeg", "gifski"] } },
      description: "Hook",
    },
  ],
  "schema/document-execute.yml": [
    { name: "freeze", schema: { enum: ["auto"] }, description: "Document key, not a cell option." },
  ],
  "schema/document-options.yml": [
    { name: "toc", schema: "boolean", description: { short: "Table of contents." } },
    { name: "secret", hidden: true, schema: "string", description: "Hidden — excluded." },
    // A format-scoped document key valid for html/revealjs but NOT gfm — the
    // per-format filter discriminator (b2-i).
    {
      name: "theme",
      tags: { formats: ["$html-doc", "revealjs"] },
      schema: "string",
      description: "Visual theme (HTML/revealjs only).",
    },
    // A pdf-only document key — must be EXCLUDED under html (proves the filter runs).
    {
      name: "keep-tex",
      tags: { formats: ["$pdf-all"] },
      schema: "boolean",
      description: "Keep intermediate TeX (PDF only).",
    },
  ],
  // The alias table (`schema/format-aliases.yml`, `{aliases: …}`) the reader
  // extracts to expand `$`-aliases in `tags.formats`. A small nested subset
  // mirroring the real 14-entry table's SHAPE (grounded against Quarto 1.7.33).
  "schema/format-aliases.yml": {
    aliases: {
      "html-doc": ["html", "html4", "html5"],
      "html-all": ["$html-doc", "dashboard"], // nested
      "pdf-all": ["latex", "pdf", "beamer"],
    },
  },
  // Mirrors the real collision: the only `format` field in `document-*.yml` is an
  // epub-scoped STRING (no value enum). The index enriches it with the format names
  // so a top-level `format: <here>` scalar completes them (6d-6+).
  "schema/document-epub.yml": [
    { name: "format", schema: "string", description: "Text describing the format of this publication." },
  ],
  // An object-valued per-format option (6d-6+ b2-iii-key) — the EXACT real shape
  // (anyOf[boolean, {object:{properties:{...}}}]) grounded against Quarto 1.7.33
  // `schema/document-code.yml`, format-scoped `$html-doc` like the real option.
  "schema/document-code.yml": [
    {
      name: "code-tools",
      tags: { formats: ["$html-doc"] },
      schema: {
        anyOf: [
          "boolean",
          {
            object: {
              closed: true,
              properties: {
                source: { anyOf: ["boolean", "string"] },
                toggle: "boolean",
                // A description nested ONE level inside the scalar-type wrapper
                // (the dominant real-schema pattern, not a direct sibling) —
                // exercises childDescription's nested-search path.
                caption: { string: { description: "Caption text for the code tools menu." } },
              },
            },
          },
        ],
      },
      description: { short: "Include a code tools menu.", long: "Longer form…" },
    },
  ],
  // An object-valued option whose OWN property ("markdown") is ITSELF
  // object-valued — a minimal faithful subset of the real `document-editor.yml`
  // shape, for the ONE-object-level depth-cap test (deeper nesting deferred,
  // b2-iii-deep).
  "schema/document-editor.yml": [
    {
      name: "editor",
      schema: {
        anyOf: [
          { enum: ["source", "visual"] },
          {
            object: {
              hidden: true,
              properties: {
                mode: { enum: ["source", "visual"], description: "Default editing mode." },
                markdown: { object: { properties: { wrap: { anyOf: [{ enum: ["sentence", "none"] }, "number"] } } } },
                // The REAL `render-on-save` sub-property (grounded against Quarto
                // 1.7.33): a `{tags, schema: "boolean"}` WRAPPER, not a bare
                // "boolean" or a `{boolean: {...}}` DSL object — the b2-iii-value
                // gap b `valuesOfSchema` must unwrap via `.schema`.
                "render-on-save": {
                  tags: { engine: ["jupyter"] },
                  schema: "boolean",
                  description: "Re-render for preview whenever the document is saved.",
                },
              },
            },
          },
        ],
      },
      description: "Editor to use for authoring content.",
    },
  ],
  // The REAL `html-math-method` option (schema/document-options.yml, grounded
  // against Quarto 1.7.33): its `anyOf` first arm is a bare `ref` to the
  // `math-methods` definition (not wrapped in an object), and its second arm's
  // `method` property is the SAME `ref` one level deeper — a faithful case for
  // the object-children resolver (b2-iii-key, already shipped) AND the value
  // resolver's definition-enum-object gap (b2-iii-value gap a).
  "schema/document-math.yml": [
    {
      name: "html-math-method",
      tags: { formats: ["$html-doc"] },
      schema: {
        anyOf: [
          { ref: "math-methods" },
          {
            object: {
              properties: {
                method: { ref: "math-methods" },
                url: "string",
              },
              required: ["method"],
            },
          },
        ],
      },
      description: "Method used to render math in HTML output.",
    },
  ],
  // The REAL `crossref` option (schema/document-crossref.yml, grounded against
  // Quarto 1.7.33): `chapters` is an OBJECT-WRAPPED boolean DSL form
  // (`{boolean: {description, default}}`) — distinct from BOTH a bare "boolean"
  // (code-tools.toggle, already works) and the `{tags, schema:"boolean"}`
  // wrapper (editor.render-on-save, gap b) — `valuesOfSchema` only recognizes
  // the bare literal today (b2-iii-value gap c, found by Session 37's review).
  "schema/document-crossref.yml": [
    {
      name: "crossref",
      schema: {
        object: {
          properties: {
            chapters: {
              boolean: {
                description: "Use top level sections (H1) in this document as chapters.",
                default: false,
              },
            },
          },
        },
      },
      description: "Configuration for cross-reference labels and prefixes.",
    },
  ],
  // A self-referencing ref pair — proves the object resolver TERMINATES on a
  // cyclic definitions graph (never lands on an object) instead of hanging.
  "schema/document-cyclic-test.yml": [
    {
      name: "cyclic-opt",
      schema: { ref: "cyclic-a" },
      description: "Resolves through a cyclic ref chain — must terminate, not hang.",
    },
  ],
  // An option whose value is UNCONDITIONALLY an array of objects (no bare-object
  // alternative) — the EXACT real shape of `other-links` (schema/document-links.yml
  // -> definitions `other-links`, grounded against Quarto 1.7.33). Its only valid
  // YAML shape is a `-`-prefixed sequence, so offering its array element's
  // properties as MAPPING keys (`other-links:\n  text: …`) would be schema-invalid
  // — the resolver must NOT unwrap a bare `arrayOf` into flat children.
  "schema/document-array-only-test.yml": [
    {
      name: "other-links",
      tags: { formats: ["$html-doc"] },
      schema: { anyOf: [{ enum: [false] }, { ref: "other-links" }] },
      description: "Additional links to display (a sequence of link objects).",
    },
  ],
  // The REAL name-collision dedup bug (grounded against Quarto 1.7.33): Quarto
  // defines TWO same-named `copyright` document options across separate files.
  // `document-attributes.yml`'s is a bare, property-less JATS-scoped `"object"`
  // (no completable children) — inserted FIRST here, mirroring its real JSON key
  // order (alphabetically before `document-metadata.yml`, the source of the bug:
  // first-occurrence-wins picked this poorer definition). `document-metadata.yml`'s
  // is the richer, real `anyOf[{object:{properties:{year,holder,statement}}}, "string"]`
  // form, inserted SECOND, matching real iteration order. `collectFields` must keep
  // the richer (children-bearing) definition regardless of which occurs first.
  "schema/document-attributes.yml": [
    {
      name: "copyright",
      tags: { formats: ["$jats-all"] },
      schema: "object",
      description: "Licensing and copyright information.",
    },
  ],
  "schema/document-metadata.yml": [
    {
      name: "copyright",
      tags: { formats: ["$html-doc", "$jats-all"] },
      schema: {
        anyOf: [
          {
            object: {
              properties: {
                year: {
                  maybeArrayOf: { anyOf: ["string", "number"] },
                  description: "The year for this copyright",
                },
                holder: { maybeArrayOf: { string: { description: "The holder of the copyright." } } },
                statement: { maybeArrayOf: { string: { description: "The text to display for the license." } } },
              },
            },
          },
          "string",
        ],
      },
      description: "The copyright for this document, if any.",
    },
  ],
  "schema/definitions.yml": [
    { id: "page-column", enum: ["body", "page", "margin"] },
    { id: "cyclic-a", ref: "cyclic-b" },
    { id: "cyclic-b", ref: "cyclic-a" },
    {
      id: "other-links",
      arrayOf: { object: { properties: { text: "string", href: "string" } } },
    },
    // The REAL `math-methods` definition (grounded against Quarto 1.7.33): unlike
    // `page-column` above (a plain array), its enum is wrapped in an OBJECT keyed
    // by `values` — the definition-enum-object form `valuesOfSchema` must also
    // handle (6d-6+ b2-iii-value gap a).
    {
      id: "math-methods",
      enum: { values: ["plain", "webtex", "gladtex", "mathml", "mathjax", "katex"] },
    },
  ],
  // The flat pandoc output-format list (6d-6 cont. format-name completion). Quarto
  // hides legacy variants (html4/html5, epub2/epub3, docbook4/docbook5) and concats
  // a few synthesized formats. Include BOTH hidden variants of each base so the
  // "hides legacy variants" assertions are all discriminating (not trivially absent).
  "pandoc/formats.yml": [
    "html", "html4", "html5",
    "epub", "epub2", "epub3",
    "docbook", "docbook4", "docbook5",
    "pdf", "revealjs", "typst",
  ],
});

describe("parseSchemaIndex — cell-option extraction", () => {
  const index = parseSchemaIndex(FIXTURE);
  const names = index.cellOptions().map((f) => f.name);

  it("collects every visible cell-option name across the cell-* files", () => {
    for (const n of [
      "echo", "eval", "fig-cap", "fig-width", "fig-align", "column", "cache",
      "tags", "tbl-colwidths", "code-overflow", "message", "label", "animation-hook",
    ]) {
      expect(names, `should include ${n}`).toContain(n);
    }
  });

  it("excludes hidden options", () => {
    expect(names).not.toContain("export");
  });

  it("excludes document (front-matter) keys", () => {
    expect(names).not.toContain("freeze");
  });

  it("resolves the description from `short` or the scalar form", () => {
    const fields = index.cellOptions();
    expect(fields.find((f) => f.name === "echo")?.description).toBe("Show code.");
    expect(fields.find((f) => f.name === "eval")?.description).toBe("Evaluate the cell.");
  });
});

describe("parseSchemaIndex — front-matter key extraction (6d-4)", () => {
  const index = parseSchemaIndex(FIXTURE);
  const fmNames = index.frontMatterKeys([]).map((f) => f.name);

  it("collects visible document-* keys as top-level front-matter keys", () => {
    expect(fmNames).toContain("freeze"); // schema/document-execute.yml
    expect(fmNames).toContain("toc"); // schema/document-options.yml
  });

  it("excludes hidden document keys", () => {
    expect(fmNames).not.toContain("secret");
  });

  it("keeps cell options OUT of the front-matter key set", () => {
    expect(fmNames).not.toContain("echo");
    expect(fmNames).not.toContain("column");
  });

  it("resolves front-matter key descriptions (short or scalar form)", () => {
    const toc = index.frontMatterKeys([]).find((f) => f.name === "toc");
    expect(toc?.description).toBe("Table of contents.");
  });

  it("serves the curated execute children for the `execute` path (6d-6)", () => {
    // Nested keys are curated-only in v1 (the live schema cannot assemble the
    // execute object without the deferred recursive walk), so the parsed index
    // returns the same curated set as the fallback — independent of the fixture.
    const names = index.frontMatterKeys(["execute"]).map((f) => f.name);
    expect(names).toContain("echo"); // a cell-shared flag, NOT a top-level doc key
    expect(names).toContain("freeze");
    expect(names).toEqual(CURATED_EXECUTE_KEYS.map((f) => f.name));
  });

  it("offers nothing for a non-allow-listed or deeper nested path (6d-6)", () => {
    expect(index.frontMatterKeys(["website"])).toEqual([]);
    expect(index.frontMatterKeys(["execute", "julia"])).toEqual([]);
  });

  // 6d-5 depends on the reader resolving values for document keys exactly as it
  // does for cell options (`toField` → `valuesOfSchema`). Lock that contract.
  it("resolves value enums on front-matter keys (6d-5)", () => {
    const valuesOf = (name: string): string[] | undefined =>
      index.frontMatterKeys([]).find((f) => f.name === name)?.values;
    expect(valuesOf("toc")).toEqual(["true", "false"]); // schema: "boolean"
    expect(valuesOf("freeze")).toEqual(["auto"]); // schema: { enum: ["auto"] }
  });

  // Name-collision dedup fix: `copyright` is defined in TWO document-*.yml files;
  // the poorer (childless) one iterates first. Keep the richer one regardless.
  it("keeps the richer copyright definition on a name collision, not whichever occurs first", () => {
    const copyright = index.frontMatterKeys([]).find((f) => f.name === "copyright");
    expect(copyright?.children?.map((c) => c.name).sort()).toEqual(["holder", "statement", "year"]);
  });
});

describe("parseSchemaIndex — format-name extraction (6d-6 cont.)", () => {
  const index = parseSchemaIndex(FIXTURE);
  const formatNames = index.frontMatterKeys(["format"]).map((f) => f.name);

  it("reads format names from pandoc/formats.yml for the `format` path", () => {
    for (const n of ["html", "epub", "docbook", "pdf", "revealjs", "typst"]) {
      expect(formatNames, `should include format ${n}`).toContain(n);
    }
  });

  it("concats Quarto's synthesized formats (md/hugo/dashboard/email)", () => {
    for (const n of ["md", "hugo", "dashboard", "email"]) {
      expect(formatNames, `should include synthesized ${n}`).toContain(n);
    }
  });

  it("hides legacy variants (html5/epub3/docbook5) but keeps the base names", () => {
    for (const hidden of ["html5", "epub3", "docbook5", "html4", "epub2", "docbook4"]) {
      expect(formatNames, `${hidden} must be hidden`).not.toContain(hidden);
    }
    for (const base of ["html", "epub", "docbook"]) {
      expect(formatNames, `${base} base name kept`).toContain(base);
    }
  });

  it("keeps format names OUT of the top-level and execute paths", () => {
    expect(index.frontMatterKeys([]).map((f) => f.name)).not.toContain("revealjs");
    expect(index.frontMatterKeys(["execute"]).map((f) => f.name)).not.toContain("revealjs");
  });

  it("enriches the top-level `format` key's value enum with the reader's format names (6d-6+)", () => {
    // The flat `document-*` list models `format` only as an epub-scoped string (no
    // enum); the index surfaces the reader-derived format names as its values, so a
    // top-level `format: <here>` scalar completes them. They are exactly the names
    // offered as KEYS under `format:` — including the reader-only `docbook` (absent
    // from the curated fallback), proving the enrichment is reader-derived.
    const fmtValues = index.frontMatterKeys([]).find((f) => f.name === "format")?.values;
    expect(fmtValues).toEqual(formatNames);
    expect(fmtValues, "reader-derived (docbook is not in the curated fallback)").toContain("docbook");
  });
});

describe("parseSchemaIndex — per-format option extraction (6d-6+ b2-i)", () => {
  const index = parseSchemaIndex(FIXTURE);
  const htmlOpts = index.frontMatterKeys(["format", "html"]).map((f) => f.name);
  const gfmOpts = index.frontMatterKeys(["format", "gfm"]).map((f) => f.name);

  it("offers a format-scoped document key valid for that format (`theme` under html)", () => {
    expect(htmlOpts).toContain("theme"); // tags.formats ['$html-doc', 'revealjs']
  });

  it("offers UNTAGGED (universal) document keys for every format (`toc`)", () => {
    expect(htmlOpts).toContain("toc");
    expect(gfmOpts).toContain("toc");
  });

  it("EXCLUDES options not valid for the format (the filter discriminates)", () => {
    expect(gfmOpts).not.toContain("theme"); // html/revealjs-only → absent under gfm
    expect(htmlOpts).not.toContain("keep-tex"); // pdf-only → absent under html
  });

  it("folds in only DOCUMENT-CONTEXT cell-* options (code-fold in, fig-alt out)", () => {
    // Quarto's getFormatSchema (objectRefSchemaFromContextGlob('document-*')) folds a
    // cell-* option into the per-format source ONLY when its tags.contexts names a
    // document-* context — NOT merely because it has a tags.formats. code-fold has
    // a document-code context (kept); fig-alt has a tags.formats but no document
    // context (cell-only → excluded). Grounded firsthand against Quarto 1.7.33.
    expect(htmlOpts).toContain("code-fold"); // document-code context, $html-all
    expect(gfmOpts).not.toContain("code-fold"); // $html-all excludes gfm
    expect(htmlOpts).not.toContain("fig-alt"); // cell-only (no document context)
  });

  it("does NOT fold execution-only cell options (`echo`, no tags.formats) into a format", () => {
    expect(htmlOpts).not.toContain("echo"); // format-agnostic cell flag, not a per-format option
  });

  it("degrades an unknown format to universal-only (never wrong keys)", () => {
    const unknown = index.frontMatterKeys(["format", "nosuchformat"]).map((f) => f.name);
    expect(unknown).toContain("toc"); // universal survives
    expect(unknown).not.toContain("theme"); // format-scoped excluded
  });

  it("the curated fallback serves a small universal per-format set", () => {
    const curated = CURATED_SCHEMA_INDEX.frontMatterKeys(["format", "html"]).map((f) => f.name);
    expect(curated.length).toBeGreaterThan(0);
    expect(curated).toContain("toc");
  });

  it("resolves per-format option VALUES on the returned fields (6d-6+ b2-ii)", () => {
    // The per-format field set carries each option's resolved value enum, so value
    // completion two levels under `format:` works without any provider or reader
    // change — the whole value path already existed after b2-i (trace-confirmed).
    const htmlFields = index.frontMatterKeys(["format", "html"]);
    expect(htmlFields.find((f) => f.name === "code-fold")?.values).toEqual([
      "true", "false", "show",
    ]);
    expect(htmlFields.find((f) => f.name === "toc")?.values).toEqual(["true", "false"]);
    // An option filtered OUT of a format offers no field there, so its values do not
    // complete — the per-format VALUE discrimination mirrors the KEY (b2-i).
    expect(
      index.frontMatterKeys(["format", "gfm"]).find((f) => f.name === "code-fold"),
    ).toBeUndefined();
  });
});

describe("parseSchemaIndex — deep-nested object option resolution (6d-6+ b2-iii-key)", () => {
  const index = parseSchemaIndex(FIXTURE);

  it("resolves an object-valued per-format option's sub-keys via frontMatterKeys(len>=3)", () => {
    const children = index.frontMatterKeys(["format", "html", "code-tools"]).map((f) => f.name);
    expect(children).toEqual(["source", "toggle", "caption"]);
  });

  it("carries each child's resolved value enum for free (existing valuesOfSchema)", () => {
    const children = index.frontMatterKeys(["format", "html", "code-tools"]);
    expect(children.find((f) => f.name === "toggle")?.values).toEqual(["true", "false"]);
    // anyOf[boolean, string] → the boolean arm's enum members are still offered
    // (a free-text string is also accepted but is not itself enumerable).
    expect(children.find((f) => f.name === "source")?.values).toEqual(["true", "false"]);
    expect(children.find((f) => f.name === "caption")?.values).toBeUndefined(); // bare "string" → no enum
  });

  it("offers nothing for a non-object option (no children to descend into)", () => {
    expect(index.frontMatterKeys(["format", "html", "toc"])).toEqual([]);
  });

  it("offers nothing for an unknown option under a known format", () => {
    expect(index.frontMatterKeys(["format", "html", "no-such-option"])).toEqual([]);
  });

  it("offers nothing when the option itself is filtered out of the concrete format", () => {
    // code-tools is $html-doc-only; absent from gfm's per-format set entirely.
    expect(index.frontMatterKeys(["format", "gfm", "code-tools"])).toEqual([]);
  });

  it("caps resolution at ONE object level — a depth-4 position offers nothing (deferred, b2-iii-deep)", () => {
    expect(index.frontMatterKeys(["format", "html", "editor", "markdown"])).toEqual([]);
  });

  it("a child field does not itself carry populated children (the one-level cap, structurally)", () => {
    const editorChildren = index.frontMatterKeys(["format", "html", "editor"]);
    expect(editorChildren.map((f) => f.name)).toEqual(["mode", "markdown", "render-on-save"]);
    const markdown = editorChildren.find((f) => f.name === "markdown");
    expect(markdown?.children ?? []).toEqual([]);
    const mode = editorChildren.find((f) => f.name === "mode");
    expect(mode?.values).toEqual(["source", "visual"]);
  });

  it("resolves a child's description from a DIRECT sibling of the type key", () => {
    const mode = index
      .frontMatterKeys(["format", "html", "editor"])
      .find((f) => f.name === "mode");
    expect(mode?.description).toBe("Default editing mode.");
  });

  it("resolves a child's description NESTED one level inside a scalar-type wrapper", () => {
    const caption = index
      .frontMatterKeys(["format", "html", "code-tools"])
      .find((f) => f.name === "caption");
    expect(caption?.description).toBe("Caption text for the code tools menu.");
  });

  it("leaves a bare-scalar child without a description (none reachable within the bound)", () => {
    const toggle = index
      .frontMatterKeys(["format", "html", "code-tools"])
      .find((f) => f.name === "toggle");
    expect(toggle?.description).toBeUndefined();
  });

  it("terminates on a cyclic ref chain instead of hanging (never lands on an object)", () => {
    const cyclic = index.frontMatterKeys([]).find((f) => f.name === "cyclic-opt");
    expect(cyclic?.children ?? []).toEqual([]);
  });

  it("offers NOTHING for an UNCONDITIONALLY array-of-object option (a sequence, not a mapping)", () => {
    // `other-links` is a real Quarto option whose only valid shape is a
    // `-`-prefixed sequence (no bare-object alternative) — its array element's
    // properties (text/href) are NOT valid mapping keys for `other-links:` itself,
    // so the resolver must not unwrap a bare `arrayOf` (review-caught fidelity fix).
    expect(index.frontMatterKeys(["format", "html", "other-links"])).toEqual([]);
  });

  it("degrades to no children when `properties` is malformed as a JSON array (never garbage keys)", () => {
    // `typeof x === "object"` is true for arrays too — a naive check would treat
    // ["a","b","c"] as a properties map and emit index-named fields ("0","1","2").
    // Adversarial-review-caught robustness fix: explicitly exclude arrays.
    const malformed = JSON.stringify({
      "schema/document-malformed-test.yml": [
        {
          name: "malformed-object-opt",
          schema: { object: { properties: ["a", "b", "c"] } },
          description: "An option whose properties is wrongly shaped as an array.",
        },
      ],
    });
    const field = parseSchemaIndex(malformed)
      .frontMatterKeys([])
      .find((f) => f.name === "malformed-object-opt");
    expect(field?.children ?? []).toEqual([]);
  });

  it("does not attach children to a non-object top-level field", () => {
    expect(index.frontMatterKeys([]).find((f) => f.name === "toc")?.children).toBeUndefined();
  });
});

describe("parseSchemaIndex — deep-nested option VALUE resolution (6d-6+ b2-iii-value)", () => {
  const index = parseSchemaIndex(FIXTURE);

  it("resolves the definition-enum-OBJECT form ({enum:{values:[...]}}) through a ref", () => {
    // html-math-method's `method` sub-key resolves through TWO hops (ref → the
    // math-methods definition), whose enum is `{values:[...]}`, not a plain array
    // — the form `page-column` (plain-array enum) does NOT exercise.
    const method = index
      .frontMatterKeys(["format", "html", "html-math-method"])
      .find((f) => f.name === "method");
    expect(method?.values).toEqual([
      "plain",
      "webtex",
      "gladtex",
      "mathml",
      "mathjax",
      "katex",
    ]);
  });

  it("resolves the {tags, schema:...} wrapper form through .schema", () => {
    // editor.render-on-save is wrapped in {tags, schema:"boolean"} — a bare
    // "boolean" (like code-tools.toggle, already working) is NOT the same shape.
    const renderOnSave = index
      .frontMatterKeys(["format", "html", "editor"])
      .find((f) => f.name === "render-on-save");
    expect(renderOnSave?.values).toEqual(["true", "false"]);
  });

  it("resolves the object-wrapped {boolean:{...}} DSL form", () => {
    // crossref.chapters — distinct from a bare "boolean" AND the {tags,schema}
    // wrapper: the type name ITSELF is the wrapper key, sibling to description/default.
    const chapters = index
      .frontMatterKeys(["format", "html", "crossref"])
      .find((f) => f.name === "chapters");
    expect(chapters?.values).toEqual(["true", "false"]);
  });
});

describe("parseSchemaIndex — value resolution (simple cases)", () => {
  const fields = parseSchemaIndex(FIXTURE).cellOptions();
  const valuesOf = (name: string): string[] | undefined =>
    fields.find((f) => f.name === name)?.values;

  it("resolves a bare `boolean` schema to [true, false]", () => {
    expect(valuesOf("eval")).toEqual(["true", "false"]);
  });

  it("resolves an `enum` schema to its values", () => {
    expect(valuesOf("fig-align")).toEqual(["default", "left", "right", "center"]);
    expect(valuesOf("code-overflow")).toEqual(["scroll", "wrap"]);
  });

  it("resolves an `anyOf` of boolean + enum into the union", () => {
    expect(valuesOf("echo")).toEqual(["true", "false", "fenced"]);
    expect(valuesOf("tbl-colwidths")).toEqual(["true", "false", "auto"]);
  });

  it("stringifies non-string enum values (booleans → `true`/`false`)", () => {
    // `message: {enum: [true, false, "NA"]}` — JSON booleans become YAML scalars.
    expect(valuesOf("message")).toEqual(["true", "false", "NA"]);
  });

  it("resolves a `ref` through definitions.yml", () => {
    expect(valuesOf("column")).toEqual(["body", "page", "margin"]);
  });

  it("resolves a `string.completions` schema", () => {
    expect(valuesOf("animation-hook")).toEqual(["ffmpeg", "gifski"]);
  });

  it("leaves free-text / numeric / array-of-string options without an enum", () => {
    expect(valuesOf("fig-cap")).toBeUndefined(); // maybeArrayOf string
    expect(valuesOf("fig-width")).toBeUndefined(); // number
    expect(valuesOf("label")).toBeUndefined(); // string
  });
});

describe("parseSchemaIndex — engine tags & filtering", () => {
  const index = parseSchemaIndex(FIXTURE);
  const engineOf = (name: string): string | undefined =>
    index.cellOptions().find((f) => f.name === name)?.engine;
  const namesFor = (engine?: "knitr" | "jupyter" | "ojs"): string[] =>
    index.cellOptions(engine).map((f) => f.name);

  it("reads `tags.engine` for single-engine options", () => {
    expect(engineOf("cache")).toBe("knitr");
    expect(engineOf("fig-width")).toBe("knitr");
    expect(engineOf("message")).toBe("knitr");
    expect(engineOf("tags")).toBe("jupyter");
  });

  it("treats an engine-agnostic or multi-engine option as unset", () => {
    expect(engineOf("echo")).toBeUndefined(); // no tags.engine
    expect(engineOf("tbl-colwidths")).toBeUndefined(); // ["knitr","jupyter"] → all
  });

  it("includes engine-agnostic options for every engine", () => {
    for (const engine of ["knitr", "jupyter", "ojs"] as const) {
      expect(namesFor(engine), `${engine}`).toContain("echo");
      expect(namesFor(engine), `${engine} (multi-engine)`).toContain("tbl-colwidths");
    }
  });

  it("excludes other-engine options when an engine is given", () => {
    const jupyter = namesFor("jupyter");
    expect(jupyter).toContain("tags"); // jupyter-only
    for (const knitrOnly of ["cache", "fig-width", "message", "animation-hook"]) {
      expect(jupyter, `jupyter must exclude ${knitrOnly}`).not.toContain(knitrOnly);
    }
    const knitr = namesFor("knitr");
    expect(knitr).toContain("cache"); // knitr-only
    expect(knitr).not.toContain("tags"); // jupyter-only
  });

  it("offers only engine-agnostic options for ojs cells", () => {
    const ojs = namesFor("ojs");
    expect(ojs).toContain("echo");
    expect(ojs).not.toContain("cache"); // knitr
    expect(ojs).not.toContain("tags"); // jupyter
  });

  it("does not filter when the engine is unknown (returns the full set)", () => {
    expect(namesFor(undefined)).toContain("cache");
    expect(namesFor(undefined)).toContain("tags");
  });
});

describe("parseSchemaIndex — robustness & fallback", () => {
  it("degrades to the curated fallback on unparseable input (never throws)", () => {
    const names = parseSchemaIndex("this is not json {{{").cellOptions().map((f) => f.name);
    expect(names).toContain("layout-ncol"); // curated-only
    expect(names).not.toContain("code-overflow"); // schema-only → proves fallback, not a parse
  });

  it("degrades to the curated fallback when no cell options are present", () => {
    const names = parseSchemaIndex("{}").cellOptions().map((f) => f.name);
    expect(names).toEqual(CURATED_CELL_OPTIONS.map((f) => f.name));
  });

  it("degrades front-matter keys to the curated set on unparseable input", () => {
    const fmNames = parseSchemaIndex("not json {{{")
      .frontMatterKeys([])
      .map((f) => f.name);
    expect(fmNames).toEqual(CURATED_FRONTMATTER_KEYS.map((f) => f.name));
    expect(fmNames).not.toContain("freeze"); // schema-only → proves fallback, not a parse
  });

  it("degrades to the curated fallback on a non-object JSON root", () => {
    expect(() => parseSchemaIndex("null")).not.toThrow();
    expect(parseSchemaIndex("null").cellOptions().map((f) => f.name)).toEqual(
      CURATED_CELL_OPTIONS.map((f) => f.name),
    );
  });

  it("strips a leading UTF-8 BOM before parsing", () => {
    const names = parseSchemaIndex("﻿" + FIXTURE).cellOptions().map((f) => f.name);
    expect(names).toContain("code-overflow"); // proves the fixture parsed, not the fallback
  });
});

describe("CURATED_SCHEMA_INDEX — the fallback view", () => {
  it("exposes the curated set as a SchemaIndex", () => {
    expect(CURATED_SCHEMA_INDEX.cellOptions().map((f) => f.name)).toEqual(
      CURATED_CELL_OPTIONS.map((f) => f.name),
    );
  });

  it("applies engine filtering to the curated set too", () => {
    const jupyter = CURATED_SCHEMA_INDEX.cellOptions("jupyter").map((f) => f.name);
    expect(jupyter).toContain("echo");
    expect(jupyter).not.toContain("cache"); // knitr-only in the curated set
  });

  it("exposes the curated front-matter keys via frontMatterKeys([])", () => {
    expect(CURATED_SCHEMA_INDEX.frontMatterKeys([]).map((f) => f.name)).toEqual(
      CURATED_FRONTMATTER_KEYS.map((f) => f.name),
    );
  });

  it("offers no front-matter keys for an unhandled nested path", () => {
    // `format` is now an allow-listed nested container (6d-6 cont.); `website` is
    // not, so it stays the example of a deferred path that yields nothing.
    expect(CURATED_SCHEMA_INDEX.frontMatterKeys(["website"])).toEqual([]);
  });
});
