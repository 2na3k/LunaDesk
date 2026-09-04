import { readFileSync } from "node:fs";
import { join } from "node:path";
import { workspaceTools } from "../workspace-tools";
import { type Context } from "@earendil-works/pi-ai";
import type { ModelSelection } from "../config";
import type { AgentRuntime, RespondChunk, RespondInput } from "../types";
import { models } from "./models";

/**
 * The primary, production agent runtime. It maps a LunaDesk bot + transcript
 * onto a pi-ai `Context` and streams the reply through the Pi unified LLM API.
 *
 * This is the real `pi-coding-agents`-ecosystem integration: `@earendil-works/pi-ai`
 * is the unified provider/model/auth layer that the Pi coding agent itself uses.
 * Auth (Codex OAuth, API keys, env vars) resolves through the owning provider.
 */
export class PiAgentRuntime implements AgentRuntime {
  readonly id = "pi";

  async isReady(model: ModelSelection): Promise<boolean> {
    try {
      const collection = models();
      const m = collection.getModel(model.provider, model.model);
      if (!m) return false;
      const auth = await collection.getAuth(m.provider);
      return Boolean(auth);
    } catch {
      return false;
    }
  }

  async *respond(input: RespondInput, signal?: AbortSignal): AsyncGenerator<RespondChunk> {
    const collection = models();
    const model = collection.getModel(input.model.provider, input.model.model);
    if (!model) {
      yield { type: "error", error: `Unknown model ${input.model.provider}/${input.model.model}` };
      return;
    }

    const context: Context = {
      systemPrompt: buildSystemPrompt(input),
      messages: [...toMessages(input), ...(input.continuation ?? [])],
      tools: buildTools(input),
    };

    const stream = collection.streamSimple(model, context, {
      reasoning: input.model.reasoning === "off" ? undefined : input.model.reasoning,
      signal,
    });

    let sawText = false;
    for await (const event of stream) {
      if (event.type === "text_delta") {
        sawText = true;
        yield { type: "delta", delta: event.delta };
      } else if (event.type === "toolcall_end") {
        yield {
          type: "tool_call",
          toolCallId: event.toolCall.id,
          toolName: event.toolCall.name,
          arguments: event.toolCall.arguments,
        };
      } else if (event.type === "error") {
        yield { type: "error", error: event.error.errorMessage ?? "Model request failed" };
        return;
      }
    }

    const final = await stream.result();
    if (final.stopReason === "error" || final.stopReason === "aborted") {
      yield { type: "error", error: final.errorMessage ?? final.stopReason };
      return;
    }
    if (!sawText) {
      // Some providers deliver text only in the final message.
      const text = final.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("");
      if (text) yield { type: "delta", delta: text };
    }
    yield { type: "assistant_message", assistantMessage: final };
    yield { type: "done" };
  }
}

function buildSystemPrompt(input: RespondInput): string {
  const lines = [
    `You are "${input.botName}", an autonomous teammate inside LunaDesk, a multi-agent workspace.`,
    input.persona,
  ];
  if (input.peers && input.peers.length > 0) {
    lines.push(
      "",
      `You are collaborating in a group chat with these teammates: ${input.peers.join(", ")}.`,
      "Speak only as yourself and do the actual task now. Never merely claim that you are starting, waiting, queuing work, or will report back later.",
      "Read the attributed teammate turns. Explicitly build on, challenge, or correct their concrete work instead of repeating it.",
      "Advance the result with evidence, reasoning, or usable output. Make reasonable assumptions when details are missing and label them briefly.",
      "When a handoff is useful, name the specific teammate and state exactly what they should do next.",
      "Keep the response focused, but use enough detail to make a substantive contribution.",
      "Do NOT prefix your message with your own name.",
    );
  } else {
    lines.push(
      "",
      "Keep replies concise, warm, and action-oriented — like a capable colleague in a chat app.",
    );
  }
  if (input.orchestration || input.availableAgents?.length) {
    lines.push(readFileSync(join(process.cwd(), "skills/lunadesk-delegation/SKILL.md"), "utf8"));
    lines.push(`Existing agents: ${JSON.stringify(input.availableAgents ?? [])}`);
  }
  return lines.join("\n");
}

function buildTools(input: RespondInput): Context["tools"] {
  return input.orchestration || input.availableAgents?.length ? workspaceTools : undefined;
}

/**
 * Collapse the whole transcript into a single, provider-agnostic user message.
 * This sidesteps per-provider assistant-message reconstruction while still
 * giving the model full, attributed context for both 1:1 and group chats.
 */
function toMessages(input: RespondInput): Context["messages"] {
  const lines: string[] = [];
  for (const turn of input.history) {
    if (turn.role === "system") {
      lines.push(`[${turn.content}]`);
      continue;
    }
    const speaker =
      turn.role === "user" ? (turn.name ?? "User") : (turn.name ?? "Assistant");
    lines.push(`${speaker}: ${turn.content}`);
  }

  const transcript = lines.join("\n");
  const ask =
    input.peers && input.peers.length > 0
      ? `Continue the work as ${input.botName}. Produce a distinct, substantive contribution that responds to the latest user request and the other agents' actual output. Reply only with your in-character message.`
      : `Reply with a single in-character message as ${input.botName}.`;

  const content = transcript
    ? `Conversation so far:\n${transcript}\n\n${ask}`
    : `Start the conversation as ${input.botName}.`;

  return [{ role: "user", content, timestamp: Date.now() }];
}
