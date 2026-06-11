"use client";

import { useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { signOut } from "next-auth/react";
import type { ChatUIMessage } from "@/lib/types";
import { MessageBubble } from "./message-bubble";

const SUGGESTIONS = [
  "What is the latest CRR and SLR requirement for scheduled banks?",
  "এনবিএফআই-এর জন্য সর্বশেষ নীতিমালা কী?",
  "What are the current rules on foreign exchange remittance?",
  "এসএমই খাতে ঋণ বিতরণের নির্দেশনা কী?",
];

export function Chat({
  userName,
  indexReady,
  docCount,
}: {
  userName: string;
  indexReady: boolean;
  docCount: number;
}) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat<ChatUIMessage>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
    requestAnimationFrame(() =>
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
    );
  }

  return (
    <div className="flex flex-1 flex-col h-dvh">
      <header className="sticky top-0 z-10 border-b border-emerald-900/10 bg-gradient-to-r from-emerald-900 to-teal-800 text-white shadow">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg">
              🏦
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold sm:text-base">
                BB Circular Assistant
              </h1>
              <p className="truncate text-[11px] text-emerald-100/75">
                {indexReady
                  ? `${docCount} circular${docCount === 1 ? "" : "s"} indexed · English | বাংলা`
                  : "Knowledge base not built yet"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="hidden sm:inline text-emerald-100/80">{userName}</span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-lg bg-white/10 px-3 py-1.5 font-medium transition hover:bg-white/20"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <div className="my-auto text-center">
            <h2 className="text-lg font-semibold text-slate-800">
              Ask about any Bangladesh Bank circular
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              Regulatory, policy or operational questions for scheduled banks and NBFIs —
              in English or Bangla. Every answer cites the circular number, issue date,
              department and page.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm transition hover:border-emerald-600/40 hover:shadow"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {status === "submitted" && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-600" />
            Searching circulars…
          </div>
        )}
        {status === "error" && (
          <p className="text-sm text-red-600">
            Something went wrong. Please try again.
          </p>
        )}
        <div ref={bottomRef} />
      </main>

      <footer className="sticky bottom-0 border-t border-slate-200 bg-white/90 backdrop-blur">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="mx-auto flex max-w-3xl items-end gap-2 px-4 py-3"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            rows={1}
            placeholder="Ask in English or বাংলায় জিজ্ঞাসা করুন…"
            className="max-h-40 flex-1 resize-y rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:opacity-50"
          >
            Send
          </button>
        </form>
        <p className="pb-2 text-center text-[10px] text-slate-400">
          Informational only — the original circular text prevails. Sources: bb.org.bd
        </p>
      </footer>
    </div>
  );
}
