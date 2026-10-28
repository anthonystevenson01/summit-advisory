import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SiteNav from "@/app/components/SiteNav";
import { ArrowLeft } from "@/app/components/icons";
import { BOOK_CALL_URL } from "@/app/lib/brand";
import { PROJECT_BUILDER_PATH } from "@/app/lib/project-builder/copy";
import {
  BUILDER_STEPS,
  BUILT_AROUND_YOU,
  BUILT_SMART,
  ENTERPRISE_HERO,
  ENTERPRISE_PATH,
  ENTERPRISE_STEPS,
  PRODUCT_STUDIO_PATH,
  RECENT_WORK,
  SHIFTS,
  SITE_URL,
  WHY_US,
} from "../product-studio-content";

const TITLE = "Product Studio for Enterprise: Smart Bespoke Software | Summit";
const DESCRIPTION =
  "Smart bespoke software for enterprise teams. Built around your business, deployed in your environment, quoted at a fixed price, and yours to own.";
const CANONICAL = `${SITE_URL}${ENTERPRISE_PATH}`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: CANONICAL, images: [{ url: "/opengraph-image", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/opengraph-image"] },
};

function FeatureGrid({ items }: { items: readonly { title: string; body: string }[] }) {
  return (
    <div className="features">
      {items.map((f) => (
        <div className="feature" key={f.title}>
          <div className="feature-title">{f.title}</div>
          <p className="feature-body">{f.body}</p>
        </div>
      ))}
    </div>
  );
}

/** Enterprise option page, drawn from the "Summit Product Studio intro" deck (Oct 2026). No prices: every build is quoted against a signed-off spec. */
export default function ProductStudioEnterprisePage() {
  return (
    <>
      <SiteNav />
      <div className="page">
        <div className="inner">
          <div className="inner-hero">
            <Link href={PRODUCT_STUDIO_PATH} className="inner-back no-underline">
              <ArrowLeft /> {ENTERPRISE_HERO.back}
            </Link>
            <div className="inner-eyebrow">{ENTERPRISE_HERO.eyebrow}</div>
            <h1 className="inner-title">{ENTERPRISE_HERO.title}</h1>
            <p className="inner-lead">{ENTERPRISE_HERO.lead}</p>
          </div>

          <div className="inner-body">
            <h2 className="section-label">The Market Is Moving</h2>
            <p className="section-intro">From complex to simple. From built for the many to built for you.</p>
            <FeatureGrid items={SHIFTS} />
          </div>

          <div className="inner-body">
            <h2 className="section-label">Built Smart</h2>
            <p className="section-intro">Tools with judgement built in.</p>
            <FeatureGrid items={BUILT_SMART} />
          </div>

          <div className="inner-body">
            <h2 className="section-label">Built Around You</h2>
            <p className="section-intro">Your business, your systems, your rules.</p>
            <FeatureGrid items={BUILT_AROUND_YOU} />
          </div>

          <div className="inner-body">
            <h2 className="section-label">Our Process</h2>
            <p className="section-intro">Five steps. A forward deployed team with you throughout, from the first conversation to live.</p>
            <div className="process-steps">
              {ENTERPRISE_STEPS.map((d) => (
                <div className="process-step" key={d.step}>
                  <div className="process-step-left">
                    <div className="process-num">{d.step}</div>
                    <div className="process-line" />
                  </div>
                  <div className="process-step-right">
                    <div className="process-header">
                      <div className="process-title">{d.title}</div>
                      <div className="process-duration">You get: {d.get}</div>
                    </div>
                    <p className="process-body">{d.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="equity-band">
            <div className="inner-body" style={{ paddingTop: 0, paddingBottom: 0 }}>
              <h2 className="section-label" style={{ color: "var(--sage)" }}>How We Build</h2>
              <p className="equity-title">Two teams. One standard.</p>
              <p className="equity-body"><strong>Forward deployed specialists</strong> sit in your organisation. Product, analyst and technical deployment people who shape the requirements with you and stay through build, deploy and live.</p>
              <p className="equity-body"><strong>The product and development team</strong> writes the code. Senior AI native engineers working from the Summit knowledge layer: reference architectures, spec and test templates, security rules, ERP, POS and CRM adapters, and deployment recipes. Every piece of work is broken into tasks, run on the right model for the job, and passes its tests and a second review before it reaches you.</p>
            </div>
          </div>

          <div className="inner-body">
            <h2 className="section-label">Where Could We Start?</h2>
            <p className="section-intro">The Project Builder turns an idea into a quoted spec.</p>
            <div className="process-steps">
              {BUILDER_STEPS.map((d) => (
                <div className="process-step" key={d.step}>
                  <div className="process-step-left">
                    <div className="process-num">{d.step}</div>
                    <div className="process-line" />
                  </div>
                  <div className="process-step-right">
                    <div className="process-header">
                      <div className="process-title">{d.title}</div>
                    </div>
                    <p className="process-body">{d.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link href={PROJECT_BUILDER_PATH} className="submit-btn no-underline" style={{ display: "inline-block", width: "auto", textAlign: "center" }}>Try the Project Builder →</Link>
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

          <div className="inner-body">
            <h2 className="section-label">Why Us</h2>
            <p className="section-intro">Senior AI native engineers and product people. We&apos;ve built and shipped software inside and for some of the world&apos;s largest brands.</p>
            <FeatureGrid items={WHY_US} />
          </div>

          <div className="inner-body">
            <h2 className="section-label">Talk to Us</h2>
            <p className="section-intro">A 30-minute call is enough to know if there&apos;s a fit. Bring the problem, not a brief.</p>
            <a href={BOOK_CALL_URL} target="_blank" rel="noopener noreferrer" className="submit-btn no-underline" style={{ display: "block", textAlign: "center" }}>Book a 30-Minute Call →</a>
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
