import { describe, expect, it } from "vitest";
import { createContextKeySetter } from "../../src/core/context-key-setter";
import { seededRandom } from "./support/regex-equivalence";

// Session 343, D2 -- the context-key setter (BACKLOG: "What Session 342's review round found beside the typing-path cures"). `updateCellContext` (`quarto.inCodeCell`) and `updateRenderScriptContext`
// (`quartoRenderScriptActive`) sent `setContext` to the host on EVERY event of the active editor, whatever the value: a round trip per keystroke that no headless test can TIME and that this file COUNTS.
//
// The rows count the calls of the injected `send`, which stands for `vscode.commands.executeCommand("setContext", key, value)`; nothing here reads the host, because the host has no read-back for a context key.
// `s343-adapter-wiring-pin.test.ts` pins from the syntax tree that the two adapters set their keys through the setter and that the send hands it the command's result.

/** A `send` that records every call as `[key, value]`. */
function recorder(): { send: (key: string, value: boolean) => unknown; calls: Array<[string, boolean]> } {
  const calls: Array<[string, boolean]> = [];
  return {
    calls,
    send: (key, value) => {
      calls.push([key, value]);
    },
  };
}

describe("Session 343 -- the context-key setter sends a key's value only when it is not the one last sent", () => {
  it("N equal sets of one key send once", () => {
    const { send, calls } = recorder();
    const set = createContextKeySetter(send);
    for (let i = 0; i < 50; i++) set("quarto.inCodeCell", true);
    expect(calls).toEqual([["quarto.inCodeCell", true]]);
  });

  it("the first set of a key sends even for false (the host has no value for the key yet, and false is not 'unset')", () => {
    const { send, calls } = recorder();
    const set = createContextKeySetter(send);
    set("k", false);
    expect(calls).toEqual([["k", false]]);
    set("k", false);
    expect(calls).toHaveLength(1);
  });

  it("a flip sends, and a flip back sends: the value is compared with the last one SENT, not with the first", () => {
    const { send, calls } = recorder();
    const set = createContextKeySetter(send);
    set("k", true);
    set("k", false);
    set("k", true);
    set("k", true);
    set("k", false);
    set("k", false);
    expect(calls).toEqual([["k", true], ["k", false], ["k", true], ["k", false]]);
  });

  it("keys are independent: each keeps its own last value", () => {
    const { send, calls } = recorder();
    const set = createContextKeySetter(send);
    set("a", true);
    set("b", true); // another key, the same value: still the first send for b
    set("a", true);
    set("b", true);
    set("a", false);
    set("b", true);
    expect(calls).toEqual([["a", true], ["b", true], ["a", false]]);
  });

  it("keys that are names of Object.prototype members are keys like any other, and a key and its prefix are two keys", () => {
    const { send, calls } = recorder();
    const set = createContextKeySetter(send);
    const keys = ["__proto__", "constructor", "hasOwnProperty", "toString", "valueOf", "", "quarto", "quarto.", "quarto.inCodeCell"];
    for (const key of keys) set(key, false);
    for (const key of keys) set(key, false);
    expect(calls).toEqual(keys.map((key) => [key, false]));
    for (const key of keys) set(key, true);
    expect(calls).toHaveLength(keys.length * 2);
  });

  it("every call that sends hands the send the key and the value it was given, in that order, and nothing else", () => {
    const seen: unknown[][] = [];
    const set = createContextKeySetter((...args: unknown[]) => {
      seen.push(args);
    });
    set("quartoRenderScriptActive", true);
    set("quartoRenderScriptActive", false);
    expect(seen).toEqual([["quartoRenderScriptActive", true], ["quartoRenderScriptActive", false]]);
  });

  it("two setters keep nothing between them: one per feature, each remembers only what it sent", () => {
    const first = recorder();
    const second = recorder();
    const setFirst = createContextKeySetter(first.send);
    const setSecond = createContextKeySetter(second.send);
    setFirst("k", true);
    setSecond("k", true);
    setFirst("k", true);
    setSecond("k", true);
    expect(first.calls).toHaveLength(1);
    expect(second.calls).toHaveLength(1);
  });

  // The ORACLE: the adapters' old spelling, `void vscode.commands.executeCommand("setContext", key, value)` on every event, run beside the setter on the same sequence. The host's value of each key (what a keybinding's `when`
  // clause reads) must be the same after every call; the setter may only send LESS.
  it("leaves the host's key values exactly as the old spelling did, after every call of 20,000 seeded sequences, and sends fewer", () => {
    const random = seededRandom(343);
    const KEYS = ["quarto.inCodeCell", "quartoRenderScriptActive", "__proto__"];
    let oldSends = 0;
    let newSends = 0;
    const problems: string[] = [];
    for (let n = 0; n < 20_000 && problems.length < 5; n++) {
      const host = { old: new Map<string, boolean>(), now: new Map<string, boolean>() };
      const sendInto = (state: Map<string, boolean>, counter: "old" | "new") => (key: string, value: boolean): void => {
        if (counter === "old") oldSends++;
        else newSends++;
        state.set(key, value);
      };
      const oldSet = (key: string, value: boolean): void => void sendInto(host.old, "old")(key, value);
      const newSet = createContextKeySetter(sendInto(host.now, "new"));
      const length = 5 + Math.floor(random() * 40);
      const picked: string[] = [];
      for (let i = 0; i < length; i++) {
        const key = KEYS[Math.floor(random() * KEYS.length)];
        // Runs of equal values are the typing case (every keystroke inside one cell): weight a repeat of the key's last value.
        const value = random() < 0.7 && host.old.has(key) ? (host.old.get(key) as boolean) : random() < 0.5;
        picked.push(`${key}=${String(value)}`);
        oldSet(key, value);
        newSet(key, value);
        for (const k of KEYS) {
          if (host.old.get(k) !== host.now.get(k)) problems.push(`after [${picked.join(", ")}] the host's ${k} is ${String(host.now.get(k))}, the old spelling's ${String(host.old.get(k))}`);
        }
      }
    }
    expect(problems).toEqual([]);
    expect(oldSends).toBeGreaterThan(300_000);
    expect(newSends).toBeLessThan(oldSends / 2);
  });
});
