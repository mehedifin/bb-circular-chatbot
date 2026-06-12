# Changelog

All notable changes to the BB Circular Assistant are documented here.
Versioning follows [SemVer](https://semver.org): every push to `master` bumps the
version in `package.json`, adds an entry below, and is tagged `vX.Y.Z` in git.

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
