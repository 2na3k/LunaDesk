"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_MODEL, type ModelSelection } from "./config";
import { newId, sampleBots } from "./sample-data";
import { streamChat, toTurns, type AgentToolCall } from "./client";
import { isDelegationRequest, parseDelegateToolCall, requestDelegationPlan, routeMentionDelegation } from "./delegation";
import { findMentionedAgents } from "./mentions";
import { updateBotMetadata, type BotMetadataUpdate } from "./bot-metadata";
import type { Bot, ChatMessage } from "./types";

const STORAGE_KEY = "lunadesk.workspace.v1";
const LEGACY_SAMPLE_NAMES = new Set([
  "Chief",
  "Sales Outbound",
  "Inbox Manager",
  "Account Manager",
  "Talent Scout",
  "Expense Manager",
  "Offsite crew",
]);
const DELEGATE_COLORS = ["#4fd1a5", "#e8873a", "#5b8def", "#9b6ce0", "#e05b8d"];

interface Persisted {
  bots: Bot[];
  model: ModelSelection;
  agentSetupComplete?: boolean;
}

function nowLabel(): string {
  return "Now";
}

function migrateBots(bots: Bot[] | undefined): Bot[] {
  // The first release persisted a sample crew. Treat that data as seed data so
  // existing installs get the same single-agent starting workspace as new ones.
  if (!bots?.length || bots.some((bot) => LEGACY_SAMPLE_NAMES.has(bot.name))) return sampleBots();
  return bots;
}

