import { getRedis } from "@/app/lib/redis";
import { AI_CALLS_KEY, type AiCallLog } from "@/app/lib/llm";
import { readEventsSince, type EventRow } from "@/app/lib/events";
import { briefSummaries } from "@/app/lib/briefs";
import { aggregateStats, parseWindow, type BriefSummaryRow, type CallRow, type StatsTables } from "@/app/lib/project-builder/stats";

export const dynamic = "force-dynamic";

const th = { padding: "8px 10px", fontSize: 12, fontWeight: 600 as const, color: "#053030", textAlign: "left" as const, borderBottom: "2px solid #D0D5D2", textTransform: "uppercase" as const, letterSpacing: "0.04em" };
const td = { padding: "8px 10px", fontSize: 13, color: "#1A1A1A", borderBottom: "1px solid #E8ECE9", verticalAlign: "top" as const };
const h2 = { fontFamily: "var(--font-oswald), sans-serif", fontSize: 18, fontWeight: 600, color: "#053030", margin: "28px 0 10px" };
const box = { background: "#fff", borderRadius: 10, padding: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflowX: "auto" as const };

const chipStyle = (active: boolean) => ({
  display: "inline-flex",
  padding: "6px 12px",
  borderRadius: 16,
  fontSize: 12,
  fontWeight: 600,
  textDecoration: "none",
  border: `1px solid ${active ? "#053030" : "#D0D5D2"}`,
  background: active ? "#05303015" : "#fff",
  color: active ? "#053030" : "#666",
});

function Table({ head, rows }: { head: string[]; rows: Array<Array<string | number>> }) {
  return (
    <div style={box}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{head.map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td style={td} colSpan={head.length}>Nothing in this window.</td></tr>
          ) : (
            rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={td}>{c}</td>)}</tr>)
          )}
        </tbody>
      </table>
    </div>
  );
}

async function readCalls(): Promise<CallRow[]> {
  const raw = await getRedis().lrange<AiCallLog | string>(AI_CALLS_KEY, 0, -1);
  const out: CallRow[] = [];
  for (const item of raw) {
    try {
      const e = typeof item === "string" ? (JSON.parse(item) as AiCallLog) : item;
      out.push({ ts: e.ts, key: e.key, model: e.model, runId: e.runId, promptTokens: e.promptTokens, completionTokens: e.completionTokens, cost: e.cost, ok: e.ok });
    } catch {
      // malformed entry
    }
  }
  return out;
}

const money = (n: number) => `$${n.toFixed(4)}`;

/** Reads the three sources for the window (the clock is read here, outside render) and aggregates them. */
async function loadStats(days: string | undefined): Promise<{ t: StatsTables; errors: string[] }> {
  const window = parseWindow(days, Date.now());
  let events: EventRow[] = [];
  let calls: CallRow[] = [];
  let briefs: BriefSummaryRow[] = [];
  const errors: string[] = [];
  const [e, c, b] = await Promise.allSettled([readEventsSince(window.start, window.end), readCalls(), briefSummaries(2000)]);
  if (e.status === "fulfilled") events = e.value;
  else errors.push("The event stream could not be read.");
  if (c.status === "fulfilled") calls = c.value;
  else errors.push("The call log could not be read.");
  if (b.status === "fulfilled") briefs = b.value;
  else errors.push("The brief index could not be read.");
  return { t: aggregateStats({ events, calls, briefs, window }), errors };
}

/** Plain tables from the event stream, the call log and the brief index. No client JavaScript, no chart. */
export default async function StatsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days } = await searchParams;
  const { t, errors } = await loadStats(days);
  const window = t.window;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 28, fontWeight: 600, color: "#053030", margin: 0 }}>Stats</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {[7, 30, 90].map((d) => (
            <a key={d} href={`/admin/stats?days=${d}`} style={chipStyle(window.days === d)}>{d} days</a>
          ))}
        </div>
      </div>
      {errors.map((msg) => <p key={msg} style={{ color: "#C0392B", fontSize: 14 }}>{msg}</p>)}
      <p style={{ fontSize: 13, color: "#666" }}>
        Counts are events, not sessions. Model calls come from <code>ai:calls</code>, which keeps the last 2,000 entries; a 90 day window may be incomplete.
      </p>

      <h2 style={h2}>Builder funnel</h2>
      <Table head={["Stage", "Events", "Drop", "Drop %"]} rows={t.funnel.map((r) => [r.label, r.count, r.drop === null ? "" : r.drop, r.dropPct === null ? "" : `${r.dropPct}%`])} />

      <h2 style={h2}>Saves and submits by source tag</h2>
      <Table head={["Source", "Saves", "Submits"]} rows={t.bySource.map((r) => [r.source, r.saves, r.submits])} />

      <h2 style={h2}>Helper use by step</h2>
      <Table
        head={["Helper", "Uses", "Rules fallbacks"]}
        rows={[...t.helpers.map((r) => [r.step, r.uses, r.fallbacks]), ["document reads", t.reads.uses, t.reads.fallbacks], ["ideas runs", t.ideasRuns.uses, t.ideasRuns.fallbacks]]}
      />

      <h2 style={h2}>Model calls per routing key</h2>
      <Table
        head={["Key", "Calls", "Failed", "Prompt tokens", "Completion tokens", "Spend"]}
        rows={[...t.models.map((m) => [m.key, m.calls, m.failed, m.promptTokens, m.completionTokens, money(m.cost)]), ["total", t.modelsTotal.calls, t.modelsTotal.failed, t.modelsTotal.promptTokens, t.modelsTotal.completionTokens, money(t.modelsTotal.cost)]]}
      />
      {t.costIncomplete && <p style={{ fontSize: 12, color: "#666" }}>At least one call in the window had no cost reported by OpenRouter; it counts as zero.</p>}
      <p style={{ fontSize: 13, color: "#1A1A1A" }}>
        Cost per submitted brief: <strong>{t.costPerSubmittedBrief === null ? "no submits in the window" : money(t.costPerSubmittedBrief)}</strong>
      </p>

      <h2 style={h2}>Briefs by status</h2>
      <Table head={["Status", "Briefs"]} rows={t.briefsByStatus.map((r) => [r.label, r.count])} />
      <p style={{ fontSize: 13, color: "#1A1A1A" }}>
        Median time from submit to the first admin status change:{" "}
        <strong>{t.medianHoursToFirstStatusChange === null ? "no data yet" : `${t.medianHoursToFirstStatusChange.toFixed(1)} hours`}</strong>
      </p>
    </div>
  );
}
