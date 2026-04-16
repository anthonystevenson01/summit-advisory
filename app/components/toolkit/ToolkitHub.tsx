"use client";

import { useState } from "react";
import Link from "next/link";
import { TOOLS } from "./data/toolConfig";
import { usePrompts } from "./hooks/usePrompts";
import PositioningTool from "./tools/PositioningTool";
import ProblemTool from "./tools/ProblemTool";
import PersonaTool from "./tools/PersonaTool";
import MoatTool from "./tools/MoatTool";
import AccountIntelTool from "./tools/AccountIntelTool";
import NewsletterCapture from "./shared/NewsletterCapture";

const BOOK_CALL_URL =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ35rKsxptXY-OfUDUjC4G9jWqVTFtPcCPApotrNSNzoQoEvN-HAegmAab4E5jxQ7NAgSF89ollu?gv=true";

type ToolId = "positioning" | "problem" | "persona" | "moat" | "account";

const toolLabels: Record<ToolId, string> = {
  positioning: "01 — Positioning Grader",
  problem: "02 — Problem Validator",
  persona: "03 — Persona Check",
  moat: "04 — Moat Rater",
  account: "05 — Account Intel",
};

function SummitNav({ right }: { right: React.ReactNode }) {
  return (
    <nav className="nav" aria-label="Summit Strategy Advisory navigation">
      <a href="/" aria-label="Summit Strategy Advisory home">
        <img src="/brand-icons/Combination Mark_White.png" alt="Summit Strategy Advisory" className="nav-logo" />
      </a>
      <div className="nav-right">
        {right}
        <a href={BOOK_CALL_URL} target="_blank" rel="noopener noreferrer" className="nav-cta">
          Book a Call
        </a>
      </div>
    </nav>
  );
}

