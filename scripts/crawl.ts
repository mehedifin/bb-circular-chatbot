/**
 * Crawls the Bangladesh Bank circular listing and writes circular metadata to
 * data/circulars.json (merging with any previous run, keyed by id).
 *
 * Usage:
 *   npx tsx scripts/crawl.ts                 # fetch the live listing page
 *   npx tsx scripts/crawl.ts --file <path>   # parse a saved HTML file instead
 *
 * The default listing page shows recent circulars. For the full 20-year
 * archive, the site's date-range search can be iterated month by month — see
 * README "Full backfill". Progress is merged incrementally, so the crawl can
 * be re-run any time without losing data.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fetchPage } from "./lib/bb-client";
import { parseListing, type ListedCircular } from "./lib/parse-listing";

const LISTING_URL = "https://www.bb.org.bd/en/index.php/mediaroom/circular";
const OUT = path.join(process.cwd(), "data", "circulars.json");

async function main() {
  const fileFlag = process.argv.indexOf("--file");
  let html: string;
  if (fileFlag !== -1) {
    html = readFileSync(process.argv[fileFlag + 1], "utf8");
    console.log(`Parsing saved listing: ${process.argv[fileFlag + 1]}`);
  } else {
    console.log(`Fetching ${LISTING_URL} …`);
    html = await fetchPage(LISTING_URL);
  }

  const found = parseListing(html);
  console.log(`Parsed ${found.length} circular entries.`);

  const existing: ListedCircular[] = existsSync(OUT)
    ? JSON.parse(readFileSync(OUT, "utf8"))
    : [];
  const byId = new Map(existing.map((c) => [c.id, c]));
  for (const c of found) byId.set(c.id, c);

  const merged = [...byId.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(merged, null, 2));
  console.log(`Wrote ${merged.length} circulars → ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
