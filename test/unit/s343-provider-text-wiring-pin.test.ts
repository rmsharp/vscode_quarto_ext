import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as ts from "typescript";

// Session 343, the completion providers' reads of a document's text (BACKLOG: "What Session 342's review round found beside the typing-path cures", parts (2) and (3): the text memo, SIB-01's join).
// VS Code asks the FOUR completion providers registered for `quarto` on every request (crossref, citation, yaml, embedded; the filepath provider is registered for `_quarto.yml`, not for a `.qmd`), and each called
// `document.getText()`: four whole-buffer joins of one version, and four distinct but equal string objects, which the scan cache then compares with `===` in O(n) instead of O(1). They now read the text through `documentText`
// (`features/document-text`, the memo `core/document-text-memo` answers from), so a request joins the buffer once and the four providers hold ONE string object.
//
// The providers import `vscode`, so no unit test can run them: how each completion method reads the text is pinned from the SOURCE with the TypeScript compiler API (Learning 911), not with a text
// search. ⚠ WHAT THIS DOES NOT SEE: it pins the spelling of the four reads. That the memo returns one string a version is `document-text-memo.test.ts`; that the real host asks the providers in one
// request is not observed by any test (VS Code offers no read-back of the requests it makes). The other methods of these classes (definition, hover, signature help) are one-gesture requests, not typing-path
// requests, and keep `getText()`: the pin below does not look at them.
//
// The rows at the end hand each live file ONE edit (the mutants of `tools/mutation-run/mutants/s343-provider-text.json`) and require the pin to name what that edit breaks.

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
/** A source file of the tree, or "" when it is not there: a pin on a file that does not exist fails by NAME, not by an unreadable file. */
const read = (...parts: string[]): string => (existsSync(resolve(root, ...parts)) ? readFileSync(resolve(root, ...parts), "utf8") : "");

const PROVIDERS = [
  { file: "crossref.ts", cls: "CrossrefCompletionProvider" },
  { file: "citation.ts", cls: "CitationCompletionProvider" },
  { file: "yaml.ts", cls: "YamlCompletionProvider" },
  { file: "embedded.ts", cls: "EmbeddedCompletionProvider" },
] as const;
const SOURCES = Object.fromEntries(PROVIDERS.map((p) => [p.file, read("src", "providers", p.file)])) as Record<(typeof PROVIDERS)[number]["file"], string>;

