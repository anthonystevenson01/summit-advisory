import type { CSSProperties } from "react";
import type { ReportState } from "@/app/lib/tools/report-model";

/** The admin table and chip styles the three report pages share, in the runs page's style. */
export const th: CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 600,
  color: "#053030",
  textAlign: "left",
  borderBottom: "2px solid #D0D5D2",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

export const td: CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  color: "#1A1A1A",
  borderBottom: "1px solid #E8ECE9",
  verticalAlign: "top",
};

export const h1Style: CSSProperties = { fontFamily: "var(--font-oswald), sans-serif", fontSize: 28, fontWeight: 600, color: "#053030", margin: 0 };

export const buttonStyle: CSSProperties = {
  fontFamily: "var(--font-dm-sans), sans-serif",
  fontSize: 13,
  fontWeight: 600,
  padding: "8px 16px",
  borderRadius: 6,
  border: "none",
  background: "#319A65",
  color: "#fff",
  cursor: "pointer",
};

export const linkButtonStyle: CSSProperties = { ...buttonStyle, display: "inline-block", textDecoration: "none" };

const STATE_COLOURS: Record<ReportState, string> = { draft: "#666666", published: "#319A65", unpublished: "#D4A017" };

export function StateChip({ state }: { state: ReportState }) {
  const colour = STATE_COLOURS[state];
  return (
    <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4, background: `${colour}18`, color: colour }}>
      {state}
    </span>
  );
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleString("en-GB", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export const STATUS_LINES: Record<string, string> = {
  created: "Report created from the run. Give it a company name and a slug.",
  saved: "Saved.",
  published: "Published.",
  unpublished: "Unpublished.",
  reset: "Row reset to the run.",
  deleted: "Deleted.",
  exists: "A draft already exists for that run; this is it.",
  "not-found": "That report was not found.",
};

export const ERROR_LINES: Record<string, string> = {
  "slug-invalid": "The slug must be lowercase letters, digits and hyphens, 3 to 60 characters.",
  "slug-taken": "That slug is already in use.",
  "company-required": "Give the report a company name before publishing.",
  "asof-invalid": "Dates must be YYYY-MM-DD.",
  "expiry-invalid": "Dates must be YYYY-MM-DD.",
  "grade-invalid": "Grades must be whole numbers from 1 to 5.",
  "code-invalid": "An access code is 4 to 64 characters.",
  "run-not-found": "The run behind this report could not be read.",
  "not-found": "That report was not found.",
  failed: "The change could not be saved. Check the Redis variables.",
};

export function StatusLines({ status, error }: { status?: string; error?: string }) {
  const ok = status ? STATUS_LINES[status] : undefined;
  const bad = error ? ERROR_LINES[error] : undefined;
  if (!ok && !bad) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      {ok && <p style={{ margin: 0, fontSize: 13, color: "#319A65", fontWeight: 600 }}>{ok}</p>}
      {bad && <p style={{ margin: 0, fontSize: 13, color: "#C0392B", fontWeight: 600 }}>{bad}</p>}
    </div>
  );
}
