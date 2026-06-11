/**
 * Bangladesh Bank department codes as used in circular PDF paths
 * (https://www.bb.org.bd/mediaroom/circulars/<code>/...). Unknown codes fall
 * back to the upper-cased code so ingestion never blocks on the mapping.
 */
const DEPARTMENTS: Record<string, string> = {
  brpd: "Banking Regulation and Policy Department",
  brd: "Bank Resolution Department",
  fepd: "Foreign Exchange Policy Department",
  feod: "Foreign Exchange Operation Department",
  feid: "Foreign Exchange Investment Department",
  dfim: "Department of Financial Institutions and Markets",
  dos: "Department of Off-site Supervision",
  dbi: "Department of Banking Inspection",
  acd: "Agricultural Credit Department",
  smespd: "SME and Special Programmes Department",
  dmd: "Debt Management Department",
  psd: "Payment Systems Department",
  sfd: "Sustainable Finance Department",
  gbcrd: "Sustainable Finance Department (Green Banking and CSR)",
  dcm: "Department of Currency Management",
  mpd: "Monetary Policy Department",
  bfiu: "Bangladesh Financial Intelligence Unit",
  cib: "Credit Information Bureau",
  finincld: "Financial Inclusion Department",
  fid: "Financial Institutions Department",
  spcd: "Secretariat and Protocol Coordination Department",
  ics: "Internal Control and Compliance Department",
  bb: "Bangladesh Bank",
};

export function departmentFromPdfUrl(pdfUrl: string): { code: string; name: string } {
  const match = pdfUrl.match(/\/circulars\/([a-z0-9-]+)\//i);
  const dir = (match?.[1] ?? "bb").toLowerCase();
  const base = dir.replace(/-\d+$/, ""); // "fepd-2" → "fepd", "psd-2" → "psd"
  const name = DEPARTMENTS[base] ?? `${base.toUpperCase()} Department`;
  return { code: base.toUpperCase(), name };
}
