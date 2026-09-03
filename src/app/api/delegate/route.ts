import type { NextRequest } from "next/server";
import { DEFAULT_MODEL } from "@/lib/config";
import { fallbackDelegationPlan, validateDelegationPlan, type DelegationRequest } from "@/lib/delegation";
import { selectRuntime } from "@/lib/agents/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(candidate);
}

export async function POST(request: NextRequest) {
  let body: Partial<DelegationRequest>;
  try {
    body = (await request.json()) as Partial<DelegationRequest>;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const instruction = body.instruction?.trim();
  if (!instruction) return new Response("Missing instruction", { status: 400 });

  const fallback = fallbackDelegationPlan(instruction);
  const model = body.model ?? DEFAULT_MODEL;
  const { runtime: agent, live } = await selectRuntime(model);
  if (!live) return Response.json({ plan: fallback, live: false });

  const plannerPrompt = [
    "You are a multi-agent orchestration planner. Return only valid JSON, with no markdown.",
    "Create 2-5 genuinely distinct agents for the request. Preserve explicit names from the user.",
    "Every agent must have a different role, behavioral persona, and concrete delegated task.",
    "Schema: {\"groupName\":string,\"task\":string,\"agents\":[{\"name\":string,\"role\":string,\"persona\":string,\"task\":string}]}",
    `Coordinator: ${body.coordinatorName ?? "Coordinator"}`,
    `Existing agents (do not reuse these names unless explicitly requested): ${(body.existingAgents ?? []).join(", ") || "none"}`,
  ].join("\n");
  let output = "";
  try {
    for await (const chunk of agent.respond({
      persona: plannerPrompt,
      botName: "Delegation Planner",
      history: [{ role: "user", name: body.coordinatorName ?? "Coordinator", content: instruction }],
      model,
    }, request.signal)) {
      if (chunk.type === "delta") output += chunk.delta ?? "";
      if (chunk.type === "error") throw new Error(chunk.error ?? "Planner failed");
    }
    return Response.json({ plan: validateDelegationPlan(parseJson(output), instruction), live: true });
  } catch {
    return Response.json({ plan: fallback, live: true, fallback: true });
  }
}
