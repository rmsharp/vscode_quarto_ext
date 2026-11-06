import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as ts from "typescript";

// Session 342, part (3) of the BACKLOG item "What Session 341's review round found beside the Outline and preview cures". `src/providers/embedded.ts` and `src/features/format-cell.ts` import `vscode`, so no unit test can
// run them: how each uses the range lookup (`createRangeLookup`, `src/core/embedded/virtual-doc.ts`) is pinned here by its SOURCE, read with the TypeScript compiler API (`ts.createSourceFile`, then the syntax tree), not with a
// text search (Learning 911). A comment, a string or an unused identifier can neither satisfy nor break a pin made this way.
//
// What the pins keep is the whole point of the change: the old adapters asked `embeddedCellAt(text, line)` (and `findCellAtPosition`) once per LINE of every edit, a scan of every cell each time. The pins say that every
// such call left in an adapter is the ONE gate call at the top of a provider method or of the command (`embeddedCellAt(text, position.line)`, not in a loop, not in a callback), that the edit check is made of ONE lookup per
// call made directly in the function that filters, over the call's own text, and that the filter hands the lookup the edit's start line, end line and the language or cell, and nothing else.
//
// ⚠ WHAT THIS DOES NOT SEE. It pins how the call sites are SPELLED. It does not run the adapters: whether VS Code then drops an out-of-cell edit is the behaviour check `test/integration/suite` and `test/lsp`, which open a
// real VS Code window, take over the screen, and were NOT run for this change.
//
// The checks are two functions, `problemsInCompletion(source)` and `problemsInFormat(source)`, each naming every pin the source breaks. The live files must have none, and the rows below also hand each the live file with ONE
// edit and require it to name the pin that edit breaks: the pin can fail, and says which. The edits are the mutants of `tools/mutation-run/mutants/s342-range-lookup.json`, and (the rows named A01 to A04 and FA, the
// lines around the filter call) of `tools/mutation-run/mutants/s342-review-typing.json`.

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const COMPLETION = readFileSync(resolve(root, "src", "providers", "embedded.ts"), "utf8");
const FORMAT = readFileSync(resolve(root, "src", "features", "format-cell.ts"), "utf8");

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

const isId = (node: ts.Node | undefined, name: string): boolean => node !== undefined && ts.isIdentifier(node) && node.text === name;
/** The text of a node with every run of whitespace collapsed: a syntax node's own spelling, not a search over the file. */
const flat = (node: ts.Node, sf: ts.SourceFile): string => node.getText(sf).replace(/\s+/g, " ");
const isProp = (node: ts.Node | undefined, object: string, name: string): boolean => node !== undefined && ts.isPropertyAccessExpression(node) && isId(node.expression, object) && node.name.text === name;
/** `object.name(...)` */
const isMethodCall = (node: ts.Node | undefined, object: string, name: string): node is ts.CallExpression => node !== undefined && ts.isCallExpression(node) && isProp(node.expression, object, name);
/** A call whose callee is the plain identifier `name`. */
const isPlainCall = (node: ts.Node, name: string): node is ts.CallExpression => ts.isCallExpression(node) && isId(node.expression, name);
const argsAre = (call: ts.CallExpression, ...tests: Array<(n: ts.Expression) => boolean>): boolean => call.arguments.length === tests.length && tests.every((test, i) => test(call.arguments[i]));
const id = (name: string) => (n: ts.Expression): boolean => isId(n, name);
/** `<param>.range.start.line` and `<param>.range.end.line`: the two numbers a `vscode.Range` holds that the lookup asks about. */
const rangeLine = (param: string, end: "start" | "end") => (n: ts.Expression): boolean =>
  ts.isPropertyAccessExpression(n) &&
  n.name.text === "line" &&
  ts.isPropertyAccessExpression(n.expression) &&
  n.expression.name.text === end &&
  isProp(n.expression.expression, param, "range");

/** The nearest function-like node around `node` (a function declaration, a method, an arrow function or a function expression). */
function enclosingFunction(node: ts.Node): ts.Node | undefined {
  for (let up = node.parent; up !== undefined; up = up.parent) {
    if (ts.isFunctionDeclaration(up) || ts.isMethodDeclaration(up) || ts.isArrowFunction(up) || ts.isFunctionExpression(up)) return up;
  }
  return undefined;
}

