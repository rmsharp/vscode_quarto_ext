import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as ts from "typescript";

// Session 341, part (2), the review round (TD-2 / M-R61-R62-R64). `src/providers/outline.ts` imports `vscode`, so no unit test can run it: how it uses the per-cell vdoc builder is pinned here by its SOURCE, read with the
// TypeScript compiler API (`ts.createSourceFile`, then the syntax tree), not with a text search. A comment, a string or an unused identifier can neither satisfy nor break a pin made this way, which is what the first
// spelling of such a pin (a regular expression over the text with the comments cut out, the way `s341-preview-scan-rows.test.ts` pins `preview.ts`) could not promise.
//
// ⚠ WHAT THIS DOES NOT SEE. It pins how the call sites are SPELLED: one builder, made over the document's text inside `provideDocumentSymbols`, handed down to every cell, the cell looked up by its start line and the vdoc
// built from that very cell. It does not run the provider: whether VS Code then shows the in-cell symbols is the behaviour check `test/integration/suite/outline.test.ts`, which opens a real VS Code window, takes over the
// screen, and was NOT run for this change.
//
// Session 342, part (5): the builder is made over the very ENGINE and MODE the tree was built with (`createCellVdocBuilder(text, engine, mode)`, the pair `buildOutline(text, engine, mode)` is given), so that its cells and
// option lines come from the scan the Outline just cached and not from a second, engine-blind one. The pins below say that `engine` is resolved ONCE in `provideDocumentSymbols`, that `mode` is the one declared there, and that
// both calls are handed those two identifiers and nothing else (a literal, a second resolution, an `undefined` or a swapped pair would each let the two disagree again). They are the mutants of
// `tools/mutation-run/mutants/s342-builder-engine.json`.
//
// The checks are one function, `problemsIn(source)`, which names every pin the source breaks. The live file must have none, and the rows below also hand it the live file with ONE edit each (the edits are the mutants of
// `tools/mutation-run/mutants/s341-cell-vdoc.json` E01 to E04 and `s341-review-cell-vdoc.json` R62 to R64 and O01 to O03) and require it to name the pin that edit breaks: the pin can fail, and says which.

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LIVE = readFileSync(resolve(root, "src", "providers", "outline.ts"), "utf8");

const parse = (source: string): ts.SourceFile => ts.createSourceFile("outline.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

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
const isProp = (node: ts.Node | undefined, object: string, name: string): boolean => node !== undefined && ts.isPropertyAccessExpression(node) && isId(node.expression, object) && node.name.text === name;
/** `object.name(...)` */
const isMethodCall = (node: ts.Node, object: string, name: string): node is ts.CallExpression => ts.isCallExpression(node) && isProp(node.expression, object, name);
/** A call whose callee is the plain identifier `name`. */
const isPlainCall = (node: ts.Node, name: string): node is ts.CallExpression => ts.isCallExpression(node) && isId(node.expression, name);
/** The nearest function-like node around `node` (a function declaration, a method, an arrow function or a function expression). */
function enclosingFunction(node: ts.Node): ts.Node | undefined {
  for (let up = node.parent; up !== undefined; up = up.parent) {
    if (ts.isFunctionDeclaration(up) || ts.isMethodDeclaration(up) || ts.isArrowFunction(up) || ts.isFunctionExpression(up)) return up;
  }
  return undefined;
}
const functionNamed = (sf: ts.SourceFile, name: string): ts.FunctionDeclaration | ts.MethodDeclaration | undefined =>
  collect(sf, (n): n is ts.FunctionDeclaration | ts.MethodDeclaration => (ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) && isId(n.name, name))[0];
const parameterNames = (fn: ts.FunctionLikeDeclaration): string[] => fn.parameters.map((p) => (ts.isIdentifier(p.name) ? p.name.text : "?"));
const parameterType = (fn: ts.FunctionLikeDeclaration, index: number): string => {
  const type = fn.parameters[index]?.type;
  return type !== undefined && ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName) ? type.typeName.text : "?";
};
const argsAre = (call: ts.CallExpression, ...tests: Array<(n: ts.Expression) => boolean>): boolean => call.arguments.length === tests.length && tests.every((test, i) => test(call.arguments[i]));
const id = (name: string) => (n: ts.Expression): boolean => isId(n, name);

