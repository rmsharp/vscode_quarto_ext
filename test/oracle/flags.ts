/**
 * A MIRROR of the cell-option loop in `src/features/yaml-value-diagnostics.ts`.
 *
 * ⚠ THIS IS A COPY, AND THAT IS THE ORACLE'S PRINCIPAL WEAKNESS. The feature itself
 * imports `vscode` and takes a `vscode.TextDocument`, so it cannot be called from a
 * headless harness; the only way to replay "what would we flag?" is to re-walk the same
 * steps over the same core modules. If that loop changes and this one does not, the oracle
 * keeps reporting confident numbers about a decision the product no longer makes.
 *
 * Two things hold the copy honest, neither of them sufficient alone:
 *   - every step below is pinned against the REAL core modules in
 *     `test/unit/oracle-flags.test.ts`, so a step that silently stops doing anything fails;
 *   - the step order and the reasons for each `continue` are kept verbatim from the
 *     feature, so a diff of the two loops is readable side by side.
 *
 * The principled fix is to lift this decision into `src/core/` and have BOTH the feature
 * and this harness call it — filed in BACKLOG.md, deliberately not done here because it is
 * a production refactor and SAFEGUARDS puts those behind plan-mode approval.
 *
 * SCOPE: the cell-option surface only. The feature also validates top-level and nested
 * front-matter scalars and the format NAME; this harness's corpus is about engine scoping,
 * which is a cell-option question. A corpus row that turns on a front-matter value would
 * be scored wrong here — see the README.
 */
import type * as QmdModel from "../../src/core/qmd/model";
import type * as FrontMatterValues from "../../src/core/yaml-frontmatter-values";
import type * as NestedValues from "../../src/core/yaml-frontmatter-nested-values";
import type * as YamlContext from "../../src/core/yaml-context";
import type * as DocumentEngine from "../../src/core/document-engine";
import type * as ValueCheck from "../../src/core/yaml-value-check";
import type * as ValidateYaml from "../../src/core/validate-yaml";
import type { SchemaIndex } from "../../src/core/yaml-schema";

/**
 * The core surface the flag decision needs, passed in rather than imported, so the same
 * mirror can be pointed at ANY build's `src/` (see `load.ts`). The types are taken from
 * the CURRENT tree on purpose: if an older build's signature differs, that is a real
 * incompatibility and should surface rather than be papered over.
 */
export interface OracleCoreApi {
  findCellOptionLines: typeof QmdModel.findCellOptionLines;
  frontMatterContentLines: typeof QmdModel.frontMatterContentLines;
  findFrontMatterTopLevelLines: typeof FrontMatterValues.findFrontMatterTopLevelLines;
  findFrontMatterValueLines: typeof FrontMatterValues.findFrontMatterValueLines;
  findNestedFrontMatterValueLines: typeof NestedValues.findNestedFrontMatterValueLines;
  documentEngineForScoping: typeof DocumentEngine.documentEngineForScoping;
  cellOptionScopeFor: typeof YamlContext.cellOptionScopeFor;
  mappingColonAt: typeof YamlContext.mappingColonAt;
  valueSlotAfterColon: typeof YamlContext.valueSlotAfterColon;
  isWrongValue: typeof ValueCheck.isWrongValue;
  isValidationDisabledByFrontMatter: typeof ValidateYaml.isValidationDisabledByFrontMatter;
  cellsWithValidationDisabled: typeof ValidateYaml.cellsWithValidationDisabled;
}

/**
 * Every cell-option line this feature would squiggle in `text`, as `line:key=value`.
 *
 * The step order below mirrors `computeValueDiagnostics` exactly; each `continue` keeps
 * the feature's own reason so the two can be read against each other.
 */
export function cellOptionFlags(
  text: string,
  fileName: string,
  api: OracleCoreApi,
  index: SchemaIndex,
): string[] {
  const lines = text.split(/\r?\n/);
  const cellLines = api.findCellOptionLines(text);
  const fmValueLines = api.findFrontMatterValueLines(text);
  const nestedLines = api.findNestedFrontMatterValueLines(text);

  // Quarto's documented escape hatch (S163). Omitted by S165's scratchpad copy — its
  // corpus contained no document that used the flag, so the gap never showed.
  const documentValidationOff = api.isValidationDisabledByFrontMatter(fmValueLines);
  const optedOutCells = api.cellsWithValidationDisabled(cellLines, lines);

  // The DOCUMENT's engine (S164 override + S165 language fallback), resolved once because
  // the engine IS a document-level fact. `findFrontMatterTopLevelLines`, not `fmValueLines`:
  // a key can select an engine without carrying a scalar (`jupyter:` above a kernelspec).
  const documentEngine = api.documentEngineForScoping(
    fileName,
    api.findFrontMatterTopLevelLines(text),
    nestedLines,
    api.frontMatterContentLines(text),
    text,
  );

  const out: string[] = [];
  for (const cell of cellLines) {
    if (documentValidationOff || optedOutCells.has(cell.cellStartLine)) {
      continue; // quarto validates nothing in this cell — grounded firsthand, exit 0
    }
    if (cell.keySlot === null || cell.valueSlot === null) {
      continue; // block-sequence item, or no `:` yet — no value to validate
    }
    const lineText = lines[cell.line] ?? "";
    // Re-derive from the real YAML separator, not from the FIRST colon `slotsOf` used:
    // `#| echo:: banana` is a mapping whose key is `echo:`, which quarto renders exit 0.
    const sep = api.mappingColonAt(lineText, cell.keySlot.startCol);
    if (sep < 0) {
      continue; // no separator anywhere (`#| echo:banana`) — quarto exit 1, a safe FN
    }
    const optionKey = lineText.slice(cell.keySlot.startCol, sep).replace(/[ \t]+$/, "");
    // Clamp to where the directive's YAML CONTENT ends, so a block-comment language's
    // closing delimiter (`/*| echo: false */`) is not sliced into the value.
    const rawSlot = api.valueSlotAfterColon(lineText, sep);
    const endCol = Math.max(rawSlot.startCol, Math.min(rawSlot.endCol, cell.contentEndCol));
    const rawToken = lineText.slice(rawSlot.startCol, endCol);
    if (optionKey.length === 0 || rawToken.length === 0) {
      continue; // key or value still being typed
    }
    // `cellOptionScopeFor`, NOT `engineFor`: an undeterminable engine must narrow to the
    // engine-agnostic intersection, never widen to the full set.
    const field = index
      .cellOptions(api.cellOptionScopeFor(cell.cellLang, documentEngine))
      .find((f) => f.name === optionKey);
    if (field === undefined || !api.isWrongValue(rawToken, field)) {
      continue;
    }
    out.push(`${cell.line}:${optionKey}=${rawToken}`);
  }
  return out;
}
