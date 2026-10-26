import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import RowsEditor, { type EditorRow } from "./RowsEditor";
import SlugField from "./SlugField";
import { getReport } from "@/app/lib/reports";
import { getCompositeRun, getToolRuns } from "@/app/lib/runs";
import { BTS_PARTS } from "@/app/lib/tools/built-to-scale-method";
import { isPlaceholderSlug, isValidSlug } from "@/app/lib/tools/report-model";
import { StateChip, StatusLines, buttonStyle, formatDate, formatDateTime, h1Style } from "../admin-report-ui";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ status?: string; error?: string }>;

const fieldStyle: CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 6,
  border: "1px solid #D0D5D2",
  fontSize: 14,
  fontFamily: "var(--font-dm-sans), sans-serif",
  color: "#1A1A1A",
  background: "#fff",
  boxSizing: "border-box",
  lineHeight: 1.5,
};

const labelStyle: CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#053030", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" };
const hintStyle: CSSProperties = { fontSize: 11, color: "#666", margin: "4px 0 0", lineHeight: 1.5 };
const sectionStyle: CSSProperties = { background: "#fff", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 };
const h2Style: CSSProperties = { fontFamily: "var(--font-oswald), sans-serif", fontSize: 16, fontWeight: 600, color: "#053030", margin: "0 0 14px" };
const linkStyle: CSSProperties = { color: "#005A66", fontWeight: 600, textDecoration: "none" };

const TEXT_HINT = "Paragraphs separated by a blank line. The slide shows the first paragraph of the opening and about 400 characters per box.";

/**
 * The editor: one form posting to /api/admin/reports/{slug} with the
 * action on the button pressed (save, publish, unpublish, reset:{key}).
 * The working count is read from the run so Anthony knows whether to open
 * the full view before sending the report; the rows themselves come from
 * the report record, which stores the run's originals, so the editor
 * renders with the run gone.
 */
