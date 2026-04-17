import { getRedis } from "@/app/lib/redis";

export const dynamic = "force-dynamic";

type GtmTool = "persona" | "problem" | "positioning" | "moat";

type GtmSubmission = {
  id: string;
  tool: GtmTool;
  inputText: string;
  totalScore: number;
  scores: Record<string, number>;
  submittedAt: string;
};

type GtmUnlock = {
  id: string | null;
  tool: string | null;
  name: string;
  email: string;
  company: string;
  unlockedAt: string;
};

type GtmDetails = {
  dimensionReasoning: Array<{ dim: string; score: number; reasoning: string }>;
  recommendations: Array<{ dim: string; score: number; gap: string; consequence: string; action: string }>;
};

// Per-tool dimension key → short label (keeps table chips compact)
const DIMENSION_NAMES: Record<GtmTool, Record<string, string>> = {
  persona: { pc: "PC", da: "DA", sp: "SP", re: "RE", jf: "JF", fm: "FM" },
  problem: { pa: "PA", me: "ME", ug: "UG", ad: "AD", cg: "CG", ms: "MS" },
  positioning: { di: "DI", sp: "SP", mf: "MF", cl: "CL", cr: "CR", er: "ER" },
  moat: { sc: "SC", pd: "PD", ne: "NE", br: "BR", sd: "SD", pr: "PR" },
};

// Full names for the expanded details panel
const DIMENSION_FULL_NAMES: Record<GtmTool, Record<string, string>> = {
  persona: {
    pc: "Pain Clarity", da: "Decision Authority", sp: "Specificity",
    re: "Reachability", jf: "Job-to-be-Done Fit", fm: "Finite Market Alignment",
  },
  problem: {
    pa: "Problem Acuity", me: "Market Evidence", ug: "Urgency",
    ad: "Addressability", cg: "Competitive Gap", ms: "Monetisation Signal",
  },
  positioning: {
    di: "Differentiation", sp: "Specificity", mf: "Market Fit",
    cl: "Clarity", cr: "Credibility", er: "Emotional Resonance",
  },
  moat: {
    sc: "Switching Cost", pd: "Product Differentiation", ne: "Network / Data Effect",
    br: "Brand & Relationships", sd: "Speed & Execution", pr: "Price Defensibility",
  },
};

const TOOL_COLORS: Record<GtmTool, string> = {
  persona: "#0891b2",     // cyan
  problem: "#7c3aed",     // purple
  positioning: "#16a34a", // green
  moat: "#D4A017",        // amber
};

const TOOL_LABELS: Record<GtmTool, string> = {
  persona: "Persona",
  problem: "Problem",
  positioning: "Positioning",
  moat: "Moat",
};

function scoreColor(score0to100: number): string {
  // Re-use ICP's 0-5 color thresholds — totalScore is 0-100 (weighted × 20)
  const fiveScale = score0to100 / 20;
  if (fiveScale >= 4) return "#27ae60";
  if (fiveScale >= 3) return "#D4A017";
  return "#C0392B";
}

function isGtmTool(value: string): value is GtmTool {
  return value === "persona" || value === "problem" || value === "positioning" || value === "moat";
}

