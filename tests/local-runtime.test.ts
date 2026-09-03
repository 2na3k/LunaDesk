import { describe, expect, it } from "vitest";
import { LocalAgentRuntime } from "@/lib/agents/local-runtime";
import { DEFAULT_MODEL } from "@/lib/config";
import type { RespondInput } from "@/lib/types";

async function collect(gen: AsyncGenerator<{ type: string; delta?: string; toolName?: string; arguments?: Record<string, unknown> }>): Promise<{
  text: string;
  done: boolean;
  tools: Array<{ name: string; arguments: Record<string, unknown> }>;
}> {
  let text = "";
  let done = false;
  const tools: Array<{ name: string; arguments: Record<string, unknown> }> = [];
  for await (const chunk of gen) {
    if (chunk.type === "delta") text += chunk.delta ?? "";
    if (chunk.type === "tool_call") tools.push({ name: chunk.toolName ?? "", arguments: chunk.arguments ?? {} });
    if (chunk.type === "done") done = true;
  }
  return { text, done, tools };
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
    expect(text).toContain("Offline demo");
    expect(text).not.toContain("on it");
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

  it("emits real delegate_to_agent calls instead of impersonating named agents", async () => {
    const { text, tools, done } = await collect(
      new LocalAgentRuntime().respond({
        ...base,
        history: [{ role: "user", name: "You", content: "Ask Scout 1 and Builder 3 to say hello" }],
        availableAgents: [
          { name: "Scout 1", role: "Research" },
          { name: "Builder 3", role: "Implementation" },
        ],
      }),
    );
    expect(text).toBe("");
    expect(tools.map((tool) => [tool.name, tool.arguments.agent])).toEqual([
      ["delegate_to_agent", "Scout 1"],
      ["delegate_to_agent", "Builder 3"],
    ]);
    expect(done).toBe(true);
  });
});
