import type { Models } from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import { credentialStore } from "./credential-store";

let shared: Models | undefined;

/**
 * A process-wide pi-ai `Models` collection with every built-in provider
 * registered and our persistent credential store injected. Auth (env keys,
 * stored API keys, OAuth tokens with locked refresh) resolves through the
 * owning provider automatically.
 */
export function models(): Models {
  if (!shared) {
    shared = builtinModels({ credentials: credentialStore() });
  }
  return shared;
}
