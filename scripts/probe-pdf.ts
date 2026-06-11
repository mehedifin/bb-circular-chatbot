/**
 * Diagnostic: navigate to one circular PDF URL and dump everything the browser
 * sees (response bodies, final URL, page HTML, cookies) to data/raw/probe/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const OUT = path.join(process.cwd(), "data", "raw", "probe");
const PDF_URL = "https://www.bb.org.bd/mediaroom/circulars/fepd/jun112026fepd-111e.pdf";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({ acceptDownloads: true, locale: "en-US" });
  const page = await context.newPage();

  let n = 0;
  page.on("response", async (res) => {
    const i = ++n;
    try {
      const body = await res.body();
      const ct = res.headers()["content-type"] ?? "?";
      console.log(`[res ${i}] ${res.status()} ${ct} ${body.length}B ${res.url().slice(0, 120)}`);
      if (res.url().includes(".pdf") || body.length < 5000) {
        writeFileSync(path.join(OUT, `res-${i}.txt`), body);
      }
    } catch {
      console.log(`[res ${i}] ${res.status()} (body unavailable) ${res.url().slice(0, 120)}`);
    }
  });
  page.on("download", async (d) => {
    console.log("[download]", d.suggestedFilename());
    await d.saveAs(path.join(OUT, d.suggestedFilename()));
  });

  console.log("→ homepage");
  await page.goto("https://www.bb.org.bd/en/index.php", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await sleep(6_000);
  console.log("title:", await page.title());

  console.log("→ PDF URL");
  await page
    .goto(PDF_URL, { waitUntil: "commit", timeout: 60_000, referer: "https://www.bb.org.bd/en/index.php/mediaroom/circular" })
    .catch((e: Error) => console.log("goto:", e.message.split("\n")[0]));
  await sleep(20_000);
  console.log("final URL:", page.url());
  const html = await page.content().catch(() => "(unavailable)");
  writeFileSync(path.join(OUT, "final-page.html"), html);
  console.log("final page length:", html.length);
  const cookies = await context.cookies();
  console.log("cookies:", cookies.map((c) => c.name).join(", "));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
