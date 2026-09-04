import { describe, expect, it, vi } from "vitest";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { executeWorkspaceTool, runWorkspaceTurn, type WorkspaceToolHost } from "@/lib/orchestration";
import { DEFAULT_MODEL } from "@/lib/config";
import type { Bot } from "@/lib/types";
import type { AgentToolCall } from "@/lib/client";

function fixture() {
  const bots: Bot[] = [];
  const host: WorkspaceToolHost = {
    create: vi.fn((spec) => {
      const bot: Bot = { ...spec, id: `thread-${bots.length}`, messages: [], members: [], preview: "", timestamp: "Now", color: "#fff", symbol: "circle" };
      bots.push(bot);
      return bot;
    }),
    find: (name) => bots.find((bot) => bot.name === name),
    run: vi.fn(async (bot, task) => {
      bot.messages.push({ id: "request", sender: { kind: "user" }, body: task });
      const answer = `${bot.name}: completed ${task}`;
      bot.messages.push({ id: "answer", sender: { kind: "bot", name: bot.name }, body: answer });
      return answer;
    }),
    record: vi.fn(),
  };
  return { host, bots };
}

const workers = [1, 2, 3].map((n) => ({ name: `Worker ${n}`, role: "Research", persona: "Research independently", task: `Proposal ${n}` }));
const call: AgentToolCall = { id: "spawn-1", name: "spawn_agents", arguments: { agents: workers } };

function assistant(calls: AgentToolCall[]): AssistantMessage {
  return {
    role: "assistant", content: calls.map((tool) => ({ type: "toolCall", id: tool.id, name: tool.name, arguments: tool.arguments })),
    api: "openai-responses", provider: "openai", model: "test", stopReason: "toolUse", timestamp: 1,
    usage: { input: 0, output: 0, totalTokens: 0, cacheRead: 0, cacheWrite: 0, cost: { input: 0, output: 0, total: 0, cacheRead: 0, cacheWrite: 0 } },
  };
}

describe("executable workspace delegation", () => {
  it("shows the model-authored update before waiting for workers", async () => {
    const { host } = fixture();
    const announce = vi.fn();
    host.announce = announce;
    host.run = vi.fn(async () => {
      expect(announce).toHaveBeenCalledWith("Tao nhờ ba đệ xem riêng từng hướng rồi sẽ tổng hợp lại.");
      return "Actual worker output";
    });
    await executeWorkspaceTool({ ...call, arguments: { ...call.arguments, update: "Tao nhờ ba đệ xem riêng từng hướng rồi sẽ tổng hợp lại." } }, host);
    expect(announce).toHaveBeenCalledTimes(1);
  });
  it("creates three real threads and returns their actual messages", async () => {
    const { host, bots } = fixture();
    const output = await executeWorkspaceTool(call, host);
    expect(bots).toHaveLength(3);
    expect(bots.map((bot) => bot.messages.map((message) => message.body))).toEqual(workers.map((worker) => [worker.task, `${worker.name}: completed ${worker.task}`]));
    expect(output).toMatchObject({ ok: true, results: workers.map((worker, n) => ({ threadId: `thread-${n}`, answer: `${worker.name}: completed ${worker.task}` })) });
  });

  it("starts all independent workers before waiting for any result", async () => {
    const { host } = fixture();
    const releases: Array<() => void> = [];
    host.run = vi.fn(() => new Promise<string>((resolve) => releases.push(() => resolve("done"))));
    const pending = executeWorkspaceTool(call, host);
    expect(host.run).toHaveBeenCalledTimes(3);
    releases.forEach((release) => release());
    expect(await pending).toMatchObject({ ok: true });
  });

  it("validates all assignments before mutation and never creates imaginary recipients", async () => {
    const { host } = fixture();
    expect(await executeWorkspaceTool({ ...call, arguments: { agents: [workers[0], { ...workers[1], task: " " }] } }, host)).toMatchObject({ ok: false });
    expect(host.create).not.toHaveBeenCalled();
    expect(await executeWorkspaceTool({ id: "send", name: "send_message", arguments: { agent: "Missing", message: "hello" } }, host)).toMatchObject({ ok: false });
    expect(host.run).not.toHaveBeenCalled();
  });

  it("preserves partial team failures and returns only real completed answers", async () => {
    const { host } = fixture();
    host.run = vi.fn(async (bot) => { if (bot.name === "Worker 2") throw new Error("usage limit"); return `${bot.name} done`; });
    expect(await executeWorkspaceTool(call, host)).toMatchObject({ ok: false, results: [
      { ok: true, answer: "Worker 1 done" }, { ok: false, error: "usage limit" }, { ok: true, answer: "Worker 3 done" },
    ] });
  });

  it("continues with native tool results, then messages a newly spawned agent before synthesis", async () => {
    const { host, bots } = fixture();
    const followup: AgentToolCall = { id: "followup", name: "send_message", arguments: { agent: "Worker 1", message: "Check your proposal" } };
    const step = vi.fn()
      .mockResolvedValueOnce({ text: "", calls: [call], assistant: assistant([call]) })
      .mockImplementationOnce(async (request) => {
        expect(request.availableAgents).toHaveLength(3);
        expect(request.continuation[0]).toEqual(assistant([call]));
        expect(request.continuation[1]).toMatchObject({ role: "toolResult", toolCallId: "spawn-1", toolName: "spawn_agents" });
        expect(JSON.parse(request.continuation[1].content[0].text).results[0].answer).toBe("Worker 1: completed Proposal 1");
        return { text: "", calls: [followup], assistant: assistant([followup]) };
      })
      .mockImplementationOnce(async (request) => {
        expect(request.continuation[3]).toMatchObject({ role: "toolResult", toolCallId: "followup" });
        return { text: "Synthesis of actual proposals", calls: [] };
      });
    expect(await runWorkspaceTurn({ botName: "Lead", persona: "Lead", history: [], model: DEFAULT_MODEL }, host, () => bots, step)).toBe("Synthesis of actual proposals");
    expect(bots[0].messages).toHaveLength(4);
    expect(host.create).toHaveBeenCalledTimes(3);
  });

  it("does not execute calls from failed provider responses", async () => {
    const { host } = fixture();
    await expect(runWorkspaceTurn({ botName: "Lead", persona: "Lead", history: [], model: DEFAULT_MODEL }, host, () => [], async () => ({ text: "", calls: [call], error: "usage limit" }))).rejects.toThrow("usage limit");
    expect(host.create).not.toHaveBeenCalled();
  });
});
