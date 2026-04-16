"use client";

import { useState } from "react";
import { ISSUES } from "./data/issues";
import NewsletterCapture from "../toolkit/shared/NewsletterCapture";
import NewsletterReader from "./NewsletterReader";

export default function NewsletterHub() {
  const [readingIssueId, setReadingIssueId] = useState<string | null>(null);

  if (readingIssueId !== null) {
    return <NewsletterReader issueId={readingIssueId} />;
  }

  const featured = ISSUES[0];
  const archive = ISSUES.slice(1);

  return (
    <div className="tk-nl-page">
      {/* Masthead */}
      <header className="tk-nl-masthead">
        <div className="tk-nl-masthead-title">The Scale-Up Letter</div>
        <p className="tk-nl-masthead-tagline">For scale-up leaders selling into finite markets</p>
      </header>

      {/* Inline signup strip */}
      <div className="tk-nl-signup-strip">
        <div className="tk-nl-descriptors">
          <div className="tk-nl-descriptor">
            <span className="tk-nl-descriptor-key">Frequency</span>
            <span className="tk-nl-descriptor-val">Weekly</span>
          </div>
          <div className="tk-nl-descriptor">
            <span className="tk-nl-descriptor-key">Read Time</span>
            <span className="tk-nl-descriptor-val">5–8 minutes</span>
          </div>
          <div className="tk-nl-descriptor">
            <span className="tk-nl-descriptor-key">Focus</span>
            <span className="tk-nl-descriptor-val">Finite-market GTM</span>
          </div>
        </div>
        <div className="tk-nl-inline-form">
          <NewsletterCapture dark label="" />
        </div>
      </div>

      {/* Featured issue */}
      {featured && (
        <div className="tk-nl-featured">
          <div className="tk-nl-archive-title" style={{ marginBottom: 24 }}>Latest Issue</div>
          <button
            className="tk-nl-featured-issue"
            onClick={() => setReadingIssueId(featured.id)}
            aria-label={`Read ${featured.title}`}
            style={{ background: "none", border: "none", padding: 0, width: "100%", textAlign: "left", cursor: "pointer" }}
          >
            <div className="tk-nl-issue-num">{featured.num} · {featured.date}</div>
            <div className="tk-nl-featured-title">{featured.title}</div>
            <p className="tk-nl-featured-subtitle">{featured.subtitle}</p>
            <div className="tk-nl-meta">
              <span className="tk-nl-meta-tag">{featured.tag}</span>
              <span>{featured.readTime}</span>
              <span>Read →</span>
            </div>
          </button>
        </div>
      )}

      {/* Archive */}
      {archive.length > 0 && (
        <div className="tk-nl-archive">
          <div className="tk-nl-archive-title">Archive</div>
          {archive.map((issue) => (
            <button
              key={issue.id}
              className="tk-nl-archive-item"
              onClick={() => setReadingIssueId(issue.id)}
              aria-label={`Read ${issue.title}`}
            >
              <span className="tk-nl-archive-num">{issue.num}</span>
              <span className="tk-nl-archive-title-text">{issue.title}</span>
              <span className="tk-nl-archive-date">{issue.date}</span>
            </button>
          ))}
        </div>
      )}

      {/* Bottom two-column signup */}
      <div className="tk-nl-bottom-signup">
        <div className="tk-nl-bottom-grid">
          <div>
            <div className="tk-nl-bottom-copy-title">Join the Scale-Up Letter</div>
            <p className="tk-nl-bottom-copy-body">
              Practical GTM thinking for teams selling into finite, defined markets. No generic advice. No padding. One essay, once a week.
            </p>
          </div>
          <div>
            <NewsletterCapture dark label="" />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="tk-nl-bottom-footer">
        <span className="tk-nl-bottom-footer-text">The Scale-Up Letter · Summit Strategy Advisory · Unsubscribe at any time</span>
      </div>
    </div>
  );
}
