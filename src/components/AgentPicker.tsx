"use client";

import { useEffect, useState } from "react";
import { BotMark } from "./BotMark";
import type { Workspace } from "@/lib/useWorkspace";

export function AgentPicker({ ws }: { ws: Workspace }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"pick" | "create" | "group">("pick");
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [agentName, setAgentName] = useState("");
  const [agentRole, setAgentRole] = useState("");
  const [agentPersona, setAgentPersona] = useState("");

  useEffect(() => {
    if (ws.pickerOpen && ws.needsDefaultAgentSetup) {
      setMode("create");
      setAgentName("Default Agent");
      setAgentRole("Your general-purpose AI teammate.");
      setAgentPersona("");
    } else if (!ws.pickerOpen) {
      setQuery("");
      setMode("pick");
      setGroupName("");
      setMembers([]);
      setAgentName("");
      setAgentRole("");
      setAgentPersona("");
    }
  }, [ws.pickerOpen, ws.needsDefaultAgentSetup]);

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
                    else setMode("create");
                  } else if (e.key === "Escape") close();
                }}
                placeholder="Search or create agents"
                className="h-11 w-full bg-transparent text-base text-luna-primary placeholder:text-luna-secondary focus:outline-none"
              />
            </div>

            <div className="rounded-b-[14px] border border-t-0 border-luna-stroke bg-luna-content p-2 shadow-2xl">
              <Row onClick={() => { setAgentName(query); setMode("create"); }}>
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
        ) : mode === "create" ? (
          <form
            className="rounded-[14px] border border-luna-stroke bg-luna-content p-4 shadow-2xl"
            onSubmit={(e) => {
              e.preventDefault();
              if (!agentName.trim()) return;
              if (ws.needsDefaultAgentSetup) {
                ws.configureDefaultAgent({ name: agentName, role: agentRole, persona: agentPersona });
              } else {
                ws.createAgent({ name: agentName, role: agentRole, persona: agentPersona });
              }
            }}
          >
            <div className="mb-1 text-sm font-medium text-luna-primary">
              {ws.needsDefaultAgentSetup ? "Set up your default agent" : "Create agent"}
            </div>
            <div className="mb-3 text-[12.5px] text-luna-secondary">
              {ws.needsDefaultAgentSetup
                ? "Choose its name, role, and working prompt. You can change this later."
                : "Give your teammate a name and a clear job to do."}
            </div>
            <label className="mb-2 block text-[12px] text-luna-secondary">
              Name
              <input autoFocus value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="e.g. Researcher" className="mt-1 h-10 w-full rounded-lg border border-luna-stroke bg-luna-elevated/60 px-3 text-sm text-luna-primary placeholder:text-luna-secondary focus:outline-none" />
            </label>
            <label className="mb-2 block text-[12px] text-luna-secondary">
              Label
              <input value={agentRole} onChange={(e) => setAgentRole(e.target.value)} placeholder="Short role label" className="mt-1 h-10 w-full rounded-lg border border-luna-stroke bg-luna-elevated/60 px-3 text-sm text-luna-primary placeholder:text-luna-secondary focus:outline-none" />
            </label>
            <label className="block text-[12px] text-luna-secondary">
              Description / system prompt
              <textarea value={agentPersona} onChange={(e) => setAgentPersona(e.target.value)} placeholder="Describe how this agent should think, speak, and work…" rows={4} className="mt-1 w-full resize-none rounded-lg border border-luna-stroke bg-luna-elevated/60 px-3 py-2 text-sm text-luna-primary placeholder:text-luna-secondary focus:outline-none" />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              {ws.needsDefaultAgentSetup ? (
                <button type="button" onClick={() => ws.configureDefaultAgent()} className="rounded-lg px-3 py-1.5 text-sm text-luna-secondary hover:text-luna-primary">Use default</button>
              ) : (
                <button type="button" onClick={() => setMode("pick")} className="rounded-lg px-3 py-1.5 text-sm text-luna-secondary hover:text-luna-primary">Back</button>
              )}
              <button type="submit" disabled={!agentName.trim()} className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-black disabled:opacity-40">
                {ws.needsDefaultAgentSetup ? "Start with this agent" : "Create agent"}
              </button>
            </div>
          </form>
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
