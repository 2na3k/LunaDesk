import type { ModelSelection } from "../config";
import type { AgentRuntime, AgentTurn, RespondChunk, RespondInput } from "../types";

/**
 * A dependency-free fallback runtime. It produces persona-flavored, context-aware
 * replies with no network or credentials, so the entire LunaDesk experience —
 * including multi-agent group conversations — is demonstrable offline.
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
      const gist = summarize(lastPeer.content, 6);
      const groupLines = [
        `good call ${ref}. i'll take the "${gist}" piece and report back.`,
        `+1 to ${ref}. on my end i'll cover ${roleFocus(input)} so nothing slips.`,
        `agreed. ${ref} owns that — i'll unblock ${roleFocus(input)} in parallel.`,
        `noted from ${ref}. queuing ${roleFocus(input)} now, will flag if it stalls.`,
      ];
      return pick(groupLines, seed(input));
    }
    return `on it — i'll drive ${roleFocus(input)} for "${topic}" and loop the crew in.`;
  }

  const oneToOne = [
    `on it. i'll handle ${roleFocus(input)} for "${topic}" and keep it tight.`,
    `got it — starting on "${topic}" now. i'll surface anything that needs your call.`,
    `yep. i'll take "${topic}" end to end and report back with next steps.`,
    `understood. queuing "${topic}" — ${roleFocus(input)} first, then a quick recap for you.`,
  ];
  if (!lastUser) {
    return `hey — i'm ${input.botName}. ready when you are. what should i pick up first?`;
  }
  return pick(oneToOne, seed(input));
}

function roleFocus(input: RespondInput): string {
  const role = (input.persona || "").toLowerCase();
  if (role.includes("sales") || role.includes("outbound")) return "the outbound sequence";
  if (role.includes("inbox") || role.includes("email")) return "inbox triage";
  if (role.includes("account")) return "the account follow-ups";
  if (role.includes("talent") || role.includes("recruit")) return "the candidate intros";
  if (role.includes("expense") || role.includes("finance")) return "the expense reconciliation";
  if (role.includes("chief") || role.includes("lead")) return "coordination";
  return "the details";
}

function seed(input: RespondInput): number {
  const key = `${input.botName}:${input.history.length}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

function pick<T>(arr: T[], n: number): T {
  return arr[n % arr.length];
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function isModelDummy(_model: ModelSelection): boolean {
  return true;
}
