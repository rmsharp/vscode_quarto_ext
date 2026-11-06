import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as ts from "typescript";

// Session 343, parts (2) to (4) of "What Session 342's review round found beside the typing-path cures" (D1 the document-text memo, D2 the context-key setter, D3 the cell-background refresh plan). `src/features/execution.ts`,
// `preview.ts`, `cell-background.ts` and `context-key.ts` import `vscode`, so no unit test can
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
const DOCUMENT_TEXT = read("src", "features", "document-text.ts");
const BACKGROUND = read("src", "features", "cell-background.ts");
const MEMO_CORE = read("src", "core", "document-text-memo.ts");

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
/** Every call of a method named `getText`, whatever it is called on and however it is reached (`a.getText()`, `a?.b.getText()`, `a!.getText()`). */
const getTextCalls = (node: ts.Node): ts.CallExpression[] => collect(node, isCall).filter((call) => ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === "getText");
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
  const makes = callsOf(sf, sf, callee);
  if (makes.length !== 1) return `${makes.length} calls of ${callee} in the file, not one`;
  const declaration = makes[0].parent;
  if (!(ts.isVariableDeclaration(declaration) && flat(declaration.name, sf) === name && declaration.parent.parent.parent === fn.body)) {
    return `${callee}() is not the initializer of \`const ${name}\` among the statements of ${fn.name?.text ?? "the function"} (made inside a handler it would keep no state between events)`;
  }
  return undefined;
}

