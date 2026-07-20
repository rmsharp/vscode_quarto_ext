import { describe, expect, it } from "vitest";
import { injectCalloutStyles } from "../../src/webview/notebook-renderer";
import { calloutStyles } from "../../src/core/notebook-callout";

/**
 * `src/webview/notebook-renderer.ts` runs in the notebook renderer webview (DOM
 * only). `injectCalloutStyles(doc)` is the pure, document-injectable helper its
 * `activate` calls to add the callout box `<style>` once. The webview DOM cannot
 * be read back from the extension host, so the actual on-screen box is
 * eyeball-only; this suite verifies the injection logic (idempotent, correct
 * content, head/fallback) against a minimal fake document.
 */
interface FakeStyle {
  id: string;
  textContent: string | null;
}

function fakeDoc(opts: { headNull?: boolean } = {}) {
  const appended: FakeStyle[] = [];
  const byId = new Map<string, FakeStyle>();
  const sink = {
    appendChild(node: FakeStyle) {
      appended.push(node);
      byId.set(node.id, node);
    },
  };
  const doc = {
    getElementById: (id: string): FakeStyle | null => byId.get(id) ?? null,
    createElement: (_tag: string): FakeStyle => ({ id: "", textContent: null }),
    head: opts.headNull ? null : sink,
    documentElement: sink,
  };
  return { doc, appended };
}

describe("injectCalloutStyles", () => {
  it("appends a <style> carrying calloutStyles() to the document head", () => {
    const { doc, appended } = fakeDoc();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    injectCalloutStyles(doc as any);
    expect(appended).toHaveLength(1);
    expect(appended[0].textContent).toBe(calloutStyles());
  });

  it("gives the injected <style> a stable id so injection is idempotent", () => {
    const { doc, appended } = fakeDoc();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    injectCalloutStyles(doc as any);
    expect(appended[0].id).toBe("quarto-mit-callout-styles");
  });

  it("does not inject a second <style> when one is already present", () => {
    const { doc, appended } = fakeDoc();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    injectCalloutStyles(doc as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    injectCalloutStyles(doc as any);
    expect(appended).toHaveLength(1);
  });

  it("falls back to documentElement when there is no <head>", () => {
    const { doc, appended } = fakeDoc({ headNull: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    injectCalloutStyles(doc as any);
    expect(appended).toHaveLength(1);
    expect(appended[0].textContent).toBe(calloutStyles());
  });
});
