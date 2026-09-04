import { Type, type Tool } from "@earendil-works/pi-ai";

const agent = Type.Object({
  name: Type.String({ minLength: 1 }),
  role: Type.String({ minLength: 1 }),
  persona: Type.String({ minLength: 1 }),
});

export const workspaceTools: Tool[] = [
  {
    name: "create_agent",
    description: "Create a persistent LunaDesk agent with its own chat. Returns the actual name and thread ID. Does not start work.",
    parameters: agent,
  },
  {
    name: "spawn_agents",
    description: "Create independent agents and chat threads, send each its assignment, run them concurrently, and return their actual answers or failures for synthesis.",
    parameters: Type.Object({
      agents: Type.Array(Type.Object({ ...agent.properties, task: Type.String({ minLength: 1 }) }), { minItems: 1, maxItems: 5 }),
    }),
  },
  {
    name: "send_message",
    description: "Send a message to an existing agent in its own thread and wait for its actual response. Supports follow-up work.",
    parameters: Type.Object({ agent: Type.String({ minLength: 1 }), message: Type.String({ minLength: 1 }) }),
  },
  {
    name: "delegate_to_agent",
    description: "Assign a task to an existing agent in its own thread and wait for its actual response.",
    parameters: Type.Object({ agent: Type.String({ minLength: 1 }), task: Type.String({ minLength: 1 }) }),
  },
];
