import type { AgentTurn } from "./types";
import type { ModelSelection } from "./config";

export interface DelegatedAgentSpec {
  name: string;
  role: string;
  persona: string;
  task: string;
  color?: string;
}

export interface DelegationPlan {
  groupName: string;
  task: string;
  agents: DelegatedAgentSpec[];
}

const SPECIALISTS = [
  {
    role: "Explorer",
    persona: "Explore the problem broadly, surface useful context, and propose creative options.",
  },
  {
    role: "Skeptic",
    persona: "Challenge assumptions, identify risks and gaps, and give direct constructive criticism.",
  },
  {
    role: "Builder",
    persona: "Turn ideas into a concrete execution plan with practical next steps and clear ownership.",
  },
  {
    role: "Synthesizer",
    persona: "Connect the strongest ideas from teammates and resolve disagreements into a crisp recommendation.",
  },
  {
    role: "Verifier",
    persona: "Check claims, test the proposed approach, and state what evidence is still missing.",
  },
] as const;

function normalized(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Cheap routing guard so ordinary messages do not pay for an orchestration call. */
export function isDelegationRequest(text: string): boolean {
  const value = normalized(text);
  if (/^\s*\/(?:delegate|spawn)\b/.test(value)) return true;
  if (/\b(?:spawn|delegate|delegat)\w*\b/.test(value)) return true;
  const createVerb = /\b(?:create|make|tao|de)\b/.test(value);
  const agentNoun = /\b(?:agents?|bots?|teammates?|subagents?|nhan vien)\b/.test(value);
  const numberedNames = /\b[\p{L}_-]+\s*1\b.*\b[\p{L}_-]+\s*2\b/u.test(value);
  return createVerb && (agentNoun || numberedNames);
}

function explicitNames(instruction: string): string[] {
  const matches = instruction.match(/[\p{L}][\p{L}\p{M}'_-]*\s+\d+/gu) ?? [];
  const commandWords = new Set(["spawn", "delegate", "delegat", "create", "make", "tao", "de"]);
  return [
    ...new Set(
      matches
        .map((name) => name.trim())
        .filter((name) => !commandWords.has(normalized(name).replace(/\s+\d+$/, ""))),
    ),
  ].slice(0, 5);
}

export function fallbackDelegationPlan(instruction: string): DelegationPlan {
  const names = explicitNames(instruction);
  const countMatch = normalized(instruction).match(/\b([2-5])\s+(?:agents?|bots?|teammates?|subagents?)\b/);
  const count = names.length || Number(countMatch?.[1] ?? 3);
  const chosenNames = names.length
    ? names
    : Array.from({ length: Math.min(5, Math.max(2, count)) }, (_, index) => `Agent ${index + 1}`);
  return {
    groupName: `Delegation · ${chosenNames.map((name) => name.replace(/\s+\d+$/, "")).join(" / ")}`,
    task: instruction.replace(/^\s*\/(?:delegate|spawn)\s*/i, "").trim() || instruction.trim(),
    agents: chosenNames.map((name, index) => {
      const specialist = SPECIALISTS[index % SPECIALISTS.length];
      return {
        name,
        role: specialist.role,
        task: instruction.trim(),
        persona: `${specialist.persona} You are ${name}. Speak only as yourself and actively respond to the other agents' contributions.`,
      };
    }),
  };
}

export function validateDelegationPlan(value: unknown, instruction: string): DelegationPlan {
  const fallback = fallbackDelegationPlan(instruction);
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as Partial<DelegationPlan>;
  if (!Array.isArray(candidate.agents) || candidate.agents.length < 2) return fallback;
  const seen = new Set<string>();
  const agents = candidate.agents
    .filter((agent): agent is DelegatedAgentSpec => Boolean(agent && typeof agent === "object"))
    .map((agent, index) => ({
      name: String(agent.name || `Agent ${index + 1}`).trim(),
      role: String(agent.role || SPECIALISTS[index % SPECIALISTS.length].role).trim(),
      persona: String(agent.persona || SPECIALISTS[index % SPECIALISTS.length].persona).trim(),
      task: String(agent.task || candidate.task || instruction).trim(),
      color: agent.color,
    }))
    .filter((agent) => {
      const key = agent.name.toLowerCase();
      if (!agent.name || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
  if (agents.length < 2) return fallback;
  return {
    groupName: String(candidate.groupName || fallback.groupName).trim(),
    task: String(candidate.task || instruction).trim(),
    agents,
  };
}

export interface DelegationRequest {
  instruction: string;
  coordinatorName: string;
  coordinatorPersona: string;
  existingAgents: string[];
  history: AgentTurn[];
  model: ModelSelection;
}

export interface MentionDelegationRoute {
  leadName: string;
  helperNames: string[];
}

export interface DelegateToolInvocation {
  agentName: string;
  task: string;
}

export function parseDelegateToolCall(
  toolName: string,
  args: Record<string, unknown>,
  availableNames: string[],
): DelegateToolInvocation | null {
  if (toolName !== "delegate_to_agent") return null;
  const requestedName = typeof args.agent === "string" ? args.agent.trim() : "";
  const task = typeof args.task === "string" ? args.task.trim() : "";
  const agentName = availableNames.find(
    (name) => name.toLocaleLowerCase() === requestedName.toLocaleLowerCase(),
  );
  if (!agentName || !task) return null;
  return { agentName, task };
}

/** The first mentioned agent owns the result; later mentions are its helpers. */
export function routeMentionDelegation(mentionedNames: string[]): MentionDelegationRoute | null {
  const names = [...new Set(mentionedNames.map((name) => name.trim()).filter(Boolean))];
  if (names.length === 0) return null;
  return { leadName: names[0], helperNames: names.slice(1) };
}

export async function requestDelegationPlan(request: DelegationRequest): Promise<DelegationPlan> {
  const response = await fetch("/api/delegate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(await response.text());
  const data = (await response.json()) as { plan: DelegationPlan };
  return validateDelegationPlan(data.plan, request.instruction);
}
