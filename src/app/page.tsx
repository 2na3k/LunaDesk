"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatPane } from "@/components/ChatPane";
import { AgentPicker } from "@/components/AgentPicker";
import { ProviderSettings } from "@/components/ProviderSettings";
import { AuthOnboarding } from "@/components/AuthOnboarding";
import { DEFAULT_MODEL } from "@/lib/config";
import type { ProviderStatus } from "@/lib/provider-client";
import { useWorkspace } from "@/lib/useWorkspace";

export default function Home() {
  const ws = useWorkspace();
  const [authenticated, setAuthenticated] = useState(false);

  const handleAuthenticated = useCallback(
    (provider: ProviderStatus) => {
      ws.setModel({
        ...DEFAULT_MODEL,
        provider: provider.id === "openai" ? "openai" : "openai-codex",
      });
      setAuthenticated(true);
    },
    [ws.setModel],
  );

  useEffect(() => {
    if (authenticated && ws.ready && ws.needsDefaultAgentSetup) ws.setPickerOpen(true);
  }, [authenticated, ws.ready, ws.needsDefaultAgentSetup, ws.setPickerOpen]);

  // ⌘N / Ctrl+N opens the agent picker (matches the original app shortcut).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        ws.setPickerOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ws]);

  if (!authenticated) return <AuthOnboarding onAuthenticated={handleAuthenticated} />;

  return (
    <main className="relative flex h-screen w-screen overflow-hidden bg-luna-window">
      <Sidebar ws={ws} />
      <div className="flex-1 border-l border-luna-stroke">
        <ChatPane ws={ws} />
      </div>
      <AgentPicker ws={ws} />
      <ProviderSettings ws={ws} />
    </main>
  );
}
