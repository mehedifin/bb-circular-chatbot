# BB Circular Assistant

AI-powered chatbot for **Bangladesh Bank circulars** — for bankers and investors.
Ask any regulatory, policy, or operational question covered by circulars issued to
scheduled banks and NBFIs, **in English or Bangla**, and get a context-aware answer
that cites the **circular reference number, issue date, department, and page number**,
with a link to the original PDF on [bb.org.bd](https://www.bb.org.bd/en/index.php/mediaroom/circular).

Built with Next.js 16 (PWA), the Vercel AI SDK, and a bilingual RAG pipeline.

## How it works

```
Ingestion (offline)                        Runtime
───────────────────                        ───────
bb.org.bd circular listing                 /login   Auth.js (JWT)
  └─ crawl.ts (cookie session,             /        chat UI (streaming, citation cards)
     rate limiting, bot-challenge          /api/chat
     backoff)                                ├─ detect query language (bn/en)
  └─ ingest.ts                               ├─ hybrid retrieval: BM25 + optional
     ├─ download PDFs                        │  embeddings (reciprocal-rank fusion)
     ├─ pdf-parse per-page text              ├─ streamText via Vercel AI Gateway
     ├─ OCR.space fallback (ben+eng)         │  (answers pinned to query language)
     │  for scanned PDFs                     └─ `data-citations` part → source cards
     ├─ page-aligned chunking                   (circular no · date · dept · page)
     ├─ optional embeddings
     └─ data/index.json
```

- **Bilingual:** tokenization, retrieval, and answers work for Bangla (`ঀ–৿`) and
  English. The assistant replies in the language of the question.
- **Traceable:** every assistant message carries machine-readable citations rendered
  as cards linking to the exact source PDF and page.
- **Keyless degradation:** without an AI key the app still authenticates, retrieves,
  and returns the most relevant excerpts with full citations.

## Quick start

```bash
npm install
cp .env.example .env.local        # set AUTH_SECRET (npx auth secret) and keys

npm run crawl                     # fetch circular metadata from bb.org.bd
npm run ingest -- --limit 20      # download PDFs, extract/OCR, build the index
npm run search "remittance rules" # retrieval smoke test

npm run dev                       # http://localhost:3000
```

Demo sign-in: `demo@bb-circulars.app` / `demo1234` (configure via `DEMO_USERS`).

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `AUTH_SECRET` | yes | Auth.js JWT signing secret (`npx auth secret`) |
| `DEMO_USERS` | yes | `email:password` pairs for the demo credentials provider |
| `AI_GATEWAY_API_KEY` | recommended | Vercel AI Gateway key — enables AI answers + embeddings |
| `CHAT_MODEL` | no | default `anthropic/claude-sonnet-4.6` |
| `EMBEDDING_MODEL` | no | default `openai/text-embedding-3-small` |
| `OCR_SPACE_API_KEY` | for scanned PDFs | free key from [ocr.space/ocrapi](https://ocr.space/ocrapi) |

## Ingestion notes

- **Bot protection:** bb.org.bd uses an F5/TSPD JavaScript challenge that triggers on
  rapid requests. The crawler keeps a cookie session, jitters delays (4–8 s/PDF), and
  backs off 30 s → 90 s → 270 s on challenges. Progress is merged incrementally, so
  re-running is always safe.
- **Full 20-year backfill:** the default listing shows recent circulars. To backfill
  the archive, iterate the site's date-range search month by month and feed each
  result page through `crawl.ts --file <saved.html>` (or extend `LISTING_URL` with
  the archive query once you have a session). Expect a multi-hour, rate-limited run.
  At full-archive scale, move the index from `data/index.json` to Postgres +
  pgvector (the retrieval interface in `src/lib/retrieval/store.ts` is the only
  module to swap).
- **OCR:** image-based/scanned circulars (common for older ones) fall back to the
  free **OCR.space** API with Bengali and English language models. Free tier limits:
  1 MB/file, ~25k requests/month. For high volume, self-host Tesseract
  (`ben+eng` traineddata) instead.

## Security

- Auth.js v5 with JWT sessions; unauthenticated users are redirected to `/login`;
  `/api/chat` returns 401 without a session.
- Strict security headers (CSP, HSTS, `X-Frame-Options: DENY`, nosniff,
  referrer/permissions policies) in `next.config.ts`.
- No secrets in the repo; `.env*` is gitignored; answers are generated server-side —
  the AI key never reaches the client.
- **Before production:** replace `DEMO_USERS` with a real user store (bcrypt/argon2
  hashes) or SSO (Google/Microsoft via Auth.js providers), add rate limiting on
  `/api/chat` (e.g. Upstash Ratelimit), and enable Vercel BotID / WAF.

## Shipping to app stores

The app is an installable PWA (manifest + icons + standalone display):

- **Google Play:** wrap as a Trusted Web Activity with
  [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) or
  [PWABuilder](https://www.pwabuilder.com) — generates a signed AAB that passes Play
  review (ensure a deployed HTTPS origin + `assetlinks.json`).
- **Microsoft Store:** PWABuilder produces an MSIX directly.
- **iOS App Store:** PWABuilder's iOS package (WKWebView wrapper); Apple review
  expects some native capability — push notifications via the wrapper usually
  suffices.

## Deployment (Vercel)

```bash
vercel deploy            # preview
vercel deploy --prod     # production
```

Set `AUTH_SECRET`, `DEMO_USERS`, and `AI_GATEWAY_API_KEY` in the Vercel project.
The committed `data/index.json` ships with the deployment; re-run ingestion and
commit (or move to a database) to refresh the knowledge base.

## Project layout

```
src/app/api/chat/route.ts     RAG endpoint (citations as data parts)
src/lib/retrieval/            BM25 + hybrid search over data/index.json
src/lib/auth.ts               Auth.js configuration
src/components/               chat UI, citation cards, login form
scripts/crawl.ts              listing crawler (bot-challenge aware)
scripts/ingest.ts             PDF → text/OCR → chunks → index
data/index.json               committed demo knowledge base
docs/specs/                   design document
```
