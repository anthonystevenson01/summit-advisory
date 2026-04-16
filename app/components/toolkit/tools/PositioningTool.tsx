"use client";

import { useState } from "react";
import DimRow from "../shared/DimRow";
import NewsletterCapture from "../shared/NewsletterCapture";
import Loader from "../shared/Loader";
import ErrMsg from "../shared/ErrMsg";

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
    return map[grade] ?? "#86efac";
  }

  return (
    <div className="inner">
      {!result && !loading && (
        <>
          <div className="inner-hero">
            <div className="inner-eyebrow">GTM Toolkit</div>
            <h1 className="inner-title">Positioning Statement Grader</h1>
            <p className="inner-lead">
              Paste your positioning statement. Get a letter grade, a score, and six dimensions with specific feedback.
            </p>
          </div>

          <div className="inner-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="pos-statement">
                  Positioning Statement *
                </label>
                <textarea
                  id="pos-statement"
                  className="form-textarea"
                  rows={5}
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  placeholder="We help [customer] achieve [outcome] by [mechanism], unlike [alternative]."
                  required
                  maxLength={4000}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pos-context">
                  Additional Context (optional)
                </label>
                <input
                  id="pos-context"
                  className="form-input"
                  type="text"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g. Series B SaaS, selling to NHS trusts"
                  maxLength={500}
                />
              </div>

              <button
                type="submit"
                className="submit-btn"
                disabled={!statement.trim()}
              >
                Grade This Statement
              </button>
            </form>
          </div>
        </>
      )}

      {loading && <div className="inner-body"><Loader dark={false} label="Grading your statement…" sub="Evaluating six dimensions" /></div>}

      {error && !loading && (
        <div className="inner-body">
          <ErrMsg msg={error} retry={() => { setError(null); }} dark={false} />
        </div>
      )}

      {result && !loading && (
        <>
          <div className="inner-hero">
            <div className="inner-eyebrow">Positioning Grader — Results</div>
            <h1 className="inner-title" style={{ color: gradeColor(result.grade) }}>
              {result.grade} &mdash; {result.overall_score}/100
            </h1>
            <p className="inner-lead">{result.summary}</p>
          </div>

          <div className="inner-body">
            {/* Mini score bars */}
            {result.dimensions.length > 0 && (
              <div style={{ marginBottom: 40 }}>
                <div className="section-label">Dimension Scores</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
                  {result.dimensions.map((d) => (
                    <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ghost)", width: 140, flexShrink: 0 }}>
                        {d.label || d.name}
                      </span>
                      <div style={{ flex: 1, height: 6, background: "var(--border)" }}>
                        <div style={{ width: `${d.score * 10}%`, height: "100%", background: "var(--sage)" }} />
                      </div>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, color: "var(--sage)", width: 32, textAlign: "right" }}>
                        {d.score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strongest / Core weakness */}
            <div className="features" style={{ marginBottom: 32 }}>
              <div className="feature">
                <div className="feature-title">Strongest Element</div>
                <p className="feature-body">{result.strongest_element}</p>
              </div>
              <div className="feature" style={{ borderLeftColor: "#ef4444" }}>
                <div className="feature-title" style={{ color: "#ef4444" }}>Core Weakness</div>
                <p className="feature-body">{result.core_weakness}</p>
              </div>
            </div>

            {/* Dimensions */}
            <div className="section-label" style={{ marginBottom: 16 }}>Dimension Detail</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 40 }}>
              {result.dimensions.map((d) => (
                <DimRow key={d.name} dimension={d} dark={false} />
              ))}
            </div>

            {/* Test question */}
            <div className="feature" style={{ marginBottom: 32, borderLeftColor: "var(--teal)" }}>
              <div className="feature-title" style={{ color: "var(--teal)" }}>Test Question</div>
              <p className="feature-body" style={{ fontStyle: "italic" }}>{result.test_question}</p>
            </div>

            {/* Suggested rewrite (collapsed) */}
            {result.suggested_rewrite && result.overall_score < 75 && (
              <div style={{ marginBottom: 32 }}>
                <button
                  onClick={() => setShowRewrite((v) => !v)}
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
                    borderLeft: "3px solid var(--sage)",
                    padding: "14px 20px",
                    cursor: "pointer",
                    color: "var(--forest)",
                  }}
                  aria-expanded={showRewrite}
                  aria-controls="positioning-rewrite"
                >
                  <span>Suggested Rewrite Available</span>
                  <span>{showRewrite ? "▲" : "▼"}</span>
                </button>
                {showRewrite && (
                  <div
                    id="positioning-rewrite"
                    className="feature"
                    style={{ borderTop: "none", borderLeftColor: "var(--sage)" }}
                  >
                    <div className="feature-title">Suggested Rewrite</div>
                    <p className="feature-body">{result.suggested_rewrite}</p>
                  </div>
                )}
              </div>
            )}

            <NewsletterCapture dark={false} />

            <button
              onClick={reset}
              className="submit-btn"
              style={{ marginTop: 24 }}
              aria-label="Grade another positioning statement"
            >
              Grade Another
            </button>
          </div>
        </>
      )}
    </div>
  );
}
