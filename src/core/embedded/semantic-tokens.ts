/**
 * Pure, `vscode`-free semantic-token translation (BACKLOG item 16, plan §6.2). This
 * module MUST NOT import `vscode` (architecture §3.3) and is unit-tested headlessly.
 */

/** A semantic-token legend: type names and modifier names, both index-significant. */
export interface Legend {
  tokenTypes: string[];
  tokenModifiers: string[];
}

/** One server's answer, in ITS OWN legend's indices. */
export interface TokenStream {
  data: Uint32Array;
  legend: Legend;
}

/** A decoded token: absolute coordinates, names resolved out of the source legend. */
export interface AbsToken {
  line: number;
  char: number;
  length: number;
  type: string;
  modifiers: string[];
}

/**
 * The legend WE declare to VS Code at registration — the standard token types and
 * modifiers, and nothing else.
 *
 * A `SemanticTokensLegend` must be declared up front, but an embedded server's legend is
 * only knowable at runtime and differs per language (Pylance's has 29 types; a Julia
 * server's will not). So we translate into a fixed legend of our own, and a name that is
 * not in it is DROPPED — that token simply keeps its TextMate colour. Degraded, never
 * wrong.
 *
 * What that costs today, measured against real Pylance (Session 88): 13 of 36 tokens in a
 * representative Python file fall outside the standard set — every `self`
 * (`selfParameter`), `os`/`typing` (`module`), `True`/`None` (`builtinConstant`) and
 * `__init__` (`magicFunction`). Carrying those foreign names through — either by
 * declaring them here and contributing `semanticTokenScopes`, or by mapping each to its
 * `superType` — is plan §5.4's D4 decision, and it is deliberately deferred to Slice 3,
 * where the resulting colours can be verified in a real window. This constant is the one
 * line that changes when that lands.
 */
export const OUR_LEGEND: Legend = {
  tokenTypes: [
    "namespace", "class", "enum", "interface", "struct", "typeParameter", "type",
    "parameter", "variable", "property", "enumMember", "decorator", "event",
    "function", "method", "macro", "label", "comment", "string", "keyword",
    "number", "regexp", "operator",
  ],
  tokenModifiers: [
    "declaration", "definition", "readonly", "static", "deprecated", "abstract",
    "async", "modification", "documentation", "defaultLibrary",
  ],
};

/**
 * Decode a delta-encoded LSP token stream into absolute, name-resolved tokens.
 *
 * Total: a malformed stream decodes to nothing rather than throwing (§6.2). A language
 * server we do not control is on the other end of this, and the worst it may ever do to
 * a `.qmd` is leave it with its TextMate colouring.
 */
export function decodeTokens(stream: TokenStream): AbsToken[] {
  const { data, legend } = stream;
  // Five uint32s per token, exactly. A length that is not a multiple of 5 means the
  // stream is not what it claims to be, and a partial decode would colour the document
  // from data we have provably misread — worse than not colouring it at all.
  if (data.length % 5 !== 0) {
    return [];
  }
  const out: AbsToken[] = [];
  let line = 0;
  let char = 0;
  for (let i = 0; i + 4 < data.length; i += 5) {
    const deltaLine = data[i];
    const deltaChar = data[i + 1];
    line += deltaLine;
    char = deltaLine === 0 ? char + deltaChar : deltaChar;
    const type = legend.tokenTypes[data[i + 3]];
    if (type === undefined) {
      // A type index past the end of the server's own legend: the stream and the legend
      // disagree, so we cannot know what this token is. Drop it here rather than emit an
      // AbsToken whose `type` is `undefined` while the interface promises a `string` —
      // TypeScript cannot catch an out-of-bounds index, and the next consumer (Slice 2's
      // merge) would dereference it with no warning. `encodeTokens` would drop it anyway;
      // this makes that intentional instead of incidental.
      continue;
    }
    out.push({
      line,
      char,
      length: data[i + 2],
      type,
      modifiers: modifierNames(data[i + 4], legend.tokenModifiers),
    });
  }
  return out;
}

/**
 * Re-encode absolute tokens into `ourLegend`'s indices as a delta-encoded LSP stream.
 *
 * Three things happen here, and each one is a way to get it silently wrong:
 *
 *  - **Type names are remapped, and unknown ones DROPPED.** An index copy would be
 *    nonsense: the same number means a different type in every server's legend.
 *  - **Modifier bitsets are REBUILT bit by bit.** They are a bitset, not an index, and
 *    the bit positions are the source legend's. Copying the number through mis-tags
 *    tokens (real Pylance: bit 7 is `readonly`; in the standard legend it is
 *    `modification`). An unknown modifier bit is CLEARED — it never drops the token.
 *  - **Output is sorted ascending by (line, char)** before delta-encoding, because VS
 *    Code requires document order, and deltas are taken against the previously EMITTED
 *    token — not the previously decoded one, which is what makes dropping safe.
 */