// ---- D2: THE CONTEXT-KEY SETTER --------------------------------------------------------------------------------------------------------------------------------------------------------------

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

  it("the files parsed are the adapters: they parse without a syntax error and hold the functions the pins read", () => {
    for (const [name, source] of [["context-key.ts", CONTEXT_KEY], ["execution.ts", EXECUTION], ["preview.ts", PREVIEW]] as const) {
      expect((parse(name, source) as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics).toEqual([]);
    }
    expect(functionNamed(parse("context-key.ts", CONTEXT_KEY), "createVscodeContextKeySetter")).toBeDefined();
    for (const name of ["registerExecutionFeature", "updateCellContext"]) expect(functionNamed(parse("execution.ts", EXECUTION), name)).toBeDefined();
    for (const name of ["registerPreviewFeature", "updateRenderScriptContext"]) expect(functionNamed(parse("preview.ts", PREVIEW), name)).toBeDefined();
  });

  // The edits: each is a live file with ONE respelling, and the pin it must break. They are the mutants of `tools/mutation-run/mutants/s343-context-setter.json`, which the runner applies to the file itself.
  const CONTEXT_KEY_EDITS: Array<[string, string, string, string]> = [
    // [name, from, to, a word of the problem it must be named by]
    ["CK01: the send is a block that drops the command's result (a rejected setContext is never seen, so never forgotten)", "createContextKeySetter((key, value) =>\n    vscode.commands.executeCommand(\"setContext\", key, value),\n  );", "createContextKeySetter((key, value) => {\n    vscode.commands.executeCommand(\"setContext\", key, value);\n  });", "the send's body is not the executeCommand call itself"],
    ["CK02: the send voids the command's result", "    vscode.commands.executeCommand(\"setContext\", key, value),\n", "    void vscode.commands.executeCommand(\"setContext\", key, value),\n", "the send's body is not the executeCommand call itself"],
    ["CK03: the send is another command", "executeCommand(\"setContext\", key, value)", "executeCommand(\"quarto.setContext\", key, value)", "the send is not `vscode.commands.executeCommand(\"setContext\", key, value)`"],
    ["CK04: the send hands the value before the key", "executeCommand(\"setContext\", key, value)", "executeCommand(\"setContext\", value, key)", "the send is not `vscode.commands.executeCommand(\"setContext\", key, value)`"],
    ["CK05: the send sets one constant key", "executeCommand(\"setContext\", key, value)", "executeCommand(\"setContext\", \"quarto.inCodeCell\", value)", "the send is not `vscode.commands.executeCommand(\"setContext\", key, value)`"],
    ["CK06: the send is handed to the host with no setter in front of it", "  return createContextKeySetter((key, value) =>\n    vscode.commands.executeCommand(\"setContext\", key, value),\n  );", "  return (key, value) => void vscode.commands.executeCommand(\"setContext\", key, value);", "0 calls of createContextKeySetter"],
    ["CK07: the function takes the send as a parameter (the call sites could hand it anything)", "export function createVscodeContextKeySetter(): ContextKeySetter {", "export function createVscodeContextKeySetter(unused: number): ContextKeySetter {", "takes a parameter"],
    ["CK08: a second setContext is sent beside the setter's", "  return createContextKeySetter((key, value) =>", "  void vscode.commands.executeCommand(\"setContext\", \"extra\", true);\n  return createContextKeySetter((key, value) =>", "does not call executeCommand exactly once"],
  ];

  const EXECUTION_SETTER_EDITS: Array<[string, string, string, string]> = [
    ["XS01: the setter is made inside the evaluator (one per event, so it remembers nothing)", "  const setContextKey = createVscodeContextKeySetter();\n  const cellContext = createCellContextScheduler({", "  const cellContext = createCellContextScheduler({", "0 calls of createVscodeContextKeySetter in the file"],
    ["XS02: the evaluator hands the update function a fresh setter on every call", "    evaluate: () => updateCellContext(setContextKey),", "    evaluate: () => updateCellContext(createVscodeContextKeySetter()),", "the scheduler's evaluate is not"],
    ["XS03: the key is set through the host's command again", "  setContextKey(IN_CELL_CONTEXT, inCell);\n}", "  void vscode.commands.executeCommand(\"setContext\", IN_CELL_CONTEXT, inCell);\n}", "0 calls of setContextKey in updateCellContext"],
    ["XS04: the key is set twice", "  setContextKey(IN_CELL_CONTEXT, inCell);\n}", "  setContextKey(IN_CELL_CONTEXT, inCell);\n  setContextKey(IN_CELL_CONTEXT, inCell);\n}", "2 calls of setContextKey in updateCellContext"],
    ["XS05: the key is set through the setter AND the host's command", "  setContextKey(IN_CELL_CONTEXT, inCell);\n}", "  setContextKey(IN_CELL_CONTEXT, inCell);\n  void vscode.commands.executeCommand(\"setContext\", IN_CELL_CONTEXT, inCell);\n}", "updateCellContext calls executeCommand itself"],
    ["XS06: the update function makes its own setter and takes none", "function updateCellContext(setContextKey: ContextKeySetter): void {\n  const editor = vscode.window.activeTextEditor;", "function updateCellContext(): void {\n  const setContextKey = createVscodeContextKeySetter();\n  const editor = vscode.window.activeTextEditor;", "updateCellContext does not take exactly the parameter `setContextKey`"],
    ["XS07: the file builds its own setter over the host's command", "  const setContextKey = createVscodeContextKeySetter();", "  const setContextKey = createContextKeySetter((key: string, value: boolean) => vscode.commands.executeCommand(\"setContext\", key, value));", "execution.ts calls createContextKeySetter itself"],
    ["XS08: the setter is made in the module (shared by every registration, and by a registration after a deactivation)", "export function registerExecutionFeature(", "const sharedSetter = createVscodeContextKeySetter();\nexport function registerExecutionFeature(", "2 calls of createVscodeContextKeySetter in the file"],
    ["XS09: the setter is handed under another name's meaning: a literal function, not the setter", "    evaluate: () => updateCellContext(setContextKey),", "    evaluate: () => updateCellContext(() => undefined),", "the scheduler's evaluate is not"],
  ];

  const PREVIEW_SETTER_EDITS: Array<[string, string, string, string]> = [
    ["PS01: the active-editor handler hands the update a fresh setter", "      updateRenderScriptContext(editor, setContextKey),", "      updateRenderScriptContext(editor, createVscodeContextKeySetter()),", "does not hand it `setContextKey`"],
    ["PS02: the document handler hands the update a fresh setter", "        updateRenderScriptContext(active, setContextKey);", "        updateRenderScriptContext(active, createVscodeContextKeySetter());", "does not hand it `setContextKey`"],
    ["PS03: the activation-time call hands the update a fresh setter", "  updateRenderScriptContext(vscode.window.activeTextEditor, setContextKey);", "  updateRenderScriptContext(vscode.window.activeTextEditor, createVscodeContextKeySetter());", "does not hand it `setContextKey`"],
    ["PS04: the key is set through the host's command again", "  setContextKey(\n    RENDER_SCRIPT_CONTEXT,\n    isPreviewableRenderScript(editor?.document),\n  );", "  void vscode.commands.executeCommand(\n    \"setContext\",\n    RENDER_SCRIPT_CONTEXT,\n    isPreviewableRenderScript(editor?.document),\n  );", "0 calls of setContextKey in updateRenderScriptContext"],
    ["PS05: the key is set to the negation of the answer (ctrl+shift+k previews in a plain file and runs the document command in a script)", "    isPreviewableRenderScript(editor?.document),\n  );\n}", "    !isPreviewableRenderScript(editor?.document),\n  );\n}", "does not call setContextKey(RENDER_SCRIPT_CONTEXT"],
    ["PS06: another key is set (the keybinding never sees it)", "  setContextKey(\n    RENDER_SCRIPT_CONTEXT,", "  setContextKey(\n    \"quartoRenderScript\",", "does not call setContextKey(RENDER_SCRIPT_CONTEXT"],
    ["PS07: a fourth call of the update function", "  updateRenderScriptContext(vscode.window.activeTextEditor, setContextKey);\n}", "  updateRenderScriptContext(vscode.window.activeTextEditor, setContextKey);\n  updateRenderScriptContext(undefined, setContextKey);\n}", "4 calls of updateRenderScriptContext"],
    ["PS08: the setter is made in the module (shared by every registration)", "export function registerPreviewFeature(", "const sharedSetter = createVscodeContextKeySetter();\nexport function registerPreviewFeature(", "2 calls of createVscodeContextKeySetter in the file"],
    ["PS09: the update function takes the setter first", "function updateRenderScriptContext(\n  editor: vscode.TextEditor | undefined,\n  setContextKey: ContextKeySetter,\n): void {", "function updateRenderScriptContext(\n  setContextKey: ContextKeySetter,\n  editor: vscode.TextEditor | undefined,\n): void {", "does not take exactly (editor, setContextKey)"],
    ["PS10: the file builds its own setter over the host's command", "  const setContextKey = createVscodeContextKeySetter();", "  const setContextKey = createContextKeySetter((key: string, value: boolean) => vscode.commands.executeCommand(\"setContext\", key, value));", "preview.ts calls createContextKeySetter itself"],
  ];

  it.each(CONTEXT_KEY_EDITS)("context-key.ts, %s: the pin is broken, and is named", (_name, from, to, named) => {
    expect(CONTEXT_KEY.split(from).length - 1).toBe(1); // the edit applies to the live file exactly once
    const problems = problemsInContextKeyAdapter(CONTEXT_KEY.replace(from, () => to));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain(named);
  });

  it.each(EXECUTION_SETTER_EDITS)("execution.ts, %s: the pin is broken, and is named", (_name, from, to, named) => {
    expect(EXECUTION.split(from).length - 1).toBe(1);
    const problems = problemsInExecutionSetter(EXECUTION.replace(from, () => to));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain(named);
  });

  it.each(PREVIEW_SETTER_EDITS)("preview.ts, %s: the pin is broken, and is named", (_name, from, to, named) => {
    expect(PREVIEW.split(from).length - 1).toBe(1);
    const problems = problemsInPreviewSetter(PREVIEW.replace(from, () => to));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain(named);
  });

  // A pin read from the syntax tree is not moved by what is not code.
  it("a comment, a string, a template and an unused identifier that spell the setter's calls do not satisfy the pins, and a comment that names the old call does not break them", () => {
    const exec = EXECUTION.replace("  setContextKey(IN_CELL_CONTEXT, inCell);\n}", "  // setContextKey(IN_CELL_CONTEXT, inCell);\n  const decoy = \"setContextKey(IN_CELL_CONTEXT, inCell)\" + `setContextKey(IN_CELL_CONTEXT, inCell)`;\n  void decoy;\n}");
    expect(exec).not.toBe(EXECUTION);
    expect(problemsInExecutionSetter(exec).join("\n")).toContain("0 calls of setContextKey in updateCellContext");
    const commented = EXECUTION.replace("const IN_CELL_CONTEXT", "// void vscode.commands.executeCommand(\"setContext\", IN_CELL_CONTEXT, inCell) was here\nconst NOTE = 'executeCommand(\"setContext\")';\nconst IN_CELL_CONTEXT");
    expect(commented).not.toBe(EXECUTION);
    expect(problemsInExecutionSetter(commented)).toEqual([]);
    const preview = PREVIEW.replace("  setContextKey(\n    RENDER_SCRIPT_CONTEXT,", "  // setContextKey(RENDER_SCRIPT_CONTEXT, isPreviewableRenderScript(editor?.document));\n  const decoy = \"setContextKey(\" + `setContextKey(`;\n  void decoy;\n  void vscode.commands.executeCommand(\n    \"setContext\",\n    RENDER_SCRIPT_CONTEXT,\n    isPreviewableRenderScript(editor?.document),\n  );\n  setContextKey(\n    RENDER_SCRIPT_CONTEXT,");
    expect(preview).not.toBe(PREVIEW);
    expect(problemsInPreviewSetter(preview).join("\n")).toContain("updateRenderScriptContext calls executeCommand itself");
    const previewCommented = PREVIEW.replace("const RENDER_SCRIPT_CONTEXT", "// executeCommand(\"setContext\", RENDER_SCRIPT_CONTEXT, ...) was here\nconst RENDER_SCRIPT_CONTEXT");
    expect(previewCommented).not.toBe(PREVIEW);
    expect(problemsInPreviewSetter(previewCommented)).toEqual([]);
  });
});

