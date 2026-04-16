"use client";

import { useState } from "react";
import DimRow from "../shared/DimRow";
import NewsletterCapture from "../shared/NewsletterCapture";
import Loader from "../shared/Loader";
import ErrMsg from "../shared/ErrMsg";

const SURFACE = "#F5F9F6";
const ACCENT = "#319A65";
const FG = "#053030";

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
    return map[grade] ?? ACCENT;
  }

  return (
    <div className="tk-tool-surface" style={{ background: SURFACE, color: FG }}>
      <button className="tk-back-btn" onClick={reset} style={{ color: FG }} aria-label="Back to toolkit hub">
        ← All Tools
      </button>

      {!result && !loading && (
        <form onSubmit={handleSubmit} className="tk-form">
          <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: 28, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 8, color: FG }}>
            Persona Quality Check
          </h2>
          <p style={{ fontSize: 14, color: "rgba(5,48,48,0.6)", marginBottom: 32, lineHeight: 1.7 }}>
            Paste your buyer persona definition. Get a grade and six dimensions showing exactly what&rsquo;s missing.
          </p>

          <div className="tk-form-group">
            <label className="tk-label" htmlFor="persona-def" style={{ color: "rgba(5,48,48,0.6)" }}>
              Persona Definition *
            </label>
            <textarea
              id="persona-def"
              className="tk-textarea tk-input"
              rows={9}
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder="Paste your full persona definition here — include job title, seniority, company type, pain points, goals, decision-making role, etc."
              required
              maxLength={6000}
              style={{ background: "#fff", border: "1px solid rgba(5,48,48,0.15)", color: FG }}
            />
          </div>

          <div className="tk-form-group">
            <label className="tk-label" htmlFor="persona-tam" style={{ color: "rgba(5,48,48,0.6)" }}>
              TAM Size (optional)
            </label>
            <select
              id="persona-tam"
              className="tk-select tk-input"
              value={tamSize}
              onChange={(e) => setTamSize(e.target.value)}
              style={{ background: "#fff", border: "1px solid rgba(5,48,48,0.15)", color: FG }}
            >
              {TAM_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <button
            type="submit"
            className="tk-btn-primary"
            disabled={!persona.trim()}
            style={{ background: ACCENT, color: "#fff", marginTop: 8 }}
          >
            Check This Persona
          </button>
        </form>
      )}

      {loading && <Loader dark={false} label="Checking persona quality…" sub="Evaluating six dimensions" />}

      {error && !loading && (
        <ErrMsg msg={error} retry={() => setError(null)} dark={false} />
      )}

      {result && !loading && (
        <div className="tk-results">
          {/* Grade card */}
          <div className="tk-grade-card" style={{ background: "#053030", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 8 }}>
              <span className="tk-grade-letter" style={{ color: gradeColor(result.grade) }}>{result.grade}</span>
              <span className="tk-grade-score" style={{ color: "rgba(255,255,255,0.55)" }}>{result.overall_score}/100</span>
            </div>
            <p className="tk-grade-summary" style={{ color: "rgba(255,255,255,0.8)", marginBottom: 12 }}>{result.summary}</p>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 12, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>Best Thing</div>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.65 }}>{result.best_thing}</p>
          </div>

          {/* Dimensions */}
          <div className="tk-dim-rows">
            {result.dimensions.map((d) => (
              <DimRow key={d.name} dimension={d} dark={false} accent={ACCENT} />
            ))}
          </div>

          {/* What's Working / Biggest Gap */}
          <div className="tk-two-col">
            <div className="tk-info-card" style={{ background: "#fff", borderLeft: `3px solid ${ACCENT}` }}>
              <div className="tk-info-card-label" style={{ color: ACCENT }}>What&rsquo;s Working</div>
              <p className="tk-info-card-text" style={{ color: FG }}>{result.best_thing}</p>
            </div>
            <div className="tk-info-card" style={{ background: "#fff", borderLeft: "3px solid #f97316" }}>
              <div className="tk-info-card-label" style={{ color: "#f97316" }}>Biggest Gap</div>
              <p className="tk-info-card-text" style={{ color: FG }}>{result.biggest_gap}</p>
            </div>
          </div>

          {/* Question to answer */}
          <div className="tk-panel" style={{ background: "#005A66" }}>
            <div className="tk-panel-label" style={{ color: "rgba(255,255,255,0.55)" }}>The Question You Need to Answer</div>
            <p className="tk-panel-text" style={{ color: "#fff", fontStyle: "italic" }}>{result.question_to_answer}</p>
          </div>

          <NewsletterCapture dark={false} />

          <button
            className="tk-btn-ghost"
            onClick={reset}
            style={{ color: FG, borderColor: "rgba(5,48,48,0.3)", marginTop: 24 }}
            aria-label="Check another persona"
          >
            Check Another
          </button>
        </div>
      )}
    </div>
  );
}
