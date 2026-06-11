/**
 * Builds the retrieval index from crawled circular metadata:
 *   1. downloads each PDF (rate-limited, cached in data/pdfs/)
 *   2. extracts per-page text with pdf-parse
 *   3. falls back to OCR.space (free online OCR, Bangla + English) for
 *      scanned/image-based PDFs
 *   4. chunks page-aligned text (~1,400 chars, 200 overlap)
 *   5. optionally embeds chunks via Vercel AI Gateway when AI_GATEWAY_API_KEY
 *      is set (BM25 works without embeddings)
 *   6. writes data/index.json
 *
 * Usage:
 *   npx tsx scripts/ingest.ts [--limit N] [--skip-ocr] [--skip-embed]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import { fetchPdf, jitter, sleep } from "./lib/bb-client";
import type { ListedCircular } from "./lib/parse-listing";

// Self-contained copies of the app's index types (scripts stay decoupled from src/).
interface Chunk {
  id: string;
  docId: string;
  page: number;
  text: string;
  embedding?: number[];
}

const DATA = path.join(process.cwd(), "data");
const PDF_DIR = path.join(DATA, "pdfs");
const INDEX_OUT = path.join(DATA, "index.json");

const CHUNK_SIZE = 1400;
const CHUNK_OVERLAP = 200;
const MIN_CHARS_PER_PAGE = 200; // below this, assume a scanned page → OCR

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

function detectDocLang(text: string): "bn" | "en" | "mixed" {
  let bn = 0;
  let en = 0;
  for (const ch of text.slice(0, 20000)) {
    const c = ch.codePointAt(0)!;
    if (c >= 0x0980 && c <= 0x09ff) bn++;
    else if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) en++;
  }
  if (bn === 0) return "en";
  if (en === 0) return "bn";
  const ratio = bn / (bn + en);
  return ratio > 0.8 ? "bn" : ratio < 0.2 ? "en" : "mixed";
}

async function extractPages(buffer: Buffer): Promise<{ num: number; text: string }[]> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.pages.map((p) => ({ num: p.num, text: p.text.trim() }));
  } finally {
    await parser.destroy?.();
  }
}

/** OCR.space free API: accepts PDFs directly, returns text per page. */
async function ocrSpacePdf(
  buffer: Buffer,
  language: "eng" | "ben",
): Promise<{ num: number; text: string }[] | null> {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    console.warn("  OCR skipped: OCR_SPACE_API_KEY not set");
    return null;
  }
  if (buffer.length > 1024 * 1024) {
    console.warn("  OCR skipped: PDF exceeds OCR.space free-tier 1 MB limit");
    return null;
  }
  try {
    const form = new FormData();
    form.append("apikey", apiKey);
    // OCR.space engine 1 has no Bengali model ("E201 invalid language");
    // engine 2 auto-detects the language, so omit the parameter for Bangla.
    if (language === "eng") form.append("language", language);
    form.append("OCREngine", "2");
    form.append("isOverlayRequired", "false");
    form.append("filetype", "PDF");
    form.append("file", new Blob([new Uint8Array(buffer)], { type: "application/pdf" }), "doc.pdf");
    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: form,
    });
    const json = (await res.json()) as {
      IsErroredOnProcessing?: boolean;
      ErrorMessage?: string | string[];
      ParsedResults?: { ParsedText: string }[];
    };
    if (json.IsErroredOnProcessing || !json.ParsedResults) {
      console.warn("  OCR.space error:", json.ErrorMessage);
      return null;
    }
    return json.ParsedResults.map((r, i) => ({ num: i + 1, text: (r.ParsedText ?? "").trim() }));
  } catch (err) {
    console.warn("  OCR.space request failed:", (err as Error).message);
    return null;
  }
}

/**
 * BB circulars print their reference in the header of page 1, e.g.
 * "BRPD Circular Letter No-19" or "এসিডি সার্কুলার নং-০১". When found, that
 * authoritative reference overrides the filename-derived guess.
 */
function circularNoFromText(pageOneText: string): string | null {
  const en = pageOneText.match(
    /([A-Z]{2,8}(?:\s*-\s*\d)?\s+Circular(?:\s+Letter)?\s*(?:No\.?|Number)?\s*[-:–]?\s*\d+)/i,
  );
  if (en) return en[1].replace(/\s+/g, " ").trim();
  const bn = pageOneText.match(
    /([ঀ-৿]{2,12}(?:\s*-\s*[০-৯\d])?\s*সার্কুলার(?:\s*লেটার)?\s*(?:নং|নাম্বার)?\s*[-:–]?\s*[০-৯\d]+)/,
  );
  if (bn) return bn[1].replace(/\s+/g, " ").trim();
  return null;
}

