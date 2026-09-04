import type { AssistantMessage, Message } from "@earendil-works/pi-ai";
import type { ModelSelection } from "./config";

export type BotSymbol = "circle" | "capsule" | "triangle" | "diamond" | "hexagon";

export type MessageSender =
  | { kind: "user" }
  | { kind: "system" }
  | { kind: "bot"; name: string };

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  body: string;
  /** Optional short label such as "Now" or "6:19 AM". */
  timestamp?: string;
  /** Marks a message that is still streaming in. */
  pending?: boolean;
}

/**
 * A bot / teammate. Ported from the SwiftUI `Teammate` model. Each bot is its
 * own chat tab. A bot with `members.length > 0` is a group chat whose members
 * converse with one another.
 */
export interface Bot {
  id: string;
  name: string;
  /** One-line role/persona used to steer the model. */
  role: string;
  /** Full persona / system prompt used for generation. */
  persona: string;
  preview: string;
  timestamp: string;
  /** Accent color (hex). */
  color: string;
  symbol: BotSymbol;
  /** Pinned chats stay at the top of the sidebar. */
  pinned?: boolean;
  messages: ChatMessage[];
  /** Non-empty => this tab is a group chat of the referenced bot names. */
  members: string[];
  /** Per-bot model override; falls back to the workspace default. */
  model?: ModelSelection;
}

/** A single turn handed to the agent runtime. */
export interface AgentTurn {
  role: "user" | "assistant" | "system";
  /** Speaker name for assistant/user turns (drives multi-agent attribution). */
  name?: string;
  content: string;
}

export interface RespondInput {
  /** Persona of the bot that should produce the reply. */
  persona: string;
  /** Display name of the responding bot. */
  botName: string;
  /** Prior conversation, oldest first. */
  history: AgentTurn[];
  /** Model + reasoning selection. */
  model: ModelSelection;
  /** In a group chat, the names of the other participants. */
  peers?: string[];
  /** Other agents this bot may invoke through the delegate_to_agent tool. */
  orchestration?: boolean;
  continuation?: Message[];
  availableAgents?: Array<{ name: string; role: string }>;
}

export interface RespondChunk {
  type: "delta" | "tool_call" | "assistant_message" | "done" | "error";
  assistantMessage?: AssistantMessage;
  delta?: string;
  message?: string;
  error?: string;
  toolCallId?: string;
  toolName?: string;
  arguments?: Record<string, unknown>;
}

/**
 * The seam that lets LunaDesk swap agent backends. The default implementation
 * is Pi-backed (`PiAgentRuntime`); a credential-free `LocalAgentRuntime` keeps
 * the whole product demonstrable offline.
 */
export interface AgentRuntime {
  readonly id: string;
  /** Whether this runtime can currently produce real model responses. */
  isReady(model: ModelSelection): Promise<boolean>;
  /** Stream a single assistant reply as async chunks. */
  respond(input: RespondInput, signal?: AbortSignal): AsyncGenerator<RespondChunk>;
}
