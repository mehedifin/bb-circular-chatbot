import type { UIMessage } from "ai";

/** One Bangladesh Bank circular (a single PDF document). */
export interface CircularDoc {
  id: string;
  /** e.g. "BRPD Circular No. 11" or "FEPD Circular Letter No. 11" */
  circularNo: string;
  title: string;
  /** Full department name, e.g. "Banking Regulation and Policy Department" */
  department: string;
  /** Short code, e.g. "BRPD" */
  departmentCode: string;
  /** ISO date the circular was issued, e.g. "2026-06-11" */
  date: string;
  pdfUrl: string;
  lang: "bn" | "en" | "mixed";
  pages: number;
}

/** A retrievable slice of a circular, aligned to a single PDF page. */
export interface Chunk {
  id: string;
  docId: string;
  page: number;
  text: string;
  embedding?: number[];
}

export interface CircularIndex {
  builtAt: string;
  docs: CircularDoc[];
  chunks: Chunk[];
}

/** Source reference returned with every answer. */
export interface Citation {
  docId: string;
  circularNo: string;
  title: string;
  department: string;
  date: string;
  page: number;
  pdfUrl: string;
  snippet: string;
}

/** Chat message type: assistant messages carry a `data-citations` part. */
export type ChatUIMessage = UIMessage<
  never,
  {
    citations: Citation[];
    notice: { message: string };
  }
>;
