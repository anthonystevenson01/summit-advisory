import { getRedis } from "@/app/lib/redis";
import { countRuns } from "@/app/lib/runs";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  let pageVisits = 0;
  let buildRequests = 0;
  let runsScored = 0;
  let emailsCaptured = 0;

  try {
    const redis = getRedis();
    const [visits, builds, runs, gtmUnlocks, icpUnlocks] = await Promise.all([
      redis.get("page-visits"),
      redis.llen("ai-studio-requests"),
      countRuns(),
      redis.llen("gtm-unlocks"),
      redis.llen("icp-unlocks"),
    ]);
    pageVisits = typeof visits === "number" ? visits : parseInt(String(visits) || "0", 10);
    buildRequests = builds;
    runsScored = runs;
    emailsCaptured = gtmUnlocks + icpUnlocks;
  } catch (err) {
    console.error("Admin dashboard Redis error", err instanceof Error ? err.message : err);
  }

  const cards = [
    { label: "Page Visits", value: pageVisits, color: "#005A66" },
    { label: "Build Requests", value: buildRequests, color: "#319A65" },
    { label: "Runs Scored", value: runsScored, color: "#D4A017" },
    { label: "Emails Captured (incl. legacy ICP list)", value: emailsCaptured, color: "#C0392B" },
  ];

  const links = [
    { href: "/admin/ai-studio", title: "AI Studio Requests", body: "View all build request submissions" },
    { href: "/admin/runs", title: "Runs", body: "Every scored run: inputs, scores, reasoning, unlocks" },
    { href: "/admin/models", title: "Models", body: "Which model handles each call, with calibration state and spend" },
    { href: "/admin/rubrics", title: "Rubrics", body: "Live rubric versions from Notion, with a refresh" },
    { href: "/admin/reports", title: "Reports", body: "Prospect reports built from Built to Scale? runs" },
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
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
              {link.title}
            </p>
            <p style={{ fontSize: 13, color: "#666", margin: 0 }}>{link.body}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
