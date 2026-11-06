import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as ts from "typescript";

// Session 343, part (4), SIB-07. `src/providers/citation.ts` imports `vscode`, so no unit test can run it: how `loadCitations` reaches the bibliography cache of `src/core/citations.ts` (`createCitationCache`) is pinned
// here by its SOURCE, read with the TypeScript compiler API (the syntax tree, not a text search: Learning 911). A comment, a string or an unused identifier can neither satisfy nor break a pin made this way.
//
// ⚠ WHAT THIS DOES NOT SEE. It pins how the adapter is SPELLED: one cache made once at module level (a cache made per request would never hit), over `fs.readFile` and `fs.stat`; `loadCitations` returning the cache's read
// of the declared paths and the document's directory, after the guard that keeps a document with no bibliography, or one that is not a file, from touching the disk; the request path asking `loadCitations` only after the
// two checks that decline a line that is not a citation. It does not run the adapter and NOTHING ELSE DOES: no test drives `provideCompletionItems` through a host, so a cache that was keyed wrongly in the host would pass
// `npm run test:integration`. What the cache DOES (reuse, re-read, the bound, the order of the answers) is `s343-citation-cache-rows.test.ts`, on stand-ins for `readFile` and `stat`.
//
// The check is one function, `problemsInAdapter(source)`, which names every pin the source breaks. The live file must have none, and the rows below also hand it the live file with ONE edit (the edits are the mutants of
// `tools/mutation-run/mutants/s343-citation-cache.json`) and require it to name the pin that edit breaks: the pin can fail, and says which.

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ADAPTER = readFileSync(resolve(root, "src", "providers", "citation.ts"), "utf8");

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
/** The callee of every call under `node`, as written, in source order. */
const calleesIn = (node: ts.Node, sf: ts.SourceFile): string[] => collect(node, isCall).map((call) => flat(call.expression, sf));
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

/** The names a named import of `module` brings in, as `imported as local` where they differ, and whether it is a type-only import. `undefined` when the file has no such import. */
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

