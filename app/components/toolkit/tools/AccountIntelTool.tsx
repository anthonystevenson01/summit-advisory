"use client";

import { useState } from "react";
import Tag from "../shared/Tag";
import NewsletterCapture from "../shared/NewsletterCapture";
import CyclingLoader from "../shared/CyclingLoader";
import ErrMsg from "../shared/ErrMsg";

const CYCLING_MESSAGES = [
  "Searching company news…",
  "Looking for leadership signals…",
  "Scanning job postings…",
  "Identifying contact roles…",
  "Pulling market signals…",
  "Building the brief…",
];

const SIGNAL_COLORS: Record<string, string> = {
  Hiring: "#67e8f9",
  Leadership: "#a78bfa",
  Technology: "#86efac",
  News: "#fbbf24",
  Financial: "#34d399",
  Regulatory: "#f97316",
};

const TIMING_COLORS: Record<string, string> = {
  Now: "#22c55e",
  Watch: "#fbbf24",
  "Not Yet": "#f97316",
};

interface Contact {
  role: string;
  why_relevant: string;
  signal?: string;
  title_variants: string[];
  linkedin_search: string;
}

interface Signal {
  type: string;
  finding: string;
  implication: string;
}

interface AccountResult {
  account_name: string;
  description: string;
  strategic_context: string;
  icp_fit: { rating: string; score: number };
  timing: string;
  fit_reasoning: string;
  contacts: Contact[];
  signals: Signal[];
  recommended_opening: string;
  timing_verdict: string;
}

interface Props {
  systemPrompt: string;
}