// ---- D1: THE DOCUMENT-TEXT MEMO ----------------------------------------------------------------------------------------------------------------------------------------------------------------------

/** Every pin `src/features/document-text.ts` breaks: ONE memo for the module (so the three features share an entry), asked with the document and a thunk over the same document's `getText`, and no runtime `vscode`. */
function problemsInDocumentTextAdapter(source: string): string[] {
  const sf = parse("document-text.ts", source);
  const problems: string[] = [];
  const text = functionNamed(sf, "documentText");
  if (text === undefined || text.body === undefined) return ["documentText is missing"];
  // 1. One memo, made at the top level of the module: made inside the function it would keep nothing between calls.
  const makes = callsOf(sf, sf, "createDocumentTextMemo");
  if (makes.length !== 1) {
    problems.push(`${makes.length} calls of createDocumentTextMemo, not one`);
  } else {
    const declaration = makes[0].parent;
    if (!(ts.isVariableDeclaration(declaration) && declaration.parent.parent.parent === sf && makes[0].arguments.length === 0)) problems.push("createDocumentTextMemo() is not the initializer of a top-level constant of the module (made inside documentText it would keep nothing between calls)");
  }
  // 2. documentText(document) returns the memo's answer for that document, with a thunk that reads the SAME document's text, so the read happens only on a miss.
  if (text.parameters.length !== 1) problems.push("documentText does not take exactly one parameter (the document)");
  const document = text.parameters.length === 1 ? flat(text.parameters[0].name, sf) : "?";
  const memo = makes.length === 1 && ts.isVariableDeclaration(makes[0].parent) ? flat(makes[0].parent.name, sf) : "?";
  const returns = collect(text.body, (n): n is ts.ReturnStatement => ts.isReturnStatement(n));
  const asks = callsOf(text.body, sf, `${memo}.textOf`);
  if (returns.length !== 1 || asks.length !== 1 || returns[0].expression !== asks[0]) {
    problems.push("documentText does not return the memo's `textOf(...)` answer itself");
  } else {
    const given = asks[0].arguments.map((a) => flat(a, sf));
    if (given.length !== 2) problems.push("textOf is not given the document and a thunk");
    if (given[0] !== document) problems.push("textOf is not asked about the document documentText was given");
    if (given[1] !== `() => ${document}.getText()`) problems.push(`textOf is not given \`() => ${document}.getText()\` (the thunk must read the same document, and only be called on a miss)`);
  }
  if (getTextCalls(sf).length !== 1) problems.push("getText is not called exactly once in the file (inside the thunk)");
  // 3. The module loads without the host: its only import of `vscode` is a type import, which is erased.
  const imports = collect(sf, (n): n is ts.ImportDeclaration => ts.isImportDeclaration(n));
  const vscodeImports = imports.filter((i) => ts.isStringLiteral(i.moduleSpecifier) && i.moduleSpecifier.text === "vscode");
  if (vscodeImports.some((i) => i.importClause === undefined || !i.importClause.isTypeOnly)) problems.push("document-text.ts imports vscode at runtime (a type import is erased; the module must load without the host)");
  if (!imports.some((i) => ts.isStringLiteral(i.moduleSpecifier) && i.moduleSpecifier.text === "../core/document-text-memo")) problems.push("document-text.ts does not import ../core/document-text-memo");
  return problems;
}

/** The text of `name`'s import of `documentText`: whether `source` imports it from ./document-text. */
const importsDocumentText = (sf: ts.SourceFile): boolean =>
  collect(sf, (n): n is ts.ImportDeclaration => ts.isImportDeclaration(n)).some(
    (i) => ts.isStringLiteral(i.moduleSpecifier) && i.moduleSpecifier.text === "./document-text" && i.importClause?.namedBindings !== undefined && ts.isNamedImports(i.importClause.namedBindings) && i.importClause.namedBindings.elements.some((e) => e.name.text === "documentText"),
  );

/** Every pin `execution.ts` breaks about the text: the cursor-move key reads it through the memo, in a thunk, and not otherwise. */
function problemsInExecutionText(source: string): string[] {
  const sf = parse("execution.ts", source);
  const problems: string[] = [];
  const update = functionNamed(sf, "updateCellContext");
  if (update === undefined || update.body === undefined) return ["updateCellContext is missing"];
  if (!importsDocumentText(sf)) problems.push("execution.ts does not import documentText from ./document-text");
  const asks = callsOf(update.body, sf, "isInCodeCell");
  if (asks.length !== 1) {
    problems.push(`${asks.length} calls of isInCodeCell in updateCellContext, not one`);
  } else if (flat(asks[0].arguments[1], sf) !== "() => documentText(editor.document)") {
    problems.push("updateCellContext does not hand isInCodeCell `() => documentText(editor.document)` (a thunk over the memo: read only for a quarto document, and only once a version)");
  }
  if (getTextCalls(update.body).length !== 0) problems.push("updateCellContext calls getText itself (a whole-buffer join on every cursor move)");
  if (callsOf(update.body, sf, "documentText").length !== 1) problems.push(`${callsOf(update.body, sf, "documentText").length} calls of documentText in updateCellContext, not one (the one in the thunk)`);
  return problems;
}

