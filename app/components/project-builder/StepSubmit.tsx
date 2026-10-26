"use client";

import { BRAND } from "@/app/lib/brand";
import type { BriefState } from "@/app/lib/project-builder/brief";
import { STEP_HEADINGS, SUBMIT } from "@/app/lib/project-builder/copy";
import { buildRequirements, countByPriority, essentials, otherIntegrations, projectName } from "@/app/lib/project-builder/requirements";
import { SANS, WARN, btn, btnDisabled, ghost, h2, lede, panel, panelTitle, status } from "./builder-styles";
import ContactFields, { type ContactDraft } from "./ContactFields";

export interface StepSubmitProps {
  state: BriefState;
  saved: boolean;
  contact: ContactDraft;
  onContact: (patch: Partial<ContactDraft>) => void;
  contactError: string;
  busy: boolean;
  note: string;
  onGoto: (step: number) => void;
  onOpenSave: () => void;
  onSubmit: () => void;
}

/**
 * Step 6: the six essentials as a checklist with "Add this" links, the
 * summary, the contact panel (the fields when not saved, "Submitting as"
 * with Change when saved) and "Submit to Summit". Submit is allowed with
 * gaps; the line says how many are blank.
 */
export default function StepSubmit({ state, saved, contact, onContact, contactError, busy, note, onGoto, onOpenSave, onSubmit }: StepSubmitProps) {
  const e = essentials(state);
  const reqs = buildRequirements(state);
  const c = countByPriority(reqs);
  const missing = e.filter((x) => !x.met).length;
  const ideas = state.ideas.filter((i) => state.ideaPick[i.id] && state.ideaPick[i.id] !== "no").length;
  return (
    <div style={{ fontFamily: SANS }}>
      <h2 style={h2}>{STEP_HEADINGS[5].title}</h2>
      <p style={lede}>{STEP_HEADINGS[5].lede}</p>
      <ul className="pb-checks" style={{ borderTop: `1px solid ${BRAND.border}` }}>
        {e.map((x) => (
          <li key={x.label} style={{ borderBottom: `1px solid ${BRAND.border}`, color: BRAND.darkGreen }}>
            <span aria-hidden="true" style={{ flex: "none", width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700, background: x.met ? BRAND.brandGreen : "transparent", color: x.met ? BRAND.white : WARN, border: x.met ? "none" : `2px solid ${WARN}` }}>
              {x.met ? "✓" : "!"}
            </span>
            <span style={{ flex: 1 }}>{x.label}</span>
            {!x.met && <button type="button" onClick={() => onGoto(x.step)} style={ghost}>{SUBMIT.addThis}</button>}
          </li>
        ))}
      </ul>
      {missing > 0 && <p style={status}>{SUBMIT.missing(missing)}</p>}
      <dl className="pb-sum" style={{ borderTop: `1px solid ${BRAND.border}` }}>
        {[
          [SUBMIT.project, projectName(state)],
          [SUBMIT.users, state.roles.join(", ") || SUBMIT.noneYet],
          [SUBMIT.requirements, `${reqs.length}: ${c.Must} must have, ${c.Should} should have, ${c.Could} could have`],
          [SUBMIT.ideasAdded, String(ideas)],
          [SUBMIT.connections, state.integrations.concat(otherIntegrations(state)).join(", ") || SUBMIT.none],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "contents" }}>
            <dt style={{ fontWeight: 700, color: BRAND.darkGreen, paddingRight: 14, borderBottom: `1px solid ${BRAND.border}` }}>{k}</dt>
            <dd style={{ borderBottom: `1px solid ${BRAND.border}`, color: BRAND.teal }}>{v}</dd>
          </div>
        ))}
      </dl>
      {saved ? (
        <div style={panel}>
          <h3 style={panelTitle}>{SUBMIT.submittingAs}</h3>
          <p style={{ margin: 0, color: BRAND.teal }}>
            {contact.name}, {contact.company} ({contact.email}). <button type="button" onClick={onOpenSave} style={ghost}>{SUBMIT.change}</button>
          </p>
        </div>
      ) : (
        <div style={panel}>
          <h3 style={panelTitle}>{SUBMIT.whoTitle}</h3>
          <ContactFields contact={contact} onChange={onContact} error={contactError} idPrefix="pb-submit" />
        </div>
      )}
      <button type="button" onClick={onSubmit} disabled={busy} style={{ ...btn, ...(busy ? btnDisabled : {}) }}>{SUBMIT.button}</button>
      <p style={status} role="status">{note}</p>
    </div>
  );
}
