/**
 * Seeds data/circulars.json from known circular PDF URLs (captured from the
 * live listing) when the listing page itself is behind a bot challenge.
 * Dates come from the filename convention (<mon><dd><yyyy>...); the
 * authoritative circular reference is read from each PDF's header during
 * `npm run ingest`. Safe to re-run: crawl.ts merges by id.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { departmentFromPdfUrl } from "./lib/departments";
import type { ListedCircular } from "./lib/parse-listing";

const PDF_URLS = [
  "https://www.bb.org.bd/mediaroom/circulars/fepd/jun112026fepd-111e.pdf",
  "https://www.bb.org.bd/mediaroom/circulars/brd/jun102026brd01.pdf",
  "https://www.bb.org.bd/mediaroom/circulars/acd/jun082026acd-101.pdf",
  "https://www.bb.org.bd/mediaroom/circulars/gbcrd/jun082026sfd03.pdf",
  "https://www.bb.org.bd/mediaroom/circulars/fepd-2/jun082026fepd-204e.pdf",
  "https://www.bb.org.bd/mediaroom/circulars/smespd/jun082026smespd04.pdf",
  "https://www.bb.org.bd/mediaroom/circulars/gbcrd/jun072026sfd02e.pdf",
  "https://www.bb.org.bd/mediaroom/circulars/brpd/jun042026brpd-113.pdf",
  "https://www.bb.org.bd/mediaroom/circulars/finincld/jun022026fidl01.pdf",
  "https://www.bb.org.bd/mediaroom/circulars/dmd/jun012026dmdl08e.pdf",
  "https://www.bb.org.bd/mediaroom/circulars/brpd/may242026brpd-1l19.pdf",
  "https://www.bb.org.bd/mediaroom/circulars/fepd-2/may242026fepd-23e.pdf",
  "https://www.bb.org.bd/mediaroom/circulars/smespd/may242026smespdl02.pdf",
  "https://www.bb.org.bd/mediaroom/circulars/spcd/may232026spcd06.pdf",
  "https://www.bb.org.bd/mediaroom/circulars/psd/may232026psd-1l02.pdf",
  "https://www.bb.org.bd/mediaroom/circulars/psd-2/may212026psd-2l04.pdf",
  "https://www.bb.org.bd/mediaroom/circulars/psd-2/may212026psd-202.pdf",
];

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function dateFromFilename(url: string): string {
  const m = url.split("/").pop()!.match(/^([a-z]{3})(\d{2})(\d{4})/);
  if (!m) return "unknown";
  return `${m[3]}-${MONTHS[m[1]] ?? "01"}-${m[2]}`;
}

const OUT = path.join(process.cwd(), "data", "circulars.json");

const seeded: ListedCircular[] = PDF_URLS.map((pdfUrl) => {
  const dept = departmentFromPdfUrl(pdfUrl);
  const id = pdfUrl.split("/").slice(-2).join("-").replace(/\.pdf$/i, "").toLowerCase();
  return {
    id,
    circularNo: `${dept.code} Circular (${id})`, // refined from PDF header at ingest
    title: `${dept.name} circular dated ${dateFromFilename(pdfUrl)}`,
    department: dept.name,
    departmentCode: dept.code,
    date: dateFromFilename(pdfUrl),
    pdfUrl,
  };
});

const existing: ListedCircular[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
const byId = new Map(existing.map((c) => [c.id, c]));
for (const c of seeded) if (!byId.has(c.id)) byId.set(c.id, c);

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify([...byId.values()], null, 2));
console.log(`Seeded ${byId.size} circulars → ${OUT}`);
