"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_MODEL, type ModelSelection } from "./config";
import { newId, sampleBots } from "./sample-data";
import { streamChat, toTurns } from "./client";
import type { Bot, ChatMessage } from "./types";

const STORAGE_KEY = "lunadesk.workspace.v1";

interface Persisted {
  bots: Bot[];
  model: ModelSelection;
}

function nowLabel(): string {
  return "Now";
}

export function useWorkspace() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [model, setModel] = useState<ModelSelection>(DEFAULT_MODEL);
  const [live, setLive] = useState<boolean | null>(null);
  const [busyBots, setBusyBots] = useState<Record<string, boolean>>({});
  const loaded = useRef(false);

  // Load persisted state (or seed with sample data).
  useEffect(() => {
    let initial: Bot[];
    let initialModel = DEFAULT_MODEL;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Persisted;
        initial = parsed.bots?.length ? parsed.bots : sampleBots();
        initialModel = parsed.model ?? DEFAULT_MODEL;
      } else {
        initial = sampleBots();
      }
    } catch {
      initial = sampleBots();
    }
    setBots(initial);
    setModel(initialModel);
    const last = initial[initial.length - 1];
    if (last) {
      setSelectedId(last.id);
      setOpenTabs([last.id]);
    }
    loaded.current = true;
  }, []);

  // Persist.
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ bots, model } satisfies Persisted));
    } catch {
      // ignore quota errors
    }
  }, [bots, model]);

  const selected = useMemo(() => bots.find((b) => b.id === selectedId) ?? null, [bots, selectedId]);

  const filteredBots = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return bots;
    return bots.filter(
      (b) => b.name.toLowerCase().includes(q) || b.preview.toLowerCase().includes(q),
    );
  }, [bots, searchText]);

  const openTab = useCallback((id: string) => {
    setSelectedId(id);
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
    ) => {
      const sourceId = historyBotId ?? botId;
      const source = (bs: Bot[]) => bs.find((b) => b.id === sourceId);
      const current = source(bots);
      if (!current) return;

      const pendingId = newId("msg");
      appendMessage(botId, {
        id: pendingId,
        sender: { kind: "bot", name: speaker.name },
        body: "",
        pending: true,
      });
      setBusyBots((m) => ({ ...m, [botId]: true }));

      // Read the freshest transcript synchronously via a functional read.
      let history = toTurns(current.messages);
      await new Promise<void>((resolve) => {
        setBots((prev) => {
          const src = prev.find((b) => b.id === sourceId);
          if (src) history = toTurns(src.messages.filter((m) => m.id !== pendingId));
          resolve();
          return prev;
        });
      });

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
    [bots, appendMessage, setMessagePartial, patchBot, model],
  );

  /** Send the human draft to the currently selected chat. */
  const sendMessage = useCallback(
    async (text: string) => {
      const body = text.trim();
      if (!body || !selected) return;
      const target = selected;
      appendMessage(target.id, { id: newId("msg"), sender: { kind: "user" }, body });

      if (target.members.length === 0) {
        await generateReply(target.id, { name: target.name, persona: target.persona }, undefined);
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
    [selected, bots, appendMessage, generateReply],
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
        role: opts?.role || "A fresh general-purpose sidekick.",
        persona:
          opts?.persona ||
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
      closeTab(id);
    },
    [closeTab],
  );

  const resetWorkspace = useCallback(() => {
    const fresh = sampleBots();
    setBots(fresh);
    const last = fresh[fresh.length - 1];
    setSelectedId(last?.id ?? null);
    setOpenTabs(last ? [last.id] : []);
  }, []);

  return {
    bots,
    filteredBots,
    selected,
    selectedId,
    openTabs,
    searchText,
    pickerOpen,
    settingsOpen,
    model,
    live,
    busyBots,
    setSearchText,
    setPickerOpen,
    setSettingsOpen,
    setModel,
    openTab,
    closeTab,
    sendMessage,
    nudgeGroup,
    createAgent,
    createGroup,
    deleteBot,
    resetWorkspace,
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;