export default function ToolkitHub() {
  const [activeTool, setActiveTool] = useState<ToolId | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const tool = params.get("tool") as ToolId | null;
    const valid: ToolId[] = ["positioning", "problem", "persona", "moat", "account"];
    return tool && valid.includes(tool) ? tool : null;
  });
  const { prompts } = usePrompts();

  function selectTool(id: ToolId) {
    setActiveTool(id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function exitTool() {
    setActiveTool(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (activeTool) {
    return (
      <div>
        <SummitNav right={
          <>
            <button onClick={exitTool} className="nav-link" style={{ background: "none", border: "none", cursor: "pointer" }}>
              ← All Tools
            </button>
            <span className="nav-link" style={{ color: "rgba(255,255,255,0.85)", cursor: "default" }}>
              {toolLabels[activeTool]}
            </span>
          </>
        } />
        {activeTool === "positioning" && <PositioningTool systemPrompt={prompts.positioning} />}
        {activeTool === "problem" && <ProblemTool systemPrompt={prompts.problem} />}
        {activeTool === "persona" && <PersonaTool systemPrompt={prompts.persona} />}
        {activeTool === "moat" && <MoatTool systemPrompt={prompts.moat} />}
        {activeTool === "account" && <AccountIntelTool systemPrompt={prompts.account} />}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--off)", display: "flex", flexDirection: "column" }}>

      {/* Nav */}
      <SummitNav right={
        <>
          <a href="/" className="nav-link">Home</a>
          <span className="nav-link" style={{ color: "rgba(255,255,255,0.85)", cursor: "default" }}>GTM Toolkit</span>
          <a href="/newsletter" className="nav-link">Newsletter</a>
        </>
      } />

      {/* Hero — matches homepage home-hero style */}
      <div className="home-hero" style={{ paddingTop: 112 }}>
        <div className="home-hero-inner">
          <div className="hero-label">Scale-Up Advisory</div>
          <h1 className="hero-headline">
            Summit<br /><span className="accent">GTM</span><br />Toolkit
          </h1>
          <p className="hero-body">
            Five free AI diagnostic tools for teams selling into finite, defined markets. No signup. No fluff.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 32, flexWrap: "wrap" }}>
            {["Five Free Tools", "For teams selling into a finite market", "No Signup Required"].map((tag) => (
              <span key={tag} style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--sage)",
                border: "1px solid rgba(49,154,101,0.4)",
                borderRadius: 2,
                padding: "4px 10px",
              }}>{tag}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Niche callout */}
      <div style={{ background: "var(--teal)", padding: "32px 48px" }}>
        <p style={{
          fontFamily: "Barlow, sans-serif",
          fontSize: 15,
          lineHeight: 1.75,
          color: "rgba(255,255,255,0.8)",
          maxWidth: 760,
          margin: "0 auto",
        }}>
          Generic GTM advice assumes you have an infinite market. You don&rsquo;t. When your TAM is 400 accounts, every positioning misstep costs you a prospect you&rsquo;ll never get back. These tools are built for that reality.
        </p>
      </div>

      {/* Tool cards */}
      <div className="cards-section" style={{ flex: 1 }}>
        <div className="cards-label">The Tools</div>
        <div className="cards" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              className="card"
              onClick={() => selectTool(tool.id as ToolId)}
              aria-label={`Open ${tool.name}`}
            >
              <div className="card-icon-wrap" style={{ background: tool.surface, minHeight: 72, alignItems: "flex-end", paddingBottom: 20 }}>
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: tool.accent,
                }}>Tool {tool.num.toString().padStart(2, "0")}</span>
              </div>
              <div className="card-body" style={{ borderTopColor: tool.accent }}>
                <div className="card-title">{tool.name}</div>
                <p className="card-desc">{tool.tagline}</p>
                <p style={{ fontSize: 13, color: "var(--ghost)", marginTop: 8, lineHeight: 1.6 }}>
                  <strong style={{ color: "var(--teal)" }}>You get:</strong> {tool.outputDescription}
                </p>
                <div style={{
                  marginTop: "auto",
                  paddingTop: 20,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--teal)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}>Open Tool →</div>
              </div>
            </button>
          ))}

          {/* ICP Evaluator */}
          <Link href="/?tool=icp-evaluator" className="card" style={{ textDecoration: "none" }} aria-label="Open ICP Evaluator">
            <div className="card-icon-wrap" style={{ background: "#1a3a2a", minHeight: 72, alignItems: "flex-end", paddingBottom: 20, position: "relative" }}>
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#319A65",
              }}>ICP Evaluator</span>
              <span style={{
                position: "absolute",
                top: 12,
                right: 12,
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                background: "rgba(49,154,101,0.2)",
                color: "#319A65",
                border: "1px solid rgba(49,154,101,0.4)",
                borderRadius: 2,
                padding: "2px 8px",
              }}>Existing Tool</span>
            </div>
            <div className="card-body" style={{ borderTopColor: "#319A65" }}>
              <div className="card-title">ICP Evaluator</div>
              <p className="card-desc">Score your Ideal Customer Profile against seven weighted dimensions.</p>
              <p style={{ fontSize: 13, color: "var(--ghost)", marginTop: 8, lineHeight: 1.6 }}>
                <strong style={{ color: "var(--teal)" }}>You get:</strong> Weighted ICP score, dimension breakdown, and improvement recommendations.
              </p>
              <div style={{
                marginTop: "auto",
                paddingTop: 20,
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--teal)",
              }}>Open Tool →</div>
            </div>
          </Link>
        </div>
      </div>

      {/* How It Works */}
      <div style={{ background: "var(--white)", padding: "64px 48px" }}>
        <div className="section-label">How It Works</div>
        <p className="section-intro" style={{ marginBottom: 40 }}>
          Three steps. No account required. Results in under 30 seconds.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
          {[
            { num: "01", title: "Describe context", body: "Paste your positioning statement, problem description, persona, or target account name. The more specific, the better the output." },
            { num: "02", title: "Get scored", body: "The AI evaluates your input across six dimensions with scores, observations, and specific gaps. No flattery — just honest analysis." },
            { num: "03", title: "Fix the right things", body: "Each dimension tells you exactly what to improve and why it matters for a team selling into a finite market." },
          ].map((step) => (
            <div key={step.num}>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 36,
                fontWeight: 900,
                color: "var(--sage)",
                lineHeight: 1,
                marginBottom: 12,
              }}>{step.num}</div>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 18,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--forest)",
                marginBottom: 8,
              }}>{step.title}</div>
              <p style={{ fontSize: 14, color: "var(--ghost)", lineHeight: 1.75 }}>{step.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Newsletter */}
      <NewsletterCapture dark label="Get the Scale-Up Letter" />

      {/* Footer */}
      <div style={{
        background: "var(--forest)",
        padding: "24px 48px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <img src="/brand-icons/Combination Mark_White.png" alt="Summit" style={{ height: 24, opacity: 0.7 }} />
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.4)",
        }}>Summit GTM Toolkit &middot; For teams selling into a finite market</span>
      </div>

    </div>
  );
}
