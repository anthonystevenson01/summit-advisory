import { PUBLIC_TOOLS, getTool, isToolPublic, type ToolSlug } from "@/app/lib/tools/registry";
import { listRuns, type RunRecord } from "@/app/lib/runs";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

const TOOL_COLOURS: Record<string, string> = {
  icp: "#D4A017",
  persona: "#0891b2",
  problem: "#7c3aed",
  positioning: "#16a34a",
  moat: "#005A66",
};

function scoreColour(score0to100: number): string {
  if (score0to100 >= 70) return "#27ae60";
  if (score0to100 >= 50) return "#D4A017";
  return "#C0392B";
}

function formatDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleString("en-GB", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const th = {
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 600 as const,
  color: "#053030",
  textAlign: "left" as const,
  borderBottom: "2px solid #D0D5D2",
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
};

const td = {
  padding: "10px 12px",
  fontSize: 13,
  color: "#1A1A1A",
  borderBottom: "1px solid #E8ECE9",
  verticalAlign: "top" as const,
};

const chipStyle = (active: boolean, colour: string) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  borderRadius: 16,
  fontSize: 12,
  fontWeight: 600,
  textDecoration: "none",
  border: `1px solid ${active ? colour : "#D0D5D2"}`,
  background: active ? `${colour}15` : "#fff",
  color: active ? colour : "#666",
});

