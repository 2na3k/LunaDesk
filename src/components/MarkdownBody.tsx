import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownBody({ children, darkText = false }: { children: string; darkText?: boolean }) {
  return (
    <div className={`luna-markdown min-w-0 ${darkText ? "text-black" : "text-luna-primary"}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children: linkChildren, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer" className="underline decoration-current/40 underline-offset-2 hover:decoration-current">
              {linkChildren}
            </a>
          ),
          code: ({ children: codeChildren, className, ...props }) => (
            <code {...props} className={`${className ?? ""} rounded bg-black/15 px-1 py-0.5 font-mono text-[0.9em]`}>
              {codeChildren}
            </code>
          ),
          pre: ({ children: preChildren }) => (
            <pre className="my-2 overflow-x-auto rounded-lg bg-black/25 p-3 font-mono text-[12.5px] leading-5">
              {preChildren}
            </pre>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
