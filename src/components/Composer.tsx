"use client";

import { useEffect, useRef, useState } from "react";
import { activeMentionQuery, insertMention } from "@/lib/mentions";
import type { Workspace } from "@/lib/useWorkspace";

export function Composer({ ws }: { ws: Workspace }) {
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const busy = ws.selected ? Boolean(ws.busyBots[ws.selected.id]) : false;

  useEffect(() => {
    ref.current?.focus();
  }, [ws.selectedId]);

  const send = () => {
    const text = draft;
    if (!text.trim() || busy) return;
    setDraft("");
    void ws.sendMessage(text);
  };

  const name = ws.selected?.name ?? "teammate";
  const mentionQuery = activeMentionQuery(draft);
  const mentionCandidates = mentionQuery === null
    ? []
    : ws.bots
        .filter((bot) => bot.members.length === 0 && bot.id !== ws.selectedId)
        .filter((bot) => bot.name.toLowerCase().includes(mentionQuery.trim().toLowerCase()))
        .slice(0, 6);

  useEffect(() => setMentionIndex(0), [mentionQuery]);

  const chooseMention = (agentName: string) => {
    setDraft((current) => insertMention(current, agentName));
    ref.current?.focus();
  };

  return (
    <div className="relative px-6 pb-5 pt-2">
      {mentionCandidates.length > 0 && (
        <div className="absolute bottom-[72px] left-10 z-20 min-w-56 overflow-hidden rounded-xl border border-luna-stroke bg-[#292929] p-1 shadow-2xl">
          {mentionCandidates.map((agent, index) => (
            <button
              key={agent.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseMention(agent.name)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                index === mentionIndex ? "bg-white/10 text-luna-primary" : "text-luna-secondary hover:bg-white/5"
              }`}
            >
              <span>@{agent.name}</span>
              <span className="ml-5 text-xs opacity-60">{agent.role}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex min-h-[48px] items-center gap-2.5 rounded-[24px] border border-luna-stroke bg-black/[0.15] px-2.5">
        <button
          onClick={() => ws.setPickerOpen(true)}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/[0.05] text-luna-secondary hover:text-luna-primary"
          aria-label="New agent"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </button>

        <textarea
          ref={ref}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (mentionCandidates.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              e.preventDefault();
              setMentionIndex((current) =>
                e.key === "ArrowDown"
                  ? (current + 1) % mentionCandidates.length
                  : (current - 1 + mentionCandidates.length) % mentionCandidates.length,
              );
              return;
            }
            if (mentionCandidates.length > 0 && (e.key === "Enter" || e.key === "Tab")) {
              e.preventDefault();
              chooseMention(mentionCandidates[mentionIndex].name);
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder={`Message ${name}`}
          className="max-h-28 flex-1 resize-none bg-transparent py-3 text-[14.5px] text-luna-primary placeholder:text-luna-secondary focus:outline-none"
        />

        <button
          onClick={() => (draft.trim() ? send() : setRecording((r) => !r))}
          disabled={busy}
          className={`flex h-[34px] w-[34px] items-center justify-center rounded-full text-black disabled:opacity-40 ${
            recording && !draft.trim() ? "bg-red-500" : "bg-white"
          }`}
          aria-label={draft.trim() ? "Send message" : recording ? "Stop recording" : "Start recording"}
        >
          {draft.trim() ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : recording ? (
            <span className="h-3 w-3 rounded-[2px] bg-black" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3z" />
              <path d="M19 12a7 7 0 0 1-14 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 19v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
