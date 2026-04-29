import type { Metadata } from "next";
import Image from "next/image";
import SiteNav from "@/app/components/SiteNav";

export const metadata: Metadata = {
  title: "Scale-Up Advisory — Fractional CXO & GTM Strategy | Summit",
  description:
    "Fractional CXO leadership for growing companies. GTM strategy, market entry, North America expansion, and hands-on deal support from senior advisors with a track record in B2B scale-ups.",
  alternates: { canonical: "https://summitstrategyadvisory.com/scale-up-advisory" },
  openGraph: {
    title: "Scale-Up Advisory — Fractional CXO & GTM Strategy | Summit",
    description: "Fractional CXO leadership for growing companies. GTM strategy, market entry, and hands-on deal support.",
    url: "https://summitstrategyadvisory.com/scale-up-advisory",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Scale-Up Advisory — Fractional CXO & GTM Strategy | Summit",
    description: "Fractional CXO leadership for growing companies. GTM strategy, market entry, and deal support.",
    images: ["/opengraph-image"],
  },
};

const BOOK_URL =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ35rKsxptXY-OfUDUjC4G9jWqVTFtPcCPApotrNSNzoQoEvN-HAegmAab4E5jxQ7NAgSF89ollu?gv=true";

const pageSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Scale-Up Advisory",
  dateModified: "2026-04-29",
  provider: {
    "@type": "Organization",
    name: "Summit Strategy Advisory",
    url: "https://summitstrategyadvisory.com",
  },
  description:
    "Fractional CXO leadership for growing businesses — executive-level GTM strategy, market entry, and hands-on deal support without the full-time overhead.",
  areaServed: ["Canada", "United States", "Europe"],
  serviceType: "Management Consulting",
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is a fractional CXO?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A fractional CXO is a senior executive — Chief Revenue Officer, Chief Marketing Officer, Chief Commercial Officer, or similar — who works part-time with a company rather than as a full-time hire. They own a specific function, set strategy, and drive execution at a fraction of the cost of a full-time appointment. Fractional CXO engagements typically cost 20–40% of a full-time executive salary for the same level of strategic input.",
      },
    },
    {
      "@type": "Question",
      name: "When should a company hire a fractional CXO?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Fractional CXO leadership is most effective for companies between $500K–$20M ARR who need senior GTM leadership but aren't ready to justify a full-time executive salary. It's also common for specific projects: market entry into a new geography, fundraising preparation, plugging a leadership gap during a transition, or adding execution horsepower to a specific growth initiative.",
      },
    },
    {
      "@type": "Question",
      name: "How does Summit help European B2B companies enter North America?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Summit's North America expansion service covers ICP definition for the US and Canadian market, channel selection and partner strategy, pricing localisation, hiring sequencing, and a first-revenue playbook. The engagement is structured as a monthly retainer and typically runs 6–12 months from first hire to first referenceable customer. European companies that enter North America without a localised ICP or GTM model fail at a rate of over 70% in the first 18 months.",
      },
    },
    {
      "@type": "Question",
      name: "What does a fractional GTM engagement with Summit involve?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Summit's Scale-Up Advisory engagements run as monthly retainers against a defined set of objectives. Typical scope includes GTM strategy, sales process design, channel selection, pipeline development, and direct involvement in critical deals. Anthony Stevenson works directly with clients — not delegated to junior consultants.",
      },
    },
    {
      "@type": "Question",
      name: "What is the difference between fractional advisory and a consulting firm?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A consulting firm delivers analysis and recommendations. A fractional advisor owns the function and drives execution. Summit embeds at the leadership level, attends board meetings, leads sales calls, and is accountable for outcomes — not just outputs. The engagement model is retainer-based and outcome-oriented, not project-billed.",
      },
    },
  ],
};

