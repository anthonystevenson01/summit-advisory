/**
 * The shared inline style objects for the Project Builder, built from
 * BRAND: fields, labels, hints, chips, buttons, cards, the assist strip,
 * the status line and the dock panel. Barlow Condensed for display and DM
 * Sans for text through the layout's CSS variables. Layout rules that need
 * media queries or pseudo elements live in globals.css under `.pb-*`.
 */
import type { CSSProperties } from "react";
import { BRAND } from "@/app/lib/brand";

export const CONDENSED = "var(--font-barlow-condensed), sans-serif";
export const SANS = "var(--font-dm-sans), sans-serif";

export const TINT = "#DCF0E5";
export const DOCK_BODY = "#D6EDE3";
export const DOCK_RULE = "#4A8E8E";
export const WARN = "#8A4B00";
export const WARN_BG = "#FFF3E0";

export const field: CSSProperties = {
  width: "100%",
  background: BRAND.white,
  border: `2px solid ${BRAND.border}`,
  borderRadius: 0,
  padding: "11px 12px",
  fontSize: 16,
  lineHeight: 1.45,
  fontFamily: SANS,
  color: BRAND.darkGreen,
  outline: "none",
  boxSizing: "border-box",
};

export const textarea: CSSProperties = { ...field, minHeight: 100, resize: "vertical" };

export const select: CSSProperties = { ...field, appearance: "auto" };

export const label: CSSProperties = {
  display: "block",
  fontWeight: 700,
  fontSize: 16,
  color: BRAND.darkGreen,
  marginBottom: 6,
  fontFamily: SANS,
};

export const hint: CSSProperties = { fontSize: 14, lineHeight: 1.5, color: BRAND.teal, margin: "-2px 0 8px", fontFamily: SANS };

export const fieldWrap: CSSProperties = { margin: "0 0 22px" };

export const h2: CSSProperties = { fontFamily: CONDENSED, fontWeight: 600, color: BRAND.darkGreen, fontSize: 34, lineHeight: 1.1, margin: "0 0 8px" };

export const h3: CSSProperties = {
  fontFamily: CONDENSED,
  fontWeight: 600,
  color: BRAND.darkGreen,
  fontSize: 26,
  lineHeight: 1.15,
  margin: "40px 0 6px",
  paddingTop: 24,
  borderTop: `2px solid ${BRAND.border}`,
};

export const h3First: CSSProperties = { ...h3, marginTop: 8, paddingTop: 0, borderTop: "none" };

export const lede: CSSProperties = { margin: "0 0 20px", maxWidth: "62ch", fontSize: 16, lineHeight: 1.5, color: BRAND.teal, fontFamily: SANS };

export const chips: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8 };

export function chip(pressed: boolean): CSSProperties {
  return {
    border: `2px solid ${pressed ? BRAND.darkGreen : BRAND.border}`,
    background: pressed ? BRAND.darkGreen : BRAND.white,
    color: pressed ? BRAND.white : BRAND.darkGreen,
    padding: "8px 14px",
    cursor: "pointer",
    fontSize: 15,
    fontFamily: SANS,
    borderRadius: 0,
  };
}

export const btn: CSSProperties = {
  border: `2px solid ${BRAND.darkGreen}`,
  background: BRAND.darkGreen,
  color: BRAND.white,
  padding: "11px 18px",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 16,
  fontFamily: SANS,
  borderRadius: 0,
};

export const btnAlt: CSSProperties = { ...btn, background: "transparent", color: BRAND.darkGreen };

export const btnSmall: CSSProperties = { ...btn, padding: "7px 14px", fontSize: 15 };

export const btnAltSmall: CSSProperties = { ...btnAlt, padding: "7px 14px", fontSize: 15 };

export const btnDisabled: CSSProperties = { opacity: 0.5, cursor: "not-allowed" };

export const ghost: CSSProperties = {
  background: "none",
  border: 0,
  color: BRAND.teal,
  textDecoration: "underline",
  textUnderlineOffset: 3,
  cursor: "pointer",
  padding: 6,
  fontSize: 15,
  fontFamily: SANS,
};

export const starter: CSSProperties = {
  border: `1px dashed ${BRAND.teal}`,
  background: "transparent",
  color: BRAND.teal,
  padding: "4px 10px",
  fontSize: 14,
  cursor: "pointer",
  fontFamily: SANS,
};

