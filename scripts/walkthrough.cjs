// Drives the real LunaDesk UI in a browser to capture walkthrough artifacts.
const { chromium } = require("playwright");
const path = require("node:path");

const OUT = "/opt/cursor/artifacts";
const BASE = process.env.BASE_URL || "http://localhost:3000";

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name) });
  console.log("shot:", name);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1300, height: 840 },
    deviceScaleFactor: 2,
    recordVideo: { dir: "/tmp/luna-video", size: { width: 1300, height: 840 } },
  });
  const page = await context.newPage();

  // 1. Home / initial workspace (seeded with sample teammates + Offsite crew group).
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot(page, "01_home.png");

  // 2. Open a single teammate and send a message → streamed reply.
  await page.getByRole("button", { name: /Sales Outbound/ }).first().click();
  await page.waitForTimeout(400);
  const composer = page.getByPlaceholder(/Message /);
  await composer.click();
  await composer.fill("draft 3 punchy cold emails for Acme Corp");
  await composer.press("Enter");
  await page.waitForTimeout(2500);
  await shot(page, "02_single_chat_reply.png");

  // 3. Spawn a brand-new bot as a new tab via the agent picker.
  await page.keyboard.press("Meta+n");
  await page.waitForTimeout(400);
  const pickerInput = page.getByPlaceholder("Search or create agents");
  await pickerInput.fill("Growth Hacker");
  await shot(page, "03_agent_picker.png");
  await pickerInput.press("Enter");
  await page.waitForTimeout(600);
  const composer2 = page.getByPlaceholder(/Message /);
  await composer2.click();
  await composer2.fill("what can you do for our signups?");
  await composer2.press("Enter");
  await page.waitForTimeout(2200);
  await shot(page, "04_new_bot_tab.png");

  // 4. Open the group chat and let the bots converse with each other.
  await page.getByRole("button", { name: /Offsite crew/ }).first().click();
  await page.waitForTimeout(500);
  const composer3 = page.getByPlaceholder(/Message /);
  await composer3.click();
  await composer3.fill("what's the single most important follow-up this week?");
  await composer3.press("Enter");
  // group: each member replies in turn
  await page.waitForTimeout(6000);
  await shot(page, "05_group_chat.png");

  // let the crew keep talking amongst themselves
  await page.getByRole("button", { name: /keep talking/ }).click();
  await page.waitForTimeout(7000);
  await shot(page, "06_group_bot_to_bot.png");

  // 5. Provider / LLM settings screen with the Codex sign-in.
  await page.getByRole("button", { name: /Armand Segall/ }).click();
  await page.waitForTimeout(1200);
  await shot(page, "07_provider_settings.png");

  await context.close();
  await browser.close();

  // Rename the recorded video to a descriptive name.
  const fs = require("node:fs");
  const files = fs.readdirSync("/tmp/luna-video").filter((f) => f.endsWith(".webm"));
  if (files[0]) {
    fs.copyFileSync(
      path.join("/tmp/luna-video", files[0]),
      path.join(OUT, "lunadesk_walkthrough.webm"),
    );
    console.log("video: lunadesk_walkthrough.webm");
  }
  console.log("done");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
