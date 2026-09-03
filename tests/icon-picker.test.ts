import { describe, expect, it } from "vitest";
import { BOT_ICON_COLORS, BOT_ICON_SHAPES } from "@/components/IconPicker";

describe("icon picker options", () => {
  it("offers exactly six colors and five shapes", () => {
    expect(BOT_ICON_COLORS).toHaveLength(6);
    expect(new Set(BOT_ICON_COLORS).size).toBe(6);
    expect(BOT_ICON_SHAPES).toHaveLength(5);
    expect(new Set(BOT_ICON_SHAPES).size).toBe(5);
  });
});
