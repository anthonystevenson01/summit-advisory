"use client";

import type { ReactNode } from "react";
import { BRAND } from "@/app/lib/brand";

export type ExtraValue = string | string[];

export interface ExtraRendererProps {
  label: string;
  value: ExtraValue;
}

const headingStyle = {
  fontFamily: "var(--font-oswald), sans-serif",
  fontSize: 14,
  fontWeight: 600 as const,
  color: BRAND.teal,
  margin: "0 0 10px",
  letterSpacing: "0.04em",
  textTransform: "uppercase" as const,
};

const panelStyle = {
  background: BRAND.white,
  borderRadius: 8,
  padding: "18px 20px",
  marginBottom: 14,
  border: `1px solid ${BRAND.border}`,
};

function text(value: ExtraValue): string {
  return Array.isArray(value) ? value.join(" ") : value;
}

function GenericText({ label, value }: ExtraRendererProps) {
  return (
    <div style={panelStyle}>
      <h4 style={headingStyle}>{label}</h4>
      <p style={{ fontSize: 14, color: BRAND.dark, lineHeight: 1.65, margin: 0 }}>{text(value)}</p>
    </div>
  );
}

function GenericList({ label, value }: ExtraRendererProps) {
  const items = Array.isArray(value) ? value : [value];
  return (
    <div style={panelStyle}>
      <h4 style={headingStyle}>{label}</h4>
      <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item, i) => (
          <li key={i} style={{ fontSize: 14, color: BRAND.dark, lineHeight: 1.6 }}>{item}</li>
        ))}
      </ol>
    </div>
  );
}

function Priority({ label, value }: ExtraRendererProps) {
  return (
    <div style={{ ...panelStyle, borderLeft: `3px solid ${BRAND.brandGreen}` }}>
      <h4 style={headingStyle}>{label}</h4>
      <p style={{ fontSize: 15, color: BRAND.darkGreen, lineHeight: 1.6, margin: 0, fontWeight: 500 }}>{text(value)}</p>
    </div>
  );
}

function Rewrite({ label, value }: ExtraRendererProps) {
  return (
    <div style={{ ...panelStyle, background: BRAND.lightTeal, borderColor: `${BRAND.teal}40` }}>
      <h4 style={headingStyle}>{label}</h4>
      <p style={{ fontSize: 15, color: BRAND.darkGreen, lineHeight: 1.65, margin: 0, fontStyle: "italic" }}>
        &ldquo;{text(value)}&rdquo;
      </p>
    </div>
  );
}

function KeyQuestion({ label, value }: ExtraRendererProps) {
  return (
    <div style={{ ...panelStyle, borderLeft: `3px solid ${BRAND.amber}` }}>
      <h4 style={headingStyle}>{label}</h4>
      <p style={{ fontSize: 16, color: BRAND.darkGreen, lineHeight: 1.5, margin: 0, fontWeight: 600 }}>{text(value)}</p>
    </div>
  );
}

/**
 * Renderers keyed by extra name. A key with no renderer falls back to a
 * generic labelled paragraph or list, so a new registry extra never breaks
 * the page.
 */
export const EXTRA_RENDERERS: Record<string, (props: ExtraRendererProps) => ReactNode> = {
  priority: Priority,
  rewrite: Rewrite,
  biggestGap: GenericText,
  keyQuestion: KeyQuestion,
  validationMoves: GenericList,
};

export function renderExtra(key: string, label: string, value: ExtraValue): ReactNode {
  const Renderer = EXTRA_RENDERERS[key] ?? (Array.isArray(value) ? GenericList : GenericText);
  return <Renderer key={key} label={label} value={value} />;
}
