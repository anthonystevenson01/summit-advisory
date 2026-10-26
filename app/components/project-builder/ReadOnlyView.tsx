"use client";

import { useState } from "react";
import { BRAND } from "@/app/lib/brand";
import { HANDOVER, PATHS, PRIORITIES, PRIORITY_LABELS, RUN_OPTIONS, SOURCE_LABELS, STEPS } from "@/app/lib/project-builder/catalogue";
import { statusLabel, type BriefState, type BriefStatus } from "@/app/lib/project-builder/brief";
import { DONE, SAVE } from "@/app/lib/project-builder/copy";
import { buildRequirements, countByPriority, otherIntegrations, projectName } from "@/app/lib/project-builder/requirements";
import { CONDENSED, SANS, btn, btnDisabled, ghost, h3, label, status, textarea } from "./builder-styles";

export interface ReadOnlyViewProps {
  state: BriefState;
  status: BriefStatus;
  submittedAt: string | null;
  onChangeRequest: (message: string) => Promise<void>;
  changeNote: string;
  onReset: () => void;
}

function formatDate(iso: string | null): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleString("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

function Row({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return (
    <>
      <dt style={{ fontWeight: 700, color: BRAND.darkGreen, paddingRight: 14, borderBottom: `1px solid ${BRAND.border}` }}>{k}</dt>
      <dd style={{ borderBottom: `1px solid ${BRAND.border}`, color: BRAND.teal }}>{v}</dd>
    </>
  );
}

/**
 * The submitted view: the status, every answer by step, the requirements by
 * priority with their source, the ideas added and passed on, the change
 * request form and "Start a new brief". The answers, never a report.
 */
export default function ReadOnlyView({ state, status: briefStatus, submittedAt, onChangeRequest, changeNote, onReset }: ReadOnlyViewProps) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const reqs = buildRequirements(state);
  const c = countByPriority(reqs);
  const added = state.ideas.filter((i) => state.ideaPick[i.id] && state.ideaPick[i.id] !== "no");
  const passed = state.ideas.filter((i) => state.ideaPick[i.id] === "no");
  const path = PATHS.find((p) => p.key === state.path)?.title ?? "";
  const guard = [state.sso && "single sign-on", state.perms && "roles and permissions", state.audit && "audit trail", state.personal && "handles personal data"].filter(Boolean).join(", ");
  const send = async () => {
    if (busy || message.trim().length < 10) return;
    setBusy(true);
    try {
      await onChangeRequest(message.trim());
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ fontFamily: SANS }}>
      <dl className="pb-sum" style={{ borderTop: `1px solid ${BRAND.border}`, marginTop: 26 }}>
        <Row k={DONE.status} v={statusLabel(briefStatus)} />
        <Row k="Project" v={projectName(state)} />
        <Row k={DONE.submitted} v={formatDate(submittedAt)} />
        <Row k={DONE.whatYouSent} v={DONE.sent(reqs.length, c.Must, state.roles.length)} />
      </dl>

      <h3 style={h3}>{STEPS[0]}</h3>
      <dl className="pb-sum" style={{ borderTop: `1px solid ${BRAND.border}` }}>
        <Row k="Website" v={state.biz.website} />
        <Row k="About the business" v={state.biz.notes} />
        <Row k="Starting point" v={path} />
        <Row k="Idea" v={state.idea} />
        {state.path === "replace" && <Row k="Replacing" v={state.rep.sys} />}
        {state.path === "replace" && <Row k="Why" v={state.rep.reasons.join(", ")} />}
      </dl>

      <h3 style={h3}>{STEPS[1]}</h3>
      <dl className="pb-sum" style={{ borderTop: `1px solid ${BRAND.border}` }}>
        <Row k="Problem" v={state.problem} />
        <Row k="Who has it" v={state.audience} />
        <Row k="Success measure" v={state.success} />
        <Row k="Signs off the scope" v={state.signoff} />
        <Row k="Timing" v={state.timing} />
        <Row k="Budget" v={state.budget} />
        <Row k="Users" v={state.roles.join(", ")} />
      </dl>

      <h3 style={h3}>{STEPS[2]} and {STEPS[3].toLowerCase()}</h3>
      <dl className="pb-sum" style={{ borderTop: `1px solid ${BRAND.border}` }}>
        <Row k="Connections" v={state.integrations.concat(otherIntegrations(state)).join(", ")} />
        <Row k="Guardrails" v={guard} />
        <Row k="Standards" v={state.compliance.join(", ")} />
        <Row k="Data stored in" v={state.residency !== "No preference" ? state.residency : ""} />
        <Row k="Number of users" v={state.scale} />
        <Row k="Needs to be up" v={state.uptime} />
        <Row k="Who runs it" v={RUN_OPTIONS.find((r) => r.key === state.run)?.title ?? ""} />
        <Row k="Team skills" v={state.skills} />
        <Row k="Handover" v={HANDOVER.filter((h) => state.handover.includes(h.key)).map((h) => h.title).join(", ")} />
      </dl>

      <h3 style={h3}>Requirements</h3>
      {PRIORITIES.map((p) => {
        const xs = reqs.filter((r) => r.pri === p);
        if (!xs.length) return null;
        return (
          <div key={p} style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: CONDENSED, fontSize: 18, fontWeight: 600, color: BRAND.darkGreen, margin: "10px 0 4px" }}>{PRIORITY_LABELS[p]} ({xs.length})</div>
            <ul className="pb-items" style={{ marginTop: 0, borderTop: `1px solid ${BRAND.border}` }}>
              {xs.map((r, i) => (
                <li key={`${p}-${i}`} style={{ borderBottom: `1px solid ${BRAND.border}`, display: "block" }}>
                  <span style={{ color: BRAND.darkGreen }}>{r.text}</span>
                  <span style={{ display: "block", fontSize: 13, color: BRAND.teal, marginTop: 2 }}>{SOURCE_LABELS[r.src]} {r.built ? ", already built" : ""}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <h3 style={h3}>AI ideas</h3>
      <dl className="pb-sum" style={{ borderTop: `1px solid ${BRAND.border}` }}>
        <Row k="Added" v={added.map((i) => `${i.title} (${PRIORITY_LABELS[state.ideaPick[i.id] as keyof typeof PRIORITY_LABELS]})`).join("; ") || "None"} />
        <Row k="Passed on" v={passed.map((i) => i.title).join("; ") || "None"} />
      </dl>

      <h3 style={h3}>{DONE.changeTitle}</h3>
      <p style={{ margin: "0 0 12px", color: BRAND.teal, fontSize: 15 }}>{DONE.changeLede}</p>
      <label htmlFor="pb-change" style={label}>{DONE.changePlaceholder}</label>
      <textarea id="pb-change" value={message} onChange={(e) => setMessage(e.target.value)} disabled={sent} maxLength={1000} style={{ ...textarea, maxWidth: 640 }} />
      <div style={{ marginTop: 10 }}>
        <button type="button" onClick={() => void send()} disabled={busy || sent || message.trim().length < 10} style={{ ...btn, ...(busy || sent || message.trim().length < 10 ? btnDisabled : {}) }}>
          {DONE.changeButton}
        </button>
      </div>
      <p style={status} role="status">{changeNote || (message.trim().length > 0 && message.trim().length < 10 ? DONE.changeTooShort : "")}</p>

      <button type="button" onClick={onReset} style={{ ...ghost, paddingLeft: 0 }}>{SAVE.startNew}</button>
    </div>
  );
}
