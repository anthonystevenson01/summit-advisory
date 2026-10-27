"use client";

import { useState } from "react";
import { BUDGET_OPTIONS, PROBLEM_STARTERS, ROLES, SIGNOFF_STARTERS, SUCCESS_STARTERS, TIMING_OPTIONS } from "@/app/lib/project-builder/catalogue";
import type { BriefState } from "@/app/lib/project-builder/brief";
import { GOAL, STEP_HEADINGS } from "@/app/lib/project-builder/copy";
import { btnAlt, chip, chips, field, fieldWrap, h2, h3, h3First, hint, label, lede, select, textarea } from "./builder-styles";
import AssistStrip from "./AssistStrip";
import Starters, { selectBlank } from "./Starters";

export interface AssistHandlers {
  busy: boolean;
  note: string;
  canUndo: boolean;
  onUndo: () => void;
  onRun: () => void;
}

export interface StepGoalProps {
  state: BriefState;
  hasContext: boolean;
  update: (patch: Partial<BriefState>) => void;
  assist: AssistHandlers;
}

/** Step 2: the outcome fields with starters and the two selects, then the roles chips and the add role field. */
export default function StepGoal({ state, hasContext, update, assist }: StepGoalProps) {
  const [role, setRole] = useState("");
  const all = ROLES.concat(state.roles.filter((r) => !ROLES.includes(r)));
  const toggleRole = (r: string) => update({ roles: state.roles.includes(r) ? state.roles.filter((x) => x !== r) : state.roles.concat(r) });
  const addRole = () => {
    const t = role.trim();
    if (t && !state.roles.includes(t)) update({ roles: state.roles.concat(t) });
    setRole("");
  };
  const pick = (key: "problem" | "success" | "signoff", id: string) => (v: string) => {
    update({ [key]: v } as Partial<BriefState>);
    requestAnimationFrame(() => selectBlank(document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null, v));
  };

  return (
    <div>
      <h2 style={h2}>{STEP_HEADINGS[1].title}</h2>
      <p style={lede}>{STEP_HEADINGS[1].lede}</p>

      <h3 style={h3First}>{GOAL.outcomeTitle}</h3>
      <p style={lede}>{GOAL.outcomeLede}</p>
      <AssistStrip text={hasContext ? GOAL.assistWithContext : GOAL.assistWithout} label={GOAL.assistButton} busy={assist.busy} onRun={assist.onRun} canUndo={assist.canUndo} onUndo={assist.onUndo} note={assist.note} />

      <div style={fieldWrap}>
        <label htmlFor="pb-problem" style={label}>{GOAL.problemLabel}</label>
        <textarea id="pb-problem" value={state.problem} onChange={(e) => update({ problem: e.target.value })} placeholder={GOAL.problemPlaceholder} style={textarea} />
        <Starters list={PROBLEM_STARTERS} onPick={pick("problem", "pb-problem")} />
      </div>
      <div style={fieldWrap}>
        <label htmlFor="pb-aud" style={label}>{GOAL.audienceLabel}</label>
        <input id="pb-aud" type="text" value={state.audience} onChange={(e) => update({ audience: e.target.value })} placeholder={GOAL.audiencePlaceholder} style={field} />
      </div>
      <div style={fieldWrap}>
        <label htmlFor="pb-succ" style={label}>{GOAL.successLabel}</label>
        <p style={hint}>{GOAL.successHint}</p>
        <textarea id="pb-succ" value={state.success} onChange={(e) => update({ success: e.target.value })} placeholder={GOAL.successPlaceholder} style={textarea} />
        <Starters list={SUCCESS_STARTERS} onPick={pick("success", "pb-succ")} />
      </div>
      <div style={fieldWrap}>
        <label htmlFor="pb-sign" style={label}>{GOAL.signoffLabel}</label>
        <input id="pb-sign" type="text" value={state.signoff} onChange={(e) => update({ signoff: e.target.value })} placeholder={GOAL.signoffPlaceholder} style={field} />
        <Starters list={SIGNOFF_STARTERS} onPick={pick("signoff", "pb-sign")} />
      </div>
      <div className="pb-two">
        <div style={fieldWrap}>
          <label htmlFor="pb-time" style={label}>{GOAL.timingLabel}</label>
          <select id="pb-time" value={state.timing} onChange={(e) => update({ timing: e.target.value })} style={select}>
            {TIMING_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div style={fieldWrap}>
          <label htmlFor="pb-bud" style={label}>{GOAL.budgetLabel}</label>
          <select id="pb-bud" value={state.budget} onChange={(e) => update({ budget: e.target.value })} style={select}>
            {BUDGET_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <h3 style={h3}>{GOAL.peopleTitle}</h3>
      <p style={lede}>{GOAL.peopleLede}</p>
      <div style={chips} role="group" aria-label="Users">
        {all.map((r) => (
          <button key={r} type="button" onClick={() => toggleRole(r)} aria-pressed={state.roles.includes(r)} style={chip(state.roles.includes(r))}>{r}</button>
        ))}
      </div>
      <div style={{ ...fieldWrap, marginTop: 22 }}>
        <label htmlFor="pb-role" style={label}>{GOAL.roleLabel}</label>
        <div className="pb-adder-2">
          <input
            id="pb-role"
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRole();
              }
            }}
            placeholder={GOAL.rolePlaceholder}
            style={field}
          />
          <button type="button" onClick={addRole} style={btnAlt}>{GOAL.addRole}</button>
        </div>
      </div>
    </div>
  );
}
