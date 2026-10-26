"use client";

import { useState } from "react";
import { BRAND } from "@/app/lib/brand";
import { PRIORITY_LABELS, REPLACEMENT_REASONS, SYSTEM_CATEGORIES, type Priority } from "@/app/lib/project-builder/catalogue";
import type { BriefState } from "@/app/lib/project-builder/brief";
import { REPLACE } from "@/app/lib/project-builder/copy";
import { systemCapabilities } from "@/app/lib/project-builder/requirements";
import { CONDENSED, SANS, btn, btnAlt, btnAltSmall, btnDisabled, card, cardBody, cardPri, cardTitle, chip, chips, field, fieldWrap, label, status } from "./builder-styles";

export interface ReplaceSystemProps {
  state: BriefState;
  busy: boolean;
  note: string;
  update: (patch: Partial<BriefState>) => void;
  onLookup: (name: string) => void;
  onBuild: () => void;
  canUndo: boolean;
  onUndo: () => void;
}

const nextPri = (p: string): Priority | "" => (p === "Must" ? "Should" : p === "Should" ? "Could" : p === "Could" ? "" : "Must");

const sectionTitle = { fontFamily: CONDENSED, fontWeight: 600, color: BRAND.darkGreen, fontSize: 24, margin: "0 0 4px" } as const;
const sub = { margin: "0 0 12px", fontSize: 15, fontFamily: SANS, color: BRAND.teal } as const;

/**
 * The replace route: category chips, the system grid, "Not listed" with
 * "Use this" (the lookup helper), the capability cards cycling Must, Should,
 * Could, off, "Select what most teams use", the reasons, the switch over
 * chips and "Build my requirements list" (local, through the engine).
 */
export default function ReplaceSystem({ state, busy, note, update, onLookup, onBuild, canUndo, onUndo }: ReplaceSystemProps) {
  const R = state.rep;
  const [other, setOther] = useState(R.other);
  const cat = SYSTEM_CATEGORIES.find((x) => x.category === R.cat);
  const caps = systemCapabilities(state);
  const sysName = R.sys || "it";
  const rep = (patch: Partial<BriefState["rep"]>) => update({ rep: { ...R, ...patch } });
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : list.concat(v));

  return (
    <div style={{ borderTop: `2px solid ${BRAND.border}`, marginTop: 8, paddingTop: 22 }}>
      <section style={{ margin: "0 0 26px" }}>
        <h3 style={sectionTitle}>{REPLACE.whatTitle}</h3>
        <p style={sub}>{REPLACE.whatLede}</p>
        <div style={chips} role="group" aria-label="Kind of system">
          {SYSTEM_CATEGORIES.map((x) => (
            <button key={x.category} type="button" onClick={() => rep({ cat: x.category })} aria-pressed={R.cat === x.category} style={chip(R.cat === x.category)}>
              {x.category}
            </button>
          ))}
        </div>
        {cat && (
          <div className="pb-sysgrid" role="group" aria-label="System">
            {Object.keys(cat.systems).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => rep({ sys: n, other: "", caps: {}, extra: {} })}
                aria-pressed={R.sys === n}
                style={{ ...chip(R.sys === n), textAlign: "left", padding: "10px 12px", fontWeight: 700 }}
              >
                {n}
              </button>
            ))}
          </div>
        )}
        <div style={{ ...fieldWrap, marginTop: 14 }}>
          <label htmlFor="pb-r-other" style={label}>{REPLACE.notListedLabel}</label>
          <div className="pb-adder-2">
            <input
              id="pb-r-other"
              type="text"
              value={other}
              onChange={(e) => setOther(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (other.trim()) onLookup(other.trim());
                }
              }}
              placeholder={REPLACE.notListedPlaceholder}
              style={field}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button type="button" onClick={() => other.trim() && onLookup(other.trim())} disabled={busy} style={{ ...btnAlt, ...(busy ? btnDisabled : {}) }}>
                {REPLACE.useThis}
              </button>
              {canUndo && <button type="button" onClick={onUndo} style={btnAltSmall}>Undo</button>}
            </div>
          </div>
        </div>
      </section>

      {R.sys && (
        <>
          <section style={{ margin: "0 0 26px" }}>
            <h3 style={sectionTitle}>{REPLACE.partsTitle(sysName)}</h3>
            <p style={sub}>{REPLACE.partsLede}</p>
            <div style={{ margin: "0 0 12px" }}>
              <button
                type="button"
                onClick={() => {
                  const next: Record<string, Priority> = { ...R.caps };
                  caps.forEach((c, n) => {
                    next[c.key] = n < 3 ? "Must" : n < 5 ? "Should" : "Could";
                  });
                  rep({ caps: next });
                }}
                style={btnAltSmall}
              >
                <span aria-hidden="true" style={{ marginRight: 6 }}>&#10022;</span>
                {REPLACE.selectUsual}
              </button>
            </div>
            <div className="pb-feats">
              {caps.map((c) => {
                const p = R.caps[c.key] ?? "";
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => {
                      const next = { ...R.caps };
                      const np = nextPri(p);
                      if (np) next[c.key] = np;
                      else delete next[c.key];
                      rep({ caps: next });
                    }}
                    aria-label={`${c.title}${p ? `, ${PRIORITY_LABELS[p]}` : ", not used"}`}
                    style={card(p)}
                  >
                    <strong style={cardTitle}>{c.title}</strong>
                    <span style={cardBody}>{c.requirement}</span>
                    {p && <span style={cardPri(p)}>{p}</span>}
                  </button>
                );
              })}
            </div>
          </section>
          <section style={{ margin: "0 0 26px" }}>
            <h3 style={sectionTitle}>{REPLACE.whyTitle(sysName)}</h3>
            <p style={sub}>{REPLACE.whyLede}</p>
            <div style={chips}>
              {Object.keys(REPLACEMENT_REASONS).map((r) => (
                <button key={r} type="button" onClick={() => rep({ reasons: toggle(R.reasons, r) })} aria-pressed={R.reasons.includes(r)} style={chip(R.reasons.includes(r))}>
                  {r}
                </button>
              ))}
            </div>
          </section>
          <section style={{ margin: "0 0 26px" }}>
            <h3 style={sectionTitle}>{REPLACE.switchTitle}</h3>
            <div style={chips}>
              <button type="button" onClick={() => rep({ migrate: !R.migrate })} aria-pressed={R.migrate} style={chip(R.migrate)}>{REPLACE.migrate}</button>
              <button type="button" onClick={() => rep({ parallel: !R.parallel })} aria-pressed={R.parallel} style={chip(R.parallel)}>{REPLACE.parallel}</button>
            </div>
          </section>
          <button type="button" onClick={onBuild} disabled={busy} style={{ ...btn, ...(busy ? btnDisabled : {}) }}>{REPLACE.build}</button>
        </>
      )}
      <p style={status} role="status">{note}</p>
    </div>
  );
}
