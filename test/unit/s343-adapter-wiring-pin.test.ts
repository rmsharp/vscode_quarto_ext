import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as ts from "typescript";

// Session 343, parts (2) to (4) of "What Session 342's review round found beside the typing-path cures". `src/features/execution.ts`, `preview.ts`, `cell-background.ts` and `context-key.ts` import `vscode`, so no unit test can
// run them: how they call the core functions this session adds is pinned here by their SOURCE, read with the TypeScript compiler API (`ts.createSourceFile`, then the syntax tree), not with a text search (Learning 911).
// A comment, a string or an unused identifier can neither satisfy nor break a pin made this way. `s342-typing-wiring-pin.test.ts` is the model, and still pins the handlers, the scheduler and the debouncer these pins sit beside.
//
// ⚠ WHAT THIS DOES NOT SEE. It pins how the call sites are SPELLED. It does not run the adapters, and nothing else does: no test, unit or integration, observes a context key's value (VS Code offers no read-back), counts the
// `setContext` round trips, or reads an applied decoration. The behaviour the spelling stands for is the core modules' own rows (`context-key-setter.test.ts`) and the equivalence rows beside them.
//
// Each group is a function `problemsIn...(source)` that names every pin the source breaks. The live files must have none, and the rows at the end hand each the live file with ONE edit (the edits are the mutants of
// `tools/mutation-run/mutants/s343-*.json`) and require it to name the pin that edit breaks: the pin can fail, and says which.

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
/** A source file of the tree, or "" when it is not there: a pin on a file that does not exist fails by NAME ("... is missing"), not by an unreadable file. */
const read = (...parts: string[]): string => (existsSync(resolve(root, ...parts)) ? readFileSync(resolve(root, ...parts), "utf8") : "");
const EXECUTION = read("src", "features", "execution.ts");
const PREVIEW = read("src", "features", "preview.ts");
const CONTEXT_KEY = read("src", "features", "context-key.ts");

const parse = (name: string, source: string): ts.SourceFile => ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

