import { afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { FileCredentialStore } from "@/lib/agents/credential-store";

let file: string;

afterEach(async () => {
  if (file) await fs.rm(file, { force: true });
});

describe("FileCredentialStore", () => {
  it("persists, reads, lists, and deletes credentials", async () => {
    file = path.join(os.tmpdir(), `luna-cred-${Date.now()}.json`);
    const store = new FileCredentialStore(file);

    expect(await store.read("openai")).toBeUndefined();

    await store.modify("openai", async () => ({ type: "api_key", key: "sk-abc" }));
    const cred = await store.read("openai");
    expect(cred).toEqual({ type: "api_key", key: "sk-abc" });

    const list = await store.list();
    expect(list).toEqual([{ providerId: "openai", type: "api_key" }]);

    await store.delete("openai");
    expect(await store.read("openai")).toBeUndefined();
  });

  it("serializes concurrent modify calls without losing writes", async () => {
    file = path.join(os.tmpdir(), `luna-cred-${Date.now()}-2.json`);
    const store = new FileCredentialStore(file);
    await Promise.all([
      store.modify("a", async () => ({ type: "api_key", key: "1" })),
      store.modify("b", async () => ({ type: "api_key", key: "2" })),
      store.modify("c", async () => ({ type: "api_key", key: "3" })),
    ]);
    const list = await store.list();
    expect(list.map((c) => c.providerId).sort()).toEqual(["a", "b", "c"]);
  });
});
