"use client";

import { useEffect, useState } from "react";
import { BotMark } from "./BotMark";
import type { Workspace } from "@/lib/useWorkspace";

export function AgentPicker({ ws }: { ws: Workspace }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"pick" | "group">("pick");
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<string[]>([]);

  useEffect(() => {
    if (!ws.pickerOpen) {
      setQuery("");
      setMode("pick");
      setGroupName("");
      setMembers([]);
    }
  }, [ws.pickerOpen]);

  if (!ws.pickerOpen) return null;

  const results = ws.bots.filter(
    (b) => b.members.length === 0 && b.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const soloBots = ws.bots.filter((b) => b.members.length === 0);

  const close = () => ws.setPickerOpen(false);

  return (
    <div
      className="absolute inset-0 z-30 flex justify-center bg-black/40 pt-16"
      onClick={close}
    >
      <div
        className="h-fit w-[560px] max-w-[92vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {mode === "pick" ? (
          <>
            <div className="flex items-center gap-2 rounded-t-[14px] border-b border-luna-stroke bg-luna-content px-4">
              <span className="text-luna-secondary">To:</span>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (results[0]) ws.openTab(results[0].id);
                    else ws.createAgent({ name: query || undefined });
                  } else if (e.key === "Escape") close();
                }}
                placeholder="Search or create agents"
                className="h-11 w-full bg-transparent text-base text-luna-primary placeholder:text-luna-secondary focus:outline-none"
              />
            </div>

            <div className="rounded-b-[14px] border border-t-0 border-luna-stroke bg-luna-content p-2 shadow-2xl">
              <Row onClick={() => ws.createAgent({ name: query || undefined })}>
                <IconCircle>+</IconCircle>
                <span className="text-luna-primary">
                  Create new agent{query ? ` “${query}”` : ""}
                </span>
              </Row>
              <Row onClick={() => setMode("group")}>
                <IconCircle>⨝</IconCircle>
                <span className="text-luna-primary">New group chat…</span>
              </Row>

              <div className="my-1 h-px bg-luna-stroke" />

              {results.map((bot) => (
                <Row key={bot.id} onClick={() => ws.openTab(bot.id)}>
                  <BotMark color={bot.color} symbol={bot.symbol} size={34} />
                  <span className="text-luna-primary">{bot.name}</span>
                  <span className="ml-auto text-[12px] text-luna-secondary">{bot.role}</span>
                </Row>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-[14px] border border-luna-stroke bg-luna-content p-4 shadow-2xl">
            <div className="mb-3 text-sm font-medium text-luna-primary">New group chat</div>
            <input
              autoFocus
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name (e.g. Offsite crew)"
              className="mb-3 h-10 w-full rounded-lg border border-luna-stroke bg-luna-elevated/60 px-3 text-sm text-luna-primary placeholder:text-luna-secondary focus:outline-none"
            />
            <div className="mb-3 text-[12.5px] text-luna-secondary">Add teammates</div>
            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {soloBots.map((bot) => {
                const on = members.includes(bot.name);
                return (
                  <button
                    key={bot.id}
                    onClick={() =>
                      setMembers((m) => (on ? m.filter((n) => n !== bot.name) : [...m, bot.name]))
                    }
                    className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left ${
                      on ? "bg-luna-selected" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <BotMark color={bot.color} symbol={bot.symbol} size={28} />
                    <span className="text-luna-primary">{bot.name}</span>
                    {on && <span className="ml-auto text-emerald-400">✓</span>}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setMode("pick")}
                className="rounded-lg px-3 py-1.5 text-sm text-luna-secondary hover:text-luna-primary"
              >
                Back
              </button>
              <button
                disabled={members.length < 2}
                onClick={() => ws.createGroup(groupName || "New group", members)}
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-black disabled:opacity-40"
              >
                Create group ({members.length})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-[52px] w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-white/[0.03]"
    >
      {children}
    </button>
  );
}

function IconCircle({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-luna-secondary">
      {children}
    </span>
  );
}
