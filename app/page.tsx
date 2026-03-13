"use client";

import { useState } from "react";
import { LOGO_WHITE, ICON_AI, ICON_RETAIL, ICON_SME } from "./summit-assets";

const BOOK_CALL_URL = "https://calendar.app.google/n6zsiTaE6p37Jzcu6";

// ── Arrow icons ──
function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M2 7h10M8 3l4 4-4 4" />
    </svg>
  );
}
function ArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 7H2M6 3L2 7l4 4" />
    </svg>
  );
}

// ── Data ──
const practiceData: Record<string, { eyebrow: string; title: string; lead: string; features: { title: string; body: string }[]; cta: string }> = {
  ai: {
    eyebrow: "Practice 01",
    title: "AI Product Studio",
    lead: "We build technology products for early-stage founders — in exchange for equity. Think of us as a technical co-founder you don't have to hire full-time. Podbeat.ai is our proof of concept.",
    features: [
      { title: "Equity-based model", body: "No large upfront retainers. We take a stake in what we build, so our incentives are fully aligned with your success from day one." },
      { title: "End-to-end delivery", body: "From product specification and design through to deployed, production-grade software. We don't hand off to junior teams." },
      { title: "AI-native approach", body: "We build with modern AI tooling — LLMs, agents, embeddings — as a first principle, not a bolt-on feature." },
      { title: "Podbeat.ai proof of concept", body: "Our own AI podcast tool, built entirely within the studio model. Real product, live users, ongoing iteration." },
    ],
    cta: "Talk to us about your product idea",
  },
  retail: {
    eyebrow: "Practice 02",
    title: "Loyalty & Retail Media",
    lead: "Loyalty programs and retail media for large retailers — retained advisory against outcomes, not open-ended retainers.",
    features: [
      { title: "Loyalty programme design", body: "Architecture, commercial modelling, and vendor selection for loyalty platforms across points, tiers, and coalition models." },
      { title: "Retail media strategy", body: "First-party data monetisation, network build vs buy decisions, and advertiser commercials for large-format retailers." },
      { title: "Digital commerce", body: "Online-to-offline integration, mobile commerce, and payment experience strategy for omnichannel retail." },
      { title: "Retained advisory model", body: "We work on a monthly retainer against a defined set of objectives. You get senior thinking and hands-on execution for as long as you need it." },
    ],
    cta: "Discuss your retail challenge",
  },
  sme: {
    eyebrow: "Practice 03",
    title: "Scale-Up Advisory",
    lead: "Fractional CXO leadership for growing businesses — executive-level strategy and hands-on execution without the full-time overhead. We embed at the leadership level, own the outcomes, and move at the speed your business needs.",
    features: [
      { title: "Fractional GTM leadership", body: "Part-time, senior-level ownership of your go-to-market function: sales process, channel strategy, and pipeline development." },
      { title: "Tech expansion", body: "A proven playbook for European technology companies entering North America — from ICP definition and channel selection through to first revenue." },
      { title: "Market entry & positioning", body: "Competitive positioning, ICP definition, pricing architecture, and launch sequencing for new markets and new products." },
      { title: "Deal support", body: "Direct involvement in critical deals — strategy, stakeholder mapping, and live negotiation support." },
    ],
    cta: "Explore a fractional engagement",
  },
};

const resources = [
  { tag: "Framework", title: "The North American Entry Playbook", desc: "How European B2B SaaS companies can sequence their first 18 months in the US and Canadian markets." },
  { tag: "Guide", title: "Loyalty Programme Architecture", desc: "Key decisions in loyalty platform design: earn/burn mechanics, tier structure, and tech stack selection." },
  { tag: "Essay", title: "Why Most Retail Media Networks Fail", desc: "The organisational and commercial mistakes that prevent retailers from monetising first-party data." },
  { tag: "Framework", title: "Equity vs Retainer: Structuring Advisory", desc: "When to take cash, when to take equity, and how to structure hybrid compensation in advisory work." },
];

const blogPosts = [
  { tag: "Market Entry", title: "How European B2B SaaS Companies Should Sequence Their First 18 Months in North America", date: "Feb 2026", read: "6 min read" },
  { tag: "Retail", title: "Why Most Retail Media Networks Fail Before They Start", date: "Jan 2026", read: "5 min read" },
  { tag: "AI", title: "Building With Equity: Why the AI Studio Model Works for Early-Stage Founders", date: "Dec 2025", read: "4 min read" },
  { tag: "Growth", title: "The Gap Between Strategy and Growth Is a Person — Here's What That Person Does", date: "Nov 2025", read: "7 min read" },
];

