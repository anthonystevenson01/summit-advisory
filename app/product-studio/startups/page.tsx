import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SiteNav from "@/app/components/SiteNav";
import StartupIdeaForm from "@/app/components/product-studio/StartupIdeaForm";
import { ArrowLeft } from "@/app/components/icons";
import {
  FOR_YOU,
  NOT_FOR_YOU,
  PRODUCT_STUDIO_PATH,
  SITE_URL,
  STARTUPS_HERO,
  STARTUPS_PATH,
  STARTUP_FAQS,
  STARTUP_STEPS,
  startupFaqSchema,
} from "../product-studio-content";

const TITLE = "Product Studio for Startups: Your First Product, Built for Equity | Summit";
const DESCRIPTION =
  "We build technology products for early-stage founders in exchange for equity. No large retainer, no handoffs. First version live in 4 weeks.";
const CANONICAL = `${SITE_URL}${STARTUPS_PATH}`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: CANONICAL, images: [{ url: "/opengraph-image", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/opengraph-image"] },
};

export default function ProductStudioStartupsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(startupFaqSchema) }} />
      <SiteNav />
      <div className="page">
        <div className="inner">
          <div className="inner-hero">
            <Link href={PRODUCT_STUDIO_PATH} className="inner-back no-underline">
              <ArrowLeft /> {STARTUPS_HERO.back}
            </Link>
            <div className="inner-eyebrow">{STARTUPS_HERO.eyebrow}</div>
            <h1 className="inner-title">{STARTUPS_HERO.title}</h1>
            <p className="inner-lead">{STARTUPS_HERO.lead}</p>
          </div>

          <div className="inner-body">
            <h2 className="section-label">What You Get</h2>
            <p className="section-intro">Four stages. Four weeks. A working product in market, not a prototype.</p>
            <div className="process-steps">
              {STARTUP_STEPS.map((d) => (
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
                  <p className="equity-title">Skin in the game, on both sides.</p>
                  <p className="equity-body">We don&apos;t charge a large upfront fee. Instead, we take an equity stake in the product we build together, typically between 15 and 30% depending on scope and stage. Our incentives line up with yours. We only win when you win.</p>
                  <p className="equity-body">In exchange, you get senior-level product thinking and engineering without burning your runway. The equity is agreed upfront, documented cleanly, and there are no surprises.</p>
                </div>
                <div className="equity-cards">
                  <div className="equity-card">
                    <div className="equity-card-num">15 to 30%</div>
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
            <h2 className="section-label">Who It&apos;s For</h2>
            <p className="section-intro">The studio model works best in specific situations. Be honest with yourself before applying.</p>
            <div className="for-grid">
              <div className="for-card for-yes">
                <div className="for-card-title">Good fit if...</div>
                {FOR_YOU.map((item) => (
                  <div className="for-item" key={item}><span className="for-check">✓</span><span>{item}</span></div>
                ))}
              </div>
              <div className="for-card for-no">
                <div className="for-card-title">Not a fit if...</div>
                {NOT_FOR_YOU.map((item) => (
                  <div className="for-item" key={item}><span className="for-cross">✕</span><span>{item}</span></div>
                ))}
              </div>
            </div>
          </div>

          <div className="inner-body">
            <h2 className="section-label">Work We&apos;ve Done</h2>
            <p className="section-intro">The studio is young. Here&apos;s what we&apos;ve shipped so far.</p>
            <div className="case-grid">
              <div className="case-card">
                <div className="case-header">
                  <div className="case-name">Podbeat.ai</div>
                  <span className="resource-tag">Live Product</span>
                </div>
                <p className="case-desc">An AI-powered podcast tool that generates moment catalogues, enables clip creation, and automates distribution across TikTok, Spotify and YouTube. Built end to end by the Summit studio.</p>
                <div className="case-outcomes">
                  <div className="case-outcome">Production deployed</div>
                  <div className="case-outcome">Multi-platform distribution</div>
                  <div className="case-outcome">AI transcription and search</div>
                </div>
              </div>
              <div className="case-card case-placeholder">
                <div className="case-header">
                  <div className="case-name">Your Project</div>
                  <span className="resource-tag">Next Up</span>
                </div>
                <p className="case-desc">We&apos;re selectively taking on new studio engagements. If you have an idea worth building, we want to hear it.</p>
                <div className="case-outcomes">
                  <div className="case-outcome">Submit your idea below</div>
                </div>
              </div>
            </div>
          </div>

          <div className="inner-body">
            <h2 className="section-label">Frequently Asked Questions</h2>
            <div className="features">
              {STARTUP_FAQS.map((f) => (
                <div className="feature" key={f.q}>
                  <div className="feature-title">{f.q}</div>
                  <p className="feature-body">{f.a}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="inner-body">
            <h2 className="section-label">Submit Your Idea</h2>
            <p className="section-intro">Tell us what you&apos;re building. We review every submission and respond within 3 business days.</p>
            <StartupIdeaForm />
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
