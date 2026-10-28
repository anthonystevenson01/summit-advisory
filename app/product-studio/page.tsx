import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SiteNav from "@/app/components/SiteNav";
import { ArrowLeft, ArrowRight } from "@/app/components/icons";
import { HERO, HUB_OPTIONS_LABEL, OPTIONS, PRODUCT_STUDIO_PATH, RECENT_WORK, SITE_URL, hubSchema } from "./product-studio-content";

const TITLE = "Product Studio: Equity Builds for Startups, Bespoke Software for Enterprise | Summit";
const DESCRIPTION =
  "Summit builds technology products for startups in exchange for equity, and smart bespoke software for enterprise teams. Production code you own.";
const CANONICAL = `${SITE_URL}${PRODUCT_STUDIO_PATH}`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: CANONICAL, images: [{ url: "/opengraph-image", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/opengraph-image"] },
};

/**
 * Hub for the Product Studio practice, laid out like /scale-up-advisory:
 * hero, the two option cards (each its own page) and recent work. The option
 * pages carry the detail, the FAQs and the calls to action.
 */
export default function ProductStudioHubPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(hubSchema) }} />
      <SiteNav />
      <div className="page">
        <div className="inner">
          <div className="inner-hero">
            <Link href="/" className="inner-back no-underline">
              <ArrowLeft /> All Practices
            </Link>
            <div className="inner-eyebrow">{HERO.eyebrow}</div>
            <h1 className="inner-title">{HERO.title}</h1>
            <p className="inner-lead">{HERO.lead}</p>
          </div>

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

          <div className="inner-body">
            <h2 className="section-label">What We&apos;ve Built Recently</h2>
            <div className="case-grid">
              {RECENT_WORK.map((c) => (
                <div className="case-card" key={c.name}>
                  <div className="case-header">
                    <div className="case-name">{c.name}</div>
                    <span className="resource-tag">{c.tag}</span>
                  </div>
                  <p className="case-desc">{c.desc}</p>
                  <div className="case-outcomes">
                    {c.outcomes.map((o) => (
                      <div className="case-outcome" key={o}>{o}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className="footer">
          <Image src="/brand-icons/Combination Mark_White.png" alt="Summit Strategy Advisory" width={140} height={22} className="footer-logo" />
          <ul className="footer-links">
            <li><Link href="/product-studio">Product Studio</Link></li>
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
