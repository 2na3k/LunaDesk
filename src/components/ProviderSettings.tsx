"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_MODEL, DEFAULT_MODEL_LABEL } from "@/lib/config";
import type { Workspace } from "@/lib/useWorkspace";

interface ProviderStatus {
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

type LoginEvent =
  | { type: "info"; message: string; links?: { url: string; label?: string }[] }
  | { type: "auth_url"; url: string; instructions?: string }
  | { type: "device_code"; userCode: string; verificationUri: string }
  | { type: "progress"; message: string }
  | { type: "prompt"; promptType: string; message: string; placeholder?: string; options?: readonly { id: string; label: string; description?: string }[] }
  | { type: "done" }
  | { type: "error"; error: string };

interface CodexState {
  running: boolean;
  log: string[];
  authUrl?: string;
  deviceCode?: { userCode: string; verificationUri: string };
  needsCode?: boolean;
  promptType?: string;
  promptOptions?: readonly { id: string; label: string; description?: string }[];
  codeDraft: string;
  session?: string;
  done?: boolean;
  error?: string;
}

export function ProviderSettings({ ws }: { ws: Workspace }) {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [codex, setCodex] = useState<CodexState>({ running: false, log: [], codeDraft: "" });
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/providers");
      const data = (await res.json()) as { providers: ProviderStatus[] };
      setProviders(data.providers);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (ws.settingsOpen) void refresh();
  }, [ws.settingsOpen, refresh]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  if (!ws.settingsOpen) return null;

