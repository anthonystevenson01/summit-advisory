import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SiteNav from "@/app/components/SiteNav";
import { ArrowRight } from "@/app/components/icons";
import {
  BOOK_URL,
  FREE_TOOLS_ANCHOR_ID,
  HERO,
  HOW_IT_WORKS,
  HOW_WE_CHARGE,
  HOW_WE_CHARGE_TITLE,
  LAST_REVIEWED_LABEL,
  LEAD_ENGINE,
  OUTSOURCED_ANCHOR_ID,
  OUTSOURCED_FAQS,
  PACKAGES_SECTION,
  PACKAGE_STAGES,
  PANEL,
  ROLES,
  ROUTES,
  SCALE_UP_CTA,
  SITUATION,
  THESIS,
  TOOLS_HUB_PATH,
  TOOLS_POINTER,
  TOOLS_SECTION,
  TOOL_STAGE_MAP,
  WHAT_SUMMIT_IS,
  WHY_SUMMIT,
  scaleUpFaqSchema,
  scaleUpServiceSchema,
} from "./scale-up-content";

const TITLE = "Outsourced Sales & Fractional Executives for B2B Scale-Ups | Summit";
const DESCRIPTION =
  "Summit builds, runs and leads your commercial function. Fractional sales people, an AI engine built on your intelligence, fixed-price packages. You own it all.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://summitstrategyadvisory.com/scale-up-advisory" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://summitstrategyadvisory.com/scale-up-advisory",
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

export default function ScaleUpAdvisoryPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(scaleUpServiceSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(scaleUpFaqSchema) }} />
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

          {/* 2. Two routes + tools pointer */}
          <div className="inner-body">
            <h2 className="section-label">Two ways in</h2>
            <div className="for-grid">
              {ROUTES.map((r) => {
                const body = (
                  <div className="card-body">
                    <span className="resource-tag">Route {r.num}</span>
                    <div className="card-title">{r.title}</div>
                    <p className="card-desc">{r.body}</p>
                    <div className="card-link">
                      {r.cta} {r.href.startsWith("#") ? <span aria-hidden="true">↓</span> : <ArrowRight />}
                    </div>
                  </div>
                );
                return r.href.startsWith("#") ? (
                  <a key={r.id} href={r.href} className="card no-underline">
                    {body}
                  </a>
                ) : (
                  <Link key={r.id} href={r.href} className="card no-underline">
                    {body}
                  </Link>
                );
              })}
            </div>
            <p style={smallPara}>
              {TOOLS_POINTER.lead}{" "}
              {TOOL_STAGE_MAP.map((t) => (
                <span key={t.slug}>
                  <Link href={t.href} style={inlineLink}>{t.name}</Link>
                  {", "}
                </span>
              ))}
              or <Link href={TOOLS_HUB_PATH} style={inlineLink}>{TOOLS_POINTER.hubLabel}</Link>{" "}
              (<a href={`#${FREE_TOOLS_ANCHOR_ID}`} style={inlineLink}>{TOOLS_POINTER.fitLabel}</a>).
            </p>
          </div>

          {/* 3–11. Route 02: outsourced sales */}
          {/* scroll-mt-20 offsets the fixed 64px nav so the anchor target is not hidden under it */}
          <div id={OUTSOURCED_ANCHOR_ID} className="scroll-mt-20">
            {/* 3. The situation */}
            <div className="inner-body">
              <h2 className="section-label">{SITUATION.label}</h2>
              <p className="section-intro">{SITUATION.heading}</p>
              <div className="focus-grid">
                {SITUATION.pains.map((p) => (
                  <div className="focus-card" key={p.title}>
                    <div className="focus-title">{p.title}</div>
                    <p className="focus-body">{p.body}</p>
                  </div>
                ))}
              </div>
              <h3 className="section-label" style={{ marginTop: 40 }}>{SITUATION.quotesLabel}</h3>
              <div className="focus-grid">
                {SITUATION.quotes.map((q) => (
                  <div className="focus-card" key={q}>
                    <p className="focus-body italic">&ldquo;{q}&rdquo;</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. What Summit is */}
            <div className="inner-body">
              <h2 className="section-label">{WHAT_SUMMIT_IS.label}</h2>
              <p className="section-intro">
                <strong>{WHAT_SUMMIT_IS.heading}</strong> {WHAT_SUMMIT_IS.intro}
              </p>
              <div className="features">
                {WHAT_SUMMIT_IS.parts.map((p) => (
                  <div className="feature" key={p.num}>
                    <div className="feature-title">{p.num} · {p.title}</div>
                    <p className="feature-body">{p.body}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Thesis */}
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
              </div>
            </div>

            {/* 6. How it works */}
            <div className="inner-body">
              <h2 className="section-label">{HOW_IT_WORKS.label}</h2>
              <p className="section-intro">{HOW_IT_WORKS.heading}</p>
              <div className="features">
                {ROLES.map((r) => (
                  <div className="feature" key={r.title}>
                    <div className="feature-title">{r.title}</div>
                    <p className="feature-body"><strong>{r.strap}</strong> {r.body}</p>
                  </div>
                ))}
              </div>
              <div className="for-card for-yes">
                <div className="for-card-title">{HOW_WE_CHARGE_TITLE}</div>
                {HOW_WE_CHARGE.map((item) => (
                  <div className="for-item" key={item}>
                    <span className="for-check">✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 7. The Panel */}
            <div className="inner-body">
              <h2 className="section-label">{PANEL.label}</h2>
              <p className="section-intro">
                <strong>{PANEL.heading}</strong> {PANEL.fractionalTeam} {PANEL.prospects} {PANEL.intro}
              </p>
              <div className="features">
                {PANEL.points.map((p) => (
                  <div className="feature" key={p.title}>
                    <div className="feature-title">{p.title}</div>
                    <p className="feature-body">{p.body}</p>
                  </div>
                ))}
              </div>
              <h3 className="section-label">{PANEL.libraryLabel}</h3>
              <div className="pkg-meta">
                {PANEL.library.map((item) => (
                  <span className="pkg-tag" key={item}>{item}</span>
                ))}
              </div>
            </div>

            {/* 8. Package coverage */}
            <div className="inner-body">
              <h2 className="section-label">{PACKAGES_SECTION.label}</h2>
              <p className="section-intro">{PACKAGES_SECTION.heading}</p>
              <div className="focus-grid">
                {PACKAGE_STAGES.map((s) => (
                  <div className="focus-card" key={s.id}>
                    <div className="focus-title">{s.id}</div>
                    <p className="focus-body">{s.body}</p>
                  </div>
                ))}
              </div>
              <p className="feature-title" style={{ marginTop: 24 }}>{PACKAGES_SECTION.closer}</p>
            </div>

            {/* 9. Free tools, joined to the message */}
            <div className="inner-body scroll-mt-20" id={FREE_TOOLS_ANCHOR_ID}>
              <h2 className="section-label">{TOOLS_SECTION.label}</h2>
              <p className="section-intro" style={{ marginBottom: 16 }}><strong>{TOOLS_SECTION.heading}</strong></p>
              {TOOLS_SECTION.paragraphs.map((para) => (
                <p className="section-intro" key={para} style={{ marginBottom: 16 }}>{para}</p>
              ))}
              <div className="resources" style={{ marginTop: 32 }}>
                {TOOL_STAGE_MAP.map((t) => (
                  <Link key={t.slug} href={t.href} className="resource resource-tool no-underline">
                    <span className="resource-tag">{t.stage} package</span>
                    <div className="resource-title">{t.name}</div>
                    <p className="resource-desc">{t.body}</p>
                    <span className="resource-cta">{TOOLS_SECTION.cardCta} →</span>
                  </Link>
                ))}
              </div>
              <p style={smallPara}>
                <Link href={TOOLS_HUB_PATH} style={inlineLink}>{TOOLS_SECTION.hubLink} →</Link>
              </p>
            </div>

            {/* 10. Where to start */}
            <div className="inner-body">
              <h2 className="section-label">{LEAD_ENGINE.label}</h2>
              <p className="section-intro">{LEAD_ENGINE.strap}</p>
              <h3 className="feature-title" style={{ fontSize: 24 }}>{LEAD_ENGINE.name}</h3>
              <p className="section-intro">{LEAD_ENGINE.summary}</p>
              <div className="for-grid">
                <div className="for-card for-yes">
                  <div className="for-card-title">{LEAD_ENGINE.walkAwayTitle}</div>
                  {LEAD_ENGINE.walkAway.map((item) => (
                    <div className="for-item" key={item}>
                      <span className="for-check">✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <div className="for-card for-yes">
                  <div className="for-card-title">{LEAD_ENGINE.factsTitle}</div>
                  {LEAD_ENGINE.facts.map((item) => (
                    <div className="for-item" key={item}>
                      <span className="for-check">✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
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
            </div>

            {/* 11. Why Summit */}
            <div className="inner-body">
              <h2 className="section-label">{WHY_SUMMIT.label}</h2>
              <p className="section-intro">
                <strong>{WHY_SUMMIT.heading}</strong> {WHY_SUMMIT.intro}
              </p>
              <div className="features">
                {WHY_SUMMIT.points.map((p) => (
                  <div className="feature" key={p.title}>
                    <div className="feature-title">{p.title}</div>
                    <p className="feature-body">{p.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 12. FAQ */}
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

          {/* 13. CTA */}
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

        {/* 14. Footer */}
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
