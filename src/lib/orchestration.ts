import type { AssistantMessage, Message } from "@earendil-works/pi-ai";
import type { AgentToolCall, ChatRequest } from "./client";
import type { Bot } from "./types";

export interface WorkerSpec { name: string; role: string; persona: string }
export interface WorkspaceToolHost {
  create(spec: WorkerSpec): Bot;
  find(name: string): Bot | undefined;
  run(agent: Bot, task: string): Promise<string>;
  record(message: string): void;
}

function required(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${key} must be a non-empty string`);
  return value.trim();
}

function spec(value: unknown): WorkerSpec {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid agent specification");
  const args = value as Record<string, unknown>;
  return { name: required(args, "name"), role: required(args, "role"), persona: required(args, "persona") };
}

export async function executeWorkspaceTool(call: AgentToolCall, host: WorkspaceToolHost) {
  try {
    const args = call.arguments;
    if (call.name === "create_agent") {
      const agent = host.create(spec(args));
      host.record(`Created @${agent.name} in its own chat.`);
      return { ok: true, agent: agent.name, threadId: agent.id };
    }
    if (call.name === "spawn_agents") {
      if (!Array.isArray(args.agents) || args.agents.length < 1 || args.agents.length > 5) {
        throw new Error("spawn_agents requires 1–5 agents");
      }
      // Validate the whole batch before creating anything.
      const assignments = args.agents.map((value) => ({ ...spec(value), task: required(value, "task") }));
      const workers = assignments.map((assignment) => ({ agent: host.create(assignment), task: assignment.task }));
      host.record(`Spawned ${workers.map(({ agent }) => `@${agent.name}`).join(", ")} in independent chats.`);
      const results = await Promise.all(workers.map(async ({ agent, task }) => {
        try {
          const answer = await host.run(agent, task);
          if (!answer.trim()) throw new Error("Worker returned no answer");
          host.record(`@${agent.name} completed its assignment.`);
          return { ok: true, agent: agent.name, threadId: agent.id, answer };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          host.record(`@${agent.name} failed: ${message}`);
          return { ok: false, agent: agent.name, threadId: agent.id, error: message };
        }
      }));
      return { ok: results.every((result) => result.ok), results };
    }
    if (call.name === "send_message" || call.name === "delegate_to_agent") {
      const name = required(args, "agent");
      const agent = host.find(name);
      if (!agent) throw new Error(`Unknown agent: ${name}`);
      const task = required(args, call.name === "send_message" ? "message" : "task");
      host.record(`Sent work to @${agent.name} in its own chat.`);
      const answer = await host.run(agent, task);
      if (!answer.trim()) throw new Error("Worker returned no answer");
      host.record(`@${agent.name} replied.`);
      return { ok: true, agent: agent.name, threadId: agent.id, answer };
    }
    throw new Error(`Unknown workspace tool: ${call.name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    host.record(`${call.name} failed: ${message}`);
    return { ok: false, error: message };
  }
}

export interface ModelStep {
  text: string;
  calls: AgentToolCall[];
  assistant?: AssistantMessage;
  error?: string;
  live?: boolean;
}

/** Keep native call IDs and assistant/tool messages across creation and follow-ups. */
export async function runWorkspaceTurn(
  input: ChatRequest,
  host: WorkspaceToolHost,
  agents: () => Array<{ name: string; role: string }>,
  step: (request: ChatRequest) => Promise<ModelStep>,
): Promise<string> {
  const continuation: Message[] = [];
  for (let round = 0; round < 8; round++) {
    const result = await step({ ...input, orchestration: true, availableAgents: agents(), continuation: [...continuation] });
    if (result.error) throw new Error(result.error);
    if (!result.calls.length) {
      if (!result.text.trim()) throw new Error("The agent returned no answer");
      return result.text;
    }
    if (result.assistant) continuation.push(result.assistant);
    else if (result.live !== false) throw new Error("Missing assistant tool-call message; no tools were executed");
    // Sequential calls may depend on an agent created by the preceding call.
    // spawn_agents runs its independent worker batch concurrently.
    for (const call of result.calls) {
      const output = await executeWorkspaceTool(call, host);
      continuation.push({
        role: "toolResult", toolCallId: call.id, toolName: call.name,
        content: [{ type: "text", text: JSON.stringify(output) }],
        isError: !output.ok, timestamp: Date.now(),
      });
    }
  }
  throw new Error("Delegation reached the 8-step limit. Completed work is saved in the agent chats.");
}
