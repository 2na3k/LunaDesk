import type { AuthEvent, AuthPrompt } from "@earendil-works/pi-ai";
import { models } from "./models";

export const CODEX_PROVIDER_ID = "openai-codex";

interface PendingLogin {
  /** Resolve a manual-code prompt with the pasted code. */
  resolveCode?: (code: string) => void;
  rejectCode?: (err: Error) => void;
  abort: AbortController;
  /** Sink for streaming auth events to the SSE response. */
  emit: (event: LoginEvent) => void;
}

export type LoginEvent =
  | { type: "info"; message: string; links?: { url: string; label?: string }[] }
  | { type: "auth_url"; url: string; instructions?: string }
  | { type: "device_code"; userCode: string; verificationUri: string }
  | { type: "progress"; message: string }
  | {
      type: "prompt";
      promptType: AuthPrompt["type"];
      message: string;
      placeholder?: string;
      options?: readonly { id: string; label: string; description?: string }[];
    }
  | { type: "done" }
  | { type: "error"; error: string };

const pending = new Map<string, PendingLogin>();

/**
 * Begin a Codex (ChatGPT Plus/Pro subscription) OAuth login. Auth events are
 * pushed to `emit`; if the flow asks for a manual code, the client submits it
 * via `submitCode(session, code)`. On success, pi-ai persists the OAuth
 * credential to our credential store and subsequent requests auto-refresh it.
 */
export async function startCodexLogin(session: string, emit: (event: LoginEvent) => void): Promise<void> {
  const abort = new AbortController();
  const entry: PendingLogin = { abort, emit };
  pending.set(session, entry);

  const interaction = {
    signal: abort.signal,
    notify(event: AuthEvent) {
      switch (event.type) {
        case "info":
          emit({ type: "info", message: event.message, links: event.links?.map((l) => ({ url: l.url, label: l.label })) });
          break;
        case "auth_url":
          emit({ type: "auth_url", url: event.url, instructions: event.instructions });
          break;
        case "device_code":
          emit({ type: "device_code", userCode: event.userCode, verificationUri: event.verificationUri });
          break;
        case "progress":
          emit({ type: "progress", message: event.message });
          break;
      }
    },
    prompt(prompt: AuthPrompt): Promise<string> {
      emit({
        type: "prompt",
        promptType: prompt.type,
        message: prompt.message,
        placeholder: "placeholder" in prompt ? prompt.placeholder : undefined,
        options: prompt.type === "select" ? prompt.options : undefined,
      });
      return new Promise<string>((resolve, reject) => {
        entry.resolveCode = resolve;
        entry.rejectCode = reject;
        // A manual_code prompt races the loopback callback server; aborting the
        // per-prompt signal (callback won) rejects this pending paste.
        prompt.signal?.addEventListener("abort", () => reject(new Error("prompt aborted")));
      });
    },
  };

  try {
    await models().login(CODEX_PROVIDER_ID, "oauth", interaction);
    emit({ type: "done" });
  } catch (err) {
    emit({ type: "error", error: err instanceof Error ? err.message : String(err) });
  } finally {
    pending.delete(session);
  }
}

export function submitCode(session: string, code: string): boolean {
  const entry = pending.get(session);
  if (!entry?.resolveCode) return false;
  entry.resolveCode(code);
  return true;
}

export function cancelLogin(session: string): boolean {
  const entry = pending.get(session);
  if (!entry) return false;
  entry.rejectCode?.(new Error("cancelled"));
  entry.abort.abort();
  pending.delete(session);
  return true;
}
