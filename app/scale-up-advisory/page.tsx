import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SiteNav from "@/app/components/SiteNav";
import { ArrowLeft, ArrowRight } from "@/app/components/icons";
import {
  HERO,
  HUB_OPTIONS_LABEL,
  OPTIONS,
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

/**
 * Hub for the Scale-Up Advisory practice: the hero and the two option cards
 * (each its own page), laid out like /product-studio. The free GTM tools live
 * at /tools and are linked from the option pages. The narrative for each option
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
            <Link href="/" className="inner-back no-underline">
              <ArrowLeft /> All Practices
            </Link>
            <div className="inner-eyebrow">{HERO.eyebrow}</div>
            <h1 className="inner-title">{HERO.title}</h1>
            <p className="inner-lead">{HERO.lead}</p>
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
        </div>

        {/* 3. Footer */}
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
