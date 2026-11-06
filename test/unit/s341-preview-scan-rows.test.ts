import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { type BrowseUrlScanner, createBrowseUrlScanner } from "../../src/core/preview-url";

// Session 341 — the BACKLOG item "Slow shapes and residuals found by Session 339's review round", part (3). `quarto preview` writes its startup noise to stderr in chunks. The adapter (`src/features/preview.ts`)
// used to append every chunk to one string and run `parseBrowseUrl(stderr)` on the WHOLE string until the `Browse at <url>` line arrived: `output.replace(ANSI_PATTERN, "")` copies the buffer and the unanchored
// pattern scans it, so the cost was the bytes so far times the chunks. `createBrowseUrlScanner()` (`src/core/preview-url.ts`) is the interface the adapter calls now; these are the CLOCK rows, and the sibling
// `preview-url-scanner-equivalence.test.ts` pins the ANSWERS.
//
// Measured at `c20f0e8` (Session 341, one fresh process per timing, Node, `stderr += chunk; parseBrowseUrl(stderr)` per chunk, lines of startup noise with no marker, load 2.7 to 10.7):
//   4,096-byte chunks, plain lines:        106 / 341 / 1,350 / 5,522 ms at 1 / 2 / 4 / 8 MiB (4x per doubling);
//   4,096-byte chunks, lines with SGR:     352 / 1,408 / 6,129 ms at 1 / 2 / 4 MiB;
//   65,536-byte chunks, plain lines:       352 / 1,425 / 5,740 ms at 8 / 16 / 32 MiB;
//   65,536-byte chunks, lines with SGR:    1,699 / 8,126 ms at 8 / 16 MiB;
//   ONE line with no newline, 4,096-byte chunks: 197 / 741 / 3,093 ms at 2 / 4 / 8 MiB;
//   ONE-byte chunks, plain lines:          22,412 ms at 256 KiB, 89,588 ms at 512 KiB (4x per doubling; about six minutes at 1 MiB, so the row stops at 256 KiB).
// The sizes the rows use (below) were taken from those figures and re-timed in the rows themselves against the seam commit `70bab96` (the old logic behind `createBrowseUrlScanner`), load 6.4 to 7.8:
//   12 MiB plain, 4,096-byte chunks 8.8 s; 4 MiB SGR, 4,096-byte chunks 6.2 s; 48 MiB plain, 65,536-byte chunks 8.9 s; 16 MiB SGR, 65,536-byte chunks 9.5 s; ONE 16 MiB line 12.2 s; 256 KiB in one-byte chunks 15.5 s.
// That is 6x to 16x the limit. The last tenth of the pushes took 17x to 24x the first tenth on the shapes the ratio is asserted on (12 MiB plain: 3,143 against 129 ms; 4 MiB SGR: 1,155 against 66 ms; one-byte
// chunks: 4,377 against 195 ms), checked with the clock assertion switched off.
// The cure (`createBrowseUrlScanner` as committed with these rows), the same six shapes, one fresh process each outside the test: 9 / 12 / 23 / 43 / 20 / 11 ms at load 14 (23x to 110x under the limit), the last
// tenth of the pushes costing what the first does. The whole file, twelve rows with their 96 MiB of generated text, runs in 0.14 s at load 19.
//
// WHAT THE ANSWER IS (Learning 903: the site is reached only while no complete `Browse at <url>` line has arrived, so every row ends on the marker). The scanner answers null for every push until the marker line
// is complete, and the URL at the push that completes it; the rows read that last answer back (Learning 907), after the whole stream of noise went through.
//
// WHAT THE CLOCK CAN SEE. The limit is one second for the whole feed (the chunks are cut before the clock starts). A second, machine-independent reading is the SHAPE of the cost: the last tenth of the pushes against
// the first tenth. A linear scanner takes about the same for both; the old logic took 17x to 24x longer for the last (Learning 877: a CPU five times faster would let a clock row pass a quadratic reader, a ratio would not).

const LIMIT_MS = 1000;
const URL = "http://localhost:3958/";
const MARKER_PLAIN = `Browse at ${URL}\n`;
const MARKER_SGR = `\x1b[32mBrowse at \x1b[39m\x1b[4m\x1b[32m${URL}\x1b[39m\x1b[24m\n`;

const MIB = 1024 * 1024;
const KIB = 1024;

// The sizes the clock rows are built on, each chosen so that the old logic takes 6x to 16x the limit (see the figures above) and the cure takes far under it. A row near the end of the file pins them, and each clock row checks that it really fed that much.
const CHUNK_SMALL = 4 * KIB;
const CHUNK_LARGE = 64 * KIB;
const SIZES = { plain4k: 12 * MIB, sgr4k: 4 * MIB, plain64k: 48 * MIB, sgr64k: 16 * MIB, oneLine: 16 * MIB, oneByte: 256 * KIB };

