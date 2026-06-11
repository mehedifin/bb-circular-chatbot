/**
 * Downloads circular PDFs through a real (headful) Chromium via Playwright so
 * the F5/TSPD challenge on www.bb.org.bd actually executes.
 *
 * How it works: navigating to a PDF URL first returns a tiny TSPD stub served
 * with an application/pdf content type; its script sets the trust cookies and
 * reloads, after which Chrome's PDF viewer streams the real document. We
 * capture that stream by listening for any application/pdf response whose body
 * really starts with "%PDF-" (the stub's doesn't). Cached files in data/pdfs/
 * are skipped, so re-running is safe.
 *
 * Usage: npx tsx scripts/fetch-pdfs-browser.ts [--limit N]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import type { ListedCircular } from "./lib/parse-listing";

const DATA = path.join(process.cwd(), "data");
const PDF_DIR = path.join(DATA, "pdfs");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (base: number) => base + Math.floor(Math.random() * base);

/** Resolves with the first response on `page` that is a real PDF document. */
function capturePdf(page: Page, timeoutMs: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      page.off("response", onResponse);
      resolve(null);
    }, timeoutMs);
    const onResponse = async (res: import("playwright").Response) => {
      const ct = res.headers()["content-type"] ?? "";
      if (!ct.includes("application/pdf")) return;
      try {
        const buf = Buffer.from(await res.body());
        if (buf.length > 1024 && buf.subarray(0, 5).toString("latin1") === "%PDF-") {
          clearTimeout(timer);
          page.off("response", onResponse);
          resolve(buf);
        }
      } catch {
        /* body unavailable (e.g. the navigation stub) — keep waiting */
      }
    };
    page.on("response", onResponse);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;

  const listed: ListedCircular[] = JSON.parse(
    readFileSync(path.join(DATA, "circulars.json"), "utf8"),
  );
  const targets = listed.slice(0, limit).filter(
    (c) => !existsSync(path.join(PDF_DIR, `${c.id}.pdf`)),
  );
  if (targets.length === 0) {
    console.log("All PDFs already cached in data/pdfs/ — nothing to do.");
    return;
  }
  mkdirSync(PDF_DIR, { recursive: true });

  // Headful + AutomationControlled off: the TSPD challenge fingerprints
  // headless automation and never clears for it.
  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({ acceptDownloads: true, locale: "en-US" });
  const page = await context.newPage();

  page.on("download", (d) => {
    // Fallback path if Chromium decides to download instead of render.
    d.saveAs(path.join(PDF_DIR, "__download.pdf")).catch(() => {});
  });

  console.log("Opening bb.org.bd to pass the bot challenge…");
  await page.goto("https://www.bb.org.bd/en/index.php", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await sleep(8_000); // let the TSPD script finish setting its cookies
  console.log(`  page title after challenge: "${await page.title().catch(() => "?")}"`);

  let ok = 0;
  let failed = 0;
  for (const [i, item] of targets.entries()) {
    const dest = path.join(PDF_DIR, `${item.id}.pdf`);
    console.log(`[${i + 1}/${targets.length}] ${item.pdfUrl}`);
    let saved = false;

    for (let attempt = 0; attempt < 2 && !saved; attempt++) {
      const pdfPromise = capturePdf(page, 45_000);
      await page
        .goto(item.pdfUrl, {
          waitUntil: "commit",
          timeout: 60_000,
          referer: "https://www.bb.org.bd/en/index.php/mediaroom/circular",
        })
        .catch(() => {/* PDF navigations can abort into a download — fine */});
      const buf = await pdfPromise;

      if (buf) {
        writeFileSync(dest, buf);
        console.log(`  saved ${(buf.length / 1024).toFixed(0)} KB`);
        saved = true;
      } else {
        const dl = path.join(PDF_DIR, "__download.pdf");
        if (existsSync(dl) && readFileSync(dl).subarray(0, 5).toString("latin1") === "%PDF-") {
          writeFileSync(dest, readFileSync(dl));
          console.log("  saved via download fallback");
          saved = true;
        } else {
          console.warn(`  attempt ${attempt + 1}: no PDF stream captured — retrying`);
          await sleep(jitter(8_000));
        }
      }
    }

    if (saved) ok++;
    else {
      failed++;
      console.warn(`  FAILED: ${item.pdfUrl}`);
    }
    await sleep(jitter(4_000)); // politeness delay between PDFs
  }

  await browser.close();
  console.log(`\nDone: ${ok} downloaded, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
