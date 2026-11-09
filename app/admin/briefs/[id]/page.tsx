import Link from "next/link";
import { getRedis } from "@/app/lib/redis";
import { AI_CALLS_KEY, type AiCallLog } from "@/app/lib/llm";
import { getBrief, getBriefCritique, getBriefPlan, getBriefPrototype, getBriefRequests, getBriefResearch, getBriefSource, getBriefStyle, type BriefRecord, type StoredPlan } from "@/app/lib/briefs";
import { prototypeHash, type PrototypeRecord } from "@/app/lib/project-builder/prototype";
import type { CompanyProfile } from "@/app/lib/project-builder/research";
import type { PlanReview } from "@/app/lib/project-builder/review";
import { TURNED_DOWN_SUFFIX } from "@/app/lib/project-builder/review";
import type { ChangeRequest } from "@/app/lib/project-builder/requests";
import { coverageItems } from "@/app/lib/project-builder/plan";
import { prototypeView } from "@/app/lib/project-builder/prototype-html";
import type { HouseStyle } from "@/app/lib/project-builder/house-style";
import PrototypeFrame from "@/app/components/project-builder/PrototypeFrame";
import { BRIEF_STATUSES, isBriefId, statusLabel } from "@/app/lib/project-builder/brief";
import { HANDOVER, PATHS, RUN_OPTIONS, STEPS } from "@/app/lib/project-builder/catalogue";
import { notionPageUrl } from "@/app/lib/project-builder/notion-brief";
import { otherIntegrations, projectName, requirementsForNotion } from "@/app/lib/project-builder/requirements";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleString("en-GB", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const th = { padding: "8px 10px", fontSize: 12, fontWeight: 600 as const, color: "#053030", textAlign: "left" as const, borderBottom: "2px solid #D0D5D2", textTransform: "uppercase" as const, letterSpacing: "0.04em" };
const td = { padding: "8px 10px", fontSize: 13, color: "#1A1A1A", borderBottom: "1px solid #E8ECE9", verticalAlign: "top" as const };
const h2 = { fontFamily: "var(--font-oswald), sans-serif", fontSize: 18, fontWeight: 600, color: "#053030", margin: "28px 0 10px" };
const box = { background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 };
const preStyle = { margin: 0, fontSize: 11, lineHeight: 1.5, whiteSpace: "pre-wrap" as const, wordBreak: "break-word" as const, background: "#F5F7F6", padding: 10, borderRadius: 4, maxHeight: 400, overflow: "auto" };
const button = { padding: "8px 16px", borderRadius: 4, border: "1px solid #053030", background: "#053030", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-dm-sans), sans-serif" };

function Pairs({ pairs }: { pairs: Array<[string, string]> }) {
  const shown = pairs.filter(([, v]) => v.trim().length > 0);
  if (shown.length === 0) return <p style={{ fontSize: 13, color: "#666", margin: 0 }}>Nothing answered.</p>;
  return (
    <dl style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "6px 12px", margin: 0, fontSize: 13 }}>
      {shown.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <dt style={{ fontWeight: 600, color: "#053030" }}>{k}</dt>
          <dd style={{ margin: 0, whiteSpace: "pre-wrap" }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

async function callsFor(id: string): Promise<AiCallLog[]> {
  try {
    const raw = await getRedis().lrange<AiCallLog | string>(AI_CALLS_KEY, 0, -1);
    const out: AiCallLog[] = [];
    for (const item of raw) {
      try {
        const entry = typeof item === "string" ? (JSON.parse(item) as AiCallLog) : item;
        if (entry.runId === id) out.push(entry);
      } catch {
        // malformed entry
      }
    }
    return out.reverse();
  } catch {
    return [];
  }
}

/**
 * /admin/briefs/[id]: one brief read only (contact, timestamps, source tag,
 * Notion and email outcomes, the counters, every answer by step, the
 * requirements table in Notion order, the ideas added and passed on, the
 * change request, the latest prototype in the same sandboxed frame the
 * prospect sees with a link to a full screen page and its stages and per
 * screen builds, then the staged build's hidden artefacts (the company
 * profile, the plan with its coverage map and unplaced list, the senior
 * review with applied and suggested items, the audit, every change
 * request), the pasted material while its 90 day key still exists, and the
 * model calls logged under this id),
 * plus three plain form POSTs to
 * `/api/admin/briefs/[id]`: the status select with Save, Unlock on a
 * submitted brief, and Delete behind a confirm box. No client JavaScript,
 * as on the rubrics page. Calls made before the first save carry no brief
 * id in `ai:calls`, so the call list starts at the save; the page says so.
 */
export default async function BriefPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; unlocked?: string }> }) {
  const { id } = await params;
  const { saved, unlocked } = await searchParams;
  if (!isBriefId(id)) return <p style={{ color: "#C0392B" }}>That brief id is not valid.</p>;

  let brief: BriefRecord | null = null;
  let source: string | null = null;
  let calls: AiCallLog[] = [];
  let prototype: PrototypeRecord | null = null;
  let style: HouseStyle | null = null;
  let profile: CompanyProfile | null = null;
  let plan: StoredPlan | null = null;
  let critique: PlanReview | null = null;
  let requests: ChangeRequest[] = [];
  let loadError = false;
  try {
    brief = await getBrief(id);
    if (brief) {
      source = await getBriefSource(id);
      calls = await callsFor(id);
      [prototype, style, profile, plan, critique, requests] = await Promise.all([getBriefPrototype(id), getBriefStyle(id), getBriefResearch(id), getBriefPlan(id), getBriefCritique(id), getBriefRequests(id)]);
    }
  } catch (err) {
    console.error("Admin brief Redis error", err instanceof Error ? err.message : err);
    loadError = true;
  }
  if (loadError) return <p style={{ color: "#C0392B" }}>The brief store could not be read. Check the Upstash variables.</p>;
  if (!brief) return <p style={{ color: "#666" }}>Brief {id} was not found. It may have expired or been deleted. <Link href="/admin/briefs" style={{ color: "#005A66" }}>All briefs</Link></p>;

  const s = brief.state;
  const rows = requirementsForNotion(s);
  const added = s.ideas.filter((i) => s.ideaPick[i.id] && s.ideaPick[i.id] !== "no");
  const passed = s.ideas.filter((i) => s.ideaPick[i.id] === "no");
  const action = `/api/admin/briefs/${brief.id}`;
  const guard = [s.sso && "single sign-on", s.perms && "roles and permissions", s.audit && "audit trail", s.personal && "handles personal data"].filter(Boolean).join(", ");
  const items = coverageItems(s);
  const itemLabel = (itemId: string) => items.find((i) => i.id === itemId)?.label ?? "";
  const itemPri = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    return item ? (item.kind === "role" ? "role" : (item.pri ?? "")) : "";
  };
  const list = (values: string[]) => (values.length ? values.join(", ") : "");
  const stagesLine = prototype ? prototype.stages.map((st) => `${st.stage} ${st.ok ? `${st.model || "?"} ${st.ms} ms` : "failed"}`).join("; ") : "";
  const screensLine = prototype ? prototype.screens.map((sc) => `${sc.slug}: ${sc.kept ? "kept" : `${sc.model} ${sc.ms} ms${sc.retried ? ", retried" : ""}`}`).join("; ") : "";
  const auditLine = !prototype ? "" : prototype.audit === null ? "not run (off, skipped for time, or failed)" : prototype.audit.missing.length === 0 ? `all Must and Should requirements represented (${prototype.audit.model}, ${formatDate(prototype.audit.checkedAt)})` : "";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontFamily: "var(--font-oswald), sans-serif", fontSize: 28, fontWeight: 600, color: "#053030", margin: 0 }}>{projectName(s)}</h1>
        <Link href="/admin/briefs" style={{ color: "#005A66", fontWeight: 600, fontSize: 13 }}>All briefs</Link>
      </div>
      {saved === "1" && <p style={{ color: "#27ae60", fontSize: 14 }}>Status saved.</p>}
      {unlocked === "1" && <p style={{ color: "#27ae60", fontSize: 14 }}>Unlocked and the link was emailed.</p>}
      {unlocked === "0" && <p style={{ color: "#C0392B", fontSize: 14 }}>Unlocked, but the link could not be emailed. Check the secret and the SMTP variables.</p>}

      <div style={box}>
        <Pairs
          pairs={[
            ["Status", statusLabel(brief.status)],
            ["Saved", formatDate(brief.savedAt)],
            ["Submitted", formatDate(brief.submittedAt)],
            ["Updated", formatDate(brief.updatedAt)],
            ["Last reminded", formatDate(brief.lastRemindedAt) || "never"],
            ["First status change", formatDate(brief.firstStatusChangeAt)],
            ["Contact", brief.contact.name],
            ["Email", brief.contact.email],
            ["Company", brief.contact.company],
            ["Website", brief.contact.website],
            ["Marketing", brief.contact.marketing ? "yes" : "no"],
            ["Source tag", brief.sourceTag || "(none)"],
            ["Notion", `${brief.notionStatus ?? "none"}${brief.notionPageId ? ` ${notionPageUrl(brief.notionPageId)}` : ""}`],
            ["Last email", brief.lastEmailStatus ?? "none"],
            ["Counts", `suggestions ${brief.suggestCount}, ideas runs ${brief.ideasCount}, reads ${brief.readCount}, prototypes ${brief.prototypeCount}, change requests ${brief.requestCount}`],
            ["Brief id", brief.id],
          ]}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <form method="POST" action={action} style={box}>
          <input type="hidden" name="action" value="status" />
          <label htmlFor="status" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#053030", marginBottom: 6 }}>Status</label>
          <div style={{ display: "flex", gap: 8 }}>
            <select id="status" name="status" defaultValue={brief.status} style={{ flex: 1, padding: 8, fontSize: 13, borderRadius: 4, border: "1px solid #D0D5D2" }}>
              {BRIEF_STATUSES.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
            </select>
            <button type="submit" style={button}>Save</button>
          </div>
          <p style={{ fontSize: 12, color: "#666", margin: "8px 0 0" }}>Writes the brief and updates the Notion status.</p>
        </form>
        {brief.status !== "draft" && (
          <form method="POST" action={action} style={box}>
            <input type="hidden" name="action" value="unlock" />
            <button type="submit" style={button}>Unlock</button>
            <p style={{ fontSize: 12, color: "#666", margin: "8px 0 0" }}>Sets the brief back to draft and emails the prospect their link.</p>
          </form>
        )}
        <form method="POST" action={action} style={box}>
          <input type="hidden" name="action" value="delete" />
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, marginBottom: 10 }}>
            <input type="checkbox" name="confirm" value="yes" required />
            <span>Yes, delete this brief and its pasted text</span>
          </label>
          <button type="submit" style={{ ...button, background: "#C0392B", borderColor: "#C0392B" }}>Delete</button>
        </form>
      </div>

      <h2 style={h2}>Answers by step</h2>
      <div style={box}>
        <h3 style={{ fontSize: 14, margin: "0 0 8px", color: "#053030" }}>{STEPS[0]}</h3>
        <Pairs pairs={[["Project name", s.name], ["Company website", s.biz.website], ["About the business", s.biz.notes], ["Starting point", PATHS.find((p) => p.key === s.path)?.title ?? ""], ["Idea", s.idea], ["Replacing", s.path === "replace" ? s.rep.sys : ""], ["Why they are moving", s.path === "replace" ? s.rep.reasons.join(", ") : ""]]} />
        <h3 style={{ fontSize: 14, margin: "16px 0 8px", color: "#053030" }}>{STEPS[1]}</h3>
        <Pairs pairs={[["Problem", s.problem], ["Who has it", s.audience], ["Success measure", s.success], ["Signs off the scope", s.signoff], ["Timing", s.timing], ["Budget", s.budget], ["Users", s.roles.join(", ")]]} />
        <h3 style={{ fontSize: 14, margin: "16px 0 8px", color: "#053030" }}>{STEPS[2]}</h3>
        <Pairs pairs={[["Features", Object.entries(s.features).map(([k, p]) => `${k} (${p})`).join(", ")], ["Connections", s.integrations.concat(otherIntegrations(s)).join(", ")]]} />
        <h3 style={{ fontSize: 14, margin: "16px 0 8px", color: "#053030" }}>{STEPS[3]}</h3>
        <Pairs pairs={[["Guardrails", guard], ["Standards", s.compliance.join(", ")], ["Data stored in", s.residency !== "No preference" ? s.residency : ""], ["Number of users", s.scale], ["Needs to be up", s.uptime], ["Who runs it", RUN_OPTIONS.find((r) => r.key === s.run)?.title ?? ""], ["Team skills", s.skills], ["Handover", HANDOVER.filter((h) => s.handover.includes(h.key)).map((h) => h.title).join(", ")]]} />
        <h3 style={{ fontSize: 14, margin: "16px 0 8px", color: "#053030" }}>{STEPS[4]}</h3>
        <Pairs pairs={[["Ideas added", added.map((i) => `${i.title} (${s.ideaPick[i.id]})`).join("; ")], ["Ideas passed on", passed.map((i) => i.title).join("; ")]]} />
        {s.unplaced.length > 0 && (
          <>
            <h3 style={{ fontSize: 14, margin: "16px 0 8px", color: "#053030" }}>Lines the reader could not place</h3>
            <ul style={{ fontSize: 13, margin: 0, paddingLeft: 18 }}>{s.unplaced.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </>
        )}
      </div>

      <h2 style={h2}>Requirements</h2>
      <div style={{ ...box, padding: 0, overflowX: "auto" }}>
        {rows.length === 0 ? (
          <p style={{ fontSize: 13, color: "#666", padding: 20, margin: 0 }}>None.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr><th style={th}>ID</th><th style={th}>Requirement</th><th style={th}>Type</th><th style={th}>Priority</th><th style={th}>Source</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{r.id}</td>
                  <td style={td}>{r.text}</td>
                  <td style={td}>{r.cat}</td>
                  <td style={td}>{r.pri}</td>
                  <td style={td}>{r.source}{r.built ? ", already built" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {brief.changeRequest && (
        <>
          <h2 style={h2}>Change request</h2>
          <div style={box}>
            <p style={{ fontSize: 12, color: "#666", margin: "0 0 6px" }}>{formatDate(brief.changeRequestedAt)}</p>
            <p style={{ fontSize: 13, margin: 0, whiteSpace: "pre-wrap" }}>{brief.changeRequest}</p>
          </div>
        </>
      )}

      <h2 style={h2}>Prototype</h2>
      <div style={box}>
        {prototype ? (
          <>
            <Pairs
              pairs={[
                ["Last updated", formatDate(prototype.updatedAt)],
                ["Version", String(prototype.version)],
                ["Plan version", prototype.planVersion > 0 ? String(prototype.planVersion) : "none (made before the staged build)"],
                ["Last mode", prototype.lastMode],
                ["Model", prototype.model],
                ["Routing key", prototype.routingKey],
                ["Against the brief", prototype.hash === prototypeHash(s, brief.contact) ? "up to date" : "out of date"],
                ["House style", style ? `${style.status}, from ${style.source}, brand lookup ${style.brandLookup}${style.host ? `, host ${style.host}` : ""}${style.reason ? `, ${style.reason}` : ""}` : "none stored"],
                ["Stages", stagesLine],
                ["Screens", screensLine],
              ]}
            />
            <div style={{ margin: "14px 0 8px" }}>
              <PrototypeFrame html={prototypeView(prototype, style).html} height="640px" />
            </div>
            <Link href={`/admin/briefs/${brief.id}/prototype`} style={{ color: "#005A66", fontWeight: 600, fontSize: 13 }}>Open full screen</Link>
          </>
        ) : (
          <p style={{ fontSize: 13, color: "#666", margin: 0 }}>No prototype made.</p>
        )}
      </div>

      <h2 style={h2}>Company profile</h2>
      <div style={box}>
        {!profile ? (
          <p style={{ fontSize: 13, color: "#666", margin: 0 }}>Not built yet.</p>
        ) : profile.empty ? (
          <p style={{ fontSize: 13, color: "#666", margin: 0 }}>None found{profile.host ? ` for ${profile.host}` : ""} ({formatDate(profile.builtAt) || "no time"}; {profile.sources.pages} pages, Brandfetch {profile.sources.brandfetch ? "yes" : "no"}).</p>
        ) : (
          <Pairs
            pairs={[
              ["Host", profile.host ?? ""],
              ["Built", `${formatDate(profile.builtAt)} with ${profile.model || "?"} from ${profile.sources.pages} pages${profile.sources.brandfetch ? " and Brandfetch" : ""}`],
              ["Summary", profile.summary],
              ["Products", list(profile.products)],
              ["Services", list(profile.services)],
              ["Plans", list(profile.plans)],
              ["Their words", profile.vocabulary.map((v) => `${v.term}: ${v.meaning}`).join("; ")],
              ["Locations", list(profile.locations)],
              ["Currency", profile.currency],
              ["Units", profile.units],
              ["Team size", profile.teamSize],
            ]}
          />
        )}
      </div>

      <h2 style={h2}>Plan</h2>
      <div style={box}>
        {!plan ? (
          <p style={{ fontSize: 13, color: "#666", margin: 0 }}>No plan stored.</p>
        ) : (
          <>
            <Pairs
              pairs={[
                ["Version", `${plan.version} (produced prototype version ${plan.producedVersion})`],
                ["Built", `${formatDate(plan.builtAt)} with ${plan.model || "?"} from ${plan.builtFrom}`],
                ["Accepted change requests", plan.accepted.map((a) => a.text).join("; ")],
              ]}
            />
            <h3 style={{ fontSize: 14, margin: "16px 0 8px", color: "#053030" }}>Screens</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr><th style={th}>Slug</th><th style={th}>Title</th><th style={th}>Purpose</th><th style={th}>Role</th><th style={th}>Components</th></tr>
              </thead>
              <tbody>
                {plan.screens.map((sc) => (
                  <tr key={sc.slug}>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{sc.slug}</td>
                    <td style={td}>{sc.title}</td>
                    <td style={td}>{sc.purpose}</td>
                    <td style={td}>{sc.role}</td>
                    <td style={td}>{sc.components.map((c) => `${c.kind}: ${c.title}${c.entity ? ` (${c.entity})` : ""}`).join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 style={{ fontSize: 14, margin: "16px 0 8px", color: "#053030" }}>Coverage map</h3>
            {plan.coverage.length === 0 ? (
              <p style={{ fontSize: 13, color: "#666", margin: 0 }}>Empty.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr><th style={th}>Item</th><th style={th}>Text</th><th style={th}>Priority</th><th style={th}>Screen</th><th style={th}>Component</th></tr>
                </thead>
                <tbody>
                  {plan.coverage.map((c, i) => (
                    <tr key={`${c.id}-${c.screen}-${i}`}>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{c.id}</td>
                      <td style={td}>{itemLabel(c.id)}</td>
                      <td style={td}>{itemPri(c.id)}</td>
                      <td style={td}>{c.screen}</td>
                      <td style={td}>{c.component}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <h3 style={{ fontSize: 14, margin: "16px 0 8px", color: "#053030" }}>Unplaced</h3>
            {plan.unplaced.length === 0 ? (
              <p style={{ fontSize: 13, color: "#666", margin: 0 }}>Nothing.</p>
            ) : (
              <ul style={{ fontSize: 13, margin: 0, paddingLeft: 18 }}>
                {plan.unplaced.map((u) => <li key={u.id}>{u.id} {itemLabel(u.id)}: {u.reason || "no reason given"}</li>)}
              </ul>
            )}
          </>
        )}
      </div>

      <h2 style={h2}>Senior review</h2>
      <div style={box}>
        {!critique ? (
          <p style={{ fontSize: 13, color: "#666", margin: 0 }}>No review stored.</p>
        ) : (
          <>
            <p style={{ fontSize: 12, color: "#666", margin: "0 0 8px" }}>{formatDate(critique.builtAt)} with {critique.model || "?"}</p>
            <h3 style={{ fontSize: 14, margin: "0 0 8px", color: "#053030" }}>Gaps</h3>
            {critique.gaps.length === 0 ? <p style={{ fontSize: 13, color: "#666", margin: 0 }}>None.</p> : (
              <ul style={{ fontSize: 13, margin: 0, paddingLeft: 18 }}>
                {critique.gaps.map((g, i) => <li key={i}>{g.text}{g.itemId ? ` (${g.itemId})` : ""}{g.screen ? ` on ${g.screen}` : ""}</li>)}
              </ul>
            )}
            <h3 style={{ fontSize: 14, margin: "16px 0 8px", color: "#053030" }}>Applied</h3>
            {critique.recommendations.filter((r) => r.mode === "apply").length === 0 ? <p style={{ fontSize: 13, color: "#666", margin: 0 }}>None.</p> : (
              <ul style={{ fontSize: 13, margin: 0, paddingLeft: 18 }}>
                {critique.recommendations.filter((r) => r.mode === "apply").map((r, i) => <li key={i}><strong>{r.title}</strong>: {r.why} Based on: {r.basedOn}{r.screen ? ` (${r.screen})` : ""}{r.newScreen ? ` (new screen ${r.newScreen.slug})` : ""}</li>)}
              </ul>
            )}
            <h3 style={{ fontSize: 14, margin: "16px 0 8px", color: "#053030" }}>Suggested</h3>
            {critique.recommendations.filter((r) => r.mode === "suggest").length === 0 && !(plan?.reviewSuggested ?? []).some((t) => t.endsWith(TURNED_DOWN_SUFFIX)) ? <p style={{ fontSize: 13, color: "#666", margin: 0 }}>None.</p> : (
              <ul style={{ fontSize: 13, margin: 0, paddingLeft: 18 }}>
                {critique.recommendations.filter((r) => r.mode === "suggest").map((r, i) => <li key={i}><strong>{r.title}</strong>: {r.why} Based on: {r.basedOn}</li>)}
                {(plan?.reviewSuggested ?? []).filter((t) => t.endsWith(TURNED_DOWN_SUFFIX)).map((t, i) => <li key={`td-${i}`}>{t}</li>)}
              </ul>
            )}
          </>
        )}
      </div>

      <h2 style={h2}>Audit</h2>
      <div style={box}>
        {!prototype ? (
          <p style={{ fontSize: 13, color: "#666", margin: 0 }}>No prototype made.</p>
        ) : auditLine ? (
          <p style={{ fontSize: 13, color: "#666", margin: 0 }}>{auditLine}</p>
        ) : (
          <>
            <p style={{ fontSize: 12, color: "#666", margin: "0 0 8px" }}>{formatDate(prototype.audit!.checkedAt)} with {prototype.audit!.model || "?"}: not visibly represented</p>
            <ul style={{ fontSize: 13, margin: 0, paddingLeft: 18 }}>
              {prototype.audit!.missing.map((m) => <li key={m.id}>{m.id} ({m.pri}): {m.label}{m.note ? ` (${m.note})` : ""}</li>)}
            </ul>
          </>
        )}
      </div>

      <h2 style={h2}>Change requests</h2>
      <div style={{ ...box, padding: 0, overflowX: "auto" }}>
        {requests.length === 0 ? (
          <p style={{ fontSize: 13, color: "#666", padding: 20, margin: 0 }}>None.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr><th style={th}>Time</th><th style={th}>Request</th><th style={th}>Outcome</th><th style={th}>Screens changed</th><th style={th}>Model</th></tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{formatDate(r.at)}</td>
                  <td style={{ ...td, whiteSpace: "pre-wrap" }}>{r.text}</td>
                  <td style={td}>{r.outcome}</td>
                  <td style={td}>{r.screens.join(", ")}</td>
                  <td style={td}>{r.model}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 style={h2}>Pasted material</h2>
      <div style={box}>{source ? <pre style={preStyle}>{source}</pre> : <p style={{ fontSize: 13, color: "#666", margin: 0 }}>Expired or none.</p>}</div>

      <h2 style={h2}>Model calls</h2>
      <div style={{ ...box, padding: 0, overflowX: "auto" }}>
        {calls.length === 0 ? (
          <p style={{ fontSize: 13, color: "#666", padding: 20, margin: 0 }}>No calls logged for this brief (calls before the first save carry no brief id).</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr><th style={th}>Time</th><th style={th}>Key</th><th style={th}>Tag</th><th style={th}>Model</th><th style={th}>Provider</th><th style={th}>ms</th><th style={th}>Tokens</th><th style={th}>Cost</th><th style={th}>OK</th></tr>
            </thead>
            <tbody>
              {calls.map((c, i) => (
                <tr key={`${c.ts}-${i}`}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{formatDate(c.ts)}</td>
                  <td style={td}>{c.key}</td>
                  <td style={td}>{c.tag ?? ""}</td>
                  <td style={td}>{c.model}{c.fallbackUsed ? " (fallback)" : ""}{c.reasoningForced ? ", reasoning forced low" : ""}{c.reasoningFallback ? ", reasoning refused off" : ""}</td>
                  <td style={td}>{c.provider ?? ""}</td>
                  <td style={td}>{typeof c.ms === "number" ? c.ms : ""}</td>
                  <td style={td}>{c.promptTokens} in, {c.completionTokens} out</td>
                  <td style={td}>{typeof c.cost === "number" ? `$${c.cost.toFixed(4)}` : "n/a"}</td>
                  <td style={td}>{c.ok ? "yes" : `no: ${c.error ?? ""}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
