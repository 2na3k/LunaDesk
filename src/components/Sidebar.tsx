"use client";

import { BotMark } from "./BotMark";
import type { Workspace } from "@/lib/useWorkspace";

export function Sidebar({ ws }: { ws: Workspace }) {
  return (
    <div className="flex h-full w-[300px] shrink-0 flex-col bg-luna-window">
      <div className="flex h-11 items-center justify-end pr-2.5">
        <button
          onClick={() => ws.setPickerOpen(true)}
          className="flex h-6 w-6 items-center justify-center rounded text-luna-secondary hover:text-luna-primary"
          title="New agent (⌘N)"
          aria-label="New agent"
        >
          <PlusIcon />
        </button>
      </div>

      <div className="px-3.5 pb-3">
        <div className="flex h-[38px] items-center gap-2 rounded-[10px] border border-luna-stroke bg-luna-elevated/70 px-3">
          <SearchIcon />
          <input
            value={ws.searchText}
            onChange={(e) => ws.setSearchText(e.target.value)}
            placeholder="Search"
            className="w-full bg-transparent text-sm text-luna-primary placeholder:text-luna-secondary focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5">
        <div className="flex flex-col gap-0.5">
          {ws.filteredBots.map((bot) => {
            const selected = bot.id === ws.selectedId;
            return (
              <button
                key={bot.id}
                onClick={() => ws.openTab(bot.id)}
                className={`flex h-[57px] items-center gap-2.5 rounded-[11px] px-2.5 text-left transition-colors ${
                  selected ? "bg-luna-selected" : "hover:bg-white/[0.03]"
                }`}
              >
                <BotMark color={bot.color} symbol={bot.symbol} size={37} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14.5px] font-medium text-luna-primary">
                      {bot.name}
                    </span>
                    {bot.members.length > 0 && (
                      <span className="rounded bg-white/[0.06] px-1 text-[10px] text-luna-secondary">
                        {bot.members.length}
                      </span>
                    )}
                    <span className="ml-auto shrink-0 text-[12.5px] text-luna-secondary">
                      {bot.timestamp}
                    </span>
                  </div>
                  <div className="truncate text-[13px] text-luna-secondary">{bot.preview}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => ws.setSettingsOpen(true)}
        className="flex h-[61px] items-center gap-2.5 px-4 hover:bg-white/[0.02]"
        title="Providers & settings"
      >
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-medium text-luna-secondary">
          AS
        </span>
        <span className="text-sm font-medium text-luna-primary">Armand Segall</span>
        <span className="ml-auto text-luna-secondary">
          <GearIcon />
        </span>
      </button>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7a7a80" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
