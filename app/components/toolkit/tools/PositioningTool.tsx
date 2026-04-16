"use client";

import { useState } from "react";
import DimRow from "../shared/DimRow";
import NewsletterCapture from "../shared/NewsletterCapture";
import Loader from "../shared/Loader";
import ErrMsg from "../shared/ErrMsg";

const SURFACE = "#0a1a14";
const ACCENT = "#86efac";
const FG = "#fff";

interface Dimension {
  name: string;
  label: string;
  score: number;
  observation: string;
  fix?: string;
}

interface PositioningResult {
  grade: string;
  overall_score: number;
  summary: string;
  strongest_element: string;
  core_weakness: string;
  test_question: string;
  suggested_rewrite?: string;
  dimensions: Dimension[];
}

interface Props {
  systemPrompt: string;
}

export default function PositioningTool({ systemPrompt }: Props) {
  const [statement, setStatement] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PositioningResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRewrite, setShowRewrite] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setResult(null);
    setShowRewrite(false);
    try {
      const res = await fetch("/api/gtm/positioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statement, context, systemPrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed.");
      setResult(data as PositioningResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStatement("");
    setContext("");
    setResult(null);
    setError(null);
    setShowRewrite(false);
  }

  function gradeColor(grade: string): string {
    const map: Record<string, string> = { A: "#22c55e", B: "#86efac", C: "#fbbf24", D: "#f97316", F: "#ef4444" };
    return map[grade] ?? ACCENT;
  }

  return (
    <div className="tk-tool-surface" style={{ background: SURFACE, color: FG }}>
      <button className="tk-back-btn" onClick={reset} style={{ color: ACCENT }} aria-label="Back to toolkit hub">
        ← All Tools
      </button>

      {!result && !loading && (
        <form onSubmit={handleSubmit} className="tk-form">
          <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: 28, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 8, color: FG }}>
            Positioning Statement Grader
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 32, lineHeight: 1.7 }}>
            Paste your positioning statement. Get a letter grade, a score, and six dimensions with specific feedback.
          </p>

          <div className="tk-form-group">
            <label className="tk-label" htmlFor="pos-statement" style={{ color: "rgba(255,255,255,0.55)" }}>
              Positioning Statement *
            </label>
            <textarea
              id="pos-statement"
              className="tk-textarea tk-input"
              rows={5}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="We help [customer] achieve [outcome] by [mechanism], unlike [alternative]."
              required
              maxLength={4000}
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: FG, resize: "vertical" }}
            />
          </div>

          <div className="tk-form-group">
            <label className="tk-label" htmlFor="pos-context" style={{ color: "rgba(255,255,255,0.55)" }}>
              Additional Context (optional)
            </label>
            <input
              id="pos-context"
              className="tk-input"
              type="text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g. Series B SaaS, selling to NHS trusts"
              maxLength={500}
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: FG }}
            />
          </div>

          <button
            type="submit"
            className="tk-btn-primary"
            disabled={!statement.trim()}
            style={{ background: ACCENT, color: SURFACE, marginTop: 8 }}
          >
            Grade This Statement
          </button>
        </form>
      )}

      {loading && <Loader dark label="Grading your statement…" sub="Evaluating six dimensions" />}

      {error && !loading && (
        <ErrMsg msg={error} retry={() => { setError(null); }} dark />
      )}

      {result && !loading && (
        <div className="tk-results">
          {/* Grade card */}
          <div className="tk-grade-card" style={{ background: "rgba(255,255,255,0.05)", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 8 }}>
              <span className="tk-grade-letter" style={{ color: gradeColor(result.grade) }}>{result.grade}</span>
              <span className="tk-grade-score" style={{ color: "rgba(255,255,255,0.55)" }}>{result.overall_score}/100</span>
            </div>
            <p className="tk-grade-summary" style={{ color: "rgba(255,255,255,0.8)" }}>{result.summary}</p>
            {result.dimensions.length > 0 && (
              <div className="tk-mini-bars" style={{ marginTop: 24 }}>
                {result.dimensions.map((d) => (
                  <div className="tk-mini-bar-row" key={d.name}>
                    <span className="tk-mini-bar-label" style={{ color: "rgba(255,255,255,0.55)" }}>{d.label || d.name}</span>
                    <div className="tk-mini-bar-track" style={{ background: "rgba(255,255,255,0.1)" }}>
                      <div className="tk-mini-bar-fill" style={{ width: `${d.score * 10}%`, background: ACCENT }} />
                    </div>
                    <span className="tk-mini-bar-num" style={{ color: ACCENT }}>{d.score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Strongest / Core weakness */}
          <div className="tk-two-col">
            <div className="tk-info-card" style={{ background: "rgba(134,239,172,0.08)", borderLeft: `3px solid ${ACCENT}` }}>
              <div className="tk-info-card-label" style={{ color: ACCENT }}>Strongest Element</div>
              <p className="tk-info-card-text" style={{ color: FG }}>{result.strongest_element}</p>
            </div>
            <div className="tk-info-card" style={{ background: "rgba(239,68,68,0.08)", borderLeft: "3px solid #ef4444" }}>
              <div className="tk-info-card-label" style={{ color: "#ef4444" }}>Core Weakness</div>
              <p className="tk-info-card-text" style={{ color: FG }}>{result.core_weakness}</p>
            </div>
          </div>

          {/* Dimensions */}
          <div className="tk-dim-rows">
            {result.dimensions.map((d) => (
              <DimRow key={d.name} dimension={d} dark accent={ACCENT} />
            ))}
          </div>

          {/* Test question */}
          <div className="tk-panel" style={{ background: "#005A66", borderLeft: "none" }}>
            <div className="tk-panel-label" style={{ color: "rgba(255,255,255,0.55)" }}>Test Question</div>
            <p className="tk-panel-text" style={{ color: FG, fontStyle: "italic" }}>{result.test_question}</p>
          </div>

          {/* Suggested rewrite (collapsed) */}
          {result.suggested_rewrite && result.overall_score < 75 && (
            <div style={{ marginBottom: 24 }}>
              <button
                className="tk-collapse-bar"
                onClick={() => setShowRewrite((v) => !v)}
                style={{ background: "rgba(134,239,172,0.1)", color: ACCENT, border: `1px solid ${ACCENT}44` }}
                aria-expanded={showRewrite}
                aria-controls="positioning-rewrite"
              >
                <span>Suggested Rewrite Available</span>
                <span>{showRewrite ? "▲" : "→"}</span>
              </button>
              {showRewrite && (
                <div id="positioning-rewrite" className="tk-panel" style={{ background: "rgba(134,239,172,0.05)", border: `1px solid ${ACCENT}33`, marginTop: 0 }}>
                  <div className="tk-panel-label" style={{ color: ACCENT }}>Suggested Rewrite</div>
                  <p className="tk-panel-text" style={{ color: FG }}>{result.suggested_rewrite}</p>
                </div>
              )}
            </div>
          )}

          <NewsletterCapture dark />

          <button
            className="tk-btn-ghost"
            onClick={reset}
            style={{ color: ACCENT, borderColor: ACCENT + "66", marginTop: 24 }}
            aria-label="Grade another positioning statement"
          >
            Grade Another
          </button>
        </div>
      )}
    </div>
  );
}
