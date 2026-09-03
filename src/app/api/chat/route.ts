import type { NextRequest } from "next/server";
import { DEFAULT_MODEL } from "@/lib/config";
import { selectRuntime } from "@/lib/agents/runtime";
import type { RespondInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stream a single assistant reply for one bot as Server-Sent Events.
 * Body: { persona, botName, history, model?, peers? }
 * Each SSE `data:` line is a RespondChunk. A leading `meta` event announces
 * whether the reply is live (real model) or produced by the offline runtime.
 */
export async function POST(req: NextRequest) {
  let body: Partial<RespondInput>;
  try {
    body = (await req.json()) as Partial<RespondInput>;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const input: RespondInput = {
    persona: body.persona ?? "",
    botName: body.botName ?? "Agent",
    history: Array.isArray(body.history) ? body.history : [],
    model: body.model ?? DEFAULT_MODEL,
    peers: body.peers,
  };

  const { runtime: agent, live } = await selectRuntime(input.model);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      send({ type: "meta", live, runtime: agent.id });
      try {
        for await (const chunk of agent.respond(input, req.signal)) {
          send(chunk);
        }
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