/** Every pin `preview.ts` breaks about the text: the predicate reads it through the memo, after the extension prefilter. */
function problemsInPreviewText(source: string): string[] {
  const sf = parse("preview.ts", source);
  const problems: string[] = [];
  const predicate = functionNamed(sf, "isPreviewableRenderScript");
  if (predicate === undefined || predicate.body === undefined) return ["isPreviewableRenderScript is missing"];
  if (!importsDocumentText(sf)) problems.push("preview.ts does not import documentText from ./document-text");
  const returns = collect(predicate.body, (n): n is ts.ReturnStatement => ts.isReturnStatement(n));
  const chain: string[] = [];
  const flatten = (e: ts.Expression): void => {
    if (ts.isParenthesizedExpression(e)) {
      flatten(e.expression);
    } else if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      flatten(e.left);
      flatten(e.right);
    } else {
      chain.push(flat(e, sf));
    }
  };
  if (returns.length === 1 && returns[0].expression !== undefined) flatten(returns[0].expression);
  const prefilter = chain.indexOf("isRenderScriptExtension(doc.uri.fsPath)");
  const detect = chain.indexOf("isRenderScript(doc.uri.fsPath, documentText(doc))");
  if (detect === -1) problems.push("isPreviewableRenderScript does not end in `isRenderScript(doc.uri.fsPath, documentText(doc))` (the text is read through the memo)");
  if (prefilter === -1 || (detect !== -1 && prefilter > detect)) problems.push("the extension prefilter `isRenderScriptExtension(doc.uri.fsPath)` does not come before the read of the text (a 20 MB log would be joined on every keystroke)");
  if (detect !== -1 && detect !== chain.length - 1) problems.push("the read of the text is not the last operand of the && chain");
  if (getTextCalls(predicate.body).length !== 0) problems.push("isPreviewableRenderScript calls getText itself (a whole-buffer join on every keystroke)");
  return problems;
}

/** Every pin `cell-background.ts` breaks about the text: the ranges are built from the memo's text, after the language and settings guard. */
function problemsInBackgroundText(source: string): string[] {
  const sf = parse("cell-background.ts", source);
  const problems: string[] = [];
  const ranges = functionNamed(sf, "cellBackgroundRangesFor");
  if (ranges === undefined || ranges.body === undefined) return ["cellBackgroundRangesFor is missing"];
  if (!importsDocumentText(sf)) problems.push("cell-background.ts does not import documentText from ./document-text");
  const asks = callsOf(ranges.body, sf, "cellBackgroundRanges");
  if (asks.length !== 1) {
    problems.push(`${asks.length} calls of cellBackgroundRanges in cellBackgroundRangesFor, not one`);
  } else {
    if (asks[0].arguments.map((a) => flat(a, sf)).join() !== "documentText(doc)") problems.push("cellBackgroundRangesFor does not hand cellBackgroundRanges `documentText(doc)`");
    const guard = ranges.body.statements.find((s): s is ts.IfStatement => ts.isIfStatement(s));
    if (guard === undefined || flat(guard.expression, sf) !== 'doc.languageId !== "quarto" || !readCellBackgroundSettings().enabled' || guard.pos > asks[0].pos) problems.push("the language and settings guard does not come before the read of the text");
  }
  if (getTextCalls(ranges.body).length !== 0) problems.push("cellBackgroundRangesFor calls getText itself (a whole-buffer join on every refresh)");
  return problems;
}

/**
 * Every pin `src/core/document-text-memo.ts` breaks about what an entry holds: the document ONLY through a `WeakRef`, the version and the text. The closing of the loop with the GC row of document-text-memo.test.ts,
 * which collects a document with the memo alive: that row fails on a strong reference the day it runs, and this one names where the reference would sit.
 */
function problemsInMemoCore(source: string): string[] {
  const sf = parse("document-text-memo.ts", source);
  const problems: string[] = [];
  const entry = collect(sf, (n): n is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(n) && n.name.text === "Entry")[0];
  if (entry === undefined) return ["the interface Entry is missing"];
  const members = entry.members.filter(ts.isPropertySignature).map((m) => `${m.modifiers?.some((x) => x.kind === ts.SyntaxKind.ReadonlyKeyword) === true ? "readonly " : ""}${flat(m.name, sf)}: ${m.type === undefined ? "?" : flat(m.type, sf)}`);
  if (entry.members.length !== 3 || members.join("; ") !== "readonly document: WeakRef<VersionedDocument>; readonly version: number; readonly text: string") {
    problems.push(`Entry has the members [${members.join("; ")}], not [readonly document: WeakRef<VersionedDocument>; readonly version: number; readonly text: string] (an entry may hold the document only through a WeakRef)`);
  }
  const weak = collect(sf, (n): n is ts.NewExpression => ts.isNewExpression(n) && flat(n.expression, sf) === "WeakRef");
  if (weak.length !== 1 || weak[0].arguments?.map((a) => flat(a, sf)).join() !== "document") problems.push("the file does not make exactly one `new WeakRef(document)` (the one place a document is stored)");
  const pushes = callsOf(sf, sf, "entries.push");
  const stored = pushes.filter((call) => call.arguments.length === 1 && ts.isObjectLiteralExpression(call.arguments[0]) && propertiesOf(call.arguments[0], sf).document === "new WeakRef(document)");
  if (pushes.length !== 2 || stored.length !== 1) problems.push("entries.push is not called twice, once with an object whose `document` is `new WeakRef(document)` and once with the entry that was hit");
  const holders = collect(sf, (n): n is ts.NewExpression => ts.isNewExpression(n) && ["Map", "Set", "WeakMap", "WeakSet"].includes(flat(n.expression, sf)));
  if (holders.length > 0) problems.push(`the file makes a ${holders.map((h) => flat(h.expression, sf)).join(", ")} (a table keyed by the document would hold it strongly)`);
  return problems;
}

