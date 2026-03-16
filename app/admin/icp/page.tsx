import { getRedis } from "@/app/lib/redis";

export const dynamic = "force-dynamic";

type IcpSubmission = {
  id: string;
  icpText: string;
  totalScore: number;
  scores: Record<string, number>;
  dimensionReasoning: Array<{ dim: string; score: number; reasoning: string }>;
  recommendations: Array<{ dim: string; score: number; gap: string; consequence: string; action: string }>;
  rubricLoaded: boolean;
  submittedAt: string;
};

type IcpUnlock = {
  id: string | null;
  name: string;
  email: string;
  company: string;
  unlockedAt: string;
};

const DIMENSION_NAMES: Record<string, string> = {
  bca: "BCA",
  pa: "PA",
  usp: "USP",
  it: "IT",
  cd: "CD",
  nf: "NF",
  fs: "FS",
};

function scoreColor(score: number): string {
  if (score >= 4) return "#27ae60";
  if (score === 3) return "#D4A017";
  return "#C0392B";
}

export default async function IcpSubmissionsPage() {
  let submissions: IcpSubmission[] = [];
  let unlocks: IcpUnlock[] = [];

  try {
    const redis = getRedis();
    const [rawSubs, rawUnlocks] = await Promise.all([
      redis.lrange("icp-submissions", 0, -1),
      redis.lrange("icp-unlocks", 0, -1),
    ]);
    submissions = rawSubs.map((r) => (typeof r === "string" ? JSON.parse(r) : r) as IcpSubmission).reverse();
    unlocks = rawUnlocks.map((r) => (typeof r === "string" ? JSON.parse(r) : r) as IcpUnlock);
  } catch (err) {
    console.error("Admin ICP Redis error", err);
  }

  // Build unlock lookup by submission id
  const unlockMap = new Map<string, IcpUnlock>();
  for (const u of unlocks) {
    if (u.id) unlockMap.set(u.id, u);
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

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: 28, fontWeight: 600, color: "#053030", margin: 0 }}>
          ICP Submissions
        </h1>
        <span style={{ fontSize: 13, color: "#666" }}>
          {submissions.length} scored &middot; {unlocks.length} emails captured
        </span>
      </div>

      {submissions.length === 0 ? (
        <p style={{ color: "#666", fontSize: 14 }}>No ICP submissions yet.</p>
      ) : (
        <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Score</th>
                  <th style={th}>Dimensions</th>
                  <th style={th}>ICP Text</th>
                  <th style={th}>Contact</th>
                  <th style={th}>Details</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => {
                  const unlock = unlockMap.get(sub.id);
                  return (
                    <tr key={sub.id}>
                      <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12, color: "#666" }}>
                        {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }) : "—"}
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            fontFamily: "'Oswald', sans-serif",
                            fontWeight: 600,
                            fontSize: 16,
                            color: scoreColor(sub.totalScore / 20),
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
                                background: `${scoreColor(val)}18`,
                                color: scoreColor(val),
                              }}
                            >
                              {DIMENSION_NAMES[key] || key} {val}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ ...td, maxWidth: 250 }}>
                        <details>
                          <summary style={{ cursor: "pointer", color: "#005A66", fontSize: 12, fontWeight: 600 }}>
                            {sub.icpText.slice(0, 60)}...
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
                            {sub.icpText}
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
                        <details>
                          <summary style={{ cursor: "pointer", color: "#005A66", fontSize: 12, fontWeight: 600 }}>View</summary>
                          <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6 }}>
                            {sub.dimensionReasoning?.map((dr) => (
                              <div key={dr.dim} style={{ marginBottom: 8 }}>
                                <strong style={{ color: "#053030" }}>{DIMENSION_NAMES[dr.dim] || dr.dim} ({dr.score}/5):</strong>{" "}
                                <span style={{ color: "#666" }}>{dr.reasoning}</span>
                              </div>
                            ))}
                            {sub.recommendations?.length > 0 && (
                              <div style={{ marginTop: 12, borderTop: "1px solid #E8ECE9", paddingTop: 8 }}>
                                <strong style={{ color: "#053030" }}>Recommendations:</strong>
                                {sub.recommendations.map((rec, j) => (
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