/** A feature or capability card; `pri` colours the border and the left bar. */
export function card(pri: string): CSSProperties {
  const must = pri === "Must";
  return {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    textAlign: "left",
    background: BRAND.white,
    border: `2px solid ${must ? BRAND.darkGreen : pri === "Should" ? BRAND.teal : BRAND.border}`,
    boxShadow: must ? `inset 6px 0 0 ${BRAND.brandGreen}` : "none",
    padding: "14px 14px 16px",
    cursor: "pointer",
    color: BRAND.teal,
    minHeight: 112,
    fontFamily: SANS,
    borderRadius: 0,
  };
}

export const cardTitle: CSSProperties = { display: "block", color: BRAND.darkGreen, fontSize: 17, fontWeight: 700, marginBottom: 4, paddingRight: 64 };
export const cardBody: CSSProperties = { fontSize: 14, lineHeight: 1.35, display: "block" };

export function cardPri(pri: string): CSSProperties {
  return {
    position: "absolute",
    top: 12,
    right: 12,
    fontFamily: CONDENSED,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: 1,
    textTransform: "uppercase",
    padding: "2px 7px",
    background: pri === "Must" ? BRAND.darkGreen : pri === "Should" ? TINT : "transparent",
    color: pri === "Must" ? BRAND.white : pri === "Should" ? BRAND.darkGreen : BRAND.teal,
    border: pri === "Should" ? `1px solid ${BRAND.teal}` : pri === "Could" ? `1px dashed ${BRAND.teal}` : "none",
  };
}

export function path(pressed: boolean): CSSProperties {
  return {
    textAlign: "left",
    background: pressed ? BRAND.darkGreen : BRAND.white,
    border: `2px solid ${pressed ? BRAND.darkGreen : BRAND.border}`,
    padding: 18,
    cursor: "pointer",
    color: pressed ? DOCK_BODY : BRAND.teal,
    fontFamily: SANS,
    fontSize: 15,
    lineHeight: 1.45,
    borderRadius: 0,
  };
}

export function pathTitle(pressed: boolean): CSSProperties {
  return { display: "block", fontSize: 19, fontWeight: 700, color: pressed ? BRAND.white : BRAND.darkGreen, marginBottom: 4 };
}

export const assist: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  background: TINT,
  borderLeft: `5px solid ${BRAND.brandGreen}`,
  padding: "12px 16px",
  margin: "0 0 6px",
};

export const assistText: CSSProperties = { margin: 0, fontSize: 15, color: BRAND.darkGreen, flex: "1 1 240px", fontFamily: SANS, lineHeight: 1.45 };

export const status: CSSProperties = { fontSize: 15, margin: "6px 0 18px", minHeight: "1.4em", color: BRAND.darkGreen, fontFamily: SANS, lineHeight: 1.45 };

export const err: CSSProperties = { color: WARN, background: WARN_BG, padding: "8px 12px", fontSize: 15, margin: "0 0 14px", fontFamily: SANS };

export const panel: CSSProperties = { background: BRAND.white, border: `2px solid ${BRAND.border}`, padding: 20, margin: "0 0 20px" };

export const panelTitle: CSSProperties = { fontFamily: CONDENSED, fontWeight: 600, color: BRAND.darkGreen, fontSize: 22, margin: "0 0 6px" };

export const tag: CSSProperties = {
  display: "inline-block",
  fontFamily: CONDENSED,
  fontSize: 12,
  letterSpacing: 1,
  textTransform: "uppercase",
  padding: "1px 7px",
  border: `1px solid ${BRAND.teal}`,
  color: BRAND.darkGreen,
};

export const pbtn: CSSProperties = {
  fontFamily: CONDENSED,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: "uppercase",
  border: `1px solid ${BRAND.teal}`,
  background: TINT,
  color: BRAND.darkGreen,
  padding: "3px 8px",
  cursor: "pointer",
  minWidth: 68,
};

export const dockPanel: CSSProperties = { background: BRAND.darkGreen, color: DOCK_BODY, fontFamily: SANS };

export const dockLabel: CSSProperties = {
  fontFamily: CONDENSED,
  fontWeight: 500,
  color: BRAND.brandGreen,
  fontSize: 14,
  letterSpacing: 2,
  textTransform: "uppercase",
};

export const page: CSSProperties = { background: BRAND.white, color: BRAND.teal, fontFamily: SANS, fontSize: 16, lineHeight: 1.45 };

export const wrap: CSSProperties = { maxWidth: 920, margin: "0 auto", padding: "0 16px 64px" };
