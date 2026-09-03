import type { Bot } from "./types";

let counter = 0;
export function newId(prefix = "id"): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

export function sampleBots(): Bot[] {
  const defaultAgent: Bot = {
    id: newId("bot"),
    name: "Default Agent",
    role: "Your general-purpose AI teammate.",
    persona: "You are the default agent: helpful, concise, and proactive. Ask what the operator needs and get to work.",
    preview: "Ready when you are.",
    timestamp: "Now",
    color: "#3bb7a9",
    symbol: "circle",
    members: [],
    messages: [{ id: newId("msg"), sender: { kind: "system" }, body: "No recent messages." }],
  };
  return [defaultAgent];
}
