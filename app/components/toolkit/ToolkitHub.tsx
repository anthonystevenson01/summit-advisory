"use client";

import { useState } from "react";
import Link from "next/link";
import { TOOLS } from "./data/toolConfig";
import { usePrompts } from "./hooks/usePrompts";
import { useRubrics } from "./hooks/useRubrics";
import PositioningTool from "./tools/PositioningTool";
import ProblemTool from "./tools/ProblemTool";
import PersonaTool from "./tools/PersonaTool";
import MoatTool from "./tools/MoatTool";
import AccountIntelTool from "./tools/AccountIntelTool";
import NewsletterCapture from "./shared/NewsletterCapture";

const LOGO = "/brand-icons/Combination Mark_White.png";
const BOOK_URL =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ35rKsxptXY-OfUDUjC4G9jWqVTFtPcCPApotrNSNzoQoEvN-HAegmAab4E5jxQ7NAgSF89ollu?gv=true";

type ToolId = "positioning" | "problem" | "persona" | "moat" | "account";

const toolLabels: Record<ToolId, string> = {
  persona:     "02 — Buyer Persona Quality Check",
  problem:     "03 — Market Problem Validator",
  positioning: "04 — Positioning Statement Grader",
  moat:        "05 — Competitive Moat Rater",
  account:     "Account Intelligence",
};

