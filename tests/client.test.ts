import { describe, expect, it } from "vitest";
import { toTurns } from "@/lib/client";
import type { ChatMessage } from "@/lib/types";

describe("toTurns", () => {
  it("maps senders to attributed agent turns and drops pending ones", () => {
    const messages: ChatMessage[] = [
      { id: "1", sender: { kind: "user" }, body: "hi" },
      { id: "2", sender: { kind: "bot", name: "Chief" }, body: "hello" },
      { id: "3", sender: { kind: "system" }, body: "6:19 AM" },
      { id: "4", sender: { kind: "bot", name: "Chief" }, body: "typing", pending: true },
    ];
    const turns = toTurns(messages);
    expect(turns).toEqual([
      { role: "user", name: "You", content: "hi" },
      { role: "assistant", name: "Chief", content: "hello" },
      { role: "system", content: "6:19 AM" },
    ]);
  });
});
