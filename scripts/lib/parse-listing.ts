import * as cheerio from "cheerio";
import { departmentFromPdfUrl } from "./departments";

export interface ListedCircular {
  id: string;
  circularNo: string;
  title: string;
  department: string;
  departmentCode: string;
  date: string; // ISO
  pdfUrl: string;
}

/** "08/06/26" or "08-06-2026" → "2026-06-08" (BB lists dates day-first). */
function toIsoDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const year = y.length === 2 ? `20${y}` : y;
  return `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function idFromPdfUrl(pdfUrl: string): string {
  return pdfUrl
    .split("/")
    .slice(-2)
    .join("-")
    .replace(/\.pdf$/i, "")
    .toLowerCase();
}

/** Best-effort circular reference from the title cell, else from the filename. */
function deriveCircularNo(title: string, pdfUrl: string, deptCode: string): string {
  const inTitle = title.match(
    /((?:[A-Z]{2,8}(?:\([^)]+\))?\s+)?Circular(?:\s+Letter)?\s*(?:No\.?|Number)?\s*[-:]?\s*\d+[A-Za-z]?)/i,
  );
  if (inTitle) return inTitle[1].replace(/\s+/g, " ").trim();

  const file = pdfUrl.split("/").pop()?.replace(/\.pdf$/i, "") ?? "";
  // Filename convention: <mon><dd><yyyy><dept><[-series]><l for letter><number>[e]
  const tail = file.replace(/^[a-z]{3}\d{6,8}/i, "");
  const isLetter = /l\d+e?$/i.test(tail);
  const num = tail.match(/(\d+)e?$/)?.[1] ?? "?";
  return `${deptCode} Circular${isLetter ? " Letter" : ""} No. ${parseInt(num, 10)}`;
}

/**
 * Parses the circular listing page. Defensive against column-count variation:
 * any table row containing a PDF link is treated as a circular; the date is
 * the first dd/mm/yy cell, the title is the longest plain-text cell.
 */
export function parseListing(html: string): ListedCircular[] {
  const $ = cheerio.load(html);
  const out: ListedCircular[] = [];
  const seen = new Set<string>();

  $("tr").each((_, tr) => {
    const cells = $(tr).find("td");
    if (cells.length === 0) return;

    const pdfLinks = $(tr)
      .find('a[href$=".pdf"], a[href$=".PDF"]')
      .map((_, a) => $(a).attr("href")!)
      .get()
      .map((href) => new URL(href, "https://www.bb.org.bd/").toString());
    if (pdfLinks.length === 0) return;

    let date: string | null = null;
    let title = "";
    cells.each((_, td) => {
      const text = $(td).text().replace(/\s+/g, " ").trim();
      if (!date) date = toIsoDate(text);
      const hasLink = $(td).find("a").length > 0;
      if (!hasLink && !toIsoDate(text) && text.length > title.length && text !== "Not Available") {
        title = text;
      }
    });

    for (const pdfUrl of pdfLinks) {
      const id = idFromPdfUrl(pdfUrl);
      if (seen.has(id)) continue;
      seen.add(id);
      const dept = departmentFromPdfUrl(pdfUrl);
      out.push({
        id,
        circularNo: deriveCircularNo(title, pdfUrl, dept.code),
        title: title || `Circular ${id}`,
        department: dept.name,
        departmentCode: dept.code,
        date: date ?? "unknown",
        pdfUrl,
      });
    }
  });

  return out;
}
