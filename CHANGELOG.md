# Changelog

All notable changes to the BB Circular Assistant are documented here.
Versioning follows [SemVer](https://semver.org): every push to `master` bumps the
version in `package.json`, adds an entry below, and is tagged `vX.Y.Z` in git.

## v0.4.0 — 2026-06-12

- AI answers enabled in production: AI Gateway unlocked (free tier), chat model
  set to `anthropic/claude-haiku-4.5` via `CHAT_MODEL` (the free tier does not
  include Claude Sonnet; switch `CHAT_MODEL` back after upgrading to paid
  credits for unrestricted access).
- Embeddings remain off — the free tier rate-limits `openai/text-embedding-3-small`
  too aggressively for ingestion, so retrieval stays BM25-only. Re-run
  `npm run ingest` after upgrading to add hybrid (vector) retrieval.
- Index rebuilt (16 docs, 166 chunks).

## v0.3.0 — 2026-06-12

- AI Gateway auth now accepts `AI_GATEWAY_API_KEY` **or** Vercel's auto-provisioned
  `VERCEL_OIDC_TOKEN`, so AI answers activate without code changes once the
  Vercel account unlocks AI Gateway billing.
- Gateway call failures degrade to the extractive answer with citations instead
  of a bare error; embedding failures no longer abort `npm run ingest`.
- Added `scripts/gateway-test.ts` (gateway text + embedding connectivity check).
- Deployed to production: https://bb-circular-chatbot.vercel.app

## v0.2.0 — 2026-06-12

- Knowledge base built: 16 of 17 recent circulars indexed (166 page-aligned
  chunks) in committed `data/index.json`; bilingual retrieval verified.
- Added `scripts/fetch-pdfs-browser.ts`: bb.org.bd's F5/TSPD challenge blocks
  plain HTTP, so PDFs are fetched through a real headful Chromium (Playwright),
  capturing the viewer's PDF stream after the challenge sets trust cookies.
- OCR.space calls switched to engine 2 (engine 1 has no Bengali model).

## v0.1.0 — 2026-06-11

- Initial implementation: Next.js 16 PWA with Auth.js v5 credentials login,
  streaming chat UI with citation cards, bilingual (Bangla/English) BM25 + RRF
  hybrid retrieval, `data-citations` UI message parts, crawler with
  bot-challenge backoff, PDF→text/OCR ingestion pipeline, security headers,
  and keyless extractive fallback mode.
