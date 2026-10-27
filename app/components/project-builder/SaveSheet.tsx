"use client";

import { useEffect } from "react";
import { BRAND } from "@/app/lib/brand";
import { SAVE } from "@/app/lib/project-builder/copy";
import { CONDENSED, SANS, btn, btnAlt, btnDisabled } from "./builder-styles";
import ContactFields, { type ContactDraft } from "./ContactFields";

export interface SaveSheetProps {
  open: boolean;
  /** True after the first save: "Your details" wording. */
  saved: boolean;
  contact: ContactDraft;
  onChange: (patch: Partial<ContactDraft>) => void;
  error: string;
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
}

/** The modal sheet around the contact fields; Escape and the scrim close it. */
export default function SaveSheet({ open, saved, contact, onChange, error, busy, onCancel, onSave }: SaveSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div
      className="pb-modal"
      style={{ background: "rgba(5,48,48,0.55)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="pb-sheet" role="dialog" aria-modal="true" aria-labelledby="pb-save-title" style={{ background: BRAND.lightBg, border: `2px solid ${BRAND.darkGreen}` }}>
        <h2 id="pb-save-title" style={{ fontFamily: CONDENSED, fontWeight: 600, color: BRAND.darkGreen, fontSize: 30, margin: "0 0 6px" }}>
          {saved ? SAVE.sheetTitleSaved : SAVE.sheetTitleNew}
        </h2>
        <p style={{ margin: "0 0 18px", fontFamily: SANS, color: BRAND.teal, fontSize: 15, lineHeight: 1.5 }}>{saved ? SAVE.sheetLedeSaved : SAVE.sheetLedeNew}</p>
        <ContactFields contact={contact} onChange={onChange} error={error} idPrefix="pb-sheet" />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" onClick={onCancel} style={btnAlt}>{SAVE.cancel}</button>
          <button type="button" onClick={onSave} disabled={busy} style={{ ...btn, ...(busy ? btnDisabled : {}) }}>{SAVE.save}</button>
        </div>
      </div>
    </div>
  );
}
