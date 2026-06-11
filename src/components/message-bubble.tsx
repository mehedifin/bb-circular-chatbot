"use client";

import ReactMarkdown from "react-markdown";
import type { ChatUIMessage } from "@/lib/types";
import { CitationList } from "./citation-card";

export function MessageBubble({ message }: { message: ChatUIMessage }) {
  const isUser = message.role === "user";
  const text = message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");
  const citationParts = message.parts.filter((p) => p.type === "data-citations");
  const citations = citationParts.length > 0 ? citationParts[citationParts.length - 1].data : [];

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-emerald-700 px-4 py-2.5 text-sm text-white shadow-sm whitespace-pre-wrap">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] space-y-3">
        <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
          {text ? (
            <div className="markdown">
              <ReactMarkdown>{text}</ReactMarkdown>
            </div>
          ) : (
            <span className="text-slate-400">Thinking…</span>
          )}
        </div>
        {citations.length > 0 && <CitationList citations={citations} />}
      </div>
    </div>
  );
}
