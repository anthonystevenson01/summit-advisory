import { notFound } from "next/navigation";
import { getReport } from "@/app/lib/reports";
import { isValidSlug } from "@/app/lib/tools/report-model";
import { buttonStyle, h1Style } from "../../admin-report-ui";

export const dynamic = "force-dynamic";

/** The confirm step before a delete: one sentence, one button, one way back. */
export default async function DeleteReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();
  const report = await getReport(slug);
  if (!report) notFound();

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ ...h1Style, marginBottom: 12 }}>Delete this report?</h1>
      <p style={{ fontSize: 14, color: "#1A1A1A", lineHeight: 1.6, margin: "0 0 8px" }}>
        <strong>{report.company || "Untitled report"}</strong> <span style={{ fontFamily: "monospace", color: "#666" }}>{report.slug}</span>
      </p>
      <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, margin: "0 0 20px" }}>
        This deletes the report and its index entry. The composite run it was built from is kept. Unsaved edits on the editor are not kept.
      </p>
      <form method="POST" action={`/api/admin/reports/${report.slug}`} style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <input type="hidden" name="action" value="delete-confirmed" />
        <button type="submit" style={{ ...buttonStyle, background: "#C0392B" }}>Delete the report</button>
        <a href={`/admin/reports/${report.slug}`} style={{ fontSize: 13, fontWeight: 600, color: "#005A66", textDecoration: "none" }}>Keep it</a>
      </form>
    </div>
  );
}
