"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_MODEL_LABEL } from "@/lib/config";
import {
  fetchProviderStatuses,
  saveProviderApiKey,
  type ProviderStatus,
} from "@/lib/provider-client";

type LoginEvent =
  | { type: "info"; message: string }
  | { type: "auth_url"; url: string; instructions?: string }
  | { type: "device_code"; userCode: string; verificationUri: string }
  | { type: "progress"; message: string }
  | { type: "prompt"; promptType: string; message: string; placeholder?: string; options?: readonly { id: string; label: string; description?: string }[] }
  | { type: "done" }
  | { type: "error"; error: string };

type AuthState = {
  status: "idle" | "loading" | "running" | "success" | "error";
  authUrl?: string;
  deviceCode?: { userCode: string; verificationUri: string };
  needsCode?: boolean;
  promptType?: string;
  promptOptions?: readonly { id: string; label: string; description?: string }[];
  promptPlaceholder?: string;
  codeDraft: string;
  message?: string;
  session?: string;
};

export interface AuthOnboardingProps {
  /** Called after a provider is confirmed as configured. */
  onAuthenticated: (provider: ProviderStatus) => void;
}

/** First-run provider gate. It is intentionally independent of workspace state. */
export function AuthOnboarding({ onAuthenticated }: AuthOnboardingProps) {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [keyBusy, setKeyBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [auth, setAuth] = useState<AuthState>({ status: "loading", codeDraft: "" });
  const abortRef = useRef<AbortController | null>(null);
  const authenticatedRef = useRef(false);

  const refresh = useCallback(async () => {
    const next = await fetchProviderStatuses();
    setProviders(next);
    const configured = next.find((provider) =>
      (provider.id === "openai-codex" || provider.id === "openai") && provider.configured,
    );
    if (configured && !authenticatedRef.current) {
      authenticatedRef.current = true;
      onAuthenticated(configured);
    } else if (!configured) {
      setAuth((current) =>
        current.status === "loading" ? { ...current, status: "idle" } : current,
      );
    }
    return next;
  }, [onAuthenticated]);

  useEffect(() => {
    void refresh().catch(() => {
      setError("Could not check your sign-in status. Try again.");
      setAuth((current) => ({ ...current, status: "error" }));
    });
    return () => abortRef.current?.abort();
  }, [refresh]);

  const startCodex = async () => {
    const session = crypto.randomUUID();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(undefined);
    setAuth({ status: "running", codeDraft: "", session, message: "Waiting for ChatGPT authorization…" });
    try {
      const response = await fetch(`/api/auth/codex?session=${encodeURIComponent(session)}`, {
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error("Unable to start sign-in");
      const reader = response.body.getReader();
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
          let event: LoginEvent;
          try {
            event = JSON.parse(line.slice(5).trim()) as LoginEvent;
          } catch {
            continue;
          }
          setAuth((current) => applyLoginEvent(current, event));
        }
      }
      await refresh();
    } catch (cause) {
      if ((cause as Error).name === "AbortError") return;
      setError("ChatGPT sign-in could not be completed. Try again.");
      setAuth((current) => ({ ...current, status: "error" }));
    }
  };

  const submitCode = async (selectedValue?: string) => {
    const value = selectedValue ?? auth.codeDraft.trim();
    if (!auth.session || !value) return;
    try {
      const response = await fetch("/api/auth/codex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: auth.session, code: value }),
      });
      if (!response.ok) throw new Error("Unable to submit code");
      setAuth((current) => ({ ...current, needsCode: false, codeDraft: "", message: "Code submitted. Finishing sign-in…" }));
    } catch {
      setError("That code could not be submitted. Check it and try again.");
    }
  };

  const saveKey = async () => {
    const value = apiKey.trim();
    if (!value) return;
    setKeyBusy(true);
    setError(undefined);
    try {
      await saveProviderApiKey("openai", value);
      setApiKey("");
      await refresh();
    } catch {
      setError("The API key could not be saved. Check the key and try again.");
    } finally {
      setKeyBusy(false);
    }
  };

  const codex = providers.find((provider) => provider.id === "openai-codex");
  const openai = providers.find((provider) => provider.id === "openai");

  return (
    <main className="flex min-h-screen items-center justify-center bg-luna-window px-5 py-10 text-luna-primary">
      <section aria-labelledby="auth-title" className="w-full max-w-[560px] rounded-3xl border border-luna-stroke bg-luna-content p-7 shadow-2xl sm:p-9">
        <div className="mb-8 flex items-start gap-4">
          <div aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-lg font-semibold text-black">L</div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-luna-secondary">LunaDesk</p>
            <h1 id="auth-title" className="text-2xl font-semibold tracking-tight">Connect your AI provider</h1>
            <p className="mt-2 text-sm leading-6 text-luna-secondary">Sign in once to start with {DEFAULT_MODEL_LABEL}. Your credentials stay in the local credential store.</p>
          </div>
        </div>

        {error && <div role="alert" className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</div>}

        <div className="space-y-3">
          <div className="rounded-2xl border border-luna-stroke bg-luna-window/50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="font-medium">OpenAI Codex / ChatGPT</h2><p className="mt-1 text-sm text-luna-secondary">Use your ChatGPT Plus or Pro subscription via browser sign-in.</p></div>
              {codex?.configured && <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-300">Connected</span>}
            </div>
            <button type="button" onClick={startCodex} disabled={auth.status === "running" || auth.status === "loading"} className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50">{auth.status === "running" ? "Waiting for browser…" : "Continue with ChatGPT"}</button>
            {(auth.authUrl || auth.deviceCode || auth.message || auth.needsCode) && <div className="mt-3 rounded-xl border border-luna-stroke bg-black/20 p-3 text-sm" aria-live="polite">
              {auth.authUrl && <a className="break-all text-sky-300 underline" href={auth.authUrl} target="_blank" rel="noreferrer">Open the authorization page</a>}
              {auth.deviceCode && <p className="mt-2">Enter <span className="font-mono text-emerald-300">{auth.deviceCode.userCode}</span> at <a className="text-sky-300 underline" href={auth.deviceCode.verificationUri} target="_blank" rel="noreferrer">the verification page</a>.</p>}
              {auth.message && <p className="mt-2 text-luna-secondary">{auth.message}</p>}
              {auth.promptType === "select" && auth.promptOptions ? (
                <div className="mt-3 grid gap-2">
                  {auth.promptOptions.map((option) => (
                    <button key={option.id} type="button" onClick={() => void submitCode(option.id)} className="rounded-lg border border-luna-stroke px-3 py-2 text-left hover:bg-white/[0.05]">
                      <span className="block font-medium text-luna-primary">{option.label}</span>
                      {option.description && <span className="block text-xs text-luna-secondary">{option.description}</span>}
                    </button>
                  ))}
                </div>
              ) : auth.needsCode ? <div className="mt-3 flex gap-2"><label className="sr-only" htmlFor="codex-code">Authorization code</label><input id="codex-code" value={auth.codeDraft} onChange={(event) => setAuth((current) => ({ ...current, codeDraft: event.target.value }))} className="min-w-0 flex-1 rounded-lg border border-luna-stroke bg-luna-elevated/60 px-3 py-2 text-luna-primary" placeholder={auth.promptPlaceholder ?? "Paste code or redirect URL"} autoComplete="one-time-code" /><button type="button" onClick={() => void submitCode()} className="rounded-lg bg-white px-3 text-sm font-medium text-black">Submit</button></div> : null}
            </div>}
          </div>

          <div className="rounded-2xl border border-luna-stroke bg-luna-window/50 p-4">
            <div><h2 className="font-medium">OpenAI API key</h2><p className="mt-1 text-sm text-luna-secondary">Use an API key for usage-based billing instead of a ChatGPT subscription.</p></div>
            <div className="mt-4 flex gap-2"><label className="sr-only" htmlFor="openai-api-key">OpenAI API key</label><input id="openai-api-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-luna-stroke bg-luna-elevated/60 px-3 py-2 text-sm text-luna-primary" placeholder={openai?.configured ? "API key saved" : "sk-…"} autoComplete="off" /><button type="button" onClick={saveKey} disabled={keyBusy || !apiKey.trim()} className="rounded-lg bg-white px-3 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-50">{keyBusy ? "Saving…" : "Save key"}</button></div>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-luna-secondary">You can change providers later in Settings.</p>
      </section>
    </main>
  );
}

function applyLoginEvent(current: AuthState, event: LoginEvent): AuthState {
  switch (event.type) {
    case "auth_url": return { ...current, authUrl: event.url, message: event.instructions ?? "Authorize in your browser to continue." };
    case "device_code": return { ...current, deviceCode: { userCode: event.userCode, verificationUri: event.verificationUri }, message: "Complete verification in your browser." };
    case "prompt": return {
      ...current,
      needsCode: event.promptType !== "select",
      promptType: event.promptType,
      promptOptions: event.options,
      promptPlaceholder: event.placeholder,
      message: event.message,
    };
    case "progress": case "info": return { ...current, message: event.message };
    case "done": return { ...current, status: "success", message: "Signed in. Loading LunaDesk…" };
    case "error": return { ...current, status: "error", message: "Sign-in was not completed." };
    default: return current;
  }
}
