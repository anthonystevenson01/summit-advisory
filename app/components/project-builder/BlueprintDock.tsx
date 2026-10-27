"use client";

import type { CSSProperties } from "react";
import { BRAND } from "@/app/lib/brand";
import { PRIORITIES, PRIORITY_LABELS, SOURCE_KEYS, SOURCE_LABELS, STEPS, type Priority } from "@/app/lib/project-builder/catalogue";
import type { BriefState } from "@/app/lib/project-builder/brief";
import { DOCK, SOURCE_DOTS } from "@/app/lib/project-builder/copy";
import { buildRequirements, completeness, countByPriority, essentials, projectName, requirementKey, type Requirement } from "@/app/lib/project-builder/requirements";
import { CONDENSED, DOCK_BODY, DOCK_RULE, SANS, dockLabel, dockPanel } from "./builder-styles";

export interface BlueprintDockProps {
  state: BriefState;
  open: boolean;
  onToggle: () => void;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onPriority: (req: Requirement, pri: Priority) => void;
  onRemove: (req: Requirement) => void;
  onGoto: (step: number) => void;
}

function dot(src: string, size = 10): CSSProperties {
  const d = SOURCE_DOTS[src] ?? SOURCE_DOTS.you;
  return {
    display: "inline-block",
    width: size,
    height: size,
    border: `1.5px solid ${d.stroke}`,
    background: d.fill === "none" ? "transparent" : d.fill,
    marginRight: 8,
    verticalAlign: -1,
    flex: "none",
  };
}

function shorten(t: string): string {
  return t.length > 90 ? `${t.slice(0, 87).replace(/\s+\S*$/, "")}...` : t;
}

