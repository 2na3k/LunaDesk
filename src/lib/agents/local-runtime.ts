import type { ModelSelection } from "../config";
import type { AgentRuntime, AgentTurn, RespondChunk, RespondInput } from "../types";

/**
 * A dependency-free fallback runtime. It produces persona-flavored, context-aware
 * replies with no network or credentials. It is deliberately explicit that it
 * is a UI demo and cannot perform the delegated work.
 *
 * This is intentionally NOT the product's brain; it is the graceful-degradation
 * path when no provider credential is configured. The real intelligence comes
 * from `PiAgentRuntime`.
 */
export class LocalAgentRuntime implements AgentRuntime {
  readonly id = "local";

  async isReady(): Promise<boolean> {
    return true;
  }

  async *respond(input: RespondInput, signal?: AbortSignal): AsyncGenerator<RespondChunk> {
    const lastUser = lastFrom(input.history, (turn) => turn.role === "user");
    const requestedAgents = input.availableAgents?.filter((agent) =>
      lastUser ? normalized(lastUser.content).includes(normalized(agent.name)) : false,
    );
    if (lastUser && requestedAgents?.length) {
      for (const agent of requestedAgents) {
        yield {
          type: "tool_call",
          toolCallId: `local-${normalized(agent.name).replace(/\s+/g, "-")}`,
          toolName: "delegate_to_agent",
          arguments: { agent: agent.name, task: lastUser.content },
        };
      }
      yield { type: "done" };
      return;
    }
    const text = compose(input);
    // Stream word-by-word to mimic a real token stream in the UI.
    const words = text.split(/(\s+)/);
    for (const word of words) {
      if (signal?.aborted) {
        yield { type: "error", error: "aborted" };
        return;
      }
      await delay(12);
      yield { type: "delta", delta: word };
    }
    yield { type: "done" };
  }
}

function normalized(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}

function lastFrom(history: AgentTurn[], predicate: (t: AgentTurn) => boolean): AgentTurn | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    if (predicate(history[i])) return history[i];
  }
  return undefined;
}

function summarize(text: string, max = 8): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ").slice(0, max);
  return words.join(" ").replace(/[.,!?]+$/, "");
}

function compose(input: RespondInput): string {
  const isGroup = Boolean(input.peers && input.peers.length > 0);
  const lastUser = lastFrom(input.history, (t) => t.role === "user");
  const lastPeer = lastFrom(
    input.history,
    (t) => t.role === "assistant" && t.name !== undefined && t.name !== input.botName,
  );

  const topic = lastUser ? summarize(lastUser.content) : "the plan";

  if (isGroup) {
    if (lastPeer) {
      const ref = lastPeer.name;
      return `Offline demo: I can see ${ref}'s turn, but I cannot execute or reason about the assignment without a live provider. Reconnect Codex or add an API key.`;
    }
    return `Offline demo: ${input.botName} was created for "${topic}", but cannot perform the assignment without a live provider. Reconnect Codex or add an API key.`;
  }

  if (!lastUser) {
    return `Offline demo: I'm ${input.botName}. Connect Codex or add an API key before assigning real work.`;
  }
  return `Offline demo: I received "${topic}", but I cannot do the work or report progress without a live provider. Reconnect Codex or add an API key.`;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function isModelDummy(_model: ModelSelection): boolean {
  return true;
}
