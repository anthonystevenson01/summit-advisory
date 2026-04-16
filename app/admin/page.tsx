import { getRedis } from "@/app/lib/redis";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  let pageVisits = 0;
  let buildRequests = 0;
  let icpsScored = 0;
  let emailsCaptured = 0;

  try {
    const redis = getRedis();
    const [visits, builds, icps, unlocks] = await Promise.all([
      redis.get("page-visits"),
      redis.llen("ai-studio-requests"),
      redis.llen("icp-submissions"),
      redis.llen("icp-unlocks"),
    ]);
    pageVisits = typeof visits === "number" ? visits : parseInt(String(visits) || "0", 10);
    buildRequests = builds;
    icpsScored = icps;
    emailsCaptured = unlocks;
  } catch (err) {
    console.error("Admin dashboard Redis error", err);
  }

  const cards = [
    { label: "Page Visits", value: pageVisits, color: "#005A66" },
    { label: "Build Requests", value: buildRequests, color: "#319A65" },
    { label: "ICPs Scored", value: icpsScored, color: "#D4A017" },
    { label: "Emails Captured", value: emailsCaptured, color: "#C0392B" },
  ];

  return (
    <div>
      <h1
        style={{
          fontFamily: "var(--font-oswald), sans-serif",
          fontSize: 28,
          fontWeight: 600,
          color: "#053030",
          margin: "0 0 24px",
        }}
      >
        Dashboard
      </h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        {cards.map((card) => (
          <div
            key={card.label}
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: "24px 20px",
              borderTop: `3px solid ${card.color}`,
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            <p style={{ fontSize: 12, fontWeight: 600, color: "#666", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {card.label}
            </p>
            <p style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 36, fontWeight: 600, color: "#053030", margin: 0 }}>
              {card.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <a
          href="/admin/ai-studio"
          style={{
            display: "block",
            background: "#fff",
            borderRadius: 8,
            padding: "20px",
            textDecoration: "none",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          <p style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 16, fontWeight: 600, color: "#053030", margin: "0 0 4px" }}>
            AI Studio Requests
          </p>
          <p style={{ fontSize: 13, color: "#666", margin: 0 }}>View all build request submissions</p>
        </a>
        <a
          href="/admin/icp"
          style={{
            display: "block",
            background: "#fff",
            borderRadius: 8,
            padding: "20px",
            textDecoration: "none",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          <p style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 16, fontWeight: 600, color: "#053030", margin: "0 0 4px" }}>
            ICP Submissions
          </p>
          <p style={{ fontSize: 13, color: "#666", margin: 0 }}>View all ICP evaluations and unlocks</p>
        </a>
      </div>
    </div>
  );
}
