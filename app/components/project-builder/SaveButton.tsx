"use client";

import { useEffect, useRef, useState } from "react";
import { SAVE } from "@/app/lib/project-builder/copy";
import { btnAltSmall, btnSmall, ghost } from "./builder-styles";

export interface SaveButtonProps {
  /** The ISO time of the last save, or null before the first save. */
  savedAt: string | null;
  onSave: () => void;
  onReset: () => void;
  /** "Start again" while building, "Start a new brief" after a submit. */
  resetLabel?: string;
  busy?: boolean;
}

function hhmm(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** "Save" or "Saved at hh:mm", and "Start again" with the two tap confirm, at the top of every step. */
export default function SaveButton({ savedAt, onSave, onReset, resetLabel = SAVE.startAgain, busy = false }: SaveButtonProps) {
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
      <button type="button" onClick={onSave} disabled={busy} style={savedAt ? btnAltSmall : btnSmall}>
        {savedAt ? SAVE.savedAt(hhmm(savedAt)) : SAVE.save}
      </button>
      <button type="button" onClick={reset} style={ghost}>
        {armed ? SAVE.confirmReset : resetLabel}
      </button>
    </div>
  );
}
