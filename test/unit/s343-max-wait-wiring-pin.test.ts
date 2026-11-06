import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as ts from "typescript";

// Session 343. `src/features/execution.ts` and `src/features/cell-background.ts` import `vscode`, so no unit test can run them: that each hands the typing path's MAXIMUM WAIT to its scheduler is pinned here by the SOURCE, read with the
// TypeScript compiler API (`ts.createSourceFile`, then the syntax tree), not with a text search (Learning 911): a comment, a string or an unused identifier can neither satisfy nor break a pin made this way.
//
// The question is one option of one call in each adapter: `createCellContextScheduler({ ..., maxWaitMs: TYPING_MAX_WAIT_MS, ... })` in `registerExecutionFeature` and `createKeyedDebouncer({ ..., maxWaitMs: TYPING_MAX_WAIT_MS })` in
// `registerCellBackgroundFeature`, where `TYPING_MAX_WAIT_MS` is the constant imported from `core/typing-debounce` (not a literal, not another constant, not a local of the same name). The rest of how the two adapters are
// spelled is `s342-typing-wiring-pin.test.ts`; what the maximum wait does is `s343-max-wait.test.ts`. A debouncer made without it is the pure trailing debounce of Session 342: events less than 150 ms apart postpone the key and the
// tint without limit.
//
// ⚠ WHAT THIS DOES NOT SEE: the same as the pin it sits beside. It pins how the call sites are SPELLED; nothing runs the adapters' event wiring in a real host except the one integration row for the key (`test/integration/suite/in-code-cell.test.ts`,
// written in Session 343 and not run by it), which waits 450 ms after an edit and so cannot see a maximum wait.
//
// The checks are one function, `problemsIn(source, which)`, which names every pin the source breaks. The live files must have none, and the rows below hand it the live file with ONE edit (the edits are the mutants of
// `tools/mutation-run/mutants/s343-max-wait.json`) and require it to name the pin that edit breaks.

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

