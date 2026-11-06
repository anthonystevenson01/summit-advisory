"use client";

import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/app/lib/brand";
import { PROTOTYPE } from "@/app/lib/project-builder/copy";
import { SANS, btnAltSmall, btnSmall } from "./builder-styles";
import PrototypeFrame from "./PrototypeFrame";

export interface PrototypeViewerProps {
  html: string;
  /** The frame height in place, e.g. "min(60vh, 560px)". */
  height: string;
}

/**
 * Used by the read only view; the builder's tab frames the prototype
 * directly in its tall panel. The mockup label, the framed prototype and
 * "Open full screen": a fixed overlay with the same srcdoc (nothing
 * refetched), a Close button that takes focus when it opens, and Escape
 * to close.
 */
export default function PrototypeViewer({ html, height }: PrototypeViewerProps) {
  const [full, setFull] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!full) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  return (
    <div style={{ fontFamily: SANS }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "0 0 10px" }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: BRAND.teal, flex: "1 1 260px" }}>{PROTOTYPE.mockup}</p>
        <button type="button" onClick={() => setFull(true)} style={btnAltSmall}>
          {PROTOTYPE.openFull}
        </button>
      </div>
      {!full && <PrototypeFrame html={html} height={height} />}
      {full && (
        <div className="pb-proto-full" role="dialog" aria-modal="true" aria-label={PROTOTYPE.frameTitle} style={{ background: BRAND.darkGreen }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 16px" }}>
            <p style={{ margin: 0, fontSize: 14, color: BRAND.white }}>{PROTOTYPE.mockup}</p>
            <button ref={closeRef} type="button" onClick={() => setFull(false)} style={{ ...btnSmall, background: BRAND.white, color: BRAND.darkGreen, borderColor: BRAND.white }}>
              {PROTOTYPE.closeFull}
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <PrototypeFrame html={html} height="100%" />
          </div>
        </div>
      )}
    </div>
  );
}