/** What the arrow function `(x) => f(x, a, b)` calls: the call in its body, when the body is one, and the name of its first parameter. */
function arrowCall(arrow: ts.Expression | undefined): { call: ts.CallExpression | undefined; first: string } {
  if (arrow === undefined || !ts.isArrowFunction(arrow)) return { call: undefined, first: "?" };
  const first = arrow.parameters[0] !== undefined && ts.isIdentifier(arrow.parameters[0].name) ? arrow.parameters[0].name.text : "?";
  return { call: ts.isCallExpression(arrow.body) ? arrow.body : undefined, first };
}

/** Every pin `source` breaks, each named by what it was meant to keep. `[]` is a source that keeps them all. */
function problemsIn(source: string): string[] {
  const sf = parse(source);
  const problems: string[] = [];

  // 1. The two functions the builder replaced are gone: no identifier of either, an import specifier included. A comment that names one is not an identifier.
  for (const name of ["findCellAtPosition", "buildCellVirtualContent"]) {
    if (collect(sf, (n): n is ts.Identifier => ts.isIdentifier(n) && n.text === name).length > 0) problems.push(`the identifier ${name} is still used`);
  }

  // 2. ONE builder, made over the document's text in `provideDocumentSymbols`, before the symbols are mapped.
  const provide = functionNamed(sf, "provideDocumentSymbols");
  const builders = collect(sf, (n): n is ts.CallExpression => isPlainCall(n, "createCellVdocBuilder"));
  if (builders.length !== 1) problems.push(`${builders.length} calls of createCellVdocBuilder, not one`);
  if (provide === undefined) {
    problems.push("provideDocumentSymbols is missing");
  } else if (builders.length === 1) {
    const [builder] = builders;
    if (enclosingFunction(builder) !== provide) problems.push("createCellVdocBuilder is not called directly in provideDocumentSymbols (inside an arrow function or another function it runs once per symbol)");
    if (builder.arguments.length !== 3) problems.push("createCellVdocBuilder is not called with three arguments (text, engine, mode)");
    if (!isId(builder.arguments[0], "text")) problems.push("createCellVdocBuilder is not called over the document text (the identifier `text`)");
    if (!isId(builder.arguments[1], "engine")) problems.push("createCellVdocBuilder is not given the engine the tree was built with (the identifier `engine`)");
    if (!isId(builder.arguments[2], "mode")) problems.push("createCellVdocBuilder is not given the mode the tree was built with (the identifier `mode`)");
    const declaration = builder.parent;
    const statement = declaration?.parent?.parent;
    if (!(declaration !== undefined && ts.isVariableDeclaration(declaration) && isId(declaration.name, "cellVdocs") && statement !== undefined && ts.isVariableStatement(statement) && statement.parent === provide.body)) {
      problems.push("the builder is not the initializer of `const cellVdocs` among the statements of provideDocumentSymbols");
    }
    const promiseAll = provide.body === undefined ? undefined : collect(provide.body, (n): n is ts.CallExpression => isMethodCall(n, "Promise", "all"))[0];
    if (promiseAll === undefined || builder.end > promiseAll.getStart(sf)) problems.push("the builder is not made before Promise.all maps the symbols");
  }
  if (provide !== undefined && provide.body !== undefined) {
    const text = collect(provide.body, (n): n is ts.VariableDeclaration => ts.isVariableDeclaration(n) && isId(n.name, "text"))[0];
    if (text === undefined || text.initializer === undefined || !isMethodCall(text.initializer, "document", "getText") || text.initializer.arguments.length !== 0) {
      problems.push("`text` is not `document.getText()` in provideDocumentSymbols");
    }
  }
  // 2b. (Session 342) `engine` is resolved ONCE, from the document's file name and text, among the statements of `provideDocumentSymbols`; `mode` is declared there too; the tree is built over exactly that pair
  //     and the builder, made after both, over the same pair.
  if (provide !== undefined && provide.body !== undefined) {
    const declared = (name: string): ts.VariableDeclaration | undefined =>
      collect(provide.body as ts.Node, (n): n is ts.VariableDeclaration => ts.isVariableDeclaration(n) && isId(n.name, name) && n.parent.parent.parent === provide.body)[0];
    const engine = declared("engine");
    const mode = declared("mode");
    const resolutions = collect(sf, (n): n is ts.CallExpression => isPlainCall(n, "resolveDocumentEngine"));
    if (resolutions.length !== 1) problems.push(`${resolutions.length} calls of resolveDocumentEngine, not one`);
    if (engine === undefined || engine.initializer === undefined || !ts.isCallExpression(engine.initializer) || !isPlainCall(engine.initializer, "resolveDocumentEngine")) {
      problems.push("`engine` is not `const engine = resolveDocumentEngine(...)` among the statements of provideDocumentSymbols");
    } else if (!argsAre(engine.initializer, (n) => isProp(n, "document", "fileName"), id("text"))) {
      problems.push("`engine` is not resolved from (document.fileName, text)");
    }
    if (mode === undefined || mode.initializer === undefined || !ts.isCallExpression(mode.initializer) || !isPlainCall(mode.initializer, "resolveRenderMode")) {
      problems.push("`mode` is not `const mode = resolveRenderMode(...)` among the statements of provideDocumentSymbols");
    }
    const trees = collect(sf, (n): n is ts.CallExpression => isPlainCall(n, "buildOutline"));
    if (trees.length !== 1 || !argsAre(trees[0], id("text"), id("engine"), id("mode"))) problems.push("the tree is not built by exactly one buildOutline(text, engine, mode)");
    const made = collect(sf, (n): n is ts.CallExpression => isPlainCall(n, "createCellVdocBuilder"))[0];
    if (made !== undefined && engine !== undefined && mode !== undefined && (made.getStart(sf) < engine.end || made.getStart(sf) < mode.end)) problems.push("the builder is made before `engine` and `mode` are declared");
  }
  const reads = collect(sf, (n): n is ts.CallExpression => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "getText");
  if (reads.length !== 1) problems.push(`${reads.length} reads of the document text (getText), not one`);

  // 3. The builder, not the text, is what is mapped over the symbols and handed down.
  if (provide !== undefined && provide.body !== undefined) {
    const map = collect(provide.body, (n): n is ts.CallExpression => isMethodCall(n, "visible", "map"))[0];
    const { call, first } = arrowCall(map?.arguments[0]);
    if (call === undefined || !isPlainCall(call, "toDocumentSymbol") || !argsAre(call, id(first), id("document"), id("cellVdocs"))) {
      problems.push("provideDocumentSymbols does not map each visible symbol through toDocumentSymbol(symbol, document, cellVdocs)");
    }
  }
  const down = functionNamed(sf, "toDocumentSymbol");
  if (down === undefined || down.body === undefined) {
    problems.push("toDocumentSymbol is missing");
  } else {
    if (parameterNames(down).join() !== "symbol,document,cellVdocs" || parameterType(down, 2) !== "CellVdocBuilder") problems.push("toDocumentSymbol does not take (symbol, document, cellVdocs: CellVdocBuilder)");
    const forward = collect(down.body, (n): n is ts.CallExpression => isPlainCall(n, "forwardCellSymbols"))[0];
    if (forward === undefined || !argsAre(forward, id("symbol"), id("document"), id("cellVdocs"))) problems.push("toDocumentSymbol does not hand its builder to forwardCellSymbols(symbol, document, cellVdocs)");
    const children = collect(down.body, (n): n is ts.CallExpression => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "map" && isProp(n.expression.expression, "symbol", "children"))[0];
    const { call, first } = arrowCall(children?.arguments[0]);
    if (call === undefined || !isPlainCall(call, "toDocumentSymbol") || !argsAre(call, id(first), id("document"), id("cellVdocs"))) {
      problems.push("toDocumentSymbol does not recurse into symbol.children with toDocumentSymbol(child, document, cellVdocs)");
    }
  }

  // 4. The forward looks the cell up by the symbol's START line and builds the vdoc from that very cell.
  const forward = functionNamed(sf, "forwardCellSymbols");
  if (forward === undefined || forward.body === undefined) {
    problems.push("forwardCellSymbols is missing");
  } else {
    if (parameterNames(forward).join() !== "cellSymbol,document,cellVdocs" || parameterType(forward, 2) !== "CellVdocBuilder") problems.push("forwardCellSymbols does not take (cellSymbol, document, cellVdocs: CellVdocBuilder)");
    const lookups = collect(sf, (n): n is ts.CallExpression => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "cellAt");
    if (lookups.length !== 1) problems.push(`${lookups.length} cellAt lookups in the file, not one`);
    const cell = collect(forward.body, (n): n is ts.VariableDeclaration => ts.isVariableDeclaration(n) && isId(n.name, "cell"))[0];
    const lookup = cell?.initializer;
    if (lookup === undefined || !isMethodCall(lookup, "cellVdocs", "cellAt") || !argsAre(lookup, (n) => isProp(n, "cellSymbol", "startLine"))) {
      problems.push("forwardCellSymbols does not read `const cell = cellVdocs.cellAt(cellSymbol.startLine)`");
    }
    const builds = collect(sf, (n): n is ts.CallExpression => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "build");
    if (builds.length !== 1) problems.push(`${builds.length} build calls in the file, not one`);
    const ensure = collect(forward.body, (n): n is ts.CallExpression => isPlainCall(n, "ensureVdoc"))[0];
    const vdoc = ensure?.arguments[2];
    if (ensure === undefined || ensure.arguments.length !== 3 || vdoc === undefined || !isMethodCall(vdoc, "cellVdocs", "build") || !argsAre(vdoc, id("cell"))) {
      problems.push("forwardCellSymbols does not hand `cellVdocs.build(cell)` to ensureVdoc as its third argument");
    }
    const key = ensure?.arguments[1];
    const startOfKey =
      key !== undefined && ts.isObjectLiteralExpression(key)
        ? key.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && isId(p.name, "cellStartLine"))
        : undefined;
    if (startOfKey === undefined || !isProp(startOfKey.initializer, "cell", "startLine")) problems.push("the vdoc key's cellStartLine is not cell.startLine");
  }
  return problems;
}

