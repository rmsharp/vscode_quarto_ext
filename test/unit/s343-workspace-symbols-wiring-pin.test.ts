import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as ts from "typescript";

// Session 343, part (4), SIB-03. `src/providers/workspace-symbols.ts` imports `vscode`, so no unit test can run it: how `provideWorkspaceSymbols` reaches the per-file symbol cache of `src/core/workspace-symbols.ts`
// (`createWorkspaceSymbolCache`) is pinned here by its SOURCE, read with the TypeScript compiler API (the syntax tree, not a text search: Learning 911). A comment, a string or an unused identifier can neither satisfy nor
// break a pin made this way.
//
// ⚠ WHAT THIS DOES NOT SEE. It pins how the adapter is SPELLED: one cache made once at module level (a cache made per query would never hit); for EACH file, in order, the document opened, its text read, the render
// mode read afresh from the setting AT THE FILE'S SCOPE (`getConfiguration("quarto", uri)`), and the cache asked with the uri's string, the document's file name, that text and that mode; the query filter and the
// `SymbolInformation` mapping left per pass; and nothing in the adapter that builds an outline or resolves an engine itself. It does not run the adapter and NOTHING ELSE DOES: no test drives
// `provideWorkspaceSymbols` through a host, so a key that did not follow the file would pass `npm run test:integration`. What the cache DOES (reuse on an equal text, mode and file name, recomputation on any change, the
// two bounds, frozen values, equality with the uncached path) is `s343-workspace-symbol-cache-rows.test.ts`, on a stand-in for the computation and on the real one.
//
// The check is one function, `problemsInAdapter(source)`, which names every pin the source breaks. The live file must have none, and the rows below also hand it the live file with ONE edit (the edits are the mutants of
// `tools/mutation-run/mutants/s343-workspace-symbol-cache.json`) and require it to name the pin that edit breaks: the pin can fail, and says which.

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ADAPTER = readFileSync(resolve(root, "src", "providers", "workspace-symbols.ts"), "utf8");

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
const callsOf = (node: ts.Node, sf: ts.SourceFile, callee: string): ts.CallExpression[] => collect(node, isCall).filter((call) => flat(call.expression, sf) === callee);
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

/** The names a named import of `module` brings in, as `imported as local` where they differ. `undefined` when the file has no such import. */
function namedImportsOf(sf: ts.SourceFile, module: string): string[] | undefined {
  const found = sf.statements.filter((s): s is ts.ImportDeclaration => ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier) && s.moduleSpecifier.text === module);
  if (found.length === 0) return undefined;
  const names: string[] = [];
  for (const declaration of found) {
    const bindings = declaration.importClause?.namedBindings;
    if (bindings !== undefined && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        names.push(element.propertyName === undefined ? element.name.text : `${element.propertyName.text} as ${element.name.text}`);
      }
    }
  }
  return names;
}

