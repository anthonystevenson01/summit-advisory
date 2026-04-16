"use client";

import { useState } from "react";
import Tag from "../shared/Tag";
import NewsletterCapture from "../shared/NewsletterCapture";
import CyclingLoader from "../shared/CyclingLoader";
import ErrMsg from "../shared/ErrMsg";

const SURFACE = "#00252e";
const ACCENT = "#67e8f9";
const FG = "#fff";

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

  const timingColor = result ? (TIMING_COLORS[result.timing] ?? ACCENT) : ACCENT;

  return (
    <div className="tk-tool-surface" style={{ background: SURFACE, color: FG }}>
      <button className="tk-back-btn" onClick={reset} style={{ color: ACCENT }} aria-label="Back to toolkit hub">
        ← All Tools
      </button>

      {!result && !loading && (
        <form onSubmit={handleSubmit} className="tk-form">
          <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: 28, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 8, color: FG }}>
            Account Intelligence
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 32, lineHeight: 1.7 }}>
            Enter a target account name. Get a full sales brief — ICP fit, timing, key contacts, and live market signals.
          </p>

          <div className="tk-form-group">
            <label className="tk-label" htmlFor="acct-name" style={{ color: "rgba(255,255,255,0.55)" }}>
              Target Account Name *
            </label>
            <input
              id="acct-name"
              className="tk-input"
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g. Tesco PLC"
              required
              maxLength={200}
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: FG }}
            />
          </div>

          <div className="tk-form-group">
            <label className="tk-label" htmlFor="acct-website" style={{ color: "rgba(255,255,255,0.55)" }}>
              Company Website (optional)
            </label>
            <input
              id="acct-website"
              className="tk-input"
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.example.com"
              maxLength={300}
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: FG }}
            />
          </div>

          {/* Collapsible context */}
          <button
            type="button"
            className="tk-context-toggle"
            onClick={() => setShowContext((v) => !v)}
            style={{ color: ACCENT, borderColor: ACCENT + "44" }}
            aria-expanded={showContext}
            aria-controls="acct-context-fields"
          >
            <span>{showContext ? "▲" : "▼"}</span>
            <span>Add ICP &amp; Persona Context (optional)</span>
          </button>

          {showContext && (
            <div id="acct-context-fields">
              <div className="tk-form-group">
                <label className="tk-label" htmlFor="acct-icp" style={{ color: "rgba(255,255,255,0.55)" }}>
                  ICP Context
                </label>
                <textarea
                  id="acct-icp"
                  className="tk-textarea tk-input"
                  rows={3}
                  value={icpContext}
                  onChange={(e) => setIcpContext(e.target.value)}
                  placeholder="Describe your Ideal Customer Profile — industry, size, tech stack, pain points…"
                  maxLength={2000}
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: FG }}
                />
              </div>
              <div className="tk-form-group">
                <label className="tk-label" htmlFor="acct-persona" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Persona Context
                </label>
                <textarea
                  id="acct-persona"
                  className="tk-textarea tk-input"
                  rows={3}
                  value={personaContext}
                  onChange={(e) => setPersonaContext(e.target.value)}
                  placeholder="Who you typically sell to — title, seniority, department, priorities…"
                  maxLength={2000}
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: FG }}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="tk-btn-primary"
            disabled={!accountName.trim()}
            style={{ background: ACCENT, color: SURFACE, marginTop: 8 }}
          >
            Build Account Brief
          </button>
        </form>
      )}

      {loading && <CyclingLoader dark messages={CYCLING_MESSAGES} />}

      {error && !loading && (
        <ErrMsg msg={error} retry={() => setError(null)} dark />
      )}

      {result && !loading && (
        <div className="tk-results">
          {/* Account header */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: 32, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: FG, marginBottom: 8 }}>
              {result.account_name}
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", lineHeight: 1.7, marginBottom: 10 }}>{result.description}</p>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, fontStyle: "italic" }}>{result.strategic_context}</p>
          </div>

          {/* ICP Fit + Timing */}
          <div className="tk-two-col" style={{ marginBottom: 20 }}>
            <div className="tk-fit-card" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div className="tk-fit-label" style={{ color: "rgba(255,255,255,0.45)" }}>ICP Fit</div>
              <div className="tk-fit-rating" style={{ color: ACCENT }}>{result.icp_fit.rating}</div>
              <div className="tk-fit-score" style={{ color: ACCENT }}>{result.icp_fit.score}</div>
            </div>
            <div className="tk-timing-card" style={{ background: "rgba(255,255,255,0.05)", flexDirection: "column", alignItems: "flex-start" }}>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>Timing</div>
              <div className="tk-timing-badge" style={{ color: timingColor }}>{result.timing}</div>
            </div>
          </div>

          {/* Fit reasoning */}
          <div className="tk-panel" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="tk-panel-label" style={{ color: "rgba(255,255,255,0.45)" }}>Fit Reasoning</div>
            <p className="tk-panel-text" style={{ color: FG }}>{result.fit_reasoning}</p>
          </div>

          {/* Key contacts */}
          {result.contacts.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 16, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: ACCENT, marginBottom: 12 }}>
                Key Contacts
              </div>
              {result.contacts.map((c, i) => (
                <div className="tk-contact-row" key={i} style={{ background: "rgba(255,255,255,0.04)", marginBottom: 3 }}>
                  <div className="tk-contact-role" style={{ color: FG }}>{c.role}</div>
                  <p className="tk-contact-why" style={{ color: "rgba(255,255,255,0.75)" }}>{c.why_relevant}</p>
                  {c.signal && <p className="tk-contact-signal" style={{ color: ACCENT }}>{c.signal}</p>}
                  {c.title_variants.length > 0 && (
                    <div className="tk-contact-variants">
                      {c.title_variants.map((tv) => (
                        <Tag key={tv} color={ACCENT}>{tv}</Tag>
                      ))}
                    </div>
                  )}
                  <div className="tk-contact-linkedin" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {c.linkedin_search}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Market signals */}
          {result.signals.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 16, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: ACCENT, marginBottom: 12 }}>
                Market Signals
              </div>
              {result.signals.map((s, i) => {
                const tagColor = SIGNAL_COLORS[s.type] ?? ACCENT;
                return (
                  <div className="tk-signal-row" key={i} style={{ background: "rgba(255,255,255,0.04)", marginBottom: 3 }}>
                    <div className="tk-signal-left">
                      <Tag color={tagColor}>{s.type}</Tag>
                    </div>
                    <div className="tk-signal-right">
                      <p className="tk-signal-finding" style={{ color: FG }}>{s.finding}</p>
                      <p className="tk-signal-implication" style={{ color: "rgba(255,255,255,0.6)" }}>Why it matters: {s.implication}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recommended opening */}
          <div className="tk-panel" style={{ background: "rgba(52,211,153,0.08)", borderLeft: `4px solid ${ACCENT}` }}>
            <div className="tk-panel-label" style={{ color: ACCENT }}>Recommended Opening</div>
            <p className="tk-panel-text" style={{ color: FG }}>{result.recommended_opening}</p>
          </div>

          {/* Timing verdict */}
          <div className="tk-panel" style={{ background: timingColor + "11", borderLeft: `4px solid ${timingColor}` }}>
            <div className="tk-panel-label" style={{ color: timingColor }}>Timing Verdict</div>
            <p className="tk-panel-text" style={{ color: FG }}>{result.timing_verdict}</p>
          </div>

          {/* CTA */}
          <div style={{ padding: "20px 0", marginBottom: 24 }}>
            <a
              href="#"
              style={{ fontFamily: "Oswald, sans-serif", fontSize: 15, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: ACCENT, textDecoration: "none" }}
            >
              Get the full brief with email drafts →
            </a>
          </div>

          <NewsletterCapture dark />

          <button
            className="tk-btn-ghost"
            onClick={reset}
            style={{ color: ACCENT, borderColor: ACCENT + "66", marginTop: 24 }}
            aria-label="Research another account"
          >
            Research Another Account
          </button>
        </div>
      )}
    </div>
  );
}
