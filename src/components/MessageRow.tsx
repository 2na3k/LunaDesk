"use client";

import { useState } from "react";
import { MarkdownBody } from "./MarkdownBody";
import type { ChatMessage } from "@/lib/types";

export function MessageRow({ message }: { message: ChatMessage }) {
  if (message.sender.kind === "system") {
    return (
      <div className="group/message flex w-full items-center justify-center gap-1 py-0.5 text-center text-[12.5px] font-medium text-luna-secondary">
        <span>{message.body}</span>
        <CopyButton text={message.body} />
      </div>
    );
  }

  if (message.sender.kind === "user") {
    return (
      <div className="group/message flex items-start justify-end gap-1">
        <CopyButton text={message.body} />
        <div className="max-w-[70%] rounded-[17px] bg-luna-bubble px-3.5 py-2.5 text-[14.5px] leading-relaxed text-black">
          <MarkdownBody darkText>{message.body}</MarkdownBody>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="pl-1 text-[12.5px] font-medium text-luna-secondary">{message.sender.name}</span>
      <div className="group/message flex items-start gap-1">
        <div className="max-w-[75%] rounded-[17px] bg-luna-elevated px-3.5 py-2.5 text-[14.5px] leading-relaxed text-luna-primary">
          {message.body ? (
            <MarkdownBody>{message.body}</MarkdownBody>
          ) : (
            <span className="luna-typing text-luna-secondary" aria-label="typing">
              <span />
              <span />
              <span />
            </span>
          )}
        </div>
        {message.body && <CopyButton text={message.body} />}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-luna-secondary opacity-0 transition-opacity hover:bg-white/5 hover:text-luna-primary focus:opacity-100 group-hover/message:opacity-100"
      aria-label={copied ? "Copied" : "Copy message"}
      title={copied ? "Copied" : "Copy message"}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
