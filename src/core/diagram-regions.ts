/**
 * Pure, `vscode`-free detector for diagram code cells in a Quarto `.qmd`.
 *
 * Like the rest of `core/`, this module MUST NOT import `vscode` (architecture
 * plan §3.3 guardrail) and is unit-tested headlessly. It is the source of truth
 * for the diagram-preview feature (plan §6 Phase 7): it locates the executable
 * diagram cells Quarto knows how to draw — ```` ```{mermaid} ```` (Mermaid) and
 * ```` ```{dot} ```` (Graphviz) — so the webview adapter can render each one.
 *
 * Detection is a thin filter over the shared cell model (`findAllCells` from
 * `core/qmd/model`): there is no second scanner to drift out of agreement with
 * the outline / cross-ref / math consumers (Learning #14). Because `findAllCells`
 * only matches a brace-wrapped, letter-led info string, the non-executable forms
 * — a plain ```` ```mermaid ```` fence, the ```` ```{{mermaid}} ```` display
 * form, a ```` ```{.dot} ```` Pandoc class block — are excluded automatically,
 * exactly as Quarto excludes them from diagram rendering.
 *
 * ✅ **CLOSED, Session 172.** This block used to record a known limitation: the
 * shared `CELL_INFO` captured the first letter-led token greedily and then accepted
 * any trailing characters, so a MALFORMED info string gluing the engine name to
 * `=`/`#`/`.` — ```` ```{mermaid=x} ````, ```` ```{dot=1} ````,
 * ```` ```{mermaid#id} ````, ```` ```{mermaid.foo} ```` — was reported here as a
 * diagram even though Quarto draws none of them. `CELL_INFO` now carries quarto's
 * own grammar (`[=A-Za-z]` with a `( *[ ,].*)?` tail), so all four are excluded and
 * `findDiagramRegions` needs no filter of its own.
 *
 * The old fix sketch — "require the engine token to end at whitespace, a comma, or
 * `}`" — would have been WRONG on one of its own four examples, and that is worth
 * keeping. `{mermaid=x}` is a real cell to quarto whose language is literally
 * `mermaid=x` (its `#| echo: banana` renders exit 1); it is not a diagram because
 * `mermaid=x` is absent from `handlers/languages.yml`, not because it is not a cell.
 * Ending the token at `=` would have kept the language `mermaid` and left it drawn
 * here. The two exclusions therefore have DIFFERENT mechanisms — `{dot=1}`,
 * `{mermaid#id}` and `{mermaid.foo}` are not cells at all; `{mermaid=x}` is a cell
 * of another language — and only matching quarto's capture gets both right.
 */

import { findAllCells } from "./qmd/model";

/** The diagram engines Quarto can draw and this feature can preview. */
export type DiagramEngine = "mermaid" | "dot";

/** Cell info-string languages that map to a previewable diagram engine. */
const DIAGRAM_ENGINES: readonly DiagramEngine[] = ["mermaid", "dot"];

/** The diagram engine for a cell language, or `undefined` if it is not one. */
function engineFor(lang: string): DiagramEngine | undefined {
  return DIAGRAM_ENGINES.find((e) => e === lang);
}

/** A located diagram code cell. Line indices are 0-based. */
export interface DiagramRegion {
  /** `mermaid` for ```` ```{mermaid} ````, `dot` for ```` ```{dot} ```` (Graphviz). */
  engine: DiagramEngine;
  /** The cell body (lines between the fences), joined with `\n`; `""` if empty. */
  code: string;
  /** 0-based line of the opening fence. */
  startLine: number;
  /** 0-based line of the closing fence (or the last line if unterminated). */
  endLine: number;
}

/** Find every Mermaid/Graphviz diagram cell in `text`, in document order. */
export function findDiagramRegions(text: string): DiagramRegion[] {
  const out: DiagramRegion[] = [];
  for (const cell of findAllCells(text)) {
    const engine = engineFor(cell.lang);
    if (engine) {
      out.push({
        engine,
        code: cell.code,
        startLine: cell.startLine,
        endLine: cell.endLine,
      });
    }
  }
  return out;
}