describe("Session 343 -- how the adapters read a document's text, pinned by the syntax tree (a unit test cannot run them: they import vscode)", () => {
  it("document-text.ts keeps every pin: one memo for the module, asked with the document and a thunk over its getText, no runtime import of vscode", () => {
    expect(problemsInDocumentTextAdapter(DOCUMENT_TEXT)).toEqual([]);
  });

  it("execution.ts keeps every text pin: the cursor-move key reads the text through the memo, in a thunk", () => {
    expect(problemsInExecutionText(EXECUTION)).toEqual([]);
  });

  it("preview.ts keeps every text pin: the predicate reads the text through the memo, after the extension prefilter", () => {
    expect(problemsInPreviewText(PREVIEW)).toEqual([]);
  });

  it("cell-background.ts keeps every text pin: the ranges come from the memo's text, after the language and settings guard", () => {
    expect(problemsInBackgroundText(BACKGROUND)).toEqual([]);
  });

  it("document-text-memo.ts keeps every pin: an entry holds the document only through a WeakRef", () => {
    expect(problemsInMemoCore(MEMO_CORE)).toEqual([]);
  });

  it("the files parsed are the adapters: they parse without a syntax error and hold the functions the pins read", () => {
    for (const [name, source] of [["document-text.ts", DOCUMENT_TEXT], ["document-text-memo.ts", MEMO_CORE], ["cell-background.ts", BACKGROUND]] as const) {
      expect((parse(name, source) as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics).toEqual([]);
    }
    expect(functionNamed(parse("document-text.ts", DOCUMENT_TEXT), "documentText")).toBeDefined();
    expect(functionNamed(parse("cell-background.ts", BACKGROUND), "cellBackgroundRangesFor")).toBeDefined();
    expect(functionNamed(parse("preview.ts", PREVIEW), "isPreviewableRenderScript")).toBeDefined();
  });

  // The edits: each is a live file with ONE respelling, and the pin it must break. They are the mutants of `tools/mutation-run/mutants/s343-text-memo.json`, which the runner applies to the file itself.
  const DOCUMENT_TEXT_EDITS: Array<[string, string, string, string]> = [
    ["DT01: a second memo is made at the top level (two features would not share an entry)", "const memo = createDocumentTextMemo();\n", "const memo = createDocumentTextMemo();\nconst other = createDocumentTextMemo();\n", "2 calls of createDocumentTextMemo"],
    ["DT02: the memo is made inside documentText (it keeps nothing between calls)", "const memo = createDocumentTextMemo();\n\n/** The text of `document` as it is now: `document.getText()` on the first ask of a version, the same string while the version stays. */\nexport function documentText(document: vscode.TextDocument): string {\n", "/** The text of `document` as it is now: `document.getText()` on the first ask of a version, the same string while the version stays. */\nexport function documentText(document: vscode.TextDocument): string {\n  const memo = createDocumentTextMemo();\n", "is not the initializer of a top-level constant"],
    ["DT03: the thunk reads a trimmed text", "() => document.getText()", "() => document.getText().trim()", "textOf is not given `() => document.getText()`"],
    ["DT04: the text is read before the memo is asked (every ask joins the buffer)", "  return memo.textOf(document, () => document.getText());", "  const text = document.getText();\n  return memo.textOf(document, () => text);", "textOf is not given `() => document.getText()`"],
    ["DT05: the memo is asked about a fresh object (its key never matches)", "memo.textOf(document, ", "memo.textOf({ version: document.version }, ", "textOf is not asked about the document documentText was given"],
    ["DT06: the module imports vscode at runtime", "import type * as vscode from \"vscode\";", "import * as vscode from \"vscode\";", "imports vscode at runtime"],
    ["DT07: the answer is not the memo's", "  return memo.textOf(document, () => document.getText());", "  memo.textOf(document, () => document.getText());\n  return document.getText();", "does not return the memo's `textOf(...)` answer itself"],
    ["DT08: the memo module is not imported", "import { createDocumentTextMemo } from \"../core/document-text-memo\";\n", "", "does not import ../core/document-text-memo"],
  ];

  const EXECUTION_TEXT_EDITS: Array<[string, string, string, string]> = [
    ["XT01: the text is read eagerly (a join on every cursor move in every language)", "      () => documentText(editor.document),\n", "      documentText(editor.document),\n", "does not hand isInCodeCell `() => documentText(editor.document)`"],
    ["XT02: the text is read through getText again (no memo)", "      () => documentText(editor.document),\n", "      () => editor.document.getText(),\n", "does not hand isInCodeCell `() => documentText(editor.document)`"],
    ["XT03: the import of documentText is dropped", "import { documentText } from \"./document-text\";\n", "", "execution.ts does not import documentText"],
    ["XT04: the text of another document is read", "      () => documentText(editor.document),\n", "      () => documentText(vscode.window.visibleTextEditors[0].document),\n", "does not hand isInCodeCell `() => documentText(editor.document)`"],
    ["XT05: the memo is also asked eagerly beside the thunk", "  setContextKey(IN_CELL_CONTEXT, inCell);\n}", "  void (editor !== undefined && documentText(editor.document));\n  setContextKey(IN_CELL_CONTEXT, inCell);\n}", "2 calls of documentText in updateCellContext"],
    ["XT06: getText is called beside the memo", "  setContextKey(IN_CELL_CONTEXT, inCell);\n}", "  void editor?.document.getText();\n  setContextKey(IN_CELL_CONTEXT, inCell);\n}", "updateCellContext calls getText itself"],
  ];

  const PREVIEW_TEXT_EDITS: Array<[string, string, string, string]> = [
    ["PT01: the predicate reads getText again (no memo)", "isRenderScript(doc.uri.fsPath, documentText(doc))", "isRenderScript(doc.uri.fsPath, doc.getText())", "does not end in `isRenderScript(doc.uri.fsPath, documentText(doc))`"],
    ["PT02: the extension prefilter comes after the read (a 20 MB log is joined on every keystroke)", "    isRenderScriptExtension(doc.uri.fsPath) &&\n    isRenderScript(doc.uri.fsPath, documentText(doc))", "    isRenderScript(doc.uri.fsPath, documentText(doc)) &&\n    isRenderScriptExtension(doc.uri.fsPath)", "does not come before the read of the text"],
    ["PT03: the extension prefilter is dropped", "    isRenderScriptExtension(doc.uri.fsPath) &&\n", "", "does not come before the read of the text"],
    ["PT04: the import of documentText is dropped", "import { documentText } from \"./document-text\";\n", "", "preview.ts does not import documentText"],
    ["PT05: getText is called in the chain before the prefilter", "    doc.uri.scheme === \"file\" &&\n", "    doc.uri.scheme === \"file\" &&\n    doc.getText() !== null &&\n", "isPreviewableRenderScript calls getText itself"],
    ["PT06: a further operand follows the read of the text", "isRenderScript(doc.uri.fsPath, documentText(doc))\n", "isRenderScript(doc.uri.fsPath, documentText(doc)) &&\n    doc.uri.fsPath !== \"\"\n", "the read of the text is not the last operand"],
  ];

  const BACKGROUND_TEXT_EDITS: Array<[string, string, string, string]> = [
    ["BT01: the ranges are built from getText again (no memo)", "cellBackgroundRanges(documentText(doc))", "cellBackgroundRanges(doc.getText())", "does not hand cellBackgroundRanges `documentText(doc)`"],
    ["BT02: the text is read before the guard (a join for a document that is not a quarto one)", "  if (doc.languageId !== \"quarto\" || !readCellBackgroundSettings().enabled) {\n    return [];\n  }\n  return cellBackgroundRanges(documentText(doc)).map(", "  const ranges = cellBackgroundRanges(documentText(doc));\n  if (doc.languageId !== \"quarto\" || !readCellBackgroundSettings().enabled) {\n    return [];\n  }\n  return ranges.map(", "the language and settings guard does not come before the read of the text"],
    ["BT03: the language is no longer part of the guard", "doc.languageId !== \"quarto\" || ", "", "the language and settings guard does not come before the read of the text"],
    ["BT04: the settings are no longer part of the guard", " || !readCellBackgroundSettings().enabled", "", "the language and settings guard does not come before the read of the text"],
    ["BT05: the import of documentText is dropped", "import { documentText } from \"./document-text\";\n", "", "cell-background.ts does not import documentText"],
    ["BT06: getText is called beside the memo", "  return cellBackgroundRanges(documentText(doc)).map(", "  void doc.getText();\n  return cellBackgroundRanges(documentText(doc)).map(", "cellBackgroundRangesFor calls getText itself"],
  ];

  const MEMO_CORE_EDITS: Array<[string, string, string, string]> = [
    ["MC01: an entry holds the document itself", "  readonly document: WeakRef<VersionedDocument>;", "  readonly document: VersionedDocument;", "Entry has the members"],
    ["MC02: the entry is stored with the document, not a WeakRef of it", "document: new WeakRef(document), version, text", "document: document as unknown as WeakRef<VersionedDocument>, version, text", "entries.push is not called twice"],
    ["MC03: a table keyed by the document", "  const entries: Entry[] = [];\n", "  const entries: Entry[] = [];\n  const byDocument = new Map<VersionedDocument, Entry>();\n  void byDocument;\n", "the file makes a Map"],
    ["MC04: an entry gets a second reference to the document", "  readonly text: string;\n}", "  readonly text: string;\n  readonly owner: VersionedDocument;\n}", "Entry has the members"],
    ["MC05: a second WeakRef is made (the document is stored twice)", "      const version = document.version;\n", "      const version = document.version;\n      void new WeakRef(document);\n", "does not make exactly one `new WeakRef(document)`"],
    ["MC06: an entry's version is not readonly", "  readonly document: WeakRef<VersionedDocument>;\n  readonly version: number;", "  readonly document: WeakRef<VersionedDocument>;\n  version: number;", "Entry has the members"],
  ];

  it.each(DOCUMENT_TEXT_EDITS)("document-text.ts, %s: the pin is broken, and is named", (_name, from, to, named) => {
    expect(DOCUMENT_TEXT.split(from).length - 1).toBe(1);
    const problems = problemsInDocumentTextAdapter(DOCUMENT_TEXT.replace(from, () => to));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain(named);
  });

  it.each(EXECUTION_TEXT_EDITS)("execution.ts, %s: the pin is broken, and is named", (_name, from, to, named) => {
    expect(EXECUTION.split(from).length - 1).toBe(1);
    const problems = problemsInExecutionText(EXECUTION.replace(from, () => to));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain(named);
  });

  it.each(PREVIEW_TEXT_EDITS)("preview.ts, %s: the pin is broken, and is named", (_name, from, to, named) => {
    expect(PREVIEW.split(from).length - 1).toBe(1);
    const problems = problemsInPreviewText(PREVIEW.replace(from, () => to));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain(named);
  });

  it.each(BACKGROUND_TEXT_EDITS)("cell-background.ts, %s: the pin is broken, and is named", (_name, from, to, named) => {
    expect(BACKGROUND.split(from).length - 1).toBe(1);
    const problems = problemsInBackgroundText(BACKGROUND.replace(from, () => to));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain(named);
  });

  it.each(MEMO_CORE_EDITS)("document-text-memo.ts, %s: the pin is broken, and is named", (_name, from, to, named) => {
    expect(MEMO_CORE.split(from).length - 1).toBe(1);
    const problems = problemsInMemoCore(MEMO_CORE.replace(from, () => to));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain(named);
  });

  // A pin read from the syntax tree is not moved by what is not code.
  it("a comment, a string and an unused identifier that spell the memo's calls do not satisfy the pins, and a comment that names getText does not break them", () => {
    const decoy = DOCUMENT_TEXT.replace("  return memo.textOf(document, () => document.getText());", "  // return memo.textOf(document, () => document.getText());\n  const unused = \"memo.textOf(document, () => document.getText())\" + `memo.textOf(document, () => document.getText())`;\n  void unused;\n  return document.getText();");
    expect(decoy).not.toBe(DOCUMENT_TEXT);
    expect(problemsInDocumentTextAdapter(decoy).join("\n")).toContain("does not return the memo's `textOf(...)` answer itself");
    const commented = DOCUMENT_TEXT.replace("const memo = createDocumentTextMemo();", "// document.getText() on every ask is what this replaced\nconst NOTE = 'document.getText()';\nconst memo = createDocumentTextMemo();");
    expect(commented).not.toBe(DOCUMENT_TEXT);
    expect(problemsInDocumentTextAdapter(commented)).toEqual([]);
    const execution = EXECUTION.replace("const IN_CELL_CONTEXT", "// () => editor.document.getText() was here\nconst NOTE = 'editor.document.getText()';\nconst IN_CELL_CONTEXT");
    expect(execution).not.toBe(EXECUTION);
    expect(problemsInExecutionText(execution)).toEqual([]);
    const preview = PREVIEW.replace("function isPreviewableRenderScript(", "// doc.getText() on every keystroke\nconst NOTE = 'doc.getText()';\nfunction isPreviewableRenderScript(");
    expect(preview).not.toBe(PREVIEW);
    expect(problemsInPreviewText(preview)).toEqual([]);
    const background = BACKGROUND.replace("export function cellBackgroundRangesFor(", "// doc.getText() on every refresh\nconst NOTE = 'doc.getText()';\nexport function cellBackgroundRangesFor(");
    expect(background).not.toBe(BACKGROUND);
    expect(problemsInBackgroundText(background)).toEqual([]);
  });
});

// ---- D3: THE CELL-BACKGROUND REFRESH PLAN ------------------------------------------------------------------------------------------------------------------------------------------------------------

/** The class `CellBackgroundDecorator` of cell-background.ts, and one of its members by name (a method or a property). */
const classNamed = (sf: ts.SourceFile, name: string): ts.ClassDeclaration | undefined => collect(sf, (n): n is ts.ClassDeclaration => ts.isClassDeclaration(n) && n.name?.text === name)[0];
const memberNamed = (cls: ts.ClassDeclaration, name: string): ts.ClassElement | undefined => cls.members.find((m) => m.name !== undefined && ts.isIdentifier(m.name) && m.name.text === name);
/** The statements of a method's body, as written. */
const bodyOf = (member: ts.ClassElement | undefined, sf: ts.SourceFile): string[] => (member !== undefined && ts.isMethodDeclaration(member) && member.body !== undefined ? member.body.statements.map((s) => flat(s, sf)) : ["?"]);

/**
 * Every pin `cell-background.ts` breaks about the refresh plan: ONE refresher per decorator (made in a property initializer, so its record of what is tinted lasts), handed the editors, the ranges and the apply, and the
 * two refresh methods that only call it. The handler that schedules the document refresh is pinned beside the other handlers in `s342-typing-wiring-pin.test.ts`.
 */
function problemsInBackgroundRefresh(source: string): string[] {
  const sf = parse("cell-background.ts", source);
  const problems: string[] = [];
  const decorator = classNamed(sf, "CellBackgroundDecorator");
  if (decorator === undefined) return ["the class CellBackgroundDecorator is missing"];
  const imports = collect(sf, (n): n is ts.ImportDeclaration => ts.isImportDeclaration(n)).filter((i) => ts.isStringLiteral(i.moduleSpecifier) && i.moduleSpecifier.text === "../core/cell-background-refresh");
  if (imports.length !== 1) problems.push("cell-background.ts does not import ../core/cell-background-refresh exactly once");
  // 1. One refresher, the initializer of a property of the class: made inside a method it would keep no record of what is tinted between calls.
  const makes = callsOf(sf, sf, "createCellBackgroundRefresher");
  const field = memberNamed(decorator, "refresher");
  if (makes.length !== 1) {
    problems.push(`${makes.length} calls of createCellBackgroundRefresher, not one`);
  } else if (field === undefined || !ts.isPropertyDeclaration(field) || field.initializer !== makes[0]) {
    problems.push("createCellBackgroundRefresher() is not the initializer of the property `refresher` of CellBackgroundDecorator (made in a method it would keep no record of what is tinted)");
  } else {
    const options = propertiesOf(makes[0].arguments[0], sf);
    if (Object.keys(options).sort().join() !== "apply,rangesFor,visible") problems.push(`the refresher is made with the options ${Object.keys(options).sort().join()}, not apply,rangesFor,visible`);
    if (options.rangesFor !== "(editor) => cellBackgroundRangesFor(editor.document)") problems.push("the refresher's rangesFor is not `(editor) => cellBackgroundRangesFor(editor.document)`");
    if (options.apply !== "(editor, ranges) => editor.setDecorations(this.decorationType, ranges)") problems.push("the refresher's apply is not `(editor, ranges) => editor.setDecorations(this.decorationType, ranges)` (an arrow function, so the decoration type is read when it is applied: reload makes a new one)");
    if (options.visible !== "() => vscode.window.visibleTextEditors.map((editor) => ({ key: editor.document.uri.toString(), languageId: editor.document.languageId, editor }))") {
      problems.push("the refresher's visible is not the visible editors with the key of each document (its URI) and its language id");
    }
  }
  // 2. The two refresh methods only call the refresher.
  const refresh = memberNamed(decorator, "refresh");
  if (bodyOf(refresh, sf).join() !== "return this.refresher.refreshAll();") problems.push("CellBackgroundDecorator.refresh is not exactly `return this.refresher.refreshAll();` (every other trigger refreshes every visible editor)");
  const after = memberNamed(decorator, "refreshAfterEdit");
  if (bodyOf(after, sf).join() !== "return this.refresher.refreshAfterEdit({ key: document.uri.toString(), languageId: document.languageId });") problems.push("CellBackgroundDecorator.refreshAfterEdit is not exactly `return this.refresher.refreshAfterEdit({ key: document.uri.toString(), languageId: document.languageId });`");
  if (after !== undefined && ts.isMethodDeclaration(after) && (after.parameters.length !== 1 || flat(after.parameters[0].name, sf) !== "document")) problems.push("CellBackgroundDecorator.refreshAfterEdit does not take exactly the parameter `document`");
  // 3. The tint is applied in one place, and the ranges are built in one place.
  if (callsOf(sf, sf, "editor.setDecorations").length !== 1) problems.push(`${callsOf(sf, sf, "editor.setDecorations").length} calls of editor.setDecorations in the file, not one (the refresher's apply)`);
  if (callsOf(sf, sf, "cellBackgroundRangesFor").length !== 1) problems.push(`${callsOf(sf, sf, "cellBackgroundRangesFor").length} calls of cellBackgroundRangesFor in the file, not one (the refresher's rangesFor)`);
  return problems;
}

describe("Session 343 -- how the cell-background adapter calls the refresh plan, pinned by the syntax tree (a unit test cannot run it: it imports vscode)", () => {
  it("cell-background.ts keeps every refresh pin: one refresher per decorator, its three options, the two refresh methods only calling it, the tint applied and the ranges built in one place each", () => {
    expect(problemsInBackgroundRefresh(BACKGROUND)).toEqual([]);
  });

  it("the decorator class and its refresh methods are there to be read", () => {
    const sf = parse("cell-background.ts", BACKGROUND);
    const decorator = classNamed(sf, "CellBackgroundDecorator");
    expect(decorator).toBeDefined();
    for (const name of ["refresher", "refresh", "refreshAfterEdit", "reload"]) expect(memberNamed(decorator as ts.ClassDeclaration, name), name).toBeDefined();
  });

  // The edits: each is a live file with ONE respelling, and the pin it must break. They are the mutants of `tools/mutation-run/mutants/s343-refresh-plan.json`, which the runner applies to the file itself.
  const BACKGROUND_REFRESH_EDITS: Array<[string, string, string, string]> = [
    ["RF01: the refresher is made on every read of a getter (it keeps no record of what is tinted)", "  private readonly refresher = createCellBackgroundRefresher({\n    visible: () => vscode.window.visibleTextEditors.map((editor) => ({ key: editor.document.uri.toString(), languageId: editor.document.languageId, editor })),\n    rangesFor: (editor) => cellBackgroundRangesFor(editor.document),\n    apply: (editor, ranges) => editor.setDecorations(this.decorationType, ranges),\n  });", "  private get refresher() {\n    return createCellBackgroundRefresher({\n      visible: () => vscode.window.visibleTextEditors.map((editor) => ({ key: editor.document.uri.toString(), languageId: editor.document.languageId, editor })),\n      rangesFor: (editor) => cellBackgroundRangesFor(editor.document),\n      apply: (editor, ranges) => editor.setDecorations(this.decorationType, ranges),\n    });\n  }", "is not the initializer of the property `refresher`"],
    ["RF02: the ranges are never built", "    rangesFor: (editor) => cellBackgroundRangesFor(editor.document),", "    rangesFor: () => [],", "the refresher's rangesFor is not"],
    ["RF03: the tint is applied with a decoration type captured when the refresher is made (reload makes a new one)", "    apply: (editor, ranges) => editor.setDecorations(this.decorationType, ranges),", "    apply: (editor, ranges) => editor.setDecorations(vscode.window.createTextEditorDecorationType({}), ranges),", "the refresher's apply is not"],
    ["RF04: the tint is applied with no ranges", "editor.setDecorations(this.decorationType, ranges)", "editor.setDecorations(this.decorationType, [])", "the refresher's apply is not"],
    ["RF05: an editor's key is its file name (an untitled or virtual document has none that is its URI)", "key: editor.document.uri.toString(), languageId: editor.document.languageId, editor })),", "key: editor.document.fileName, languageId: editor.document.languageId, editor })),", "the refresher's visible is not"],
    ["RF06: every editor's language id is quarto", "languageId: editor.document.languageId, editor })),", "languageId: \"quarto\", editor })),", "the refresher's visible is not"],
    ["RF07: only the first visible editor is offered", "vscode.window.visibleTextEditors.map(", "vscode.window.visibleTextEditors.slice(0, 1).map(", "the refresher's visible is not"],
    ["RF08: refresh() answers nothing", "    return this.refresher.refreshAll();", "    return new Map();", "CellBackgroundDecorator.refresh is not exactly"],
    ["RF09: refresh() is the plan of an edit (an active-editor change would refresh one document)", "    return this.refresher.refreshAll();", "    return this.refresher.refreshAfterEdit({ key: \"\", languageId: \"quarto\" });", "CellBackgroundDecorator.refresh is not exactly"],
    ["RF10: an edit is told the document is a quarto one whatever it is", "this.refresher.refreshAfterEdit({ key: document.uri.toString(), languageId: document.languageId })", "this.refresher.refreshAfterEdit({ key: document.uri.toString(), languageId: \"quarto\" })", "CellBackgroundDecorator.refreshAfterEdit is not exactly"],
    ["RF11: an edit refreshes every editor again", "    return this.refresher.refreshAfterEdit({ key: document.uri.toString(), languageId: document.languageId });", "    return this.refresher.refreshAll();", "CellBackgroundDecorator.refreshAfterEdit is not exactly"],
    ["RF12: an edit is told another document's key", "refreshAfterEdit({ key: document.uri.toString(), languageId: document.languageId })", "refreshAfterEdit({ key: document.fileName, languageId: document.languageId })", "CellBackgroundDecorator.refreshAfterEdit is not exactly"],
    ["RF13: refresh() sets decorations itself as well", "  refresh(): Map<string, vscode.Range[]> {\n    return this.refresher.refreshAll();", "  refresh(): Map<string, vscode.Range[]> {\n    for (const editor of vscode.window.visibleTextEditors) {\n      editor.setDecorations(this.decorationType, []);\n    }\n    return this.refresher.refreshAll();", "calls of editor.setDecorations in the file, not one"],
    ["RF14: an edit builds the document's ranges itself as well", "    return this.refresher.refreshAfterEdit({ key: document.uri.toString(), languageId: document.languageId });", "    void cellBackgroundRangesFor(document);\n    return this.refresher.refreshAfterEdit({ key: document.uri.toString(), languageId: document.languageId });", "CellBackgroundDecorator.refreshAfterEdit is not exactly"],
    ["RF15: the import of the refresher is dropped", "import { createCellBackgroundRefresher } from \"../core/cell-background-refresh\";\n", "", "does not import ../core/cell-background-refresh"],
    ["RF16: refreshAfterEdit takes a second parameter", "  refreshAfterEdit(document: vscode.TextDocument): Map<string, vscode.Range[]> {", "  refreshAfterEdit(document: vscode.TextDocument, extra?: number): Map<string, vscode.Range[]> {", "does not take exactly the parameter `document`"],
    ["RF17: a second refresher is made at registration", "  const decorator = new CellBackgroundDecorator();\n", "  const decorator = new CellBackgroundDecorator();\n  void createCellBackgroundRefresher({ visible: () => [], rangesFor: () => [], apply: () => undefined });\n", "2 calls of createCellBackgroundRefresher"],
    ["RF18: the refresher gets a fourth option", "    apply: (editor, ranges) => editor.setDecorations(this.decorationType, ranges),\n  });", "    apply: (editor, ranges) => editor.setDecorations(this.decorationType, ranges),\n    extra: 1,\n  } as never);", "the refresher is made with the options"],
    ["RF19: the ranges are built a second time in the file", "  refresh(): Map<string, vscode.Range[]> {", "  private unused(editor: vscode.TextEditor): vscode.Range[] {\n    return cellBackgroundRangesFor(editor.document);\n  }\n\n  refresh(): Map<string, vscode.Range[]> {", "2 calls of cellBackgroundRangesFor in the file"],
  ];

  it.each(BACKGROUND_REFRESH_EDITS)("cell-background.ts, %s: the pin is broken, and is named", (_name, from, to, named) => {
    expect(BACKGROUND.split(from).length - 1).toBe(1);
    const problems = problemsInBackgroundRefresh(BACKGROUND.replace(from, () => to));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain(named);
  });

  it("a comment, a string and an unused identifier that spell the refresher's calls do not satisfy the pins, and a comment that names the old loop does not break them", () => {
    const decoy = BACKGROUND.replace("    return this.refresher.refreshAll();", "    // return this.refresher.refreshAll();\n    const unused = \"return this.refresher.refreshAll();\" + `this.refresher.refreshAll()`;\n    void unused;\n    return new Map();");
    expect(decoy).not.toBe(BACKGROUND);
    expect(problemsInBackgroundRefresh(decoy).join("\n")).toContain("CellBackgroundDecorator.refresh is not exactly");
    const commented = BACKGROUND.replace("function isVisible(", "// for (const editor of vscode.window.visibleTextEditors) { editor.setDecorations(type, ranges) } was here\nconst NOTE = 'editor.setDecorations(this.decorationType, ranges)';\nfunction isVisible(");
    expect(commented).not.toBe(BACKGROUND);
    expect(problemsInBackgroundRefresh(commented)).toEqual([]);
  });
});