/** Whether `node` sits in a loop or a callback on its way up to the nearest function declaration or method: a call there runs once per element. */
function repeated(node: ts.Node): boolean {
  for (let up = node.parent; up !== undefined; up = up.parent) {
    if (ts.isFunctionDeclaration(up) || ts.isMethodDeclaration(up)) return false;
    if (ts.isForStatement(up) || ts.isForOfStatement(up) || ts.isForInStatement(up) || ts.isWhileStatement(up) || ts.isDoStatement(up) || ts.isArrowFunction(up) || ts.isFunctionExpression(up)) return true;
  }
  return false;
}

/** The nearest function DECLARATION or METHOD around `node`, whatever arrow functions lie between. */
function owningDeclaration(node: ts.Node): ts.FunctionDeclaration | ts.MethodDeclaration | undefined {
  for (let up = node.parent; up !== undefined; up = up.parent) {
    if (ts.isFunctionDeclaration(up) || ts.isMethodDeclaration(up)) return up;
  }
  return undefined;
}

const declarationName = (fn: ts.FunctionDeclaration | ts.MethodDeclaration | undefined): string => (fn !== undefined && fn.name !== undefined && ts.isIdentifier(fn.name) ? fn.name.text : "?");
const functionNamed = (sf: ts.SourceFile, name: string): ts.FunctionDeclaration | ts.MethodDeclaration | undefined =>
  collect(sf, (n): n is ts.FunctionDeclaration | ts.MethodDeclaration => (ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) && isId(n.name, name))[0];
const parameterNames = (fn: ts.FunctionLikeDeclaration): string[] => fn.parameters.map((p) => (ts.isIdentifier(p.name) ? p.name.text : "?"));

/** The `.filter(<arrow>)` calls on the plain identifier `receiver` anywhere under `body`, with the arrow's first parameter name and the call that is its body. */
function filterCalls(body: ts.Node, receiver: string): Array<{ call: ts.CallExpression; param: string; inner: ts.CallExpression | undefined }> {
  return collect(body, (n): n is ts.CallExpression => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "filter" && isId(n.expression.expression, receiver)).map((call) => {
    const arrow = call.arguments[0];
    const ok = arrow !== undefined && ts.isArrowFunction(arrow);
    const param = ok && arrow.parameters[0] !== undefined && ts.isIdentifier(arrow.parameters[0].name) ? arrow.parameters[0].name.text : "?";
    return { call, param, inner: ok && ts.isCallExpression(arrow.body) ? arrow.body : undefined };
  });
}

/** The `lookup` is `const lookup = createRangeLookup(text)` among the statements of `fn`'s body, the only such call in the file, and made before `before` (a position in the file). Names every pin it breaks. */
function lookupProblems(sf: ts.SourceFile, fn: ts.FunctionDeclaration | ts.MethodDeclaration, name: string, textOf: string, before: number | undefined): string[] {
  const problems: string[] = [];
  const makes = collect(sf, (n): n is ts.CallExpression => isPlainCall(n, "createRangeLookup"));
  if (makes.length !== 1) {
    problems.push(`${makes.length} calls of createRangeLookup, not one`);
    return problems;
  }
  const [make] = makes;
  if (enclosingFunction(make) !== fn) problems.push(`createRangeLookup is not called directly in ${name} (inside an arrow function or another function it runs once per edit or per item)`);
  if (!argsAre(make, id(textOf))) problems.push(`createRangeLookup is not called over the call's own text (the identifier \`${textOf}\`)`);
  const declaration = make.parent;
  const statement = declaration?.parent?.parent;
  if (!(declaration !== undefined && ts.isVariableDeclaration(declaration) && isId(declaration.name, "lookup") && statement !== undefined && ts.isVariableStatement(statement) && statement.parent === fn.body)) {
    problems.push(`the lookup is not the initializer of \`const lookup\` among the statements of ${name} (in a loop it runs once per item)`);
  }
  if (before !== undefined && make.end > before) problems.push(`the lookup is made after the edits are filtered in ${name}`);
  return problems;
}

