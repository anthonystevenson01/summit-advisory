"use client";

import { useState } from "react";
import DimRow from "../shared/DimRow";
import NewsletterCapture from "../shared/NewsletterCapture";
import Loader from "../shared/Loader";
import ErrMsg from "../shared/ErrMsg";

const TAM_OPTIONS = [
  "Under 500 accounts",
  "500-1000 accounts",
  "1000-5000 accounts",
  "5000+ accounts",
  "Unknown",
];

interface Dimension {
  name: string;
  label: string;
  score: number;
  observation: string;
  fix?: string;
}

interface PersonaResult {
  grade: string;
  overall_score: number;
  summary: string;
  best_thing: string;
  biggest_gap: string;
  question_to_answer: string;
  dimensions: Dimension[];
}

interface Props {
  systemPrompt: string;
}

export default function PersonaTool({ systemPrompt }: Props) {
  const [persona, setPersona] = useState("");
  const [tamSize, setTamSize] = useState("Unknown");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PersonaResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/gtm/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona, tam_size: tamSize, systemPrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed.");
      setResult(data as PersonaResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPersona(""); setTamSize("Unknown");
    setResult(null); setError(null);
  }

  function gradeColor(grade: string): string {
    const map: Record<string, string> = { A: "#22c55e", B: "#319A65", C: "#fbbf24", D: "#f97316", F: "#ef4444" };
    return map[grade] ?? "#319A65";
  }

  return (
    <div className="inner">
      {!result && !loading && (
        <>
          <div className="inner-hero">
            <div className="inner-eyebrow">GTM Toolkit</div>
            <h1 className="inner-title">Persona Quality Check</h1>
            <p className="inner-lead">
              Paste your buyer persona definition. Get a grade and six dimensions showing exactly what&rsquo;s missing.
            </p>
          </div>

          <div className="inner-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="persona-def">
                  Persona Definition *
                </label>
                <textarea
                  id="persona-def"
                  className="form-textarea"
                  rows={9}
                  value={persona}
                  onChange={(e) => setPersona(e.target.value)}
                  placeholder="Paste your full persona definition here — include job title, seniority, company type, pain points, goals, decision-making role, etc."
                  required
                  maxLength={6000}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="persona-tam">
                  TAM Size (optional)
                </label>
                <select
                  id="persona-tam"
                  className="form-select"
                  value={tamSize}
                  onChange={(e) => setTamSize(e.target.value)}
                >
                  {TAM_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              <button
                type="submit"
                className="submit-btn"
                disabled={!persona.trim()}
              >
                Check This Persona
              </button>
            </form>
          </div>
        </>
      )}

      {loading && <div className="inner-body"><Loader dark={false} label="Checking persona quality…" sub="Evaluating six dimensions" /></div>}

      {error && !loading && (
        <div className="inner-body">
          <ErrMsg msg={error} retry={() => setError(null)} dark={false} />
        </div>
      )}

      {result && !loading && (
        <>
          <div className="inner-hero">
            <div className="inner-eyebrow">Persona Quality Check — Results</div>
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

            {/* What's Working / Biggest Gap */}
            <div className="features" style={{ marginBottom: 32 }}>
              <div className="feature">
                <div className="feature-title">What&rsquo;s Working</div>
                <p className="feature-body">{result.best_thing}</p>
              </div>
              <div className="feature" style={{ borderLeftColor: "#f97316" }}>
                <div className="feature-title" style={{ color: "#f97316" }}>Biggest Gap</div>
                <p className="feature-body">{result.biggest_gap}</p>
              </div>
            </div>

            {/* Dimensions */}
            <div className="section-label" style={{ marginBottom: 16 }}>Dimension Detail</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 40 }}>
              {result.dimensions.map((d) => (
                <DimRow key={d.name} dimension={d} dark={false} />
              ))}
            </div>

            {/* Question to answer */}
            <div className="feature" style={{ borderLeftColor: "var(--teal)", marginBottom: 32 }}>
              <div className="feature-title" style={{ color: "var(--teal)" }}>The Question You Need to Answer</div>
              <p className="feature-body" style={{ fontStyle: "italic" }}>{result.question_to_answer}</p>
            </div>

            <NewsletterCapture dark={false} />

            <button
              className="submit-btn"
              onClick={reset}
              style={{ marginTop: 24 }}
              aria-label="Check another persona"
            >
              Check Another
            </button>
          </div>
        </>
      )}
    </div>
  );
}
