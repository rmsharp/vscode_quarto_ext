/**
 * Which editors the cell tint is re-applied to, vscode-free (BACKLOG: "What Session 342's review round found beside the typing-path cures", the cell-background refresh plan).
 *
 * `CellBackgroundDecorator.refresh()` (`features/cell-background.ts`) re-applied the tint to EVERY visible editor: it read the text of every visible Quarto editor, built every `Range` and sent
 * `setDecorations` for each. The document-event handler schedules it for any VISIBLE document, so a keystroke in a `.py` beside a large `.qmd` armed a timer, and one refresh() that read the
 * `.qmd`'s text again, built its ranges again and re-applied a tint that the keystroke could not have changed.
 *
 * The rule (`editorsToRefresh`): an edit of document D refreshes only the editors of D (two editors of one document are both refreshed); it refreshes NOTHING when D is not a quarto document and holds no
 * tint, so a document that WAS quarto and was tinted still has its tint cleared by its next edit; every other trigger (the active editor, the visible editors, the settings, a reload, the activation) refreshes
 * every visible editor. The refresher records which editors received a non-empty tint at their last apply (the `tinted` set the rule reads), editor by editor as it applies, so an error midway leaves the record
 * of what it did apply; a full refresh also forgets the keys that are no longer shown.
 *
 * What an edit can no longer do is refresh ANOTHER document's editor: a document turned into another language ("Change Language Mode" is no edit and no editor event) is cleared by its own next edit or by
 * the next full refresh, not by a keystroke in a different file as before.
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
export function editorsToRefresh<T extends { readonly key: string; readonly languageId: string }>(edited: EditedDocument | undefined, editors: readonly T[], tinted: ReadonlySet<string>): T[] {
  if (edited === undefined) {
    return [...editors];
  }
  if (edited.languageId !== "quarto" && !tinted.has(edited.key)) {
    return [];
  }
  return editors.filter((editor) => editor.key === edited.key);
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
    const shown = options.visible();
    for (const entry of editorsToRefresh(edited, shown, tinted)) {
      const ranges = options.rangesFor(entry.editor);
      options.apply(entry.editor, ranges);
      applied.set(entry.key, ranges);
      if (ranges.length > 0) {
        tinted.add(entry.key);
      } else {
        tinted.delete(entry.key);
      }
    }
    if (edited === undefined) {
      // A full refresh has seen every editor there is: a key with none shown holds no tint any more.
      const keys = new Set(shown.map((entry) => entry.key));
      for (const key of [...tinted]) {
        if (!keys.has(key)) {
          tinted.delete(key);
        }
      }
    }
    return applied;
  };
  return {
    refreshAll: () => run(undefined),
    refreshAfterEdit: (edited) => run(edited),
  };
}
