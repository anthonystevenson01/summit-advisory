import { getRedis } from "@/app/lib/redis";

export const dynamic = "force-dynamic";

type AiStudioRequest = {
  name: string;
  email: string;
  website: string;
  teamMembers: Array<{ name: string; linkedin: string }>;
  product: string;
  problem: string;
  stage: string;
  extra: string;
  receivedAt: string;
};

export default async function AiStudioPage() {
  let requests: AiStudioRequest[] = [];

  try {
    const redis = getRedis();
    const raw = await redis.lrange("ai-studio-requests", 0, -1);
    requests = raw.map((r) => (typeof r === "string" ? JSON.parse(r) : r) as AiStudioRequest).reverse();
  } catch (err) {
    console.error("Admin AI Studio Redis error", err);
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
          AI Studio Requests
        </h1>
        <span style={{ fontSize: 13, color: "#666" }}>{requests.length} total</span>
      </div>

      {requests.length === 0 ? (
        <p style={{ color: "#666", fontSize: 14 }}>No requests yet.</p>
      ) : (
        <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Name</th>
                  <th style={th}>Email</th>
                  <th style={th}>Website</th>
                  <th style={th}>Product</th>
                  <th style={th}>Stage</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req, i) => (
                  <tr key={i}>
                    <td style={{ ...td, whiteSpace: "nowrap", fontSize: 12, color: "#666" }}>
                      {req.receivedAt ? new Date(req.receivedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }) : "—"}
                    </td>
                    <td style={{ ...td, fontWeight: 600 }}>{req.name || "—"}</td>
                    <td style={td}>{req.email || "—"}</td>
                    <td style={td}>
                      {req.website ? (
                        <a href={req.website.startsWith("http") ? req.website : `https://${req.website}`} target="_blank" rel="noopener noreferrer" style={{ color: "#005A66" }}>
                          {req.website}
                        </a>
                      ) : "—"}
                    </td>
                    <td style={td}>
                      <details>
                        <summary style={{ cursor: "pointer", color: "#005A66", fontSize: 12, fontWeight: 600 }}>View</summary>
                        <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6 }}>
                          <p style={{ margin: "0 0 4px" }}><strong>Product:</strong> {req.product || "—"}</p>
                          <p style={{ margin: "0 0 4px" }}><strong>Problem:</strong> {req.problem || "—"}</p>
                          {req.extra && <p style={{ margin: "0 0 4px" }}><strong>Extra:</strong> {req.extra}</p>}
                          {req.teamMembers?.length > 0 && (
                            <div style={{ marginTop: 4 }}>
                              <strong>Team:</strong>
                              {req.teamMembers.map((m, j) => (
                                <span key={j} style={{ display: "block", marginLeft: 8 }}>
                                  {m.name}{m.linkedin ? ` — ${m.linkedin}` : ""}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </details>
                    </td>
                    <td style={td}>{req.stage || "—"}</td>
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
