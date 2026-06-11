import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from "ai";
import { auth } from "@/lib/auth";
import { detectLanguage } from "@/lib/lang";
import { indexStats, searchCirculars } from "@/lib/retrieval/store";
import type { ChatUIMessage, Citation } from "@/lib/types";

export const maxDuration = 60;

function lastUserText(messages: ChatUIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return "";
  return last.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

function systemPrompt(citations: Citation[], lang: "bn" | "en"): string {
  const context = citations
    .map(
      (c, i) =>
        `[${i + 1}] Circular: ${c.circularNo} | Title: ${c.title} | Department: ${c.department} | Issue date: ${c.date} | Page: ${c.page} | PDF: ${c.pdfUrl}\n${c.snippet}`,
    )
    .join("\n\n---\n\n");

  return `You are the Bangladesh Bank Circular Assistant, serving bankers and investors. You answer questions about regulatory, policy, and operational matters covered in circulars issued by Bangladesh Bank for scheduled banks and non-bank financial institutions (NBFIs).

STRICT RULES:
1. Answer ONLY from the circular excerpts provided below. Never invent regulatory content, figures, dates, or circular numbers.
2. ${lang === "bn" ? "The user wrote in Bangla. Respond entirely in Bangla (বাংলা)." : "The user wrote in English. Respond entirely in English."}
3. Cite every substantive claim inline as (Circular No; Department; Issue date; Page N).
4. End with a "${lang === "bn" ? "সূত্র" : "Sources"}" section listing each circular used: reference number, issue date, department, and page number.
5. If the excerpts do not contain the answer, say so clearly and suggest checking the Bangladesh Bank website (https://www.bb.org.bd) — do not guess.
6. Keep answers precise and structured (short paragraphs or bullet points). This is regulatory information, not legal advice; note that for interpretation the original circular prevails.

CIRCULAR EXCERPTS:
${context || "(no relevant excerpts were retrieved)"}`;
}

function extractiveFallback(citations: Citation[], lang: "bn" | "en"): string {
  const intro =
    lang === "bn"
      ? "AI উত্তর তৈরি এই মুহূর্তে সক্রিয় নয়। আপনার প্রশ্নের সাথে সবচেয়ে প্রাসঙ্গিক সার্কুলার অংশগুলো নিচে দেওয়া হলো:\n\n"
      : "AI answer generation is not active right now. Here are the most relevant circular excerpts for your question:\n\n";
  const body = citations
    .slice(0, 3)
    .map(
      (c, i) =>
        `**${i + 1}. ${c.circularNo}** — ${c.department}, ${c.date}, page ${c.page}\n> ${c.snippet.slice(0, 500).replace(/\n+/g, " ")}…`,
    )
    .join("\n\n");
  return intro + body;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messages }: { messages: ChatUIMessage[] } = await req.json();
  const query = lastUserText(messages);
  if (!query.trim()) {
    return Response.json({ error: "Empty message" }, { status: 400 });
  }

  const lang = detectLanguage(query);
  const stats = indexStats();
  const citations = stats.ready ? await searchCirculars(query, 6) : [];

  const stream = createUIMessageStream<ChatUIMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "data-citations", id: "citations", data: citations });

      const writeText = (text: string) => {
        writer.write({ type: "text-start", id: "answer" });
        writer.write({ type: "text-delta", id: "answer", delta: text });
        writer.write({ type: "text-end", id: "answer" });
      };

      if (!stats.ready) {
        writeText(
          lang === "bn"
            ? "জ্ঞানভান্ডার এখনো তৈরি হয়নি। অনুগ্রহ করে প্রথমে ইনজেশন পাইপলাইন চালান (`npm run crawl` এরপর `npm run ingest`)।"
            : "The knowledge base has not been built yet. Please run the ingestion pipeline first (`npm run crawl`, then `npm run ingest`).",
        );
        return;
      }

      // Gateway auth: an explicit key, or the OIDC token Vercel provisions
      // automatically on deployments (and via `vercel env pull` locally).
      if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
        writeText(extractiveFallback(citations, lang));
        return;
      }

      const result = streamText({
        model: process.env.CHAT_MODEL ?? "anthropic/claude-sonnet-4.6",
        system: systemPrompt(citations, lang),
        messages: await convertToModelMessages(
          messages.map((m) => ({
            ...m,
            parts: m.parts.filter((p) => p.type === "text"),
          })),
        ),
        onError: ({ error }) => console.error("streamText error:", error),
      });
      writer.merge(result.toUIMessageStream());
    },
    onError: (error) => {
      console.error("chat stream error:", error);
      // If the gateway rejects the call (e.g. billing not unlocked yet),
      // degrade to the extractive answer instead of a bare error.
      return extractiveFallback(citations, lang);
    },
  });

  return createUIMessageStreamResponse({ stream });
}
