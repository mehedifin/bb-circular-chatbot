# BB Circular Chatbot — Design

**Date:** 2026-06-11 · **Status:** Approved for implementation (autonomous greenfield session)

## Goal

An AI-powered chatbot that answers banker/investor questions about Bangladesh Bank
circulars (scheduled banks + NBFIs), in **Bangla and English**, with every answer
citing the **circular reference number, issue date, department, and page number**,
sourced from https://www.bb.org.bd/en/index.php/mediaroom/circular.

## Platform decision

A **Next.js 16 progressive web app (PWA)** rather than a native Android APK:

- Installable on Android home screens today; ships to **Google Play via Trusted Web
  Activity (Bubblewrap/PWABuilder)**, to iOS App Store via PWA wrapper, and to
  Microsoft Store via PWABuilder — one codebase passes all three store checks.
- Deployable to Vercel for the requested **preview before production**.
- Native Android (Kotlin) remains an option later; the chat API is a plain HTTP
  endpoint a native client can consume unchanged.

## Architecture

```
┌─────────────── Ingestion (offline, scripts/) ───────────────┐
│ crawl.ts  → listing pages on bb.org.bd (cookie session,     │
│             rate-limited, bot-challenge backoff)            │
│ ingest.ts → download PDFs → pdf-parse per-page text         │
│             → OCR.space fallback (ben+eng) for scanned PDFs │
│             → chunk w/ metadata → optional embeddings       │
│             → data/index.json                               │
└──────────────────────────────────────────────────────────────┘
┌─────────────── Runtime (Next.js app) ────────────────────────┐
│ /login  → Auth.js v5 credentials (JWT sessions)              │
│ /       → chat UI (useChat, streaming, citation cards)       │
│ /api/chat → auth check → language detect → hybrid retrieval  │
│             (BM25 + optional vector) → streamText via        │
│             Vercel AI Gateway → UIMessageStream with         │
│             `data-citations` part                            │
└──────────────────────────────────────────────────────────────┘
```

## Key decisions

1. **Retrieval = BM25 first, embeddings optional.** BM25 over Unicode-aware tokens
   (Latin + Bangla `ঀ–৿`) works with zero API keys, so ingestion and the
   preview deployment function before any AI key is configured. When
   `AI_GATEWAY_API_KEY` is set, `openai/text-embedding-3-small` vectors are added
   and fused with BM25 (reciprocal-rank fusion).
2. **File-based index (`data/index.json`)** for the demo corpus; documented upgrade
   path to Postgres + pgvector for the full 20-year corpus (~tens of thousands of
   circulars won't fit a JSON file).
3. **OCR**: per the requirement to use a *reliable free online OCR solution*,
   scanned PDFs fall back to the **OCR.space free API** (supports Bengali + English,
   accepts PDFs directly, returns per-page text). Configured via `OCR_SPACE_API_KEY`.
4. **Citations are data, not just prose.** The API returns the retrieved chunks'
   metadata as a typed `data-citations` UI-message part, so the UI renders source
   cards (circular no, date, department, page, PDF link) even if the model's prose
   citation is imperfect. The system prompt additionally requires inline citations.
5. **Bilingual**: language of the latest user message is detected by Bangla Unicode
   range ratio; the system prompt pins the response language to match.
6. **Bot protection on bb.org.bd** (F5/TSPD JS challenge) triggers on rapid
   requests. The crawler uses a persistent cookie session, browser-like headers,
   3–6 s jittered delays, challenge detection, and exponential backoff.
7. **Auth**: Auth.js v5, credentials provider with JWT sessions for the demo
   (users from `DEMO_USERS` env). Production guidance (bcrypt user store / SSO /
   rate limiting) documented in README. Security headers (CSP, HSTS, frame-deny)
   set in `next.config.ts`.
8. **No-key graceful degradation**: without `AI_GATEWAY_API_KEY`, `/api/chat`
   streams an extractive answer (top excerpts + full citations) plus a setup notice,
   so the preview is demonstrable end-to-end.

## Data model

```ts
CircularDoc { id, circularNo, title, department, departmentCode, date, pdfUrl, lang, pages }
Chunk       { id, docId, page, text, embedding? }   // ~1,400 chars, 200 overlap, page-aligned
Citation    { docId, circularNo, title, department, date, page, pdfUrl, snippet }
```

## Error handling

- Crawler: challenge page detected by `bobcmn` marker → backoff (30s, 90s, 270s), resume from last cursor; partial results always flushed to disk.
- Ingest: per-PDF try/catch — a corrupt PDF skips with a logged reason, never aborts the run; OCR fallback only when extracted text < 200 chars/page avg.
- Chat API: 401 without session; empty index → friendly "knowledge base not built" message; gateway errors surface as a readable assistant error part.

## Testing

- `npm run build` + `tsc --noEmit` as the gate for this session.
- Retrieval smoke test script (`scripts/search-test.ts`) querying the built index in both languages.
- Manual preview verification on the Vercel deployment.

## Out of scope (documented for later)

Full 20-year backfill execution (pipeline supports it; run is hours-long and
rate-limited), pgvector migration, native Kotlin client, SSO, conversation
persistence, admin re-index dashboard.
