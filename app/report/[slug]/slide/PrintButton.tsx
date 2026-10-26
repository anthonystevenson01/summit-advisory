"use client";

import { BRAND } from "@/app/lib/brand";

/** "Download as PDF" is the browser's print dialog, where Save as PDF lives. No library. */
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{ padding: "10px 22px", borderRadius: 6, border: "none", background: BRAND.brandGreen, color: BRAND.white, fontFamily: "var(--font-barlow-condensed), sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: "0.04em", cursor: "pointer" }}
    >
      Download as PDF
    </button>
  );
}
