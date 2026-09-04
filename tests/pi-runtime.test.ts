import { describe, expect, it, vi } from "vitest";
import type { Context } from "@earendil-works/pi-ai";
import { DEFAULT_MODEL } from "@/lib/config";

const mocks = vi.hoisted(() => ({ streamSimple: vi.fn() }));
vi.mock("@/lib/agents/models", () => ({ models: () => ({ getModel: () => ({ provider: "openai" }), streamSimple: mocks.streamSimple }) }));
import { PiAgentRuntime } from "@/lib/agents/pi-runtime";

describe("Pi delegation tools", () => {
  it("exposes creation tools and loads the skill even in a one-agent workspace", async () => {
    const final = { role: "assistant", content: [{ type: "text", text: "hello" }], stopReason: "stop" };
    mocks.streamSimple.mockImplementation((_model, context: Context) => {
      expect(context.tools?.map((tool) => tool.name)).toEqual(["create_agent", "spawn_agents", "send_message", "delegate_to_agent"]);
      expect(context.systemPrompt).toContain("name: lunadesk-delegation");
      expect(context.messages.at(-1)).toMatchObject({ role: "toolResult", toolCallId: "created-1" });
      return { async *[Symbol.asyncIterator]() {}, result: async () => final };
    });
    const chunks = [];
    for await (const chunk of new PiAgentRuntime().respond({
      botName: "Lead", persona: "Coordinate", history: [], model: DEFAULT_MODEL,
      orchestration: true, availableAgents: [],
      continuation: [{ role: "toolResult", toolCallId: "created-1", toolName: "create_agent", content: [{ type: "text", text: "created" }], isError: false, timestamp: 1 }],
    })) chunks.push(chunk);
    expect(chunks).toContainEqual({ type: "assistant_message", assistantMessage: final });
  });
});