/** Startup noise as `quarto preview` writes it, plain: five distinct lines (the last one is the longest) repeated until `bytes` are reached, ending on a line boundary. */
const PLAIN_BLOCK =
  "processing file: sample.qmd\n" +
  "Resolving dependency graph for the startup phase of the render pipeline step\n" +
  "Output created: sample.html\n" +
  "  1/12 [unnamed-chunk-1]\n" +
  "Starting the file watcher on the project directory and waiting for the first change to arrive here\n";

/** The same, with the SGR escapes quarto wraps its lines in (several per line). */
const SGR_BLOCK =
  "\x1b[32mWatching files for changes\x1b[39m\n" +
  "\x1b[1m\x1b[34mprocessing file:\x1b[39m\x1b[22m \x1b[4msample.qmd\x1b[24m and \x1b[32mresolving\x1b[39m the startup pipeline\n" +
  "\x1b[33mOutput created:\x1b[39m sample.html\n" +
  "\x1b[2m  1/12 [unnamed-chunk-1]\x1b[22m\n" +
  "\x1b[36mStarting\x1b[39m the \x1b[1mfile watcher\x1b[22m on the project directory and waiting for the \x1b[3mfirst\x1b[23m change\n";

function noise(block: string, bytes: number): string {
  return block.repeat(Math.ceil(bytes / block.length));
}

/** Cut `text` into chunks of `size` characters (the last one may be shorter). */
function cut(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let at = 0; at < text.length; at += size) {
    chunks.push(text.slice(at, at + size));
  }
  return chunks;
}

type Feed = { answers: Array<string | null>; totalMs: number; firstMs: number; lastMs: number };

/**
 * Push every chunk into a scanner (a fresh real one unless a stand-in is given), timing the whole feed and its first and last tenth by `now` (the real clock unless a fake is given). The clock covers the pushes only.
 * The scanner and the clock are parameters so that the helper's own numbers can be pinned: with the real scanner and the real clock alone, a clock that read 0 would still pass every row that is decided by the total.
 */
function feed(chunks: readonly string[], scanner: BrowseUrlScanner = createBrowseUrlScanner(), now: () => number = () => performance.now()): Feed {
  const n = chunks.length;
  const tenth = Math.max(1, Math.floor(n / 10));
  const answers: Array<string | null> = new Array<string | null>(n);
  const t0 = now();
  for (let i = 0; i < tenth; i++) {
    answers[i] = scanner.push(chunks[i]);
  }
  const t1 = now();
  for (let i = tenth; i < n - tenth; i++) {
    answers[i] = scanner.push(chunks[i]);
  }
  const t2 = now();
  for (let i = n - tenth; i < n; i++) {
    answers[i] = scanner.push(chunks[i]);
  }
  const t3 = now();
  return { answers, totalMs: t3 - t0, firstMs: t1 - t0, lastMs: t3 - t2 };
}

/** Every push answered null except the last, which answered the URL. */
function answeredOnlyAtTheMarker(answers: ReadonlyArray<string | null>): { early: number[]; last: string | null } {
  const early: number[] = [];
  for (let i = 0; i < answers.length - 1; i++) {
    if (answers[i] !== null) early.push(i);
  }
  return { early, last: answers[answers.length - 1] };
}

/** The last tenth of the pushes costs about what the first did: at most 4x, and a 100 ms floor keeps a garbage-collection pause from deciding it. */
const lastTenthWithin = (firstMs: number, lastMs: number): boolean => lastMs < 4 * firstMs + 100;

