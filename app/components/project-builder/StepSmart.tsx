"use client";

import { BRAND } from "@/app/lib/brand";
import { IDEAS_CAP_PER_BRIEF, type BriefState } from "@/app/lib/project-builder/brief";
import { PRIORITIES, PRIORITY_LABELS, type Priority } from "@/app/lib/project-builder/catalogue";
import { SMART, STEP_HEADINGS } from "@/app/lib/project-builder/copy";
import { CONDENSED, SANS, assist, assistText, btn, btnAltSmall, btnDisabled, h2, hint, lede, status, tag } from "./builder-styles";

export interface StepSmartProps {
  state: BriefState;
  busy: boolean;
  loading: boolean;
  note: string;
  runs: number;
  update: (patch: Partial<BriefState>) => void;
  onRun: () => void;
  canUndo: boolean;
  onUndo: () => void;
}

/** Step 5: the ideas list with per idea priorities, the loading line, "Find ways to make it smarter" and "Fresh ideas" under the per brief limit. */
export default function StepSmart({ state, busy, loading, note, runs, update, onRun, canUndo, onUndo }: StepSmartProps) {
  const n = state.ideas.filter((i) => state.ideaPick[i.id] && state.ideaPick[i.id] !== "no").length;
  const pick = (id: string, v: Priority | "no") => {
    const next = { ...state.ideaPick };
    if (next[id] === v) delete next[id];
    else next[id] = v;
    update({ ideaPick: next });
  };
  const atLimit = runs >= IDEAS_CAP_PER_BRIEF;
  return (
    <div>
      <h2 style={h2}>{STEP_HEADINGS[4].title}</h2>
      <p style={lede}>{STEP_HEADINGS[4].lede}</p>
      {state.ideas.length > 0 && (
        <div style={assist}>
          <p style={assistText}>{n ? SMART.added(n) : SMART.nothingAdded}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={onRun} disabled={busy || atLimit} style={{ ...btnAltSmall, ...(busy || atLimit ? btnDisabled : {}) }}>
              <span aria-hidden="true" style={{ marginRight: 6 }}>&#10022;</span>
              {SMART.fresh}
            </button>
            {canUndo && <button type="button" onClick={onUndo} style={btnAltSmall}>Undo</button>}
          </div>
        </div>
      )}
      <p style={status} role="status">{note}</p>
      {loading ? (
        <div role="status" style={{ display: "flex", alignItems: "center", gap: 12, padding: 20, border: `2px dashed ${BRAND.border}`, color: BRAND.darkGreen, fontFamily: SANS }}>
          <i aria-hidden="true" style={{ width: 14, height: 14, borderRadius: "50%", background: BRAND.brandGreen, display: "inline-block" }} />
          {SMART.loading}
        </div>
      ) : state.ideas.length === 0 ? (
        <>
          <button type="button" onClick={onRun} disabled={busy} style={{ ...btn, ...(busy ? btnDisabled : {}) }}>
            <span aria-hidden="true" style={{ marginRight: 6 }}>&#10022;</span>
            {SMART.find}
          </button>
          <p style={{ ...hint, marginTop: 8 }}>{SMART.findHint}</p>
        </>
      ) : (
        <div className="pb-ideas">
          {state.ideas.map((i) => {
            const p = state.ideaPick[i.id] ?? "";
            const on = p && p !== "no";
            return (
              <article key={i.id} style={{ background: BRAND.white, border: `2px solid ${on ? BRAND.darkGreen : BRAND.border}`, boxShadow: on ? `inset 6px 0 0 ${BRAND.brandGreen}` : "none", opacity: p === "no" ? 0.6 : 1, padding: "16px 18px", fontFamily: SANS, color: BRAND.teal }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "0 0 10px" }}>
                  <span style={tag}>{i.kind}</span>
                  <span style={tag}>{i.size}</span>
                  {i.human && <span style={tag}>{SMART.human}</span>}
                </div>
                <h4 style={{ fontFamily: CONDENSED, fontWeight: 600, color: BRAND.darkGreen, fontSize: 22, margin: "0 0 4px" }}>{i.title}</h4>
                <p style={{ margin: "0 0 8px", fontSize: 16 }}>{i.what}</p>
                {i.buildsOn && <p style={{ margin: "0 0 8px", fontSize: 15 }}><strong style={{ color: BRAND.darkGreen }}>{SMART.buildsOn}</strong> {i.buildsOn}</p>}
                {i.helps && <p style={{ margin: "0 0 8px", fontSize: 15 }}><strong style={{ color: BRAND.darkGreen }}>{SMART.helps}</strong> {i.helps}</p>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }} role="group" aria-label={`Add ${i.title}`}>
                  {PRIORITIES.map((x) => (
                    <button key={x} type="button" onClick={() => pick(i.id, x)} aria-pressed={p === x} style={{ border: `1px solid ${BRAND.teal}`, background: p === x ? BRAND.darkGreen : "transparent", color: p === x ? BRAND.white : BRAND.darkGreen, padding: "5px 10px", cursor: "pointer", fontSize: 14, fontFamily: SANS }}>
                      {PRIORITY_LABELS[x]}
                    </button>
                  ))}
                  <button type="button" onClick={() => pick(i.id, "no")} aria-pressed={p === "no"} style={{ border: `1px solid ${BRAND.teal}`, background: p === "no" ? BRAND.darkGreen : "transparent", color: p === "no" ? BRAND.white : BRAND.darkGreen, padding: "5px 10px", cursor: "pointer", fontSize: 14, fontFamily: SANS }}>
                    {SMART.notForUs}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