function RunDetail({ run }: { run: RunRecord }) {
  const entry = getTool(run.tool);
  return (
    <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6 }}>
      <strong style={{ color: "#053030" }}>Inputs</strong>
      {(entry?.inputs ?? []).map((input) => {
        const value = run.inputs[input.key];
        if (!value) return null;
        return (
          <div key={input.key} style={{ marginTop: 6 }}>
            <div style={{ fontWeight: 600, color: "#053030" }}>{input.label}</div>
            <pre style={{ margin: "4px 0 0", fontSize: 11, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#F5F7F6", padding: 10, borderRadius: 4, maxHeight: 300, overflow: "auto" }}>
              {value}
            </pre>
          </div>
        );
      })}

      <div style={{ marginTop: 12, borderTop: "1px solid #E8ECE9", paddingTop: 8 }}>
        <strong style={{ color: "#053030" }}>Dimensions</strong>
        {(entry?.dimensions ?? []).map((d) => {
          const s = run.scores[d.key];
          const level = d.levels[s as 1 | 2 | 3 | 4 | 5] ?? "";
          const reasoning = run.dimensionReasoning?.[d.key];
          return (
            <div key={d.key} style={{ marginTop: 6 }}>
              <span style={{ fontWeight: 600, color: "#053030" }}>{d.name}</span>{" "}
              <span style={{ color: scoreColour((s ?? 0) * 20), fontWeight: 600 }}>{s ?? "?"}/5</span>{" "}
              <span style={{ color: "#666" }}>{level}</span>
              {reasoning && <div style={{ color: "#666", marginTop: 2 }}>{reasoning}</div>}
            </div>
          );
        })}
      </div>

      {run.extras && Object.keys(run.extras).length > 0 && (
        <div style={{ marginTop: 12, borderTop: "1px solid #E8ECE9", paddingTop: 8 }}>
          <strong style={{ color: "#053030" }}>Extras</strong>
          {(entry?.extras ?? []).map((x) => {
            const value = run.extras?.[x.key];
            if (value === undefined) return null;
            return (
              <div key={x.key} style={{ marginTop: 6 }}>
                <div style={{ fontWeight: 600, color: "#053030" }}>{x.label}</div>
                {typeof value === "string" ? (
                  <div style={{ color: "#666" }}>{value}</div>
                ) : Array.isArray(value) ? (
                  <ol style={{ margin: "2px 0 0", paddingLeft: 18 }}>
                    {value.map((item, i) => <li key={i}>{item}</li>)}
                  </ol>
                ) : (
                  // A structured extra (the ceiling inputs): the raw object is the honest view of what was stored.
                  <pre style={{ margin: "2px 0 0", fontSize: 12, fontFamily: "monospace", whiteSpace: "pre-wrap", color: "#666" }}>
                    {JSON.stringify(value, null, 1)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}

      {run.recommendations && run.recommendations.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "1px solid #E8ECE9", paddingTop: 8 }}>
          <strong style={{ color: "#053030" }}>Recommendations</strong>
          {run.recommendations.map((rec, j) => (
            <div key={j} style={{ marginTop: 6, paddingLeft: 8, borderLeft: "2px solid #D4A017" }}>
              <div style={{ fontWeight: 600, color: "#053030" }}>{rec.name} ({rec.score}/5)</div>
              <div><strong>Gap:</strong> {rec.gap}</div>
              <div><strong>Consequence:</strong> {rec.consequence}</div>
              <div><strong>Action:</strong> {rec.action}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12, borderTop: "1px solid #E8ECE9", paddingTop: 8, color: "#666" }}>
        <div>Run {run.id}</div>
        <div>Rubric hash {run.rubricHash.slice(0, 12)}{run.detailsRubricHash ? ` (details ${run.detailsRubricHash.slice(0, 12)})` : ""}</div>
        <div>Routes {Object.entries(run.routes).map(([k, v]) => `${k}: ${v}`).join(", ") || "none"}</div>
        <div>Calibrated {Object.entries(run.calibrated).map(([k, v]) => `${k}: ${v ? "yes" : "no"}`).join(", ") || "none"}</div>
        {run.confidenceReason && <div>Confidence reason: {run.confidenceReason}</div>}
      </div>
    </div>
  );
}

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ tool?: string; page?: string }>;
}) {
  const { tool: toolParam, page: pageParam } = await searchParams;
  const toolFilter: ToolSlug | undefined = toolParam && isToolPublic(toolParam) ? toolParam : undefined;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  let runs: RunRecord[] = [];
  let total = 0;
  let loadError = false;
  try {
    const result = await listRuns({ tool: toolFilter, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
    runs = result.runs;
    total = result.total;
  } catch (err) {
    console.error("Admin runs Redis error", err instanceof Error ? err.message : err);
    loadError = true;
  }

  const query = (overrides: { tool?: string; page?: number }) => {
    const params = new URLSearchParams();
    const t = overrides.tool !== undefined ? overrides.tool : toolFilter;
    if (t) params.set("tool", t);
    const p = overrides.page ?? 1;
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/admin/runs${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
        <h1 style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 28, fontWeight: 600, color: "#053030", margin: 0 }}>
          Runs
        </h1>
        <span style={{ fontSize: 13, color: "#666" }}>
          {total.toLocaleString()} in the store &middot; page {page}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <a href={query({ tool: "" })} style={chipStyle(!toolFilter, "#053030")}>All</a>
        {PUBLIC_TOOLS.map((t) => (
          <a key={t.slug} href={query({ tool: t.slug })} style={chipStyle(toolFilter === t.slug, TOOL_COLOURS[t.slug] ?? "#053030")}>
            {t.name}
          </a>
        ))}
      </div>

      {loadError ? (
        <p style={{ color: "#C0392B", fontSize: 14 }}>The run store could not be read. Check the Upstash variables.</p>
      ) : runs.length === 0 ? (
        <p style={{ color: "#666", fontSize: 14 }}>{toolFilter ? `No runs for ${getTool(toolFilter)?.name} yet.` : "No runs yet."}</p>
      ) : (
        <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Tool</th>
                  <th style={th}>Score</th>
                  <th style={th}>Grade</th>
                  <th style={th}>Confidence</th>
                  <th style={th}>Rubric</th>
                  <th style={th}>Model</th>
                  <th style={th}>Unlock</th>
                  <th style={th}>Details</th>
                  <th style={th}>Open</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const colour = TOOL_COLOURS[run.tool] ?? "#666";
                  const name = getTool(run.tool)?.name ?? run.tool;
                  return (
                    <tr key={run.id}>
                      <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12, color: "#666" }}>{formatDate(run.createdAt)}</td>
                      <td style={td}>
                        <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4, background: `${colour}18`, color: colour }}>
                          {name}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>
                        <span style={{ fontFamily: "var(--font-oswald), sans-serif", fontWeight: 600, fontSize: 16, color: scoreColour(run.score) }}>{run.score}</span>
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>{run.grade}/5</td>
                      <td style={td}>{run.confidence}</td>
                      <td style={{ ...td, fontSize: 12, color: "#666" }}>v{run.rubricVersion}</td>
                      <td style={{ ...td, fontSize: 12, color: "#666" }}>{run.models.scoring ?? ""}</td>
                      <td style={td}>
                        {run.unlock ? (
                          <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                            <div style={{ fontWeight: 600 }}>{run.unlock.name}</div>
                            <div style={{ color: "#005A66" }}>{run.unlock.email}</div>
                            <div style={{ color: "#666" }}>{run.unlock.company}</div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "#999" }}>Not unlocked</span>
                        )}
                      </td>
                      <td style={{ ...td, fontSize: 12, color: run.detailsAt ? "#27ae60" : "#999" }}>{run.detailsAt ? "Yes" : "No"}</td>
                      <td style={{ ...td, minWidth: 320 }}>
                        <details>
                          <summary style={{ cursor: "pointer", color: "#005A66", fontSize: 12, fontWeight: 600 }}>
                            {run.verdict ? run.verdict.slice(0, 80) : "View"}
                          </summary>
                          <RunDetail run={run} />
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 16, fontSize: 13 }}>
        {page > 1 && <a href={query({ page: page - 1 })} style={{ color: "#005A66", fontWeight: 600 }}>Previous page</a>}
        {runs.length === PAGE_SIZE && <a href={query({ page: page + 1 })} style={{ color: "#005A66", fontWeight: 600 }}>Next page</a>}
      </div>
    </div>
  );
}
