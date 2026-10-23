"use client";

import { BRAND } from "@/app/lib/brand";
import ScoreGauge from "./ScoreGauge";

export type ConfidenceLevel = "low" | "medium" | "high";

interface ResultBlockProps {
  score: number;
  grade: number;
  label: string;
  legacyLabel?: string;
  verdict: string;
  confidence: ConfidenceLevel;
  confidenceReason?: string;
}

const CONFIDENCE_COLOURS: Record<ConfidenceLevel, string> = {
  low: BRAND.red,
  medium: BRAND.amber,
  high: BRAND.brandGreen,
};

const CONFIDENCE_TEXT: Record<ConfidenceLevel, string> = {
  low: "Low confidence: the input gave little evidence, so treat the scores as a first read.",
  medium: "Medium confidence: the input covered most dimensions but left some to inference.",
  high: "High confidence: the input gave enough evidence to score every dimension.",
};

const chipStyle = (colour: string) => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 14px",
  borderRadius: 20,
  background: `${colour}18`,
  border: `1px solid ${colour}40`,
  color: colour,
  fontFamily: "var(--font-oswald), sans-serif",
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "0.04em",
});

/**
 * The standard result block every tool shows: score gauge, grade 1 to 5,
 * label, legacy label where the tool has one, verdict and confidence.
 */
export default function ResultBlock({ score, grade, label, legacyLabel, verdict, confidence, confidenceReason }: ResultBlockProps) {
  const confidenceColour = CONFIDENCE_COLOURS[confidence] ?? BRAND.mid;
  return (
    <div style={{ textAlign: "center", marginBottom: 28 }}>
      <ScoreGauge score={score} size={200} />
      <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <span style={chipStyle(BRAND.teal)} title={label} aria-label={`Grade ${grade} of 5, ${label}`}>Grade {grade} of 5</span>
        {legacyLabel && <span style={chipStyle(BRAND.darkGreen)}>{legacyLabel}</span>}
        <span style={chipStyle(confidenceColour)}>{confidence} confidence</span>
      </div>
      <p style={{ fontSize: 16, color: BRAND.dark, marginTop: 18, lineHeight: 1.55, maxWidth: 560, marginLeft: "auto", marginRight: "auto", fontWeight: 500 }}>
        {verdict}
      </p>
      <p style={{ fontSize: 12, color: BRAND.mid, marginTop: 8, lineHeight: 1.5, maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
        {confidenceReason && confidenceReason.length > 0 ? confidenceReason : CONFIDENCE_TEXT[confidence] ?? ""}
      </p>
    </div>
  );
}
