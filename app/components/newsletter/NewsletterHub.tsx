"use client";

import { useState } from "react";
import { ISSUES } from "./data/issues";
import NewsletterCapture from "../toolkit/shared/NewsletterCapture";
import NewsletterReader from "./NewsletterReader";
import SiteNav from "../SiteNav";

const LOGO_WHITE = "/brand-icons/Combination Mark_White.png";

function SiteFooter() {
  return (
    <footer className="footer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_WHITE} alt="Summit" className="footer-logo" />
      <ul className="footer-links">
        <li><a href="/">Home</a></li>
        <li><a href="/">AI Studio</a></li>
        <li><a href="/">Scale-Up Advisory</a></li>
        <li><a href="/">Resources</a></li>
        <li><a href="/tools">GTM Tools</a></li>
        <li><a href="/">Blog</a></li>
        <li><a href="/newsletter">Newsletter</a></li>
      </ul>
      <span className="footer-copy">© 2026 Summit Strategy Advisory</span>
    </footer>
  );
}

export default function NewsletterHub() {
  const [readingIssueId, setReadingIssueId] = useState<string | null>(null);

  if (readingIssueId !== null) {
    return (
      <>
        <SiteNav activePage="newsletter" />
        <div className="page">
          <NewsletterReader issueId={readingIssueId} />
          <SiteFooter />
        </div>
      </>
    );
  }

  const featured = ISSUES[0];
  const archive = ISSUES.slice(1);

  return (
    <>
      <SiteNav activePage="newsletter" />
      <div className="page">
      <div className="inner">
      {/* Masthead */}
      <div className="inner-hero">
        <div className="inner-eyebrow">Summit Strategy Advisory</div>
        <h1 className="inner-title">The Scale-Up Letter</h1>
        <p className="inner-lead">
          For scale-up leaders selling into finite markets. Practical GTM thinking, once a week.
        </p>
      </div>

      {/* Inline signup strip */}
      <div className="inner-body" style={{ paddingBottom: 32 }}>
        <div style={{ display: "flex", gap: 40, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 32 }}>
            <div>
              <div className="section-label" style={{ marginBottom: 4 }}>Frequency</div>
              <p style={{ fontSize: 14, color: "var(--forest)", fontWeight: 600, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>Weekly</p>
            </div>
            <div>
              <div className="section-label" style={{ marginBottom: 4 }}>Read Time</div>
              <p style={{ fontSize: 14, color: "var(--forest)", fontWeight: 600, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>5–8 minutes</p>
            </div>
            <div>
              <div className="section-label" style={{ marginBottom: 4 }}>Focus</div>
              <p style={{ fontSize: 14, color: "var(--forest)", fontWeight: 600, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>Finite-market GTM</p>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 480, marginTop: 24 }}>
          <NewsletterCapture dark={false} label="" />
        </div>
      </div>

      {/* Featured issue */}
      {featured && (
        <div className="inner-body" style={{ paddingTop: 0 }}>
          <div className="section-label">Latest Issue</div>
          <div style={{ marginTop: 16 }}>
            <button
              className="resource resource-tool"
              onClick={() => setReadingIssueId(featured.id)}
              aria-label={`Read ${featured.title}`}
              style={{ display: "block", width: "100%", textAlign: "left" }}
            >
              <span className="resource-tag">{featured.tag} · {featured.num} · {featured.date}</span>
              <div className="resource-title">{featured.title}</div>
              <p className="resource-desc">{featured.subtitle}</p>
              <div style={{ marginTop: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--ghost)", letterSpacing: "0.06em" }}>{featured.readTime}</span>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--teal)" }}>Read →</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Archive */}
      {archive.length > 0 && (
        <div className="inner-body" style={{ paddingTop: 0 }}>
          <div className="section-label">Archive</div>
          <div className="resources" style={{ marginTop: 16 }}>
            {archive.map((issue) => (
              <button
                key={issue.id}
                className="resource resource-tool"
                onClick={() => setReadingIssueId(issue.id)}
                aria-label={`Read ${issue.title}`}
                style={{ display: "block", width: "100%", textAlign: "left" }}
              >
                <span className="resource-tag">{issue.tag} · {issue.num}</span>
                <div className="resource-title">{issue.title}</div>
                <p className="resource-desc">{issue.subtitle}</p>
                <div style={{ marginTop: 12, display: "flex", gap: 16, alignItems: "center" }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--ghost)", letterSpacing: "0.06em" }}>{issue.date}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--ghost)", letterSpacing: "0.06em" }}>{issue.readTime}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom CTA */}
      <div className="equity-band">
        <div className="inner-body" style={{ margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
            <div>
              <div className="inner-eyebrow">Subscribe</div>
              <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 900, textTransform: "uppercase", color: "var(--white)", lineHeight: 1.05, marginBottom: 16 }}>
                Join the Scale-Up Letter
              </h2>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.58)", lineHeight: 1.75 }}>
                Practical GTM thinking for teams selling into finite, defined markets. No generic advice. No padding. One essay, once a week.
              </p>
            </div>
            <div>
              <NewsletterCapture dark label="" />
            </div>
          </div>
        </div>
      </div>

      {/* Footer note */}
      <div style={{ padding: "20px 48px", borderTop: "1px solid var(--border)" }}>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--ghost)", letterSpacing: "0.06em" }}>
          The Scale-Up Letter · Summit Strategy Advisory · Unsubscribe at any time
        </p>
      </div>
    </div>
      <SiteFooter />
      </div>
    </>
  );
}
