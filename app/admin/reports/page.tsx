import Link from "next/link";
import { listReports } from "@/app/lib/reports";
import { isExpired, type ReportRecord } from "@/app/lib/tools/report-model";
import { StateChip, StatusLines, formatDate, formatDateTime, h1Style, linkButtonStyle, td, th } from "./admin-report-ui";

export const dynamic = "force-dynamic";

function ExpiryCell({ report }: { report: ReportRecord }) {
  if (!report.expiresAt) return <span style={{ color: "#999" }}>on publish</span>;
  if (isExpired(report)) return <span style={{ color: "#C0392B", fontWeight: 600 }}>expired</span>;
  return <>{formatDate(report.expiresAt)}</>;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ status?: string; error?: string }> }) {
  const { status, error } = await searchParams;
  let reports: ReportRecord[] = [];
  let loadError = false;
  try {
    reports = await listReports();
  } catch (err) {
    console.error("Admin reports Redis error", err instanceof Error ? err.message : err);
    loadError = true;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <h1 style={h1Style}>Reports</h1>
        <Link href="/admin/reports/new" style={linkButtonStyle}>New report</Link>
      </div>
      <StatusLines status={status} error={error} />

      {loadError ? (
        <p style={{ color: "#C0392B", fontSize: 14 }}>The report store could not be read. Check the Upstash variables.</p>
      ) : reports.length === 0 ? (
        <p style={{ color: "#666", fontSize: 14 }}>No reports yet.</p>
      ) : (
        <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Company</th>
                  <th style={th}>Slug</th>
                  <th style={th}>State</th>
                  <th style={th}>Total</th>
                  <th style={th}>Expiry</th>
                  <th style={th}>Opens</th>
                  <th style={th}>Re-runs</th>
                  <th style={th}>Updated</th>
                  <th style={th}>Links</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.slug}>
                    <td style={{ ...td, fontWeight: 600, color: report.company ? "#053030" : "#999" }}>{report.company || "Untitled"}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{report.slug}</td>
                    <td style={td}><StateChip state={report.state} /></td>
                    <td style={td}>
                      <span style={{ fontFamily: "var(--font-barlow-condensed), sans-serif", fontWeight: 700, fontSize: 18, color: "#053030" }}>
                        {report.total}<span style={{ fontSize: 11, color: "#666", fontWeight: 400 }}>/25</span>
                      </span>
                      <div style={{ fontSize: 11, color: "#666" }}>{report.band}</div>
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}><ExpiryCell report={report} /></td>
                    <td style={{ ...td, textAlign: "center" }}>{report.openCount}</td>
                    <td style={{ ...td, textAlign: "center" }}>{report.rerunCount}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12, color: "#666" }}>{formatDateTime(report.updatedAt)}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      <a href={`/admin/reports/${report.slug}`} style={{ color: "#005A66", fontWeight: 600, marginRight: 12 }}>Edit</a>
                      <a href={`/report/${report.slug}`} style={{ color: "#005A66", fontWeight: 600 }}>View</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
