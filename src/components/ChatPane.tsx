"use client";

import { useEffect, useRef } from "react";
import { BotMark } from "./BotMark";
import { MessageRow } from "./MessageRow";
import { Composer } from "./Composer";
import { DEFAULT_MODEL_LABEL } from "@/lib/config";
import type { Workspace } from "@/lib/useWorkspace";

export function ChatPane({ ws }: { ws: Workspace }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selected = ws.selected;
  const msgCount = selected?.messages.length ?? 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgCount, ws.selectedId, selected?.messages[msgCount - 1]?.body]);

  return (
    <div className="flex h-full flex-1 flex-col bg-luna-content">
      <TabBar ws={ws} />

      {selected ? (
        <>
          <div className="flex h-11 items-center gap-2.5 border-b border-luna-stroke px-4">
            <BotMark color={selected.color} symbol={selected.symbol} size={22} />
            <span className="text-sm font-medium text-luna-primary">{selected.name}</span>
            {selected.members.length > 0 && (
              <span className="text-[12.5px] text-luna-secondary">
                · {selected.members.join(", ")}
              </span>
            )}
            <span className="ml-auto flex items-center gap-2 text-[12px] text-luna-secondary">
              <span className="rounded-full border border-luna-stroke px-2 py-0.5">
                {DEFAULT_MODEL_LABEL}
              </span>
              {ws.live === false && (
                <span
                  className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-300"
                  title="No provider credential configured — replies come from the offline runtime."
                >
                  offline demo
                </span>
              )}
              {ws.live === true && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
                  live
                </span>
              )}
            </span>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-6">
              {selected.messages.map((m) => (
                <MessageRow key={m.id} message={m} />
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
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center text-luna-secondary">
          Select or create a teammate
        </div>
      )}
    </div>
  );
}

function TabBar({ ws }: { ws: Workspace }) {
  const tabs = ws.openTabs
    .map((id) => ws.bots.find((b) => b.id === id))
    .filter((b): b is NonNullable<typeof b> => Boolean(b));

  return (
    <div className="flex h-9 items-stretch gap-1 border-b border-luna-stroke bg-luna-window/60 px-2">
      <div className="flex flex-1 items-stretch gap-1 overflow-x-auto">
        {tabs.map((bot) => {
          const active = bot.id === ws.selectedId;
          return (
            <div
              key={bot.id}
              className={`group flex items-center gap-1.5 rounded-md px-2.5 text-[12.5px] ${
                active ? "bg-luna-content text-luna-primary" : "text-luna-secondary hover:bg-white/[0.03]"
              }`}
            >
              <button onClick={() => ws.openTab(bot.id)} className="flex items-center gap-1.5 py-1">
                <BotMark color={bot.color} symbol={bot.symbol} size={14} />
                <span className="max-w-[140px] truncate">{bot.name}</span>
              </button>
              <button
                onClick={() => ws.closeTab(bot.id)}
                className="opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={`Close ${bot.name} tab`}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
      <button
        onClick={() => ws.setPickerOpen(true)}
        className="my-1 flex w-7 items-center justify-center rounded-md text-luna-secondary hover:bg-white/[0.05] hover:text-luna-primary"
        aria-label="New tab"
        title="New tab"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
