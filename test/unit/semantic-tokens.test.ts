import { describe, expect, it } from "vitest";
import {
  type AbsToken,
  decodeTokens,
  encodeTokens,
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
