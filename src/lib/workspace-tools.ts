import { Type, type Tool } from "@earendil-works/pi-ai";

const agent = Type.Object({
  name: Type.String({ minLength: 1 }),
  role: Type.String({ minLength: 1 }),
  persona: Type.String({ minLength: 1 }),
});

const update = Type.String({ minLength: 1, description: "Write a brief user-facing progress update in your own voice and the user's language. Explain what you are assigning and that you will wait for the actual reply before organizing the result. This text is shown while the task runs; do not invent results." });

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
      update,
      agents: Type.Array(Type.Object({ ...agent.properties, task: Type.String({ minLength: 1 }) }), { minItems: 1, maxItems: 5 }),
    }),
  },
  {
    name: "send_message",
    description: "Send a message to an existing agent in its own thread and wait for its actual response. Supports follow-up work.",
    parameters: Type.Object({ update, agent: Type.String({ minLength: 1 }), message: Type.String({ minLength: 1 }) }),
  },
  {
    name: "delegate_to_agent",
    description: "Assign a task to an existing agent in its own thread and wait for its actual response.",
    parameters: Type.Object({ update, agent: Type.String({ minLength: 1 }), task: Type.String({ minLength: 1 }) }),
  },
];
