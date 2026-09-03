import { describe, expect, it } from "vitest";
import { activeMentionQuery, findMentionedAgents, insertMention } from "@/lib/mentions";
import type { Bot } from "@/lib/types";

function agent(name: string, members: string[] = []): Bot {
  return {
    id: name,
    name,
    role: `${name} role`,
    persona: `${name} persona`,
    preview: "",
    timestamp: "Now",
    color: "#fff",
    symbol: "circle",
    messages: [],
    members,
  };
}

const bots = [agent("Scout 1"), agent("Critic 2"), agent("Builder 3"), agent("Team", ["Scout 1"])];

describe("agent mentions", () => {
  it("resolves exact existing agents in mention order", () => {
    expect(findMentionedAgents("ask @Critic 2 then @Builder 3", bots).map((bot) => bot.name)).toEqual([
      "Critic 2",
      "Builder 3",
    ]);
  });

  it("does not guess unknown or partial agent names", () => {
    expect(findMentionedAgents("tell @Critic 1 to reply", bots)).toEqual([]);
    expect(findMentionedAgents("tell @Critic to reply", bots)).toEqual([]);
  });

  it("exposes and inserts an active composer mention", () => {
    expect(activeMentionQuery("tell @Cri")).toBe("Cri");
    expect(insertMention("tell @Cri", "Critic 2")).toBe("tell @Critic 2 ");
    expect(activeMentionQuery("tell @Critic 2 ")).toBeNull();
  });
});
