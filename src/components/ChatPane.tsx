"use client";

import { useEffect, useRef, useState } from "react";
import { BotMark } from "./BotMark";
import { MessageRow } from "./MessageRow";
import { Composer } from "./Composer";
import { AgentInspector } from "./AgentInspector";
import type { Workspace } from "@/lib/useWorkspace";

export function ChatPane({ ws }: { ws: Workspace }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selected = ws.selected;
  const msgCount = selected?.messages.length ?? 0;
  const [highlight, setHighlight] = useState<string | null>(null);
  const focus = ws.messageFocus?.botId === selected?.id ? ws.messageFocus : null;

  useEffect(() => {
    if (!focus) { setHighlight(null); return; }
    const element = [...(scrollRef.current?.querySelectorAll<HTMLElement>("[data-message-id]") ?? [])]
      .find((item) => item.dataset.messageId === focus.messageId);
    if (!element) return;
    element.scrollIntoView({ block: "center", behavior: "instant" });
    setHighlight(focus.messageId);
    const timeout = window.setTimeout(() => setHighlight(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [focus]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && !focus) el.scrollTop = el.scrollHeight;
  }, [msgCount, ws.selectedId, selected?.messages[msgCount - 1]?.body, focus]);

  return (
    <div className="flex h-full min-w-0 flex-1 bg-luna-content">
      {selected ? (
        <>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-luna-stroke px-4">
              <BotMark color={selected.color} symbol={selected.symbol} size={22} />
              <button
                onClick={() => ws.openInspector(selected.id)}
                className="shrink-0 rounded px-1 py-0.5 text-sm font-medium text-luna-primary hover:bg-white/5"
                title="Open details"
              >
                {selected.name}
              </button>
              {selected.members.length > 0 && (
                <span className="min-w-0 truncate text-[12.5px] text-luna-secondary">
                  · {selected.members.join(", ")}
                </span>
              )}
            </div>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 py-6">
                {selected.messages.map((m) => (
                  <div key={m.id} data-message-id={m.id} data-highlighted={highlight === m.id || undefined}
                    >
                    <MessageRow message={m} highlighted={highlight === m.id} bots={ws.bots} onOpen={ws.openMessageReference} />
                  </div>
                ))}
                {selected.members.length > 0 && (
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={() => void ws.nudgeGroup(1)}
                      disabled={Boolean(ws.busyBots[selected.id])}
                      className="rounded-full border border-luna-stroke px-3 py-1 text-[12px] text-luna-secondary hover:text-luna-primary disabled:opacity-40"
                    >
                      Let the crew keep talking →
                    </button>
                  </div>
                )}
              </div>
            </div>

            <Composer ws={ws} />
          </div>
          {ws.inspectorBot && (
            <AgentInspector
              bot={ws.inspectorBot}
              bots={ws.bots}
              open
              onClose={ws.closeInspector}
              onSave={(update) => {
                ws.updateBotDetails(ws.inspectorBot!.id, update);
                ws.closeInspector();
              }}
            />
          )}
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center text-luna-secondary">
          Select or create a teammate
        </div>
      )}
    </div>
  );
}