export default async function GtmSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tool?: string }>;
}) {
  const { tool: toolParam } = await searchParams;
  const toolFilter: GtmTool | null = toolParam && isGtmTool(toolParam) ? toolParam : null;

  let submissions: GtmSubmission[] = [];
  let unlocks: GtmUnlock[] = [];
  const detailsMap = new Map<string, GtmDetails>();

  try {
    const redis = getRedis();
    const [rawSubs, rawUnlocks] = await Promise.all([
      redis.lrange("gtm-submissions", 0, -1),
      redis.lrange("gtm-unlocks", 0, -1),
    ]);
    submissions = rawSubs
      .map((r) => (typeof r === "string" ? JSON.parse(r) : r) as GtmSubmission)
      .reverse();
    unlocks = rawUnlocks.map((r) => (typeof r === "string" ? JSON.parse(r) : r) as GtmUnlock);

    // Batch-fetch all cached details. Keys that never ran Sonnet (or TTL'd out) come back null.
    const detailKeys = submissions.map((s) => `gtm-details:${s.tool}:${s.id}`);
    if (detailKeys.length > 0) {
      const rawDetails = await redis.mget<(GtmDetails | string | null)[]>(...detailKeys);
      rawDetails.forEach((raw, i) => {
        if (!raw) return;
        try {
          const parsed = typeof raw === "string" ? (JSON.parse(raw) as GtmDetails) : raw;
          detailsMap.set(submissions[i].id, parsed);
        } catch {
          // skip malformed entries
        }
      });
    }
  } catch (err) {
    console.error("Admin GTM Redis error", err);
  }

  // Unlock lookup by submission id
  const unlockMap = new Map<string, GtmUnlock>();
  for (const u of unlocks) {
    if (u.id) unlockMap.set(u.id, u);
  }

  // Per-tool counts (for filter chip badges) — computed before filtering
  const toolCounts: Record<GtmTool, number> = { persona: 0, problem: 0, positioning: 0, moat: 0 };
  for (const s of submissions) {
    if (isGtmTool(s.tool)) toolCounts[s.tool]++;
  }

  const filtered = toolFilter ? submissions.filter((s) => s.tool === toolFilter) : submissions;
  const filteredUnlockCount = toolFilter
    ? unlocks.filter((u) => u.tool === toolFilter).length
    : unlocks.length;

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

  const chipStyle = (active: boolean, color: string) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 16,
    fontSize: 12,
    fontWeight: 600,
    textDecoration: "none",
    border: `1px solid ${active ? color : "#D0D5D2"}`,
    background: active ? `${color}15` : "#fff",
    color: active ? color : "#666",
    cursor: "pointer",
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
        <h1 style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 28, fontWeight: 600, color: "#053030", margin: 0 }}>
          GTM Submissions
        </h1>
        <span style={{ fontSize: 13, color: "#666" }}>
          {filtered.length} scored &middot; {filteredUnlockCount} emails captured
        </span>
      </div>

      {/* Tool filter chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <a href="/admin/gtm" style={chipStyle(!toolFilter, "#053030")}>
          All <span style={{ opacity: 0.6 }}>({submissions.length})</span>
        </a>
        {(Object.keys(TOOL_LABELS) as GtmTool[]).map((t) => (
          <a key={t} href={`/admin/gtm?tool=${t}`} style={chipStyle(toolFilter === t, TOOL_COLORS[t])}>
            {TOOL_LABELS[t]} <span style={{ opacity: 0.6 }}>({toolCounts[t]})</span>
          </a>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: "#666", fontSize: 14 }}>
          {toolFilter ? `No submissions for ${TOOL_LABELS[toolFilter]} yet.` : "No GTM submissions yet."}
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
                  <th style={th}>Dimensions</th>
                  <th style={th}>Input</th>
                  <th style={th}>Contact</th>
                  <th style={th}>Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sub) => {
                  const unlock = unlockMap.get(sub.id);
                  const details = detailsMap.get(sub.id);
                  const toolColor = isGtmTool(sub.tool) ? TOOL_COLORS[sub.tool] : "#666";
                  const toolLabel = isGtmTool(sub.tool) ? TOOL_LABELS[sub.tool] : sub.tool;
                  const dimShort = isGtmTool(sub.tool) ? DIMENSION_NAMES[sub.tool] : {};
                  const dimFull = isGtmTool(sub.tool) ? DIMENSION_FULL_NAMES[sub.tool] : {};
                  return (
                    <tr key={sub.id}>
                      <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12, color: "#666" }}>
                        {sub.submittedAt
                          ? new Date(sub.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })
                          : "—"}
                      </td>
                      <td style={td}>
                        <span
                          style={{
                            display: "inline-block",
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: 4,
                            background: `${toolColor}18`,
                            color: toolColor,
                          }}
                        >
                          {toolLabel}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            fontFamily: "var(--font-oswald), sans-serif",
                            fontWeight: 600,
                            fontSize: 16,
                            color: scoreColor(sub.totalScore),
                          }}
                        >
                          {sub.totalScore}
                        </span>
                      </td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {Object.entries(sub.scores).map(([key, val]) => (
                            <span
                              key={key}
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: `${scoreColor(val * 20)}18`,
                                color: scoreColor(val * 20),
                              }}
                            >
                              {dimShort[key] || key.toUpperCase()} {val}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ ...td, maxWidth: 250 }}>
                        <details>
                          <summary style={{ cursor: "pointer", color: "#005A66", fontSize: 12, fontWeight: 600 }}>
                            {sub.inputText.slice(0, 60)}...
                          </summary>
                          <pre
                            style={{
                              marginTop: 8,
                              fontSize: 11,
                              lineHeight: 1.5,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              background: "#F5F7F6",
                              padding: 10,
                              borderRadius: 4,
                              maxHeight: 300,
                              overflow: "auto",
                            }}
                          >
                            {sub.inputText}
                          </pre>
                        </details>
                      </td>
                      <td style={td}>
                        {unlock ? (
                          <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                            <div style={{ fontWeight: 600 }}>{unlock.name}</div>
                            <div style={{ color: "#005A66" }}>{unlock.email}</div>
                            <div style={{ color: "#666" }}>{unlock.company}</div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "#999" }}>Not unlocked</span>
                        )}
                      </td>
                      <td style={td}>
                        {details ? (
                          <details>
                            <summary style={{ cursor: "pointer", color: "#005A66", fontSize: 12, fontWeight: 600 }}>
                              View
                            </summary>
                            <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6 }}>
                              {details.dimensionReasoning?.map((dr) => (
                                <div key={dr.dim} style={{ marginBottom: 8 }}>
                                  <strong style={{ color: "#053030" }}>
                                    {dimFull[dr.dim] || dr.dim.toUpperCase()} ({dr.score}/5):
                                  </strong>{" "}
                                  <span style={{ color: "#666" }}>{dr.reasoning}</span>
                                </div>
                              ))}
                              {details.recommendations?.length > 0 && (
                                <div style={{ marginTop: 12, borderTop: "1px solid #E8ECE9", paddingTop: 8 }}>
                                  <strong style={{ color: "#053030" }}>Recommendations:</strong>
                                  {details.recommendations.map((rec, j) => (
                                    <div key={j} style={{ marginTop: 6, paddingLeft: 8, borderLeft: "2px solid #D4A017" }}>
                                      <div style={{ fontWeight: 600, color: "#053030" }}>{rec.dim} ({rec.score}/5)</div>
                                      <div><strong>Gap:</strong> {rec.gap}</div>
                                      <div><strong>Action:</strong> {rec.action}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </details>
                        ) : (
                          <span style={{ fontSize: 12, color: "#999" }}>Not unlocked</span>
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
