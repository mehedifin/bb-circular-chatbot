"use client";

import { useState } from "react";
import type { Citation } from "@/lib/types";

export function CitationList({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState(false);
  // De-duplicate by document + page, preserving rank order.
  const unique = citations.filter(
    (c, i) => citations.findIndex((o) => o.docId === c.docId && o.page === c.page) === i,
  );
  const shown = open ? unique : unique.slice(0, 3);

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Sources · সূত্র
      </p>
      <div className="grid gap-1.5">
        {shown.map((c) => (
          <a
            key={`${c.docId}-${c.page}`}
            href={c.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-xl border border-emerald-700/15 bg-emerald-50/60 px-3 py-2 text-xs transition hover:border-emerald-700/40 hover:bg-emerald-50"
          >
            <span className="font-semibold text-emerald-900 group-hover:underline">
              {c.circularNo}
            </span>
            <span className="text-slate-600">
              {" "}
              — {c.department} · {c.date} · Page {c.page}
            </span>
            <span className="ml-1 inline-block text-emerald-700">↗ PDF</span>
          </a>
        ))}
      </div>
      {unique.length > 3 && (
        <button
          onClick={() => setOpen(!open)}
          className="text-[11px] font-medium text-emerald-700 hover:underline"
        >
          {open ? "Show fewer sources" : `Show all ${unique.length} sources`}
        </button>
      )}
    </div>
  );
}
