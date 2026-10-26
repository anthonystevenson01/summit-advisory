import { PUBLIC_TOOLS, getTool } from "@/app/lib/tools/registry";
import { getCompositeRun, getRun, isCompositeRun, isRunId, listRuns, type CompositeRunRecord, type RunRecord, type StoredRun } from "@/app/lib/runs";
import { BTS_PARTS, BUILT_TO_SCALE_TOOL } from "@/app/lib/tools/built-to-scale-method";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;
const BTS_LABEL = "Built to Scale?";

const TOOL_COLOURS: Record<string, string> = {
  icp: "#D4A017",
  persona: "#0891b2",
  problem: "#7c3aed",
  positioning: "#16a34a",
  moat: "#005A66",
  "route-to-buyer": "#b45309",
  "unit-of-value": "#0f766e",
  [BUILT_TO_SCALE_TOOL]: "#319A65",
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

const preStyle = {
  margin: "4px 0 0",
  fontSize: 11,
  lineHeight: 1.5,
  whiteSpace: "pre-wrap" as const,
  wordBreak: "break-word" as const,
  background: "#F5F7F6",
  padding: 10,
  borderRadius: 4,
  maxHeight: 300,
  overflow: "auto",
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

function runLink(id: string): string {
  return `/admin/runs?id=${encodeURIComponent(id)}`;
}

function Footer({ run }: { run: StoredRun }) {
  return (
    <div style={{ marginTop: 12, borderTop: "1px solid #E8ECE9", paddingTop: 8, color: "#666" }}>
      <div>Run {run.id}</div>
      {!isCompositeRun(run) && run.parentId && (
        <div>
          child of <a href={runLink(run.parentId)} style={{ color: "#005A66" }}>{run.parentId}</a>
        </div>
      )}
      <div>
        Rubric hash {run.rubricHash.slice(0, 12)}
        {!isCompositeRun(run) && run.detailsRubricHash ? ` (details ${run.detailsRubricHash.slice(0, 12)})` : ""}
      </div>
      <div>Routes {Object.entries(run.routes).map(([k, v]) => `${k}: ${v}`).join(", ") || "none"}</div>
      <div>Calibrated {Object.entries(run.calibrated).map(([k, v]) => `${k}: ${v ? "yes" : "no"}`).join(", ") || "none"}</div>
      {run.confidenceReason && <div>Confidence reason: {run.confidenceReason}</div>}
    </div>
  );
}

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
            <pre style={preStyle}>{value}</pre>
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

      <Footer run={run} />
    </div>
  );
}

function CompositeDetail({ run }: { run: CompositeRunRecord }) {
  return (
    <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6 }}>
      <strong style={{ color: "#053030" }}>Inputs{run.quickMode ? " (quick mode)" : ""}</strong>
      {run.quickMode ? (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontWeight: 600, color: "#053030" }}>Business description</div>
          <pre style={preStyle}>{run.inputs.description ?? ""}</pre>
        </div>
      ) : (
        BTS_PARTS.map((part) => {
          const value = run.inputs[part.key];
          if (!value) return null;
          return (
            <div key={part.key} style={{ marginTop: 6 }}>
              <div style={{ fontWeight: 600, color: "#053030" }}>{part.label}</div>
              <pre style={preStyle}>{value}</pre>
            </div>
          );
        })
      )}

      <div style={{ marginTop: 12, borderTop: "1px solid #E8ECE9", paddingTop: 8 }}>
        <strong style={{ color: "#053030" }}>Rows</strong>
        {BTS_PARTS.map((part) => {
          const row = run.rows.find((r) => r.key === part.key);
          return (
            <div key={part.key} style={{ marginTop: 6 }}>
              <span style={{ fontWeight: 600, color: "#053030" }}>{part.name}</span>{" "}
              <span style={{ color: scoreColour((row?.grade ?? 0) * 20), fontWeight: 600 }}>{row?.grade ?? "?"} of 5</span>
              {row?.comment && <div style={{ color: "#666", marginTop: 2 }}>{row.comment}</div>}
            </div>
          );
        })}
        <div style={{ marginTop: 8 }}><strong>Strongest:</strong> {run.strongest}</div>
        <div><strong>Weakest:</strong> {run.weakest}</div>
        <div><strong>One change:</strong> {run.oneChange}</div>
      </div>

      <div style={{ marginTop: 12, borderTop: "1px solid #E8ECE9", paddingTop: 8 }}>
        <strong style={{ color: "#053030" }}>Children</strong>
        {Object.entries(run.children).map(([slug, childId]) => (
          <div key={slug} style={{ marginTop: 4 }}>
            {getTool(slug)?.name ?? slug}: <a href={runLink(childId)} style={{ color: "#005A66" }}>{childId}</a>
          </div>
        ))}
        {run.absentTools.length > 0 && (
          <div style={{ marginTop: 6, color: "#666" }}>
            Absent tools: {run.absentTools.map((slug) => getTool(slug)?.name ?? slug).join(", ")}
          </div>
        )}
      </div>

      <Footer run={run} />
    </div>
  );
}