/** Every pin `source` (the completion provider, `src/providers/embedded.ts`) breaks, each named by what it was meant to keep. `[]` is a source that keeps them all. */
function problemsInCompletion(source: string): string[] {
  const sf = parse("embedded.ts", source);
  const problems: string[] = [];

  // 1. Every embeddedCellAt call left is the gate at the top of a provider method: `embeddedCellAt(text, position.line)`, directly in a `provide...` method, in no loop and no callback. A call per line has `line` for its second argument,
  //    sits in a loop, or sits in the filter.
  for (const call of collect(sf, (n): n is ts.CallExpression => isPlainCall(n, "embeddedCellAt"))) {
    const declaration = owningDeclaration(call);
    const owner = declarationName(declaration);
    const inProvider = declaration !== undefined && ts.isMethodDeclaration(declaration) && owner.startsWith("provide");
    if (!inProvider || repeated(call) || !argsAre(call, id("text"), (n) => isProp(n, "position", "line"))) {
      problems.push(`an embeddedCellAt call that is not embeddedCellAt(text, position.line) directly in a provider method (in ${owner}: a call per line, in a loop or a callback)`);
    }
  }
  if (collect(sf, (n): n is ts.Identifier => ts.isIdentifier(n) && n.text === "findCellAtPosition").length > 0) problems.push("the identifier findCellAtPosition is used");
  for (const name of ["rangeInSameLangBody"]) {
    if (functionNamed(sf, name) !== undefined) problems.push(`the per-line helper ${name} is back`);
  }

  // 2. The filter: one lookup, made in `filterOutOfCellEdits` itself, over its `text`, before the items are walked, and asked with the edit's start line, end line and the completion's language.
  const filter = functionNamed(sf, "filterOutOfCellEdits");
  if (filter === undefined || filter.body === undefined) {
    problems.push("filterOutOfCellEdits is missing");
    return problems;
  }
  if (parameterNames(filter).join() !== "list,text,languageId") problems.push("filterOutOfCellEdits does not take (list, text, languageId)");
  const walk = collect(filter.body, (n): n is ts.ForOfStatement => ts.isForOfStatement(n))[0];
  problems.push(...lookupProblems(sf, filter, "filterOutOfCellEdits", "text", walk === undefined ? undefined : walk.getStart(sf)));
  if (collect(filter.body, (n): n is ts.CallExpression => isPlainCall(n, "embeddedCellAt")).length > 0) problems.push("filterOutOfCellEdits calls embeddedCellAt");
  const edits = filterCalls(filter.body, "edits");
  if (edits.length !== 1) {
    problems.push(`${edits.length} edits.filter calls in filterOutOfCellEdits, not one`);
  } else {
    const [{ param, inner }] = edits;
    if (inner === undefined || !isMethodCall(inner, "lookup", "rangeInLanguageBody") || !argsAre(inner, rangeLine(param, "start"), rangeLine(param, "end"), id("languageId"))) {
      problems.push("the edit filter is not lookup.rangeInLanguageBody(e.range.start.line, e.range.end.line, languageId)");
    }
    const owner = edits[0].call.parent;
    if (!(ts.isVariableDeclaration(owner) && isId(owner.name, "kept"))) problems.push("the edit filter's result is not `const kept` in filterOutOfCellEdits");
  }

  // 2b. The lines AROUND the filter call (the Session 342 review round, M-03): the guard that lets an item with ONE additional edit (the usual auto-import) through to the filter, the assignment that keeps what the filter kept
  //     and nothing else, and the list rebuilt with the server's own `isIncomplete`. An empty list or none for an item with no kept edit is the same to VS Code, so the assignment is pinned to be made from `kept` alone, not to its spelling.
  if (walk === undefined || flat(walk.expression, sf) !== "list.items") problems.push("filterOutOfCellEdits does not walk `list.items` (every item of the list must have its edits checked, the first one too)");
  const guards = walk === undefined ? [] : collect(walk, (n): n is ts.IfStatement => ts.isIfStatement(n));
  if (guards.length !== 1 || flat(guards[0].expression, sf) !== "edits !== undefined && edits.length > 0") {
    problems.push("the edit guard of filterOutOfCellEdits is not `edits !== undefined && edits.length > 0` (an item with ONE additional edit, the usual auto-import, would keep an edit outside the cell)");
  }
  const assigns = collect(filter.body, (n): n is ts.BinaryExpression => ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && flat(n.left, sf) === "item.additionalTextEdits");
  if (assigns.length !== 1) {
    problems.push(`${assigns.length} assignments to item.additionalTextEdits in filterOutOfCellEdits, not one`);
  } else {
    const made = collect(assigns[0].right, (n): n is ts.Identifier => ts.isIdentifier(n)).map((n) => n.text);
    if (!made.includes("kept") || made.includes("edits")) problems.push("what filterOutOfCellEdits assigns to item.additionalTextEdits is not made from `kept` alone (the filter's result is thrown away when the unfiltered `edits` are kept)");
  }
  const lastStatement = filter.body.statements[filter.body.statements.length - 1];
  if (lastStatement === undefined || !ts.isReturnStatement(lastStatement) || lastStatement.expression === undefined || flat(lastStatement.expression, sf) !== "new vscode.CompletionList(list.items, list.isIncomplete)") {
    problems.push("filterOutOfCellEdits does not end by returning `new vscode.CompletionList(list.items, list.isIncomplete)` (the server's isIncomplete would be lost)");
  }

  // 3. The provider hands the filter its own text and the hit's language.
  const provide = functionNamed(sf, "provideCompletionItems");
  const handed = provide?.body === undefined ? [] : collect(provide.body, (n): n is ts.CallExpression => isPlainCall(n, "filterOutOfCellEdits"));
  if (handed.length !== 1 || !argsAre(handed[0], id("list"), id("text"), (n) => isProp(n, "hit", "languageId"))) {
    problems.push("provideCompletionItems does not call filterOutOfCellEdits(list, text, hit.languageId) once");
  }
  return problems;
}

