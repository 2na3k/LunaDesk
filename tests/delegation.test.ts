import { describe, expect, it } from "vitest";
import {
  fallbackDelegationPlan,
  isDelegationRequest,
  parseDelegateToolCall,
  routeMentionDelegation,
  validateDelegationPlan,
} from "@/lib/delegation";

describe("delegation routing", () => {
  it("recognizes the Vietnamese helper request from the reported failure", () => {
    const request = "gọi tao 3 thằng đệ, mỗi thằng nhẹ nhàng làm 1 cái proposal chiều nay tao nên đi chơi ở đâu quanh sing, xong mày ensemble lại";
    expect(isDelegationRequest(request)).toBe(true);
    expect(fallbackDelegationPlan(request).agents).toHaveLength(3);
  });
  it("recognizes explicit English delegation commands", () => {
    expect(isDelegationRequest("/delegate spawn 3 agents to review this design")).toBe(true);
    expect(isDelegationRequest("Spawn 2 agents and have them debate the plan")).toBe(true);
  });

  it("recognizes numbered Vietnamese agent requests from the chat flow", () => {
    expect(
      isDelegationRequest("ok để tao Thành 1, Thành 2, Thành 3 xong bảo chúng nó chào tao"),
    ).toBe(true);
  });

  it("does not treat an ordinary creation request as delegation", () => {
    expect(isDelegationRequest("Create a concise release report for me")).toBe(false);
  });
});

describe("mention delegation routing", () => {
  it("opens a single delegate directly with no shared helper thread", () => {
    expect(routeMentionDelegation(["Mate 1"])).toEqual({
      leadName: "Mate 1",
      helperNames: [],
    });
  });

  it("makes the first mention the lead and later mentions its helpers", () => {
    expect(routeMentionDelegation(["Mate 1", "Mate 2", "Mate 3"])).toEqual({
      leadName: "Mate 1",
      helperNames: ["Mate 2", "Mate 3"],
    });
  });
});

describe("delegate_to_agent tool validation", () => {
  it("accepts only a real available agent and a concrete task", () => {
    expect(
      parseDelegateToolCall(
        "delegate_to_agent",
        { agent: "scout 1", task: "Investigate the failure" },
        ["Scout 1", "Critic 2"],
      ),
    ).toEqual({ agentName: "Scout 1", task: "Investigate the failure" });
    expect(
      parseDelegateToolCall("delegate_to_agent", { agent: "Imaginary", task: "Pretend" }, ["Scout 1"]),
    ).toBeNull();
  });
});

describe("delegation planning", () => {
  it("preserves explicit numbered names and assigns different characteristics", () => {
    const plan = fallbackDelegationPlan(
      "tạo Thành 1, Thành 2, Thành 3 rồi bảo chúng nó cùng thảo luận",
    );

    expect(plan.agents.map((agent) => agent.name)).toEqual(["Thành 1", "Thành 2", "Thành 3"]);
    expect(new Set(plan.agents.map((agent) => agent.role)).size).toBe(3);
    expect(new Set(plan.agents.map((agent) => agent.persona)).size).toBe(3);
    for (const agent of plan.agents) {
      expect(agent.persona).toContain(agent.name);
      expect(agent.persona).toContain("other agents");
    }
  });

  it("rejects a plan with fewer than two distinct agents", () => {
    const plan = validateDelegationPlan(
      {
        groupName: "Broken plan",
        task: "review",
        agents: [
          { name: "Same", role: "One", persona: "One", task: "review" },
          { name: "same", role: "Two", persona: "Two", task: "review" },
        ],
      },
      "spawn 3 agents to review",
    );

    expect(plan.agents).toHaveLength(3);
    expect(new Set(plan.agents.map((agent) => agent.name.toLowerCase())).size).toBe(3);
  });
});
