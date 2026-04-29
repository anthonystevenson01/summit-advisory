import type { Metadata } from "next";
import Image from "next/image";
import SiteNav from "@/app/components/SiteNav";

export const metadata: Metadata = {
  title: "AI Product Studio — Summit Strategy Advisory",
  description:
    "We build technology products for early-stage founders in exchange for equity. End-to-end, production-grade. First version live in 4 weeks.",
  alternates: { canonical: "https://summitstrategyadvisory.com/ai-studio" },
  openGraph: {
    title: "AI Product Studio — Summit Strategy Advisory",
    description:
      "We build technology products for early-stage founders in exchange for equity. End-to-end, production-grade. First version live in 4 weeks.",
    url: "https://summitstrategyadvisory.com/ai-studio",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Product Studio — Summit Strategy Advisory",
    description:
      "We build technology products for early-stage founders in exchange for equity. End-to-end, AI-native.",
    images: ["/opengraph-image"],
  },
};

const BOOK_URL =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ35rKsxptXY-OfUDUjC4G9jWqVTFtPcCPApotrNSNzoQoEvN-HAegmAab4E5jxQ7NAgSF89ollu?gv=true";

const pageSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "AI Product Studio",
  dateModified: "2026-04-29",
  provider: {
    "@type": "Organization",
    name: "Summit Strategy Advisory",
    url: "https://summitstrategyadvisory.com",
  },
  description:
    "Equity-based product development for early-stage founders. We build AI-native technology products end-to-end, with first version live in 4 weeks.",
  areaServed: "Worldwide",
  serviceType: "Product Development Advisory",
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is an equity-based product studio?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "An equity-based product studio builds technology products in exchange for ownership stakes rather than upfront fees. Summit's AI Product Studio takes a 15–30% equity stake and delivers a production-grade product within 4 weeks, fully aligning its incentives with the founder.",
      },
    },
    {
      "@type": "Question",
      name: "How much equity does Summit's AI Product Studio take?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Summit typically takes between 15–30% equity, depending on the scope, complexity, and stage of the product. The exact stake is agreed upfront, documented cleanly in a simple agreement, and there are no surprises or scope adjustments after work begins.",
      },
    },
    {
      "@type": "Question",
      name: "How long does it take to build an AI product with Summit?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Summit delivers a first working product within 4 weeks, structured as four stages: Discovery Sprint (Week 1), Product Specification (Week 2), Build & Iterate (Weeks 3–4), and First Version Live by end of Week 4. This is a deployed product — not a prototype.",
      },
    },
    {
      "@type": "Question",
      name: "What types of products does the AI Product Studio build?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Summit builds AI-native products — software where LLMs, agents, and embeddings are core components rather than add-ons. Examples include AI-powered SaaS tools, automation platforms, intelligent workflow products, and multi-modal applications. Podbeat.ai, an AI podcast tool with multi-platform distribution, is the studio's first live proof of concept.",
      },
    },
    {
      "@type": "Question",
      name: "Who is the AI Product Studio best suited for?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The studio model works best for pre-seed or seed-stage founders who have a clear problem to solve, don't yet have a full technical co-founder, and are comfortable with an equity-based arrangement. It is not suited for companies that need a fixed-price quote, already have a strong technical team, or want a build agency with no skin in the game.",
      },
    },
  ],
};

const deliverables = [
  { step: "01", title: "Discovery Sprint", duration: "Week 1", body: "We get under the hood of your idea. Market validation, competitive landscape, technical feasibility, and a clear articulation of the problem you're solving." },
  { step: "02", title: "Product Specification", duration: "Week 2", body: "A full product spec: user flows, feature prioritisation, tech stack selection, and a build roadmap. You own this doc regardless of what happens next." },
  { step: "03", title: "Build & Iterate", duration: "Weeks 3–4", body: "We build. Production-grade code, real infrastructure, proper testing. We ship in sprints and you're in the loop throughout." },
  { step: "04", title: "First Version Live", duration: "End of Week 4", body: "A working, deployed product in market — not a prototype. Real product you can put in front of real users." },
];

const features = [
  { title: "Equity-based model", body: "No large upfront retainers. We take a stake in what we build, so our incentives are fully aligned with your success from day one." },
  { title: "End-to-end delivery", body: "From product specification and design through to deployed, production-grade software. We don't hand off to junior teams." },
  { title: "Built with AI at the core", body: "LLMs, agents, and embeddings aren't features we add — they're how the product works. That's the difference between software that uses AI and software that couldn't exist without it." },
  { title: "We eat our own cooking", body: "Podbeat.ai — an AI podcast tool with multi-platform distribution — was built entirely within this model. Real product, live users, shipping weekly. That's the standard we hold client work to." },
];

const forYou = [
  "You have a clear problem you're trying to solve",
  "You're pre-seed or seed stage — or self-funded",
  "You don't yet have a full technical co-founder",
  "You want a product built, not a prototype",
  "You're comfortable with an equity-based arrangement",
];

const notForYou = [
  "You need a fixed-price quote for a defined spec",
  "You already have a strong technical team",
  "You're looking for a build agency with no skin in the game",
];

const faqs = faqSchema.mainEntity;

