"use client";

import type { ReactNode } from "react";
import { assist, assistText, btnAltSmall, btnDisabled, btnSmall, status } from "./builder-styles";

export interface AssistStripProps {
  text: string;
  /** The helper button label; omitted when the strip carries its own buttons. */
  label?: string;
  busy: boolean;
  onRun?: () => void;
  canUndo: boolean;
  onUndo: () => void;
  /** The status line under the strip. */
  note: string;
  /** Extra buttons before the helper button (the running step's quick answers). */
  children?: ReactNode;
}

/** The strip with the text, the helper button, Undo and the status line. Model text is rendered as text only. */
export default function AssistStrip({ text, label, busy, onRun, canUndo, onUndo, note, children }: AssistStripProps) {
  return (
    <>
      <div style={assist}>
        <p style={assistText}>{text}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {children}
          {label && onRun && (
            <button type="button" onClick={onRun} disabled={busy} style={{ ...btnSmall, ...(busy ? btnDisabled : {}) }}>
              <span aria-hidden="true" style={{ marginRight: 6 }}>&#10022;</span>
              {label}
            </button>
          )}
          {canUndo && (
            <button type="button" onClick={onUndo} style={btnAltSmall}>
              Undo
            </button>
          )}
        </div>
      </div>
      <p style={status} role="status">{note}</p>
    </>
  );
}