describe("the Session 341 clock helper", () => {
  it("feed hands back every push's answer, the real scanner's and a stand-in's, and pushes each chunk once, in order", () => {
    expect(feed(["a\n", "b", "\n", MARKER_PLAIN]).answers).toEqual([null, null, null, URL]);
    const seen: string[] = [];
    const standIn: BrowseUrlScanner = {
      push: (chunk) => {
        seen.push(chunk);
        return chunk === "c" ? "answered" : null;
      },
    };
    expect(feed(["a", "b", "c", "d"], standIn).answers).toEqual([null, null, "answered", null]);
    expect(seen).toEqual(["a", "b", "c", "d"]);
  });

  it("feed's three numbers are exact under a clock that only the pushes advance (push number i costs i): the first tenth, the last tenth and the whole feed", () => {
    // 20 pushes: a tenth is 2, so the first window is pushes 1 and 2 (1 + 2), the last window pushes 19 and 20 (19 + 20) and the whole feed 1 + 2 + ... + 20. The clock starts at 1000: only differences count.
    let clock = 1000;
    let pushed = 0;
    const costly: BrowseUrlScanner = {
      push: () => {
        pushed++;
        clock += pushed;
        return null;
      },
    };
    const twenty = feed(new Array<string>(20).fill("x"), costly, () => clock);
    expect({ totalMs: twenty.totalMs, firstMs: twenty.firstMs, lastMs: twenty.lastMs }).toEqual({ totalMs: 210, firstMs: 3, lastMs: 39 });
    // Fewer than ten pushes: a tenth is still one push (the first window is push 1, the last window push 3).
    clock = 7;
    pushed = 0;
    const three = feed(["x", "x", "x"], costly, () => clock);
    expect({ totalMs: three.totalMs, firstMs: three.firstMs, lastMs: three.lastMs }).toEqual({ totalMs: 6, firstMs: 1, lastMs: 3 });
  });

  it("feed's real clock covers the time the pushes take: a stand-in that spins 2 ms per push, 20 pushes", () => {
    const spinning: BrowseUrlScanner = {
      push: () => {
        const until = performance.now() + 2;
        while (performance.now() < until) {
          // spin: the push takes at least 2 ms by the same clock
        }
        return null;
      },
    };
    const { totalMs, firstMs, lastMs } = feed(new Array<string>(20).fill("x"), spinning);
    // A tenth is 2 pushes: at least 4 ms in each outer window and 32 in the middle one, 40 in all. Load can only raise a number here, never lower it, so the bounds stay exact.
    expect(firstMs).toBeGreaterThanOrEqual(4);
    expect(lastMs).toBeGreaterThanOrEqual(4);
    expect(totalMs - firstMs - lastMs).toBeGreaterThanOrEqual(32);
    expect(totalMs).toBeGreaterThanOrEqual(40);
  });

  it("answeredOnlyAtTheMarker names the pushes that answered early", () => {
    expect(answeredOnlyAtTheMarker([null, URL, null, URL])).toEqual({ early: [1], last: URL });
    expect(answeredOnlyAtTheMarker([null, null, URL])).toEqual({ early: [], last: URL });
  });

  it("lastTenthWithin accepts up to four times the first tenth plus 100 ms, and refuses what the old logic took (3,143 against 129 ms; 1,155 against 66 ms; 4,377 against 195 ms)", () => {
    expect(lastTenthWithin(10, 139.9)).toBe(true);
    expect(lastTenthWithin(10, 140)).toBe(false);
    expect(lastTenthWithin(0, 99.9)).toBe(true);
    expect(lastTenthWithin(0, 100)).toBe(false);
    expect(lastTenthWithin(129, 3143)).toBe(false);
    expect(lastTenthWithin(66, 1155)).toBe(false);
    expect(lastTenthWithin(195, 4377)).toBe(false);
  });
});

