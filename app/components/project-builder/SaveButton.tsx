"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BRAND } from "@/app/lib/brand";
import { SAVE } from "@/app/lib/project-builder/copy";
import type { PrototypeButtonState } from "@/app/lib/project-builder/prototype";
import { btnAltSmall, btnDisabled, btnSmall, ghost } from "./builder-styles";

export interface SaveButtonProps {
  /** The ISO time of the last save, or null before the first save. */
  savedAt: string | null;
  onSave: () => void;
  onReset: () => void;
  /** "Start again" while building, "Start a new brief" after a submit. */
  resetLabel?: string;
  busy?: boolean;
  /** The Create or Update prototype button; absent on a submitted brief. */
  prototype?: { state: PrototypeButtonState; onPress: () => void };
}

const HIDDEN: CSSProperties = { position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 };

function hhmm(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/**
 * "Save" or "Saved at hh:mm", the Create or Update prototype button (teal,
 * like its tab; its reason line is its accessible description and is also
 * shown in the tab), and "Start again" with the two tap confirm, at the top
 * of every step.
 */
export default function SaveButton({ savedAt, onSave, onReset, resetLabel = SAVE.startAgain, busy = false, prototype }: SaveButtonProps) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const reset = () => {
    if (armed) {
      setArmed(false);
      if (timer.current) clearTimeout(timer.current);
      onReset();
      return;
    }
    setArmed(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setArmed(false), 4000);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", flexWrap: "wrap", padding: "14px 0 0" }}>
      {prototype && prototype.state.show && (
        <>
          <button
            type="button"
            onClick={prototype.onPress}
            disabled={!prototype.state.enabled}
            aria-describedby={prototype.state.line ? "pb-proto-why" : undefined}
            title={prototype.state.line || undefined}
            style={{ ...btnSmall, background: BRAND.teal, borderColor: BRAND.teal, ...(prototype.state.enabled ? {} : btnDisabled) }}
          >
            {prototype.state.label}
          </button>
          {prototype.state.line && <span id="pb-proto-why" style={HIDDEN}>{prototype.state.line}</span>}
        </>
      )}
      <button type="button" onClick={onSave} disabled={busy} style={savedAt ? btnAltSmall : btnSmall}>
        {savedAt ? SAVE.savedAt(hhmm(savedAt)) : SAVE.save}
      </button>
      <button type="button" onClick={reset} style={ghost}>
        {armed ? SAVE.confirmReset : resetLabel}
      </button>
    </div>
  );
}