function RunRow({ run }: { run: StoredRun }) {
  const composite = isCompositeRun(run);
  const colour = TOOL_COLOURS[run.tool] ?? "#666";
  const name = composite ? BTS_LABEL : getTool(run.tool)?.name ?? run.tool;
  return (
    <tr>
      <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12, color: "#666" }}>{formatDate(run.createdAt)}</td>
      <td style={td}>
        <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4, background: `${colour}18`, color: colour }}>
          {name}
        </span>
      </td>
      <td style={{ ...td, textAlign: "center" }}>
        {composite ? (
          <span style={{ fontFamily: "var(--font-oswald), sans-serif", fontWeight: 600, fontSize: 16, color: scoreColour(run.total * 4) }}>
            {run.total}<span style={{ fontSize: 11, color: "#666", fontWeight: 400 }}>/25</span>
          </span>
        ) : (
          <span style={{ fontFamily: "var(--font-oswald), sans-serif", fontWeight: 600, fontSize: 16, color: scoreColour(run.score) }}>{run.score}</span>
        )}
      </td>
      <td style={{ ...td, textAlign: composite ? "left" : "center", fontSize: composite ? 12 : 13 }}>{composite ? run.band : `${run.grade}/5`}</td>
      <td style={td}>{run.confidence}</td>
      <td style={{ ...td, fontSize: 12, color: "#666" }}>v{run.rubricVersion}</td>
      <td style={{ ...td, fontSize: 12, color: "#666" }}>{composite ? run.models.synthesis ?? "" : run.models.scoring ?? ""}</td>
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
          {composite ? <CompositeDetail run={run} /> : <RunDetail run={run} />}
        </details>
      </td>
    </tr>
  );
}

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ tool?: string; page?: string; id?: string }>;
}) {
  const { tool: toolParam, page: pageParam, id: idParam } = await searchParams;
  const publicSlugs = new Set<string>(PUBLIC_TOOLS.map((t) => t.slug));
  const toolFilter = toolParam && (publicSlugs.has(toolParam) || toolParam === BUILT_TO_SCALE_TOOL) ? toolParam : undefined;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const singleId = isRunId(idParam) ? idParam : undefined;

  let runs: StoredRun[] = [];
  let total = 0;
  let loadError = false;
  try {
    if (singleId) {
      const run = (await getRun(singleId)) ?? (await getCompositeRun(singleId));
      runs = run ? [run] : [];
      total = runs.length;
    } else {
      const result = await listRuns({ tool: toolFilter, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
      runs = result.runs;
      total = result.total;
    }
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

  const filterName = toolFilter === BUILT_TO_SCALE_TOOL ? BTS_LABEL : toolFilter ? getTool(toolFilter)?.name : undefined;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
        <h1 style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 28, fontWeight: 600, color: "#053030", margin: 0 }}>
          Runs
        </h1>
        <span style={{ fontSize: 13, color: "#666" }}>
          {singleId ? (
            <a href="/admin/runs" style={{ color: "#005A66", fontWeight: 600 }}>All runs</a>
          ) : (
            <>{total.toLocaleString()} in the store &middot; page {page}</>
          )}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <a href={query({ tool: "" })} style={chipStyle(!toolFilter && !singleId, "#053030")}>All</a>
        {PUBLIC_TOOLS.map((t) => (
          <a key={t.slug} href={query({ tool: t.slug })} style={chipStyle(toolFilter === t.slug, TOOL_COLOURS[t.slug] ?? "#053030")}>
            {t.name}
          </a>
        ))}
        <a href={query({ tool: BUILT_TO_SCALE_TOOL })} style={chipStyle(toolFilter === BUILT_TO_SCALE_TOOL, TOOL_COLOURS[BUILT_TO_SCALE_TOOL])}>
          {BTS_LABEL}
        </a>
      </div>

      {loadError ? (
        <p style={{ color: "#C0392B", fontSize: 14 }}>The run store could not be read. Check the Upstash variables.</p>
      ) : runs.length === 0 ? (
        <p style={{ color: "#666", fontSize: 14 }}>
          {singleId ? `Run ${singleId} was not found. It may have expired.` : filterName ? `No runs for ${filterName} yet.` : "No runs yet."}
        </p>
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
                {runs.map((run) => <RunRow key={run.id} run={run} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!singleId && (
        <div style={{ display: "flex", gap: 12, marginTop: 16, fontSize: 13 }}>
          {page > 1 && <a href={query({ page: page - 1 })} style={{ color: "#005A66", fontWeight: 600 }}>Previous page</a>}
          {runs.length === PAGE_SIZE && <a href={query({ page: page + 1 })} style={{ color: "#005A66", fontWeight: 600 }}>Next page</a>}
        </div>
      )}
    </div>
  );
}
