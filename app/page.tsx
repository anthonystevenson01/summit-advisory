"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { LOGO_WHITE, ICON_AI, ICON_RETAIL, ICON_SME } from "./summit-assets";
import SiteNav from "./components/SiteNav";
import { ArrowRight, ArrowLeft } from "./components/icons";

const BOOK_CALL_URL =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ35rKsxptXY-OfUDUjC4G9jWqVTFtPcCPApotrNSNzoQoEvN-HAegmAab4E5jxQ7NAgSF89ollu?gv=true";

// ── Data ──
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

// ── Retail Advisory Page ──
function RetailAdvisoryPage({ onBack, onBook }: { onBack: () => void; onBook: () => void }) {
  const focusAreas = [
    { tag: "Review & Recommendation", title: "Audit. Diagnose. Recommend.", body: "We assess your loyalty program, retail media capability, or technology stack — finding the gaps, quantifying the opportunity, and delivering a clear set of prioritised recommendations. Not a report that sits on a shelf. A blueprint you can act on." },
    { tag: "Supercharge with AI", title: "AI-Native Retail Thinking.", body: "We identify the AI quick wins that lift team and program performance today, and help you blueprint the bigger bets — personalisation engines, predictive analytics, supplier optimisation — that drive compounding growth over time." },
    { tag: "New Revenue Builds", title: "Build New Revenue Streams.", body: "We design and build net-new revenue capabilities alongside your team — supplier loyalty programs, retail media networks, marketplace models, and subscription plays. We don't just advise on these. We've built them." },
  ];

  const packages = [
    { name: "Programme Review & Roadmap", tag: "Loyalty", focus: "Review & Recommendation", duration: "4–6 weeks", price: "Monthly retainer", desc: "A deep diagnostic of your loyalty programme — how well it drives customer behaviour, where capability gaps are limiting performance, and what revenue you're leaving on the table. Covers incremental lift, advertising and monetisation opportunities, and delivers a prioritised roadmap for what to fix and build next.", deliverables: ["Customer behaviour & programme effectiveness audit", "Revenue lift and advertising opportunity sizing", "Prioritised capability & growth roadmap"] },
    { name: "AI Quick Wins for Your Loyalty Team", tag: "Loyalty", focus: "Supercharge with AI", duration: "2 weeks", price: "Monthly retainer", desc: "A hands-on sprint embedded with your loyalty team to identify and implement immediate AI-driven productivity gains. Specific to loyalty workflows — campaign briefing, segmentation, offer testing, member comms, reporting.", deliverables: ["AI opportunity scan across loyalty workflows", "Implemented quick wins within week one", "Prioritised next-step roadmap"] },
    { name: "Paid Loyalty Membership Design", tag: "Loyalty", focus: "New Revenue Builds", duration: "6–8 weeks", price: "Monthly retainer", desc: "Designs a recurring revenue model through paid membership tiers — defining the value exchange, pricing architecture, launch strategy, and retention mechanics.", deliverables: ["Value exchange and pricing architecture", "Launch and go-to-market strategy", "Retention mechanics design"] },
    { name: "Network Review & Roadmap", tag: "Retail Media", focus: "Review & Recommendation", duration: "4–6 weeks", price: "Monthly retainer", desc: "For retailers with an existing media network — evaluates ad tech stack, inventory quality, org structure, and measurement rigour. Delivers a gap analysis and 12-month roadmap.", deliverables: ["Ad tech and inventory quality audit", "Org structure and measurement review", "12-month gap-close roadmap"] },
    { name: "AI Investment Blueprint", tag: "Retail Media · AI", focus: "Supercharge with AI", duration: "6–8 weeks", price: "Monthly retainer", desc: "Develops fully scoped investment proposals for high-impact AI initiatives — predictive inventory yield, automated audience creation, AI-driven campaign planning, dynamic creative, and supplier self-serve intelligence.", deliverables: ["AI initiative longlist and prioritisation", "Business case per initiative", "Build vs. buy recommendation + roadmap"] },
    { name: "Network Launch Strategy", tag: "Retail Media", focus: "New Revenue Builds", duration: "8–10 weeks", price: "Monthly retainer", desc: "For retailers without a media network or at early stage — full business case, operating model, tech selection, and go-to-market strategy to launch a revenue-generating retail media network.", deliverables: ["Full business case and revenue model", "Operating model and tech selection", "Go-to-market strategy"] },
  ];

  const caseStudies = [
    { client: "Global Grocery Retailer", region: "North America", tag: "Loyalty", challenge: "Loyalty program generating high engagement but low incremental sales. Leadership questioned the ROI of the entire program.", outcome: "Loyalty Economics Diagnostic revealed $40M+ in attributable incremental revenue previously uncounted. Program retained and scaled.", metrics: ["$40M+ incremental revenue identified", "Program strategy overhauled", "Board-level ROI case built"] },
    { client: "Specialty Retailer", region: "North America", tag: "Retail Media", challenge: "Supplier relationships strong but no formalised media network. Revenue from suppliers was ad hoc and underpriced.", outcome: "Supplier-Funded Media Venture engagement surfaced $8M in near-term revenue opportunity and a clear network launch roadmap.", metrics: ["$8M revenue opportunity mapped", "12 priority supplier partnerships identified", "Network launched within 6 months"] },
  ];

  return (
    <div className="inner">
      <div className="inner-hero">
        <button type="button" className="inner-back" onClick={onBack}><ArrowLeft /> All Practices</button>
        <div className="inner-eyebrow">For Retailers</div>
        <h1 className="inner-title">Loyalty & Retail Media</h1>
        <p className="inner-lead">Loyalty programs and retail media for large retailers. We&apos;ve surfaced $40M in uncounted loyalty revenue and built retail media networks that generate real supplier income. Now we build them with you.</p>
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
              <div style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-dm-mono), monospace", fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--teal)", border: "1px solid var(--teal)", borderRadius: 2, padding: "4px 10px" }}>Coming Soon</div>
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
      <div className="inner-body" style={{ maxWidth: "calc(50.25rem + 2 * var(--page-gutter))" }}>
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
                <span>info@summitstrategyadvisory.com</span>
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
                  <option>Product Studio</option>
                  <option>Loyalty & Retail Media</option>
                  <option>Scale-Up: Hire a fractional executive</option>
                  <option>Scale-Up: Outsource your sales</option>
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
            style={{ width: "100%", height: "600px", border: "0" }}
            frameBorder={0}
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}