/** Every pin `workspace-symbols.ts` (the adapter) breaks, each named by what it was meant to keep. `[]` is a source that keeps them all. */
function problemsInAdapter(source: string): string[] {
  const sf = parse("workspace-symbols.ts", source);
  const problems: string[] = [];

  // 1. ONE cache, made at MODULE level, with the real computation (no argument): a cache made per query, or over a stand-in, answers nothing.
  const makes = callsOf(sf, sf, "createWorkspaceSymbolCache");
  if (makes.length !== 1) {
    problems.push(`${makes.length} calls of createWorkspaceSymbolCache, not one`);
  } else {
    const [make] = makes;
    if (enclosingFunction(make) !== undefined) problems.push("createWorkspaceSymbolCache is called inside a function (a cache made per query would never hit)");
    const declaration = make.parent;
    const statement = ts.isVariableDeclaration(declaration) ? declaration.parent.parent : undefined;
    if (!(ts.isVariableDeclaration(declaration) && flat(declaration.name, sf) === "symbolCache" && statement !== undefined && ts.isVariableStatement(statement) && statement.parent === sf && (declaration.parent.flags & ts.NodeFlags.Const) !== 0)) {
      problems.push("the cache is not the initializer of a module-level `const symbolCache`");
    }
    if (make.arguments.length !== 0) problems.push("createWorkspaceSymbolCache is given arguments (the adapter uses the real computation and the default bounds)");
  }

  // 2. Imports: the cache and the query filter from the core module, and no builder, resolver or flattener of the adapter's own.
  const coreImport = namedImportsOf(sf, "../core/workspace-symbols");
  if (coreImport === undefined) {
    problems.push("nothing is imported from ../core/workspace-symbols");
  } else {
    if (!coreImport.includes("createWorkspaceSymbolCache")) problems.push("createWorkspaceSymbolCache is not imported from ../core/workspace-symbols");
    if (!coreImport.includes("matchesWorkspaceQuery")) problems.push("matchesWorkspaceQuery is not imported from ../core/workspace-symbols");
    if (coreImport.includes("flattenOutline")) problems.push("flattenOutline is still imported (the cache flattens, once per text)");
  }
  if (namedImportsOf(sf, "../core/qmd/model") !== undefined) problems.push("the adapter imports from ../core/qmd/model (it builds no outline: the cache does, once per text)");
  if (namedImportsOf(sf, "../core/document-engine-resolve") !== undefined) problems.push("the adapter imports from ../core/document-engine-resolve (it resolves no engine: the cache does, on a miss)");
  for (const name of ["buildOutline", "resolveDocumentEngine", "flattenOutline"]) {
    if (callsOf(sf, sf, name).length > 0) problems.push(`the adapter calls ${name}; only the cache may build, resolve and flatten`);
  }

  // 3. The provider's loop: per file, the document, its text, the mode AT THE FILE'S SCOPE, then the cache's symbols, filtered by the query and mapped.
  const provide = methodNamed(sf, "QmdWorkspaceSymbolProvider", "provideWorkspaceSymbols");
  if (provide === undefined || provide.body === undefined) {
    problems.push("QmdWorkspaceSymbolProvider.provideWorkspaceSymbols is missing");
  } else {
    const loops = collect(provide.body, (n): n is ts.ForOfStatement => ts.isForOfStatement(n));
    const outer = loops.find((loop) => flat(loop.expression, sf) === "files");
    if (outer === undefined) {
      problems.push("provideWorkspaceSymbols has no `for (const uri of files)` loop");
    } else {
      const body = outer.statement;
      const declared = (name: string): string | undefined => {
        const found = collect(body, (n): n is ts.VariableDeclaration => ts.isVariableDeclaration(n) && flat(n.name, sf) === name);
        return found.length === 1 && found[0].initializer !== undefined ? flat(found[0].initializer, sf) : undefined;
      };
      if (declared("document") !== "await vscode.workspace.openTextDocument(uri)") problems.push("the loop does not read `const document = await vscode.workspace.openTextDocument(uri)`");
      if (declared("docText") !== "document.getText()") problems.push("the loop does not read `const docText = document.getText()`");
      if (declared("mode") !== 'resolveRenderMode( vscode.workspace.getConfiguration("quarto", uri).get<unknown>(RENDER_MODE_SETTING), )' && declared("mode") !== 'resolveRenderMode(vscode.workspace.getConfiguration("quarto", uri).get<unknown>(RENDER_MODE_SETTING))') {
        problems.push('the loop does not read the mode as `resolveRenderMode(vscode.workspace.getConfiguration("quarto", uri).get<unknown>(RENDER_MODE_SETTING))` (the setting is read afresh, per file, at that file\'s scope)');
      }
      if (callsOf(provide.body, sf, "vscode.workspace.getConfiguration").some((call) => enclosingLoop(call) !== outer)) problems.push("the setting is read outside the per-file loop (it is per file, at the file's scope)");
      // the cache is the thing iterated, asked with the uri's string, the file name, the text and the mode
      const inner = collect(body, (n): n is ts.ForOfStatement => ts.isForOfStatement(n)).find((loop) => loop !== outer);
      if (inner === undefined) {
        problems.push("the loop over a file's symbols is missing");
      } else if (flat(inner.expression, sf) !== "symbolCache.read(uri.toString(), document.fileName, docText, mode)") {
        problems.push("the symbols are not `symbolCache.read(uri.toString(), document.fileName, docText, mode)` (the key is the uri's string, the engine is decided by the file name, the text is the document's, the mode is the file's)");
      } else {
        const guards = collect(inner.statement, (n): n is ts.IfStatement => ts.isIfStatement(n));
        if (guards.length !== 1 || flat(guards[0].expression, sf) !== "!matchesWorkspaceQuery(symbol.name, query)" || !/^continue;?$|^\{ continue; \}$/.test(flat(guards[0].thenStatement, sf))) {
          problems.push("the symbol loop does not skip on `!matchesWorkspaceQuery(symbol.name, query)` (the query filter stays per pass, after the cache)");
        }
        if (callsOf(inner.statement, sf, "results.push").length !== 1) problems.push("the symbol loop does not push exactly one result");
        if (callsOf(inner.statement, sf, "symbolCache.read").length > 0) problems.push("the cache is read inside the symbol loop");
      }
      if (callsOf(body, sf, "symbolCache.read").length !== 1) problems.push(`${callsOf(body, sf, "symbolCache.read").length} calls of symbolCache.read in the file loop, not one`);
    }
    // the cancellation check and the file search stay as they were
    if (!collect(provide.body, (n): n is ts.IfStatement => ts.isIfStatement(n)).some((s) => flat(s.expression, sf) === "token.isCancellationRequested")) problems.push("the loop no longer checks `token.isCancellationRequested`");
    if (callsOf(provide.body, sf, "vscode.workspace.findFiles").length !== 1) problems.push("provideWorkspaceSymbols does not call vscode.workspace.findFiles exactly once");
  }
  // 4. The cache is the module's, not the class's or a parameter's.
  if (identifiersNamed(sf, "symbolCache").filter((id) => ts.isPropertyAccessExpression(id.parent) && id.parent.expression === id && id.parent.name.text === "read").length < 1) problems.push("symbolCache.read is never called");
  return problems;
}