function chunkPage(docId: string, page: number, text: string): Chunk[] {
  const clean = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const chunks: Chunk[] = [];
  let start = 0;
  let part = 0;
  while (start < clean.length) {
    const end = Math.min(start + CHUNK_SIZE, clean.length);
    chunks.push({
      id: `${docId}#p${page}.${part}`,
      docId,
      page,
      text: clean.slice(start, end),
    });
    if (end >= clean.length) break;
    start = end - CHUNK_OVERLAP;
    part++;
  }
  return chunks;
}

async function embedChunks(chunks: Chunk[]) {
  // Gateway auth: explicit key, or the OIDC token from `vercel env pull`.
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    console.log("Embeddings skipped (no gateway auth) — BM25 retrieval will be used.");
    return;
  }
  const { embedMany } = await import("ai");
  const model = process.env.EMBEDDING_MODEL ?? "openai/text-embedding-3-small";
  const BATCH = 64;
  try {
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      const { embeddings } = await embedMany({
        model,
        values: batch.map((c) => c.text.slice(0, 6000)),
      });
      batch.forEach((c, j) => (c.embedding = embeddings[j]));
      console.log(`  embedded ${Math.min(i + BATCH, chunks.length)}/${chunks.length}`);
    }
  } catch (err) {
    console.warn(`Embeddings failed (${(err as Error).message}) — continuing with BM25 only.`);
    for (const c of chunks) delete c.embedding;
  }
}

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;
  const skipOcr = args.includes("--skip-ocr");
  const skipEmbed = args.includes("--skip-embed");

  const circularsFile = path.join(DATA, "circulars.json");
  if (!existsSync(circularsFile)) {
    throw new Error("data/circulars.json not found — run `npm run crawl` first.");
  }
  const listed: ListedCircular[] = JSON.parse(readFileSync(circularsFile, "utf8"));
  const targets = listed.slice(0, limit);
  mkdirSync(PDF_DIR, { recursive: true });

  const docs = [];
  const chunks: Chunk[] = [];

  for (const [i, item] of targets.entries()) {
    console.log(`[${i + 1}/${targets.length}] ${item.circularNo} (${item.date})`);
    const pdfPath = path.join(PDF_DIR, `${item.id}.pdf`);

    let buffer: Buffer;
    if (existsSync(pdfPath)) {
      buffer = readFileSync(pdfPath);
    } else {
      const downloaded = await fetchPdf(item.pdfUrl);
      if (!downloaded) {
        console.warn(`  SKIP: could not download ${item.pdfUrl}`);
        continue;
      }
      writeFileSync(pdfPath, downloaded);
      buffer = downloaded;
      await sleep(jitter(4000)); // be polite to bb.org.bd
    }

    let pages: { num: number; text: string }[];
    try {
      pages = await extractPages(buffer);
    } catch (err) {
      console.warn(`  SKIP: PDF parse failed — ${(err as Error).message}`);
      continue;
    }

    const totalChars = pages.reduce((sum, p) => sum + p.text.length, 0);
    const avgPerPage = pages.length > 0 ? totalChars / pages.length : 0;
    if (avgPerPage < MIN_CHARS_PER_PAGE && !skipOcr) {
      console.log(`  scanned PDF detected (${Math.round(avgPerPage)} chars/page) → OCR.space`);
      const lang = item.pdfUrl.match(/e\.pdf$/i) ? "eng" : "ben";
      const ocrPages = await ocrSpacePdf(buffer, lang);
      if (ocrPages && ocrPages.some((p) => p.text.length > 50)) {
        pages = ocrPages;
      } else if (totalChars < 100) {
        console.warn("  SKIP: no extractable text and OCR unavailable/failed");
        continue;
      }
    }

    const fullText = pages.map((p) => p.text).join("\n");
    const refFromText = pages[0] ? circularNoFromText(pages[0].text) : null;
    if (refFromText) console.log(`  reference from PDF header: ${refFromText}`);
    docs.push({
      id: item.id,
      circularNo: refFromText ?? item.circularNo,
      title: item.title,
      department: item.department,
      departmentCode: item.departmentCode,
      date: item.date,
      pdfUrl: item.pdfUrl,
      lang: detectDocLang(fullText),
      pages: pages.length,
    });
    for (const page of pages) chunks.push(...chunkPage(item.id, page.num, page.text));
    console.log(`  ok: ${pages.length} pages, ${chunks.length} total chunks so far`);
  }

  if (!skipEmbed) await embedChunks(chunks);

  const index = { builtAt: new Date().toISOString(), docs, chunks };
  writeFileSync(INDEX_OUT, JSON.stringify(index));
  console.log(
    `\nIndex written → ${INDEX_OUT}\n  documents: ${docs.length}\n  chunks: ${chunks.length}\n  embeddings: ${chunks.filter((c) => c.embedding).length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
