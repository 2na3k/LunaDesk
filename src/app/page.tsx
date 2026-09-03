"use client";

import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatPane } from "@/components/ChatPane";
import { AgentPicker } from "@/components/AgentPicker";
import { ProviderSettings } from "@/components/ProviderSettings";
import { useWorkspace } from "@/lib/useWorkspace";

export default function Home() {
  const ws = useWorkspace();

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
