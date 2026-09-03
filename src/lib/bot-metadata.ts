import type { Bot, BotSymbol } from "./types";

export interface BotMetadataUpdate {
  name?: string;
  label?: string;
  description?: string;
  color?: string;
  symbol?: BotSymbol;
}

/** Update an agent/group and keep name-based group references consistent. */
export function updateBotMetadata(
  bots: Bot[],
  id: string,
  update: BotMetadataUpdate,
): Bot[] {
  const target = bots.find((bot) => bot.id === id);
  if (!target) return bots;

  const nextName = update.name?.trim() || target.name;
  if (
    nextName.toLocaleLowerCase() !== target.name.toLocaleLowerCase() &&
    bots.some((bot) => bot.id !== id && bot.name.toLocaleLowerCase() === nextName.toLocaleLowerCase())
  ) {
    return bots;
  }

  return bots.map((bot) => {
    const renamedMembers = bot.members.map((name) => (name === target.name ? nextName : name));
    const renamedMessages = bot.messages.map((message) =>
      message.sender.kind === "bot" && message.sender.name === target.name
        ? { ...message, sender: { ...message.sender, name: nextName } }
        : message,
    );
    if (bot.id !== id) {
      return { ...bot, members: renamedMembers, messages: renamedMessages };
    }
    return {
      ...bot,
      name: nextName,
      role: update.label?.trim() || bot.role,
      persona: update.description?.trim() || bot.persona,
      color: update.color || bot.color,
      symbol: update.symbol || bot.symbol,
      members: renamedMembers,
      messages: renamedMessages,
      timestamp: "Now",
    };
  });
}
