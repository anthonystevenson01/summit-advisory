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

const VERDICT_COLORS: Record<string, string> = {
  "Worth Building Against": "#22c55e",
  "Validate Further": "#fbbf24",
  "Not Yet": "#f97316",
  "Abandon This Problem": "#ef4444",
};

interface Dimension {
  name: string;
  label: string;
  score: number;
  observation: string;
  fix?: string;
}

interface ProblemResult {
  verdict: string;
  score: number;
  verdict_reasoning: string;
  fatal_flaw?: string;
  strongest_signal: string;
  question_youre_avoiding: string;
  next_validation_moves: string[];
  dimensions: Dimension[];
}

interface Props {
  systemPrompt: string;
}

export default function ProblemTool({ systemPrompt }: Props) {
  const [problem, setProblem] = useState("");
  const [evidence, setEvidence] = useState("");
  const [tamSize, setTamSize] = useState("Unknown");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProblemResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/gtm/problem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem, evidence, tam_size: tamSize, systemPrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed.");
      setResult(data as ProblemResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setProblem(""); setEvidence(""); setTamSize("Unknown");
    setResult(null); setError(null);
  }

  const verdictColor = result ? (VERDICT_COLORS[result.verdict] ?? "#fbbf24") : "#fbbf24";

  return (
    <div className="inner">
      {!result && !loading && (
        <>
          <div className="inner-hero">
            <div className="inner-eyebrow">GTM Toolkit</div>
            <h1 className="inner-title">Market Problem Validator</h1>
            <p className="inner-lead">
              Describe the market problem you&rsquo;re solving. Get a verdict, a score, and honest feedback on whether it&rsquo;s worth building against.
            </p>
          </div>

          <div className="inner-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="prob-problem">
                  Problem Description *
                </label>
                <textarea
                  id="prob-problem"
                  className="form-textarea"
                  rows={5}
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  placeholder="Describe the problem your target customer faces. Be specific — who has it, how often, what the cost is."
                  required
                  maxLength={4000}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="prob-evidence">
                  Evidence / Signals (optional)
                </label>
                <textarea
                  id="prob-evidence"
                  className="form-textarea"
                  rows={3}
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder="Customer interviews, lost deal patterns, NPS complaints, market research…"
                  maxLength={2000}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="prob-tam">
                  TAM Size
                </label>
                <select
                  id="prob-tam"
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
                disabled={!problem.trim()}
              >
                Validate This Problem
              </button>
            </form>
          </div>
        </>
      )}

      {loading && <div className="inner-body"><Loader dark={false} label="Validating problem…" sub="Analysing six dimensions" /></div>}

      {error && !loading && (
        <div className="inner-body">
          <ErrMsg msg={error} retry={() => setError(null)} dark={false} />
        </div>
      )}

      {result && !loading && (
        <>
          <div className="inner-hero">
            <div className="inner-eyebrow">Problem Validator — Results</div>
            <h1 className="inner-title" style={{ color: "var(--white)" }}>
              {result.verdict}
            </h1>
            <p className="inner-lead">{result.verdict_reasoning}</p>
          </div>

          <div className="inner-body">
            {/* Score badge */}
            <div style={{ marginBottom: 32 }}>
              <div className="section-label">Overall Score</div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12 }}>
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 56,
                  fontWeight: 900,
                  lineHeight: 1,
                  color: verdictColor,
                }}>
                  {result.score}
                </span>
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  padding: "6px 14px",
                  background: verdictColor + "22",
                  color: verdictColor,
                  border: `1px solid ${verdictColor}44`,
                }}>
                  {result.verdict}
                </span>
              </div>
            </div>

            {/* Fatal flaw */}
            {result.fatal_flaw && (
              <div className="feature" style={{ borderLeftColor: "#ef4444", marginBottom: 32 }}>
                <div className="feature-title" style={{ color: "#ef4444" }}>Fatal Flaw</div>
                <p className="feature-body">{result.fatal_flaw}</p>
              </div>
            )}

            {/* Strongest signal */}
            <div className="feature" style={{ borderLeftColor: "#22c55e", marginBottom: 32 }}>
              <div className="feature-title" style={{ color: "#22c55e" }}>Strongest Signal</div>
              <p className="feature-body">{result.strongest_signal}</p>
            </div>

            {/* Dimensions */}
            <div className="section-label" style={{ marginBottom: 16 }}>Dimension Detail</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 40 }}>
              {result.dimensions.map((d) => (
                <DimRow key={d.name} dimension={d} dark={false} />
              ))}
            </div>

            {/* Next validation moves */}
            {result.next_validation_moves.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div className="section-label">Next Validation Moves</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 16 }}>
                  {result.next_validation_moves.map((move, i) => (
                    <div
                      key={i}
                      className="feature"
                      style={{ display: "flex", gap: 16, alignItems: "flex-start" }}
                    >
                      <span style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: 20,
                        fontWeight: 900,
                        color: "var(--sage)",
                        lineHeight: 1,
                        flexShrink: 0,
                        width: 24,
                      }}>
                        {i + 1}
                      </span>
                      <p className="feature-body" style={{ margin: 0 }}>{move}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Question you're avoiding */}
            <div className="feature" style={{ borderLeftColor: "var(--teal)", marginBottom: 32 }}>
              <div className="feature-title" style={{ color: "var(--teal)" }}>The Question You&rsquo;re Avoiding</div>
              <p className="feature-body" style={{ fontStyle: "italic" }}>{result.question_youre_avoiding}</p>
            </div>

            <NewsletterCapture dark={false} />

            <button
              className="submit-btn"
              onClick={reset}
              style={{ marginTop: 24 }}
              aria-label="Validate another problem"
            >
              Validate Another
            </button>
          </div>
        </>
      )}
    </div>
  );
}
