"use client";

import { useState } from "react";
import DimRow from "../shared/DimRow";
import NewsletterCapture from "../shared/NewsletterCapture";
import Loader from "../shared/Loader";
import ErrMsg from "../shared/ErrMsg";

const SURFACE = "#fafaf7";
const ACCENT = "#fbbf24";
const FG = "#053030";

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

  const verdictColor = result ? (VERDICT_COLORS[result.verdict] ?? ACCENT) : ACCENT;

  return (
    <div className="tk-tool-surface" style={{ background: SURFACE, color: FG }}>
      <button className="tk-back-btn" onClick={reset} style={{ color: FG }} aria-label="Back to toolkit hub">
        ← All Tools
      </button>

      {!result && !loading && (
        <form onSubmit={handleSubmit} className="tk-form">
          <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: 28, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 8, color: FG }}>
            Market Problem Validator
          </h2>
          <p style={{ fontSize: 14, color: "rgba(5,48,48,0.6)", marginBottom: 32, lineHeight: 1.7 }}>
            Describe the market problem you&rsquo;re solving. Get a verdict, a score, and honest feedback on whether it&rsquo;s worth building against.
          </p>

          <div className="tk-form-group">
            <label className="tk-label" htmlFor="prob-problem" style={{ color: "rgba(5,48,48,0.6)" }}>
              Problem Description *
            </label>
            <textarea
              id="prob-problem"
              className="tk-textarea tk-input"
              rows={5}
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Describe the problem your target customer faces. Be specific — who has it, how often, what the cost is."
              required
              maxLength={4000}
              style={{ background: "#fff", border: "1px solid rgba(5,48,48,0.15)", color: FG }}
            />
          </div>

          <div className="tk-form-group">
            <label className="tk-label" htmlFor="prob-evidence" style={{ color: "rgba(5,48,48,0.6)" }}>
              Evidence / Signals (optional)
            </label>
            <textarea
              id="prob-evidence"
              className="tk-textarea tk-input"
              rows={3}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="Customer interviews, lost deal patterns, NPS complaints, market research…"
              maxLength={2000}
              style={{ background: "#fff", border: "1px solid rgba(5,48,48,0.15)", color: FG }}
            />
          </div>

          <div className="tk-form-group">
            <label className="tk-label" htmlFor="prob-tam" style={{ color: "rgba(5,48,48,0.6)" }}>
              TAM Size
            </label>
            <select
              id="prob-tam"
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
            disabled={!problem.trim()}
            style={{ background: ACCENT, color: FG, marginTop: 8 }}
          >
            Validate This Problem
          </button>
        </form>
      )}

      {loading && <Loader dark={false} label="Validating problem…" sub="Analysing six dimensions" />}

      {error && !loading && (
        <ErrMsg msg={error} retry={() => setError(null)} dark={false} />
      )}

      {result && !loading && (
        <div className="tk-results">
          {/* Verdict card */}
          <div className="tk-verdict-card" style={{ background: "#fff", borderLeft: `4px solid ${verdictColor}` }}>
            <div className="tk-verdict-label" style={{ color: "rgba(5,48,48,0.5)" }}>Verdict</div>
            <div className="tk-verdict-score" style={{ color: verdictColor }}>{result.score}</div>
            <span className="tk-verdict-chip" style={{ background: verdictColor + "22", color: verdictColor }}>
              {result.verdict}
            </span>
            <p className="tk-verdict-reasoning" style={{ color: FG, marginTop: 12 }}>{result.verdict_reasoning}</p>
          </div>

          {/* Fatal flaw */}
          {result.fatal_flaw && (
            <div className="tk-panel" style={{ background: "#fef2f2", borderLeft: "4px solid #ef4444" }}>
              <div className="tk-panel-label" style={{ color: "#ef4444" }}>Fatal Flaw</div>
              <p className="tk-panel-text" style={{ color: FG }}>{result.fatal_flaw}</p>
            </div>
          )}

          {/* Strongest signal */}
          <div className="tk-panel" style={{ background: "#f0fdf4", borderLeft: "4px solid #22c55e" }}>
            <div className="tk-panel-label" style={{ color: "#22c55e" }}>Strongest Signal</div>
            <p className="tk-panel-text" style={{ color: FG }}>{result.strongest_signal}</p>
          </div>

          {/* Dimensions */}
          <div className="tk-dim-rows">
            {result.dimensions.map((d) => (
              <DimRow key={d.name} dimension={d} dark={false} />
            ))}
          </div>

          {/* Next validation moves */}
          {result.next_validation_moves.length > 0 && (
            <div className="tk-numbered-list" style={{ background: "#fff" }}>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(5,48,48,0.5)", marginBottom: 16 }}>
                Next Validation Moves
              </div>
              {result.next_validation_moves.map((move, i) => (
                <div className="tk-numbered-item" key={i}>
                  <span className="tk-numbered-item-num" style={{ color: ACCENT }}>{i + 1}</span>
                  <span className="tk-numbered-item-text" style={{ color: FG }}>{move}</span>
                </div>
              ))}
            </div>
          )}

          {/* Question you're avoiding */}
          <div className="tk-panel" style={{ background: "#005A66" }}>
            <div className="tk-panel-label" style={{ color: "rgba(255,255,255,0.55)" }}>The Question You&rsquo;re Avoiding</div>
            <p className="tk-panel-text" style={{ color: "#fff", fontStyle: "italic" }}>{result.question_youre_avoiding}</p>
          </div>

          <NewsletterCapture dark={false} />

          <button
            className="tk-btn-ghost"
            onClick={reset}
            style={{ color: FG, borderColor: "rgba(5,48,48,0.3)", marginTop: 24 }}
            aria-label="Validate another problem"
          >
            Validate Another
          </button>
        </div>
      )}
    </div>
  );
}
