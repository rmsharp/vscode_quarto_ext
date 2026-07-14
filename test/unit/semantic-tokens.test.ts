import { describe, expect, it } from "vitest";
import {
  type AbsToken,
  decodeTokens,
  encodeTokens,
  mergeSemanticTokens,
  OUR_LEGEND,
} from "../../src/core/embedded/semantic-tokens";

describe("semantic-tokens: decoding a server's delta-encoded stream", () => {
  it("decodes one token to absolute coordinates with its type NAME resolved", () => {
    // The LSP wire format is five uint32s per token:
    //   [deltaLine, deltaChar, length, typeIndex, modifierBitset]
    const stream = {
      data: new Uint32Array([3, 4, 8, 1, 0]),
      legend: { tokenTypes: ["comment", "keyword"], tokenModifiers: [] },
    };

    expect(decodeTokens(stream)).toEqual([
      { line: 3, char: 4, length: 8, type: "keyword", modifiers: [] },
    ]);
  });

  it("resolves the modifier BITSET into names, against the SOURCE legend's bit order", () => {
    // Real data, measured against real Pylance (Session 88 probe): the token `CONSTANT`
    // in `CONSTANT = 42` comes back with a modifier bitset of 129 = 0b10000001 — bit 0
    // and bit 7. In PYLANCE's modifier legend, bit 0 is `declaration` and bit 7 is
    // `readonly`. Those bit positions are Pylance's, not VS Code's standard ones, and
    // that is the whole reason this decode must resolve NAMES rather than pass indices
    // through (see the encode side, where readonly is bit 2).
    const stream = {
      data: new Uint32Array([3, 0, 8, 15, 129]),
      legend: {
        tokenTypes: PYLANCE_TYPES,
        tokenModifiers: PYLANCE_MODIFIERS,
      },
    };

    expect(decodeTokens(stream)).toEqual([
      {
        line: 3,
        char: 0,
        length: 8,
        type: "variable",
        modifiers: ["declaration", "readonly"],
      },
    ]);
  });

  it("RESETS char at a new line — deltaChar is relative to the line, not the stream", () => {
    // The line that decides where every colour lands, and the one my first battery did
    // NOT pin: an adversarial review proved that deleting the reset
    // (`char = deltaLine === 0 ? char + deltaChar : deltaChar` -> `char += deltaChar`)
    // left the ENTIRE suite green — 777 unit + 304 integration — because every
    // multi-token stream in it happened to sit on ONE line, so `char` was always 0 at the
    // moment a new line arrived and the two branches agreed.
    //
    // In the wild it is never 0. deltaChar is relative to the previous token ON THE SAME
    // LINE; when the line advances it is an ABSOLUTE column. Carry the old column over and
    // every token after the first line drifts right, cumulatively — the whole cell
    // mis-coloured, drifting further with each line.
    //
    // Two tokens, two DIFFERENT lines, and the first is NOT at column 0. That is what it
    // takes to tell the two implementations apart.
    const stream = {
      data: new Uint32Array([
        3, 8, 4, 1, 0, // line 3, char 8
        1, 4, 3, 1, 0, // line 4, char 4  — NOT char 12
      ]),
      legend: { tokenTypes: ["comment", "keyword"], tokenModifiers: [] },
    };

    expect(decodeTokens(stream).map((t) => [t.line, t.char])).toEqual([
      [3, 8],
      [4, 4],
    ]);
  });

  it("treats a malformed stream as EMPTY rather than throwing, and never half-decodes it", () => {
    // §6.2's error contract. A server that returns a stream whose length is not a
    // multiple of 5 is broken, but a broken server must degrade the document to TextMate
    // colouring — never break it, and never colour it from a stream we only half
    // understand (a partial decode would silently mis-colour the tail).
    const stream = {
      data: new Uint32Array([0, 0, 4, 1, 0, 1, 2]), // 7 entries: one token + a fragment
      legend: { tokenTypes: ["comment", "keyword"], tokenModifiers: [] },
    };

    expect(decodeTokens(stream)).toEqual([]);
  });

  it("DROPS a token whose type index is outside the source legend", () => {
    // The stream and the legend disagree — we cannot know what this token is. Dropping it
    // (rather than emitting `type: undefined` behind an interface that promises `string`)
    // keeps the malformed value from reaching Slice 2's merge, where TypeScript would not
    // warn anyone about it.
    const stream = {
      data: new Uint32Array([
        0, 0, 4, 999, 0, // type index 999: out of bounds
        0, 5, 2, 1, 0, // a good token, which must survive
      ]),
      legend: { tokenTypes: ["comment", "keyword"], tokenModifiers: [] },
    };

    expect(decodeTokens(stream)).toEqual([
      { line: 0, char: 5, length: 2, type: "keyword", modifiers: [] },
    ]);
  });

  it("never aliases modifier bit 32 onto bit 0 (JS shifts are mod 32)", () => {
    // `1 << 32 === 1` in JavaScript. A legend longer than 32 modifiers would therefore
    // make index 32 fire whenever bit 0 is set, attaching a modifier the server never sent
    // — the one failure this module must never have, since it would MIS-colour rather than
    // merely under-colour. No server ships 33 modifiers today (Pylance has 15), so this is
    // a guard against a future one, and against Slice 2 inheriting the bug.
    const tokenModifiers = Array.from({ length: 34 }, (_, i) => `m${i}`);
    const stream = {
      data: new Uint32Array([0, 0, 1, 0, 0b1]), // ONLY bit 0 is set
      legend: { tokenTypes: ["variable"], tokenModifiers },
    };

    expect(decodeTokens(stream)[0].modifiers).toEqual(["m0"]); // never ["m0", "m32"]
  });

  it("decodes an empty stream to nothing", () => {
    const stream = {
      data: new Uint32Array([]),
      legend: { tokenTypes: ["keyword"], tokenModifiers: [] },
    };

    expect(decodeTokens(stream)).toEqual([]);
  });
});

