import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SiteNav from "@/app/components/SiteNav";
import { ArrowLeft } from "@/app/components/icons";
import {
  BOOK_URL,
  FRACTIONAL_CROSS_SELL,
  FRACTIONAL_CTA,
  FRACTIONAL_FAQS,
  FRACTIONAL_FEATURES,
  FRACTIONAL_HERO,
  FRACTIONAL_WHY,
  LAST_REVIEWED_LABEL,
  OUTSOURCED_ANCHOR_ID,
  SCALE_UP_PATH,
  TOOLS_HUB_PATH,
  fractionalFaqSchema,
  fractionalServiceSchema,
} from "../scale-up-content";

const TITLE = "Hire a Fractional CRO, CCO or CMO | Summit Scale-Up Advisory";
const DESCRIPTION =
  "Hire a fractional CRO, CCO or CMO from Summit's bench of senior commercial executives. GTM strategy, market entry and deal support, part-time.";
const CANONICAL = "https://summitstrategyadvisory.com/scale-up-advisory/fractional-executive";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: CANONICAL,
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

const smallPara = {
  fontFamily: "var(--font-dm-sans), sans-serif",
  fontSize: 14,
  color: "var(--ghost)",
  marginTop: 24,
  lineHeight: 1.7,
} as const;

const inlineLink = { color: "var(--teal)", fontWeight: 600 } as const;

export default function FractionalExecutivePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(fractionalServiceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(fractionalFaqSchema) }} />
      <SiteNav />
      <div className="page">
        <div className="inner">
          <div className="inner-hero">
            <Link href={SCALE_UP_PATH} className="inner-back no-underline">
              <ArrowLeft /> {FRACTIONAL_HERO.back}
            </Link>
            <div className="inner-eyebrow">{FRACTIONAL_HERO.eyebrow}</div>
            <h1 className="inner-title">{FRACTIONAL_HERO.title}</h1>
            <p className="inner-lead">{FRACTIONAL_HERO.lead}</p>
            <p style={{ fontFamily: "var(--font-dm-sans), sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 16 }}>
              Last reviewed: {LAST_REVIEWED_LABEL} · By{" "}
              <Link href="/" style={{ color: "rgba(255,255,255,0.55)", textDecoration: "underline" }}>
                Anthony Stevenson
              </Link>
              , Founder, Summit Strategy Advisory
            </p>
          </div>

          <div className="inner-body">
            <h2 className="section-label">What We Do</h2>
            <div className="features">
              {FRACTIONAL_FEATURES.map((f) => (
                <div className="feature" key={f.title}>
                  <div className="feature-title">{f.title}</div>
                  <p className="feature-body">{f.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="equity-band">
            <div className="inner-body" style={{ paddingTop: 0, paddingBottom: 0 }}>
              <h2 className="section-label" style={{ color: "var(--sage)" }}>{FRACTIONAL_WHY.label}</h2>
              <p style={{ fontFamily: "var(--font-barlow-condensed), sans-serif", fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, color: "#fff", lineHeight: 1.15, maxWidth: 640, marginBottom: 24 }}>
                {FRACTIONAL_WHY.heading}
              </p>
              {FRACTIONAL_WHY.paragraphs.map((para, i) => (
                <p
                  key={para}
                  style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, lineHeight: 1.7, maxWidth: 620, marginBottom: i === FRACTIONAL_WHY.paragraphs.length - 1 ? 40 : 12 }}
                >
                  {para}
                </p>
              ))}
              <div className="equity-cards">
                {FRACTIONAL_WHY.stats.map((s) => (
                  <div className="equity-card" key={s.label}>
                    <div className="equity-card-num">{s.num}</div>
                    <div className="equity-card-label">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="inner-body" style={{ paddingBottom: 0 }}>
            <p style={{ ...smallPara, marginTop: 0 }}>
              {FRACTIONAL_CROSS_SELL.lead}{" "}
              <Link href={`${SCALE_UP_PATH}#${OUTSOURCED_ANCHOR_ID}`} style={inlineLink}>
                {FRACTIONAL_CROSS_SELL.link}
              </Link>
            </p>
            <p style={{ ...smallPara, marginTop: 8 }}>
              {FRACTIONAL_CROSS_SELL.toolsLead}{" "}
              <Link href={TOOLS_HUB_PATH} style={inlineLink}>{FRACTIONAL_CROSS_SELL.toolsLink}</Link>.
            </p>
          </div>

          <div className="inner-body">
            <h2 className="section-label">Frequently Asked Questions</h2>
            <div className="features">
              {FRACTIONAL_FAQS.map((faq) => (
                <div className="feature" key={faq.q}>
                  <div className="feature-title">{faq.q}</div>
                  <p className="feature-body">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="calendly-band">
            <div className="inner-body" style={{ paddingTop: 0, paddingBottom: 0 }}>
              <div className="calendly-content">
                <div>
                  <h2 className="section-label" style={{ color: "var(--sage)" }}>{FRACTIONAL_CTA.label}</h2>
                  <p className="calendly-title" style={{ fontFamily: "var(--font-barlow-condensed), sans-serif", fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: 16 }}>
                    {FRACTIONAL_CTA.title}
                  </p>
                  <p className="calendly-body">{FRACTIONAL_CTA.body}</p>
                </div>
                <a href={BOOK_URL} target="_blank" rel="noopener noreferrer" className="calendly-btn">
                  {FRACTIONAL_CTA.button}
                </a>
              </div>
            </div>
          </div>
        </div>

        <footer className="footer">
          <Image src="/brand-icons/Combination Mark_White.png" alt="Summit Strategy Advisory" width={140} height={22} className="footer-logo" />
          <ul className="footer-links">
            <li><Link href="/ai-studio">AI Studio</Link></li>
            <li><Link href="/loyalty-retail-media">Loyalty & Retail Media</Link></li>
            <li><Link href="/scale-up-advisory">Scale-Up Advisory</Link></li>
            <li><Link href="/tools">GTM Tools</Link></li>
            <li><Link href="/newsletter">Newsletter</Link></li>
          </ul>
          <span className="footer-copy">© 2026 Summit Strategy Advisory</span>
        </footer>
      </div>
    </>
  );
}
