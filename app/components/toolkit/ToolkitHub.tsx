"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "../icons";
import NewsletterCapture from "./shared/NewsletterCapture";
import ToolkitFooter from "./ToolkitFooter";
import SiteNav from "../SiteNav";
import { PUBLIC_TOOLS, isToolHidden, isToolPublic } from "@/app/lib/tools/registry";
import { BUILDER_BLOCK, ENTRY_PATHS, HOW_IT_WORKS, HUB_INTRO, HUB_LEAD, HUB_TAG } from "@/app/tools/hub-copy";

// One surface and accent for every card.
const CARD_SURFACE = "#0a1a14";
const CARD_ACCENT = "#319A65";

/**
 * Reads ?tool=X from the URL and redirects to /tools/X. Isolated in its own
 * component so that the Suspense boundary it requires (useSearchParams
 * triggers client bailout) doesn't force the whole hub to opt out of
 * static rendering.
 */
function LegacyToolRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const legacy = searchParams.get("tool");
    if (legacy && isToolPublic(legacy)) {
      router.replace(`/tools/${legacy}`);
    }
  }, [searchParams, router]);

  return null;
}

/**
 * GTM Toolkit hub — lists all available tools as cards.
 *
 * Each card links to its own URL (e.g. /tools/persona) so tools are
 * deep-linkable, SEO-indexable, and share-friendly. For backward
 * compatibility, legacy ?tool=X query strings redirect to the new route.
 */
