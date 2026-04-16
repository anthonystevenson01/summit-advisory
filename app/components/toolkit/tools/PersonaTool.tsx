"use client";

import { useState, useEffect, useRef } from "react";
import ScoreGauge from "../shared/ScoreGauge";
import GtmDimensionBar from "../shared/GtmDimensionBar";
import { TOOL_DIMENSIONS, getGrade } from "../data/dimensionConfig";
import { BRAND } from "@/app/lib/brand";
import { submitToolUnlock } from "../shared/useToolUnlock";

const DIMS = TOOL_DIMENSIONS["persona"];

const TAM_OPTIONS = [
  "Under 500 accounts",
  "500–1000 accounts",
  "1000–5000 accounts",
  "5000+ accounts",
  "Unknown",
];

interface Props {
  systemPrompt: string;
  rubric: string;
}

type Phase = "input" | "scoring" | "scored" | "unlocked";

type ScoreResult = {
  totalScore: number;
  scores: Record<string, number>;
  id: string;
};

type DetailsResult = {
  dimensionReasoning: Array<{ dim: string; score: number; reasoning: string }>;
  recommendations: Array<{ dim: string; score: number; gap: string; consequence: string; action: string }>;
};

export default function PersonaTool({ systemPrompt: _systemPrompt, rubric }: Props) {
  const [phase, setPhase] = useState<Phase>("input");
  const [persona, setPersona] = useState("");
  const [tamSize, setTamSize] = useState("");
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [detailsResult, setDetailsResult] = useState<DetailsResult | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const resultsRef = useRef<HTMLElement>(null);
  const MAX_CHARS = 6000;

  useEffect(() => {
    if (phase === "scored" || phase === "unlocked") {
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [phase]);

  const buildInputText = () => {
    const parts: string[] = [];
    if (persona.trim()) parts.push(`Buyer Persona:\n${persona.trim()}`);
    if (tamSize) parts.push(`TAM Size: ${tamSize}`);
    return parts.join("\n\n");
  };

  const handleEvaluate = async () => {
    if (honeypot) return;
    const inputText = buildInputText();
    if (inputText.length < 50) return;
    setPhase("scoring");
    setEvalError(null);
    setScoreResult(null);
    setDetailsResult(null);
    try {
      const res = await fetch("/api/gtm/persona/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputText, rubric }),
      });
      const data = await res.json() as ScoreResult & { error?: string };
      if (!res.ok) {
        setEvalError(data.error || "Evaluation failed. Please try again.");
        setPhase("scored");
        return;
      }
      setScoreResult(data);
      setPhase("scored");
    } catch {
      setEvalError("Something went wrong. Please try again.");
      setPhase("scored");
    }
  };

  const handleUnlock = async () => {
    if (!name || !email || !company || !scoreResult) return;
    setPhase("unlocked");
    setLoadingDetails(true);
    const details = await submitToolUnlock({
      tool: "persona",
      id: scoreResult.id,
      name, email, company,
      scores: scoreResult.scores,
      rubric,
    });
    if (details) setDetailsResult(details);
    setLoadingDetails(false);
  };

  const unlocked = phase === "unlocked";
  const scoreRevealed = phase === "scored" || phase === "unlocked";

  return (
    <div style={{ minHeight: "100vh", background: BRAND.white, fontFamily: "var(--font-dm-sans), sans-serif" }}>{/* HERO */}
      <section style={{ background: `linear-gradient(135deg, ${BRAND.darkGreen} 0%, ${BRAND.teal} 100%)`, padding: "40px 32px 56px", textAlign: "center" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 20, background: "rgba(49,154,101,0.25)", border: "1px solid rgba(49,154,101,0.4)", marginBottom: 24 }}>
            <span style={{ color: BRAND.brandGreen, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Tool 02 — GTM Toolkit</span>
          </div>
          <h1 style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 46, fontWeight: 700, color: BRAND.white, lineHeight: 1.12, margin: "0 0 20px" }}>
            Buyer Persona Quality Check
          </h1>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.85)", lineHeight: 1.65, margin: 0 }}>
            Score your buyer persona across six dimensions weighted for finite-market enterprise selling. Find the gaps before they cost you accounts.
          </p>
        </div>
      </section>

      {/* INTRO */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "48px 24px 16px" }}>
        <div className="gtm-tool-grid" style={{ margin: "0 0 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={{ padding: "20px 24px", background: BRAND.lightBg, borderRadius: 10, border: `1px solid ${BRAND.border}` }}>
            <h3 style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 14, fontWeight: 600, color: BRAND.teal, margin: "0 0 14px", letterSpacing: "0.04em", textTransform: "uppercase" }}>What we evaluate</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {DIMS.map((d) => (
                <div key={d.key} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: BRAND.brandGreen, flexShrink: 0, marginTop: 4 }} />
                  <span style={{ fontSize: 13, color: BRAND.dark, lineHeight: 1.4 }}>{d.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: "20px 24px", background: BRAND.white, borderRadius: 10, border: `1px solid ${BRAND.border}` }}>
            <h3 style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 14, fontWeight: 600, color: BRAND.teal, margin: "0 0 14px", letterSpacing: "0.04em", textTransform: "uppercase" }}>What the highest standard looks like</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { dim: "Pain Clarity", tip: "Pain is quantified in business terms, segmented by persona tier, with evidence of how it manifests across company sizes." },
                { dim: "Decision Authority", tip: "Full buying committee mapped — who sponsors, who influences, who vetos — with access paths per role." },
                { dim: "Specificity", tip: "Precise enough that a new SDR could self-qualify a prospect in 30 seconds without asking a manager." },
                { dim: "Reachability", tip: "Named channels, communities, and events where this buyer spends time, with engagement patterns documented." },
                { dim: "Job-to-be-Done Fit", tip: "The job is specific, evidenced from customer interviews, and distinguishes your buyers from adjacent personas." },
                { dim: "Finite Market Alignment", tip: "Your persona tells you who NOT to pursue as clearly as who to pursue — constraints are applied to your target list." },
              ].map((t) => (
                <div key={t.dim} style={{ fontSize: 12, color: BRAND.mid, lineHeight: 1.55 }}>
                  <span style={{ fontWeight: 600, color: BRAND.darkGreen }}>{t.dim}:</span> {t.tip}
                </div>
              ))}
            </div>
          </div>
        </div>
        <p style={{ fontSize: 15, color: BRAND.dark, lineHeight: 1.7, margin: "0 0 6px" }}>
          Paste your buyer persona definition below. Include job title, seniority, company type, pain points, goals, and decision-making role.
        </p>
      </section>

      {/* INPUT */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "8px 24px" }}>
        {/* Honeypot */}
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          aria-hidden="true"
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
          autoComplete="off"
        />

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: BRAND.darkGreen, display: "block", marginBottom: 6, letterSpacing: "0.02em" }}>
            Your Buyer Persona Definition <span style={{ color: BRAND.red }}>*</span>
          </label>
          <textarea
            value={persona}
            onChange={(e) => setPersona(e.target.value.slice(0, MAX_CHARS))}
            placeholder="Paste your buyer persona definition here — include job title, seniority, company type, pain points, goals, decision-making role, and any other relevant detail."
            style={{
              width: "100%",
              minHeight: 220,
              padding: 16,
              borderRadius: 8,
              border: `1px solid ${BRAND.border}`,
              fontSize: 14,
              fontFamily: "var(--font-dm-sans), sans-serif",
              color: BRAND.dark,
              lineHeight: 1.6,
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.target.style.borderColor = BRAND.teal)}
            onBlur={(e) => (e.target.style.borderColor = BRAND.border)}
            disabled={scoreRevealed}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
            <span style={{ fontSize: 12, color: persona.length > MAX_CHARS * 0.9 ? BRAND.amber : BRAND.mid }}>
              {persona.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: BRAND.darkGreen, display: "block", marginBottom: 6, letterSpacing: "0.02em" }}>
            Approximate TAM Size <span style={{ color: BRAND.mid, fontWeight: 400 }}>(optional)</span>
          </label>
          <select
            value={tamSize}
            onChange={(e) => setTamSize(e.target.value)}
            disabled={scoreRevealed}
            style={{
              width: "100%",
              maxWidth: 320,
              padding: "10px 14px",
              borderRadius: 6,
              border: `1px solid ${BRAND.border}`,
              fontSize: 14,
              fontFamily: "var(--font-dm-sans), sans-serif",
              color: tamSize ? BRAND.dark : BRAND.mid,
              background: BRAND.white,
              outline: "none",
              cursor: scoreRevealed ? "not-allowed" : "pointer",
            }}
          >
            <option value="">Select TAM size…</option>
            {TAM_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          {!scoreRevealed && (
            <button
              type="button"
              onClick={handleEvaluate}
              disabled={buildInputText().length < 50 || phase === "scoring"}
              style={{
                padding: "12px 28px",
                borderRadius: 6,
                border: "none",
                background: buildInputText().length < 50 ? BRAND.border : BRAND.brandGreen,
                color: BRAND.white,
                fontFamily: "var(--font-oswald), sans-serif",
                fontWeight: 600,
                fontSize: 15,
                letterSpacing: "0.04em",
                cursor: buildInputText().length < 50 ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                opacity: phase === "scoring" ? 0.7 : 1,
              }}
            >
              {phase === "scoring" ? "Scoring…" : "Score My Persona"}
            </button>
          )}
        </div>

        {phase === "scoring" && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: BRAND.brandGreen, animation: "pulse 1.2s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
            <p style={{ color: BRAND.teal, fontSize: 14, fontWeight: 500 }}>Scoring across {DIMS.length} dimensions…</p>
          </div>
        )}
      </section>

      {/* RESULTS */}
      {scoreRevealed && (
        <section ref={resultsRef} style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 48px" }}>
          <div style={{ background: BRAND.lightBg, borderRadius: 12, padding: "32px 28px", border: `1px solid ${BRAND.border}` }}>
            {evalError ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <p style={{ fontSize: 15, color: BRAND.red, marginBottom: 16 }}>{evalError}</p>
                <button
                  type="button"
                  onClick={() => { setPhase("input"); setEvalError(null); }}
                  style={{ padding: "10px 20px", borderRadius: 6, border: `1px solid ${BRAND.teal}`, background: BRAND.white, color: BRAND.teal, fontFamily: "var(--font-oswald), sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
                >
                  Try again
                </button>
              </div>
            ) : scoreResult ? (
              <>
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                  <ScoreGauge score={scoreResult.totalScore} size={200} />
                  <p style={{ fontSize: 14, color: BRAND.mid, marginTop: 12, lineHeight: 1.5, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
                    {getGrade(scoreResult.totalScore).desc}
                  </p>
                </div>

                <div style={{ borderTop: `1px solid ${BRAND.border}`, paddingTop: 24 }}>
                  <h3 style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 16, fontWeight: 600, color: BRAND.darkGreen, marginBottom: 16, marginTop: 0 }}>Dimension Breakdown</h3>
                  {DIMS.map((dim) => {
                    const reasoning = detailsResult?.dimensionReasoning?.find((r) => r.dim === dim.key);
                    return (
                      <div key={dim.key}>
                        <GtmDimensionBar
                          name={dim.name}
                          score={scoreResult.scores[dim.key] ?? 0}
                          levelLabel={dim.levels[scoreResult.scores[dim.key] ?? 1] ?? ""}
                          locked={!unlocked}
                        />
                        {unlocked && reasoning?.reasoning && (
                          <div style={{ marginTop: -8, marginBottom: 20, marginLeft: 2, padding: "10px 14px", background: BRAND.white, borderRadius: 6, borderLeft: `2px solid ${BRAND.teal}40` }}>
                            <p style={{ fontSize: 12, color: BRAND.mid, lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>
                              {reasoning.reasoning}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!unlocked ? (
                  <div style={{ marginTop: 24, borderTop: `1px solid ${BRAND.border}`, paddingTop: 24 }}>
                    <div style={{ background: BRAND.white, borderRadius: 8, padding: 24, border: `1px solid ${BRAND.teal}30` }}>
                      <div style={{ textAlign: "center", marginBottom: 20 }}>
                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${BRAND.teal}15`, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={BRAND.teal} strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" />
                            <path d="M7 11V7a5 5 0 0110 0v4" />
                          </svg>
                        </div>
                        <h3 style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 18, fontWeight: 600, color: BRAND.darkGreen, margin: "0 0 6px" }}>Unlock Your Full Report</h3>
                        <p style={{ fontSize: 13, color: BRAND.mid, margin: 0 }}>Get per-dimension scores, level labels, and specific recommendations for every weak area.</p>
                      </div>
                      {[
                        { label: "Name", value: name, set: setName, placeholder: "Your name" },
                        { label: "Email", value: email, set: setEmail, placeholder: "you@company.com" },
                        { label: "Company", value: company, set: setCompany, placeholder: "Your company" },
                      ].map((f) => (
                        <div key={f.label} style={{ marginBottom: 12 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: BRAND.darkGreen, display: "block", marginBottom: 4 }}>{f.label}</label>
                          <input
                            type={f.label === "Email" ? "email" : "text"}
                            value={f.value}
                            onChange={(e) => f.set(e.target.value)}
                            placeholder={f.placeholder}
                            style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: `1px solid ${BRAND.border}`, fontSize: 14, fontFamily: "var(--font-dm-sans), sans-serif", color: BRAND.dark, outline: "none", boxSizing: "border-box" }}
                            onFocus={(e) => (e.target.style.borderColor = BRAND.teal)}
                            onBlur={(e) => (e.target.style.borderColor = BRAND.border)}
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={handleUnlock}
                        disabled={!name || !email || !company}
                        style={{ width: "100%", padding: "12px", borderRadius: 6, border: "none", background: !name || !email || !company ? BRAND.border : BRAND.brandGreen, color: BRAND.white, fontFamily: "var(--font-oswald), sans-serif", fontWeight: 600, fontSize: 15, letterSpacing: "0.04em", marginTop: 8, cursor: !name || !email || !company ? "not-allowed" : "pointer" }}
                      >
                        Unlock Full Report
                      </button>
                      <p style={{ fontSize: 11, color: BRAND.mid, textAlign: "center", marginTop: 10, marginBottom: 0 }}>
                        We store your details securely and use them only to deliver this report. No spam, no third-party sharing.{" "}
                        <a href="mailto:privacy@summitstrategyadvisory.com" style={{ color: BRAND.teal, textDecoration: "none" }}>privacy@summitstrategyadvisory.com</a>.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ marginTop: 28, borderTop: `1px solid ${BRAND.border}`, paddingTop: 24 }}>
                      <h3 style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 16, fontWeight: 600, color: BRAND.darkGreen, marginBottom: 16, marginTop: 0 }}>Recommendations</h3>
                      {loadingDetails ? (
                        <div style={{ textAlign: "center", padding: "32px 0" }}>
                          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16 }}>
                            {[0, 1, 2].map((i) => (
                              <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: BRAND.teal, animation: "pulse 1.2s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
                            ))}
                          </div>
                          <p style={{ color: BRAND.teal, fontSize: 13, fontWeight: 500, margin: 0 }}>Generating detailed analysis…</p>
                        </div>
                      ) : !detailsResult || detailsResult.recommendations.length === 0 ? (
                        <p style={{ fontSize: 13, color: BRAND.mid, textAlign: "center", padding: "16px 0" }}>All dimensions scored 4 or above — no recommendations needed.</p>
                      ) : detailsResult.recommendations.map((rec, i) => (
                        <div
                          key={i}
                          style={{ background: BRAND.white, borderRadius: 8, padding: 20, marginBottom: 12, borderLeft: `3px solid ${rec.score <= 2 ? BRAND.red : BRAND.amber}` }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                            <span style={{ fontFamily: "var(--font-oswald), sans-serif", fontWeight: 600, fontSize: 14, color: BRAND.darkGreen }}>{rec.dim}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 12, background: rec.score <= 2 ? "#FFEBEE" : "#FFF8E1", color: rec.score <= 2 ? BRAND.red : BRAND.amber }}>
                              {rec.score}/5
                            </span>
                          </div>
                          <p style={{ fontSize: 13, color: BRAND.dark, lineHeight: 1.55, margin: "0 0 8px" }}><strong>Gap:</strong> {rec.gap}</p>
                          <p style={{ fontSize: 13, color: BRAND.mid, lineHeight: 1.55, margin: "0 0 8px" }}><strong style={{ color: BRAND.dark }}>Consequence:</strong> {rec.consequence}</p>
                          <p style={{ fontSize: 13, color: BRAND.teal, lineHeight: 1.55, margin: 0 }}><strong>Next action:</strong> {rec.action}</p>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 32, background: BRAND.darkGreen, borderRadius: 10, padding: "28px 24px", textAlign: "center" }}>
                      <h3 style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 18, fontWeight: 600, color: BRAND.white, margin: "0 0 8px" }}>Need help building a stronger persona?</h3>
                      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: "0 0 18px" }}>
                        Summit works alongside small teams selling to enterprise — refining targeting, building account strategies, and closing the gap between aspiration and pipeline reality.
                      </p>
                      <a
                        href="https://calendar.google.com/calendar/appointments/schedules/AcZssZ35rKsxptXY-OfUDUjC4G9jWqVTFtPcCPApotrNSNzoQoEvN-HAegmAab4E5jxQ7NAgSF89ollu?gv=true"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "inline-block", padding: "12px 32px", borderRadius: 6, background: BRAND.brandGreen, color: BRAND.white, fontFamily: "var(--font-oswald), sans-serif", fontWeight: 600, fontSize: 15, cursor: "pointer", letterSpacing: "0.03em", textDecoration: "none" }}
                      >
                        Book a Call
                      </a>
                    </div>

                    <p style={{ textAlign: "center", fontSize: 11, color: BRAND.mid, marginTop: 24, fontStyle: "italic" }}>
                      Evaluated using Summit Strategy Advisory&apos;s GTM Quality Framework for Constrained-Universe Enterprise Selling.
                    </p>
                  </>
                )}
              </>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
