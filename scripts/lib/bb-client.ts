/**
 * HTTP client for www.bb.org.bd. The site sits behind F5/TSPD bot protection
 * that serves a JavaScript challenge page when requests come too fast, so this
 * client keeps a cookie jar, sends browser-like headers, spaces requests with
 * jittered delays, and backs off when a challenge page is detected.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const cookies = new Map<string, string>();

function cookieHeader(): string {
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(res: Response) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

export function isChallengePage(body: string): boolean {
  return body.includes("bobcmn") || body.includes("/TSPD/");
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function jitter(baseMs: number): number {
  return baseMs + Math.floor(Math.random() * baseMs);
}

const BACKOFFS_MS = [30_000, 90_000, 270_000];

/** Fetches an HTML page, retrying with exponential backoff on bot challenges. */
export async function fetchPage(url: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,bn;q=0.8",
        ...(cookies.size > 0 ? { Cookie: cookieHeader() } : {}),
      },
      redirect: "follow",
    });
    storeCookies(res);
    const body = await res.text();
    if (!isChallengePage(body) && res.ok) return body;

    if (attempt >= BACKOFFS_MS.length) {
      throw new Error(
        `Bot challenge persisted after ${attempt} retries for ${url}. Re-run later — progress is saved incrementally.`,
      );
    }
    const wait = BACKOFFS_MS[attempt];
    console.warn(`  bot challenge / HTTP ${res.status} — backing off ${wait / 1000}s…`);
    await sleep(wait);
  }
}

/** Downloads a binary file (PDF). Returns null on persistent failure. */
export async function fetchPdf(url: string): Promise<Buffer | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "application/pdf,*/*",
          ...(cookies.size > 0 ? { Cookie: cookieHeader() } : {}),
        },
      });
      storeCookies(res);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        // A challenge page instead of a PDF starts with "<!DOCTYPE" / "<html".
        if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return buf;
        if (isChallengePage(buf.toString("latin1", 0, 4096))) {
          console.warn(`  challenge instead of PDF (attempt ${attempt + 1})`);
        } else {
          console.warn(`  not a PDF (attempt ${attempt + 1}): ${url}`);
        }
      } else {
        console.warn(`  HTTP ${res.status} (attempt ${attempt + 1}): ${url}`);
      }
    } catch (err) {
      console.warn(`  fetch error (attempt ${attempt + 1}):`, (err as Error).message);
    }
    await sleep(jitter(20_000));
  }
  return null;
}
