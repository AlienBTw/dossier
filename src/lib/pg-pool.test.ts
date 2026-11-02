import { Client } from "pg";
import { afterEach, describe, expect, it } from "vitest";

import { SerialPgClient } from "./pg-pool";

const original = Client.prototype.query;

afterEach(() => {
  Client.prototype.query = original;
});

describe("SerialPgClient", () => {
  it("sends the next query only after the previous one finishes", async () => {
    const calls: string[] = [];
    const release: Array<() => void> = [];
    Client.prototype.query = function (config: unknown) {
      const text = String(config);
      calls.push(`start ${text}`);
      return new Promise((resolve) => {
        release.push(() => {
          calls.push(`end ${text}`);
          resolve({ rows: [] });
        });
      });
    } as typeof Client.prototype.query;

    const client = new SerialPgClient();
    const first = client.query("one");
    const second = client.query("two");
    await flush();
    expect(calls).toEqual(["start one"]);

    release[0]?.();
    await first;
    await flush();
    expect(calls).toEqual(["start one", "end one", "start two"]);

    release[1]?.();
    await second;
    expect(calls).toEqual(["start one", "end one", "start two", "end two"]);
  });

  it("runs a callback query, the form the pool uses, after the one before it", async () => {
    const calls: string[] = [];
    const release: Array<() => void> = [];
    Client.prototype.query = function (text: unknown, values: unknown, callback?: unknown) {
      const done = typeof values === "function" ? values : callback;
      calls.push(`start ${String(text)}`);
      release.push(() => {
        calls.push(`end ${String(text)}`);
        if (typeof done === "function") done(undefined, { rows: [] });
      });
    } as typeof Client.prototype.query;

    const client = new SerialPgClient();
    let firstDone = false;
    let secondDone = false;
    client.query("one", [], () => {
      firstDone = true;
    });
    client.query("two", [], () => {
      secondDone = true;
    });
    await flush();
    expect(calls).toEqual(["start one"]);

    release[0]?.();
    await flush();
    expect(firstDone).toBe(true);
    expect(secondDone).toBe(false);
    expect(calls).toEqual(["start one", "end one", "start two"]);

    release[1]?.();
    await flush();
    expect(secondDone).toBe(true);
  });

  it("still sends the query after the previous one failed", async () => {
    const calls: string[] = [];
    Client.prototype.query = function (config: unknown) {
      const text = String(config);
      calls.push(text);
      return text === "bad" ? Promise.reject(new Error("bad")) : Promise.resolve({ rows: [] });
    } as typeof Client.prototype.query;

    const client = new SerialPgClient();
    await expect(client.query("bad")).rejects.toThrow("bad");
    await client.query("good");
    expect(calls).toEqual(["bad", "good"]);
  });
});

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
