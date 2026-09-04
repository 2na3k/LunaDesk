const { chromium } = require("playwright");
const assert = require("node:assert/strict");

// Isolated browser workspace + mocked model SSE; no user data or provider calls.
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    const model = { provider: "openai", model: "gpt-5", reasoning: "low" };
    let saved = { model, agentSetupComplete: true, bots: [{ id: "lead", name: "Lead", role: "Coordinator", persona: "Coordinate real helpers", members: [], messages: [], preview: "Ready", timestamp: "Now", color: "#4fd1a5", symbol: "circle" }] };
    await page.route("**/api/providers", (route) => route.fulfill({ json: { providers: [{ id: "openai", name: "Test provider", configured: true }] } }));
    await page.route("**/api/workspace", (route) => {
      if (route.request().method() === "POST") saved = route.request().postDataJSON();
      return route.fulfill({ json: route.request().method() === "POST" ? { ok: true } : { workspace: saved } });
    });
    let releaseWorker;
    const workerGate = new Promise((resolve) => { releaseWorker = resolve; });
    const requests = [];
    await page.route("**/api/chat", async (route) => {
      const req = route.request().postDataJSON();
      requests.push(req);
      const events = [{ type: "meta", live: true, runtime: "test" }];
      if (req.botName === "Lead" && !req.continuation.length) {
        const tool = { id: "spawn-call", name: "spawn_agents", arguments: { update: "I’m asking the three helpers for independent proposals; I’ll compare their replies when they finish.", agents: [1, 2, 3].map((n) => ({ name: `Helper ${n}`, role: "Research", persona: "Make an independent proposal", task: `Make proposal ${n}` })) } };
        events.push({ type: "tool_call", toolCallId: tool.id, toolName: tool.name, arguments: tool.arguments });
        events.push({ type: "assistant_message", assistantMessage: { role: "assistant", content: [{ type: "toolCall", ...tool }], api: "openai-responses", provider: "openai", model: "test", stopReason: "toolUse", timestamp: 1 } });
      } else if (req.botName === "Lead") {
        const result = req.continuation.find((message) => message.role === "toolResult");
        assert.equal(result.toolCallId, "spawn-call");
        assert.equal(JSON.parse(result.content[0].text).results.length, 3);
        events.push({ type: "delta", delta: "Combined three actual helper proposals." });
      } else {
        if (req.botName === "Helper 1") await workerGate;
        events.push({ type: "delta", delta: `${req.botName} actual proposal` });
      }
      events.push({ type: "done" });
      await route.fulfill({ contentType: "text/event-stream", body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") });
    });
    await page.goto(process.env.BASE_URL || "http://127.0.0.1:3117");
    await page.getByPlaceholder("Message Lead").fill("gọi tao 3 thằng đệ, mỗi thằng nhẹ nhàng làm 1 cái proposal chiều nay tao nên đi chơi ở đâu quanh sing, xong mày ensemble lại");
    await page.getByRole("button", { name: "Send message", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "I’m asking the three helpers" }).waitFor();
    const sentLink = () => page.locator("[data-message-id]").filter({ hasText: "Sent work to @Helper 1 in its own chat." }).getByRole("button", { name: "@Helper 1", exact: true });
    await sentLink().click();
    await page.getByPlaceholder("Message Helper 1").waitFor();
    await page.locator('[data-highlighted="true"]').waitFor();
    releaseWorker();
    await page.getByText("Helper 1 actual proposal", { exact: true }).last().waitFor();
    await page.getByRole("button", { name: /^Lead Now/ }).click();
    await page.getByText("Combined three actual helper proposals.", { exact: true }).last().waitFor();
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem("lunadesk.workspace.v1")));
    assert.equal(state.bots.length, 4);
    assert.equal(requests.length, 5);
    for (let n = 1; n <= 3; n++) {
      const bot = state.bots.find((item) => item.name === `Helper ${n}`);
      assert.equal(bot.messages.length, 3);
      assert.ok(bot.messages.some((message) => message.sender.name === "Lead" && message.body === `Make proposal ${n}`));
      assert.ok(bot.messages.some((message) => message.sender.name === bot.name && message.body === `${bot.name} actual proposal` && !message.pending));
    }
    assert.equal(await page.getByPlaceholder("Message Lead").count(), 1);
    const lead = state.bots.find((bot) => bot.id === "lead");
    const sent = lead.messages.find((message) => message.body === "Sent work to @Helper 1 in its own chat.");
    const replyId = state.bots.find((bot) => bot.name === "Helper 1").messages.at(-1).id;
    assert.equal(sent.links[0].messageId, replyId);
    assert.ok(lead.messages.some((message) => message.activity === "complete" && message.body === "I’m asking the three helpers for independent proposals; I’ll compare their replies when they finish."));
    assert.ok(!lead.messages.some((message) => message.body.includes("The organized result is below")));
    await sentLink().click();
    await page.getByPlaceholder("Message Helper 1").waitFor();
    assert.equal(await page.locator('[data-highlighted="true"]').getAttribute("data-message-id"), replyId);
    await page.screenshot({ path: "/tmp/lunadesk-delegation-smoke.png" });
    await page.getByRole("button", { name: /^Lead Now/ }).click();
    await page.reload();
    await page.getByText("Combined three actual helper proposals.", { exact: true }).last().waitFor();
    assert.equal(saved.bots.length, 4);
    console.log("PASS: Vietnamese request -> 3 independent chats + attributed worker messages -> native tool results -> coordinator synthesis -> reload persistence.");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
