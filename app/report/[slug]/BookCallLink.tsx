"use client";

import { BRAND } from "@/app/lib/brand";

/**
 * The one call to action on a report: an anchor to the booking page that
 * sends a beacon naming the event and the slug (nothing else) on click and
 * never prevents the navigation.
 */
export default function BookCallLink({ href, slug, label }: { href: string; slug: string; label: string }) {
  const onClick = () => {
    const url = `/api/report/${encodeURIComponent(slug)}/event`;
    const body = JSON.stringify({ event: "book_call_clicked" });
    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(url, body);
      } else {
        void fetch(url, { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
      }
    } catch {
      // the beacon must never block the click
    }
  };
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      style={{ display: "inline-block", padding: "14px 32px", borderRadius: 6, background: BRAND.brandGreen, color: BRAND.white, fontFamily: "var(--font-barlow-condensed), sans-serif", fontWeight: 700, fontSize: 17, letterSpacing: "0.04em", textDecoration: "none" }}
    >
      {label}
    </a>
  );
}