describe("Session 341 — the stderr of `quarto preview` before the Browse at line (the BACKLOG item \"Slow shapes and residuals found by Session 339's review round\", part 3)", () => {
  /** `noise` are the pushes of startup text, cut `chunkSize` characters at a time; `tail` are the pushes that end the stream (the marker, and for one line the newline before it). */
  type Row = { site: string; bytes: number; chunkSize: number; build: () => { noise: string[]; tail: string[] }; ratio: boolean };

  const ROWS: Row[] = [
    { site: "4,096-byte chunks, 12 MiB of plain startup lines, then the marker", bytes: SIZES.plain4k, chunkSize: CHUNK_SMALL, build: () => ({ noise: cut(noise(PLAIN_BLOCK, SIZES.plain4k), CHUNK_SMALL), tail: [MARKER_PLAIN] }), ratio: true },
    { site: "4,096-byte chunks, 4 MiB of startup lines with SGR escapes, then the marker", bytes: SIZES.sgr4k, chunkSize: CHUNK_SMALL, build: () => ({ noise: cut(noise(SGR_BLOCK, SIZES.sgr4k), CHUNK_SMALL), tail: [MARKER_SGR] }), ratio: true },
    { site: "65,536-byte chunks, 48 MiB of plain startup lines, then the marker", bytes: SIZES.plain64k, chunkSize: CHUNK_LARGE, build: () => ({ noise: cut(noise(PLAIN_BLOCK, SIZES.plain64k), CHUNK_LARGE), tail: [MARKER_PLAIN] }), ratio: true },
    { site: "65,536-byte chunks, 16 MiB of startup lines with SGR escapes, then the marker", bytes: SIZES.sgr64k, chunkSize: CHUNK_LARGE, build: () => ({ noise: cut(noise(SGR_BLOCK, SIZES.sgr64k), CHUNK_LARGE), tail: [MARKER_SGR] }), ratio: true },
    // ONE enormous line with no newline in it, 4,096 characters at a time. Nothing can be answered until its newline comes, and the line is then read once: the cost is in the LAST pushes by design, so the
    // ratio of the last tenth to the first does not apply; the clock does (the old logic re-read the whole line on every chunk).
    { site: "ONE line of 16 MiB with no newline in 4,096-character chunks, then a newline and the marker", bytes: SIZES.oneLine, chunkSize: CHUNK_SMALL, build: () => ({ noise: cut("x".repeat(SIZES.oneLine), CHUNK_SMALL), tail: ["\n", MARKER_PLAIN] }), ratio: false },
    // One character at a time: 262,144 pushes (256 KiB) of the plain lines, then the marker one character at a time too.
    { site: "ONE-byte chunks, 256 KiB of plain startup lines, then the marker", bytes: SIZES.oneByte, chunkSize: 1, build: () => ({ noise: cut(noise(PLAIN_BLOCK, SIZES.oneByte), 1), tail: [...MARKER_PLAIN] }), ratio: true },
  ];

  it.each(ROWS.map((row) => [row.site, row] as const))(
    "%s: every push answers null until the marker line is whole, the URL then, in under one second",
    (_site, row) => {
      const built = row.build();
      // The row really feeds what its title says: at least `bytes` characters of noise, in chunks of `chunkSize` (the last one may be shorter).
      const characters = built.noise.reduce((sum, chunk) => sum + chunk.length, 0);
      expect(characters).toBeGreaterThanOrEqual(row.bytes);
      expect(built.noise.reduce((longest, chunk) => Math.max(longest, chunk.length), 0)).toBe(row.chunkSize);
      expect(built.noise.length).toBe(Math.ceil(characters / row.chunkSize));
      const { answers, totalMs, firstMs, lastMs } = feed([...built.noise, ...built.tail]);
      // The answer first, so that a failure of the clock below is a failure of the clock alone.
      const { early, last } = answeredOnlyAtTheMarker(answers);
      expect(early).toEqual([]);
      expect(last).toBe(URL);
      expect(totalMs).toBeLessThan(LIMIT_MS);
      // A clock that never ticked over megabytes of text is not a clock: the helper rows above pin its arithmetic, this keeps a row decided by the total alone from passing on a stuck one.
      expect(totalMs).toBeGreaterThan(0);
      if (row.ratio) {
        // The old logic took 17x to 24x the first tenth here and seconds in absolute terms.
        expect(lastTenthWithin(firstMs, lastMs)).toBe(true);
      }
    },
    120_000,
  );

  // CONTROLS: shapes the old logic handled in linear time or close to it, written to pass on it (and on the cure).
  it("control: a marker line in the very first chunk is answered by the first push", () => {
    const scanner = createBrowseUrlScanner();
    expect(scanner.push(MARKER_PLAIN)).toBe(URL);
  });

  it("control: 256 KiB of plain lines in 4,096-byte chunks, then the marker, is answered at the marker and fast", () => {
    const { answers, totalMs } = feed([...cut(noise(PLAIN_BLOCK, 256 * KIB), 4 * KIB), MARKER_PLAIN]);
    const { early, last } = answeredOnlyAtTheMarker(answers);
    expect(early).toEqual([]);
    expect(last).toBe(URL);
    expect(totalMs).toBeLessThan(LIMIT_MS);
  });

  it("control: 1 MiB of lines with SGR escapes in 65,536-byte chunks (sixteen pushes), then the marker, is answered at the marker", () => {
    const { answers } = feed([...cut(noise(SGR_BLOCK, MIB), 64 * KIB), MARKER_SGR]);
    const { early, last } = answeredOnlyAtTheMarker(answers);
    expect(early).toEqual([]);
    expect(last).toBe(URL);
  });

  // The rows above fix the limit and the sizes: a limit of 100 s, or an 8 KiB stream, would pass the old logic too.
  it("keeps the limit and the sizes the clock rows are built on", () => {
    expect(LIMIT_MS).toBe(1000);
    expect([CHUNK_SMALL, CHUNK_LARGE]).toEqual([4096, 65_536]);
    expect(SIZES).toEqual({ plain4k: 12_582_912, sgr4k: 4_194_304, plain64k: 50_331_648, sgr64k: 16_777_216, oneLine: 16_777_216, oneByte: 262_144 });
  });
});