/** Every node under `node` (itself included) that `test` accepts, in source order. */
function collect<T extends ts.Node>(node: ts.Node, test: (n: ts.Node) => n is T): T[] {
  const found: T[] = [];
  const visit = (n: ts.Node): void => {
    if (test(n)) found.push(n);
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

/** The text of a node with every run of whitespace collapsed: a syntax node's own spelling, not a search over the file. */
const flat = (node: ts.Node, sf: ts.SourceFile): string => node.getText(sf).replace(/\s+/g, " ");
const isCall = (n: ts.Node): n is ts.CallExpression => ts.isCallExpression(n);
/** The nearest function-like node around `node`. */
function enclosingFunction(node: ts.Node): ts.Node | undefined {
  for (let up = node.parent; up !== undefined; up = up.parent) {
    if (ts.isFunctionDeclaration(up) || ts.isMethodDeclaration(up) || ts.isArrowFunction(up) || ts.isFunctionExpression(up)) return up;
  }
  return undefined;
}
const functionNamed = (sf: ts.SourceFile, name: string): ts.FunctionDeclaration | undefined =>
  collect(sf, (n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && n.name?.text === name)[0];
/** The call `callee(...)` anywhere under `node`, every one. */
const callsOf = (node: ts.Node, sf: ts.SourceFile, callee: string): ts.CallExpression[] => collect(node, isCall).filter((call) => flat(call.expression, sf) === callee);
/** The names a parameter list declares, as written. */
const parameterNames = (fn: ts.FunctionDeclaration | ts.ArrowFunction, sf: ts.SourceFile): string[] => fn.parameters.map((p) => flat(p.name, sf));
/** The properties `name: initializer` of an object literal, as written. */
function propertiesOf(object: ts.Expression | undefined, sf: ts.SourceFile): Record<string, string> {
  const found: Record<string, string> = {};
  if (object !== undefined && ts.isObjectLiteralExpression(object)) {
    for (const p of object.properties) {
      if (ts.isPropertyAssignment(p)) found[flat(p.name, sf)] = flat(p.initializer, sf);
    }
  }
  return found;
}
/** `const <name> = <call of callee>` directly among the statements of `fn` (so the object is made once per register call, not per event): a problem text, or undefined. */
function madeDirectlyIn(fn: ts.FunctionDeclaration, sf: ts.SourceFile, name: string, callee: string): string | undefined {
  const makes = callsOf(fn, sf, callee);
  if (makes.length !== 1) return `${makes.length} calls of ${callee} in ${fn.name?.text ?? "the function"}, not one`;
  const declaration = makes[0].parent;
  if (!(ts.isVariableDeclaration(declaration) && flat(declaration.name, sf) === name && declaration.parent.parent.parent === fn.body)) {
    return `${callee}() is not the initializer of \`const ${name}\` among the statements of ${fn.name?.text ?? "the function"} (made inside a handler it would keep no state between events)`;
  }
  return undefined;
}

// ---- PART (3): THE CONTEXT-KEY SETTER --------------------------------------------------------------------------------------------------------------------------------------------------------------

/** Every pin `src/features/context-key.ts` breaks: the ONE place that sends `setContext`, and sends it through core's setter with the result returned. */
function problemsInContextKeyAdapter(source: string): string[] {
  const sf = parse("context-key.ts", source);
  const problems: string[] = [];
  const make = functionNamed(sf, "createVscodeContextKeySetter");
  if (make === undefined || make.body === undefined) return ["createVscodeContextKeySetter is missing"];
  if (make.parameters.length !== 0) problems.push("createVscodeContextKeySetter takes a parameter (one setter per call, over the host's own command)");
  const imports = collect(sf, (n): n is ts.ImportDeclaration => ts.isImportDeclaration(n)).filter((i) => ts.isStringLiteral(i.moduleSpecifier) && i.moduleSpecifier.text === "../core/context-key-setter");
  if (imports.length !== 1) problems.push("context-key.ts does not import ../core/context-key-setter exactly once");
  const makes = callsOf(sf, sf, "createContextKeySetter");
  if (makes.length !== 1) {
    problems.push(`${makes.length} calls of createContextKeySetter, not one`);
  } else {
    const returns = collect(make.body, (n): n is ts.ReturnStatement => ts.isReturnStatement(n));
    if (returns.length !== 1 || returns[0].expression !== makes[0]) problems.push("createVscodeContextKeySetter does not return `createContextKeySetter(...)` itself");
    const send = makes[0].arguments[0];
    if (makes[0].arguments.length !== 1 || send === undefined || !ts.isArrowFunction(send)) {
      problems.push("createContextKeySetter is not given exactly one arrow function (the send)");
    } else {
      // The send RETURNS the command's result: that is what lets the setter see a rejection and forget the key. A block body, or a `void`, drops it.
      const [key, value] = parameterNames(send, sf);
      if (send.parameters.length !== 2) problems.push("the send does not take (key, value)");
      if (!ts.isCallExpression(send.body)) {
        problems.push("the send's body is not the executeCommand call itself (a block or a `void` drops the result, and a rejected setContext would never be forgotten)");
      } else if (flat(send.body.expression, sf) !== "vscode.commands.executeCommand" || send.body.arguments.map((a) => flat(a, sf)).join() !== `"setContext",${key},${value}`) {
        problems.push('the send is not `vscode.commands.executeCommand("setContext", key, value)` with its own parameters');
      }
    }
  }
  if (callsOf(sf, sf, "vscode.commands.executeCommand").length !== 1) problems.push("context-key.ts does not call executeCommand exactly once");
  return problems;
}

/** Every pin `execution.ts` breaks about the setter: made once in the register function, handed to the evaluator, which sets the key through it and not through the host. */
function problemsInExecutionSetter(source: string): string[] {
  const sf = parse("execution.ts", source);
  const problems: string[] = [];
  const register = functionNamed(sf, "registerExecutionFeature");
  const update = functionNamed(sf, "updateCellContext");
  if (register === undefined || register.body === undefined) return ["registerExecutionFeature is missing"];
  if (update === undefined || update.body === undefined) return ["updateCellContext is missing"];
  const made = madeDirectlyIn(register, sf, "setContextKey", "createVscodeContextKeySetter");
  if (made !== undefined) problems.push(made);
  if (callsOf(sf, sf, "createContextKeySetter").length !== 0) problems.push("execution.ts calls createContextKeySetter itself (the send must be the host's, which context-key.ts owns)");
  // The scheduler's evaluator hands the setter to the update function.
  const schedulers = callsOf(register, sf, "createCellContextScheduler");
  const options = schedulers.length === 1 ? propertiesOf(schedulers[0].arguments[0], sf) : {};
  if (options.evaluate !== "() => updateCellContext(setContextKey)") problems.push("the scheduler's evaluate is not `() => updateCellContext(setContextKey)` (the update function is handed the register function's setter)");
  // The update function takes the setter, sets the key through it once, and never reaches the host's command.
  if (parameterNames(update, sf).join() !== "setContextKey") problems.push("updateCellContext does not take exactly the parameter `setContextKey`");
  const sets = callsOf(update.body, sf, "setContextKey");
  if (sets.length !== 1) {
    problems.push(`${sets.length} calls of setContextKey in updateCellContext, not one`);
  } else if (sets[0].arguments.map((a) => flat(a, sf)).join() !== "IN_CELL_CONTEXT,inCell") {
    problems.push("updateCellContext does not call setContextKey(IN_CELL_CONTEXT, inCell) (the key is set to the answer, not to its negation or to another key)");
  }
  if (callsOf(update.body, sf, "vscode.commands.executeCommand").length !== 0) problems.push("updateCellContext calls executeCommand itself (a round trip on every event, whatever the value)");
  return problems;
}

/** Every pin `preview.ts` breaks about the setter. */
function problemsInPreviewSetter(source: string): string[] {
  const sf = parse("preview.ts", source);
  const problems: string[] = [];
  const register = functionNamed(sf, "registerPreviewFeature");
  const update = functionNamed(sf, "updateRenderScriptContext");
  if (register === undefined || register.body === undefined) return ["registerPreviewFeature is missing"];
  if (update === undefined || update.body === undefined) return ["updateRenderScriptContext is missing"];
  const made = madeDirectlyIn(register, sf, "setContextKey", "createVscodeContextKeySetter");
  if (made !== undefined) problems.push(made);
  if (callsOf(sf, sf, "createContextKeySetter").length !== 0) problems.push("preview.ts calls createContextKeySetter itself (the send must be the host's, which context-key.ts owns)");
  // Every call of the update function is in the register function and hands it the setter: the active-editor handler, the document handler and the activation-time call.
  const calls = callsOf(sf, sf, "updateRenderScriptContext");
  if (calls.length !== 3) problems.push(`${calls.length} calls of updateRenderScriptContext, not three (the active-editor handler, the document handler, the activation-time call)`);
  for (const call of calls) {
    if (enclosingFunction(call) !== register && !(enclosingFunction(call) !== undefined && enclosingFunction(enclosingFunction(call) as ts.Node) === register)) problems.push("a call of updateRenderScriptContext is outside registerPreviewFeature");
    if (call.arguments.length !== 2 || flat(call.arguments[1], sf) !== "setContextKey") problems.push("a call of updateRenderScriptContext does not hand it `setContextKey` as its second argument");
  }
  if (parameterNames(update, sf).join() !== "editor,setContextKey") problems.push("updateRenderScriptContext does not take exactly (editor, setContextKey)");
  const sets = callsOf(update.body, sf, "setContextKey");
  if (sets.length !== 1) {
    problems.push(`${sets.length} calls of setContextKey in updateRenderScriptContext, not one`);
  } else if (sets[0].arguments.map((a) => flat(a, sf)).join() !== "RENDER_SCRIPT_CONTEXT,isPreviewableRenderScript(editor?.document)") {
    problems.push("updateRenderScriptContext does not call setContextKey(RENDER_SCRIPT_CONTEXT, isPreviewableRenderScript(editor?.document))");
  }
  if (callsOf(update.body, sf, "vscode.commands.executeCommand").length !== 0) problems.push("updateRenderScriptContext calls executeCommand itself (a round trip on every keystroke, whatever the value)");
  return problems;
}

describe("Session 343 -- how the adapters call the context-key setter, pinned by the syntax tree (a unit test cannot run them: they import vscode)", () => {
  it("context-key.ts keeps every pin: one send, the host's setContext, its result returned to core's setter", () => {
    expect(problemsInContextKeyAdapter(CONTEXT_KEY)).toEqual([]);
  });

  it("execution.ts keeps every setter pin: made once in the register function, handed to the evaluator, the key set through it", () => {
    expect(problemsInExecutionSetter(EXECUTION)).toEqual([]);
  });

  it("preview.ts keeps every setter pin: made once in the register function, handed to all three updates, the key set through it", () => {
    expect(problemsInPreviewSetter(PREVIEW)).toEqual([]);
  });
});
