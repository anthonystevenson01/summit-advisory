"use client";

import { useState } from "react";
import { BRAND } from "@/app/lib/brand";
import { FEATURES, INTEGRATIONS, PRIORITIES, PRIORITY_LABELS, SOURCE_LABELS, type FeatureKey, type Priority } from "@/app/lib/project-builder/catalogue";
import type { BriefState } from "@/app/lib/project-builder/brief";
import { STEP_HEADINGS, WHAT } from "@/app/lib/project-builder/copy";
import { SANS, btnAlt, card, cardBody, cardPri, cardTitle, chip, chips, field, fieldWrap, ghost, h2, h3, h3First, label, lede, pbtn, select } from "./builder-styles";
import AssistStrip from "./AssistStrip";
import type { AssistHandlers } from "./StepGoal";

export interface StepWhatProps {
  state: BriefState;
  update: (patch: Partial<BriefState>) => void;
  features: AssistHandlers;
  connections: AssistHandlers;
}

const nextPri = (p: string): Priority | "" => (p === "Must" ? "Should" : p === "Should" ? "Could" : p === "Could" ? "" : "Must");

/** Step 3: the feature cards, the custom requirement adder and list, then the connections chips and the other field. */
export default function StepWhat({ state, update, features, connections }: StepWhatProps) {
  const [text, setText] = useState("");
  const [pri, setPri] = useState<Priority>("Must");

  const tapFeature = (key: FeatureKey) => {
    const was = state.features[key];
    const p = nextPri(was ?? "");
    const next = { ...state.features };
    const src = { ...state.featSrc };
    if (p) {
      next[key] = p;
      if (!was) src[key] = "you";
    } else {
      delete next[key];
      delete src[key];
    }
    update({ features: next, featSrc: src });
  };
  const addReq = () => {
    const t = text.trim();
    if (!t) return;
    update({ custom: state.custom.concat({ text: t, pri, cat: "Feature", src: "you", built: false }) });
    setText("");
  };
  const cyclePri = (i: number) => {
    const c = state.custom[i];
    const p: Priority = c.pri === "Must" ? "Should" : c.pri === "Should" ? "Could" : "Must";
    update({ custom: state.custom.map((x, j) => (j === i ? { ...x, pri: p } : x)) });
  };
  const removeReq = (i: number) => update({ custom: state.custom.filter((_, j) => j !== i) });
  const toggleInt = (x: string) => update({ integrations: state.integrations.includes(x) ? state.integrations.filter((y) => y !== x) : state.integrations.concat(x) });

  return (
    <div>
      <h2 style={h2}>{STEP_HEADINGS[2].title}</h2>
      <p style={lede}>{STEP_HEADINGS[2].lede}</p>

      <h3 style={h3First}>{WHAT.featuresTitle}</h3>
      <p style={lede}>{WHAT.featuresLede}</p>
      <AssistStrip text={WHAT.assistText} label={WHAT.assistButton} busy={features.busy} onRun={features.onRun} canUndo={features.canUndo} onUndo={features.onUndo} note={features.note} />
      <p style={{ fontSize: 15, margin: "0 0 16px", fontFamily: SANS, color: BRAND.teal }}>{WHAT.legend}</p>
      <div className="pb-feats">
        {FEATURES.map((f) => {
          const p = state.features[f.key] ?? "";
          return (
            <button key={f.key} type="button" onClick={() => tapFeature(f.key)} aria-label={`${f.title}${p ? `, ${PRIORITY_LABELS[p]}` : ", not added"}`} style={card(p)}>
              <strong style={cardTitle}>{f.title}</strong>
              <span style={cardBody}>{f.body}</span>
              {p && <span style={cardPri(p)}>{p}</span>}
            </button>
          );
        })}
      </div>
      <div style={{ ...fieldWrap, marginTop: 28 }}>
        <label htmlFor="pb-req" style={label}>{WHAT.customLabel}</label>
        <div className="pb-adder">
          <input
            id="pb-req"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addReq();
              }
            }}
            placeholder={WHAT.customPlaceholder}
            style={field}
          />
          <select aria-label="Priority" value={pri} onChange={(e) => setPri(e.target.value as Priority)} style={select}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </select>
          <button type="button" onClick={addReq} style={btnAlt}>{WHAT.add}</button>
        </div>
      </div>
      {state.custom.length > 0 && (
        <ul className="pb-items" style={{ borderTop: `1px solid ${BRAND.border}` }}>
          {state.custom.map((c, i) => (
            <li key={`${i}-${c.text}`} style={{ borderBottom: `1px solid ${BRAND.border}` }}>
              <div style={{ flex: 1, color: BRAND.darkGreen, fontFamily: SANS }}>
                {c.text}
                <span style={{ display: "block", fontSize: 13, color: BRAND.teal, marginTop: 2 }}>
                  {c.built ? WHAT.builtTag : c.src === "system" ? WHAT.systemTag(state.rep.sys) : SOURCE_LABELS[c.src]}
                </span>
              </div>
              <button type="button" onClick={() => cyclePri(i)} aria-label={`Priority ${PRIORITY_LABELS[c.pri]}. Change`} style={pbtn}>{c.pri}</button>
              <button type="button" onClick={() => removeReq(i)} style={ghost}>{WHAT.remove}</button>
            </li>
          ))}
        </ul>
      )}

      <h3 style={h3}>{WHAT.connectionsTitle}</h3>
      <p style={lede}>{WHAT.connectionsLede}</p>
      <AssistStrip text={WHAT.connectionsAssist} label={WHAT.connectionsButton} busy={connections.busy} onRun={connections.onRun} canUndo={connections.canUndo} onUndo={connections.onUndo} note={connections.note} />
      <div style={chips} role="group" aria-label="Systems">
        {INTEGRATIONS.map((x) => (
          <button key={x} type="button" onClick={() => toggleInt(x)} aria-pressed={state.integrations.includes(x)} style={chip(state.integrations.includes(x))}>{x}</button>
        ))}
      </div>
      <div style={{ ...fieldWrap, marginTop: 22 }}>
        <label htmlFor="pb-int" style={label}>{WHAT.otherLabel}</label>
        <input id="pb-int" type="text" value={state.intOther} onChange={(e) => update({ intOther: e.target.value })} placeholder={WHAT.otherPlaceholder} style={field} />
      </div>
    </div>
  );
}
