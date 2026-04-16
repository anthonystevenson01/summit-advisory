"use client";

import { useState } from "react";
import Link from "next/link";
import { ISSUES, BodyBlock } from "./data/issues";
import NewsletterCapture from "../toolkit/shared/NewsletterCapture";

interface Props {
  issueId: string | null;
}

function BlockRenderer({ block }: { block: BodyBlock }) {
  if (block.type === "p") {
    return <p className="tk-nl-block-p">{block.text}</p>;
  }
  if (block.type === "h2") {
    return <h2 className="tk-nl-block-h2">{block.text}</h2>;
  }
  if (block.type === "pullquote") {
    return <blockquote className="tk-nl-block-pullquote">{block.text}</blockquote>;
  }
  if (block.type === "rule") {
    return <hr className="tk-nl-block-rule" />;
  }
  return null;
}

export default function NewsletterReader({ issueId }: Props) {
  const initialIndex = issueId ? ISSUES.findIndex((i) => i.id === issueId) : -1;
  const [currentIndex, setCurrentIndex] = useState(initialIndex === -1 ? 0 : initialIndex);

  const issue = ISSUES[currentIndex] ?? null;
  const prevIssue = currentIndex < ISSUES.length - 1 ? ISSUES[currentIndex + 1] : null;
  const nextIssue = currentIndex > 0 ? ISSUES[currentIndex - 1] : null;

  if (!issue) {
    return (
      <div className="tk-nl-page">
        <div style={{ padding: "80px 40px", textAlign: "center" }}>
          <p style={{ fontFamily: "Oswald, sans-serif", fontSize: 18, color: "#0e1a10" }}>Issue not found.</p>
          <Link href="/newsletter" style={{ fontFamily: "Oswald, sans-serif", fontSize: 13, color: "#005A66", textDecoration: "none", display: "inline-block", marginTop: 16 }}>
            ← All Issues
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="tk-nl-page">
      {/* Sticky reading nav */}
      <nav className="tk-nl-reader-nav" aria-label="Issue navigation">
        <Link href="/newsletter" className="tk-nl-reader-back" aria-label="Back to all issues">
          ← All Issues
        </Link>
        <span className="tk-nl-reader-pub">The Scale-Up Letter</span>
        <div className="tk-nl-reader-nav-btns">
          <button
            className="tk-nl-nav-btn"
            onClick={() => { if (prevIssue) setCurrentIndex(currentIndex + 1); }}
            disabled={!prevIssue}
            aria-label="Previous issue"
          >
            ← Prev
          </button>
          <button
            className="tk-nl-nav-btn"
            onClick={() => { if (nextIssue) setCurrentIndex(currentIndex - 1); }}
            disabled={!nextIssue}
            aria-label="Next issue"
          >
            Next →
          </button>
        </div>
      </nav>

      {/* Article */}
      <article className="tk-nl-article">
        <div className="tk-nl-article-meta" aria-label="Issue metadata">
          <span>{issue.num}</span>
          <span>·</span>
          <span>{issue.date}</span>
          <span>·</span>
          <span>{issue.readTime}</span>
          <span className="tk-nl-meta-tag">{issue.tag}</span>
        </div>
        <h1 className="tk-nl-article-h1">{issue.title}</h1>
        <p className="tk-nl-article-dek">{issue.subtitle}</p>
        <div className="tk-nl-article-body">
          {issue.body.map((block, i) => (
            <BlockRenderer key={i} block={block} />
          ))}
        </div>
      </article>

      {/* Issue footer */}
      <div className="tk-nl-issue-footer">
        <div className="tk-nl-issue-footer-title">Forward this issue</div>
        <p className="tk-nl-issue-footer-sub">
          If this was useful, share it with a GTM leader on your team. And if you&rsquo;re not already subscribed, join below.
        </p>
        <div className="tk-nl-issue-footer-form">
          <NewsletterCapture dark={false} label="Subscribe to The Scale-Up Letter" />
        </div>
      </div>

      {/* Prev / Next */}
      <nav className="tk-nl-prev-next" aria-label="Adjacent issues">
        <button
          className="tk-nl-pn-btn"
          onClick={() => { if (prevIssue) setCurrentIndex(currentIndex + 1); }}
          disabled={!prevIssue}
          aria-label={prevIssue ? `Previous issue: ${prevIssue.title}` : "No previous issue"}
        >
          {prevIssue && (
            <>
              <div className="tk-nl-pn-label">← Previous</div>
              <div className="tk-nl-pn-title">{prevIssue.title}</div>
            </>
          )}
        </button>
        <button
          className="tk-nl-pn-btn"
          style={{ textAlign: "right" }}
          onClick={() => { if (nextIssue) setCurrentIndex(currentIndex - 1); }}
          disabled={!nextIssue}
          aria-label={nextIssue ? `Next issue: ${nextIssue.title}` : "No next issue"}
        >
          {nextIssue && (
            <>
              <div className="tk-nl-pn-label">Next →</div>
              <div className="tk-nl-pn-title">{nextIssue.title}</div>
            </>
          )}
        </button>
      </nav>
    </div>
  );
}