/**
 * Real Pylance's legend, captured firsthand from
 * `vscode.provideDocumentSemanticTokensLegend` (Session 88 grounding probe,
 * ms-python.vscode-pylance-2026.2.1). Index order is significant — it is exactly what
 * makes a naive bitset copy wrong.
 */
const PYLANCE_TYPES = [
  "comment", "keyword", "operator", "string", "number", "regexp", "type", "class",
  "interface", "enum", "enumMember", "typeParameter", "function", "method", "property",
  "variable", "parameter", "module", "intrinsic", "selfParameter", "clsParameter",
  "magicFunction", "builtinConstant", "parenthesis", "curlybrace", "bracket", "colon",
  "semicolon", "arrow",
];
const PYLANCE_MODIFIERS = [
  "declaration", "static", "abstract", "async", "documentation", "typeHint",
  "typeHintComment", "readonly", "decorator", "builtin", "overridden", "callable",
  "classMember", "keywordArgument", "dynamicAttribute",
];

/** A stream in Pylance's legend, as `provideDocumentSemanticTokens` hands it to us. */
function pylanceStream(...data: number[]) {
  return {
    data: new Uint32Array(data),
    legend: { tokenTypes: PYLANCE_TYPES, tokenModifiers: PYLANCE_MODIFIERS },
  };
}