// ---- THE WIRING. `src/features/preview.ts` imports `vscode`, so no unit test can run it, and no unit test can see what its stderr handler does when VS Code runs it: `test/integration/suite/preview.test.ts` is the behaviour check, and it was not
// run for this change (it takes over the screen). What a unit test CAN do is read the adapter's SYNTAX TREE (the TypeScript compiler API, a devDependency), so that a comment, a string, a dead alias or an unused import can neither satisfy
// the pin nor break it, which the first version of this gate (regular expressions that stripped comments from the text) could not promise (Learning 899: a source-text gate pins spelling, not behaviour; this one pins structure, and
// structure is still not behaviour). The structure pinned: ONE scanner per spawn, `const urlScanner = createBrowseUrlScanner()` in the Promise executor; the stderr `data` handler turns its chunk into text with `toString()`, appends exactly that
// text to the channel, and feeds exactly that text to the scanner, once in the whole file and only inside `if (!urlShown)`; the preview is shown with the URL the scanner answered, in the `if` on that answer that also sets `urlShown`;
// nothing accumulates (the handler's only assignment is the flag, the executor keeps no state but `settled` and `urlShown`, the handler calls nothing that could keep text); the stdout handler never touches the scanner; and the
// whole-buffer parser `parseBrowseUrl` is not named anywhere in code.

type Group = "imports" | "scanner" | "handler" | "showing" | "accumulation" | "stdout";
type Wiring = Record<Group, string[]>;

