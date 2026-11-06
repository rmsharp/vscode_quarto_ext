/**
 * Setting a context key, vscode-free (BACKLOG: "What Session 342's review round found beside the typing-path cures", the context-key setter).
 *
 * `updateCellContext` (`features/execution.ts`) and `updateRenderScriptContext` (`features/preview.ts`) sent `setContext` to the host on EVERY event
 * of the active editor, whatever the value: a selection event, a document event, a keystroke. Each send is a round trip to the renderer that
 * cannot be timed from a headless test, but can be COUNTED, and almost all of them say what the last one said (`quarto.inCodeCell` stays true for
 * every keystroke typed inside one cell, `quartoRenderScriptActive` stays false for every keystroke in a plain `.py`).
 *
 * The setter sends a key's value the first time it is set (a first `false` included: the host has no value for the key yet) and again only when the value
 * is not the one it last SENT for that key; keys are independent, and each setter remembers only its own sends (one per feature, made in the register function).
 */

/** What a setter sends: the host's `setContext` for a key, whose result (a promise, a thenable, nothing) the setter may use. */
export type SendContextKey = (key: string, value: boolean) => unknown;

/** Set the context `key` to `value`. */
export type ContextKeySetter = (key: string, value: boolean) => void;

export function createContextKeySetter(send: SendContextKey): ContextKeySetter {
  const sent = new Map<string, boolean>();
  return (key, value) => {
    if (sent.get(key) === value) {
      return;
    }
    send(key, value);
    sent.set(key, value);
  };
}
