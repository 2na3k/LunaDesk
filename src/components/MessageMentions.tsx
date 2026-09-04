import type { Bot, ChatMessage, MessageReference } from "@/lib/types";

/** Stored message IDs are authoritative; older events can still open the latest reply. */
export function MessageMentions({ message, bots, onOpen }: {
  message: ChatMessage;
  bots: Bot[];
  onOpen: (reference: MessageReference) => void;
}) {
  const references = [
    ...(message.links ?? []),
    ...bots.filter((bot) => !message.links?.some((link) => link.botId === bot.id))
      .map((bot) => ({ botId: bot.id, name: bot.name })),
  ].sort((a, b) => b.name.length - a.name.length);
  const parts = [];
  let cursor = 0;
  while (cursor < message.body.length) {
    const found = references.map((reference) => ({ reference, at: message.body.indexOf(`@${reference.name}`, cursor) }))
      .filter(({ at, reference }) => at >= 0 && !/[\p{L}\p{N}_]/u.test(message.body[at + reference.name.length + 1] ?? ""))
      .sort((a, b) => a.at - b.at)[0];
    if (!found) { parts.push(message.body.slice(cursor)); break; }
    parts.push(message.body.slice(cursor, found.at));
    parts.push(<button key={found.at} type="button" onClick={() => onOpen(found.reference)}
      className="rounded px-0.5 text-[#8faff7] hover:bg-[#8faff7]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8faff7]"
      title={`Open ${found.reference.name}’s reply`}>
      @{found.reference.name}
    </button>);
    cursor = found.at + found.reference.name.length + 1;
  }
  return <>{parts}</>;
}