describe("Session 341 review -- the Outline provider's use of the per-cell vdoc builder, pinned by the syntax tree of src/providers/outline.ts (a unit test cannot run it: it imports vscode)", () => {
  it("the live file keeps every pin: one builder over the text in provideDocumentSymbols, handed down, the cell looked up by its start line, the vdoc built from it", () => {
    expect(problemsIn(LIVE)).toEqual([]);
  });

  it("the file parsed is the provider: it has the class and the three functions, and parses without a syntax error", () => {
    const sf = parse(LIVE);
    expect(collect(sf, (n): n is ts.ClassDeclaration => ts.isClassDeclaration(n) && isId(n.name, "QmdDocumentSymbolProvider"))).toHaveLength(1);
    for (const name of ["provideDocumentSymbols", "toDocumentSymbol", "forwardCellSymbols"]) expect(functionNamed(sf, name)).toBeDefined();
    const diagnostics = (sf as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics;
    expect(diagnostics).toEqual([]);
  });

  // The edits: each is the live file with ONE respelling, and the pin it must break. They are the mutants the runner applies to the file itself.
  const EDITS: Array<[string, string, string, string]> = [
    // [name, from, to, a word of the problem it must be named by]
    ["E01: a builder over an empty text", "    const cellVdocs = createCellVdocBuilder(text, engine, mode);", "    const cellVdocs = createCellVdocBuilder(\"\", engine, mode);", "document text"],
    ["E02: the cell looked up one line below its start", "  const cell = cellVdocs.cellAt(cellSymbol.startLine);", "  const cell = cellVdocs.cellAt(cellSymbol.startLine + 1);", "cellVdocs.cellAt(cellSymbol.startLine)"],
    ["E03: the vdoc built from the cell with no code", "    cellVdocs.build(cell),\n  );", "    cellVdocs.build({ ...cell, code: \"\" }),\n  );", "cellVdocs.build(cell)"],
    ["E04: a builder per top-level symbol", "      visible.map((symbol) => toDocumentSymbol(symbol, document, cellVdocs)),", "      visible.map((symbol) => toDocumentSymbol(symbol, document, createCellVdocBuilder(document.getText()))),", "calls of createCellVdocBuilder"],
    ["R62: a builder per child symbol", "          symbol.children.map((child) => toDocumentSymbol(child, document, cellVdocs)),", "          symbol.children.map((child) => toDocumentSymbol(child, document, createCellVdocBuilder(document.getText()))),", "calls of createCellVdocBuilder"],
    ["R63: the cell looked up by the symbol's end line", "  const cell = cellVdocs.cellAt(cellSymbol.startLine);", "  const cell = cellVdocs.cellAt(cellSymbol.endLine);", "cellVdocs.cellAt(cellSymbol.startLine)"],
    ["R64: the vdoc built from a cell one line below", "    cellVdocs.build(cell),\n  );", "    cellVdocs.build({ ...cell, startLine: cell.startLine + 1 }),\n  );", "cellVdocs.build(cell)"],
    ["O01: a builder per top-level symbol over the text", "      visible.map((symbol) => toDocumentSymbol(symbol, document, cellVdocs)),", "      visible.map((symbol) => toDocumentSymbol(symbol, document, createCellVdocBuilder(text, engine, mode))),", "calls of createCellVdocBuilder"],
    ["O02: a builder per cell inside the forward", "  const cell = cellVdocs.cellAt(cellSymbol.startLine);", "  const cell = createCellVdocBuilder(document.getText()).cellAt(cellSymbol.startLine);", "calls of createCellVdocBuilder"],
    ["O03: the one builder over a second read of the document", "    const cellVdocs = createCellVdocBuilder(text, engine, mode);", "    const cellVdocs = createCellVdocBuilder(document.getText(), engine, mode);", "document text"],
    ["the builder made after the symbols are mapped", "    const cellVdocs = createCellVdocBuilder(text, engine, mode);\n    return Promise.all(\n      visible.map((symbol) => toDocumentSymbol(symbol, document, cellVdocs)),\n    );", "    const symbols = Promise.all(\n      visible.map((symbol) => toDocumentSymbol(symbol, document, cellVdocs)),\n    );\n    const cellVdocs = createCellVdocBuilder(text, engine, mode);\n    return symbols;", "before Promise.all"],
    // Session 342, part (5): the engine and the mode the builder is made over.
    ["X01: the builder given neither engine nor mode", "    const cellVdocs = createCellVdocBuilder(text, engine, mode);", "    const cellVdocs = createCellVdocBuilder(text);", "not called with three arguments"],
    ["X02: the builder given no mode", "    const cellVdocs = createCellVdocBuilder(text, engine, mode);", "    const cellVdocs = createCellVdocBuilder(text, engine);", "not called with three arguments"],
    ["X03: the builder given an undefined engine", "    const cellVdocs = createCellVdocBuilder(text, engine, mode);", "    const cellVdocs = createCellVdocBuilder(text, undefined, mode);", "the identifier `engine`"],
    ["X04: the builder given the engine knitr for every document", "    const cellVdocs = createCellVdocBuilder(text, engine, mode);", "    const cellVdocs = createCellVdocBuilder(text, \"knitr\", mode);", "the identifier `engine`"],
    ["X05: the engine and the mode swapped", "    const cellVdocs = createCellVdocBuilder(text, engine, mode);", "    const cellVdocs = createCellVdocBuilder(text, mode as never, engine as never);", "the identifier `engine`"],
    ["X06: the builder given the executing mode for every document", "    const cellVdocs = createCellVdocBuilder(text, engine, mode);", "    const cellVdocs = createCellVdocBuilder(text, engine, \"execute\");", "the identifier `mode`"],
    ["X07: the builder given a second resolution of the engine", "    const cellVdocs = createCellVdocBuilder(text, engine, mode);", "    const cellVdocs = createCellVdocBuilder(text, resolveDocumentEngine(document.fileName, text), mode);", "calls of resolveDocumentEngine"],
    ["X08: the tree built over an inline resolution", "    const tree = buildOutline(text, engine, mode);", "    const tree = buildOutline(text, resolveDocumentEngine(document.fileName, text), mode);", "the tree is not built by exactly one buildOutline(text, engine, mode)"],
    ["X09: the tree built with no mode", "    const tree = buildOutline(text, engine, mode);", "    const tree = buildOutline(text, engine);", "the tree is not built by exactly one buildOutline(text, engine, mode)"],
    ["X10: the engine resolved from an empty text", "    const engine = resolveDocumentEngine(document.fileName, text);", "    const engine = resolveDocumentEngine(document.fileName, \"\");", "`engine` is not resolved from (document.fileName, text)"],
    ["X11: the engine resolved from the wrong file", "    const engine = resolveDocumentEngine(document.fileName, text);", "    const engine = resolveDocumentEngine(\"x.qmd\", text);", "`engine` is not resolved from (document.fileName, text)"],
    ["X12: the engine declared after the builder", "    const engine = resolveDocumentEngine(document.fileName, text);\n    const tree = buildOutline(text, engine, mode);", "    const tree = buildOutline(text, \"knitr\" as never, mode);\n    const engine = resolveDocumentEngine(document.fileName, text);", "the tree is not built by exactly one buildOutline(text, engine, mode)"],
    ["X13: the engine resolved inside a callback (once per symbol)", "    const engine = resolveDocumentEngine(document.fileName, text);", "    const engine = (() => resolveDocumentEngine(document.fileName, text))();", "`engine` is not `const engine = resolveDocumentEngine(...)`"],
    ["X14: the mode read from a constant", "      vscode.workspace.getConfiguration(\"quarto\", document.uri).get<unknown>(RENDER_MODE_SETTING),\n    );", "      vscode.workspace.getConfiguration(\"quarto\", document.uri).get<unknown>(RENDER_MODE_SETTING),\n    ) && \"execute\";", "`mode` is not `const mode = resolveRenderMode(...)`"],
    ["the old pair back: findCellAtPosition", "  const cell = cellVdocs.cellAt(cellSymbol.startLine);", "  const cell = findCellAtPosition(document.getText(), cellSymbol.startLine);", "findCellAtPosition"],
    ["the old build back: buildCellVirtualContent", "    cellVdocs.build(cell),\n  );", "    buildCellVirtualContent(document.getText(), cell),\n  );", "buildCellVirtualContent"],
    ["toDocumentSymbol takes the text, not the builder", "  cellVdocs: CellVdocBuilder,\n): Promise<vscode.DocumentSymbol> {", "  cellVdocs: string,\n): Promise<vscode.DocumentSymbol> {", "toDocumentSymbol does not take"],
  ];

  it.each(EDITS)("%s: the pin is broken, and is named", (_name, from, to, named) => {
    expect(LIVE.split(from).length - 1).toBe(1); // the edit applies to the live file exactly once
    const problems = problemsIn(LIVE.replace(from, () => to));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain(named);
  });

  // A pin read from the syntax tree is not moved by what is not code.
  it("a comment, a string, a template and an unused identifier that spell the pinned calls do not satisfy the pin, and a comment that names the removed functions does not break it", () => {
    // the real call removed, a decoy of every kind left behind
    const without = LIVE.replace("    const cellVdocs = createCellVdocBuilder(text, engine, mode);", "    // const cellVdocs = createCellVdocBuilder(text);\n    const decoy = \"createCellVdocBuilder(text)\" + `createCellVdocBuilder(text)`;\n    const alias = createCellVdocBuilder;\n    const cellVdocs = alias as unknown as CellVdocBuilder;\n    void decoy;");
    expect(without).not.toBe(LIVE);
    const broken = problemsIn(without);
    expect(broken.join("\n")).toContain("0 calls of createCellVdocBuilder");
    // a comment naming the old functions is not an identifier
    const commented = LIVE.replace("const SHOW_CELLS_SETTING", "// findCellAtPosition and buildCellVirtualContent are gone\n/* buildCellVirtualContent(text, cell) */\nconst SHOW_CELLS_SETTING");
    expect(commented).not.toBe(LIVE);
    expect(problemsIn(commented)).toEqual([]);
    // a string that holds `findCellAtPosition` is not one either
    expect(problemsIn(LIVE.replace("const SHOW_CELLS_SETTING", "const NOTE = 'findCellAtPosition';\nconst SHOW_CELLS_SETTING"))).toEqual([]);
  });
});
