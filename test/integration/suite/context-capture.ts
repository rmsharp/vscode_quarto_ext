import * as vscode from "vscode";

// Shared by the integration suites that observe the `setContext` calls the extension makes (VS Code offers no way to
// read a context key back): `preview-script.test.ts` (`quartoRenderScriptActive`) and `in-code-cell.test.ts`
// (`quarto.inCodeCell`). Moved out of `preview-script.test.ts` unchanged in Session 343.
//
// ⚠ IT SEES ONLY WHAT THE EXTENSION SENDS, and since Session 343 the extension sends a key only when its value CHANGES (`core/context-key-setter`). A row
// that expects a value must make it a TRANSITION inside the capture: settle the key at the opposite value first (outside the capture, or by showing a
// document that gives it), then do what moves it. A row that opens a document whose value is the one the key already has captures nothing, and
// `lastValueFor` answers `undefined` (the review round of Session 343 found four rows of `preview-script.test.ts` written the other way).

export interface ContextCall {
  key: string;
  value: unknown;
}

/**
 * Capture `setContext` calls.
 *
 * VS Code offers NO way to read a context key back — `setContext` is a
 * write-only command and there is no `getContext` API — so the only faithful
 * observation point is the `executeCommand` call the extension itself makes.
 * We intercept it, RECORD the call, and still delegate to the real
 * implementation so the key genuinely updates (unlike create-project.test.ts's
 * `vscode.openFolder` interception, which must SUPPRESS the real call because it
 * would reload the window mid-suite; the mechanism is otherwise identical, and
 * is the established precedent for this in the repo).
 */
export async function withContextCapture<T>(
  captured: ContextCall[],
  body: () => Promise<T>,
): Promise<T> {
  const commandsAny = vscode.commands as unknown as Record<string, unknown>;
  const original = commandsAny.executeCommand as (
    command: string,
    ...rest: unknown[]
  ) => Thenable<unknown>;
  commandsAny.executeCommand = (command: string, ...rest: unknown[]) => {
    if (command === "setContext") {
      captured.push({ key: rest[0] as string, value: rest[1] });
    }
    return original(command, ...rest);
  };
  try {
    return await body();
  } finally {
    commandsAny.executeCommand = original;
  }
}

/** The most recent value the extension pushed for `key` (`undefined` if never). */
export function lastValueFor(captured: ContextCall[], key: string): unknown {
  const hits = captured.filter((c) => c.key === key);
  return hits.length > 0 ? hits[hits.length - 1].value : undefined;
}
