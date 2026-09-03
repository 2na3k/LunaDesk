import type { NextRequest } from "next/server";
import { cancelLogin, startCodexLogin, submitCode, type LoginEvent } from "@/lib/agents/codex-login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/auth/codex?session=ID  → SSE stream of the OAuth login flow.
 * POST /api/auth/codex             → { session, code } to answer a manual-code
 *                                     prompt, or { session, action:"cancel" }.
 */
export async function GET(req: NextRequest) {
  const session = req.nextUrl.searchParams.get("session");
  if (!session) return new Response("Missing session", { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: LoginEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // stream already closed
        }
      };
      await startCodexLogin(session, emit);
      controller.close();
    },
    cancel() {
      cancelLogin(session);
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

interface PostBody {
  session: string;
  code?: string;
  action?: "cancel";
}

export async function POST(req: NextRequest) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!body.session) return new Response("Missing session", { status: 400 });

  if (body.action === "cancel") {
    return Response.json({ ok: cancelLogin(body.session) });
  }
  if (body.code) {
    return Response.json({ ok: submitCode(body.session, body.code) });
  }
  return new Response("Nothing to do", { status: 400 });
}
