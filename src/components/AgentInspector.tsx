"use client";

import { useEffect, useState } from "react";
import { IconPicker } from "./IconPicker";
import type { BotMetadataUpdate } from "@/lib/bot-metadata";
import type { Bot, BotSymbol } from "@/lib/types";

export function AgentInspector({
  bot,
  bots,
  open,
  onClose,
  onSave,
}: {
  bot: Bot;
  bots: Bot[];
  open: boolean;
  onClose: () => void;
  onSave: (update: BotMetadataUpdate) => void;
}) {
  const [name, setName] = useState(bot.name);
  const [label, setLabel] = useState(bot.role);
  const [description, setDescription] = useState(bot.persona);
  const [color, setColor] = useState(bot.color);
  const [symbol, setSymbol] = useState<BotSymbol>(bot.symbol);

  useEffect(() => {
    if (!open) return;
    setName(bot.name);
    setLabel(bot.role);
    setDescription(bot.persona);
    setColor(bot.color);
    setSymbol(bot.symbol);
  }, [bot.color, bot.id, bot.name, bot.persona, bot.role, bot.symbol, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open) return null;

  const duplicate = bots.some(
    (candidate) =>
      candidate.id !== bot.id && candidate.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
  );

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-luna-stroke bg-[#222]" aria-label={`${bot.name} details`}>
      <div className="flex h-11 shrink-0 items-center px-4">
        <span className="text-sm font-medium text-luna-primary">
          {bot.members.length > 0 ? "Chat details" : "Agent details"}
        </span>
        <button onClick={onClose} className="ml-auto rounded px-2 py-1 text-lg text-luna-secondary hover:bg-white/5 hover:text-luna-primary" aria-label="Close side panel">×</button>
      </div>

      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim() || duplicate) return;
          onSave({ name, label, description, color, symbol });
        }}
      >
        <div className="flex-1 overflow-y-auto p-4">
          <IconPicker
            color={color}
            symbol={symbol}
            onColorChange={setColor}
            onSymbolChange={setSymbol}
          />
          <label className="mb-4 block text-[11px] uppercase tracking-wide text-luna-secondary">
            Name
            <input autoFocus value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-luna-stroke bg-black/20 px-3 text-sm normal-case tracking-normal text-luna-primary outline-none focus:border-white/20" />
          </label>
          <label className="mb-4 block text-[11px] uppercase tracking-wide text-luna-secondary">
            Label
            <input value={label} onChange={(event) => setLabel(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-luna-stroke bg-black/20 px-3 text-sm normal-case tracking-normal text-luna-primary outline-none focus:border-white/20" />
          </label>
          <label className="block text-[11px] uppercase tracking-wide text-luna-secondary">
            Description / system prompt
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={13} className="mt-1.5 w-full resize-none rounded-lg border border-luna-stroke bg-black/20 px-3 py-2.5 text-sm normal-case leading-5 tracking-normal text-luna-primary outline-none focus:border-white/20" />
          </label>
          {duplicate && <div className="mt-2 text-xs text-red-300">Another agent or chat already uses this name.</div>}
          {bot.members.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-luna-secondary">Members</div>
              <div className="flex flex-wrap gap-1.5">
                {bot.members.map((member) => <span key={member} className="rounded-full bg-white/5 px-2 py-1 text-xs text-luna-secondary">@{member}</span>)}
              </div>
            </div>
          )}
        </div>
        <div className="flex shrink-0 justify-end gap-2 p-3">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-luna-secondary hover:text-luna-primary">Cancel</button>
          <button type="submit" disabled={!name.trim() || duplicate} className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-black disabled:opacity-40">Save</button>
        </div>
      </form>
    </aside>
  );
}
