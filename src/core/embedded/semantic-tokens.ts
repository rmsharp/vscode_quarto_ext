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
 * modifiers, PLUS exactly the two foreign names it is safe to carry (plan §5.4, D4).
 *
 * A `SemanticTokensLegend` must be declared up front, but an embedded server's legend is
 * only knowable at runtime and differs per language (Pylance's has 29 types; a Julia
 * server's will not). So we translate into a fixed legend of our own, and a name that is
 * not in it is DROPPED — that token keeps its TextMate colour.
 *
 * ## D4, resolved (Slice 3): carry `module` and `intrinsic`. Drop the other ten.
 *
 * The tempting answer — carry all of Pylance's foreign names, recovering the measured 36%
 * of its tokens we drop — is WRONG, and it is worth saying exactly why, because it looks
 * right and the wrongness is invisible in the theme most people debug against.
 *
 * A `.qmd`'s `{python}` cell is ALREADY coloured, by VS Code's bundled MagicPython TextMate
 * grammar. So the semantic layer is not painting a blank canvas — it is painting OVER a
 * grammar that is mostly right. A foreign name we carry but cannot style correctly does not
 * degrade to TextMate; it OVERRIDES it, and can only make things worse.
 *
 * 🔑 **The triage rule.** A serving extension's own `contributes.semanticTokenScopes` entry
 * for a type is that author saying: *the superType default is the WRONG colour for this
 * type*. Pylance ships such an entry for `selfParameter`, `clsParameter`, `magicFunction`,
 * `builtinConstant` and its six punctuation types — and NONE for `module` and `intrinsic`.
 * The set with no scope entry is exactly the set that is safe to carry bare. That is not a
 * coincidence: it is the same judgement the author already made, read back out of their
 * manifest. And their entries cannot help US — VS Code gates them on the MODEL's languageId,
 * which for a `.qmd` is `quarto`, never `python`.
 *
 * What that means concretely, resolved firsthand against the shipped bundle and the REAL
 * default theme (`COLOR_THEME_DARK = "Dark 2026"` — *not* Dark+/Dark Modern, which colour
 * these scopes identically and so hide the whole problem):
 *
 *  - `module` (`os`, `np`, `typing`) — MagicPython gives a module name NO scope at all: it is
 *    a bare identifier on plain editor foreground (verified: zero `variable.other*` scopes in
 *    the grammar). This is the one place the semantic layer has something to ADD and nothing
 *    to destroy, and it resolves through `namespace` -> `entity.name.namespace` to exactly the
 *    colour a real `.py` gets. **This is the entire user-visible win of D4.**
 *  - `intrinsic` — same rule, same reasoning (`operator` -> `keyword.operator`).
 *  - `magicFunction` (`__init__`) — CARRYING IT IS A REGRESSION. Its superType `function`
 *    probes `["entity.name.function"]` BEFORE `["support.function"]` and returns on the first
 *    hit, so `__init__` would turn #d2a8ff PURPLE — replacing the #79c0ff that MagicPython's
 *    `support.function.magic.python` already gives it correctly.
 *  - `builtinConstant` (`True`/`None`) — its superType `constant` is not a token type VS Code
 *    registers at all (verified: zero occurrences in the shipped bundle), so carrying it would
 *    resolve to nothing and drop anyway. Pure no-op.
 *  - `selfParameter`, the punctuation types — same family: styled by their author, inert here.
 *
 * The recovery is therefore NOT "36% of tokens". It is "module names now colour like they do
 * in a `.py`", and the other ten are dropped BECAUSE TextMate already has them right.
 *
 * ⚠ **"Degraded, never wrong" is true of a DROPPED type — and NOT of a kept one.** An unknown
 * type name is provably omitted from the stream (VS Code resolves it to no style and filters
 * it out), so TextMate survives untouched, foreground and font style both. But a token whose
 * TYPE we keep while CLEARING a foreign MODIFIER is a PARTIAL override: it still paints, just
 * without the refinement. Pylance's `typeHintComment` is the live instance — inside a legacy
 * `# type: List[int]` comment it emits a standard `class`, which we already carry, and we
 * repaint the interior of a comment as live code. That is filed (BACKLOG), not fixed here, and
 * carrying the modifier names would NOT fix it — their scope rules are python-gated too.
 *
 * The `contributes.semanticTokenScopes` half of this decision lives in `package.json` (scoped
 * to `language: "quarto"`), and it is what makes the `module` win survive even against a server
 * that registers no `superType` at all. We deliberately do NOT contribute
 * `contributes.semanticTokenTypes`: VS Code's type registry is a single global map keyed by
 * bare id, and its deregistration is owner-blind and un-refcounted — declaring Pylance's ids
 * would mean OUR uninstall deletes PYLANCE's registration and degrades the user's plain `.py`
 * files.
 *
 * ORDER IS SIGNIFICANT — these are positional indices, declared up front at registration.
 * APPEND new names; never insert.
 */
export const OUR_LEGEND: Legend = {
  tokenTypes: [
    "namespace", "class", "enum", "interface", "struct", "typeParameter", "type",
    "parameter", "variable", "property", "enumMember", "decorator", "event",
    "function", "method", "macro", "label", "comment", "string", "keyword",
    "number", "regexp", "operator",
    // The two foreign names, carried (D4). See the triage rule above.
    "module", "intrinsic",
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
  // A stream with no usable legend is not decodable AT ALL: the type/modifier numbers are
  // indices INTO it and mean nothing without it. This is not hypothetical — the built-in
  // TS/JS service's legend command resolves to `undefined` on its first call while its token
  // command already returns a real stream (measured, Session 89). The provider guards against
  // pairing them, but the guarantee belongs HERE: this module's whole contract is that the
  // worst a broken server may ever do to a `.qmd` is leave it with TextMate colouring, and a
  // `legend.tokenTypes` dereference on `undefined` would instead throw out of the provider and
  // strip the WHOLE document — every other language included.
  if (
    legend === undefined ||
    legend === null ||
    !Array.isArray(legend.tokenTypes) ||
    !Array.isArray(legend.tokenModifiers) ||
    !(data instanceof Uint32Array)
  ) {
    return [];
  }
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