/** The text of a node with every run of whitespace collapsed: a syntax node's own spelling. */
const flat = (node: ts.Node, sf: ts.SourceFile): string => node.getText(sf).replace(/\s+/g, " ");
const functionNamed = (sf: ts.SourceFile, name: string): ts.FunctionDeclaration | undefined =>
  collect(sf, (n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && n.name?.text === name)[0];

/** The properties `name: initializer` of an object literal, as written, and the shorthand ones as `name: name`. */
function propertiesOf(object: ts.Expression | undefined, sf: ts.SourceFile): Record<string, string> {
  const found: Record<string, string> = {};
  if (object !== undefined && ts.isObjectLiteralExpression(object)) {
    for (const p of object.properties) {
      if (ts.isPropertyAssignment(p)) found[flat(p.name, sf)] = flat(p.initializer, sf);
      else if (ts.isShorthandPropertyAssignment(p)) found[flat(p.name, sf)] = flat(p.name, sf);
    }
  }
  return found;
}

type Which = "execution" | "background";
const SPEC: Record<Which, { register: string; make: string; file: string }> = {
  execution: { register: "registerExecutionFeature", make: "createCellContextScheduler", file: "execution.ts" },
  background: { register: "registerCellBackgroundFeature", make: "createKeyedDebouncer", file: "cell-background.ts" },
};

/** Every pin of the maximum wait that `source` breaks, each named by what it was meant to keep. `[]` is a source that keeps them all. */
function problemsIn(source: string, which: Which): string[] {
  const { register: registerName, make: makeName, file } = SPEC[which];
  const sf = parse(file, source);
  const problems: string[] = [];
  const register = functionNamed(sf, registerName);
  if (register === undefined || register.body === undefined) return [`${registerName} is missing`];

  // 1. The one scheduler (or debouncer) is made directly in the register function, and its options hold `maxWaitMs: TYPING_MAX_WAIT_MS`.
  const makes = collect(sf, (n): n is ts.CallExpression => ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === makeName);
  if (makes.length !== 1) {
    problems.push(`${makes.length} calls of ${makeName}, not one`);
  } else {
    const [make] = makes;
    const options = propertiesOf(make.arguments[0], sf);
    if (!("maxWaitMs" in options)) problems.push(`${makeName} is made without a maxWaitMs (the typing debounce would have no maximum wait: events less than 150 ms apart postpone the work without limit)`);
    else if (options.maxWaitMs !== "TYPING_MAX_WAIT_MS") problems.push(`the maxWaitMs of ${makeName} is ${options.maxWaitMs}, not TYPING_MAX_WAIT_MS`);
    const names = collect(make.arguments[0], (n): n is ts.PropertyAssignment => ts.isPropertyAssignment(n) && flat(n.name, sf) === "maxWaitMs");
    if (names.length > 1) problems.push(`${names.length} maxWaitMs options in the call of ${makeName}, not one`);
  }

  // 2. `TYPING_MAX_WAIT_MS` is the constant core exports, imported by name from `../core/typing-debounce`: not declared in the file, not renamed on import.
  const imports = collect(sf, (n): n is ts.ImportDeclaration => ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && n.moduleSpecifier.text === "../core/typing-debounce");
  const named = imports.flatMap((declaration) => {
    const bindings = declaration.importClause?.namedBindings;
    return bindings !== undefined && ts.isNamedImports(bindings) ? bindings.elements : [];
  });
  const imported = named.filter((element) => element.name.text === "TYPING_MAX_WAIT_MS" && element.propertyName === undefined);
  if (imported.length !== 1) problems.push("TYPING_MAX_WAIT_MS is not imported by name from ../core/typing-debounce (a local or renamed one is not the exported constant)");
  const declared = collect(sf, (n): n is ts.VariableDeclaration => ts.isVariableDeclaration(n) && flat(n.name, sf) === "TYPING_MAX_WAIT_MS");
  if (declared.length > 0) problems.push("TYPING_MAX_WAIT_MS is declared in the file (it must be the one core exports)");
  return problems;
}

describe("Session 343 -- execution.ts and cell-background.ts hand TYPING_MAX_WAIT_MS to the typing path's scheduler and debouncer, pinned by the syntax tree (a unit test cannot run them: they import vscode)", () => {
  it("execution.ts hands the cell-context scheduler maxWaitMs: TYPING_MAX_WAIT_MS, the constant imported from core", () => {
    expect(problemsIn(EXECUTION, "execution")).toEqual([]);
  });

  it("cell-background.ts hands the keyed debouncer maxWaitMs: TYPING_MAX_WAIT_MS, the constant imported from core", () => {
    expect(problemsIn(BACKGROUND, "background")).toEqual([]);
  });

  // The edits: each is a live file with ONE respelling, and the pin it must break. They are the mutants the runner applies to the file itself.
  const EXECUTION_EDITS: Array<[string, string, string, string]> = [
    // [name, from, to, a word of the problem it must be named by]
    ["W01: the scheduler has no maximum wait", "    maxWaitMs: TYPING_MAX_WAIT_MS,\n", "", "is made without a maxWaitMs"],
    ["W02: the maximum wait is a literal", "    maxWaitMs: TYPING_MAX_WAIT_MS,\n", "    maxWaitMs: 1000,\n", "is 1000, not TYPING_MAX_WAIT_MS"],
    ["W03: the maximum wait is the debounce delay", "    maxWaitMs: TYPING_MAX_WAIT_MS,\n", "    maxWaitMs: TYPING_DEBOUNCE_MS,\n", "is TYPING_DEBOUNCE_MS, not TYPING_MAX_WAIT_MS"],
    ["W04: the maximum wait is undefined", "    maxWaitMs: TYPING_MAX_WAIT_MS,\n", "    maxWaitMs: undefined,\n", "is undefined, not TYPING_MAX_WAIT_MS"],
    ["W05: the constant is not imported","  TYPING_MAX_WAIT_MS,\n", "", "is not imported by name"],
    ["W06: the constant is renamed on import", "  TYPING_MAX_WAIT_MS,\n", "  TYPING_DEBOUNCE_MS as TYPING_MAX_WAIT_MS,\n", "is not imported by name"],
    ["W07: the option is given twice", "    maxWaitMs: TYPING_MAX_WAIT_MS,\n", "    maxWaitMs: TYPING_MAX_WAIT_MS,\n    maxWaitMs: TYPING_MAX_WAIT_MS,\n", "2 maxWaitMs options"],
  ];
  const BACKGROUND_EDITS: Array<[string, string, string, string]> = [
    ["W08: the debouncer has no maximum wait", "    maxWaitMs: TYPING_MAX_WAIT_MS,\n", "", "is made without a maxWaitMs"],
    ["W09: the maximum wait is a literal", "    maxWaitMs: TYPING_MAX_WAIT_MS,\n", "    maxWaitMs: 1000,\n", "is 1000, not TYPING_MAX_WAIT_MS"],
    ["W10: the maximum wait is the debounce delay", "    maxWaitMs: TYPING_MAX_WAIT_MS,\n", "    maxWaitMs: TYPING_DEBOUNCE_MS,\n", "is TYPING_DEBOUNCE_MS, not TYPING_MAX_WAIT_MS"],
    ["W11: the maximum wait is undefined", "    maxWaitMs: TYPING_MAX_WAIT_MS,\n", "    maxWaitMs: undefined,\n", "is undefined, not TYPING_MAX_WAIT_MS"],
    ["W12: the constant is not imported", "  TYPING_MAX_WAIT_MS,\n", "", "is not imported by name"],
    ["W13: the constant is renamed on import", "  TYPING_MAX_WAIT_MS,\n", "  TYPING_DEBOUNCE_MS as TYPING_MAX_WAIT_MS,\n", "is not imported by name"],
    ["W14: the option is given twice", "    maxWaitMs: TYPING_MAX_WAIT_MS,\n", "    maxWaitMs: TYPING_MAX_WAIT_MS,\n    maxWaitMs: TYPING_MAX_WAIT_MS,\n", "2 maxWaitMs options"],
  ];

  it.each(EXECUTION_EDITS)("execution.ts, %s: the pin is broken, and is named", (_name, from, to, named) => {
    expect(EXECUTION.split(from).length - 1).toBe(1); // the edit applies to the live file exactly once
    const problems = problemsIn(EXECUTION.replace(from, () => to), "execution");
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain(named);
  });

  it.each(BACKGROUND_EDITS)("cell-background.ts, %s: the pin is broken, and is named", (_name, from, to, named) => {
    expect(BACKGROUND.split(from).length - 1).toBe(1);
    const problems = problemsIn(BACKGROUND.replace(from, () => to), "background");
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain(named);
  });

  it("a local TYPING_MAX_WAIT_MS declared beside the real import is named, and so is a second call of the factory without the option", () => {
    const shadow = EXECUTION.replace("const IN_CELL_CONTEXT", "const TYPING_MAX_WAIT_MS = 1000;\nconst IN_CELL_CONTEXT");
    expect(shadow).not.toBe(EXECUTION);
    expect(problemsIn(shadow, "execution").join("\n")).toContain("is declared in the file");
    const second = BACKGROUND.replace("  context.subscriptions.push(\n    decorator,", "  createKeyedDebouncer({ timers: realTimers, delayMs: TYPING_DEBOUNCE_MS });\n  context.subscriptions.push(\n    decorator,");
    expect(second).not.toBe(BACKGROUND);
    expect(problemsIn(second, "background").join("\n")).toContain("2 calls of createKeyedDebouncer");
  });

  // A pin read from the syntax tree is not moved by what is not code.
  it("a comment, a string and a template that spell the option do not satisfy the pin, and a comment that names the constant does not break it", () => {
    const withoutOption = EXECUTION.replace("    maxWaitMs: TYPING_MAX_WAIT_MS,\n", "    // maxWaitMs: TYPING_MAX_WAIT_MS,\n    /* maxWaitMs: TYPING_MAX_WAIT_MS, */\n");
    expect(withoutOption).not.toBe(EXECUTION);
    const decoy = withoutOption.replace("const IN_CELL_CONTEXT", 'const NOTE = "maxWaitMs: TYPING_MAX_WAIT_MS" + `maxWaitMs: TYPING_MAX_WAIT_MS`;\nconst IN_CELL_CONTEXT');
    expect(decoy).not.toBe(withoutOption);
    expect(problemsIn(decoy, "execution").join("\n")).toContain("is made without a maxWaitMs");
    const commented = BACKGROUND.replace("function isVisible(", "// maxWaitMs: TYPING_MAX_WAIT_MS bounds the postponement of the tint\nconst NOTE = 'TYPING_MAX_WAIT_MS';\nfunction isVisible(");
    expect(commented).not.toBe(BACKGROUND);
    expect(problemsIn(commented, "background")).toEqual([]);
  });

  it("the files parsed are the adapters: they parse without a syntax error and hold the register functions the pins read", () => {
    for (const [name, source, register] of [
      ["execution.ts", EXECUTION, "registerExecutionFeature"],
      ["cell-background.ts", BACKGROUND, "registerCellBackgroundFeature"],
    ] as const) {
      const sf = parse(name, source);
      expect((sf as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics).toEqual([]);
      expect(functionNamed(sf, register)).toBeDefined();
    }
  });
});
