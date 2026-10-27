"use client";

import { BRAND } from "@/app/lib/brand";
import { COMPLIANCE, HANDOVER, RESIDENCY_OPTIONS, RUN_OPTIONS, SCALE_OPTIONS, UPTIME_OPTIONS, type HandoverKey, type RunKey } from "@/app/lib/project-builder/catalogue";
import type { BriefState } from "@/app/lib/project-builder/brief";
import { RULES, STEP_HEADINGS } from "@/app/lib/project-builder/copy";
import type { DevAnswer } from "@/app/lib/project-builder/suggestions";
import { SANS, btnAltSmall, chip, chips, field, fieldWrap, h2, h3, h3First, hint, label, lede, select } from "./builder-styles";
import AssistStrip from "./AssistStrip";
import type { AssistHandlers } from "./StepGoal";

export interface StepRulesProps {
  state: BriefState;
  update: (patch: Partial<BriefState>) => void;
  guardrails: AssistHandlers;
  running: AssistHandlers;
  onDevAnswer: (answer: DevAnswer) => void;
}

/** Step 4: the guardrail chips, standards, the three selects, then the running options, the quick question, skills and handover. */
export default function StepRules({ state, update, guardrails, running, onDevAnswer }: StepRulesProps) {
  const flag = (k: "sso" | "perms" | "audit" | "personal", t: string) => (
    <button type="button" onClick={() => update({ [k]: !state[k] } as Partial<BriefState>)} aria-pressed={state[k]} style={chip(state[k])}>{t}</button>
  );
  const toggleComp = (c: string) => update({ compliance: state.compliance.includes(c) ? state.compliance.filter((x) => x !== c) : state.compliance.concat(c) });
  const toggleHand = (k: HandoverKey) => update({ handover: state.handover.includes(k) ? state.handover.filter((x) => x !== k) : state.handover.concat(k) });
  const showSkills = state.run === "team" || state.run === "mix";

  return (
    <div>
      <h2 style={h2}>{STEP_HEADINGS[3].title}</h2>
      <p style={lede}>{STEP_HEADINGS[3].lede}</p>

      <h3 style={h3First}>{RULES.guardTitle}</h3>
      <p style={lede}>{RULES.guardLede}</p>
      <AssistStrip text={RULES.guardAssist} label={RULES.guardButton} busy={guardrails.busy} onRun={guardrails.onRun} canUndo={guardrails.canUndo} onUndo={guardrails.onUndo} note={guardrails.note} />
      <div style={fieldWrap}>
        <span style={label}>{RULES.applyLabel}</span>
        <div style={chips}>{flag("sso", RULES.sso)}{flag("perms", RULES.perms)}{flag("audit", RULES.audit)}{flag("personal", RULES.personal)}</div>
      </div>
      <div style={fieldWrap}>
        <span style={label}>{RULES.standardsLabel}</span>
        <div style={chips}>
          {COMPLIANCE.map((c) => (
            <button key={c} type="button" onClick={() => toggleComp(c)} aria-pressed={state.compliance.includes(c)} style={chip(state.compliance.includes(c))}>{c}</button>
          ))}
        </div>
      </div>
      <div className="pb-two">
        <div style={fieldWrap}>
          <label htmlFor="pb-res" style={label}>{RULES.residencyLabel}</label>
          <select id="pb-res" value={state.residency} onChange={(e) => update({ residency: e.target.value })} style={select}>
            {RESIDENCY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div style={fieldWrap}>
          <label htmlFor="pb-scale" style={label}>{RULES.scaleLabel}</label>
          <select id="pb-scale" value={state.scale} onChange={(e) => update({ scale: e.target.value })} style={select}>
            {SCALE_OPTIONS.map((o) => <option key={o} value={o}>{o || "Choose one"}</option>)}
          </select>
        </div>
      </div>
      <div style={{ ...fieldWrap, maxWidth: "50%", minWidth: 260 }}>
        <label htmlFor="pb-up" style={label}>{RULES.uptimeLabel}</label>
        <select id="pb-up" value={state.uptime} onChange={(e) => update({ uptime: e.target.value })} style={select}>
          {UPTIME_OPTIONS.map((o) => <option key={o} value={o}>{o || "Choose one"}</option>)}
        </select>
      </div>

      <h3 style={h3}>{RULES.runTitle}</h3>
      <p style={lede}>{RULES.runLede}</p>
      <AssistStrip text={RULES.quickQuestion} label={RULES.suggestForMe} busy={running.busy} onRun={running.onRun} canUndo={running.canUndo} onUndo={running.onUndo} note={running.note}>
        <button type="button" onClick={() => onDevAnswer("yes")} style={btnAltSmall}>{RULES.yes}</button>
        <button type="button" onClick={() => onDevAnswer("some")} style={btnAltSmall}>{RULES.some}</button>
        <button type="button" onClick={() => onDevAnswer("no")} style={btnAltSmall}>{RULES.no}</button>
      </AssistStrip>
      <div className="pb-opts" role="radiogroup" aria-label="Who runs it">
        {RUN_OPTIONS.map((r) => {
          const on = state.run === r.key;
          return (
            <button
              key={r.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => update({ run: r.key as RunKey })}
              style={{ display: "flex", gap: 12, alignItems: "flex-start", textAlign: "left", background: BRAND.white, border: `2px solid ${on ? BRAND.darkGreen : BRAND.border}`, padding: "14px 16px", cursor: "pointer", color: BRAND.teal, fontFamily: SANS, fontSize: 15, borderRadius: 0 }}
            >
              <span aria-hidden="true" style={{ flex: "none", width: 18, height: 18, borderRadius: "50%", border: `2px solid ${on ? BRAND.brandGreen : BRAND.teal}`, marginTop: 3, background: on ? BRAND.brandGreen : "transparent", boxShadow: on ? `inset 0 0 0 3px ${BRAND.white}` : "none" }} />
              <span><strong style={{ display: "block", color: BRAND.darkGreen }}>{r.title}</strong>{r.body}</span>
            </button>
          );
        })}
      </div>
      {showSkills && (
        <div style={{ ...fieldWrap, marginTop: 22 }}>
          <label htmlFor="pb-skills" style={label}>{RULES.skillsLabel}</label>
          <p style={hint}>{RULES.skillsHint}</p>
          <input id="pb-skills" type="text" value={state.skills} onChange={(e) => update({ skills: e.target.value })} placeholder={RULES.skillsPlaceholder} style={field} />
        </div>
      )}
      <div style={{ ...fieldWrap, marginTop: 22 }}>
        <span style={label}>{RULES.handoverLabel}</span>
        <div style={chips}>
          {HANDOVER.map((h) => (
            <button key={h.key} type="button" onClick={() => toggleHand(h.key)} aria-pressed={state.handover.includes(h.key)} style={chip(state.handover.includes(h.key))}>{h.title}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
