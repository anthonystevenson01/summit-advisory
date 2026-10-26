import { getToolRuns, isCompositeRun, listRuns, type CompositeRunRecord } from "@/app/lib/runs";
import { BUILT_TO_SCALE_TOOL } from "@/app/lib/tools/built-to-scale-method";
import { StatusLines, buttonStyle, formatDateTime, h1Style, td, th } from "../admin-report-ui";

export const dynamic = "force-dynamic";

const PAIN_PREVIEW = 80;
const QUICK_TITLE = "Quick mode run: the working was made from one description";

type Row = { run: CompositeRunRecord; stored: number; children: number };

function painPreview(run: CompositeRunRecord): string {
  const text = (run.quickMode ? run.inputs.description : run.inputs.pain) ?? "";
  return text.length > PAIN_PREVIEW ? `${text.slice(0, PAIN_PREVIEW).trimEnd()}…` : text;
}

/**
 * The twenty most recent composite runs with a "Create report" button each.
 * The working count tells Anthony whether to open the run's full view first:
 * a report reads the children's stored working and never produces it.
 */
export default async function NewReportPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  let rows: Row[] = [];
  let loadError = false;
  try {
    const { runs } = await listRuns({ tool: BUILT_TO_SCALE_TOOL, limit: 20, offset: 0 });
    const composites = runs.filter(isCompositeRun);
    rows = await Promise.all(
      composites.map(async (run) => {
        const ids = Object.values(run.children);
        const children = await getToolRuns(ids);
        return { run, stored: children.filter((c) => c.detailsAt).length, children: ids.length };
      }),
    );
  } catch (err) {
    console.error("Admin new report Redis error", err instanceof Error ? err.message : err);
    loadError = true;
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ ...h1Style, marginBottom: 6 }}>New report</h1>
        <p style={{ fontSize: 13, color: "#666", margin: 0, maxWidth: 680, lineHeight: 1.6 }}>
          Pick the Built to Scale? run to build the report from. Open the run&apos;s full view first so every tool&apos;s working is stored.
        </p>
      </div>
      <StatusLines error={error} />

      {loadError ? (
        <p style={{ color: "#C0392B", fontSize: 14 }}>The run store could not be read. Check the Upstash variables.</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "#666", fontSize: 14 }}>No Built to Scale? runs yet.</p>
      ) : (
        <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Total</th>
                  <th style={th}>Quick</th>
                  <th style={th}>Pain</th>
                  <th style={th}>Email</th>
                  <th style={th}>Working</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ run, stored, children }) => (
                  <tr key={run.id}>
                    <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12, color: "#666" }}>
                      {formatDateTime(run.createdAt)}
                      <div style={{ fontFamily: "monospace", fontSize: 11, color: "#999" }}>{run.id}</div>
                    </td>
                    <td style={td}>
                      <span style={{ fontFamily: "var(--font-barlow-condensed), sans-serif", fontWeight: 700, fontSize: 18, color: "#053030" }}>
                        {run.total}<span style={{ fontSize: 11, color: "#666", fontWeight: 400 }}>/25</span>
                      </span>
                      <div style={{ fontSize: 11, color: "#666" }}>{run.band}</div>
                    </td>
                    <td style={td}>
                      {run.quickMode && (
                        <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4, background: "#D4A01718", color: "#D4A017" }}>quick</span>
                      )}
                    </td>
                    <td style={{ ...td, minWidth: 260, color: "#666" }}>{painPreview(run)}</td>
                    <td style={{ ...td, fontSize: 12, color: "#005A66" }}>{run.unlock?.email ?? ""}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", color: stored === children ? "#27ae60" : "#D4A017" }}>
                      {stored} of {children} tools
                    </td>
                    <td style={td}>
                      <form action="/api/admin/reports" method="POST">
                        <input type="hidden" name="runId" value={run.id} />
                        <button type="submit" style={buttonStyle} title={run.quickMode ? QUICK_TITLE : undefined}>Create report</button>
                      </form>
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