/** Every pin `source` (the Format Cell command, `src/features/format-cell.ts`) breaks, each named by what it was meant to keep. `[]` is a source that keeps them all. */
function problemsInFormat(source: string): string[] {
  const sf = parse("format-cell.ts", source);
  const problems: string[] = [];
  const command = functionNamed(sf, "formatCellAtCursor");
  if (command === undefined || command.body === undefined) {
    return ["formatCellAtCursor is missing"];
  }

  // 1. The two gate calls at the top of the command are the only per-document calls left: one embeddedCellAt and one findCellAtPosition, each over the command's text and the cursor's line, in no loop and no callback.
  for (const name of ["embeddedCellAt", "findCellAtPosition"]) {
    const calls = collect(sf, (n): n is ts.CallExpression => isPlainCall(n, name));
    if (calls.length !== 1) problems.push(`${calls.length} calls of ${name}, not one`);
    for (const call of calls) {
      if (owningDeclaration(call) !== command || repeated(call) || !argsAre(call, id("text"), (n) => isProp(n, "position", "line"))) {
        problems.push(`a call of ${name} that is not ${name}(text, position.line) directly in formatCellAtCursor (a call per line, in a loop or a callback)`);
      }
    }
  }
  if (functionNamed(sf, "rangeWithinCell") !== undefined) problems.push("the per-line helper rangeWithinCell is back");

  // 2. The text is read once, and the one lookup is made over it before the formatter's edits are filtered.
  const reads = collect(sf, (n): n is ts.CallExpression => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "getText");
  if (reads.length !== 1) problems.push(`${reads.length} reads of the document text (getText), not one`);
  const text = collect(command.body, (n): n is ts.VariableDeclaration => ts.isVariableDeclaration(n) && isId(n.name, "text"))[0];
  if (text === undefined || text.initializer === undefined || !ts.isCallExpression(text.initializer) || !ts.isPropertyAccessExpression(text.initializer.expression) || text.initializer.expression.name.text !== "getText") {
    problems.push("`text` is not the document's getText() in formatCellAtCursor");
  }
  const filters = filterCalls(command.body, "edits");
  problems.push(...lookupProblems(sf, command, "formatCellAtCursor", "text", filters[0]?.call.getStart(sf)));

  // 3. The filter asks the lookup with the edit's start line, end line and the cursor's own cell.
  if (filters.length !== 1) {
    problems.push(`${filters.length} edits.filter calls in formatCellAtCursor, not one`);
  } else {
    const [{ param, inner }] = filters;
    if (inner === undefined || !isMethodCall(inner, "lookup", "rangeInCellBody") || !argsAre(inner, rangeLine(param, "start"), rangeLine(param, "end"), id("cell"))) {
      problems.push("the edit filter is not lookup.rangeInCellBody(e.range.start.line, e.range.end.line, cell)");
    }
    const owner = filters[0].call.parent;
    if (!(ts.isVariableDeclaration(owner) && isId(owner.name, "kept"))) problems.push("the edit filter's result is not `const kept` in formatCellAtCursor");
  }

  // 4. What the command applies is what the filter kept (the Session 342 review round, M-03): the corruption guard is only a guard if its result is the edit set. (The early return on an empty `kept` is not pinned: with the
  //    unfiltered `edits` in its test it can never be true, and an empty edit applied is a no-op.)
  const sets = collect(command.body, (n): n is ts.CallExpression => isMethodCall(n, "wsEdit", "set"));
  if (sets.length !== 1 || !argsAre(sets[0], (n) => flat(n, sf) === "editor.document.uri", id("kept"))) {
    problems.push("formatCellAtCursor does not apply `wsEdit.set(editor.document.uri, kept)` once (the filter's result must be what is applied)");
  }
  return problems;
}

