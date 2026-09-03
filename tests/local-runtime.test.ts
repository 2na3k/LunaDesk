import { describe, expect, it } from "vitest";
import { LocalAgentRuntime } from "@/lib/agents/local-runtime";
import { DEFAULT_MODEL } from "@/lib/config";
import type { RespondInput } from "@/lib/types";

async function collect(gen: AsyncGenerator<{ type: string; delta?: string }>): Promise<{
  text: string;
  done: boolean;
}> {
  let text = "";
  let done = false;
  for await (const chunk of gen) {
    if (chunk.type === "delta") text += chunk.delta ?? "";
    if (chunk.type === "done") done = true;
  }
  return { text, done };
}

const base: RespondInput = {
  persona: "You run outbound sales.",
  botName: "Sales Outbound",
  history: [{ role: "user", name: "You", content: "draft cold emails for acme" }],
  model: DEFAULT_MODEL,
};

describe("LocalAgentRuntime", () => {
  it("is always ready (offline fallback)", async () => {
    expect(await new LocalAgentRuntime().isReady()).toBe(true);
  });

  it("streams a non-empty reply and terminates with done", async () => {
    const { text, done } = await collect(new LocalAgentRuntime().respond(base));
    expect(text.length).toBeGreaterThan(0);
    expect(done).toBe(true);
  });

  it("references a peer in group conversations", async () => {
    const groupInput: RespondInput = {
      ...base,
      botName: "Inbox Manager",
      peers: ["Chief", "Account Manager"],
      history: [
        { role: "user", name: "You", content: "what's left on the offsite?" },
        { role: "assistant", name: "Chief", content: "recap is shared, follow-ups assigned." },
      ],
    };
    const { text } = await collect(new LocalAgentRuntime().respond(groupInput));
    expect(text.toLowerCase()).toContain("chief");
  });

  it("introduces itself when there is no prior user message", async () => {
    const { text } = await collect(
      new LocalAgentRuntime().respond({ ...base, history: [] }),
    );
    expect(text.toLowerCase()).toContain("sales outbound".toLowerCase());
  });
});
