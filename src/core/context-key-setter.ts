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
 *
 * A send that FAILS is forgotten, so the next set sends again, whatever its value: when `send` throws (the error propagates, and the key is unremembered even if it held
 * another value before), and when `send` returns a thenable that rejects (the host's `executeCommand` returns a `Thenable`; the setter handles the rejection itself, as the
 * adapters' `void executeCommand(...)` left it unhandled, and a late rejection of an OLDER send forgets nothing newer: the entry is compared by identity, not by value).
 * A thenable that resolves, and a result that is not a thenable, leave the value remembered.
 */

/** What a setter sends: the host's `setContext` for a key, whose result (a promise, a thenable, nothing) the setter may use. */
export type SendContextKey = (key: string, value: boolean) => unknown;

/** Set the context `key` to `value`. */
export type ContextKeySetter = (key: string, value: boolean) => void;

export function createContextKeySetter(send: SendContextKey): ContextKeySetter {
  // The value last SENT per key, held in an object of its own: a rejection of an older send forgets the key only if the entry is still the one that send made.
  const sent = new Map<string, { readonly value: boolean }>();
  return (key, value) => {
    if (sent.get(key)?.value === value) {
      return;
    }
    let result: unknown;
    try {
      result = send(key, value);
    } catch (error) {
      // The host did not take the value, and nothing says what it holds now: the key is unremembered, so the next set sends.
      sent.delete(key);
      throw error;
    }
    const entry = { value };
    sent.set(key, entry);
    if (isThenable(result)) {
      result.then(undefined, () => {
        if (sent.get(key) === entry) {
          sent.delete(key);
        }
      });
    }
  };
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (typeof value === "object" || typeof value === "function") && value !== null && typeof (value as { then?: unknown }).then === "function";
}
