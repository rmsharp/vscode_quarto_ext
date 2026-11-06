/**
 * Setting a context key, vscode-free (BACKLOG: "What Session 342's review round found beside the typing-path cures", the context-key setter).
 *
 * `updateCellContext` (`features/execution.ts`) and `updateRenderScriptContext` (`features/preview.ts`) sent `setContext` to the host on EVERY event
 * of the active editor, whatever the value: a selection event, a document event, a keystroke. Each send is a round trip to the renderer that
 * cannot be timed from a headless test, but can be COUNTED, and almost all of them say what the last one said (`quarto.inCodeCell` stays true for
 * every keystroke typed inside one cell, `quartoRenderScriptActive` stays false for every keystroke in a plain `.py`).
 *
 * THIS COMMIT IS THE SEAM: the setter sends on every call, as the adapters did, so the adapters can be moved onto it with nothing observable
 * changing; the rows that count the sends are written against this, then the dedupe is added.
 */

/** What a setter sends: the host's `setContext` for a key, whose result (a promise, a thenable, nothing) the setter may use. */
export type SendContextKey = (key: string, value: boolean) => unknown;

/** Set the context `key` to `value`. */
export type ContextKeySetter = (key: string, value: boolean) => void;

export function createContextKeySetter(send: SendContextKey): ContextKeySetter {
  return (key, value) => {
    send(key, value);
  };
}
