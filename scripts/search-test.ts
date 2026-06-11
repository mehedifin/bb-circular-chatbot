/**
 * Retrieval smoke test against the built index.
 * Usage: npx tsx scripts/search-test.ts "your query"
 */
import { searchCirculars, indexStats } from "../src/lib/retrieval/store";

async function main() {
  const query = process.argv.slice(2).join(" ") || "foreign exchange remittance rules";
  const stats = indexStats();
  console.log("Index:", stats);
  if (!stats.ready) return;

  const results = await searchCirculars(query, 5);
  console.log(`\nQuery: ${query}\n`);
  for (const r of results) {
    console.log(`• ${r.circularNo} | ${r.department} | ${r.date} | page ${r.page}`);
    console.log(`  ${r.snippet.slice(0, 160).replace(/\n/g, " ")}…\n`);
  }
}

main();
