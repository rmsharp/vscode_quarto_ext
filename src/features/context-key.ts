/**
 * The host's `setContext`, behind core's setter (BACKLOG: "What Session 342's review round found beside the typing-path cures", the context-key
 * setter). The ONE place the extension sends `setContext` for a key it sets on the typing path: `features/execution.ts` (`quarto.inCodeCell`) and
 * `features/preview.ts` (`quartoRenderScriptActive`) each make one setter in their register function and hand it to their update function.
 *
 * The send RETURNS the command's result (an expression body, no `void`): the setter reads a rejection off it and forgets the key, so the next call
 * sends again. `test/unit/s343-adapter-wiring-pin.test.ts` pins that, from the syntax tree; no unit test can run this file (it imports `vscode`).
 */

import * as vscode from "vscode";
import { type ContextKeySetter, createContextKeySetter } from "../core/context-key-setter";

/** A setter over the host's `setContext`: one per feature, made when the feature registers, so each keeps the values it last sent. */
export function createVscodeContextKeySetter(): ContextKeySetter {
  return createContextKeySetter((key, value) =>
    vscode.commands.executeCommand("setContext", key, value),
  );
}
