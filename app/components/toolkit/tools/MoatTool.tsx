"use client";

import { useState } from "react";
import DimRow from "../shared/DimRow";
import NewsletterCapture from "../shared/NewsletterCapture";
import Loader from "../shared/Loader";
import ErrMsg from "../shared/ErrMsg";

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

  const moatColor = result ? (MOAT_COLORS[result.moat_rating] ?? "#34d399") : "#34d399";

  return (
    <div className="inner">
      {!result && !loading && (
        <>
          <div className="inner-hero">
            <div className="inner-eyebrow">GTM Toolkit</div>
            <h1 className="inner-title">Competitive Moat Rater</h1>
            <p className="inner-lead">
              Describe your product and competitive position. Get a candid rating of how defensible you really are.
            </p>
          </div>

          <div className="inner-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="moat-position">
                  Product / Competitive Position *
                </label>
                <textarea
                  id="moat-position"
                  className="form-textarea"
                  rows={9}
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="Describe what you do, what makes you different, and why customers choose you over alternatives. Be honest — this analysis is only as good as your input."
                  required
                  maxLength={6000}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="moat-competitors">
                  Primary Competitors (optional)
                </label>
                <input
                  id="moat-competitors"
                  className="form-input"
                  type="text"
                  value={competitors}
                  onChange={(e) => setCompetitors(e.target.value)}
                  placeholder="e.g. Salesforce, HubSpot, internal spreadsheets"
                  maxLength={500}
                />
              </div>

              <button
                type="submit"
                className="submit-btn"
                disabled={!position.trim()}
              >
                Rate My Moat
              </button>
            </form>
          </div>
        </>
      )}

      {loading && <div className="inner-body"><Loader dark={false} label="Rating your moat…" sub="Evaluating six dimensions" /></div>}

      {error && !loading && (
        <div className="inner-body">
          <ErrMsg msg={error} retry={() => setError(null)} dark={false} />
        </div>
      )}

      {result && !loading && (
        <>
          <div className="inner-hero">
            <div className="inner-eyebrow">Competitive Moat Rater — Results</div>
            <h1 className="inner-title" style={{ color: moatColor }}>
              {result.moat_rating} &mdash; {result.score}/100
            </h1>
            <p className="inner-lead">{result.summary}</p>
          </div>

          <div className="inner-body">
            {/* Strongest / Weakest */}
            <div className="features" style={{ marginBottom: 32 }}>
              <div className="feature">
                <div className="feature-title">Strongest Dimension</div>
                <p className="feature-body">{result.strongest_dimension}</p>
              </div>
              <div className="feature" style={{ borderLeftColor: "#f97316" }}>
                <div className="feature-title" style={{ color: "#f97316" }}>Weakest Dimension</div>
                <p className="feature-body">{result.weakest_dimension}</p>
              </div>
            </div>

            {/* Dimensions */}
            <div className="section-label" style={{ marginBottom: 16 }}>Dimension Detail</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 40 }}>
              {result.dimensions.map((d) => (
                <DimRow key={d.name} dimension={d} dark={false} />
              ))}
            </div>

            {/* Thing not saying */}
            <div className="feature" style={{ borderLeftColor: "#fbbf24", marginBottom: 16 }}>
              <div className="feature-title" style={{ color: "#fbbf24" }}>The Thing You&rsquo;re Not Saying Out Loud</div>
              <p className="feature-body">{result.thing_not_saying}</p>
            </div>

            {/* 90-day priority */}
            <div className="feature" style={{ borderLeftColor: "var(--sage)", marginBottom: 32 }}>
              <div className="feature-title">90-Day Moat Priority</div>
              <p className="feature-body">{result.priority_90_day}</p>
            </div>

            {/* 18-month threat (collapsed by default) */}
            <div style={{ marginBottom: 32 }}>
              <button
                onClick={() => setShowThreat((v) => !v)}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  background: "var(--off)",
                  border: "1px solid var(--border)",
                  borderLeft: "3px solid #ef4444",
                  padding: "14px 20px",
                  cursor: "pointer",
                  color: showThreat ? "#ef4444" : "var(--forest)",
                }}
                aria-expanded={showThreat}
                aria-controls="moat-threat"
              >
                <span>18-Month Threat Scenario</span>
                <span>{showThreat ? "▲ Hide" : "▼ Reveal"}</span>
              </button>
              {showThreat && (
                <div
                  id="moat-threat"
                  className="feature"
                  style={{ borderTop: "none", borderLeftColor: "#ef4444" }}
                >
                  <div className="feature-title" style={{ color: "#ef4444" }}>18-Month Threat Scenario</div>
                  <p className="feature-body">{result.threat_18_month}</p>
                </div>
              )}
            </div>

            <NewsletterCapture dark={false} />

            <button
              className="submit-btn"
              onClick={reset}
              style={{ marginTop: 24 }}
              aria-label="Rate another moat"
            >
              Rate Another
            </button>
          </div>
        </>
      )}
    </div>
  );
}
