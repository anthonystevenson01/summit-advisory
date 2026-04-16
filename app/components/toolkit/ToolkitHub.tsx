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

type ToolId = "positioning" | "problem" | "persona" | "moat" | "account";

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
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function exitTool() {
    setActiveTool(null);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  if (activeTool === "positioning") {
    return (
      <div>
        <div style={{ position: "sticky", top: 0, zIndex: 200, background: "#053030", padding: "8px 40px", display: "flex", alignItems: "center", gap: 16, borderBottom: "2px solid #005A66" }}>
          <button onClick={exitTool} style={{ fontFamily: "Oswald, sans-serif", fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: 6, padding: 0, transition: "color 0.2s" }} aria-label="Back to toolkit hub">
            ← All Tools
          </button>
          <span style={{ fontFamily: "Oswald, sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", textTransform: "uppercase", letterSpacing: "0.06em" }}>01 — Positioning Grader</span>
        </div>
        <PositioningTool systemPrompt={prompts.positioning} />
      </div>
    );
  }
  if (activeTool === "problem") {
    return (
      <div>
        <div style={{ position: "sticky", top: 0, zIndex: 200, background: "#053030", padding: "8px 40px", display: "flex", alignItems: "center", gap: 16, borderBottom: "2px solid #005A66" }}>
          <button onClick={exitTool} style={{ fontFamily: "Oswald, sans-serif", fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: 6, padding: 0 }} aria-label="Back to toolkit hub">
            ← All Tools
          </button>
          <span style={{ fontFamily: "Oswald, sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", textTransform: "uppercase", letterSpacing: "0.06em" }}>02 — Problem Validator</span>
        </div>
        <ProblemTool systemPrompt={prompts.problem} />
      </div>
    );
  }
  if (activeTool === "persona") {
    return (
      <div>
        <div style={{ position: "sticky", top: 0, zIndex: 200, background: "#053030", padding: "8px 40px", display: "flex", alignItems: "center", gap: 16, borderBottom: "2px solid #005A66" }}>
          <button onClick={exitTool} style={{ fontFamily: "Oswald, sans-serif", fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: 6, padding: 0 }} aria-label="Back to toolkit hub">
            ← All Tools
          </button>
          <span style={{ fontFamily: "Oswald, sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", textTransform: "uppercase", letterSpacing: "0.06em" }}>03 — Persona Check</span>
        </div>
        <PersonaTool systemPrompt={prompts.persona} />
      </div>
    );
  }
  if (activeTool === "moat") {
    return (
      <div>
        <div style={{ position: "sticky", top: 0, zIndex: 200, background: "#053030", padding: "8px 40px", display: "flex", alignItems: "center", gap: 16, borderBottom: "2px solid #005A66" }}>
          <button onClick={exitTool} style={{ fontFamily: "Oswald, sans-serif", fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: 6, padding: 0 }} aria-label="Back to toolkit hub">
            ← All Tools
          </button>
          <span style={{ fontFamily: "Oswald, sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", textTransform: "uppercase", letterSpacing: "0.06em" }}>04 — Moat Rater</span>
        </div>
        <MoatTool systemPrompt={prompts.moat} />
      </div>
    );
  }
  if (activeTool === "account") {
    return (
      <div>
        <div style={{ position: "sticky", top: 0, zIndex: 200, background: "#053030", padding: "8px 40px", display: "flex", alignItems: "center", gap: 16, borderBottom: "2px solid #005A66" }}>
          <button onClick={exitTool} style={{ fontFamily: "Oswald, sans-serif", fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", gap: 6, padding: 0 }} aria-label="Back to toolkit hub">
            ← All Tools
          </button>
          <span style={{ fontFamily: "Oswald, sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", textTransform: "uppercase", letterSpacing: "0.06em" }}>05 — Account Intel</span>
        </div>
        <AccountIntelTool systemPrompt={prompts.account} />
      </div>
    );
  }

  return (
    <div className="tk-nl-page" style={{ background: "#F5F9F6" }}>
      {/* Sticky nav */}
      <nav className="tk-nav" aria-label="Summit GTM Toolkit navigation">
        <span className="tk-nav-logo">Summit</span>
        <span className="tk-nav-label">GTM Toolkit</span>
        <span className="tk-nav-tag">For teams selling into a finite market</span>
      </nav>

      {/* Hero */}
      <div className="tk-hero">
        <h1 className="tk-hero-h1">Summit GTM Toolkit</h1>
        <p className="tk-hero-sub">
          Five free AI tools built for scale-up teams selling into finite, defined markets. No generic advice. No fluff.
        </p>
        <div className="tk-tags">
          <span className="tk-tag">Five Free Tools</span>
          <span className="tk-tag">For teams selling into a finite market</span>
          <span className="tk-tag">No Signup Required</span>
        </div>
      </div>

      {/* Niche callout strip */}
      <div className="tk-niche-strip">
        <p>
          Generic GTM advice assumes you have an infinite market. You don&rsquo;t. When your TAM is 400 accounts, every positioning misstep costs you a prospect you&rsquo;ll never get back. These tools are built for that reality — where precision beats volume, and getting the message right matters more than reaching more people.
        </p>
      </div>

      {/* Tool cards */}
      <div className="tk-cards-section">
        <h2 className="tk-cards-title">The Tools</h2>
        <p className="tk-cards-sub">Each tool runs in your browser. Your input stays in your browser session. Results are AI-generated and take 10–20 seconds.</p>
        <div className="tk-cards-grid">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              className="tk-tool-card"
              onClick={() => selectTool(tool.id as ToolId)}
              style={{ borderColor: "transparent" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = tool.accent; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "transparent"; }}
              aria-label={`Open ${tool.name}`}
            >
              <div className="tk-tool-card-top">
                <div className="tk-tool-card-num">Tool {tool.num}</div>
                <div className="tk-tool-card-name">{tool.name}</div>
                <p className="tk-tool-card-tagline">{tool.tagline}</p>
                <p className="tk-tool-card-output"><strong>You get:</strong> {tool.outputDescription}</p>
              </div>
              <div className="tk-tool-card-footer" style={{ borderTopColor: tool.accent + "44" }}>
                Open Tool →
              </div>
            </button>
          ))}

          {/* ICP Evaluator card */}
          <Link
            href="/?tool=icp-evaluator"
            className="tk-tool-card"
            style={{ textDecoration: "none", borderColor: "transparent" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#319A65"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "transparent"; }}
            aria-label="Open ICP Evaluator"
          >
            <div className="tk-tool-card-top">
              <div className="tk-tool-card-num">
                ICP Evaluator
                <span className="tk-badge">Existing Tool</span>
              </div>
              <div className="tk-tool-card-name">ICP Evaluator</div>
              <p className="tk-tool-card-tagline">Score your Ideal Customer Profile against seven weighted dimensions.</p>
              <p className="tk-tool-card-output"><strong>You get:</strong> Weighted ICP score, dimension breakdown, and specific improvement recommendations.</p>
            </div>
            <div className="tk-tool-card-footer" style={{ borderTopColor: "#319A6544" }}>
              Open Tool →
            </div>
          </Link>
        </div>
      </div>

      {/* How It Works */}
      <div className="tk-how-section">
        <h2 className="tk-how-title">How It Works</h2>
        <div className="tk-steps">
          <div className="tk-step">
            <div className="tk-step-num">01</div>
            <div className="tk-step-title">Describe context</div>
            <p className="tk-step-body">Paste your positioning statement, problem description, persona, or target account. The more specific you are, the more useful the output.</p>
          </div>
          <div className="tk-step">
            <div className="tk-step-num">02</div>
            <div className="tk-step-title">Get scored</div>
            <p className="tk-step-body">The AI evaluates your input across six dimensions with scores, observations, and specific gaps. No flattery — just honest analysis.</p>
          </div>
          <div className="tk-step">
            <div className="tk-step-num">03</div>
            <div className="tk-step-title">Fix the right things</div>
            <p className="tk-step-body">Each dimension tells you exactly what to improve and why it matters for a team selling into a finite market.</p>
          </div>
        </div>
      </div>

      {/* Newsletter capture */}
      <NewsletterCapture dark label="Get the Scale-Up Letter" />

      {/* Footer */}
      <div className="tk-footer">
        <span className="tk-footer-text">Summit GTM Toolkit &middot; For teams selling into a finite market</span>
      </div>
    </div>
  );
}
