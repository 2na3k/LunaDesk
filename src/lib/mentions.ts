import type { Bot } from "./types";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Resolve only exact mentions of existing solo agents; never guess a target. */
export function findMentionedAgents(text: string, bots: Bot[]): Bot[] {
  return bots
    .filter((bot) => bot.members.length === 0)
    .map((bot) => {
      const pattern = new RegExp(
        `(^|\\s)@${escapeRegExp(bot.name)}(?=$|[\\s,.:;!?])`,
        "iu",
      );
      const match = pattern.exec(text);
      return { bot, index: match?.index ?? -1 };
    })
    .filter((entry) => entry.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.bot);
}

/** Text after the final @ while the user is composing a mention. */
export function activeMentionQuery(text: string): string | null {
  if (/\s$/u.test(text)) return null;
  const match = text.match(/(?:^|\s)@([^@\n]*)$/u);
  return match ? match[1] : null;
}

export function insertMention(text: string, agentName: string): string {
  return text.replace(/(^|\s)@([^@\n]*)$/u, `$1@${agentName} `);
}
