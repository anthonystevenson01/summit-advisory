import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SiteNav from "@/app/components/SiteNav";
import { ArrowLeft } from "@/app/components/icons";
import {
  BOOK_URL,
  HOW_WE_CHARGE,
  HOW_WE_CHARGE_TITLE,
  LAST_REVIEWED_LABEL,
  LEAD_ENGINE,
  OUTSOURCED_FAQS,
  OUTSOURCED_HERO,
  OUTSOURCED_TOOLS_LINE,
  SCALE_UP_CTA,
  SCALE_UP_PATH,
  THESIS,
  TOOLS_HUB_PATH,
  WHAT_SUMMIT_IS,
  outsourcedFaqSchema,
  outsourcedServiceSchema,
} from "../scale-up-content";

const TITLE = "Outsourced Sales for B2B Scale-Ups | Summit Scale-Up Advisory";
const DESCRIPTION =
  "Summit builds, runs and leads your commercial function. Fractional sales people, an AI engine built on your intelligence, fixed-price packages. You own it all.";
const CANONICAL = "https://summitstrategyadvisory.com/scale-up-advisory/outsourced-sales";

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

const bandHeading = {
  fontFamily: "var(--font-barlow-condensed), sans-serif",
  fontSize: "clamp(26px, 4vw, 40px)",
  fontWeight: 800,
  color: "#fff",
  lineHeight: 1.15,
  maxWidth: 640,
  marginBottom: 24,
} as const;

/**
 * Paragraph style for the dark thesis band, matching the fractional page's
 * band paragraphs (16px, white at 60%) so the two bands read the same. Top
 * margin because the closing line follows the cards rather than preceding them.
 */
const bandPara = {
  color: "rgba(255,255,255,0.6)",
  fontSize: 16,
  lineHeight: 1.7,
  maxWidth: 620,
  marginTop: 24,
} as const;

/**
 * The outsourced sales option of Scale-Up Advisory as a pitch summary, in the
 * shape of the fractional page: hero, what Summit is, thesis, how we charge,
 * where to start with a pointer to the free tools, four FAQs, CTA. The deck
 * narrative that used to be here is on `main` at `0912fd5` and in the deck.
 * The page carries its own metadata, canonical and JSON-LD.
 */
export default function OutsourcedSalesPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(outsourcedServiceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(outsourcedFaqSchema) }} />
      <SiteNav />
      <div className="page">
        <div className="inner">
          {/* 1. Hero */}
          <div className="inner-hero">
            <Link href={SCALE_UP_PATH} className="inner-back no-underline">
              <ArrowLeft /> {OUTSOURCED_HERO.back}
            </Link>
            <div className="inner-eyebrow">{OUTSOURCED_HERO.eyebrow}</div>
            <h1 className="inner-title">{OUTSOURCED_HERO.title}</h1>
            <p className="inner-lead">{OUTSOURCED_HERO.lead}</p>
            <p style={{ fontFamily: "var(--font-dm-sans), sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 16 }}>
              Last reviewed: {LAST_REVIEWED_LABEL} · By{" "}
              <Link href="/" style={{ color: "rgba(255,255,255,0.55)", textDecoration: "underline" }}>
                Anthony Stevenson
              </Link>
              , Founder, Summit Strategy Advisory
            </p>
          </div>

          {/* 2. What Summit is */}
          <div className="inner-body">
            <h2 className="section-label">{WHAT_SUMMIT_IS.label}</h2>
            <p className="section-intro">{WHAT_SUMMIT_IS.body}</p>
          </div>

          {/* 3. Thesis */}
          <div className="equity-band">
            <div className="inner-body" style={{ paddingTop: 0, paddingBottom: 0 }}>
              <h2 className="section-label" style={{ color: "var(--sage)" }}>{THESIS.label}</h2>
              <p style={bandHeading}>{THESIS.heading}</p>
              <div className="equity-cards">
                {THESIS.points.map((t, i) => (
                  <div className="equity-card" key={t.title}>
                    <div className="equity-card-num">{String(i + 1).padStart(2, "0")}</div>
                    <div className="equity-card-label">
                      <span style={{ color: "#fff", fontWeight: 700, display: "block", marginBottom: 4 }}>{t.title}</span>
                      {t.body}
                    </div>
                  </div>
                ))}
              </div>
              <p style={bandPara}>{THESIS.closer}</p>
            </div>
          </div>

          {/* 4. How we charge */}
          <div className="inner-body">
            <h2 className="section-label">{HOW_WE_CHARGE_TITLE}</h2>
            <div className="for-card for-yes">
              {HOW_WE_CHARGE.map((item) => (
                <div className="for-item" key={item}>
                  <span className="for-check">✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Where to start */}
          <div className="inner-body">
            <h2 className="section-label">{LEAD_ENGINE.label}</h2>
            <p className="section-intro">{LEAD_ENGINE.strap}</p>
            <h3 className="feature-title" style={{ fontSize: 24 }}>{LEAD_ENGINE.name}</h3>
            <p className="section-intro">{LEAD_ENGINE.summary}</p>
            {/* One full-width card, as How we charge above; with no .for-grid the margin supplies the 16px gap before the cta-bar itself. */}
            <div className="for-card for-yes" style={{ marginBottom: 16 }}>
              <div className="for-card-title">{LEAD_ENGINE.factsTitle}</div>
              {LEAD_ENGINE.facts.map((item) => (
                <div className="for-item" key={item}>
                  <span className="for-check">✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="cta-bar">
              <div className="cta-bar-left">
                <h3>{LEAD_ENGINE.ctaTitle}</h3>
                <p>{LEAD_ENGINE.ctaBody}</p>
              </div>
              <a className="cta-bar-btn no-underline" href={BOOK_URL} target="_blank" rel="noopener noreferrer">
                {LEAD_ENGINE.ctaButton} →
              </a>
            </div>
            {/* The "not ready" alternative to the CTA it follows; smallPara's top margin sets the distance from the bar. */}
            <p style={smallPara}>
              {OUTSOURCED_TOOLS_LINE.lead}{" "}
              <Link href={TOOLS_HUB_PATH} style={inlineLink}>{OUTSOURCED_TOOLS_LINE.link}</Link>.
            </p>
          </div>

          {/* 6. FAQ */}
          <div className="inner-body">
            <h2 className="section-label">Frequently Asked Questions</h2>
            <div className="features">
              {OUTSOURCED_FAQS.map((faq) => (
                <div className="feature" key={faq.q}>
                  <div className="feature-title">{faq.q}</div>
                  <p className="feature-body">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 7. CTA */}
          <div className="calendly-band">
            <div className="inner-body" style={{ paddingTop: 0, paddingBottom: 0 }}>
              <div className="calendly-content">
                <div>
                  <h2 className="section-label" style={{ color: "var(--sage)" }}>{SCALE_UP_CTA.label}</h2>
                  <p className="calendly-title" style={{ fontFamily: "var(--font-barlow-condensed), sans-serif", fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: 16 }}>
                    {SCALE_UP_CTA.title}
                  </p>
                  <p className="calendly-body">{SCALE_UP_CTA.body}</p>
                </div>
                <a href={BOOK_URL} target="_blank" rel="noopener noreferrer" className="calendly-btn">
                  {SCALE_UP_CTA.button}
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* 8. Footer */}
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
