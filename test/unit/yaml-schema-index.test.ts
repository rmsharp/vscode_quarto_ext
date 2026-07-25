import { describe, expect, it } from "vitest";
import {
  CURATED_CELL_OPTIONS,
  CURATED_EXECUTE_KEYS,
  CURATED_FRONTMATTER_KEYS,
  CURATED_SCHEMA_INDEX,
  parseSchemaIndex,
} from "../../src/core/yaml-schema";
import type { SchemaField, SchemaIndex } from "../../src/core/yaml-schema";
import { isWrongValue } from "../../src/core/yaml-value-check";

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
    // A NUMERIC-MEMBER enum (mirrors the real `aspectratio` = enum:[43,169,…]):
    // members are JS NUMBERS, so the annotator must set `numericMemberEnum`
    // (numeric-member-enum matcher plan §2.1/§3.1). Closed AND numeric-member.
    {
      name: "aspectratio",
      schema: { enum: [43, 169, 1610, 149, 141, 54, 32] },
      description: "Beamer aspect ratio (numeric-member enum).",
    },
    // A JS-STRING enum whose members happen to LOOK numeric (`["3","4"]`): closed,
    // but NOT numeric-member — the forward-compat type-keying guard. `field.values`
    // is `["3","4"]` for this AND for a number enum, so detection MUST read the raw
    // JS member types, not the stringified values (plan §3.1 B / dragon 2).
    {
      name: "numstr-enum",
      schema: { enum: ["3", "4"] },
      description: "A string enum whose members look numeric (must NOT get the bit).",
    },
    // A MIXED enum (some numeric, some string members) — closed, NOT numeric-member
    // (the bit requires ALL members numeric). Mirrors the real `brand-font-weight`.
    {
      name: "mixed-enum",
      schema: { enum: [100, 200, "thin", "black"] },
      description: "A mixed numeric/string enum (must NOT get the bit).",
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

/**
 * A dedicated fixture for `SchemaIndex.projectKeys` (YAML schema diagnostics
 * plan §5.1/§2.2), mirroring the REAL `schema/project.yml` + `schema/
 * definitions.yml` shapes probed live against the installed Quarto 1.7.33
 * schema (grounded firsthand, Session 47): `project`'s entry is a flat closed
 * object; `website`'s is a one-hop `{ref}` to a closed definition; `book`'s is
 * an object with NO own properties, only a `super` array of two `{resolveRef}`
 * members — one of which (`test-book-schema`) is ITSELF closed with its own
 * inline properties AND a second-hop `super` (a single `{resolveRef}`, not an
 * array) to the SAME closed definition `website` refs to (proving a shared
 * target resolves correctly from two different paths), the other
 * (`test-csl-item-shared`) carrying NO `closed` flag of its own (matching the
 * real `csl-item-shared`) — its openness must not stop `book`'s merged whole
 * from being closed (plan §2.2's "merge-then-close" semantic). `chapters` is
 * `test-book-schema`-only; `announcement` is `test-base-website`-only (present
 * ONLY by climbing the second super hop) — the gate-d discriminator proving the
 * full chain resolved, not just `test-book-schema`'s own inline list. `title`
 * is deliberately duplicated in BOTH `test-book-schema` and
 * `test-base-website` to prove the union dedupes rather than erroring.
 */
const PROJECT_CONFIG_FIXTURE = JSON.stringify({
  // Without at least one cell-*/document-* field, parseSchemaIndex's
  // whole-index bail-out ("no options found at all") degrades to
  // CURATED_SCHEMA_INDEX wholesale, defeating this fixture's purpose.
  "schema/document-options.yml": [{ name: "toc", schema: "boolean", description: "TOC" }],
  "schema/project.yml": [
    {
      name: "project",
      schema: {
        object: {
          closed: true,
          properties: { title: "string", "output-dir": "string" },
        },
      },
    },
    { name: "website", schema: { ref: "test-base-website" } },
    {
      name: "book",
      schema: {
        object: {
          super: [{ resolveRef: "test-book-schema" }, { resolveRef: "test-csl-item-shared" }],
        },
      },
    },
  ],
  "schema/definitions.yml": [
    {
      id: "test-base-website",
      object: {
        closed: true,
        properties: { title: "string", navbar: "string", announcement: "string" },
      },
    },
    {
      id: "test-book-schema",
      schema: {
        object: {
          closed: true,
          super: { resolveRef: "test-base-website" },
          properties: { chapters: "string", title: "string" },
        },
      },
    },
    {
      id: "test-csl-item-shared",
      object: {
        properties: { DOI: "string", issued: "string" },
      },
    },
    // A self-referencing pair reachable only via `resolveRef`/`super` (not the
    // `ref` cyclic-a/b pair above, which a different resolver consumes) —
    // proves `projectKeys` terminates on a cyclic `super` chain instead of
    // hanging, and that neither side ever resolves `closed:true` (so the
    // caller-facing result is `null`, never a wrong/partial flag).
    { id: "cyclic-super-a", object: { super: { resolveRef: "cyclic-super-b" } } },
    { id: "cyclic-super-b", object: { super: { resolveRef: "cyclic-super-a" } } },
  ],
});

/** Same shape as `PROJECT_CONFIG_FIXTURE`'s `project.yml`, minus website/book entirely. */
const PARTIAL_PROJECT_CONFIG_FIXTURE = JSON.stringify({
  "schema/document-options.yml": [{ name: "toc", schema: "boolean", description: "TOC" }],
  "schema/project.yml": [
    {
      name: "project",
      schema: { object: { closed: true, properties: { title: "string" } } },
    },
  ],
});

/**
 * A dedicated fixture for `SchemaIndex.projectFields` (`_quarto.yml` project-config
 * VALUE validation, plan §3.2 A) — the same super/resolveRef resolution shapes as
 * `PROJECT_CONFIG_FIXTURE`, but with ENUM / BOOLEAN / `string:{completions}` child
 * schemas (not the all-`"string"` open children above) so the per-child annotation
 * (`valuesOfSchema` + `annotateClosedness` + `annotateScalarType`) is exercised. It
 * mirrors the real 1.7.33 shapes grounded firsthand (Session 134, §2.2): a closed
 * enum (`draft-mode`), a boolean (`reader-mode`), a `maybeArrayOf[enum]`
 * (`repo-actions`, like real website's), an open string (`title`), the
 * `string:{completions}` cardinal-sin trap (`project.type` — non-empty `values`
 * yet OPEN, plan §11 dragon 3), and `book`'s three-way super merge (its own
 * `downloads` enum + base-website's children + a `csl-item-shared`-super `type` enum).
 */
const PROJECT_FIELDS_FIXTURE = JSON.stringify({
  "schema/document-options.yml": [{ name: "toc", schema: "boolean", description: "TOC" }],
  "schema/project.yml": [
    {
      name: "project",
      schema: {
        object: {
          closed: true,
          properties: {
            "execute-dir": { enum: ["file", "project"] },
            // string:{completions} — completions are HINTS; quarto accepts ANY string,
            // so this MUST stay OPEN even though `values` is non-empty (the cardinal sin).
            type: { string: { completions: ["default", "website", "book"] } },
            "output-dir": "string",
            // A depth-2 object child (b2-iii-deep / depth-2 value plan §3.2 A): its
            // grandchildren are three closed booleans — the reader must populate
            // `.children` via `objectChildren`, one level deep.
            preview: {
              object: {
                properties: {
                  browser: "boolean",
                  navigate: "boolean",
                  "watch-inputs": "boolean",
                },
              },
            },
          },
        },
      },
    },
    { name: "website", schema: { ref: "test-base-website" } },
    {
      name: "book",
      schema: {
        object: {
          super: [{ resolveRef: "test-book-schema" }, { resolveRef: "test-csl-item-shared" }],
        },
      },
    },
  ],
  "schema/definitions.yml": [
    {
      id: "test-base-website",
      object: {
        closed: true,
        properties: {
          title: "string", // OPEN
          "draft-mode": { enum: ["visible", "unlinked", "gone"] }, // closed enum
          "reader-mode": "boolean", // closed boolean
          "repo-actions": { maybeArrayOf: { enum: ["none", "edit", "source", "issue"] } },
          // Depth-2 object children (depth-2 value plan §2.2): each grandchild is
          // annotated one level deep by `objectChildren`. navbar exercises a closed
          // enum + bool + the two OPEN-with-values traps (title anyOf/open-string,
          // background string:{completions}); sidebar a closed enum reached via book's
          // super; search the numeric-TYPED grandchildren; google-analytics the
          // numeric-MEMBER enum (`version` — CLOSED + numericMemberEnum, validated by
          // PARSED value; the S137 openNumericMemberEnum guard is deleted, matcher plan §3.1).
          navbar: {
            object: {
              properties: {
                "collapse-below": { enum: ["sm", "md", "lg"] }, // closed enum grandchild
                pinned: "boolean", // closed boolean grandchild
                title: "string", // OPEN grandchild (the depth-2 cardinal-sin trap)
                background: { string: { completions: ["primary", "dark"] } }, // OPEN (completions are hints)
              },
            },
          },
          sidebar: {
            object: {
              properties: {
                style: { enum: ["docked", "floating"] },
                alignment: { enum: ["left", "right", "center"] },
              },
            },
          },
          search: {
            object: {
              properties: {
                location: { enum: ["navbar", "sidebar"] }, // closed enum
                limit: "number", // numeric-TYPED grandchild (scalarType:"number")
                "collapse-after": "number", // numeric-TYPED grandchild
              },
            },
          },
          "google-analytics": {
            object: {
              properties: {
                version: { enum: [3, 4] }, // numeric-MEMBER enum (JS NUMBERS, as the real schema) — validated by parsed value (matcher plan §3.1)
                "anonymize-ip": "boolean",
              },
            },
          },
        },
      },
    },
    {
      id: "test-book-schema",
      schema: {
        object: {
          closed: true,
          super: { resolveRef: "test-base-website" },
          properties: {
            downloads: { enum: ["pdf", "epub", "docx"] }, // book's own closed enum
            title: "string", // duplicated in base-website too — own wins, still OPEN
          },
        },
      },
    },
    {
      id: "test-csl-item-shared",
      object: {
        properties: {
          type: { enum: ["article", "book", "chapter"] }, // closed enum via the csl super hop
          DOI: "string",
        },
      },
    },
  ],
});

describe("parseSchemaIndex — _quarto.yml project:/website:/book: closed-key resolution (YAML diagnostics plan §5.1)", () => {
  const index = parseSchemaIndex(PROJECT_CONFIG_FIXTURE);

  it("resolves project:'s flat closed key set", () => {
    expect(index.projectKeys("project")).toEqual(new Set(["title", "output-dir"]));
  });

  it("resolves website:'s one-hop $ref closed key set", () => {
    expect(index.projectKeys("website")).toEqual(new Set(["title", "navbar", "announcement"]));
  });

  it("resolves book:'s full super-merge chain, including a base-website-only key reached via the SECOND hop (the gate-d discriminator)", () => {
    expect(index.projectKeys("book")).toEqual(
      new Set(["chapters", "title", "navbar", "announcement", "DOI", "issued"]),
    );
  });

  it("marks book: closed even though its OWN project.yml entry carries no closed flag directly (closedness propagates up through the super merge)", () => {
    // A shallower implementation that only checked the outermost entry's own
    // `closed` (never true here — see the fixture) would wrongly treat book:
    // as unclosed and return null. This is a direct assertion of that, since
    // the previous test's non-null exact-set result already implies it, but a
    // dedicated assertion makes the discriminator explicit and named.
    expect(index.projectKeys("book")).not.toBeNull();
  });

  it("returns null for a container absent from schema/project.yml", () => {
    const partial = parseSchemaIndex(PARTIAL_PROJECT_CONFIG_FIXTURE);
    expect(partial.projectKeys("website")).toBeNull();
    expect(partial.projectKeys("book")).toBeNull();
    expect(partial.projectKeys("project")).toEqual(new Set(["title"]));
  });

  it("returns null for every container when schema/project.yml is malformed (never throws)", () => {
    const malformed = parseSchemaIndex(
      JSON.stringify({
        "schema/document-options.yml": [{ name: "toc", schema: "boolean", description: "TOC" }],
        "schema/project.yml": "not-an-array",
      }),
    );
    expect(malformed.projectKeys("project")).toBeNull();
    expect(malformed.projectKeys("website")).toBeNull();
    expect(malformed.projectKeys("book")).toBeNull();
  });

  it("terminates on a cyclic super/resolveRef chain instead of hanging, and never resolves it as closed", () => {
    const cyclic = parseSchemaIndex(
      JSON.stringify({
        "schema/document-options.yml": [{ name: "toc", schema: "boolean", description: "TOC" }],
        "schema/project.yml": [{ name: "website", schema: { ref: "cyclic-super-a" } }],
        "schema/definitions.yml": [
          { id: "cyclic-super-a", object: { super: { resolveRef: "cyclic-super-b" } } },
          { id: "cyclic-super-b", object: { super: { resolveRef: "cyclic-super-a" } } },
        ],
      }),
    );
    expect(cyclic.projectKeys("website")).toBeNull();
  });

  it("resolves a legitimately deep (non-cyclic) super/resolveRef chain in full — a shared hops budget must not silently truncate a real branch (adversarial review, Session 47)", () => {
    // 20 levels of {object:{super:{resolveRef:"level-N"}}}, only the deepest
    // closed with its own unique property. seenRefs alone is a sufficient
    // cycle guard (a parsed-JSON tree can never be circular without a NAMED
    // ref, which IS seenRefs-guarded) — a hops depth cap is redundant and,
    // when it fires on a real (non-cyclic) deep chain, silently drops that
    // branch's names while a shallower sibling's closed:true still
    // propagates, producing the exact "closed:true, incomplete names" shape
    // this feature's zero-false-positive promise cannot tolerate.
    const LEVELS = 20;
    const definitions = [];
    for (let i = 0; i < LEVELS; i++) {
      definitions.push({
        id: `level-${i}`,
        object: { super: { resolveRef: `level-${i + 1}` } },
      });
    }
    definitions.push({
      id: `level-${LEVELS}`,
      object: { closed: true, properties: { "deep-only-key": "string" } },
    });
    const deep = parseSchemaIndex(
      JSON.stringify({
        "schema/document-options.yml": [{ name: "toc", schema: "boolean", description: "TOC" }],
        "schema/project.yml": [{ name: "website", schema: { ref: "level-0" } }],
        "schema/definitions.yml": definitions,
      }),
    );
    expect(deep.projectKeys("website")).toEqual(new Set(["deep-only-key"]));
  });
});

describe("CURATED_SCHEMA_INDEX — _quarto.yml project:/website:/book: closed-key resolution", () => {
  it("exposes the complete, exact project: key set (cheap to hand-curate, safe to flag offline)", () => {
    expect(CURATED_SCHEMA_INDEX.projectKeys("project")).toEqual(
      new Set([
        "title", "type", "render", "execute-dir", "output-dir", "lib-dir",
        "resources", "preview", "pre-render", "post-render", "detect",
      ]),
    );
  });

  it("never flags website: offline — a partial curated subset would risk a false positive, so it is omitted rather than marked closed", () => {
    expect(CURATED_SCHEMA_INDEX.projectKeys("website")).toBeNull();
  });

  it("never flags book: offline for the same reason", () => {
    expect(CURATED_SCHEMA_INDEX.projectKeys("book")).toBeNull();
  });
});

describe("parseSchemaIndex — projectFields: annotated project-config child fields (_quarto.yml value validation, plan §3.2 A)", () => {
  const index = parseSchemaIndex(PROJECT_FIELDS_FIXTURE);

  it("annotates website:'s closed enum child (draft-mode) and boolean child (reader-mode), leaving an open string open", () => {
    const fields = index.projectFields("website");
    const draftMode = fields.find((f) => f.name === "draft-mode");
    expect(draftMode?.valuesClosed).toBe(true);
    expect(draftMode?.values).toEqual(["visible", "unlinked", "gone"]);
    const readerMode = fields.find((f) => f.name === "reader-mode");
    expect(readerMode?.valuesClosed).toBe(true);
    expect(readerMode?.acceptsBoolean).toBe(true);
    const title = fields.find((f) => f.name === "title");
    expect(title, "title is a recognized website child").toBeDefined();
    expect(title?.valuesClosed, "an open string child is never closed (no cardinal-sin FP)").toBeUndefined();
  });

  it("annotates a maybeArrayOf[enum] child (repo-actions) as a closed enum — a scalar member is checkable; the matcher itself skips a flow sequence", () => {
    const repoActions = index.projectFields("website").find((f) => f.name === "repo-actions");
    expect(repoActions?.valuesClosed).toBe(true);
    expect(repoActions?.values).toEqual(["none", "edit", "source", "issue"]);
  });

  it("resolves book:'s super-merged children — its own closed enum (downloads), a csl-super enum (type), AND the base-website children (draft-mode)", () => {
    const byName = new Map(index.projectFields("book").map((f) => [f.name, f]));
    expect(byName.get("downloads")?.valuesClosed).toBe(true);
    expect(byName.get("downloads")?.values).toEqual(["pdf", "epub", "docx"]);
    expect(byName.get("type")?.valuesClosed, "book.type resolves via the csl-item-shared super hop").toBe(true);
    expect(byName.get("type")?.values).toEqual(["article", "book", "chapter"]);
    expect(byName.get("draft-mode")?.valuesClosed, "base-website children merge in via super").toBe(true);
  });

  it("leaves project.type OPEN — string:{completions} is a hint, not a constraint (the cardinal-sin trap, plan §2.2 / §11 dragon 3)", () => {
    const fields = index.projectFields("project");
    const type = fields.find((f) => f.name === "type");
    expect(type, "type is a recognized project child").toBeDefined();
    expect(type?.valuesClosed, "project.type must NEVER be closed — quarto's schema layer accepts any string").toBeUndefined();
    const executeDir = fields.find((f) => f.name === "execute-dir");
    expect(executeDir?.valuesClosed, "execute-dir IS a closed enum").toBe(true);
    expect(executeDir?.values).toEqual(["file", "project"]);
  });

  it("returns [] for a container absent from schema/project.yml (unresolved → never validate)", () => {
    const partial = parseSchemaIndex(PARTIAL_PROJECT_CONFIG_FIXTURE);
    expect(partial.projectFields("website")).toEqual([]);
    expect(partial.projectFields("book")).toEqual([]);
  });

  it("returns [] for every container in the curated fallback (no per-child closedness offline, plan §2.3)", () => {
    expect(CURATED_SCHEMA_INDEX.projectFields("project")).toEqual([]);
    expect(CURATED_SCHEMA_INDEX.projectFields("website")).toEqual([]);
    expect(CURATED_SCHEMA_INDEX.projectFields("book")).toEqual([]);
  });

  it("populates `.children` on an object-valued child, annotating each grandchild one level deep (depth-2 value plan §3.2 A)", () => {
    const navbar = index.projectFields("website").find((f) => f.name === "navbar");
    expect(navbar?.children, "navbar is an object child — its grandchildren resolve").toBeDefined();
    const byName = new Map((navbar?.children ?? []).map((c) => [c.name, c]));
    // a closed enum grandchild is flaggable
    expect(byName.get("collapse-below")?.valuesClosed).toBe(true);
    expect(byName.get("collapse-below")?.values).toEqual(["sm", "md", "lg"]);
    // a closed boolean grandchild is flaggable
    expect(byName.get("pinned")?.valuesClosed).toBe(true);
    // the OPEN-with-values traps are NEVER closed (no cardinal-sin FP, §2.3 / dragon 4)
    expect(byName.get("title")?.valuesClosed, "navbar.title is an open string trap").toBeUndefined();
    expect(
      byName.get("background")?.valuesClosed,
      "navbar.background is string:{completions} — a hint, never closed",
    ).toBeUndefined();
  });

  it("annotates numeric-TYPED grandchildren (search.limit/collapse-after) as scalarType number, alongside a closed enum sibling (location)", () => {
    const search = index.projectFields("website").find((f) => f.name === "search");
    const byName = new Map((search?.children ?? []).map((c) => [c.name, c]));
    expect(byName.get("limit")?.scalarType).toBe("number");
    expect(byName.get("collapse-after")?.scalarType).toBe("number");
    expect(byName.get("location")?.valuesClosed).toBe(true);
    expect(byName.get("location")?.values).toEqual(["navbar", "sidebar"]);
  });

  it("resolves project.preview's three closed-boolean grandchildren", () => {
    const preview = index.projectFields("project").find((f) => f.name === "preview");
    const byName = new Map((preview?.children ?? []).map((c) => [c.name, c]));
    expect(byName.get("browser")?.valuesClosed).toBe(true);
    expect(byName.get("navigate")?.valuesClosed).toBe(true);
    expect(byName.get("watch-inputs")?.valuesClosed).toBe(true);
  });

  it("resolves book's super-merged grandchildren — sidebar.style is closed via the base-website super hop (no `super` needed at depth-2, §2.4)", () => {
    const sidebar = index.projectFields("book").find((f) => f.name === "sidebar");
    const style = (sidebar?.children ?? []).find((c) => c.name === "style");
    expect(style?.valuesClosed, "book.sidebar.style merges in via container-level super").toBe(true);
    expect(style?.values).toEqual(["docked", "floating"]);
  });

  it("marks a numeric-MEMBER enum grandchild (google-analytics.version enum[3,4]) CLOSED + numericMemberEnum — validated by PARSED value (S137 guard DELETED; matcher plan §3.1 D / L3)", () => {
    const ga = index.projectFields("website").find((f) => f.name === "google-analytics");
    const byName = new Map((ga?.children ?? []).map((c) => [c.name, c]));
    const version = byName.get("version");
    expect(version, "version is a recognized grandchild").toBeDefined();
    expect(version?.values, "its enum members are resolved").toEqual(["3", "4"]);
    // The S137 openNumericMemberEnum guard is GONE — version stays CLOSED and is now
    // validated correctly by the shared matcher's numeric branch (no coercion FP).
    expect(version?.valuesClosed, "numeric-member enum is now CLOSED (guard deleted)").toBe(true);
    expect(version?.numericMemberEnum, "and flagged as numeric-member → parsed-value matching").toBe(true);
    // The matcher coerces correctly: an out-of-set number flags, a coerced member does not.
    expect(isWrongValue("5", version!), "version: 5 is now FLAGGED — validation restored").toBe(true);
    expect(isWrongValue("3.0", version!), "version: 3.0 ≡ 3 accepted (no coercion FP)").toBe(false);
    expect(isWrongValue("3", version!)).toBe(false);
    // a NON-numeric enum sibling is unaffected — still a plain closed boolean, no bit
    const anonymize = byName.get("anonymize-ip");
    expect(anonymize?.valuesClosed, "a boolean grandchild is closed").toBe(true);
    expect(anonymize?.numericMemberEnum, "a boolean grandchild is NOT numeric-member").toBeUndefined();
    // book inherits the same grandchild via super — also closed + numeric-member
    const bookVersion = index
      .projectFields("book")
      .find((f) => f.name === "google-analytics")
      ?.children?.find((c) => c.name === "version");
    expect(bookVersion?.valuesClosed, "book.google-analytics.version closed too (super-merged)").toBe(true);
    expect(bookVersion?.numericMemberEnum, "book.google-analytics.version numeric-member too").toBe(true);
  });

  it("gives a scalar/enum depth-1 field no `.children` (depth cap — one object level only)", () => {
    const draftMode = index.projectFields("website").find((f) => f.name === "draft-mode");
    expect(draftMode?.children, "a scalar enum field resolves no grandchildren").toBeUndefined();
  });

  it("does NOT regress projectKeys — populating `.children` leaves the depth-1 name set byte-identical (plan §7.7); object-valued children (navbar/search/…) are themselves depth-1 keys", () => {
    expect(index.projectKeys("project")).toEqual(
      new Set(["execute-dir", "type", "output-dir", "preview"]),
    );
    expect(index.projectKeys("website")).toEqual(
      new Set([
        "title",
        "draft-mode",
        "reader-mode",
        "repo-actions",
        "navbar",
        "sidebar",
        "search",
        "google-analytics",
      ]),
    );
    expect(index.projectKeys("book")).toEqual(
      new Set([
        "downloads",
        "title",
        "draft-mode",
        "reader-mode",
        "repo-actions",
        "type",
        "DOI",
        "navbar",
        "sidebar",
        "search",
        "google-analytics",
      ]),
    );
  });
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

// Numeric-member-enum annotation (numeric-member-enum matcher plan §3.1 B / L2): a
// closed enum whose members are all JS NUMBERS gets `numericMemberEnum` set at the
// shared `annotateClosedness` choke point, so the DOCUMENT-surface matcher validates
// it by parsed value (not string membership). Type-keyed, NOT value-keyed — a JS-string
// enum `["3","4"]` and a mixed enum must NOT get the bit (the forward-compat guard).
describe("parseSchemaIndex — numericMemberEnum annotation (document surface, matcher plan §3.1 B)", () => {
  const index = parseSchemaIndex(FIXTURE);
  const fm = (name: string): SchemaField | undefined =>
    index.frontMatterKeys([]).find((f) => f.name === name);

  it("sets numericMemberEnum on a closed enum whose members are all JS numbers (aspectratio)", () => {
    const aspectratio = fm("aspectratio");
    expect(aspectratio?.valuesClosed, "an enum is a closed set").toBe(true);
    expect(aspectratio?.numericMemberEnum, "members are JS numbers → numeric-member").toBe(true);
    expect(aspectratio?.values).toEqual(["43", "169", "1610", "149", "141", "54", "32"]);
  });

  it("does NOT set numericMemberEnum on a JS-STRING enum whose members look numeric (numstr-enum) — type-keyed, not value-keyed", () => {
    const numstr = fm("numstr-enum");
    expect(numstr?.valuesClosed, "still a closed string enum").toBe(true);
    expect(
      numstr?.numericMemberEnum,
      "members are JS strings ['3','4'] → NOT numeric-member (would wrongly reject quoted \"3\")",
    ).toBeUndefined();
  });

  it("does NOT set numericMemberEnum on a MIXED numeric/string enum (mixed-enum) — requires ALL members numeric", () => {
    const mixed = fm("mixed-enum");
    expect(mixed?.valuesClosed, "still a closed enum").toBe(true);
    expect(mixed?.numericMemberEnum, "a mixed enum is not all-numeric").toBeUndefined();
  });

  it("does NOT set numericMemberEnum on a plain boolean or string-enum field (toc / code-overflow)", () => {
    expect(fm("toc")?.numericMemberEnum, "boolean field").toBeUndefined();
    // code-overflow is a cell option, not front-matter; use the string enum freeze instead
    expect(fm("freeze")?.numericMemberEnum, "string enum [auto]").toBeUndefined();
  });

  it("GO-LIVE: the annotation makes the DOCUMENT matcher accept coerced aspectratio forms and flag out-of-set/quoted (composes L1+L2)", () => {
    const aspectratio = fm("aspectratio");
    expect(aspectratio, "aspectratio must resolve").toBeDefined();
    // Coerced forms quarto accepts (exit 0) — the live FP is gone:
    for (const v of ["169", "169.0", "+169", "0169", "4_3"]) {
      expect(isWrongValue(v, aspectratio!), `${v} must NOT flag`).toBe(false);
    }
    // Out-of-set / quoted — still/now flagged:
    expect(isWrongValue("5", aspectratio!)).toBe(true);
    expect(isWrongValue('"169"', aspectratio!)).toBe(true);
  });
});

// Other-container value-validation slice (plan §3.2 change A): a GENERAL length-1
// branch in `frontMatterKeys` exposes any top-level object container's
// already-resolved, already-annotated one-object-level children (`toField` →
// `objectChildren`). This is the READER half; the enumerator/completion GATE
// (`NESTED_CONTAINERS`) decides which containers are actually validated. The
// branch must sit AFTER the `execute`/`format` length-1 branches (they keep their
// overrides) and must not touch the length-2 `format` path.
describe("parseSchemaIndex — general length-1 container children (other-container value validation, plan §3.2)", () => {
  const index = parseSchemaIndex(FIXTURE);

  it("serves a closed object container's annotated children under its length-1 path (`crossref`)", () => {
    const kids = index.frontMatterKeys(["crossref"]);
    expect(kids.map((f) => f.name)).toContain("chapters");
    const chapters = kids.find((f) => f.name === "chapters");
    expect(chapters?.valuesClosed, "chapters is a provably-closed boolean child").toBe(true);
  });

  it("serves another container's annotated children (`editor` → closed `mode` enum)", () => {
    const mode = index.frontMatterKeys(["editor"]).find((f) => f.name === "mode");
    expect(mode?.valuesClosed, "editor.mode is a closed enum[source,visual]").toBe(true);
    expect(mode?.values).toEqual(["source", "visual"]);
  });

  it("returns [] for a scalar top-level field with no object children (`toc`)", () => {
    expect(index.frontMatterKeys(["toc"])).toEqual([]);
  });

  it("returns [] for an unknown top-level key", () => {
    expect(index.frontMatterKeys(["definitely-not-a-front-matter-key"])).toEqual([]);
  });

  it("does NOT shadow the `execute` length-1 branch (still the curated execute set)", () => {
    expect(index.frontMatterKeys(["execute"]).map((f) => f.name)).toEqual(
      CURATED_EXECUTE_KEYS.map((f) => f.name),
    );
  });

  it("does NOT shadow the `format` length-1 branch (still the reader-derived format names)", () => {
    const names = index.frontMatterKeys(["format"]).map((f) => f.name);
    expect(names).toContain("html");
    expect(names).toContain("revealjs");
    // `format` IS a top-level field (epub-scoped string, no children); the general
    // branch would return [] for it — proving the format branch runs FIRST.
    expect(names).not.toEqual([]);
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

// The RAW built-in format set for VALIDATION (format-name validation plan §3.1 B /
// L2): the complete `pandoc/formats.yml` (unfiltered — INCLUDES the hidden legacy
// variants html4/html5/… that quarto's schema ACCEPTS but completion strips) plus
// the synthesized formats, or `null` when the set is not known-complete (the curated
// fallback, or a resource with no formats list). Distinct from `frontMatterKeys(["format"])`
// (the COMPLETION accessor, which hides the legacy variants) — this MUST NOT hide them,
// else a validator keyed on it would false-positive on `format: html5` (§2.2 dragon).
describe("parseSchemaIndex — formatNamesForValidation: the raw built-in set (plan §3.1 B / L2)", () => {
  const index = parseSchemaIndex(FIXTURE);
  const set = index.formatNamesForValidation();

  it("returns a non-null set over a parsed (online) index carrying pandoc/formats.yml", () => {
    expect(set).not.toBeNull();
  });

  it("INCLUDES the hidden legacy variants completion strips (html5/html4/epub3/epub2/docbook5/docbook4)", () => {
    for (const hidden of ["html5", "html4", "epub3", "epub2", "docbook5", "docbook4"]) {
      expect(set?.has(hidden), `${hidden} must be present for validation`).toBe(true);
    }
  });

  it("includes the base names and Quarto's synthesized formats (md/hugo/dashboard/email)", () => {
    for (const n of ["html", "epub", "docbook", "pdf", "revealjs", "typst", "md", "hugo", "dashboard", "email"]) {
      expect(set?.has(n), `${n} must be present`).toBe(true);
    }
  });

  it("DIVERGES from the completion accessor — validation keeps html5, completion hides it", () => {
    const completion = index.frontMatterKeys(["format"]).map((f) => f.name);
    expect(completion, "completion HIDES html5").not.toContain("html5");
    expect(set?.has("html5"), "validation KEEPS html5").toBe(true);
  });

  it("leaves the completion accessor byte-unchanged (still hides the legacy variants)", () => {
    // Regression guard: adding the validation accessor must NOT alter completion.
    const completion = index.frontMatterKeys(["format"]).map((f) => f.name);
    for (const hidden of ["html5", "html4", "epub3", "epub2", "docbook5", "docbook4"]) {
      expect(completion, `completion still hides ${hidden}`).not.toContain(hidden);
    }
  });

  it("returns null for the curated fallback (offline — never flag; plan §3.1 B / dragon 3)", () => {
    expect(CURATED_SCHEMA_INDEX.formatNamesForValidation()).toBeNull();
  });

  it("returns null for a parsed index whose resource carries NO pandoc/formats.yml (FP-safe)", () => {
    // PROJECT_CONFIG_FIXTURE is a real parsed (online) index but has no format list;
    // absence of the complete set MUST be null (don't-flag), never an empty set.
    expect(parseSchemaIndex(PROJECT_CONFIG_FIXTURE).formatNamesForValidation()).toBeNull();
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
  // Typed FROM the contract rather than by re-listing it: a hand-copied union silently
  // drifts when a scope is added, and nothing catches it — `tsconfig.json` includes only
  // `["src"]`, so `npm run check-types` never sees this file, and vitest transpiles without
  // type-checking. That is exactly how the S162 `"none"` pin below shipped as a TS2345 error
  // that every green run reported as passing.
  const namesFor = (engine?: Parameters<SchemaIndex["cellOptions"]>[0]): string[] =>
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

  it("does not filter when no engine is passed (returns the full set)", () => {
    expect(namesFor(undefined)).toContain("cache");
    expect(namesFor(undefined)).toContain("tags");
  });

  it('"unknown" keeps ONLY the engine-agnostic options (S161)', () => {
    // Quarto scopes its cell schema to the DOCUMENT's engine, which a cell LANGUAGE alone
    // does not determine: a `{sql}` cell is knitr in a document that also has an `{r}` cell
    // and markdown otherwise. Grounded firsthand vs 1.7.33 — `{sql}` + `--| cache: banana`
    // renders exit 1 in a knitr document but exit 0 in a markdown- or jupyter-engine one,
    // while the engine-agnostic `--| echo: banana` renders exit 1 in all three. So the only
    // FP-safe set for an undeterminable engine is the intersection.
    const unknown = namesFor("unknown");
    expect(unknown).toContain("echo"); // engine-agnostic
    expect(unknown).toContain("tbl-colwidths"); // multi-engine → tag unset → agnostic
    for (const scoped of ["cache", "fig-width", "message", "animation-hook", "tags"]) {
      expect(unknown, `"unknown" must exclude the engine-scoped ${scoped}`).not.toContain(scoped);
    }
  });

  it('"none" is EMPTY — it excludes the engine-agnostic options too (S162)', () => {
    // A cell-HANDLER language (`{dot}`/`{mermaid}`) is not validated by a narrower ENGINE;
    // quarto swaps the whole cell schema for `handlers/<lang>/schema.yml`, so no `cell-*`
    // field applies at all. That makes `"none"` the one scope not expressible as a filter
    // over `SchemaField.engine`: the engine-agnostic fields — the very ones `"unknown"`
    // keeps — must go too, because `{dot}` + `//| echo: banana` and `{mermaid}` + `#| echo:
    // banana` both render quarto exit 0 (measured) while `echo` is engine-agnostic.
    expect(namesFor("none")).toEqual([]);
    expect(namesFor("none")).not.toContain("echo");
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