export default function AIStudioPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <SiteNav />
      <div className="page">
        <div className="inner">
          <div className="inner-hero">
            <div className="inner-eyebrow">For Founders</div>
            <h1 className="inner-title">AI Product Studio</h1>
            <p className="inner-lead">
              We build technology products for early-stage founders in exchange for equity. No large
              retainer. No handoffs. First version live in 4 weeks.
            </p>
            <p style={{ fontFamily: "var(--font-dm-sans), sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 16 }}>
              Last reviewed: April 2026 · By{" "}
              <a href="/" style={{ color: "rgba(255,255,255,0.55)", textDecoration: "underline" }}>
                Anthony Stevenson
              </a>
              , Founder, Summit Strategy Advisory
            </p>
          </div>

          <div className="inner-body">
            <h2 className="section-label">What You Get</h2>
            <p className="section-intro">Four stages. Four weeks. A working product in market — not a prototype.</p>
            <div className="process-steps">
              {deliverables.map((d) => (
                <div className="process-step" key={d.step}>
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
                  <h2 className="section-label" style={{ color: "var(--sage)" }}>The Equity Model</h2>
                  <p className="equity-title" style={{ fontFamily: "var(--font-barlow-condensed), sans-serif", fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: 20 }}>
                    Skin in the game — on both sides.
                  </p>
                  <p className="equity-body">
                    We don&apos;t charge a large upfront fee. We take an equity stake in the product we build
                    together — typically 15–30% depending on scope and stage. Our incentives are aligned with
                    yours. We only win when you win.
                  </p>
                  <p className="equity-body">
                    AI-native startups raised 2.3× more funding in their first round than non-AI peers in
                    2024 (Crunchbase). Building with AI tooling from day one isn&apos;t a differentiator —
                    it&apos;s the baseline. We make sure your product meets it.
                  </p>
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
            <h2 className="section-label">How We Work</h2>
            <div className="features">
              {features.map((f) => (
                <div className="feature" key={f.title}>
                  <div className="feature-title">{f.title}</div>
                  <p className="feature-body">{f.body}</p>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: "var(--font-dm-sans), sans-serif", fontSize: 14, color: "var(--ghost)", marginTop: 24, lineHeight: 1.7 }}>
              Before building, use our free{" "}
              <a href="/tools/icp" style={{ color: "var(--teal)", fontWeight: 600 }}>ICP Evaluator</a>{" "}
              to stress-test your target customer, and the{" "}
              <a href="/tools/problem" style={{ color: "var(--teal)", fontWeight: 600 }}>Market Problem Validator</a>{" "}
              to confirm the problem is real and worth solving.
            </p>
          </div>

          <div className="inner-body">
            <h2 className="section-label">Who It&apos;s For</h2>
            <p className="section-intro">The studio model works best in specific situations.</p>
            <div className="for-grid">
              <div className="for-card for-yes">
                <div className="for-card-title">Good fit if...</div>
                {forYou.map((item) => (
                  <div className="for-item" key={item}><span className="for-check">✓</span><span>{item}</span></div>
                ))}
              </div>
              <div className="for-card for-no">
                <div className="for-card-title">Not a fit if...</div>
                {notForYou.map((item) => (
                  <div className="for-item" key={item}><span className="for-cross">✕</span><span>{item}</span></div>
                ))}
              </div>
            </div>
          </div>

          <div className="inner-body">
            <h2 className="section-label">Work We&apos;ve Done</h2>
            <p className="section-intro">The studio is young. Here&apos;s what we&apos;ve shipped.</p>
            <div className="case-grid">
              <div className="case-card">
                <div className="case-header">
                  <div className="case-name">Podbeat.ai</div>
                  <span className="resource-tag">Live Product</span>
                </div>
                <p className="case-desc">
                  An AI-powered podcast tool that generates moment catalogs, enables clip creation, and
                  automates distribution across TikTok, Spotify, and YouTube. Built end-to-end by the Summit studio.
                </p>
                <div className="case-outcomes">
                  <div className="case-outcome">Production deployed</div>
                  <div className="case-outcome">Multi-platform distribution</div>
                  <div className="case-outcome">AI transcription & search</div>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ section */}
          <div className="inner-body">
            <h2 className="section-label">Frequently Asked Questions</h2>
            <div className="features">
              {faqs.map((faq) => (
                <div className="feature" key={faq.name}>
                  <div className="feature-title">{faq.name}</div>
                  <p className="feature-body">{faq.acceptedAnswer.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="calendly-band">
            <div className="inner-body" style={{ paddingTop: 0, paddingBottom: 0 }}>
              <div className="calendly-content">
                <div>
                  <h2 className="section-label" style={{ color: "var(--sage)" }}>Talk to Us</h2>
                  <p className="calendly-title" style={{ fontFamily: "var(--font-barlow-condensed), sans-serif", fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: 16 }}>
                    Have an idea worth building?
                  </p>
                  <p className="calendly-body">
                    A 30-minute call is enough to know if there&apos;s a fit. No deck, no pitch — just a
                    direct conversation about what you&apos;re trying to build.
                  </p>
                </div>
                <a href={BOOK_URL} target="_blank" rel="noopener noreferrer" className="calendly-btn">
                  Book a 30-Minute Call →
                </a>
              </div>
            </div>
          </div>
        </div>

        <footer className="footer">
          <Image src="/brand-icons/Combination Mark_White.png" alt="Summit Strategy Advisory" width={140} height={22} className="footer-logo" />
          <ul className="footer-links">
            <li><a href="/ai-studio">AI Studio</a></li>
            <li><a href="/loyalty-retail-media">Loyalty & Retail Media</a></li>
            <li><a href="/scale-up-advisory">Scale-Up Advisory</a></li>
            <li><a href="/tools">GTM Tools</a></li>
            <li><a href="/newsletter">Newsletter</a></li>
          </ul>
          <span className="footer-copy">© 2026 Summit Strategy Advisory</span>
        </footer>
      </div>
    </>
  );
}
