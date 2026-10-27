import type { CSSProperties } from "react";
import { isPaused } from "@/app/lib/ask-summit/admin";
import { confidenceSummary, isStaleProcessing, type AskRequestRecord, type AskRequestState } from "@/app/lib/ask-summit/request-model";
import { listAskRequests } from "@/app/lib/ask-summit/store";
import { StatusLines, buttonStyle, formatDate, formatDateTime, h1Style, td, th } from "../reports/admin-report-ui";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string; error?: string }>;

const STATE_COLOURS: Record<AskRequestState, string> = { queued: "#666666", processing: "#005A66", done: "#319A65", failed: "#C0392B" };

const chipStyle = (colour: string): CSSProperties => ({
  display: "inline-block",
  fontSize: 11,
  fontWeight: 600,
  padding: "3px 8px",
  borderRadius: 4,
  background: `${colour}18`,
  color: colour,
  marginRight: 6,
});

const smallButton: CSSProperties = { ...buttonStyle, fontSize: 12, padding: "6px 12px" };
const dangerButton: CSSProperties = { ...smallButton, background: "#fff", color: "#C0392B", border: "1px solid #C0392B" };
const linkStyle: CSSProperties = { color: "#005A66", fontWeight: 600, textDecoration: "none" };

/** The ids of processing records older than the stale rule, read once per render. */
function staleIds(requests: AskRequestRecord[]): Set<string> {
  const now = Date.now();
  return new Set(requests.filter((r) => isStaleProcessing(r, now)).map((r) => r.id));
}

