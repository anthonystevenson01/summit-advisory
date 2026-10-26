"use client";

import Link from "next/link";
import { BRAND } from "@/app/lib/brand";
import { getTool, isToolPublic } from "@/app/lib/tools/registry";
import type { CompositeRow, WorkingEntry } from "@/app/lib/tools/built-to-scale-method";
import { WORKING_NOT_STORED_LINE, reportRerunHref } from "@/app/lib/tools/report-model";
import GtmDimensionBar from "../shared/GtmDimensionBar";
import { renderExtra } from "../shared/extras";

const FALLBACK_LINE = "The working for this tool could not be produced. Open the full view again to retry.";
const RERUN_LABEL = "Re-run this tool with these inputs";
const REPORT_RERUN_LABEL = "Re-run with your own inputs";

const headingStyle = {
  fontFamily: "var(--font-barlow-condensed), sans-serif",
  fontSize: 14,
  fontWeight: 700 as const,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  color: BRAND.teal,
  margin: "0 0 10px",
};

/**
 * The per row working expander on the full scorecard: one native details
 * element per feeding tool, holding that tool's full view (bars, reasoning,
 * extras, recommendations) on a light card so the existing tool renderers
 * read on the dark panel, and a re-run link into the tool with the same
 * inputs when the tool is public. On a Release 4 report page (`reportSlug`
 * set) the link reads "Re-run with your own inputs", carries the report
 * slug so the score counts as a report re-run, and still renders when the
 * child's working was never stored; without the prop nothing changes.
 */
export default function ScorecardWorking({ row, parentRunId, reportSlug }: { row: CompositeRow; parentRunId: string; reportSlug?: string }) {
  const working = row.working ?? [];
  if (working.length === 0) return null;
  return (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }} data-parent={parentRunId}>
      {working.map((entry) => (
        <WorkingDetails key={entry.runId} entry={entry} reportSlug={reportSlug} />
      ))}
    </div>
  );
}

function RerunLink({ entry, reportSlug }: { entry: WorkingEntry; reportSlug?: string }) {
  if (!isToolPublic(entry.tool)) return null;
  const href = reportSlug ? reportRerunHref(entry.tool, entry.runId, reportSlug) : `/tools/${entry.tool}?prefill=${encodeURIComponent(entry.runId)}`;
  return (
    <p style={{ fontSize: 13, margin: "12px 0 0" }}>
      <Link href={href} style={{ color: BRAND.teal, fontWeight: 600, textDecoration: "none" }}>
        {reportSlug ? REPORT_RERUN_LABEL : RERUN_LABEL}
      </Link>
    </p>
  );
}

function WorkingDetails({ entry, reportSlug }: { entry: WorkingEntry; reportSlug?: string }) {
  const tool = getTool(entry.tool);
  const full = entry.full;
  return (
    <details style={{ background: BRAND.white, borderRadius: 8, color: BRAND.dark }}>
      <summary style={{ cursor: "pointer", padding: "12px 16px", fontSize: 13, fontWeight: 600, color: BRAND.darkGreen, listStyle: "revert" }}>
        Working: Tool {entry.number} {entry.name}
        {full ? (
          <span style={{ fontWeight: 400, color: BRAND.mid }}>
            {" "}{full.score} of 100, grade {full.grade} of 5
          </span>
        ) : null}
      </summary>
      <div style={{ padding: "0 16px 16px" }}>
        {!full || !tool ? (
          <>
            <p style={{ fontSize: 13, color: BRAND.mid, margin: 0, lineHeight: 1.55 }}>{reportSlug ? WORKING_NOT_STORED_LINE : FALLBACK_LINE}</p>
            {reportSlug ? <RerunLink entry={entry} reportSlug={reportSlug} /> : null}
          </>
        ) : (
          <>
            <p style={{ fontSize: 14, color: BRAND.dark, lineHeight: 1.55, margin: "0 0 4px", fontWeight: 500 }}>{full.verdict}</p>
            <p style={{ fontSize: 12, color: BRAND.mid, lineHeight: 1.5, margin: "0 0 16px" }}>
              Grade {full.grade} of 5, {full.gradeLabel}{full.legacyLabel ? ` (${full.legacyLabel})` : ""}. Confidence {full.confidence}: {full.confidenceReason}
            </p>

            {tool.dimensions.map((dim) => {
              const score = full.scores[dim.key] ?? 0;
              const level = dim.levels[score as 1 | 2 | 3 | 4 | 5] ?? "";
              const reasoning = full.reasoning?.[dim.key];
              return (
                <div key={dim.key}>
                  <GtmDimensionBar name={dim.name} score={score} levelLabel={level} locked={false} />
                  {reasoning && (
                    <div style={{ marginTop: -8, marginBottom: 16, marginLeft: 2, padding: "8px 12px", background: BRAND.lightBg, borderRadius: 6, borderLeft: `2px solid ${BRAND.teal}40` }}>
                      <p style={{ fontSize: 12, color: BRAND.mid, lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>{reasoning}</p>
                    </div>
                  )}
                </div>
              );
            })}

            {tool.extras.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {tool.extras.map((x) => {
                  const value = full.extras?.[x.key];
                  if (value === undefined || (Array.isArray(value) && value.length === 0) || value === "") return null;
                  return renderExtra(x.key, x.label, value);
                })}
              </div>
            )}

            <div style={{ marginTop: 8 }}>
              <h4 style={headingStyle}>Recommendations</h4>
              {full.recommendations.length === 0 ? (
                <p style={{ fontSize: 13, color: BRAND.mid, margin: 0 }}>All dimensions scored 4 or above. No recommendations needed.</p>
              ) : (
                full.recommendations.map((rec, i) => (
                  <div key={i} style={{ background: BRAND.lightBg, borderRadius: 8, padding: 16, marginBottom: 10, borderLeft: `3px solid ${rec.score <= 2 ? BRAND.red : BRAND.amber}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                      <span style={{ fontFamily: "var(--font-barlow-condensed), sans-serif", fontWeight: 700, fontSize: 14, color: BRAND.darkGreen }}>{rec.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 12, background: rec.score <= 2 ? "#FFEBEE" : "#FFF8E1", color: rec.score <= 2 ? BRAND.red : BRAND.amber }}>
                        {rec.score}/5
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: BRAND.dark, lineHeight: 1.55, margin: "0 0 6px" }}><strong>Gap:</strong> {rec.gap}</p>
                    <p style={{ fontSize: 13, color: BRAND.mid, lineHeight: 1.55, margin: "0 0 6px" }}><strong style={{ color: BRAND.dark }}>Consequence:</strong> {rec.consequence}</p>
                    <p style={{ fontSize: 13, color: BRAND.teal, lineHeight: 1.55, margin: 0 }}><strong>Next action:</strong> {rec.action}</p>
                  </div>
                ))
              )}
            </div>

            <RerunLink entry={entry} reportSlug={reportSlug} />
          </>
        )}
      </div>
    </details>
  );
}
