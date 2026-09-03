import { describe, expect, it } from "vitest";
import { updateBotMetadata } from "@/lib/bot-metadata";
import type { Bot } from "@/lib/types";

function bot(id: string, name: string, members: string[] = []): Bot {
  return {
    id,
    name,
    role: "Old label",
    persona: "Old description",
    preview: "",
    timestamp: "Earlier",
    color: "#fff",
    symbol: "circle",
    members,
    messages: [
      { id: `${id}-message`, sender: { kind: "bot", name: "Scout" }, body: "Finding" },
    ],
  };
}

describe("bot metadata updates", () => {
  it("renames an agent across group membership and transcript attribution", () => {
    const updated = updateBotMetadata(
      [bot("agent", "Scout"), bot("group", "Crew", ["Scout"])],
      "agent",
      {
        name: "Researcher",
        label: "Evidence lead",
        description: "Verify every claim.",
        color: "#7DD3C7",
        symbol: "hexagon",
      },
    );

    expect(updated[0]).toMatchObject({
      name: "Researcher",
      role: "Evidence lead",
      persona: "Verify every claim.",
      color: "#7DD3C7",
      symbol: "hexagon",
    });
    expect(updated[1].members).toEqual(["Researcher"]);
    expect(updated[1].messages[0].sender).toEqual({ kind: "bot", name: "Researcher" });
  });

  it("rejects a duplicate name", () => {
    const original = [bot("one", "Scout"), bot("two", "Builder")];
    expect(updateBotMetadata(original, "one", { name: "builder" })).toBe(original);
  });
});
