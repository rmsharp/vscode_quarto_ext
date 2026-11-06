/**
 * Which editors the cell tint is re-applied to, vscode-free (BACKLOG: "What Session 342's review round found beside the typing-path cures", the cell-background refresh plan).
 *
 * `CellBackgroundDecorator.refresh()` (`features/cell-background.ts`) re-applied the tint to EVERY visible editor: it read the text of every visible Quarto editor, built every `Range` and sent
 * `setDecorations` for each. The document-event handler schedules it for any VISIBLE document, so a keystroke in a `.py` beside a large `.qmd` armed a timer, and one refresh() that read the
 * `.qmd`'s text again, built its ranges again and re-applied a tint that the keystroke could not have changed.
 *
 * THIS COMMIT IS THE SEAM: the apply loop of `refresh()` lives here, behind the interface the adapter now calls, and the plan it asks (`editorsToRefresh`) still answers every visible editor for any
 * trigger, as `refresh()` did, so the adapter can be moved onto it with nothing observable changing; the rows that count the applies are written against this, then the plan is made.
 */

/** A visible editor as the plan sees it: the key of its document (the document's URI as a string), the document's language id, and the editor itself, which the plan never looks into. */
export interface VisibleEditor<E> {
  readonly key: string;
  readonly languageId: string;
  readonly editor: E;
}

/** The document an edit changed: its key (as an editor's `key` is) and its language id as it is now. */
export interface EditedDocument {
  readonly key: string;
  readonly languageId: string;
}

/**
 * The editors to re-apply the tint to, in their order. `edited` is the document an edit changed, or `undefined` for every trigger that is not an edit of one document (an active-editor change,
 * a visible-editors change, a settings change, a reload, the activation), which refresh every visible editor. `tinted` is the set of keys of the editors that hold a non-empty tint now.
 */
export function editorsToRefresh<T extends { readonly key: string; readonly languageId: string }>(_edited: EditedDocument | undefined, editors: readonly T[], _tinted: ReadonlySet<string>): T[] {
  return [...editors];
}

export interface CellBackgroundRefresherOptions<E, R> {
  /** The visible editors now. Read at each refresh. */
  visible(): ReadonlyArray<VisibleEditor<E>>;
  /** The ranges to tint in `editor`, none when it is not to be tinted. Called once for each editor refreshed: it is where the document's text is read. */
  rangesFor(editor: E): R[];
  /** Hand `ranges` to the editor (an empty list clears its tint). Called once for each editor refreshed. */
  apply(editor: E, ranges: R[]): void;
}

export interface CellBackgroundRefresher<R> {
  /** Re-apply the tint to every visible editor; the ranges applied, per editor key. */
  refreshAll(): Map<string, R[]>;
  /** Re-apply the tint to the editors that an edit of `edited` can have changed; the ranges applied, per editor key. */
  refreshAfterEdit(edited: EditedDocument): Map<string, R[]>;
}

export function createCellBackgroundRefresher<E, R>(options: CellBackgroundRefresherOptions<E, R>): CellBackgroundRefresher<R> {
  const tinted = new Set<string>();
  const run = (edited: EditedDocument | undefined): Map<string, R[]> => {
    const applied = new Map<string, R[]>();
    for (const entry of editorsToRefresh(edited, options.visible(), tinted)) {
      const ranges = options.rangesFor(entry.editor);
      options.apply(entry.editor, ranges);
      applied.set(entry.key, ranges);
    }
    return applied;
  };
  return {
    refreshAll: () => run(undefined),
    refreshAfterEdit: (edited) => run(edited),
  };
}