// ── Home Page ──
function HomePage({ onNavigate }: { onNavigate: (p: string) => void }) {
  // A card with an href is a plain link to that practice's own page; the
  // others open a view inside this client component.
  const cards: { id: string; icon: string; title: string; desc: string; href?: string }[] = [
    { id: "ai", icon: ICON_AI, title: "Product Studio", desc: "We build technology products for startups in exchange for equity, and for enterprise teams on a scoped build. Production-grade, end to end.", href: "/product-studio" },
    { id: "retail", icon: ICON_RETAIL, title: "Loyalty & Retail Media", desc: "Loyalty programs and retail media for large retailers. We've built these capabilities. Now we build them with you." },
    { id: "sme", icon: ICON_SME, title: "Scale-Up Advisory", desc: "Outsourced sales and fractional executives for B2B scale-ups. Fixed-price packages, AI-enabled, and you own everything we build.", href: "/scale-up-advisory" },
  ];
  return (
    <div className="home">
      <div className="home-hero">
        <div className="home-hero-inner">
          <h1 className="hero-headline">Vision.<br /><span className="accent">Action.</span><br />Growth.</h1>
          <p className="hero-body">Three advisory practices. One standard: we own the outcome, not just the advice. Pick the one that fits.</p>
        </div>
      </div>
      <div className="cards-section">
        <h2 className="cards-label">Our Practices</h2>
        <div className="cards">
          {cards.map((c) => {
            // Built once so the link and button branches render identical
            // markup; .card already styles <a> and <button> alike, so the
            // linked card lays out like its siblings.
            const body = (
              <>
                <div className="card-icon-wrap">
                  <Image src={c.icon} alt={c.title} className="card-icon" width={72} height={72} />
                </div>
                <div className="card-body">
                  <div className="card-title">{c.title}</div>
                  <p className="card-desc">{c.desc}</p>
                  <div className="card-link">Learn more <ArrowRight /></div>
                </div>
              </>
            );
            return c.href ? (
              <Link href={c.href} className="card no-underline" key={c.id}>
                {body}
              </Link>
            ) : (
              <button type="button" className="card" key={c.id} onClick={() => onNavigate(c.id)}>
                {body}
              </button>
            );
          })}
        </div>
      </div>

      {/* Crawlable entity block — minimal footprint for users, full context for AI/search */}
      <div style={{ borderTop: "1px solid var(--border)", padding: "24px 48px" }}>
        <p style={{ fontFamily: "var(--font-dm-sans), sans-serif", fontSize: 12, color: "rgba(255,255,255,0.25)", lineHeight: 1.7, maxWidth: 860, margin: "0 auto" }}>
          Summit Strategy Advisory — Vancouver, BC. Founded by Anthony Stevenson.{" "}
          <Link href="/product-studio" style={{ color: "rgba(255,255,255,0.35)" }}>Product Studio</Link>
          {" · "}
          <Link href="/loyalty-retail-media" style={{ color: "rgba(255,255,255,0.35)" }}>Loyalty &amp; Retail Media</Link>
          {" · "}
          <Link href="/scale-up-advisory" style={{ color: "rgba(255,255,255,0.35)" }}>Scale-Up Advisory</Link>
          {" · "}
          <Link href="/scale-up-advisory/fractional-executive" style={{ color: "rgba(255,255,255,0.35)" }}>Fractional Executives</Link>
          {" · "}
          <Link href="/scale-up-advisory/outsourced-sales" style={{ color: "rgba(255,255,255,0.35)" }}>Outsourced Sales</Link>
          {" · "}
          <Link href="/tools" style={{ color: "rgba(255,255,255,0.35)" }}>Free GTM Tools</Link>
        </p>
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
                <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 10, color: "var(--ghost)", letterSpacing: "0.08em" }}>{p.date} · {p.read}</span>
              </div>
              <div className="resource-title">{p.title}</div>
              <div style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-dm-mono), monospace", fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--teal)", border: "1px solid var(--teal)", borderRadius: 2, padding: "4px 10px" }}>Coming Soon</div>
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
          <h2 style={{ fontFamily: "var(--font-barlow-condensed), sans-serif", fontSize: 36, fontWeight: 800, color: "#fff", lineHeight: 1.15, maxWidth: 640, marginBottom: 20 }}>
            We exist to close the gap between big strategy and real growth.
          </h2>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, lineHeight: 1.7, maxWidth: 600, marginBottom: 48 }}>
            Summit works alongside founders and leadership teams who are trying to do something difficult — enter a new market, build a new capability, or grow faster than their current model allows. We bring senior expertise, executional discipline, and the kind of direct involvement that most advisory firms won&apos;t offer.
          </p>
          <div className="equity-grid" style={{ gap: 20 }}>
            {values.map((v, i) => (
              <div className="equity-card" key={i} style={{ flexDirection: "column", alignItems: "flex-start", gap: 0 }}>
                <div style={{ fontFamily: "var(--font-barlow-condensed), sans-serif", fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{v.title}</div>
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
              <div style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 10, color: "var(--sage)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>{r.type}</div>
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tool = params.get("tool");
    const section = params.get("page");
    const initial = tool || section;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs from window.location (external system) after hydration of a static page; a lazy initialiser would mismatch
    if (initial) setPage(initial);
    // Track page visit
    fetch("/api/track-visit", { method: "POST" }).catch(() => {});
  }, []);

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
      <SiteNav
        onLogoClick={() => nav("home")}
        onResources={() => nav("resources")}
        onBlog={() => nav("blog")}
        onCareers={() => nav("careers")}
        onBookCall={goToBooking}
      />
      <div className="page">
        {page === "home" && <HomePage onNavigate={nav} />}
        {page === "retail" && <RetailAdvisoryPage onBack={() => nav("home")} onBook={goToBooking} />}
        {page === "resources" && <ResourcesPage onBack={() => nav("home")} />}
{page === "blog" && <BlogPage onBack={() => nav("home")} />}
        {page === "careers" && <CareersPage onBack={() => nav("home")} onContact={goToBooking} />}
        {page === "contact" && <ContactPage onBack={() => nav("home")} />}
        <footer className="footer">
          <Image src={LOGO_WHITE} alt="Summit" width={140} height={22} className="footer-logo" />
          <ul className="footer-links">
            <li><Link href="/product-studio">Product Studio</Link></li>
            <li><Link href="/loyalty-retail-media">Loyalty & Retail Media</Link></li>
            <li><Link href="/scale-up-advisory">Scale-Up Advisory</Link></li>
            <li><button type="button" onClick={() => nav("resources")}>Resources</button></li>
            <li><Link href="/tools">GTM Tools</Link></li>
            <li><button type="button" onClick={() => nav("blog")}>Blog</button></li>
            <li><button type="button" onClick={() => nav("careers")}>Careers</button></li>
          </ul>
          <span className="footer-copy">© 2026 Summit Strategy Advisory</span>
        </footer>
      </div>
    </>
  );
}
