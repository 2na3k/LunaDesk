import type { NextRequest } from "next/server";
import { models } from "@/lib/agents/models";
import { credentialStore } from "@/lib/agents/credential-store";
import { FEATURED_PROVIDERS } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ProviderStatus {
  id: string;
  name: string;
  supportsOAuth: boolean;
  supportsApiKey: boolean;
  isSubscription: boolean;
  /** OAuth selector label, e.g. "Sign in with ChatGPT". */
  oauthLabel?: string;
  configured: boolean;
  credentialType?: "api_key" | "oauth";
  source?: string;
}

export async function GET() {
  const collection = models();
  const stored = await credentialStore().list();
  const byProvider = new Map(stored.map((c) => [c.providerId, c.type]));

  const statuses: ProviderStatus[] = [];
  for (const id of FEATURED_PROVIDERS) {
    const provider = collection.getProvider(id);
    if (!provider) continue;
    let configured = false;
    let source: string | undefined;
    try {
      const auth = await collection.getAuth(id);
      configured = Boolean(auth);
      source = auth?.source;
    } catch {
      configured = false;
    }
    statuses.push({
      id,
      name: provider.name ?? id,
      supportsOAuth: Boolean(provider.auth?.oauth),
      supportsApiKey: Boolean(provider.auth?.apiKey?.login) || Boolean(provider.auth?.apiKey),
      isSubscription: Boolean(provider.auth?.oauth?.isSubscription),
      oauthLabel: provider.auth?.oauth?.loginLabel ?? provider.auth?.oauth?.name,
      configured,
      credentialType: byProvider.get(id),
      source,
    });
  }

  return Response.json({ providers: statuses });
}

interface PostBody {
  action: "setKey" | "logout";
  provider: string;
  apiKey?: string;
}

export async function POST(req: NextRequest) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.provider) return new Response("Missing provider", { status: 400 });

  if (body.action === "logout") {
    await credentialStore().delete(body.provider);
    return Response.json({ ok: true });
  }

  if (body.action === "setKey") {
    const key = (body.apiKey ?? "").trim();
    if (!key) return new Response("Missing apiKey", { status: 400 });
    await credentialStore().modify(body.provider, async () => ({
      type: "api_key",
      key,
    }));
    return Response.json({ ok: true });
  }

  return new Response("Unknown action", { status: 400 });
}