const features = [
  { title: "Own your GTM, part-time", body: "Senior-level ownership of your go-to-market function: sales process, channel strategy, and pipeline development — without the full-time salary." },
  { title: "North America entry — first revenue in 6–12 months", body: "A proven playbook for European technology companies entering North America — from ICP definition and channel selection through to first referenceable customer." },
  { title: "Market entry & positioning", body: "Competitive positioning, ICP definition, pricing architecture, and launch sequencing for new markets and new products." },
  { title: "In the room on critical deals", body: "Direct involvement in the deals that matter most — strategy, stakeholder mapping, and live negotiation support from a senior advisor, not a junior consultant." },
];

const faqs = faqSchema.mainEntity;

export default function ScaleUpAdvisoryPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <SiteNav />
      <div className="page">
        <div className="inner">
          <div className="inner-hero">
            <div className="inner-eyebrow">For Scale-Ups</div>
            <h1 className="inner-title">Scale-Up Advisory</h1>
            <p className="inner-lead">
              Fractional CXO leadership for growing businesses — executive-level strategy and hands-on
              execution without the full-time overhead. We embed at the leadership level and own the
              outcomes — not just the recommendations.
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
            <h2 className="section-label">What We Do</h2>
            <div className="features">
              {features.map((f) => (
                <div className="feature" key={f.title}>
                  <div className="feature-title">{f.title}</div>
                  <p className="feature-body">{f.body}</p>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: "var(--font-dm-sans), sans-serif", fontSize: 14, color: "var(--ghost)", marginTop: 24, lineHeight: 1.7 }}>
              Before engaging, use our free{" "}
              <a href="/tools/icp" style={{ color: "var(--teal)", fontWeight: 600 }}>ICP Evaluator</a>{" "}
              and{" "}
              <a href="/tools/positioning" style={{ color: "var(--teal)", fontWeight: 600 }}>Positioning Statement Grader</a>{" "}
              to surface where your GTM foundation needs work.
            </p>
          </div>

          <div className="equity-band">
            <div className="inner-body" style={{ paddingTop: 0, paddingBottom: 0 }}>
              <h2 className="section-label" style={{ color: "var(--sage)" }}>Why Fractional</h2>
              <p style={{ fontFamily: "var(--font-barlow-condensed), sans-serif", fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, color: "#fff", lineHeight: 1.15, maxWidth: 640, marginBottom: 24 }}>
                Executive-level thinking without the full-time hire.
              </p>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, lineHeight: 1.7, maxWidth: 620, marginBottom: 12 }}>
                Most growing companies don&apos;t need a full-time CRO or CMO — they need the thinking and
                execution that role provides, for a defined period, against a specific challenge. Fractional
                CXO engagements typically cost 20–40% of a full-time executive salary for the same level of
                strategic input.
              </p>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, lineHeight: 1.7, maxWidth: 620, marginBottom: 40 }}>
                European companies that enter North America without a localised GTM model and ICP fail in
                their first 18 months at a rate exceeding 70%. Summit&apos;s North America expansion
                playbook is built from direct experience taking B2B SaaS companies through this transition.
              </p>
              <div className="equity-cards">
                <div className="equity-card"><div className="equity-card-num">20–40%</div><div className="equity-card-label">Of full-time exec cost</div></div>
                <div className="equity-card"><div className="equity-card-num">3–12 mo</div><div className="equity-card-label">Typical engagement length</div></div>
                <div className="equity-card"><div className="equity-card-num">$500K–$20M</div><div className="equity-card-label">Typical client ARR range</div></div>
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
                  <h2 className="section-label" style={{ color: "var(--sage)" }}>Explore an Engagement</h2>
                  <p className="calendly-title" style={{ fontFamily: "var(--font-barlow-condensed), sans-serif", fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: 16 }}>
                    Tell us what you&apos;re trying to grow.
                  </p>
                  <p className="calendly-body">
                    A 30-minute call is enough to understand the challenge and whether there&apos;s a fit.
                    No obligation, no pitch deck.
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
