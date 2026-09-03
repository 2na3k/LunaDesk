import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/providers/route";

describe("provider onboarding API", () => {
  it("reports Codex as an available provider on a fresh install", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      providers: Array<{ id: string; supportsOAuth: boolean }>;
    };
    const codex = body.providers.find((provider) => provider.id === "openai-codex");
    expect(codex).toBeDefined();
    expect(codex?.supportsOAuth).toBe(true);
  });

  it("rejects malformed and incomplete first-run API-key submissions", async () => {
    const malformed = await POST(new Request("http://localhost/api/providers", {
      method: "POST",
      body: "not-json",
      headers: { "content-type": "application/json" },
    }) as never);
    expect(malformed.status).toBe(400);

    const missingKey = await POST(new Request("http://localhost/api/providers", {
      method: "POST",
      body: JSON.stringify({ action: "setKey", provider: "openai" }),
      headers: { "content-type": "application/json" },
    }) as never);
    expect(missingKey.status).toBe(400);
  });
});
