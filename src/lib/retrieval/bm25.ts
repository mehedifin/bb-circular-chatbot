/**
 * Okapi BM25 over Unicode-aware tokens (Latin + Bangla). Works with no API
 * keys, which keeps retrieval functional before embeddings are configured.
 */

const TOKEN_RE = /[a-z0-9ঀ-৿]+/g;

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(TOKEN_RE) ?? [];
}

export interface Bm25Doc {
  id: string;
  tokens: string[];
}

export class Bm25Index {
  private k1 = 1.5;
  private b = 0.75;
  private docs: Bm25Doc[] = [];
  private df = new Map<string, number>();
  private avgLen = 0;
  private termFreqs: Map<string, number>[] = [];

  constructor(docs: { id: string; text: string }[]) {
    this.docs = docs.map((d) => ({ id: d.id, tokens: tokenize(d.text) }));
    let total = 0;
    for (const doc of this.docs) {
      total += doc.tokens.length;
      const tf = new Map<string, number>();
      for (const t of doc.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      this.termFreqs.push(tf);
      for (const term of tf.keys()) this.df.set(term, (this.df.get(term) ?? 0) + 1);
    }
    this.avgLen = this.docs.length > 0 ? total / this.docs.length : 0;
  }

  search(query: string, topK: number): { id: string; score: number }[] {
    const qTerms = [...new Set(tokenize(query))];
    const n = this.docs.length;
    const scores: { id: string; score: number }[] = [];

    for (let i = 0; i < n; i++) {
      const tf = this.termFreqs[i];
      const len = this.docs[i].tokens.length;
      let score = 0;
      for (const term of qTerms) {
        const f = tf.get(term);
        if (!f) continue;
        const df = this.df.get(term) ?? 0;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        score +=
          (idf * f * (this.k1 + 1)) /
          (f + this.k1 * (1 - this.b + (this.b * len) / this.avgLen));
      }
      if (score > 0) scores.push({ id: this.docs[i].id, score });
    }

    return scores.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}