export function useWorkspace() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inspectorBotId, setInspectorBotId] = useState<string | null>(null);
  const [model, setModel] = useState<ModelSelection>(DEFAULT_MODEL);
  const [live, setLive] = useState<boolean | null>(null);
  const [busyBots, setBusyBots] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);
  const [agentSetupComplete, setAgentSetupComplete] = useState(true);

  // Load persisted state (or seed with sample data).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
    let initial: Bot[];
    let initialModel = DEFAULT_MODEL;
    let initialSetupComplete = false;
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      try {
        const response = await fetch("/api/workspace", { cache: "no-store" });
        if (response.ok) {
          const body = (await response.json()) as { workspace?: Persisted | null };
          if (body.workspace) raw = JSON.stringify(body.workspace);
        }
      } catch {
        // localStorage remains a useful development/offline fallback.
      }
      if (raw) {
        const parsed = JSON.parse(raw) as Persisted;
        initial = migrateBots(parsed.bots);
        initialModel = parsed.model ?? DEFAULT_MODEL;
        const hadLegacySeed = parsed.bots?.some((bot) => LEGACY_SAMPLE_NAMES.has(bot.name));
        initialSetupComplete = parsed.agentSetupComplete ?? !hadLegacySeed;
      } else {
        initial = sampleBots();
      }
    } catch {
      initial = sampleBots();
    }
    if (cancelled) return;
    setBots(initial);
    setModel(initialModel);
    setAgentSetupComplete(initialSetupComplete);
    const last = initial[initial.length - 1];
    if (last) {
      setSelectedId(last.id);
      setOpenTabs([last.id]);
    }
    setReady(true);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist.
  useEffect(() => {
    if (!ready) return;
    try {
      const workspace = { bots, model, agentSetupComplete } satisfies Persisted;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
      void fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workspace),
      }).catch(() => {
        // localStorage already holds the same state for this server origin.
      });
    } catch {
      // ignore quota errors
    }
  }, [bots, model, agentSetupComplete, ready]);

  const selected = useMemo(() => bots.find((b) => b.id === selectedId) ?? null, [bots, selectedId]);
  const inspectorBot = useMemo(
    () => bots.find((bot) => bot.id === inspectorBotId) ?? null,
    [bots, inspectorBotId],
  );

  const filteredBots = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const filtered = !q ? bots : bots.filter(
      (b) => b.name.toLowerCase().includes(q) || b.preview.toLowerCase().includes(q),
    );
    return filtered
      .map((bot, index) => ({ bot, index }))
      .sort((a, b) => Number(Boolean(b.bot.pinned)) - Number(Boolean(a.bot.pinned)) || a.index - b.index)
      .map(({ bot }) => bot);
  }, [bots, searchText]);

  const openTab = useCallback((id: string) => {
    setSelectedId(id);
    setInspectorBotId(null);
    setOpenTabs((tabs) => (tabs.includes(id) ? tabs : [...tabs, id]));
    setPickerOpen(false);
  }, []);

  const closeTab = useCallback(
    (id: string) => {
      setOpenTabs((tabs) => {
        const next = tabs.filter((t) => t !== id);
        setSelectedId((cur) => {
          if (cur !== id) return cur;
          const idx = tabs.indexOf(id);
          return next[Math.min(idx, next.length - 1)] ?? next[0] ?? null;
        });
        return next;
      });
    },
    [],
  );

  const patchBot = useCallback((id: string, fn: (b: Bot) => Bot) => {
    setBots((prev) => prev.map((b) => (b.id === id ? fn(b) : b)));
  }, []);

  const appendMessage = useCallback(
    (botId: string, msg: ChatMessage) => {
      patchBot(botId, (b) => ({
        ...b,
        messages: [...b.messages.filter((m) => m.body !== "No recent messages." || m.sender.kind !== "system"), msg],
        preview: msg.sender.kind === "system" ? b.preview : msg.body.split("\n")[0],
        timestamp: nowLabel(),
      }));
    },
    [patchBot],
  );

  const setMessagePartial = useCallback(
    (botId: string, msgId: string, updater: (m: ChatMessage) => ChatMessage) => {
      setBots((prev) =>
        prev.map((b) =>
          b.id === botId
            ? { ...b, messages: b.messages.map((m) => (m.id === msgId ? updater(m) : m)) }
            : b,
        ),
      );
    },
    [],
  );

  /** Generate one bot reply into a bot's transcript, streaming deltas in. */
  const generateReply = useCallback(
    async (
      botId: string,
      speaker: { name: string; persona: string },
      peers: string[] | undefined,
      historyBotId?: string,
      historyOverride?: ReturnType<typeof toTurns>,
    ) => {
      const sourceId = historyBotId ?? botId;
      const pendingId = newId("msg");
      appendMessage(botId, {
        id: pendingId,
        sender: { kind: "bot", name: speaker.name },
        body: "",
        pending: true,
      });
      setBusyBots((m) => ({ ...m, [botId]: true }));

      // Read the freshest transcript synchronously via a functional read.
      let history = historyOverride ?? ([] as ReturnType<typeof toTurns>);
      let foundSource = Boolean(historyOverride);
      if (!historyOverride) {
        await new Promise<void>((resolve) => {
          setBots((prev) => {
            const src = prev.find((b) => b.id === sourceId);
            if (src) {
              foundSource = true;
              history = toTurns(src.messages.filter((m) => m.id !== pendingId));
            }
            resolve();
            return prev;
          });
        });
      }
      if (!foundSource) {
        setBusyBots((current) => ({ ...current, [botId]: false }));
        return;
      }

      let acc = "";
      await streamChat(
        { persona: speaker.persona, botName: speaker.name, history, model, peers },
        {
          onMeta: (meta) => setLive(meta.live),
          onDelta: (delta) => {
            acc += delta;
            setMessagePartial(botId, pendingId, (m) => ({ ...m, body: acc }));
          },
          onDone: () => {
            setMessagePartial(botId, pendingId, (m) => ({ ...m, pending: false }));
            patchBot(botId, (b) => ({ ...b, preview: acc.split("\n")[0] || b.preview, timestamp: nowLabel() }));
          },
          onError: (err) => {
            setMessagePartial(botId, pendingId, (m) => ({
              ...m,
              pending: false,
              body: acc || `⚠️ ${err}`,
            }));
          },
        },
      );
      setBusyBots((m) => ({ ...m, [botId]: false }));
      return acc;
    },
    [appendMessage, setMessagePartial, patchBot, model],
  );

  /** Run an agent turn for orchestration without placing the intermediate text in a chat. */
  const generateHiddenReply = useCallback(
    async (speaker: { name: string; persona: string }, history: ReturnType<typeof toTurns>) => {
      let acc = "";
      await streamChat(
        { persona: speaker.persona, botName: speaker.name, history, model },
        {
          onMeta: (meta) => setLive(meta.live),
          onDelta: (delta) => {
            acc += delta;
          },
          onError: () => {
            // The caller falls back to the original instruction when no request is produced.
          },
        },
      );
      return acc;
    },
    [model],
  );

  /** Let the model decide whether to answer directly or invoke real teammate tools. */
  const generateToolAwareReply = useCallback(
    async (target: Bot, instruction: string) => {
      const availableAgents = bots
        .filter((bot) => bot.id !== target.id && bot.members.length === 0)
        .map((bot) => ({ name: bot.name, role: bot.role }));
      const history = [
        ...toTurns(target.messages),
        { role: "user" as const, name: "You", content: instruction },
      ];
      const calls: AgentToolCall[] = [];
      let directAnswer = "";
      let requestError = "";
      setBusyBots((current) => ({ ...current, [target.id]: true }));
      await streamChat(
        {
          persona: target.persona,
          botName: target.name,
          history,
          model,
          availableAgents,
        },
        {
          onMeta: (meta) => setLive(meta.live),
          onDelta: (delta) => {
            directAnswer += delta;
          },
          onToolCall: (call) => calls.push(call),
          onError: (error) => {
            requestError = error;
          },
        },
      );

      const availableNames = availableAgents.map((agent) => agent.name);
      const invocations = calls
        .map((call) => parseDelegateToolCall(call.name, call.arguments, availableNames))
        .filter((call): call is NonNullable<typeof call> => Boolean(call));

      if (invocations.length === 0) {
        appendMessage(target.id, {
          id: newId("msg"),
          sender: { kind: "bot", name: target.name },
          body: directAnswer.trim() || `⚠️ ${requestError || "The agent returned no answer."}`,
        });
        setBusyBots((current) => ({ ...current, [target.id]: false }));
        return;
      }

      appendMessage(target.id, {
        id: newId("msg"),
        sender: { kind: "system" },
        body: `Called delegate_to_agent → ${invocations.map((call) => `@${call.agentName}`).join(", ")}.`,
      });

      const toolResults: Array<{ agent: Bot; task: string; answer: string }> = [];
      for (const invocation of invocations) {
        const agent = bots.find((bot) => bot.name === invocation.agentName);
        if (!agent) continue;
        appendMessage(agent.id, {
          id: newId("msg"),
          sender: { kind: "bot", name: target.name },
          body: invocation.task,
        });
        const answer = await generateReply(
          agent.id,
          {
            name: agent.name,
            persona: `${agent.persona}\n\n${target.name} invoked you through delegate_to_agent. Complete the delegated task now; your actual answer will be returned to ${target.name}.`,
          },
          undefined,
          agent.id,
          [
            ...toTurns(agent.messages),
            { role: "assistant", name: target.name, content: invocation.task },
          ],
        );
        toolResults.push({
          agent,
          task: invocation.task,
          answer: answer?.trim() || `${agent.name} returned no answer.`,
        });
      }

      setBusyBots((current) => ({ ...current, [target.id]: false }));
      await generateReply(
        target.id,
        {
          name: target.name,
          persona: `${target.persona}\n\nYou invoked delegate_to_agent and now have the real tool results. Answer the user using those results. Never invent additional agent output.`,
        },
        undefined,
        target.id,
        [
          ...history,
          ...toolResults.map(({ agent, task, answer }) => ({
            role: "system" as const,
            content: `delegate_to_agent result from ${agent.name} for ${JSON.stringify(task)}:\n${answer}`,
          })),
        ],
      );
    },
    [appendMessage, bots, generateReply, model],
  );

  const spawnAndDelegate = useCallback(
    async (coordinator: Bot, instruction: string) => {
      appendMessage(coordinator.id, {
        id: newId("msg"),
        sender: { kind: "system" },
        body: "Planning a delegation and creating independent agents…",
      });
      try {
        const plan = await requestDelegationPlan({
          instruction,
          coordinatorName: coordinator.name,
          coordinatorPersona: coordinator.persona,
          existingAgents: bots.map((bot) => bot.name),
          history: toTurns(coordinator.messages),
          model,
        });
        const occupied = new Set(bots.map((bot) => bot.name.toLowerCase()));
        const spawned = plan.agents.map((spec, index): Bot => {
          let name = spec.name.trim() || `Agent ${index + 1}`;
          let suffix = 2;
          while (occupied.has(name.toLowerCase())) name = `${spec.name} ${suffix++}`;
          occupied.add(name.toLowerCase());
          return {
            id: newId("bot"),
            name,
            role: spec.role,
            persona: `${spec.persona}\n\nYour delegated assignment: ${spec.task}`,
            preview: `Delegated: ${spec.task}`,
            timestamp: nowLabel(),
            color: spec.color || DELEGATE_COLORS[index % DELEGATE_COLORS.length],
            symbol: index % 2 === 0 ? "circle" : "diamond",
            members: [],
            messages: [{ id: newId("msg"), sender: { kind: "system" }, body: `Delegated task: ${spec.task}` }],
          };
        });
        const groupId = newId("bot");
        const group: Bot = {
          id: groupId,
          name: plan.groupName,
          role: `Delegation led by ${coordinator.name}: ${plan.task}`,
          persona: `A working group delegated by ${coordinator.name}.`,
          preview: `${spawned.length} agents working together`,
          timestamp: nowLabel(),
          color: "#4fd1a5",
          symbol: "capsule",
          members: spawned.map((agent) => agent.name),
          messages: [
            {
              id: newId("msg"),
              sender: { kind: "system" },
              body: `${coordinator.name} spawned ${spawned.map((agent) => `${agent.name} (${agent.role})`).join(", ")}.`,
            },
            { id: newId("msg"), sender: { kind: "user" }, body: plan.task },
          ],
        };
        setBots((previous) => [group, ...spawned, ...previous]);
        setSelectedId(groupId);
        setOpenTabs((tabs) => [...tabs.filter((id) => id !== groupId), groupId]);
        appendMessage(coordinator.id, {
          id: newId("msg"),
          sender: { kind: "system" },
          body: `Spawned ${spawned.map((agent) => agent.name).join(", ")} and delegated the work in “${group.name}”.`,
        });
        for (const agent of spawned) {
          await generateReply(
            groupId,
            { name: agent.name, persona: agent.persona },
            spawned.filter((peer) => peer.id !== agent.id).map((peer) => peer.name),
            groupId,
          );
        }
      } catch (error) {
        appendMessage(coordinator.id, {
          id: newId("msg"),
          sender: { kind: "bot", name: coordinator.name },
          body: `I couldn't create the delegation: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
    [appendMessage, bots, generateReply, model],
  );

  const delegateToMentionedAgents = useCallback(
    async (origin: Bot, instruction: string, mentioned: Bot[]) => {
      const route = routeMentionDelegation(mentioned.map((agent) => agent.name));
      if (!route) return;
      const lead = mentioned.find((agent) => agent.name === route.leadName);
      if (!lead) return;
      const helpers = route.helperNames
        .map((name) => mentioned.find((agent) => agent.name === name))
        .filter((agent): agent is Bot => Boolean(agent));

      if (lead.id !== origin.id) {
        appendMessage(origin.id, {
          id: newId("msg"),
          sender: { kind: "system" },
          body: helpers.length > 0
            ? `Delegated to @${lead.name}; ${helpers.map((helper) => `@${helper.name}`).join(", ")} will report back to ${lead.name}.`
            : `Delegated to @${lead.name} in ${lead.name}'s thread.`,
        });
        appendMessage(lead.id, { id: newId("msg"), sender: { kind: "user" }, body: instruction });
      }

      setSelectedId(lead.id);
      setOpenTabs((tabs) => (tabs.includes(lead.id) ? tabs : [...tabs, lead.id]));

      const userTurn = { role: "user" as const, name: "You", content: instruction };
      const leadHistory = [...toTurns(lead.messages), userTurn];

      if (helpers.length === 0) {
        await generateReply(lead.id, { name: lead.name, persona: lead.persona }, undefined, lead.id, leadHistory);
        return;
      }

      const helperNames = helpers.map((helper) => helper.name);
      const request = await generateHiddenReply(
        {
          name: lead.name,
          persona: `${lead.persona}\n\nFor this turn, delegate the useful research or subtask to ${helperNames.join(", ")}. Write only a concrete request for them. Do not answer the user yet.`,
        },
        leadHistory,
      );
      const helperRequest = request?.trim() || instruction;
      const helperResults: Array<{ helper: Bot; answer: string }> = [];

      for (const helper of helpers) {
        appendMessage(helper.id, {
          id: newId("msg"),
          sender: { kind: "bot", name: lead.name },
          body: helperRequest,
        });
        const answer = await generateReply(
          helper.id,
          {
            name: helper.name,
            persona: `${helper.persona}\n\nAnswer ${lead.name}'s delegated request with concrete work. Your answer will be returned to ${lead.name}.`,
          },
          undefined,
          helper.id,
          [...toTurns(helper.messages), { role: "assistant", name: lead.name, content: helperRequest }],
        );
        const completed = answer?.trim() || `${helper.name} did not return an answer.`;
        helperResults.push({ helper, answer: completed });
      }

      await generateReply(
        lead.id,
        {
          name: lead.name,
          persona: `${lead.persona}\n\nYou have received the requested helper results. Use them as input, resolve any conflicts, and now answer the user's original request. Do not merely summarize the delegation process.`,
        },
        undefined,
        lead.id,
        [
          ...leadHistory,
          { role: "assistant", name: lead.name, content: helperRequest },
          ...helperResults.map(({ helper, answer }) => ({
            role: "assistant" as const,
            name: helper.name,
            content: answer,
          })),
        ],
      );
    },
    [appendMessage, generateHiddenReply, generateReply],
  );

  /** Send the human draft to the currently selected chat. */
  const sendMessage = useCallback(
    async (text: string) => {
      const body = text.trim();
      if (!body || !selected) return;
      const target = selected;
      appendMessage(target.id, { id: newId("msg"), sender: { kind: "user" }, body });

      const mentioned = findMentionedAgents(body, bots);
      if (mentioned.length > 0) {
        await delegateToMentionedAgents(target, body, mentioned);
        return;
      }
      if (body.includes("@")) {
        appendMessage(target.id, {
          id: newId("msg"),
          sender: { kind: "system" },
          body: "That @mention does not match an existing agent. Choose an agent from the mention menu instead of asking another agent to impersonate it.",
        });
        return;
      }

      if (target.members.length === 0 && isDelegationRequest(body)) {
        await spawnAndDelegate(target, body);
        return;
      }

      if (target.members.length === 0) {
        await generateToolAwareReply(target, body);
        return;
      }

      // Group chat: each member replies in turn, seeing the growing thread.
      const memberBots = target.members
        .map((name) => bots.find((b) => b.name === name))
        .filter((b): b is Bot => Boolean(b));
      for (const member of memberBots) {
        const peers = target.members.filter((n) => n !== member.name);
        await generateReply(target.id, { name: member.name, persona: member.persona }, peers, target.id);
      }
    },
    [selected, bots, appendMessage, delegateToMentionedAgents, generateReply, generateToolAwareReply, spawnAndDelegate],
  );

  /** Ask the group to continue talking amongst themselves for N rounds. */
  const nudgeGroup = useCallback(
    async (rounds = 1) => {
      if (!selected || selected.members.length === 0) return;
      const target = selected;
      const memberBots = target.members
        .map((name) => bots.find((b) => b.name === name))
        .filter((b): b is Bot => Boolean(b));
      for (let r = 0; r < rounds; r++) {
        for (const member of memberBots) {
          const peers = target.members.filter((n) => n !== member.name);
          await generateReply(target.id, { name: member.name, persona: member.persona }, peers, target.id);
        }
      }
    },
    [selected, bots, generateReply],
  );

  const createAgent = useCallback(
    (opts?: { name?: string; role?: string; persona?: string; color?: string }) => {
      const name = opts?.name?.trim() || "New agent";
      const bot: Bot = {
        id: newId("bot"),
        name,
        role: opts?.role?.trim() || "A fresh general-purpose sidekick.",
        persona:
          opts?.persona?.trim() ||
          `You are ${name}, a helpful, fast teammate. Ask what the operator needs and get to work.`,
        preview: "Hey — good to meet you. What do you want me around for?",
        timestamp: nowLabel(),
        color: opts?.color || "#e8873a",
        symbol: "circle",
        members: [],
        messages: [
          {
            id: newId("msg"),
            sender: { kind: "bot", name },
            body: "Hey, good to meet you. What do you want me around for? Anything concrete, or more of a general sidekick?",
          },
        ],
      };
      setBots((prev) => {
        const withoutUntouched = prev.filter((b) => b.name !== "New agent" || opts?.name);
        return [bot, ...withoutUntouched];
      });
      openTab(bot.id);
      return bot;
    },
    [openTab],
  );

  const configureDefaultAgent = useCallback(
    (opts?: { name?: string; role?: string; persona?: string }) => {
      const name = opts?.name?.trim() || "Default Agent";
      const role = opts?.role?.trim() || "Your general-purpose AI teammate.";
      const persona =
        opts?.persona?.trim() ||
        `You are ${name}, a helpful, concise, and proactive teammate. Ask what the operator needs and get to work.`;
      setBots((previous) => {
        const existing = previous.find((bot) => bot.name === "Default Agent") ?? previous[0];
        const configured: Bot = existing
          ? { ...existing, name, role, persona, preview: "Ready when you are.", timestamp: nowLabel() }
          : sampleBots()[0];
        return [{ ...configured, name, role, persona }, ...previous.filter((bot) => bot.id !== existing?.id)];
      });
      setAgentSetupComplete(true);
      setPickerOpen(false);
    },
    [],
  );

  const createGroup = useCallback(
    (name: string, memberNames: string[]) => {
      const clean = memberNames.filter(Boolean);
      const bot: Bot = {
        id: newId("bot"),
        name: name.trim() || "New group",
        role: `Group chat: ${clean.join(", ")}.`,
        persona: `A group chat with ${clean.join(", ")}.`,
        preview: `${clean.length} teammates`,
        timestamp: nowLabel(),
        color: "#4fd1a5",
        symbol: "capsule",
        members: clean,
        messages: [
          { id: newId("msg"), sender: { kind: "system" }, body: `${clean.join(", ")} joined the chat.` },
        ],
      };
      setBots((prev) => [bot, ...prev]);
      openTab(bot.id);
      return bot;
    },
    [openTab],
  );

  const deleteBot = useCallback(
    (id: string) => {
      setBots((prev) => prev.filter((b) => b.id !== id));
      setInspectorBotId((current) => (current === id ? null : current));
      closeTab(id);
    },
    [closeTab],
  );

  const updateBotDetails = useCallback((id: string, update: BotMetadataUpdate) => {
    setBots((previous) => updateBotMetadata(previous, id, update));
  }, []);

  const toggleBotPinned = useCallback((id: string) => {
    setBots((previous) =>
      previous.map((bot) => (bot.id === id ? { ...bot, pinned: !bot.pinned } : bot)),
    );
  }, []);

  const openInspector = useCallback((id: string) => {
    setSelectedId(id);
    setInspectorBotId(id);
  }, []);

  const closeInspector = useCallback(() => setInspectorBotId(null), []);

  const resetWorkspace = useCallback(() => {
    const fresh = sampleBots();
    setBots(fresh);
    const last = fresh[fresh.length - 1];
    setSelectedId(last?.id ?? null);
    setOpenTabs(last ? [last.id] : []);
    setAgentSetupComplete(false);
    setPickerOpen(true);
  }, []);

  return {
    bots,
    filteredBots,
    selected,
    inspectorBot,
    selectedId,
    openTabs,
    searchText,
    pickerOpen,
    settingsOpen,
    model,
    live,
    busyBots,
    ready,
    needsDefaultAgentSetup: !agentSetupComplete,
    setSearchText,
    setPickerOpen,
    setSettingsOpen,
    setModel,
    openTab,
    closeTab,
    sendMessage,
    nudgeGroup,
    createAgent,
    configureDefaultAgent,
    createGroup,
    updateBotDetails,
    toggleBotPinned,
    openInspector,
    closeInspector,
    deleteBot,
    resetWorkspace,
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;
