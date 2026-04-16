"use client";

interface Dimension {
  name: string;
  label: string;
  score: number;
  observation: string;
  fix?: string;
}

interface DimRowProps {
  dimension: Dimension;
  dark: boolean;
  accent?: string;
}

function scoreColor(score: number): string {
  if (score >= 8) return "#22c55e";
  if (score >= 6) return "#fbbf24";
  if (score >= 4) return "#f97316";
  return "#ef4444";
}

export default function DimRow({ dimension, dark, accent }: DimRowProps) {
  const { name, label, score, observation, fix } = dimension;
  const fg = dark ? "#fff" : "#053030";
  const bg = dark ? "rgba(255,255,255,0.05)" : "rgba(5,48,48,0.04)";
  const trackBg = dark ? "rgba(255,255,255,0.1)" : "rgba(5,48,48,0.1)";
  const fillColor = accent ?? scoreColor(score);

  return (
    <div className="tk-dim-row" style={{ background: bg, color: fg }}>
      <div className="tk-dim-row-top">
        <span className="tk-dim-name">{label || name}</span>
        <span className="tk-dim-score" style={{ color: fillColor }}>{score}/10</span>
      </div>
      <div className="tk-dim-bar-track" style={{ background: trackBg }}>
        <div
          className="tk-dim-bar-fill"
          style={{ width: `${score * 10}%`, background: fillColor }}
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={10}
          aria-label={`${label || name} score: ${score} out of 10`}
        />
      </div>
      <p className="tk-dim-observation">{observation}</p>
      {fix && <p className="tk-dim-fix">Fix: {fix}</p>}
    </div>
  );
}
