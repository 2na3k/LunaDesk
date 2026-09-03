import type { AgentTurn, ChatMessage } from "./types";
import type { ModelSelection } from "./config";

export interface StreamCallbacks {
  onMeta?: (meta: { live: boolean; runtime: string }) => void;
  onDelta: (delta: string) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
}

/** Convert a bot's message list into attributed agent turns for the backend. */
export function toTurns(messages: ChatMessage[]): AgentTurn[] {
  return messages
    .filter((m) => !m.pending)
    .map((m) => {
      if (m.sender.kind === "user") return { role: "user" as const, name: "You", content: m.body };
      if (m.sender.kind === "system") return { role: "system" as const, content: m.body };
      return { role: "assistant" as const, name: m.sender.name, content: m.body };
    });
}

export interface ChatRequest {
  persona: string;
  botName: string;
  history: AgentTurn[];
  model: ModelSelection;
  peers?: string[];
}

/** Stream a single assistant reply from POST /api/chat (SSE over fetch). */
export async function streamChat(
  req: ChatRequest,
  cb: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.body) {
    cb.onError?.("No response body");
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const json = line.slice(5).trim();
      if (!json) continue;
      let evt: Record<string, unknown>;
      try {
        evt = JSON.parse(json);
      } catch {
        continue;
      }
      if (evt.type === "meta") {
        cb.onMeta?.({ live: Boolean(evt.live), runtime: String(evt.runtime) });
      } else if (evt.type === "delta") {
        cb.onDelta(String(evt.delta ?? ""));
      } else if (evt.type === "done") {
        cb.onDone?.();
      } else if (evt.type === "error") {
        cb.onError?.(String(evt.error ?? "error"));
      }
    }
  }
}