/** Every node under `root` (itself included) that `test` accepts, in source order. */
function collect<T extends ts.Node>(root: ts.Node, test: (node: ts.Node) => node is T): T[] {
  const found: T[] = [];
  const visit = (node: ts.Node): void => {
    if (test(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return found;
}

/** `a.b.c` for a chain of names, `this` and property accesses (a `?.` reads as `.`); `<expr>.name` when the object is anything else (a call, an index). */
function dotted(expression: ts.Expression): string {
  if (ts.isIdentifier(expression)) return expression.text;
  if (expression.kind === ts.SyntaxKind.ThisKeyword) return "this";
  if (ts.isPropertyAccessExpression(expression)) return `${dotted(expression.expression)}.${expression.name.text}`;
  if (ts.isNonNullExpression(expression) || ts.isParenthesizedExpression(expression)) return dotted(expression.expression);
  return "<expr>";
}

const isName = (node: ts.Node | undefined, name: string): node is ts.Identifier => node !== undefined && ts.isIdentifier(node) && node.text === name;
const isNot = (node: ts.Node, name: string): boolean => ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken && isName(node.operand, name);
const isAssignment = (node: ts.BinaryExpression): boolean => node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
const isConst = (list: ts.VariableDeclarationList): boolean => (list.flags & ts.NodeFlags.Const) !== 0;

/** The `if` statements, inside `stop`, in whose THEN branch `node` sits (the innermost first). */
function enclosingThens(node: ts.Node, stop: ts.Node): ts.IfStatement[] {
  const ifs: ts.IfStatement[] = [];
  for (let child: ts.Node = node, parent: ts.Node | undefined = node.parent; parent !== undefined && parent !== stop; child = parent, parent = parent.parent) {
    if (ts.isIfStatement(parent) && parent.thenStatement === child) ifs.push(parent);
  }
  return ifs;
}

/** The only calls the stderr handler may make besides `<chunk>.toString()`: the channel, the scanner, the preview, the promise it returns, the error text and the settle of the spawn. */
const HANDLER_MAY_CALL = new Set(["this.channel.append", "urlScanner.push", "this.showPreview", "<expr>.then", "this.channel.appendLine", "String", "settle"]);

/** What is wrong with the spawn code of `src/features/preview.ts`, as sentences, by what they concern; nothing under any group means the wiring is as pinned. */
function wiringProblems(source: string): Wiring {
  const file = ts.createSourceFile("preview.ts", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const problems: Wiring = { imports: [], scanner: [], handler: [], showing: [], accumulation: [], stdout: [] };
  const need = (group: Group, ok: boolean, message: string): void => {
    if (!ok) problems[group].push(message);
  };
  const calls = collect(file, ts.isCallExpression);
  const identifiers = collect(file, ts.isIdentifier);
  const uses = (name: string): number => identifiers.filter((id) => id.text === name).length;
  const dataHandlers = (channel: string): ts.CallExpression[] =>
    calls.filter((c) => dotted(c.expression) === `child.${channel}.on` && c.arguments.length === 2 && ts.isStringLiteral(c.arguments[0]) && c.arguments[0].text === "data");

  // The imports: the scanner, and nothing of the whole-buffer parser anywhere in code.
  const fromScanner = collect(file, ts.isImportDeclaration).filter((d) => ts.isStringLiteral(d.moduleSpecifier) && d.moduleSpecifier.text === "../core/preview-url");
  const imported = fromScanner.flatMap((d) => (d.importClause?.namedBindings && ts.isNamedImports(d.importClause.namedBindings) ? d.importClause.namedBindings.elements.map((e) => e.name.text) : ["<not a named import>"]));
  need("imports", fromScanner.length === 1 && imported.join() === "createBrowseUrlScanner", `the import from ../core/preview-url must be exactly { createBrowseUrlScanner }, found [${imported.join()}] in ${fromScanner.length} import(s)`);
  need("imports", uses("parseBrowseUrl") === 0, `the whole-buffer parser parseBrowseUrl is named ${uses("parseBrowseUrl")} time(s) in code`);

  // One scanner per spawn: made once, as `const urlScanner`, inside the executor of a `new Promise`, and named nowhere else.
  const makers = calls.filter((c) => isName(c.expression, "createBrowseUrlScanner"));
  need("scanner", makers.length === 1, `createBrowseUrlScanner must be called exactly once, found ${makers.length} call(s)`);
  need("scanner", uses("createBrowseUrlScanner") === 2, `createBrowseUrlScanner must be named exactly twice (its import and its one call), found ${uses("createBrowseUrlScanner")}`);
  const maker = makers[0];
  const declaration = maker?.parent;
  need("scanner", maker !== undefined && declaration !== undefined && ts.isVariableDeclaration(declaration) && isName(declaration.name, "urlScanner") && isConst(declaration.parent as ts.VariableDeclarationList) && maker.arguments.length === 0, "the one scanner must be `const urlScanner = createBrowseUrlScanner();`");
  let executor: ts.Node | undefined;
  for (let up: ts.Node | undefined = maker?.parent; up !== undefined; up = up.parent) {
    if (ts.isArrowFunction(up) && ts.isNewExpression(up.parent) && dotted(up.parent.expression) === "Promise") {
      executor = up;
      break;
    }
  }
  need("scanner", executor !== undefined, "the scanner must be made inside the executor of a `new Promise`");
  need("scanner", uses("urlScanner") === 2, `urlScanner must be named exactly twice (its declaration and its one push), found ${uses("urlScanner")}`);

  // The stderr handler: an arrow function of one parameter with a block body, and exactly one of them in the file.
  const stderrHandlers = dataHandlers("stderr");
  need("handler", stderrHandlers.length === 1, `exactly one child.stderr data handler is expected, found ${stderrHandlers.length}`);
  const handler = stderrHandlers[0]?.arguments[1];
  const body = handler !== undefined && ts.isArrowFunction(handler) ? handler.body : undefined;
  const parameter = handler !== undefined && ts.isArrowFunction(handler) && handler.parameters.length === 1 ? handler.parameters[0].name : undefined;
  if (handler === undefined || body === undefined || !ts.isBlock(body) || parameter === undefined || !ts.isIdentifier(parameter)) {
    need("handler", false, "the stderr handler must be an arrow function of one parameter with a block body");
    return problems;
  }
  const chunk = parameter.text;

  // `const <text> = <chunk>.toString();`: the chunk as VS Code hands it, nothing trimmed or cut.
  let text = "";
  for (const statement of body.statements) {
    if (!ts.isVariableStatement(statement) || !isConst(statement.declarationList) || statement.declarationList.declarations.length !== 1) continue;
    const only = statement.declarationList.declarations[0];
    if (ts.isIdentifier(only.name) && only.initializer !== undefined && ts.isCallExpression(only.initializer) && dotted(only.initializer.expression) === `${chunk}.toString` && only.initializer.arguments.length === 0) {
      text = only.name.text;
    }
  }
  need("handler", text !== "", `the handler must start from \`const <text> = ${chunk}.toString();\``);
  // The chunk text goes to the channel, as a statement of the handler (not inside the `if`), once.
  const appends = body.statements.filter((s): s is ts.ExpressionStatement => ts.isExpressionStatement(s) && ts.isCallExpression(s.expression) && dotted(s.expression.expression) === "this.channel.append");
  need("handler", appends.length === 1 && ts.isCallExpression(appends[0].expression) && appends[0].expression.arguments.length === 1 && isName(appends[0].expression.arguments[0], text), "the handler must append the chunk text to the channel, once, outside the if");

  // The scanner is fed that text, once in the whole file, only inside `if (!urlShown)` of the stderr handler.
  const pushes = calls.filter((c) => dotted(c.expression) === "urlScanner.push");
  need("handler", pushes.length === 1, `urlScanner.push must be called exactly once in the file, found ${pushes.length} call(s)`);
  const push = pushes[0];
  let url = "";
  if (push !== undefined) {
    need("handler", push.arguments.length === 1 && isName(push.arguments[0], text), `urlScanner.push must be given the chunk text \`${text}\` and nothing else`);
    need("handler", enclosingThens(push, handler).some((s) => isNot(s.expression, "urlShown")), "urlScanner.push must sit in the then-branch of `if (!urlShown)` inside the stderr handler");
    if (ts.isVariableDeclaration(push.parent) && ts.isIdentifier(push.parent.name)) url = push.parent.name.text;
    need("handler", url !== "", "the answer of urlScanner.push must be kept in a const");
  }

  // The preview is shown with that answer, in the `if` on it, which also sets `urlShown`.
  const shows = calls.filter((c) => dotted(c.expression) === "this.showPreview");
  need("showing", shows.length === 1, `this.showPreview must be called exactly once, found ${shows.length} call(s)`);
  const show = shows[0];
  if (show !== undefined) {
    need("showing", show.arguments.length === 2 && isName(show.arguments[0], "session") && url !== "" && isName(show.arguments[1], url), `this.showPreview must be called with (session, ${url || "<the URL>"})`);
    const onUrl = enclosingThens(show, handler).find((s) => url !== "" && isName(s.expression, url));
    need("showing", onUrl !== undefined, `this.showPreview must sit in the then-branch of \`if (${url || "<the URL>"})\` inside the stderr handler`);
    const sets = (s: ts.Statement): boolean =>
      ts.isExpressionStatement(s) && ts.isBinaryExpression(s.expression) && s.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken && isName(s.expression.left, "urlShown") && s.expression.right.kind === ts.SyntaxKind.TrueKeyword;
    need("showing", onUrl !== undefined && ts.isBlock(onUrl.thenStatement) && onUrl.thenStatement.statements.some(sets), "the then-branch that shows the preview must set `urlShown = true`");
  }

  // No accumulation: the only assignment in the handler is the flag, the executor keeps no state but the two flags, and the handler calls nothing that could keep text.
  const assigned = collect(handler, ts.isBinaryExpression).filter(isAssignment).map((b) => b.getText(file));
  need("accumulation", assigned.length === 1 && assigned[0] === "urlShown = true", `the only assignment in the stderr handler may be \`urlShown = true\`, found [${assigned.join("; ")}]`);
  if (executor !== undefined) {
    const kept = collect(executor, ts.isVariableDeclarationList)
      .filter((list) => !isConst(list))
      .flatMap((list) => list.declarations.map((d) => d.name.getText(file)))
      .sort();
    need("accumulation", kept.join() === "settled,urlShown", `the executor may keep only the flags settled and urlShown in let or var, found [${kept.join()}]`);
  }
  const stray = collect(handler, ts.isCallExpression)
    .map((c) => dotted(c.expression))
    .filter((name) => name !== `${chunk}.toString` && !HANDLER_MAY_CALL.has(name));
  need("accumulation", stray.length === 0, `the stderr handler calls [${stray.join(", ")}], which it may not`);

  // The stdout handler has nothing to do with the scanner.
  const stdoutHandlers = dataHandlers("stdout");
  need("stdout", stdoutHandlers.length === 1, `exactly one child.stdout data handler is expected, found ${stdoutHandlers.length}`);
  for (const stdout of stdoutHandlers) {
    need("stdout", collect(stdout, ts.isIdentifier).every((id) => id.text !== "urlScanner"), "the stdout handler must not touch urlScanner");
  }
  return problems;
}

/** The groups under which the gate found something. */
const flagged = (wiring: Wiring): Group[] => (Object.keys(wiring) as Group[]).filter((group) => wiring[group].length > 0);

describe("Session 341 — preview.ts wiring, read from its syntax tree", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const source = readFileSync(resolve(root, "src", "features", "preview.ts"), "utf8");
  const wiring = wiringProblems(source);

  it("imports: the scanner and nothing of the whole-buffer parser (no identifier named parseBrowseUrl)", () => {
    expect(wiring.imports).toEqual([]);
  });

  it("scanner: exactly one, `const urlScanner`, made inside the Promise executor of one spawn, and named nowhere else", () => {
    expect(wiring.scanner).toEqual([]);
  });

  it("handler: appends the chunk text to the channel, then feeds the scanner that same text, once in the file, only inside `if (!urlShown)`", () => {
    expect(wiring.handler).toEqual([]);
  });

  it("showing: the preview is shown with the URL the scanner answered, in the branch that sets urlShown", () => {
    expect(wiring.showing).toEqual([]);
  });

  it("accumulation: none, the handler's only assignment is the flag, the executor keeps no other state, the handler calls nothing that keeps text", () => {
    expect(wiring.accumulation).toEqual([]);
  });

  it("stdout: the handler touches nothing of the scanner", () => {
    expect(wiring.stdout).toEqual([]);
  });
});

// The gate itself, run over the real source with ONE edit applied: what it must refuse (`by` names the group that has to flag it) and what it must let through. V1 to V3, R58 and R59 are the review round's variants of the comment-stripping version of this gate (V1, V2 and R58
// passed it; V3 failed it), V6 and V7 accumulate into a property, and W01 to W08 are the edits of `tools/mutation-run/mutants/s341-preview-scan.json`.
interface Edit {
  name: string;
  from: string;
  to: string;
  verdict: "refused" | "accepted";
  by?: Group;
}

const STDERR_OPEN = '      child.stderr?.on("data", (buf: Buffer) => {\n        const text = buf.toString();';
const EDITS: Edit[] = [
  { name: "V1 a dead stub scanner, the real call in a trailing comment, the factory kept alive by `void`", from: "const urlScanner = createBrowseUrlScanner();", to: "const urlScanner = { push: (_text: string): string | null => null }; // const urlScanner = createBrowseUrlScanner();\n      void createBrowseUrlScanner;", verdict: "refused", by: "scanner" },
  { name: "V2 an accumulator under another name", from: STDERR_OPEN, to: '      let acc = "";\n      child.stderr?.on("data", (buf: Buffer) => {\n        acc += buf.toString();\n        if (acc.length < 0) {\n          return;\n        }\n        const text = buf.toString();', verdict: "refused", by: "accumulation" },
  { name: "V3 a harmless trailing comment that names parseBrowseUrl", from: "let urlShown = false;", to: "let urlShown = false; // formerly fed to parseBrowseUrl", verdict: "accepted" },
  { name: "V4 a block comment that holds the old call, the new factory and a push", from: "let urlShown = false;", to: "let urlShown = false; /* parseBrowseUrl(stderr); createBrowseUrlScanner(); urlScanner.push(x) */", verdict: "accepted" },
  { name: "V5 a string that holds the old call", from: "let urlShown = false;", to: 'let urlShown = false;\n      const note = "parseBrowseUrl(stderr)";', verdict: "accepted" },
  { name: "V6 the stderr is accumulated into a property with +=", from: STDERR_OPEN, to: '      child.stderr?.on("data", (buf: Buffer) => {\n        session.panel.title += buf.toString();\n        const text = buf.toString();', verdict: "refused", by: "accumulation" },
  { name: "V7 the stderr is accumulated into a property with x = x + text", from: "this.channel.append(text);", to: "this.channel.append(text);\n        session.fsPath = session.fsPath + text;", verdict: "refused", by: "accumulation" },
  { name: "R58 stdout chunks are fed to the scanner too", from: '      child.stdout?.on("data", (buf: Buffer) => {\n        this.channel.append(buf.toString());', to: '      child.stdout?.on("data", (buf: Buffer) => {\n        this.channel.append(buf.toString());\n        urlScanner.push(buf.toString());', verdict: "refused", by: "stdout" },
  { name: "R59 showPreview gets the chunk and not the URL", from: "void this.showPreview(session, url).then(settle,", to: "void this.showPreview(session, text).then(settle,", verdict: "refused", by: "showing" },
  { name: "W01 the scanner is fed an empty string", from: "const url = urlScanner.push(text);", to: 'const url = urlScanner.push("");', verdict: "refused", by: "handler" },
  { name: "W02 the scanner is fed only AFTER a URL has been shown", from: "if (!urlShown) {", to: "if (urlShown) {", verdict: "refused", by: "handler" },
  { name: "W03 the chunk is not appended to the channel", from: "this.channel.append(text);", to: "void 0;", verdict: "refused", by: "handler" },
  { name: "W04 the chunk is trimmed before it is used", from: "const text = buf.toString();", to: "const text = buf.toString().trim();", verdict: "refused", by: "handler" },
  { name: "W05 the flag is never set", from: "urlShown = true;", to: "urlShown = false;", verdict: "refused", by: "showing" },
  { name: "W06 a second scanner is made", from: "const urlScanner = createBrowseUrlScanner();", to: "const urlScanner = createBrowseUrlScanner();\n      const spare = createBrowseUrlScanner();", verdict: "refused", by: "scanner" },
  { name: "W07 the whole-buffer parser is imported again", from: 'import { createBrowseUrlScanner } from "../core/preview-url";', to: 'import { createBrowseUrlScanner, parseBrowseUrl } from "../core/preview-url";', verdict: "refused", by: "imports" },
  { name: "W08 an accumulated stderr is kept again", from: "const urlScanner = createBrowseUrlScanner();", to: 'const urlScanner = createBrowseUrlScanner();\n      let stderr = "";', verdict: "refused", by: "accumulation" },
];

describe("Session 341 — the wiring gate, one edit at a time", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const source = readFileSync(resolve(root, "src", "features", "preview.ts"), "utf8");

  it("lets the real source through", () => {
    expect(flagged(wiringProblems(source))).toEqual([]);
  });

  it.each(EDITS.map((e) => [`${e.name}: ${e.verdict}`, e] as const))("%s", (_name, e) => {
    // The edit applies to one place only, or this row would test something else.
    expect(source.split(e.from).length - 1).toBe(1);
    const found = flagged(wiringProblems(source.split(e.from).join(e.to)));
    if (e.verdict === "refused") {
      expect(found).toContain(e.by);
    } else {
      expect(found).toEqual([]);
    }
  });
});