  const saveKey = async (id: string) => {
    const apiKey = (keyDrafts[id] ?? "").trim();
    if (!apiKey) return;
    await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setKey", provider: id, apiKey }),
    });
    setKeyDrafts((d) => ({ ...d, [id]: "" }));
    if (id === "openai") ws.setModel({ ...DEFAULT_MODEL, provider: "openai" });
    await refresh();
  };

  const logout = async (id: string) => {
    await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout", provider: id }),
    });
    await refresh();
  };

  const startCodex = async () => {
    const session = Math.random().toString(36).slice(2);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setCodex({ running: true, log: ["Starting ChatGPT / Codex sign-in…"], codeDraft: "", session });

    try {
      const res = await fetch(`/api/auth/codex?session=${session}`, { signal: ctrl.signal });
      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const evt = JSON.parse(line.slice(5).trim()) as LoginEvent;
          setCodex((c) => applyEvent(c, evt));
        }
      }
    } catch (err) {
      setCodex((c) => ({ ...c, running: false, error: err instanceof Error ? err.message : String(err) }));
    } finally {
      await refresh();
    }
  };

  const submitCode = async (selectedValue?: string) => {
    const value = selectedValue ?? codex.codeDraft.trim();
    if (!codex.session || !value) return;
    await fetch("/api/auth/codex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session: codex.session, code: value }),
    });
    setCodex((c) => ({ ...c, needsCode: false, codeDraft: "", log: [...c.log, "Submitted code…"] }));
  };

  const cancelCodex = async () => {
    if (codex.session) {
      await fetch("/api/auth/codex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: codex.session, action: "cancel" }),
      });
    }
    abortRef.current?.abort();
    setCodex({ running: false, log: [], codeDraft: "" });
  };

  const codexProvider = providers.find((p) => p.id === "openai-codex");

  return (
    <div className="absolute inset-0 z-40 flex justify-center bg-black/50 py-10" onClick={() => ws.setSettingsOpen(false)}>
      <div
        className="flex max-h-full w-[720px] max-w-[94vw] flex-col overflow-hidden rounded-2xl border border-luna-stroke bg-luna-content shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-luna-stroke px-5 py-4">
          <div>
            <div className="text-base font-semibold text-luna-primary">LLM Providers</div>
            <div className="text-[12.5px] text-luna-secondary">
              Default model: {DEFAULT_MODEL_LABEL} · powered by the Pi unified LLM API
            </div>
          </div>
          <button onClick={() => ws.setSettingsOpen(false)} className="text-luna-secondary hover:text-luna-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Codex subscription card */}
          <div className="mb-5 rounded-xl border border-luna-stroke bg-luna-window/60 p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-luna-primary">
                {codexProvider?.name ?? "OpenAI Codex"} (ChatGPT subscription)
              </span>
              {codexProvider?.configured ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">
                  signed in {codexProvider.source ? `· ${codexProvider.source}` : ""}
                </span>
              ) : (
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-luna-secondary">
                  not connected
                </span>
              )}
            </div>
            <p className="mt-1 text-[12.5px] text-luna-secondary">
              Sign in with your ChatGPT Plus/Pro subscription to use Luna Max ({DEFAULT_MODEL_LABEL}) via SSO —
              no API key required. Tokens are stored in the local credential store and auto-refreshed.
            </p>

            {!codex.running && !codex.done && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={startCodex}
                  className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-black"
                >
                  {codexProvider?.oauthLabel ?? "Sign in with ChatGPT"}
                </button>
                {codexProvider?.configured && (
                  <button
                    onClick={() => logout("openai-codex")}
                    className="rounded-lg border border-luna-stroke px-3 py-1.5 text-sm text-luna-secondary hover:text-luna-primary"
                  >
                    Sign out
                  </button>
                )}
              </div>
            )}

            {(codex.running || codex.done || codex.error) && (
              <div className="mt-3 rounded-lg border border-luna-stroke bg-black/30 p-3 text-[12.5px]">
                {codex.authUrl && (
                  <a
                    href={codex.authUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mb-2 block break-all text-sky-300 underline"
                  >
                    Open this URL to authorize → {codex.authUrl}
                  </a>
                )}
                {codex.deviceCode && (
                  <div className="mb-2 text-luna-primary">
                    Enter code <span className="font-mono text-emerald-300">{codex.deviceCode.userCode}</span> at{" "}
                    <a className="text-sky-300 underline" href={codex.deviceCode.verificationUri} target="_blank" rel="noreferrer">
                      {codex.deviceCode.verificationUri}
                    </a>
                  </div>
                )}
                <div className="max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-luna-secondary">
                  {codex.log.join("\n")}
                </div>
                {codex.promptType === "select" && codex.promptOptions && (
                  <div className="mt-2 grid gap-2">
                    {codex.promptOptions.map((option) => (
                      <button key={option.id} onClick={() => void submitCode(option.id)} className="rounded-md border border-luna-stroke px-3 py-2 text-left text-luna-primary hover:bg-white/[0.04]">
                        {option.label}{option.description ? ` — ${option.description}` : ""}
                      </button>
                    ))}
                  </div>
                )}
                {codex.needsCode && codex.promptType !== "select" && (
                  <div className="mt-2 flex gap-2">
                    <input
                      value={codex.codeDraft}
                      onChange={(e) => setCodex((c) => ({ ...c, codeDraft: e.target.value }))}
                      placeholder="Paste code / redirect URL"
                      className="h-9 flex-1 rounded-md border border-luna-stroke bg-luna-elevated/60 px-2 text-luna-primary focus:outline-none"
                    />
                    <button onClick={() => void submitCode()} className="rounded-md bg-white px-3 text-sm font-medium text-black">
                      Submit
                    </button>
                  </div>
                )}
                {codex.error && <div className="mt-2 text-red-400">Error: {codex.error}</div>}
                {codex.done && <div className="mt-2 text-emerald-300">Signed in ✓</div>}
                {codex.running && !codex.done && (
                  <button onClick={cancelCodex} className="mt-2 text-luna-secondary underline">
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>

          {/* API-key providers */}
          <div className="mb-2 text-[12.5px] font-medium uppercase tracking-wide text-luna-secondary">
            API key providers
          </div>
          <div className="flex flex-col gap-2">
            {providers
              .filter((p) => p.id !== "openai-codex")
              .map((p) => (
                <div key={p.id} className="rounded-xl border border-luna-stroke bg-luna-window/40 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-luna-primary">{p.name}</span>
                    {p.configured ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">
                        configured {p.source ? `· ${p.source}` : ""}
                      </span>
                    ) : (
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-luna-secondary">
                        not set
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="password"
                      value={keyDrafts[p.id] ?? ""}
                      onChange={(e) => setKeyDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                      placeholder={`${p.name} API key`}
                      className="h-9 flex-1 rounded-md border border-luna-stroke bg-luna-elevated/60 px-2 text-sm text-luna-primary placeholder:text-luna-secondary focus:outline-none"
                    />
                    <button
                      onClick={() => saveKey(p.id)}
                      className="rounded-md bg-white px-3 text-sm font-medium text-black"
                    >
                      Save
                    </button>
                    {p.configured && (
                      <button
                        onClick={() => logout(p.id)}
                        className="rounded-md border border-luna-stroke px-3 text-sm text-luna-secondary hover:text-luna-primary"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>

          <button
            onClick={() => ws.resetWorkspace()}
            className="mt-6 text-[12.5px] text-luna-secondary underline hover:text-luna-primary"
          >
            Reset workspace to Default Agent
          </button>
        </div>
      </div>
    </div>
  );
}

function applyEvent(c: CodexState, evt: LoginEvent): CodexState {
  const next: CodexState = { ...c };
  switch (evt.type) {
    case "info":
      next.log = [...c.log, evt.message, ...(evt.links ?? []).map((l) => `${l.label ?? "link"}: ${l.url}`)];
      break;
    case "auth_url":
      next.authUrl = evt.url;
      next.log = [...c.log, `Authorize URL received${evt.instructions ? ` — ${evt.instructions}` : ""}`];
      break;
    case "device_code":
      next.deviceCode = { userCode: evt.userCode, verificationUri: evt.verificationUri };
      next.log = [...c.log, "Device code issued"];
      break;
    case "progress":
      next.log = [...c.log, evt.message];
      break;
    case "prompt":
      next.needsCode = evt.promptType !== "select";
      next.promptType = evt.promptType;
      next.promptOptions = evt.options;
      next.log = [...c.log, evt.message];
      break;
    case "done":
      next.done = true;
      next.running = false;
      next.log = [...c.log, "Login complete"];
      break;
    case "error":
      next.error = evt.error;
      next.running = false;
      break;
  }
  return next;
}
