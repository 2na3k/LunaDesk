import type { ModelSelection } from "../config";
import type { AgentRuntime } from "../types";
import { LocalAgentRuntime } from "./local-runtime";
import { PiAgentRuntime } from "./pi-runtime";

const pi = new PiAgentRuntime();
const local = new LocalAgentRuntime();

export interface RuntimeSelection {
  runtime: AgentRuntime;
  /** True when a real provider credential backs the response. */
  live: boolean;
}

/**
 * Choose the best available runtime for a model. Prefers the real Pi-backed
 * runtime when the owning provider has a resolvable credential; otherwise falls
 * back to the offline local runtime so the app always works.
 */
export async function selectRuntime(model: ModelSelection): Promise<RuntimeSelection> {
  if (process.env.LUNA_FORCE_LOCAL === "1") {
    return { runtime: local, live: false };
  }
  try {
    if (await pi.isReady(model)) {
      return { runtime: pi, live: true };
    }
  } catch {
    // fall through to local
  }
  return { runtime: local, live: false };
}

export { pi as piRuntime, local as localRuntime };
