/**
 * Central, easy-to-change configuration constants.
 *
 * Interpretation of the user's request "Default luna max high something something":
 * The Pi/Codex catalog ships a model literally named "GPT-5.6 Luna" (`gpt-5.6-luna`).
 * We interpret "luna max high" as: use the Luna model at HIGH reasoning by default,
 * branded in the UI as "Luna Max · High". Change `DEFAULT_MODEL` / `DEFAULT_REASONING`
 * below to pick any other catalog model.
 */

export type ReasoningLevel =
  | "off"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

export interface ModelSelection {
  /** pi-ai provider id, e.g. "openai-codex", "openai", "anthropic". */
  provider: string;
  /** pi-ai model id within that provider, e.g. "gpt-5.6-luna". */
  model: string;
  /** Reasoning/thinking effort. */
  reasoning: ReasoningLevel;
}

/**
 * The single, clearly-labeled default model constant. This is the "Luna Max"
 * the user asked for: the Codex `gpt-5.6-luna` model at high reasoning.
 */
export const DEFAULT_MODEL: ModelSelection = {
  provider: "openai-codex",
  model: "gpt-5.6-luna",
  reasoning: "high",
};

/** Human-facing label for the default model shown throughout the UI. */
export const DEFAULT_MODEL_LABEL = "Luna Max · High";

/** Provider ids we surface as first-class options in the provider screen. */
export const FEATURED_PROVIDERS = [
  "openai-codex",
  "openai",
  "anthropic",
  "google",
  "xai",
  "openrouter",
] as const;

/** Where the file-backed Pi credential store lives on disk (dev / server). */
export const CREDENTIAL_STORE_PATH =
  process.env.LUNA_CREDENTIAL_STORE ??
  (process.env.HOME
    ? `${process.env.HOME}/.lunadesk/credentials.json`
    : "./.pi-credentials.json");
