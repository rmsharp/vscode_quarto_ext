import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as ts from "typescript";

// Session 342, part (4). `src/features/execution.ts` and `src/features/cell-background.ts` import `vscode`, so no unit test can run them: how they call the typing-path schedulers of
// `src/core/typing-debounce.ts` is pinned here by their SOURCE, read with the TypeScript compiler API (`ts.createSourceFile`, then the syntax tree), not with a text search (Learning 911). A comment, a string or an
// unused identifier can neither satisfy nor break a pin made this way.
//
// ⚠ WHAT THIS DOES NOT SEE. It pins how the call sites are SPELLED: which handler calls which scheduler method, that no handler of the typing path calls anything that scans, that the immediate paths stay immediate and
// that the debounced one is keyed by the document. It does not run the adapters, and NOTHING ELSE DOES: no test, unit or integration, drives the adapters' `onDidChangeTextDocument` and selection wiring through a real
// host, so a key or a tint that stopped following the typing would pass `npm run test:integration`. `test/integration/suite/cell-background.test.ts` applies the tint through `refreshCellBackgroundDecorationsForTesting()`
// (the immediate path, which skips the document handler and `isVisible`; its own header says the `activate()` wiring is not asserted); `execution.test.ts` never observes `quarto.inCodeCell` (its closest row reads
// `activationEvents`); `preview-script.test.ts` sees only that the key is SET on an active-editor change and never reads its value (VS Code offers no way to). The behaviour the spelling stands for, in a copy of the wiring
// against the base's handlers verbatim, is `typing-path-equivalence.test.ts`; the key's VALUE is `in-code-cell.test.ts`.
//
// The checks are two functions, `problemsInExecution(source)` and `problemsInBackground(source)`, which name every pin the source breaks. The live files must have none, and the rows below also hand each the live file with
// ONE edit (the edits are the mutants of `tools/mutation-run/mutants/s342-typing-path.json`) and require it to name the pin that edit breaks: the pin can fail, and says which.

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EXECUTION = readFileSync(resolve(root, "src", "features", "execution.ts"), "utf8");
const BACKGROUND = readFileSync(resolve(root, "src", "features", "cell-background.ts"), "utf8");

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
/** The callee of every call under `node`, as written. */
const calleesIn = (node: ts.Node, sf: ts.SourceFile): string[] => collect(node, isCall).map((call) => flat(call.expression, sf));
/** The nearest function-like node around `node`. */
function enclosingFunction(node: ts.Node): ts.Node | undefined {
  for (let up = node.parent; up !== undefined; up = up.parent) {
    if (ts.isFunctionDeclaration(up) || ts.isMethodDeclaration(up) || ts.isArrowFunction(up) || ts.isFunctionExpression(up)) return up;
  }
  return undefined;
}
const functionNamed = (sf: ts.SourceFile, name: string): ts.FunctionDeclaration | undefined =>
  collect(sf, (n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && n.name?.text === name)[0];
const methodNamed = (sf: ts.SourceFile, cls: string, name: string): ts.MethodDeclaration | undefined => {
  const owner = collect(sf, (n): n is ts.ClassDeclaration => ts.isClassDeclaration(n) && n.name?.text === cls)[0];
  return owner === undefined ? undefined : collect(owner, (n): n is ts.MethodDeclaration => ts.isMethodDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name)[0];
};
const identifiersNamed = (sf: ts.SourceFile, name: string): ts.Identifier[] => collect(sf, (n): n is ts.Identifier => ts.isIdentifier(n) && n.text === name);

/** The call `callee(...)` anywhere under `node`, every one. */
const callsOf = (node: ts.Node, sf: ts.SourceFile, callee: string): ts.CallExpression[] => collect(node, isCall).filter((call) => flat(call.expression, sf) === callee);

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

/** The arrow function handed to `callee(...)` as its first argument, and the call. */
function handlerOf(body: ts.Node, sf: ts.SourceFile, callee: string): { call: ts.CallExpression | undefined; arrow: ts.ArrowFunction | undefined } {
  const calls = callsOf(body, sf, callee);
  const call = calls.length === 1 ? calls[0] : undefined;
  const arrow = call !== undefined && ts.isArrowFunction(call.arguments[0]) ? (call.arguments[0] as ts.ArrowFunction) : undefined;
  return { call, arrow };
}

/** Every pin `execution.ts` breaks, each named by what it was meant to keep. `[]` is a source that keeps them all. */
function problemsInExecution(source: string): string[] {
  const sf = parse("execution.ts", source);
  const problems: string[] = [];
  const register = functionNamed(sf, "registerExecutionFeature");
  if (register === undefined || register.body === undefined) return ["registerExecutionFeature is missing"];

  // 1. ONE scheduler, made directly in the register function over the host's timers and the constant delay, with the snapshot reader and the evaluator the file defines.
  const makes = collect(sf, (n): n is ts.CallExpression => isCall(n) && ts.isIdentifier(n.expression) && n.expression.text === "createCellContextScheduler");
  if (makes.length !== 1) {
    problems.push(`${makes.length} calls of createCellContextScheduler, not one`);
  } else {
    const [make] = makes;
    if (enclosingFunction(make) !== register) problems.push("createCellContextScheduler is not called directly in registerExecutionFeature (inside a handler it would run once per event)");
    const declaration = make.parent;
    if (!(ts.isVariableDeclaration(declaration) && flat(declaration.name, sf) === "cellContext" && declaration.parent.parent.parent === register.body)) {
      problems.push("the scheduler is not the initializer of `const cellContext` among the statements of registerExecutionFeature");
    }
    const options = propertiesOf(make.arguments[0], sf);
    if (options.timers !== "realTimers") problems.push("the scheduler's timers are not realTimers");
    if (options.delayMs !== "TYPING_DEBOUNCE_MS") problems.push("the scheduler's delayMs is not TYPING_DEBOUNCE_MS");
    if (options.activeSnapshot !== "activeDocumentSnapshot") problems.push("the scheduler's activeSnapshot is not activeDocumentSnapshot");
    if (options.evaluate !== "() => updateCellContext(setContextKey)") problems.push("the scheduler's evaluate is not `() => updateCellContext(setContextKey)`");
    if (Object.keys(options).sort().join() !== "activeSnapshot,delayMs,evaluate,maxWaitMs,timers") problems.push(`the scheduler is made with the options ${Object.keys(options).sort().join()}, not activeSnapshot,delayMs,evaluate,maxWaitMs,timers`);
  }

  // 2. The scheduler is disposed with the extension: it is one of the subscriptions pushed.
  const pushes = callsOf(register.body, sf, "context.subscriptions.push");
  if (pushes.length !== 1) {
    problems.push(`${pushes.length} calls of context.subscriptions.push, not one`);
  } else if (!pushes[0].arguments.some((argument) => flat(argument, sf) === "cellContext")) {
    problems.push("cellContext is not among the subscriptions pushed (it would never be disposed)");
  }

  // 3. The selection handler: only the scheduler is called, only for the active editor.
  const selection = handlerOf(register.body, sf, "vscode.window.onDidChangeTextEditorSelection");
  if (selection.arrow === undefined) {
    problems.push("onDidChangeTextEditorSelection is not given an arrow function");
  } else {
    const callees = calleesIn(selection.arrow.body, sf);
    if (callees.join() !== "cellContext.changed") problems.push(`the selection handler calls ${callees.join() || "nothing"}, not only cellContext.changed`);
    const guards = collect(selection.arrow.body, (n): n is ts.IfStatement => ts.isIfStatement(n));
    if (guards.length !== 1 || flat(guards[0].expression, sf) !== "e.textEditor === vscode.window.activeTextEditor") problems.push("the selection handler does not guard on `e.textEditor === vscode.window.activeTextEditor`");
    else if (callsOf(guards[0].thenStatement, sf, "cellContext.changed").length !== 1) problems.push("the selection handler does not call cellContext.changed inside its guard");
  }

  // 4. The active-editor handler: the scheduler's immediate path, and nothing else.
  const active = handlerOf(register.body, sf, "vscode.window.onDidChangeActiveTextEditor");
  if (active.arrow === undefined) {
    problems.push("onDidChangeActiveTextEditor is not given an arrow function");
  } else {
    const callees = calleesIn(active.arrow.body, sf);
    if (callees.join() !== "cellContext.evaluateNow") problems.push(`the active-editor handler calls ${callees.join() || "nothing"}, not only cellContext.evaluateNow`);
  }

  // 5. The document handler: only the scheduler is called, only for the active editor's document.
  const document = handlerOf(register.body, sf, "vscode.workspace.onDidChangeTextDocument");
  if (document.arrow === undefined) {
    problems.push("onDidChangeTextDocument is not given an arrow function");
  } else {
    const callees = calleesIn(document.arrow.body, sf);
    if (callees.join() !== "cellContext.changed") problems.push(`the document handler calls ${callees.join() || "nothing"}, not only cellContext.changed`);
    const guards = collect(document.arrow.body, (n): n is ts.IfStatement => ts.isIfStatement(n));
    if (guards.length !== 1 || flat(guards[0].expression, sf) !== "active && e.document === active.document") problems.push("the document handler does not guard on `active && e.document === active.document`");
    const reads = collect(document.arrow.body, (n): n is ts.VariableDeclaration => ts.isVariableDeclaration(n) && flat(n.name, sf) === "active");
    if (reads.length !== 1 || reads[0].initializer === undefined || flat(reads[0].initializer, sf) !== "vscode.window.activeTextEditor") problems.push("the document handler does not read `const active = vscode.window.activeTextEditor`");
  }

  // 6. The activation-time call is the scheduler's immediate path, the last statement of the function, after the subscriptions.
  const statements = register.body.statements;
  const last = statements[statements.length - 1];
  if (last === undefined || !ts.isExpressionStatement(last) || flat(last.expression, sf) !== "cellContext.evaluateNow()") problems.push("the last statement of registerExecutionFeature is not `cellContext.evaluateNow();`");

  // 7. No handler or statement of the register function reaches the scan itself: `updateCellContext` is handed to the scheduler and never called, and the scan is not called in the function.
  for (const name of ["findCellAtPosition", "findAllCells"]) {
    const direct = callsOf(register.body, sf, name);
    if (direct.length > 0) problems.push(`registerExecutionFeature calls ${name} (${direct.length} times); only the scheduler may reach it`);
  }
  const references = identifiersNamed(sf, "updateCellContext");
  if (references.length !== 2) problems.push(`${references.length} mentions of updateCellContext in the file, not two (its declaration and the scheduler's evaluate)`);
  if (callsOf(sf, sf, "updateCellContext").length !== 1) problems.push("updateCellContext is not called exactly once in the file (by the scheduler's evaluate, which hands it the setter)");

  // 8. The snapshot reader reads the active document's URI and version, and the evaluator takes no editor (it reads the ACTIVE one when it runs).
  const snapshot = functionNamed(sf, "activeDocumentSnapshot");
  if (snapshot === undefined || snapshot.body === undefined) {
    problems.push("activeDocumentSnapshot is missing");
  } else {
    const objects = collect(snapshot.body, (n): n is ts.ObjectLiteralExpression => ts.isObjectLiteralExpression(n));
    const fields = objects.length === 1 ? propertiesOf(objects[0], sf) : {};
    if (fields.key !== "document.uri.toString()") problems.push("activeDocumentSnapshot's key is not document.uri.toString()");
    if (fields.version !== "document.version") problems.push("activeDocumentSnapshot's version is not document.version");
    const reads = collect(snapshot.body, (n): n is ts.VariableDeclaration => ts.isVariableDeclaration(n) && flat(n.name, sf) === "document");
    if (reads.length !== 1 || reads[0].initializer === undefined || flat(reads[0].initializer, sf) !== "vscode.window.activeTextEditor?.document") problems.push("activeDocumentSnapshot does not read `vscode.window.activeTextEditor?.document`");
  }
  const update = functionNamed(sf, "updateCellContext");
  if (update === undefined || update.body === undefined) {
    problems.push("updateCellContext is missing");
  } else {
    if (update.parameters.length !== 1 || flat(update.parameters[0].name, sf) !== "setContextKey") problems.push("updateCellContext takes a parameter other than the setter (it must read the active editor itself, when it runs)");
    const reads = collect(update.body, (n): n is ts.VariableDeclaration => ts.isVariableDeclaration(n) && flat(n.name, sf) === "editor");
    if (reads.length !== 1 || reads[0].initializer === undefined || flat(reads[0].initializer, sf) !== "vscode.window.activeTextEditor") problems.push("updateCellContext does not read `const editor = vscode.window.activeTextEditor`");
    // The VALUE of the key (the review round, M-02): nothing, unit or integration, could read it, because VS Code offers no way to read a context key back. The question is core's `isInCodeCell(languageId, text, line)`, whose
    // answers `in-code-cell.test.ts` pins, so what is pinned here is that it is ASKED once, of the right things, and that its answer is what is set under the key the keybindings read.
    if (callsOf(update.body, sf, "findCellAtPosition").length !== 0) problems.push("updateCellContext calls findCellAtPosition itself (the question is core's isInCodeCell, asked once)");
    const asks = callsOf(update.body, sf, "isInCodeCell");
    if (asks.length !== 1) {
      problems.push(`${asks.length} calls of isInCodeCell in updateCellContext, not one`);
    } else {
      const given = asks[0].arguments.map((argument) => flat(argument, sf));
      if (given.length !== 3) problems.push("isInCodeCell is not given three arguments (the language id, the text, the line)");
      if (given[0] !== "editor.document.languageId") problems.push("updateCellContext does not hand isInCodeCell `editor.document.languageId` (the key is for quarto documents only)");
      if (given[1] !== "() => documentText(editor.document)") problems.push("updateCellContext does not hand isInCodeCell `() => documentText(editor.document)` (the text must be read only for a quarto document: a cursor move in any other file asks too)");
      if (given[2] !== "editor.selection.active.line") problems.push("updateCellContext does not hand isInCodeCell `editor.selection.active.line` (the cursor is the ACTIVE end of the selection, not its anchor)");
    }
    const inCell = collect(update.body, (n): n is ts.VariableDeclaration => ts.isVariableDeclaration(n) && flat(n.name, sf) === "inCell");
    const asked = inCell.length === 1 ? inCell[0].initializer : undefined;
    if (asked === undefined || !ts.isBinaryExpression(asked) || asked.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken || flat(asked.left, sf) !== "editor !== undefined" || !ts.isCallExpression(asked.right) || flat(asked.right.expression, sf) !== "isInCodeCell") {
      problems.push("`const inCell` in updateCellContext is not `editor !== undefined && isInCodeCell(...)` (there may be no editor, and the answer is isInCodeCell's own)");
    }
    const sets = callsOf(update.body, sf, "setContextKey");
    if (sets.length !== 1) problems.push("updateCellContext does not call setContextKey exactly once");
    else if (sets[0].arguments.map((argument) => flat(argument, sf)).join() !== "IN_CELL_CONTEXT,inCell") problems.push("updateCellContext does not call setContextKey(IN_CELL_CONTEXT, inCell) (the key is set to the answer, not to its negation or to another key)");
  }
  // 9. The key the code sets is the key the keybindings read.
  const keyName = collect(sf, (n): n is ts.VariableDeclaration => ts.isVariableDeclaration(n) && flat(n.name, sf) === "IN_CELL_CONTEXT");
  if (keyName.length !== 1 || keyName[0].initializer === undefined || !ts.isStringLiteral(keyName[0].initializer) || keyName[0].initializer.text !== "quarto.inCodeCell") {
    problems.push("IN_CELL_CONTEXT is not the key 'quarto.inCodeCell' that the keybindings of package.json read");
  }
  return problems;
}

/** Every pin `cell-background.ts` breaks, each named by what it was meant to keep. */
function problemsInBackground(source: string): string[] {
  const sf = parse("cell-background.ts", source);
  const problems: string[] = [];
  const register = functionNamed(sf, "registerCellBackgroundFeature");
  if (register === undefined || register.body === undefined) return ["registerCellBackgroundFeature is missing"];

  // 1. ONE debouncer, made directly in the register function over the host's timers and the constant delay.
  const makes = collect(sf, (n): n is ts.CallExpression => isCall(n) && ts.isIdentifier(n.expression) && n.expression.text === "createKeyedDebouncer");
  if (makes.length !== 1) {
    problems.push(`${makes.length} calls of createKeyedDebouncer, not one`);
  } else {
    const [make] = makes;
    if (enclosingFunction(make) !== register) problems.push("createKeyedDebouncer is not called directly in registerCellBackgroundFeature (inside a handler it would keep no state between events)");
    const declaration = make.parent;
    if (!(ts.isVariableDeclaration(declaration) && flat(declaration.name, sf) === "typing" && declaration.parent.parent.parent === register.body)) {
      problems.push("the debouncer is not the initializer of `const typing` among the statements of registerCellBackgroundFeature");
    }
    const options = propertiesOf(make.arguments[0], sf);
    if (options.timers !== "realTimers") problems.push("the debouncer's timers are not realTimers");
    if (options.delayMs !== "TYPING_DEBOUNCE_MS") problems.push("the debouncer's delayMs is not TYPING_DEBOUNCE_MS");
    if (Object.keys(options).sort().join() !== "delayMs,maxWaitMs,timers") problems.push(`the debouncer is made with the options ${Object.keys(options).sort().join()}, not delayMs,maxWaitMs,timers`);
  }

  // 2. The debouncer is disposed with the extension: it is one of the subscriptions pushed.
  const pushes = callsOf(register.body, sf, "context.subscriptions.push");
  if (pushes.length !== 1) {
    problems.push(`${pushes.length} calls of context.subscriptions.push, not one`);
  } else if (!pushes[0].arguments.some((argument) => flat(argument, sf) === "typing")) {
    problems.push("typing is not among the subscriptions pushed (its timers would never be cancelled)");
  }

  // 3. The activation-time refresh, the active-editor and visible-editors handlers and the settings reload stay IMMEDIATE: each calls the decorator itself, directly in the function it is handed.
  const activation = register.body.statements.filter((s) => ts.isExpressionStatement(s) && flat(s.expression, sf) === "decorator.refresh()");
  if (activation.length !== 1) problems.push(`${activation.length} statements \`decorator.refresh();\` directly in registerCellBackgroundFeature, not one (the activation-time refresh)`);
  for (const event of ["vscode.window.onDidChangeActiveTextEditor", "vscode.window.onDidChangeVisibleTextEditors"]) {
    const handler = handlerOf(register.body, sf, event);
    if (handler.arrow === undefined) {
      problems.push(`${event} is not given an arrow function`);
    } else if (!(ts.isCallExpression(handler.arrow.body) && flat(handler.arrow.body, sf) === "decorator.refresh()")) {
      problems.push(`the ${event} handler is not exactly \`() => decorator.refresh()\` (it must stay immediate)`);
    }
  }
  const reload = handlerOf(register.body, sf, "vscode.workspace.onDidChangeConfiguration");
  if (reload.arrow === undefined) {
    problems.push("onDidChangeConfiguration is not given an arrow function");
  } else {
    const callees = calleesIn(reload.arrow.body, sf);
    if (callees.join() !== "event.affectsConfiguration,decorator.reload") problems.push(`the configuration handler calls ${callees.join() || "nothing"}, not event.affectsConfiguration then decorator.reload (immediate)`);
  }

  // 4. The document handler schedules, keyed by the document's URI, and the refresh it schedules is the decorator's; nothing in it scans or refreshes at once.
  const document = handlerOf(register.body, sf, "vscode.workspace.onDidChangeTextDocument");
  if (document.arrow === undefined) {
    problems.push("onDidChangeTextDocument is not given an arrow function");
  } else {
    const body = document.arrow.body;
    const schedules = callsOf(body, sf, "typing.schedule");
    if (schedules.length !== 1) {
      problems.push(`${schedules.length} calls of typing.schedule in the document handler, not one`);
    } else {
      const [schedule] = schedules;
      if (schedule.arguments.length !== 2) problems.push("typing.schedule is not given a key and a run");
      if (flat(schedule.arguments[0], sf) !== "event.document.uri.toString()") problems.push("the document handler's key is not event.document.uri.toString() (one pending run per document)");
      const run = schedule.arguments[1];
      if (!(run !== undefined && ts.isArrowFunction(run) && ts.isCallExpression(run.body) && flat(run.body, sf) === "decorator.refresh()")) problems.push("the document handler's run is not exactly `() => decorator.refresh()`");
    }
    const refreshes = callsOf(body, sf, "decorator.refresh");
    const stray = refreshes.filter((call) => {
      const owner = enclosingFunction(call);
      return !(owner !== undefined && ts.isArrowFunction(owner) && owner.parent !== undefined && ts.isCallExpression(owner.parent) && flat(owner.parent.expression, sf) === "typing.schedule");
    });
    if (stray.length > 0) problems.push("the document handler calls decorator.refresh at once, outside the run handed to typing.schedule");
    const guards = collect(body, (n): n is ts.IfStatement => ts.isIfStatement(n));
    if (guards.length !== 1 || flat(guards[0].expression, sf) !== "isVisible(event.document)") problems.push("the document handler does not guard on `isVisible(event.document)`");
    const callees = calleesIn(body, sf).filter((callee) => callee !== "event.document.uri.toString");
    if (callees.join() !== "isVisible,typing.schedule,decorator.refresh") problems.push(`the document handler calls ${callees.join() || "nothing"}, not isVisible, typing.schedule and (inside the run) decorator.refresh`);
  }

  // 5. Closing a document drops its pending run.
  const close = handlerOf(register.body, sf, "vscode.workspace.onDidCloseTextDocument");
  if (close.arrow === undefined) {
    problems.push("onDidCloseTextDocument is not given an arrow function");
  } else if (!(ts.isCallExpression(close.arrow.body) && flat(close.arrow.body, sf) === "typing.cancel(document.uri.toString())")) {
    problems.push("the close handler is not exactly `(document) => typing.cancel(document.uri.toString())`");
  }

  // 6. Exactly one schedule in the file, and every other path to the decorator's refresh is immediate: the test-only hook returns the decorator's own refresh, and `reload` calls `this.refresh()`.
  if (callsOf(sf, sf, "typing.schedule").length !== 1) problems.push("typing.schedule is not called exactly once in the file");
  const hook = functionNamed(sf, "refreshCellBackgroundDecorationsForTesting");
  if (hook === undefined || hook.body === undefined) {
    problems.push("refreshCellBackgroundDecorationsForTesting is missing");
  } else {
    const returns = collect(hook.body, (n): n is ts.ReturnStatement => ts.isReturnStatement(n));
    const last = returns[returns.length - 1];
    if (last === undefined || last.expression === undefined || flat(last.expression, sf) !== "activeDecorator.refresh()") problems.push("the test hook does not return `activeDecorator.refresh()` (it must force an IMMEDIATE re-apply)");
  }
  const reloadMethod = methodNamed(sf, "CellBackgroundDecorator", "reload");
  if (reloadMethod === undefined || reloadMethod.body === undefined || callsOf(reloadMethod.body, sf, "this.refresh").length !== 1) problems.push("CellBackgroundDecorator.reload does not call this.refresh() (a settings change re-applies at once)");

  // 7. `isVisible`, which the document handler's guard calls (the Session 342 review round, M-03): a document is visible iff some visible editor shows it, compared with `===`. A guard the wrong way round tints the documents nobody
  //    sees and skips the one being typed in, and the integration test refreshes through the test hook, which does not call it.
  const visible = functionNamed(sf, "isVisible");
  const visibleParameter = visible?.parameters.length === 1 && ts.isIdentifier(visible.parameters[0].name) ? visible.parameters[0].name.text : "?";
  const visibleReturns = visible?.body === undefined ? [] : collect(visible.body, (n): n is ts.ReturnStatement => ts.isReturnStatement(n));
  const visibleSome = visibleReturns.length === 1 ? visibleReturns[0].expression : undefined;
  const visibleTest = visibleSome !== undefined && ts.isCallExpression(visibleSome) && visibleSome.arguments.length === 1 ? visibleSome.arguments[0] : undefined;
  const editorParameter = visibleTest !== undefined && ts.isArrowFunction(visibleTest) && visibleTest.parameters.length === 1 && ts.isIdentifier(visibleTest.parameters[0].name) ? visibleTest.parameters[0].name.text : "?";
  const visibleBody = visibleTest !== undefined && ts.isArrowFunction(visibleTest) ? visibleTest.body : undefined;
  if (
    visibleSome === undefined ||
    !ts.isCallExpression(visibleSome) ||
    flat(visibleSome.expression, sf) !== "vscode.window.visibleTextEditors.some" ||
    visibleBody === undefined ||
    !ts.isBinaryExpression(visibleBody) ||
    visibleBody.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken ||
    flat(visibleBody.left, sf) !== `${editorParameter}.document` ||
    flat(visibleBody.right, sf) !== visibleParameter
  ) {
    problems.push("isVisible is not `vscode.window.visibleTextEditors.some((editor) => editor.document === doc)` (the document handler tints only the documents that are shown)");
  }
  return problems;
}

describe("Session 342 -- how execution.ts and cell-background.ts call the typing-path schedulers, pinned by the syntax tree (a unit test cannot run them: they import vscode)", () => {
  it("execution.ts keeps every pin: one scheduler over realTimers and the constant delay, disposed with the extension, the three handlers calling it and nothing that scans, the activation call immediate", () => {
    expect(problemsInExecution(EXECUTION)).toEqual([]);
  });

  it("cell-background.ts keeps every pin: one debouncer, disposed, the document handler scheduling by URI, the other paths immediate, the test hook immediate", () => {
    expect(problemsInBackground(BACKGROUND)).toEqual([]);
  });

  it("the files parsed are the adapters: they parse without a syntax error and hold the functions the pins read", () => {
    for (const [name, source] of [["execution.ts", EXECUTION], ["cell-background.ts", BACKGROUND]] as const) {
      const diagnostics = (parse(name, source) as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics;
      expect(diagnostics).toEqual([]);
    }
    const execution = parse("execution.ts", EXECUTION);
    for (const name of ["registerExecutionFeature", "activeDocumentSnapshot", "updateCellContext", "runCellAtCursor"]) expect(functionNamed(execution, name)).toBeDefined();
    const background = parse("cell-background.ts", BACKGROUND);
    for (const name of ["registerCellBackgroundFeature", "isVisible", "refreshCellBackgroundDecorationsForTesting"]) expect(functionNamed(background, name)).toBeDefined();
    expect(methodNamed(background, "CellBackgroundDecorator", "refresh")).toBeDefined();
    expect(methodNamed(background, "CellBackgroundDecorator", "reload")).toBeDefined();
  });

  it("the key the code sets is read by exactly the five keybindings that the cost note names: ctrl+enter, shift+enter, ctrl+shift+enter, ctrl+alt+c and ctrl+k ctrl+f (package.json `when` clauses)", () => {
    const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { contributes: { keybindings: Array<{ key: string; when?: string }> } };
    const gated = manifest.contributes.keybindings.filter((binding) => (binding.when ?? "").split(/[\s&|!()=]+/).includes("quarto.inCodeCell"));
    expect(gated.map((binding) => binding.key)).toEqual(["ctrl+enter", "shift+enter", "ctrl+shift+enter", "ctrl+alt+c", "ctrl+k ctrl+f"]);
  });

  // The edits: each is a live file with ONE respelling, and the pin it must break. They are the mutants the runner applies to the file itself.
  const EXECUTION_EDITS: Array<[string, string, string, string]> = [
    // [name, from, to, a word of the problem it must be named by]
    ["X01: the selection handler evaluates at once", "      if (e.textEditor === vscode.window.activeTextEditor) {\n        cellContext.changed();\n      }", "      if (e.textEditor === vscode.window.activeTextEditor) {\n        updateCellContext();\n      }", "the selection handler calls"],
    ["X02: the selection handler is not guarded to the active editor", "      if (e.textEditor === vscode.window.activeTextEditor) {\n        cellContext.changed();\n      }", "      if (e.textEditor) {\n        cellContext.changed();\n      }", "does not guard on `e.textEditor"],
    ["X03: the selection handler asks the scheduler to evaluate now (no debounce for typing)", "      if (e.textEditor === vscode.window.activeTextEditor) {\n        cellContext.changed();\n      }", "      if (e.textEditor === vscode.window.activeTextEditor) {\n        cellContext.evaluateNow();\n      }", "the selection handler calls"],
    ["X04: the active-editor handler only notes a change (the pending run is not dropped, the switch is not fresh)", "onDidChangeActiveTextEditor(() => cellContext.evaluateNow())", "onDidChangeActiveTextEditor(() => cellContext.changed())", "the active-editor handler calls"],
    ["X05: the document handler evaluates at once", "      if (active && e.document === active.document) {\n        cellContext.changed();\n      }", "      if (active && e.document === active.document) {\n        updateCellContext();\n      }", "the document handler calls"],
    ["X06: the document handler also scans", "      if (active && e.document === active.document) {\n        cellContext.changed();\n      }", "      if (active && e.document === active.document) {\n        cellContext.changed();\n        findCellAtPosition(e.document.getText(), 0);\n      }", "the document handler calls"],
    ["X07: the document handler is not guarded to the active document", "      if (active && e.document === active.document) {\n        cellContext.changed();\n      }", "      if (active) {\n        cellContext.changed();\n      }", "does not guard on `active && e.document"],
    ["X08: the activation-time call is dropped", "  cellContext.evaluateNow();\n}", "}", "the last statement of registerExecutionFeature"],
    ["X09: the activation-time call only notes a change", "  cellContext.evaluateNow();\n}", "  cellContext.changed();\n}", "the last statement of registerExecutionFeature"],
    ["X10: the scheduler is not disposed with the extension", "  context.subscriptions.push(\n    cellContext,\n", "  context.subscriptions.push(\n", "cellContext is not among the subscriptions"],
    ["X11: the scheduler runs on a literal delay", "    delayMs: TYPING_DEBOUNCE_MS,\n    maxWaitMs", "    delayMs: 0,\n    maxWaitMs", "delayMs is not TYPING_DEBOUNCE_MS"],
    ["X12: the scheduler is evaluated through the wrong function", "    evaluate: () => updateCellContext(setContextKey),\n", "    evaluate: () => undefined,\n", "evaluate is not `() => updateCellContext(setContextKey)`"],
    ["X13: the snapshot's version is the document's line count", "{ key: document.uri.toString(), version: document.version }", "{ key: document.uri.toString(), version: document.lineCount }", "version is not document.version"],
    ["X14: the snapshot's key is a constant", "{ key: document.uri.toString(), version: document.version }", "{ key: \"active\", version: document.version }", "key is not document.uri.toString()"],
    ["X15: the evaluator reads the editor it is told, not the active one", "function updateCellContext(setContextKey: ContextKeySetter): void {\n  const editor = vscode.window.activeTextEditor;", "function updateCellContext(setContextKey: ContextKeySetter, editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor): void {", "takes a parameter"],
    ["X16: the scheduler is made inside a function the register function calls (a new one wherever that function is called again)", "  const cellContext = createCellContextScheduler({\n    timers: realTimers,\n    delayMs: TYPING_DEBOUNCE_MS,\n    maxWaitMs: TYPING_MAX_WAIT_MS,\n    activeSnapshot: activeDocumentSnapshot,\n    evaluate: () => updateCellContext(setContextKey),\n  });", "  const cellContext = (() =>\n    createCellContextScheduler({\n      timers: realTimers,\n      delayMs: TYPING_DEBOUNCE_MS,\n      maxWaitMs: TYPING_MAX_WAIT_MS,\n      activeSnapshot: activeDocumentSnapshot,\n      evaluate: () => updateCellContext(setContextKey),\n    }))();", "not called directly"],
    ["X17: a second scheduler", "  cellContext.evaluateNow();\n}", "  createCellContextScheduler({ timers: realTimers, delayMs: 0, activeSnapshot: activeDocumentSnapshot, evaluate: () => updateCellContext(setContextKey) });\n  cellContext.evaluateNow();\n}", "2 calls of createCellContextScheduler"],
    ["X18: the scheduler's timers are not the host's", "    timers: realTimers,\n    delayMs: TYPING_DEBOUNCE_MS,\n    activeSnapshot", "    timers: { setTimeout: () => 0, clearTimeout: () => undefined },\n    delayMs: TYPING_DEBOUNCE_MS,\n    maxWaitMs", "timers are not realTimers"],
    ["X19: updateCellContext called directly from the register function", "  cellContext.evaluateNow();\n}", "  cellContext.evaluateNow();\n  updateCellContext();\n}", "the last statement of registerExecutionFeature"],
    ["X20: the evaluator does not read the active editor", "  const editor = vscode.window.activeTextEditor;\n  const inCell =", "  const editor = vscode.window.visibleTextEditors[0];\n  const inCell =", "does not read `const editor = vscode.window.activeTextEditor`"],
    // The VALUE of the key (the review round, M-02; mutants E01 to E04 of `tools/mutation-run/mutants/s342-review-typing.json` and their neighbours): what `updateCellContext` hands the core predicate and what it sets.
    ["E01: the key follows the selection's ANCHOR, not its active end (a selection made backwards sets the key from its far end)", "      () => documentText(editor.document),\n      editor.selection.active.line,\n", "      () => documentText(editor.document),\n      editor.selection.anchor.line,\n", "the ACTIVE end of the selection"],
    ["E03: the language id handed is another language's (the key is never true in a .qmd)", "      editor.document.languageId,\n      () => documentText(editor.document),", "      \"markdown\",\n      () => documentText(editor.document),", "does not hand isInCodeCell `editor.document.languageId`"],
    ["E04: the key is set to the NEGATION of the answer (ctrl+enter binds in prose and not in a cell)", "setContextKey(IN_CELL_CONTEXT, inCell)", "setContextKey(IN_CELL_CONTEXT, !inCell)", "does not call setContextKey(IN_CELL_CONTEXT, inCell)"],
    ["E05: another key is set (the keybindings never see it)", "const IN_CELL_CONTEXT = \"quarto.inCodeCell\";", "const IN_CELL_CONTEXT = \"quarto.inCell\";", "IN_CELL_CONTEXT is not the key 'quarto.inCodeCell'"],
    ["E06: the text is read for every language (a getText of every file at every cursor move)", "      () => documentText(editor.document),\n", "      documentText(editor.document),\n", "`() => documentText(editor.document)`"],
    ["E07: the missing editor is not checked first", "    editor !== undefined &&\n    isInCodeCell(", "    isInCodeCell(", "is not `editor !== undefined && isInCodeCell(...)`"],
    ["E08: the old inline scan is back beside the predicate", "  setContextKey(IN_CELL_CONTEXT, inCell);", "  void findCellAtPosition(\"\", 0);\n  setContextKey(IN_CELL_CONTEXT, inCell);", "calls findCellAtPosition itself"],
    ["E09: the question is asked twice", "  setContextKey(IN_CELL_CONTEXT, inCell);", "  void isInCodeCell(\"quarto\", \"\", 0);\n  setContextKey(IN_CELL_CONTEXT, inCell);", "2 calls of isInCodeCell"],
  ];

  const BACKGROUND_EDITS: Array<[string, string, string, string]> = [
    ["B01: the document handler refreshes at once", "        typing.schedule(event.document.uri.toString(), () => decorator.refresh());", "        decorator.refresh();", "0 calls of typing.schedule"],
    ["B02: the document handler refreshes at once as well as scheduling", "        typing.schedule(event.document.uri.toString(), () => decorator.refresh());", "        decorator.refresh();\n        typing.schedule(event.document.uri.toString(), () => decorator.refresh());", "at once, outside the run"],
    ["B03: the debounce is keyed by one constant (documents postpone each other)", "typing.schedule(event.document.uri.toString(),", "typing.schedule(\"cells\",", "the document handler's key is not event.document.uri.toString()"],
    ["B04: the debounce is keyed by the language, not the document", "typing.schedule(event.document.uri.toString(),", "typing.schedule(event.document.languageId,", "the document handler's key"],
    ["B05: the scheduled run scans instead of refreshing", "() => decorator.refresh());", "() => cellBackgroundRangesFor(event.document));", "the document handler's run is not exactly"],
    ["B06: the document handler is not guarded to visible documents", "      if (isVisible(event.document)) {\n        typing.schedule", "      if (event.document) {\n        typing.schedule", "does not guard on `isVisible(event.document)`"],
    ["B07: the active-editor handler is debounced", "onDidChangeActiveTextEditor(() => decorator.refresh())", "onDidChangeActiveTextEditor(() => typing.schedule(\"active\", () => decorator.refresh()))", "onDidChangeActiveTextEditor handler is not exactly"],
    ["B08: the visible-editors handler is debounced", "onDidChangeVisibleTextEditors(() => decorator.refresh())", "onDidChangeVisibleTextEditors(() => typing.schedule(\"visible\", () => decorator.refresh()))", "onDidChangeVisibleTextEditors handler is not exactly"],
    ["B09: the settings reload is debounced", "        decorator.reload();\n      }\n    }),\n  );", "        typing.schedule(\"reload\", () => decorator.reload());\n      }\n    }),\n  );", "the configuration handler calls"],
    ["B10: the activation-time refresh is dropped", "  activeDecorator = decorator;\n  decorator.refresh();\n", "  activeDecorator = decorator;\n", "statements `decorator.refresh();`"],
    ["B11: the debouncer is not disposed with the extension", "    decorator,\n    typing,\n", "    decorator,\n", "typing is not among the subscriptions"],
    ["B12: the close handler is dropped", "    vscode.workspace.onDidCloseTextDocument((document) =>\n      typing.cancel(document.uri.toString()),\n    ),\n", "", "onDidCloseTextDocument is not given an arrow function"],
    ["B13: the close handler cancels the wrong key", "typing.cancel(document.uri.toString())", "typing.cancel(document.languageId)", "the close handler is not exactly"],
    ["B14: the debouncer runs on a literal delay", "    delayMs: TYPING_DEBOUNCE_MS,\n    maxWaitMs: TYPING_MAX_WAIT_MS,\n  });\n  context", "    delayMs: 0,\n    maxWaitMs: TYPING_MAX_WAIT_MS,\n  });\n  context","delayMs is not TYPING_DEBOUNCE_MS"],
    ["B15: the debouncer is made inside the document handler (it keeps no state between events)", "      if (isVisible(event.document)) {\n        typing.schedule(", "      if (isVisible(event.document)) {\n        const typing = createKeyedDebouncer({ timers: realTimers, delayMs: TYPING_DEBOUNCE_MS });\n        typing.schedule(", "2 calls of createKeyedDebouncer"],
    ["B16: the test hook goes through the debouncer", "  return activeDecorator.refresh();", "  return new Map();", "does not return `activeDecorator.refresh()`"],
    ["B17: reload no longer re-applies", "    this.decorationType = createDecorationType(readCellBackgroundSettings());\n    this.refresh();", "    this.decorationType = createDecorationType(readCellBackgroundSettings());", "reload does not call this.refresh()"],
    ["B18: the debouncer's timers are not the host's", "    timers: realTimers,\n    delayMs: TYPING_DEBOUNCE_MS,\n    maxWaitMs: TYPING_MAX_WAIT_MS,\n  });\n  context", "    timers: { setTimeout: () => 0, clearTimeout: () => undefined },\n    delayMs: TYPING_DEBOUNCE_MS,\n    maxWaitMs: TYPING_MAX_WAIT_MS,\n  });\n  context","timers are not realTimers"],
    // The Session 342 review round (mutation lens, M-03): the body of `isVisible`, which the document handler's guard calls. A mutant of `tools/mutation-run/mutants/s342-review-typing.json` (K01).
    ["K01: isVisible compares with `!==` (an edit in a visible document is not tinted, one in a hidden document is)", "    (editor) => editor.document === doc,", "    (editor) => editor.document !== doc,", "isVisible is not"],
  ];

  it.each(EXECUTION_EDITS)("execution.ts, %s: the pin is broken, and is named", (_name, from, to, named) => {
    expect(EXECUTION.split(from).length - 1).toBe(1); // the edit applies to the live file exactly once
    const problems = problemsInExecution(EXECUTION.replace(from, () => to));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain(named);
  });

  it.each(BACKGROUND_EDITS)("cell-background.ts, %s: the pin is broken, and is named", (_name, from, to, named) => {
    expect(BACKGROUND.split(from).length - 1).toBe(1);
    const problems = problemsInBackground(BACKGROUND.replace(from, () => to));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain(named);
  });

  // A pin read from the syntax tree is not moved by what is not code.
  it("a comment, a string, a template and an unused identifier that spell the pinned calls do not satisfy the pins, and a comment that names the scan does not break them", () => {
    const exec = EXECUTION.replace("        cellContext.changed();\n      }\n    }),\n    vscode.window.onDidChangeActiveTextEditor", "        // cellContext.changed();\n        const decoy = \"cellContext.changed()\" + `cellContext.changed()`;\n        void decoy;\n      }\n    }),\n    vscode.window.onDidChangeActiveTextEditor");
    expect(exec).not.toBe(EXECUTION);
    expect(problemsInExecution(exec).join("\n")).toContain("the selection handler calls");
    const commented = EXECUTION.replace("const IN_CELL_CONTEXT", "// updateCellContext() and findCellAtPosition(text, line) run on every keystroke\n/* updateCellContext(); */\nconst NOTE = 'updateCellContext()';\nconst IN_CELL_CONTEXT");
    expect(commented).not.toBe(EXECUTION);
    expect(problemsInExecution(commented)).toEqual([]);
    const bg = BACKGROUND.replace("        typing.schedule(event.document.uri.toString(), () => decorator.refresh());", "        // typing.schedule(event.document.uri.toString(), () => decorator.refresh());\n        const decoy = \"typing.schedule(\" + `typing.schedule(`;\n        void decoy;\n        decorator.refresh();");
    expect(bg).not.toBe(BACKGROUND);
    expect(problemsInBackground(bg).join("\n")).toContain("0 calls of typing.schedule");
    const bgCommented = BACKGROUND.replace("function isVisible(", "// decorator.refresh() on every edit is what the debounce replaced\nconst NOTE = 'decorator.refresh()';\nfunction isVisible(");
    expect(bgCommented).not.toBe(BACKGROUND);
    expect(problemsInBackground(bgCommented)).toEqual([]);
  });
});