export default function AccountIntelTool({ systemPrompt }: Props) {
  const [accountName, setAccountName] = useState("");
  const [website, setWebsite] = useState("");
  const [icpContext, setIcpContext] = useState("");
  const [personaContext, setPersonaContext] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AccountResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/gtm/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_name: accountName,
          website,
          icp_context: icpContext,
          persona_context: personaContext,
          systemPrompt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed.");
      setResult(data as AccountResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setAccountName(""); setWebsite(""); setIcpContext(""); setPersonaContext("");
    setResult(null); setError(null); setShowContext(false);
  }

  const timingColor = result ? (TIMING_COLORS[result.timing] ?? "var(--sage)") : "var(--sage)";

  return (
    <div className="inner">
      {!result && !loading && (
        <>
          <div className="inner-hero">
            <div className="inner-eyebrow">GTM Toolkit</div>
            <h1 className="inner-title">Account Intelligence</h1>
            <p className="inner-lead">
              Enter a target account name. Get a full sales brief — ICP fit, timing, key contacts, and live market signals.
            </p>
          </div>

          <div className="inner-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="acct-name">
                  Target Account Name *
                </label>
                <input
                  id="acct-name"
                  className="form-input"
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. Tesco PLC"
                  required
                  maxLength={200}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="acct-website">
                  Company Website (optional)
                </label>
                <input
                  id="acct-website"
                  className="form-input"
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://www.example.com"
                  maxLength={300}
                />
              </div>

              {/* Collapsible context */}
              <button
                type="button"
                onClick={() => setShowContext((v) => !v)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: "var(--font-barlow-condensed), sans-serif",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--forest)",
                  background: "none",
                  border: "1px solid var(--border)",
                  padding: "10px 16px",
                  cursor: "pointer",
                  marginBottom: 16,
                }}
                aria-expanded={showContext}
                aria-controls="acct-context-fields"
              >
                <span>{showContext ? "▲" : "▼"}</span>
                <span>Add ICP &amp; Persona Context (optional)</span>
              </button>

              {showContext && (
                <div id="acct-context-fields">
                  <div className="form-group">
                    <label className="form-label" htmlFor="acct-icp">
                      ICP Context
                    </label>
                    <textarea
                      id="acct-icp"
                      className="form-textarea"
                      rows={3}
                      value={icpContext}
                      onChange={(e) => setIcpContext(e.target.value)}
                      placeholder="Describe your Ideal Customer Profile — industry, size, tech stack, pain points…"
                      maxLength={2000}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="acct-persona">
                      Persona Context
                    </label>
                    <textarea
                      id="acct-persona"
                      className="form-textarea"
                      rows={3}
                      value={personaContext}
                      onChange={(e) => setPersonaContext(e.target.value)}
                      placeholder="Who you typically sell to — title, seniority, department, priorities…"
                      maxLength={2000}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="submit-btn"
                disabled={!accountName.trim()}
              >
                Build Account Brief
              </button>
            </form>
          </div>
        </>
      )}

      {loading && <div className="inner-body"><CyclingLoader dark={false} messages={CYCLING_MESSAGES} /></div>}

      {error && !loading && (
        <div className="inner-body">
          <ErrMsg msg={error} retry={() => setError(null)} dark={false} />
        </div>
      )}

      {result && !loading && (
        <>
          <div className="inner-hero">
            <div className="inner-eyebrow">Account Intelligence — Brief</div>
            <h1 className="inner-title">{result.account_name}</h1>
            <p className="inner-lead">{result.description}</p>
          </div>

          <div className="inner-body">
            {/* Strategic context */}
            <p style={{ fontSize: 14, color: "var(--ghost)", lineHeight: 1.75, fontStyle: "italic", marginBottom: 32 }}>
              {result.strategic_context}
            </p>

            {/* ICP Fit + Timing */}
            <div className="features" style={{ marginBottom: 32 }}>
              <div className="feature">
                <div className="feature-title">ICP Fit</div>
                <p style={{
                  fontFamily: "var(--font-barlow-condensed), sans-serif",
                  fontSize: 32,
                  fontWeight: 900,
                  color: "var(--sage)",
                  lineHeight: 1,
                  marginBottom: 4,
                }}>
                  {result.icp_fit.rating}
                </p>
                <p style={{
                  fontFamily: "var(--font-barlow-condensed), sans-serif",
                  fontSize: 20,
                  fontWeight: 700,
                  color: "var(--ghost)",
                }}>
                  {result.icp_fit.score}/100
                </p>
              </div>
              <div className="feature" style={{ borderLeftColor: timingColor }}>
                <div className="feature-title" style={{ color: timingColor }}>Timing</div>
                <p style={{
                  fontFamily: "var(--font-barlow-condensed), sans-serif",
                  fontSize: 32,
                  fontWeight: 900,
                  color: timingColor,
                  lineHeight: 1,
                }}>
                  {result.timing}
                </p>
              </div>
            </div>

            {/* Fit reasoning */}
            <div className="feature" style={{ marginBottom: 32 }}>
              <div className="feature-title">Fit Reasoning</div>
              <p className="feature-body">{result.fit_reasoning}</p>
            </div>

            {/* Key contacts */}
            {result.contacts.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div className="section-label">Key Contacts</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 16 }}>
                  {result.contacts.map((c, i) => (
                    <div key={i} className="feature">
                      <div className="feature-title">{c.role}</div>
                      <p className="feature-body">{c.why_relevant}</p>
                      {c.signal && (
                        <p style={{ fontSize: 13, color: "var(--sage)", marginTop: 8, fontStyle: "italic" }}>{c.signal}</p>
                      )}
                      {c.title_variants.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                          {c.title_variants.map((tv) => (
                            <Tag key={tv} color="var(--teal)">{tv}</Tag>
                          ))}
                        </div>
                      )}
                      <p style={{ fontSize: 12, color: "var(--ghost)", marginTop: 8, fontFamily: "var(--font-dm-mono), monospace" }}>
                        {c.linkedin_search}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Market signals */}
            {result.signals.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div className="section-label">Market Signals</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 16 }}>
                  {result.signals.map((s, i) => {
                    const tagColor = SIGNAL_COLORS[s.type] ?? "var(--sage)";
                    return (
                      <div key={i} className="feature" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                        <div style={{ flexShrink: 0, paddingTop: 2 }}>
                          <Tag color={tagColor}>{s.type}</Tag>
                        </div>
                        <div>
                          <p className="feature-body" style={{ marginBottom: 6 }}>{s.finding}</p>
                          <p style={{ fontSize: 13, color: "var(--ghost)", lineHeight: 1.65 }}>
                            Why it matters: {s.implication}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recommended opening */}
            <div className="feature" style={{ borderLeftColor: "var(--sage)", marginBottom: 16 }}>
              <div className="feature-title">Recommended Opening</div>
              <p className="feature-body">{result.recommended_opening}</p>
            </div>

            {/* Timing verdict */}
            <div className="feature" style={{ borderLeftColor: timingColor, marginBottom: 32 }}>
              <div className="feature-title" style={{ color: timingColor }}>Timing Verdict</div>
              <p className="feature-body">{result.timing_verdict}</p>
            </div>

            <NewsletterCapture dark={false} />

            <button
              className="submit-btn"
              onClick={reset}
              style={{ marginTop: 24 }}
              aria-label="Research another account"
            >
              Research Another Account
            </button>
          </div>
        </>
      )}
    </div>
  );
}
