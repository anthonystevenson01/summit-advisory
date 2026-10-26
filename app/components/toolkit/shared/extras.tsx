"use client";

import type { ReactNode } from "react";
import { BRAND } from "@/app/lib/brand";
import type { ExtraValue } from "@/app/lib/tools/schema";
import {
  CEILING_INPUT_KEYS,
  CEILING_INPUT_LABELS,
  computeCeiling,
  isCeilingInputs,
  isSupportedCeilingValue,
  unsupportedCeilingInputs,
  type CeilingInputs,
} from "@/app/lib/ceiling";

export type { ExtraValue };

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

/** A string as is, a list joined, anything else (an object extra) as an empty string. */
function text(value: ExtraValue): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join(" ");
  return "";
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
  const items = Array.isArray(value) ? value : [text(value)];
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

/** The party whose no costs most: amber left border, one weighted line. */
function Risk({ label, value }: ExtraRendererProps) {
  return (
    <div style={{ ...panelStyle, borderLeft: `3px solid ${BRAND.amber}` }}>
      <h4 style={headingStyle}>{label}</h4>
      <p style={{ fontSize: 15, color: BRAND.darkGreen, lineHeight: 1.6, margin: 0, fontWeight: 500 }}>{text(value)}</p>
    </div>
  );
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/** The three assumption rows, rendered whether or not the figure could be computed, so a null input is shown with its reason. */
function CeilingAssumptionRows({ inputs }: { inputs: CeilingInputs }) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
      {CEILING_INPUT_KEYS.map((key) => {
        const input = inputs[key];
        return (
          <li key={key} style={{ fontSize: 14, lineHeight: 1.55 }}>
            <span style={{ color: BRAND.dark, fontWeight: 600 }}>
              {CEILING_INPUT_LABELS[key]}:{" "}
              {isSupportedCeilingValue(input.value) ? (
                input.value.toLocaleString("en-GB")
              ) : (
                <span style={{ color: BRAND.mid, fontStyle: "italic", fontWeight: 400 }}>not supported by the text</span>
              )}
            </span>
            {input.assumption ? <span style={{ color: BRAND.mid }}> {input.assumption}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The revenue ceiling per head, computed in code from the three inputs the
 * model returned, with the assumptions beside it. When an input was not
 * supported by the text the figure is not computed and a plain sentence says
 * which inputs were missing.
 */
function Ceiling({ label, value }: ExtraRendererProps) {
  if (!isCeilingInputs(value)) return null;
  const result = computeCeiling(value);
  const missing = unsupportedCeilingInputs(value).map((key) => CEILING_INPUT_LABELS[key].toLowerCase());
  return (
    <div style={{ ...panelStyle, background: BRAND.lightTeal, borderColor: `${BRAND.teal}40` }}>
      <h4 style={headingStyle}>{label}</h4>
      {result ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 220px", minWidth: 220 }}>
            <div style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 28, color: BRAND.darkGreen, lineHeight: 1.2 }}>
              {result.formatted}
            </div>
            <div style={{ fontSize: 13, color: BRAND.mid, marginTop: 4 }}>per person per year</div>
          </div>
          <div style={{ flex: "2 1 280px", minWidth: 0 }}>
            <CeilingAssumptionRows inputs={value} />
          </div>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 14, color: BRAND.dark, lineHeight: 1.6, margin: "0 0 12px" }}>
            The ceiling cannot be computed because the text did not give {joinLabels(missing)}.
          </p>
          <CeilingAssumptionRows inputs={value} />
        </>
      )}
    </div>
  );
}

/**
 * Renderers keyed by extra name. A key with no renderer falls back to a
 * generic labelled paragraph or list, so a new registry extra never breaks
 * the page. An object value with no keyed renderer renders nothing.
 */
export const EXTRA_RENDERERS: Record<string, (props: ExtraRendererProps) => ReactNode> = {
  priority: Priority,
  rewrite: Rewrite,
  biggestGap: GenericText,
  keyQuestion: KeyQuestion,
  validationMoves: GenericList,
  gatekeeperRisk: Risk,
  channelMove: Priority,
  ceilingInputs: Ceiling,
  lever: Priority,
};

export function renderExtra(key: string, label: string, value: ExtraValue): ReactNode {
  const keyed = EXTRA_RENDERERS[key];
  const Renderer = keyed ?? (Array.isArray(value) ? GenericList : typeof value === "string" ? GenericText : null);
  if (!Renderer) return null;
  return <Renderer key={key} label={label} value={value} />;
}
