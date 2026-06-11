import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { embed } from "ai";
import { Bm25Index } from "./bm25";
import type { Chunk, CircularDoc, CircularIndex, Citation } from "../types";

interface LoadedStore {
  docs: Map<string, CircularDoc>;
  chunks: Map<string, Chunk>;
  bm25: Bm25Index;
  hasEmbeddings: boolean;
  builtAt: string;
  docCount: number;
  chunkCount: number;
}

let store: LoadedStore | null = null;

function loadStore(): LoadedStore | null {
  if (store) return store;
  const file = path.join(process.cwd(), "data", "index.json");
  if (!existsSync(file)) return null;
  const index: CircularIndex = JSON.parse(readFileSync(file, "utf8"));
  store = {
    docs: new Map(index.docs.map((d) => [d.id, d])),
    chunks: new Map(index.chunks.map((c) => [c.id, c])),
    bm25: new Bm25Index(index.chunks.map((c) => ({ id: c.id, text: c.text }))),
    hasEmbeddings: index.chunks.some((c) => c.embedding && c.embedding.length > 0),
    builtAt: index.builtAt,
    docCount: index.docs.length,
    chunkCount: index.chunks.length,
  };
  return store;
}

export function indexStats() {
  const s = loadStore();
  return s
    ? { ready: true as const, docs: s.docCount, chunks: s.chunkCount, builtAt: s.builtAt }
    : { ready: false as const };
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/** Reciprocal-rank fusion of BM25 and (optional) vector rankings. */
export async function searchCirculars(query: string, topK = 6): Promise<Citation[]> {
  const s = loadStore();
  if (!s || s.chunkCount === 0) return [];

  const rrf = new Map<string, number>();
  const K = 60;

  const lexical = s.bm25.search(query, topK * 3);
  lexical.forEach((r, i) => rrf.set(r.id, (rrf.get(r.id) ?? 0) + 1 / (K + i + 1)));

  if (s.hasEmbeddings && process.env.AI_GATEWAY_API_KEY) {
    try {
      const { embedding } = await embed({
        model: process.env.EMBEDDING_MODEL ?? "openai/text-embedding-3-small",
        value: query.slice(0, 4000),
      });
      const vector = [...s.chunks.values()]
        .filter((c) => c.embedding && c.embedding.length > 0)
        .map((c) => ({ id: c.id, score: cosine(embedding, c.embedding!) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK * 3);
      vector.forEach((r, i) => rrf.set(r.id, (rrf.get(r.id) ?? 0) + 1 / (K + i + 1)));
    } catch (err) {
      console.error("vector search unavailable, using BM25 only:", err);
    }
  }

  const ranked = [...rrf.entries()].sort((a, b) => b[1] - a[1]).slice(0, topK);

  return ranked.map(([chunkId]) => {
    const chunk = s.chunks.get(chunkId)!;
    const doc = s.docs.get(chunk.docId)!;
    return {
      docId: doc.id,
      circularNo: doc.circularNo,
      title: doc.title,
      department: doc.department,
      date: doc.date,
      page: chunk.page,
      pdfUrl: doc.pdfUrl,
      snippet: chunk.text.slice(0, 1600),
    };
  });
}