describe("semantic-tokens: re-encoding into OUR legend", () => {
  it("REBUILDS the modifier bitset against our legend — it does not copy the number", () => {
    // 🐉 The plan's headline dragon, pinned with data measured from real Pylance.
    //
    // `CONSTANT = 42` produces: type index 15 (`variable` in Pylance's legend) with a
    // modifier bitset of 129 = bits 0 and 7 = Pylance's `declaration` + `readonly`.
    //
    // Our legend is the standard VS Code one, where `readonly` is bit 2 and bit 7 is
    // `modification`. So the correct bitset for us is bits 0 and 2 = 5.
    //
    // A naive implementation that copies the modifier number through would emit 129 —
    // which our legend reads as `declaration` + `modification`, silently telling the
    // theme that a read-only constant is being MUTATED. It would look plausible and be
    // wrong, in a way no type error and no green stand-in test would ever reveal.
    const tokens = decodeTokens(pylanceStream(3, 0, 8, 15, 129));

    const encoded = encodeTokens(tokens, OUR_LEGEND);

    const ourVariable = OUR_LEGEND.tokenTypes.indexOf("variable");
    const declaration = 1 << OUR_LEGEND.tokenModifiers.indexOf("declaration");
    const readonly = 1 << OUR_LEGEND.tokenModifiers.indexOf("readonly");

    expect([...encoded]).toEqual([3, 0, 8, ourVariable, declaration | readonly]);
    // The discriminator: the source number must NOT survive the trip.
    expect(encoded[4]).not.toBe(129);
  });

  // The cases below were GREEN the moment the encoder above existed — they are a
  // disclosed BEHAVIOR-LOCK battery, not fabricated REDs. Each is break-revert-proven
  // against a specific mutant (recorded in the commit), which is what shows it
  // discriminates rather than merely passing.

  it("CLEARS an unknown modifier bit but KEEPS the token", () => {
    // `int` in `count: int = 0` — Pylance type 7 (`class`), modifiers 544 = bits 5 and 9
    // = `typeHint` + `builtin`. Neither exists in our legend. The token is a perfectly
    // good `class` and must survive; only the two foreign bits are cleared. Dropping the
    // token instead would silently uncolour every type annotation in the file.
    const tokens = decodeTokens(pylanceStream(9, 11, 3, 7, 544));

    const encoded = encodeTokens(tokens, OUR_LEGEND);

    expect(encoded.length).toBe(5);
    expect(encoded[3]).toBe(OUR_LEGEND.tokenTypes.indexOf("class"));
    expect(encoded[4]).toBe(0);
  });

  it("DROPS a token whose type is foreign, and re-deltas against the previous EMITTED token", () => {
    // The subtle one. Pylance's `self` (type 19, `selfParameter`) is not in our legend, so
    // it is dropped. The token AFTER it must then have its delta computed against the last
    // token we actually EMITTED — not against the one we discarded. Get this wrong and
    // every token following a dropped one lands at the wrong column, shifting colours
    // across the line in a way that looks like an off-by-one in someone else's code.
    //
    // Line 12: `        self.name = name` -> selfParameter@8 (dropped), variable@13, parameter@20.
    const tokens = decodeTokens(
      pylanceStream(
        12, 8, 4, 19, 0, // self          -> selfParameter, DROPPED
        0, 5, 4, 15, 4097, // name        -> variable
        0, 7, 4, 16, 0, // name (rhs)     -> parameter
      ),
    );

    const encoded = encodeTokens(tokens, OUR_LEGEND);

    const variable = OUR_LEGEND.tokenTypes.indexOf("variable");
    const parameter = OUR_LEGEND.tokenTypes.indexOf("parameter");
    const declaration = 1 << OUR_LEGEND.tokenModifiers.indexOf("declaration");
    expect([...encoded]).toEqual([
      // `name` at absolute char 13 — its delta is from column 0, NOT from the dropped
      // `self` at 8, because nothing before it was emitted on this line.
      12, 13, 4, variable, declaration, // classMember (bit 12) is foreign -> cleared
      0, 7, 4, parameter, 0, // `name` at 20: delta 7 from the previously EMITTED token
    ]);
  });

  it("sorts ascending by (line, char) — VS Code requires document order", () => {
    // A single server's stream already arrives sorted, so this is latent for Slice 1 and
    // load-bearing for Slice 2, where two languages' streams interleave arbitrarily. VS
    // Code does not sort for us; an out-of-order stream yields corrupt colouring.
    const tokens: AbsToken[] = [
      { line: 5, char: 0, length: 1, type: "variable", modifiers: [] },
      { line: 2, char: 8, length: 1, type: "keyword", modifiers: [] },
      { line: 2, char: 2, length: 1, type: "number", modifiers: [] },
    ];

    const encoded = encodeTokens(tokens, OUR_LEGEND);

    const lines: number[] = [];
    const chars: number[] = [];
    let line = 0;
    let char = 0;
    for (let i = 0; i < encoded.length; i += 5) {
      line += encoded[i];
      char = encoded[i] === 0 ? char + encoded[i + 1] : encoded[i + 1];
      lines.push(line);
      chars.push(char);
    }
    expect(lines).toEqual([2, 2, 5]);
    expect(chars).toEqual([2, 8, 0]);
  });

  it("encodes nothing when there is nothing to encode", () => {
    expect([...encodeTokens([], OUR_LEGEND)]).toEqual([]);
  });

  it("declares a legend of standard names only (the Slice 3 / D4 boundary)", () => {
    // Pins the deliberate scope boundary: Slice 1 carries NO foreign names. When Slice 3
    // resolves D4 (carry Pylance's names + semanticTokenScopes, or map to superType),
    // this test is the one that should fail and be updated — on purpose.
    expect(OUR_LEGEND.tokenTypes).not.toContain("selfParameter");
    expect(OUR_LEGEND.tokenTypes).not.toContain("module");
    expect(OUR_LEGEND.tokenModifiers).not.toContain("builtin");
    // …and the standard names it forwards ARE present.
    expect(OUR_LEGEND.tokenTypes).toContain("variable");
    expect(OUR_LEGEND.tokenModifiers).toContain("readonly");
  });
});

