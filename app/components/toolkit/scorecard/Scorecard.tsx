import type { CSSProperties, ReactNode } from "react";
import { BRAND } from "@/app/lib/brand";
import {
  AUTOMATED_LINE,
  LOCKED_COMMENT,
  QUICK_NOTE,
  isCompositeFullView,
  type CompositeFreeView,
  type CompositeFullView,
  type CompositeRow,
} from "@/app/lib/tools/built-to-scale-method";

/**
 * The dark Built to Scale? scorecard: total out of 25, band, verdict, five
 * rows with dots and grades, strongest and weakest, and in the full view
 * the comments and the one change. Pure presentational: no hooks, no
 * fetches, no client directive, so the client page and the server result
 * page (and the Release 4 report pages) render the same panel. The working
 * for each row is a slot the owner of the data fills.
 */
export interface ScorecardProps {
  view: CompositeFreeView | CompositeFullView;
  /** Rendered beneath the headline; defaults to AUTOMATED_LINE. */
  label?: string;
  /** Called per row only when the view is full. */
  renderWorking?: (row: CompositeRow) => ReactNode;
  /** Hides strongest, weakest and the one change (report embeds). */
  compact?: boolean;
}

const CONDENSED = "var(--font-barlow-condensed), sans-serif";
const SANS = "var(--font-dm-sans), sans-serif";

const eyebrowStyle: CSSProperties = {
  fontFamily: CONDENSED,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: BRAND.brandGreen,
  margin: 0,
};

const cellLabelStyle: CSSProperties = {
  fontFamily: CONDENSED,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.6)",
  margin: "0 0 6px",
};

function Dots({ grade }: { grade: number }) {
  return (
    <span className="bts-dots" role="img" aria-label={`${grade} of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            width: 10,
            height: 10,
            borderRadius: "50%",
            boxSizing: "border-box",
            background: i < grade ? BRAND.brandGreen : "transparent",
            border: i < grade ? "none" : "1.5px solid rgba(255,255,255,0.3)",
          }}
        />
      ))}
    </span>
  );
}

export default function Scorecard({ view, label = AUTOMATED_LINE, renderWorking, compact = false }: ScorecardProps) {
  const full = isCompositeFullView(view) ? view : null;
  return (
    <section
      className="bts-panel"
      aria-label="Built to Scale? scorecard"
      style={{ background: BRAND.darkGreen, borderRadius: 12, color: BRAND.white, fontFamily: SANS }}
    >
      <div style={{ marginBottom: 20 }}>
        <p style={eyebrowStyle}>Built to Scale?</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
          <span className="bts-total" style={{ fontFamily: CONDENSED, fontWeight: 700, lineHeight: 1, color: BRAND.white }}>{view.total}</span>
          <span style={{ fontSize: 18, color: "rgba(255,255,255,0.6)" }}>of 25</span>
        </div>
        <p style={{ fontFamily: CONDENSED, fontSize: 22, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", margin: "8px 0 0", color: BRAND.white }}>
          {view.band}
        </p>
        <p style={{ fontSize: 17, lineHeight: 1.5, maxWidth: 640, margin: "12px 0 0", color: BRAND.white }}>{view.verdict}</p>
        {view.quickMode && (
          <p style={{ fontSize: 13, lineHeight: 1.5, margin: "10px 0 0", color: "rgba(255,255,255,0.7)" }}>{QUICK_NOTE}</p>
        )}
        {label && <p style={{ fontSize: 12, lineHeight: 1.5, margin: "10px 0 0", color: "rgba(255,255,255,0.6)" }}>{label}</p>}
      </div>

      <div className="bts-rows">
        {view.rows.map((row) => (
          <div key={row.key} className="bts-row">
            <span style={{ fontSize: 15, fontWeight: 600, color: BRAND.white, lineHeight: 1.3 }}>{row.name}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
              <Dots grade={row.grade} />
              <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "baseline", gap: 2 }}>
                <span style={{ fontFamily: CONDENSED, fontSize: 28, fontWeight: 700, lineHeight: 1, color: BRAND.white }}>{row.grade}</span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>/5</span>
              </span>
            </span>
            <div className="bts-row-comment">
              {typeof row.comment === "string" ? (
                <p style={{ fontSize: 14, lineHeight: 1.55, margin: 0, color: "rgba(255,255,255,0.85)" }}>{row.comment}</p>
              ) : (
                <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, fontStyle: "italic", color: "rgba(255,255,255,0.5)" }}>{LOCKED_COMMENT}</p>
              )}
              {full && renderWorking ? renderWorking(row) : null}
            </div>
          </div>
        ))}
      </div>

      {!compact && (
        <div className="bts-pair" style={{ marginTop: 20 }}>
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "14px 16px" }}>
            <p style={cellLabelStyle}>Strongest</p>
            <p style={{ fontSize: 14, lineHeight: 1.55, margin: 0, color: BRAND.white }}>{view.strongest}</p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "14px 16px" }}>
            <p style={cellLabelStyle}>Weakest</p>
            <p style={{ fontSize: 14, lineHeight: 1.55, margin: 0, color: BRAND.white }}>{view.weakest}</p>
          </div>
        </div>
      )}

      {!compact && full && (
        <div style={{ marginTop: 16, padding: "14px 16px", borderLeft: `3px solid ${BRAND.brandGreen}`, background: "rgba(255,255,255,0.04)", borderRadius: "0 8px 8px 0" }}>
          <p style={cellLabelStyle}>The one change</p>
          <p style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.55, margin: 0, color: BRAND.white }}>{full.oneChange}</p>
        </div>
      )}
    </section>
  );
}
