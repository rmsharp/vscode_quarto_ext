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

// ---- WHEN THE SEND FAILS -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

/** Let every promise reaction and one timer turn run. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
/** A thenable that is not a Promise: the host's `Thenable` is only that. It calls the rejection (or the fulfilment) callback it is given, at once or in a microtask. */
function thenable(outcome: { reject: Error } | { resolve: unknown }, synchronous = false): { then(onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown): void } {
  return {
    then(onFulfilled, onRejected) {
      const run = (): void => {
        if ("reject" in outcome) onRejected?.(outcome.reject);
        else onFulfilled?.(outcome.resolve);
      };
      if (synchronous) run();
      else queueMicrotask(run);
    },
  };
}

describe("Session 343 -- the context-key setter forgets a key whose send failed, so the next set sends again", () => {
  it("a send whose promise rejects is forgotten: the next set of the same value sends again, and the one after that does not", async () => {
    let n = 0;
    const calls: boolean[] = [];
    const set = createContextKeySetter((_key, value) => {
      calls.push(value);
      return n++ === 0 ? Promise.reject(new Error("setContext failed")) : Promise.resolve();
    });
    set("k", true);
    await settle();
    set("k", true); // the first send failed: the host may not have the value
    expect(calls).toEqual([true, true]);
    await settle();
    set("k", true); // the second succeeded
    expect(calls).toEqual([true, true]);
  });

  it("the same holds for a thenable that is not a Promise (the host's Thenable), rejecting later or at once", async () => {
    for (const synchronous of [false, true]) {
      const calls: boolean[] = [];
      let n = 0;
      const set = createContextKeySetter((_key, value) => {
        calls.push(value);
        return n++ === 0 ? thenable({ reject: new Error("no") }, synchronous) : thenable({ resolve: undefined }, synchronous);
      });
      set("k", false);
      await settle();
      set("k", false);
      set("k", false);
      expect(calls, `synchronous ${String(synchronous)}`).toEqual([false, false]);
    }
  });

  it("a send whose promise resolves is remembered, with whatever it resolves to", async () => {
    for (const result of [undefined, null, 0, "", false, {}, [], new Error("a resolved value that looks like a failure")]) {
      const calls: boolean[] = [];
      const set = createContextKeySetter((_key, value) => {
        calls.push(value);
        return Promise.resolve(result);
      });
      set("k", true);
      await settle();
      set("k", true);
      expect(calls).toHaveLength(1);
    }
  });

  it("a result that is not a thenable is remembered: nothing, a number, a string, null, an object whose `then` is not a function", async () => {
    for (const result of [undefined, null, 0, 1, "", "then", false, true, {}, { then: 5 }, { then: null }, [], () => 0]) {
      const calls: boolean[] = [];
      const set = createContextKeySetter((_key, value) => {
        calls.push(value);
        return result;
      });
      set("k", true);
      await settle();
      set("k", true);
      set("k", true);
      expect(calls, String(result)).toHaveLength(1);
    }
  });

  it("a thenable that is a FUNCTION (a callable with a `then`) is a thenable too: its rejection forgets the key", async () => {
    const calls: boolean[] = [];
    const set = createContextKeySetter((_key, value) => {
      calls.push(value);
      return Object.assign(() => undefined, { then: (_onFulfilled: unknown, onRejected: (reason: unknown) => void) => queueMicrotask(() => onRejected(new Error("callable"))) });
    });
    set("k", true);
    await settle();
    set("k", true);
    expect(calls).toEqual([true, true]);
  });

  it("a send that throws propagates the error, and leaves the key unremembered: the next set of the same value sends again", () => {
    const failure = new Error("setContext threw");
    let throwing = true;
    const calls: boolean[] = [];
    const set = createContextKeySetter((_key, value) => {
      calls.push(value);
      if (throwing) throw failure;
    });
    expect(() => set("k", true)).toThrow(failure);
    throwing = false;
    set("k", true);
    expect(calls).toEqual([true, true]);
    set("k", true);
    expect(calls).toHaveLength(2);
  });

  it("a send that throws also forgets a value the key held before: set true, a throwing set false, then set true sends again", () => {
    const calls: boolean[] = [];
    const set = createContextKeySetter((_key, value) => {
      calls.push(value);
      if (calls.length === 2) throw new Error("the second send throws");
    });
    set("k", true);
    expect(() => set("k", false)).toThrow("the second send throws");
    set("k", true);
    expect(calls).toEqual([true, false, true]);
  });

  it("a send that throws for one key does not forget another key", () => {
    const calls: Array<[string, boolean]> = [];
    const set = createContextKeySetter((key, value) => {
      calls.push([key, value]);
      if (key === "a" && calls.length === 3) throw new Error("a threw");
    });
    set("a", true);
    set("b", true);
    expect(() => set("a", false)).toThrow("a threw");
    set("b", true);
    set("a", true);
    expect(calls).toEqual([["a", true], ["b", true], ["a", false], ["a", true]]);
  });

  it("a rejection of one key does not forget another key", async () => {
    const calls: Array<[string, boolean]> = [];
    const set = createContextKeySetter((key, value) => {
      calls.push([key, value]);
      return key === "a" ? Promise.reject(new Error("a failed")) : Promise.resolve();
    });
    set("a", true);
    set("b", true);
    await settle();
    set("a", true);
    set("b", true);
    expect(calls).toEqual([["a", true], ["b", true], ["a", true]]);
  });

  it("a value set again while its send is still in flight is not sent again, and if that send then rejects the next set sends", async () => {
    let fail: (reason: Error) => void = () => undefined;
    const calls: boolean[] = [];
    const set = createContextKeySetter((_key, value) => {
      calls.push(value);
      return calls.length === 1 ? new Promise<void>((_resolve, reject) => (fail = reject)) : Promise.resolve();
    });
    set("k", true);
    set("k", true);
    set("k", true);
    expect(calls).toEqual([true]);
    fail(new Error("late"));
    await settle();
    set("k", true);
    expect(calls).toEqual([true, true]);
  });

  it("a LATE rejection of an older send does not forget a newer one, not even when the newer send holds the same value (set true, set false, set true, then the first rejects)", async () => {
    const rejectors: Array<(reason: Error) => void> = [];
    const calls: boolean[] = [];
    const set = createContextKeySetter((_key, value) => {
      calls.push(value);
      return calls.length === 1 ? new Promise<void>((_resolve, reject) => rejectors.push(reject)) : Promise.resolve();
    });
    set("k", true); // in flight
    set("k", false);
    set("k", true);
    expect(calls).toEqual([true, false, true]);
    rejectors[0](new Error("the first, long after"));
    await settle();
    set("k", true); // the host got the third send's value: nothing to resend
    expect(calls).toEqual([true, false, true]);
  });

  it("the setter handles a rejection itself: no unhandled rejection reaches the process, for a rejecting promise or a rejecting thenable", async () => {
    const unhandled: unknown[] = [];
    const listener = (reason: unknown): void => void unhandled.push(reason);
    process.on("unhandledRejection", listener);
    try {
      const set = createContextKeySetter((key) => (key === "p" ? Promise.reject(new Error("a promise")) : thenable({ reject: new Error("a thenable") })));
      set("p", true);
      set("t", true);
      await settle();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", listener);
    }
  });

  // The ORACLE again, with failures: every call has a fate (the send succeeds at once, succeeds later, rejects later, or throws), fixed by the call's place in the sequence, so the old spelling and the setter meet the same
  // fate on the calls they both send. The host takes a value when a send SUCCEEDS. After every call has settled the host's values must be the old spelling's: a failed send is retried by the next set.
  it("leaves the host's key values as the old spelling did after every call, with sends that succeed, reject or throw (10,000 seeded sequences)", async () => {
    const random = seededRandom(3430);
    const KEYS = ["quarto.inCodeCell", "quartoRenderScriptActive"];
    type Fate = "ok" | "ok later" | "reject later" | "throw";
    const FATES: Fate[] = ["ok", "ok", "ok later", "reject later", "throw"];
    const problems: string[] = [];
    let failures = 0;
    for (let n = 0; n < 10_000 && problems.length < 5; n++) {
      const host = { old: new Map<string, boolean>(), now: new Map<string, boolean>() };
      let fate: Fate = "ok";
      const sendInto = (state: Map<string, boolean>) => (key: string, value: boolean): unknown => {
        if (fate === "throw") throw new Error("setContext threw");
        if (fate === "ok") {
          state.set(key, value);
          return undefined;
        }
        const thisFate = fate;
        return new Promise<void>((resolve, reject) =>
          setImmediate(() => {
            if (thisFate === "reject later") reject(new Error("rejected"));
            else {
              state.set(key, value);
              resolve();
            }
          }),
        );
      };
      const oldSend = sendInto(host.old);
      const oldSet = (key: string, value: boolean): void => {
        try {
          (oldSend(key, value) as Promise<void> | undefined)?.catch(() => undefined);
        } catch {
          // the host's own error
        }
      };
      const newSet = createContextKeySetter(sendInto(host.now));
      const length = 4 + Math.floor(random() * 12);
      const picked: string[] = [];
      for (let i = 0; i < length; i++) {
        const key = KEYS[Math.floor(random() * KEYS.length)];
        const value = random() < 0.6 && host.old.has(key) ? (host.old.get(key) as boolean) : random() < 0.5;
        fate = FATES[Math.floor(random() * FATES.length)];
        if (fate !== "ok") failures++;
        picked.push(`${key}=${String(value)}:${fate}`);
        oldSet(key, value);
        try {
          newSet(key, value);
        } catch {
          // the host's own error
        }
        await new Promise<void>((resolve) => setImmediate(resolve));
        for (const k of KEYS) {
          if (host.old.get(k) !== host.now.get(k)) problems.push(`after [${picked.join(", ")}] the host's ${k} is ${String(host.now.get(k))}, the old spelling's ${String(host.old.get(k))}`);
        }
      }
    }
    expect(problems).toEqual([]);
    expect(failures).toBeGreaterThan(40_000);
  }, 120_000);
});