function sizeLabel(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timingsTitle(record: AskRequestRecord): string {
  const t = record.timings;
  if (!t) return "";
  return `crawl ${(t.crawl / 1000).toFixed(1)} s, documents ${(t.documents / 1000).toFixed(1)} s, extraction ${(t.extraction / 1000).toFixed(1)} s, scoring ${(t.scoring / 1000).toFixed(1)} s, report ${(t.report / 1000).toFixed(1)} s`;
}

/**
 * The Ask Summit queue: every request newest first with its state, company,
 * domain, email, files, pages, confidence, timings, data status, report
 * link and the Process now and Delete data controls, plus the global
 * pause switch. Every control is a plain form POST answered with a 303
 * back here carrying `?status=` or `?error=`.
 */
export default async function AskSummitQueuePage({ searchParams }: { searchParams: SearchParams }) {
  const { status, error } = await searchParams;
  let requests: AskRequestRecord[] = [];
  let stale = new Set<string>();
  let paused = false;
  let loadError = false;
  try {
    const [list, pausedFlag] = await Promise.all([listAskRequests({ limit: 100 }), isPaused()]);
    requests = list.requests;
    stale = staleIds(requests);
    paused = pausedFlag;
  } catch (err) {
    console.error("Admin ask-summit Redis error", err instanceof Error ? err.message : err);
    loadError = true;
  }
  const counts = { queued: 0, processing: 0, done: 0, failed: 0 };
  for (const r of requests) counts[r.state] += 1;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, gap: 16, flexWrap: "wrap" }}>
        <h1 style={h1Style}>Ask Summit</h1>
        <p style={{ fontSize: 13, color: "#666", margin: 0 }}>
          {counts.queued} queued, {counts.processing} processing, {counts.failed} failed, {counts.done} done
        </p>
      </div>

      <div style={{ background: "#fff", borderRadius: 10, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <span style={chipStyle(paused ? "#D4A017" : "#319A65")}>{paused ? "Paused" : "Taking requests"}</span>
        <form method="POST" action="/api/admin/ask-summit" style={{ margin: 0 }}>
          <input type="hidden" name="action" value={paused ? "resume" : "pause"} />
          <button type="submit" style={paused ? smallButton : { ...smallButton, background: "#D4A017" }}>{paused ? "Resume" : "Pause"}</button>
        </form>
        <span style={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}>
          Paused makes the form and the submit route answer that Summit is not taking requests. Queued requests are not processed while paused; press Process now after resuming.
        </span>
      </div>

      <StatusLines status={status} error={error} />

      {loadError ? (
        <p style={{ color: "#C0392B", fontSize: 14 }}>The request store could not be read. Check the Upstash variables.</p>
      ) : requests.length === 0 ? (
        <p style={{ color: "#666", fontSize: 14 }}>No requests yet.</p>
      ) : (
        <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>State</th>
                  <th style={th}>Company</th>
                  <th style={th}>Domain</th>
                  <th style={th}>Email</th>
                  <th style={th}>Files</th>
                  <th style={th}>Pages</th>
                  <th style={th}>Confidence</th>
                  <th style={th}>Timings</th>
                  <th style={th}>Data</th>
                  <th style={th}>Report</th>
                  <th style={th}>Attempts</th>
                  <th style={th}>Created</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const isStale = stale.has(r.id);
                  const canProcess = !r.dataDeleted && (r.state === "queued" || r.state === "failed" || isStale);
                  const fileTitle = r.files.map((f) => `${f.name} (${sizeLabel(f.size)})`).join("\n");
                  return (
                    <tr key={r.id}>
                      <td style={td}>
                        <span style={chipStyle(STATE_COLOURS[r.state])}>{r.state}</span>
                        {isStale && <span style={chipStyle("#D4A017")}>stale</span>}
                        {r.enqueueError && <span style={chipStyle("#D4A017")}>needs Process now</span>}
                        {r.state === "failed" && (
                          <div style={{ fontSize: 11, color: "#C0392B", marginTop: 4, maxWidth: 240, lineHeight: 1.5 }}>
                            {r.failedStage ?? "unknown stage"}: {r.failedMessage ?? "no message"}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: "#999", fontFamily: "monospace", marginTop: 4 }}>{r.id}</div>
                      </td>
                      <td style={{ ...td, fontWeight: 600, color: "#053030" }}>{r.companyName || r.company || "Unknown"}</td>
                      <td style={td}>
                        <a href={r.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>{r.host}</a>
                      </td>
                      <td style={{ ...td, fontSize: 12 }}>
                        {r.email}
                        {r.name && <div style={{ color: "#666" }}>{r.name}</div>}
                      </td>
                      <td style={{ ...td, fontSize: 12 }} title={fileTitle}>
                        {r.files.length}
                        {r.files[0] && <div style={{ color: "#666", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.files[0].name}</div>}
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>{r.pageCount}</td>
                      <td style={{ ...td, fontSize: 12, whiteSpace: "nowrap" }}>{confidenceSummary(r)}</td>
                      <td style={{ ...td, fontSize: 12, whiteSpace: "nowrap" }} title={timingsTitle(r)}>
                        {r.timings ? `${(r.timings.total / 1000).toFixed(0)} s` : ""}
                      </td>
                      <td style={{ ...td, fontSize: 12, whiteSpace: "nowrap" }}>
                        {r.dataDeleted ? `deleted ${formatDate(r.dataDeletedAt)}` : `until ${formatDate(r.deleteAt)}`}
                      </td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        {r.reportSlug && <a href={`/admin/reports/${r.reportSlug}`} style={{ ...linkStyle, marginRight: 10 }}>Edit</a>}
                        {r.runId && <a href={`/admin/runs?id=${encodeURIComponent(r.runId)}`} style={linkStyle}>Run</a>}
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>{r.attempts}</td>
                      <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12, color: "#666" }}>{formatDateTime(r.createdAt)}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        {canProcess && (
                          <form method="POST" action={`/api/admin/ask-summit/${r.id}`} style={{ display: "inline-block", margin: "0 6px 6px 0" }}>
                            <input type="hidden" name="action" value="process" />
                            <button type="submit" style={smallButton}>Process now</button>
                          </form>
                        )}
                        {!r.dataDeleted && (
                          <form method="POST" action={`/api/admin/ask-summit/${r.id}`} style={{ display: "inline-block", margin: 0 }}>
                            <input type="hidden" name="action" value="delete" />
                            <button type="submit" style={dangerButton}>Delete data</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