export default function ToolkitHub() {
  const [activeTool, setActiveTool] = useState<ToolId | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const tool = params.get("tool") as ToolId | null;
    const valid: ToolId[] = ["positioning", "problem", "persona", "moat", "account"];
    return tool && valid.includes(tool) ? tool : null;
  });
  const { prompts } = usePrompts();
  const { rubrics } = useRubrics();

  function selectTool(id: ToolId) {
    setActiveTool(id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function exitTool() {
    setActiveTool(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ── Shared nav ── */
  const Nav = ({ toolLabel }: { toolLabel?: string }) => (
    <nav className="nav">
      <a href="/">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt="Summit Strategy Advisory" className="nav-logo" />
      </a>
      <div className="nav-right">
        {toolLabel ? (
          <>
            <button type="button" className="nav-link" onClick={exitTool}>← All Tools</button>
            <span className="nav-link" style={{ color: "rgba(255,255,255,0.85)", cursor: "default" }}>{toolLabel}</span>
          </>
        ) : (
          <>
            <a href="/" className="nav-link">Home</a>
            <a href="/" className="nav-link">Resources</a>
            <span className="nav-link" style={{ color: "rgba(255,255,255,0.9)", cursor: "default" }}>GTM Tools</span>
            <a href="/" className="nav-link">Blog</a>
            <a href="/newsletter" className="nav-link">Newsletter</a>
          </>
        )}
        <a href={BOOK_URL} target="_blank" rel="noopener noreferrer" className="nav-cta">
          Give Us a Call
        </a>
      </div>
    </nav>
  );

  /* ── Shared footer ── */
  const Footer = () => (
    <footer className="footer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO} alt="Summit" className="footer-logo" />
      <ul className="footer-links">
        <li><a href="/">Home</a></li>
        <li><a href="/">AI Studio</a></li>
        <li><a href="/">Scale-Up Advisory</a></li>
        <li><a href="/">Resources</a></li>
        <li><a href="/tools" style={{ color: "rgba(255,255,255,0.55)" }}>GTM Tools</a></li>
        <li><a href="/">Blog</a></li>
        <li><a href="/newsletter">Newsletter</a></li>
      </ul>
      <span className="footer-copy">© 2026 Summit Strategy Advisory</span>
    </footer>
  );

  /* ── Active tool view ── */
  if (activeTool) {
    return (
      <>
        <Nav toolLabel={toolLabels[activeTool]} />
        <div className="page">
          {activeTool === "positioning" && <PositioningTool systemPrompt={prompts.positioning} rubric={rubrics.positioning} />}
          {activeTool === "problem"     && <ProblemTool     systemPrompt={prompts.problem}     rubric={rubrics.problem} />}
          {activeTool === "persona"     && <PersonaTool     systemPrompt={prompts.persona}      rubric={rubrics.persona} />}
          {activeTool === "moat"        && <MoatTool        systemPrompt={prompts.moat}         rubric={rubrics.moat} />}
          {activeTool === "account"     && <AccountIntelTool systemPrompt={prompts.account} />}
          <Footer />
        </div>
      </>
    );
  }

  /* ── Hub view ── */
  return (
    <>
      <Nav />
      <div className="page">

        {/* Hero — full width at page level */}
        <div className="inner-hero">
          <div className="inner-eyebrow">Scale-Up Advisory</div>
          <h1 className="inner-title">Summit GTM Toolkit</h1>
          <p className="inner-lead">
            Five free AI diagnostic tools for teams selling into finite, named-account markets.
            No signup. No fluff. Results in under 30 seconds.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 28, flexWrap: "wrap", position: "relative" }}>
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

        <div className="inner">

          {/* Niche callout */}
          <div style={{ background: "var(--teal)", padding: "28px 48px" }}>
            <p style={{ fontFamily: "Barlow, sans-serif", fontSize: 15, lineHeight: 1.75, color: "rgba(255,255,255,0.75)", maxWidth: 760 }}>
              Generic GTM advice assumes you have an infinite market. You don&rsquo;t. When your TAM is 400 accounts,
              every positioning misstep costs you a prospect you&rsquo;ll never get back. These tools are built for that reality.
            </p>
          </div>

          {/* How It Works — shown before tools so you know how to use them */}
          <div className="inner-body">
            <div className="section-label">How It Works</div>
            <p className="section-intro" style={{ marginBottom: 40 }}>Three steps. No account required. Results in under 30 seconds.</p>
            <div className="features">
              {[
                { num: "01", title: "Describe context", body: "Paste your positioning statement, problem description, persona, or target account name. The more specific you are, the more useful the output." },
                { num: "02", title: "Get scored", body: "The AI evaluates your input across six dimensions with scores, observations, and specific gaps. No flattery — honest analysis." },
                { num: "03", title: "Fix the right things", body: "Each dimension tells you exactly what to improve and why it matters for a team selling into a finite, named-account market." },
              ].map((step) => (
                <div key={step.num} className="feature">
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 32, fontWeight: 900, color: "var(--sage)",
                    lineHeight: 1, marginBottom: 10,
                  }}>{step.num}</div>
                  <div className="feature-title">{step.title}</div>
                  <p className="feature-body">{step.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tool cards — uses homepage .cards-section pattern */}
          <div className="cards-section">
            <div className="cards-label">The Tools</div>
            <div className="cards">

              {/* Tool 01 — ICP Evaluator */}
              <Link href="/?tool=icp-evaluator" className="card" style={{ textDecoration: "none" }} aria-label="Open ICP Evaluator">
                <div className="card-icon-wrap" style={{ background: "#0f2a1e", minHeight: 64, alignItems: "flex-end", paddingBottom: 16 }}>
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 11, fontWeight: 700,
                    letterSpacing: "0.18em", textTransform: "uppercase",
                    color: "var(--sage)",
                  }}>Tool 01</span>
                </div>
                <div className="card-body" style={{ borderTopColor: "var(--sage)" }}>
                  <div className="card-title">ICP Evaluator</div>
                  <p className="card-desc">Score your Ideal Customer Profile across seven weighted dimensions.</p>
                  <p style={{ fontSize: 13, color: "var(--ghost)", marginTop: 8, lineHeight: 1.6 }}>
                    <strong style={{ color: "var(--teal)", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.04em" }}>You get:</strong>{" "}
                    Weighted ICP score, dimension breakdown, and specific improvement recommendations.
                  </p>
                  <div className="card-link" style={{ marginTop: "auto", paddingTop: 16 }}>Open Tool →</div>
                </div>
              </Link>

              {/* Tools 02–05 from config */}
              {TOOLS.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  className="card"
                  onClick={() => selectTool(tool.id as ToolId)}
                  aria-label={`Open ${tool.name}`}
                >
                  <div className="card-icon-wrap" style={{ background: tool.surface, minHeight: 64, alignItems: "flex-end", paddingBottom: 16 }}>
                    <span style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 11, fontWeight: 700,
                      letterSpacing: "0.18em", textTransform: "uppercase",
                      color: tool.accent,
                    }}>Tool {String(tool.num).padStart(2, "0")}</span>
                  </div>
                  <div className="card-body" style={{ borderTopColor: tool.accent }}>
                    <div className="card-title">{tool.name}</div>
                    <p className="card-desc">{tool.tagline}</p>
                    <p style={{ fontSize: 13, color: "var(--ghost)", marginTop: 8, lineHeight: 1.6 }}>
                      <strong style={{ color: "var(--teal)", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.04em" }}>You get:</strong>{" "}
                      {tool.outputDescription}
                    </p>
                    <div className="card-link" style={{ marginTop: "auto", paddingTop: 16 }}>
                      Open Tool →
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Account Intelligence — separate section */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", marginTop: 0 }}>
            <div className="cards-section" style={{ paddingTop: 48 }}>
              <div className="cards-label" style={{ color: "#67e8f9" }}>Account Intelligence</div>
              <p style={{ fontFamily: "Barlow, sans-serif", fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 28, maxWidth: 560, lineHeight: 1.65 }}>
                A deeper research tool — pulls live signals on a named account and builds you a full sales brief.
              </p>
              <div className="cards">
                <button
                  type="button"
                  className="card"
                  onClick={() => selectTool("account")}
                  aria-label="Open Account Intelligence"
                >
                  <div className="card-icon-wrap" style={{ background: "#00252e", minHeight: 64, alignItems: "flex-end", paddingBottom: 16 }}>
                    <span style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: 11, fontWeight: 700,
                      letterSpacing: "0.18em", textTransform: "uppercase",
                      color: "#67e8f9",
                    }}>Account Intel</span>
                  </div>
                  <div className="card-body" style={{ borderTopColor: "#67e8f9" }}>
                    <div className="card-title">Account Intelligence</div>
                    <p className="card-desc">Get a full sales brief on any target account — signals, contacts, and an opening play.</p>
                    <p style={{ fontSize: 13, color: "var(--ghost)", marginTop: 8, lineHeight: 1.6 }}>
                      <strong style={{ color: "#67e8f9", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.04em" }}>You get:</strong>{" "}
                      ICP fit, timing verdict, key contacts with LinkedIn searches, market signals, recommended opening.
                    </p>
                    <div className="card-link" style={{ marginTop: "auto", paddingTop: 16 }}>
                      Open Tool →
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Newsletter */}
          <NewsletterCapture dark label="Get the Scale-Up Letter" />

        </div>
        <Footer />
      </div>
    </>
  );
}
