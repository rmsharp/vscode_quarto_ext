import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";
import { isOurVdocFileName } from "../../../src/core/embedded/vdoc-path";

/**
 * Shared by every embedded-forwarding suite (completion/hover/definition/signature-help,
 * in-cell outline symbols, Format Cell). It exists because of BACKLOG item 18, and it is
 * worth understanding before changing either of the two things in it.
 *
 * ## Why the stand-ins are keyed like this
 *
 * They used to be registered as `{ scheme: "quarto-embedded" }` (and the two sibling
 * custom schemes) — pinned to **the exact axis real language servers discriminate by**.
 * Real servers register their providers against a `documentSelector` scoped to the
 * schemes they can read, so no real server ever registered for those vdocs, and every
 * forward returned nothing in production. The suite stayed 100% green throughout,
 * because a stand-in registered on our scheme trivially fires for our scheme.
 *
 * > A test double registered on the same axis the real dependency discriminates by
 * > cannot detect that the real dependency rejects that axis.
 *
 * A bare `{ scheme: "file" }` would be no good either — it would fire for every file in
 * the test host and collide with real providers — so the glob narrows it to our own
 * virtual documents.
 *
 * ## Why the stand-ins are still not enough
 *
 * They cannot be. No arrangement of doubles can prove a *real* server accepts our
 * documents; only a real server can. That is what `npm run test:lsp` is for.
 */
export const VDOC_SELECTOR: vscode.DocumentSelector = {
  scheme: "file",
  pattern: "**/vdoc-mit.*",
};

/**
 * Assert a forward routed through one of OUR virtual documents, and that the vdoc is a
 * real `file:` document — the property whose absence was the defect.
 *
 * The assertion this replaced checked only that the URI carried our custom scheme: true,
 * and worthless. This one fails loudly if anyone reintroduces a custom scheme.
 */
export function assertRoutedThroughVdoc(uriString: string, what: string): void {
  const uri = vscode.Uri.parse(uriString);
  assert.strictEqual(
    uri.scheme,
    "file",
    `${what} — a custom scheme is invisible to real language servers (BACKLOG item 18)`,
  );
  assert.ok(
    isOurVdocFileName(path.basename(uri.fsPath)),
    `${what} — expected one of our vdocs, got ${uri.fsPath}`,
  );
}
