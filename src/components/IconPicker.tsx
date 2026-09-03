"use client";

import { BotMark } from "./BotMark";
import type { BotSymbol } from "@/lib/types";

export const BOT_ICON_COLORS = [
  "#7DD3C7",
  "#F6A76B",
  "#F08A9B",
  "#8EAFF7",
  "#B69AF4",
  "#F2CF70",
] as const;

export const BOT_ICON_SHAPES: BotSymbol[] = [
  "circle",
  "capsule",
  "triangle",
  "diamond",
  "hexagon",
];

export function IconPicker({
  color,
  symbol,
  onColorChange,
  onSymbolChange,
}: {
  color: string;
  symbol: BotSymbol;
  onColorChange: (color: string) => void;
  onSymbolChange: (symbol: BotSymbol) => void;
}) {
  return (
    <fieldset className="mb-5">
      <legend className="text-[11px] uppercase tracking-wide text-luna-secondary">Icon</legend>

      <div className="mt-2 flex justify-center py-2">
        <BotMark color={color} symbol={symbol} size={70} />
      </div>

      <div className="mt-2 grid grid-cols-5 gap-2" aria-label="Icon shape">
        {BOT_ICON_SHAPES.map((shape) => {
          const selected = shape === symbol;
          return (
            <button
              key={shape}
              type="button"
              onClick={() => onSymbolChange(shape)}
              className={`flex h-12 items-center justify-center rounded-xl border transition-colors ${
                selected
                  ? "border-white/35 bg-white/10"
                  : "border-transparent bg-white/[0.035] hover:bg-white/[0.07]"
              }`}
              aria-label={`${shape} icon`}
              aria-pressed={selected}
              title={shape}
            >
              <BotMark color={color} symbol={shape} size={30} />
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-6 gap-2" aria-label="Icon color">
        {BOT_ICON_COLORS.map((option) => {
          const selected = option.toLocaleLowerCase() === color.toLocaleLowerCase();
          return (
            <button
              key={option}
              type="button"
              onClick={() => onColorChange(option)}
              className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full border transition-transform hover:scale-105 ${
                selected ? "border-white/60" : "border-transparent"
              }`}
              aria-label={`Use color ${option}`}
              aria-pressed={selected}
              title={option}
            >
              <span
                className="block h-7 w-7 rounded-full"
                style={{ backgroundColor: option }}
              />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