/** Every pin `citation.ts` breaks, each named by what it was meant to keep. `[]` is a source that keeps them all. */
function problemsInAdapter(source: string): string[] {
  const sf = parse("citation.ts", source);
  const problems: string[] = [];

  // 1. ONE cache, made at MODULE level over the reader and the stat, and nothing else.
  const makes = callsOf(sf, sf, "createCitationCache");
  if (makes.length !== 1) {
    problems.push(`${makes.length} calls of createCitationCache, not one`);
  } else {
    const [make] = makes;
    if (enclosingFunction(make) !== undefined) problems.push("createCitationCache is called inside a function (a cache made per request would never hit)");
    const declaration = make.parent;
    const statement = ts.isVariableDeclaration(declaration) ? declaration.parent.parent : undefined;
    if (!(ts.isVariableDeclaration(declaration) && flat(declaration.name, sf) === "citationCache" && statement !== undefined && ts.isVariableStatement(statement) && statement.parent === sf && (declaration.parent.flags & ts.NodeFlags.Const) !== 0)) {
      problems.push("the cache is not the initializer of a module-level `const citationCache`");
    }
    const options = propertiesOf(make.arguments[0], sf);
    if (make.arguments.length !== 1) problems.push("createCitationCache is not given exactly one argument (its options)");
    if (options.readFile !== '(file) => fs.readFile(file, "utf8")') problems.push('the cache\'s readFile is not `(file) => fs.readFile(file, "utf8")` (a bibliography is read as UTF-8 text)');
    if (options.stat !== "(file) => fs.stat(file)") problems.push("the cache's stat is not `(file) => fs.stat(file)` (the signature is the file's own modification time and size)");
    if (Object.keys(options).sort().join() !== "readFile,stat") problems.push(`the cache is made with the options ${Object.keys(options).sort().join()}, not readFile,stat`);
  }

  // 2. `fs` is the promises API, and the core module is imported for the cache, not for the uncached read.
  const fsImport = namedImportsOf(sf, "node:fs");
  if (fsImport === undefined || fsImport.join() !== "promises as fs") problems.push("`fs` is not `import { promises as fs } from \"node:fs\"` (the cache's reader and stat are the promise API's)");
  const coreImport = namedImportsOf(sf, "../core/citations");
  if (coreImport === undefined) {
    problems.push("nothing is imported from ../core/citations");
  } else {
    if (!coreImport.includes("createCitationCache")) problems.push("createCitationCache is not imported from ../core/citations");
    if (coreImport.includes("readCitations")) problems.push("readCitations is still imported (the adapter reads through the cache, never around it)");
  }

  // 3. `loadCitations`: the declared paths, the guard that keeps the disk untouched, and the cache's read as the last statement.
  const load = functionNamed(sf, "loadCitations");
  if (load === undefined || load.body === undefined) {
    problems.push("loadCitations is missing");
  } else {
    const statements = load.body.statements;
    const declared = statements[0];
    if (declared === undefined || !ts.isVariableStatement(declared) || declared.declarationList.declarations.length !== 1 || flat(declared.declarationList.declarations[0].name, sf) !== "relPaths" || declared.declarationList.declarations[0].initializer === undefined || flat(declared.declarationList.declarations[0].initializer!, sf) !== "bibliographyPaths(text)") {
      problems.push("the first statement of loadCitations is not `const relPaths = bibliographyPaths(text);`");
    }
    const guard = statements[1];
    if (guard === undefined || !ts.isIfStatement(guard) || flat(guard.expression, sf) !== 'relPaths.length === 0 || document.uri.scheme !== "file"' || flat(guard.thenStatement, sf) !== "{ return []; }") {
      problems.push('the second statement of loadCitations is not `if (relPaths.length === 0 || document.uri.scheme !== "file") { return []; }` (a document with no bibliography, or that is not a file, must not touch the disk)');
    }
    const last = statements[statements.length - 1];
    if (statements.length !== 3 || last === undefined || !ts.isReturnStatement(last) || last.expression === undefined || flat(last.expression, sf) !== "citationCache.read(relPaths, path.dirname(document.uri.fsPath))") {
      problems.push("the last statement of loadCitations is not `return citationCache.read(relPaths, path.dirname(document.uri.fsPath));` (the declared paths against the document's own directory, three statements in all)");
    }
    const callees = calleesIn(load.body, sf);
    if (callees.join() !== "bibliographyPaths,citationCache.read,path.dirname") problems.push(`loadCitations calls ${callees.join() || "nothing"}, not bibliographyPaths, citationCache.read and path.dirname`);
  }

  // 4. Nothing in the file reads around the cache or parses on its own.
  for (const name of ["readCitations", "parseCitations", "readFile"]) {
    const direct = callsOf(sf, sf, name);
    if (direct.length > 0) problems.push(`the adapter calls ${name} (${direct.length} times); only the cache may read and parse`);
  }
  if (identifiersNamed(sf, "readCitations").length > 0) problems.push("readCitations is mentioned in the adapter's code");

  // 5. The request path: `loadCitations` is awaited once, with the document, after the check that declines a line that is not in a citation context (the cache is not touched for it), and the provider builds no cache of
  //    its own. The lines before that check (the referenceable-line test, which another change may rewrite) are not pinned by name.
  const provide = methodNamed(sf, "CitationCompletionProvider", "provideCompletionItems");
  if (provide === undefined || provide.body === undefined) {
    problems.push("CitationCompletionProvider.provideCompletionItems is missing");
  } else {
    const loads = callsOf(provide.body, sf, "loadCitations");
    if (loads.length !== 1) {
      problems.push(`${loads.length} calls of loadCitations in provideCompletionItems, not one`);
    } else {
      const [loadCall] = loads;
      if (!ts.isAwaitExpression(loadCall.parent)) problems.push("loadCitations is not awaited in provideCompletionItems");
      if (loadCall.arguments.length !== 2 || flat(loadCall.arguments[0], sf) !== "document") problems.push("provideCompletionItems does not call `loadCitations(document, <the text>)`");
      const asks = callsOf(provide.body, sf, "citationCompletionContext");
      if (asks.length !== 1 || asks[0].getStart(sf) > loadCall.getStart(sf)) problems.push("citationCompletionContext is not asked exactly once BEFORE loadCitations (the cache is read only for a line in a citation context)");
    }
    if (callsOf(provide.body, sf, "createCitationCache").length > 0) problems.push("provideCompletionItems makes a cache");
  }
  return problems;
}