/** The nearest `for…of` statement around `node`. */
function enclosingLoop(node: ts.Node): ts.Node | undefined {
  for (let up = node.parent; up !== undefined; up = up.parent) {
    if (ts.isForOfStatement(up) && flat(up.expression, up.getSourceFile()) === "files") return up;
  }
  return undefined;
}

describe("Session 343 -- how workspace-symbols.ts reaches the per-file symbol cache, pinned by the syntax tree (a unit test cannot run it: it imports vscode)", () => {
  it("workspace-symbols.ts keeps every pin: one cache at module level, the mode read per file at the file's scope, the cache asked with the uri's string, the file name, the text and the mode, the query filter per pass, no outline built in the adapter", () => {
    expect(problemsInAdapter(ADAPTER)).toEqual([]);
  });

  it("the file parsed is the adapter: it parses without a syntax error and holds the functions the pins read", () => {
    const diagnostics = (parse("workspace-symbols.ts", ADAPTER) as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics;
    expect(diagnostics).toEqual([]);
    const sf = parse("workspace-symbols.ts", ADAPTER);
    for (const name of ["registerWorkspaceSymbolsProvider", "selectionRange"]) expect(functionNamed(sf, name)).toBeDefined();
    expect(methodNamed(sf, "QmdWorkspaceSymbolProvider", "provideWorkspaceSymbols")).toBeDefined();
  });

  // The edits: each is the live file with ONE respelling, and a word of the problem it must be named by. They are the mutants the runner applies to the file itself.
  const EDITS: Array<[string, string, string, string]> = [
    // [name, from, to, a word of the problem it must be named by]
    ["W01: the cache is made inside the provider's method (one per query: it never hits)", "    const results: vscode.SymbolInformation[] = [];\n", "    const results: vscode.SymbolInformation[] = [];\n    const symbolCache = createWorkspaceSymbolCache();\n", "2 calls of createWorkspaceSymbolCache"],
    ["W02: the cache is made inside the register function", "  context.subscriptions.push(\n    vscode.languages.registerWorkspaceSymbolProvider(", "  const symbolCache = createWorkspaceSymbolCache();\n  context.subscriptions.push(\n    vscode.languages.registerWorkspaceSymbolProvider(", "2 calls of createWorkspaceSymbolCache"],
    ["W03: the cache is made over a stand-in computation", "const symbolCache = createWorkspaceSymbolCache();", "const symbolCache = createWorkspaceSymbolCache({ flatSymbolsOf: () => [] });", "is given arguments"],
    ["W04: the cache is a `let`", "const symbolCache = createWorkspaceSymbolCache();", "let symbolCache = createWorkspaceSymbolCache();", "module-level `const symbolCache`"],
    ["W05: the cache is called something else", "const symbolCache = createWorkspaceSymbolCache();", "const cache = createWorkspaceSymbolCache();", "module-level `const symbolCache`"],
    ["W06: the setting is read once for all files (outside the loop)", "      const mode = resolveRenderMode(\n        vscode.workspace.getConfiguration(\"quarto\", uri).get<unknown>(RENDER_MODE_SETTING),\n      );\n", "", "does not read the mode"],
    ["W07: the setting is read at the workspace's scope, not the file's", "vscode.workspace.getConfiguration(\"quarto\", uri)", "vscode.workspace.getConfiguration(\"quarto\")", "does not read the mode"],
    ["W08: the setting is not passed through resolveRenderMode", "resolveRenderMode(\n        vscode.workspace.getConfiguration(\"quarto\", uri).get<unknown>(RENDER_MODE_SETTING),\n      )", "vscode.workspace.getConfiguration(\"quarto\", uri).get<unknown>(RENDER_MODE_SETTING) as never", "does not read the mode"],
    ["W09: the key is the document's file name, not the uri", "symbolCache.read(uri.toString(), document.fileName, docText, mode)", "symbolCache.read(document.fileName, document.fileName, docText, mode)", "the symbols are not"],
    ["W10: the key is one constant for every file (every file replaces the last)", "symbolCache.read(uri.toString(), document.fileName, docText, mode)", "symbolCache.read(\"workspace\", document.fileName, docText, mode)", "the symbols are not"],
    ["W11: the file name is dropped from the key (the engine of an .Rmd is read from the wrong name)", "symbolCache.read(uri.toString(), document.fileName, docText, mode)", "symbolCache.read(uri.toString(), \"\", docText, mode)", "the symbols are not"],
    ["W12: the mode is dropped from the key", "symbolCache.read(uri.toString(), document.fileName, docText, mode)", "symbolCache.read(uri.toString(), document.fileName, docText, \"execute\")", "the symbols are not"],
    ["W13: the text is the previous one (the document is read before the loop)", "symbolCache.read(uri.toString(), document.fileName, docText, mode)", "symbolCache.read(uri.toString(), document.fileName, document.lineAt(0).text, mode)", "the symbols are not"],
    ["W14: the cache is asked for every symbol of the file once per symbol", "      for (const symbol of symbolCache.read(uri.toString(), document.fileName, docText, mode)) {\n        if (!matchesWorkspaceQuery(symbol.name, query)) continue;", "      for (const symbol of symbolCache.read(uri.toString(), document.fileName, docText, mode)) {\n        symbolCache.read(uri.toString(), document.fileName, docText, mode);\n        if (!matchesWorkspaceQuery(symbol.name, query)) continue;", "the cache is read inside the symbol loop"],
    ["W15: the query filter is dropped (every symbol of every file is returned)", "        if (!matchesWorkspaceQuery(symbol.name, query)) continue;\n", "", "does not skip on"],
    ["W16: the query filter is inverted", "if (!matchesWorkspaceQuery(symbol.name, query)) continue;", "if (matchesWorkspaceQuery(symbol.name, query)) continue;", "does not skip on"],
    ["W17: the query is filtered before the cache (the cache would hold one query's symbols)", "      for (const symbol of symbolCache.read(uri.toString(), document.fileName, docText, mode)) {", "      for (const symbol of symbolCache.read(uri.toString(), document.fileName, docText, mode).filter((s) => matchesWorkspaceQuery(s.name, query))) {", "the symbols are not"],
    ["W18: the adapter builds the outline itself again", "      for (const symbol of symbolCache.read(", "      void buildOutline(docText);\n      for (const symbol of symbolCache.read(", "the adapter calls buildOutline"],
    ["W19: the adapter resolves the engine itself again", "      for (const symbol of symbolCache.read(", "      void resolveDocumentEngine(document.fileName, docText);\n      for (const symbol of symbolCache.read(", "the adapter calls resolveDocumentEngine"],
    ["W20: the adapter flattens itself again", "      for (const symbol of symbolCache.read(", "      void flattenOutline([]);\n      for (const symbol of symbolCache.read(", "the adapter calls flattenOutline"],
    ["W21: the cache is not imported", "  createWorkspaceSymbolCache,\n", "", "createWorkspaceSymbolCache is not imported"],
    ["W22: the query filter is not imported", "  matchesWorkspaceQuery,\n} from \"../core/workspace-symbols\";", "} from \"../core/workspace-symbols\";", "matchesWorkspaceQuery is not imported"],
    ["W23: the model is imported again", "import * as vscode from \"vscode\";\n", "import * as vscode from \"vscode\";\nimport { buildOutline } from \"../core/qmd/model\";\n", "imports from ../core/qmd/model"],
    ["W24: the document is read from the disk, not VS Code's cache", "const document = await vscode.workspace.openTextDocument(uri);", "const document = await vscode.workspace.openTextDocument(uri.fsPath);", "does not read `const document"],
    ["W25: the text is read twice (a second getText for the key)", "const docText = document.getText();", "const docText = document.getText() + document.getText();", "does not read `const docText"],
    ["W26: the cancellation check is dropped", "      if (token.isCancellationRequested) break;\n", "", "token.isCancellationRequested"],
  ];

  it.each(EDITS)("%s: the pin is broken, and is named", (_name, from, to, named) => {
    expect(ADAPTER.split(from).length - 1).toBe(1); // the edit applies to the live file exactly once
    const problems = problemsInAdapter(ADAPTER.replace(from, () => to));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain(named);
  });

  // A pin read from the syntax tree is not moved by what is not code.
  it("a comment, a string and a template that spell the pinned call do not satisfy the pins, and a comment that names the old calls does not break them", () => {
    const decoy = ADAPTER.replace(
      "      for (const symbol of symbolCache.read(uri.toString(), document.fileName, docText, mode)) {",
      "      // for (const symbol of symbolCache.read(uri.toString(), document.fileName, docText, mode)) {\n      const decoy = \"symbolCache.read(uri.toString(), document.fileName, docText, mode)\" + `symbolCache.read(uri.toString(), document.fileName, docText, mode)`;\n      void decoy;\n      for (const symbol of [] as Array<{ name: string; kind: string; containerName: string; selectionLine: number }>) {",
    );
    expect(decoy).not.toBe(ADAPTER);
    expect(problemsInAdapter(decoy).join("\n")).toContain("the symbols are not");
    const commented = ADAPTER.replace("class QmdWorkspaceSymbolProvider", "// flattenOutline(buildOutline(docText, resolveDocumentEngine(document.fileName, docText), mode)) ran for every file on every query\n/* buildOutline(docText) */\nconst NOTE = 'resolveDocumentEngine()';\nclass QmdWorkspaceSymbolProvider");
    expect(commented).not.toBe(ADAPTER);
    expect(problemsInAdapter(commented)).toEqual([]);
  });
});
