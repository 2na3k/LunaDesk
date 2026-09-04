"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_MODEL, type ModelSelection } from "./config";
import { newId, sampleBots } from "./sample-data";
import { streamChat, toTurns } from "./client";
import { routeMentionDelegation } from "./delegation";
import { runWorkspaceTurn, type ModelStep } from "./orchestration";
import { findMentionedAgents } from "./mentions";
import { updateBotMetadata, type BotMetadataUpdate } from "./bot-metadata";
import type { Bot, ChatMessage, MessageReference } from "./types";

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
  const persistence = useRef(Promise.resolve());
  const [bots, setBots] = useState<Bot[]>([]);
  const [messageFocus, setMessageFocus] = useState<{ botId: string; messageId: string; nonce: number } | null>(null);
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
      persistence.current = persistence.current.then(() => fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workspace),
      })).then(() => undefined).catch(() => {
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
    setMessageFocus(null);
    setSelectedId(id);
    setInspectorBotId(null);
    setOpenTabs((tabs) => (tabs.includes(id) ? tabs : [...tabs, id]));
    setPickerOpen(false);
  }, []);

  const openMessageReference = useCallback((reference: MessageReference) => {
    const bot = bots.find((item) => item.id === reference.botId);
    if (!bot) return;
    const message = reference.messageId
      ? bot.messages.find((item) => item.id === reference.messageId)
      : [...bot.messages].reverse().find((item) => item.sender.kind === "bot" && item.sender.name === bot.name);
    openTab(bot.id);
    if (message) setMessageFocus({ botId: bot.id, messageId: message.id, nonce: Date.now() });
  }, [bots, openTab]);

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

  /** Execute workspace tools and continue the coordinator with native tool results. */
  const generateToolAwareReply = useCallback(
    async (target: Bot, instruction: string) => {
      // A turn-local registry makes newly created agents usable immediately,
      // without waiting for React to render a new closure.
      const registry = new Map(bots.filter((bot) => bot.members.length === 0).map((bot) => [bot.id, { ...bot, messages: [...bot.messages] }]));
      const activities: string[] = [];
      const record = (body: string, agent?: Bot) => appendMessage(target.id, {
        id: newId("msg"), sender: { kind: "system" }, body,
        links: agent ? [{ botId: agent.id, name: agent.name, messageId: [...agent.messages].reverse().find((message) => message.sender.kind === "bot" && message.sender.name === agent.name)?.id }] : undefined,
      });
      setBusyBots((current) => ({ ...current, [target.id]: true }));
      try {
        await runWorkspaceTurn(
          { persona: target.persona, botName: target.name,
            history: [...toTurns(target.messages), { role: "user", name: "You", content: instruction }],
            model: target.model ?? model },
          {
            record,
            announce: (body) => {
              const id = newId("msg");
              activities.push(id);
              appendMessage(target.id, { id, sender: { kind: "bot", name: target.name }, body, activity: "waiting" });
            },
            create: (spec) => {
              let name = spec.name;
              let suffix = 2;
              const occupied = new Set([...registry.values()].map((bot) => bot.name.toLocaleLowerCase()));
              while (occupied.has(name.toLocaleLowerCase())) name = `${spec.name} ${suffix++}`;
              const agent: Bot = {
                id: newId("bot"), name, role: spec.role, persona: spec.persona,
                preview: `Created by ${target.name}`, timestamp: nowLabel(),
                color: DELEGATE_COLORS[registry.size % DELEGATE_COLORS.length], symbol: "circle", members: [],
                messages: [{ id: newId("msg"), sender: { kind: "system" }, body: `Created by ${target.name}.` }],
              };
              const worker = { ...agent, messages: [...agent.messages] };
              registry.set(agent.id, worker);
              setBots((previous) => [agent, ...previous]);
              setOpenTabs((tabs) => [...tabs, agent.id]);
              return worker;
            },
            find: (name) => [...registry.values()].find((agent) => agent.id !== target.id && agent.name.toLocaleLowerCase() === name.toLocaleLowerCase()),
            run: async (agent, task) => {
              const request: ChatMessage = { id: newId("msg"), sender: { kind: "bot", name: target.name }, body: task };
              appendMessage(agent.id, request);
              agent.messages = [...agent.messages, request];
              const pendingId = newId("msg");
              appendMessage(agent.id, { id: pendingId, sender: { kind: "bot", name: agent.name }, body: "", pending: true });
              const reference = { botId: agent.id, name: agent.name, messageId: pendingId };
              appendMessage(target.id, { id: newId("msg"), sender: { kind: "system" }, body: `Sent work to @${agent.name} in its own chat.`, links: [reference] });
              for (const id of activities) setMessagePartial(target.id, id, (message) => message.activity !== "waiting" ? message : ({ ...message, links: [...(message.links ?? []), reference] }));
              setBusyBots((current) => ({ ...current, [agent.id]: true }));
              let text = "";
              let error = "";
              try {
                await streamChat({
                  persona: `${agent.persona}\nComplete the assignment from ${target.name}. Speak only as yourself. Your actual answer will be returned to the coordinator.`,
                  botName: agent.name, history: toTurns(agent.messages), model: agent.model ?? target.model ?? model,
                }, {
                  onMeta: (meta) => setLive(meta.live),
                  onDelta: (delta) => { text += delta; setMessagePartial(agent.id, pendingId, (message) => ({ ...message, body: text })); },
                  onError: (message) => { error = message; },
                });
                if (error) throw new Error(error);
                if (!text.trim()) throw new Error("Worker returned no answer");
                agent.messages = [...agent.messages, { id: pendingId, sender: { kind: "bot", name: agent.name }, body: text }];
                return text;
              } catch (failure) {
                error = failure instanceof Error ? failure.message : String(failure);
                agent.messages = [...agent.messages, { id: pendingId, sender: { kind: "system" }, body: `Failed: ${error}` }];
                throw failure;
              } finally {
                setMessagePartial(agent.id, pendingId, (message) => ({ ...message, pending: false, body: error ? `⚠️ ${error}` : text }));
                patchBot(agent.id, (bot) => ({ ...bot, preview: error ? `Failed: ${error}` : text.split("\n")[0], timestamp: nowLabel() }));
                setBusyBots((current) => ({ ...current, [agent.id]: false }));
              }
            },
          },
          () => [...registry.values()].filter((agent) => agent.id !== target.id).map(({ name, role }) => ({ name, role })),
          async (request) => {
            // Preserve the model's earlier words; only stop their activity indicator.
            for (const id of activities) setMessagePartial(target.id, id, (message) => ({ ...message, activity: "complete" }));
            let messageId: string | undefined;
            const result: ModelStep = { text: "", calls: [] };
            try {
            await streamChat(request, {
              onMeta: (meta) => { result.live = meta.live; setLive(meta.live); },
              onDelta: (delta) => {
                result.text += delta;
                if (!messageId) {
                  messageId = newId("msg");
                  appendMessage(target.id, { id: messageId, sender: { kind: "bot", name: target.name }, body: result.text, pending: true });
                } else {
                  setMessagePartial(target.id, messageId, (message) => ({ ...message, body: result.text }));
                }
              },
              onToolCall: (call) => result.calls.push(call),
              onAssistantMessage: (message) => { result.assistant = message; },
              onError: (error) => { result.error = error; },
            });
            } finally {
              if (messageId) setMessagePartial(target.id, messageId, (message) => ({ ...message, pending: false }));
            }
            return result;
          },
        );
      } catch (error) {
        for (const id of activities) setMessagePartial(target.id, id, (message) => ({ ...message, activity: "failed" }));
        record(`⚠️ ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setBusyBots((current) => ({ ...current, [target.id]: false }));
      }
    },
    [appendMessage, bots, model, patchBot, setMessagePartial],
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

      await generateToolAwareReply(lead, instruction);
    },
    [appendMessage, generateToolAwareReply],
  );

  /** Send the human draft to the currently selected chat. */
  const sendMessage = useCallback(
    async (text: string) => {
      const body = text.trim();
      if (!body || !selected) return;
      const target = selected;
      setMessageFocus(null);
      appendMessage(target.id, { id: newId("msg"), sender: { kind: "user" }, body });

      const mentioned = findMentionedAgents(body, bots);
      if (mentioned.length > 0) {
        if (target.members.length === 0) {
          await generateToolAwareReply(target, body);
          return;
        }
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
    [selected, bots, appendMessage, delegateToMentionedAgents, generateReply, generateToolAwareReply],
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
    messageFocus,
    openMessageReference,
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