const ghostLight: CSSProperties = { background: "none", border: 0, color: BRAND.white, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", padding: "6px 0", fontSize: 14, fontFamily: SANS };

/**
 * The docked strip at the bottom (count, Must count, percent, the dots,
 * Open and Close) and the open panel: the name, the meter, the tally, the
 * legend, the business note, the selected requirement with its priority
 * buttons, Remove and "Change on {step}", the gap line, and the full list
 * by priority coloured by source.
 */
export default function BlueprintDock({ state, open, onToggle, selectedKey, onSelect, onPriority, onRemove, onGoto }: BlueprintDockProps) {
  const reqs = buildRequirements(state);
  const c = countByPriority(reqs);
  const pct = completeness(state);
  const miss = essentials(state).filter((e) => !e.met).length;
  const present = SOURCE_KEYS.filter((k) => reqs.some((r) => r.src === k));
  const selected = selectedKey ? reqs.find((r) => requirementKey(r) === selectedKey) ?? null : null;
  const editable = selected ? ["feature", "custom", "idea"].includes(selected.ref.kind) : false;
  const removable = selected ? ["feature", "custom", "idea", "integration"].includes(selected.ref.kind) : false;
  const stepOf = selected && selected.ref.kind === "step" ? selected.ref.step : null;

  return (
    <section className="pb-dock" aria-label="Your project blueprint" style={{ ...dockPanel, borderTop: `2px solid ${BRAND.brandGreen}` }}>
      <button type="button" className="pb-dock-bar" onClick={onToggle} aria-expanded={open} aria-controls="pb-bp">
        <span className="pb-dock-k" style={dockLabel}>{DOCK.label}</span>
        <span className="pb-mdots" aria-hidden="true">
          {reqs.slice(-24).map((r, i) => <i key={i} style={{ ...dot(r.src, 8), marginRight: 0 }} />)}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontFamily: CONDENSED, fontSize: 22, color: BRAND.white }}>{reqs.length}</b> {DOCK.requirements(reqs.length).replace(/^\d+ /, "")} &middot; {DOCK.mustHave(c.Must)}
        </span>
        <span className="pb-dock-pc" style={{ whiteSpace: "nowrap" }}>{DOCK.ready(pct)}</span>
        <span style={{ color: BRAND.white, fontWeight: 700, whiteSpace: "nowrap" }}>{open ? `${DOCK.close} ▾` : `${DOCK.open} ▴`}</span>
      </button>
      {open && (
        <div id="pb-bp" className="pb-dock-panel">
          <div className="pb-dock-grid">
            <div>
              <h3 style={{ fontFamily: CONDENSED, color: BRAND.white, fontSize: 28, lineHeight: 1.1, margin: "6px 0 16px", wordBreak: "break-word" }}>{projectName(state)}</h3>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}>
                <span>{DOCK.readyToSubmit}</span>
                <span>{pct}%</span>
              </div>
              <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={DOCK.meterLabel} style={{ height: 10, background: "rgba(255,255,255,0.12)", margin: "4px 0 6px" }}>
                <i style={{ display: "block", height: "100%", width: `${pct}%`, background: BRAND.brandGreen }} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 14, margin: "14px 0 8px" }}>
                <span><b style={{ fontFamily: CONDENSED, fontSize: 22, color: BRAND.white, marginRight: 3 }}>{c.Must}</b> {DOCK.must}</span>
                <span><b style={{ fontFamily: CONDENSED, fontSize: 22, color: BRAND.white, marginRight: 3 }}>{c.Should}</b> {DOCK.should}</span>
                <span><b style={{ fontFamily: CONDENSED, fontSize: 22, color: BRAND.white, marginRight: 3 }}>{c.Could}</b> {DOCK.could}</span>
              </div>
              {present.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", fontSize: 13, margin: "8px 0 6px" }}>
                  {present.map((k) => (
                    <span key={k} style={{ display: "inline-flex", alignItems: "center" }}><span style={dot(k)} />{SOURCE_LABELS[k]}</span>
                  ))}
                </div>
              )}
              {state.biz.notes.trim() && (
                <div style={{ border: `1px solid ${DOCK_RULE}`, padding: "10px 12px", margin: "10px 0" }}>
                  <div style={dockLabel}>{DOCK.aboutBusiness}</div>
                  <p style={{ margin: "4px 0 0", fontSize: 14 }}>{shorten(state.biz.notes.trim())}</p>
                  <button type="button" onClick={() => onGoto(0)} style={ghostLight}>{DOCK.edit}</button>
                </div>
              )}
              {selected && (
                <div role="dialog" aria-label="Requirement" style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${BRAND.brandGreen}`, padding: "12px 14px", margin: "10px 0" }}>
                  <p style={{ color: BRAND.white, margin: "0 0 6px", fontSize: 15 }}>{selected.text}</p>
                  <p style={{ fontSize: 13, margin: "0 0 8px", display: "flex", alignItems: "center" }}><span style={dot(selected.src)} />{SOURCE_LABELS[selected.src]} &middot; {selected.cat}</p>
                  {editable ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                      {PRIORITIES.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => onPriority(selected, p)}
                          aria-pressed={selected.pri === p}
                          style={{ border: `1px solid ${DOCK_BODY}`, background: selected.pri === p ? BRAND.brandGreen : "transparent", color: BRAND.white, padding: "4px 9px", fontSize: 13, cursor: "pointer", fontFamily: SANS }}
                        >
                          {PRIORITY_LABELS[p]}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, margin: "0 0 8px" }}>{PRIORITY_LABELS[selected.pri]}</p>
                  )}
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    {removable && <button type="button" onClick={() => onRemove(selected)} style={ghostLight}>{DOCK.remove}</button>}
                    {stepOf !== null && <button type="button" onClick={() => onGoto(stepOf)} style={ghostLight}>{DOCK.changeOn(STEPS[stepOf])}</button>}
                    <button type="button" onClick={() => onSelect(null)} style={ghostLight}>{DOCK.closeDetail}</button>
                  </div>
                </div>
              )}
              {state.step > 0 && miss > 0 && (
                <div style={{ marginTop: 16, padding: "10px 12px", border: `1px solid ${BRAND.brandGreen}`, fontSize: 15, color: BRAND.white }}>{DOCK.gap(miss)}</div>
              )}
            </div>
            <div>
              {reqs.length === 0 ? (
                <p style={{ fontStyle: "italic", fontSize: 15 }}>{DOCK.empty}</p>
              ) : (
                <>
                  <p style={{ fontSize: 13, margin: "0 0 10px" }}>{DOCK.hint}</p>
                  {PRIORITIES.map((p) => {
                    const xs = reqs.filter((r) => r.pri === p);
                    if (!xs.length) return null;
                    return (
                      <div key={p}>
                        <div style={{ ...dockLabel, marginTop: 12 }}>{PRIORITY_LABELS[p]} ({xs.length})</div>
                        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                          {xs.map((r) => {
                            const key = requirementKey(r);
                            const sel = key === selectedKey;
                            return (
                              <li key={key} style={{ borderTop: `1px solid ${DOCK_RULE}` }}>
                                <button
                                  type="button"
                                  onClick={() => onSelect(sel ? null : key)}
                                  style={{ display: "flex", alignItems: "center", width: "100%", textAlign: "left", background: "none", border: 0, color: sel ? BRAND.white : DOCK_BODY, fontWeight: sel ? 700 : 400, padding: "8px 0", cursor: "pointer", fontSize: 14, fontFamily: SANS }}
                                >
                                  <span style={dot(r.src)} />
                                  {shorten(r.text)}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
