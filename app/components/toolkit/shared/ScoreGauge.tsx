"use client";

import { useState, useEffect } from "react";
import { getGrade } from "../data/dimensionConfig";

const BRAND = {
  darkGreen: "#053030",
  mid: "#666666",
};

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

interface ScoreGaugeProps {
  score: number;
  size?: number;
  animated?: boolean;
}

export default function ScoreGauge({ score, size = 180, animated = true }: ScoreGaugeProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const grade = getGrade(score);

  useEffect(() => {
    if (!animated) {
      setDisplayScore(score);
      return;
    }
    const duration = 1800;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * score));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [score, animated]);

  const radius = size * 0.38;
  const circumference = 2 * Math.PI * radius * 0.75;
  const offset = circumference - (displayScore / 100) * circumference;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={size} height={size * 0.85} viewBox={`0 0 ${size} ${size * 0.85}`}>
        <path
          d={describeArc(size / 2, size * 0.5, radius, -225, 45)}
          fill="none"
          stroke="#E8ECE9"
          strokeWidth={size * 0.06}
          strokeLinecap="round"
        />
        <path
          d={describeArc(size / 2, size * 0.5, radius, -225, 45)}
          fill="none"
          stroke={grade.color}
          strokeWidth={size * 0.06}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.1s ease" }}
        />
        <text
          x={size / 2}
          y={size * 0.45}
          textAnchor="middle"
          style={{ fontSize: size * 0.22, fontFamily: "'Oswald', sans-serif", fontWeight: 700, fill: BRAND.darkGreen }}
        >
          {displayScore}
        </text>
        <text
          x={size / 2}
          y={size * 0.58}
          textAnchor="middle"
          style={{ fontSize: size * 0.07, fontFamily: "'DM Sans', sans-serif", fill: BRAND.mid, letterSpacing: "0.05em", textTransform: "uppercase" }}
        >
          out of 100
        </text>
      </svg>
      <div style={{ marginTop: 4, padding: "6px 18px", borderRadius: 24, background: grade.color + "18", border: `1px solid ${grade.color}40` }}>
        <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, fontSize: 15, color: grade.color, letterSpacing: "0.03em" }}>
          {grade.label}
        </span>
      </div>
    </div>
  );
}
