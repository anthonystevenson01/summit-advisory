import { PUBLIC_TOOLS } from "@/app/lib/tools/registry";
import { getRubric, type Rubric } from "@/app/lib/rubrics";

export const dynamic = "force-dynamic";

type Row = { slug: string; name: string; rubric: Rubric | null; error: string | null };

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

function formatDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function RubricsPage() {
  const rows: Row[] = await Promise.all(
    PUBLIC_TOOLS.map(async (tool) => {
      try {
        const rubric = await getRubric(tool.slug);
        return { slug: tool.slug, name: tool.name, rubric, error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { slug: tool.slug, name: tool.name, rubric: null, error: /not published|not configured/.test(message) ? "Not published" : "Could not load" };
      }
    }),
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 28, fontWeight: 600, color: "#053030", margin: "0 0 6px" }}>
            Rubrics
          </h1>
          <p style={{ fontSize: 13, color: "#666", margin: 0, maxWidth: 680, lineHeight: 1.6 }}>
            Read server side from the Notion Tool Rubrics database, Status = Published only. Cached for 10 minutes.
            Refresh after publishing a change in Notion, then run <code>npm run calibrate</code>.
          </p>
        </div>
        <form action="/api/admin/rubrics" method="POST">
          <button
            type="submit"
            style={{ fontFamily: "var(--font-dm-sans), sans-serif", fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 6, border: "none", background: "#319A65", color: "#fff", cursor: "pointer" }}
          >
            Refresh rubrics
          </button>
        </form>
      </div>

      <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Tool</th>
              <th style={th}>Version</th>
              <th style={th}>Hash</th>
              <th style={th}>Fetched</th>
              <th style={th}>System prompt</th>
              <th style={th}>Rubric</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug}>
                <td style={td}>
                  <div style={{ fontWeight: 600, color: "#053030" }}>{row.name}</div>
                  <div style={{ fontSize: 11, color: "#666" }}>{row.slug}</div>
                </td>
                {row.rubric ? (
                  <>
                    <td style={td}>v{row.rubric.version}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{row.rubric.hash.slice(0, 12)}</td>
                    <td style={{ ...td, fontSize: 12, color: "#666" }}>{formatDate(row.rubric.fetchedAt)}</td>
                    <td style={{ ...td, fontSize: 12, color: "#666" }}>{row.rubric.systemPrompt.length.toLocaleString()} chars</td>
                    <td style={{ ...td, fontSize: 12, color: "#666" }}>{row.rubric.rubric.length.toLocaleString()} chars</td>
                  </>
                ) : (
                  <td style={{ ...td, color: "#C0392B", fontWeight: 600 }} colSpan={5}>{row.error}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
