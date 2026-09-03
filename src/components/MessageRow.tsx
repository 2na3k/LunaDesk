import type { ChatMessage } from "@/lib/types";

export function MessageRow({ message }: { message: ChatMessage }) {
  if (message.sender.kind === "system") {
    return (
      <div className="w-full py-0.5 text-center text-[12.5px] font-medium text-luna-secondary">
        {message.body}
      </div>
    );
  }

  if (message.sender.kind === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[70%] whitespace-pre-wrap rounded-[17px] bg-luna-bubble px-3.5 py-2.5 text-[14.5px] leading-relaxed text-black">
          {message.body}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="pl-1 text-[12.5px] font-medium text-luna-secondary">{message.sender.name}</span>
      <div className="flex">
        <div className="max-w-[75%] whitespace-pre-wrap rounded-[17px] bg-luna-elevated px-3.5 py-2.5 text-[14.5px] leading-relaxed text-luna-primary">
          {message.body ? (
            message.body
          ) : (
            <span className="luna-typing text-luna-secondary" aria-label="typing">
              <span />
              <span />
              <span />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
