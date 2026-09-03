export interface ProviderStatus {
  id: string;
  name: string;
  supportsOAuth: boolean;
  supportsApiKey: boolean;
  isSubscription: boolean;
  oauthLabel?: string;
  configured: boolean;
  credentialType?: "api_key" | "oauth";
  source?: string;
}

export async function fetchProviderStatuses(signal?: AbortSignal): Promise<ProviderStatus[]> {
  const response = await fetch("/api/providers", { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load provider status");
  const data = (await response.json()) as { providers?: ProviderStatus[] };
  return data.providers ?? [];
}

export async function saveProviderApiKey(provider: string, apiKey: string): Promise<void> {
  const response = await fetch("/api/providers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "setKey", provider, apiKey }),
  });
  if (!response.ok) throw new Error("Unable to save API key");
}

export async function logoutProvider(provider: string): Promise<void> {
  const response = await fetch("/api/providers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "logout", provider }),
  });
  if (!response.ok) throw new Error("Unable to sign out");
}
