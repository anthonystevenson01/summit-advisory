"use client";

import { useState, useEffect } from "react";

const BRAND = {
  darkGreen: "#053030",
  mid: "#666666",
  border: "#D0D5D2",
  brandGreen: "#319A65",
  amber: "#D4A017",
  red: "#C0392B",
};

export interface GtmDimensionBarProps {
  name: string;
  score: number;
  levelLabel: string;
  locked: boolean;
}

export default function GtmDimensionBar({ name, score, levelLabel, locked }: GtmDimensionBarProps) {
  const [width, setWidth] = useState(0);
  const pct = (score / 5) * 100;
  const barColor = score >= 4 ? BRAND.brandGreen : score === 3 ? BRAND.amber : BRAND.red;

  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 100);
    return () => clearTimeout(t);
  }, [pct]);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "baseline" }}>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: BRAND.darkGreen }}>{name}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {!locked && (
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: BRAND.mid, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {levelLabel}
            </span>
          )}
          <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 600, color: locked ? BRAND.mid : BRAND.darkGreen }}>
            {locked ? "?" : `${score}/5`}
          </span>
        </div>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: "#E8ECE9", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            borderRadius: 4,
            background: locked ? BRAND.border : barColor,
            width: locked ? "40%" : `${width}%`,
            transition: "width 1.2s cubic-bezier(0.22, 1, 0.36, 1)",
            filter: locked ? "blur(4px)" : "none",
          }}
        />
      </div>
    </div>
  );
}