const parse = (name: string, source: string): ts.SourceFile => ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
function collect<T extends ts.Node>(node: ts.Node, test: (n: ts.Node) => n is T): T[] {
  const found: T[] = [];
  const visit = (n: ts.Node): void => {
    if (test(n)) found.push(n);
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}
const flat = (node: ts.Node, sf: ts.SourceFile): string => node.getText(sf).replace(/\s+/g, " ");
const isCall = (n: ts.Node): n is ts.CallExpression => ts.isCallExpression(n);
const getTextCalls = (node: ts.Node): ts.CallExpression[] => collect(node, isCall).filter((call) => ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === "getText");

/** Every pin `source` breaks about how `cls`'s `provideCompletionItems` reads the document's text: through `documentText(<its document parameter>)`, as the first statement, and by no other read. */
function problemsInProvider(file: string, source: string, cls: string): string[] {
  const sf = parse(file, source);
  const problems: string[] = [];
  const klass = collect(sf, (n): n is ts.ClassDeclaration => ts.isClassDeclaration(n) && n.name?.text === cls)[0];
  if (klass === undefined) return [`the class ${cls} is missing`];
  const method = klass.members.find((m): m is ts.MethodDeclaration => ts.isMethodDeclaration(m) && flat(m.name, sf) === "provideCompletionItems");
  if (method === undefined || method.body === undefined) return [`${cls}.provideCompletionItems is missing`];
  // 1. The import: `documentText` comes from ../features/document-text, the one module whose memo the four providers share.
  const imported = collect(sf, (n): n is ts.ImportDeclaration => ts.isImportDeclaration(n)).some(
    (i) =>
      ts.isStringLiteral(i.moduleSpecifier) &&
      i.moduleSpecifier.text === "../features/document-text" &&
      i.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(i.importClause.namedBindings) &&
      i.importClause.namedBindings.elements.some((e) => e.name.text === "documentText"),
  );
  if (!imported) problems.push(`${file} does not import documentText from ../features/document-text`);
  // 2. The read: the method's FIRST statement is `const text = documentText(<document>)`, the document being the method's own first parameter.
  const document = method.parameters.length > 0 ? flat(method.parameters[0].name, sf) : "?";
  const first = method.body.statements[0];
  const declared = first !== undefined && ts.isVariableStatement(first) ? first.declarationList.declarations : [];
  if (declared.length !== 1 || flat(declared[0].name, sf) !== "text" || declared[0].initializer === undefined) {
    problems.push("the first statement of provideCompletionItems is not `const text = ...`");
  } else if (flat(declared[0].initializer, sf) !== `documentText(${document})`) {
    problems.push(`the text is not read through \`documentText(${document})\``);
  }
  // 3. No other read: a second whole-buffer join would put a distinct string object beside the memo's.
  if (getTextCalls(method.body).length !== 0) problems.push("provideCompletionItems calls getText itself (a whole-buffer join on every completion request)");
  const asks = collect(method.body, isCall).filter((call) => flat(call.expression, sf) === "documentText");
  if (asks.length !== 1) problems.push(`${asks.length} calls of documentText in provideCompletionItems, not one`);
  return problems;
}

describe("Session 343 -- how the four completion providers read a document's text, pinned by the syntax tree (a unit test cannot run them: they import vscode)", () => {
  for (const { file, cls } of PROVIDERS) {
    it(`${file}: ${cls}.provideCompletionItems reads the text once, through documentText`, () => {
      expect(SOURCES[file]).not.toBe("");
      expect(problemsInProvider(file, SOURCES[file], cls)).toEqual([]);
    });
  }

  it("every provider's other methods are left alone: a definition or hover request keeps getText (the pin does not see them)", () => {
    // The pin reads only `provideCompletionItems`; this row counts the getText calls the four files still hold elsewhere so that a wholesale replacement is a decision, not an accident.
    const counts = PROVIDERS.map(({ file, cls }) => {
      const sf = parse(file, SOURCES[file]);
      const klass = collect(sf, (n): n is ts.ClassDeclaration => ts.isClassDeclaration(n) && n.name?.text === cls)[0];
      return getTextCalls(sf).length - (klass === undefined ? 0 : getTextCalls(klass).length);
    });
    // crossref.ts: the definition provider; embedded.ts: hover, definition and signature help; citation.ts and yaml.ts: none.
    expect(counts).toEqual([1, 0, 0, 3]);
  });

  describe("each edit of the live file breaks the pin it should, and names it", () => {
    const edits: Array<[name: string, file: (typeof PROVIDERS)[number]["file"], from: string, to: string, expected: string]> = [
      ["P01: crossref reads the buffer itself again", "crossref.ts", "const text = documentText(document);\n    // Cross-refs apply", "const text = document.getText();\n    // Cross-refs apply", "the text is not read through `documentText(document)`"],
      ["P02: citation reads the buffer itself again", "citation.ts", "    const text = documentText(document);\n    // Citations apply", "    const text = document.getText();\n    // Citations apply", "the text is not read through `documentText(document)`"],
      ["P03: yaml reads the buffer itself again", "yaml.ts", "    const text = documentText(document);\n    // The document's engine", "    const text = document.getText();\n    // The document's engine", "the text is not read through `documentText(document)`"],
      ["P04: embedded reads the buffer itself again", "embedded.ts", "    const text = documentText(document);\n    const hit = embeddedCellAt(text, position.line);\n    // Off-region", "    const text = document.getText();\n    const hit = embeddedCellAt(text, position.line);\n    // Off-region", "the text is not read through `documentText(document)`"],
      ["P05: crossref's memo is asked about another document", "crossref.ts", "const text = documentText(document);\n    // Cross-refs apply", "const text = documentText(activeDocumentForTesting);\n    // Cross-refs apply", "the text is not read through `documentText(document)`"],
      ["P06: citation joins the buffer a second time beside the memo", "citation.ts", "    const text = documentText(document);\n    // Citations apply", "    const text = documentText(document);\n    void document.getText();\n    // Citations apply", "calls getText itself"],
      ["P07: yaml asks the memo twice", "yaml.ts", "    const text = documentText(document);\n    // The document's engine", "    const text = documentText(document);\n    void documentText(document);\n    // The document's engine", "2 calls of documentText"],
      ["P08: embedded reads the text after another statement", "embedded.ts", "    const text = documentText(document);\n    const hit = embeddedCellAt(text, position.line);\n    // Off-region", "    void position;\n    const text = documentText(document);\n    const hit = embeddedCellAt(text, position.line);\n    // Off-region", "the first statement of provideCompletionItems is not `const text = ...`"],
      ["P09: citation drops the import", "citation.ts", 'import { documentText } from "../features/document-text";\n', "", "does not import documentText"],
      ["P10: yaml imports it from the wrong module", "yaml.ts", '"../features/document-text"', '"../features/document-text-other"', "does not import documentText"],
    ];
    for (const [name, file, from, to, expected] of edits) {
      it(`${name}: the live file has the spelling the edit starts from, once, and the pin names what the edit breaks`, () => {
        const cls = PROVIDERS.find((p) => p.file === file)!.cls;
        const source = SOURCES[file];
        // The edit applies to exactly one place of the live file (a respelled neighbour must fail here, loudly, not pass by editing nothing).
        expect(source.split(from).length - 1, `${file} holds the text this edit starts from exactly once`).toBe(1);
        const problems = problemsInProvider(file, source.replace(from, to), cls);
        expect(problems.some((p) => p.includes(expected)), `${name}: expected a problem containing "${expected}", got ${JSON.stringify(problems)}`).toBe(true);
      });
    }
  });

  it("a comment, a string and an unused identifier that spell the memo's call do not satisfy the pin, and a comment that names getText does not break it", () => {
    const decoys = [
      // The read is the old one; the memo's call is spelled in a comment, a string and a declared-but-unused function.
      "class C { provideCompletionItems(document: D) {\n    // const text = documentText(document);\n    const text = document.getText();\n    const s = 'documentText(document)';\n    function unused() { return documentText(document); }\n    return text; } }",
    ];
    const withImport = (body: string): string => `import { documentText } from "../features/document-text";\n${body}`;
    expect(problemsInProvider("x.ts", withImport(decoys[0]), "C")).not.toEqual([]);
    // The right read with a comment that names the old call is not a problem.
    const right = withImport("class C { provideCompletionItems(document: D) {\n    const text = documentText(document); // not document.getText()\n    return text; } }");
    expect(problemsInProvider("x.ts", right, "C")).toEqual([]);
  });
});
