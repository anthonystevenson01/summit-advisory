"use client";

import { useState } from "react";
import DimRow from "../shared/DimRow";
import NewsletterCapture from "../shared/NewsletterCapture";
import Loader from "../shared/Loader";
import ErrMsg from "../shared/ErrMsg";

const SURFACE = "#002030";
const ACCENT = "#34d399";
const FG = "#fff";

const MOAT_COLORS: Record<string, string> = {
  Strong: "#22c55e",
  Moderate: "#fbbf24",
  Thin: "#f97316",
  Exposed: "#ef4444",
};

interface Dimension {
  name: string;
  label: string;
  score: number;
  observation: string;
  fix?: string;
}

interface MoatResult {
  moat_rating: string;
  score: number;
  summary: string;
  strongest_dimension: string;
  weakest_dimension: string;
  thing_not_saying: string;
  priority_90_day: string;
  threat_18_month: string;
  dimensions: Dimension[];
}

interface Props {
  systemPrompt: string;
}

export default function MoatTool({ systemPrompt }: Props) {
  const [position, setPosition] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MoatResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showThreat, setShowThreat] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setResult(null);
    setShowThreat(false);
    try {
      const res = await fetch("/api/gtm/moat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position, competitors, systemPrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed.");
      setResult(data as MoatResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPosition(""); setCompetitors("");
    setResult(null); setError(null); setShowThreat(false);
  }

  const moatColor = result ? (MOAT_COLORS[result.moat_rating] ?? ACCENT) : ACCENT;

  return (
    <div className="tk-tool-surface" style={{ background: SURFACE, color: FG }}>
      <button className="tk-back-btn" onClick={reset} style={{ color: ACCENT }} aria-label="Back to toolkit hub">
        ← All Tools
      </button>

      {!result && !loading && (
        <form onSubmit={handleSubmit} className="tk-form">
          <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: 28, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 8, color: FG }}>
            Competitive Moat Rater
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 32, lineHeight: 1.7 }}>
            Describe your product and competitive position. Get a candid rating of how defensible you really are.
          </p>

          <div className="tk-form-group">
            <label className="tk-label" htmlFor="moat-position" style={{ color: "rgba(255,255,255,0.55)" }}>
              Product / Competitive Position *
            </label>
            <textarea
              id="moat-position"
              className="tk-textarea tk-input"
              rows={9}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Describe what you do, what makes you different, and why customers choose you over alternatives. Be honest — this analysis is only as good as your input."
              required
              maxLength={6000}
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: FG }}
            />
          </div>

          <div className="tk-form-group">
            <label className="tk-label" htmlFor="moat-competitors" style={{ color: "rgba(255,255,255,0.55)" }}>
              Primary Competitors (optional)
            </label>
            <input
              id="moat-competitors"
              className="tk-input"
              type="text"
              value={competitors}
              onChange={(e) => setCompetitors(e.target.value)}
              placeholder="e.g. Salesforce, HubSpot, internal spreadsheets"
              maxLength={500}
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: FG }}
            />
          </div>

          <button
            type="submit"
            className="tk-btn-primary"
            disabled={!position.trim()}
            style={{ background: ACCENT, color: "#002030", marginTop: 8 }}
          >
            Rate My Moat
          </button>
        </form>
      )}

      {loading && <Loader dark label="Rating your moat…" sub="Evaluating six dimensions" />}

      {error && !loading && (
        <ErrMsg msg={error} retry={() => setError(null)} dark />
      )}

      {result && !loading && (
        <div className="tk-results">
          {/* Header with hex score */}
          <div className="tk-grade-card" style={{ background: "rgba(255,255,255,0.05)", marginBottom: 24 }}>
            <div className="tk-hex-score">
              <svg className="tk-hex-svg" width="100" height="115" viewBox="0 0 100 115" aria-hidden="true">
                <polygon points="50,5 95,30 95,85 50,110 5,85 5,30" fill="none" stroke={moatColor} strokeWidth="2.5" />
                <text x="50" y="62" textAnchor="middle" dominantBaseline="middle" fill={moatColor} fontSize="28" fontFamily="Oswald, sans-serif" fontWeight="700">
                  {result.score}
                </text>
              </svg>
              <div className="tk-hex-meta">
                <div className="tk-hex-rating" style={{ color: moatColor }}>{result.moat_rating}</div>
                <div className="tk-hex-labels">
                  <div className="tk-hex-label-row" style={{ color: "rgba(255,255,255,0.65)" }}>
                    <strong>Strongest:</strong> {result.strongest_dimension}
                  </div>
                  <div className="tk-hex-label-row" style={{ color: "rgba(255,255,255,0.65)" }}>
                    <strong>Weakest:</strong> {result.weakest_dimension}
                  </div>
                </div>
              </div>
            </div>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.8)", lineHeight: 1.7 }}>{result.summary}</p>
          </div>

          {/* Dimensions */}
          <div className="tk-dim-rows">
            {result.dimensions.map((d) => (
              <DimRow key={d.name} dimension={d} dark accent={ACCENT} />
            ))}
          </div>

          {/* Thing not saying */}
          <div className="tk-panel" style={{ background: "rgba(251,191,36,0.08)", borderLeft: "4px solid #fbbf24" }}>
            <div className="tk-panel-label" style={{ color: "#fbbf24" }}>The Thing You&rsquo;re Not Saying Out Loud</div>
            <p className="tk-panel-text" style={{ color: FG }}>{result.thing_not_saying}</p>
          </div>

          {/* 90-day priority */}
          <div className="tk-panel" style={{ background: "rgba(52,211,153,0.08)", borderLeft: `4px solid ${ACCENT}` }}>
            <div className="tk-panel-label" style={{ color: ACCENT }}>90-Day Moat Priority</div>
            <p className="tk-panel-text" style={{ color: FG }}>{result.priority_90_day}</p>
          </div>

          {/* 18-month threat (collapsed) */}
          <div style={{ marginBottom: 24 }}>
            <button
              className="tk-collapse-bar"
              onClick={() => setShowThreat((v) => !v)}
              style={{ background: "rgba(239,68,68,0.08)", color: showThreat ? "#ef4444" : "rgba(255,255,255,0.5)", border: "1px solid rgba(239,68,68,0.3)" }}
              aria-expanded={showThreat}
              aria-controls="moat-threat"
            >
              <span>18-Month Threat Scenario</span>
              <span>{showThreat ? "▲ Hide" : "▼ Reveal"}</span>
            </button>
            {showThreat && (
              <div id="moat-threat" className="tk-panel" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderTop: "none", marginTop: 0 }}>
                <div className="tk-panel-label" style={{ color: "#ef4444" }}>18-Month Threat Scenario</div>
                <p className="tk-panel-text" style={{ color: FG }}>{result.threat_18_month}</p>
              </div>
            )}
          </div>

          <NewsletterCapture dark />

          <button
            className="tk-btn-ghost"
            onClick={reset}
            style={{ color: ACCENT, borderColor: ACCENT + "66", marginTop: 24 }}
            aria-label="Rate another moat"
          >
            Rate Another
          </button>
        </div>
      )}
    </div>
  );
}
