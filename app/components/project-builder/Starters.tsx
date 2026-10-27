"use client";

import { starter } from "./builder-styles";

export interface StartersProps {
  list: readonly string[];
  onPick: (value: string) => void;
}

/** The tappable starter phrases under a field; the owner fills the field and selects the `___` run. */
export default function Starters({ list, onPick }: StartersProps) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
      {list.map((s) => (
        <button key={s} type="button" onClick={() => onPick(s)} style={starter}>
          {s}
        </button>
      ))}
    </div>
  );
}

/** Focuses the field and selects the first `___` run so the next keystroke replaces it. */
export function selectBlank(el: HTMLInputElement | HTMLTextAreaElement | null, value: string): void {
  if (!el) return;
  el.focus({ preventScroll: true });
  const k = value.indexOf("___");
  if (k >= 0 && typeof el.setSelectionRange === "function") {
    try {
      el.setSelectionRange(k, k + 3);
    } catch {
      // some input types refuse a selection range
    }
  }
}