describe("Session 342 -- the edit checks' use of the range lookup, pinned by the syntax tree of src/providers/embedded.ts and src/features/format-cell.ts (a unit test cannot run them: they import vscode)", () => {
  it("the live completion provider keeps every pin: one lookup in filterOutOfCellEdits, asked with the edit's lines and the language, and no per-line embeddedCellAt call", () => {
    expect(problemsInCompletion(COMPLETION)).toEqual([]);
  });

  it("the live Format Cell command keeps every pin: one lookup in formatCellAtCursor, asked with the edit's lines and the cell, and no per-line embeddedCellAt or findCellAtPosition call", () => {
    expect(problemsInFormat(FORMAT)).toEqual([]);
  });

  it("the files parsed are the adapters: they have the functions the pins read, and parse without a syntax error", () => {
    const completion = parse("embedded.ts", COMPLETION);
    const format = parse("format-cell.ts", FORMAT);
    for (const name of ["filterOutOfCellEdits", "provideCompletionItems", "provideHover", "provideDefinition", "provideSignatureHelp"]) expect(functionNamed(completion, name)).toBeDefined();
    for (const name of ["formatCellAtCursor", "formattingOptions"]) expect(functionNamed(format, name)).toBeDefined();
    expect(collect(completion, (n): n is ts.CallExpression => isPlainCall(n, "embeddedCellAt")).map((c) => declarationName(owningDeclaration(c)))).toEqual(["provideCompletionItems", "provideHover", "provideDefinition", "provideSignatureHelp"]);
    for (const sf of [completion, format]) expect((sf as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics).toEqual([]);
  });

  // The edits: each is the live file with ONE respelling, and the pin it must break. They are the mutants the runner applies to the file itself.
  const COMPLETION_EDITS: Array<[string, string, string, string]> = [
    // [name, from, to, a word of the problem it must be named by]
    [
      "P01: the old per-line check back in the filter",
      "      const kept = edits.filter((e) =>\n        lookup.rangeInLanguageBody(e.range.start.line, e.range.end.line, languageId),\n      );",
      "      const kept = edits.filter((e) => {\n        for (let line = e.range.start.line; line <= e.range.end.line; line++) {\n          const hit = embeddedCellAt(text, line);\n          if (hit === null || hit.languageId !== languageId) return false;\n        }\n        return true;\n      });",
      "filterOutOfCellEdits calls embeddedCellAt",
    ],
    [
      "P02: a lookup per edit",
      "      const kept = edits.filter((e) =>\n        lookup.rangeInLanguageBody(e.range.start.line, e.range.end.line, languageId),\n      );",
      "      const kept = edits.filter((e) =>\n        createRangeLookup(text).rangeInLanguageBody(e.range.start.line, e.range.end.line, languageId),\n      );",
      "calls of createRangeLookup",
    ],
    [
      "P03: a lookup per item",
      "  const lookup = createRangeLookup(text);\n  for (const item of list.items) {\n    const edits = item.additionalTextEdits;",
      "  for (const item of list.items) {\n    const lookup = createRangeLookup(text);\n    const edits = item.additionalTextEdits;",
      "not the initializer of `const lookup` among the statements of filterOutOfCellEdits",
    ],
    ["P04: a lookup over an empty text", "  const lookup = createRangeLookup(text);\n  for (const item of list.items) {", "  const lookup = createRangeLookup(\"\");\n  for (const item of list.items) {", "the call's own text"],
    [
      "P05: the start line asked as the end line",
      "lookup.rangeInLanguageBody(e.range.start.line, e.range.end.line, languageId)",
      "lookup.rangeInLanguageBody(e.range.start.line, e.range.start.line, languageId)",
      "the edit filter is not lookup.rangeInLanguageBody",
    ],
    [
      "P06: the two lines swapped",
      "lookup.rangeInLanguageBody(e.range.start.line, e.range.end.line, languageId)",
      "lookup.rangeInLanguageBody(e.range.end.line, e.range.start.line, languageId)",
      "the edit filter is not lookup.rangeInLanguageBody",
    ],
    [
      "P07: python for every completion's language",
      "lookup.rangeInLanguageBody(e.range.start.line, e.range.end.line, languageId)",
      "lookup.rangeInLanguageBody(e.range.start.line, e.range.end.line, \"python\")",
      "the edit filter is not lookup.rangeInLanguageBody",
    ],
    [
      "P08: the cell check where the language check belongs",
      "lookup.rangeInLanguageBody(e.range.start.line, e.range.end.line, languageId)",
      "lookup.rangeInCellBody(e.range.start.line, e.range.end.line, languageId)",
      "the edit filter is not lookup.rangeInLanguageBody",
    ],
    [
      "P09: the lookup made after the items are walked",
      "  const lookup = createRangeLookup(text);\n  for (const item of list.items) {",
      "  for (const item of list.items) {\n    void item;\n  }\n  const lookup = createRangeLookup(text);\n  for (const item of list.items) {",
      "made after the edits are filtered",
    ],
    ["P10: the filter handed an empty text", "    return filterOutOfCellEdits(list, text, hit.languageId);", "    return filterOutOfCellEdits(list, \"\", hit.languageId);", "provideCompletionItems does not call filterOutOfCellEdits(list, text, hit.languageId)"],
    ["P11: the filter handed the document's own language, not the hit's", "    return filterOutOfCellEdits(list, text, hit.languageId);", "    return filterOutOfCellEdits(list, text, \"python\");", "provideCompletionItems does not call filterOutOfCellEdits(list, text, hit.languageId)"],
    [
      "P12: a per-line gate call in the hover provider",
      "    const hit = embeddedCellAt(text, position.line);\n    if (hit === null) {\n      return undefined;\n    }\n    const vdocUri = await vdocFor(document, text, hit);\n    if (vdocUri === undefined) {\n      return undefined;\n    }\n    const hovers",
      "    const hit = embeddedCellAt(text, position.line);\n    for (let line = 0; line < 3; line++) embeddedCellAt(text, line);\n    if (hit === null) {\n      return undefined;\n    }\n    const vdocUri = await vdocFor(document, text, hit);\n    if (vdocUri === undefined) {\n      return undefined;\n    }\n    const hovers",
      "an embeddedCellAt call that is not embeddedCellAt(text, position.line)",
    ],
    ["P13: findCellAtPosition imported and used", "function filterOutOfCellEdits(", "const unused = (t: string): unknown => findCellAtPosition(t, 0);\nfunction filterOutOfCellEdits(", "findCellAtPosition"],
    ["P14: the old helper back", "function filterOutOfCellEdits(", "function rangeInSameLangBody(): boolean {\n  return true;\n}\nfunction filterOutOfCellEdits(", "rangeInSameLangBody is back"],
    ["P15: the filter takes its parameters in another order", "  text: string,\n  languageId: string,\n): vscode.CompletionList | undefined {\n  if (list === undefined) {", "  languageId: string,\n  text: string,\n): vscode.CompletionList | undefined {\n  if (list === undefined) {", "does not take (list, text, languageId)"],
    // The Session 342 review round (mutation lens, M-03): the lines AROUND the filter call. These are mutants of `tools/mutation-run/mutants/s342-review-typing.json` (A01, A02, A04).
    [
      "A01: an item with exactly ONE additional edit is not checked (the guard is `edits.length > 1`): the usual auto-import, anchored at the module top, would keep an edit in the front matter",
      "    if (edits !== undefined && edits.length > 0) {",
      "    if (edits !== undefined && edits.length > 1) {",
      "the edit guard of filterOutOfCellEdits",
    ],
    [
      "A03: the first item is not walked (`list.items.slice(1)`): its out-of-cell edits are kept",
      "  for (const item of list.items) {\n    const edits = item.additionalTextEdits;",
      "  for (const item of list.items.slice(1)) {\n    const edits = item.additionalTextEdits;",
      "does not walk `list.items`",
    ],
    [
      "A04: the list is rebuilt incomplete (the server's isIncomplete is lost)",
      "  return new vscode.CompletionList(list.items, list.isIncomplete);",
      "  return new vscode.CompletionList(list.items, true);",
      "does not end by returning `new vscode.CompletionList(list.items, list.isIncomplete)`",
    ],
  ];

  const FORMAT_EDITS: Array<[string, string, string, string]> = [
    [
      "F01: the old per-line check back in the filter",
      "  const kept = edits.filter((e) => lookup.rangeInCellBody(e.range.start.line, e.range.end.line, cell));",
      "  const kept = edits.filter((e) => {\n    for (let line = e.range.start.line; line <= e.range.end.line; line++) {\n      if (embeddedCellAt(text, line) === null) return false;\n      const owner = findCellAtPosition(text, line);\n      if (owner === null || owner.startLine !== cell.startLine) return false;\n    }\n    return true;\n  });",
      "a call of embeddedCellAt that is not embeddedCellAt(text, position.line)",
    ],
    [
      "F02: a lookup per edit",
      "  const kept = edits.filter((e) => lookup.rangeInCellBody(e.range.start.line, e.range.end.line, cell));",
      "  const kept = edits.filter((e) => createRangeLookup(text).rangeInCellBody(e.range.start.line, e.range.end.line, cell));",
      "calls of createRangeLookup",
    ],
    ["F03: a lookup over an empty text", "  const lookup = createRangeLookup(text);", "  const lookup = createRangeLookup(\"\");", "the call's own text"],
    [
      "F04: the end line asked as the start line",
      "lookup.rangeInCellBody(e.range.start.line, e.range.end.line, cell)",
      "lookup.rangeInCellBody(e.range.end.line, e.range.end.line, cell)",
      "the edit filter is not lookup.rangeInCellBody",
    ],
    [
      "F05: the lines swapped",
      "lookup.rangeInCellBody(e.range.start.line, e.range.end.line, cell)",
      "lookup.rangeInCellBody(e.range.end.line, e.range.start.line, cell)",
      "the edit filter is not lookup.rangeInCellBody",
    ],
    [
      "F06: any cell but the cursor's own",
      "lookup.rangeInCellBody(e.range.start.line, e.range.end.line, cell)",
      "lookup.rangeInCellBody(e.range.start.line, e.range.end.line, { ...cell, startLine: -1 })",
      "the edit filter is not lookup.rangeInCellBody",
    ],
    [
      "F07: the language check where the cell check belongs",
      "lookup.rangeInCellBody(e.range.start.line, e.range.end.line, cell)",
      "lookup.rangeInLanguageBody(e.range.start.line, e.range.end.line, hit.languageId)",
      "the edit filter is not lookup.rangeInCellBody",
    ],
    [
      "F08: the lookup made after the filter",
      "  const lookup = createRangeLookup(text);\n  const kept = edits.filter((e) => lookup.rangeInCellBody(e.range.start.line, e.range.end.line, cell));",
      "  const kept = edits.filter((e) => lookup.rangeInCellBody(e.range.start.line, e.range.end.line, cell));\n  const lookup = createRangeLookup(text);",
      "made after the edits are filtered",
    ],
    ["F09: the lookup made inside an arrow function", "  const lookup = createRangeLookup(text);", "  const lookup = (() => createRangeLookup(text))();", "not called directly in formatCellAtCursor"],
    ["F10: a second gate call over another line", "  const cell = findCellAtPosition(text, position.line);", "  const cell = findCellAtPosition(text, position.line + 1);", "a call of findCellAtPosition that is not findCellAtPosition(text, position.line)"],
    ["F11: a second embeddedCellAt call", "  const cell = findCellAtPosition(text, position.line);", "  const cell = findCellAtPosition(text, position.line);\n  void embeddedCellAt(text, position.line + 2);", "2 calls of embeddedCellAt, not one"],
    ["F12: the helper back", "async function formatCellAtCursor(): Promise<void> {", "function rangeWithinCell(): boolean {\n  return true;\n}\nasync function formatCellAtCursor(): Promise<void> {", "rangeWithinCell is back"],
    ["F13: the text read twice", "  const kept = edits.filter(", "  void editor.document.getText();\n  const kept = edits.filter(", "2 reads of the document text"],
    // The Session 342 review round (mutation lens, M-03): the line AFTER the filter call. A mutant of `tools/mutation-run/mutants/s342-review-typing.json` (FA).
    [
      "FA: the filter's result is not applied (`kept` is computed and tested, then the unfiltered `edits` are set): the corruption guard is gone",
      "  wsEdit.set(editor.document.uri, kept);",
      "  wsEdit.set(editor.document.uri, edits);",
      "does not apply `wsEdit.set(editor.document.uri, kept)`",
    ],
  ];

  it.each(COMPLETION_EDITS)("%s: the pin is broken, and is named", (_name, from, to, named) => {
    expect(COMPLETION.split(from).length - 1).toBe(1); // the edit applies to the live file exactly once
    const problems = problemsInCompletion(COMPLETION.replace(from, () => to));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain(named);
  });

  it.each(FORMAT_EDITS)("%s: the pin is broken, and is named", (_name, from, to, named) => {
    expect(FORMAT.split(from).length - 1).toBe(1);
    const problems = problemsInFormat(FORMAT.replace(from, () => to));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain(named);
  });

  // A02 is not a from/to row, because its `from` would be the very text that A05 respells (`kept.length > 0 ? kept : undefined`), and a `from` that is no longer in the file fails its applicability check: A05, an argued
  // equivalent, would be scored as a kill of this row. The assignment's right-hand side is replaced whatever its spelling.
  it("A02: the filter's result is thrown away (the unfiltered `edits` are assigned, whatever the ternary around them): the pin is broken, and is named", () => {
    const assignment = /item\.additionalTextEdits = [^;]*;/;
    expect(assignment.test(COMPLETION)).toBe(true);
    const problems = problemsInCompletion(COMPLETION.replace(assignment, "item.additionalTextEdits = edits;"));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain("is not made from `kept` alone");
    const ternary = problemsInCompletion(COMPLETION.replace(assignment, "item.additionalTextEdits = kept.length > 0 ? edits : undefined;"));
    expect(ternary.join("\n")).toContain("is not made from `kept` alone");
  });

  // Two respellings the pins leave ALONE, on purpose (the review round's argued survivors, `A05` and `FB` of `tools/mutation-run/mutants/s342-review-typing.json`): a pin that named them would redden a harmless refactor.
  it("an item with no kept edit that keeps an EMPTY list instead of none (A05) is the same to VS Code, and an emptiness test on the unfiltered edits (FB) can never be true after the early return: neither is a pin", () => {
    // (`replace` is a no-op on a source that already has the respelling, so that the runner can apply it to the file itself and this row still holds: the mutant is then an argued survivor, not a kill of this row.)
    const empty = COMPLETION.replace("      item.additionalTextEdits = kept.length > 0 ? kept : undefined;", "      item.additionalTextEdits = kept;");
    expect(empty).toContain("      item.additionalTextEdits = kept;");
    expect(problemsInCompletion(empty)).toEqual([]);
    const unfiltered = FORMAT.replace("  if (kept.length === 0) {\n    return;\n  }", "  if (edits.length === 0) {\n    return;\n  }");
    expect(unfiltered).toContain("  if (edits.length === 0) {\n    return;\n  }");
    expect(problemsInFormat(unfiltered)).toEqual([]);
  });

  // A pin read from the syntax tree is not moved by what is not code.
  it("a comment, a string, a template and an unused identifier that spell the pinned calls do not satisfy the pin, and a comment that names the removed helpers does not break it", () => {
    // the real call removed, a decoy of every kind left behind
    const without = COMPLETION.replace("  const lookup = createRangeLookup(text);", "  // const lookup = createRangeLookup(text);\n  const decoy = \"createRangeLookup(text)\" + `createRangeLookup(text)`;\n  const alias = createRangeLookup;\n  const lookup = alias as unknown as ReturnType<typeof createRangeLookup>;\n  void decoy;");
    expect(without).not.toBe(COMPLETION);
    expect(problemsInCompletion(without).join("\n")).toContain("0 calls of createRangeLookup");
    const formatWithout = FORMAT.replace("  const lookup = createRangeLookup(text);", "  // const lookup = createRangeLookup(text);\n  const decoy = 'createRangeLookup(text)';\n  const lookup = decoy as unknown as ReturnType<typeof createRangeLookup>;");
    expect(formatWithout).not.toBe(FORMAT);
    expect(problemsInFormat(formatWithout).join("\n")).toContain("0 calls of createRangeLookup");
    // comments and strings that name the removed helpers and a per-line call are not identifiers or calls
    const commented = COMPLETION.replace("function filterOutOfCellEdits(", "// rangeInSameLangBody and findCellAtPosition(text, line) and embeddedCellAt(text, line) are gone\n/* embeddedCellAt(text, line) */\nconst NOTE = 'embeddedCellAt(text, line)';\nfunction filterOutOfCellEdits(");
    expect(commented).not.toBe(COMPLETION);
    expect(problemsInCompletion(commented)).toEqual([]);
    const formatCommented = FORMAT.replace("async function formatCellAtCursor(", "// rangeWithinCell is gone; it asked embeddedCellAt(text, line) per line\nconst NOTE = 'findCellAtPosition(text, line)';\nasync function formatCellAtCursor(");
    expect(formatCommented).not.toBe(FORMAT);
    expect(problemsInFormat(formatCommented)).toEqual([]);
  });
});