export default async function ReportEditorPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { slug } = await params;
  const { status, error } = await searchParams;
  if (!isValidSlug(slug)) notFound();
  const report = await getReport(slug);
  if (!report) notFound();

  let runFound = false;
  let stored = 0;
  let children = 0;
  let quickMode = false;
  try {
    const run = await getCompositeRun(report.runId);
    if (run) {
      runFound = true;
      quickMode = run.quickMode;
      const ids = Object.values(run.children);
      children = ids.length;
      stored = (await getToolRuns(ids)).filter((c) => c.detailsAt).length;
    }
  } catch (err) {
    console.error("Admin report editor run read error", err instanceof Error ? err.message : err);
  }

  const rows: EditorRow[] = report.rows.map((row) => ({
    key: row.key,
    name: BTS_PARTS.find((p) => p.key === row.key)?.name ?? row.key,
    grade: row.grade,
    comment: row.comment,
    originalGrade: row.original.grade,
    originalComment: row.original.comment,
    edited: row.edited,
    hasOriginal: row.original.comment.length > 0 || row.original.grade > 1,
  }));

  const opens = report.openCount === 0
    ? "Not opened yet"
    : `Opened ${report.openCount} ${report.openCount === 1 ? "time" : "times"}, first on ${formatDateTime(report.firstOpenedAt)}, last on ${formatDateTime(report.lastOpenedAt)}`;
  const reruns = `re-run ${report.rerunCount} ${report.rerunCount === 1 ? "time" : "times"}`;
  const expiresOn = report.expiresAt ? report.expiresAt.slice(0, 10) : "";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <h1 style={h1Style}>
            {report.company || "Untitled report"}{" "}
            <span style={{ fontSize: 14, fontFamily: "monospace", color: "#666", fontWeight: 400 }}>{report.slug}</span>{" "}
            <StateChip state={report.state} />
          </h1>
          <p style={{ fontSize: 13, color: "#666", margin: "8px 0 0", lineHeight: 1.6 }}>
            <strong style={{ color: "#053030" }}>{report.total} of 25</strong>, {report.band}
            {quickMode && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: "#D4A017" }}>quick mode run</span>}
            <br />
            {opens}; {reruns}.
            <br />
            {report.publishedAt ? `Published ${formatDateTime(report.publishedAt)}` : "Not published"}
            {report.expiresAt ? `, expires ${formatDate(report.expiresAt)}` : ""}.
            <br />
            {runFound ? (
              <>
                Working stored for {stored} of {children} tools.
                {stored < children && " Open the full view on the result page to store the rest."}
              </>
            ) : (
              <span style={{ color: "#C0392B", fontWeight: 600 }}>Run not found.</span>
            )}
          </p>
        </div>
        <p style={{ fontSize: 13, margin: 0, display: "flex", gap: 14, flexWrap: "wrap" }}>
          <a href={`/report/${report.slug}`} style={linkStyle}>Public page</a>
          <a href={`/report/${report.slug}/slide`} style={linkStyle}>Slide</a>
          <a href={`/report/${report.slug}/opengraph-image`} style={linkStyle}>Image</a>
          <a href={`/admin/runs?id=${encodeURIComponent(report.runId)}`} style={linkStyle}>Run</a>
          <Link href="/admin/reports" style={linkStyle}>All reports</Link>
        </p>
      </div>
      <StatusLines status={status} error={error} />

      <form method="POST" action={`/api/admin/reports/${report.slug}`}>
        {/* The default submit on Enter, ahead of the reset buttons in tree order. */}
        <button type="submit" name="action" value="save" style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />

        <div style={sectionStyle}>
          <h2 style={h2Style}>Report</h2>
          <SlugField company={report.company} slug={report.slug} isPlaceholder={isPlaceholderSlug(report.slug)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 16 }}>
            <div>
              <label htmlFor="report-asof" style={labelStyle}>As of</label>
              <input id="report-asof" name="asOf" type="date" defaultValue={report.asOf} style={fieldStyle} />
            </div>
            <div>
              <label htmlFor="report-state" style={labelStyle}>State</label>
              <select id="report-state" name="state" defaultValue={report.state} style={fieldStyle}>
                <option value="draft">draft</option>
                <option value="published">published</option>
                <option value="unpublished">unpublished</option>
              </select>
            </div>
            <div>
              <label htmlFor="report-expires" style={labelStyle}>Expires</label>
              <input id="report-expires" name="expiresAt" type="date" defaultValue={expiresOn} style={fieldStyle} />
              <p style={hintStyle}>Blank means 30 days from publish.</p>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <p style={labelStyle}>Access code: {report.accessCode ? "set" : "not set"}</p>
            <input
              name="accessCode"
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="New code, 4 to 64 characters, not case sensitive; leave blank to keep"
              style={fieldStyle}
            />
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1A1A1A", marginTop: 8 }}>
              <input type="checkbox" name="clearAccessCode" value="1" />
              Remove the access code
            </label>
          </div>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Commentary</h2>
          <label htmlFor="report-opening" style={labelStyle}>Opening paragraph</label>
          <textarea id="report-opening" name="opening" defaultValue={report.opening} style={{ ...fieldStyle, minHeight: 140, resize: "vertical" }} />
          <p style={hintStyle}>{TEXT_HINT}</p>
          <label htmlFor="report-product" style={{ ...labelStyle, marginTop: 16 }}>Product thoughts</label>
          <textarea id="report-product" name="productThoughts" defaultValue={report.productThoughts} style={{ ...fieldStyle, minHeight: 200, resize: "vertical" }} />
          <p style={hintStyle}>{TEXT_HINT}</p>
          <label htmlFor="report-moonshot" style={{ ...labelStyle, marginTop: 16 }}>Moonshot</label>
          <textarea id="report-moonshot" name="moonshot" defaultValue={report.moonshot} style={{ ...fieldStyle, minHeight: 140, resize: "vertical" }} />
          <p style={hintStyle}>{TEXT_HINT}</p>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Scorecard</h2>
          <RowsEditor rows={rows} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" name="action" value="save" style={buttonStyle}>Save</button>
            {report.state === "published" ? (
              <button type="submit" name="action" value="unpublish" style={{ ...buttonStyle, background: "#D4A017" }}>Unpublish</button>
            ) : (
              <button type="submit" name="action" value="publish" style={{ ...buttonStyle, background: "#053030" }}>Publish</button>
            )}
          </div>
          <a
            href={`/admin/reports/${report.slug}/delete`}
            style={{ fontSize: 13, fontWeight: 600, padding: "7px 16px", borderRadius: 6, border: "1px solid #C0392B", color: "#C0392B", textDecoration: "none" }}
          >
            Delete
          </a>
        </div>
      </form>
    </div>
  );
}