describe("Session 343 -- how citation.ts reaches the bibliography cache, pinned by the syntax tree (a unit test cannot run it: it imports vscode)", () => {
  it("citation.ts keeps every pin: one cache at module level over fs.readFile and fs.stat, loadCitations reading through it after the guard, nothing reading around it, the request path asking after the two checks", () => {
    expect(problemsInAdapter(ADAPTER)).toEqual([]);
  });

  it("the file parsed is the adapter: it parses without a syntax error and holds the functions the pins read", () => {
    const diagnostics = (parse("citation.ts", ADAPTER) as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics;
    expect(diagnostics).toEqual([]);
    const sf = parse("citation.ts", ADAPTER);
    for (const name of ["loadCitations", "registerCitationProviders", "toCompletionItem"]) expect(functionNamed(sf, name)).toBeDefined();
    expect(methodNamed(sf, "CitationCompletionProvider", "provideCompletionItems")).toBeDefined();
  });

  // The edits: each is the live file with ONE respelling, and a word of the problem it must be named by. They are the mutants the runner applies to the file itself.
  const EDITS: Array<[string, string, string, string]> = [
    // [name, from, to, a word of the problem it must be named by]
    ["P01: the cache is made inside loadCitations (one per request: it never hits)", "  return citationCache.read(relPaths, path.dirname(document.uri.fsPath));", "  const citationCache = createCitationCache({ readFile: (file) => fs.readFile(file, \"utf8\"), stat: (file) => fs.stat(file) });\n  return citationCache.read(relPaths, path.dirname(document.uri.fsPath));", "2 calls of createCitationCache"],
    ["P02: the cache is made inside provideCompletionItems", "    const citations = await loadCitations(document, text);", "    const citationCache = createCitationCache({ readFile: (file) => fs.readFile(file, \"utf8\"), stat: (file) => fs.stat(file) });\n    const citations = await loadCitations(document, text);", "provideCompletionItems makes a cache"],
    ["P03: the reader is not UTF-8", "readFile: (file) => fs.readFile(file, \"utf8\"),", "readFile: (file) => fs.readFile(file, \"latin1\"),", "readFile is not"],
    ["P04: the reader returns a Buffer", "readFile: (file) => fs.readFile(file, \"utf8\"),", "readFile: (file) => fs.readFile(file),", "readFile is not"],
    ["P05: the stat is the link's own (lstat), not the file's", "stat: (file) => fs.stat(file),", "stat: (file) => fs.lstat(file),", "stat is not"],
    ["P06: the stat is a constant (the signature never changes)", "stat: (file) => fs.stat(file),", "stat: () => Promise.resolve({ mtimeMs: 0, size: 0 }),", "stat is not"],
    ["P07: the cache is made without the stat", "  stat: (file) => fs.stat(file),\n", "", "options"],
    ["P08: the cache is made with a third option", "  stat: (file) => fs.stat(file),\n", "  stat: (file) => fs.stat(file),\n  maxFiles: 1,\n", "options"],
    ["P09: the cache is a `let`, so it can be replaced", "const citationCache = createCitationCache(", "let citationCache = createCitationCache(", "module-level `const citationCache`"],
    ["P10: the cache is called something else (the read reads another)", "const citationCache = createCitationCache(", "const cache = createCitationCache(", "module-level `const citationCache`"],
    ["P11: loadCitations reads around the cache", "  return citationCache.read(relPaths, path.dirname(document.uri.fsPath));", "  return readCitations(relPaths, path.dirname(document.uri.fsPath), (file) => fs.readFile(file, \"utf8\"));", "the last statement of loadCitations"],
    ["P12: the directory is the working directory", "citationCache.read(relPaths, path.dirname(document.uri.fsPath))", "citationCache.read(relPaths, process.cwd())", "the last statement of loadCitations"],
    ["P13: the directory is the document's path, not its directory", "citationCache.read(relPaths, path.dirname(document.uri.fsPath))", "citationCache.read(relPaths, document.uri.fsPath)", "the last statement of loadCitations"],
    ["P14: the guard for a document that is not a file is dropped (a remote document would be stat'ed)", "  if (relPaths.length === 0 || document.uri.scheme !== \"file\") {", "  if (relPaths.length === 0) {", "the second statement of loadCitations"],
    ["P15: the guard for a document with no bibliography is dropped (an empty list would be read)", "  if (relPaths.length === 0 || document.uri.scheme !== \"file\") {", "  if (document.uri.scheme !== \"file\") {", "the second statement of loadCitations"],
    ["P16: the guard comes after the read", "  const relPaths = bibliographyPaths(text);\n  if (relPaths.length === 0 || document.uri.scheme !== \"file\") {\n    return [];\n  }\n  return citationCache.read(relPaths, path.dirname(document.uri.fsPath));", "  const relPaths = bibliographyPaths(text);\n  const read = citationCache.read(relPaths, path.dirname(document.uri.fsPath));\n  if (relPaths.length === 0 || document.uri.scheme !== \"file\") {\n    return [];\n  }\n  return read;", "the last statement of loadCitations"],
    ["P17: the declared paths are read from the whole text's first line", "  const relPaths = bibliographyPaths(text);", "  const relPaths = bibliographyPaths(text.split(\"\\n\")[0]);", "the first statement of loadCitations"],
    ["P18: readCitations is imported again", "  citationCompletionContext,\n  createCitationCache,\n", "  citationCompletionContext,\n  createCitationCache,\n  readCitations,\n", "readCitations is still imported"],
    ["P19: createCitationCache is not imported", "  citationCompletionContext,\n  createCitationCache,\n", "  citationCompletionContext,\n", "createCitationCache is not imported"],
    ["P20: fs is the callback API", "import { promises as fs } from \"node:fs\";", "import * as fs from \"node:fs\";", "`fs` is not"],
    ["P21: the request reads the cache before it checks the line is in a citation context", "    const context = citationCompletionContext(lineText, position.character);\n    if (context === null) {\n      return undefined;\n    }\n    const citations = await loadCitations(document, text);\n", "    const citations = await loadCitations(document, text);\n    const context = citationCompletionContext(lineText, position.character);\n    if (context === null) {\n      return undefined;\n    }\n", "BEFORE loadCitations"],
    ["P22: loadCitations is not awaited", "    const citations = await loadCitations(document, text);", "    const citations = loadCitations(document, text) as unknown as Citation[];", "is not awaited"],
    ["P23: loadCitations is not given the document", "    const citations = await loadCitations(document, text);", "    const citations = await loadCitations(undefined as never, text);", "does not call `loadCitations(document,"],
    ["P24: loadCitations is asked twice", "    const citations = await loadCitations(document, text);", "    await loadCitations(document, text);\n    const citations = await loadCitations(document, text);", "2 calls of loadCitations"],
    ["P25: the citation-context check is dropped (every line reads the cache)", "    const context = citationCompletionContext(lineText, position.character);\n", "    const context = { start: 0, end: 0, typed: \"\" };\n", "citationCompletionContext is not asked"],
    ["P26: the adapter parses a bibliography itself", "  return citationCache.read(relPaths, path.dirname(document.uri.fsPath));", "  void parseCitations(\"\");\n  return citationCache.read(relPaths, path.dirname(document.uri.fsPath));", "parseCitations"],
  ];

  it.each(EDITS)("%s: the pin is broken, and is named", (_name, from, to, named) => {
    expect(ADAPTER.split(from).length - 1).toBe(1); // the edit applies to the live file exactly once
    const problems = problemsInAdapter(ADAPTER.replace(from, () => to));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain(named);
  });

  // A pin read from the syntax tree is not moved by what is not code.
  it("a comment, a string and a template that spell the pinned call do not satisfy the pins, and a comment that names the old read does not break them", () => {
    const decoy = ADAPTER.replace(
      "  return citationCache.read(relPaths, path.dirname(document.uri.fsPath));",
      "  // return citationCache.read(relPaths, path.dirname(document.uri.fsPath));\n  const decoy = \"citationCache.read(relPaths, path.dirname(document.uri.fsPath))\" + `citationCache.read(relPaths, path.dirname(document.uri.fsPath))`;\n  void decoy;\n  return [];",
    );
    expect(decoy).not.toBe(ADAPTER);
    expect(problemsInAdapter(decoy).join("\n")).toContain("the last statement of loadCitations");
    const commented = ADAPTER.replace("const QMD:", "// readCitations(relPaths, dir, (file) => fs.readFile(file, \"utf8\")) read every bibliography on every request\n/* parseCitations(content) */\nconst NOTE = 'readCitations()';\nconst QMD:");
    expect(commented).not.toBe(ADAPTER);
    expect(problemsInAdapter(commented)).toEqual([]);
  });
});
