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
    return (
      <p style={{ fontSize: 16, color: "var(--ink)", lineHeight: 1.85, marginBottom: 20 }}>
        {block.text}
      </p>
    );
  }
  if (block.type === "h2") {
    return (
      <h2 style={{
        fontFamily: "var(--font-barlow-condensed), sans-serif",
        fontSize: 24,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        color: "var(--forest)",
        marginTop: 36,
        marginBottom: 14,
      }}>
        {block.text}
      </h2>
    );
  }
  if (block.type === "pullquote") {
    return (
      <blockquote style={{
        borderLeft: "4px solid var(--sage)",
        margin: "28px 0",
        padding: "16px 24px",
        background: "var(--off)",
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: 17,
        fontStyle: "italic",
        color: "var(--forest)",
        lineHeight: 1.7,
      }}>
        {block.text}
      </blockquote>
    );
  }
  if (block.type === "rule") {
    return (
      <hr style={{
        border: "none",
        borderTop: "2px solid var(--border)",
        margin: "36px 0",
      }} />
    );
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
      <div className="inner">
        <div className="inner-body" style={{ textAlign: "center", paddingTop: 80 }}>
          <p style={{ fontFamily: "var(--font-barlow-condensed), sans-serif", fontSize: 18, color: "var(--forest)" }}>
            Issue not found.
          </p>
          <Link
            href="/newsletter"
            style={{
              fontFamily: "var(--font-barlow-condensed), sans-serif",
              fontSize: 13,
              color: "var(--teal)",
              textDecoration: "none",
              display: "inline-block",
              marginTop: 16,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            ← All Issues
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="inner">
      {/* Sticky reading nav */}
      <nav
        aria-label="Issue navigation"
        style={{
          position: "sticky",
          top: 64,
          zIndex: 200,
          background: "var(--forest)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 48px",
          height: 48,
          borderBottom: "2px solid var(--teal)",
        }}
      >
        <Link
          href="/newsletter"
          style={{
            fontFamily: "var(--font-barlow-condensed), sans-serif",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.5)",
            textDecoration: "none",
          }}
          aria-label="Back to all issues"
        >
          ← All Issues
        </Link>
        <span style={{
          fontFamily: "var(--font-barlow-condensed), sans-serif",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.35)",
        }}>
          The Scale-Up Letter
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => { if (prevIssue) setCurrentIndex(currentIndex + 1); }}
            disabled={!prevIssue}
            aria-label="Previous issue"
            style={{
              fontFamily: "var(--font-barlow-condensed), sans-serif",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              background: "none",
              border: "1px solid rgba(255,255,255,0.2)",
              color: prevIssue ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)",
              padding: "6px 14px",
              cursor: prevIssue ? "pointer" : "default",
            }}
          >
            ← Prev
          </button>
          <button
            onClick={() => { if (nextIssue) setCurrentIndex(currentIndex - 1); }}
            disabled={!nextIssue}
            aria-label="Next issue"
            style={{
              fontFamily: "var(--font-barlow-condensed), sans-serif",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              background: "none",
              border: "1px solid rgba(255,255,255,0.2)",
              color: nextIssue ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)",
              padding: "6px 14px",
              cursor: nextIssue ? "pointer" : "default",
            }}
          >
            Next →
          </button>
        </div>
      </nav>

      {/* Article hero */}
      <div className="inner-hero">
        <div className="inner-eyebrow">{issue.tag} · {issue.num} · {issue.date}</div>
        <h1 className="inner-title">{issue.title}</h1>
        <p className="inner-lead">{issue.subtitle}</p>
        <div style={{ marginTop: 16 }}>
          <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em" }}>
            {issue.readTime}
          </span>
        </div>
      </div>

      {/* Article body */}
      <div className="inner-body" style={{ maxWidth: 720 }}>
        <article>
          {issue.body.map((block, i) => (
            <BlockRenderer key={i} block={block} />
          ))}
        </article>
      </div>

      {/* Issue footer */}
      <div className="inner-body" style={{ paddingTop: 0, maxWidth: 720 }}>
        <div style={{ borderTop: "2px solid var(--border)", paddingTop: 40, marginBottom: 40 }}>
          <div className="section-label">Forward this issue</div>
          <p className="section-intro">
            If this was useful, share it with a GTM leader on your team. And if you&rsquo;re not already subscribed, join below.
          </p>
          <NewsletterCapture dark={false} label="Subscribe to The Scale-Up Letter" />
        </div>
      </div>

      {/* Prev / Next */}
      <div style={{ borderTop: "3px solid var(--border)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
        <button
          onClick={() => { if (prevIssue) setCurrentIndex(currentIndex + 1); }}
          disabled={!prevIssue}
          aria-label={prevIssue ? `Previous issue: ${prevIssue.title}` : "No previous issue"}
          style={{
            background: prevIssue ? "var(--off)" : "transparent",
            border: "none",
            padding: prevIssue ? "28px 32px" : 0,
            textAlign: "left",
            cursor: prevIssue ? "pointer" : "default",
          }}
        >
          {prevIssue && (
            <>
              <div style={{ fontFamily: "var(--font-barlow-condensed), sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--ghost)", marginBottom: 8 }}>
                ← Previous
              </div>
              <div style={{ fontFamily: "var(--font-barlow-condensed), sans-serif", fontSize: 18, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--forest)", lineHeight: 1.15 }}>
                {prevIssue.title}
              </div>
            </>
          )}
        </button>
        <button
          onClick={() => { if (nextIssue) setCurrentIndex(currentIndex - 1); }}
          disabled={!nextIssue}
          aria-label={nextIssue ? `Next issue: ${nextIssue.title}` : "No next issue"}
          style={{
            background: nextIssue ? "var(--off)" : "transparent",
            border: "none",
            padding: nextIssue ? "28px 32px" : 0,
            textAlign: "right",
            cursor: nextIssue ? "pointer" : "default",
          }}
        >
          {nextIssue && (
            <>
              <div style={{ fontFamily: "var(--font-barlow-condensed), sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--ghost)", marginBottom: 8 }}>
                Next →
              </div>
              <div style={{ fontFamily: "var(--font-barlow-condensed), sans-serif", fontSize: 18, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--forest)", lineHeight: 1.15 }}>
                {nextIssue.title}
              </div>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
