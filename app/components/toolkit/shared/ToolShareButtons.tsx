"use client";

import { CSSProperties, useEffect, useState } from "react";
import type { ToolSlug } from "@/app/tools/[tool]/toolSlugs";

interface Props {
  slug: ToolSlug;
  title: string;
  /**
   * Horizontal alignment of the buttons within their container.
   * Defaults to "center" — matches the gradient-hero tool pages.
   * Use "start" when the surrounding hero is left-aligned (e.g. Account Intel).
   */
  align?: "center" | "start";
}

/**
 * Copy-link + native-share buttons for a GTM tool page.
 *
 * Builds the canonical tool URL (`/tools/{slug}`) from the current origin,
 * writes it to the clipboard, and on capable devices offers the native
 * share sheet via navigator.share.
 *
 * Intended to sit inside a dark-background hero — white text on a
 * semi-transparent white chip.
 */
export default function ToolShareButtons({ slug, title, align = "center" }: Props) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function"
    );
  }, []);

  const buildUrl = () => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/tools/${slug}`;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access can be blocked (http, permission) — silent no-op
    }
  };

  const handleShare = () => {
    navigator.share({ title, url: buildUrl() }).catch(() => {});
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: align === "center" ? "center" : "flex-start",
        gap: 10,
        flexWrap: "wrap",
        marginTop: 24,
      }}
    >
      <button
        type="button"
        onClick={handleCopy}
        style={BUTTON_STYLE}
        aria-label="Copy link to this tool"
      >
        <CopyIcon />
        {copied ? "Link copied!" : "Copy link"}
      </button>
      {canNativeShare && (
        <button
          type="button"
          onClick={handleShare}
          style={BUTTON_STYLE}
          aria-label="Share this tool"
        >
          <ShareIcon />
          Share
        </button>
      )}
    </div>
  );
}

const BUTTON_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 18px",
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.3)",
  background: "rgba(255,255,255,0.1)",
  fontFamily: "var(--font-dm-sans), sans-serif",
  fontSize: 13,
  fontWeight: 600,
  color: "#FFFFFF",
  cursor: "pointer",
  transition: "all 0.2s",
};

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
