import { listBriefs, type BriefRecord } from "@/app/lib/briefs";
import { BRIEF_STATUSES, isBriefStatus, statusLabel } from "@/app/lib/project-builder/brief";
import { PATHS } from "@/app/lib/project-builder/catalogue";
import { notionPageUrl } from "@/app/lib/project-builder/notion-brief";
import { buildRequirements, countByPriority, projectName } from "@/app/lib/project-builder/requirements";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

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

const chipStyle = (active: boolean) => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 12px",
  borderRadius: 16,
  fontSize: 12,
  fontWeight: 600,
  textDecoration: "none",
  border: `1px solid ${active ? "#053030" : "#D0D5D2"}`,
  background: active ? "#05303015" : "#fff",
  color: active ? "#053030" : "#666",
});

function Row({ b }: { b: BriefRecord }) {
  const must = countByPriority(buildRequirements(b.state)).Must;
  const path = PATHS.find((p) => p.key === b.state.path)?.title ?? "";
  const href = `/admin/briefs/${b.id}`;
  return (
    <tr>
      <td style={{ ...td, whiteSpace: "nowrap" }}>{formatDate(b.updatedAt)}</td>
      <td style={td}><a href={href} style={{ color: "#005A66", fontWeight: 600 }}>{projectName(b.state)}</a></td>
      <td style={td}>{b.contact.company}</td>
      <td style={td}>{b.contact.name}<div style={{ color: "#666" }}>{b.contact.email}</div></td>
      <td style={td}>{statusLabel(b.status)}</td>
      <td style={td}>{path}</td>
      <td style={td}>{must}</td>
      <td style={td}>{b.sourceTag || ""}</td>
      <td style={td}>
        {b.notionStatus ?? "none"}
        {b.notionPageId && (
          <>
            {" "}
            <a href={notionPageUrl(b.notionPageId)} target="_blank" rel="noopener noreferrer" style={{ color: "#005A66" }}>Open</a>
          </>
        )}
      </td>
      <td style={td}><a href={href} style={{ color: "#005A66", fontWeight: 600 }}>Open</a></td>
    </tr>
  );
}

export default async function BriefsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; deleted?: string }> }) {
  const { status: statusParam, page: pageParam, deleted } = await searchParams;
  const statusFilter = isBriefStatus(statusParam) ? statusParam : undefined;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  let briefs: BriefRecord[] = [];
  let total = 0;
  let loadError = false;
  try {
    const result = await listBriefs({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
    briefs = statusFilter ? result.briefs.filter((b) => b.status === statusFilter) : result.briefs;
    total = result.total;
  } catch (err) {
    console.error("Admin briefs Redis error", err instanceof Error ? err.message : err);
    loadError = true;
  }

  const query = (overrides: { status?: string; page?: number }) => {
    const params = new URLSearchParams();
    const s = overrides.status !== undefined ? overrides.status : statusFilter;
    if (s) params.set("status", s);
    const p = overrides.page ?? 1;
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/admin/briefs${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
        <h1 style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 28, fontWeight: 600, color: "#053030", margin: 0 }}>Briefs</h1>
        <span style={{ fontSize: 13, color: "#666" }}>{total.toLocaleString()} in the store &middot; page {page}</span>
      </div>
      {deleted === "1" && <p style={{ color: "#27ae60", fontSize: 14 }}>The brief was deleted.</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <a href={query({ status: "" })} style={chipStyle(!statusFilter)}>All</a>
        {BRIEF_STATUSES.map((s) => (
          <a key={s.key} href={query({ status: s.key })} style={chipStyle(statusFilter === s.key)}>{s.label}</a>
        ))}
      </div>
      {loadError ? (
        <p style={{ color: "#C0392B", fontSize: 14 }}>The brief store could not be read. Check the Upstash variables.</p>
      ) : briefs.length === 0 ? (
        <p style={{ color: "#666", fontSize: 14 }}>No briefs yet.</p>
      ) : (
        <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Updated</th>
                  <th style={th}>Project</th>
                  <th style={th}>Company</th>
                  <th style={th}>Contact</th>
                  <th style={th}>Status</th>
                  <th style={th}>Starting point</th>
                  <th style={th}>Must</th>
                  <th style={th}>Source</th>
                  <th style={th}>Notion</th>
                  <th style={th}>Open</th>
                </tr>
              </thead>
              <tbody>{briefs.map((b) => <Row key={b.id} b={b} />)}</tbody>
            </table>
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 12, marginTop: 16, fontSize: 13 }}>
        {page > 1 && <a href={query({ page: page - 1 })} style={{ color: "#005A66", fontWeight: 600 }}>Previous page</a>}
        {briefs.length === PAGE_SIZE && <a href={query({ page: page + 1 })} style={{ color: "#005A66", fontWeight: 600 }}>Next page</a>}
      </div>
    </div>
  );
}