export function encodeTokens(tokens: AbsToken[], ourLegend: Legend): Uint32Array {
  const typeIndex = new Map(ourLegend.tokenTypes.map((t, i) => [t, i]));
  const modifierBit = new Map(ourLegend.tokenModifiers.map((m, i) => [m, 1 << i]));

  const mapped = tokens
    .filter((t) => typeIndex.has(t.type))
    .sort((a, b) => a.line - b.line || a.char - b.char);

  const data = new Uint32Array(mapped.length * 5);
  let prevLine = 0;
  let prevChar = 0;
  mapped.forEach((token, n) => {
    const deltaLine = token.line - prevLine;
    const deltaChar = deltaLine === 0 ? token.char - prevChar : token.char;
    let bits = 0;
    for (const name of token.modifiers) {
      bits |= modifierBit.get(name) ?? 0; // unknown bit: cleared, token kept
    }
    const at = n * 5;
    data[at] = deltaLine;
    data[at + 1] = deltaChar;
    data[at + 2] = token.length;
    data[at + 3] = typeIndex.get(token.type) as number;
    data[at + 4] = bits;
    prevLine = token.line;
    prevChar = token.char;
  });
  return data;
}

/**
 * Merge N language servers' answers for ONE document into a single stream in `ourLegend`
 * (BACKLOG item 16, Slice 2; plan §5.5 D5).
 *
 * A `.qmd` may hold `{python}`, `{r}` and `{ojs}` cells at once. Each language gets its own
 * virtual document — its cells kept verbatim, every other line blanked — so each server
 * answers in the `.qmd`'s own coordinates about a DISJOINT set of lines. VS Code, though,
 * accepts exactly one stream per document, in strictly ascending order.
 *
 * The whole merge is a composition of the two functions above, and each half of it is
 * load-bearing:
 *
 *  - **`decodeTokens` per stream** resolves each server's indices against ITS OWN legend.
 *    They do not agree: `readonly` is bit 7 for Pylance, bit 3 for the built-in JS service,
 *    and bit 2 for us. Decoding both against one legend would report a read-only Python
 *    constant as `modification` and a JS one as `static`.
 *  - **`encodeTokens` over the concatenation** sorts ascending before delta-encoding. The
 *    streams arrive in language order, which has nothing to do with document order — the
 *    `{ojs}` cell may sit above the `{python}` one. Concatenating without sorting does not
 *    merely mis-order the tokens: the deltas are relative, so a backwards step produces a
 *    negative `deltaLine` that wraps in a `Uint32Array` to ~4.29 billion.
 *
 * A stream that is missing or malformed contributes nothing and takes nothing with it —
 * `decodeTokens` yields `[]` for it, and the other languages are unaffected. That is not a
 * theoretical nicety: the JS service's legend command returns `undefined` on the first pass
 * while its token command already answers (measured, Session 89), so on a mixed document's
 * first debounced pass one language routinely has no usable stream.
 */
export function mergeSemanticTokens(
  streams: TokenStream[],
  ourLegend: Legend,
): Uint32Array {
  return encodeTokens(
    streams.flatMap((stream) => decodeTokens(stream)),
    ourLegend,
  );
}

/**
 * The modifier names encoded in `bits`, in the SOURCE legend's bit order.
 *
 * Modifiers are a BITSET, not an index: bit `n` means "the modifier at index `n` of the
 * legend that produced this stream". Those positions are the server's own, and they do
 * NOT agree with VS Code's standard order — real Pylance puts `readonly` at bit 7, where
 * the standard legend has `modification`. Resolving to names here is what lets the
 * encoder rebuild the bitset against OUR legend instead of copying a number that means
 * something different on the other side.
 */
function modifierNames(bits: number, tokenModifiers: string[]): string[] {
  const names: string[] = [];
  // Stop at 32. The bitset is one uint32, so a legend may only ever address 32 modifiers —
  // and JS shift counts are taken mod 32, so `1 << 32` is `1`, not 0. Looping past the end
  // would therefore make modifier 32 alias modifier 0 and silently attach a name the
  // server never set, which is the one thing this module promises never to do.
  const addressable = Math.min(tokenModifiers.length, 32);
  for (let bit = 0; bit < addressable; bit++) {
    if ((bits & (1 << bit)) !== 0) {
      names.push(tokenModifiers[bit]);
    }
  }
  return names;
}