/**
 * The built-in TypeScript/JavaScript service's REAL semantic-token legend, captured
 * firsthand in the Session 89 probe (`vscode.provideDocumentSemanticTokensLegend` on a
 * plain `.js` file in the real-LSP harness). 12 types, 6 modifiers — a completely
 * different index space from Pylance's 29/15, which is the whole reason the merge must
 * decode each stream against ITS OWN legend.
 */
const JS_TYPES = [
  "class", "enum", "interface", "namespace", "typeParameter", "type",
  "parameter", "variable", "enumMember", "property", "function", "method",
];
const JS_MODIFIERS = [
  "declaration", "static", "async", "readonly", "defaultLibrary", "local",
];

describe("mergeSemanticTokens: one document, N language servers (Slice 2, plan §5.5)", () => {
  // The document these fixtures model — the {ojs} cell comes FIRST, the {python} cell second:
  //
  //   0  # Title
  //   1
  //   2  ```{ojs}
  //   3  const G = 'hi';        <- javascript token, .qmd line 3
  //   4  ```
  //   5
  //   6  ```{python}
  //   7  CONSTANT = 42          <- python token, .qmd line 7
  //   8  ```
  //
  // Each server sees only its OWN cell (every other line is blanked to spaces), so each
  // returns a stream in .qmd coordinates covering a DISJOINT set of lines.

  /** Pylance's answer for `CONSTANT` on line 7: variable(15), bits 129 = declaration|readonly. */
  const pythonStream = {
    data: new Uint32Array([7, 0, 8, 15, 129]),
    legend: { tokenTypes: PYLANCE_TYPES, tokenModifiers: PYLANCE_MODIFIERS },
  };
  /** The JS service's answer for `G` on line 3: variable(7), bits 9 = declaration|readonly. */
  const jsStream = {
    data: new Uint32Array([3, 6, 1, 7, 9]),
    legend: { tokenTypes: JS_TYPES, tokenModifiers: JS_MODIFIERS },
  };

  it("SORTS across streams — the python stream arrives first, but its tokens come LATER", () => {
    // THE headline of this slice. The provider hands streams over in the order the languages
    // appear in `LANGUAGES`/the document, which has NOTHING to do with where their tokens
    // land. Here python is passed first while its token is on line 7 and javascript's is on
    // line 3. VS Code requires strictly ascending document order, and the deltas are relative
    // — so concatenating without sorting does not merely mis-order, it produces a NEGATIVE
    // deltaLine that wraps around in a Uint32Array to ~4.29 billion and corrupts the document.
    const merged = mergeSemanticTokens([pythonStream, jsStream], OUR_LEGEND);
    const decoded = decodeTokens({ data: merged, legend: OUR_LEGEND });

    expect(decoded).toEqual([
      { line: 3, char: 6, length: 1, type: "variable", modifiers: ["declaration", "readonly"] },
      { line: 7, char: 0, length: 8, type: "variable", modifiers: ["declaration", "readonly"] },
    ]);
  });

  it("re-deltas against the previously EMITTED token, not each stream's own origin", () => {
    // Both source streams delta from line 0 (each is a standalone stream). In the merged
    // stream the second token's deltaLine must be 7-3 = 4, NOT its original 7. Decoding
    // catches this, but assert the wire bytes too: this is the one place the merge could
    // look right in every absolute assertion and still hand VS Code a broken stream.
    const merged = mergeSemanticTokens([pythonStream, jsStream], OUR_LEGEND);

    const VARIABLE = OUR_LEGEND.tokenTypes.indexOf("variable");
    const DECL_READONLY =
      (1 << OUR_LEGEND.tokenModifiers.indexOf("declaration")) |
      (1 << OUR_LEGEND.tokenModifiers.indexOf("readonly"));

    expect([...merged]).toEqual([
      3, 6, 1, VARIABLE, DECL_READONLY, // javascript, line 3 (delta from origin)
      4, 0, 8, VARIABLE, DECL_READONLY, // python,     line 7 = 3 + 4
    ]);
  });

  it("decodes each stream against ITS OWN legend — the same bit means a different modifier", () => {
    // The trap this whole design exists to avoid, now doubly confirmed against two REAL
    // servers. `readonly` is bit 7 for Pylance and bit 3 for the JS service; in OUR legend
    // it is bit 2, and bits 7 and 3 there are `modification` and `static`. So a merge that
    // decoded both streams against one legend — or copied the bitsets through — would tell
    // the theme that the Python constant is being MUTATED and the JS one is STATIC.
    expect(PYLANCE_MODIFIERS[7]).toBe("readonly");
    expect(JS_MODIFIERS[3]).toBe("readonly");
    expect(OUR_LEGEND.tokenModifiers[7]).toBe("modification");
    expect(OUR_LEGEND.tokenModifiers[3]).toBe("static");

    const decoded = decodeTokens({
      data: mergeSemanticTokens([pythonStream, jsStream], OUR_LEGEND),
      legend: OUR_LEGEND,
    });

    // Both arrive as readonly, from two different source bits. Neither is modification/static.
    for (const token of decoded) {
      expect(token.modifiers).toContain("readonly");
      expect(token.modifiers).not.toContain("modification");
      expect(token.modifiers).not.toContain("static");
    }
  });

  it("degrades per language: a server that returns nothing must not silence the others", () => {
    // Measured, not hypothetical (Session 89 probe): the JS service's LEGEND command returns
    // `undefined` on the first pass while its TOKENS command already answers — so on a mixed
    // document's first debounced pass one language legitimately has no usable stream. If the
    // merge were all-or-nothing, the whole document would go uncoloured, intermittently.
    const merged = mergeSemanticTokens([pythonStream], OUR_LEGEND);
    const decoded = decodeTokens({ data: merged, legend: OUR_LEGEND });

    expect(decoded).toEqual([
      { line: 7, char: 0, length: 8, type: "variable", modifiers: ["declaration", "readonly"] },
    ]);
  });

  it("is empty for no streams at all, and survives a MALFORMED stream among good ones", () => {
    expect([...mergeSemanticTokens([], OUR_LEGEND)]).toEqual([]);

    // A stream whose length is not a multiple of 5 is not what it claims to be. It decodes
    // to nothing (never a partial, provably-misread colouring) — and, critically, it must not
    // take the healthy languages down with it.
    const malformed = {
      data: new Uint32Array([1, 2, 3]),
      legend: { tokenTypes: JS_TYPES, tokenModifiers: JS_MODIFIERS },
    };
    const decoded = decodeTokens({
      data: mergeSemanticTokens([malformed, pythonStream], OUR_LEGEND),
      legend: OUR_LEGEND,
    });

    expect(decoded).toEqual([
      { line: 7, char: 0, length: 8, type: "variable", modifiers: ["declaration", "readonly"] },
    ]);
  });

  it("interleaves MANY tokens from both languages into one ascending stream", () => {
    // Two multi-token streams whose lines genuinely interleave, so the merge cannot get the
    // order right by accident of one stream simply preceding the other. This is also the
    // case that would have caught the Session 88 decoder bug (Learning #97): tokens on
    // several different lines, where the per-line column reset actually matters.
    const js = {
      // lines 3 and 4 (two tokens on line 4 — exercises the same-line delta path too)
      data: new Uint32Array([3, 6, 1, 7, 0, 1, 2, 3, 10, 0, 0, 8, 4, 6, 0]),
      legend: { tokenTypes: JS_TYPES, tokenModifiers: JS_MODIFIERS },
    };
    const py = {
      // lines 7 and 9
      data: new Uint32Array([7, 0, 8, 15, 0, 2, 4, 5, 12, 0]),
      legend: { tokenTypes: PYLANCE_TYPES, tokenModifiers: PYLANCE_MODIFIERS },
    };

    const decoded = decodeTokens({
      data: mergeSemanticTokens([py, js], OUR_LEGEND),
      legend: OUR_LEGEND,
    });

    expect(decoded.map((t) => `${t.type}@${t.line}:${t.char}`)).toEqual([
      "variable@3:6",  // js
      "function@4:2",  // js
      "parameter@4:10", // js, same line as the previous token
      "variable@7:0",  // python
      "function@9:4",  // python
    ]);
  });
});