export default function ToolkitHub() {
  return (
    <>
      <Suspense fallback={null}>
        <LegacyToolRedirect />
      </Suspense>
      <SiteNav activePage="tools" />
      <div className="page">

        {/* Hero — full width at page level */}
        <div className="inner-hero">
          <Link href="/" className="inner-back">
            <ArrowLeft />
            Home
          </Link>
          <div className="inner-eyebrow">Scale-Up Advisory</div>
          <h1 className="inner-title">Summit GTM Toolkit</h1>
          <p className="inner-lead">{HUB_LEAD}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 28, flexWrap: "wrap", position: "relative" }}>
            {[HUB_TAG, "For teams selling into a finite market", "No Signup Required"].map((tag) => (
              <span key={tag} style={{
                fontFamily: "var(--font-barlow-condensed), sans-serif",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--sage)",
                border: "1px solid rgba(49,154,101,0.4)",
                borderRadius: 2,
                padding: "4px 10px",
              }}>{tag}</span>
            ))}
          </div>
        </div>

        <div className="inner">

          {/* Niche callout */}
          <div style={{ background: "var(--teal)", padding: "28px 48px" }}>
            <p style={{ fontFamily: "Barlow, sans-serif", fontSize: 15, lineHeight: 1.75, color: "rgba(255,255,255,0.75)", maxWidth: 760 }}>
              Generic GTM advice assumes you have an infinite market. You don&rsquo;t. When your TAM is 400 accounts,
              every positioning misstep costs you a prospect you&rsquo;ll never get back. These tools are built for that reality.
            </p>
          </div>

          {/* Three ways in: the entry block above the grid */}
          <div className="cards-section" style={{ paddingBottom: 0 }}>
            <div className="cards-label">Three ways in</div>
            <div className="cards">
              {ENTRY_PATHS.map((path, i) => {
                const num = String(i + 1).padStart(2, "0");
                const top = (
                  <div className="card-icon-wrap" style={{ background: CARD_SURFACE, minHeight: 64, alignItems: "flex-end", justifyContent: "space-between", paddingBottom: 16 }}>
                    <span style={{
                      fontFamily: "var(--font-barlow-condensed), sans-serif",
                      fontSize: 11, fontWeight: 700,
                      letterSpacing: "0.18em", textTransform: "uppercase",
                      color: CARD_ACCENT,
                    }}>{num}</span>
                    {path.comingNext && (
                      <span style={{
                        fontFamily: "var(--font-barlow-condensed), sans-serif",
                        fontSize: 11, fontWeight: 700,
                        letterSpacing: "0.14em", textTransform: "uppercase",
                        color: "#D4A017",
                        border: "1px solid rgba(212,160,23,0.5)",
                        borderRadius: 2, padding: "2px 8px",
                      }}>Coming next</span>
                    )}
                  </div>
                );
                const body = (
                  <div className="card-body" style={{ borderTopColor: CARD_ACCENT }}>
                    <div className="card-title">{path.title}</div>
                    <p className="card-desc">{path.body}</p>
                    <div className="card-link" style={{ marginTop: "auto", paddingTop: 16 }}>
                      {path.cta} →
                    </div>
                  </div>
                );
                return path.href.startsWith("mailto:") ? (
                  <a key={path.title} href={path.href} className="card" aria-label={path.cta}>
                    {top}
                    {body}
                  </a>
                ) : (
                  <Link key={path.title} href={path.href} className="card" aria-label={path.cta}>
                    {top}
                    {body}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* How It Works — full width, 3-column */}
          <div style={{ padding: "56px 48px 64px" }}>
            <div className="section-label">How It Works</div>
            <p className="section-intro" style={{ marginBottom: 40 }}>{HUB_INTRO}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3 }}>
              {HOW_IT_WORKS.map((step) => (
                <div key={step.num} className="feature">
                  <div style={{
                    fontFamily: "var(--font-barlow-condensed), sans-serif",
                    fontSize: 32, fontWeight: 900, color: "var(--sage)",
                    lineHeight: 1, marginBottom: 10,
                  }}>{step.num}</div>
                  <div className="feature-title">{step.title}</div>
                  <p className="feature-body">{step.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tool cards — uses homepage .cards-section pattern */}
          <div className="cards-section" id="tools">
            <div className="cards-label">The Tools</div>
            <div className="cards">

              {/* Public tools from the registry, in number order */}
              {PUBLIC_TOOLS.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/tools/${tool.slug}`}
                  className="card"
                  aria-label={`Open ${tool.name}`}
                >
                  <div className="card-icon-wrap" style={{ background: CARD_SURFACE, minHeight: 64, alignItems: "flex-end", paddingBottom: 16 }}>
                    <span style={{
                      fontFamily: "var(--font-barlow-condensed), sans-serif",
                      fontSize: 11, fontWeight: 700,
                      letterSpacing: "0.18em", textTransform: "uppercase",
                      color: CARD_ACCENT,
                    }}>Tool {tool.number}</span>
                  </div>
                  <div className="card-body" style={{ borderTopColor: CARD_ACCENT }}>
                    <div className="card-title">{tool.name}</div>
                    <p className="card-desc">{tool.tagline}</p>
                    <p style={{ fontSize: 13, color: "var(--ghost)", marginTop: 8, lineHeight: 1.6 }}>
                      <strong style={{ color: CARD_ACCENT, fontFamily: "var(--font-barlow-condensed), sans-serif", letterSpacing: "0.04em" }}>You get:</strong>{" "}
                      {tool.outputDescription}
                    </p>
                    <div className="card-link" style={{ marginTop: "auto", paddingTop: 16 }}>
                      Open Tool →
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Account Intelligence: separate section. Hidden while the registry marks "account" hidden. */}
          {!isToolHidden("account") && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", marginTop: 0 }}>
              <div className="cards-section" style={{ paddingTop: 48 }}>
                <div className="cards-label" style={{ color: "#67e8f9" }}>Account Intelligence</div>
                <p style={{ fontFamily: "Barlow, sans-serif", fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 28, maxWidth: 560, lineHeight: 1.65 }}>
                  A deeper research tool — pulls live signals on a named account and builds you a full sales brief.
                </p>
                <div className="cards">
                  <Link
                    href="/tools/account"
                    className="card"
                    aria-label="Open Account Intelligence"
                  >
                    <div className="card-icon-wrap" style={{ background: "#00252e", minHeight: 64, alignItems: "flex-end", paddingBottom: 16 }}>
                      <span style={{
                        fontFamily: "var(--font-barlow-condensed), sans-serif",
                        fontSize: 11, fontWeight: 700,
                        letterSpacing: "0.18em", textTransform: "uppercase",
                        color: "#67e8f9",
                      }}>Account Intel</span>
                    </div>
                    <div className="card-body" style={{ borderTopColor: "#67e8f9" }}>
                      <div className="card-title">Account Intelligence</div>
                      <p className="card-desc">Get a full sales brief on any target account — signals, contacts, and an opening play.</p>
                      <p style={{ fontSize: 13, color: "var(--ghost)", marginTop: 8, lineHeight: 1.6 }}>
                        <strong style={{ color: "#67e8f9", fontFamily: "var(--font-barlow-condensed), sans-serif", letterSpacing: "0.04em" }}>You get:</strong>{" "}
                        ICP fit, timing verdict, key contacts with LinkedIn searches, market signals, recommended opening.
                      </p>
                      <div className="card-link" style={{ marginTop: "auto", paddingTop: 16 }}>
                        Open Tool →
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Project Builder: one band above the newsletter capture */}
          <div className="cards-section" style={{ paddingBottom: 48 }}>
            <div className="cards-label">{BUILDER_BLOCK.label}</div>
            <h2 style={{ fontFamily: "var(--font-barlow-condensed), sans-serif", fontSize: 32, fontWeight: 700, color: "var(--forest)", margin: "0 0 8px", lineHeight: 1.1 }}>
              {BUILDER_BLOCK.title}
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--ghost)", margin: "0 0 16px", maxWidth: 560 }}>{BUILDER_BLOCK.body}</p>
            <Link href={BUILDER_BLOCK.href} className="card-link" aria-label={BUILDER_BLOCK.cta}>
              {BUILDER_BLOCK.cta} &rarr;
            </Link>
          </div>

          {/* Newsletter */}
          <NewsletterCapture dark label="Get the Scale-Up Letter" />

        </div>
        <ToolkitFooter />
      </div>
    </>
  );
}
