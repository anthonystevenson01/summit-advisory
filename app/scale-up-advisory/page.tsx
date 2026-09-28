import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SiteNav from "@/app/components/SiteNav";
import { ArrowRight } from "@/app/components/icons";
import {
  HERO,
  HUB_OPTIONS_LABEL,
  HUB_TOOLS,
  LAST_REVIEWED_LABEL,
  OPTIONS,
  TOOLS_HUB_PATH,
  TOOL_STAGE_MAP,
  scaleUpServiceSchema,
} from "./scale-up-content";

const TITLE = "Scale-Up Advisory: Fractional Executives & Outsourced Sales | Summit";
const DESCRIPTION =
  "Summit builds, runs and leads the commercial function for B2B scale-ups. Hire a fractional CRO, CCO or CMO, or outsource your sales. Plus free AI GTM tools.";
const CANONICAL = "https://summitstrategyadvisory.com/scale-up-advisory";

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

/**
 * Hub for the Scale-Up Advisory practice: the hero, the two option cards
 * (each its own page) and the free GTM tools. The narrative for each option
 * lives on its own page under /scale-up-advisory/. Deliberately no FAQ, CTA
 * band or in-page anchors: the option pages carry the FAQs and the CTA, and
 * the nav carries Book a Call.
 */
export default function ScaleUpAdvisoryPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(scaleUpServiceSchema) }} />
      <SiteNav />
      <div className="page">
        <div className="inner">
          {/* 1. Hero */}
          <div className="inner-hero">
            <div className="inner-eyebrow">{HERO.eyebrow}</div>
            <h1 className="inner-title">{HERO.title}</h1>
            <p className="inner-lead">{HERO.lead}</p>
            <p style={{ fontFamily: "var(--font-dm-sans), sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 16 }}>
              Last reviewed: {LAST_REVIEWED_LABEL} · By{" "}
              <Link href="/" style={{ color: "rgba(255,255,255,0.55)", textDecoration: "underline" }}>
                Anthony Stevenson
              </Link>
              , Founder, Summit Strategy Advisory
            </p>
          </div>

          {/* 2. The two options, each a page of its own */}
          <div className="inner-body">
            <h2 className="section-label">{HUB_OPTIONS_LABEL}</h2>
            <div className="for-grid">
              {OPTIONS.map((o) => (
                <Link key={o.id} href={o.href} className="card no-underline">
                  <div className="card-body">
                    <div className="card-title">{o.title}</div>
                    <p className="card-desc">{o.body}</p>
                    <div className="card-link">
                      {o.cta} <ArrowRight />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* 3. Free GTM tools */}
          <div className="inner-body">
            <h2 className="section-label">{HUB_TOOLS.label}</h2>
            <p className="section-intro" style={{ marginBottom: 16 }}><strong>{HUB_TOOLS.heading}</strong></p>
            <p className="section-intro">{HUB_TOOLS.body}</p>
            <div className="resources" style={{ marginTop: 32 }}>
              {TOOL_STAGE_MAP.map((t) => (
                <Link key={t.slug} href={t.href} className="resource resource-tool no-underline">
                  <span className="resource-tag">{HUB_TOOLS.cardTag}</span>
                  <div className="resource-title">{t.name}</div>
                  <p className="resource-desc">{t.summary}</p>
                  <span className="resource-cta">{HUB_TOOLS.cardCta} →</span>
                </Link>
              ))}
            </div>
            <p style={smallPara}>
              <Link href={TOOLS_HUB_PATH} style={inlineLink}>{HUB_TOOLS.hubLink} →</Link>
            </p>
          </div>
        </div>

        {/* 4. Footer */}
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