const openRoles = [
  { title: "Agentic Coder", type: "Contract · Remote", desc: "We're looking for a builder who thinks in systems and ships with AI. You'll work directly with Anthony to design, build, and deploy agentic workflows and AI-native products — across our studio projects and internal tooling. This isn't a support role. You'll own the technical direction of what we build and how we build it." },
];

// ── AI Studio Page ──
function AIStudioPage({ onBack }: { onBack: () => void }) {
  const [submitted, setSubmitted] = useState(false);
  const [teamMembers, setTeamMembers] = useState([{ name: "", linkedin: "" }]);

  const addMember = () => setTeamMembers([...teamMembers, { name: "", linkedin: "" }]);
  const removeMember = (i: number) => setTeamMembers(teamMembers.filter((_, idx) => idx !== i));
  const updateMember = (i: number, field: "name" | "linkedin", val: string) =>
    setTeamMembers(teamMembers.map((m, idx) => (idx === i ? { ...m, [field]: val } : m)));

  const deliverables = [
    { step: "01", title: "Discovery Sprint", duration: "Week 1", body: "We get under the hood of your idea. Market validation, competitive landscape, technical feasibility, and a clear articulation of the problem you're solving." },
    { step: "02", title: "Product Specification", duration: "Week 2", body: "A full product spec: user flows, feature prioritisation, tech stack selection, and a build roadmap. You own this doc regardless of what happens next." },
    { step: "03", title: "Build & Iterate", duration: "Weeks 3–4", body: "We build. Production-grade code, real infrastructure, proper testing. We ship in sprints and you're in the loop throughout. No black box." },
    { step: "04", title: "First Version Live", duration: "End of Week 4", body: "A working, deployed product in market by the end of week four. Not a prototype — a real product you can put in front of real users." },
  ];

  const forYouItems = [
    "You have a clear problem you're trying to solve",
    "You're pre-seed or seed stage — or self-funded",
    "You don't yet have a full technical co-founder",
    "You want a product built, not a prototype",
    "You're comfortable with an equity-based arrangement",
  ];

  const notForYouItems = [
    "You need a fixed-price quote for a defined spec",
    "You already have a strong technical team",
    "You're looking for a build agency with no skin in the game",
  ];

  const caseStudies = [
    {
      name: "Podbeat.ai",
      tag: "Live Product",
      desc: "An AI-powered podcast tool that generates moment catalogs, enables clip creation, and automates distribution across TikTok, Spotify, and YouTube. Built end-to-end by the Summit studio.",
      outcomes: ["Production deployed", "Multi-platform distribution", "AI transcription & search"],
    },
    {
      name: "Your Project",
      tag: "Next Up",
      desc: "We're selectively taking on new studio engagements. If you have an idea worth building, we want to hear it.",
      outcomes: ["Submit your idea below"],
      placeholder: true,
    },
  ];

  return (
    <div className="inner">
      <div className="inner-hero">
        <button type="button" className="inner-back" onClick={onBack}><ArrowLeft /> All Practices</button>
        <div className="inner-eyebrow">Practice 01</div>
        <h1 className="inner-title">AI Product Studio</h1>
        <p className="inner-lead">We build technology products for early-stage founders in exchange for equity. No large retainer. No handoffs. First version live in 4 weeks.</p>
      </div>

      <div className="inner-body">
        <div className="section-label">What You Get</div>
        <p className="section-intro">Four stages. Four weeks. A working product in market — not a prototype.</p>
        <div className="process-steps">
          {deliverables.map((d, i) => (
            <div className="process-step" key={i}>
              <div className="process-step-left">
                <div className="process-num">{d.step}</div>
                <div className="process-line" />
              </div>
              <div className="process-step-right">
                <div className="process-header">
                  <div className="process-title">{d.title}</div>
                  <div className="process-duration">{d.duration}</div>
                </div>
                <p className="process-body">{d.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="equity-band">
        <div className="inner-body" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <div className="equity-grid">
            <div>
              <div className="section-label" style={{ color: "var(--sage)" }}>The Equity Model</div>
              <h2 className="equity-title">Skin in the game — on both sides.</h2>
              <p className="equity-body">We don&apos;t charge a large upfront fee. Instead, we take an equity stake in the product we build together — typically between 15–30% depending on scope and stage. This means our incentives are completely aligned with yours. We only win when you win.</p>
              <p className="equity-body">In exchange, you get senior-level product thinking and engineering without burning your runway. The equity is agreed upfront, documented cleanly, and there are no surprises.</p>
            </div>
            <div className="equity-cards">
              <div className="equity-card">
                <div className="equity-card-num">15–30%</div>
                <div className="equity-card-label">Typical equity range</div>
              </div>
              <div className="equity-card">
                <div className="equity-card-num">4 wks</div>
                <div className="equity-card-label">First version live</div>
              </div>
              <div className="equity-card">
                <div className="equity-card-num">$0</div>
                <div className="equity-card-label">Upfront retainer</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="inner-body">
        <div className="section-label">Who It&apos;s For</div>
        <p className="section-intro">The studio model works best in specific situations. Be honest with yourself before applying.</p>
        <div className="for-grid">
          <div className="for-card for-yes">
            <div className="for-card-title">Good fit if...</div>
            {forYouItems.map((item, i) => (
              <div className="for-item" key={i}>
                <span className="for-check">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="for-card for-no">
            <div className="for-card-title">Not a fit if...</div>
            {notForYouItems.map((item, i) => (
              <div className="for-item" key={i}>
                <span className="for-cross">✕</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="inner-body">
        <div className="section-label">Work We&apos;ve Done</div>
        <p className="section-intro">The studio is young. Here&apos;s what we&apos;ve shipped so far.</p>
        <div className="case-grid">
          {caseStudies.map((c, i) => (
            <div className={`case-card ${(c as { placeholder?: boolean }).placeholder ? "case-placeholder" : ""}`} key={i}>
              <div className="case-header">
                <div className="case-name">{c.name}</div>
                <span className="resource-tag">{c.tag}</span>
              </div>
              <p className="case-desc">{c.desc}</p>
              <div className="case-outcomes">
                {c.outcomes.map((o, j) => (
                  <div className="case-outcome" key={j}>{o}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="inner-body">
        <div className="section-label">Submit Your Idea</div>
        <p className="section-intro">Tell us what you&apos;re building. We review every submission and respond within 3 business days.</p>
        {submitted ? (
          <div className="success-box">
            <h3>Idea Received</h3>
            <p>Thanks for sharing. We&apos;ll review it and come back to you within 3 business days.</p>
          </div>
        ) : (
          <div className="idea-form">
            <div className="form-section-title">About You</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Your Name</label>
                <input className="form-input" placeholder="Jane Smith" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" placeholder="jane@startup.com" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Website</label>
              <input className="form-input" placeholder="https://yourproduct.com" />
            </div>

            <div className="form-section-title">Founding Team</div>
            <p className="form-section-note">Add all co-founders — we review the full team before responding.</p>
            {teamMembers.map((member, i) => (
              <div className="team-member-row" key={i}>
                <div className="team-member-fields">
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input className="form-input" placeholder="Co-founder name" value={member.name} onChange={(e) => updateMember(i, "name", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">LinkedIn</label>
                    <input className="form-input" placeholder="linkedin.com/in/..." value={member.linkedin} onChange={(e) => updateMember(i, "linkedin", e.target.value)} />
                  </div>
                </div>
                {teamMembers.length > 1 && (
                  <button type="button" className="remove-member-btn" onClick={() => removeMember(i)}>✕</button>
                )}
              </div>
            ))}
            <button type="button" className="add-member-btn" onClick={addMember}>+ Add another team member</button>

            <div className="form-section-title">The Idea</div>
            <div className="form-group">
              <label className="form-label">What&apos;s the product?</label>
              <input className="form-input" placeholder="One sentence — what are you building?" />
            </div>
            <div className="form-group">
              <label className="form-label">What problem does it solve?</label>
              <textarea className="form-textarea" placeholder="Who has this problem, how painful is it, and why hasn't it been solved yet?" style={{ minHeight: 96 }} />
            </div>
            <div className="form-group">
              <label className="form-label">What&apos;s your current stage?</label>
              <select className="form-select">
                <option value="">Select one...</option>
                <option>Idea only — nothing built</option>
                <option>Early prototype / MVP</option>
                <option>Live product, pre-revenue</option>
                <option>Live product, early revenue</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Anything else we should know?</label>
              <textarea className="form-textarea" placeholder="Links, context, timeline — anything relevant." style={{ minHeight: 80 }} />
            </div>
            <button type="button" className="submit-btn" onClick={() => setSubmitted(true)}>Submit Your Idea →</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Retail Advisory Page ──
function RetailAdvisoryPage({ onBack, onBook }: { onBack: () => void; onBook: () => void }) {
  const focusAreas = [
    { tag: "Review & Recommendation", title: "Audit. Diagnose. Recommend.", body: "We assess your loyalty program, retail media capability, or technology stack — finding the gaps, quantifying the opportunity, and delivering a clear set of prioritised recommendations. Not a report that sits on a shelf. A blueprint you can act on." },
    { tag: "Supercharge with AI", title: "AI-Native Retail Thinking.", body: "We identify the AI quick wins that lift team and program performance today, and help you blueprint the bigger bets — personalisation engines, predictive analytics, supplier optimisation — that drive compounding growth over time." },
    { tag: "Growth Ventures", title: "Build New Revenue Streams.", body: "We design and build net-new revenue capabilities alongside your team — supplier loyalty programs, retail media networks, marketplace models, and subscription plays. We don't just advise on these. We've built them." },
  ];

  const packages = [
    { name: "Programme Review & Roadmap", tag: "Loyalty", focus: "Review & Recommendation", duration: "4–6 weeks", price: "Monthly retainer", desc: "A deep diagnostic of your loyalty programme — how well it drives customer behaviour, where capability gaps are limiting performance, and what revenue you're leaving on the table. Covers incremental lift, advertising and monetisation opportunities, and delivers a prioritised roadmap for what to fix and build next.", deliverables: ["Customer behaviour & programme effectiveness audit", "Revenue lift and advertising opportunity sizing", "Prioritised capability & growth roadmap"] },
    { name: "AI Quick Wins for Your Loyalty Team", tag: "Loyalty", focus: "Supercharge with AI", duration: "2 weeks", price: "Monthly retainer", desc: "A hands-on sprint embedded with your loyalty team to identify and implement immediate AI-driven productivity gains. Specific to loyalty workflows — campaign briefing, segmentation, offer testing, member comms, reporting.", deliverables: ["AI opportunity scan across loyalty workflows", "Implemented quick wins within week one", "Prioritised next-step roadmap"] },
    { name: "Paid Loyalty Membership Design", tag: "Loyalty", focus: "Growth Ventures", duration: "6–8 weeks", price: "Monthly retainer", desc: "Designs a recurring revenue model through paid membership tiers — defining the value exchange, pricing architecture, launch strategy, and retention mechanics.", deliverables: ["Value exchange and pricing architecture", "Launch and go-to-market strategy", "Retention mechanics design"] },
    { name: "Network Review & Roadmap", tag: "Retail Media", focus: "Review & Recommendation", duration: "4–6 weeks", price: "Monthly retainer", desc: "For retailers with an existing media network — evaluates ad tech stack, inventory quality, org structure, and measurement rigour. Delivers a gap analysis and 12-month roadmap.", deliverables: ["Ad tech and inventory quality audit", "Org structure and measurement review", "12-month gap-close roadmap"] },
    { name: "AI Investment Blueprint", tag: "Retail Media · AI", focus: "Supercharge with AI", duration: "6–8 weeks", price: "Monthly retainer", desc: "Develops fully scoped investment proposals for high-impact AI initiatives — predictive inventory yield, automated audience creation, AI-driven campaign planning, dynamic creative, and supplier self-serve intelligence.", deliverables: ["AI initiative longlist and prioritisation", "Business case per initiative", "Build vs. buy recommendation + roadmap"] },
    { name: "Network Launch Strategy", tag: "Retail Media", focus: "Growth Ventures", duration: "8–10 weeks", price: "Monthly retainer", desc: "For retailers without a media network or at early stage — full business case, operating model, tech selection, and go-to-market strategy to launch a revenue-generating retail media network.", deliverables: ["Full business case and revenue model", "Operating model and tech selection", "Go-to-market strategy"] },
  ];

  const caseStudies = [
    { client: "Global Grocery Retailer", region: "North America", tag: "Loyalty", challenge: "Loyalty program generating high engagement but low incremental sales. Leadership questioned the ROI of the entire program.", outcome: "Loyalty Economics Diagnostic revealed $40M+ in attributable incremental revenue previously uncounted. Program retained and scaled.", metrics: ["$40M+ incremental revenue identified", "Program strategy overhauled", "Board-level ROI case built"] },
    { client: "Specialty Retailer", region: "North America", tag: "Retail Media", challenge: "Supplier relationships strong but no formalised media network. Revenue from suppliers was ad hoc and underpriced.", outcome: "Supplier-Funded Media Venture engagement surfaced $8M in near-term revenue opportunity and a clear network launch roadmap.", metrics: ["$8M revenue opportunity mapped", "12 priority supplier partnerships identified", "Network launched within 6 months"] },
  ];

  return (
    <div className="inner">
      <div className="inner-hero">
        <button type="button" className="inner-back" onClick={onBack}><ArrowLeft /> All Practices</button>
        <div className="inner-eyebrow">Practice 02</div>
        <h1 className="inner-title">Loyalty & Retail Media</h1>
        <p className="inner-lead">Loyalty programs and retail media for large retailers — retained advisory against outcomes. We&apos;ve built these capabilities before. We&apos;ll build them with you.</p>
      </div>

      <div className="inner-body">
        <div className="section-label">Our Focus</div>
        <p className="section-intro">Three areas where we go deep. Every engagement maps to one of these — often more than one.</p>
        <div className="focus-grid">
          {focusAreas.map((f, i) => (
            <div className="focus-card" key={i}>
              <span className="resource-tag" style={{ marginBottom: 14, display: "inline-block" }}>{f.tag}</span>
              <div className="focus-title">{f.title}</div>
              <p className="focus-body">{f.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="equity-band">
        <div className="inner-body" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <div className="section-label" style={{ color: "var(--sage)" }}>What You Can Buy</div>
          <p className="section-intro" style={{ color: "rgba(255,255,255,0.5)" }}>Each engagement is scoped to a clear objective and priced as a monthly retainer. Most clients start with one and expand from there.</p>
          <div className="packages-grid">
            {packages.map((pkg, i) => {
              const isLoyaltyAI = pkg.tag.includes("Loyalty") && pkg.tag.includes("AI");
              const isMediaAI = pkg.tag.includes("Media") && pkg.tag.includes("AI");
              const isLoyalty = pkg.tag.includes("Loyalty") && !pkg.tag.includes("AI");
              const topClass = isLoyaltyAI ? "loyalty-ai" : isMediaAI ? "media-ai" : isLoyalty ? "loyalty" : "media";
              const catClass = isLoyalty || isLoyaltyAI ? "loyalty-cat" : "media-cat";
              return (
                <div className="pkg-card" key={i}>
                  <div className={`pkg-card-top ${topClass}`} />
                  <div className="pkg-card-inner">
                    <div className="pkg-num">{String(i + 1).padStart(2, "0")}</div>
                    <div className="pkg-header">
                      <div className={`pkg-cat ${catClass}`}>{pkg.tag}</div>
                      <div className="pkg-focus-title">{pkg.focus}</div>
                      <div className="pkg-name">{pkg.name}</div>
                      <div className="pkg-meta">
                        <span className="pkg-tag">{pkg.duration}</span>
                      </div>
                    </div>
                    <p className="pkg-desc">{pkg.desc}</p>
                    <div className="pkg-deliverables">
                      {pkg.deliverables.map((d, j) => (
                        <div className="pkg-deliverable" key={j}>{d}</div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="inner-body">
        <div className="section-label">Case Studies</div>
        <p className="section-intro">A sample of what we&apos;ve delivered. Details anonymised at client request.</p>
        <div className="retail-cases">
          {caseStudies.map((c, i) => (
            <div className="retail-case" key={i}>
              <div className="retail-case-header">
                <div>
                  <div className="retail-case-client">{c.client}</div>
                  <div className="retail-case-region">{c.region}</div>
                </div>
                <span className="resource-tag">{c.tag}</span>
              </div>
              <div className="retail-case-body">
                <div className="retail-case-col">
                  <div className="retail-case-col-label">The Challenge</div>
                  <p className="retail-case-text">{c.challenge}</p>
                </div>
                <div className="retail-case-col">
                  <div className="retail-case-col-label">The Outcome</div>
                  <p className="retail-case-text">{c.outcome}</p>
                </div>
              </div>
              <div className="case-outcomes" style={{ marginTop: 20 }}>
                {c.metrics.map((m, j) => (
                  <div className="case-outcome" key={j}>{m}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="calendly-band">
        <div className="inner-body" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <div className="calendly-content">
            <div>
              <div className="section-label" style={{ color: "var(--sage)" }}>Book a Meeting</div>
              <h2 className="calendly-title">Let&apos;s talk about your retail challenge.</h2>
              <p className="calendly-body">A 30-minute call is enough to know if there&apos;s a fit. No deck, no pitch — just a direct conversation about what you&apos;re trying to solve.</p>
            </div>
            <button
              type="button"
              className="calendly-btn"
              onClick={onBook}
            >
              Book a 30-Minute Call →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Practice (SME) Page ──
function PracticePage({ id, onBack, onContact }: { id: string; onBack: () => void; onContact: () => void }) {
  const p = practiceData[id];
  if (!p) return null;
  return (
    <div className="inner">
      <div className="inner-hero">
        <button type="button" className="inner-back" onClick={onBack}><ArrowLeft /> All Practices</button>
        <div className="inner-eyebrow">{p.eyebrow}</div>
        <h1 className="inner-title">{p.title}</h1>
        <p className="inner-lead">{p.lead}</p>
      </div>
      <div className="inner-body">
        <div className="features">
          {p.features.map((f, i) => (
            <div className="feature" key={i}>
              <div className="feature-title">{f.title}</div>
              <p className="feature-body">{f.body}</p>
            </div>
          ))}
        </div>
        <div className="cta-bar">
          <div className="cta-bar-left">
            <h3>{p.cta}</h3>
            <p>Book a 30-minute call — no obligation.</p>
          </div>
          <button
            type="button"
            className="cta-bar-btn"
            onClick={onContact}
          >
            Book a 30-Minute Call →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Resources Page ──
function ResourcesPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="inner">
      <div className="inner-hero">
        <button type="button" className="inner-back" onClick={onBack}><ArrowLeft /> Home</button>
        <div className="inner-eyebrow">Resources</div>
        <h1 className="inner-title">Thinking & Frameworks</h1>
        <p className="inner-lead">Practical tools and perspectives from 15+ years across retail technology, market expansion, and product development.</p>
      </div>
      <div className="inner-body">
        <div className="resources">
          {resources.map((r, i) => (
            <div className="resource" key={i}>
              <span className="resource-tag">{r.tag}</span>
              <div className="resource-title">{r.title}</div>
              <p className="resource-desc">{r.desc}</p>
              <div style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--teal)", border: "1px solid var(--teal)", borderRadius: 2, padding: "4px 10px" }}>Coming Soon</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Contact Page ──
function ContactPage({ onBack }: { onBack: () => void }) {
  const [sent, setSent] = useState(false);
  return (
    <div className="inner">
      <div className="inner-hero">
        <button type="button" className="inner-back" onClick={onBack}><ArrowLeft /> Home</button>
        <div className="inner-eyebrow">Get in Touch</div>
        <h1 className="inner-title">Let&apos;s Talk</h1>
        <p className="inner-lead">Whether you&apos;re entering a new market, modernising retail infrastructure, or need a product built — book 30 minutes.</p>
      </div>
      <div className="inner-body" style={{ maxWidth: 900 }}>
        {sent ? (
          <div className="success-box">
            <h3>Message Received</h3>
            <p>Thanks for reaching out. We&apos;ll be in touch within one business day.</p>
          </div>
        ) : (
          <div className="contact-grid">
            <div className="contact-info">
              <div className="contact-info-label">Summit Strategy Advisory</div>
              <div className="contact-info-title">Ready to get started?</div>
              <p>We work with a focused number of clients at any time — book a call to see if there&apos;s a fit.</p>
              <div className="contact-detail">
                <span className="contact-detail-label">Email</span>
                <span>info@summitadvisory.com</span>
              </div>
              <div className="contact-detail">
                <span className="contact-detail-label">Location</span>
                <span>Vancouver, BC, Canada</span>
              </div>
              <div className="contact-detail">
                <span className="contact-detail-label">Response</span>
                <span>Within 1 business day</span>
              </div>
            </div>
            <div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input className="form-input" placeholder="Jane" />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input className="form-input" placeholder="Smith" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" placeholder="jane@company.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Company</label>
                <input className="form-input" placeholder="Acme Corp" />
              </div>
              <div className="form-group">
                <label className="form-label">I&apos;m interested in</label>
                <select className="form-select">
                  <option value="">Select a practice...</option>
                  <option>AI Product Studio</option>
                  <option>Loyalty & Retail Media</option>
                  <option>Scale-Up Advisory</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">What are you working on?</label>
                <textarea className="form-textarea" placeholder="Brief context on your challenge or opportunity..." />
              </div>
              <button type="button" className="submit-btn" onClick={() => setSent(true)}>Send Message</button>
            </div>
          </div>
        )}
      </div>
      <div className="inner-body" id="book-call">
        <div className="section-label">Book a Call</div>
        <p className="section-intro">Pick a 30-minute slot that works for you.</p>
        <div
          style={{
            border: "1px solid var(--border)",
            overflow: "hidden",
            background: "var(--off)",
          }}
        >
          <iframe
            src={BOOK_CALL_URL}
            title="Book a call with Anthony"
            style={{ width: "100%", height: "800px", border: "0" }}
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}

// ── Home Page ──
function HomePage({ onNavigate }: { onNavigate: (p: string) => void }) {
  const cards = [
    { id: "ai", icon: ICON_AI, title: "AI Product Studio", desc: "We build technology products for early-stage founders in exchange for equity. End-to-end, production-grade, and AI-native." },
    { id: "retail", icon: ICON_RETAIL, title: "Loyalty & Retail Media", desc: "Loyalty programs and retail media for large retailers — retained advisory against outcomes." },
    { id: "sme", icon: ICON_SME, title: "Scale-Up Advisory", desc: "Fractional CXO leadership for growing companies. GTM strategy, market entry, and hands-on deal support." },
  ];
  return (
    <div className="home">
      <div className="home-hero">
        <div className="home-hero-inner">
          <h1 className="hero-headline">Vision.<br /><span className="accent">Action.</span><br />Growth.</h1>
          <p className="hero-body">We work alongside founders and leadership teams to create strategy and deliver sustained growth. Three practice areas — dive in.</p>
        </div>
      </div>
      <div className="cards-section">
        <div className="cards-label">Our Practices</div>
        <div className="cards">
          {cards.map((c) => (
            <button type="button" className="card" key={c.id} onClick={() => onNavigate(c.id)}>
              <div className="card-icon-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.icon} alt={c.title} className="card-icon" width={72} height={72} />
              </div>
              <div className="card-body">
                <div className="card-title">{c.title}</div>
                <p className="card-desc">{c.desc}</p>
                <div className="card-link">Learn more <ArrowRight /></div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Blog Page ──
function BlogPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="inner">
      <div className="inner-hero">
        <button type="button" className="inner-back" onClick={onBack}><ArrowLeft /> Home</button>
        <div className="inner-eyebrow">Blog</div>
        <h1 className="inner-title">Thinking Out Loud</h1>
        <p className="inner-lead">Perspectives on growth, market entry, retail technology, and what it actually takes to build something that lasts.</p>
      </div>
      <div className="inner-body">
        <div className="resources">
          {blogPosts.map((p, i) => (
            <div className="resource" key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span className="resource-tag">{p.tag}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--ghost)", letterSpacing: "0.08em" }}>{p.date} · {p.read}</span>
              </div>
              <div className="resource-title">{p.title}</div>
              <div style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--teal)", border: "1px solid var(--teal)", borderRadius: 2, padding: "4px 10px" }}>Coming Soon</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Careers Page ──
function CareersPage({ onBack, onContact }: { onBack: () => void; onContact: () => void }) {
  const values = [
    { title: "We move fast and stay sharp.", body: "Strategy without execution is just conversation. We close the gap between insight and outcome — quickly, and without losing rigour." },
    { title: "We work on hard problems.", body: "The easy work goes elsewhere. We're drawn to the problems that matter most to a business — the ones with real stakes and no obvious answer." },
    { title: "Small team, full ownership.", body: "Everyone here owns something real. No layers, no hand-offs. You'll see the direct impact of your work on clients and on the business." },
    { title: "AI is how we work, not what we talk about.", body: "We don't discuss AI as a future trend. We use it every day — in how we research, build, advise, and deliver. We expect the same from everyone we bring in." },
  ];

  return (
    <div className="inner">
      <div className="inner-hero">
        <button type="button" className="inner-back" onClick={onBack}><ArrowLeft /> Home</button>
        <div className="inner-eyebrow">Careers</div>
        <h1 className="inner-title">Work With Summit</h1>
        <p className="inner-lead">We&apos;re a small, focused team. When we bring someone in, it&apos;s because we think they&apos;re exceptional. Here&apos;s what we&apos;re looking for right now.</p>
      </div>

      <div className="equity-band">
        <div className="inner-body" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <div className="section-label" style={{ color: "var(--sage)" }}>Our Mission</div>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 800, color: "#fff", lineHeight: 1.15, maxWidth: 640, marginBottom: 20 }}>
            We exist to close the gap between big strategy and real growth.
          </h2>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, lineHeight: 1.7, maxWidth: 600, marginBottom: 48 }}>
            Summit works alongside founders and leadership teams who are trying to do something difficult — enter a new market, build a new capability, or grow faster than their current model allows. We bring senior expertise, executional discipline, and the kind of direct involvement that most advisory firms won&apos;t offer.
          </p>
          <div className="equity-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {values.map((v, i) => (
              <div className="equity-card" key={i}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{v.title}</div>
                <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="inner-body">
        <div className="section-label">Open Role</div>
        <div className="features" style={{ marginBottom: 48 }}>
          {openRoles.map((r, i) => (
            <div className="feature" key={i}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--sage)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>{r.type}</div>
              <div className="feature-title">{r.title}</div>
              <p className="feature-body">{r.desc}</p>
            </div>
          ))}
        </div>
        <div className="cta-bar">
          <div className="cta-bar-left">
            <h3>Think you&apos;re the one?</h3>
            <p>Tell us what you&apos;ve built and how you work. We&apos;ll take it from there.</p>
          </div>
          <button
            type="button"
            className="cta-bar-btn"
            onClick={onContact}
          >
            Book a 30-Minute Call →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──
export default function Summit() {
  const [page, setPage] = useState("home");
  const nav = (p: string) => {
    setPage(p);
    window.scrollTo(0, 0);
  };

  const goToBooking = () => {
    setPage("contact");
    window.setTimeout(() => {
      const el = document.getElementById("book-call");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 0);
  };

  return (
    <>
      <nav className="nav">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_WHITE} alt="Summit Strategy Advisory" className="nav-logo" onClick={() => nav("home")} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && nav("home")} />
        <div className="nav-right">
          <button type="button" className="nav-link" onClick={() => nav("resources")}>Resources</button>
          <button type="button" className="nav-link" onClick={() => nav("blog")}>Blog</button>
          <button type="button" className="nav-link" onClick={() => nav("careers")}>Careers</button>
          <button
            type="button"
            className="nav-cta"
            onClick={goToBooking}
          >
            Give Us a Call
          </button>
        </div>
      </nav>
      <div className="page">
        {page === "home" && <HomePage onNavigate={nav} />}
        {page === "ai" && <AIStudioPage onBack={() => nav("home")} />}
        {page === "retail" && <RetailAdvisoryPage onBack={() => nav("home")} onBook={goToBooking} />}
        {page === "sme" && <PracticePage id="sme" onBack={() => nav("home")} onContact={goToBooking} />}
        {page === "resources" && <ResourcesPage onBack={() => nav("home")} />}
        {page === "blog" && <BlogPage onBack={() => nav("home")} />}
        {page === "careers" && <CareersPage onBack={() => nav("home")} onContact={goToBooking} />}
        {page === "contact" && <ContactPage onBack={() => nav("home")} />}
        <footer className="footer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_WHITE} alt="Summit" className="footer-logo" />
          <ul className="footer-links">
            <li><button type="button" onClick={() => nav("ai")}>AI Studio</button></li>
            <li><button type="button" onClick={() => nav("retail")}>Loyalty & Retail Media</button></li>
            <li><button type="button" onClick={() => nav("sme")}>Scale-Up Advisory</button></li>
            <li><button type="button" onClick={() => nav("resources")}>Resources</button></li>
            <li><button type="button" onClick={() => nav("blog")}>Blog</button></li>
            <li><button type="button" onClick={() => nav("careers")}>Careers</button></li>
          </ul>
          <span className="footer-copy">© 2026 Summit Strategy Advisory</span>
        </footer>
      </div>
    </>
  );
}
